#!/usr/bin/env python3
"""Извлечение единиц перевода и расчёт покрытия словарей (фаза 1).

Единицы перевода в исходниках сайта:
  tagged — элементы с data-i18n / data-i18n-attr, литералы t('key', ...)
           и карта BURGER_KEYS (js/burger-menu.js);
  units  — русские тексты разметки без ключа (в фазе 3 станут phrases.*).

Покрытие локали = (переведённые tagged + units у языка разметки) / (tagged + units).
Для языка разметки (manifest.default) непокрытые строки уже на нужном языке,
для остальных они остаются русскими и в числитель не входят. Метрика приблизительная:
единица — элемент разметки с русским текстом, а не отдельная «строка UI».

Использование:
  python tools/i18n-extract.py report   # статистика без записи
  python tools/i18n-extract.py check    # 0 = ru.json и coverage актуальны, 1 = расходятся
  python tools/i18n-extract.py write    # добавить недостающие ключи, пересчитать coverage

`write` никогда не перезаписывает непустые значения и ничего не удаляет:
удаление ключа остаётся решением человека.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEBSITE = ROOT / "products" / "website"
LOCALES = WEBSITE / "src" / "locales"
MANIFEST_PATH = LOCALES / "index.json"
I18N_JS = WEBSITE / "src" / "js" / "i18n.js"

# Интерфейс сайта: страницы, скрипты и Research Lab.
# Корпус (src/content, src/data) — контент другого уровня, не входит в UI-покрытие.
SCAN_DIRS = [
    WEBSITE / "src" / "pages",
    WEBSITE / "src" / "js",
]
SCAN_SUFFIXES = {".html", ".js"}
SKIP_PARTS = {"build", "node_modules", ".git"}

# Ключ словаря: точка-разделитель, строчные буквы, без пробелов
# (русский текст как ключ — это phrases.* фазы 3, он сюда не попадает).
KEY_RE = re.compile(r"^[a-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$")
# t('key') или t('key', 'русский резерв') — второй захватывается как ru-текст,
# чтобы write мог заполнить словарь даже для динамических строк из JS.
_T_CALL = re.compile(r"\bt\(\s*'([^']+)'\s*(?:,\s*'([^']*)')?")
_BURGER_BLOCK = re.compile(r"BURGER_KEYS\s*=\s*\{(.*?)\}", re.S)

# Теги, весь текст которых служебный.
_SKIP_TAGS = {"script", "style", "template", "svg", "noscript"}
# Строчные теги: их текст «всплывает» к ближайшему блочному предку, чтобы
# <p>текст <b>акцент</b></p> оставался одной единицей перевода.
_INLINE_TAGS = {
    "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del", "dfn",
    "em", "i", "ins", "kbd", "mark", "q", "rp", "rt", "ruby", "s", "samp",
    "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr",
}

_CYRILLIC = re.compile(r"[А-Яа-яЁё]")
_WORDS = re.compile(r"[A-Za-zА-Яа-яЁё]{2,}")


def source_files() -> list[Path]:
    """HTML/JS исходников сайта, которые обязан покрывать словарь."""
    lab = WEBSITE / "apps" / "researchlab"
    # Phase 2: оболочка, крошки и реестры шапки; page-controller.js даёт ключи панелей
    # детали агента (литералы t('lab.agents.*', ...) в JS модуля),
    # video-lab.js — ключи Генератора видео-образов (литералы t('lab.video.*', ...)),
    # religionism-checker.js и его страница — ключи чекера (lab.religionism.*).
    found = [
        lab / "index.html",
        lab / "js" / "router.js",
        lab / "js" / "lab-hero.js",
        lab / "js" / "page-controller.js",
        lab / "js" / "video-lab.js",
        lab / "js" / "religionism-checker.js",
        lab / "js" / "state-checker.js",
        lab / "js" / "tree-checker.js",
        lab / "js" / "checkers-comparator.js",
        lab / "js" / "states.js",
        lab / "pages" / "video-lab.html",
        lab / "pages" / "religionism-checker.html",
        lab / "pages" / "state-checker.html",
        lab / "pages" / "tree-checker.html",
        lab / "pages" / "translation-comparator.html",
    ]
    for base in SCAN_DIRS:
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in SCAN_SUFFIXES:
                continue
            if SKIP_PARTS & set(path.relative_to(ROOT).parts):
                continue
            found.append(path)
    return found


def is_text_unit(text: str) -> bool:
    """Русский текст, достойный перевода: не символ, не подпись из одного слова."""
    stripped = text.strip()
    return len(stripped) >= 3 and bool(_CYRILLIC.search(stripped)) and len(_WORDS.findall(stripped)) >= 2


class MarkupScan(HTMLParser):
    """Ключи data-i18n / data-i18n-attr и русский текст без ключа.

    Кадр стека — элемент. Текст копится в текущем кадре, при закрытии:
      * элемент с ключом — отдаёт текст ключу (русский язык разметки);
      * блочный элемент — становится единицей перевода;
      * строчный — всплывает к ближайшему блочному или ключевому предку.
    """

    def __init__(self, rel: str) -> None:
        super().__init__(convert_charrefs=True)
        self.rel = rel
        self.frames: list[dict] = []
        self.keys: dict[str, dict] = {}
        self.units: list[tuple[str, int, str]] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self.skip += 1
            return
        data = {name: (value or "") for name, value in attrs}
        frame = {
            "tag": tag,
            "line": self.getpos()[0],
            "key": (data.get("data-i18n") or "").strip(),
            "own": tag not in _INLINE_TAGS,
            "text": [],
        }
        self.frames.append(frame)
        if frame["key"]:
            self._touch(frame["key"], "", frame["line"])
        for pair in data.get("data-i18n-attr", "").split(";"):
            name, _, key = pair.partition(":")
            if name.strip() and key.strip():
                self._touch(key.strip(), data.get(name.strip(), ""), frame["line"])

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if self.skip or not self.frames:
            return
        self.frames[-1]["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS:
            self.skip = max(0, self.skip - 1)
            return
        for index in range(len(self.frames) - 1, -1, -1):
            if self.frames[index]["tag"] == tag:
                self._close(index)
                return

    def _close(self, index: int) -> None:
        frame = self.frames.pop(index)
        text = " ".join("".join(frame["text"]).split())
        target = None
        if frame["key"]:
            self._touch(frame["key"], text, frame["line"])
        else:
            for parent in reversed(self.frames):
                if parent["key"] or parent["own"]:
                    target = parent
                    break
        if not text or target is None:
            return
        if target.get("key"):
            target["text"].append(" " + text)
        elif is_text_unit(text):
            self.units.append((self.rel, frame["line"], text))

    def _touch(self, key: str, text: str, line: int) -> None:
        item = self.keys.setdefault(key, {"ru": "", "files": set(), "line": line})
        item["files"].add(self.rel)
        if text and not item["ru"]:
            item["ru"] = text


def scan_js(text: str, rel: str) -> tuple[dict[str, dict], int]:
    """Ключи скрипта: литералы t('key', ...) и значения карты BURGER_KEYS."""
    found: dict[str, dict] = {}

    def remember(key: str, line: int, ru: str = "") -> None:
        item = found.setdefault(key, {"ru": "", "files": set(), "line": line})
        item["files"].add(rel)
        if ru and not item["ru"]:
            item["ru"] = ru

    for match in _T_CALL.finditer(text):
        key = match.group(1).strip()
        if KEY_RE.match(key):
            fallback = match.group(2) or ""
            remember(key, text.count("\n", 0, match.start()) + 1, fallback)

    burger = 0
    block = _BURGER_BLOCK.search(text)
    if block:
        for match in re.finditer(r":\s*'([^']+)'", block.group(1)):
            key = match.group(1)
            if KEY_RE.match(key):
                remember(key, text.count("\n", 0, block.start()) + 1)
                burger += 1
    # LabHero builds keys from the two static registries; dynamic overrides are content.
    if rel.endswith("/researchlab/js/lab-hero.js"):
        for registry, prefix in (("TARGETS", "lab.hero."), ("VIEWS", "lab.hero.views.")):
            block = re.search(r"var " + registry + r"\s*=\s*\{(.*?)\n  \};", text, re.S)
            if not block:
                raise ValueError(f"LabHero registry not found: {registry}")
            # Запись маршрута может содержать вложенные объекты (meta с чипами):
            # границей служит закрывающая скобка записи на её отступе.
            for route in re.finditer(r"'([^']+)'\s*:\s*\{(.*?)\n    \}", block.group(1), re.S):
                for field in re.finditer(r"\b(kicker|title|subtitle):\s*'([^'\\]*)'", route.group(2)):
                    key = prefix + route.group(1).replace("/", ".") + "." + field.group(1)
                    remember(key, text.count("\n", 0, block.start()) + 1, field.group(2))
    return found, burger


def collect() -> dict:
    """Все единицы перевода исходников сайта."""
    tagged: dict[str, dict] = {}
    units: list[tuple[str, int, str]] = []
    files = source_files()
    burger_keys = 0
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        if path.suffix.lower() == ".html":
            scan = MarkupScan(rel)
            scan.feed(text)
            scan.close()
            units.extend(scan.units)
            part = scan.keys
        else:
            part, count = scan_js(text, rel)
            burger_keys += count
        for key, item in part.items():
            merged = tagged.setdefault(key, {"ru": "", "files": set(), "line": item["line"]})
            merged["files"] |= item["files"]
            if item["ru"] and not merged["ru"]:
                merged["ru"] = item["ru"]
    return {"tagged": tagged, "units": units, "files": len(files), "burger_keys": burger_keys}


def value_of(data: dict, key: str):
    """Значение по точке-разделителю или None."""
    node = data
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def non_empty(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def set_value(data: dict, key: str, value: str) -> None:
    """Записать значение, не меняя порядок существующих ключей."""
    parts = key.split(".")
    node = data
    for part in parts[:-1]:
        child = node.get(part)
        if not isinstance(child, dict):
            child = {}
            node[part] = child
        node = child
    node[parts[-1]] = value


def translatable_keys(data: dict) -> list[str]:
    """Листовые ключи словаря без служебных dir и meta.*."""
    out: list[str] = []

    def walk(node: dict, prefix: str) -> None:
        for name, value in node.items():
            path = f"{prefix}.{name}" if prefix else name
            if isinstance(value, dict):
                walk(value, path)
            elif path != "dir" and not path.startswith("meta."):
                out.append(path)

    walk(data, "")
    return out


def load_dict(code: str) -> dict:
    return json.loads((LOCALES / f"{code}.json").read_text(encoding="utf-8"))


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_dicts(manifest: dict) -> dict[str, dict]:
    codes = [lang["code"] for lang in manifest.get("languages", []) if lang.get("code")]
    return {code: load_dict(code) for code in codes}


def untranslated(scan: dict, data: dict) -> list[str]:
    """Ключи, которых разметка требует, а словарь их не содержит или держит пустыми."""
    return sorted(key for key in scan["tagged"] if not non_empty(value_of(data, key)))


def compute_coverage(manifest: dict, scan: dict, dicts: dict[str, dict]) -> dict[str, float]:
    """Доля переведённых единиц: ключи разметки плюс непокрытые строки у языка разметки."""
    total = len(scan["tagged"]) + len(scan["units"])
    if not total:
        return {}
    default = manifest.get("default", "ru")
    result: dict[str, float] = {}
    for lang in manifest.get("languages", []):
        code = lang.get("code", "")
        data = dicts.get(code)
        if not isinstance(data, dict):
            continue
        done = sum(1 for key in scan["tagged"] if non_empty(value_of(data, key)))
        if code == default:
            done += len(scan["units"])
        value = round(done / total, 2)
        result[code] = int(value) if float(value).is_integer() else value
    return result


def declared_coverage(manifest: dict, dicts: dict[str, dict]) -> dict[str, float | None]:
    """Покрытие, записанное в манифесте и в meta покрытие словаря (meta приоритетнее)."""
    declared: dict[str, float | None] = {}
    for lang in manifest.get("languages", []):
        code = lang.get("code", "")
        value = lang.get("coverage")
        meta = dicts.get(code, {}).get("meta")
        if isinstance(meta, dict) and "coverage" in meta:
            value = meta["coverage"]
        declared[code] = value
    return declared


def drift(scan: dict, ru: dict) -> list[str]:
    """Ключи, где русский текст разметки разошёлся со значением словаря."""
    out = []
    for key, item in sorted(scan["tagged"].items()):
        value = value_of(ru, key)
        if non_empty(item["ru"]) and non_empty(value) and item["ru"].strip() != value.strip():
            out.append(key)
    return out


def write_if_changed(path: Path, data: dict) -> bool:
    """Записать JSON, только если он изменился; отступ берётся у исходника."""
    raw = path.read_text(encoding="utf-8")
    lines = raw.split("\n")
    indent = len(lines[1]) - len(lines[1].lstrip()) if len(lines) > 1 and lines[1].strip() else 2
    text = json.dumps(data, ensure_ascii=False, indent=indent or 2) + ("\n" if raw.endswith("\n") else "")
    if text == raw:
        return False
    path.write_text(text, encoding="utf-8", newline="\n")
    return True


def describe(scan: dict, manifest: dict, dicts: dict[str, dict]) -> list[str]:
    """Цифры извлечения, покрытие и расхождения — одна строка на факт."""
    default = manifest.get("default", "ru")
    coverage = compute_coverage(manifest, scan, dicts)
    declared = declared_coverage(manifest, dicts)
    lines = [
        f"файлов: {scan['files']}, ключей разметки и JS: {len(scan['tagged'])} "
        f"(BURGER_KEYS: {scan['burger_keys']})",
        f"русских строк без ключа: {len(scan['units'])} "
        f"-> единиц перевода: {len(scan['tagged']) + len(scan['units'])}",
    ]
    for code, value in coverage.items():
        lines.append(f"покрытие {code}: {value:.2f} (в манифесте {declared.get(code)})")
    missed = untranslated(scan, dicts.get(default, {}))
    if missed:
        lines.append(f"нет в {default}.json: {len(missed)} — {', '.join(missed[:6])}")
    changed = drift(scan, dicts.get(default, {}))
    if changed:
        lines.append(f"русский текст разметки ≠ словарю: {', '.join(changed)}")
    return lines


def main() -> int:
    # Консоль Windows часто не UTF-8: редкий символ не должен ронять прогон.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(
        description="Извлечение ключей локализации и расчёт покрытия словарей сайта Alephy.",
    )
    parser.add_argument(
        "mode",
        nargs="?",
        default="check",
        choices=("check", "write", "report"),
        help="check — сверка словаря с исходниками (по умолчанию), write — записать ключи и покрытие, report — только отчёт",
    )
    args = parser.parse_args()

    manifest = load_manifest()
    dicts = load_dicts(manifest)
    scan = collect()
    default = manifest.get("default", "ru")
    coverage = compute_coverage(manifest, scan, dicts)
    declared = declared_coverage(manifest, dicts)

    print("— Локализация: извлечение из исходников —")
    for line in describe(scan, manifest, dicts):
        print("  " + line)
    print("")

    if scan["burger_keys"] == 0:
        print("[error] карта BURGER_KEYS не найдена: ключи навигации не извлечены")
        print("")
        print("— Итог: извлечение сломано —")
        return 1

    if args.mode == "report":
        print("— Итог: отчёт —")
        return 0

    if args.mode == "write":
        added = 0
        for code, data in dicts.items():
            for key in sorted(scan["tagged"]):
                if value_of(data, key) is not None:
                    continue
                # Пустая строка у чужого языка = «ещё не переведено», а не русский текст.
                set_value(data, key, scan["tagged"][key]["ru"] if code == default else "")
                added += 1
            meta = data.get("meta")
            if isinstance(meta, dict):
                meta["coverage"] = coverage.get(code)
            write_if_changed(LOCALES / f"{code}.json", data)
        for lang in manifest.get("languages", []):
            if lang.get("code") in coverage:
                lang["coverage"] = coverage[lang["code"]]
        write_if_changed(MANIFEST_PATH, manifest)
        print(f"[ok] добавлено ключей: {added}; покрытие пересчитано")
        print("")
        print("— Итог: словари обновлены —")
        return 0

    for code, value in coverage.items():
        if declared.get(code) != value:
            print(f"[warn] покрытие {code}: в файлах {declared.get(code)}, посчитано {value:.2f} — нужен write")
    missed = untranslated(scan, dicts.get(default, {}))
    if missed:
        print(f"[error] {default}.json не содержит ключей разметки: {len(missed)} — {', '.join(missed[:8])}")
    reference = translatable_keys(dicts.get(default, {}))
    broken = False
    for code, data in sorted(dicts.items()):
        if code == default:
            continue
        absent = sorted(key for key in reference if value_of(data, key) is None)
        if absent:
            broken = True
            print(f"[error] {code}.json: нет ключей из {default}.json — {len(absent)}: {', '.join(absent[:8])}")
    changed = drift(scan, dicts.get(default, {}))
    if changed:
        print(f"[warn] русский текст разметки разошёлся со словарём: {', '.join(changed)}")

    if missed or broken:
        print("")
        print("— Итог: нужен python tools/i18n-extract.py write —")
        return 1
    print("")
    print("— Итог: чисто —")
    return 0


if __name__ == "__main__":
    sys.exit(main())


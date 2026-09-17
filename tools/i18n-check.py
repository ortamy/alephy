#!/usr/bin/env python3
"""Статическая проверка локализации сайта (фаза 1).

Проверки:
  json       [error]  словарь не парсится / BOM / CRLF / корень не объект;
  manifest   [error]  манифест языков: default, коды, dir, status, meta.code, dir словаря;
  parity     [error]  набор листовых ключей локали ≠ набору языка разметки;
  usage      [error]  разметка или JS требует ключа, которого нет в словаре;
  ready      [error]  активный язык (status=ready) имеет незаполненный ключ интерфейса;
  markup_ru  [warn]   элемент с data-i18n остался без русского текста;
  untagged   [warn]   русские строки разметки без ключа (фаза 3: phrases.*);
  unused     [warn]   ключ словаря не встречается ни в разметке, ни в JS;
  coverage   [warn]   покрытие в манифесте разошлось с расчётом tools/i18n-extract.py.

Использование:
  python tools/i18n-check.py check   # 0 = чисто (warn допустимы), 1 = есть error
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "products" / "website" / "src" / "locales"
ALLOWED_STATUS = {"ready", "draft"}
ALLOWED_DIRS = {"ltr", "rtl"}
MANIFEST_NAME = "index"


def load_extractor():
    """Импортирует tools/i18n-extract.py как модуль: извлечение одно на два инструмента."""
    path = ROOT / "tools" / "i18n-extract.py"
    spec = importlib.util.spec_from_file_location("i18n_extract", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Report:
    """Счётчики ошибок и предупреждений; ошибка блокирует merge, warn — нет."""

    def __init__(self) -> None:
        self.errors = 0
        self.warnings = 0

    def ok(self, message: str) -> None:
        print(f"[ok]    {message}")

    def warn(self, message: str) -> None:
        self.warnings += 1
        print(f"[warn]  {message}")

    def error(self, message: str) -> None:
        self.errors += 1
        print(f"[error] {message}")


def check_json(report: Report) -> dict[str, dict]:
    """Словари и манифест: читаемость, кодировка, перевод строки."""
    dicts: dict[str, dict] = {}
    for path in sorted(LOCALES.glob("*.json")):
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            report.error(f"{path.name}: файл начинается с BOM")
        if b"\r" in raw:
            report.error(f"{path.name}: перевод строки CRLF — нужен LF")
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            report.error(f"{path.name}: не парсится — {error}")
            continue
        if not isinstance(data, dict):
            report.error(f"{path.name}: корень не объект")
            continue
        dicts[path.stem] = data
    report.ok(f"словарей прочитано: {len(dicts)} ({', '.join(sorted(dicts))})")
    return dicts


def check_manifest(report: Report, dicts: dict[str, dict]) -> dict:
    """Манифест — единственный источник правды о том, что видит пользователь."""
    manifest = dicts.get(MANIFEST_NAME)
    if not isinstance(manifest, dict):
        report.error(f"{MANIFEST_NAME}.json: манифест не найден")
        return {}
    languages = manifest.get("languages")
    if not isinstance(languages, list) or not languages:
        report.error(f"{MANIFEST_NAME}.json: список languages пуст")
        return manifest

    default = manifest.get("default")
    codes = [lang.get("code", "") for lang in languages]
    if len(set(codes)) != len(codes):
        report.error(f"{MANIFEST_NAME}.json: коды языков повторяются")
    if default not in codes:
        report.error(f"{MANIFEST_NAME}.json: default={default!r} отсутствует в languages")

    for lang in languages:
        code = lang.get("code") or "?"
        if lang.get("status") not in ALLOWED_STATUS:
            report.error(f"{MANIFEST_NAME}.json: {code}: status={lang.get('status')!r} (нужно ready|draft)")
        if lang.get("dir") not in ALLOWED_DIRS:
            report.error(f"{MANIFEST_NAME}.json: {code}: dir={lang.get('dir')!r} (нужно ltr|rtl)")
        for field in ("label", "name"):
            if not lang.get(field):
                report.error(f"{MANIFEST_NAME}.json: {code}: пустое поле {field}")
        if code == default and lang.get("status") != "ready":
            report.error(f"{MANIFEST_NAME}.json: язык разметки {code} обязан быть ready")
        data = dicts.get(code)
        if data is None:
            report.error(f"{MANIFEST_NAME}.json: нет словаря {code}.json")
            continue
        meta = data.get("meta")
        if not isinstance(meta, dict) or meta.get("code") != code:
            report.error(f"{code}.json: meta.code ≠ {code}")
        if data.get("dir") and data["dir"] != lang.get("dir"):
            report.error(f"{code}.json: dir={data['dir']} ≠ манифесту {lang.get('dir')}")
    report.ok(f"манифест: default={default}, языков {len(languages)}")
    return manifest


def check_parity(report: Report, ext, manifest: dict, dicts: dict[str, dict]) -> None:
    """Словари обязаны идти в ногу: переводчик не должен искать ключ глазами."""
    default = manifest.get("default", "ru")
    reference = set(ext.translatable_keys(dicts.get(default, {})))
    broken = 0
    for code, data in sorted(dicts.items()):
        if code in (default, MANIFEST_NAME):
            continue
        current = set(ext.translatable_keys(data))
        missing = sorted(reference - current)
        extra = sorted(current - reference)
        if missing:
            broken += 1
            report.error(f"{code}.json: нет ключей из {default}.json — {len(missing)}: {', '.join(missing[:6])}")
        if extra:
            broken += 1
            report.error(f"{code}.json: лишние ключи — {len(extra)}: {', '.join(extra[:6])}")
    if not broken:
        report.ok(f"паритет ключей: {len(reference)} у каждого языка")


def check_usage(report: Report, ext, manifest: dict, dicts: dict[str, dict], scan: dict) -> None:
    """Ключ, который требует разметка или JS, обязан существовать в каждом словаре."""
    broken = 0
    for code, data in sorted(dicts.items()):
        if code == MANIFEST_NAME:
            continue
        ready = code == manifest.get("default") or any(
            lang.get("code") == code and lang.get("status") == "ready"
            for lang in manifest.get("languages", [])
        )
        absent: list[str] = []
        empty: list[str] = []
        for key in sorted(scan["tagged"]):
            value = ext.value_of(data, key)
            if value is None:
                absent.append(key)
            elif ready and not ext.non_empty(value):
                empty.append(key)
        if absent:
            broken += 1
            report.error(
                f"{code}.json: нет ключей, которые требует разметка и JS — {len(absent)}: {', '.join(absent[:6])}"
            )
        if empty:
            broken += 1
            report.error(f"{code}.json (status=ready): незаполненные ключи — {len(empty)}: {', '.join(empty[:6])}")
    if scan["burger_keys"] == 0:
        broken += 1
        report.error("js/burger-menu.js: карта BURGER_KEYS не читается — ключи навигации не проверены")
    if not broken:
        report.ok(f"использование: {len(scan['tagged'])} ключей разметки и JS есть в словарях")


def check_markup(report: Report, scan: dict) -> None:
    """Русский — язык разметки: без текста в HTML английская версия покажет пустоту."""
    silent = sorted(
        key
        for key, item in scan["tagged"].items()
        if any(name.endswith(".html") for name in item["files"]) and not item["ru"].strip()
    )
    if silent:
        report.warn(f"элементы с data-i18n без русского текста: {len(silent)} — {', '.join(silent[:6])}")
    else:
        report.ok("русский текст на месте у всех элементов с data-i18n")


def check_units(report: Report, scan: dict) -> None:
    """Непокрытая строка — это будущая phrases.* (фаза 3), не ошибка фазы 1."""
    if scan["units"]:
        report.warn(f"русских строк без ключа: {len(scan['units'])} — фаза 3 оформит их в phrases.*")
    else:
        report.ok("непокрытых русских строк нет")


def check_unused(report: Report, ext, manifest: dict, dicts: dict[str, dict], scan: dict) -> None:
    """Ключ словаря без использования — заготовка или мусор; решает человек."""
    default = manifest.get("default", "ru")
    unused = [key for key in ext.translatable_keys(dicts.get(default, {})) if key not in scan["tagged"]]
    if unused:
        report.warn(f"ключи словаря вне исходников: {len(unused)} — {', '.join(unused[:6])}")
    else:
        report.ok("все ключи словаря используются в исходниках")


def check_coverage(report: Report, ext, manifest: dict, dicts: dict[str, dict], scan: dict) -> None:
    """Покрытие — метрика, а не контракт: расхождение чинится tools/i18n-extract.py write."""
    coverage = ext.compute_coverage(manifest, scan, dicts)
    declared = ext.declared_coverage(manifest, dicts)
    for code, value in coverage.items():
        if declared.get(code) == value:
            report.ok(f"покрытие {code}: {value:.2f}")
        else:
            report.warn(f"покрытие {code}: в файлах {declared.get(code)}, посчитано {value:.2f} — нужен write")


def main() -> int:
    # Консоль Windows часто не UTF-8: редкий символ не должен ронять прогон.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(
        description="Проверка локализации сайта Alephy: словари, паритет, использование ключей.",
    )
    parser.add_argument("mode", nargs="?", default="check", choices=("check",), help="check — единственный режим")
    parser.parse_args()

    ext = load_extractor()
    report = Report()
    print("— Локализация: проверка —")
    dicts = check_json(report)
    manifest = check_manifest(report, dicts)
    scan = ext.collect()
    if manifest:
        check_parity(report, ext, manifest, dicts)
        check_usage(report, ext, manifest, dicts, scan)
    check_markup(report, scan)
    check_units(report, scan)
    if manifest:
        check_unused(report, ext, manifest, dicts, scan)
        check_coverage(report, ext, manifest, dicts, scan)
    print("")
    summary = "чисто" if report.errors == 0 else f"ошибок {report.errors}"
    if report.warnings:
        summary += f", warnings {report.warnings}"
    print(f"— Итог: {summary} —")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())

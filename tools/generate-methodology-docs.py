#!/usr/bin/env python3
"""Переносит методички docs/06-METHODOLOGY в данные Research Lab.

Список документов не дублируется: генератор читает реестр лаборатории
(products/website/apps/researchlab/js/module-registry.js) и берёт у маршрутов
method-* поля key и docs. Реестр остаётся единственным источником списка.

Формат результата совпадает с data/exposures/documents.json:
  {key: {title, description, source, sections: [{title, content}]}}
content — Markdown, страница разметки рендерит его через marked.

Результат разложен на два уровня: data/methodology/index.json — заголовки и
описания для карточек хаба, data/methodology/documents/<key>.json — тело
документа. Один общий файл на весь корпус весил бы больше полумегабайта и
грузился бы целиком ради списка карточек.

Что отбрасывается: блок «**Метаданные файла**» (провенанс остаётся в полях
source и description) и пустые `---`-разделители. Заголовок документа и H2,
записанные капсом, приводятся к виду остальных страниц лаба
(«АРХЕОЛОГИЯ СМЫСЛОВ» → «Археология смыслов»).

Запуск:
  python tools/generate-methodology-docs.py           # перегенерировать
  python tools/generate-methodology-docs.py --check   # гейт: файлы в lab и
                                                      # build совпали с docs/
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "products" / "website" / "apps" / "researchlab"
BUILD = ROOT / "products" / "website" / "build" / "apps" / "researchlab"
REGISTRY = LAB / "js" / "module-registry.js"
INDEX_REL = Path("data") / "methodology" / "index.json"
DOCS_DIR_REL = Path("data") / "methodology" / "documents"

ID_RE = re.compile(r"id:\s*'(method-[a-z0-9-]+)'")
KEY_RE = re.compile(r"key:\s*'([a-z0-9-]+)'")
DOCS_RE = re.compile(r"docs:\s*'([^']+)'")
TITLE_RE = re.compile(r"^#\s+(.+?)\s*$")
SECTION_RE = re.compile(r"^##\s+(.+?)\s*$")
META_START_RE = re.compile(r"^\*\*Метаданные файла\*\*\s*$")
META_VALUE_RE = re.compile(r"^-\s+\*\*(.+?):\*\*\s*(.*)$")
# Эмодзи и пробелы перед текстом заголовка: «🏛️ СЕМЬ ВРАТ» → «СЕМЬ ВРАТ».
LEADING_GLYPH_RE = re.compile(r"^[\u2000-\u2BFF\uFE0F\u200D\s]+")


def read_registry_entries() -> list[tuple[str, str]]:
    """Маршруты method-* из реестра: список пар (key, путь к исходнику)."""
    entries: list[tuple[str, str]] = []
    for line in REGISTRY.read_text(encoding="utf-8").splitlines():
        id_match = ID_RE.search(line)
        if not id_match:
            continue
        key_match = KEY_RE.search(line)
        docs_match = DOCS_RE.search(line)
        if not key_match or not docs_match:
            raise SystemExit(
                f"в реестре у маршрута {id_match.group(1)} нет key или docs: {line.strip()}"
            )
        entries.append((key_match.group(1), docs_match.group(1)))
    if not entries:
        raise SystemExit("в реестре не найдено ни одного маршрута method-*")
    return entries


def humanize(title: str) -> str:
    """«СЕМЬ ВРАТ» → «Семь врат»; заголовок смешанного регистра не трогаем."""
    title = LEADING_GLYPH_RE.sub("", title).strip()
    if title.isupper():
        return title[:1] + title[1:].lower()
    return title


def split_metadata(lines: list[str]) -> tuple[dict[str, str], list[str]]:
    """Отделяет блок «Метаданные файла» от читательского текста."""
    meta: dict[str, str] = {}
    rest: list[str] = []
    in_meta = False
    for line in lines:
        if not in_meta and META_START_RE.match(line):
            in_meta = True
            continue
        if in_meta:
            value_match = META_VALUE_RE.match(line)
            if value_match:
                meta.setdefault(value_match.group(1).strip(), value_match.group(2).strip())
                continue
            if line.strip():
                continue  # служебные строки без пары «**Ключ:**» читателю не нужны
            in_meta = False  # пустая строка закрывает блок
            continue
        rest.append(line)
    return meta, rest


def strip_separators(lines: list[str]) -> str:
    """Убирает пустые `---`-разделители по краям фрагмента."""
    kept = list(lines)
    while kept and (not kept[0].strip() or kept[0].strip() == "---"):
        kept.pop(0)
    while kept and (not kept[-1].strip() or kept[-1].strip() == "---"):
        kept.pop()
    return "\n".join(kept).strip()


def build_sections(lines: list[str]) -> list[dict[str, str]]:
    """H2 → секции; вводный текст до первого H2 приклеивается к первой секции."""
    raw: list[tuple[str, list[str]]] = []
    current = ""
    buffer: list[str] = []
    for line in lines:
        heading = SECTION_RE.match(line)
        if heading:
            raw.append((current, buffer))
            current = humanize(heading.group(1))
            buffer = []
        else:
            buffer.append(line)
    raw.append((current, buffer))

    sections: list[dict[str, str]] = []
    preamble = ""
    for title, chunk in raw:
        text = strip_separators(chunk)
        if not title:
            preamble = text
            continue
        if preamble:
            text = (preamble + "\n\n" + text).strip()
            preamble = ""
        sections.append({"title": title, "content": text})
    if preamble:
        if sections:
            sections[0]["content"] = (preamble + "\n\n" + sections[0]["content"]).strip()
        else:
            sections.append({"title": "Текст документа", "content": preamble})
    return sections


def build_document(key: str, docs_path: str) -> dict[str, object]:
    source = ROOT / docs_path
    if not source.exists():
        raise SystemExit(f"исходник методички не найден: {docs_path}")
    lines = source.read_text(encoding="utf-8").splitlines()

    title = ""
    body: list[str] = []
    for index, line in enumerate(lines):
        match = TITLE_RE.match(line)
        if match and not title:
            title = humanize(match.group(1))
            body = lines[index + 1:]
            break
    if not title:
        raise SystemExit(f"в {docs_path} нет заголовка первого уровня")

    meta, rest = split_metadata(body)
    return {
        "title": title,
        "description": meta.get("Тема", ""),
        "source": docs_path,
        "sections": build_sections(rest),
    }


def build_corpus() -> dict[str, object]:
    corpus: dict[str, object] = {}
    for key, docs_path in read_registry_entries():
        if key in corpus:
            raise SystemExit(f"дубль key в реестре: {key}")
        corpus[key] = build_document(key, docs_path)
    return corpus


def dump(document: dict[str, object]) -> str:
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def targets(rel: Path) -> list[Path]:
    return [LAB / rel, BUILD / rel]


def build_files() -> dict[Path, str]:
    """index.json — заголовки и описания, documents/<key>.json — тела.

    Корпус методичек весит больше полумегабайта, а хабу нужны только заголовки,
    поэтому указатель и тела лежат раздельно: список карточек грузится лёгким
    index.json, страница документа — одним файлом по ключу.
    """
    corpus = build_corpus()
    index = {
        key: {
            "title": document["title"],
            "description": document["description"],
            "source": document["source"],
            "file": f"{DOCS_DIR_REL.as_posix()}/{key}.json",
        }
        for key, document in corpus.items()
    }
    files = {INDEX_REL: dump(index)}
    for key, document in corpus.items():
        files[DOCS_DIR_REL / f"{key}.json"] = dump(document)
    return files


def stale_files(files: dict[Path, str]) -> list[Path]:
    """Файлы каталога документов, которых больше нет в реестре."""
    out: list[Path] = []
    for base in (LAB, BUILD):
        directory = base / DOCS_DIR_REL
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.json")):
            if Path(DOCS_DIR_REL / path.name) not in files:
                out.append(path)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Методички docs/06-METHODOLOGY → data/ лаба")
    parser.add_argument("--check", action="store_true",
                        help="не писать файлы, а проверить совпадение с docs/")
    args = parser.parse_args()

    files = build_files()
    extra = stale_files(files)

    if args.check:
        drift = [str(target.relative_to(ROOT)) for rel, text in sorted(files.items())
                 for target in targets(rel)
                 if (target.read_text(encoding="utf-8") if target.exists() else "") != text]
        drift += [str(path.relative_to(ROOT)) for path in extra]
        if drift:
            print("РАСХОЖДЕНИЕ с docs/06-METHODOLOGY: " + ", ".join(drift))
            print("запусти: python tools/generate-methodology-docs.py")
            return 1
        print(f"методички в data/ совпадают с docs/: {len(files) - 1} документов + index")
        return 0

    for rel, text in sorted(files.items()):
        for target in targets(rel):
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8", newline="\n")
            print("записано: " + str(target.relative_to(ROOT)))
    for path in extra:
        path.unlink()
        print("удалён устаревший: " + str(path.relative_to(ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

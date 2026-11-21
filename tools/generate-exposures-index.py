#!/usr/bin/env python3
"""Каталог кейсов: метаданные в index.json, тело каждого дела — в cases/<slug>.json.

Зачем: index.json содержал тела всех 206 кейсов (2,8 МБ), и каталог «Исследования»
груз их целиком ради списка. Теперь:
  data/exposures/index.json        — метаданные списка (~300 КБ, с completeness);
  data/exposures/cases/<slug>.json — одно дело целиком (~13 КБ), грузится при открытии.

`--split` — разовая миграция из старого полного index.json (тела выносятся в cases).
Обычный запуск собирает index.json из cases. `--check` — CI-гейт: index совпадает
с cases, ни одного дела не потеряно.

Запуск:
  python tools/generate-exposures-index.py --split   # один раз: полный index → cases
  python tools/generate-exposures-index.py           # пересобрать index из cases
  python tools/generate-exposures-index.py --check   # гейт
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
INDEX_REL = Path("data") / "exposures" / "index.json"
CASES_REL = Path("data") / "exposures" / "cases"
FEED_REL = Path("data") / "exposures" / "feed.json"
SLUG_RE = re.compile(r"^[a-z0-9_-]+$")

# Правило полноты — копия supportFields из dashboard.js.
SUPPORT_FIELDS = (
    ("thesis", "тезис"),
    ("original", "исходный контур"),
    ("shift", "сдвиг"),
    ("transmissionChain", "цепочка передачи"),
    ("sources", "источники"),
    ("roots", "корни"),
    ("evidence", "свидетельства"),
    ("reconstruction", "реконструкция"),
)
SEARCH_TEXT_LIMIT = 500


def sort_cases(cases: list[dict]) -> list[dict]:
    """Единый порядок для split и пересборки: свежие сверху, затем slug."""
    return sorted(cases, key=lambda item: (str(item.get("updatedAt") or ""), slug_of(item)), reverse=True)


def slug_of(item: dict) -> str:
    slug = str(item.get("slug") or item.get("id") or "").strip()
    if not SLUG_RE.match(slug):
        raise SystemExit(f"недопустимый slug: {slug!r}")
    return slug


def has_support(item: dict, key: str) -> bool:
    value = item.get(key) if key in ("sources", "roots") else (item.get("sections") or {}).get(key)
    if isinstance(value, list):
        return len(value) > 0
    return bool(value and str(value).strip())


def completeness(item: dict) -> dict:
    missing = [label for key, label in SUPPORT_FIELDS if not has_support(item, key)]
    total = len(SUPPORT_FIELDS)
    complete = total - len(missing)
    return {"percent": round(complete / total * 100), "complete": complete,
            "total": total, "missing": missing}


def search_text(item: dict) -> str:
    """Текст для фильтра каталога: без тел, но с тезисом, сдвигом и заголовками."""
    sections = item.get("sections") or {}
    parts = [item.get("title"), item.get("summary"), item.get("category"),
             " ".join(item.get("tags") or []), sections.get("thesis"), sections.get("shift")]
    for block in sections.get("content") or []:
        if isinstance(block, dict):
            parts.append(block.get("heading"))
    text = " ".join(str(part) for part in parts if part)
    return re.sub(r"\s+", " ", text).strip()[:SEARCH_TEXT_LIMIT]


def metadata_entry(item: dict) -> dict:
    return {
        "id": item.get("id", ""),
        "slug": slug_of(item),
        "title": item.get("title", ""),
        "summary": item.get("summary", ""),
        "category": item.get("category", ""),
        "tags": item.get("tags") or [],
        "confidence": item.get("confidence", ""),
        "status": item.get("status", ""),
        "period": item.get("period", ""),
        "date": item.get("date", ""),
        "createdAt": item.get("createdAt", ""),
        "updatedAt": item.get("updatedAt", ""),
        "changelog": item.get("changelog") or [],
        "sourcesCount": len(item.get("sources") or []),
        "rootsCount": len(item.get("roots") or []),
        "searchText": search_text(item),
        "completeness": completeness(item),
    }


def render_metadata(cases: list[dict]) -> str:
    entries = [json.dumps(metadata_entry(item), ensure_ascii=False, separators=(",", ":"))
               for item in cases]
    return "[\n" + ",\n".join(entries) + "\n]\n"


def render_case(item: dict) -> str:
    return json.dumps(item, ensure_ascii=False, indent=2) + "\n"


def read_json(path: Path):
    if not path.is_file():
        raise SystemExit(f"нет файла: {path.relative_to(ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))


def read_cases() -> list[dict]:
    directory = LAB / CASES_REL
    if not directory.is_dir():
        raise SystemExit("нет каталога cases — сначала запусти --split")
    cases = []
    for path in sorted(directory.glob("*.json")):
        item = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(item, dict):
            raise SystemExit(f"{path.name}: дело должно быть объектом")
        cases.append(item)
    if not cases:
        raise SystemExit("каталог cases пуст")
    return cases


def targets(rel: Path) -> list[Path]:
    return [LAB / rel, BUILD / rel]


def write(rel: Path, text: str) -> None:
    for path in targets(rel):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")


def split() -> int:
    """Разовая миграция: полный index.json → cases/*.json + метаданные index.json."""
    index_path = LAB / INDEX_REL
    cases = read_json(index_path)
    if not isinstance(cases, list):
        raise SystemExit("index.json должен быть массивом")
    cases = sort_cases(cases)
    slugs = set()
    for item in cases:
        slug = slug_of(item)
        if slug in slugs:
            raise SystemExit(f"дубль slug: {slug}")
        slugs.add(slug)
        write(CASES_REL / f"{slug}.json", render_case(item))
    write(INDEX_REL, render_metadata(cases))
    for path in targets(FEED_REL):
        if path.is_file():
            path.unlink()
            print("удалён: " + str(path.relative_to(ROOT)))
    print(f"разделено: {len(cases)} дел → cases/, index.json — метаданные")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Каталог кейсов: index + cases")
    parser.add_argument("--split", action="store_true", help="разовая миграция полного index.json")
    parser.add_argument("--check", action="store_true", help="проверить соответствие index и cases")
    args = parser.parse_args()

    if args.split:
        return split()

    cases = sort_cases(read_cases())
    text = render_metadata(cases)
    index_paths = targets(INDEX_REL)

    if args.check:
        problems = []
        for path in index_paths:
            if not path.is_file():
                problems.append(f"нет {path.relative_to(ROOT)}")
            elif path.read_text(encoding="utf-8") != text:
                problems.append(f"index расходится с cases: {path.relative_to(ROOT)}")
        expected = {f"{slug_of(item)}.json" for item in cases}
        for directory in (LAB / CASES_REL, BUILD / CASES_REL):
            if directory.is_dir():
                for path in directory.glob("*.json"):
                    if path.name not in expected:
                        problems.append(f"лишнее дело: {path.relative_to(ROOT)}")
        if problems:
            print("РАСХОЖДЕНИЕ каталога кейсов:")
            for problem in problems:
                print("  - " + problem)
            print("запусти: python tools/generate-exposures-index.py")
            return 1
        print(f"каталог актуален: {len(cases)} дел, index {len(text.encode('utf-8')) // 1024} КБ")
        return 0

    write(INDEX_REL, text)
    print(f"записано: index.json — {len(cases)} дел, {len(text.encode('utf-8')) // 1024} КБ")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Метаданные кейсов разоблачений для ленты: data/exposures/feed.json.

Зачем: `index.json` содержит тела всех 206 кейсов (2,8 МБ). Dashboard, клуб и
карта языков берут из него только заголовки, категории, даты и «полноту» —
грузить 2,8 МБ ради списка незачем. Feed повторяет нужные поля и заранее
считает полноту тем же правилом, что dashboard.js, поэтому виджеты не меняются.

Полный индекс остаётся для страницы «Исследования» до фазы B перф-плана.

Запуск:
  python tools/generate-exposures-feed.py           # перегенерировать
  python tools/generate-exposures-feed.py --check   # гейт: feed совпадает с index
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "products" / "website" / "apps" / "researchlab"
BUILD = ROOT / "products" / "website" / "build" / "apps" / "researchlab"
INDEX_REL = Path("data") / "exposures" / "index.json"
FEED_REL = Path("data") / "exposures" / "feed.json"

# Правило полноты — копия supportFields из dashboard.js (calculateCompletenessMap).
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


def has_support(item: dict, key: str) -> bool:
    value = item.get(key) if key in ("sources", "roots") else (item.get("sections") or {}).get(key)
    if isinstance(value, list):
        return len(value) > 0
    return bool(value and str(value).strip())


def completeness(item: dict) -> dict:
    missing = [label for key, label in SUPPORT_FIELDS if not has_support(item, key)]
    total = len(SUPPORT_FIELDS)
    complete = total - len(missing)
    return {
        "percent": round(complete / total * 100),
        "complete": complete,
        "total": total,
        "missing": missing,
    }


def feed_entry(item: dict) -> dict:
    return {
        "id": item.get("id", ""),
        "slug": item.get("slug", ""),
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
        "completeness": completeness(item),
    }


def render(cases: list[dict]) -> str:
    """По одному кейсу на строку: diff читается, файл не пухнет от отступов."""
    entries = [json.dumps(feed_entry(item), ensure_ascii=False, separators=(",", ":")) for item in cases]
    return "[\n" + ",\n".join(entries) + "\n]\n"


def read_cases() -> list[dict]:
    source = LAB / INDEX_REL
    if not source.is_file():
        raise SystemExit(f"нет исходника: {source.relative_to(ROOT)}")
    data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("index.json должен быть массивом кейсов")
    return data


def targets(rel: Path) -> list[Path]:
    return [LAB / rel, BUILD / rel]


def main() -> int:
    parser = argparse.ArgumentParser(description="Feed метаданных кейсов для ленты")
    parser.add_argument("--check", action="store_true", help="не писать, проверить совпадение с index.json")
    args = parser.parse_args()

    text = render(read_cases())
    if args.check:
        problems = [str(path.relative_to(ROOT)) for path in targets(FEED_REL)
                    if not path.is_file() or path.read_text(encoding="utf-8") != text]
        if problems:
            print("РАСХОЖДЕНИЕ feed с index.json: " + ", ".join(problems))
            print("запусти: python tools/generate-exposures-feed.py")
            return 1
        print(f"feed актуален: {len(read_cases())} кейсов, {len(text.encode('utf-8')) // 1024} КБ")
        return 0

    for path in targets(FEED_REL):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        print("записано: " + str(path.relative_to(ROOT)))
    print(f"кейсов: {len(read_cases())}, feed: {len(text.encode('utf-8')) // 1024} КБ")
    return 0


if __name__ == "__main__":
    sys.exit(main())

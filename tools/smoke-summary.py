#!/usr/bin/env python3
"""Сводка падений Playwright из test-results/smoke.json.

Зачем: workflow smoke падал пять раз подряд, а причина была невидима —
в логе только «Process completed with exit code 1». Этот скрипт печатает
имена упавших тестов и первую строку ошибки; в CI вывод попадает в
$GITHUB_STEP_SUMMARY (шаг smoke.yml), локально — просто в консоль.

Запуск:
  python tools/smoke-summary.py            # читает test-results/smoke.json
  python tools/smoke-summary.py --path X   # другой файл отчёта
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "products" / "website" / "apps" / "researchlab" / "test-results" / "smoke.json"
MAX_ITEMS = 30


def failed_tests(node, found=None):
    """Рекурсивно собирает объекты тестов со статусом unexpected."""
    if found is None:
        found = []
    if isinstance(node, dict):
        if node.get("status") == "unexpected" and node.get("title"):
            found.append(node)
        for value in node.values():
            failed_tests(value, found)
    elif isinstance(node, list):
        for value in node:
            failed_tests(value, found)
    return found


def error_message(test) -> str:
    results = test.get("results") or []
    if not results:
        return ""
    error = results[-1].get("error") or {}
    message = str(error.get("message") or error.get("stack") or "")
    for line in message.splitlines():
        line = line.strip()
        if line:
            return line[:300]
    return ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Сводка падений smoke-прогона")
    parser.add_argument("--path", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    if not args.path.is_file():
        print("smoke.json не найден: прогон не дошёл до отчёта. Смотри консоль шага.")
        return 0

    data = json.loads(args.path.read_text(encoding="utf-8-sig"))
    tests = failed_tests(data)
    if not tests:
        print("Падений нет: все тесты прошли.")
        return 0

    print(f"Упало тестов: {len(tests)}")
    print()
    print("| # | Тест | Ошибка |")
    print("| --- | --- | --- |")
    for index, test in enumerate(tests[:MAX_ITEMS], start=1):
        title = str(test.get("title") or "").replace("|", "\\|")
        error = error_message(test).replace("|", "\\|")
        print(f"| {index} | {title} | {error} |")
    if len(tests) > MAX_ITEMS:
        print(f"\n… и ещё {len(tests) - MAX_ITEMS}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

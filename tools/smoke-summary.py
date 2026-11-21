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


def failed_tests(data) -> list[dict[str, str]]:
    """Упавшие тесты с заголовком spec'а.

    В отчёте Playwright у объекта теста `title` пустой: человекочитаемое имя
    живёт на уровне spec (`specs[].title`). Поэтому имя тянем из контекста,
    иначе сводка печатает «Падений нет» при `unexpected: 2`.
    """
    found: list[dict[str, str]] = []

    def visit(spec_title: str, node) -> None:
        if isinstance(node, dict):
            if node.get("status") == "unexpected":
                found.append({
                    "title": str(node.get("title") or spec_title or "без имени"),
                    "error": error_message(node),
                })
            for key, value in node.items():
                if key == "specs" and isinstance(value, list):
                    for spec in value:
                        visit(str((spec or {}).get("title") or spec_title), spec)
                else:
                    visit(spec_title, value)
        elif isinstance(node, list):
            for value in node:
                visit(spec_title, value)

    visit("", data)
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description="Сводка падений smoke-прогона")
    parser.add_argument("--path", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    if not args.path.is_file():
        print("smoke.json не найден: прогон не дошёл до отчёта. Смотри консоль шага.")
        return 0

    data = json.loads(args.path.read_text(encoding="utf-8-sig"))
    tests = failed_tests(data)
    stats = data.get("stats") or {}
    summary = "expected=%s flaky=%s unexpected=%s" % (
        stats.get("expected"), stats.get("flaky"), stats.get("unexpected"))
    if not tests:
        print("Падений нет: все тесты прошли." + (f" Флаки: {stats.get('flaky')}." if stats.get("flaky") else ""))
        print(f"\nstats: {summary}")
        return 0

    print(f"Упало тестов: {len(tests)}")
    print(f"stats: {summary}")
    print()
    print("| # | Тест | Ошибка |")
    print("| --- | --- | --- |")
    for index, test in enumerate(tests[:MAX_ITEMS], start=1):
        title = test["title"].replace("|", "\\|")
        error = test["error"].replace("|", "\\|")
        print(f"| {index} | {title} | {error} |")
    if len(tests) > MAX_ITEMS:
        print(f"\n… и ещё {len(tests) - MAX_ITEMS}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

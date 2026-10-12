#!/usr/bin/env python3
"""Быстрый прогон тестов агентной системы с отчётом в файл.

Запуск: python tools/run-agent-tests.py
"""
import io
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = ROOT / "products" / "agents"
sys.path.insert(0, str(AGENTS_DIR))
sys.path.insert(0, str(ROOT))

MODULES = [
    "tests.test_pipelines",
    "tests.test_context",
    "tests.test_agent_trace",
    "tests.test_server",
]


def main() -> int:
    report = io.StringIO()
    total_run = total_fail = total_err = 0
    for name in MODULES:
        buf = io.StringIO()
        try:
            suite = unittest.TestLoader().loadTestsFromName(name)
        except Exception as error:
            print(f"{name}: LOAD ERROR {error}", file=report)
            continue
        result = unittest.TextTestRunner(verbosity=1, stream=buf).run(suite)
        total_run += result.testsRun
        total_fail += len(result.failures)
        total_err += len(result.errors)
        status = "OK" if not (result.failures or result.errors) else "FAIL"
        print(f"{name}: {result.testsRun} run, {len(result.failures)} fail, {len(result.errors)} err — {status}", file=report)
        for label, items in (("FAIL", result.failures), ("ERR", result.errors)):
            for test, trace in items:
                print(f"  {label} {test}:", file=report)
                print("    " + trace.strip().replace("\n", "\n    ")[-500:], file=report)
    print(f"TOTAL: {total_run} run, {total_fail} fail, {total_err} err", file=report)
    text = report.getvalue()
    print(text)
    return 1 if (total_fail or total_err) else 0


if __name__ == "__main__":
    raise SystemExit(main())

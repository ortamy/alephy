#!/usr/bin/env python3
"""Read-only аудит дрейфа архитектуры для CI.

Тот же пайплайн `arch_keeper`, но без двух вещей: без HTTP-сервера и без права
записи. Скрипт импортирует агентов напрямую, прогоняет сканер → критик →
планировщик и печатает находки. Writer и convergence не вызываются вообще:
инструмент не должен иметь возможности изменить файл.

Зачем отдельный вход, если есть пайплайн: CI не должен поднимать Flask, а
аудит не должен быть зависимым от того, запущен ли у разработчика сервер.

Использование:
  python tools/check-architecture-drift.py            # код 1, если есть находки
  python tools/check-architecture-drift.py --warn     # всегда код 0 (отчёт в лог)
  python tools/check-architecture-drift.py --markdown # вывод для $GITHUB_STEP_SUMMARY
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS_ROOT = ROOT / "products" / "agents"

# Агенты лежат в пакете `agents`, но легаси-скрипты запускаются из tools/, где
# этого пакета нет в sys.path. Добавляем корень агентного слоя, а не repo root:
# иначе `import agents` схватит одноимённую папку tools/.
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))


def gather() -> dict:
    """Сканер → критик → планировщик. Ни одного шага с записью на диск."""
    from agents.arch_scanner import reset_cache, collect_facts
    from agents import arch_critic

    reset_cache()  # один прогон — один снимок репозитория
    metrics = (collect_facts() or {}).get("metrics") or {}

    # Те же проверки, что и в arch_critic.critique, но без record()/пакета:
    # критик читает те же четыре источника, поэтому дублирование формул
    # проверок не расходится с пайплайном. Путь паспорта берётся у самого
    # критика, а не склеивается заново: единственный источник правды.
    findings = []
    if arch_critic.ARCHITECTURE_DOC.is_file():
        text = arch_critic.ARCHITECTURE_DOC.read_text(encoding="utf-8")
        findings.extend(arch_critic.check_claims(text, metrics))
        findings.extend(arch_critic.check_paths(text))
    findings.extend(arch_critic.check_graph())
    findings.extend(arch_critic.check_routes())
    findings.extend(arch_critic.check_agent_doc(metrics))
    return {"metrics": metrics, "findings": findings}


def main() -> int:
    parser = argparse.ArgumentParser(description="Аудит дрейфа архитектуры (только чтение)")
    parser.add_argument("--warn", action="store_true",
                        help="всегда код 0: находки печатаются, но сборку не роняют")
    parser.add_argument("--markdown", action="store_true",
                        help="вывод в Markdown (для $GITHUB_STEP_SUMMARY)")
    args = parser.parse_args()

    payload = gather()
    findings = payload["findings"]

    # Корзины повторяют arch_planner: решение планировщика без его запуска.
    from agents.arch_planner import classify
    proposals = [classify(item) for item in findings]

    if args.markdown:
        print("### Аудит дрейфа архитектуры\n")
        if not proposals:
            print("Расхождений нет: паспорт, схема и документ об агентах совпадают с репозиторием.")
        else:
            print("| Корзина | Показатель | В документе | На диске |")
            print("| --- | --- | --- | --- |")
            for item in proposals:
                actual = "—" if item.get("actual") is None else item["actual"]
                print("| %s | %s | %s | %s |" % (item["basket"], item["metric"],
                                                  item["stated"], actual))
    elif not proposals:
        print("[ok] дрейф архитектуры не найден")
    else:
        print("[error] расхождений: %d" % len(proposals))
        for item in proposals:
            print("  — [%s] %s: в документе %r, на диске %r" % (
                item["basket"], item["metric"], item["stated"], item.get("actual")))

    return 0 if (args.warn or not proposals) else 1


if __name__ == "__main__":
    raise SystemExit(main())
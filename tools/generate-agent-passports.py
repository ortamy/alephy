#!/usr/bin/env python3
"""Сборка статических паспортов агентов для Research Lab.

Паспорт в лабе должен открываться без сервера (§9: у каждого fetch есть
локальный fallback). Этот генератор выгружает из самого модуля агента всё,
что можно выгрузить, — контракт, канон, задачи, метаданные модуля — в
`data/agents/<slug>.json`.

Исходный код агента сюда НЕ копируется: его отдаёт сервер
(`GET /api/agents/source`), поэтому правка Python подхватывается сама. В статику
идут только факты о модуле и его функциях.

Запуск:  python tools/generate-agent-passports.py [--check]
"""
import argparse
import ast
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
AGENTS_DIR = REPO_ROOT / "products" / "agents"
LAB_DATA = REPO_ROOT / "products" / "website" / "apps" / "researchlab" / "data" / "agents"

sys.path.insert(0, str(AGENTS_DIR))

# Паспорта строятся только для агентов, которым он нужен в UI: флаг
# `passport` в getAgentMapData() — источник истины на стороне лабы.
PASSPORTS = [
    {
        "slug": "frontend-developer",
        "module": "frontend",
        "name": "Фронтенд-разработчик",
        "title": "Фронтенд-разработчик",
        "icon": "hammer-and-chisel",
        "cat": "Разработка",
        "model": "Локальный аудит",
        "domain": "Фронтенд лаборатории: соответствие дизайн-канону",
    },
]


def module_facts(module_name: str) -> dict:
    """Метаданные модуля: путь, размер, функции, первая строка докстринга."""
    path = AGENTS_DIR / "agents" / f"{module_name}.py"
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source)
    doc = ast.get_docstring(tree) or ""

    functions = [
        {
            "name": node.name,
            "line": node.lineno,
            "doc": (ast.get_docstring(node) or "").strip().split("\n")[0],
        }
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]

    return {
        "path": f"products/agents/agents/{module_name}.py",
        "lines": source.count("\n") + 1,
        "bytes": len(source.encode("utf-8")),
        "entrypoint": f"{module_name}.prepare(data)",
        "registration": "AGENT_FUNCTIONS в server.py",
        "functions": functions,
        "doc": doc.strip(),
    }


def canon_rules(module) -> list:
    """Канон §4.1a читается из констант агента, а не дублируется здесь."""
    return [
        {"label": "Размер", "value": f"var({module.CANON_SIZE})",
         "why": "единственная ступень лейблов ячейки; свой кегль = разнобой"},
        {"label": "Вес", "value": module.CANON_WEIGHT,
         "why": "при 600 лейбл читается как обычный текст рядом с номером"},
        {"label": "Шрифт", "value": f"var({module.CANON_FAMILY})",
         "why": "сериф оставлен заголовкам страницы, не полосам ячеек"},
        {"label": "Сброс линии", "value": "border-bottom: 0",
         "why": "иначе черта наследуется от базового .module h2 и обрезается по тексту"},
        {"label": "Специфичность", "value": ".module",
         "why": "базовый .module h2:not(:last-child) сильнее одиночного класса"},
        {"label": "Трекинг", "value": f"var({module.CANON_TRACKING})",
         "why": "литерал разъедется при правке токена"},
    ]


def build(entry: dict) -> dict:
    module = __import__(f"agents.{entry['module']}", fromlist=["prepare"])
    facts = module_facts(entry["module"])

    return {
        "id": entry["slug"],
        "name": entry["name"],
        "title": entry["title"],
        "icon": entry["icon"],
        "cat": entry["cat"],
        "model": entry["model"],
        "domain": entry["domain"],
        "role": facts["doc"].split("\n\n")[0],
        "boundaries": module.contract()["boundaries"],
        "contract": module.contract(),
        "tasks": module.LAB_TASKS,
        "canon": {
            "reference": "DESIGN-SYSTEM §4.1a",
            # Путь относительно репозитория: абсолютный путь к машине автора
            # в интерфейсе бессмысленен и обрезается в узкой ячейке.
            "scope": str(module.LAB_CSS_DIR.relative_to(REPO_ROOT)).replace("\\", "/"),
            "rules": canon_rules(module),
        },
        "module": facts,
    }


def render(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="только проверить, без записи")
    args = parser.parse_args()

    LAB_DATA.mkdir(parents=True, exist_ok=True)
    stale = []

    for entry in PASSPORTS:
        payload = build(entry)
        target = LAB_DATA / f"{entry['slug']}.json"
        text = render(payload)
        current = target.read_text(encoding="utf-8") if target.exists() else ""

        if current == text:
            print(f"OK   {target.relative_to(REPO_ROOT)}")
            continue
        if args.check:
            stale.append(str(target.relative_to(REPO_ROOT)))
            print(f"FAIL {target.relative_to(REPO_ROOT)}: устарел")
            continue
        target.write_text(text, encoding="utf-8")
        print(f"записан {target.relative_to(REPO_ROOT)}")

    if stale:
        print("\nОбновите: python tools/generate-agent-passports.py")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

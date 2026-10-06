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
LAB_JS = REPO_ROOT / "products" / "website" / "apps" / "researchlab" / "js"

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

# Все роли, которые зарегистрированы в server.AGENT_FUNCTIONS. Оркестратор
# входит в реестр лабы, но не в этот список: это control-plane, а не
# исполняемый агент-процессор с `(data) -> data` контрактом, поэтому его
# паспорт собирается статически — см. build_orchestrator() ниже.
PASSPORTS += [
    {
        "slug": slug,
        "module": module,
        "name": name,
        "title": name,
        "icon": "bot",
        "cat": category,
        "model": "Локальный агент",
        "domain": domain,
    }
    for slug, module, name, category, domain in [
        ("researcher", "researcher", "Исследователь", "Исследование", "Извлечение термина, корня и локальных источников"),
        ("semitologist", "semitologist", "Семитолог", "Исследование", "Семитские параллели без подмены источников"),
        ("exposer", "exposer", "Разоблачитель", "Исследование", "Карта сдвигов и пропусков перевода"),
        ("editor", "editor", "Редактор", "Документация", "Приведение материала к стилю проекта"),
        ("collector", "collector", "Сборщик", "Оркестрация", "Единый результат линейных и циклических цепочек"),
        ("comparator", "comparator", "Компаратор", "Исследование", "Сравнение текстовых свидетелей"),
        ("critic", "critic", "Критик", "Контроль качества", "Проверка хода работы по эмет и шекер"),
        ("verifier", "verifier", "Проверяющий", "Контроль качества", "Валидация обязательных полей результата"),
        ("paleo-translator", "paleo_translator", "Переводчик палео-иврита", "Исследование", "Палео-образ и физический смысл букв"),
        ("flow-architect", "flow_architect", "Архитектор потока", "Оркестрация", "Порядок этапов исследования"),
        ("liaison", "liaison", "Связной", "Оркестрация", "Передача контекста и расширение горизонта"),
        ("technical-writer", "writer", "Технический писатель", "Документация", "Оформление исследования в Markdown"),
        ("code-reviewer", "code_reviewer", "Ревьюер кода", "Контроль качества", "Минимальный технический контроль пайплайна"),
        ("ai-engineer", "ai_engineer", "AI-инженер", "Разработка", "Подготовка задач для подключённой LLM"),
        ("arch-scanner", "arch_scanner", "Архитектурный сканер", "Архитектура", "Снимок фактов о репозитории"),
        ("arch-critic", "arch_critic", "Архитектурный критик", "Архитектура", "Сверка паспорта с фактами репозитория"),
        ("arch-planner", "arch_planner", "Архитектурный планировщик", "Архитектура", "Классификация находок по корзинам решения"),
        ("arch-writer", "arch_writer", "Архитектурный писатель", "Архитектура", "Перерисовка генерируемых блоков паспорта"),
        ("arch-convergence", "arch_convergence", "Архитектурный сход", "Архитектура", "Остановка цикла при совпадении снимка и документа"),
    ]
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

    entrypoint = next(
        (name for name in (
            "prepare", "research", "compare", "expose", "edit", "collect",
            "critique", "verify", "translate", "design", "relay", "write",
            "scan", "plan", "converge", "review",
        ) if any(fn["name"] == name for fn in functions)),
        "prepare",
    )
    return {
        "path": f"products/agents/agents/{module_name}.py",
        "lines": source.count("\n") + 1,
        "bytes": len(source.encode("utf-8")),
        "entrypoint": f"{module_name}.{entrypoint}(data)",
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


def canon_payload(module) -> dict | None:
    """Return the optional frontend canon block when a module declares it."""
    required = ("LAB_CSS_DIR", "CANON_SIZE", "CANON_WEIGHT", "CANON_FAMILY", "CANON_TRACKING")
    if not all(hasattr(module, name) for name in required):
        return None
    return {
        "reference": "DESIGN-SYSTEM §4.1a",
        "scope": str(module.LAB_CSS_DIR.relative_to(REPO_ROOT)).replace("\\", "/"),
        "rules": canon_rules(module),
    }


def build(entry: dict) -> dict:
    module = __import__(f"agents.{entry['module']}", fromlist=["prepare"])
    facts = module_facts(entry["module"])

    entrypoint = facts["entrypoint"]
    return {
        "schemaVersion": "1.0",
        "id": entry["slug"],
        "name": entry["name"],
        "title": entry["title"],
        "icon": entry["icon"],
        "cat": entry["cat"],
        "model": entry["model"],
        "domain": entry["domain"],
        "role": facts["doc"].split("\n\n")[0],
        "status": "ready",
        "capabilities": {
            "execution": True,
            "readRepository": True,
            "writesFiles": entry["module"] == "arch_writer",
            "streaming": False,
        },
        "contract": getattr(module, "contract", lambda: {
            "input": {"type": "dict", "required": ["query"], "keys": ["query", "task"]},
            "output": {"type": "dict", "required": ["trace", "agentTrace"], "keys": ["trace", "agentTrace", "result"]},
            "run": {"endpoint": "POST /api/run", "entrypoint": entrypoint, "server": "python products/agents/server.py"},
            "boundaries": [
                "принимает пакет с обязательным полем query",
                "сохраняет trace и agentTrace",
                "запись на диск разрешается только именованным пайплайнам",
            ],
        })(),
        "tasks": getattr(module, "LAB_TASKS", [{
            "id": f"run-{entry['slug']}",
            "title": f"Запустить: {entry['name']}",
            "query": entry["name"].lower(),
            "about": entry["domain"],
        }]),
        "canon": canon_payload(module),
        "module": facts,
    }


# Оркестратор — control-plane, а не агент-процессор: паспорт собирается
# статически из `products/agents/orchestrator.py` (только AST, без импорта),
# иначе генератор тянул бы за собой все пайплайны и их зависимости.
ORCHESTRATOR = {
    "slug": "orchestrator",
    "name": "Оркестратор",
    "title": "Оркестратор",
    "icon": "ui/arrows",
    "cat": "Оркестрация",
    "model": "ALEPHY",
    "domain": "Управление выполнением и распределение подзадач",
    "status": "active",
    "capabilities": {
        "execution": False,
        "readRepository": False,
        "writesFiles": False,
        "streaming": True,
    },
}

ORCHESTRATOR_CONTRACT = {
    "input": {
        "type": "dict (пакет запроса)",
        "required": ["query"],
        "query": "строка на русском: команда маршрута, например «разбери слово»",
    },
    "output": {
        "type": "dict (пакет выбранного пайплайна)",
        "keys": ["trace", "agentTrace", "result"],
        "note": "оркестратор возвращает пакет пайплайна без изменений",
    },
    "run": {
        "endpoint": "POST /api/run",
        "example": "{\"query\": \"разбери слово Берешит\"}",
        "server": "python products/agents/server.py",
    },
    "boundaries": [
        "не исполняет шаг сам: выбирает пайплайн по ключевой фразе",
        "неизвестная команда — ValueError, а не молчаливый дефолт",
        "пустой запрос — ValueError",
        "не пишет на диск: запись разрешена только именованным пайплайнам",
    ],
}


def orchestrator_source() -> str:
    return (AGENTS_DIR / "orchestrator.py").read_text(encoding="utf-8")


def orchestrator_routes() -> list:
    """Пары «фраза → пайплайн» из ROUTES: паспорт показывает, куда ведут команды."""
    tree = ast.parse(orchestrator_source())
    for node in tree.body:
        if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Dict):
            continue
        if not any(isinstance(t, ast.Name) and t.id == "ROUTES" for t in node.targets):
            continue
        return [
            (key.value, value.id[len("run_"):] if isinstance(value, ast.Name) else "pipeline")
            for key, value in zip(node.value.keys, node.value.values)
            if isinstance(key, ast.Constant) and isinstance(key.value, str)
        ]
    return []


def orchestrator_facts() -> dict:
    """Факты control-plane модуля: путь, размер, функции, докстринг."""
    source = orchestrator_source()
    tree = ast.parse(source)
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
        "path": "products/agents/orchestrator.py",
        "lines": source.count("\n") + 1,
        "bytes": len(source.encode("utf-8")),
        "entrypoint": "orchestrator.dispatch(query)",
        "registration": "server.py → orchestrator.dispatch",
        "functions": functions,
        "doc": (ast.get_docstring(tree) or "").strip(),
    }


def orchestrator_tasks() -> list:
    """По одной задаче на пайплайн: первая фраза маршрута подставляется в ЗАПУСК."""
    first = {}
    for phrase, pipeline in orchestrator_routes():
        first.setdefault(pipeline, phrase)
    return [
        {
            "id": f"route-{pipeline}",
            "title": phrase,
            "query": phrase,
            "about": f"Маршрут в пайплайн {pipeline}",
        }
        for pipeline, phrase in first.items()
    ]


def build_orchestrator() -> dict:
    facts = orchestrator_facts()
    return {
        "schemaVersion": "1.0",
        "id": ORCHESTRATOR["slug"],
        "name": ORCHESTRATOR["name"],
        "title": ORCHESTRATOR["title"],
        "icon": ORCHESTRATOR["icon"],
        "cat": ORCHESTRATOR["cat"],
        "model": ORCHESTRATOR["model"],
        "domain": ORCHESTRATOR["domain"],
        "role": facts["doc"].split("\n\n")[0],
        "status": ORCHESTRATOR["status"],
        "capabilities": ORCHESTRATOR["capabilities"],
        "contract": ORCHESTRATOR_CONTRACT,
        "tasks": orchestrator_tasks(),
        "canon": None,
        "module": facts,
    }


def render(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def render_manifest(payloads: list[dict]) -> str:
    """Build the synchronous UI registry from the same passport payloads."""
    entries = [{
        key: payload[key]
        for key in ("id", "name", "title", "cat", "model", "domain", "status", "capabilities")
    } for payload in payloads]
    return "window.AgentPassportManifest = " + json.dumps(
        {"schemaVersion": "1.0", "agents": entries},
        ensure_ascii=False,
        indent=2,
    ) + ";\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="только проверить, без записи")
    args = parser.parse_args()

    LAB_DATA.mkdir(parents=True, exist_ok=True)
    LAB_JS.mkdir(parents=True, exist_ok=True)
    stale = []
    # Оркестратор идёт первым: он стоит первым и в реестре агентов лабы.
    payloads = [build_orchestrator()]
    payloads += [build(entry) for entry in PASSPORTS]

    for payload in payloads:
        target = LAB_DATA / f"{payload['id']}.json"
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

    manifest_target = LAB_JS / "agent-passport-manifest.js"
    manifest_text = render_manifest(payloads)
    manifest_current = manifest_target.read_text(encoding="utf-8") if manifest_target.exists() else ""
    if manifest_current == manifest_text:
        print(f"OK   {manifest_target.relative_to(REPO_ROOT)}")
    elif args.check:
        stale.append(str(manifest_target.relative_to(REPO_ROOT)))
        print(f"FAIL {manifest_target.relative_to(REPO_ROOT)}: устарел")
    else:
        manifest_target.write_text(manifest_text, encoding="utf-8")
        print(f"записан {manifest_target.relative_to(REPO_ROOT)}")

    if stale:
        print("\nОбновите: python tools/generate-agent-passports.py")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

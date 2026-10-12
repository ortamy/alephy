"""Общие контракты для простых, тестируемых агентов."""
from copy import deepcopy
from typing import Any, Dict, Optional


def packet(query: str, **values: Any) -> Dict[str, Any]:
    result = {"query": query, "trace": [], "agentTrace": []}
    result.update(values)
    return result


def record(data: Dict[str, Any], agent: str, **values: Any) -> Dict[str, Any]:
    input_data = {key: value for key, value in data.items() if key not in ("trace", "agentTrace", "result")}
    data.update(values)
    data.setdefault("trace", []).append(agent)
    data.setdefault("agentTrace", []).append({
        "agentId": agent,
        "iteration": data.get("iteration", 0),  # номер витка: 0 — линейная цепочка, 1..N — цикл
        "status": "done",
        "input": deepcopy(input_data),
        "observations": [{"field": key, "value": deepcopy(value)} for key, value in values.items()],
        "decisions": [],
        "hypotheses": [],
        "limitations": [],
        "output": deepcopy(values),
    })
    return data


def parse_agent_contract(doc: str) -> Dict[str, Any]:
    """Извлекает расширенный паспортный контракт из docstring агента.

    Формат (YAML-like, после первой строки-заголовка):

        identity: <роль>
        mission: <цель>

        workflows:
          - <шаг>

        deliverables:
          - <артефакт>

        success_metrics:
          - <метрика>

        format_contracts:
          - <поле>: <описание>
    """
    contract: Dict[str, Any] = {
        "input": {"type": "dict", "required": ["query"], "keys": ["query", "task"]},
        "output": {"type": "dict", "required": ["trace", "agentTrace"], "keys": ["trace", "agentTrace", "result"]},
        "run": {"endpoint": "POST /api/run", "entrypoint": None, "server": "python products/agents/server.py"},
        "boundaries": [
            "принимает пакет с обязательным полем query",
            "сохраняет trace и agentTrace",
            "запись на диск разрешается только именованным пайплайнам",
        ],
    }
    section: Optional[str] = None
    for line in doc.split("\n")[1:]:
        stripped = line.strip()
        if not stripped:
            continue
        if not line.startswith((" ", "\t", "-")) and ":" in stripped:
            key, _, val = stripped.partition(":")
            key = key.strip()
            if key in ("identity", "mission"):
                contract[key] = val.strip()
            elif key in ("workflows", "deliverables", "success_metrics", "format_contracts"):
                section = key
                contract[key] = []
            else:
                section = None
        elif section and stripped.startswith(("- ", "-")):
            contract[section].append(stripped.lstrip("- ").strip())
    return contract

def agent_contract(agent_id: str, entrypoint: str, *, writes_files: bool = False) -> Dict[str, Any]:
    """Паспорт агента: единый контракт обмена плюс человекочитаемая часть.

    Domain agents keep their existing payload fields; this metadata makes the
    execution boundary explicit without forcing every module to duplicate the
    same boilerplate contract function.

    Расширенная часть — модель The Agency: личность, миссия, рабочие процессы,
    доставляемые артефакты, метрики успеха и контракт формата вывода. Заполняется
    из docstring агента (`parse_agent_contract`), чтобы и человек, и LLM понимали,
    что агент делает и как отчитываться. По умолчанию поля пустые.
    """
    return {
        "version": "1.0",
        "agentId": agent_id,
        # ─── Человекочитаемый паспорт (заполняется из docstring агента) ───
        "identity": "",
        "mission": "",
        "workflows": [],
        "deliverables": [],
        "success_metrics": [],
        "format_contracts": [],
        # ─── Машинный контракт обмена ───
        "input": {
            "type": "dict",
            "required": ["query"],
            "keys": ["query", "task"],
        },
        "output": {
            "type": "dict",
            "required": ["trace", "agentTrace"],
            "keys": ["trace", "agentTrace", "result"],
        },
        "capabilities": {
            "execution": True,
            "readRepository": True,
            "writesFiles": writes_files,
            "streaming": False,
        },
        "run": {
            "endpoint": "POST /api/run",
            "entrypoint": entrypoint,
            "server": "python products/agents/server.py",
        },
        "boundaries": [
            "принимает пакет с обязательным полем query",
            "сохраняет trace и agentTrace",
            "запись на диск разрешается только именованным пайплайнам",
        ],
    }

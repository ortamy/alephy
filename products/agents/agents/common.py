"""Общие контракты для простых, тестируемых агентов."""
from copy import deepcopy
from typing import Any, Dict


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


def agent_contract(agent_id: str, entrypoint: str, *, writes_files: bool = False) -> Dict[str, Any]:
    """Return the shared passport contract for every executable agent.

    Domain agents keep their existing payload fields; this metadata makes the
    execution boundary explicit without forcing every module to duplicate the
    same boilerplate contract function.
    """
    return {
        "version": "1.0",
        "agentId": agent_id,
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

"""Сборщик: формирует единый результат пайплайна, включая сходимость циклов."""
from .common import record


def collect(data):
    # `summary` — явный заголовок результата: пайплайн, который знает свой
    # итог (например, аудит с посчитанным числом расхождений), не должен
    # подменять его текстом критика или заглушкой.
    summary = data.get("summary") or data.get("critique") or data.get("editorial_note", "Материал собран.")
    result = {
        "title": f"Исследование: {data.get('term', data['query'])}",
        "summary": summary,
        "trace": data.get("trace", []),
        "data": {key: value for key, value in data.items() if key not in ("result", "trace", "agentTrace")},
    }
    if data.get("convergence_history"):
        result["iterations"] = data["convergence_history"]
        last = result["iterations"][-1]
        result["converged"] = bool(last.get("converged"))
        result["stalled"] = bool(last.get("stalled"))
    if data.get("gaps") is not None:
        result["gaps"] = data["gaps"]
    if data.get("shmita_resets"):
        result["shmita_resets"] = data["shmita_resets"]
    return record(data, "collector", result=result)

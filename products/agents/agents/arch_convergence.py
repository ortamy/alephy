"""Сходимость архитектурного цикла: когда документ догнал репозиторий.

Ключ подписи — пара «снимок репозитория + текст, который получился бы после
записи». Пока эта пара не меняется между витками, доводить нечего: виток
завершается как сходящийся. Если же файлы продолжают меняться под нашими
ногами, цикл честно помечается как несошедшийся — ждать дальше бессмысленно.
"""
import hashlib
import json
from typing import Any, Dict

from .common import record


def _signature(data) -> str:
    payload = {
        "facts": data.get("arch_digest"),
        "doc": data.get("arch_doc_digest"),
        "drift": [item.get("block") + ":" + item.get("state")
                  for item in (data.get("arch_drift") or [])],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def converge(data):
    """Шаг сходимости пайплайна `arch_keeper`."""
    history = data.get("convergence_history") or []
    signature = _signature(data)
    previous: Dict[str, Any] = history[-1] if history else {}
    drift = data.get("arch_drift") or []
    pending = [item for item in drift if item.get("state") != "current"]

    # Первый виток не может быть сходящимся: сверять не с чем.
    converged = bool(previous) and previous.get("_signature") == signature
    stable_facts = bool(previous) and previous.get("facts_digest") == data.get("arch_digest")

    if not previous:
        status, note = "поток", "Первый виток: снимок снят, дрейф посчитан."
    elif converged:
        status, note = "эмет", "Документ догнал репозиторий; новых расхождений нет."
    elif stable_facts:
        status, note = "Мавет", "Репозиторий не меняется, а блоки расходятся: нужен ручной разбор."
    else:
        status, note = "поток", "Факты изменились на диске во время цикла: нужен новый виток."

    return record(data, "arch_convergence", convergence={
        "iteration": data.get("iteration", 1),
        "converged": converged,
        "stalled": False,
        "pending_blocks": [item.get("block") for item in pending],
        "status": status,
        "notes": note,
        "facts_digest": data.get("arch_digest"),
        "_signature": signature,
    }, converged=converged)
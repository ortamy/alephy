"""Пайплайн: Аудит реестров.

Цепочка: Архитектурный сканер → Проверяющий → Сборщик.

Сканер снимает факты с диска, проверяющий подтверждает, что снимок есть,
сборщик отдаёт отчёт. Заголовок считается по снимку: сколько расхождений
реестров (карточка без раннера, раннер без карточки, пайплайн без карточки)
видно сегодня — это факт диска, а не оценка.

Отличие от `arch_keeper`: тот сверяет документ архитектуры и по явному
разрешению его правит; здесь ничего не пишется и документ не затрагивается.
"""
from agents.common import packet
from agents.arch_scanner import reset_cache, scan
from agents.verifier import verify
from agents.collector import collect
from pipelines.core import run_steps

DRIFT_LABELS = {
    "missing_runner": "карточка без раннера",
    "missing_card": "раннер без карточки",
    "uncarded": "пайплайн без карточки",
}


def headline(data):
    """Заголовок результата по снимку диска: расхождения реестров и их вид."""
    drift = (data.get("arch_summary") or {}).get("drift") or {}
    counts = [(name, len(items or [])) for name, items in drift.items()]
    total = sum(value for _, value in counts)
    if not total:
        return "Реестры агентного слоя совпадают с диском: расхождений нет."
    details = "; ".join("%s — %d" % (DRIFT_LABELS.get(name, name), value)
                        for name, value in counts if value)
    return "Расхождений реестров: %d (%s)." % (total, details)


def run(query):
    reset_cache()  # один прогон — один снимок диска
    data = packet(query)
    data["verify_targets"] = ["query", "arch_summary"]
    data = run_steps(data, (scan, verify))
    data["summary"] = headline(data)
    return collect(data)

"""Пайплайн: Совет свидетелей (веер).

Три независимых прохода по одному вопросу — текстовые свидетели (компаратор),
палео-образ (переводчик) и карта подмен (разоблачитель) — затем общее сведение:
проверяющий, критик и сборщик читают улики всех веток сразу.

Ветки не делят состояние: каждая идёт по своей копии пакета, а сведение
показывает, какая ветка что принесла (`branches` в результате). Пустая ветка
не глушит остальные — это видно в той же сводке.
"""
from agents.common import packet
from agents.researcher import research
from agents.comparator import compare as compare_witnesses
from agents.paleo_translator import translate
from agents.exposer import expose
from agents.verifier import verify
from agents.critic import critique
from agents.collector import collect
from pipelines.core import run_fanout

# Порядок веток = порядок приоритета при совпадении полей: свидетели, образ,
# подмены — каждая ветка начинает с собственного поиска корня.
BRANCHES = (
    ("свидетели", (research, compare_witnesses)),
    ("палео-образ", (research, translate)),
    ("подмены", (research, expose)),
)


def run(query):
    data = packet(query, term=query.strip())
    data["verify_targets"] = ["query", "witnesses", "paleo_image", "exposures"]
    return run_fanout(data, branches=BRANCHES, join=(verify, critique, collect))

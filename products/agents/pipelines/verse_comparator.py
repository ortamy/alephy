"""Пайплайн: Компаратор → Критик → Редактор → Сборщик."""
from agents.common import packet
from agents.comparator import compare
from agents.critic import critique
from agents.editor import edit
from agents.collector import collect
from pipelines.core import run_steps


def run(query):
    data = packet(query)
    return run_steps(data, (compare, critique, edit, collect))


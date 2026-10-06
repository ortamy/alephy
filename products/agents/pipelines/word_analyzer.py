"""Пайплайн: Исследователь → Семитолог → Разоблачитель → Редактор → Сборщик."""
from agents.common import packet
from agents.researcher import research
from agents.semitologist import compare as semitic_compare
from agents.exposer import expose
from agents.editor import edit
from agents.collector import collect
from pipelines.core import run_steps


def run(query):
    data = packet(query)
    return run_steps(data, (research, semitic_compare, expose, edit, collect))


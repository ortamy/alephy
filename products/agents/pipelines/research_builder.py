"""Пайплайн: Архитектор потока → Связной → Технический писатель → Сборщик."""
from agents.common import packet
from agents.flow_architect import design
from agents.liaison import relay
from agents.writer import write
from agents.collector import collect
from pipelines.core import run_steps


def run(query):
    data = packet(query)
    return run_steps(data, (design, relay, write, collect))


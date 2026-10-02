"""Пайплайн: Смотритель архитектуры (цикл).

Виток: Сканер → Критик → Планировщик → Писатель → [Сход].
Остановка: снимок репозитория и целевой текст документа совпали с предыдущим
витком — доводить больше нечего («Шаббат»).

Критик сверяет ручной текст паспорта с фактами (числа и пути), планировщик
раскладывает находки в корзины `auto` / `adr` / `manual`. Ни критик, ни
планировщик не пишут в документ: предложения остаются предложениями.

Запись по умолчанию выключена (`arch_write` не задан) — пайплайн работает как
аудит дрейфа и только показывает, что именно разошлось с диском.
"""
from agents.arch_scanner import reset_cache, scan
from agents.arch_critic import critique
from agents.arch_planner import plan
from agents.arch_writer import write
from agents.arch_convergence import converge
from agents.collector import collect
from agents.common import packet
from pipelines.core import run_loop

# Что имеет право забыть виток: накопленный отчёт о дрейфе и предложения —
# производные величины, на следующем витке они пересобираются с нуля.
RESET_FIELDS = ("arch_drift", "arch_blocks", "critique_findings", "proposals")


def run(query, write_enabled: bool = False):
    """`write_enabled=True` разрешает писателю трогать документ (после гейта)."""
    reset_cache()  # один прогон — один снимок диска
    data = packet(query, term=query.strip())
    data["verify_targets"] = ["query", "arch_summary", "arch_drift"]
    data["arch_write"] = bool(write_enabled)
    data = run_loop(data, cycle_steps=(scan, critique, plan, write), converge_step=converge,
                    max_iterations=3, shmita_every=2, reset_fields=RESET_FIELDS)
    return collect(data)
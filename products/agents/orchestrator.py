"""Оркестратор: маршрутизирует запрос в один из пайплайнов.

Неизвестный тип запроса — явная ошибка (ValueError), а не молчаливый
дефолт: система не должна подменять запрос исследователя.
"""
from pipelines.word_analyzer import run as run_word_analyzer
from pipelines.verse_comparator import run as run_verse_comparator
from pipelines.research_builder import run as run_research_builder
from pipelines.paleo_translation import run as run_paleo_translation
from pipelines.research_audit import run as run_research_audit
from pipelines.mechanism_scanner import run as run_mechanism_scanner
from pipelines.verse_reconstruction import run as run_verse_reconstruction
from pipelines.critique_loop import run as run_critique_loop
from pipelines.gap_cycle import run as run_gap_cycle
from pipelines.spiral_swiva import run as run_spiral_swiva
from pipelines.dialectic_loop import run as run_dialectic_loop
from pipelines.midrash_recursion import run as run_midrash_recursion
from pipelines.shmita_loop import run as run_shmita_loop
from pipelines.arch_keeper import run as run_arch_keeper
from pipelines.witness_council import run as run_witness_council
from pipelines.ui_canon import run as run_ui_canon
from pipelines.registry_audit import run as run_registry_audit


ROUTES = {
    "разбери слово": run_word_analyzer,
    "сравни стих": run_verse_comparator,
    "собери исследование": run_research_builder,
    "обратный перевод": run_paleo_translation,
    "переведи обратно": run_paleo_translation,
    "проверь отчёт": run_research_audit,
    "аудит исследования": run_research_audit,
    "сканер подмен": run_mechanism_scanner,
    "сканируй подмены": run_mechanism_scanner,
    "реконструируй стих": run_verse_reconstruction,
    "самокритика": run_critique_loop,
    "карантин пропусков": run_gap_cycle,
    "хук свива": run_spiral_swiva,
    "спираль": run_spiral_swiva,
    "диалектика": run_dialectic_loop,
    "мидраш": run_midrash_recursion,
    "шмита": run_shmita_loop,
    "проверь архитектуру": run_arch_keeper,
    "следи за архитектурой": run_arch_keeper,
    "совет свидетелей": run_witness_council,
    "три свидетеля": run_witness_council,
    "канон интерфейса": run_ui_canon,
    "аудит bento": run_ui_canon,
    "проверь чёрки": run_ui_canon,
    "аудит реестров": run_registry_audit,
    "проверь реестры": run_registry_audit,
}

PIPELINES = {
    "word_analyzer": run_word_analyzer,
    "verse_comparator": run_verse_comparator,
    "research_builder": run_research_builder,
    "paleo_translation": run_paleo_translation,
    "research_audit": run_research_audit,
    "mechanism_scanner": run_mechanism_scanner,
    "verse_reconstruction": run_verse_reconstruction,
    "critique_loop": run_critique_loop,
    "gap_cycle": run_gap_cycle,
    "spiral_swiva": run_spiral_swiva,
    "dialectic_loop": run_dialectic_loop,
    "midrash_recursion": run_midrash_recursion,
    "shmita_loop": run_shmita_loop,
    "arch_keeper": run_arch_keeper,
    "witness_council": run_witness_council,
    "ui_canon": run_ui_canon,
    "registry_audit": run_registry_audit,
}


def select_pipeline(query: str):
    normalized = query.strip().lower()
    for phrase, pipeline in ROUTES.items():
        if normalized.startswith(phrase):
            return pipeline
    raise ValueError(
        "Неизвестный тип запроса. Доступные команды: " + ", ".join(sorted(ROUTES)) + "."
    )


def dispatch(query: str):
    """Запускает выбранный пайплайн и возвращает JSON-совместимый словарь."""
    if not query or not query.strip():
        raise ValueError("Запрос не может быть пустым")
    return select_pipeline(query)(query)


def run_pipeline(pipeline_id: str, query: str):
    """Запускает цепочку по её явному идентификатору."""
    if not query or not query.strip():
        raise ValueError("Запрос не может быть пустым")
    pipeline = PIPELINES.get(pipeline_id)
    if pipeline is None:
        raise ValueError("Неизвестный пайплайн: " + pipeline_id)
    return pipeline(query)

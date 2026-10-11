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


# Единый реестр: (идентификатор, раннер, фразы голосовой команды).
# Обе публичные карты строятся из него, а не ведутся отдельно: раньше
# ROUTES и PIPELINES дублировали одни и те же функции, и добавление
# пайплайна требовало правки в двух местах. Порядок строк реестра
# задаёт порядок ROUTES — а это порядок первого совпадения в
# select_pipeline, поэтому он сохранён точно по старой карте.
REGISTRY = (
    ("word_analyzer", run_word_analyzer, ("разбери слово",)),
    ("verse_comparator", run_verse_comparator, ("сравни стих",)),
    ("research_builder", run_research_builder, ("собери исследование",)),
    ("paleo_translation", run_paleo_translation,
     ("обратный перевод", "переведи обратно")),
    ("research_audit", run_research_audit,
     ("проверь отчёт", "аудит исследования")),
    ("mechanism_scanner", run_mechanism_scanner,
     ("сканер подмен", "сканируй подмены")),
    ("verse_reconstruction", run_verse_reconstruction, ("реконструируй стих",)),
    ("critique_loop", run_critique_loop, ("самокритика",)),
    ("gap_cycle", run_gap_cycle, ("карантин пропусков",)),
    ("spiral_swiva", run_spiral_swiva, ("хук свива", "спираль")),
    ("dialectic_loop", run_dialectic_loop, ("диалектика",)),
    ("midrash_recursion", run_midrash_recursion, ("мидраш",)),
    ("shmita_loop", run_shmita_loop, ("шмита",)),
    ("arch_keeper", run_arch_keeper,
     ("проверь архитектуру", "следи за архитектурой")),
    ("witness_council", run_witness_council,
     ("совет свидетелей", "три свидетеля")),
    ("ui_canon", run_ui_canon,
     ("канон интерфейса", "аудит bento", "проверь чёрки")),
    ("registry_audit", run_registry_audit,
     ("аудит реестров", "проверь реестры")),
)

PIPELINES = {pipeline_id: runner for pipeline_id, runner, _ in REGISTRY}

ROUTES = {phrase: runner
          for _, runner, phrases in REGISTRY
          for phrase in phrases}


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

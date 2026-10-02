"""Критик паспорта архитектуры: сверяет ручной текст с фактами.

Сканер проверяет автоблоки, но ручная часть документа живёт вне маркеров, и
именно в ней копится дрейф: «127 корней» против 329 на диске, «44 CSS-файла»
против 67. Критик ловит такие расхождения по шаблону «число + существительное»
и раскладывает их по трём корзинам (§11 .clinerules: факт, интерпретация,
гипотеза). Он ничего не пишет в документ и не вызывает LLM — спорные места
он помечает как требующие человека, а не разрешает сам.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

from .arch_scanner import ARCHITECTURE_DOC, collect_facts
from .arch_writer import BLOCKS, block_body
from .common import record

# Паттерны «число + слово» в русском тексте паспорта. Порядок важен: длинные
# формы проверяются раньше коротких, иначе «файлов данных» съедается формой
# «файлов». Каждый шаблон привязан к счётчику сканера.
CLAIM_PATTERNS = (
    (re.compile(r"(\d+)\s+корн", re.IGNORECASE), "roots", "факт"),
    (re.compile(r"(\d+)\s+словар", re.IGNORECASE), "dictionaries", "факт"),
    (re.compile(r"(\d+)\s+термин", re.IGNORECASE), "terms", "факт"),
    (re.compile(r"(\d+)\s+CSS-файл\w*", re.IGNORECASE), "css", "факт"),
    (re.compile(r"(\d+)\s+JS-файл\w*", re.IGNORECASE), "js", "факт"),
    (re.compile(r"(\d+)\s+файл\w*\s+данных", re.IGNORECASE), "data", "факт"),
)


def manual_text(text: str) -> str:
    """Ручная часть документа: всё, кроме содержимого автоблоков.

    Числа внутри сгенерированных таблиц проверять нельзя — они и так правда
    по построению, и подмена «своих» чисел на «правильные» ничего не даст.
    """
    lines = text.splitlines()
    drop = set()
    for name in BLOCKS:
        opening = "<!-- alephy:auto:%s -->" % name
        closing = "<!-- alephy:auto-end:%s -->" % name
        try:
            start = lines.index(opening)
            end = lines.index(closing)
        except ValueError:
            continue
        drop.update(range(start, end + 1))
    return "\n".join(line for index, line in enumerate(lines) if index not in drop)


def check_claims(text: str, metrics: Dict[str, int]) -> List[Dict[str, Any]]:
    """Ищет числа, которые расходятся с показаниями сканера."""
    findings: List[Dict[str, Any]] = []
    body = manual_text(text)
    for pattern, metric, kind in CLAIM_PATTERNS:
        actual = metrics.get(metric)
        if actual is None:
            continue
        for match in pattern.finditer(body):
            stated = int(match.group(1))
            if stated == actual:
                continue
            findings.append({
                "kind": kind,
                "metric": metric,
                "stated": stated,
                "actual": actual,
                "evidence": match.group(0).strip(),
            })
    return findings


# Базы, относительно которых путь в документе может быть записан. Паспорт
# описывает дерево лаборатории («js/router.js») и команды из каталога сайта
# («bash tools/build.sh» из products/website) — обе формы легитимны.
PATH_BASES = ("", "products/website", "products/website/apps/researchlab")


def _resolves(candidate: str) -> bool:
    from .arch_scanner import REPO_ROOT

    for base in PATH_BASES:
        if (REPO_ROOT / base / candidate).exists():
            return True
    return False


def check_paths(text: str) -> List[Dict[str, Any]]:
    """Пути от корня репозитория, которых нет на диске.

    Проверяются только внутрирепозиторные пути (`docs/…`, `products/…`,
    `tools/…`): относительные в дереве лаборатории живут от другой базы
    (`js/module-registry.js` — это `products/website/apps/researchlab/js/…`),
    и их отсутствие от корня не значит битую ссылку.
    """
    findings: List[Dict[str, Any]] = []
    body = manual_text(text)
    seen = set()
    for match in re.finditer(r"\b((?:docs|products|tools|archive|epics|tasks)/\S+\.[A-Za-zа-яА-Я]{2,4})",
                             body):
        candidate = match.group(1).rstrip(".,;:")
        if candidate in seen:
            continue
        seen.add(candidate)
        # Шаблон, а не путь: `docs/06-METHODOLOGY/*.md` описывает класс файлов.
        if set(candidate) & set("*<>"):
            continue
        if not _resolves(candidate):
            findings.append({"kind": "факт", "metric": "path",
                             "stated": candidate, "actual": None,
                             "evidence": candidate})
    return findings


def critique(data):
    """Шаг пайплайна: сверяет ручной текст паспорта с показаниями сканера.

    В пакет идут только находки и счётчик — сам текст документа остаётся
    источником правды в файле, а не в памяти агента.
    """
    if not ARCHITECTURE_DOC.is_file():
        return record(data, "arch_critic", critique_notes=["Архитектурный паспорт не найден"],
                      critique_count=1)
    text = ARCHITECTURE_DOC.read_text(encoding="utf-8")
    metrics = collect_facts().get("metrics") or {}
    findings = check_claims(text, metrics) + check_paths(text)

    notes = []
    for item in findings:
        if item["metric"] == "path":
            notes.append("путь не найден на диске: %s" % item["stated"])
        else:
            notes.append("%s: в документе %d, на диске %d"
                         % (item["metric"], item["stated"], item["actual"]))
    return record(data, "arch_critic", critique_findings=findings,
                  critique_notes=notes, critique_count=len(notes))
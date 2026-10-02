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

from .arch_scanner import ARCHITECTURE_DOC, DOCS_DIR, LAB_ROOT, collect_facts
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
    (re.compile(r"(\d+)\s+агентами", re.IGNORECASE), "agents", "факт"),
    (re.compile(r"(\d+)\s+пайплайн\w*", re.IGNORECASE), "agent_pipelines", "факт"),
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


GRAPH_DOC = ARCHITECTURE_DOC.with_name("GRAPH.md")
REGISTRY = LAB_ROOT / "js" / "module-registry.js"

# Узел схемы в mermaid: `Name[Label<br/>path/to/file]`. Метка и путь разделены
# переводом строки — именно в этой форме схема перечисляет свои границы.
_GRAPH_NODE = re.compile(r"^\s*\w+\[([^\]]+)\]", re.MULTILINE)
_GRAPH_PATH = re.compile(r"([\w./-]+\.[a-z]{2,4})")
_GRAPH_ROUTE = re.compile(r"^-\s*`#([a-z0-9][a-z0-9/<>-]*)`", re.MULTILINE)


def parse_graph_nodes(graph: str) -> List[str]:
    """Пути из узлов mermaid-схемы.

    Узел записан как `Name[Label<br/>path/to/file]`; в метке может быть
    несколько похожих на путь строк, поэтому берётся последняя — она и
    описывает сам узел, а не его название.
    """
    found: List[str] = []
    seen = set()
    for match in _GRAPH_NODE.finditer(graph):
        paths = _GRAPH_PATH.findall(match.group(1))
        if not paths or paths[-1] in seen:
            continue
        seen.add(paths[-1])
        found.append(paths[-1])
    return found


def parse_graph_routes(graph: str) -> List[str]:
    """Корни маршрутов из раздела «Ключевые маршруты» схемы.

    `#workbench/run/<id>` хранит корень `workbench`: подмаршруты живут
    внутри модуля и в реестре не объявляются.
    """
    roots = []
    for match in _GRAPH_ROUTE.finditer(graph):
        root = match.group(1).split("/")[0]
        if root and root not in roots:
            roots.append(root)
    return roots


def check_graph() -> List[Dict[str, Any]]:
    """Узлы схемы связей, которых больше нет на диске.

    Расхождение схемы с репозиторием — не опечатка, а закрытый или
    переехавший слой, то есть архитектурное решение. Поэтому такие находки
    уходят не в корзину `auto`, а в `adr`: восстанавливать слой или выводить
    его из схемы — выбор человека, а не арифметика.
    """
    if not GRAPH_DOC.is_file():
        return []
    graph = GRAPH_DOC.read_text(encoding="utf-8")
    return [{"kind": "факт", "metric": "graph_node", "stated": path, "actual": None,
             "evidence": path}
            for path in parse_graph_nodes(graph) if not _resolves(path)]


def check_routes() -> List[Dict[str, Any]]:
    """Маршруты из раздела «Ключевые маршруты» схемы против реестра лаборатории.

    Схема перечисляет хабы, которыми пользуется пользователь; реестр — их
    единственный источник правды. Переименованный или удалённый хаб обязан
    исчезнуть из обоих, иначе читатель схемы идёт в никуда.
    """
    if not GRAPH_DOC.is_file() or not REGISTRY.is_file():
        return []
    graph = GRAPH_DOC.read_text(encoding="utf-8")
    registry = REGISTRY.read_text(encoding="utf-8")
    return [{"kind": "факт", "metric": "route", "stated": root, "actual": None,
             "evidence": "#" + root}
            for root in parse_graph_routes(graph)
            if ("id: '%s'" % root) not in registry]


AGENT_DOC = DOCS_DIR / "03-AI" / "AGENT-ARCHITECTURE.md"

# Модуль агентного слоя может лежать в корне products/agents или в одной из
# трёх подпапок; документ об агентах ссылается на них без указания папки.
AGENT_MODULES = ("agents", "pipelines", "utils", "")

_AGENT_MENTION = re.compile(r"`([a-z_][a-z0-9_]*\.py)`")


def check_agent_doc(metrics: Dict[str, int]) -> List[Dict[str, Any]]:
    """Числа и модули в `AGENT-ARCHITECTURE.md`, расходящиеся с агентным слоем.

    Документ об агентах — единственное место, где перечислены все модули
    пайплайна, и он дрейфует так же, как паспорт: модуль удалён или переименован,
    а список остался. Проверяются числа вида «N агентами» и существование
    каждого упомянутого файла; содержимое списка остаётся за человеком.
    """
    from .arch_scanner import AGENTS_ROOT

    if not AGENT_DOC.is_file():
        return []
    body = AGENT_DOC.read_text(encoding="utf-8")
    findings = check_claims(body, metrics)
    seen = set()
    for match in _AGENT_MENTION.finditer(body):
        name = match.group(1)
        if name in seen:
            continue
        seen.add(name)
        if any((AGENTS_ROOT / folder / name).is_file() for folder in AGENT_MODULES):
            continue
        findings.append({"kind": "факт", "metric": "agent_module",
                         "stated": name, "actual": None, "evidence": name})
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
    findings = (check_claims(text, metrics) + check_paths(text)
               + check_graph() + check_routes() + check_agent_doc(metrics))

    notes = []
    for item in findings:
        if item["metric"] == "path":
            notes.append("путь не найден на диске: %s" % item["stated"])
        elif item["metric"] == "graph_node":
            notes.append("узел схемы GRAPH.md не найден: %s" % item["stated"])
        elif item["metric"] == "route":
            notes.append("маршрут схемы отсутствует в реестре лаборатории: %s" % item["stated"])
        elif item["metric"] == "agent_module":
            notes.append("модуль назван в AGENT-ARCHITECTURE.md, но отсутствует: %s" % item["stated"])
        else:
            notes.append("%s: в документе %d, на диске %d"
                         % (item["metric"], item["stated"], item["actual"]))
    return record(data, "arch_critic", critique_findings=findings,
                  critique_notes=notes, critique_count=len(notes))
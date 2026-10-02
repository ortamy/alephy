"""Архитектурный сканер: снимок фактов о репозитории без интерпретаций.

Сканер не обращается к LLM и ничего не оценивает: он только читает диск и
возвращает проверяемые числа и реестры. Интерпретацией занимается критик,
правкой — писатель. Такое разделение страхует от выдуманной архитектуры:
всё, что попадёт в документ, сначала было фактом на диске.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List

from .common import record

REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS_DIR = REPO_ROOT / "docs"
AGENTS_ROOT = REPO_ROOT / "products" / "agents"
LAB_ROOT = REPO_ROOT / "products" / "website" / "apps" / "researchlab"
ARCHITECTURE_DOC = DOCS_DIR / "01-ARCHITECTURE" / "ARCHITECTURE.md"

# Производные и внешние деревья: они не описывают архитектуру исходников,
# но весят десятки тысяч файлов. Без исключения сканер упирается в бюджет.
SKIP_DIRS = {
    ".git", ".github", ".idea", ".vscode", ".claude", ".agents",
    "node_modules", "build", "archive", "__pycache__", ".playwright-mcp",
    "test-results", "playwright-report", "dist", ".venv", "venv", "coverage",
}

SOURCE_SUFFIXES = {".py", ".js", ".mjs", ".css", ".html", ".json", ".md", ".sh", ".yml", ".yaml"}
CODE_SUFFIXES = {".py", ".js", ".mjs", ".css", ".html"}

# Модули папки pipelines/, которые пайплайнами не являются: движок цепочек.
# Без этого исключения сканер объявил бы дрейфом сам факт их существования.
ENGINE_MODULES = {"core"}

# Пайплайны, которые запускаются не через orchestrator, а прямым импортом в
# server.py (агентные эндпоинты с собственной логикой). Их отсутствие в
# ROUTES — не дрейф, поэтому они собираются отдельно.
_ENDPOINT_IMPORT = re.compile(r"from\s+pipelines\.([a-z_]+)\s+import\s+([A-Za-z_][A-Za-z0-9_]*)")

ENTRYPOINTS = (
    "products/agents/server.py",
    "products/agents/main.py",
    "products/agents/orchestrator.py",
    "products/website/index.html",
    "products/website/apps/researchlab/index.html",
    "products/website/tools/build.sh",
    "tools/check-docs.py",
    "tools/check-build-sync.py",
    "tools/check-commit.py",
    "tools/generate-docs-index.py",
)
def _iter_sources(root: Path):
    """Обход исходников без входа в производные и внешние деревья."""
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            entries = list(current.iterdir())
        except OSError:
            continue
        for entry in entries:
            if entry.is_dir():
                if entry.name in SKIP_DIRS or entry.name.endswith(".egg-info"):
                    continue
                stack.append(entry)
            elif entry.suffix.lower() in SOURCE_SUFFIXES:
                yield entry


def scan_tree() -> Dict[str, Any]:
    """Считает исходники по слоям и возвращает карту слоёв."""
    layers: Dict[str, Dict[str, int]] = {}
    extensions: Dict[str, int] = {}
    total = 0
    for path in _iter_sources(REPO_ROOT):
        rel = path.relative_to(REPO_ROOT).as_posix()
        layer = rel.split("/", 1)[0] if "/" in rel else "(корень)"
        bucket = layers.setdefault(layer, {"files": 0, "code": 0})
        bucket["files"] += 1
        if path.suffix.lower() in CODE_SUFFIXES:
            bucket["code"] += 1
        suffix = path.suffix.lower().lstrip(".") or "без расширения"
        extensions[suffix] = extensions.get(suffix, 0) + 1
        total += 1
    return {
        "total_files": total,
        "layers": {name: layers[name] for name in sorted(layers)},
        "extensions": dict(sorted(extensions.items(), key=lambda item: (-item[1], item[0]))),
    }


def scan_entrypoints() -> Dict[str, bool]:
    """Какие заявленные точки входа действительно лежат в репозитории."""
    return {rel: (REPO_ROOT / rel).is_file() for rel in ENTRYPOINTS}


def _endpoint_pipelines() -> List[str]:
    """Пайплайны, импортируемые прямо в server.py мимо оркестратора."""
    server = AGENTS_ROOT / "server.py"
    if not server.is_file():
        return []
    source = server.read_text(encoding="utf-8")
    return sorted({module for module, _ in _ENDPOINT_IMPORT.findall(source)})


def scan_agents() -> Dict[str, Any]:
    """Реестры агентного слоя, разложенные по способу запуска.

    Различать способы запуска обязательно: пайплайн в карточке лаборатории,
    пайплайн-эндпоинт в server.py и движок цепочек — это три разных класса.
    Сведение их в один список даёт ложный дрейф ( агент объявил бы отсутствие
    в ROUTES проблемой для `core.py` и `scripture_analysis.py`).
    """
    modules = sorted(p.stem for p in (AGENTS_ROOT / "agents").glob("*.py")
                     if p.stem not in {"__init__"})
    pipelines = sorted(p.stem for p in (AGENTS_ROOT / "pipelines").glob("*.py")
                       if p.stem not in {"__init__"} | ENGINE_MODULES)

    cards_path = LAB_ROOT / "data" / "pipelines.json"
    cards: List[Dict[str, Any]] = []
    if cards_path.is_file():
        try:
            payload = json.loads(cards_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            payload = []
        cards = payload if isinstance(payload, list) else payload.get("pipelines", [])

    card_ids = sorted(str(card.get("id") or "") for card in cards)
    runners = sorted(str(card.get("runner") or card.get("id") or "") for card in cards)
    endpoints = _endpoint_pipelines()

    # Дрейф реестров: карточка без раннера, раннер без карточки, код без карточки.
    missing_runner = [name for name in card_ids if name not in runners]
    missing_card = [name for name in runners if name not in pipelines]
    uncarded = [name for name in pipelines if name not in runners and name not in endpoints]

    return {
        "modules": modules,
        "pipelines": pipelines,
        "cards": card_ids,
        "card_runners": runners,
        "engines": sorted(ENGINE_MODULES),
        "endpoints": endpoints,
        "drift": {
            "missing_runner": missing_runner,
            "missing_card": missing_card,
            "uncarded": uncarded,
        },
    }


def scan_git(since_days: int = 30) -> Dict[str, Any]:
    """Недавняя активность репозитория: помогает заметить незадокументированный слой."""
    try:
        raw = subprocess.run(
            ["git", "log", "--since=%ddays" % since_days, "--name-only", "--pretty=format:"],
            cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=30, check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return {"available": False, "changed_files": [], "since_days": since_days}
    if raw.returncode != 0:
        return {"available": False, "changed_files": [], "since_days": since_days}
    changed = {line.strip() for line in raw.stdout.splitlines() if line.strip()}
    return {"available": True, "changed_files": sorted(changed), "since_days": since_days}


def scan_lab_metrics() -> Dict[str, int]:
    """Счётчики корпуса Research Lab: именно их паспорт цитирует в тексте.

    Числа в документе живут вне автоблоков, поэтому критик сверяет их вручную.
    """
    metrics: Dict[str, int] = {}
    for label, folder, pattern in (
        ("css", "css", "*.css"),
        ("js", "js", "*.js"),
        ("data", "data", "*.json"),
        ("pages", "pages", "*.html"),
    ):
        target = LAB_ROOT / folder
        metrics[label] = len(list(target.rglob(pattern))) if target.is_dir() else 0
    metrics["roots"] = _json_len(LAB_ROOT / "data" / "roots" / "roots.json")
    dictionaries = _load_json(LAB_ROOT / "data" / "dictionaries.json")
    metrics["dictionaries"] = len(dictionaries) if isinstance(dictionaries, dict) else 0
    metrics["terms"] = sum(
        len(item.get("terms") or []) for item in dictionaries.values()
        if isinstance(item, dict)
    ) if isinstance(dictionaries, dict) else 0
    # Агентный слой тоже цитируется числами в документах об агентах, поэтому
    # его счётчики живут рядом с корпусными, а не в отдельном месте.
    agents = scan_agents()
    metrics["agents"] = len(agents["modules"])
    metrics["agent_pipelines"] = len(agents["pipelines"])
    return metrics


def _load_json(path: Path) -> Any:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _json_len(path: Path) -> int:
    payload = _load_json(path)
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict):
        return len(payload.get("roots") or [])
    return 0


_facts_cache: Dict[str, Any] = {}


def reset_cache() -> None:
    """Сбрасывает снимок фактов.

    Вызывается в начале прогона пайплайна: цикл должен опираться на один
    снимок диска, иначе сходимость зависит от того, когда именно агент посмотрел
    на файлы.
    """
    _facts_cache.clear()


def collect_facts() -> Dict[str, Any]:
    """Полный снимок: всё, что писатель может отрисовать в документе.

    Снимок кэшируется на время процесса — обход репозитория стоит секунды, а
    пайплайн обращается к нему несколько раз за виток.
    """
    if _facts_cache:
        return _facts_cache
    _facts_cache.update({
        "tree": scan_tree(),
        "entrypoints": scan_entrypoints(),
        "agents": scan_agents(),
        "metrics": scan_lab_metrics(),
        "git": scan_git(),
        "doc_exists": ARCHITECTURE_DOC.is_file(),
    })
    return _facts_cache


def digest_of(facts: Dict[str, Any]) -> str:
    """Подпись снимка: она входит в ключ сходимости цикла."""
    payload = json.dumps(facts, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def summarize(facts: Dict[str, Any]) -> Dict[str, Any]:
    """Компактная сводка для агентного пакета.

    Полный снимок в пакет класть нельзя: `record()` копирует вход на каждом
    шаге, а `collector` возвращает пакет в JSON — репозиторий в 2856 файлов
    раздувал ответ до 4 МБ. В пакете остаются только числа и расхождения.
    """
    agents = facts["agents"]
    return {
        "total_files": facts["tree"]["total_files"],
        "layers": facts["tree"]["layers"],
        "entrypoints": {rel: ok for rel, ok in facts["entrypoints"].items() if not ok},
        "modules": len(agents["modules"]),
        "pipelines": agents["pipelines"],
        "cards": len(agents["cards"]),
        "engines": agents["engines"],
        "endpoints": agents["endpoints"],
        "drift": agents["drift"],
        "changed_files": len(facts["git"].get("changed_files") or []),
    }


def scan(data):
    """Шаг пайплайна: снимает снимок фактов и фиксирует его подпись.

    В пакет уходит сводка, а не снимок: писатель читает полный снимок сам,
    через `collect_facts()` — оба видят ровно одни и те же данные.
    """
    facts = collect_facts()
    return record(data, "arch_scanner", arch_summary=summarize(facts),
                  arch_digest=digest_of(facts))
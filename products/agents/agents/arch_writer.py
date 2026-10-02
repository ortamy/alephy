"""Архитектурный писатель: перерисовывает фактические блоки ARCHITECTURE.md.

Писатель умеет ровно одно — заменять содержимое между маркерами
`<!-- alephy:auto:* -->`. Ручной текст документа он не трогает: граница между
«машина описала факты» и «человек описал решения» должна быть видимой.

Режим по умолчанию — dry-run: расчёт и отчёт без записи. Запись включается
явным флагом `arch_write` в пакете и только после зелёного гейта
`tools/check-docs.py`. Агент не имеет права решать, что документ верен:
он лишь приводит описание в соответствие с диском.
"""
from __future__ import annotations

import subprocess
import sys
from typing import Any, Dict, List, Tuple

from .arch_scanner import ARCHITECTURE_DOC, REPO_ROOT, collect_facts, digest_of
from .common import record

BLOCKS = ("repo-map", "entrypoints", "agents")


def marker(name: str) -> Tuple[str, str]:
    return "<!-- alephy:auto:%s -->" % name, "<!-- alephy:auto-end:%s -->" % name


def _table(rows: List[List[str]], header: List[str]) -> List[str]:
    lines = ["| " + " | ".join(header) + " |",
             "| " + " | ".join("---" for _ in header) + " |"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return lines


def render_repo_map(facts: Dict[str, Any]) -> List[str]:
    """Слои репозитория с числом файлов — карта без архитектурных выводов."""
    layers = facts["tree"]["layers"]
    rows = [[name, str(value["files"]), str(value["code"])] for name, value in layers.items()]
    rows.append(["**всего**", str(facts["tree"]["total_files"]), "—"])
    return _table(rows, ["слой", "файлов", "из них кода"])


def render_entrypoints(facts: Dict[str, Any]) -> List[str]:
    """Точки входа с проверкой существования: отсутствие — это дрейф, а не мнение."""
    rows = [[rel, "есть" if ok else "**нет**"] for rel, ok in facts["entrypoints"].items()]
    return _table(rows, ["точка входа", "состояние"])


def render_agents(facts: Dict[str, Any]) -> List[str]:
    """Реестры агентного слоя: что зарегистрировано и где расходится с кодом."""
    agents = facts["agents"]
    rows = [
        ["модули агентов", str(len(agents["modules"]))],
        ["пайплайны-карточки", str(len(agents["cards"]))],
        ["пайплайны-эндпоинты server.py", ", ".join(agents["endpoints"]) or "—"],
        ["движки цепочек", ", ".join("`%s`" % name for name in agents["engines"])],
    ]
    lines = _table(rows, ["реестр", "записей"])
    lines.append("")
    lines.append("Пайплайны: " + ", ".join("`%s`" % name for name in agents["pipelines"]))

    drift = agents.get("drift") or {}
    findings = []
    if drift.get("missing_runner"):
        findings.append("карточка без раннера: " + ", ".join(drift["missing_runner"]))
    if drift.get("missing_card"):
        findings.append("раннер без карточки: " + ", ".join(drift["missing_card"]))
    if drift.get("uncarded"):
        findings.append("пайплайн без карточки: " + ", ".join(drift["uncarded"]))
    if findings:
        lines.append("")
        lines.append("**Расхождения реестров:**")
        lines.extend("- " + item for item in findings)
    return lines


RENDERERS = {
    "repo-map": render_repo_map,
    "entrypoints": render_entrypoints,
    "agents": render_agents,
}


def render_blocks(facts: Dict[str, Any]) -> Dict[str, List[str]]:
    """Отрисовывает все управляемые блоки из снимка фактов."""
    return {name: RENDERERS[name](facts) for name in BLOCKS}
def read_document() -> str:
    """Читает паспорт архитектуры; отсутствие файла — честная ошибка агента."""
    if not ARCHITECTURE_DOC.is_file():
        raise FileNotFoundError("Нет архитектурного паспорта: " + str(ARCHITECTURE_DOC))
    return ARCHITECTURE_DOC.read_text(encoding="utf-8")


def block_body(text: str, name: str) -> List[str] | None:
    """Возвращает строки между маркерами блока или None, если блока нет."""
    open_marker, close_marker = marker(name)
    lines = text.splitlines()
    try:
        start = lines.index(open_marker)
        end = lines.index(close_marker)
    except ValueError:
        return None
    if end <= start:
        return None
    return lines[start + 1:end]


def diff_blocks(text: str, blocks: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    """Сравнивает снимок с документом: это и есть определение дрейфа."""
    report: List[Dict[str, Any]] = []
    for name, rendered in blocks.items():
        current = block_body(text, name)
        if current is None:
            report.append({"block": name, "state": "missing", "severity": "high"})
        elif current != rendered:
            report.append({"block": name, "state": "stale", "severity": "medium"})
        else:
            report.append({"block": name, "state": "current", "severity": "none"})
    return report


def replace_blocks(text: str, blocks: Dict[str, List[str]]) -> str:
    """Заменяет только содержимое маркеров; ручной текст остаётся нетронутым."""
    lines = text.splitlines()
    for name, rendered in blocks.items():
        open_marker, close_marker = marker(name)
        try:
            start = lines.index(open_marker)
            end = lines.index(close_marker)
        except ValueError:
            continue
        if end <= start:
            continue
        lines[start + 1:end] = rendered
    return "\n".join(lines) + "\n"


def regenerate_navigation() -> Dict[str, Any]:
    """Пересобирает INDEX.md и STATS.md после правки docs/.

    Гейт сравнивает STATS.md с генератором, а STATS считает строки в
    ARCHITECTURE.md. Без этого шага запись агента сама себе ломает гейт:
    документ изменён — счётчик устарел. Правило .clinerules §4 то же самое.
    """
    script = REPO_ROOT / "tools" / "generate-docs-index.py"
    if not script.is_file():
        return {"ran": False, "ok": True, "output": "tools/generate-docs-index.py отсутствует"}
    try:
        proc = subprocess.run(
            [sys.executable, str(script)],
            cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=180, check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return {"ran": True, "ok": False, "output": "генератор не запустился: %s" % error}
    output = (proc.stdout or "") + (proc.stderr or "")
    return {"ran": True, "ok": proc.returncode == 0, "output": output.strip()}


def run_gate() -> Dict[str, Any]:
    """Гейт документации: красный результат отменяет запись, а не чинится автогенератором."""
    script = REPO_ROOT / "tools" / "check-docs.py"
    if not script.is_file():
        return {"ran": False, "ok": True, "output": "tools/check-docs.py отсутствует"}
    try:
        proc = subprocess.run(
            [sys.executable, str(script), "check"],
            cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=180, check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return {"ran": True, "ok": False, "output": "гейт не запустился: %s" % error}
    output = (proc.stdout or "") + (proc.stderr or "")
    return {"ran": True, "ok": proc.returncode == 0, "output": output.strip()}


def write(data):
    """Шаг пайплайна: считает дрейф и, только если разрешено, перерисовывает блоки.

    Ключ сходимости — `arch_doc_digest`: хеш текста, который получился бы
    после записи. Пока он не меняется, виток не имеет права ничего трогать.
    """
    facts = collect_facts()
    if not facts:
        return record(data, "arch_writer", arch_status="blocked",
                      arch_notes="Сканер не оставил снимок: писатель запущен без него.")
    blocks = render_blocks(facts)
    text = read_document()
    drift = diff_blocks(text, blocks)
    updated = replace_blocks(text, blocks)
    target_digest = digest_of({"doc": updated, "blocks": blocks})

    pending = [item for item in drift if item["state"] != "current"]
    allowed = bool(data.get("arch_write"))
    gate = {"ran": False, "ok": True, "output": "dry-run: гейт не запускался"}
    navigation = {"ran": False, "ok": True, "output": "dry-run: генератор не запускался"}
    written = False
    notes: List[str] = []

    if not pending:
        notes.append("Документ совпадает с репозиторием — правка не требуется.")
    elif not allowed:
        notes.append("Dry-run: блоков к обновлению — %d. Запись не выполнялась." % len(pending))
    else:
        # Запись идёт до гейта, а не после: гейт проверяет результат. Красный
        # результат означает откат, поэтому исходный текст держится в памяти.
        previous = text
        ARCHITECTURE_DOC.write_text(updated, encoding="utf-8")
        navigation = regenerate_navigation()
        gate = run_gate()
        if gate["ok"] and navigation["ok"]:
            written = True
            notes.append("Обновлено блоков: %d; гейт docs/ зелёный." % len(pending))
        else:
            ARCHITECTURE_DOC.write_text(previous, encoding="utf-8")
            regenerate_navigation()
            notes.append("Запись отменена и откачена: гейт docs/ красный. " + gate["output"][:400])

    # Запись могла состояться на прошлом витке: статус пакета отражает факт
    # «документ синхронизирован», а не результат последнего витка.
    synced = bool(pending) or bool(data.get("arch_written"))
    return record(data, "arch_writer",
                  arch_drift=drift,
                  arch_blocks=blocks,
                  arch_doc_digest=target_digest,
                  arch_gate=gate,
                  arch_navigation=navigation,
                  arch_written=bool(written or data.get("arch_written")),
                  arch_status="written" if synced else "dry-run",
                  arch_notes=" ".join(notes))
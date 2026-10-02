"""Фронтенд-разработчик: аудит соответствия фронтенда дизайн-канону Алефи.

Роль не в том, чтобы верстать за владельца, а в том, чтобы находить
расхождения канона раньше ревью. Проверяет то, что зафиксировано в
DESIGN-SYSTEM §4.1a: шапка ячейки bento обязана иметь единый размер,
сбрасывать наследование базового `.module h2:not(:last-child)` и не печатать
короткую черту под заголовком.

Что агент НЕ делает (границы §6): не генерирует интерфейсы, не верстает,
не меняет файлы и не решает дизайн-вопросы вместо владельца.
"""
import re
from pathlib import Path

from .common import record
from utils.context import REPO_ROOT

LAB_CSS_DIR = REPO_ROOT / "products" / "website" / "apps" / "researchlab" / "css"

# Канон §4.1a. Значения держим рядом с проверкой: §8.1 требует, чтобы код
# ссылался на канон, а не на собственное представление о красоте.
CANON_SIZE = "--ui-11"
CANON_WEIGHT = "700"
CANON_TRACKING = "--tracking-caps"
CANON_FAMILY = "--font-ui"

# Селектор заголовка ячейки bento: префикс модуля + «cell» + «title».
TITLE_SELECTOR = re.compile(r"(?P<selector>[^{}]*?-cell-title)[^{}]*\{(?P<body>[^{}]*)\}")


def _declarations(body: str) -> str:
    """Собирает значения font-*: и длинные, и из шортката `font:`."""
    longhands = " ".join(
        re.findall(r"(?:font-size|font-weight|font-family|letter-spacing)\s*:\s*([^;}]+)", body)
    )
    shorthand = " ".join(re.findall(r"(?<!-)\bfont\s*:\s*([^;}]+)", body))
    return longhands + " " + shorthand



def audit_title(selector: str, body: str) -> list:
    """Список нарушений канона для одного заголовка ячейки."""
    problems = []
    values = _declarations(body)
    line = selector.strip().splitlines()[-1].strip()

    # 1. Специфичность: без .module базовый .module h2:not(:last-child)
    #    (0,2,1) перебьёт одиночный класс и напечатает крупный сериф.
    if ".module" not in selector:
        problems.append({
            "rule": "§4.1a специфичность",
            "detail": "в селекторе нет .module — базовый .module h2 перебьёт класс",
            "fix": "дописать .module .xx-cell .xx-cell-title",
            "line": line,
        })

    # 2. Сброс черки: иначе заголовок наследует border-bottom базового h2
    #    и печатает короткую черту под текстом вместо линии во всю ширину.
    if not re.search(r"border(?:-bottom)?\s*:\s*0\b", body):
        problems.append({
            "rule": "§4.1a чёрка",
            "detail": "нет сброса border-bottom: 0 — линия наследуется от базового h2",
            "fix": "добавить border-bottom: 0 в заголовок",
            "line": line,
        })

    # 3. Единый размер: «свой» кегль = разнобой между ячейками модуля.
    if CANON_SIZE not in values:
        problems.append({
            "rule": "§4.1a размер",
            "detail": "размер не {0} — строка шапки разъезжается".format(CANON_SIZE),
            "fix": "font-size: var({0})".format(CANON_SIZE),
            "line": line,
        })

    # 4. Вес 700: при 600 лейбл читается как обычный текст рядом с номером.
    if CANON_WEIGHT not in values:
        problems.append({
            "rule": "§4.1a вес",
            "detail": "вес не {0} — лейбл теряется рядом с номером главы".format(CANON_WEIGHT),
            "fix": "font-weight: {0}".format(CANON_WEIGHT),
            "line": line,
        })

    # 5. Шрифт UI: сериф оставлен заголовкам страницы, не полосам ячеек.
    if CANON_FAMILY not in values:
        problems.append({
            "rule": "§4.1a шрифт",
            "detail": "шрифт не {0} — полоса набрана не тем шрифтом".format(CANON_FAMILY),
            "fix": "font-family: var({0})".format(CANON_FAMILY),
            "line": line,
        })

    # 6. Литерал трекинга разъедется при правке токена.
    if CANON_TRACKING not in values and re.search(r"letter-spacing\s*:\s*[.\d]", body):
        problems.append({
            "rule": "§4.1a трекинг",
            "detail": "литерал letter-spacing вместо токена",
            "fix": "letter-spacing: var({0})".format(CANON_TRACKING),
            "line": line,
        })

    return problems


def audit_file(path: Path) -> dict:
    """Аудит одного CSS-файла: заголовки ячеек и расхождения по ним."""
    text = path.read_text(encoding="utf-8")
    findings = []
    checked = 0

    for match in TITLE_SELECTOR.finditer(text):
        selector, body = match.group("selector"), match.group("body")
        # Вариант для ink-ячеек — перекраска, а не объявление лейбла.
        if "--ink" in selector:
            continue
        checked += 1
        for problem in audit_title(selector, body):
            problem["file"] = path.name
            findings.append(problem)

    return {"file": path.name, "titles": checked, "findings": findings}


def audit_lab(css_dir: Path = LAB_CSS_DIR) -> dict:
    """Полный аудит лаборатории: сводка плюс построчные расхождения."""
    files = sorted(css_dir.glob("*.css")) if css_dir.exists() else []
    per_file = [audit_file(path) for path in files]

    titles = sum(item["titles"] for item in per_file)
    findings = [problem for item in per_file for problem in item["findings"]]

    by_rule = {}
    for problem in findings:
        by_rule[problem["rule"]] = by_rule.get(problem["rule"], 0) + 1

    offenders = {(p["file"], p["line"]) for p in findings}
    return {
        "canon": "DESIGN-SYSTEM §4.1a",
        "scope": str(css_dir),
        "files": len(per_file),
        "titles": titles,
        "clean": titles - len(offenders),
        "violations": len(findings),
        "byRule": by_rule,
        "findings": findings,
        "perFile": [
            {"file": item["file"], "titles": item["titles"], "violations": len(item["findings"])}
            for item in per_file if item["titles"]
        ],
    }


def source_info() -> dict:
    """Паспорт модуля агента: путь, размер, функция входа."""
    path = Path(__file__).resolve()
    text = path.read_text(encoding="utf-8")
    return {
        "path": str(path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "lines": text.count("\n") + 1,
        "bytes": path.stat().st_size,
        "entrypoint": "prepare(data)",
        "registration": "AGENT_FUNCTIONS['Фронтенд-разработчик'] в server.py",
    }


# Готовые задачи лаборатории: паспорт отдаёт их кнопками «подставить и запустить».
LAB_TASKS = [
    {
        "id": "audit-all",
        "title": "Аудит bento-заголовков",
        "query": "аудит bento-заголовков",
        "about": "Проверить все шапки ячеек лаборатории по канону §4.1a.",
    },
    {
        "id": "audit-dashes",
        "title": "Проверка «маленьких чёрточек»",
        "query": "проверь чёрки под заголовками",
        "about": "Найти заголовки без сброса border-bottom — источник коротких чёрт.",
    },
    {
        "id": "audit-literals",
        "title": "Поиск литералов в CSS",
        "query": "найди литералы в css",
        "about": "Отдельно перечислить letter-spacing литералы — они разъезжаются с токеном.",
    },
]


def summarize(report: dict, query: str) -> str:
    """Резюме под конкретный вопрос: три задачи дают три разных ответа."""
    low = (query or "").lower()
    titles = report["titles"]

    if "чёрк" in low or "чёрточк" in low or "чертк" in low or "черт" in low:
        found = [p for p in report["findings"] if "чёрка" in p["rule"]]
        return "Чёрки под заголовками: {0} расхождений из {1} заголовков.".format(len(found), titles)

    if "литерал" in low:
        found = [p for p in report["findings"] if "трекинг" in p["rule"]]
        return "Литералы letter-spacing: {0} из {1} заголовков.".format(len(found), titles)

    return "Заголовков ячеек: {0}; соответствуют канону: {1}; расхождений: {2}.".format(
        titles, report["clean"], report["violations"]
    )


def contract() -> dict:
    """Контракт агента для паспорта: вход, выход и осознанные границы (§6)."""
    return {
        "input": {
            "type": "dict (пакет пайплайна)",
            "required": ["query"],
            "query": "строка: на русском, описывает проверку",
        },
        "output": {
            "type": "dict",
            "keys": ["frontend", "frontend_summary", "frontend_source", "frontend_tasks"],
            "note": "frontend попадает в agentTrace как observations",
        },
        "boundaries": [
            "не генерирует интерфейсы и не верстает",
            "не меняет файлы на диске — только читает и сообщает",
            "не решает дизайн-вопросы вместо владельца",
        ],
        "run": {
            "endpoint": "POST /run",
            "example": '{"query": "аудит bento-заголовков"}',
            "server": "python products/agents/server.py",
        },
    }


def prepare(data):
    query = (data.get("query") or "").strip()
    report = audit_lab()

    return record(data, "frontend_developer",
                  frontend=report,
                  frontend_summary=summarize(report, query),
                  frontend_source=source_info(),
                  frontend_contract=contract(),
                  frontend_tasks=LAB_TASKS)

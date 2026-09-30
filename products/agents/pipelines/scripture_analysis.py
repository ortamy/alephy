#!/usr/bin/env python3
"""Структурированный ИИ-разбор палео-фрагмента для «Книгочтения» (#scripture-reader).

Разделение труда: локальная физика букв — факт модуля, модель её не переписывает.
Клиент присылает уже посчитанную сборку-действие и паспорт букв, сервер добавляет
корни из roots.json и строит промпт; модель возвращает только трактовку —
в слотах с явным разделением «факт / интерпретация / гипотеза» (§11 .clinerules).

Модуль не зависит от Flask: эндпоинт `server.py` вызывает analyze() напрямую.
"""
import json
import re

from agents.paleo_translator import translate
from agents.semitologist import compare as semitic_compare
from pipelines.core import run_steps
from utils.context import find_root

# Слоты ответа → ячейки бенто «Разбор свидетельств» (#scripture-reader).
SLOTS = ("fact", "interpretation", "hypothesis", "warnings", "confidence")
CONFIDENCE_LEVELS = ("low", "mid", "high")

SYSTEM_PROMPT = (
    "Ты помощник исследователя ALEPHY. Тебе дают палео-фрагмент и локально "
    "вычисленную физику букв.\n"
    "Правила ответа:\n"
    "1. Не переписывай физику букв — она дана во входных данных и есть факт.\n"
    "2. Возвращай ТОЛЬКО валидный JSON, без текста вне объекта.\n"
    "3. fact — то, что следует из палео-сборки и корня; никаких новых допущений.\n"
    "4. interpretation — как образ работает в предложении; это трактовка.\n"
    "5. hypothesis — гипотеза чтения; если её нет, верни пустую строку.\n"
    "6. warnings — терминологические подмены и сомнения; пустой массив, если нет.\n"
    "7. confidence — ровно одно из low, mid, high.\n"
    "Пиши по-русски, терминологию бери из входа."
)


def _local_facts(payload):
    """Локально проверяемая часть: корень из roots.json, сборка, образ, параллели."""
    root = payload.get("root") or {}
    if not root and payload.get("hebrew"):
        root = find_root(str(payload.get("hebrew"))) or {}
    data = {"query": str(payload.get("paleo") or ""), "trace": [], "agentTrace": []}
    data["root"] = root
    data["term"] = str(payload.get("hebrew") or payload.get("paleo") or "")
    output = run_steps(data, (translate, semitic_compare))
    result = output.get("result", {})
    image = result.get("paleo_image") or {}
    parallels = result.get("semitic_parallels") or {}
    return {
        "root": str(root.get("root") or ""),
        "rootMeaning": str(root.get("meaning") or ""),
        "assembly": str(payload.get("assembly") or image.get("meaning") or ""),
        "letters": image.get("letters") or payload.get("letters") or [],
        "parallels": parallels if isinstance(parallels, dict) else {},
    }


def _prompt(payload, facts):
    context = {
        "book": str(payload.get("book") or ""),
        "verse": str(payload.get("verse") or ""),
        "paleo": str(payload.get("paleo") or ""),
        "hebrew": str(payload.get("hebrew") or ""),
        "translit": str(payload.get("translit") or ""),
        "verseFunction": str(payload.get("verseFunction") or ""),
        "localPhysics": facts,
    }
    return SYSTEM_PROMPT + "\n\nВходные данные (JSON):\n" + json.dumps(context, ensure_ascii=False, indent=2)


def parse_slots(text):
    """Достаёт JSON-объект из ответа модели; текст вокруг игнорирует."""
    match = re.search(r"\{.*\}", str(text or "").strip(), re.S)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def normalize_slots(raw):
    """Гарантирует форму ответа: строки в слотах, уверенность из белого списка."""
    slots = {}
    for slot in SLOTS:
        value = raw.get(slot)
        if slot == "warnings":
            if isinstance(value, str):
                value = [value] if value.strip() else []
            slots[slot] = [str(item) for item in value if str(item).strip()] if isinstance(value, list) else []
        elif slot == "confidence":
            value = str(value or "").strip().lower()
            slots[slot] = value if value in CONFIDENCE_LEVELS else "low"
        else:
            slots[slot] = str(value or "").strip()
    return slots


def analyze(payload, model_text=None, model=None):
    """Единая точка разбора: локальные факты + нормализованные слоты модели.

    model_text=None означает «модель недоступна»: слоты пустые, факты на месте —
    клиент показывает офлайн-состояние и не выдаёт гипотезу за разбор.
    """
    payload = payload if isinstance(payload, dict) else {}
    facts = _local_facts(payload)
    slots = normalize_slots(parse_slots(model_text)) if model_text else normalize_slots({})
    return {
        "facts": facts,
        "slots": slots,
        "confidence": slots["confidence"],
        "prompt": _prompt(payload, facts),
        "model": str(model or ""),
        "modelAvailable": bool(model_text),
    }

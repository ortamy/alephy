"""Локальный адаптер Ollama для редакторской сводки готового результата."""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen2.5-coder:1.5b"


class OllamaError(RuntimeError):
    """Ошибка соединения или ответа локальной модели."""


def _request(path, payload=None, timeout=5):
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        OLLAMA_URL + path,
        data=body,
        headers={"Content-Type": "application/json"} if body else {},
        method="POST" if body else "GET",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise OllamaError("Ollama недоступна: " + str(error)) from error


def status():
    """Возвращает доступность Ollama и установленные модели."""
    try:
        payload = _request("/api/tags")
        models = [item.get("name") for item in payload.get("models", []) if item.get("name")]
        return {"available": True, "models": models, "defaultModel": DEFAULT_MODEL}
    except OllamaError as error:
        return {"available": False, "models": [], "defaultModel": DEFAULT_MODEL, "error": str(error)}

def generate(prompt, model=None, temperature=0.2, timeout=120):
    """Одиночная генерация по готовому промпту. Бросает OllamaError при сбое.

    Общая точка для summarize() и структурированного разбора Книгочтения:
    отличается только промпт, поэтому логика запроса не дублируется.
    """
    payload = _request(
        "/api/generate",
        {"model": model or DEFAULT_MODEL, "prompt": prompt, "stream": False,
         "options": {"temperature": max(0, min(1, float(temperature))) }},
        timeout=timeout,
    )
    response = str(payload.get("response") or "").strip()
    if not response:
        raise OllamaError("Ollama вернула пустой ответ")
    return {"model": model or DEFAULT_MODEL, "text": response}




def summarize(query, result, model=None, temperature=0.2):
    """Собирает краткую сводку только на основе результата агентов."""
    selected_model = model or DEFAULT_MODEL
    prompt = (
        "Ты редактор исследовательского отчёта ALEPHY. "
        "Сделай краткую сводку на русском в 2–4 предложениях. "
        "Не добавляй фактов, которых нет во входных данных. "
        "Отделяй наблюдение от гипотезы и укажи ограничение, если оно есть.\n\n"
        "Запрос: " + query + "\nРезультат агентов:\n" +
        json.dumps(result, ensure_ascii=False, indent=2)
    )
    return generate(prompt, selected_model, temperature)
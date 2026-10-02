#!/usr/bin/env python3
"""Flask API сервер агентов + раздача Лаборатории ResearchLab.

Запуск (одна команда):
    python server.py [--host 127.0.0.1] [--port 5000] [--no-cors] [--no-browser]

Сервер:
    /api/*          — REST API агентной системы;
    /apps/researchlab/ — интерфейс ResearchLab (из products/website);
    POST /api/lab/shutdown — остановка сервера;
    POST /api/lab/restart  — перезапуск сервера (Windows: новое окно).
"""
import argparse
import json
import math
import os
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, abort, jsonify, redirect, request, send_from_directory
from orchestrator import dispatch, run_pipeline as execute_named_pipeline
from pipelines.core import run_steps
from agents.common import packet
from agents import ai_engineer, code_reviewer, collector, comparator, critic, editor, exposer, \
    flow_architect, frontend, liaison, paleo_translator, researcher, semitologist, verifier, writer
from ollama_adapter import OllamaError, status as ollama_status, summarize as ollama_summarize, \
    generate as ollama_generate

app = Flask(__name__)
PIPELINES_PATH = Path(__file__).resolve().parents[2] / "products" / "website" / "apps" / "researchlab" / "data" / "pipelines.json"
RESULTS_PATH = PIPELINES_PATH.with_name("pipeline-results.json")
WEB_ROOT = Path(__file__).resolve().parents[2] / "products" / "website"
SERVER_START = time.time()

# Русские имена агентов из UI (getAgentMapData) → их функции.
# Позволяет исполнять кастомные пайплайны, созданные в Research Lab,
# даже если для них не зарегистрирован Python-раннер.
AGENT_FUNCTIONS = {
    "Исследователь": researcher.research,
    "Семитолог": semitologist.compare,
    "Разоблачитель": exposer.expose,
    "Редактор": editor.edit,
    "Сборщик": collector.collect,
    "Компаратор": comparator.compare,
    "Критик": critic.critique,
    "Проверяющий": verifier.verify,
    "Переводчик палео-иврита": paleo_translator.translate,
    "Архитектор потока": flow_architect.design,
    "Связной": liaison.relay,
    "Технический писатель": writer.write,
    "Ревьюер кода": code_reviewer.review,
    "AI-инженер": ai_engineer.prepare,
    "Фронтенд-разработчик": frontend.prepare,
}

AGENTS_DIR = Path(__file__).resolve().parent

# Русское имя агента (как в UI) → модуль в agents/. Тот же белый список, что и
# AGENT_FUNCTIONS: эндпоинт исходников не должен читать произвольный путь.
AGENT_SOURCES = {
    "Исследователь": "agents/researcher.py",
    "Семитолог": "agents/semitologist.py",
    "Разоблачитель": "agents/exposer.py",
    "Редактор": "agents/editor.py",
    "Сборщик": "agents/collector.py",
    "Компаратор": "agents/comparator.py",
    "Критик": "agents/critic.py",
    "Проверяющий": "agents/verifier.py",
    "Переводчик палео-иврита": "agents/paleo_translator.py",
    "Архитектор потока": "agents/flow_architect.py",
    "Связной": "agents/liaison.py",
    "Технический писатель": "agents/writer.py",
    "Ревьюер кода": "agents/code_reviewer.py",
    "AI-инженер": "agents/ai_engineer.py",
    "Фронтенд-разработчик": "agents/frontend.py",
    "Оркестратор": "orchestrator.py",
}


def read_pipelines():
    if not PIPELINES_PATH.exists():
        return []
    with PIPELINES_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, list) else payload.get("pipelines", [])


def write_pipelines(pipelines):
    PIPELINES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PIPELINES_PATH.open("w", encoding="utf-8") as handle:
        json.dump(pipelines, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def read_results():
    if not RESULTS_PATH.exists():
        return []
    with RESULTS_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, list) else []


def write_results(results):
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with RESULTS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


@app.after_request
def add_cors_headers(response):
    """Разрешает Research Lab, открытой на другом локальном порту, вызвать API.

    Заголовки добавляются только если не передан флаг --no-cors.
    """
    if app.config.get("CORS_ENABLED", True):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/run", methods=["OPTIONS"])
def run_options():
    return ("", 204)


@app.post("/run")
@app.post("/api/run")
def run_pipeline():
    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or payload.get("task") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    # Прямой запуск именованного агента из его паспорта. Без этого ветки
    # запрос уходит в ROUTES, где только пайплайны, и агент вроде
    # фронтенд-разработчика недостижим из интерфейса.
    agent = (payload.get("agent") or "").strip()
    if agent:
        runner = AGENT_FUNCTIONS.get(agent)
        if runner is None:
            return jsonify({"error": "Неизвестный агент: " + agent}), 400
        try:
            return jsonify(runner({"query": query, "task": query}))
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
    try:
        return jsonify(dispatch(query))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "alephy-agents"})


@app.get("/api/info")
def api_info():
    """Метаданные процесса: нужны панели «Запуск сервера» в интерфейсе."""
    return jsonify({
        "status": "ok",
        "service": "alephy-agents",
        "host": app.config.get("SERVER_HOST", "127.0.0.1"),
        "port": app.config.get("SERVER_PORT", 5000),
        "pid": os.getpid(),
        "python": ".".join(str(part) for part in sys.version_info[:3]),
        "executable": sys.executable,
        "cwd": str(Path.cwd()),
        "uptime": round(time.time() - SERVER_START, 1),
    })


@app.get("/api/agents/source")
def agent_source():
    """Исходник модуля агента: паспорт в лабе показывает код прямо из файла.

    Источник истины — файл на диске, поэтому правка Python подхватывается
    без синхронизации статических данных. Имя агента приходит из белого
    списка: путь собирается только по зарегистрированным модулям, произвольный
    путь из запроса не читается (граница доверия, §7).
    """
    name = (request.args.get("agent") or "").strip()
    module = AGENT_SOURCES.get(name)
    if not module:
        return jsonify({
            "error": "unknown agent",
            "available": sorted(AGENT_SOURCES),
        }), 404

    path = AGENTS_DIR / module
    if not path.exists():
        return jsonify({"error": "source file is missing"}), 404

    source = path.read_text(encoding="utf-8")
    return jsonify({
        "agent": name,
        "path": "products/agents/{0}".format(module),
        "lines": source.count("\n") + 1,
        "bytes": len(source.encode("utf-8")),
        "source": source,
    })


@app.post("/api/scripture/analyze")
def analyze_scripture():
    """Структурированный разбор палео-фрагмента для #scripture-reader.

    Контракт и разделение «факт / интерпретация / гипотеза» — ADR-006.
    Без модели ответ всё равно содержит локальные факты: клиент показывает
    офлайн-состояние, а не пустую ячейку.
    """
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "payload must be an object"}), 400
    paleo = str(payload.get("paleo") or "").strip()
    if not paleo:
        return jsonify({"error": "paleo is required"}), 400

    from pipelines.scripture_analysis import analyze

    # Промпт строим до обращения к модели: он нужен и для отладки, и для офлайн-ответа.
    base = analyze(payload)
    result = dict(base)
    model_name = str(payload.get("model") or "").strip() or None

    if payload.get("skipModel"):
        result["modelError"] = ""
        return jsonify(result)

    try:
        generated = ollama_generate(base["prompt"], model_name, payload.get("temperature", 0.2))
    except OllamaError as error:
        # Сбой модели не отменяет локальный разбор — §9 (офлайн-фолбэк).
        result["modelAvailable"] = False
        result["modelError"] = str(error)
        return jsonify(result)

    parsed = analyze(payload, model_text=generated["text"], model=generated["model"])
    parsed["modelError"] = ""
    return jsonify(parsed)


@app.post("/api/workbench/pdf-text")
def extract_workbench_pdf_text():
    """Извлекает текстовый слой PDF для конвейера перевода книги."""
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "file is required"}), 400
    if not uploaded.filename.lower().endswith(".pdf"):
        return jsonify({"error": "PDF file is required"}), 400

    try:
        from pypdf import PdfReader

        reader = PdfReader(uploaded.stream)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(page for page in pages if page.strip()).strip()
    except Exception as error:
        return jsonify({"error": f"PDF reading failed: {error}"}), 422

    if not text:
        return jsonify({"error": "PDF does not contain an accessible text layer"}), 422
    return jsonify({"text": text, "pages": len(pages), "chars": len(text)})


def _serve_lab_file(filename):
    """Отдаёт файлы Лаборатории из products/website, не выпуская за пределы корня."""
    if not filename:
        filename = "index.html"
    target = (WEB_ROOT / filename).resolve()
    if target != WEB_ROOT and WEB_ROOT not in target.parents:
        abort(404)
    return send_from_directory(WEB_ROOT, filename)


@app.get("/")
def lab_home():
    return send_from_directory(WEB_ROOT, "index.html")


@app.get("/apps/researchlab")
def lab_index_no_slash():
    return redirect("/apps/researchlab/")


@app.get("/apps/researchlab/")
def lab_index():
    return send_from_directory(WEB_ROOT, "apps/researchlab/index.html")


@app.get("/<path:filename>")
def lab_static(filename):
    return _serve_lab_file(filename)


@app.post("/api/lab/shutdown")
def lab_shutdown():
    """Остановка сервера из интерфейса. В тестовом режиме процесс не гасим."""
    if app.config.get("TESTING"):
        return jsonify({"stopped": False, "testing": True, "pid": os.getpid()})
    threading.Timer(0.4, lambda: os._exit(0)).start()
    return jsonify({"stopped": True, "pid": os.getpid()})


@app.post("/api/lab/restart")
def lab_restart():
    """Перезапуск сервера: стартует новый процесс и гасит текущий.

    В тестовом режиме процесс не трогаем.
    """
    if app.config.get("TESTING"):
        return jsonify({"restarted": False, "testing": True, "pid": os.getpid()})
    args = [
        sys.executable, str(Path(__file__).resolve()),
        "--host", app.config.get("SERVER_HOST", "127.0.0.1"),
        "--port", str(app.config.get("SERVER_PORT", 5000)),
    ]
    if not app.config.get("CORS_ENABLED", True):
        args.append("--no-cors")
    if os.name == "nt":
        flags = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(args, cwd=str(Path(__file__).resolve().parent),
                         creationflags=flags, close_fds=True)
    else:
        subprocess.Popen(args, cwd=str(Path(__file__).resolve().parent),
                         start_new_session=True, close_fds=True)
    threading.Timer(0.6, lambda: os._exit(0)).start()
    return jsonify({"restarted": True, "pid": os.getpid()})


@app.get("/api/ollama/status")
def get_ollama_status():
    return jsonify(ollama_status())


@app.get("/api/pipelines")
def list_pipelines():
    return jsonify(read_pipelines())


@app.get("/api/pipeline-results")
def list_pipeline_results():
    return jsonify(read_results())


@app.post("/api/pipelines/<pipeline_id>/run")
def run_named_pipeline(pipeline_id):
    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or "").strip()
    use_ollama = bool(payload.get("useOllama"))
    ollama_model = str(payload.get("model") or "").strip() or None
    ollama_temperature = payload.get("temperature", 0.2)
    try:
        ollama_temperature = float(ollama_temperature)
        if not math.isfinite(ollama_temperature):
            ollama_temperature = 0.2
    except (TypeError, ValueError):
        ollama_temperature = 0.2
    pipeline = next((item for item in read_pipelines() if item.get("id") == pipeline_id), None)
    if pipeline is None:
        return jsonify({"error": "pipeline not found"}), 404
    if not query:
        query = str(pipeline.get("defaultQuery") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    try:
        output = execute_named_pipeline(str(pipeline.get("runner") or pipeline_id), query)
    except ValueError as error:
        # Для пайплайнов, созданных в UI и не имеющих Python-раннера,
        # собираем линейную цепочку из русских имён агентов.
        steps = [AGENT_FUNCTIONS[name] for name in pipeline.get("agents", []) if name in AGENT_FUNCTIONS]
        if not steps:
            return jsonify({"error": str(error)}), 400
        output = run_steps(packet(query), steps)
    created_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    result = {
        "id": pipeline_id + "-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
        "pipelineId": pipeline_id,
        "title": output.get("result", {}).get("title", pipeline.get("name", pipeline_id)),
        "query": query,
        "createdAt": created_at,
        "source": "local-agents",
        "status": "ready",
        "trace": output.get("trace", []),
        "agentTrace": output.get("agentTrace", []),
        "result": output.get("result", {}),
    }
    if use_ollama:
        try:
            result["ollama"] = ollama_summarize(query, result["result"], ollama_model, ollama_temperature)
            result["result"]["aiSummary"] = result["ollama"]["text"]
        except OllamaError as error:
            # Ошибка редакторского слоя не отменяет результат агентов.
            result["ollama"] = {
                "status": "error",
                "model": ollama_model,
                "error": str(error),
            }
    results = read_results()
    results.insert(0, result)
    write_results(results)
    return jsonify(result), 201


@app.get("/api/pipelines/<pipeline_id>/results")
def list_pipeline_history(pipeline_id):
    results = [item for item in read_results() if item.get("pipelineId") == pipeline_id]
    return jsonify(results)


@app.post("/api/pipelines")
def create_pipeline():
    payload = request.get_json(silent=True) or {}
    pipeline, error = validate_pipeline(payload)
    if error:
        return jsonify({"error": error[0]}), error[1]
    pipelines = read_pipelines()
    pipeline["id"] = make_pipeline_id(pipelines, pipeline["name"])
    pipeline.setdefault("runner", pipeline["id"])
    pipelines.append(pipeline)
    write_pipelines(pipelines)
    return jsonify(pipeline), 201


@app.put("/api/pipelines/<pipeline_id>")
def update_pipeline(pipeline_id):
    payload = request.get_json(silent=True) or {}
    pipeline, error = validate_pipeline(payload)
    if error:
        return jsonify({"error": error[0]}), error[1]
    pipelines = read_pipelines()
    for index, current in enumerate(pipelines):
        if current.get("id") == pipeline_id:
            pipeline["id"] = pipeline_id
            pipelines[index] = pipeline
            write_pipelines(pipelines)
            return jsonify(pipeline)
    return jsonify({"error": "pipeline not found"}), 404


@app.delete("/api/pipelines/<pipeline_id>")
def delete_pipeline(pipeline_id):
    pipelines = read_pipelines()
    filtered = [item for item in pipelines if item.get("id") != pipeline_id]
    if len(filtered) == len(pipelines):
        return jsonify({"error": "pipeline not found"}), 404
    write_pipelines(filtered)
    return jsonify({"deleted": pipeline_id})


def validate_pipeline(payload):
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip()
    agents = payload.get("agents")
    if not name:
        return None, ("name is required", 400)
    if not isinstance(agents, list) or not agents or not all(str(agent).strip() for agent in agents):
        return None, ("at least one agent is required", 400)
    pipeline_type = str(payload.get("type") or "linear").strip().lower()
    if pipeline_type not in ("linear", "loop", "spiral"):
        pipeline_type = "linear"
    pipeline = {"name": name, "description": description, "agents": [str(agent).strip() for agent in agents],
                "type": pipeline_type}
    try:
        max_iterations = int(payload.get("maxIterations") or 0)
    except (TypeError, ValueError):
        max_iterations = 0
    if max_iterations > 0:
        pipeline["maxIterations"] = max_iterations
    return pipeline, None


def make_pipeline_id(pipelines, name):
    base = "pipeline-" + "-".join("".join(char.lower() if char.isalnum() else "-" for char in name).split())
    base = base.strip("-") or "pipeline"
    candidate = base
    suffix = 2
    used = {item.get("id") for item in pipelines}
    while candidate in used:
        candidate = base + "-" + str(suffix)
        suffix += 1
    return candidate


def _http_host(host):
    """Для автооткрытия браузера 0.0.0.0/:: превращаем в 127.0.0.1."""
    return host if host not in ("0.0.0.0", "::") else "127.0.0.1"


def main():
    parser = argparse.ArgumentParser(description="ALEPHY: агентный сервер + Лаборатория ResearchLab")
    parser.add_argument("--host", default="127.0.0.1", help="Адрес прослушивания (по умолчанию 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5000, help="Порт (по умолчанию 5000)")
    parser.add_argument("--no-cors", action="store_true", help="Не добавлять CORS-заголовки")
    parser.add_argument("--no-browser", action="store_true", help="Не открывать Лабораторию в браузере")
    args = parser.parse_args()

    app.config["SERVER_HOST"] = args.host
    app.config["SERVER_PORT"] = args.port
    app.config["CORS_ENABLED"] = not args.no_cors
    app.config["TESTING"] = False

    http_host = _http_host(args.host)
    lab_url = "http://{0}:{1}/apps/researchlab/".format(http_host, args.port)
    print("=" * 64)
    print("ALEPHY · сервер агентов")
    print("  Лаборатория: " + lab_url)
    print("  API health : http://{0}:{1}/api/health".format(http_host, args.port))
    print("  Python     : " + sys.executable)
    print("  PID        : " + str(os.getpid()))
    print("  CORS       : " + ("вкл" if app.config["CORS_ENABLED"] else "выкл"))
    print("=" * 64)
    if not args.no_browser:
        threading.Timer(0.9, lambda: webbrowser.open(lab_url)).start()
    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()

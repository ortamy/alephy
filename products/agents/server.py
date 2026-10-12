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

import importlib

from flask import Flask, abort, jsonify, redirect, request, send_from_directory
from orchestrator import dispatch, run_pipeline as execute_named_pipeline
from pipelines.core import run_loop, run_steps
from agents.common import packet
from agents.convergence import converge
from ollama_adapter import OllamaError, status as ollama_status, summarize as ollama_summarize, \
    generate as ollama_generate

app = Flask(__name__)
PIPELINES_PATH = Path(__file__).resolve().parents[2] / "products" / "website" / "apps" / "researchlab" / "data" / "pipelines.json"
RESULTS_PATH = PIPELINES_PATH.with_name("pipeline-results.json")
# Готовые сборки: шаблоны команд агентов, из которых UI создаёт пайплайн
# в один клик. Живут отдельным файлом — шаблон ещё не карточка.
TEMPLATES_PATH = PIPELINES_PATH.with_name("pipeline-templates.json")
WEB_ROOT = Path(__file__).resolve().parents[2] / "products" / "website"
SERVER_START = time.time()

# Источник правды о регистре агентов — единый JSON
# (tools/generate-agent-registry.py). Каждая запись агента имеет модуль и имя
# функции; они импортируются через importlib. Если модуль или функция не
# найдены — сервер падает при запуске явно, а не на первом запросе.


AGENTS_DIR = Path(__file__).resolve().parent
AGENTS_DATA_PATH = AGENTS_DIR / "data" / "agents.json"


def build_agent_registry():
    """Auto-generate AGENT_FUNCTIONS / AGENT_SOURCES из единого реестра агентов.

    Возвращает: (AGENT_FUNCTIONS, AGENT_SOURCES, AGENTS_MODULE_INDEX).
    Ключи функций — русские имена, как в getAgentMapData(): UI шлёт их,
    движок ищет по ним.
    """
    with AGENTS_DATA_PATH.open(encoding="utf-8") as handle:
        registry = json.load(handle)
    functions = {}
    sources = {}
    module_index = {}
    for slug, spec in registry.get("agents", {}).items():
        module = importlib.import_module("agents." + spec["module"])
        fn = getattr(module, spec["function"], None)
        if fn is None or not callable(fn):
            raise ImportError(
                "Агент %s: в модуле agents.%s нет функции %s"
                % (slug, spec["module"], spec["function"])
            )
        functions[spec["name"]] = fn
        sources[spec["name"]] = spec["module"] + ".py"
        module_index[slug] = spec["module"]
    return functions, sources, module_index


AGENT_FUNCTIONS, AGENT_SOURCES, AGENTS_MODULE_INDEX = build_agent_registry()

# Оркестратор — control-plane, его функций нет в AGENT_FUNCTIONS:
# путь задан явно, а не импортируется.
AGENT_SOURCES["Оркестратор"] = "orchestrator.py"

# Пайплайны с правом записи в файлы проекта. Всё остальное работает только
# на чтение, даже если запросит флаг: белый список, а не проверка имени.
WRITABLE_PIPELINES = {"arch_keeper"}

# Витки циклической карточки из UI, если она не назвала своё число сама.
DEFAULT_MAX_ITERATIONS = 5


def get_agent_module(slug: str):
    """Импорт модуля агента по slug из реестра.

    Используется эндпоинтом GET /api/agents/source — безопасный доступ к
    исходникам только зарегистрированных агентов.
    """
    return importlib.import_module("agents." + AGENTS_MODULE_INDEX[slug])


@app.get("/api/agents")
def list_agents():
    """Паспорта всех агентов из единого реестра (включая расширенный контракт).

    endpoint: GET /api/agents
    """
    with AGENTS_DATA_PATH.open(encoding="utf-8") as handle:
        return jsonify(json.load(handle))


def run_card_pipeline(pipeline, data, steps):
    """Карточка без Python-раннера: цепочка исполняется по её типу из данных.

    Тип `loop`/`spiral` в карточке — не украшение: если он заявлен, шаги идут
    витками со сходимостью (`run_loop`), иначе `maxIterations` было бы полем,
    которое ничего не значит. Карточка, не завершившая работу Сборщиком,
    получает собранный результат: без него запуску нечего показать.
    """
    if str(pipeline.get("type") or "linear").strip().lower() in ("loop", "spiral"):
        try:
            max_iterations = int(pipeline.get("maxIterations"))
        except (TypeError, ValueError):
            max_iterations = DEFAULT_MAX_ITERATIONS
        data = run_loop(data, cycle_steps=tuple(steps), converge_step=converge,
                        max_iterations=max_iterations)
    else:
        data = run_steps(data, steps)
    if isinstance(data, dict) and data and "result" not in data:
        # Сборщик берётся из реестра, а не импортируется напрямую:
        # иначе карта агентов и статические импорты разъезжаются.
        data = AGENT_FUNCTIONS["Сборщик"](data)
    return data


def read_pipelines():
    if not PIPELINES_PATH.exists():
        return []
    with PIPELINES_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, list) else payload.get("pipelines", [])


def read_templates():
    """Готовые сборки: статический список шаблонов, не карточки пайплайнов."""
    if not TEMPLATES_PATH.exists():
        return []
    with TEMPLATES_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, list) else payload.get("templates", [])


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


@app.get("/api/pipeline-templates")
def list_pipeline_templates():
    """Готовые сборки: шаблоны команд агентов для создания пайплайна.

    endpoint: GET /api/pipeline-templates
    """
    return jsonify(read_templates())


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
        runner = str(pipeline.get("runner") or pipeline_id)
        # Пайплайны, которым разрешено трогать файлы проекта. Запись включается
        # только явным флагом в теле запроса и только для перечисленных
        # пайплайнов: агент не должен получать право записи из интерфейса
        # по умолчанию (§9 .clinerules — границы доверия).
        write_enabled = runner in WRITABLE_PIPELINES and bool(payload.get("writeEnabled"))
        if write_enabled and runner == "arch_keeper":
            from pipelines.arch_keeper import run as run_arch_keeper
            output = run_arch_keeper(query, write_enabled=True)
        else:
            output = execute_named_pipeline(runner, query)
    except ValueError as error:
        # Для пайплайнов, созданных в UI и не имеющих Python-раннера,
        # собираем цепочку из русских имён агентов и исполняем её по типу
        # карточки: линейная цепочка или цикл со сходимостью.
        steps = [AGENT_FUNCTIONS[name] for name in pipeline.get("agents", []) if name in AGENT_FUNCTIONS]
        if not steps:
            return jsonify({"error": str(error)}), 400
        output = run_card_pipeline(pipeline, packet(query), steps) or {}
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


@app.delete("/api/pipeline-results/<result_id>")
def delete_pipeline_result(result_id):
    # Удаление одного прогона из истории: интерфейс страницы паспорта
    # предлагает кнопку у каждой строки (CRUD истории, §5.2s).
    results = read_results()
    filtered = [item for item in results if item.get("id") != result_id]
    if len(filtered) == len(results):
        return jsonify({"error": "result not found"}), 404
    write_results(filtered)
    return jsonify({"deleted": result_id})


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
    # Косметические поля из готовой сборки: белый список, а не разбор всего
    # payload — что не перечислено, в карточку не попадает.
    for key in ("defaultQuery", "tip"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            pipeline[key] = value.strip()
    examples = payload.get("examples")
    if isinstance(examples, list):
        kept = [str(item).strip() for item in examples if str(item).strip()][:4]
        if kept:
            pipeline["examples"] = kept
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

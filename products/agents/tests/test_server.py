"""Контрактные тесты локального API пайплайнов."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


AGENTS_DIR = Path(__file__).resolve().parents[1]
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

from server import app  # noqa: E402
from ollama_adapter import OllamaError  # noqa: E402


class WritablePipelineTest(unittest.TestCase):
    """Право записи выдаётся по белому списку и только явным флагом."""

    ARCH = {"id": "arch_keeper", "runner": "arch_keeper", "name": "Смотритель",
            "defaultQuery": "проверь архитектуру"}

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_allowlist_is_explicit_and_narrow(self):
        from server import WRITABLE_PIPELINES
        self.assertEqual(WRITABLE_PIPELINES, {"arch_keeper"})

    @patch("server.write_results")
    @patch("server.read_results", return_value=[])
    @patch("server.read_pipelines")
    def test_flag_is_ignored_for_read_only_pipeline(self, read_pipelines, _read, _write):
        """Чужой пайплайн не получает запись, даже если флаг прислали."""
        read_pipelines.return_value = [{"id": "word_analyzer", "runner": "word_analyzer",
                                        "name": "Разбор", "defaultQuery": "разбери слово Давар"}]
        with patch("server.execute_named_pipeline",
                   return_value={"result": {"title": "t"}, "trace": [], "agentTrace": []}) as execute:
            response = self.client.post("/api/pipelines/word_analyzer/run",
                                        json={"query": "тест", "writeEnabled": True})
        self.assertEqual(response.status_code, 201)
        execute.assert_called_once()

    @patch("server.write_results")
    @patch("server.read_results", return_value=[])
    @patch("server.read_pipelines")
    def test_arch_keeper_gets_write_flag(self, read_pipelines, _read, _write):
        read_pipelines.return_value = [self.ARCH]
        with patch("pipelines.arch_keeper.run", return_value={
                "result": {"title": "t"}, "trace": [], "agentTrace": []}) as keeper:
            self.client.post("/api/pipelines/arch_keeper/run",
                             json={"query": "проверь архитектуру", "writeEnabled": True})
        self.assertEqual(keeper.call_args.kwargs, {"write_enabled": True})

    @patch("server.write_results")
    @patch("server.read_results", return_value=[])
    @patch("server.read_pipelines")
    def test_without_flag_arch_keeper_stays_dry_run(self, read_pipelines, _read, _write):
        """Без флага пайплайн идёт обычным путём: `run()` сам остаётся dry-run."""
        read_pipelines.return_value = [self.ARCH]
        with patch("server.execute_named_pipeline",
                   return_value={"result": {"title": "t"}, "trace": [], "agentTrace": []}) as execute:
            self.client.post("/api/pipelines/arch_keeper/run", json={"query": "проверь архитектуру"})
        execute.assert_called_once_with("arch_keeper", "проверь архитектуру")

    def test_default_run_of_arch_keeper_does_not_write(self):
        """Контракт пайплайна: без явного флага документ не меняется."""
        from pipelines.arch_keeper import run
        from agents.arch_scanner import ARCHITECTURE_DOC
        before = ARCHITECTURE_DOC.read_bytes()
        data = run("проверь архитектуру")["result"]["data"]
        self.assertEqual(ARCHITECTURE_DOC.read_bytes(), before)
        self.assertIn(data["arch_status"], ("dry-run", "written"))


class PipelineApiTest(unittest.TestCase):
    """Проверяет API без запуска отдельного Flask-процесса."""

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()
        self.pipeline = {
            "id": "word_analyzer",
            "runner": "word_analyzer",
            "name": "Разбор слова",
            "defaultQuery": "разбери слово Берешит",
        }
        self.output = {
            "trace": ["researcher", "collector"],
            "agentTrace": [{"agentId": "researcher", "status": "done", "input": {}, "observations": [], "decisions": [], "hypotheses": [], "limitations": [], "output": {}}],
            "result": {"title": "Исследование", "summary": "Базовый результат"},
        }

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    @patch("server.write_results")
    @patch("server.read_results", return_value=[{"pipelineId": "word_analyzer", "id": "previous"}])
    @patch("server.execute_named_pipeline")
    @patch("server.read_pipelines")
    def test_run_saves_agent_result_without_ollama(self, read_pipelines, execute, _read_results, write_results):
        read_pipelines.return_value = [self.pipeline]
        execute.return_value = self.output

        response = self.client.post("/api/pipelines/word_analyzer/run", json={"query": "тест"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["result"]["summary"], "Базовый результат")
        self.assertEqual(response.get_json()["agentTrace"][0]["agentId"], "researcher")
        write_results.assert_called_once()
        self.assertEqual(write_results.call_args.args[0][1]["id"], "previous")

    @patch("server.read_results")
    def test_pipeline_history_returns_only_requested_pipeline(self, read_results):
        read_results.return_value = [{"pipelineId": "word_analyzer"}, {"pipelineId": "research_builder"}]

        response = self.client.get("/api/pipelines/word_analyzer/results")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [{"pipelineId": "word_analyzer"}])

    @patch("server.write_results")
    @patch("server.read_results", return_value=[])
    @patch("server.ollama_summarize", side_effect=OllamaError("unexpected"))
    @patch("server.execute_named_pipeline")
    @patch("server.read_pipelines")
    def test_agent_result_survives_ollama_error(self, read_pipelines, execute, _ollama, _read_results, write_results):
        read_pipelines.return_value = [self.pipeline]
        execute.return_value = self.output

        response = self.client.post(
            "/api/pipelines/word_analyzer/run",
            json={"query": "тест", "useOllama": True},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["ollama"]["status"], "error")
        write_results.assert_called_once()

    def test_api_info_returns_process_meta(self):
        response = self.client.get("/api/info")

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["service"], "alephy-agents")
        self.assertIn("pid", body)
        self.assertIn("python", body)
        self.assertIn("uptime", body)

    def test_lab_index_is_served(self):
        response = self.client.get("/apps/researchlab/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"researchlab", response.data.lower())

    def test_lab_static_asset_is_served(self):
        response = self.client.get("/apps/researchlab/js/agent-server.js")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"AgentServer", response.data)

    def test_lab_path_traversal_blocked(self):
        response = self.client.get("/../../CLAUDE.md")
        self.assertEqual(response.status_code, 404)

    def test_lab_shutdown_noop_in_testing(self):
        response = self.client.post("/api/lab/shutdown")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["testing"])

    def test_lab_restart_noop_in_testing(self):
        response = self.client.post("/api/lab/restart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["testing"])

    def test_cors_headers_present_by_default(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), "*")


    @patch("server.write_results")
    @patch("server.read_results", return_value=[])
    @patch("server.execute_named_pipeline", side_effect=ValueError("Неизвестный пайплайн: custom"))
    @patch("server.read_pipelines")
    def test_custom_pipeline_without_runner_falls_back_to_agent_names(self, read_pipelines, execute, _read_results, write_results):
        """Кастомный пайплайн из UI (без Python-раннера) исполняется по русским именам."""
        read_pipelines.return_value = [{
            "id": "custom-ui",
            "runner": "custom-ui",
            "name": "Кастомный",
            "agents": ["Исследователь", "Критик", "Сборщик"],
        }]

        response = self.client.post("/api/pipelines/custom-ui/run", json={"query": "разбор Давар"})

        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(body["trace"][0], "researcher")
        self.assertIn("collector", body["trace"])
        write_results.assert_called_once()


class DeletePipelineResultTest(unittest.TestCase):
    """Удаление одного прогона из истории: 404 на чужом id, запись без него."""

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    @patch("server.write_results")
    @patch("server.read_results")
    def test_deletes_single_result(self, read_results, write_results):
        read_results.return_value = [
            {"id": "word_analyzer-1", "pipelineId": "word_analyzer"},
            {"id": "word_analyzer-2", "pipelineId": "word_analyzer"},
        ]
        response = self.client.delete("/api/pipeline-results/word_analyzer-1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"deleted": "word_analyzer-1"})
        write_results.assert_called_once_with(
            [{"id": "word_analyzer-2", "pipelineId": "word_analyzer"}])

    @patch("server.write_results")
    @patch("server.read_results", return_value=[])
    def test_unknown_result_is_404(self, _read, _write):
        response = self.client.delete("/api/pipeline-results/no-such-run")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
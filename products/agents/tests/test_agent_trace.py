"""Проверка сохранённого, а не скрытого, следа агентов."""
import sys
import unittest
from pathlib import Path


AGENTS_DIR = Path(__file__).resolve().parents[1]
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

from agents.common import packet, record  # noqa: E402


class AgentTraceTest(unittest.TestCase):
    def test_record_keeps_input_and_explicit_output(self):
        data = record(packet("проверка", source="локальный корпус"), "collector", result={"title": "Итог"})

        step = data["agentTrace"][0]
        self.assertEqual(step["agentId"], "collector")
        self.assertEqual(step["input"]["source"], "локальный корпус")
        self.assertEqual(step["output"]["result"]["title"], "Итог")
        self.assertEqual(step["observations"][0]["field"], "result")


"""Проверка аудита канона: агент обязан ловить именно те дефекты, что описаны в §4.1a."""
import sys
import tempfile
import unittest
from pathlib import Path

AGENTS_DIR = Path(__file__).resolve().parents[1]
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

from agents import frontend  # noqa: E402
from agents.common import packet  # noqa: E402

CANONICAL = """
.module .xx-cell .xx-cell-title {
  margin: 0;
  padding: 0;
  border-bottom: 0;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: var(--ui-11);
  font-weight: 700;
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
}
"""


def rules_of(problems):
    return {problem["rule"] for problem in problems}


class CanonTitleTest(unittest.TestCase):
    def test_canonical_title_has_no_findings(self):
        self.assertEqual(frontend.audit_title(".module .xx-cell .xx-cell-title", CANONICAL), [])

    def test_missing_reset_is_reported_as_dash(self):
        broken = CANONICAL.replace("border-bottom: 0;", "")
        self.assertIn("§4.1a чёрка", rules_of(frontend.audit_title(".module .xx-cell .xx-cell-title", broken)))

    def test_missing_module_is_reported_as_specificity(self):
        broken = CANONICAL.replace(".module ", "", 1)
        self.assertIn("§4.1a специфичность", rules_of(frontend.audit_title(broken, CANONICAL)))

    def test_own_font_size_is_reported(self):
        broken = CANONICAL.replace("var(--ui-11)", "var(--text-md)")
        self.assertIn("§4.1a размер", rules_of(frontend.audit_title(".module .xx-cell .xx-cell-title", broken)))

    def test_weight_600_is_reported(self):
        broken = CANONICAL.replace("font-weight: 700;", "font-weight: 600;")
        self.assertIn("§4.1a вес", rules_of(frontend.audit_title(".module .xx-cell .xx-cell-title", broken)))

    def test_heading_font_is_reported(self):
        broken = CANONICAL.replace("var(--font-ui)", "var(--font-heading)")
        self.assertIn("§4.1a шрифт", rules_of(frontend.audit_title(".module .xx-cell .xx-cell-title", broken)))

    def test_tracking_literal_is_reported(self):
        broken = CANONICAL.replace("var(--tracking-caps)", ".08em")
        self.assertIn("§4.1a трекинг", rules_of(frontend.audit_title(".module .xx-cell .xx-cell-title", broken)))

    def test_font_shorthand_counts_as_canonical(self):
        """Однострочные правила learn.css пишут font: — шорткат тоже канон."""
        shorthand = ".module .lr-cell .lr-cell-title { margin:0; padding:0; border-bottom:0;" \
                    " font:700 var(--ui-11)/1.3 var(--font-ui); letter-spacing:var(--tracking-caps); }"
        self.assertEqual(frontend.audit_title(".module .lr-cell .lr-cell-title", shorthand), [])

    def test_ink_recolor_is_not_a_title_declaration(self):
        """Вариант для ink-ячейки перекрашивает лейбл, а не объявляет его."""
        report = frontend.audit_lab(tempdir_with(".module .xx-cell--ink .xx-cell-title { color: red; }"))
        self.assertEqual(report["titles"], 0)


def tempdir_with(css: str) -> Path:
    directory = Path(tempfile.mkdtemp())
    (directory / "sample.css").write_text(css, encoding="utf-8")
    return directory


class AuditLabTest(unittest.TestCase):
    def test_counts_titles_and_violations(self):
        report = frontend.audit_lab(tempdir_with(CANONICAL))
        self.assertEqual(report["titles"], 1)
        self.assertEqual(report["clean"], 1)
        self.assertEqual(report["violations"], 0)

    def test_missing_directory_is_not_a_crash(self):
        report = frontend.audit_lab(Path(tempfile.gettempdir()) / "alephy-no-such-css-dir")
        self.assertEqual(report["files"], 0)
        self.assertEqual(report["violations"], 0)

    def test_prepare_keeps_trace_and_contract(self):
        data = frontend.prepare(packet("аудит bento-заголовков"))
        step = data["agentTrace"][-1]
        self.assertEqual(step["agentId"], "frontend_developer")
        self.assertIn("frontend", step["observations"][0]["field"])
        self.assertTrue(data["frontend_contract"]["boundaries"])
        self.assertTrue(data["frontend_tasks"])

    def test_summary_follows_the_question(self):
        dashes = frontend.prepare(packet("проверь чёрки под заголовками"))
        self.assertIn("Чёрки", dashes["frontend_summary"])


class SourceInfoTest(unittest.TestCase):
    def test_source_points_at_real_file(self):
        info = frontend.source_info()
        self.assertTrue(info["path"].endswith("agents/frontend.py"))
        self.assertGreater(info["lines"], 1)


class PassportTest(unittest.TestCase):
    def test_generated_passport_is_fresh(self):
        """Паспорт собирается из модуля агента, поэтому --check обязан быть зелёным."""
        script = Path(__file__).resolve().parents[3] / "tools" / "generate-agent-passports.py"
        if not script.exists():
            self.skipTest("генератор паспортов не найден")
        import subprocess
        result = subprocess.run(
            [sys.executable, str(script), "--check"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_passport_has_technical_blocks(self):
        target = (Path(__file__).resolve().parents[3] / "products" / "website" / "apps"
                  / "researchlab" / "data" / "agents" / "frontend-developer.json")
        if not target.exists():
            self.skipTest("паспорт не собран")
        import json
        payload = json.loads(target.read_text(encoding="utf-8"))
        self.assertTrue(payload["contract"]["boundaries"])
        self.assertTrue(payload["canon"]["rules"])
        self.assertTrue(payload["tasks"])
        self.assertTrue(payload["module"]["functions"])
        self.assertEqual(payload["module"]["entrypoint"], "frontend.prepare(data)")
        # Исходник в статику не копируется: его отдаёт сервер.
        self.assertNotIn("source", payload)

    def test_canon_scope_is_repo_relative(self):
        """Путь области аудита должен быть относительным: абсолютный путь
        машины автора в интерфейсе бессмысленен и обрезается в ячейке."""
        target = (Path(__file__).resolve().parents[3] / "products" / "website" / "apps"
                  / "researchlab" / "data" / "agents" / "frontend-developer.json")
        if not target.exists():
            self.skipTest("паспорт не собран")
        import json
        payload = json.loads(target.read_text(encoding="utf-8"))
        scope = payload["canon"]["scope"]
        self.assertFalse(scope.startswith("/"), scope)
        self.assertNotIn(":", scope, "путь не должен содержать диск Windows")
        self.assertTrue(scope.endswith("researchlab/css"), scope)

    def test_run_endpoint_accepts_named_agent(self):
        """Агент запускается по имени из паспорта, а не по пайплайну запроса.

        Без этой ветки /run уходил в ROUTES, где только пайплайны, и
        фронтенд-разработчик был недостижим из интерфейса.
        """
        import server
        with server.app.test_client() as client:
            response = client.post("/api/run", json={
                "query": "аудит bento-заголовков",
                "agent": "Фронтенд-разработчик",
            })
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertIn("frontend", payload)
            self.assertIn("frontend_summary", payload)
            self.assertGreater(payload["frontend"]["titles"], 0)

    def test_run_endpoint_rejects_unknown_agent(self):
        import server
        with server.app.test_client() as client:
            response = client.post("/api/run", json={"query": "аудит", "agent": "нет-такого"})
            self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
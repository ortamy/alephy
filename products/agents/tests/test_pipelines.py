"""Контрактные тесты движка: линейные цепочки, циклы, новые пайплайны."""
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from agents import arch_critic, arch_writer

AGENTS_DIR = Path(__file__).resolve().parents[1]
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

from agents.common import packet, record  # noqa: E402
from agents.convergence import converge  # noqa: E402
from agents.paleo_translator import translate  # noqa: E402
from agents.critic import critique  # noqa: E402
from agents.verifier import verify  # noqa: E402
from pipelines.core import run_steps, run_loop  # noqa: E402


class EmptyStepTest(unittest.TestCase):
    """Линейная цепочка останавливается на пустом результате."""

    def test_stops_on_none(self):
        def dead(_data):
            return None

        data = run_steps(packet("тест"), [dead, critique])
        self.assertIsNone(data)

    def test_stops_on_empty_dict(self):
        def dead(_data):
            return {}

        data = run_steps(packet("тест"), [dead, critique])
        self.assertEqual(data, {})

    def test_runs_until_finish(self):
        data = run_steps(packet("тест"), [critique])
        self.assertIn("critique_notes", data)
        self.assertIn("critic", data["trace"])


class LoopEngineTest(unittest.TestCase):
    """Цикл сходится, не сходится со stall, уважает max_iterations."""

    def test_converges_on_stable_signature(self):
        steps = (critique, verify)
        data = run_loop(packet("тест", term="тест"),
                        cycle_steps=steps, converge_step=converge, max_iterations=5)
        self.assertTrue(data["converged"])
        self.assertFalse(data["convergence"]["stalled"])
        self.assertGreaterEqual(len(data["convergence_history"]), 2)

    def test_stalls_when_never_converging(self):
        def restless(data):
            # Каждый виток меняет поле, входящее в подпись → подпись вечно новая.
            data["critique"] = "шум №%d" % data.get("iteration", 0)
            return data

        data = run_loop(packet("тест"),
                        cycle_steps=(restless,), converge_step=converge, max_iterations=3)
        self.assertFalse(data["converged"])
        self.assertTrue(data["convergence"]["stalled"])
        self.assertEqual(len(data["convergence_history"]), 3)

    def test_shmita_reset_keeps_protected_fields(self):
        steps = (critique, verify)
        data = run_loop(packet("тест", term="схема", gaps=["A"]),
                        cycle_steps=steps, converge_step=converge, max_iterations=5,
                        shmita_every=2, reset_fields=["exposures"])
        self.assertGreaterEqual(data.get("shmita_resets"), 1)
        self.assertIn("query", data)
        self.assertIn("trace", data)

    def test_agent_trace_has_iteration(self):
        steps = (critique, verify)
        data = run_loop(packet("тест"),
                        cycle_steps=steps, converge_step=converge, max_iterations=3)
        iterations = {item.get("iteration") for item in data["agentTrace"]}
        self.assertTrue(iterations.intersection({1, 2}))
class LinearityWithPaleoTest(unittest.TestCase):
    """Новые линейные пайплайны возвращают след и результат."""

    def _assert_ok(self, output):
        self.assertTrue(output.get("trace"))
        self.assertTrue(output.get("agentTrace"))
        self.assertIn("result", output)
        self.assertIn("title", output["result"])

    def test_paleo_translation(self):
        from pipelines.paleo_translation import run
        self._assert_ok(run("обратный перевод Давар"))

    def test_research_audit(self):
        from pipelines.research_audit import run
        self._assert_ok(run("проверь отчёт Давар"))

    def test_mechanism_scanner(self):
        from pipelines.mechanism_scanner import run
        self._assert_ok(run("сканер подмен Давар"))

    def test_verse_reconstruction(self):
        from pipelines.verse_reconstruction import run
        self._assert_ok(run("реконструируй стих Берешит 1:1"))


class LoopPipelinesTest(unittest.TestCase):
    """Циклические пайплайны возвращают iteration-след."""

    def _assert_loop(self, output):
        self.assertIn("iterations", output["result"])
        self.assertIn("converged", output["result"])

    def test_critique_loop(self):
        from pipelines.critique_loop import run
        output = run("самокритика Давар")
        self.assertTrue(output["trace"])
        self._assert_loop(output)

    def test_gap_cycle(self):
        from pipelines.gap_cycle import run
        output = run("карантин пропусков Слово")
        self.assertIn("gaps", output["result"])
        self._assert_loop(output)

    def test_spiral_swiva(self):
        from pipelines.spiral_swiva import run
        output = run("хук свива Давар")
        # Спираль сходится: горизонт исчерпан и подпись стабилизируется.
        self.assertTrue(output["result"]["converged"])
        self.assertIn("horizon", output["result"]["data"])
        self._assert_loop(output)

    def test_dialectic_loop(self):
        from pipelines.dialectic_loop import run
        self._assert_loop(run("диалектика стиха Берешит 1:1"))

    def test_midrash_recursion(self):
        from pipelines.midrash_recursion import run
        output = run("мидраш слова Берешит")
        # Палео-образ лежит в data результата; цикл сходится на стабильном образе.
        self.assertIn("paleo_image", output["result"]["data"])
        self.assertTrue(output["result"]["converged"])
        self._assert_loop(output)

    def test_shmita_loop(self):
        from pipelines.shmita_loop import run
        output = run("шмита слова Давар")
        self._assert_loop(output)
        self.assertIn("shmita_resets", output["result"])


class ArchKeeperTest(unittest.TestCase):
    """Смотритель архитектуры: дрейф виден, ручной текст не страдает."""

    def test_dry_run_reports_drift_without_writing(self):
        from pipelines.arch_keeper import run
        output = run("проверь архитектуру")
        self.assertTrue(output["trace"])
        self._drift_shape(output)

    def test_blocks_cover_reality(self):
        from agents.arch_scanner import collect_facts
        from agents.arch_writer import BLOCKS, render_blocks
        blocks = render_blocks(collect_facts())
        self.assertEqual(sorted(blocks), sorted(BLOCKS))
        for lines in blocks.values():
            self.assertTrue(lines)

    def test_manual_text_is_never_touched(self):
        from agents.arch_writer import marker, replace_blocks
        text = "\n".join([
            "ручной текст",
            marker("repo-map")[0],
            "старый блок",
            marker("repo-map")[1],
            "хвост документа",
        ])
        updated = replace_blocks(text, {"repo-map": ["новый блок"]})
        self.assertIn("ручной текст", updated)
        self.assertIn("хвост документа", updated)
        self.assertNotIn("старый блок", updated)
        self.assertIn("новый блок", updated)

    def test_missing_block_is_high_severity(self):
        from agents.arch_writer import diff_blocks
        report = diff_blocks("документ без маркеров", {"repo-map": ["строка"]})
        self.assertEqual(report[0]["state"], "missing")
        self.assertEqual(report[0]["severity"], "high")

    def test_first_iteration_is_not_converged(self):
        from agents.arch_convergence import converge
        from agents.common import packet
        data = converge(packet("проверь архитектуру", arch_digest="a", arch_doc_digest="b",
                               arch_drift=[{"block": "repo-map", "state": "stale"}]))
        self.assertFalse(data["converged"])
        self.assertEqual(data["convergence"]["status"], "поток")

    def test_engine_and_endpoints_are_not_drift(self):
        """Движок цепочек и эндпоинты server.py — не пайплайны-карточки."""
        from agents.arch_scanner import collect_facts
        agents = collect_facts()["agents"]
        self.assertNotIn("core", agents["pipelines"])
        self.assertIn("core", agents["engines"])
        self.assertIn("scripture_analysis", agents["endpoints"])
        self.assertNotIn("scripture_analysis", agents["drift"]["uncarded"])

    def test_registry_drift_is_empty_in_clean_repo(self):
        from agents.arch_scanner import collect_facts
        drift = collect_facts()["agents"]["drift"]
        for kind, items in drift.items():
            self.assertEqual(items, [], "неожиданный дрейф реестров: " + kind)

    def _drift_shape(self, output):
        data = output["result"]["data"]
        self.assertIn("arch_drift", data)
        self.assertIn("arch_status", data)
        self.assertIn("converged", output["result"])


class ArchGraphTest(unittest.TestCase):
    """Схема GRAPH.md — тоже источник правды, и тоже проверяется."""

    GRAPH = "\n".join([
        "```mermaid",
        "    Lab[Research Lab<br/>apps/researchlab/index.html]",
        "    Router[LabRouter<br/>js/router.js]",
        "```",
        "- `#dashboard` — рабочий стол.",
        "- `#workbench/run/<id>` — запуск пайплайна.",
    ])

    def test_node_path_is_parsed(self):
        from agents.arch_critic import parse_graph_nodes
        self.assertEqual(parse_graph_nodes(self.GRAPH),
                         ["apps/researchlab/index.html", "js/router.js"])

    def test_subroute_reduces_to_module_root(self):
        from agents.arch_critic import parse_graph_routes
        self.assertEqual(parse_graph_routes(self.GRAPH), ["dashboard", "workbench"])

    def test_dead_node_lands_in_adr_basket(self):
        """Мёртвый узел схемы — архитектурное решение, а не арифметика."""
        from agents.arch_planner import classify
        for metric in ("graph_node", "route"):
            proposal = classify({"metric": metric, "stated": "x", "actual": None})
            self.assertEqual(proposal["basket"], "adr", metric)

    def test_current_graph_and_routes_are_clean(self):
        """Разбор не должен быть молчащим: он обязан видеть узлы схемы."""
        from agents.arch_critic import GRAPH_DOC, check_graph, check_routes, parse_graph_nodes, \
            parse_graph_routes
        graph = GRAPH_DOC.read_text(encoding="utf-8")
        # Узлов схемы больше, чем проверяемых: часть помечает слой без файла
        # (`Docs[docs/00-START + docs/06-METHODOLOGY]`). Проверяются те, где
        # назван конкретный файл, — иначе проверка молчала бы на половине схемы.
        self.assertGreaterEqual(len(parse_graph_nodes(graph)), 6)
        self.assertGreaterEqual(len(parse_graph_routes(graph)), 5)
        self.assertEqual(check_graph(), [])
        self.assertEqual(check_routes(), [])


class ArchCanaryTest(unittest.TestCase):
    """Канарейка: система обязана замечать подложенный дрейф.

    Проверка «сейчас чисто» доказывает лишь отсутствие находок, а не
    способность их находить: уже дважды проверка молчала — из-за неверного
    пути к документу и из-за опечатки в ключе. Поэтому дрейф создаётся
    намеренно, во временных копиях, и агент обязан его увидеть.
    """

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.orig_arch = arch_critic.ARCHITECTURE_DOC
        self.orig_graph = arch_critic.GRAPH_DOC
        self.orig_agent = arch_critic.AGENT_DOC
        self.addCleanup(self._restore)

    def _restore(self):
        arch_critic.ARCHITECTURE_DOC = self.orig_arch
        arch_critic.GRAPH_DOC = self.orig_graph
        arch_critic.AGENT_DOC = self.orig_agent

    def _use_documents(self, text, graph=None, agent=None):
        path = self.tmp / "ARCHITECTURE.md"
        path.write_text(text, encoding="utf-8")
        arch_critic.ARCHITECTURE_DOC = path
        graph_path = self.tmp / "GRAPH.md"
        graph_path.write_text(graph or "", encoding="utf-8")
        arch_critic.GRAPH_DOC = graph_path
        agent_path = self.tmp / "AGENT-ARCHITECTURE.md"
        agent_path.write_text(agent or "", encoding="utf-8")
        arch_critic.AGENT_DOC = agent_path

    def test_wrong_count_is_caught(self):
        self._use_documents("В наборе 9999 корней.")
        text = (self.tmp / "ARCHITECTURE.md").read_text(encoding="utf-8")
        findings = arch_critic.check_claims(text, arch_critic.collect_facts()["metrics"])
        self.assertEqual([f["metric"] for f in findings], ["roots"])
        self.assertEqual(findings[0]["stated"], 9999)

    def test_missing_path_is_caught(self):
        self._use_documents("Сборка: `products/website/tools/нет-такого.sh`.")
        findings = arch_critic.critique({"query": "t"})
        self.assertTrue(any(item["metric"] == "path" for item in findings["critique_findings"]))

    def test_dead_graph_node_is_caught(self):
        self._use_documents("Паспорт.", graph="```mermaid\n    X[Слой<br/>js/выдуманный.js]\n```")
        findings = arch_critic.critique({"query": "t"})
        self.assertTrue(any(item["metric"] == "graph_node"
                            for item in findings["critique_findings"]))

    def test_ghost_route_is_caught(self):
        # Маршруты в реестре латинские: кириллица в шаблоне не совпала бы
        # и канарейка прошла бы вхолостую.
        self._use_documents("Паспорт.", graph="- `#ghost-hub` — нет такого.")
        findings = arch_critic.critique({"query": "t"})
        self.assertTrue(any(item["metric"] == "route"
                            for item in findings["critique_findings"]))

    def test_missing_module_in_agent_doc_is_caught(self):
        self._use_documents("Паспорт.", agent="Служебные роли: `fantasy_agent.py`.")
        findings = arch_critic.critique({"query": "t"})
        self.assertTrue(any(item["metric"] == "agent_module"
                            for item in findings["critique_findings"]))

    def test_proposal_reaches_planner(self):
        """Находка обязана доходить до планировщика, а не умирать в критике."""
        from agents.arch_planner import plan
        self._use_documents("Паспорт.", graph="- `#ghost-hub` — нет такого.")
        data = plan(arch_critic.critique({"query": "t"}))
        self.assertTrue(data["proposal_buckets"]["adr"])


class ArchReportTest(unittest.TestCase):
    """Находки не должны теряться вместе с вкладкой браузера."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.original = arch_writer.REPORT_DOC
        arch_writer.REPORT_DOC = Path(self.tmp) / "ARCH-DRIFT.md"
        self.addCleanup(lambda: setattr(arch_writer, "REPORT_DOC", self.original))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def _clean(self):
        return {"critique_findings": [], "arch_drift": [], "proposals": []}

    def test_clean_run_writes_nothing(self):
        """Молчание — здоровье: пустой прогон не трогает репозиторий."""
        result = arch_writer.write_report(self._clean())
        self.assertFalse(result["written"])
        self.assertFalse(arch_writer.REPORT_DOC.exists())

    def test_finding_produces_report(self):
        data = {"critique_findings": [{"metric": "css", "stated": 67, "actual": 87}],
                "arch_drift": [], "proposals": [{"bucket": "auto", "metric": "css",
                                                 "evidence": "67 CSS-файлов", "stated": 67,
                                                 "actual": 87, "action": "исправить число на 87"}]}
        self.assertTrue(arch_writer.write_report(data)["written"])
        text = arch_writer.REPORT_DOC.read_text(encoding="utf-8")
        self.assertIn("67 CSS-файлов", text)
        self.assertIn("исправить число на 87", text)

    def test_report_is_idempotent(self):
        data = {"critique_findings": [{"metric": "css", "stated": 67, "actual": 87}],
                "arch_drift": [], "proposals": [{"basket": "auto", "metric": "css",
                                                 "evidence": "67 CSS-файлов", "stated": 67,
                                                 "actual": 87, "action": "исправить"}]}
        arch_writer.write_report(data)
        first = arch_writer.REPORT_DOC.read_text(encoding="utf-8")
        self.assertFalse(arch_writer.write_report(data)["written"])
        self.assertEqual(arch_writer.REPORT_DOC.read_text(encoding="utf-8"), first)

    def test_clean_run_overwrites_stale_report(self):
        data = {"critique_findings": [{"metric": "css", "stated": 67, "actual": 87}],
                "arch_drift": [], "proposals": [{"basket": "auto", "metric": "css",
                                                 "evidence": "67", "stated": 67, "actual": 87,
                                                 "action": "исправить"}]}
        arch_writer.write_report(data)
        self.assertTrue(arch_writer.write_report(self._clean())["written"])
        self.assertIn("Расхождений нет", arch_writer.REPORT_DOC.read_text(encoding="utf-8"))


class ArchAgentDocTest(unittest.TestCase):
    """Агент проверяет документацию о себе самой — иначе дрейф некуда деться."""

    def test_agent_doc_is_found(self):
        from agents.arch_critic import AGENT_DOC
        self.assertTrue(AGENT_DOC.is_file(), str(AGENT_DOC))

    def test_mentioned_module_must_exist(self):
        from agents.arch_critic import check_agent_doc
        self.assertEqual(check_agent_doc({}), [])

    def test_counts_come_from_disk(self):
        """Метрики агентного слоя обязаны совпадать с реальными файлами."""
        from agents.arch_scanner import AGENTS_ROOT, collect_facts
        metrics = collect_facts()["metrics"]
        modules = [p.stem for p in (AGENTS_ROOT / "agents").glob("*.py")
                   if p.stem != "__init__"]
        self.assertEqual(metrics["agents"], len(modules))

    def test_current_agent_doc_has_no_drift(self):
        from pipelines.arch_keeper import run
        data = run("проверь архитектуру")["result"]["data"]
        self.assertEqual(data.get("critique_count"), 0, data.get("critique_notes"))


class ArchCriticTest(unittest.TestCase):
    """Критик ловит дрейф ручного текста, не подменяя мысль числом."""

    def _text(self, body):
        return "\n".join([
            body,
            "<!-- alephy:auto:repo-map -->",
            "| 999 CSS-файлов |",  # число внутри автоблока проверять нельзя
            "<!-- alephy:auto-end:repo-map -->",
        ])

    def test_matching_number_is_not_a_finding(self):
        from agents.arch_critic import check_claims
        self.assertEqual(check_claims(self._text("в нём 87 CSS-файлов"), {"css": 87}), [])

    def test_stale_number_is_found(self):
        from agents.arch_critic import check_claims
        findings = check_claims(self._text("в нём 67 CSS-файлов"), {"css": 87})
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["stated"], 67)
        self.assertEqual(findings[0]["actual"], 87)

    def test_generated_block_numbers_are_ignored(self):
        from agents.arch_critic import manual_text
        body = manual_text(self._text("в нём 67 CSS-файлов"))
        self.assertNotIn("999", body)
        self.assertIn("67", body)

    def test_relative_path_resolves_from_site_root(self):
        from agents.arch_critic import check_paths
        self.assertEqual(check_paths("запуск: bash tools/build.sh"), [])

    def test_unknown_path_is_a_finding(self):
        from agents.arch_critic import check_paths
        findings = check_paths("см. tools/выдуманный-скрипт.py")
        self.assertEqual(len(findings), 1)

    def test_planner_splits_baskets(self):
        from agents.arch_critic import critique
        from agents.arch_planner import plan
        from agents.common import packet
        data = plan(critique(packet("проверь архитектуру")))
        self.assertIn("auto", data["proposal_buckets"])
        for proposal in data["proposals"]:
            self.assertIn(proposal["basket"], ("auto", "adr", "manual"))
            self.assertTrue(proposal["action"])

    def test_estimate_goes_to_manual(self):
        from agents.arch_planner import classify
        proposal = classify({"metric": "modules", "stated": 50, "actual": 60})
        self.assertEqual(proposal["basket"], "manual")

    def test_current_document_has_no_drift(self):
        from pipelines.arch_keeper import run
        data = run("проверь архитектуру")["result"]["data"]
        self.assertEqual(data.get("critique_count"), 0, data.get("critique_notes"))
        self.assertEqual(data.get("proposal_count"), 0)


class OrchestratorTest(unittest.TestCase):
    def test_unknown_query_raises(self):
        from orchestrator import dispatch
        with self.assertRaises(ValueError):
            dispatch("почини принтер")

    def test_known_routes_exist(self):
        from orchestrator import PIPELINES
        for pipeline_id in ("paleo_translation", "research_audit", "mechanism_scanner",
                            "verse_reconstruction", "critique_loop", "gap_cycle",
                            "spiral_swiva", "dialectic_loop", "midrash_recursion", "shmita_loop",
                            "arch_keeper"):
            self.assertIn(pipeline_id, PIPELINES)


if __name__ == "__main__":
    unittest.main()
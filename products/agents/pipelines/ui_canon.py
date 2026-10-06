"""Пайплайн: Канон интерфейса.

Цепочка: Фронтенд-разработчик → Сборщик.

Агент читает CSS лаборатории с диска и сверяет шапки ячеек bento с каноном
DESIGN-SYSTEM §4.1a. Резюме аудита становится заголовком результата: числа
«сколько заголовков / сколько расхождений» посчитаны по файлам, а не выведены
из запроса.
"""
from agents.common import packet
from agents.frontend import prepare as audit_frontend
from agents.collector import collect
from pipelines.core import run_steps


def run(query):
    data = packet(query)
    data["verify_targets"] = ["query", "frontend", "frontend_summary"]
    data = run_steps(data, (audit_frontend,))
    data["summary"] = data.get("frontend_summary")
    return collect(data)

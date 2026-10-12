#!/usr/bin/env python3
"""Генератор единого реестра агентов: products/agents/data/agents.json.

Структура:
  divisions — разделы (отделы) с набором агентов;
  agents    — словарь {slug: spec} всех исполняемых агентов.

Запуск: python tools/generate-agent-registry.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "products" / "agents" / "data"

AGENT_SPECS = [
    ("researcher", "Исследователь", "research", "researcher", "research", "Claude Sonnet 4", ["собери исследование"]),
    ("semitologist", "Семитолог", "research", "semitologist", "compare", "GPT-4o", ["семитские параллели"]),
    ("exposer", "Разоблачитель", "quality", "exposer", "expose", "GPT-4o", ["разоблачи"]),
    ("editor", "Редактор", "documentation", "editor", "edit", "Claude Haiku 3.5", ["отредактируй"]),
    ("collector", "Сборщик", "orchestration", "collector", "collect", "Claude Haiku 3.5", ["собери"]),
    ("comparator", "Компаратор", "research", "comparator", "compare", "Claude Sonnet 4", ["сравни стих"]),
    ("critic", "Критик", "quality", "critic", "critique", "Claude Sonnet 4", ["критика"]),
    ("verifier", "Проверяющий", "quality", "verifier", "verify", "Claude Sonnet 4", ["проверь"]),
    ("paleo-translator", "Переводчик палео-иврита", "research", "paleo_translator", "translate", "Claude Sonnet 4", ["обратный перевод", "переведи обратно"]),
    ("flow-architect", "Архитектор потока", "orchestration", "flow_architect", "design", "Claude Sonnet 4", ["архитектор потока"]),
    ("liaison", "Связной", "orchestration", "liaison", "relay", "Claude Sonnet 4", ["связной"]),
    ("technical-writer", "Технический писатель", "documentation", "writer", "write", "Claude Sonnet 4", ["опиши"]),
    ("code-reviewer", "Ревьюер кода", "code", "code_reviewer", "review", "Claude Sonnet 4", ["ревью"]),
    ("ai-engineer", "AI-инженер", "code", "ai_engineer", "prepare", "Claude Sonnet 4", ["ai инженер"]),
    ("frontend-developer", "Фронтенд-разработчик", "code", "frontend", "prepare", "Локальный аудит", ["аудит канона"]),
    ("arch-scanner", "Архитектурный сканер", "architecture", "arch_scanner", "scan", "Claude Sonnet 4", ["сканер архитектуры"]),
    ("arch-critic", "Архитектурный критик", "architecture", "arch_critic", "critique", "Claude Sonnet 4", ["критик архитектуры"]),
    ("arch-planner", "Архитектурный планировщик", "architecture", "arch_planner", "plan", "Claude Sonnet 4", ["планировщик архитектуры"]),
    ("arch-writer", "Архитектурный писатель", "architecture", "arch_writer", "write", "Claude Sonnet 4", ["писатель архитектуры"]),
    ("arch-convergence", "Архитектурный сход", "architecture", "arch_convergence", "converge", "Claude Sonnet 4", ["архитектурный сход"]),
]

DIVISIONS = [
    ("orchestration", "Оркестрация", "#b8860b", ["researcher", "collector", "flow-architect", "liaison"],
     "Организуют поток работы: извлекают тему, связывают контекст, сводят итог."),
    ("research", "Исследование", "#2e7d32", ["researcher", "semitologist", "comparator", "paleo-translator"],
     "Извлекают термины, корни, семитские параллели и палео-образы."),
    ("quality", "Контроль качества", "#c62828", ["exposer", "critic", "verifier"],
     "Ищут сдвиги, проверяют методологию и обязательные поля результата."),
    ("documentation", "Документация", "#6a1b9a", ["editor", "collector", "technical-writer"],
     "Приводят черновик к стилю проекта, сводят результат, оформляют отчёт."),
    ("code", "Разработка", "#1565c0", ["ai-engineer", "frontend-developer", "code-reviewer"],
     "Готовят задачи для LLM-инженера, аудитируют канон, ревьюют код."),
    ("architecture", "Архитектура", "#006064", ["arch-scanner", "arch-critic", "arch-planner", "arch-writer", "arch-convergence"],
     "Снимают снимок репозитория, сверяют паспорт с диском, сводят цикл."),
]

CONTRACT = {
    "input": {"type": "dict", "required": ["query"]},
    "output": {"type": "dict", "required": ["trace", "agentTrace", "result"]},
}


def build():
    agents = {}
    for slug, name, division, module, function, model, voice in AGENT_SPECS:
        agents[slug] = {
            "slug": slug,
            "name": name,
            "division": division,
            "module": module,
            "function": function,
            "capabilities": {
                "execution": True,
                "readRepository": True,
                "writesFiles": False,
                "streaming": False,
            },
            "status": "active",
            "model": model,
            "priority": 5,
            "voiceCommands": voice,
            "input": CONTRACT["input"],
            "output": CONTRACT["output"],
        }
    divisions = [
        {
            "id": did,
            "label": dlabel,
            "color": color,
            "agents": dagents,
            "description": desc,
        }
        for did, dlabel, color, dagents, desc in DIVISIONS
    ]
    return {"schemaVersion": "1.0", "divisions": divisions, "agents": agents}


def main() -> int:
    payload = build()
    target = DATA / "agents.json"
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if target.exists() and target.read_text(encoding="utf-8") == text:
        print(f"OK   {target.relative_to(ROOT)}")
        return 0
    target.write_text(text, encoding="utf-8")
    print(f"записан {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

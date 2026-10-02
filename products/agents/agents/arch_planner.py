"""Планировщик: раскладывает находки критика по корзинам решения.

Корзины — не украшение, а разные адресаты:

- `auto` — число или путь, где правда однозначна: человек не решает, а
  исправляет по факту;
- `adr` — расхождение затрагивает решение (структура слоёв, границы), и
  ответ на него неочевиден: нужен заход в `docs/decisions.md`;
- `manual` — утверждение оценочное («около 50 модулей»), где автоматика
  ошиблась бы, подменив мысль числом.

Планировщик формирует предложения, но не применяет их. Право менять паспорт
остаётся у человека и у писателя, который работает только с маркерами.
"""
from __future__ import annotations

from typing import Any, Dict, List

from .common import record

# Показатели, где расхождение — чистая арифметика.
AUTO_METRICS = {"roots", "dictionaries", "terms", "css", "js", "data", "path",
                 "agents", "agent_pipelines", "agent_module"}

# Метрики, где расхождение — решение, а не правка: слой схемы исчез, хаб
# переехал. Ответ («вернуть» / «вывести из схемы») неоднозначен, поэтому
# такие находки адресуются человеку через docs/decisions.md.
ADR_METRICS = {"graph_node", "route"}


def classify(finding: Dict[str, Any]) -> Dict[str, Any]:
    """Определяет корзину и формулирует предложение."""
    metric = finding.get("metric")
    if metric in ADR_METRICS:
        basket = "adr"
        if metric == "graph_node":
            action = "решить судьбу слоя: вернуть узел в схему или вывести его оттуда"
        else:
            action = "сверить хаб с реестром лаборатории и обновить раздел маршрутов"
    elif metric in AUTO_METRICS:
        action = "исправить число на %d" % finding["actual"] if finding.get("actual") \
            else "убрать или восстановить путь"
        basket = "auto"
    else:
        action = "переформулировать без точного числа либо сверить с владельцем раздела"
        basket = "manual"
    return {
        "basket": basket,
        "metric": metric,
        "evidence": finding.get("evidence"),
        "stated": finding.get("stated"),
        "actual": finding.get("actual"),
        "action": action,
    }


def plan(data):
    """Шаг пайплайна: находки → предложения, без записи в документ."""
    findings = data.get("critique_findings") or []
    proposals = [classify(item) for item in findings]
    buckets: Dict[str, List[Dict[str, Any]]] = {"auto": [], "adr": [], "manual": []}
    for proposal in proposals:
        buckets.setdefault(proposal["basket"], []).append(proposal)
    return record(data, "arch_planner", proposals=proposals, proposal_buckets=buckets,
                  proposal_count=len(proposals))
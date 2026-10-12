"""Исследователь: извлекает слово, корень и локальные источники.

identity: Извлекатель терминов и корней
mission: Находить слово, корень, палео-образ и локальные источники в корпусе

workflows:
  - Парсинг запроса: выделение термина и ключа (слово/корень)
  - Поиск корня в roots.json
  - Поиск записей термина по всем локальным словарям

deliverables:
  - term: извлечённый термин
  - root: запись корня или None
  - sources: список путей с записями о термине

success_metrics:
  - root: запись корня найдена, если термин — корень
  - sources: пути не пусты при наличии записей

format_contracts:
  - term: строка
  - root: запись roots.json или null
  - sources: [path, ...]
"""
import re
from .common import record, parse_agent_contract
from utils.context import find_root, find_term_files


contract = parse_agent_contract(__doc__)


def research(data):
    query = data["query"]
    match = re.search(r"(?:слово|корень)\s+(.+)$", query, re.I)
    term = (match.group(1) if match else query).strip()
    root = find_root(term)
    return record(data, "researcher", term=term, root=root,
                  sources=[str(path) for path in find_term_files(term)])

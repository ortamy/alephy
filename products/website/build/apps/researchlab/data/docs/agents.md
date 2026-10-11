# Агенты и пайплайны

Агентный слой — Python-система с Flask API. Единственная точка входа: `products/agents/server.py` на `http://127.0.0.1:5000`.

В лаборатории это видно на маршрутах [#ai-agents](#ai-agents), [#pipelines](#pipelines) и [#agent-server](#agent-server).

## Контракт агента

Каждый исполняемый агент — функция `(data) -> data`: принимает пакет, возвращает обновлённый пакет. У агента нет глобального состояния: он читает пакет и отдаёт пакет.

Полный контракт обмена — пакет, след (`trace` / `agentTrace`) и формы кооперации — описан в репозитории:

- [`docs/03-AI/AGENT-PROTOCOL.md`](https://github.com/ortamy/alephy/blob/main/docs/03-AI/AGENT-PROTOCOL.md)

## Пайплайны

Пайплайны делятся по способу запуска и смешивать их нельзя:

- **карточки** — записи `data/pipelines.json`; запуск через `POST /api/pipelines/<id>/run`;
- **эндпоинт** — разбор писаний своим маршрутом сервера;
- **движок** — `pipelines/core.py`: `run_steps`, `run_loop`, `run_fanout`.

Фактический реестр шагов и порядок — в:

- [`docs/03-AI/AGENT-PIPELINES.md`](https://github.com/ortamy/alephy/blob/main/docs/03-AI/AGENT-PIPELINES.md)

Живой список карточек: [#pipelines](#pipelines). Паспорта агентов: [#ai-agents](#ai-agents).

## Как запустить сервер

Из корня проекта:

```text
python products/agents/server.py
```

Без сервера карточки пайплайнов остаются витриной: запуск и живой след недоступны.

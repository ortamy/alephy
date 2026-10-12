# Реестр агентов и готовые сборки

**Метаданные файла**
- **Файл:** `docs/03-AI/AGENT-REGISTRY.md`
- **Версия:** 1.0
- **Статус:** Активный
- **Назначение:** единый реестр агентов (`agents.json`), расширенный контракт паспорта и готовые сборки пайплайнов — что это и как оно связано.

Простая справка «как работают агенты» живёт в интерфейсе: **Настройки → вкладка «Справка»** (`admin-settings.js → tabAgentsHelp()`). Этот документ — инженерная часть.

---

## 1. Зачем реестр

До реестра описание агента жило в трёх местах, которые вели себя независимо:

| Где | Что |
|---|---|
| `products/agents/orchestrator.py` → `REGISTRY` | идентификатор, раннер, голосовые фразы |
| `products/agents/server.py` → `AGENT_FUNCTIONS` | русское имя → функция (руками) |
| `products/website/apps/researchlab/js/admin-settings.js` → `AGENTS` | карточки UI-настроек |

Добавление агента требовало правки в нескольких файлах — легко забыть одно из них и получить рассинхрон (агент есть в UI, но не в API, или наоборот).

**Единый источник правды:** `products/agents/data/agents.json` — реестр всех 20 исполняемых агентов и 6 разделов (divisions). Из него:

- `server.py` строит `AGENT_FUNCTIONS` / `AGENT_SOURCES` сам (`build_agent_registry()`, импорт модулей через `importlib`);
- `GET /api/agents` отдаёт реестр целиком;
- генератор паспортов берёт оттуда же словарь агентов.

## 2. Структура `agents.json`

```json
{
  "schemaVersion": "1.0",
  "divisions": [
    { "id": "research", "label": "Исследование", "color": "#2e7d32",
      "agents": ["researcher", "semitologist", "comparator", "paleo-translator"],
      "description": "…" }
  ],
  "agents": {
    "researcher": {
      "slug": "researcher",
      "name": "Исследователь",
      "division": "research",
      "module": "researcher",
      "function": "research",
      "capabilities": { "execution": true, "readRepository": true,
                        "writesFiles": false, "streaming": false },
      "status": "active",
      "model": "Claude Sonnet 4",
      "priority": 5,
      "voiceCommands": ["собери исследование"],
      "input":  { "type": "dict", "required": ["query"] },
      "output": { "type": "dict", "required": ["trace", "agentTrace", "result"] }
    }
  }
}
```

Правила:

- **`module` + `function`** — единственные поля, по которым сервер находит исполняемый код. Если функции нет — сервер падает при старте явно (`ImportError`), а не на первом запросе.
- **`name`** — русское имя, как его шлёт UI (`getAgentMapData()`); именно по нему кастомные пайплайны находят шаг.
- **`divisions`** — «отделы»: группировка агентов по зоне ответственности (Оркестрация, Исследование, Контроль качества, Документация, Разработка, Архитектура). Аналог `divisions.json` из agency-agents.

Реестр генерируется, а не правится руками:

```bash
python tools/generate-agent-registry.py        # пересборка agents.json
python tools/generate-agent-passports.py        # паспорта + манифест UI
```

## 3. Расширенный контракт паспорта

Контракт агента (`agents/common.py → agent_contract()`) теперь состоит из двух частей.

**Человекочитаемая (паспорт):**

| Поле | Что |
|---|---|
| `identity` | роль одной строкой («Аналитик текстовых сдвигов») |
| `mission` | цель агента |
| `workflows` | шаги работы (список) |
| `deliverables` | что выдаёт (артефакты с форматом) |
| `success_metrics` | по каким признакам видно, что задача выполнена |
| `format_contracts` | формат полей вывода — контракт для парсинга |

**Машинная (обмен):** `input`, `output`, `capabilities`, `run`, `boundaries` — как раньше.

### Формат описания в docstring агента

Паспортные поля не дублируются в JSON: они живут в docstring самого модуля и парсятся функцией `parse_agent_contract()`:

```python
"""Разоблачитель: отмечает сдвиги между образом и переводом…

identity: Аналитик текстовых сдвигов
mission: Находить смысловые сдвиги…

workflows:
  - Извлечение палео-образа слова и его перевода
  - Сверка образа с переводом, пометка места сдвига

deliverables:
  - exposures: карта сдвигов [{source, translation, status}]

success_metrics:
  - gaps: карта не пуста, если слово не найдено в roots.json

format_contracts:
  - exposures: [{source, translation, status}] — статус «…»
"""
from .common import record, parse_agent_contract

contract = parse_agent_contract(__doc__)
```

Реализовано на трёх эталонных агентах: `exposer`, `comparator`, `researcher`. Остальные получают контракт по умолчанию (машинная часть); расширение — по мере надобности.

Итог читается в паспорте UI (`data/agents/<slug>.json → contract`) и в `GET /api/agents`.

## 4. Готовые сборки

Аналог «команд под задачу» из agency-agents: не выбирать агентов по одному, а взять собранную цепочку.

- **Данные:** `products/website/apps/researchlab/data/pipeline-templates.json` — 5 шаблонов (глубокое исследование, аудит перевода, саморевизия черновика, аудит архитектуры, ревью кода).
- **API:** `GET /api/pipeline-templates` — отдаёт список.
- **UI:** Настройки → вкладка **«Сборки»**: карточка шаблона → «Создать пайплайн» → `POST /api/pipelines` → карточка появляется в разделе «Пайплайны» (`#pipelines`), где запускается как обычная.

Шаблон — не пайплайн: он только порождает карточку. Косметические поля (`defaultQuery`, `examples`, `tip`, `maxIterations`) проходят в карточку белым списком из `validate_pipeline()`.

Офлайн-поведение: список шаблонов тянется из статического файла (работает без сервера), создание требует запущенного `products/agents/server.py` — ошибка показывается с подсказкой, а не пустым экраном.

## 5. Схема потока данных

```
products/agents/data/agents.json          (реестр: divisions + agents)
        │
        ├─ server.py: build_agent_registry()
        │     ├─ AGENT_FUNCTIONS  (русское имя → функция)
        │     ├─ AGENT_SOURCES    (русское имя → файл модуля)
        │     └─ GET /api/agents  (реестр целиком)
        │
        └─ tools/generate-agent-passports.py
              ├─ data/agents/<slug>.json       (паспорт с контрактом)
              └─ js/agent-passport-manifest.js (реестр UI)

docstring модуля agents/<slug>.py ──parse_agent_contract()──► contract паспорта

data/pipeline-templates.json ──GET /api/pipeline-templates──► вкладка «Сборки»
                                    │ «Создать пайплайн»
                                    ▼
                          POST /api/pipelines ──► data/pipelines.json ──► #pipelines
```

## 6. Этапы внедрения

| № | Этап | Статус | Что даёт |
|---|---|---|---|
| 1 | Единый реестр `agents.json` + автогенерация карт сервера | сделано | один источник вместо трёх списков |
| 2 | Расширенный контракт (`identity/mission/workflows/deliverables/success_metrics/format_contracts`) | сделано (3 эталонных агента) | паспорт объясняет агента человеку и LLM |
| 3 | Готовые сборки: данные + API + вкладка «Сборки» | сделано | команда под задачу в один клик |
| 4 | Справка в настройках («Как работают агенты») | сделано | простой уровень объяснения в UI |
| 5 | Документация (этот файл, правки связанных) | сделано | следующий человек понимает систему |
| 6 | Перенос `admin-settings.js → AGENTS` из реестра | отложено | UI-карточки всё ещё локальный список в JS |
| 7 | Остальные агенты → docstring-контракты | по мере надобности | расширенный паспорт для всех |

Пункты 6–7 осознанно не делались в первую очередь: реестр уже закрыл рассинхрон сервера, а ручной список UI-карточек (`admin-settings.js → AGENTS`) — меньший риск, чем переписывание вкладки «Агенты».

## 7. Как добавить агента

1. Создать модуль `products/agents/agents/<slug>.py`: функция `data -> data`, вызов `record(...)`, docstring с контрактом (§3).
2. Записать агента в `tools/generate-agent-registry.py → AGENT_SPECS` (там же генерируется `agents.json`).
3. `python tools/generate-agent-registry.py`
4. `python tools/generate-agent-passports.py`
5. Проверка: `python -m unittest discover -s products/agents/tests`

## Связанные документы

- [AGENT-PROTOCOL.md](AGENT-PROTOCOL.md) — контракт обмена: пакет, след, формы кооперации.
- [AGENT-PIPELINES.md](AGENT-PIPELINES.md) — реестр пайплайнов и карточек.
- [AGENT-ARCHITECTURE.md](AGENT-ARCHITECTURE.md) — устройство агентного слоя.
- `products/agents/data/agents.json` — сам реестр.
- `products/website/apps/researchlab/data/pipeline-templates.json` — готовые сборки.
- `tools/generate-agent-registry.py`, `tools/generate-agent-passports.py` — генераторы.


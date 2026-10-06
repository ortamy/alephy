# Архитектура проекта «Алефи»

> **Назначение:** актуальный архитектурный паспорт проекта. Документ описывает действующие границы систем, точки входа, потоки данных и правила изменения исходников.
>
> **Актуальность:** 2 сентября 2026 года.
>
> **Методологическая опора:** `docs/00-START/MANIFEST.md`. Архитектура должна сохранять различие между исходным данным, рабочей гипотезой и производным представлением.

## 1. Принцип разделения слоёв

- `docs/` — методология, предметная модель, решения и инструкции.
- `products/` — исполняемые продукты: публичный сайт, Research Lab и агентная система.
- `tools/` — проверки, генераторы, сборка и операционная автоматизация.
- `build/` — производная копия сайта для деплоя. Не является источником правок.
- `archive/` — исторический слой. Не использовать как активную зависимость без проверки.
- `tasks/` и `epics/` — рабочее планирование, а не исполняемый код.

Канонический порядок изменения:

```text
исходники → проверка → tools/build.sh → build/ → деплой
```

`build/` коммитится в репозиторий (его читает Pages), поэтому расхождение
с исходниками — реальный класс багов: отлаживаешь одну копию, а пользователю
уезжает другая. Паритет держит гейт `python tools/check-build-sync.py`
(шаг `Check build parity` в `.github/workflows/docs-check.yml`): отсутствующий,
изменившийся или лишний файл валит CI. Правь всегда `apps/researchlab/`,
затем пересобирай.

## 2. Карта репозитория

```text
alephy/
├── .agents/                 # настройки служебных AI-агентов
├── .claude/                 # локальные инструкции и навыки
├── .github/                 # CI/CD и GitHub Pages
├── archive/                 # исторические материалы
├── docker/                  # изолированная среда запуска
├── docs/                    # документация и методология
├── epics/                   # крупные направления
├── products/
│   ├── agents/              # Python API и агентные пайплайны
│   ├── neuro/               # нейросетевой контур и данные обучения
│   └── website/             # публичный сайт и Research Lab
├── tasks/                   # текущие задачи
├── tools/                   # проверки, генераторы и автоматизация
├── CLAUDE.md                # быстрый контекст для AI-агентов
├── README.md                # общий вход в проект
├── Dockerfile
└── docker-compose.yml
```

## 3. Публичный сайт: `products/website/`

Публичный сайт — статический пергаментный лендинг со сквозной верхней шапкой. Основной экран находится в корневом `index.html`; отдельная модульная логика вынесена в `app.js` и `src/js/`.

```text
products/website/
├── index.html               # канонический публичный лендинг
├── app.js                   # логика текстового интерфейса сайта
├── src/
│   ├── content/             # HTML/Markdown-контент корпуса
│   ├── data/                # данные публичных страниц
│   ├── js/                  # модули публичного интерфейса
│   ├── locales/             # локализации
│   ├── pages/               # дополнительные статические страницы
│   └── styles/input.css     # вход Tailwind-сборки
├── assets/                  # изображения, иконки и шрифтовые ресурсы
├── config/                  # конфигурация генераторов и сборки
├── apps/researchlab/        # Research Lab SPA
├── docs/                    # документация продуктового слоя
├── tools/build.sh           # полный pipeline сборки сайта
├── package.json             # frontend-зависимости и build-команда
└── build/                   # производный deploy-слой
```

### Реестр модулей

`js/module-registry.js` — единственный источник правды по маршрутам лаборатории.
Раньше список жил отдельно в `router.js` (`routedModules`), а рендеринг — в
`switch` внутри `page-controller.js`; расхождение между ними не ловилось ничем,
и маршрут мог «исчезнуть» молча.

```text
{ id: 'vision', kind: 'panel' }                    → рендерится кодом в page-controller
{ id: 'club', kind: 'panel', nav: { section: 'top', icon: 'footprints' } }
{ id: 'exposure-bavelisms', kind: 'markdown',      → документ: источник объявлен в doc
  doc: { collection: 'exposures', key: 'bavelisms' } }
```

- `nav` — точка входа в сайдбаре: секция и иконка. `NAV_SECTIONS` задаёт порядок
  секций и i18n-ключи заголовков. Отсутствие `nav` значит, что модуль живёт
  прямым маршрутом (хаб, палитра, deep-link) — это явное решение, а не забытая ссылка.
- `doc` — источник содержимого для `kind: 'markdown'`: `collection` + `key`
  (запись в файле коллекции) и `docs` (исходный `.md` в репозитории — провенанс,
  гейт проверяет его наличие). `collection: null` — резервное состояние «источник
  в репозитории есть, переноса в `data/` нет»: маршрут показал бы честную плашку
  со ссылкой на хаб группы, а не «Ошибка загрузки». Сейчас таких документов нет:
  весь корпус (41 маршрут) объявлен с коллекцией.
  Page-controller своего списка путей документов не держит — прежняя карта
  `mdPaths` вела в несуществующий каталог `analysis/`, и 41 маршрут был мёртвым.
- `COLLECTIONS` — где лежит корпус и какой модуль его показывает:
  `dictionaries` → `data/dictionaries.json` (хаб `#dictionaries`, ключ открывается
  как `#dictionaries/<key>`), `exposures` → `data/exposures/documents.json`
  (хаб `#exposures`, документ — `#exposure-<key>`), `methodology` →
  `data/methodology/index.json` + каталог `data/methodology/documents/<key>.json`
  (хаб `#methodology`, документ — `#method-<key>`). Коллекция с полем `dir`
  разбита на указатель и тела: хабу нужны только заголовки, а корпус методичек
  в одном файле весил бы больше полумегабайта. Файлы методичек собирает
  `tools/generate-methodology-docs.py` из `docs/06-METHODOLOGY/*.md`, список беря
  из этого же реестра; `--check` ловит расхождение между `docs/` и `data/` в lab
  и build, а гейт полноты требует, чтобы каждый `.md` раздела был либо
  маршрутом реестра, либо служебным файлом из списка (`README.md`, `TEMPLATE.md`).
  Хаб объявлен ровно один раз — здесь.
- `DOC_GROUPS` — префиксы markdown-маршрутов (`dict-`, `exposure-`, `method-`),
  группа и её хаб из `COLLECTIONS`, флаг `index`: список группы рисует карта
  хабов `GROUP_INDEX_HUBS` в `page-controller` (`true`) либо сам модуль
  (`false` — так устроены словари). Гейт требует, чтобы каждый markdown попадал
  ровно в одну группу, поэтому новый префикс без группы не проедет молча.

Реестр также хранит `ALIASES` (`settings` → `admin-settings`,
`research-library` → `researches` и другие), поэтому роутер не держит
собственных веток-редиректов.

**Добавляешь модуль — правишь реестр и рендерер, разметку сайдбара сверяет гейт:**
запись в реестре (`id`, `kind`, для видимого пункта — `nav`, для документа — `doc`),
`case` в `page-controller` и строку в сайдбаре `index.html`
с `data-i18n="lab.nav.<id>"`. Согласованность проверяет гейт:

```bash
node tools/design-baseline/registry-check.mjs
```

Гейт сверяет семь связей, а не одну: реестр ↔ `page-controller` (`case`; своя
карта путей документов в контроллере запрещена), реестр ↔ файлы данных (ключ
документа обязан существовать в файле коллекции, тело документа — на диске,
объявленный исходник — в репозитории), реестр ↔ сайдбар (набор пунктов, секции,
иконки, ключи подписей и заголовков), реестр ↔ группы документов (префикс →
группа → хаб, хаб рендерится и достижим из меню), достижимость списка группы
(запись в `GROUP_INDEX_HUBS` плюс вызов `render`/`mountCollectionIndex`),
полнота `docs/06-METHODOLOGY` (каждый `.md` объявлен маршрутом или служебный)
и отсутствие собственного списка модулей в `lab-search.js` (индекс поиска
строится из реестра, подписи модулей вне сайдбара берёт из `LabHero.targets`).

Восьмая связь — правда витрины `#architecture`: модуль объясняет, как устроен
проект, и перечисляет пути в репозитории, поэтому гейт сверяет каждый путь из
`js/architecture.js` с диском. Иначе переименование файла оставило бы на
экране уверенное описание того, чего больше нет.

Экран `#architecture` — тот же приём, что ADR-004 у дизайн-системы: факты
объявлены в коде рядом с потребителем, без `fetch` и без файла в `data/`.
Статическому справочнику сеть не нужна, а второй источник правды о стеке
разошёлся бы с первым.

Отчёт гейта называет и состояние корпуса документов: сколько маршрутов отдают
данные, сколько источников ещё не перенесено в `data/` и по каким группам.

Падение означает, что пользователь либо не увидит модуль в меню, либо получит
пустую страницу. Тот же гард продублирован в smoke (`describe('module registry')`)
и в CI отдельным шагом.

**Неизвестный хеш** больше не игнорируется: `router.showUnknownRoute()`
показывает сообщение «маршрут не зарегистрирован» и ссылку на рабочий стол.

### Публичный лендинг

`products/website/index.html` содержит:

- hero и адаптивный H1;
- карту утрат;
- механику Мицраима;
- блок Свивы;
- Палео-клуб и waitlist;
- карточки инструментов;
- методологический блок и футер;
- сквозную верхнюю шапку;
- интерактивы лендинга: progress, popover букв, waitlist, кнопку наверх и бесконечную полосу масштаба.

Стили лендинга находятся inline в `index.html`. Это текущая особенность продукта: перед вынесением стилей в отдельный файл нужно обновить сборочный контур и проверить ссылки.

Waitlist работает через адаптер в inline-скрипте:

- если доступен `window.supabase` или `window.supabaseClient`, выполняется `insert` в `waitlist`;
- без клиента используется локальная очередь `localStorage.alephy_waitlist`;
- SQL-схема находится в `products/website/docs/supabase-waitlist.sql`.

## 4. Research Lab SPA

Research Lab — отдельное статическое Vanilla JS-приложение внутри сайта. В текущем состоянии оно содержит 88 CSS-файлов, 83 JS-файла и 131 файл данных. Число модулей берётся из реестра `js/module-registry.js`, а не из ручного перечисления: единственный список маршрутов — источник правды, и его полноту проверяет гейт.

```text
products/website/apps/researchlab/
├── index.html               # HTML-точка входа и список подключений
├── css/                     # базовый слой и стили модулей
├── js/
│   ├── utils.js             # AlephyUtils: канон escapeHtml (первый из js/)
│   ├── module-registry.js   # ModuleRegistry: единственный список маршрутов
│   ├── router.js            # hash-router LabRouter
│   ├── page-controller.js   # центральный рендеринг модулей
│   ├── lab-hero.js          # единая шапка и представления маршрутов
│   ├── root-dictionary.js   # корневой словарь
│   ├── paleo-builder.js     # сборка палео-букв
│   ├── learn.js             # обучение и тренажёр
│   ├── workbench.js         # мастерская конвейеров
│   ├── workbench-pipelines.js # реестр локальных конвейеров
│   ├── board.js             # исследовательская доска
│   ├── clue-generator.js    # генератор цепочек наблюдений
│   ├── translation-comparator.js
│   ├── religionism-checker.js
│   ├── investigation.js
│   └── ...                  # остальные специализированные модули
├── data/                    # JSON-источники и локальные результаты
│   ├── roots/roots.json     # 329 корней в рабочем наборе данных
│   ├── dictionaries.json    # 21 словарь, 1809 терминов
│   ├── learn/               # алфавит и учебные данные
│   ├── methodology/         # карточки методологии
│   ├── scripture/           # корпус текстовых данных
│   ├── pipelines.json       # реестр конвейеров
│   └── pipeline-results.json # локальные результаты конвейеров
├── pages/                   # подключаемые страницы
├── tests/                   # тесты Research Lab
└── tools/                   # локальные проверки приложения
```

### Жизненный цикл маршрута

1. `router.js` разбирает `location.hash` в `module`, `segments`, `params`.
2. `LabRouter.showModule()` создаёт динамический `.module`, если контейнер ещё не существует.
3. `PageController.render()` выбирает renderer по `moduleId` и текущему маршруту.
4. `LabHero.setView()` формирует заголовок текущего представления.
5. `LabRouter.renderBreadcrumbs()` строит цепочку крошек из маршрута.
6. Модуль загружает локальный JSON или вызывает API агентного сервера.

Формат маршрутов:

```text
#<module>
#<module>/<subroute>
#<module>/<subroute>?key=value
```

Примеры:

- `#dashboard`
- `#root-dictionary/search/<query>`
- `#learn/paleo-trainer`
- `#pipelines`
- `#pipelines/<pipeline-id>`
- `#workbench/run/<pipeline-id>`
- `#workbench/project/<run-id>`

`LabRouter` содержит список допустимых модулей и поддерживает переходы через `navigate()`. При добавлении маршрута нужно синхронно проверить `routeTitle()`, `resolveHeroView()`, `PageController.render()` и крошки.

## 5. Данные Research Lab

Основной принцип — local-first:

- статические JSON-файлы поставляются вместе с приложением;
- прогресс обучения и пользовательские черновики сохраняются в браузере;
- результаты пайплайнов сохраняются сервером в `pipeline-results.json`, а интерфейс использует локальный fallback;
- недоступность серверного слоя не должна ломать просмотр локальных модулей.

Основные источники:

- `data/roots/roots.json` — корни и палео-образы;
- `data/roots/root-links.json` — исследовательские и производные связи локального графа корней; графовые глифы используют только палео-иврит/протоханаанейское письмо;
- `data/dictionaries.json` — словари;
- `data/learn/alphabet.json` — 22 буквы;
- `data/methodology/` — карточки методологии;
- `data/scripture/` — текстовый корпус;
- `data/pipelines.json` — описания пайплайнов;
- `data/pipeline-results.json` — сохранённые результаты.

## 6. Агентная система: `products/agents/`

Агентный слой — Python-система с Flask API и исполняемыми пайплайнами.

```text
products/agents/
├── server.py                # Flask API и раздача Research Lab
├── main.py                  # CLI-точка входа
├── orchestrator.py          # выбор и запуск именованных пайплайнов
├── ollama_adapter.py        # локальный редакторский слой
├── agents/                  # специализированные функции агентов
├── pipelines/               # линейные, циклические и спиральные сценарии
├── utils/context.py         # загрузка и поиск данных проекта
└── tests/                   # тесты API, пайплайнов и следов выполнения
```

`server.py`:

- раздаёт `/apps/researchlab/` из `products/website`;
- читает и записывает `data/pipelines.json` и `data/pipeline-results.json`;
- предоставляет проверку состояния сервера;
- запускает именованные пайплайны;
- поддерживает пайплайны, созданные из UI, через `AGENT_FUNCTIONS`;
- возвращает trace и результат выполнения без публикации скрытого внутреннего рассуждения.

Ключевые API:

- `GET /api/health` — состояние сервера;
- `GET /api/info` — процесс и окружение;
- `GET /api/pipelines` — список пайплайнов;
- `GET /api/pipeline-results` — результаты запусков;
- `POST /api/pipelines/<id>/run` — запуск пайплайна (тело: `query`, опционально `writeEnabled` — работает только для `WRITABLE_PIPELINES`);
- `GET /api/pipelines/<id>/results` — история пайплайна;
- `POST /api/pipelines` — создание пайплайна;
- `PUT /api/pipelines/<id>` — изменение пайплайна;
- `DELETE /api/pipelines/<id>` — удаление пайплайна;
- `POST /api/lab/shutdown` и `POST /api/lab/restart` — управление локальным сервером.

## 7. Потоки данных

```text
Пользователь
    ├── публичный сайт products/website/index.html
    │       ├── якорные секции и интерактивы
    │       └── переход в Research Lab
    │
    └── Research Lab
            ├── LabRouter → PageController → модульный renderer
            ├── локальные JSON → словари, корпус, методология, обучение
            ├── localStorage → настройки, прогресс, waitlist, черновики
            └── products/agents/server.py
                    ├── /api/pipelines
                    ├── /api/pipeline-results
                    └── /api/health, /api/info

docs/06-METHODOLOGY/ + products/*/data/
    ↓ контекст и исходные данные
products/agents/agents/ + products/agents/pipelines/
    ↓ trace и результаты
Research Lab → detail-страницы, экспорт JSON/Markdown, локальная история
```

## 8. Сборка и доставка

Каноническая команда:

```text
cd products/website
bash tools/build.sh
```

`tools/build.sh`:

1. очищает `products/website/build/`;
2. копирует корневые файлы сайта;
3. копирует `src/`, `assets/`, `apps/researchlab/`, `tools/` и необходимые документы;
4. устанавливает frontend-зависимости в build-контуре;
5. запускает Tailwind-сборку;
6. повторно кладёт корневой `index.html` в deploy-артефакт.

GitHub Actions вызывает тот же `tools/build.sh`. Любая правка публичного сайта или Research Lab должна завершаться пересборкой и проверкой `build/`.

Docker-контур (`Dockerfile`, `docker-compose.yml`, `docker/`) предназначен для изолированного локального запуска. Секреты и локальные ключи не входят в архитектурный deploy-слой.

## 9. Инструментальный слой

`tools/` — плоский каталог скриптов: подкаталоги генераторов и проверок
в проекте нет, каждый скрипт самодостаточен и запускается из корня.

```text
tools/
├── check-docs.py            # целостность docs/: пути, ссылки, навигация
├── check-build-sync.py      # паритет build/ и исходников Research Lab
├── check-commit.py          # гейт коммита: конвенция, секреты, документация
├── generate-docs-index.py   # генератор INDEX.md и STATS.md
├── generate-methodology-docs.py
├── generate-sitemap.py
├── generate-files-json.py
├── generate-agent-passports.py
├── generate-bereshit-paleo.py
├── generate-paleo-meanings.py
├── i18n-check.py
├── i18n-extract.py
└── phase2-lab-hero.py
```

Автоматические файлы (`tools/cache/`) и артефакты редактора в список не входят:
перед ручной правкой производного файла нужно проверить скрипт, который его
создаёт.

## 10. Правила изменения архитектуры

1. Сначала прочитать `docs/00-START/MANIFEST.md` и этот документ.
2. Определить слой изменения: `docs/`, `products/` или `tools/`.
3. Менять канонические исходники, а не `build/`, cache или временные результаты.
4. Для нового модуля Research Lab обновить HTML-подключение, список маршрутов, `PageController` и общую шапку.
5. Для нового маршрута проверить `parseHash`, `routeTitle`, `resolveHeroView`, renderer и breadcrumbs.
6. Для API-изменений обновить frontend fallback, серверные тесты и документацию агентного слоя.
7. После frontend-правок запустить `tools/build.sh` и проверить производные файлы.
8. После изменений запускать релевантные JS/Python-тесты и `git diff --check`.
9. Не коммитить секреты, `.env`, ключи и персональные локальные данные.
10. При расхождении документа и кода сначала исправить архитектурный паспорт.

## 11. Автоматический контроль архитектуры

Документ разделён на две части: ручную (решения, границы, правила) и
автоматическую (факты о репозитории). Автоматические блоки помечены маркерами
`<!-- alephy:auto:* -->` и перерисовываются агентом «Архитектурный сканер»
пайплайна `arch_keeper` — по снимку диска, без интерпретаций.

Граница намеренная: машина описывает то, что лежит на диске; человек описывает
то, что должно быть. Агент никогда не решает, правильна ли архитектура, —
он показывает расхождение и предлагает перерисовать факты. Правка запускается
явно и только после зелёного `tools/check-docs.py`; по умолчанию пайплайн
работает как аудит дрейфа и документ не трогает.

<!-- alephy:auto:repo-map -->
| слой | файлов | из них кода |
| --- | --- | --- |
| (корень) | 3 | 0 |
| .entire | 1 | 0 |
| docker | 2 | 0 |
| docs | 215 | 0 |
| products | 2547 | 1375 |
| researches | 24 | 0 |
| tasks | 21 | 6 |
| tools | 74 | 46 |
| **всего** | 2887 | — |
<!-- alephy:auto-end:repo-map -->

### 11.1 Точки входа

<!-- alephy:auto:entrypoints -->
| точка входа | состояние |
| --- | --- |
| products/agents/server.py | есть |
| products/agents/main.py | есть |
| products/agents/orchestrator.py | есть |
| products/website/index.html | есть |
| products/website/apps/researchlab/index.html | есть |
| products/website/tools/build.sh | есть |
| tools/check-docs.py | есть |
| tools/check-build-sync.py | есть |
| tools/check-commit.py | есть |
| tools/generate-docs-index.py | есть |
<!-- alephy:auto-end:entrypoints -->

### 11.2 Агентный слой

<!-- alephy:auto:agents -->
| реестр | записей |
| --- | --- |
| модули агентов | 22 |
| пайплайны-карточки | 17 |
| пайплайны-эндпоинты server.py | scripture_analysis |
| движки цепочек | `core` |

Пайплайны: `arch_keeper`, `critique_loop`, `dialectic_loop`, `gap_cycle`, `mechanism_scanner`, `midrash_recursion`, `paleo_translation`, `registry_audit`, `research_audit`, `research_builder`, `scripture_analysis`, `shmita_loop`, `spiral_swiva`, `ui_canon`, `verse_comparator`, `verse_reconstruction`, `witness_council`, `word_analyzer`
<!-- alephy:auto-end:agents -->

## 12. Связанные документы

- [Манифест](../00-START/MANIFEST.md)
- [Индекс документации](../INDEX.md)
- [Архитектура AI-агентов](../03-AI/AGENT-ARCHITECTURE.md)
- [Пайплайны агентов](../03-AI/AGENT-PIPELINES.md)
- [Дорожная карта](../02-MANAGEMENT/ROADMAP.md)
- [Дизайн-система](../10-DESIGN/DESIGN-SYSTEM.md)
- [Документация публичного сайта](../11-PRODUCTS/WEBSITE.md)
- [Документация Research Lab](../11-PRODUCTS/RESEARCH-LAB.md)

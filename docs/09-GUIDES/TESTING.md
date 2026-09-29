# Тестирование проекта «Алефи»

**Файл:** `docs/09-GUIDES/TESTING.md`
**Статус:** актуальный минимум проверки
**Опора:** `docs/01-ARCHITECTURE/ARCHITECTURE.md`

## Автоматические гейты (CI)

Локальные проверки ниже — минимум. Репозиторий держит четыре гейта, каждый
запускается в GitHub Actions и блокирует merge при падении:

| Workflow | Что проверяет | Команда |
|---|---|---|
| `docs-check.yml` | целостность docs + **паритет build** | `python tools/check-docs.py check`, `python tools/check-build-sync.py` |
| `i18n-check.yml` | словари, паритет локалей, рантайм | `python tools/i18n-check.py check`, `node tools/i18n-verify.mjs` |
| `smoke.yml` | unit-тесты + **Playwright: все маршруты лаборатории** | `npm run test:unit`, `npx playwright test` |
| `deploy.yml` | сборка и публикация на Pages | `bash tools/build.sh` |

### unit

`tests/*.test.js` — обычные node-скрипты (`assert` + `vm`, без браузера) для расчётных
модулей: dashboard, lab-search, paleo-battle, root-graph, scripture-reader, workbench.
Идут первым шагом `smoke.yml` — до установки браузеров, поэтому падение видно за секунды.

```bash
cd products/website/apps/researchlab
npm run test:unit                      # все файлы tests/*.test.js
node tests/unit-runner.mjs dashboard   # один файл по фильтру
```

Тест обязан работать без DOM: модули и реестры объявлены UMD
(`typeof window !== 'undefined' ? window : globalThis`), а браузерные глобалы
(`LabPlural`, `AlephyUtils`) берутся через `typeof` и имеют запасной вариант.
Прямое обращение к `window` в модуле роняет headless-прогон.

### smoke

Playwright гоняет реестр маршрутов из `js/module-registry.js` — добавил модуль,
и тест поедет за ним автоматически. Проверяет отсутствие uncaught-ошибок,
мохибейка, горизонтальный overflow на mobile и вечные спиннеры.

```bash
cd products/website/apps/researchlab
npm run test:smoke          # полный прогон
npm run test:smoke:quick    # 8 ключевых маршрутов
SMOKE_QUICK=1 npx playwright test --grep "registered routes"
```

`@playwright/test` объявлен в `apps/researchlab/package.json`, а не в
`products/website/package.json` — `npm ci` нужно выполнять именно там.

**Полный прогон — 96 тестов и около 25 минут.** Перед локальным запуском
закрой висящие процессы: `Get-Process chrome, python | Stop-Process -Force`.
Убитый web-сервер даёт `ERR_CONNECTION_REFUSED` в логе, и тесты падают
как будто сломан модуль — это не регресс. Различить помогает пробник
`node tools/design-baseline/route-probe.mjs <route>`.

### Реестр модулей

`js/module-registry.js` — единственный список маршрутов. Сверяется с
`page-controller` в обе стороны:

```bash
node tools/design-baseline/registry-check.mjs
```

Падение: маршрут есть в реестре, но не рендерится, или наоборот.

### Паритет build

`products/website/build/` — зеркало `apps/researchlab`, а не источник
истины. Источник истины — `apps/researchlab`. Проверка ловит расхождение:

```bash
python tools/check-build-sync.py
```

Файл отсутствует в build, отличается побайтно или остался лишним — гейт
падает с exit 1. После правки исходников: `bash products/website/tools/build.sh`.

## Перед изменением

```bash
git status
```

Определи слой: документация, публичный сайт, Research Lab, Python-агенты или сборка.

## Документы

```bash
git diff --check
```

Проверь локальные ссылки, H1, пути в metadata, старые каталоги и отсутствие секретов.

## JavaScript

```bash
node --check products/website/app.js
node --check products/website/apps/researchlab/js/router.js
node --check products/website/apps/researchlab/js/page-controller.js
```

Для изменённого модуля проверь прямой hash-маршрут, повторный переход, общую шапку, breadcrumbs, JSON и mobile overflow.

## Сайт

```bash
cd products/website
bash tools/build.sh
```

После сборки подними HTTP-сервер из `build/`:

```bash
cd build
python -m http.server 8000
```

Проверь ширины 360, 480, 720 и desktop, сквозную шапку, тему, reduced-motion, waitlist и интерактивы лендинга.

## Research Lab

Проверяй основные маршруты:

```text
#dashboard
#root-dictionary
#learn/paleo-trainer
#pipelines
#pipelines/<id>
#club
#club/<id>
#workbench
#workbench/run/<id>
```

Проверь локальный fallback при недоступном агентном сервере.

## Python-агенты

```bash
python -m unittest discover -s products/agents/tests -p "test_*.py"
```

Минимальные области: линейный/циклический trace, кастомный пайплайн, сохранение результатов, `/api/health` и ошибка Ollama.

## После проверки

```bash
git diff --check
git status
```

Производные файлы должны быть получены сборкой. Временные скриншоты и локальные результаты не добавляй без явного назначения.
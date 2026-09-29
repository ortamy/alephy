# Скрипты и команды проекта «Алефи»

**Файл:** `docs/09-GUIDES/SCRIPTS.md`
**Статус:** актуальный справочник
**Проверено:** 2 сентября 2026 года
**Опора:** `docs/01-ARCHITECTURE/ARCHITECTURE.md`

## Главное правило

Запускай команды из корня репозитория, если путь не помечен иначе. Перед автоматическим изменением файлов проверь `git status` и используй dry-run, если команда его поддерживает.

## Сайт и Research Lab

### Сборка сайта

```bash
cd products/website
bash tools/build.sh
```

Скрипт очищает и пересоздаёт `products/website/build/`, копирует публичный сайт и Research Lab, устанавливает frontend-зависимости и запускает Tailwind.

### Только Tailwind

```bash
cd products/website
npm run build
```

Эта команда обновляет только `products/website/style.css`. Для deploy-артефакта используй `tools/build.sh`.

### Проверка JavaScript-синтаксиса

```bash
node --check products/website/app.js
node --check products/website/apps/researchlab/js/router.js
node --check products/website/apps/researchlab/js/page-controller.js
```

### Проверка интерфейса

Зависимость Playwright находится в `products/website/package.json`. Для страниц, которые загружают JSON через `fetch`, используй HTTP-сервер, а не `file://`.

```bash
cd products/website/build
python -m http.server 8000
```

Проверяй публичный лендинг на ширинах 360, 480, 720 и desktop, а Research Lab — на маршрутах `#dashboard`, `#pipelines` и `#pipelines/<id>`.

## Генераторы

В корне `tools/` сейчас находятся три Python-генератора:

### `generate-bereshit-paleo.py`

```bash
python tools/generate-bereshit-paleo.py --help
```

### `generate-paleo-meanings.py`

```bash
python tools/generate-paleo-meanings.py --help
```

### `generate-sitemap.py`

```bash
python tools/generate-sitemap.py          # перезаписать sitemap.xml (+ build-зеркало)
python tools/generate-sitemap.py --check  # CI-гейт: exit 1 при расхождении
```

Источники URL: корень, `apps/researchlab/index.html`, `src/pages/**` — ровно то,
что публикует `build.sh`. `src/content/html/**` (фрагменты контента) в sitemap
не входят сознательно: у них нет canonical. Дрейф ловят `docs-check.yml` и
`deploy.yml`.

Перед запуском генератора проверь целевые файлы и результат через `git diff`.

## Design Baseline

`tools/design-baseline/` содержит сценарии визуальной проверки и локальную зависимость Playwright. Это отдельный контур, не общий `tools/alephy.py`.

### Проверка рендера сайта без браузера

```bash
node tools/design-baseline/dom-render-check.mjs
```

Скрипт поднимает минимальный DOM, грузит `src/js/parser.js` и `src/js/ui.js` и
прогоняет рендер списка, крошек, селектов и related-ссылок на враждебных данных
из `files.json`. Служит гейтом после правок UI-разметки; в CI идёт шагом
`Website DOM render check` в `smoke.yml`. Для проверки синтаксиса:

```bash
node --check products/website/app.js
node --check products/website/src/js/ui.js
```

## Агентный сервер

```bash
python products/agents/server.py
```

Основные API:

- `GET /api/health` — состояние сервера;
- `GET /api/info` — процесс и окружение;
- `GET /api/pipelines` — список пайплайнов;
- `GET /api/pipeline-results` — результаты;
- `POST /api/pipelines/<id>/run` — запуск;
- `GET /api/pipelines/<id>/results` — история;
- `POST /api/pipelines` — создание;
- `PUT /api/pipelines/<id>` — изменение;
- `DELETE /api/pipelines/<id>` — удаление.

Тесты:

```bash
python -m unittest discover -s products/agents/tests -p "test_*.py"
```

## Документационная проверка

В текущем checkout нет рабочего каталога `tools/checkers/`. Команды из исторической документации нельзя использовать как действующие.

Минимум:

```bash
git diff --check
```

Дополнительно проверь локальные ссылки, H1, пути в metadata, исторические каталоги и секреты.

## Типовой цикл

1. Прочитать `docs/00-START/MANIFEST.md` и `docs/01-ARCHITECTURE/ARCHITECTURE.md`.
2. Найти канонический исходник.
3. Изменить исходник.
4. Запустить релевантную проверку.
5. Для сайта выполнить `bash products/website/tools/build.sh`.
6. Проверить `git diff --check` и `git status`.
7. Обновить документацию, если изменился маршрут, API или структура.

## Исторические команды

Не использовать без восстановления соответствующих скриптов:

- `python tools/alephy.py`;
- `python tools/checkers/...`;
- `python tools/generators/...`;
- `python tools/reports/...`;
- `bash tools/backup/...`.
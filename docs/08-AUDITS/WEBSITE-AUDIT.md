# Аудит `products/website`

**Дата:** 2026-07-12  
**Область:** структура, архитектура, JavaScript, сервер, сборка, производительность, SEO, доступность и безопасность.  
**Статус:** статический аудит; production-код не изменялся.
**Ревизия:** 2026-09-29 — структура, статусы и доказательства перепроверены по репозиторию и живому сайту (`ortamy.github.io/alephy`); пункты, ссылавшиеся на удалённые файлы (`webapp/`, `tanakh/`, `researchlab/` в корне, `build/server.js`), сняты.

## 1. Краткий итог

Проект — статический сайт-каталог плюс SPA Research Lab. Серверной части в репозитории
для публичного сайта нет: GitHub Pages отдаёт `products/website/build`, собранный
`products/website/tools/build.sh` (bash + tailwind); единственный сервер — локальный
dev-сервер `products/website/config/server.js` (порт 8080).

Прежнее дерево (`webapp/`, `tanakh/`, `researchlab/` в корне, `js/`, `content/`,
`data/`, `locales/` как корневые каталоги) не существует: контент и страницы живут
в `src/`, лаборатория — в `apps/researchlab/`. Рекомендации прежней редакции о
перемещении этих каталогов сняты.

Критические зоны на 2026-09-29:

- **публикация `node_modules` в артефакт Pages** — доказано в проде
  (запрос `/node_modules/tailwindcss/package.json` → 200); чинится prune-шагом в
  `deploy.yml` (добавлен этой ревизией, подтверждается первым успешным деплоем);
- `innerHTML` и inline-обработчики в `app.js` (6 / 2) и `src/js/ui.js` (14 / 6);
- отсутствие минификации JavaScript вообще (сборка есть только для CSS);
- неполная SEO-разметка снята (10/10 маршрутов закрыты 2026-09-29); осталось
  `src/content/html`: 565 из 1228 файлов с `<title>Без названия` (вне sitemap, P2);
- зависимость `motion` объявлена, но не используется ни в одном файле сайта.

Path traversal в dev-сервере и HTML-экранирование в парсере — закрыты (§3, §4).

## 2. Фактическая структура и масштаб

Источник истины — исходники; `build/` — зеркало-артефакт, пересобираемое
`build.sh` (скрипт стирает `build/` и копирует заново).

```text
products/website/
├── index.html, app.js, site.css  # лендинг и классический каталог
├── style.css                     # сгенерированный tailwind (--minify)
├── files.json                    # 450 KB (460 436 B) — индекс каталога
├── sitemap.xml, robots.txt, favicon.svg, package.json
├── src/
│   ├── pages/          # 8 HTML: index, about, interlinear, tanakh, research/*
│   ├── js/             # api, state, ui, parser, i18n, burger-menu
│   ├── locales/        # ru / en / he
│   ├── content/        # контент md + html
│   ├── data/, styles/
├── apps/researchlab/   # SPA Research Lab (562 tracked-файлов)
├── assets/             # icons, images, maps (2.6 MB)
├── config/             # tailwind/postcss/purgecss + server.js (dev :8080)
├── tools/              # build.sh, index.html
├── artifacts/          # 20 PNG-скриншотов (6 MB), ссылок на них нет
├── pages/              # 1 legacy-файл: дубль src/pages/index.html
├── docs/               # STRUCTURE.md, supabase-waitlist.sql
├── build/              # артефакт сборки (3 025 tracked-файлов)
└── node_modules/       # только локально; в git — 0 tracked
```

Масштаб (`git ls-files` + размеры на диске, 2026-09-29): `products/website` —
**6 125 tracked-файлов**; внутри: `src` 2 411, `build` 3 025, `apps` 562,
`pages` 1. Диски без `node_modules`: `build` 216.1 MB, `apps` 150.1 MB
(в основном `data/scripture/*.json` до 9 MB каждый), `src` 19.9 MB,
`artifacts` 6.0 MB, `assets` 2.6 MB — суммарно ~316 MB (исходники + зеркало).

> Прежние цифры этой секции (5 599 файлов / 53,5 MB, `files.json` 579 KB) не
> воспроизводились: источники данных выросли, а часть каталогов не существовала
> и в 2026-07-12.

## 3. Приоритеты

Статусы перепроверены 2026-09-29 по файлам репозитория и живому сайту.

| Приоритет | Проблема | Статус | Доказательство / файлы |
|---|---|---|---|
| P0 | Path traversal в API чтения файлов | **закрыто** | `config/server.js`: `resolveAllowedFile()`, whitelist `ALLOWED_FILE_FOLDERS`, расширения только `.md/.html`, лимит 5 MB → 413, `FORBIDDEN_PATH` → 403. Публичного сервера у сайта нет (Pages — статика) |
| P0 | Сломанное HTML-экранирование | **закрыто** | `src/js/parser.js`: `escHtml` экранирует `& < > " '`, весь сырой текст проходит через `escHtml` до инлайн-разметки |
| P0 | SEO URL ≠ структура | **частично закрыто** | все 9 URL `sitemap.xml` существуют (`src/pages/**` → `build/pages/**`); лаборатория добавлена в sitemap этой ревизией |
| P1 | `innerHTML` и inline-обработчики | **открыто** | `src/js/ui.js`: innerHTML×14, onclick×6; `app.js`: innerHTML×6, onclick×2 |
| P1 | Несколько Markdown-рендереров | **открыто (уточнено)** | в браузере — `src/js/parser.js`; `pip install markdown rich` в `deploy.yml` не используется ни одним скриптом репо (0 импортов `markdown`/`rich`) |
| P1 | JS minify отсутствует | **открыто** | `package.json` — только CSS-сборка (`tailwindcss --minify`); `src/js/*` и `apps/researchlab/js/*` отдаются как есть |
| P1 | `node_modules` в deploy-artifact | **исправлено в CI** | утечка подтверждена 200 в проде; prune-шаг добавлен в `deploy.yml` (2026-09-29) — подтверждается первым успешным деплоем |
| P1 | Неполная SEO-разметка | **закрыто** | 10/10 маршрутов (8 страниц + лендинг + лаборатория): title, description, canonical, hreflang x-default, og-набор ×6; два битых `og:url` с легаси `/ru/` исправлены 2026-09-29. Отдельный P2: `src/content/html` — 565 из 1228 с `<title>Без названия`, 1 без title (вне sitemap) |
| P2 | Полная перерисовка списка | **открыто** | `src/js/ui.js` рендерит список целиком, без DocumentFragment/virtual list |
| P2 | Внешний Google Fonts | **частично закрыто** | `index.html`: preconnect ×2 + preload + noscript; self-host WOFF2 не сделан |
| P2 | Неиспользуемая зависимость `motion@13` | **открыто (новое)** | 0 импортов в коде сайта (единственное упоминание — `.agents/skills/apple-design/SKILL.md`) |
| P2 | Скриншоты `artifacts/` (6 MB) в корне продукта | **открыто (новое)** | 20 tracked-файлов, 0 ссылок из docs; по DESIGN-SYSTEM §8.4 скрины живут в `tasks/<task>/` — нужно решение владельца |
| P2 | Развёрнутые dev-файлы в `build/`-зеркале | **открыто (новое)** | tracked: `build/probe-cards.cjs`, `build/tasks/*`, `build/docs/STRUCTURE.md`, `build/src/styles/input.css`, `build/config/server.js` — в CI-артефакт не попадают (build.sh пересоздаёт `build/`), но загрязняют репозиторий |

## 4. Безопасность

### 4.1 API чтения файлов — закрыто

Публичного API у сайта нет: GitHub Pages отдаёт статику. Единственный сервер —
локальный dev-сервер `products/website/config/server.js` (порт 8080), и в нём
защита уже реализована (проверено 2026-09-29):

- `resolveAllowedFile()` — `path.resolve` от корня + проверка выхода за пределы `ROOT`;
- `ALLOWED_FILE_FOLDERS` — whitelist каталогов (`src/content/**`, `src/pages`, `pages`);
- `ALLOWED_FILE_EXTENSIONS = {'.md', '.html'}` — только текстовые источники;
- `MAX_RESPONSE_SIZE` 5 MB → 413; `FORBIDDEN_PATH` → 403.

Не проверялось этим аудитом: symlink escape и rate limit (на dev-сервере при
статической публикации неприменимы). Агентный сервер `products/agents/server.py`
(127.0.0.1:5000) — вне области этого аудита.

### 4.2 XSS и HTML injection

**Статус: экранирование закрыто; генерация DOM — открыта.**

`src/js/parser.js` (проверено 2026-09-29): `escHtml` экранирует `& < > " '`;
каждая строка Markdown проходит через `escHtml` до инлайн-разметки (код, жирный,
курсив); `id` заголовков строятся из очищенного текста; URL иконок тоже
экранируются. Прежняя редакция этого аудита приводила сломанный сниппет — он не
воспроизводится.

Открыто — счётчики по исходникам (`Select-String`, 2026-09-29):

- `src/js/ui.js` — `innerHTML` ×14, inline `onclick` ×6;
- `app.js` — `innerHTML` ×6, inline `onclick` ×2.

Направление: `createElement`/`textContent` вместо `innerHTML`, `addEventListener`
вместо inline-атрибутов, URL изображений/ссылок валидировать по схеме
(относительные, `http`, `https`). Контрольный чек-лист —
`docs/09-GUIDES/SECURITY-CHECKLIST.md`.

### 4.3 localStorage

**Статус: открыто (уточнено).** Реальный файл — `src/js/state.js` (7 обращений к
`localStorage`); `webapp/js/vision*.js` не существует. Настройки лаборатория хранит
через свой модуль `#settings` (`css/user-preferences.css`).

Требуется: проверять типы после `JSON.parse`, ограничивать историю, валидировать
пути по `FILES`; в статическом приложении в `localStorage` не должно попадать
ничего, что не предназначено для публичного показа (API-ключи, токены).

## 5. Архитектура и качество кода

- Единый Markdown-рендерер: в браузере остался один — `src/js/parser.js`; шаг
  `pip install markdown rich` в `deploy.yml` не нужен (0 импортов `markdown`/`rich`
  в репо) — удалить или обосновать.
- `src/js/api.js`: проверка `response.ok` в `fetchJSON` есть (1 место); переход с
  callbacks на `async/await` не сделан.
- Глобальные `window.Alephy*` и inline-обработчики в `app.js` сохранены;
  ES modules — отдельная задача на все 6 файлов `src/js`.
- `app.js`: двойная инициализация `setFontSize` (см. `loadFromStorage` → init) и
  двойной `addToHistory(p)` в колбэке `openFile` — воспроизводятся, убрать.
- `products/website/pages/` — legacy-дубль `src/pages/index.html` (1 tracked-файл);
  удалить после сверки ссылок.
- Пункт «не удалять `webapp/`, `researchlab/`, `tanakh/`» снят: этих каталогов в
  корне нет; содержимое живёт в `apps/researchlab/` и `src/`.

## 6. Производительность и сборка

- `files.json` — 450 KB (460 436 B), грузится целиком: нужен build-time индекс,
  пагинация или предфильтрация поиска.
- Полный ре-рендер списка при каждом вводе — кэш нормализованных полей поиска, `DocumentFragment`; для больших списков применить virtual list.
- Изображения (`assets/`, `artifacts/`): подготовить WebP/AVIF, проставить
  `width`, `height`, `loading="lazy"`, `decoding="async"` — вживую не проверялось.
- Google Fonts: `<link>` с preconnect ×2 + preload + noscript уже стоит
  (`index.html:23–27`); осталось self-host WOFF2.
- JS minify: шага сборки нет вообще — только `tailwindcss --minify` для `style.css`
  (`products/website/package.json`); прежней заглушки `build:js:minify` уже нет.
  Решение: esbuild/terser + hash-имена + sourcemap; зависимость > 20 KB gzipped → ADR.
- `config/tailwind.config.js` актуален (content = `../index.html`, `../app.js`,
  `../src/pages/**/*.html`, `../src/js/**/*.js`, `../src/locales/**/*.json`) —
  пункт «расширить путями» снят.
- `node_modules`: в git — 0 tracked; в артефакт Pages попадал (доказано 200 в проде),
  prune-шаг добавлен в `deploy.yml` (2026-09-29).

## 7. SEO и доступность

Сверено с живым сайтом 2026-09-29:

- `sitemap.xml` — 10 URL (генерируется `tools/generate-sitemap.py`): лендинг,
  лаборатория `/apps/researchlab/index.html` (в проде — 200) и 8 страниц
  `src/pages/**` → `build/pages/**`. Утверждение прежней редакции о `/ru/`,
  `/en/`, `/he/` неактуально; URL и метаданные сверены 2026-09-29.
- `index.html`: лендинг ссылается на `apps/researchlab/index.html` напрямую;
  задержанного JS-redirect на `pages/index.html` нет — из `setTimeout`/
  `location.href`/`redirect` в корневом `index.html` находится только фокус
  после закрытия teaser (строка 982), в `src/pages/index.html` — 0 вхождений.
- `robots.txt`: `Allow: /`, `Disallow: /api/` (путь существует только у локального
  dev-сервера — для Pages это no-op, оставлен как защита на случай поднятия
  сервера), `Sitemap:` — корректный.
- Метаданные: у всех 10 маршрутов title, description, canonical, hreflang
  `x-default` и og-набор ×6 (закрыто 2026-09-29; исправлены два `og:url` с легаси
  `/ru/`). Открытый остаток: `src/content/html` — 565/1228 `<title>Без названия`
  и 1 файл без title; эти файлы вне sitemap (P2).

Для accessibility остаётся в силе (операционный минимум —
`docs/09-GUIDES/A11Y-MINIMUM.md`):

- семантика `<main>/<nav>/<header>/<article>`: лендинг `#main-content`,
  лаборатория `#labContent`;
- интерактив — `<button>`/`<a>`, не `div[onclick]`;
- `:focus-visible`, `aria-label`, `aria-live` для загрузки и ошибок;
- контраст золотого текста — токены `--gold-text` / `--red-text` (DESIGN-SYSTEM §1.1);
- иврит — `lang="he" dir="rtl"`, библейский иврит — `lang="hbo"`;
- осмысленный `alt` у содержательных изображений.

## 8. План исправлений (состояние на 2026-09-29)

### Сделано этой ревизией и раньше

1. Path traversal закрыт в `config/server.js` (§4.1).
2. `escHtml` корректен (§4.2).
3. sitemap сверен с `src/pages`; лаборатория добавлена в `sitemap.xml`.
4. `node_modules` вычищается из артефакта Pages (prune-шаг в `deploy.yml`).
5. Сняты пункты о несуществующих файлах (`webapp/`, `tanakh/`, `researchlab/`,
   `build/server.js`), устаревшие цифры и «заглушка» `build:js:minify`.
6. Обновлены версии actions в `deploy.yml`: `checkout@v4`, `setup-python@v5`.
7. Метаданные всех 10 маршрутов (title/description/canonical/hreflang/og ×6),
   фикс `og:url` с легаси `/ru/`; sitemap генерируется из маршрутов
   (`tools/generate-sitemap.py`, коммит `417ea297`).

### Осталось (по приоритетам §3)

1. **P1** — `innerHTML`/inline → DOM API и `addEventListener` (`src/js/ui.js`, `app.js`).
2. **P1** — production-сборка JS: esbuild/terser, hash-имена, sourcemap; перед
   внедрением — ADR, если зависимость > 20 KB gzipped.
3. **P2** — `<title>Без названия>` в `src/content/html` (565 из 1228, 1 файл без
   title): генерация title из H1; файлы остаются вне sitemap.
4. **P1** — убрать неиспользуемый `pip install markdown rich` из `deploy.yml`
   (0 импортов в репо).
5. **P2** — virtual list/индексация; WebP/AVIF; self-host WOFF2; удаление `motion`;
   решение по `artifacts/` (6 MB скриншотов) и legacy `pages/`; чистка dev-файлов
   в `build/`-зеркале.
6. **P2** — automated checks ссылок, HTML, accessibility в CI (сейчас в CI — unit-тесты
   и smoke: `smoke.yml`).

### Этапы (для новых работ)

- Этап 1 (P0) — закрыт полностью.
- Этап 2 (P1) — пункты 1–4 выше.
- Этап 3 (P2) — пункт 5–6 выше.

## 9. Чек-лист приёмки

`[x]` — выполнено статически по файлам и живому сайту 2026-09-29; `[ ]` — не выполнено.

- [x] `npm run build` создаёт production CSS (`tailwindcss --minify` → `style.css`);
  production-сборки JS нет — §3 P1.
- [x] API dev-сервера не отдаёт `..`, абсолютные пути и не-Markdown
  (`resolveAllowedFile`, whitelist, `.md/.html`) — §4.1.
- [x] Markdown-вывод экранируется (`escHtml`) — §4.2; остаточный риск — `innerHTML`
  в `src/js/ui.js` и `app.js`.
- [x] Все sitemap URL существуют (10/10) и имеют canonical/метаданные
  (title, description, hreflang, og) — закрыто 2026-09-29.
- [x] Нет console errors — закрыто smoke-прогоном `smoke.yml` (маршруты desktop/mobile,
  кодировка, offline-fallback) и `test:unit`; фактический прогон CI смотреть в Actions.
- [ ] Поиск и открытие файла при пустом/повреждённом JSON изолированно не проверены
  (в `app.js` есть error-колбэк с «Ошибка загрузки»).
- [ ] Клавиатурная доступность поиска, списка, закладок и модалок вживую не
  проверялась; минимум — `docs/09-GUIDES/A11Y-MINIMUM.md`.
- [ ] Lighthouse/axe и проверка ссылок в CI не внедрены (P2).

## 10. Ограничения аудита

Аудит статический. Факты перепроверены 2026-09-29: файлы и `git ls-files` репозитория
плюс 3 запроса к живому сайту (`sitemap.xml`, `/apps/researchlab/index.html`,
`/node_modules/tailwindcss/package.json`). Lighthouse, axe, нагрузочные тесты,
браузерное E2E и production reverse-proxy не проверялись; Core Web Vitals не
измерялись. Результаты CI (`smoke.yml`, `docs-check.yml`, `deploy.yml`) из этой сессии
не читаются — их нужно сверять в GitHub Actions.
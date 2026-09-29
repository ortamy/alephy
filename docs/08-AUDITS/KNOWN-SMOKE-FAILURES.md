# Известные падения smoke

Ранний полный прогон `npx playwright test` в Research Lab дал **210 passed,
8 failed** (218 тестов, baseline 2026-09-27); каждое падение проверено против
предыдущего коммита через `git stash` — регрессов реестра модулей не было.
Ниже — разбор и текущий статус.

## Починено 2026-09-29 (4)

### detail-маршруты с параметром (3)

| Тест | Корень | Фикс |
|---|---|---|
| `parameterized routes › #language-map/russian` | `renderDetail` писал в `container.innerHTML` и сносил шапку модуля; `LabHero.scan → mount` собирал её заново из базового конфига хаба («Карта языков» вместо названия языка), а модуль не публиковал `container._labHeroOverride`, как это делают `timeline.js` / `load-researches.js` / `workbench.js` | `lab-hero.js`: `mount` восстанавливает последний запрошенный вид из `activeViews`; `language-map.js`: override детали в `container._labHeroOverride` и его сброс в списке |
| `parameterized routes › #timeline/tanakh-chronology` | полный вид ленты (`renderDetail`) не нёс `data-timeline-id`, а тест ждёт этот анкер на `#timeline/<id>` | `timeline.js`: `data-timeline-id` на корне `.tl-detail` |
| `parameterized routes › #dictionaries/root-dictionary` | дефекта нет: маршрут открывает деталь корректно | — |

Проверено адресными маршрутными проверками (шапка = заголовок детали,
анкер детали в DOM, панель не пуста, консоль чиста) и пробником
`node tools/design-baseline/route-probe.mjs <route>`; полный smoke не
перезапускался. Гипотеза из прошлой редакции файла («блок “уже загружен →
применить маршрут” в `page-controller.renderModule` не покрывает
detail-сегмент») **не подтвердилась** — рендер детали отрабатывал, терялся
заголовок шапки.

### root etymology modal — ошибка загрузки и повтор (1)

| Тест | Корень | Фикс |
|---|---|---|
| `root etymology modal › retries a failed etymology request` | приложение регистрирует `sw.js`, а Playwright не перехватывает запросы, которые обслуживает Service Worker: `page.route(...)` не видел `data/roots/etymology/<root>.json`, `route.abort()` не срабатывал, и модалка показывала настоящий разбор вместо error-state. `page.on('request')` SW-запросы видит — поэтому соседний тест с `requests === 1` оставался зелёным | тест открывает собственный контекст с `serviceWorkers: 'block'` |

Продуктовый код модалки дефекта не имел: с заблокированным SW после
`route.abort()` появляются `.rem-error` и `[data-rem-retry]`, клик по кнопке
догружает разбор («Семантические сдвиги»), запросов ровно 2 — те же три
проверки, что и в тесте, воспроизведены вне раннера.

## Flaky под нагрузкой (4) — причина снята, ждёт полного прогона

`route loading finishes` для `#manifest`, `#root-dictionary`, `#researches`,
`#state-analyzer`. Каждый из них проходит при одиночном запуске
(`npx playwright test -g "..."` → 1 passed за 4–14 с), но падает в полном
прогоне. Причина — тестовый бюджет 5 с на первое появление панели при 96
тестах подряд и холодном кэше; это ограничение теста, не дефект продукта.

Бюджет поднят до 7 с (`SPINNER_BUDGET_MS` в `tests/smoke.spec.js`) и остаётся
ниже `WATCHDOG_MS` (8 с) в `page-controller`: медленный модуль до этого порога
считается грузящимся, после — переводится в error-state, и проверка
`[data-module-error]` остаётся осмысленной. Подтверждение — полный прогон
(локально или в CI): если флак останется, следующий шаг — не бюджет, а разбор
причин медленного первого рендера тяжёлых маршрутов.

## Как проверять

```bash
cd products/website/apps/researchlab

# полный прогон (~11 мин, 218 тестов)
npx playwright test

# один тест — отделяет реальный баг от нагрузки
npx playwright test -g "timeline hub cards"
```

Перед прогоном закрой висящие процессы: `Get-Process chrome, python |
Stop-Process -Force`. Убитый web-сервер даёт `ERR_CONNECTION_REFUSED`, и
тесты падают так, будто сломан модуль.

Один маршрут без Playwright:
`node tools/design-baseline/route-probe.mjs <route>`.

Тесты, которые подменяют сеть (`page.route` + `route.abort()`), обязаны
блокировать Service Worker: `browser.newContext({ serviceWorkers: 'block' })`.
Приложение регистрирует `sw.js`, а Playwright не перехватывает запросы,
которые обслуживает SW, — тест «проходит» мимо подмены и падает по ложной
причине.

**Статус:** устойчивых падений нет. Открыт flaky-набор под нагрузкой
(см. выше); при появлении новых — фиксировать здесь одной строкой, чтобы не
тратить время на повторную диагностику.

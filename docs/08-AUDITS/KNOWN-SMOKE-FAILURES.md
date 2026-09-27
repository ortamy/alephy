# Известные падения smoke (baseline 2026-09-27)

Полный прогон `npx playwright test` в Research Lab: **210 passed, 8 failed**
(218 тестов). Все восемь проверены против предыдущего коммита через
`git stash` — **ни одно не является регрессом** реестра модулей.

## Устойчиво падают (4) — нужен отдельный баг-фикс

| Тест | Симптом |
|---|---|
| `root etymology modal › retries a failed etymology request` | после `route.abort()` не появляется `[data-rem-retry]` — модалка не показывает состояние ошибки с кнопкой повтора |
| `parameterized routes › #language-map/russian` | деталь не открывается без hero-ошибки и пустой панели |
| `parameterized routes › #timeline/tanakh-chronology` | то же |
| `parameterized routes › #dictionaries/root-dictionary` | то же |

Последние три бьют по маршрутам с параметром (`<route>/<id>`). Похоже на
общее: перерисовка уже загруженного модуля не обрабатывает сегменты.
Гипотеза, не подтверждённая чтением кода: блок «уже загружен → применить
маршрут» в `page-controller.renderModule` не покрывает `language-map`/
`timeline`/`dictionaries` для detail-сегмента.

## Flaky под нагрузкой (4) — проходят в изоляции

`route loading finishes` для `#manifest`, `#root-dictionary`, `#researches`,
`#state-analyzer`. Каждый из них проходит при одиночном запуске
(`npx playwright test -g "..."` → 1 passed за 4–14 с), но падает в полном
прогоне. Причина — таймаут 5 с на первом появлении панели при 96 тестах
подряд и холодном кэше. Это ограничение теста, не дефект продукта.

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

**Статус:** открыто. Каждый пункт — отдельная задача; здесь только
фиксация факта, чтобы не тратить время на повторную диагностику.

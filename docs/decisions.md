# Архитектурные решения (ADR)

### ADR-002: Схема хронологии палео-таймлайна (era / sortKey / kind / confidence)
- Дата: 2026-09-16
- Статус: accepted
- Контекст: `data/timeline.json` был списком лент со свободной строкой `date`; эра фильтровалась хардкодом ID (дублированные массивы в `countByEra`/`applyFilter`), события не сортировались, deep-link `#timeline/<id>/event/<idx>` генерировался, но не обрабатывался, status-dot выводился эвристикой `getEventStatus` (семантически ложен для истории).
- Решение: единая схема — лента `{id, title, paleoIcon, era, description, events}`, событие `{date, sortKey, kind, confidence, source, links[], description, title}`. `sortKey` — число (до н.э. — отрицательное); чипы-эры строятся из `era` данных (словарь `ERAS`); сортировка включается, только если `sortKey` есть у всех событий ленты; дот = `kind` (event/text/artifact/distortion/concept/glyph/person), бейдж уверенности — по палитре DESIGN-SYSTEM §6; `source` — провенанс к `content/**` или `data/**`; `links[]` — внутренние hash-ссылки на связанные события (`#timeline/<id>/event/<idx>`). Механика сравнения: `#timeline/compare/<idA>/<idB>` — сводная хронология двух датированных лент по `sortKey` (теги A/B, клик ведёт в исходную ленту). Добавлены ленты: `tanakh-chronology` (31 событие), `bashah-chronology` (8), `text-witnesses` (13); существующие 7 лент переведены на схему.
- Альтернативы: библиотека таймлайнов (vis-timeline и т.п.) — отвергнута: зависимость противоречит бюджету бандла (<200KB gz); отдельные JSON на каждую ленту — отвергнуто: дублирует каталог и поиск (⌘K).
- Последствия: новая лента = только запись в `data/timeline.json` (+`era` из словаря `ERAS`); для хронологической сортировки нужно заполнить `sortKey` у всех событий ленты; производные файлы в `products/website/build/apps/researchlab` синхронизируются build-контуром (`products/website/tools/build.sh`).

### ADR-001: Ребрендинг GOLEM → ALEPHY
- Дата: 2026-09-11
- Статус: accepted
- Контекст: решение о переименовании бренда проекта во всех слоях (сайт, лаборатория, документы, docker, агенты, видео).
- Решение: регистро-сохраняющая замена golem/GOLEM/Golem → alephy/ALEPHY/Alephy и кириллических брендовых форм («Голем»/«ГОЛЕМ» со склонениями → «Алефи»/«АЛЕФИ») кодмодом `tools/rebrand-alephy.mjs`. Переименованы ассеты (golem-logo/symbol → alephy-*), `docs/14-APPS/GOLEM.md` → `ALEPHY.md`, docker-сервис/сеть/volume, ключи localStorage (`golem_theme` → `alephy_theme` и др.), идентификаторы `GolemState/GolemUI/GolemParser/GolemAPI`.
- Альтернативы: оставить исторические упоминания в docs/99-HISTORICAL (отвергнуто — требуется полная консистентность бренда).
- Последствия и защищённые зоны:
  - Термин גֹּלֶם/«голем» как объект исследования НЕ переименован: `docs/05-DICTIONARIES/`, `products/neuro/training-data/`, словарная страница `terminology/golem.md`, анкер `roots.json#golem`, внешние training-данные.
  - `HF_REPO="golem/ed-v1"` в `products/neuro/models/download.sh` — внешний репозиторий HuggingFace, не тронут.
  - Ссылки `github.com/ortamy/golem` и `ortamy.github.io/golem` заменены на `/alephy` — требуют переименования GitHub-репозитория и настройки Pages.
  - Пользовательские данные: старые localStorage-ключи (`golem_*`) будут проигнорированы — сохранённые темы/настройки сбросятся.

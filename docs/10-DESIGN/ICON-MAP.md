# Карта иконок

**Источник:** `products/website/assets/icons/32/`
**Используется из:** `products/website/researchlab/` через путь `../assets/icons/32/<pack>/<name>`

Единственный физический размер на диске — `32/`. Нужный визуальный размер (18/20/24/32/48px) получают через атрибуты `width`/`height` у одного и того же файла, не через отдельные папки размеров.

Каждый пак содержит `placeholder.svg` — заглушку, которую подставляют, пока для слота не нарисована реальная иконка.

## Слой Lucide (UI/навигация/кнопки) — добавлен 2026-09-03

UI-иконки Research Lab переведены на **Lucide** (vendored: `researchlab/js/vendor/lucide.min.js`, init: `researchlab/js/lucide-init.js`, стили: `researchlab/css/components/lucide.css`). Тематические паки `assets/icons/32/...` остаются источником для героев разделов, агентов и контента.

Маппинг бывших UI/навигационных PNG → Lucide:

| Где | Было (PNG) | Lucide |
|---|---|---|
| Поиск в шапке | `ui/question.png` | `search` |
| Переключение темы | `ui/month.png` / `ui/sun.png` / `ui/moon.png` | `moon` / `sun` / `contrast` |
| Ссылка «Сайт» | `ui/web.png` | `globe` |
| Ссылка «GitHub» | `ui/github.svg` | `github` |
| Бургер | `ui/burger-menu.png` | `menu` |
| Манифест | `ui/scroll.png` | `scroll-text` |
| Рабочий стол | `ui/grid.png` | `layout-grid` |
| Мастерская / Палео-конструктор | `crafts/hammer-and-chisel.png` | `hammer` |
| Палео-клуб | `paleo/track.png` | `footprints` |
| Данные / Книгочтение | `ui/book.png` | `book-open` |
| Обучение | `ui/book.png` | `graduation-cap` |
| Словари | `ui/markbook.png` | `library` |
| Исследования | `scribe/scrolls.png` | `archive` |
| Методология | `ui/scales.png` | `scale` |
| Палео-механика | `crafts/hammer-and-chisel.png` | `cog` |
| Палео-лингвистика | `scribe/scroll.png` | `languages` |
| Карта языков | `ui/map.png` | `map` |
| Картография | `ui/compass.png` | `compass` |
| Карта состояний | `ui/flag.png` | `flag` |
| Палео-таймлайн | `ui/clock.png` | `clock` |
| Религионизмы | `ui/question.png` | `help-circle` |
| Инструменты (раздел) | `archaeology/testtube.png` | `flask-conical` |
| Палео-клавиатура | `ui/keyboard.png` | `keyboard` |
| Генераторы | `crafts/hammer-and-chisel.png` | `sparkles` |
| Чекеры | `ui/question.png` | `check-circle` |
| Компаратор | `scribe/scroll.png` | `diff` |
| Анализаторы | `archaeology/testtube.png` | `test-tube` |
| AI (раздел) | `crafts/hammer-and-chisel.png` | `bot` |
| Агенты | `ui/user.png` | `users` |
| Пайплайны | `paleo/track.png` | `workflow` |
| Запуск сервера / Система / Настройки | `ui/settings.png` | `server` / `settings` |
| Нейрочат | `ui/bell.png` (не используется) | `message-circle` |
| Анализ изображений | `archaeology/lamp.png` | `image` |
| Секции (свёрнутые) | текстовый `▼` | `chevron-down` (+rotate −90°) |
| Закрытие модалки | `nav/alert.png` | `x` |

Автодополнение иконок в кнопках `.lab-btn` выполняется по правилам `TEXT_ICON_RULES` (`researchlab/js/lucide-init.js`); отключить для конкретной кнопки — атрибут `data-no-icon`.

## Паки

### `archaeology/` — археология
| Файл | Формат | Используется как |
|---|---|---|
| `lamp.png` | PNG | Принципы (`exposure`), Анализ изображений |
| `testtube.png` | PNG | Этимология, Разбор слов, шапка лаборатории |
| `vase.png` | PNG | не задействован в текущем UI |

### `crafts/` — ремёсла
| Файл | Формат | Используется как |
|---|---|---|
| `hammer-and-chisel.png` | PNG | Методички, Генератор исследований, Агенты, Чат с Эдом |

### `desert/` — пустыня (единственный полностью SVG-пак)
`camel.svg`, `cloud.svg`, `donkey.svg`, `footprints.svg`, `manna.svg`, `pillar-fire.svg`, `quail.svg`, `rock.svg`, `staff.svg`, `tent-peg.svg`, `tent.svg`, `well.svg` — пока не задействованы в интерфейсе researchlab (набор для будущего использования).

### `feasts/` — праздники
Пусто, только `placeholder.svg`.

### `food/` — еда
Пусто, только `placeholder.svg`.

### `israel/` — Израиль
| Файл | Формат | Используется как |
|---|---|---|
| `heart.png` | PNG | не задействован в текущем UI |

### `map/` — карта
Пусто, только `placeholder.svg`.

### `nav/` — навигация
| Файл | Формат | Используется как |
|---|---|---|
| `alert.png` | PNG | закрытие модалки (`.modal-close`) |
| `door.png` | PNG | ссылка «Сайт», Разоблачения (редактор) |
| `home.png` | PNG | не задействован в текущем UI |

### `paleo/` — палео-иврит
| Файл | Формат | Используется как |
|---|---|---|
| `track.png` | PNG | Палео-образы, Палео-клавиатура, горячие клавиши |

### `scribe/` — писец
| Файл | Формат | Используется как |
|---|---|---|
| `scroll.png` | PNG | Сравнение переводов, Генератор досок |
| `scrolls.png` | PNG | Библиотека исследований, Разоблачения, Архив досок |

### `seals/` — печати
| Файл | Формат | Используется как |
|---|---|---|
| `ring.png` | PNG | не задействован в текущем UI |

### `signs/` — знаки
Пусто, только `placeholder.svg`.

### `temple/` — храм
| Файл | Формат | Используется как |
|---|---|---|
| `torch.png` | PNG | не задействован в текущем UI |

### `ui/` — интерфейс
| Файл | Формат | Используется как |
|---|---|---|
| `book.png` | PNG | Корневой словарь, Словари, Книгочтение |
| `hourglass.png` | PNG | не задействован в текущем UI |
| `keyboard.png` | PNG | не задействован в текущем UI |
| `moon.png` | PNG | переключатель темы (тёмная) |
| `question.png` | PNG | Поиск, Чекер религионимов, Расследование |
| `scales.png` | PNG | не задействован в текущем UI |
| `settings.png` | PNG | Настройки (админ) |
| `sun.png` | PNG | переключатель темы (светлая) |

### `weapons/` — оружие
| Файл | Формат | Используется как |
|---|---|---|
| `shield.png` | PNG | не задействован в текущем UI |
| `sword.png` | PNG | не задействован в текущем UI |

## Открытые задачи

- Паки `feasts`, `food`, `map`, `signs` — полностью пустые, нужны иконки.
- Пак `desert` полностью нарисован (SVG), но ни одна иконка не подключена в `index.html` — либо задействовать, либо перенести в бэклог.
- Часть иконок (`vase`, `heart`, `home`, `ring`, `torch`, `hourglass`, `keyboard`, `scales`, `shield`, `sword`) существуют на диске, но не используются ни в одном модуле — уточнить, планируются ли для новых разделов, или это задел на будущее.
- Задача из `CLAUDE.md`: «Иконки — перерисовать в SVG, разложить по пакам» — большинство активных иконок сейчас PNG.

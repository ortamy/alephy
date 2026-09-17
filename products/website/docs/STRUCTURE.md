# Структура сайта Alephy

## Архитектура (Вариант 1)

```
products/website/
├── index.html                 # точка входа + редирект по языку
├── app.js                     # точка входа JS
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── package.json               # devDependencies (playwright и т.д.)
├── node_modules/
│
├── config/                    # конфиги сборки
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── purgecss.config.js
│   └── server.js              # dev-сервер
│
├── src/                       # все исходники
│   ├── assets/                # fonts, icons, images
│   │   ├── fonts/
│   │   ├── icons/             # 32px SVG иконки по темам
│   │   └── images/
│   ├── content/               # контент (html/ и md/)
│   │   ├── html/              # HTML-версии: bashah, researches, tanakh, teachings
│   │   └── md/                # Markdown-версии: bashah, researches, tanakh, teachings
│   ├── data/                  # данные
│   │   └── tanakh/            # данные ТаНаХа
│   ├── pages/                 # HTML страницы (многоязычные)
│   │   ├── index.html
│   │   ├── about/
│   │   ├── interlinear/
│   │   ├── research/
│   │   └── tanakh/
│   ├── js/                    # JS модули
│   │   ├── api.js
│   │   ├── burger-menu.js
│   │   ├── i18n.js
│   │   ├── parser.js
│   │   ├── state.js
│   │   └── ui.js
│   ├── styles/                # CSS (входная точка Tailwind)
│   │   └── input.css
│   └── locales/               # локализация
│       ├── index.json         # манифест языков: кто активен, кто черновик
│       ├── ru.json            # источник: русский текст (словарь не грузится)
│       ├── en.json            # черновик, status=draft
│       └── he.json            # черновик, status=draft (RTL)
│
├── apps/                      # подприложения
│   └── researchlab/           # Research Lab (отдельное SPA)
│       ├── index.html
│       ├── assets/
│       ├── css/
│       ├── data/
│       ├── js/
│       └── tests/
│
├── tools/                     # утилиты (только скрипты)
│   ├── build.sh               # скрипт сборки
│   └── index.html
│
├── docs/                      # документация сайта
│   └── STRUCTURE.md           # этот файл
│
└── build/                     # артефакты сборки (в .gitignore)
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── app.js
    ├── style.css              # сгенерированный Tailwind
    ├── content/
    ├── pages/
    ├── data/
    ├── assets/
    ├── js/
    ├── locales/
    ├── researchlab/
    ├── tools/
    └── config/
```

## Принципы

### Разделение ответственности

| Папка | Назначение |
|-------|-----------|
| `config/` | Конфиги сборки — не артефакты, не исходники |
| `src/` | Все исходники: контент, страницы, данные, стили, JS, локали |
| `apps/` | Самостоятельные веб-приложения внутри сайта |
| `tools/` | Скрипты для разработки (build.sh и др.) |
| `docs/` | Документация по структуре сайта |
| `build/` | Артефакты сборки — в `.gitignore`, генерируется `tools/build.sh` |

### Что остаётся в корне

Только то, что **обязано** быть в корне для работы веб-сервера:
- `index.html`, `app.js` — точки входа
- `favicon.svg`, `robots.txt`, `sitemap.xml` — мета-файлы
- `package.json` — корневой package (только devDependencies)

### Сборка

```bash
bash tools/build.sh
```

Скрипт:
1. Очищает `build/`
2. Копирует корневые файлы
3. Копирует `src/js/`, `src/locales/` → `build/`
4. Копирует `apps/researchlab/` → `build/`
5. Копирует `tools/` → `build/`
6. Копирует `src/content/`, `src/pages/`, `src/data/`, `src/assets/` → `build/`
7. Копирует `config/` и `package.json` → `build/`
8. Запускает `npm install && npm run build` (Tailwind → style.css)

### CI/CD

`.github/workflows/deploy.yml` запускает `bash tools/build.sh` и деплоит `build/` на GitHub Pages.

## Навигация

Бургер-меню (`src/js/burger-menu.js`) генерируется динамически:
- Главная (index.html)
- Чтение ТаНаХа (tanakh/index.html)
- Исследования (research/index.html)
- Методы разоблачения (research/methods.html)
- Словари (research/dictionaries.html)
- Методология (research/methodology.html)
- Инструменты (tools/index.html)
- Research Lab (researchlab/index.html)
- О проекте (about/index.html)

Переключатель языков — `src/js/i18n.js` + `src/locales/`:

- русский — язык разметки: словарь для `ru` в браузер не грузится, текст берётся
  из HTML/JS, поэтому у элементов с `data-i18n` русский текст остаётся на месте;
- активные языки задаёт `src/locales/index.json` (`status: "ready"`); черновики
  видны в переключателе, но отключены — неполный перевод не выходит к пользователю;
- выбор хранится в `localStorage.alephy-lang` и в `?lang=`; хеш не используется,
  потому что хеш принадлежит роутеру лабы (`#route`) и ломать deep-links нельзя;
- разметка переключателя — контейнер `<div data-i18n-switcher></div>`,
  его наполняет рантайм (одна реализация для сайта и лабы);
- `i18n.js` подключается на страницах с бургер-меню и инициализируется сам.

### Проверки локализации

CI (`.github/workflows/i18n-check.yml`) на правки локалей, скриптов, страниц и инструментов:

```bash
python tools/i18n-check.py check      # словари, манифест, паритет, ключи разметки и JS
python tools/i18n-extract.py check    # ключи разметки не разошлись со словарём
node tools/i18n-verify.mjs            # 50 функциональных проверок рантайма (7 сценариев)
```

- `python tools/i18n-extract.py report` — статистика: единицы перевода, покрытие по языкам,
  русский текст разметки, разошедшийся со словарём;
- `python tools/i18n-extract.py write` — добавляет только отсутствующие ключи (для `ru` —
  значение из разметки, остальным языкам — пустая строка «ещё не переведено») и пересчитывает
  `coverage` в манифесте и в `meta`; непустые значения не перезаписывает и ничего не удаляет;
- `coverage` — доля переведённых строк интерфейса: ключи разметки и JS плюс русские строки
  без ключа (они станут `phrases.*` в фазе 3).

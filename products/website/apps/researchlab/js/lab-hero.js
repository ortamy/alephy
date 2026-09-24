(function(window, document) {
  'use strict';

  var ROOT_SELECTOR = '#labContent';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Делегирует перевод window.AlephyI18n.t() с русским резервом:
  // для ru dict пуст (файл не грузится — ноль запросов, ноль мигания),
  // для en/he t() вернёт перевод из словаря или русский fallback.
  function i18nText(key, fallback) {
    var api = window.AlephyI18n;
    return (api && typeof api.t === 'function' && key) ? api.t(key, fallback) : fallback;
  }

  // Translate static registry fields before merging dynamic research titles.
  function resolveConfig(route, config) {
    var result = Object.assign({}, config);
    ['kicker', 'title', 'subtitle'].forEach(function(field) {
      if (config[field]) result[field] = i18nText('lab.hero.' + route.replace(/\//g, '.') + '.' + field, config[field]);
    });
    return result;
  }

  /* Чип может быть строкой или { label, key, className, dot, action }.
     key — i18n-ключ подписи, action — кликабельный чип (data-lab-action:
     модуль слушает его делегированно внутри своего контейнера).
     dot — точка по легенде §6 для статусных чипов (агент: Активен / В разработке / Заглушка). */
  function metaChips(chips) {
    if (!chips || !chips.length) return '';
    return '<div class="lab-hero__meta">' + chips.map(function (c) {
      var label = typeof c === 'object' ? (c.key ? i18nText(c.key, c.label) : c.label) : c;
      var className = typeof c === 'object' && c.className ? ' ' + esc(c.className) : '';
      var dot = typeof c === 'object' && c.dot ? '<span class="lab-hero__chip-dot" aria-hidden="true"></span>' : '';
      if (typeof c === 'object' && c.action) {
        return '<button type="button" class="lab-hero__chip lab-hero__chip--action' + className + '"' +
          ' data-lab-action="' + esc(c.action) + '">' + dot + esc(label) + '</button>';
      }
      return '<span class="lab-hero__chip' + className + '">' + dot + esc(label) + '</span>';
    }).join('') + '</div>';
  }

  /* Единая шапка разделов (эталон — «Анализаторы»).
     config: { kicker, title, subtitle, icon, meta:[] } */
  function heroHtml(config) {
    var titleId = config.titleId ? ' id="' + config.titleId + '"' : '';
    var titleTone = config.titleTone === 'ink' ? ' lab-hero__title--ink' : '';
    return (
      '<div class="lab-hero__body">' +
        (config.kicker ? '<p class="lab-hero__kicker">' + esc(config.kicker) + '</p>' : '') +
        '<h1 class="lab-hero__title' + titleTone + '"' + titleId + '>' +
          '<span class="lab-hero__title-main">' +
          (config.icon ? '<img class="lab-hero__icon" src="assets/icons/32/' + config.icon + '" alt="" aria-hidden="true">' : '') +
          esc(config.title) +
          '</span>' +
        '</h1>' +
        (config.badge ? '<span class="lab-hero__badge ' + esc(config.badge.className || '') + '">' + esc(config.badge.label) + '</span>' : '') +
        (config.subtitle ? '<p class="lab-hero__subtitle' + (config.subtitleClass ? ' ' + esc(config.subtitleClass) : '') + '">' + esc(config.subtitle) + '</p>' : '') +
        metaChips(config.meta) +
      '</div>' +
      // Глиф-чип справа: квадрат hairline, палео-глиф тоном шапки (§5.1).
      (config.glyphIcon
        ? '<span class="lab-hero__glyph" aria-hidden="true"><i data-lucide="' + esc(config.glyphIcon) + '"></i></span>'
        : (config.glyph ? '<span class="lab-hero__glyph" aria-hidden="true">' + esc(config.glyph) + '</span>' : ''))
    );
  }

  var TARGETS = {
    'dashboard': {
      kicker: 'АЛЕФИ · РАБОЧИЙ СТОЛ',
      title: 'Рабочий стол исследователя',
      subtitle: 'Сводка текущего поля: корни, дела, словари и переходы между слоями исследования.',
      icon: 'archaeology/testtube.png'
    },
    'manifest': {
      kicker: 'АЛЕФИ · МАНИФЕСТ',
      title: 'Манифест проекта',
      subtitle: 'Четыре акта восстановления: увидеть проблему, собрать метод, применить его и войти в практику.',
      icon: 'ui/scroll.png'
    },
    'workbench': {
      kicker: 'АЛЕФИ · МАСТЕРСКАЯ',
      title: 'Мастерская',
      subtitle: 'Хаб действий: каталог конвейеров, запуски, прогресс и результаты работ.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'learn': {
      kicker: 'АЛЕФИ · ОБУЧЕНИЕ',
      title: 'Обучение',
      subtitle: 'Возвращение к предметному образу буквы: от знака к действию, от наблюдения к собранному смыслу.',
      icon: 'ui/book.png'
    },
    'club': {
      kicker: 'АЛЕФИ · КЛУБ · СВИВА ИССЛЕДОВАТЕЛЕЙ',
      title: 'Палео-клуб',
      subtitle: 'Закрытое сообщество исследователей: буква и корень дня, живые сессии и круги практики.',
      icon: 'paleo/track.png'
    },
    'researches': {
      kicker: 'АЛЕФИ · ИССЛЕДОВАНИЯ',
      title: 'Исследования',
      subtitle: 'Архив исследовательских материалов о языке, истории, экономике и других сферах.',
      icon: 'scribe/scrolls.png'
    },
    'root-dictionary': {
      kicker: 'АЛЕФИ · СЛОВАРИ · КОРНЕВОЙ',
      title: 'Корневой словарь',
      subtitle: 'Поиск по корням иврита. Введите корень, слово или значение. Граф использует только палео-письмо.',
      icon: 'ui/book.png'
    },
    'heraldry': {
      kicker: 'АЛЕФИ · ГЕРБОВНИК',
      title: 'Гербовник',
      subtitle: 'Знаки, образы и связки смыслов, собранные в палео-образную систему.',
      icon: 'scribe/scrolls.png'
    },
    'cartography': {
      kicker: 'АЛЕФИ · КАРТОГРАФИЯ',
      title: 'Картография',
      subtitle: 'Карта смысловых территорий, переходов и подмен, которые формируют Свиву.',
      icon: 'ui/web.png'
    },
    'states': {
      kicker: 'АЛЕФИ · КАРТА СОСТОЯНИЙ',
      title: 'Карта состояний',
      subtitle: 'Наблюдение за состояниями системы и переходами между ними.',
      icon: 'ui/web.png'
    },
    'state-checker': {
      kicker: 'АЛЕФИ · ЧЕКЕР СТРАН',
      title: 'Чекер стран',
      subtitle: 'Диагностика страны по восьми состояниям пространств: доминанта, распределение и вывод.',
      icon: 'ui/web.png'
    },
    'tree-checker': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ · ДЕРЕВО',
      title: 'Чекер дерева',
      subtitle: 'Проведите учение от семени до плодов: на каждом уровне зафиксируйте наблюдение и оцените, держится ли дерево.',
      titleTone: 'ink',
      meta: [
        { label: 'Быстрая проверка:', className: 'lab-hero__chip--label' },
        { key: 'lab.treeChecker.quickPreset', label: 'Троица', action: 'tree-preset' },
        { key: 'lab.treeChecker.quickReset', label: 'Очистить', action: 'tree-reset' }
      ]
    },
    'paleo-mechanics': {
      kicker: 'АЛЕФИ · ПАЛЕО-МЕХАНИКА',
      title: 'Палео-механика',
      subtitle: 'Механика действия: как корень собирает движение, форму и результат.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'paleo-linguistics': {
      kicker: 'АЛЕФИ · ПАЛЕО-ЛИНГВИСТИКА',
      title: 'Палео-лингвистика',
      subtitle: 'Эволюция письма и языка через форму букв, корни и физику образа.',
      icon: 'scribe/scroll.png'
    },
    'paleo-builder': {
      kicker: 'АЛЕФИ · ПАЛЕО-КОНСТРУКТОР',
      title: 'Палео-конструктор',
      subtitle: 'Соберите слово как последовательность образов и действий.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'prompt-generator': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОР ПРОМПТОВ',
      title: 'Генератор промптов',
      subtitle: 'Сборка точного исследовательского запроса из фрагментов, методов и ограничений.',
      icon: 'ui/question.png'
    },
    'video-lab': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОРЫ · ВИЗУАЛИЗАЦИЯ',
      title: 'Генератор видео-образов',
      subtitle: 'Визуализируй механику слова: буквы, состояния и переходы в движении.',
      glyphIcon: 'clapperboard'
    },
    'board': {
      kicker: 'АЛЕФИ · ИССЛЕДОВАТЕЛЬСКАЯ ДОСКА',
      title: 'Исследовательская доска',
      subtitle: 'Связывайте наблюдения, источники и гипотезы в едином поле Хук / Свива.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'board-library': {
      kicker: 'АЛЕФИ · БИБЛИОТЕКА',
      title: 'Библиотека',
      subtitle: 'Архив исследовательских досок, к которым можно вернуться и продолжить сборку.',
      icon: 'scribe/scrolls.png'
    },
    'religionism-checker': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ',
      title: 'Чекеры',
      subtitle: 'Проверка текста на устойчивые подмены и расхождения между словом и его конструкцией.',
      icon: 'ui/question.png'
    },
    'davar-checker': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ · ВОПЛОЩЕНИЕ',
      title: 'Чекер воплощения',
      subtitle: 'Проверка слова: обозначает ли оно конструкцию с физическим эквивалентом или остаётся пустым звуком.',
      icon: 'ui/question.png'
    },
    'translation-comparator': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ',
      title: 'Компаратор переводов',
      subtitle: 'Сопоставьте переводы и найдите смысловые сдвиги.',
      icon: 'ui/scales.png'
    },
    'checkers': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ',
      title: 'Чекеры',
      subtitle: 'Проверьте текст на смысловые подмены и сопоставьте формулировку с физикой исходного образа.',
      icon: 'ui/question.png'
    },
    'generators': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОРЫ',
      title: 'Генераторы',
      subtitle: 'Соберите рабочее поле, маршрут исследования или точный запрос к инструменту.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'timescale-generator': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОР ШКАЛЫ',
      title: 'Генератор шкалы времени',
      subtitle: 'Диапазон, ленты и шаг оси: события по датам одной линией.',
      icon: 'ui/clock.png'
    },
    'hypothesis-generator': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОР ГИПОТЕЗ',
      title: 'Генератор гипотез',
      subtitle: 'Альтернативные чтения объекта с открытым тестом на опровержение.',
      icon: 'ui/diff.png'
    },
    'clue-generator': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОР УЛИК',
      title: 'Генератор улик',
      subtitle: 'Соберите наблюдения в цепочку: от факта через связь к выводу.',
      icon: 'ui/link.png'
    },
    'word-analyzer': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'Разбор слов',
      subtitle: 'Переход от формы слова к корню, образу и карте смысловых сдвигов.',
      icon: 'archaeology/testtube.png'
    },
    'etymology-checker': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ',
      title: 'Чекер этимологии',
      subtitle: 'Проверь слово на соответствие палео-корням, образам и карте утрат.',
      icon: 'archaeology/testtube.png'
    },
    'scripture-reader': {
      kicker: 'АЛЕФИ · КНИГОЧТЕНИЕ',
      title: 'Книгочтение',
      subtitle: 'Чтение текста по слоям: строка, корень, образ и действие.',
      icon: 'ui/book.png'
    },
    'research-generator': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОР ИССЛЕДОВАНИЙ',
      title: 'Генератор исследований',
      subtitle: 'Сборка исследовательского маршрута из темы, источников, корней и методов.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'board-generator': {
      kicker: 'АЛЕФИ · ГЕНЕРАТОР ДОСОК',
      title: 'Генератор исследовательских досок',
      subtitle: 'Создание рабочего поля для связки наблюдений, источников и гипотез.',
      icon: 'scribe/scroll.png'
    },
    'investigation': {
      kicker: 'АЛЕФИ · РАССЛЕДОВАНИЕ',
      title: 'Расследование',
      subtitle: 'Пошаговое движение от наблюдения к источнику, сдвигу и восстановленному выводу.',
      icon: 'ui/question.png'
    },
    'religionisms': {
      kicker: 'АЛЕФИ · РЕЛИГИОНИЗМЫ',
      title: 'Религионизмы',
      subtitle: 'Карта устойчивых формул и слоёв, через которые смысл отрывается от конструкции.',
      icon: 'ui/question.png'
    },
    'vision': {
      kicker: 'АЛЕФИ · АНАЛИЗ ИЗОБРАЖЕНИЙ',
      title: 'Визуальный анализатор',
      subtitle: 'Чтение изображения как поля знаков, форм и связей.',
      icon: 'archaeology/lamp.png'
    },
    'ai-agents': {
      kicker: 'АЛЕФИ · АГЕНТЫ',
      title: 'AI-Агенты',
      subtitle: 'Исследовательские роли для сбора, проверки и связывания материала.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'pipelines': {
      kicker: 'АЛЕФИ · ПАЙПЛАЙНЫ',
      title: 'Пайплайны',
      subtitle: 'Готовые цепочки передачи контекста между агентами.',
      icon: 'paleo/track.png'
    },
    'agent-server': {
      kicker: 'АЛЕФИ · ЛОКАЛЬНЫЙ КОНТУР',
      title: 'Запуск сервера',
      subtitle: 'Статус, остановка и перезапуск агентного сервера; первый запуск — через start-server.bat.',
      icon: 'ui/settings.png'
    },
    'ed-chat': {
      kicker: 'АЛЕФИ · НЕЙРОЧАТ',
      title: 'Нейрочат',
      subtitle: 'Диалоговое поле для уточнения наблюдений и сборки следующего шага.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'paleo-keyboard': {
      kicker: 'АЛЕФИ · ПАЛЕО-КЛАВИАТУРА',
      title: 'Палео-клавиатура',
      subtitle: 'Набор палео-формы и переход к разбору слова через знак и действие.',
      icon: 'paleo/track.png'
    },
    'dictionaries': {
      kicker: 'АЛЕФИ · СЛОВАРИ',
      title: 'Словари',
      subtitle: 'Словарные карты подмен с ивритским соответствием и палео-формой.',
      icon: 'ui/book.png'
    },
    'methodology': {
      kicker: 'АЛЕФИ · МЕТОДОЛОГИЯ',
      title: 'Методология',
      subtitle: 'Манифест, принципы, методы разоблачения и механизмы подмены — в едином интерфейсе с карточками.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'language-map': {
      kicker: 'АЛЕФИ · КАРТА ЯЗЫКОВ',
      title: 'Карта языков',
      subtitle: 'Сравнение живых языков по способности собирать Давар и переводить речь между состояниями.',
      icon: 'paleo/track.png'
    },
    'linguistic-tensor': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'Лингвистический тензор',
      subtitle: 'Сопоставьте два языка и посмотрите, где их поток удерживает действие, корень и физику образа.',
      icon: 'archaeology/testtube.png'
    },
    'timeline': {
      kicker: 'АЛЕФИ · ПАЛЕО-ТАЙМЛАЙН',
      title: 'Каталог таймлайнов',
      subtitle: 'Хронологические карты событий: от палео-ивритского письма до цифровых инструментов восстановления.',
      icon: 'paleo/track.png'
    },
    'admin-settings': {
      kicker: 'АЛЕФИ · НАСТРОЙКИ',
      title: 'Настройки / Администрирование',
      subtitle: 'Управление моделями, кэшем, агентами и состоянием исследовательской системы.',
      icon: 'ui/settings.png'
    },
    'exposure-editor': {
      kicker: 'АЛЕФИ · РЕДАКТОР',
      title: 'Редактор разоблачений',
      subtitle: 'Сборка материала, источников и выводов в единое исследовательское дело.',
      icon: 'archaeology/lamp.png'
    },
    'name-decoder': {
      kicker: 'АЛЕФИ · ЧЕКЕРЫ',
      title: 'Чекер имени',
      subtitle: 'Соберите имя как последовательность букв, образов и возможных направлений действия.',
      icon: 'paleo/track.png'
    },
    'analyzers': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'Анализаторы',
      subtitle: 'Вертикальные инструменты для диагностики текста: увидеть слой, проверить смысловой сдвиг и найти слова, которые требуют палео-восстановления.',
      icon: 'archaeology/testtube.png'
    },
    'layer-analyzer': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'Слой-анализ',
      subtitle: 'Измерьте присутствие восьми слоёв и найдите доминирующий сдвиг.',
      icon: 'ui/map.png'
    },
    'ai-analyzer': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'ИИ-анализ',
      subtitle: 'Получите смысловую интерпретацию с прозрачным выбором режима и модели.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'dialect-analyzer': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'Диалект-анализ',
      subtitle: 'Найдите грецизмы и латинизмы и соберите карту возможных замен.',
      icon: 'scribe/scroll.png'
    },
    'state-analyzer': {
      kicker: 'АЛЕФИ · АНАЛИЗАТОРЫ',
      title: 'Анализатор состояний',
      subtitle: 'Выберите состояние потока и получите связанный псалом с краткой диагностикой.',
      icon: 'paleo/track.png'
    }
  };
    /* Внутренние экраны модулей: '<moduleId>/<view>' → шапка экрана.
     Новая внутренняя страница регистрируется здесь одной записью,
     общая логика подмены не меняется.
     Экраны с динамическим заголовком (из данных) задаются через override
     в LabHero.setView(..., 'detail', { title, subtitle }). */
  var VIEWS = {
    'workbench/run': {
      kicker: 'АЛЕФИ · МАСТЕРСКАЯ',
      title: 'Запуск конвейера',
      subtitle: 'Вход, смета и движение по этапам конвейера.',
      icon: 'crafts/hammer-and-chisel.png'
    },
    'workbench/project': {
      kicker: 'АЛЕФИ · МАСТЕРСКАЯ',
      title: 'Проект',
      subtitle: 'Результат конвейера в специализированном взоре.',
      icon: 'scribe/scrolls.png'
    },
    'club/discussions': {
      kicker: 'АЛЕФИ · КЛУБ · СВИВА ИССЛЕДОВАТЕЛЕЙ',
      title: 'Обсуждения',
      subtitle: 'Исследовательские темы клуба: наблюдения, источники, гипотезы и проверяемые выводы.',
      icon: 'paleo/track.png'
    },
    'learn/lessons': {
      kicker: 'АЛЕФИ · ОБУЧЕНИЕ',
      title: 'Изучение иврита',
      subtitle: 'Выберите букву. Серый — не начат, золотой — в процессе, зелёный — завершён.',
      icon: 'ui/book.png'
    },
    'learn/courses': {
      kicker: 'АЛЕФИ · ОБУЧЕНИЕ',
      title: 'Курсы',
      subtitle: 'Практические курсы: без воды, от простого к глубокому, с результатом после каждого модуля.',
      icon: 'ui/book.png'
    },
    'learn/lesson': {
      kicker: 'АЛЕФИ · ОБУЧЕНИЕ',
      title: 'Урок',
      subtitle: 'Возвращение к предметному образу буквы: от знака к действию, от наблюдения к собранному смыслу.',
      icon: 'ui/book.png'
    },
    'learn/game': {
      kicker: 'АЛЕФИ · ОБУЧЕНИЕ',
      title: 'Игра «Угадай образ»',
      subtitle: 'Угадайте букву по палео-образу, соблюдая цепочку знак → действие.',
      icon: 'ui/book.png'
    },
    'learn/paleo-trainer': {
      kicker: 'АЛЕФИ · ОБУЧЕНИЕ · ПАЛЕО-ТРЕНАЖЁР',
      title: 'Палео-тренажёр',
      subtitle: 'Крупные палео-буквы: увидь образ, назови функцию, собери смысл и проверь себя на словах из корней.',
      icon: 'ui/book.png'
    },
    'club': {
      kicker: 'АЛЕФИ · КЛУБ · СВИВА ИССЛЕДОВАТЕЛЕЙ',
      title: 'Палео-клуб',
      subtitle: 'Закрытое сообщество исследователей. Буква и корень дня, живые сессии, круги практики.',
      icon: 'paleo/track.png'
    },
    'states/diagnostic': {
      kicker: 'АЛЕФИ · КАРТА СОСТОЯНИЙ',
      title: 'Диагностика состояния',
      subtitle: 'Ответь на 7 вопросов, чтобы определить своё текущее пространство.',
      icon: 'archaeology/testtube.png'
    },
    'states/detail': {
      kicker: 'АЛЕФИ · КАРТА СОСТОЯНИЙ',
      title: 'Состояние',
      subtitle: 'Палео-физика состояния: образ, переходы и города.',
      icon: 'ui/web.png'
    },
    'timeline/catalog': {},
    'timeline/detail': {
      kicker: 'АЛЕФИ · ПАЛЕО-ТАЙМЛАЙН',
      title: 'Хронологический слой',
      subtitle: 'События таймлайна: от палео-ивритского письма до цифровых инструментов восстановления.',
      icon: 'paleo/track.png'
    },
    'paleo-linguistics/detail': {
      kicker: 'АЛЕФИ · ПАЛЕО-ЛИНГВИСТИКА',
      title: 'Язык',
      subtitle: 'Эволюция алфавита: прото-ханаанский → палео-иврит → финикийский.',
      icon: 'scribe/scroll.png'
    },
    'language-map/detail': {
      kicker: 'АЛЕФИ · КАРТА ЯЗЫКОВ',
      title: 'Язык',
      subtitle: 'Диагностика языка через палео-механику: Давар, переходы, близость к реальности.',
      icon: 'paleo/track.png'
    },
    'ai-agents/detail': {},
    'pipelines/detail': {},
    'researches/detail': {}
  };

  var activeViews = {};
  var observedContainers = [];
  var documentObserver = null;
  var scheduled = false;

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  /* Модуль без записи в TARGETS получает генерический герой из имени маршрута:
     служебный текст («нет записи») пользователю не показывается никогда,
     о пропуске сообщаем только в консоль. */
  function routeLabel(moduleId) {
    var words = String(moduleId || '').replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    return words.map(function (word) {
      return word ? word.charAt(0).toLocaleUpperCase('ru-RU') + word.slice(1) : word;
    }).join(' ');
  }

  function fallbackConfig(moduleId) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[LabHero] нет TARGETS для маршрута «' + moduleId + '» — собран генерический герой');
    }
    return {
      kicker: 'АЛЕФИ',
      title: i18nText('lab.nav.' + moduleId, routeLabel(moduleId)),
      subtitle: ''
    };
  }

  function createHero(moduleId, config) {
    var hero = createElement('section', 'lab-hero', '');
    hero.setAttribute('aria-labelledby', 'lab-hero-title-' + moduleId);
    hero.setAttribute('data-lab-hero', moduleId);
    var cfg = Object.assign({}, config, { titleId: 'lab-hero-title-' + moduleId });
    hero.innerHTML = heroHtml(cfg);
    return hero;
  }

  function findHero(container, moduleId) {
    for (var i = 0; i < container.children.length; i++) {
      if (container.children[i].classList.contains('lab-hero') &&
          container.children[i].getAttribute('data-lab-hero') === moduleId) {
        return container.children[i];
      }
    }
    return null;
  }

  function ensureHero(container, moduleId, config) {
    var hero = findHero(container, moduleId);
    if (!hero) {
      hero = createHero(moduleId, config);
      container.insertBefore(hero, container.firstChild);
    } else if (container.firstChild !== hero) {
      container.insertBefore(hero, container.firstChild);
    }
    container.classList.add('lab-hero-module', 'lab-hero-module--' + moduleId);
    return hero;
  }

  function mount(container) {
    if (!container || !container.id || !TARGETS[container.id]) return;
    ensureHero(container, container.id, resolveConfig(container.id, TARGETS[container.id]));
  }

  /* Подмена шапки под внутренний экран модуля (вызывается после рендера экрана).
     viewId = null возвращает базовую шапку модуля.
     override уточняет конфиг для экрана с динамическим заголовком. */
  function setView(moduleId, viewId, override) {
    var base = TARGETS[moduleId] || fallbackConfig(moduleId);
    var container = document.getElementById(moduleId);
    if (!container) return;
    var viewRoute = moduleId + '/' + viewId;
    var config = Object.assign({}, resolveConfig(moduleId, base),
      resolveConfig('views/' + viewRoute, (viewId && VIEWS[viewRoute]) || {}), override || {});
    activeViews[moduleId] = { viewId: viewId, override: override };
    var hero = ensureHero(container, moduleId, config);
    // Учитываем всю визуальную конфигурацию: старый hero мог остаться в DOM
    // после hot reload, если совпадали только title и subtitle.
    var signature = JSON.stringify({
      view: viewId || '',
      kicker: config.kicker || '',
      title: config.title || '',
      subtitle: config.subtitle || '',
      subtitleClass: config.subtitleClass || '',
      icon: config.icon || '',
      glyph: config.glyph || '',
      glyphIcon: config.glyphIcon || '',
      titleTone: config.titleTone || '',
      badge: config.badge || null,
      meta: config.meta || []
    });
    if (hero.getAttribute('data-lab-hero-view') !== signature) {
      hero.setAttribute('data-lab-hero-view', signature);
      hero.innerHTML = heroHtml(Object.assign({}, config, { titleId: 'lab-hero-title-' + moduleId }));
      // После обновления шапки router восстанавливает крошки текущего маршрута.
      if (window.LabRouter && window.LabRouter.refreshBreadcrumbs) {
        window.LabRouter.refreshBreadcrumbs(moduleId);
      }
    }
  }

  /* Единый источник подписей для шапки и хлебных крошек. */
  function getTitle(route) {
    var config = TARGETS[route] || VIEWS[route];
    return config && config.title ? resolveConfig(TARGETS[route] ? route : 'views/' + route, config).title : '';
  }

  // Locale loading may finish after the first module render; keep dynamic overrides.
  document.addEventListener('alephy:langchange', function() {
    Object.keys(TARGETS).forEach(function(moduleId) {
      var container = document.getElementById(moduleId);
      if (!container || !findHero(container, moduleId)) return;
      var view = activeViews[moduleId] || {};
      setView(moduleId, view.viewId || null, view.override);
    });
  });

  function scan() {
    var root = document.querySelector(ROOT_SELECTOR) || document.body;
    Object.keys(TARGETS).forEach(function(moduleId) {
      var container = document.getElementById(moduleId);
      if (!container) return;
      mount(container);
      if (observedContainers.indexOf(container) === -1) {
        observedContainers.push(container);
        if (window.MutationObserver) {
          new MutationObserver(function() { scheduleScan(); }).observe(container, { childList: true });
        }
      }
    });
    if (root && !documentObserver && window.MutationObserver) {
      documentObserver = new MutationObserver(function() { scheduleScan(); });
      documentObserver.observe(root, { childList: true, subtree: true });
    }
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(function() {
      scheduled = false;
      scan();
    }, 0);
  }

  window.LabHero = {
    targets: TARGETS,
    views: VIEWS,
    render: function (config) { return heroHtml(config || {}); },
    mount: mount,
    mountAll: scan,
    setView: setView,
    getTitle: getTitle,
    observe: function() {
      scan();
      return this;
    }
  };
})(window, document);
/**
   * methodology.js — раздел «Методология»: полные названия рабочих табов.
 * CRUD карточек: localStorage (быстрый кеш) + запись в data/methodology/cards.json через
 * сервер products/agents/server.py (порт 8000).
 */
(function(window, document) {
  'use strict';

  var PAGE_TEMPLATE = '<section class="methodology-shell" aria-labelledby="methodology-title">' +
    '<header class="methodology-heading"><div><p class="methodology-kicker" id="methodology-hero-kicker">АЛЕФИ · ПРИНЦИПЫ РАЗОБЛАЧЕНИЯ</p><h1 id="methodology-title">Методология</h1><p class="subtitle methodology-hero-description" id="methodology-hero-description">Базовые правила, по которым выявляется подмена смысла и возвращается физика текста.</p></div></header>' +
    '<div class="methodology-toolbar methodology-navigation lab-card"><label class="methodology-select-label" for="methodology-category-select">Раздел методологии<select id="methodology-category-select" class="lab-input" aria-label="Раздел методологии"><option value="principles">Принципы разоблачения</option><option value="methods">Методы разоблачения</option><option value="mechanisms">Механизмы подмены</option><option value="shifts">Языковые сдвиги</option><option value="techniques">Приёмы подмены</option><option value="philosophemes">Греческие философемы</option><option value="distortions">Типы искажений</option><option value="matrices">Культурные матрицы</option><option value="paleo-translation">Принципы палео-перевода</option></select></label><label class="methodology-select-label" for="methodology-document-select">Документ<select id="methodology-document-select" class="lab-input" aria-label="Документ внутри раздела"><option value="">Все документы</option></select></label><button type="button" class="lab-btn lab-btn-primary lab-btn-sm" id="methodology-add-btn">Добавить карточку</button></div>' +
    '<div class="methodology-panel" id="methodology-panel" role="tabpanel" aria-live="polite"><div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка материалов…</div></div></div></section>';
  var DATA_PATH = 'data/methodology/cards.json';
  var MECHANISMS_DATA_PATH = 'data/methodology/mechanisms.json';
  var MATRICES_DATA_PATH = 'data/methodology/cultural-matrices.json';
  var METHODS_DATA_PATH = 'data/methodology/methods.json';
  var API_URL = 'http://localhost:8000/api/methodology/cards';
  var STORAGE_KEY = 'alephy_methodology_cards_v1';

  var CATEGORIES = [
    { key: 'principles', label: 'Принципы разоблачения' },
    { key: 'methods', label: 'Методы разоблачения' },
    { key: 'mechanisms', label: 'Механизмы подмены' },
    { key: 'shifts', label: 'Языковые сдвиги', source: 'language-shifts' },
    { key: 'techniques', label: 'Приёмы подмены', source: 'techniques' },
    { key: 'philosophemes', label: 'Греческие философемы', source: 'philosophemes' },
    { key: 'distortions', label: 'Типы искажений', source: 'distortions' },
    { key: 'matrices', label: 'Культурные матрицы' },
    { key: 'paleo-translation', label: 'Принципы палео-перевода' }
  ];

  var METHODOLOGY_HERO = {
    principles: {
      kicker: 'АЛЕФИ · ПРИНЦИПЫ РАЗОБЛАЧЕНИЯ',
      description: 'Базовые правила, по которым выявляется подмена смысла и возвращается физика текста.'
    },
    methods: {
      kicker: 'АЛЕФИ · МЕТОДЫ РАЗОБЛАЧЕНИЯ',
      description: 'Рабочие способы проверки слова, перевода и цепочки смысловых сдвигов.'
    },
    mechanisms: {
      kicker: 'АЛЕФИ · МЕХАНИЗМЫ ПОДМЕНЫ',
      description: 'Системные ходы, через которые живое действие превращается в застывшую формулу.'
    },
    shifts: {
      kicker: 'АЛЕФИ · ЯЗЫКОВЫЕ СДВИГИ',
      description: 'Десять изменений языка, которые меняют ритм, конкретность и присутствие исходного текста.'
    },
    techniques: {
      kicker: 'АЛЕФИ · ПРИЁМЫ ПОДМЕНЫ',
      description: 'Конкретные техники, которыми система искажает смысл и лишает слово силы.'
    },
    philosophemes: {
      kicker: 'АЛЕФИ · ГРЕЧЕСКИЕ ФИЛОСОФЕМЫ',
      description: 'Тридцать пять моделей мышления, которые перевод превратил в линзу для чтения ТаНаХа.'
    },
    distortions: {
      kicker: 'АЛЕФИ · ТИПЫ ИСКАЖЕНИЙ',
      description: 'Девять диагностических моделей, показывающих, как понятие теряет исходную физику в цепочке перевода.'
    },
    matrices: {
      kicker: 'АЛЕФИ · КУЛЬТУРНЫЕ МАТРИЦЫ',
      description: 'Пять слоёв — вавилонский, египетский, греческий, римский и славянский, — через которые текст прошёл до современного читателя.'
    },
    'paleo-translation': {
      kicker: 'АЛЕФИ · ПРИНЦИПЫ ПАЛЕО-ПЕРЕВОДА',
      description: 'Правила, по которым перевод восстанавливает конструкцию и сохраняет физику палео-образа.'
    }
  };

  var store = null; // { categories: {...}, cards: [...] }
  var activeTab = CATEGORIES[0].key;
  var activeDocument = '';
  var activeTechniqueCategory = '';
  var exposureDocuments = null;
  var paleoTranslationCards = [];
  var PALEO_TRANSLATION_FALLBACK = [
    ['Восстанавливай конструкцию, а не заменяй слова', 'Палео-перевод передаёт последовательность функций букв и описывает собранную конструкцию, а не подбирает привычный словарный эквивалент.'],
    ['Читай буквы как функции', 'Буквы являются образами предметов и действий. Сначала переводчик собирает их механику, и только затем формулирует русское описание.'],
    ['Убирай греческие философемы', 'Абстрактные понятия поздних слоёв перевода заменяются конкретными образами, действиями и состояниями исходной конструкции.'],
    ['Не добавляй прошедшее время', 'Вместо искусственной временной связки передавай состояние и происходящее действие, сохраняя живой поток текста.'],
    ['Не отделяй пространственные приставки', 'Пространственные отношения передавай как часть конструкции: слитные приставки сохраняют направление потока.'],
    ['Собирай каждый стих отдельно', 'Каждый стих имеет собственную последовательность букв и функций. Нельзя переносить готовую сборку по аналогии.'],
    ['Ставь действие в центр', 'Главное в предложении — то, что происходит. Перевод должен сохранять движение действия, а не превращать его в описание персонажа.'],
    ['Проверяй через физический опыт', 'Любой образ должен быть проверяем через тело, предмет или действие. Непроверяемая отвлечённость указывает на философему.'],
    ['Сохраняй поток, а не порядок слов', 'Русский порядок слов можно менять, если это помогает удержать очередность и направление палео-действия.'],
    ['Читай «это» как указание на действие', 'Указательное слово обозначает происходящее сейчас, а не неподвижную сущность или предмет.'],
    ['Выбирай конкретное', 'Если возможны отвлечённое и физическое прочтения, выбирай конкретный образ, который можно представить и проверить.'],
    ['Ставь точность выше красоты', 'Литературная гладкость не должна скрывать механику. Достоверный перевод сохраняет точность даже ценой непривычного звучания.'],
    ['Показывай неопределённость', 'Неясный элемент конструкции нужно отмечать, а не маскировать уверенной формулировкой.'],
    ['Начинай с букв', 'Не начинай с готового слова или традиционного значения. Сначала собери последовательность образов, затем сформулируй результат.'],
    ['Учитывай контекст', 'Функция слова определяется соседними конструкциями. Изолированный перевод может потерять направление всего потока.'],
    ['Используй заглавную букву как функцию', 'Заглавная буква обозначает начало новой смысловой конструкции, а не служит декоративным правилом.'],
    ['Не добавляй пунктуацию в поток', 'Паузы и связи передавай порядком конструкций и слитными приставками, не навязывая позднюю разметку.'],
    ['Оживляй образ физическим действием', 'Если последовательность букв нельзя представить как процесс в реальном мире, конструкция ещё не собрана.'],
    ['Не подменяй палео-образы современными корнями', 'Современные языки несут другую логику. Опирайся на палео-образ и его физическую механику.'],
    ['Сначала спрашивай «как»', 'Вопрос о механике действия важнее вопроса о причине. Сначала опиши, как работает конструкция.'],
    ['Используй ощущения для проверки', 'Телесный отклик помогает проверить поток, напряжение, дверь или воду.'],
    ['Ищи конструкции, а не границы слов', 'Первичен слитный поток согласных. Выделяй работающие последовательности образов, а не поздние пробелы.']
  ];

  var TECHNIQUE_CATEGORIES = [
    'Языковые приёмы',
    'Смысловые приёмы',
    'Социальные приёмы',
    'Экономические приёмы',
    'Финансовые приёмы',
    'Исторические приёмы',
    'Символические приёмы',
    'Межкультурные приёмы (вавилонский слой)'
  ];

  var PHILOSOPHEME_SECTIONS = /^\d+\.\s+/i;

  var LANGUAGE_SHIFT_TITLES = [
    'Заглавные буквы',
    'Знаки препинания',
    'Пробелы',
    'Гласные (огласовки)',
    'Абстракции',
    'Глагол «быть»',
    'Дуализм (тело/душа)',
    'Время (прошлое/настоящее/будущее)',
    'Имена → титулы',
    'Религия (священное/мирское)'
  ];

  var LANGUAGE_SHIFT_SUMMARIES = [
    'Равные по размеру буквы иврита заменили визуальной иерархией заглавных и строчных букв.',
    'Знаки препинания разбили ритм и дыхание текста на логические блоки.',
    'Пробелы разделили слитный поток речи и скрыли связь слов внутри смихута.',
    'Зафиксированные огласовки создали одно чтение там, где согласные допускали несколько вариантов.',
    'Конкретные действия и отношения заменили отвлечёнными понятиями: «истиной», «любовью» и «духовностью».',
    'Динамическое действие «быть» превратилось в статичную связку и описание сущности.',
    'Целостный человек стал разделённым на «душу» и «тело» по греческой дуалистической схеме.',
    'Завершённость и незавершённость действия заменили линейной шкалой прошлого, настоящего и будущего.',
    'Имена, несущие присутствие и смысл, заменили должностями и переводными титулами.',
    'Целостную жизнь перед Яхве разделили на «религиозную» и «мирскую» сферы.'
  ];

  var LANGUAGE_SHIFT_ICONS = [
    'ui/markbook.png',
    'ui/diff.png',
    'ui/arrows.png',
    'ui/book.png',
    'ui/question.png',
    'ui/enter.png',
    'ui/scales.png',
    'ui/clock.png',
    'ui/user.png',
    'ui/home.png'
  ];

  var MECHANISM_ICONS = [
    'ui/question.png',
    'ui/scales.png',
    'paleo/track.png',
    'ui/anchor.png',
    'ui/diff.png',
    'ui/arrows.png',
    'ui/markbook.png'
  ];

  var FIRST_MECHANISM_SUMMARY = 'Система берёт два понятия, которые в иврите имеют ясное функциональное различие, и заменяет их моральной оценкой. Функция становится моралью. Пригодность становится «добром». Непригодность — «злом».';

  var DISTORTION_SUMMARIES = [
    'Понятие заменяется на другое, искажая его истинную функцию.',
    'Живые отношения заменяются правовыми конструкциями.',
    'Внешние действия подменяются внутренними переживаниями.',
    'Действие заменяется чувством, а результат — состоянием.',
    'Конкретные образы заменяются отвлечёнными понятиями.',
    'Смысл теряет полноту и сужается до одного значения.',
    'Целостное дробится на противоположности.',
    'Полнота смысла заменяется пустотой.',
    'Палео-смыслы подменяются чужеродными категориями.'
  ];

  var LANGUAGE_TECHNIQUE_TITLES = [
    'Сакральный жаргон',
    'Абстрагирование',
    'Легитимация перевода',
    'Импорт вместо перевода',
    'Слова-пустышки',
    'Разрыв корневых связей',
    'Глагол → состояние',
    'Имя → безличный титул',
    'Стирание этимологии',
    'Кастрация смысла'
  ];

  var LANGUAGE_TECHNIQUE_SUMMARIES = [
    'Система создаёт специальный язык, непонятный непосвящённым, чтобы создать касту толкователей-посредников.',
    'Иврит говорит конкретно — кровь, вода, хлеб. Система заменяет это абстракциями: «душа», «дух», «вера».',
    'Каждый слой перевода добавляет и теряет смысл. За четыре шага живое наставление Торы становится мёртвым кодексом «закона».',
    'Система не переводит греческие слова, а импортирует их. Непонятное слово («епископ», «дьявол») создаёт зависимость от толкователя.',
    'Система внедряет слова, которые ничего не значат («духовность», «самореализация»), но создают иллюзию понимания.',
    'Иврит — язык корней. От одного корня растут десятки слов. Перевод разрывает эти связи, и смыслы теряют родство.',
    'Иврит мыслит глаголами: действие первично. Система заменяет их существительными-состояниями («вера», «покаяние»).',
    'Система заменяет личное обращение (Яхве) безличной формулой («Господь»), убивая личные отношения.',
    'Система сохраняет слово, но стирает память о его происхождении. Слово живо, но корень забыт («физика», «технология»).',
    'Система сохраняет оболочку слова, но полностью вынимает из него содержание. Слово звучит знакомо, но больше ничего не значит.'
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parsePaleoTranslationCards(markdown) {
    var headings = String(markdown || '').split(/\r?\n(?=##\s)/).slice(1);
    var icons = [
      'paleo/track.png', 'scribe/scroll.png', 'ui/scales.png', 'ui/clock.png',
      'nav/door.png', 'ui/grid.png', 'ui/arrows.png', 'ui/anchor.png',
      'archaeology/testtube.png', 'ui/markbook.png', 'ui/compass.png',
      'ui/question.png', 'ui/keyboard.png', 'ui/scroll.png', 'ui/book.png',
      'ui/diff.png', 'ui/info.png', 'ui/enter.png', 'ui/anchor.png',
      'ui/user.png', 'ui/flag.png', 'ui/hourglass.png', 'ui/sun.png',
      'ui/link.png', 'ui/grid.png'
    ];
    return headings.map(function(section, index) {
      var lines = section.split(/\r?\n/);
      var title = lines.shift().replace(/^##\s+/, '').trim();
      var text = lines.join('\n').trim();
      var summary = text.split(/\n\s*\n/)[0] || 'Принцип восстановления палео-конструкции.';
      return {
        id: 'paleo-translation-' + index,
        category: 'paleo-translation',
        title: title,
        summary: summary.replace(/\*\*/g, ''),
        text: text,
        icon: 'assets/icons/32/' + icons[index % icons.length],
        document: 'paleo-translation-card'
      };
    }).filter(function(card) { return card.title && card.text; });
  }

  function fallbackPaleoTranslationCards() {
    return PALEO_TRANSLATION_FALLBACK.map(function(item, index) {
      return {
        id: 'paleo-translation-' + index,
        category: 'paleo-translation',
        title: item[0],
        summary: item[1],
        text: item[1],
        icon: 'assets/icons/32/ui/book.png',
        document: 'paleo-translation-card'
      };
    });
  }

  var COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="11" rx="1.5"></rect><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"></path></svg>';
  var WAND_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 4l1.5 1.5M19 8l1.5 1.5M4 20l9-9M13 9l2 2"></path><path d="M15 4l-1 3 3-1z"></path></svg>';
  var EDIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h4l10-10-4-4L4 16v4z"></path><path d="M13 7l4 4"></path></svg>';
  var DELETE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14"></path><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"></path></svg>';
  var INFO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 10.5v5"></path><circle cx="12" cy="7.5" r=".7" fill="currentColor" stroke="none"></circle></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 13l4 4L19 7"></path></svg>';
  var SAVE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>';
  var MODAL_ICON = '<img src="assets/icons/32/ui/close.png" width="24" height="24" alt="" aria-hidden="true" style="vertical-align:middle;margin-right:8px;">';

  function toast(msg) {
    if (window.LabToast) window.LabToast.show(msg);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function() { fallbackCopy(text); });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  }

  function copyTextWithFeedback(btn, text) {
    copyText(text).then(function() {
      btn.innerHTML = CHECK_ICON;
      btn.classList.add('is-copied');
      setTimeout(function() {
        btn.innerHTML = COPY_ICON;
        btn.classList.remove('is-copied');
      }, 1500);
    });
  }

  function sendToPromptGenerator(title, text) {
    if (window.LabRouter) window.LabRouter.navigate('prompt-generator');
    var attempt = 0;
    function tryAdd() {
      if (window.PromptGenerator && typeof window.PromptGenerator.addExternalBlock === 'function') {
        window.PromptGenerator.addExternalBlock(title, text);
        toast('Добавлено в конструктор промптов');
        return;
      }
      attempt++;
      if (attempt < 30) setTimeout(tryAdd, 100);
    }
    setTimeout(tryAdd, 50);
  }

  // ===== ХРАНИЛИЩЕ =====
  function loadLocalStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocalStore(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function generateId(category) {
    return category + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }

  function persistStore() {
    saveLocalStore(store);
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(store)
    }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      toast('Сохранено в файл');
    }).catch(function() {
      toast('Сохранено локально. Файл не обновлён — запустите сервер на порту 8000.');
    });
  }

  window.MethodologyLab = {
    init: init,
    getCards: function() { return store ? (store.cards || []) : []; },
    getCategories: function() { return CATEGORIES; },
    openCard: function(id) { openFullText(findCard(id) || { title: id || 'Карточка методологии', summary: 'Материалы карточки загружаются из текущего раздела методологии.' }); }
  };

  function init(container, parsed) {
    if (!container) return;
    if (parsed && parsed.params && parsed.params.category) {
      var requestedCategory = parsed.params.category;
      var validCategory = CATEGORIES.some(function(cat) { return cat.key === requestedCategory; });
      if (validCategory) {
        // При переходе из поиска — переключение вкладки и повторный рендер.
        activeTab = requestedCategory;
        activeDocument = '';
        container.dataset.methodologyReady = '0';
      }
    }
    if (container.dataset.methodologyReady === '1') return;
    container.dataset.methodologyReady = '1';
    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка…</div></div>';

    container.innerHTML = PAGE_TEMPLATE;
    bindCategorySelect(container);
    bindDocumentSelect(container);
    bindAddButton(container);
    bindBackButton(container);
    loadStore(container);
  }

  function loadStore(container) {
    var paths = [DATA_PATH, MECHANISMS_DATA_PATH, MATRICES_DATA_PATH, METHODS_DATA_PATH];
    Promise.all(paths.map(function(path) {
      return fetch(path).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      }).catch(function() {
        return null;
      });
    })).then(function(dataSets) {
      var principleCards = Array.isArray(dataSets[0]) ? dataSets[0] : ((dataSets[0] && dataSets[0].cards) || []);
      var mechanismCards = Array.isArray(dataSets[1]) ? dataSets[1] : ((dataSets[1] && dataSets[1].cards) || []);
      var matrixCards = Array.isArray(dataSets[2]) ? dataSets[2] : ((dataSets[2] && dataSets[2].cards) || []);
      var methodCards = Array.isArray(dataSets[3]) ? dataSets[3] : ((dataSets[3] && dataSets[3].cards) || []);
      if (!principleCards.length && !mechanismCards.length && !matrixCards.length && !methodCards.length) {
        throw new Error('Источники методологии недоступны');
      }
      store = {
        categories: (dataSets[0] && dataSets[0].categories) || {},
        cards: principleCards.map(function(card, index) {
          return normalizeExternalCard(card, 'principles', index);
        }).concat(mechanismCards.map(function(card, index) {
          return normalizeExternalCard(card, 'mechanisms', index);
        })).concat(matrixCards.map(function(card, index) {
          return normalizeExternalCard(card, 'matrices', index);
        })).concat(methodCards.map(function(card, index) {
          return normalizeExternalCard(card, 'methods', index);
        }))
      };
      saveLocalStore(store);
      return fetch('data/exposures/documents.json').then(function(response) {
        if (!response.ok) return null;
        return response.json();
      }).catch(function() {
        return null;
      }).then(function(documents) {
        exposureDocuments = documents && Object.keys(documents).length ? documents : null;
        // Исходные docs не входят в публичный корень приложения.
        paleoTranslationCards = fallbackPaleoTranslationCards();
        showTab(container, activeTab);
      });
    }).catch(function() {
      var cached = loadLocalStore();
      if (cached) {
        store = cached;
        showTab(container, activeTab);
      } else {
        var panel = container.querySelector('#methodology-panel');
        if (panel) {
          panel.className = 'methodology-panel methodology-panel-empty';
          panel.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить материалы методологии. Проверьте подключение к серверу или обновите страницу после его запуска.</div>';
        }
      }
    });
  }

  function normalizeExternalCard(card, category, index) {
    return {
      id: card.id || category + '-' + (index + 1),
      category: category,
      title: card.title || 'Карточка методологии',
      summary: category === 'methods'
        ? String(card.summary || card.text || '').replace(/^\s*\*\s*/, '')
        : (card.summary || card.text || ''),
      text: card.text || card.summary || '',
      icon: card.icon || 'assets/icons/32/ui/book.png',
      document: category === 'mechanisms' ? 'mechanism-card' : (category === 'matrices' ? 'matrix-card' : (category === 'methods' ? 'method-card' : 'principle-card'))
    };
  }

  function bindCategorySelect(container) {
    var select = container.querySelector('#methodology-category-select');
    if (!select) return;
    select.value = activeTab;
    select.addEventListener('change', function() {
      activeTab = select.value;
      activeDocument = '';
      showTab(container, activeTab);
    });
  }

  function bindDocumentSelect(container) {
    var select = container.querySelector('#methodology-document-select');
    if (!select) return;
    select.addEventListener('change', function() {
      if (activeTab === 'techniques') {
        activeTechniqueCategory = select.value;
        activeDocument = '';
      } else {
        activeDocument = select.value;
      }
      showTab(container, activeTab);
    });
  }

  function bindAddButton(container) {
    var btn = container.querySelector('#methodology-add-btn');
    if (btn) btn.addEventListener('click', function() { openForm(container); });
  }

  function bindBackButton(container) {
    var btn = container.querySelector('#methodology-back-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      activeDocument = '';
      showTab(container, activeTab);
    });
  }

  function updateDocumentSelect(container, cards) {
    var select = container.querySelector('#methodology-document-select');
    if (!select) return;

    var options = ['<option value="">' + (activeTab === 'techniques' ? 'Выберите категорию' : 'Все документы') + '</option>'];
    cards.forEach(function(card) {
      options.push('<option value="' + escapeHtml(card.id) + '">' + escapeHtml(card.title || 'Документ') + '</option>');
    });
    select.innerHTML = options.join('');
    var hasActiveDocument = cards.some(function(card) { return card.id === activeDocument; });
    if (!hasActiveDocument) activeDocument = '';
    select.value = activeDocument;
  }

  function parseTechniqueCards(section, categoryIndex) {
    var lines = String(section && section.content || '').split(/\n+/);
    categoryIndex = categoryIndex == null ? TECHNIQUE_CATEGORIES.indexOf(activeTechniqueCategory) : categoryIndex;
    return lines.map(function(line, index) {
      var match = line.trim().match(/^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/);
      if (!match) return null;
      return {
        id: 'exposure-technique-' + categoryIndex + '-' + index,
        category: 'techniques',
        title: match[1],
        summary: techniqueCardSummary(match[1]),
        text: match[2],
        icon: 'assets/icons/32/ui/diff.png',
        document: 'technique-card'
      };
    }).filter(Boolean);
  }

  function techniqueCardSummary(title) {
    var label = cleanMethodTitle(title);
    return label + ' меняет смысл исходной конструкции.';
  }

  function cleanMethodTitle(title) {
    var clean = String(title || '').replace(/^\s*\d+[.)\-:]?\s*/, '').trim();
    return clean ? clean.charAt(0).toLocaleUpperCase('ru-RU') + clean.slice(1) : 'Метод разоблачения';
  }

  function methodEssence(text, fallback) {
    var source = String(text || '');
    var essence = source.match(/\*\*Суть:\*\*\s*([\s\S]*?)(?=\n\s*\*\*[^*]+:\*\*|\n\s*---|$)/i);
    if (essence) source = essence[1];
    else source = source.split(/\n\s*\n/)[0];
    source = source.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return source || fallback || 'Краткое описание метода разоблачения.';
  }

  function mechanismEssence(text) {
    var source = String(text || '').replace(/\r/g, '');
    var paragraph = source.split(/\n\s*\n/)[0]
      .replace(/^\s*[-*]\s*/, '')
      .replace(/^\s*\*{0,2}Суть:\s*\*{0,2}/i, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return paragraph
      ? paragraph.charAt(0).toLocaleUpperCase('ru-RU') + paragraph.slice(1)
      : 'Краткое описание механизма подмены.';
  }

  function displayCardTitle(title) {
    return cleanMethodTitle(title);
  }

  // Краткое описание строки реестра: не более четырёх строк, обрезка по границе слова.
  function displayCardSummary(summary) {
    var text = String(summary == null ? '' : summary)
      .replace(/^\s*\*{0,2}Суть:\s*\*{0,2}/i, '')
      .replace(/^\s*Суть\s*[-—:]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return text;
    text = text.charAt(0).toLocaleUpperCase('ru-RU') + text.slice(1);
    if (text.length <= 220) return text;
    var cut = text.lastIndexOf(' ', 220);
    return text.slice(0, cut > 120 ? cut : 220).replace(/[\s,;:—–-]+$/, '') + '…';
  }

  function findTechniqueCard(id) {
    var match = id.match(/^exposure-technique-(\d+)-(\d+)$/);
    if (!match || !exposureDocuments || !exposureDocuments.techniques) return null;

    var categoryIndex = parseInt(match[1], 10);
    var itemIndex = parseInt(match[2], 10);
    var category = TECHNIQUE_CATEGORIES[categoryIndex];
    var section = (exposureDocuments.techniques.sections || []).filter(function(candidate) {
      return candidate.title === category;
    })[0];
    if (!section) return null;

    var lines = String(section.content || '').split(/\n+/);
    var item = lines.map(function(line) {
      return line.trim().match(/^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/);
    }).filter(Boolean)[itemIndex];
    if (!item) return null;

    return {
      id: id,
      category: 'techniques',
      title: item[1],
      text: item[2]
    };
  }

  function updateHero(container, key, documentCard) {
    var heroData = METHODOLOGY_HERO[key] || METHODOLOGY_HERO.principles;
    var kicker = container.querySelector('#methodology-hero-kicker');
    var title = container.querySelector('#methodology-title');
    var description = container.querySelector('#methodology-hero-description');
    var back = container.querySelector('#methodology-back-btn');
    var heading = container.querySelector('.methodology-heading');
    if (!kicker || !description) return;

    if (heading) heading.classList.add('is-updating');
    setTimeout(function() {
      kicker.textContent = documentCard ? 'АЛЕФИ · ДОКУМЕНТ' : heroData.kicker;
      if (title) title.textContent = documentCard ? (documentCard.title || 'Документ') : 'Методология';
      description.textContent = documentCard ? (documentCard.summary || documentCard.text || heroData.description) : heroData.description;
      if (back) back.hidden = !documentCard;
      if (heading) heading.classList.remove('is-updating');
    }, 100);
  }

  function showTab(container, key) {
    var select = container.querySelector('#methodology-category-select');
    if (select) select.value = key;

    var panel = container.querySelector('#methodology-panel');
    if (!panel || !store) return;

    var category = CATEGORIES.filter(function(item) { return item.key === key; })[0] || {};
    var catInfo = (store.categories || {})[key] || {};

    var cards = (store.cards || []).filter(function(c) { return c.category === key; });
    if (key === 'paleo-translation') {
      cards = paleoTranslationCards;
    }
    if (category.source && exposureDocuments && exposureDocuments[category.source]) {
      var documentData = exposureDocuments[category.source];
      var sourceSections = (documentData.sections || []).filter(function(section) {
        return /^Сдвиг\s+\d+$/i.test(section.title || '');
      });
      if (key === 'shifts') {
        cards = sourceSections.slice(0, 10).map(function(section, index) {
          return {
            id: 'exposure-shifts-' + index,
            category: key,
            title: LANGUAGE_SHIFT_TITLES[index] || section.title,
            summary: LANGUAGE_SHIFT_SUMMARIES[index] || section.content,
            text: section.content,
            icon: 'assets/icons/32/' + LANGUAGE_SHIFT_ICONS[index],
            document: 'language-shift',
            sourceIndex: index
          };
        });
      } else if (key === 'mechanisms') {
        cards = (documentData.sections || []).filter(function(section) {
          return /^\s*\d+[.)\-:]?\s+/.test(section.title || '');
        }).map(function(section, index) {
          return {
            id: 'exposure-mechanism-' + (section.title || '').match(/^\s*(\d+)/)[1],
            category: key,
            title: cleanMethodTitle(section.title),
            summary: index === 0 ? FIRST_MECHANISM_SUMMARY : mechanismEssence(section.content),
            text: section.content,
            icon: 'assets/icons/32/' + MECHANISM_ICONS[index % MECHANISM_ICONS.length],
            document: 'mechanism-card'
          };
        });
      } else if (key === 'techniques') {
        var techniqueCategorySections = (documentData.sections || []).filter(function(section) {
          return TECHNIQUE_CATEGORIES.indexOf(section.title) !== -1;
        });
        var selectedTechniqueSections = activeTechniqueCategory
          ? techniqueCategorySections.filter(function(section) {
              return section.title === activeTechniqueCategory;
            })
          : techniqueCategorySections;
        cards = selectedTechniqueSections.reduce(function(allCards, section) {
          return allCards.concat(parseTechniqueCards(section, TECHNIQUE_CATEGORIES.indexOf(section.title)));
        }, []);
      } else if (key === 'philosophemes') {
        cards = (documentData.sections || []).filter(function(section) {
          return PHILOSOPHEME_SECTIONS.test(section.title || '');
        }).slice(0, 35).map(function(section, index) {
          var text = section.content || '';
          var summaryMatch = text.match(/^\*\*Философема:\*\*\s*([^\n]+)/i);
          return {
            id: 'exposure-philosopheme-' + index,
            category: key,
            title: section.title,
            summary: summaryMatch ? summaryMatch[1] : text.split('\n')[0],
            text: text,
            icon: 'assets/icons/32/ui/book.png',
            document: 'philosopheme-card'
          };
        });
      } else if (key === 'distortions') {
        cards = (documentData.sections || []).filter(function(section) {
          return PHILOSOPHEME_SECTIONS.test(section.title || '') && /^([1-9])\./.test(section.title || '');
        }).slice(0, 9).map(function(section, index) {
          var text = DISTORTION_SUMMARIES[index];
          return {
            id: 'exposure-distortion-' + index,
            category: key,
            title: cleanMethodTitle(section.title),
            summary: text,
            text: text,
            icon: 'assets/icons/32/ui/scales.png',
            document: 'distortion-card'
          };
        });
      } else {
        cards = [{
          id: 'exposure-' + key,
          category: key,
          title: documentData.title,
          summary: documentData.description,
          text: documentData.sections.map(function(section) {
            return '## ' + section.title + '\n\n' + section.content;
          }).join('\n\n---\n\n'),
          document: 'source-document'
        }];
      }
    }
    if (key === 'techniques') {
      var categorySelect = container.querySelector('#methodology-document-select');
      if (categorySelect) {
        categorySelect.innerHTML = ['<option value="">Все документы</option>'].concat(TECHNIQUE_CATEGORIES.map(function(category) {
          return '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>';
        })).join('');
        categorySelect.value = activeTechniqueCategory;
      }
    } else {
      updateDocumentSelect(container, cards);
    }
    var selectedDocument = activeDocument && key !== 'techniques'
      ? cards.filter(function(card) { return card.id === activeDocument; })[0]
      : null;
    updateHero(container, key, selectedDocument);
    if (activeDocument && key !== 'techniques') {
      cards = cards.filter(function(card) { return card.id === activeDocument; });
    }
    renderPanel(container, panel, cards);
  }

  function renderPanel(container, panel, cards) {
    if (!cards.length) {
      panel.className = 'methodology-panel methodology-panel-empty';
      panel.innerHTML = '<div class="lab-alert lab-alert-info">Материалы пока не заполнены.</div>';
      return;
    }

    panel.className = 'methodology-panel';
    panel.innerHTML = cards.map(function(card, index) {
      var cardText = displayCardSummary(card.summary || card.text);
      var cardTitle = displayCardTitle(card.title);
      var cardIcon = card.icon
        ? '<img src="' + escapeHtml(card.icon) + '" class="methodology-card-icon" alt="" aria-hidden="true">'
        : '';
      // Порядковый номер держит строку реестра читаемой без рамок и теней.
      var cardNumber = ('0' + (index + 1)).slice(-2);
      var infoButton = '<button type="button" class="methodology-icon-btn methodology-info-btn" data-id="' + escapeHtml(card.id) + '" onclick="MethodologyLab.openCard(this.dataset.id); return false;" title="Открыть полный текст" aria-label="Открыть полный текст карточки">' + INFO_ICON + '</button>';
      return '<article class="methodology-card" data-id="' + escapeHtml(card.id) + '">' +
        '<span class="methodology-card-index" aria-hidden="true">' + cardNumber + '</span>' +
        '<div class="methodology-card-body">' +
          '<div class="methodology-card-head">' + cardIcon + '<h3 class="methodology-card-title">' + escapeHtml(cardTitle) + '</h3></div>' +
          '<p class="methodology-card-text">' + escapeHtml(cardText) + '</p>' +
        '</div>' +
        '<div class="methodology-card-actions">' +
          infoButton +
          '<button type="button" class="methodology-icon-btn methodology-copy-btn" data-id="' + escapeHtml(card.id) + '" title="Копировать" aria-label="Копировать карточку">' + COPY_ICON + '</button>' +
          '<button type="button" class="methodology-icon-btn methodology-prompt-btn" data-id="' + escapeHtml(card.id) + '" title="В конструктор промптов" aria-label="Отправить в конструктор промптов">' + WAND_ICON + '</button>' +
          '<button type="button" class="methodology-icon-btn methodology-edit-btn" data-id="' + escapeHtml(card.id) + '" title="Редактировать" aria-label="Редактировать карточку">' + EDIT_ICON + '</button>' +
          '<button type="button" class="methodology-icon-btn methodology-delete-btn" data-id="' + escapeHtml(card.id) + '" title="Удалить" aria-label="Удалить карточку">' + DELETE_ICON + '</button>' +
        '</div>' +
      '</article>';
    }).join('');

    bindCardActions(container, panel);
  }

  function findCard(id) {
    var cards = store.cards || [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].id === id) return cards[i];
    }
    if (id.indexOf('exposure-technique-') === 0) {
      return findTechniqueCard(id);
    }
    if (id.indexOf('paleo-translation-') === 0) {
      return paleoTranslationCards.filter(function(card) { return card.id === id; })[0] || null;
    }
    if (id.indexOf('exposure-philosopheme-') === 0 && exposureDocuments) {
      var philosophemeIndex = parseInt(id.substring('exposure-philosopheme-'.length), 10);
      var philosophemeDocument = exposureDocuments.philosophemes;
      var philosophemeSection = philosophemeDocument && (philosophemeDocument.sections || []).filter(function(section) {
        return PHILOSOPHEME_SECTIONS.test(section.title || '');
      })[philosophemeIndex];
      if (philosophemeSection) {
        return {
          id: id,
          category: 'philosophemes',
          title: philosophemeSection.title,
          text: philosophemeSection.content
        };
      }
    }
    if (id.indexOf('exposure-distortion-') === 0 && exposureDocuments) {
      var distortionIndex = parseInt(id.substring('exposure-distortion-'.length), 10);
      var distortionDocument = exposureDocuments.distortions;
      var distortionSection = distortionDocument && (distortionDocument.sections || []).filter(function(section) {
        return PHILOSOPHEME_SECTIONS.test(section.title || '') && /^([1-9])\./.test(section.title || '');
      })[distortionIndex];
      if (distortionSection) {
        return {
          id: id,
          category: 'distortions',
          title: distortionSection.title,
          text: distortionSection.content
        };
      }
    }
    if (id.indexOf('exposure-shifts-') === 0 && exposureDocuments) {
      var shiftIndex = parseInt(id.substring('exposure-shifts-'.length), 10);
      var shiftsDocument = exposureDocuments['language-shifts'];
      var shiftSection = shiftsDocument && (shiftsDocument.sections || []).filter(function(section) {
        return /^Сдвиг\s+\d+$/i.test(section.title || '');
      })[shiftIndex];
      if (shiftSection) {
        return {
          id: id,
          category: 'shifts',
          title: LANGUAGE_SHIFT_TITLES[shiftIndex] || shiftSection.title,
          text: shiftSection.content
        };
      }
    }
    if (id.indexOf('exposure-methods-language-') === 0 && exposureDocuments) {
      var techniqueIndex = parseInt(id.substring('exposure-methods-language-'.length), 10);
      var languageDocument = exposureDocuments.language;
      var techniqueSection = languageDocument && (languageDocument.sections || []).filter(function(section) {
        return /^Подмена\s+\d+$/i.test(section.title || '');
      })[techniqueIndex];
      if (techniqueSection) {
        return {
          id: id,
          category: 'methods',
          title: LANGUAGE_TECHNIQUE_TITLES[techniqueIndex] || techniqueSection.title,
          text: techniqueSection.content
        };
      }
    }
    if (id.indexOf('exposure-') === 0 && exposureDocuments) {
      var key = id.substring('exposure-'.length);
      var category = CATEGORIES.filter(function(item) { return item.key === key; })[0] || {};
      var documentData = exposureDocuments[category.source || key];
      if (documentData) {
        return {
          id: id,
          category: key,
          title: documentData.title,
          text: (documentData.sections || []).map(function(section) {
            return '## ' + section.title + '\n\n' + section.content;
          }).join('\n\n---\n\n')
        };
      }
    }
    return null;
  }

  function bindCardActions(container, panel) {
    panel.querySelectorAll('.methodology-info-btn').forEach(function(btn) {
      btn.addEventListener('click', function(event) {
        event.stopPropagation();
        event.preventDefault();
        var card = findCard(btn.dataset.id);
        openFullText(card || {
          title: btn.dataset.id || 'Карточка методологии',
          summary: 'Материалы карточки загружаются из текущего раздела методологии.'
        });
      });
    });

    // Клик по строке реестра открывает полный текст в любом разделе —
    // ранье это работало только для подкласса карточек-документов.
    panel.querySelectorAll('.methodology-card').forEach(function(article) {
      article.addEventListener('click', function(event) {
        if (event.target.closest('button, textarea')) return;
        if (article.classList.contains('is-editing')) return;
        var card = findCard(article.dataset.id);
        if (card) openFullText(card);
      });
    });

    panel.querySelectorAll('.methodology-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var card = findCard(btn.dataset.id);
        if (!card) return;
        copyTextWithFeedback(btn, card.title + '\n\n' + card.text);
      });
    });
    panel.querySelectorAll('.methodology-prompt-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var card = findCard(btn.dataset.id);
        if (!card) return;
        sendToPromptGenerator(card.title, card.text);
      });
    });
    panel.querySelectorAll('.methodology-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var card = findCard(btn.dataset.id);
        var article = btn.closest('.methodology-card');
        if (!card || !article) return;
        if (article.classList.contains('is-editing')) {
          finishInlineEdit(article, card);
        } else {
          startInlineEdit(article, card);
        }
      });
    });
    panel.querySelectorAll('.methodology-delete-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var card = findCard(btn.dataset.id);
        if (card) deleteCard(container, card);
      });
    });
  }

  function openFullText(card) {
    if (!card || typeof LabModal === 'undefined') return;
    var fullText = card.text || card.summary || 'Для этой карточки полный текст пока не добавлен.';
    var content = typeof marked !== 'undefined' && marked.parse
      ? marked.parse(fullText)
      : '<p>' + escapeHtml(fullText).replace(/\n/g, '<br>') + '</p>';
    LabModal.show(
      MODAL_ICON + '<span class="methodology-modal-title">' + escapeHtml(card.title) + '</span>',
      '<div class="methodology-document-content">' + content + '</div>',
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>'
    );
  }

  function startInlineEdit(article, card) {
    var textEl = article.querySelector('.methodology-card-text');
    var editBtn = article.querySelector('.methodology-edit-btn');
    if (!textEl || !editBtn) return;

    var textarea = document.createElement('textarea');
    textarea.className = 'methodology-card-textarea';
    textarea.value = card.text;
    textarea.rows = Math.min(16, Math.max(4, card.text.split('\n').length + 1));
    textEl.replaceWith(textarea);
    textarea.focus();

    article.classList.add('is-editing');
    editBtn.classList.add('is-active');
    editBtn.innerHTML = SAVE_ICON;
    editBtn.title = 'Сохранить';
    editBtn.setAttribute('aria-label', 'Сохранить карточку');
  }

  function finishInlineEdit(article, card) {
    var textarea = article.querySelector('.methodology-card-textarea');
    var editBtn = article.querySelector('.methodology-edit-btn');
    if (!textarea) return;

    var newText = textarea.value.trim();
    if (newText && newText !== card.text) {
      card.text = newText;
      persistStore();
    }

    var textEl = document.createElement('p');
    textEl.className = 'methodology-card-text';
    textEl.textContent = card.text;
    textarea.replaceWith(textEl);

    article.classList.remove('is-editing');
    if (editBtn) {
      editBtn.classList.remove('is-active');
      editBtn.innerHTML = EDIT_ICON;
      editBtn.title = 'Редактировать';
      editBtn.setAttribute('aria-label', 'Редактировать карточку');
    }
  }

  function deleteCard(container, card) {
    if (!window.confirm('Удалить карточку «' + card.title + '»?')) return;
    store.cards = (store.cards || []).filter(function(c) { return c.id !== card.id; });
    persistStore();
    showTab(container, activeTab);
  }

  // ===== ФОРМА ДОБАВЛЕНИЯ НОВОЙ КАРТОЧКИ =====
  function openForm(container) {
    var options = CATEGORIES.map(function(c) {
      var selected = activeTab === c.key ? ' selected' : '';
      return '<option value="' + c.key + '"' + selected + '>' + escapeHtml(c.label) + '</option>';
    }).join('');

    var body =
      '<div class="methodology-form">' +
        '<label class="admin-label" for="mf-title">Заголовок</label>' +
        '<input type="text" id="mf-title" class="admin-input" value="">' +
        '<label class="admin-label" for="mf-category">Раздел</label>' +
        '<select id="mf-category" class="admin-input">' + options + '</select>' +
        '<label class="admin-label" for="mf-text">Текст</label>' +
        '<textarea id="mf-text" class="admin-textarea" rows="8"></textarea>' +
      '</div>';

    var footer =
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Отмена</button>' +
      '<button class="lab-btn lab-btn-primary lab-btn-sm" id="mf-save-btn">Сохранить</button>';

    window.LabModal.show('Добавить карточку', body, footer);

    document.getElementById('mf-save-btn').addEventListener('click', function() {
      saveForm(container);
    });
  }

  function saveForm(container) {
    var titleInput = document.getElementById('mf-title');
    var categoryInput = document.getElementById('mf-category');
    var textInput = document.getElementById('mf-text');
    if (!titleInput || !categoryInput || !textInput) return;

    var titleValue = titleInput.value.trim();
    var textValue = textInput.value.trim();
    if (!titleValue || !textValue) {
      toast('Заполните заголовок и текст');
      return;
    }

    var categoryValue = categoryInput.value;
    store.cards = store.cards || [];
    store.cards.push({
      id: generateId(categoryValue),
      category: categoryValue,
      title: titleValue,
      text: textValue
    });

    persistStore();
    window.LabModal.close();
    activeTab = categoryValue;
    showTab(container, activeTab);
  }
})(window, document);

// Scripture Reader: Qumran-attested Tanakh books, bento reading screen.
// Bento-каркас §5.2e (css/scripture-reader-bento.css, префикс sr-).
// ИИ-разбор вынесен в js/scripture-ai.js: этот модуль отвечает за текст,
// навигацию и локальный разбор и ничего не знает про сеть.
const ScriptureReader = (function() {
  'use strict';

  var LAST_KEY = 'alephy_scripture_last_v1';
  var EVIDENCE_KEY = 'alephy_scripture_evidence_v1';

  var state = {
    initialized: false,
    books: [],
    currentBook: null,
    verses: [],
    currentVerse: 0,
    selectedIndexes: [],
    roots: [],
    states: [],
    selectedWordIndex: null,
    loaded: false,
    loading: null,
    pendingBookId: null,
    pendingVerse: null,
    // 'word' — разбор слова, 'letters' — разбор выделенных букв.
    mode: 'word',
    arrowKeysBound: false,
    boundRoot: null,
    glyphEscapeBound: false
  };

  var PALEO = window.PaleoLetters;
  var WEAVER = window.PaleoWeaver;
  var glyphPopover = null;
  var glyphPopoverTimer = null;
  var activeGlyphChip = null;
  var glyphPointerType = '';
  // Функциональная лексика по PALEO-STANDARD.md.
  var PALEO_UI_FUNCTIONS = {
    'א': 'СИЛА', 'ב': 'ВМЕСТИЛИЩЕ', 'ג': 'ДВИЖЕНИЕ', 'ד': 'ПРОХОД',
    'ה': 'ОТКРОВЕНИЕ', 'ו': 'СВЯЗКА', 'ז': 'ЗАЩИТА', 'ח': 'ОТДЕЛЕНИЕ',
    'ט': 'ОБОРАЧИВАНИЕ', 'י': 'ДЕЙСТВИЕ', 'כ': 'УДЕРЖАНИЕ', 'ך': 'УДЕРЖАНИЕ',
    'ל': 'НАПРАВЛЕНИЕ', 'מ': 'ПОТОК', 'ם': 'ПОТОК', 'נ': 'ДВИЖЕНИЕ ЖИЗНИ',
    'ן': 'ДВИЖЕНИЕ ЖИЗНИ', 'ס': 'ПОДДЕРЖКА', 'ע': 'ИСТОЧНИК', 'פ': 'ОТКРЫТИЕ',
    'ף': 'ОТКРЫТИЕ', 'צ': 'ЗАХВАТ', 'ץ': 'ЗАХВАТ', 'ק': 'ОТДЕЛЕНИЕ',
    'ר': 'ВЕРШИНА', 'ש': 'РАЗРУШЕНИЕ', 'ת': 'ФИКСАЦИЯ'
  };

  function paleoFunction(letter) {
    return PALEO_UI_FUNCTIONS[letter] || String((PALEO.byHebrew[letter] && PALEO.byHebrew[letter].meaning) || 'ДЕЙСТВИЕ').toUpperCase();
  }

  function get(id) {
    return document.getElementById(id);
  }

  var GLYPH_FALLBACK = {
    '𐤀': ['Алеф', 'бык', 'сила'], '𐤁': ['Бет', 'дом', 'вместилище'], '𐤂': ['Гимель', 'верблюд', 'перемещение'], '𐤃': ['Далет', 'дверь', 'проход'],
    '𐤄': ['Хе', 'окно', 'проявление'], '𐤅': ['Вав', 'крюк', 'связка'], '𐤆': ['Зайн', 'оружие', 'отсечение'], '𐤇': ['Хет', 'ограда', 'граница'],
    '𐤈': ['Тет', 'змея', 'свёртывание'], '𐤉': ['Йод', 'рука', 'действие'], '𐤊': ['Каф', 'ладонь', 'удержание'], '𐤋': ['Ламед', 'посох', 'направление'],
    '𐤌': ['Мем', 'вода', 'поток'], '𐤍': ['Нун', 'рыба', 'движение жизни'], '𐤎': ['Самех', 'опора', 'поддержка'], '𐤏': ['Айн', 'глаз', 'наблюдение'],
    '𐤐': ['Пе', 'рот', 'произнесение'], '𐤑': ['Цади', 'ловушка', 'захват'], '𐤒': ['Коф', 'игла', 'пронзание'], '𐤓': ['Реш', 'голова', 'вершина'],
    '𐤔': ['Шин', 'зуб', 'огонь'], '𐤕': ['Тав', 'знак', 'фиксация']
  };

  function ensureGlyphPopover() {
    if (glyphPopover) return glyphPopover;
    glyphPopover = document.createElement('div');
    glyphPopover.id = 'scripture-glyph-popover';
    glyphPopover.className = 'scripture-glyph-popover';
    glyphPopover.setAttribute('role', 'tooltip');
    glyphPopover.hidden = true;
    document.body.appendChild(glyphPopover);
    return glyphPopover;
  }

  function hideGlyphPopover() {
    if (glyphPopoverTimer) window.clearTimeout(glyphPopoverTimer);
    if (glyphPopover) glyphPopover.hidden = true;
    if (activeGlyphChip) {
      activeGlyphChip.removeAttribute('aria-expanded');
      activeGlyphChip.removeAttribute('aria-describedby');
    }
    activeGlyphChip = null;
  }

  function showGlyphPopover(chip) {
    if (!chip) return;
    if (glyphPopoverTimer) window.clearTimeout(glyphPopoverTimer);
    var popover = ensureGlyphPopover();
    var glyph = chip.dataset.glyph || '';
    var fallback = GLYPH_FALLBACK[glyph] || [];
    var name = chip.dataset.name || fallback[0] || 'Буква';
    var image = chip.dataset.image || fallback[1] || 'образ не указан';
    var meaning = chip.dataset.meaning || fallback[2] || 'функция не указана';
    popover.innerHTML = '<div class="scripture-glyph-popover-glyph" lang="hbo">' + escapeHtml(glyph) + '</div>' +
      '<div><strong>' + escapeHtml(name) + '</strong><span>Образ: ' + escapeHtml(image) + '</span><span>Функция: ' + escapeHtml(meaning) + '</span><span>Палео-образ: ' + escapeHtml(image) + ' как предметный носитель функции.</span></div>';
    popover.hidden = false;
    activeGlyphChip = chip;
    chip.setAttribute('aria-expanded', 'true');
    chip.setAttribute('aria-describedby', 'scripture-glyph-popover');
    var rect = chip.getBoundingClientRect();
    var popRect = popover.getBoundingClientRect();
    var left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
    var top = rect.top - popRect.height - 10;
    popover.classList.toggle('is-below', top < 8);
    if (top < 8) top = rect.bottom + 10;
    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }

  function setLoading(message) {
    var paleo = get('scripture-paleo');
    if (paleo) paleo.textContent = message;
  }

  function copyText(text, successMessage) {
    var value = String(text || '').trim();
    if (!value) return Promise.reject(new Error('Нечего копировать'));

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function() {
        if (typeof LabToast !== 'undefined') LabToast.show(successMessage || 'Скопировано в буфер обмена.');
      });
    }

    return new Promise(function(resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (!document.execCommand('copy')) throw new Error('Копирование недоступно');
        document.body.removeChild(textarea);
        if (typeof LabToast !== 'undefined') LabToast.show(successMessage || 'Скопировано в буфер обмена.');
        resolve();
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    }).catch(function(error) {
      if (typeof LabToast !== 'undefined') LabToast.show('Не удалось скопировать текст.');
      throw error;
    });
  }

  function currentVerseText() {
    var verse = state.verses[state.currentVerse];
    if (!verse || !state.currentBook) return '';
    return [
      state.currentBook.ru + ' ' + (verse.chapter || 1) + ':' + verse.verse,
      verse.paleo,
      verse.hebrew,
      verse.translit,
      verse.paleo_translation,
      verse.paleo_function || verse.verse_function || verse.function,
      verse.literal
    ].filter(Boolean).join('\n');
  }

  function copyCurrentVerse() {
    copyText(currentVerseText(), 'Стих скопирован в буфер обмена.');
  }

  function copySelection() {
    var letters = selectedLetters();
    if (!letters.length) return;
    var paleo = letters.map(function(letter) { return letter.paleo; }).join('');
    var hebrew = letters.map(function(letter) { return letter.hebrew; }).join('');
    copyText('Палео-иврит: ' + paleo + '\nИврит: ' + hebrew, 'Выбранный фрагмент скопирован.');
  }

  function copyButtonMarkup(disabled) {
    return '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm scripture-copy-button scripture-copy-selection"' +
      (disabled ? ' disabled' : '') +
      ' aria-label="Копировать выбранное" title="Копировать выбранное">' +
      '<i data-lucide="copy" aria-hidden="true"></i>' +
      '</button>';
  }

  function cleanHebrewWord(word) {
    return String(word || '').replace(/[\u0591-\u05C7]/g, '');
  }

  function paleoWordsFor(hebrew, paleo) {
    var hebrewWords = String(hebrew || '').trim().split(/\s+/).filter(Boolean);
    var paleoWords = String(paleo || '').trim().split(/\s+/).filter(Boolean);

    return hebrewWords.map(function(word, wordIndex) {
      var source = paleoWords[wordIndex] || '';
      var cleanWord = cleanHebrewWord(word);
      // Неполные данные достраиваются из полного иврита.
      if (!source || Array.from(source).length !== Array.from(cleanWord).length) {
        return PALEO.toPaleo(cleanWord);
      }
      return source;
    });
  }

  function renderWordLayer(text, className, wordClass, extraAttributes) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean);
    var attributes = extraAttributes || function() { return ''; };
    return words.map(function(word, wordIndex) {
      return '<span class="' + className + ' ' + wordClass + '" data-word-index="' + wordIndex + '"' +
        attributes(word, wordIndex) + '>' + escapeHtml(word) + '</span>';
    }).join(' ');
  }

  function wordDataFor(verse, wordIndex, hebrewWord, paleoWord) {
    var breakdown = verse && Array.isArray(verse.word_breakdown)
      ? verse.word_breakdown
      : (verse && Array.isArray(verse.words) ? verse.words : []);
    var stored = breakdown[wordIndex] || null;
    if (stored && stored.assembly && stored.mechanics && stored.function) {
      var storedHebrew = cleanHebrewWord(stored.hebrew || hebrewWord);
      var storedPaleo = stored.paleo || paleoWord || PALEO.toPaleo(storedHebrew);
      return {
        hebrew: storedHebrew,
        paleo: storedPaleo,
        assembly: Array.from(storedHebrew).map(paleoFunction).join(' → '),
        mechanics: stored.mechanics,
        function: Array.from(storedHebrew).map(paleoFunction).join(' → ')
      };
    }

    var letters = Array.from(cleanHebrewWord(hebrewWord || '')).map(function(letter, index) {
      var data = PALEO.byHebrew[letter] || {};
      return {
        paleo: Array.from(paleoWord || '')[index] || PALEO.toPaleo(letter),
        hebrew: letter,
        name: data.name || 'Буква',
        image: data.image || 'образ',
        meaning: paleoFunction(letter)
      };
    });
    return {
      hebrew: cleanHebrewWord(hebrewWord),
      paleo: paleoWord || PALEO.toPaleo(cleanHebrewWord(hebrewWord)),
      assembly: letters.map(function(letter) { return letter.meaning; }).join(' → '),
      mechanics: letters.map(function(letter) {
        return letter.name + ': ' + letter.meaning;
      }).join(' → '),
      function: letters.map(function(letter) { return letter.meaning; }).join(' → ')
    };
  }

  function currentWordData(wordIndex) {
    var verse = state.verses[state.currentVerse];
    var hebrewWords = String(verse && verse.hebrew || '').split(/\s+/).filter(Boolean);
    var paleoWords = String(verse && verse.paleo || '').split(/\s+/).filter(Boolean);
    return wordDataFor(verse, Number(wordIndex), hebrewWords[Number(wordIndex)] || '', paleoWords[Number(wordIndex)] || '');
  }

  function renderPaleo(text, hebrew) {
    var paleoWords = paleoWordsFor(hebrew, text);
    var hebrewWords = String(hebrew || '').split(/\s+/).filter(Boolean);
    var index = 0;

    return hebrewWords.map(function(hebrewWord, wordIndex) {
      var word = paleoWords[wordIndex] || PALEO.toPaleo(cleanHebrewWord(hebrewWord));
      if (!word) return '';
      var letters = Array.from(word).map(function(symbol, letterIndex) {
        var hebrewLetter = Array.from(cleanHebrewWord(hebrewWord))[letterIndex] || '';
        var html = '<span class="scripture-paleo-letter" data-index="' + index +
          '" data-paleo="' + escapeHtml(symbol) + '" data-hebrew="' + escapeHtml(hebrewLetter) +
          '" role="button" tabindex="0" aria-pressed="false" aria-label="Разобрать букву ' + escapeHtml(hebrewLetter) + '">' +
          escapeHtml(symbol) + '</span>';
        index++;
        return html;
      }).join('');
      return '<span class="scripture-word scripture-paleo-word" data-word-index="' + wordIndex + '" role="button" tabindex="0" aria-label="Разобрать слово ' + escapeHtml(hebrewWord) + '">' + letters + '</span>';
    }).join(' ');
  }

  function ensureReadingLayers() {
    var article = get('scripture-verse-article');
    if (!article) return null;
    var assembly = get('scripture-assembly-view');
    if (!assembly) {
      assembly = document.createElement('section');
      assembly.id = 'scripture-assembly-view';
      assembly.className = 'scripture-reading-layer scripture-assembly-view';
      article.appendChild(assembly);
    }
    return { article: article, assembly: assembly };
  }

  function renderReadingLayers(verse) {
    var layers = ensureReadingLayers();
    if (!layers) return;
    hideGlyphPopover();
    var words = String(verse.hebrew || '').split(/\s+/).filter(Boolean).map(function(word, index) {
      return wordDataFor(verse, index, word, String(verse.paleo || '').split(/\s+/)[index] || '');
    });
    var meaningPass = verse.meaning_pass || {};
    var meaningWords = Array.isArray(meaningPass.words) && meaningPass.words.length === words.length ? meaningPass.words : [];
    var chains = words.map(function(word) {
      return Array.from(word.paleo || '').map(function(_, index) { return paleoFunction(Array.from(cleanHebrewWord(word.hebrew || ''))[index] || '').toLocaleLowerCase('ru-RU'); });
    });
    var pendingParticle = '';
    var wordBlocks = words.map(function(word, wordIndex) {
      var meaningWord = meaningWords[wordIndex] || {};
      var hebrewLetters = Array.from(cleanHebrewWord(word.hebrew || ''));
      var paleoLetters = Array.from(word.paleo || '');
      var chain = Array.isArray(meaningWord.chain) && meaningWord.chain.length === paleoLetters.length
        ? meaningWord.chain : paleoLetters.map(function(_, index) { return paleoFunction(hebrewLetters[index] || ''); });
      var normalizedChain = chain.map(function(value) { return String(value || '').toLocaleLowerCase('ru-RU'); });
      if (WEAVER && WEAVER.isParticle(normalizedChain)) {
        pendingParticle = WEAVER.particleText(normalizedChain) || pendingParticle;
        return '';
      }
      var chips = paleoLetters.map(function(glyph, index) {
        var letter = PALEO.byHebrew[hebrewLetters[index]] || {};
        return '<button type="button" class="scripture-glyph-chip" data-glyph="' + escapeHtml(glyph) + '" data-name="' + escapeHtml(letter.name || '') + '" data-image="' + escapeHtml(letter.image || '') + '" data-meaning="' + escapeHtml(letter.meaning || chain[index] || '') + '" aria-haspopup="true" aria-expanded="false">' +
          '<b lang="hbo">' + escapeHtml(glyph) + '</b><small>' + escapeHtml(chain[index] || '') + '</small></button>' +
          (index < paleoLetters.length - 1 ? '<span class="scripture-glyph-arrow" aria-hidden="true"></span>' : '');
      }).join('');
      var wordReading = meaningWord.reading || (WEAVER && WEAVER.wordReading(normalizedChain)) || '';
      if (pendingParticle) {
        wordReading = pendingParticle + ' ' + wordReading;
        pendingParticle = '';
      }
      var translit = word.translit || (WEAVER && WEAVER.transliterate(word.hebrew)) || '';
      return '<article class="scripture-constructor-word scripture-word-row">' +
        '<span class="scripture-constructor-index" aria-hidden="true">' + (wordIndex + 1) + '</span>' +
        '<div class="scripture-constructor-label scripture-word-head"><b lang="he" dir="rtl">' + escapeHtml(cleanHebrewWord(word.hebrew)) + '</b><small>' + escapeHtml(translit) + '</small></div>' +
        '<div class="scripture-constructor-chips scripture-chips' + (paleoLetters.length <= 7 ? ' is-fit' : '') + '">' + chips + '</div>' +
        '<em class="scripture-constructor-reading scripture-word-reading">' + escapeHtml(wordReading) + '</em>' +
        '</article>';
    }).join('') || '<p class="text-muted">Слова конструктора требуют проверки.</p>';
    var translationStatus = verse.paleo_translation_status === 'verified' ? 'Проверенная рабочая сборка' : (verse.paleo_translation_status === 'review' ? 'Требует проверки' : 'Черновая рабочая сборка');
    var verseReading = meaningPass.verse_reading || (WEAVER && WEAVER.verseReading(chains)) || 'Смысловая сборка требует проверки.';
    var verseFunction = meaningPass.verse_function || (WEAVER && WEAVER.verseFunction(chains)) || 'Функция стиха требует проверки.';
    var verseHref = '#scripture-reader?book=' + encodeURIComponent((state.currentBook && state.currentBook.id) || '') + '&verse=' + encodeURIComponent(verse.verse || '');
    layers.assembly.innerHTML = '<section class="scripture-meaning-card scripture-meaning-card--' + escapeHtml(verse.paleo_translation_status || 'draft') + '">' +
      '<div class="scripture-meaning-head"><a href="' + verseHref + '" class="scripture-verse-link">' + escapeHtml((state.currentBook && state.currentBook.ru) || 'Книга') + ' ' + escapeHtml(verse.chapter || 1) + ':' + escapeHtml(verse.verse || '') + '</a><span class="scripture-translation-status">' + escapeHtml(translationStatus) + '</span></div>' +
      '<h2 class="scripture-meaning-reading">' + escapeHtml(verseReading) + '</h2>' +
      '<p class="scripture-translation-note">' + escapeHtml(meaningPass.verse_reading ? (verse.paleo_translation_note || '') : 'Детерминированная палео-сборка: связность требует проверки.') + '</p>' +
      '</section>' +
      '<section class="scripture-function-card"><div class="scripture-layer-label">Функция стиха</div>' +
      '<p class="scripture-function-line">' + escapeHtml(verseFunction) + '</p></section>' +
      '<section class="scripture-constructor"><div class="scripture-layer-label">Палео-конструктор</div><div class="scripture-constructor-words">' + wordBlocks + '</div></section>';
    updateConstructorOverflow(layers.assembly);
    animateConstructor(layers.assembly);
  }

  function animateConstructor(container) {
    if (!container || !window.Element || !Element.prototype.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    container.querySelectorAll('.scripture-glyph-chip').forEach(function(chip, index) {
      chip.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 220, delay: Math.min(index * 28, 420), easing: 'ease-out', fill: 'both' });
    });
  }

  function updateConstructorOverflow(container) {
    if (!container) return;
    container.querySelectorAll('.scripture-constructor-chips').forEach(function(row) {
      row.classList.toggle('is-scrollable', !row.classList.contains('is-fit') && row.scrollWidth > row.clientWidth + 1);
    });
  }

  function renderWordAnalysis(wordIndex) {
    var content = get('scripture-physics-content');
    if (!content) return;
    var verse = state.verses[state.currentVerse];
    var data = currentWordData(wordIndex);
    var letters = Array.from(data.hebrew || '').map(function(letter, index) {
      var paleo = Array.from(data.paleo || '')[index] || PALEO.toPaleo(letter);
      var item = PALEO.byHebrew[letter] || {};
      return '<span class="scripture-word-letter"><b>' + escapeHtml(paleo) + '</b><small>' +
        escapeHtml(item.name || letter) + '</small></span>';
    }).join('');
    content.innerHTML = '<div class="scripture-word-analysis">' +
      '<div class="scripture-word-analysis-head"><span class="scripture-section-label">Палео-механика слова</span>' +
      '<span class="scripture-word-analysis-glyph" lang="hbo">' + escapeHtml(data.paleo || '') + '</span>' +
      '<span class="hebrew">' + escapeHtml(data.hebrew || '') + '</span></div>' +
      '<div class="scripture-word-letters">' + letters + '</div>' +
      '<section class="scripture-word-detail"><div class="scripture-section-label">Сборка</div><p>' + escapeHtml(data.assembly || '') + '</p></section>' +
      '<section class="scripture-word-detail"><div class="scripture-section-label">Механика</div><p>' + escapeHtml(data.mechanics || '') + '</p></section>' +
      '<section class="scripture-word-detail"><div class="scripture-section-label">Функция</div><p>' + escapeHtml(data.function || '') + '</p></section>' +
      '<p class="scripture-word-context"><span class="scripture-section-label">В СТИХЕ</span> ' + escapeHtml((verse && (verse.paleo_function || verse.verse_function || verse.function)) || '') + '</p>' +
      '</div>';
  }

  var BOOK_CATEGORY_LABELS = {
    torah: 'Тора',
    neviim: 'Невиим',
    ketuvim: 'Кетувим',
    samaritan: 'Самаритянская Тора',
    yahad: 'Кумран / йахад'
  };
  var BOOK_CATEGORY_ORDER = ['torah', 'neviim', 'ketuvim', 'samaritan', 'yahad'];
  // Глиф икон-чипа строки: чип по канону модуля «Агенты», но иконка несёт природу
  // корпуса — свиток Торы, книга Невиим, перо Ктувим, самаритянский список, свитки Кумрана.
  var BOOK_CATEGORY_ICONS = {
    torah: 'scroll',
    neviim: 'book-open',
    ketuvim: 'feather',
    samaritan: 'book-marked',
    yahad: 'scroll-text'
  };

  function bookSearchQuery() {
    var input = get('sr-search');
    return input ? String(input.value || '').trim().toLowerCase() : '';
  }

  function bookCategoryFilter() {
    var select = get('sr-category');
    return select ? String(select.value || '').trim() : '';
  }

  function bookMatchesQuery(book, query) {
    if (!query) return true;
    var haystack = [book.ru, book.paleo, book.id].join(' ').toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function bookMatchesCategory(book, category) {
    if (!category) return true;
    return String(book.category || '') === category;
  }

  function fillCategorySelect() {
    var select = get('sr-category');
    if (!select) return;
    var present = {};
    state.books.forEach(function(book) {
      if (book.category) present[book.category] = true;
    });
    var current = String(select.value || '');
    var html = '<option value="">Все книги</option>';
    BOOK_CATEGORY_ORDER.forEach(function(id) {
      if (!present[id]) return;
      html += '<option value="' + escapeHtml(id) + '">' + escapeHtml(BOOK_CATEGORY_LABELS[id] || id) + '</option>';
    });
    Object.keys(present).forEach(function(id) {
      if (BOOK_CATEGORY_ORDER.indexOf(id) !== -1) return;
      html += '<option value="' + escapeHtml(id) + '">' + escapeHtml(BOOK_CATEGORY_LABELS[id] || id) + '</option>';
    });
    select.innerHTML = html;
    if (current && present[current]) select.value = current;
  }

  // Каталог: строки с палео-названием и статусом, сгруппированные по категориям.
  // Сетка равных карточек была анти-паттерном B2, а мета-строка в ней пряталась.
  function renderBookGrid() {
    var host = get('sr-books');
    var count = get('sr-books-count');
    if (!host) return;
    fillCategorySelect();

    var books = state.books.filter(function(book) {
      return bookMatchesCategory(book, bookCategoryFilter()) && bookMatchesQuery(book, bookSearchQuery());
    });
    if (count) {
      count.textContent = state.books.length ? books.length + ' из ' + state.books.length : '';
    }
    if (!books.length) {
      host.innerHTML = '<div class="sr-empty"><span class="sr-empty-glyph" aria-hidden="true">𐤀</span>' +
        '<p class="sr-empty-text">Поле ждёт первую книгу: измените запрос или снимите фильтр категории.</p></div>';
      return;
    }

    var groups = [];
    BOOK_CATEGORY_ORDER.forEach(function(category) {
      var items = books.filter(function(book) { return String(book.category || '') === category; });
      if (items.length) groups.push({ label: BOOK_CATEGORY_LABELS[category] || category, items: items });
    });
    books.forEach(function(book) {
      if (BOOK_CATEGORY_ORDER.indexOf(String(book.category || '')) !== -1) return;
      groups.push({ label: BOOK_CATEGORY_LABELS[book.category] || book.category || 'Прочее', items: [book] });
    });

    host.innerHTML = groups.map(function(group) {
      var rows = group.items.map(function(book) {
        var ready = Boolean(book.dataFile);
        var icon = BOOK_CATEGORY_ICONS[book.category] || 'book';
        return '<button type="button" class="sr-book-row' + (ready ? '' : ' sr-book-row--pending') + '"' +
          ' data-book-id="' + escapeHtml(book.id) + '"' +
          ' aria-label="' + (ready ? 'Открыть книгу: ' : 'Книга в работе: ') + escapeHtml(book.ru) + '">' +
          '<span class="sr-book-icon" aria-hidden="true"><i data-lucide="' + icon + '"></i></span>' +
          '<span class="sr-book-name">' + escapeHtml(book.ru) + '</span>' +
          '<span class="sr-book-paleo" lang="hbo">' + escapeHtml(book.paleo || '') + '</span>' +
          '<span class="sr-status ' + (ready ? 'sr-status--ready' : 'sr-status--pending') + '">' +
          '<span class="sr-status-dot"></span>' + (ready ? 'Есть данные' : 'В работе') + '</span></button>';
      }).join('');
      // Шапка группы — лейбл + hairline + счётчик, как .agent-group-head.
      return '<div class="sr-group">' +
        '<div class="sr-group-head"><span class="sr-group-label">' + escapeHtml(group.label) + '</span>' +
        '<span class="sr-group-rule"></span>' +
        '<span class="sr-group-count">' + group.items.length + '</span></div>' +
        '<div class="sr-books">' + rows + '</div></div>';
    }).join('');

    renderLibraryLegend();
  }

  // Легенда §6 рядом с каталогом: сколько книг готово и сколько ещё в работе.
  function renderLibraryLegend() {
    var legend = get('sr-legend');
    if (!legend) return;
    var ready = state.books.filter(function(book) { return book.dataFile; }).length;
    legend.innerHTML = '<li class="sr-legend-item"><span class="sr-status sr-status--ready"><span class="sr-status-dot"></span>Есть данные</span>' +
      '<span class="sr-legend-text">Книга загружается целиком: доступны все её стихи.</span><b>' + ready + '</b></li>' +
      '<li class="sr-legend-item"><span class="sr-status sr-status--pending"><span class="sr-status-dot"></span>В работе</span>' +
      '<span class="sr-legend-text">Файл данных ещё не подготовлен — стих недоступен.</span><b>' + (state.books.length - ready) + '</b></li>';
  }

  // «Продолжить чтение»: последняя открытая книга и стих этого браузера.
  function readLast() {
    try {
      var saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
      return saved && saved.book ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function rememberLast(bookId, verse) {
    if (!bookId) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({
        book: bookId,
        verse: verse == null ? null : String(verse),
        savedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Приватный режим: продолжение чтения просто не сохранится.
    }
  }

  // «Читали вчера, 21:40» — длинный абзац даты читается хуже, чем короткая
  // подпись, а карточка должна отвечать на вопрос «когда я это оставил».
  function formatReadWhen(iso) {
    var date = iso ? new Date(iso) : null;
    if (!date || isNaN(date.getTime())) return '';
    var days = Math.floor((Date.now() - date.getTime()) / 86400000);
    var time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (days <= 0) return 'Читали сегодня в ' + time;
    if (days === 1) return 'Читали вчера в ' + time;
    if (days < 7) return 'Читали ' + days + ' дн. назад';
    return 'Читали ' + date.toLocaleDateString('ru-RU');
  }

  function renderResume() {
    var title = get('sr-resume-title');
    var ref = get('sr-resume-ref');
    var when = get('sr-resume-when');
    var note = get('sr-resume-note');
    var button = get('sr-resume-open');
    if (!title || !button) return;

    var last = readLast();
    var book = last ? state.books.filter(function(item) { return item.id === last.book; })[0] : null;
    if (!book) {
      // Пустое состояние §4.6: говорим, что делать дальше, а не «ничего нет».
      title.textContent = 'Чтение ещё не начато';
      if (ref) ref.textContent = '';
      if (when) when.textContent = '';
      if (note) note.textContent = 'Откройте любую книгу из каталога — и она запомнится здесь.';
      button.hidden = false;
      button.textContent = 'Начать с Берешит';
      button.setAttribute('data-book-id', (state.books[0] || {}).id || '');
      return;
    }
    title.textContent = book.ru;
    button.hidden = false;
    button.textContent = last.verse ? 'Продолжить со стиха ' + last.verse : 'Открыть стих';
    button.setAttribute('data-book-id', book.id);
    if (ref) ref.textContent = last.verse ? 'Стих ' + last.verse : 'Глава 1, стих 1';
    if (when) when.textContent = formatReadWhen(last.savedAt);
  }

  // Прогресс считается по уже загруженной книге: в библиотеке стихов в памяти нет.
  function renderProgress() {
    var wrap = get('sr-progress');
    var fill = get('sr-progress-fill');
    var value = get('sr-progress-value');
    if (!wrap || !fill || !value || !state.verses.length) return;
    var total = state.verses.length;
    var current = state.currentVerse + 1;
    fill.style.width = Math.round((current / total) * 100) + '%';
    value.textContent = current + ' / ' + total;
    wrap.hidden = false;

    var hint = get('sr-verse-hint');
    if (hint) hint.textContent = current + ' из ' + total;
  }

  // Смена экрана = скрытие секций, а не перерисовка модуля: так запрос поиска
  // и позиция чтения переживают возврат в каталог. Тулбар каталога — часть
  // экрана библиотеки, поэтому прячется вместе с ней.
  function showBookGrid() {
    var library = get('sr-library');
    var reading = get('sr-reading');
    var toolbar = get('sr-toolbar');
    if (library) library.hidden = false;
    if (reading) reading.hidden = true;
    if (toolbar) toolbar.hidden = false;
    state.currentBook = null;
    renderResume();
    if (window.ScriptureAI) window.ScriptureAI.reset();
  }

  function showVerseView() {
    var library = get('sr-library');
    var reading = get('sr-reading');
    var toolbar = get('sr-toolbar');
    if (library) library.hidden = true;
    if (reading) reading.hidden = false;
    if (toolbar) toolbar.hidden = true;
  }

  // Положение чтения живёт в хеше: ссылку на стих можно передать, а «назад»
  // возвращает в каталог или к предыдущему стиху. history.replaceState, а не
  // LabRouter.navigate — иначе hashchange перерисовывал бы весь контейнер.
  function syncUrl() {
    var book = state.currentBook;
    if (!book || !window.history || !window.history.replaceState) return;
    var hash = '#scripture-reader?book=' + encodeURIComponent(book.id);
    var verse = state.verses[state.currentVerse];
    if (verse) hash += '&verse=' + encodeURIComponent(verse.verse);
    try {
      window.history.replaceState(null, '', hash);
    } catch (error) {
      // Некоторые контексты (file://) запрещают replaceState — чтение не ломается.
    }
  }

  function openBook(bookId, verseNumber) {
    if (!state.books.length) {
      state.pendingBookId = bookId;
      state.pendingVerse = verseNumber || null;
      return;
    }
    var book = state.books.filter(function(b) { return b.id === bookId; })[0];
    if (!book) return;

    state.currentBook = book;
    showVerseView();
    return loadVerses(book, verseNumber);
  }

  function loadVerses(book, verseNumber) {
    setLoading('Загрузка ' + book.ru + '…');
    if (!book.dataFile) {
      var pendingArticle = get('scripture-verse-article');
      if (pendingArticle) {
        pendingArticle.innerHTML = '<div class="lab-alert lab-alert-info scripture-reader-error">Текст книги «' + escapeHtml(book.ru) + '» пока не загружен в библиотеку.</div>';
      }
      state.verses = [];
      return Promise.resolve([]);
    }
    var dataFile = book.dataFile;
    return fetch('data/scripture/' + dataFile.replace(/\.json$/, '') + '.json')
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        var verses = (window.ScriptureAdapters && window.ScriptureAdapters.normalizeScripturePayload)
          ? window.ScriptureAdapters.normalizeScripturePayload(data, PALEO)
          : (Array.isArray(data) ? data : ((data && data.verses) || []));
        if (!Array.isArray(verses) || !verses.length) throw new Error('Пустой набор стихов');
        state.verses = verses;
        var requestedIndex = verseNumber == null ? -1 : verses.findIndex(function(item) {
          return String(item && item.verse) === String(verseNumber);
        });
        state.currentVerse = requestedIndex >= 0 ? requestedIndex : 0;
        renderVerse();
      })
      .catch(function(error) {
        var article = get('scripture-verse-article');
        if (article) {
          article.innerHTML = '<div class="lab-alert lab-alert-error scripture-reader-error">Ошибка загрузки текста: ' +
            escapeHtml(error.message) + '</div>';
        }
      });
  }

  // Рендер 4-строчного формата для Берешит 1:1 (палео, иврит, транслит, перевод).
  function renderFourLineVerse(verse) {
    var words = (verse.words && verse.words.length) ? verse.words : [];
    if (!words.length || !words.every(function(word) {
      return word.hebrew && word.paleo && word.translit && word.literal;
    })) return false;

    var paleo = get('scripture-paleo');
    var hebrew = get('scripture-hebrew');
    var translit = get('scripture-translit');

    function line(words, field, className, wordClass) {
      return words.map(function(word, index) {
        var text = word[field] || '';
        return '<span class="' + className + ' ' + wordClass + '" data-word-index="' + index + '"' +
          ' role="button" tabindex="0" aria-label="Разобрать слово ' + escapeHtml(text) + '">' +
          escapeHtml(text) + '</span>';
      }).join(' ');
    }

    if (paleo) paleo.innerHTML = line(words, 'paleo', 'scripture-word', 'scripture-paleo-word scripture-fourline');
    if (hebrew) hebrew.innerHTML = line(words, 'hebrew', 'scripture-word', 'scripture-hebrew-word scripture-fourline');
    if (translit) translit.innerHTML = line(words, 'translit', 'scripture-word', 'scripture-translit-word scripture-fourline');
    return true;
  }

  function renderVerse() {
    var verse = state.verses[state.currentVerse];
    if (!verse || !state.currentBook) return;

    var title = get('scripture-verse-title');
    var paleo = get('scripture-paleo');
    var hebrew = get('scripture-hebrew');
    var translit = get('scripture-translit');
    var previous = get('scripture-prev');
    var next = get('scripture-next');

    state.selectedIndexes = [];
    state.selectedWordIndex = null;
    setMode('word');

    if (title) title.textContent = state.currentBook.ru + ' ' + (verse.chapter || 1) + ':' + verse.verse;

    // Для книги Берешит используем 4-строчный формат (эталон Берешит 1:1).
    var isBereshit = state.currentBook && state.currentBook.id === 'bereshit';
    var usedFourLine = isBereshit && renderFourLineVerse(verse);

    if (!usedFourLine) {
      if (paleo) paleo.innerHTML = renderPaleo(verse.paleo, verse.hebrew);
      if (hebrew) hebrew.innerHTML = renderWordLayer(verse.hebrew, 'scripture-word', 'scripture-hebrew-word');
      if (translit) translit.innerHTML = renderWordLayer(verse.translit, 'scripture-word', 'scripture-translit-word');
    }
    renderReadingLayers(verse);
    if (previous) previous.disabled = state.currentVerse === 0;
    if (next) next.disabled = state.currentVerse === state.verses.length - 1;
    renderChapterVerseNav();
    renderProgress();
    rememberLast(state.currentBook.id, verse.verse);
    syncUrl();
    // Смена стиха сбрасывает и разбор, и ответ ИИ: они относятся к прежнему стиху.
    renderAnalysis();
    if (window.ScriptureAI) window.ScriptureAI.reset();
  }

  function verseChapters() {
    var chapters = [];
    state.verses.forEach(function(v) {
      var sourceBook = v.source_book || '';
      var exists = chapters.some(function(item) { return item.sourceBook === sourceBook && item.chapter === v.chapter; });
      if (!exists) chapters.push({ sourceBook: sourceBook, chapter: v.chapter });
    });
    return chapters;
  }

  function chapterVerses(sourceBook, chapter) {
    return state.verses.map(function(v, i) {
      return { verse: v.verse, index: i };
    }).filter(function(item) {
      var verse = state.verses[item.index];
      return verse.chapter === chapter && (verse.source_book || '') === sourceBook;
    });
  }

  // Навигация глава → стих: две горизонтальные ленты вместо 81 кнопки в потоке
  // (перенос растягивал Берешит на четыре экрана до самого текста).
  function renderChapterVerseNav() {
    var navigation = get('scripture-verse-nav');
    var note = get('scripture-path-note');
    if (!navigation) return;
    var currentVerse = state.verses[state.currentVerse];
    var currentChapter = currentVerse ? currentVerse.chapter : 1;
    var currentSourceBook = currentVerse ? (currentVerse.source_book || '') : '';

    var chapters = verseChapters();
    var hasMultipleSourceBooks = chapters.some(function(item) { return item.sourceBook !== currentSourceBook; });
    var chapterChips = chapters.map(function(item) {
      var active = item.chapter === currentChapter && item.sourceBook === currentSourceBook;
      var label = (hasMultipleSourceBooks ? item.sourceBook + ' ' : '') + item.chapter;
      return '<button type="button" class="sr-chip" data-chapter="' + item.chapter + '" data-source-book="' + escapeHtml(item.sourceBook) + '"' +
        (active ? ' aria-current="true"' : '') + ' aria-label="Открыть главу ' + escapeHtml(label) + '">' +
        escapeHtml(label) + '</button>';
    }).join('');

    var verses = chapterVerses(currentSourceBook, currentChapter);
    var verseChips = verses.map(function(item) {
      var active = item.index === state.currentVerse;
      return '<button type="button" class="sr-chip" data-verse-index="' + item.index + '"' +
        (active ? ' aria-current="true"' : '') + ' aria-label="Открыть стих ' + escapeHtml(item.verse) + '">' +
        escapeHtml(item.verse) + '</button>';
    }).join('');

    navigation.innerHTML = '<div class="sr-stepper-row">' +
      '<span class="sr-stepper-label" id="sr-label-chapters">Главы</span>' +
      '<div class="sr-strip" role="group" aria-labelledby="sr-label-chapters">' +
      (chapterChips || '<span class="sr-note">Главы не найдены.</span>') + '</div></div>' +
      '<div class="sr-stepper-row">' +
      '<span class="sr-stepper-label" id="sr-label-verses">Стихи</span>' +
      '<div class="sr-strip" role="group" aria-labelledby="sr-label-verses">' +
      (verseChips || '<span class="sr-note">В главе нет стихов.</span>') + '</div></div>';

    if (note) {
      note.textContent = 'Стрелки клавиатуры ← и → листают стихи. Ссылку на стих можно передать: адрес содержит книгу и номер стиха.';
    }
  }

  function selectedLetters() {
    var paleo = get('scripture-paleo');
    if (!paleo) return [];
    return state.selectedIndexes.slice().sort(function(a, b) { return a - b; }).map(function(index) {
      var letter = paleo.querySelector('[data-index="' + index + '"]');
      if (!letter) return null;
      var hebrew = letter.getAttribute('data-hebrew') || PALEO.paleoToHebrew[letter.getAttribute('data-paleo')] || '';
      return {
        index: index,
        paleo: letter.getAttribute('data-paleo') || '',
        hebrew: hebrew,
        data: PALEO.byHebrew[hebrew] || { name: 'Неизвестная буква', image: 'образ не найден', meaning: '' }
      };
    }).filter(Boolean);
  }

  function isContiguous(indexes) {
    for (var i = 1; i < indexes.length; i++) {
      if (indexes[i] !== indexes[i - 1] + 1) return false;
    }
    return true;
  }

  function updateLetterState() {
    var paleo = get('scripture-paleo');
    if (!paleo) return;
    paleo.querySelectorAll('.scripture-paleo-letter').forEach(function(letter) {
      var index = Number(letter.getAttribute('data-index'));
      var selected = state.selectedIndexes.indexOf(index) !== -1;
      letter.classList.toggle('is-selected', selected);
      letter.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function selectedState() {
    if (!state.states.length) return null;
    return state.states.filter(function(item) { return item.id === 'tohu'; })[0] || state.states[0];
  }

  function lossLayersMarkup(compact) {
    var layers = [
      { label: 'Палео', value: 100 },
      { label: 'Слитный поток', value: 90 },
      { label: 'Масорет', value: 70 },
      { label: 'Греческий слой', value: 40 },
      { label: 'Латинский слой', value: 25 },
      { label: 'Синодальный слой', value: 15 }
    ];
    return '<div class="scripture-loss-scale' + (compact ? ' scripture-loss-scale-compact' : '') + '" aria-label="Шкала сохранности физики образа">' +
      layers.map(function(layer) {
        return '<div class="scripture-loss-scale-row"><span>' + escapeHtml(layer.label) + '</span>' +
          '<span class="scripture-loss-track"><span style="width:' + layer.value + '%"></span></span>' +
          '<strong>' + layer.value + '%</strong></div>';
      }).join('') + '</div>';
  }

  function stateMarkup() {
    var item = selectedState();
    if (!item) {
      return '<div class="scripture-state-card"><strong>Карта пространств</strong><p class="text-muted">Состояния не загружены.</p></div>';
    }
    return '<section class="scripture-state-card" aria-labelledby="scripture-state-title">' +
      '<div class="scripture-state-kicker">Состояние пространства</div>' +
      '<h3 id="scripture-state-title">' + escapeHtml(item.name || item.id) + '</h3>' +
      '<p>' + escapeHtml(item.physics || item.meaning || '') + '</p>' +
      '<small>Диагностическая гипотеза для выбранной цепи, не окончательный вывод.</small>' +
      '</section>';
  }

  // Единая точка входа ячейки «Разбор слова»: режим переключает, что именно
  // разбирается — целое слово или выделенные буквы. Две отдельные функции рендера
  // жили в одной панели и пользователь не понимал, какая к чему относится.
  function renderAnalysis() {
    var content = get('scripture-physics-content');
    if (!content) return;
    if (!state.currentBook) {
      content.innerHTML = emptyMarkup('Откройте книгу, чтобы разбирать слова.');
      return;
    }
    if (state.mode === 'word') {
      if (state.selectedWordIndex == null) {
        content.innerHTML = emptyMarkup('Нажмите на слово палео-текста, чтобы увидеть его разбор.');
        return;
      }
      renderWordAnalysis(state.selectedWordIndex);
      return;
    }
    renderLettersAnalysis();
  }

  function emptyMarkup(text) {
    return '<div class="sr-empty"><span class="sr-empty-glyph" aria-hidden="true">𐤀</span>' +
      '<p class="sr-empty-text">' + escapeHtml(text) + '</p></div>';
  }

  function setMode(mode) {
    state.mode = mode === 'letters' ? 'letters' : 'word';
    var wordBtn = get('sr-mode-word');
    var lettersBtn = get('sr-mode-letters');
    if (wordBtn) wordBtn.setAttribute('aria-pressed', state.mode === 'word' ? 'true' : 'false');
    if (lettersBtn) lettersBtn.setAttribute('aria-pressed', state.mode === 'letters' ? 'true' : 'false');
    renderAnalysis();
  }

  function renderLettersAnalysis() {
    var content = get('scripture-physics-content');
    var letters = selectedLetters();
    if (!content) return;

    if (letters.length < 2) {
      content.innerHTML = emptyMarkup('Выделите две или более соседних букв палео-потока: Shift и клик по буквам.') +
        copyButtonMarkup(true);
      return;
    }

    var letterCards = letters.map(function(letter) {
      return '<article class="scripture-analysis-letter">' +
        '<div class="scripture-analysis-paleo">' + escapeHtml(letter.paleo) + '</div>' +
        '<div class="scripture-analysis-name">' + escapeHtml(letter.data.name) + '</div>' +
        '<div class="scripture-analysis-image">' + escapeHtml(letter.data.image || '') + '</div>' +
        (letter.data.meaning ? '<p>' + escapeHtml(letter.data.meaning) + '</p>' : '') +
        '</article>';
    }).join('');
    var selectedHebrew = letters.map(function(letter) { return letter.hebrew; }).join('');
    var selectedPaleo = letters.map(function(letter) { return letter.paleo; }).join('');
    var canSearchRoot = PALEO.canSearchRoot(selectedHebrew);
    var root = canSearchRoot ? state.roots.filter(function(item) {
      return PALEO.normalizeHebrew(item.root) === PALEO.normalizeHebrew(selectedHebrew);
    })[0] : null;
    var image = root && root.image
      ? root.image
      : letters.map(function(letter) { return letter.data.image; }).join(' + ');
    var rootHTML = letters.length > 4
      ? '<div class="scripture-hypothesis"><strong>Корень не ищется</strong><div>Выбрано ' + letters.length + ' букв. Для поиска корня выберите от 2 до 4 букв.</div></div>'
      : root
      ? '<div class="scripture-root-result"><strong>Корень <span class="hebrew">' + escapeHtml(root.root) + '</span></strong>' +
        '<div>' + escapeHtml(root.meaning || '') + '</div>' +
        (root.examples && root.examples.length ? '<ul>' + root.examples.map(function(example) {
          return '<li>' + escapeHtml(example) + '</li>';
        }).join('') + '</ul>' : '') +
        '</div>'
      : '<div class="scripture-hypothesis"><strong>Гипотетический смысл</strong><div>' + escapeHtml(image) + '</div>' +
        '<small>Образная интерпретация, корень не найден в словаре.</small></div>';

    var assembly = letters.map(function(letter) {
      return letter.data.meaning || letter.data.image || letter.data.name;
    }).join(' → ');

    content.innerHTML = '<div class="scripture-physics-summary">' +
      '<div class="scripture-analysis-letters">' + letterCards + '</div>' +
      '<section class="scripture-assembly"><div class="scripture-section-label">Сборка-действие</div><p>' + escapeHtml(assembly) + '</p></section>' +
      '<p class="scripture-composite"><strong>Цепь образов:</strong> ' + escapeHtml(image) + '</p>' +
      '<p class="scripture-selection"><span class="scripture-selection-paleo">' + escapeHtml(selectedPaleo) + '</span> → <span class="hebrew">' + escapeHtml(selectedHebrew) + '</span></p>' +
      copyButtonMarkup(false) +
      rootHTML + stateMarkup() + lossLayersMarkup(true) + '</div>';
  }

  // Свидетельство собирается из того, что реально выбрано: слово или буквы.
  // Поля переиспользует ИИ-модуль, поэтому сборка-действие и стих уходят вместе.
  function currentEvidence() {
    var verse = state.verses[state.currentVerse];
    if (!verse || !state.currentBook) return null;

    var letters = selectedLetters();
    var base = {
      book: state.currentBook.id,
      bookRu: state.currentBook.ru,
      chapter: verse.chapter || 1,
      verse: verse.verse,
      mode: state.mode,
      verseFunction: verse.paleo_function || verse.verse_function || verse.function || '',
      savedAt: new Date().toISOString()
    };
    if (state.mode === 'word' && state.selectedWordIndex != null) {
      var word = currentWordData(state.selectedWordIndex);
      return Object.assign(base, {
        paleo: word.paleo || '',
        hebrew: cleanHebrewWord(word.hebrew || ''),
        translit: word.translit || '',
        assembly: word.assembly || '',
        letters: Array.from(cleanHebrewWord(word.hebrew || '')).map(function(letter) {
          var data = PALEO.byHebrew[letter] || {};
          return { hebrew: letter, paleo: PALEO.toPaleo(letter), image: data.image, meaning: paleoFunction(letter) };
        })
      });
    }
    if (!letters.length) return null;
    return Object.assign(base, {
      paleo: letters.map(function(letter) { return letter.paleo; }).join(''),
      hebrew: letters.map(function(letter) { return letter.hebrew; }).join(''),
      assembly: letters.map(function(letter) { return letter.data.meaning || letter.data.image || ''; }).join(' → '),
      letters: letters.map(function(letter) {
        return { paleo: letter.paleo, hebrew: letter.hebrew, image: letter.data.image, meaning: letter.data.meaning };
      })
    });
  }

  function readEvidence() {
    try {
      var saved = JSON.parse(localStorage.getItem(EVIDENCE_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function renderEvidenceList() {
    var host = get('sr-evidence');
    if (!host) return;
    var saved = readEvidence().slice(0, 5);
    if (!saved.length) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML = '<li class="sr-legend-item"><span class="sr-note">Сохранённые свидетельства</span></li>' +
      saved.map(function(item) {
        var ref = escapeHtml((item.bookRu || item.book || '') + ' ' + (item.chapter || 1) + ':' + (item.verse || ''));
        return '<li class="sr-legend-item"><span class="sr-book-name">' + ref + '</span>' +
          '<span class="sr-book-paleo" lang="hbo">' + escapeHtml(item.paleo || '') + '</span>' +
          (item.ai && item.ai.confidence ? '<span class="sr-confidence sr-confidence--' + escapeHtml(item.ai.confidence) + '">ИИ: ' + escapeHtml(item.ai.confidence) + '</span>' : '') +
          '</li>';
      }).join('');
  }

  function saveEvidence() {
    var evidence = currentEvidence();
    if (!evidence) {
      if (typeof LabToast !== 'undefined') LabToast.show('Сначала выберите слово или буквы.');
      return;
    }
    // Ответ ИИ — часть свидетельства, если он уже получен для этого фрагмента.
    if (window.ScriptureAI) {
      var ai = window.ScriptureAI.lastFor(evidence);
      if (ai) evidence.ai = ai;
    }
    try {
      var saved = readEvidence();
      saved.unshift(evidence);
      localStorage.setItem(EVIDENCE_KEY, JSON.stringify(saved.slice(0, 50)));
      renderEvidenceList();
      if (typeof LabToast !== 'undefined') LabToast.show('Свидетельство сохранено в этом браузере.');
    } catch (error) {
      if (typeof LabToast !== 'undefined') LabToast.show('Не удалось сохранить свидетельство.');
    }
  }

  // Сетевой разбор уехал в js/scripture-ai.js: модуль чтения не знает про сеть,
  // а ячейка «Разбор свидетельств» не зависит от логики стиха.

  function selectWord(wordIndex) {
    var paleo = get('scripture-paleo');
    var word = paleo && paleo.querySelector('.scripture-paleo-word[data-word-index="' + wordIndex + '"]');
    if (!word) return;
    state.selectedWordIndex = Number(wordIndex);
    state.selectedIndexes = Array.prototype.map.call(word.querySelectorAll('.scripture-paleo-letter'), function(letter) {
      return Number(letter.getAttribute('data-index'));
    });
    updateLetterState();
    setMode('word');
    if (window.ScriptureAI) window.ScriptureAI.invalidate();
  }

  function handleLetterClick(event) {
    var word = event.target.closest('.scripture-paleo-word');
    if (word && !event.shiftKey) {
      event.preventDefault();
      selectWord(word.getAttribute('data-word-index'));
      return;
    }
    var letter = event.target.closest('.scripture-paleo-letter');
    if (!letter) return;

    event.preventDefault();
    var index = Number(letter.getAttribute('data-index'));
    var position = state.selectedIndexes.indexOf(index);
    if (position !== -1) {
      state.selectedIndexes.splice(position, 1);
    } else {
      var sorted = state.selectedIndexes.slice().sort(function(a, b) { return a - b; });
      if (sorted.length && index !== sorted[0] - 1 && index !== sorted[sorted.length - 1] + 1) {
        if (typeof LabToast !== 'undefined') LabToast.show('Выбирайте последовательные соседние буквы.');
        return;
      }
      state.selectedIndexes.push(index);
    }
    var sortedSelection = state.selectedIndexes.slice().sort(function(a, b) { return a - b; });
    if (!isContiguous(sortedSelection)) state.selectedIndexes = [];
    updateLetterState();
    // Выделение букв всегда переводит ячейку в режим «Буквы»: иначе разбор
    // продолжал бы показывать слово, хотя выбраны отдельные знаки.
    setMode('letters');
    if (window.ScriptureAI) window.ScriptureAI.invalidate();
  }

  function handlePaleoKeydown(event) {
    var target = event.target.closest('.scripture-paleo-word, .scripture-paleo-letter');
    if (!target || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (target.classList.contains('scripture-paleo-word')) {
      selectWord(target.getAttribute('data-word-index'));
    } else {
      handleLetterClick({ target: target, shiftKey: true, preventDefault: function() {} });
    }
  }

  function setHoveredWord(wordIndex) {
    var reader = get('scripture-reader');
    if (!reader) return;
    reader.querySelectorAll('.scripture-word').forEach(function(word) {
      word.classList.toggle('is-word-hovered', word.getAttribute('data-word-index') === String(wordIndex));
    });
  }

  function clearHoveredWord() {
    var reader = get('scripture-reader');
    if (!reader) return;
    reader.querySelectorAll('.scripture-word.is-word-hovered').forEach(function(word) {
      word.classList.remove('is-word-hovered');
    });
  }

  function handleWordHover(event) {
    var word = event.target.closest('.scripture-word');
    if (!word) return;
    setHoveredWord(word.getAttribute('data-word-index'));
  }

  function moveVerse(step) {
    var nextIndex = state.currentVerse + step;
    if (nextIndex < 0 || nextIndex >= state.verses.length) return;
    state.currentVerse = nextIndex;
    renderVerse();
  }

  function bindEvents() {
    var previous = get('scripture-prev');
    var next = get('scripture-next');
    var paleo = get('scripture-paleo');
    var reader = get('scripture-reader');
    var searchInput = get('sr-search');
    var categorySelect = get('sr-category');

    if (previous) previous.addEventListener('click', function() { moveVerse(-1); });
    if (searchInput) {
      searchInput.addEventListener('input', renderBookGrid);
      searchInput.addEventListener('search', renderBookGrid);
    }
    if (categorySelect) categorySelect.addEventListener('change', renderBookGrid);
    if (next) next.addEventListener('click', function() { moveVerse(1); });
    if (paleo) paleo.addEventListener('click', handleLetterClick);
    if (paleo) paleo.addEventListener('keydown', handlePaleoKeydown);
    if (reader) {
      reader.addEventListener('pointerdown', function(event) {
        glyphPointerType = event.pointerType || 'mouse';
      });
      reader.addEventListener('pointerover', function(event) {
        var chip = event.target.closest('.scripture-glyph-chip');
        if (!chip || event.pointerType === 'touch') return;
        glyphPopoverTimer = window.setTimeout(function() { showGlyphPopover(chip); }, 150);
      });
      reader.addEventListener('pointerout', function(event) {
        var chip = event.target.closest('.scripture-glyph-chip');
        if (!chip || chip.contains(event.relatedTarget)) return;
        glyphPopoverTimer = window.setTimeout(hideGlyphPopover, 150);
      });
      reader.addEventListener('focusin', function(event) {
        var chip = event.target.closest('.scripture-glyph-chip');
        if (chip) showGlyphPopover(chip);
      });
      reader.addEventListener('focusout', function(event) {
        if (!event.target.closest('.scripture-glyph-chip')) return;
        glyphPopoverTimer = window.setTimeout(hideGlyphPopover, 150);
      });
      reader.addEventListener('click', function(event) {
        var chip = event.target.closest('.scripture-glyph-chip');
        if (!chip) return;
        event.preventDefault();
        if (glyphPointerType === 'touch' && activeGlyphChip === chip && glyphPopover && !glyphPopover.hidden) hideGlyphPopover();
        else showGlyphPopover(chip);
      });
    }
    if (!state.glyphEscapeBound) {
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') hideGlyphPopover();
      });
      state.glyphEscapeBound = true;
    }
    // Клики по словам в строках иврита и транслитерации открывают палео-сборку.
    ['scripture-hebrew', 'scripture-translit'].forEach(function(id) {
      var layer = get(id);
      if (layer) layer.addEventListener('click', function(event) {
        var word = event.target.closest('.scripture-fourline');
        if (!word) return;
        event.preventDefault();
        selectWord(word.getAttribute('data-word-index'));
      });
    });
    var copyVerse = get('scripture-copy-verse');
    if (copyVerse) copyVerse.addEventListener('click', copyCurrentVerse);
    var physicsContent = get('scripture-physics-content');
    if (physicsContent) physicsContent.addEventListener('click', function(event) {
      if (event.target.closest('.scripture-copy-selection')) copySelection();
    });

    var wordMode = get('sr-mode-word');
    var lettersMode = get('sr-mode-letters');
    if (wordMode) wordMode.addEventListener('click', function() { setMode('word'); });
    if (lettersMode) lettersMode.addEventListener('click', function() { setMode('letters'); });

    var saveTool = get('sr-tool-save');
    if (saveTool) saveTool.addEventListener('click', saveEvidence);

    var aiRun = get('sr-ai-run');
    var aiRetry = get('sr-ai-retry');
    var aiCopy = get('sr-ai-copy');
    if (aiRun && window.ScriptureAI) aiRun.addEventListener('click', function() { window.ScriptureAI.ask(); });
    if (aiRetry && window.ScriptureAI) aiRetry.addEventListener('click', function() { window.ScriptureAI.ask(true); });
    if (aiCopy && window.ScriptureAI) aiCopy.addEventListener('click', function() { window.ScriptureAI.copy(); });

    if (reader) {
      reader.addEventListener('mouseover', handleWordHover);
      reader.addEventListener('mouseout', function(event) {
        if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest('.scripture-word')) {
          clearHoveredWord();
        }
      });
      reader.addEventListener('focusin', handleWordHover);
      reader.addEventListener('focusout', clearHoveredWord);
    }

    var books = get('sr-books');
    if (books) books.addEventListener('click', function(event) {
      var row = event.target.closest('.sr-book-row');
      if (!row) return;
      openBook(row.getAttribute('data-book-id'));
    });

    // Пустое состояние не пишет в localStorage, поэтому берём книгу из
    // data-book-id, а сохранённый стих — только если он реально есть.
    var resumeButton = get('sr-resume-open');
    if (resumeButton) resumeButton.addEventListener('click', function() {
      var last = readLast();
      var bookId = (last && last.book) || resumeButton.getAttribute('data-book-id');
      if (bookId) openBook(bookId, last && last.verse);
    });

    var verseNavigation = get('scripture-verse-nav');
    if (verseNavigation) verseNavigation.addEventListener('click', function(event) {
      var chapterChip = event.target.closest('.sr-chip[data-chapter]');
      if (chapterChip) {
        var chapter = Number(chapterChip.getAttribute('data-chapter'));
        var first = chapterVerses(chapterChip.getAttribute('data-source-book') || '', chapter)[0];
        if (first) {
          state.currentVerse = first.index;
          renderVerse();
        }
        return;
      }
      var chip = event.target.closest('.sr-chip[data-verse-index]');
      if (!chip) return;
      state.currentVerse = Number(chip.getAttribute('data-verse-index'));
      renderVerse();
    });

    var jumpForm = get('scripture-jump-form');
    if (jumpForm) jumpForm.addEventListener('submit', function(event) {
      event.preventDefault();
      jumpToRef();
    });

    // Листание стрелками: работает только когда фокус не в поле ввода,
    // иначе переход по «глава:стих» перехватывал бы набор цифр.
    if (!state.arrowKeysBound) {
      state.arrowKeysBound = true;
      document.addEventListener('keydown', function(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        var tag = (event.target && event.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        var reading = get('sr-reading');
        if (!reading || reading.hidden || !state.verses.length) return;
        event.preventDefault();
        moveVerse(event.key === 'ArrowRight' ? 1 : -1);
      });
    }
  }

  // Переход «глава:стих»: главы переключаются первыми при совпадении номера.
  function jumpToRef() {
    var input = get('scripture-jump');
    if (!input) return;
    var value = String(input.value || '').trim();
    var match = value.match(/^(\d+)\s*[:.\-]\s*(\d+)$/);
    if (!match) {
      if (typeof LabToast !== 'undefined') LabToast.show('Укажите стих в виде «глава:стих», например 1:14.');
      return;
    }
    var chapter = Number(match[1]);
    var verse = match[2];
    var found = state.verses.findIndex(function(item) {
      return Number(item.chapter || 1) === chapter && String(item.verse) === verse;
    });
    if (found < 0) {
      if (typeof LabToast !== 'undefined') LabToast.show('Стих ' + chapter + ':' + verse + ' в этой книге не найден.');
      return;
    }
    state.currentVerse = found;
    renderVerse();
  }

  function load() {
    if (state.loading) return state.loading;
    if (state.loaded) return Promise.resolve();
    state.loading = Promise.all([
      fetch('data/qumran-books.json').then(function(response) {
        if (!response.ok) throw new Error('qumran-books.json HTTP ' + response.status);
        return response.json();
      }),
    AlephyUtils.fetchJson('data/roots/roots.json'),
      fetch('data/states.json').then(function(response) {
        if (!response.ok) throw new Error('states.json HTTP ' + response.status);
        return response.json();
      }).catch(function() { return { states: [] }; })
    ]).then(function(results) {
        state.books = Array.isArray(results[0].books) ? results[0].books : [];
        state.roots = Array.isArray(results[1]) ? results[1] : [];
        state.states = Array.isArray(results[2].states) ? results[2].states : [];
        state.loaded = true;
        renderBookGrid();
        renderEvidenceList();
        showBookGrid();
        if (state.pendingBookId) {
          var requestedBookId = state.pendingBookId;
          var requestedVerse = state.pendingVerse;
          state.pendingBookId = null;
          state.pendingVerse = null;
          openBook(requestedBookId, requestedVerse);
        }
      })
      .catch(function(error) {
        // Каталог не поднялся: сообщаем в самой ячейке поиска, экраны не трогаем.
        var host = get('sr-books');
        if (host) {
          host.innerHTML = '<div class="sr-empty"><span class="sr-empty-glyph" aria-hidden="true">𐤀</span>' +
            '<p class="sr-empty-text">Каталог недоступен: ' + escapeHtml(error.message) + '</p></div>';
        }
        throw error;
      });
    return state.loading;
  }

  function init(parsed) {
    var reader = get('scripture-reader');
    if (!reader) return;
    var requestedBookId = parsed && parsed.params && parsed.params.book;
    var requestedVerse = parsed && parsed.params && parsed.params.verse;
    if (requestedBookId) {
      if (state.loaded) openBook(requestedBookId, requestedVerse);
      else {
        state.pendingBookId = requestedBookId;
        state.pendingVerse = requestedVerse || null;
      }
    }
    if (state.boundRoot !== reader) {
      bindEvents();
      state.boundRoot = reader;
      state.initialized = true;
      if (state.loaded) {
        renderBookGrid();
        renderEvidenceList();
        showBookGrid();
        if (requestedBookId) openBook(requestedBookId, requestedVerse);
      }
    }
    if (!state.loaded) load().catch(function() {});
  }

  window.ScriptureReader = {
    init: init,
    openBook: openBook,
    renderVerse: renderVerse,
    // ИИ-модуль спрашивает разбор у модуля чтения, а не знает про DOM.
    currentEvidence: currentEvidence,
    getBooks: function() { return state.books; },
    getVerses: function() { return state.verses; },
    getCurrentBook: function() { return state.currentBook; }
  };
  return window.ScriptureReader;
})();

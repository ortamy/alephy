// Scripture Reader: Qumran-attested Tanakh books, grid of cards + verse browsing.
const ScriptureReader = (function() {
  'use strict';

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
    readingMode: 'assembly',
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
      '<svg class="scripture-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<rect x="8" y="8" width="11" height="11" rx="1.5"></rect>' +
      '<path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"></path>' +
      '</svg>' +
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
      '<section class="scripture-constructor"><div class="scripture-layer-label">Палео-конструктор</div><div class="scripture-constructor-words">' + wordBlocks + '</div></section>' +
      '<details class="scripture-assembly-details"><summary>Механика</summary>' +
      '<div class="scripture-assembly-words">' + words.map(function(word, index) { return '<p>' + escapeHtml(word.paleo || '') + ' · ' + escapeHtml(chains[index].join(' → ')) + '</p>'; }).join('') + '</div></details>';
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

  function bookSearchQuery() {
    var input = get('scripture-search-input');
    return input ? String(input.value || '').trim().toLowerCase() : '';
  }

  function bookCategoryFilter() {
    var select = get('scripture-category');
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
    var select = get('scripture-category');
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

  function setBookSearchVisible(visible) {
    var search = get('scripture-search');
    if (search) search.style.display = visible ? '' : 'none';
  }

  function renderBookGrid() {
    var grid = get('scripture-book-grid');
    if (!grid) return;
    fillCategorySelect();
    var books = state.books.filter(function(book) {
      return bookMatchesCategory(book, bookCategoryFilter()) && bookMatchesQuery(book, bookSearchQuery());
    });
    if (!books.length) {
      grid.innerHTML = '<p class="scripture-search-empty">Книги не найдены.</p>';
      return;
    }
    grid.innerHTML = books.map(function(book) {
      var statusClass = book.dataFile ? 'book-status-ready' : 'book-status-pending';
      var statusLabel = book.dataFile ? 'Есть данные' : 'В работе';
      var badge = '<div class="book-status ' + statusClass + '">' + statusLabel + '</div>';
      return '<a href="#" class="tool-card scripture-book-card" data-book-id="' + escapeHtml(book.id) + '">' +
        '<span class="tool-icon"><img src="assets/icons/32/ui/book.png" width="32" height="32" alt=""></span>' +
        '<div class="tool-name">' + escapeHtml(book.ru) + '</div>' +
        '<div class="tool-desc">' + escapeHtml(book.paleo || '') + '</div>' +
        badge +
        '</a>';
    }).join('');
  }

  function showBookGrid() {
    var grid = get('scripture-book-grid');
    var article = get('scripture-verse-article');
    var verseNav = get('scripture-verse-nav');
    var nav = get('scripture-navigation');
    var topNav = get('scripture-navigation-top');
    var analysis = get('scripture-analysis');
    var tools = get('scripture-tools');
    if (grid) grid.style.display = 'grid';
    setBookSearchVisible(true);
    if (article) article.style.display = 'none';
    if (verseNav) verseNav.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (topNav) topNav.style.display = 'none';
    if (analysis) analysis.style.display = 'none';
    if (tools) tools.style.display = 'none';
    state.currentBook = null;
  }

  function showVerseView() {
    var grid = get('scripture-book-grid');
    var article = get('scripture-verse-article');
    var verseNav = get('scripture-verse-nav');
    var nav = get('scripture-navigation');
    var topNav = get('scripture-navigation-top');
    var analysis = get('scripture-analysis');
    var tools = get('scripture-tools');
    if (grid) grid.style.display = 'none';
    setBookSearchVisible(false);
    if (article) article.style.display = '';
    if (verseNav) verseNav.style.display = '';
    if (nav) nav.style.display = '';
    if (topNav) topNav.style.display = '';
    if (analysis) analysis.style.display = '';
    if (tools) tools.style.display = '';
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
    loadVerses(book, verseNumber);
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
    var analysis = get('scripture-analysis');
    var physicsTrigger = get('scripture-physics-trigger');
    var physicsPanel = get('scripture-physics-panel');

    state.selectedIndexes = [];
    state.selectedWordIndex = null;

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
    if (analysis) {
      var content = get('scripture-physics-content');
      if (content) content.innerHTML = '<p class="text-muted">Нажми на слово для разбора.</p>';
      if (physicsTrigger) physicsTrigger.setAttribute('aria-expanded', 'false');
      if (physicsPanel) { physicsPanel.hidden = true; physicsPanel.classList.remove('is-open'); }
    }
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

  // Навигация глава → стих в белом контейнере.
  function renderChapterVerseNav() {
    var navigation = get('scripture-verse-nav');
    if (!navigation) return;
    var currentVerse = state.verses[state.currentVerse];
    var currentChapter = currentVerse ? currentVerse.chapter : 1;
    var currentSourceBook = currentVerse ? (currentVerse.source_book || '') : '';

    var chapters = verseChapters();
    var hasMultipleSourceBooks = chapters.some(function(item) { return item.sourceBook !== currentSourceBook; });
    var chapterButtons = chapters.map(function(item) {
      var active = item.chapter === currentChapter && item.sourceBook === currentSourceBook;
      var label = (hasMultipleSourceBooks ? item.sourceBook + ' ' : '') + item.chapter;
      return '<button type="button" class="chapter-btn' + (active ? ' active' : '') + '" data-chapter="' + item.chapter + '" data-source-book="' + escapeHtml(item.sourceBook) + '"' +
        (active ? ' aria-current="true"' : '') + ' aria-label="Открыть главу ' + escapeHtml(label) + '">' +
        escapeHtml(label) + '</button>';
    }).join('');

    var verses = chapterVerses(currentSourceBook, currentChapter);
    var verseButtons = verses.map(function(item) {
      var active = item.index === state.currentVerse;
      return '<button type="button" class="verse-num' + (active ? ' active' : '') + '" data-verse-index="' + item.index + '"' +
        (active ? ' aria-current="true"' : '') + ' aria-label="Открыть стих ' + escapeHtml(item.verse) + '">' +
        escapeHtml(item.verse) + '</button>';
    }).join('');

    navigation.innerHTML = '<div class="scripture-chapter-nav">' +
      '<div class="scripture-nav-label">Главы</div>' +
      '<div class="scripture-chapter-buttons">' + (chapterButtons || '<span class="text-muted">Главы не найдены.</span>') + '</div>' +
      '<div class="scripture-nav-label">Стихи</div>' +
      '<div class="scripture-verse-buttons">' + (verseButtons || '<span class="text-muted">В главе нет стихов.</span>') + '</div>' +
      '</div>';
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

  function renderAnalysis() {
    var content = get('scripture-physics-content');
    var letters = selectedLetters();
    if (!content) return;

    if (letters.length < 2) {
      content.innerHTML = '<p class="text-muted">Выберите слово или последовательность букв палео-потока.</p>' +
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

  function openPhysics() {
    var trigger = get('scripture-physics-trigger');
    var panel = get('scripture-physics-panel');
    if (!trigger || !panel) return;
    panel.hidden = false;
    panel.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    panel.style.maxHeight = panel.scrollHeight + 'px';
  }

  function closePhysics() {
    var trigger = get('scripture-physics-trigger');
    var panel = get('scripture-physics-panel');
    if (!trigger || !panel) return;
    trigger.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    panel.style.maxHeight = '0px';
    window.setTimeout(function() {
      if (trigger.getAttribute('aria-expanded') === 'false') panel.hidden = true;
    }, 280);
  }

  function currentEvidence() {
    var verse = state.verses[state.currentVerse];
    var letters = selectedLetters();
    if (!verse || !letters.length) return null;
    return {
      book: state.currentBook && state.currentBook.ru,
      verse: verse.verse,
      paleo: letters.map(function(letter) { return letter.paleo; }).join(''),
      hebrew: letters.map(function(letter) { return letter.hebrew; }).join(''),
      letters: letters.map(function(letter) {
        return { paleo: letter.paleo, hebrew: letter.hebrew, image: letter.data.image, meaning: letter.data.meaning };
      }),
      savedAt: new Date().toISOString()
    };
  }

  function saveEvidence() {
    var evidence = currentEvidence();
    if (!evidence) {
      if (typeof LabToast !== 'undefined') LabToast.show('Сначала выберите слово или буквы.');
      return;
    }
    try {
      var key = 'alephy_scripture_evidence_v1';
      var saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(saved)) saved = [];
      saved.unshift(evidence);
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 50)));
      copyText(JSON.stringify(evidence, null, 2), 'Свидетельство сохранено и скопировано.');
    } catch (error) {
      if (typeof LabToast !== 'undefined') LabToast.show('Не удалось сохранить свидетельство.');
    }
  }

  function requestAIAnalysis() {
    var evidence = currentEvidence();
    if (!evidence) return Promise.resolve();
    return fetch('http://localhost:8000/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'researcher',
        task: 'Разбери выбранный палео-фрагмент без замены локальной физики: ' + JSON.stringify(evidence)
      })
    }).then(function(response) {
      if (!response.ok) throw new Error('AI HTTP ' + response.status);
      return response.json();
    }).then(function(result) {
      var content = get('scripture-physics-content');
      var text = result && (result.result || result.output || result.text);
      if (content && text) {
        content.insertAdjacentHTML('beforeend', '<div class="scripture-ai-note"><strong>Заметка исследователя</strong><p>' + escapeHtml(text) + '</p></div>');
        openPhysics();
      }
    }).catch(function() {
      // Локальный разбор остаётся доступен без сервера.
    });
  }

  function selectWord(wordIndex) {
    var paleo = get('scripture-paleo');
    var word = paleo && paleo.querySelector('.scripture-paleo-word[data-word-index="' + wordIndex + '"]');
    if (!word) return;
    state.selectedWordIndex = Number(wordIndex);
    state.selectedIndexes = Array.prototype.map.call(word.querySelectorAll('.scripture-paleo-letter'), function(letter) {
      return Number(letter.getAttribute('data-index'));
    });
    updateLetterState();
    renderWordAnalysis(wordIndex);
    openPhysics();
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
    renderAnalysis();
    if (state.selectedIndexes.length) openPhysics();
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
    var grid = get('scripture-book-grid');
    var searchInput = get('scripture-search-input');
    var categorySelect = get('scripture-category');

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
    var analysis = get('scripture-analysis');
    if (analysis) analysis.addEventListener('click', function(event) {
      if (event.target.closest('.scripture-copy-selection')) copySelection();
    });
    var physicsTrigger = get('scripture-physics-trigger');
    if (physicsTrigger) physicsTrigger.addEventListener('click', function() {
      if (physicsTrigger.getAttribute('aria-expanded') === 'true') closePhysics();
      else openPhysics();
    });
    var analysisTool = get('scripture-tool-analysis');
    var saveTool = get('scripture-tool-save');
    if (analysisTool) analysisTool.addEventListener('click', function() {
      if (state.selectedIndexes.length) { renderAnalysis(); openPhysics(); }
      else if (typeof LabToast !== 'undefined') LabToast.show('Сначала выберите слово палео-текста.');
      requestAIAnalysis();
    });
    if (saveTool) saveTool.addEventListener('click', saveEvidence);
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
    if (grid) grid.addEventListener('click', function(event) {
      var card = event.target.closest('.scripture-book-card');
      if (!card) return;
      event.preventDefault();
      openBook(card.getAttribute('data-book-id'));
    });
    var verseNavigation = get('scripture-verse-nav');
    if (verseNavigation) verseNavigation.addEventListener('click', function(event) {
      var chapterBtn = event.target.closest('.chapter-btn');
      if (chapterBtn) {
        var chapter = Number(chapterBtn.getAttribute('data-chapter'));
        var first = chapterVerses(chapterBtn.getAttribute('data-source-book') || '', chapter)[0];
        if (first) {
          state.currentVerse = first.index;
          renderVerse();
        }
        return;
      }
      var button = event.target.closest('.verse-num');
      if (!button) return;
      state.currentVerse = Number(button.getAttribute('data-verse-index'));
      renderVerse();
    });
  }

  function load() {
    if (state.loading) return state.loading;
    if (state.loaded) return Promise.resolve();
    state.loading = Promise.all([
      fetch('data/qumran-books.json').then(function(response) {
        if (!response.ok) throw new Error('qumran-books.json HTTP ' + response.status);
        return response.json();
      }),
    fetch('data/roots/roots.json').then(function(response) {
      if (!response.ok) throw new Error('roots/roots.json HTTP ' + response.status);
        return response.json();
      }),
      fetch('data/states.json').then(function(response) {
        if (!response.ok) throw new Error('states.json HTTP ' + response.status);
        return response.json();
      }).catch(function() { return { states: [] }; })
    ]).then(function(results) {
        state.books = Array.isArray(results[0].books) ? results[0].books : [];
        state.roots = Array.isArray(results[1]) ? results[1] : [];
        state.states = Array.isArray(results[2].states) ? results[2].states : [];
        renderBookGrid();
        showBookGrid();
        state.loaded = true;
        if (state.pendingBookId) {
          var requestedBookId = state.pendingBookId;
          var requestedVerse = state.pendingVerse;
          state.pendingBookId = null;
          state.pendingVerse = null;
          openBook(requestedBookId, requestedVerse);
        }
      })
      .catch(function(error) {
        var module = get('scripture-reader');
        if (module) {
          module.innerHTML = '<div class="lab-alert lab-alert-error scripture-reader-error">Ошибка загрузки списка книг: ' +
            escapeHtml(error.message) + '</div>';
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
    getBooks: function() { return state.books; },
    getVerses: function() { return state.verses; },
    getCurrentBook: function() { return state.currentBook; }
  };
  return window.ScriptureReader;
})();

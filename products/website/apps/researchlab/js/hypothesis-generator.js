/**
 * hypothesis-generator.js — «Генератор гипотез»: альтернативные чтения объекта.
 * Разметка: pages/hypothesis-generator.html; канон панелей — css/components/panels.css.
 * Данные: data/roots/roots.json, data/dictionaries.json, data/witnesses.json.
 * Правило: гипотеза без теста на опровержение не выдаётся — записи без falsify
 * отфильтровываются движком.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/hypothesis-generator.html';
  var ROOTS_PATH = 'data/roots/roots.json';
  var DICTS_PATH = 'data/dictionaries.json';
  var WITNESS_PATH = 'data/witnesses.json';
  var STORAGE_KEY = 'alephy_hypothesis_history';
  var BOARD_PREFILL_KEY = 'alephy_board_generator_prefill';
  var HISTORY_LIMIT = 5;
  var TYPES = ['word', 'verse', 'root'];

  var pagePromise = null;
  var dom = {};
  var state = {
    activeType: 'word',
    object: '',
    hits: { root: null, dict: null, witness: null },
    hypotheses: [],
    history: [],
    loaded: false,
    dataError: false
  };
  var store = { roots: null, dicts: null, witnesses: null };

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function(match, key) {
      return values[key] == null ? match : esc(values[key]);
    });
  }

  function cap(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function fetchPage() {
    if (!pagePromise) {
      pagePromise = fetch(PAGE_PATH).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      });
    }
    return pagePromise;
  }

  function loadJson(path) {
    return fetch(path).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function loadData() {
    if (state.loaded) return Promise.resolve();
    return Promise.all([
      loadJson(ROOTS_PATH).catch(function() { return null; }),
      loadJson(DICTS_PATH).catch(function() { return null; }),
      loadJson(WITNESS_PATH).catch(function() { return null; })
    ]).then(function(results) {
      store.roots = Array.isArray(results[0]) ? results[0] : null;
      store.dicts = results[1] && typeof results[1] === 'object' ? results[1] : null;
      store.witnesses = Array.isArray(results[2]) ? results[2] : null;
      state.dataError = !store.roots && !store.dicts && !store.witnesses;
      state.loaded = true;
    });
  }

  // ===== Поиск по источникам =====
  function normalize(value) {
    return String(value == null ? '' : value).replace(/[«»"]/g, '').trim().toLowerCase();
  }

  function findRoot(query) {
    if (!store.roots) return null;
    var needle = normalize(query);
    if (needle.length < 2) return null;
    return store.roots.filter(function(item) {
      if (!item) return false;
      if (item.translit && item.translit.toLowerCase() === needle) return true;
      if (item.root && (item.root === query.trim() || (item.paleo || []).join('') === query.trim())) return true;
      if (item.meaning && needle.length >= 3 && item.meaning.toLowerCase().indexOf(needle) !== -1) return true;
      return false;
    })[0] || null;
  }

  function findDict(query) {
    if (!store.dicts) return null;
    var needle = normalize(query);
    if (needle.length < 2) return null;
    var keys = Object.keys(store.dicts);
    for (var k = 0; k < keys.length; k++) {
      var section = store.dicts[keys[k]];
      var terms = (section && section.terms) || [];
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (!term) continue;
        if (term.hebrew && term.hebrew === query.trim()) return { key: keys[k], title: section.title || keys[k], term: term };
        if (term.word && needle.length >= 3 && term.word.toLowerCase().indexOf(needle) !== -1) {
          return { key: keys[k], title: section.title || keys[k], term: term };
        }
      }
    }
    return null;
  }

  function findWitness(query) {
    if (!store.witnesses) return null;
    var needle = normalize(query).replace(/\s+/g, ' ');
    if (needle.length < 4) return null;
    return store.witnesses.filter(function(item) {
      if (!item) return false;
      if (item.ref && normalize(item.ref).replace(/\s+/g, ' ') === needle) return true;
      if (item.ref && needle.length >= 5 && normalize(item.ref).indexOf(needle) !== -1) return true;
      if (item.topic && needle.length >= 5 && normalize(item.topic).indexOf(needle) !== -1) return true;
      return false;
    })[0] || null;
  }

  function lookup(query) {
    return { root: findRoot(query), dict: findDict(query), witness: findWitness(query) };
  }

  // ===== Движок гипотез =====
  // Веса оснований: данные источника — 2, рамка проверки (методология/слои) — 1.
  var DATA_GROUNDS = ['gRootDict', 'gSubstitutionMap', 'gWitnesses', 'gLxx', 'gQumran', 'gPaleoTable'];

  function groundLabel(key) {
    var fallbacks = {
      gRootDict: 'словарь корней',
      gSubstitutionMap: 'карта подмен',
      gWitnesses: 'свидетели текста',
      gLxx: 'слой LXX',
      gQumran: 'Кумран',
      gPaleoTable: 'палео-таблица',
      gMethodology: 'методология',
      gLayers: 'слои'
    };
    return t('lab.hypothesisGenerator.' + key, fallbacks[key]);
  }

  function strengthOf(grounds) {
    return grounds.reduce(function(sum, key) {
      var dataBacked = DATA_GROUNDS.indexOf(key) !== -1 && (
        (key === 'gRootDict' && state.hits.root) ||
        (key === 'gSubstitutionMap' && state.hits.dict) ||
        ((key === 'gWitnesses' || key === 'gLxx' || key === 'gQumran') && state.hits.witness) ||
        (key === 'gPaleoTable' && (state.hits.root || state.hits.dict))
      );
      return sum + (dataBacked ? 2 : 1);
    }, 0);
  }

  function paleoString(source) {
    if (!source) return '';
    if (source.paleo && source.paleo.length) return source.paleo.join('');
    if (source.term && source.term.paleo) return source.term.paleo.join('');
    return '';
  }

  var FALLBACKS = {
    hLiteral: { title: 'Прямое чтение', desc: 'Объект «{object}» читается буквально: {value}', falsify: 'если в проверяемом корпусе нет ни одного употребления формы вне спорного места.' },
    hSubstitution: { title: 'Сдвиг перевода', desc: 'В «{object}» возможна подмена: {value}', falsify: 'если древние свидетели держат ту же форму без смыслового сдвига.' },
    hPaleo: { title: 'Палео-образ восстанавливает механику', desc: 'Буквенный ряд {paleo} даёт действие, а не ярлык — «{object}» читается как процесс.', falsify: 'если буквенный ряд не образует глагольного действия.' },
    hRootAction: { title: 'Корень как действие', desc: 'Корень «{object}»: {value}', falsify: 'если примеры корня не подтверждают действия.' },
    hRootShift: { title: 'Сдвиг через подмены', desc: 'У корня «{object}» зафиксированы подмены: {value}', falsify: 'если подмена не встречается в корпусе ни разу.' },
    hTransmission: { title: 'Текстуальная передача', desc: 'Место {ref} расходится между свидетелями: {value}', falsify: 'если все свидетели совпадают и расхождения нет.' },
    hTranslationShift: { title: 'Переводческий сдвиг', desc: 'Расхождение {ref} объясняется сдвигом при переводе: {value}', falsify: 'если масоретский текст и LXX читаются одинаково.' },
    hFrameLiteral: { title: 'Буквальное чтение (рамка)', desc: 'Данные по «{object}» не подтянулись — проверяется буквальное чтение.', falsify: 'если найдётся источник, где форма употреблена вне спорного места.' },
    hFrameFigurative: { title: 'Переносное чтение (рамка)', desc: 'Альтернатива для «{object}»: слово работает как образ, а не как термин.', falsify: 'если контекст требует терминологического, а не образного употребления.' }
  };

  function candidate(id, confidence, grounds, values) {
    var fallback = FALLBACKS[id];
    return {
      id: id,
      title: t('lab.hypothesisGenerator.' + id + 'Title', fallback.title),
      desc: fill(t('lab.hypothesisGenerator.' + id + 'Desc', fallback.desc), values || {}),
      falsify: t('lab.hypothesisGenerator.f' + id, fallback.falsify),
      grounds: grounds.map(groundLabel),
      confidence: confidence,
      strength: strengthOf(grounds)
    };
  }

  function buildHypotheses(type, query, hits) {
    var pool = [];
    var object = query.trim();
    var dictTerm = hits.dict ? hits.dict.term : null;
    var restored = dictTerm ? (dictTerm.restored || dictTerm.hebrew || '') : '';
    var rootMeaning = hits.root ? (hits.root.meaning || '') : '';
    var rootSubs = hits.root && hits.root.substitutions ? hits.root.substitutions : [];
    var paleo = paleoString(hits.root) || paleoString(dictTerm ? { term: dictTerm } : null);

    if (type === 'word') {
      pool.push(candidate('hLiteral', 'interpretation',
        [hits.dict ? 'gSubstitutionMap' : 'gMethodology', 'gLayers'],
        { object: object, value: restored || rootMeaning || 'значение не найдено' }));
      pool.push(candidate('hSubstitution', 'hypothesis',
        hits.dict ? ['gSubstitutionMap', 'gLxx'] : ['gMethodology'],
        { object: object, value: restored || 'сдвиг не зафиксирован в карте подмен' }));
      pool.push(candidate('hPaleo', 'hypothesis',
        (hits.dict || hits.root) ? ['gPaleoTable', 'gRootDict'] : ['gMethodology'],
        { object: object, paleo: paleo || '—' }));
    } else if (type === 'root') {
      pool.push(candidate('hRootAction', 'interpretation',
        hits.root ? ['gRootDict', 'gPaleoTable'] : ['gMethodology'],
        { object: object, value: rootMeaning || 'значение корня не найдено' }));
      pool.push(candidate('hRootShift', 'hypothesis',
        rootSubs.length ? ['gSubstitutionMap', 'gLayers'] : ['gMethodology'],
        { object: object, value: rootSubs.length ? rootSubs.join('; ') : 'подмены не зафиксированы' }));
      pool.push(candidate('hPaleo', 'hypothesis',
        hits.root ? ['gPaleoTable'] : ['gMethodology'],
        { object: object, paleo: paleo || '—' }));
    } else {
      pool.push(candidate('hTransmission', 'interpretation',
        hits.witness ? ['gWitnesses', 'gQumran', 'gLxx'] : ['gMethodology'],
        { ref: hits.witness ? hits.witness.ref : object,
          value: hits.witness ? (hits.witness.topic || '') : 'расхождений в данных нет' }));
      pool.push(candidate('hTranslationShift', 'hypothesis',
        hits.witness ? ['gLxx', 'gLayers'] : ['gMethodology'],
        { ref: hits.witness ? hits.witness.ref : object,
          value: hits.witness ? (hits.witness.lxx_note || '') : 'слой LXX не сопоставлен' }));
      pool.push(candidate('hFrameLiteral', 'hypothesis', ['gMethodology'], { object: object }));
    }

    // Ни один источник не отозвался: выдаём только рамку проверки.
    if (!hits.root && !hits.dict && !hits.witness) {
      pool.push(candidate('hFrameLiteral', 'hypothesis', ['gMethodology'], { object: object }));
      pool.push(candidate('hFrameFigurative', 'hypothesis', ['gMethodology', 'gLayers'], { object: object }));
    }

    // Ранжирование по силе оснований; записи без теста на опровержение не выдаются.
    return pool.filter(function(item) { return item.falsify; })
      .sort(function(a, b) { return b.strength - a.strength; })
      .slice(0, 4);
  }

  // ===== Состояние и рендер =====
  function setBadge(kind) {
    if (!dom.badge) return;
    var meta = {
      empty: { className: 'wb-badge', label: t('lab.hypothesisGenerator.badgeEmpty', 'Ожидание') },
      running: { className: 'wb-badge is-running', label: t('lab.hypothesisGenerator.badgeRunning', 'Сбор данных') },
      success: { className: 'wb-badge is-done', label: t('lab.hypothesisGenerator.badgeSuccess', 'Готово') },
      error: { className: 'wb-badge is-error', label: t('lab.hypothesisGenerator.badgeError', 'Ошибка') }
    }[kind];
    dom.badge.className = meta.className;
    dom.badge.textContent = meta.label;
  }

  function setStatus(message, kind) {
    if (!dom.status) return;
    dom.status.textContent = message || '';
    dom.status.className = 'lab-status' + (kind ? ' is-' + kind : '');
  }

  function emptyState(hint) {
    return '<div class="lab-empty">' +
      '<span class="lab-empty-glyph" aria-hidden="true">𐤈</span>' +
      '<p class="lab-empty-hint">' + esc(hint) + '</p></div>';
  }

  function skeleton() {
    return '<div class="lab-skeleton" aria-hidden="true">' +
      '<span class="lab-skeleton-line"></span><span class="lab-skeleton-line"></span><span class="lab-skeleton-line"></span>' +
      '</div>';
  }

  function renderSources() {
    if (!dom.sources) return;
    if (!state.loaded) {
      dom.sources.textContent = t('lab.hypothesisGenerator.sourcesRunning', 'Собираем данные источников…');
      return;
    }
    if (state.dataError) {
      dom.sources.textContent = t('lab.hypothesisGenerator.sourcesNone', 'Источники недоступны — работает только рамка проверки.');
      return;
    }
    if (!state.object.trim()) {
      dom.sources.textContent = t('lab.hypothesisGenerator.sourcesEmpty', 'Введите объект — источники подтянутся автоматически.');
      return;
    }
    dom.sources.textContent = fill(
      t('lab.hypothesisGenerator.sourcesLine', 'Источники: корни {root} · подмены {dict} · свидетели {witness} · слои {layers}.'),
      {
        root: state.hits.root ? '✓' : '—',
        dict: state.hits.dict ? state.hits.dict.title : '—',
        witness: state.hits.witness ? state.hits.witness.ref : '—',
        layers: '✓'
      });
  }

  function renderHypotheses() {
    if (!dom.hyp) return;
    if (!state.object.trim()) {
      dom.hyp.innerHTML = emptyState(t('lab.hypothesisGenerator.emptyHint', 'Введите объект: гипотезы и их опровержения соберутся сразу.'));
      return;
    }
    if (state.dataError) {
      dom.hyp.innerHTML = '<div class="lab-alert lab-alert-error" role="alert">' +
        esc(t('lab.hypothesisGenerator.errorData', 'Данные источников недоступны: гипотезы без оснований не выдаются.')) + '</div>';
      return;
    }
    if (!state.hypotheses.length) {
      dom.hyp.innerHTML = emptyState(t('lab.hypothesisGenerator.emptyHint', 'Введите объект: гипотезы и их опровержения соберутся сразу.'));
      return;
    }
    dom.hyp.innerHTML = state.hypotheses.map(function(item, index) {
      return '<article class="hg-card">' +
        '<div class="hg-card-head">' +
        '<span class="hg-rank">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<h3 class="hg-card-title">' + esc(item.title) + '</h3>' +
        '<span class="hg-badge' + (item.confidence === 'interpretation' ? ' is-interpretation' : '') + '">' +
        esc(t('lab.hypothesisGenerator.confidence' + cap(item.confidence), item.confidence)) + '</span>' +
        '</div>' +
        '<p class="hg-card-desc">' + esc(item.desc) + '</p>' +
        '<p class="hg-card-meta">' + esc(fill(t('lab.hypothesisGenerator.rankLabel', 'Сила оснований: {n}'), { n: item.strength })) + '</p>' +
        '<div class="hg-grounds">' + item.grounds.map(function(ground) {
          return '<span class="hg-ground">' + esc(ground) + '</span>';
        }).join('') + '</div>' +
        '<p class="hg-falsify"><span class="hg-falsify-label">' +
        esc(t('lab.hypothesisGenerator.falsifyLabel', 'Опровергается, если…')) + '</span> ' + esc(item.falsify) + '</p>' +
        '</article>';
    }).join('');
  }

  function renderSaved() {
    if (!dom.saved) return;
    if (!state.history.length) {
      dom.saved.innerHTML = emptyState(t('lab.hypothesisGenerator.savedEmpty', 'Сохранённых объектов пока нет.'));
      return;
    }
    dom.saved.innerHTML = state.history.map(function(item, index) {
      return '<div class="hg-saved-row">' +
        '<button type="button" class="hg-saved-open" data-hg-saved="' + index + '"' +
        ' title="' + esc(t('lab.hypothesisGenerator.savedReopen', 'Открыть')) + '">' + esc(item.object) + '</button>' +
        '<span class="hg-saved-meta">' + esc(typeLabel(item.type) + ' · ' + formatTime(item.createdAt)) + '</span>' +
        '<button type="button" class="hg-saved-remove" data-hg-saved-remove="' + index + '"' +
        ' aria-label="' + esc(t('lab.hypothesisGenerator.savedRemove', 'Удалить')) + '" title="' + esc(t('lab.hypothesisGenerator.savedRemove', 'Удалить')) + '">×</button>' +
        '</div>';
    }).join('');
  }

  // ===== Тип, время, история =====
  function typeLabel(type) {
    var fallbacks = { word: 'Слово', verse: 'Стих', root: 'Корень' };
    return t('lab.hypothesisGenerator.type' + cap(type), fallbacks[type] || type);
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      var locale = document.documentElement.lang === 'en' ? 'en-GB' : 'ru-RU';
      return new Date(ts).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  }

  function readHistory() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(function(item) {
        return item && typeof item.object === 'string' && TYPES.indexOf(item.type) !== -1;
      }).slice(0, HISTORY_LIMIT);
    } catch (error) {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
    } catch (error) {
      // localStorage может быть недоступен — история просто не сохранится.
    }
  }

  // Генерация фиксируется в истории сама: пара тип+объект уникальна.
  function remember() {
    if (state.object.trim().length < 2 || !state.hypotheses.length) return;
    var entry = { type: state.activeType, object: state.object.trim(), count: state.hypotheses.length, createdAt: Date.now() };
    state.history = state.history.filter(function(item) {
      return !(item.type === entry.type && item.object === entry.object);
    });
    state.history.unshift(entry);
    state.history = state.history.slice(0, HISTORY_LIMIT);
    saveHistory(state.history);
    renderSaved();
  }

  function updateActions() {
    var enabled = state.hypotheses.length > 0 && !state.dataError;
    Array.prototype.forEach.call(dom.actions || [], function(button) {
      button.disabled = !enabled;
    });
  }

  function syncTypeChips() {
    Array.prototype.forEach.call(document.querySelectorAll('.hg-type-chip'), function(chip) {
      var active = chip.getAttribute('data-hg-type') === state.activeType;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function update() {
    state.object = dom.object ? dom.object.value : '';
    state.hits = state.object.trim() && state.loaded ? lookup(state.object) : { root: null, dict: null, witness: null };
    state.hypotheses = (state.object.trim() && !state.dataError)
      ? buildHypotheses(state.activeType, state.object, state.hits)
      : [];
    renderSources();
    renderHypotheses();
    updateActions();
    if (state.dataError && state.object.trim()) setBadge('error');
    else if (!state.object.trim()) setBadge('empty');
    else if (state.hypotheses.length) setBadge('success');
    else setBadge('empty');
    remember();
  }

  function setType(type) {
    if (TYPES.indexOf(type) === -1) return;
    state.activeType = type;
    syncTypeChips();
    update();
  }

  function applyData(data) {
    if (dom.object) dom.object.value = data.object || '';
    state.activeType = TYPES.indexOf(data.type) !== -1 ? data.type : 'word';
    syncTypeChips();
    update();
  }

  // ===== Экспорт =====
  function toMarkdown() {
    var lines = ['# ' + t('lab.hypothesisGenerator.panelHypotheses', 'Гипотезы') + ': ' + state.object.trim(), '',
      typeLabel(state.activeType) + ' · ' + state.hypotheses.length, ''];
    state.hypotheses.forEach(function(item, index) {
      lines.push('## ' + (index + 1) + '. ' + item.title + ' (' + t('lab.hypothesisGenerator.confidence' + cap(item.confidence), item.confidence) + ')');
      lines.push('', item.desc, '',
        t('lab.hypothesisGenerator.groundsLabel', 'Основания') + ': ' + item.grounds.join('; '),
        t('lab.hypothesisGenerator.falsifyLabel', 'Опровергается, если…') + ' ' + item.falsify, '');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function copyMarkdown() {
    if (!state.hypotheses.length) return;
    var done = function() { setStatus(t('lab.hypothesisGenerator.copied', 'Markdown скопирован'), 'success'); };
    var failed = function() { setStatus(t('lab.hypothesisGenerator.copyFailed', 'Копирование недоступно'), 'error'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(toMarkdown()).then(done, failed);
    } else {
      failed();
    }
  }

  // Префил генератора досок: гипотезы становятся уликами доски.
  function sendToBoard() {
    if (!state.hypotheses.length) return;
    var grounds = [];
    state.hypotheses.forEach(function(item) {
      item.grounds.forEach(function(ground) {
        if (grounds.indexOf(ground) === -1) grounds.push(ground);
      });
    });
    var prefill = {
      title: 'Гипотезы: ' + state.object.trim(),
      conclusion: state.hypotheses[0].desc,
      evidence: state.hypotheses.map(function(item) { return item.title + ' — ' + item.desc; }),
      attachments: grounds
    };
    try {
      window.localStorage.setItem(BOARD_PREFILL_KEY, JSON.stringify(prefill));
    } catch (error) {
      setStatus(t('lab.hypothesisGenerator.copyFailed', 'Копирование недоступно'), 'error');
      return;
    }
    setStatus(t('lab.hypothesisGenerator.sentToBoard', 'Гипотезы переданы на доску'), 'success');
    if (window.LabRouter) window.LabRouter.navigate('board-generator');
  }

  // ===== События =====
  function bind(scope) {
    if (scope.dataset.hgBound === '1') return;
    scope.dataset.hgBound = '1';

    // Живая перерисовка: ввод перечитывает источники и гипотезы (debounce).
    var timer = null;
    scope.addEventListener('input', function(event) {
      if (!event.target || event.target.id !== 'hg-object') return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function() { timer = null; update(); }, 220);
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var typeChip = target.closest('[data-hg-type]');
      if (typeChip) { setType(typeChip.getAttribute('data-hg-type')); return; }

      var example = target.closest('[data-hg-example]');
      if (example) {
        if (dom.object) {
          dom.object.value = example.getAttribute('data-hg-example') || example.textContent.trim();
          dom.object.focus();
        }
        var exampleType = example.getAttribute('data-hg-example-type');
        if (exampleType && TYPES.indexOf(exampleType) !== -1) state.activeType = exampleType;
        syncTypeChips();
        update();
        return;
      }

      var savedOpen = target.closest('[data-hg-saved]');
      if (savedOpen) {
        var savedItem = state.history[Number(savedOpen.getAttribute('data-hg-saved'))];
        if (savedItem) {
          applyData(savedItem);
          setStatus(t('lab.hypothesisGenerator.savedOpened', 'Объект восстановлен'), 'success');
        }
        return;
      }
      var savedRemove = target.closest('[data-hg-saved-remove]');
      if (savedRemove) {
        state.history.splice(Number(savedRemove.getAttribute('data-hg-saved-remove')), 1);
        saveHistory(state.history);
        renderSaved();
        return;
      }

      var action = target.closest('[data-hg-action]');
      if (action) {
        var kind = action.getAttribute('data-hg-action');
        if (kind === 'copy') copyMarkdown();
        else if (kind === 'board') sendToBoard();
      }
    });
  }

  function collectDom(scope) {
    dom = {
      object: scope.querySelector('#hg-object'),
      sources: scope.querySelector('#hg-sources'),
      hyp: scope.querySelector('#hg-hyp'),
      badge: scope.querySelector('#hg-hyp-badge'),
      saved: scope.querySelector('#hg-saved'),
      status: scope.querySelector('#hg-status'),
      actions: scope.querySelectorAll('[data-hg-action]')
    };
  }

  function init(container) {
    var scope = container;
    if (!scope) return;
    fetchPage().then(function(html) {
      scope.innerHTML = html;
      // Разметка приходит после старта i18n — переводим её здесь.
      if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
        window.AlephyI18n.applyTranslations(scope);
      }
      collectDom(scope);
      bind(scope);
      state.history = readHistory();
      renderSaved();
      syncTypeChips();

      // Канон состояний: running → данные → результат / ошибка.
      setBadge('running');
      renderSources();
      if (dom.hyp) dom.hyp.innerHTML = skeleton();

      loadData().then(function() {
        update();
        if (state.dataError) {
          setStatus(t('lab.hypothesisGenerator.errorLoad', 'Источники недоступны — проверьте доступ к data/.'), 'error');
        }
      });
    }).catch(function(error) {
      scope.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.hypothesisGenerator.loadFailed', 'Не удалось загрузить генератор: ')) + esc(error.message) + '</div>';
    });
  }

  window.HypothesisGenerator = { init: init, render: init };
})(window, document);
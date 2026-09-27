/**
 * context-generator.js — «Генератор контекста»: bento-поле среды объекта
 * или события. Собирает контекстную карточку (время, место, слой передачи,
 * состояние, действие, свидетели, уровни) и отдаёт её Markdown.
 * Разметка: pages/context-generator.html; раскладка — css/context-generator.css;
 * канон панелей — css/components/panels.css.
 * Данные: data/timeline.json, data/cartography.json, data/roots/roots.json,
 * data/states.json, data/witnesses.json. Каждый источник с локальным fallback:
 * без данных модуль работает в ручном режиме, а не падает.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/context-generator.html';
  var STORAGE_KEY = 'alephy_context_history';
  var HISTORY_LIMIT = 5;
  var TYPES = ['word', 'verse', 'event'];

  // Слои передачи — Акт I Манифеста v12: фиксированный порядок, не данные.
  var LAYERS = [
    { id: 'stream', key: 'lab.contextGenerator.layerStream', label: 'Слитный поток' },
    { id: 'masoretic', key: 'lab.contextGenerator.layerMasoretic', label: 'Масоретская фиксация' },
    { id: 'lxx', key: 'lab.contextGenerator.layerLXX', label: 'Септуагинта' },
    { id: 'vulgate', key: 'lab.contextGenerator.layerVulgate', label: 'Вульгата' },
    { id: 'slavonic', key: 'lab.contextGenerator.layerSlavonic', label: 'Славянский и русский' }
  ];

  var TYPE_LABELS = {
    word: ['lab.contextGenerator.typeWord', 'Слово'],
    verse: ['lab.contextGenerator.typeVerse', 'Стих'],
    event: ['lab.contextGenerator.typeEvent', 'Событие']
  };

  var pagePromise = null;
  var dom = {};
  var store = { timeline: null, cartography: null, roots: null, states: null, witnesses: null };
  var history = [];
  var state = {
    type: 'word',
    object: '',
    time: '',
    timeAuto: false,
    timeSource: '',
    place: '',
    placeAuto: false,
    placeSource: '',
    layers: [],
    stateId: '',
    stateSource: '',
    action: '',
    witnesses: [],
    levels: { fact: '', interp: '', hyp: '' },
    hits: { time: [], place: [], root: null, witness: [] },
    loaded: false,
    dataError: false
  };

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function normalize(value) {
    return String(value == null ? '' : value).toLocaleLowerCase('ru-RU')
      .replace(/[«»"'()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Токены: кириллица, латиница и иврит (поиск по корням и еврейским именам).
  function tokens(value) {
    return normalize(value).split(/[^0-9a-zа-яё\u0590-\u05FF]+/)
      .filter(function(word) { return word.length > 2; });
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
      loadJson('data/timeline.json').catch(function() { return null; }),
      loadJson('data/cartography.json').catch(function() { return null; }),
      loadJson('data/roots/roots.json').catch(function() { return null; }),
      loadJson('data/states.json').catch(function() { return null; }),
      loadJson('data/witnesses.json').catch(function() { return null; })
    ]).then(function(results) {
      store.timeline = Array.isArray(results[0]) ? results[0] : null;
      store.cartography = results[1] && Array.isArray(results[1].entries) ? results[1].entries : null;
      store.roots = Array.isArray(results[2]) ? results[2] : null;
      store.states = results[3] && Array.isArray(results[3].states) ? results[3].states : null;
      store.witnesses = Array.isArray(results[4]) ? results[4] : null;
      state.dataError = !store.timeline && !store.cartography && !store.roots &&
        !store.states && !store.witnesses;
      state.loaded = true;
    });
  }

  // ===== Поиск по источникам =====
  function findTime(query) {
    if (!store.timeline) return [];
    var words = tokens(query);
    if (!words.length) return [];
    var rows = [];
    store.timeline.forEach(function(tape) {
      if (!tape || !Array.isArray(tape.events)) return;
      tape.events.forEach(function(ev) {
        if (!ev) return;
        var haystack = normalize([ev.title, ev.description, tape.title].join(' '));
        var score = words.filter(function(word) { return haystack.indexOf(word) !== -1; }).length;
        if (!score) return;
        rows.push({ score: score, date: ev.date || '', title: ev.title || '', tape: tape.title || tape.id || '' });
      });
    });
    rows.sort(function(a, b) { return b.score - a.score; });
    return rows.slice(0, 3);
  }

  function findPlace(query) {
    if (!store.cartography) return [];
    var q = normalize(query);
    if (q.length < 3) return [];
    return store.cartography.filter(function(entry) {
      if (!entry) return false;
      var name = normalize(entry.name);
      if (name.length > 2 && (q.indexOf(name) !== -1 || name.indexOf(q) !== -1)) return true;
      return !!entry.hebrew && String(query).indexOf(entry.hebrew) !== -1;
    }).slice(0, 4);
  }

  function findRoot(query) {
    if (!store.roots) return null;
    var raw = String(query == null ? '' : query).trim();
    if (raw.length < 2) return null;
    var exact = raw.replace(/\s+/g, '');
    var hit = null;
    store.roots.some(function(item) {
      if (!item) return false;
      var match = (item.root && String(item.root).replace(/\s+/g, '') === exact) ||
        (item.translit && normalize(item.translit) === normalize(raw)) ||
        (item.paleo && item.paleo.join('') === exact);
      if (match) hit = item;
      return match;
    });
    if (hit) return hit;
    var words = tokens(raw);
    if (!words.length) return null;
    var best = null;
    var bestScore = 0;
    store.roots.forEach(function(item) {
      if (!item) return;
      var hay = normalize([item.translit, item.root, item.meaning, item.image].join(' '));
      var score = words.filter(function(word) { return hay.indexOf(word) !== -1; }).length;
      if (score > bestScore) { bestScore = score; best = item; }
    });
    return best;
  }

  function findWitness(query) {
    if (!store.witnesses) return [];
    var words = tokens(query);
    if (!words.length) return [];
    return store.witnesses.filter(function(item) {
      if (!item) return false;
      var hay = normalize([item.ref, item.topic, item.note].join(' '));
      return words.some(function(word) { return hay.indexOf(word) !== -1; });
    }).slice(0, 3);
  }

  // ===== Справочники состояния =====
  function stateById(id) {
    if (!id || !store.states) return null;
    return store.states.filter(function(item) { return item && item.id === id; })[0] || null;
  }

  function witnessById(id) {
    if (!id || !store.witnesses) return null;
    return store.witnesses.filter(function(item) { return item && item.id === id; })[0] || null;
  }

  // ===== Рендер: статус источников и подсказок =====
  function renderSources() {
    if (!dom.sources) return;
    if (!state.loaded) { dom.sources.textContent = ''; return; }
    var loaded = ['timeline', 'cartography', 'roots', 'states', 'witnesses']
      .filter(function(key) { return !!store[key]; }).length;
    dom.sources.textContent = loaded
      ? t('lab.contextGenerator.sourcesSome', 'Источники: {n}/5').replace('{n}', String(loaded))
      : t('lab.contextGenerator.sourcesNone', 'Источники недоступны — ручной режим');
  }

  function renderTimeHits() {
    if (!dom.timeHits) return;
    dom.timeHits.innerHTML = state.hits.time.map(function(hit, index) {
      var value = hit.date || hit.title;
      var active = normalize(state.time) === normalize(value);
      return '<button type="button" class="lab-example-chip cx-chip cx-hit' + (active ? ' is-active' : '') + '"' +
        ' data-cx-time-hit="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '"' +
        ' title="' + esc(hit.title + (hit.tape ? ' · ' + hit.tape : '')) + '">' + esc(value) + '</button>';
    }).join('');
    renderTimeMeta();
  }

  function renderTimeMeta() {
    if (!dom.timeMeta) return;
    if (state.timeSource) {
      dom.timeMeta.textContent = t('lab.contextGenerator.fromTimeline', 'из таймлайна') + ': ' + state.timeSource;
    } else if (state.object.trim() && state.loaded && store.timeline && !state.hits.time.length) {
      dom.timeMeta.textContent = t('lab.contextGenerator.timeEmpty', 'Совпадений нет — впишите вручную');
    } else {
      dom.timeMeta.textContent = '';
    }
  }

  function renderPlaceHits() {
    if (!dom.placeHits) return;
    dom.placeHits.innerHTML = state.hits.place.map(function(entry, index) {
      var active = normalize(state.place) === normalize(entry.name);
      return '<button type="button" class="lab-example-chip cx-chip cx-hit' + (active ? ' is-active' : '') + '"' +
        ' data-cx-place-hit="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '"' +
        ' title="' + esc(entry.summary || entry.region || '') + '">' + esc(entry.name) + '</button>';
    }).join('');
    renderPlaceMeta();
  }

  function renderPlaceMeta() {
    if (!dom.placeMeta) return;
    if (state.placeSource) {
      dom.placeMeta.textContent = state.placeSource;
    } else if (state.object.trim() && state.loaded && store.cartography && !state.hits.place.length) {
      dom.placeMeta.textContent = t('lab.contextGenerator.placeEmpty', 'Совпадений нет — впишите вручную');
    } else {
      dom.placeMeta.textContent = '';
    }
  }

  function renderStateChips() {
    if (!dom.states) return;
    if (!store.states) {
      dom.states.innerHTML = state.loaded
        ? '<span class="cx-meta">' + esc(t('lab.contextGenerator.stateNoData', 'Карта состояний недоступна — заполните карточку без состояния.')) + '</span>'
        : '';
      renderStateHint();
      return;
    }
    dom.states.innerHTML = store.states.map(function(item) {
      var active = state.stateId === item.id;
      return '<button type="button" class="lab-example-chip cx-chip' + (active ? ' is-active' : '') + '"' +
        ' data-cx-state="' + esc(item.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '"' +
        ' title="' + esc(item.physics || '') + '">' + esc(item.name) + '</button>';
    }).join('');
    renderStateHint();
  }

  function renderStateHint() {
    if (!dom.stateHint) return;
    var item = stateById(state.stateId);
    if (!item) {
      dom.stateHint.textContent = t('lab.contextGenerator.stateHintEmpty', 'Физика состояния появится здесь.');
      return;
    }
    var prefix = state.stateSource === 'place'
      ? t('lab.contextGenerator.fromPlace', 'из места') + ': ' : '';
    dom.stateHint.textContent = prefix + (item.physics || item.name || '');
  }

  function renderRootHit() {
    if (!dom.root) return;
    var root = state.hits.root;
    if (!root) { dom.root.innerHTML = ''; return; }
    var label = [root.translit || root.root, root.image || root.meaning]
      .filter(Boolean).join(' · ');
    dom.root.innerHTML = '<button type="button" class="lab-example-chip cx-chip cx-hit"' +
      ' data-cx-root-hit="1" aria-pressed="false" title="' + esc(root.meaning || '') + '">' +
      esc(label) + '</button>';
  }

  function renderWitnessHits() {
    if (!dom.witnessHits) return;
    var rows = state.hits.witness.slice();
    state.witnesses.forEach(function(id) {
      var known = rows.some(function(item) { return item.id === id; });
      if (!known) {
        var item = witnessById(id);
        if (item) rows.push(item);
      }
    });
    dom.witnessHits.innerHTML = rows.map(function(item) {
      var active = state.witnesses.indexOf(item.id) !== -1;
      return '<button type="button" class="lab-example-chip cx-chip cx-hit' + (active ? ' is-active' : '') + '"' +
        ' data-cx-witness="' + esc(item.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '"' +
        ' title="' + esc(item.topic || item.note || '') + '">' + esc(item.ref || item.id) + '</button>';
    }).join('');
    if (dom.witnessCount) dom.witnessCount.textContent = String(state.witnesses.length);
    if (dom.witnessMeta) {
      dom.witnessMeta.textContent = (!rows.length && state.object.trim() && state.loaded && store.witnesses)
        ? t('lab.contextGenerator.witnessEmpty', 'Совпадений нет') : '';
    }
  }

  // ===== Обогащение: подсказки + автоподстановка в пустые поля =====
  function enrich() {
    var query = state.object;
    state.hits.time = findTime(query);
    state.hits.place = findPlace(query);
    state.hits.root = findRoot(query);
    state.hits.witness = findWitness(query);

    // Автоподстановка работает, только пока поле пустое или заполнено автоматом.
    if (state.timeAuto || !state.time) {
      var timeHit = state.hits.time[0];
      state.time = timeHit ? (timeHit.date || timeHit.title || '') : '';
      state.timeAuto = !!timeHit;
      state.timeSource = timeHit ? timeHit.tape : '';
      if (dom.time) dom.time.value = state.time;
    }
    if (state.placeAuto || !state.place) {
      var placeHit = state.hits.place[0];
      state.place = placeHit ? (placeHit.name || '') : '';
      state.placeAuto = !!placeHit;
      state.placeSource = placeHit
        ? [placeHit.region, placeHit.meaning].filter(Boolean).join(' · ') : '';
      if (dom.place) dom.place.value = state.place;
      if (state.stateSource === 'place' || !state.stateId) {
        state.stateId = placeHit && placeHit.state ? placeHit.state : '';
        state.stateSource = placeHit && placeHit.state ? 'place' : '';
      }
    }

    renderTimeHits();
    renderPlaceHits();
    renderStateChips();
    renderRootHit();
    renderWitnessHits();
  }

  // ===== Контекстная карточка: поля, предпросмотр, бейджи =====
  function layerLabels() {
    return LAYERS.filter(function(layer) { return state.layers.indexOf(layer.id) !== -1; })
      .map(function(layer) { return t(layer.key, layer.label); });
  }

  function typeLabel() {
    var pair = TYPE_LABELS[state.type] || TYPE_LABELS.word;
    return t(pair[0], pair[1]);
  }

  function fieldRows() {
    var rows = [{ label: t('lab.contextGenerator.typeLabel', 'Тип'), value: typeLabel() }];
    if (state.time) {
      rows.push({ label: t('lab.contextGenerator.panelTime', 'Время'),
        value: state.time + (state.timeSource ? ' · ' + state.timeSource : '') });
    }
    if (state.place) {
      rows.push({ label: t('lab.contextGenerator.panelPlace', 'Место'), value: state.place });
    }
    if (state.layers.length) {
      rows.push({ label: t('lab.contextGenerator.panelLayer', 'Слой передачи'), value: layerLabels().join(', ') });
    }
    var item = stateById(state.stateId);
    if (item) {
      rows.push({ label: t('lab.contextGenerator.panelState', 'Состояние'), value: item.name });
    }
    if (state.action) {
      rows.push({ label: t('lab.contextGenerator.panelAction', 'Действие / образ'), value: state.action });
    }
    return rows;
  }

  function witnessRows() {
    return state.witnesses.map(witnessById).filter(Boolean).map(function(item) {
      return { ref: item.ref || item.id, topic: item.topic || item.note || '' };
    });
  }

  function levelRows() {
    var rows = [];
    if (state.levels.fact) {
      rows.push({ label: t('lab.contextGenerator.levelFact', 'Факт'), value: state.levels.fact });
    }
    if (state.levels.interp) {
      rows.push({ label: t('lab.contextGenerator.levelInterp', 'Интерпретация'), value: state.levels.interp });
    }
    if (state.levels.hyp) {
      rows.push({ label: t('lab.contextGenerator.levelHyp', 'Гипотеза'), value: state.levels.hyp });
    }
    return rows;
  }

  function rowHtml(row) {
    return '<div class="cx-doc-row"><dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd></div>';
  }

  function setBadges(ready) {
    if (dom.badge) {
      dom.badge.textContent = ready
        ? t('lab.contextGenerator.badgeFilled', 'Заполнено')
        : t('lab.contextGenerator.badgeIdle', 'Ожидание');
      dom.badge.classList.toggle('is-done', ready);
    }
    if (dom.outBadge) {
      dom.outBadge.textContent = ready
        ? t('lab.contextGenerator.badgeReady', 'Готово')
        : t('lab.contextGenerator.badgeDraft', 'Черновик');
      dom.outBadge.classList.toggle('is-done', ready);
    }
  }

  function updateActions(enabled) {
    Array.prototype.forEach.call(dom.actions || [], function(button) {
      button.disabled = !enabled;
    });
  }

  function emptyState(hint) {
    return '<div class="lab-empty">' +
      '<span class="lab-empty-glyph" aria-hidden="true">𐤗</span>' +
      '<p class="lab-empty-hint">' + esc(hint) + '</p></div>';
  }

  function setStatus(message, type) {
    if (!dom.status) return;
    dom.status.textContent = message || '';
    dom.status.classList.toggle('is-error', type === 'error');
    dom.status.classList.toggle('is-success', type === 'success');
  }

  function renderPreview() {
    if (!dom.preview) return;
    var object = state.object.trim();
    var ready = !!object;
    updateActions(ready);
    setBadges(ready);
    if (!ready) {
      dom.preview.innerHTML = emptyState(t('lab.contextGenerator.cardEmpty', 'Заполните объект — карточка соберётся сама.'));
      return;
    }
    var html = '<article class="cx-doc">' +
      '<h3 class="cx-doc-title">' + esc(object) + '</h3>' +
      '<dl class="cx-doc-rows">' + fieldRows().map(rowHtml).join('') + '</dl>';
    var witnesses = witnessRows();
    if (witnesses.length) {
      html += '<p class="cx-doc-sub">' + esc(t('lab.contextGenerator.panelWitness', 'Свидетели')) + '</p>' +
        '<ul class="cx-doc-list">' + witnesses.map(function(row) {
          return '<li>' + esc(row.ref) + (row.topic ? ' — ' + esc(row.topic) : '') + '</li>';
        }).join('') + '</ul>';
    }
    var levels = levelRows();
    if (levels.length) {
      html += '<p class="cx-doc-sub">' + esc(t('lab.contextGenerator.panelLevels', 'Уровни утверждений')) + '</p>' +
        '<dl class="cx-doc-rows">' + levels.map(rowHtml).join('') + '</dl>';
    }
    html += '</article>';
    dom.preview.innerHTML = html;
  }

  // ===== История: 5 последних карточек =====
  function readHistory() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(function(item) {
        return item && typeof item.object === 'string' && item.object;
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

  function snapshot() {
    return {
      object: state.object.trim(),
      type: state.type,
      time: state.time,
      place: state.place,
      layers: state.layers.slice(),
      stateId: state.stateId,
      action: state.action,
      witnesses: state.witnesses.slice(),
      levels: { fact: state.levels.fact, interp: state.levels.interp, hyp: state.levels.hyp },
      createdAt: Date.now()
    };
  }

  function remember() {
    var entry = snapshot();
    history = history.filter(function(item) { return item.object !== entry.object; });
    history.unshift(entry);
    history = history.slice(0, HISTORY_LIMIT);
    saveHistory(history);
    renderSaved();
  }

  function renderSaved() {
    if (!dom.saved) return;
    if (!history.length) {
      dom.saved.innerHTML = emptyState(t('lab.contextGenerator.savedEmpty', 'Сохранённых карточек пока нет.'));
      return;
    }
    dom.saved.innerHTML = history.map(function(item, index) {
      var meta = [item.time, item.place].filter(Boolean).join(' · ');
      return '<div class="cx-saved-row">' +
        '<button type="button" class="cx-saved-open" data-cx-saved="' + index + '"' +
        ' title="' + esc(t('lab.contextGenerator.savedOpen', 'Открыть')) + '">' + esc(item.object) + '</button>' +
        '<span class="cx-saved-meta">' + esc(meta || formatTime(item.createdAt)) + '</span>' +
        '<button type="button" class="cx-saved-remove" data-cx-saved-remove="' + index + '"' +
        ' aria-label="' + esc(t('lab.contextGenerator.savedRemove', 'Удалить')) + '"' +
        ' title="' + esc(t('lab.contextGenerator.savedRemove', 'Удалить')) + '">×</button>' +
        '</div>';
    }).join('');
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

  function applyData(item) {
    if (!item) return;
    state.type = TYPES.indexOf(item.type) !== -1 ? item.type : 'word';
    state.object = item.object || '';
    state.time = item.time || '';
    state.timeAuto = false;
    state.timeSource = '';
    state.place = item.place || '';
    state.placeAuto = false;
    state.placeSource = '';
    state.layers = Array.isArray(item.layers) ? item.layers.slice() : [];
    state.stateId = item.stateId || '';
    state.stateSource = item.stateId ? 'manual' : '';
    state.action = item.action || '';
    state.witnesses = Array.isArray(item.witnesses) ? item.witnesses.slice() : [];
    state.levels = {
      fact: item.levels && item.levels.fact ? item.levels.fact : '',
      interp: item.levels && item.levels.interp ? item.levels.interp : '',
      hyp: item.levels && item.levels.hyp ? item.levels.hyp : ''
    };
    syncInputs();
    syncChips();
    enrich();
    renderPreview();
  }

  function syncInputs() {
    if (dom.object) dom.object.value = state.object;
    if (dom.time) dom.time.value = state.time;
    if (dom.place) dom.place.value = state.place;
    if (dom.action) dom.action.value = state.action;
    if (dom.levelFact) dom.levelFact.value = state.levels.fact;
    if (dom.levelInterp) dom.levelInterp.value = state.levels.interp;
    if (dom.levelHyp) dom.levelHyp.value = state.levels.hyp;
  }

  // ===== Экспорт: Markdown-карточка =====
  function asMarkdown() {
    var lines = ['# ' + t('lab.contextGenerator.mdTitle', 'Контекст') + ': ' + state.object.trim(), ''];
    fieldRows().forEach(function(row) {
      lines.push('- **' + row.label + ':** ' + row.value);
    });
    var witnesses = witnessRows();
    if (witnesses.length) {
      lines.push('', '## ' + t('lab.contextGenerator.panelWitness', 'Свидетели'));
      witnesses.forEach(function(row) {
        lines.push('- ' + row.ref + (row.topic ? ' — ' + row.topic : ''));
      });
    }
    var levels = levelRows();
    if (levels.length) {
      lines.push('', '## ' + t('lab.contextGenerator.panelLevels', 'Уровни утверждений'));
      levels.forEach(function(row) {
        lines.push('- **' + row.label + ':** ' + row.value);
      });
    }
    lines.push('', '---', t('lab.contextGenerator.mdFooter', 'Собрано в ALEPHY · Генератор контекста'));
    return lines.join('\n');
  }

  function copyMarkdown() {
    if (!state.object.trim()) return;
    var done = function() { setStatus(t('lab.contextGenerator.copied', 'Markdown скопирован'), 'success'); };
    var failed = function() { setStatus(t('lab.contextGenerator.copyFailed', 'Копирование недоступно'), 'error'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(asMarkdown()).then(done, failed);
    } else {
      failed();
    }
  }

  function downloadMarkdown() {
    if (!state.object.trim()) return;
    var url = URL.createObjectURL(new Blob([asMarkdown()], { type: 'text/markdown;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'context-' + new Date().toISOString().slice(0, 10) + '.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  function sendToPrompt() {
    if (!state.object.trim()) return;
    if (window.LabRouter) window.LabRouter.navigate('prompt-generator');
    var attempt = 0;
    function tryAdd() {
      if (window.PromptGenerator && typeof window.PromptGenerator.addExternalBlock === 'function') {
        window.PromptGenerator.addExternalBlock(
          t('lab.contextGenerator.promptTitle', 'Контекст: ') + state.object.trim(), asMarkdown());
        setStatus(t('lab.contextGenerator.promptAdded', 'Добавлено в конструктор промптов'), 'success');
        return;
      }
      if (attempt++ < 10) {
        window.setTimeout(tryAdd, 120);
      } else {
        setStatus(t('lab.contextGenerator.promptFailed', 'Конструктор промптов недоступен'), 'error');
      }
    }
    window.setTimeout(tryAdd, 120);
  }

  function saveCard() {
    if (!state.object.trim()) return;
    remember();
    setStatus(t('lab.contextGenerator.saved', 'Карточка сохранена'), 'success');
  }

  // ===== Выбор значений =====
  function onObjectInput() {
    state.object = dom.object ? dom.object.value : '';
    enrich();
    renderPreview();
  }

  function setType(type) {
    if (TYPES.indexOf(type) === -1) return;
    state.type = type;
    syncChips();
    renderPreview();
  }

  function toggleLayer(id) {
    var index = state.layers.indexOf(id);
    if (index === -1) state.layers.push(id);
    else state.layers.splice(index, 1);
    syncChips();
    renderPreview();
  }

  function setStateId(id) {
    if (state.stateId === id) {
      state.stateId = '';
      state.stateSource = '';
    } else {
      state.stateId = id;
      state.stateSource = 'manual';
    }
    renderStateChips();
    renderPreview();
  }

  function pickTime(index) {
    var hit = state.hits.time[index];
    if (!hit) return;
    state.time = hit.date || hit.title || '';
    state.timeAuto = false;
    state.timeSource = hit.tape || '';
    if (dom.time) dom.time.value = state.time;
    renderTimeHits();
    renderPreview();
  }

  function pickPlace(index) {
    var hit = state.hits.place[index];
    if (!hit) return;
    state.place = hit.name || '';
    state.placeAuto = false;
    state.placeSource = [hit.region, hit.meaning].filter(Boolean).join(' · ');
    if (dom.place) dom.place.value = state.place;
    if (state.stateSource === 'place' || !state.stateId) {
      state.stateId = hit.state || '';
      state.stateSource = hit.state ? 'place' : '';
    }
    renderPlaceHits();
    renderStateChips();
    renderPreview();
  }

  function applyRoot() {
    var root = state.hits.root;
    if (!root) return;
    state.action = root.image || root.meaning || '';
    if (dom.action) dom.action.value = state.action;
    renderPreview();
  }

  function toggleWitness(id) {
    var index = state.witnesses.indexOf(id);
    if (index === -1) state.witnesses.push(id);
    else state.witnesses.splice(index, 1);
    renderWitnessHits();
    renderPreview();
  }

  function syncChips() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cx-type]'), function(chip) {
      var active = chip.getAttribute('data-cx-type') === state.type;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-cx-layer]'), function(chip) {
      var active = state.layers.indexOf(chip.getAttribute('data-cx-layer')) !== -1;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  // ===== События =====
  function bind(scope) {
    if (scope.dataset.cxBound === '1') return;
    scope.dataset.cxBound = '1';

    var timer = null;
    scope.addEventListener('input', function(event) {
      var target = event.target;
      if (!target) return;
      if (target.id === 'cx-object') {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(function() { timer = null; onObjectInput(); }, 220);
        return;
      }
      if (target.id === 'cx-time') {
        state.time = target.value;
        state.timeAuto = false;
        state.timeSource = '';
        renderTimeHits();
        renderPreview();
        return;
      }
      if (target.id === 'cx-place') {
        state.place = target.value;
        state.placeAuto = false;
        state.placeSource = '';
        renderPlaceHits();
        renderPreview();
        return;
      }
      if (target.id === 'cx-action') {
        state.action = target.value;
        renderPreview();
        return;
      }
      if (target.id === 'cx-level-fact') { state.levels.fact = target.value; renderPreview(); return; }
      if (target.id === 'cx-level-interp') { state.levels.interp = target.value; renderPreview(); return; }
      if (target.id === 'cx-level-hyp') { state.levels.hyp = target.value; renderPreview(); return; }
    });

    scope.addEventListener('submit', function(event) { event.preventDefault(); });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var typeChip = target.closest('[data-cx-type]');
      if (typeChip) { setType(typeChip.getAttribute('data-cx-type')); return; }

      var example = target.closest('[data-cx-example]');
      if (example) {
        if (dom.object) {
          dom.object.value = example.getAttribute('data-cx-example') || '';
          dom.object.focus();
        }
        var exampleType = example.getAttribute('data-cx-example-type');
        if (exampleType && TYPES.indexOf(exampleType) !== -1) state.type = exampleType;
        syncChips();
        onObjectInput();
        return;
      }

      var layerChip = target.closest('[data-cx-layer]');
      if (layerChip) { toggleLayer(layerChip.getAttribute('data-cx-layer')); return; }

      var stateChip = target.closest('[data-cx-state]');
      if (stateChip) { setStateId(stateChip.getAttribute('data-cx-state')); return; }

      var timeHit = target.closest('[data-cx-time-hit]');
      if (timeHit) { pickTime(Number(timeHit.getAttribute('data-cx-time-hit'))); return; }

      var placeHit = target.closest('[data-cx-place-hit]');
      if (placeHit) { pickPlace(Number(placeHit.getAttribute('data-cx-place-hit'))); return; }

      if (target.closest('[data-cx-root-hit]')) { applyRoot(); return; }

      var witnessChip = target.closest('[data-cx-witness]');
      if (witnessChip) { toggleWitness(witnessChip.getAttribute('data-cx-witness')); return; }

      var action = target.closest('[data-cx-action]');
      if (action) {
        var kind = action.getAttribute('data-cx-action');
        if (kind === 'copy') copyMarkdown();
        else if (kind === 'md') downloadMarkdown();
        else if (kind === 'prompt') sendToPrompt();
        else if (kind === 'save') saveCard();
        return;
      }

      var savedOpen = target.closest('[data-cx-saved]');
      if (savedOpen) {
        applyData(history[Number(savedOpen.getAttribute('data-cx-saved'))]);
        setStatus(t('lab.contextGenerator.cardOpened', 'Карточка восстановлена'), 'success');
        return;
      }
      var savedRemove = target.closest('[data-cx-saved-remove]');
      if (savedRemove) {
        history.splice(Number(savedRemove.getAttribute('data-cx-saved-remove')), 1);
        saveHistory(history);
        renderSaved();
      }
    });
  }

  function collectDom(scope) {
    dom = {
      object: scope.querySelector('#cx-object'),
      time: scope.querySelector('#cx-time'),
      place: scope.querySelector('#cx-place'),
      action: scope.querySelector('#cx-action'),
      levelFact: scope.querySelector('#cx-level-fact'),
      levelInterp: scope.querySelector('#cx-level-interp'),
      levelHyp: scope.querySelector('#cx-level-hyp'),
      sources: scope.querySelector('#cx-sources'),
      timeHits: scope.querySelector('#cx-time-hits'),
      timeMeta: scope.querySelector('#cx-time-meta'),
      placeHits: scope.querySelector('#cx-place-hits'),
      placeMeta: scope.querySelector('#cx-place-meta'),
      states: scope.querySelector('#cx-states'),
      stateHint: scope.querySelector('#cx-state-hint'),
      root: scope.querySelector('#cx-root'),
      witnessHits: scope.querySelector('#cx-witness-hits'),
      witnessCount: scope.querySelector('#cx-witness-count'),
      witnessMeta: scope.querySelector('#cx-witness-meta'),
      badge: scope.querySelector('#cx-badge'),
      outBadge: scope.querySelector('#cx-out-badge'),
      preview: scope.querySelector('#cx-preview'),
      status: scope.querySelector('#cx-status'),
      saved: scope.querySelector('#cx-saved'),
      actions: scope.querySelectorAll('[data-cx-action]')
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
      history = readHistory();
      renderSaved();
      renderStateChips();
      renderPreview();
      renderSources();

      // Канон состояний: данные → подсказки → карточка / ошибка источников.
      loadData().then(function() {
        renderSources();
        renderStateChips();
        enrich();
        renderPreview();
        if (state.dataError) {
          setStatus(t('lab.contextGenerator.errorData', 'Источники недоступны — ручной режим.'), 'error');
        }
      });
    }).catch(function(error) {
      scope.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.contextGenerator.loadFailed', 'Не удалось загрузить генератор: ')) + esc(error.message) + '</div>';
    });
  }

  window.ContextGenerator = { init: init, render: init };
})(window, document);

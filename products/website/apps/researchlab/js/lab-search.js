/* lab-search.js — быстрый глобальный индекс Research Lab. */
(function (global) {
  'use strict';

  var MAX_RESULTS = 30;
  var DATA_URLS = {
    roots: 'data/roots/roots.json',
    rootLinks: 'data/roots/root-links.json',
    dictionaries: 'data/dictionaries.json',
    methodology: 'data/methodology/cards.json',
    scripture: 'data/qumran-books.json'
  };
  var state = { items: [], loaded: false, loading: null, roots: [], rootLinks: [] };
  var MODULES = [
    ['dashboard', 'Рабочий стол', 'Лаборатория'], ['manifest', 'Манифест', 'Система'],
    ['root-dictionary', 'Корневой словарь', 'Словари'], ['dictionaries', 'Словари', 'Словари'],
    ['word-analyzer', 'Разбор слова', 'Анализ'], ['methodology', 'Методология', 'Методология'],
    ['researches', 'Исследования', 'Исследования'], ['learn', 'Обучение', 'Обучение'],
    ['scripture-reader', 'Книгочтение', 'Книгочтение'], ['cartography', 'Картография', 'Данные'],
    ['religionisms', 'Религионизмы', 'Анализ'],
    ['pipelines', 'Конвейеры', 'Рабочая область'], ['workbench', 'Мастерская', 'Рабочая область'],
    ['board', 'Доска', 'Рабочая область'], ['ai-agents', 'AI-агенты', 'Система'],
    ['prompt-generator', 'Генератор промптов', 'Инструменты'], ['clue-generator', 'Генератор улик', 'Инструменты'],
    ['hypothesis-generator', 'Генератор гипотез', 'Инструменты'], ['timescale-generator', 'Генератор шкалы времени', 'Инструменты'],
    ['paleo-keyboard', 'Палео-клавиатура', 'Инструменты'], ['timeline', 'Временная шкала', 'Данные'],
    ['language-map', 'Карта языков', 'Данные'], ['states', 'Состояния', 'Данные'],
    ['video-lab', 'Видео-лаборатория', 'Инструменты'], ['admin-settings', 'Настройки', 'Система']
  ];

  function normalize(value) {
    return String(value == null ? '' : value).toLocaleLowerCase('ru-RU')
      .replace(/[ё]/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function add(list, type, title, snippet, route, source, keywords, params) {
    list.push({ type: type, title: String(title || ''), snippet: String(snippet || title || ''),
      route: route, source: source, keywords: normalize(keywords || ''), params: params || null });
  }

  function rootId(value) {
    return normalize(value).toUpperCase();
  }

  function addRootLinkItems() {
    var rootsById = {};
    state.roots.forEach(function (root) {
      if (root && root.translit) rootsById[rootId(root.translit)] = root;
    });
    var seen = {};
    state.rootLinks.forEach(function (link) {
      if (!link || !link.from || !link.to) return;
      var from = rootId(link.from), to = rootId(link.to);
      var type = normalize(link.type || 'relation');
      var key = from + '|' + to + '|' + type;
      if (seen[key]) return;
      seen[key] = true;
      var fromRoot = rootsById[from], toRoot = rootsById[to];
      var fromDescription = fromRoot ? (fromRoot.meaning || fromRoot.image || '') : '';
      var toDescription = toRoot ? (toRoot.meaning || toRoot.image || '') : '';
      var details = [link.type, link.source, link.confidence, link.note,
        fromDescription, toDescription].filter(Boolean).join(' ');
      add(state.items, 'root-link', from + ' ↔ ' + to, link.note || details,
        'root-dictionary/graph/' + encodeURIComponent(from), 'Связи',
        [from, to, 'связи', details].join(' '));
    });
  }

  function moduleItems() {
    return MODULES.map(function (m) {
      return { type: 'module', title: m[1], snippet: m[1], route: m[0], source: m[2], keywords: normalize(m[0] + ' ' + m[2]) };
    });
  }

  function readJson(url) {
    if (typeof global.fetch !== 'function') return Promise.reject(new Error('fetch unavailable: ' + url));
    return global.fetch(url).then(function (response) {
      if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
      return response.json();
    });
  }

  function load() {
    if (state.loaded) return Promise.resolve(state.items);
    if (state.loading) return state.loading;
    state.items = moduleItems();
    state.loading = Promise.all(Object.keys(DATA_URLS).map(function (key) {
      return readJson(DATA_URLS[key]).then(function (data) {
        if (key === 'roots' && Array.isArray(data)) data.forEach(function (r) {
          state.roots.push(r);
          add(state.items, 'root', r.root, r.meaning, 'root-dictionary', 'Корни', r.root + ' ' + r.translit + ' ' + r.meaning);
        });
        if (key === 'rootLinks' && Array.isArray(data)) state.rootLinks = data;
        if (key === 'methodology' && Array.isArray(data)) data.forEach(function (c, index) {
          add(state.items, 'methodology', c.title, c.text, 'methodology', 'Методология', c.title + ' ' + c.text, { card: c.id || String(index) });
        });
        if (key === 'scripture' && data && Array.isArray(data.books)) data.books.forEach(function (b) {
          add(state.items, 'book', b.ru, b.paleo, 'scripture-reader', 'Книгочтение', b.id + ' ' + b.ru + ' ' + b.paleo, { book: b.id });
        });
        if (key === 'dictionaries' && data) Object.keys(data).forEach(function (dictId) {
          var dict = data[dictId];
          if (!dict || typeof dict !== 'object') return;
          add(state.items, 'dictionary', dict.title || dictId, dict.description, 'dictionaries/' + encodeURIComponent(dictId), 'Словари', dictId + ' ' + dict.title + ' ' + dict.description);
          (dict.terms || []).forEach(function (term) {
            add(state.items, 'term', term.word || term.hebrew, term.restored || term.word, 'dictionaries/' + encodeURIComponent(dictId), 'Словари', dictId + ' ' + JSON.stringify(term));
          });
        });
      }).catch(function (error) { console.warn('[LabSearch] fallback:', error.message); });
    })).then(function () {
      addRootLinkItems();
      state.loaded = true;
      return state.items;
    });
    return state.loading;
  }

  function search(query) {
    var q = normalize(query);
    if (q.length < 2) return [];
    return state.items.map(function (item, index) {
      var title = normalize(item.title), hay = title + ' ' + item.keywords;
      var score = title === q ? 100 : (title.indexOf(q) === 0 ? 70 : (hay.indexOf(q) !== -1 ? 35 : 0));
      return { item: item, score: score, index: index };
    }).filter(function (entry) { return entry.score > 0; }).sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    }).slice(0, MAX_RESULTS).map(function (entry) { return entry.item; });
  }

  function render(items, results) {
    results.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.innerHTML = '<span class="search-empty-icon" aria-hidden="true">⌕</span><span>Ничего не найдено</span><small>Попробуйте другое слово или корень</small>';
      results.appendChild(empty);
      results.classList.add('show');
      return;
    }
    var frag = document.createDocumentFragment();
    var groups = {};
    items.forEach(function (item) {
      var key = item.source || 'Лаборатория';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    var icons = { 'Лаборатория': 'layout-dashboard', 'Система': 'settings-2', 'Словари': 'book-open', 'Корни': 'git-branch', 'Методология': 'hammer', 'Книгочтение': 'book-open', 'Анализ': 'scan-search', 'Данные': 'globe-2', 'Инструменты': 'wrench', 'Рабочая область': 'panels-top-left', 'Исследования': 'library' };
    Object.keys(groups).forEach(function (source) {
      var group = document.createElement('section'); group.className = 'sr-group';
      var head = document.createElement('div'); head.className = 'sr-group-head';
      head.innerHTML = '<span class="sr-group-icon"><i data-lucide="' + (icons[source] || 'layers-3') + '" aria-hidden="true"></i></span><span class="sr-group-label"></span><span class="sr-group-count"></span>';
      head.querySelector('.sr-group-label').textContent = source;
      head.querySelector('.sr-group-count').textContent = groups[source].length;
      group.appendChild(head);
      groups[source].forEach(function (item) {
        var button = document.createElement('button'); button.type = 'button'; button.className = 'search-result-item sr-item';
        button.dataset.route = item.route; button.dataset.params = item.params ? JSON.stringify(item.params) : '';
        var copy = document.createElement('span'); copy.className = 'sr-copy';
        var text = document.createElement('span'); text.className = 'sr-text'; text.textContent = item.title;
        var snippet = document.createElement('span'); snippet.className = 'sr-snippet'; snippet.textContent = item.snippet;
        copy.appendChild(text); if (item.snippet && normalize(item.snippet) !== normalize(item.title)) copy.appendChild(snippet);
        var arrow = document.createElement('span'); arrow.className = 'sr-arrow';
        button.appendChild(copy); button.appendChild(arrow); group.appendChild(button);
      });
      frag.appendChild(group);
    });
    results.appendChild(frag); results.classList.add('show');
    if (global.LabIcons && typeof global.LabIcons.sync === 'function') global.LabIcons.sync();
  }

  function goTo(item) {
    if (!global.LabRouter || !item) return;
    var parts = String(item.route || '').split('/');
    var moduleId = parts.shift();
    hide();
    if (global.LabSearchToggle) global.LabSearchToggle.close(false);
    global.LabRouter.navigate(moduleId, parts.length ? parts : null, item.params || null);
  }

  function init() {
    var input = document.getElementById('gs-input'), results = document.getElementById('gs-results');
    if (!input || !results) return;
    var timer;
    input.removeAttribute('oninput'); input.removeAttribute('onkeydown');
    input.addEventListener('input', function () {
      clearTimeout(timer); var query = input.value;
      timer = setTimeout(function () { render(search(query), results); load().then(function () { render(search(query), results); }); }, 120);
    });
    input.addEventListener('keydown', function (event) { if (event.key === 'Escape') hide(); });
    results.addEventListener('click', function (event) {
      var target = event.target.closest ? event.target.closest('.sr-item') : null; if (!target || !global.LabRouter) return;
      var item = { route: target.dataset.route, params: null };
      try { item.params = JSON.parse(target.dataset.params || 'null'); } catch (ignore) {}
      goTo(item);
    });
  }

  function hide() { var results = document.getElementById('gs-results'), input = document.getElementById('gs-input'); if (results) results.classList.remove('show'); if (input) input.value = ''; }
  global.LabSearch = { load: load, search: search, hide: hide, goTo: goTo, normalize: normalize, getIndex: function () { return state.items.slice(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}(window));
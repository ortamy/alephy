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

  /* Индекс модулей собирается из реестра (маршруты), сайдбара (подписи и
     разделы) и LabHero.targets (подписи модулей вне сайдбара). Своя копия
     списка была третьей по счёту и расходилась с реестром молча; её больше нет,
     а согласованность реестра с сайдбаром держит registry-check.mjs. */
  function sidebarIndex() {
    var index = {};
    var nodes = document.querySelectorAll ? document.querySelectorAll('a.sidebar-item[data-module]') : [];
    Array.prototype.forEach.call(nodes, function (node) {
      var id = node.getAttribute('data-module');
      if (!id || index[id]) return;
      var section = node.closest ? node.closest('.sidebar-section') : null;
      var head = section ? section.querySelector('.sidebar-section-header') : null;
      index[id] = {
        label: node.textContent.replace(/\s+/g, ' ').trim(),
        section: head ? head.textContent.replace(/\s+/g, ' ').trim() : 'Лаборатория'
      };
    });
    return index;
  }

  function heroTitles() {
    var hero = global.LabHero;
    var targets = (hero && hero.targets) || {};
    var titles = {};
    Object.keys(targets).forEach(function (id) {
      if (targets[id] && targets[id].title) titles[id] = targets[id].title;
    });
    return titles;
  }

  function moduleEntries() {
    var registry = global.ModuleRegistry;
    if (!registry || !registry.MODULES) return [];
    var inSidebar = sidebarIndex(), titles = heroTitles();
    return registry.MODULES.filter(function (entry) {
      return entry.kind === 'panel';
    }).map(function (entry) {
      var nav = inSidebar[entry.id];
      return {
        id: entry.id,
        title: (nav && nav.label) || titles[entry.id] || entry.id,
        section: nav ? nav.section : 'Лаборатория'
      };
    });
  }

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

  // Документы корпуса: тела лежат по файлам (methodology), поэтому в индекс
  // попадает указатель коллекции — заголовок, описание и ключ. Ключ без
  // маршрута в реестре не индексируется: ссылка была бы в никуда.
  function documentItems(data, group, label) {
    var registry = global.ModuleRegistry;
    var routes = {};
    registry.docs(group).forEach(function(entry) {
      var doc = registry.docSource(entry.id);
      if (doc && doc.key) routes[doc.key] = entry.id;
    });
    Object.keys(data || {}).forEach(function(key) {
      var route = routes[key];
      var documentData = data[key] || {};
      if (!route) return;
      add(state.items, 'document', documentData.title || key, documentData.description,
        route, label, key + ' ' + (documentData.title || '') + ' ' + (documentData.description || ''));
    });
  }

  function collectionIndex(group) {
    var registry = global.ModuleRegistry;
    var meta = registry && registry.COLLECTIONS ? registry.COLLECTIONS[group] : null;
    return meta && meta.file ? meta : null;
  }

  // Подпись группы берётся из шапки её хаба — иначе в палитре появился бы
  // английский идентификатор коллекции.
  function collectionLabel(group) {
    var meta = collectionIndex(group);
    var titles = meta ? heroTitles() : {};
    var hub = meta && meta.hub;
    return (hub && titles[hub]) || group;
  }

  function moduleItems() {
    return moduleEntries().map(function (m) {
      return { type: 'module', title: m.title, snippet: m.title, route: m.id,
        source: m.section || 'Лаборатория', keywords: normalize(m.id + ' ' + m.section) };
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
      // Документы коллекций: словари уже разложены на слова и термины выше,
      // поэтому в указатель попадают только exposures и methodology.
      var documents = ['exposures', 'methodology'].map(function (group) {
        var meta = collectionIndex(group);
        if (!meta) return Promise.resolve();
        return readJson(meta.file).then(function (data) {
          documentItems(data, group, collectionLabel(group));
        }).catch(function (error) { console.warn('[LabSearch] fallback:', error.message); });
      });
      return Promise.all(documents);
    }).then(function () {
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
    var icons = { 'Лаборатория': 'layout-dashboard', 'Система': 'settings-2', 'Словари': 'book-open', 'Корни': 'git-branch', 'Методология': 'hammer', 'Книгочтение': 'book-open', 'Анализ': 'scan-search', 'Данные': 'globe-2', 'Инструменты': 'wrench', 'Рабочая область': 'panels-top-left', 'Исследования': 'library', 'Разоблачения': 'scan-search', 'Материалы методологии': 'hammer' };
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
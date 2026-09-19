const RootDict = (function() {
  'use strict';
  var CHUNK = 24;
  var LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];
  var EXAMPLES = ['אב', 'אם', 'אמן'];
  var roots = [];
  var links = [];
  var filtered = [];
  var visible = CHUNK;
  var loading = false;
  var graphLoading = false;
  var typingTimer = null;
  var state = { q: '', letter: '', f: '' };

  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function navigateParams(params) {
    if (window.LabRouter) window.LabRouter.navigate('root-dictionary', null, params);
  }

  function navigateSegs(segments) {
    if (window.LabRouter) window.LabRouter.navigate('root-dictionary', segments);
  }
  // Единая статическая разметка экрана (тулбар + индекс + список).
  // Живой рендер затрагивает только #rd-list / #rd-more — фокус поиска не теряется.
  function markup() {
    var html = '<div class="rd-toolbar">' +
      '<div class="rd-toolbar-label"><span>' + escapeHtml(t('lab.rootDict.searchLabel', 'Поиск корня')) + '</span>' +
      '<span class="rd-toolbar-rule" aria-hidden="true"></span></div>' +
      '<div class="rd-toolbar-row">' +
      '<input type="search" id="rd-search" class="lab-input rd-search" autocomplete="off" placeholder="' +
      escapeHtml(t('lab.rootDict.searchPlaceholder', 'אמן, AMN, верить…')) +
      '" oninput="if(window.RootsSearch)RootsSearch.onInput(this.value)">';
    EXAMPLES.forEach(function(ex) {
      html += '<button type="button" class="rd-chip rd-chip-example" lang="hbo" aria-label="' + escapeHtml(ex) +
        '" onclick="if(window.RootsSearch)RootsSearch.pick(\'' + ex + '\')">' + ex + '</button>';
    });
    html += '<span class="rd-toolbar-stats">' +
      '<span class="rd-chip rd-chip-mono" id="rd-total">…</span>' +
      '<span class="rd-chip rd-chip-mono" id="rd-found">…</span>' +
      '</span></div>' +
      '<div class="rd-filters">' +
      '<button type="button" class="rd-chip" data-rd-filter="subs">' + escapeHtml(t('lab.rootDict.filterSubs', 'с подменами')) + '</button>' +
      '<button type="button" class="rd-chip" data-rd-filter="image">' + escapeHtml(t('lab.rootDict.filterImage', 'с образом')) + '</button>' +
      '</div></div>' +
      '<nav class="rd-index" id="rd-index" aria-label="Alphabet index"></nav>' +
      '<div id="rd-spinner" class="rd-spinner show"><div class="loader"></div><div class="spinner-text">' +
      escapeHtml(t('lab.rootDict.loading', 'Загрузка словаря…')) + '</div></div>' +
      '<div id="rd-list"></div>' +
      '<div id="rd-more" class="rd-more"></div>' +
      '<div id="rd-empty" class="lab-alert lab-alert-info" style="display:none"></div>';
    return html;
  }

  function host() {
    var list = document.getElementById('rd-list');
    return list ? (list.closest('.module') || document) : document;
  }

  function bind() {
    var scope = host();
    scope.querySelectorAll('[data-rd-filter]').forEach(function(btn) {
      btn.onclick = function() { setFilter(btn.getAttribute('data-rd-filter')); };
    });
    var index = document.getElementById('rd-index');
    if (index) index.onclick = function(event) {
      var chip = event.target.closest('.rd-index-chip');
      if (chip) setLetter(chip.getAttribute('data-letter'));
    };
  }

  function updateControls() {
    var input = document.getElementById('rd-search');
    if (input && document.activeElement !== input) input.value = state.q;
    var scope = host();
    scope.querySelectorAll('[data-rd-filter]').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-rd-filter') === state.f);
    });
    renderIndex();
  }

  function renderIndex() {
    var index = document.getElementById('rd-index');
    if (!index) return;
    var present = {};
    roots.forEach(function(r) { present[r.root.charAt(0)] = true; });
    var html = '';
    LETTERS.forEach(function(letter) {
      if (!present[letter]) return;
      html += '<button type="button" class="rd-index-chip' + (state.letter === letter ? ' is-active' : '') +
        '" data-letter="' + letter + '" aria-pressed="' + (state.letter === letter) + '">' + letter + '</button>';
    });
    index.innerHTML = html;
  }
  function init() {
    if (roots.length) {
      var readySpinner = document.getElementById('rd-spinner');
      if (readySpinner) readySpinner.classList.remove('show');
      bind();
      applyRoute(window.LabRouter && window.LabRouter.parseHash ? window.LabRouter.parseHash() : null);
      return;
    }
    if (loading) return;
    loading = true;
    bind();
    fetch('data/roots/roots.json')
      .then(function(response) {
        if (!response.ok) throw new Error('roots.json: HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        loading = false;
        roots = Array.isArray(data) ? data : [];
        window._roots = data;
        return fetch('data/roots/root-links.json').then(function(response) {
          if (!response.ok) throw new Error('root-links.json: HTTP ' + response.status);
          return response.json();
        }).catch(function() { return []; }).then(function(manualLinks) {
          links = window.RootGraph ? RootGraph.mergeLinks(roots, manualLinks) : [];
        });
      })
      .then(function() {
        loading = false;
        var spinnerEl = document.getElementById('rd-spinner');
        if (spinnerEl) spinnerEl.classList.remove('show');
        var totalEl = document.getElementById('rd-total');
        if (totalEl) totalEl.textContent = roots.length + ' ' + t('lab.rootDict.rootsLabel', 'корней');
        applyRoute(window.LabRouter && window.LabRouter.parseHash ? window.LabRouter.parseHash() : null);
      })
      .catch(function(err) {
        loading = false;
        console.error('[RootDict] Не удалось загрузить словарь:', err);
        var spinnerEl = document.getElementById('rd-spinner');
        if (spinnerEl) spinnerEl.innerHTML = '<div class="lab-alert lab-alert-error">' + escapeHtml(t('lab.rootDict.loadFailed', 'Ошибка загрузки словаря. Проверьте, что ResearchLab открыт через HTTP-сервер.')) + '</div>';
      });
  }

  function applyRoute(parsed) {
    parsed = parsed || (window.LabRouter && window.LabRouter.parseHash ? window.LabRouter.parseHash() : null);
    var segments = parsed && parsed.segments ? parsed.segments.slice(1) : [];
    if (segments[0] === 'graph') { renderGraph(decodeURIComponent(segments[1] || '')); return; }
    var params = (parsed && parsed.params) || {};
    state.q = String(params.q || '').trim();
    state.letter = String(params.letter || '').charAt(0);
    state.f = params.f === 'subs' || params.f === 'image' ? params.f : '';
    visible = CHUNK;
    updateControls();
    if (roots.length) run();
  }

  function run() {
    var q = state.q.toLowerCase();
    filtered = roots.filter(function(r) {
      if (state.letter && r.root.charAt(0) !== state.letter) return false;
      if (state.f === 'subs' && !(r.substitutions && r.substitutions.length)) return false;
      if (state.f === 'image' && !r.image) return false;
      if (!q) return true;
      return r.root.indexOf(state.q) !== -1 ||
        r.translit.toLowerCase().indexOf(q) !== -1 ||
        r.meaning.toLowerCase().indexOf(q) !== -1 ||
        (r.image && r.image.toLowerCase().indexOf(q) !== -1) ||
        (r.substitutions && r.substitutions.some(function(s) { return s.toLowerCase().indexOf(q) !== -1; }));
    });
    render();
  }
  function relatedRoots(r) {
    if (!window.RootGraph || !links.length) return [];
    var id = RootGraph.rootId(r);
    if (!id) return [];
    var seen = {};
    var out = [];
    RootGraph.getRootLinks(links, id).forEach(function(link) {
      var other = link.from === id ? link.to : link.from;
      if (seen[other] || out.length >= 4) return;
      seen[other] = true;
      var node = RootGraph.getRootById(roots, other);
      if (node) out.push(node);
    });
    return out;
  }

  function cardHtml(r) {
    var glyph = (r.paleo && r.paleo.length) ? r.paleo.join('') : '';
    var html = '<article class="rd-card" data-root-id="' + escapeHtml(r.root) + '" tabindex="0" role="button" aria-label="' +
      escapeHtml(t('lab.rootDict.openEtymology', 'Открыть этимологический разбор') + ': ' + r.root) + '">';
    html += '<div class="rd-card-head">' +
      (glyph ? '<span class="rd-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(glyph) + '</span>' : '') +
      '<span class="root-heb" lang="he" dir="rtl">' + escapeHtml(r.root) + '</span>' +
      '<span class="rd-translit-chip">' + escapeHtml(r.translit) + '</span></div>';
    html += '<div class="rd-meaning">' + escapeHtml(r.meaning) + '</div>';
    if (r.image) {
      html += '<div class="rd-row rd-row-image">' +
        (r.paleo && r.paleo[0] ? '<span class="rd-row-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(r.paleo[0]) + '</span>' : '') +
        '<span class="rd-row-label">' + escapeHtml(t('lab.rootDict.image', 'Образ')) + '</span>' +
        '<span class="rd-row-text">' + escapeHtml(r.image) + '</span></div>';
    }
    if (r.substitutions && r.substitutions.length) {
      html += '<div class="rd-row rd-row-subs">' +
        '<span class="rd-row-label">' + escapeHtml(t('lab.rootDict.subs', 'Подмены')) + '</span>' +
        '<span class="rd-row-text">' + r.substitutions.map(escapeHtml).join(' · ') + '</span></div>';
    }
    var related = relatedRoots(r);
    if (related.length) {
      html += '<div class="rd-related">' + related.map(function(node) {
        return '<button type="button" class="rd-related-chip" lang="he" aria-label="' + escapeHtml(node.translit) +
          '" onclick="event.stopPropagation();if(window.RootsSearch)RootsSearch.filter(\'' + escapeHtml(node.translit) + '\')">' +
          escapeHtml(node.root) + '</button>';
      }).join('') + '</div>';
    }
    return html + '</article>';
  }

  function render() {
    var list = document.getElementById('rd-list');
    var empty = document.getElementById('rd-empty');
    var moreHost = document.getElementById('rd-more');
    if (!list) return;
    var foundEl = document.getElementById('rd-found');
    if (foundEl) foundEl.textContent = filtered.length + ' ' + t('lab.rootDict.foundLabel', 'найдено');
    if (!filtered.length) {
      list.innerHTML = '';
      if (moreHost) moreHost.innerHTML = '';
      if (empty) {
        empty.textContent = t('lab.rootDict.nothingFound', 'Ничего не найдено.');
        empty.style.display = 'block';
      }
      return;
    }
    if (empty) empty.style.display = 'none';
    if (visible > filtered.length) visible = filtered.length;
    list.innerHTML = filtered.slice(0, visible).map(cardHtml).join('');
    if (window.RootEtymologyModal) window.RootEtymologyModal.bind(list);
    if (moreHost) {
      moreHost.innerHTML = filtered.length > visible
        ? '<button type="button" class="lab-btn lab-btn-secondary rd-more-btn" onclick="if(window.RootsSearch)RootsSearch.more()">' +
          escapeHtml(t('lab.rootDict.loadMore', 'Показать ещё ' + CHUNK)) + '</button>'
        : '';
    }
  }
  function onInput(value) {
    state.q = String(value || '').trim();
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(function() {
      navigateParams({ q: state.q, letter: state.letter, f: state.f });
    }, 250);
  }

  function pick(example) {
    if (typingTimer) clearTimeout(typingTimer);
    state.q = example;
    var input = document.getElementById('rd-search');
    if (input) input.value = example;
    navigateParams({ q: example, letter: state.letter, f: state.f });
  }

  function filter(query) {
    if (typingTimer) clearTimeout(typingTimer);
    navigateParams({ q: String(query || '').trim() });
  }

  function setLetter(letter) {
    state.letter = state.letter === letter ? '' : letter;
    navigateParams({ q: state.q, letter: state.letter, f: state.f });
  }

  function setFilter(f) {
    state.f = state.f === f ? '' : f;
    navigateParams({ q: state.q, letter: state.letter, f: state.f });
  }

  function more() {
    visible += CHUNK;
    render();
  }

  function graph(id) { navigateSegs(['graph', encodeURIComponent(id)]); }
  function back() { navigateParams({}); }

  function renderGraph(id) {
    if (graphLoading || !roots.length) return;
    if (!window.RootGraph) return;
    var graphData = RootGraph.localGraph(roots, links, id);
    if (!graphData.root) { back(); return; }
    var list = document.getElementById('rd-list');
    var moreHost = document.getElementById('rd-more');
    if (!list) return;
    if (moreHost) moreHost.innerHTML = '';
    var center = graphData.nodes[0], width = 760, height = 360, cx = width / 2, cy = height / 2;
    var positions = {};
    graphData.nodes.forEach(function(node, index) {
      var angle = index === 0 ? 0 : (index - 1) * Math.PI * 2 / Math.max(1, graphData.nodes.length - 1);
      var radius = index === 0 ? 0 : Math.min(125, 55 + graphData.nodes.length * 10);
      positions[RootGraph.rootId(node)] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    var edges = graphData.links.map(function(link) { var a = positions[link.from], b = positions[link.to]; return a && b ? '<line class="rd-graph-edge" data-confidence="' + escapeHtml(link.confidence) + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"></line>' : ''; }).join('');
    var nodes = graphData.nodes.map(function(node) { var p = positions[RootGraph.rootId(node)], selected = RootGraph.rootId(node) === id.toUpperCase(); return '<g class="rd-graph-node" tabindex="0" role="button" aria-label="' + escapeHtml(node.translit + ': ' + node.meaning) + '" onclick="RootsSearch.graph(\'' + encodeURIComponent(node.translit) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();RootsSearch.graph(\'' + encodeURIComponent(node.translit) + '\')}"' + (selected ? ' aria-current="true"' : '') + '><circle cx="' + p.x + '" cy="' + p.y + '" r="' + (selected ? 42 : 34) + '"></circle><text x="' + p.x + '" y="' + p.y + '" lang="hbo">' + escapeHtml(RootGraph.paleo(node)) + '</text><text class="rd-graph-node-label" x="' + p.x + '" y="' + (p.y + 58) + '">' + escapeHtml(node.translit) + '</text></g>'; }).join('');
    var relationItems = graphData.links.map(function(link) { var other = link.from.toUpperCase() === id.toUpperCase() ? link.to : link.from; var node = RootGraph.getRootById(roots, other); return '<li><button type="button" class="lab-btn lab-btn-link" onclick="RootsSearch.graph(\'' + encodeURIComponent(other) + '\')">' + escapeHtml(node ? node.translit : other) + '</button> — ' + escapeHtml(link.label || link.type) + '; <span class="rd-graph-confidence">' + escapeHtml(link.confidence) + '</span>; ' + escapeHtml(link.source) + '. ' + escapeHtml(link.note || '') + '</li>'; }).join('');
    list.innerHTML = '<section class="rd-graph" aria-labelledby="rd-graph-title"><div class="rd-graph-toolbar"><button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="RootsSearch.back()">К словарю</button><a class="lab-btn lab-btn-primary lab-btn-sm" href="#learn/paleo-trainer?root=' + encodeURIComponent(id) + '">Цепочка в палео-тренажёре</a><span class="rd-graph-note">Только палео-иврит / протоханаанейские глифы.</span></div><h2 id="rd-graph-title">Связи: ' + escapeHtml(center.translit) + '</h2><p>' + escapeHtml(center.meaning) + '</p><div class="rd-graph-canvas"><svg viewBox="0 0 760 360" role="img" aria-label="Локальная карта палео-связей">' + edges + nodes + '</svg></div><div class="rd-graph-legend" aria-label="Легенда"><span>сплошная — подтверждённая/вероятная</span><span class="is-dashed">пунктир — гипотеза/непроверено</span><span>Уверенность и источник также указаны текстом.</span></div><div class="rd-graph-list"><h3>Список отношений</h3><ul>' + (relationItems || '<li>Связи не найдены.</li>') + '</ul></div></section>';
  }

  window.RootsSearch = {
    onInput: onInput,
    pick: pick,
    filter: filter,
    setLetter: setLetter,
    setFilter: setFilter,
    more: more,
    graph: graph,
    back: back
  };
  window.RootDict = { init: init, applyRoute: applyRoute, markup: markup };
  return window.RootDict;
})();

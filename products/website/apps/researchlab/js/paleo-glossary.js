/**
 * paleo-glossary.js — Палео-глоссарий: тулбар + сетка карточек + двери в корневой словарь.
 * Данные: data/paleo-glossary/roots.json (paleo, hebrew, translit, function, root).
 * Состояние в hash: ?q=&root=. Подгрузка по 24, как в корневом словаре.
 */
const PaleoGlossary = (function() {
  'use strict';

  var CHUNK = 24;
  var words = [];
  var filtered = [];
  var visible = CHUNK;
  var loading = false;
  var typingTimer = null;
  var state = { q: '', root: 'all' };

  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function navigateParams() {
    if (!window.LabRouter) return;
    var params = {};
    if (state.q) params.q = state.q;
    if (state.root && state.root !== 'all') params.root = state.root;
    var current = window.location.hash || '';
    if (current.indexOf('#dictionaries/paleo-glossary') === 0) {
      window.LabRouter.navigate('dictionaries', ['paleo-glossary'], params);
    } else {
      window.LabRouter.navigate('paleo-glossary', null, params);
    }
  }
  // Единая статическая разметка экрана: тулбар + сетка + подгрузка.
  function markup(prefix) {
    return '<div class="pg-toolbar">' +
      '<div class="pg-toolbar-label"><span>' + escapeHtml(t('lab.paleoGlossary.searchLabel', 'Поиск слова')) + '</span>' +
      '<span class="pg-toolbar-rule" aria-hidden="true"></span></div>' +
      '<div class="pg-toolbar-row">' +
      '<input type="search" id="paleo-glossary-search" data-t="q" class="lab-input pg-search" autocomplete="off" placeholder="' +
      escapeHtml(t('lab.paleoGlossary.searchPlaceholder', 'Палео-форма, слово или транслитерация')) +
      '" oninput="if(window.PaleoGlossary)window.PaleoGlossary.onInput(this.value)">' +
      '<select id="paleo-glossary-root" data-t="root" class="lab-input pg-root" onchange="if(window.PaleoGlossary)window.PaleoGlossary.onRoot(this.value)">' +
      '<option value="all">' + escapeHtml(t('lab.paleoGlossary.allRoots', 'Все корни')) + '</option></select>' +
      '<span class="pg-chip-mono" id="paleo-glossary-count">…</span>' +
      '</div></div>' +
      '<div id="paleo-glossary-spinner" class="pg-spinner show"><div class="loader"></div><div class="spinner-text">' +
      escapeHtml(t('lab.paleoGlossary.loading', 'Загрузка глоссария…')) + '</div></div>' +
      '<div id="paleo-glossary-grid" class="paleo-glossary-grid"></div>' +
      '<div id="paleo-glossary-more" class="pg-more"></div>' +
      '<div id="paleo-glossary-empty" class="lab-alert lab-alert-info" style="display:none"></div>';
  }

  function scopeOf() {
    var grid = document.getElementById('paleo-glossary-grid');
    return grid ? (grid.closest('.module') || document) : document;
  }

  function readParams(parsed) {
    var params = parsed && parsed.params ? parsed.params : {};
    state.q = String(params.q || '').trim();
    state.root = String(params.root || 'all');
  }

  function syncControls() {
    var scope = scopeOf();
    var search = scope.querySelector('#paleo-glossary-search');
    if (search && document.activeElement !== search) search.value = state.q;
    var select = scope.querySelector('#paleo-glossary-root');
    if (select && select.value !== state.root) select.value = state.root;
  }

  function applyParams(parsed) {
    readParams(parsed || (window.LabRouter && window.LabRouter.parseHash ? window.LabRouter.parseHash() : null));
    visible = CHUNK;
    syncControls();
    if (words.length) render();
  }
  function init(container, parsed) {
    if (words.length) {
      var readySpinner = document.getElementById('paleo-glossary-spinner');
      if (readySpinner) readySpinner.classList.remove('show');
      applyParams(parsed);
      return;
    }
    if (loading) return;
    loading = true;
    fetch('data/paleo-glossary/roots.json')
      .then(function(response) {
        if (!response.ok) throw new Error('roots.json: HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        loading = false;
        words = Array.isArray(data) ? data.map(function(word) {
          // JSON хранит квадратное письмо в поле hebrew; UI использует square.
          return Object.assign({}, word, { square: word.square || word.hebrew || '' });
        }) : [];
        var spinnerEl = document.getElementById('paleo-glossary-spinner');
        if (spinnerEl) spinnerEl.classList.remove('show');
        fillRootSelect();
        applyParams(parsed);
      })
      .catch(function(err) {
        loading = false;
        console.error('[PaleoGlossary] Не удалось загрузить данные:', err);
        var spinnerEl = document.getElementById('paleo-glossary-spinner');
        if (spinnerEl) spinnerEl.innerHTML = '<div class="lab-alert lab-alert-error">' + escapeHtml(t('lab.paleoGlossary.loadFailed', 'Не удалось открыть глоссарий.')) + '</div>';
      });
  }

  function fillRootSelect() {
    var scope = scopeOf();
    var select = scope.querySelector('#paleo-glossary-root');
    if (!select) return;
    var seen = {};
    var roots = [];
    words.forEach(function(word) {
      var key = String(word.root || '');
      if (key && !seen[key]) { seen[key] = true; roots.push(key); }
    });
    roots.sort(function(a, b) { return a.localeCompare(b, 'he'); });
    select.innerHTML = '<option value="all">' + escapeHtml(t('lab.paleoGlossary.allRoots', 'Все корни')) + '</option>' +
      roots.map(function(root) {
        return '<option value="' + escapeHtml(root) + '"' + (root === state.root ? ' selected' : '') + '>' + escapeHtml(root) + '</option>';
      }).join('');
  }
  function run() {
    var q = state.q.toLowerCase();
    filtered = words.filter(function(word) {
      var matchesRoot = state.root === 'all' || String(word.root) === state.root;
      if (!matchesRoot) return false;
      if (!q) return true;
      var haystack = [word.paleo, word.square, word.translit, word['function'], word.root].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    render();
  }

  // Дверь в корневой словарь: deep-link на карточку корня по транслиту.
  function rootDoorUrl(word) {
    var key = String(word && word.translit || '').trim();
    return '#root-dictionary' + (key ? '?q=' + encodeURIComponent(key) : '');
  }

  function openRootDoor(word) {
    window.location.hash = rootDoorUrl(word);
  }

  function cardHtml(word) {
    var html = '<article class="paleo-glossary-card" data-word-root="' + escapeHtml(word.root) + '" tabindex="0" role="button" aria-label="' +
      escapeHtml(t('lab.paleoGlossary.openRoot', 'Открыть корень') + ': ' + (word.root || word.translit)) + '">' +
      '<div class="paleo-glossary-card-top">' +
      '<div class="paleo-glossary-card-paleo" lang="hbo">' + escapeHtml(word.paleo) + '</div>' +
      '<span class="paleo-glossary-card-translit">' + escapeHtml(word.translit) + '</span>' +
      '</div>' +
      '<p class="paleo-glossary-card-function">' + escapeHtml(word['function']) + '</p>' +
      '<div class="paleo-glossary-card-foot">' +
      '<span class="paleo-glossary-door" lang="he">→ ' + escapeHtml(t('lab.paleoGlossary.toRoot', 'корень')) + ' ' + escapeHtml(word.root) + '</span>';
    if (word['function']) {
      html += '<span class="paleo-glossary-card-fn">' + escapeHtml(String(word['function']).split(',')[0]) + '</span>';
    }
    return html + '</div></article>';
  }
  function render() {
    var grid = document.getElementById('paleo-glossary-grid');
    var empty = document.getElementById('paleo-glossary-empty');
    var moreHost = document.getElementById('paleo-glossary-more');
    var count = document.getElementById('paleo-glossary-count');
    if (!grid) return;
    if (count) count.textContent = filtered.length + ' ' + t('lab.paleoGlossary.wordsLabel', 'слов');
    if (!filtered.length) {
      grid.innerHTML = '';
      if (moreHost) moreHost.innerHTML = '';
      if (empty) {
        empty.innerHTML = '<div class="pg-empty"><span class="pg-empty-glyph" aria-hidden="true">𐤌</span>' +
          '<span>' + escapeHtml(t('lab.paleoGlossary.nothingFound', 'Ничего не найдено.')) + '</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="if(window.PaleoGlossary)window.PaleoGlossary.reset()">' +
          escapeHtml(t('lab.paleoGlossary.reset', 'Сбросить')) + '</button></div>';
        empty.style.display = 'block';
      }
      return;
    }
    if (empty) empty.style.display = 'none';
    if (visible > filtered.length) visible = filtered.length;
    grid.innerHTML = filtered.slice(0, visible).map(cardHtml).join('');
    grid.querySelectorAll('.paleo-glossary-card').forEach(function(card, index) {
      function open() { openRootDoor(filtered[index]); }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });
    if (moreHost) {
      moreHost.innerHTML = filtered.length > visible
        ? '<button type="button" class="lab-btn lab-btn-secondary pg-more-btn" onclick="if(window.PaleoGlossary)window.PaleoGlossary.more()">' +
          escapeHtml(t('lab.paleoGlossary.loadMore', 'Показать ещё ' + CHUNK)) + '</button>'
        : '';
    }
  }

  function onInput(value) {
    state.q = String(value || '').trim();
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(navigateParams, 250);
  }

  function onRoot(value) {
    if (typingTimer) clearTimeout(typingTimer);
    state.root = String(value || 'all');
    navigateParams();
  }

  function reset() {
    if (typingTimer) clearTimeout(typingTimer);
    state.q = '';
    state.root = 'all';
    navigateParams();
  }

  function more() {
    visible += CHUNK;
    render();
  }

  window.PaleoGlossary = {
    init: init,
    applyParams: applyParams,
    markup: markup,
    onInput: onInput,
    onRoot: onRoot,
    reset: reset,
    more: more
  };
  return window.PaleoGlossary;
})();

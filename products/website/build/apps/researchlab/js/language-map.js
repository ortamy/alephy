/**
 * Карта языков — диагностика живых языков через палео-механику.
 * Тулбар по DESIGN-SYSTEM §4.7, карточки §4.2, список-режим §4.8.
 * Фильтры и вид живут в hash маршрута (deep-link), вид — также в localStorage.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/language-map.html';
  var DATA_PATH = 'data/language-map/languages.json';
  var VIEW_STORAGE_KEY = 'alephy_language_map_view';
  var pagePromise = null;
  var dataPromise = null;
  var state = { markup: '', languages: [], view: 'grid', query: '', type: 'all', davar: 'all', sort: 'asc' };

  /* ISO-коды языков: карта исключений, где ISO расходится с двумя первыми
     буквами id; остальное выводится из id. Эмодзи-флаги заменены кодами. */
  var LANGUAGE_CODE_FIXES = {
    arabic: 'ar', albanian: 'sq', basque: 'eu', bengali: 'bn', bulgarian: 'bg',
    burmese: 'my', cantonese: 'yue', chechen: 'ce', chinese: 'zh', croatian: 'hr',
    czech: 'cs', estonian: 'et', filipino: 'fil', french: 'fr', german: 'de',
    georgian: 'ka', greek: 'el', guarani: 'gn', indonesian: 'id', irish: 'ga',
    japanese: 'ja', javanese: 'jv', kannada: 'kn', kazakh: 'kk', lingala: 'ln',
    lithuanian: 'lt', malay: 'ms', maori: 'mi', 'modern-hebrew': 'he', persian: 'fa',
    serbian: 'sr', slovak: 'sk', spanish: 'es', swahili: 'sw', swedish: 'sv',
    tajik: 'tg', tatar: 'tt', tibetan: 'bo'
  };

  function assetUrl(path) {
    return new URL(path, document.baseURI).href;
  }

  function escapeHtml(value) {
    var node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function languageCode(id) {
    var known = LANGUAGE_CODE_FIXES[id];
    if (known) return known.toUpperCase();
    return String(id || '').slice(0, 2).toUpperCase();
  }

  function levelClass(value) {
    var level = normalize(value);
    if (level === 'высокая') return 'high';
    if (level === 'средняя') return 'medium';
    return 'low';
  }

  function levelLabel(value) {
    var labels = { низкая: 'Низкая', средняя: 'Средняя', высокая: 'Высокая' };
    return labels[normalize(value)] || 'Не указано';
  }

  /* Точки Давара: 5 точек 4px, заполнение по уровню (низкая 2 / средняя 3 / высокая 5). */
  var DAVAR_FILL = { низкая: 2, средняя: 3, высокая: 5 };

  function davarDots(value) {
    var filled = DAVAR_FILL[normalize(value)] || 0;
    var label = 'Давар: ' + levelLabel(value);
    var dots = '';
    for (var i = 0; i < 5; i++) {
      dots += '<span class="language-map-dot' + (i < filled ? ' is-filled' : '') + '"></span>';
    }
    return '<span class="language-map-dots" role="img" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '">' + dots + '</span>';
  }
  function fetchPage() {
    if (!pagePromise) {
      pagePromise = fetch(assetUrl(PAGE_PATH))
        .then(function(response) {
          if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + PAGE_PATH);
          return response.text();
        })
        .catch(function(error) {
          pagePromise = null;
          throw error;
        });
    }
    return pagePromise;
  }

  function fetchData() {
    if (!dataPromise) {
      dataPromise = fetch(assetUrl(DATA_PATH))
        .then(function(response) {
          if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + DATA_PATH);
          return response.json();
        })
        .then(function(payload) {
          if (!payload || !Array.isArray(payload.languages)) {
            throw new Error('В наборе языков отсутствует массив languages');
          }
          return payload.languages;
        })
        .catch(function(error) {
          dataPromise = null;
          throw error;
        });
    }
    return dataPromise;
  }

  function setError(container, error) {
    container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить карту языков: ' +
      escapeHtml(error && error.message ? error.message : 'неизвестная ошибка') + '</div>';
  }

  function findLanguage(id) {
    return state.languages.filter(function(language) { return language.id === id; })[0] || null;
  }

  function renderMetric(label, value) {
    return '<div class="language-map-metric">' +
      '<dt>' + escapeHtml(label) + '</dt>' +
      '<dd class="language-map-level language-map-level-' + levelClass(value) + '">' +
      escapeHtml(levelLabel(value)) + '</dd>' +
      '</div>';
  }

  function readStoredView() {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
    } catch (error) {
      return 'grid';
    }
  }

  function saveStoredView(view) {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch (error) { /* приватный режим */ }
  }

  /* history.replaceState вместо LabRouter.navigate — иначе hashchange
     перерисовывает контейнер на каждое нажатие клавиши и сбивает фокус поиска. */
  function updateHash() {
    var params = [];
    if (state.query) params.push('q=' + encodeURIComponent(state.query));
    if (state.type !== 'all') params.push('type=' + encodeURIComponent(state.type));
    if (state.davar !== 'all') params.push('davar=' + encodeURIComponent(state.davar));
    if (state.sort !== 'asc') params.push('sort=' + state.sort);
    if (state.view !== 'grid') params.push('view=' + state.view);
    var hash = '#language-map' + (params.length ? '?' + params.join('&') : '');
    history.replaceState(null, '', hash);
  }
  function renderCard(language) {
    var href = '#language-map/' + encodeURIComponent(language.id);
    return '<a class="language-map-card" href="' + escapeHtml(href) + '" ' +
      'aria-label="Открыть анализ языка ' + escapeHtml(language.name) + '">' +
      '<span class="language-map-card-top">' +
      '<span class="language-map-code" aria-hidden="true">' + escapeHtml(languageCode(language.id)) + '</span>' +
      '<span class="language-map-family">' + escapeHtml(language.family || language.type) + '</span>' +
      davarDots(language.has_davar) +
      '</span>' +
      '<h2 class="language-map-name">' + escapeHtml(language.name) + '</h2>' +
      '<p class="language-map-notes">' + escapeHtml(language.notes) + '</p>' +
      '</a>';
  }

  function renderRow(language) {
    var href = '#language-map/' + encodeURIComponent(language.id);
    return '<a class="language-map-row" href="' + escapeHtml(href) + '" ' +
      'aria-label="Открыть анализ языка ' + escapeHtml(language.name) + '">' +
      '<span class="language-map-code" aria-hidden="true">' + escapeHtml(languageCode(language.id)) + '</span>' +
      '<span class="language-map-row-name">' + escapeHtml(language.name) + '</span>' +
      '<span class="language-map-family">' + escapeHtml(language.family || language.type) + '</span>' +
      davarDots(language.has_davar) +
      '</a>';
  }

  function resultsMarkup(languages) {
    if (!languages.length) {
      return '<div class="language-map-empty">' +
        '<span class="language-map-empty-glyph" aria-hidden="true">𐤋</span>' +
        '<p class="language-map-empty-text">По выбранным фильтрам языки не найдены.</p>' +
        '<button type="button" class="lab-btn lab-btn-secondary language-map-reset" id="language-map-reset">Сбросить фильтры</button>' +
        '</div>';
    }
    if (state.view === 'list') {
      return '<div class="language-map-list" role="list">' + languages.map(renderRow).join('') + '</div>';
    }
    return '<div class="language-map-grid" role="list">' + languages.map(renderCard).join('') + '</div>';
  }

  function populateTypeFilter(container) {
    var select = container.querySelector('#language-map-type');
    if (!select) return;
    var types = [];
    state.languages.forEach(function(language) {
      if (types.indexOf(language.type) === -1) types.push(language.type);
    });
    types.sort();
    select.innerHTML = '<option value="all">Все типы</option>' + types.map(function(type) {
      return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type.charAt(0).toUpperCase() + type.slice(1)) + '</option>';
    }).join('');
    var available = ['all'].concat(types);
    if (available.indexOf(state.type) === -1) state.type = 'all';
    select.value = state.type;
  }

  function getFilteredLanguages() {
    var query = normalize(state.query);
    return state.languages.filter(function(language) {
      return (!query || normalize(language.name).indexOf(query) !== -1 || normalize(language.type).indexOf(query) !== -1) &&
        (state.type === 'all' || normalize(language.type) === state.type) &&
        (state.davar === 'all' || normalize(language.has_davar) === state.davar);
    }).sort(function(left, right) {
      var result = String(left.name || '').localeCompare(String(right.name || ''), 'ru', { sensitivity: 'base' });
      return state.sort === 'desc' ? -result : result;
    });
  }

  function syncControls(container) {
    var query = container.querySelector('#language-map-query');
    if (query) query.value = state.query;
    var davar = container.querySelector('#language-map-davar');
    if (davar) davar.value = state.davar;
    var sort = container.querySelector('#language-map-sort');
    if (sort) sort.value = state.sort;
  }

  function applyView(container) {
    var buttons = container.querySelectorAll('.language-map-view-btn');
    Array.prototype.forEach.call(buttons, function(button) {
      var active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderResults(container) {
    var results = container.querySelector('#language-map-results');
    var count = container.querySelector('#language-map-count');
    if (!results || !count) return;
    var languages = getFilteredLanguages();
    results.innerHTML = resultsMarkup(languages);
    count.textContent = languages.length + ' из ' + state.languages.length;
  }
  function resetFilters(container) {
    state.query = '';
    state.type = 'all';
    state.davar = 'all';
    syncControls(container);
    var type = container.querySelector('#language-map-type');
    if (type) type.value = 'all';
    renderResults(container);
    updateHash();
  }

  function bindList(container) {
    var toolbar = container.querySelector('.language-map-toolbar');
    if (!toolbar || toolbar.dataset.bound === '1') return;

    var query = container.querySelector('#language-map-query');
    var type = container.querySelector('#language-map-type');
    var davar = container.querySelector('#language-map-davar');
    var sort = container.querySelector('#language-map-sort');

    if (query) query.addEventListener('input', function() {
      state.query = query.value;
      renderResults(container);
      updateHash();
    });
    if (type) type.addEventListener('change', function() {
      state.type = type.value;
      renderResults(container);
      updateHash();
    });
    if (davar) davar.addEventListener('change', function() {
      state.davar = davar.value;
      renderResults(container);
      updateHash();
    });
    if (sort) sort.addEventListener('change', function() {
      state.sort = sort.value;
      renderResults(container);
      updateHash();
    });

    var viewButtons = container.querySelectorAll('.language-map-view-btn');
    Array.prototype.forEach.call(viewButtons, function(button) {
      button.addEventListener('click', function() {
        if (state.view === button.dataset.view) return;
        state.view = button.dataset.view;
        saveStoredView(state.view);
        applyView(container);
        renderResults(container);
        updateHash();
      });
    });

    var results = container.querySelector('#language-map-results');
    if (results) results.addEventListener('click', function(event) {
      var reset = event.target.closest && event.target.closest('.language-map-reset');
      if (reset) {
        event.preventDefault();
        resetFilters(container);
      }
    });

    toolbar.dataset.bound = '1';
  }

  /* «/» фокусирует поиск модуля, пока открыт маршрут карты языков. */
  document.addEventListener('keydown', function(event) {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    var tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!window.LabRouter || window.LabRouter.current() !== 'language-map') return;
    var input = document.getElementById('language-map-query');
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.select();
  });
  function renderDetail(container, language) {
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('language-map', 'detail', {
        kicker: 'АЛЕФИ · КАРТА ЯЗЫКОВ',
        title: language.name,
        subtitle: language.type || '',
        icon: 'paleo/track.png'
      });
    }
    container.innerHTML = '<section class="language-map-detail" aria-labelledby="language-map-detail-title">' +
      '<p class="language-map-kicker">АНАЛИЗ ЯЗЫКА</p>' +
      '<h1 id="language-map-detail-title">' + escapeHtml(language.name) + '</h1>' +
      '<p class="language-map-detail-type">' + escapeHtml(language.type) + '</p>' +
      '<dl class="language-map-metrics language-map-detail-metrics">' +
      renderMetric('Давар', language.has_davar) +
      renderMetric('Переходы', language.has_transitions) +
      renderMetric('Близость к реальности', language.proximity_to_reality) +
      '</dl>' +
      '<p class="language-map-detail-notes">' + escapeHtml(language.notes) + '</p>' +
      '<p class="language-map-future">Полный анализ языка будет добавлен в следующем слое исследования.</p>' +
      '</section>';
  }

  function render(container, parsed) {
    var segments = (parsed && parsed.segments) || [];
    var language = segments[1] ? findLanguage(decodeURIComponent(segments[1])) : null;
    if (language) {
      renderDetail(container, language);
      return;
    }

    var params = (parsed && parsed.params) || {};
    if (params.view === 'list' || params.view === 'grid') state.view = params.view;
    else state.view = readStoredView();
    state.query = typeof params.q === 'string' ? params.q : '';
    if (params.type) state.type = params.type;
    if (params.davar) state.davar = params.davar;
    if (params.sort === 'asc' || params.sort === 'desc') state.sort = params.sort;

    container.innerHTML = state.markup;
    populateTypeFilter(container);
    syncControls(container);
    applyView(container);
    bindList(container);
    renderResults(container);
  }

  function init(container, parsed) {
    if (!container) return;
    Promise.all([fetchPage(), fetchData()])
      .then(function(results) {
        state.markup = results[0];
        state.languages = results[1];
        render(container, parsed || { segments: [] });
        container.dataset.loaded = '1';
      })
      .catch(function(error) {
        setError(container, error);
      });
  }

  window.LanguageMap = { init: init };
})(window, document);
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

  /* Фильтры живут в hash: деталь несёт тот же набор, поэтому возврат
     «К списку языков» восстанавливает выбор без потерь. */
  function filterParams() {
    var params = [];
    if (state.query) params.push('q=' + encodeURIComponent(state.query));
    if (state.type !== 'all') params.push('type=' + encodeURIComponent(state.type));
    if (state.davar !== 'all') params.push('davar=' + encodeURIComponent(state.davar));
    if (state.sort !== 'asc') params.push('sort=' + state.sort);
    if (state.view !== 'grid') params.push('view=' + state.view);
    return params;
  }

  function hashFor(path) {
    var params = filterParams();
    return '#language-map' + path + (params.length ? '?' + params.join('&') : '');
  }

  /* history.replaceState вместо LabRouter.navigate — иначе hashchange
     перерисовывает контейнер на каждое нажатие клавиши и сбивает фокус поиска. */
  function updateHash() {
    history.replaceState(null, '', hashFor(''));
  }

  function renderCard(language) {
    var href = hashFor('/' + encodeURIComponent(language.id));
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
    var href = hashFor('/' + encodeURIComponent(language.id));
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
  // ===== ДЕТАЛЬ ЯЗЫКА: ПАСПОРТ + СВЯЗИ =====
  /* Паспорт берёт только поля данных. Нет поля — dashed-строка
     «в исследовании»: карта не выдумывает свойства и связи за источник. */
  var PASSPORT_FIELDS = [
    { key: 'family', label: 'Семья' },
    { key: 'type', label: 'Ветвь' },
    { key: 'script', label: 'Письменность' },
    { key: 'region', label: 'Регион' }
  ];

  /* Легенда §6: точка несёт метку уверенности, текст строки — из данных. */
  var CONFIDENCE_TONES = [
    { pattern: /факт|провер|эмет/i, tone: 'fact' },
    { pattern: /интерпрет|рабочая версия|в работе/i, tone: 'interpretation' },
    { pattern: /гипотез|спорн|шекер/i, tone: 'hypothesis' },
    { pattern: /разруш|ошибк/i, tone: 'distortion' }
  ];

  var LAYERS_PATH = 'data/paleo-linguistics/languages.json';
  var RESEARCH_PATH = 'data/exposures/index.json';
  var relationsPromise = null;

  function confidenceTone(value) {
    for (var i = 0; i < CONFIDENCE_TONES.length; i++) {
      if (CONFIDENCE_TONES[i].pattern.test(value || '')) return CONFIDENCE_TONES[i].tone;
    }
    return 'neutral';
  }

  function fetchJson(path) {
    return fetch(assetUrl(path)).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + path);
      return response.json();
    });
  }

  /* Источники связей подтягиваются один раз за сессию. Недоступный источник
     не ломает экран: группа остаётся dashed-строкой «в исследовании». */
  function fetchRelations() {
    if (!relationsPromise) {
      relationsPromise = Promise.all([
        fetchJson(LAYERS_PATH).catch(function() { return []; }),
        fetchJson(RESEARCH_PATH).catch(function() { return []; })
      ]).then(function(results) {
        return {
          layers: Array.isArray(results[0]) ? results[0] : [],
          researches: Array.isArray(results[1]) ? results[1] : []
        };
      });
    }
    return relationsPromise;
  }

  /* Дверь в слой ставится только там, где данные её подтверждают (совпадение id). */
  function layerLinks(language, layers) {
    return (layers || []).filter(function(layer) { return layer && layer.id === language.id; });
  }

  function loadLayer(layer) {
    if (!layer || !layer.file) return Promise.resolve(null);
    return fetchJson('data/paleo-linguistics/' + layer.file).catch(function() { return null; });
  }

  /* Упоминание языка в исследовании: заголовок, аннотация, теги. */
  function mentionsLanguage(item, name) {
    var needle = normalize(name).replace(/\([^)]*\)/g, '').trim();
    if (needle.length < 4) return false;
    var haystack = [item.title, item.summary, (item.tags || []).join(' ')].join(' ').toLowerCase();
    return haystack.indexOf(needle) !== -1;
  }

  function relationGroup(label, links) {
    var body = links.length
      ? links.map(function(link) {
        return '<a class="language-map-chip" href="' + escapeHtml(link.href) + '"' +
          (link.hint ? ' title="' + escapeHtml(link.hint) + '"' : '') + '>' + escapeHtml(link.label) + '</a>';
      }).join('')
      : '<span class="language-map-relation-empty">в исследовании</span>';
    return '<div class="language-map-relation-row' + (links.length ? '' : ' is-dashed') + '">' +
      '<span class="language-map-relation-label">' + escapeHtml(label) + '</span>' +
      '<span class="language-map-relation-links">' + body + '</span>' +
      '</div>';
  }

  function relationsMarkup(language, layerData, researches) {
    var layers = (layerData || []).filter(Boolean);
    var mentions = (researches || []).filter(function(item) { return mentionsLanguage(item, language.name); });
    return relationGroup('Таймлайн-слои', layers.map(function(layer) {
      return { href: '#paleo-linguistics/' + encodeURIComponent(layer.id), label: layer.name || layer.id, hint: layer.period || '' };
    })) + relationGroup('Исследования', mentions.map(function(item) {
      return { href: '#researches/case/' + encodeURIComponent(item.slug), label: item.title || item.slug, hint: item.category || '' };
    }));
  }

  /* Связи приходят после первого рендера: экран сразу показывает dashed-строки,
     чипы подставляются, если панель всё ещё на экране. */
  function fillRelations(container, language) {
    var host = container.querySelector('[data-language-map-relations]');
    if (!host) return;
    fetchRelations().then(function(data) {
      if (!host.isConnected) return;
      var layers = layerLinks(language, data.layers);
      Promise.all(layers.map(loadLayer)).then(function(layerData) {
        if (!host.isConnected) return;
        host.innerHTML = relationsMarkup(language, layerData, data.researches);
      });
    });
  }

  function passportRow(label, value) {
    var empty = !value;
    return '<div class="language-map-passport-row' + (empty ? ' is-dashed' : '') + '">' +
      '<dt class="language-map-passport-label">' + escapeHtml(label) + '</dt>' +
      '<dd class="language-map-passport-value">' + (empty ? 'в исследовании' : escapeHtml(value)) + '</dd>' +
      '</div>';
  }

  function passportStatusRow(language) {
    if (!language.confidence) return passportRow('Статус', '');
    var tone = confidenceTone(language.confidence);
    return '<div class="language-map-passport-row">' +
      '<dt class="language-map-passport-label">Статус</dt>' +
      '<dd class="language-map-passport-value">' +
      '<span class="language-map-status-dot language-map-status-dot--' + tone + '" role="img" ' +
      'aria-label="Метка уверенности: ' + escapeHtml(language.confidence) + '" title="' + escapeHtml(language.confidence) + '"></span>' +
      escapeHtml(language.confidence) +
      '</dd></div>';
  }

  function detailHeroConfig(language, id) {
    return {
      kicker: 'АЛЕФИ · КАРТА ЯЗЫКОВ · ' + String(id || '').toUpperCase(),
      title: language ? language.name : 'Язык не найден',
      subtitle: (language && (language.type || language.notes)) || '',
      icon: 'paleo/track.png'
    };
  }

  function renderDetail(container, language, id) {
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('language-map', 'detail', detailHeroConfig(language, id || language.id));
    }
    var code = String(id || language.id).toUpperCase();
    container.innerHTML = '<section class="language-map-detail" aria-labelledby="language-map-detail-title">' +
      '<p class="language-map-kicker">ПАСПОРТ ЯЗЫКА · ' + escapeHtml(code) + '</p>' +
      '<h1 id="language-map-detail-title">' + escapeHtml(language.name) + '</h1>' +
      '<p class="language-map-detail-type">' + escapeHtml(language.type || '') + '</p>' +
      '<p class="language-map-detail-notes">' + escapeHtml(language.notes || '') + '</p>' +
      '<div class="lab-panel-row language-map-detail-panels">' +
      '<section class="lab-panel" aria-labelledby="language-map-passport-title">' +
      '<div class="lab-chapter"><span class="lab-chapter-num">01</span>' +
      '<h2 class="lab-chapter-title" id="language-map-passport-title">Паспорт</h2></div>' +
      '<dl class="language-map-passport-rows">' +
      PASSPORT_FIELDS.map(function(field) { return passportRow(field.label, language[field.key]); }).join('') +
      passportStatusRow(language) +
      '</dl>' +
      '<dl class="language-map-metrics language-map-detail-metrics">' +
      renderMetric('Давар', language.has_davar) +
      renderMetric('Переходы', language.has_transitions) +
      renderMetric('Близость к реальности', language.proximity_to_reality) +
      '</dl>' +
      '</section>' +
      '<section class="lab-panel" aria-labelledby="language-map-relations-title">' +
      '<div class="lab-chapter"><span class="lab-chapter-num">02</span>' +
      '<h2 class="lab-chapter-title" id="language-map-relations-title">Связи</h2></div>' +
      '<div class="language-map-relation-rows" data-language-map-relations>' +
      relationsMarkup(language, null, null) +
      '</div>' +
      '</section>' +
      '</div>' +
      '<p class="language-map-detail-back"><a class="lab-btn lab-btn-secondary" href="' +
      escapeHtml(hashFor('')) + '">К списку языков</a></p>' +
      '</section>';
    fillRelations(container, language);
  }

  /* Fallback параметризованного маршрута: служебных деталей наружу нет. */
  function renderNotFound(container, id) {
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('language-map', 'detail', detailHeroConfig(null, id));
    }
    container.innerHTML = '<section class="language-map-detail" aria-labelledby="language-map-detail-title">' +
      '<p class="language-map-kicker">ПАСПОРТ ЯЗЫКА · ' + escapeHtml(String(id).toUpperCase()) + '</p>' +
      '<h1 id="language-map-detail-title">Язык не найден</h1>' +
      '<div class="language-map-not-found is-dashed">' +
      '<p class="language-map-not-found-text">В карте языков нет записи с кодом «' + escapeHtml(id) + '».</p>' +
      '<a class="lab-btn lab-btn-secondary" href="' + escapeHtml(hashFor('')) + '">К списку языков</a>' +
      '</div>' +
      '</section>';
  }

  /* Параметры hash — источник истины и для списка, и для детали: деталь несёт
     те же фильтры, поэтому «К списку языков» не теряет выбор. */
  function readFilters(parsed) {
    var params = (parsed && parsed.params) || {};
    state.query = typeof params.q === 'string' ? params.q : '';
    state.type = params.type || 'all';
    state.davar = params.davar || 'all';
    state.sort = params.sort === 'desc' ? 'desc' : 'asc';
  }

  function readView(parsed) {
    var params = (parsed && parsed.params) || {};
    if (params.view === 'list' || params.view === 'grid') state.view = params.view;
    else state.view = readStoredView();
  }

  function render(container, parsed) {
    var segments = (parsed && parsed.segments) || [];
    readFilters(parsed);
    var detailId = segments[1] ? decodeURIComponent(segments[1]) : '';
    if (detailId) {
      var language = findLanguage(detailId);
      if (language) renderDetail(container, language, detailId);
      else renderNotFound(container, detailId);
      return;
    }

    readView(parsed);
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
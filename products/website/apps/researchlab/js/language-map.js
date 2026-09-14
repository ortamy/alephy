/**
 * Карта языков — диагностика живых языков через палео-механику.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/language-map.html';
  var DATA_PATH = 'data/language-map/languages.json';
  var pagePromise = null;
  var dataPromise = null;
  var state = { markup: '', languages: [], sort: 'asc' };

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

  /* Временные заглушки вместо паков иконок: флаги основных стран языка.
     Языки без общепризнанного флага получают глобус (fallback). */
  var LANGUAGE_EMOJI = {
    russian: '🇷🇺', english: '🇬🇧', german: '🇩🇪', arabic: '🇸🇦', hebrew: '🇮🇱',
    'modern-hebrew': '🇮🇱', turkish: '🇹🇷', kazakh: '🇰🇿', spanish: '🇪🇸', french: '🇫🇷',
    chinese: '🇨🇳', japanese: '🇯🇵', korean: '🇰🇷', persian: '🇮🇷', ukrainian: '🇺🇦',
    polish: '🇵🇱', indonesian: '🇮🇩', finnish: '🇫🇮', hungarian: '🇭🇺', georgian: '🇬🇪',
    hindi: '🇮🇳', bengali: '🇧🇩', swahili: '🇰🇪', vietnamese: '🇻🇳', thai: '🇹🇭',
    italian: '🇮🇹', portuguese: '🇵🇹', dutch: '🇳🇱', swedish: '🇸🇪', czech: '🇨🇿',
    bulgarian: '🇧🇬', lithuanian: '🇱🇹', armenian: '🇦🇲', estonian: '🇪🇪', azerbaijani: '🇦🇿',
    amharic: '🇪🇹', yoruba: '🇳🇬', tamil: '🇮🇳', burmese: '🇲🇲', maori: '🇳🇿',
    greek: '🇬🇷', norwegian: '🇳🇴', danish: '🇩🇰', icelandic: '🇮🇸', serbian: '🇷🇸',
    croatian: '🇭🇷', slovak: '🇸🇰', romanian: '🇷🇴', latvian: '🇱🇻', uzbek: '🇺🇿',
    kyrgyz: '🇰🇬', malay: '🇲🇾', khmer: '🇰🇭', lao: '🇱🇦', telugu: '🇮🇳',
    mongolian: '🇲🇳', zulu: '🇿🇦', hausa: '🇳🇬', quechua: '🇵🇪', maltese: '🇲🇹',
    irish: '🇮🇪', cantonese: '🇭🇰', filipino: '🇵🇭', somali: '🇸🇴', tajik: '🇹🇯',
    nepali: '🇳🇵', igbo: '🇳🇬', albanian: '🇦🇱', urdu: '🇵🇰', kannada: '🇮🇳',
    sinhala: '🇱🇰', javanese: '🇮🇩', lingala: '🇨🇩', aymara: '🇧🇴', guarani: '🇵🇾'
  };
  function cardEmoji(id) {
    return LANGUAGE_EMOJI[id] || '🌐';
  }

  function renderCard(language) {
    var id = escapeHtml(language.id);
    return '<article class="language-map-card" role="button" tabindex="0" data-language-id="' + id + '" ' +
      'aria-label="Открыть анализ языка ' + escapeHtml(language.name) + '">' +
      '<span class="language-map-card-emoji" aria-hidden="true">' + cardEmoji(language.id) + '</span>' +
      '<div class="language-map-card-head">' +
      '<h2>' + escapeHtml(language.name) + '</h2>' +
      '<span class="language-map-type">' + escapeHtml(language.type) + '</span>' +
      '</div>' +
      '<p class="language-map-notes">' + escapeHtml(language.notes) + '</p>' +
      '</article>';
  }

  function populateTypeFilter(container) {
    var select = container.querySelector('#language-map-type');
    if (!select || select.dataset.ready === '1') return;
    var types = [];
    state.languages.forEach(function(language) {
      if (types.indexOf(language.type) === -1) types.push(language.type);
    });
    types.sort();
    select.innerHTML = '<option value="all">Все типы</option>' + types.map(function(type) {
      return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type.charAt(0).toUpperCase() + type.slice(1)) + '</option>';
    }).join('');
    select.dataset.ready = '1';
  }

  function getFilteredLanguages(container) {
    var type = normalize((container.querySelector('#language-map-type') || {}).value || 'all');
    var davar = normalize((container.querySelector('#language-map-davar') || {}).value || 'all');
    var sort = (container.querySelector('#language-map-sort') || {}).value || state.sort;
    var query = normalize((container.querySelector('#language-map-query') || {}).value || '');
    state.sort = sort;
    return state.languages.filter(function(language) {
      return (!query || normalize(language.name).indexOf(query) !== -1 || normalize(language.type).indexOf(query) !== -1) &&
        (type === 'all' || normalize(language.type) === type) &&
        (davar === 'all' || normalize(language.has_davar) === davar);
    }).sort(function(left, right) {
      var result = String(left.name || '').localeCompare(String(right.name || ''), 'ru', { sensitivity: 'base' });
      return sort === 'desc' ? -result : result;
    });
  }

  function renderCards(container) {
    var grid = container.querySelector('#language-map-grid');
    var empty = container.querySelector('#language-map-empty');
    var count = container.querySelector('#language-map-count');
    if (!grid || !empty || !count) return;
    var languages = getFilteredLanguages(container);
    grid.innerHTML = languages.map(renderCard).join('');
    empty.hidden = languages.length !== 0;
    count.textContent = 'Показано языков: ' + languages.length + ' из ' + state.languages.length;
  }

  function openLanguage(id, container) {
    var language = findLanguage(id);
    if (!language) return;
    if (window.LabRouter) window.LabRouter.navigate('language-map', [id]);
    if (container) renderDetail(container, language);
  }

  function bindList(container) {
    var grid = container.querySelector('#language-map-grid');
    var type = container.querySelector('#language-map-type');
    var davar = container.querySelector('#language-map-davar');
    var sort = container.querySelector('#language-map-sort');
    var query = container.querySelector('#language-map-query');
    if (!grid || grid.dataset.bound === '1') return;

    grid.addEventListener('click', function(event) {
      var card = event.target.closest('.language-map-card');
      if (card) openLanguage(card.dataset.languageId, container);
    });
    grid.addEventListener('keydown', function(event) {
      var card = event.target.closest('.language-map-card');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openLanguage(card.dataset.languageId, container);
      }
    });
    if (type) type.addEventListener('change', function() { renderCards(container); });
    if (davar) davar.addEventListener('change', function() { renderCards(container); });
    if (sort) sort.addEventListener('change', function() { renderCards(container); });
    if (query) query.addEventListener('input', function() { renderCards(container); });
    grid.dataset.bound = '1';
  }

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
      '<div id="language-map-detail-title">' + escapeHtml(language.name) + '</div>' +
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
    var language = parsed && parsed.segments && parsed.segments[1] ? findLanguage(parsed.segments[1]) : null;
    if (language) {
      renderDetail(container, language);
      return;
    }
    container.innerHTML = state.markup;
    populateTypeFilter(container);
    bindList(container);
    renderCards(container);
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

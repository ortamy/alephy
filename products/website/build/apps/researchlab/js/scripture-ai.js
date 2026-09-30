// Scripture AI: структурированный разбор палео-фрагмента для #scripture-reader.
//
// Модуль не знает про разметку стиха: разбор он берёт у ScriptureReader.currentEvidence().
// Ответ приходит слотами (факт / интерпретация / гипотеза / предупреждения / уверенность) —
// контракт зафиксирован в ADR-006, серверная часть products/agents/pipelines/scripture_analysis.py.
(function(window, document) {
  'use strict';

  // Хост и порт берём из настроек панели «Запуск сервера»: единственный агентный
  // сервер — products/agents/server.py, хардкод адреса здесь означал бы второй.
  var SERVER_KEY = 'alephy_agent_server_v2';
  var SERVER_DEFAULTS = { host: '127.0.0.1', port: 5000 };
  var CACHE_KEY = 'alephy_scripture_ai_cache_v1';
  var MAX_CACHE = 40;

  var state = { pending: false, key: '', result: null };

  function get(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(value)
      : String(value == null ? '' : value);
  }

  function baseUrl() {
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(SERVER_KEY) || '{}') || {};
    } catch (error) {
      saved = {};
    }
    var host = String(saved.host || SERVER_DEFAULTS.host).trim() || SERVER_DEFAULTS.host;
    var port = String(saved.port || SERVER_DEFAULTS.port).trim() || SERVER_DEFAULTS.port;
    return 'http://' + host + ':' + port;
  }

  function evidence() {
    return window.ScriptureReader && window.ScriptureReader.currentEvidence
      ? window.ScriptureReader.currentEvidence()
      : null;
  }

  // Ключ кэша: тот же фрагмент в том же стихе даёт тот же разбор.
  function cacheKeyFor(item) {
    if (!item) return '';
    return [item.book, item.chapter || 1, item.verse, item.mode, item.paleo].join('|');
  }

  function readCache() {
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function writeCache(key, value) {
    try {
      var cache = readCache();
      cache[key] = value;
      var keys = Object.keys(cache);
      if (keys.length > MAX_CACHE) {
        keys.slice(0, keys.length - MAX_CACHE).forEach(function(item) { delete cache[item]; });
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      // Приватный режим: разбор просто не запомнится между сессиями.
    }
  }

  function setStatus(text, tone) {
    var node = get('sr-ai-status');
    if (!node) return;
    node.textContent = text;
    node.dataset.tone = tone || 'idle';
  }

  function toggle(node, visible) {
    if (node) node.hidden = !visible;
  }


  function slotMarkup(label, text, extraClass) {
    if (!text) return '';
    return '<div class="sr-slot ' + (extraClass || '') + '">' +
      '<p class="sr-slot-label">' + escapeHtml(label) + '</p><p>' + escapeHtml(text) + '</p></div>';
  }

  function renderResult(result) {
    var host = get('sr-ai-out');
    if (!host) return;
    var slots = result.slots || {};
    var facts = result.facts || {};
    var html = '';

    // Локальный факт печатается первым и не зависит от модели: он остаётся
    // даже когда сервер вернул только ошибку (§9 — офлайн-фолбэк).
    if (facts.root) {
      html += '<div class="sr-slot"><p class="sr-slot-label">Корень (локально)</p><p>' +
        escapeHtml(facts.root) + (facts.rootMeaning ? ' — ' + escapeHtml(facts.rootMeaning) : '') + '</p></div>';
    }
    if (facts.assembly) {
      html += '<div class="sr-slot"><p class="sr-slot-label">Сборка-действие (локально)</p><p>' +
        escapeHtml(facts.assembly) + '</p></div>';
    }
    html += slotMarkup('Факт', slots.fact);
    html += slotMarkup('Интерпретация', slots.interpretation);
    // Гипотеза всегда с оговоркой: её нельзя выдавать за установленный смысл (§11).
    var hypothesis = slotMarkup('Гипотеза', slots.hypothesis, 'sr-slot--hypothesis');
    if (hypothesis) {
      hypothesis = hypothesis.replace('</p></div>', '</p><p class="sr-caveat">Гипотеза чтения, а не установленный смысл.</p></div>');
    }
    html += hypothesis;

    if (slots.warnings && slots.warnings.length) {
      html += '<div class="sr-slot"><p class="sr-slot-label">Предупреждения</p><ul class="sr-warnings">' +
        slots.warnings.map(function(item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul></div>';
    }
    host.innerHTML = html;

    var badge = get('sr-ai-confidence');
    if (badge) {
      var level = slots.confidence || '';
      badge.innerHTML = level
        ? '<span class="sr-confidence sr-confidence--' + escapeHtml(level) + '">Уверенность: ' + escapeHtml(level) + '</span>'
        : '';
    }
  }

  function ask(force) {
    if (state.pending) return;
    var item = evidence();
    if (!item || !item.paleo) {
      setStatus('Сначала выберите слово или буквы палео-текста.', 'error');
      return;
    }
    var key = cacheKeyFor(item);
    if (!force && key && readCache()[key]) {
      state.result = readCache()[key];
      state.key = key;
      renderResult(state.result);
      setStatus('Показан сохранённый разбор. Повторный запрос — кнопкой «Повторить».', 'idle');
      return;
    }

    state.pending = true;
    toggle(get('sr-ai-run'), false);
    toggle(get('sr-ai-copy'), false);
    toggle(get('sr-ai-retry'), false);
    setStatus('Эд читает фрагмент…', 'busy');

    fetch(baseUrl() + '/api/scripture/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paleo: item.paleo,
        hebrew: item.hebrew,
        translit: item.translit,
        assembly: item.assembly,
        letters: item.letters,
        book: item.bookRu || item.book,
        verse: item.chapter + ':' + item.verse,
        verseFunction: item.verseFunction
      })
    }).then(function(response) {
      if (!response.ok) throw new Error('Сервер ответил ' + response.status);
      return response.json();
    }).then(function(result) {
      state.pending = false;
      state.result = result;
      state.key = key;
      renderResult(result);
      if (result.modelAvailable) {
        if (key) writeCache(key, result);
        setStatus('Разбор готов. Факт отделён от интерпретации и гипотезы.', 'idle');
        toggle(get('sr-ai-copy'), true);
      } else {
        // Модель недоступна, но локальные факты уже напечатаны — это не сбой чтения.
        setStatus('Локальный разбор показан. Модель недоступна: ' +
          (result.modelError || 'сервер не ответил') + '. Повторить — кнопкой ниже.', 'error');
        toggle(get('sr-ai-retry'), true);
      }
      toggle(get('sr-ai-run'), true);
    }).catch(function(error) {
      state.pending = false;
      setStatus('Не удалось получить разбор: ' + error.message + ' Локальный разбор слова остаётся доступен.', 'error');
      toggle(get('sr-ai-retry'), true);
      toggle(get('sr-ai-run'), true);
    });
  }


  function copy() {
    var result = state.result;
    if (!result) return;
    var slots = result.slots || {};
    var text = [
      'Корень: ' + ((result.facts && result.facts.root) || '—'),
      'Сборка-действие: ' + ((result.facts && result.facts.assembly) || '—'),
      'Факт: ' + (slots.fact || '—'),
      'Интерпретация: ' + (slots.interpretation || '—'),
      'Гипотеза: ' + (slots.hypothesis || '—'),
      'Предупреждения: ' + ((slots.warnings || []).join('; ') || '—'),
      'Уверенность модели: ' + (slots.confidence || '—')
    ].join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        if (typeof LabToast !== 'undefined') LabToast.show('Разбор скопирован в буфер обмена.');
      });
      return;
    }
    if (typeof LabToast !== 'undefined') LabToast.show('Копирование недоступно в этом браузере.');
  }

  // Сброс при смене стиха или экрана: ответ относится к прежнему фрагменту.
  function reset() {
    state.pending = false;
    state.result = null;
    state.key = '';
    var host = get('sr-ai-out');
    if (host) host.innerHTML = '';
    var badge = get('sr-ai-confidence');
    if (badge) badge.innerHTML = '';
    toggle(get('sr-ai-copy'), false);
    toggle(get('sr-ai-retry'), false);
    setStatus('Локальный разбор доступен без сервера.', 'idle');
  }

  // Ответ для конкретного фрагмента — модуль чтения кладёт его в свидетельство.
  function lastFor(item) {
    if (!state.result || !item) return null;
    var key = cacheKeyFor(item);
    if (!key || key !== state.key) return null;
    var slots = state.result.slots || {};
    return {
      confidence: slots.confidence || 'low',
      fact: slots.fact || '',
      interpretation: slots.interpretation || '',
      hypothesis: slots.hypothesis || '',
      warnings: slots.warnings || [],
      model: state.result.model || ''
    };
  }

  // Смена выделения инвалидирует ответ, но кэш по ключу сохраняется.
  function invalidate() {
    var item = evidence();
    if (!item || !item.paleo || cacheKeyFor(item) === state.key) return;
    reset();
  }

  window.ScriptureAI = {
    ask: ask,
    copy: copy,
    reset: reset,
    invalidate: invalidate,
    lastFor: lastFor
  };
})(window, document);

/**
 * timescale-generator.js — «Генератор шкалы времени»: конструктор диапазона,
 * лент и шага оси по языку таймлайнов (sortKey, deep-link #timeline/<id>/event/<i>).
 * Данные: data/timeline.json. Состояние маршрута — в hash (?from=&to=&tapes=&step=).
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/timescale-generator.html';
  var DATA_PATH = 'data/timeline.json';
  var STORAGE_KEY = 'alephy_timescale_history';
  var HISTORY_LIMIT = 5;
  var STEP_OPTIONS = [1000, 100, 50];
  var WINDOW_LIMIT = 20;

  var pagePromise = null;
  var dom = {};
  var store = { tapes: null };
  var state = {
    from: -3000,
    to: -100,
    tapes: [],
    step: 100,
    limit: WINDOW_LIMIT,
    selected: null,
    data: [],
    dataError: false,
    loaded: false
  };
  var history = [];

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
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

  function loadData() {
    if (store.tapes) return Promise.resolve(store.tapes);
    return fetch(DATA_PATH).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function(tapes) {
      store.tapes = Array.isArray(tapes) ? tapes : [];
      return store.tapes;
    });
  }

  // ===== Диапазон: годы до н.э. — отрицательные =====
  function parseYear(value) {
    if (value == null) return null;
    var text = String(value).replace(/[«»"\s]/g, '').replace('−', '-');
    if (/э$/.test(text.replace(/[^а-яa-z-]/gi, ''))) {
      var sign = /\bдо\b/i.test(text) ? -1 : 1;
      var digits = text.replace(/[^0-9-]/g, '');
      var year = parseInt(digits, 10);
      if (isNaN(year)) return null;
      return sign < 0 && year > 0 ? -year : year;
    }
    var direct = parseInt(text, 10);
    return isNaN(direct) ? null : direct;
  }

  function yearLabel(year) {
    return year < 0
      ? t('lab.timescaleGenerator.yearBce', '{n} до н.э.').replace('{n}', String(-year))
      : String(year);
  }

  function readRange() {
    if (!dom.fromInput || !dom.toInput) return null;
    var from = parseYear(dom.fromInput.value);
    var to = parseYear(dom.toInput.value);
    if (from == null || to == null) return null;
    return from <= to ? { from: from, to: to } : { from: to, to: from };
  }

  // ===== Состояние в hash (?from=&to=&tapes=&step=) =====
  function readHash() {
    var hash = window.location.hash || '';
    var queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return null;
    var params = {};
    hash.substring(queryIndex + 1).split('&').forEach(function(pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      var key = eq === -1 ? pair : pair.substring(0, eq);
      var value = eq === -1 ? '' : pair.substring(eq + 1);
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
  }

  function applyHashParams(params) {
    if (!params) return;
    var from = parseYear(params.from);
    var to = parseYear(params.to);
    if (from != null && to != null) {
      state.from = Math.min(from, to);
      state.to = Math.max(from, to);
    }
    var step = parseInt(params.step, 10);
    if (STEP_OPTIONS.indexOf(step) !== -1) state.step = step;
    if (params.tapes) state.tapes = params.tapes.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  }

  function syncHash() {
    var base = '#timescale-generator';
    var query = '?from=' + state.from + '&to=' + state.to + '&tapes=' + state.tapes.map(encodeURIComponent).join(',') + '&step=' + state.step;
    if (window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', base + query); } catch (error) { /* ignore */ }
    }
  }

  // ===== Ленты: участвуют только датированные (есть sortKey) =====
  function tapeMeta(tape) {
    var events = tape.events || [];
    var dated = events.filter(function(ev) { return typeof ev.sortKey === 'number'; });
    return { events: events, dated: dated.length === events.length && events.length > 0 };
  }

  function renderTapes() {
    if (!dom.tapesBox) return;
    dom.tapesBox.innerHTML = store.tapes.map(function(tape) {
      var meta = tapeMeta(tape);
      var active = state.tapes.indexOf(tape.id) !== -1;
      var extra = meta.dated ? '' : ' ts-tape-chip--undated';
      return '<button type="button" class="lab-example-chip ts-tape-chip' +
        (active ? ' is-active' : '') + extra + '" data-ts-tape="' + esc(tape.id) + '"' +
        ' aria-pressed="' + (active ? 'true' : 'false') + '"' +
        (meta.dated ? '' : ' title="' + esc(t('lab.timescaleGenerator.undatedTitle', 'Без дат')) + '"') + '>' +
        esc(tape.title || tape.id) + '</button>';
    }).join('') +
    '<span class="ts-tape-hint">' + esc(t('lab.timescaleGenerator.undatedHint', 'без дат')) + '</span>';
  }

  function collectWindow() {
    var active = store.tapes.filter(function(tape) {
      return state.tapes.indexOf(tape.id) !== -1 && tapeMeta(tape).dated;
    });
    var rows = [];
    active.forEach(function(tape) {
      (tape.events || []).forEach(function(ev, index) {
        if (typeof ev.sortKey !== 'number') return;
        if (ev.sortKey < state.from || ev.sortKey > state.to) return;
        rows.push({ tape: tape, index: index, ev: ev });
      });
    });
    rows.sort(function(a, b) { return a.ev.sortKey - b.ev.sortKey; });
    return rows;
  }

  // ===== Тики оси по шагу =====
  function axisTicks(from, to, step) {
    if (to <= from || step <= 0) return [];
    var first = (Math.ceil(from / step) * step);
    if (first <= from) first += step;
    var ticks = [];
    for (var year = first; year < to && ticks.length < 60; year += step) ticks.push(year);
    return ticks;
  }

  function posOf(year, from, to) {
    if (to <= from) return 0;
    return Math.max(0, Math.min(100, (year - from) / (to - from) * 100));
  }

  // ===== Шкала: узлы и кластеры =====
  function renderAxis(rows) {
    if (!dom.axis) return;
    if (!rows.length || state.to <= state.from) {
      dom.axis.innerHTML = emptyState(t('lab.timescaleGenerator.emptyWindow', 'Событий нет'));
      return;
    }
    var step = state.step > 0 ? state.step : 100;
    var ticks = state.step <= 0 ? [] : axisTicks(state.from, state.to, step);
    var span = state.to - state.from;
    var html = '<div class="ts-axis-line"></div>';
    ticks.forEach(function(year) {
      html += '<span class="ts-tick" style="left:' + posOf(year, state.from, state.to) + '%"></span>' +
        '<span class="ts-tick-label" style="left:' + posOf(year, state.from, state.to) + '%">' +
        esc(shortYear(year)) + '</span>';
    });

    var minGap = span / 36;
    var cluster = [];
    var painted = [];
    function flushCluster() {
      if (!cluster.length) return;
      if (cluster.length === 1) {
        painted.push(nodeHtml(cluster[0], false, false));
      } else if (cluster.length === 2) {
        painted.push(nodeHtml(cluster[0], false, false));
        painted.push(nodeHtml(cluster[1], true, false));
      } else {
        painted.push(clusterHtml(cluster));
      }
      cluster = [];
    }

    rows.forEach(function(row) {
      if (cluster.length && row.ev.sortKey - cluster[cluster.length - 1].ev.sortKey >= minGap) flushCluster();
      cluster.push(row);
    });
    flushCluster();
    dom.axis.innerHTML = html + painted.join('');
  }

  function shortYear(year) {
    return year < 0 ? String(-year) : String(year);
  }

  function nodeLabel(row) {
    return (row.ev.title || '') + ' — ' + (row.ev.date || yearLabel(row.ev.sortKey)) +
      ' · ' + (row.tape.title || row.tape.id);
  }

  function eventHref(row) {
    return '#timeline/' + row.tape.id + '/event/' + row.index;
  }

  // Клик по узлу = deep-link #timeline/<id>/event/<i>.
  function nodeHtml(row, offset) {
    var selected = state.selected &&
      state.selected.tape === row.tape.id && state.selected.index === row.index;
    return '<button type="button" class="ts-node' + (selected ? ' is-selected' : '') + '"' +
      ' style="left:' + posOf(row.ev.sortKey, state.from, state.to) + '%;' +
      (offset ? ' margin-left:7px;' : '') + '"' +
      ' data-ts-node="' + esc(row.tape.id) + ':' + row.index + '"' +
      ' title="' + esc(nodeLabel(row)) + '" aria-label="' + esc(nodeLabel(row)) + '"></button>';
  }

  function clusterHtml(cluster) {
    var first = cluster[0];
    var last = cluster[cluster.length - 1];
    var mid = (first.ev.sortKey + last.ev.sortKey) / 2;
    return '<button type="button" class="ts-cluster"' +
      ' style="left:' + posOf(mid, state.from, state.to) + '%"' +
      ' data-ts-cluster="' + first.ev.sortKey + ':' + last.ev.sortKey + '"' +
      ' title="' + esc(clusterHint(cluster)) + '" aria-label="' + esc(clusterHint(cluster)) + '">' +
      esc(t('lab.timescaleGenerator.clusterLabel', '{n} событий').replace('{n}', String(cluster.length))) +
      '</button>';
  }

  function clusterHint(cluster) {
    var titles = cluster.slice(0, 3).map(function(row) { return row.ev.title || ''; }).filter(Boolean);
    return t('lab.timescaleGenerator.clusterHint', 'Сузить диапазон: {names}').replace('{names}', titles.join('; '));
  }

  // ===== События в окне: строки + load-more =====
  function renderWindow(rows) {
    if (!dom.windowBox) return;
    var shown = rows.slice(0, state.limit);
    dom.windowBox.innerHTML = shown.map(function(row) {
      return '<button type="button" class="ts-row" data-ts-row="' + esc(row.tape.id) + ':' + row.index + '">' +
        '<span class="ts-row-date">' + esc(yearLabel(row.ev.sortKey)) + '</span>' +
        '<span class="ts-row-name">' + esc(row.ev.title || '') + '</span>' +
        '<span class="ts-row-tape">' + esc(row.tape.title || row.tape.id) + '</span>' +
        '</button>';
    }).join('');
    if (dom.windowCount) {
      dom.windowCount.textContent = rows.length
        ? (shown.length + ' / ' + rows.length)
        : t('lab.timescaleGenerator.emptyCount', '0');
    }
    if (dom.moreButton) dom.moreButton.hidden = rows.length <= state.limit;
  }

  function setBadge(kind) {
    if (!dom.badge) return;
    var meta = {
      empty: { className: 'wb-badge', label: t('lab.timescaleGenerator.badgeEmpty', 'Ожидание') },
      running: { className: 'wb-badge is-running', label: t('lab.timescaleGenerator.badgeRunning', 'Загрузка') },
      success: { className: 'wb-badge is-done', label: t('lab.timescaleGenerator.badgeSuccess', 'Готово') },
      error: { className: 'wb-badge is-error', label: t('lab.timescaleGenerator.badgeError', 'Ошибка') }
    }[kind] || { className: 'wb-badge', label: '' };
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
      '<span class="lab-empty-glyph" aria-hidden="true">𐤗</span>' +
      '<p class="lab-empty-hint">' + esc(hint) + '</p></div>';
  }

  // ===== Рендер-кадр: шкала + окно + действия + состояние в hash =====
  function render(caller) {
    if (state.dataError) {
      if (dom.axis) dom.axis.innerHTML = '<div class="lab-alert lab-alert-error" role="alert">' +
        esc(t('lab.timescaleGenerator.errorData', 'Ленты недоступны — проверьте доступ к data/.')) + '</div>';
      return;
    }
    var rows = collectWindow();
    renderAxis(rows);
    renderWindow(rows);
    updateActions(rows);
    setBadge(rows.length ? 'success' : 'empty');
    syncHash();
    if (caller !== 'hash' && rows.length) remember();
  }

  function updateActions(rows) {
    var enabled = rows.length > 0;
    Array.prototype.forEach.call(dom.actions || [], function(button) {
      button.disabled = !enabled;
    });
  }

  // ===== История: 5 последних шкал =====
  function readHistory() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(function(item) {
        return item && typeof item.from === 'number' && typeof item.to === 'number' && Array.isArray(item.tapes);
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

  function remember() {
    var entry = { from: state.from, to: state.to, tapes: state.tapes.slice(), step: state.step, createdAt: Date.now() };
    history = history.filter(function(item) {
      return !(item.from === entry.from && item.to === entry.to &&
        item.tapes.join(',') === entry.tapes.join(',') && item.step === entry.step);
    });
    history.unshift(entry);
    history = history.slice(0, HISTORY_LIMIT);
    saveHistory(history);
    renderSaved();
  }

  function renderSaved() {
    if (!dom.saved) return;
    if (!history.length) {
      dom.saved.innerHTML = emptyState(t('lab.timescaleGenerator.savedEmpty', 'Сохранённых шкал пока нет.'));
      return;
    }
    dom.saved.innerHTML = history.map(function(item, index) {
      var tapesCount = t('lab.timescaleGenerator.savedTapes', 'лент: {n}').replace('{n}', String(item.tapes.length));
      return '<div class="ts-saved-row">' +
        '<button type="button" class="ts-saved-open" data-ts-saved="' + index + '"' +
        ' title="' + esc(t('lab.timescaleGenerator.savedReopen', 'Открыть')) + '">' +
        esc(yearLabel(item.from) + ' … ' + yearLabel(item.to)) + '</button>' +
        '<span class="ts-saved-meta">' + esc(tapesCount + ' · ' + formatTime(item.createdAt)) + '</span>' +
        '<button type="button" class="ts-saved-remove" data-ts-saved-remove="' + index + '"' +
        ' aria-label="' + esc(t('lab.timescaleGenerator.savedRemove', 'Удалить')) + '" title="' + esc(t('lab.timescaleGenerator.savedRemove', 'Удалить')) + '">×</button>' +
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

  // ===== Экспорт: шкала таблицей =====
  function asMarkdown(rows) {
    var lines = ['# ' + t('lab.timescaleGenerator.panelScale', 'Шкала') + ': ' +
      yearLabel(state.from) + ' … ' + yearLabel(state.to), ''];
    lines.push('| ' + t('lab.timescaleGenerator.mdDate', 'Дата') + ' | ' +
      t('lab.timescaleGenerator.mdEvent', 'Событие') + ' | ' +
      t('lab.timescaleGenerator.mdTape', 'Лента') + ' |', '| --- | --- | --- |');
    rows.forEach(function(row) {
      lines.push('| ' + yearLabel(row.ev.sortKey) + ' | ' + (row.ev.title || '') +
        ' | ' + (row.tape.title || row.tape.id) + ' |');
    });
    return lines.join('\n');
  }

  function downloadMarkdown() {
    var rows = collectWindow();
    if (!rows.length) return;
    var url = URL.createObjectURL(new Blob([asMarkdown(rows)], { type: 'text/markdown;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'timescale-' + new Date().toISOString().slice(0, 10) + '.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  function copyMarkdown() {
    var rows = collectWindow();
    if (!rows.length) return;
    var done = function() { setStatus(t('lab.timescaleGenerator.copied', 'Markdown скопирован'), 'success'); };
    var failed = function() { setStatus(t('lab.timescaleGenerator.copyFailed', 'Копирование недоступно'), 'error'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(asMarkdown(rows)).then(done, failed);
    } else {
      failed();
    }
  }

  // ===== Зум и применение параметров =====
  function zoom(factor) {
    var mid = (state.from + state.to) / 2;
    var half = Math.max(1, Math.round((state.to - state.from) / 2 * factor));
    state.from = Math.floor(mid - half);
    state.to = Math.ceil(mid + half);
    if (dom.fromInput) dom.fromInput.value = String(state.from);
    if (dom.toInput) dom.toInput.value = String(state.to);
    state.limit = WINDOW_LIMIT;
    render('zoom');
  }

  function applyInputs() {
    var range = readRange();
    if (!range) {
      setStatus(t('lab.timescaleGenerator.invalidRange', 'Диапазон не распознан: используйте годы, до н.э. — отрицательные.'), 'error');
      return;
    }
    state.from = range.from;
    state.to = range.to;
    state.limit = WINDOW_LIMIT;
    render('inputs');
  }

  function applySaved(item) {
    if (!item) return;
    state.from = item.from;
    state.to = item.to;
    state.step = item.step;
    state.tapes = item.tapes.slice();
    state.limit = WINDOW_LIMIT;
    syncParamInputs();
    syncChips();
    render('saved');
  }

  function syncParamInputs() {
    if (dom.fromInput) dom.fromInput.value = String(state.from);
    if (dom.toInput) dom.toInput.value = String(state.to);
  }

  function syncChips() {
    Array.prototype.forEach.call(document.querySelectorAll('.ts-tape-chip'), function(chip) {
      var active = state.tapes.indexOf(chip.getAttribute('data-ts-tape')) !== -1;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.ts-step-chip'), function(chip) {
      var active = Number(chip.getAttribute('data-ts-step')) === state.step;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  // ===== События =====
  function bind(scope) {
    if (scope.dataset.tsBound === '1') return;
    scope.dataset.tsBound = '1';

    var timer = null;
    scope.addEventListener('input', function(event) {
      if (!event.target) return;
      if (event.target.id !== 'ts-from' && event.target.id !== 'ts-to') return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function() { timer = null; applyInputs(); }, 400);
    });

    scope.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' || !event.target) return;
      if (event.target.id !== 'ts-from' && event.target.id !== 'ts-to') return;
      event.preventDefault();
      applyInputs();
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var tape = target.closest('[data-ts-tape]');
      if (tape) {
        if (tape.classList.contains('ts-tape-chip--undated')) {
          setStatus(t('lab.timescaleGenerator.undatedPick', 'У ленты нет дат — в шкалу она не входит.'), '');
          return;
        }
        var tapeId = tape.getAttribute('data-ts-tape');
        var index = state.tapes.indexOf(tapeId);
        if (index === -1) state.tapes.push(tapeId);
        else state.tapes.splice(index, 1);
        syncChips();
        state.limit = WINDOW_LIMIT;
        render('tapes');
        return;
      }

      var step = target.closest('[data-ts-step]');
      if (step) {
        state.step = Number(step.getAttribute('data-ts-step'));
        syncChips();
        render('step');
        return;
      }

      if (target.closest('#ts-zoom-in')) { zoom(0.5); return; }
      if (target.closest('#ts-zoom-out')) { zoom(2); return; }

      // Кластер-чип «N событий» сужает диапазон до кластера.
      var cluster = target.closest('[data-ts-cluster]');
      if (cluster) {
        var bounds = cluster.getAttribute('data-ts-cluster').split(':');
        var clusterFrom = Number(bounds[0]);
        var clusterTo = Number(bounds[1]);
        if (!isNaN(clusterFrom) && !isNaN(clusterTo)) {
          var pad = Math.max((clusterTo - clusterFrom) * 0.2, state.step);
          state.from = Math.floor(clusterFrom - pad);
          state.to = Math.ceil(clusterTo + pad);
          syncParamInputs();
          state.limit = WINDOW_LIMIT;
          render('cluster');
        }
        return;
      }

      // Узлы и строки — deep-link #timeline/<id>/event/<i>.
      var node = target.closest('[data-ts-node]');
      if (node) selectAndGo(node);
      else {
        var row = target.closest('[data-ts-row]');
        if (row) selectAndGo(row);
      }

      if (target.closest('#ts-more')) {
        state.limit += WINDOW_LIMIT;
        renderWindow(collectWindow());
        return;
      }

      var action = target.closest('[data-ts-action]');
      if (action) {
        var kind = action.getAttribute('data-ts-action');
        if (kind === 'copy') copyMarkdown();
        else downloadMarkdown();
        return;
      }

      var savedOpen = target.closest('[data-ts-saved]');
      if (savedOpen) {
        applySaved(history[Number(savedOpen.getAttribute('data-ts-saved'))]);
        setStatus(t('lab.timescaleGenerator.savedOpened', 'Шкала восстановлена'), 'success');
        return;
      }
      var savedRemove = target.closest('[data-ts-saved-remove]');
      if (savedRemove) {
        history.splice(Number(savedRemove.getAttribute('data-ts-saved-remove')), 1);
        saveHistory(history);
        renderSaved();
      }
    });
  }

  function selectAndGo(el) {
    var attribute = el.getAttribute('data-ts-node') || el.getAttribute('data-ts-row');
    var parts = String(attribute).split(':');
    state.selected = { tape: parts[0], index: Number(parts[1]) };
    if (window.LabRouter) window.LabRouter.navigate('timeline/' + parts[0] + '/event/' + parts[1]);
  }

  function collectDom(scope) {
    dom = {
      fromInput: scope.querySelector('#ts-from'),
      toInput: scope.querySelector('#ts-to'),
      tapesBox: scope.querySelector('#ts-tapes'),
      axis: scope.querySelector('#ts-axis'),
      windowBox: scope.querySelector('#ts-window'),
      windowCount: scope.querySelector('#ts-window-count'),
      moreButton: scope.querySelector('#ts-more'),
      badge: scope.querySelector('#ts-badge'),
      saved: scope.querySelector('#ts-saved'),
      status: scope.querySelector('#ts-status'),
      actions: scope.querySelectorAll('[data-ts-action]')
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

      // Канон состояний: running → данные → результат / ошибка.
      setBadge('running');
      if (dom.axis) {
        dom.axis.innerHTML = '<div class="lab-skeleton" aria-hidden="true">' +
          '<span class="lab-skeleton-line"></span><span class="lab-skeleton-line"></span><span class="lab-skeleton-line"></span>' +
          '</div>';
      }

      loadData().then(function() {
        // Дефолт: три первые датированные ленты; hash имеет приоритет.
        var datedFirst = store.tapes.filter(function(tape) { return tapeMeta(tape).dated; }).slice(0, 3);
        state.tapes = datedFirst.map(function(tape) { return tape.id; });
        applyHashParams(readHash());
        state.tapes = state.tapes.filter(function(id) {
          return store.tapes.some(function(tape) { return tape.id === id && tapeMeta(tape).dated; });
        });
        if (!state.tapes.length) state.tapes = datedFirst.map(function(tape) { return tape.id; });
        syncParamInputs();
        renderTapes();
        syncChips();
        render('init');
      }).catch(function() {
        state.dataError = true;
        setBadge('error');
        setStatus(t('lab.timescaleGenerator.errorLoad', 'Ленты недоступны — проверьте доступ к data/.'), 'error');
        render('init');
      });
    }).catch(function(error) {
      scope.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.timescaleGenerator.loadFailed', 'Не удалось загрузить генератор: ')) + esc(error.message) + '</div>';
    });
  }

  window.TimescaleGenerator = { init: init, render: init };
})(window, document);
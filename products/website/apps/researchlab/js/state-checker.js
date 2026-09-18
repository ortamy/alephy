/**
 * state-checker.js — «Чекер стран»: диагностика страны по 8 состояниям пространств.
 * Данные: data/state-matrix.json. Результат: донат кураторской рампы (золото доминанте,
 * далее коричнево-ink ступени), доминанта, дедуплицированный диагноз, экспорт в Markdown.
 */
const StateChecker = (function() {
  'use strict';

  var STATES = [
    { key: 'tohu', label: 'Тоху', paleo: '𐤕𐤅𐤄', desc: 'Запертость. Остановка потока.',
      effect: 'поток силы остановлен и заперт — система держит пространство в замкнутом круге.' },
    { key: 'hoshekh', label: 'Хошех', paleo: '𐤇𐤔𐤊', desc: 'Сжатость. Блокировка потока.',
      effect: 'поток сжат и блокирован — внешние структуры давят на среду, не давая ей раскрыться.' },
    { key: 'mizraim', label: 'Мицраим', paleo: '𐤌𐤑𐤓𐤉𐤌', desc: 'Теснота. Принудительное направление потока.',
      effect: 'поток захвачен и принудительно направлен — каналы тесноты управляют вниманием и ресурсами.' },
    { key: 'rakia', label: 'Ракиа', paleo: '𐤓𐤒𐤉𐤏', desc: 'Разделение. Создание границы.',
      effect: 'поток разделён и растянут — страна стоит на границе между естественным и искусственным.' },
    { key: 'shamaim', label: 'Шамаим', paleo: '𐤔𐤌𐤉𐤌', desc: 'Открытость. Свободное течение потока.',
      effect: 'поток течёт свободно — пространство открыто для движения и обновления.' },
    { key: 'midbar', label: 'Мидбар', paleo: '𐤌𐤃𐤁𐤓', desc: 'Движение. Калибровка потока через поиск.',
      effect: 'поток находится в поиске — калибруется через движение, испытания и разведку.' },
    { key: 'erets', label: 'Эрец', paleo: '𐤀𐤓𐤑', desc: 'Опора. Фиксация потока на твёрдой поверхности.',
      effect: 'поток закреплён на опоре — страна реализует устойчивость и возможность строить.' },
    { key: 'eden', label: 'Эден', paleo: '𐤏𐤃𐤍', desc: 'Завершённость. Непрерывное течение жизни.',
      effect: 'поток завершён и непрерывен — пространство достигло целостности и пребывания.' }
  ];

  var CACHE_KEY = 'alephy_state_checker_cache';
  var matrix = null;
  var loadPromise = null;
  var scopeRef = null;
  var state = { result: null };

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function toNode(html) {
    var box = document.createElement('div');
    box.innerHTML = html;
    return box.firstElementChild || box;
  }

  function raf(callback) {
    if (window.requestAnimationFrame) window.requestAnimationFrame(callback);
    else window.setTimeout(callback, 16);
  }

  function setStatus(element, message, stateName) {
    if (!element) return;
    element.textContent = message || '';
    element.className = 'lab-status' + (stateName ? ' is-' + stateName : '');
  }

  function setBadge(badge, stateName) {
    if (!badge) return;
    var meta = {
      empty: { className: 'wb-badge', label: t('lab.stateChecker.stateEmpty', 'Ожидание') },
      running: { className: 'wb-badge is-running', label: t('lab.stateChecker.stateRunning', 'Диагностика') },
      success: { className: 'wb-badge is-done', label: t('lab.stateChecker.stateSuccess', 'Готово') },
      error: { className: 'wb-badge is-error', label: t('lab.stateChecker.stateError', 'Ошибка') }
    }[stateName] || { className: 'wb-badge', label: '' };
    badge.className = meta.className;
    badge.textContent = meta.label;
  }

  function emptyBox(hint) {
    return '<div class="lab-empty">' +
      '<span class="lab-empty-glyph" aria-hidden="true">\uD800\uDD15</span>' +
      '<p class="lab-empty-hint">' + esc(hint) + '</p>' +
      '</div>';
  }

  function skeletonBox() {
    return '<div class="lab-skeleton" role="status" aria-live="polite">' +
      '<span class="lab-skeleton-line"></span>' +
      '<span class="lab-skeleton-line"></span>' +
      '<span class="lab-skeleton-line"></span>' +
      '<span class="lab-skeleton-line" style="width:40%"></span>' +
      '</div>';
  }

  function errorBox(message) {
    return '<div class="stc-error">' +
      '<p class="stc-error-text">' + esc(message) + '</p>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-stc-retry>' +
      esc(t('lab.stateChecker.retry', 'Повторить')) + '</button>' +
      '</div>';
  }

  function stateByKey(key) {
    for (var i = 0; i < STATES.length; i++) {
      if (STATES[i].key === key) return STATES[i];
    }
    return null;
  }

  // ===== ДАННЫЕ =====
  function loadMatrix() {
    if (matrix) return Promise.resolve(matrix);
    if (loadPromise) return loadPromise;
    loadPromise = fetch('data/state-matrix.json')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        matrix = data;
        return matrix;
      })
      .catch(function(err) {
        loadPromise = null;
        throw err;
      });
    return loadPromise;
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  function findCountry(name) {
    var query = String(name || '').trim().toLowerCase();
    if (!query) return null;
    var countries = (matrix && matrix.countries) || [];
    var exact = countries.filter(function(c) { return c.name.toLowerCase() === query; })[0];
    if (exact) return exact;
    var partial = countries.filter(function(c) {
      return c.name.toLowerCase().indexOf(query) !== -1 || query.indexOf(c.name.toLowerCase()) !== -1;
    })[0];
    return partial || null;
  }

  /* Если данных для страны нет — детерминированная матрица по имени
     (результат помечается интерпретацией). */
  function generateCountry(name) {
    var query = String(name || '').toLowerCase();
    var seed = 0;
    for (var i = 0; i < query.length; i += 1) seed = (seed * 31 + query.charCodeAt(i)) >>> 0;
    var values = STATES.map(function(s, idx) {
      return { key: s.key, v: ((seed >> (idx * 3)) % 100) + 8 };
    });
    var total = values.reduce(function(sum, item) { return sum + item.v; }, 0);
    var states = {};
    values.forEach(function(item) {
      states[item.key] = Math.round((item.v / total) * 100);
    });
    var sum = STATES.reduce(function(acc, s) { return acc + (states[s.key] || 0); }, 0);
    if (sum !== 100) states[values[0].key] += 100 - sum;
    return { name: name, states: states };
  }

  /* { country, generated }: generated = данных нет, матрица выведена по имени. */
  function getCountry(name) {
    var found = findCountry(name);
    if (found) return Promise.resolve({ country: found, generated: false });

    var cache = readCache();
    var query = String(name || '').trim().toLowerCase();
    if (cache[query]) return Promise.resolve({ country: cache[query], generated: true });

    var generated = generateCountry(name);
    cache[query] = generated;
    writeCache(cache);
    return Promise.resolve({ country: generated, generated: true });
  }

  // ===== ДОМИНАНТА И РАНГ ОТТЕНКОВ =====
  function dominantState(states) {
    var best = null;
    STATES.forEach(function(s) {
      var value = states[s.key] || 0;
      if (!best || value > best.value) best = { key: s.key, value: value, label: s.label };
    });
    return best;
  }

  /* Ранг по убыванию доли: 0 — доминанта (золото), далее ступени коричнево-ink. */
  function toneRanks(states) {
    var order = STATES.map(function(s) {
      return { key: s.key, value: states[s.key] || 0 };
    }).sort(function(a, b) { return b.value - a.value; });

    var ranks = {};
    order.forEach(function(item, index) { ranks[item.key] = index; });
    return ranks;
  }

  // ===== ДИАГНОЗ: одна мысль = один абзац =====
  function normalizeParagraph(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function diagnosisParagraphs(entry, dom) {
    var country = entry.country;
    var domState = stateByKey(dom.key);
    var paragraphs = [];
    var seen = {};

    function push(text, kind) {
      var value = normalizeParagraph(text);
      if (!value) return;
      var signature = value.toLowerCase().slice(0, 70);
      if (seen[signature]) return;
      seen[signature] = true;
      paragraphs.push({ text: value, kind: kind });
    }

    push(country.diagnosis, 'source');
    push(t('lab.stateChecker.dominantLine', 'Доминирует «{state}» — {value}% пространства.')
      .replace('{state}', dom.label)
      .replace('{value}', String(dom.value)), 'source');
    push(t('lab.stateChecker.effectLine', 'Следствие: {effect}')
      .replace('{effect}', domState ? domState.effect : ''), 'interpretation');
    push(country.note, 'note');

    return paragraphs;
  }


  // ===== ДОНАТ КУРАТОРСКОЙ РАМПЫ =====
  function donutChart(states, size, dominantPct, ranks) {
    size = size || 260;
    var cx = size / 2;
    var cy = size / 2;
    var radius = size / 2 - 20;
    var innerRadius = radius - 36;
    var total = STATES.reduce(function(acc, s) { return acc + (states[s.key] || 0); }, 0) || 1;
    var angle = -90;
    var segments = '';

    STATES.forEach(function(s) {
      var value = states[s.key] || 0;
      if (value <= 0) return;
      var frac = value / total;
      var start = angle;
      var end = angle + frac * 360;
      angle = end;
      var large = (end - start) > 180 ? 1 : 0;
      var sx = cx + radius * Math.cos(start * Math.PI / 180);
      var sy = cy + radius * Math.sin(start * Math.PI / 180);
      var ex = cx + radius * Math.cos(end * Math.PI / 180);
      var ey = cy + radius * Math.sin(end * Math.PI / 180);
      var ix = cx + innerRadius * Math.cos(end * Math.PI / 180);
      var iy = cy + innerRadius * Math.sin(end * Math.PI / 180);
      var ixs = cx + innerRadius * Math.cos(start * Math.PI / 180);
      var iys = cy + innerRadius * Math.sin(start * Math.PI / 180);
      var tone = ranks[s.key] || 0;

      segments += '<path class="stc-seg stc-tone-' + tone + '" d="M ' + sx + ' ' + sy +
        ' A ' + radius + ' ' + radius + ' 0 ' + large + ' 1 ' + ex + ' ' + ey +
        ' L ' + ix + ' ' + iy +
        ' A ' + innerRadius + ' ' + innerRadius + ' 0 ' + large + ' 0 ' + ixs + ' ' + iys +
        ' Z"><title>' + esc(s.label) + ': ' + value + '%</title></path>';
    });

    return '<svg class="stc-chart" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' +
      esc(t('lab.stateChecker.chartLabel', 'Диаграмма состояний')) + '">' + segments +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" class="stc-chart-center-pct">' +
      (dominantPct != null ? dominantPct + '%' : '') + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" class="stc-chart-center-label">' +
      esc(t('lab.stateChecker.dominates', 'доминирует')) + '</text>' +
      '</svg>';
  }

  /* Легенда мини-чипами: тон ранга + палео-глиф + имя состояния + доля. */
  function legendHtml(states, ranks) {
    var order = STATES.slice().sort(function(a, b) {
      return (ranks[a.key] || 0) - (ranks[b.key] || 0);
    });
    return '<div class="stc-legend">' + order.map(function(s) {
      var tone = ranks[s.key] || 0;
      return '<div class="stc-legend-item stc-tone-' + tone + '">' +
        '<span class="stc-legend-dot" aria-hidden="true"></span>' +
        '<span class="stc-legend-chip"><span class="stc-legend-glyph" aria-hidden="true">' + s.paleo + '</span>' +
        esc(s.label) + '</span>' +
        '<span class="stc-legend-value">' + (states[s.key] || 0) + '%</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function diagnosisHtml(paragraphs) {
    return '<div class="stc-diagnosis">' +
      '<h3 class="stc-diagnosis-title">' + esc(t('lab.stateChecker.diagnosisTitle', 'Диагноз')) + '</h3>' +
      paragraphs.map(function(p) {
        var conf = p.kind === 'interpretation'
          ? '<span class="stc-conf">' + esc(t('lab.stateChecker.confidence', 'интерпретация')) + '</span>'
          : '';
        return '<p class="stc-para' + (p.kind === 'note' ? ' stc-para--note' : '') + '">' + conf + esc(p.text) + '</p>';
      }).join('') +
      '</div>';
  }

  function doorsHtml() {
    return '<div class="stc-doors">' +
      '<a class="stc-door" href="#states"><i data-lucide="map" aria-hidden="true"></i>' +
      esc(t('lab.stateChecker.doorStates', 'Карта состояний')) + '</a>' +
      '<a class="stc-door" href="#state-analyzer"><i data-lucide="activity" aria-hidden="true"></i>' +
      esc(t('lab.stateChecker.doorAnalyzer', 'Анализатор состояний')) + '</a>' +
      '</div>';
  }

  /* Футер результата: copy markdown + скачать .md в одной строке. */
  function footerHtml() {
    return '<div class="stc-footer">' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-stc-copy>' +
      '<i data-lucide="copy" aria-hidden="true"></i>' + esc(t('lab.stateChecker.copy', 'Копировать Markdown')) + '</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-stc-download>' +
      '<i data-lucide="download" aria-hidden="true"></i>' + esc(t('lab.stateChecker.download', 'Скачать .md')) + '</button>' +
      '<span class="stc-footer-status" id="stc-copy-status" role="status" aria-live="polite"></span>' +
      '</div>';
  }

  function resultHtml(entry, dom, ranks, paragraphs) {
    var conf = entry.generated
      ? '<span class="stc-conf">' + esc(t('lab.stateChecker.confidence', 'интерпретация')) + '</span>'
      : '';
    return '<div class="stc-result">' +
      '<header class="stc-result-head">' +
      '<h3 class="stc-country">' + esc(entry.country.name) + '</h3>' + conf +
      '<span class="wb-badge is-done">' + esc(t('lab.stateChecker.dominates', 'доминирует')) + ': ' +
      esc(dom.label) + ' ' + dom.value + '%</span>' +
      '</header>' +
      '<div class="stc-visual">' +
      '<div class="stc-chart-box">' + donutChart(entry.country.states, 260, dom.value, ranks) + '</div>' +
      legendHtml(entry.country.states, ranks) +
      '</div>' +
      diagnosisHtml(paragraphs) +
      doorsHtml() +
      footerHtml() +
      '</div>';
  }



  // ===== MARKDOWN =====
  function toMarkdown(payload) {
    var country = payload.country;
    var lines = [
      '# ' + t('lab.stateChecker.mdTitle', 'Чекер стран') + ': ' + country.name,
      '',
      '## ' + t('lab.stateChecker.diagnosisTitle', 'Диагноз'),
      ''
    ];
    payload.paragraphs.forEach(function(p) {
      lines.push(p.text);
      lines.push('');
    });
    lines.push('## ' + t('lab.stateChecker.mdDistribution', 'Распределение по 8 состояниям'));
    lines.push('');
    STATES.forEach(function(s) {
      lines.push('- ' + s.label + ' (' + s.paleo + '): ' + (country.states[s.key] || 0) + '%');
    });
    lines.push('');
    return lines.join('\n');
  }

  // ===== СОСТОЯНИЯ ПАНЕЛИ РЕЗУЛЬТАТА =====
  function resetState(scope) {
    var output = scope.querySelector('#stc-output');
    if (output) output.innerHTML = emptyBox(t('lab.stateChecker.emptyHint', 'Введите страну и нажмите «Проверить».'));
    setBadge(scope.querySelector('#stc-result-badge'), 'empty');
    setStatus(scope.querySelector('#stc-status'), '', '');
    state.result = null;
  }

  function fail(scope, message) {
    var output = scope.querySelector('#stc-output');
    if (output) output.replaceChildren(toNode(errorBox(message)));
    setBadge(scope.querySelector('#stc-result-badge'), 'error');
    setStatus(scope.querySelector('#stc-status'), message, 'error');
    state.result = null;
  }

  function runCheck(scope) {
    var input = scope.querySelector('#stc-input');
    var output = scope.querySelector('#stc-output');
    if (!input || !output) return;

    var name = (input.value || '').trim();
    if (!name) {
      fail(scope, t('lab.stateChecker.errorEmpty', 'Введите страну.'));
      return;
    }

    setStatus(scope.querySelector('#stc-status'), '', '');
    setBadge(scope.querySelector('#stc-result-badge'), 'running');
    output.replaceChildren(toNode(skeletonBox()));

    loadMatrix()
      .then(function() { return getCountry(name); })
      .then(function(entry) {
        raf(function() {
          var dom = dominantState(entry.country.states);
          if (!dom) {
            fail(scope, t('lab.stateChecker.errorNotFound', 'Страна не найдена: {name}').replace('{name}', name));
            return;
          }
          var ranks = toneRanks(entry.country.states);
          var paragraphs = diagnosisParagraphs(entry, dom);
          state.result = { country: entry.country, dominant: dom, paragraphs: paragraphs };
          output.replaceChildren(toNode(resultHtml(entry, dom, ranks, paragraphs)));
          setBadge(scope.querySelector('#stc-result-badge'), 'success');
          setStatus(scope.querySelector('#stc-status'),
            t('lab.stateChecker.found', 'Доминанта: ') + dom.label + ' — ' + dom.value + '%', 'success');
        });
      })
      .catch(function(err) {
        fail(scope, t('lab.stateChecker.errorLoad', 'Данные состояний недоступны: ') + (err && err.message ? err.message : err));
      });
  }

  function clearInput(scope) {
    var input = scope.querySelector('#stc-input');
    if (input) input.value = '';
    resetState(scope);
  }

  function setFooterStatus(scope, message, stateName) {
    var status = scope.querySelector('#stc-copy-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'stc-footer-status' + (stateName === 'error' ? ' is-error' : '');
  }

  function copyMarkdown(scope) {
    if (!state.result) return;
    var text = toMarkdown(state.result);
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      setFooterStatus(scope, t('lab.stateChecker.copyFailed', 'Копирование недоступно'), 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(function() {
      setFooterStatus(scope, t('lab.stateChecker.copied', 'Markdown скопирован'));
    }).catch(function() {
      setFooterStatus(scope, t('lab.stateChecker.copyFailed', 'Копирование недоступно'), 'error');
    });
  }

  function downloadMarkdown() {
    if (!state.result) return;
    var blob = new Blob([toMarkdown(state.result)], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'state-check-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function init(container) {
    var scope = container || document.getElementById('state-checker');
    if (!scope) return;
    scopeRef = scope;

    // Повторный заход на маршрут не должен дублировать слушатели.
    if (scope.dataset && scope.dataset.stcInit === '1') return;
    if (scope.dataset) scope.dataset.stcInit = '1';

    // Разметка страницы приходит после старта i18n — переводим её здесь.
    if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
      window.AlephyI18n.applyTranslations(scope);
    }

    resetState(scope);

    var form = scope.querySelector('#stc-form');
    var input = scope.querySelector('#stc-input');

    if (form) form.addEventListener('submit', function(event) {
      event.preventDefault();
      runCheck(scope);
    });

    // Ctrl/Cmd+Enter — проверка из поля ввода.
    if (input) input.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      runCheck(scope);
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var chip = target.closest('.lab-example-chip');
      if (chip) {
        if (input) {
          input.value = chip.getAttribute('data-stc-example') || chip.textContent.trim();
          input.focus();
        }
        setStatus(scope.querySelector('#stc-status'), '', '');
        return;
      }
      if (target.closest('[data-stc-copy]')) { copyMarkdown(scope); return; }
      if (target.closest('[data-stc-download]')) { downloadMarkdown(); return; }
      if (target.closest('[data-stc-retry]')) {
        if (input && !input.value.trim()) input.focus();
        runCheck(scope);
      }
    });
  }

  return {
    init: init,
    render: init,
    check: function() { runCheck(scopeRef || document.getElementById('state-checker') || document); },
    copy: function() { copyMarkdown(scopeRef || document.getElementById('state-checker') || document); },
    download: downloadMarkdown,
    loadMatrix: loadMatrix
  };
})();

window.StateChecker = StateChecker;

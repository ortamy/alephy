/**
 * research-generator.js — «Генератор исследований»: живой конструктор маршрута.
 * Разметка: pages/research-generator.html; канон панелей — css/components/panels.css.
 * Маршрут и скелет шаблона перестраиваются на каждый ввод; история — 5 генераций в localStorage.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/research-generator.html';
  var HISTORY_KEY = 'alephy_research_generator_history';
  var HISTORY_LIMIT = 5;
  var TYPES = ['root', 'word', 'verse', 'concept'];
  var pagePromise = null;
  var lastDoc = null;
  var activeType = 'root';

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function fill(template, topic, typeLabel) {
    return String(template).replace(/\{topic\}/g, topic).replace(/\{type\}/g, typeLabel);
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

  function cap(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function typeLabel(type) {
    var fallbacks = { root: 'Корень', word: 'Слово', verse: 'Стих', concept: 'Концепт' };
    return t('lab.researchGenerator.type' + cap(type), fallbacks[type] || type);
  }

  // Цепочка модулей по типу (язык пайплайнов: шаги через «→»).
  function chain(type) {
    var fallbacks = {
      root: 'Словарь корней → Палео-разбор → Компаратор → Слои → Дело',
      word: 'Чекер этимологии → Диалект-анализ → Словари → Дело',
      verse: 'Читалка → Компаратор переводов → Слои → Дело',
      concept: 'Давар-чекер → Словари → Методология → Дело'
    };
    return t('lab.researchGenerator.chain' + cap(type), fallbacks[type])
      .split('→').map(function(step) { return step.trim(); }).filter(Boolean);
  }

  function sources(type) {
    var fallbacks = {
      root: 'Корневой словарь · палео-таблица · карта подмен',
      word: 'Чекер этимологии · диалект-анализ · словари',
      verse: 'Читалка ТаНаХа · компаратор переводов · масоретский текст',
      concept: 'Давар-чекер · словари · методология'
    };
    return t('lab.researchGenerator.sources' + cap(type), fallbacks[type]);
  }

  // ===== История (localStorage, последние 5) =====
  function readHistory() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(function(item) {
        return item && typeof item.topic === 'string' && TYPES.indexOf(item.type) !== -1;
      }).slice(0, HISTORY_LIMIT);
    } catch (error) {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
    } catch (error) {
      // localStorage может быть недоступен — генерация просто не попадёт в историю.
    }
  }

  function formatTime(ts) {
    try {
      var locale = document.documentElement.lang === 'en' ? 'en-GB' : 'ru-RU';
      return new Date(ts).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  }

  // ===== Состояние формы =====
  function currentTopic(scope) {
    var input = scope.querySelector('#rg-topic');
    return input ? input.value.trim() : '';
  }

  function setStatus(scope, message, type) {
    var status = scope.querySelector('#rg-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'lab-status' + (type ? ' is-' + type : '');
  }

  // Live-строка валидности: перечитывается на каждый ввод и не врёт при заполненной теме.
  function updateState(scope) {
    var button = scope.querySelector('#rg-generate');
    var valid = Boolean(currentTopic(scope));
    if (button) button.disabled = !valid;
    setStatus(scope, valid ? '' : t('lab.researchGenerator.invalidHint', 'Укажите тему — маршрут и шаблон обновятся сразу.'), '');
  }

  // ===== Маршрут: цепочка чипов со стрелками =====
  function renderRoute(scope) {
    var host = scope.querySelector('#rg-route');
    if (!host) return;
    host.innerHTML = '<div class="rg-route-chain">' + chain(activeType).map(function(step, index, steps) {
      var chip = '<span class="rg-route-chip">' + esc(step) + '</span>';
      return index < steps.length - 1 ? chip + '<span class="rg-route-arrow" aria-hidden="true">→</span>' : chip;
    }).join('') + '</div>';
  }

  // ===== Живой скелет шаблона =====
  function skeletonLines(topic) {
    var label = typeLabel(activeType);
    return [
      { label: t('lab.researchGenerator.sectionContext', 'Контекст'),
        line: fill(t('lab.researchGenerator.lineContext', 'Объект: «{topic}»; тип разбора — {type}.'), topic, label) },
      { label: t('lab.researchGenerator.sectionSources', 'Источники'), line: sources(activeType) },
      { label: t('lab.researchGenerator.sectionRoots', 'Корни'),
        line: fill(t('lab.researchGenerator.lineRoots', 'Палео-формы и когнаты для «{topic}».'), topic, label) },
      { label: t('lab.researchGenerator.sectionMethodology', 'Методология'),
        line: t('lab.researchGenerator.lineMethodology', 'Давар: глагол-когнат не становится подлежащим; различать факт, интерпретацию и гипотезу.') },
      { label: t('lab.researchGenerator.sectionSteps', 'Шаги'), line: chain(activeType).join(' → ') }
    ];
  }

  function renderPreview(scope) {
    var host = scope.querySelector('#rg-preview');
    if (!host) return;
    var topic = currentTopic(scope);
    if (!topic) {
      host.innerHTML = '<div class="lab-empty">' +
        '<span class="lab-empty-glyph" aria-hidden="true">𐤌</span>' +
        '<p class="lab-empty-hint">' + esc(t('lab.researchGenerator.emptyHint', 'Скелет исследования собирается по мере ввода темы.')) + '</p></div>';
      return;
    }
    var steps = chain(activeType);
    var html = '<article class="rg-doc">' +
      '<h3 class="rg-doc-title">' + esc(topic) + '</h3>' +
      '<p class="rg-doc-meta">' + esc(typeLabel(activeType)) + ' · ' + steps.length + '</p>';
    skeletonLines(topic).forEach(function(section) {
      html += '<p class="rg-doc-label">' + esc(section.label) + '</p>' +
        '<p class="rg-doc-line">' + esc(section.line) + '</p>';
    });
    host.innerHTML = html + '</article>';
  }

  // ===== Генерация, история, экспорт =====
  function toMarkdown(doc) {
    var steps = chain(doc.type);
    var lines = ['# ' + doc.topic, '',
      t('lab.researchGenerator.typeLabel', 'Тип') + ': ' + typeLabel(doc.type),
      t('lab.researchGenerator.routeTitle', 'Маршрут') + ': ' + steps.join(' → '), ''];
    skeletonLinesFor(doc).forEach(function(section, index) {
      lines.push('## ' + section.label, '');
      if (index === 4) {
        steps.forEach(function(step, i) { lines.push((i + 1) + '. ' + step); });
      } else {
        lines.push(section.line);
      }
      lines.push('');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // Скелет для сохранённого документа: тип берётся из записи, а не из формы.
  function skeletonLinesFor(doc) {
    var previous = activeType;
    activeType = doc.type;
    var result = skeletonLines(doc.topic);
    activeType = previous;
    return result;
  }

  function generate(scope) {
    var topic = currentTopic(scope);
    if (!topic) {
      updateState(scope);
      return;
    }
    var doc = { topic: topic, type: activeType, createdAt: Date.now() };
    lastDoc = doc;
    var history = readHistory();
    history.unshift(doc);
    saveHistory(history);
    renderHistory(scope);
    var actions = scope.querySelector('#rg-actions');
    if (actions) actions.hidden = false;
    setStatus(scope, t('lab.researchGenerator.saved', 'Исследование сохранено в историю'), 'success');
  }

  function renderHistory(scope) {
    var host = scope.querySelector('#rg-history');
    if (!host) return;
    var items = readHistory();
    if (!items.length) {
      host.innerHTML = '<p class="rg-history-empty">' + esc(t('lab.researchGenerator.historyEmpty', 'Генераций пока нет.')) + '</p>';
      return;
    }
    host.innerHTML = items.map(function(item, index) {
      return '<button type="button" class="rg-history-row" data-rg-history="' + index + '">' +
        '<span class="rg-history-topic">' + esc(item.topic) + '</span>' +
        '<span class="rg-history-type">' + esc(typeLabel(item.type)) + '</span>' +
        '<span class="rg-history-time">' + esc(formatTime(item.createdAt)) + '</span></button>';
    }).join('');
  }

  function downloadMarkdown() {
    if (!lastDoc) return;
    var blob = new Blob([toMarkdown(lastDoc)], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'research-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function copyMarkdown(scope) {
    if (!lastDoc) return;
    var done = function() { setStatus(scope, t('lab.researchGenerator.copied', 'Markdown скопирован'), 'success'); };
    var failed = function() { setStatus(scope, t('lab.researchGenerator.copyFailed', 'Копирование недоступно'), 'error'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(toMarkdown(lastDoc)).then(done, failed);
    } else {
      failed();
    }
  }

  // ===== Состояние типа и формы =====
  function syncTypeChips(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('.rg-type-chip'), function(chip) {
      var active = chip.getAttribute('data-rg-type') === activeType;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setType(scope, type) {
    if (TYPES.indexOf(type) === -1) return;
    activeType = type;
    syncTypeChips(scope);
    renderRoute(scope);
    renderPreview(scope);
  }

  function applyData(scope, data) {
    var input = scope.querySelector('#rg-topic');
    if (input) input.value = data.topic || '';
    setType(scope, TYPES.indexOf(data.type) !== -1 ? data.type : 'root');
    updateState(scope);
  }

  function rerender(scope) {
    renderRoute(scope);
    renderPreview(scope);
    updateState(scope);
  }

  // ===== События =====
  function bind(scope) {
    if (scope.dataset.rgBound === '1') return;
    scope.dataset.rgBound = '1';

    // Живой маршрут и скелет: любой ввод в форме перестраивает панели.
    scope.addEventListener('input', function(event) {
      if (!event.target.closest || !event.target.closest('.rg-form')) return;
      renderPreview(scope);
      updateState(scope);
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var typeChip = target.closest('[data-rg-type]');
      if (typeChip) {
        setType(scope, typeChip.getAttribute('data-rg-type'));
        return;
      }
      var example = target.closest('[data-rg-example]');
      if (example) {
        var input = scope.querySelector('#rg-topic');
        if (input) {
          input.value = example.getAttribute('data-rg-example') || example.textContent.trim();
          input.focus();
        }
        renderPreview(scope);
        updateState(scope);
        return;
      }
      if (target.closest('#rg-clear')) {
        applyData(scope, { topic: '', type: activeType });
        setStatus(scope, t('lab.researchGenerator.cleared', 'Форма очищена'), 'success');
        return;
      }
      var historyRow = target.closest('[data-rg-history]');
      if (historyRow) {
        var item = readHistory()[Number(historyRow.getAttribute('data-rg-history'))];
        if (item) {
          applyData(scope, item);
          setStatus(scope, t('lab.researchGenerator.restored', 'Восстановлено из истории'), 'success');
        }
        return;
      }
      var action = target.closest('[data-rg-action]');
      if (action && lastDoc) {
        if (action.getAttribute('data-rg-action') === 'copy') copyMarkdown(scope);
        else downloadMarkdown();
      }
    });

    var form = scope.querySelector('#rg-form');
    if (form) form.addEventListener('submit', function(event) {
      event.preventDefault();
      generate(scope);
    });
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
      bind(scope);
      syncTypeChips(scope);
      renderHistory(scope);
      rerender(scope);
    }).catch(function(error) {
      scope.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.researchGenerator.loadFailed', 'Не удалось загрузить конструктор: ')) + esc(error.message) + '</div>';
    });
  }

  window.ResearchGenerator = { init: init, render: init };
})(window, document);
/**
 * board-generator.js — «Генератор досок»: конструктор с живым предпросмотром.
 * Разметка: pages/board-generator.html; канон панелей — css/components/panels.css.
 * Превью перерисовывается по мере ввода; история — последние 5 досок в localStorage.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/board-generator.html';
  var HISTORY_KEY = 'alephy_board_generator_history';
  var HISTORY_LIMIT = 5;
  var pagePromise = null;
  var lastBoard = null;

  // Чипы примеров: data-bg-example в разметке указывает индекс этого массива.
  var EXAMPLES = [
    {
      title: 'Подмена слова «закон»',
      conclusion: '«Закон» в переводах заменяет образ Торы как пути-наставления: живая траектория превращена в свод запретов.',
      evidence: [
        'Тора описана глаголами движения и ходьбы, а не запрета',
        'Греческий νόμος в LXX сдвигает смысл к юридической норме',
        'Ряд хук / мицва / тора держит образ наставления, не кодекса'
      ],
      attachments: ['Словарь подмен: запись «закон»', 'Компаратор переводов: слой LXX']
    },
    {
      title: 'Берешит 1:1 — образ начатка',
      conclusion: '«Берешит» читается как «в начатке»: текст открывается не датой, а указанием на первый сноп процесса.',
      evidence: [
        'Буквенный ряд: дом → голова → начаток',
        'Когнат «решит» в Дварим — начаток жатвы',
        'Масоретский текст не содержит артикля «в начале»'
      ],
      attachments: ['Палео-таблица букв', 'Компаратор: Берешит 1:1']
    }
  ];

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

  // ===== История (localStorage, последние 5) =====
  function readHistory() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(function(item) {
        return item && typeof item.title === 'string' && typeof item.conclusion === 'string';
      }).slice(0, HISTORY_LIMIT);
    } catch (error) {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
    } catch (error) {
      // localStorage может быть недоступен — доска просто не попадёт в историю.
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
  function rowValues(scope, selector) {
    var list = scope.querySelector(selector);
    if (!list) return [];
    return Array.prototype.map.call(list.querySelectorAll('.bg-row-input'), function(input) {
      return input.value.trim();
    }).filter(Boolean);
  }

  function collect(scope) {
    var title = scope.querySelector('#bg-title');
    var conclusion = scope.querySelector('#bg-conclusion');
    return {
      title: title ? title.value.trim() : '',
      conclusion: conclusion ? conclusion.value.trim() : '',
      evidence: rowValues(scope, '#bg-evidence-list'),
      attachments: rowValues(scope, '#bg-attachments-list')
    };
  }

  function isValid(data) {
    return Boolean(data.title && data.conclusion);
  }

  function setStatus(scope, message, type) {
    var status = scope.querySelector('#bg-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'lab-status' + (type ? ' is-' + type : '');
  }

  function updateGenerateState(scope) {
    var button = scope.querySelector('#bg-generate');
    var hint = scope.querySelector('#bg-hint');
    var valid = isValid(collect(scope));
    if (button) button.disabled = !valid;
    if (hint) hint.hidden = valid;
  }

  // ===== Живой предпросмотр =====
  function renderPreview(scope) {
    var host = scope.querySelector('#bg-preview');
    if (!host) return;
    var data = collect(scope);
    if (!data.title && !data.conclusion && !data.evidence.length && !data.attachments.length) {
      host.innerHTML = '<div class="lab-empty">' +
        '<span class="lab-empty-glyph" aria-hidden="true">𐤁</span>' +
        '<p class="lab-empty-hint">' + esc(t('lab.boardGenerator.emptyHint', 'Доска собирается по мере ввода: заголовок, вывод, улики и вложения.')) + '</p></div>';
      return;
    }
    var html = '<article class="bg-board">';
    if (data.title) {
      html += '<h3 class="bg-board-title">' + esc(data.title) + '</h3>';
    }
    if (data.conclusion) {
      html += '<p class="bg-board-label">' + esc(t('lab.boardGenerator.conclusionSection', 'Вывод')) + '</p>' +
        '<p class="bg-board-conclusion">' + esc(data.conclusion) + '</p>';
    }
    if (data.evidence.length) {
      html += '<p class="bg-board-label">' + esc(t('lab.boardGenerator.evidenceSection', 'Улики')) + '</p><ul class="bg-board-evidence">';
      data.evidence.forEach(function(item) {
        html += '<li><span class="bg-glyph" aria-hidden="true">𐤄</span><span>' + esc(item) + '</span></li>';
      });
      html += '</ul>';
    }
    if (data.attachments.length) {
      html += '<p class="bg-board-label">' + esc(t('lab.boardGenerator.attachmentsSection', 'Вложения')) + '</p><div class="bg-chips">';
      data.attachments.forEach(function(item) {
        html += '<span class="bg-chip">' + esc(item) + '</span>';
      });
      html += '</div>';
    }
    host.innerHTML = html + '</article>';
  }

  // ===== Динамические hairline-строки =====
  function addRow(scope, listSelector, placeholderKey, placeholderFallback, value) {
    var list = scope.querySelector(listSelector);
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'bg-row';
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'lab-input bg-row-input';
    input.maxLength = 240;
    input.placeholder = t(placeholderKey, placeholderFallback);
    if (value) input.value = value;
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bg-icon-button bg-row-remove';
    var removeLabel = t('lab.boardGenerator.removeTitle', 'Удалить');
    remove.setAttribute('aria-label', removeLabel);
    remove.title = removeLabel;
    remove.textContent = '×';
    row.appendChild(input);
    row.appendChild(remove);
    list.appendChild(row);
    if (!value) input.focus();
  }

  function rebuildRows(scope, listSelector, placeholderKey, placeholderFallback, values) {
    var list = scope.querySelector(listSelector);
    if (!list) return;
    list.innerHTML = '';
    (values || []).forEach(function(value) {
      addRow(scope, listSelector, placeholderKey, placeholderFallback, value);
    });
  }

  function applyData(scope, data) {
    var title = scope.querySelector('#bg-title');
    var conclusion = scope.querySelector('#bg-conclusion');
    if (title) title.value = data.title || '';
    if (conclusion) conclusion.value = data.conclusion || '';
    rebuildRows(scope, '#bg-evidence-list', 'lab.boardGenerator.evidencePlaceholder', 'Наблюдение или источник', data.evidence);
    rebuildRows(scope, '#bg-attachments-list', 'lab.boardGenerator.attachmentPlaceholder', 'Ссылка или материал', data.attachments);
    renderPreview(scope);
    updateGenerateState(scope);
  }

  // ===== Генерация и история =====
  function generate(scope) {
    var data = collect(scope);
    if (!isValid(data)) {
      updateGenerateState(scope);
      return;
    }
    var board = {
      title: data.title,
      conclusion: data.conclusion,
      evidence: data.evidence,
      attachments: data.attachments,
      createdAt: Date.now()
    };
    lastBoard = board;
    var history = readHistory();
    history.unshift(board);
    saveHistory(history);
    renderHistory(scope);
    var actions = scope.querySelector('#bg-actions');
    if (actions) actions.hidden = false;
    setStatus(scope, t('lab.boardGenerator.saved', 'Доска сохранена в историю'), 'success');
  }

  function renderHistory(scope) {
    var host = scope.querySelector('#bg-history');
    if (!host) return;
    var items = readHistory();
    if (!items.length) {
      host.innerHTML = '<p class="bg-history-empty">' + esc(t('lab.boardGenerator.historyEmpty', 'Сохранённых досок пока нет.')) + '</p>';
      return;
    }
    host.innerHTML = items.map(function(item, index) {
      return '<button type="button" class="bg-history-row" data-bg-history="' + index + '">' +
        '<span class="bg-history-title">' + esc(item.title || t('lab.boardGenerator.untitled', 'Без названия')) + '</span>' +
        '<span class="bg-history-time">' + esc(formatTime(item.createdAt)) + '</span></button>';
    }).join('');
  }

  // ===== Экспорт =====
  function toMarkdown(board) {
    var lines = ['# ' + board.title, '', '## ' + t('lab.boardGenerator.conclusionSection', 'Вывод'), '', board.conclusion];
    if (board.evidence.length) {
      lines.push('', '## ' + t('lab.boardGenerator.evidenceSection', 'Улики'), '');
      board.evidence.forEach(function(item) { lines.push('- ' + item); });
    }
    if (board.attachments.length) {
      lines.push('', '## ' + t('lab.boardGenerator.attachmentsSection', 'Вложения'), '');
      board.attachments.forEach(function(item) { lines.push('- ' + item); });
    }
    return lines.join('\n');
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function copyMarkdown(scope) {
    if (!lastBoard) return;
    var done = function() { setStatus(scope, t('lab.boardGenerator.copied', 'Markdown скопирован'), 'success'); };
    var failed = function() { setStatus(scope, t('lab.boardGenerator.copyFailed', 'Копирование недоступно'), 'error'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(toMarkdown(lastBoard)).then(done, failed);
    } else {
      failed();
    }
  }

  // ===== События =====
  function bind(scope) {
    if (scope.dataset.bgBound === '1') return;
    scope.dataset.bgBound = '1';

    // Живое превью: любой ввод в форме перерисовывает доску и валидность.
    scope.addEventListener('input', function(event) {
      if (!event.target.closest || !event.target.closest('.bg-form')) return;
      renderPreview(scope);
      updateGenerateState(scope);
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var chip = target.closest('[data-bg-example]');
      if (chip) {
        var example = EXAMPLES[Number(chip.getAttribute('data-bg-example'))];
        if (example) applyData(scope, example);
        return;
      }
      if (target.closest('#bg-add-evidence')) {
        addRow(scope, '#bg-evidence-list', 'lab.boardGenerator.evidencePlaceholder', 'Наблюдение или источник');
        return;
      }
      if (target.closest('#bg-add-attachment')) {
        addRow(scope, '#bg-attachments-list', 'lab.boardGenerator.attachmentPlaceholder', 'Ссылка или материал');
        return;
      }
      var remove = target.closest('.bg-row-remove');
      if (remove) {
        var row = remove.closest('.bg-row');
        if (row) row.remove();
        renderPreview(scope);
        return;
      }
      if (target.closest('#bg-clear')) {
        applyData(scope, { title: '', conclusion: '', evidence: [], attachments: [] });
        setStatus(scope, t('lab.boardGenerator.cleared', 'Форма очищена'), 'success');
        return;
      }
      var historyRow = target.closest('[data-bg-history]');
      if (historyRow) {
        var item = readHistory()[Number(historyRow.getAttribute('data-bg-history'))];
        if (item) {
          applyData(scope, item);
          setStatus(scope, t('lab.boardGenerator.restored', 'Доска восстановлена из истории'), 'success');
        }
        return;
      }
      var action = target.closest('[data-bg-action]');
      if (action && lastBoard) {
        var kind = action.getAttribute('data-bg-action');
        if (kind === 'copy') copyMarkdown(scope);
        else if (kind === 'md') download('board-' + stamp() + '.md', toMarkdown(lastBoard), 'text/markdown;charset=utf-8');
        else if (kind === 'json') download('board-' + stamp() + '.json', JSON.stringify(lastBoard, null, 2), 'application/json;charset=utf-8');
      }
    });

    var form = scope.querySelector('#bg-form');
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
      renderHistory(scope);
      renderPreview(scope);
      updateGenerateState(scope);
    }).catch(function(error) {
      scope.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.boardGenerator.loadFailed', 'Не удалось загрузить конструктор: ')) + esc(error.message) + '</div>';
    });
  }

  window.BoardGenerator = { init: init, render: init };
})(window, document);

/**
 * change-generator.js — «Генератор изменений» (#change-generator).
 *
 * Показывает разницу между двумя версиями текста: построчный diff (LCS)
 * с пометками «добавлено / удалено / изменено», сводкой и выгрузкой в
 * unified-формате. Работает офлайн: данных с сервера не берёт, только
 * текст, который вводит исследователь.
 *
 * Алгоритм — LCS по строкам с ограничением размера: динамика O(n·m) на
 * больших документах съела бы главный поток, поэтому сверху стоит
 * предел, после которого включается упрощённый построчный режим.
 *
 * Каркас — бенто 7+5 / 7+5 по §5.2a, тулбар — оболочка агентов (§4.7).
 */
(function(window, document) {
  'use strict';

  var STORAGE_KEY = 'alephy_change_generator';
  var CASE_LIMIT = 12;
  // 4000 строк — потолок динамики: 4000×4000 это 16 млн ячеек, что в браузере
  // уже заметно. Выше включается быстрый, но менее точный режим.
  var LCS_LIMIT = 4000;

  var state = {
    left: '',
    right: '',
    leftLabel: '',
    rightLabel: '',
    view: 'unified',
    ignoreCase: false,
    ignoreSpace: false,
    cases: []
  };

  function esc(value) {
    if (value == null) return '';
    if (window.AlephyUtils && window.AlephyUtils.escapeHtml) return window.AlephyUtils.escapeHtml(value);
    return String(value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function syncIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (error) { /* иконки не критичны */ }
    } else if (window.LabIcons && window.LabIcons.sync) {
      window.LabIcons.sync();
    }
  }

  function formatTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (error) { return '—'; }
  }
  // ===== Хранилище =====

  function loadCases() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.slice(0, CASE_LIMIT) : [];
    } catch (error) {
      return [];
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases.slice(0, CASE_LIMIT)));
    } catch (error) {
      // Приватный режим: сравнение просто не переживёт перезагрузку.
    }
  }

  // ===== Diff =====

  function splitLines(text) {
    return String(text == null ? '' : text).split('\n');
  }

  // Ключ сравнения: регистр и повторные пробелы по флажкам игнорируются,
  // но строки в выводе остаются исходными — фильтр меняет только сравнение.
  function compareKey(line) {
    var value = line.replace(/[ \t]+/g, ' ');
    return state.ignoreCase ? value.toLowerCase() : value;
  }

  /* LCS по строкам. Возвращает операции в порядке исходника:
     { type: 'same'|'add'|'del', left: number|null, right: number|null }. */
  function diffLines(leftLines, rightLines) {
    var n = leftLines.length;
    var m = rightLines.length;

    if (n > LCS_LIMIT || m > LCS_LIMIT) return simpleDiff(leftLines, rightLines);

    var table = [];
    for (var i = 0; i <= n; i++) table.push(new Uint32Array(m + 1));
    for (var a = n - 1; a >= 0; a--) {
      for (var b = m - 1; b >= 0; b--) {
        table[a][b] = compareKey(leftLines[a]) === compareKey(rightLines[b])
          ? table[a + 1][b + 1] + 1
          : Math.max(table[a + 1][b], table[a][b + 1]);
      }
    }

    var ops = [];
    var x = 0;
    var y = 0;
    while (x < n && y < m) {
      if (compareKey(leftLines[x]) === compareKey(rightLines[y])) {
        ops.push({ type: 'same', left: x + 1, right: y + 1 });
        x++;
        y++;
      } else if (table[x + 1][y] >= table[x][y + 1]) {
        ops.push({ type: 'del', left: x + 1, right: null });
        x++;
      } else {
        ops.push({ type: 'add', left: null, right: y + 1 });
        y++;
      }
    }
    while (x < n) ops.push({ type: 'del', left: ++x, right: null });
    while (y < m) ops.push({ type: 'add', left: null, right: ++y });
    return ops;
  }

  // Запасной режим для очень больших документов: выравнивание по позиции,
  // а не по LCS. Точность ниже, зато предсказуемое время.
  function simpleDiff(leftLines, rightLines) {
    var ops = [];
    var size = Math.max(leftLines.length, rightLines.length);
    for (var i = 0; i < size; i++) {
      if (i < leftLines.length && i < rightLines.length) {
        if (compareKey(leftLines[i]) === compareKey(rightLines[i])) {
          ops.push({ type: 'same', left: i + 1, right: i + 1 });
        } else {
          ops.push({ type: 'del', left: i + 1, right: null });
          ops.push({ type: 'add', left: null, right: i + 1 });
        }
      } else if (i < leftLines.length) {
        ops.push({ type: 'del', left: i + 1, right: null });
      } else {
        ops.push({ type: 'add', left: null, right: i + 1 });
      }
    }
    return ops;
  }

  /* Пары «удалено → добавлено» на соседних позициях — это правки одной
     строки, а не два независимых события. Их показываем как «изменено». */
  function pairChanges(ops, leftLines, rightLines) {
    var rows = [];
    for (var i = 0; i < ops.length; i++) {
      var current = ops[i];
      var next = ops[i + 1];
      current.text = current.type === 'del' ? leftLines[current.left - 1] : rightLines[current.right - 1];
      if (current.type === 'del' && next && next.type === 'add') {
        rows.push({
          type: 'change',
          left: current.left,
          right: next.right,
          leftText: current.text,
          rightText: rightLines[next.right - 1]
        });
        i++;
        continue;
      }
      if (current.type === 'del') rows.push({ type: 'del', left: current.left, leftText: current.text });
      else if (current.type === 'add') rows.push({ type: 'add', right: current.right, rightText: current.text });
      else rows.push({ type: 'same', left: current.left, right: current.right, text: current.text });
    }
    return rows;
  }

  // Считаем сравнение один раз на изменение состояния: и сводка, и лента, и
  // выгрузка обязаны опираться на один и тот же результат.
  function analyze() {
    var leftLines = splitLines(state.left);
    var rightLines = splitLines(state.right);
    var rows = pairChanges(diffLines(leftLines, rightLines), leftLines, rightLines);
    var summary = { added: 0, removed: 0, changed: 0, same: 0 };
    rows.forEach(function(row) {
      if (row.type === 'add') summary.added++;
      else if (row.type === 'del') summary.removed++;
      else if (row.type === 'change') summary.changed++;
      else summary.same++;
    });
    summary.total = summary.added + summary.removed + summary.changed + summary.same;
    summary.identical = summary.total > 0 && summary.added === 0 && summary.removed === 0 && summary.changed === 0;
    return { rows: rows, summary: summary };
  }

  // Ханки: только различия и N строк контекста вокруг. Полный документ в
  // ленте не нужен — он и есть причина, по которой diff нечитаем.
  function hunks(rows, context) {
    var keep = new Array(rows.length);
    rows.forEach(function(row, index) {
      if (row.type === 'same') return;
      for (var i = Math.max(0, index - context); i <= Math.min(rows.length - 1, index + context); i++) keep[i] = true;
    });
    var groups = [];
    var current = null;
    rows.forEach(function(row, index) {
      if (!keep[index]) { current = null; return; }
      if (!current) {
        current = { rows: [], skipped: 0 };
        groups.push(current);
      } else if (index - current.rows[current.rows.length - 1]._index > 1) {
        current.skipped = index - current.rows[current.rows.length - 1]._index - 1;
      }
      row._index = index;
      current.rows.push(row);
    });
    return groups;
  }

  // Unified-выгрузка: формат, который понимает git и любой diff-инструмент.
  function toUnified() {
    var result = analyze();
    var lines = ['--- ' + (state.leftLabel || t('lab.changeGenerator.versionA', 'Версия А')),
      '+++ ' + (state.rightLabel || t('lab.changeGenerator.versionB', 'Версия Б'))];
    hunks(result.rows, 3).forEach(function(group) {
      lines.push('@@ ' + (group.rows[0].left || 0) + ',' + group.rows.length +
        ' ' + (group.rows[0].right || 0) + ',' + group.rows.length + ' @@');
      group.rows.forEach(function(row) {
        if (row.type === 'add') lines.push('+' + row.rightText);
        else if (row.type === 'del') lines.push('-' + row.leftText);
        else if (row.type === 'change') {
          lines.push('-' + row.leftText);
          lines.push('+' + row.rightText);
        } else lines.push(' ' + row.text);
      });
    });
    return lines.join('\n');
  }

  function setStatus(container, message, type) {
    var node = container.querySelector('#chg-status');
    if (!node) return;
    node.textContent = message || '';
    node.className = 'lab-status' + (type ? ' is-' + type : '');
  }
  // ===== Разметка =====

  function toolbarMarkup(summary) {
    return '<section class="agent-controls-panel chg-controls-panel" aria-label="Настройки сравнения">' +
      '<div class="agent-toolbar-row">' +
        '<div class="chg-toolbar-toggles" role="group" aria-label="Что считать изменением">' +
          '<button type="button" class="chg-chip' + (state.ignoreCase ? ' is-active' : '') + '" ' +
            'data-chg-toggle="ignoreCase" aria-pressed="' + (state.ignoreCase ? 'true' : 'false') + '">' +
            esc(t('lab.changeGenerator.ignoreCase', 'Без регистра')) + '</button>' +
          '<button type="button" class="chg-chip' + (state.ignoreSpace ? ' is-active' : '') + '" ' +
            'data-chg-toggle="ignoreSpace" aria-pressed="' + (state.ignoreSpace ? 'true' : 'false') + '">' +
            esc(t('lab.changeGenerator.ignoreSpace', 'Без пробелов')) + '</button>' +
        '</div>' +
        '<div class="chg-toolbar-toggles" role="group" aria-label="Вид различий">' +
          '<button type="button" class="chg-chip' + (state.view === 'unified' ? ' is-active' : '') + '" ' +
            'data-chg-view="unified" aria-pressed="' + (state.view === 'unified' ? 'true' : 'false') + '">' +
            esc(t('lab.changeGenerator.unified', 'Единый вид')) + '</button>' +
          '<button type="button" class="chg-chip' + (state.view === 'split' ? ' is-active' : '') + '" ' +
            'data-chg-view="split" aria-pressed="' + (state.view === 'split' ? 'true' : 'false') + '">' +
            esc(t('lab.changeGenerator.split', 'Две колонки')) + '</button>' +
        '</div>' +
        '<div class="agent-toolbar-actions">' +
          '<span class="pipeline-count" aria-live="polite">' +
            '<strong>' + (summary.added + summary.removed + summary.changed) + '</strong> ' +
            esc(t('lab.changeGenerator.diffs', 'различий')) + '</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" id="chg-swap">' +
            '<i data-lucide="arrow-left-right" aria-hidden="true"></i>' + esc(t('lab.changeGenerator.swap', 'Поменять местами')) + '</button>' +
          '<button type="button" class="lab-btn lab-btn-primary lab-btn-sm" id="chg-save">' +
            '<i data-lucide="bookmark-plus" aria-hidden="true"></i>' + esc(t('lab.changeGenerator.save', 'Сохранить')) + '</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function emptyHint(text) {
    return '<div class="lab-empty"><span class="lab-empty-glyph" aria-hidden="true">⇌</span>' +
      '<p class="lab-empty-hint">' + esc(text) + '</p></div>';
  }

  // Ячейка 01 — две версии текста рядом.
  function versionsCellMarkup() {
    return '<section class="chg-cell chg-cell--versions">' +
        '<div class="chg-cell-head">' +
          '<span class="chg-num">01</span>' +
          '<h2 class="chg-cell-title">' + esc(t('lab.changeGenerator.versions', 'Версии')) + '</h2>' +
          '<span class="chg-cell-hint">' + esc(t('lab.changeGenerator.versionsHint', 'вставьте текст в обе колонки')) + '</span>' +
        '</div>' +
        '<div class="chg-fields">' +
          versionField('chg-left', 'chg-left-label', state.leftLabel,
            t('lab.changeGenerator.versionA', 'Версия А'), state.left,
            t('lab.changeGenerator.versionAPlaceholder', 'Исходный текст')) +
          versionField('chg-right', 'chg-right-label', state.rightLabel,
            t('lab.changeGenerator.versionB', 'Версия Б'), state.right,
            t('lab.changeGenerator.versionBPlaceholder', 'Исправленный текст')) +
        '</div>' +
      '</section>';
  }

  function versionField(textId, labelId, value, defaultLabel, text, placeholder) {
    return '<div class="chg-field">' +
        '<label class="chg-field-label" for="' + labelId + '">' +
          esc(t('lab.changeGenerator.versionName', 'Название')) + '</label>' +
        '<input type="text" class="lab-input chg-label-input" id="' + labelId + '" maxlength="60" ' +
          'placeholder="' + esc(defaultLabel) + '" value="' + esc(value) + '">' +
        '<label class="chg-field-label chg-sr" for="' + textId + '">' + esc(defaultLabel) + '</label>' +
        '<textarea class="lab-input chg-text" id="' + textId + '" spellcheck="false" ' +
          'placeholder="' + esc(placeholder) + '" aria-label="' + esc(defaultLabel) + '">' + esc(text) + '</textarea>' +
      '</div>';
  }

  // Ячейка 02 (ink) — сводка различий.
  function summaryCellMarkup(summary) {
    var rows = [
      [t('lab.changeGenerator.added', 'Добавлено'), summary.added, 'is-add'],
      [t('lab.changeGenerator.removed', 'Удалено'), summary.removed, 'is-del'],
      [t('lab.changeGenerator.changed', 'Изменено'), summary.changed, 'is-change'],
      [t('lab.changeGenerator.same', 'Совпадает'), summary.same, 'is-same']
    ];
    var verdict = summary.total === 0
      ? t('lab.changeGenerator.emptyVerdict', 'Вставьте текст в обе версии.')
      : (summary.identical
        ? t('lab.changeGenerator.identical', 'Версии совпадают.')
        : t('lab.changeGenerator.differs', 'Версии различаются.'));

    return '<section class="chg-cell chg-cell--summary chg-cell--ink">' +
        '<div class="chg-cell-head"><span class="chg-num">02</span>' +
          '<h2 class="chg-cell-title">' + esc(t('lab.changeGenerator.summary', 'Сводка')) + '</h2></div>' +
        '<p class="chg-verdict">' + esc(verdict) + '</p>' +
        '<dl class="chg-summary">' + rows.map(function(row) {
          return '<div class="chg-summary-row ' + row[2] + '">' +
            '<dt>' + esc(row[0]) + '</dt><dd>' + row[1] + '</dd></div>';
        }).join('') + '</dl>' +
      '</section>';
  }
  // Ячейка 03 — лента различий (единый вид или две колонки).
  function diffCellMarkup(result) {
    var groups = hunks(result.rows, 3);
    if (!groups.length) {
      return '<section class="chg-cell chg-cell--diff">' +
        '<div class="chg-cell-head"><span class="chg-num">03</span>' +
          '<h2 class="chg-cell-title">' + esc(t('lab.changeGenerator.diff', 'Различия')) + '</h2></div>' +
        emptyHint(result.summary.total
          ? t('lab.changeGenerator.noDiff', 'Различий нет.')
          : t('lab.changeGenerator.emptyVerdict', 'Вставьте текст в обе версии.')) +
      '</section>';
    }
    var body = state.view === 'split'
      ? groups.map(splitGroupMarkup).join('')
      : groups.map(unifiedGroupMarkup).join('');
    return '<section class="chg-cell chg-cell--diff">' +
        '<div class="chg-cell-head"><span class="chg-num">03</span>' +
          '<h2 class="chg-cell-title">' + esc(t('lab.changeGenerator.diff', 'Различия')) + '</h2>' +
          '<span class="chg-cell-hint">' + esc(t('lab.changeGenerator.diffHint', 'контекст 3 строки')) + '</span></div>' +
        '<div class="chg-feed">' + body + '</div>' +
      '</section>';
  }

  function unifiedGroupMarkup(group) {
    return '<div class="chg-hunk">' + group.rows.map(function(row) {
      var mark = row.type === 'add' ? '+' : (row.type === 'del' ? '−' : (row.type === 'change' ? '±' : ' '));
      var text = row.type === 'add' ? row.rightText
        : (row.type === 'del' ? row.leftText
          : (row.type === 'change' ? row.leftText + '  →  ' + row.rightText : row.text));
      var number = row.left || row.right || '';
      return '<div class="chg-line is-' + row.type + '">' +
        '<span class="chg-mark" aria-hidden="true">' + mark + '</span>' +
        '<span class="chg-num">' + esc(number) + '</span>' +
        '<span class="chg-text">' + (esc(text) || '&nbsp;') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function splitGroupMarkup(group) {
    return '<div class="chg-split">' + group.rows.map(function(row) {
      var left = row.type === 'add' ? '' : (row.leftText == null ? '' : row.leftText);
      var right = row.type === 'del' ? '' : (row.rightText == null ? row.text : row.rightText);
      var leftMark = row.type === 'same' ? ' ' : (row.type === 'del' || row.type === 'change' ? '−' : '');
      var rightMark = row.type === 'same' ? ' ' : (row.type === 'add' || row.type === 'change' ? '+' : '');
      return '<div class="chg-split-row is-' + row.type + '">' +
        '<span class="chg-side"><span class="chg-mark" aria-hidden="true">' + leftMark + '</span>' +
          '<span class="chg-text">' + (esc(left) || '&nbsp;') + '</span></span>' +
        '<span class="chg-side"><span class="chg-mark" aria-hidden="true">' + rightMark + '</span>' +
          '<span class="chg-text">' + (esc(right) || '&nbsp;') + '</span></span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // Ячейка 04 — сохранённые сравнения и выгрузка.
  function savedCellMarkup() {
    return '<section class="chg-cell chg-cell--saved">' +
        '<div class="chg-cell-head"><span class="chg-num">04</span>' +
          '<h2 class="chg-cell-title">' + esc(t('lab.changeGenerator.saved', 'Сохранённые')) + '</h2>' +
          '<span class="chg-cell-hint">' + esc(t('lab.changeGenerator.savedHint', 'в этом браузере')) + '</span></div>' +
        (state.cases.length
          ? '<ul class="chg-saved">' + state.cases.map(savedRowMarkup).join('') + '</ul>'
          : emptyHint(t('lab.changeGenerator.savedEmpty', 'Сохранённых сравнений пока нет.'))) +
        '<div class="chg-actions">' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" id="chg-export">' +
            '<i data-lucide="download" aria-hidden="true"></i>Diff</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" id="chg-copy">' +
            '<i data-lucide="copy" aria-hidden="true"></i>' + esc(t('lab.changeGenerator.copy', 'Копировать')) + '</button>' +
        '</div>' +
        '<p class="lab-status" id="chg-status" role="status" aria-live="polite"></p>' +
      '</section>';
  }

  function savedRowMarkup(item, index) {
    var count = item.added + item.removed + item.changed;
    return '<li class="chg-saved-row">' +
        '<button type="button" class="chg-saved-open" data-chg-restore="' + index + '" ' +
          'title="' + esc(t('lab.changeGenerator.restore', 'Открыть сравнение')) + '">' +
          esc(item.name) + '</button>' +
        '<span class="chg-saved-count">' + count + '</span>' +
        '<span class="chg-saved-time">' + esc(formatTime(item.at)) + '</span>' +
        '<button type="button" class="chg-icon-btn" data-chg-delete="' + index + '" ' +
          'aria-label="' + esc(t('lab.changeGenerator.delete', 'Удалить сравнение')) + '">' +
          '<i data-lucide="trash-2" aria-hidden="true"></i></button>' +
      '</li>';
  }

  function shellMarkup() {
    var result = analyze();
    return '<div class="chg-shell">' +
      toolbarMarkup(result.summary) +
      '<div class="chg-bento">' +
        versionsCellMarkup() +
        summaryCellMarkup(result.summary) +
        diffCellMarkup(result) +
        savedCellMarkup() +
      '</div>' +
    '</div>';
  }
  // ===== Рендер =====

  // Значение textarea читаем перед перерисовкой: полная пересборка иначе
  // съедала бы курсор на каждом символе.
  function readFields(container) {
    var left = container.querySelector('#chg-left');
    var right = container.querySelector('#chg-right');
    var leftLabel = container.querySelector('#chg-left-label');
    var rightLabel = container.querySelector('#chg-right-label');
    if (left) state.left = left.value;
    if (right) state.right = right.value;
    if (leftLabel) state.leftLabel = leftLabel.value;
    if (rightLabel) state.rightLabel = rightLabel.value;
  }

  function render(container) {
    readFields(container);
    container.innerHTML = shellMarkup();
    syncIcons();
  }

  // Набор текста перерисовывает только сводку и ленту: сами textarea остаются
  // на месте, поэтому позиция курсора не прыгает.
  function refreshDiff(container) {
    var result = analyze();
    var summary = container.querySelector('.chg-cell--summary');
    if (summary) summary.outerHTML = summaryCellMarkup(result.summary);
    var diff = container.querySelector('.chg-cell--diff');
    if (diff) diff.outerHTML = diffCellMarkup(result);
    var toolbar = container.querySelector('.agent-controls-panel');
    if (toolbar) toolbar.outerHTML = toolbarMarkup(result.summary);
    syncIcons();
  }

  // ===== Выгрузка =====

  function download(content, filename) {
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function copyText(container, text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        setStatus(container, t('lab.changeGenerator.copied', 'Скопировано.'), 'success');
      }).catch(function() { fallbackCopy(container, text); });
      return;
    }
    fallbackCopy(container, text);
  }

  function fallbackCopy(container, text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'absolute';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
    document.body.removeChild(area);
    setStatus(container,
      ok ? t('lab.changeGenerator.copied', 'Скопировано.')
        : t('lab.changeGenerator.copyFailed', 'Браузер запретил копирование — выгрузите diff.'),
      ok ? 'success' : 'error');
  }
  // ===== События =====

  function saveCase(container) {
    readFields(container);
    if (!state.left.trim() && !state.right.trim()) {
      setStatus(container, t('lab.changeGenerator.nothingToSave', 'Нечего сохранять: обе версии пусты.'), 'error');
      return;
    }
    var summary = analyze().summary;
    var name = (state.leftLabel || '').trim() || t('lab.changeGenerator.versionA', 'Версия А');
    state.cases.unshift({
      name: name,
      left: state.left,
      right: state.right,
      leftLabel: state.leftLabel,
      rightLabel: state.rightLabel,
      ignoreCase: state.ignoreCase,
      ignoreSpace: state.ignoreSpace,
      added: summary.added,
      removed: summary.removed,
      changed: summary.changed,
      at: Date.now()
    });
    state.cases = state.cases.slice(0, CASE_LIMIT);
    persist();
    render(container);
    setStatus(container, t('lab.changeGenerator.savedOk', 'Сравнение сохранено.'), 'success');
  }

  function bind(container) {
    // Набор текста: сводка и лента обновляются на лету, поля не трогаем.
    ['chg-left', 'chg-right'].forEach(function(id) {
      var node = container.querySelector('#' + id);
      if (!node) return;
      node.addEventListener('input', function() {
        state[id === 'chg-left' ? 'left' : 'right'] = node.value;
        refreshDiff(container);
      });
    });
    ['chg-left-label', 'chg-right-label'].forEach(function(id) {
      var node = container.querySelector('#' + id);
      if (!node) return;
      node.addEventListener('input', function() {
        state[id === 'chg-left-label' ? 'leftLabel' : 'rightLabel'] = node.value;
        refreshDiff(container);
      });
    });

    container.addEventListener('click', function(event) {
      var toggle = event.target.closest('[data-chg-toggle]');
      if (toggle) {
        var key = toggle.getAttribute('data-chg-toggle');
        state[key] = !state[key];
        render(container);
        return;
      }

      var view = event.target.closest('[data-chg-view]');
      if (view) {
        state.view = view.getAttribute('data-chg-view');
        render(container);
        return;
      }

      if (event.target.closest('#chg-swap')) {
        readFields(container);
        var left = state.left;
        state.left = state.right;
        state.right = left;
        var leftLabel = state.leftLabel;
        state.leftLabel = state.rightLabel;
        state.rightLabel = leftLabel;
        render(container);
        return;
      }

      if (event.target.closest('#chg-save')) { saveCase(container); return; }

      var restore = event.target.closest('[data-chg-restore]');
      if (restore) {
        var item = state.cases[Number(restore.getAttribute('data-chg-restore'))];
        if (item) {
          state.left = item.left;
          state.right = item.right;
          state.leftLabel = item.leftLabel;
          state.rightLabel = item.rightLabel;
          state.ignoreCase = item.ignoreCase;
          state.ignoreSpace = item.ignoreSpace;
          render(container);
        }
        return;
      }

      var remove = event.target.closest('[data-chg-delete]');
      if (remove) {
        state.cases.splice(Number(remove.getAttribute('data-chg-delete')), 1);
        persist();
        render(container);
        setStatus(container, t('lab.changeGenerator.deleted', 'Сравнение удалено.'), 'success');
        return;
      }

      if (event.target.closest('#chg-export')) {
        download(toUnified(), diffFileName());
        setStatus(container, t('lab.changeGenerator.exported', 'Файл выгружен.'), 'success');
        return;
      }

      if (event.target.closest('#chg-copy')) {
        copyText(container, toUnified());
      }
    });
  }

  function diffFileName() {
    var base = (state.leftLabel || '').trim() || 'compare';
    return base.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-') + '.diff';
  }

  // ===== Точка входа =====

  function init(container) {
    if (!container) return;
    state.cases = loadCases();
    render(container);
    bind(container);
  }

  window.ChangeGenerator = { init: init, render: init, toUnified: toUnified, diffLines: diffLines };
})(window, document);
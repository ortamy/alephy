/**
 * board-library.js — Архив досок v2
 * Bug #5 fix: Array.find → filter, alert → LabModal
 */

const BoardLib = (function() {
  'use strict';

  const STORAGE_KEY = 'alephy_boards';

  function init() {
    render();
  }

  function getBoards() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) {
      return [];
    }
  }

  function render() {
    var boards = getBoards();
    var list = document.getElementById('bl-list');
    var empty = document.getElementById('bl-empty');

    if (boards.length === 0) {
      if (list) list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';
    var html = '<div class="tool-grid">';

    boards.slice().reverse().forEach(function(board) {
      var date = new Date(board.timestamp);
      var dateStr = date.toLocaleString('ru-RU');
      var conclusion = board.conclusion || '(без вывода)';
      var evidenceCount = board.evidence ? board.evidence.length : 0;

      html += '<div class="lab-card" style="cursor:pointer;" onclick="BoardLib.view(' + board.id + ')">';
      html += '  <div class="lab-card-header" style="font-size:16px;">' + escapeHtml(board.title || 'Без названия') + '</div>';
      html += '  <div class="lab-card-body">';
      html += '    <div class="text-small text-muted">' + dateStr + '</div>';
      html += '    <div class="text-small mt-8">' + escapeHtml(conclusion.substring(0, 100)) + '</div>';
      html += '    <div class="text-small text-muted mt-8">📌 ' + evidenceCount + ' улик</div>';
      html += '  </div>';
      html += '</div>';
    });

    html += '</div>';
    if (list) list.innerHTML = html;
  }

  function view(id) {
    var boards = getBoards();
    // filter вместо find для совместимости
    var filtered = boards.filter(function(b) { return b.id === id; });
    var board = filtered.length > 0 ? filtered[0] : null;
    if (!board) return;

    var content = '🏛 ДОСКА: ' + (board.title || 'Без названия') + '\n';
    content += '═══════════════════════════════\n';
    content += 'ВЫВОД: ' + (board.conclusion || '—') + '\n\n';

    if (board.evidence && board.evidence.length > 0) {
      content += 'УЛИКИ:\n';
      board.evidence.forEach(function(ev, i) {
        content += '  ' + (i+1) + '. ' + (ev.text || ev) + '\n';
      });
    }

    if (board.attachments && board.attachments.length > 0) {
      content += '\nВЛОЖЕНИЯ:\n';
      board.attachments.forEach(function(att, i) {
        content += '  ' + (i+1) + '. ' + (att.title || att.name || att) + '\n';
      });
    }

    content += '\n═══════════════════════════════\n';
    content += new Date(board.timestamp).toLocaleString('ru-RU');

    // Используем LabModal вместо alert
    if (window.LabModal) {
      var body = '<pre style="font-family:monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;">' + escapeHtml(content) + '</pre>';
var footer = '<button class="lab-btn lab-btn-primary lab-btn-sm" onclick="LabExport.copyText(' + JSON.stringify(content) + ')"><img src="assets/icons/32/scribe/scroll.png" width="32" height="32" alt="Копировать" style="vertical-align: middle; margin-right: 6px;"> Копировать</button>' +
        '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabExport.exportTXT(\'' + (board.title || 'board') + '\', ' + JSON.stringify(content) + ')">📝 TXT</button>' +
        '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>';
LabModal.show('<img src="assets/icons/32/scribe/scrolls.png" width="32" height="32" alt="Доска" style="vertical-align: middle; margin-right: 6px;"> ' + escapeHtml(board.title || 'Просмотр доски'), body, footer);
    } else {
      // fallback
      alert(content);
    }
  }

  function clearAll() {
    if (confirm('Удалить все сохранённые доски?')) {
      localStorage.removeItem(STORAGE_KEY);
      render();
    }
  }

  function escapeHtml(text) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  return {
    init: init,
    render: render,
    view: view,
    clearAll: clearAll
  };
})();

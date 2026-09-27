/**
 * utils.js — общие утилиты лаборатории.
 *
 * Единственное место, где живёт экранирование HTML: раньше копия `escapeHtml`
 * была в 23 файлах в двух несовместимых вариантах (DOM-based не экранировал
 * кавычки, regex-based экранировал). Для атрибутов разница критична, поэтому
 * канон — экранировать и кавычки тоже.
 *
 * Подключается ПЕРВЫМ из js/ в index.html: остальные модули вызывают
 * escapeHtml на этапе рендера и должны видеть готовый AlephyUtils.
 */
window.AlephyUtils = (function () {
  'use strict';

  // textContent → innerHTML экранирует &, <, >; кавычки добавляем сами.
  // DOM-путь выбран вместо ручного regex: он не ломается от новых
  // HTML-сущностей и не требует синхронизации списка символов.
  var ESCAPES = { '"': '&quot;', "'": '&#39;' };

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"']/g, function (character) {
      if (character === '&') return '&amp;';
      if (character === '<') return '&lt;';
      if (character === '>') return '&gt;';
      return ESCAPES[character];
    });
  }

  return { escapeHtml: escapeHtml };
})();

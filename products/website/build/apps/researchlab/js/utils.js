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

  /**
   * Общий кеш JSON по URL.
   *
   * Один и тот же файл тянули восемь модулей, каждый своим fetch():
   * roots.json (177 КБ) — dashboard, club-data, etymology-lab, investigation,
   * learn, paleo-builder, root-dictionary, scripture-reader. В сумме это
   * повторные парсинг и трафик при каждом входе в лабораторию.
   *
   * Параллельные вызовы одного URL получают один и тот же промис, поэтому
   * «десять модулей открылись сразу» не превращается в десять запросов.
   */
  var jsonCache = new Map();

  function fetchJson(url, options) {
    if (!jsonCache.has(url)) {
      var request = fetch(url, options)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status + ' для ' + url);
          return response.json();
        })
        // Провал не кешируем: следующий вызов должен суметь повторить.
        .catch(function (error) {
          jsonCache.delete(url);
          throw error;
        });
      jsonCache.set(url, request);
    }
    return jsonCache.get(url);
  }

  function clearJsonCache(url) {
    if (url) jsonCache.delete(url);
    else jsonCache.clear();
  }

  return {
    escapeHtml: escapeHtml,
    fetchJson: fetchJson,
    clearJsonCache: clearJsonCache
  };
})();

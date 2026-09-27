/**
 * name-decoder.js — палео-сборка имени как последовательности функций.
 */
(function(window, document) {
  'use strict';

  var LETTERS = {
    a: { symbol: '𐤀', hebrew: 'א', name: 'Алеф', meaning: 'сила и начало' },
    i: { symbol: '𐤉', hebrew: 'י', name: 'Йод', meaning: 'рука и действие' },
    b: { symbol: '𐤁', hebrew: 'ב', name: 'Бет', meaning: 'вместилище и дом' },
    v: { symbol: '𐤅', hebrew: 'ו', name: 'Вав', meaning: 'связь и сцепление' },
    g: { symbol: '𐤂', hebrew: 'ג', name: 'Гимель', meaning: 'движение и перенос' },
    d: { symbol: '𐤃', hebrew: 'ד', name: 'Далет', meaning: 'проход и вход' },
    e: { symbol: '𐤄', hebrew: 'ה', name: 'Хей', meaning: 'дыхание и проявление' },
    z: { symbol: '𐤆', hebrew: 'ז', name: 'Заин', meaning: 'инструмент и действие' },
    j: { symbol: '𐤉', hebrew: 'י', name: 'Йод', meaning: 'рука и действие' },
    k: { symbol: '𐤊', hebrew: 'כ', name: 'Каф', meaning: 'удержание и ладонь' },
    l: { symbol: '𐤋', hebrew: 'ל', name: 'Ламед', meaning: 'направление и посох' },
    m: { symbol: '𐤌', hebrew: 'מ', name: 'Мем', meaning: 'поток и движение' },
    n: { symbol: '𐤍', hebrew: 'נ', name: 'Нун', meaning: 'жизнь и продолжение' },
    o: { symbol: '𐤏', hebrew: 'ע', name: 'Айн', meaning: 'видение и источник' },
    p: { symbol: '𐤐', hebrew: 'פ', name: 'Пей', meaning: 'речь и выход' },
    r: { symbol: '𐤓', hebrew: 'ר', name: 'Реш', meaning: 'голова и начало' },
    s: { symbol: '𐤑', hebrew: 'צ', name: 'Цади', meaning: 'натяжение и цель' },
    t: { symbol: '𐤕', hebrew: 'ת', name: 'Тав', meaning: 'знак и печать' },
    u: { symbol: '𐤅', hebrew: 'ו', name: 'Вав', meaning: 'связь и сцепление' },
    f: { symbol: '𐤐', hebrew: 'פ', name: 'Пей', meaning: 'речь и выход' },
    h: { symbol: '𐤄', hebrew: 'ה', name: 'Хей', meaning: 'дыхание и проявление' },
    c: { symbol: '𐤊', hebrew: 'כ', name: 'Каф', meaning: 'удержание и ладонь' },
    y: { symbol: '𐤉', hebrew: 'י', name: 'Йод', meaning: 'рука и действие' },
    x: { symbol: '𐤑', hebrew: 'צ', name: 'Цади', meaning: 'натяжение и цель' }
  };

  var CYRILLIC_TO_LATIN = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 's', ч: 'c', ш: 's', щ: 's', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'u', я: 'a'
  };

  function escapeHtml(value) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(value)
      : String(value == null ? '' : value);
  }

  function transliterate(value) {
    return String(value || '').toLowerCase().split('').map(function(character) {
      return Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN, character) ? CYRILLIC_TO_LATIN[character] : character;
    }).join('').replace(/[^a-z]/g, '');
  }

  function decode(value) {
    var latin = transliterate(value);
    var letters = latin.split('').map(function(character) { return LETTERS[character] || null; }).filter(Boolean);
    var functions = letters.map(function(letter) { return letter.meaning; });
    return { original: value, latin: latin, letters: letters, paleo: letters.map(function(letter) { return letter.symbol; }).join(''), hebrew: letters.map(function(letter) { return letter.hebrew; }).join(''), purpose: functions.length ? ' → ' + functions.join(' → ') + '.' : 'Недостаточно букв для сборки инструкции.' };
  }

  function renderResult(result, target) {
    if (!result.letters.length) {
      target.innerHTML = '<div class="lab-alert lab-alert-info">Введите имя латиницей или кириллицей.</div>';
      return;
    }
    target.innerHTML = '<article class="lab-card name-decoder-paleo-card"><div class="lab-card-header">Палео-написание</div><div class="lab-card-body name-decoder-paleo" lang="hbo">' + escapeHtml(result.paleo) + '</div><div class="name-decoder-hebrew" lang="he" dir="rtl">' + escapeHtml(result.hebrew) + '</div><p class="name-decoder-transliteration">' + escapeHtml(result.original) + ' → ' + escapeHtml(result.latin) + '</p></article>' +
      '<section class="name-decoder-letter-grid" aria-label="Разбор букв">' + result.letters.map(function(letter, index) { return '<article class="lab-card name-decoder-letter-card"><span class="name-decoder-letter-index">0' + (index + 1) + '</span><span class="name-decoder-letter-paleo">' + escapeHtml(letter.symbol) + '</span><h3>' + escapeHtml(letter.name) + '</h3><p>' + escapeHtml(letter.meaning) + '</p></article>'; }).join('') + '</section>' +
      '<article class="lab-card name-decoder-purpose"><div class="lab-card-header">Возможная инструкция имени</div><div class="lab-card-body"><p>' + escapeHtml(result.purpose) + '</p><small>Это палео-гипотеза для самостоятельного исследования: имя собирается как последовательность функций, а не как готовый перевод.</small></div></article>';
  }

  function init(container) {
    if (!container || container.dataset.nameDecoderReady === '1') return;
    container.dataset.nameDecoderReady = '1';
    fetch('pages/name-decoder.html').then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }).then(function(html) {
      container.innerHTML = html;
      var form = container.querySelector('#name-decoder-form');
      var input = container.querySelector('#name-decoder-input');
      var result = container.querySelector('#name-decoder-result');
      form.addEventListener('submit', function(event) { event.preventDefault(); renderResult(decode(input.value.trim()), result); });
      input.focus();
    }).catch(function(error) { container.innerHTML = '<div class="lab-alert lab-alert-error">Дешифратор не загрузился: ' + escapeHtml(error.message) + '</div>'; });
  }

  window.NameDecoder = { init: init, decode: decode, transliterate: transliterate };
})(window, document);
/**
 * plural.js — системное русское склонение счётчиков для всего лаба.
 * Использование: LabPlural(n, 'термин', 'термина', 'терминов') -> '21 термин'.
 * ES5, без зависимостей; подключается до page-controller.js.
 */
(function (global) {
  'use strict';

  function labPlural(n, one, few, many) {
    n = Math.abs(Number(n) || 0);
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return n + ' ' + one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return n + ' ' + few;
    return n + ' ' + many;
  }

  global.LabPlural = labPlural;

  /* Только слово, без числа — для лейблов над цифрой («5» / «корней»). */
  function labPluralWord(n, one, few, many) {
    return labPlural(n, one, few, many).replace(/^[\d\s]+/, '');
  }

  global.LabPluralWord = labPluralWord;
})(window);
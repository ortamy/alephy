(function(window) {
  'use strict';

  // Базовый ряд из 22 букв: знак, образ и действие хранятся рядом.
  var PALEO_LETTERS = [
    { hebrew: 'א', paleo: '𐤀', name: 'Алеф', image: 'бык', meaning: 'сила', translit: 'A' },
    { hebrew: 'ב', paleo: '𐤁', name: 'Бет', image: 'дом', meaning: 'вместилище', translit: 'B' },
    { hebrew: 'ג', paleo: '𐤂', name: 'Гимел', image: 'верблюд', meaning: 'движение', translit: 'G' },
    { hebrew: 'ד', paleo: '𐤃', name: 'Далет', image: 'дверь', meaning: 'вход', translit: 'D' },
    { hebrew: 'ה', paleo: '𐤄', name: 'Хе', image: 'дыхание', meaning: 'откровение', translit: 'H' },
    { hebrew: 'ו', paleo: '𐤅', name: 'Вав', image: 'крюк', meaning: 'связь', translit: 'W' },
    { hebrew: 'ז', paleo: '𐤆', name: 'Зайн', image: 'оружие', meaning: 'инструмент', translit: 'Z' },
    { hebrew: 'ח', paleo: '𐤇', name: 'Хет', image: 'ограда', meaning: 'отделение', translit: 'Ḥ' },
    { hebrew: 'ט', paleo: '𐤈', name: 'Тет', image: 'змея', meaning: 'оборачивание', translit: 'Ṭ' },
    { hebrew: 'י', paleo: '𐤉', name: 'Йод', image: 'рука', meaning: 'действие', translit: 'Y' },
    { hebrew: 'כ', paleo: '𐤊', name: 'Каф', image: 'ладонь', meaning: 'удержание', translit: 'K' },
    { hebrew: 'ל', paleo: '𐤋', name: 'Ламед', image: 'посох', meaning: 'направление', translit: 'L' },
    { hebrew: 'מ', paleo: '𐤌', name: 'Мем', image: 'вода', meaning: 'течение', translit: 'M' },
    { hebrew: 'נ', paleo: '𐤍', name: 'Нун', image: 'рыба', meaning: 'жизнь', translit: 'N' },
    { hebrew: 'ס', paleo: '𐤎', name: 'Самех', image: 'опора', meaning: 'поддержка', translit: 'S' },
    { hebrew: 'ע', paleo: '𐤏', name: 'Айн', image: 'глаз', meaning: 'видение', translit: 'Ẹ' },
    { hebrew: 'פ', paleo: '𐤐', name: 'Пе', image: 'рот', meaning: 'речь', translit: 'P' },
    { hebrew: 'צ', paleo: '𐤑', name: 'Цаде', image: 'крюк', meaning: 'праведность', translit: 'Ṣ' },
    { hebrew: 'ק', paleo: '𐤒', name: 'Коф', image: 'игла', meaning: 'отделённость', translit: 'Q' },
    { hebrew: 'ר', paleo: '𐤓', name: 'Реш', image: 'голова', meaning: 'начало', translit: 'R' },
    { hebrew: 'ש', paleo: '𐤔', name: 'Шин', image: 'зуб', meaning: 'разрушение', translit: 'Š' },
    { hebrew: 'ת', paleo: '𐤕', name: 'Тав', image: 'знак', meaning: 'печать', translit: 'T' }
  ];

  var rootsPromise = null;
  var activeContainer = null;
  var assembly = [];

  function normalizeHebrew(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/[ךםןףץ]/g, function(letter) {
        return { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[letter];
      })
      .replace(/[\s\-]/g, '');
  }

  function findLetter(hebrew) {
    return PALEO_LETTERS.filter(function(letter) { return letter.hebrew === hebrew; })[0];
  }

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function renderPalette(container) {
    var palette = container.querySelector('[data-paleo-palette]');
    if (!palette) return;
    palette.innerHTML = '';
    PALEO_LETTERS.forEach(function(letter, index) {
      var card = makeElement('button', 'paleo-letter-card');
      card.type = 'button';
      card.draggable = true;
      card.dataset.letterIndex = String(index);
      card.setAttribute('aria-label', letter.name + ': ' + letter.image + ', ' + letter.meaning);
      card.title = letter.name + ' — ' + letter.image + ' · ' + letter.meaning;
      // Компактный чип 36px: только знак; имя/образ/значение — в title и aria-label.
      card.textContent = letter.paleo;
      card.addEventListener('click', function() { addLetter(index); });
      card.addEventListener('dragstart', function(event) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', String(index));
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', function() { card.classList.remove('is-dragging'); });
      palette.appendChild(card);
    });
  }

  function addLetter(index) {
    if (!PALEO_LETTERS[index]) return;
    assembly.push(PALEO_LETTERS[index]);
    renderAssembly();
  }

  function renderAssembly() {
    if (!activeContainer) return;
    var letters = activeContainer.querySelector('[data-workspace-letters]');
    var empty = activeContainer.querySelector('[data-workspace-empty]');
    var count = activeContainer.querySelector('[data-workspace-count]');
    var summary = activeContainer.querySelector('[data-assembly-summary]');
    if (!letters || !empty || !count || !summary) return;

    letters.innerHTML = '';
    assembly.forEach(function(letter, index) {
      var item = makeElement('div', 'workspace-letter');
      item.setAttribute('role', 'listitem');
      var glyph = makeElement('span', 'workspace-letter-glyph', letter.paleo);
      var hebrew = makeElement('span', 'workspace-letter-hebrew', letter.hebrew);
      var remove = makeElement('button', 'workspace-letter-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Убрать букву ' + letter.name);
      remove.title = 'Убрать ' + letter.name;
      remove.addEventListener('click', function() { removeLetterAt(index); });
      item.appendChild(glyph);
      item.appendChild(hebrew);
      item.appendChild(remove);
      letters.appendChild(item);
    });

    empty.hidden = assembly.length > 0;
    count.textContent = String(assembly.length);

    summary.innerHTML = '';
    if (!assembly.length) {
      summary.appendChild(makeElement('span', 'sum-placeholder', 'Поле пусто'));
    } else {
      var hebrewWord = assembly.map(function(letter) { return letter.hebrew; }).join('');
      var translit = assembly.map(function(letter) { return letter.translit; }).join('·');
      var meaning = assembly.map(function(letter) { return letter.image + '·' + letter.meaning; }).join(' + ');
      var word = makeElement('span', 'sum-hebrew', hebrewWord);
      word.dir = 'rtl';
      word.lang = 'hbo';
      summary.appendChild(word);
      summary.appendChild(makeElement('span', 'sum-translit', translit));
      summary.appendChild(makeElement('span', 'sum-meaning', meaning));
    }

    var result = activeContainer.querySelector('[data-dictionary-result]');
    if (result) result.innerHTML = '';
  }

  function bindWorkspace(container) {
    var dropZone = container.querySelector('[data-drop-zone]');
    if (!dropZone) return;
    dropZone.addEventListener('dragover', function(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('is-over');
    });
    dropZone.addEventListener('dragleave', function(event) {
      if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('is-over');
    });
    dropZone.addEventListener('drop', function(event) {
      event.preventDefault();
      dropZone.classList.remove('is-over');
      var index = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(index)) addLetter(index);
      var status = container.querySelector('[data-drop-status]');
      if (status) status.textContent = 'Знак добавлен в последовательность.';
    });
    dropZone.addEventListener('keydown', function(event) {
      if (event.key === 'Backspace' || event.key === 'Delete') removeLast();
    });
  }

  function removeLast() {
    if (!assembly.length) return;
    assembly.pop();
    renderAssembly();
  }

  function removeLetterAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= assembly.length) return;
    assembly.splice(index, 1);
    renderAssembly();
  }

  function clearAssembly() {
    assembly = [];
    renderAssembly();
    if (activeContainer) {
      var status = activeContainer.querySelector('[data-drop-status]');
      if (status) status.textContent = 'Поле очищено. Готово к новой сборке.';
    }
  }

  function loadRoots() {
    if (Array.isArray(window._roots)) return Promise.resolve(window._roots);
    if (!rootsPromise) {
      rootsPromise = fetch('data/roots/roots.json').then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
    }
    return rootsPromise;
  }

  function showDictionaryResult(result, root) {
    result.innerHTML = '';
    if (!root) {
      result.appendChild(makeElement('div', 'lab-alert lab-alert-info', 'Такой последовательности нет в корневом словаре. Сохраните сборку как самостоятельную гипотезу и проверьте соседние формы.'));
      return;
    }
    var card = makeElement('div', 'dictionary-match');
    card.appendChild(makeElement('strong', 'dictionary-match-title', 'Найдено в словаре: ' + (root.translit || root.root)));
    card.appendChild(makeElement('div', 'dictionary-match-root', root.root || ''));
    if (root.meaning) card.appendChild(makeElement('p', '', root.meaning));
    if (root.image) card.appendChild(makeElement('p', 'dictionary-image', 'Образ: ' + root.image));
    if (Array.isArray(root.examples) && root.examples.length) {
      var examples = makeElement('ul', 'dictionary-examples');
      root.examples.slice(0, 3).forEach(function(example) { examples.appendChild(makeElement('li', '', example)); });
      card.appendChild(examples);
    }
    result.appendChild(card);
  }

  function checkDictionary() {
    if (!activeContainer || !assembly.length) return;
    var result = activeContainer.querySelector('[data-dictionary-result]');
    if (!result) return;
    result.innerHTML = '';
    result.appendChild(makeElement('div', 'lab-alert lab-alert-info', 'Проверяем последовательность в словаре…'));
    var hebrew = assembly.map(function(letter) { return letter.hebrew; }).join('');
    var paleo = assembly.map(function(letter) { return letter.paleo; }).join('');
    loadRoots().then(function(roots) {
      var normalized = normalizeHebrew(hebrew);
      var match = roots.filter(function(root) {
        var rootHebrew = normalizeHebrew(root.root);
        var rootPaleo = Array.isArray(root.paleo) ? root.paleo.join('') : String(root.paleo || '');
        return rootHebrew === normalized || rootPaleo === paleo;
      })[0];
      showDictionaryResult(result, match);
    }).catch(function(error) {
      result.innerHTML = '';
      result.appendChild(makeElement('div', 'lab-alert lab-alert-error', 'Не удалось загрузить корневой словарь: ' + error.message));
    });
  }

  function init(container) {
    if (!container || container.dataset.builderInitialized) return;
    container.dataset.builderInitialized = '1';
    activeContainer = container;
    assembly = [];
    renderPalette(container);
    bindWorkspace(container);
    var checkBtn = container.querySelector('[data-action="check"]');
    if (checkBtn) checkBtn.addEventListener('click', checkDictionary);
    var removeBtn = container.querySelector('[data-action="remove"]');
    if (removeBtn) removeBtn.addEventListener('click', removeLast);
    var clearBtn = container.querySelector('[data-action="clear"]');
    if (clearBtn) clearBtn.addEventListener('click', clearAssembly);
    renderAssembly();
  }

  window.PaleoBuilder = {
    init: init,
    letters: PALEO_LETTERS
  };
})(window);
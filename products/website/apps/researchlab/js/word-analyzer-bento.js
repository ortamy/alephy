/*
 * word-analyzer-bento.js — развёрнутый разбор слова для #word-analyzer.
 *
 * Канон оформления: DESIGN-SYSTEM §5.2d (бенто на 12 колонок, hairline,
 * тени = 0, шапка ячейки по §4.1).
 *
 * Источники данных (общие для лаборатории, не локальный словарь модуля):
 *   data/roots/roots.json     — корни: image, examples, paleoMeanings, substitutions
 *   data/dictionaries.json    — 21 группа подмен: word, hebrew, paleo, restored
 *
 * Принцип честности: ячейка без данных не выдумывает значения, а молчит
 * (.wab-empty). Морфология помечена как интерпретация (§6), не факт.
 */
(function (window) {
  'use strict';

  var ROOTS_URL = 'data/roots/roots.json';
  var DICTS_URL = 'data/dictionaries.json';

  var cache = { roots: null, dicts: null, promise: null };
  var state = { roots: [], dicts: [], layers: [], current: null };

  function esc(value) {
    var node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  // Иврит без никкуда и огласовок — для сопоставления с ключами баз.
  function strip(word) {
    return String(word || '').replace(/[\u0591-\u05C7]/g, '');
  }

  function loadJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' — ' + url);
      return response.json();
    });
  }

  // Базис нужен один раз: оба файла читаются параллельно, повторные вызовы
  // ждут тот же промис.
  function ensureData() {
    if (state.roots.length && state.dicts.length) return Promise.resolve(state);
    if (cache.promise) return cache.promise;
    cache.promise = Promise.all([loadJson(ROOTS_URL), loadJson(DICTS_URL)])
      .then(function (result) {
        state.roots = Array.isArray(result[0]) ? result[0] : [];
        state.dicts = result[1] && typeof result[1] === 'object' ? result[1] : {};
        state.layers = Object.keys(state.dicts).map(function (key) {
          return { key: key, title: state.dicts[key].title || key, terms: state.dicts[key].terms || [] };
        });
        cache.roots = state.roots;
        cache.dicts = state.dicts;
        return state;
      })
      .catch(function (error) {
        // Нет данных — модуль продолжает работать на локальном словаре,
        // бенто не рисуется вовсе, но и не ломает разбор.
        cache.promise = null;
        throw error;
      });
    return cache.promise;
  }

  function findRoot(rootHeb) {
    var target = strip(rootHeb);
    if (!target) return null;
    for (var i = 0; i < state.roots.length; i++) {
      if (strip(state.roots[i].root) === target) return state.roots[i];
    }
    return null;
  }

  // Ближайший корень, входящий в слово: слово длиннее корня, значит есть аффикс.
  function findRootInWord(wordHeb) {
    var target = strip(wordHeb);
    if (!target) return null;
    var best = null;
    for (var i = 0; i < state.roots.length; i++) {
      var root = strip(state.roots[i].root);
      if (!root || root === target) continue;
      if (target.indexOf(root) === -1) continue;
      if (!best || root.length > strip(best.root).length) best = state.roots[i];
    }
    return best;
  }

  function findLayers(wordHeb) {
    var target = strip(wordHeb);
    if (!target) return [];
    var hits = [];
    state.layers.forEach(function (layer) {
      layer.terms.forEach(function (term) {
        if (strip(term.hebrew) !== target) return;
        hits.push({ layer: layer.title, word: term.word, hebrew: term.hebrew, paleo: term.paleo || [], restored: term.restored || '' });
      });
    });
    return hits;
  }

  function cellHead(num, title, hint) {
    return '<header class="wab-cell-head"><span class="wab-num">' + esc(num) + '</span>' +
      '<span class="wab-cell-title">' + esc(title) + '</span>' +
      (hint ? '<span class="wab-cell-hint">' + esc(hint) + '</span>' : '') + '</header>';
  }

  function emptyCell(mod, num, title, hint) {
    return '<section class="' + mod + '" aria-label="' + esc(title) + '">' + cellHead(num, title, hint) +
      '<p class="wab-empty">В базе нет данных для этого слова.</p></section>';
  }

  // Ячейка 5: паспорт корня — палео-образ, смысл, живые примеры.
  // Сквозная нумерация страницы: ячейки 01–04 задаёт каркас #word-analyzer,
  // развёрнутый разбор продолжает её с 05.
  function rootCell(rootData, wordHeb) {
    if (!rootData) return emptyCell('wab-cell wab-cell--root', '05', 'Корень', wordHeb);
    var examples = (rootData.examples || []).slice(0, 6).map(function (example) {
      var parts = String(example).split('—');
      var hebrew = parts[0].trim();
      var note = parts.slice(1).join('—').trim();
      return '<li class="wab-example"><span class="wab-example-heb">' + esc(hebrew) + '</span>' +
        (note ? '<span class="wab-example-note">' + esc(note) + '</span>' : '') + '</li>';
    }).join('');
    return '<section class="wab-cell wab-cell--root" aria-label="Паспорт корня">' +
      cellHead('01', 'Корень', rootData.translit || '') +
      '<p class="wab-root-word hebrew">' + esc(rootData.root) + '</p>' +
      ((rootData.paleo || []).length
        ? '<p class="wab-paleo-strip">' + rootData.paleo.map(function (glyph) {
            return '<span class="wab-paleo-glyph">' + esc(glyph) + '</span>';
          }).join('') + '</p>'
        : '') +
      '<p class="wab-root-meaning">' + esc(rootData.meaning || '') + '</p>' +
      (rootData.image ? '<p class="wab-root-image">' + esc(rootData.image) + '</p>' : '') +
      (examples ? '<ul class="wab-examples">' + examples + '</ul>' : '') +
      '</section>';
  }

  // Ячейка 06: буквы как орудия — палео-знак и смысл каждой буквы.
  function lettersCell(wordHeb, paleo) {
    var target = strip(wordHeb);
    var items = [];
    for (var i = 0; i < target.length; i++) {
      var letter = target[i];
      var info = paleo && paleo[letter];
      items.push('<span class="wab-letter">' +
        '<span class="wab-letter-heb">' + esc(letter) + '</span>' +
        (info ? '<span class="wab-letter-paleo" aria-hidden="true">' + esc(info.paleo) + '</span>' : '') +
        (info ? '<span class="wab-letter-meaning">' + esc(info.meaning) + '</span>' : '') +
        '</span>');
    }
    if (!items.length) return emptyCell('wab-cell wab-cell--letters', '06', 'Буквы как орудия', '');
    return '<section class="wab-cell wab-cell--letters" aria-label="Буквы как орудия">' +
      cellHead('06', 'Буквы как орудия', target.length + ' знаков') +
      '<div class="wab-letters">' + items.join('') + '</div></section>';
  }

  // Ячейка 07: слои подмены — слово против того, чем его заменили.
  function chainCell(layers) {
    if (!layers.length) return emptyCell('wab-cell wab-cell--chain', '07', 'Слои подмены', 'слов не найдено');
    var items = layers.map(function (hit) {
      return '<div class="wab-chain-item">' +
        '<span class="wab-chain-layer">' + esc(hit.layer) + '</span>' +
        '<span class="wab-chain-term">' + esc(hit.word) + '</span>' +
        (hit.hebrew ? '<span class="wab-chain-heb">' + esc(hit.hebrew) + '</span>' : '') +
        (hit.restored ? '<span class="wab-chain-restored">' + esc(hit.restored) + '</span>' : '') +
        '</div>';
    }).join('');
    return '<section class="wab-cell wab-cell--chain" aria-label="Слои подмены">' +
      cellHead('07', 'Слои подмены', layers.length + ' слоёв') +
      '<div class="wab-chain">' + items + '</div>' +
      '<p class="wab-caveat">Слой подмены — зафиксированная в базе связь. Прежде чем считать замену состоявшейся, сверьте её через Давар, Ор и критерий эмет / шекер.</p>' +
      '</section>';
  }

  // Ячейка 08: аффиксы. Интерпретация формы, а не факт (§6).
  function morphCell(wordHeb, exactRoot, rootInWord) {
    var target = strip(wordHeb);
    var parts = [];
    var chosen = null;

    if (rootInWord) {
      chosen = rootInWord;
      var rootText = strip(rootInWord.root);
      var at = target.indexOf(rootText);
      if (at > 0) {
        parts.push({ text: target.slice(0, at), kind: 'affix' });
        parts.push({ text: rootText, kind: 'root' });
        if (at + rootText.length < target.length) parts.push({ text: target.slice(at + rootText.length), kind: 'affix' });
      } else {
        parts.push({ text: target.slice(0, target.length - rootText.length), kind: 'affix' });
        parts.push({ text: rootText, kind: 'root' });
      }
    } else if (exactRoot) {
      chosen = exactRoot;
      parts.push({ text: strip(exactRoot.root), kind: 'root' });
    }

    if (!chosen) return emptyCell('wab-cell wab-cell--morph', '08', 'Форма слова', 'корень не найден');

    var markup = parts.map(function (part) {
      return '<span class="wab-morph-part wab-morph-part--' + part.kind + '">' + esc(part.text) + '</span>';
    }).join('<span aria-hidden="true">+</span>');

    return '<section class="wab-cell wab-cell--morph" aria-label="Форма слова">' +
      cellHead('08', 'Форма слова', chosen.translit || '') +
      '<p class="wab-morph-form hebrew">' + esc(target) + '</p>' +
      '<div class="wab-morph-parts">' + markup + '</div>' +
      '<p class="wab-caveat">Разбор формы — интерпретация, а не факт: корень выбран по совпадению с базой. Проверьте его через Ор и Хук.</p>' +
      '</section>';
  }

  // Ячейка 09: родственники — те же корни, что и в базе roots.json.
  function kinCell(rootData, currentWord) {
    if (!rootData) return emptyCell('wab-cell wab-cell--kin', '09', 'Родственники', 'корень не найден');
    var seen = {};
    seen[strip(currentWord)] = true;
    var kin = [];
    state.roots.forEach(function (item) {
      if (strip(item.root) !== strip(rootData.root)) return;
      (item.examples || []).forEach(function (example) {
        var hebrew = String(example).split('—')[0].trim();
        if (!hebrew || seen[strip(hebrew)]) return;
        seen[strip(hebrew)] = true;
        kin.push(hebrew);
      });
    });
    if (!kin.length) return emptyCell('wab-cell wab-cell--kin', '09', 'Родственники', 'в базе нет');
    return '<section class="wab-cell wab-cell--kin" aria-label="Родственники">' +
      cellHead('09', 'Родственники', kin.length + ' слов') +
      '<div class="wab-chips">' + kin.map(function (word) {
        return '<button type="button" class="wab-chip" data-wab-pick="' + esc(word) + '">' + esc(word) + '</button>';
      }).join('') + '</div></section>';
  }

  // Ячейка 10: соседние слова — чипы неразобранного, модуль становится навигацией.
  function moreCell(pending, onPick) {
    var words = (pending || []).filter(function (word) { return word !== state.current; });
    if (!words.length) return emptyCell('wab-cell wab-cell--more', '10', 'Соседние слова', 'всё разобрано');
    return '<section class="wab-cell wab-cell--more" aria-label="Соседние слова">' +
      cellHead('10', 'Соседние слова', words.length + ' в очереди') +
      '<div class="wab-chips">' + words.map(function (word) {
        return '<button type="button" class="wab-chip" data-wab-pick="' + esc(word) + '">' + esc(word) + '</button>';
      }).join('') + '</div></section>';
  }

  function renderBento(host, payload) {
    var word = payload.word;
    var wordHeb = payload.hebrew || word;
    var exactRoot = findRoot(payload.root || wordHeb);
    var rootInWord = exactRoot ? null : findRootInWord(wordHeb);
    var layers = findLayers(wordHeb);

    // Порядок задан бездырной раскладкой §5.2d: 05+06 — строка 1,
    // 08 встаёт в строку 2 справа от паспорта корня, 09+10 делят
    // строку 3 (5 + 7), слои подмены (07) замыкают во всю ширину.
    host.innerHTML = '<div class="wab-bento">' +
      rootCell(exactRoot || rootInWord, wordHeb) +
      lettersCell(wordHeb, payload.paleo) +
      morphCell(wordHeb, exactRoot, rootInWord) +
      kinCell(exactRoot || rootInWord, wordHeb) +
      moreCell(payload.pending || [], null) +
      chainCell(layers) +
      '</div>';
  }

  // Точка входа: вызывается модулем WordAnalyzer после успешного разбора.
  function show(word, payload) {
    var host = document.getElementById('wa-bento');
    if (!host) return Promise.resolve();
    state.current = word;
    return ensureData().then(function () {
      renderBento(host, Object.assign({ word: word }, payload || {}));
      return true;
    }).catch(function () {
      // База недоступна (офлайн, битый файл) — разбор остаётся, бенто молчит.
      host.innerHTML = '';
      return false;
    });
  }

  function bindChips(host, onPick) {
    host.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-wab-pick]');
      if (!chip) return;
      onPick(chip.getAttribute('data-wab-pick'));
    });
  }

  window.WordBento = {
    show: show,
    bindChips: bindChips,
    load: ensureData
  };
})(window);



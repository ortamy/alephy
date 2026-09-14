/**
 * paleo-keyboard.js вЂ” В«РџР°Р»РµРѕ-РєР»Р°РІРёР°С‚СѓСЂР°В» v4 (РґРёР·Р°Р№РЅ-СЏР·С‹Рє В«РџР°Р»РµРѕ-РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР°В»)
 *
 * РџРёСЃСЊРјРµРЅРЅРѕСЃС‚Рё Р±РµСЂСѓС‚СЃСЏ РёР· data/paleo-linguistics/evolution.json:
 *   paleo_hebrew, phoenician, imperial_aramaic вЂ” 22 РіР»РёС„Р° РЅР° РЅР°Р±РѕСЂ;
 *   proto_canaanite вЂ” РІ РґР°РЅРЅС‹С… С‚РѕР»СЊРєРѕ РѕРїРёСЃР°РЅРёСЏ (glyph: null) в†’ С‡РёРї disabled В«РіРѕС‚РѕРІРёС‚СЃСЏВ»;
 *   square вЂ” РЅР°Р±РѕСЂР° РІ РґР°РЅРЅС‹С… РЅРµС‚ в†’ С‡РёРї disabled В«РіРѕС‚РѕРІРёС‚СЃСЏВ».
 * Р’СЃС‚Р°РІРєР° РёРґС‘С‚ РІ РїРѕР·РёС†РёСЋ РєСѓСЂСЃРѕСЂР°, РїРѕРґ СЃС‚СЂРѕРєРѕР№ СЃС‡РёС‚Р°РµС‚СЃСЏ С‚СЂР°РЅСЃР»РёС‚РµСЂР°С†РёСЏ,
 * С‚СѓРјР±Р»РµСЂ В«Р¤РёР·РёС‡РµСЃРєР°СЏ РєР»Р°РІРёР°С‚СѓСЂР°В» РјР°РїРїРёС‚ Р»Р°С‚РёРЅСЃРєРёРµ РєР»Р°РІРёС€Рё РЅР° РіР»РёС„С‹ Р°РєС‚РёРІРЅРѕР№ РїРёСЃСЊРјРµРЅРЅРѕСЃС‚Рё,
 * Backspace/Delete СѓРґР°Р»СЏСЋС‚ РіР»РёС„ РєР°Рє РµРґРёРЅРёС†Сѓ (РіР»РёС„С‹ РёРјРїРµСЂСЃРєРѕРіРѕ Р°СЂР°РјРµР№СЃРєРѕРіРѕ вЂ” СЃСѓСЂСЂРѕРіР°С‚РЅР°СЏ РїР°СЂР°),
 * РёСЃС‚РѕСЂРёСЏ С…СЂР°РЅРёС‚ 5 РїРѕСЃР»РµРґРЅРёС… СЃС‚СЂРѕРє.
 * РћС„Р»Р°Р№РЅ-fallback: СЃРЅРёРјРѕРє РЅР°Р±РѕСЂРѕРІ РІ localStorage, РїСЂРё РµРіРѕ РѕС‚СЃСѓС‚СЃС‚РІРёРё вЂ” degraded-state СЃ В«РџРѕРІС‚РѕСЂРёС‚СЊВ».
 */

const PaleoKey = (function() {
  'use strict';

  var DATA_URL = 'data/paleo-linguistics/evolution.json';
  var CACHE_KEY = 'alephy_pk_letters';
  var WRITING_KEY = 'alephy_pk_writing';
  var PHYSICAL_KEY = 'alephy_pk_physical';
  var HISTORY_KEY = 'alephy_pk_history';
  var HISTORY_LIMIT = 5;

  /* РќР°Р±РѕСЂС‹ РїРёСЃСЊРјРµРЅРЅРѕСЃС‚РµР№ РІ РїРѕСЂСЏРґРєРµ РґР°РЅРЅС‹С…. */
  var WRITINGS = [
    { key: 'proto_canaanite', label: 'РџСЂРѕС‚Рѕ-С…Р°РЅР°Р°РЅ' },
    { key: 'paleo_hebrew', label: 'РџР°Р»РµРѕ-РёРІСЂРёС‚' },
    { key: 'phoenician', label: 'Р¤РёРЅРёРєРёР№СЃРєРёР№' },
    { key: 'imperial_aramaic', label: 'РРјРїРµСЂСЃРєРёР№ Р°СЂР°РјРµР№СЃРєРёР№' },
    { key: 'square', label: 'РљРІР°РґСЂР°С‚РЅС‹Р№' }
  ];
  var DEFAULT_WRITING = 'paleo_hebrew';

  /* Р›Р°С‚РёРЅСЃРєРёРµ РєР»Р°РІРёС€Рё С„РёР·РёС‡РµСЃРєРѕР№ РєР»Р°РІРёР°С‚СѓСЂС‹: РѕРґРЅР° РєР»Р°РІРёС€Р° РЅР° Р±СѓРєРІСѓ (Р°Р»РµС„ в†’ С‚Р°РІ). */
  var PHYSICAL_KEYS = ['A', 'B', 'G', 'D', 'H', 'V', 'Z', 'X', 'T', 'Y', 'K',
    'L', 'M', 'N', 'S', 'E', 'P', 'C', 'Q', 'R', 'W', 'J'];
  var KEY_INDEX = {};
  PHYSICAL_KEYS.forEach(function(key, idx) { KEY_INDEX[key] = idx; });

  var letters = [];        // [{ id, name, sound, meaning, glyphs: { writing: glyph } }]
  var glyphIndex = {};     // glyph в†’ letter (РґР»СЏ С‚СЂР°РЅСЃР»РёС‚РµСЂР°С†РёРё РІСЃРµР№ СЃС‚СЂРѕРєРё)
  var writing = DEFAULT_WRITING;
  var physical = true;
  var activeIdx = -1;
  var activeField = null;
  var keyboardListenerAttached = false;

  /* ===== РРќРР¦РРђР›РР—РђР¦РРЇ ===== */

  function init() {
    var output = document.getElementById('pk-output');
    if (!output) return;

    writing = readValue(WRITING_KEY) || DEFAULT_WRITING;
    physical = readValue(PHYSICAL_KEY) !== 'off';
    syncPhysical();

    attachListeners();
    renderHistory();
    renderWritings();
    renderKeys();
    afterTextChange();

    loadLetters().then(function() {
      writing = pickWriting(writing);
      renderWritings();
      renderKeys();
      afterTextChange();
    });
  }

  /* ===== Р”РђРќРќР«Р• РџРРЎР¬РњР•РќРќРћРЎРўР•Р™ ===== */

  function loadLetters() {
    return fetch(DATA_URL, { cache: 'no-cache' }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function(rows) {
      letters = normalize(rows);
      if (!letters.length) throw new Error('РџСѓСЃС‚РѕР№ РЅР°Р±РѕСЂ РїРёСЃСЊРјРµРЅРЅРѕСЃС‚РµР№');
      indexGlyphs();
      writeValue(CACHE_KEY, JSON.stringify(letters));
    }).catch(function() {
      /* РћС„Р»Р°Р№РЅ: СЂР°Р±РѕС‚Р°РµРј РЅР° СЃРЅРёРјРєРµ РёР· localStorage, РёРЅР°С‡Рµ РїРѕРєР°Р·С‹РІР°РµРј degraded-state. */
      var cached = readValue(CACHE_KEY);
      letters = [];
      if (cached) {
        try { letters = JSON.parse(cached) || []; } catch (error) { letters = []; }
      }
      indexGlyphs();
    });
  }

  function normalize(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.filter(function(row) {
      return row && row.id;
    }).map(function(row) {
      var glyphs = {};
      var stages = row.stages || {};
      Object.keys(stages).forEach(function(stage) {
        var value = stages[stage] && stages[stage].glyph;
        glyphs[stage] = value || '';
      });
      return {
        id: row.id,
        name: row.name || row.id,
        sound: row.sound || '',
        meaning: row.meaning || '',
        glyphs: glyphs
      };
    });
  }

  function indexGlyphs() {
    glyphIndex = {};
    letters.forEach(function(letter) {
      Object.keys(letter.glyphs).forEach(function(stage) {
        var glyph = letter.glyphs[stage];
        if (glyph && !glyphIndex[glyph]) glyphIndex[glyph] = letter;
      });
    });
  }

  function hasGlyphs(key) {
    return letters.some(function(letter) { return Boolean(letter.glyphs[key]); });
  }

  function pickWriting(key) {
    if (key && hasGlyphs(key)) return key;
    if (hasGlyphs(DEFAULT_WRITING)) return DEFAULT_WRITING;
    var first = WRITINGS.filter(function(item) { return hasGlyphs(item.key); })[0];
    return first ? first.key : key || DEFAULT_WRITING;
  }

  function writingLabel(key) {
    var item = WRITINGS.filter(function(entry) { return entry.key === key; })[0];
    return item ? item.label : key;
  }

  /* ===== Р Р•РќР”Р•Р : Р§РРџР« РџРРЎР¬РњР•РќРќРћРЎРўР•Р™ ===== */

  function renderWritings() {
    var box = document.getElementById('pk-writings');
    if (!box) return;
    var html = '';
    WRITINGS.forEach(function(item) {
      var available = hasGlyphs(item.key);
      html += '<button type="button" class="pk-writing-chip" id="pk-writing-' + item.key + '"' +
        ' role="radio" data-writing="' + item.key + '"' +
        ' aria-checked="' + (item.key === writing ? 'true' : 'false') + '"' +
        (available ? '' : ' disabled') +
        ' aria-label="РџРёСЃСЊРјРµРЅРЅРѕСЃС‚СЊ: ' + item.label + (available ? '' : ', РЅР°Р±РѕСЂ РіРѕС‚РѕРІРёС‚СЃСЏ') + '">' +
        '<span class="pk-writing-label">' + item.label + '</span>' +
        (available ? '' : '<span class="pk-writing-note">РіРѕС‚РѕРІРёС‚СЃСЏ</span>') +
        '</button>';
    });
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('.pk-writing-chip'), function(chip) {
      chip.addEventListener('click', function() {
        setWriting(chip.getAttribute('data-writing'));
      });
    });
  }

  function setWriting(key) {
    if (!key || key === writing || !hasGlyphs(key)) return;
    writing = key;
    writeValue(WRITING_KEY, writing);
    renderWritings();
    renderKeys();
    hideInfo();
  }

  /* ===== Р Р•РќР”Р•Р : РЎР•РўРљРђ РљР›РђР’РРЁ ===== */

  function activeEntries() {
    var entries = [];
    letters.forEach(function(letter, idx) {
      var glyph = letter.glyphs[writing];
      if (glyph) entries.push({ idx: idx, glyph: glyph, letter: letter });
    });
    return entries;
  }

  function renderKeys() {
    var container = document.getElementById('pk-keys');
    if (!container) return;
    var entries = activeEntries();
    setBadge('pk-keys-count', entries.length);

    if (!entries.length) {
      container.innerHTML = '<div class="pk-keys-empty"><span class="pk-empty-glyph" aria-hidden="true">рђ¤•</span>' +
        '<strong>РќР°Р±РѕСЂ РїРёСЃСЊРјРµРЅРЅРѕСЃС‚РµР№ РЅРµРґРѕСЃС‚СѓРїРµРЅ</strong>' +
        '<span>РџСЂРѕРІРµСЂСЊС‚Рµ СЃРѕРµРґРёРЅРµРЅРёРµ Рё РїРѕРІС‚РѕСЂРёС‚Рµ Р·Р°РіСЂСѓР·РєСѓ.</span>' +
        '<button type="button" class="lab-btn lab-btn-secondary pk-retry" onclick="PaleoKey.reload()">РџРѕРІС‚РѕСЂРёС‚СЊ</button></div>';
      activeIdx = -1;
      return;
    }

    var html = '';
    entries.forEach(function(entry) {
      var key = PHYSICAL_KEYS[entry.idx] || '';
      html += '<button type="button" class="pk-key" id="pk-key-' + entry.idx + '"' +
        ' data-index="' + entry.idx + '"' +
        ' aria-label="Р’СЃС‚Р°РІРёС‚СЊ ' + entry.letter.name + ' (' + entry.glyph + ')">' +
        '<span class="pk-key-symbol" data-fallback="' + key + '">' + entry.glyph + '</span>' +
        (key ? '<span class="pk-key-hint">' + key + '</span>' : '') +
        '</button>';
    });
    container.innerHTML = html;

    Array.prototype.forEach.call(container.querySelectorAll('.pk-key'), function(key) {
      var idx = Number(key.getAttribute('data-index'));
      key.addEventListener('click', function() { selectLetter(idx); });
      key.addEventListener('mouseenter', function() { showInfo(idx); });
      key.addEventListener('focus', function() { showInfo(idx); });
    });

    if (activeIdx >= 0 && !document.getElementById('pk-key-' + activeIdx)) activeIdx = -1;
  }

  /* ===== РљРђР РўРћР§РљРђ Р‘РЈРљР’Р« ===== */

  function showInfo(idx) {
    var letter = letters[idx];
    var glyph = letter && letter.glyphs[writing];
    if (!letter || !glyph) return;
    var infoEl = document.getElementById('pk-info');
    var titleEl = document.getElementById('pk-info-title');
    var bodyEl = document.getElementById('pk-info-body');
    if (titleEl) {
      titleEl.innerHTML = '<span class="pk-info-glyph" data-fallback="' + PHYSICAL_KEYS[idx] + '">' + glyph + '</span>' +
        '<span class="pk-info-name">' + letter.name + '</span>' +
        (letter.sound ? '<span class="pk-info-sound">[' + letter.sound + ']</span>' : '');
    }
    if (bodyEl) {
      bodyEl.innerHTML =
        '<p class="pk-info-row"><strong>РћР±СЂР°Р· Рё Р·РЅР°С‡РµРЅРёРµ:</strong> ' + letter.meaning + '</p>' +
        '<p class="pk-info-row"><strong>РџРёСЃСЊРјРµРЅРЅРѕСЃС‚СЊ:</strong> ' + writingLabel(writing) + '</p>';
    }
    if (infoEl) infoEl.hidden = false;
  }

  function hideInfo() {
    var infoEl = document.getElementById('pk-info');
    if (infoEl) infoEl.hidden = true;
  }

  /* ===== РўРЈРњР‘Р›Р•Р  Р¤РР—РР§Р•РЎРљРћР™ РљР›РђР’РРђРўРЈР Р« ===== */

  function setPhysical(on) {
    physical = Boolean(on);
    writeValue(PHYSICAL_KEY, physical ? 'on' : 'off');
    syncPhysical();
  }

  function syncPhysical() {
    var toggle = document.getElementById('pk-physical');
    if (toggle) toggle.checked = physical;
    var keys = document.getElementById('pk-keys');
    if (keys) keys.setAttribute('data-physical', physical ? 'on' : 'off');
  }

  /* ===== РџРћР›Р• РЎРўР РћРљР Р РЎР§РЃРўР§РРљР ===== */

  function isTextField(element) {
    if (!element || element.disabled || element.readOnly) return false;
    return element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' ||
      element.isContentEditable;
  }

  function getOutput() {
    var module = document.getElementById('paleo-keyboard');
    var output = document.getElementById('pk-output');
    if (activeField && document.contains(activeField) && module &&
        module.contains(activeField)) return activeField;
    return output;
  }

  function getText(field) {
    if (!field) return '';
    return field.value != null ? field.value : field.textContent;
  }

  function setText(field, text) {
    if (!field) return;
    if (field.value != null) field.value = text;
    else field.textContent = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function countUnits(text) {
    return Array.from ? Array.from(text).length : text.length;
  }

  /* РЎС‡С‘С‚С‡РёРє Р·РЅР°РєРѕРІ, empty-state СЃС‚СЂРѕРєРё Рё С‚СЂР°РЅСЃР»РёС‚РµСЂР°С†РёСЏ вЂ” РїРѕСЃР»Рµ Р»СЋР±РѕРіРѕ РёР·РјРµРЅРµРЅРёСЏ С‚РµРєСЃС‚Р°. */
  function afterTextChange() {
    var output = getOutput();
    var text = output ? getText(output) : '';
    setBadge('pk-text-count', countUnits(text));
    var empty = document.getElementById('pk-empty');
    if (empty) empty.hidden = text.length > 0;
    renderTranslit(text);
  }

  /* РўСЂР°РЅСЃР»РёС‚РµСЂР°С†РёСЏ: РіР»РёС„ в†’ В«РРјСЏ [Р·РІСѓРє]В», С‡РµСЂРµР· В« В· В», Р»Р°С‚РёРЅРёС†Р° СЃР»РµРІР° РЅР°РїСЂР°РІРѕ. */
  function renderTranslit(text) {
    var el = document.getElementById('pk-translit');
    var chars = Array.from ? Array.from(text) : text.split('');
    if (!el) return;
    var parts = [];
    chars.forEach(function(ch) {
      if (!ch.trim()) return;
      var letter = glyphIndex[ch];
      parts.push(letter ? letter.name + ' [' + letter.sound + ']' : ch);
    });
    if (!parts.length) {
      el.textContent = '';
      el.hidden = true;
      return;
    }
    el.textContent = parts.join(' В· ');
    el.hidden = false;
  }

  /* ===== Р’РЎРўРђР’РљРђ Р“Р›РР¤Рђ Р’ РџРћР—РР¦РР® РљРЈР РЎРћР Рђ ===== */

  function selectLetter(idx) {
    if (idx < 0 || idx >= letters.length) return;
    var letter = letters[idx];
    var glyph = letter.glyphs[writing];
    if (!glyph) {
      showToast('РќР°Р±РѕСЂ В«' + writingLabel(writing) + 'В» РіРѕС‚РѕРІРёС‚СЃСЏ');
      return;
    }
    var output = getOutput();
    if (output) {
      var text = getText(output);
      var start = output.selectionStart != null ? output.selectionStart : text.length;
      var end = output.selectionEnd != null ? output.selectionEnd : text.length;
      setText(output, text.slice(0, start) + glyph + text.slice(end));
      if (output.selectionStart != null) {
        try {
          output.selectionStart = output.selectionEnd = start + glyph.length;
        } catch (error) { /* РїРѕР»Рµ Р±РµР· РїРѕРґРґРµСЂР¶РєРё РІС‹РґРµР»РµРЅРёСЏ */ }
      }
      output.focus();
    }
    highlightKey(idx);
    showInfo(idx);
    afterTextChange();
  }

  function highlightKey(idx) {
    if (activeIdx >= 0) {
      var prev = document.getElementById('pk-key-' + activeIdx);
      if (prev) prev.classList.remove('is-active');
    }
    activeIdx = idx;
    var el = document.getElementById('pk-key-' + idx);
    if (el) el.classList.add('is-active');
  }

  function clearOutput() {
    var output = getOutput();
    if (output) {
      setText(output, '');
      output.focus();
    }
    if (activeIdx >= 0) {
      var el = document.getElementById('pk-key-' + activeIdx);
      if (el) el.classList.remove('is-active');
      activeIdx = -1;
    }
    hideInfo();
    afterTextChange();
  }

  function copy() {
    var output = getOutput();
    var text = getText(output);
    if (!text) {
      showToast('РќРµС‡РµРіРѕ РєРѕРїРёСЂРѕРІР°С‚СЊ');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() { onCopied(text); })
        .catch(function() { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }

    function fallbackCopy(value) {
      if (output && output.select) output.select();
      document.execCommand('copy');
      onCopied(value);
    }

    function onCopied(value) {
      pushHistory(value);
      showToast('РЎРєРѕРїРёСЂРѕРІР°РЅРѕ');
    }
  }

  /* ===== РРЎРўРћР РРЇ: 5 РџРћРЎР›Р•Р”РќРРҐ РЎРўР РћРљ ===== */

  function readHistory() {
    var raw = readValue(HISTORY_KEY);
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter(function(item) { return typeof item === 'string'; }).slice(0, HISTORY_LIMIT);
    } catch (error) {
      return [];
    }
  }

  function pushHistory(text) {
    var value = String(text || '').trim();
    if (!value) return;
    var list = readHistory().filter(function(item) { return item !== value; });
    list.unshift(value);
    writeValue(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    renderHistory();
  }

  function commit() {
    var output = getOutput();
    var text = output ? getText(output).trim() : '';
    if (!text) {
      showToast('РЎС‚СЂРѕРєР° РїСѓСЃС‚Р°');
      return;
    }
    pushHistory(text);
    showToast('РЎС‚СЂРѕРєР° СЃРѕС…СЂР°РЅРµРЅР° РІ РёСЃС‚РѕСЂРёРё');
  }

  function renderHistory() {
    var box = document.getElementById('pk-history');
    if (!box) return;
    var list = readHistory();
    setBadge('pk-history-count', list.length);
    if (!list.length) {
      box.innerHTML = '<p class="pk-history-empty">РќР°Р±РµСЂРёС‚Рµ СЃС‚СЂРѕРєСѓ Рё РЅР°Р¶РјРёС‚Рµ Enter вЂ” РѕРЅР° РѕСЃС‚Р°РЅРµС‚СЃСЏ Р·РґРµСЃСЊ.</p>';
      return;
    }
    var html = '';
    list.forEach(function(item, idx) {
      html += '<button type="button" class="pk-history-chip" data-history="' + idx + '" dir="rtl"' +
        ' title="' + escapeHtml(item) + '" aria-label="Р’РµСЂРЅСѓС‚СЊ СЃС‚СЂРѕРєСѓ РІ РІРІРѕРґ">' +
        '<span class="pk-history-chip-text" data-fallback="' + escapeHtml(item) + '">' +
        escapeHtml(item) + '</span></button>';
    });
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('.pk-history-chip'), function(chip) {
      chip.addEventListener('click', function() {
        useHistory(Number(chip.getAttribute('data-history')));
      });
    });
  }

  function useHistory(idx) {
    var value = readHistory()[idx];
    if (value == null) return;
    var output = getOutput();
    if (!output) return;
    setText(output, value);
    try {
      output.selectionStart = output.selectionEnd = value.length;
    } catch (error) { /* РїРѕР»Рµ Р±РµР· РїРѕРґРґРµСЂР¶РєРё РІС‹РґРµР»РµРЅРёСЏ */ }
    output.focus();
    afterTextChange();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ===== РЎРћР‘Р«РўРРЇ ===== */

  function attachListeners() {
    var output = document.getElementById('pk-output');
    if (output && !output.dataset.pkBound) {
      output.dataset.pkBound = '1';
      output.addEventListener('input', function() { afterTextChange(); });
      output.addEventListener('keydown', onFieldKeydown);
      output.addEventListener('focus', function() { activeField = output; });
    }
    if (keyboardListenerAttached) return;
    keyboardListenerAttached = true;

    document.addEventListener('focusin', function(event) {
      var module = document.getElementById('paleo-keyboard');
      if (!module || !module.classList.contains('active')) return;
      if (isTextField(event.target) && module.contains(event.target)) activeField = event.target;
    });
    document.addEventListener('keydown', onDocumentKeydown);
  }

  /* Р¤РёР·РёС‡РµСЃРєР°СЏ РєР»Р°РІРёР°С‚СѓСЂР°: Р»Р°С‚РёРЅСЃРєР°СЏ РєР»Р°РІРёС€Р° РІСЃС‚Р°РІР»СЏРµС‚ РіР»РёС„ Р°РєС‚РёРІРЅРѕР№ РїРёСЃСЊРјРµРЅРЅРѕСЃС‚Рё. */
  function onDocumentKeydown(event) {
    if (!physical || event.ctrlKey || event.metaKey || event.altKey) return;
    var module = document.getElementById('paleo-keyboard');
    if (!module || !module.classList.contains('active')) return;
    var focused = document.activeElement;
    if (!isTextField(focused) || !module.contains(focused)) return;
    if (!event.key) return;
    var idx = KEY_INDEX[event.key.toUpperCase()];
    if (idx === undefined) return;
    event.preventDefault();
    selectLetter(idx);
  }

  /* Enter СЃРѕС…СЂР°РЅСЏРµС‚ СЃС‚СЂРѕРєСѓ РІ РёСЃС‚РѕСЂРёСЋ; Backspace/Delete СѓРґР°Р»СЏСЋС‚ РіР»РёС„ РєР°Рє РµРґРёРЅРёС†Сѓ (SMP = 2 РєРѕРґР° UTF-16). */
  function onFieldKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    var field = event.target;
    if (field.value == null || field.selectionStart == null) return;
    var start = field.selectionStart;
    var end = field.selectionEnd;
    if (start !== end) return; /* РІС‹РґРµР»РµРЅРёРµ СѓРґР°Р»СЏРµС‚ Р±СЂР°СѓР·РµСЂ СЃР°Рј */
    var text = field.value;
    var caret = start;

    if (event.key === 'Backspace') {
      if (start === 0) return;
      event.preventDefault();
      /* Р РµР¶РµРј РїРѕ РєРѕРґРѕРІС‹Рј С‚РѕС‡РєР°Рј: РіР»РёС„С‹ РёРјРїРµСЂСЃРєРѕРіРѕ Р°СЂР°РјРµР№СЃРєРѕРіРѕ вЂ” СЃСѓСЂСЂРѕРіР°С‚РЅР°СЏ РїР°СЂР°. */
      var head = Array.from(text.slice(0, start));
      head.pop();
      var headText = head.join('');
      field.value = headText + text.slice(start);
      caret = headText.length;
    } else {
      if (end >= text.length) return;
      event.preventDefault();
      var tail = Array.from(text.slice(end));
      tail.shift();
      field.value = text.slice(0, start) + tail.join('');
    }

    field.selectionStart = caret;
    field.selectionEnd = caret;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ===== Р’РќР•РЁРќРР• Р”Р•Р™РЎРўР’РРЇ РњРћР”РЈР›РЇ ===== */

  function analyzeInEtymology() {
    var output = getOutput();
    var text = getText(output).trim();
    if (!text) {
      showToast('Р’РІРµРґРё СЃР»РѕРІРѕ РґР»СЏ СЂР°Р·Р±РѕСЂР°');
      return;
    }
    pushHistory(text);
    if (window.LabRouter) LabRouter.navigate('etymology-checker');
    setTimeout(function() {
      var input = document.getElementById('el-input');
      if (input) input.value = text;
      if (window.EtymologyLab) EtymologyLab.analyze();
    }, 150);
  }

  function downloadAsPng() {
    var output = getOutput();
    var text = getText(output).trim();
    if (!text) {
      showToast('Р’РІРµРґРё СЃР»РѕРІРѕ РґР»СЏ СЃРєР°С‡РёРІР°РЅРёСЏ');
      return;
    }
    var fontSize = 80;
    var pad = 40;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = fontSize + 'px "Times New Roman", serif';
    var textW = ctx.measureText(text).width;
    canvas.width = Math.max(300, textW + pad * 2);
    canvas.height = fontSize + pad * 2;
    ctx.fillStyle = '#faf3e0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5a3e1b';
    ctx.font = fontSize + 'px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    var link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'paleo-' + Date.now() + '.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('PNG СЃРєР°С‡Р°РЅ');
  }

  function showToast(message) {
    var toast = document.getElementById('pk-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pk-toast';
      toast.className = 'pk-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    toast.style.display = 'block';
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.style.display = 'none'; }, 300);
    }, 2000);
  }

  /* ===== РҐР РђРќРР›РР©Р• Р РЎР§РЃРўР§РРљР ===== */

  function readValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) { /* РїСЂРёРІР°С‚РЅС‹Р№ СЂРµР¶РёРј вЂ” СЂР°Р±РѕС‚Р°РµРј Р±РµР· СЃРѕС…СЂР°РЅРµРЅРёСЏ */ }
  }

  function setBadge(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  /* РџРѕРІС‚РѕСЂРЅР°СЏ Р·Р°РіСЂСѓР·РєР° РЅР°Р±РѕСЂРѕРІ РїРѕСЃР»Рµ СЃРµС‚РµРІРѕР№ РѕС€РёР±РєРё. */
  function reload() {
    var container = document.getElementById('pk-keys');
    if (container) {
      container.innerHTML = '<div class="pk-keys-empty"><strong>Р—Р°РіСЂСѓР·РєР° РЅР°Р±РѕСЂРѕРІвЂ¦</strong></div>';
    }
    loadLetters().then(function() {
      writing = pickWriting(writing);
      renderWritings();
      renderKeys();
      afterTextChange();
    });
  }

  return {
    init: init,
    reload: reload,
    refresh: renderKeys,
    selectLetter: selectLetter,
    insert: selectLetter,
    setWriting: setWriting,
    setPhysical: setPhysical,
    commit: commit,
    useHistory: useHistory,
    copy: copy,
    clear: clearOutput,
    showInfo: showInfo,
    hideInfo: hideInfo,
    analyzeInEtymology: analyzeInEtymology,
    downloadAsPng: downloadAsPng
  };
})();

window.PaleoKey = PaleoKey;

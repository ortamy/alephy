/**
 * paleo-keyboard.js — «Палео-клавиатура» v4 (дизайн-язык «Палео-конструктора»)
 *
 * Письменности берутся из data/paleo-linguistics/evolution.json:
 *   paleo_hebrew, phoenician, imperial_aramaic — 22 глифа на набор;
 *   proto_canaanite — в данных только описания (glyph: null) → чип disabled «готовится»;
 *   square — набора в данных нет → чип disabled «готовится».
 * Вставка идёт в позицию курсора, под строкой считается транслитерация,
 * тумблер «Физическая клавиатура» маппит латинские клавиши на глифы активной письменности,
 * Backspace/Delete удаляют глиф как единицу (глифы имперского арамейского — суррогатная пара),
 * история хранит 5 последних строк.
 * Офлайн-fallback: снимок наборов в localStorage, при его отсутствии — degraded-state с «Повторить».
 */

const PaleoKey = (function() {
  'use strict';

  var DATA_URL = 'data/paleo-linguistics/evolution.json';
  var CACHE_KEY = 'alephy_pk_letters';
  var WRITING_KEY = 'alephy_pk_writing';
  var PHYSICAL_KEY = 'alephy_pk_physical';
  var HISTORY_KEY = 'alephy_pk_history_v2';
  var HISTORY_KEY_LEGACY = 'alephy_pk_history';
  var HISTORY_LIMIT = 5;

  /* Наборы письменностей в порядке данных. */
  var WRITINGS = [
    { key: 'proto_canaanite', label: 'Прото-ханаанейское' },
    { key: 'paleo_hebrew', label: 'Палео-еврейское' },
    { key: 'phoenician', label: 'Финикийское' },
    { key: 'imperial_aramaic', label: 'Имперское арамейское' },
    { key: 'square', label: 'Квадратное' }
  ];
  var DEFAULT_WRITING = 'paleo_hebrew';

  /* Латинские клавиши физической клавиатуры: одна клавиша на букву (алеф → тав). */
  var PHYSICAL_KEYS = ['A', 'B', 'G', 'D', 'H', 'V', 'Z', 'X', 'T', 'Y', 'K',
    'L', 'M', 'N', 'S', 'E', 'P', 'C', 'Q', 'R', 'W', 'J'];
  var KEY_INDEX = {};
  PHYSICAL_KEYS.forEach(function(key, idx) { KEY_INDEX[key] = idx; });

  var letters = [];        // [{ id, name, sound, meaning, glyphs: { writing: glyph } }]
  var glyphIndex = {};     // glyph → letter (для транслитерации всей строки)
  var writing = DEFAULT_WRITING;
  var physical = true;
  var activeIdx = -1;
  var activeField = null;
  var keyboardListenerAttached = false;
  var loadState = 'idle';  // idle | loading | ready | error
  var loadToken = 0;
  var initToken = 0;

  /* ===== ИНИЦИАЛИЗАЦИЯ ===== */

  /* Вызывается page-controller'ом после рендера #paleo-keyboard.
     Идемпотентно: повторный вход перепривязывает DOM, не дублирует клавиши. */
  function init() {
    var token = ++initToken;
    ensureReady(token, 0);
  }

  function ensureReady(token, attempt) {
    if (token !== initToken) return;
    var output = document.getElementById('pk-output');
    if (output) {
      bindShell();
      if (loadState === 'ready' && letters.length) {
        renderWritings();
        renderKeys();
        afterTextChange();
        return;
      }
      loadLetters();
      return;
    }
    if (attempt >= 20) return;
    window.setTimeout(function() { ensureReady(token, attempt + 1); }, 50);
  }

  function bindShell() {
    writing = readValue(WRITING_KEY) || DEFAULT_WRITING;
    physical = readValue(PHYSICAL_KEY) !== 'off';
    migrateHistory();
    syncPhysical();
    attachListeners();
    renderHistory();
    afterTextChange();
  }

  /* ===== ДАННЫЕ ПИСЬМЕННОСТЕЙ ===== */

  function loadLetters() {
    var token = ++loadToken;
    loadState = 'loading';
    renderWritings();
    renderKeys();

    return fetch(DATA_URL, { cache: 'no-cache' }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function(rows) {
      if (token !== loadToken) return;
      var next = normalize(rows);
      if (!next.length) throw new Error('Пустой набор письменностей');
      letters = next;
      indexGlyphs();
      writeValue(CACHE_KEY, JSON.stringify(letters));
      loadState = 'ready';
      writing = pickWriting(writing);
      renderWritings();
      renderKeys();
      afterTextChange();
    }).catch(function() {
      if (token !== loadToken) return;
      var cached = readCachedLetters();
      if (cached.length) {
        letters = cached;
        indexGlyphs();
        loadState = 'ready';
        writing = pickWriting(writing);
      } else {
        letters = [];
        glyphIndex = {};
        loadState = 'error';
      }
      renderWritings();
      renderKeys();
      afterTextChange();
    });
  }

  function readCachedLetters() {
    var cached = readValue(CACHE_KEY);
    if (!cached) return [];
    try {
      var parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed.filter(function(row) {
        return row && row.id && row.glyphs && typeof row.glyphs === 'object';
      }) : [];
    } catch (error) {
      return [];
    }
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

  /* ===== РЕНДЕР: ЧИПЫ ПИСЬМЕННОСТЕЙ ===== */

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
        ' aria-label="Письменность: ' + item.label + (available ? '' : ', набор готовится') + '">' +
        '<span class="pk-writing-label">' + item.label + '</span>' +
        (available ? '' : '<span class="pk-writing-note">готовится</span>') +
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

  /* ===== РЕНДЕР: СЕТКА КЛАВИШ ===== */

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
    var entries = loadState === 'ready' ? activeEntries() : [];
    setBadge('pk-keys-count', loadState === 'error' ? '—' : entries.length);

    if (loadState === 'loading') {
      container.innerHTML = '<div class="pk-keys-empty"><span class="pk-empty-glyph" aria-hidden="true">𐤕</span>' +
        '<strong>Загрузка наборов…</strong></div>';
      activeIdx = -1;
      return;
    }

    if (loadState === 'error' || !entries.length) {
      container.innerHTML = '<div class="pk-keys-empty"><span class="pk-empty-glyph" aria-hidden="true">𐤕</span>' +
        '<strong>Данные не загрузились</strong>' +
        '<span>Проверьте соединение и повторите загрузку.</span>' +
        '<button type="button" class="lab-btn lab-btn-secondary pk-retry" onclick="PaleoKey.reload()">Повторить</button></div>';
      activeIdx = -1;
      return;
    }

    var html = '';
    entries.forEach(function(entry) {
      var key = PHYSICAL_KEYS[entry.idx] || '';
      html += '<button type="button" class="pk-key" id="pk-key-' + entry.idx + '"' +
        ' data-index="' + entry.idx + '"' +
        ' aria-label="Вставить ' + entry.letter.name + ' (' + entry.glyph + ')">' +
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

  /* ===== КАРТОЧКА БУКВЫ ===== */

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
        '<p class="pk-info-row"><strong>Образ и значение:</strong> ' + letter.meaning + '</p>' +
        '<p class="pk-info-row"><strong>Письменность:</strong> ' + writingLabel(writing) + '</p>';
    }
    if (infoEl) infoEl.hidden = false;
  }

  function hideInfo() {
    var infoEl = document.getElementById('pk-info');
    if (infoEl) infoEl.hidden = true;
  }

  /* ===== ТУМБЛЕР ФИЗИЧЕСКОЙ КЛАВИАТУРЫ ===== */

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

  /* ===== ПОЛЕ СТРОКИ И СЧЁТЧИКИ ===== */

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

  /* Счётчик знаков, empty-state строки и транслитерация — после любого изменения текста. */
  function afterTextChange() {
    var output = getOutput();
    var text = output ? getText(output) : '';
    setBadge('pk-text-count', countUnits(text));
    var empty = document.getElementById('pk-empty');
    if (empty) empty.hidden = text.length > 0;
    renderTranslit(text);
  }

  /* Транслитерация: глиф → «Имя [звук]», через « · », латиница слева направо. */
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
    el.textContent = parts.join(' · ');
    el.hidden = false;
  }

  /* ===== ВСТАВКА ГЛИФА В ПОЗИЦИЮ КУРСОРА ===== */

  function selectLetter(idx) {
    if (idx < 0 || idx >= letters.length) return;
    var letter = letters[idx];
    var glyph = letter.glyphs[writing];
    if (!glyph) {
      showToast('Набор «' + writingLabel(writing) + '» готовится');
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
        } catch (error) { /* поле без поддержки выделения */ }
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
      showToast('Нечего копировать');
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
      showToast('Скопировано');
    }
  }

  /* ===== ИСТОРИЯ: 5 ПОСЛЕДНИХ СТРОК ===== */

  /* UTF-8, прочитанный как CP1251: «П»→«Рџ», «Н»→«Рќ», «т»→«С‚». */
  var MOJIBAKE_RE = /Рџ|Рќ|С‚|вЂ|В«|В»|\u0098/;

  function isMojibake(value) {
    return MOJIBAKE_RE.test(String(value));
  }

  function parseHistory(raw) {
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter(function(item) { return typeof item === 'string' && item; });
    } catch (error) {
      return [];
    }
  }

  function migrateHistory() {
    var current = parseHistory(readValue(HISTORY_KEY)).filter(function(item) {
      return !isMojibake(item);
    });
    var legacy = parseHistory(readValue(HISTORY_KEY_LEGACY)).filter(function(item) {
      return !isMojibake(item);
    });
    var merged = current.slice();
    legacy.forEach(function(item) {
      if (merged.indexOf(item) === -1) merged.push(item);
    });
    merged = merged.slice(0, HISTORY_LIMIT);
    if (merged.length) writeValue(HISTORY_KEY, JSON.stringify(merged));
    else {
      try { window.localStorage.removeItem(HISTORY_KEY); } catch (error) { /* нет доступа */ }
    }
    try { window.localStorage.removeItem(HISTORY_KEY_LEGACY); } catch (error) { /* нет доступа */ }
  }

  function readHistory() {
    return parseHistory(readValue(HISTORY_KEY))
      .filter(function(item) { return !isMojibake(item); })
      .slice(0, HISTORY_LIMIT);
  }

  function pushHistory(text) {
    var value = String(text || '').trim();
    if (!value || isMojibake(value)) return;
    var list = readHistory().filter(function(item) { return item !== value; });
    list.unshift(value);
    writeValue(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    renderHistory();
  }

  function commit() {
    var output = getOutput();
    var text = output ? getText(output).trim() : '';
    if (!text) {
      showToast('Строка пуста');
      return;
    }
    pushHistory(text);
    showToast('Строка сохранена в истории');
  }

  function renderHistory() {
    var box = document.getElementById('pk-history');
    if (!box) return;
    var list = readHistory();
    setBadge('pk-history-count', list.length);
    if (!list.length) {
      box.innerHTML = '<p class="pk-history-empty">Наберите строку и нажмите Enter — она останется здесь.</p>';
      return;
    }
    var html = '';
    list.forEach(function(item, idx) {
      html += '<button type="button" class="pk-history-chip" data-history="' + idx + '" dir="rtl"' +
        ' title="' + escapeHtml(item) + '" aria-label="Вернуть строку в ввод">' +
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
    } catch (error) { /* поле без поддержки выделения */ }
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

  /* ===== СОБЫТИЯ ===== */

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

  /* Физическая клавиатура: латинская клавиша вставляет глиф активной письменности. */
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

  /* Enter сохраняет строку в историю; Backspace/Delete удаляют глиф как единицу (SMP = 2 кода UTF-16). */
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
    if (start !== end) return; /* выделение удаляет браузер сам */
    var text = field.value;
    var caret = start;

    if (event.key === 'Backspace') {
      if (start === 0) return;
      event.preventDefault();
      /* Режем по кодовым точкам: глифы имперского арамейского — суррогатная пара. */
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

  /* ===== ВНЕШНИЕ ДЕЙСТВИЯ МОДУЛЯ ===== */

  function analyzeInEtymology() {
    var output = getOutput();
    var text = getText(output).trim();
    if (!text) {
      showToast('Введи слово для разбора');
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
      showToast('Введи слово для скачивания');
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
    showToast('PNG скачан');
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

  /* ===== ХРАНИЛИЩЕ И СЧЁТЧИКИ ===== */

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
    } catch (error) { /* приватный режим — работаем без сохранения */ }
  }

  function setBadge(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  /* Повторная загрузка наборов после сетевой ошибки. */
  function reload() {
    loadLetters();
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

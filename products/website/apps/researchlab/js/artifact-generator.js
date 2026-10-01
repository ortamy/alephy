/**
 * artifact-generator.js — «Генератор артефактов» (#artifact-generator).
 *
 * Собирает паспорт артефакта-знака через палео-образ: форма на выбранной
 * стадии письма, её назначение и механика из «Палео-механики». Паспорт —
 * рабочий документ исследования, поэтому у него есть статус (эмет/шекер)
 * и выгрузка в Markdown.
 *
 * Данные (fetch с локальным fallback по §9 .clinerules):
 *   data/paleo-linguistics/evolution.json — 22 знака и их стадии;
 *   data/paleo-mechanics.json             — механика каждого знака.
 * Сохранённые паспорта — localStorage (метаданные, без больших текстов).
 *
 * Каркас — бенто 7+5 / 7+5 по §5.2a, тулбар — оболочка агентов (§4.7).
 */
(function(window, document) {
  'use strict';

  // Стадии письма. Ключи те же, что в evolution.json и в EVOLUTION_STAGES
  // палео-лингвистики: один словарь на три модуля.
  var STAGES = [
    { key: 'proto_canaanite', label: 'Прото-ханаанский' },
    { key: 'paleo_hebrew', label: 'Палео-еврейский' },
    { key: 'phoenician', label: 'Финикийский' },
    { key: 'imperial_aramaic', label: 'Имперский арамейский' }
  ];

  // Эмет — утверждение, шекер — реконструкция (§11 .clinerules: гипотеза не
  // выдаётся за факт, поэтому статус виден в паспорте и печатается в выгрузке).
  var CONFIDENCE = [
    { id: 'emet', label: 'Эмет', hint: 'Свидетельство есть' },
    { id: 'sheker', label: 'Шекер', hint: 'Реконструкция' }
  ];

  var STORAGE_KEY = 'alephy_artifact_generator';
  var SAVE_LIMIT = 12;

  var data = { letters: [], mechanics: null };
  var state = {
    query: '',
    stage: 'paleo_hebrew',
    letterId: '',
    confidence: 'emet',
    note: '',
    saved: [],
    dataError: ''
  };

  // ===== Утилиты =====

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

  // Каждый источник с обработкой ошибки и заглушкой: модуль обязан открыться
  // даже без сервера (§9 .clinerules), просто с честным предупреждением.
  function fetchJson(path, fallback) {
    if (window.AlephyUtils && window.AlephyUtils.fetchJson) {
      return window.AlephyUtils.fetchJson(path).catch(function() { return fallback; });
    }
    return fetch(path).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).catch(function() { return fallback; });
  }

  function stageByKey(key) {
    return STAGES.filter(function(stage) { return stage.key === key; })[0] || STAGES[0];
  }

  function confidenceById(id) {
    return CONFIDENCE.filter(function(item) { return item.id === id; })[0] || CONFIDENCE[0];
  }

  function formatTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (error) { return '—'; }
  }
  // ===== Хранилище паспортов =====

  function loadSaved() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.slice(0, SAVE_LIMIT) : [];
    } catch (error) {
      return [];
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved.slice(0, SAVE_LIMIT)));
    } catch (error) {
      // Приватный режим: паспорт просто не переживёт перезагрузку.
    }
  }

  // ===== Данные =====

  function loadData() {
    return Promise.all([
      fetchJson('data/paleo-linguistics/evolution.json', []),
      fetchJson('data/paleo-mechanics.json', null)
    ]).then(function(results) {
      data.letters = Array.isArray(results[0]) ? results[0] : [];
      data.mechanics = results[1] && typeof results[1] === 'object' ? results[1] : null;
      state.dataError = data.letters.length ? '' : t('lab.artifactGenerator.dataError', 'Реестр знаков не загружен.');
      if (!state.letterId && data.letters.length) state.letterId = data.letters[0].id;
    });
  }

  function currentLetter() {
    return data.letters.filter(function(letter) { return letter.id === state.letterId; })[0] || null;
  }

  function visibleLetters() {
    var query = state.query.trim().toLowerCase();
    if (!query) return data.letters;
    return data.letters.filter(function(letter) {
      return [letter.name, letter.hebrew, letter.sound, letter.meaning]
        .join(' ').toLowerCase().indexOf(query) !== -1;
    });
  }

  // Механика знака: paleo-mechanics.json устроен как объект по id буквы.
  function mechanicsOf(letterId) {
    return data.mechanics && data.mechanics[letterId] ? data.mechanics[letterId] : null;
  }

  // Паспорт — единственный источник и для экрана, и для выгрузки: иначе
  // Markdown расходился бы с тем, что исследователь видит.
  function buildPassport() {
    var letter = currentLetter();
    if (!letter) return null;
    var stage = stageByKey(state.stage);
    var form = (letter.stages && letter.stages[stage.key]) || null;
    var mechanics = mechanicsOf(letter.id);
    return {
      letterId: letter.id,
      name: letter.name || letter.id,
      hebrew: letter.hebrew || '',
      sound: letter.sound || '',
      meaning: letter.meaning || '',
      stageKey: stage.key,
      stageLabel: stage.label,
      period: form && form.period ? form.period : '',
      glyph: form && form.glyph ? form.glyph : '',
      placeholder: form && form.placeholder ? form.placeholder : '',
      formNote: form && form.description ? form.description : '',
      mechanicsTitle: mechanics && mechanics.title ? mechanics.title : '',
      mechanics: mechanics && mechanics.description ? mechanics.description : '',
      confidence: state.confidence,
      note: state.note.trim()
    };
  }

  // ===== Разметка =====

  function toolbarMarkup(shown) {
    return '<section class="agent-controls-panel ag-controls-panel" aria-label="Управление знаком">' +
      '<div class="agent-toolbar-row">' +
        '<input type="search" class="lab-input agents-search" id="ag-search" autocomplete="off" ' +
          'value="' + esc(state.query) + '" placeholder="Поиск по знакам: имя, иврит, значение…" ' +
          'aria-label="Поиск по знакам">' +
        '<div class="ag-chips agent-filter-chips" role="group" aria-label="Стадия письма">' +
          STAGES.map(function(stage) {
            var active = state.stage === stage.key;
            return '<button type="button" class="ag-chip' + (active ? ' is-active' : '') + '" ' +
              'data-ag-stage="' + stage.key + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
              esc(stage.label) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="agent-toolbar-actions">' +
          '<span class="pipeline-count" id="ag-count" aria-live="polite"><strong>' + shown + '</strong> из ' + data.letters.length + '</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" id="ag-save">' +
            '<i data-lucide="bookmark-plus" aria-hidden="true"></i>' + esc(t('lab.artifactGenerator.save', 'Сохранить паспорт')) + '</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function fact(label, value) {
    if (!value) return '';
    return '<div class="ag-fact"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function emptyHint(text) {
    return '<div class="lab-empty"><span class="lab-empty-glyph" aria-hidden="true">𐤊</span>' +
      '<p class="lab-empty-hint">' + esc(text) + '</p></div>';
  }
  // Ячейка 01 — выбор знака: плитки с глифом выбранной стадии.
  function lettersCellMarkup(shown) {
    var stage = stageByKey(state.stage);
    return '<section class="ag-cell ag-cell--letters">' +
        '<div class="ag-cell-head">' +
          '<span class="ag-num">01</span>' +
          '<h2 class="ag-cell-title">' + esc(t('lab.artifactGenerator.letters', 'Знак')) + '</h2>' +
          '<span class="ag-cell-hint">' + esc(stage.label) + '</span>' +
        '</div>' +
        (state.dataError
          ? '<div class="lab-alert lab-alert-error">' + esc(state.dataError) + '</div>'
          : (shown.length
            ? '<div class="ag-letters">' + shown.map(letterTileMarkup).join('') + '</div>'
            : emptyHint(t('lab.artifactGenerator.lettersEmpty', 'По запросу знаки не найдены.')))) +
      '</section>';
  }

  function letterTileMarkup(letter) {
    var active = state.letterId === letter.id;
    var form = (letter.stages && letter.stages[state.stage]) || null;
    // Глифа в данных нет у ранних стадий — показываем заглушку из данных,
    // а не пустой квадрат (тот же приём, что в палео-лингвистике).
    var glyph = form && form.glyph
      ? esc(form.glyph)
      : (form && form.placeholder
        ? '<img src="' + esc(form.placeholder) + '" width="26" height="26" alt="">'
        : esc(letter.hebrew));
    return '<button type="button" class="ag-tile' + (active ? ' is-active' : '') + '" ' +
        'data-ag-letter="' + esc(letter.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        '<span class="ag-tile-glyph">' + glyph + '</span>' +
        '<span class="ag-tile-name">' + esc(letter.name) + '</span>' +
      '</button>';
  }

  // Ячейка 02 (ink) — сам паспорт: форма, значение и статус.
  function passportCellMarkup(passport) {
    if (!passport) {
      return '<section class="ag-cell ag-cell--passport ag-cell--ink">' +
        '<div class="ag-cell-head"><span class="ag-num">02</span>' +
          '<h2 class="ag-cell-title">' + esc(t('lab.artifactGenerator.passport', 'Паспорт')) + '</h2></div>' +
        emptyHint(t('lab.artifactGenerator.passportEmpty', 'Выберите знак, чтобы собрать паспорт.')) +
      '</section>';
    }
    var confidence = confidenceById(passport.confidence);
    var glyph = passport.glyph
      ? '<span class="ag-passport-glyph">' + esc(passport.glyph) + '</span>'
      : (passport.placeholder
        ? '<img class="ag-passport-glyph" src="' + esc(passport.placeholder) + '" width="40" height="40" alt="">'
        : '<span class="ag-passport-glyph">' + esc(passport.hebrew) + '</span>');

    return '<section class="ag-cell ag-cell--passport ag-cell--ink">' +
        '<div class="ag-cell-head"><span class="ag-num">02</span>' +
          '<h2 class="ag-cell-title">' + esc(t('lab.artifactGenerator.passport', 'Паспорт')) + '</h2>' +
          '<span class="ag-cell-hint">' + esc(confidence.label) + '</span></div>' +
        '<div class="ag-passport-name">' + glyph +
          '<span><span class="ag-passport-title">' + esc(passport.name) + '</span>' +
          '<span class="ag-passport-sound">' + esc(passport.sound) + '</span></span>' +
        '</div>' +
        '<dl class="ag-facts">' +
          fact(t('lab.artifactGenerator.stage', 'Стадия'), passport.stageLabel) +
          fact(t('lab.artifactGenerator.period', 'Эпоха'), passport.period) +
          fact(t('lab.artifactGenerator.meaning', 'Значение'), passport.meaning) +
        '</dl>' +
        (passport.formNote ? '<p class="ag-passport-note">' + esc(passport.formNote) + '</p>' : '') +
        '<div class="ag-confidence" role="group" aria-label="Статус паспорта">' +
          CONFIDENCE.map(function(item) {
            var active = passport.confidence === item.id;
            return '<button type="button" class="ag-chip' + (active ? ' is-active' : '') + '" ' +
              'data-ag-confidence="' + item.id + '" aria-pressed="' + (active ? 'true' : 'false') + '" ' +
              'title="' + esc(item.hint) + '">' + esc(item.label) + '</button>';
          }).join('') +
        '</div>' +
      '</section>';
  }
  // Ячейка 03 — механика знака из «Палео-механики» плюс поле заметки.
  function mechanicsCellMarkup(passport) {
    var mechanics = passport ? mechanicsOf(passport.letterId) : null;
    return '<section class="ag-cell ag-cell--mechanics">' +
        '<div class="ag-cell-head"><span class="ag-num">03</span>' +
          '<h2 class="ag-cell-title">' + esc(t('lab.artifactGenerator.mechanics', 'Механика')) + '</h2>' +
          '<span class="ag-cell-hint">' + esc(t('lab.artifactGenerator.mechanicsHint', 'образ → функция')) + '</span></div>' +
        (mechanics
          ? '<h3 class="ag-mechanics-title">' + esc(mechanics.title) + '</h3>' +
            '<div class="ag-mechanics-body">' + esc(mechanics.description) + '</div>'
          : emptyHint(t('lab.artifactGenerator.mechanicsEmpty', 'Механика для этого знака не описана.'))) +
        '<label class="ag-field-label" for="ag-note">' + esc(t('lab.artifactGenerator.note', 'Заметка')) + '</label>' +
        '<textarea id="ag-note" class="lab-input ag-note" rows="3" maxlength="600" ' +
          'placeholder="' + esc(t('lab.artifactGenerator.notePlaceholder', 'Что этот артефакт значит для вашего исследования')) + '" ' +
          'aria-label="' + esc(t('lab.artifactGenerator.note', 'Заметка')) + '">' + esc(state.note) + '</textarea>' +
      '</section>';
  }

  // Ячейка 04 — сохранённые паспорта и выгрузка.
  function savedCellMarkup() {
    return '<section class="ag-cell ag-cell--saved">' +
        '<div class="ag-cell-head"><span class="ag-num">04</span>' +
          '<h2 class="ag-cell-title">' + esc(t('lab.artifactGenerator.saved', 'Сохранённые')) + '</h2>' +
          '<span class="ag-cell-hint">' + esc(t('lab.artifactGenerator.savedHint', 'в этом браузере')) + '</span></div>' +
        (state.saved.length
          ? '<ul class="ag-saved">' + state.saved.map(savedRowMarkup).join('') + '</ul>'
          : emptyHint(t('lab.artifactGenerator.savedEmpty', 'Сохранённых паспортов пока нет.'))) +
        '<div class="ag-actions">' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" id="ag-export-md">' +
            '<i data-lucide="download" aria-hidden="true"></i>Markdown</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" id="ag-copy-md">' +
            '<i data-lucide="copy" aria-hidden="true"></i>' + esc(t('lab.artifactGenerator.copy', 'Копировать')) + '</button>' +
        '</div>' +
        '<p class="lab-status" id="ag-status" role="status" aria-live="polite"></p>' +
      '</section>';
  }

  function savedRowMarkup(item) {
    return '<li class="ag-saved-row">' +
        '<button type="button" class="ag-saved-open" data-ag-restore="' + esc(item.letterId) + '" ' +
          'title="' + esc(t('lab.artifactGenerator.restore', 'Открыть паспорт')) + '">' +
          esc(item.name) + ' · ' + esc(item.stageLabel) + '</button>' +
        '<span class="ag-saved-badge is-' + esc(item.confidence) + '">' + esc(confidenceById(item.confidence).label) + '</span>' +
        '<span class="ag-saved-time">' + esc(formatTime(item.at)) + '</span>' +
        '<button type="button" class="ag-icon-btn" data-ag-delete="' + esc(item.letterId) + '" ' +
          'aria-label="' + esc(t('lab.artifactGenerator.delete', 'Удалить паспорт')) + '">' +
          '<i data-lucide="trash-2" aria-hidden="true"></i></button>' +
      '</li>';
  }

  function shellMarkup(shown) {
    var passport = buildPassport();
    return '<div class="ag-shell">' +
      toolbarMarkup(shown.length) +
      '<div class="ag-bento">' +
        lettersCellMarkup(shown) +
        passportCellMarkup(passport) +
        mechanicsCellMarkup(passport) +
        savedCellMarkup() +
      '</div>' +
    '</div>';
  }
  // ===== Выгрузка =====

  // Markdown собирается из того же buildPassport(), что и экран: иначе
  // выгруженный паспорт разошёлся бы с тем, что исследователь видел.
  function toMarkdown() {
    var passport = buildPassport();
    if (!passport) return '';
    var lines = [
      '# ' + passport.name + ' (' + passport.hebrew + ')',
      '',
      '- **Стадия:** ' + passport.stageLabel + (passport.period ? ' · ' + passport.period : ''),
      '- **Звук:** ' + (passport.sound || '—'),
      '- **Значение:** ' + (passport.meaning || '—'),
      '- **Статус:** ' + confidenceById(passport.confidence).label +
        ' (' + confidenceById(passport.confidence).hint.toLowerCase() + ')'
    ];
    if (passport.formNote) lines.push('', '**Форма:** ' + passport.formNote);
    if (passport.mechanics) {
      lines.push('', '## ' + (passport.mechanicsTitle || t('lab.artifactGenerator.mechanics', 'Механика')));
      lines.push('', passport.mechanics);
    }
    if (passport.note) lines.push('', '> ' + passport.note.split('\n').join('\n> '));
    return lines.join('\n');
  }

  function download(content, filename) {
    var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function setStatus(container, message, type) {
    var node = container.querySelector('#ag-status');
    if (!node) return;
    node.textContent = message || '';
    node.className = 'lab-status' + (type ? ' is-' + type : '');
  }

  // ===== Рендер =====

  function render(container) {
    var shown = visibleLetters();
    var note = container.querySelector('#ag-note');
    // Пока пользователь печатает заметку, её значение живёт в поле: перерисовка
    // ячеек иначе съедала бы курсор на каждом символе.
    if (note) state.note = note.value;
    container.innerHTML = shellMarkup(shown);
    syncIcons();
  }

  // Перерисовка только плиток и счётчика: полный render() ронял бы фокус
  // в поле поиска на каждом символе запроса.
  function refreshLetters(container) {
    var shown = visibleLetters();
    var cell = container.querySelector('.ag-cell--letters');
    if (cell) cell.outerHTML = lettersCellMarkup(shown);
    var count = container.querySelector('#ag-count strong');
    if (count) count.textContent = String(shown.length);
    syncIcons();
  }

  function refreshPassport(container) {
    var cell = container.querySelector('.ag-cell--passport');
    if (!cell) return;
    cell.outerHTML = passportCellMarkup(buildPassport());
    var mechanics = container.querySelector('.ag-cell--mechanics');
    if (mechanics) mechanics.outerHTML = mechanicsCellMarkup(buildPassport());
    syncIcons();
  }
  // ===== События =====

  function savePassport(container) {
    var passport = buildPassport();
    if (!passport) {
      setStatus(container, t('lab.artifactGenerator.noSelection', 'Сначала выберите знак.'), 'error');
      return;
    }
    var note = container.querySelector('#ag-note');
    if (note) state.note = note.value;

    var entry = {
      letterId: passport.letterId,
      name: passport.name,
      stageKey: passport.stageKey,
      stageLabel: passport.stageLabel,
      confidence: passport.confidence,
      note: state.note,
      at: Date.now()
    };
    state.saved = state.saved.filter(function(item) {
      return !(item.letterId === entry.letterId && item.stageKey === entry.stageKey);
    });
    state.saved.unshift(entry);
    state.saved = state.saved.slice(0, SAVE_LIMIT);
    persist();
    render(container);
    setStatus(container, t('lab.artifactGenerator.savedOk', 'Паспорт сохранён.'), 'success');
  }

  function bind(container) {
    var search = container.querySelector('#ag-search');
    if (search) {
      search.addEventListener('input', function() {
        state.query = search.value;
        refreshLetters(container);
      });
    }

    var note = container.querySelector('#ag-note');
    if (note) {
      note.addEventListener('input', function() { state.note = note.value; });
    }

    container.addEventListener('click', function(event) {
      var stageBtn = event.target.closest('[data-ag-stage]');
      if (stageBtn) {
        state.stage = stageBtn.getAttribute('data-ag-stage');
        render(container);
        return;
      }

      var confidenceBtn = event.target.closest('[data-ag-confidence]');
      if (confidenceBtn) {
        state.confidence = confidenceBtn.getAttribute('data-ag-confidence');
        refreshPassport(container);
        return;
      }

      var tile = event.target.closest('[data-ag-letter]');
      if (tile) {
        state.letterId = tile.getAttribute('data-ag-letter');
        refreshLetters(container);
        refreshPassport(container);
        return;
      }

      var restore = event.target.closest('[data-ag-restore]');
      if (restore) {
        state.letterId = restore.getAttribute('data-ag-restore');
        var saved = state.saved.filter(function(item) {
          return item.letterId === state.letterId;
        })[0];
        if (saved) {
          state.stage = saved.stageKey;
          state.confidence = saved.confidence;
          state.note = saved.note || '';
        }
        render(container);
        return;
      }

      var remove = event.target.closest('[data-ag-delete]');
      if (remove) {
        var id = remove.getAttribute('data-ag-delete');
        state.saved = state.saved.filter(function(item) { return item.letterId !== id; });
        persist();
        render(container);
        setStatus(container, t('lab.artifactGenerator.deleted', 'Паспорт удалён.'), 'success');
        return;
      }

      if (event.target.closest('#ag-save')) { savePassport(container); return; }

      if (event.target.closest('#ag-export-md')) {
        var markdown = toMarkdown();
        if (!markdown) {
          setStatus(container, t('lab.artifactGenerator.noSelection', 'Сначала выберите знак.'), 'error');
          return;
        }
        download(markdown, passportFileName() + '.md');
        setStatus(container, t('lab.artifactGenerator.exported', 'Файл выгружен.'), 'success');
        return;
      }

      if (event.target.closest('#ag-copy-md')) {
        var text = toMarkdown();
        if (!text) {
          setStatus(container, t('lab.artifactGenerator.noSelection', 'Сначала выберите знак.'), 'error');
          return;
        }
        copyText(container, text);
      }
    });
  }

  function passportFileName() {
    var passport = buildPassport();
    if (!passport) return 'artifact';
    return 'artifact-' + passport.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-');
  }

  // Clipboard API доступен не везде (HTTP без secure context) — откат на
  // временное textarea, иначе выгрузка молча не срабатывала бы.
  function copyText(container, text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        setStatus(container, t('lab.artifactGenerator.copied', 'Скопировано.'), 'success');
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
      ok ? t('lab.artifactGenerator.copied', 'Скопировано.')
        : t('lab.artifactGenerator.copyFailed', 'Браузер запретил копирование — выгрузите Markdown.'),
      ok ? 'success' : 'error');
  }

  // ===== Точка входа =====

  function init(container) {
    if (!container) return;
    state.saved = loadSaved();
    container.innerHTML = '<div class="ag-shell"><div class="ag-bento">' +
      '<section class="ag-cell ag-cell--letters"><div class="lab-skeleton" aria-hidden="true"></div></section>' +
      '</div></div>';

    loadData().then(function() {
      render(container);
      bind(container);
    }).catch(function(error) {
      // Данные не пришли — модуль всё равно должен объяснить, что произошло.
      container.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.artifactGenerator.loadFailed', 'Не удалось загрузить данные: ') + error.message) + '</div>';
    });
  }

  window.ArtifactGenerator = { init: init, render: init, toMarkdown: toMarkdown };
})(window, document);

/**
 * clue-generator.js — «Генератор улик»: живая цепочка наблюдений.
 * Разметка: pages/clue-generator.html; канон панелей — css/components/panels.css.
 * Схема перерисовывается по мере ввода; кейсы хранятся в localStorage.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/clue-generator.html';
  var STORAGE_KEY = 'alephy_clue_cases';
  var CASE_LIMIT = 10;
  var pagePromise = null;
  var dom = {};
  var state = { clues: [], links: [], conclusion: '', cases: [], selected: null, linkType: 'cause' };

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function(match, key) {
      return values[key] == null ? match : values[key];
    });
  }

  function fetchPage() {
    if (!pagePromise) {
      pagePromise = fetch(PAGE_PATH).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      });
    }
    return pagePromise;
  }

  function newId() {
    return 'clue-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function clueById(id) {
    return state.clues.filter(function(clue) { return clue.id === id; })[0] || null;
  }

  function clueLabel(index) {
    return fill(t('lab.clueGenerator.clueLabel', 'Улика {n}'), { n: index + 1 });
  }

  function optionLabel(clue, index) {
    var text = clue.text.trim();
    if (!text) return clueLabel(index);
    return (index + 1) + '. ' + (text.length > 42 ? text.slice(0, 42) + '…' : text);
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      var locale = document.documentElement.lang === 'en' ? 'en-GB' : 'ru-RU';
      return new Date(ts).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  }

  function setStatus(message, type) {
    if (!dom.status) return;
    dom.status.textContent = message || '';
    dom.status.className = 'lab-status' + (type ? ' is-' + type : '');
  }

  // a11y: порядок карточек объявляется в скрытом live-регионе.
  function announce(message) {
    if (!dom.orderLive) return;
    dom.orderLive.textContent = '';
    window.setTimeout(function() { dom.orderLive.textContent = message; }, 40);
  }

  // ===== Хранилище кейсов =====
  function loadCases() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.slice(0, CASE_LIMIT) : [];
    } catch (error) {
      return [];
    }
  }

  function saveCases() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases.slice(0, CASE_LIMIT)));
    } catch (error) {
      // localStorage может быть недоступен — кейс просто не сохранится.
    }
  }

  function emptyState(hint) {
    return '<div class="lab-empty">' +
      '<span class="lab-empty-glyph" aria-hidden="true">𐤋</span>' +
      '<p class="lab-empty-hint">' + esc(hint) + '</p></div>';
  }

  // ===== Рендер: карточки наблюдений =====
  function renderList() {
    if (!dom.list) return;
    dom.list.innerHTML = state.clues.map(function(clue, index) {
      var selected = state.selected === clue.id;
      return '<article class="cg-card' + (selected ? ' is-selected' : '') + '" draggable="true" data-cg-id="' + clue.id + '">' +
        '<div class="cg-card-head">' +
        '<span class="cg-drag" aria-hidden="true">⋮⋮</span>' +
        '<span class="cg-number">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<button type="button" class="cg-radio" data-cg-select="' + clue.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(clueLabel(index)) + '" title="' + esc(t('lab.clueGenerator.selectClue', 'Выбрать улику')) + '"></button>' +
        '<span class="cg-card-tools">' +
        '<button type="button" class="cg-icon-btn" data-cg-move="-1" data-cg-id="' + clue.id + '"' + (index === 0 ? ' disabled' : '') +
        ' aria-label="' + esc(t('lab.clueGenerator.moveUp', 'Выше')) + '" title="' + esc(t('lab.clueGenerator.moveUp', 'Выше')) + '">↑</button>' +
        '<button type="button" class="cg-icon-btn" data-cg-move="1" data-cg-id="' + clue.id + '"' + (index === state.clues.length - 1 ? ' disabled' : '') +
        ' aria-label="' + esc(t('lab.clueGenerator.moveDown', 'Ниже')) + '" title="' + esc(t('lab.clueGenerator.moveDown', 'Ниже')) + '">↓</button>' +
        '<button type="button" class="cg-icon-btn" data-cg-remove="' + clue.id + '"' +
        ' aria-label="' + esc(t('lab.clueGenerator.removeClue', 'Удалить улику')) + '" title="' + esc(t('lab.clueGenerator.removeClue', 'Удалить улику')) + '">×</button>' +
        '</span></div>' +
        '<textarea class="cg-textarea" rows="3" data-cg-text="' + clue.id + '"' +
        ' placeholder="' + esc(t('lab.clueGenerator.cluePlaceholder', 'Наблюдение, факт или след…')) + '"' +
        ' aria-label="' + esc(clueLabel(index)) + '">' + esc(clue.text) + '</textarea>' +
        '</article>';
    }).join('');
  }

  // ===== Рендер: селекты соединений =====
  function renderOptions() {
    [dom.linkFrom, dom.linkTo].forEach(function(select) {
      if (!select) return;
      var previous = select.value;
      select.innerHTML = state.clues.map(function(clue, index) {
        return '<option value="' + clue.id + '">' + esc(optionLabel(clue, index)) + '</option>';
      }).join('');
      if (state.clues.some(function(clue) { return clue.id === previous; })) select.value = previous;
    });
  }

  function linkKindLabel(kind) {
    return kind === 'rel'
      ? t('lab.clueGenerator.linkTypeRel', 'связь')
      : t('lab.clueGenerator.linkTypeCause', 'причина → следствие');
  }

  // ===== Рендер: добавленные связи =====
  function renderLinks() {
    if (!dom.links) return;
    if (!state.links.length) {
      dom.links.innerHTML = emptyState(t('lab.clueGenerator.linksEmpty', 'Добавьте связь между двумя уликами.'));
      return;
    }
    dom.links.innerHTML = state.links.map(function(link, index) {
      var fromIndex = state.clues.findIndex(function(clue) { return clue.id === link.from; });
      var toIndex = state.clues.findIndex(function(clue) { return clue.id === link.to; });
      var from = fromIndex < 0 ? '' : optionLabel(state.clues[fromIndex], fromIndex);
      var to = toIndex < 0 ? '' : optionLabel(state.clues[toIndex], toIndex);
      return '<span class="cg-link-chip">' +
        '<span>' + esc(from) + '</span>' +
        '<span class="cg-arrow" aria-hidden="true">→</span>' +
        '<span class="cg-link-kind">' + esc(linkKindLabel(link.kind)) + '</span>' +
        '<span class="cg-arrow" aria-hidden="true">→</span>' +
        '<span>' + esc(to) + '</span>' +
        '<button type="button" class="cg-icon-btn" data-cg-remove-link="' + index + '"' +
        ' aria-label="' + esc(t('lab.clueGenerator.removeLink', 'Удалить связь')) + '" title="' + esc(t('lab.clueGenerator.removeLink', 'Удалить связь')) + '">×</button>' +
        '</span>';
    }).join('');
  }

  // ===== Рендер: живая схема =====
  function renderScheme() {
    if (!dom.scheme) return;
    if (!hasChain()) {
      dom.scheme.innerHTML = emptyState(t('lab.clueGenerator.schemeEmpty', 'Схема цепочки собирается по мере ввода наблюдений и связей.'));
      return;
    }
    var chips = [];
    state.clues.forEach(function(clue, index) {
      var text = clue.text.trim();
      if (!text) return;
      var link = state.links.filter(function(item) { return item.from === clue.id; })[0];
      chips.push('<span class="cg-chip">' + String(index + 1).padStart(2, '0') + ' · ' + esc(text) +
        (link ? ' <span class="cg-link-kind">(' + esc(linkKindLabel(link.kind)) + ')</span>' : '') + '</span>');
    });
    var html = chips.join('<span class="cg-arrow" aria-hidden="true">→</span>');
    if (state.conclusion.trim()) {
      html += '<p class="cg-scheme-conclusion">' + esc(state.conclusion.trim()) + '</p>';
    }
    dom.scheme.innerHTML = html;
  }

  // ===== Рендер: сохранённые кейсы =====
  function renderSaved() {
    if (!dom.saved) return;
    if (!state.cases.length) {
      dom.saved.innerHTML = emptyState(t('lab.clueGenerator.savedEmpty', 'Сохранённых кейсов пока нет.'));
      return;
    }
    dom.saved.innerHTML = state.cases.map(function(item, index) {
      return '<div class="cg-saved-row">' +
        '<button type="button" class="cg-saved-open" data-cg-case="' + index + '"' +
        ' title="' + esc(t('lab.clueGenerator.reopen', 'Открыть')) + '">' +
        esc(item.title || t('lab.clueGenerator.caseUntitled', 'Без названия')) + '</button>' +
        '<span class="cg-saved-time">' + esc(formatTime(item.createdAt)) + '</span>' +
        '<button type="button" class="cg-icon-btn" data-cg-remove-case="' + index + '"' +
        ' aria-label="' + esc(t('lab.clueGenerator.removeCase', 'Удалить кейс')) + '" title="' + esc(t('lab.clueGenerator.removeCase', 'Удалить кейс')) + '">×</button>' +
        '</div>';
    }).join('');
  }

  function hasChain() {
    return state.clues.some(function(clue) { return clue.text.trim(); });
  }

  // Экспорт доступен, как только в цепочке появилась хотя бы одна улика.
  function updateExports() {
    var enabled = hasChain();
    [dom.exportText, dom.exportCards].forEach(function(button) {
      if (button) button.disabled = !enabled;
    });
    if (dom.build) dom.build.disabled = !enabled;
  }

  function renderAll() {
    renderList();
    renderOptions();
    renderLinks();
    renderScheme();
    renderSaved();
    updateExports();
  }

  // Обновление только текстовых меток: список карточек не перерисовываем, чтобы не терять фокус.
  function refreshLabels() {
    renderOptions();
    renderLinks();
    renderScheme();
    updateExports();
  }

  // ===== Операции =====
  function addClue() {
    var clue = { id: newId(), text: '' };
    state.clues.push(clue);
    state.selected = clue.id;
    renderAll();
    var textarea = dom.list ? dom.list.querySelector('[data-cg-text="' + clue.id + '"]') : null;
    if (textarea) textarea.focus();
  }

  function removeClue(id) {
    state.clues = state.clues.filter(function(clue) { return clue.id !== id; });
    state.links = state.links.filter(function(link) { return link.from !== id && link.to !== id; });
    if (state.selected === id) state.selected = null;
    if (!state.clues.length) state.clues.push({ id: newId(), text: '' });
    renderAll();
    announce(t('lab.clueGenerator.removedClue', 'Улика удалена'));
  }

  function moveClue(id, direction) {
    var from = state.clues.findIndex(function(clue) { return clue.id === id; });
    var to = from + direction;
    if (from < 0 || to < 0 || to >= state.clues.length) return;
    var item = state.clues.splice(from, 1)[0];
    state.clues.splice(to, 0, item);
    renderList();
    refreshLabels();
    announce(direction < 0
      ? fill(t('lab.clueGenerator.movedUp', 'Улика {n} перемещена выше'), { n: to + 1 })
      : fill(t('lab.clueGenerator.movedDown', 'Улика {n} перемещена ниже'), { n: to + 1 }));
  }

  function reorder(sourceId, targetId) {
    var from = state.clues.findIndex(function(clue) { return clue.id === sourceId; });
    var to = state.clues.findIndex(function(clue) { return clue.id === targetId; });
    if (from < 0 || to < 0 || from === to) return;
    var item = state.clues.splice(from, 1)[0];
    state.clues.splice(to, 0, item);
    renderList();
    refreshLabels();
    announce(fill(t('lab.clueGenerator.movedDown', 'Улика {n} перемещена ниже'), { n: to + 1 }));
  }

  function addLink() {
    if (!dom.linkFrom || !dom.linkTo) return;
    var from = dom.linkFrom.value;
    var to = dom.linkTo.value;
    if (!from || !to || from === to) {
      setStatus(t('lab.clueGenerator.linkInvalid', 'Выберите две разные улики.'), 'error');
      return;
    }
    state.links.push({ from: from, to: to, kind: state.linkType });
    setStatus('', '');
    renderLinks();
    renderScheme();
  }

  // ===== Экспорт и кейсы =====
  function asText() {
    var lines = state.clues.map(function(clue, index) {
      var text = clue.text.trim() || t('lab.clueGenerator.clueUntitled', 'Улика без текста');
      var links = state.links.filter(function(link) { return link.from === clue.id; }).map(function(link) {
        var toIndex = state.clues.findIndex(function(item) { return item.id === link.to; });
        var target = toIndex < 0 ? '' : (state.clues[toIndex].text.trim() || clueLabel(toIndex));
        return '  → ' + linkKindLabel(link.kind) + ' → ' + target;
      }).join('\n');
      return (index + 1) + '. ' + text + (links ? '\n' + links : '');
    });
    lines.push('', t('lab.clueGenerator.secConclusion', 'Вывод') + ': ' +
      (state.conclusion.trim() || t('lab.clueGenerator.conclusionMissing', 'Вывод не указан')));
    return lines.join('\n');
  }

  function download(content, name, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportText() {
    if (!hasChain()) return;
    download(asText(), 'alephy-clue-chain.txt', 'text/plain;charset=utf-8');
  }

  function exportCards() {
    if (!hasChain()) return;
    var cards = state.clues.filter(function(clue) { return clue.text.trim(); }).map(function(clue) {
      return { type: 'clue', title: 'Улика', content: clue.text.trim() };
    });
    cards.push({ type: 'conclusion', title: t('lab.clueGenerator.secConclusion', 'Вывод'), content: state.conclusion.trim() });
    try {
      window.localStorage.setItem('alephy_board_import', JSON.stringify(cards));
    } catch (error) {
      setStatus(t('lab.clueGenerator.copyFailed', 'Копирование недоступно'), 'error');
      return;
    }
    if (window.LabRouter) window.LabRouter.navigate('board');
  }

  function saveCase() {
    if (!hasChain()) {
      setStatus(t('lab.clueGenerator.needClues', 'Добавьте хотя бы одну улику с текстом.'), 'error');
      return;
    }
    state.cases.unshift({
      title: dom.caseName && dom.caseName.value.trim() ? dom.caseName.value.trim() : '',
      clues: state.clues.map(function(clue) { return { id: clue.id, text: clue.text }; }),
      links: state.links.slice(),
      conclusion: state.conclusion,
      createdAt: Date.now()
    });
    state.cases = state.cases.slice(0, CASE_LIMIT);
    saveCases();
    renderSaved();
    setStatus(t('lab.clueGenerator.savedCase', 'Кейс сохранён'), 'success');
  }

  function openCase(index) {
    var item = state.cases[index];
    if (!item) return;
    state.clues = (item.clues || []).map(function(clue) {
      return { id: clue.id || newId(), text: clue.text || '' };
    });
    if (!state.clues.length) state.clues.push({ id: newId(), text: '' });
    state.links = (item.links || []).slice();
    state.conclusion = item.conclusion || '';
    state.selected = null;
    if (dom.conclusion) dom.conclusion.value = state.conclusion;
    if (dom.caseName) dom.caseName.value = item.title || '';
    renderAll();
    setStatus(t('lab.clueGenerator.reopened', 'Кейс открыт'), 'success');
  }

  // Фиксация кейса: схема уже живая, кнопка подтверждает собранную цепочку.
  function buildChain() {
    if (!hasChain()) {
      setStatus(t('lab.clueGenerator.needClues', 'Добавьте хотя бы одну улику с текстом.'), 'error');
      return;
    }
    setStatus(t('lab.clueGenerator.built', 'Цепочка зафиксирована'), 'success');
  }

  // ===== События =====
  function bind(scope) {
    if (scope.dataset.cgBound === '1') return;
    scope.dataset.cgBound = '1';

    // Живая схема: ввод в тексте улики или вывода перерисовывает цепочку.
    scope.addEventListener('input', function(event) {
      var target = event.target;
      if (!target) return;
      if (target.hasAttribute('data-cg-text')) {
        var clue = clueById(target.getAttribute('data-cg-text'));
        if (clue) clue.text = target.value;
        refreshLabels();
        return;
      }
      if (target.id === 'cg-conclusion') {
        state.conclusion = target.value;
        renderScheme();
        return;
      }
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var select = target.closest('[data-cg-select]');
      if (select) {
        var selectId = select.getAttribute('data-cg-select');
        state.selected = state.selected === selectId ? null : selectId;
        renderList();
        return;
      }
      var move = target.closest('[data-cg-move]');
      if (move) {
        moveClue(move.getAttribute('data-cg-id'), Number(move.getAttribute('data-cg-move')));
        return;
      }
      var remove = target.closest('[data-cg-remove]');
      if (remove) {
        removeClue(remove.getAttribute('data-cg-remove'));
        return;
      }
      var removeLink = target.closest('[data-cg-remove-link]');
      if (removeLink) {
        state.links.splice(Number(removeLink.getAttribute('data-cg-remove-link')), 1);
        renderLinks();
        renderScheme();
        return;
      }
      if (target.closest('#cg-add')) { addClue(); return; }
      if (target.closest('#cg-add-link')) { addLink(); return; }
      if (target.closest('#cg-link-type')) {
        state.linkType = state.linkType === 'cause' ? 'rel' : 'cause';
        dom.linkType.textContent = linkKindLabel(state.linkType);
        dom.linkType.setAttribute('aria-pressed', state.linkType === 'cause' ? 'true' : 'false');
        renderLinks();
        return;
      }
      if (target.closest('#cg-build')) { buildChain(); return; }
      if (target.closest('#cg-save')) { saveCase(); return; }
      if (target.closest('#cg-export-text')) { exportText(); return; }
      if (target.closest('#cg-export-cards')) { exportCards(); return; }
      var caseOpen = target.closest('[data-cg-case]');
      if (caseOpen) { openCase(Number(caseOpen.getAttribute('data-cg-case'))); return; }
      var caseRemove = target.closest('[data-cg-remove-case]');
      if (caseRemove) {
        state.cases.splice(Number(caseRemove.getAttribute('data-cg-remove-case')), 1);
        saveCases();
        renderSaved();
      }
    });

    // Drag&drop — мышь; клавиатурная альтернатива — кнопки ↑/↓.
    scope.addEventListener('dragstart', function(event) {
      var card = event.target.closest ? event.target.closest('.cg-card') : null;
      if (!card || !event.dataTransfer) return;
      event.dataTransfer.setData('text/plain', card.getAttribute('data-cg-id'));
    });
    scope.addEventListener('dragover', function(event) {
      if (event.target.closest && event.target.closest('.cg-card')) event.preventDefault();
    });
    scope.addEventListener('drop', function(event) {
      var card = event.target.closest ? event.target.closest('.cg-card') : null;
      if (!card || !event.dataTransfer) return;
      event.preventDefault();
      reorder(event.dataTransfer.getData('text/plain'), card.getAttribute('data-cg-id'));
    });
  }

  function collectDom(scope) {
    dom = {
      list: scope.querySelector('#cg-list'),
      links: scope.querySelector('#cg-links'),
      linkFrom: scope.querySelector('#cg-link-from'),
      linkTo: scope.querySelector('#cg-link-to'),
      linkType: scope.querySelector('#cg-link-type'),
      scheme: scope.querySelector('#cg-scheme'),
      saved: scope.querySelector('#cg-saved'),
      conclusion: scope.querySelector('#cg-conclusion'),
      caseName: scope.querySelector('#cg-case-name'),
      status: scope.querySelector('#cg-status'),
      orderLive: scope.querySelector('#cg-order-live'),
      build: scope.querySelector('#cg-build'),
      exportText: scope.querySelector('#cg-export-text'),
      exportCards: scope.querySelector('#cg-export-cards')
    };
  }

  function init(container) {
    var scope = container;
    if (!scope) return;
    fetchPage().then(function(html) {
      scope.innerHTML = html;
      // Разметка приходит после старта i18n — переводим её здесь.
      if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
        window.AlephyI18n.applyTranslations(scope);
      }
      collectDom(scope);
      bind(scope);
      state.cases = loadCases();
      if (!state.clues.length) state.clues = [{ id: newId(), text: '' }];
      if (dom.conclusion) dom.conclusion.value = state.conclusion;
      if (dom.linkType) dom.linkType.textContent = linkKindLabel(state.linkType);
      renderAll();
    }).catch(function(error) {
      scope.innerHTML = '<div class="lab-alert lab-alert-error">' +
        esc(t('lab.clueGenerator.loadFailed', 'Не удалось загрузить конструктор: ')) + esc(error.message) + '</div>';
    });
  }

  window.ClueGenerator = { init: init, render: init };
})(window, document);
/* =============================================
   showcase-toolbar.js - тулбар витрин инструментов
   Модули «Генераторы», «Чекеры», «Анализаторы».

   Анатомия тулбара взята у «Конвейеров» (§4.7):
   .agent-controls-panel + .agent-toolbar-row, где
   .agent-toolbar-row имеет display: contents, поэтому
   раскладку задаёт родитель. Слева поиск, справа
   счётчик «N из M» и переключатель вида.

   Вид переключается на том же DOM, а не сборкой новой
   разметки: карточка .gc-card в списке просто
   перестраивается в строку. Иначе пришлось бы держать
   две копии карточек, и они разошлись бы при правке.
   ============================================= */
(function (window, document) {
  'use strict';

  var VIEW_KEY_PREFIX = 'alephy.showcase.view.';

  // Сетка карточек и падеж для плейсхолдера поиска.
  var SHOWCASES = {
    generators: { grid: '.gc-grid', noun: 'генераторам' },
    checkers: { grid: '.gc-grid', noun: 'чекерам' },
    analyzers: { grid: '.analyzers-grid', noun: 'анализаторам' }
  };

  // Инстансы держим вне разметки: page-controller зовёт init повторно
  // при каждом входе в модуль, и состояние не должно теряться вместе
  // с dataset, который перезаписывается рендером.
  var instances = [];

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toolbarHtml(noun, count) {
    return '<section class="agent-controls-panel gc-controls-panel" aria-label="Управление витриной">' +
      '<div class="agent-toolbar-row">' +
        '<input type="search" class="lab-input agents-search" data-showcase-search ' +
          'placeholder="Поиск по ' + esc(noun) + '…" aria-label="Поиск по ' + esc(noun) + '">' +
        '<div class="agent-toolbar-actions">' +
          '<span class="pipeline-count" data-showcase-count aria-live="polite">' + count + '</span>' +
          '<div class="res-view-toggle" role="group" aria-label="Вид списка">' +
            '<button type="button" class="res-view-btn active" data-showcase-view="cards" ' +
              'aria-label="Карточки" title="Карточки" aria-pressed="true"><i data-lucide="layout-grid" aria-hidden="true"></i></button>' +
            '<button type="button" class="res-view-btn" data-showcase-view="list" ' +
              'aria-label="Список" title="Список" aria-pressed="false"><i data-lucide="list" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  // Пустое состояние — то же, что у конвейеров: счётчик в тулбаре
  // показывает ноль, а подсказка объясняет, что произошло.
  var EMPTY_HTML = '<div class="lab-alert lab-alert-info" data-showcase-empty hidden>По запросу ничего не найдено.</div>';

  function readView(moduleId) {
    try { return localStorage.getItem(VIEW_KEY_PREFIX + moduleId) === 'list' ? 'list' : 'cards'; } catch (e) { return 'cards'; }
  }

  function writeView(moduleId, view) {
    try { localStorage.setItem(VIEW_KEY_PREFIX + moduleId, view); } catch (e) { /* приватный режим */ }
  }

  function syncIcons() {
    if (window.LabIcons && typeof window.LabIcons.sync === 'function') window.LabIcons.sync();
    else if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (e) { /* не критично */ }
    }
  }
  function findInstance(grid) {
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].grid === grid) return instances[i];
    }
    return null;
  }

  function init(container, moduleId) {
    var config = SHOWCASES[moduleId];
    if (!container || !config) return;
    var grid = container.querySelector(config.grid);
    if (!grid) return;
    // Повторный вход в модуль не должен плодить панели и обработчики.
    if (findInstance(grid)) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.gc-card'));
    // Хайласт строим один раз: текст карточек не меняется, а фильтр
    // дергается на каждый символ в поле.
    cards.forEach(function (card) {
      card.dataset.showcaseHaystack = (card.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    });

    var inst = { container: container, grid: grid, moduleId: moduleId, cards: cards };
    instances.push(inst);

    grid.insertAdjacentHTML('beforebegin', toolbarHtml(config.noun, '<strong>' + cards.length + '</strong> из ' + cards.length));
    grid.insertAdjacentHTML('afterend', EMPTY_HTML);

    var search = container.querySelector('[data-showcase-search]');
    if (search) {
      search.addEventListener('input', function () { refresh(inst); });
    }

    container.querySelectorAll('[data-showcase-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        writeView(moduleId, btn.dataset.showcaseView);
        applyView(inst);
      });
    });

    applyView(inst);
    refresh(inst);
    syncIcons();
  }

  function applyView(inst) {
    var view = readView(inst.moduleId);
    inst.grid.classList.toggle('is-list', view === 'list');
    inst.container.querySelectorAll('[data-showcase-view]').forEach(function (btn) {
      var active = btn.dataset.showcaseView === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function refresh(inst) {
    var search = inst.container.querySelector('[data-showcase-search]');
    var needle = ((search && search.value) || '').trim().toLowerCase();
    var shown = 0;

    inst.cards.forEach(function (card) {
      var match = !needle || card.dataset.showcaseHaystack.indexOf(needle) !== -1;
      // Скрываем классом, а не hidden: карточка — ссылка, и hidden
      // на <a> ломает фокус с клавиатуры при возврате в список.
      card.classList.toggle('is-filtered-out', !match);
      if (match) shown += 1;
    });

    var count = inst.container.querySelector('[data-showcase-count]');
    if (count) count.innerHTML = '<strong>' + shown + '</strong> из ' + inst.cards.length;
    var empty = inst.container.querySelector('[data-showcase-empty]');
    // Пустой витрины не бывает: карточки живут в разметке страницы.
    if (empty) empty.hidden = shown !== 0;
  }

  window.ShowcaseToolbar = {
    init: init,
    // Точка входа для модулей вне fetch-ветки page-controller
    // (analyzers.js рисует сетку сам).
    mount: function (container, moduleId) { init(container, moduleId); }
  };
})(window, document);

/**
 * dev-panel.js — каркас панели разработчика (инспекция, аннотации, экспорт).
 *
 * Подключается один раз в index.html. Панель существует только при включённом
 * режиме разработчика (флаг developerMode в js/user-preferences.js).
 * Переключение на лету слушает событие alephy:developer-mode-change.
 *
 * Вся разметка и стили живут внутри Shadow DOM: панель не зависит от каскада
 * основного CSS и не протекает в него. CSS-переменные темы наследуются через
 * границу тени, поэтому панель перекрашивается вместе с лабораторией.
 */
window.LabDevPanel = (function () {
  'use strict';

  var HOST_ID = 'lab-dev-panel-host';

  var TABS = [
    { id: 'inspect', label: 'Инспекция' },
    { id: 'annotations', label: 'Аннотации' },
    { id: 'export', label: 'Экспорт' }
  ];

  var host = null;
  var shadow = null;
  var state = { open: false, tab: 'inspect' };

  function isEnabled() {
    if (window.UserPreferences && UserPreferences.load) {
      return UserPreferences.load().developerMode === true;
    }
    return document.documentElement.getAttribute('data-developer-mode') === 'on';
  }

  // Стили только внутри тени. Переменные темы наследуются из документа,
  // фолбэки нужны для случая, когда токен ещё не объявлен.
  var STYLES = [
    ':host { all: initial; }',
    '.dp-root { position: fixed; right: 20px; bottom: 20px; z-index: 9990;',
    '  display: flex; flex-direction: column; align-items: flex-end; gap: 12px;',
    '  font-family: var(--font-ui, "DM Sans", system-ui, sans-serif);',
    '  color: var(--text-primary, #221a10); }',
    '.dp-fab { width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--border-dark, #cbbfa8);',
    '  background: var(--bg-card, #fff); color: var(--accent-gold, #9a7420);',
    '  cursor: pointer; display: flex; align-items: center; justify-content: center;',
    '  box-shadow: 0 6px 20px rgba(0, 0, 0, .18); transition: transform .15s ease, box-shadow .15s ease; }',
    '.dp-fab:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }',
    '.dp-fab:focus-visible { outline: 2px solid var(--accent-gold, #9a7420); outline-offset: 2px; }',
    '.dp-fab svg { width: 22px; height: 22px; }',
    '.dp-panel { width: 380px; max-width: calc(100vw - 32px); max-height: min(560px, calc(100vh - 120px));',
    '  display: flex; flex-direction: column; overflow: hidden;',
    '  background: var(--bg-card, #fff); border: 1px solid var(--border-light, #e6dfd0);',
    '  border-radius: 12px; box-shadow: 0 16px 48px rgba(0, 0, 0, .24); }',
    '.dp-panel[hidden] { display: none; }',
    '.dp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px;',
    '  padding: 12px 14px; border-bottom: 1px solid var(--border-light, #e6dfd0); }',
    '.dp-title { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }',
    '.dp-close { border: 0; background: transparent; cursor: pointer; padding: 4px;',
    '  color: var(--text-secondary, #5c5142); }',
    '.dp-close:hover { color: var(--text-primary, #221a10); }',
    '.dp-close svg { width: 16px; height: 16px; }',
    '.dp-tabs { display: flex; gap: 4px; padding: 8px 10px 0; }',
    '.dp-tab { flex: 1; border: 1px solid transparent; background: transparent; cursor: pointer;',
    '  padding: 7px 8px; border-radius: 8px 8px 0 0; font: inherit; font-size: 12px;',
    '  color: var(--text-secondary, #5c5142); }',
    '.dp-tab[aria-selected="true"] { background: var(--bg-secondary, #fbfaf6);',
    '  border-color: var(--border-light, #e6dfd0); border-bottom-color: var(--bg-secondary, #fbfaf6);',
    '  color: var(--text-primary, #221a10); font-weight: 600; }',
    '.dp-body { flex: 1; overflow-y: auto; padding: 16px 14px;',
    '  background: var(--bg-secondary, #fbfaf6); font-size: 13px;',
    '  color: var(--text-muted, #8d8271); }',
    '@media (max-width: 640px) {',
    '  .dp-root { right: 12px; bottom: 12px; }',
    '  .dp-panel { width: calc(100vw - 24px); max-height: calc(100vh - 96px); }',
    '}'
  ].join('\n');
  var FAB_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/>' +
    '<path d="M12 12L4 7.5"/></svg>';

  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  function tabLabel(id) {
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].id === id) return TABS[i].label;
    }
    return TABS[0].label;
  }

  function placeholderText() {
    return 'Вкладка «' + tabLabel(state.tab) + '» заполняется на следующем этапе работы над панелью.';
  }

  function renderPanel() {
    var tabs = TABS.map(function (tab) {
      return '<button type="button" class="dp-tab" role="tab" id="dp-tab-' + tab.id + '" ' +
        'data-dp-tab="' + tab.id + '" aria-selected="' + (state.tab === tab.id ? 'true' : 'false') + '" ' +
        'aria-controls="dp-body">' + tab.label + '</button>';
    }).join('');
    return '<section class="dp-panel" role="dialog" aria-label="Панель разработчика"' +
      (state.open ? '' : ' hidden') + '>' +
      '<header class="dp-head"><span class="dp-title">Панель разработчика</span>' +
      '<button type="button" class="dp-close" data-dp-close aria-label="Закрыть панель">' + CLOSE_SVG + '</button></header>' +
      '<div class="dp-tabs" role="tablist" aria-label="Разделы панели">' + tabs + '</div>' +
      '<div class="dp-body" id="dp-body" role="tabpanel" aria-labelledby="dp-tab-' + state.tab + '" tabindex="0">' +
      '<p data-dp-placeholder>' + placeholderText() + '</p></div></section>';
  }

  function buildMarkup() {
    return '<div class="dp-root">' +
      '<button type="button" class="dp-fab" data-dp-toggle aria-expanded="' + (state.open ? 'true' : 'false') + '" ' +
      'aria-label="Открыть панель разработчика" title="Панель разработчика">' + FAB_SVG + '</button>' +
      renderPanel() + '</div>';
  }

  function syncPanel() {
    if (!shadow) return;
    var panel = shadow.querySelector('.dp-panel');
    var fab = shadow.querySelector('.dp-fab');
    if (!panel || !fab) return;
    panel.hidden = !state.open;
    fab.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    TABS.forEach(function (tab) {
      var btn = shadow.querySelector('[data-dp-tab="' + tab.id + '"]');
      if (btn) btn.setAttribute('aria-selected', state.tab === tab.id ? 'true' : 'false');
    });
    var body = shadow.getElementById('dp-body');
    if (body) {
      body.setAttribute('aria-labelledby', 'dp-tab-' + state.tab);
      var placeholder = body.querySelector('[data-dp-placeholder]');
      if (placeholder) placeholder.textContent = placeholderText();
    }
  }

  function bindEvents() {
    shadow.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-dp-toggle]')) {
        state.open = !state.open;
        syncPanel();
        return;
      }
      if (target.closest('[data-dp-close]')) {
        state.open = false;
        syncPanel();
        return;
      }
      var tabBtn = target.closest('[data-dp-tab]');
      if (tabBtn) {
        state.tab = tabBtn.getAttribute('data-dp-tab');
        syncPanel();
      }
    });
    // Escape закрывает панель, но только когда фокус внутри тени.
    shadow.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.open) {
        state.open = false;
        syncPanel();
      }
    });
  }

  function ensureHost() {
    if (host && document.body.contains(host)) return;
    host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      document.body.appendChild(host);
    }
    shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + STYLES + '</style>' + buildMarkup();
    bindEvents();
  }

  function removeHost() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
    state.open = false;
  }

  function sync() {
    if (isEnabled()) {
      ensureHost();
      syncPanel();
    } else {
      removeHost();
    }
  }

  function init() {
    sync();
    window.addEventListener('alephy:developer-mode-change', function (event) {
      // Флаг уже сохранён и применён (событие приходит после commit в
      // user-preferences.js), читаем актуальное значение напрямую.
      if (event && event.detail && typeof event.detail.enabled === 'boolean') {
        if (event.detail.enabled) {
          ensureHost();
          syncPanel();
        } else {
          removeHost();
        }
        return;
      }
      sync();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init, sync: sync };
})();


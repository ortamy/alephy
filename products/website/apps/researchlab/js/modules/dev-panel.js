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

  // Состояние инспекции: активный слушатель документа и последний цель элемент.
  var HIGHLIGHT_ID = 'lab-dev-panel-highlight';
  var inspect = { active: false, target: null, statusTimer: 0 };
  var overlay = null;
  var inspectTarget = null;
  var docBound = false;

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
    '.dp-hint { margin: 0 0 10px; }',
    '.dp-inspect { display: grid; gap: 6px; }',
    '.dp-inspect[hidden], .dp-copy-status[hidden] { display: none; }',
    '.dp-row { display: flex; gap: 8px; align-items: baseline; font-size: 12px; }',
    '.dp-row-label { flex: 0 0 72px; color: var(--text-secondary, #5c5142); font-weight: 600; }',
    '.dp-row-value { flex: 1; min-width: 0; word-break: break-all; padding: 3px 6px;',
    '  font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 11px;',
    '  color: var(--text-primary, #221a10); background: var(--bg-primary, #fff);',
    '  border: 1px solid var(--border-light, #e6dfd0); border-radius: 6px; }',
    '.dp-copy-status { margin: 10px 0 0; font-size: 12px; font-weight: 600;',
    '  color: var(--accent-gold, #9a7420); }',
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
    if (state.tab === 'inspect') {
      return 'Наведите курсор на элемент: он подсветится, а его данные появятся ниже. Щелчок копирует данные в буфер.';
    }
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
      '<p class="dp-hint" data-dp-placeholder>' + placeholderText() + '</p>' +
      '<div class="dp-inspect" data-dp-info hidden></div>' +
      '<p class="dp-copy-status" data-dp-status hidden>Скопировано в буфер</p>' +
      '</div></section>';
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
      var info = body.querySelector('[data-dp-info]');
      if (info) info.hidden = state.tab !== 'inspect';
      var status = body.querySelector('[data-dp-status]');
      if (status && state.tab !== 'inspect') status.hidden = true;
    }
    // Вне вкладки «Инспекция» подсветка бессмысленна.
    if (!isActive()) hideOverlay();
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

  // ===== ИНСПЕКЦИЯ =====

  function isActive() {
    return !!(host && shadow && state.open && state.tab === 'inspect');
  }

  function cssEscape(value) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(value);
    return String(value).replace(/([\0-\x1f\x7f"'#.:;,!?+<>=~*^$|&%@\s()[\]{}])/g, '\\$1');
  }

  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (e) {
      return false;
    }
  }

  // Селектор: сначала уникальный id, затем уникальный класс, иначе
  // цепочка tag:nth-child(n) от ближайшего якоря (id-предка) до элемента.
  function buildSelector(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) {
      var idSel = '#' + cssEscape(el.id);
      if (isUnique(idSel)) return idSel;
    }
    for (var i = 0; i < el.classList.length; i++) {
      var clsSel = '.' + cssEscape(el.classList[i]);
      if (isUnique(clsSel)) return clsSel;
    }
    var parts = [];
    var current = el;
    var anchor = '';
    while (current && current.parentElement && current !== document.documentElement) {
      var parent = current.parentElement;
      var index = 1;
      var siblings = parent.children;
      for (var j = 0; j < siblings.length; j++) {
        if (siblings[j] === current) { index = j + 1; break; }
      }
      parts.unshift(current.tagName.toLowerCase() + ':nth-child(' + index + ')');
      if (parent.id) {
        anchor = '#' + cssEscape(parent.id);
        break;
      }
      current = parent;
    }
    var path = parts.join(' > ');
    return anchor ? anchor + ' > ' + path : path;
  }

  function nearestDataAttr(el) {
    var node = el;
    for (var depth = 0; node && node.nodeType === 1 && depth < 4; depth++, node = node.parentElement) {
      for (var i = 0; i < node.attributes.length; i++) {
        var attr = node.attributes[i];
        if (attr.name.indexOf('data-') === 0 && attr.value) {
          return attr.name + '="' + attr.value + '"';
        }
      }
    }
    return '';
  }

  function elementText(el) {
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 120) text = text.slice(0, 120) + '…';
    return text;
  }

  function describe(el) {
    var rect = el.getBoundingClientRect();
    var text = elementText(el);
    return {
      selector: buildSelector(el),
      tag: el.tagName.toLowerCase(),
      classes: el.className && typeof el.className === 'string' ? el.className.trim() : '',
      size: Math.round(rect.width) + ' x ' + Math.round(rect.height),
      text: text,
      dataAttr: text ? '' : nearestDataAttr(el)
    };
  }

  function formatInfo(info) {
    var lines = [
      'Селектор: ' + info.selector,
      'Тег: ' + info.tag,
      'Классы: ' + (info.classes || 'нет'),
      'Размер: ' + info.size
    ];
    if (info.text) lines.push('Текст: ' + info.text);
    if (info.dataAttr) lines.push('Атрибут: ' + info.dataAttr);
    return lines.join('\n');
  }

  function infoRows(info) {
    var rows = [
      ['Селектор', info.selector],
      ['Тег', info.tag],
      ['Классы', info.classes || 'нет'],
      ['Размер', info.size]
    ];
    if (info.text) rows.push(['Текст', info.text]);
    if (info.dataAttr) rows.push(['Атрибут', info.dataAttr]);
    return rows;
  }

  // Значения вставляем через textContent: текст элемента страницы —
  // внешний ввод, в разметку он не попадает в сыром виде.
  function renderInfo(info) {
    var box = shadow.querySelector('[data-dp-info]');
    if (!box) return;
    var rows = infoRows(info);
    box.innerHTML = rows.map(function (row) {
      return '<div class="dp-row"><span class="dp-row-label">' + row[0] + '</span>' +
        '<code class="dp-row-value"></code></div>';
    }).join('');
    var codes = box.querySelectorAll('.dp-row-value');
    for (var i = 0; i < codes.length; i++) {
      codes[i].textContent = rows[i][1];
    }
  }

  var statusTimer = null;
  function showStatus(message) {
    var status = shadow.querySelector('[data-dp-status]');
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { status.hidden = true; }, 1600);
  }

  function copyText(text, okMessage) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      showStatus(ok ? okMessage : 'Не удалось скопировать');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showStatus(okMessage);
      }).catch(fallback);
      return;
    }
    fallback();
  }

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lab-dev-inspect-overlay';
    // Стили инлайном: оверлей живёт в основном документе и не пишется
    // в CSS-файлы лаборатории.
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9989';
    overlay.style.display = 'none';
    overlay.style.border = '2px solid #9a7420';
    overlay.style.background = 'rgba(154, 116, 32, .14)';
    overlay.style.borderRadius = '4px';
    document.body.appendChild(overlay);
    return overlay;
  }

  function moveOverlay(el) {
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight ||
        rect.right < 0 || rect.left > window.innerWidth) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    var ov = ensureOverlay();
    ov.style.top = rect.top + 'px';
    ov.style.left = rect.left + 'px';
    ov.style.width = rect.width + 'px';
    ov.style.height = rect.height + 'px';
    ov.style.display = 'block';
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
    inspectTarget = null;
  }

  function fromPanel(event) {
    if (!host) return false;
    var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.indexOf(host) !== -1;
  }

  function bindDocumentEvents() {
    if (docBound) return;
    docBound = true;

    document.addEventListener('mousemove', function (event) {
      if (!isActive()) { hideOverlay(); return; }
      if (fromPanel(event)) return;
      var el = event.target instanceof Element ? event.target : null;
      if (!el || el === overlay) return;
      inspectTarget = el;
      moveOverlay(el);
      renderInfo(describe(el));
    }, true);

    // Скрытие подсветки, когда курсор уходит из документа.
    document.addEventListener('mouseout', function (event) {
      if (!isActive()) return;
      if (!event.relatedTarget && overlay) overlay.style.display = 'none';
    }, true);

    // Прокрутка сдвигает элементы: подсветку гасим, мышка вернёт её.
    document.addEventListener('scroll', function () {
      if (isActive() && overlay) overlay.style.display = 'none';
    }, { capture: true, passive: true });

    document.addEventListener('click', function (event) {
      if (!isActive()) return;
      if (fromPanel(event)) return;
      var el = event.target instanceof Element ? event.target : null;
      if (!el || el === overlay) return;
      event.preventDefault();
      event.stopPropagation();
      var info = describe(el);
      inspectTarget = el;
      renderInfo(info);
      copyText(formatInfo(info), 'Данные элемента скопированы');
    }, true);
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
    bindDocumentEvents();
  }

  function removeHost() {
    hideOverlay();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
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


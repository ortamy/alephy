/**
 * documentation.js — модуль «Документация» (#documentation).
 *
 * Три гайда лежат в data/docs/ как Markdown. Рендер — marked.parse()
 * и DOMPurify.sanitize(), оба уже подключены в лаборатории.
 */
window.LabDocumentation = (function () {
  'use strict';

  var GUIDES = [
    {
      id: 'dev-panel',
      title: 'Панель разработчика',
      lead: 'Режим, инспекция, аннотации и экспорт',
      file: 'data/docs/dev-panel.md'
    },
    {
      id: 'modules',
      title: 'Модули интерфейса',
      lead: 'Реестр, сайдбар и раздел «Система»',
      file: 'data/docs/modules.md'
    },
    {
      id: 'agents',
      title: 'Агенты и пайплайны',
      lead: 'Контракт агента и реестр пайплайнов',
      file: 'data/docs/agents.md'
    }
  ];

  var cache = {};
  var activeContainer = null;
  var bound = false;
  var currentId = '';
  var loadToken = 0;
  var devStatusBound = false;

  function escapeHtml(text) {
    if (text == null) return '';
    if (window.AlephyUtils) return AlephyUtils.escapeHtml(text);
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function findGuide(id) {
    for (var i = 0; i < GUIDES.length; i++) {
      if (GUIDES[i].id === id) return GUIDES[i];
    }
    return GUIDES[0];
  }

  function titleFor(id) {
    for (var i = 0; i < GUIDES.length; i++) {
      if (GUIDES[i].id === id) return GUIDES[i].title;
    }
    return '';
  }

  function currentGuideId() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    var path = raw.split('?')[0];
    var parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'documentation') return GUIDES[0].id;
    return parts[1] || GUIDES[0].id;
  }

  function routeTitle(route) {
    var parts = String(route || '').split('/');
    if (parts[0] !== 'documentation' || !parts[1]) return '';
    return titleFor(parts[1]);
  }

  function renderMarkdown(text) {
    var html;
    if (typeof marked !== 'undefined' && marked.parse) {
      html = marked.parse(text || '');
    } else {
      html = '<pre>' + escapeHtml(text || '') + '</pre>';
    }
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      return DOMPurify.sanitize(html);
    }
    return html;
  }

  function renderNav(container, activeId) {
    var list = container.querySelector('[data-doc-nav]');
    var count = container.querySelector('[data-doc-count]');
    if (count) count.textContent = String(GUIDES.length);
    if (!list) return;
    list.innerHTML = GUIDES.map(function (guide) {
      var active = guide.id === activeId ? ' is-active' : '';
      return '<li><a class="' + active.trim() + '" href="#documentation/' + guide.id + '" data-doc-id="' + guide.id + '">' +
        '<span class="doc-nav-title">' + escapeHtml(guide.title) + '</span>' +
        '<span class="doc-nav-lead">' + escapeHtml(guide.lead) + '</span>' +
        '</a></li>';
    }).join('');
  }

  function renderDeveloperStatus(container) {
    var status = container.querySelector('[data-doc-dev-status]');
    if (!status) return;
    var enabled = document.documentElement.getAttribute('data-developer-mode') === 'on';
    status.dataset.state = enabled ? 'on' : 'off';
    status.textContent = enabled
      ? 'Режим разработчика включён · панель доступна в правом нижнем углу'
      : 'Режим разработчика выключен · включите его в настройках пользователя';
  }

  function showError(body, message) {
    body.innerHTML = '<p class="doc-error">' + escapeHtml(message) + '</p>';
  }

  function loadGuide(guide) {
    if (cache[guide.id]) return Promise.resolve(cache[guide.id]);
    return fetch(guide.file, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }).then(function (text) {
      cache[guide.id] = text;
      return text;
    });
  }

  function showGuide(container, id) {
    var guide = findGuide(id);
    var title = container.querySelector('[data-doc-title]');
    var body = container.querySelector('[data-doc-body]');
    if (!body) return;
    currentId = guide.id;
    renderNav(container, guide.id);
    if (title) title.textContent = guide.title;
    var token = ++loadToken;
    body.innerHTML = '<p class="doc-empty">Загрузка гайда…</p>';
    loadGuide(guide).then(function (text) {
      if (token !== loadToken || !container.isConnected) return;
      body.innerHTML = renderMarkdown(text);
    }).catch(function (error) {
      if (token !== loadToken || !container.isConnected) return;
      showError(body, 'Не удалось загрузить «' + guide.file + '»: ' + (error && error.message ? error.message : 'сеть недоступна') + '.');
    });
  }

  function onHash() {
    if (!activeContainer || !activeContainer.isConnected) return;
    var raw = (window.location.hash || '').replace(/^#/, '');
    var path = raw.split('?')[0];
    var parts = path.split('/').filter(Boolean);
    // Слушатель живёт на window: чужой маршрут не должен перерисовывать
    // keep-rendered контейнер (prune чистит innerHTML, но узел остаётся).
    if (parts[0] !== 'documentation') return;
    var id = parts[1] || GUIDES[0].id;
    if (id === currentId) return;
    showGuide(activeContainer, id);
  }

  function init(container) {
    if (!container) return;
    activeContainer = container;
    renderDeveloperStatus(container);
    if (!bound) {
      bound = true;
      window.addEventListener('hashchange', onHash);
    }
    if (!devStatusBound) {
      devStatusBound = true;
      window.addEventListener('alephy:developer-mode-change', function () {
        if (activeContainer && activeContainer.isConnected) renderDeveloperStatus(activeContainer);
      });
    }
    showGuide(container, currentGuideId());
  }

  return { init: init, routeTitle: routeTitle };
})();

/* =============================================
   agent-tree.js — «Древо агентов» (#ai-agents → #agent-tree-view).

   Заменил свободный холст «Карты агентов»: узлы больше не таскаются
   мышью, связи не рисуются вручную и не лежат в localStorage. Связи
   выведены из ролей агентов (TREE ниже) и объявлены в коде рядом с
   потребителем: пользовательская схема расходилась с
   products/agents/server.py и с линейным порядком пайплайна. Сами
   агенты, их статусы и иконки по-прежнему берутся из
   PageController.getAgentMapData() — реестр остаётся в одном месте,
   а расхождение с ним возможно только в списке TREE.

   Экран открывается кнопкой тулбара «Древо агентов» и закрывается
   кнопкой «Назад к списку агентов»: список и деталь агента переключаются
   через hidden, как и у соседних модулей лаборатории.
   ============================================= */
(function(window, document) {
  'use strict';

  var COLLAPSE_KEY = 'alephy_agent_tree_collapsed_v1';

  // Уровни выведены из ролей: оркестрация → исследование/разработка/
  // сборка → контроль качества. Потомок наследует задачу сверху вниз.
  var TREE = {
    id: 'orchestrator',
    children: [
      { id: 'researcher', children: [
        { id: 'exposer' },
        { id: 'paleo-translator' },
        { id: 'semitologist' },
        { id: 'comparator' }
      ] },
      { id: 'flow-architect', children: [
        { id: 'ai-engineer' },
        { id: 'frontend-developer' }
      ] },
      { id: 'liaison', children: [
        { id: 'collector', children: [
          { id: 'editor' },
          { id: 'technical-writer' }
        ] }
      ] },
      { id: 'critic', children: [
        { id: 'verifier', children: [
          { id: 'code-reviewer' }
        ] }
      ] },
      { id: 'arch-scanner', children: [
        { id: 'arch-critic' },
        { id: 'arch-planner' },
        { id: 'arch-writer' },
        { id: 'arch-convergence' }
      ] }
    ]
  };

  // Обратные связи: результат проверки возвращается наверх, поэтому
  // направление противоположно потоку задачи (пунктир в легенде).
  var FEEDBACK = [
    { from: 'critic', to: 'orchestrator' },
    { from: 'verifier', to: 'collector' },
    { from: 'code-reviewer', to: 'flow-architect' }
  ];

  // Ключи и подписи статусов — те же, что у карточек агента (§6).
  var STATUS_I18N = {
    active: 'lab.agents.status.active',
    dev: 'lab.agents.status.dev',
    stub: 'lab.agents.status.stub'
  };
  var STATUS_FALLBACK = { active: 'Активен', dev: 'В разработке', stub: 'Заглушка' };

  var container = null;
  var collapsed = {};

  function escapeHtml(value) {
    // Канон в js/utils.js: кавычки обязательны — имена попадают в атрибуты.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(value)
      : String(value == null ? '' : value);
  }

  function getAgents() {
    return window.PageController && window.PageController.getAgentMapData
      ? window.PageController.getAgentMapData()
      : [];
  }

  function agentById(id) {
    var agents = getAgents();
    for (var i = 0; i < agents.length; i++) {
      if (agents[i].id === id) return agents[i];
    }
    return null;
  }

  function getIcon(agent) {
    var debug = window.PageController && window.PageController.agentsDebug;
    return debug && debug.getIcon ? debug.getIcon(agent) : 'bot';
  }

  function getStatus(agent) {
    var debug = window.PageController && window.PageController.agentsDebug;
    return debug && debug.getStatus ? debug.getStatus(agent) : (agent.model ? 'dev' : 'stub');
  }

  function readCollapsed() {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function saveCollapsed() {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    } catch (error) {
      // Приватный режим: раскрытость веток просто не запомнится.
    }
  }

  function statusMarkup(agent) {
    var status = getStatus(agent);
    var label = window.AlephyI18n && window.AlephyI18n.t
      ? AlephyI18n.t(STATUS_I18N[status], STATUS_FALLBACK[status])
      : STATUS_FALLBACK[status];
    return '<span class="agent-status agent-status--' + status + '">' +
      '<span class="agent-status-dot" aria-hidden="true"></span>' +
      '<span class="agent-status-label">' + escapeHtml(label) + '</span></span>';
  }

  function nodeMarkup(node, depth) {
    var agent = agentById(node.id);
    if (!agent) return '';
    var hasChildren = node.children && node.children.length;
    var isCollapsed = !!collapsed[node.id];
    var model = agent.model ? agent.model : 'без модели';
    var toggle = hasChildren
      ? '<button type="button" class="at-toggle" data-at-toggle="' + escapeHtml(node.id) + '"' +
        ' aria-expanded="' + (isCollapsed ? 'false' : 'true') + '"' +
        ' aria-label="' + (isCollapsed ? 'Развернуть' : 'Свернуть') + ' ветку: ' + escapeHtml(agent.name) + '">' +
        '<i data-lucide="' + (isCollapsed ? 'plus' : 'minus') + '" aria-hidden="true"></i></button>'
      : '<span class="at-toggle" aria-hidden="true"></span>';

    return '<li class="at-branch' + (hasChildren && isCollapsed ? ' is-collapsed' : '') +
      '" data-at-branch="' + escapeHtml(node.id) + '">' +
      '<span class="at-node-row">' + toggle +
      '<button type="button" class="at-node" data-at-node="' + escapeHtml(node.id) + '"' +
      ' aria-label="Открыть страницу агента: ' + escapeHtml(agent.name) + '">' +
      '<span class="agent-icon-chip" aria-hidden="true"><i data-lucide="' + getIcon(agent) + '"></i></span>' +
      '<span class="at-node-body">' +
      '<span class="at-node-name">' + escapeHtml(agent.name) + '</span>' +
      '<span class="at-node-meta">' + escapeHtml(agent.cat) + ' · ' + escapeHtml(model) + '</span>' +
      '</span>' + statusMarkup(agent) + '</button></span>' +
      (hasChildren ? listMarkup(node.children, depth + 1) : '') +
      '</li>';
  }

  function listMarkup(nodes, depth) {
    return '<ul class="at-tree-list' + (depth === 0 ? ' at-tree-list--root' : '') + '">' +
      nodes.map(function(node) { return nodeMarkup(node, depth); }).join('') + '</ul>';
  }

  // Сводка по глубине: дерево должно читаться числом, а не только глазом.
  function levelRows() {
    var rows = [];
    (function walk(nodes, depth) {
      nodes.forEach(function(node) {
        var agent = agentById(node.id);
        if (!agent) return;
        if (!rows[depth]) rows[depth] = { roles: [], count: 0 };
        if (rows[depth].roles.indexOf(agent.cat) === -1) rows[depth].roles.push(agent.cat);
        rows[depth].count += 1;
        if (node.children) walk(node.children, depth + 1);
      });
    })([TREE], 0);
    return rows.filter(Boolean);
  }

  function levelsMarkup() {
    return '<ul class="at-levels">' + levelRows().map(function(row, index) {
      return '<li class="at-level-row"><span class="at-level-num">' + (index + 1) + '</span>' +
        '<span class="at-level-roles">' + escapeHtml(row.roles.join(', ')) + '</span>' +
        '<span class="at-level-count">' + row.count + '</span></li>';
    }).join('') + '</ul>';
  }

  function feedbackMarkup() {
    return '<div class="at-feedback"><span class="at-feedback-label">Обратные связи</span>' +
      FEEDBACK.map(function(link) {
        var from = agentById(link.from);
        var to = agentById(link.to);
        if (!from || !to) return '';
        return '<span class="at-feedback-item">' + escapeHtml(from.name) + ' → ' + escapeHtml(to.name) + '</span>';
      }).join('') + '</div>';
  }

  function cell(num, title, hint, body, modifier) {
    return '<section class="at-cell' + (modifier || '') + '">' +
      '<header class="at-cell-head"><span class="at-num">' + num + '</span>' +
      '<h2 class="at-cell-title">' + escapeHtml(title) + '</h2>' +
      '<span class="at-cell-hint">' + escapeHtml(hint) + '</span></header>' + body + '</section>';
  }

  function render() {
    var view = container.querySelector('#agent-tree-view');
    if (!view) return;
    view.innerHTML = '<div class="at-controls">' +
      '<p class="at-hint">Дерево показывает, кто кому передаёт задачу. Узел открывает паспорт агента, стрелка сворачивает ветку.</p>' +
      '<div class="at-controls-actions">' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-compact" data-at-expand>Развернуть всё</button>' +
      '<button type="button" class="lab-btn lab-btn-primary lab-btn-compact" data-at-back>Назад к списку агентов</button>' +
      '</div></div>' +
      '<div class="at-bento">' +
      cell('01', 'Дерево агентов', 'сверху вниз — поток задачи',
        '<div class="at-tree">' + listMarkup([TREE], 0) + feedbackMarkup() + '</div>', ' at-cell--tree') +
      '<div class="at-rail">' +
      cell('02', 'Как читать', 'легенда',
        '<ul class="at-legend">' +
        '<li><span class="at-legend-swatch" aria-hidden="true"></span><span>Линия вниз — задача от родителя к потомку.</span></li>' +
        '<li><span class="at-legend-swatch at-legend-swatch--dashed" aria-hidden="true"></span><span>Пунктир — обратная связь: проверка возвращает результат наверх.</span></li>' +
        '</ul>' +
        '<p class="at-caveat">Топология описывает роли, а не исполнение: связь «передаёт задачи» означает передачу контекста, а не вызов модели.</p>', ' at-cell--ink') +
      cell('03', 'Уровни', 'роли и число агентов', levelsMarkup()) +
      '</div></div>';

    view.querySelector('[data-at-back]').addEventListener('click', close);
    view.querySelector('[data-at-expand]').addEventListener('click', function() {
      collapsed = {};
      saveCollapsed();
      render();
    });
    view.querySelectorAll('[data-at-toggle]').forEach(function(button) {
      button.addEventListener('click', function(event) {
        // Тоггер стоит рядом с кнопкой узла, но не внутри неё: клик по нему
        // не должен открывать паспорт агента.
        event.stopPropagation();
        var id = button.dataset.atToggle;
        if (collapsed[id]) { delete collapsed[id]; } else { collapsed[id] = true; }
        saveCollapsed();
        render();
      });
    });
    view.querySelectorAll('[data-at-node]').forEach(function(node) {
      node.addEventListener('click', function() {
        if (window.LabRouter) LabRouter.navigate('ai-agents', [node.dataset.atNode]);
      });
    });
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (error) { /* не критично */ }
    }
  }

  function open() {
    container = document.getElementById('ai-agents');
    if (!container) return;
    var list = container.querySelector('.agent-list-view');
    var view = container.querySelector('#agent-tree-view');
    if (!list || !view) return;
    var detail = container.querySelector('#agent-detail-view');
    collapsed = readCollapsed();
    if (detail) detail.hidden = true;
    // Тулбар списка (поиск, фильтры, счётчик) на экране дерева не о чем —
    // он гасится тем же приёмом, что и на паспорте агента (setAgentListChrome).
    var controls = container.querySelector('.agent-controls-panel');
    if (controls) controls.hidden = true;
    // Шапка паспорта агента — переопределение из renderAgentDetail; на экране
    // дерева она не должна оставаться, иначе подпись «Агент» висит над ним.
    if (container._labHeroOverride) {
      container._labHeroOverride = null;
      if (window.LabHero && window.LabHero.setView) window.LabHero.setView('ai-agents', null);
    }
    list.hidden = true;
    view.hidden = false;
    render();
  }

  function close() {
    if (!container) container = document.getElementById('ai-agents');
    if (!container) return;
    var list = container.querySelector('.agent-list-view');
    var view = container.querySelector('#agent-tree-view');
    if (view) view.hidden = true;
    if (list) list.hidden = false;
    var controls = container.querySelector('.agent-controls-panel');
    if (controls) controls.hidden = false;
  }

  window.AgentTree = { open: open, close: close };
})(window, document);

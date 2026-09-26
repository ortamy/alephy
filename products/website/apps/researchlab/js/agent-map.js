(function(window, document) {
  'use strict';

  var STORAGE_KEY = 'alephy_agent_map_v1';
  var state = null;
  var container = null;
  var stage = null;
  var linksSvg = null;
  var panel = null;
  var selectedId = null;
  var linkSourceId = null;
  var linkMode = false;
  var drag = null;
  var suppressClick = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getAgents() {
    return window.PageController && window.PageController.getAgentMapData
      ? window.PageController.getAgentMapData()
      : [];
  }

  function defaultPosition(index) {
    var column = index % 4;
    var row = Math.floor(index / 4);
    return { x: 24 + column * 222, y: 24 + row * 142 };
  }

  function readState(agents) {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (error) {
      saved = null;
    }

    var positions = saved && saved.positions ? saved.positions : {};
    var settings = saved && saved.settings ? saved.settings : {};
    var validIds = {};

    agents.forEach(function(agent, index) {
      var id = agent.id;
      validIds[id] = true;
      if (!positions[id] || typeof positions[id].x !== 'number' || typeof positions[id].y !== 'number') {
        positions[id] = defaultPosition(index);
      }
      settings[id] = Object.assign({
        role: agent.cat || '',
        model: agent.model || '',
        active: true
      }, settings[id] || {});
    });

    var links = (saved && Array.isArray(saved.links) ? saved.links : []).filter(function(link) {
      return link && validIds[link.from] && validIds[link.to] && link.from !== link.to;
    });

    return { positions: positions, settings: settings, links: links };
  }

  function saveState() {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Локальное хранилище может быть недоступно в приватном режиме.
    }
  }

  function agentById(id) {
    return getAgents().filter(function(agent) { return agent.id === id; })[0] || null;
  }

  function nodeById(id) {
    return stage ? stage.querySelector('.agent-map-node[data-agent-id="' + id + '"]') : null;
  }

  function renderNodes() {
    if (!stage) return;
    stage.querySelectorAll('.agent-map-node').forEach(function(node) { node.remove(); });

    getAgents().forEach(function(agent) {
      var settings = state.settings[agent.id];
      var position = state.positions[agent.id];
      var node = document.createElement('div');
      node.className = 'agent-map-node';
      node.dataset.agentId = agent.id;
      node.style.transform = 'translate(' + position.x + 'px, ' + position.y + 'px)';
      node.innerHTML = '<div class="agent-map-node-head">' +
        '<img class="agent-map-node-icon" src="assets/icons/32/' + escapeHtml(agent.icon) + '.png" alt="">' +
        '<div class="agent-map-node-name">' + escapeHtml(agent.name) + '</div>' +
        '</div>' +
        '<div class="agent-map-node-role">Роль: ' + escapeHtml(settings.role) + '</div>' +
        '<div class="agent-map-node-model">Модель: ' + escapeHtml(settings.model) + '</div>' +
        '<div class="agent-map-node-status">' + (settings.active ? '● Активен' : '○ Отключён') + '</div>';
      if (!settings.active) node.classList.add('is-inactive');
      if (selectedId === agent.id) node.classList.add('is-selected');
      if (linkSourceId === agent.id) node.classList.add('is-link-source');
      node.addEventListener('pointerdown', beginDrag);
      node.addEventListener('click', handleNodeClick);
      stage.appendChild(node);
    });
  }

  function beginDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    var node = event.currentTarget;
    var id = node.dataset.agentId;
    var position = state.positions[id];
    drag = {
      id: id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false
    };
    node.classList.add('is-dragging');
    try { node.setPointerCapture(event.pointerId); } catch (error) {}
    node.addEventListener('pointermove', moveDrag);
    node.addEventListener('pointerup', endDrag, { once: true });
    node.addEventListener('pointercancel', endDrag, { once: true });
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var node = event.currentTarget;
    var dx = event.clientX - drag.startX;
    var dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    var maxX = Math.max(0, stage.clientWidth - node.offsetWidth);
    var maxY = Math.max(0, stage.clientHeight - node.offsetHeight);
    state.positions[drag.id].x = Math.max(0, Math.min(maxX, drag.originX + dx));
    state.positions[drag.id].y = Math.max(0, Math.min(maxY, drag.originY + dy));
    node.style.transform = 'translate(' + state.positions[drag.id].x + 'px, ' + state.positions[drag.id].y + 'px)';
    drawLinks();
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var node = event.currentTarget;
    node.classList.remove('is-dragging');
    node.removeEventListener('pointermove', moveDrag);
    if (drag.moved) {
      suppressClick = true;
      saveState();
      window.setTimeout(function() { suppressClick = false; }, 0);
    }
    drag = null;
  }

  function handleNodeClick(event) {
    if (suppressClick) {
      event.preventDefault();
      return;
    }
    var id = event.currentTarget.dataset.agentId;
    if (linkMode) {
      chooseLinkNode(id);
      return;
    }
    openSettings(id);
  }

  function chooseLinkNode(id) {
    if (!linkSourceId) {
      linkSourceId = id;
      updateNodeClasses();
      updateLinkButton();
      return;
    }
    if (linkSourceId === id) return;
    var exists = state.links.some(function(link) {
      return link.from === linkSourceId && link.to === id;
    });
    if (!exists) state.links.push({ from: linkSourceId, to: id, type: 'передаёт задачи' });
    linkSourceId = null;
    saveState();
    updateNodeClasses();
    updateLinkButton();
    drawLinks();
  }

  function updateNodeClasses() {
    if (!stage) return;
    stage.querySelectorAll('.agent-map-node').forEach(function(node) {
      node.classList.toggle('is-selected', node.dataset.agentId === selectedId);
      node.classList.toggle('is-link-source', node.dataset.agentId === linkSourceId);
    });
  }

  function updateLinkButton() {
    var button = stage && stage.parentNode.querySelector('[data-agent-map-link-mode]');
    if (!button) return;
    button.classList.toggle('is-active', linkMode);
    button.textContent = linkMode ? 'Отмена соединения' : 'Соединить агентов';
  }

  function nodeCenter(id) {
    var node = nodeById(id);
    if (!node) return null;
    var position = state.positions[id];
    return {
      x: position.x + node.offsetWidth / 2,
      y: position.y + node.offsetHeight / 2
    };
  }

  function drawLinks() {
    if (!linksSvg || !stage) return;
    var width = Math.max(stage.clientWidth, 1);
    var height = Math.max(stage.clientHeight, 1);
    linksSvg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    linksSvg.setAttribute('width', width);
    linksSvg.setAttribute('height', height);
    while (linksSvg.lastChild) linksSvg.removeChild(linksSvg.lastChild);

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = '<marker id="agent-map-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor"></path></marker>';
    linksSvg.appendChild(defs);

    state.links.forEach(function(link, index) {
      var from = nodeCenter(link.from);
      var to = nodeCenter(link.to);
      if (!from || !to) return;
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var curve = Math.max(40, Math.abs(to.x - from.x) * .35);
      path.setAttribute('d', 'M ' + from.x + ' ' + from.y + ' C ' + (from.x + curve) + ' ' + from.y + ', ' + (to.x - curve) + ' ' + to.y + ', ' + to.x + ' ' + to.y);
      path.setAttribute('class', 'agent-map-link');
      path.dataset.linkIndex = index;
      path.addEventListener('dblclick', removeLink);
      linksSvg.appendChild(path);

      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (from.x + to.x) / 2);
      label.setAttribute('y', (from.y + to.y) / 2 - 6);
      label.setAttribute('fill', 'currentColor');
      label.setAttribute('font-size', '10');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = link.type || 'передаёт задачи';
      linksSvg.appendChild(label);
    });
  }

  function removeLink(event) {
    var index = Number(event.currentTarget.dataset.linkIndex);
    if (!Number.isNaN(index)) {
      state.links.splice(index, 1);
      saveState();
      drawLinks();
    }
  }

  function openSettings(id) {
    var agent = agentById(id);
    if (!agent || !panel) return;
    selectedId = id;
    var settings = state.settings[id];
    panel.innerHTML = '<h3>Настройка агента</h3>' +
      '<p class="text-small text-muted" style="margin-top:0;">' + escapeHtml(agent.name) + '</p>' +
      '<form data-agent-map-form>' +
      '<label class="agent-map-field"><span>Роль</span><input name="role" type="text" value="' + escapeHtml(settings.role) + '"></label>' +
      '<label class="agent-map-field"><span>Модель</span><input name="model" type="text" value="' + escapeHtml(settings.model) + '"></label>' +
      '<label class="agent-map-field agent-map-toggle"><input name="active" type="checkbox"' + (settings.active ? ' checked' : '') + '> Активен</label>' +
      '<div class="agent-map-form-actions"><button type="button" class="lab-btn lab-btn-secondary" data-agent-map-cancel>Закрыть</button><button type="submit" class="lab-btn lab-btn-primary">Сохранить</button></div>' +
      '</form>';
    panel.classList.add('is-open');
    panel.querySelector('[data-agent-map-form]').addEventListener('submit', saveSettings);
    panel.querySelector('[data-agent-map-cancel]').addEventListener('click', closeSettings);
    updateNodeClasses();
  }

  function saveSettings(event) {
    event.preventDefault();
    var form = event.currentTarget;
    state.settings[selectedId] = {
      role: form.elements.role.value.trim(),
      model: form.elements.model.value.trim(),
      active: form.elements.active.checked
    };
    saveState();
    renderNodes();
    updateListCards();
    closeSettings();
  }

  function closeSettings() {
    selectedId = null;
    if (panel) panel.classList.remove('is-open');
    updateNodeClasses();
  }

  function updateListCards() {
    if (!container || !state) return;
    container.querySelectorAll('.agent-list-card').forEach(function(card) {
      var id = card.dataset.agentId;
      var settings = state.settings[id];
      if (!settings) return;
      var model = card.querySelector('.agent-list-model');
      if (model) model.textContent = settings.model;
      card.classList.toggle('is-inactive', !settings.active);
    });
  }

  function close() {
    if (!container) return;
    var list = container.querySelector('.agent-list-view');
    var mapView = container.querySelector('.agent-map-view');
    saveState();
    if (mapView) mapView.hidden = true;
    if (list) list.hidden = false;
    linkMode = false;
    linkSourceId = null;
    closeSettings();
    updateListCards();
  }

  function open() {
    container = document.getElementById('ai-agents');
    if (!container) return;
    var list = container.querySelector('.agent-list-view');
    var mapView = container.querySelector('.agent-map-view');
    if (!list || !mapView) return;
    state = readState(getAgents());
    list.hidden = true;
    mapView.hidden = false;
    linkMode = false;
    linkSourceId = null;
    mapView.innerHTML = '<div class="agent-map-shell">' +
      '<div class="agent-map-toolbar"><p class="agent-map-hint">Перетаскивайте узлы. Для связи выберите «Соединить агентов», затем два узла. Двойной щелчок по линии удаляет её.</p>' +
      '<div class="agent-map-toolbar-actions"><button type="button" class="lab-btn lab-btn-secondary" data-agent-map-link-mode>Соединить агентов</button><button type="button" class="lab-btn lab-btn-primary" data-agent-map-back>Назад к списку агентов</button></div></div>' +
      '<div class="agent-map-stage" id="agent-map-stage"><svg class="agent-map-links" aria-hidden="true"></svg><div class="agent-map-panel" aria-live="polite"></div></div></div>';
    stage = mapView.querySelector('.agent-map-stage');
    linksSvg = mapView.querySelector('.agent-map-links');
    panel = mapView.querySelector('.agent-map-panel');
    mapView.querySelector('[data-agent-map-back]').addEventListener('click', close);
    mapView.querySelector('[data-agent-map-link-mode]').addEventListener('click', function() {
      linkMode = !linkMode;
      linkSourceId = null;
      updateNodeClasses();
      updateLinkButton();
    });
    renderNodes();
    window.requestAnimationFrame(drawLinks);
  }

  window.addEventListener('resize', drawLinks);
  window.AgentMap = { open: open, close: close };
})(window, document);
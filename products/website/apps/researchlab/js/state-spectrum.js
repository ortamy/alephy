/* =============================================================
   Спектр движения — настоящая карта переходов между состояниями.
   Ландшафт рисуется не списком, а осью: X = интенсивность
   (поле intensity в states.json, ранги разнесены равномерно, иначе
   половина узлов слипается на 0…0.15), Y = две банки, чтобы подписи
   не наезжали друг на друга. Связи — SVG-кривые: вперёд по спектру
   ведут плавные S-дуги, назад (цикл Шамаим ↔ Эден ↔ Эрец) —
   петля под осью.

   Модуль ничего не знает про роутер лаба: render() возвращает
   разметку, bind() цепляет подсветку рёбер и открытие состояния.
   ============================================================= */
(function (global) {
  'use strict';

  // Геометрия задаётся в координатах viewBox 1000×300; слой связей
  // растянут через preserveAspectRatio="none", поэтому X совпадает
  // с left: X% у узлов — обе шкалы от одной сетки.
  var VB_W = 1000;
  var VB_H = 300;
  var PAD_X = 54;
  var LANE_Y = [112, 214];
  var HALF_LANE = VB_H / 2;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pct(value) {
    return (value * 100).toFixed(3) + '%';
  }

  // X узла приходит в единицах viewBox (0…1000), а CSS-процент считается
  // от ширины контейнера — нужен перевод, а не простое умножение на 100.
  function xPct(x) {
    return ((x / VB_W) * 100).toFixed(3) + '%';
  }

  // Раскладка: ранги по интенсивности, банка чередуется, чтобы в
  // одной полосе не оказалось двух подписей вплотную.
  function layout(states) {
    var sorted = states.slice().sort(function (a, b) {
      return (Number(a.intensity) || 0) - (Number(b.intensity) || 0);
    });
    var span = VB_W - PAD_X * 2;
    var step = sorted.length > 1 ? span / (sorted.length - 1) : 0;

    return sorted.map(function (state, index) {
      return {
        state: state,
        x: PAD_X + step * index,
        lane: index % 2
      };
    });
  }

  // Путь начинается и кончается на границе круга, а не в его центре:
  // иначе нити проходят сквозь глифы соседей и карта читается как каша.
  // Прямая связь выходит по горизонтали (R = радиус узла), петля —
  // снизу, иначе возврат перечёркивает собственную банку.
  var R = 32;
  function edgePath(x1, y1, x2, y2, backward) {
    if (!backward) {
      var sx = x1 + (x2 >= x1 ? R : -R);
      var tx = x2 - (x2 >= x1 ? R : -R);
      var dx = tx - sx;
      var dy = y2 - y1;
      return 'M' + sx + ' ' + y1 +
        'C' + (sx + dx * 0.35) + ' ' + (y1 + dy * 0.5) + ' ' +
        (tx - dx * 0.35) + ' ' + (y2 - dy * 0.5) + ' ' + tx + ' ' + y2;
    }
    // Возврат: петля под осью. Глубина зависит от банки — из нижней
    // уходит вниз, из верхней провисает над нижней банкой.
    var sy = y1 + R;
    var ty = y2 + R;
    var bow = (y1 > HALF_LANE ? 50 : 76);
    var pull = Math.max(34, Math.abs(x2 - x1) * 0.22);
    return 'M' + x1 + ' ' + sy +
      'C' + (x1 + pull) + ' ' + (sy + bow) + ' ' +
      (x2 - pull) + ' ' + (ty + bow) + ' ' + x2 + ' ' + ty;
  }

  function edgesMarkup(nodes, byId) {
    var paths = [];
    nodes.forEach(function (node) {
      var from = node.state;
      (from.transitions || []).forEach(function (transition) {
        if (!byId[transition.to]) return;
        var targetNode = null;
        nodes.forEach(function (candidate) {
          if (candidate.state.id === transition.to) targetNode = candidate;
        });
        if (!targetNode) return;

        var backward = targetNode.x <= node.x;
        paths.push(
          '<path class="st-spectrum-edge' + (backward ? ' st-spectrum-edge--back' : '') + '" ' +
          'd="' + edgePath(node.x, LANE_Y[node.lane], targetNode.x, LANE_Y[targetNode.lane], backward) + '" ' +
          'data-from="' + esc(from.id) + '" data-to="' + esc(transition.to) + '" ' +
          'marker-end="url(#st-spectrum-arrow)"></path>'
        );
      });
    });
    return paths.join('');
  }

  // Форма узла несёт структуру графа, а не декор: шлюз (нет входящих),
  // кольцо (состояние внутри цикла), обычный путь.
  function nodeKind(hasIncoming, inCycle) {
    if (!hasIncoming) return 'gate';
    if (inCycle) return 'cycle';
    return 'path';
  }

  // nodesMarkup принимает activeId: на внутренней странице состояния
  // узел помечается как корневой — «я здесь» видно прямо на карте.
  function nodesMarkup(nodes, inDegree, cycles, activeId, matchSet) {
    return nodes.map(function (node) {
      var state = node.state;
      var isRoot = activeId && state.id === activeId;
      // data-len включает CSS-подгонку кегля: длинные палео-слова
      // (𐤌𐤑𐤓𐤉𐤌) иначе вылезали за круг узла.
      var paleo = String(state.paleo || '');
      var matchCls = matchSet ? (matchSet[state.id] ? ' is-match' : ' is-miss') : '';
      return '<button type="button" class="st-spectrum-node st-spectrum-node--' + nodeKind(inDegree[state.id] > 0, cycles[state.id]) + (isRoot ? ' is-root' : '') + matchCls + '"' +
        ' style="left:' + xPct(node.x) + ';top:' + pct(LANE_Y[node.lane] / VB_H) + '"' +
        ' data-state-id="' + esc(state.id) + '"' +
        ' aria-label="' + esc(state.name + ' — ' + (state.intensity_label || '')) + '">' +
        '<span class="st-spectrum-node-dot" style="--st-color:' + esc(state.color || '#b8860b') + '">' +
          '<span class="st-spectrum-node-paleo" data-len="' + Array.from(paleo).length + '" aria-hidden="true">' + esc(paleo) + '</span>' +
        '</span>' +
        '<span class="st-spectrum-node-name">' + esc(state.name) + '</span>' +
      '</button>';
    }).join('');
  }

  // Степени считаются здесь же: render() — единственная точка,
  // которой известен весь список состояний.
  function degrees(states) {
    var inDegree = {};
    states.forEach(function (state) { inDegree[state.id] = 0; });
    states.forEach(function (state) {
      (state.transitions || []).forEach(function (transition) {
        if (inDegree[transition.to] !== undefined) inDegree[transition.to] += 1;
      });
    });
    return inDegree;
  }

  // Цикл — ТОЛЬКО взаимная пара (A → B и B → A). Одиночный возврат
  // назад тоже есть почти у каждого узла; если помечать кольцом и его,
  // кольца теряют смысл — их получают 10 узлов из 16.
  function cycleIds(states, byId) {
    var ids = {};
    states.forEach(function (state) {
      (state.transitions || []).forEach(function (transition) {
        var peer = byId[transition.to];
        if (!peer) return;
        var mutual = (peer.transitions || []).some(function (back) {
          return back.to === state.id;
        });
        if (mutual) ids[state.id] = true;
      });
    });
    return ids;
  }

  function render(states, labels, activeId, options) {
    if (!states || !states.length) return '';

    var text = labels || {};
    // Поиск на карте подсвечивает совпадения, не ломая раскладку: узлы вне
    // запроса гаснут (is-miss), позиции по оси интенсивности сохраняются.
    var matchIds = options && Array.isArray(options.matchIds) ? options.matchIds : null;
    var matchSet = null;
    if (matchIds) {
      matchSet = {};
      matchIds.forEach(function (id) { matchSet[id] = true; });
    }
    var byId = {};
    states.forEach(function (state) { byId[state.id] = state; });

    var nodes = layout(states);
    var inDegree = degrees(states);
    var cycles = cycleIds(states, byId);

    var ticks = [0, 0.25, 0.5, 0.75, 1].map(function (value) {
      var index = Math.round(value * (nodes.length - 1));
      return '<span class="st-spectrum-tick" style="left:' + xPct(nodes[index].x) + '">' +
        esc(value === 0 ? (text.low || 'точка отсчёта') : value === 1 ? (text.high || 'полнота') : '') +
      '</span>';
    }).join('');

    return '<div class="st-spectrum' + (matchSet ? ' is-filtered' : '') + '" data-active-id="' + esc(activeId || '') + '">' +
      '<div class="st-spectrum-axis" aria-hidden="true">' + ticks + '</div>' +
      '<svg class="st-spectrum-links" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" ' +
        'preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
        '<defs>' +
          '<marker id="st-spectrum-arrow" viewBox="0 0 8 8" refX="6" refY="4" ' +
            'markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
            '<path d="M0 0 L8 4 L0 8 z"></path>' +
          '</marker>' +
        '</defs>' +
        edgesMarkup(nodes, byId) +
      '</svg>' +
      nodesMarkup(nodes, inDegree, cycles, activeId, matchSet) +
      '<div class="st-spectrum-legend">' +
        '<span class="st-spectrum-legend-item"><span class="st-spectrum-legend-mark st-spectrum-legend-mark--gate"></span>' + esc(text.gate || 'вход в спектр') + '</span>' +
        '<span class="st-spectrum-legend-item"><span class="st-spectrum-legend-mark st-spectrum-legend-mark--cycle"></span>' + esc(text.cycle || 'взаимный цикл') + '</span>' +
        '<span class="st-spectrum-legend-item"><span class="st-spectrum-legend-mark st-spectrum-legend-mark--back"></span>' + esc(text.back || 'возврат по спектру') + '</span>' +
      '</div>' +
    '</div>';
  }

  // Подсветка рёбер соседей на ховере узла. Рёбра лежат в отдельном
  // SVG, поэтому родного CSS-селектора на ховер кнопки нет — класс
  // ставится вручную по data-атрибутам.
  function bind(root, onSelect) {
    var scope = root.querySelector('.st-spectrum');
    if (!scope) return;
    var nodes = scope.querySelectorAll('.st-spectrum-node');
    var edges = scope.querySelectorAll('.st-spectrum-edge');
    // Статичная метка «я здесь» живёт в разметке, но clear() снимает
    // классы со всех узлов — без возврата она исчезла бы после первого
    // же ухода курсора с карты.
    var activeId = scope.getAttribute('data-active-id') || '';

    function clear() {
      scope.classList.remove('is-focused');
      Array.prototype.forEach.call(edges, function (edge) { edge.classList.remove('is-lit'); });
      Array.prototype.forEach.call(nodes, function (node) {
        node.classList.remove('is-lit');
        node.classList.toggle('is-root', node.getAttribute('data-state-id') === activeId);
      });
    }

    function focusNode(id) {
      clear();
      scope.classList.add('is-focused');
      Array.prototype.forEach.call(nodes, function (node) {
        var nodeId = node.getAttribute('data-state-id');
        if (nodeId === id) node.classList.add('is-root', 'is-lit');
      });
      Array.prototype.forEach.call(edges, function (edge) {
        var from = edge.getAttribute('data-from');
        var to = edge.getAttribute('data-to');
        if (from !== id && to !== id) return;
        edge.classList.add('is-lit');
        Array.prototype.forEach.call(nodes, function (node) {
          if (node.getAttribute('data-state-id') === (from === id ? to : from)) node.classList.add('is-lit');
        });
      });
    }

    Array.prototype.forEach.call(nodes, function (node) {
      var id = node.getAttribute('data-state-id');
      node.addEventListener('mouseenter', function () { focusNode(id); });
      node.addEventListener('focus', function () { focusNode(id); });
      node.addEventListener('click', function () {
        if (typeof onSelect === 'function') onSelect(id);
      });
    });

    scope.addEventListener('mouseleave', clear);
  }

  global.AlephyStateSpectrum = { render: render, bind: bind };
})(window);
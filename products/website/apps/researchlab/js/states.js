/**
 * states.js — Модуль «Карта состояний»
 *
 * 7 пространств палео-механики: Тоху → Хошех → Мицраим → Мидбар → Шамаим → Эрец → Эден.
 * - Карточки состояний с палео-символами и описанием
 * - Страница каждого состояния с палео-разбором, переходами и городами
 *
 * Маршрут: #states
 * Подмаршрут: #states?state=tohu
 */

const AlephyStates = (function() {
  'use strict';

  const STATES_DATA_PATH = 'data/states.json';
  const CARTOGRAPHY_PATH = 'data/cartography.json';

  let states = [];
  let statesById = {};
  let cartographyEntries = [];
  let dataPromise = null;

  // Состояние модуля
  let currentView = 'grid'; // 'grid' | 'landscape' | 'detail' | 'diagnostic'
  let currentStateId = null;
  let selectedLandscapeTransitionId = null;
  // Состояние диагностики хранится отдельно от маршрута карты.
  let diagnosticState = {
    currentQuestion: 0,
    answers: {},
    completed: false
  };

  // ===== УТИЛИТЫ =====
  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function getLucideForState(stateId) {
    var iconMap = {
      'tohu': 'cloud',
      'hoshekh': 'moon',
      'rakiya': 'cloud-sun',
      'mitzrayim': 'landmark',
      'midbar': 'mountain',
      'shamayim': 'cloud-sun',
      'erets': 'globe',
      'eden': 'flower',
      'bohu': 'circle-off',
      'thom': 'droplets',
      'ever': 'sun',
      'gan': 'tree-pine',
      'mavet': 'heart-off',
      'sheol': 'ghost',
      'shabbat': 'calendar',
      'olam': 'infinity'
    };
    return iconMap[stateId] || 'circle';
  }

  function normalizeText(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function dataPath(path) {
    return new URL(path, document.baseURI).href;
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init(parsed) {
    var container = document.getElementById('states');
    if (!container) return;

    // Повторно применяем маршрут при каждом hashchange.
    if (states.length && cartographyEntries.length) {
      checkRouteParams(parsed);
      renderView(container);
      return;
    }

    loadData(container);
  }

  // ===== ЗАГРУЗКА ДАННЫХ =====
  function loadData(target) {
    var container = target || document.getElementById('states');
    if (!container) return;

    if (states.length && cartographyEntries.length) {
      checkRouteParams();
      renderView(container);
      return;
    }

    if (dataPromise) return dataPromise;

    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка карты состояний...</div></div>';

    dataPromise = Promise.all([
      fetch(dataPath(STATES_DATA_PATH)).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for states.json');
        return r.json();
      }),
      fetch(dataPath(CARTOGRAPHY_PATH)).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for cartography.json');
        return r.json();
      })
    ])
    .then(function(results) {
      var statesData = results[0];
      var cartData = results[1];

      var list = Array.isArray(statesData) ? statesData : (statesData && Array.isArray(statesData.states) ? statesData.states : null);
      if (!list) throw new Error('Неверный формат states.json');
      states = list.filter(function(s) { return s && s.id && s.name; });
      statesById = {};
      states.forEach(function(s) { statesById[s.id] = s; });

      var cartList = Array.isArray(cartData) ? cartData : (cartData && Array.isArray(cartData.entries) ? cartData.entries : null);
      if (cartList) cartographyEntries = cartList.filter(function(e) { return e && e.id && e.name; });

      // Проверяем query-параметры при загрузке
      checkRouteParams();
      renderView(container);
    })
    .catch(function(error) {
      dataPromise = null;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки: ' + escapeHtml(error.message) + '</div>';
      throw error;
    });

    dataPromise.catch(function() {});
    return dataPromise;
  }

  // ===== ПРОВЕРКА QUERY-ПАРАМЕТРОВ URL =====
  function checkRouteParams(parsed) {
    parsed = parsed || (LabRouter.parseHash ? LabRouter.parseHash() : { params: {} });
    var params = parsed.params || {};

    if (params.diagnostic === 'true') {
      currentView = 'diagnostic';
      currentStateId = null;
    } else if (params.map === 'landscape') {
      currentView = 'landscape';
      currentStateId = null;
    } else if (params.state && statesById[params.state]) {
      currentView = 'detail';
      currentStateId = params.state;
    } else {
      currentView = 'grid';
      currentStateId = null;
    }
  }

  // ===== ОСНОВНОЙ РЕНДЕР =====
  function renderView(container) {
    if (!states.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Карта состояний пока пуста.</div>';
      return;
    }

    var html = '';

    if (currentView === 'detail' && currentStateId) {
      html = renderStateDetail(currentStateId);
    } else if (currentView === 'landscape') {
      html = renderLandscapePage();
    } else if (currentView === 'diagnostic') {
      html = renderDiagnostic();
    } else {
      html = renderGrid();
    }

    container.innerHTML = html;
    attachHandlers(container);
  }

  function attachHandlers(container) {
    attachLandscapeHandlers(container);

    // Клики по карточкам состояний
    container.querySelectorAll('.state-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var id = this.getAttribute('data-state-id');
        if (id) openState(id);
      });
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          var id = this.getAttribute('data-state-id');
          if (id) openState(id);
        }
      });
    });

    // Клики по переходам
    container.querySelectorAll('.transition-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var id = this.getAttribute('data-to');
        if (id) openState(id);
      });
      item.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          var id = this.getAttribute('data-to');
          if (id) openState(id);
        }
      });
    });

    // Клики по городам (открыть в картографии)
    container.querySelectorAll('.state-city-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var id = this.getAttribute('data-city-id');
        if (id && window.Cartography) {
          Cartography.showDetail(id);
        }
      });
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.click();
        }
      });
    });
  }

  function attachLandscapeHandlers(container) {
    // Выбор маршрута в ландшафте состояния.
    container.querySelectorAll('.state-landscape-route').forEach(function(route) {
      route.addEventListener('click', function() {
        var targetId = this.getAttribute('data-to');
        if (targetId) selectLandscapeTransition(container, targetId);
      });
    });

    container.querySelectorAll('.state-landscape-open').forEach(function(button) {
      button.addEventListener('click', function() {
        var targetId = this.getAttribute('data-to');
        if (targetId) openState(targetId);
      });
    });

    var currentStep = container.querySelector('.state-landscape-contour-node.is-current');
    if (currentStep && typeof currentStep.scrollIntoView === 'function') {
      requestAnimationFrame(function() {
        currentStep.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      });
    }
  }

  // ===== РЕНДЕР СЕТКИ КАРТОЧЕК =====
  function renderGrid() {
    // Сортируем: сначала сжатые, потом открытые
    var sorted = states.slice().sort(function(a, b) {
      return (a.intensity || 0) - (b.intensity || 0);
    });

    var cardsHtml = sorted.map(function(s, i) {
      var color = s.color || '#b8860b';
      var paleo = s.paleo || '';
      var paleoFirst = paleo ? paleo.charAt(0) : '';
      var paleoInline = paleo ? '<span class="state-paleo-inline">' + escapeHtml(paleo) + '</span>' : '';
      var lucideIcon = getLucideForState(s.id);
      return '<div class="state-card" data-state-id="' + escapeHtml(s.id) + '" role="button" aria-label="Открыть состояние: ' + escapeHtml(s.name) + '" tabindex="0" style="animation-delay:' + (i * 70) + 'ms; --state-color: ' + color + '">' +
        '<div class="state-card-icon"><i data-lucide="' + lucideIcon + '" aria-hidden="true"></i></div>' +
        '<h2 class="state-card-name">' + paleoInline + escapeHtml(s.name) + '</h2>' +
        '<div class="state-card-role">' + escapeHtml(s.olam || '') + '</div>' +
        '<div class="state-card-secondary">' +
          '<div class="state-card-hebrew" dir="rtl">' + escapeHtml(s.hebrew || '') + '</div>' +
          '<div class="state-card-physics">' + escapeHtml(s.physics || '') + '</div>' +
          '<div class="state-card-intensity">' +
            '<span>' + escapeHtml(s.intensity_label || '') + '</span>' +
            '<div class="state-intensity-bar">' +
              '<div class="state-intensity-fill" style="width: ' + (s.intensity * 100) + '%; background: ' + color + '"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="states-page">' +
      '<button type="button" class="cartography-world-launch states-map-launch" onclick="AlephyStates.openLandscape()">' +
        '<span aria-hidden="true">𐤌</span>' +
        '<span><strong>Карта состояний</strong><small>Открыть полный слой состояний</small></span>' +
      '</button>' +
      '<div class="states-head">' +
        '<h1><img src="assets/icons/32/ui/web.png" class="lab-icon" alt=""> Карта состояний</h1>' +
        '<p class="subtitle">Семь пространств палео-механики — от запертости (Тоху) до завершённости (Эден). Каждое состояние — это не метафора, а физика: степень сжатости или открытости твоего пространства.</p>' +
      '</div>' +
      '<div class="states-map">' +
        '<div class="states-grid">' + cardsHtml + '</div>' +
      '</div>' +
    '</div>';
  }

  // ===== РЕНДЕР СТРАНИЦЫ СОСТОЯНИЯ =====
    function renderStateDetail(id) {
    var s = statesById[id];
    if (!s) return '<div class="lab-alert lab-alert-error">Состояние не найдено</div>';

        // Шапка модуля подменяется на название состояния
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('states', 'detail', {
        kicker: 'АЛЕФИ · КАРТА СОСТОЯНИЙ',
        title: s.name,
        subtitle: s.physics || '',
        icon: 'ui/web.png'
      });
    }

    var color = s.color || '#b8860b';
    var landscapeHtml = renderStateLandscape(s);

    // Палео-разбор
    var paleoHtml = '';
    if (s.paleo_breakdown && s.paleo_breakdown.length) {
      paleoHtml = '<div class="state-detail-section">' +
        '<h3>Палео-разбор</h3>' +
        '<div class="paleo-breakdown">';
      s.paleo_breakdown.forEach(function(p) {
        paleoHtml += '<div class="paleo-breakdown-item">' +
          '<span class="paleo-char">' + escapeHtml(p.paleo || '') + '</span>' +
          '<span class="paleo-name">' + escapeHtml(p.name || '') + '</span>' +
          '<span class="paleo-func">' + escapeHtml(p.function || '') + '</span>' +
        '</div>';
      });
      paleoHtml += '</div>' +
        (s.paleo_meaning ? '<p style="text-align:center;font-style:italic;color:var(--text-muted);">' + escapeHtml(s.paleo_meaning) + '</p>' : '') +
      '</div>';
    }

    // «Смысл» дополняет короткое описание в шапке, а не повторяет его.
    var isMeaningDuplicate = normalizeText(s.meaning) === normalizeText(s.physics);
    var meaningHtml = s.meaning && !isMeaningDuplicate ? '<div class="state-detail-section"><h3>Смысл</h3><p>' + escapeHtml(s.meaning) + '</p></div>' : '';

    // Примеры
    var examplesHtml = '';
    if (s.examples && s.examples.length) {
      examplesHtml = '<div class="state-detail-section">' +
        '<h3>Примеры</h3>' +
        '<div class="examples-list state-card-grid" role="list">' +
        s.examples.map(function(ex, index) {
          return '<div class="example-tag state-example-card" role="listitem"><span class="state-example-index" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span><span>' + escapeHtml(ex) + '</span></div>';
        }).join('') +
        '</div></div>';
    }

    // Города в этом состоянии
    var citiesHtml = renderCitiesForState(id);

    // Одна статичная метрика: визуальный минимум делает нулевую точку видимой.
    var intensityHtml = '';
    if (s.intensity !== undefined) {
      var intensityPercent = Math.round(s.intensity * 100);
      var visualPercent = Math.max(5, intensityPercent);
      intensityHtml = '<div class="state-detail-section">' +
        '<h3>Открытость</h3>' +
        '<div class="state-card-intensity state-static-metric" style="max-width:300px;">' +
          '<span>' + escapeHtml(s.intensity_label || '') + ' — ' + visualPercent + '%</span>' +
          '<div class="state-intensity-bar">' +
            '<div class="state-intensity-fill" style="width: ' + visualPercent + '%; background: ' + color + '"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return '<div class="states-page">' +
      '<div class="states-controls">' +
      '</div>' +
      '<div class="state-detail">' +
        '<div class="state-detail-hero" style="border-bottom-color: ' + color + '33;">' +
          '<span class="state-detail-hero-paleo">' + escapeHtml(s.paleo || '') + '</span>' +
          '<h2>' + escapeHtml(s.name) + '</h2>' +
          '<div class="hebrew" dir="rtl">' + escapeHtml(s.hebrew || '') + '</div>' +
          '<div class="physics">' + escapeHtml(s.physics || '') + '</div>' +
          '<div class="state-detail-olam"><span>Олам:</span> ' + escapeHtml(s.olam || '') + '</div>' +
        '</div>' +
        landscapeHtml +
        intensityHtml +
        paleoHtml +
        meaningHtml +
        examplesHtml +
        citiesHtml +
      '</div>' +
    '</div>';
  }

  function renderLandscapePage() {
    var firstState = states.slice().sort(function(a, b) {
      return (Number(a.intensity) || 0) - (Number(b.intensity) || 0);
    })[0];
    if (!firstState) return '<div class="lab-alert lab-alert-info">Карта состояний пока пуста.</div>';
    currentStateId = firstState.id;

    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('states', 'landscape', {
        kicker: 'АЛЕФИ · КАРТА СОСТОЯНИЙ',
        title: 'Визуальная карта',
        subtitle: 'Ландшафт переходов между состояниями',
        icon: 'ui/web.png'
      });
    }

    return '<div class="states-page states-landscape-page">' +
      '<div class="states-controls"><button type="button" class="states-nav-btn states-nav-back" onclick="AlephyStates.openGrid()">Все состояния</button></div>' +
      renderStateLandscape(firstState) +
    '</div>';
  }

  // ===== ЛАНДШАФТ СОСТОЯНИЯ =====
  function renderStateLandscape(state) {
    var transitions = (state.transitions || []).filter(function(transition) {
      return statesById[transition.to];
    });
    var landscapeTransitionId = transitions.some(function(transition) {
      return transition.to === selectedLandscapeTransitionId;
    }) ? selectedLandscapeTransitionId : (transitions[0] ? transitions[0].to : null);
    var selectedTransition = transitions.find(function(transition) {
      return transition.to === landscapeTransitionId;
    });
    var target = selectedTransition && statesById[selectedTransition.to];
    var contour = states.slice().sort(function(a, b) {
      return (Number(a.intensity) || 0) - (Number(b.intensity) || 0);
    });

    var routesHtml = transitions.map(function(transition, index) {
      var routeTarget = statesById[transition.to];
      var active = transition.to === landscapeTransitionId ? ' is-active' : '';
      return '<button type="button" class="state-landscape-route' + active + '" data-to="' + escapeHtml(transition.to) + '" aria-pressed="' + (transition.to === landscapeTransitionId ? 'true' : 'false') + '">' +
        '<span class="state-landscape-route-line" aria-hidden="true"><i></i></span>' +
        '<span class="state-landscape-route-index">0' + (index + 1) + '</span>' +
        '<span class="state-landscape-route-paleo" aria-hidden="true">' + escapeHtml(routeTarget.paleo || '') + '</span>' +
        '<span class="state-landscape-route-copy"><strong>' + escapeHtml(routeTarget.name) + '</strong><small>' + escapeHtml(transition.label || 'Открыть маршрут') + '</small></span>' +
      '</button>';
    }).join('');

    var routeDetailHtml = target ? '<div class="state-landscape-route-detail" aria-live="polite">' +
      '<span class="state-landscape-route-kicker">Выбранный маршрут</span>' +
      '<div class="state-landscape-route-chain"><strong>' + escapeHtml(state.name) + '</strong><span aria-hidden="true">↓</span><strong>' + escapeHtml(target.name) + '</strong>' +
      (selectedTransition.label ? '<span class="state-landscape-route-label">' + escapeHtml(selectedTransition.label) + '</span>' : '') + '</div>' +
      (selectedTransition.action ? '<p><b>Хук:</b> ' + escapeHtml(selectedTransition.action) + '</p>' : '') +
      '<button type="button" class="state-landscape-open" data-to="' + escapeHtml(target.id) + '">Открыть состояние</button>' +
    '</div>' : '<div class="state-landscape-route-detail is-empty">Для этого состояния пока не задан маршрут перехода.</div>';

    return '<section class="state-landscape" style="--landscape-color: #8a613c;" aria-labelledby="state-landscape-title">' +
      '<div class="state-landscape-head"><div><span class="state-landscape-kicker">ЛАНДШАФТ СОСТОЯНИЯ</span><h3 id="state-landscape-title">Пространство и доступные переходы</h3></div></div>' +
      '<div class="state-landscape-stage">' +
        '<div class="state-landscape-terrain" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<div class="state-landscape-current"><span class="state-landscape-current-paleo" aria-hidden="true">' + escapeHtml(state.paleo || '') + '</span><span class="state-landscape-current-label">Текущее состояние</span><strong>' + escapeHtml(state.name) + '</strong><small>' + escapeHtml(state.intensity_label || '') + '</small></div>' +
      '</div>' +
      '<section class="state-landscape-routes" aria-label="Переходы из состояния ' + escapeHtml(state.name) + '"><h4>Переходы</h4>' + routesHtml + '</section>' +
      routeDetailHtml +
      '<div class="state-landscape-contour" aria-label="Полный контур состояний">' + contour.map(function(item) {
        var current = item.id === state.id ? ' is-current' : '';
        return '<span class="state-landscape-contour-node' + current + '" title="' + escapeHtml(item.name) + '" style="--node-color: #8a613c"><i></i><small>' + escapeHtml(item.name) + '</small></span>';
      }).join('') + '</div>' +
    '</section>';
  }

  function selectLandscapeTransition(container, targetId) {
    selectedLandscapeTransitionId = targetId;
    var current = statesById[currentStateId];
    var landscape = container.querySelector('.state-landscape');
    if (!current || !landscape) return;
    var replacement = document.createElement('div');
    replacement.innerHTML = renderStateLandscape(current);
    landscape.replaceWith(replacement.firstChild);
    attachLandscapeHandlers(container);
  }

  // ===== ГОРОДА ДЛЯ СОСТОЯНИЯ =====
  function renderCitiesForState(stateId) {
    var matching = cartographyEntries.filter(function(e) {
      return e.state === stateId;
    });

    if (!matching.length) {
      return '';
    }

    return '<div class="state-detail-section">' +
      '<h3>Города и страны в этом состоянии</h3>' +
      '<div class="state-cities">' +
      matching.map(function(e) {
        return '<div class="state-city-card" role="button" tabindex="0" aria-label="Открыть запись картографии: ' + escapeHtml(e.name) + '" data-city-id="' + escapeHtml(e.id) + '">' +
          '<div class="city-name">' + escapeHtml(e.name) + '</div>' +
          (e.hebrew ? '<div class="city-hebrew" dir="rtl">' + escapeHtml(e.hebrew) + '</div>' : '') +
          (e.summary ? '<div class="city-summary">' + escapeHtml(e.summary) + '</div>' : '') +
        '</div>';
      }).join('') +
      '</div>' +
    '</div>';
  }

  // ===== ДИАГНОСТИКА =====
  function renderDiagnostic() {
    // Собираем все вопросы
    var allQuestions = [];
    states.forEach(function(s) {
      if (s.diagnostic_questions) {
        s.diagnostic_questions.forEach(function(q) {
          allQuestions.push({
            question: q,
            stateId: s.id
          });
        });
      }
    });

    if (!allQuestions.length) {
      return '<div class="lab-alert lab-alert-info">Для диагностики пока нет вопросов.</div>';
    }

    var total = allQuestions.length;
    var current = diagnosticState.currentQuestion;
    var answers = diagnosticState.answers;

    // Если диагностика завершена — показываем результат
    if (diagnosticState.completed) {
      return renderDiagnosticResult(allQuestions);
    }

    // Текущий вопрос
    var q = allQuestions[current];
    if (!q) {
      return renderDiagnosticResult(allQuestions);
    }

    var selectedValue = answers[q.question.id] || '';

    // Варианты ответов (шкала)
    var scaleOptions = [
      { value: 0, label: 'Совсем нет' },
      { value: 0.25, label: 'Скорее нет' },
      { value: 0.5, label: 'Не уверен' },
      { value: 0.75, label: 'Скорее да' },
      { value: 1, label: 'Полностью да' }
    ];

    var scaleHtml = '<div class="question-options-scale">';
    scaleOptions.forEach(function(opt) {
      var isSelected = selectedValue === opt.value;
      scaleHtml += '<div class="scale-option' + (isSelected ? ' selected' : '') + '" data-value="' + opt.value + '" onclick="AlephyStates.selectAnswer(\'' + escapeHtml(q.question.id) + '\', ' + opt.value + ')">' +
        '<span class="scale-value">' + opt.value * 4 + '</span>' +
        '<span class="scale-label">' + escapeHtml(opt.label) + '</span>' +
      '</div>';
    });
    scaleHtml += '</div>';

    var progressPercent = ((current) / total) * 100;
    var hasAnswer = selectedValue !== '';

    return '<div class="states-page">' +
      '<div class="states-controls">' +
      '</div>' +
      '<div class="diagnostic-page">' +
        '<div class="diagnostic-header">' +
          '<h2><img src="assets/icons/32/archaeology/testtube.svg" class="lab-icon" alt=""> Диагностика состояния</h2>' +
          '<p>Ответь на 7 вопросов, чтобы определить своё текущее пространство.</p>' +
        '</div>' +
        '<div class="diagnostic-progress">' +
          '<div class="diagnostic-progress-bar">' +
            '<div class="diagnostic-progress-fill" style="width: ' + progressPercent + '%"></div>' +
          '</div>' +
          '<div class="diagnostic-progress-text">Вопрос ' + (current + 1) + ' из ' + total + '</div>' +
        '</div>' +
        '<div class="question-card">' +
          '<div class="question-text">' + escapeHtml(q.question.text) + '</div>' +
          scaleHtml +
        '</div>' +
        '<div class="diagnostic-actions">' +
          (current > 0
            ? '<button class="btn-diagnostic-prev" onclick="AlephyStates.prevQuestion()"><img src="assets/icons/32/nav/home.png" class="lab-icon" alt=""> Назад</button>'
            : '') +
          (hasAnswer
            ? (current < total - 1
                ? '<button class="btn-diagnostic-next" onclick="AlephyStates.nextQuestion()"><img src="assets/icons/32/nav/door.png" class="lab-icon" alt=""> Далее</button>'
                : '<button class="btn-diagnostic-next" onclick="AlephyStates.completeDiagnostic()"><img src="assets/icons/32/archaeology/lamp.png" class="lab-icon" alt=""> Узнать результат</button>')
            : '<button class="btn-diagnostic-next" disabled>Выберите ответ</button>'
          ) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ===== РЕЗУЛЬТАТ ДИАГНОСТИКИ =====
  function renderDiagnosticResult(allQuestions) {
    var answers = diagnosticState.answers;

    // Вычисляем взвешенные суммы
    var scores = {};
    states.forEach(function(s) { scores[s.id] = 0; });

    allQuestions.forEach(function(q) {
      var value = answers[q.question.id];
      if (value === undefined || value === '') return;
      var weights = q.question.weight || {};
      Object.keys(weights).forEach(function(stateId) {
        if (scores[stateId] !== undefined) {
          scores[stateId] += weights[stateId] * value;
        }
      });
    });

    // Определяем лучшее состояние
    var bestStateId = null;
    var bestScore = -1;
    Object.keys(scores).forEach(function(id) {
      if (scores[id] > bestScore) {
        bestScore = scores[id];
        bestStateId = id;
      }
    });

    // Если нет результата
    if (!bestStateId || bestScore <= 0) {
      return '<div class="states-page"><div class="diagnostic-page">' +
        '<div class="diagnostic-header"><h2>Результат диагностики</h2></div>' +
        '<p class="text-muted" style="text-align:center;">Недостаточно данных для определения состояния. Пройди диагностику заново.</p>' +
        '<div class="result-actions"><button class="btn-result-restart" onclick="AlephyStates.restartDiagnostic()">Пройти заново</button></div>' +
      '</div></div>';
    }

    var state = statesById[bestStateId];
    if (!state) {
      return '<div class="lab-alert lab-alert-error">Ошибка: состояние не найдено</div>';
    }

    // Рекомендуемый переход
    var transition = (state.transitions && state.transitions.length)
      ? state.transitions[0]
      : null;
    var targetName = transition && statesById[transition.to]
      ? statesById[transition.to].name
      : '';

    return '<div class="states-page">' +
      '<div class="states-controls">' +
      '</div>' +
      '<div class="diagnostic-page">' +
        '<div class="diagnostic-result">' +
          '<span class="diagnostic-result-paleo">' + escapeHtml(state.paleo || '') + '</span>' +
          '<h3>Твоё состояние — ' + escapeHtml(state.name) + '</h3>' +
          '<div class="result-physics">' + escapeHtml(state.physics || '') + '</div>' +
          (transition
            ? '<div class="result-transition">' +
                '<span class="arrow">→</span>' +
                '<div>' +
                  '<span class="to-state">' + escapeHtml(targetName) + '</span>' +
                  (transition.action ? '<span class="action">' + escapeHtml(transition.action) + '</span>' : '') +
                '</div>' +
              '</div>'
            : '') +
          '<div class="result-actions">' +
            '<button class="btn-result-state" onclick="AlephyStates.openState(\'' + escapeHtml(bestStateId) + '\')"><img src="assets/icons/32/ui/book.png" class="lab-icon" alt=""> Подробнее о состоянии</button>' +
            '<button class="btn-result-restart" onclick="AlephyStates.restartDiagnostic()"><img src="assets/icons/32/ui/hourglass.png" class="lab-icon" alt=""> Пройти заново</button>' +
            '<button class="btn-result-share" onclick="AlephyStates.shareResult(\'' + escapeHtml(state.name) + '\', \'' + escapeHtml(transition ? targetName : '') + '\')"><img src="assets/icons/32/ui/export.png" class="lab-icon" alt=""> Поделиться</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ===== НАВИГАЦИЯ ПО ДИАГНОСТИКЕ =====
  function selectAnswer(questionId, value) {
    diagnosticState.answers[questionId] = value;
    renderCurrentContainer();
  }

  function nextQuestion() {
    var allQuestions = [];
    states.forEach(function(s) {
      if (s.diagnostic_questions) {
        s.diagnostic_questions.forEach(function(q) {
          allQuestions.push({ question: q, stateId: s.id });
        });
      }
    });

    if (diagnosticState.currentQuestion < allQuestions.length - 1) {
      diagnosticState.currentQuestion++;
      renderCurrentContainer();
    }
  }

  function prevQuestion() {
    if (diagnosticState.currentQuestion > 0) {
      diagnosticState.currentQuestion--;
      renderCurrentContainer();
    }
  }

  function completeDiagnostic() {
    diagnosticState.completed = true;
    renderCurrentContainer();
  }

  function restartDiagnostic() {
    diagnosticState.currentQuestion = 0;
    diagnosticState.answers = {};
    diagnosticState.completed = false;
    renderCurrentContainer();
  }

  function renderCurrentContainer() {
    var container = document.getElementById('states');
    if (container) renderView(container);
  }

  // ===== ПУБЛИЧНАЯ НАВИГАЦИЯ =====
  function openGrid() {
    currentView = 'grid';
    currentStateId = null;
    diagnosticState.completed = false;
    selectedLandscapeTransitionId = null;
    var container = document.getElementById('states');
    // Если уже на странице состояний, hashchange не возникает — рисуем сразу.
    if (container && states.length) {
      renderView(container);
      return;
    }
    LabRouter.navigate('states');
  }

  function openLandscape() {
    currentView = 'landscape';
    currentStateId = null;
    selectedLandscapeTransitionId = null;
    var container = document.getElementById('states');
    if (container && states.length) {
      renderView(container);
      return;
    }
    LabRouter.navigate('states', null, { map: 'landscape' });
  }

  function openState(id) {
    currentView = 'detail';
    currentStateId = id;
    selectedLandscapeTransitionId = null;
    LabRouter.navigate('states', null, { state: id });
  }

  function openDiagnostic() {
    currentView = 'diagnostic';
    currentStateId = null;
    diagnosticState.currentQuestion = 0;
    diagnosticState.answers = {};
    diagnosticState.completed = false;
    LabRouter.navigate('states', null, { diagnostic: 'true' });
  }

  function shareResult(stateName, transitionName) {
    var text = '🧪 Моё состояние по карте «Алефи»: ' + stateName;
    if (transitionName) text += ' → Рекомендуемый переход: ' + transitionName;
    text += '\n\nУзнай своё состояние: https://ortamy.github.io/alephy/pages/lab/#states';

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        if (window.LabToast) LabToast.show('Результат скопирован в буфер');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (window.LabToast) LabToast.show('Результат скопирован в буфер');
  }

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    init: init,
    loadData: loadData,
    openGrid: openGrid,
    openLandscape: openLandscape,
    openState: openState,
    openDiagnostic: openDiagnostic,
    selectAnswer: selectAnswer,
    nextQuestion: nextQuestion,
    prevQuestion: prevQuestion,
    completeDiagnostic: completeDiagnostic,
    restartDiagnostic: restartDiagnostic,
    shareResult: shareResult
  };
})();

window.AlephyStates = AlephyStates;
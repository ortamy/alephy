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

  // Делегат i18n: литералы t('key', 'русский резерв') читает tools/i18n-extract.py.
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
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
    // Переходы ландшафта и кнопка маршрута ведут на целевое состояние.
    container.querySelectorAll('.state-landscape-route, .state-landscape-open').forEach(function(route) {
      route.addEventListener('click', function() {
        var targetId = this.getAttribute('data-to');
        if (targetId) openState(targetId);
      });
    });

    // Чип-навигация состояний под героем.
    container.querySelectorAll('.state-nav-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var id = this.getAttribute('data-state-id');
        if (id) openState(id);
      });
    });

    var activeChip = container.querySelector('.state-nav-chip.is-active');
    if (activeChip && typeof activeChip.scrollIntoView === 'function') {
      requestAnimationFrame(function() {
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        activeChip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
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
      '<button type="button" class="states-map-launch" onclick="AlephyStates.openLandscape()">' +
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

  // ===== СЕКЦИИ-ГЛАВЫ: номер + uppercase-лейбл вместо сериф-заголовков =====
  function chapterHead(index, label) {
    return '<div class="state-chapter-head"><span class="state-chapter-index" aria-hidden="true">' + index + '</span><span class="state-chapter-label">' + escapeHtml(label) + '</span></div>';
  }

  // ===== ЧИП-НАВИГАЦИЯ СОСТОЯНИЙ =====
  function renderStateNav(currentId) {
    var sorted = states.slice().sort(function(a, b) {
      return (Number(a.intensity) || 0) - (Number(b.intensity) || 0);
    });
    return '<nav class="state-nav" aria-label="' + escapeHtml(t('states.nav.aria', 'Все состояния')) + '">' +
      sorted.map(function(item) {
        var active = item.id === currentId;
        return '<button type="button" class="state-nav-chip' + (active ? ' is-active' : '') + '" data-state-id="' + escapeHtml(item.id) + '"' + (active ? ' aria-current="true"' : '') + '>' + escapeHtml(item.name) + '</button>';
      }).join('') +
    '</nav>';
  }

  // ===== РЕНДЕР СТРАНИЦЫ СОСТОЯНИЯ =====
    function renderStateDetail(id) {
    var s = statesById[id];
    if (!s) return '<div class="lab-alert lab-alert-error">' + escapeHtml(t('states.detail.notFound', 'Состояние не найдено')) + '</div>';

    var intensityPercent = s.intensity !== undefined ? Math.round(s.intensity * 100) : null;

        // Динамический герой: кикер из реестра LabHero + имя состояния,
    // чипы из данных (иврит, открытость) — механизм как у чекеров/агентов.
    if (window.LabHero && window.LabHero.setView) {
      var heroMeta = [];
      if (s.hebrew) heroMeta.push({ label: s.hebrew });
      if (intensityPercent !== null) heroMeta.push({ label: t('states.detail.openness', 'открытость') + ' ' + intensityPercent + '%' });
      if (s.olam) heroMeta.push({ label: s.olam, className: 'lab-hero__chip--label' });
      window.LabHero.setView('states', 'detail', {
        kicker: t('lab.hero.states.kicker', 'АЛЕФИ · КАРТА СОСТОЯНИЙ') + ' · ' + String(s.name).toUpperCase(),
        title: s.name,
        subtitle: s.physics || '',
        icon: '',
        glyph: Array.from(String(s.paleo || ''))[0] || '',
        badge: { label: t('states.detail.badge', 'интерпретация') },
        meta: heroMeta
      });
    }

    var landscapeHtml = renderStateLandscape(s);

    // 01 Открытость: тонкий бар + mono-процент.
    var intensityHtml = '';
    if (intensityPercent !== null) {
      var visualPercent = Math.max(5, intensityPercent);
      intensityHtml = '<section class="state-detail-section">' +
        chapterHead('01', t('states.chapter.openness', 'Открытость')) +
        '<div class="state-openness">' +
          '<span class="state-openness-label">' + escapeHtml(s.intensity_label || '') + '</span>' +
          '<span class="state-openness-value">' + visualPercent + '%</span>' +
          '<div class="state-intensity-bar"><div class="state-intensity-fill" style="width: ' + visualPercent + '%"></div></div>' +
        '</div>' +
      '</section>';
    }

    // 02 Палео-разбор: hairline-карточки глифов + caption muted слева.
    var paleoHtml = '';
    if (s.paleo_breakdown && s.paleo_breakdown.length) {
      paleoHtml = '<section class="state-detail-section">' +
        chapterHead('02', t('states.chapter.paleo', 'Палео-разбор')) +
        '<div class="paleo-breakdown">';
      s.paleo_breakdown.forEach(function(p) {
        paleoHtml += '<div class="paleo-breakdown-item">' +
          '<span class="paleo-char">' + escapeHtml(p.paleo || '') + '</span>' +
          '<span class="paleo-name">' + escapeHtml(p.name || '') + '</span>' +
          '<span class="paleo-func">' + escapeHtml(p.function || '') + '</span>' +
        '</div>';
      });
      paleoHtml += '</div>' +
        (s.paleo_meaning ? '<p class="paleo-meaning-caption">' + escapeHtml(s.paleo_meaning) + '</p>' : '') +
      '</section>';
    }

    // 03 Смысл — дополняет короткое описание в шапке, а не повторяет его.
    var isMeaningDuplicate = normalizeText(s.meaning) === normalizeText(s.physics);
    var meaningHtml = s.meaning && !isMeaningDuplicate ? '<section class="state-detail-section">' + chapterHead('03', t('states.chapter.meaning', 'Смысл')) + '<p>' + escapeHtml(s.meaning) + '</p></section>' : '';

    // 04 Примеры
    var examplesHtml = '';
    if (s.examples && s.examples.length) {
      examplesHtml = '<section class="state-detail-section">' +
        chapterHead('04', t('states.chapter.examples', 'Примеры')) +
        '<div class="examples-list state-card-grid" role="list">' +
        s.examples.map(function(ex, index) {
          return '<div class="example-tag state-example-card" role="listitem"><span class="state-example-index" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span><span>' + escapeHtml(ex) + '</span></div>';
        }).join('') +
        '</div></section>';
    }

    // 05 Города в этом состоянии
    var citiesHtml = renderCitiesForState(id);

    return '<div class="states-page">' +
      '<div class="state-detail">' +
        renderStateNav(id) +
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
      renderStateNav(firstState.id) +
      renderStateLandscape(firstState) +
    '</div>';
  }

  // ===== ЛАНДШАФТ СОСТОЯНИЯ =====
  function renderStateLandscape(state) {
    var transitions = (state.transitions || []).filter(function(transition) {
      return statesById[transition.to];
    });
    var recommended = transitions[0] || null;
    var target = recommended && statesById[recommended.to];

    // Переходы — hairline-строки: стрелка + paleo-глифы + имя + подсказка действия.
    var routesHtml = transitions.map(function(transition) {
      var routeTarget = statesById[transition.to];
      var hint = transition.action || transition.label || '';
      return '<button type="button" class="state-landscape-route" data-to="' + escapeHtml(transition.to) + '">' +
        '<span class="state-landscape-route-arrow" aria-hidden="true">→</span>' +
        '<span class="state-landscape-route-paleo" aria-hidden="true">' + escapeHtml(routeTarget.paleo || '') + '</span>' +
        '<span class="state-landscape-route-copy"><strong>' + escapeHtml(routeTarget.name) + '</strong>' +
        (hint ? '<small>' + escapeHtml(hint) + '</small>' : '') +
        '</span>' +
      '</button>';
    }).join('');

    // Рекомендуемый маршрут: чипы «Тоху → Шаанаим» + muted-подсказка + compact-кнопка справа.
    var routeHtml = target ? '<div class="state-landscape-route-detail">' +
      '<span class="state-landscape-route-kicker">' + escapeHtml(t('states.landscape.route', 'Маршрут')) + '</span>' +
      '<div class="state-landscape-route-chain">' +
        '<span class="state-landscape-chain-chip">' + escapeHtml(state.name) + '</span>' +
        '<span class="state-landscape-chain-arrow" aria-hidden="true">→</span>' +
        '<span class="state-landscape-chain-chip is-target">' + escapeHtml(target.name) + '</span>' +
      '</div>' +
      (recommended.action ? '<p class="state-landscape-route-hint">' + escapeHtml(recommended.action) + '</p>' : '') +
      '<button type="button" class="state-landscape-open" data-to="' + escapeHtml(target.id) + '">' + escapeHtml(t('states.landscape.open', 'Открыть состояние')) + '</button>' +
    '</div>' : '<div class="state-landscape-route-detail is-empty">' + escapeHtml(t('states.landscape.empty', 'Для этого состояния пока не задан маршрут перехода.')) + '</div>';

    return '<section class="state-landscape" aria-labelledby="state-landscape-title">' +
      '<div class="state-landscape-head"><span class="state-landscape-kicker" id="state-landscape-title">' + escapeHtml(t('states.landscape.label', 'Ландшафт')) + '</span></div>' +
      '<div class="state-landscape-stage">' +
        '<div class="state-landscape-current">' +
          '<span class="state-landscape-current-paleo" aria-hidden="true">' + escapeHtml(state.paleo || '') + '</span>' +
          '<strong>' + escapeHtml(state.name) + '</strong>' +
          '<small>' + escapeHtml(state.intensity_label || '') + '</small>' +
        '</div>' +
      '</div>' +
      (routesHtml ? '<div class="state-landscape-routes" aria-label="' + escapeHtml(t('states.landscape.routesAria', 'Переходы из состояния')) + '">' + routesHtml + '</div>' : '') +
      routeHtml +
    '</section>';
  }

  // ===== ГОРОДА ДЛЯ СОСТОЯНИЯ =====
  function renderCitiesForState(stateId) {
    var matching = cartographyEntries.filter(function(e) {
      return e.state === stateId;
    });

    if (!matching.length) {
      return '';
    }

    return '<section class="state-detail-section">' +
      chapterHead('05', t('states.chapter.cities', 'Города')) +
      '<div class="state-cities">' +
      matching.map(function(e) {
        return '<div class="state-city-card" role="button" tabindex="0" aria-label="Открыть запись картографии: ' + escapeHtml(e.name) + '" data-city-id="' + escapeHtml(e.id) + '">' +
          '<div class="city-name">' + escapeHtml(e.name) + '</div>' +
          (e.hebrew ? '<div class="city-hebrew" dir="rtl">' + escapeHtml(e.hebrew) + '</div>' : '') +
          (e.summary ? '<div class="city-summary">' + escapeHtml(e.summary) + '</div>' : '') +
        '</div>';
      }).join('') +
      '</div>' +
    '</section>';
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
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

  // Каталог карточек состояний: поиск по названию/олиму/физике и порядок
  // вывода. Сжатость (intensity) — родной порядок модуля, он же по умолчанию.
  let gridState = { query: '', sort: 'intensity' };
  let landscapeQuery = '';
  // Поиск на паспорте состояния: гасит несовпавшие узлы компаса, не
  // перестраивая лист. Живёт отдельно от фильтра карты.
  let detailQuery = '';
  const STATE_SORTS = {
    intensity: 'По сжатости',
    name: 'По алфавиту'
  };

  // ===== УТИЛИТЫ =====
  function escapeHtml(text) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
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
    if (currentView === 'landscape') {
      bindLandscapeToolbar(container);
    } else if (currentView === 'detail') {
      bindDetailToolbar(container);
    } else if (currentView !== 'diagnostic') {
      bindGridToolbar(container);
    }
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

    // Кнопки тулбара карты приходят с lucide-иконками — их нужно
    // материализовать после каждой перерисовки, не только в каталоге.
    refreshIcons();
  }

  // Спектр: ховер подсвечивает рёбра, клик открывает состояние. Отдельный
  // биндер, потому что тело карты перерисовывается на каждый ввод поиска и
  // связи нужно навешивать заново, не трогая кнопки тулбара.
  function bindSpectrum(container) {
    if (!window.AlephyStateSpectrum) return;
    window.AlephyStateSpectrum.bind(container, function(id) {
      if (currentView === 'landscape') {
        selectLandscapeState(id);
        return;
      }
      openState(id);
    });
  }

  function bindLandscapeRoutes(container) {
    container.querySelectorAll('.state-landscape-route, .state-landscape-open').forEach(function(route) {
      route.addEventListener('click', function() {
        var targetId = this.getAttribute('data-to');
        if (targetId) openState(targetId);
      });
    });
  }

  function attachLandscapeHandlers(container) {
    // Спектр: ховер подсвечивает рёбра, клик открывает состояние.
    bindSpectrum(container);

    // Возврат к каталогу состояний: кнопка тулбара карты.
    container.querySelectorAll('[data-action="open-grid"]').forEach(function(button) {
      button.addEventListener('click', function() { openGrid(); });
    });

    // Переходы ландшафта и кнопка маршрута ведут на целевое состояние.
    bindLandscapeRoutes(container);

    // Узлы компаса-колеса: клик открывает состояние. Это единственная
    // навигация по состояниям на паспорте — отдельного списка чипов нет.
    container.querySelectorAll('.state-compass-node').forEach(function(node) {
      node.addEventListener('click', function() {
        var id = this.getAttribute('data-state-id');
        if (id) openState(id);
      });
    });
  }

  // ===== РЕНДЕР СЕТКИ КАРТОЧЕК =====
  function visibleStates() {
    var query = String(gridState.query || '').trim().toLowerCase();
    var list = states.filter(function(s) {
      if (!query) return true;
      return normalizeText(s.name + ' ' + (s.olam || '') + ' ' + (s.physics || '') + ' ' + (s.meaning || '')).indexOf(query) !== -1;
    });
    // Сжатые — потом открытые; по алфавиту порядок задаёт имя.
    return list.sort(gridState.sort === 'name'
      ? function(a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); }
      : function(a, b) { return (a.intensity || 0) - (b.intensity || 0); });
  }

  function firstLandscapeState() {
    return states.slice().sort(function(a, b) {
      return (Number(a.intensity) || 0) - (Number(b.intensity) || 0);
    })[0] || null;
  }

  function landscapeMatches() {
    var query = normalizeText(landscapeQuery);
    if (!query) return states.slice();
    return states.filter(function(state) {
      var hay = normalizeText([state.name, state.hebrew, state.olam, state.physics, state.paleo].join(' '));
      return hay.indexOf(query) !== -1;
    });
  }

  function resolveLandscapeState() {
    var matches = landscapeMatches();
    if (currentStateId && statesById[currentStateId]) {
      var stillVisible = !landscapeQuery || matches.some(function(state) {
        return state.id === currentStateId;
      });
      if (stillVisible || !matches.length) return statesById[currentStateId];
    }
    return matches[0] || firstLandscapeState();
  }

  function stateCardsMarkup(list) {
    return list.map(function(s, i) {
      var color = s.color || '#b8860b';
      var paleo = s.paleo || '';
      var paleoInline = paleo ? '<span class="state-paleo-inline">' + escapeHtml(paleo) + '</span>' : '';
      var lucideIcon = getLucideForState(s.id);
      return '<div class="state-card" data-state-id="' + escapeHtml(s.id) + '" role="button" aria-label="Открыть состояние: ' + escapeHtml(s.name) + '" tabindex="0" style="animation-delay:' + (i * 70) + 'ms; --state-color: ' + color + '">' +
        '<div class="state-card-icon"><i data-lucide="' + lucideIcon + '" aria-hidden="true"></i></div>' +
        '<h2 class="state-card-name">' + paleoInline + escapeHtml(s.name) + '</h2>' +
        '<div class="state-card-role">' + escapeHtml(s.olam || '') + '</div>' +
        '<div class="state-card-secondary">' +
          '<div class="state-card-hebrew" dir="rtl">' + escapeHtml(s.hebrew || '') + '</div>' +
          '<div class="state-card-physics">' + escapeHtml(s.physics || '') + '</div>' +
          // Дыхательный слой: ощущение тела в состоянии. Идёт после описания
          // и до шкалы открытости, поэтому читается как слой, а не как вывод.
          (s.breath ? '<div class="state-card-breath">' + escapeHtml(s.breath) + '</div>' : '') +
          '<div class="state-card-intensity">' +
            '<span>' + escapeHtml(s.intensity_label || '') + '</span>' +
            '<div class="state-intensity-bar">' +
              '<div class="state-intensity-fill" style="width: ' + (s.intensity * 100) + '%; background: ' + color + '"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function statesBodyMarkup(list) {
    if (!list.length) return '<div class="lab-alert lab-alert-info">Состояние не найдено.</div>';
    return '<div class="states-grid">' + stateCardsMarkup(list) + '</div>';
  }

  function statesToolbarMarkup(shown) {
    var sortOptions = Object.keys(STATE_SORTS).map(function(value) {
      return '<option value="' + value + '"' + (value === gridState.sort ? ' selected' : '') + '>' + STATE_SORTS[value] + '</option>';
    }).join('');

    return '<div class="lab-toolbar" role="search" aria-label="Управление каталогом состояний">' +
      '<input type="search" class="lab-input lab-toolbar-search" id="states-search" autocomplete="off" placeholder="Поиск по состояниям…" aria-label="Поиск по состояниям" value="' + escapeHtml(gridState.query) + '">' +
      '<div class="lab-toolbar-group" role="group" aria-label="Сортировка каталога">' +
        '<select id="states-sort" class="lab-input lab-toolbar-select" aria-label="Порядок состояний">' + sortOptions + '</select>' +
      '</div>' +
      '<div class="lab-toolbar-actions">' +
        '<span class="lab-toolbar-count" aria-live="polite"><strong>' + shown + '</strong> из ' + states.length + '</span>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-btn" id="states-reset"' + (gridState.query ? '' : ' hidden') + '><i data-lucide="rotate-ccw" class="lab-icon" aria-hidden="true"></i>Сбросить</button>' +
        // Плитка-запуск ушла в панель: на сетке карточек она занимала целую
        // строку ради одного перехода. Формулировка совпадает с заголовком
        // ландшафта, чтобы её не путали с h1 «Карта состояний».
        '<button type="button" class="lab-btn lab-btn-primary lab-toolbar-btn" id="states-open-map" title="Открыть визуальную карту переходов"><i data-lucide="map" class="lab-icon" aria-hidden="true"></i>Визуальная карта</button>' +
      '</div>' +
    '</div>';
  }

  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (error) { /* иконки не критичны */ }
    }
  }

  /* Перерисовывается только сетка: шапка и ландшафтная кнопка остаются
     на месте, поэтому ввод в поиске не пересобирает страницу целиком. */
  function refreshStatesGrid(container) {
    var body = container.querySelector('#states-grid-body');
    if (!body) return renderView(container);
    var list = visibleStates();
    body.innerHTML = statesBodyMarkup(list);
    var count = container.querySelector('.lab-toolbar-count strong');
    if (count) count.textContent = String(list.length);
    var reset = container.querySelector('#states-reset');
    if (reset) reset.hidden = !gridState.query;
    attachHandlers(container);
    refreshIcons();
  }

  function renderGrid() {
    var list = visibleStates();

    return '<div class="states-page states-grid-page">' +
      '<div class="states-head">' +
        '<h1><img src="assets/icons/32/ui/web.png" class="lab-icon" alt=""> Карта состояний</h1>' +
        '<p class="subtitle">Семь пространств палео-механики — от запертости (Тоху) до завершённости (Эден). Каждое состояние — это не метафора, а физика: степень сжатости или открытости твоего пространства.</p>' +
      '</div>' +
      statesToolbarMarkup(list.length) +
      '<div class="states-map">' +
        '<div id="states-grid-body">' + statesBodyMarkup(list) + '</div>' +
      '</div>' +
    '</div>';
  }

  function bindGridToolbar(container) {
    var search = container.querySelector('#states-search');
    var sort = container.querySelector('#states-sort');
    var reset = container.querySelector('#states-reset');

    if (search) {
      search.addEventListener('input', function() {
        gridState.query = search.value;
        refreshStatesGrid(container);
      });
    }
    if (sort) {
      sort.addEventListener('change', function() {
        gridState.sort = sort.value;
        refreshStatesGrid(container);
      });
    }
    if (reset) {
      reset.addEventListener('click', function() {
        gridState.query = '';
        renderView(container);
      });
    }
    var openMap = container.querySelector('#states-open-map');
    if (openMap) {
      openMap.addEventListener('click', function() { openLandscape(); });
    }
    // Панель приходит из строки выше, её иконки lucide нужно materialize
    // после каждого входа в сетку.
    refreshIcons();
  }

  // ===== БЕНТО-ЯЧЕЙКИ ВНУТРЕННЕЙ СТРАНИЦЕ =====
  // Секции-главы печатаются ячейками общего листа (тот же приём, что
  // .rel-cell в «Религионизмах»): номер главы — mono, лейбл — uppercase
  // подпись полосы, а не сериф-заголовок, и волосяная линия живёт только
  // на .state-cell-head.
  function cellHead(index, label) {
    return '<div class="state-cell-head">' +
      (index ? '<span class="state-cell-num">' + escapeHtml(index) + '</span>' : '') +
      '<span class="state-cell-title">' + escapeHtml(label) + '</span>' +
    '</div>';
  }

  // span — модификатор размера из CSS (.state-cell--full/wide/half/tall),
  // а не число колонок: раскладку читает стилевой файл.
  function stateCell(index, label, body, span) {
    return '<section class="state-cell state-cell--' + span + '">' +
      cellHead(index, label) +
      '<div class="state-cell-body">' + body + '</div>' +
    '</section>';
  }

  // ===== РЕНДЕР ПАСПОРТА СОСТОЯНИЯ =====
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

    // Бенто-лист: раскладка задана спанами ячеек, а не порядком секций.
    // Пустая глава просто не печатается — сетка доберёт освобождённые
    // колонки соседям, поэтому фиксированного числа ячеек не требуется.
    var cells = [];

    // Компас — единственное место, где собраны все состояния: колесо
    // глифов по возрастанию сжатости, текущее — в центре. Отдельного
    // списка-навигации (спектр, лента чипов) на паспорте больше нет.
    cells.push(stateCell('01', t('states.compass.label', 'Компас'), compassWheelMarkup(s), 'full'));

    // Переходы — исходящие маршруты выбранного состояния.
    cells.push(routesCellMarkup(s, '02', 'wide'));

    // 03 Открытость: тонкий бар + mono-процент.
    if (intensityPercent !== null) {
      var visualPercent = Math.max(5, intensityPercent);
      cells.push(stateCell('03', t('states.chapter.openness', 'Открытость'),
        '<div class="state-openness">' +
          '<span class="state-openness-label">' + escapeHtml(s.intensity_label || '') + '</span>' +
          '<span class="state-openness-value">' + visualPercent + '%</span>' +
          '<div class="state-intensity-bar"><div class="state-intensity-fill" style="width: ' + visualPercent + '%"></div></div>' +
        '</div>',
        'half'));
    }

    // 04 Палео-разбор: hairline-карточки глифов + caption muted слева.
    if (s.paleo_breakdown && s.paleo_breakdown.length) {
      var paleoBody = '<div class="paleo-breakdown">' +
        s.paleo_breakdown.map(function(p) {
          return '<div class="paleo-breakdown-item">' +
            '<span class="paleo-char">' + escapeHtml(p.paleo || '') + '</span>' +
            '<span class="paleo-name">' + escapeHtml(p.name || '') + '</span>' +
            '<span class="paleo-func">' + escapeHtml(p.function || '') + '</span>' +
          '</div>';
        }).join('') +
        '</div>' +
        (s.paleo_meaning ? '<p class="paleo-meaning-caption">' + escapeHtml(s.paleo_meaning) + '</p>' : '');
      cells.push(stateCell('04', t('states.chapter.paleo', 'Палео-разбор'), paleoBody, 'wide'));
    }

    // 05 Смысл — дополняет короткое описание в шапке, а не повторяет его.
    // Дыхание идёт вторым абзацем той же главы: это телесный слой того же
    // состояния, отдельная глава ради него была бы раздуванием структуры.
    var isMeaningDuplicate = normalizeText(s.meaning) === normalizeText(s.physics);
    var meaningBody = (s.meaning && !isMeaningDuplicate ? '<p>' + escapeHtml(s.meaning) + '</p>' : '') +
      (s.breath ? '<p class="state-detail-breath">' + escapeHtml(s.breath) + '</p>' : '');
    if (meaningBody) {
      cells.push(stateCell('05', t('states.chapter.meaning', 'Смысл'), meaningBody, 'half'));
    }

    // 06 Примеры
    if (s.examples && s.examples.length) {
      var examplesBody = '<div class="examples-list state-card-grid" role="list">' +
        s.examples.map(function(ex, index) {
          return '<div class="example-tag state-example-card" role="listitem"><span class="state-example-index" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span><span>' + escapeHtml(ex) + '</span></div>';
        }).join('') +
        '</div>';
      cells.push(stateCell('06', t('states.chapter.examples', 'Примеры'), examplesBody, 'full'));
    }

    // 07 Города в этом состоянии
    var citiesHtml = renderCitiesForState(id, '07');
    if (citiesHtml) cells.push(citiesHtml);

    return '<div class="states-page states-detail-page">' +
      detailToolbarMarkup() +
      '<div class="state-passport" id="states-detail-body">' +
        '<div class="state-bento">' + cells.join('') + '</div>' +
      '</div>' +
    '</div>';
  }

  // ===== ПАНЕЛЬ ПАСПОРТА =====
  // Одна полоса, как на карте: поиск ведёт левый край, счётчик идёт за ним,
  // возврат в каталог прижат к правому. Поиск не перерисовывает лист — он
  // лишь гасит несовпавшие узлы компаса, поэтому поле не теряет фокус.
  function detailToolbarMarkup() {
    return '<div class="lab-toolbar states-map-toolbar states-detail-toolbar" role="search" aria-label="' + escapeHtml(t('states.detail.toolbarAria', 'Управление паспортом состояния')) + '">' +
      '<input type="search" class="lab-input lab-toolbar-search" id="states-detail-search" autocomplete="off" placeholder="' + escapeHtml(t('states.map.search', 'Найти состояние…')) + '" aria-label="' + escapeHtml(t('states.map.searchAria', 'Поиск по состояниям')) + '" value="' + escapeHtml(detailQuery) + '">' +
      '<span class="lab-toolbar-count states-map-count" aria-live="polite">' + detailCountMarkup() + '</span>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-btn states-map-back" data-action="open-grid"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>' + escapeHtml(t('states.map.back', 'Все состояния')) + '</button>' +
    '</div>';
  }

  function detailCountMarkup() {
    if (!detailQuery) return '<strong>' + states.length + '</strong> ' + escapeHtml(t('states.detail.total', 'состояний'));
    return '<strong>' + detailMatches().length + '</strong> из ' + states.length;
  }

  // Совпадения поиска на паспорте: то же поле, что у карты, чтобы фильтр
  // вёл себя одинаково на обоих экранах.
  function detailMatches() {
    var query = normalizeText(detailQuery);
    if (!query) return states.slice();
    return states.filter(function(state) {
      var hay = normalizeText([state.name, state.hebrew, state.olam, state.physics, state.paleo].join(' '));
      return hay.indexOf(query) !== -1;
    });
  }

  function bindDetailToolbar(container) {
    var search = container.querySelector('#states-detail-search');
    if (!search) return;

    function applyFilter() {
      detailQuery = search.value;
      var query = normalizeText(detailQuery);
      var ids = {};
      detailMatches().forEach(function(state) { ids[state.id] = true; });
      container.querySelectorAll('.state-compass-node').forEach(function(node) {
        node.classList.toggle('is-miss', !!query && !ids[node.getAttribute('data-state-id')]);
      });
      var count = container.querySelector('.states-map-count');
      if (count) count.innerHTML = detailCountMarkup();
    }

    search.addEventListener('input', applyFilter);
    search.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter') return;
      var matches = detailMatches();
      if (matches.length) {
        event.preventDefault();
        openState(matches[0].id);
      }
    });
  }

  // ===== КАРТА (ЛАНДШАФТ) =====
  // Одна страница с общей панелью: возврат в каталог, поиск и счётчик.
  // Ленты чипов в тулбаре нет — навигацию несёт сам спектр.
  function renderLandscapePage() {
    var firstState = firstLandscapeState();
    if (!firstState) return '<div class="lab-alert lab-alert-info">Карта состояний пока пуста.</div>';
    if (!currentStateId) currentStateId = firstState.id;

    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('states', 'landscape', {
        kicker: 'АЛЕФИ · КАРТА СОСТОЯНИЙ',
        title: 'Визуальная карта',
        subtitle: 'Ландшафт переходов между состояниями',
        icon: 'ui/web.png'
      });
    }

    return '<div class="states-page states-landscape-page">' +
      landscapeToolbarMarkup() +
      '<div class="states-map-bento" id="states-landscape-body">' +
        landscapeBodyMarkup(resolveLandscapeState() || firstState) +
      '</div>' +
    '</div>';
  }

  // Панель карты: возврат в каталог слева, поиск по состояниям, счётчик.
  function landscapeToolbarMarkup() {
    return '<div class="lab-toolbar states-map-toolbar" role="search" aria-label="' + escapeHtml(t('states.map.toolbarAria', 'Управление картой состояний')) + '">' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-btn states-map-back" data-action="open-grid"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>' + escapeHtml(t('states.map.back', 'Все состояния')) + '</button>' +
      '<input type="search" class="lab-input lab-toolbar-search" id="states-landscape-search" autocomplete="off" placeholder="' + escapeHtml(t('states.map.search', 'Найти состояние…')) + '" aria-label="' + escapeHtml(t('states.map.searchAria', 'Поиск по состояниям')) + '" value="' + escapeHtml(landscapeQuery) + '">' +
      '<span class="lab-toolbar-count states-map-count" aria-live="polite">' + landscapeCountMarkup() + '</span>' +
    '</div>';
  }

  function landscapeCountMarkup() {
    if (!landscapeQuery) return '<strong>' + states.length + '</strong> состояний';
    return '<strong>' + landscapeMatches().length + '</strong> из ' + states.length;
  }

  // Тело карты: спектр (он же навигация) + компас и переходы выбранного
  // состояния. Поиск отдаёт в спектр список совпадений: узлы вне запроса
  // гаснут, но карта сохраняет форму — позиции по оси интенсивности.
  function landscapeBodyMarkup(selected) {
    var matchIds = landscapeQuery
      ? landscapeMatches().map(function(state) { return state.id; })
      : null;
    var spectrumHtml = window.AlephyStateSpectrum
      ? window.AlephyStateSpectrum.render(states, {
          low: t('states.spectrum.low', 'точка отсчёта'),
          high: t('states.spectrum.high', 'полнота'),
          gate: t('states.spectrum.gate', 'вход в спектр'),
          cycle: t('states.spectrum.cycle', 'взаимный цикл'),
          back: t('states.spectrum.back', 'возврат по спектру')
        }, selected.id, { matchIds: matchIds })
      : '';

    return stateCell('01', t('states.spectrum.label', 'Спектр движения'), spectrumHtml, 'full') +
      renderStateLandscape(selected, { compass: '02', routes: '03' });
  }

  // Ввод в поиске перерисовывает только тело карты: панель остаётся на
  // месте, поэтому поле не теряет фокус и каретку.
  function bindLandscapeToolbar(container) {
    var search = container.querySelector('#states-landscape-search');
    if (!search) return;
    search.addEventListener('input', function() {
      landscapeQuery = search.value;
      refreshLandscapeBody(container);
    });
  }

  function refreshLandscapeBody(container) {
    var body = container.querySelector('#states-landscape-body');
    if (!body) { renderView(container); return; }
    body.innerHTML = landscapeBodyMarkup(resolveLandscapeState() || firstLandscapeState());
    bindSpectrum(container);
    bindLandscapeRoutes(container);
    refreshIcons();

    var count = container.querySelector('.states-map-count');
    if (count) count.innerHTML = landscapeCountMarkup();
  }

  // Клик по узлу спектра на карте переводит компас на выбранное состояние.
  function selectLandscapeState(id) {
    if (!statesById[id]) return;
    currentStateId = id;
    var container = document.getElementById('states');
    if (container) refreshLandscapeBody(container);
  }

  // ===== КОМПАС-КОЛЕСО =====
  // Единственное место, где собраны все состояния: глифы идут по кругу по
  // возрастанию сжатости (порядок спектра, свёрнутый в круг), текущее — в
  // центре. Позиции узлов считаются здесь и печатаются в left/top в
  // процентах, поэтому круг верен на любой ширине без пересчёта на resize.
  function compassWheelMarkup(current) {
    var ordered = states.slice().sort(function(a, b) {
      return (Number(a.intensity) || 0) - (Number(b.intensity) || 0);
    });
    var total = ordered.length || 1;
    var matchIds = detailQuery
      ? detailMatches().map(function(state) { return state.id; })
      : null;

    var nodes = ordered.map(function(state, index) {
      var angle = (-90 + (360 / total) * index) * Math.PI / 180;
      var x = 50 + Math.cos(angle) * 42;
      var y = 50 + Math.sin(angle) * 42;
      var isCurrent = state.id === current.id;
      var isMiss = matchIds && matchIds.indexOf(state.id) === -1;
      return '<button type="button" class="state-compass-node' +
        (isCurrent ? ' is-current' : '') + (isMiss ? ' is-miss' : '') + '"' +
        ' data-state-id="' + escapeHtml(state.id) + '"' +
        ' style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%"' +
        (isCurrent ? ' aria-current="true"' : '') +
        ' aria-label="' + escapeHtml(state.name) + '" title="' + escapeHtml(state.name) + '">' +
        '<span class="state-compass-node-glyph" aria-hidden="true">' + escapeHtml(state.paleo || '') + '</span>' +
        '<span class="state-compass-node-name">' + escapeHtml(state.name) + '</span>' +
      '</button>';
    }).join('');

    var hubLen = Array.from(String(current.paleo || '')).length;
    return '<div class="state-compass" role="group" aria-label="' + escapeHtml(t('states.nav.aria', 'Все состояния')) + '">' +
      '<span class="state-compass-ring" aria-hidden="true"></span>' +
      nodes +
      '<div class="state-compass-hub">' +
        '<span class="state-compass-hub-paleo" data-len="' + hubLen + '" aria-hidden="true">' + escapeHtml(current.paleo || '') + '</span>' +
        '<strong class="state-compass-hub-name">' + escapeHtml(current.name) + '</strong>' +
        (current.hebrew ? '<span class="state-compass-hub-hebrew" dir="rtl" lang="hbo">' + escapeHtml(current.hebrew) + '</span>' : '') +
        '<span class="state-compass-hub-label">' + escapeHtml(current.intensity_label || '') + '</span>' +
      '</div>' +
    '</div>';
  }

  // ===== ПЕРЕХОДЫ (ЯЧЕЙКА) =====
  // Hairline-строки: стрелка + paleo-глифы + имя + подсказка действия. Один
  // и тот же блок печатают карта (компас + переходы) и паспорт состояния,
  // поэтому разметка вынесена из renderStateLandscape.
  function routesCellMarkup(state, num, modifier) {
    var transitions = (state.transitions || []).filter(function(transition) {
      return statesById[transition.to];
    });
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
    var body = routesHtml
      ? '<div class="state-landscape-routes">' + routesHtml + '</div>'
      : '<div class="state-landscape-routes is-empty">' + escapeHtml(t('states.landscape.empty', 'Исходящих переходов нет.')) + '</div>';
    return stateCell(num, t('states.landscape.transitions', 'Переходы'), body, modifier || 'split');
  }

  // ===== ЛАНДШАФТ КАРТЫ =====
  // Две ячейки бенто карты: компас («я здесь») и исходящие переходы
  // («куда идти»). Номера глав приходят снаружи: перед ними стоит спектр.
  function renderStateLandscape(state, chapter) {
    var nums = chapter || { compass: '02', routes: '03' };
    var transitions = (state.transitions || []).filter(function(transition) {
      return statesById[transition.to];
    });
    var recommended = transitions[0] || null;
    var target = recommended && statesById[recommended.to];

    var compassBody = '<div class="state-landscape-stage">' +
        '<div class="state-landscape-current">' +
          '<span class="state-landscape-current-paleo" data-len="' + Array.from(String(state.paleo || '')).length + '" aria-hidden="true">' + escapeHtml(state.paleo || '') + '</span>' +
          '<strong>' + escapeHtml(state.name) + '</strong>' +
          '<small>' + escapeHtml(state.intensity_label || '') + '</small>' +
        '</div>' +
        (state.physics ? '<p class="state-landscape-physics">' + escapeHtml(state.physics) + '</p>' : '') +
      '</div>';

    if (target) {
      compassBody += '<div class="state-landscape-route-detail">' +
        '<div class="state-landscape-route-chain">' +
          '<span class="state-landscape-chain-chip">' + escapeHtml(state.name) + '</span>' +
          '<span class="state-landscape-chain-arrow" aria-hidden="true">→</span>' +
          '<span class="state-landscape-chain-chip is-target">' + escapeHtml(target.name) + '</span>' +
        '</div>' +
        (recommended.action ? '<p class="state-landscape-route-hint">' + escapeHtml(recommended.action) + '</p>' : '') +
        '<button type="button" class="state-landscape-open" data-to="' + escapeHtml(target.id) + '">' + escapeHtml(t('states.landscape.open', 'Открыть состояние')) + '</button>' +
      '</div>';
    }

    return stateCell(nums.compass, t('states.landscape.compass', 'Компас'), compassBody, 'split') + routesCellMarkup(state, nums.routes, 'split');
  }

  // ===== ГОРОДА ДЛЯ СОСТОЯНИЯ =====
  function renderCitiesForState(stateId, chapterNumber) {
    var matching = cartographyEntries.filter(function(e) {
      return e.state === stateId;
    });

    if (!matching.length) {
      return '';
    }

    return stateCell(chapterNumber || '05', t('states.chapter.cities', 'Города'),
      '<div class="state-cities">' +
      matching.map(function(e) {
        return '<div class="state-city-card" role="button" tabindex="0" aria-label="Открыть запись картографии: ' + escapeHtml(e.name) + '" data-city-id="' + escapeHtml(e.id) + '">' +
          '<div class="city-name">' + escapeHtml(e.name) + '</div>' +
          (e.hebrew ? '<div class="city-hebrew" dir="rtl">' + escapeHtml(e.hebrew) + '</div>' : '') +
          (e.summary ? '<div class="city-summary">' + escapeHtml(e.summary) + '</div>' : '') +
        '</div>';
      }).join('') +
      '</div>',
      'full');
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
    // Паспорт открывается с чистым поиском: фильтр прошлого состояния не
    // должен гасить узлы компаса на новом.
    detailQuery = '';
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
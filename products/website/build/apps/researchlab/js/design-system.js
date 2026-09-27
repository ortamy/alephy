/**
 * design-system.js — модуль «Дизайн-система» (#design-system).
 *
 * Показывает канон из docs/10-DESIGN/DESIGN-SYSTEM.md и, где возможно, —
 * живьём: цвета и метрики берутся из getComputedStyle, компоненты —
 * настоящие классы лаборатории. Модуль не рисует слепок токенов, а читает
 * те, что реально применены в текущей теме.
 */
window.DesignSystem = (function () {
  'use strict';

  function escapeHtml(text) {
    if (text == null) return '';
    if (window.AlephyUtils) return AlephyUtils.escapeHtml(text);
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function tokenValue(token) {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }

  // ===== Данные канона (DESIGN-SYSTEM.md) =====

  var VOICES = [
    { name: 'Артефакт (палео)', owns: 'содержание', means: 'Глифы, золотые акценты, пергаментные фактуры, сериф в display-заголовках.' },
    { name: 'Зал (минимализм)', owns: 'структура', means: 'Сетка 8px, воздух, hairline-рамки 1px, нейтральные поверхности.' },
    { name: 'Свет (футуризм)', owns: 'поведение', means: 'Easing 120–200ms, backdrop-blur в моменты взаимодействия.' }
  ];

  var RULES = [
    'Палео — только в контенте, никогда в хроме (кнопки, инпуты, сайдбар).',
    'Тени = 0 в новом UI: состояние показывают hairline-рамки 1px и фоны.',
    '90/10: 90% экрана — тихий минимализм, ≤10% — палео-акценты.',
    'Стекло — витрина (оверлеи, sticky-шапка). Постоянный UI — матовый.',
    'Различение эмет/шекер распространяется на UI: статусы всегда видимы.',
    'reduced-motion уважается всегда.'
  ];

  var COLOR_ROLES = [
    { token: '--bg-primary', uses: 'фон страницы' },
    { token: '--bg-secondary', uses: 'поверхности карточек' },
    { token: '--bg-tertiary', uses: 'вложенные поверхности' },
    { token: '--bg-dark', uses: 'ink-поверхности' },
    { token: '--text-primary', uses: 'основной текст' },
    { token: '--text-secondary', uses: 'второй план текста' },
    { token: '--text-muted', uses: 'мета и подписи' },
    { token: '--text-on-accent', uses: 'текст на золоте' },
    { token: '--border-light', uses: 'hairline-рамки' },
    { token: '--accent-gold', uses: 'единственный акцент' },
    { token: '--accent-red', uses: 'ошибка, дозированно' },
    { token: '--scrim', uses: 'затемнение оверлеев' }
  ];

  var TYPE_SCALE = [
    { token: '--text-3xl', sample: 'Алеф', cls: 'ds-type-3xl' },
    { token: '--text-2xl', sample: 'Заголовок раздела', cls: 'ds-type-2xl' },
    { token: '--text-xl', sample: 'Подзаголовок панели', cls: 'ds-type-xl' },
    { token: '--text-lg', sample: 'Заголовок карточки', cls: 'ds-type-lg' },
    { token: '--text-md', sample: 'Основной текст инструмента', cls: 'ds-type-md' },
    { token: '--text-base', sample: 'Базовый текст чтения', cls: 'ds-type-base' },
    { token: '--text-sm', sample: 'Компактный текст интерфейса', cls: 'ds-type-sm' },
    { token: '--ui-12', sample: 'Мелкий текст: мета, подписи', cls: 'ds-type-ui' }
  ];

  var SPACING = [
    { token: '--space-1', label: 'space-1' }, { token: '--space-2', label: 'space-2' },
    { token: '--space-3', label: 'space-3' }, { token: '--space-4', label: 'space-4' },
    { token: '--space-5', label: 'space-5' }, { token: '--space-6', label: 'space-6' },
    { token: '--space-7', label: 'space-7' }, { token: '--space-8', label: 'space-8' }
  ];

  var RADII = [
    { token: '--radius-xs', label: 'xs' }, { token: '--radius-sm', label: 'sm' },
    { token: '--radius-8', label: '-8' }, { token: '--radius-md', label: 'md' },
    { token: '--radius-lg', label: 'lg' }, { token: '--radius-xl', label: 'xl' },
    { token: '--radius-pill', label: 'pill' }
  ];

  var Z_SCALE = [
    { token: '--z-content', uses: 'контент' }, { token: '--z-topbar', uses: 'шапка' },
    { token: '--z-search', uses: 'палитра поиска' }, { token: '--z-modal', uses: 'модалки' },
    { token: '--z-toast', uses: 'тосты' }
  ];

  var MOTION = [
    { token: '--dur-1', uses: 'hover: цвет, рамка' },
    { token: '--dur-2', uses: 'входы: модалки, раскрытия' },
    { token: '--dur-3', uses: 'медленное появление' }
  ];

  var STATUSES = [
    { dot: 'fact', label: 'факт / эмет', means: 'подтверждено источником' },
    { dot: 'work', label: 'интерпретация', means: 'рабочая версия' },
    { dot: 'guess', label: 'гипотеза / спорно', means: 'требует проверки' },
    { dot: 'break', label: 'разрушение / ошибка', means: 'дозировано' }
  ];

  var PATTERNS = [
    { name: '5.2a Модульный bento', uses: '#vision — эталон' },
    { name: '5.2b Bento настроек', uses: '#settings — второй эталон' },
    { name: '5.2c Bento дизайн-системы', uses: '#design-system — этот модуль' },
    { name: '5.3 Мобильный закон', uses: 'одна колонка, overflow-x = 0' }
  ];

  // Разделы для липкой навигации: id совпадает с id ячейки из cell().
  var NAV = [
    { id: 'ds-cell-doctrine', label: 'Доктрина' },
    { id: 'ds-cell-color', label: 'Цвет' },
    { id: 'ds-cell-type', label: 'Шрифт' },
    { id: 'ds-cell-space', label: 'Spacing' },
    { id: 'ds-cell-radius', label: 'Радиусы' },
    { id: 'ds-cell-shadow', label: 'Тени и z' },
    { id: 'ds-cell-motion', label: 'Motion' },
    { id: 'ds-cell-components', label: 'Компоненты' },
    { id: 'ds-cell-statuses', label: 'Статусы' },
    { id: 'ds-cell-patterns', label: 'Паттерны' },
    { id: 'ds-cell-a11y', label: 'Доступность' }
  ];

  // Оболочка ячейки по §5.2a: номер + капитель + ссылка на раздел канона.
  // id стоит на секции — это якорь липкой навигации и цель scrollIntoView.
  function cell(num, title, hint, body, modifier) {
    var id = 'ds-cell-' + modifier;
    return (
      '<section class="ds-cell ds-cell--' + modifier + '" id="' + id + '" aria-labelledby="' + id + '-title">' +
        '<div class="ds-cell-head">' +
          '<span class="ds-num">' + escapeHtml(num) + '</span>' +
          '<h2 class="ds-cell-title" id="' + id + '-title">' + escapeHtml(title) + '</h2>' +
          (hint ? '<span class="ds-cell-hint">' + escapeHtml(hint) + '</span>' : '') +
        '</div>' + body +
      '</section>'
    );
  }

  // Липкая навигация по разделам: 11 ячеек — это длинная страница,
  // прокрутка вручную по ней раздражает. Активный раздел подсвечивается
  // по IntersectionObserver, а не по scroll-событию: дешевле и не спамит.
  function navMarkup() {
    return (
      '<nav class="ds-nav" aria-label="Разделы дизайн-системы">' +
        NAV.map(function (item) {
          return (
            '<a class="ds-nav-link" href="#' + item.id + '" data-ds-nav="' + item.id + '">' +
              escapeHtml(item.label) +
            '</a>'
          );
        }).join('') +
      '</nav>'
    );
  }

  function bindNav(container) {
    var links = container.querySelectorAll('[data-ds-nav]');
    var sections = [];
    for (var i = 0; i < links.length; i += 1) {
      (function (link) {
        var target = container.querySelector('#' + link.getAttribute('data-ds-nav'));
        if (!target) return;
        sections.push(target);
        // Хеш здесь — внутренний якорь модуля, а не маршрут лаборатории:
        // перехватываем клик, чтобы роутер не увидел «неизвестный маршрут».
        link.addEventListener('click', function (event) {
          event.preventDefault();
          target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', '#' + link.getAttribute('data-ds-nav'));
        });
      })(links[i]);
    }
    if (!sections.length || typeof IntersectionObserver !== 'function') return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        for (var j = 0; j < links.length; j += 1) {
          links[j].classList.toggle('is-active', links[j].getAttribute('data-ds-nav') === entry.target.id);
        }
      });
    }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Клик по значению токена копирует `var(--token)` — на витрине токенов
  // это главное действие, иначе значение приходится выделять вручную.
  // Слушатель висит на самом контейнере, поэтому он переживает рендер:
  // без флага повторный вход в модуль накапливал бы копии обработчика.
  function bindTokenCopy(container, status) {
    if (container._dsCopyBound) {
      container._dsCopyStatus = status;
      return;
    }
    container._dsCopyBound = true;
    container._dsCopyStatus = status;
    container.addEventListener('click', function (event) {
      var node = event.target.closest ? event.target.closest('[data-ds-token]') : null;
      if (!node) return;
      copyText('var(' + node.getAttribute('data-ds-token') + ')', container._dsCopyStatus);
    });
  }

  function copyText(text, status) {
    function done() { setCopyStatus(status, 'Скопировано: ' + text); }
    function failed() { setCopyStatus(status, 'Не удалось скопировать'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
      return;
    }
    fallback();
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); done(); } catch (error) { failed(); }
      document.body.removeChild(area);
    }
  }

  var copyTimer = null;
  function setCopyStatus(status, message) {
    if (!status) return;
    status.textContent = message;
    status.classList.add('is-visible');
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () {
      status.classList.remove('is-visible');
    }, 1600);
  }

  function render(container) {
    var num = 0;
    function next() {
      num += 1;
      return num < 10 ? '0' + num : String(num);
    }

    container.innerHTML =
      '<div class="ds-shell">' +
      navMarkup() +
      '<p class="ds-copy-status" role="status" aria-live="polite"></p>' +
      '<div class="ds-bento">' +
        cellDoctrine(next()) +
        cellColors(next()) +
        cellType(next()) +
        cellSpacing(next()) +
        cellRadius(next()) +
        cellShadowsAndZ(next()) +
        cellMotion(next()) +
        cellComponents(next()) +
        cellStatuses(next()) +
        cellPatterns(next()) +
        cellA11y(next()) +
      '</div>' +
      '</div>';

    refreshTokenLabels(container);
    watchTheme(container);
    bindNav(container);
    bindTokenCopy(container, container.querySelector('.ds-copy-status'));

    if (window.LabIcons && window.LabIcons.sync) window.LabIcons.sync();
  }

  // Значения токенов — единственная «живая» часть модуля. page-controller
  // пропускает повторный рендер уже загруженной панели, поэтому при смене темы
  // подписи пересчитываются на месте: иначе модуль показывал бы цвета
  // предыдущей темы (и тем более при переходе туда-обратно).
  function refreshTokenLabels(root) {
    var nodes = root.querySelectorAll('[data-ds-token]');
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      node.textContent = tokenValue(node.getAttribute('data-ds-token'));
    }
  }

  function watchTheme(container) {
    if (container._dsThemeObserver) return;
    var observer = new MutationObserver(function () {
      refreshTokenLabels(container);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    container._dsThemeObserver = observer;
  }

  function cellDoctrine(n) {
    var voices = VOICES.map(function (v) {
      return (
        '<div class="ds-voice">' +
          '<p class="ds-voice-name">' + escapeHtml(v.name) + '</p>' +
          '<p class="ds-voice-owns">' + escapeHtml(v.owns) + '</p>' +
          '<p class="ds-voice-means">' + escapeHtml(v.means) + '</p>' +
        '</div>'
      );
    }).join('');

    var rules = '<ul class="ds-meters">' + RULES.map(function (rule) {
      return (
        '<li class="ds-meter">' +
          '<span class="ds-dot ds-dot--fact" aria-hidden="true"></span>' +
          '<span class="ds-swatch-uses">' + escapeHtml(rule) + '</span>' +
        '</li>'
      );
    }).join('') + '</ul>';

    // Обёртка `.ds-voices` обязательна: без неё три голоса становились
    // прямыми потомками flex-ячейки и сетка не применялась вовсе.
    return cell(n, 'Доктрина трёх голосов', '§0', '<div class="ds-voices">' + voices + '</div>' + rules, 'doctrine');
  }

  function cellColors(n) {
    var swatches = COLOR_ROLES.map(function (role) {
      return (
        '<div class="ds-swatch">' +
          '<div class="ds-swatch-chip" style="background: var(' + role.token + ')"></div>' +
          '<div class="ds-swatch-body">' +
            '<p class="ds-swatch-name">' + escapeHtml(role.token) + '</p>' +
            '<p class="ds-swatch-uses"><span data-ds-token="' + role.token + '"></span> · ' + escapeHtml(role.uses) + '</p>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Цветовые роли', '§1.1 · живая тема',
      '<div class="ds-swatches">' + swatches + '</div>' +
        '<p class="ds-note">Образцы читаются из <code class="ds-code">getComputedStyle</code>, ' +
        'поэтому показывают текущую тему, а не зашитый слепок.</p>',
      'color'
    );
  }

  function cellType(n) {
    var rows = TYPE_SCALE.map(function (t) {
      return (
        '<div class="ds-type-row">' +
          '<span class="ds-type-sample ' + t.cls + '">' + escapeHtml(t.sample) + '</span>' +
          '<span class="ds-type-token">' + escapeHtml(t.token) + ' · <span data-ds-token="' + t.token + '"></span></span>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Типографика', '§1.2',
      '<div class="ds-type-scale">' + rows + '</div>' +
        '<p class="ds-note">Заголовки — сериф (EB Garamond), UI — гротеск (DM Sans).</p>',
      'type'
    );
  }

  function cellSpacing(n) {
    var rows = SPACING.map(function (s) {
      return (
        '<div class="ds-meter">' +
          '<span class="ds-meter-label">' + escapeHtml(s.label) + '</span>' +
          '<span class="ds-meter-bar" style="width: var(' + s.token + ')"></span>' +
          '<span class="ds-meter-value" data-ds-token="' + s.token + '"></span>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Spacing', '§1.3',
      '<div class="ds-meters">' + rows + '</div>' +
        '<p class="ds-note">Только эти ступени. Другие значения запрещены.</p>',
      'space'
    );
  }

  function cellRadius(n) {
    var rows = RADII.map(function (r) {
      return (
        '<div class="ds-meter">' +
          '<span class="ds-meter-label">' + escapeHtml(r.label) + '</span>' +
          '<span class="ds-meter-bar" style="width: 40px; height: 24px; border: 1px solid var(--line); border-radius: var(' + r.token + ')"></span>' +
          '<span class="ds-meter-value" data-ds-token="' + r.token + '"></span>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Радиусы', '§1.4',
      '<div class="ds-meters">' + rows + '</div>' +
        '<p class="ds-note">Карточки — <code class="ds-code">-8</code> или <code class="ds-code">md</code>, чипы — <code class="ds-code">pill</code>.</p>',
      'radius'
    );
  }

  function cellShadowsAndZ(n) {
    var z = Z_SCALE.map(function (zItem) {
      return (
        '<div class="ds-meter">' +
          '<span class="ds-meter-label" data-ds-token="' + zItem.token + '"></span>' +
          '<span class="ds-swatch-uses">' + escapeHtml(zItem.token) + ' — ' + escapeHtml(zItem.uses) + '</span>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Тени и z-шкала', '§1.5–1.6',
      '<p class="ds-note">Новый UI: <b>без теней</b>, состояние держит hairline. ' +
        'Стекло живёт только в оверлеях.</p>' +
        '<div class="ds-meters">' + z + '</div>',
      'shadow'
    );
  }

  function cellMotion(n) {
    var rows = MOTION.map(function (m) {
      return (
        '<div class="ds-meter">' +
          '<span class="ds-meter-label" data-ds-token="' + m.token + '"></span>' +
          '<span class="ds-swatch-uses">' + escapeHtml(m.token) + ' — ' + escapeHtml(m.uses) + '</span>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Motion', '§1.8',
      '<div class="ds-meters">' + rows + '</div>' +
        '<p class="ds-caveat"><i data-lucide="info" aria-hidden="true"></i>' +
        '<span><b>reduced-motion</b> отключает stagger, blur-переходы и автоскроллы — ' +
        'полное правило <code class="ds-code">@media (prefers-reduced-motion: reduce)</code>.</span></p>',
      'motion'
    );
  }

  function cellComponents(n) {
    return cell(
      n, 'Компоненты', '§4 · живые',
      '<div class="ds-samples">' +
        '<p class="ds-samples-label">Кнопки §4.4</p>' +
        '<div class="ds-samples-row">' +
          '<button type="button" class="lab-btn lab-btn-primary">Primary</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary">Secondary</button>' +
          '<button type="button" class="lab-btn lab-btn-compact"><i data-lucide="copy" aria-hidden="true"></i> Compact</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" disabled>Disabled</button>' +
        '</div>' +
        '<p class="ds-caveat"><i data-lucide="alert-triangle" aria-hidden="true"></i>' +
        '<span>Измеренный долг: <code class="ds-code">.lab-btn-primary</code> — тёмный текст на ' +
        '<code class="ds-code">--accent-gold</code> даёт <b>2.73:1</b> при требовании §7 ≥4.5:1; ' +
        'у <code class="ds-code">.lab-btn-secondary</code> — <b>2.94:1</b>. ' +
        'Правка затрагивает все модули лаборатории, поэтому вынесена как отдельное решение, ' +
        'а не сделана молча в этом модуле.</span></p>' +
        '<p class="ds-samples-label">Чипы §4.3</p>' +
        '<div class="ds-samples-row">' +
          '<span class="ds-chip">чип</span>' +
          '<span class="ds-chip ds-chip--gold">акцент</span>' +
        '</div>' +
        '<p class="ds-samples-label">Поля §4.5</p>' +
        '<div class="ds-samples-row">' +
          '<input class="lab-input" type="text" placeholder="Hairline-поле" aria-label="Демо-поле">' +
          '<select class="lab-select" aria-label="Демо-селект"><option>Селект</option></select>' +
        '</div>' +
        '<p class="ds-samples-label">Пустое состояние §4.6</p>' +
        '<div class="ds-empty">' +
          '<i data-lucide="search" class="ds-empty-glyph" aria-hidden="true"></i>' +
          '<p class="ds-empty-title">Поле ждёт первый знак</p>' +
          '<p class="ds-empty-hint">Начните диалог</p>' +
        '</div>' +
      '</div>',
      'components'
    );
  }

  function cellStatuses(n) {
    var rows = STATUSES.map(function (s) {
      return (
        '<div class="ds-meter">' +
          '<span class="ds-dot ds-dot--' + s.dot + '" role="img" aria-label="' + escapeHtml(s.label) + '"></span>' +
          '<span class="ds-swatch-uses">' + escapeHtml(s.label) + ' — ' + escapeHtml(s.means) + '</span>' +
        '</div>'
      );
    }).join('');

    return cell(
      n, 'Статусы и уверенность', '§6',
      '<div class="ds-meters">' + rows + '</div>' +
        '<p class="ds-caveat"><i data-lucide="info" aria-hidden="true"></i>' +
        '<span>Легенда <b>едина для всех модулей</b>. Новая метка — правка таблицы §6, ' +
        'а не новый цвет в отдельном модуле.</span></p>',
      'statuses'
    );
  }

  function cellPatterns(n) {
    var rows = PATTERNS.map(function (p) {
      return (
        '<div class="ds-meter">' +
          '<span class="ds-swatch-uses"><b>' + escapeHtml(p.name) + '</b> — ' + escapeHtml(p.uses) + '</span>' +
        '</div>'
      );
    }).join('');

    return cell(n, 'Layout-паттерны', '§5', '<div class="ds-meters">' + rows + '</div>', 'patterns');
  }

  function cellA11y(n) {
    return cell(
      n, 'Доступность', '§7',
      '<ul class="ds-meters">' +
        '<li class="ds-meter"><span class="ds-dot ds-dot--fact" aria-hidden="true"></span><span class="ds-swatch-uses">Контраст текста ≥4.5:1, иконок и рамок ≥3:1</span></li>' +
        '<li class="ds-meter"><span class="ds-dot ds-dot--fact" aria-hidden="true"></span><span class="ds-swatch-uses">focus-visible всегда виден (ring, не glow)</span></li>' +
        '<li class="ds-meter"><span class="ds-dot ds-dot--fact" aria-hidden="true"></span><span class="ds-swatch-uses">Клавиатура: <code class="ds-code">/</code> — поиск, <code class="ds-code">Escape</code> — оверлеи</span></li>' +
        '<li class="ds-meter"><span class="ds-dot ds-dot--fact" aria-hidden="true"></span><span class="ds-swatch-uses">aria-лейблы у icon-кнопок</span></li>' +
      '</ul>' +
        '<p class="ds-note">Канон: <code class="ds-code">docs/10-DESIGN/DESIGN-SYSTEM.md</code></p>',
      'a11y'
    );
  }

  return { render: render, init: render };
})();

/**
 * user-preferences.js — персональные настройки для исследователя и гостя.
 * Хранит предпочтения в localStorage по ключу alephy_user_preferences.
 * Применяет настройки через data-* атрибуты на <html>.
 */

const UserPreferences = (function() {
  'use strict';

  var STORAGE_KEY = 'alephy_user_preferences';
  var HTML = document.documentElement;
  var PREFS_FONT_HINT = 'EB Garamond, sans';

  var PRESETS = {
    theme: {
      white: {
        label: 'Белая',
        vars: {
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#fbfaf6',
          '--bg-tertiary': '#f1ece1',
          '--bg-card': '#ffffff',
          '--bg-dark': '#fbfaf6',
          '--bg-dark-hover': '#f1ece1',
          '--text-primary': '#221a10',
          '--text-secondary': '#5c5142',
          '--text-muted': '#8d8271',
          '--text-on-dark': '#3a2c1c',
          '--accent-gold': '#9a7420',
          '--border-light': '#e6dfd0',
          '--border-dark': '#cbbfa8',
          '--border-color': '#e6dfd0',
          '--header-bg': '#ffffff',
          '--header-text': '#221a10'
        }
      },
      beige: {
        label: 'Бежевая',
        vars: {
          '--bg-primary': '#f6efdf',
          '--bg-secondary': '#f1e6cf',
          '--bg-tertiary': '#e9dcbd',
          '--bg-card': '#faf4e6',
          '--bg-dark': '#efe3c8',
          '--bg-dark-hover': '#e4d6b2',
          '--text-primary': '#3a2b17',
          '--text-secondary': '#6a563a',
          '--text-muted': '#9c8766',
          '--text-on-dark': '#3a2b17',
          '--accent-gold': '#9a6f15',
          '--border-light': '#dccaa4',
          '--border-dark': '#c2ac7d',
          '--border-color': '#dccaa4',
          '--header-bg': '#f1e6cf',
          '--header-text': '#3a2b17'
        }
      },
      brown: {
        label: 'Коричневая',
        vars: {
          '--bg-primary': '#3b2a18',
          '--bg-secondary': '#45321d',
          '--bg-tertiary': '#4f3a23',
          '--bg-card': '#402e1b',
          '--bg-dark': '#271a0d',
          '--bg-dark-hover': '#332413',
          '--text-primary': '#f3e9d6',
          '--text-secondary': '#d8c6a6',
          '--text-muted': '#b09b78',
          '--text-on-dark': '#f6efe0',
          '--accent-gold': '#d4a030',
          '--border-light': '#5c4826',
          '--border-dark': '#705831',
          '--border-color': '#5c4826',
          '--header-bg': '#1f1407',
          '--header-text': '#f3e9d6'
        }
      },
      dark: {
        label: 'Чёрная',
        vars: {
          '--bg-primary': '#100b06',
          '--bg-secondary': '#181006',
          '--bg-tertiary': '#221710',
          '--bg-card': '#140d06',
          '--bg-dark': '#090502',
          '--bg-dark-hover': '#150d06',
          '--text-primary': '#f2ead9',
          '--text-secondary': '#cdbda1',
          '--text-muted': '#9c8d74',
          '--text-on-dark': '#f6efe0',
          '--accent-gold': '#c89b3c',
          '--border-light': '#2e2315',
          '--border-dark': '#453525',
          '--border-color': '#2e2315',
          '--header-bg': '#060301',
          '--header-text': '#f2ead9'
        }
      }
    },
    fontSize: {
      compact: { label: 'Компактный', value: '14px' },
      standard: { label: 'Стандартный', value: '16px' },
      large: { label: 'Крупный', value: '18px' }
    },
    density: {
      compact: { label: 'Компактная' },
      standard: { label: 'Стандартная' },
      comfortable: { label: 'Просторная' }
    },
    contentWidth: {
      narrow: { label: 'Узкая', value: '800px' },
      standard: { label: 'Стандартная', value: '1100px' },
      wide: { label: 'Широкая', value: '1400px' }
    },
    motion: {
      full: { label: 'Полная' },
      reduced: { label: 'Минимальная' }
    },
    fontFamily: {
      'eb-garamond': { label: 'EB Garamond' },
      'cormorant': { label: 'Cormorant Garamond' },
      'system-serif': { label: 'Системный serif' },
      'mono': { label: 'Моноширинный' }
    }
  };

  function defaults(role) {
    return {
      role: role || 'guest',
      theme: 'white',
      fontSize: 'standard',
      density: 'standard',
      contentWidth: 'standard',
      motion: 'full',
      fontFamily: 'eb-garamond',
      startPage: 'dashboard',
      showBreadcrumbs: true
    };
  }

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        var base = defaults(parsed.role);
        Object.keys(base).forEach(function(k) {
          if (parsed[k] === undefined) parsed[k] = base[k];
        });
        return parsed;
      }
    } catch (e) {}
    return defaults('guest');
  }

  function save(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }

  function escapeHtml(text) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  function roleLabel(role) {
    if (role === 'admin') return 'Администратор';
    if (role === 'researcher') return 'Исследователь';
    return 'Гость';
  }

  function apply(prefs) {
    if (!prefs) prefs = load();
    // Защита от устаревших сохранённых тем (parchment удалена): фолбэк — белая.
    var theme = PRESETS.theme[prefs.theme] ? prefs.theme : 'white';
    HTML.setAttribute('data-theme', theme);
    HTML.setAttribute('data-font-size', prefs.fontSize);
    HTML.setAttribute('data-density', prefs.density);
    HTML.setAttribute('data-content-width', prefs.contentWidth);
    HTML.setAttribute('data-motion', prefs.motion);
    HTML.setAttribute('data-font-family', prefs.fontFamily);

    var root = document.documentElement.style;
    root.setProperty('--user-font-size', PRESETS.fontSize[prefs.fontSize].value);
    root.setProperty('--user-content-width', PRESETS.contentWidth[prefs.contentWidth].value);

    var themeVars = PRESETS.theme[theme].vars;
    Object.keys(themeVars).forEach(function(varName) {
      root.setProperty(varName, themeVars[varName]);
    });

    if (prefs.motion === 'reduced') {
      HTML.setAttribute('data-reduced-motion', 'true');
    } else {
      HTML.removeAttribute('data-reduced-motion');
    }

    // Крошки рисует роутер (router.js → renderBreadcrumbs); он читает этот
    // атрибут, поэтому переключатель должен быть не просто сохранённой строкой.
    if (prefs.showBreadcrumbs === false) {
      HTML.setAttribute('data-breadcrumbs', 'off');
    } else {
      HTML.removeAttribute('data-breadcrumbs');
    }
  }

  function render(container, role) {
    var prefs = load();
    prefs.role = role;
    save(prefs);
    container.innerHTML = buildHTML(role);
    bindEvents(container, prefs, role);
    apply(prefs);
  }

  function buildHTML(role) {
    var prefs = load();
    var isResearcher = role === 'researcher';
    // Нумерация ячеек сквозная: пропущенные для гостя разделы не оставляют дыр.
    var num = 0;
    function n() {
      num += 1;
      return num < 10 ? '0' + num : String(num);
    }
    var cells = [
      tabAppearance(prefs, n),
      tabMotion(prefs, n),
      isResearcher ? tabNavigation(prefs, n) : '',
      isResearcher ? tabLearning(prefs, n) : '',
      tabData(prefs, n),
      summaryCell(prefs, n, role)
    ];
    return '<div class="up-bento">' + cells.join('') + '</div>';
  }

  function tabAppearance(prefs, n) {
    return cell(n(), 'Тема', 'Мгновенно', themeSwatches(prefs) + themePreview(prefs), 'theme') +
      cell(n(), 'Типографика', PREFS_FONT_HINT, fieldSelect('fontFamily', 'Шрифт', PRESETS.fontFamily, prefs.fontFamily) +
        '<div class="up-field"><label class="up-label">Размер текста</label>' +
          '<div class="up-segmented" role="group" aria-label="Размер текста">' +
            segmentedOption('fontSize', 'compact', PRESETS.fontSize.compact.label, prefs.fontSize) +
            segmentedOption('fontSize', 'standard', PRESETS.fontSize.standard.label, prefs.fontSize) +
            segmentedOption('fontSize', 'large', PRESETS.fontSize.large.label, prefs.fontSize) +
          '</div></div>', 'type');
  }

  function tabMotion(prefs, n) {
    return cell(n(), 'Плотность и анимации', 'Макет', '<div class="up-field"><label class="up-label">Плотность</label>' +
        '<div class="up-segmented" role="group" aria-label="Плотность">' +
          segmentedOption('density', 'compact', PRESETS.density.compact.label, prefs.density) +
          segmentedOption('density', 'standard', PRESETS.density.standard.label, prefs.density) +
          segmentedOption('density', 'comfortable', PRESETS.density.comfortable.label, prefs.density) +
        '</div></div>' +
      '<div class="up-field"><label class="up-label">Ширина контента</label>' +
        '<div class="up-segmented" role="group" aria-label="Ширина контента">' +
          segmentedOption('contentWidth', 'narrow', PRESETS.contentWidth.narrow.label, prefs.contentWidth) +
          segmentedOption('contentWidth', 'standard', PRESETS.contentWidth.standard.label, prefs.contentWidth) +
          segmentedOption('contentWidth', 'wide', PRESETS.contentWidth.wide.label, prefs.contentWidth) +
        '</div></div>' +
      '<div class="up-field"><label class="up-label">Анимации</label>' +
        '<div class="up-segmented" role="group" aria-label="Анимации">' +
          segmentedOption('motion', 'full', PRESETS.motion.full.label, prefs.motion) +
          segmentedOption('motion', 'reduced', PRESETS.motion.reduced.label, prefs.motion) +
        '</div></div>', 'motion') +
      cell(n(), 'Навигация', 'Старт и крошки', startPageSelect(prefs) +
        '<div class="up-field"><span class="up-label" id="up-crumb-label">Хлебные крошки</span>' +
        '<label class="up-toggle"><input type="checkbox" id="up-show-breadcrumbs" aria-labelledby="up-crumb-label"' + (prefs.showBreadcrumbs ? ' checked' : '') + '>' +
        '<span class="up-toggle-slider" aria-hidden="true"></span><span class="up-toggle-label">' + (prefs.showBreadcrumbs ? 'Показаны' : 'Скрыты') + '</span></label></div>', 'start');
  }

  function tabLearning(prefs, n) {
    return cell(n(), 'Обучение', 'Интервальное повторение', '<div class="up-field"><label class="up-label" for="up-daily-new">Новые карточки в день: <span class="up-range-val" id="up-daily-new-val">10</span></label>' +
        '<input type="range" id="up-daily-new" min="1" max="30" value="10" class="up-range"></div>' +
      '<div class="up-field"><label class="up-label" for="up-daily-review">Повторений в день: <span class="up-range-val" id="up-daily-review-val">30</span></label>' +
        '<input type="range" id="up-daily-review" min="5" max="100" value="30" class="up-range"></div>', 'learn');
  }

  function tabData(prefs, n) {
    return cell(n(), 'Данные', 'Резервная копия', '<div class="up-actions">' +
        '<button type="button" class="lab-btn lab-btn-secondary" id="up-export"><i data-lucide="download" aria-hidden="true"></i> Экспорт настроек</button>' +
        '<button type="button" class="lab-btn lab-btn-secondary" id="up-import"><i data-lucide="upload" aria-hidden="true"></i> Импорт настроек</button>' +
        '<button type="button" class="lab-btn lab-btn-danger" id="up-reset"><i data-lucide="rotate-ccw" aria-hidden="true"></i> Сбросить настройки</button>' +
      '</div>' +
      '<input type="file" id="up-import-file" accept=".json,application/json" class="up-file">' +
      '<p class="up-caveat"><i data-lucide="info" aria-hidden="true"></i><span>Настройки хранятся только в этом браузере (<code>localStorage</code>). Экспортируйте их, если работаете на чужом устройстве.</span></p>' +
      '<div id="up-notice" class="up-notice" role="status" aria-live="polite" style="display:none;"></div>', 'data');
  }

  // Итоговая ячейка: показывает применённые значения словами, а не только формой.
  function summaryCell(prefs, n, role) {
    return cell(n(), 'Сейчас применено', roleLabel(role), '<dl class="up-recipe">' +
      '<div class="up-recipe-row"><dt>Тема</dt><dd data-sum="theme">' + escapeHtml(PRESETS.theme[prefs.theme].label) + '</dd></div>' +
      '<div class="up-recipe-row"><dt>Шрифт</dt><dd data-sum="fontFamily">' + escapeHtml(PRESETS.fontFamily[prefs.fontFamily].label) + '</dd></div>' +
      '<div class="up-recipe-row"><dt>Размер</dt><dd data-sum="fontSize">' + escapeHtml(PRESETS.fontSize[prefs.fontSize].value) + '</dd></div>' +
      '<div class="up-recipe-row"><dt>Плотность</dt><dd data-sum="density">' + escapeHtml(PRESETS.density[prefs.density].label) + '</dd></div>' +
      '<div class="up-recipe-row"><dt>Ширина</dt><dd data-sum="contentWidth">' + escapeHtml(PRESETS.contentWidth[prefs.contentWidth].value) + '</dd></div>' +
      '<div class="up-recipe-row"><dt>Анимации</dt><dd data-sum="motion">' + escapeHtml(PRESETS.motion[prefs.motion].label) + '</dd></div>' +
      '</dl>', 'summary');
  }

  // Оболочка ячейки bento: шапка по DESIGN-SYSTEM §5.2a (номер + капитель + подпись).
  function cell(num, title, hint, body, modifier) {
    var id = 'up-cell-' + modifier;
    return '<section class="up-cell up-cell--' + modifier + '" aria-labelledby="' + id + '">' +
      '<div class="up-cell-head"><span class="up-num">' + escapeHtml(num) + '</span>' +
        '<h2 class="up-cell-title" id="' + id + '">' + escapeHtml(title) + '</h2>' +
        (hint ? '<span class="up-cell-hint">' + escapeHtml(hint) + '</span>' : '') +
      '</div>' + body + '</section>';
  }

  // Темы показываем образцами, а не списком: палитра — главный выбор на этой
  // странице, и её невозможно увидеть в выпадающем списке.
  function themeSwatches(prefs) {
    return '<div class="up-swatches" role="group" aria-label="Тема оформления">' +
      Object.keys(PRESETS.theme).map(function(key) {
        var vars = PRESETS.theme[key].vars;
        var on = prefs.theme === key;
        return '<button type="button" class="up-swatch' + (on ? ' is-active' : '') + '" data-group="theme" data-value="' + key + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
          ' style="--sw-bg:' + vars['--bg-primary'] + ';--sw-fg:' + vars['--text-primary'] + ';--sw-accent:' + vars['--accent-gold'] + ';--sw-line:' + vars['--border-light'] + '">' +
          '<span class="up-swatch-chip" aria-hidden="true"><i class="up-swatch-bar"></i><i class="up-swatch-bar"></i><i class="up-swatch-bar"></i></span>' +
          '<span class="up-swatch-label">' + escapeHtml(PRESETS.theme[key].label) + '</span></button>';
      }).join('') + '</div>';
  }

  // Живой образец выбранной темы: показывает, как строка и поверхность будут
  // выглядеть вместе. Цвета берём из активной темы, а не хардкодим.
  function themePreview(prefs) {
    var vars = PRESETS.theme[PRESETS.theme[prefs.theme] ? prefs.theme : 'white'].vars;
    return '<div class="up-preview" style="--pv-bg:' + vars['--bg-primary'] + ';--pv-surface:' + vars['--bg-card'] +
      ';--pv-fg:' + vars['--text-primary'] + ';--pv-muted:' + vars['--text-muted'] + ';--pv-accent:' + vars['--accent-gold'] +
      ';--pv-line:' + vars['--border-light'] + '">' +
      '<p class="up-preview-title">Алеф</p>' +
      '<p class="up-preview-text">Так читается основной текст на выбранной поверхности.</p>' +
      '<p class="up-preview-muted">Вторичный текст и подписи</p>' +
      '<span class="up-preview-chip">Дavar</span></div>';
  }

  function startPageSelect(prefs) {
    var pages = [
      { key: 'dashboard', label: 'Рабочий стол' },
      { key: 'learn', label: 'Обучение' },
      { key: 'root-dictionary', label: 'Корневой словарь' },
      { key: 'paleo-linguistics', label: 'Палео-лингвистика' },
      { key: 'workbench', label: 'Мастерская' }
    ];
    return '<div class="up-field"><label class="up-label" for="up-start-page">Стартовая страница</label>' +
      '<select id="up-start-page" class="up-select">' +
        pages.map(function(p) {
          return '<option value="' + p.key + '"' + (prefs.startPage === p.key ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>';
        }).join('') +
      '</select></div>';
  }

  function fieldSelect(key, label, options, current) {
    var opts = Object.keys(options).map(function(k) {
      return '<option value="' + k + '"' + (current === k ? ' selected' : '') + '>' + escapeHtml(options[k].label) + '</option>';
    }).join('');
    return '<div class="up-field"><label class="up-label">' + escapeHtml(label) + '</label>' +
      '<select class="up-select" data-key="' + key + '">' + opts + '</select></div>';
  }

  function segmentedOption(group, value, label, current) {
    var on = current === value;
    return '<button type="button" class="up-segment' + (on ? ' is-active' : '') + '" data-group="' + group + '" data-value="' + value + '"' +
      ' aria-pressed="' + (on ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function bindEvents(container, prefs, role) {
    function commit(key, value) {
      prefs[key] = value;
      save(prefs);
      apply(prefs);
      updateSummary(container, prefs);
    }
    container.querySelectorAll('.up-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        commit(sel.getAttribute('data-key'), sel.value);
      });
    });
    // Сегменты и образцы тем — одна группа переключателей: aria-pressed держится здесь.
    container.querySelectorAll('.up-segment, .up-swatch').forEach(function(seg) {
      seg.addEventListener('click', function() {
        var group = seg.getAttribute('data-group');
        var value = seg.getAttribute('data-value');
        seg.parentElement.querySelectorAll('[data-group="' + group + '"]').forEach(function(s) {
          s.classList.remove('is-active');
          s.setAttribute('aria-pressed', 'false');
        });
        seg.classList.add('is-active');
        seg.setAttribute('aria-pressed', 'true');
        commit(group, value);
      });
    });
    var startSelect = container.querySelector('#up-start-page');
    if (startSelect) {
      startSelect.addEventListener('change', function() { commit('startPage', startSelect.value); });
    }
    [['up-daily-new', 'up-daily-new-val'], ['up-daily-review', 'up-daily-review-val']].forEach(function(pair) {
      var range = container.querySelector('#' + pair[0]);
      var out = container.querySelector('#' + pair[1]);
      if (!range) return;
      range.addEventListener('input', function() {
        if (out) out.textContent = range.value;
      });
    });
    var breadToggle = container.querySelector('#up-show-breadcrumbs');
    if (breadToggle) {
      breadToggle.addEventListener('change', function() {
        var lbl = breadToggle.parentElement.querySelector('.up-toggle-label');
        if (lbl) lbl.textContent = breadToggle.checked ? 'Показаны' : 'Скрыты';
        commit('showBreadcrumbs', breadToggle.checked);
        // Крошки уже нарисованы для текущего маршрута — перерисовываем их.
        if (window.LabRouter) LabRouter.refreshBreadcrumbs(LabRouter.current());
      });
    }
    var exportBtn = container.querySelector('#up-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        var blob = new Blob([JSON.stringify(prefs, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'alephy-user-preferences.json';
        a.click();
        showNotice('Настройки экспортированы.', false);
      });
    }
    var importBtn = container.querySelector('#up-import');
    var importFile = container.querySelector('#up-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function() { importFile.click(); });
      importFile.addEventListener('change', function() {
        var file = importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var imp = JSON.parse(e.target.result);
            Object.keys(imp).forEach(function(k) {
              if (k === 'role') return;
              // Импорт — внешний ввод: принимаем только ключи из defaults.
              if (Object.prototype.hasOwnProperty.call(defaults('guest'), k)) prefs[k] = imp[k];
            });
            save(prefs);
            apply(prefs);
            render(container, prefs.role);
            showNotice('Настройки импортированы.', false);
          } catch (err) { showNotice('Ошибка импорта: ' + err.message, true); }
        };
        reader.readAsText(file);
      });
    }
    var resetBtn = container.querySelector('#up-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        if (!confirm('Сбросить все настройки?')) return;
        var r = prefs.role;
        localStorage.removeItem(STORAGE_KEY);
        prefs = defaults(r);
        save(prefs);
        apply(prefs);
        render(container, r);
        showNotice('Настройки сброшены.', false);
      });
    }
  }

  // Итоговая ячейка живёт без перерисовки: значения обновляются на лету.
  function updateSummary(container, prefs) {
    var values = {
      theme: PRESETS.theme[prefs.theme] ? PRESETS.theme[prefs.theme].label : prefs.theme,
      fontFamily: PRESETS.fontFamily[prefs.fontFamily] ? PRESETS.fontFamily[prefs.fontFamily].label : prefs.fontFamily,
      fontSize: PRESETS.fontSize[prefs.fontSize] ? PRESETS.fontSize[prefs.fontSize].value : prefs.fontSize,
      density: PRESETS.density[prefs.density] ? PRESETS.density[prefs.density].label : prefs.density,
      contentWidth: PRESETS.contentWidth[prefs.contentWidth] ? PRESETS.contentWidth[prefs.contentWidth].value : prefs.contentWidth,
      motion: PRESETS.motion[prefs.motion] ? PRESETS.motion[prefs.motion].label : prefs.motion
    };
    container.querySelectorAll('[data-sum]').forEach(function(node) {
      var key = node.getAttribute('data-sum');
      if (values[key]) node.textContent = values[key];
    });
  }

  function showNotice(message, isError) {
    var notice = document.getElementById('up-notice');
    if (!notice) return;
    notice.textContent = message;
    notice.className = 'up-notice ' + (isError ? 'up-notice-error' : 'up-notice-success');
    notice.style.display = 'block';
    setTimeout(function() { notice.style.display = 'none'; }, 3000);
  }

  function init() {
    apply(load());
  }

  return {
    load: load,
    save: save,
    apply: apply,
    render: render,
    init: init,
    roleLabel: roleLabel,
    PRESETS: PRESETS,
    defaults: defaults,
    escapeHtml: escapeHtml
  };
})();

window.UserPreferences = UserPreferences;
/**
 * religionisms.js — Модуль «Религионизмы» (bento §5.2h).
 * Два экрана в одной разметке: каталог сфер и паспорт сферы. Тулбар общий,
 * «Назад к сферам» живёт в его действиях, поэтому отдельной полосы под
 * заголовком больше нет.
 */
const Religionisms = (function() {
  'use strict';

  // Девять компонентов религионизма (docs/05-DICTIONARIES/RELIGIONISMS.md).
  // Иконка lucide нужна легенде в рельсе, подпись — короткая метка.
  const COMPONENTS = [
    ['altar', 'Алтарь', 'place'],
    ['victim', 'Жертва', 'heart-pulse'],
    ['priest', 'Жрец', 'user-round-cog'],
    ['promise', 'Обетование', 'gift'],
    ['ritual', 'Ритуал', 'repeat'],
    ['sanctuary', 'Святыня', 'building-2'],
    ['teaching', 'Учение', 'book-open'],
    ['pattern', 'Образец', 'users-round'],
    ['end', 'Конец пути', 'hourglass']
  ];

  let spheres = [];
  let activeSphereId = '';
  let query = '';
  let loading = false;
  var REL_VIEW_KEY = 'alephy_rel_view';

  function readView() {
    try { return JSON.parse(localStorage.getItem(REL_VIEW_KEY)) === 'list' ? 'list' : 'cards'; }
    catch (e) { return 'cards'; }
  }

  function writeView(view) {
    try { localStorage.setItem(REL_VIEW_KEY, JSON.stringify(view)); } catch (e) {}
  }

  let view = readView();

  function init() {
    // Панель живёт в разметке page-controller и пересоздаётся на каждом
    // заходе в модуль, поэтому слушатель вешаем на сам элемент, а не на модуль.
    bindToolbar();
    // Вход в модуль всегда открывает каталог: открытая сфера — это
    // состояние экрана, а не состояние раздела (§5.2f, та же логика).
    activeSphereId = '';
    if (spheres.length) {
      render();
      return;
    }
    if (loading) return;
    loading = true;
    fetch('data/religionisms/religionisms.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        loading = false;
        spheres = data.spheres || [];
        render();
      })
      .catch(function(err) {
        loading = false;
        console.error(err);
        var screen = document.getElementById('rel-screen');
        if (screen) screen.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки данных о религионизмах.</div>';
      });
  }

  function filter(value) {
    query = (value || '').trim().toLowerCase();
    // Поиск относится к каталогу: на экране сферы искать нечего.
    if (activeSphereId) close();
    render();
  }

  function bindToolbar() {
    var search = document.getElementById('rel-search');
    var reset = document.getElementById('rel-reset');
    var back = document.getElementById('rel-back');
    if (search && search.dataset.relBound !== '1') {
      search.dataset.relBound = '1';
      // Панель пересоздаётся при каждом входе в модуль, поэтому старый
      // запрос из прошлого визита сбрасываем: поле пустое — список полный.
      query = '';
      search.addEventListener('input', function() { filter(this.value); });
    }
    if (reset && reset.dataset.relBound !== '1') {
      reset.dataset.relBound = '1';
      reset.addEventListener('click', function() {
        if (search) search.value = '';
        filter('');
      });
    }
    if (back && back.dataset.relBound !== '1') {
      back.dataset.relBound = '1';
      back.addEventListener('click', close);
    }
    document.querySelectorAll('[data-rel-view]').forEach(function(button) {
      if (button.dataset.relBound === '1') return;
      button.dataset.relBound = '1';
      button.addEventListener('click', function() {
        view = button.getAttribute('data-rel-view');
        writeView(view);
        render();
      });
    });
  }

  /* Панель и счётчик живут в разметке page-controller, а экран — здесь,
     поэтому обновляем их точечно, без перерисовки всего списка. На экране
     сферы поиск и переключатель вида не нужны — панель показывает только
     счётчик и возврат к каталогу. */
  function syncToolbar(shown) {
    var onSphere = Boolean(activeSphereId);
    var search = document.getElementById('rel-search');
    var reset = document.getElementById('rel-reset');
    var back = document.getElementById('rel-back');
    var segment = document.querySelector('.lab-toolbar .lab-toolbar-segment');

    if (search) search.hidden = onSphere;
    if (reset) reset.hidden = onSphere || !query;
    if (segment) segment.hidden = onSphere;
    if (back) back.hidden = !onSphere;

    var count = document.getElementById('rel-count');
    if (count) {
      if (onSphere) {
        var index = spheres.map(function(s) { return s.id; }).indexOf(activeSphereId) + 1;
        count.innerHTML = 'сфера <strong>' + index + '</strong> из ' + spheres.length;
      } else {
        count.innerHTML = '<strong>' + shown + '</strong> из ' + spheres.length;
      }
    }
    document.querySelectorAll('[data-rel-view]').forEach(function(button) {
      var active = button.getAttribute('data-rel-view') === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (error) { /* иконки не критичны */ }
    }
  }

  function getFiltered() {
    if (!query) return spheres;
    /* Поиск идёт по тексту сферы: имени, ключевому корню и значениям
       компонентов. Названия компонентов («Жрец», «Алтарь») в данных не
       встречаются — их в значениях нет, а заполнены все девять у каждой
       сферы, поэтому фильтр по ним не сужал бы выборку вовсе. */
    return spheres.filter(function(s) {
      if (s.name.toLowerCase().indexOf(query) !== -1) return true;
      if (s.keyRoot && (
        (s.keyRoot.translit || '').toLowerCase().indexOf(query) !== -1 ||
        (s.keyRoot.meaning || '').toLowerCase().indexOf(query) !== -1
      )) return true;
      return COMPONENTS.some(function(c) {
        return (s[c[0]] || '').toLowerCase().indexOf(query) !== -1;
      });
    });
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : text;
    return d.innerHTML;
  }

  function cellHead(num, title, hint) {
    return '<div class="rel-cell-head"><span class="rel-num">' + num + '</span>' +
      '<h2 class="rel-cell-title">' + escapeHtml(title) + '</h2>' +
      (hint ? '<span class="rel-cell-hint">' + escapeHtml(hint) + '</span>' : '') +
      '</div>';
  }

  // Lucide-глиф по смыслу сферы. Иконка из данных (сере/scroll/…) — тематический
  // PNG, витрине разделов он не нужен (§4.2, ICON-MAP.md: UI-иконки — Lucide).
  var SPHERE_ICONS = {
    career: 'hammer',
    medicine: 'microscope',
    science: 'test-tube',
    military: 'swords',
    'social-media': 'share-2',
    technology: 'cpu',
    education: 'graduation-cap',
    art: 'scroll-text',
    finance: 'scale',
    sport: 'trophy',
    psychology: 'brain',
    ecology: 'leaf',
    state: 'landmark',
    family: 'users',
    travel: 'compass',
    politics: 'flag',
    fashion: 'shirt',
    housing: 'home',
    food: 'utensils'
  };

  function sphereIcon(sphere) {
    return SPHERE_ICONS[sphere.id] || 'circle-dot';
  }

  function render() {
    var screen = document.getElementById('rel-screen');
    if (!screen) return;
    screen.innerHTML = activeSphereId ? sphereMarkup() : catalogMarkup();
    if (!activeSphereId) bindCatalogCards(screen);
    syncToolbar(activeSphereId ? 1 : getFiltered().length);
    refreshIcons();
  }

  /* ===== Экран каталога ===== */
  // 01 «Сферы» — 7 колонок и липкая; рельс 02–03 несёт инструкцию по
  // чтению и легенду девяти компонентов.
  function catalogMarkup() {
    return '<div class="rel-bento">' +
      '<section class="rel-cell rel-cell--catalog">' +
        cellHead('01', 'Сферы', 'клик открывает разбор') +
        '<div id="rel-grid" class="rel-grid' + (view === 'list' ? ' is-list' : '') + '"></div>' +
      '</section>' +
      '<div class="rel-rail">' +
        '<section class="rel-cell rel-cell--ink">' +
          cellHead('02', 'Как читать') +
          '<p class="rel-note">Карта фиксирует устойчивые формулы и слои, через которые смысл отрывается от конструкции.</p>' +
          '<p class="rel-note">Девять компонентов — каркас проверки: уберите один, и сфера перестаёт держаться как система.</p>' +
          '<p class="rel-note">Это инструмент разбора, а не приговор: за каждой сферой стоят реальные практики и реальные люди.</p>' +
        '</section>' +
        '<section class="rel-cell">' +
          cellHead('03', 'Девять компонентов', COMPONENTS.length + ' на сферу') +
          '<ul class="rel-legend">' + legendMarkup() + '</ul>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  // Легенда девяти компонентов: глиф + имя строкой, без плашек (§4.12).
  function legendMarkup() {
    return COMPONENTS.map(function(c) {
      return '<li class="rel-legend-row">' +
        '<i data-lucide="' + c[2] + '" class="rel-legend-glyph" aria-hidden="true"></i>' +
        '<span class="rel-legend-name">' + escapeHtml(c[1]) + '</span></li>';
    }).join('');
  }

  function bindCatalogCards(screen) {
    var grid = screen.querySelector('#rel-grid');
    if (!grid) return;
    var list = getFiltered();
    // Пустое состояние живёт внутри сетки: отдельный блок после неё
    // приходилось бы отдельно прятать при каждом перерендере.
    if (list.length === 0) {
      grid.innerHTML = '<div class="lab-alert lab-alert-info">Ничего не найдено.</div>';
      return;
    }

    grid.innerHTML = list.map(function(s) {
      var description = getShortDescription(s);
      var roleText = getRoleText(s);

      // Карточка-паспорт: иконка-чип + имя, описание на две строки, роль
      // чипом в подвале. Класс lab-card снят — он давал свои padding и
      // margin-bottom и ломал общий канон витрины.
      return '<div class="rel-card" data-id="' + escapeHtml(s.id) + '" role="button" tabindex="0" aria-label="Сфера: ' + escapeHtml(s.name) + '">' +
        '<div class="rel-card-head">' +
          '<span class="rel-card-icon" aria-hidden="true"><i data-lucide="' + sphereIcon(s) + '"></i></span>' +
          '<h2 class="rel-card-title">' + escapeHtml(s.name) + '</h2>' +
        '</div>' +
        '<div class="rel-card-desc">' + escapeHtml(description) + '</div>' +
        (roleText ? '<div class="rel-card-role">' + escapeHtml(roleText) + '</div>' : '') +
      '</div>';
    }).join('');

    grid.querySelectorAll('.rel-card').forEach(function(card) {
      function openCard() {
        var id = card.getAttribute('data-id');
        if (id) open(id);
      }
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCard();
        }
      });
    });
  }

  function getShortDescription(sphere) {
    var description = sphere.description || (sphere.keyRoot && sphere.keyRoot.note) || sphere.promise || '';
    return truncate(description.replace(/\s+/g, ' ').trim(), 150);
  }

  function getRoleText(sphere) {
    // Роль/подзаголовок — короткая метка для карточки в стиле pl-lang-role
    if (sphere.role) return sphere.role;
    if (sphere.keyRoot) return (sphere.keyRoot.translit || '') + ' — ' + (sphere.keyRoot.meaning || '');
    return '';
  }

  function truncate(text, len) {
    text = text || '';
    return text.length > len ? text.slice(0, len).trim() + '…' : text;
  }

  function open(id) {
    activeSphereId = id;
    render();
    var container = document.getElementById('religionisms');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function close() {
    activeSphereId = '';
    render();
  }

  /* ===== Экран сферы ===== */
  // 01 паспорт (7 колонок), рельс 02 «Ключевой корень» (ink) и 03
  // «Обещание и конец пути», ниже 04 «Девять компонентов» на всю ширину.
  function sphereMarkup() {
    var sphere = currentSphere();
    if (!sphere) return '<div class="lab-alert lab-alert-error">Сфера не найдена.</div>';

    var roleText = getRoleText(sphere);
    var rootHtml = sphere.keyRoot
      ? '<div class="rel-root">' +
          '<div class="rel-root-heb" dir="rtl">' + escapeHtml(sphere.keyRoot.root) + '</div>' +
          '<p class="rel-root-translit">' + escapeHtml(sphere.keyRoot.translit) + '</p>' +
          '<p class="rel-root-meaning">' + escapeHtml(sphere.keyRoot.meaning) + '</p>' +
          '<p class="rel-root-note">' + escapeHtml(sphere.keyRoot.note || '') + '</p>' +
        '</div>'
      : '<p class="rel-note">Ключевой корень для этой сферы не зафиксирован.</p>';

    return '<div class="rel-bento">' +
      '<section class="rel-cell rel-cell--passport">' +
        cellHead('01', 'Сфера', sphere.id) +
        '<div class="rel-passport">' +
          '<img src="assets/icons/32/' + escapeHtml(sphere.icon || 'ui/question.png') + '" class="rel-passport-icon" alt="" aria-hidden="true">' +
          '<div class="rel-passport-main">' +
            '<h2 class="rel-passport-name">' + escapeHtml(sphere.name) + '</h2>' +
            '<p class="rel-passport-desc">' + escapeHtml(sphere.description || '') + '</p>' +
          '</div>' +
        '</div>' +
        (roleText ? '<div class="rel-passport-role">' + escapeHtml(roleText) + '</div>' : '') +
      '</section>' +
      '<div class="rel-rail">' +
        '<section class="rel-cell rel-cell--ink">' +
          cellHead('02', 'Ключевой корень', sphere.keyRoot ? sphere.keyRoot.translit : '—') +
          rootHtml +
        '</section>' +
        '<section class="rel-cell">' +
          cellHead('03', 'Обещание и конец пути') +
          '<dl class="rel-fate">' +
            fateRow('Обещание', sphere.promise) +
            fateRow('Конец пути', sphere.end) +
            fateRow('Образец', sphere.pattern) +
          '</dl>' +
        '</section>' +
      '</div>' +
      '<section class="rel-cell rel-cell--wide">' +
        cellHead('04', 'Девять компонентов', 'каркас разбора') +
        '<div class="rel-comp-grid">' + componentsMarkup(sphere) + '</div>' +
      '</section>' +
    '</div>';
  }

  function fateRow(term, value) {
    return '<div class="rel-fate-row"><dt class="rel-fate-term">' + escapeHtml(term) + '</dt>' +
      '<dd class="rel-fate-desc">' + escapeHtml(value || '—') + '</dd></div>';
  }

  function componentsMarkup(sphere) {
    return COMPONENTS.map(function(c) {
      return '<div class="rel-comp">' +
        '<div class="rel-comp-title">' + escapeHtml(c[1]) + '</div>' +
        '<p class="rel-comp-text">' + escapeHtml(sphere[c[0]] || '—') + '</p>' +
      '</div>';
    }).join('');
  }

  function currentSphere() {
    return spheres.filter(function(item) { return item.id === activeSphereId; })[0];
  }

  return {
    init: init,
    filter: filter,
    open: open,
    close: close
  };
})();

window.Religionisms = Religionisms;

/**
 * timeline.js — Палео-таймлайн (каталог-аккордеон хронологических лент)
 *
 * Маршруты:
 *   #timeline                     — каталог: сетка карточек-паспортов + тулбар;
 *   #timeline/<id>                — каталог с раскрытой полосой ленты (аккордеон);
 *   #timeline/<id>/event/<idx>    — раскрытая полоса + подсветка строки события;
 *   #timeline/<id>/full           — полный вид ленты (поиск, ось, sticky-мини-ось);
 *   #timeline/compare/<idA>/<idB> — сводная хронология двух датированных лент.
 *
 * Схема ленты: { id, title, paleoIcon, description, era, events: [...] }
 * Схема события: { date, title, description, sortKey, kind, confidence, source, links[] }
 *   - sortKey — число для хронологической сортировки (до н.э. — отрицательное);
 *   - kind — event | text | artifact | distortion | concept | glyph | person;
 *   - confidence — fact | interpretation | hypothesis (бейдж у даты);
 *   - links[] — внутренние hash-адреса (#timeline/<id>/event/<idx> или модуль).
 * Обратно совместимо: era/sortKey/kind/confidence/source — опциональны.
 */

const Timeline = (function() {
  'use strict';

  var timelineItems = [];
  var timelineContainer = null;

  // Словарь эр: чипы-фильтры строятся из данных (era), а не из хардкода ID.
  var ERAS = {
    tanakh: 'ТаНаХ',
    bashah: 'БаШаХ',
    text: 'Текст и переводы',
    language: 'Язык и письмо',
    archaeology: 'Надписи и находки',
    substitutions: 'Подмены',
    concept: 'Концепции',
    modern: 'Современность'
  };

  var KIND_LABELS = {
    event: 'Событие',
    text: 'Текст и перевод',
    artifact: 'Находка и рукопись',
    distortion: 'Подмена',
    concept: 'Концепт',
    glyph: 'Буквенный слой',
    person: 'Персона'
  };

  var CONFIDENCE_LABELS = {
    fact: 'Факт',
    interpretation: 'Интерпретация',
    hypothesis: 'Гипотеза'
  };

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function normalizeTimeline(tl) {
    if (tl && !ERAS[tl.era]) tl.era = 'concept';
  }

  // Хронологический порядок: сортируем только если у ВСЕХ событий есть sortKey,
  // иначе сохраняем авторский порядок (например, буквенные последовательности).
  function sortedEvents(tl) {
    var events = (tl.events || []).slice();
    var allDated = events.length > 0 && events.every(function(e) {
      return typeof e.sortKey === 'number';
    });
    if (allDated) events.sort(function(a, b) { return a.sortKey - b.sortKey; });
    return events;
  }

  function init(container, parsed) {
    if (!container) return;

    timelineContainer = container;

    // Данные кэшируются в памяти: переход по deep-link (раскрытие карточки,
    // событие, полный вид) не должен заново тянуть timeline.json.
    if (timelineItems.length) {
      applyRoute(parsed);
      return;
    }

    // Шапку модуля рисует LabHero (единственная шапка, как во всех модулях лаба).
    // Собственный hero удалён: он дублировал H1 «Каталог таймлайнов».
    container.innerHTML =
      '<div class="tl-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка таймлайнов…</div></div>';

    // Загружаем данные
    fetch('data/timeline.json')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(timelines) {
        timelineItems = Array.isArray(timelines) ? timelines : [];
        timelineItems.forEach(normalizeTimeline);
        // Deep-link: #timeline/<id> и #timeline/<id>/event/<idx> открываются сразу.
        applyRoute(parsed);
      })
      .catch(function(err) {
        var spinner = container.querySelector('.tl-spinner');
        if (spinner) spinner.remove();
        container.innerHTML += '<div class="lab-alert lab-alert-error">Ошибка загрузки таймлайнов: ' + escapeHtml(err.message) + '</div>';
      });
  }

  // ===== СОСТОЯНИЕ КАТАЛОГА =====
  // Раскрытая полоса живёт в маршруте (#timeline/<id>): прямой заход, крошки и
  // кнопка «назад» восстанавливают то же состояние аккордеона.
  var catalogState = { query: '', era: 'all', sort: 'title', openId: null, focusIdx: null };

  var STRIP_LIMIT = 6; // строк событий в раскрытой полосе до «+N ещё»

  var SORT_LABELS = {
    title: 'По названию',
    events: 'По числу событий',
    date: 'По дате начала'
  };

  function timelineById(id) {
    return timelineItems.filter(function(tl) { return tl.id === id; })[0] || null;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function isDatedList(events) {
    return events.length > 0 && events.every(function(e) { return typeof e.sortKey === 'number'; });
  }

  // Диапазон дат для футера карточки: у недатированных лент дат нет.
  function rangeLabel(tl) {
    var events = sortedEvents(tl);
    if (!events.length) return 'Нет событий';
    if (!isDatedList(events)) return 'Авторский порядок';
    var first = events[0].date;
    var last = events[events.length - 1].date;
    return first === last ? first : first + ' — ' + last;
  }

  function startKey(tl) {
    var events = sortedEvents(tl);
    return isDatedList(events) ? events[0].sortKey : null;
  }

  // Поиск каталога: название, описание, эра и заголовки событий ленты.
  function matchesQuery(tl, query) {
    if (!query) return true;
    var haystack = [tl.title, tl.description || '', ERAS[tl.era] || '']
      .concat((tl.events || []).map(function(e) { return e.title || ''; }))
      .join(' ').toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function visibleTimelines() {
    var list = timelineItems.filter(function(tl) {
      return (catalogState.era === 'all' || tl.era === catalogState.era) && matchesQuery(tl, catalogState.query);
    });
    var sort = catalogState.sort;
    list.sort(function(a, b) {
      if (sort === 'events') return (b.events || []).length - (a.events || []).length;
      if (sort === 'date') {
        var keyA = startKey(a), keyB = startKey(b);
        if (keyA === null && keyB === null) return 0;
        if (keyA === null) return 1;
        if (keyB === null) return -1;
        return keyA - keyB;
      }
      return String(a.title).localeCompare(String(b.title), 'ru');
    });
    return list;
  }

  function renderCatalog(container, timelines, opts) {
    opts = opts || {};
    // Возврат к базовой шапке модуля: override полного вида сбрасываем, иначе
    // applyModuleHero подставит заголовок закрытого экрана.
    container._labHeroOverride = null;
    catalogState.openId = opts.openId || null;
    catalogState.focusIdx = typeof opts.focusIdx === 'number' ? opts.focusIdx : null;
    if (!timelines || !timelines.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Таймлайны пока не добавлены.</div>';
      if (window.LabHero && window.LabHero.setView) {
        window.LabHero.setView('timeline', null, (window.LabHero.views && window.LabHero.views.timeline) || {});
      }
      return;
    }

    // Шапку рисует LabHero — ПОСЛЕ innerHTML: присвоение container.innerHTML
    // стирает секцию .lab-hero, и вызов setView до него терялся.
    container.innerHTML = toolbarHtml(timelines) + '<div class="tl-grid" aria-label="Каталог таймлайнов"></div>';
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('timeline', null, (window.LabHero.views && window.LabHero.views.timeline) || {});
    }
    bindToolbar(container);
    renderGrid(container);
  }

  // Тулбар каталога: поиск, сортировка, счётчик + чипы-эры из данных (era).
  function toolbarHtml(timelines) {
    var eraCounts = {};
    timelines.forEach(function(tl) {
      var era = ERAS[tl.era] ? tl.era : 'concept';
      eraCounts[era] = (eraCounts[era] || 0) + 1;
    });
    var chips = '<button class="tl-filter-chip' + (catalogState.era === 'all' ? ' active' : '') + '" data-filter="all" role="tab" aria-selected="' + (catalogState.era === 'all') + '">Все<span class="chip-count">' + timelines.length + '</span></button>' +
      Object.keys(ERAS).filter(function(era) { return eraCounts[era]; }).map(function(era) {
        var active = catalogState.era === era;
        return '<button class="tl-filter-chip' + (active ? ' active' : '') + '" data-filter="' + era + '" role="tab" aria-selected="' + active + '">' + ERAS[era] +
          '<span class="chip-count">' + eraCounts[era] + '</span></button>';
      }).join('');
    var sortOptions = Object.keys(SORT_LABELS).map(function(key) {
      return '<option value="' + key + '"' + (catalogState.sort === key ? ' selected' : '') + '>' + SORT_LABELS[key] + '</option>';
    }).join('');
    return '<div class="tl-toolbar">' +
      '<div class="tl-toolbar-row">' +
        '<input class="lab-input tl-search" id="tl-catalog-search" type="search" placeholder="Поиск по лентам и событиям…" aria-label="Поиск по таймлайнам" value="' + escapeHtml(catalogState.query) + '">' +
        '<select class="lab-input tl-select" id="tl-catalog-sort" aria-label="Сортировка лент">' + sortOptions + '</select>' +
        '<span class="tl-count" aria-live="polite"></span>' +
      '</div>' +
      '<div class="tl-filters" role="tablist" aria-label="Фильтры по эрам">' + chips + '</div>' +
    '</div>';
  }

  // Сетка каталога: перерисовывается тулбаром (поиск/эры/сортировка) и хранит
  // раскрытую полосу, если её карточка осталась видимой.
  function renderGrid(container) {
    var grid = container.querySelector('.tl-grid');
    if (!grid) return;
    var list = visibleTimelines();
    grid.innerHTML = list.map(cardHtml).join('');
    var counter = container.querySelector('.tl-count');
    if (counter) counter.textContent = list.length + ' из ' + timelineItems.length;

    grid.querySelectorAll('.tl-card').forEach(function(card) {
      card.addEventListener('click', function() { toggleCard(grid, card); });
    });

    var openCard = catalogState.openId
      ? grid.querySelector('.tl-card[data-timeline-id="' + catalogState.openId + '"]')
      : null;
    if (openCard) openStrip(grid, openCard, { focusIdx: catalogState.focusIdx, animate: false });
  }

  // Карточка-паспорт: глиф-чип, заголовок, бейдж событий, описание ≤2 строк,
  // футер с диапазоном дат, эрой и стрелкой.
  function cardHtml(tl) {
    var count = (tl.events || []).length;
    return '<button class="tl-card" type="button" data-timeline-id="' + escapeHtml(tl.id) + '"' +
      ' aria-expanded="false" aria-controls="tl-strip-' + escapeHtml(tl.id) + '"' +
      ' aria-label="' + escapeHtml(tl.title) + ' — ' + count + ' ' + pluralize(count, 'событие', 'события', 'событий') + '">' +
      '<span class="tl-card-head">' +
        '<span class="tl-card-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(tl.paleoIcon) + '</span>' +
        '<span class="tl-card-title">' + escapeHtml(tl.title) + '</span>' +
        '<span class="tl-card-badge">' + count + '</span>' +
      '</span>' +
      '<span class="tl-card-desc">' + escapeHtml(tl.description || '') + '</span>' +
      '<span class="tl-card-foot">' +
        '<span class="tl-card-range">' + escapeHtml(rangeLabel(tl)) + '</span>' +
        '<span class="tl-card-era">' + escapeHtml(ERAS[tl.era] || 'Хронология') + '</span>' +
        '<span class="tl-card-arrow" aria-hidden="true">→</span>' +
      '</span>' +
    '</button>';
  }

  // Аккордеон: раскрыта одна полоса; клик по открытой карточке сворачивает её.
  function toggleCard(grid, card) {
    var id = card.getAttribute('data-timeline-id');
    if (catalogState.openId === id) {
      collapseFromStrip(grid);
      return;
    }
    closeStrip(grid);
    catalogState.openId = id;
    catalogState.focusIdx = null;
    openStrip(grid, card, { animate: true });
    syncHash('#timeline/' + id);
  }

  // URL синхронизируется через pushState: hashchange не срабатывает, поэтому
  // роутер не перерисовывает модуль (нет прыжка наверх и потери фокуса поиска).
  function syncHash(hash) {
    if (location.hash === hash) return;
    if (history.pushState) history.pushState(null, '', hash);
    else location.hash = hash;
  }

  function collapseFromStrip(grid) {
    if (!grid) return;
    closeStrip(grid);
    catalogState.openId = null;
    catalogState.focusIdx = null;
    syncHash('#timeline');
  }

  function bindToolbar(container) {
    var search = container.querySelector('.tl-search');
    if (search) search.addEventListener('input', function() {
      catalogState.query = search.value.trim().toLowerCase();
      renderGrid(container);
    });
    var sort = container.querySelector('.tl-select');
    if (sort) sort.addEventListener('change', function() {
      catalogState.sort = sort.value;
      renderGrid(container);
    });
    container.querySelectorAll('.tl-filter-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        container.querySelectorAll('.tl-filter-chip').forEach(function(c) {
          c.classList.remove('active');
          c.setAttribute('aria-selected', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-selected', 'true');
        catalogState.era = chip.getAttribute('data-filter');
        renderGrid(container);
      });
    });
  }

      // ===== РАСКРЫТАЯ ПОЛОСА (АККОРДЕОН) =====
  // Полоса занимает всю ширину сетки (grid-column: 1 / -1) и встаёт отдельным
  // рядом между строками карточек.
  function openStrip(grid, card, opts) {
    opts = opts || {};
    var tl = timelineById(card.getAttribute('data-timeline-id'));
    if (!tl) return;
    var strip = buildStrip(tl, opts.focusIdx);
    card.classList.add('is-open');
    card.setAttribute('aria-expanded', 'true');
    card.insertAdjacentElement('afterend', strip);
    if (prefersReducedMotion() || opts.animate === false) {
      strip.classList.add('is-in');
    } else {
      requestAnimationFrame(function() { strip.classList.add('is-in'); });
    }
    bindStrip(strip, tl);
    if (typeof opts.focusIdx === 'number') focusStripEvent(strip, opts.focusIdx, false);
  }

  function closeStrip(grid) {
    if (!grid) return;
    var strip = grid.querySelector('.tl-strip:not(.is-closing)');
    if (!strip) return;
    var card = grid.querySelector('.tl-card[data-timeline-id="' + strip.getAttribute('data-timeline-id') + '"]');
    if (card) {
      card.classList.remove('is-open');
      card.setAttribute('aria-expanded', 'false');
    }
    strip.classList.add('is-closing');
    strip.classList.remove('is-in');
    if (prefersReducedMotion()) strip.remove();
    else setTimeout(function() { strip.remove(); }, 150);
  }

  function buildStrip(tl, focusIdx) {
    var events = sortedEvents(tl);
    // Deep-link на строку за лимитом раскрывает список целиком, иначе строки нет в DOM.
    var limit = (typeof focusIdx === 'number' && focusIdx >= STRIP_LIMIT) ? events.length : STRIP_LIMIT;
    var rows = events.slice(0, limit).map(stripEventRow).join('');
    var hidden = events.length - limit;
    var strip = document.createElement('section');
    strip.className = 'tl-strip';
    strip.id = 'tl-strip-' + tl.id;
    strip.setAttribute('data-timeline-id', tl.id);
    strip.setAttribute('aria-label', 'Раскрытая лента: ' + tl.title);
    strip.innerHTML =
      '<header class="tl-strip-head">' +
        '<span class="tl-strip-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(tl.paleoIcon) + '</span>' +
        '<h3 class="tl-strip-title">' + escapeHtml(tl.title) + '</h3>' +
        '<span class="tl-strip-count">' + events.length + ' ' + pluralize(events.length, 'событие', 'события', 'событий') + '</span>' +
        '<button class="tl-strip-close" type="button" aria-label="Свернуть карточку">×</button>' +
      '</header>' +
      '<div class="tl-axis-scroll">' +
        '<div class="tl-axis" role="group" aria-label="Микро-ось ленты">' +
          '<span class="tl-axis-track" aria-hidden="true"></span>' + axisDotsHtml(events) +
        '</div>' +
      '</div>' +
      '<div class="tl-strip-events">' + rows + '</div>' +
      (hidden > 0 ? '<button class="tl-strip-more" type="button">+' + hidden + ' ещё</button>' : '') +
      '<footer class="tl-strip-foot">' +
        '<button class="tl-strip-open" type="button">Открыть полностью →</button>' +
        '<button class="tl-strip-link" type="button">⧉ ссылка</button>' +
      '</footer>';
    return strip;
  }

  // Микро-ось: точки по sortKey (недатированные ленты — равномерно по индексу),
  // цвет точки = kind, тултип = «дата — название».
  function axisDotsHtml(events) {
    var dated = isDatedList(events);
    var min = dated ? events[0].sortKey : 0;
    var span = dated ? events[events.length - 1].sortKey - min : 0;
    return events.map(function(ev, idx) {
      var kind = KIND_LABELS[ev.kind] ? ev.kind : 'event';
      var pos = events.length > 1 ? Math.round(idx / (events.length - 1) * 1000) / 10 : 0;
      if (dated && span > 0) pos = Math.round((ev.sortKey - min) / span * 1000) / 10;
      var label = (ev.date || '') + ' — ' + (ev.title || '');
      return '<button class="tl-axis-dot tl-status-dot--' + kind + '" type="button" data-event-idx="' + idx + '"' +
        ' style="--tl-pos: ' + pos + '%" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '"></button>';
    }).join('');
  }

  // Строка события в полосе: дата (фикс, muted) + статус-точка + заголовок (ellipsis).
  function stripEventRow(event, index) {
    var kind = KIND_LABELS[event && event.kind] ? event.kind : 'event';
    var conf = CONFIDENCE_LABELS[event && event.confidence] ? CONFIDENCE_LABELS[event.confidence] : null;
    var dotLabel = KIND_LABELS[kind] + (conf ? ' · ' + conf : '');
    return '<button class="tl-strip-event" type="button" data-event-idx="' + index + '"' +
      ' aria-label="' + escapeHtml((event.date || '') + ' — ' + (event.title || '')) + '">' +
      '<span class="tl-strip-event-date">' + escapeHtml(event.date || '') + '</span>' +
      '<span class="tl-status-dot tl-status-dot--' + kind + '" title="' + escapeHtml(dotLabel) + '" aria-hidden="true"></span>' +
      '<span class="tl-strip-event-title">' + escapeHtml(event.title || '') + '</span>' +
    '</button>';
  }
  // Клики внутри полосы делегированы: строки могут достраиваться («+N ещё»).
  function bindStrip(strip, tl) {
    strip.addEventListener('click', function(event) {
      if (event.target.closest('.tl-strip-close')) { collapseFromStrip(strip.parentNode); return; }
      if (event.target.closest('.tl-strip-open')) { location.hash = '#timeline/' + tl.id + '/full'; return; }
      if (event.target.closest('.tl-strip-link')) { copyDeepLink('#timeline/' + tl.id); return; }
      if (event.target.closest('.tl-strip-more')) { expandStripEvents(strip, tl); return; }
      var target = event.target.closest('.tl-axis-dot') || event.target.closest('.tl-strip-event');
      if (target) openStripEvent(tl, strip, parseInt(target.getAttribute('data-event-idx'), 10));
    });
  }

  function expandStripEvents(strip, tl) {
    var list = strip.querySelector('.tl-strip-events');
    if (list) list.innerHTML = sortedEvents(tl).map(stripEventRow).join('');
    var more = strip.querySelector('.tl-strip-more');
    if (more) more.remove();
  }

  // Подсветка строки события + прокрутка к ней (reduced-motion — мгновенно).
  function focusStripEvent(strip, idx, animate) {
    var row = strip.querySelector('.tl-strip-event[data-event-idx="' + idx + '"]');
    if (!row) return;
    strip.querySelectorAll('.tl-strip-event.is-focus').forEach(function(el) { el.classList.remove('is-focus'); });
    row.classList.add('is-focus');
    row.scrollIntoView({ block: 'center', behavior: (!animate || prefersReducedMotion()) ? 'auto' : 'smooth' });
  }

  // Deep-link события: #timeline/<id>/event/<i> — строка подсвечена и в кадре.
  function openStripEvent(tl, strip, idx) {
    if (isNaN(idx) || idx < 0 || idx >= sortedEvents(tl).length) return;
    catalogState.openId = tl.id;
    catalogState.focusIdx = idx;
    syncHash('#timeline/' + tl.id + '/event/' + idx);
    if (!strip.querySelector('.tl-strip-event[data-event-idx="' + idx + '"]')) expandStripEvents(strip, tl);
    focusStripEvent(strip, idx, true);
  }

  // «⧉ ссылка» — deep-link ленты в буфер обмена (как в полном виде).
  function copyDeepLink(hash) {
    var url = location.origin + location.pathname + hash;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() {
        showToast('Ссылка скопирована');
      }).catch(function() { fallbackCopy(url); });
      return;
    }
    fallbackCopy(url);
  }

  // Полный вид ленты (#timeline/<id>/full): поиск по событиям, мини-ось
  // (sticky) и полные карточки событий с источником и кросс-ссылками.
  function renderDetail(timelineId) {
    var timeline = timelineItems.filter(function(item) {
      return item.id === timelineId;
    })[0];
    if (!timeline || !timelineContainer) return;

    var events = sortedEvents(timeline);
    var total = events.length;
    var eventsHtml = events.map(function(event, index) {
      return renderEventRow(event, index, timeline.id);
    }).join('');

    // Шапку детального экрана рисует LabHero. Внутри — back-ссылка,
    // мета-строка, тулбар поиска, мини-ось и события.
    timelineContainer.innerHTML =
      '<section class="tl-detail" aria-label="Таймлайн: ' + escapeHtml(timeline.title) + '">' +
        '<button class="tl-detail-back" type="button">К каталогу таймлайнов</button>' +
        '<div class="tl-detail-meta tl-meta-line">' +
          '<span class="tl-detail-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(timeline.paleoIcon) + '</span>' +
          '<span class="meta-sep">·</span>' +
          '<span>' + total + ' ' + pluralize(total, 'событие', 'события', 'событий') + '</span>' +
        '</div>' +
        (isDatedTimeline(timeline) ? compareLaunchHtml(timeline.id) : '') +
        '<div class="tl-detail-toolbar">' +
          '<input class="lab-input tl-detail-search" type="search" placeholder="Поиск по событиям…" aria-label="Поиск по событиям">' +
          '<span class="tl-detail-count" aria-live="polite">' + total + ' из ' + total + '</span>' +
        '</div>' +
        '<div class="tl-axis-scroll tl-detail-axis">' +
          '<div class="tl-axis" role="group" aria-label="Мини-ось событий">' +
            '<span class="tl-axis-track" aria-hidden="true"></span>' + axisDotsHtml(events) +
          '</div>' +
        '</div>' +
        '<div class="tl-detail-events" role="list" aria-label="События таймлайна">' + eventsHtml + '</div>' +
      '</section>';

    // Шапка модуля подменяется на динамический заголовок таймлайна — ПОСЛЕ
    // innerHTML (иначе присвоение стирает секцию .lab-hero, и setView терялся).
    // Override дублируем в container._labHeroOverride: applyModuleHero вызывает
    // setView ПОСЛЕ Timeline.applyRoute и без него вернёт базовую шапку каталога
    // (тот же контракт, что в load-researches.js и workbench.js).
    timelineContainer._labHeroOverride = {
      kicker: 'АЛЕФИ · ПАЛЕО-ТАЙМЛАЙН',
      title: timeline.title,
      subtitle: timeline.description || '',
      icon: 'paleo/track.png'
    };
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('timeline', 'detail', timelineContainer._labHeroOverride);
      if (window.LabRouter && LabRouter.parseHash) {
        LabRouter.renderBreadcrumbs('timeline', LabRouter.parseHash());
      }
    }

    // Полный вид: поиск фильтрует строки на месте (фокус не теряется),
    // мини-ось (sticky) ведёт к строке события.
    var detailRows = timelineContainer.querySelectorAll('.tl-detail-event');
    var detailDots = timelineContainer.querySelectorAll('.tl-detail-axis .tl-axis-dot');
    var detailCount = timelineContainer.querySelector('.tl-detail-count');
    var detailSearch = timelineContainer.querySelector('.tl-detail-search');
    if (detailSearch) detailSearch.addEventListener('input', function() {
      var query = detailSearch.value.trim().toLowerCase();
      var shown = 0;
      detailRows.forEach(function(row) {
        var match = !query || row.textContent.toLowerCase().indexOf(query) !== -1;
        row.hidden = !match;
        if (match) shown++;
      });
      if (detailCount) detailCount.textContent = shown + ' из ' + detailRows.length;
      detailDots.forEach(function(dot) {
        var row = timelineContainer.querySelector('.tl-detail-event[data-event-idx="' + dot.getAttribute('data-event-idx') + '"]');
        dot.hidden = !!(row && row.hidden);
      });
    });
    detailDots.forEach(function(dot) {
      dot.addEventListener('click', function() {
        var row = timelineContainer.querySelector('.tl-detail-event[data-event-idx="' + dot.getAttribute('data-event-idx') + '"]');
        if (!row) return;
        detailRows.forEach(function(el) { el.classList.remove('is-focus', 'tl-event-highlight'); });
        row.classList.add('is-focus', 'tl-event-highlight');
        row.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    });

    var backButton = timelineContainer.querySelector('.tl-detail-back');
    if (backButton) backButton.addEventListener('click', function() {
      // Возврат в каталог с раскрытой карточкой этой ленты.
      location.hash = '#timeline/' + timeline.id;
    });

    // Пикер сравнения: выбор второй ленты → #timeline/compare/<A>/<B>.
    var compareSelect = timelineContainer.querySelector('.tl-compare-select');
    if (compareSelect) compareSelect.addEventListener('change', function() {
      var baseId = compareSelect.getAttribute('data-compare-of');
      if (compareSelect.value && baseId) {
        location.hash = '#timeline/compare/' + baseId + '/' + compareSelect.value;
      }
    });

    // Inline actions на событиях: открыть / копировать ссылку
    var actionButtons = timelineContainer.querySelectorAll('.tl-event-action-btn');
    actionButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var action = btn.getAttribute('data-action');
        var eventIdx = parseInt(btn.getAttribute('data-event-idx'), 10);
        // Индексы data-event-idx соответствуют отсортированному списку событий.
        var event = sortedEvents(timeline)[eventIdx];
        if (!event) return;

        if (action === 'open') {
          // Визуальный отклик — можно расширить до модалки с деталями
          var eventEl = btn.closest('.tl-detail-event');
          if (eventEl) {
            eventEl.style.background = 'var(--bg-tertiary)';
            setTimeout(function() { eventEl.style.background = ''; }, 200);
          }
        } else if (action === 'copy') {
          // Ссылка ведёт в каталог на подсвеченную строку этого события.
          copyDeepLink('#timeline/' + timeline.id + '/event/' + eventIdx);
        }
      });
    });
  }

  // ===== СРАВНЕНИЕ ЛЕНТ (#timeline/compare/<idA>/<idB>) =====
  // Доступны только датированные ленты: сравнение строится по sortKey.
  function isDatedTimeline(tl) {
    return isDatedList(tl.events || []);
  }

  function getDatedTimelines(excludeId) {
    return timelineItems.filter(function(tl) {
      return tl.id !== excludeId && isDatedTimeline(tl);
    });
  }

  // Пикер второй ленты на детальном экране (скрыт, если сравнивать не с чем).
  function compareLaunchHtml(excludeId) {
    var others = getDatedTimelines(excludeId);
    if (!others.length) return '';
    return '<div class="tl-compare-launch">' +
      '<span class="tl-compare-label">Сравнить с:</span>' +
      '<select class="tl-compare-select" data-compare-of="' + escapeHtml(excludeId) + '" aria-label="Лента для сравнения">' +
        '<option value="">— выберите ленту —</option>' +
        others.map(function(tl) {
          return '<option value="' + escapeHtml(tl.id) + '">' + escapeHtml(tl.title) + ' (' + tl.events.length + ')</option>';
        }).join('') +
      '</select>' +
    '</div>';
  }

  function renderCompare(idA, idB) {
    var timelineA = timelineItems.filter(function(t) { return t.id === idA; })[0];
    if (!timelineA || !isDatedTimeline(timelineA) || !timelineContainer) {
      renderCatalog(timelineContainer, timelineItems);
      return;
    }
    var timelineB = idB ? timelineItems.filter(function(t) { return t.id === idB; })[0] : null;
    // Сравнение строится по sortKey: недатированная или неизвестная лента B игнорируется.
    if (timelineB && !isDatedTimeline(timelineB)) timelineB = null;
    var datedOthers = getDatedTimelines(idA);

    var headHtml =
      '<section class="tl-compare" aria-label="Сравнение лент">' +
        '<button class="tl-detail-back" type="button">К ленте «' + escapeHtml(timelineA.title) + '»</button>' +
        '<div class="tl-detail-meta tl-meta-line">' +
          '<span class="tl-detail-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(timelineA.paleoIcon) + '</span>' +
          '<span class="meta-sep">·</span>' +
          '<span>' + escapeHtml(timelineA.title) + '</span>' +
          (timelineB ? '<span class="meta-sep">×</span><span>' + escapeHtml(timelineB.title) + '</span>' : '') +
        '</div>';

    headHtml +=
      '<div class="tl-compare-launch">' +
        '<span class="tl-compare-label">' + (timelineB ? 'Вторая лента:' : 'Сравнить с:') + '</span>' +
        '<select class="tl-compare-select" aria-label="Вторая лента для сравнения">' +
          '<option value="">— выберите ленту —</option>' +
          datedOthers.map(function(tl) {
            var sel = timelineB && timelineB.id === tl.id ? ' selected' : '';
            return '<option value="' + escapeHtml(tl.id) + '"' + sel + '>' + escapeHtml(tl.title) + ' (' + tl.events.length + ')</option>';
          }).join('') +
        '</select>' +
        (timelineB ? '<button class="tl-compare-swap" type="button">⇄ Поменять стороны</button>' : '') +
      '</div>';

    var rowsHtml = '';
    if (timelineB) {
      // Сводная хронология: события обеих лент, отсортированные по sortKey.
      // При равных sortKey события ленты A идут первыми (стабильная сортировка).
      var rows = sortedEvents(timelineA).map(function(e, i) {
        return { ev: e, side: 'a', tl: timelineA, idx: i };
      }).concat(sortedEvents(timelineB).map(function(e, i) {
        return { ev: e, side: 'b', tl: timelineB, idx: i };
      }));
      rows.sort(function(x, y) { return x.ev.sortKey - y.ev.sortKey; });
      rowsHtml = rows.map(function(r) {
        return '<article class="tl-detail-event tl-compare-event" data-side="' + r.side + '" data-href="#timeline/' + escapeHtml(r.tl.id) + '/event/' + r.idx + '" role="button" tabindex="0" aria-label="' + escapeHtml(r.ev.title) + ' — открыть в исходной ленте">' +
          '<div class="tl-event-row-inner">' +
            '<span class="tl-compare-tag tl-compare-tag--' + r.side + '" aria-hidden="true">' + (r.side === 'a' ? 'A' : 'B') + '</span>' +
            '<div class="tl-detail-event-main">' +
              '<div class="tl-detail-event-date">' + escapeHtml(r.ev.date) + '</div>' +
              '<h3 class="tl-detail-event-title">' + escapeHtml(r.ev.title) + '</h3>' +
              '<p class="tl-detail-event-desc">' + escapeHtml(r.ev.description || '') + '</p>' +
            '</div>' +
            '<span class="tl-compare-src">' + escapeHtml(r.tl.title) + '</span>' +
          '</div>' +
        '</article>';
      }).join('');
    } else {
      rowsHtml = '<div class="lab-alert lab-alert-info">Выберите вторую ленту — события выстроятся в одну хронологию по sortKey.</div>';
    }

    timelineContainer.innerHTML = headHtml +
      '<div class="tl-detail-events" role="list" aria-label="Сводная хронология">' + rowsHtml + '</div>' +
      '</section>';

    timelineContainer._labHeroOverride = {
      kicker: 'АЛЕФИ · ПАЛЕО-ТАЙМЛАЙН',
      title: 'Сравнение лент',
      subtitle: timelineA.title + (timelineB ? ' × ' + timelineB.title : ' — выберите вторую ленту'),
      icon: 'paleo/track.png'
    };
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('timeline', 'detail', timelineContainer._labHeroOverride);
      if (window.LabRouter && LabRouter.parseHash) {
        LabRouter.renderBreadcrumbs('timeline', LabRouter.parseHash());
      }
    }

    var backBtn = timelineContainer.querySelector('.tl-detail-back');
    if (backBtn) backBtn.addEventListener('click', function() {
      // Возврат в полный вид базовой ленты.
      location.hash = '#timeline/' + idA + '/full';
    });

    var select = timelineContainer.querySelector('.tl-compare-select');
    if (select) select.addEventListener('change', function() {
      if (select.value) location.hash = '#timeline/compare/' + idA + '/' + select.value;
    });

    var swapBtn = timelineContainer.querySelector('.tl-compare-swap');
    if (swapBtn) swapBtn.addEventListener('click', function() {
      location.hash = '#timeline/compare/' + idB + '/' + idA;
    });

    // Строка сводной хронологии ведёт к событию в исходной ленте.
    timelineContainer.querySelectorAll('.tl-compare-event').forEach(function(row) {
      var open = function() { location.hash = row.getAttribute('data-href'); };
      row.addEventListener('click', open);
      row.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Ссылка скопирована'); }
    catch(e) { showToast('Не удалось скопировать'); }
    document.body.removeChild(ta);
  }

  function showToast(message) {
    var existing = document.querySelector('.tl-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'tl-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:var(--bg-dark);color:var(--text-light);padding:8px 16px;border-radius:6px;' +
      'font-family:var(--font-ui);font-size:13px;font-weight:600;z-index:10001;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.3);animation:fadeIn 0.2s ease both;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 2000);
  }

  function pluralize(n, one, two, five) {
    n = Math.abs(n) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
  }

  // Рендеринг одного события: точка-тип (kind), бейдж уверенности,
  // источник и inline actions. Статусы done/active/pending заменены типами:
  // для исторических событий «в процессе» не существует.
  function renderEventRow(event, index, tlId) {
    var kind = KIND_LABELS[event && event.kind] ? event.kind : 'event';
    var conf = CONFIDENCE_LABELS[event && event.confidence] ? event.confidence : null;
    var sourceHtml = event && event.source
      ? '<div class="tl-event-source">Источник: ' + escapeHtml(event.source) + '</div>'
      : '';
    // Кросс-ссылки на связанные события/модули: только внутренние hash-адреса.
    var linksHtml = (event && event.links && event.links.length)
      ? '<div class="tl-event-links">' + event.links.map(function(l) {
          var href = (l && l.href && l.href.charAt(0) === '#') ? l.href : '#';
          return '<a class="tl-event-link" href="' + escapeHtml(href) + '">' + escapeHtml((l && l.label) || 'Ссылка') + '</a>';
        }).join('') + '</div>'
      : '';
    var confidenceHtml = conf
      ? '<span class="tl-confidence tl-confidence--' + conf + '">' + CONFIDENCE_LABELS[conf] + '</span>'
      : '';
    return '<article class="tl-detail-event" data-event-idx="' + index + '" style="--tl-event-index:' + index + '" role="listitem">' +
      '<div class="tl-event-row-inner">' +
        '<span class="tl-status-dot tl-status-dot--' + kind + '" aria-label="' + KIND_LABELS[kind] + '"></span>' +
        '<div class="tl-detail-event-main">' +
          '<div class="tl-detail-event-date">' + escapeHtml(event.date) + confidenceHtml + '</div>' +
          '<h3 class="tl-detail-event-title">' + escapeHtml(event.title) + '</h3>' +
          '<p class="tl-detail-event-desc">' + escapeHtml(event.description || '') + '</p>' +
          sourceHtml +
          linksHtml +
        '</div>' +
        '<div class="tl-event-actions">' +
          '<button class="tl-event-action-btn" type="button" data-action="open" data-event-idx="' + index + '" title="Открыть событие">›</button>' +
          '<button class="tl-event-action-btn" type="button" data-action="copy" data-event-idx="' + index + '" title="Копировать ссылку">⎘</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  // Каталог без раскрытой карточки; раскрытая полоса и полный вид живут в
  // маршруте, поэтому deep-link, крошки и «назад» дают одно и то же состояние.
  function applyRoute(parsed) {
    if (!timelineContainer || !timelineItems.length) return;
    var segments = (parsed && parsed.segments) || [];
    // Сравнение лент: #timeline/compare/<idA>/<idB>
    if (segments[1] === 'compare') {
      renderCompare(segments[2], segments[3]);
      return;
    }
    var id = segments[1];
    if (!id || !timelineById(id)) {
      renderCatalog(timelineContainer, timelineItems, {});
      return;
    }
    // Полный вид ленты: #timeline/<id>/full
    if (segments[2] === 'full') {
      renderDetail(id);
      return;
    }
    // Deep-link на событие: #timeline/<id>/event/<idx>
    var eventIdx = null;
    if (segments[2] === 'event' && segments[3] != null && segments[3] !== '') {
      var parsedIdx = parseInt(segments[3], 10);
      if (!isNaN(parsedIdx)) eventIdx = parsedIdx;
    }
    renderCatalog(timelineContainer, timelineItems, { openId: id, focusIdx: eventIdx });
  }

  // Титулы крошек: #timeline/<id>, #timeline/<id>/event/<idx>, #timeline/compare/<A>/<B>.
  function routeTitle(route) {
    var parts = String(route || '').split('/');
    if (parts[0] !== 'timeline') return '';
    if (parts.length === 1) return 'Каталог таймлайнов';
    if (parts[1] === 'compare') {
      var sideA = parts[2] ? timelineItems.filter(function(t) { return t.id === parts[2]; })[0] : null;
      var sideB = parts[3] ? timelineItems.filter(function(t) { return t.id === parts[3]; })[0] : null;
      if (sideA && sideB) return sideA.title + ' × ' + sideB.title;
      return 'Сравнение лент';
    }
    var named = timelineById(parts[1]);
    if (!named) return '';
    if (parts[2] === 'event' && parts[3] != null && parts[3] !== '') {
      var ev = sortedEvents(named)[parseInt(parts[3], 10)];
      return ev && ev.title ? ev.title : named.title;
    }
    if (parts[2] === 'full') return named.title + ' — полный вид';
    return named.title;
  }

  // ===== COMMAND PALETTE (⌘K) =====
  var cpState = { open: false, selectedIdx: 0, results: [] };

  function buildSearchIndex() {
    var index = [];
    timelineItems.forEach(function(tl) {
      index.push({
        type: 'timeline',
        id: tl.id,
        title: tl.title,
        subtitle: tl.description || '',
        icon: tl.paleoIcon,
        count: tl.events ? tl.events.length : 0
      });
      sortedEvents(tl).forEach(function(event, idx) {
        index.push({
          type: 'event',
          id: tl.id + '--event-' + idx,
          parentId: tl.id,
          parentTitle: tl.title,
          title: event.title,
          subtitle: event.date + ' · ' + tl.title,
          icon: tl.paleoIcon,
          eventIdx: idx
        });
      });
    });
    return index;
  }

  function renderCpResults(container, results, query) {
    if (!results.length) {
      container.innerHTML = '<div class="tl-cp-empty">Ничего не найдено</div>';
      return;
    }
    container.innerHTML = results.map(function(item, idx) {
      var selectedClass = idx === cpState.selectedIdx ? ' selected' : '';
      return '<div class="tl-cp-item' + selectedClass + '" data-cp-idx="' + idx + '" role="option" aria-selected="' + (idx === cpState.selectedIdx) + '">' +
        '<span class="tl-cp-item-icon" lang="hbo" aria-hidden="true">' + escapeHtml(item.icon || '𐤀') + '</span>' +
        '<div class="tl-cp-item-content">' +
          '<div class="tl-cp-item-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="tl-cp-item-subtitle">' + escapeHtml(item.subtitle) + '</div>' +
        '</div>' +
        (item.type === 'timeline' ? '<span class="tl-cp-item-meta">' + item.count + ' соб.</span>' : '<span class="tl-cp-item-meta">событие</span>') +
      '</div>';
    }).join('');

    var items = container.querySelectorAll('.tl-cp-item');
    items.forEach(function(el) {
      el.addEventListener('click', function() {
        var idx = parseInt(el.getAttribute('data-cp-idx'), 10);
        selectCpItem(cpState.results[idx]);
      });
    });
  }

  function updateCpSelection(container) {
    var items = container.querySelectorAll('.tl-cp-item');
    items.forEach(function(el, idx) {
      el.classList.toggle('selected', idx === cpState.selectedIdx);
      el.setAttribute('aria-selected', idx === cpState.selectedIdx);
    });
    if (items[cpState.selectedIdx]) {
      items[cpState.selectedIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function selectCpItem(item) {
    if (!item) return;
    closeCommandPalette();
    if (item.type === 'timeline') {
      // Каталог с раскрытой карточкой — тот же маршрут, что и у клика по карточке.
      location.hash = '#timeline/' + item.id;
    } else if (item.type === 'event') {
      // Deep-link события: полоса ленты раскроется, строка подсветится.
      location.hash = '#timeline/' + item.parentId + '/event/' + item.eventIdx;
    }
  }

  function closeCommandPalette() {
    var overlay = document.getElementById('tl-cp-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    setTimeout(function() { overlay.remove(); }, 150);
    cpState.open = false;
  }

  function openCommandPalette() {
    if (cpState.open) return;
    var index = buildSearchIndex();
    cpState = { open: true, selectedIdx: 0, results: index, query: '' };

    var overlay = document.createElement('div');
    overlay.className = 'tl-cp-overlay';
    overlay.id = 'tl-cp-overlay';
    overlay.innerHTML =
      '<div class="tl-cp-modal glass-modal" role="dialog" aria-modal="true" aria-label="Поиск по таймлайнам">' +
        '<div class="tl-cp-input-row">' +
          '<span class="tl-cp-icon">⌘</span>' +
          '<input class="tl-cp-input" type="text" placeholder="Поиск таймлайнов и событий…" aria-label="Поиск" autofocus>' +
          '<kbd class="tl-cp-kbd">ESC</kbd>' +
        '</div>' +
        '<div class="tl-cp-results" role="listbox" aria-label="Результаты поиска"></div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('open'); });

    var input = overlay.querySelector('.tl-cp-input');
    var resultsContainer = overlay.querySelector('.tl-cp-results');
    input.focus();

    renderCpResults(resultsContainer, index, '');

    input.addEventListener('input', function() {
      var query = input.value.trim().toLowerCase();
      cpState.query = query;
      cpState.selectedIdx = 0;
      if (query) {
        var filtered = index.filter(function(item) {
          return item.title.toLowerCase().indexOf(query) !== -1 ||
                 item.subtitle.toLowerCase().indexOf(query) !== -1;
        });
        cpState.results = filtered;
      } else {
        cpState.results = index;
      }
      renderCpResults(resultsContainer, cpState.results, query);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cpState.selectedIdx = Math.min(cpState.selectedIdx + 1, cpState.results.length - 1);
        updateCpSelection(resultsContainer);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cpState.selectedIdx = Math.max(cpState.selectedIdx - 1, 0);
        updateCpSelection(resultsContainer);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCpItem(cpState.results[cpState.selectedIdx]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      }
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeCommandPalette();
    });
  }

  // Глобальный хоткей ⌘K / Ctrl+K
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (cpState.open) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    }
  });

  return {
    init: init,
    render: renderCatalog,
    applyRoute: applyRoute,
    renderDetail: renderDetail,
    routeTitle: routeTitle,
    openCommandPalette: openCommandPalette
  };
})();

window.Timeline = Timeline;

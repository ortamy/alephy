/**
 * dashboard.js — «Рабочий стол исследователя» (#dashboard)
 * Виджеты со статистикой, собранной из data/roots/roots.json, data/dictionaries.json,
 * data/exposures/index.json, data/heraldry/heraldry.json, data/qumran-books.json.
 */
const Dashboard = (function() {
  'use strict';

  var loaded = false;
  var reloading = false;
  /* Защита от параллельной загрузки. Флаг loaded выставлялся только ПОСЛЕ
     resolve(), поэтому шесть вызовов init() за одну загрузку (роутер, рендер
     модуля, повторный вход) запускали шесть параллельных loadData() — это
     ~3.3 МБ данных (roots 177 КБ + dictionaries 457 КБ + exposures 2.7 МБ
     + heraldry + qumran-books) НА КАЖДЫЙ вызов. Теперь повторный вызов во
     время загрузки просто ждёт тот же промис. */
  var loading = null;
  // Dashboard needs a lightweight overview. Full scripture corpus is over 117 MB;
  // load books only in their dedicated route.
  var MAX_PROGRESS_BOOKS = 0;
  // Нейтральная подпись среза не печатается в разметке: она дублировала бы мету шапки ячейки (§5.2d).
  var SNAPSHOT_DELTA_TEXT = 'срез данных';

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  /* Оборачивает общий кеш AlephyUtils: обычная загрузка идёт через кеш и
     переиспользует данные, уже скачанные другими модулями (roots.json тянут
     восемь потребителей). Принудительное обновление намеренно идёт мимо
     кеша: для него служебный query-параметр делает URL уникальным, поэтому
     старые данные не «залипают» после ручного обновления. */
  function fetchJson(path) {
    var forceReload = arguments.length > 1 && arguments[1];
    if (!forceReload) return AlephyUtils.fetchJson(path);
    var requestPath = path + '?_reload=' + Date.now();
    return fetch(requestPath, { cache: 'no-store' }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' для ' + path);
      return r.json();
    });
  }

  function bookDataPath(book) {
    // В каталоге есть книги-заготовки без локального свидетельства.
    // Запрашиваем только файл, явно указанный в dataFile.
    var file = book && book.dataFile;
    return file ? 'data/scripture/' + String(file).replace(/\.json$/, '') + '.json' : '';
  }

  function loadBookProgress(books, forceReload) {
    return Promise.all((books || []).map(function(book, index) {
      if (index >= MAX_PROGRESS_BOOKS) {
        return Promise.resolve({ book: book, status: 'not-started', verses: [], percent: 0 });
      }
      var path = bookDataPath(book);
      if (!path) return Promise.resolve({ book: book, status: 'not-started', verses: [], percent: 0 });

      return fetchJson(path, forceReload).then(function(verses) {
        if (!Array.isArray(verses) || !verses.length) {
          return { book: book, status: 'in-progress', verses: [], percent: 0 };
        }
        return {
          book: book,
          status: 'completed',
          verses: verses,
          percent: 100
        };
      }).catch(function() {
        // Отсутствующий JSON означает, что книга ещё не начата.
        return { book: book, status: 'not-started', verses: [], percent: 0 };
      });
    }));
  }

  function loadData(forceReload) {
    return Promise.all([
      fetchJson('data/roots/roots.json', forceReload),
      fetchJson('data/dictionaries.json', forceReload),
      fetchJson('data/exposures/index.json', forceReload),
      fetchJson('data/heraldry/heraldry.json', forceReload),
      fetchJson('data/qumran-books.json', forceReload)
    ]).then(function(results) {
      var books = (results[4] && results[4].books) || [];
      return loadBookProgress(books, forceReload).then(function(bookProgress) {
        var firstLoaded = bookProgress.filter(function(item) {
          return item.status === 'completed';
        })[0];
      return {
        roots: results[0] || [],
        dictionaries: results[1] || {},
        researches: results[2] || [],
        heraldry: results[3] || [],
          qumranBooks: books,
          bookProgress: bookProgress,
          scriptureVerses: firstLoaded ? firstLoaded.verses : []
        };
      });
    });
  }

  /* ─── Быстрые вкладки разделов (зеркало сайдбара под шапкой) ───
     Источник — отрендеренный #labSidebar: порядок и подписи наследуются,
     role-гейтинг повторяет applyLabConfig (hiddenSectionsForGuests + админ-секция).
     Фильтр сайдбара (nav-enhance) сознательно игнорируем: он транзиентный. */
  function tabLabel(item) {
    return String(item.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /* Иконка вкладки: в живом сайдбаре lucide уже заменил <i> на svg и снял
     data-lucide (защита от цикла), поэтому имя добываем из класса lucide-<name>. */
  function tabIconName(item) {
    var raw = item.querySelector('i[data-lucide]');
    if (raw) return raw.getAttribute('data-lucide');
    var svg = item.querySelector('svg.lucide');
    if (!svg) return null;
    var m = String(svg.getAttribute('class') || '').match(/lucide-([a-z0-9-]+)/);
    return m ? m[1] : null;
  }

  function makeTab(item, withIcon) {
    var tab = document.createElement('a');
    tab.className = 'dashboard-tab';
    tab.href = item.getAttribute('href');
    var iconName = withIcon ? tabIconName(item) : null;
    if (iconName) {
      var i = document.createElement('i');
      i.setAttribute('data-lucide', iconName);
      i.className = 'lab-icon';
      i.setAttribute('aria-hidden', 'true');
      tab.appendChild(i);
    }
    tab.appendChild(document.createTextNode(tabLabel(item)));
    return tab;
  }

  function renderTabs(widgets) {
    var module = widgets.parentNode;
    var sidebar = document.getElementById('labSidebar');
    if (!module || !sidebar || module.querySelector('.dashboard-tabs')) return;

    var role = (window.AccessGate && window.AccessGate.getRole) ? window.AccessGate.getRole() : 'guest';
    var config = (window.AccessGate && window.AccessGate.getConfig) ? (window.AccessGate.getConfig() || {}) : {};
    var hiddenKeys = config.hiddenSectionsForGuests || [];

    function available(item) {
      var key = item.getAttribute('data-module');
      return !(role !== 'admin' && key && hiddenKeys.indexOf(key) > -1);
    }

    var nav = document.createElement('nav');
    nav.className = 'dashboard-tabs';
    nav.setAttribute('aria-label', 'Разделы лаборатории');
    var strip = document.createElement('div');
    strip.className = 'dashboard-tabs-strip';

    Array.prototype.forEach.call(
      sidebar.querySelectorAll('.sidebar-items > a.sidebar-item'),
      function(item) {
        if (!available(item)) return;
        var tab = makeTab(item, true);
        if (tab.getAttribute('href') === '#dashboard') tab.setAttribute('aria-current', 'page');
        strip.appendChild(tab);
      }
    );

    Array.prototype.forEach.call(sidebar.querySelectorAll('.sidebar-section'), function(section) {
      if (section.id === 'sidebar-admin-section' && role !== 'admin') return;
      var label = section.querySelector('.sidebar-section-header span');
      var items = section.querySelectorAll('.sidebar-section-content > a.sidebar-item');
      if (!label || !items.length) return;
      var kicker = document.createElement('span');
      kicker.className = 'dashboard-tabs-group';
      kicker.textContent = label.textContent.trim();
      strip.appendChild(kicker);
      Array.prototype.forEach.call(items, function(item) {
        if (!available(item)) return;
        strip.appendChild(makeTab(item, false));
      });
    });

    nav.appendChild(strip);
    module.insertBefore(nav, widgets);
  }

  function init() {
    var container = document.getElementById('dashboard-widgets');
    if (!container) return;
    renderTabs(container);
    if (container.querySelector('.dw-summary-value')) {
      loaded = true;
      return;
    }
    if (loaded) {
      reload();
      return;
    }
    // Загрузка уже идёт — не запускаем вторую копию тех же ~3.3 МБ.
    if (loading) { loading.then(function() { init(); }); return; }

    loading = loadData(false).then(function(data) {
      loaded = true;
      render(container, data);
    }).catch(function(err) {
      container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки статистики: ' + esc(err.message) + '</div>';
    }).then(function() {
      loading = null;
    });
  }

  function reload() {
    var container = document.getElementById('dashboard-widgets');
    if (!container || reloading) return;
    reloading = true;
    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Обновление статистики…</div></div>';
    loadData(true).then(function(data) {
      loaded = true;
      render(container, data);
    }).catch(function(err) {
      container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка обновления статистики: ' + esc(err.message) + '</div>';
    }).then(function() {
      reloading = false;
    });
  }

  function render(container, data) {
    var dictEntries = Object.keys(data.dictionaries).map(function(key) {
      var dict = data.dictionaries[key];
      return { key: key, title: dict.title || key, count: (dict.terms || []).length };
    }).sort(function(a, b) { return b.count - a.count; });

    var totalTerms = dictEntries.reduce(function(sum, d) { return sum + d.count; }, 0);

    container.innerHTML =
      '<div class="dw-bento">' +
        renderCounters(data, dictEntries, totalTerms) +
        renderActivityTicker(data.researches) +
        renderBooksProgress(data.qumranBooks, data.bookProgress) +
        renderMechanismsBars(dictEntries) +
        renderLatestResearches(data.researches) +
        renderResearchActivity(data.researches) +
        renderReliabilityContour(data.researches) +
        renderCompletenessMap(data.researches) +
      '</div>';

    bindDictClicks(container);
    bindBookClicks(container);
  }

  /* ─── Bento-ячейки (§5.2d канона) ───
     Каждая зона рабочего стола — ячейка сетки со шапкой по §4.1: номер главы,
     капительный заголовок, мета справа. Пропорции задаёт модификатор ячейки. */

  function plural(n, one, few, many) {
    return window.LabPluralWord ? LabPluralWord(n, one, few, many) : many;
  }

  /* Число с согласованным словом для меты шапки: «29 книг», а не «книг». */
  function count(n, one, few, many) {
    return n + ' ' + plural(n, one, few, many);
  }

  function renderCell(modifier, num, title, hint, body, hintClass) {
    return '<section class="dw-cell dw-cell--' + modifier + '">' +
      '<div class="dw-cell-head">' +
        '<span class="dw-num" aria-hidden="true">' + esc(num) + '</span>' +
        '<h3 class="dw-cell-title">' + esc(title) + '</h3>' +
        (hint ? '<span class="dw-cell-hint' + (hintClass ? ' ' + hintClass : '') + '">' + esc(hint) + '</span>' : '') +
      '</div>' +
      body +
    '</section>';
  }

  function renderCounters(data, dictEntries, totalTerms) {
    var deltas = calculateCounterDeltas(data.researches);
    var researchMetrics = calculateResearchMetrics(data.researches);
    var w = plural;
    var items = [
      { num: data.roots.length, label: w(data.roots.length, 'корень', 'корня', 'корней'), delta: deltas.snapshot, href: '#root-dictionary' },
      { num: totalTerms, label: w(totalTerms, 'термин', 'термина', 'терминов') + ' подмен', delta: deltas.snapshot, href: '#dictionaries' },
      { num: data.researches.length, label: w(data.researches.length, 'исследование', 'исследования', 'исследований'), delta: deltas.researches, href: '#researches' },
      { num: dictEntries.length, label: w(dictEntries.length, 'словарь', 'словаря', 'словарей'), delta: deltas.snapshot, href: '#dictionaries' },
      { num: data.heraldry.length, label: w(data.heraldry.length, 'империя/герб', 'империи/герба', 'империй/гербов'), delta: deltas.snapshot, href: '#heraldry' }
    ];
    return '<section class="dw-cell dw-cell--summary" aria-labelledby="dw-summary-title">' +
      '<div class="dw-cell-head"><span class="dw-num" aria-hidden="true">01</span>' +
        '<h3 class="dw-cell-title" id="dw-summary-title">Сводка исследований</h3>' +
        '<span class="dw-cell-hint">' + esc(researchMetrics.referenceDate ? 'Срез данных: ' + researchMetrics.referenceDate : 'Дата среза не указана') + '</span></div>' +
      '<div class="dw-summary-grid">' + items.map(function(item, i) {
        var tag = item.href ? 'a' : 'div';
        var href = item.href ? ' href="' + item.href + '"' : '';
        return '<' + tag + ' class="dw-summary-item' + (item.href ? ' dw-summary-item--link' : '') + '"' + href + '>' +
          '<span class="dw-summary-value">' + esc(item.num) + '</span><span class="dw-summary-label">' + esc(item.label) + '</span>' +
          renderCounterDelta(item.delta) + '</' + tag + '>';
      }).join('') + '</div>' +
    '</section>';
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    var date = new Date(String(value) + 'T00:00:00Z');
    return isNaN(date.getTime()) ? null : date;
  }

  function calculateCounterDeltas(researches) {
    var records = Array.isArray(researches) ? researches : [];
    var dates = records.map(function(item) { return parseDate(item.createdAt); }).filter(Boolean);
    var anchor = dates.reduce(function(latest, date) { return !latest || date > latest ? date : latest; }, null);
    var snapshot = { kind: 'neutral', text: SNAPSHOT_DELTA_TEXT };
    if (!anchor) return { researches: { kind: 'neutral', text: 'нет истории' }, snapshot: snapshot };
    var boundary = new Date(anchor.getTime());
    boundary.setUTCDate(boundary.getUTCDate() - 29);
    var growth = records.filter(function(item) {
      var date = parseDate(item.createdAt);
      return date && date >= boundary && date <= anchor;
    }).length;
    return {
      researches: growth ? { kind: 'up', text: '+' + growth + ' за 30 дней' } : { kind: 'neutral', text: 'без прироста · 30 дней' },
      snapshot: snapshot
    };
  }

  function renderCounterDelta(delta) {
    // Нейтральный срез повторялся под каждым показателем, хотя стоит в шапке ячейки:
    // печатаем строку-заполнитель, чтобы цифры пяти показателей остались на одной линии.
    if (delta.text === SNAPSHOT_DELTA_TEXT) return '<div class="dw-counter-delta" aria-hidden="true"></div>';
    return '<div class="dw-counter-delta' + (delta.kind === 'up' ? ' dw-counter-delta--up' : '') + '">' +
      (delta.kind === 'up' ? '<span aria-hidden="true">▲</span> ' : '') + esc(delta.text) +
    '</div>';
  }

  function calculateResearchMetrics(researches) {
    var records = Array.isArray(researches) ? researches : [];
    var dates = [];
    records.forEach(function(item) {
      [item.createdAt, item.updatedAt].forEach(function(value) {
        var date = parseDate(value);
        if (date) dates.push(date);
      });
    });
    var anchor = dates.reduce(function(latest, date) {
      return !latest || date > latest ? date : latest;
    }, null);

    function countActivity(field, days, skipCreatedRecords) {
      if (!anchor) return 0;
      var boundary = new Date(anchor.getTime());
      boundary.setUTCDate(boundary.getUTCDate() - days + 1);
      return records.filter(function(item) {
        var date = parseDate(item[field]);
        return date && date >= boundary && date <= anchor &&
          (!skipCreatedRecords || item.updatedAt !== item.createdAt);
      }).length;
    }

    function countBy(field, value) {
      return records.filter(function(item) { return item[field] === value; }).length;
    }

    return {
      referenceDate: anchor ? anchor.toISOString().slice(0, 10) : '',
      new7: countActivity('createdAt', 7, false),
      new30: countActivity('createdAt', 30, false),
      updated7: countActivity('updatedAt', 7, true),
      updated30: countActivity('updatedAt', 30, true),
      published: countBy('status', 'published'),
      draft: countBy('status', 'draft'),
      verified: countBy('confidence', 'verified'),
      needsReview: countBy('confidence', 'needs-review'),
      hypothesis: countBy('confidence', 'hypothesis')
    };
  }

  function renderMetric(label, value, modifier) {
    return '<div class="dw-metric' + (modifier ? ' dw-metric--' + modifier : '') + '">' +
      '<span class="dw-metric-value">' + esc(value) + '</span>' +
      '<span class="dw-metric-label">' + esc(label) + '</span>' +
    '</div>';
  }

  function renderResearchActivity(researches) {
    var metrics = calculateResearchMetrics(researches);
    var reference = metrics.referenceDate ? 'Срез данных: ' + metrics.referenceDate : 'Даты материалов не указаны';
    return renderCell('movement', '06', 'Движение исследований', reference,
      '<div class="dw-metric-grid">' +
        renderMetric('Новые · 7 дней', metrics.new7, 'new') +
        renderMetric('Обновлённые · 7 дней', metrics.updated7, 'updated') +
        renderMetric('Новые · 30 дней', metrics.new30, 'new') +
        renderMetric('Обновлённые · 30 дней', metrics.updated30, 'updated') +
      '</div>');
  }

  function renderReliabilityContour(researches) {
    var metrics = calculateResearchMetrics(researches);
    var total = Array.isArray(researches) ? researches.length : 0;
    return renderCell('reliability', '07', 'Контур надёжности', count(total, 'материал', 'материала', 'материалов'),
      '<div class="dw-metric-grid">' +
        renderMetric('Проверено', metrics.verified, 'verified') +
        renderMetric('Требует проверки', metrics.needsReview, 'review') +
        renderMetric('Гипотезы', metrics.hypothesis, 'hypothesis') +
        renderMetric('Опубликовано', metrics.published, 'published') +
      '</div>');
  }

  function calculateCompletenessMap(researches) {
    var records = Array.isArray(researches) ? researches : [];
    var supportFields = [
      { key: 'thesis', label: 'тезис' },
      { key: 'original', label: 'исходный контур' },
      { key: 'shift', label: 'сдвиг' },
      { key: 'transmissionChain', label: 'цепочка передачи' },
      { key: 'sources', label: 'источники' },
      { key: 'roots', label: 'корни' },
      { key: 'evidence', label: 'свидетельства' },
      { key: 'reconstruction', label: 'реконструкция' }
    ];
    function hasSupport(item, field) {
      var value = field.key === 'sources' || field.key === 'roots' ? item[field.key] : (item.sections || {})[field.key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value && String(value).trim());
    }
    var items = records.map(function(item) {
      var missing = supportFields.filter(function(field) { return !hasSupport(item, field); });
      return {
        id: item.id || '', slug: item.slug || '', title: item.title || item.id || 'Без названия',
        complete: supportFields.length - missing.length, total: supportFields.length,
        percent: Math.round(((supportFields.length - missing.length) / supportFields.length) * 100),
        missing: missing.map(function(field) { return field.label; }), updatedAt: parseDate(item.updatedAt) ? item.updatedAt : ''
      };
    }).sort(function(a, b) {
      return a.percent - b.percent || String(b.updatedAt).localeCompare(String(a.updatedAt)) || String(a.title).localeCompare(String(b.title), 'ru');
    });
    var average = items.length ? Math.round(items.reduce(function(sum, item) { return sum + item.percent; }, 0) / items.length) : 0;
    return { average: average, items: items };
  }

  function renderCompletenessMap(researches) {
    var map = calculateCompletenessMap(researches);
    var rows = map.items.slice(0, 5).map(function(item) {
      var href = item.slug ? '#researches/case/' + encodeURIComponent(item.slug) : '#researches';
      return '<a class="dw-completeness-item" href="' + href + '">' +
        '<span class="dw-completeness-head"><span class="dw-completeness-title">' + esc(item.title) + '</span><span class="dw-completeness-value">' + esc(item.percent) + '% · ' + esc(item.complete) + '/' + esc(item.total) + '</span></span>' +
        '<span class="dw-completeness-track" aria-hidden="true"><span class="dw-completeness-fill" style="width:' + item.percent + '%"></span></span>' +
        '<span class="dw-completeness-missing">' + (item.missing.length ? 'Разрывы: ' + esc(item.missing.join(', ')) : 'Все опоры собраны') + '</span>' +
      '</a>';
    }).join('');
    return '<section class="dw-cell dw-cell--completeness">' +
      '<div class="dw-cell-head">' +
        '<span class="dw-num" aria-hidden="true">08</span>' +
        '<h3 class="dw-cell-title">Карта полноты материалов</h3>' +
        '<span class="dw-cell-hint dw-cell-hint--accent">' + esc(map.average) + '% · средняя полнота</span>' +
      '</div>' +
      '<div class="dw-completeness-list">' + (rows || '<div class="lab-alert lab-alert-info">Материалов пока нет.</div>') + '</div>' +
    '</section>';
  }

  function renderMechanismsBars(dictEntries) {
    var top = dictEntries.slice(0, 8);
    var maxCount = top.reduce(function(m, d) { return Math.max(m, d.count); }, 1);
    var bars = top.map(function(d) {
      var pct = Math.round((d.count / maxCount) * 100);
      return '<div class="dw-bar-row" data-dict-key="' + esc(d.key) + '" role="button" tabindex="0">' +
        '<span class="dw-bar-label" title="' + esc(d.title) + '">' + esc(d.title) + '</span>' +
        '<span class="dw-bar-track"><span class="dw-bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="dw-bar-value">' + esc(d.count) + '</span>' +
      '</div>';
    }).join('');
    return renderCell('dicts', '04', 'Топ словарей подмен', top.length + ' из ' + dictEntries.length,
      '<div class="dw-bars">' + bars + '</div>');
  }

  function renderLatestResearches(researches) {
    var latest = researches.slice().sort(function(a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    }).slice(0, 5);
    var items = latest.map(function(item) {
      return '<a class="dw-list-item" href="#researches">' +
        '<div class="dw-list-title">' + esc(item.title) + '</div>' +
        '<div class="dw-list-meta">' + esc(item.category || '') + (item.date ? ' · ' + esc(item.date) : '') + '</div>' +
      '</a>';
    }).join('');
    return renderCell('latest', '05', 'Последние разборы', count(latest.length, 'разбор', 'разбора', 'разборов'),
      '<div class="dw-list">' + (items || '<div class="lab-alert lab-alert-info">Пока пусто.</div>') + '</div>');
  }

  function collectResearchActivity(researches) {
    var events = [];
    (Array.isArray(researches) ? researches : []).forEach(function(item) {
      var hasChangelog = false;
      (Array.isArray(item.changelog) ? item.changelog : []).forEach(function(change) {
        if (!parseDate(change.date)) return;
        hasChangelog = true;
        events.push({
          date: change.date,
          type: 'change',
          title: item.title || item.id || 'Материал без названия',
          slug: item.slug || item.id || '',
          note: change.note || 'Зафиксировано изменение материала'
        });
      });

      if (hasChangelog) return;
      if (parseDate(item.createdAt)) {
        events.push({ date: item.createdAt, type: 'new', title: item.title || item.id || 'Материал без названия', slug: item.slug || item.id || '', note: 'Создан материал' });
      }
      if (parseDate(item.updatedAt) && item.updatedAt !== item.createdAt) {
        events.push({ date: item.updatedAt, type: 'updated', title: item.title || item.id || 'Материал без названия', slug: item.slug || item.id || '', note: 'Обновлён материал' });
      }
    });
    return events.sort(function(a, b) {
      var dateOrder = String(b.date).localeCompare(String(a.date));
      return dateOrder || String(a.title).localeCompare(String(b.title), 'ru');
    }).slice(0, 8);
  }

  function renderActivityTicker(researches) {
    var events = collectResearchActivity(researches);
    if (!events.length) {
      return renderCell('ticker', '02', 'Живая лента активности', '',
        '<div class="lab-alert lab-alert-info">Датированные события пока не зафиксированы.</div>');
    }
    var items = events.map(function(event) {
      var href = event.slug ? '#researches/case/' + encodeURIComponent(event.slug) : '#researches';
      return '<a class="dw-ticker-item" href="' + href + '">' +
        '<span class="dw-ticker-date">' + esc(event.date) + '</span>' +
        '<span class="dw-ticker-type dw-ticker-type--' + esc(event.type) + '">' + esc(event.type === 'new' ? 'Новое' : event.type === 'updated' ? 'Обновлено' : 'Запись') + '</span>' +
        '<span class="dw-ticker-text"><strong>' + esc(event.title) + '</strong> — ' + esc(event.note) + '</span>' +
      '</a>';
    }).join('');
    var copies = events.map(function(event) {
      return '<span class="dw-ticker-item" aria-hidden="true"><span class="dw-ticker-date">' + esc(event.date) + '</span><span class="dw-ticker-type dw-ticker-type--' + esc(event.type) + '">' + esc(event.type === 'new' ? 'Новое' : event.type === 'updated' ? 'Обновлено' : 'Запись') + '</span><span class="dw-ticker-text"><strong>' + esc(event.title) + '</strong> — ' + esc(event.note) + '</span></span>';
    }).join('');
    return renderCell('ticker', '02', 'Живая лента активности', count(events.length, 'событие', 'события', 'событий'),
      '<div class="dw-ticker" aria-label="Последние изменения исследований"><div class="dw-ticker-track">' + items + copies + '</div></div>');
  }

  var paleoBookIcons = {
    bereshit: '𐤁', shmot: '𐤔', vayikra: '𐤅', bemidbar: '𐤁', dvarim: '𐤃',
    yehoshua: '𐤉', shoftim: '𐤔', 'shmuel-alef': '𐤔', 'shmuel-bet': '𐤔',
    'melachim-alef': '𐤌', 'melachim-bet': '𐤌', yeshayahu: '𐤉', yirmeyahu: '𐤉',
    yehezkel: '𐤉', 'the-twelve': '𐤕', tehillim: '𐤕', mishlei: '𐤌', iyov: '𐤀',
    'shir-hashirim': '𐤔', rut: '𐤓', eikhah: '𐤀', kohelet: '𐤒', daniel: '𐤃',
    'ezra-nechemyah': '𐤀', 'divrei-hayamim': '𐤃'
  };

  function renderBooksProgress(books, progress) {
    var progressById = {};
    (progress || []).forEach(function(item) {
      if (item.book && item.book.id) progressById[item.book.id] = item;
    });
    // MAX_PROGRESS_BOOKS = 0: корпус книг — 112 МБ, он не читается на старте.
    // Но подпись «Не начата» вводила в заблуждение: книги прочитаны, статус
    // просто не загружался. Показываем честное состояние и подсказку.
    var progressLoaded = MAX_PROGRESS_BOOKS > 0;
    var cards = (books || []).map(function(book) {
      var item = progressById[book.id] || { status: 'loading', verses: [], percent: 0 };
      var verses = item.verses || [];
      var status = !progressLoaded ? 'Корпус не загружен' :
        item.status === 'completed' ? (verses.length + '/' + verses.length + ' стихов') :
        item.status === 'in-progress' ? 'В процессе' :
        item.status === 'not-started' ? 'Не начата' : 'Данные загружаются…';
      var modifier = !progressLoaded ? 'not-started' :
        item.status === 'completed' ? 'completed' :
        item.status === 'in-progress' ? 'in-progress' :
        item.status === 'not-started' ? 'not-started' : 'loading';
      var label = 'Открыть книгу «' + (book.ru || book.id) + '»';
      return '<button type="button" class="book-card book-card--' + modifier + '" data-book-id="' + esc(book.id) + '" aria-label="' + esc(label) + '">' +
        '<span class="book-card-icon" lang="hbo" aria-hidden="true">' + esc(paleoBookIcons[book.id] || '𐤀') + '</span>' +
        '<span class="book-card-name">' + esc(book.ru || book.id) + '</span>' +
        '<span class="book-card-track" aria-hidden="true"><span class="book-card-fill" style="width:' + (item.percent || 0) + '%"></span></span>' +
        '<span class="book-card-status">' + esc(status) + '</span>' +
      '</button>';
    }).join('');
    var total = (books || []).length;
    var hint = progressLoaded ? '' :
      '<p class="dw-books-hint">Полный корпус книг — 112 МБ, поэтому прогресс не читается автоматически. ' +
      'Нажмите на книгу, чтобы открыть её в «Книгочтении».</p>';
    return renderCell('books', '03', 'Древо Книг', count(total, 'книга', 'книги', 'книг'),
      hint + '<div class="book-grid">' + (cards || '<div class="lab-alert lab-alert-info">Данные загружаются…</div>') + '</div>');
  }

  function bindDictClicks(container) {
    container.querySelectorAll('[data-dict-key]').forEach(function(el) {
      var go = function() {
        var key = el.getAttribute('data-dict-key');
        if (window.PageController && PageController.pageState && PageController.pageState.dictionaries) {
          PageController.pageState.dictionaries.key = key;
          PageController.pageState.dictionaries.query = '';
        }
        LabRouter.navigate('dictionaries');
      };
      el.addEventListener('click', go);
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  function bindBookClicks(container) {
    container.querySelectorAll('.book-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var bookId = card.getAttribute('data-book-id');
        if (window.LabRouter && bookId) LabRouter.navigate('scripture-reader', [], { book: bookId });
      });
    });
  }

  window.Dashboard = {
    init: init,
    reload: reload,
    renderCounters: renderCounters,
    getResearchMetrics: calculateResearchMetrics,
    getResearchActivity: collectResearchActivity,
    getCounterDeltas: calculateCounterDeltas,
    getCompletenessMap: calculateCompletenessMap
  };
  return window.Dashboard;
})();

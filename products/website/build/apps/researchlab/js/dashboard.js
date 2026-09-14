/**
 * dashboard.js — «Рабочий стол исследователя» (#dashboard)
 * Виджеты со статистикой, собранной из data/roots/roots.json, data/dictionaries.json,
 * data/exposures/index.json, data/heraldry/heraldry.json, data/qumran-books.json.
 */
const Dashboard = (function() {
  'use strict';

  var loaded = false;
  var reloading = false;
  // Dashboard needs a lightweight overview. Full scripture corpus is over 117 MB;
  // load books only in their dedicated route.
  var MAX_PROGRESS_BOOKS = 0;

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function fetchJson(path) {
    var forceReload = arguments.length > 1 && arguments[1];
    var requestPath = forceReload ? path + '?_reload=' + Date.now() : path;
    return fetch(requestPath, forceReload ? { cache: 'no-store' } : undefined).then(function(r) {
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

    loadData(false).then(function(data) {
      loaded = true;
      render(container, data);
    }).catch(function(err) {
      container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки статистики: ' + esc(err.message) + '</div>';
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
      renderCounters(data, dictEntries, totalTerms) +
      '<div class="dw-grid">' +
        renderActivityTicker(data.researches) +
        renderBooksProgress(data.qumranBooks, data.bookProgress) +
        renderMechanismsBars(dictEntries) +
        renderLatestResearches(data.researches) +
        renderResearchActivity(data.researches) +
        renderReliabilityContour(data.researches) +
        renderCompletenessMap(data.researches) +
        renderReviewQueue(data.researches) +
      '</div>';

    bindDictClicks(container);
    bindBookClicks(container);
    if (window.RevealObserver) window.RevealObserver.scan(container);
  }

  function renderCounters(data, dictEntries, totalTerms) {
    var deltas = calculateCounterDeltas(data.researches);
    var researchMetrics = calculateResearchMetrics(data.researches);
    var items = [
      { num: data.roots.length, label: 'Корней', delta: deltas.snapshot, href: '#root-dictionary' },
      { num: totalTerms, label: 'Терминов подмен', delta: deltas.snapshot, href: '#dictionaries' },
      { num: data.researches.length, label: 'Исследований', delta: deltas.researches, href: '#researches' },
      { num: dictEntries.length, label: 'Словарей', delta: deltas.snapshot, href: '#dictionaries' },
      { num: data.heraldry.length, label: 'Империй/гербов', delta: deltas.snapshot, href: '#heraldry' }
    ];
    return '<section class="dw-summary" aria-labelledby="dw-summary-title">' +
      '<div class="dw-summary-heading"><div><span class="dw-summary-kicker">Срез корпуса</span><h2 id="dw-summary-title">Сводка исследований</h2></div>' +
        '<span class="dw-summary-date">' + esc(researchMetrics.referenceDate ? 'Срез данных: ' + researchMetrics.referenceDate : 'Дата среза не указана') + '</span></div>' +
      '<div class="dw-summary-grid">' + items.map(function(item, i) {
        var tag = item.href ? 'a' : 'div';
        var href = item.href ? ' href="' + item.href + '"' : '';
        return '<' + tag + ' class="dw-summary-item' + (item.href ? ' dw-summary-item--link' : '') + '"' + href + ' style="--i:' + i + '">' +
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
    var snapshot = { kind: 'neutral', text: 'срез данных' };
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
    return '<div class="dw-counter-delta dw-counter-delta--' + esc(delta.kind) + '">' +
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
    return '<div class="dw-widget">' +
      '<h3>Движение исследований</h3>' +
      '<div class="dw-metric-grid">' +
        renderMetric('Новые · 7 дней', metrics.new7, 'new') +
        renderMetric('Обновлённые · 7 дней', metrics.updated7, 'updated') +
        renderMetric('Новые · 30 дней', metrics.new30, 'new') +
        renderMetric('Обновлённые · 30 дней', metrics.updated30, 'updated') +
      '</div>' +
      '<p class="dw-widget-note">' + esc(reference) + '</p>' +
    '</div>';
  }

  function renderReliabilityContour(researches) {
    var metrics = calculateResearchMetrics(researches);
    return '<div class="dw-widget">' +
      '<h3>Контур надёжности</h3>' +
      '<div class="dw-metric-grid">' +
        renderMetric('Проверено', metrics.verified, 'verified') +
        renderMetric('Требует проверки', metrics.needsReview, 'review') +
        renderMetric('Гипотезы', metrics.hypothesis, 'hypothesis') +
        renderMetric('Опубликовано', metrics.published, 'published') +
      '</div>' +
    '</div>';
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
    return '<div class="dw-widget dw-widget-wide">' +
      '<div class="dw-widget-heading"><h3>Карта полноты материалов</h3><strong class="dw-completeness-average">' + esc(map.average) + '% <span>средняя полнота</span></strong></div>' +
      '<div class="dw-completeness-list">' + (rows || '<div class="lab-alert lab-alert-info">Материалов пока нет.</div>') + '</div>' +
    '</div>';
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
    return '<div class="dw-widget">' +
      '<h3>Топ словарей подмен</h3>' +
      '<div class="dw-bars">' + bars + '</div>' +
    '</div>';
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
    return '<div class="dw-widget">' +
      '<h3>Последние разборы</h3>' +
      '<div class="dw-list">' + (items || '<div class="lab-alert lab-alert-info">Пока пусто.</div>') + '</div>' +
    '</div>';
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
      return '<div class="dw-widget dw-widget-wide"><h3>Живая лента активности</h3><div class="lab-alert lab-alert-info">Датированные события пока не зафиксированы.</div></div>';
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
    return '<div class="dw-widget dw-widget-wide">' +
      '<h3>Живая лента активности</h3>' +
      '<div class="dw-ticker" aria-label="Последние изменения исследований"><div class="dw-ticker-track">' + items + copies + '</div></div>' +
    '</div>';
  }

  function getReviewQueue(researches) {
    var requirements = [
      { label: 'тезис', hasValue: function(item) { return item.sections && item.sections.thesis; } },
      { label: 'исходный контур', hasValue: function(item) { return item.sections && item.sections.original; } },
      { label: 'сдвиг', hasValue: function(item) { return item.sections && item.sections.shift; } },
      { label: 'цепочка', hasValue: function(item) { return item.sections && Array.isArray(item.sections.transmissionChain) && item.sections.transmissionChain.length; } },
      { label: 'источники', hasValue: function(item) { return Array.isArray(item.sources) && item.sources.length; } },
      { label: 'корни', hasValue: function(item) { return Array.isArray(item.roots) && item.roots.length; } },
      { label: 'свидетельства', hasValue: function(item) { return item.sections && Array.isArray(item.sections.evidence) && item.sections.evidence.length; } },
      { label: 'реконструкция', hasValue: function(item) { return item.sections && item.sections.reconstruction; } }
    ];
    return (Array.isArray(researches) ? researches : []).filter(function(item) {
      return item.confidence === 'needs-review';
    }).map(function(item) {
      var missing = requirements.filter(function(requirement) { return !requirement.hasValue(item); }).map(function(requirement) { return requirement.label; });
      return {
        title: item.title || item.id || 'Материал без названия',
        slug: item.slug || item.id || '',
        updatedAt: parseDate(item.updatedAt) ? item.updatedAt : '',
        missing: missing
      };
    }).sort(function(a, b) {
      return b.missing.length - a.missing.length || String(b.updatedAt).localeCompare(String(a.updatedAt)) || String(a.title).localeCompare(String(b.title), 'ru');
    }).slice(0, 6);
  }

  function renderReviewQueue(researches) {
    var queue = getReviewQueue(researches);
    var items = queue.map(function(item) {
      var href = item.slug ? '#researches/case/' + encodeURIComponent(item.slug) : '#researches';
      return '<a class="dw-review-item" href="' + href + '">' +
        '<span class="dw-review-title">' + esc(item.title) + '</span>' +
        '<span class="dw-review-meta">' + esc(item.missing.length) + ' разрывов' + (item.updatedAt ? ' · ' + esc(item.updatedAt) : '') + '</span>' +
        '<span class="dw-review-missing">' + item.missing.map(function(label) { return '<span>' + esc(label) + '</span>'; }).join('') + '</span>' +
      '</a>';
    }).join('');
    return '<div class="dw-widget dw-widget-wide">' +
      '<h3>Очередь проверки</h3>' +
      '<p class="dw-widget-note">Материалы со статусом «требует проверки», где разорваны опоры разбора.</p>' +
      '<div class="dw-review-list">' + (items || '<div class="lab-alert lab-alert-info">Материалов, ожидающих проверки, нет.</div>') + '</div>' +
    '</div>';
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
    var cards = (books || []).map(function(book) {
      var item = progressById[book.id] || { status: 'loading', verses: [], percent: 0 };
      var verses = item.verses || [];
      var status = item.status === 'completed' ? (verses.length + '/' + verses.length + ' стихов') :
        item.status === 'in-progress' ? 'В процессе' :
        item.status === 'not-started' ? 'Не начата' : 'Данные загружаются…';
      var modifier = item.status === 'completed' ? 'completed' :
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
    return '<div class="dw-widget dw-widget-wide">' +
      '<h3>Древо Книг</h3>' +
      '<div class="book-grid" role="list">' + (cards || '<div class="lab-alert lab-alert-info">Данные загружаются…</div>') + '</div>' +
    '</div>';
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
    getReviewQueue: getReviewQueue,
    getCounterDeltas: calculateCounterDeltas,
    getCompletenessMap: calculateCompletenessMap
  };
  return window.Dashboard;
})();

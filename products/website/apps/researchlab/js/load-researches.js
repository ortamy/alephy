/**
 * load-researches.js — каталог и детальный просмотр библиотеки (#researches).
 * Данные: data/exposures/index.json (единая схема дела, см. tools/migrate-exposures.py).
 * Рендер карточек, досье и превью — через ExposureCase (js/modules/exposure-case.js),
 * так что каталог, страница дела и форма создания используют один и тот же шаблон.
 */
const LoadResearches = (function() {
  'use strict';

  var STORAGE_KEY = 'alephy_exposure_drafts';
  var VIEW_STORAGE_KEY = 'alephy_researches_view';
  var STATUS_DOTS = {
    verified: 'Проверено',
    'needs-review': 'Требует проверки',
    hypothesis: 'Гипотеза',
    disputed: 'Спорно'
  };
  var CONF_ORDER = { verified: 0, 'needs-review': 1, hypothesis: 2, disputed: 3 };
  var state = { query: '', category: 'all', confidence: 'all', activeSlug: '', view: 'cards', sort: 'date' };
  var items = [];

  function readView() {
    try {
      var view = localStorage.getItem(VIEW_STORAGE_KEY);
      return view === 'list' ? 'list' : 'cards';
    } catch (e) {
      return 'cards';
    }
  }

  function saveView(view) {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch (e) { /* приватный режим */ }
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : text;
    return d.innerHTML;
  }

  function generateId() {
    return 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  function readDrafts() {
    try {
      var drafts = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(drafts) ? drafts : [];
    } catch (e) {
      return [];
    }
  }

  function makeSlug(title, id) {
    var slug = String(title || '').toLowerCase()
      .replace(/[^\w\u0400-\u04ff]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || id;
  }

  function uniqueSlug(base, used) {
    var slug = base;
    var suffix = 2;
    while (used[slug]) {
      slug = base + '-draft-' + suffix;
      suffix += 1;
    }
    used[slug] = true;
    return slug;
  }

  // Приводит черновик редактора к схеме карточки каталога.
  function normalizeDraft(draft, slug) {
    var paleoImages = draft.paleoImages || draft.roots || '';
    var lossMap = draft.lossMap || '';
    var livingImage = draft.livingImage || '';
    var conclusion = draft.conclusion || draft.description || '';
    var content = [
      { heading: 'Палео-образы', body: paleoImages },
      { heading: 'Карта утрат', body: lossMap },
      { heading: 'Живой образ', body: livingImage },
      { heading: 'Вывод', body: conclusion }
    ].filter(function(section) { return section.body; });

    return {
      id: draft.id,
      slug: slug || draft.slug || makeSlug(draft.title, draft.id),
      title: draft.title || 'Без названия',
      summary: conclusion || livingImage || paleoImages,
      category: draft.category || 'other',
      tags: draft.hebrewKeyword ? [draft.hebrewKeyword] : [],
      sources: [],
      confidence: 'needs-review',
      status: 'draft',
      updatedAt: draft.updatedAt || draft.createdAt || '',
      createdAt: draft.createdAt || '',
      hebrewKeyword: draft.hebrewKeyword || '',
      paleoImages: paleoImages,
      lossMap: lossMap,
      livingImage: livingImage,
      conclusion: conclusion,
      sections: {
        thesis: conclusion || livingImage,
        original: { hebrew: draft.hebrewKeyword || '', paleo: paleoImages ? [paleoImages] : [] },
        shift: lossMap,
        content: content
      }
    };
  }

  function mergeDrafts(published) {
    var merged = (published || []).slice();
    var used = {};
    merged.forEach(function(item) { if (item.slug) used[item.slug] = true; });
    readDrafts().forEach(function(draft) {
      if (!draft || !draft.id) return;
      var base = draft.slug || makeSlug(draft.title, draft.id);
      var item = normalizeDraft(draft, uniqueSlug(base, used));
      var existing = merged.filter(function(entry) { return entry.id === item.id; })[0];
      if (existing) {
        merged[merged.indexOf(existing)] = item;
      } else {
        merged.push(item);
      }
    });
    return merged;
  }

  function openNewExposureModal() {
    if (typeof LabModal === 'undefined') {
      LabRouter.navigate('exposure-editor');
      return;
    }

    var body = '<form id="researches-quick-form" novalidate>' +
      '<label>Название дела<input id="quick-exposure-title" class="lab-input" type="text" required></label>' +
      '<label>Ключевое слово на иврите<input id="quick-exposure-hebrew" class="lab-input" type="text"></label>' +
      '<label>Палео-образы<textarea id="quick-exposure-paleo" class="lab-textarea" rows="3"></textarea></label>' +
      '<label>Карта утрат<textarea id="quick-exposure-loss" class="lab-textarea" rows="3"></textarea></label>' +
      '<label>Живой образ<textarea id="quick-exposure-living" class="lab-textarea" rows="3"></textarea></label>' +
      '<label>Вывод<textarea id="quick-exposure-conclusion" class="lab-textarea" rows="3"></textarea></label>' +
      '<div id="quick-exposure-error" class="lab-alert lab-alert-error" hidden></div>' +
      '</form>';
    var footer = '<button type="button" class="lab-btn lab-btn-primary" id="quick-exposure-save">Сохранить как черновик</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary" id="quick-exposure-close">Закрыть</button>';

    LabModal.show('Новое дело', body, footer);

    var form = document.getElementById('researches-quick-form');
    var saveBtn = document.getElementById('quick-exposure-save');
    var closeBtn = document.getElementById('quick-exposure-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { LabModal.close(); });
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); });
    if (saveBtn) saveBtn.addEventListener('click', function() {
      var title = document.getElementById('quick-exposure-title').value.trim();
      var error = document.getElementById('quick-exposure-error');
      if (!title) {
        error.textContent = 'Укажите название дела.';
        error.hidden = false;
        document.getElementById('quick-exposure-title').focus();
        return;
      }

      var id = generateId();
      var now = new Date().toISOString();
      var draft = {
        id: id,
        slug: makeSlug(title, id),
        title: title,
        category: 'other',
        description: document.getElementById('quick-exposure-conclusion').value.trim(),
        sections: [],
        roots: document.getElementById('quick-exposure-paleo').value.trim(),
        sources: '',
        confidence: 'medium',
        status: 'draft',
        updatedAt: now,
        createdAt: now,
        hebrewKeyword: document.getElementById('quick-exposure-hebrew').value.trim(),
        paleoImages: document.getElementById('quick-exposure-paleo').value.trim(),
        lossMap: document.getElementById('quick-exposure-loss').value.trim(),
        livingImage: document.getElementById('quick-exposure-living').value.trim(),
        conclusion: document.getElementById('quick-exposure-conclusion').value.trim()
      };
      draft.sections = [
        { title: 'Ключевое слово на иврите', content: draft.hebrewKeyword },
        { title: 'Палео-образы', content: draft.paleoImages },
        { title: 'Карта утрат', content: draft.lossMap },
        { title: 'Живой образ', content: draft.livingImage },
        { title: 'Вывод', content: draft.conclusion }
      ].filter(function(section) { return section.content; });

      var drafts = readDrafts();
      drafts.push(draft);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      } catch (e) {
        error.textContent = 'Не удалось сохранить черновик в localStorage.';
        error.hidden = false;
        return;
      }

      items = items.filter(function(item) { return item.id !== draft.id; });
      var used = {};
      items.forEach(function(item) { if (item.slug) used[item.slug] = true; });
      items.push(normalizeDraft(draft, uniqueSlug(draft.slug, used)));
      LabModal.close();
      state.activeSlug = '';
      renderPage(document.getElementById('researches'));
    });
  }

  function render(container, parsed) {
    state.view = readView();
    state.sort = 'date';
    state.activeSlug = (parsed && parsed.segments && parsed.segments[1] === 'case') ? decodeURIComponent(parsed.segments[2] || '') : '';
    if (parsed && parsed.params) {
      if (parsed.params.q != null) state.query = parsed.params.q;
      if (parsed.params.category) state.category = parsed.params.category;
      if (parsed.params.confidence) state.confidence = parsed.params.confidence;
      if (parsed.params.view === 'list' || parsed.params.view === 'cards') state.view = parsed.params.view;
      if (['date', 'title', 'status'].indexOf(parsed.params.sort) !== -1) state.sort = parsed.params.sort;
    }

    if (items.length) {
      renderPage(container);
      return;
    }
    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка материалов библиотеки...</div></div>';
    fetch('data/exposures/index.json')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(list) {
        items = mergeDrafts(list || []);
        renderPage(container);
      })
      .catch(function(err) {
        container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить материалы библиотеки: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function renderPage(container) {
    if (state.activeSlug) {
      renderDetail(container);
    } else {
      renderList(container);
    }
  }

  function getCategories() {
    var seen = {};
    items.forEach(function(item) { if (item.category) seen[item.category] = true; });
    return Object.keys(seen).sort();
  }

  function getFiltered() {
    var query = state.query.trim().toLowerCase();
    return items.filter(function(item) {
      if (state.category !== 'all' && item.category !== state.category) return false;
      if (state.confidence !== 'all' && item.confidence !== state.confidence) return false;
      if (!query) return true;
      var sectionText = ((item.sections && item.sections.content) || []).map(function(s) {
        return [s.heading, s.body].join(' ');
      }).join(' ');
      var roots = Array.isArray(item.roots) ? item.roots.join(' ') : (item.roots || '');
      var haystack = [item.title, item.summary, item.category, item.hebrewKeyword, roots,
        (item.tags || []).join(' '), sectionText].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  // history.replaceState вместо LabRouter.navigate — иначе hashchange запускает
  // полный ре-рендер контейнера на каждое нажатие клавиши и сбивает фокус поиска.
  function updateHash() {
    var params = [];
    if (state.query) params.push('q=' + encodeURIComponent(state.query));
    if (state.category !== 'all') params.push('category=' + encodeURIComponent(state.category));
    if (state.confidence !== 'all') params.push('confidence=' + encodeURIComponent(state.confidence));
    if (state.view !== 'cards') params.push('view=' + state.view);
    if (state.sort !== 'date') params.push('sort=' + state.sort);
    var hash = '#researches' + (params.length ? '?' + params.join('&') : '');
    history.replaceState(null, '', hash);
  }

  // ===== Компактный архив: статус-точки, карточки, строки =====

  function confKey(item) {
    return STATUS_DOTS[item && item.confidence] ? item.confidence : 'needs-review';
  }

  function fmtDate(value) {
    return String(value || '').slice(0, 10);
  }

  function getTermsLite(item) {
    var values = [];
    ['keyTerms', 'terms', 'tags', 'roots'].forEach(function(key) {
      var value = item && item[key];
      if (Array.isArray(value)) values = values.concat(value);
      else if (value) values.push(value);
    });
    if (item && item.hebrewKeyword) values.push(item.hebrewKeyword);
    return values.map(function(v) { return typeof v === 'object' ? (v.term || v.root || v.name || '') : String(v); })
      .filter(Boolean)
      .filter(function(v, i, list) { return list.indexOf(v) === i; })
      .slice(0, 3);
  }

  function getSummaryLite(item) {
    var sections = item && item.sections || {};
    var content = Array.isArray(sections.content) ? sections.content : [];
    var source = item.summary || sections.thesis || (content[0] && content[0].body) || '';
    return String(source).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function sortList(list) {
    var copy = list.slice();
    if (state.sort === 'title') {
      copy.sort(function(a, b) { return String(a.title || '').localeCompare(String(b.title || ''), 'ru'); });
    } else if (state.sort === 'status') {
      copy.sort(function(a, b) {
        var d = CONF_ORDER[confKey(a)] - CONF_ORDER[confKey(b)];
        return d !== 0 ? d : String(a.title || '').localeCompare(String(b.title || ''), 'ru');
      });
    } else {
      copy.sort(function(a, b) {
        return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
      });
    }
    return copy;
  }

  function dotHtml(item) {
    var key = confKey(item);
    var label = STATUS_DOTS[key];
    return '<span class="res-dot res-dot-' + key + '" title="' + label + '" aria-label="Статус: ' + label + '"></span>';
  }

  function renderArchiveCard(item) {
    var terms = getTermsLite(item);
    return '<a class="exposure-card res-card" href="#researches/case/' + encodeURIComponent(item.slug) + '" data-slug="' + escapeHtml(item.slug) + '">' +
      '<div class="res-card-top">' +
        dotHtml(item) +
        (item.category ? '<span class="res-card-cat">' + escapeHtml(item.category) + '</span>' : '') +
        '<span class="res-card-date">' + escapeHtml(fmtDate(item.updatedAt || item.createdAt)) + '</span>' +
      '</div>' +
      '<div class="res-card-title">' + escapeHtml(item.title || '') + '</div>' +
      '<div class="res-card-summary">' + escapeHtml(getSummaryLite(item)) + '</div>' +
      (terms.length ? '<div class="res-card-terms">' + terms.map(function(t) {
        return '<span class="res-card-term">' + escapeHtml(t) + '</span>';
      }).join('') + '</div>' : '') +
    '</a>';
  }

  function renderArchiveRow(item) {
    return '<a class="res-row" href="#researches/case/' + encodeURIComponent(item.slug) + '" data-slug="' + escapeHtml(item.slug) + '">' +
      dotHtml(item) +
      '<span class="res-row-title">' + escapeHtml(item.title || '') + '</span>' +
      '<span class="res-row-cat">' + escapeHtml(item.category || '') + '</span>' +
      '<span class="res-row-date">' + escapeHtml(fmtDate(item.updatedAt || item.createdAt)) + '</span>' +
    '</a>';
  }

  function renderResults(list) {
    if (!list.length) {
      return '<div class="res-empty">' +
        '<span class="res-empty-glyph" aria-hidden="true">𐤀</span>' +
        '<p class="res-empty-text">Ничего не найдено по текущим фильтрам.</p>' +
        '<button type="button" class="lab-btn lab-btn-secondary" id="researches-reset">Сбросить фильтры</button>' +
      '</div>';
    }
    var sorted = sortList(list);
    if (state.view === 'list') {
      return '<div class="res-list">' + sorted.map(renderArchiveRow).join('') + '</div>';
    }
    return '<div class="exposure-grid">' + sorted.map(function(item) {
      return renderArchiveCard(item).replace('<a class="exposure-card res-card"', '<a class="exposure-card res-card reveal"');
    }).join('') + '</div>';
  }

  function itemIndex() {
    var index = {};
    items.forEach(function(item) { if (item.slug) index[item.slug] = item; });
    return index;
  }

  function renderConfidenceChips() {
    var order = ['all', 'verified', 'needs-review', 'hypothesis', 'disputed'];
    var labels = { all: 'Все' };
    order.slice(1).forEach(function(key) { labels[key] = ExposureCase.confidenceMeta(key).label; });
    return '<div class="exposure-chips" id="researches-confidence-chips">' + order.map(function(key) {
      return '<button type="button" class="exposure-chip' + (state.confidence === key ? ' active' : '') + '" data-confidence="' + key + '">' + escapeHtml(labels[key]) + '</button>';
    }).join('') + '</div>';
  }

  function renderList(container) {
    container._labHeroOverride = null;
    var categories = getCategories();
    var options = categories.map(function(cat) {
      return '<option value="' + escapeHtml(cat) + '"' + (cat === state.category ? ' selected' : '') + '>' + escapeHtml(cat) + '</option>';
    }).join('');
    var filtered = getFiltered();

    var sortLabels = { date: 'По дате', title: 'По названию', status: 'По статусу' };
    var sortOptions = ['date', 'title', 'status'].map(function(key) {
      return '<option value="' + key + '"' + (state.sort === key ? ' selected' : '') + '>' + sortLabels[key] + '</option>';
    }).join('');

    container.innerHTML = '<div class="res-toolbar">' +
      '<div class="res-toolbar-row">' +
        '<input id="researches-search" class="lab-input res-search" type="search" placeholder="Поиск по делам…" aria-label="Поиск по делам" value="' + escapeHtml(state.query) + '">' +
        '<select id="researches-category" class="lab-input res-select" aria-label="Категория"><option value="all">Все категории</option>' + options + '</select>' +
        '<button type="button" class="lab-btn lab-btn-primary res-new-btn" id="researches-new-btn"><i data-lucide="plus" class="lab-icon" aria-hidden="true"></i>Дело</button>' +
      '</div>' +
      '<div class="res-toolbar-row res-toolbar-row--secondary">' +
        renderConfidenceChips() +
        '<div class="res-toolbar-right">' +
          '<span class="research-meta"><strong>' + filtered.length + ' из ' + items.length + '</strong></span>' +
          '<select id="researches-sort" class="lab-input res-select res-select--sort" aria-label="Сортировка">' + sortOptions + '</select>' +
          '<div class="res-view-toggle" role="group" aria-label="Вид каталога">' +
            '<button type="button" class="res-view-btn' + (state.view === 'cards' ? ' active' : '') + '" data-view="cards" aria-label="Карточки"><i data-lucide="layout-grid" aria-hidden="true"></i></button>' +
            '<button type="button" class="res-view-btn' + (state.view === 'list' ? ' active' : '') + '" data-view="list" aria-label="Список"><i data-lucide="list" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="researches-results">' + renderResults(filtered) + '</div>';

    bindListEvents(container);
  }

  function bindListEvents(container) {
    var search = document.getElementById('researches-search');
    var category = document.getElementById('researches-category');
    var results = document.getElementById('researches-results');
    var meta = container.querySelector('.research-meta strong');
    var newBtn = document.getElementById('researches-new-btn');
    var chipsWrap = document.getElementById('researches-confidence-chips');
    var sortSelect = document.getElementById('researches-sort');
    var viewToggle = container.querySelector('.res-view-toggle');

    function update() {
      state.query = search.value || '';
      state.category = category.value;
      var list = getFiltered();
      if (meta) meta.textContent = list.length + ' из ' + items.length;
      results.innerHTML = renderResults(list);
      updateHash();
    }

    function refreshAll() {
      saveView(state.view);
      renderList(container);
    }

    if (results) results.addEventListener('click', function(e) {
      var reset = e.target.closest('#researches-reset');
      if (reset) {
        state.query = '';
        state.category = 'all';
        state.confidence = 'all';
        renderList(container);
        return;
      }
      var card = e.target.closest('[data-slug]');
      if (!card) return;
      e.preventDefault();
      var slug = card.getAttribute('data-slug');
      if (!slug) return;
      state.activeSlug = slug;
      history.replaceState(null, '', '#researches/case/' + encodeURIComponent(slug));
      renderDetail(container);
    });

    if (search) search.addEventListener('input', update);
    if (category) category.addEventListener('change', update);
    if (newBtn) newBtn.addEventListener('click', openNewExposureModal);
    if (sortSelect) sortSelect.addEventListener('change', function() {
      state.sort = this.value;
      refreshAll();
    });
    if (viewToggle) viewToggle.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-view]');
      if (!btn || btn.getAttribute('data-view') === state.view) return;
      state.view = btn.getAttribute('data-view');
      refreshAll();
    });
    if (chipsWrap) chipsWrap.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-confidence]');
      if (!btn) return;
      state.confidence = btn.getAttribute('data-confidence');
      chipsWrap.querySelectorAll('.exposure-chip').forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      update();
    });
  }

  function renderDetail(container) {
    var item = items.filter(function(i) { return i.slug === state.activeSlug; })[0];
    if (!item) {
      container._labHeroOverride = null;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Дело «' + escapeHtml(state.activeSlug) + '» не найдено.</div>';
      return;
    }
    history.replaceState(null, '', '#researches/case/' + encodeURIComponent(item.slug));
    container.innerHTML = ExposureCase.renderCase(item, { relatedItems: itemIndex() });
    ExposureCase.bindCase(container, item);

    // Шапка модуля собирается из данных активного дела.
    if (window.LabHero && window.LabHero.setView) {
      var confidence = ExposureCase.confidenceMeta(item.confidence);
      container._labHeroOverride = {
        kicker: 'АЛЕФИ · ИССЛЕДОВАНИЯ',
        title: item.title || '',
        subtitle: (item.category || ''),
        icon: 'scribe/scroll.png',
        meta: [{ label: confidence.label, className: confidence.className }]
      };
      window.LabHero.setView('researches', 'detail', container._labHeroOverride);
      if (window.LabRouter) LabRouter.renderBreadcrumbs('researches', LabRouter.parseHash());
    }
  }

  function routeTitle(route) {
    var segments = String(route || '').split('/');
    if (route === 'researches') return 'Исследования';
    if (segments[0] === 'researches' && segments[1] === 'case' && segments[2]) {
      var item = items.filter(function(entry) { return entry.slug === decodeURIComponent(segments[2]); })[0];
      return item ? item.title : 'Исследование';
    }
    return '';
  }

  window.LoadResearches = { render: render, routeTitle: routeTitle };
  return window.LoadResearches;
})();

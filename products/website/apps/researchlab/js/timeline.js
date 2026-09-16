/**
 * timeline.js — Палео-таймлайн (каталог хронологических лент)
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

  function renderCatalog(container, timelines) {
    // Возврат к базовой шапке модуля (например, по кнопке «назад» из детального экрана).
    // Override сбрасываем: applyModuleHero после applyRoute не должен подставлять
    // заголовок закрытого детального экрана.
    container._labHeroOverride = null;
    if (!timelines || !timelines.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Таймлайны пока не добавлены.</div>';
      if (window.LabHero && window.LabHero.setView) {
        window.LabHero.setView('timeline', null, (window.LabHero.views && window.LabHero.views.timeline) || {});
      }
      return;
    }

    // ROADMAP SCALE: ширина бара пропорциональна доле событий ленты —
    // честная шкала наполнения (count * 20 давал одинаковые 100% при 5+ событиях).
    var maxCount = timelines.reduce(function(max, tl) {
      return Math.max(max, tl.events ? tl.events.length : 0);
    }, 0);
    var roadmapHtml = '<div class="tl-roadmap" role="list" aria-label="Шкала таймлайнов">' +
      timelines.map(function(tl, idx) {
        var count = tl.events ? tl.events.length : 0;
        var activeClass = idx === 0 ? ' active' : '';
        var width = maxCount ? Math.round((count / maxCount) * 100) : 0;
        return '<div class="tl-roadmap-segment' + activeClass + '" data-tl-id="' + escapeHtml(tl.id) + '" role="listitem" tabindex="0" aria-label="' + escapeHtml(tl.title) + '" style="--tl-index:' + idx + '">' +
          '<div class="tl-roadmap-bar"><div class="tl-roadmap-bar-fill" style="width:' + width + '%"></div></div>' +
          '<span class="tl-roadmap-label">' + escapeHtml(tl.title) + '</span>' +
          '<span class="tl-roadmap-count">' + count + '</span>' +
        '</div>';
      }).join('') +
    '</div>';

    // FILTER CHIPS: чипы строятся из эр, найденных в данных (era), а не из хардкода ID.
    var eraCounts = {};
    timelines.forEach(function(tl) {
      var era = ERAS[tl.era] ? tl.era : 'concept';
      eraCounts[era] = (eraCounts[era] || 0) + 1;
    });
    var filtersHtml = '<div class="tl-filters" role="tablist" aria-label="Фильтры таймлайнов">' +
      '<button class="tl-filter-chip active" data-filter="all" role="tab" aria-selected="true">Все<span class="chip-count">' + timelines.length + '</span></button>' +
      Object.keys(ERAS).filter(function(era) { return eraCounts[era]; }).map(function(era) {
        return '<button class="tl-filter-chip" data-filter="' + era + '" role="tab" aria-selected="false">' + ERAS[era] +
          '<span class="chip-count">' + eraCounts[era] + '</span></button>';
      }).join('') +
    '</div>';

    var catalogHtml = timelines.map(function(tl) {
      var count = tl.events ? tl.events.length : 0;

      var events = sortedEvents(tl);
      var visibleEvents = events.slice(0, 3);
      var hiddenEvents = events.slice(3);
      var eventMarkup = function(ev, hidden) {
          return '' +
            '<div class="timeline-event-row' + (hidden ? ' event-card-hidden' : '') + '"' + (hidden ? ' hidden' : '') + '>' +
              '<span class="timeline-date">' + escapeHtml(ev.date) + '</span>' +
              '<span class="timeline-title">' + escapeHtml(ev.title) + '</span>' +
            '</div>';
      };
      var eventsHtml = visibleEvents.map(function(ev) { return eventMarkup(ev, false); }).join('') +
        hiddenEvents.map(function(ev) { return eventMarkup(ev, true); }).join('');
      var moreHtml = hiddenEvents.length
        ? '<button class="tl-show-all" type="button" aria-expanded="false">… показать все (ещё ' + hiddenEvents.length + ')</button>'
        : '';

      return '' +
        '<article class="tl-container" data-timeline-id="' + escapeHtml(tl.id) + '" tabindex="0" role="button" aria-label="Открыть таймлайн: ' + escapeHtml(tl.title) + '">' +
          '<div class="tl-container-header">' +
            '<div class="tl-header-left">' +
              '<span class="tl-container-icon" lang="hbo" aria-hidden="true">' + escapeHtml(tl.paleoIcon) + '</span>' +
              '<h2 class="tl-container-title">' + escapeHtml(tl.title) + '</h2>' +
            '</div>' +
            '<div class="tl-header-right">' +
              '<span class="tl-container-chip">• ' + count + ' ' + pluralize(count, 'событие', 'события', 'событий') + '</span>' +
            '</div>' +
          '</div>' +
          '<p class="tl-container-description">' + escapeHtml(tl.description || '') + '</p>' +
          '<div class="tl-event-list">' +
            eventsHtml +
          '</div>' +
          moreHtml +
          '<div class="tl-container-footer">' +
            '<span class="tl-container-meta">' + escapeHtml(ERAS[tl.era] || 'Хронология') + '</span>' +
            '<button class="tl-container-btn" type="button" title="Открыть таймлайн">Открыть</button>' +
          '</div>' +
        '</article>';
    }).join('');

    // Шапку рисует LabHero — ПОСЛЕ innerHTML: присвоение container.innerHTML
    // стирает секцию .lab-hero, и вызов setView до него терялся (hero
    // пересоздавался scan-ом из базового конфига каталога).
    container.innerHTML = roadmapHtml + filtersHtml + '<div class="tl-catalog">' + catalogHtml + '</div>';
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('timeline', null, (window.LabHero.views && window.LabHero.views.timeline) || {});
    }

    // Обработчики roadmap segments
    var segments = container.querySelectorAll('.tl-roadmap-segment');
    segments.forEach(function(seg) {
      seg.addEventListener('click', function() {
        var tlId = seg.getAttribute('data-tl-id');
        if (tlId) location.hash = '#timeline/' + tlId;
      });
      seg.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var tlId = seg.getAttribute('data-tl-id');
          if (tlId) location.hash = '#timeline/' + tlId;
        }
      });
    });

    // Обработчики filter chips
    var chips = container.querySelectorAll('.tl-filter-chip');
    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        chips.forEach(function(c) { c.classList.remove('active'); c.setAttribute('aria-selected', 'false'); });
        chip.classList.add('active');
        chip.setAttribute('aria-selected', 'true');
        var filter = chip.getAttribute('data-filter');
        applyFilter(container, timelines, filter);
      });
    });
  }

  // Фильтр по эре из данных: показываем ленты, у которых tl.era совпадает с чипом.
  function applyFilter(container, timelines, filter) {
    var catalog = container.querySelector('.tl-catalog');
    if (!catalog) return;
    var eraById = {};
    timelines.forEach(function(tl) { eraById[tl.id] = tl.era; });
    var items = catalog.querySelectorAll('.tl-container');
    items.forEach(function(item) {
      var tlId = item.getAttribute('data-timeline-id');
      var era = tlId ? eraById[tlId] : null;
      item.style.display = (filter === 'all' || era === filter) ? '' : 'none';
    });
    bindCatalogEvents(container);
  }

  function bindCatalogEvents(container) {
    container.querySelectorAll('.tl-container').forEach(function(card) {
      // Навигация через hash: детальный экран становится deep-link-able.
      var open = function() {
        location.hash = '#timeline/' + card.getAttribute('data-timeline-id');
      };
      card.addEventListener('click', function(event) {
        if (event.target.closest('button')) return;
        open();
      });
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
      var button = card.querySelector('.tl-container-btn');
      if (button) button.addEventListener('click', function(event) {
        event.stopPropagation();
        open();
      });
      var showAll = card.querySelector('.tl-show-all');
      if (showAll) showAll.addEventListener('click', function(event) {
        event.stopPropagation();
        var expanded = this.getAttribute('aria-expanded') === 'true';
        card.querySelectorAll('.event-card-hidden').forEach(function(eventCard) {
          eventCard.hidden = expanded;
        });
        this.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        this.textContent = expanded ? '… показать все (ещё ' + card.querySelectorAll('.event-card-hidden').length + ')' : 'свернуть события';
      });
    });
  }

  function renderDetail(timelineId, focusIdx) {
    var timeline = timelineItems.filter(function(item) {
      return item.id === timelineId;
    })[0];
    if (!timeline || !timelineContainer) return;

    var eventsHtml = sortedEvents(timeline).map(function(event, index) {
      return renderEventRow(event, index, timeline.id);
    }).join('');

    // Шапку детального экрана рисует LabHero. Внутри — back-ссылка,
    // мета-строка и события. Кнопка «назад» ведёт к каталогу (renderCatalog
    // восстанавливает базовую шапку LabHero).
    timelineContainer.innerHTML =
      '<section class="tl-detail" aria-label="Таймлайн: ' + escapeHtml(timeline.title) + '">' +
        '<button class="tl-detail-back" type="button">Каталог таймлайнов</button>' +
        '<div class="tl-detail-meta tl-meta-line">' +
          '<span class="tl-detail-glyph" lang="hbo" aria-hidden="true">' + escapeHtml(timeline.paleoIcon) + '</span>' +
          '<span class="meta-sep">·</span>' +
          '<span>' + (timeline.events || []).length + ' ' + pluralize((timeline.events || []).length, 'событие', 'события', 'событий') + '</span>' +
        '</div>' +
        (isDatedTimeline(timeline) ? compareLaunchHtml(timeline.id) : '') +
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

    // Deep-link на событие: подсветка и прокрутка к строке (#timeline/<id>/event/<idx>).
    if (typeof focusIdx === 'number') {
      var focusTarget = timelineContainer.querySelector('.tl-detail-event[data-event-idx="' + focusIdx + '"]');
      if (focusTarget) {
        focusTarget.classList.add('tl-event-highlight');
        var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        focusTarget.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }

    var backButton = timelineContainer.querySelector('.tl-detail-back');
    if (backButton) backButton.addEventListener('click', function() {
      // Возврат через hash — роутер сам вызовет renderCatalog (applyRoute).
      location.hash = '#timeline';
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
          var shareUrl = location.origin + location.pathname + '#timeline/' + timeline.id + '/event/' + eventIdx;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(function() {
              showToast('Ссылка скопирована');
            }).catch(function() {
              fallbackCopy(shareUrl);
            });
          } else {
            fallbackCopy(shareUrl);
          }
        }
      });
    });
  }

  // ===== СРАВНЕНИЕ ЛЕНТ (#timeline/compare/<idA>/<idB>) =====
  // Доступны только датированные ленты: сравнение строится по sortKey.
  function isDatedTimeline(tl) {
    var ev = tl.events || [];
    return ev.length > 0 && ev.every(function(e) { return typeof e.sortKey === 'number'; });
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
      location.hash = '#timeline/' + idA;
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

  function applyRoute(parsed) {
    if (!timelineContainer || !timelineItems.length) return;
    var segments = (parsed && parsed.segments) || [];
    // Сравнение лент: #timeline/compare/<idA>/<idB>
    if (segments[1] === 'compare') {
      renderCompare(segments[2], segments[3]);
      return;
    }
    var detailId = segments[1];
    var exists = detailId && timelineItems.some(function(t) { return t.id === detailId; });
    if (!exists) {
      renderCatalog(timelineContainer, timelineItems);
      return;
    }
    // Deep-link на событие: #timeline/<id>/event/<idx>
    var eventIdx = null;
    if (segments[2] === 'event' && segments[3] != null && segments[3] !== '') {
      var parsedIdx = parseInt(segments[3], 10);
      if (!isNaN(parsedIdx)) eventIdx = parsedIdx;
    }
    renderDetail(detailId, eventIdx);
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
    var named = timelineItems.filter(function(t) { return t.id === parts[1]; })[0];
    if (!named) return '';
    if (parts[2] === 'event' && parts[3] != null && parts[3] !== '') {
      var ev = sortedEvents(named)[parseInt(parts[3], 10)];
      return ev && ev.title ? ev.title : named.title;
    }
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
      location.hash = '#timeline/' + item.id;
    } else if (item.type === 'event') {
      location.hash = '#timeline/' + item.parentId;
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

/**
 * paleo-linguistics.js — модуль «Палео-лингвистика»
 *
 * Эволюция алфавитов: прото-ханаанский > палео-еврейский > финикийский.
 * Маршруты: #paleo-linguistics, #paleo-linguistics/<language-id>
 *
 * Внутренняя страница языка собрана на бенто-каркасе (.pl-bento, 12 колонок)
 * по канону дизайн-системы §5.2f — тем же приёмом, что .sr-bento и .wab-cell:
 * рельс слева (идентификация + разделы), рабочая область справа.
 */

const PaleoLinguistics = (function() {
  'use strict';

  const COMPARE_KEY = 'alephy_pl_compare';
  let languages = [];
  let letters = [];
  let langCache = {};
  let dataPromise = null;
  let currentLang = null;
  let currentTab = 'alphabet';
  let routeVersion = 0;

  function escapeHtml(text) {
    // Канон в js/utils.js. Файл правим вручную: в нём был байт cp1251 (0x97)
    // в комментарии, и массовая перекодировка его обнуляла.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  // В названии языка есть хвост в скобках («Арабский (старый абджад)»):
  // в карточке каталога он разбивал одну строку на три, поэтому убираем.
  function cardLanguageName(name) {
    return String(name == null ? '' : name).replace(/\s*\([^)]*\)/g, '').trim();
  }

  function dataPath(name) {
    return new URL('data/paleo-linguistics/' + name, document.baseURI).href;
  }

  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  // ===== КАТАЛОГ ЯЗЫКОВ: ПОИСК, ФИЛЬТР, ВИД =====
  var LANG_VIEW_KEY = 'alephy_pl_view';
  var LANG_SOURCES = [
    { value: 'all', label: 'Все источники алфавита' },
    { value: 'letters', label: 'Общий реестр знаков' },
    { value: 'own', label: 'Собственный алфавит' }
  ];
  var langCatalog = {
    query: '',
    source: 'all',
    view: read(LANG_VIEW_KEY, 'cards') === 'list' ? 'list' : 'cards',
    items: []
  };

  /* Источник алфавита читаем из данных, а не вводим новую классификацию:
     own_alphabet — своя таблица знаков языка, alphabet_ref — общий
     реестр лаборатории (см. data/paleo-linguistics/*.json). */
  function langSourceKey(lang) {
    if (!lang) return 'letters';
    if (lang.own_alphabet) return 'own';
    if (lang.alphabet_ref) return String(lang.alphabet_ref);
    return 'letters';
  }

  function langSourceLabel(lang) {
    var key = langSourceKey(lang);
    var found = LANG_SOURCES.filter(function(item) { return item.value === key; })[0];
    return found ? found.label : 'Общий реестр знаков';
  }

  function langSearchText(lang) {
    return [lang && lang.name, lang && lang.role, lang && lang.period, lang && lang.script]
      .join(' ').toLowerCase();
  }

  function langFiltersActive() {
    return langCatalog.source !== 'all' || String(langCatalog.query || '').trim() !== '';
  }

  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (error) { /* иконки не критичны */ }
    }
  }

  // Метаданные языка из реестра languages.json (иконка, имя файла).
  function langMeta(langId) {
    return languages.filter(function(l) { return l.id === langId; })[0] || {};
  }

  // ===== ТОЧКА ВХОДА =====
  function init(parsed) {
    var container = document.getElementById('paleo-linguistics');
    if (!container) return;
    var version = ++routeVersion;

    loadCore().then(function() {
      route(container, parsed, version);
    }).catch(function(error) {
      if (version !== routeVersion) return;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить данные: ' + escapeHtml(error.message) + '</div>';
    });
  }

  // ===== МАРШРУТИЗАЦИЯ ВНУТРИ МОДУЛЯ =====
  // #paleo-linguistics — каталог языков
  // #paleo-linguistics/<lang-id> — внутренняя страница языка
  function isCurrentRoute(langId) {
    var hash = window.location.hash.replace(/^#/, '').split('?')[0].split('/');
    return hash[0] === 'paleo-linguistics' && (langId ? hash[1] === langId : !hash[1]);
  }

  function route(container, parsed, version) {
    version = version || ++routeVersion;
    var segId = parsed && parsed.segments && parsed.segments[1];
    if (segId) {
      showLanguage(container, segId, version);
    } else {
      renderLangGrid(container, version);
    }
  }
// ===== ЗАГРУЗКА ДАННЫХ (кеш на сессию + сброс при ошибке) =====
  function loadCore() {
    if (languages.length && letters.length) return Promise.resolve();
    if (dataPromise) return dataPromise;

    dataPromise = Promise.all([
      fetch(dataPath('languages.json')).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' (languages.json)');
        return r.json();
      }),
      fetch(dataPath('evolution.json')).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' (evolution.json)');
        return r.json();
      })
    ]).then(function(results) {
      languages = results[0];
      letters = results[1];
    }).catch(function(err) {
      dataPromise = null;
      throw err;
    });

    return dataPromise;
  }

  function loadLanguage(entry) {
    if (langCache[entry.id]) return Promise.resolve(langCache[entry.id]);
    return fetch(dataPath(entry.file)).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' (' + entry.file + ')');
      return r.json();
    }).then(function(data) {
      langCache[entry.id] = data;
      return data;
    });
  }

  // ===== КАТАЛОГ ЯЗЫКОВ =====
  function renderLangGrid(container, version) {
    Promise.all(languages.map(loadLanguage)).then(function(metas) {
      if (version !== routeVersion || !isCurrentRoute()) return;
      langCatalog.items = metas;
      renderLangCatalog(container);
    }).catch(function(error) {
      if (version !== routeVersion || !isCurrentRoute()) return;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки языков: ' + escapeHtml(error.message) + '</div>';
    });
  }

  function visibleLangs() {
    var query = String(langCatalog.query || '').trim().toLowerCase();
    return langCatalog.items.filter(function(lang) {
      if (langCatalog.source !== 'all' && langSourceKey(lang) !== langCatalog.source) return false;
      if (!query) return true;
      return langSearchText(lang).indexOf(query) !== -1;
    });
  }

  function langToolbarMarkup(shown) {
    var listView = langCatalog.view === 'list';
    var options = LANG_SOURCES.map(function(item) {
      return '<option value="' + item.value + '"' + (item.value === langCatalog.source ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>';
    }).join('');

    return '<div class="lab-toolbar" role="search" aria-label="Управление каталогом языков">' +
        '<input type="search" class="lab-input lab-toolbar-search" id="pl-lang-search" autocomplete="off" placeholder="Поиск по языкам, эпохам, письму…" aria-label="Поиск по языкам" value="' + escapeHtml(langCatalog.query) + '">' +
        '<div class="lab-toolbar-group" role="group" aria-label="Фильтры каталога">' +
          '<select id="pl-lang-source" class="lab-input lab-toolbar-select' + (langCatalog.source !== 'all' ? ' is-filtered' : '') + '" aria-label="Источник алфавита">' + options + '</select>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-reset" id="pl-lang-reset" title="Сбросить фильтры" aria-label="Сбросить фильтры"' + (langFiltersActive() ? '' : ' hidden') + '><i data-lucide="rotate-ccw" class="lab-icon" aria-hidden="true"></i></button>' +
        '</div>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count" aria-live="polite"><strong>' + shown + '</strong> из ' + langCatalog.items.length + '</span>' +
          '<div class="lab-toolbar-segment" role="group" aria-label="Вид каталога">' +
            '<button type="button" class="res-view-btn' + (listView ? '' : ' active') + '" data-pl-lang-view="cards" aria-label="Карточки" title="Карточки" aria-pressed="' + (listView ? 'false' : 'true') + '"><i data-lucide="layout-grid" aria-hidden="true"></i></button>' +
            '<button type="button" class="res-view-btn' + (listView ? ' active' : '') + '" data-pl-lang-view="list" aria-label="Список" title="Список" aria-pressed="' + (listView ? 'true' : 'false') + '"><i data-lucide="list" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
function langCardsMarkup(items) {
    return items.map(function(lang, i) {
      // lab-card снят намеренно: класс тянет margin-bottom из redesign.css,
      // который перебивал margin:0 и оставлял коричневые полосы (см. §5.2e).
      var meta = langMeta(lang.id);
      return '<div class="pl-lang-card" data-id="' + escapeHtml(lang.id) + '" role="button" tabindex="0" aria-label="Открыть язык: ' + escapeHtml(cardLanguageName(lang.name)) + '" style="animation-delay:' + Math.min(i * 50, 350) + 'ms">' +
        '<div class="pl-lang-card-icon"><img src="assets/icons/32/' + escapeHtml(meta.icon) + '.png" width="32" height="32" alt="" onerror="this.style.display=\'none\'"></div>' +
        '<h2 class="pl-lang-title">' + escapeHtml(cardLanguageName(lang.name)) + '</h2>' +
        '<div class="pl-lang-role">' + escapeHtml(lang.role) + '</div>' +
        (lang.period ? '<div class="pl-lang-period">' + escapeHtml(lang.period) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function langBodyMarkup(shown) {
    if (!shown.length) return '<div class="lab-alert lab-alert-info">По запросу ничего не найдено.</div>';
    return '<div class="pl-lang-grid">' + langCardsMarkup(shown) + '</div>';
  }

  /* Перерисовывается только тело каталога: панель остаётся на месте,
     поэтому фокус и позиция каретки в поиске не «дёргаются» на вводе. */
  function refreshLangCatalog(container) {
    var body = container.querySelector('#pl-lang-body');
    if (!body) return renderLangCatalog(container);
    var shown = visibleLangs();
    body.classList.toggle('is-list', langCatalog.view === 'list');
    body.innerHTML = langBodyMarkup(shown);
    var count = container.querySelector('.lab-toolbar-count strong');
    if (count) count.textContent = String(shown.length);
    var reset = container.querySelector('#pl-lang-reset');
    if (reset) reset.hidden = !langFiltersActive();
    bindLangCards(container);
  }

  function renderLangCatalog(container) {
    var shown = visibleLangs();
    container.innerHTML = langToolbarMarkup(shown.length) +
      '<div id="pl-lang-body"' + (langCatalog.view === 'list' ? ' class="is-list"' : '') + '>' + langBodyMarkup(shown) + '</div>';
    bindLangCards(container);
    bindLangCatalogEvents(container);
    refreshIcons();
  }
function bindLangCards(container) {
    container.querySelectorAll('.pl-lang-card').forEach(function(card) {
      function openCard() {
        var id = card.getAttribute('data-id');
        if (!id) return;
        if (typeof LabRouter !== 'undefined') LabRouter.navigate('paleo-linguistics', [id]);
        route(container, { segments: ['paleo-linguistics', id] });
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

  function bindLangCatalogEvents(container) {
    var search = container.querySelector('#pl-lang-search');
    var source = container.querySelector('#pl-lang-source');
    var reset = container.querySelector('#pl-lang-reset');

    if (search) {
      search.addEventListener('input', function() {
        langCatalog.query = search.value;
        refreshLangCatalog(container);
      });
    }
    if (source) {
      source.addEventListener('change', function() {
        langCatalog.source = source.value;
        source.classList.toggle('is-filtered', source.value !== 'all');
        refreshLangCatalog(container);
      });
    }
    if (reset) {
      reset.addEventListener('click', function() {
        langCatalog.query = '';
        langCatalog.source = 'all';
        renderLangCatalog(container);
      });
    }
    container.querySelectorAll('[data-pl-lang-view]').forEach(function(button) {
      button.addEventListener('click', function() {
        langCatalog.view = button.getAttribute('data-pl-lang-view');
        write(LANG_VIEW_KEY, langCatalog.view);
        renderLangCatalog(container);
      });
    });
  }

  // ===== ВНУТРЕННЯЯ СТРАНИЦА ЯЗЫКА =====
  function showLanguage(container, langId, version) {
    var meta = langMeta(langId);
    if (!meta.id) {
      container.innerHTML = '<div class="lab-alert lab-alert-error">Язык «' + escapeHtml(langId) + '» не найден.</div>' +
        '<button class="lab-btn lab-btn-secondary pl-back-btn" type="button">← К каталогу языков</button>';
      var missBack = container.querySelector('.pl-back-btn');
      if (missBack) missBack.addEventListener('click', backToCatalog);
      return;
    }

    loadLanguage(meta).then(function(lang) {
      if (version !== routeVersion || !isCurrentRoute(langId)) return;
      currentLang = lang;
      currentTab = 'alphabet';
      container.innerHTML = renderLangPage(lang);
      // Шапка модуля подменяется на язык
      if (window.LabHero && window.LabHero.setView) {
        window.LabHero.setView('paleo-linguistics', 'detail', {
          kicker: 'АЛЕФИ · ПАЛЕО-ЛИНГВИСТИКА',
          title: lang.name,
          subtitle: lang.role || '',
          icon: 'scribe/scroll.png'
        });
      }
      bindLangPageEvents(container, lang);
    }).catch(function(error) {
      if (version !== routeVersion || !isCurrentRoute(langId)) return;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить язык: ' + escapeHtml(error.message) + '</div>';
    });
  }

  function backToCatalog() {
    if (typeof LabRouter !== 'undefined') LabRouter.navigate('paleo-linguistics');
  }
/* Бенто-каркас внутренней страницы: 12 колонок.
     Рельс (4) несёт идентификацию языка и вертикальную навигацию по разделам,
     рабочая область (8) — активную вкладку. Раньше шапка, вкладки и панель
     лежали одной вертикальной стопкой внутри общей карточки, и длинная полоса
     букв уезжала под шапку, оставляя справа пустое поле. */
  function renderLangPage(lang) {
    return '<div class="pl-lang-page">' +
      '<div class="pl-bento">' +
        '<div class="pl-rail">' +
          '<button class="lab-btn lab-btn-secondary lab-btn-sm pl-back-btn" type="button">← К каталогу языков</button>' +
          renderIdentityCell(lang) +
          renderSectionNav(lang) +
        '</div>' +
        '<div class="pl-main">' + renderTabPanels(lang) + '</div>' +
      '</div>' +
    '</div>';
  }

  /* Ячейка 01 — идентификация языка. Роль и письмо вынесены отдельными строками
     с подписью: раньше они слипались в одну строку через «·» и читались
     как одна длинная фраза без структуры. */
  function renderIdentityCell(lang) {
    return '<section class="pl-cell pl-cell--id">' +
        '<div class="pl-cell-head">' +
          '<span class="pl-num">01</span>' +
          '<span class="pl-cell-title">Язык</span>' +
        '</div>' +
        '<div class="pl-id-name">' +
          '<img src="assets/icons/32/' + escapeHtml(langMeta(lang.id).icon) + '.png" width="32" height="32" alt="" onerror="this.style.display=\'none\'">' +
          '<span>' + escapeHtml(cardLanguageName(lang.name)) + '</span>' +
        '</div>' +
        '<p class="pl-id-role">' + escapeHtml(lang.role) + '</p>' +
        '<dl class="pl-facts">' +
          '<div class="pl-fact"><dt>Эпоха</dt><dd>' + escapeHtml(lang.period) + '</dd></div>' +
          '<div class="pl-fact"><dt>Письмо</dt><dd>' + escapeHtml(lang.script) + '</dd></div>' +
          '<div class="pl-fact"><dt>Алфавит</dt><dd>' + escapeHtml(langSourceLabel(lang)) + '</dd></div>' +
        '</dl>' +
      '</section>';
  }

  /* Ячейка 02 — навигация по разделам с их размерами: пользователь до клика
     видит, сколько корней и текстов за этим разделом. */
  function renderSectionNav(lang) {
    var signs = lang.alphabet_mode === 'standalone' ? (lang.own_alphabet || []).length : letters.length;
    var tabs = [
      { id: 'alphabet', label: 'Алфавит', count: signs },
      { id: 'roots', label: 'Корни', count: (lang.common_roots || []).length },
      { id: 'texts', label: 'Тексты', count: (lang.texts || []).length },
      { id: 'grammar', label: 'Грамматика', count: lang.grammar ? 1 : 0 }
    ];
    return '<nav class="pl-cell pl-cell--nav" aria-label="Разделы языка">' +
        '<div class="pl-cell-head">' +
          '<span class="pl-num">02</span>' +
          '<span class="pl-cell-title">Разделы</span>' +
        '</div>' +
        tabs.map(function(tab) {
          return '<button type="button" class="pl-nav-item" data-tab="' + tab.id + '" aria-pressed="false">' +
            '<span class="pl-nav-label">' + escapeHtml(tab.label) + '</span>' +
            '<span class="pl-nav-count">' + tab.count + '</span>' +
          '</button>';
        }).join('') +
      '</nav>';
  }

  function renderTabPanels(lang) {
    return '<section class="pl-cell pl-cell--work" id="pl-tab-' + currentTab + '">' +
        '<div class="pl-cell-head">' +
          '<span class="pl-num">03</span>' +
          '<span class="pl-cell-title">' + escapeHtml(tabTitle(lang)) + '</span>' +
          '<span class="pl-cell-hint">' + escapeHtml(tabHint(lang)) + '</span>' +
        '</div>' +
        '<div class="pl-work-body">' + renderActiveTab(lang) + '</div>' +
      '</section>';
  }

  function tabTitle(lang) {
    if (currentTab === 'roots') return 'Корни';
    if (currentTab === 'texts') return 'Тексты';
    if (currentTab === 'grammar') return 'Грамматика';
    return lang.alphabet_mode === 'standalone' ? 'Собственный алфавит' : 'Алфавит и его формы';
  }

  function tabHint(lang) {
    if (currentTab === 'roots') return 'клик по строке открывает корень в «Словарях»';
    if (currentTab === 'texts') return 'клик по слову открывает разбор в «Анализаторе слов»';
    if (currentTab === 'grammar') return 'реконструкция по корпусу';
    return 'клик по знаку открывает его эволюцию';
  }

  function renderActiveTab(lang) {
    if (currentTab === 'roots') return renderRootsTab(lang);
    if (currentTab === 'texts') return renderTextsTab(lang);
    if (currentTab === 'grammar') return renderGrammarTab(lang);
    return renderAlphabetTab();
  }
function stageKey(langId) {
    return langId.replace(/-/g, '_');
  }

  /* Шрифтовая ступень (для CSS): класс на карточке знака. Без него глифы
     U+10900/U+10840/U+10380 уезжали в Times New Roman и печатались «☒»:
     этих знаков в нём просто нет. */
  function stageFontClass(key) {
    return 'pl-s-' + key;
  }

  function renderAlphabetTab() {
    if (currentLang.alphabet_mode === 'standalone') return renderStandaloneAlphabetTab();
    return renderEvolutionAlphabetTab();
  }

  /* Общий реестр знаков (прото-ханаанский, палео-еврейский, финикийский).
     Карточка показывает начертание той стадии, к которой относится язык,
     и всегда несёт подпись стадии — иначе не видно, какая форма выбрана. */
  function renderEvolutionAlphabetTab() {
    if (!letters.length) return '<div class="lab-alert lab-alert-info">Реестр знаков не загружен.</div>';
    var key = stageKey(currentLang.id);
    var cards = letters.map(function(letter) {
      var stage = letter.stages[key];
      return '<button type="button" class="pl-sign-card" data-letter-id="' + escapeHtml(letter.id) + '">' +
        '<span class="pl-sign-glyph ' + stageFontClass(key) + '">' + glyphMarkup(stage, letter) + '</span>' +
        '<span class="pl-sign-reading">' + escapeHtml(letter.name) + '</span>' +
        '<span class="pl-sign-type">' + escapeHtml(letter.sound) + '</span>' +
      '</button>';
    }).join('');
    return '<div class="pl-alphabet-grid">' + cards + '</div>';
  }

  /* Глиф стадии. У прото-ханаанского в данных glyph: null — рисуем заглушку
     из данных, а не пустой блок: иначе строка выглядит как дыра в таблице. */
  function glyphMarkup(stage, letter) {
    if (!stage) return escapeHtml(letter.hebrew);
    if (stage.glyph) return escapeHtml(stage.glyph);
    if (stage.placeholder) {
      return '<img src="' + escapeHtml(stage.placeholder) + '" width="26" height="26" alt="">';
    }
    return escapeHtml(letter.hebrew);
  }

  /* Собственные алфавиты (клинопись, арабский абджад, угаритский). */
  function renderStandaloneAlphabetTab() {
    var signs = currentLang.own_alphabet || [];
    if (!signs.length) return '<div class="lab-alert lab-alert-info">Алфавит не загружен.</div>';
    var fontClass = 'pl-s-' + escapeHtml(currentLang.id);
    var cards = signs.map(function(s) {
      return '<button type="button" class="pl-sign-card" data-sign-id="' + escapeHtml(s.id) + '">' +
        '<span class="pl-sign-glyph ' + fontClass + '">' + escapeHtml(s.symbol) + '</span>' +
        '<span class="pl-sign-reading">' + escapeHtml(s.reading) + '</span>' +
        '<span class="pl-sign-type">' + escapeHtml(s.type) + '</span>' +
      '</button>';
    }).join('');
    var note = currentLang.alphabet_note
      ? '<p class="pl-note">' + escapeHtml(currentLang.alphabet_note) + '</p>' : '';
    return note + '<div class="pl-alphabet-grid">' + cards + '</div>';
  }
// ===== ЭВОЛЮЦИЯ БУКВЫ (модалка) =====
  var EVOLUTION_STAGES = [
    { key: 'proto_canaanite', label: 'Прото-ханаанский' },
    { key: 'paleo_hebrew', label: 'Палео-еврейский' },
    { key: 'phoenician', label: 'Финикийский' },
    { key: 'imperial_aramaic', label: 'Имперский арамейский' }
  ];

  function showEvolution(letterId) {
    var letter = letters.filter(function(l) { return l.id === letterId; })[0];
    if (!letter) return;

    var order = EVOLUTION_STAGES.filter(function(o) { return letter.stages[o.key]; });
    var stages = order.map(function(o, i) {
      var s = letter.stages[o.key];
      var arrow = i < order.length - 1 ? '<span class="pl-evolution-arrow" aria-hidden="true">→</span>' : '';
      return '<div class="pl-evolution-stage">' +
          '<div class="pl-stage-label">' + escapeHtml(o.label) + '</div>' +
          '<div class="pl-stage-glyph ' + stageFontClass(o.key) + '">' + glyphMarkup(s, letter) + '</div>' +
          '<div class="pl-stage-period">' + escapeHtml(s.period || '') + '</div>' +
          '<div class="pl-stage-desc">' + escapeHtml(s.description || '') + '</div>' +
        '</div>' + arrow;
    }).join('');

    var html = '<div class="pl-evolution-row">' + stages + '</div>' +
      '<div class="pl-evolution-facts">' +
        '<div class="pl-fact"><dt>Звук</dt><dd>' + escapeHtml(letter.sound) + '</dd></div>' +
        '<div class="pl-fact"><dt>Значение</dt><dd>' + escapeHtml(letter.meaning) + '</dd></div>' +
      '</div>';

    LabModal.show(
      '<img src="assets/icons/32/paleo/track.png" width="24" height="24" alt=""> ' + escapeHtml(letter.name) + ' (' + escapeHtml(letter.hebrew) + ')',
      html,
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>' +
      '<button class="lab-btn lab-btn-primary lab-btn-sm" onclick="PaleoLinguistics.addToCompare(\'evolution\',\'' + letter.id + '\')">В сравнение</button>'
    );
  }

  // ===== ОТДЕЛЬНЫЙ ЗНАК (собственный алфавит) =====
  function showSignDetail(signId) {
    var signs = (currentLang && currentLang.own_alphabet) || [];
    var sign = signs.filter(function(s) { return s.id === signId; })[0];
    if (!sign) return;

    var html = '<div class="pl-sign-detail">' +
        '<div class="pl-sign-detail-glyph pl-s-' + escapeHtml(currentLang.id) + '">' + escapeHtml(sign.symbol) + '</div>' +
        '<div class="pl-sign-detail-reading">' + escapeHtml(sign.reading) + '</div>' +
        '<dl class="pl-evolution-facts">' +
          '<div class="pl-fact"><dt>Тип</dt><dd>' + escapeHtml(sign.type) + '</dd></div>' +
          '<div class="pl-fact"><dt>Значение</dt><dd>' + escapeHtml(sign.meaning) + '</dd></div>' +
        '</dl>' +
      '</div>';

    LabModal.show(
      '<img src="assets/icons/32/scribe/scroll.png" width="24" height="24" alt=""> ' + escapeHtml(sign.reading),
      html,
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>' +
      '<button class="lab-btn lab-btn-primary lab-btn-sm" onclick="PaleoLinguistics.addToCompare(\'' + escapeHtml(currentLang.id) + '\',\'' + escapeHtml(sign.id) + '\')">В сравнение</button>'
    );
  }
// ===== КОРНИ =====
  function renderRootsTab(lang) {
    var roots = lang.common_roots || [];
    if (!roots.length) return '<div class="lab-alert lab-alert-info">Список корней для этого языка не заполнен.</div>';
    var rows = roots.map(function(r) {
      return '<tr class="pl-root-row" data-hebrew="' + escapeHtml(r.hebrew) + '" tabindex="0" role="button" aria-label="Открыть корень ' + escapeHtml(r.hebrew) + ' в словарях">' +
        '<td>' + escapeHtml(r.language) + '</td>' +
        '<td dir="rtl" lang="he">' + escapeHtml(r.hebrew) + '</td>' +
        '<td>' + escapeHtml(r.meaning) + '</td>' +
      '</tr>';
    }).join('');
    return '<table class="lab-table pl-roots-table"><thead><tr><th>Форма</th><th>Иврит</th><th>Значение</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // ===== ТЕКСТЫ =====
  function renderTextsTab(lang) {
    var texts = lang.texts || [];
    if (!texts.length) return '<div class="lab-alert lab-alert-info">Тексты для этого языка не загружены.</div>';
    return texts.map(function(t) {
      return '<article class="pl-text-card">' +
        '<div class="pl-text-original" lang="he" dir="rtl">' + linkifyWords(t.original) + '</div>' +
        '<div class="pl-text-translit">' + escapeHtml(t.transliteration) + '</div>' +
        '<div class="pl-text-translation">' + escapeHtml(t.translation) + '</div>' +
      '</article>';
    }).join('');
  }

  /* Слова-ссылки на #word-analyzer. Раньше здесь стоял битый диапазон /[?-?]/ —
     после повреждения кодировки он перестал ловить иврит, и ссылки не работали.
     Unicode-экраны не зависят от кодировки файла, в отличие от литеральных букв. */
  function linkifyWords(original) {
    return String(original == null ? '' : original).split(/\s+/).filter(Boolean).map(function(w) {
      var clean = escapeHtml(w);
      if (!/[֐-׿]/.test(w)) return clean;
      return '<span class="pl-text-word" data-word="' + clean + '" role="button" tabindex="0">' + clean + '</span>';
    }).join(' ');
  }

  // ===== ГРАММАТИКА =====
  function renderGrammarTab(lang) {
    var g = lang.grammar || {};
    var items = [
      ['Порядок слов', g.order],
      ['Падежи', g.cases],
      ['Реконструкция', g.note]
    ].filter(function(pair) { return pair[1]; });
    if (!items.length) return '<div class="lab-alert lab-alert-info">Грамматика не описана.</div>';
    return '<dl class="pl-grammar">' + items.map(function(pair) {
      return '<div class="pl-grammar-item"><dt>' + escapeHtml(pair[0]) + '</dt><dd>' + escapeHtml(pair[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }
// ===== СОБЫТИЯ ВНУТРЕННЕЙ СТРАНИЦЫ =====
  function bindLangPageEvents(container, lang) {
    var back = container.querySelector('.pl-back-btn');
    if (back) back.addEventListener('click', backToCatalog);

    container.querySelectorAll('.pl-nav-item').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(container, lang, this.dataset.tab); });
    });

    container.querySelectorAll('.pl-sign-card[data-letter-id]').forEach(function(card) {
      card.addEventListener('click', function() { showEvolution(this.getAttribute('data-letter-id')); });
    });

    container.querySelectorAll('.pl-sign-card[data-sign-id]').forEach(function(card) {
      card.addEventListener('click', function() { showSignDetail(this.getAttribute('data-sign-id')); });
    });

    bindRootAndTextEvents(container);
  }

  function openRoot(hebrew) {
    if (hebrew && typeof LabRouter !== 'undefined') LabRouter.navigate('root-dictionary', null, { q: hebrew });
  }

  function openWord(word) {
    if (word && typeof LabRouter !== 'undefined') LabRouter.navigate('word-analyzer', null, { q: word });
  }

  function bindRootAndTextEvents(container) {
    container.querySelectorAll('.pl-root-row').forEach(function(row) {
      row.addEventListener('click', function() { openRoot(this.getAttribute('data-hebrew')); });
      row.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openRoot(this.getAttribute('data-hebrew'));
        }
      });
    });

    container.querySelectorAll('.pl-text-word').forEach(function(span) {
      span.addEventListener('click', function() { openWord(this.getAttribute('data-word')); });
      span.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openWord(this.getAttribute('data-word'));
        }
      });
    });
  }

  /* Переключение раздела перерисовывает только рабочую ячейку: рельс с
     идентификацией и навигацией остаётся на месте, поэтому после смены
     вкладки страница не прыгает вверх. */
  function switchTab(container, lang, tabId) {
    if (!tabId || tabId === currentTab) return;
    currentTab = tabId;

    container.querySelectorAll('.pl-nav-item').forEach(function(btn) {
      var active = btn.dataset.tab === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    var work = container.querySelector('.pl-cell--work');
    if (!work) return;
    work.id = 'pl-tab-' + tabId;
    var head = work.querySelector('.pl-cell-head');
    var title = head && head.querySelector('.pl-cell-title');
    var hint = head && head.querySelector('.pl-cell-hint');
    if (title) title.textContent = tabTitle(lang);
    if (hint) hint.textContent = tabHint(lang);
    var body = work.querySelector('.pl-work-body');
    if (body) body.innerHTML = renderActiveTab(lang);
    bindRootAndTextEvents(container);
  }

  // ===== СРАВНЕНИЕ (localStorage) =====
  /* Ключ — "source:id", т.е. "эволюция буквы" (все буквы реестра) или id языка
     (его собственные знаки). */
  function addToCompare(source, signId) {
    var key = source + ':' + signId;
    var list = read(COMPARE_KEY, []);
    if (list.indexOf(key) === -1) list.push(key);
    write(COMPARE_KEY, list);
    if (typeof LabToast !== 'undefined') LabToast.show('Знак добавлен в сравнение');
  }

  function getCompareList() {
    return read(COMPARE_KEY, []);
  }

  window.PaleoLinguistics = {
    init: init,
    showEvolution: showEvolution,
    showSignDetail: showSignDetail,
    addToCompare: addToCompare,
    getCompareList: getCompareList
  };
  return window.PaleoLinguistics;
})();
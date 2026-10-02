/**
 * router.js — SPA Router for Alephy Research Lab
 * 
 * Переключение между модулями без перезагрузки страницы
 * Использует hash-based routing: #root-dictionary, #religionism-checker, и т.д.
 */

const LabRouter = (function() {
  'use strict';

  // ===== СОСТОЯНИЕ =====
  let currentModule = 'dashboard';
  // Последние открытые модулей, новые в начало. Держим KEEP_RENDERED, чтобы
  // возврат «назад» не перерисовывал модуль и не терял его состояние.
  let recentModules = [];
  let modules = {};
  let onModuleChange = null;

  /* Сколько модулей держим отрисованными. Раньше контейнеры НИКОГДА не
     выгружались: после 10 переходов в #labContent лежало 11 контейнеров и
     4604 узла против 527 на старте. Три глобальных наблюдателя
     (paleo-highlight, lucide-init) сканируют всё поддерево, поэтому скрытые
     модули платили за каждого нового.

     Значение 3 — компромисс: возврат по кнопке «назад» через один модуль
     остаётся мгновенным, а память не растёт бесконечно. Замер после правки:
     максимум ~2.5 тыс. узлов на самом тяжёлом модуле вместо роста до 4604. */
  var KEEP_RENDERED = 3;

  function escapeHtml(text) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  function fallbackTitle(segment) {
    return decodeURIComponent(segment).replace(/[-_]+/g, ' ').replace(/\b\S/g, function(letter) {
      return letter.toLocaleUpperCase('ru-RU');
    });
  }

  function t(key, fallback) {
    return window.AlephyI18n ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function routeTitle(route) {
    if (route === 'dashboard') return t('lab.breadcrumbs.brand', 'АЛЕФИ');
    if (route === 'learn/paleo-trainer/battle') return t('lab.breadcrumbs.battle', 'Палео-битва');
    if (route.indexOf('learn') === 0 && window.LearnLab && window.LearnLab.routeTitle) {
      var learnTitle = window.LearnLab.routeTitle(route);
      if (learnTitle) return learnTitle;
    }
    if (route.indexOf('researches') === 0 && window.LoadResearches && window.LoadResearches.routeTitle) {
      var researchTitle = window.LoadResearches.routeTitle(route);
      if (researchTitle) return researchTitle;
    }
    // #workbench — титулы внутренних экранов берутся из реестра конвейеров и проектов.
    if (route.indexOf('workbench') === 0 && window.Workbench && window.Workbench.routeTitle) {
      var workbenchTitle = window.Workbench.routeTitle(route);
      if (workbenchTitle) return workbenchTitle;
    }
    if (route.indexOf('timeline') === 0 && window.Timeline && window.Timeline.routeTitle) {
      var timelineTitle = window.Timeline.routeTitle(route);
      if (timelineTitle) return timelineTitle;
    }
    if (route === 'root-dictionary') return t('lab.breadcrumbs.rootDictionary', 'Корневой словарь');
    if (route === 'root-dictionary/search') return t('lab.breadcrumbs.search', 'Поиск');
    if (route.indexOf('root-dictionary/search/') === 0) {
      var dictionarySegments = route.split('/');
      if (dictionarySegments[3] === 'page') return t('lab.breadcrumbs.page', 'Страница ') + dictionarySegments[4];
      return dictionarySegments[2] ? t('lab.breadcrumbs.searchPrefix', 'Поиск: ') + decodeURIComponent(dictionarySegments[2]) : t('lab.breadcrumbs.search', 'Поиск');
    }
    if (route.indexOf('root-dictionary/page/') === 0) return t('lab.breadcrumbs.page', 'Страница ') + route.split('/').pop();
    if (route.indexOf('root-dictionary/graph/') === 0) return t('lab.breadcrumbs.graphPrefix', 'Связи: ') + decodeURIComponent(route.split('/').pop());
    if (route === 'dictionaries') return t('lab.breadcrumbs.dictionaries', 'Словари');
    if (route === 'club/discussions') return t('lab.breadcrumbs.discussions', 'Обсуждения');
    if (route === 'club/sessions') return t('lab.breadcrumbs.sessions', 'Сессии');
    if (route === 'dictionaries/root-dictionary') return t('lab.breadcrumbs.rootDictionary', 'Корневой словарь');
    if (route === 'dictionaries/paleo-glossary') return t('lab.breadcrumbs.glossary', 'Палео-глоссарий');
    if (route.indexOf('paleo-mechanics/') === 0 && window.PageController && PageController.jsonCache['paleo-mechanics']) {
      var paleoKey = decodeURIComponent(route.split('/')[1]);
      var paleoDocument = PageController.jsonCache['paleo-mechanics'][paleoKey];
      if (paleoDocument && paleoDocument.title) return paleoDocument.title;
    }
    if (route.indexOf('dictionaries/') === 0 && window.PageController && PageController.jsonCache.dictionaries) {
      var dictionaryKey = decodeURIComponent(route.split('/')[1]);
      var dictionary = PageController.jsonCache.dictionaries[dictionaryKey];
      if (dictionary && dictionary.title) return dictionary.title;
    }
    // Маршрут-документ: подпись идёт из данных (PageController.documentTitle),
    // а перед их загрузкой — из указателя коллекции в реестре. Английский id
    // вида «method-states» в крошках пользователю показывать нечего.
    if (window.ModuleRegistry && ModuleRegistry.kind(route) === 'markdown') {
      var docTitle = window.PageController && PageController.documentTitle
        ? PageController.documentTitle(route)
        : null;
      if (docTitle) return docTitle;
      var docSource = ModuleRegistry.docSource(route);
      if (docSource && docSource.docs) {
        var file = String(docSource.docs).split('/').pop().replace(/\.md$/, '');
        return fallbackTitle(file);
      }
      return fallbackTitle(String(route).split('/').pop().replace(/^(dict|exposure|method)-/, ''));
    }
    if (window.LabHero && window.LabHero.getTitle) {
      var title = window.LabHero.getTitle(route);
      if (title) return title;
    }
    var segment = route.split('/').pop();
    return fallbackTitle(segment);
  }

  function renderBreadcrumbs(moduleId, parsed) {
    var container = modules[moduleId] || document.getElementById(moduleId);
    if (!container || moduleId === 'dashboard') return;

    var segments = (parsed && parsed.segments && parsed.segments.length ? parsed.segments : [moduleId]).slice();
    var routes = ['dashboard'];
    // Battle — самостоятельный режим обучения, а не дочерний экран тренажёра.
    if (segments.join('/') === 'learn/paleo-trainer/battle') {
      routes.push('learn', 'learn/paleo-trainer/battle');
    } else if (segments[0] === 'timeline' && segments[1] === 'compare') {
      // Сравнение: каталог → лента A → сводная хронология (без сырых id в крошках).
      routes.push('timeline');
      if (segments[2]) routes.push('timeline/' + segments[2]);
      routes.push(segments.join('/'));
    } else if (segments[0] === 'timeline' && segments[2] === 'full') {
      // Полный вид ленты: каталог → сама лента (сегмент full — служебный).
      routes.push('timeline');
      routes.push(segments.join('/'));
    } else if (segments[0] === 'timeline' && segments[2] === 'event') {
      // Событие: каталог → лента → событие (сегмент event — служебный).
      routes.push('timeline');
      routes.push('timeline/' + segments[1]);
      routes.push(segments.join('/'));
    } else {
      // Документ: АЛЕФИ → хаб группы → документ. Без хаба крошка вела бы в пустоту:
    // у маршрута-документа нет родительского экрана в коде.
    var docGroup = window.ModuleRegistry && ModuleRegistry.kind(moduleId) === 'markdown'
      ? ModuleRegistry.docSource(moduleId)
      : null;
    if (docGroup && docGroup.hub) routes.push(docGroup.hub);
    for (var i = 0; i < segments.length; i++) routes.push(segments.slice(0, i + 1).join('/'));
    }

    var crumb = container.querySelector('.lab-hero__kicker');
    if (!crumb) return;
    // Переключатель «Хлебные крошки» в #settings пишет data-breadcrumbs.
    if (document.documentElement.getAttribute('data-breadcrumbs') === 'off') {
      crumb.innerHTML = '';
      return;
    }

    crumb.innerHTML = routes.map(function(route, index) {
      var current = index === routes.length - 1;
      var label = escapeHtml(routeTitle(route));
      var href = route.split('/').map(function(segment) { return encodeURIComponent(decodeURIComponent(segment)); }).join('/');
      return (index ? '<span class="lab-hero__kicker-separator" aria-hidden="true">·</span>' : '') +
        '<a class="lab-hero__kicker-link' + (current ? ' is-current' : '') + '" data-breadcrumb-route="' + escapeHtml(route) + '" href="#' + escapeHtml(href) + '"' +
        (current ? ' aria-current="page"' : '') + '>' + label + '</a>';
    }).join('');
  }

  function refreshBreadcrumbs(moduleId) {
    if (!moduleId || moduleId !== currentModule) return;
    renderBreadcrumbs(moduleId, parseHash());
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init() {
    // Регистрируем все модули
    document.querySelectorAll('.module').forEach(function(el) {
      const id = el.id;
      if (id) {
        modules[id] = el;
      }
    });

    document.addEventListener('alephy:langchange', function() {
      refreshBreadcrumbs(currentModule);
    });

    // Слушаем hashchange
    window.addEventListener('hashchange', handleHash);

    // Обработка кликов по sidebar-item
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        const module = item.dataset.module;
        if (module) {
          e.preventDefault();
          navigate(module);
        }
      });
    });

    // Крошки живут внутри шапки, которую модули могут перерисовать.
    document.addEventListener('click', function(event) {
      var link = event.target.closest && event.target.closest('.lab-hero__kicker-link:not(.is-current)');
      if (!link) return;
      var route = link.getAttribute('data-breadcrumb-route');
      if (!route) return;
      event.preventDefault();
      var parts = route.split('/');
      navigate(parts.shift(), parts);
    });

    // Обрабатываем прямую ссылку сразу после регистрации колбэка.
    handleHash();

    console.log('[Router] Инициализирован. Модулей:', Object.keys(modules).length);
  }

  // ===== РАЗБОР ХЕША С ПАРАМЕТРАМИ =====
  // Формат: #<module>[/<sub1>/<sub2>...][?key=value&...]
  function parseHash() {
    var raw = window.location.hash.replace('#', '') || 'dashboard';
    var queryIndex = raw.indexOf('?');
    var path = queryIndex === -1 ? raw : raw.substring(0, queryIndex);
    var queryString = queryIndex === -1 ? '' : raw.substring(queryIndex + 1);
    var segments = path.split('/').filter(function(s) { return s.length > 0; });
    var params = {};
    queryString.split('&').forEach(function(pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      var key = eq === -1 ? pair : pair.substring(0, eq);
      var value = eq === -1 ? '' : pair.substring(eq + 1);
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return { module: segments[0] || 'dashboard', segments: segments, params: params, raw: raw };
  }

  // ===== ОБРАБОТКА ХЕША =====
  function handleHash() {
    var parsed = parseHash();
    var hash = parsed.module;

    // Список маршрутов — не здесь: единственный источник правды в
    // js/module-registry.js. Дублирование списка в роутере и в page-controller
    // позволяло маршруту «исчезнуть» молча; теперь расхождение ловит
    // tools/design-baseline/registry-check.mjs.
    var registry = window.ModuleRegistry;

    // Устаревшие маршруты живут в реестре (ALIASES) и редиректят на актуальные.
    if (registry && registry.ALIASES[hash]) {
      navigate(registry.ALIASES[hash]);
      return;
    }

    // Маршруты, которые раньше шли отдельными if-ветками (laboratory, agents,
    // library, prompt-generator, clue-generator, video-lab, davar-checker,
    // tree-checker, translation-comparator, paleo-builder, language-map, board),
    // теперь покрыты реестром: каждая такая ветка делала ровно showModule(hash).
    // Известный модуль открывается напрямую; неизвестный — понятная ошибка
    // вместо молчаливого игнорирования хеша.
    if (modules[hash] || (registry && registry.has(hash))) {
      showModule(hash, parsed);
    } else if (hash === 'dashboard') {
      showModule('dashboard', parsed);
    } else {
      showUnknownRoute(hash);
    }
  }

  // Неизвестный хеш: сообщаем пользователю, что такого маршрута нет, и
  // предлагаем вернуться на рабочий стол. Раньше он просто игнорировался.
  function showUnknownRoute(hash) {
    var root = document.getElementById('labContent');
    if (!root) return;
    var id = 'unknown-route';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'module active';
      root.appendChild(el);
      modules[id] = el;
    }
    Object.keys(modules).forEach(function(moduleId) {
      if (moduleId !== id) modules[moduleId].classList.remove('active');
    });
    currentModule = id;
    el.innerHTML =
      '<div class="lab-alert lab-alert-info">' +
      '<p>Маршрут <code>#' + escapeHtml(hash) + '</code> не зарегистрирован в лаборатории.</p>' +
      '<p><a href="#dashboard">Вернуться на рабочий стол</a></p>' +
      '</div>';
    if (window.LabRouter) LabRouter.renderBreadcrumbs(id, { segments: ['dashboard'] });
  }

  // ===== НАВИГАЦИЯ =====
  function navigate(moduleId, segments, params) {
    var hash = moduleId;
    if (segments && segments.length) hash += '/' + segments.join('/');
    if (params) {
      var query = Object.keys(params)
        .filter(function(k) { return params[k] !== '' && params[k] != null; })
        .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      if (query) hash += '?' + query;
    }
    window.location.hash = hash;
  }

  /* Выгрузка неактивных модулей.

     Контейнер СОХРАНЯЕТСЯ в DOM (мы чистим только содержимое), а не удаляется:
     на элемент ссылаются modules[id] роутера, массив observedContainers в
     LabHero и кеши модулей. Удаление контейнера заставило бы LabHero
     наблюдать новый элемент заново при каждом возврате, а модули — терять
     состояние в куках. Очистка innerHTML сбрасывает dataset.loaded, и
     renderModule() штатно перерисовывает модуль при возврате. */
  function pruneInactiveModules(activeId) {
    // Держим последние KEEP_RENDERED модулей в истории, включая активный.
    var history = [activeId].concat(recentModules.filter(function(id) { return id !== activeId; }));
    var keep = {};
    history.slice(0, KEEP_RENDERED).forEach(function(id) { keep[id] = true; });

    Object.keys(modules).forEach(function(id) {
      if (keep[id]) return;
      var el = modules[id];
      if (!el || !el.parentNode) return;
      // Пустой контейнер чистить незачем — там уже нет разметки.
      if (!el.innerHTML.trim()) return;
      // Своих слушателей модуль должен снять сам (у модулей с подписками
      // есть teardown через dataset), здесь снимаем только наблюдатель
      // ожидания контейнера и сбрасываем флаги состояния.
      if (window.PageController && PageController.releaseModule) {
        PageController.releaseModule(id);
      }
      el.innerHTML = '';
      delete el.dataset.loaded;
      delete el.dataset.loading;
      delete el.dataset.moduleError;
    });
  }

  // ===== ПОКАЗ МОДУЛЯ =====
  function showModule(moduleId, parsed) {
    // Создаём контейнер до вызова PageController.
    if (!modules[moduleId]) {
      var root = document.getElementById('labContent');
      if (root) {
        var el = document.createElement('div');
        el.id = moduleId;
        el.className = 'module';
        root.appendChild(el);
        modules[moduleId] = el;
      }
    }

    // Скрываем все
    Object.keys(modules).forEach(function(id) {
      modules[id].classList.remove('active');
    });

    // Показываем dashboard если нужно
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.classList.remove('active');
    }

    // Показываем целевой модуль
    if (moduleId === 'dashboard') {
      if (dashboard) dashboard.classList.add('active');
    } else if (modules[moduleId]) {
      modules[moduleId].classList.add('active');
    } else {
      // Если модуль не найден — показываем dashboard
      if (dashboard) dashboard.classList.add('active');
      moduleId = 'dashboard';
    }

    // Обновляем sidebar
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
      const isActive = item.dataset.module === moduleId ||
                       (!item.dataset.module && moduleId === 'dashboard');
      item.classList.toggle('active', isActive);
    });

    // Последние KEEP_RENDERED модулей остаются отрисованными: возврат
    // «назад» не перерисовывает модуль и не теряет его состояние.
    recentModules = [moduleId].concat(recentModules.filter(function(id) { return id !== moduleId; }));
    if (recentModules.length > KEEP_RENDERED) recentModules.length = KEEP_RENDERED;
    currentModule = moduleId;
    pruneInactiveModules(moduleId);

    // document.title в соответствии с маршрутом.
    // Раньше title задавался только манифестом и лип к другим страницам.
    var pageTitle = routeTitle(moduleId);
    if (pageTitle) document.title = pageTitle + ' — Alephy';

    // PageController получает единственный вызов через зарегистрированный колбэк.
    if (onModuleChange) {
      onModuleChange(moduleId, parsed);
    }
    renderBreadcrumbs(moduleId, parsed);

    // Прокрутка вверх
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== РЕГИСТРАЦИЯ КОЛБЭКА =====
  function onChange(callback) {
    onModuleChange = callback;
  }

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    init: init,
    navigate: navigate,
    show: showModule,
    parseHash: parseHash,
    renderBreadcrumbs: renderBreadcrumbs,
    refreshBreadcrumbs: refreshBreadcrumbs,
    current: function() { return currentModule; },
    onChange: onChange
  };
})();

window.LabRouter = LabRouter;
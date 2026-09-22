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
  let modules = {};
  let onModuleChange = null;

  function escapeHtml(text) {
    var el = document.createElement('div');
    el.textContent = text == null ? '' : String(text);
    return el.innerHTML;
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
      for (var i = 0; i < segments.length; i++) routes.push(segments.slice(0, i + 1).join('/'));
    }

    var crumb = container.querySelector('.lab-hero__kicker');
    if (!crumb) return;

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
    var routedModules = [
      'manifest', 'dashboard', 'workbench', 'learn', 'dictionaries', 'researches',
      'methodology', 'paleo-mechanics', 'paleo-linguistics',
      'language-map', 'religionisms', 'root-dictionary', 'paleo-glossary', 'paleo-builder',
      'word-analyzer', 'scripture-reader', 'generators',
      'checkers', 'religionism-checker', 'etymology-checker', 'translation-comparator', 'state-checker', 'investigation', 'heraldry',
      'cartography', 'states', 'timeline', 'ai-agents', 'pipelines', 'agent-server', 'ed-chat', 'vision',
      'paleo-keyboard', 'admin-settings', 'analyzers', 'layer-analyzer', 'ai-analyzer', 'dialect-analyzer', 'state-analyzer', 'exposure-editor', 'clue-generator',
      'video-lab', 'prompt-generator', 'board-generator', 'research-generator', 'hypothesis-generator', 'timescale-generator', 'davar-checker', 'tree-checker', 'board', 'name-decoder', 'linguistic-tensor',
      'club',
      // Маршруты разоблачений (обрабатываются в default-кейсе PageController через mdPaths)
      'exposure-dictionary', 'exposure-principles', 'exposure-distortions',
      'exposure-mechanisms', 'exposure-linguistic-methods', 'exposure-methods',
      'exposure-language', 'exposure-language-shifts', 'exposure-bavelisms',
      'exposure-masoretic', 'exposure-philosophemes', 'exposure-system-architecture',
      'exposure-religionism-theory', 'exposure-techniques',
      'method-archeology', 'method-hebrew-reconstruction', 'method-layers',
      'method-translation', 'method-transliteration', 'method-tree'
    ];

    // #settings is an alias for #admin-settings
    if (hash === 'settings') {
      navigate('admin-settings');
      return;
    }

    // #research-library — устаревший маршрут, объединён с #researches
    if (hash === 'research-library') {
      navigate('researches');
      return;
    }

    // Точки входа манифеста ведут к существующим модулям платформы
    if (hash === 'laboratory') {
      showModule('dashboard', parsed);
      return;
    }
    if (hash === 'agents') {
      showModule('ai-agents', parsed);
      return;
    }
    if (hash === 'library') {
      showModule('researches', parsed);
      return;
    }

    // #prompt-generator — сборщик промптов исследователя
    if (hash === 'prompt-generator') {
      showModule('prompt-generator', parsed);
      return;
    }

    // #clue-generator — сборка цепочки улик
    if (hash === 'clue-generator') {
      showModule('clue-generator', parsed);
      return;
    }

    // #video-lab — генератор видео-образов
    if (hash === 'video-lab') {
      showModule('video-lab', parsed);
      return;
    }

    // #davar-checker — проверка воплощаемости слова
    if (hash === 'davar-checker') {
      showModule('davar-checker', parsed);
      return;
    }

    // #tree-checker — проверка учения по шести уровням дерева
    if (hash === 'tree-checker') {
      showModule('tree-checker', parsed);
      return;
    }

    // #translation-comparator — отдельный экран сравнения переводов
    if (hash === 'translation-comparator') {
      showModule('translation-comparator', parsed);
      return;
    }

    // #paleo-builder — сборка слова из палео-букв
    if (hash === 'paleo-builder') {
      showModule('paleo-builder', parsed);
      return;
    }

    // #language-map — диагностика живых языков и их переходов
    if (hash === 'language-map') {
      showModule('language-map', parsed);
      return;
    }

    // #board — интерактивная доска сборки кейса
    if (hash === 'board') {
      showModule('board', parsed);
      return;
    }

    if (modules[hash] || routedModules.indexOf(hash) !== -1) {
      showModule(hash, parsed);
    } else if (hash === 'exposure-editor') {
      // Dynamic module — будет создан в showModule
      showModule(hash, parsed);
    } else if (hash === 'dashboard') {
      showModule('dashboard', parsed);
    }
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

    currentModule = moduleId;

    // document.title в соответствии с маршрутом.
    // Раньше title задавался только манифестом и лип к другим страницам.
    var pageTitle = routeTitle(moduleId);
    if (pageTitle) document.title = pageTitle + ' — Alephy';

    // PageController получает единственный вызов через зарегистрированный колбэк.
    if (onModuleChange) {
      onModuleChange(moduleId, parsed);
    }
    renderBreadcrumbs(moduleId, parsed);
    if (window.RevealObserver) window.RevealObserver.scan(modules[moduleId]);

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
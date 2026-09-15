/**
 * page-controller.js — Единый контроллер страниц SPA-лаборатории
 *
 * Централизует рендеринг всех модулей. Роутер вызывает PageController.render(),
 * а не размазывает логику по router.js и index.html.
 *
 * Маршрут: подключён после router.js, перед инициализацией.
 */

const PageController = (function() {
  'use strict';

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  var htmlCache = {};

  function fetchPage(path) {
    if (htmlCache[path]) return Promise.resolve(htmlCache[path]);
    return fetch(path).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
      return r.text();
    }).then(function(html) {
      htmlCache[path] = html;
      return html;
    });
  }

  function fetchJson(path) {
    return fetch(path).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
      return r.json();
    });
  }

  function showError(container, msg) {
    container.innerHTML = '<div class="lab-alert lab-alert-error">' + escapeHtml(msg) + '</div>';
  }

  function showSpinner(container, text) {
    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">' + escapeHtml(text || 'Загрузка…') + '</div></div>';
  }

  var AGENT_API_URL = 'http://127.0.0.1:5000';

  function checkAgentServer() {
    return fetch(AGENT_API_URL + '/api/health', { cache: 'no-store' }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function isAgentServerUnavailable(error) {
    return error && (error.name === 'TypeError' || error.name === 'NetworkError' || /Failed to fetch|NetworkError|ERR_CONNECTION_REFUSED/i.test(error.message || ''));
  }

  function agentServerMessage() {
    return '<div class="lab-alert lab-alert-error">Сервер AI-Агентов недоступен. Запустите из корня проекта: <code>python products/agents/server.py</code></div>';
  }

  function getAgentMapData() {
    var agents = [
      { icon: 'ui/arrows', name: 'Оркестратор', desc: 'Оркестратор — получает запрос, разбивает его на подзадачи и распределяет их между агентами.', model: 'ALEPHY', cat: 'Оркестрация', featured: true },
      { icon: 'archaeology/testtube', name: 'Исследователь', desc: 'Разбирает корни, стихи, термины.', model: 'Claude Sonnet 4', cat: 'Исследователь' },
      { icon: 'ui/question', name: 'Разоблачитель', desc: 'Ищет подмены в переводах, сравнивает LXX и Синодальный.', model: 'GPT-4o', cat: 'Исследователь' },
      { icon: 'scribe/scrolls', name: 'Сборщик', desc: 'Объединяет результаты в единый отчёт.', model: 'Claude Haiku 3.5', cat: 'Оркестрация' },
      { icon: 'ui/scales', name: 'Критик', desc: 'Проверяет разбор на соответствие методологии.', model: 'Claude Sonnet 4', cat: 'Контроль качества' },
      { icon: 'seals/ring', name: 'Семитолог', desc: 'Авто-вывод не выполняется: требуется ручная сверка параллелей по словарям (заглушка).', model: '—', cat: 'Исследователь' },
      { icon: 'scribe/scroll', name: 'Компаратор', desc: 'Сравнение свидетелей требует внешних источников; авто-вывод не выполняется (заглушка).', model: '—', cat: 'Исследователь' },
      { icon: 'ui/keyboard', name: 'Редактор', desc: 'Приводит черновик к стилю проекта.', model: 'Claude Haiku 3.5', cat: 'Документация' },
      { icon: 'scribe/scroll', name: 'Переводчик палео-иврита', desc: 'Переводит букву через палео-образ к физическому смыслу.', model: 'Claude Sonnet 4', cat: 'Исследователь' },
      { icon: 'crafts/hammer-and-chisel', name: 'Фронтенд-разработчик', desc: 'Заглушка: генерация интерфейсов появится после подключения LLM-движка.', model: '—', cat: 'Разработчик' },
      { icon: 'ui/settings', name: 'AI-инженер', desc: 'Заглушка: подготовка задач для LLM-инженера после подключения модели.', model: '—', cat: 'Разработчик' },
      { icon: 'ui/scales', name: 'Проверяющий', desc: 'Валидирует код, данные и исследовательские гипотезы.', model: 'Claude Sonnet 4', cat: 'Контроль качества' },
      { icon: 'scribe/scroll', name: 'Технический писатель', desc: 'Заглушка: оформление документации после подключения LLM.', model: '—', cat: 'Документация' },
      { icon: 'ui/scales', name: 'Ревьюер кода', desc: 'Заглушка: авто-ревью кода появится после подключения LLM.', model: '—', cat: 'Контроль качества' },
      { icon: 'paleo/track', name: 'Архитектор потока', desc: 'Заглушка: используется линейный порядок агентов из конфига пайплайна.', model: '—', cat: 'Оркестрация' },
      { icon: 'ui/link', name: 'Связной', desc: 'Связывает разрозненные исследования в единую сеть.', model: 'Claude Sonnet 4', cat: 'Оркестрация' }
    ];
    var agentSlugs = ['orchestrator', 'researcher', 'exposer', 'collector', 'critic', 'semitologist', 'comparator', 'editor', 'paleo-translator', 'frontend-developer', 'ai-engineer', 'verifier', 'technical-writer', 'code-reviewer', 'flow-architect', 'liaison'];
    agents.forEach(function(agent, index) { agent.id = agentSlugs[index] || ('agent-' + index); });
    return agents;
  }

  // ===== JSON-СТРАНИЦЫ (словари, методология, палео-механика) =====

  var jsonCache = {};
  var pageState = {
    dictionaries: { key: '', query: '' },
    methodology: { key: '' },
    'paleo-mechanics': { key: '' }
  };

  function loadJsonPage(page, path, container) {
    showSpinner(container, 'Загрузка данных…');
    fetchJson(path).then(function(data) {
      jsonCache[page] = data;
      if (page === 'dictionaries') renderDictionaries(container, data);
      else renderDocumentPage(container, page, data);
      if (window.LabRouter) LabRouter.renderBreadcrumbs(page, LabRouter.parseHash());
    }).catch(function(error) {
      showError(container, 'Ошибка загрузки данных: ' + error.message);
    });
  }

  function renderDictionaries(container, data) {
    var state = pageState.dictionaries;
    var parsed = window.LabRouter && LabRouter.parseHash ? LabRouter.parseHash() : null;
    var routeKey = parsed && parsed.module === 'dictionaries' && parsed.segments[1]
      ? decodeURIComponent(parsed.segments[1])
      : '';
    if (routeKey === 'root-dictionary') routeKey = '__root_dictionary';
    if (routeKey === 'paleo-glossary') routeKey = '__paleo_glossary';
    if (parsed && parsed.module === 'dictionaries') {
      state.key = routeKey;
      state.query = (parsed.params && parsed.params.q) || '';
    }
    var keys = Object.keys(data);
    if (!keys.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Словари пока не заполнены.</div>';
      return;
    }
    if (!state.key) {
      var specialCards = [
        '<a href="#" class="dict-card" data-key="__root_dictionary" style="animation-delay: 0ms">' +
          '<div class="dict-card-top">' +
            '<img src="assets/icons/32/ui/book.png" class="dict-icon" alt="">' +
            '<div class="dict-name">Корневой словарь</div>' +
            '<div class="dict-count">150 корней</div>' +
          '</div>' +
          '<p class="subtitle">Поиск по корням иврита. Введите корень, слово или значение. Граф использует только палео-письмо.</p>' +
          '</a>',
        '<a href="#" class="dict-card" data-key="__paleo_glossary" style="animation-delay: 50ms">' +
          '<div class="dict-card-top">' +
            '<img src="assets/icons/32/paleo/track.png" class="dict-icon" alt="">' +
            '<div class="dict-name">Палео-глоссарий</div>' +
            '<div class="dict-count">100 слов</div>' +
          '</div>' +
          '<div class="dict-desc">Первая партия: 100 слов как русла потока — палео-форма, квадратное письмо, функция и корень.</div>' +
          '</a>'
      ].join('');
      var dictCards = specialCards + keys.map(function(key, index) {
        var dict = data[key];
        var count = (dict.terms || []).length;
        return '<a href="#" class="dict-card" data-key="' + escapeHtml(key) + '" style="animation-delay: ' + ((index + 2) * 50) + 'ms">' +
          '<div class="dict-card-top">' +
            '<img src="assets/icons/32/ui/book.png" class="dict-icon" alt="">' +
            '<div class="dict-name">' + escapeHtml(dict.title || key) + '</div>' +
            '<div class="dict-count">' + count + ' терминов</div>' +
          '</div>' +
          '<div class="dict-desc">' + escapeHtml((dict.description || '').split('---')[0].trim().substring(0, 100) + (dict.description && dict.description.length > 100 ? '...' : '')) + '</div>' +
          '</a>';
      }).join('');
      container.innerHTML = '<div class="research-page-head">' +
        '<h1><img src="assets/icons/32/ui/book.png" class="lab-icon" alt="">Словари</h1>' +
        '<p class="subtitle">Словарные карты подмен с ивритским соответствием и палео-формой.</p>' +
        '</div>' +
        '<div class="dict-grid" id="dict-grid">' + dictCards + '</div>';
      var dictGrid = document.getElementById('dict-grid');
      if (dictGrid) {
        dictGrid.querySelectorAll('.dict-card').forEach(function(card) {
          card.addEventListener('click', function(e) {
            e.preventDefault();
            var key = this.getAttribute('data-key');
            var route = key === '__root_dictionary' ? 'root-dictionary' :
              (key === '__paleo_glossary' ? 'paleo-glossary' : key);
            if (window.LabRouter) LabRouter.navigate('dictionaries', [encodeURIComponent(route)]);
          });
        });
      }
      return;
    }
    if (state.key === '__root_dictionary') {
      renderRootDictionaryModule(container, data);
      return;
    }
    if (state.key === '__paleo_glossary') {
      renderPaleoGlossaryModule(container, data);
      return;
    }
    var dictionary = data[state.key];
    var query = state.query.trim().toLowerCase();
    var terms = (dictionary.terms || []).filter(function(term) {
      if (!query) return true;
      return [term.word, term.hebrew, term.restored].some(function(value) {
        return String(value || '').toLowerCase().indexOf(query) !== -1;
      })
    });
    var backBtn = '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabRouter.navigate(\'dictionaries\')">Назад к словарям</button>';
    var options = keys.map(function(key) {
      return '<option value="' + escapeHtml(key) + '"' + (key === state.key ? ' selected' : '') + '>' +
        escapeHtml(data[key].title || key) + '</option>';
    }).join('');
    var termCards = terms.map(function(term, index) {
      var paleo = (term.paleo || []).join(' ');
      return '<article class="term-card" style="animation-delay: ' + (index * 50) + 'ms">' +
        '<div class="term-paleo" lang="hbo" dir="rtl">' + escapeHtml(paleo) + '</div>' +
        '<div class="term-word">' + escapeHtml(term.word) + '</div>' +
        '<div class="term-hebrew" lang="he" dir="rtl">' + escapeHtml(term.hebrew) + '</div>' +
        '<div class="term-restored">' + escapeHtml(term.restored) + '</div>' +
        '</article>';
    }).join('');
    var dictionaryDescription = escapeHtml((dictionary.description || '').replace(/---/g, '').trim());
    var dictionaryHeading = escapeHtml(dictionary.title || 'Словари');
    container.innerHTML = '<div class="research-page-head">' +
      '<h1><img src="assets/icons/32/ui/book.png" class="lab-icon" alt="">' + dictionaryHeading + '</h1>' +
      '<p class="subtitle text-muted">' + dictionaryDescription + '</p>' + backBtn +
      '</div>' +
      '<div class="research-controls">' +
      '<label>Словарь<select id="research-dictionary-select" class="lab-input">' + options + '</select></label>' +
      '<label class="research-search-label">Поиск<input id="research-dictionary-search" class="lab-input" type="search" value="' + escapeHtml(state.query) + '" placeholder="Слово, иврит или восстановленный смысл"></label>' +
      '</div>' +
      '<div class="term-grid" id="term-grid">' + (termCards || '<div class="lab-alert lab-alert-info">По запросу ничего не найдено.</div>') + '</div>';
    var termGrid = document.getElementById('term-grid');
    if (termGrid) termGrid.querySelectorAll('.term-card').forEach(function(c) { c.classList.add('fade-in-stagger'); });
    var select = document.getElementById('research-dictionary-select');
    var search = document.getElementById('research-dictionary-search');
    if (select) select.addEventListener('change', function() {
      if (window.LabRouter) LabRouter.navigate('dictionaries', [encodeURIComponent(this.value)]);
    });
    if (search) search.addEventListener('input', function() {
      state.query = this.value;
      renderDictionaries(container, data);
      var nextSearch = document.getElementById('research-dictionary-search');
      if (nextSearch) { nextSearch.focus(); nextSearch.setSelectionRange(state.query.length, state.query.length); }
    });
  }

  function renderRootDictionaryModule(container, data) {
    var backBtn = '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabRouter.navigate(\'dictionaries\')">Назад к словарям</button>';
    container.innerHTML = '<div class="research-page-head">' +
      '<h1><img src="assets/icons/32/ui/book.png" class="lab-icon" alt="">Корневой словарь</h1>' +
      '<p class="subtitle">Поиск по корням иврита. Введите корень, слово или значение.</p>' + backBtn +
      '</div>' +
      '<div class="search-wrap"><input type="text" id="rd-search" class="lab-input" placeholder="אמן, AMN, верить..." oninput="if(window.RootsSearch)RootsSearch.filter(this.value)" autofocus></div>' +
      '<div class="rd-stats"><div class="rd-stat"><div class="num" id="rd-total">150</div><div class="label">Корней</div></div><div class="rd-stat"><div class="num" id="rd-found">0</div><div class="label">Найдено</div></div></div>' +
      '<div id="rd-spinner" class="rd-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка словаря…</div></div>' +
      '<div id="rd-list"></div><div id="rd-pagination" class="rd-pagination"></div>' +
      '<div id="rd-empty" class="lab-alert lab-alert-info" style="display:none">Ничего не найдено.</div>';
    if (window.RootDict) RootDict.init();
  }

  function renderPaleoGlossaryModule(container, data) {
    var backBtn = '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabRouter.navigate(\'dictionaries\')">Назад к словарям</button>';
    container.innerHTML = '<div class="research-page-head">' +
      '<div class="paleo-glossary-head">' +
      '<div class="paleo-glossary-icon" aria-hidden="true">𐤌</div>' +
      '<div><p class="paleo-glossary-kicker">АЛЕФИ · СЛОВАРИ</p><h1>Палео-глоссарий</h1>' +
      '<p class="subtitle">Первая партия: 100 слов как русла потока — палео-форма, квадратное письмо, функция и корень.</p></div>' +
      '</div>' + backBtn +
      '</div>' +
      '<div class="paleo-glossary-controls">' +
      '<label class="paleo-glossary-search">Поиск<input id="paleo-glossary-search" class="lab-input" type="search" placeholder="Палео-форма, слово или транслитерация" autocomplete="off"></label>' +
      '<label>Корень<select id="paleo-glossary-root" class="lab-input"><option value="all">Все корни</option></select></label>' +
      '</div>' +
      '<div id="paleo-glossary-meta" class="paleo-glossary-meta" aria-live="polite"></div>' +
      '<div id="paleo-glossary-grid" class="paleo-glossary-grid"></div>' +
      '<nav id="paleo-glossary-pagination" class="paleo-glossary-pagination" aria-label="Страницы глоссария"></nav>';
    if (window.PaleoGlossary) window.PaleoGlossary.init(container);
  }

  function renderInlineMarkdown(text) {
    if (typeof marked !== 'undefined' && marked.parseInline) {
      return marked.parseInline(text || '');
    }
    return escapeHtml(text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function parsePaleoMechanicsContent(content) {
    var labels = ['Образ', 'Функция', 'Палео-написание', 'Как работает', 'Пример в слове', 'Сравнение с греческой подменой'];
    var source = String(content || '').replace(/\r/g, '');
    var fields = {};

    labels.forEach(function(label, index) {
      var marker = '**' + label + ':**';
      var start = source.indexOf(marker);
      if (start === -1) return;
      start += marker.length;
      var end = source.length;
      labels.slice(index + 1).forEach(function(nextLabel) {
        var next = source.indexOf('**' + nextLabel + ':**', start);
        if (next !== -1 && next < end) end = next;
      });
      fields[label] = source.slice(start, end).trim();
    });

    fields.steps = (fields['Как работает'] || '').split('\n')
      .map(function(line) { return line.replace(/^\s*-\s*/, '').trim(); })
      .filter(Boolean);
    return fields;
  }

  function getPaleoGlyph(letterName) {
    var glyphs = {
      'Алеф': '𐤀', 'Бет': '𐤁', 'Гимель': '𐤂', 'Далет': '𐤃', 'Вав': '𐤅',
      'Хей': '𐤄', 'Заин': '𐤆', 'Хет': '𐤇', 'Тет': '𐤈', 'Йод': '𐤉',
      'Каф': '𐤊', 'Ламед': '𐤋', 'Мем': '𐤌', 'Нун': '𐤍', 'Самех': '𐤎',
      'Аин': '𐤏', 'Пей': '𐤐', 'Цади': '𐤑', 'Коф': '𐤒', 'Реш': '𐤓',
      'Шин': '𐤔', 'Тав': '𐤕'
    };
    return glyphs[letterName] || '';
  }

  function renderPaleoMechanicsDocument(container, documentData, options, backBtn) {
    var fields = parsePaleoMechanicsContent((documentData.sections || [])[0] && documentData.sections[0].content);
    var assemblyNames = (fields['Пример в слове'] || '').match(/[А-ЯЁ][а-яё]+/g) || [];
    var assemblyGlyphs = assemblyNames.map(getPaleoGlyph).filter(Boolean);
    var paleoAssembly = assemblyGlyphs.length ? assemblyGlyphs.join(' + ') : (fields['Палео-написание'] || '');
    var paleoWord = assemblyGlyphs.length ? assemblyGlyphs.join('') : (fields['Палео-написание'] || '');
    var image = fields['Образ'] || 'Палео-образ не указан';
    var functionText = fields['Функция'] || '';
    var exampleText = fields['Пример в слове'] || '';
    var comparisonText = fields['Сравнение с греческой подменой'] || '';
    var steps = fields.steps || [];
    var cards = [
      '<article class="paleo-module paleo-module-image">' +
        '<div class="paleo-module-heading"><img src="assets/icons/32/paleo/track.png" alt=""><h2>Образ</h2></div>' +
        '<p class="paleo-module-lead">' + renderInlineMarkdown(image) + '</p>' +
      '</article>',
      '<article class="paleo-module paleo-module-function">' +
        '<div class="paleo-module-heading"><img src="assets/icons/32/archaeology/testtube.svg" alt=""><h2>Функция</h2></div>' +
        '<div class="paleo-module-copy">' + renderInlineMarkdown(functionText) + '</div>' +
      '</article>',
      '<article class="paleo-module paleo-module-example">' +
        '<div class="paleo-module-heading"><img src="assets/icons/32/ui/book.png" alt=""><h2>Пример в слове</h2></div>' +
        '<div class="paleo-word-display" lang="hbo">' + escapeHtml(paleoWord) + '</div>' +
        '<div class="paleo-assembly"><span>Сборка</span><strong lang="hbo">' + escapeHtml(paleoAssembly) + '</strong></div>' +
        '<p class="paleo-module-copy">' + renderInlineMarkdown(exampleText) + '</p>' +
      '</article>',
      '<article class="paleo-module paleo-module-steps">' +
        '<div class="paleo-module-heading"><img src="assets/icons/32/crafts/hammer-and-chisel.png" alt=""><h2>Как работает</h2></div>' +
        '<ol class="paleo-steps">' + steps.map(function(step, index) {
          return '<li class="paleo-step"><span>' + (index + 1) + '</span><div>' + renderInlineMarkdown(step) + '</div></li>';
        }).join('') + '</ol>' +
      '</article>',
      '<article class="paleo-module paleo-module-comparison">' +
        '<div class="paleo-module-heading"><img src="assets/icons/32/ui/scales.png" alt=""><h2>Сравнение с греческой подменой</h2></div>' +
        '<div class="paleo-comparison-copy">' + renderInlineMarkdown(comparisonText) + '</div>' +
      '</article>'
    ].join('');

    container.innerHTML = '<div id="paleo-mechanics" class="paleo-mechanics-page"><div class="paleo-mechanics-actions">' + backBtn + '</div>' +
      '<div class="research-controls"><label>Документ<select id="research-paleo-mechanics-select" class="lab-input">' + options + '</select></label></div>' +
      '<div class="paleo-mechanics-modules">' + cards + '</div></div>';

    var select = document.getElementById('research-paleo-mechanics-select');
    if (select) select.addEventListener('change', function() {
      if (window.LabRouter) {
        LabRouter.navigate('paleo-mechanics', [this.value]);
        return;
      }
      PageController.pageState['paleo-mechanics'].key = this.value;
      renderDocumentPage(container, 'paleo-mechanics', PageController.jsonCache['paleo-mechanics']);
    });
  }

  function renderDocumentPage(container, page, data) {
    var state = pageState[page];
    var keys = Object.keys(data);
    var parsed = window.LabRouter && LabRouter.parseHash ? LabRouter.parseHash() : null;
    var routeKey = page === 'paleo-mechanics' && parsed && parsed.module === page && parsed.segments[1]
      ? decodeURIComponent(parsed.segments[1])
      : '';
    if (page === 'paleo-mechanics') state.key = data[routeKey] ? routeKey : '';
    if (!keys.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Материалы пока не заполнены.</div>';
      return;
    }
    if (!state.key) {
      var paleoIcons = {
        'aleph': 'paleo/aleph.png',
        'bet': 'ui/home.png',
        'gimel': 'desert/camel.svg',
        'dalet': 'nav/door.png',
        'he': 'ui/anchor.png',
        'vav': 'ui/link.png',
        'zayin': 'weapons/sword.png',
        'het': 'ui/grid.png',
        'tet': 'ui/inbox.png',
        'yod': 'ui/group.png',
        'kaf': 'ui/group.png',
        'lamed': 'ui/arrows.png',
        'mem': 'ui/hourglass.png',
        'nun': 'paleo/track.png',
        'samekh': 'ui/info.png',
        'ayin': 'ui/question.png',
        'pe': 'ui/group.png',
        'tsade': 'ui/link.png',
        'qof': 'ui/group.png',
        'resh': 'paleo/track.png',
        'shin': 'ui/markbook.png',
        'tav': 'ui/check.png'
      };
      var defaultIcon = 'paleo/track.png';
      var docCards = keys.map(function(key, index) {
        var doc = data[key];
        var icon = paleoIcons[key] || defaultIcon;
        return '<a href="#" class="doc-card" data-key="' + escapeHtml(key) + '" style="animation-delay: ' + (index * 30) + 'ms">' +
          '<span class="doc-card-icon"><img src="assets/icons/32/' + icon + '" alt=""></span>' +
          '<span class="doc-card-body">' +
            '<span class="doc-card-title">' + escapeHtml(doc.title || key) + '</span>' +
            '<span class="doc-card-desc">' + escapeHtml((doc.description || '').split('---')[0].trim().substring(0, 80) + (doc.description && doc.description.length > 80 ? '...' : '')) + '</span>' +
          '</span>' +
          '<span class="doc-card-arrow" aria-hidden="true">→</span>' +
          '</a>';
      }).join('');
      var heading = page === 'paleo-mechanics' ? 'Палео-механика' : 'Методички';
      container.innerHTML = page === 'paleo-mechanics'
        ? '<div id="paleo-mechanics" class="paleo-mechanics-page"><div class="doc-grid" id="doc-grid">' + docCards + '</div></div>'
        : '<div class="research-page-head">' +
          '<h1><img src="assets/icons/32/crafts/hammer-and-chisel.png" class="lab-icon" alt="">' + heading + '</h1>' +
          '<p class="subtitle">Материалы ResearchLab, собранные из исходных Markdown-документов.</p>' +
          '</div>' +
          '<div class="doc-grid" id="doc-grid">' + docCards + '</div>';
      var docGrid = document.getElementById('doc-grid');
      if (docGrid) {
        docGrid.querySelectorAll('.doc-card').forEach(function(card) {
          card.addEventListener('click', function(e) {
            e.preventDefault();
            if (page === 'paleo-mechanics' && window.LabRouter) {
              LabRouter.navigate(page, [this.getAttribute('data-key')]);
              return;
            }
            state.key = this.getAttribute('data-key');
            renderDocumentPage(container, page, data);
          });
        });
      }
      return;
    }
    var documentData = data[state.key];
    var options = keys.map(function(key) {
      return '<option value="' + escapeHtml(key) + '"' + (key === state.key ? ' selected' : '') + '>' +
        escapeHtml(data[key].title || key) + '</option>';
    }).join('');
    var backBtn = page === 'paleo-mechanics'
      ? '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabRouter.navigate(\'paleo-mechanics\')">Назад к списку</button>'
      : '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="PageController.pageState[\'' + page + '\'].key=\'\';PageController.renderDocumentPage(document.getElementById(\'' + page + '\'), \'' + page + '\', PageController.jsonCache[\'' + page + '\'])">Назад к списку</button>';
    if (page === 'paleo-mechanics') {
      renderPaleoMechanicsDocument(container, documentData, options, backBtn);
      return;
    }
    var mechanismIndex = 0;
    var mechanismIcons = ['ui/question.png', 'ui/scales.png', 'paleo/track.png', 'ui/anchor.png', 'ui/diff.png', 'ui/arrows.png', 'ui/markbook.png'];
    var firstMechanismSummary = 'Система берёт два понятия, которые в иврите имеют ясное функциональное различие, и заменяет их моральной оценкой. Функция становится моралью. Пригодность становится «добром». Непригодность — «злом».';
    var sections = (documentData.sections || []).map(function(section) {
      var isMechanism = page === 'methodology' && /^\s*\d+[.)\-:]?\s+/.test(section.title || '');
      if (isMechanism) {
        var summary = String(section.content || '').replace(/\r/g, '').split(/\n\s*\n/)[0]
          .replace(/^\s*[-*]\s*/, '')
          .replace(/^\s*\*{0,2}Суть:\s*\*{0,2}/i, '')
          .replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
        if (mechanismIndex === 0) summary = firstMechanismSummary;
        summary = summary ? summary.charAt(0).toLocaleUpperCase('ru-RU') + summary.slice(1) : 'Краткое описание механизма подмены.';
        var icon = mechanismIcons[mechanismIndex % mechanismIcons.length];
        mechanismIndex++;
        return '<article class="research-section methodology-card"><div class="methodology-card-head"><h2><img src="assets/icons/32/' + icon + '" class="methodology-card-icon" alt="" aria-hidden="true">' + escapeHtml(section.title || '').replace(/^\s*\d+[.)\-:]?\s*/, '') + '</h2></div><div class="research-section-content"><p>' + escapeHtml(summary) + '</p></div></article>';
      }
      var content = typeof marked !== 'undefined' && marked.parse ? marked.parse(section.content || '') : escapeHtml(section.content || '');
      return '<article class="research-section"><h2>' + escapeHtml(section.title || '') + '</h2><div class="research-section-content">' + content + '</div></article>';
    }).join('');
    var heading = page === 'paleo-mechanics' ? (documentData.title || 'Палео-механика') : 'Методички';
    var documentDescription = escapeHtml(documentData.description || '');
    var paleoDescription = escapeHtml((documentData.description || '').replace(/---/g, '').trim());
    var documentHead = page === 'paleo-mechanics'
      ? '<div class="research-page-head"><h1>' + heading + '</h1>' +
        '<p class="subtitle text-muted">' + paleoDescription + '</p>' + backBtn + '</div>'
      : '<div class="research-page-head"><h1>' + heading + '</h1>' +
        '<p class="subtitle">Материалы ResearchLab, собранные из исходных Markdown-документов.</p></div>';
    container.innerHTML = documentHead +
      '<div class="research-controls"><label>Документ<select id="research-' + page + '-select" class="lab-input">' + options + '</select></label></div>' +
      (page === 'paleo-mechanics' ? '' : '<div class="research-meta">' + backBtn + '</div>') +
      (page === 'paleo-mechanics' ? '' : '<div class="research-description">' + documentDescription + '</div>') +
      '<div class="research-sections">' + sections + '</div>';
    var select = document.getElementById('research-' + page + '-select');
    if (select) select.addEventListener('change', function() {
      if (page === 'paleo-mechanics' && window.LabRouter) {
        LabRouter.navigate(page, [this.value]);
        return;
      }
      state.key = this.value;
      renderDocumentPage(container, page, data);
    });
  }

  function renderManifestPage(container, data) {
    var story = data.story || {};
    // Общая шапка LabHero — единственная шапка манифеста.
    // Крошки добавляет router.js, подзаголовок берём из данных манифеста.
    container._labHeroOverride = {
      title: story.title || data.title || 'Манифест проекта',
      subtitle: story.lead || data.description || ''
    };
    if (window.LabHero && LabHero.setView) {
      LabHero.setView('manifest', null, container._labHeroOverride);
      if (window.LabRouter) LabRouter.renderBreadcrumbs('manifest', LabRouter.parseHash());
    }
    var acts = story.acts || {};
    var problem = acts.problem || {};
    var methodology = acts.methodology || {};
    var application = acts.application || {};
    var practice = acts.practice || {};
    var paragraphs = function(items) {
      return (items || []).map(function(text) { return '<p>' + escapeHtml(text) + '</p>'; }).join('');
    };

    // Карта утрат — вертикальный стек слоёв без наложений.
    var lossHtml = (story.lossMap || []).map(function(layer, index) {
      var num = '0' + (index + 1);
      return '<li class="manifest-loss-layer">' +
        '<span class="manifest-loss-layer-num">' + num + '</span>' +
        '<div class="manifest-loss-layer-copy">' +
          '<h4 class="manifest-loss-layer-title">' + escapeHtml(layer.title) + '</h4>' +
          '<p class="manifest-loss-layer-text">' + escapeHtml(layer.text) + '</p>' +
        '</div>' +
        '<span class="manifest-loss-layer-percent">' + escapeHtml(layer.percent) + '</span>' +
      '</li>';
    }).join('');

    // Разбор Мицраим
    var mizraimSteps = (methodology.mizraim || []).map(function(step, index) {
      return '<li class="manifest-mizraim-step"><span class="manifest-mizraim-glyph paleo" lang="hbo">' + escapeHtml(step.glyph) + '</span>' +
        '<span class="manifest-mizraim-index">0' + (index + 1) + '</span><strong>' + escapeHtml(step.title) + '</strong><p>' + escapeHtml(step.text) + '</p></li>';
    }).join('');

    // Принцип потока
    var flow = methodology.flowPrinciple || {};
    var flowHtml = '';
    if (flow.title) {
      flowHtml = '<div class="manifest-flow">' +
        '<div class="manifest-section-heading"><div><span class="manifest-section-label">Принцип</span><h3>' + escapeHtml(flow.title) + '</h3></div></div>' +
        '<p class="manifest-flow-lead">' + escapeHtml(flow.lead || '') + '</p>' +
        '<p>' + escapeHtml(flow.body || '') + '</p>' +
        '<p class="manifest-flow-paleo"><span class="paleo" lang="hbo">' + escapeHtml(flow.paleoImage || '') + '</span></p>' +
        '<p class="manifest-flow-criterion">' + escapeHtml(flow.criterion || '') + '</p>' +
        '</div>';
    }

    // Эмет / Шекер
    var es = methodology.emetSheker || {};
    var emetShekerHtml = '';
    if (es.title) {
      var checksHtml = (es.checks || []).map(function(c, i) {
        return '<li><span class="manifest-es-check-num">' + (i + 1) + '</span><span>' + escapeHtml(c) + '</span></li>';
      }).join('');
      emetShekerHtml = '<div class="manifest-es">' +
        '<div class="manifest-section-heading"><div><span class="manifest-section-label">Критерий</span><h3>' + escapeHtml(es.title) + '</h3><p>' + escapeHtml(es.lead || '') + '</p></div></div>' +
        '<div class="manifest-es-pair">' +
          '<div class="manifest-es-card manifest-es-emet">' +
            '<div class="manifest-es-glyph paleo" lang="hbo">' + escapeHtml(es.emet.glyph) + '</div>' +
            '<h4>' + escapeHtml(es.emet.word) + '</h4>' +
            '<p class="manifest-es-meaning">' + escapeHtml(es.emet.meaning) + '</p>' +
            '<p class="manifest-es-paleo">' + escapeHtml(es.emet.paleoImage) + '</p>' +
          '</div>' +
          '<div class="manifest-es-card manifest-es-sheker">' +
            '<div class="manifest-es-glyph paleo" lang="hbo">' + escapeHtml(es.sheker.glyph) + '</div>' +
            '<h4>' + escapeHtml(es.sheker.word) + '</h4>' +
            '<p class="manifest-es-meaning">' + escapeHtml(es.sheker.meaning) + '</p>' +
            '<p class="manifest-es-paleo">' + escapeHtml(es.sheker.paleoImage) + '</p>' +
          '</div>' +
        '</div>' +
        '<ol class="manifest-es-checks">' + checksHtml + '</ol>' +
        '</div>';
    }

    // Давар
    var davar = methodology.davar || {};
    var davarHtml = '';
    if (davar.title) {
      var davarLetters = (davar.letters || []).map(function(l) {
        return '<div class="manifest-davar-letter">' +
          '<span class="manifest-davar-glyph paleo" lang="hbo">' + escapeHtml(l.glyph) + '</span>' +
          '<span class="manifest-davar-name">' + escapeHtml(l.name) + '</span>' +
          '<span class="manifest-davar-image">' + escapeHtml(l.image) + '</span>' +
        '</div>';
      }).join('');
      var exampleSteps = (davar.example && davar.example.steps || []).map(function(s, i) {
        return '<li><span class="manifest-davar-step-num">' + (i + 1) + '</span><span>' + escapeHtml(s) + '</span></li>';
      }).join('');
      davarHtml = '<div class="manifest-davar">' +
        '<div class="manifest-section-heading"><div><span class="manifest-section-label">Слово-действие</span><h3>' + escapeHtml(davar.title) + '</h3></div></div>' +
        '<p class="manifest-davar-lead">' + escapeHtml(davar.lead || '') + '</p>' +
        '<div class="manifest-davar-letters">' + davarLetters + '</div>' +
        '<p class="manifest-davar-assembly">' + escapeHtml(davar.assembly || '') + '</p>' +
        '<p class="manifest-davar-function">' + escapeHtml(davar.function || '') + '</p>' +
        '<p>' + escapeHtml(davar.body || '') + '</p>' +
        '<p class="manifest-davar-conclusion">' + escapeHtml(davar.conclusion || '') + '</p>' +
        (davar.example ? '<div class="manifest-davar-example">' +
          '<div class="manifest-davar-example-head">' +
            '<span class="manifest-davar-example-from">' + escapeHtml(davar.example.from) + '</span>' +
            '<span class="manifest-davar-example-davar paleo" lang="hbo">𐤃𐤁𐤓</span>' +
            '<span class="manifest-davar-example-text">' + escapeHtml(davar.example.davar) + '</span>' +
          '</div>' +
          '<ol class="manifest-davar-steps">' + exampleSteps + '</ol>' +
        '</div>' : '') +
        '</div>';
    }

    // История письменности
    var wh = methodology.writingHistory || [];
    var historyHtml = '';
    if (wh.length) {
      var historyItems = wh.map(function(h) {
        return '<li class="manifest-history-item"><span class="manifest-history-period">' + escapeHtml(h.period) + '</span>' +
          '<strong>' + escapeHtml(h.title) + '</strong><p>' + escapeHtml(h.text) + '</p></li>';
      }).join('');
      historyHtml = '<div class="manifest-history"><div class="manifest-section-heading"><div><span class="manifest-section-label">Слои письма</span><h3>' + escapeHtml(methodology.writingHistoryTitle || 'История письменности') + '</h3></div></div>' +
        '<ol class="manifest-history-list">' + historyItems + '</ol></div>';
    }

    // Прасемитский язык и протосинайская письменность
    var tl = methodology.twoLayers || {};
    var layersHtml = '';
    if (tl.title) {
      var layerCards = (tl.items || []).map(function(it) {
        return '<div class="manifest-layer-card"><h4>' + escapeHtml(it.title) + '</h4><p>' + escapeHtml(it.text) + '</p></div>';
      }).join('');
      var layerSteps = (tl.steps || []).map(function(s, i) {
        return '<li class="manifest-layer-step"><span class="manifest-layer-step-num">' + (i + 1) + '</span><span>' + escapeHtml(s) + '</span></li>';
      }).join('');
      layersHtml = '<div class="manifest-layers"><div class="manifest-section-heading"><div><span class="manifest-section-label">Два слоя</span><h3>' + escapeHtml(tl.title) + '</h3><p>' + escapeHtml(tl.lead || '') + '</p></div></div>' +
        '<div class="manifest-layers-pair">' + layerCards + '</div>' +
        ((tl.steps || []).length ? '<ol class="manifest-layers-steps">' + layerSteps + '</ol>' : '') + '</div>';
    }

    // ЙХВХ как последовательность действий
    var yh = methodology.yhvh || {};
    var yhvhHtml = '';
    if (yh.title) {
      var yhCells = (yh.letters || []).map(function(l, i, arr) {
        return '<div class="manifest-yhvh-cell"><span class="manifest-yhvh-glyph paleo" lang="hbo">' + escapeHtml(l.glyph) + '</span>' +
          '<span class="manifest-yhvh-name">' + escapeHtml(l.name) + '</span>' +
          '<span class="manifest-yhvh-fn">' + escapeHtml(l.function) + '</span></div>' +
          (i < arr.length - 1 ? '<span class="manifest-yhvh-arrow" aria-hidden="true">→</span>' : '');
      }).join('');
      yhvhHtml = '<div class="manifest-yhvh"><div class="manifest-section-heading"><div><span class="manifest-section-label">Последовательность</span><h3>' + escapeHtml(yh.title) + '</h3><p>' + escapeHtml(yh.lead || '') + '</p></div></div>' +
        '<div class="manifest-yhvh-seq">' + yhCells + '</div>' +
        '<p class="manifest-yhvh-assembly">' + escapeHtml(yh.assembly || '') + '</p></div>';
    }

    // Карта пространств — 16 состояний, сгруппированных по фазам потока
    var pad2 = function(n) { return (n < 10 ? '0' : '') + n; };
    var spaceGroups = [];
    var spaceGroupIdx = {};
    var spaceNum = 0;
    (story.spaces || []).forEach(function(space) {
      var gname = space.group || 'Состояния';
      if (!(gname in spaceGroupIdx)) {
        spaceGroupIdx[gname] = spaceGroups.length;
        spaceGroups.push({ name: gname, items: [] });
      }
      spaceNum++;
      var grp = spaceGroups[spaceGroupIdx[gname]];
      grp.items.push('<article class="lab-card manifest-space-card" style="animation-delay:' + ((grp.items.length - 1) * 40) + 'ms">' +
        '<span class="manifest-space-glyph paleo" lang="hbo" aria-hidden="true">' + escapeHtml(space.glyph) + '</span>' +
        '<span class="manifest-space-index">' + pad2(spaceNum) + ' · ' + escapeHtml(space.name) + '</span>' +
        '<h3>' + escapeHtml(space.title) + '</h3>' +
        '<p>' + escapeHtml(space.text) + '</p>' +
        '<p class="manifest-space-life"><strong>В жизни:</strong> ' + escapeHtml(space.life || '') + '</p>' +
        '<p class="manifest-space-examples"><strong>Примеры:</strong> ' + escapeHtml(space.examples || '') + '</p>' +
        '</article>');
    });
    var spacesHtml = spaceGroups.map(function(grp) {
      return '<div class="manifest-space-group"><h4 class="manifest-space-group-name">' + escapeHtml(grp.name) + '</h4>' +
        '<div class="manifest-spaces">' + grp.items.join('') + '</div></div>';
    }).join('');

    // Палео-стандарт — 22 буквы
    var paleoLetters = story.paleoStandard || [];
    var paleoGridHtml = paleoLetters.map(function(letter, index) {
      return '<button type="button" class="manifest-paleo-card" data-paleo-index="' + index + '" ' +
        'aria-label="' + escapeHtml(letter.name) + ' — ' + escapeHtml(letter.image) + ', функция: ' + escapeHtml(letter.function) + '">' +
        '<span class="manifest-paleo-glyph paleo" lang="hbo">' + escapeHtml(letter.glyph) + '</span>' +
        '<span class="manifest-paleo-name">' + escapeHtml(letter.name) + '</span>' +
        '<span class="manifest-paleo-image">' + escapeHtml(letter.image) + '</span>' +
        '<span class="manifest-paleo-function">' + escapeHtml(letter.function) + '</span>' +
        '</button>';
    }).join('');

    // Шаги применения
    var appSteps = (application.steps || []).map(function(step, index) {
      return '<li class="manifest-app-step"><span class="manifest-app-step-num">' + (index + 1) + '</span>' +
        '<div><strong>' + escapeHtml(step.title) + '</strong><p>' + escapeHtml(step.text) + '</p></div></li>';
    }).join('');

    // Связанные документы
    var relatedDocs = (application.relatedDocs || []).map(function(doc) {
      return '<a href="' + escapeHtml(doc.path) + '" class="manifest-related-doc">' + escapeHtml(doc.title) + '</a>';
    }).join('');

    // АКТ IV: блоки практики
    var protoItems = (practice.protocol || []).map(function(p, i) {
      var pqs = (p.questions || []).map(function(q) { return '<li>' + escapeHtml(q) + '</li>'; }).join('');
      return '<li class="manifest-proto-item" style="animation-delay:' + (i * 50) + 'ms">' +
        '<div class="manifest-proto-label">' + escapeHtml(p.label) + '</div>' +
        '<p class="manifest-proto-text">' + escapeHtml(p.text || '') + '</p>' +
        (pqs ? '<ul class="manifest-proto-questions">' + pqs + '</ul>' : '') + '</li>';
    }).join('');
    var protocolHtml = protoItems ? '<div class="manifest-practice-block manifest-proto"><div class="manifest-section-heading"><div><span class="manifest-section-label">Протокол</span><h3>' + escapeHtml(practice.protocolTitle || 'Ежедневный протокол') + '</h3></div></div>' +
      '<ol class="manifest-proto-list">' + protoItems + '</ol></div>' : '';

    var bt = practice.bodyTool || {};
    var btParts = (bt.parts || []).map(function(part, i) {
      return '<div class="manifest-body-part" style="animation-delay:' + (i * 50) + 'ms">' +
        '<span class="manifest-body-glyph paleo" lang="hbo">' + escapeHtml(part.glyph) + '</span>' +
        '<strong>' + escapeHtml(part.name) + '</strong>' +
        '<span class="manifest-body-fn">' + escapeHtml(part.function) + '</span>' +
        '<p>' + escapeHtml(part.text) + '</p></div>';
    }).join('');
    var bodyToolHtml = bt.title ? '<div class="manifest-practice-block manifest-body"><div class="manifest-section-heading"><div><span class="manifest-section-label">Живой алфавит</span><h3>' + escapeHtml(bt.title) + '</h3><p>' + escapeHtml(bt.lead || '') + '</p></div></div>' +
      '<div class="manifest-body-grid">' + btParts + '</div>' +
      (bt.rule ? '<p class="manifest-body-rule">' + escapeHtml(bt.rule) + '</p>' : '') + '</div>' : '';

    var en = practice.enemy || {};
    var trapItems = (en.traps || []).map(function(t, i) {
      return '<li class="manifest-trap"><span class="manifest-trap-num">' + (i + 1) + '</span><div><strong>' + escapeHtml(t.name) + '</strong><p>' + escapeHtml(t.text) + '</p></div></li>';
    }).join('');
    var enemyChecks = (en.checks || []).map(function(c) { return '<li>' + escapeHtml(c) + '</li>'; }).join('');
    var enemyHtml = en.title ? '<div class="manifest-practice-block manifest-enemy"><div class="manifest-section-heading"><div><span class="manifest-section-label">Пять ловушек</span><h3>' + escapeHtml(en.title) + '</h3><p>' + escapeHtml(en.lead || '') + '</p></div></div>' +
      '<ul class="manifest-traps">' + trapItems + '</ul>' +
      ((en.checks || []).length ? '<div class="manifest-enemy-checks"><strong>' + escapeHtml(en.checksTitle || 'Проверка') + '</strong><ul>' + enemyChecks + '</ul></div>' : '') + '</div>' : '';

    var ss = practice.seedSoil || {};
    var ssLetters = (ss.letters || []).map(function(l) {
      return '<div class="manifest-seed-letter"><span class="manifest-seed-glyph paleo" lang="hbo">' + escapeHtml(l.glyph) + '</span><strong>' + escapeHtml(l.name) + '</strong><p>' + escapeHtml(l.text) + '</p></div>';
    }).join('');
    var ssBuilds = (ss.builds || []).map(function(b) { return '<li>' + escapeHtml(b) + '</li>'; }).join('');
    var seedHtml = ss.title ? '<div class="manifest-practice-block manifest-seed"><div class="manifest-section-heading"><div><span class="manifest-section-label">Почва</span><h3>' + escapeHtml(ss.title) + '</h3><p>' + escapeHtml(ss.lead || '') + '</p></div></div>' +
      '<div class="manifest-seed-letters">' + ssLetters + '</div>' +
      ((ss.builds || []).length ? '<div class="manifest-seed-builds"><strong>' + escapeHtml(ss.buildsTitle || 'Что строить') + '</strong><ul>' + ssBuilds + '</ul></div>' : '') +
      '<p class="manifest-practice-conclusion">' + escapeHtml(ss.conclusion || '') + '</p></div>' : '';

    var mf = practice.moneyFlow || {};
    var mfTerms = (mf.terms || []).map(function(t) {
      return '<div class="manifest-money-term"><strong>' + escapeHtml(t.term) + '</strong><p>' + escapeHtml(t.text) + '</p></div>';
    }).join('');
    var mfRules = (mf.rules || []).map(function(r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('');
    var moneyHtml = mf.title ? '<div class="manifest-practice-block manifest-money"><div class="manifest-section-heading"><div><span class="manifest-section-label">Поток 𐤌</span><h3>' + escapeHtml(mf.title) + '</h3><p>' + escapeHtml(mf.lead || '') + '</p></div></div>' +
      '<div class="manifest-money-grid">' + mfTerms + '</div>' +
      ((mf.rules || []).length ? '<ul class="manifest-money-rules">' + mfRules + '</ul>' : '') +
      '<p class="manifest-practice-conclusion">' + escapeHtml(mf.conclusion || '') + '</p></div>' : '';

    var dl = practice.deathLegacy || {};
    var dlQuestions = (dl.questions || []).map(function(q) { return '<li>' + escapeHtml(q) + '</li>'; }).join('');
    var legacyHtml = dl.title ? '<div class="manifest-practice-block manifest-legacy"><div class="manifest-section-heading"><div><span class="manifest-section-label">Дверь 𐤃</span><h3>' + escapeHtml(dl.title) + '</h3><p>' + escapeHtml(dl.lead || '') + '</p></div></div>' +
      (dl.body ? '<p class="manifest-legacy-body">' + escapeHtml(dl.body) + '</p>' : '') +
      ((dl.questions || []).length ? '<ul class="manifest-legacy-questions">' + dlQuestions + '</ul>' : '') +
      '<p class="manifest-practice-conclusion">' + escapeHtml(dl.conclusion || '') + '</p></div>' : '';

    container.innerHTML = '<div class="manifest-progress" aria-hidden="true"><span class="manifest-progress-bar" id="manifest-progress-bar"></span></div>' +
      '<div class="manifest-toc" id="manifest-toc" aria-label="Навигация по манифесту">' +
      '<div class="manifest-toc-acts">' +
      '<a href="#manifest-act-problem" class="manifest-toc-link" data-toc="manifest-act-problem">Акт I · Проблема</a>' +
      '<a href="#manifest-act-methodology" class="manifest-toc-link" data-toc="manifest-act-methodology">Акт II · Методология</a>' +
      '<a href="#manifest-act-application" class="manifest-toc-link" data-toc="manifest-act-application">Акт III · Применение</a>' +
      '<a href="#manifest-act-practice" class="manifest-toc-link" data-toc="manifest-act-practice">Акт IV · Практика</a>' +
      '</div>' +
      '</div>' +
      '<div class="manifest-page">' +

      // АКТ I: ПРОБЛЕМА
      '<section class="manifest-act manifest-act-problem" id="manifest-act-problem" aria-labelledby="manifest-problem-title">' +
      '<div class="manifest-act-heading"><span class="manifest-act-number">I</span><div><span class="manifest-section-label">Акт I · проблема</span><h2 id="manifest-problem-title">' + escapeHtml(problem.title || 'Проблема') + '</h2></div></div>' +
      '<div class="manifest-story-copy">' + paragraphs(problem.paragraphs) + '</div>' +
      '<section class="manifest-loss-section lab-card" aria-labelledby="manifest-loss-title"><div class="manifest-section-heading manifest-loss-heading"><div><span class="manifest-section-label">Карта утрат</span><h3 id="manifest-loss-title">Как образ сжимается до понятия</h3></div></div><ol class="manifest-loss-map" aria-label="Карта утрат">' + lossHtml + '</ol></section>' +
      '</section>' +

      // АКТ II: МЕТОДОЛОГИЯ
      '<section class="manifest-act manifest-act-methodology" id="manifest-act-methodology" aria-labelledby="manifest-methodology-title">' +
      '<div class="manifest-act-heading"><span class="manifest-act-number">II</span><div><span class="manifest-section-label">Акт II · методология</span><h2 id="manifest-methodology-title">' + escapeHtml(methodology.title || 'Методология') + '</h2></div></div>' +
      '<div class="manifest-story-copy">' + paragraphs(methodology.paragraphs) + '</div>' +

      // История письменности + два слоя
      historyHtml +
      layersHtml +

      // Разбор Мицраим
      '<div class="manifest-mizraim"><div class="manifest-section-heading"><div><span class="manifest-section-label">Разбор слова</span><h3>Мицраим</h3><p>' + escapeHtml(methodology.mizraimLead || '') + '</p></div></div><ol class="manifest-mizraim-list">' + mizraimSteps + '</ol><p class="manifest-mizraim-conclusion">' + escapeHtml(methodology.mizraimConclusion || '') + '</p></div>' +

      // Принцип потока
      flowHtml +

      // Эмет / Шекер
      emetShekerHtml +

      // Давар
      davarHtml +

      // ЙХВХ как последовательность действий
      yhvhHtml +

      // Карта пространств
      '<section class="manifest-spaces-section" aria-labelledby="manifest-spaces-title"><div class="manifest-section-heading"><div><span class="manifest-section-label">Шестнадцать состояний среды</span><h3 id="manifest-spaces-title">Карта пространств</h3><p>Шестнадцать состояний и переходы между ними: от Тоху до Олама.</p></div></div>' + spacesHtml + '</section>' +

      // Палео-стандарт — интерактивная сетка 22 букв
      '<section class="manifest-paleo-section" aria-labelledby="manifest-paleo-title">' +
      '<div class="manifest-section-heading"><div><span class="manifest-section-label">Палео-стандарт</span><h3 id="manifest-paleo-title">Двадцать две буквы</h3><p>Наведи на букву — увидишь функцию. Нажми — получишь разбор.</p></div></div>' +
      '<div class="manifest-paleo-grid" id="manifest-paleo-grid">' + paleoGridHtml + '</div>' +
      '<div class="manifest-paleo-detail" id="manifest-paleo-detail" hidden aria-live="polite">' +
        '<div class="manifest-paleo-detail-glyph paleo" lang="hbo" id="manifest-paleo-detail-glyph"></div>' +
        '<div class="manifest-paleo-detail-info">' +
          '<h4 id="manifest-paleo-detail-name"></h4>' +
          '<p class="manifest-paleo-detail-image" id="manifest-paleo-detail-image"></p>' +
          '<p class="manifest-paleo-detail-function" id="manifest-paleo-detail-function"></p>' +
          '<p class="manifest-paleo-detail-desc" id="manifest-paleo-detail-desc"></p>' +
        '</div>' +
      '</div>' +
      '</section>' +

      '</section>' +

      // АКТ III: ПРИМЕНЕНИЕ
      '<section class="manifest-act manifest-act-application" id="manifest-act-application" aria-labelledby="manifest-application-title">' +
      '<div class="manifest-act-heading"><span class="manifest-act-number">III</span><div><span class="manifest-section-label">Акт III · применение</span><h2 id="manifest-application-title">' + escapeHtml(application.title || 'Применение') + '</h2></div></div>' +
      '<div class="manifest-story-copy">' + paragraphs(application.paragraphs) + '</div>' +
      (appSteps ? '<ol class="manifest-app-steps">' + appSteps + '</ol>' : '') +
      (relatedDocs ? '<div class="manifest-related"><div class="manifest-section-heading"><div><span class="manifest-section-label">Связанные документы</span><h3>Иди дальше</h3><p>Манифест говорит «что и зачем». Остальные документы — «как».</p></div></div><div class="manifest-related-list">' + relatedDocs + '</div></div>' : '') +
      '</section>' +

      // АКТ IV: ПРАКТИКА
      '<section class="manifest-act manifest-act-practice" id="manifest-act-practice" aria-labelledby="manifest-practice-title">' +
      '<div class="manifest-act-heading"><span class="manifest-act-number">IV</span><div><span class="manifest-section-label">Акт IV · практика</span><h2 id="manifest-practice-title">' + escapeHtml(practice.title || 'Практика') + '</h2></div></div>' +
      '<div class="manifest-story-copy manifest-practice-copy">' + paragraphs(practice.paragraphs) + '</div>' +
      protocolHtml +
      bodyToolHtml +
      enemyHtml +
      seedHtml +
      moneyHtml +
      legacyHtml +
      '<div class="manifest-cta-wrap"><a class="lab-btn lab-btn-primary manifest-cta" href="#dashboard">Начать исследование</a>' +
      '<a class="lab-btn lab-btn-secondary manifest-cta manifest-cta-secondary" href="#root-dictionary">Открыть корневой словарь</a></div>' +
      '</section>' +

      '</div>';

    // Инициализация интерактивности палео-сетки
    initManifestPaleoGrid(container, paleoLetters);

    // Инициализация интерактивности карты утрат
    initManifestLossMap(container);

    // Инициализация оглавления, scroll-spy и progress-bar
    initManifestNav(container);
  }

  // ===== НАВИГАЦИЯ ПО МАНИФЕСТУ: TOC + SCROLL-SPY + PROGRESS =====
  function initManifestNav(container) {
    var toc = container.querySelector('#manifest-toc');
    var progressBar = container.querySelector('#manifest-progress-bar');
    var actIds = ['manifest-act-problem', 'manifest-act-methodology', 'manifest-act-application', 'manifest-act-practice'];

    if (progressBar) {
      var doc = container;
      window.addEventListener('scroll', function() {
        var rect = doc.getBoundingClientRect();
        var total = doc.offsetHeight - window.innerHeight;
        if (total <= 0) return;
        var progress = Math.min(1, Math.max(0, -rect.top / total));
        progressBar.style.width = (progress * 100) + '%';
      }, { passive: true });
    }

    if (!toc) return;

    // Scroll-spy: подсветка текущего акта
    var links = toc.querySelectorAll('.manifest-toc-link');
    var spy = function() {
      var current = actIds[0];
      actIds.forEach(function(id) {
        var el = doc.querySelector('#' + id);
        if (!el) return;
        var rect = el.getBoundingClientRect();
        if (rect.top <= 120) current = id;
      });
      links.forEach(function(link) {
        link.classList.toggle('is-active', link.getAttribute('data-toc') === current);
      });
    };

    window.addEventListener('scroll', spy, { passive: true });
    spy();

    // Плавная прокрутка по якорям внутри SPA
    links.forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var id = this.getAttribute('data-toc');
        var target = doc.querySelector('#' + id);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ===== ИНТЕРАКТИВНОСТЬ ПАЛЕО-СЕТКИ =====
  function initManifestPaleoGrid(container, letters) {
    var grid = container.querySelector('#manifest-paleo-grid');
    if (!grid || !letters.length) return;

    var detail = container.querySelector('#manifest-paleo-detail');
    var detailGlyph = container.querySelector('#manifest-paleo-detail-glyph');
    var detailName = container.querySelector('#manifest-paleo-detail-name');
    var detailImage = container.querySelector('#manifest-paleo-detail-image');
    var detailFunction = container.querySelector('#manifest-paleo-detail-function');
    var detailDesc = container.querySelector('#manifest-paleo-detail-desc');

    var cards = grid.querySelectorAll('.manifest-paleo-card');
    cards.forEach(function(card) {
      // Hover — подсветка и показ функции (CSS обрабатывает визуал)
      card.addEventListener('mouseenter', function() {
        cards.forEach(function(c) { c.classList.remove('is-hovered'); });
        card.classList.add('is-hovered');
      });

      // Click — разбор буквы
      card.addEventListener('click', function() {
        var idx = parseInt(card.getAttribute('data-paleo-index'), 10);
        var letter = letters[idx];
        if (!letter) return;

        cards.forEach(function(c) { c.classList.remove('is-active'); });
        card.classList.add('is-active');

        if (detail) {
          detail.hidden = false;
          if (detailGlyph) detailGlyph.textContent = letter.glyph;
          if (detailName) detailName.textContent = letter.name + ' — ' + letter.image;
          if (detailImage) detailImage.textContent = 'Образ: ' + letter.image;
          if (detailFunction) detailFunction.textContent = 'Функция: ' + letter.function;
          if (detailDesc) detailDesc.textContent = letter.desc;
        }
      });

      // Keyboard support
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  // ===== ИНТЕРАКТИВНОСТЬ КАРТЫ УТРАТ =====
  function initManifestLossMap(container) {
    var cards = container.querySelectorAll('.manifest-loss-card');
    if (!cards.length) return;

    cards.forEach(function(card) {
      var detail = card.querySelector('.manifest-loss-card-detail');
      if (!detail) return;

      // Click — выезжающий блок с подробным описанием
      card.addEventListener('click', function() {
        var isOpen = !detail.hidden;
        // Закрываем все остальные
        cards.forEach(function(c) {
          var d = c.querySelector('.manifest-loss-card-detail');
          if (d && d !== detail) {
            d.hidden = true;
            c.classList.remove('is-expanded');
            c.setAttribute('aria-expanded', 'false');
          }
        });
        // Переключаем текущую
        detail.hidden = isOpen;
        card.classList.toggle('is-expanded', !isOpen);
        card.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
      });

      // Keyboard support
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  // ===== ПРИМЕНЕНИЕ QUERY-ПАРАМЕТРА =====
  function applyQueryParam(parsed, inputId, isReady, run, attempt) {
    var query = parsed && parsed.params && parsed.params.q;
    if (!query) return;
    var input = document.getElementById(inputId);
    if (input) input.value = query;
    attempt = attempt || 0;
    if (!isReady() && attempt < 20) {
      setTimeout(function() { applyQueryParam(parsed, inputId, isReady, run, attempt + 1); }, 150);
      return;
    }
    run(query);
  }

  function renderAgentDetail(container, agentId) {
    var detail = container.querySelector('#agent-detail-view');
    var list = container.querySelector('.agent-list-view');
    var agent = (agentMapData || []).filter(function(item) { return item.id === agentId; })[0];
    if (!detail || !agent) return;
    if (list) list.hidden = true;
    detail.hidden = false;
    if (window.LabHero && window.LabHero.setView) {
      window.LabHero.setView('ai-agents', 'agent', { kicker: 'ALEPHY · AI-AGENTS', title: agent.name, subtitle: agent.desc, icon: agent.icon + '.png', meta: [agent.cat, agent.model, 'Готов к запуску'] });
    }
    detail.innerHTML = '<div class="agent-detail-page">' +
      '<div class="agent-detail-grid"><section class="agent-detail-section agent-detail-wide"><h2>Запуск агента</h2><form id="agent-run-form"><label for="agent-run-input">Запрос</label><textarea id="agent-run-input" class="lab-textarea agent-prompt" rows="4">разбери слово Берешит</textarea><button type="submit" class="lab-btn lab-btn-primary" id="agent-run-button">Запустить</button></form></section>' +
      '<section class="agent-detail-section agent-detail-wide"><h2>Результат</h2><pre id="agent-run-output" class="agent-output" aria-live="polite">Результат появится после запуска.</pre></section></div>' +
      '<button type="button" class="lab-btn lab-btn-secondary agent-detail-back" onclick="LabRouter.navigate(\'ai-agents\')">К списку агентов</button></div>';
    var form = detail.querySelector('#agent-run-form');
    var input = detail.querySelector('#agent-run-input');
    var output = detail.querySelector('#agent-run-output');
    var button = detail.querySelector('#agent-run-button');
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      var query = input.value.trim();
      if (!query) return;
      button.disabled = true;
      output.textContent = 'Запуск пайплайна…';
      checkAgentServer().then(function() {
        return fetch(AGENT_API_URL + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query }) });
      })
        .then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function(result) { output.textContent = JSON.stringify(result, null, 2); })
        .catch(function(error) { output.innerHTML = isAgentServerUnavailable(error) ? agentServerMessage() : 'Ошибка запуска: ' + escapeHtml(error.message); })
        .then(function() { button.disabled = false; });
    });
  }

  function showAgentList(container) {
    if (window.LabHero && window.LabHero.setView) window.LabHero.setView('ai-agents', null);
    var detail = container.querySelector('#agent-detail-view');
    var list = container.querySelector('.agent-list-view');
    var pipelines = container.querySelector('.agent-pipelines-view');
    if (detail) detail.hidden = true;
    if (pipelines) pipelines.hidden = true;
    if (list) list.hidden = false;
  }

  function openAgentPipelines(container) {
    if (!agentMapData) agentMapData = getAgentMapData();
    var list = container.querySelector('.agent-list-view');
    var detail = container.querySelector('#agent-detail-view');
    var mapView = container.querySelector('.agent-map-view');
    var pipelines = container.querySelector('.agent-pipelines-view');
    var pipelineDetail = container.querySelector('.pipeline-detail-page');
    if (pipelineDetail) pipelineDetail.remove();
    if (!pipelines) {
      pipelines = document.createElement('section');
      pipelines.className = 'agent-pipelines-view';
      container.appendChild(pipelines);
    }
    if (list) list.hidden = true;
    if (detail) detail.hidden = true;
    if (mapView) mapView.hidden = true;
    pipelines.hidden = false;
    if (container.id === 'pipelines' && window.LabHero && window.LabHero.setView) window.LabHero.setView('pipelines', null);
    pipelines.innerHTML =
      '<div class="pipeline-control-panel"><div><div class="pipeline-server-status" data-pipeline-server-status data-status="checking"><span class="pipeline-server-dot" aria-hidden="true"></span><span>Проверка сервера…</span></div></div><div class="pipeline-page-actions"><button type="button" class="lab-btn lab-btn-primary pipeline-create-btn" data-pipeline-create>Создать пайплайн</button><button type="button" class="lab-btn lab-btn-secondary" data-pipelines-back>К агентам</button></div></div>' +
      '<div class="agent-pipelines-status lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка локальных пайплайнов…</div></div>';
    pipelines.querySelector('[data-pipelines-back]').addEventListener('click', function() {
      LabRouter.navigate('ai-agents');
    });
    checkAgentServer().then(function() {
      updatePipelineServerStatus(pipelines, true);
    }).catch(function() {
      updatePipelineServerStatus(pipelines, false);
    });
    var pipelinesRequest = fetch('data/pipelines.json').then(function(response) {
      if (!response.ok) throw new Error('Локальный JSON недоступен');
      return response.json();
    }).catch(function() {
      return fetch(AGENT_API_URL + '/api/pipelines').then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
    });
    var resultsRequest = fetch(AGENT_API_URL + '/api/pipeline-results').then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).catch(function() {
      return fetch('data/pipeline-results.json').then(function(response) {
        if (!response.ok) throw new Error('Готовые результаты недоступны');
        return response.json();
      }).catch(function() {
        return [];
      });
    });
    Promise.all([pipelinesRequest, resultsRequest]).then(function(payload) {
      renderAgentPipelines(container, pipelines, payload[0], payload[1]);
    }).catch(function(error) {
      var status = pipelines.querySelector('.agent-pipelines-status');
      if (status) status.outerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить локальные и серверные пайплайны: ' + escapeHtml(error.message) + '</div>';
    });
  }

  function updatePipelineServerStatus(pipelines, isOnline) {
    var status = pipelines.querySelector('[data-pipeline-server-status]');
    if (!status) return;
    status.dataset.status = isOnline ? 'online' : 'offline';
    status.querySelector('span:last-child').textContent = isOnline ? 'Сервер запущен' : 'Сервер отключен';
  }

  function renderAgentPipelines(container, pipelines, data, results) {
    var cards = (Array.isArray(data) ? data : []).map(function(pipeline) {
      var result = findPipelineResult(results, pipeline.id);
      var agents = (pipeline.agents || []).map(function(agentName, agentIndex) {
        var agent = (agentMapData || []).filter(function(item) { return item.name === agentName; })[0] || { name: agentName, desc: 'Участник цепочки передачи контекста.', icon: 'paleo/track' };
        return (agentIndex ? '<span class="pipeline-flow-arrow" aria-hidden="true">→</span>' : '') + '<li class="pipeline-timeline-step" tabindex="0" title="' + escapeHtml(agent.desc) + '" data-agent-name="' + escapeHtml(agent.name) + '" data-status="pending"><img src="assets/icons/32/' + escapeHtml(agent.icon) + '.png" alt=""><span class="pipeline-status-dot" aria-hidden="true"></span><div><strong>' + escapeHtml(agent.name) + '</strong><small>' + escapeHtml(agent.desc) + '</small></div></li>';
      }).join('');
      var isLoop = pipeline.type === 'loop' || pipeline.type === 'spiral';
      var loopBadge = isLoop ? '<span class="pipeline-loop-badge" title="' + (pipeline.type === 'spiral' ? 'Спираль: каждый виток расширяет горизонт (Хук Свива)' : 'Цикл: обратная связь до сходимости') + '">' + (pipeline.type === 'spiral' ? '↺ спираль' : '↺ цикл') + '</span>' : '';
      var loopClose = isLoop ? '<li class="pipeline-loop-close" title="Возврат в начало витка">↺ в начало</li>' : '';
      var resultButton = '<button type="button" class="lab-btn lab-btn-secondary pipeline-view-btn" data-pipeline-details>Открыть результат</button>';
      return '<article class="agent-pipeline-card" data-pipeline-id="' + escapeHtml(pipeline.id) + '"><div class="pipeline-card-head"><div class="pipeline-card-title"><img src="assets/icons/32/paleo/track.png" alt=""><h3>' + escapeHtml(pipeline.name) + '</h3>' + loopBadge + '<span class="pipeline-status-badge" data-pipeline-run-status data-status="' + (result ? 'done' : 'pending') + '">' + (result ? 'Готовый результат' : 'Ожидание запуска') + '</span></div><div class="agent-pipeline-actions"><button type="button" class="pipeline-icon-btn" data-pipeline-edit aria-label="Редактировать пайплайн">✎</button><button type="button" class="pipeline-icon-btn pipeline-delete" data-pipeline-delete aria-label="Удалить пайплайн">✕</button></div></div><p class="agent-pipeline-route">' + escapeHtml(pipeline.description || 'Цепочка передачи контекста') + '</p><ol class="pipeline-timeline" aria-label="Этапы пайплайна">' + agents + loopClose + '</ol><div class="pipeline-card-buttons"><button type="button" class="lab-btn lab-btn-primary pipeline-run-btn" data-pipeline-run>Запустить локально</button>' + resultButton + '<button type="button" class="lab-btn lab-btn-secondary pipeline-detail-btn" data-pipeline-details>Подробнее</button></div></article>';
    }).join('');
    pipelines.querySelector('.agent-pipelines-status').outerHTML = '<div class="agent-pipelines-grid">' + (cards || '<div class="lab-alert lab-alert-info">Пайплайны пока не созданы.</div>') + '</div>';
    pipelines.querySelector('[data-pipeline-create]').addEventListener('click', function() { openPipelineModal(container, pipelines, null); });
    pipelines.querySelectorAll('[data-pipeline-edit]').forEach(function(button) {
      button.addEventListener('click', function() { openPipelineModal(container, pipelines, findPipeline(data, this.closest('[data-pipeline-id]').dataset.pipelineId)); });
    });
    pipelines.querySelectorAll('[data-pipeline-delete]').forEach(function(button) {
      button.addEventListener('click', function() { deletePipeline(container, pipelines, data, this.closest('[data-pipeline-id]').dataset.pipelineId); });
    });
    pipelines.querySelectorAll('[data-pipeline-run]').forEach(function(button) {
      button.addEventListener('click', function() { runPipeline(this.closest('[data-pipeline-id]'), findPipeline(data, this.closest('[data-pipeline-id]').dataset.pipelineId)); });
    });
    pipelines.querySelectorAll('[data-pipeline-details]').forEach(function(button) {
      button.addEventListener('click', function() { LabRouter.navigate('pipelines', [this.closest('[data-pipeline-id]').dataset.pipelineId]); });
    });
  }

  function runPipeline(card, pipeline) {
    var steps = Array.prototype.slice.call(card.querySelectorAll('.pipeline-timeline-step'));
    var status = card.querySelector('[data-pipeline-run-status]');
    var button = card.querySelector('[data-pipeline-run]');
    if (!steps.length || !pipeline || button.disabled) return;
    button.disabled = true;
    steps.forEach(function(step) { step.dataset.status = 'pending'; });
    status.textContent = 'Запуск локальной цепочки…';
    status.dataset.status = 'running';
    fetch(AGENT_API_URL + '/api/pipelines/' + encodeURIComponent(pipeline.id) + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: pipeline.defaultQuery || '' }) }).then(function(response) {
      if (!response.ok) return response.json().then(function(error) { throw new Error(error.error || 'HTTP ' + response.status); });
      return response.json();
    }).then(function(result) {
      var trace = result.trace || [];
      steps.forEach(function(step, index) { step.dataset.status = trace[index] ? 'done' : 'pending'; });
      status.textContent = 'Готово';
      status.dataset.status = 'done';
      LabRouter.navigate('pipelines', [pipeline.id]);
    }).catch(function(error) {
      steps.forEach(function(step) { step.dataset.status = 'error'; });
      status.textContent = isAgentServerUnavailable(error) ? 'Сервер отключен' : 'Ошибка запуска';
      status.dataset.status = 'error';
      alert(isAgentServerUnavailable(error) ? 'Сервер AI-Агентов отключен. Готовые результаты доступны в карточках.' : 'Не удалось запустить пайплайн: ' + error.message);
    }).then(function() {
      button.disabled = false;
    });
  }

  function findPipelineResult(results, pipelineId) {
    return (Array.isArray(results) ? results : []).filter(function(item) { return item.pipelineId === pipelineId && item.status === 'ready'; })[0] || null;
  }

  function showPipelineResult(result) {
    if (!result) return;
     var body = result.result || {};
    var modal = document.createElement('div');
    modal.className = 'pipeline-modal';
    modal.innerHTML = '<div class="pipeline-modal-backdrop" data-pipeline-close></div><section class="pipeline-dialog" role="dialog" aria-modal="true" aria-label="Результат пайплайна"><div class="pipeline-form-body"><h2>' + escapeHtml(result.title || 'Результат пайплайна') + '</h2><p class="agent-pipeline-route">' + escapeHtml(result.query || '') + '</p>' + (body.aiSummary ? '<p class="pipeline-ai-summary"><strong>Сводка Ollama (' + escapeHtml(result.ollama && result.ollama.model || 'local') + ')</strong><br>' + escapeHtml(body.aiSummary) + '</p>' : '') + '<p>' + escapeHtml(body.summary || 'Результат собран локально.') + '</p><p class="pipeline-result-limitations">' + escapeHtml(body.limitations || 'Выводы требуют сверки с указанными источниками.') + '</p><details><summary>След цепочки</summary><pre class="pipeline-result-data">' + escapeHtml(JSON.stringify(body.data || { trace: result.trace || [] }, null, 2)) + '</pre></details><div class="pipeline-page-actions"><button type="button" class="lab-btn lab-btn-secondary" data-pipeline-close>Закрыть</button></div></div></section>';
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-pipeline-close]').forEach(function(button) { button.addEventListener('click', function() { modal.remove(); }); });
  }

  function loadPipelineDetailData() {
    return Promise.all([
      fetch('data/pipelines.json').then(function(response) { return response.json(); }),
      fetch(AGENT_API_URL + '/api/pipeline-results').then(function(response) { return response.json(); }).catch(function() {
        return fetch('data/pipeline-results.json').then(function(response) { return response.json(); });
      })
    ]);
  }

  function formatPipelineDate(value) {
    if (!value) return 'нет данных';
    var date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
  }

  function downloadPipelineFile(filename, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 0);
  }

  function renderPipelineDetail(container, pipelineId) {
    container.innerHTML = '<div class="pipeline-detail-page"><div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка процесса пайплайна…</div></div></div>';
    loadPipelineDetailData().then(function(payload) {
      var pipeline = findPipeline(payload[0], pipelineId);
      if (!pipeline) {
        if (window.LabHero && window.LabHero.setView) window.LabHero.setView('pipelines', null);
        container.innerHTML = '<div class="lab-alert lab-alert-error">Пайплайн не найден. <a href="#pipelines">К списку</a></div>';
        return;
      }
      var history = (payload[1] || []).filter(function(item) { return item.pipelineId === pipelineId; });
      var latest = findPipelineResult(history, pipelineId);
      var body = latest && latest.result || {};
      var steps = (pipeline.agents || []).map(function(agent, index) {
        var trace = latest && (latest.trace || [])[index];
        var detail = latest && (latest.agentTrace || [])[index];
        var evidence = detail ? '<details><summary>Доступный срез этапа</summary><pre>' + escapeHtml(JSON.stringify(detail, null, 2)) + '</pre></details>' : '';
        return '<li class="pipeline-process-step" data-status="' + (trace ? 'done' : 'pending') + '"><span>' + (index + 1) + '</span><div><strong>' + escapeHtml(agent) + '</strong><p>' + (trace ? 'Этап в сохранённом следе: <code>' + escapeHtml(trace) + '</code>.' : 'нет сохранённого факта выполнения.') + '</p>' + evidence + '</div></li>';
      }).join('');
      if (window.LabHero && window.LabHero.setView) {
        window.LabHero.setView('pipelines', 'pipeline', { title: pipeline.name, subtitle: pipeline.description || 'Цепочка передачи контекста', icon: 'paleo/track.png', meta: [latest ? 'Есть сохранённый запуск' : 'Ожидание запуска'] });
      }
      container.innerHTML = '<article class="pipeline-detail-page"><div class="pipeline-back-container"><button type="button" class="lab-btn lab-btn-secondary" data-pipeline-back>К пайплайнам</button></div><section class="pipeline-detail-card"><h2>Запуск</h2><label>Запрос<textarea class="lab-input" data-pipeline-query rows="3">' + escapeHtml(latest && latest.query || pipeline.defaultQuery || '') + '</textarea></label><div class="pipeline-card-buttons"><button class="lab-btn lab-btn-primary" data-pipeline-detail-run>Запустить локально</button><button class="lab-btn lab-btn-secondary" data-pipeline-detail-open-result>Открыть результат</button><button class="lab-btn lab-btn-secondary" data-pipeline-detail-copy>Копировать результат</button><button class="lab-btn lab-btn-secondary" data-pipeline-detail-json>Экспорт JSON</button><button class="lab-btn lab-btn-secondary" data-pipeline-detail-markdown>Экспорт Markdown</button></div><p class="pipeline-run-status" data-pipeline-detail-status>Последний запуск: ' + escapeHtml(latest ? formatPipelineDate(latest.createdAt) : 'нет') + '</p></section><div class="pipeline-detail-grid"><section class="pipeline-detail-card"><h2>Цепочка процесса</h2><p class="pipeline-detail-note">Показаны доступные факты выполнения. Скрытые рассуждения не отображаются.</p><ol class="pipeline-process-list">' + steps + '</ol></section><section class="pipeline-detail-card" id="pipeline-result"><h2>Результат</h2><p>' + escapeHtml(body.aiSummary || body.summary || 'Запустите локальный пайплайн, чтобы получить результат.') + '</p>' + (body.limitations ? '<p class="pipeline-result-limitations"><strong>Ограничения:</strong> ' + escapeHtml(body.limitations) + '</p>' : '') + '</section></div><section class="pipeline-detail-card"><h2>История запусков</h2><ul class="pipeline-detail-history">' + (history.map(function(item) { return '<li><strong>' + escapeHtml(item.title || pipeline.name) + '</strong><span>' + escapeHtml(formatPipelineDate(item.createdAt)) + '</span><p>' + escapeHtml(item.query || '') + '</p></li>'; }).join('') || '<li>Сохранённых запусков пока нет.</li>') + '</ul></section></article>';
      var status = container.querySelector('[data-pipeline-detail-status]');
      container.querySelector('[data-pipeline-back]').addEventListener('click', function() { window.location.hash = 'pipelines'; });
      container.querySelector('[data-pipeline-detail-open-result]').addEventListener('click', function() { var result = document.getElementById('pipeline-result'); if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      container.querySelector('[data-pipeline-detail-run]').addEventListener('click', function() {
        var button = this;
        button.disabled = true;
        status.textContent = 'Пайплайн выполняется и сохраняется…';
        fetch(AGENT_API_URL + '/api/pipelines/' + encodeURIComponent(pipeline.id) + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: container.querySelector('[data-pipeline-query]').value.trim() }) }).then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then(function() { renderPipelineDetail(container, pipelineId); }).catch(function(error) { button.disabled = false; status.textContent = 'Не удалось запустить: ' + error.message; });
      });
      container.querySelector('[data-pipeline-detail-copy]').addEventListener('click', function() {
        var text = body.aiSummary || body.summary || '';
        if (!text || !navigator.clipboard) { status.textContent = 'Копирование недоступно в этом браузере.'; return; }
        navigator.clipboard.writeText(text).then(function() { status.textContent = 'Результат скопирован.'; }).catch(function() { status.textContent = 'Не удалось скопировать результат.'; });
      });
      container.querySelector('[data-pipeline-detail-json]').addEventListener('click', function() { downloadPipelineFile(pipeline.id + '-result.json', JSON.stringify({ pipeline: pipeline, result: latest || null }, null, 2), 'application/json'); });
      container.querySelector('[data-pipeline-detail-markdown]').addEventListener('click', function() { downloadPipelineFile(pipeline.id + '-result.md', '# ' + pipeline.name + '\n\n' + (body.aiSummary || body.summary || '') + '\n\n## Ограничения\n\n' + (body.limitations || ''), 'text/markdown'); });
    }).catch(function(error) { container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить процесс: ' + escapeHtml(error.message) + '</div>'; });
  }

  function findPipeline(pipelines, id) {
    return pipelines.filter(function(item) { return item.id === id; })[0] || null;
  }

  function openPipelineModal(container, pipelines, pipeline) {
    var modal = document.createElement('div');
    modal.className = 'pipeline-modal';
    modal.innerHTML = '<div class="pipeline-modal-backdrop" data-pipeline-close></div><form class="pipeline-dialog"><div class="modal-header"><h3>' + (pipeline ? 'Редактировать пайплайн' : 'Новый пайплайн') + '</h3><button type="button" class="modal-close" data-pipeline-close aria-label="Закрыть">×</button></div><div class="pipeline-form-body"><label>Название<input name="name" class="lab-input" required maxlength="100" value="' + escapeHtml(pipeline ? pipeline.name : '') + '"></label><label>Краткое описание<textarea name="description" class="lab-textarea" rows="3" maxlength="240">' + escapeHtml(pipeline ? pipeline.description : '') + '</textarea></label><label>Тип<select name="type" class="lab-select" data-pipeline-type><option value="linear">Линейный</option><option value="loop">Цикл</option><option value="spiral">Спираль</option></select></label><label>Максимум итераций<input name="maxIterations" type="number" class="lab-input" min="1" max="30" value="' + (pipeline && pipeline.maxIterations ? pipeline.maxIterations : 5) + '"></label><fieldset><legend>Агенты по порядку</legend><div class="pipeline-agent-list" data-pipeline-agent-list></div><div class="pipeline-agent-add"><select class="lab-select" data-pipeline-agent-select><option value="">Выберите агента</option>' + agentMapData.map(function(agent) { return '<option value="' + escapeHtml(agent.name) + '">' + escapeHtml(agent.name) + '</option>'; }).join('') + '</select><button type="button" class="lab-btn lab-btn-secondary" data-pipeline-agent-add>Добавить</button></div></fieldset></div><div class="modal-footer"><button type="button" class="lab-btn lab-btn-secondary" data-pipeline-close>Отмена</button><button type="submit" class="lab-btn lab-btn-primary">Сохранить</button></div></form>';
    document.body.appendChild(modal);
    var list = modal.querySelector('[data-pipeline-agent-list]');
    var typeSelect = modal.querySelector('[data-pipeline-type]');
    if (typeSelect) typeSelect.value = (pipeline && pipeline.type) || 'linear';
    var selected = (pipeline && pipeline.agents || []).slice();
    function renderSelected() { list.innerHTML = selected.map(function(agent, index) { return '<div class="pipeline-agent-row"><span>' + (index + 1) + '. ' + escapeHtml(agent) + '</span><button type="button" data-agent-up aria-label="Поднять">↑</button><button type="button" data-agent-down aria-label="Опустить">↓</button><button type="button" data-agent-remove aria-label="Удалить">✕</button></div>'; }).join('') || '<span class="text-muted">Добавьте хотя бы одного агента.</span>'; }
    renderSelected();
    modal.querySelector('[data-pipeline-agent-add]').addEventListener('click', function() { var value = modal.querySelector('[data-pipeline-agent-select]').value; if (value && selected.indexOf(value) === -1) { selected.push(value); renderSelected(); } });
    list.addEventListener('click', function(event) { var row = event.target.closest('.pipeline-agent-row'); if (!row) return; var index = Array.prototype.indexOf.call(list.children, row); if (event.target.hasAttribute('data-agent-up') && index > 0) { var item = selected.splice(index, 1)[0]; selected.splice(index - 1, 0, item); } if (event.target.hasAttribute('data-agent-down') && index < selected.length - 1) { var next = selected.splice(index, 1)[0]; selected.splice(index + 1, 0, next); } if (event.target.hasAttribute('data-agent-remove')) selected.splice(index, 1); renderSelected(); });
    modal.querySelectorAll('[data-pipeline-close]').forEach(function(button) { button.addEventListener('click', function() { modal.remove(); }); });
    modal.querySelector('form').addEventListener('submit', function(event) { event.preventDefault(); var form = new FormData(event.target); if (!selected.length) { alert('Добавьте хотя бы одного агента.'); return; } savePipeline(container, pipelines, pipeline, { name: form.get('name'), description: form.get('description'), agents: selected, type: form.get('type') || 'linear', maxIterations: parseInt(form.get('maxIterations'), 10) || 5 }).then(function() { modal.remove(); }); });
  }

  function savePipeline(container, pipelines, pipeline, payload) {
    return fetch(AGENT_API_URL + '/api/pipelines' + (pipeline ? '/' + encodeURIComponent(pipeline.id) : ''), { method: pipeline ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function(response) { if (!response.ok) return response.json().then(function(error) { throw new Error(error.error || 'HTTP ' + response.status); }); return response.json(); }).then(function() { openAgentPipelines(container); });
  }

  function deletePipeline(container, pipelines, data, id) {
    if (!window.confirm('Удалить этот пайплайн?')) return;
    fetch(AGENT_API_URL + '/api/pipelines/' + encodeURIComponent(id), { method: 'DELETE' }).then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then(function() { openAgentPipelines(container); }).catch(function(error) { alert('Не удалось удалить пайплайн: ' + error.message); });
  }

  // ===== ОСНОВНОЙ МЕТОД РЕНДЕРИНГА =====
  function render(moduleId, container, parsed) {
    console.log('[PC] Рендерим модуль:', moduleId, container);
    if (!container) return;

    if (container.dataset.loading === '1') {
      applyModuleHero(moduleId, container, parsed);
      if (window.LabRouter) LabRouter.renderBreadcrumbs(moduleId, parsed);
      return;
    }

    if (container.dataset.loaded && container.innerHTML.trim() !== '') {
      if (moduleId === 'scripture-reader' && window.ScriptureReader) {
        window.ScriptureReader.init(parsed);
      }
      if (moduleId === 'methodology' && window.MethodologyLab) {
        window.MethodologyLab.init(container, parsed);
      }
      if (moduleId === 'states' && window.AlephyStates) {
        window.AlephyStates.init(parsed);
      }
      if (moduleId === 'learn' && window.LearnLab) {
        window.LearnLab.applyRoute(parsed);
      }
      if (moduleId === 'researches' && window.LoadResearches) {
        window.LoadResearches.render(container, parsed);
      }
      if (moduleId === 'timeline' && window.Timeline) {
        window.Timeline.applyRoute(parsed);
      }
      if (moduleId === 'dictionaries' && jsonCache.dictionaries) {
        renderDictionaries(container, jsonCache.dictionaries);
      }
      if (moduleId === 'paleo-mechanics' && jsonCache['paleo-mechanics']) {
        renderDocumentPage(container, 'paleo-mechanics', jsonCache['paleo-mechanics']);
      }
      if (moduleId === 'ai-agents' && parsed && parsed.segments && parsed.segments[1]) {
        renderAgentDetail(container, parsed.segments[1]);
      } else if (moduleId === 'ai-agents') {
        showAgentList(container);
            } else if (moduleId === 'pipelines') {
        if (parsed && parsed.segments && parsed.segments[1]) renderPipelineDetail(container, parsed.segments[1]);
        else openAgentPipelines(container);
      }
      if (moduleId === 'workbench' && window.Workbench) {
        window.Workbench.applyRoute(parsed);
      }
      if (moduleId === 'club' && window.ClubModule) {
        window.ClubModule._setCardId(parsed && parsed.segments && parsed.segments[1] && parsed.segments[1] !== 'discussions' && parsed.segments[1] !== 'create' && parsed.segments[1] !== 'sessions' ? parsed.segments[1] : null);
        window.ClubModule.render(container.querySelector('#club-app') || container, parsed);
      }
      if (moduleId === 'paleo-keyboard' && window.PaleoKey) PaleoKey.init();
      // Шапка должна обновиться и при перерисовке уже загруженного модуля
      applyModuleHero(moduleId, container, parsed);
      if (window.LabRouter) LabRouter.renderBreadcrumbs(moduleId, parsed);
      return;
    }

    switch (moduleId) {

      // ===== СТАТИЧЕСКИЕ МОДУЛИ (HTML встроен) =====
      case 'dashboard':
        container.innerHTML = '<div id="dashboard-widgets" class="dashboard-widgets"><div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка статистики…</div></div></div>';
        container.dataset.loaded = '1';
        if (window.Dashboard) window.Dashboard.init();
        break;

      case 'analyzers':
      case 'layer-analyzer':
      case 'ai-analyzer':
      case 'dialect-analyzer':
      case 'state-analyzer':
        container.innerHTML = '';
        container.dataset.loaded = '1';
        if (window.AlephyAnalyzers) window.AlephyAnalyzers.render(container, moduleId);
        break;

      case 'pipelines':
        container.dataset.loaded = '1';
        if (parsed && parsed.segments && parsed.segments[1]) renderPipelineDetail(container, parsed.segments[1]);
        else openAgentPipelines(container);
        break;

      case 'workbench':
        container.innerHTML = '<div id="workbench-app" aria-live="polite"></div>';
        container.dataset.loaded = '1';
        if (window.Workbench) window.Workbench.applyRoute(parsed);
        break;

      case 'club':
        container.innerHTML = '<div id="club-app"></div><div id="club-session-archive"></div><div id="club-discussions"></div>';
        container.dataset.loaded = '1';
        if (window.ClubModule) {
          var app = container.querySelector('#club-app');
          window.ClubModule._setCardId(parsed && parsed.segments && parsed.segments[1] && parsed.segments[1] !== 'discussions' && parsed.segments[1] !== 'create' && parsed.segments[1] !== 'sessions' ? parsed.segments[1] : null);
          window.ClubModule.render(app, parsed);
        }
        break;

      case 'root-dictionary':
        container.innerHTML = '<h1><img src="assets/icons/32/ui/book.png" class="lab-icon" alt="">Корневой словарь</h1>' +
          '<p class="subtitle">Поиск по корням иврита. Введите корень, слово или значение. Граф использует только палео-письмо.</p>' +
          '<div class="search-wrap"><input type="text" id="rd-search" class="lab-input" placeholder="אמן, AMN, верить..." oninput="if(window.RootsSearch)RootsSearch.filter(this.value)" autofocus></div>' +
          '<div class="rd-stats"><div class="rd-stat"><div class="num" id="rd-total">150</div><div class="label">Корней</div></div><div class="rd-stat"><div class="num" id="rd-found">0</div><div class="label">Найдено</div></div></div>' +
          '<div id="rd-spinner" class="rd-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка словаря…</div></div>' +
          '<div id="rd-list"></div><div id="rd-pagination" class="rd-pagination"></div>' +
          '<div id="rd-empty" class="lab-alert lab-alert-info" style="display:none">Ничего не найдено.</div>';
        container.dataset.loaded = '1';
        applyQueryParam(parsed, 'rd-search',
          function() { return !!window._roots; },
          function(query) { RootsSearch.filter(query); });
        if (window.RootDict) {
          RootDict.init();
          RootDict.applyRoute(parsed);
        }
        break;

      case 'paleo-glossary':
        container.innerHTML = '<div class="paleo-glossary-page">' +
          '<header class="paleo-glossary-head">' +
          '<div class="paleo-glossary-icon" aria-hidden="true">𐤌</div>' +
          '<div><p class="paleo-glossary-kicker">АЛЕФИ · ИНСТРУМЕНТЫ</p><h1>Палео-глоссарий</h1>' +
          '<p class="subtitle">Первая партия: 100 слов как русла потока — палео-форма, квадратное письмо, функция и корень.</p></div>' +
          '</header>' +
          '<div class="paleo-glossary-controls">' +
          '<label class="paleo-glossary-search">Поиск<input id="paleo-glossary-search" class="lab-input" type="search" placeholder="Палео-форма, слово или транслитерация" autocomplete="off"></label>' +
          '<label>Корень<select id="paleo-glossary-root" class="lab-input"><option value="all">Все корни</option></select></label>' +
          '</div>' +
          '<div id="paleo-glossary-meta" class="paleo-glossary-meta" aria-live="polite"></div>' +
          '<div id="paleo-glossary-grid" class="paleo-glossary-grid"></div>' +
          '<nav id="paleo-glossary-pagination" class="paleo-glossary-pagination" aria-label="Страницы глоссария"></nav>' +
          '</div>';
        container.dataset.loaded = '1';
        if (window.PaleoGlossary) window.PaleoGlossary.init(container);
        break;

      case 'word-analyzer':
        container.innerHTML = '<textarea id="wa-input" class="lab-textarea" rows="8" placeholder="אמת, תורה, שלום&#10;משיח&#10;צדק, חסד"></textarea>' +
          '<div class="flex gap-8 mb-16">' +
          '<button class="lab-btn lab-btn-primary" onclick="WordAnalyzer.analyze()"><img src="assets/icons/32/archaeology/testtube.svg" width="32" height="32" alt="Разобрать" style="vertical-align: middle; margin-right: 6px;"> Разобрать</button>' +
          '<button class="lab-btn lab-btn-secondary" onclick="document.getElementById(\'wa-input\').value=\'\';document.getElementById(\'wa-grid\').innerHTML=\'\';document.getElementById(\'wa-export\').style.display=\'none\';document.getElementById(\'wa-status\').className=\'lab-alert lab-alert-info\';document.getElementById(\'wa-status\').textContent=\'Введите слова для разбора.\'"><img src="assets/icons/32/nav/alert.png" width="32" height="32" alt="Очистить" style="vertical-align: middle; margin-right: 6px;"> Очистить</button>' +
          '</div>' +
          '<div id="wa-status" class="lab-alert lab-alert-info">Введите слова для разбора.</div>' +
          '<div id="wa-export" class="export-bar" style="display:none">' +
          '<span class="export-title">Экспорт</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="WordAnalyzer.copyMarkdown()">Копировать Markdown</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="WordAnalyzer.downloadTxt()">Скачать TXT</button>' +
          '</div>' +
          '<div id="wa-grid" class="wa-grid"></div>';
        container.dataset.loaded = '1';
        applyQueryParam(parsed, 'wa-input',
          function() { return typeof WordAnalyzer !== 'undefined'; },
          function() { WordAnalyzer.analyze(); });
        break;

      case 'learn':
        container.innerHTML = '<div id="learn-app" aria-live="polite"></div>';
        container.dataset.loaded = '1';
        if (window.LearnLab) window.LearnLab.init();
        if (window.LearnLab) window.LearnLab.applyRoute(parsed);
        break;

      case 'etymology-checker':
        container.innerHTML = '<h1><img src="assets/icons/32/archaeology/testtube.svg" class="lab-icon" alt="">Чекер этимологии</h1>' +
          '<p class="subtitle">Проверь слово на соответствие палео-корням, образам и карте утрат</p>' +
          '<div class="search-wrap"><input type="text" id="el-input" class="lab-input" placeholder="Введите слово на иврите..." onkeydown="if(event.key===\'Enter\')EtymologyLab.analyze()"><button class="lab-btn lab-btn-primary" onclick="EtymologyLab.analyze()">Разобрать</button></div>' +
          '<div id="el-results"></div>';
        container.dataset.loaded = '1';
        if (window.EtyLab || window.EtymologyLab) (window.EtyLab || window.EtymologyLab).init();
        break;

      case 'scripture-reader':
        container.innerHTML = '<div class="research-page-head scripture-reader-head">' +
          '<h1><img src="assets/icons/32/ui/book.png" class="lab-icon" alt="">Книгочтение</h1>' +
          '<p class="subtitle">Книги Танаха, засвидетельствованные в кумранских свитках. Чтение на палео-иврите с последовательным просмотром стихов.</p>' +
          '</div>' +
          '<div id="scripture-verse-nav" class="scripture-verse-nav" style="display:none;" aria-label="Выбор главы и стиха"></div>' +
          '<div class="scripture-reader-layout"><main class="scripture-main">' +
          '<div class="scripture-search" id="scripture-search">' +
          '<label class="scripture-category-label" for="scripture-category">Категория</label>' +
          '<select class="scripture-category-select" id="scripture-category" aria-label="Категория книг">' +
          '<option value="">Все книги</option>' +
          '</select>' +
          '<input type="search" class="scripture-search-input" id="scripture-search-input" placeholder="Поиск по книгам…" aria-label="Поиск по книгам">' +
          '</div>' +
          '<div id="scripture-book-grid" class="scripture-book-grid"></div>' +
          '<article class="scripture-verse" id="scripture-verse-article" style="display:none;" aria-labelledby="scripture-verse-title">' +
          '<div class="scripture-verse-meta" id="scripture-verse-title">Берешит 1:1</div>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm scripture-copy-button scripture-copy-verse" id="scripture-copy-verse" aria-label="Копировать стих" title="Копировать стих">' +
          '<svg class="scripture-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="11" rx="1.5"></rect><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"></path></svg>' +
          '</button>' +
          '<div id="scripture-paleo" class="scripture-paleo" dir="rtl" lang="hbo" aria-label="Палео-иврит"></div>' +
          '<div id="scripture-hebrew" class="scripture-hebrew" dir="rtl" lang="he"></div>' +
          '<div id="scripture-translit" class="scripture-translit"></div>' +
          '</article>' +
          '<nav class="scripture-navigation" id="scripture-navigation" style="display:none;" aria-label="Навигация по стихам">' +
          '<button type="button" class="lab-btn lab-btn-secondary" id="scripture-prev">Предыдущий стих</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" id="scripture-next">Следующий стих</button>' +
          '</nav>' +
          '<section id="scripture-analysis" class="scripture-analysis scripture-physics" style="display:none;" aria-live="polite">' +
          '<button type="button" class="scripture-physics-trigger" id="scripture-physics-trigger" aria-expanded="false" aria-controls="scripture-physics-panel">' +
          '<span class="scripture-physics-trigger-title">Физика слова</span>' +
          '<span class="scripture-physics-trigger-hint">Нажми на слово для разбора</span>' +
          '<span class="scripture-physics-chevron" aria-hidden="true">⌄</span>' +
          '</button>' +
          '<div class="scripture-physics-panel" id="scripture-physics-panel" hidden>' +
          '<div id="scripture-physics-content" class="scripture-physics-content">Выберите слово палео-текста.</div>' +
          '</div>' +
          '</section>' +
          '<section id="scripture-tools" class="scripture-tools" style="display:none;" aria-label="Инструменты исследователя">' +
          '<button type="button" class="lab-btn lab-btn-secondary scripture-tool" id="scripture-tool-analysis" aria-label="Открыть анализ выбранного слова"><img src="assets/icons/32/ui/diff.png" alt="" aria-hidden="true"><span>Разобрать</span></button>' +
          '<button type="button" class="lab-btn lab-btn-secondary scripture-tool" id="scripture-tool-save" aria-label="Сохранить свидетельство выбранного слова"><img src="assets/icons/32/ui/download.png" alt="" aria-hidden="true"><span>Сохранить</span></button>' +
          '</section>' +
          '</main>' +
          '</div>';
        container.dataset.loaded = '1';
        if (window.ScriptureReader) window.ScriptureReader.init(parsed);
        break;

      case 'investigation':
        container.innerHTML = '<header class="section-hero">' +
          '<div class="section-hero-watermark" aria-hidden="true">𐤀 𐤁 𐤂 𐤃 𐤄 𐤅</div>' +
          '<div class="section-hero-kicker">АЛЕФИ · ЧЕКЕР ПОДМЕН</div>' +
          '<h1><img src="assets/icons/32/ui/question.png" class="lab-icon" alt="">Чекер подмен</h1>' +
          '<p class="section-hero-lead">Введите слово, корень или перевод. Сопоставьте происхождение, цепочку подмен и текстовые свидетельства.</p>' +
        '</header>' +
          '<form id="investigation-form" class="investigation-search" onsubmit="event.preventDefault(); Investigation.investigate();">' +
          '<label for="investigation-input">Объект расследования</label>' +
          '<div class="investigation-search-row"><input type="search" id="investigation-input" class="lab-input" placeholder="חסד, милость, HSD..." autocomplete="off" required>' +
          '<button type="submit" class="lab-btn lab-btn-primary" id="investigation-submit"><img src="assets/icons/32/ui/question.png" width="24" height="24" alt="">Расследовать</button></div>' +
          '<div id="investigation-status" class="investigation-status" role="status" aria-live="polite">Данные загружаются из словаря корней и словарей подмен.</div>' +
          '</form>' +
          '<div id="investigation-result" class="investigation-result" aria-live="polite"></div>';
        container.dataset.loaded = '1';
        break;

      case 'board':
        container.innerHTML = '<div class="board-shell" id="research-board-app">' +
          '<div class="board-toolbar" role="toolbar" aria-label="Инструменты исследовательской доски">' +
          '<div class="board-toolbar-heading"><span class="board-kicker">ХУК / СВИВА</span><h1>Исследовательская доска</h1></div>' +
          '<div class="board-actions">' +
          '<button type="button" class="lab-btn lab-btn-primary" data-board-action="add">+ Карточка</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" data-board-action="connect">Связать</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" data-board-action="group">Собрать группу</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" data-board-action="export">Экспорт</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" data-board-action="import">Импорт</button>' +
          '<button type="button" class="lab-btn lab-btn-danger" data-board-action="reset">Очистить</button>' +
          '<input type="file" accept="application/json" data-board-import-input hidden>' +
          '</div>' +
          '</div>' +
          '<div class="board-help" data-board-status>Карточки — факты и слои разбора. Перетаскивайте их; клик открывает полный Давар. Для группы отметьте карточки флажками.</div>' +
          '<div class="board-workspace" data-board-workspace tabindex="0" aria-label="Поле исследовательской доски">' +
          '<svg class="board-connections" data-board-svg aria-hidden="true"></svg>' +
          '<div class="board-groups" data-board-groups></div>' +
          '<div class="board-cards" data-board-cards></div>' +
          '<div class="board-empty" data-board-empty><strong>Доска пока пуста</strong><span>Добавьте первую карточку, чтобы собрать цепочку смысла.</span></div>' +
          '</div>' +
          '<aside class="board-inspector" data-board-inspector hidden></aside>' +
          '<div class="board-modal" data-board-modal hidden>' +
          '<div class="board-modal-backdrop" data-board-close-modal></div>' +
          '<form class="board-dialog" data-board-card-form>' +
          '<div class="board-dialog-header"><div><span class="board-kicker">КАРТОЧКА</span><h2 data-board-form-title>Новая карточка</h2></div><button type="button" class="board-dialog-close" data-board-close-modal aria-label="Закрыть">×</button></div>' +
          '<label>Заголовок<input name="title" required maxlength="120" placeholder="Например: Слой перевода"></label>' +
          '<label>Краткое описание<textarea name="summary" rows="2" maxlength="280" placeholder="Что фиксирует эта карточка?"></textarea></label>' +
          '<label>Полное содержимое<textarea name="content" rows="8" placeholder="Цитата, наблюдение, аргумент или последовательность действий"></textarea></label>' +
          '<div class="board-dialog-actions"><button type="button" class="lab-btn lab-btn-danger" data-board-delete-card>Удалить</button><span></span><button type="button" class="lab-btn lab-btn-secondary" data-board-close-modal>Отмена</button><button type="submit" class="lab-btn lab-btn-primary">Сохранить</button></div>' +
          '</form>' +
          '</div>' +
          '</div>';
        container.dataset.loaded = '1';
        if (window.ResearchBoard) window.ResearchBoard.init(container);
        break;

      case 'board-generator':
        container.innerHTML = '<h1><img src="assets/icons/32/scribe/scroll.png" class="lab-icon" alt="">Генератор исследовательских досок</h1>' +
          '<p class="subtitle">Создавайте визуальные доски для анализа улик, выводов и вложений. Экспортируйте в PNG, PDF или TXT.</p>' +
          '<form id="board-form">' +
          '<div style="margin-bottom:20px"><label style="display:block;font-weight:600;margin-bottom:6px">Заголовок доски <span style="color:var(--accent-red)">*</span></label>' +
          '<input type="text" id="board-title" required placeholder="Например: Анализ перевода Берешит 1:1" style="width:100%;padding:10px 12px;font-family:\'EB Garamond\',Georgia,serif;font-size:16px;border:1px solid var(--border-light);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);outline:none"></div>' +
          '<div style="margin-bottom:20px"><label style="display:block;font-weight:600;margin-bottom:6px">Вывод / главная улика <span style="color:var(--accent-red)">*</span></label>' +
          '<textarea id="main-conclusion" required rows="3" placeholder="Краткий вывод или основная улика..." style="width:100%;padding:10px 12px;font-family:\'EB Garamond\',Georgia,serif;font-size:16px;border:1px solid var(--border-light);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);outline:none;resize:vertical"></textarea></div>' +
          '<div style="margin-bottom:20px"><label style="display:block;font-weight:600;margin-bottom:8px">Улики</label><div id="evidence-list"></div>' +
          '<button type="button" onclick="addEvidence()" class="lab-btn lab-btn-secondary lab-btn-sm" style="margin-top:8px">+ Добавить улику</button></div>' +
          '<div style="margin-bottom:20px"><label style="display:block;font-weight:600;margin-bottom:8px">Вложения</label><div id="attachments-list"></div>' +
          '<button type="button" onclick="addAttachment()" class="lab-btn lab-btn-secondary lab-btn-sm" style="margin-top:8px">+ Добавить вложение</button></div>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">' +
          '<button type="button" onclick="generateBoard()" class="lab-btn lab-btn-primary lab-btn-compact" style="flex:1;min-width:200px">Сгенерировать доску</button></div>' +
          '<div id="export-section" style="display:none;padding:16px;background:var(--bg-primary);border:1px solid var(--border-light);border-radius:4px">' +
          '<h3 style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:20px;font-weight:600;margin-bottom:12px">Экспорт</h3>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button type="button" onclick="exportPNG()" class="lab-btn lab-btn-secondary lab-btn-sm">PNG</button>' +
          '<button type="button" onclick="exportPDF()" class="lab-btn lab-btn-secondary lab-btn-sm">PDF</button>' +
          '<button type="button" onclick="exportTXT()" class="lab-btn lab-btn-secondary lab-btn-sm">TXT</button>' +
          '<button type="button" onclick="copyPrompt()" class="lab-btn lab-btn-secondary lab-btn-sm">Копировать промпт</button></div></div>' +
          '</form>' +
          '<div style="margin-top:24px"><h2 style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:24px;font-weight:600;text-align:center;margin-bottom:16px">Предпросмотр доски</h2>' +
          '<div id="board-preview" style="display:none"></div>' +
          '<div id="board-placeholder" style="text-align:center;padding:60px 20px;color:var(--text-muted);font-style:italic;font-size:16px">Заполните форму и нажмите «Сгенерировать доску».</div></div>' +
          '<div id="copy-toast" style="position:fixed;top:24px;left:50%;transform:translateX(-50%);background:var(--bg-dark);color:var(--text-light);padding:10px 24px;font-size:14px;font-family:\'EB Garamond\',Georgia,serif;opacity:0;pointer-events:none;z-index:999;border-radius:4px;border:1px solid var(--accent-gold);transition:opacity 0.4s">Скопировано!</div>';
        container.dataset.loaded = '1';
        break;

      case 'research-generator':
        container.innerHTML = '<h1><img src="assets/icons/32/crafts/hammer-and-chisel.png" class="lab-icon" alt="">Генератор исследований</h1>' +
          '<p class="subtitle">Выберите тип исследования, укажите тему и получите основу в формате Markdown.</p>' +
          '<form id="research-generator-form" class="research-generator-form" onsubmit="event.preventDefault(); PageController.generateResearch();">' +
          '<div class="research-generator-fields">' +
          '<label for="rg-type">Тип исследования</label>' +
          '<select id="rg-type" class="lab-select">' +
          '<option value="root">Корень</option><option value="term">Термин</option><option value="verse">Стих</option><option value="substitution">Подмена</option><option value="free">Свободная тема</option>' +
          '</select>' +
          '<label for="rg-topic">Тема</label>' +
          '<input type="text" id="rg-topic" class="lab-input" placeholder="Например: חֶסֶד или подмена смысла слова «закон»" required>' +
          '<button type="submit" class="lab-btn lab-btn-primary" id="rg-generate">Сгенерировать</button>' +
          '</div>' +
          '</form>' +
          '<div id="rg-status" class="lab-alert lab-alert-info" role="status">Заполните тему и выберите тип исследования.</div>' +
          '<div id="rg-export" class="export-bar research-generator-export" style="display:none">' +
          '<span class="export-title">Экспорт</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="PageController.downloadResearchTxt()">Скачать TXT</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="PageController.copyResearchMarkdown()">Копировать Markdown</button>' +
          '</div>' +
          '<section class="research-preview-wrap" aria-labelledby="rg-preview-title">' +
          '<h2 id="rg-preview-title">Превью</h2>' +
          '<div id="rg-preview" class="research-preview" aria-live="polite">' +
          '<p class="research-preview-placeholder">Здесь появится оформленный шаблон исследования.</p>' +
          '</div>' +
          '</section>';
        container.dataset.loaded = '1';
        break;

      case 'religionism-checker':
        container.innerHTML = '<h1><img src="assets/icons/32/ui/question.png" width="32" height="32" alt="Чекер религионимов" style="vertical-align: middle; margin-right: 6px;"> Чекер религионимов</h1>' +
          '<p class="subtitle">Проверка текста на подмены. Вставьте текст на русском — мы подсветим религионизмы.</p>' +
          '<textarea id="rc-input" class="lab-textarea" rows="6" placeholder="Вставьте текст, например: Господь Бог сказал Моисею..."></textarea>' +
          '<div class="flex gap-8 items-center mb-16">' +
          '<button class="lab-btn lab-btn-primary" onclick="RelChecker.check()"><img src="assets/icons/32/ui/question.png" width="32" height="32" alt="Проверить" style="vertical-align: middle; margin-right: 6px;"> Проверить текст</button>' +
          '<button class="lab-btn lab-btn-secondary" onclick="RelChecker.clear()"><img src="assets/icons/32/nav/alert.png" width="32" height="32" alt="Очистить" style="vertical-align: middle; margin-right: 6px;"> Очистить</button></div>' +
          '<div id="rc-result" class="lab-card" style="display:none;"><div class="lab-card-header"><img src="assets/icons/32/scribe/scroll.png" width="32" height="32" alt="Результат" style="vertical-align: middle; margin-right: 6px;"> Результат проверки</div><div class="lab-card-body" id="rc-body"></div></div>' +
          '<div class="lab-card"><div class="lab-card-header"><img src="assets/icons/32/ui/book.png" width="32" height="32" alt="Словарь" style="vertical-align: middle; margin-right: 6px;"> Словарь подмен</div><div class="lab-card-body" id="rc-dict"></div></div>';
        container.dataset.loaded = '1';
        if (window.RelChecker) window.RelChecker.init();
        break;

      case 'religionisms':
        container.innerHTML = '<h1><img src="assets/icons/32/ui/question.png" width="32" height="32" alt="Религионизмы" style="vertical-align: middle; margin-right: 6px;"> Религионизмы</h1>' +
          '<p class="subtitle">Каждая сфера, учреждённая человеком вне откровения Яхве — структурированный шекер со своим алтарём, жрецами и жертвами. 9 компонентов на каждую сферу.</p>' +
          '<div class="search-wrap"><input type="text" id="rel-search" class="lab-input" placeholder="Медицина, алтарь, жрец..." oninput="if(window.Religionisms)Religionisms.filter(this.value)"></div>' +
          '<div id="rel-grid" class="rel-grid"></div>' +
          '<div id="rel-detail" class="rel-detail" style="display:none;"></div>' +
          '<div id="rel-empty" class="lab-alert lab-alert-info" style="display:none">Ничего не найдено.</div>';
        container.dataset.loaded = '1';
        if (window.Religionisms) Religionisms.init();
        break;

      case 'board-library':
        container.innerHTML = '<h1><img src="assets/icons/32/scribe/scrolls.png" width="32" height="32" alt="Архив досок" style="vertical-align: middle; margin-right: 6px;"> Архив досок</h1>' +
          '<p class="subtitle">Архив сохранённых исследовательских досок. Просмотр, экспорт и управление.</p>' +
          '<div class="flex gap-8 mb-16"><button class="lab-btn lab-btn-secondary" onclick="BoardLib.clearAll()"><img src="assets/icons/32/nav/alert.png" width="32" height="32" alt="Очистить" style="vertical-align: middle; margin-right: 6px;"> Очистить всё</button></div>' +
          '<div id="bl-list"></div>' +
          '<div id="bl-empty" class="lab-alert lab-alert-info">Пока нет сохранённых досок.</div>';
        container.dataset.loaded = '1';
        break;

      case 'vision':
        container.innerHTML = '<h1><img src="assets/icons/32/archaeology/lamp.png" width="32" height="32" alt="Визуальный анализатор" style="vertical-align: middle; margin-right: 6px;"> Визуальный анализатор</h1>' +
          '<p class="subtitle">Загрузите изображение для анализа. Модель опишет содержимое: текст, символы, объекты.</p>' +
          '<div class="flex gap-8 mb-16">' +
          '<button class="lab-btn lab-btn-primary" data-mode="huggingface" onclick="VisionUI.setMode(\'huggingface\')"><i data-lucide="cloud" aria-hidden="true"></i> Hugging Face API</button>' +
          '<button class="lab-btn lab-btn-secondary" data-mode="local" onclick="VisionUI.setMode(\'local\')"><i data-lucide="server" aria-hidden="true"></i> Локальный сервер</button></div>' +
          '<div class="lab-card"><div class="lab-card-header"><img src="assets/icons/32/nav/door.png" width="32" height="32" alt="Настройки" style="vertical-align: middle; margin-right: 6px;"> Настройки</div><div class="lab-card-body">' +
          '<label class="mb-8" style="display:block;font-weight:600;">API ключ Hugging Face</label>' +
          '<div class="text-small text-muted mb-8"><a href="https://huggingface.co/settings/tokens" target="_blank" style="color:#b8860b;">Получить бесплатный ключ</a></div>' +
          '<div class="flex gap-8"><input type="password" id="vi-apikey" class="lab-input" placeholder="hf_xxxxxxxxxxxx" style="max-width:400px;" />' +
          '<button class="lab-btn lab-btn-secondary" onclick="VisionUI.saveKey()"><i data-lucide="save" aria-hidden="true"></i> Сохранить</button></div></div></div>' +
          '<div class="lab-card" style="text-align:center;cursor:pointer;" onclick="document.getElementById(\'vi-file\').click()">' +
          '<div id="vi-preview" style="display:none;margin-bottom:12px;">' +
          '<img id="vi-img" src="" alt="preview" style="max-width:100%;max-height:300px;border-radius:4px;border:1px solid #d4c4a8;" />' +
          '<button class="lab-btn lab-btn-secondary mt-8" onclick="event.stopPropagation();VisionUI.remove()"><i data-lucide="trash-2" aria-hidden="true"></i> Удалить</button></div>' +
          '<div id="vi-placeholder"><span><img src="assets/icons/32/ui/placeholder.svg" width="32" height="32" alt="Изображение" style="vertical-align: middle; margin-right: 6px;"></span><div style="font-size:18px;color:#2c1810;margin-top:8px;">Нажмите, чтобы загрузить</div>' +
          '<div class="text-muted text-small mt-8">PNG, JPG, WEBP — до 10 МБ</div></div>' +
          '<input type="file" id="vi-file" accept="image/png,image/jpeg,image/jpg,image/webp" style="display:none;" onchange="VisionUI.load(event)" /></div>' +
          '<button class="lab-btn lab-btn-primary" id="vi-analyze-btn" onclick="VisionUI.analyze()" disabled style="width:100%;justify-content:center;padding:14px;font-size:18px;margin-bottom:16px;"><i data-lucide="image" aria-hidden="true"></i> Анализировать</button>' +
          '<div id="vi-spinner" class="lab-spinner"><div class="loader"></div><div class="spinner-text">Анализ…</div></div>' +
          '<div id="vi-result" class="lab-card" style="display:none;"><div class="lab-card-header"><img src="assets/icons/32/scribe/scroll.png" width="32" height="32" alt="Результат" style="vertical-align: middle; margin-right: 6px;"> Результат</div><div class="lab-card-body" id="vi-result-body" style="white-space:pre-wrap;"></div>' +
          '<div class="text-muted text-small mt-8 flex justify-between"><span id="vi-model-badge">SmolVLM-256M</span><span id="vi-timestamp"></span></div></div>' +
          '<div id="vi-error" class="lab-alert lab-alert-error" style="display:none;"></div>';
        container.dataset.loaded = '1';
        break;

      case 'ai-agents':
        var agents = getAgentMapData();
        agentMapData = agents;
        var cards = agents.map(function(a) {
          return '<button type="button" class="tool-card agent-card agent-list-card' + (a.featured ? ' agent-card-orchestrator' : '') + '" data-agent-id="' + a.id + '" onclick="LabRouter.navigate(\'ai-agents\',[\'' + a.id + '\'])" aria-label="Открыть страницу агента: ' + a.name + '"><span class="tool-icon"><img src="assets/icons/32/' + a.icon + '.png" width="32" height="32" alt="' + a.name + '"></span>' +
            '<div class="tool-name">' + a.name + '</div>' +
            '<div class="tool-desc">' + a.desc + '</div>' +
            '<span class="tool-badge model agent-list-model">' + a.model + '</span>' +
            '<span class="agent-list-role" hidden>' + a.cat + '</span>' +
            '<span class="badge-category">' + a.cat + '</span>' +
            '<span class="badge-dev ' + (a.featured ? 'badge-dev-active' : 'badge-dev-progress') + '">' + (a.featured ? 'Активен' : 'В разработке') + '</span></button>';
        }).join('');
        container.innerHTML = '<div class="agent-list-view"><div class="agent-grid">' + cards + '</div></div>' +
          '<div id="agent-detail-view" class="agent-detail-view" hidden></div>' +
          '<div id="agent-map-view" class="agent-map-view" hidden></div>';
        var agentControls = document.createElement('section');
        agentControls.className = 'agent-controls-panel';
        agentControls.setAttribute('aria-label', 'Управление агентами');
        agentControls.innerHTML = '<button type="button" class="lab-btn lab-btn-primary agent-control-button" data-agent-map-open><img src="assets/icons/32/ui/web.png" alt="" aria-hidden="true"><span>Карта агентов</span></button>';
        container.insertBefore(agentControls, container.querySelector('.agent-list-view'));
        agentControls.querySelector('[data-agent-map-open]').addEventListener('click', function() {
          if (window.AgentMap) window.AgentMap.open();
        });
        container.dataset.loaded = '1';
        if (parsed && parsed.segments && parsed.segments[1]) {
          renderAgentDetail(container, parsed.segments[1]);
        }
        break;

      case 'agent-server':
        if (window.AgentServer) window.AgentServer.open(container);
        container.dataset.loaded = '1';
        break;

      case 'ed-chat':
        container.innerHTML = '<h1><img src="assets/icons/32/crafts/hammer-and-chisel.png" width="32" height="32" alt="Нейрочат" style="vertical-align: middle; margin-right: 6px;"> Нейрочат</h1>' +
          '<p class="subtitle">Чат с исследовательской нейросетью для анализа, разбора слов и поиска подмен.</p>' +
          '<div class="ec-layout"><main class="ec-main" aria-labelledby="ec-dialog-title">' +
          '<header class="ec-head"><h2 class="ec-head-title" id="ec-dialog-title">Диалог</h2><span class="ec-count" id="ec-count" aria-label="Сообщений в диалоге">0</span><div class="ec-model"><button type="button" id="ec-model" class="ec-model-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="ec-model-list" aria-label="Модель"><span class="ec-model-name" id="ec-model-name"></span><i data-lucide="chevron-down" aria-hidden="true"></i></button><ul id="ec-model-list" class="ec-model-list" role="listbox" aria-label="Список моделей" hidden></ul></div></header>' +
          '<p class="ec-note-row"><span class="ec-model-label" id="ec-model-label"></span><span class="ec-tokens" id="ec-tokens" hidden></span></p>' +
          '<div class="ec-messages" id="ec-messages"></div>' +
          '<div class="ec-composer"><div class="ec-composer-row"><textarea id="ec-input" class="lab-textarea ec-input" rows="1" placeholder="Введите запрос..." aria-label="Запрос к модели" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();EdChat.send();}"></textarea><button type="button" class="lab-btn lab-btn-primary ec-send" onclick="EdChat.send()"><i data-lucide="send" aria-hidden="true"></i>Отправить</button></div><div class="ec-actions"><button type="button" class="ec-icon-btn" onclick="EdChat.clear()" title="Очистить диалог" aria-label="Очистить диалог"><i data-lucide="eraser" aria-hidden="true"></i></button><button type="button" class="ec-icon-btn" onclick="EdChat.save()" title="Сохранить диалог" aria-label="Сохранить диалог"><i data-lucide="save" aria-hidden="true"></i></button><button type="button" class="ec-icon-btn" onclick="EdChat.export()" title="Экспорт Markdown" aria-label="Экспортировать диалог в Markdown"><i data-lucide="download" aria-hidden="true"></i></button><button type="button" class="ec-icon-btn" onclick="EdChat.useInPromptGenerator()" title="В генератор промптов" aria-label="Использовать в генераторе промптов"><i data-lucide="sparkles" aria-hidden="true"></i></button></div></div>' +
          '</main><aside id="ec-sidebar" class="ec-side"><section class="ec-panel" aria-labelledby="ec-context-title"><header class="ec-head"><h2 class="ec-head-title" id="ec-context-title">Активный контекст</h2><span class="ec-count" id="ec-doc-count" aria-label="Документов в контексте">0</span></header><div class="ec-block"><p class="ec-subhead">Документы</p><ul id="ec-context-documents" class="ec-chips"></ul></div><div class="ec-block"><p class="ec-subhead">Активный промпт</p><textarea id="ec-prompt" class="lab-textarea ec-prompt" rows="4" aria-label="Активный промпт"></textarea></div></section><section class="ec-panel" aria-labelledby="ec-history-title"><header class="ec-head"><h2 class="ec-head-title" id="ec-history-title">История диалогов</h2><span class="ec-count" id="ec-history-count" aria-label="Сохранённых диалогов">0</span></header><div id="ec-history" class="ec-history"></div></section></aside><div class="ec-model-backdrop" id="ec-model-backdrop" hidden></div></div>' +
          '<p class="ec-demo text-small text-muted mt-8">Демо-режим: ответы формируются локально и учитывают выбранный стиль модели.</p>'; if (window.EdChat) EdChat.init();
        container.dataset.loaded = '1';
        break;

      case 'paleo-keyboard':
        container.innerHTML = '<h1><img src="assets/icons/32/paleo/track.png" width="32" height="32" alt="Палео-клавиатура" style="vertical-align: middle; margin-right: 6px;"> Палео-клавиатура</h1>' +
          '<p class="subtitle">Набирайте палео-знаки кликом или с физической клавиатуры. Каждая буква — с образом и значением.</p>' +
          '<div class="pk-layout">' +
          '<section class="pk-panel pk-panel-text" aria-labelledby="pk-text-title">' +
          '<header class="pk-head"><h2 class="pk-head-title" id="pk-text-title">Строка</h2><span class="pk-count" id="pk-text-count" aria-label="Знаков в строке">0</span><span class="pk-head-note">Enter — в историю, Backspace — удалить глиф</span></header>' +
          '<textarea id="pk-output" class="pk-output" rows="2" dir="rtl" spellcheck="false" aria-label="Поле палео-текста" placeholder="𐤀𐤁𐤂"></textarea>' +
          '<p id="pk-translit" class="pk-translit" aria-live="polite" hidden></p>' +
          '<div id="pk-empty" class="pk-empty"><span class="pk-empty-glyph" aria-hidden="true">𐤕</span><strong>Строка пуста</strong><span>Нажмите клавишу на панели или введите глиф с физической клавиатуры.</span></div>' +
          '<div class="pk-actions">' +
          '<button type="button" class="pk-icon-btn" onclick="PaleoKey.copy()" title="Копировать строку" aria-label="Копировать строку"><i data-lucide="copy" aria-hidden="true"></i></button>' +
          '<button type="button" class="pk-icon-btn" onclick="PaleoKey.clear()" title="Очистить строку" aria-label="Очистить строку"><i data-lucide="trash-2" aria-hidden="true"></i></button>' +
          '<button type="button" class="pk-icon-btn" onclick="PaleoKey.downloadAsPng()" title="Скачать PNG" aria-label="Скачать строку как PNG"><i data-lucide="download" aria-hidden="true"></i></button>' +
          '<label class="pk-toggle"><input type="checkbox" id="pk-physical" checked onchange="PaleoKey.setPhysical(this.checked)">Физическая клавиатура</label>' +
          '</div>' +
          '<button type="button" class="lab-btn lab-btn-primary pk-primary" onclick="PaleoKey.analyzeInEtymology()"><i data-lucide="search" aria-hidden="true"></i>Разобрать в этимологии</button>' +
          '</section>' +
          '<section class="pk-panel pk-panel-keys" aria-labelledby="pk-keys-title">' +
          '<header class="pk-head"><h2 class="pk-head-title" id="pk-keys-title">Клавиши</h2><span class="pk-count" id="pk-keys-count" aria-label="Клавиш в наборе">0</span><span class="pk-head-note">латинская клавиша вставляет глиф</span></header>' +
          '<div id="pk-writings" class="pk-writings" role="radiogroup" aria-label="Письменность"></div>' +
          '<div id="pk-keys" class="pk-keys" data-physical="on" aria-label="Палео-клавиатура"></div>' +
          '<div id="pk-info" class="pk-info" hidden><div class="pk-info-head" id="pk-info-title"></div><div id="pk-info-body"></div></div>' +
          '</section>' +
          '<section class="pk-panel pk-panel-history" aria-labelledby="pk-history-title">' +
          '<header class="pk-head"><h2 class="pk-head-title" id="pk-history-title">История</h2><span class="pk-count" id="pk-history-count" aria-label="Строк в истории">0</span><span class="pk-head-note">5 последних строк</span></header>' +
          '<div id="pk-history" class="pk-history"></div>' +
          '</section>' +
          '</div>';
        container.dataset.loaded = '1';
        if (window.PaleoKey) PaleoKey.init();
        break;

      case 'admin-settings':
        container.innerHTML = '';
        container.dataset.loaded = '1';
        break;

      // ===== МОДУЛИ С FETCH HTML-СТРАНИЦЫ =====
      case 'paleo-builder':
      case 'video-lab':
      case 'generators':
      case 'checkers':
      case 'translation-comparator':
        if (container.dataset.loading === '1') return;
        if (container.dataset.loaded === '1' && container.innerHTML.trim() !== '') {
          if (moduleId === 'paleo-builder' && window.PaleoBuilder) window.PaleoBuilder.init(container);
          if (moduleId === 'video-lab' && window.VideoLab) window.VideoLab.init(container);
          if (moduleId === 'translation-comparator' && window.TransComp) window.TransComp.init();
          if (window.RevealObserver) window.RevealObserver.scan(container);
          break;
        }
        showSpinner(container, 'Загрузка модуля…');
        fetchPage('pages/' + moduleId + '.html').then(function(html) {
          if (container.dataset.loading !== '1') return;
          container.innerHTML = html;
          container.dataset.loaded = '1';
          delete container.dataset.loading;
          if (moduleId === 'paleo-builder' && window.PaleoBuilder) {
            window.PaleoBuilder.init(container);
          }
          if (moduleId === 'video-lab' && window.VideoLab) {
            window.VideoLab.init(container);
          }
          if (moduleId === 'translation-comparator' && window.TransComp) {
            window.TransComp.init();
          }
          if (window.RevealObserver) window.RevealObserver.scan(container);
        }).catch(function(err) {
          if (container.dataset.loading !== '1') return;
          delete container.dataset.loading;
          showError(container, 'Ошибка загрузки модуля: ' + err.message);
        });
        break;

      case 'prompt-generator':
        showSpinner(container, 'Загрузка конструктора…');
        if (window.PromptGenerator) {
          window.PromptGenerator.init(container);
        } else {
          showError(container, 'Модуль «Генератор промптов» не загрузился.');
        }
        break;

      case 'davar-checker':
        if (window.DavarChecker) {
          window.DavarChecker.init(container);
        } else {
          showError(container, 'Модуль «Давар-чекер» не загрузился.');
        }
        break;

      case 'state-checker':
        showSpinner(container, 'Загрузка чекера стран…');
        if (window.StateChecker) {
          window.StateChecker.init(container);
        } else {
          showError(container, 'Модуль «Чекер стран» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      case 'tree-checker':
        showSpinner(container, 'Загрузка дерева…');
        if (window.TreeChecker) {
          window.TreeChecker.init(container);
        } else {
          showError(container, 'Модуль «Чекер дерева» не загрузился.');
        }
        break;

      // ===== МОДУЛИ С JS-ИНИЦИАЛИЗАЦИЕЙ =====
      case 'cartography':
        showSpinner(container, 'Загрузка картографии…');
        if (window.Cartography) {
          container.dataset.loaded = '1';
          window.Cartography.init(container);
        } else {
          showError(container, 'Модуль «Картография» не загрузился.');
        }
        break;

      case 'heraldry':
        showSpinner(container, 'Загрузка гербовника…');
        if (window.Heraldry) {
          container.dataset.loaded = '1';
          window.Heraldry.init(container);
        } else {
          showError(container, 'Модуль «Гербовник» не загрузился.');
        }
        break;

      case 'states':
        showSpinner(container, 'Загрузка карты состояний…');
        if (window.AlephyStates) {
          container.dataset.loaded = '1';
          window.AlephyStates.init(parsed);
        } else {
          showError(container, 'Модуль «Карта состояний» не загрузился.');
        }
        break;

      case 'timeline':
        showSpinner(container, 'Загрузка палео-таймлайна…');
        if (window.Timeline) {
          container.dataset.loaded = '1';
          window.Timeline.init(container, parsed);
        } else {
          showError(container, 'Модуль «Палео-таймлайн» не загрузился.');
        }
        break;

      case 'paleo-linguistics':
        showSpinner(container, 'Загрузка палео-лингвистики…');
        if (window.PaleoLinguistics) {
          window.PaleoLinguistics.init(parsed);
        } else {
          showError(container, 'Модуль «Палео-лингвистика» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      case 'language-map':
        showSpinner(container, 'Загрузка карты языков…');
        if (window.LanguageMap) {
          window.LanguageMap.init(container, parsed);
        } else {
          showError(container, 'Модуль «Карта языков» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      case 'linguistic-tensor':
        showSpinner(container, 'Загрузка лингвистического тензора…');
        if (window.LinguisticTensor) {
          window.LinguisticTensor.init(container, parsed);
        } else {
          showError(container, 'Модуль «Лингвистический тензор» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      case 'methodology':
        showSpinner(container, 'Загрузка методологии…');
        if (window.MethodologyLab) {
          window.MethodologyLab.init(container, parsed);
        } else {
          showError(container, 'Модуль «Методология» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      case 'name-decoder':
        showSpinner(container, 'Загрузка чекера имени…');
        if (window.NameDecoder) {
          window.NameDecoder.init(container);
        } else {
          showError(container, 'Модуль «Чекер имени» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      case 'researches':
        showSpinner(container, 'Загрузка исследований…');
        if (window.LoadResearches) {
          window.LoadResearches.render(container, parsed);
        } else {
          showError(container, 'Модуль «Исследования» не загрузился.');
        }
        container.dataset.loaded = '1';
        break;

      // ===== JSON-СТРАНИЦЫ =====
      case 'manifest':
        showSpinner(container, 'Загрузка манифеста…');
        if (jsonCache.manifest) {
          renderManifestPage(container, jsonCache.manifest);
          container.dataset.loaded = '1';
          break;
        }
        fetchJson('data/methodology/manifest.json').then(function(data) {
          jsonCache.manifest = data;
          renderManifestPage(container, data);
          container.dataset.loaded = '1';
        }).catch(function(err) {
          showError(container, 'Ошибка загрузки манифеста: ' + err.message);
        });
        break;

      case 'dictionaries':
        loadJsonPage('dictionaries', 'data/dictionaries.json', container);
        break;

      case 'paleo-mechanics':
        loadJsonPage('paleo-mechanics', 'data/paleo-mechanics.json', container);
        break;

      // ===== ДИНАМИЧЕСКИЕ МОДУЛИ (создаются на лету) =====
      case 'exposure-editor':
        if (window.ExposureEditor) {
          window.ExposureEditor.init(container);
        } else {
          showError(container, 'Модуль редактора разоблачений не загрузился.');
        }
        break;

      case 'clue-generator':
        if (window.ClueGenerator) {
          window.ClueGenerator.init(container);
        } else {
          showError(container, 'Модуль генератора улик не загрузился.');
        }
        break;

      // ===== MARKDOWN-СТРАНИЦЫ =====
      default:
        // Пробуем загрузить как markdown-страницу
        var mdPaths = {
          'dict-religionims': '../../../analysis/dictionaries/dictionaries-religionims.md',
          'dict-grecisms': '../../../analysis/dictionaries/dictionaries-grecisms.md',
          'dict-latinisms': '../../../analysis/dictionaries/dictionaries-latinisms.md',
          'dict-slavicisms': '../../../analysis/dictionaries/dictionaries-slavicisms.md',
          'dict-names': '../../../analysis/dictionaries/dictionaries-names.md',
          'dict-phrases': '../../../analysis/dictionaries/dictionaries-phrases.md',
          'dict-economisms': '../../../analysis/dictionaries/dictionaries-economisms.md',
          'dict-estethisms': '../../../analysis/dictionaries/dictionaries-estethisms.md',
          'dict-gastronomisms': '../../../analysis/dictionaries/dictionaries-gastronomisms.md',
          'dict-juridisms': '../../../analysis/dictionaries/dictionaries-juridisms.md',
          'dict-marketisms': '../../../analysis/dictionaries/dictionaries-marketisms.md',
          'dict-mediasms': '../../../analysis/dictionaries/dictionaries-mediasms.md',
          'dict-medicinisms': '../../../analysis/dictionaries/dictionaries-medicinisms.md',
          'dict-militarisms': '../../../analysis/dictionaries/dictionaries-militarisms.md',
          'dict-modernisms': '../../../analysis/dictionaries/dictionaries-modernisms.md',
          'dict-newageisms': '../../../analysis/dictionaries/dictionaries-newageisms.md',
          'dict-politisms': '../../../analysis/dictionaries/dictionaries-politisms.md',
          'dict-psychologisms': '../../../analysis/dictionaries/dictionaries-psychologisms.md',
          'dict-scientisms': '../../../analysis/dictionaries/dictionaries-scientisms.md',
          'dict-sportisms': '../../../analysis/dictionaries/dictionaries-sportisms.md',
          'dict-technologisms': '../../../analysis/dictionaries/dictionaries-technologisms.md',
          'exposure-dictionary': '../../../analysis/exposure/exposure-dictionary.md',
          'exposure-principles': '../../../analysis/exposure/exposure-principles.md',
          'exposure-distortions': '../../../analysis/exposure/exposure-distortions.md',
          'exposure-mechanisms': '../../../analysis/exposure/exposure-mechanisms.md',
          'exposure-linguistic-methods': '../../../analysis/exposure/exposure-linguistic-methods.md',
          'exposure-methods': '../../../analysis/exposure/exposure-methods.md',
          'exposure-language': '../../../analysis/exposure/exposure-language.md',
          'exposure-language-shifts': '../../../analysis/exposure/exposure-language-shifts.md',
          'exposure-bavelisms': '../../../analysis/exposure/exposure-bavelisms.md',
          'exposure-masoretic': '../../../analysis/exposure/exposure-masoretic.md',
          'exposure-philosophemes': '../../../analysis/exposure/exposure-philosophemes.md',
          'exposure-system-architecture': '../../../analysis/exposure/exposure-system-architecture.md',
          'exposure-religionism-theory': '../../../analysis/exposure/exposure-religionism-theory.md',
          'exposure-techniques': '../../../analysis/exposure/exposure-techniques.md',
          'method-archeology': '../../../analysis/methodology/methodology-archeology.md',
          'method-hebrew-reconstruction': '../../../analysis/methodology/methodology-hebrew-reconstruction.md',
          'method-layers': '../../../analysis/methodology/methodology-layers.md',
          'method-translation': '../../../analysis/methodology/methodology-translation.md',
          'method-transliteration': '../../../analysis/methodology/methodology-transliteration.md',
          'method-tree': '../../../analysis/methodology/methodology-tree.md'
        };
        var mdPath = mdPaths[moduleId];
        if (mdPath) {
          showSpinner(container, 'Загрузка…');
          fetchPage(mdPath).then(function(md) {
            if (typeof marked !== 'undefined' && marked.parse) {
              container.innerHTML = marked.parse(md);
            } else {
              container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка: marked.js не загружен</div>';
            }
            container.dataset.loaded = '1';
          }).catch(function(err) {
            showError(container, 'Ошибка загрузки: ' + err.message);
          });
              } else {
          showError(container, 'Маршрут «' + moduleId + '» не зарегистрирован.');
        }
        break;
    }

    // Единый вызов динамической шапки для всех модулей.
    applyModuleHero(moduleId, container, parsed);
    if (window.LabRouter) LabRouter.renderBreadcrumbs(moduleId, parsed);
  }

  /* Возвращает [viewId, override] для текущего маршрута модуля.
     viewId = null → главная страница модуля (шапка по умолчанию).
     override → динамические title/subtitle из данных экрана. */
  function resolveHeroView(moduleId, parsed) {
    var viewId = null, override = null;
    if (moduleId === 'learn') {
      var seg = parsed && parsed.segments;
      if (seg && seg[1] === 'lessons') viewId = seg[2] ? 'lesson' : 'lessons';
      else if (seg && seg[1] === 'game') viewId = 'game';
      else if (seg && seg[1] === 'paleo-trainer') viewId = 'paleo-trainer';
      else if (seg && seg[1] === 'courses') {
        viewId = seg[2] ? 'course' : 'courses';
        if (seg[2] && window.AlephyCourses && window.AlephyCourses.list) {
          var course = window.AlephyCourses.list.filter(function(item) { return item.id === decodeURIComponent(seg[2]); })[0];
          if (course) override = { title: course.title, subtitle: course.description, meta: [course.level + ' · ' + course.lessons.length + ' уроков'] };
        }
      }
    } else if (moduleId === 'states') {
      var params = (parsed && parsed.params) || {};
      if (params.diagnostic === 'true') viewId = 'diagnostic';
      else if (params.state) viewId = 'detail';
    } else if (moduleId === 'timeline') {
      var seg2 = parsed && parsed.segments;
      if (seg2 && seg2[1]) { viewId = 'detail'; override = timelineHeroOverride(seg2[1]); }
      else viewId = 'catalog';
        } else if (moduleId === 'paleo-linguistics') {
      var seg3 = parsed && parsed.segments;
      if (seg3 && seg3[1]) { viewId = 'detail'; }
      // override задаётся в самом модуле после загрузки данных
    } else if (moduleId === 'language-map') {
      var seg4 = parsed && parsed.segments;
      if (seg4 && seg4[1]) { viewId = 'detail'; }
    } else if (moduleId === 'ai-agents') {
      var seg5 = parsed && parsed.segments;
      if (seg5 && seg5[1]) viewId = 'detail'; // override задаётся в renderAgentDetail
        } else if (moduleId === 'pipelines') {
      var seg6 = parsed && parsed.segments;
      if (seg6 && seg6[1]) viewId = 'detail'; // override задаётся в renderPipelineDetail
    } else if (moduleId === 'researches') {
      var seg7 = parsed && parsed.segments;
      if (seg7 && seg7[1] === 'case' && seg7[2]) viewId = 'detail'; // override задаётся в load-researches.js
    } else if (moduleId === 'workbench') {
      var segWb = parsed && parsed.segments;
      if (segWb && segWb[1] === 'run') viewId = 'run';
      else if (segWb && segWb[1] === 'project') viewId = 'project';
      // override задаётся в workbench.js (title конвейера / имя проекта)
    } else if (moduleId === 'club') {
      viewId = parsed && parsed.segments && parsed.segments[1] === 'discussions' ? 'discussions' : 'club';
    }
    return [viewId, override];
  }

  function timelineHeroOverride(timelineId) {
    // override задаётся в timeline.js после загрузки данных; здесь — placeholder
    return null;
  }

  function applyModuleHero(moduleId, container, parsed) {
    if (!container || !window.LabHero || !window.LabHero.setView) return;
    if (!container.id) return;
    var resolved = resolveHeroView(moduleId, parsed);
    var viewId = resolved[0], override = resolved[1];
    // Динамические override могут быть установлены модулем после асинхронной загрузки
    var pending = container._labHeroOverride || override;
    LabHero.setView(moduleId, viewId, pending);
  }

  // ===== ОЖИДАНИЕ КОНТЕЙНЕРА =====
  var pendingRenderObservers = {};

  function renderWhenReady(moduleId, parsed) {
    var container = document.getElementById(moduleId);
    if (container) {
      if (pendingRenderObservers[moduleId]) {
        pendingRenderObservers[moduleId].disconnect();
        delete pendingRenderObservers[moduleId];
      }
      render(moduleId, container, parsed);
      return;
    }

    var root = document.getElementById('labContent');
    if (!root) return;

    // Не создаём несколько наблюдателей для одного модуля.
    if (pendingRenderObservers[moduleId]) return;

    if (typeof MutationObserver === 'undefined') {
      setTimeout(function() {
        renderWhenReady(moduleId, parsed);
      }, 50);
      return;
    }

    var observer = new MutationObserver(function() {
      var ready = document.getElementById(moduleId);
      if (!ready) return;
      observer.disconnect();
      delete pendingRenderObservers[moduleId];
      render(moduleId, ready, parsed);
    });

    pendingRenderObservers[moduleId] = observer;
    observer.observe(root, { childList: true, subtree: true });
  }

  // ===== LIQUID GLASS TOPBAR: один переключатель .is-scrolled =====
  // Шапка-витрина (DESIGN-SYSTEM §6.3): сплошная сверху, стекло при скролле.
  // rAF-throttle и один слушатель на всё приложение — не по модулям.
  function initGlassTopbar() {
    var header = document.getElementById('labHeader');
    if (!header) return;
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      header.classList.toggle('is-scrolled', y > 8);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ =====
  function init() {
    // Инициализируем служебные модули
    if (window.LabTheme) LabTheme.init();
    if (window.LabHotkeys) LabHotkeys.init();

    // Роутер вызывает отложенный рендер при смене модуля.
    if (window.LabRouter) {
      LabRouter.onChange(function(moduleId, parsed) {
        renderWhenReady(moduleId, parsed);
      });
      LabRouter.init();
      if (window.LabHero) LabHero.observe();
      initGlassTopbar();

    // Инициализируем модули, работающие с готовым DOM
    setTimeout(function() {
      if (window.RootDict) RootDict.init();
    }, 500);
    if (window.Religionisms) Religionisms.init();
    if (window.BoardLib) BoardLib.init();
    if (window.VisionUI) VisionUI.init();
    if (window.EdChat) EdChat.init();
    if (window.LabIcons) window.LabIcons.sync();
    if (window.Investigation) Investigation.init();
    if (window.ScriptureReader) ScriptureReader.init();
    if (window.AdminSettings) AdminSettings.init();
    if (window.LearnLab) LearnLab.init();
    if (window.AlephyStates) AlephyStates.init();

    // Init board generator form
    var boardForm = document.getElementById('board-form');
    if (boardForm) {
      boardForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (typeof generateBoard === 'function') generateBoard();
      });
    }

  }
  }

  // ===== ДАННЫЕ ДЛЯ КАРТЫ АГЕНТОВ =====
  var agentMapData = null;

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    init: init,
    render: render,
    renderWhenReady: renderWhenReady,
    jsonCache: jsonCache  ,
    pageState: pageState,
    // Getter возвращает актуальный массив после открытия #ai-agents.
    // Простое значение здесь осталось бы снимком null, созданным до первого рендера.
    getAgentMapData: function() {
      return agentMapData || (agentMapData = getAgentMapData());
    },
    get agentMapData() {
      return agentMapData;
    },
    renderDictionaries: renderDictionaries,
    renderDocumentPage: renderDocumentPage
  };
})();

window.PageController = PageController;
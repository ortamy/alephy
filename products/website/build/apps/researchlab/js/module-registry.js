/**
 * module-registry.js — единственный источник правды по маршрутам лаборатории.
 *
 * До этого список маршрутов жил отдельно в router.js (`routedModules`),
 * а рендеринг — в switch внутри page-controller.js. Расхождение между ними
 * не ловилось ничем: маршрут мог быть в роутере без рендера, и наоборот.
 *
 * Теперь реестр объявляет маршрут один раз, а router и page-controller читают
 * его отсюда. Проверка согласованности — node tools/design-baseline/registry-check.mjs
 * (реестр ↔ page-controller и реестр ↔ сайдбар index.html).
 *
 * kind:
 *   'panel'    — рендерится кодом в page-controller (switch)
 *   'markdown' — маршрут документа; источник содержимого объявлен полем doc
 *
 * doc — откуда берётся содержимое документа: { collection, key, docs }.
 *   collection — коллекция из COLLECTIONS: живые данные лаборатории или null,
 *                если источник ещё не перенесён в data/ (методички живут в docs/);
 *   key        — ключ записи в файле коллекции;
 *   docs       — исходный .md в репозитории (провенанс; гейт проверяет наличие).
 *
 * nav — запись в сайдбаре: { section, icon }. Отсутствие nav значит, что модуль
 *       открывается только по прямому маршруту (хаб, палитра, deep-link),
 *       поэтому навигация «в ширину» остаётся осознанной, а не случайной.
 * DOC_GROUPS — префиксы markdown-маршрутов и хабы, которые их показывают.
 */
window.ModuleRegistry = (function () {
  'use strict';

  // Собран из прежнего routedModules + mdPaths page-controller.
  var MODULES = [
    // --- shell и витрина ---
    { id: 'manifest', kind: 'panel', nav: { section: 'top', icon: 'scroll-text' } },
    { id: 'dashboard', kind: 'panel', nav: { section: 'top', icon: 'layout-grid' } },
    { id: 'workbench', kind: 'panel', nav: { section: 'top', icon: 'hammer' } },
    { id: 'club', kind: 'panel', nav: { section: 'top', icon: 'footprints' } },

    // --- обучение ---
    { id: 'learn', kind: 'panel', nav: { section: 'data', icon: 'graduation-cap' } },
    { id: 'board', kind: 'panel' },
    { id: 'board-generator', kind: 'panel' },
    { id: 'board-library', kind: 'panel' },
    { id: 'research-generator', kind: 'panel' },
    { id: 'hypothesis-generator', kind: 'panel' },

    // --- словари и лингвистика ---
    { id: 'dictionaries', kind: 'panel', nav: { section: 'data', icon: 'library' } },
    // Хаб документов разоблачения: корпус из data/exposures/documents.json.
    { id: 'exposures', kind: 'panel', nav: { section: 'data', icon: 'shield-alert' } },
    { id: 'root-dictionary', kind: 'panel' },
    { id: 'paleo-glossary', kind: 'panel' },
    { id: 'word-analyzer', kind: 'panel' },
    { id: 'etymology-checker', kind: 'panel' },
    { id: 'paleo-linguistics', kind: 'panel', nav: { section: 'data', icon: 'languages' } },
    { id: 'language-map', kind: 'panel', nav: { section: 'data', icon: 'map' } },
    { id: 'linguistic-tensor', kind: 'panel' },
    { id: 'name-decoder', kind: 'panel' },
    { id: 'davar-checker', kind: 'panel' },
    { id: 'tree-checker', kind: 'panel' },
    { id: 'paleo-builder', kind: 'panel', nav: { section: 'tools', icon: 'hammer' } },
    { id: 'paleo-mechanics', kind: 'panel', nav: { section: 'data', icon: 'cog' } },
    { id: 'methodology', kind: 'panel', nav: { section: 'data', icon: 'scale' } },

    // --- писания и исследования ---
    { id: 'scripture-reader', kind: 'panel', nav: { section: 'data', icon: 'book-open' } },
    { id: 'researches', kind: 'panel', nav: { section: 'data', icon: 'archive' } },
    { id: 'investigation', kind: 'panel' },

    // --- генераторы и чекеры ---
    { id: 'generators', kind: 'panel', nav: { section: 'tools', icon: 'sparkles' } },
    { id: 'checkers', kind: 'panel', nav: { section: 'tools', icon: 'check-circle' } },
    // Конвейеры «Мастерской»: перенесены из #workbench в самостоятельный модуль
    // и живут в разделе «Инструменты». Отличаются от 'pipelines' ниже: там —
    // цепочки конкретных агентов (data/pipelines.json), здесь — исполняемые
    // конвейеры пользователя (workbench-pipelines.js: вход → смета → этапы → результат).
    { id: 'conveyors', kind: 'panel', nav: { section: 'tools', icon: 'git-merge' } },
    { id: 'religionisms', kind: 'panel', nav: { section: 'data', icon: 'help-circle' } },
    { id: 'religionism-checker', kind: 'panel' },
    { id: 'state-checker', kind: 'panel' },
    { id: 'translation-comparator', kind: 'panel' },
    { id: 'prompt-generator', kind: 'panel' },
    { id: 'timescale-generator', kind: 'panel' },
    { id: 'context-generator', kind: 'panel' },
    { id: 'clue-generator', kind: 'panel' },
    // Генераторы из §5.2j: паспорт артефакта-знака и сравнение версий.
    { id: 'artifact-generator', kind: 'panel' },
    { id: 'change-generator', kind: 'panel' },

    // --- анализаторы ---
    { id: 'analyzers', kind: 'panel', nav: { section: 'tools', icon: 'test-tube' } },
    { id: 'layer-analyzer', kind: 'panel' },
    { id: 'ai-analyzer', kind: 'panel' },
    { id: 'dialect-analyzer', kind: 'panel' },
    { id: 'state-analyzer', kind: 'panel' },

    // --- карты, хронология, гербы ---
    { id: 'cartography', kind: 'panel', nav: { section: 'data', icon: 'compass' } },
    { id: 'states', kind: 'panel', nav: { section: 'data', icon: 'flag' } },
    { id: 'timeline', kind: 'panel', nav: { section: 'data', icon: 'clock' } },
    { id: 'heraldry', kind: 'panel' },

    // --- AI и пайплайны ---
    { id: 'ai-agents', kind: 'panel', nav: { section: 'ai', icon: 'users' } },
    { id: 'pipelines', kind: 'panel', nav: { section: 'ai', icon: 'workflow' } },
    { id: 'agent-server', kind: 'panel', nav: { section: 'ai', icon: 'server' } },
    { id: 'ed-chat', kind: 'panel', nav: { section: 'ai', icon: 'message-circle' } },
    { id: 'vision', kind: 'panel' },

    // --- инструменты ---
    { id: 'paleo-keyboard', kind: 'panel', nav: { section: 'tools', icon: 'keyboard' } },
    { id: 'video-lab', kind: 'panel' },
    { id: 'exposure-editor', kind: 'panel' },
    { id: 'admin-settings', kind: 'panel', nav: { section: 'system', icon: 'settings' } },
    { id: 'design-system', kind: 'panel', nav: { section: 'system', icon: 'swatch-book' } },

    // --- словари-разоблачения (dict-*) ---
    // Содержимое — в data/dictionaries.json (21 словарь, 1913 терминов): маршрут
    // открывается как страница словаря #dictionaries/<key>. docs — исходный .md,
    // из которого собран JSON (провенанс, гейт проверяет его наличие в репозитории).
    { id: 'dict-religionims', kind: 'markdown', doc: { collection: 'dictionaries', key: 'religionims', docs: 'docs/05-DICTIONARIES/RELIGIONISMS.md' } },
    { id: 'dict-grecisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'grecisms', docs: 'docs/05-DICTIONARIES/GRECISMS.md' } },
    { id: 'dict-latinisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'latinisms', docs: 'docs/05-DICTIONARIES/LATINISMS.md' } },
    { id: 'dict-slavicisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'slavicisms', docs: 'docs/05-DICTIONARIES/SLAVICISMS.md' } },
    { id: 'dict-names', kind: 'markdown', doc: { collection: 'dictionaries', key: 'names', docs: 'docs/05-DICTIONARIES/NAMES.md' } },
    { id: 'dict-phrases', kind: 'markdown', doc: { collection: 'dictionaries', key: 'phrases', docs: 'docs/05-DICTIONARIES/PHRASISMS.md' } },
    { id: 'dict-economisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'economisms', docs: 'docs/05-DICTIONARIES/ECONOMISMS.md' } },
    { id: 'dict-estethisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'estethisms', docs: 'docs/05-DICTIONARIES/ESTETHISMS.md' } },
    { id: 'dict-gastronomisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'gastronomisms', docs: 'docs/05-DICTIONARIES/GASTRONOMISMS.md' } },
    { id: 'dict-juridisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'juridisms', docs: 'docs/05-DICTIONARIES/JURIDISMS.md' } },
    { id: 'dict-marketisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'marketisms', docs: 'docs/05-DICTIONARIES/MARKETISMS.md' } },
    { id: 'dict-mediasms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'mediasms', docs: 'docs/05-DICTIONARIES/MEDIASMS.md' } },
    { id: 'dict-medicinisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'medicinisms', docs: 'docs/05-DICTIONARIES/MEDICINISMS.md' } },
    { id: 'dict-militarisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'militarisms', docs: 'docs/05-DICTIONARIES/MILITARISMS.md' } },
    { id: 'dict-modernisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'modernisms', docs: 'docs/05-DICTIONARIES/MODERNISMS.md' } },
    { id: 'dict-newageisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'newageisms', docs: 'docs/05-DICTIONARIES/NEWAGEISMS.md' } },
    { id: 'dict-politisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'politisms', docs: 'docs/05-DICTIONARIES/POLITISMS.md' } },
    { id: 'dict-psychologisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'psychologisms', docs: 'docs/05-DICTIONARIES/PSYCHOLOGISMS.md' } },
    { id: 'dict-scientisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'scientisms', docs: 'docs/05-DICTIONARIES/SCIENTISMS.md' } },
    { id: 'dict-sportisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'sportisms', docs: 'docs/05-DICTIONARIES/SPORTISMS.md' } },
    { id: 'dict-technologisms', kind: 'markdown', doc: { collection: 'dictionaries', key: 'technologisms', docs: 'docs/05-DICTIONARIES/TECHNOLOGISMS.md' } },

    // --- разоблачения (exposure-*) ---
    // Корпус документов разоблачения целиком лежит в data/exposures/documents.json;
    // хаб — модуль #exposures, каждый документ открывается по своему маршруту.
    { id: 'exposure-dictionary', kind: 'markdown', doc: { collection: 'exposures', key: 'dictionary' } },
    { id: 'exposure-principles', kind: 'markdown', doc: { collection: 'exposures', key: 'principles' } },
    { id: 'exposure-distortions', kind: 'markdown', doc: { collection: 'exposures', key: 'distortions' } },
    { id: 'exposure-mechanisms', kind: 'markdown', doc: { collection: 'exposures', key: 'mechanisms' } },
    { id: 'exposure-linguistic-methods', kind: 'markdown', doc: { collection: 'exposures', key: 'linguistic-methods' } },
    { id: 'exposure-methods', kind: 'markdown', doc: { collection: 'exposures', key: 'methods' } },
    { id: 'exposure-language', kind: 'markdown', doc: { collection: 'exposures', key: 'language' } },
    { id: 'exposure-language-shifts', kind: 'markdown', doc: { collection: 'exposures', key: 'language-shifts' } },
    { id: 'exposure-bavelisms', kind: 'markdown', doc: { collection: 'exposures', key: 'bavelisms' } },
    { id: 'exposure-masoretic', kind: 'markdown', doc: { collection: 'exposures', key: 'masoretic' } },
    { id: 'exposure-philosophemes', kind: 'markdown', doc: { collection: 'exposures', key: 'philosophemes' } },
    { id: 'exposure-system-architecture', kind: 'markdown', doc: { collection: 'exposures', key: 'system-architecture' } },
    { id: 'exposure-religionism-theory', kind: 'markdown', doc: { collection: 'exposures', key: 'religionism-theory' } },
    { id: 'exposure-techniques', kind: 'markdown', doc: { collection: 'exposures', key: 'techniques' } },

    // --- методички (method-*) ---
    // Содержимое — в data/methodology/documents.json: собрано из docs/06-METHODOLOGY
    // генератором tools/generate-methodology-docs.py (он читает этот же реестр).
    // Поле docs фиксирует провенанс, key — запись в файле коллекции.
    { id: 'method-archeology', kind: 'markdown', doc: { collection: 'methodology', key: 'archeology', docs: 'docs/06-METHODOLOGY/ARCHEOLOGY.md' } },
    { id: 'method-hebrew-reconstruction', kind: 'markdown', doc: { collection: 'methodology', key: 'reconstruction', docs: 'docs/06-METHODOLOGY/RECONSTRUCTION.md' } },
    { id: 'method-layers', kind: 'markdown', doc: { collection: 'methodology', key: 'layers', docs: 'docs/06-METHODOLOGY/LAYERS.md' } },
    { id: 'method-translation', kind: 'markdown', doc: { collection: 'methodology', key: 'translation', docs: 'docs/06-METHODOLOGY/TRANSLATION.md' } },
    { id: 'method-transliteration', kind: 'markdown', doc: { collection: 'methodology', key: 'transliteration', docs: 'docs/06-METHODOLOGY/TRANSLITERATION.md' } },
    { id: 'method-tree', kind: 'markdown', doc: { collection: 'methodology', key: 'tree', docs: 'docs/06-METHODOLOGY/TREE.md' } },

    // Остальные методички раздела docs/06-METHODOLOGY. Список не дублируется:
    // маршруты объявляются здесь, файлы данных собирает генератор, который
    // читает этот же реестр. README.md (обложка раздела) и TEMPLATE.md
    // (шаблон разоблачения) — служебные, маршрутов не имеют; их список
    // закреплён в registry-check.mjs.
    { id: 'method-books-states-map', kind: 'markdown', doc: { collection: 'methodology', key: 'books-states-map', docs: 'docs/06-METHODOLOGY/BOOKS-STATES-MAP.md' } },
    { id: 'method-cultural-matrices', kind: 'markdown', doc: { collection: 'methodology', key: 'cultural-matrices', docs: 'docs/06-METHODOLOGY/CULTURAL-MATRICES.md' } },
    { id: 'method-davar', kind: 'markdown', doc: { collection: 'methodology', key: 'davar', docs: 'docs/06-METHODOLOGY/DAVAR.md' } },
    { id: 'method-distortions', kind: 'markdown', doc: { collection: 'methodology', key: 'distortions', docs: 'docs/06-METHODOLOGY/DISTORTIONS.md' } },
    { id: 'method-evidence', kind: 'markdown', doc: { collection: 'methodology', key: 'evidence', docs: 'docs/06-METHODOLOGY/EVIDENCE.md' } },
    { id: 'method-exposure', kind: 'markdown', doc: { collection: 'methodology', key: 'exposure', docs: 'docs/06-METHODOLOGY/EXPOSURE.md' } },
    { id: 'method-hypotheses', kind: 'markdown', doc: { collection: 'methodology', key: 'hypotheses', docs: 'docs/06-METHODOLOGY/HYPOTHESES.md' } },
    { id: 'method-linguistic-methods', kind: 'markdown', doc: { collection: 'methodology', key: 'linguistic-methods', docs: 'docs/06-METHODOLOGY/LINGUISTIC-METHODS.md' } },
    { id: 'method-linguistic', kind: 'markdown', doc: { collection: 'methodology', key: 'linguistic', docs: 'docs/06-METHODOLOGY/LINGUISTIC.md' } },
    { id: 'method-mechanisms', kind: 'markdown', doc: { collection: 'methodology', key: 'mechanisms', docs: 'docs/06-METHODOLOGY/MECHANISMS.md' } },
    { id: 'method-methods', kind: 'markdown', doc: { collection: 'methodology', key: 'methods', docs: 'docs/06-METHODOLOGY/METHODS.md' } },
    { id: 'method-paleo-reading-methods', kind: 'markdown', doc: { collection: 'methodology', key: 'paleo-reading-methods', docs: 'docs/06-METHODOLOGY/PALEO-READING-METHODS.md' } },
    { id: 'method-philosophemes', kind: 'markdown', doc: { collection: 'methodology', key: 'philosophemes', docs: 'docs/06-METHODOLOGY/PHILOSOPHEMES.md' } },
    { id: 'method-principles', kind: 'markdown', doc: { collection: 'methodology', key: 'principles', docs: 'docs/06-METHODOLOGY/PRINCIPLES.md' } },
    { id: 'method-protocol', kind: 'markdown', doc: { collection: 'methodology', key: 'protocol', docs: 'docs/06-METHODOLOGY/PROTOCOL.md' } },
    { id: 'method-research-principles', kind: 'markdown', doc: { collection: 'methodology', key: 'research-principles', docs: 'docs/06-METHODOLOGY/RESEARCH-PRINCIPLES.md' } },
    { id: 'method-ritual-chain', kind: 'markdown', doc: { collection: 'methodology', key: 'ritual-chain', docs: 'docs/06-METHODOLOGY/RITUAL-CHAIN.md' } },
    { id: 'method-state-diagnostics', kind: 'markdown', doc: { collection: 'methodology', key: 'state-diagnostics', docs: 'docs/06-METHODOLOGY/STATE-DIAGNOSTICS.md' } },
    { id: 'method-states', kind: 'markdown', doc: { collection: 'methodology', key: 'states', docs: 'docs/06-METHODOLOGY/STATES.md' } },
    { id: 'method-system-architecture', kind: 'markdown', doc: { collection: 'methodology', key: 'system-architecture', docs: 'docs/06-METHODOLOGY/SYSTEM-ARCHITECTURE.md' } },
    { id: 'method-techniques', kind: 'markdown', doc: { collection: 'methodology', key: 'techniques', docs: 'docs/06-METHODOLOGY/TECHNIQUES.md' } }
  ];

  // Секции сайдбара: порядок отрисовки, иконка заголовка и ключ подписи.
  // В index.html заголовок секции несёт тот же data-i18n-ключ, а порядок
  // секций и элементов сверяет tools/design-baseline/registry-check.mjs.
  // 'top' — верхние ссылки без заголовка; 'ai' — заголовок «AI» без ключа.
  var NAV_SECTIONS = [
    { id: 'top', icon: null, titleKey: null },
    { id: 'data', icon: 'book-open', titleKey: 'lab.sections.data' },
    { id: 'tools', icon: 'hammer', titleKey: 'lab.sections.tools' },
    { id: 'ai', icon: 'bot', titleKey: null },
    { id: 'system', icon: 'settings', titleKey: 'lab.sections.system' }
  ];

  // Коллекции документов: index — лёгкий указатель (title/description/source),
  // dir — каталог с телом документа; module-hub показывает корпус. file без dir
  // означает «тело лежит в том же файле» (словари, разоблачения).
  var COLLECTIONS = {
    dictionaries: { file: 'data/dictionaries.json', hub: 'dictionaries' },
    exposures: { file: 'data/exposures/documents.json', hub: 'exposures' },
    methodology: {
      file: 'data/methodology/index.json',
      dir: 'data/methodology/documents',
      hub: 'methodology'
    }
  };

  // Группы markdown-маршрутов: префикс id → группа документов.
  // hub — модуль, который показывает документы группы (берётся из COLLECTIONS,
  // чтобы хаб был объявлен ровно в одном месте). index: true означает, что список
  // группы рисует карта хабов GROUP_INDEX_HUBS в page-controller; у групп-страниц
  // (словари) список рисует сам модуль по ключу документа.
  var DOC_GROUPS = [
    { id: 'dictionaries', prefix: 'dict-', hub: COLLECTIONS.dictionaries.hub, index: false },
    { id: 'exposures', prefix: 'exposure-', hub: COLLECTIONS.exposures.hub, index: true },
    { id: 'methodology', prefix: 'method-', hub: COLLECTIONS.methodology.hub, index: true }
  ];

  var byId = {};
  MODULES.forEach(function (entry) {
    byId[entry.id] = entry;
  });

  // Устаревшие маршруты: работают, но редиректят на актуальный модуль.
  var ALIASES = {
    settings: 'admin-settings',
    'research-library': 'researches',
    agents: 'ai-agents',
    library: 'researches',
    laboratory: 'dashboard'
  };

  function ids() {
    return MODULES.map(function (entry) {
      return entry.id;
    });
  }

  function has(id) {
    return Object.prototype.hasOwnProperty.call(byId, id);
  }

  function get(id) {
    return byId[id] || null;
  }

  function kind(id) {
    var entry = byId[id];
    return entry ? entry.kind : null;
  }

  function sections() {
    return NAV_SECTIONS;
  }

  // Модули сайдбара по порядку объявления; с аргументом — одна секция.
  function navItems(sectionId) {
    return MODULES.filter(function (entry) {
      return entry.nav && (!sectionId || entry.nav.section === sectionId);
    });
  }

  function navIds() {
    return navItems().map(function (entry) {
      return entry.id;
    });
  }

  // Группа markdown-документа по префиксу id; null — префикс не объявлен.
  function docGroup(id) {
    var entry = byId[id];
    if (!entry || entry.kind !== 'markdown') return null;
    var match = DOC_GROUPS.filter(function (group) {
      return id.indexOf(group.prefix) === 0;
    })[0];
    return match ? match.id : null;
  }

  function docs(groupId) {
    return MODULES.filter(function (entry) {
      return entry.kind === 'markdown' && (!groupId || docGroup(entry.id) === groupId);
    });
  }

  // Источник документа: { collection, key, docs, file, dir, doc, hub }.
  // file — файл коллекции (указатель или тело), doc — отдельный файл тела,
  // если коллекция разбита на каталог. collection === null значит
  // «источник ещё не перенесён в data/» — это состояние, а не ошибка:
  // page-controller покажет плашку со ссылкой на хаб группы.
  function docSource(id) {
    var entry = byId[id];
    if (!entry || entry.kind !== 'markdown' || !entry.doc) return null;
    var collection = entry.doc.collection;
    var meta = collection ? COLLECTIONS[collection] : null;
    return {
      collection: collection || null,
      key: entry.doc.key || null,
      docs: entry.doc.docs || null,
      file: meta ? meta.file : null,
      dir: meta && meta.dir ? meta.dir : null,
      doc: meta && meta.dir && entry.doc.key ? meta.dir + '/' + entry.doc.key + '.json' : null,
      hub: meta ? meta.hub : null
    };
  }

  return {
    MODULES: MODULES,
    ALIASES: ALIASES,
    NAV_SECTIONS: NAV_SECTIONS,
    DOC_GROUPS: DOC_GROUPS,
    COLLECTIONS: COLLECTIONS,
    ids: ids,
    has: has,
    get: get,
    kind: kind,
    sections: sections,
    navItems: navItems,
    navIds: navIds,
    docGroup: docGroup,
    docs: docs,
    docSource: docSource
  };
})();

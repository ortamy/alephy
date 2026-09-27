/**
 * module-registry.js — единственный источник правды по маршрутам лаборатории.
 *
 * До этого список маршрутов жил отдельно в router.js (`routedModules`),
 * а рендеринг — в switch внутри page-controller.js. Расхождение между ними
 * не ловилось ничем: маршрут мог быть в роутере без рендера, и наоборот.
 *
 * Теперь реестр объявляет маршрут один раз, а router и page-controller читают
 * его отсюда. Проверка согласованности — tools/check-module-registry.py.
 *
 * kind:
 *   'panel'    — рендерится кодом в page-controller (switch)
 *   'markdown' — отдаётся .md-страницей через fetchPage
 */
window.ModuleRegistry = (function () {
  'use strict';

  // Собран из прежнего routedModules + mdPaths page-controller.
  var MODULES = [
    // --- shell и витрина ---
    { id: 'manifest', kind: 'panel' },
    { id: 'dashboard', kind: 'panel' },
    { id: 'workbench', kind: 'panel' },
    { id: 'club', kind: 'panel' },

    // --- обучение ---
    { id: 'learn', kind: 'panel' },
    { id: 'board', kind: 'panel' },
    { id: 'board-generator', kind: 'panel' },
    { id: 'board-library', kind: 'panel' },
    { id: 'research-generator', kind: 'panel' },
    { id: 'hypothesis-generator', kind: 'panel' },

    // --- словари и лингвистика ---
    { id: 'dictionaries', kind: 'panel' },
    { id: 'root-dictionary', kind: 'panel' },
    { id: 'paleo-glossary', kind: 'panel' },
    { id: 'word-analyzer', kind: 'panel' },
    { id: 'etymology-checker', kind: 'panel' },
    { id: 'paleo-linguistics', kind: 'panel' },
    { id: 'language-map', kind: 'panel' },
    { id: 'linguistic-tensor', kind: 'panel' },
    { id: 'name-decoder', kind: 'panel' },
    { id: 'davar-checker', kind: 'panel' },
    { id: 'tree-checker', kind: 'panel' },
    { id: 'paleo-builder', kind: 'panel' },
    { id: 'paleo-mechanics', kind: 'panel' },
    { id: 'methodology', kind: 'panel' },

    // --- писания и исследования ---
    { id: 'scripture-reader', kind: 'panel' },
    { id: 'researches', kind: 'panel' },
    { id: 'investigation', kind: 'panel' },

    // --- генераторы и чекеры ---
    { id: 'generators', kind: 'panel' },
    { id: 'checkers', kind: 'panel' },
    { id: 'religionisms', kind: 'panel' },
    { id: 'religionism-checker', kind: 'panel' },
    { id: 'state-checker', kind: 'panel' },
    { id: 'translation-comparator', kind: 'panel' },
    { id: 'prompt-generator', kind: 'panel' },
    { id: 'timescale-generator', kind: 'panel' },
    { id: 'context-generator', kind: 'panel' },
    { id: 'clue-generator', kind: 'panel' },

    // --- анализаторы ---
    { id: 'analyzers', kind: 'panel' },
    { id: 'layer-analyzer', kind: 'panel' },
    { id: 'ai-analyzer', kind: 'panel' },
    { id: 'dialect-analyzer', kind: 'panel' },
    { id: 'state-analyzer', kind: 'panel' },

    // --- карты, хронология, гербы ---
    { id: 'cartography', kind: 'panel' },
    { id: 'states', kind: 'panel' },
    { id: 'timeline', kind: 'panel' },
    { id: 'heraldry', kind: 'panel' },

    // --- AI и пайплайны ---
    { id: 'ai-agents', kind: 'panel' },
    { id: 'pipelines', kind: 'panel' },
    { id: 'agent-server', kind: 'panel' },
    { id: 'ed-chat', kind: 'panel' },
    { id: 'vision', kind: 'panel' },

    // --- инструменты ---
    { id: 'paleo-keyboard', kind: 'panel' },
    { id: 'video-lab', kind: 'panel' },
    { id: 'exposure-editor', kind: 'panel' },
    { id: 'admin-settings', kind: 'panel' },

    // --- словари-разоблачения (dict-*.md) ---
    { id: 'dict-religionims', kind: 'markdown' },
    { id: 'dict-grecisms', kind: 'markdown' },
    { id: 'dict-latinisms', kind: 'markdown' },
    { id: 'dict-slavicisms', kind: 'markdown' },
    { id: 'dict-names', kind: 'markdown' },
    { id: 'dict-phrases', kind: 'markdown' },
    { id: 'dict-economisms', kind: 'markdown' },
    { id: 'dict-estethisms', kind: 'markdown' },
    { id: 'dict-gastronomisms', kind: 'markdown' },
    { id: 'dict-juridisms', kind: 'markdown' },
    { id: 'dict-marketisms', kind: 'markdown' },
    { id: 'dict-mediasms', kind: 'markdown' },
    { id: 'dict-medicinisms', kind: 'markdown' },
    { id: 'dict-militarisms', kind: 'markdown' },
    { id: 'dict-modernisms', kind: 'markdown' },
    { id: 'dict-newageisms', kind: 'markdown' },
    { id: 'dict-politisms', kind: 'markdown' },
    { id: 'dict-psychologisms', kind: 'markdown' },
    { id: 'dict-scientisms', kind: 'markdown' },
    { id: 'dict-sportisms', kind: 'markdown' },
    { id: 'dict-technologisms', kind: 'markdown' },

    // --- разоблачения (exposure-*.md) ---
    { id: 'exposure-dictionary', kind: 'markdown' },
    { id: 'exposure-principles', kind: 'markdown' },
    { id: 'exposure-distortions', kind: 'markdown' },
    { id: 'exposure-mechanisms', kind: 'markdown' },
    { id: 'exposure-linguistic-methods', kind: 'markdown' },
    { id: 'exposure-methods', kind: 'markdown' },
    { id: 'exposure-language', kind: 'markdown' },
    { id: 'exposure-language-shifts', kind: 'markdown' },
    { id: 'exposure-bavelisms', kind: 'markdown' },
    { id: 'exposure-masoretic', kind: 'markdown' },
    { id: 'exposure-philosophemes', kind: 'markdown' },
    { id: 'exposure-system-architecture', kind: 'markdown' },
    { id: 'exposure-religionism-theory', kind: 'markdown' },
    { id: 'exposure-techniques', kind: 'markdown' },

    // --- методички (method-*.md) ---
    { id: 'method-archeology', kind: 'markdown' },
    { id: 'method-hebrew-reconstruction', kind: 'markdown' },
    { id: 'method-layers', kind: 'markdown' },
    { id: 'method-translation', kind: 'markdown' },
    { id: 'method-transliteration', kind: 'markdown' },
    { id: 'method-tree', kind: 'markdown' }
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

  return {
    MODULES: MODULES,
    ALIASES: ALIASES,
    ids: ids,
    has: has,
    get: get,
    kind: kind
  };
})();

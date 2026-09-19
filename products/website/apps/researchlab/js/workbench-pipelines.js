/**
 * workbench-pipelines.js — реестр конвейеров «Мастерской» (#workbench)
 *
 * Единый источник правды: конфиг конвейера описывает форму входа (inputs),
 * опции, этапы (steps), вьювер результата (viewer) и движок (engine).
 * Интерфейс раннера генерируется из конфига, не хардкодится.
 *
 * Интерфейс движка (для будущего реального LLM-движка):
 *   engine.run(context, onProgress) -> Promise<result>
 *     context = {
 *       runId, pipeline,                  — конфиг из реестра
 *       values,                           — значения формы (inputs + options)
 *       inputText,                        — текст входа (файл/вставка)
 *       inputMeta: { name, chars },       — метаданные входа
 *       signal: { aborted },              — флаг отмены, проверяется между шагами
 *       fastMode                          — мгновенные задержки (тесты)
 *     }
 *     onProgress(update) — update: { stepIndex, status: 'active'|'done', percent, message }
 *                          percent — процент внутри текущего шага (0..100)
 *     result  = { kind, placeholder, meta, segments? }
 *     Отмена: движок выбрасывает ошибку с флагом .cancelled = true.
 */
(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WorkbenchPipelines = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
  'use strict';

  // ===== РЕЕСТР КОНВЕЙЕРОВ =====
  var REGISTRY = {
    'book-translation': {
      id: 'book-translation',
      title: 'Перевод книги',
      icon: 'scribe/scrolls.png',
      description: 'Разбор книги на фрагменты и перевод с удержанием палео-образов. Результат — параллельный вид «оригинал ↔ перевод».',
      tags: ['файл', 'txt/md/pdf', 'языки'],
      inputs: [
        { key: 'file', type: 'file', label: 'Файл книги', accept: '.txt,.md,.pdf,text/plain,text/markdown,application/pdf', hint: 'TXT и Markdown читаются локально; из PDF извлекается текстовый слой', required: true },
        { key: 'sourceLang', type: 'select', label: 'Язык оригинала', default: 'auto', options: [
          { value: 'auto', label: 'Определить автоматически' },
          { value: 'ru', label: 'Русский' },
          { value: 'en', label: 'English' },
          { value: 'he', label: 'עברית' },
          { value: 'phoenician', label: '𐤐𐤍𐤊𐤉 · Финикийское письмо' },
          { value: 'paleo-hebrew', label: '𐤏𐤁𐤓𐤉𐤕 · Палео-иврит' }
        ] },
        { key: 'targetLang', type: 'select', label: 'Язык перевода', default: 'ru', required: true, options: [
          { value: 'ru', label: 'Русский' },
          { value: 'en', label: 'English' }
        ] }
      ],
      options: [
        { key: 'keepPaleo', type: 'toggle', label: 'Удерживать палео-образы', hint: 'Не сворачивать конкретное в абстракцию', default: true },
        { key: 'keepStructure', type: 'toggle', label: 'Сохранять разбивку на фрагменты', default: true }
      ],
      steps: ['Чтение источника', 'Разбор на фрагменты', 'Перевод фрагментов', 'Сверка образов', 'Сборка результата'],
      viewer: 'translation',
      engine: 'mock-book-translation',
      cost: { charsPerToken: 4, pricePer1kTokens: 2, currency: '₽' },
      mockSeconds: 6
    },
    'exposure-check': {
      id: 'exposure-check',
      title: 'Сверка разоблачений',
      icon: 'archaeology/lamp.png',
      description: 'Приём текста и разбор слоёв: где смысловой сдвиг, где подмена. Результат — сводка по слоям.',
      tags: ['текст', 'вставка'],
      inputs: [
        { key: 'text', type: 'text', label: 'Текст для проверки', placeholder: 'Вставьте фрагмент для сверки…', required: true }
      ],
      options: [
        { key: 'strictExposure', type: 'toggle', label: 'Строгий режим сверки', hint: 'Отмечать только доказуемые сдвиги', default: false }
      ],
      steps: ['Приём текста', 'Разбор слоёв', 'Поиск подмен', 'Сводка'],
      viewer: 'exposure',
      engine: 'mock-pass-through',
      cost: { charsPerToken: 4, pricePer1kTokens: 1.5, currency: '₽' },
      mockSeconds: 4
    },
    'root-assembly': {
      id: 'root-assembly',
      title: 'Сборка корня',
      icon: 'paleo/track.png',
      description: 'Сборка слова из корня и палео-образов: форма, действие и физика слова на выходе.',
      tags: ['слово', 'корень'],
      inputs: [
        { key: 'word', type: 'word', label: 'Слово или корень', placeholder: 'напр. אמת', required: true },
        { key: 'sourceLang', type: 'select', label: 'Язык входа', default: 'auto', options: [
          { value: 'auto', label: 'Определить автоматически' },
          { value: 'he', label: 'עברית' },
          { value: 'ru', label: 'Русский' }
        ] }
      ],
      options: [
        { key: 'paleoForms', type: 'toggle', label: 'Показывать палео-формы', default: true }
      ],
      steps: ['Приём слова', 'Поиск корня', 'Сборка образов', 'Сводка'],
      viewer: 'roots',
      engine: 'mock-pass-through',
      cost: { charsPerToken: 4, pricePer1kTokens: 0.5, currency: '₽' },
      mockSeconds: 4
    }
  };

  var DEFAULT_COST = { charsPerToken: 4, pricePer1kTokens: 2, currency: '₽' };
  var DEMO_SAMPLE = 'Песок держит след ноги недолго, но след всё же был.\n\n' +
    'Дом — это не стены, а то, что стены удерживают: тепло, спор, сон.\n\n' +
    'Вода не спорит с камнем. Она проходит и оставляет русло.\n\n' +
    'Имя, сказанное вслух, уже не то же самое, что имя, спрятанное в груди.';

  function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function pace(context, ms) {
    return (context && context.fastMode) ? Promise.resolve() : delay(ms);
  }

  function cancelError() {
    var error = new Error('Запуск отменён');
    error.cancelled = true;
    return error;
  }

  // Разбор текста на фрагменты: абзацы, длинные — режутся, лимит — для памяти.
  function splitChunks(text, limit) {
    var source = String(text || '');
    var parts = source.split(/\n{2,}/).map(function(p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) {
      parts = source.split(/\n/).map(function(p) { return p.trim(); }).filter(Boolean);
    }
    if (!parts.length && source.trim()) parts = [source.trim()];
    var out = [];
    parts.forEach(function(part) {
      while (part.length > 1200) {
        out.push(part.slice(0, 1200));
        part = part.slice(1200);
      }
      if (part) out.push(part);
    });
    return out.slice(0, limit || 40);
  }

  // ===== MOCK-ДВИЖОК: ПЕРЕВОД КНИГИ =====
  function runBookTranslation(context, onProgress) {
    var values = context.values || {};
    var signal = context.signal || {};
    var text = context.inputText || '';

    function guard() { if (signal.aborted) throw cancelError(); }
    function fire(stepIndex, status, percent, message) {
      onProgress({ stepIndex: stepIndex, status: status, percent: percent || 0, message: message || '' });
    }

    return Promise.resolve().then(async function() {
      var targetLang = values.targetLang || 'ru';
      var sourceLang = values.sourceLang || 'auto';

      // Этап 1: чтение источника
      fire(0, 'active', 0, 'Читаю источник…');
      await pace(context, 500); guard();
      var chunks = splitChunks(text, 40);
      if (!chunks.length) chunks = splitChunks(DEMO_SAMPLE, 40);
      fire(0, 'done', 100, 'Прочитано ' + text.length + ' ' + (window.LabPlural ? LabPlural(text.length, 'знак', 'знака', 'знаков') : text.length + ' знаков'));

      // Этап 2: разбор на фрагменты
      fire(1, 'active', 0, 'Разбираю на фрагменты…');
      await pace(context, 700); guard();
      fire(1, 'done', 100, 'Фрагментов: ' + chunks.length);

      // Этап 3: перевод фрагментов
      fire(2, 'active', 0, 'Перевожу фрагменты…');
      var segments = [];
      for (var i = 0; i < chunks.length; i++) {
        guard();
        await pace(context, 140);
        segments.push({
          title: 'Фрагмент ' + (i + 1),
          original: chunks[i],
          translated: '⟦мок-перевод · ' + targetLang + '⟧ ' + chunks[i].slice(0, 200) + (chunks[i].length > 200 ? '…' : '')
        });
        fire(2, 'active', Math.round(((i + 1) / chunks.length) * 100), 'Перевод фрагмента ' + (i + 1) + ' из ' + chunks.length);
      }
      fire(2, 'done', 100, 'Переведено фрагментов: ' + segments.length);

      // Этап 4: сверка образов
      fire(3, 'active', 0, 'Сверяю палео-образы…');
      await pace(context, 600); guard();
      fire(3, 'done', 100, 'Образы удержаны: ' + (values.keepPaleo ? 'да' : 'нет'));

      // Этап 5: сборка результата
      fire(4, 'active', 0, 'Собираю результат…');
      await pace(context, 350); guard();
      fire(4, 'done', 100, 'Готово');

      return {
        kind: 'translation',
        placeholder: false,
        meta: {
          chars: text.length,
          chunks: segments.length,
          sourceLang: sourceLang,
          targetLang: targetLang,
          keepPaleo: !!values.keepPaleo,
          keepStructure: !!values.keepStructure,
          engine: 'mock-book-translation'
        },
        segments: segments
      };
    });
  }

  // ===== MOCK-ДВИЖОК: ПРОХОЖДЕНИЕ ЭТАПОВ (заглушка для будущих конвейеров) =====
  function runPassThrough(context, onProgress) {
    var pipeline = context.pipeline;
    var signal = context.signal || {};

    function guard() { if (signal.aborted) throw cancelError(); }
    function fire(stepIndex, status, percent, message) {
      onProgress({ stepIndex: stepIndex, status: status, percent: percent || 0, message: message || '' });
    }

    return Promise.resolve().then(async function() {
      var last = pipeline.steps.length - 1;
      for (var i = 0; i < pipeline.steps.length; i++) {
        fire(i, 'active', 0, pipeline.steps[i] + '…');
        await pace(context, i === last ? 350 : 450);
        guard();
        fire(i, 'done', 100, pipeline.steps[i] + ' — готово');
      }
      return {
        kind: pipeline.viewer,
        placeholder: true,
        meta: {
          chars: (context.inputText || '').length,
          inputName: (context.inputMeta && context.inputMeta.name) || '',
          engine: 'mock-pass-through'
        },
        note: 'Вьювер в разработке. Результат зафиксирован метаданными проекта.'
      };
    });
  }

  var ENGINES = {
    'mock-book-translation': { kind: 'mock', label: 'Mock-движок перевода', run: runBookTranslation },
    'mock-pass-through': { kind: 'mock', label: 'Mock-движок (прохождение этапов)', run: runPassThrough }
  };

  // ===== API =====
  function list() {
    return Object.keys(REGISTRY).map(function(key) { return REGISTRY[key]; });
  }

  function get(id) {
    return REGISTRY[id] || null;
  }

  function engine(name) {
    return ENGINES[name] || null;
  }

  // Смета: ~chars/4 токена; константы стоимости — в конфиге конвейера.
  function estimate(pipeline, chars) {
    var cost = (pipeline && pipeline.cost) || DEFAULT_COST;
    var safeChars = Math.max(0, chars || 0);
    var tokens = Math.max(1, Math.ceil(safeChars / (cost.charsPerToken || 4)));
    var price = Math.round((tokens / 1000) * (cost.pricePer1kTokens || 0) * 100) / 100;
    return {
      chars: safeChars,
      tokens: tokens,
      price: price,
      currency: cost.currency || '₽',
      seconds: (pipeline && pipeline.mockSeconds) || ((pipeline && pipeline.steps.length) || 4) * 1.2
    };
  }

  return {
    list: list,
    get: get,
    engine: engine,
    estimate: estimate,
    DEFAULT_COST: DEFAULT_COST
  };
}));

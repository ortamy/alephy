'use strict';

// Тест реестра конвейеров и mock-движков «Мастерской» (#workbench).
// Запуск: node tests/workbench.test.js

const assert = require('assert');
const WorkbenchPipelines = require('../js/workbench-pipelines.js');
const fs = require('fs');
const path = require('path');

const KNOWN_VIEWERS = ['translation', 'exposure', 'roots'];

function testRegistry() {
  const list = WorkbenchPipelines.list();
  assert.strictEqual(list.length, 3, 'В реестре три стартовых конвейера');
  const ids = list.map(function(p) { return p.id; });
  assert.deepStrictEqual(ids.sort(), ['book-translation', 'exposure-check', 'root-assembly']);

  list.forEach(function(pipeline) {
    assert.ok(pipeline.id && pipeline.title && pipeline.icon && pipeline.description, 'Базовые поля заполнены: ' + pipeline.id);
    assert.ok(Array.isArray(pipeline.inputs) && pipeline.inputs.length, 'inputs описаны: ' + pipeline.id);
    assert.ok(Array.isArray(pipeline.steps) && pipeline.steps.length >= 3, 'Этапы описаны: ' + pipeline.id);
    assert.ok(KNOWN_VIEWERS.indexOf(pipeline.viewer) !== -1, 'Вьювер известен: ' + pipeline.id);
    assert.ok(WorkbenchPipelines.engine(pipeline.engine), 'Движок подключён: ' + pipeline.id);
    assert.ok(pipeline.cost && pipeline.cost.pricePer1kTokens > 0, 'Константы стоимости заданы: ' + pipeline.id);
  });
  console.log('OK  реестр: 3 конвейера, поля, вьюверы, движки, стоимость');
}

function testBookTranslationInputs() {
  const pipeline = WorkbenchPipelines.get('book-translation');
  const file = pipeline.inputs.filter(function(input) { return input.key === 'file'; })[0];
  const sourceLang = pipeline.inputs.filter(function(input) { return input.key === 'sourceLang'; })[0];
  const languages = sourceLang.options.map(function(option) { return option.value; });

  assert.ok(file.accept.includes('.pdf'), 'Конвейер принимает PDF');
  assert.ok(file.accept.includes('.txt') && file.accept.includes('.md'), 'Текстовые форматы остаются доступны');
  assert.ok(languages.includes('phoenician'), 'Доступно финикийское письмо');
  assert.ok(languages.includes('paleo-hebrew'), 'Доступен палео-иврит');
  console.log('OK  перевод книги: PDF и палео-языки доступны');
}

function testExportFormats() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'workbench.js'), 'utf8');
  ['export-pdf', 'export-md', 'export-txt', 'export-json'].forEach(function(action) {
    assert.ok(source.includes(action), 'Доступен экспорт: ' + action);
  });
  assert.ok(source.includes('window.print()'), 'PDF открывает печатное представление');
  assert.ok(source.includes('openExportModal(runId)'), 'Экспорт доступен из списка проектов');
  console.log('OK  экспорт: PDF, Markdown, TXT и JSON');
}

function testEstimate() {
  const pipeline = WorkbenchPipelines.get('book-translation');
  const estimate = WorkbenchPipelines.estimate(pipeline, 4000);
  assert.strictEqual(estimate.chars, 4000);
  assert.strictEqual(estimate.tokens, 1000, '4000 знаков ≈ 1000 токенов (chars/4)');
  assert.strictEqual(estimate.price, 2, '1000 токенов по 2₽/1k = 2₽');
  assert.ok(estimate.seconds > 0);
  const empty = WorkbenchPipelines.estimate(pipeline, 0);
  assert.strictEqual(empty.tokens, 1, 'Минимум 1 токен');
  console.log('OK  смета: chars/4 → токены, цена из конфига');
}

function collectProgress(onProgress, stepsCount) {
  const events = [];
  return {
    events: events,
    onProgress: function(update) {
      events.push(update);
      onProgress(update);
    },
    stepsCount: stepsCount
  };
}

async function testMockBookTranslation() {
  const pipeline = WorkbenchPipelines.get('book-translation');
  const recorder = collectProgress(function() {}, pipeline.steps.length);
  const statuses = {};
  const demoText = 'Первый абзац про след на песке.\n\nВторой абзац про дом и тепло.\n\nТретий абзац про воду.';

  const result = await WorkbenchPipelines.engine(pipeline.engine).run({
    runId: 'test-1',
    pipeline: pipeline,
    values: { sourceLang: 'ru', targetLang: 'en', keepPaleo: true, keepStructure: true },
    inputText: demoText,
    inputMeta: { name: 'demo.txt', chars: demoText.length },
    signal: { aborted: false },
    fastMode: true
  }, recorder.onProgress);

  assert.strictEqual(result.kind, 'translation');
  assert.strictEqual(result.placeholder, false);
  assert.strictEqual(result.meta.engine, 'mock-book-translation');
  assert.strictEqual(result.meta.chars, demoText.length);
  assert.ok(result.segments.length === 3, 'Три фрагмента по абзацам');
  assert.ok(result.segments[0].original.indexOf('Первый абзац') === 0);
  assert.ok(result.segments[0].translated.length > 0);

  recorder.events.forEach(function(event) {
    if (event.status === 'done') statuses[event.stepIndex] = true;
  });
  for (let i = 0; i < pipeline.steps.length; i++) {
    assert.ok(statuses[i], 'Этап завершён: ' + pipeline.steps[i]);
  }
  console.log('OK  mock-движок перевода: 5 этапов, фрагменты, результат');
}

async function testCancel() {
  const pipeline = WorkbenchPipelines.get('book-translation');
  const signal = { aborted: false };
  let first = true;

  await assert.rejects(
    WorkbenchPipelines.engine(pipeline.engine).run({
      runId: 'test-2',
      pipeline: pipeline,
      values: { targetLang: 'ru' },
      inputText: 'Абзац.\n\nАбазац два.',
      inputMeta: { name: 'x.txt', chars: 16 },
      signal: signal,
      fastMode: false // реальные задержки, чтобы успеть отменить между шагами
    }, function() {
      if (first) { signal.aborted = true; first = false; }
    }),
    function(error) {
      return error && error.cancelled === true;
    },
    'Отмена должна выбрасывать ошибку с флагом cancelled'
  );
  console.log('OK  отмена: signal.aborted прерывает движение по этапам');
}

async function testPassThrough() {
  const pipeline = WorkbenchPipelines.get('exposure-check');
  const result = await WorkbenchPipelines.engine(pipeline.engine).run({
    runId: 'test-3',
    pipeline: pipeline,
    values: { strictExposure: false },
    inputText: 'Текст для сверки слоёв.',
    inputMeta: { name: '', chars: 22 },
    signal: { aborted: false },
    fastMode: true
  }, function() {});

  assert.strictEqual(result.kind, 'exposure');
  assert.strictEqual(result.placeholder, true, 'Вьювер exposure — заглушка');
  assert.ok(result.note.indexOf('Вьювер') === 0);
  console.log('OK  pass-through: exposure-check проходит этапы, вьювер-заглушка');
}

// Регрессия хаба: bento-каркас + тулбар в анатомии «Агентов».
// Проверяем исходник разметки и CSS, а не только реестр движков.
function testHubBento() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'workbench.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'workbench-bento.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  assert.ok(
    source.includes('class="agent-controls-panel wb-controls-panel"') &&
      source.includes('class="agent-toolbar-row"') &&
      source.includes('class="wb-filter-chips agent-filter-chips"'),
    'Тулбар хаба повторяет оболочку .agent-controls-panel модуля «Агенты»'
  );
  assert.ok(html.includes('css/workbench-bento.css'), 'Стили хаба подключены в index.html');

  assert.ok(source.includes('class="wb-bento"'), 'Хаб собран на bento-сетке');
  assert.ok(
    source.includes('wb-cell--projects') && source.includes('class="wb-rail"') &&
      source.includes('wb-cell--wide'),
    'Ячейки хаба: список, липкая колонка и широкий блок'
  );
  // 7 + 5 в каждой строке и широкий блок 1/-1 — пропорции §5.2a.
  assert.ok(css.includes('grid-template-columns: repeat(12, minmax(0, 1fr));'), 'Сетка — 12 колонок');
  assert.ok(/\.wb-cell--projects \{ grid-column: span 7; \}/.test(css), 'Список занимает 7 колонок');
  assert.ok(/\.wb-rail \{[\s\S]*?grid-column: span 5;/.test(css), 'Правая колонка занимает 5 колонок');
  assert.ok(/\.wb-cell--wide \{ grid-column: 1 \/ -1; \}/.test(css), 'Широкая ячейка тянется на строку');

  // Ink-ячейка ровно одна, и акцент несёт золотая рамка (--bg-dark в
  // светлых темах почти белый).
  assert.strictEqual((source.match(/wb-cell--ink/g) || []).length, 1, 'Ink-ячейка ровно одна');
  assert.ok(/\.wb-cell--ink \{[\s\S]*?border-color: var\(--border-gold\);/.test(css), 'Ink-ячейка с золотой рамкой');

  assert.ok(source.includes('wb-badge-dot'), 'Статус проекта — пилюля с точкой, как у агентов');
  assert.ok(
    source.includes('meta.status === \'draft\'') && source.includes('status: \'draft\''),
    'Проект создаётся сразу в статусе «черновик»'
  );
  assert.ok(source.includes("statusLabel(status)") && source.includes("draft: 'Черновик'"), 'Черновик подписан в списке статусов');
  console.log('OK  хаб: тулбар агентов, bento 12/7/5, ink-ячейка, создание проекта');
}

// Фильтр и поиск не должны ронять страницу при пустом хранилище.
function testHubFilterHelpers() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'workbench.js'), 'utf8');
  assert.ok(source.includes('function projectMatchesHub(meta)'), 'Фильтр хаба вынесен в отдельную функцию');
  assert.ok(
    source.includes('if (hubUiState.status !== \'all\' && meta.status !== hubUiState.status) return false;'),
    'Чип статуса отсекает чужие проекты'
  );
  assert.ok(source.includes('hubEmptyHtml()'), 'Пустое состояние отличает «нет проектов» от «нет по фильтру»');
  assert.ok(source.includes('data-wb-action="reset-filters"'), 'Есть сброс фильтров из пустого состояния');
  console.log('OK  фильтры хаба: статус, поиск, пустое состояние, сброс');
}

(async function run() {
  testRegistry();
  testBookTranslationInputs();
  testExportFormats();
  testEstimate();
  testHubBento();
  testHubFilterHelpers();
  await testMockBookTranslation();
  await testCancel();
  await testPassThrough();
  console.log('ВСЕ ТЕСТЫ ПРОЙДЕНЫ');
})().catch(function(error) {
  console.error('ПРОВАЛ:', error);
  process.exit(1);
});

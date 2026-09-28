'use strict';

// Проверка агрегирования дат и статусов рабочего стола (#dashboard).
// Запуск: node tests/dashboard.test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'dashboard.js'), 'utf8');
const css = fs.readFileSync(require('path').join(__dirname, '..', 'css', 'dashboard.css'), 'utf8');
const cssFlat = css.replace(/\s+/g, ' ');
const sandbox = {
  window: {},
  document: {
    createElement: function() {
      return {
        textContent: '',
        get innerHTML() { return this.textContent; }
      };
    }
  },
  console: console,
  Date: Date,
  Promise: Promise
};
vm.runInNewContext(source, sandbox, { filename: 'dashboard.js' });

function testResearchMetrics() {
  const metrics = sandbox.window.Dashboard.getResearchMetrics([
    { createdAt: '2026-08-29', updatedAt: '2026-08-29', status: 'published', confidence: 'verified' },
    { createdAt: '2026-08-25', updatedAt: '2026-08-29', status: 'published', confidence: 'needs-review' },
    { createdAt: '2026-08-01', updatedAt: '2026-08-10', status: 'draft', confidence: 'hypothesis' },
    { createdAt: 'invalid', updatedAt: '', status: 'published', confidence: 'needs-review' }
  ]);

  assert.strictEqual(metrics.referenceDate, '2026-08-29');
  assert.strictEqual(metrics.new7, 2, 'Включает записи, созданные в последние семь дней');
  assert.strictEqual(metrics.new30, 3, 'Некорректные даты не учитываются');
  assert.strictEqual(metrics.updated7, 1, 'Не считает создание как отдельное обновление');
  assert.strictEqual(metrics.updated30, 2);
  assert.strictEqual(metrics.verified, 1);
  assert.strictEqual(metrics.needsReview, 2);
  assert.strictEqual(metrics.hypothesis, 1);
  assert.strictEqual(metrics.published, 3);
  assert.strictEqual(metrics.draft, 1);
  console.log('OK  dashboard: движение материалов и контур надёжности');
}

function testEmptyMetrics() {
  const metrics = sandbox.window.Dashboard.getResearchMetrics([]);
  assert.strictEqual(metrics.referenceDate, '');
  assert.strictEqual(metrics.new7, 0);
  assert.strictEqual(metrics.updated30, 0);
  console.log('OK  dashboard: пустой набор данных');
}

function testResearchActivity() {
  const activity = sandbox.window.Dashboard.getResearchActivity([
    { id: 'first', title: 'Первый', createdAt: '2026-08-10', updatedAt: '2026-08-11', changelog: [{ date: '2026-08-12', note: 'Уточнён Хук' }] },
    { id: 'second', title: 'Второй', createdAt: '2026-08-13', updatedAt: '2026-08-13' },
    { id: 'third', title: 'Третий', createdAt: '2026-08-10', updatedAt: '2026-08-14' },
    { id: 'invalid', title: 'Неверный', changelog: [{ date: 'не дата', note: 'Не попадёт' }] }
  ]);

  assert.strictEqual(activity.length, 4, 'Берёт changelog или резервные события дат материалов');
  assert.strictEqual(activity[0].date, '2026-08-14');
  assert.strictEqual(activity[0].type, 'updated');
  assert.strictEqual(activity[1].date, '2026-08-13');
  assert.strictEqual(activity[1].type, 'new');
  assert.strictEqual(activity[2].note, 'Уточнён Хук', 'Changelog имеет приоритет над резервными событиями');
  assert.strictEqual(activity[3].date, '2026-08-10');
  console.log('OK  dashboard: живая лента активности');
}

function testReviewQueueRemoved() {
  assert.ok(!source.includes('Очередь проверки'), 'Блок «Очередь проверки» удалён из разметки модуля');
  assert.ok(!/dw-review/.test(source), 'Разметка очереди проверки не возвращается');
  assert.strictEqual(typeof sandbox.window.Dashboard.getReviewQueue, 'undefined', 'Публичный API без очереди проверки');
  console.log('OK  dashboard: очередь проверки удалена');
}

function testCounterDeltas() {
  const deltas = sandbox.window.Dashboard.getCounterDeltas([
    { createdAt: '2026-08-29' },
    { createdAt: '2026-08-10' },
    { createdAt: '2026-07-20' },
    { createdAt: 'invalid' }
  ]);
  assert.strictEqual(deltas.researches.kind, 'up');
  assert.strictEqual(deltas.researches.text, '+2 за 30 дней');
  assert.strictEqual(deltas.snapshot.kind, 'neutral', 'Без истории другого источника не выводит ложную дельту');

  const empty = sandbox.window.Dashboard.getCounterDeltas([]);
  assert.strictEqual(empty.researches.text, 'нет истории');
  console.log('OK  dashboard: дельты счётчиков');
}

function testCompletenessMap() {
  const map = sandbox.window.Dashboard.getCompletenessMap([
    { id: 'full', slug: 'full-case', title: 'Полный', roots: ['dbr'], sources: ['book'], sections: { thesis: 'Тезис', original: 'Контур', shift: 'Сдвиг', transmissionChain: ['Шаг'], evidence: ['Свидетельство'], reconstruction: 'Сборка' } },
    { id: 'empty', title: 'Пустой', roots: [], sources: [], sections: {} },
    { id: 'half', title: 'Половина', roots: ['dbr'], sources: [], sections: { thesis: 'Тезис', original: 'Контур', shift: 'Сдвиг' } }
  ]);
  assert.strictEqual(map.average, 50);
  assert.strictEqual(map.items[0].title, 'Пустой');
  assert.strictEqual(map.items[0].percent, 0);
  assert.strictEqual(map.items[0].missing.length, 8);
  assert.strictEqual(map.items[2].percent, 100);
  assert.ok(map.items[2].missing.length === 0);
  console.log('OK  dashboard: карта полноты материалов');
}

function testSummaryRendering() {
  const html = sandbox.window.Dashboard.renderCounters({ roots: [], researches: [{ createdAt: '2026-08-29' }], heraldry: [], dictionaries: {} }, [{ key: 'one', title: 'Один', count: 2 }], 2);
  assert.ok(html.includes('dw-summary'), 'Счётчики собраны в один блок');
  assert.ok(html.includes('Сводка исследований'));
  assert.ok(html.includes('Срез данных: 2026-08-29'));
  ['#root-dictionary', '#dictionaries', '#researches', '#heraldry'].forEach(function(route) {
    assert.ok(html.includes('href="' + route + '"'), 'Показатель ведёт в существующий модуль: ' + route);
  });
  assert.strictEqual((html.match(/dw-summary-item--link/g) || []).length, 5, 'Все показатели сводки кликабельны');
  assert.ok(!html.includes('dw-counter"'), 'Старые отдельные карточки удалены');
  assert.ok(!/\bdw-summary-item[^>]*\breveal\b/.test(html), 'Сводка не стартует с opacity:0 через .reveal');
  assert.ok(html.includes('dw-summary-value'), 'Цифры сводки присутствуют в разметке');
  console.log('OK  dashboard: единый блок статистики');
}

function testDashboardWidgetOrder() {
  const sourceIndex = source.indexOf('renderCounters(data, dictEntries, totalTerms)');
  const tickerIndex = source.indexOf('renderActivityTicker(data.researches)', sourceIndex);
  const booksIndex = source.indexOf('renderBooksProgress(data.qumranBooks, data.bookProgress)', tickerIndex);
  const nextGridIndex = source.indexOf('renderMechanismsBars(dictEntries)', booksIndex);
  assert.ok(sourceIndex < tickerIndex && tickerIndex < booksIndex && booksIndex < nextGridIndex, 'Лента и дерево идут сразу после сводки');
  console.log('OK  dashboard: порядок виджетов');
}

const CELL_MODIFIERS = ['summary', 'ticker', 'books', 'dicts', 'latest', 'movement', 'reliability', 'completeness'];

function testBentoCells() {
  assert.ok(source.includes('<div class="dw-bento">'), 'Ячейки собраны в bento-сетку');
  assert.ok(source.includes('"dw-cell dw-cell--summary"'), 'Сводка — ячейка сетки, а не отдельный блок над ней');
  // Модификаторы приходят аргументом общего helper'а, поэтому ищем их вызовы.
  ['ticker', 'books', 'dicts', 'latest', 'movement', 'reliability'].forEach(function(modifier) {
    assert.ok(source.includes("renderCell('" + modifier + "'"), 'Ячейка объявлена в разметке: ' + modifier);
  });
  assert.ok(source.includes('dw-cell--completeness'), 'Карта полноты — ячейка сетки со своим телом');
  assert.ok(!/dw-widget|dw-grid|dw-summary-heading/.test(source), 'Старые карточки рабочего стола удалены');
  // Шапку §4.1 ставит общий helper; сводка и карта полноты строят её сами.
  assert.ok(source.includes('function renderCell('), 'Ячейки строятся общей функцией с шапкой §4.1');
  const headLiterals = (source.match(/dw-cell-head/g) || []).length;
  assert.ok(headLiterals >= 3, 'Шапка объявлена у helper, сводки и карты полноты: ' + headLiterals);
  assert.ok(source.includes('dw-num'), 'Шапка несёт номер главы (§4.1)');
  console.log('OK  dashboard: bento-ячейки и шапки');
}

function testBentoSpans() {
  assert.ok(/grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/.test(cssFlat), 'Bento-сетка — 12 колонок');

  // Контракт разметки и CSS: у каждого модификатора из JS есть правило пропорции.
  CELL_MODIFIERS.forEach(function(modifier) {
    assert.ok(new RegExp('\\.dw-cell--' + modifier + '\\b[^{]*\\{').test(cssFlat),
      'Модификатор ячейки объявлен в CSS: .dw-cell--' + modifier);
  });
  ['summary', 'ticker'].forEach(function(modifier) {
    assert.ok(new RegExp('\\.dw-cell--' + modifier + '\\b[^{]*\\{[^}]*grid-column: 1 / -1').test(cssFlat),
      'Ячейка занимает строку целиком: .dw-cell--' + modifier);
  });
  [['books', 'dicts'], ['latest', 'movement'], ['reliability', 'completeness']].forEach(function(pair) {
    const spans = pair.map(function(modifier) {
      const match = cssFlat.match(new RegExp('\\.dw-cell--' + modifier + '\\s*\\{[^}]*grid-column: span (\\d+)'));
      assert.ok(match, 'Пропорция ячейки объявлена в CSS: .dw-cell--' + modifier);
      return Number(match[1]);
    });
    assert.strictEqual(spans[0] + spans[1], 12,
      'Пара ячеек заполняет строку без пустых колонок: ' + pair.join(' + '));
  });
  console.log('OK  dashboard: пропорции bento-ячеек');
}

function testCompletenessTrack() {
  // Дорожка была без стилей: inline-спаны игнорируют width/height, и полоса не рисовалась.
  assert.ok(/\.dw-completeness-track \{[^}]*display: block/.test(cssFlat), 'Дорожка полноты отрисована блочно');
  assert.ok(/\.dw-completeness-fill \{[^}]*height: 100%/.test(cssFlat), 'Заливка полноты тянется по дорожке');
  console.log('OK  dashboard: дорожка полноты');
}

function testFlatUiTokens() {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/box-shadow/.test(clean), 'Тени в новом UI запрещены (§0.2, §1.5)');
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(clean), 'Литералы цветов запрещены: только var() (§1.1, §8.3)');
  assert.ok(!/border-radius:\s*\d/.test(clean), 'Радиусы только через --radius-* (§1.4)');
  assert.ok(!/\bz-index/.test(clean), 'Литеральный z-index запрещён (§1.6)');
  // Ловушка «*/ внутри комментария»: при преждевременном закрытии текст утекает
  // в тело стилей и съедает следующее правило. В таблице стилей кириллицы быть не может.
  assert.ok(!/[а-яё§]/i.test(clean), 'Комментарий не выходит за границы /* */');
  console.log('OK  dashboard: плоский UI и токены');
}

function testSingleStylesheetOwner() {
  // Рабочий стол имеет одного владельца стилей: копия .dw-*/.book-card в файле,
  // подключённом позже, молча перебивает бенто — так и случилось с redesign.css.
  ['redesign.css', 'theme-parchment.css'].forEach(function(file) {
    const raw = fs.readFileSync(require('path').join(__dirname, '..', 'css', file), 'utf8');
    const clean = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.dw-/.test(clean), file + ': стили рабочего стола объявлены только в css/dashboard.css');
    assert.ok(!/\.book-card/.test(clean), file + ': карточки книг рабочего стола объявлены только в css/dashboard.css');
  });
  console.log('OK  dashboard: единственный владелец стилей');
}

testResearchMetrics();
testEmptyMetrics();
testResearchActivity();
testReviewQueueRemoved();
testCounterDeltas();
testCompletenessMap();
testSummaryRendering();
testDashboardWidgetOrder();
testBentoCells();
testBentoSpans();
testCompletenessTrack();
testFlatUiTokens();
testSingleStylesheetOwner();
'use strict';

// Проверка агрегирования дат и статусов рабочего стола (#dashboard).
// Запуск: node tests/dashboard.test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'dashboard.js'), 'utf8');
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

function testReviewQueue() {
  const queue = sandbox.window.Dashboard.getReviewQueue([
    { id: 'complete', title: 'Полный', confidence: 'needs-review', updatedAt: '2026-08-20', roots: ['dbr'], sources: ['source'], sections: { thesis: 'Тезис', original: 'Контур', shift: 'Сдвиг', transmissionChain: ['Шаг'], evidence: ['Свидетельство'], reconstruction: 'Сборка' } },
    { id: 'broken', title: 'Разрывы', confidence: 'needs-review', updatedAt: '2026-08-10', roots: [], sources: [], sections: {} },
    { id: 'newer', title: 'Новый разрыв', confidence: 'needs-review', updatedAt: '2026-08-21', roots: [], sources: [], sections: {} },
    { id: 'verified', title: 'Проверенный', confidence: 'verified', updatedAt: '2026-08-30', roots: [], sources: [], sections: {} }
  ]);

  assert.strictEqual(queue.length, 3, 'В очередь попадают только needs-review');
  assert.strictEqual(queue[0].title, 'Новый разрыв', 'При равной неполноте выше более свежий материал');
  assert.strictEqual(queue[0].missing.length, 8);
  assert.strictEqual(queue[2].title, 'Полный');
  assert.strictEqual(queue[2].missing.length, 0);
  assert.ok(queue[0].missing.includes('источники'));
  assert.ok(queue[0].missing.includes('реконструкция'));
  console.log('OK  dashboard: очередь проверки');
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

testResearchMetrics();
testEmptyMetrics();
testResearchActivity();
testReviewQueue();
testCounterDeltas();
testCompletenessMap();
testSummaryRendering();
testDashboardWidgetOrder();
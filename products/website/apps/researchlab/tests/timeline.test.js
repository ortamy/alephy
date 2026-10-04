'use strict';

// Регресс-тест внутренней страницы палео-таймлайн (#timeline/<id>, §5.2r).
// Запуск: node tests/timeline.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(appDir, 'css', 'timeline.css'), 'utf8');
const source = fs.readFileSync(path.join(appDir, 'js', 'timeline.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');

// 1. Хром ленты собран в один командный тулбар (§4.7): общая оболочка
//    .lab-toolbar + модульный класс раскладки.
assert.ok(source.includes('class="lab-toolbar tl-detail-toolbar"'),
  'Детальный экран должен несть тулбар .lab-toolbar.tl-detail-toolbar');

// 2. Возврат к каталогу переехал в тулбар и одет в канонную кнопку.
assert.ok(/class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn tl-detail-back"/.test(source),
  'Кнопка «К каталогу» должна жить в тулбаре и несть классы .lab-btn-secondary');
assert.ok(!/tl-detail-toolbar"><button class="tl-detail-back"/.test(source),
  'Отдельной строки возврата без канонной кнопки быть не должно');

// 3. Поиск — часть тулбара, а не отдельная полоса.
assert.ok(/class="lab-input lab-toolbar-search tl-detail-search"/.test(source),
  'Поиск по событиям должен несть .lab-toolbar-search внутри тулбара');

// 4. Пикер сравнения стал общим помощником и живёт в группе тулбара.
assert.ok(/function compareSelectHtml\(/.test(source), 'Пикер сравнения вынесен в compareSelectHtml');
assert.ok(/class="lab-toolbar-group tl-detail-compare"/.test(source),
  'Пикер сравнения должен лежать в группе тулбара');
assert.ok(!/tl-compare-launch/.test(source) && !/tl-compare-launch/.test(css),
  'Старая строка-пикер .tl-compare-launch должна быть удалена');

// 5. Контент — бенто из двух ячеек: липкая ось и события.
assert.ok(/class="tl-bento"/.test(source), 'Полный вид рендерит лист .tl-bento');
assert.ok(/class="tl-cell tl-cell--axis"/.test(source) && /class="tl-cell tl-cell--events"/.test(source),
  'Лист состоит из ячеек оси и событий');
assert.ok(/class="tl-cell-head"><span class="tl-num">01<\/span><span class="tl-cell-title">/.test(source),
  'Ячейка несёт шапку §4.1a: номер главы + лейбл');

// 6. Сетка bento — 12 колонок, hairline-ячейка без теней (§0.2).
assert.ok(/\.tl-bento\s*\{[^}]*grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/.test(css),
  'Сетка bento должна быть на 12 колонок');
assert.ok(/\.tl-cell\s*\{[^}]*box-shadow:\s*none/.test(css), 'У ячейки не должно быть тени');
assert.ok(/\.tl-cell--axis\s*\{[^}]*position:\s*sticky/.test(css),
  'Ось должна быть липкой ячейкой');

// 7. Шапка ячейки по §4.1a: селектор с .module и сброс базового h2.
assert.ok(/\.module \.tl-cell \.tl-cell-title\s*\{[^}]*border-bottom:\s*0/.test(css),
  'Заголовок ячейки обязан сбросить базовый .module h2 (пунктир в §4.1a)');

// 8. Мобильный закон §5.3: на ≤900px ось перестаёт липнуть.
assert.ok(/@media \(max-width:\s*900px\)[\s\S]*?\.tl-cell--axis\s*\{\s*position:\s*static/.test(css),
  'На ≤900px липкая ось должна вставать в поток');

// 9. Хуки, на которые опирается smoke-кейс, остались в разметке.
['tl-detail-search', 'tl-detail-empty', 'tl-detail-event', 'tl-detail-back', 'tl-detail-count']
  .forEach(function(hook) {
    assert.ok(source.includes(hook), 'Потерян хук smoke-проверки: ' + hook);
  });
assert.ok(/class="tl-detail-events" role="list"/.test(source),
  'Список событий сохраняет role="list"');

// 10. Кэш-версия производных файлов обновлена вместе с правкой.
assert.ok(indexSource.includes('css/timeline.css?v=20261004-tl-ux'),
  'index.html должен перезапрашивать timeline.css новой версией');
assert.ok(indexSource.includes('js/timeline.js?v=20261004-tl-ux'),
  'index.html должен перезапрашивать timeline.js новой версией');
assert.ok(indexSource.includes('css/linear-timeline.css?v=20261004-tl-ux'),
  'index.html должен перезапрашивать linear-timeline.css новой версией');

// 11. Глиф-чип убран из тулбара: палео-буква больше не дублирует иконку шапки.
assert.ok(!/tl-toolbar-glyph/.test(source) && !/tl-toolbar-glyph/.test(css),
  'Глиф-чип .tl-toolbar-glyph должен быть удалён из разметки и стилей');

// 12. Поиск держит левый край панели (order: 1), а не середину.
assert.ok(/\.tl-detail-toolbar \.tl-detail-search\s*\{[^}]*order:\s*1/.test(css),
  'Поиск в тулбаре должен идти первым (order: 1) — левый край');

// 13. Кнопки, селект и поиск делят единую высоту контрола.
assert.ok(/\.tl-detail-toolbar\s*\{[^}]*--tl-ctl-h:\s*var\(--control-h\)/.test(css) &&
  /\.tl-detail-toolbar \.lab-toolbar-btn,[\s\S]*?height:\s*var\(--tl-ctl-h\)/.test(css),
  'Контролы тулбара должны выравниваться по компактной высоте --control-h (паритет с хабом)');

// 14. Действия события несут Lucide-иконки, а не текстовые глифы.
assert.ok(/data-action="open"[^>]*><i data-lucide="chevron-right"/.test(source),
  'Действие «открыть» несёт Lucide-иконку chevron-right');
assert.ok(/data-action="copy"[^>]*><i data-lucide="link"/.test(source),
  'Действие «копировать» несёт Lucide-иконку link');
assert.ok(!/data-action="open"[^>]*>›/.test(source),
  'Текстовый глиф «›» должен исчезнуть из действий события');
assert.ok(/function refreshIcons\(/.test(source),
  'Иконки тулбара материализуются через refreshIcons()');

// 15. На ≤768px модуль отдаёт контролы под тап-таргет 44px (как redesign).
assert.ok(/@media \(max-width:\s*768px\)[\s\S]*?\.tl-detail-toolbar\s*\{\s*--tl-ctl-h:\s*44px/.test(css),
  'На ≤768px высота контролов тулбара должна расти до 44px');

process.exitCode = 0;

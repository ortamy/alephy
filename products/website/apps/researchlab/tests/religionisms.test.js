'use strict';

// Регресс-тест раскладки bento «Религионизмов» (#religionisms, §5.2h).
// Запуск: node tests/religionisms.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(appDir, 'css', 'religionisms.css'), 'utf8');
const moduleSource = fs.readFileSync(path.join(appDir, 'js', 'modules', 'religionisms.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(appDir, 'js', 'page-controller.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
// Файл отдаётся с BOM — JSON.parse его не берёт, снимаем метку.
const spheres = JSON.parse(
  fs.readFileSync(path.join(appDir, 'data', 'religionisms', 'religionisms.json'), 'utf8').replace(/^﻿/, '')
).spheres;

// 1. Сетка — 12 колонок, каталог и паспорт по 7, рельс 5.
assert.ok(/\.rel-bento\s*\{[^}]*grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/.test(css),
  'Сетка bento должна быть на 12 колонок');
assert.ok(/\.rel-cell--catalog,\s*\n\.rel-cell--passport\s*\{[^}]*grid-column:\s*span 7/.test(css),
  'Каталог и паспорт занимают 7 колонок');
assert.ok(/\.rel-rail\s*\{[^}]*grid-column:\s*span 5/.test(css),
  'Рельс занимает 5 колонок: 7 + 5 = 12, дыр в строках нет');

// 2. Мобильный закон §5.3: до 900px рельс перестаёт быть липким.
assert.ok(/@media \(max-width: 900px\)[\s\S]*?\.rel-rail\s*\{\s*position:\s*static/.test(css),
  'На ≤900px рельс должен перестать быть липким');

// 3. Тени запрещены (§0.2), золото несёт только рамка ink-ячейки.
assert.ok(/\.rel-cell\s*\{[^}]*box-shadow:\s*none/.test(css), 'У ячейки не должно быть тени');
assert.ok(/\.rel-cell--ink\s*\{[^}]*border-color:\s*var\(--border-gold\)/.test(css),
  'Ink-ячейка держит золото в рамке');

// 4. Ровно одна ink-ячейка на экран: обе разметки помечают её один раз.
assert.strictEqual((catalogMarkupSource().match(/rel-cell--ink/g) || []).length, 1,
  'На экране каталога ink-ячейка должна быть одна');
assert.strictEqual((sphereMarkupSource().match(/rel-cell--ink/g) || []).length, 1,
  'На экране сферы ink-ячейка должна быть одна');

// 5. Кнопка «Назад к сферам» живёт в тулбаре, а не под заголовком.
assert.ok(/id="rel-back"[^>]*>[\s\S]*?Назад к сферам/.test(controllerSource),
  'Кнопка возврата должна быть в разметке тулбара');
assert.ok(!/lab-btn-secondary lab-btn-sm mb-16" onclick="Religionisms\.close/.test(moduleSource),
  'Отдельная кнопка возврата под заголовком должна быть удалена');

// 6. Оба экрана живут в одной оболочке #rel-screen.
assert.ok(/id="rel-screen"/.test(controllerSource), 'Нужен общий контейнер экранов');
assert.ok(/activeSphereId \? sphereMarkup\(\) : catalogMarkup\(\)/.test(moduleSource),
  'Рендер выбирает экран по активной сфере');

// 7. Каждая сфера заполняет все девять компонентов, иначе блок 04 будет с дырами.
spheres.forEach(function(sphere) {
  ['altar', 'victim', 'priest', 'promise', 'ritual', 'sanctuary', 'teaching', 'pattern', 'end']
    .forEach(function(key) {
      assert.ok(typeof sphere[key] === 'string' && sphere[key].trim(),
        'Сфера ' + sphere.id + ' без компонента ' + key);
    });
});

// 8. Стиль подключён к странице.
assert.ok(/href="css\/religionisms\.css/.test(indexSource), 'religionisms.css должен быть подключён');

// 9. Осиротевшие классы прежнего detail-view удалены.
['rel-detail', 'rel-comp-detail-grid', 'rel-comp-block', 'rel-root-block', 'rel-root-title']
  .forEach(function(className) {
    assert.ok(!new RegExp('class="[^"]*\\b' + className + '\\b').test(moduleSource),
      'Класс ' + className + ' больше не используется в модуле');
    assert.ok(!new RegExp('\\.' + className + '\\s*\\{').test(css),
      'Для ' + className + ' не должно остаться правил в CSS');
  });

// 10. Плотность: манифестная мера прозы не должна проникать в ячейки.
// Иначе каждый абзац возвращает себе 20px снизу, а блоки растягиваются
// вдвое выше содержимого — это был главный источник воздуха на экране.
assert.ok(/\.lab-content \.module \.rel-cell p[\s\S]*?max-width:\s*none/.test(css),
  'Манифестная мера (.lab-content .module p) должна быть сброшена в ячейках');

// 11. Ячейка и сетка не разнесены: gap 8px и padding 12px, а не 12/16.
assert.ok(/\.rel-bento\s*\{[^}]*gap:\s*var\(--space-2\)/.test(css),
  'Зазор между ячейками bento — 8px');
assert.ok(/\.rel-cell\s*\{[^}]*padding:\s*var\(--space-3\)/.test(css),
  'Внутренний отступ ячейки — 12px');

// 12. Внутренние блоки прижаты: карточка сферы без min-height и с узким
// порогом колонки, иначе на 7 колонках bento в ряд влезают две карточки.
assert.ok(!/\.rel-card\s*\{[^}]*min-height:\s*(1[0-9]{2,}|[2-9][0-9]{2,})px/.test(css),
  'У карточки сферы не должно быть искусственной высоты');
assert.ok(/\.rel-grid\s*\{[^}]*minmax\(200px, 1fr\)/.test(css),
  'Порог колонки каталога — 200px, иначе в ряд влезают две карточки');

function extractFunction(name) {
  const start = moduleSource.indexOf('function ' + name + '(');
  assert.ok(start > -1, 'Функция ' + name + ' должна существовать');
  let depth = 0;
  for (let i = moduleSource.indexOf('{', start); i < moduleSource.length; i += 1) {
    if (moduleSource[i] === '{') depth += 1;
    if (moduleSource[i] === '}') {
      depth -= 1;
      if (depth === 0) return moduleSource.slice(start, i + 1);
    }
  }
  throw new Error('Не удалось разобрать тело ' + name);
}

function catalogMarkupSource() { return extractFunction('catalogMarkup'); }
function sphereMarkupSource() { return extractFunction('sphereMarkup'); }

console.log('OK  религионизмы: bento 7+5, мобильный закон, ink-ячейка одна, возврат в тулбаре, плотная раскладка, 9 компонентов у ' + spheres.length + ' сфер');

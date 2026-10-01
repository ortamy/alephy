'use strict';

// Тесты двух генераторов: артефактов (#artifact-generator) и изменений
// (#change-generator). Запуск: node tests/generators.test.js
//
// Модули — IIFE поверх window, поэтому грузим их в песочнице с минимумом
// DOM и проверяем чистые функции (diff, Markdown) плюс регистрацию
// маршрутов в источниках правды.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..');

function loadChangeGenerator() {
  const sandbox = { window: {}, document: {}, navigator: {} };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox;
  const code = fs.readFileSync(path.join(APP, 'js', 'change-generator.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.ChangeGenerator;
}

function loadArtifactGenerator() {
  const sandbox = { window: {}, document: {}, navigator: {} };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox;
  const code = fs.readFileSync(path.join(APP, 'js', 'artifact-generator.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.ArtifactGenerator;
}

// ===== Генератор изменений: дифф =====

function testDiffIdentical() {
  const ChangeGenerator = loadChangeGenerator();
  const ops = ChangeGenerator.diffLines(['а', 'б', 'в'], ['а', 'б', 'в']);
  assert.strictEqual(ops.length, 3, 'Три строки на месте');
  assert.ok(ops.every(function(op) { return op.type === 'same'; }), 'Одинаковые строки не считаются различиями');
  console.log('OK  diff: одинаковые тексты без различий');
}

function testDiffAddRemove() {
  const ChangeGenerator = loadChangeGenerator();
  const ops = ChangeGenerator.diffLines(['а', 'б'], ['а', 'в']);
  assert.strictEqual(ops.filter(function(op) { return op.type === 'del'; }).length, 1, 'Одна удалённая строка');
  assert.strictEqual(ops.filter(function(op) { return op.type === 'add'; }).length, 1, 'Одна добавленная строка');
  assert.strictEqual(ops.filter(function(op) { return op.type === 'same'; }).length, 1, 'Одна совпавшая строка');
  console.log('OK  diff: удаление и добавление посчитаны');
}

function testDiffOrderAndPositions() {
  const ChangeGenerator = loadChangeGenerator();
  // Вставка в начало: LCS обязан сдвинуть нумерацию правой версии.
  const ops = ChangeGenerator.diffLines(['б', 'в'], ['а', 'б', 'в']);
  const add = ops.filter(function(op) { return op.type === 'add'; });
  assert.strictEqual(add.length, 1, 'Вставлена ровно одна строка');
  assert.strictEqual(add[0].right, 1, 'Вставка стоит первой в новой версии');
  const same = ops.filter(function(op) { return op.type === 'same'; });
  // Массив пришёл из vm-песочницы, поэтому сравниваем строкой: deepStrictEqual
  // спотыкается о прототипы Array разных realm.
  assert.strictEqual(same.map(function(op) { return op.right; }).join(','), '2,3',
    'Номера правой версии сдвинуты');
  console.log('OK  diff: вставка в начало сдвигает нумерацию');
}

function testDiffEmptySide() {
  const ChangeGenerator = loadChangeGenerator();
  const ops = ChangeGenerator.diffLines(['а', 'б'], []);
  assert.strictEqual(ops.filter(function(op) { return op.type === 'del'; }).length, 2,
    'Пустая новая версия = всё удалено');
  const added = ChangeGenerator.diffLines([], ['а']);
  assert.strictEqual(added.filter(function(op) { return op.type === 'add'; }).length, 1,
    'Пустая исходная версия = всё добавлено');
  console.log('OK  diff: пустая сторона обработана');
}

// ===== Регистрация маршрутов =====

function testRegistration() {
  const registry = fs.readFileSync(path.join(APP, 'js', 'module-registry.js'), 'utf8');
  const controller = fs.readFileSync(path.join(APP, 'js', 'page-controller.js'), 'utf8');
  const search = fs.readFileSync(path.join(APP, 'js', 'lab-search.js'), 'utf8');
  const hero = fs.readFileSync(path.join(APP, 'js', 'lab-hero.js'), 'utf8');
  const index = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

  ['artifact-generator', 'change-generator'].forEach(function(id) {
    assert.ok(registry.includes("id: '" + id + "'"), 'Маршрут в реестре: ' + id);
    assert.ok(controller.includes("case '" + id + "'"), 'Рендерер в PageController: ' + id);
    assert.ok(search.includes("['" + id + "'"), 'Модуль в поиске: ' + id);
    assert.ok(hero.includes("'" + id + "': {"), 'Шапка описана: ' + id);
    assert.ok(index.includes('js/' + id + '.js'), 'Скрипт подключён: ' + id);
    assert.ok(index.includes('css/' + id + '.css'), 'Стили подключены: ' + id);
  });
  console.log('OK  регистрация: реестр, рендерер, поиск, шапка, index.html');
}

function testLocaleKeys() {
  const locale = JSON.parse(fs.readFileSync(
    path.join(APP, '..', '..', 'src', 'locales', 'ru.json'), 'utf8'));
  assert.ok(locale.lab.artifactGenerator, 'Словарь генератора артефактов есть');
  assert.ok(locale.lab.changeGenerator, 'Словарь генератора изменений есть');
  assert.ok(locale.lab.hero['artifact-generator'], 'Шапка артефактов описана');
  assert.ok(locale.lab.hero['change-generator'], 'Шапка изменений описана');
  console.log('OK  локализация: словари и шапки на месте');
}

// ===== Витрина генераторов =====

function testShowcaseCards() {
  const page = fs.readFileSync(path.join(APP, 'pages', 'generators.html'), 'utf8');
  assert.ok(page.includes('href="#artifact-generator"'), 'Карточка артефактов ведёт в модуль');
  assert.ok(page.includes('href="#change-generator"'), 'Карточка изменений ведёт в модуль');
  assert.ok(!page.includes('gc-card--soon'), 'Заглушки «скоро» сняты: оба генератора рабочие');
  console.log('OK  витрина: обе карточки ведут в рабочие модули');
}

testDiffIdentical();
testDiffAddRemove();
testDiffOrderAndPositions();
testDiffEmptySide();
testRegistration();
testLocaleKeys();
testShowcaseCards();

console.log('\nВсе проверки генераторов пройдены.');
'use strict';

// Тест «Древа агентов» (#ai-agents → #agent-tree-view).
// Запуск: node tests/agent-tree.test.js
//
// Модуль — IIFE поверх window/document, поэтому проверяем источник: топология
// TREE обязана покрывать реестр агентов ровно по одному разу, иначе новый агент
// молча не попадёт в дерево или попадёт дважды.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TREE_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', 'agent-tree.js'), 'utf8');
const CONTROLLER_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', 'page-controller.js'), 'utf8');
const MANIFEST_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', 'agent-passport-manifest.js'), 'utf8');
const TREE_CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'agent-tree.css'), 'utf8');

function registrySlugs() {
  const raw = MANIFEST_SOURCE.match(/"id": "([a-z-]+)"/g) || [];
  assert.ok(raw.length, 'В паспортном manifest есть реестр исполняемых агентов');
  return raw.map(function(m) { return m.match(/"id": "([a-z-]+)"/)[1]; });
}

function treeIds() {
  const body = TREE_SOURCE.slice(TREE_SOURCE.indexOf('var TREE = {'), TREE_SOURCE.indexOf('var FEEDBACK'));
  return Array.from(body.matchAll(/id: '([a-z-]+)'/g)).map(function(m) { return m[1]; });
}

function feedbackLinks() {
  const body = TREE_SOURCE.slice(TREE_SOURCE.indexOf('var FEEDBACK'), TREE_SOURCE.indexOf('STATUS_I18N'));
  return Array.from(body.matchAll(/from: '([a-z-]+)', to: '([a-z-]+)'/g)).map(function(m) {
    return { from: m[1], to: m[2] };
  });
}

function testTopologyCoversRegistry() {
  const slugs = registrySlugs();
  const ids = treeIds();
  assert.deepStrictEqual(ids.slice().sort(), slugs.slice().sort(),
    'Дерево покрывает реестр агентов ровно по одному разу');
  assert.strictEqual(new Set(ids).size, ids.length, 'Дублей в TREE нет');
  console.log('OK  топология: ' + ids.length + ' агентов, каждый из реестра и без дублей');
}

function testFeedbackLinks() {
  const ids = treeIds();
  const links = feedbackLinks();
  assert.ok(links.length, 'Обратные связи объявлены');
  links.forEach(function(link) {
    assert.ok(ids.includes(link.from) && ids.includes(link.to),
      'Обратная связь ссылается на известных агентов: ' + link.from + ' → ' + link.to);
    assert.notStrictEqual(link.from, link.to, 'Петли нет: ' + link.from);
  });
  console.log('OK  обратные связи: ' + links.length + ' шт., все между известными агентами');
}

function testBentoCanon() {
  assert.ok(TREE_CSS.includes('grid-template-columns: repeat(12, minmax(0, 1fr));'), 'Сетка — 12 колонок (§5.2a)');
  assert.ok(/\.at-cell--tree \{ grid-column: span 7; \}/.test(TREE_CSS), 'Дерево занимает 7 колонок');
  assert.ok(/\.at-rail \{\s*grid-column: span 5;/.test(TREE_CSS), 'Рельс занимает 5 колонок');
  assert.ok(TREE_CSS.includes('.module .at-cell .at-cell-title'), 'Заголовок ячейки перебивает .module h2');
  assert.ok(/@media \(max-width: 760px\)/.test(TREE_CSS), 'Мобильный закон §5.3: одна колонка');
  assert.ok(TREE_CSS.includes('prefers-reduced-motion'), 'Уважаем prefers-reduced-motion');
  assert.ok(!TREE_CSS.includes('box-shadow: 0'), 'Тени у ячеек не возвращаются (канон §5.2a)');
  console.log('OK  bento: 12 колонок, 7+5, шапка по §4.1, mobile и reduced-motion');
}

function testTreeIsReadOnly() {
  // Дерево только читает: ни SVG-связей, ни drag&drop, ни localStorage-схемы.
  assert.ok(!TREE_SOURCE.includes('createElementNS'), 'Связи не рисуются в SVG');
  assert.ok(!TREE_SOURCE.includes('pointerdown'), 'Узлы не таскаются');
  assert.ok(!TREE_SOURCE.includes('alephy_agent_map_v1'), 'Схема из старой карты не читается');
  assert.ok(TREE_SOURCE.includes('LabRouter.navigate'), 'Узел ведёт на страницу агента');
  assert.ok(TREE_SOURCE.includes('alephy_agent_tree_collapsed_v1'), 'Сохраняется только раскрытость веток');
  console.log('OK  режим: только чтение, узел открывает паспорт агента');
}

function testControllerWiring() {
  assert.ok(CONTROLLER_SOURCE.includes('data-agent-tree-open'), 'Кнопка тулбара открывает дерево');
  assert.ok(CONTROLLER_SOURCE.includes('id="agent-tree-view"'), 'Экран дерева есть в разметке модуля');
  assert.ok(!CONTROLLER_SOURCE.includes('data-agent-map-open'), 'Старая кнопка карты удалена');
  assert.ok(/getIcon: getAgentIcon/.test(CONTROLLER_SOURCE), 'agentsDebug отдаёт иконки для дерева');
  console.log('OK  связка: тулбар → AgentTree, agentsDebug.getIcon');
}

testTopologyCoversRegistry();
testFeedbackLinks();
testBentoCanon();
testTreeIsReadOnly();
testControllerWiring();
console.log('OK  древо агентов: все проверки пройдены');

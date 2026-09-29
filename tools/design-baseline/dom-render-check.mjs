// Ручная проверка: скрипт вне Playwright, только node + минимальный DOM.
// node tools/design-baseline/dom-render-check.mjs
// Проверяет, что рефакторинг innerHTML→DOM API не развалил разметку.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = resolve(ROOT, 'products', 'website');

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attributes: {},
    style: {},
    className: '',
    value: '',
    _text: null,
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener() {},
    scrollIntoView() {},
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    get firstChild() { return this.children[0] ?? null; },
    get textContent() {
      if (this._text !== null) return this._text;
      return this.children.map(c => c.textContent ?? '').join('');
    },
    set textContent(value) { this._text = String(value); this.children = []; },
    get innerHTML() {
      if (this._text !== null) return this._text;
      return this.children.map(c => c.outerHTML ?? '').join('');
    },
    set innerHTML(html) { this._text = String(html); this.children = []; },
    get outerHTML() {
      const attrs = Object.entries(this.attributes).map(([k, v]) => ` ${k}="${v}"`).join('');
      return `<${this.tagName.toLowerCase()}${attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
    },
    get offsetWidth() { return 100; },
  };
  return el;
}

const registry = new Map();
const document = {
  createElement: makeEl,
  createTextNode: (text) => ({
    nodeType: 3,
    textContent: String(text),
    get outerHTML() {
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
  }),
  createDocumentFragment: () => makeEl('fragment'),
  getElementById: (id) => registry.get(id) || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: makeEl('body'),
  documentElement: makeEl('html'),
};

globalThis.window = globalThis;
globalThis.document = document;
globalThis.Option = function Option(text, value, _defaultSelected, selected) {
  const el = makeEl('option');
  el._text = text;
  el.value = value;
  el.selected = Boolean(selected);
  return el;
};

function load(rel) {
  new Function(readFileSync(resolve(WEB, rel), 'utf8'))();
}

const FILES = [
  { path: 'content/md/bashah/chronology/timeline.md', title: 'Хронология', category: 'Хроно', subcategory: 'Хроно', icon: 'clock.png' },
  { path: 'content/md/bashah/chronology/z.json', title: 'Z', category: 'Хроно', subcategory: 'Хроно' },
  { path: 'content/md/x.png" onerror="alert(1)', title: '<script>alert(2)</script>', category: 'A"b', subcategory: 's"1' },
];
const state = { FILES, bookmarks: ['content/md/bashah/chronology/timeline.md'], fileHistory: ['content/md/bashah/chronology/z.json'], currentPath: null, filteredCache: null, fontSize: 'medium' };
globalThis.AlephyState = {
  state,
  loadFromStorage: () => {},
  saveFontSize: () => {},
  addToHistory: () => {},
  isBookmarked: () => false,
  toggleBookmark: () => {},
  history: [],
  bookmarks: state.bookmarks,
};
globalThis.AlephyI18n = { t: (_k, fallback) => fallback };

load('src/js/parser.js');
load('src/js/ui.js');
// ui.js обращается к openFile как к глобалу (app.js вешает его на window).
globalThis.openFile = () => {};

const UI = globalThis.AlephyUI;
const fail = [];
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${extra}`); fail.push(name); }
}

console.log('renderTitle:');
const frag = UI.renderTitle(FILES[0]);
check('иконка — узел img', Boolean(frag.children[0]) && frag.children[0].tagName === 'IMG');
check('имя файла в src', frag.children[0].src === '../../assets/icons/32/clock.png', String(frag.children[0].src));
const badTitle = UI.renderTitle(FILES[2]);
check('title со <script> остаётся текстом', badTitle.textContent.includes('<script>') && !badTitle.outerHTML.includes('<script>'));

console.log('renderBreadcrumbs:');
const crumbs = UI.renderBreadcrumbs(FILES[2].path);
check('вернулся узел, не строка', typeof crumbs === 'object' && crumbs.tagName === 'DIV');
check('кавычки в пути не стали разметкой', !crumbs.outerHTML.includes('onerror'));

console.log('buildSelects:');
for (const id of ['category-select', 'category-select-mobile']) registry.set(id, makeEl('select'));
UI.buildSelects();
const sel = registry.get('category-select');
check('опции через Option API', sel.children.length === 3, String(sel.children.length));
check('категория с кавычкой — текстом', sel.children.some(o => o.textContent.includes('A"b')));

console.log('render / renderBookmarks / renderHistory / buildTOC:');
const UI_IDS = [
  'file-list', 'bookmarks-list', 'history-list', 'toc-list', 'toc-panel', 'progress-bar',
  'search', 'search-mobile', 'category-select', 'category-select-mobile',
  'subcategory-select', 'subcategory-select-mobile', 'copy-toast',
  'bookmarks-section', 'history-section', 'burger-bookmarks-list', 'burger-history-list',
  'burger-menu', 'burger-overlay', 'file-page', 'mobile-list-view', 'stats-mobile', 'total-count',
];
for (const id of UI_IDS) if (!registry.has(id)) registry.set(id, makeEl('div'));
registry.set('search', Object.assign(makeEl('input'), { value: '' }));
registry.set('search-mobile', Object.assign(makeEl('input'), { value: '' }));
UI.render();
UI.renderBookmarks();
UI.renderHistory();
UI.buildTOC('# Заголовок\n\n> цитата');
const listHtml = registry.get('file-list').innerHTML;
check('список отрисован', listHtml.length > 0);
check('инъекция из files.json не попала в разметку', !listHtml.includes('onerror') && !listHtml.includes('<script>'), listHtml.slice(0, 160));

console.log('renderLinks:');
check('без related — null', UI.renderRelated(FILES[0].path) === null);
FILES[0].related = ['content/md/bashah/chronology/z.json', 'x.png" onerror="alert(1)'];
const rel2 = UI.renderRelated(FILES[0].path);
check('вернулся узел', typeof rel2 === 'object' && rel2.tagName === 'DIV');
check('нет inline onclick', !rel2.outerHTML.includes('onclick'), rel2.outerHTML.slice(0, 200));
// Путь с кавычками обязан остаться текстом узла, а не разметкой: проверяем
// атрибуты по дереву (outerHTML здесь экранирует только наш мок).
function attrNames(node, acc = []) {
  for (const [k] of Object.entries(node.attributes || {})) acc.push(k);
  for (const child of node.children || []) attrNames(child, acc);
  return acc;
}
const names = attrNames(rel2);
check('нет атрибутов onerror/onclick', !names.includes('onerror') && !names.includes('onclick'), names.join(','));
check('путь с кавычками в тексте узла', rel2.textContent.includes('x.png" onerror="alert(1)'));

console.log(fail.length ? `\nПРОВАЛ: ${fail.join(', ')}` : '\nвсе проверки прошли');
process.exit(fail.length ? 1 : 0);

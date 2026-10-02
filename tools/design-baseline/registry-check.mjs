// Сверка реестра с фактическим поведением лаборатории:
//   1. каждый panel-модуль обязан иметь case в switch page-controller, каждый
//      markdown — объявленный источник (doc) с ключом, существующим в файле
//      коллекции, и существующим исходником в репозитории (docs);
//   2. сайдбар index.html обязан совпадать с nav-метаданными реестра:
//      порядок модулей и секций, data-i18n-ключи подписей и заголовков;
//   3. каждый markdown обязан попадать в объявленную группу документов,
//      хаб группы — существовать, рендериться и быть достижимым из сайдбара;
//   4. в page-controller не должно остаться своей карты путей документов.
// Запуск: node tools/design-baseline/registry-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LAB = path.join(ROOT, 'products/website/apps/researchlab');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(LAB, 'js/module-registry.js'), 'utf8'), sandbox);
const registry = sandbox.window.ModuleRegistry;

const controller = fs.readFileSync(path.join(LAB, 'js/page-controller.js'), 'utf8');
const cases = new Set([...controller.matchAll(/^\s*case '([^']+)':/gm)].map((m) => m[1]));

const problems = [];

// Своя карта путей документов удалена: источник объявляет реестр. Возврат карты
// или строковый путь в несуществующий каталог analysis/ снова сделают маршруты
// мёртвыми. Смотрим код без комментариев: в комментарии путь уместен как
// объяснение, в коде он означал бы мёртвый маршрут.
const code = controller.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
if (/mdPaths/.test(code)) {
  problems.push('в page-controller снова появилась карта mdPaths — путь документа объявляется только в реестре');
}
if (/['"][^'"]*analysis\//.test(code)) {
  problems.push('в page-controller остался строковый путь в каталог analysis/ — его в репозитории нет');
}

const panels = registry.MODULES.filter((m) => m.kind === 'panel');
const markdown = registry.MODULES.filter((m) => m.kind === 'markdown');

for (const { id } of panels) {
  if (!cases.has(id)) problems.push(`panel без case в page-controller: ${id}`);
}
// Обратная проверка: case без записи в реестре — «забытый» модуль.
for (const id of cases) {
  if (!registry.has(id)) problems.push(`case в page-controller отсутствует в реестре: ${id}`);
}

// Ключи коллекций: файл данных — единственный источник содержимого документов.
// Для коллекции с dir файл указателен (title/description), тело лежит отдельно.
const collectionKeys = {};
for (const [name, meta] of Object.entries(registry.COLLECTIONS)) {
  collectionKeys[name] = meta.file
    ? new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(LAB, meta.file), 'utf8'))))
    : null;
}

const seen = new Set();
for (const { id } of registry.MODULES) {
  if (seen.has(id)) problems.push(`дубль id в реестре: ${id}`);
  seen.add(id);
}

// --- сайдбар: разметка обязана повторять nav-метаданные реестра ---
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const sidebarStart = html.indexOf('class="lab-sidebar"');
const sidebarEnd = html.indexOf('</aside>', sidebarStart);
const sidebar = sidebarStart === -1 || sidebarEnd === -1 ? '' : html.slice(sidebarStart, sidebarEnd);
if (!sidebar) problems.push('в index.html не найден блок .lab-sidebar');

const tokenRe = /data-section="([^"]+)"|<a\s+href="#([^"]+)"[^>]*class="sidebar-item[^"]*"[^>]*data-module="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
const htmlItems = [];
const htmlSections = [];
let section = 'top';
for (const match of sidebar.matchAll(tokenRe)) {
  if (match[1]) {
    section = match[1];
    htmlSections.push(section);
    const headEnd = sidebar.indexOf('</div>', match.index);
    const headHtml = sidebar.slice(match.index, headEnd === -1 ? match.index + 260 : headEnd);
    const i18n = headHtml.match(/data-i18n="([^"]+)"/);
    const expected = registry.sections().find((s) => s.id === section) || {};
    const gotKey = i18n ? i18n[1] : null;
    if (gotKey !== (expected.titleKey || null)) {
      problems.push(`ключ заголовка секции «${section}»: html ${gotKey || '—'}, реестр ${expected.titleKey || '—'}`);
    }
    continue;
  }
  htmlItems.push({ id: match[3], href: match[2], icon: (match[4].match(/data-lucide="([^"]+)"/) || [, null])[1],
    i18n: (match[4].match(/data-i18n="([^"]+)"/) || [, null])[1], section: section });
}

const registryNav = registry.navItems();
const byId = new Map(htmlItems.map((item) => [item.id, item]));
for (const entry of registryNav) {
  const item = byId.get(entry.id);
  if (!item) {
    problems.push(`nav-модуль есть в реестре, но не в сайдбаре: ${entry.id}`);
    continue;
  }
  if (item.section !== entry.nav.section) {
    problems.push(`модуль ${entry.id}: реестр ждёт секцию «${entry.nav.section}», разметка даёт «${item.section || '—'}»`);
  }
  if (item.icon !== entry.nav.icon) {
    problems.push(`модуль ${entry.id}: иконка «${item.icon || '—'}» в разметке ≠ «${entry.nav.icon}» в реестре`);
  }
  if (item.i18n !== `lab.nav.${entry.id}`) {
    problems.push(`модуль ${entry.id}: ключ подписи «${item.i18n || '—'}», ожидался lab.nav.${entry.id}`);
  }
  if (item.href !== entry.id) {
    problems.push(`модуль ${entry.id}: href «#${item.href}» не совпадает с id`);
  }
}
for (const item of htmlItems) {
  if (!registry.get(item.id)) problems.push(`сайдбар ведёт на модуль вне реестра: ${item.id}`);
  else if (!registry.get(item.id).nav) problems.push(`сайдбар ведёт на модуль без nav в реестре: ${item.id}`);
}

const expectedSections = registry.sections().filter((s) => s.id !== 'top').map((s) => s.id);
if (htmlSections.join(',') !== expectedSections.join(',')) {
  problems.push(`секции сайдбара: html ${htmlSections.join(', ')} ≠ реестр ${expectedSections.join(', ')}`);
}

// --- группы документов: префикс, источник, хаб ---
const docGroups = {};
const docStats = { withData: 0, unported: 0 };
const unported = [];
for (const { id } of markdown) {
  const group = registry.docGroup(id);
  if (!group) {
    problems.push(`документ без объявленной группы (DOC_GROUPS): ${id}`);
    continue;
  }
  docGroups[group] = (docGroups[group] || 0) + 1;

  const source = registry.docSource(id);
  if (!source) {
    problems.push(`документ без источника (doc) в реестре: ${id}`);
    continue;
  }
  // Файл исходника в репозитории: провенанс проверяем, когда он объявлен.
  if (source.docs && !fs.existsSync(path.join(ROOT, source.docs))) {
    problems.push(`исходник документа не найден в репозитории: ${source.docs} (${id})`);
  }
  if (!source.collection) {
    // Источник есть, переноса в data/ ещё нет — это состояние, а не ошибка.
    if (!source.docs) problems.push(`неперенесённый документ без пути к исходнику (docs): ${id}`);
    docStats.unported++;
    unported.push(group);
    continue;
  }
  if (!(source.collection in collectionKeys)) {
    problems.push(`коллекция не объявлена в COLLECTIONS: ${source.collection} (${id})`);
    continue;
  }
  if (!collectionKeys[source.collection].has(source.key)) {
    problems.push(`ключа «${source.key}» нет в файле коллекции ${source.collection} (${id})`);
    continue;
  }
  if (source.doc && !fs.existsSync(path.join(LAB, source.doc))) {
    problems.push(`тело документа не найдено: ${source.doc} (${id})`);
    continue;
  }
  docStats.withData++;
}
// Полнота корпуса: каждый .md раздела docs/06-METHODOLOGY обязан быть либо
// маршрутом реестра, либо служебным файлом из списка ниже. Молчаливо
// забытый файл — это документ, до которого нельзя дойти ни с одного хаба.
const METHOD_DIR = 'docs/06-METHODOLOGY';
const METHOD_SERVICE = ['README.md', 'TEMPLATE.md'];
const methodSources = new Set(
  markdown.map(({ id }) => (registry.docSource(id) || {}).docs).filter(Boolean).map((p) => path.basename(p))
);
if (fs.existsSync(path.join(ROOT, METHOD_DIR))) {
  for (const file of fs.readdirSync(path.join(ROOT, METHOD_DIR)).sort()) {
    if (!file.endsWith('.md') || METHOD_SERVICE.includes(file)) continue;
    if (!methodSources.has(file)) problems.push(`методичка не объявлена в реестре: ${METHOD_DIR}/${file}`);
  }
}
for (const group of registry.DOC_GROUPS) {
  const hub = registry.get(group.hub);
  if (!hub) {
    problems.push(`хаб группы «${group.id}» отсутствует в реестре: ${group.hub}`);
    continue;
  }
  if (!hub.nav) problems.push(`хаб группы «${group.id}» недостижим из сайдбара: ${group.hub}`);
  if (hub.kind !== 'panel' || !cases.has(group.hub)) {
    problems.push(`хаб группы «${group.id}» не рендерится в page-controller: ${group.hub}`);
  }
  // Достижимость документов: без записи в GROUP_INDEX_HUBS и без вызова
  // render/mountCollectionIndex группа остаётся списком только по прямому адресу.
  if (group.index) {
    const hubMap = controller.match(/var GROUP_INDEX_HUBS = \{[\s\S]*?\n  \};/);
    if (!hubMap) problems.push('в page-controller нет карты хабов GROUP_INDEX_HUBS');
    else if (!new RegExp(`\\n\\s{4}${group.id}: \\{`).test(hubMap[0])) {
      problems.push(`группа «${group.id}» не объявлена в GROUP_INDEX_HUBS — её документы недостижимы из хаба`);
    }
    if (!new RegExp(`(render|mount)CollectionIndex\\([^)]*'${group.id}'`).test(controller)) {
      problems.push(`список группы «${group.id}» не монтируется в page-controller`);
    }
  }
}

// --- палитра поиска больше не держит свой список модулей ---
const search = fs.readFileSync(path.join(LAB, 'js/lab-search.js'), 'utf8');
if (/var MODULES = \[/.test(search)) problems.push('lab-search.js снова завёл свой список модулей (MODULES)');
if (!/moduleEntries\(/.test(search)) problems.push('lab-search.js не берёт модули из сайдбара (moduleEntries)');
// Палитра обязана находить документы корпуса: список коллекций берётся из
// реестра, а не пишется руками. Иначе 62 маршрута видны только по прямому адресу.
if (!/documentItems\(/.test(search)) {
  problems.push('lab-search.js не индексирует документы корпуса (documentItems)');
}

console.log(`реестр: ${panels.length} panel + ${markdown.length} markdown = ${registry.MODULES.length}`);
console.log(`page-controller: ${cases.size} case (карта путей документов удалена)`);
console.log(`сайдбар: ${registryNav.length} модулей в ${registry.sections().length} секциях (top + ${htmlSections.length} с заголовком, ${htmlItems.length} ссылок в разметке)`);
console.log(`документы: ${docStats.withData} с данными, ${docStats.unported} без переноса (${Object.entries(docGroups).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
if (problems.length) {
  console.log('РАСХОЖДЕНИЯ:');
  for (const problem of problems) console.log('  - ' + problem);
  process.exit(1);
}
console.log('реестр согласован с page-controller, сайдбаром и группами документов');

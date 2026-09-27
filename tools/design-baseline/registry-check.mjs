// Сверка реестра с фактическим поведением лаборатории: каждый panel-модуль
// обязан иметь case в switch page-controller, каждый markdown — запись в mdPaths.
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
const mdBlock = controller.slice(controller.indexOf('var mdPaths = {'));
const mdPaths = new Set([...mdBlock.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]));

const problems = [];
const panels = registry.MODULES.filter((m) => m.kind === 'panel');
const markdown = registry.MODULES.filter((m) => m.kind === 'markdown');

for (const { id } of panels) {
  if (!cases.has(id)) problems.push(`panel без case в page-controller: ${id}`);
}
for (const { id } of markdown) {
  if (!mdPaths.has(id)) problems.push(`markdown без пути в mdPaths: ${id}`);
}
// Обратная проверка: case без записи в реестре — «забытый» модуль.
for (const id of cases) {
  if (!registry.has(id)) problems.push(`case в page-controller отсутствует в реестре: ${id}`);
}
for (const id of mdPaths) {
  if (!registry.has(id)) problems.push(`путь в mdPaths отсутствует в реестре: ${id}`);
}

const seen = new Set();
for (const { id } of registry.MODULES) {
  if (seen.has(id)) problems.push(`дубль id в реестре: ${id}`);
  seen.add(id);
}

console.log(`реестр: ${panels.length} panel + ${markdown.length} markdown = ${registry.MODULES.length}`);
console.log(`page-controller: ${cases.size} case, mdPaths: ${mdPaths.size}`);
if (problems.length) {
  console.log('РАСХОЖДЕНИЯ:');
  for (const problem of problems) console.log('  - ' + problem);
  process.exit(1);
}
console.log('реестр согласован с page-controller');

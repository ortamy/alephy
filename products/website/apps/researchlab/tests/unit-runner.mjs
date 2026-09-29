// unit-runner.mjs — прогон node-юнит-тестов лаборатории одним процессом-раннером.
//
// Файлы tests/*.test.js — обычные node-скрипты: они пишут assert и выставляют
// process.exitCode. Раннер нужен, чтобы `npm run test:unit` и шаг CI падали на
// провале любого файла, а не «зеленели» от того, что последним оказался удачный.
//
// Запуск:
//   node tests/unit-runner.mjs            # все файлы tests/*.test.js
//   node tests/unit-runner.mjs dashboard  # только совпадающие с фильтром
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = dirname(TESTS_DIR);
const filter = process.argv[2] || '';

const files = readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith('.test.js'))
  .filter((name) => name.includes(filter))
  .sort();

if (files.length === 0) {
  console.error('unit-runner: в tests/ нет файлов *.test.js' + (filter ? ` по фильтру «${filter}»` : ''));
  process.exit(1);
}

const failed = [];
for (const name of files) {
  const started = Date.now();
  // cwd — корень приложения: так тесты видят те же относительные данные, что и при ручном запуске.
  const run = spawnSync(process.execPath, [join(TESTS_DIR, name)], { stdio: 'inherit', cwd: APP_DIR });
  const took = Date.now() - started;
  if (run.status === 0) {
    console.log(`[ok] ${name} (${took} мс)`);
  } else {
    failed.push(name);
    console.error(`[FAIL] ${name} (${took} мс, код ${run.status})`);
  }
}

console.log(`— unit: ${files.length - failed.length}/${files.length} прошло —`);
if (failed.length > 0) {
  console.error('Провалились: ' + failed.join(', '));
  process.exit(1);
}

/* wb-smoke.cjs — живая проверка «Мастерской» (#workbench) в headless Chrome.
   Запуск: node tools/design-baseline/wb-smoke.cjs */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Путь к приложению берём от расположения репозитория, а не от машины:
// хардкод ломал прогон после переноса/клонирования.
const APP = path.resolve(process.cwd(), 'products/website/apps/researchlab/index.html');
const URL = pathToFileURL(APP).href;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', function (e) { errors.push(String(e)); });

async function open(hash) {
  await page.goto(URL + '#' + hash, { waitUntil: 'load' });
  await page.waitForTimeout(600);
}

// 1. Хаб (bento 12/7/5: список проектов + рельс «продолжить/сводка»)
await open('workbench');
await page.waitForSelector('.wb-cell--projects', { timeout: 8000 });
const cells = await page.locator('#workbench .wb-cell').count();
if (cells < 3) throw new Error('Ячеек бенто: ' + cells + ', ожидалось минимум 3');
const heroTitle = await page.locator('#workbench .lab-hero__title').first().textContent();
if (!/Мастерская/.test(heroTitle)) throw new Error('Шапка хаба: ' + heroTitle);
const crumb = await page.locator('#workbench .lab-hero__kicker').first().textContent();
if (!/АЛЕФИ/.test(crumb)) throw new Error('Крошки хаба: ' + crumb);
const empty = await page.locator('#workbench').textContent();
if (!/Проектов пока нет/.test(empty)) throw new Error('Пустое состояние списка не показано');
// Чипы фильтра и счётчик в тулбаре: стили .wb-chip живут в workbench-bento.css,
// незакрытый комментарий там раньше гасил весь блок — проверяем вычисленные стили.
const chip = page.locator('#workbench .wb-chip').first();
if (await chip.count() !== 1) throw new Error('Чипы фильтра не отрисованы');
const chipRadius = await chip.evaluate(function (el) { return getComputedStyle(el).borderRadius; });
if (!/999|pill|50%/.test(chipRadius)) throw new Error('Чип фильтра без скругления: ' + chipRadius);
// Точка статуса должна быть одна: .wb-badge-dot гасит псевдо-точку redesign.css.
// Проект засеиваем в localStorage, иначе в пустом хабе бейджа нет.
await page.evaluate(function () {
  localStorage.setItem('alephy.workbench.projects', JSON.stringify([{
    runId: 'smoke-done', name: 'BookofEpoch.pdf', pipelineId: 'book-translation',
    status: 'done', createdAt: Date.now(), updatedAt: Date.now(), input: { name: 'BookofEpoch.pdf' }
  }]));
});
await open('workbench');
// Тот же hash не перерисовывает модуль (в роутере кеш маршрута), поэтому
// перезагружаем страницу, а не повторно гоним на #workbench.
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(600);
await page.waitForSelector('#workbench .wb-badge-dot', { timeout: 8000 });
const dot = await page.locator('#workbench .wb-badge-dot').count();
const dotPseudo = await page.evaluate(function () {
  var badge = document.querySelector('#workbench .wb-badge');
  var style = getComputedStyle(badge, '::before');
  return style.display + '|' + style.content;
});
if (dot !== 1 || dotPseudo.split('|')[0] !== 'none') {
  throw new Error('Две точки в статусе: dot=' + dot + ' ::before=' + dotPseudo);
}
// Готовый проект: полоса прогресса скрыта, статус и 100% не дублируются.
const barHidden = await page.locator('#workbench .wb-miniprogress').first().isHidden();
if (!barHidden) throw new Error('Полоса прогресса у готового проекта не скрыта');
console.log('OK  #workbench: бенто-ячейки, шапка «Мастерская», крошки, пустое состояние, чипы-фильтры, одна точка статуса');
await page.evaluate(function () { localStorage.removeItem('alephy.workbench.projects'); });

// 2. Экран запуска book-translation
await open('workbench/run/book-translation');
await page.waitForSelector('#wb-run-form', { timeout: 8000 });
const fileInputs = await page.locator('#wb-run-form input[type=file]').count();
const selects = await page.locator('#wb-run-form select').count();
const toggles = await page.locator('#wb-run-form .wb-toggle input').count();
if (fileInputs !== 1 || selects !== 2 || toggles !== 2) throw new Error('Форма: file=' + fileInputs + ' select=' + selects + ' toggle=' + toggles);
const estimateBtn = await page.locator('#wb-estimate-btn').textContent();
const startBtn = await page.locator('#wb-start-btn').textContent();
if (!/Оценить/.test(estimateBtn) || !/Старт/.test(startBtn)) throw new Error('Кнопки сметы отсутствуют');
const runTitle = await page.locator('#workbench .lab-hero__title').first().textContent();
if (!/Перевод книги/.test(runTitle)) throw new Error('Шапка запуска: ' + runTitle);
console.log('OK  #workbench/run/book-translation: форма из конфига (файл, 2 селекта, 2 тумблера), [Оценить][Старт], шапка из реестра');

// 3. Смета по вставленному тексту (вход text отсутствует у этого конвейера — проверяем пустую смету и валидацию)
await page.locator('#wb-estimate-btn').click();
const estimateText = await page.locator('#wb-estimate-body').textContent();
if (!/смета нулевая/.test(estimateText) && !/знаков/.test(estimateText)) throw new Error('Смета не отрисовалась: ' + estimateText);
await page.locator('#wb-start-btn').click();
const formStatus = await page.locator('#wb-form-status').textContent();
if (!/Заполните вход/.test(formStatus)) throw new Error('Валидация не сработала: ' + formStatus);
console.log('OK  смета и валидация входа работают');

// 4. Проект: несуществующий runId → аккуратный empty-state
await open('workbench/project/no-such-run');
await page.waitForTimeout(400);
const projectText = await page.locator('#workbench').textContent();
if (!/Проект не найден/.test(projectText)) throw new Error('Empty-state проекта не показан');
console.log('OK  #workbench/project/<нет>: аккуратный empty-state');

// 5. Другие конвейеры: свои формы
await open('workbench/run/exposure-check');
await page.waitForSelector('#wb-run-form', { timeout: 8000 });
const ta = await page.locator('#wb-run-form textarea').count();
if (ta !== 1) throw new Error('exposure-check: нет textarea');
await open('workbench/run/root-assembly');
await page.waitForSelector('#wb-run-form', { timeout: 8000 });
const wordInput = await page.locator('#wb-run-form input[type=text]').count();
if (wordInput !== 1) throw new Error('root-assembly: нет поля слова');
console.log('OK  exposure-check и root-assembly открывают свои формы');

if (errors.length) {
  console.error('JS-ОШИБКИ НА СТРАНИЦЕ:', errors);
  process.exit(1);
}
await browser.close();
console.log('SMOKE ПРОЙДЕН');

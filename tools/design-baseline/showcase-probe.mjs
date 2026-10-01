/* showcase-probe.mjs — тулбар витрин «Генераторы» / «Чекеры» /
   «Анализаторы» в headless Chrome: панель, поиск, счётчик,
   переключатель вида и отсутствие горизонтального переполнения. */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const APP = path.resolve(process.cwd(), 'products/website/apps/researchlab/index.html');
const URL = pathToFileURL(APP).href;

const MODULES = [
  { hash: 'generators', grid: '.gc-grid' },
  { hash: 'checkers', grid: '.gc-grid' },
  { hash: 'analyzers', grid: '.analyzers-grid' }
];

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

for (const mod of MODULES) {
  await page.goto(URL + '#' + mod.hash, { waitUntil: 'load' });
  // Селекторы привязаны к контейнеру модуля: контейнеры соседних
  // витрин остаются в DOM скрытыми, и глобальный .gc-grid находит
  // чужую (невидимую) сетку первой.
  const scope = '#' + mod.hash;
  await page.waitForSelector(scope + ' ' + mod.grid, { timeout: 8000 });
  const panel = page.locator(scope + ' .gc-controls-panel');
  await panel.waitFor({ timeout: 5000 });

  // Ожидаемое число карточек берём из самой витрины, а не константой:
  // проверка не должна расходиться с источником при правке каталога.
  const total = await page.locator('#' + mod.hash + ' .gc-card').count();
  if (total < 2) throw new Error(`${mod.hash}: витрина пуста (${total} карточек)`);

  const count = await page.locator('#' + mod.hash + ' [data-showcase-count]').textContent();
  if (count.trim().replace(/\s+/g, ' ') !== total + ' из ' + total) {
    throw new Error(`${mod.hash}: счётчик «${count}», ожидалось «${total} из ${total}»`);
  }

  // Поиск: гасим несовпавшие карточки и двигаем счётчик. Запрос берём из
  // витрины, а не из словаря модуля: в генераторах все карточки начинаются
  // с «Генератор», и такой запрос не отфильтровал бы ничего. Берём слово,
  // встречающееся ровно в одной карточке.
  const probeWord = await page.locator('#' + mod.hash + ' .gc-card').evaluateAll(function (cards) {
    var seen = {};
    cards.forEach(function (card) {
      (card.dataset.showcaseHaystack || '').split(/[^a-zа-яё\d]+/).forEach(function (word) {
        if (word.length < 5) return;
        seen[word] = (seen[word] || 0) + 1;
      });
    });
    var words = Object.keys(seen).filter(function (word) { return seen[word] === 1; });
    return words[0] || '';
  });
  if (!probeWord) throw new Error(`${mod.hash}: не нашлось уникального слова для проверки поиска`);
  await page.locator('#' + mod.hash + ' [data-showcase-search]').fill(probeWord);
  await page.waitForTimeout(120);
  const filtered = await page.locator('#' + mod.hash + ' .gc-card:not(.is-filtered-out)').count();
  if (filtered !== 1) {
    throw new Error(`${mod.hash}: поиск по «${probeWord}» дал ${filtered} карточек из ${total}, ожидалась 1`);
  }
  const count2 = await page.locator('#' + mod.hash + ' [data-showcase-count]').textContent();
  if (count2.indexOf(String(filtered)) === -1) {
    throw new Error(`${mod.hash}: счётчик не следует за фильтром: «${count2}» при ${filtered}`);
  }

  // Пустое состояние на заведомо отсутствующем запросе.
  await page.locator('#' + mod.hash + ' [data-showcase-search]').fill('щщщ-нетакого');
  await page.waitForTimeout(120);
  if (await page.locator('#' + mod.hash + ' [data-showcase-empty]').isHidden()) {
    throw new Error(`${mod.hash}: пустое состояние не показано`);
  }

  await page.locator('#' + mod.hash + ' [data-showcase-search]').fill('');
  await page.waitForTimeout(120);

  // Переключатель вида: та же разметка становится строкой.
  const grid = page.locator('#' + mod.hash + ' ' + mod.grid);
  await page.locator('#' + mod.hash + ' [data-showcase-view="list"]').click();
  await page.waitForTimeout(150);
  if (!(await grid.evaluate((el) => el.classList.contains('is-list')))) {
    throw new Error(`${mod.hash}: режим списка не включился`);
  }
  const rowHeight = await page.locator('#' + mod.hash + ' .gc-card').first().evaluate((el) => el.getBoundingClientRect().height);
  if (rowHeight < 40 || rowHeight > 90) {
    throw new Error(`${mod.hash}: высота строки списка ${Math.round(rowHeight)}px, ожидалось ~56px`);
  }
  // Выбор вида переживает перезаход в модуль (localStorage).
  await page.goto(URL + '#' + mod.hash, { waitUntil: 'load' });
  await page.waitForSelector(scope + ' ' + mod.grid, { timeout: 8000 });
  await page.waitForTimeout(400);
  if (!(await page.locator('#' + mod.hash + ' ' + mod.grid).evaluate((el) => el.classList.contains('is-list')))) {
    throw new Error(`${mod.hash}: вид «список» не восстановился после перезахода`);
  }
  await page.locator('#' + mod.hash + ' [data-showcase-view="cards"]').click();
  await page.waitForTimeout(150);

  // Панель не должна ронять горизонтальный скролл страницы.
  for (const width of [1440, 900, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${mod.hash}: горизонтальное переполнение ${overflow}px на ширине ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log(`OK  #${mod.hash}: тулбар, поиск, счётчик, пустое состояние, оба вида, без переполнения`);
}

if (errors.length) {
  console.error('JS-ОШИБКИ НА СТРАНИЦЕ:', errors);
  process.exit(1);
}
await browser.close();
console.log('PROBE ПРОЙДЕН');

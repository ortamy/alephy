/* Верификация реестра AI-агентов: высота карточек/списка, фильтр «Заглушка», скрины.
   Запуск: node tasks/ai-agents-registry/verify-agents.js (нужен http-сервер на 4173). */
const fs = require('node:fs');
const path = require('node:path');
// Скрипт живёт в tasks/, playwright установлен в researchlab/node_modules.
const { chromium } = require(path.join(__dirname, '..', '..', 'products', 'website', 'apps', 'researchlab', 'node_modules', 'playwright'));

const BASE = 'http://127.0.0.1:4173';
const OUT = __dirname;

async function measure(page, view) {
  if (view === 'list') {
    await page.click('[data-agents-view="list"]');
    await page.waitForSelector('.agent-list-row');
  } else {
    await page.click('[data-agents-view="cards"]');
    await page.waitForSelector('.agent-role-card');
  }
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll('#ai-agents .agent-group'));
    const top = groups[0].getBoundingClientRect().top + window.scrollY;
    const bottom = Math.max(...groups.map((g) => g.getBoundingClientRect().bottom + window.scrollY));
    const moduleHeight = document.getElementById('ai-agents').getBoundingClientRect().height;
    return {
      groups: groups.length,
      items: document.querySelectorAll('#ai-agents .agent-list-card').length,
      groupsHeight: Math.round(bottom - top),
      moduleHeight: Math.round(moduleHeight),
      viewport: window.innerHeight
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push('console: ' + m.text());
  });

  await page.goto(BASE + '/#ai-agents', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.agent-role-card');
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });

  const cards = await measure(page, 'cards');
  const layout = await page.evaluate(() => {
    const body = document.querySelector('#ai-agents .agent-group-body');
    return {
      groupWidth: Math.round(body.getBoundingClientRect().width),
      columns: getComputedStyle(body).gridTemplateColumns.split(' ').length,
      cardWidth: Math.round(document.querySelector('.agent-role-card').getBoundingClientRect().width)
    };
  });
  await page.screenshot({ path: path.join(OUT, 'agents-desktop-cards.png') });

  const list = await measure(page, 'list');
  await page.screenshot({ path: path.join(OUT, 'agents-desktop-list.png') });

  // Фильтр «Заглушка»: только заглушки (без модели).
  await page.click('[data-agent-status="stub"]');
  await page.waitForTimeout(200);
  const stub = await page.evaluate(() => ({
    count: document.querySelectorAll('#ai-agents .agent-list-card').length,
    statuses: Array.from(document.querySelectorAll('#ai-agents .agent-list-row .agent-status-label')).map((n) => n.textContent),
    models: Array.from(document.querySelectorAll('#ai-agents .agent-model-chip')).map((n) => n.textContent),
    countLabel: document.querySelector('[data-agents-count]').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'agents-desktop-list-stub.png') });

  // Группы и порядок.
  await page.click('[data-agent-status="all"]');
  await page.waitForTimeout(150);
  const labels = await page.$$eval('#ai-agents .agent-group-label', (els) => els.map((e) => e.textContent));

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(BASE + '/#ai-agents', { waitUntil: 'domcontentloaded' });
  await mobile.waitForSelector('#ai-agents .agent-list-card');
  if (await mobile.locator('#ai-agents .agent-list-row').count()) await mobile.click('[data-agents-view="cards"]');
  await mobile.waitForSelector('.agent-role-card');
  await mobile.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
  const mobileMetrics = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    columns: getComputedStyle(document.querySelector('.agent-group-body')).gridTemplateColumns,
    containerLeft: Math.round(document.querySelector('.agent-controls-panel').getBoundingClientRect().left),
    cardLeft: Math.round(document.querySelector('.agent-role-card').getBoundingClientRect().left)
  }));
  await mobile.screenshot({ path: path.join(OUT, 'agents-mobile-cards.png') });

  console.log(JSON.stringify({ cards, layout, list, stub, labels, mobileMetrics, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})();

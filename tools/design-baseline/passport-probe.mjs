/* Проба паспорта фронтенд-разработчика: заполненные ячейки, прогон задачи
   через UI и мобильный закон §5.3.
   Требует поднятых сервисов:
     python products/agents/server.py
     cd products/website/apps/researchlab && python -m http.server 8931
   Запуск: node tools/design-baseline/passport-probe.mjs */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8931/index.html';

// Системный Chrome: playwright-download в этой среде не установлен.
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

await page.goto(BASE + '#ai-agents', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.agent-role-card');
await page.click('[data-agent-id="frontend-developer"]');
await page.waitForSelector('.ap-bento', { timeout: 10000 });
await page.waitForTimeout(700);

const report = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.ap-cell')].map((cell) => ({
    title: cell.querySelector('.ap-cell-title')?.textContent || '',
    hint: cell.querySelector('.ap-cell-hint')?.textContent || '',
    chars: cell.textContent.trim().length,
  }));
  return {
    toolbarUnderHero: !!document.querySelector('.agent-detail-page > .ap-toolbar'),
    backInToolbar: !!document.querySelector('.ap-toolbar .ap-back'),
    backButtonBelow: !!document.querySelector('.agent-detail-back'),
    searchRows: document.querySelectorAll('[data-ap-searchable], [data-ap-finding]').length,
    counter: document.querySelector('[data-ap-findings-count]')?.textContent || '',
    canonRules: document.querySelectorAll('.ap-canon').length,
    functions: document.querySelectorAll('.ap-fn').length,
    tasks: document.querySelectorAll('.ap-task').length,
    metaLines: document.querySelectorAll('.ap-meta-val').length,
    // Пустоты между блоками: в каждой строке бенто все ячейки должны быть
    // одной высоты — иначе короткая оставляет под собой провал.
    bentoRows: (() => {
      const byTop = new Map();
      document.querySelectorAll('.ap-cell').forEach((cell) => {
        const box = cell.getBoundingClientRect();
        const key = Math.round(box.top);
        byTop.set(key, (byTop.get(key) || []).concat(Math.round(box.height)));
      });
      return [...byTop.values()].map((heights) => ({
        count: heights.length,
        spread: Math.max(...heights) - Math.min(...heights),
      }));
    })(),
    cells,
  };
});

console.log(JSON.stringify(report, null, 2));
console.log('pageerrors:', errors.length ? errors : 'нет');

await page.screenshot({ path: path.join(here, '..', '..', 'tasks', 'frontend-agent-passport', 'passport.png'), fullPage: true });

// Прогон задачи прямо из UI: «Подставить» + «Запустить». Проверяет связку
// паспорт → сервер → аудит → перерисовка ячеек 03 и 04.
// Клики через evaluate: обычный click ждёт геометрию в полной странице
// и упирается в лимит времени прогона.
await page.evaluate(() => {
  document.querySelector('[data-ap-task]').click();
  document.getElementById('agent-run-button').click();
});
await page.waitForFunction(
  () => [...document.querySelectorAll('.ap-cell')].some((c) =>
    c.querySelector('.ap-cell-hint')?.textContent.includes('из 18')),
  { timeout: 15000 },
);
const afterRun = await page.evaluate(() => ({
  auditHint: [...document.querySelectorAll('.ap-cell')].find((c) =>
    c.querySelector('.ap-cell-title')?.textContent.includes('Аудит'))
    ?.querySelector('.ap-cell-hint')?.textContent.trim() || '',
  findings: document.querySelectorAll('[data-ap-finding]').length,
  // Листинг кода обязан пережить перерисовку: ответ агента приносит
  // frontend_source без поля source, и его нельзя терять.
  sourceChars: document.querySelector('.ap-source-code')?.textContent.length || 0,
}));
console.log('afterRun:', JSON.stringify(afterRun));
await page.screenshot({ path: path.join(here, '..', '..', 'tasks', 'frontend-agent-passport', 'passport.png'), fullPage: true });

// Мобильный закон §5.3: одна колонка, ничего не обрезается.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const mobile = await page.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  cellsFullWidth: [...document.querySelectorAll('.ap-cell')]
    .every((c) => c.getBoundingClientRect().width > 280),
}));
console.log('mobile:', JSON.stringify(mobile));
await page.screenshot({ path: path.join(here, '..', '..', 'tasks', 'frontend-agent-passport', 'passport-mobile.png'), fullPage: true });
await browser.close();
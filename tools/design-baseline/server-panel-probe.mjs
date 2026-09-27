/* Проба панели «Запуск сервера» (#agent-server): два состояния API
   (живой сервер / порт молчит), две темы, два вьюпорта; PNG + метрики.
   Запуск: node server-panel-probe.mjs
   Разметка грузится с file://, ответы /api/* подменяются через route. */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync, appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_INDEX = pathToFileURL(
  'c:/Users/DELL/Desktop/alephy/products/website/apps/researchlab/index.html'
).href;
const OUT_ROOT = join('c:/Users/DELL/Desktop/alephy/tasks/server-panel');
const THEMES = ['light', 'dark'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];
const CORS = {
  'access-control-allow-origin': '*',
  'content-type': 'application/json'
};

const INFO = {
  status: 'ok',
  service: 'alephy-agents',
  host: '127.0.0.1',
  port: 5000,
  pid: 48212,
  python: '3.11.9',
  uptime: 384.6
};

async function stub(context, mode) {
  await context.route('**/api/health', (route) => {
    if (mode === 'online') return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ status: 'ok', service: 'alephy-agents' }) });
    return route.fulfill({ status: 502, headers: CORS, body: '{"error":"offline"}' });
  });
  await context.route('**/api/info', (route) =>
    route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(INFO) })
  );
}

mkdirSync(OUT_ROOT, { recursive: true });
const logFile = join(OUT_ROOT, 'probe.log');
if (!existsSync(logFile)) appendFileSync(logFile, `# server-panel probe @ ${new Date().toISOString()}\n`);
const log = (message) => { console.log(message); appendFileSync(logFile, message + '\n'); };

const report = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

/* Проверка нового функционала: предпросмотр, сохранение, скачивание .bat и
   распознавание чужого сервиса на занятом порту. */
async function interactions(instance) {
  const context = await instance.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });
  await context.addInitScript(() => {
    try { localStorage.setItem('alephy_theme', 'light'); } catch (_) {}
  });
  await stub(context, 'online');
  const page = await context.newPage();
  await page.goto(`${APP_INDEX}#agent-server`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  await page.fill('input[name="host"]', '0.0.0.0');
  const preview = await page.evaluate(() => ({
    command: document.querySelector('[data-agent-server-command]').textContent,
    endpoint: document.querySelector('[data-agent-server-endpoint]').textContent,
    save: document.querySelector('[data-agent-server-save]').textContent,
    stored: JSON.parse(localStorage.getItem('alephy_agent_server_v2') || '{}').host
  }));
  log('[check] preview ' + JSON.stringify(preview));

  await page.click('button[type="submit"]');
  const saved = await page.evaluate(() => ({
    save: document.querySelector('[data-agent-server-save]').textContent,
    stored: JSON.parse(localStorage.getItem('alephy_agent_server_v2') || '{}').host
  }));
  log('[check] save ' + JSON.stringify(saved));

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-agent-server-start-download]')
  ]).then(([item]) => item);
  const bat = readFileSync(await download.path(), 'utf8').split('\r\n');
  log('[check] download ' + download.suggestedFilename() + ' :: ' + bat[4]);

  await context.unroute('**/api/health');
  await context.route('**/api/health', (route) => route.fulfill({
    status: 200,
    headers: CORS,
    body: JSON.stringify({ status: 'ok', service: 'other-app' })
  }));
  await page.click('[data-agent-server-check]');
  await page.waitForTimeout(500);
  const foreign = await page.evaluate(() => ({
    state: document.querySelector('[data-agent-server-status]').dataset.state,
    text: document.querySelector('[data-agent-server-status-text]').textContent,
    openTabindex: document.querySelector('[data-agent-server-open]').getAttribute('tabindex'),
    openHref: document.querySelector('[data-agent-server-open]').getAttribute('href')
  }));
  log('[check] foreign-service ' + JSON.stringify(foreign));

  await page.screenshot({ path: join(OUT_ROOT, 'agent-server-interactions.png'), fullPage: true });
  await context.close();
}

try {
  for (const mode of ['online', 'offline']) {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1
        });
        await context.addInitScript((value) => {
          try { localStorage.setItem('alephy_theme', value); } catch (_) {}
        }, theme);
        await stub(context, mode);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
        await page.goto(`${APP_INDEX}#agent-server`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
        await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });

        const metrics = await page.evaluate(() => {
          const box = (selector) => document.querySelector(selector);
          const height = (selector) => {
            const node = box(selector);
            return node ? Math.round(node.getBoundingClientRect().height) : null;
          };
          /* Сколько визуальных рядов занимает набор узлов: полиш требует ровных
             рядов без «сирот» (карточки и факты живут в один/два ряда). */
          const rows = (selector) => {
            const tops = Array.from(document.querySelectorAll(selector))
              .map((node) => Math.round(node.getBoundingClientRect().top));
            return tops.filter((top, index) => tops.indexOf(top) === index).length;
          };
          const status = box('[data-agent-server-status]');
          const dot = box('#agent-server .as-status-dot');
          const statusText = box('[data-agent-server-status-text]');
          const lineHeight = statusText ? parseFloat(getComputedStyle(statusText).lineHeight) : 0;
          return {
            statusState: status ? status.dataset.state : null,
            contentH: height('#labContent'),
            panelH: height('#agent-server .lab-panel'),
            panels: document.querySelectorAll('#agent-server .lab-panel').length,
            cards: document.querySelectorAll('#agent-server .as-card').length,
            cardRows: rows('#agent-server .as-card'),
            facts: document.querySelectorAll('#agent-server .as-fact').length,
            factRows: rows('#agent-server .as-fact'),
            primary: document.querySelectorAll('#agent-server .lab-btn-primary').length,
            /* Заголовки и описания карточек не должны резаться и переноситься. */
            titleWrapped: Array.from(document.querySelectorAll('#agent-server .as-card-title'))
              .filter((node) => node.getBoundingClientRect().height > 26).length,
            descClipped: Array.from(document.querySelectorAll('#agent-server .as-card-desc'))
              .filter((node) => node.scrollHeight > node.clientHeight + 1).length,
            /* Точка статуса держится первой строки, а не середины абзаца. */
            dotOffset: dot && statusText
              ? Math.round(dot.getBoundingClientRect().top - statusText.getBoundingClientRect().top)
              : null,
            statusLines: statusText && lineHeight
              ? Math.round(statusText.getBoundingClientRect().height / lineHeight)
              : null,
            /* §5.1: в шапке нет растровых метк — только lucide-глиф-чип. */
            rasterIcons: document.querySelectorAll('#agent-server img').length,
            icons: document.querySelectorAll('#agent-server svg.lucide').length,
            shadowed: Array.from(document.querySelectorAll('#agent-server .lab-panel, #agent-server .as-card'))
              .filter((node) => getComputedStyle(node).boxShadow !== 'none').length,
            commandText: (box('[data-agent-server-command]') || {}).textContent || '',
            labHref: (box('[data-agent-server-open]') || {}).getAttribute('href') || '',
            saveText: (box('[data-agent-server-save]') || {}).textContent || '',
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            pageH: Math.round(document.documentElement.scrollHeight)
          };
        });

        const shot = join(OUT_ROOT, `agent-server-${mode}-${theme}-${viewport.name}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        report.push({ mode, theme, viewport: viewport.name, ...metrics, errors: errors.length });
        log(`[${mode}/${theme}/${viewport.name}] state=${metrics.statusState} page=${metrics.pageH} contentH=${metrics.contentH} panelH=${metrics.panelH} panels=${metrics.panels} cards=${metrics.cards}/${metrics.cardRows}row facts=${metrics.facts}/${metrics.factRows}row primary=${metrics.primary} icons=${metrics.icons} raster=${metrics.rasterIcons} shadowed=${metrics.shadowed} wrapped=${metrics.titleWrapped} clipped=${metrics.descClipped} dotOffset=${metrics.dotOffset} statusLines=${metrics.statusLines} overflowX=${metrics.overflowX} errors=${errors.length}`);

        /* Инварианты полиша: 3 панели, ровные ряды, один primary, ничего не режется. */
        const desktop = viewport.name === 'desktop';
        const fails = [];
        if (metrics.panels !== 3) fails.push('panels=' + metrics.panels);
        if (metrics.cards !== 3) fails.push('cards=' + metrics.cards);
        if (metrics.facts !== 4) fails.push('facts=' + metrics.facts);
        if (metrics.primary !== 1) fails.push('primary=' + metrics.primary);
        if (metrics.shadowed !== 0) fails.push('shadowed=' + metrics.shadowed);
        if (metrics.rasterIcons !== 0) fails.push('raster=' + metrics.rasterIcons);
        if (metrics.titleWrapped !== 0) fails.push('titleWrapped=' + metrics.titleWrapped);
        if (metrics.descClipped !== 0) fails.push('descClipped=' + metrics.descClipped);
        if (metrics.overflowX > 0) fails.push('overflowX=' + metrics.overflowX);
        if (metrics.errors) fails.push('errors=' + metrics.errors);
        if (metrics.dotOffset === null || metrics.dotOffset > 12) fails.push('dotOffset=' + metrics.dotOffset);
        if (desktop && metrics.cardRows !== 1) fails.push('cardRows=' + metrics.cardRows);
        if (desktop && metrics.factRows !== 1) fails.push('factRows=' + metrics.factRows);
        if (!desktop && metrics.cardRows !== 3) fails.push('cardRows=' + metrics.cardRows);
        if (fails.length) {
          log(`[FAIL] ${mode}/${theme}/${viewport.name} :: ${fails.join(', ')}`);
          process.exitCode = 1;
        }
        await context.close();
      }
    }
  }
  await interactions(browser);
  writeFileSync(join(OUT_ROOT, 'metrics.json'), JSON.stringify(report, null, 2));
  log('[DONE] ' + OUT_ROOT);
} catch (error) {
  log('[FATAL] ' + error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

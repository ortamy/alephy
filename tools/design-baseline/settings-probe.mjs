// Проверка страницы настроек #admin-settings: bento-сетка, повторный вход
// (страница не должна оставаться пустой), переключение темы и крошек.
// Запуск: node tools/design-baseline/settings-probe.mjs [desktop,mobile,dark]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'products/website/package.json'));
const { chromium } = require('playwright');
const APP = path.join(ROOT, 'products/website/apps/researchlab');
const SHOTS = path.join(ROOT, 'tasks');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(APP, rel);
  if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8124, '127.0.0.1', r));

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const errors = [];
const want = (process.argv[2] || 'desktop').split(',');
const VIEWS = {
  desktop: { n: 'desktop', width: 1280, height: 900 },
  mobile: { n: 'mobile', width: 390, height: 844 },
  dark: { n: 'dark', width: 1280, height: 900, theme: 'dark' }
};

for (const vp of want.map((k) => VIEWS[k]).filter(Boolean)) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('pageerror', (e) => errors.push(`${vp.n} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`${vp.n} console: ${m.text()}`); });
  await page.goto('http://127.0.0.1:8124/index.html#admin-settings', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-settings .up-bento', { timeout: 8000 });
  if (vp.theme) {
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, vp.theme);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const bento = document.querySelector('#admin-settings .up-bento');
    const cell = document.querySelector('#admin-settings .up-cell');
    const cs = cell ? getComputedStyle(cell) : null;
    return {
      cells: Array.from(document.querySelectorAll('#admin-settings .up-cell')).map((c) => c.className.replace(/.*up-cell--/, '')),
      nums: Array.from(document.querySelectorAll('#admin-settings .up-num')).map((n) => n.textContent),
      swatches: document.querySelectorAll('#admin-settings .up-swatch').length,
      activeSwatch: (document.querySelector('#admin-settings .up-swatch.is-active') || {}).dataset,
      segments: document.querySelectorAll('#admin-settings .up-segment').length,
      sum: (document.getElementById('up-cell-summary') ? document.querySelectorAll('#admin-settings [data-sum]').length : 0),
      cellShadow: cs ? cs.boxShadow : null,
      bentoCols: getComputedStyle(bento).gridTemplateColumns.split(' ').length,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      hasUserPreferences: typeof window.UserPreferences
    };
  });

  // Регрессия «страница не открывается»: уход и повторный вход в #settings.
  const revisit = {};
  if (vp.n === 'desktop') {
    await page.click('.sidebar-item[data-module="admin-settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.location.hash = 'vision'; });
    await page.waitForTimeout(400);
    await page.click('.sidebar-item[data-module="admin-settings"]');
    await page.waitForSelector('#admin-settings .up-bento', { timeout: 5000 });
    revisit.cellsAfterReopen = await page.evaluate(() => document.querySelectorAll('#admin-settings .up-cell').length);

    // Переключение темы кликом по образцу должно примениться и попасть в сводку.
    await page.click('#admin-settings .up-swatch[data-value="dark"]');
    await page.waitForTimeout(300);
    revisit.theme = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      pressed: document.querySelector('#admin-settings .up-swatch[data-value="dark"]').getAttribute('aria-pressed'),
      otherPressed: document.querySelector('#admin-settings .up-swatch[data-value="white"]').getAttribute('aria-pressed'),
      summary: (document.querySelector('#admin-settings [data-sum="theme"]') || {}).textContent
    }));
    await page.screenshot({ path: path.join(SHOTS, 'settings-bento-dark-click.png'), fullPage: true });
    await page.click('#admin-settings .up-swatch[data-value="white"]');
    await page.waitForTimeout(200);

    // Переключатель крошек обязан влиять на шапку. Кликаем по label: инпут
    // визуально скрыт под слайдером, иначе Playwright не попадёт в цель.
    const crumbs = async () => page.evaluate(() => ({
      attr: document.documentElement.getAttribute('data-breadcrumbs'),
      kicker: (document.querySelector('.module.active .lab-hero__kicker') || {}).textContent
    }));
    await page.click('#admin-settings .up-toggle');
    await page.waitForTimeout(200);
    revisit.crumbsOff = await crumbs();
    await page.click('#admin-settings .up-toggle');
    await page.waitForTimeout(200);
    revisit.crumbsOn = await crumbs();
  }

  console.log(vp.n, JSON.stringify({ ...info, revisit }, null, 1));
  await page.screenshot({ path: path.join(SHOTS, `settings-bento-${vp.n}.png`), fullPage: true });
  await page.close();
}

await browser.close();
server.close();
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'консольных ошибок нет');
process.exit(errors.length ? 1 : 0);

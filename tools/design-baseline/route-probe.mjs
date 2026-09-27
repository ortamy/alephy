// Диагностика одного маршрута: что реально происходит в панели и в консоли.
// Запуск: node tools/design-baseline/route-probe.mjs cartography
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'products/website/package.json'));
const { chromium } = require('playwright');
const APP = path.join(ROOT, 'products/website/apps/researchlab');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(APP, rel);
  if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8127, '127.0.0.1', r));

const route = process.argv[2] || 'dashboard';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
    errors.push('console: ' + m.text());
  }
});

await page.goto(`http://127.0.0.1:8127/index.html#${route}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const state = await page.evaluate(() => {
  const active = document.querySelector('#labContent .module.active');
  const spinners = Array.from(document.querySelectorAll('#labContent .lab-spinner'))
    .filter((n) => n.getBoundingClientRect().height > 0);
  return {
    activeId: active ? active.id : null,
    children: active ? active.children.length : 0,
    innerHead: active ? active.innerHTML.slice(0, 220) : '',
    text: active ? active.textContent.slice(0, 160) : '',
    visibleSpinners: spinners.length,
    moduleError: active ? active.dataset.moduleError : null,
    loaded: active ? active.dataset.loaded : null,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});

console.log(JSON.stringify({ route, state, errors }, null, 1));
await browser.close();
server.close();

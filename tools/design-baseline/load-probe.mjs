// Замер стартовой стоимости лаборатории: сколько JS/CSS и запросов
// тянется до первого полезного экрана. Запуск: node tools/design-baseline/load-probe.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'products/website/package.json'));
const { chromium } = require('playwright');
const APP = path.join(ROOT, 'products/website/apps/researchlab');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(APP, rel);
  if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8125, '127.0.0.1', r));

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const byType = new Map();
let count = 0;
let bytes = 0;
page.on('response', async (response) => {
  const type = (response.headers()['content-type'] || 'other').split(';')[0];
  const length = Number(response.headers()['content-length'] || 0);
  byType.set(type, (byType.get(type) || 0) + 1);
  bytes += length;
  count += 1;
});

const t0 = Date.now();
await page.goto('http://127.0.0.1:8125/index.html#dashboard', { waitUntil: 'load' });
const loadMs = Date.now() - t0;
await page.waitForSelector('#dashboard-widgets', { timeout: 15000 });
const readyMs = Date.now() - t0;

const metrics = await page.evaluate(() => {
  const paints = performance.getEntriesByType('paint');
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel=stylesheet]'));
  return {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    firstPaint: Math.round((paints.find((p) => p.name === 'first-paint') || {}).startTime || 0),
    firstContentfulPaint: Math.round((paints.find((p) => p.name === 'first-contentful-paint') || {}).startTime || 0),
    scriptCount: scripts.length,
    styleCount: styles.length,
    transferSize: Math.round(nav.transferSize || 0)
  };
});

const rows = [...byType.entries()].sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({
  requests: count,
  bytes_kb: Math.round(bytes / 1024),
  loadEvent_ms: loadMs,
  dashboardReady_ms: readyMs,
  ...metrics,
  byType: Object.fromEntries(rows)
}, null, 1));

await browser.close();
server.close();

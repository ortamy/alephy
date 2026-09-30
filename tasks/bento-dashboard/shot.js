/**
 * tasks/bento-dashboard/shot.js — after-скрины bento-рабочего стола (§8.4 канона).
 * Запуск: из каталога products/website/apps/researchlab при поднятом
 * `python -m http.server 4173`:
 *   node ../../../tasks/bento-dashboard/shot.js
 * Пишет after-desktop.png / after-mobile.png и after-report.json (замеры геометрии).
 */
const path = require('path');
const fs = require('fs');
// Playwright установлен в приложении лаборатории: резолв идёт от каталога скрипта,
// поэтому модуль подключается по явному пути, а не через node_modules вверх по дереву.
const { chromium } = require(path.join(
  __dirname, '..', '..', 'products', 'website', 'apps', 'researchlab', 'node_modules', '@playwright', 'test'
));

const OUT = __dirname;
const BASE = 'http://127.0.0.1:4173';
const VIEWPORTS = [['desktop', 1280, 900], ['mobile', 390, 844]];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const report = {};

  for (const [name, width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    page.on('requestfailed', (r) => failed.push('failed ' + r.url() + ' :: ' + ((r.failure() || {}).errorText || '')));

    await page.goto(BASE + '/index.html#dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.dw-bento .dw-cell', { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `after-${name}.png`), fullPage: true });

    report[name] = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.dw-bento > .dw-cell'));
      const bento = document.querySelector('.dw-bento');
      const shell = document.querySelector('.dashboard-widgets');
      const rounded = (n) => Math.round(n);
      return {
        cells: cells.length,
        order: cells.map((c) => c.className.replace('dw-cell', '').trim()),
        widths: cells.map((c) => rounded(c.getBoundingClientRect().width)),
        tops: cells.map((c) => rounded(c.getBoundingClientRect().top)),
        heads: document.querySelectorAll('.dw-bento .dw-cell-head').length,
        hints: document.querySelectorAll('.dw-bento .dw-cell-hint').length,
        bentoWidth: rounded(bento.getBoundingClientRect().width),
        shellWidth: rounded(shell.getBoundingClientRect().width),
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        docHeight: document.documentElement.scrollHeight,
        legacyLeftovers: document.querySelectorAll('.dw-widget, .dw-summary, .dw-grid').length,
        reviewQueuePresent: /Очередь проверки/.test(document.body.innerHTML),
        shadowedCells: cells.filter((c) => {
          const s = getComputedStyle(c).boxShadow;
          return s && s !== 'none';
        }).length,
        cellRadii: Array.from(new Set(cells.map((c) => getComputedStyle(c).borderRadius))),
        trackHeights: Array.from(new Set(
          Array.from(document.querySelectorAll('.dw-bar-track, .book-card-track, .dw-completeness-track'))
            .map((el) => getComputedStyle(el).height)
        )),
        bookColumns: getComputedStyle(document.querySelector('.book-grid')).gridTemplateColumns.split(' ').length,
        metricColumns: Array.from(new Set(Array.from(document.querySelectorAll('.dw-metric-grid'))
          .map((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length))),
        ticker: (function () {
          const track = document.querySelector('.dw-ticker-track');
          const item = document.querySelector('.dw-ticker-item');
          if (!track || !item) return null;
          return {
            track: rounded(track.getBoundingClientRect().width),
            item: rounded(item.getBoundingClientRect().width)
          };
        })(),
        content: {
          cellTitles: Array.from(document.querySelectorAll('.dw-cell-title')).map((el) => el.textContent.trim()),
          cellHints: Array.from(document.querySelectorAll('.dw-cell-hint')).map((el) => el.textContent.trim()),
          summaryValues: Array.from(document.querySelectorAll('.dw-summary-value')).map((el) => el.textContent.trim()),
          bookCards: document.querySelectorAll('.book-card').length,
          barRows: document.querySelectorAll('.dw-bar-row').length,
          tickerItems: document.querySelectorAll('.dw-ticker-item').length,
          completenessRows: document.querySelectorAll('.dw-completeness-item').length,
          metrics: document.querySelectorAll('.dw-metric').length
        }
      };
    });
    report[name].consoleErrors = errors;
    report[name].failedRequests = Array.from(new Set(failed));
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'after-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

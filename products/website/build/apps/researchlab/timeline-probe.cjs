// Временный диагностический скрипт: таймлайн состояния панели маршрута.
// Запуск: node timeline-probe.cjs <route>
const { chromium } = require('@playwright/test');

const ascii = (text) => String(text).replace(/[^\x20-\x7E]+/g, '.');

(async () => {
  const route = process.argv[2] || 'dashboard';
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(ascii(m.text()).slice(0, 90)); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + ascii(e.message).slice(0, 90)));

  const t0 = Date.now();
  await page.goto('http://127.0.0.1:4173/#' + route, { waitUntil: 'domcontentloaded' });
  const samples = [];
  for (let i = 0; i < 32; i++) {
    const state = await page.evaluate(() => {
      const lab = document.getElementById('labContent');
      const active = lab && lab.querySelector('.module.active');
      return {
        labKids: lab ? lab.children.length : -1,
        actives: Array.from(document.querySelectorAll('.module.active')).map((n) => n.id).join(','),
        kids: active ? active.children.length : -1,
        loaded: active ? (active.dataset.loaded || '-') : '-',
        vis: Array.from(document.querySelectorAll('#labContent .lab-spinner')).filter((n) => n.getBoundingClientRect().height > 0).length,
        head: active ? active.innerHTML.replace(/\s+/g, ' ').slice(0, 70) : ''
      };
    });
    samples.push((Date.now() - t0) + 'ms ' + ascii(JSON.stringify(state)));
    await page.waitForTimeout(250);
  }
  console.log(samples.join('\n'));
  console.log('ERRORS: ' + JSON.stringify(errs));
  await browser.close();
})();

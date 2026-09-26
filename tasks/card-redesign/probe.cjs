// Визуальная проверка редизайна карточек: плоский реестр, hairline-разделители,
// отсутствие теней и hover-подъёма, отсутствие горизонтального overflow.
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8811/apps/researchlab/index.html';
const OUT = 'tasks/card-redesign';

(async () => {
  // Локальный Chrome: Playwright-браузеры в этом окружении не установлены.
  const browser = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const results = [];
  process.on('unhandledRejection', (e) => { console.log('FAIL ' + (e && e.message)); process.exit(1); });

  async function check(name, hash, width, height, theme) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
    page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
    await page.goto(BASE + hash, { waitUntil: 'networkidle' });
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const cards = Array.from(document.querySelectorAll('.methodology-card'));
      const first = cards[0];
      const cs = first ? getComputedStyle(first) : null;
      return {
        overflow,
        cards: cards.length,
        boxShadow: cs ? cs.boxShadow : null,
        borderTop: cs ? cs.borderTopWidth + ' ' + cs.borderTopStyle : null,
        radius: cs ? cs.borderRadius : null,
        index: first ? !!first.querySelector('.methodology-card-index') : null,
        actions: first ? first.querySelectorAll('.methodology-icon-btn').length : 0
      };
    });
    results.push({ name, ...info });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    await page.close();
  }

  await check('methodology-desktop-light', '#methodology', 1440, 1100, 'parchment');
  await check('methodology-dark', '#methodology', 1440, 1100, 'dark');
  await check('methodology-900', '#methodology', 900, 1000, 'parchment');
  await check('methodology-390', '#methodology', 390, 900, 'parchment');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(BASE + '#methodology', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const box = await page.evaluate(() => {
      const panel = document.querySelector('.methodology-panel');
      const pcs = getComputedStyle(panel);
      const cards = Array.from(document.querySelectorAll('.methodology-card')).slice(0, 4);
      return {
        display: pcs.display,
        flexWrap: pcs.wrap,
        alignItems: pcs.alignItems,
        cards: cards.map((c) => {
          const cs = getComputedStyle(c);
          const body = c.querySelector('.methodology-card-body');
          return {
            h: Math.round(c.getBoundingClientRect().height),
            top: Math.round(c.getBoundingClientRect().top),
            basis: cs.flexBasis,
            bodyH: Math.round(body.getBoundingClientRect().height),
            bodyAlign: getComputedStyle(body).alignSelf
          };
        })
      };
    });
    console.log(JSON.stringify(box));
    await page.close();
  }
  await check('glossary-desktop', '#dictionaries/paleo-glossary', 1440, 1000, 'parchment');
  await check('ling-desktop', '#paleo-linguistics', 1440, 1000, 'parchment');

  console.log(JSON.stringify({ results, errors }, null, 2));
  await browser.close();
})();

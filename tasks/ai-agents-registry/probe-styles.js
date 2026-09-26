/* Диагностика вычисленных стилей карточки (коллизии классов). */
const path = require('node:path');
const { chromium } = require(path.join(__dirname, '..', '..', 'products', 'website', 'apps', 'researchlab', 'node_modules', 'playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:4173/#ai-agents', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.agent-role-card');
  const probe = await page.evaluate(() => {
    const card = document.querySelector('.agent-role-card');
    const name = card.querySelector('.agent-card-name');
    const svg = card.querySelector('.agent-icon-chip svg');
    const chip = card.querySelector('.agent-icon-chip');
    const cs = (el) => getComputedStyle(el);
    return {
      nameColor: cs(name).color,
      nameFont: cs(name).fontFamily + ' / ' + cs(name).fontSize,
      nameOpacity: cs(name).opacity,
      chipBox: chip.getBoundingClientRect().width + 'x' + chip.getBoundingClientRect().height,
      svgBox: svg ? svg.getBoundingClientRect().width + 'x' + svg.getBoundingClientRect().height : null,
      svgCss: svg ? cs(svg).width + ' / ' + cs(svg).height : null,
      descColor: cs(card.querySelector('.agent-card-desc')).color
    };
  });
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
})();

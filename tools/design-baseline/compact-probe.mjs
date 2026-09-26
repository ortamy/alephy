/* РџСЂРѕР±Р° СЃР»РѕСЏ РєРѕРјРїР°РєС‚РЅРѕСЃС‚Рё: РјР°СЂС€СЂСѓС‚ Г— С‚РµРјР°, PNG + РјРµС‚СЂРёРєРё РІ stdout.
   Р—Р°РїСѓСЃРє: node compact-probe.mjs <tag> [route ...]  (file://, Р±РµР· HTTP-СЃРµСЂРІРµСЂР°) */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const APP_INDEX = pathToFileURL(
  'c:/Users/DELL/Desktop/alephy/products/website/apps/researchlab/index.html'
).href;

const THEMES = (process.env.PROBE_THEMES || 'light,dark').split(',');
const ROUTES = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['checkers', 'state-checker', 'dashboard', 'manifest', 'root-dictionary'];
const VIEWPORT = { width: 1440, height: 900 };
const TAG = process.argv[2] || 'compact';

const outRoot = join(__dirname, 'baseline', TAG);
mkdirSync(outRoot, { recursive: true });
const logFile = join(outRoot, 'errors.log');
if (!existsSync(logFile)) appendFileSync(logFile, `# compact-probe ${TAG} @ ${new Date().toISOString()}\n`);
const log = (msg) => { console.log(msg); appendFileSync(logFile, msg + '\n'); };

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--allow-file-access-from-files', '--hide-scrollbars']
});

const report = [];
try {
  for (const theme of THEMES) {
    const themeDir = join(outRoot, theme);
    mkdirSync(themeDir, { recursive: true });

    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      await context.route(/^https?:\/\//, (r) => r.abort());
      await context.addInitScript((t) => {
        try { localStorage.setItem('alephy_theme', t); } catch (_) {}
      }, theme);

      const page = await context.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

      try {
        await page.goto(`${APP_INDEX}#${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (e) {
        log(`[WARN] ${theme}/${route}: goto ${e.message.split('\n')[0]}`);
      }
      await page.waitForTimeout(2200);
        // PROBE_CLICK: отправить первую форму, чтобы анализатор отрисовал результат.
        if (process.env.PROBE_CLICK) {
          await page.evaluate(() => {
            const form = document.querySelector('.lab-content form');
            if (form) form.requestSubmit();
          });
          await page.waitForTimeout(600);
        }

      await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
      await page.waitForTimeout(150);

      const metrics = await page.evaluate(() => {
        const pick = (sel) => document.querySelector(sel);
        const box = (el) => (el ? el.getBoundingClientRect() : null);
        const content = pick('.lab-content');
        const hero = pick('.lab-hero, [data-lab-hero]');
        const sidebar = pick('.lab-sidebar');
        const item = pick('.sidebar-item');
        const empty = pick('.lab-empty, .davar-checker-empty');
        const r = (b) => (b ? Math.round(b.height) : null);
        return {
          contentH: r(box(content)),
          contentPad: content ? getComputedStyle(content).padding : null,
          contentBorder: content ? getComputedStyle(content).borderTopWidth : null,
          heroH: r(box(hero)),
          sidebarW: box(sidebar) ? Math.round(box(sidebar).width) : null,
          itemH: r(box(item)),
          itemFont: item ? getComputedStyle(item).fontSize : null,
          emptyH: r(box(empty)),
          bodyFont: getComputedStyle(document.body).fontSize,
          pageH: Math.round(document.documentElement.scrollHeight),
          overflowX: document.documentElement.scrollWidth - window.innerWidth
        };
      });

      const heroInfo2 = await page.evaluate(() => {
        const hero = document.querySelector('.lab-hero, [data-lab-hero]');
        if (!hero) return null;
        const cs = getComputedStyle(hero);
        const kids = [...hero.children].map((k) => ({
          cls: k.className, h: Math.round(k.getBoundingClientRect().height),
          pad: getComputedStyle(k).padding, mar: getComputedStyle(k).margin
        }));
        return { pad: cs.padding, minH: cs.minHeight, h: Math.round(hero.getBoundingClientRect().height), kids };
      });
      console.log('HERO ' + route + ' ' + JSON.stringify(heroInfo2));

      const panelInfo = await page.evaluate(() => {
        const panel = document.querySelector('#trc-form');
        if (!panel) return null;
        return {
          panelH: Math.round(panel.getBoundingClientRect().height),
          kids: [...panel.children].map((k) => ({
            cls: k.className, h: Math.round(k.getBoundingClientRect().height),
            grow: getComputedStyle(k).flexGrow, hidden: k.hidden
          })),
          resultHidden: (document.querySelector('#trc-result') || {}).hidden,
          resultDisplay: document.querySelector('#trc-result')
            ? getComputedStyle(document.querySelector('#trc-result')).display : null
        };
      });
      console.log('PANEL ' + route + ' ' + JSON.stringify(panelInfo));

      const gaps = await page.evaluate(() => {
        const panel = document.querySelector('#trc-form');
        if (!panel) return null;
        const ps = getComputedStyle(panel);
        return {
          display: ps.display, gap: ps.gap, justify: ps.justifyContent,
          align: ps.alignItems, pad: ps.padding, h: Math.round(panel.getBoundingClientRect().height),
          kids: [...panel.children].map((k) => {
            const c = getComputedStyle(k);
            return { cls: k.className, h: Math.round(k.getBoundingClientRect().height),
              mt: c.marginTop, mb: c.marginBottom, flex: c.flex, self: c.alignSelf };
          })
        };
      });
      console.log('GAPS ' + route + ' ' + JSON.stringify(gaps));

      const shot = join(themeDir, `${route}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      report.push({ theme, route, ...metrics, errors: errs.length });
      log(`[OK] ${theme}/${route} contentH=${metrics.contentH} heroH=${metrics.heroH} sidebar=${metrics.sidebarW} item=${metrics.itemH} body=${metrics.bodyFont} overflowX=${metrics.overflowX} errors=${errs.length}`);
      for (const e of errs.slice(0, 5)) log(`    err: ${e.slice(0, 160)}`);
      await context.close();
    }
  }
  writeFileSync(join(outRoot, 'metrics.json'), JSON.stringify(report, null, 2));
  log('[DONE] ' + outRoot);
} catch (e) {
  log(`[FATAL] ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

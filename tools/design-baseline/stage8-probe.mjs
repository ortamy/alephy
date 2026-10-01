/* stage8-probe.mjs — проверка семантического золотого акцента (Этап 8) */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Путь берём от расположения репозитория: хардкод ломал прогон
// после переноса/клонирования.
const APP = resolve(process.cwd(), 'products/website/apps/researchlab');
const CSS_ROOT = join(APP, 'css');
const APP_URL = pathToFileURL(join(APP, 'index.html')).href + '#dashboard';
const THEMES = {
  light: { accent: '#b8860b', rgb: '184 134 11' },
  parchment: { accent: '#8b6508', rgb: '139 101 8' },
  white: { accent: '#8b6508', rgb: '139 101 8' },
  dark: { accent: '#d4a030', rgb: '212 160 48' },
  white: { accent: '#555555', rgb: '85 85 85' }
};

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
  });
}

let pass = 0;
let fail = 0;
function ok(condition, message) {
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${message}`);
  condition ? pass++ : fail++;
}

const rawGold = /#b8860b|rgba\(\s*184\s*,\s*134\s*,\s*11/i;
const invalidCss = cssFiles(CSS_ROOT)
  .filter((path) => !path.endsWith('tokens.css'))
  .flatMap((path) => rawGold.test(readFileSync(path, 'utf8')) ? [path] : []);
ok(invalidCss.length === 0, `raw gold outside tokens.css: ${invalidCss.length}`);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--allow-file-access-from-files', '--no-sandbox']
});

try {
  for (const [theme, expected] of Object.entries(THEMES)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((value) => localStorage.setItem('alephy_theme', value), theme);
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
    const values = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        accent: style.getPropertyValue('--accent-gold').trim(),
        border: style.getPropertyValue('--border-gold').trim(),
        rgb: style.getPropertyValue('--accent-gold-rgb').trim()
      };
    });
    ok(values.accent === expected.accent, `${theme}: accent=${values.accent}`);
    ok(values.border === expected.accent, `${theme}: border=${values.border}`);
    ok(values.rgb === expected.rgb, `${theme}: rgb=${values.rgb}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
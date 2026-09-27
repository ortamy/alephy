// Проверка редизайна #vision: bento-сетка, сегмент режима, dropzone, блок 05.
// Запуск: node tools/design-baseline/vision-probe.mjs [desktop,mobile,dark]
// По умолчанию — desktop (с реальной загрузкой файла); список вьюпортов
// задаётся аргументом, иначе прогон не укладывается в лимит сессии.
// Playwright лежит в products/website/node_modules — резолвим оттуда.
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(APP, rel);
  if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
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
  await page.goto('http://127.0.0.1:8123/index.html#vision', { waitUntil: 'domcontentloaded' });
  if (vp.theme) {
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('alephy_theme', t); }, vp.theme);
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#vision .vi-bento', { timeout: 8000 });
  await page.waitForTimeout(700);
  // Реальная загрузка файла: проверяем превью, метаданные и разблокировку кнопки.
  await page.setInputFiles('#vi-file', path.join(SHOTS, 'vision-bento-desktop.png'));
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('#vision .vi-cell')).map((c) => c.className.replace('vi-cell', '').trim());
    const active = document.querySelector('#vision .vi-segment-btn.is-active');
    const drop = document.getElementById('vi-drop');
    const btn = document.getElementById('vi-analyze-btn');
    const cs = drop ? getComputedStyle(drop) : null;
    return {
      cells,
      activeMode: active ? active.dataset.mode : null,
      pressed: active ? active.getAttribute('aria-pressed') : null,
      note: (document.getElementById('vi-mode-note') || {}).textContent,
      hasVisionUI: typeof window.VisionUI,
      segCount: document.querySelectorAll('#vision .vi-segment-btn').length,
      storedMode: localStorage.getItem('alephy_vision_mode'),
      legend: (() => {
        const ul = document.querySelector('#vision .vi-caps');
        const li = ul && ul.querySelector('.vi-cap');
        if (!ul || !li) return null;
        const us = getComputedStyle(ul);
        const ls = getComputedStyle(li);
        return {
          caps: ul.children.length,
          ulDisplay: us.display, ulCols: us.gridTemplateColumns, ulListStyle: us.listStyleType,
          liDisplay: ls.display, liGap: ls.gap, liIcon: !!li.querySelector('svg'),
          caveat: !!document.querySelector('#vision .vi-caveat svg')
        };
      })(),
      dropBorder: cs ? cs.borderTopColor : null,
      dropShadow: cs ? cs.boxShadow : null,
      btnDisabled: btn ? btn.disabled : null,
      previewShown: getComputedStyle(document.getElementById('vi-preview')).display,
      fileMeta: (document.getElementById('vi-file-meta') || {}).textContent,
      toast: (() => {
        const t = document.querySelector('#vision .vi-toast');
        if (!t) return 'нет элемента';
        const r = t.getBoundingClientRect();
        return { w: Math.round(r.width), offRight: Math.round(r.right - window.innerWidth), opacity: getComputedStyle(t).opacity, text: t.textContent };
      })(),
      status: (document.getElementById('vi-status') || {}).textContent,
      bentoCols: getComputedStyle(document.querySelector('#vision .vi-bento')).gridTemplateColumns.split(' ').length,
      overflowX: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  console.log(vp.n, JSON.stringify(info, null, 1));
  await page.screenshot({ path: path.join(SHOTS, `vision-bento-${vp.n}.png`), fullPage: true });

  // Интеракт-контур (только на desktop-прогоне): переключение режима,
  // копирование результата и сброс снимка должны работать по клику.
  if (vp.n === 'desktop') {
    const out = {};
    await page.click('#vision .vi-segment-btn[data-mode="local"]');
    await page.waitForTimeout(200);
    out.modeAfterClick = await page.evaluate(() => ({
      pressed: document.querySelector('#vision .vi-segment-btn[data-mode="local"]').getAttribute('aria-pressed'),
      endpoint: document.getElementById('vi-endpoint').textContent,
      recipe: document.getElementById('vi-r-mode').textContent
    }));

    // Показываем 06 и копируем: токенизированный тост — обязательный признак.
    await page.evaluate(() => {
      const r = document.getElementById('vi-result');
      r.style.display = 'block';
      document.getElementById('vi-result-body').textContent = 'Пробное описание сцены для проверки копирования.';
    });
    await page.click('#vision .vi-cell--result .lab-btn-compact');
    await page.waitForTimeout(300);
    out.toast = await page.evaluate(() => {
      const t = document.getElementById('vision-toast');
      if (!t) return 'нет тоста';
      const r = t.getBoundingClientRect();
      return { text: t.textContent, offRight: Math.round(r.right - window.innerWidth), isOpen: t.classList.contains('is-open') };
    });

    // Тост скрывается сам через 2с; ждём, иначе он может перехватывать клик.
    await page.waitForTimeout(2200);
    out.hitTest = await page.evaluate(() => {
      const b = document.querySelector('#vision .vi-preview-actions .lab-btn');
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { topEl: el ? el.tagName + '.' + el.className : null, isSame: el === b || b.contains(el) };
    });
    // Без force: если кнопку перехватывает зона загрузки, клик не сработает.
    await page.locator('#vision .vi-preview-actions .lab-btn').first().click();
    await page.waitForTimeout(300);
    out.afterRemove = await page.evaluate(() => ({
      meta: document.getElementById('vi-file-meta').textContent,
      recipeFile: document.getElementById('vi-r-file').textContent,
      placeholder: getComputedStyle(document.getElementById('vi-placeholder')).display,
      btnDisabled: document.getElementById('vi-analyze-btn').disabled
    }));
    console.log('interact', JSON.stringify(out, null, 1));
  }
  await page.close();
}
await browser.close();
server.close();
console.log(errors.length ? 'ОШИБКИ: ' + errors.join('; ') : 'OK: ошибок консоли нет');

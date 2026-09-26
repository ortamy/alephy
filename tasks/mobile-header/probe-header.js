/* Мобильная шапка (≤900px): геометрия + скрины шапки и drawer'а.
   Запуск: node tasks/mobile-header/probe-header.js (сервер: http://127.0.0.1:5000). */
const fs = require('node:fs');
const path = require('node:path');
// Скрипт живёт в tasks/, playwright установлен в researchlab/node_modules.
const { chromium } = require(path.join(__dirname, '..', '..', 'products', 'website', 'apps', 'researchlab', 'node_modules', 'playwright'));

const BASE = 'http://127.0.0.1:5000/apps/researchlab/index.html';
const OUT = __dirname;

const headerMetrics = () => {
  const header = document.getElementById('labHeader');
  const burger = document.getElementById('labSidebarToggle');
  const nav = header.querySelector('nav');
  const mobileLinks = header.querySelector('.lab-header-mobile-links');
  const iconLinks = Array.from(header.querySelectorAll('nav a.icon-link'));
  const box = burger.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return {
    headerHeight: Math.round(header.getBoundingClientRect().height),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    burger: {
      display: getComputedStyle(burger).display,
      size: Math.round(box.width) + 'x' + Math.round(box.height),
      right: Math.round(window.innerWidth - box.right),
      topElement: !!(hit && (hit === burger || burger.contains(hit))),
      hit: hit ? (hit.id || hit.className || hit.tagName) : null
    },
    globeGithubVisible: iconLinks.filter((a) => getComputedStyle(a).display !== 'none').length,
    mobileLinksDisplay: mobileLinks ? getComputedStyle(mobileLinks).display : 'absent',
    navDisplay: nav ? getComputedStyle(nav).display : 'absent',
    linksSectionDisplay: getComputedStyle(document.querySelector('.sidebar-links')).display,
    headerOverflow: header.scrollWidth - header.clientWidth,
    overlaps: (() => {
      const items = Array.from(header.children).filter((el) => getComputedStyle(el).display !== 'none');
      const found = [];
      for (let i = 0; i < items.length - 1; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i].getBoundingClientRect();
          const b = items[j].getBoundingClientRect();
          if (a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top) {
            found.push((items[i].id || items[i].className) + ' × ' + (items[j].id || items[j].className));
          }
        }
      }
      return found;
    })(),
    navOverflow: nav ? nav.scrollWidth - nav.clientWidth : null,
    navChildren: nav ? Array.from(nav.children)
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.getAttribute('title') || el.className.split(' ')[0]) : []
  };
};

const drawerMetrics = () => {
  const drawer = document.getElementById('labSidebar');
  const section = document.querySelector('.sidebar-links');
  const rows = Array.from(document.querySelectorAll('.sidebar-link'));
  return {
    open: drawer.classList.contains('open'),
    background: getComputedStyle(drawer).backgroundColor,
    backdrop: getComputedStyle(drawer).backdropFilter || getComputedStyle(drawer).webkitBackdropFilter,
    transition: getComputedStyle(drawer).transitionDuration,
    sectionVisible: !!(section && section.offsetParent !== null),
    sectionDisplay: section ? getComputedStyle(section).display : 'absent',
    rows: rows.map((row) => ({
      label: row.textContent.trim(),
      href: row.getAttribute('href'),
      height: Math.round(row.getBoundingClientRect().height),
      hasIcon: !!row.querySelector('svg.lucide, i[data-lucide]')
    }))
  };
};


/* Внешние шрифты в прогоне не нужны: без них страница готова за ~1s вместо ~25s. */
const blockFonts = (page) => {
  page.route('**://fonts.googleapis.com/**', (route) => route.abort());
  page.route('**://fonts.gstatic.com/**', (route) => route.abort());
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const report = {};
  const save = () => fs.writeFileSync(path.join(OUT, 'probe-out.json'), JSON.stringify(report, null, 2), 'utf8');

  const openPage = async (width, height, extra) => {
    const page = await browser.newPage(Object.assign({ viewport: { width, height } }, extra || {}));
    blockFonts(page);
    page.on('pageerror', (e) => errors.push(width + ': ' + e.message));
    await page.goto(BASE + '#ai-agents', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    return page;
  };

  for (const width of [360, 390, 414]) {
    const page = await openPage(width, 780);
    report['mobile' + width] = await page.evaluate(headerMetrics);
    await page.screenshot({ path: path.join(OUT, 'header-' + width + '.png'), clip: { x: 0, y: 0, width, height: 140 } });
    await page.close();
    save();
  }

  // 800 (тач-планшет): мобильная шапка ≤900, drawer остаётся drawer'ом, blur включён (≥768).
  const tablet = await openPage(800, 900);
  report.tablet800 = await tablet.evaluate(headerMetrics);
  await tablet.click('#labSidebarToggle');
  await tablet.waitForTimeout(400);
  report.tablet800.drawer = await tablet.evaluate(drawerMetrics);
  await tablet.screenshot({ path: path.join(OUT, 'drawer-800.png') });
  await tablet.close();
  save();

  // 390: открытый drawer с секцией «Ссылки».
  const mobile = await openPage(390, 780);
  await mobile.click('#labSidebarToggle');
  await mobile.waitForTimeout(400);
  report.drawer390 = await mobile.evaluate(drawerMetrics);
  report.drawer390.burgerTopElementWhileOpen = await mobile.evaluate(() => {
    const burger = document.getElementById('labSidebarToggle');
    const box = burger.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!(hit && (hit === burger || burger.contains(hit)));
  });
  await mobile.screenshot({ path: path.join(OUT, 'drawer-390-top.png') });
  // Секция «Ссылки» внизу drawer'а — докатываем, чтобы она попала в кадр.
  await mobile.evaluate(() => {
    const drawer = document.getElementById('labSidebar');
    drawer.scrollTop = drawer.scrollHeight;
  });
  await mobile.waitForTimeout(200);
  report.drawer390.sectionInViewport = await mobile.evaluate(() => {
    const rect = document.querySelector('.sidebar-links').getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  await mobile.screenshot({ path: path.join(OUT, 'drawer-390.png') });
  await mobile.close();
  save();

  // reduced-motion: раскрытие без анимации.
  const reduced = await openPage(390, 780, { reducedMotion: 'reduce' });
  await reduced.click('#labSidebarToggle');
  await reduced.waitForTimeout(150);
  report.reducedMotion390 = await reduced.evaluate(() => {
    const drawer = document.getElementById('labSidebar');
    const overlay = document.getElementById('labSidebarOverlay');
    return {
      drawerTransition: getComputedStyle(drawer).transitionDuration,
      overlayTransition: getComputedStyle(overlay).transitionDuration,
      drawerBackdrop: getComputedStyle(drawer).backdropFilter
    };
  });
  await reduced.close();
  save();

  // Desktop 1280: без изменений — globe/github в шапке, секции «Ссылки» в сайдбаре нет.
  const desktop = await openPage(1280, 800);
  report.desktop1280 = await desktop.evaluate(() => {
    const header = document.getElementById('labHeader');
    const sidebar = document.getElementById('labSidebar');
    const iconLinks = Array.from(header.querySelectorAll('nav a.icon-link'));
    return {
      headerHeight: Math.round(header.getBoundingClientRect().height),
      burgerDisplay: getComputedStyle(document.getElementById('labSidebarToggle')).display,
      iconLinks: iconLinks.map((a) => ({ title: a.getAttribute('title'), display: getComputedStyle(a).display, href: a.getAttribute('href') })),
      sidebarPosition: getComputedStyle(sidebar).position,
      linksSectionDisplay: getComputedStyle(document.querySelector('.sidebar-links')).display,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    };
  });
  await desktop.screenshot({ path: path.join(OUT, 'header-desktop-1280.png'), clip: { x: 0, y: 0, width: 1280, height: 140 } });
  await desktop.close();

  report.errors = errors;
  save();
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();

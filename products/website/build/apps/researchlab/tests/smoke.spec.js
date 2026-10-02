const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, expect } = require('@playwright/test');

const routerPath = path.resolve(__dirname, '..', 'js', 'module-registry.js');
const screenshotDir = path.resolve(__dirname, 'screenshots');
// Маршруты берём из js/module-registry.js — единственного источника правды.
// Читаем сам реестр (vm), а не текстовую регулярку: запись модуля теперь несёт
// источник документа (doc), и шаблон по тексту молча терял 41 маршрут.
function routesFromRegistry() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(routerPath, 'utf8'), sandbox);
  const registry = sandbox.window.ModuleRegistry;
  if (!registry || !registry.MODULES || !registry.MODULES.length) {
    throw new Error('Could not find MODULES in js/module-registry.js');
  }
  return registry.MODULES.map((entry) => entry.id);
}

const routes = routesFromRegistry();
const quickRoutes = new Set([
  'dashboard',
  'root-dictionary',
  'learn/paleo-trainer',
  'pipelines',
  'club',
  'workbench',
  'scripture-reader',
  'researches',
  'cartography'
]);
const routesToCheck = process.env.SMOKE_QUICK === '1' ? routes.filter((route) => quickRoutes.has(route)) : routes;

function routeFileName(route) {
  return route.replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '') || 'dashboard';
}

async function checkRoute(page, route, projectName) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#labContent')).toBeVisible();
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  const hasMojibake = await page.locator('#labContent').evaluate((content) => {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let inspected = 0;
    while (walker.nextNode() && inspected++ < 500) {
      if (/РѕР|Ð|â€”/.test(walker.currentNode.nodeValue || '')) return true;
    }
    return false;
  }, { timeout: 5_000 });
  expect(errors, `uncaught errors on #${route}`).toEqual([]);
  expect(hasMojibake, `mojibake on #${route}`).toBe(false);
  if (projectName === 'mobile') expect(metrics.scrollWidth, `horizontal overflow on #${route}`).toBeLessThanOrEqual(metrics.innerWidth);
  if (process.env.SMOKE_QUICK === '1') return;
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  await fs.promises.mkdir(screenshotDir, { recursive: true });
  const viewport = page.viewportSize();
  const client = await page.context().newCDPSession(page);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 }
  });
  await fs.promises.writeFile(path.join(screenshotDir, `${routeFileName(route)}-${projectName}.png`), Buffer.from(screenshot.data, 'base64'));
  await client.detach();
}

test('agent registry keeps every icon chip populated and cards light', async ({ page }) => {
  await page.goto('/#ai-agents', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#ai-agents .agent-list-card').first()).toBeVisible();
  const violations = await page.locator('#ai-agents').evaluate((root) => {
    const isDark = (value) => {
      const match = value.match(/\d+/g);
      if (!match) return false;
      const [r, g, b] = match.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 96;
    };
    return {
      emptyIcons: Array.from(root.querySelectorAll('.agent-icon-chip')).filter((chip) => !chip.querySelector('svg')).length,
      darkCards: Array.from(root.querySelectorAll('.agent-role-card')).filter((card) => isDark(getComputedStyle(card).backgroundColor)).length
    };
  });
  expect(violations.emptyIcons).toBe(0);
  expect(violations.darkCards).toBe(0);
});

test('timeline hub cards open a full feed and return to catalog', async ({ page }) => {
  await page.goto('/#timeline', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.tl-card').first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-timeline-id');
  await card.click();
  await expect(page).toHaveURL(new RegExp(`#timeline/${id}$`));
  await expect(page.locator('.tl-detail')).toBeVisible();
  await expect(page.locator('.tl-detail-events')).toHaveAttribute('role', 'list');
  await page.locator('.tl-detail-search').fill('несуществующий запрос');
  await expect(page.locator('.tl-detail-empty')).toBeVisible();
  await page.locator('[data-action=reset-search]').click();
  await expect(page.locator('.tl-detail-event:visible')).not.toHaveCount(0);
  await page.locator('.tl-detail-back').click();
  await expect(page).toHaveURL(/#timeline$/);
  // Панель каталога несёт общий класс .lab-toolbar: 80f956ed свёл все
  // панели лаборатории к одному компоненту и переименовал .tl-toolbar.
  await expect(page.locator('.lab-toolbar')).toBeVisible();
});

test.describe('registered routes', () => {
  for (const route of routesToCheck) {
    test(`route #${route} renders without uncaught errors`, async ({ browser }, testInfo) => {
      for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.name === 'mobile' });
        const page = await context.newPage();
        await checkRoute(page, route, viewport.name);
        await context.close();
      }
    });
  }
});
// ===== РЕГРЕССИЯ: ВЕЧНЫЙ СПИННЕР ЗАГРУЗКИ МОДУЛЯ =====
// Модуль, который не закончил загрузку, обязан либо показать контент, либо
// error-state с кнопкой «Повторить» (гард в page-controller.js). Видимый
// спиннер дольше бюджета — это баг, а не состояние ожидания.
// Бюджет ожидания панели/спиннера. Держим его ниже WATCHDOG_MS (8 с) в
// page-controller: до этого порога медленный модуль — «ещё грузится», после —
// error-state. Под полной нагрузкой (96 тестов подряд, холодный кэш) первый
// рендер тяжёлых маршрутов (#manifest, #root-dictionary, #researches,
// #state-analyzer) выходит за 5 с — отсюда были падения «вечного спиннера».
const SPINNER_BUDGET_MS = 7_000;

// Ключевой узел для модулей с fetch-разметкой (pages/<route>.html): ловит
// случай «разметка скачалась, но панель осталась пустой».
const moduleAnchors = {
  'paleo-builder': '[data-paleo-palette]',
  'video-lab': '.vl-shell',
  generators: '.gc-grid',
  checkers: '.gc-grid',
  'religionism-checker': '.rc-shell',
  'state-checker': '.stc-shell',
  'translation-comparator': '.tc-shell',
  'context-generator': '.cx-shell',
  'paleo-keyboard': '#pk-keys .pk-key',
  vision: '.vi-bento',
  analyzers: '.analyzers-shell',
  religionisms: '.rel-bento',
  'design-system': '.ds-bento',
  // Хаб разоблачений и документы: ловят случай «данные не дошли, панель пустая».
  exposures: '#exposure-doc-grid',
  'dict-grecisms': '.research-page-head',
  'exposure-principles': '.research-section',
  'method-tree': '.research-section',
  'method-archeology': '.research-section'
};

const gridRoutes = process.env.SMOKE_QUICK === '1' ? routes.filter((route) => quickRoutes.has(route)) : routes;

test.describe('route loading finishes', () => {
  for (const route of gridRoutes) {
    test(`#${route} показывает контент без вечного спиннера (loading grid)`, async ({ page }) => {
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

      await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });

      const panel = page.locator('#labContent .module.active').first();
      await expect(panel, `панель модуля #${route}`).toBeVisible({ timeout: SPINNER_BUDGET_MS });

      // Спиннер учитывается только если он реально занимает место в раскладке:
      // скрытые спиннеры соседних модулей остаются в DOM.
      const visibleSpinners = () => page
        .locator('#labContent .lab-spinner')
        .evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().height > 0).length);

      await expect
        .poll(visibleSpinners, { timeout: SPINNER_BUDGET_MS, message: `вечный спиннер на #${route}` })
        .toBe(0);

      const anchor = moduleAnchors[route];
      if (anchor) {
        await expect(page.locator(`#labContent ${anchor}`).first(), `ключевой узел ${anchor} на #${route}`).toBeAttached({ timeout: SPINNER_BUDGET_MS });
      } else {
        // В диагностику попадает разметка панели: без неё по таймауту не понять,
        // панель пустая или модуль отрисовался в другой контейнер.
        try {
          await expect
            .poll(() => panel.evaluate((node) => node.children.length), { timeout: SPINNER_BUDGET_MS, message: `пустая панель #${route}` })
            .toBeGreaterThan(0);
        } catch (error) {
          const dump = await page.evaluate(() => {
            const active = document.querySelector('#labContent .module.active');
            return {
              panel: active ? active.id : null,
              html: active ? active.outerHTML.slice(0, 300) : '',
              labChildren: Array.from(document.getElementById('labContent').children).map((node) => `${node.id}.${node.className}`).join(' ')
            };
          });
          throw new Error(`${error.message}\n#${route}: ${JSON.stringify(dump)}`);
        }
      }

      // Error-state гарда — тоже «модуль не загрузился», а не нормальный рендер.
      await expect(page.locator('#labContent [data-module-error]'), `error-state на #${route}`).toHaveCount(0);
      expect(errors, `uncaught errors on #${route}`).toEqual([]);
    });
  }
});

// Гард шапок: реестр LabHero — источник истины для заголовков модулей, и его
// служебный текст («Нет записи шапки») не должен доходить до пользователя.
// Гард реестра: js/module-registry.js — единственный источник правды по
// маршрутам. Если модуль есть в реестре, но не отрисован, или наоборот,
// пользователь получит пустую страницу или «не зарегистрирован» — ловим здесь.
test.describe('module registry', () => {
  test('реестр загружен и совпадает с рендером page-controller', async ({ page }) => {
    await page.goto('/#dashboard', { waitUntil: 'domcontentloaded' });

    const report = await page.evaluate(() => {
      const registry = window.ModuleRegistry;
      if (!registry) return { error: 'ModuleRegistry не загружен' };
      return {
        total: registry.MODULES.length,
        panels: registry.MODULES.filter((m) => m.kind === 'panel').length,
        markdown: registry.MODULES.filter((m) => m.kind === 'markdown').length,
        aliases: Object.keys(registry.ALIASES).length,
        duplicates: registry.MODULES
          .map((m) => m.id)
          .filter((id, index, all) => all.indexOf(id) !== index)
      };
    });

    expect(report.error, report.error).toBeUndefined();
    expect(report.total).toBeGreaterThan(50);
    expect(report.panels).toBeGreaterThan(20);
    expect(report.markdown).toBeGreaterThan(20);
    expect(report.duplicates, `дубли id в реестре: ${report.duplicates}`).toEqual([]);
  });

  test('алиас открывает свой модуль, неизвестный маршрут даёт понятную ошибку', async ({ page }) => {
    // #settings → #admin-settings
    await page.goto('/#settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.location.hash), '#settings → #admin-settings').toBe('#admin-settings');
    await expect(page.locator('#admin-settings .up-bento')).toBeAttached({ timeout: SPINNER_BUDGET_MS });

    // Неизвестный маршрут обязан сказать об этом, а не показать пустую страницу.
    await page.evaluate(() => { window.location.hash = 'no-such-module'; });
    await page.waitForTimeout(600);
    const unknown = await page.evaluate(() => {
      const active = document.querySelector('#labContent .module.active');
      return { id: active ? active.id : null, text: active ? active.textContent : '' };
    });
    expect(unknown.id, 'неизвестный маршрут должен показать error-state').toBe('unknown-route');
    expect(unknown.text).toContain('не зарегистрирован');
  });

  // Достижимость корпуса: документ, до которого нельзя дойти с хаба, живёт
  // только по прямому адресу. Проверяем список хаба против реестра — размер и
  // число ссылок, без ручного перечисления маршрутов.
  test('хабы показывают все документы своих групп', async ({ page }) => {
    // Группы живут на разных хабах: список читается только на активной странице,
    // поэтому каждую открываем и ждём её карточек.
    await page.goto('/#dashboard', { waitUntil: 'domcontentloaded' });
    const groups = await page.evaluate(() => window.ModuleRegistry.DOC_GROUPS
      .filter((group) => group.index)
      .map((group) => ({ id: group.id, hub: group.hub, expected: window.ModuleRegistry.docs(group.id).length })));
    for (const group of groups) {
      await page.goto(`/#${group.hub}`, { waitUntil: 'domcontentloaded' });
      const cards = page.locator(`#${group.hub} .doc-card`);
      await expect(cards, `список группы «${group.id}» на #${group.hub}`)
        .toHaveCount(group.expected, { timeout: SPINNER_BUDGET_MS });
      const keys = await page.evaluate((hub) => Array.from(document.querySelectorAll(`#${hub} .doc-card`))
        .map((card) => card.getAttribute('data-key')), group.hub);
      const orphans = keys.filter((key) => key === null || key === '');
      expect(orphans, `#${group.hub}: карточки без ключа документа ${orphans}`).toEqual([]);
    }
  });
});

// Обход реестра — тот же приём, что в route loading grid.
test.describe('hero guard', () => {
  test('маршруты реестра LabHero не показывают служебный текст шапки', async ({ page }) => {
    await page.goto('/#dashboard', { waitUntil: 'domcontentloaded' });
    const targets = await page.evaluate(() => Object.keys((window.LabHero && window.LabHero.targets) || {}));
    expect(targets.length, 'реестр LabHero.TARGETS пуст').toBeGreaterThan(0);

    for (const route of targets) {
      await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#labContent .module.active').first()).toBeAttached({ timeout: SPINNER_BUDGET_MS });

      const activeId = await page.evaluate(() => {
        const active = document.querySelector('#labContent .module.active');
        return active ? active.id : null;
      });

      // Открытый маршрут обязан получить шапку из реестра...
      if (activeId === route) {
        await expect(
          page.locator(`#labContent .lab-hero[data-lab-hero="${route}"]`),
          `шапка маршрута #${route}`
        ).toBeVisible({ timeout: SPINNER_BUDGET_MS });
      }

      // ...и ни одна видимая шапка не содержит служебный текст.
      await expect(
        page.locator('#labContent .lab-hero', { hasText: 'Нет записи шапки' }),
        `служебный текст шапки на #${route}`
      ).toHaveCount(0);
    }
  });
});

test('agent server offline shows Сервер отключен without uncaught errors', async ({ page }) => {
  const errors = [];
  await page.route('http://127.0.0.1:5000/**', (route) => route.abort());
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#pipelines', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#labContent')).toBeVisible();
  await expect(page.locator('[data-pipeline-server-status]')).toHaveAttribute('data-status', /offline|error/, { timeout: 15_000 });
  await expect(page.locator('[data-pipeline-server-status]')).toContainText('Сервер отключен', { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test.describe('root etymology modal', () => {
  test('loads pilot data, caches it, and handles keyboard/backdrop close', async ({ page }) => {
    let requests = 0;
    page.on('request', (request) => {
      if (decodeURIComponent(request.url()).includes('/data/roots/etymology/')) requests += 1;
    });
    await page.goto('/#root-dictionary/search/AV', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-root-id="אב"]', { timeout: 20_000 });
    const card = page.locator('[data-root-id="אב"]');
    await card.press('Enter');
    await expect(page.locator('#labModal')).toHaveClass(/show/);
    await expect(page.locator('#modalBody')).toContainText('Пра-форма');
    expect(requests).toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#labModal')).not.toHaveClass(/show/);
    await card.press(' ');
    await expect(page.locator('#modalBody')).toContainText('Когнаты');
    expect(requests).toBe(1);
    await page.mouse.click(5, 5);
    await expect(page.locator('#labModal')).not.toHaveClass(/show/);
  });

  test('shows the unpublished fallback for a root without etymology data', async ({ page }) => {
    const roots = require('../data/roots/roots.json');
    const fs = require('node:fs');
    const path = require('node:path');
    const root = roots.find((item) => !fs.existsSync(path.join(__dirname, '..', 'data', 'roots', 'etymology', `${item.root}.json`)));
    await page.goto(`/#root-dictionary/search/${encodeURIComponent(root.translit)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`[data-root-id="${root.root}"]`, { timeout: 20_000 });
    await page.locator(`[data-root-id="${root.root}"]`).click();
    await expect(page.locator('#modalBody')).toContainText('Разбор готовится');
  });

  test('retries a failed etymology request', async ({ browser }) => {
    // Приложение регистрирует sw.js, а Playwright не перехватывает запросы,
    // которые обслуживает Service Worker: с активным SW route.abort() не
    // срабатывает, и error-state модалки остаётся непроверенным.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let requests = 0;
    // Glob-паттерны Playwright не гарантируют матчинг percent-encoded Hebrew,
    // поэтому перехватываем по декодированному pathname.
    await page.route((url) => decodeURIComponent(url.pathname).indexOf('/data/roots/etymology/') === 0, async (route) => {
      requests += 1;
      if (requests === 1) return route.abort();
      return route.continue();
    });
    await page.goto('/#root-dictionary/search/AM', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-root-id="אם"]', { timeout: 20_000 });
    await page.locator('[data-root-id="אם"]').click();
    await expect(page.locator('[data-rem-retry]')).toBeVisible();
    await page.locator('[data-rem-retry]').click();
    await expect(page.locator('#modalBody')).toContainText('Семантические сдвиги');
    expect(requests).toBe(2);
  });
});

test.describe('checkers module cards', () => {
  // Поведенческая проверка: клик по карточке-модулю на #checkers меняет
  // location.hash на её маршрут. Селектор `.gc-card[href^="#"]` берёт только
  // якорные карточки — карточки-описания без собственного маршрута пропускаются.
  test('clicking a module card sets location.hash to its route', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/#checkers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.gc-card[href^="#"]', { timeout: 20_000 });

    const cards = await page.$$eval('.gc-card[href^="#"]', (nodes) => nodes.map((node) => ({
      hash: node.getAttribute('href'),
      title: (node.querySelector('.gc-card-title') || node).textContent.trim()
    })));
    expect(cards.length, 'маршрутизируемых карточек .gc-card на #checkers').toBeGreaterThan(0);

    // Даём отложенной перерисовке модуля завершиться: router дёргает
    // handleHash повторно на load+100ms, PageController заменяет innerHTML —
    // клик, попавший в это окно, не синтезирует click-событие.
    await page.waitForTimeout(1000);

    for (const card of cards) {
      const cardSelector = `.gc-card[href="${card.hash}"]`;
      // Возврат на #checkers перед каждым кликом; на первом проходе это no-op.
      await page.evaluate(() => { window.location.hash = '#checkers'; });
      await page.waitForSelector(cardSelector, { timeout: 20_000 });

      // Клик + ожидание смены hash; один повтор на случай гонки с перерисовкой.
      let actualHash = null;
      let navigated = false;
      for (let attempt = 0; attempt < 2 && !navigated; attempt++) {
        if (attempt > 0) {
          await page.evaluate(() => { window.location.hash = '#checkers'; });
          await page.waitForSelector(cardSelector, { timeout: 20_000 });
        }
        await page.click(cardSelector);
        try {
          await expect(async () => {
            actualHash = await page.evaluate(() => window.location.hash);
            expect(actualHash).toBe(card.hash);
          }).toPass({ timeout: 4_000 });
          navigated = true;
        } catch (error) {
          if (attempt === 1) {
            throw new Error(`Карточка «${card.title}»: ожидался hash ${card.hash}, фактически ${actualHash} (после повтора)`);
          }
        }
      }
    }

    expect(pageErrors, 'uncaught errors при навигации по карточкам #checkers').toEqual([]);
    await context.close();
  });
});

test.describe('paleo-keyboard keys', () => {
  test('reload on #paleo-keyboard keeps keys visible', async ({ page }) => {
    await page.goto('/#paleo-keyboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-keys .pk-key')).toHaveCount(22, { timeout: 10_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-keys .pk-key')).toHaveCount(22, { timeout: 10_000 });
    await expect(page.locator('#pk-keys-count')).toHaveText('22');
  });
});

// ===== Параметризованные маршруты: рендер детали существует =====
// Sample-id берутся из данных модулей (languages.json, timeline.json,
// exposures/index.json, pages/checkers.html) и из реестра агентов в
// page-controller.js — тест не расходится с источником.
const labRoot = path.resolve(__dirname, '..');

function readLabJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(labRoot, relativePath), 'utf8'));
}

function agentSlugsFromRegistry() {
  const source = fs.readFileSync(path.resolve(labRoot, 'js', 'page-controller.js'), 'utf8');
  const match = source.match(/var agentSlugs = \[(.*?)\];/s);
  if (!match) throw new Error('Could not find agentSlugs registry in page-controller.js');
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
}

function checkerRoutesFromHub() {
  const source = fs.readFileSync(path.resolve(labRoot, 'pages', 'checkers.html'), 'utf8');
  return [...source.matchAll(/href="#([^"]+)"/g)].map((item) => item[1]);
}

const parameterizedSamples = (() => {
  const languages = readLabJson('data/language-map/languages.json').languages;
  const timelines = readLabJson('data/timeline.json');
  const researches = readLabJson('data/exposures/index.json');
  const agentSlugs = agentSlugsFromRegistry();
  return [
    { route: `language-map/${languages[0].id}`, anchor: '.language-map-detail', title: languages[0].name },
    { route: `timeline/${timelines[0].id}`, anchor: `[data-timeline-id="${timelines[0].id}"]` },
    { route: `ai-agents/${agentSlugs[0]}`, anchor: '#agent-detail-view' },
    { route: 'dictionaries/root-dictionary', anchor: '#rd-search' },
    { route: 'dictionaries/paleo-glossary', anchor: '#paleo-glossary-search' },
    { route: `researches/case/${researches[0].slug}`, anchor: '.exposure-case-page' },
    ...checkerRoutesFromHub().map((route) => ({ route, anchor: moduleAnchors[route] || null }))
  ];


})();

test('substitution checker hero never titles «Расследование»', async ({ page }) => {
  await page.goto('/#investigation', { waitUntil: 'domcontentloaded' });
  const heroTitle = page.locator('#lab-hero-title-investigation');
  await expect(heroTitle).toHaveCount(1, { timeout: SPINNER_BUDGET_MS });
  await expect
    .poll(() => heroTitle.textContent().then((text) => (text || '').trim()), { timeout: SPINNER_BUDGET_MS, message: 'пустой заголовок шапки чекера подмен' })
    .not.toBe('Расследование');
  await expect(heroTitle, 'заголовок героя чекера подмен').toContainText('Чекер подмен');
});

test.describe('parameterized routes render detail', () => {
  for (const sample of parameterizedSamples) {
    test(`#${sample.route} открывает деталь без hero-ошибки и пустой панели`, async ({ page }) => {
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

      const moduleId = sample.route.split('/')[0];
      await page.goto(`/#${sample.route}`, { waitUntil: 'domcontentloaded' });

      // Заголовок детали живёт в шапке модуля (LabHero).
      const heroTitle = page.locator(`#lab-hero-title-${moduleId}`);
      await expect(heroTitle, `заголовок шапки на #${sample.route}`).toHaveCount(1, { timeout: SPINNER_BUDGET_MS });
      await expect
        .poll(() => heroTitle.textContent().then((text) => (text || '').trim()), { timeout: SPINNER_BUDGET_MS, message: `пустой заголовок шапки на #${sample.route}` })
        .not.toBe('');
      if (sample.title) await expect(heroTitle, `заголовок детали из данных на #${sample.route}`).toContainText(sample.title);

      // Error-state модуля — это «модуль не загрузился», а не рендер детали.
      await expect(page.locator('#labContent [data-module-error]'), `error-state на #${sample.route}`).toHaveCount(0);

      // Корень лаба (#labContent) не должен остаться с пустой панелью модуля.
      const panel = page.locator(`#labContent #${moduleId}.module.active`).first();
      await expect(panel, `панель модуля #${sample.route}`).toBeVisible({ timeout: SPINNER_BUDGET_MS });
      await expect
        .poll(() => panel.evaluate((node) => node.children.length), { timeout: SPINNER_BUDGET_MS, message: `пустая панель #${sample.route}` })
        .toBeGreaterThan(1);

      if (sample.anchor) {
        await expect(page.locator(`#labContent ${sample.anchor}`).first(), `узел детали ${sample.anchor} на #${sample.route}`)
          .toBeAttached({ timeout: SPINNER_BUDGET_MS });
      }

      expect(errors, `uncaught errors on #${sample.route}`).toEqual([]);

    });
  }
});

// Модуль «Дизайн-система» показывает токены из живой темы, поэтому проверяем
// не только наличие разметки, но и то, что образцы совпадают с computed-стилями.
test.describe('design system module', () => {
  test('bento показывает токены темы и живые компоненты', async ({ page }) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await page.goto('/#design-system', { waitUntil: 'domcontentloaded' });

    const bento = page.locator('#labContent .ds-bento');
    await expect(bento).toBeAttached({ timeout: SPINNER_BUDGET_MS });

    const report = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const swatch = document.querySelector('.ds-swatch-name');
      const typeRow = document.querySelector('.ds-type-row');
      return {
        cells: document.querySelectorAll('#labContent .ds-cell').length,
        swatches: document.querySelectorAll('.ds-swatch').length,
        // Подпись образца должна содержать реальное значение токена, а не прочерк.
        swatchValue: swatch ? swatch.parentNode.querySelector('[data-ds-token]').textContent.trim() : '',
        tokenValue: styles.getPropertyValue('--bg-primary').trim(),
        typeSamplePx: typeRow ? getComputedStyle(typeRow.querySelector('.ds-type-sample')).fontSize : '',
        tokens3xl: styles.getPropertyValue('--text-3xl').trim(),
        hasButtons: document.querySelectorAll('.ds-cell--components .lab-btn').length,
        hasEmpty: document.querySelectorAll('.ds-empty').length,
        hasStatusDots: document.querySelectorAll('.ds-cell--statuses .ds-dot').length
      };
    });

    expect(report.cells, 'ячейки bento').toBeGreaterThanOrEqual(10);
    expect(report.swatches, 'образцы цветовых ролей').toBeGreaterThanOrEqual(10);
    expect(report.tokenValue, '--accent-gold должен быть задан темой').not.toBe('');
    expect(report.swatchValue, 'подпись образца показывает значение токена').toContain(report.tokenValue);
    expect(report.typeSamplePx, 'лестница типов использует реальный токен').toBe(report.tokens3xl);
    expect(report.hasButtons, 'живые кнопки §4.4').toBeGreaterThanOrEqual(4);
    expect(report.hasEmpty, 'живое пустое состояние §4.6').toBe(1);
    expect(report.hasStatusDots, 'легенда статусов §6').toBe(4);
    expect(errors, `uncaught errors on #design-system`).toEqual([]);
  });

  test('образцы перечитывают токены при смене темы', async ({ page }) => {
    await page.goto('/#design-system', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#labContent .ds-bento')).toBeAttached({ timeout: SPINNER_BUDGET_MS });

    // --bg-primary различается в светлой и тёмной теме. page-controller не
    // перерисовывает уже загруженную панель, поэтому модуль обязан обновлять
    // подписи сам — иначе он показывал бы цвета предыдущей темы.
    const readLabel = () => page.evaluate(() => {
      const node = document.querySelector('#labContent [data-ds-token="--bg-primary"]');
      return node ? node.textContent.trim() : '';
    });

    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
    await expect
      .poll(readLabel, { timeout: SPINNER_BUDGET_MS, message: 'подписи не обновились после смены темы' })
      .toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim()));
    const light = await readLabel();

    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
    await expect
      .poll(readLabel, { timeout: SPINNER_BUDGET_MS, message: 'подписи не обновились после смене темы' })
      .not.toBe(light);
    const dark = await readLabel();

    expect(light, 'подпись образца в светлой теме').toMatch(/#[0-9a-f]{3,8}/i);
    expect(dark, 'подпись образца в тёмной теме').toMatch(/#[0-9a-f]{3,8}/i);
    expect(dark, 'образцы обязаны показывать цвет своей темы').not.toBe(light);

    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  });
});

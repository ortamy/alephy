# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> root etymology modal >> retries a failed etymology request
- Location: tests\smoke.spec.js:125:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 20000ms exceeded.
Call log:
  - waiting for locator('[data-root-id="אם"]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - link "Alephy Бета-версия" [ref=e3] [cursor=pointer]:
      - /url: "#dashboard"
      - img "Alephy" [ref=e4]
      - generic "Бета-версия" [ref=e5]: BETA
    - navigation [ref=e6]:
      - button "Переключить тему" [ref=e7] [cursor=pointer]
      - button "Поиск" [ref=e8] [cursor=pointer]
      - link "Сайт" [ref=e9] [cursor=pointer]:
        - /url: ../../
      - link "GitHub" [ref=e10] [cursor=pointer]:
        - /url: https://github.com/ortamy/alephy
  - generic:
    - generic:
      - textbox:
        - /placeholder: Поиск по модулям, словарям, исследованиям…
  - generic [ref=e11]:
    - complementary [ref=e12]:
      - generic [ref=e13]:
        - searchbox "Фильтр навигации" [ref=e15]
        - link "Манифест" [ref=e16] [cursor=pointer]:
          - /url: "#manifest"
        - link "Рабочий стол" [ref=e17] [cursor=pointer]:
          - /url: "#dashboard"
        - link "Мастерская" [ref=e18] [cursor=pointer]:
          - /url: "#workbench"
        - link "Палео-клуб" [ref=e19] [cursor=pointer]:
          - /url: "#club"
        - generic [ref=e21]:
          - generic [ref=e22] [cursor=pointer]: Данные
          - generic [ref=e24]:
            - link "Книгочтение" [ref=e25] [cursor=pointer]:
              - /url: "#scripture-reader"
            - link "Обучение" [ref=e26] [cursor=pointer]:
              - /url: "#learn"
            - link "Словари" [ref=e27] [cursor=pointer]:
              - /url: "#dictionaries"
            - link "Исследования" [ref=e28] [cursor=pointer]:
              - /url: "#researches"
            - link "Методология" [ref=e29] [cursor=pointer]:
              - /url: "#methodology"
            - link "Палео-механика" [ref=e30] [cursor=pointer]:
              - /url: "#paleo-mechanics"
            - link "Палео-лингвистика" [ref=e31] [cursor=pointer]:
              - /url: "#paleo-linguistics"
            - link "Карта языков" [ref=e32] [cursor=pointer]:
              - /url: "#language-map"
            - link "Картография" [ref=e33] [cursor=pointer]:
              - /url: "#cartography"
            - link "Карта состояний" [ref=e34] [cursor=pointer]:
              - /url: "#states"
            - link "Палео-таймлайн" [ref=e35] [cursor=pointer]:
              - /url: "#timeline"
            - link "Религионизмы" [ref=e36] [cursor=pointer]:
              - /url: "#religionisms"
        - generic [ref=e37]:
          - generic [ref=e38] [cursor=pointer]: Инструменты
          - generic [ref=e40]:
            - link "Палео-конструктор" [ref=e41] [cursor=pointer]:
              - /url: "#paleo-builder"
            - link "Палео-клавиатура" [ref=e42] [cursor=pointer]:
              - /url: "#paleo-keyboard"
            - link "Генераторы" [ref=e43] [cursor=pointer]:
              - /url: "#generators"
            - link "Чекеры" [ref=e44] [cursor=pointer]:
              - /url: "#checkers"
            - link "Анализаторы" [ref=e45] [cursor=pointer]:
              - /url: "#analyzers"
        - generic [ref=e46]:
          - generic [ref=e47] [cursor=pointer]: AI
          - generic [ref=e49]:
            - link "Агенты" [ref=e50] [cursor=pointer]:
              - /url: "#ai-agents"
            - link "Пайплайны" [ref=e51] [cursor=pointer]:
              - /url: "#pipelines"
            - link "Запуск сервера" [ref=e52] [cursor=pointer]:
              - /url: "#agent-server"
            - link "Нейрочат" [ref=e53] [cursor=pointer]:
              - /url: "#ed-chat"
            - link "Анализ изображений" [ref=e54] [cursor=pointer]:
              - /url: "#vision"
        - generic [ref=e55]:
          - generic [ref=e56] [cursor=pointer]: Система
          - link "Настройки" [ref=e59] [cursor=pointer]:
            - /url: "#admin-settings"
    - main [ref=e60]:
      - generic [ref=e61]:
        - region [ref=e62]:
          - generic [ref=e63]:
            - paragraph [ref=e64]:
              - link "АЛЕФИ" [ref=e65] [cursor=pointer]:
                - /url: "#dashboard"
              - text: ·
              - link "Корневой словарь" [ref=e66] [cursor=pointer]:
                - /url: "#root-dictionary"
              - text: ·
              - link "Поиск" [ref=e67] [cursor=pointer]:
                - /url: "#root-dictionary/search"
              - text: ·
              - 'link "Поиск: AM" [ref=e68] [cursor=pointer]':
                - /url: "#root-dictionary/search/AM"
            - heading "Корневой словарь" [level=1] [ref=e69]
            - paragraph [ref=e71]: "Поиск по корням иврита: форма, значение и восстановленная физика слова."
          - text: 𐤀
        - textbox "אמן, AMN, верить..." [active] [ref=e73]: AM
        - generic [ref=e74]:
          - generic [ref=e75]:
            - generic [ref=e76]: "300"
            - generic [ref=e77]: Корней
          - generic [ref=e78]:
            - generic [ref=e79]: "10"
            - generic [ref=e80]: Найдено
        - generic [ref=e81]:
          - 'button "Открыть этимологический разбор: אם" [ref=e82] [cursor=pointer]':
            - generic [ref=e83]:
              - generic [ref=e84]:
                - generic "бык (сила)" [ref=e85]: 𐤀
                - generic "вода (течение)" [ref=e86]: 𐤌
              - generic [ref=e87]: אם
              - generic [ref=e88]: AM
            - generic [ref=e89]:
              - strong [ref=e90]: "Значение:"
              - text: мать, материнство
            - generic [ref=e91]:
              - strong [ref=e92]: "Образ:"
              - text: Сила воды — мать
            - list [ref=e93]:
              - listitem [ref=e94]: אם — мать
            - button "Связи" [ref=e95]
          - 'button "Открыть этимологический разбор: אמא" [ref=e96] [cursor=pointer]':
            - generic [ref=e97]:
              - generic [ref=e98]:
                - generic "бык (сила)" [ref=e99]: 𐤀
                - generic "вода (течение)" [ref=e100]: 𐤌
                - generic "бык (сила)" [ref=e101]: 𐤀
              - generic [ref=e102]: אמא
              - generic [ref=e103]: AMA
            - generic [ref=e104]:
              - strong [ref=e105]: "Значение:"
              - text: мать, материнство
            - generic [ref=e106]:
              - strong [ref=e107]: "Образ:"
              - text: Сила воды воды — мать
            - list [ref=e108]:
              - listitem [ref=e109]: אמא — мама
            - button "Связи" [ref=e110]
          - 'button "Открыть этимологический разбор: אמין" [ref=e111] [cursor=pointer]':
            - generic [ref=e112]:
              - generic [ref=e113]:
                - generic "бык (сила)" [ref=e114]: 𐤀
                - generic "вода (течение)" [ref=e115]: 𐤌
                - generic "рука (действие)" [ref=e116]: 𐤉
                - generic "рыба (жизни)" [ref=e117]: 𐤍
              - generic [ref=e118]: אמין
              - generic [ref=e119]: AMYN
            - generic [ref=e120]:
              - strong [ref=e121]: "Значение:"
              - text: надёжный, верный
            - generic [ref=e122]:
              - strong [ref=e123]: "Образ:"
              - text: Сила воды — надёжность
            - list [ref=e124]:
              - listitem [ref=e125]: אמין — надёжный
            - button "Связи" [ref=e126]
          - 'button "Открыть этимологический разбор: אמן" [ref=e127] [cursor=pointer]':
            - generic [ref=e128]:
              - generic [ref=e129]:
                - generic "бык (сила)" [ref=e130]: 𐤀
                - generic "вода (течение)" [ref=e131]: 𐤌
                - generic "рыба (жизнь)" [ref=e132]: 𐤍
              - generic [ref=e133]: אמן
              - generic [ref=e134]: AMN
            - generic [ref=e135]:
              - strong [ref=e136]: "Значение:"
              - text: поддерживать, быть надёжным, верность
            - generic [ref=e137]:
              - strong [ref=e138]: "Образ:"
              - text: Сила текущей жизни — надёжность, верность
            - generic [ref=e139]: "Подмены: вера (вместо 'верность, надёжность'), истина (вместо 'верность')"
            - list [ref=e140]:
              - listitem [ref=e141]: אמן — истинно, да будет так
              - listitem [ref=e142]: אמונה — верность, надёжность
            - button "Связи" [ref=e143]
          - 'button "Открыть этимологический разбор: אמר" [ref=e144] [cursor=pointer]':
            - generic [ref=e145]:
              - generic [ref=e146]:
                - generic "бык (сила)" [ref=e147]: 𐤀
                - generic "вода (течение)" [ref=e148]: 𐤌
                - generic "голова (начало)" [ref=e149]: 𐤓
              - generic [ref=e150]: אמר
              - generic [ref=e151]: AMR
            - generic [ref=e152]:
              - strong [ref=e153]: "Значение:"
              - text: говорить, сказать, велеть
            - generic [ref=e154]:
              - strong [ref=e155]: "Образ:"
              - text: Сила текущего начала — слово, речь
            - list [ref=e156]:
              - listitem [ref=e157]: אמר — сказал
              - listitem [ref=e158]: אמירה — высказывание
            - button "Связи" [ref=e159]
          - 'button "Открыть этимологический разбор: אמת" [ref=e160] [cursor=pointer]':
            - generic [ref=e161]:
              - generic [ref=e162]:
                - generic "бык (сила)" [ref=e163]: 𐤀
                - generic "вода (течение)" [ref=e164]: 𐤌
                - generic "знак (печать)" [ref=e165]: 𐤕
              - generic [ref=e166]: אמת
              - generic [ref=e167]: AMT
            - generic [ref=e168]:
              - strong [ref=e169]: "Значение:"
              - text: истинный, верный, truth
            - generic [ref=e170]:
              - strong [ref=e171]: "Образ:"
              - text: Сила воды знака — истинность
            - list [ref=e172]:
              - listitem [ref=e173]: אמת — правда
            - button "Связи" [ref=e174]
          - 'button "Открыть этимологический разбор: טעם" [ref=e175] [cursor=pointer]':
            - generic [ref=e176]:
              - generic [ref=e177]:
                - generic "змея (оборачивание)" [ref=e178]: 𐤈
                - generic "глаз (видение)" [ref=e179]: 𐤏
                - generic "вода (течение)" [ref=e180]: 𐤌
              - generic [ref=e181]: טעם
              - generic [ref=e182]: TAM
            - generic [ref=e183]:
              - strong [ref=e184]: "Значение:"
              - text: вкус, привкус
            - generic [ref=e185]:
              - strong [ref=e186]: "Образ:"
              - text: Оборачивание воды — вкус
            - list [ref=e187]:
              - listitem [ref=e188]: טעם — вкус
            - button "Связи" [ref=e189]
          - 'button "Открыть этимологический разбор: עם" [ref=e190] [cursor=pointer]':
            - generic [ref=e191]:
              - generic [ref=e192]:
                - generic "глаз (видение)" [ref=e193]: 𐤏
                - generic "вода (течение)" [ref=e194]: 𐤌
              - generic [ref=e195]: עם
              - generic [ref=e196]: AM
            - generic [ref=e197]:
              - strong [ref=e198]: "Значение:"
              - text: народ, с, вместе
            - generic [ref=e199]:
              - strong [ref=e200]: "Образ:"
              - text: Видение течения — народ, единство
            - list [ref=e201]:
              - listitem [ref=e202]: עם — народ
              - listitem [ref=e203]: עִם — с (предлог)
            - button "Связи" [ref=e204]
          - 'button "Открыть этимологический разбор: עמק" [ref=e205] [cursor=pointer]':
            - generic [ref=e206]:
              - generic [ref=e207]:
                - generic "глаз (видение)" [ref=e208]: 𐤏
                - generic "вода (течение)" [ref=e209]: 𐤌
                - generic "крюк (праведность)" [ref=e210]: 𐤒
              - generic [ref=e211]: עמק
              - generic [ref=e212]: AMK
            - generic [ref=e213]:
              - strong [ref=e214]: "Значение:"
              - text: глубина, бездна
            - generic [ref=e215]:
              - strong [ref=e216]: "Образ:"
              - text: Видение дома — глубина
            - list [ref=e217]:
              - listitem [ref=e218]: עמק — глубина
            - button "Связи" [ref=e219]
          - 'button "Открыть этимологический разбор: רעם" [ref=e220] [cursor=pointer]':
            - generic [ref=e221]:
              - generic [ref=e222]:
                - generic "голова (начало)" [ref=e223]: 𐤓
                - generic "глаз (видение)" [ref=e224]: 𐤏
                - generic "вода (течение)" [ref=e225]: 𐤌
              - generic [ref=e226]: רעם
              - generic [ref=e227]: RAM
            - generic [ref=e228]:
              - strong [ref=e229]: "Значение:"
              - text: гром, раскаты
            - generic [ref=e230]:
              - strong [ref=e231]: "Образ:"
              - text: Начало воды — гром
            - list [ref=e232]:
              - listitem [ref=e233]: רעם — гром
            - button "Связи" [ref=e234]
  - generic "Горячие клавиши" [ref=e235] [cursor=pointer]: ⌨ ?
```

# Test source

```ts
  35  |     if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
  36  |   });
  37  |   page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  38  |   await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  39  |   await expect(page.locator('#labContent')).toBeVisible();
  40  |   const metrics = await page.evaluate(() => ({
  41  |     innerWidth: window.innerWidth,
  42  |     scrollWidth: document.documentElement.scrollWidth
  43  |   }));
  44  |   const hasMojibake = await page.locator('#labContent').evaluate((content) => {
  45  |     const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  46  |     let inspected = 0;
  47  |     while (walker.nextNode() && inspected++ < 500) {
  48  |       if (/РѕР|Ð|â€”/.test(walker.currentNode.nodeValue || '')) return true;
  49  |     }
  50  |     return false;
  51  |   }, { timeout: 5_000 });
  52  |   expect(errors, `uncaught errors on #${route}`).toEqual([]);
  53  |   expect(hasMojibake, `mojibake on #${route}`).toBe(false);
  54  |   if (projectName === 'mobile') expect(metrics.scrollWidth, `horizontal overflow on #${route}`).toBeLessThanOrEqual(metrics.innerWidth);
  55  |   if (process.env.SMOKE_QUICK === '1') return;
  56  |   await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  57  |   await fs.promises.mkdir(screenshotDir, { recursive: true });
  58  |   const viewport = page.viewportSize();
  59  |   const client = await page.context().newCDPSession(page);
  60  |   const screenshot = await client.send('Page.captureScreenshot', {
  61  |     format: 'png',
  62  |     clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 }
  63  |   });
  64  |   await fs.promises.writeFile(path.join(screenshotDir, `${routeFileName(route)}-${projectName}.png`), Buffer.from(screenshot.data, 'base64'));
  65  |   await client.detach();
  66  | }
  67  | 
  68  | test.describe('registered routes', () => {
  69  |   for (const route of routesToCheck) {
  70  |     test(`route #${route} renders without uncaught errors`, async ({ browser }, testInfo) => {
  71  |       for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
  72  |         const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.name === 'mobile' });
  73  |         const page = await context.newPage();
  74  |         await checkRoute(page, route, viewport.name);
  75  |         await context.close();
  76  |       }
  77  |     });
  78  |   }
  79  | });
  80  | 
  81  | test('agent server offline shows Сервер отключен without uncaught errors', async ({ page }) => {
  82  |   const errors = [];
  83  |   await page.route('http://127.0.0.1:5000/**', (route) => route.abort());
  84  |   page.on('pageerror', (error) => errors.push(error.message));
  85  |   await page.goto('/#pipelines', { waitUntil: 'domcontentloaded' });
  86  |   await expect(page.locator('#labContent')).toBeVisible();
  87  |   await expect(page.locator('[data-pipeline-server-status]')).toHaveAttribute('data-status', /offline|error/, { timeout: 15_000 });
  88  |   await expect(page.locator('[data-pipeline-server-status]')).toContainText('Сервер отключен', { timeout: 5_000 });
  89  |   expect(errors).toEqual([]);
  90  | });
  91  | 
  92  | test.describe('root etymology modal', () => {
  93  |   test('loads pilot data, caches it, and handles keyboard/backdrop close', async ({ page }) => {
  94  |     let requests = 0;
  95  |     page.on('request', (request) => {
  96  |       if (decodeURIComponent(request.url()).includes('/data/roots/etymology/')) requests += 1;
  97  |     });
  98  |     await page.goto('/#root-dictionary/search/AV', { waitUntil: 'domcontentloaded' });
  99  |     await page.waitForSelector('[data-root-id="אב"]', { timeout: 20_000 });
  100 |     const card = page.locator('[data-root-id="אב"]');
  101 |     await card.press('Enter');
  102 |     await expect(page.locator('#labModal')).toHaveClass(/show/);
  103 |     await expect(page.locator('#modalBody')).toContainText('Пра-форма');
  104 |     expect(requests).toBe(1);
  105 |     await page.keyboard.press('Escape');
  106 |     await expect(page.locator('#labModal')).not.toHaveClass(/show/);
  107 |     await card.press(' ');
  108 |     await expect(page.locator('#modalBody')).toContainText('Когнаты');
  109 |     expect(requests).toBe(1);
  110 |     await page.mouse.click(5, 5);
  111 |     await expect(page.locator('#labModal')).not.toHaveClass(/show/);
  112 |   });
  113 | 
  114 |   test('shows the unpublished fallback for a root without etymology data', async ({ page }) => {
  115 |     const roots = require('../data/roots/roots.json');
  116 |     const fs = require('node:fs');
  117 |     const path = require('node:path');
  118 |     const root = roots.find((item) => !fs.existsSync(path.join(__dirname, '..', 'data', 'roots', 'etymology', `${item.root}.json`)));
  119 |     await page.goto(`/#root-dictionary/search/${encodeURIComponent(root.translit)}`, { waitUntil: 'domcontentloaded' });
  120 |     await page.waitForSelector(`[data-root-id="${root.root}"]`, { timeout: 20_000 });
  121 |     await page.locator(`[data-root-id="${root.root}"]`).click();
  122 |     await expect(page.locator('#modalBody')).toContainText('Разбор готовится');
  123 |   });
  124 | 
  125 |   test('retries a failed etymology request', async ({ page }) => {
  126 |     let requests = 0;
  127 |     // Glob-паттерны Playwright не гарантируют матчинг percent-encoded Hebrew,
  128 |     // поэтому перехватываем по декодированному pathname.
  129 |     await page.route((url) => decodeURIComponent(url.pathname).indexOf('/data/roots/etymology/') === 0, async (route) => {
  130 |       requests += 1;
  131 |       if (requests === 1) return route.abort();
  132 |       return route.continue();
  133 |     });
  134 |     await page.goto('/#root-dictionary/search/AM', { waitUntil: 'domcontentloaded' });
> 135 |     await page.waitForSelector('[data-root-id="אם"]', { timeout: 20_000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 20000ms exceeded.
  136 |     await page.locator('[data-root-id="אם"]').click();
  137 |     await expect(page.locator('[data-rem-retry]')).toBeVisible();
  138 |     await page.locator('[data-rem-retry]').click();
  139 |     await expect(page.locator('#modalBody')).toContainText('Семантические сдвиги');
  140 |     expect(requests).toBe(2);
  141 |   });
  142 | });
  143 | 
  144 | test.describe('checkers module cards', () => {
  145 |   // Поведенческая проверка: клик по карточке-модулю на #checkers меняет
  146 |   // location.hash на её маршрут. Селектор `.gc-card[href^="#"]` берёт только
  147 |   // якорные карточки — карточки-описания без собственного маршрута пропускаются.
  148 |   test('clicking a module card sets location.hash to its route', async ({ browser }) => {
  149 |     const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  150 |     const page = await context.newPage();
  151 |     const pageErrors = [];
  152 |     page.on('pageerror', (error) => pageErrors.push(error.message));
  153 | 
  154 |     await page.goto('/#checkers', { waitUntil: 'domcontentloaded' });
  155 |     await page.waitForSelector('.gc-card[href^="#"]', { timeout: 20_000 });
  156 | 
  157 |     const cards = await page.$$eval('.gc-card[href^="#"]', (nodes) => nodes.map((node) => ({
  158 |       hash: node.getAttribute('href'),
  159 |       title: (node.querySelector('.gc-card-title') || node).textContent.trim()
  160 |     })));
  161 |     expect(cards.length, 'маршрутизируемых карточек .gc-card на #checkers').toBeGreaterThan(0);
  162 | 
  163 |     // Даём отложенной перерисовке модуля завершиться: router дёргает
  164 |     // handleHash повторно на load+100ms, PageController заменяет innerHTML —
  165 |     // клик, попавший в это окно, не синтезирует click-событие.
  166 |     await page.waitForTimeout(1000);
  167 | 
  168 |     for (const card of cards) {
  169 |       const cardSelector = `.gc-card[href="${card.hash}"]`;
  170 |       // Возврат на #checkers перед каждым кликом; на первом проходе это no-op.
  171 |       await page.evaluate(() => { window.location.hash = '#checkers'; });
  172 |       await page.waitForSelector(cardSelector, { timeout: 20_000 });
  173 | 
  174 |       // Клик + ожидание смены hash; один повтор на случай гонки с перерисовкой.
  175 |       let actualHash = null;
  176 |       let navigated = false;
  177 |       for (let attempt = 0; attempt < 2 && !navigated; attempt++) {
  178 |         if (attempt > 0) {
  179 |           await page.evaluate(() => { window.location.hash = '#checkers'; });
  180 |           await page.waitForSelector(cardSelector, { timeout: 20_000 });
  181 |         }
  182 |         await page.click(cardSelector);
  183 |         try {
  184 |           await expect(async () => {
  185 |             actualHash = await page.evaluate(() => window.location.hash);
  186 |             expect(actualHash).toBe(card.hash);
  187 |           }).toPass({ timeout: 4_000 });
  188 |           navigated = true;
  189 |         } catch (error) {
  190 |           if (attempt === 1) {
  191 |             throw new Error(`Карточка «${card.title}»: ожидался hash ${card.hash}, фактически ${actualHash} (после повтора)`);
  192 |           }
  193 |         }
  194 |       }
  195 |     }
  196 | 
  197 |     expect(pageErrors, 'uncaught errors при навигации по карточкам #checkers').toEqual([]);
  198 |     await context.close();
  199 |   });
  200 | });
  201 | 
  202 | test.describe('paleo-keyboard keys', () => {
  203 |   test('reload on #paleo-keyboard keeps keys visible', async ({ page }) => {
  204 |     await page.goto('/#paleo-keyboard', { waitUntil: 'domcontentloaded' });
  205 |     await expect(page.locator('#pk-keys .pk-key')).toHaveCount(22, { timeout: 10_000 });
  206 |     await page.reload({ waitUntil: 'domcontentloaded' });
  207 |     await expect(page.locator('#pk-keys .pk-key')).toHaveCount(22, { timeout: 10_000 });
  208 |     await expect(page.locator('#pk-keys-count')).toHaveText('22');
  209 |   });
  210 | });
```
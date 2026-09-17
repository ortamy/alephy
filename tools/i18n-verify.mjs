// Функциональная проверка рантайма локализации: прогон в CI (tools/i18n-verify.mjs).
// 7 сценариев: ru как язык разметки, ?lang=en при draft, переключение ready-языка,
// локали по пути скрипта, 404 локалей, бургер-меню без i18n.js, живая смена языка.
// Запуск из корня репозитория: node tools/i18n-verify.mjs [i18n.js] [locales/]
import fs from 'node:fs';
import path from 'node:path';
import * as vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_I18N = process.argv[2] || path.join(ROOT, 'products', 'website', 'src', 'js', 'i18n.js');
const LOCALES = process.argv[3] || path.join(ROOT, 'products', 'website', 'src', 'locales');
const I18N_SRC = 'https://example.github.io/alephy/js/i18n.js';
const BURGER_SRC = 'https://example.github.io/alephy/js/burger-menu.js';
const PAGE = 'https://example.github.io/alephy/pages/tanakh/index.html';
const PAGE_PATH = '/alephy/pages/tanakh/index.html';

const I18N = fs.readFileSync(SRC_I18N, 'utf8');
const BURGER = fs.readFileSync(path.join(path.dirname(SRC_I18N), 'burger-menu.js'), 'utf8');
const readLocale = (name) => JSON.parse(fs.readFileSync(path.join(LOCALES, name + '.json'), 'utf8'));
const MANIFEST = readLocale('index');
const MANIFEST_EN_READY = JSON.parse(JSON.stringify(MANIFEST));
MANIFEST_EN_READY.languages.forEach((l) => { if (l.code === 'en') l.status = 'ready'; });

const BURGER_KEYS = ['logo', 'home', 'tanakh', 'research', 'methods', 'dictionaries', 'methodology', 'tools', 'lab', 'about'];

let fails = 0;
function check(name, cond, extra) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra === undefined ? '' : ' → ' + extra));
    if (!cond) fails++;
}

function makeElement(tag) {
    return {
        tagName: tag || 'div', value: '', disabled: false, selected: false, textContent: '',
        attrs: {}, children: [], firstChild: null, dir: '', classList: { toggle: function () {} },
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        appendChild: function (c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
        removeChild: function (c) {
            this.children = this.children.filter(function (x) { return x !== c; });
            this.firstChild = this.children[0] || null;
            return c;
        },
        addEventListener: function (t, fn) { this.listeners = this.listeners || {}; this.listeners[t] = fn; },
        querySelector: function (sel) {
            if (sel === 'select') {
                for (var i = 0; i < this.children.length; i++) {
                    if (this.children[i].tagName === 'select') return this.children[i];
                }
            }
            return null;
        }
    };
}

function makeEnv(cfg) {
    const store = new Map();
    const docListeners = {};
    const result = { replaced: null, fetched: [], events: [] };
    const slots = [makeElement('div')];
    const elements = {};
    const keyEls = {};
    BURGER_KEYS.forEach(function (k) {
        const el = makeElement('span');
        el.attrs['data-burger-key'] = k;
        keyEls[k] = el;
    });

    // Разметка страницы: русские тексты уже на месте — рантайм не должен их терять.
    const i18nNodes = [{ key: 'pages.about.heading', text: '◈ О проекте' }].map(function (spec) {
        const el = makeElement('h1');
        el.attrs['data-i18n'] = spec.key;
        el.textContent = spec.text;
        return el;
    });
    const attrNodes = [{ attr: 'aria-label', key: 'lang.aria', value: 'Язык интерфейса' }].map(function (spec) {
        const el = makeElement('button');
        el.attrs['data-i18n-attr'] = spec.attr + ':' + spec.key;
        el.attrs[spec.attr] = spec.value;
        return el;
    });

    const document = {
        currentScript: { src: cfg.scriptSrc },
        readyState: 'complete',
        title: 'исходный заголовок',
        documentElement: makeElement('html'),
        body: { html: '', insertAdjacentHTML: function (where, html) { this.html += html; } },
        getElementById: function (id) { return elements[id] || null; },
        querySelector: function () { return null; },
        querySelectorAll: function (sel) {
            if (sel === '[data-i18n-switcher]') return slots;
            if (sel === '[data-i18n]') return i18nNodes;
            if (sel === '[data-i18n-attr]') return attrNodes;
            return [];
        },
        createElement: makeElement,
        addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
        dispatchEvent: function (ev) {
            (docListeners[ev.type] || []).forEach(function (fn) { fn(ev); });
            result.events.push(ev.type);
            return true;
        }
    };

    const panel = makeElement('div');
    panel.querySelectorAll = function (sel) {
        return sel === '[data-burger-key]' ? BURGER_KEYS.map(function (k) { return keyEls[k]; }) : [];
    };
    elements.sidePanel = panel;
    elements.sidePanelOverlay = makeElement('div');

    const win = {
        document: document,
        location: {
            href: cfg.href, search: cfg.search || '', pathname: cfg.pathname || PAGE_PATH,
            hostname: 'example.github.io',
            replace: function (url) { result.replaced = url; }
        },
        localStorage: {
            getItem: function (k) { return store.has(k) ? store.get(k) : null; },
            setItem: function (k, v) { store.set(k, String(v)); }
        },
        console: { warn: function () {}, error: function () {}, log: function () {} },
        fetch: function (url) {
            result.fetched.push(String(url));
            const name = String(url).split('/').pop().replace(/\.json.*$/, '');
            const data = name === 'index' ? cfg.manifest : (cfg.dicts || {})[name];
            if (!data) return Promise.resolve({ ok: false, status: 404 });
            return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
        },
        CustomEvent: function (type, init) { this.type = type; this.detail = (init || {}).detail; },
        URL: URL,
        URLSearchParams: URLSearchParams
    };

    const context = vm.createContext({
        window: win, document: document, console: win.console, fetch: win.fetch,
        URL: URL, URLSearchParams: URLSearchParams, Promise: Promise, CustomEvent: win.CustomEvent
    });

    return {
        window: win, document: document, slots: slots, result: result, context: context,
        keyEls: keyEls, store: store, i18nNodes: i18nNodes, attrNodes: attrNodes
    };
}

function boot(cfg, script) {
    const env = makeEnv(cfg);
    vm.runInContext(script, env.context, { filename: 'boot.js' });
    return env;
}

function css(cfg) {
    return Object.assign({
        scriptSrc: I18N_SRC, href: PAGE, pathname: PAGE_PATH, search: '', manifest: MANIFEST
    }, cfg);
}

const ABOUT_URL = 'https://example.github.io/alephy/pages/about/index.html';
const manifestWith = function (code) {
    const copy = JSON.parse(JSON.stringify(MANIFEST));
    copy.languages.forEach(function (l) { if (l.code === code) l.status = 'ready'; });
    return copy;
};

async function main() {
    // --- 1. Русский: язык разметки, словарь не грузится -----------------------
    let env = boot(css({}), I18N);
    const api = env.window.AlephyI18n;
    await api.init();

    check('API рантайма загружен', !!api && typeof api.t === 'function' && typeof api.onChange === 'function');
    check('ru: html[lang]=ru, html[dir]=ltr',
        env.document.documentElement.attrs.lang === 'ru' && env.document.documentElement.attrs.dir === 'ltr',
        env.document.documentElement.attrs.lang + '/' + env.document.documentElement.attrs.dir);
    check('ru: запрошен только манифест, словарь не скачивается', env.result.fetched.length === 1, env.result.fetched.join(', '));
    check('ru: локаль найдена рядом со скриптом (суб-путь /alephy/ учтён — старый баг ../locales)',
        env.result.fetched[0] === 'https://example.github.io/alephy/locales/index.json', env.result.fetched[0]);
    check('ru: заголовок вкладки остался из разметки', env.document.title === 'исходный заголовок', env.document.title);
    check('ru: [data-i18n] сохранил русский текст', env.i18nNodes[0].textContent === '◈ О проекте', env.i18nNodes[0].textContent);
    check('ru: [data-i18n-attr] не тронут', env.attrNodes[0].attrs['aria-label'] === 'Язык интерфейса', env.attrNodes[0].attrs['aria-label']);
    check('t(): русский резерв', api.t('nav.home', 'Главная') === 'Главная', api.t('nav.home', 'Главная'));
    check('t(): без резерва возвращается ключ', api.t('nav.absent') === 'nav.absent', api.t('nav.absent'));
    check('languages(): 3 языка из манифеста', api.languages().length === 3, String(api.languages().length));
    check('isReady(): ru=true, en=false, he=false',
        api.isReady('ru') === true && api.isReady('en') === false && api.isReady('he') === false);

    const select = env.slots[0].children[0];
    const options = select.children;
    check('переключатель построен (3 варианта)', options.length === 3, String(options.length));
    check('ru выбран и доступен', options[0].value === 'ru' && options[0].disabled === false && options[0].selected === true,
        options[0].value + ' selected=' + options[0].selected);
    check('en подписан как черновик и отключён', options[1].disabled === true && options[1].textContent === 'EN (в разработке)', options[1].textContent);
    check('he подписан как черновик и отключён', options[2].disabled === true && options[2].textContent === 'HE (в разработке)', options[2].textContent);
    check('aria-label переключателя', select.attrs['aria-label'] === 'Язык интерфейса', select.attrs['aria-label']);
    check('событие alephy:langchange отправлено', env.result.events.indexOf('alephy:langchange') !== -1, env.result.events.join(','));

    api.applyTranslations(env.document);
    check('повторный applyTranslations не дублирует переключатель',
        env.slots[0].children.length === 1 && select.children.length === 3,
        String(env.slots[0].children.length) + ' контейнер / ' + String(select.children.length) + ' опций');
    check('switchLanguage("en") отклонён — статус draft', api.switchLanguage('en') === false);
    check('switchLanguage("he") отклонён — статус draft', api.switchLanguage('he') === false);
    check('switchLanguage("ru") — переход без ?lang (хеш лабы сохраняется)',
        api.switchLanguage('ru') === true && env.result.replaced === PAGE, env.result.replaced);

    // --- 2. ?lang=en, но en помечен draft → откат на ru -----------------------
    env = boot(css({ search: '?lang=en', href: PAGE + '?lang=en', dicts: { en: readLocale('en') } }), I18N);
    const api2 = env.window.AlephyI18n;
    await api2.init();
    check('?lang=en при draft: откат на ru',
        api2.getCurrentLanguage() === 'ru' && env.document.documentElement.attrs.lang === 'ru', api2.getCurrentLanguage());
    check('?lang=en при draft: словарь en не скачивается', env.result.fetched.length === 1, env.result.fetched.join(', '));

    // --- 3. en помечен ready → словарь применяется -----------------------------
    const en = readLocale('en');
    env = boot(css({
        search: '?lang=en', href: ABOUT_URL + '?lang=en', pathname: '/alephy/pages/about/index.html',
        manifest: manifestWith('en'), dicts: { en: en }
    }), I18N);
    const api3 = env.window.AlephyI18n;
    await api3.init();
    check('en ready: html[lang]=en', env.document.documentElement.attrs.lang === 'en', env.document.documentElement.attrs.lang);
    check('en ready: t() берёт перевод',
        api3.t('nav.home', 'Главная') === 'Home' && api3.t('nav.home', 'Главная') === en.nav.home, api3.t('nav.home', 'Главная'));
    check('en ready: заголовок вкладки из словаря', env.document.title === en.pages.about.title, env.document.title);
    check('en ready: [data-i18n] переведён', env.i18nNodes[0].textContent === en.pages.about.heading, env.i18nNodes[0].textContent);
    check('en ready: [data-i18n-attr] переведён', env.attrNodes[0].attrs['aria-label'] === en.lang.aria, env.attrNodes[0].attrs['aria-label']);
    check('en ready: скачаны манифест и словарь en',
        env.result.fetched.length === 2 && /\/locales\/en\.json$/.test(env.result.fetched[1]), env.result.fetched.join(', '));
    check('en ready: выбор сохранён в localStorage', env.store.get('alephy-lang') === 'en', env.store.get('alephy-lang'));
    const enOptions = env.slots[0].children[0].children;
    check('en ready: en выбран, he подписан переводом черновика',
        enOptions[1].disabled === false && enOptions[1].selected === true && enOptions[2].textContent === 'HE (' + en.lang.draft + ')',
        enOptions.map(function (o) { return o.textContent; }).join(' | '));

    // --- 4. he помечен ready → RTL --------------------------------------------
    const he = readLocale('he');
    env = boot(css({ search: '?lang=he', href: PAGE + '?lang=he', manifest: manifestWith('he'), dicts: { he: he } }), I18N);
    const api4 = env.window.AlephyI18n;
    await api4.init();
    check('he ready: html[lang]=he', env.document.documentElement.attrs.lang === 'he', env.document.documentElement.attrs.lang);
    check('he ready: html[dir]=rtl', env.document.documentElement.attrs.dir === 'rtl', env.document.documentElement.attrs.dir);
    check('he ready: t() берёт иврит', api4.t('nav.home', 'Главная') === he.nav.home, api4.t('nav.home', 'Главная'));
    check('he ready: заголовок вкладки из словаря (pages.tanakh.title)',
        env.document.title === he.pages.tanakh.title, env.document.title);

    // --- 5. Локали недоступны → страница живёт на русском ----------------------
    env = boot(css({ manifest: null }), I18N);
    const api5 = env.window.AlephyI18n;
    let threw = null;
    try { await api5.init(); } catch (error) { threw = error; }
    check('404 локалей: init не бросает исключение', threw === null, threw && threw.message);
    check('404 локалей: язык остаётся ru', api5.getCurrentLanguage() === 'ru', api5.getCurrentLanguage());
    check('404 локалей: русский текст не затёрт', env.i18nNodes[0].textContent === '◈ О проекте', env.i18nNodes[0].textContent);
    check('404 локалей: резерв t() работает', api5.t('nav.lab', '🔬 Лаборатория') === '🔬 Лаборатория');
    const fallbackOptions = env.slots[0].children[0].children;
    check('404 локалей: переключатель деградирует до одного RU',
        fallbackOptions.length === 1 && fallbackOptions[0].value === 'ru' && fallbackOptions[0].disabled === false,
        fallbackOptions.map(function (o) { return o.textContent; }).join(' | '));
    check('404 локалей: смена языка недоступна', api5.switchLanguage('en') === false && env.result.replaced === null);

    // --- 6. Бургер-меню без i18n.js → русские резервы, без ReferenceError -----
    env = boot(css({ scriptSrc: BURGER_SRC }), BURGER);
    threw = null;
    try { env.document.dispatchEvent({ type: 'DOMContentLoaded' }); } catch (error) { threw = error; }
    const burgerHtml = env.document.body.html;
    check('burger без i18n.js: панель построена без исключения', threw === null, threw && threw.message);
    check('burger: слот переключателя отдан рантайму', burgerHtml.indexOf('data-i18n-switcher') !== -1);
    check('burger: нет inline-обработчика AlephyI18n (старый ReferenceError)', burgerHtml.indexOf('AlephyI18n') === -1);
    check('burger: русские резервы', burgerHtml.indexOf('>АЛЕФИ<') !== -1 && burgerHtml.indexOf('🔬 Лаборатория') !== -1);
    check('burger: ссылки абсолютные от корня сайта',
        burgerHtml.indexOf('https://example.github.io/alephy/pages/research/methods.html') !== -1 &&
        burgerHtml.indexOf('https://example.github.io/alephy/apps/researchlab/index.html') !== -1);

    // --- 7. Живое переключение меню ru → en по событию -------------------------
    env = boot(css({ dicts: { en: en } }), I18N);
    const api6 = env.window.AlephyI18n;
    env.document.currentScript = { src: BURGER_SRC };
    vm.runInContext(BURGER, env.context, { filename: 'burger-menu.js' });
    await api6.init();
    env.document.dispatchEvent({ type: 'DOMContentLoaded' });
    check('burger: тексты взяты из русского резерва', env.keyEls.tanakh.textContent === 'Чтение ТаНаХа', env.keyEls.tanakh.textContent);
    const seen = [];
    api6.onChange(function (detail) { seen.push(detail.lang); });
    await api6.loadLanguage('en');
    check('burger: меню переключилось на en по alephy:langchange',
        env.keyEls.tanakh.textContent === en.nav.tanakh && env.keyEls.lab.textContent === en.nav.lab,
        env.keyEls.tanakh.textContent + ' / ' + env.keyEls.lab.textContent);
    check('onChange(): слушатель получил detail.lang=en', seen.indexOf('en') !== -1, seen.join(','));
    check('burger: переключатель в панели отрисован рантаймом',
        env.slots[0].children.length === 1 && env.slots[0].children[0].children.length === 3,
        String(env.slots[0].children[0].children.length));

    console.log('');
    console.log(fails === 0 ? 'ИТОГ: все проверки пройдены' : 'ИТОГ: провалено проверок — ' + fails);
    process.exitCode = fails === 0 ? 0 : 1;
}

main().catch(function (error) {
    console.error('Ошибка прогона: ' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
});

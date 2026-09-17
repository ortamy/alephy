// js/burger-menu.js — боковая панель (гамбургер).
//
// Тексты берутся из AlephyI18n с русским резервом: меню обязано строиться,
// даже если i18n.js не подключён или манифест локалей недоступен.
// currentScript валиден только во время синхронного выполнения — захватываем сразу.
var burgerMenuScriptEl = document.currentScript || document.querySelector('script[src*="burger-menu.js"]');

var BURGER_FALLBACK = {
    home: 'Главная',
    tanakh: 'Чтение ТаНаХа',
    research: 'Исследования',
    methods: 'Методы разоблачения',
    dictionaries: 'Словари',
    methodology: 'Методология',
    tools: 'Инструменты',
    lab: '🔬 Лаборатория',
    about: 'О проекте',
    logo: 'АЛЕФИ'
};

var BURGER_KEYS = {
    home: 'nav.home',
    tanakh: 'nav.tanakh',
    research: 'nav.research',
    methods: 'nav.methods',
    dictionaries: 'nav.dictionaries',
    methodology: 'nav.methodology',
    tools: 'nav.tools',
    lab: 'nav.lab',
    about: 'nav.about',
    logo: 'site.name'
};

// Порядок пунктов меню и путь от корня сайта (префикс подставляется на месте).
var BURGER_ITEMS = [
    ['home', 'index.html'],
    ['tanakh', 'pages/tanakh/index.html'],
    ['research', 'pages/research/index.html'],
    ['methods', 'pages/research/methods.html'],
    ['dictionaries', 'pages/research/dictionaries.html'],
    ['methodology', 'pages/research/methodology.html'],
    ['tools', 'pages/tools/index.html'],
    ['lab', 'apps/researchlab/index.html'],
    ['about', 'pages/about/index.html']
];

function burgerText(key) {
    var russian = BURGER_FALLBACK[key] || '';
    var i18n = window.AlephyI18n;
    if (i18n && typeof i18n.t === 'function' && BURGER_KEYS[key]) {
        return i18n.t(BURGER_KEYS[key], russian);
    }
    return russian;
}

function buildBurgerMenu(prefix) {
    var rtl = document.documentElement.dir === 'rtl';
    var html = '<div class="side-panel-overlay" id="sidePanelOverlay" onclick="toggleSidePanel()"></div>' +
        '<div class="side-panel" id="sidePanel"' + (rtl ? ' style="direction:rtl;text-align:right"' : '') + '>' +
        '  <div class="side-panel-header">' +
        '    <span class="logo-text" data-burger-key="logo">' + burgerText('logo') + '</span>' +
        '    <button class="side-panel-close" onclick="toggleSidePanel()">✕</button>' +
        '  </div>' +
        '  <div class="side-panel-links">';
    for (var i = 0; i < BURGER_ITEMS.length; i++) {
        var key = BURGER_ITEMS[i][0];
        html += '    <a href="' + prefix + BURGER_ITEMS[i][1] + '" data-burger-key="' + key + '">' +
            burgerText(key) + '</a>';
    }
    // Переключатель языка строит рантайм i18n: одна реализация на сайт и лабу.
    html += '  </div>' +
        '  <div class="side-panel-lang-switcher" data-i18n-switcher></div>' +
        '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
}

function refreshBurgerMenu() {
    var panel = document.getElementById('sidePanel');
    if (!panel) return;
    var nodes = panel.querySelectorAll('[data-burger-key]');
    for (var i = 0; i < nodes.length; i++) {
        nodes[i].textContent = burgerText(nodes[i].getAttribute('data-burger-key'));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!burgerMenuScriptEl || !burgerMenuScriptEl.src) return;
    // Путь к самому скрипту (../../js/burger-menu.js) браузер резолвит в абсолютный,
    // поэтому префикс корректен и при суб-пути хостинга (/alephy/), и на любой глубине страницы.
    buildBurgerMenu(new URL('../', burgerMenuScriptEl.src).href);

    // Язык может примениться позже (манифест локалей грузится асинхронно):
    // слушаем событие, а не полагаемся на порядок тегов <script>.
    document.addEventListener('alephy:langchange', refreshBurgerMenu);
    refreshBurgerMenu();
});

function toggleSidePanel() {
    document.getElementById('sidePanel').classList.toggle('open');
    document.getElementById('sidePanelOverlay').classList.toggle('show');
}

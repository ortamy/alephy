// js/i18n.js — рантайм локализации Alephy
//
// ES5, без зависимостей: один файл обслуживает публичные страницы и Research Lab.
// Контракт ключей зафиксирован под экстрактор (tools/i18n-extract.py, фаза 1):
//   t('nav.home', 'Главная') — ключ из словаря, иначе русский резерв;
//   t('Какой-то текст')      — русский текст как ключ (phrases.<текст>, фаза 3);
//   data-i18n="nav.home"     — текст элемента;
//   data-i18n-attr="aria-label:lang.aria;title:nav.title" — атрибуты;
//   data-i18n-switcher       — контейнер, который рантайм наполняет переключателем языка.
//
// Правила, которые нельзя нарушать:
//   * русский — язык разметки: для ru словарь не грузится (ноль лишних запросов, нет мигания),
//     поэтому у элементов с data-i18n русский текст обязан оставаться на месте;
//   * язык живёт в localStorage.alephy-lang и в ?lang=, но не в хеше: хеш принадлежит роутеру
//     лабы (#route), и переключение языка не должно ломать deep-link;
//   * недоступность локалей не ломает страницу: разметка уже на русском, ошибки тихие
//     (предупреждения только на localhost), потому что smoke-прогон падает на console.error.
(function (global) {
    'use strict';

    var STORAGE_KEY = 'alephy-lang';
    var DEFAULT_LANG = 'ru';
    var DRAFT_KEY = 'lang.draft';

    // До загрузки манифеста: коды, для которых точно известна раскладка.
    var KNOWN_DIRS = { ru: 'ltr', en: 'ltr', he: 'rtl' };

    // currentScript валиден только во время синхронного выполнения — захватываем сразу.
    var selfScript = document.currentScript || document.querySelector('script[src*="i18n.js"]');

    var state = {
        current: DEFAULT_LANG,
        languages: [],
        dict: {},
        error: null
    };
    var listeners = [];
    var startPromise = null;

    function warn(message) {
        var host = global.location ? global.location.hostname : '';
        var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
        if (isLocal && global.console && global.console.warn) {
            global.console.warn('[i18n] ' + message);
        }
    }

    // Локали ищутся рядом со скриптом: build/js/i18n.js → build/locales/.
    // Абсолютный src уже учитывает и суб-путь хостинга (/alephy/), и глубину страницы,
    // поэтому загрузка не зависит от того, с какого уровня вложенности открыта страница.
    function scriptBase() {
        if (!selfScript || !selfScript.src) return '';
        return selfScript.src.replace(/js\/i18n\.js(\?.*)?$/, '');
    }

    function localeUrl(file) {
        return scriptBase() + 'locales/' + file;
    }

    function fetchJSON(url) {
        return fetch(url).then(function (response) {
            if (!response.ok) throw new Error(url + ' → HTTP ' + response.status);
            return response.json();
        });
    }

    function get(source, path) {
        if (!source || !path) return undefined;
        var parts = String(path).split('.');
        var node = source;
        for (var i = 0; i < parts.length; i++) {
            if (node === null || typeof node !== 'object') return undefined;
            node = node[parts[i]];
        }
        return node;
    }

    function trim(value) {
        return String(value).replace(/^\s+|\s+$/g, '');
    }

    function normalize(code) {
        return typeof code === 'string' ? code.toLowerCase().split('-')[0] : '';
    }

    function known(code) {
        return Object.prototype.hasOwnProperty.call(KNOWN_DIRS, code);
    }

    function entry(code) {
        for (var i = 0; i < state.languages.length; i++) {
            if (state.languages[i].code === code) return state.languages[i];
        }
        return null;
    }

    // status=draft в locales/index.json = неполный перевод не выходит к пользователю.
    function isReady(code) {
        var item = entry(code);
        if (item) return item.status === 'ready';
        return code === DEFAULT_LANG;
    }

    function languages() {
        return state.languages.slice();
    }

    function t(key, fallback) {
        if (!key) return typeof fallback === 'string' ? fallback : '';
        var value = get(state.dict, key);
        if (typeof value === 'string' && value) return value;
        var phrase = get(state.dict, 'phrases.' + key);
        if (typeof phrase === 'string' && phrase) return phrase;
        return typeof fallback === 'string' ? fallback : key;
    }

    function applyDocumentLang(code) {
        var root = global.document && global.document.documentElement;
        if (!root) return;
        var item = entry(code);
        root.setAttribute('lang', code);
        root.setAttribute('dir', (item && item.dir) || KNOWN_DIRS[code] || 'ltr');
    }

    // Ключ страницы берётся из имени каталога, а не из последнего сегмента URL:
    // иначе «каталожные» адреса (/pages/about/index.html) все сводились бы к pages.index.title
    // и каждая страница получала бы заголовок лендинга.
    function currentPage() {
        var parts = String(global.location.pathname || '').replace(/\/+$/, '').split('/');
        var last = parts.pop() || '';
        if (!last || last === 'index.html') last = parts.pop() || '';
        return last.replace(/\.html$/, '') || 'index';
    }

    function renderSwitchers(root) {
        var scope = root || global.document;
        if (!scope || !scope.querySelectorAll) return;
        var slots = scope.querySelectorAll('[data-i18n-switcher]');
        for (var i = 0; i < slots.length; i++) buildSwitcher(slots[i]);
    }

    function buildSwitcher(slot) {
        var list = state.languages.length
            ? state.languages
            : [{ code: DEFAULT_LANG, label: 'RU', status: 'ready' }];
        var select = slot.querySelector('select');
        if (!select) {
            while (slot.firstChild) slot.removeChild(slot.firstChild);
            select = global.document.createElement('select');
            slot.appendChild(select);
        }
        while (select.firstChild) select.removeChild(select.firstChild);
        for (var i = 0; i < list.length; i++) {
            var option = global.document.createElement('option');
            option.value = list[i].code;
            option.disabled = list[i].status !== 'ready';
            option.textContent = option.disabled
                ? list[i].label + ' (' + t(DRAFT_KEY, 'в разработке') + ')'
                : list[i].label;
            option.selected = list[i].code === state.current;
            select.appendChild(option);
        }
        select.setAttribute('aria-label', t('lang.aria', 'Язык интерфейса'));
        if (select.getAttribute('data-i18n-bound') !== '1') {
            select.setAttribute('data-i18n-bound', '1');
            select.addEventListener('change', function () { switchLanguage(this.value); });
        }
    }

    function applyTranslations(root) {
        var scope = root || global.document;
        if (!scope || !scope.querySelectorAll) return;
        var nodes, i, j, pairs, pair, value;

        nodes = scope.querySelectorAll('[data-i18n]');
        for (i = 0; i < nodes.length; i++) {
            value = get(state.dict, trim(nodes[i].getAttribute('data-i18n')));
            if (typeof value === 'string' && value) nodes[i].textContent = value;
        }

        nodes = scope.querySelectorAll('[data-i18n-attr]');
        for (i = 0; i < nodes.length; i++) {
            pairs = String(nodes[i].getAttribute('data-i18n-attr')).split(';');
            for (j = 0; j < pairs.length; j++) {
                pair = pairs[j].split(':');
                if (pair.length !== 2) continue;
                value = get(state.dict, trim(pair[1]));
                if (typeof value === 'string' && value) nodes[i].setAttribute(trim(pair[0]), value);
            }
        }

        var pageTitle = get(state.dict, 'pages.' + currentPage() + '.title');
        if (pageTitle) global.document.title = pageTitle;

        var siteName = get(state.dict, 'site.name');
        if (siteName) {
            var logos = global.document.querySelectorAll('.logo a, .logo-text');
            for (i = 0; i < logos.length; i++) logos[i].textContent = siteName;
        }

        renderSwitchers(scope);
    }

    function emit() {
        var detail = { lang: state.current, dict: state.dict, languages: languages() };
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](detail); } catch (error) { warn('слушатель упал: ' + error.message); }
        }
        if (global.document && global.document.dispatchEvent) {
            try {
                global.document.dispatchEvent(new global.CustomEvent('alephy:langchange', { detail: detail }));
            } catch (error) { warn('CustomEvent недоступен'); }
        }
    }

    function onChange(handler) {
        if (typeof handler === 'function') listeners.push(handler);
    }

    function loadLanguage(code) {
        var lang = normalize(code) || state.current;
        return fetchJSON(localeUrl(lang + '.json')).then(function (data) {
            state.dict = data && typeof data === 'object' ? data : {};
            state.current = lang;
            if (state.dict.dir) KNOWN_DIRS[lang] = state.dict.dir;
            applyDocumentLang(lang);
            try { global.localStorage.setItem(STORAGE_KEY, lang); } catch (error) { warn('localStorage недоступен'); }
            applyTranslations(global.document);
            emit();
            return true;
        });
    }

    function resolveLang() {
        var code = '';
        try {
            code = normalize(new global.URLSearchParams(global.location.search).get('lang'));
        } catch (error) { code = ''; }
        if (!known(code)) {
            try { code = normalize(global.localStorage.getItem(STORAGE_KEY)); } catch (error) { code = ''; }
        }
        return known(code) ? code : DEFAULT_LANG;
    }

    function init() {
        if (startPromise) return startPromise;
        startPromise = fetchJSON(localeUrl('index.json')).then(function (manifest) {
            state.languages = (manifest && manifest.languages) || [];
            var lang = resolveLang();
            if (!isReady(lang)) {
                if (lang !== DEFAULT_LANG) warn('язык "' + lang + '" помечен как draft — используется ' + DEFAULT_LANG);
                lang = DEFAULT_LANG;
            }
            state.current = lang;
            if (lang === DEFAULT_LANG) {
                // Русский — язык разметки: словарь не нужен, лишний запрос не делаем.
                applyDocumentLang(lang);
                applyTranslations(global.document);
                emit();
                return false;
            }
            return loadLanguage(lang);
        }).catch(function (error) {
            state.error = error;
            warn('инициализация: ' + (error && error.message ? error.message : error));
            applyDocumentLang(state.current);
            applyTranslations(global.document);
            emit();
            return false;
        });
        return startPromise;
    }

    function switchLanguage(code) {
        var lang = normalize(code);
        if (!known(lang)) return false;
        if (!isReady(lang)) {
            warn('переключение на "' + lang + '" отклонено: статус draft');
            return false;
        }
        var url = new global.URL(global.location.href);
        if (lang === DEFAULT_LANG) url.searchParams.delete('lang');
        else url.searchParams.set('lang', lang);
        try { global.localStorage.setItem(STORAGE_KEY, lang); } catch (error) { warn('localStorage недоступен'); }
        // replace, а не reload: хеш лабы (#route) сохраняется, «назад» не возвращает в старый язык.
        global.location.replace(url.toString());
        return true;
    }

    global.AlephyI18n = {
        init: init,
        t: t,
        applyTranslations: applyTranslations,
        renderSwitchers: renderSwitchers,
        loadLanguage: loadLanguage,
        switchLanguage: switchLanguage,
        languages: languages,
        isReady: isReady,
        onChange: onChange,
        currentPage: currentPage,
        getCurrentLanguage: function () { return state.current; },
        getTranslations: function () { return state.dict; }
    };

    // Раскладка ставится синхронно, до DOMContentLoaded: иначе RTL и бургер-меню
    // успевают отработать на «ru».
    applyDocumentLang(resolveLang());

    function start() { init(); }
    if (global.document && global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})(window);

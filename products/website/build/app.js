// web/app.js — Alephy Web Interface v11.0 (модульная архитектура)

(function() {
    'use strict';

    // Загрузка модулей
    const AlephyState = window.AlephyState;
    const AlephyAPI = window.AlephyAPI;
    const AlephyUI = window.AlephyUI;
    const AlephyParser = window.AlephyParser;

    if (!AlephyState || !AlephyAPI || !AlephyUI || !AlephyParser) {
        console.error('Ошибка: не все модули загружены');
        return;
    }

    const IS_LOCAL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Инициализация
    AlephyState.loadFromStorage();
    AlephyUI.setFontSize(AlephyState.state.fontSize);

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Ошибка загрузки — текстовый узел: путь из state мог содержать кавычки,
    // а раньше он попадал в разметку через esc().
    function showError(host, p) {
        const box = document.createElement('div');
        box.style.color = '#c0392b';
        box.style.padding = '40px';
        box.textContent = 'Ошибка: ' + p;
        host.replaceChildren(box);
    }

    // Имя иконки приходит из files.json и уходит в src картинки: без whitelist
    // строка с кавычками дала бы произвольный атрибут.
    function contentIcon(file) {
        if (!file || !file.icon || file.icon === 'scrolls.png') return '';
        if (!/^[A-Za-z0-9._-]+$/.test(file.icon)) return '';
        return '<img src="assets/icons/32/' + file.icon + '" class="content-icon" alt="" style="width:28px;height:28px;vertical-align:middle;margin-right:10px;">';
    }

    // Markdown рендерится парсером, который экранирует каждую строку (escHtml),
    // поэтому это единственная оставшаяся точка разбора строки в разметку.
    function appendMarkdown(host, md, icon) {
        const holder = document.createElement('div');
        holder.innerHTML = AlephyParser.parseMD(md, icon);
        while (holder.firstChild) host.appendChild(holder.firstChild);
    }

    function openFile(p) {
        AlephyState.state.currentPath = p;
        
        if (AlephyUI.isMobile()) {
            const filePage = document.getElementById('file-page');
            const filePathHint = document.getElementById('file-path-hint');
            const bm = document.getElementById('file-bookmark-btn');
            const isBm = AlephyState.isBookmarked(p);
            
            filePage.style.display = 'block';
            filePathHint.textContent = p;
            bm.textContent = isBm ? '★' : '☆';
            bm.className = 'bookmark-btn' + (isBm ? ' active' : '');
            bm.addEventListener('click', function() { toggleBookmark(p); });
            document.getElementById('mobile-list-view').style.display = 'none';
            document.getElementById('stats-mobile').style.display = 'none';
        } else {
            const c = document.getElementById('content');
            c.classList.remove('fade-in');
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            c.replaceChildren(spinner);
        }
        
        AlephyAPI.loadFile(p, function(md) {
            const isBm = AlephyState.isBookmarked(p);
            const file = AlephyState.state.FILES.find(function(x) { return x.path === p; });
            
            if (AlephyUI.isMobile()) {
                const c = document.getElementById('file-content-mobile');
                c.replaceChildren();
                appendMarkdown(c, md, contentIcon(file));
                const related = AlephyUI.renderRelatedMobile(p);
                if (related) c.appendChild(related);
            } else {
                const c = document.getElementById('content');
                c.replaceChildren();
                const crumbs = document.createElement('div');
                crumbs.id = 'breadcrumbs';
                const crumbsNode = AlephyUI.renderBreadcrumbs(p);
                if (crumbsNode) crumbs.appendChild(crumbsNode);
                c.appendChild(crumbs);
                const hint = document.createElement('div');
                hint.className = 'path-hint';
                hint.appendChild(document.createTextNode(p + ' '));
                const star = document.createElement('span');
                star.className = 'bookmark-btn' + (isBm ? ' active' : '');
                star.textContent = isBm ? '★' : '☆';
                star.addEventListener('click', function() { toggleBookmark(p); });
                hint.appendChild(star);
                c.appendChild(hint);
                appendMarkdown(c, md, contentIcon(file));
                const related = AlephyUI.renderRelated(p);
                if (related) c.appendChild(related);
                AlephyState.addToHistory(p);
                AlephyUI.buildTOC(md);
                AlephyUI.setupQuoteCopy();
                void c.offsetWidth;
                c.classList.add('fade-in');
            }
            AlephyState.addToHistory(p);
        }, function() { 
            showError(AlephyUI.isMobile()
                ? document.getElementById('file-content-mobile')
                : document.getElementById('content'), p);
        });
    }

    function toggleBookmark(p) {
        if (!p) return;
        AlephyState.toggleBookmark(p);
        if (AlephyUI.isMobile()) {
            const bm = document.getElementById('file-bookmark-btn');
            const isBm = AlephyState.isBookmarked(p);
            bm.textContent = isBm ? '★' : '☆';
            bm.className = 'bookmark-btn' + (isBm ? ' active' : '');
        } else {
            openFile(p);
        }
    }

    function randomFile() {
        if (!AlephyState.state.FILES.length) return;
        AlephyUI.closeBurger();
        const p = AlephyState.state.FILES[Math.floor(Math.random() * AlephyState.state.FILES.length)].path;
        openFile(p);
    }

    function copyCurrentLink() {
        if (!AlephyState.state.currentPath) return;
        const u = window.location.origin + (IS_LOCAL ? '/api/file?path=' : '/') + encodeURIComponent(AlephyState.state.currentPath);
        navigator.clipboard.writeText(u).then(AlephyUI.showToast);
    }

    // Обработчик ресайза
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', function() {
        const w = window.innerWidth;
        if ((lastWidth <= 768) !== (w <= 768)) {
            lastWidth = w;
            if (AlephyState.state.FILES.length) {
                AlephyUI.render();
            }
        } else {
            lastWidth = w;
        }
    });

    // Инициализация
    AlephyUI.setFontSize(AlephyState.state.fontSize);
    window.addEventListener('scroll', AlephyUI.updateProgressBar);
    window.addEventListener('scroll', function() {
        const bt = document.getElementById('back-to-top'); 
        if (bt) bt.style.display = window.scrollY > 400 ? 'flex' : 'none';
    });

    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const m = AlephyUI.isMobile();
        if (e.key === '/') { 
            const s = m ? document.getElementById('search-mobile') : document.getElementById('search'); 
            if (s) s.focus(); 
            e.preventDefault(); 
        }
        if (e.key === 'Escape') { 
            if (m && AlephyState.state.currentPath) AlephyUI.closeFile(); 
            else { 
                const s2 = m ? document.getElementById('search-mobile') : document.getElementById('search'); 
                if (s2) s2.blur(); 
            } 
        }
        if (e.key === 'b' && AlephyState.state.currentPath) toggleBookmark(AlephyState.state.currentPath);
        if (e.key === 'r') randomFile();
    });

    // Экспорт функций в window для HTML обработчиков
    window.toggleBurger = AlephyUI.toggleBurger;
    window.closeBurger = AlephyUI.closeBurger;
    window.randomFile = randomFile;
    window.copyCurrentLink = copyCurrentLink;
    window.toggleBookmark = toggleBookmark;
    window.closeFile = AlephyUI.closeFile;
    window.render = AlephyUI.render;
    window.setFontSize = AlephyUI.setFontSize;
    window.openFile = openFile;

    // Загрузка данных
    AlephyAPI.scanFiles(function(data) {
        AlephyState.state.FILES = data;
        AlephyUI.buildSelects();
        
        // Debounce для поиска
        const searchInput = document.getElementById('search');
        const searchMobile = document.getElementById('search-mobile');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(function() {
                AlephyState.state.filteredCache = null;
                AlephyUI.render();
            }, 300));
        }
        if (searchMobile) {
            searchMobile.addEventListener('input', debounce(function() {
                AlephyState.state.filteredCache = null;
                AlephyUI.render();
            }, 300));
        }
        
        AlephyUI.render();
    
        // Open file from hash
        const hash = window.location.hash;
        if (hash && hash.indexOf('#open=') === 0) {
            const filePath = decodeURIComponent(hash.substring(6));
            setTimeout(function() {
                openFile(filePath);
            }, 100);
        }
    }, function(e) {
        console.error(e.message);
        const el = AlephyUI.isMobile() ? document.getElementById('mobile-list-view') : document.getElementById('file-list');
        if (el) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding:20px;color:#c0392b;';
            errorDiv.textContent = 'Ошибка загрузки';
            el.replaceChildren(errorDiv);
        }
    });

    // Глобальный обработчик ошибок
    window.addEventListener('error', function(e) {
        console.error('Глобальная ошибка:', e.error);
    });

    window.addEventListener('unhandledrejection', function(e) {
        console.error('Необработанный Promise rejection:', e.reason);
    });

})();

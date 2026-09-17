// js/ui.js — UI функции и рендеринг
(function(global) {
    'use strict';

    const AlephyState = global.AlephyState;
    const AlephyParser = global.AlephyParser;
    const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2000}-\u{27B0}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{2934}-\u{2935}\u{25AA}-\u{25AB}\u{25FB}-\u{25FE}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2764}\u{2714}\u{2716}\u{303D}\u{2122}\u{00A9}\u{00AE}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25B6}\u{25C0}\u{3030}\u{3297}\u{3299}]+/gu;

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function renderTitle(file) {
        let title = file.title || file.path;
        title = title.replace(EMOJI_REGEX, '').trim();
        if (file.icon && file.icon !== 'scrolls.png') {
            const iconPath = '../../assets/icons/32/' + file.icon;
            return '<img src="' + iconPath + '" class="icon" alt="' + esc(file.category || 'Иконка') + '" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;">' + esc(title);
        }
        return esc(title);
    }

    function renderBreadcrumbs(p) {
        const parts = p.split('/');
        const container = document.createElement('div');
        // Хлебная крошка — тоже текст интерфейса: берём перевод, если рантайм i18n подключён.
        const i18n = global.AlephyI18n;
        container.textContent = i18n && typeof i18n.t === 'function' ? i18n.t('nav.home', 'Главная') : 'Главная';
        for (let i = 0; i < parts.length; i++) {
            const sep = document.createElement('span');
            sep.className = 'bc-sep';
            sep.textContent = '›';
            container.appendChild(document.createTextNode(' '));
            container.appendChild(sep);
            container.appendChild(document.createTextNode(' ' + parts[i].replace('.md', '')));
        }
        return container.innerHTML;
    }

    function buildSelects() {
        const counts = {}, cats = [];
        AlephyState.state.FILES.forEach(function(f) {
            if (!counts[f.category]) { counts[f.category] = 0; cats.push(f.category); }
            counts[f.category]++;
        });
        cats.sort();
        ['category-select', 'category-select-mobile'].forEach(function(elId) {
            const sel = $(elId); if (!sel) return;
            const val = sel.value;
            sel.innerHTML = '<option value="">Все категории</option>';
            cats.forEach(function(cat) { 
                sel.innerHTML += '<option value="' + esc(cat) + '">' + esc(cat) + ' (' + counts[cat] + ')</option>'; 
            });
            if (val) sel.value = val;
        });
    }

    function getFiltered() {
        if (AlephyState.state.filteredCache) return AlephyState.state.filteredCache;
        const m = isMobile();
        let q = m ? $('search-mobile') : $('search');
        let cat = m ? $('category-select-mobile') : $('category-select');
        let sub = m ? $('subcategory-select-mobile') : $('subcategory-select');
        q = q ? q.value.toLowerCase() : '';
        cat = cat ? cat.value : '';
        sub = sub ? sub.value : '';

        let list = AlephyState.state.FILES;
        if (cat) list = list.filter(function(f) { return f.category === cat; });
        if (sub) list = list.filter(function(f) { return f.subcategory === sub; });
        if (q) list = list.filter(function(f) {
            return (f.title || '').toLowerCase().indexOf(q) >= 0 || 
                   (f.topic || '').toLowerCase().indexOf(q) >= 0 || 
                   (f.path || '').toLowerCase().indexOf(q) >= 0;
        });

        const ss = m ? $('subcategory-select-mobile') : $('subcategory-select');
        if (ss && cat) {
            const subs = {};
            AlephyState.state.FILES.forEach(function(f) { 
                if (f.category === cat && f.subcategory) subs[f.subcategory] = true; 
            });
            const sn = Object.keys(subs).sort();
            if (sn.length) {
                const cur = ss.value;
                ss.style.display = 'block';
                ss.innerHTML = '<option value="">Все подкатегории</option>';
                sn.forEach(function(s) { 
                    ss.innerHTML += '<option value="' + esc(s) + '"' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; 
                });
            } else { 
                ss.style.display = 'none'; 
                ss.value = ''; 
            }
        } else if (ss) { 
            ss.style.display = 'none'; 
            ss.value = ''; 
        }

        AlephyState.state.filteredCache = list;
        return list;
    }

    function isMobile() { 
        return window.innerWidth <= 768; 
    }

    function renderList(container, itemClass, headerClass, clickHandler) {
        if (!container) return;
        container.innerHTML = '';
        const filtered = getFiltered();
        let cc = '';
        filtered.forEach(function(f) {
            if (f.category !== cc) {
                cc = f.category;
                const h = document.createElement('div'); 
                h.className = headerClass; 
                h.textContent = cc;
                container.appendChild(h);
            }
            const d = document.createElement('div'); 
            d.className = itemClass;
            const titleDiv = document.createElement('div');
            titleDiv.className = 'title';
            titleDiv.innerHTML = renderTitle(f);
            d.appendChild(titleDiv);
            if (f.topic) {
                const topicDiv = document.createElement('div');
                topicDiv.className = 'topic';
                topicDiv.textContent = (f.topic || '').substring(0, 90);
                d.appendChild(topicDiv);
            }
            d.onclick = (function(p) { 
                return function() { clickHandler(p); }; 
            })(f.path);
            container.appendChild(d);
        });
        const statsEl = isMobile() ? $('stats-mobile') : $('total-count');
        if (statsEl) statsEl.textContent = filtered.length;
    }

    function render() {
        AlephyState.state.filteredCache = null;
        if (isMobile()) {
            const mlv = $('mobile-list-view');
            const items = mlv.querySelectorAll('.file-item-mobile, .cat-header-mobile');
            for (let i = 0; i < items.length; i++) items[i].remove();
            renderList(mlv, 'file-item-mobile', 'cat-header-mobile', openFile);
        } else {
            renderList($('file-list'), 'file-item', 'cat-header', openFile);
            const tc = $('total-count'); 
            if (tc) tc.textContent = getFiltered().length;
        }
        renderBookmarks();
        renderHistory();
    }

    function renderBookmarks() {
        const bl = $('bookmarks-list'), bm = $('burger-bookmarks-list');
        [bl, bm].forEach(function(list) {
            if (!list) return; 
            list.innerHTML = '';
            AlephyState.state.bookmarks.forEach(function(p) {
                const d = document.createElement('div'); 
                d.className = 'bookmark-item';
                const bf = AlephyState.state.FILES.find(function(x) { return x.path === p; });
                const titleText = bf ? renderTitle(bf) : esc(p);
                const titleDiv = document.createElement('div');
                titleDiv.innerHTML = titleText;
                d.appendChild(titleDiv);
                d.onclick = function() { openFile(p); };
                list.appendChild(d);
            });
        });
        const bs = $('bookmarks-section'); 
        if (bs) bs.style.display = AlephyState.state.bookmarks.length ? 'block' : 'none';
    }

    function renderHistory() {
        const hl = $('history-list'), bh = $('burger-history-list');
        [hl, bh].forEach(function(list) {
            if (!list) return; 
            list.innerHTML = '';
            AlephyState.state.fileHistory.slice(0, 8).forEach(function(p) {
                const d = document.createElement('div'); 
                d.className = 'history-item';
                const f = AlephyState.state.FILES.find(function(x) { return x.path === p; });
                const titleText = f ? renderTitle(f) : esc((p || '').substring(0, 40));
                const titleDiv = document.createElement('div');
                titleDiv.innerHTML = titleText;
                d.appendChild(titleDiv);
                d.onclick = function() { openFile(p); };
                list.appendChild(d);
            });
        });
        const hs = $('history-section'); 
        if (hs) hs.style.display = AlephyState.state.fileHistory.length ? 'block' : 'none';
    }

    function buildTOC(md) {
        const pn = $('toc-panel'), ls = $('toc-list');
        const hd = md.match(/^#{2,3} (.+)$/gm);
        if (!hd || hd.length < 2) { 
            pn.style.display = 'none'; 
            return; 
        }
        pn.style.display = 'block'; 
        ls.innerHTML = '';
        hd.forEach(function(h) {
            const lv = h.indexOf('### ') === -1 ? 'h2' : 'h3';
            let tt = h.replace(/^#{2,3} /, '').trim();
            const cleanTt = tt.replace(/!\[icon\]\([^)]*\)/g, '').replace(EMOJI_REGEX, '').replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s-]/g, '').trim();
            const d = document.createElement('div'); 
            d.className = 'toc-item ' + lv; 
            d.textContent = tt;
            d.onclick = function() { 
                const el = $(cleanTt); 
                if (el) el.scrollIntoView({ behavior: 'smooth' }); 
            };
            ls.appendChild(d);
        });
    }

    function renderLinks(p, clickFn) {
        const f = AlephyState.state.FILES.find(function(x) { return x.path === p; });
        if (!f || !f.related || !f.related.length) return '';
        const container = document.createElement('div');
        const hr = document.createElement('hr');
        hr.className = 'meander';
        container.appendChild(hr);
        const h3 = document.createElement('h3');
        h3.textContent = 'Связанные файлы';
        container.appendChild(h3);
        const ul = document.createElement('ul');
        f.related.forEach(function(r) {
            const rf = AlephyState.state.FILES.find(function(x) { return x.path === r; });
            const tt = rf ? (rf.title || r) : r;
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.className = 'related-link';
            span.setAttribute('onclick', clickFn.name + "('" + r.replace(/'/g, "\\'") + "')");
            span.textContent = tt;
            li.appendChild(span);
            ul.appendChild(li);
        });
        container.appendChild(ul);
        return container.innerHTML;
    }

    function renderRelated(p) { 
        return renderLinks(p, openFile); 
    }
    
    function renderRelatedMobile(p) { 
        return renderLinks(p, openFile); 
    }

    function setupQuoteCopy() {
        const qs = document.querySelectorAll('#content blockquote');
        for (let i = 0; i < qs.length; i++) {
            qs[i].onclick = function() { 
                navigator.clipboard.writeText(this.textContent.trim()).then(showToast); 
            };
        }
    }

    function showToast() {
        const t = $('copy-toast'); 
        t.classList.add('show');
        setTimeout(function() { 
            t.classList.remove('show'); 
        }, 1500);
    }

    function updateProgressBar() {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const bar = $('progress-bar'); 
        if (bar) bar.style.width = scrolled + '%';
    }

    function setFontSize(size) {
        AlephyState.state.fontSize = size;
        AlephyState.saveFontSize();
        const sizes = { small: '12px', medium: '14px', large: '16px' };
        document.body.style.fontSize = sizes[size] || '14px';
        const btns = document.querySelectorAll('.font-size-btn');
        for (let i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        const ab = document.querySelector('.font-size-btn[data-size="' + size + '"]');
        if (ab) ab.classList.add('active');
    }

    function toggleBurger() { 
        $('burger-menu').classList.toggle('open'); 
        $('burger-overlay').classList.toggle('show'); 
    }
    
    function closeBurger() { 
        $('burger-menu').classList.remove('open'); 
        $('burger-overlay').classList.remove('show'); 
    }

    function closeFile() {
        $('file-page').style.display = 'none';
        $('mobile-list-view').style.display = 'block';
        $('stats-mobile').style.display = 'block';
        AlephyState.state.currentPath = null;
        render();
    }

    global.AlephyUI = {
        $,
        esc,
        renderTitle,
        renderBreadcrumbs,
        buildSelects,
        getFiltered,
        isMobile,
        renderList,
        render,
        renderBookmarks,
        renderHistory,
        buildTOC,
        renderLinks,
        renderRelated,
        renderRelatedMobile,
        setupQuoteCopy,
        showToast,
        updateProgressBar,
        setFontSize,
        toggleBurger,
        closeBurger,
        closeFile
    };

})(window);

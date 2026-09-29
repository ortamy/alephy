// products/website/config/server.js — сервер для локальной разработки
const http = require('http');
const fs = require('fs').promises;
// Синхронная проверка существования нужна отдельно: fs.promises — только async-методы,
// и fs.accessSync на ней падает с TypeError (это гасило статику в 404 и баннер).
const fsSync = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 8080;
const WEB_DIR = path.resolve(__dirname, '..');  // корень products/website/
const ROOT = WEB_DIR;                            // база статики
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

const SCAN_DIRS = [
    { folder: 'src/content/md/terminology', label: 'Терминология' },
    { folder: 'src/content/md/tanakh', label: 'ТаНаХ' },
    { folder: 'src/content/md/bashah', label: 'БаШаХ' },
    { folder: 'src/content/md/researches', label: 'Исследования' },
    { folder: 'src/content/md/teachings', label: 'Учения' },
    { folder: 'src/content/md/hebrew', label: 'Изучение иврита' },
    { folder: 'src/content/md/paleo-hebrew', label: 'Палео-иврит' },
];

const ALLOWED_FILE_FOLDERS = [
    ...SCAN_DIRS.map(({ folder }) => folder),
    'pages',
    'src/pages',
    'src/content',
];

const IGNORE_FILES = ['README.md', 'STRUCTURE.md', 'GLOSSARY.md', 'CHANGELOG.md'];

const CACHE_TTL = 5 * 60 * 1000;
let filesCache = null;
let filesCacheTime = 0;

const SUBCATEGORY_LABELS = {
    'archive': 'Архив', 'books': 'Книги', 'chronology': 'Хронология',
    'companies': 'Компании', 'concepts': 'Понятия', 'economy': 'Экономика',
    'events': 'События', 'history': 'История', 'language': 'Язык',
    'languages': 'Языки', 'manuscripts': 'Рукописи', 'media': 'Медиа',
    'medicine': 'Медицина', 'names': 'Имена', 'persons': 'Личности',
    'physis': 'Природа', 'practices': 'Практики', 'psychology': 'Психология',
    'roman-law': 'Римское право', 'science': 'Наука', 'simvolika': 'Символика',
    'slavery': 'Рабство', 'sociology': 'Общество', 'sport': 'Спорт',
    'systems': 'Системы', 'tanakh': 'ТаНаХ', 'teachings': 'Учения',
    'adam': 'Адам', 'anatomy': 'Анатомия', 'brit-nissuin': 'Брит-нисуин',
    'creation': 'Творение', 'elohim': 'Элоhим', 'geography': 'География',
    'hitgalut': 'Хитгалут', 'kehillah': 'Кеhилла', 'kelim': 'Келим',
    'makom': 'Маком', 'mikra': 'Микра', 'moadim': 'Моадим',
    'ruach': 'Руах', 'shedim': 'Шедим', 'tamid': 'Тамид',
    'behemot': 'Беhемот', 'chayot': 'Хайот', 'cholim': 'Холим',
    'leshonot': 'Лешонот', 'levushim': 'Левушим', 'makot': 'Мако́т',
    'matachot': 'Матахот', 'mavet': 'Мавет', 'meshalim': 'Мешалим',
    'misparim': 'Миспарим', 'seor': 'Сеор', 'taharah': 'Таhара',
    'techiah': 'Техия', 'avonot': 'Авонóт', 'choshech': 'Хошех',
    'kerav': 'Керав', 'nefilah': 'Нефила', 'rodefim': 'Родефим',
    'ruchot-raot': 'Рухот раот', 'shemot-shedim': 'Шемот шедим',
    'sheol': 'Шеол',
};

const ICON_RULES = {
    "content/terminology": "scroll.png", "content/researches": "book.png",
    "content/teachings": "heart.png", "content/practices": "shield.png",
    "content/hebrew": "lamp.png", "content/exposed": "sword.png",
    "content/tanakh/books": "scrolls.png", "content/tanakh/persons": "scrolls.png",
    "content/tanakh/events": "scrolls.png", "content/bashah/books": "scrolls.png",
    "content/bashah/letters": "scales.png", "content/bashah/persons": "scrolls.png",
    "content/bashah/events": "scrolls.png", "content/bashah/teachings": "heart.png",
    "content/bashah/terminology": "scroll.png", "content/bashah/concepts": "anchor.png",
    "content/bashah/practices": "shield.png", "content/bashah/chronology": "hourglass.png",
    "content/bashah/manuscripts": "scrolls.png", "content/bashah/geography": "scrolls.png",
    "content/bashah/nevua": "torch.png", "content/tzel/adam": "vase.png",
    "content/tzel/brit-nissuin": "ring.png", "content/tzel/elohim": "scrolls.png",
    "content/tzel/hitgalut": "alert.png", "content/tzel/kehillah": "scrolls.png",
    "content/tzel/kelim": "hammer-and-chisel.png", "content/tzel/makom": "scrolls.png",
    "content/tzel/mikra": "scrolls.png", "content/tzel/moadim": "track.png",
    "content/tzel/ruach": "scrolls.png", "content/tzel/shedim": "scrolls.png",
    "content/tzel/tamid": "scrolls.png",
};

function resolveIcon(relPath) {
    var sorted = Object.keys(ICON_RULES).sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < sorted.length; i++) {
        if (relPath.startsWith(sorted[i])) return ICON_RULES[sorted[i]];
    }
    return "scrolls.png";
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.md': 'text/plain; charset=utf-8', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const ALLOWED_FILE_EXTENSIONS = new Set(['.md', '.html']);

function resolveAllowedFile(requestedPath) {
    const normalizedInput = String(requestedPath || '').replace(/\\/g, '/');
    const candidate = path.resolve(ROOT, normalizedInput);
    const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
    const relative = path.relative(ROOT, candidate).replace(/\\/g, '/');
    const extension = path.extname(candidate).toLowerCase();
    const isInsideRoot = candidate === ROOT || candidate.startsWith(rootPrefix);
    const isAllowedFolder = ALLOWED_FILE_FOLDERS.some(function(folder) {
        return relative === folder || relative.startsWith(folder + '/');
    });
    if (!isInsideRoot || !isAllowedFolder || !ALLOWED_FILE_EXTENSIONS.has(extension)) {
        const error = new Error('Forbidden path');
        error.code = 'FORBIDDEN_PATH';
        throw error;
    }
    return candidate;
}

async function readFileLimited(filePath, encoding) {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) { const e = new Error('Not a file'); e.code = 'NOT_FILE'; throw e; }
    if (stat.size > MAX_RESPONSE_SIZE) { const e = new Error('Response too large'); e.code = 'RESPONSE_TOO_LARGE'; throw e; }
    return fs.readFile(filePath, encoding);
}

async function scanFiles() {
    const now = Date.now();
    if (filesCache && (now - filesCacheTime) < CACHE_TTL) return filesCache;
    const files = [];
    for (const { folder, label } of SCAN_DIRS) {
        const dirPath = path.join(ROOT, folder);
        try { await walkDir(dirPath, folder, label, files); }
        catch (e) { console.error('Ошибка сканирования папки', folder, e.message); }
    }
    filesCache = files;
    filesCacheTime = now;
    return files;
}

async function walkDir(dirPath, baseFolder, label, files) {
    let entries;
    try { entries = await fs.readdir(dirPath, { withFileTypes: true }); }
    catch (e) { return; }
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) { await walkDir(fullPath, baseFolder, label, files); }
        else if (entry.name.endsWith('.md') && !IGNORE_FILES.includes(entry.name)) {
            const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
            let content;
            try { content = await fs.readFile(fullPath, 'utf-8'); } catch (e) { continue; }
            const title = extractTitle(content) || entry.name.replace('.md', '').replace(/-/g, ' ');
            const topic = extractTopic(content);
            const related = extractRelated(content);
            const parts = relPath.split('/');
            let subcategory = '';
            if (parts.length > 3) subcategory = SUBCATEGORY_LABELS[parts[2]] || parts[2];
            files.push({ path: relPath, title: title, topic: topic, category: label, subcategory: subcategory, related: related, icon: resolveIcon(relPath) });
        }
    }
}

function extractTitle(content) {
    const match = content.match(/^#\s+(.+?)$/m);
    if (match) return match[1].replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{FE0F}]/gu, '').replace(/^\s+/, '').trim().substring(0, 80);
    return '';
}

function extractTopic(content) {
    const match = content.match(/\*\*Тема:\*\*\s*(.+?)(?:\n|$)/);
    return match ? match[1].trim().substring(0, 100) : '';
}

function extractRelated(content) {
    const sections = content.match(/\*\*Связанные файлы:\*\*[\s\S]*?(?=\n\n|$)/g);
    if (!sections) return [];
    const related = [];
    for (const section of sections) {
        const matches = section.matchAll(/`([^`]+)`/g);
        for (const m of matches) { if (!related.includes(m[1])) related.push(m[1]); }
    }
    return related;
}

function renderMdPage(title, content, filePath) {
    let html = content
        .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>').replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';
    return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Алефи</title><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/style.css">
<style>
body{font-family:'EB Garamond',Georgia,serif;font-size:18px;line-height:1.8;background:#ede0c8;color:#2c1810;margin:0;padding-top:56px}
.top-bar{position:fixed;top:0;left:0;right:0;background:#2c1810;color:#ede0c8;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;z-index:1000;border-bottom:1px solid #4a3020}
.top-bar .logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;font-style:italic;color:#b8860b;letter-spacing:4px}
.top-bar .logo a{color:#b8860b;text-decoration:none}
.md-content{max-width:800px;margin:0 auto;padding:40px 24px}
.md-content h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:700;font-style:italic;color:#b8860b;margin-bottom:8px}
.md-content h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:#b8860b;margin-top:32px;margin-bottom:16px}
.md-content h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#2c1810;margin-top:24px}
.md-content p{margin-bottom:16px}
.md-content code{background:#faf3e0;padding:2px 6px;border-radius:3px;font-size:15px;border:1px solid #d4c4a8}
.md-content blockquote{border-left:3px solid #b8860b;padding-left:16px;margin-left:0;color:#5c4a3a;font-style:italic}
.site-footer{background:#2c1810;color:#8a7a6a;padding:40px 24px 24px;text-align:center;margin-top:60px}
.footer-copy{font-size:12px;letter-spacing:2px;font-family:'Cormorant Garamond',Georgia,serif}
</style></head><body>
<header class="top-bar"><div class="logo"><a href="/">АЛЕФИ</a></div></header>
<main class="md-content">${html}</main>
<footer class="site-footer"><div class="footer-copy">Проект «Алефи». Восстановление истины. Яхве один.</div></footer>
</body></html>`;
}

function resolveFilePath(filePath) {
    const candidates = [
        path.join(WEB_DIR, filePath),
        path.join(WEB_DIR, 'src', filePath),
        path.join(WEB_DIR, 'apps', filePath),
    ];
    for (const c of candidates) {
        try { fsSync.accessSync(c); return c; } catch (_) {}
    }
    return null;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // CSP — широкий для локальной разработки
    res.setHeader('Content-Security-Policy',
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' http://localhost:* ws://localhost:* https://huggingface.co https://api-inference.huggingface.co; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // API
    if (pathname === '/api/files') {
        try {
            const files = await scanFiles();
            const body = JSON.stringify(files, null, 2);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(body);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (pathname === '/api/file') {
        const filePath = url.searchParams.get('path');
        if (!filePath) { res.writeHead(400); res.end('Missing path parameter'); return; }
        try {
            const fullPath = resolveAllowedFile(filePath);
            const content = await readFileLimited(fullPath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(content);
        } catch (e) {
            const status = e.code === 'FORBIDDEN_PATH' ? 403 : e.code === 'RESPONSE_TOO_LARGE' ? 413 : 404;
            res.writeHead(status); res.end(status === 413 ? 'Response too large' : status === 403 ? 'Forbidden' : 'Not found');
        }
        return;
    }

    if (pathname === '/view') {
        const filePath = url.searchParams.get('path');
        if (!filePath) { res.writeHead(400); res.end('Missing path parameter'); return; }
        try {
            const fullPath = resolveAllowedFile(filePath);
            const content = await readFileLimited(fullPath, 'utf-8');
            const title = extractTitle(content) || filePath.replace('.md', '').replace(/-/g, ' ');
            const html = renderMdPage(title, content, filePath);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } catch (e) {
            const status = e.code === 'FORBIDDEN_PATH' ? 403 : e.code === 'RESPONSE_TOO_LARGE' ? 413 : 404;
            res.writeHead(status); res.end(status === 413 ? 'Response too large' : status === 403 ? 'Forbidden' : 'Not found');
        }
        return;
    }

    // Статика
    let filePath = pathname === '/' ? '/index.html' : pathname;
    let fullPath = resolveFilePath(filePath);

    if (!fullPath) { res.writeHead(404); res.end('Not found'); return; }

    try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    } catch { res.writeHead(404); res.end('Not found'); return; }

    const ext = path.extname(fullPath);
    const mimeType = MIME[ext] || 'application/octet-stream';
    const content = await fs.readFile(fullPath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
});

server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('  ALEPHY — Свидетель Истины');
    console.log('========================================');
    console.log(`  Сервер запущен: http://localhost:${PORT}/`);
    console.log(`  Корень:         ${WEB_DIR}`);
    console.log('========================================\n');
    console.log('  Категории:');
    SCAN_DIRS.forEach(({ folder, label }) => {
        const dirPath = path.join(ROOT, folder);
        try { fsSync.accessSync(dirPath); console.log(`    ✅ ${label} (${folder})`); }
        catch { console.log(`    ⚠️  ${label} (${folder}) — не найдена`); }
    });
    console.log('========================================\n');
});

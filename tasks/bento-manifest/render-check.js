const fs = require('fs');
const js = fs.readFileSync('products/website/apps/researchlab/js/page-controller.js', 'utf8');
const i = js.indexOf('function renderManifestPage');
const j = js.indexOf('function initManifestNav');
const fn = js.slice(i, j);
const esc = function (s) { return String(s == null ? '' : s).split('<').join('LT'); };
const factory = new Function('escapeHtml', fn + '; return renderManifestPage;');
const render = factory(esc);
const data = JSON.parse(fs.readFileSync('products/website/apps/researchlab/data/methodology/manifest.json', 'utf8'));
const box = { innerHTML: '', dataset: {}, querySelector: function () { return null; } };
global.window = {};
try { render(box, data); } catch (e) { console.log('THREW:' + e.message); }
const h = box.innerHTML;
console.log('len:' + h.length);
const keys = ['mn-bento', 'mn-summary', 'mn-nav-link', 'mn-loss-list', 'manifest-loss-card', 'mn-paleo-grid', 'mn-spaces', 'mn-chips', 'mn-cta', 'mn-more', 'mn-lead'];
for (const k of keys) console.log(k + ':' + h.includes(k));
console.log('cells:' + (h.match(/mn-cell--/g) || []).length);
console.log('old:' + ['manifest-page', 'manifest-toc', 'manifest-section-heading'].map(function (k) { return k + '=' + h.includes(k); }).join(' '));

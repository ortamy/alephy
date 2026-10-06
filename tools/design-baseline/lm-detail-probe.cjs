/* lm-detail-probe.cjs — проверка разметки паспорта языка без браузера.
   Запуск: node tools/design-baseline/lm-detail-probe.cjs */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../products/website/apps/researchlab/');

function makeEl() {
  return {
    textContent: '',
    innerHTML: '',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    isConnected: true
  };
}

const container = makeEl();

const documentStub = {
  // Виртуальный file-URL: абсолютный путь Windows в baseURI превращает диск
  // «C:» в хост, и new URL() теряет сегменты. Модулю нужен только хвост.
  baseURI: 'file:///app/index.html',
  addEventListener() {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ textContent: '', innerHTML: '' })
};

const windowStub = {
  addEventListener() {},
  AlephyUtils: {
    escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }
  }
};

global.window = windowStub;
global.AlephyUtils = windowStub.AlephyUtils;
global.document = documentStub;
global.LanguageMapModule = null;
global.history = { replaceState() {} };
// fetch получает file-URL, но читаем через path.resolve от корня приложения:
// разбор URL с диском Windows в Node неоднозначен.
global.fetch = function(url) {
  // Отрезаем схему и хост виртуального file-URL — модулю нужен путь внутри
  // приложения: file:///app/pages/x.html → pages/x.html
  const relative = String(url).replace(/^file:\/\/\/app\//, '');
  const file = path.resolve(root, relative);
  const body = fs.readFileSync(file, 'utf8');
  return Promise.resolve({
    ok: true,
    text: function() { return Promise.resolve(body); },
    json: function() { return Promise.resolve(JSON.parse(body)); }
  });
};

require(path.join(root, 'js/language-map.js'));

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/language-map/languages.json'), 'utf8'));
const first = data.languages[0];

windowStub.LanguageMap.init(container, { segments: ['language-map', first.id] });

setTimeout(function() {
  const html = container.innerHTML;
  // [подпись, шаблон, ожидаем наличие] — отрицания не через !regex:
  // объект RegExp всегда «истинен», а !regex даёт false вне проверки.
  const checks = [
    ['тулбар паспорта', /language-map-detail-toolbar/, true],
    ['кнопка «К списку языков»', /К списку языков/, true],
    ['позиция в выборке', /language-map-detail-position/, true],
    ['соседи по алфавиту', /language-map-neighbor/, true],
    ['нет дубля заголовка в контейнере', /language-map-detail-title|language-map-kicker/, false],
    ['нет кнопки возврата внизу', /language-map-detail-back/, false],
    ['есть панель паспорта', /id="language-map-passport-title"/, true],
    ['есть панель связей', /id="language-map-relations-title"/, true]
  ];
  let failed = 0;
  checks.forEach(function(check) {
    const ok = check[1].test(html) === check[2];
    if (!ok) failed++;
    console.log((ok ? 'OK  ' : 'FAIL') + '  ' + check[0]);
  });
  if (failed) {
    console.log('\n--- HTML ---\n' + html);
    process.exit(1);
  }
  console.log('\nOK  паспорт: тулбар, соседи, без дублей, панели на месте');
}, 300);

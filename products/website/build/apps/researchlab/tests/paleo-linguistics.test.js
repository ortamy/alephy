// Тест тулбара внутренней страницы «Палео-лингвистики» (#paleo-linguistics/<id>).
// Проверяем разметку и CSS: анатомия тулбара должна совпадать с модулем
// «Агенты», а возврат в каталог — жить в тулбаре, а не в рельсе.
// Запуск: node tests/paleo-linguistics.test.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(APP, 'js', 'paleo-linguistics.js'), 'utf8');
const css = fs.readFileSync(path.join(APP, 'css', 'paleo-linguistics.css'), 'utf8');

assert.ok(
  source.includes('class="agent-controls-panel pl-controls-panel"') &&
    source.includes('class="agent-toolbar-row"'),
  'Тулбар страницы языка повторяет оболочку .agent-controls-panel модуля «Агенты»'
);
assert.ok(
  source.includes('id="pl-lang-page-search"') && source.includes('id="pl-lang-page-reset"') &&
    source.includes('id="pl-lang-count"'),
  'В тулбаре есть поиск, сброс фильтра и счётчик'
);
assert.ok(
  source.includes('class="lab-btn lab-btn-secondary lab-btn-sm pl-back-btn"'),
  'Кнопка «К каталогу языков» перенесена в тулбар'
);
assert.ok(
  !source.includes('lab-btn-sm pl-back-btn" type="button">← К каталогу языков'),
  'В рельсе бенто кнопки возврата больше нет'
);

// Поиск фильтрует элементы разделов, а не перерисовывает их: перерисовка
// роняла бы фокус в поле и открытую модалку эволюции.
['pl-sign-card', 'pl-root-row', 'pl-text-card', 'pl-grammar-item'].forEach(function(token) {
  assert.ok(source.includes('class="' + token + '"') || source.includes(token + '" data-pl-search="'), 'Поиск покрывает: ' + token);
});
assert.ok(source.includes("item.classList.toggle('is-filtered-out', !hit)"), 'Фильтр скрывает несовпавшие элементы');
assert.ok(/\.pl-work-body \.is-filtered-out \{ display: none !important; \}/.test(css), 'Скрытие работает и для строк таблицы');
assert.ok(source.includes('applyLangQuery(container);'), 'Фильтр применяется и при смене раздела');
assert.ok(source.includes('input.placeholder = tabSearchPlaceholder();'), 'Подсказка поиска следует за разделом');

console.log('OK  палео-лингвистика: тулбар по анатомии агентов, поиск по разделам, возврат в каталоге');

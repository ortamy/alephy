'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const PaleoLetters = require('../js/paleo-letters.js');

const rootsPath = path.join(__dirname, '..', 'data', 'roots', 'roots.json');
const roots = JSON.parse(fs.readFileSync(rootsPath, 'utf8'));
const bereshitPath = path.join(__dirname, '..', 'data', 'scripture', 'bereshit-1.json');
const bereshit = JSON.parse(fs.readFileSync(bereshitPath, 'utf8'));
const booksPath = path.join(__dirname, '..', 'data', 'qumran-books.json');
const books = JSON.parse(fs.readFileSync(booksPath, 'utf8')).books;
const readerSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'scripture-reader.js'), 'utf8');
const PaleoWeaver = require('../js/paleo-weaver.js');
const ScriptureAdapters = require('../js/scripture-adapters.js');

function findRoot(value) {
  const normalized = PaleoLetters.normalizeHebrew(value);
  return roots.find(function(root) {
    return PaleoLetters.normalizeHebrew(root.root) === normalized;
  });
}

function assertContiguous(indexes) {
  for (let i = 1; i < indexes.length; i += 1) {
    assert.strictEqual(
      indexes[i],
      indexes[i - 1] + 1,
      'Индексы должны образовывать последовательный диапазон'
    );
  }
}

assert.strictEqual(Object.keys(PaleoLetters.byHebrew).length, 27);
assert.strictEqual(Object.keys(PaleoLetters.paleoToHebrew).length, 22);

assert.strictEqual(PaleoLetters.toHebrew('𐤀𐤁'), 'אב');
assert.strictEqual(PaleoLetters.toPaleo('אב'), '𐤀𐤁');
assert.strictEqual(PaleoLetters.normalizeHebrew(' אָב '), 'אב');
assert.strictEqual(PaleoLetters.normalizeHebrew('ךםןףץ'), 'כמנפצ');
assert.strictEqual(PaleoLetters.canSearchRoot('אב'), true);
assert.strictEqual(PaleoLetters.canSearchRoot('אבד'), true);
assert.strictEqual(PaleoLetters.canSearchRoot('אבדד'), true);
assert.strictEqual(PaleoLetters.canSearchRoot('א'), false);
assert.strictEqual(PaleoLetters.canSearchRoot('אבדדה'), false);

Object.keys(PaleoLetters.paleoToHebrew).forEach(function(paleo) {
  const hebrew = PaleoLetters.paleoToHebrew[paleo];
  assert.strictEqual(PaleoLetters.toPaleo(hebrew), paleo);
  assert.strictEqual(PaleoLetters.toHebrew(paleo), hebrew);
});

const av = findRoot('אב');
assert.ok(av, 'Корень אב должен находиться в roots.json');
assert.strictEqual(av.meaning, 'отец, родоначальник, источник');
assert.deepStrictEqual(av.paleo, ['𐤀', '𐤁']);

assert.strictEqual(findRoot('𐤀𐤁'), undefined);
assert.strictEqual(findRoot('א ב'), av);
assert.strictEqual(findRoot('ך'), undefined);

assert.strictEqual(
  PaleoWeaver.wordReading(['вместилище', 'вершина', 'сила', 'разрушение', 'действие', 'фиксация']),
  'вместилище, которое фиксирует вершину через разрушение'
);
assert.strictEqual(
  PaleoWeaver.verseFunction([['вместилище', 'вершина', 'сила', 'разрушение']]),
  'разрушение вместилища.'
);
assert.strictEqual(PaleoWeaver.wordReading(['сила', 'направление', 'действие']), 'сила, которая направляет через действие');
assert.strictEqual(PaleoWeaver.wordReading(['поток', 'направление']), 'поток, который направляет');
assert.ok(!PaleoWeaver.wordReading(['откровение', 'направление', 'откровение']).includes('к откровению'));
assert.ok(!PaleoWeaver.wordReading(['поток', 'направление', 'поток']).includes('через поток'));
assert.strictEqual(PaleoWeaver.isParticle(['связка']), true);
assert.strictEqual(PaleoWeaver.particleText(['связка']), 'и');
assert.ok(PaleoWeaver.verseReading([['связка'], ['сила', 'направление', 'действие']]).split(/\s+/).length <= 20);

assert.doesNotThrow(function() { assertContiguous([4, 5, 6, 7]); });
assert.throws(function() { assertContiguous([4, 6]); }, /последовательный диапазон/);
assert.doesNotThrow(function() { assertContiguous([1, 2, 3, 4, 5]); });

assert.strictEqual(bereshit.length, 1533, 'Берешит содержит полный корпус из 1533 стихов');
assert.ok(bereshit.every(function(verse) {
  return verse.hebrew && verse.paleo && Array.isArray(verse.words) && verse.words.length;
}), 'У каждого стиха есть квадратный и палео-слой');
assert.ok(bereshit.every(function(verse) {
  return verse.words.every(function(word) { return word.hebrew && word.paleo; });
}), 'У каждого слова есть квадратная и палео-графика');
assert.ok(bereshit.every(function(verse) {
  return PaleoLetters.toPaleo(PaleoLetters.normalizeHebrew(verse.hebrew)) === verse.paleo.replace(/\s/g, '');
}), 'Палео-строка механически соответствует согласному квадратному слою');

assert.ok(books.some(function(book) { return book.id === 'samaritan-torah' && book.category === 'samaritan' && book.dataFile === 'samaritan_paleo'; }), 'Самаритянское Пятикнижие есть в каталоге и открывает данные');
assert.ok(books.some(function(book) { return book.id === '1qs' && book.category === 'yahad' && book.dataFile === '1qs'; }), '1QS стоит на полке йахад');
assert.ok(books.some(function(book) { return book.id === '1qphab' && book.category === 'yahad' && book.dataFile === '1qphab'; }), '1QpHab стоит на полке йахад');
assert.ok(books.some(function(book) { return book.id === '11qt' && book.category === 'yahad' && book.dataFile === '11qt'; }), '11QT стоит на полке йахад');
assert.ok(books.every(function(book) { return book.category; }), 'У каждой книги есть категория');
const yahadMin = { '1qs': 24, '1qphab': 18, '11qt': 18 };

books.forEach(function(book) {
  if (!book.dataFile) return;
  const file = path.join(__dirname, '..', 'data', 'scripture', book.dataFile + '.json');
  assert.ok(fs.existsSync(file), 'Файл данных существует: ' + book.dataFile);
  const verses = ScriptureAdapters.normalizeScripturePayload(JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.ok(verses.length > 0, 'Книга содержит стихи: ' + book.id);
  assert.ok(verses.every(function(verse) {
    return verse.hebrew && verse.paleo && Array.isArray(verse.words) && verse.words.length;
  }), 'Нет пропусков в слоях книги: ' + book.id);
  assert.ok(verses.every(function(verse) {
    return PaleoLetters.toPaleo(PaleoLetters.normalizeHebrew(verse.hebrew)) === verse.paleo.replace(/\s/g, '');
  }), 'Палео-графика синхронизирована: ' + book.id);
  assert.ok(verses.every(function(verse) {
    return verse.paleo_translation && ['draft', 'review', 'verified'].includes(verse.paleo_translation_status);
  }), 'У каждого стиха есть маркированная палео-сборка: ' + book.id);
  if (yahadMin[book.id]) {
    assert.ok(verses.length >= yahadMin[book.id], book.id + ' наращён до рабочего среза');
    assert.ok(verses.some(function(verse) { return verse.paleo_translation_status === 'review'; }), book.id + ' имеет слой review');
    assert.ok(verses.every(function(verse) { return verse.words.length >= 2; }), book.id + ' держит словесные границы');
    assert.ok(verses.every(function(verse) { return !/[А-Яа-яЁё]/.test(verse.hebrew); }), 'Нет кириллицы в иврите: ' + book.id);
  }
});

const samaritanPayload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'scripture', 'samaritan_paleo.json'), 'utf8'));
const samaritanVerses = ScriptureAdapters.normalizeScripturePayload(samaritanPayload);
assert.ok(!Array.isArray(samaritanPayload) && Array.isArray(samaritanPayload.verses), 'Самаритянский источник — объект {meta, verses}');
assert.ok(samaritanVerses[0] && samaritanVerses[0].words.length >= 2, 'Адаптер собирает словесный слой самаритян 1:1');
assert.strictEqual(samaritanVerses[0].paleo_translation_status, 'review', 'Статус «требуется проверка» становится review');
assert.ok(readerSource.includes('ScriptureAdapters.normalizeScripturePayload'), 'Ридер прогоняет загрузку через адаптер');
assert.ok(readerSource.includes("yahad: 'Кумран / йахад'"), 'В селекторе есть категория Кумран / йахад');

assert.ok(readerSource.includes('scripture-meaning-card'), 'Смысловая сборка выводится отдельной карточкой');
assert.ok(readerSource.includes('scripture-assembly-details'), 'Технический след сворачивается в details');
assert.ok(readerSource.includes('scripture-constructor-chips'), 'Палео-конструктор выводит глиф-чипы');
assert.ok(readerSource.includes('scripture-glyph-popover'), 'Глифы используют управляемый popover');
assert.ok(readerSource.includes('data-name='), 'Чипы передают имя буквы в popover');
assert.ok(readerSource.includes('pointerover'), 'Hover показывает popover');
assert.ok(readerSource.includes("glyphPointerType === 'touch'"), 'Повторный тап закрывает popover без закрытия при mouse-клике');
assert.ok(readerSource.includes("event.key === 'Escape'"), 'Escape закрывает popover');
assert.ok(readerSource.includes('aria-haspopup="true"'), 'Чипы доступны как интерактивные элементы');
assert.ok(readerSource.includes("setAttribute('aria-describedby', 'scripture-glyph-popover')"), 'Открытый popover связан с чипом через aria-describedby');
assert.ok(readerSource.includes('meaningPass.verse_reading'), 'Meaning-pass имеет приоритет для связного образа');
assert.ok(readerSource.includes('meaningPass.verse_function'), 'Meaning-pass имеет отдельную функцию стиха');
assert.ok(readerSource.includes('WEAVER.verseReading(chains)'), 'Fallback использует Weaver v2 для связного образа');
assert.ok(readerSource.includes('WEAVER.isParticle(normalizedChain)'), 'Служебные частицы присоединяются к соседнему слову');
assert.ok(readerSource.includes('scripture-word-row'), 'Конструктор использует строковую Grid-разметку');
assert.ok(readerSource.includes('updateConstructorOverflow'), 'Scrollbar включается только для реально длинных рядов');
assert.ok(readerSource.includes("paleoLetters.length <= 7 ? ' is-fit'"), 'Короткие слова растягиваются без scrollbar');
assert.ok(!readerSource.includes('escapeHtml(verseTranslation.toUpperCase())'), 'Смысловая сборка не переводится в верхний регистр');
assert.ok(!readerSource.includes('escapeHtml(verseFunction.toUpperCase())'), 'Функция стиха не переводится в верхний регистр');
const readerCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'scripture-reader.css'), 'utf8');
assert.ok(readerCss.includes('flex-wrap: nowrap;') && readerCss.includes('overflow-x: auto;'), 'Чипы остаются горизонтальными на узкой ширине');
assert.ok(readerCss.includes('flex: 1 1 auto;') && readerCss.includes('.scripture-glyph-arrow'), 'Коннекторы растягивают строку');
assert.ok(readerCss.includes('.scripture-constructor-chips.is-scrollable'), 'Скролл активируется отдельным классом');
assert.ok(readerCss.includes('.scripture-constructor-chips.is-fit'), 'Короткие строки растягиваются на ширину конструктора');
assert.ok(readerCss.includes('@media (max-width: 720px)'), 'Есть отдельный мобильный брейкпоинт конструктора');
assert.ok(readerCss.includes('flex-direction: column;') && readerCss.includes('.scripture-glyph-arrow::after'), 'Мобильный конструктор выводит чипы и стрелки вертикально');
assert.ok(readerCss.includes('.scripture-navigation .lab-btn') && readerCss.includes('max-width: none;'), 'Мобильная навигация стихов не ограничивает кнопки по ширине');
assert.ok(readerCss.includes('.scripture-physics-chevron') && readerCss.includes('grid-column: 2;'), 'Chevron физики слова закреплён справа');
assert.ok(!readerCss.includes('.scripture-glyph-tooltip'), 'Старый CSS-tooltip удалён');

const pageControllerSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'page-controller.js'), 'utf8');
assert.ok(pageControllerSource.includes('id="scripture-search-input"'), 'Поиск по книгам стоит в шапке модуля');
assert.ok(pageControllerSource.includes('id="scripture-search"'), 'Контейнер поиска книг есть в разметке');
assert.ok(pageControllerSource.includes('id="scripture-category"'), 'Селектор категории книг есть в разметке');
assert.ok(readerSource.includes('book.ru, book.paleo, book.id'), 'Фильтр ищет по ru, paleo и id');
assert.ok(readerSource.includes("categorySelect.addEventListener('change', renderBookGrid)"), 'Сетка книг перерисовывается по категории');
assert.ok(readerSource.includes('bookMatchesCategory'), 'Фильтр учитывает выбранную категорию');
assert.ok(readerSource.includes('Книги не найдены.'), 'Пустой поиск показывает «Книги не найдены.»');
assert.ok(
  readerSource.includes('assets/icons/32/ui/book.png') && readerSource.includes('width="32" height="32"'),
  'Карточка книги использует иконку 32×32'
);
assert.ok(
  readerSource.includes("searchInput.addEventListener('input', renderBookGrid)") &&
    readerSource.includes("searchInput.addEventListener('search', renderBookGrid)"),
  'Сетка книг перерисовывается по input и search'
);
assert.ok(readerSource.includes('setBookSearchVisible(false)'), 'Поиск скрывается на виде стиха');
assert.ok(
  readerCss.includes('.scripture-book-card .tool-icon img') &&
    readerCss.includes('width: 32px;') &&
    readerCss.includes('height: 32px;'),
  'CSS карточки фиксирует иконку 32×32'
);
assert.ok(readerCss.includes('@media (max-width: 380px)'), 'На узкой ширине сетка книг остаётся двухколоночной');

console.log('OK: PaleoLetters and Scripture Reader core scenarios passed');

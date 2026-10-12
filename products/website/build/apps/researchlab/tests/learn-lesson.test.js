'use strict';

// Регресс-тест правки границ шага «Урок» и bento-ячеек.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');

const js = fs.readFileSync(path.join(appDir, 'js', 'learn.js'), 'utf8');
const css = fs.readFileSync(path.join(appDir, 'css', 'learn.css'), 'utf8');
const index = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');

// 1. Базовые подключения и каталог.
assert.ok(index.includes('css/learn.css'), 'CSS для урока подключён');

// 2. Ячейки следуют канону §5.2a.
assert.ok(/\.ls-bento\s*\{/.test(css), 'Урок — bento сетка');
assert.ok(/\.ls-cell--ink\s*\{[^}]*background:\s*var\(--bg-dark\)/.test(css),
  'ink-ячейка только на итоге');
assert.ok(/\.module\s+\.ls-cell\s+\.ls-cell-title\s*\{[^}]*border-bottom:0/.test(css),
  'Заголовок ячейки сбрасывает чёрку и использует .module');

// 3. Структура урока в JS.
assert.ok(js.includes('ls-bento'), 'bento-оболочка урока');
assert.ok(js.includes('lessonCellHead'), 'шапка ячейки урока');
assert.ok(js.includes('lessonToolbar'), 'тулбар шагов урока');
assert.ok(js.includes('lessonStageCell'), 'экран шага (вид, вопрос, проверка)');
assert.ok(js.includes('lessonDoneCell'), 'экран завершения урока');
assert.ok(js.includes('lessonPathCell'), 'прогресс шагов урока');
assert.ok(js.includes('lessonPassportCell'), 'постепенный паспорт буквы');
assert.ok(js.includes('lessonRowCell'), 'ряд соседних букв');
assert.ok(js.includes('LESSON_STEPS'), 'статический курс шагов');

// 4. Урок не спойлерит букву на этапе применения (шаг 4).
assert.ok(js.includes("title: state.lesson.done ? item.name : 'Урок'"),
  'имя буквы в шапке появится только после завершения');
assert.ok(js.includes("glyph: (state.lesson.done || step !== 4) ? item.paleo : ''"),
  'палео-глиф скрыт в шапке на шаге 4');
assert.ok(js.includes('ls-image'), 'на шаге «Знак» стимул — образ, а не палео-символ');

// 5. Клавиатура, подсказка и повтор не забыли в правке.
assert.ok(js.includes('bindLessonKeys'), 'клавиатура урока');
assert.ok(js.includes('focusLessonInput'), 'фокус на поле ввода');
assert.ok(js.includes('repeatLesson'), 'перезапуск урока');
assert.ok(js.includes('markMiss'), 'подсказка после промахов');

console.log('OK  learn-lesson: bento-урок, шаги и клавиатура');

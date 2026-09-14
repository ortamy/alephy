/* Обучение: 22 буквы, четыре шага урока и игра «Угадай образ». */
(function(root) {
  'use strict';

  var PROGRESS_KEY = 'alephy_learn_progress';
  var RECORD_KEY = 'alephy_guess_record';
  var COURSE_KEY = 'alephy_course_progress';
  var SRS_KEY = 'alephy_srs_cards';
  var LETTER_KEYS = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];
  var fallback = [
    ['א','𐤀','Алеф','бык','сила'],['ב','𐤁','Бет','дом','вместилище'],['ג','𐤂','Гимель','верблюд','движение'],['ד','𐤃','Далет','дверь','вход'],['ה','𐤄','Хе','дыхание','откровение'],['ו','𐤅','Вав','крюк','соединение'],['ז','𐤆','Заин','оружие','инструмент'],['ח','𐤇','Хет','ограда','отделение'],['ט','𐤈','Тет','змея','оборачивание'],['י','𐤉','Йод','рука','действие'],['כ','𐤊','Каф','ладонь','удержание'],['ל','𐤋','Ламед','посох','направление'],['מ','𐤌','Мем','вода','течение'],['נ','𐤍','Нун','рыба','жизнь'],['ס','𐤎','Самех','опора','поддержка'],['ע','𐤏','Аин','глаз','видение'],['פ','𐤐','Пе','рот','речь'],['צ','𐤑','Цаде','крюк','цель'],['ק','𐤒','Коф','игла','окружение'],['ר','𐤓','Реш','голова','начало'],['ש','𐤔','Шин','зуб','разрушение'],['ת','𐤕','Тав','знак','печать']
  ];
  var letters = [];
  var state = { view:'home', lesson:null, game:null, timer:null, course:null, trainer:null, review:null, battle:null };

  function esc(value) { var div = document.createElement('div'); div.textContent = String(value == null ? '' : value); return div.innerHTML; }
  function now() { return new Date().toISOString(); }
  function read(key, fallbackValue) { try { var value = JSON.parse(localStorage.getItem(key)); return value == null ? fallbackValue : value; } catch (e) { return fallbackValue; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function progress() { var value = read(PROGRESS_KEY, {letters:{}, lastActivity:''}); if (!value.letters) value.letters = {}; return value; }
  function record() { var value = Number(localStorage.getItem(RECORD_KEY)); return isFinite(value) && value > 0 ? value : 0; }
  function touch(p) { p.lastActivity = now(); write(PROGRESS_KEY, p); }
  function srsCards() { var value = read(SRS_KEY, {}); return value && typeof value === 'object' ? value : {}; }
  function srsCard(id, type, label) {
    var cards = srsCards();
    if (!cards[id]) cards[id] = { id:id, type:type, label:label, repetitions:0, intervalDays:0, ease:2.5, dueAt:now(), lapses:0 };
    return cards[id];
  }
  function srsDue(card) { return !card.dueAt || new Date(card.dueAt).getTime() <= Date.now(); }
  function srsSchedule(id, type, label, grade) {
    var cards = srsCards(), card = srsCard(id, type, label), intervals = { again:0, hard:1, good:Math.max(1, Math.round(card.intervalDays ? card.intervalDays * card.ease : 1)), easy:Math.max(3, Math.round(card.intervalDays ? card.intervalDays * card.ease * 1.5 : 4)) };
    if (grade === 'again') { card.repetitions = 0; card.intervalDays = 0; card.lapses = (card.lapses || 0) + 1; card.dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); }
    else { card.repetitions = (card.repetitions || 0) + 1; card.intervalDays = intervals[grade]; card.ease = Math.max(1.3, card.ease + (grade === 'easy' ? 0.15 : grade === 'hard' ? -0.15 : 0)); card.dueAt = new Date(Date.now() + card.intervalDays * 86400000).toISOString(); }
    card.lastGrade = grade; card.lastReviewedAt = now(); cards[id] = card; write(SRS_KEY, cards); return card;
  }
  function srsLetterCards(item) { return [{id:'letter-name:' + item.hebrew,type:'letter-name',label:item.paleo + ' → ' + item.name},{id:'letter-image:' + item.hebrew,type:'letter-image',label:item.paleo + ' → ' + item.image},{id:'letter-glyph:' + item.hebrew,type:'letter-glyph',label:item.image + ' → ' + item.paleo}]; }
  function srsStats() { var cards = Object.keys(srsCards()).map(function(id) { return srsCards()[id]; }), due = cards.filter(srsDue).length, learned = cards.filter(function(c) { return c.repetitions >= 3; }).length; return { total:cards.length, due:due, learned:learned }; }
  function queueReview() { var cards = Object.keys(srsCards()).map(function(id) { return srsCards()[id]; }).filter(srsDue); if (cards.length) return cards[0]; var item = letters.filter(function(letter) { return !srsLetterCards(letter).some(function(def) { return srsCards()[def.id]; }); })[0] || letters[0]; if (!item) return null; return srsCard(srsLetterCards(item)[0].id, 'letter-name', srsLetterCards(item)[0].label); }
  function shuffle(list) { return list.slice().sort(function() { return Math.random() - .5; }); }
  function byKey(key) { return letters.filter(function(item) { return item.hebrew === key; })[0]; }
  function distractors(item, field) { return shuffle(letters.filter(function(x) { return x.hebrew !== item.hebrew; })).slice(0,3).concat(item).sort(function() { return Math.random() - .5; }); }
  function inputMatch(value, expected) { return String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/[ё]/g,'е') === String(expected).toLocaleLowerCase('ru-RU').replace(/[ё]/g,'е'); }
  function getContainer() { return document.getElementById('learn-app'); }
  function setView(view) { state.view = view; render(); }

  function navigate(segments) {
    if (root.LabRouter) root.LabRouter.navigate('learn', segments);
  }

  function findCourse(id) {
    id = decodeURIComponent(String(id || ''));
    return ((root.AlephyCourses && root.AlephyCourses.list) || []).filter(function(course) {
      return course.id === id && course.lessons && course.lessons.length;
    })[0] || null;
  }

  function routeTitle(route) {
    var segments = String(route || '').split('/');
    var item, course;
    if (route === 'learn') return 'Обучение';
    if (route === 'learn/lessons') return 'Изучение иврита';
    if (route === 'learn/game') return 'Угадай образ';
    if (route === 'learn/courses') return 'Курсы';
    if (route === 'learn/paleo-trainer') return 'Палео-тренажёр';
    if (segments[1] === 'lessons' && segments[2]) {
      item = byKey(decodeURIComponent(segments[2]));
      return item ? item.name : 'Урок';
    }
    if (segments[1] === 'courses' && segments[2]) {
      course = findCourse(segments[2]);
      return course ? course.title : 'Курс';
    }
    return '';
  }

  function applyRoute(parsed) {
    var segments = parsed && parsed.segments ? parsed.segments.slice(1) : [];
    var target = segments[0] || 'home';
    var item, course;

    stopTimer();
    if (target === 'lessons') {
      state.view = segments[1] ? 'lesson' : 'lessons';
      if (state.view === 'lesson') {
        item = byKey(decodeURIComponent(segments[1]));
        if (!item) state.view = 'lessons';
        else state.lesson = state.lesson && state.lesson.item.hebrew === item.hebrew ? state.lesson : {item:item,step:1,score:0,done:false};
      }
      state.course = null;
    } else if (target === 'review') {
      state.view = 'review';
      state.review = { card: queueReview() };
      state.lesson = null;
      state.course = null;
    } else if (target === 'game') {
      state.view = 'game';
      if (!state.game || state.game.done) {
        state.game = {round:1,score:0,streak:0,time:30,done:false};
        nextRound();
      }
      startTimer();
    } else if (target === 'courses') {
      course = segments[1] ? findCourse(segments[1]) : null;
      state.view = course ? 'course' : 'courses';
      state.course = course;
    } else if (target === 'paleo-trainer') {
      state.view = segments[1] === 'battle' ? 'battle' : 'trainer';
      if (state.view === 'battle') initBattle();
      if (!state.trainer) initTrainer();
      state.course = null;
      state.game = null;
      if (state.view === 'trainer' && parsed && parsed.params && parsed.params.root) {
        loadRoots().then(function(roots) {
          var selected = roots.filter(function(entry) { return String(entry.translit || '').toUpperCase() === String(parsed.params.root).toUpperCase(); })[0];
          if (selected && state.trainer) { state.trainer.rootEntry = selected; state.trainer.entries = glyphEntriesForRoot(selected); render(); }
        });
      }
    } else {
      state.view = 'home';
      state.lesson = null;
      state.course = null;
      state.game = null;
      state.review = null;
    }
    render();
  }

  function loadLetters() {
    var source = root.PaleoLetters && root.PaleoLetters.byHebrew;
    LETTER_KEYS.forEach(function(key, index) {
      var entry = source && source[key];
      letters.push(entry ? {hebrew:key,paleo:entry.paleo,name:entry.name,image:entry.image,meaning:entry.meaning} : {hebrew:fallback[index][0],paleo:fallback[index][1],name:fallback[index][2],image:fallback[index][3],meaning:fallback[index][4]});
    });
  }

  function coursesCount() { return (root.AlephyCourses && root.AlephyCourses.list) ? root.AlephyCourses.list.length : 0; }

  /* ===== Хаб: строка-шапка, группы, компактные карточки ===== */

  function completedLetters() {
    var p = progress();
    return letters.filter(function(item) { return p.letters[item.hebrew] && p.letters[item.hebrew].status === 'complete'; }).length;
  }

  function hasProgress() { return completedLetters() > 0 || srsStats().total > 0 || record() > 0; }

  /* История активности за 7 дней — из существующих меток времени в localStorage. */
  function activityDays() {
    var days = [0,0,0,0,0,0,0], base = new Date(); base.setHours(0,0,0,0);
    var stamps = [], p = progress(), cards = srsCards(), courses = courseProgress();
    if (p.lastActivity) stamps.push(p.lastActivity);
    Object.keys(p.letters).forEach(function(key) { if (p.letters[key] && p.letters[key].lastActivity) stamps.push(p.letters[key].lastActivity); });
    Object.keys(cards).forEach(function(id) { if (cards[id] && cards[id].lastReviewedAt) stamps.push(cards[id].lastReviewedAt); });
    Object.keys(courses.lessons).forEach(function(id) { if (courses.lessons[id] && courses.lessons[id].at) stamps.push(courses.lessons[id].at); });
    stamps.forEach(function(value) {
      var day = new Date(value); day.setHours(0,0,0,0); if (isNaN(day.getTime())) return;
      var index = 6 - Math.round((base.getTime() - day.getTime()) / 86400000);
      if (index >= 0 && index <= 6) days[index]++;
    });
    return days;
  }

  function sparkMarkup() {
    var days = activityDays(), max = Math.max.apply(null, days.concat([1]));
    return '<span class="learn-hub-spark" role="img" aria-label="Активность за 7 дней">' + days.map(function(value) {
      return '<i style="height:' + (value ? 4 + Math.round(value / max * 10) : 4) + 'px"' + (value ? ' class="is-hot"' : '') + '></i>';
    }).join('') + '</span>';
  }

  /* Deep-link «продолжить»: последний след активности в localStorage. */
  function lastDestination() {
    var best = null;
    function offer(at, segments) { var time = new Date(at || '').getTime(); if (!time) return; if (!best || time > best.time) best = { time:time, segments:segments }; }
    var p = progress(), cards = srsCards(), courses = courseProgress();
    Object.keys(p.letters).forEach(function(key) { var entry = p.letters[key]; if (entry && entry.status) offer(entry.lastActivity, ['lessons', encodeURIComponent(key)]); });
    Object.keys(cards).forEach(function(id) { if (cards[id] && cards[id].lastReviewedAt) offer(cards[id].lastReviewedAt, ['review']); });
    Object.keys(courses.lessons).forEach(function(id) { var lesson = courses.lessons[id]; if (lesson && lesson.done) offer(lesson.at, ['courses', encodeURIComponent(lesson.course)]); });
    return best;
  }

  function hubChip(text) { return '<span class="learn-hub-chip">' + esc(text) + '</span>'; }

  function hubDot(status) {
    var label = status === 'done' ? 'освоен' : status === 'progress' ? 'в работе' : 'новый';
    return '<span class="learn-hub-dot is-' + status + '" title="' + label + '" aria-label="' + label + '"></span>';
  }

  function hubCard(card) {
    var percent = card.bar == null ? 0 : Math.round(card.bar * 100);
    var bar = card.bar == null ? '' : '<span class="learn-hub-bartrack" role="progressbar" aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(card.title) + ': прогресс"><span style="width:' + percent + '%"></span></span>';
    return '<button type="button" class="learn-hub-card" onclick="' + card.onClick + '">' +
      '<span class="learn-hub-card-top"><span class="learn-hub-glyph" lang="hbo" aria-hidden="true">' + card.glyph + '</span><span class="learn-hub-card-title">' + esc(card.title) + '</span>' + hubDot(card.status) + '</span>' +
      '<span class="learn-hub-card-desc">' + esc(card.desc) + '</span>' +
      '<span class="learn-hub-card-foot"><span class="learn-hub-card-meta">' + esc(card.meta) + '</span>' + bar + '</span>' +
    '</button>';
  }

  function hubGroup(label, cards, extra) {
    return '<section class="learn-hub-group"><header class="learn-hub-group-head"><span class="learn-hub-group-label">' + label + '</span><span class="learn-hub-group-rule" aria-hidden="true"></span><span class="learn-hub-group-badge">' + cards.length + '</span></header>' + (extra || '') + '<div class="learn-hub-cards">' + cards.join('') + '</div></section>';
  }
  /* Мини-превью ближайшей карточки повторения; localStorage не мутируем. */
  function dayCardMarkup() {
    if (!hasProgress()) return '';
    var due = Object.keys(srsCards()).map(function(id) { return srsCards()[id]; }).filter(srsDue).sort(function(a, b) { return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(); })[0];
    if (!due) return '';
    var view = reviewItem(due);
    return '<div class="learn-hub-day"><span class="learn-hub-glyph" lang="hbo" aria-hidden="true">' + view.item.paleo + '</span><span class="learn-hub-day-body"><strong>Карточка дня</strong><span>' + esc(view.prompt) + '</span></span><button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LearnLab.openReview()">Повторить</button></div>';
  }

  function emptyStateMarkup() {
    return '<div class="learn-hub-empty"><span class="learn-hub-empty-glyph" lang="hbo" aria-hidden="true">𐤀</span><div class="learn-hub-empty-body"><h2>Поле пока пусто</h2><p>Ни одна буква ещё не начата. Алеф ждёт: первый урок вернёт глазу древнего читателя предметный образ — от знака к действию.</p></div><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.startFirst()">Начать первый урок</button></div>';
  }

  function renderHome() {
    var p = progress();
    var completed = completedLetters();
    var srs = srsStats();
    var fresh = !hasProgress();
    var last = p.lastActivity ? new Date(p.lastActivity).toLocaleDateString('ru-RU') : '—';
    var trainerCount = Object.keys(p.letters).filter(function(key) { return p.letters[key] && p.letters[key].source === 'trainer'; }).length;
    var courseState = courseProgress(), courseDone = Object.keys(courseState.lessons).length, courseTotal = 0;
    ((root.AlephyCourses && root.AlephyCourses.list) || []).forEach(function(course) { courseTotal += (course.lessons || []).length; });
    var battleStored = !!(root.PaleoBattle && root.PaleoBattle.STORAGE_KEY && read(root.PaleoBattle.STORAGE_KEY, null));

    var cardsPractice = [
      hubCard({ glyph:'𐤕', title:'Повторение', desc:'Короткая очередь карточек, которым пора вернуться в поле зрения.', meta: srs.total === 0 ? 'очередь пуста' : (srs.due > 0 ? srs.due + ' к повторению' : 'всё повторено'), status: srs.total === 0 ? 'new' : (srs.due > 0 ? 'progress' : 'done'), bar: srs.total ? srs.learned / srs.total : null, onClick:'LearnLab.openReview()' }),
      hubCard({ glyph:'𐤏', title:'Палео-тренажёр', desc:'Крупные палео-буквы: увидь образ, назови функцию, собери смысл.', meta: '6 тем · корни и смыслы', status: trainerCount > 0 ? 'progress' : 'new', bar: completed / 22, onClick:'LearnLab.openTrainer()' })
    ];
    var cardsGames = [
      hubCard({ glyph:'𐤔', title:'Угадай образ', desc:'Раунд на скорость: знак — к предметному образу, серия растёт.', meta: 'рекорд ' + record() + ' очков', status: record() > 0 ? 'progress' : 'new', bar: null, onClick:'LearnLab.openGame()' }),
      hubCard({ glyph:'⚔', title:'Палео-битва', desc:'Пошаговый матч: собери цепочку образов и защити своё чтение.', meta: battleStored ? 'матч в работе' : '5 раундов', status: battleStored ? 'progress' : 'new', bar: null, onClick:'LearnLab.openBattle()' })
    ];
    var cardsCourses = [
      hubCard({ glyph:'𐤀', title:'Изучение иврита', desc:'22 урока по буквам: название, образ, значение и узнавание знака.', meta: completed + '/22 букв', status: completed === 0 ? 'new' : (completed === 22 ? 'done' : 'progress'), bar: completed / 22, onClick:'LearnLab.openLessons()' }),
      hubCard({ glyph:'𐤅', title:'Курсы', desc:'Практические курсы: палео-механика, результат после каждого модуля.', meta: coursesCount() + ' курсов', status: courseDone === 0 ? 'new' : (courseTotal > 0 && courseDone >= courseTotal ? 'done' : 'progress'), bar: courseTotal ? courseDone / courseTotal : null, onClick:'LearnLab.openCourses()' })
    ];

    var cta = fresh
      ? '<button type="button" class="lab-btn lab-btn-primary lab-btn-sm" onclick="LearnLab.startFirst()">Начать первый урок</button>'
      : '<button type="button" class="lab-btn lab-btn-primary lab-btn-sm" onclick="LearnLab.continueLast()">Продолжить с последнего места</button>';

    return '<header class="learn-hub-bar">' +
        '<span class="learn-hub-label">Обучение</span>' +
        '<span class="learn-hub-rule" aria-hidden="true"></span>' +
        '<span class="learn-hub-chips">' + hubChip('буквы ' + completed + '/22') + hubChip('к повторению ' + srs.due) + hubChip('рекорд ' + record()) + hubChip('активность ' + last) + '</span>' +
        sparkMarkup() +
        '<button type="button" class="learn-hub-reset" title="Сбросить прогресс" aria-label="Сбросить прогресс" onclick="LearnLab.reset()"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button>' +
        cta +
      '</header>' +
      (fresh ? emptyStateMarkup() : '') +
      '<p class="learn-hub-legend" aria-label="Легенда статусов"><span>Статус:</span><span class="learn-hub-dot"></span>новый<span class="learn-hub-dot is-progress"></span>в работе<span class="learn-hub-dot is-done"></span>освоен</p>' +
      hubGroup('Практика', cardsPractice, dayCardMarkup()) +
      hubGroup('Игры', cardsGames) +
      hubGroup('Курсы', cardsCourses);
  }

  function courseCard(course, index) {
    var levelLabel = course.levelKey === 'from-zero' ? 'с нуля' : course.levelKey === 'advanced' ? 'продвинутый' : 'базовый';
    var statusClass = course.status === 'скоро' ? 'soon' : course.status === 'открыт' ? 'open' : 'draft';
    var hasLessons = !!(course.lessons && course.lessons.length);
    var click = hasLessons ? ' onclick="LearnLab.openCourse(\'' + course.id + '\')"' : '';
    var tagOpen = hasLessons ? '<button type="button"' : '<article';
    var tagClose = hasLessons ? '</button>' : '</article>';
    return tagOpen + ' class="course-card' + (hasLessons ? ' is-open' : '') + '" style="animation-delay:' + index * 60 + 'ms"' + click + '>' +
      '<div class="course-card-head"><span class="course-status is-' + statusClass + '">' + esc(course.status) + '</span>' +
      '<h2>' + esc(course.title) + '</h2></div>' +
      '<p class="course-desc">' + esc(course.description) + '</p>' +
      '<div class="course-card-meta">' +
        '<span class="course-tag level">' + esc(levelLabel) + '</span>' +
        '<span class="course-tag">' + course.modules + ' ' + (course.modules === 1 ? 'модуль' : course.modules < 5 ? 'модуля' : 'модулей') + '</span>' +
      '</div>' +
      (hasLessons ? '<span class="course-card-action">Пройти курс</span>' : '') +
    tagClose;
  }
  function renderCourses() {
    var courses = (root.AlephyCourses && root.AlephyCourses.list) || [];
    return '<div class="course-grid">' + courses.map(courseCard).join('') + '</div>';
  }

  function courseProgress() { var value = read(COURSE_KEY, { lessons: {} }); if (!value.lessons) value.lessons = {}; return value; }

  function renderCourse() {
    var course = state.course;
    if (!course) { state.view = 'courses'; return renderCourses(); }
    var p = courseProgress();
    var lessons = course.lessons || [];
    var done = lessons.filter(function(lesson) { return p.lessons[lesson.id]; }).length;
    var cards = lessons.map(function(lesson, index) {
      var isDone = !!p.lessons[lesson.id];
      return '<article class="lesson-scroll' + (isDone ? ' is-done' : '') + '" style="animation-delay:' + index * 70 + 'ms">' +
        '<div class="lesson-scroll-side"><span class="lesson-paleo" lang="hbo" aria-hidden="true">' + esc(lesson.letter) + '</span><span class="lesson-number">' + lesson.number + '/' + lessons.length + '</span></div>' +
        '<div class="lesson-scroll-body">' +
          '<header class="lesson-scroll-head"><h2>' + esc(lesson.title) + '</h2><span class="lesson-letter-name">' + esc(lesson.letterName) + '</span></header>' +
          '<span class="lesson-paleo-word" lang="hbo">' + esc(lesson.paleo) + '</span>' +
          '<p class="lesson-meaning">' + esc(lesson.meaning) + '</p>' +
          '<blockquote class="lesson-quote">' + esc(lesson.quote) + '</blockquote>' +
          '<div class="lesson-ask"><h3>Вопрос</h3><p>' + esc(lesson.question) + '</p></div>' +
          '<div class="lesson-practice"><h3>Практика</h3><p>' + esc(lesson.practice) + '</p></div>' +
          '<button type="button" class="lab-btn ' + (isDone ? 'lab-btn-secondary' : 'lab-btn-primary') + ' lesson-done-btn" onclick="LearnLab.toggleLesson(\'' + course.id + '\',\'' + lesson.id + '\')">' + (isDone ? 'Пройдено — снять отметку' : 'Отметить пройденным') + '</button>' +
        '</div>' +
      '</article>';
    }).join('');
    return '<div class="course-progress-line" role="progressbar" aria-valuemin="0" aria-valuemax="' + lessons.length + '" aria-valuenow="' + done + '" aria-label="Пройдено уроков"><span style="width:' + (lessons.length ? done / lessons.length * 100 : 0) + '%"></span></div>' +
      '<p class="course-progress-label">Пройдено ' + done + ' из ' + lessons.length + '</p>' +
      '<div class="lesson-list">' + cards + '</div>';
  }

  function renderLessons() {
    var p = progress();
    var cards = letters.map(function(item, index) { var status = p.letters[item.hebrew] && p.letters[item.hebrew].status || 'new'; return '<button type="button" class="learn-letter-card ' + (status === 'complete' ? 'is-complete' : status === 'progress' ? 'is-progress' : '') + '" style="animation-delay:' + index * 25 + 'ms" onclick="LearnLab.openLesson(\'' + item.hebrew + '\')"><span class="learn-letter-status" aria-label="' + (status === 'complete' ? 'завершено' : status === 'progress' ? 'в процессе' : 'не начато') + '"></span><span class="learn-letter-paleo" lang="hbo">' + item.paleo + '</span><span class="learn-letter-name">' + esc(item.name) + '</span><span class="learn-letter-image">' + esc(item.image) + '</span><span class="learn-letter-meaning">' + esc(item.meaning) + '</span></button>'; }).join('');
    return '<button type="button" class="lab-btn lab-btn-secondary learn-back" onclick="LearnLab.home()">К обучению</button><div class="learn-legend"><span>не начат</span><span class="progress">в процессе</span><span class="complete">завершён</span></div><div class="learn-letter-grid">' + cards + '</div>';
  }

  function renderLesson() {
    var item = state.lesson.item, step = state.lesson.step, choices, prompt, body;
    if (step === 1 || step === 3) { prompt = step === 1 ? 'Введите название буквы' : 'Введите значение образа'; body = '<label for="learn-answer">' + prompt + '</label><input id="learn-answer" class="learn-answer-input" autocomplete="off" autofocus placeholder="Ваш ответ">'; }
    else { choices = distractors(item); prompt = step === 2 ? 'Выберите правильный образ' : 'Выберите правильный символ'; body = '<div class="learn-options">' + choices.map(function(option) { var label = step === 2 ? option.image : option.paleo; var value = step === 2 ? option.hebrew : option.hebrew; return '<button type="button" class="learn-option" data-answer="' + esc(value) + '" onclick="LearnLab.answer(\'' + esc(value).replace(/'/g,"\\'") + '\')">' + esc(label) + '</button>'; }).join('') + '</div>'; }
    return '<div class="learn-lesson"><div class="learn-lesson-top"><div class="learn-lesson-title">' + esc(item.name) + '</div><span class="learn-step-label">Шаг ' + step + ' из 4</span></div><div class="learn-step-track">' + [1,2,3,4].map(function(n) { return '<span class="' + (n <= step ? 'active' : '') + '"></span>'; }).join('') + '</div><section class="learn-question"><div class="learn-question-symbol" lang="hbo">' + item.paleo + '</div><p>' + prompt + '</p><div class="learn-question-body">' + body + '</div><div id="learn-feedback" class="learn-feedback" role="status" aria-live="polite"></div>' + ((step === 1 || step === 3) ? '<div class="learn-answer-actions"><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.submitText()">Проверить</button></div>' : '') + '</section></div>';
  }

  function reviewItem(card) {
    var parts = String(card.id || '').split(':'), item = byKey(parts[1]) || letters[0];
    return { card:card, item:item, prompt:parts[0] === 'letter-image' ? 'Какой образ несёт этот знак?' : parts[0] === 'letter-glyph' ? 'Какой палео-глиф соответствует образу?' : 'Как называется эта буква?' };
  }

  function renderReview() {
    var card = state.review && state.review.card, view = card && reviewItem(card);
    if (!view) return '<button type="button" class="lab-btn lab-btn-secondary learn-back" onclick="LearnLab.home()">К обучению</button><div class="learn-empty"><h2>Очередь пуста</h2><p>Новых карточек и повторений пока нет.</p></div>';
    var front = card.type === 'letter-glyph' ? view.item.image : view.item.paleo;
    return '<button type="button" class="lab-btn lab-btn-secondary learn-back" onclick="LearnLab.home()">К обучению</button><section class="learn-review"><span class="learn-review-kicker">Интервальное повторение</span><div class="learn-review-symbol" lang="hbo">' + esc(front) + '</div><h2>' + esc(view.prompt) + '</h2><button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.showReviewAnswer()">Показать ответ</button><div id="learn-review-answer" class="learn-review-answer" hidden>' + esc(card.type === 'letter-image' ? view.item.image : card.type === 'letter-glyph' ? view.item.paleo : view.item.name) + '</div><div class="learn-review-grades" hidden id="learn-review-grades"><button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.gradeReview(\'again\')">Снова</button><button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.gradeReview(\'hard\')">Трудно</button><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.gradeReview(\'good\')">Хорошо</button><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.gradeReview(\'easy\')">Легко</button></div></section>';
  }

  function renderGame() {
    var game = state.game;
    if (game.done) return '<div class="learn-game"><div class="learn-result"><h1>Раунд завершён</h1><div class="learn-result-score">' + game.score + '</div><p>Очков набрано. Рекорд: <strong>' + record() + '</strong>.</p><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.openGame()">Играть снова</button></div></div>';
    var choices = game.choices; return '<div class="learn-game"><div class="learn-game-bar"><div class="learn-game-metric">Раунд <strong>' + game.round + '/10</strong></div><div class="learn-game-metric">Счёт <strong>' + game.score + '</strong></div><div class="learn-game-metric learn-timer ' + (game.time <= 8 ? 'is-low' : '') + '">Время <strong>' + game.time + 'с</strong></div></div><div class="learn-game-symbol"><small>Какой образ несёт этот знак?</small><span class="symbol" lang="hbo">' + game.item.paleo + '</span></div><div class="learn-options learn-game-options">' + choices.map(function(option) { return '<button type="button" class="learn-option" data-answer="' + esc(option.hebrew) + '" onclick="LearnLab.gameAnswer(\'' + option.hebrew + '\')">' + esc(option.image) + '</button>'; }).join('') + '</div><div id="learn-game-feedback" class="learn-game-feedback" role="status" aria-live="polite"></div></div>';
  }

  /* ===== ПАЛЕО-ТРЕНАЖЁР ===== */
  var THEMES = ['сила', 'путь', 'вместилище', 'связь', 'поток', 'захват'];
  var THEME_LETTERS = {
    'сила': ['א'],
    'путь': ['ג', 'ד', 'ל', 'ר', 'ה'],
    'вместилище': ['ב', 'כ', 'ס', 'ק'],
    'связь': ['ו', 'ת'],
    'поток': ['מ', 'נ'],
    'захват': ['צ', 'ז', 'ש']
  };
  var rootsCache = null;
  var rootsRequest = null;

  function loadRoots() {
    if (Array.isArray(rootsCache)) return Promise.resolve(rootsCache);
    if (!rootsRequest) {
      rootsRequest = fetch('data/roots/roots.json').then(function(resp) {
        if (!resp.ok) throw new Error('roots.json HTTP ' + resp.status);
        return resp.json();
      }).then(function(data) { rootsCache = Array.isArray(data) ? data : []; return rootsCache; }).catch(function() { rootsCache = []; return rootsCache; });
    }
    return rootsRequest;
  }

  function normalizeRootWord(value) {
    var norm = (root.PaleoLetters && root.PaleoLetters.normalizeHebrew) ? root.PaleoLetters.normalizeHebrew(value) : String(value || '');
    return Array.from(norm).filter(function(ch) { return LETTER_KEYS.indexOf(ch) !== -1; }).join('');
  }

  function pickLetterItem() {
    return letters[Math.floor(Math.random() * letters.length)];
  }

  function pickRootByTheme(theme) {
    return loadRoots().then(function(roots) {
      var allowed = THEME_LETTERS[theme] || THEME_LETTERS['сила'];
      var candidates = roots.filter(function(r) {
        var n = normalizeRootWord(r && r.root);
        return n.length >= 2 && n.length <= 6 && Array.from(n).every(function(ch) { return allowed.indexOf(ch) !== -1; });
      });
      if (!candidates.length) {
        candidates = roots.filter(function(r) {
          var n = normalizeRootWord(r && r.root);
          return n.length >= 2 && n.length <= 6 && Array.from(n).some(function(ch) { return allowed.indexOf(ch) !== -1; });
        });
      }
      if (!candidates.length) {
        candidates = roots.filter(function(r) { var n = normalizeRootWord(r && r.root); return n.length >= 2 && n.length <= 6; });
      }
      return candidates[Math.floor(Math.random() * candidates.length)] || null;
    });
  }

  function glyphEntriesForRoot(entry) {
    var n = normalizeRootWord(entry && entry.root);
    return Array.from(n).map(function(ch) {
      var item = byKey(ch);
      return item ? { hebrew: ch, paleo: item.paleo, name: item.name, image: item.image, meaning: item.meaning } : { hebrew: ch, paleo: ch, name: '', image: '', meaning: '' };
    }).filter(function(g) { return g.meaning; });
  }

  function trainerChainMarkup(entries) {
    return entries.map(function(g) {
      return '<div class="learn-trainer-chain-item"><span class="learn-trainer-chain-glyph" lang="hbo">' + g.paleo + '</span><span class="learn-trainer-chain-name">' + esc(g.name) + '</span><span class="learn-trainer-chain-desc">' + esc(g.image) + ' · ' + esc(g.meaning) + '</span></div>';
    }).join('');
  }

  function weaverReading(entries) {
    var meanings = entries.map(function(g) { return g.meaning; });
    if (root.PaleoWeaver && root.PaleoWeaver.wordReading && meanings.length) {
      try { return root.PaleoWeaver.wordReading(meanings); } catch (e) {}
    }
    return meanings.join(' → ') || 'образ требует проверки';
  }

  function markLettersLearned(entries) {
    var p = progress(), changed = false;
    (entries || []).forEach(function(g) {
      if (g && g.hebrew && (!p.letters[g.hebrew] || p.letters[g.hebrew].status !== 'complete')) {
        p.letters[g.hebrew] = { status: 'complete', score: 0, attempts: (p.letters[g.hebrew] && p.letters[g.hebrew].attempts || 0) + 1, lastActivity: now(), source: 'trainer' };
        srsLetterCards(byKey(g.hebrew)).forEach(function(def) { srsSchedule(def.id, def.type, def.label, 'hard'); });
        changed = true;
      }
    });
    if (changed) touch(p);
    return p;
  }

  function initTrainer() {
    state.trainer = { rootEntry:null, entries:[], theme:'поток', revealed:false, wordIndex:0, totalWords:300, answer:'' };
  }

  function trainerReady() {
    if (!state.trainer) initTrainer();
    return state.trainer;
  }

  function buildTrainerWord(themeId) {
    var t = trainerReady();
    var theme = themeId || t.theme || 'поток';
    return pickRootByTheme(theme).then(function(entry) {
      t.theme = theme;
      t.rootEntry = entry;
      t.entries = glyphEntriesForRoot(entry);
      t.revealed = false;
      t.answer = '';
      t.wordIndex = (t.wordIndex || 0) + 1;
      t.totalWords = rootsCache && rootsCache.length ? rootsCache.length : 300;
      return t;
    });
  }

  function trainerKeywords(t) {
    var text = [t.rootEntry && t.rootEntry.meaning, t.rootEntry && t.rootEntry.image].join(' ').toLocaleLowerCase('ru-RU');
    return text.split(/[^а-яёa-z]+/i).filter(function(word) { return word.length > 3; });
  }

  function comparisonMarkup(t) {
    var answer = String(t.answer || '').trim();
    var keywords = trainerKeywords(t);
    var source = answer || 'Ответ не записан';
    return source.split(/(\s+)/).map(function(word) {
      var clean = word.toLocaleLowerCase('ru-RU').replace(/[^а-яёa-z]/gi, '');
      return clean && keywords.indexOf(clean) !== -1 ? '<mark>' + esc(word) + '</mark>' : esc(word);
    }).join('') + ' <span class="learn-trainer-compare-arrow">↔</span> ' + esc((t.rootEntry && (t.rootEntry.image || t.rootEntry.meaning)) || 'сборка');
  }

  function battleCards() {
    return loadRoots().then(function(roots) {
      var built = root.PaleoBattle && root.PaleoBattle.makeCards ? root.PaleoBattle.makeCards(roots, letters) : [];
      return built.length ? built : (root.PaleoBattle ? root.PaleoBattle.fallbackCards() : []);
    });
  }
  function initBattle() {
    if (!root.PaleoBattle) return;
    var saved = root.PaleoBattle.load ? root.PaleoBattle.load() : null;
    state.battle = saved && saved.status !== 'finished' ? saved : state.battle;
  }
  function battleReady() {
    initBattle();
    return state.battle;
  }
  function battleInput(id, label, value, placeholder) {
    return '<label class="learn-battle-field" for="' + id + '">' + label + '<input id="' + id + '" class="learn-answer-input" autocomplete="off" value="' + esc(value || '') + '" placeholder="' + placeholder + '"></label>';
  }
  function renderBattle() {
    var match = battleReady();
    if (!match) {
      battleCards().then(function(cards) { state.battle = root.PaleoBattle.createMatch(cards); root.PaleoBattle.save(state.battle); render(); });
      return '<div class="learn-battle-shell"><p class="learn-trainer-loading">Собираем колоду…</p></div>';
    }
    if (match.status === 'finished') return renderBattleResult(match);
    var card = match.cards[match.round], review = match.status === 'review' ? match.history[match.history.length - 1] : null;
    if (review) return '<div class="learn-battle-shell"><div class="learn-battle-head"><strong>Проверка раунда ' + review.round + '</strong><span>' + esc(match.players[review.player].name) + ': +' + review.result.points + '</span></div><div class="learn-battle-review"><span class="learn-battle-word" lang="hbo">' + esc(card.word) + '</span><p><b>Образ:</b> ' + esc(card.image) + '</p><p><b>Функция:</b> ' + esc(card.function) + '</p><p><b>Реконструкция:</b> ' + esc(card.reconstruction) + '</p><p><b>Статус:</b> ' + esc(card.status) + ' · <b>Источник:</b> ' + esc(card.source) + '</p></div><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.battleNext()">Следующий ход</button></div>';
    return '<div class="learn-battle-shell"><div class="learn-battle-head"><span>РАУНД ' + (match.round + 1) + '/' + match.cards.length + ' · ход ' + (match.currentPlayer + 1) + '</span><strong>' + esc(match.players[0].name) + ' ' + match.players[0].score + ' : ' + match.players[1].score + ' ' + esc(match.players[1].name) + '</strong></div><p class="learn-battle-note">Локальная комната: ответы остаются в этом браузере. Игроки по очереди проходят одну карточку.</p><div class="learn-battle-prompt"><span class="learn-battle-word" lang="hbo">' + card.chain.map(function(part) { return esc(part.paleo); }).join(' ') + '</span><p>Соберите слово, назовите действие механики и отделите факт от интерпретации.</p></div><div class="learn-battle-form">' + battleInput('battle-sequence', 'Буквенная цепочка', '', 'например: אב') + battleInput('battle-image', 'Образ', '', 'что видите в цепочке') + battleInput('battle-function', 'Функция / действие', '', 'что делает механика') + battleInput('battle-explanation', 'Краткое объяснение', '', 'не менее одной фразы') + '<label class="learn-battle-field">Уверенность<select id="battle-confidence"><option>высокая</option><option>средняя</option><option>низкая</option></select></label><label class="learn-battle-field">Статус<select id="battle-status">' + root.PaleoBattle.STATUS.map(function(status) { return '<option>' + status + '</option>'; }).join('') + '</select></label></div><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.battleSubmit()">Проверить ответ</button></div>';
  }
  function renderBattleResult(match) {
    var winner = root.PaleoBattle.winner(match), label = winner === 'draw' ? 'Ничья' : 'Победитель: ' + match.players[winner].name;
    return '<div class="learn-battle-shell"><div class="learn-battle-result"><h2>Матч завершён</h2><p class="learn-battle-winner">' + esc(label) + '</p><div class="learn-battle-scores"><strong>' + esc(match.players[0].name) + ': ' + match.players[0].score + '</strong><strong>' + esc(match.players[1].name) + ': ' + match.players[1].score + '</strong></div><p>Достижения: ' + esc(root.PaleoBattle.achievements(match).join(' · ') || 'первые шаги') + '</p><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.newBattle()">Новый матч</button></div></div>';
  }

  function weaverReading(entries) {
    var meanings = (entries || []).map(function(g) { return g.meaning; }).filter(Boolean);
    var reading = '';
    if (root.PaleoWeaver && root.PaleoWeaver.wordReading && meanings.length) {
      try { reading = root.PaleoWeaver.wordReading(meanings); } catch (e) {}
    }
    if (!reading || reading === 'образ требует проверки') reading = meanings.join(' → ') || 'образ требует проверки';
    // Не повторяем глагол-состояние в роли действия: разрушение не разрушает.
    if (meanings.length > 1) {
      var subject = meanings[0], verbs = ['направление','фиксация','разрушение','действие','откровение','захват'];
      var verb = verbs.filter(function(v) { return meanings.indexOf(v) !== -1 && v !== subject; })[0] || 'остановка';
      var forms = { направление:'направляет', фиксация:'фиксирует', разрушение:'разрушает', действие:'действует', откровение:'открывает', захват:'захватывает', остановка:'останавливает' };
      var cognate = forms[subject];
      if (cognate && reading.indexOf(subject + ',') === 0 && reading.indexOf(cognate) !== -1) {
        reading = reading.replace(cognate, forms[verb] || forms.остановка);
      }
    }
    return reading;
  }

  function renderTrainer() {
    var t = trainerReady();
    if (!t.entries.length) {
      buildTrainerWord(t.theme).then(render);
      return '<div class="learn-trainer-shell"><div class="learn-trainer"><p class="learn-trainer-loading">Собираем слово…</p></div></div>';
    }
    var p = progress();
    var letterBar = LETTER_KEYS.map(function(key) {
      var done = p.letters[key] && p.letters[key].status === 'complete';
      return '<span class="learn-trainer-letter-dot' + (done ? ' is-complete' : '') + '" title="' + esc(key) + '"></span>';
    }).join('');
    var themeOptions = THEMES.map(function(theme) { return '<option value="' + esc(theme) + '"' + (t.theme === theme ? ' selected' : '') + '>' + esc(theme) + '</option>'; }).join('');
    var chain = trainerChainMarkup(t.entries);
    var reading = weaverReading(t.entries);
    var badge = 'высокая · эмет';
    var reveal = t.revealed ? '<div class="learn-trainer-reveal"><div class="learn-trainer-word-gloss"><strong>' + esc(t.rootEntry.root || 'Корень') + '</strong><span> · ' + esc(t.rootEntry.translit || '') + '</span><span> · ' + esc(t.rootEntry.meaning || t.rootEntry.image || '') + '</span></div><p class="learn-trainer-author-meaning">' + esc(reading) + '</p><div class="learn-trainer-chain">' + chain + '</div><p class="learn-trainer-comparison"><strong>Твой ответ ↔ Сборка</strong><span>' + comparisonMarkup(t) + '</span></p><span class="learn-trainer-confidence">уверенность сборки: ' + badge + '</span></div>' : '';
    return '<div class="learn-trainer-shell"><div class="learn-trainer"><div class="learn-trainer-head"><span class="learn-trainer-counter">СЛОВО ' + t.wordIndex + '/' + (t.totalWords || 300) + '</span><span class="learn-trainer-progress" aria-label="Прогресс по буквам">' + letterBar + '</span></div><div class="learn-trainer-word"><label class="learn-trainer-theme-select">Тема <select class="learn-trainer-theme" aria-label="Тема генерации" onchange="LearnLab.trainerTheme(this.value)">' + themeOptions + '</select></label><div class="learn-trainer-glyphs" lang="hbo" aria-label="Палео-слово">' + t.entries.map(function(g) { return '<span class="learn-trainer-big">' + g.paleo + '</span>'; }).join('') + '</div><p class="learn-trainer-direction">‹‹‹ читается справа налево</p></div><label class="learn-trainer-prompt" for="trainer-answer">Что значит это слово?</label><div class="learn-trainer-answer"><input id="trainer-answer" class="learn-answer-input" autocomplete="off" placeholder="Ваш смысл слова" value="' + esc(t.answer || '') + '" oninput="LearnLab.trainerAnswer(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();LearnLab.revealTrainer();}"></div><div class="learn-trainer-actions"><button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.revealTrainer()">Показать разбор</button><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.generateWord()">Сгенерировать слово</button><button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.nextTrainer()">Дальше</button></div>' + reveal + '</div></div>';
  }
  /* Шапка модуля следует за внутренним экраном (реестр LabHero.views). */
    function applyHero() {
    if (!root.LabHero || !root.LabHero.setView) return;
    if (state.view === 'course' && state.course) {
      var course = state.course, lessons = course.lessons || [];
      root.LabHero.setView('learn', 'course', { title: course.title, subtitle: course.description, meta: [course.level + ' · ' + lessons.length + ' уроков'] });
    } else if (state.view === 'lesson' && state.lesson) {
      var item = state.lesson.item;
      root.LabHero.setView('learn', 'lesson', { title: item.name, subtitle: item.image + ' · ' + item.meaning });
    } else if (state.view === 'game' && state.game) {
      root.LabHero.setView('learn', 'game');
    } else if (state.view === 'review') {
      root.LabHero.setView('learn', 'review', { title: 'Повторение', subtitle: 'Вернуть буквы в поле зрения через интервалы' });
    } else if (state.view === 'trainer') {
      root.LabHero.setView('learn', 'paleo-trainer');
    } else if (state.view === 'battle') {
      root.LabHero.setView('learn', 'paleo-trainer', { title: 'Палео-битва', subtitle: 'Два исследователя · пять карточек · local-first' });
    } else if (state.view === 'lessons' || state.view === 'courses') {
      root.LabHero.setView('learn', state.view);
    } else {
      root.LabHero.setView('learn', null);
    }
  }
  function render() { var container = getContainer(); if (!container || !letters.length) return; if (state.view === 'lessons') container.innerHTML = renderLessons(); else if (state.view === 'lesson') container.innerHTML = renderLesson(); else if (state.view === 'review') container.innerHTML = renderReview(); else if (state.view === 'game') container.innerHTML = renderGame(); else if (state.view === 'courses') container.innerHTML = renderCourses(); else if (state.view === 'course') container.innerHTML = renderCourse(); else if (state.view === 'trainer') container.innerHTML = renderTrainer(); else if (state.view === 'battle') container.innerHTML = renderBattle(); else container.innerHTML = renderHome(); applyHero(); }
  function markStarted(item) { var p = progress(); if (!p.letters[item.hebrew] || p.letters[item.hebrew].status !== 'complete') p.letters[item.hebrew] = {status:'progress',score:0}; touch(p); }
  function feedback(text, ok) { var el = document.getElementById('learn-feedback'); if (el) { el.textContent = text; el.className = 'learn-feedback ' + (ok ? 'is-correct' : 'is-wrong'); } }
  function advance(ok) { if (!ok) return; state.lesson.score++; if (state.lesson.step < 4) { state.lesson.step++; render(); } else { var p = progress(), item = state.lesson.item; p.letters[item.hebrew] = {status:'complete',score:state.lesson.score,attempts:(p.letters[item.hebrew] && p.letters[item.hebrew].attempts || 0) + 1,lastActivity:now()}; srsLetterCards(item).forEach(function(def) { srsSchedule(def.id, def.type, def.label, state.lesson.score >= 4 ? 'good' : 'hard'); }); touch(p); state.view = 'lesson'; state.lesson.done = true; render(); } }

  var api = {
    init: function() { if (!letters.length) loadLetters(); render(); },
    home: function() { navigate([]); },
    openLessons: function() { navigate(['lessons']); },
    openReview: function() { navigate(['review']); },
    showReviewAnswer: function() { var answer = document.getElementById('learn-review-answer'), grades = document.getElementById('learn-review-grades'); if (answer) answer.hidden = false; if (grades) grades.hidden = false; },
    gradeReview: function(grade) { if (!state.review || !state.review.card) return; srsSchedule(state.review.card.id, state.review.card.type, state.review.card.label, grade); state.review = { card:queueReview() }; render(); },
    openLesson: function(key) { var item = byKey(key); if (!item) return; markStarted(item); navigate(['lessons', encodeURIComponent(key)]); },
    submitText: function() { var input = document.getElementById('learn-answer'), step = state.lesson.step, expected = step === 1 ? state.lesson.item.name : state.lesson.item.meaning; if (!input) return; var ok = inputMatch(input.value, expected); if (ok) advance(true); else feedback('Пока не совпало. Попробуйте ещё раз.', false); },
    answer: function(key) { var ok = key === state.lesson.item.hebrew; if (ok) advance(true); else feedback('Это другой образ. Попробуйте ещё раз.', false); },
    openGame: function() { navigate(['game']); },
    openCourses: function() { navigate(['courses']); },
    openTrainer: function() { navigate(['paleo-trainer']); },
    openBattle: function() { navigate(['paleo-trainer', 'battle']); },
    newBattle: function() { battleCards().then(function(cards) { state.battle = root.PaleoBattle.createMatch(cards); root.PaleoBattle.save(state.battle); render(); }); },
    battleSubmit: function() { var match = battleReady(), answer = { sequence: (document.getElementById('battle-sequence') || {}).value, image: (document.getElementById('battle-image') || {}).value, function: (document.getElementById('battle-function') || {}).value, explanation: (document.getElementById('battle-explanation') || {}).value, confidence: (document.getElementById('battle-confidence') || {}).value, status: (document.getElementById('battle-status') || {}).value }; root.PaleoBattle.submitRound(match, answer); root.PaleoBattle.save(match); render(); },
    battleNext: function() { var match = battleReady(); root.PaleoBattle.nextRound(match); root.PaleoBattle.save(match); render(); },
    trainerTheme: function(theme) { var t = trainerReady(); if (THEMES.indexOf(theme) === -1) return; buildTrainerWord(theme).then(render); },
    trainerAnswer: function(value) { trainerReady().answer = String(value || ''); },
    revealTrainer: function() { var t = trainerReady(); if (!t.entries.length) return; t.revealed = true; markLettersLearned(t.entries); render(); },
    nextTrainer: function() { var t = trainerReady(); if (t.entries.length) markLettersLearned(t.entries); buildTrainerWord(t.theme).then(render); },
    generateWord: function() { var t = trainerReady(); buildTrainerWord(t.theme).then(render); },
    applyRoute: applyRoute,
    routeTitle: routeTitle,
    toggleLesson: function(courseId, lessonId) { var p = courseProgress(); if (p.lessons[lessonId]) delete p.lessons[lessonId]; else p.lessons[lessonId] = { course: courseId, done: true, at: now() }; write(COURSE_KEY, p); render(); },
    gameAnswer: function(key) { var game=state.game; if (!game || game.locked) return; game.locked=true; var ok=key===game.item.hebrew, earned=0; if(ok){game.streak++; earned=10*(game.streak >= 3 ? 3 : game.streak === 2 ? 2 : 1); game.score+=earned;} else {game.streak=0; game.score=Math.max(0,game.score-5);} render(); var feedbackEl=document.getElementById('learn-game-feedback'); if(feedbackEl){feedbackEl.textContent=ok ? 'Верно! +' + earned + ' очков' : 'Неверно. Правильный образ: ' + game.item.image; feedbackEl.className='learn-game-feedback ' + (ok?'correct':'wrong');} setTimeout(function(){ if(!state.game || state.game !== game) return; if(game.round >= 10) finishGame(); else {game.round++; nextRound();} },700); },
    openCourse: function(id) { navigate(['courses', encodeURIComponent(id)]); },
    reset: function() { if (!window.LabModal) return; window.LabModal.show('Сбросить прогресс?', '<p class="learn-hub-reset-text">Будут удалены уроки букв, очередь повторения и рекорд игры, сохранённые в этом браузере. Прогресс курсов останется.</p>', '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Отмена</button><button type="button" class="lab-btn lab-btn-primary lab-btn-sm learn-danger" onclick="LearnLab.resetConfirm()">Сбросить</button>'); },
    resetConfirm: function() { localStorage.removeItem(PROGRESS_KEY); localStorage.removeItem(RECORD_KEY); localStorage.removeItem(SRS_KEY); state.trainer = null; state.review = null; if (window.LabModal) window.LabModal.close(); navigate([]); render(); },
    startFirst: function() { navigate(['lessons', encodeURIComponent(LETTER_KEYS[0])]); },
    continueLast: function() { var dest = lastDestination(); navigate(dest ? dest.segments : ['review']); }
  };
  function nextRound() { var item=letters[Math.floor(Math.random()*letters.length)]; state.game.item=item; state.game.choices=distractors(item); state.game.locked=false; render(); }
  function finishGame() { stopTimer(); state.game.done=true; var best=Math.max(record(),state.game.score); localStorage.setItem(RECORD_KEY,String(best)); render(); }
  function stopTimer() { if(state.timer){clearInterval(state.timer);state.timer=null;} }
  function startTimer() { stopTimer(); state.timer=setInterval(function(){ if(!state.game || state.game.done) return stopTimer(); state.game.time--; if(state.game.time<=0){state.game.time=0; finishGame();} else render(); },1000); }
  root.LearnLab = api;
}(typeof window !== 'undefined' ? window : this));

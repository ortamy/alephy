/* Обучение: 22 буквы, четыре шага урока и игра «Угадай образ». */
(function(root) {
  'use strict';

  var PROGRESS_KEY = 'alephy_learn_progress';
  var RECORD_KEY = 'alephy_guess_record';
  var COURSE_KEY = 'alephy_course_progress';
  var COURSE_OPEN_KEY = 'alephy_course_open';
  var SRS_KEY = 'alephy_srs_cards';
  var HUB_VIEW_KEY = 'alephy_learn_hub_view';
  var LETTER_KEYS = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];
  var fallback = [
    ['א','𐤀','Алеф','бык','сила'],['ב','𐤁','Бет','дом','вместилище'],['ג','𐤂','Гимель','верблюд','движение'],['ד','𐤃','Далет','дверь','вход'],['ה','𐤄','Хе','дыхание','откровение'],['ו','𐤅','Вав','крюк','соединение'],['ז','𐤆','Заин','оружие','инструмент'],['ח','𐤇','Хет','ограда','отделение'],['ט','𐤈','Тет','змея','оборачивание'],['י','𐤉','Йод','рука','действие'],['כ','𐤊','Каф','ладонь','удержание'],['ל','𐤋','Ламед','посох','направление'],['מ','𐤌','Мем','вода','течение'],['נ','𐤍','Нун','рыба','жизнь'],['ס','𐤎','Самех','опора','поддержка'],['ע','𐤏','Аин','глаз','видение'],['פ','𐤐','Пе','рот','речь'],['צ','𐤑','Цаде','крюк','цель'],['ק','𐤒','Коф','игла','окружение'],['ר','𐤓','Реш','голова','начало'],['ש','𐤔','Шин','зуб','разрушение'],['ת','𐤕','Тав','знак','печать']
  ];
  var letters = [];
  var state = { view:'home', lesson:null, game:null, timer:null, course:null, trainer:null, review:null, battle:null };
  /* Тулбар хаба: запрос, фильтр раздела и вид каталога (карточки/список). */
  var hubState = { query:'', filter:'all', view: read(HUB_VIEW_KEY, 'cards') === 'list' ? 'list' : 'cards' };
  /* Каталог букв: запрос и фильтр по статусу. Состояние живёт в памяти
     модуля — это временный срез каталога, а не вид, ради сохранения
     которого в localStorage стоит отдавать место. */
  var lettersState = { query:'', filter:'all' };

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
    if (route === 'learn/review') return 'Повторение';
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
    stopBattleTimer();
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
      startReview();
      bindReviewKeys();
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
      state.courseOpenModule = course ? readCourseOpen(course.id) : null;
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


  function courseNumber(num) {
    return String(num).padStart(2, '0');
  }
  function courseProgress() { var value = read(COURSE_KEY, { lessons: {} }); if (!value.lessons) value.lessons = {}; return value; }

  function courseProgressFrac(course) {
    var p = courseProgress();
    var lessons = course.lessons || [];
    var done = 0, total = lessons.length;
    for (var i = 0; i < lessons.length; i++) {
      if (p.lessons[lessons[i].id]) done++;
    }
    return total === 0 ? null : done / total;
  }
  function courseHubCategory(course) {
    var frac = courseProgressFrac(course);
    if (frac === null) return 'new';
    if (frac >= 1) return 'done';
    if (frac > 0) return 'in-progress';
    return 'started';
  }
  function courseHubStatus(course) {
    var frac = courseProgressFrac(course);
    if (frac === null) return 'new';
    if (frac >= 1) return 'done';
    if (frac > 0) return 'progress';
    return 'new';
  }
  /* Подпись уровня нужна и карточке, и поиску по курсам. */
  function courseLevelLabel(course) {
    return course.levelKey === 'from-zero' ? 'с нуля' : course.levelKey === 'advanced' ? 'продвинутый' : 'базовый';
  }

  function courseHubCard(course, index) {
    var number = courseNumber(index + 1);
    var frac = courseProgressFrac(course);
    var status = courseHubStatus(course);
    var statusDotClass = status === 'done' ? 'is-done' : status === 'progress' ? 'is-progress' : 'is-new';
    var levelLabel = courseLevelLabel(course);
    var modulesLabel = course.modules + ' ' + (course.modules === 1 ? 'модуль' : course.modules < 5 ? 'модуля' : 'модулей');
    var progressHtml = (frac !== null && frac > 0) ? '<div class="course-hub-progress"><span style="width:' + (frac * 100) + '%"></span></div>' : '';
    var title = esc(course.title);
    var desc = esc(course.description);
    var ariaLabel = title + ', ' + levelLabel + ', ' + modulesLabel + ', статус: ' + (status === 'done' ? 'освоен' : status === 'progress' ? 'в работе' : 'новый');
    return '<div class="course-hub-card" data-course-id="' + esc(course.id) + '" style="animation-delay:' + (index * 60) + 'ms" role="button" tabindex="0" aria-label="' + ariaLabel + '" onclick="LearnLab.openCourse(\'' + esc(course.id) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();LearnLab.openCourse(\'' + esc(course.id) + '\');}">' +
      '<div class="course-hub-head">' +
        '<span class="course-hub-chip">' + number + '</span>' +
        '<div class="course-hub-meta">' +
          '<span class="course-hub-level">' + esc(levelLabel) + '</span>' +
          '<span class="course-hub-modules">' + modulesLabel + '</span>' +
          '<span class="learn-hub-dot ' + statusDotClass + '"></span>' +
        '</div>' +
      '</div>' +
      '<h3 class="course-hub-title">' + title + '</h3>' +
      '<p class="course-hub-desc">' + desc + '</p>' +
      progressHtml +
    '</div>';
  }
  function sortedCourses() {
    var list = (root.AlephyCourses && root.AlephyCourses.list) || [];
    return list.slice().sort(function(a, b) {
      var aCat = courseHubCategory(a);
      var bCat = courseHubCategory(b);
      var order = { 'in-progress': 1, 'done': 2, 'started': 3, 'new': 4 };
      if (order[aCat] !== order[bCat]) return order[aCat] - order[bCat];
      return (a.title || '').localeCompare(b.title || '');
    });
  }
  /* Группа курсов получает уже отобранные карточки: счётчик в бейдже
     показывает то, что видно после поиска и фильтра. */
  function courseHubGroup(cards) {
    return '<div class="learn-hub-group course-hub-group">' +
      '<div class="learn-hub-group-head">' +
        '<span class="learn-hub-group-label">КУРСЫ</span>' +
        '<span class="learn-hub-group-rule" aria-hidden="true"></span>' +
        '<span class="learn-hub-group-badge">' + cards.length + '</span>' +
      '</div>' +
      '<div class="course-hub-cards">' + cards.join('') + '</div>' +
    '</div>';
  }

  function emptyStateMarkup() {
    return '<div class="learn-hub-empty"><span class="learn-hub-empty-glyph" lang="hbo" aria-hidden="true">𐤀</span><div class="learn-hub-empty-body"><h2>Поле пока пусто</h2><p>Ни одна буква ещё не начата. Алеф ждёт: первый урок вернёт глазу древнего читателя предметный образ — от знака к действию.</p></div><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.startFirst()">Начать первый урок</button></div>';
  }

  function renderCourses() {
    var list = sortedCourses();
    var cards = [];
    for (var i = 0; i < list.length; i++) cards.push(courseHubCard(list[i], i));
    return '<div class="course-hub-cards course-page-grid">' + cards.join('') + '</div>';
  }

  /* ===== Тулбар хаба: поиск, фильтры, счётчик, вид каталога =====
     Каркас — общая плашка §4.7 (css/components/toolbar.css): одна строка
     «поиск → чипы-фильтры → счётчик и тумблер вида», как в конвейерах и
     агентах. Карточки хаба описываются данными, поэтому поиск и счётчик
     работают по тем же полям, что видит пользователь. */
  function practiceCardItems() {
    var p = progress(), completed = completedLetters(), srs = srsStats();
    var trainerCount = Object.keys(p.letters).filter(function(key) { return p.letters[key] && p.letters[key].source === 'trainer'; }).length;
    return [
      hubItem('practice', { glyph:'𐤀', title:'Изучение иврита', desc:'22 урока по буквам: название, образ, значение и узнавание знака.', meta: completed + '/22 ' + (window.LabPluralWord ? LabPluralWord(22, 'буква', 'буквы', 'букв') : 'букв'), status: completed === 0 ? 'new' : (completed === 22 ? 'done' : 'progress'), bar: completed / 22, onClick:'LearnLab.openLessons()' }),
      hubItem('practice', { glyph:'𐤕', title:'Повторение', desc:'Короткая очередь карточек, которым пора вернуться в поле зрения.', meta: srs.total === 0 ? 'очередь пуста' : (srs.due > 0 ? srs.due + ' к повторению' : 'всё повторено'), status: srs.total === 0 ? 'new' : (srs.due > 0 ? 'progress' : 'done'), bar: srs.total ? srs.learned / srs.total : null, onClick:'LearnLab.openReview()' }),
      hubItem('practice', { glyph:'𐤏', title:'Палео-тренажёр', desc:'Крупные палео-буквы: увидь образ, назови функцию, собери смысл.', meta: '6 тем · корни и смыслы', status: trainerCount > 0 ? 'progress' : 'new', bar: completed / 22, onClick:'LearnLab.openTrainer()' })
    ];
  }

  function gameCardItems() {
    var battleStored = !!(root.PaleoBattle && root.PaleoBattle.STORAGE_KEY && read(root.PaleoBattle.STORAGE_KEY, null));
    return [
      hubItem('games', { glyph:'𐤔', title:'Угадай образ', desc:'Раунд на скорость: знак — к предметному образу, серия растёт.', meta: 'рекорд ' + record() + ' очков', status: record() > 0 ? 'progress' : 'new', bar: null, onClick:'LearnLab.openGame()' }),
      hubItem('games', { glyph:'⚔', title:'Палео-битва', desc:'Матч на проверку чтения: тема, режим, состав исследователей и разбор каждого хода.', meta: battleStored ? 'матч в работе' : '4 режима · 6 тем', status: battleStored ? 'progress' : 'new', bar: null, onClick:'LearnLab.openBattle()' })
    ];
  }

  /* Курс хранит исходный номер: индекс в отсортированном списке не сбивается
     поиском, и карточка не меняет номер курса на «01» после фильтра. */
  function courseCardItems() {
    var list = sortedCourses();
    return list.map(function(course, index) {
      var levelLabel = courseLevelLabel(course);
      return { group:'courses', course:course, index:index, search:(course.title + ' ' + course.description + ' ' + levelLabel + ' курс').toLowerCase() };
    });
  }

  function hubItem(group, card) {
    return { group:group, card:card, search:(card.title + ' ' + card.desc + ' ' + card.meta).toLowerCase() };
  }

  function hubItems() { return practiceCardItems().concat(gameCardItems(), courseCardItems()); }

  function hubNormalize(value) { return String(value || '').trim().toLowerCase().replace(/ё/g, 'е'); }

  function hubItemVisible(item) {
    if (hubState.filter !== 'all' && item.group !== hubState.filter) return false;
    var query = hubNormalize(hubState.query);
    return !query || hubNormalize(item.search).indexOf(query) !== -1;
  }

  function hubItemMarkup(item) { return item.course ? courseHubCard(item.course, item.index) : hubCard(item.card); }

  function hubFilterChip(value, label) {
    var active = hubState.filter === value;
    return '<button type="button" class="pipeline-chip' + (active ? ' active' : '') + '" data-learn-filter="' + value + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + label + '</button>';
  }

  function hubToolbarMarkup(items, shown) {
    var listView = hubState.view === 'list';
    return '<section class="lab-toolbar" role="search" aria-label="Управление разделами обучения">' +
        '<input type="search" class="lab-input lab-toolbar-search" id="learn-hub-search" autocomplete="off" placeholder="Поиск по практикуму и курсам…" aria-label="Поиск по практикуму и курсам" value="' + esc(hubState.query).replace(/"/g, '&quot;') + '">' +
        '<div class="lab-toolbar-group" role="group" aria-label="Фильтр по разделам">' +
          hubFilterChip('all', 'Все') + hubFilterChip('practice', 'Практика') + hubFilterChip('games', 'Игры') + hubFilterChip('courses', 'Курсы') +
        '</div>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count" data-learn-count aria-live="polite"><strong>' + shown.length + '</strong> из ' + items.length + '</span>' +
          '<div class="lab-toolbar-segment" role="group" aria-label="Вид каталога">' +
            '<button type="button" class="res-view-btn' + (listView ? '' : ' active') + '" data-learn-view="cards" aria-label="Карточки" title="Карточки" aria-pressed="' + (listView ? 'false' : 'true') + '"><i data-lucide="layout-grid" aria-hidden="true"></i></button>' +
            '<button type="button" class="res-view-btn' + (listView ? ' active' : '') + '" data-learn-view="list" aria-label="Список" title="Список" aria-pressed="' + (listView ? 'true' : 'false') + '"><i data-lucide="list" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* «Карточка дня» живёт при практике и не мешает фильтру по играм/курсам. */
  function hubBodyMarkup(shown) {
    if (!shown.length) return '<div class="lab-alert lab-alert-info">По запросу ничего не найдено.</div>';
    var practice = shown.filter(function(item) { return item.group === 'practice'; }).map(hubItemMarkup);
    var games = shown.filter(function(item) { return item.group === 'games'; }).map(hubItemMarkup);
    var courses = shown.filter(function(item) { return item.group === 'courses'; }).map(hubItemMarkup);
    var quiet = !hubNormalize(hubState.query) && hubState.filter !== 'courses';
    return (practice.length ? hubGroup('Практика', practice, quiet ? dayCardMarkup() : '') : '') +
      (games.length ? hubGroup('Игры', games) : '') +
      (courses.length ? courseHubGroup(courses) : '');
  }

  /* Живое обновление: перерисовывается только тело хаба, поэтому поле поиска
     сохраняет фокус и позицию каретки — ввод не «дёргается». */
  function refreshHub(container) {
    var body = container.querySelector('#learn-hub-body');
    if (!body) return;
    var items = hubItems(), shown = items.filter(hubItemVisible);
    body.innerHTML = hubBodyMarkup(shown);
    body.classList.toggle('is-list', hubState.view === 'list');
    var count = container.querySelector('[data-learn-count]');
    if (count) count.innerHTML = '<strong>' + shown.length + '</strong> из ' + items.length;
    if (window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons(); } catch (error) { /* не критично */ } }
  }

  function bindHubToolbar(container) {
    var search = container.querySelector('#learn-hub-search');
    if (search) search.addEventListener('input', function() { hubState.query = this.value; refreshHub(container); });
    container.querySelectorAll('[data-learn-filter]').forEach(function(chip) {
      chip.addEventListener('click', function() {
        hubState.filter = chip.getAttribute('data-learn-filter');
        container.querySelectorAll('[data-learn-filter]').forEach(function(other) {
          var active = other === chip;
          other.classList.toggle('active', active);
          other.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        refreshHub(container);
      });
    });
    container.querySelectorAll('[data-learn-view]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        hubState.view = btn.getAttribute('data-learn-view') === 'list' ? 'list' : 'cards';
        write(HUB_VIEW_KEY, hubState.view);
        container.querySelectorAll('[data-learn-view]').forEach(function(other) {
          var active = other === btn;
          other.classList.toggle('active', active);
          other.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        refreshHub(container);
      });
    });
  }

  function renderHome() {
    var p = progress();
    var completed = completedLetters();
    var srs = srsStats();
    var fresh = !hasProgress();
    var last = p.lastActivity ? new Date(p.lastActivity).toLocaleDateString('ru-RU') : '—';
    var items = hubItems();
    var shown = items.filter(hubItemVisible);

    var cta = fresh
      ? '<button type="button" class="lab-btn lab-btn-primary lab-btn-sm" onclick="LearnLab.startFirst()">Начать первый урок</button>'
      : '<button type="button" class="lab-btn lab-btn-primary lab-btn-sm" onclick="LearnLab.continueLast()">Продолжить с последнего места</button>';

    // Порядок блоков: тулбар (§4.7) идёт сразу под шапкой модуля, полоса
    // прогресса — под ним. Тулбар управляет каталогом, а прогресс и CTA
    // относятся уже к содержимому, поэтому хром читается сверху вниз.
    return hubToolbarMarkup(items, shown) +
      '<header class="learn-hub-bar">' +
        '<span class="learn-hub-label">Обучение</span>' +
        '<span class="learn-hub-rule" aria-hidden="true"></span>' +
        '<span class="learn-hub-chips">' + hubChip('буквы ' + completed + '/22') + hubChip('к повторению ' + srs.due) + hubChip('рекорд ' + record()) + hubChip('активность ' + last) + '</span>' +
        sparkMarkup() +
        '<button type="button" class="learn-hub-reset" title="Сбросить прогресс" aria-label="Сбросить прогресс" onclick="LearnLab.reset()"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button>' +
        cta +
      '</header>' +
      (fresh ? emptyStateMarkup() : '') +
      '<p class="learn-hub-legend" aria-label="Легенда статусов"><span>Статус:</span><span class="learn-hub-dot"></span>новый<span class="learn-hub-dot is-progress"></span>в работе<span class="learn-hub-dot is-done"></span>освоен</p>' +
      '<div class="learn-hub-body' + (hubState.view === 'list' ? ' is-list' : '') + '" id="learn-hub-body">' + hubBodyMarkup(shown) + '</div>';
  }

  function renderCourse() {
    var course = state.course;
    if (!course) { state.view = 'courses'; return renderCourses(); }
    var p = courseProgress();
    var lessons = courseModules(course);
    var openIndex = courseOpenIndex(course, p);
    return '<div class="course-detail">' +
      coursePathMarkup(course, p, openIndex) +
      '<div class="course-detail-inner">' +
        courseRailMarkup(course, p, openIndex) +
        '<div class="course-detail-main">' + courseModulesMarkup(course, p, openIndex) + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ===== Course stepper: one lesson of the course = one module chapter. ===== */

  /* Последний раскрытый модуль курса хранится в localStorage, ключ — id курса. */
  function readCourseOpen(courseId) {
    var store = read(COURSE_OPEN_KEY, {});
    var value = store && store[courseId];
    return typeof value === 'number' ? value : null;
  }

  function writeCourseOpen(courseId, index) {
    var store = read(COURSE_OPEN_KEY, {});
    if (!store || typeof store !== 'object') store = {};
    store[courseId] = index;
    write(COURSE_OPEN_KEY, store);
  }

  function courseModules(course) {
    return course.lessons || [];
  }

  function isModuleDone(course, moduleIndex, p) {
    var lesson = courseModules(course)[moduleIndex];
    return !!(lesson && p.lessons[lesson.id]);
  }

  function currentModuleIndex(course, p) {
    var lessons = courseModules(course);
    for (var i = 0; i < lessons.length; i++) {
      if (!p.lessons[lessons[i].id]) return i;
    }
    return Math.max(0, lessons.length - 1);
  }

  function courseOpenIndex(course, p) {
    var total = courseModules(course).length;
    var runtime = state.courseOpenModule;
    if (typeof runtime === 'number' && (runtime === -1 || runtime < total)) return runtime;
    var saved = readCourseOpen(course.id);
    if (typeof saved === 'number' && (saved === -1 || saved < total)) return saved;
    return currentModuleIndex(course, p);
  }

  function doneModuleCount(course, p) {
    var lessons = courseModules(course);
    var count = 0;
    for (var i = 0; i < lessons.length; i++) {
      if (p.lessons[lessons[i].id]) count++;
    }
    return count;
  }

  function padNumber(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /* Повторы: одинаковые у всех уроков курса поля рендерим один раз в модуле 01. */
  function sharedCourseFields(course) {
    var lessons = courseModules(course);
    if (lessons.length < 2) return {};
    var shared = {};
    ['paleo', 'meaning', 'quote', 'question', 'practice'].forEach(function(field) {
      var first = lessons[0][field];
      if (!first) return;
      var same = lessons.every(function(lesson) { return lesson[field] === first; });
      if (same) shared[field] = true;
    });
    return shared;
  }

  function coursePathMarkup(course, p, openIndex) {
    var lessons = courseModules(course);
    var doneCount = doneModuleCount(course, p);
    var chips = lessons.map(function(lesson, i) {
      var done = !!p.lessons[lesson.id];
      var cls = done ? 'is-done' : (i === openIndex ? 'is-current' : '');
      return '<button type="button" class="course-path-chip ' + cls + '" data-module-index="' + i + '"' + (i === openIndex ? ' aria-current="step"' : '') + ' onclick="LearnLab.jumpToModule(' + i + ')">' +
        '<span class="course-path-chip-dot" aria-hidden="true"></span>' +
        '<span class="course-path-chip-label">Модуль ' + padNumber(i + 1) + '</span>' +
        (done ? '<span class="course-path-chip-check" aria-hidden="true">✓</span>' : '') +
      '</button>';
    }).join('');
    return '<div class="course-path" role="navigation" aria-label="Путь по модулям курса">' +
      '<div class="course-path-legend" aria-hidden="true">' +
        '<span class="course-path-legend-item"><span class="course-path-dot"></span>Новый</span>' +
        '<span class="course-path-legend-item"><span class="course-path-dot is-current"></span>Текущий</span>' +
        '<span class="course-path-legend-item"><span class="course-path-dot is-done"></span>Пройден</span>' +
      '</div>' +
      '<div class="course-path-scroll">' + chips + '</div>' +
      '<div class="course-path-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + lessons.length + '" aria-valuenow="' + doneCount + '" aria-label="Пройдено модулей"><span style="width:' + (lessons.length ? doneCount / lessons.length * 100 : 0) + '%"></span></div>' +
    '</div>';
  }

  function courseRailMarkup(course, p, openIndex) {
    var lessons = courseModules(course);
    var nodes = lessons.map(function(lesson, i) {
      var done = !!p.lessons[lesson.id];
      var cls = done ? 'is-done' : (i === openIndex ? 'is-current' : '');
      return '<button type="button" class="course-rail-node ' + cls + '" data-module-index="' + i + '" aria-label="Модуль ' + padNumber(i + 1) + (done ? ', пройден' : '') + '" onclick="LearnLab.jumpToModule(' + i + ')">' +
        '<span class="course-rail-glyph" lang="hbo" aria-hidden="true">' + esc(lesson.letter) + '</span>' +
      '</button>';
    }).join('');
    return '<div class="course-rail"><div class="course-rail-line" aria-hidden="true"></div>' + nodes + '</div>';
  }

  function courseModulesMarkup(course, p, openIndex) {
    var lessons = courseModules(course);
    var shared = sharedCourseFields(course);
    var hasShared = Object.keys(shared).length > 0;
    var current = currentModuleIndex(course, p);
    var sections = [];
    for (var i = 0; i < lessons.length; i++) {
      var lesson = lessons[i];
      var done = !!p.lessons[lesson.id];
      var isOpen = i === openIndex;
      var phase = done ? ' is-done' : (i === current ? ' is-current' : ' is-future');
      var body = '';
      if (isOpen) {
        var inner = (i === 0 || !hasShared)
          ? courseLessonBlock(course, lesson, p, i === 0 ? {} : shared, hasShared && i === 0)
          : '<p class="course-block-dup">Смыслы, цитата, вопрос и практика совпадают с модулем 01 — общий образ курса открыт там.</p>';
        body = '<div class="course-module-body" id="course-module-body-' + i + '"><div class="course-module-body-inner">' + inner + '</div></div>';
      } else if (!done) {
        var preview = String(lesson.meaning || '');
        if (preview.length > 110) preview = preview.slice(0, 110).trimEnd() + '…';
        body = '<p class="course-module-preview">' + esc(preview) + '</p>';
      }
      sections.push('<section class="course-module' + phase + (isOpen ? ' is-open' : ' is-collapsed') + '" id="course-module-' + i + '" data-module-index="' + i + '">' +
        '<header class="course-module-head">' +
          '<button type="button" class="course-module-toggle" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="course-module-body-' + i + '" onclick="LearnLab.toggleModule(' + i + ')">' +
            '<span class="course-module-num" aria-hidden="true">' + padNumber(i + 1) + '</span>' +
            '<span class="course-module-titles">' +
              '<span class="course-module-title">' + esc(lesson.title) + '</span>' +
              '<span class="course-module-sub">' + esc(lesson.letterName) + '</span>' +
            '</span>' +
            (done ? '<span class="course-module-check" role="img" aria-label="Модуль пройден">✓</span>' : '') +
            '<span class="course-module-chevron" aria-hidden="true">▸</span>' +
          '</button>' +
          '<button type="button" class="lab-btn lab-btn-sm module-chapter-done-btn' + (done ? ' lab-btn-secondary' : ' lab-btn-primary') + '" onclick="LearnLab.toggleLesson(\'' + course.id + '\',\'' + lesson.id + '\')">' + (done ? 'Пройден' : 'Отметить') + '</button>' +
        '</header>' +
        body +
      '</section>');
    }
    return sections.join('');
  }

  function courseLessonBlock(course, lesson, p, shared, withNote) {
    var isDone = !!p.lessons[lesson.id];
    var html = '<article class="course-block' + (isDone ? ' is-done' : '') + '" data-lesson-id="' + esc(lesson.id) + '">';
    if (!shared.paleo) html += '<span class="course-block-paleo" lang="hbo">' + esc(lesson.paleo) + '</span>';
    if (!shared.meaning) html += '<p class="course-block-meaning">' + esc(lesson.meaning) + '</p>';
    if (!shared.quote) html += '<blockquote class="course-block-quote">' + esc(lesson.quote) + '</blockquote>';
    if (!shared.question || !shared.practice) {
      html += '<div class="course-block-panels">';
      if (!shared.question) html += '<div class="course-block-panel is-question"><h4>Вопрос</h4><p>' + esc(lesson.question) + '</p></div>';
      if (!shared.practice) html += '<div class="course-block-panel is-practice"><h4>Практика</h4><p>' + esc(lesson.practice) + '</p></div>';
      html += '</div>';
    }
    html += '</article>';
    if (withNote) html += '<p class="course-block-shared-note">Образ, цитата, вопрос и практика этого курса общие для всех модулей.</p>';
    return html;
  }

  var courseSpy = null;
  var courseResize = null;
  var courseAlignBound = false;

  /* Узлы рельсы ставятся по центру шапки своей главы; линия — от первого узла к последнему. */
  function courseAlignRail() {
    var container = getContainer();
    if (!container) return;
    var rail = container.querySelector('.course-rail');
    var line = rail ? rail.querySelector('.course-rail-line') : null;
    if (!rail || !line) return;
    var nodes = rail.querySelectorAll('.course-rail-node');
    if (!nodes.length) return;
    var railRect = rail.getBoundingClientRect();
    var firstCenter = null;
    var lastCenter = null;
    var modules = container.querySelectorAll('.course-module');
    for (var i = 0; i < modules.length; i++) {
      var head = modules[i].querySelector('.course-module-head');
      var node = rail.querySelector('.course-rail-node[data-module-index="' + modules[i].getAttribute('data-module-index') + '"]');
      if (!head || !node) continue;
      var headRect = head.getBoundingClientRect();
      var center = headRect.top + headRect.height / 2 - railRect.top;
      node.style.top = center + 'px';
      if (firstCenter === null) firstCenter = center;
      lastCenter = center;
    }
    if (firstCenter !== null) {
      line.style.top = firstCenter + 'px';
      line.style.height = Math.max(0, lastCenter - firstCenter) + 'px';
    }
  }

  function courseEnhance() {
    if (courseSpy) { courseSpy.disconnect(); courseSpy = null; }
    if (courseResize) { courseResize.disconnect(); courseResize = null; }
    courseAlignRail();
    if (!courseAlignBound) { window.addEventListener('resize', courseAlignRail); courseAlignBound = true; }
    var container = getContainer();
    if (!container) return;
    var sections = container.querySelectorAll('.course-module');
    if (!sections.length || !('IntersectionObserver' in window)) return;
    courseSpy = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var index = entry.target.getAttribute('data-module-index');
        var marks = container.querySelectorAll('.course-path-chip[data-module-index="' + index + '"], .course-rail-node[data-module-index="' + index + '"]');
        for (var k = 0; k < marks.length; k++) marks[k].classList.toggle('is-in-view', entry.isIntersecting);
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    for (var s = 0; s < sections.length; s++) courseSpy.observe(sections[s]);
    /* Аккордеон меняет высоту main — узлы рельсы съезжают со своих глав;
       пересобираем выравнивание по ResizeObserver (ре-райз на открытие/закрытие). */
    var main = container.querySelector('.course-detail-main');
    if (main && 'ResizeObserver' in window) {
      courseResize = new ResizeObserver(function() { courseAlignRail(); });
      courseResize.observe(main);
    }
  }

  /* ===== Каталог букв: bento-экран «Изучение иврита» =====
     Канон §5.2a (12 колонок, hairline, тени = 0, mobile = одна
     колонка) по образцу `.at-bento`. Тулбар — общий компонент
     components/toolbar.css; в него переехала кнопка «К обучению»,
     ранее стоявшая отдельной кнопкой над сеткой. */

  function letterStatus(p, item) {
    return p.letters[item.hebrew] && p.letters[item.hebrew].status || 'new';
  }

  /* Следующая буква для фокус-ячейки: первая неосвоенная, иначе —
     последняя освоенная (весь алфавит пройден — показываем итог). */
  function focusLetter(p) {
    var open = letters.filter(function(item) { return letterStatus(p, item) !== 'complete'; });
    return open[0] || letters[letters.length - 1] || null;
  }

  /* Исходный номер буквы хранится в записи: он нужен для stagger-анимации
     появления, иначе фильтр и поиск сдвигали бы задержки соседних плиток. */
  function letterEntries() {
    return letters.map(function(item, index) { return { item:item, index:index }; });
  }

  function letterVisible(p, item) {
    if (lettersState.filter !== 'all' && letterStatus(p, item) !== lettersState.filter) return false;
    var haystack = [item.name, item.paleo, item.hebrew, item.image, item.meaning].join(' ').toLowerCase();
    var query = hubNormalize(lettersState.query);
    return !query || hubNormalize(haystack).indexOf(query) !== -1;
  }

  function letterTile(p, item, index) {
    var status = letterStatus(p, item);
    var cls = status === 'complete' ? 'is-complete' : status === 'progress' ? 'is-progress' : '';
    var label = status === 'complete' ? 'завершено' : status === 'progress' ? 'в процессе' : 'не начато';
    /* Все плитки одного калибра: буквы — это ряд, а не набор плиток разного
       веса, поэтому ни ширины, ни высоты у ячеек не различается. */
    var a11y = esc(item.name + ' — ' + item.image + ', ' + item.meaning + ', ' + label);
    return '<button type="button" class="ll-tile ' + cls + '" style="animation-delay:' + index * 25 + 'ms" aria-label="' + a11y + '" onclick="LearnLab.openLesson(\'' + item.hebrew + '\')">' +
      '<span class="ll-tile-status" aria-hidden="true"></span>' +
      '<span class="ll-tile-glyph" lang="hbo" aria-hidden="true">' + esc(item.paleo) + '</span>' +
      '<span class="ll-tile-body" aria-hidden="true"><span class="ll-tile-name">' + esc(item.name) + '</span>' +
      '<span class="ll-tile-image">' + esc(item.image) + '</span>' +
      '<span class="ll-tile-meaning">' + esc(item.meaning) + '</span></span>' +
    '</button>';
  }

  function letterCellHead(num, title, hint) {
    return '<header class="ll-cell-head"><span class="ll-num">' + num + '</span>' +
      '<h2 class="ll-cell-title">' + esc(title) + '</h2>' +
      '<span class="ll-cell-hint">' + esc(hint) + '</span></header>';
  }

  function lettersProgressCell() {
    var done = completedLetters(), total = letters.length || 22;
    var percent = Math.round(done / total * 100);
    return '<section class="ll-cell ll-cell--progress">' +
      letterCellHead('01', 'Прогресс', done + ' из ' + total) +
      '<p class="ll-metric"><strong>' + percent + '%</strong><span>алфавита освоено</span></p>' +
      '<span class="ll-bar" role="progressbar" aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100" aria-label="Освоено букв"><span style="width:' + percent + '%"></span></span>' +
      '<ul class="ll-legend">' +
        '<li><span class="ll-dot is-new"></span>не начат</li>' +
        '<li><span class="ll-dot is-progress"></span>в процессе</li>' +
        '<li><span class="ll-dot is-done"></span>завершён</li>' +
      '</ul>' +
    '</section>';
  }

  function lettersFocusCell(p) {
    var item = focusLetter(p);
    if (!item) return '';
    var open = letterStatus(p, item) !== 'complete';
    return '<section class="ll-cell ll-cell--focus">' +
      letterCellHead('02', open ? 'Следующая буква' : 'Алфавит пройден', open ? 'продолжить с неё' : 'можно повторить') +
      '<div class="ll-focus">' +
        '<span class="ll-focus-glyph" lang="hbo">' + esc(item.paleo) + '</span>' +
        '<div class="ll-focus-text"><span class="ll-focus-name">' + esc(item.name) + '</span>' +
        '<span class="ll-focus-image">' + esc(item.image) + '</span>' +
        '<span class="ll-focus-meaning">' + esc(item.meaning) + '</span></div>' +
      '</div>' +
      '<button type="button" class="lab-btn lab-btn-primary lab-btn-sm ll-focus-btn" onclick="LearnLab.openLesson(\'' + item.hebrew + '\')">' + (open ? 'Начать урок' : 'Пройти ещё раз') + '</button>' +
    '</section>';
  }

  function lettersAlphabetCell(p, shown) {
    var tiles = shown.map(function(entry) { return letterTile(p, entry.item, entry.index); }).join('');
    var body = shown.length ? tiles : '<p class="ll-empty">По запросу ничего не найдено.</p>';
    return '<section class="ll-cell ll-cell--alphabet">' +
      letterCellHead('03', 'Алфавит', shown.length + ' из ' + letters.length) +
      '<div class="ll-tiles">' + body + '</div>' +
    '</section>';
  }

  /* Тулбар каталога: «К обучению» (возврат в хаб), поиск, фильтр по
     статусу и счётчик. Разметка — общий компонент toolbar.css. */
  function lettersToolbar(shown) {
    var chip = function(value, label) {
      var active = lettersState.filter === value;
      return '<button type="button" class="pipeline-chip' + (active ? ' active' : '') + '" data-letter-filter="' + value + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + label + '</button>';
    };
    return '<section class="lab-toolbar" role="search" aria-label="Каталог букв иврита">' +
        '<input type="search" class="lab-input lab-toolbar-search" id="letter-search" autocomplete="off" placeholder="Поиск по буквам, образам и значениям…" aria-label="Поиск по буквам" value="' + esc(lettersState.query).replace(/"/g, '&quot;') + '">' +
        '<div class="lab-toolbar-group" role="group" aria-label="Фильтр по статусу">' +
          chip('all', 'Все') + chip('new', 'Не начатые') + chip('progress', 'В процессе') + chip('complete', 'Завершённые') +
        '</div>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count" data-letter-count aria-live="polite"><strong>' + shown.length + '</strong> из ' + letters.length + '</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn learn-back" onclick="LearnLab.home()"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>К обучению</button>' +
        '</div>' +
      '</section>';
  }

  function lettersBody(p, shown) {
    return '<div class="ll-bento" id="learn-letters-body">' +
      lettersProgressCell() + lettersFocusCell(p) + lettersAlphabetCell(p, shown) +
    '</div>';
  }

  function lettersShown() {
    var p = progress();
    return letterEntries().filter(function(entry) { return letterVisible(p, entry.item); });
  }

  /* Перерисовывается только bento: поле поиска сохраняет фокус и каретку. */
  function refreshLetters(container) {
    var body = container.querySelector('#learn-letters-body');
    if (!body) return;
    var p = progress(), shown = lettersShown();
    body.innerHTML = lettersProgressCell() + lettersFocusCell(p) + lettersAlphabetCell(p, shown);
    var count = container.querySelector('[data-letter-count]');
    if (count) count.innerHTML = '<strong>' + shown.length + '</strong> из ' + letters.length;
    if (window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons(); } catch (error) { /* не критично */ } }
  }

  function bindLettersToolbar(container) {
    var search = container.querySelector('#letter-search');
    if (search) search.addEventListener('input', function() { lettersState.query = this.value; refreshLetters(container); });
    container.querySelectorAll('[data-letter-filter]').forEach(function(chipEl) {
      chipEl.addEventListener('click', function() {
        lettersState.filter = chipEl.getAttribute('data-letter-filter');
        container.querySelectorAll('[data-letter-filter]').forEach(function(other) {
          var active = other === chipEl;
          other.classList.toggle('active', active);
          other.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        refreshLetters(container);
      });
    });
  }

  function renderLessons() {
    var shown = lettersShown();
    return lettersToolbar(shown) + lettersBody(progress(), shown);
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

  /* Тип вопроса на лицевой стороне SRS-карточки: подпись в шапке экрана. */
  var REVIEW_TYPES = { 'letter-name': 'Название буквы', 'letter-image': 'Образ знака', 'letter-glyph': 'Палео-глиф' };

  /* Превью интервалов оценки — та же формула, что в srsSchedule:
     пользователь видит, насколько уйдёт карточка, ДО клика. */
  function reviewIntervals(card) {
    var ease = card.ease || 2.5;
    var days = function(n) { return window.LabPlural ? LabPlural(n, 'день', 'дня', 'дней') : n + ' дн.'; };
    return {
      again: '10 мин',
      hard: days(1),
      good: days(Math.max(1, Math.round(card.intervalDays ? card.intervalDays * ease : 1))),
      easy: days(Math.max(3, Math.round(card.intervalDays ? card.intervalDays * ease * 1.5 : 4)))
    };
  }

  /* Тулбар §4.7: статистика колоды слева, счётчик сессии и возврат справа.
     Каркас — общий компонент components/toolbar.css, чипы — learn-hub-chip. */
  /* state.review: { card, done, total, revealed } — сессия повторения.
       total фиксируется на входе (сколько карточек было к повторению),
       revealed живёт здесь, а не в DOM: ячейка 03 «Буква» рендерится
       по нему, поэтому раскрытие = перерисовка экрана. */
  function startReview() {
    var card = queueReview();
    state.review = { card: card, done: 0, total: Math.max(srsStats().due, 1), revealed: false };
  }

  function reviewToolbar() {
    var srs = srsStats();
    var done = (state.review && state.review.done) || 0;
    function chip(text, hot) {
      return '<span class="learn-hub-chip' + (hot ? ' is-hot' : '') + '">' + text + '</span>';
    }
    return '<section class="lab-toolbar" aria-label="Панель повторения">' +
        '<div class="lab-toolbar-group" role="group" aria-label="Статистика колоды">' +
          chip('К повторению <strong>' + srs.due + '</strong>', srs.due > 0) +
          chip('Выучено <strong>' + srs.learned + '</strong>') +
          chip('Всего карточек <strong>' + srs.total + '</strong>') +
        '</div>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count" aria-live="polite">Повторено <strong>' + done + '</strong> за сессию</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn learn-back" onclick="LearnLab.home()"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>К обучению</button>' +
        '</div>' +
      '</section>';
  }

  /* Шапка ячейки bento §4.1/§5.2a: номер + капитель + подпись справа.
     Общая для экранов повторения (`lr-`) и палео-тренажёра (`pt-`). */
  function cellHead(num, title, hint) {
    return '<header class="lr-cell-head"><span class="lr-num">' + num + '</span>' +
      '<h2 class="lr-cell-title">' + esc(title) + '</h2>' +
      '<span class="lr-cell-hint">' + esc(hint) + '</span></header>';
  }

  function reviewGradeBtn(grade, label, eta, cls) {
    return '<button type="button" class="lab-btn learn-review-grade ' + cls + '" onclick="LearnLab.gradeReview(\'' + grade + '\')"><span>' + label + '</span><small>' + eta + '</small></button>';
  }

  /* Ячейка 02: ход сессии и цена каждой оценки — четыре интервала
     одной строкой, чтобы правило интервалов читалось до первого клика. */
  function reviewSessionCell() {
    var review = state.review || {}, done = review.done || 0;
    var total = Math.max(review.total || 0, done, 1);
    var percent = Math.min(100, Math.round(done / total * 100));
    var card = review.card;
    var iv = card ? reviewIntervals(card) : null;
    var legend = iv ? [['is-again', 'Снова', iv.again], ['is-hard', 'Трудно', iv.hard], ['is-good', 'Хорошо', iv.good], ['is-easy', 'Легко', iv.easy]] : [];
    return '<section class="lr-cell lr-cell--session">' +
      cellHead('02', 'Сессия', done + ' из ' + total) +
      '<p class="lr-metric"><strong>' + done + '</strong><span>карточек повторено</span></p>' +
      '<span class="lr-bar" role="progressbar" aria-label="Ход сессии" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"><span style="width:' + percent + '%"></span></span>' +
      '<ul class="lr-legend">' + legend.map(function(entry) {
        return '<li><span class="lr-dot ' + entry[0] + '"></span>' + entry[1] + ' <em>' + entry[2] + '</em></li>';
      }).join('') + '</ul>' +
    '</section>';
  }

  /* Ячейка 03: кто перед вами. До раскрытия — намёк вместо пустоты,
     иначе после «Показать ответ» сетка прыгает на целую ячейку. */
  function reviewLetterCell(view, revealed) {
    var item = view.item;
    return '<section class="lr-cell lr-cell--letter">' +
      cellHead('03', 'Буква', item.hebrew) +
      (revealed
        ? '<div class="lr-identity"><span class="lr-identity-glyph" lang="hbo" aria-hidden="true">' + esc(item.paleo) + '</span>' +
          '<div class="lr-identity-text"><span class="lr-identity-name">' + esc(item.name) + '</span>' +
          '<span class="lr-identity-image">' + esc(item.image) + '</span>' +
          '<span class="lr-identity-meaning">' + esc(item.meaning) + '</span></div></div>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lr-identity-btn" onclick="LearnLab.openLesson(\'' + esc(item.hebrew) + '\')">Открыть урок</button>'
        : '<p class="lr-placeholder">Образ, значение и урок откроются после ответа. Пока работает память, а не подглядывание.</p>') +
    '</section>';
  }

  function renderReview() {
    var card = state.review && state.review.card, view = card && reviewItem(card);
    if (!view) return reviewToolbar() + '<div class="learn-empty"><span class="learn-empty-glyph" lang="hbo" aria-hidden="true">𐤀</span><h2>Очередь пуста</h2><p>Новых карточек и повторений пока нет. Пройдите урок — карточки соберутся сами.</p><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.openLessons()">К каталогу букв</button></div>';
    var review = state.review, revealed = !!review.revealed;
    var front = card.type === 'letter-glyph' ? view.item.image : view.item.paleo;
    var answer = card.type === 'letter-image' ? view.item.image : card.type === 'letter-glyph' ? view.item.paleo : view.item.name;
    var iv = reviewIntervals(card);
    return reviewToolbar() +
      '<div class="lr-bento">' +
        '<section class="lr-cell lr-cell--card">' +
          cellHead('01', 'Карточка', REVIEW_TYPES[card.type] || 'Карточка') +
          '<div class="lr-stage"><div class="lr-symbol" lang="hbo">' + esc(front) + '</div><h2 class="lr-prompt">' + esc(view.prompt) + '</h2></div>' +
          (revealed
            ? '<div class="lr-answer"><span class="lr-answer-label">Ответ</span><strong class="lr-answer-value">' + esc(answer) + '</strong></div>' +
              '<div class="lr-grades">' +
                reviewGradeBtn('again', 'Снова', iv.again, 'is-again') +
                reviewGradeBtn('hard', 'Трудно', iv.hard, 'is-hard') +
                reviewGradeBtn('good', 'Хорошо', iv.good, 'is-good') +
                reviewGradeBtn('easy', 'Легко', iv.easy, 'is-easy') +
              '</div>'
            : '<div class="lr-action"><button type="button" class="lab-btn lab-btn-primary lr-reveal" onclick="LearnLab.showReviewAnswer()"><i data-lucide="eye" class="lab-icon" aria-hidden="true"></i>Показать ответ</button>' +
              '<p class="lr-hint"><kbd>Пробел</kbd> — показать ответ · <kbd>1</kbd>–<kbd>4</kbd> — оценить</p></div>') +
        '</section>' +
        reviewSessionCell() +
        reviewLetterCell(view, revealed) +
      '</div>';
  }

  /* Тулбар §4.7 игры: статистика раунда чипами слева, рекорд и возврат
     справа — тот же хром, что в каталоге букв и повторении. */
  function gameToolbar(game) {
    function chip(text, hot) {
      return '<span class="learn-hub-chip' + (hot ? ' is-hot' : '') + '">' + text + '</span>';
    }
    return '<section class="lab-toolbar" aria-label="Панель игры">' +
        '<div class="lab-toolbar-group" role="group" aria-label="Статистика раунда">' +
          chip('Раунд <strong>' + game.round + '</strong>/10', game.round >= 8) +
          chip('Счёт <strong>' + game.score + '</strong>') +
          chip('Серия <strong>' + game.streak + '</strong>', game.streak >= 2) +
        '</div>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count">Рекорд <strong>' + record() + '</strong></span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn learn-back" onclick="LearnLab.home()"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>К обучению</button>' +
        '</div>' +
      '</section>';
  }

  /* Ячейка 03 «Варианты»: ответ живёт рядом с вопросом (01), а результат
     последнего клика — в ячейке 02, поэтому сетка не перепрыгивает. */
  function gameChoicesCell(choices) {
    return '<section class="gm-cell gm-cell--choices">' +
      cellHead('03', 'Варианты', 'один верный') +
      '<div class="learn-options gm-choices">' + choices.map(function(option) {
        return '<button type="button" class="learn-option" data-answer="' + esc(option.hebrew) + '" onclick="LearnLab.gameAnswer(\'' + option.hebrew + '\')">' + esc(option.image) + '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  function renderGame() {
    var game = state.game;
    if (game.done) {
      return gameToolbar(game) +
        '<div class="gm-bento"><section class="gm-cell gm-cell--result">' +
          cellHead('01', 'Итог', '10 раундов') +
          '<p class="gm-metric"><strong>' + game.score + '</strong><span>очков набрано</span></p>' +
          '<p class="gm-record">Рекорд: <strong>' + record() + '</strong></p>' +
          '<div class="gm-actions"><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.openGame()">Играть снова</button></div>' +
        '</section></div>';
    }
    var low = game.time <= 8;
    return gameToolbar(game) +
      '<div class="gm-bento">' +
        '<section class="gm-cell gm-cell--prompt">' +
          cellHead('01', 'Знак', 'раунд ' + game.round + ' из 10') +
          '<div class="gm-stage">' +
            '<div class="gm-symbol" lang="hbo">' + esc(game.item.paleo) + '</div>' +
            '<p class="gm-prompt">Какой образ несёт этот знак?</p>' +
          '</div>' +
        '</section>' +
        '<section class="gm-cell gm-cell--state">' +
          cellHead('02', 'Ход раунда', low ? 'время идёт' : 'идёт') +
          '<p class="gm-metric"><strong class="' + (low ? 'is-low' : '') + '">' + game.time + 'с</strong><span>до конца раунда</span></p>' +
          '<span class="gm-bar" role="progressbar" aria-label="Раунд" aria-valuemin="1" aria-valuemax="10" aria-valuenow="' + game.round + '"><span style="width:' + (game.round * 10) + '%"></span></span>' +
          '<div class="gm-feedback' + (game.feedback ? (game.feedback.ok ? ' correct' : ' wrong') : '') + '" role="status" aria-live="polite">' + (game.feedback ? esc(game.feedback.ok ? 'Верно! +' + game.feedback.earned + ' очков' : 'Неверно. Правильный образ: ' + game.feedback.correct) : '') + '</div>' +
        '</section>' +
        gameChoicesCell(game.choices) +
      '</div>';
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
      rootsRequest = AlephyUtils.fetchJson('data/roots/roots.json').then(function(data) { rootsCache = Array.isArray(data) ? data : []; return rootsCache; }).catch(function() { rootsCache = []; return rootsCache; });
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
      return '<div class="pt-chain-item"><span class="pt-chain-glyph" lang="hbo">' + esc(g.paleo) + '</span><span class="pt-chain-name">' + esc(g.name) + '</span><span class="pt-chain-desc">' + esc(g.image) + ' · ' + esc(g.meaning) + '</span></div>';
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
    }).join('') + ' <span class="pt-compare-arrow">↔</span> ' + esc((t.rootEntry && (t.rootEntry.image || t.rootEntry.meaning)) || 'сборка');
  }

/* ===== ПАЛЕО-БИТВА: bento `pb-` ===== */
  /* Настройки партии живут в состоянии модуля, а не в localStorage: это
     срез открытого экрана (тема, режим, выбранные ники), а не прогресс. */
  function battleSetup() {
    if (!state.battleSetup) state.battleSetup = { mode: 'duel', theme: '', rounds: 0, query: '', slot: 1, names: ['', ''] };
    return state.battleSetup;
  }
  function battleCards(setup) {
    var allowed = setup && setup.theme ? THEME_LETTERS[setup.theme] : null;
    return loadRoots().then(function(roots) {
      var built = root.PaleoBattle.makeCards(roots, letters);
      if (!built.length) return root.PaleoBattle.fallbackCards();
      /* Тема сужает колоду, но не обнуляет её: иначе редкая тема оставила
         бы игрока без партии. */
      var themed = allowed ? root.PaleoBattle.filterByLetters(built, allowed) : built;
      return themed.length ? themed : built;
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
  function battleMode() {
    var setup = battleSetup();
    return root.PaleoBattle.modeById(setup.mode);
  }
  /* Тулбар: режим и тема — штатные селекты панели, счёт и комната — чипы,
     возврат в хаб — общая кнопка (как в тренажёре и повторении). */
  function battleToolbar(match) {
    var setup = battleSetup(), mode = battleMode();
    var modeOptions = root.PaleoBattle.MODES.map(function(item) {
      return '<option value="' + item.id + '"' + (setup.mode === item.id ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
    var themeOptions = '<option value="">Любая тема</option>' + THEMES.map(function(theme) {
      return '<option value="' + esc(theme) + '"' + (setup.theme === theme ? ' selected' : '') + '>' + esc(theme) + '</option>';
    }).join('');
    var scores = match ? match.players.map(function(player) { return esc(player.name) + ' ' + player.score; }).join(' · ') : '';
    return '<section class="lab-toolbar" aria-label="Панель палео-битвы">' +
        '<label class="lab-toolbar-field" for="battle-mode">Режим<select class="lab-select lab-toolbar-select" id="battle-mode" onchange="LearnLab.battleMode(this.value)">' + modeOptions + '</select></label>' +
        '<label class="lab-toolbar-field" for="battle-theme">Тема<select class="lab-select lab-toolbar-select" id="battle-theme" onchange="LearnLab.battleTheme(this.value)">' + themeOptions + '</select></label>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count" aria-live="polite">' + (match ? 'Комната ' + esc(match.roomCode) + ' · ' + scores : esc(mode.desc)) + '</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn" onclick="LearnLab.newBattle()">' + (match ? 'Новый матч' : 'Собрать матч') + '</button>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn learn-back" onclick="LearnLab.home()"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>К обучению</button>' +
        '</div>' +
      '</section>';
  }
/* Ячейка 01: карточка хода. Ответы пишутся прямо в `match.draft`, чтобы
     перерисовка (таймер, смена хода) не съедала введённое — тот же приём,
     что с фидбэком в игре «Угадай образ». */
  function battleInput(id, label, value, placeholder) {
    return '<label class="pb-field" for="' + id + '"><span>' + label + '</span>' +
      '<input id="' + id + '" class="lab-input pb-input" autocomplete="off" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '" oninput="LearnLab.battleDraft(this.id, this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();LearnLab.battleSubmit();}"></label>';
  }
  function battleSelect(id, label, options, value) {
    return '<label class="pb-field" for="' + id + '"><span>' + label + '</span><select id="' + id + '" class="lab-select pb-input" onchange="LearnLab.battleDraft(this.id, this.value)">' +
      options.map(function(option) { return '<option' + (option === value ? ' selected' : '') + '>' + esc(option) + '</option>'; }).join('') + '</select></label>';
  }
  function battleCardCell(match) {
    var card = match.cards[match.round], draft = match.draft || {}, settings = match.settings || {};
    var chain = card.chain.map(function(part) { return esc(part.paleo); }).join(' ');
    return '<section class="pb-cell pb-cell--card">' +
      cellHead('01', 'Карточка хода', 'ход ' + (match.currentPlayer + 1) + ' из 2') +
      '<div class="pb-stage"><span class="pb-glyphs" lang="hbo" aria-label="Палео-цепочка">' + chain + '</span><p class="pb-direction">Читается справа налево</p></div>' +
      '<p class="pb-task">Соберите слово, назовите действие механики и отделите факт от интерпретации.</p>' +
      '<div class="pb-form">' +
        battleInput('battle-sequence', 'Буквенная цепочка', draft.sequence, 'например: אב') +
        battleInput('battle-image', 'Образ', draft.image, 'что видите в цепочке') +
        battleInput('battle-function', 'Функция / действие', draft.function, 'что делает механика') +
        battleInput('battle-explanation', 'Краткое объяснение', draft.explanation, 'не менее одной фразы') +
        battleSelect('battle-confidence', 'Уверенность', ['высокая', 'средняя', 'низкая'], draft.confidence || 'высокая') +
        battleSelect('battle-status', 'Статус', root.PaleoBattle.STATUS, draft.status || card.status) +
      '</div>' +
      '<div class="pb-actions">' +
        (settings.hints === false ? '' : '<label class="pb-hint"><input type="checkbox" id="battle-hint"' + (draft.hinted ? ' checked' : '') + ' onchange="LearnLab.battleDraft(\'hinted\', this.checked)">Взять подсказку (−50%)</label>') +
        '<button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.battleSubmit()">Проверить ответ</button>' +
      '</div>' +
    '</section>';
  }
  /* Ячейка 02: видимая панель игроков — аватар, счёт, серия, форма по
     последним раундам, достижения и поиск соперника из списка. */
  function battlePlayersCell(match) {
    var players = match.players.map(function(player, index) {
      var stats = root.PaleoBattle.playerStats(match, index);
      var share = root.PaleoBattle.playerShare(match, index);
      var form = stats.form.length ? stats.form.map(function(accuracy) {
        return '<span class="pb-form-bar' + (accuracy === 100 ? ' is-exact' : accuracy > 0 ? ' is-partial' : '') + '" style="height:' + Math.max(8, accuracy / 2) + '%" title="' + accuracy + '%"></span>';
      }).join('') : '<span class="pb-form-empty">нет попыток</span>';
      var badges = stats.achievements.length ? stats.achievements.map(function(item) { return '<span class="pb-badge">' + esc(item) + '</span>'; }).join('') : '<span class="pb-badge is-empty">достижения пока пусты</span>';
      return '<article class="pb-player' + (match.status === 'question' && match.currentPlayer === index ? ' is-active' : '') + '">' +
        '<div class="pb-player-top"><span class="pb-avatar" lang="hbo" aria-hidden="true">' + esc(player.avatar) + '</span>' +
          '<div class="pb-player-id"><input class="pb-player-name" value="' + esc(player.name) + '" maxlength="24" aria-label="Ник исследователя" oninput="LearnLab.battleRename(' + index + ', this.value)">' +
          '<span class="pb-player-meta">' + (match.status === 'question' && match.currentPlayer === index ? 'ходит сейчас' : 'ждёт хода') + ' · уровень ' + esc(player.level) + '</span></div>' +
          '<span class="pb-score">' + player.score + '</span></div>' +
        '<div class="pb-share" role="img" aria-label="Доля от максимума"><span style="width:' + Math.round(share * 100) + '%"></span></div>' +
        '<div class="pb-player-stats"><span>точность <strong>' + stats.accuracy + '%</strong></span><span>серия <strong>' + (player.streak || 0) + '</strong></span><span>раундов <strong>' + stats.rounds + '</strong></span></div>' +
        '<div class="pb-form-bars" aria-label="Форма по последним раундам">' + form + '</div>' +
        '<div class="pb-badges">' + badges + '</div>' +
      '</article>';
    }).join('');
    var found = root.PaleoBattle.searchRoster(battleSetup().query).slice(0, 6);
    var results = found.length ? found.map(function(entry, index) {
      return '<button type="button" class="pb-roster-item" onclick="LearnLab.battleInvite(' + index + ')"><span class="pb-avatar" lang="hbo" aria-hidden="true">' + esc(root.PaleoBattle.avatarFor(entry.name)) + '</span><span>' + esc(entry.name) + '<small>уровень ' + esc(entry.level) + '</small></span></button>';
    }).join('') : '<p class="pb-placeholder">Ник не найден — сохраните его кнопкой ниже, и он попадёт в список.</p>';
    return '<section class="pb-cell pb-cell--players">' +
      cellHead('02', 'Исследователи', 'счёт ' + match.players[0].score + ' : ' + match.players[1].score) +
      players +
      '<div class="pb-roster"><label class="pb-roster-field" for="battle-roster">Поиск исследователя<input id="battle-roster" class="lab-input pb-input" autocomplete="off" value="' + esc(battleSetup().query) + '" placeholder="ник или уровень" oninput="LearnLab.battleQuery(this.value)"></label>' +
        '<div class="pb-roster-list" data-roster>' + results + '</div>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm pb-roster-add" onclick="LearnLab.battleSaveName()">Сохранить мой ник</button>' +
      '</div>' +
    '</section>';
  }
/* Ячейка 03: ход матча — точки раундов, таймер и «Хук Давар» (шкала
     1–5, где «точная сборка» двигает игрока вверх). */
  function battleTurnCell(match) {
    var settings = match.settings || {}, mode = root.PaleoBattle.modeById(settings.mode);
    var total = match.cards.length * 2, turns = match.history.length;
    var dots = Array.from({ length: total }, function(_, index) {
      var entry = match.history[index], player = entry ? match.players[entry.player] : null;
      var cls = entry ? (entry.result.accuracy === 100 ? 'is-exact' : entry.result.points ? 'is-partial' : 'is-miss') : index === turns ? 'is-current' : '';
      return '<span class="pb-turn-dot ' + cls + '" title="Ход ' + (index + 1) + (player ? ': ' + esc(player.name) + ', ' + entry.result.points + ' очков' : '') + '"></span>';
    }).join('');
    var remaining = root.PaleoBattle.remainingSeconds(match);
    var share = settings.seconds ? Math.max(0, Math.min(1, (remaining == null ? 0 : remaining) / settings.seconds)) : 0;
    var steps = ['эмет', 'эмет-шекер', 'свива', 'хошех', 'свива-хошех'];
    var hook = match.players.map(function(player, index) {
      var stats = root.PaleoBattle.playerStats(match, index);
      var level = Math.max(1, Math.min(5, stats.exact + 1));
      return '<div class="pb-hook"><span class="pb-hook-name">' + esc(player.name) + '</span><span class="pb-hook-scale">' +
        Array.from({ length: 5 }, function(_, i) { return '<span class="pb-hook-step' + (i < level ? ' is-on' : '') + '"></span>'; }).join('') +
        '</span><span class="pb-hook-level">' + level + '/5 · ' + esc(steps[level - 1]) + '</span></div>';
    }).join('');
    return '<section class="pb-cell pb-cell--turn">' +
      cellHead('03', 'Ход матча', settings.rounds + ' карточек · ' + esc(mode.label)) +
      '<div class="pb-turns" aria-label="Прогресс матча">' + dots + '</div>' +
      '<div class="pb-timer"><div class="pb-timer-bar"><span style="width:' + Math.round(share * 100) + '%"></span></div>' +
        '<span class="pb-timer-value" data-battle-timer>' + (remaining == null ? 'таймер выключен' : remaining + ' с') + '</span></div>' +
      '<div class="pb-hook-wrap">' + hook + '</div>' +
      '<p class="pb-legend">' + esc(mode.desc) + '</p>' +
    '</section>';
  }
/* Ячейка 04: разбор хода — чек-лист критериев с ценами, реконструкция
     и статус. Здесь видно, за что именно начислены баллы. */
  function battleReviewCell(match) {
    var review = match.history[match.history.length - 1], card = match.cards[review.round - 1] || match.cards[match.round];
    var labels = { image: 'Образ', function: 'Функция', sequence: 'Цепочка', explanation: 'Объяснение', status: 'Статус' };
    var checks = Object.keys(root.PaleoBattle.WEIGHTS).map(function(key) {
      var ok = review.result.checks[key];
      return '<li class="pb-check' + (ok ? ' is-ok' : '') + '"><span>' + esc(labels[key]) + '</span><b>' + root.PaleoBattle.WEIGHTS[key] + '</b><em>' + (ok ? 'совпало' : 'мимо') + '</em></li>';
    }).join('');
    var bonus = review.result.bonus ? '<li class="pb-check is-ok"><span>Бонус за время</span><b>+' + review.result.bonus + '</b><em>скорость</em></li>' : '';
    return '<section class="pb-cell pb-cell--review">' +
      cellHead('04', 'Разбор хода', esc(match.players[review.player].name) + ' · +' + review.result.points + ' из ' + review.result.maxPoints) +
      '<p class="pb-review-line" aria-live="polite">Точность ' + review.result.accuracy + '%' + (review.hinted ? ' · взята подсказка' : '') + (review.result.bonus ? ' · бонус за скорость' : '') + '</p>' +
      '<span class="pb-word" lang="hbo">' + esc(card.word) + '</span>' +
      '<ul class="pb-checks">' + checks + bonus + '</ul>' +
      '<div class="pb-review-body"><p><b>Образ:</b> ' + esc(card.image) + '</p><p><b>Функция:</b> ' + esc(card.function) + '</p><p><b>Реконструкция:</b> ' + esc(card.reconstruction) + '</p><p><b>Статус:</b> ' + esc(card.status) + ' · <b>Источник:</b> ' + esc(card.source) + '</p></div>' +
      '<div class="pb-actions"><button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.battleNext()">Следующий ход</button></div>' +
    '</section>';
  }
  /* Ячейка 05: итог матча — счёт, разбор по игрокам и достижения. */
  function battleResultCell(match) {
    var win = root.PaleoBattle.winner(match);
    var label = win === 'draw' ? 'Ничья' : 'Победитель: ' + match.players[win].name;
    var rows = match.players.map(function(player, index) {
      var stats = root.PaleoBattle.playerStats(match, index);
      var badges = stats.achievements.length ? stats.achievements.map(function(item) { return '<span class="pb-badge">' + esc(item) + '</span>'; }).join('') : '<span class="pb-badge is-empty">без достижений</span>';
      return '<article class="pb-result-row' + (win === index ? ' is-winner' : '') + '">' +
        '<span class="pb-avatar" lang="hbo" aria-hidden="true">' + esc(player.avatar) + '</span>' +
        '<div><strong>' + esc(player.name) + '</strong><small>точность ' + stats.accuracy + '% · раундов ' + stats.rounds + ' · точных сборок ' + stats.exact + '</small><div class="pb-badges">' + badges + '</div></div>' +
        '<span class="pb-score">' + player.score + '</span></article>';
    }).join('');
    return '<section class="pb-cell pb-cell--result">' +
      cellHead('05', 'Итог матча', 'комната ' + esc(match.roomCode)) +
      '<p class="pb-winner">' + esc(label) + '</p>' +
      '<div class="pb-result-rows">' + rows + '</div>' +
      '<div class="pb-actions">' +
        '<button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.newBattle()">Новый матч</button>' +
        '<button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.home()">К обучению</button>' +
      '</div>' +
    '</section>';
  }
  function renderBattle() {
    var match = battleReady(), setup = battleSetup();
    if (!match) {
      battleCards(setup).then(function(cards) {
        state.battle = root.PaleoBattle.createMatch(cards, { names: setup.names, mode: setup.mode, theme: setup.theme });
        root.PaleoBattle.save(state.battle);
        startBattleTimer();
        render();
      });
      return battleToolbar(null) + '<div class="learn-empty"><span class="learn-empty-glyph" lang="hbo" aria-hidden="true">⚔</span><p class="learn-trainer-loading">Собираем колоду…</p></div>';
    }
    var cells = battleToolbar(match);
    if (match.status === 'question') startBattleTimer();
    cells += '<div class="pb-bento">';
    if (match.status === 'finished') {
      cells += battlePlayersCell(match) + battleResultCell(match);
    } else if (match.status === 'review') {
      cells += battleReviewCell(match) + battlePlayersCell(match) + battleTurnCell(match);
    } else {
      cells += battleCardCell(match) + battlePlayersCell(match) + battleTurnCell(match);
    }
    return cells + '</div>';
  }
  /* Таймер хода: обновляет только подпись и полосу, без полной перерисовки —
     иначе фокус в поле ответа терялся бы раз в секунду. Истёкшее время
     закрывает ход тем же ответом, который уже введён. */
  var battleTimer = null;
  function stopBattleTimer() { if (battleTimer) { clearInterval(battleTimer); battleTimer = null; } }
  function paintBattleTimer() {
    var match = state.battle; if (!match) return;
    var left = root.PaleoBattle.remainingSeconds(match);
    var node = document.querySelector('[data-battle-timer]');
    if (node) node.textContent = left == null ? 'таймер выключен' : left + ' с';
    var bar = document.querySelector('.pb-timer-bar > span');
    if (bar && left != null && match.settings && match.settings.seconds) bar.style.width = Math.max(0, Math.min(100, Math.round(left / match.settings.seconds * 100))) + '%';
    if (left === 0) { stopBattleTimer(); api.battleSubmit(); }
  }
  function startBattleTimer() {
    stopBattleTimer();
    var match = state.battle;
    if (!match || match.status !== 'question' || !match.settings || !match.settings.seconds) return;
    if (!match.deadline) match.deadline = Date.now() + match.settings.seconds * 1000;
    battleTimer = setInterval(paintBattleTimer, 1000);
  }
  /* Поиск исследователя перерисовывает список — возвращаем фокус в поле,
     иначе запрос нельзя набирать дальше. */
  function focusBattleRoster() {
    var field = document.getElementById('battle-roster');
    if (!field) return;
    field.focus();
    var end = field.value.length;
    if (field.setSelectionRange) field.setSelectionRange(end, end);
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

  /* Тулбар §4.7 тренажёра: тема сборки — штатный селект панели, справа
     счётчик слов и возврат в хаб (как в каталоге букв и повторении). */
  function trainerToolbar(t) {
    var themeOptions = THEMES.map(function(theme) {
      return '<option value="' + esc(theme) + '"' + (t.theme === theme ? ' selected' : '') + '>' + esc(theme) + '</option>';
    }).join('');
    return '<section class="lab-toolbar" aria-label="Панель палео-тренажёра">' +
        '<label class="lab-toolbar-field" for="trainer-theme">Тема' +
          '<select class="lab-select lab-toolbar-select" id="trainer-theme" onchange="LearnLab.trainerTheme(this.value)">' + themeOptions + '</select>' +
        '</label>' +
        '<div class="lab-toolbar-actions">' +
          '<span class="lab-toolbar-count" data-trainer-count>Слово <strong>' + t.wordIndex + '</strong> из ' + (t.totalWords || 300) + '</span>' +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn learn-back" onclick="LearnLab.home()"><i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>К обучению</button>' +
        '</div>' +
      '</section>';
  }

  /* Ячейка 02: смысл тренажёра — слово собирается из уже пройденных букв,
     поэтому освоение алфавита стоит рядом с полем ответа. */
  function trainerProgressCell(p) {
    var done = completedLetters(), total = letters.length;
    var dots = LETTER_KEYS.map(function(key) {
      return '<span class="pt-dot' + (p.letters[key] && p.letters[key].status === 'complete' ? ' is-complete' : '') + '" title="' + esc(key) + '"></span>';
    }).join('');
    return '<section class="pt-cell pt-cell--progress">' +
      cellHead('02', 'Алфавит', done + ' из ' + total) +
      '<p class="pt-metric"><strong>' + Math.round(done / total * 100) + '%</strong><span>букв освоено</span></p>' +
      '<div class="pt-dots" aria-label="Прогресс по буквам">' + dots + '</div>' +
      '<p class="pt-legend"><span class="pt-dot is-complete"></span>пройдено уроком</p>' +
    '</section>';
  }

  /* Ячейка 03: разбор. До раскрытия — пунктирный намёк, чтобы вторая
     строка сетки не прыгала после «Показать разбор». */
  function trainerRevealCell(t) {
    if (!t.revealed) {
      return '<section class="pt-cell pt-cell--reveal">' +
        cellHead('03', 'Разбор', 'закрыт') +
        '<p class="pt-placeholder">Напишите смысл слова и откройте разбор: цепочка знаков, чтение сборки и сверка вашего ответа с ней.</p>' +
      '</section>';
    }
    var root = t.rootEntry || {};
    return '<section class="pt-cell pt-cell--reveal">' +
      cellHead('03', 'Разбор', 'уверенность: высокая · эмет') +
      '<div class="pt-gloss"><strong>' + esc(root.root || 'Корень') + '</strong><span>' + esc(root.translit || '') + '</span><span>' + esc(root.meaning || root.image || '') + '</span></div>' +
      '<p class="pt-reading">' + esc(weaverReading(t.entries)) + '</p>' +
      '<div class="pt-chain">' + trainerChainMarkup(t.entries) + '</div>' +
      '<p class="pt-comparison"><strong>Ваш ответ ↔ сборка</strong><span>' + comparisonMarkup(t) + '</span></p>' +
    '</section>';
  }

  function renderTrainer() {
    var t = trainerReady();
    var toolbar = trainerToolbar(t);
    if (!t.entries.length) {
      buildTrainerWord(t.theme).then(render);
      return toolbar + '<div class="learn-empty"><span class="learn-empty-glyph" lang="hbo" aria-hidden="true">𐆠</span><p class="learn-trainer-loading">Собираем слово…</p></div>';
    }
    var glyphs = t.entries.map(function(g) { return '<span class="pt-glyph">' + esc(g.paleo) + '</span>'; }).join('');
    return toolbar +
      '<div class="pt-bento">' +
        '<section class="pt-cell pt-cell--word">' +
          cellHead('01', 'Слово', t.entries.length + ' знаков') +
          '<div class="pt-stage"><div class="pt-glyphs" lang="hbo" aria-label="Палео-слово">' + glyphs + '</div><p class="pt-direction">Читается справа налево</p></div>' +
          '<label class="pt-prompt" for="trainer-answer">Что значит это слово?</label>' +
          '<div class="pt-answer"><input id="trainer-answer" class="lab-input pt-input" autocomplete="off" placeholder="Ваш смысл слова" value="' + esc(t.answer || '') + '" oninput="LearnLab.trainerAnswer(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();LearnLab.revealTrainer();}"></div>' +
          '<div class="pt-actions">' +
            '<button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.generateWord()">Другое слово</button>' +
            '<button type="button" class="lab-btn lab-btn-primary" onclick="LearnLab.nextTrainer()">Дальше</button>' +
            '<button type="button" class="lab-btn lab-btn-secondary" onclick="LearnLab.revealTrainer()">Показать разбор</button>' +
          '</div>' +
        '</section>' +
        trainerProgressCell(progress()) +
        trainerRevealCell(t) +
      '</div>';
  }
  /* Шапка модуля следует за внутренним экраном (реестр LabHero.views). */
    function applyHero() {
    if (!root.LabHero || !root.LabHero.setView) return;
    if (state.view === 'course' && state.course) {
      var course = state.course, lessons = course.lessons || [];
      root.LabHero.setView('learn', 'course', { title: course.title, subtitle: course.description, meta: [course.level + ' · ' + (window.LabPlural ? LabPlural(lessons.length, 'урок', 'урока', 'уроков') : lessons.length + ' уроков')] });
    } else if (state.view === 'lesson' && state.lesson) {
      var item = state.lesson.item;
      root.LabHero.setView('learn', 'lesson', { title: item.name, subtitle: item.image + ' · ' + item.meaning });
    } else if (state.view === 'game' && state.game) {
      root.LabHero.setView('learn', 'game');
    } else if (state.view === 'review') {
      root.LabHero.setView('learn', 'review');
    } else if (state.view === 'trainer') {
      root.LabHero.setView('learn', 'paleo-trainer');
    } else if (state.view === 'battle') {
      var battle = state.battle, battleMode = battle && battle.settings ? root.PaleoBattle.modeById(battle.settings.mode) : null;
      root.LabHero.setView('learn', 'paleo-trainer', { title: 'Палео-битва', subtitle: battle ? (battleMode.label + ' · ' + battle.cards.length * 2 + ' ходов · комната ' + battle.roomCode) : 'Два исследователя · темы и режимы · local-first', meta: battle ? [battle.theme || 'любая тема'] : [] });
    } else if (state.view === 'lessons' || state.view === 'courses') {
      root.LabHero.setView('learn', state.view);
    } else {
      root.LabHero.setView('learn', null);
    }
  }
  /* Клавиатура карточки: Пробел — раскрыть ответ, 1–4 — оценка.
     Слушатель один на весь модуль и проверяет view: на других экранах
     пробел остаётся прокруткой, а цифры — вводом. */
  var reviewKeysBound = false;
  var REVIEW_KEY_GRADES = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
  function bindReviewKeys() {
    if (reviewKeysBound) return;
    reviewKeysBound = true;
    document.addEventListener('keydown', function(event) {
      if (state.view !== 'review' || !state.review || !state.review.card) return;
      var target = event.target || {}, tag = target.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('.modal-overlay.show')) return;
      if (event.key === ' ' || event.code === 'Space') {
        if (event.repeat) return;
        if (!state.review.revealed) { event.preventDefault(); api.showReviewAnswer(); }
        return;
      }
      if (!state.review.revealed) return;
      var grade = REVIEW_KEY_GRADES[event.key];
      if (grade) { event.preventDefault(); api.gradeReview(grade); }
    });
  }

  function render() { var container = getContainer(); if (!container || !letters.length) return; if (state.view === 'lessons') container.innerHTML = renderLessons(); else if (state.view === 'lesson') container.innerHTML = renderLesson(); else if (state.view === 'review') container.innerHTML = renderReview(); else if (state.view === 'game') container.innerHTML = renderGame(); else if (state.view === 'courses') container.innerHTML = renderCourses(); else if (state.view === 'course') container.innerHTML = renderCourse(); else if (state.view === 'trainer') container.innerHTML = renderTrainer(); else if (state.view === 'battle') container.innerHTML = renderBattle(); else container.innerHTML = renderHome(); applyHero(); if (state.view === 'course') courseEnhance(); if (state.view === 'home') bindHubToolbar(container); if (state.view === 'lessons') bindLettersToolbar(container); }
  function markStarted(item) { var p = progress(); if (!p.letters[item.hebrew] || p.letters[item.hebrew].status !== 'complete') p.letters[item.hebrew] = {status:'progress',score:0}; touch(p); }
  function feedback(text, ok) { var el = document.getElementById('learn-feedback'); if (el) { el.textContent = text; el.className = 'learn-feedback ' + (ok ? 'is-correct' : 'is-wrong'); } }
  function advance(ok) { if (!ok) return; state.lesson.score++; if (state.lesson.step < 4) { state.lesson.step++; render(); } else { var p = progress(), item = state.lesson.item; p.letters[item.hebrew] = {status:'complete',score:state.lesson.score,attempts:(p.letters[item.hebrew] && p.letters[item.hebrew].attempts || 0) + 1,lastActivity:now()}; srsLetterCards(item).forEach(function(def) { srsSchedule(def.id, def.type, def.label, state.lesson.score >= 4 ? 'good' : 'hard'); }); touch(p); state.view = 'lesson'; state.lesson.done = true; render(); } }

  var api = {
    init: function() { if (!letters.length) loadLetters(); render(); },
    home: function() { navigate([]); },
    openLessons: function() { navigate(['lessons']); },
    openReview: function() { navigate(['review']); },
    showReviewAnswer: function() {
      if (!state.review || !state.review.card || state.review.revealed) return;
      state.review.revealed = true;
      render();
    },
    gradeReview: function(grade) {
      if (!state.review || !state.review.card) return;
      var card = state.review.card;
      srsSchedule(card.id, card.type, card.label, grade);
      state.review.done = (state.review.done || 0) + 1;
      state.review.card = queueReview();
      state.review.revealed = false;
      render();
    },
    openLesson: function(key) { var item = byKey(key); if (!item) return; markStarted(item); navigate(['lessons', encodeURIComponent(key)]); },
    submitText: function() { var input = document.getElementById('learn-answer'), step = state.lesson.step, expected = step === 1 ? state.lesson.item.name : state.lesson.item.meaning; if (!input) return; var ok = inputMatch(input.value, expected); if (ok) advance(true); else feedback('Пока не совпало. Попробуйте ещё раз.', false); },
    answer: function(key) { var ok = key === state.lesson.item.hebrew; if (ok) advance(true); else feedback('Это другой образ. Попробуйте ещё раз.', false); },
    openGame: function() { navigate(['game']); },
    openCourses: function() { navigate(['courses']); },
    openTrainer: function() { navigate(['paleo-trainer']); },
    openBattle: function() { navigate(['paleo-trainer', 'battle']); },
    /* Состав и режим меняются до старта; ник пишется прямо в панели. */
    newBattle: function() { var setup = battleSetup(); battleCards(setup).then(function(cards) { stopBattleTimer(); state.battle = root.PaleoBattle.createMatch(cards, { names: setup.names, mode: setup.mode, theme: setup.theme }); root.PaleoBattle.save(state.battle); startBattleTimer(); render(); }); },
    battleMode: function(mode) { battleSetup().mode = root.PaleoBattle.modeById(mode).id; render(); },
    battleTheme: function(theme) { battleSetup().theme = THEMES.indexOf(theme) === -1 ? '' : theme; render(); },
    battleQuery: function(value) { battleSetup().query = String(value || '').slice(0, 40); render(); focusBattleRoster(); },
    battleRename: function(index, value) { var match = state.battle; if (!match || !match.players[index]) return; var player = match.players[index]; player.name = String(value || '').slice(0, 24); player.avatar = root.PaleoBattle.avatarFor(player.name); },
    battleInvite: function(index) { var setup = battleSetup(), found = root.PaleoBattle.searchRoster(setup.query)[index]; if (!found) return; var slot = setup.slot; setup.names[slot] = found.name; if (state.battle && state.battle.players[slot] && state.battle.status === 'question') { state.battle.players[slot].name = found.name; state.battle.players[slot].avatar = root.PaleoBattle.avatarFor(found.name); root.PaleoBattle.save(state.battle); } setup.slot = slot === 0 ? 1 : 0; setup.query = ''; render(); },
    battleSaveName: function() { var match = state.battle; if (!match || !String(match.players[0].name || '').trim()) return; battleSetup().names = [match.players[0].name, match.players[1].name]; root.PaleoBattle.saveRoster([{ name: match.players[0].name }, { name: match.players[1].name }]); render(); },
    /* Черновик ответа живёт в матче: таймер перерисовывает экран и не должен
       стирать введённое (тот же приём, что с фидбэком в игре). */
    battleDraft: function(id, value) { var match = battleReady(); if (!match) return; if (id === 'hinted') match.draft.hinted = !!value; else match.draft[id.replace(/^battle-/, '')] = value; },
    battleSubmit: function() { var match = battleReady(); if (!match || match.status !== 'question') return; stopBattleTimer(); root.PaleoBattle.submitRound(match, Object.assign({ hinted: !!match.draft.hinted }, match.draft)); root.PaleoBattle.save(match); render(); },
    battleNext: function() { var match = battleReady(); if (!match || match.status !== 'review') return; root.PaleoBattle.nextRound(match); root.PaleoBattle.save(match); if (match.status === 'question') startBattleTimer(); render(); },
    trainerTheme: function(theme) { var t = trainerReady(); if (THEMES.indexOf(theme) === -1) return; buildTrainerWord(theme).then(render); },
    trainerAnswer: function(value) { trainerReady().answer = String(value || ''); },
    revealTrainer: function() { var t = trainerReady(); if (!t.entries.length) return; t.revealed = true; markLettersLearned(t.entries); render(); },
    nextTrainer: function() { var t = trainerReady(); if (t.entries.length) markLettersLearned(t.entries); buildTrainerWord(t.theme).then(render); },
    generateWord: function() { var t = trainerReady(); buildTrainerWord(t.theme).then(render); },
    applyRoute: applyRoute,
    routeTitle: routeTitle,
    toggleLesson: function(courseId, lessonId) { var p = courseProgress(); if (p.lessons[lessonId]) delete p.lessons[lessonId]; else p.lessons[lessonId] = { course: courseId, done: true, at: now() }; write(COURSE_KEY, p); render(); },
    toggleModule: function(index) { if (!state.course) return; state.courseOpenModule = state.courseOpenModule === index ? -1 : index; writeCourseOpen(state.course.id, state.courseOpenModule); render(); },
    jumpToModule: function(index) { if (!state.course) return; state.courseOpenModule = index; writeCourseOpen(state.course.id, index); render(); var section = document.getElementById('course-module-' + index); if (section) { var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } },
    /* Фидбэк живёт в состоянии, а не в DOM: таймер перерисовывает экран
       каждую секунду и стирал бы текст ответа до следующего раунда. */
    gameAnswer: function(key) { var game=state.game; if (!game || game.locked) return; game.locked=true; var ok=key===game.item.hebrew, earned=0; if(ok){game.streak++; earned=10*(game.streak >= 3 ? 3 : game.streak === 2 ? 2 : 1); game.score+=earned;} else {game.streak=0; game.score=Math.max(0,game.score-5);} game.feedback={ ok:ok, earned:earned, correct:game.item.image }; render(); setTimeout(function(){ if(!state.game || state.game !== game) return; if(game.round >= 10) finishGame(); else {game.round++; nextRound();} },700); },
    openCourse: function(id) { navigate(['courses', encodeURIComponent(id)]); },
    reset: function() { if (!window.LabModal) return; window.LabModal.show('Сбросить прогресс?', '<p class="learn-hub-reset-text">Будут удалены уроки букв, очередь повторения и рекорд игры, сохранённые в этом браузере. Прогресс курсов останется.</p>', '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Отмена</button><button type="button" class="lab-btn lab-btn-primary lab-btn-sm learn-danger" onclick="LearnLab.resetConfirm()">Сбросить</button>'); },
    resetConfirm: function() { localStorage.removeItem(PROGRESS_KEY); localStorage.removeItem(RECORD_KEY); localStorage.removeItem(SRS_KEY); state.trainer = null; state.review = null; if (window.LabModal) window.LabModal.close(); navigate([]); render(); },
    startFirst: function() { navigate(['lessons', encodeURIComponent(LETTER_KEYS[0])]); },
    continueLast: function() { var dest = lastDestination(); navigate(dest ? dest.segments : ['review']); }
  };
  function nextRound() { var item=letters[Math.floor(Math.random()*letters.length)]; state.game.item=item; state.game.choices=distractors(item); state.game.locked=false; delete state.game.feedback; render(); }
  function finishGame() { stopTimer(); state.game.done=true; var best=Math.max(record(),state.game.score); localStorage.setItem(RECORD_KEY,String(best)); render(); }
  function stopTimer() { if(state.timer){clearInterval(state.timer);state.timer=null;} }
  function startTimer() { stopTimer(); state.timer=setInterval(function(){ if(!state.game || state.game.done) return stopTimer(); state.game.time--; if(state.game.time<=0){state.game.time=0; finishGame();} else render(); },1000); }
  root.LearnLab = api;
}(typeof window !== 'undefined' ? window : this));

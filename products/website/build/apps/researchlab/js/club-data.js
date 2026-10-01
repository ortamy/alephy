/**
 * club-data.js — адаптер данных Палео-клуба.
 * В production читает Supabase, локально использует MOCK и localStorage.
 */
const ClubData = (function () {
  'use strict';
  var STORAGE_KEY = 'alephy_club_posts';
  var MOCK = {
    profiles: [
      { handle: 'маскиль_а', level: 3, color: '#b8860b', initial: 'М' },
      { handle: 'ор_ищет', level: 2, color: '#8b6914', initial: 'О' },
      { handle: 'собиратель', level: 5, color: '#d4a017', initial: 'С' },
      { handle: 'наблюдатель', level: 1, color: '#6b4a10', initial: 'Н' },
      { handle: 'свидетель', level: 4, color: '#c9a227', initial: 'С' },
      { handle: 'связующий', level: 2, color: '#a08050', initial: 'С' }
    ],
    sessions: [
      { id: 'session-meaning', status: 'active', date: 'Сегодня, 19:00', title: 'Как рождается значение', participants: 6, capacity: 10, progress: 68, findings: 'Собираем механику корня 𐤃𐤁𐤓: слово как действие', action: 'Войти в сессию' },
      { id: 'session-shabbat', status: 'upcoming', date: '12 сентября 2026, 19:00', title: 'Шаббат: остановка в потоке', participants: 4, capacity: 10, progress: 0, findings: 'Читаем 𐤔𐤁𐤕 через образ возвращения и точки цикла.', action: 'Записаться' },
      { id: 'session-mitsraim', status: 'completed', date: '29 августа 2026', title: 'Мицраим: форма сужения', participants: 8, capacity: 10, progress: 100, findings: 'Зафиксированы 3 наблюдения и 2 вопроса для следующей проверки.', action: 'Смотреть итоги', result: [3, 5, 2, 8] },
      { id: 'session-alphabet', status: 'completed', date: '22 августа 2026', title: 'Маршруты алфавита', participants: 7, capacity: 10, progress: 100, findings: 'Карта переходов Синай → Ханаан → Финикия собрана.', action: 'Смотреть итоги', result: [5, 7, 4, 9] }
    ],
    cards: [
      { id: 'shabbat', type: 'word', ref: 'שבת', title: 'Шаббат — остановка в потоке', synthesis: 'Корень 𐤔𐤁𐤕: шаббат — точка возврата в цикл творения.', participants: 0, posts_count: 7, emet: 12, questions: 3, confidence: 'рабочая карта', attachment: { route: '#learn/paleo-trainer', params: 'shabbat', label: 'Тренажёр' } },
      { id: 'mitsraim', type: 'word', ref: 'מצרים', title: 'Мицраим — сужение потока', synthesis: 'Корень 𐤌𐤑𐤓: узость и сужение как форма потока.', participants: 1, posts_count: 4, emet: 8, questions: 2, confidence: 'рабочая гипотеза', attachment: { route: '#root-dictionary', params: 'mitsraim', label: 'Словарь' } },
      { id: 'sheol', type: 'state', ref: 'שאול', title: 'Состояние Шеол', synthesis: 'Тень жизни: отсутствие потока и возможность выхода.', participants: 2, posts_count: 5, emet: 6, questions: 4, confidence: 'требует проверки', attachment: { route: '#states', params: 'sheol', label: 'Состояния' } },
      { id: 'board-avraam', type: 'board', ref: 'אברהם', title: 'Доска: Авраам — отец множества', synthesis: 'Разбор имени: 𐤀𐤁𐤓𐤄𐤌. Сила дома движется к множеству.', participants: 6, posts_count: 11, emet: 15, questions: 5, confidence: 'подтверждается', attachment: { route: '#board', params: 'avraam', label: 'Доска' } },
      { id: 'translation-layers', type: 'verse', ref: 'ЛXX · Исход 3', title: 'Когда действие становится понятием', synthesis: 'Сравнение еврейского, греческого и славянского слоёв: где перевод меняет направление образа.', participants: 4, posts_count: 9, emet: 10, questions: 6, confidence: 'рабочая карта', attachment: { route: '#researches', params: 'translation-layers', label: 'Архив исследований' } },
      { id: 'body-as-instrument', type: 'state', ref: 'Практика · тело', title: 'Тело как инструмент чтения', synthesis: 'Наблюдение за дыханием, жестом и ритмом как способом проверить телесный слой древнего образа.', participants: 3, posts_count: 6, emet: 7, questions: 4, confidence: 'гипотеза', attachment: { route: '#states', params: 'body-as-instrument', label: 'Состояния' } },
      { id: 'alphabet-routes', type: 'board', ref: 'Синай → Финикия', title: 'Маршруты алфавита', synthesis: 'История перехода знаков между Синаем, Ханааном, Финикией и греческим миром без единой точки происхождения.', participants: 5, posts_count: 12, emet: 18, questions: 3, confidence: 'требует проверки', attachment: { route: '#researches', params: 'alphabet-routes', label: 'Архив исследований' } },
      { id: 'semitic-comparison', type: 'word', ref: 'Иврит · арабский · арамейский', title: 'Один корень — разные механики', synthesis: 'Сопоставление семитских языков: что сохраняется в корне, а что появляется только в поздней интерпретации.', participants: 7, posts_count: 8, emet: 11, questions: 5, confidence: 'сравнительное наблюдение', attachment: { route: '#root-dictionary', params: 'semitic-comparison', label: 'Словарь корней' } }
    ],
    comments: {
      shabbat: [
        { id: 'c1', author: 0, body: 'Шаббат — точка возврата в цикле.', emet: 3, questions: 1 },
        { id: 'c2', author: 1, body: 'Корень שבת можно прочитать как возвращение в дом.', emet: 2, questions: 0 },
        { id: 'c3', author: 2, body: 'Шав и бет: возвращение домой каждую неделю.', emet: 5, questions: 0, attachment: { route: '#root-dictionary', params: 'shabat', label: 'שבת' } }
      ],
      mitsraim: [{ id: 'c4', author: 3, body: 'Узость — форма, которая сжимает поток.', emet: 1, questions: 0 }, { id: 'c5', author: 4, body: 'Интересно сравнить эту механику с другими культурами.', emet: 2, questions: 1 }],
      sheol: [{ id: 'c6', author: 5, body: 'Шеол — отсутствие потока, а не окончательная точка.', emet: 4, questions: 2 }],
      'board-avraam': [{ id: 'c7', author: 0, body: 'Авраам: сила дома движется к множеству.', emet: 6, questions: 0 }, { id: 'c8', author: 1, body: 'Доска помогает увидеть связи.', emet: 3, questions: 0 }]
    }
  };
  function localComments(id) { var comments = (MOCK.comments[id] || []).slice(); try { comments = comments.concat(JSON.parse(localStorage.getItem(STORAGE_KEY + '_' + id) || '[]')); } catch (e) {} return comments; }
  function localThreads() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_threads') || '[]'); } catch (e) { return []; } }
  function getCards() { var client = window.supabase || window.supabaseClient; var local = localThreads(); if (client && client.from) return client.from('research_threads').select('*').order('created_at', { ascending: false }).then(function (r) { if (r.error || !r.data || !r.data.length) throw r.error || Error('empty'); return r.data.concat(local); }).catch(function () { return MOCK.cards.concat(local); }); return Promise.resolve(MOCK.cards.concat(local)); }
  function getCard(id) { return getCards().then(function (cards) { return cards.find(function (card) { return card.id === id; }); }); }
  function getComments(id) { var client = window.supabase || window.supabaseClient; if (client && client.from) return client.from('research_comments').select('*').eq('thread_id', id).order('created_at', { ascending: true }).then(function (r) { if (r.error || !r.data) throw r.error || Error('empty'); return r.data; }).catch(function () { return localComments(id); }); return Promise.resolve(localComments(id)); }
  function addComment(id, comment) { comment.id = 'local_' + Date.now(); comment.emet = 0; comment.questions = 0; try { var key = STORAGE_KEY + '_' + id; var saved = JSON.parse(localStorage.getItem(key) || '[]'); saved.push(comment); localStorage.setItem(key, JSON.stringify(saved)); } catch (e) {} return Promise.resolve(comment); }
  function addThread(thread) { try { var key = STORAGE_KEY + '_threads'; var saved = localThreads(); saved.unshift(thread); localStorage.setItem(key, JSON.stringify(saved)); } catch (e) {} return Promise.resolve(thread); }
  function getProfile(index) { return MOCK.profiles[index % MOCK.profiles.length]; }
  function getSessions() { return Promise.resolve(MOCK.sessions.slice()); }
  function getWordOfDay() { return AlephyUtils.fetchJson('data/roots/roots.json').then(function (roots) { var root = roots[0]; return { hebrew: root.root, paleo: root.paleo, translit: root.translit, gloss: root.meaning, image: root.image }; }).catch(function () { return { hebrew: 'אב', paleo: ['𐤀', '𐤁'], translit: 'AV', gloss: 'отец, источник', image: 'сила дома' }; }); }
  return { getCards: getCards, getCard: getCard, getComments: getComments, getSessions: getSessions, addComment: addComment, addThread: addThread, getProfile: getProfile, getWordOfDay: getWordOfDay, MOCK: MOCK };
}());
window.ClubData = ClubData;
/* Чистая модель «Палео-битвы»: карточки, режимы, состав, очки и
   local-first storage. Версия 1 не меняется — старые матчи читаются
   нормализацией `sanitizeMatch`. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaleoBattle = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_KEY = 'alephy_paleo_battle';
  var ROSTER_KEY = 'alephy_battle_roster';
  var MATCH_ROUNDS = 5;
  var STATUS = ['факт', 'интерпретация', 'гипотеза'];
  var WEIGHTS = { image: 100, function: 50, sequence: 100, explanation: 50, status: 25 };
  /* Режимы задают только параметры партии: длину, тайминг и стоимость
     подсказки. Правила проверки ответов не расходятся между режимами —
     иначе счёт перестаёт быть сравнимым. */
  var MODES = [
    { id: 'duel', label: 'Дуэль', rounds: 5, seconds: 90, hints: true, timeBonus: false, desc: 'Классическая партия: пять карточек, ход за ходом.' },
    { id: 'blitz', label: 'Блиц', rounds: 3, seconds: 45, hints: false, timeBonus: true, desc: 'Короткие раунды, подсказок нет, остаток времени даёт бонус.' },
    { id: 'marathon', label: 'Марафон', rounds: 10, seconds: 120, hints: true, timeBonus: true, desc: 'Длинная партия: десять карточек и бонус за быстрый ответ.' },
    { id: 'chain', label: 'Цепь', rounds: 5, seconds: 90, hints: true, timeBonus: false, desc: 'Карточки одной темы: механика читается подряд.' }
  ];
  var DEFAULT_ROSTER = [
    { name: 'Исследователь А', level: 1 },
    { name: 'Исследователь Б', level: 1 },
    { name: 'маскиль_а', level: 3 },
    { name: 'ор_ищет', level: 2 },
    { name: 'собиратель', level: 5 },
    { name: 'свидетель', level: 4 },
    { name: 'наблюдатель', level: 1 },
    { name: 'связующий', level: 2 }
  ];

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).toLocaleLowerCase('ru-RU').replace(/[ё]/g, 'е').replace(/\s+/g, ' '); }
  function includesAnswer(answer, expected) {
    var actual = normalize(answer), target = normalize(expected);
    return !!target && (actual === target || actual.indexOf(target) !== -1 || target.indexOf(actual) !== -1 && actual.length > 2);
  }
  function modeById(id) {
    var wanted = text(id);
    return MODES.filter(function(mode) { return mode.id === wanted; })[0] || MODES[0];
  }
  /* Аватар — знак из палео-алфавита, выбранный по нику: стабильный между
     сессиями и без загрузки картинок. */
  function avatarFor(name) {
    var value = text(name), sum = 0, i;
    if (!value) return '𐤀';
    for (i = 0; i < value.length; i += 1) sum = (sum * 31 + value.charCodeAt(i)) >>> 0;
    return String.fromCharCode(0x10900 + (sum % 22));
  }
  function store(storage) { return storage || (typeof localStorage !== 'undefined' ? localStorage : null) || {}; }
  function roster(storage) {
    var saved = [];
    try { saved = JSON.parse(store(storage).getItem(ROSTER_KEY)) || []; } catch (e) { saved = []; }
    var list = DEFAULT_ROSTER.slice();
    (Array.isArray(saved) ? saved : []).forEach(function(item) {
      var name = text(typeof item === 'string' ? item : item && item.name);
      if (name && !list.some(function(entry) { return entry.name === name; })) list.push({ name: name, level: text(item && item.level) || '—' });
    });
    return list;
  }
  function saveRoster(list, storage) {
    var existing = [], name;
    try { existing = JSON.parse(store(storage).getItem(ROSTER_KEY)) || []; } catch (e) { existing = []; }
    (list || []).forEach(function(item) {
      name = text(item && item.name ? item.name : item);
      if (name) existing.push({ name: name, level: text(item && item.level) || '—' });
    });
    try { store(storage).setItem(ROSTER_KEY, JSON.stringify(existing.slice(-24))); } catch (e) {}
    return roster(storage);
  }
  function searchRoster(query, storage) {
    var needle = normalize(query), list = roster(storage);
    if (!needle) return list;
    return list.filter(function(entry) { return normalize(entry.name).indexOf(needle) !== -1 || normalize(entry.level).indexOf(needle) !== -1; });
  }
function makeCards(roots, letters) {
    roots = Array.isArray(roots) ? roots : [];
    var byKey = {};
    (letters || []).forEach(function(letter) { byKey[letter.hebrew] = letter; });
    return roots.map(function(entry, index) {
      var word = text(entry && entry.root), chars = Array.from(word);
      var chain = chars.map(function(char) {
        var letter = byKey[char] || {};
        return { hebrew: char, paleo: letter.paleo || '', name: letter.name || '', meaning: letter.meaning || '' };
      });
      if (chain.some(function(part) { return !part.paleo; }) && Array.isArray(entry.paleo)) {
        chain = entry.paleo.map(function(paleo, i) { return { hebrew: chars[i] || '', paleo: paleo, name: '', meaning: (entry.paleoMeanings || [])[i] || '' }; });
      }
      if (word.length < 2 || !chain.length) return null;
      return {
        id: 'root-' + index + '-' + word,
        word: word,
        letters: chars,
        chain: chain,
        image: text(entry.image || entry.meaning),
        function: text(entry.function || entry.action || 'сборка образа через буквенную цепочку'),
        reconstruction: text(entry.reconstruction || entry.meaning || entry.image),
        status: STATUS.indexOf(entry.status) !== -1 ? entry.status : 'интерпретация',
        source: text(entry.source || 'корневой словарь')
      };
    }).filter(Boolean);
  }
  /* Тема = разрешённые буквы. Пустой список означает «любая тема». */
  function filterByLetters(cards, allowed) {
    if (!Array.isArray(allowed) || !allowed.length) return (cards || []).slice();
    return (cards || []).filter(function(card) {
      var letters = card.letters && card.letters.length ? card.letters : Array.from(text(card.word));
      return letters.length >= 2 && letters.every(function(letter) { return allowed.indexOf(letter) !== -1; });
    });
  }
  function fallbackCards() {
    return [{ id: 'fallback-av', word: 'אב', letters: ['א','ב'], chain: [{ hebrew: 'א', paleo: '𐤀', name: 'Алеф', meaning: 'сила' }, { hebrew: 'ב', paleo: '𐤁', name: 'Бет', meaning: 'вместилище' }], image: 'Сила дома — отец, источник семьи', function: 'образ источника в доме', reconstruction: 'отец, родоначальник, источник', status: 'интерпретация', source: 'локальный fallback' }];
  }
  function selectCards(cards, count, random) {
    var list = (cards && cards.length ? cards : fallbackCards()).slice();
    var result = [], pick = random || Math.random;
    while (list.length && result.length < (count || MATCH_ROUNDS)) result.push(list.splice(Math.floor(pick() * list.length), 1)[0]);
    return result;
  }
  function createRoomCode(random) { return String(1000 + Math.floor((random || Math.random)() * 9000)); }
  /* `setup` принимает и новый вид {names, mode, theme, rounds}, и старый
     {a, b} — вызовы из тестов и сохранённых экранов не ломаются. */
  function setupPlayers(setup) {
    var source = (setup && (setup.names || setup.players)) || setup || {};
    var list = Array.isArray(source) ? source : [source.a, source.b];
    var players = [];
    list.slice(0, 2).forEach(function(item, index) {
      var name = text(typeof item === 'string' ? item : item && item.name) || DEFAULT_ROSTER[index].name;
      players.push({ name: name, avatar: avatarFor(name), level: text(item && item.level) || '—', score: Number(item && item.score) || 0, streak: Number(item && item.streak) || 0, hints: Number(item && item.hints) || 0 });
    });
    while (players.length < 2) {
      var filler = DEFAULT_ROSTER[players.length].name;
      players.push({ name: filler, avatar: avatarFor(filler), level: '—', score: 0, streak: 0, hints: 0 });
    }
    return players;
  }
  function createMatch(cards, setup, random) {
    setup = setup || {};
    var mode = modeById(setup.mode);
    var rounds = Math.max(1, Math.min(10, Number(setup.rounds) || mode.rounds));
    return {
      version: 1,
      roomCode: createRoomCode(random),
      status: 'question',
      round: 0,
      currentPlayer: 0,
      players: setupPlayers(setup),
      cards: selectCards(cards, rounds, random),
      settings: { mode: mode.id, rounds: rounds, seconds: Number(setup.seconds) || mode.seconds, hints: mode.hints !== false, timeBonus: !!mode.timeBonus },
      theme: text(setup.theme),
      history: [],
      draft: {},
      deadline: 0,
      startedAt: new Date().toISOString()
    };
  }
  function scorePart(correct, points, hinted) { return correct ? Math.round(points * (hinted ? 0.5 : 1)) : 0; }
  function roundMax(hinted) { return hinted ? 163 : 325; }
  function scoreRound(question, answer, hintsUsed, options) {
    question = question || {}; answer = answer || {};
    options = options || {};
    var hinted = Number(hintsUsed || 0) > 0;
    var checks = { image: includesAnswer(answer.image, question.image), function: includesAnswer(answer.function, question.function), sequence: normalize(answer.sequence) === normalize(question.word), explanation: normalize(answer.explanation).length >= 12, status: normalize(answer.status) === normalize(question.status) };
    var points = 0;
    Object.keys(checks).forEach(function(key) { points += scorePart(checks[key], WEIGHTS[key], hinted); });
    /* Бонус за остаток времени — только в режимах с timeBonus и только
       без подсказки: подсказка уже стоит половины очков. */
    var bonus = options.timeBonus && !hinted ? Math.max(0, Math.round(Number(options.remaining || 0) / 10)) : 0;
    return { points: points + bonus, bonus: bonus, maxPoints: roundMax(hinted), accuracy: Math.round(Object.keys(checks).filter(function(key) { return checks[key]; }).length / 5 * 100), checks: checks, confidence: text(answer.confidence) || 'не указана', reviewRequired: !checks.sequence || !checks.explanation || answer.confidence === 'низкая' };
  }
  function achievements(match) {
    var history = match.history || [], earned = [];
    if (history.some(function(round) { return round.result.accuracy === 100; })) earned.push('Точная сборка');
    if (history.filter(function(round) { return round.result.checks.sequence; }).length >= 3) earned.push('След потока');
    if (history.some(function(round) { return round.result.checks.explanation; })) earned.push('Голос Давар');
    if (history.some(function(round) { return round.result.checks.status; })) earned.push('Эмет прежде Хошеха');
    if (history.length === MATCH_ROUNDS * 2) earned.push('Исследователь поля');
    return earned;
  }
  function playerRounds(match, index) {
    return (match.history || []).filter(function(round) { return round.player === index; });
  }
  function playerAchievements(match, index) {
    var rounds = playerRounds(match, index), earned = [];
    if (rounds.some(function(round) { return round.result.accuracy === 100; })) earned.push('Точная сборка');
    if (rounds.filter(function(round) { return round.result.checks.sequence; }).length >= 3) earned.push('След потока');
    if (rounds.some(function(round) { return round.result.checks.explanation; })) earned.push('Голос Давар');
    if (rounds.some(function(round) { return round.result.checks.status; })) earned.push('Эмет прежде Хошеха');
    if (match.status === 'finished') earned.push('Исследователь поля');
    return earned;
  }
  function playerStats(match, index) {
    var rounds = playerRounds(match, index), accuracy = 0;
    rounds.forEach(function(round) { accuracy += round.result.accuracy; });
    return {
      rounds: rounds.length,
      accuracy: rounds.length ? Math.round(accuracy / rounds.length) : 0,
      exact: rounds.filter(function(round) { return round.result.accuracy === 100; }).length,
      /* Форма: последние пять попыток — для мини-полосок в панели игроков. */
      form: rounds.slice(-5).map(function(round) { return round.result.accuracy; }),
      achievements: playerAchievements(match, index)
    };
  }
  /* Потолок очков матча — для кольца прогресса игрока в панели. */
  function matchMax(match) {
    var turns = (match.history || []).length + (match.status === 'question' ? 1 : 0);
    return Math.max(1, turns * roundMax(false));
  }
  function playerShare(match, index) {
    var player = (match.players || [])[index] || { score: 0 };
    return Math.max(0, Math.min(1, (player.score || 0) / matchMax(match)));
  }
  function remainingSeconds(match, at) {
    if (!match || match.status !== 'question' || !match.deadline) return null;
    return Math.max(0, Math.round((match.deadline - (at || Date.now())) / 1000));
  }
    function submitRound(match, answer) {
    if (!match || match.status !== 'question' || !match.cards[match.round]) return match;
    var settings = match.settings || {}, player = match.players[match.currentPlayer];
    var hinted = settings.hints === false ? false : !!(answer && answer.hinted);
    var payload = { sequence: (answer || {}).sequence, image: (answer || {}).image, function: (answer || {}).function, explanation: (answer || {}).explanation, confidence: (answer || {}).confidence, status: (answer || {}).status };
    var result = scoreRound(match.cards[match.round], payload, hinted, { timeBonus: settings.timeBonus, remaining: remainingSeconds(match) });
    player.score += result.points;
    player.streak = result.accuracy === 100 ? player.streak + 1 : 0;
    if (hinted) player.hints = (player.hints || 0) + 1;
    match.history.push({ round: match.round + 1, player: match.currentPlayer, answer: payload, hinted: hinted, result: result });
    match.status = 'review';
    match.draft = {};
    match.deadline = 0;
    return match;
  }
  function nextRound(match) {
    if (!match || match.status !== 'review') return match;
    if (match.currentPlayer === 0) { match.currentPlayer = 1; match.status = 'question'; return match; }
    if (match.round + 1 >= match.cards.length) { match.status = 'finished'; return match; }
    match.round += 1; match.currentPlayer = 0; match.status = 'question'; return match;
  }
  function winner(match) {
    if (!match || match.players[0].score === match.players[1].score) return 'draw';
    return match.players[0].score > match.players[1].score ? 0 : 1;
  }
  /* Старые матчи (version 1 без settings/draft/avatar) читаем как есть:
     недостающие поля заполняем значениями по умолчанию. */
  function sanitizeMatch(value) {
    if (!value || typeof value !== 'object') return null;
    var settings = value.settings || {}, mode = modeById(settings.mode);
    return {
      version: 1,
      roomCode: text(value.roomCode) || createRoomCode(),
      status: value.status || 'question',
      round: Number(value.round) || 0,
      currentPlayer: Number(value.currentPlayer) || 0,
      players: setupPlayers({ names: value.players }),
      cards: Array.isArray(value.cards) && value.cards.length ? value.cards : fallbackCards(),
      history: Array.isArray(value.history) ? value.history : [],
      settings: { mode: settings.mode || mode.id, rounds: Number(settings.rounds) || (Array.isArray(value.cards) ? value.cards.length : 0) || mode.rounds, seconds: Number(settings.seconds) || mode.seconds, hints: settings.hints !== false, timeBonus: !!settings.timeBonus },
      theme: text(value.theme),
      draft: value.draft && typeof value.draft === 'object' ? value.draft : {},
      deadline: Number(value.deadline) || 0,
      startedAt: text(value.startedAt) || new Date().toISOString()
    };
  }
  function save(match, storage) { try { (storage || localStorage).setItem(STORAGE_KEY, JSON.stringify(match)); return true; } catch (e) { return false; } }
  function load(storage) { try { return sanitizeMatch(JSON.parse((storage || localStorage).getItem(STORAGE_KEY))); } catch (e) { return null; } }
  return {
    STORAGE_KEY: STORAGE_KEY, ROSTER_KEY: ROSTER_KEY, MATCH_ROUNDS: MATCH_ROUNDS, STATUS: STATUS, MODES: MODES, WEIGHTS: WEIGHTS,
    makeCards: makeCards, filterByLetters: filterByLetters, fallbackCards: fallbackCards, selectCards: selectCards, createRoomCode: createRoomCode,
    modeById: modeById, avatarFor: avatarFor, roster: roster, saveRoster: saveRoster, searchRoster: searchRoster,
    createMatch: createMatch, scoreRound: scoreRound, roundMax: roundMax, submitRound: submitRound, nextRound: nextRound, winner: winner,
    achievements: achievements, playerRounds: playerRounds, playerStats: playerStats, playerAchievements: playerAchievements,
    playerShare: playerShare, matchMax: matchMax, remainingSeconds: remainingSeconds, sanitizeMatch: sanitizeMatch, save: save, load: load
  };
}));
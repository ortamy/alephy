'use strict';
const assert = require('assert');
const Battle = require('../js/paleo-battle.js');

const card = { word: 'אב', image: 'сила дома', function: 'образ источника', reconstruction: 'отец', status: 'интерпретация' };
let result = Battle.scoreRound(card, { image: 'Сила дома', function: 'образ источника', sequence: 'אב', explanation: 'Сила входит в дом как источник', status: 'интерпретация', confidence: 'высокая' });
assert.strictEqual(result.points, 325);
assert.strictEqual(result.accuracy, 100);
assert.strictEqual(result.reviewRequired, false);
result = Battle.scoreRound(card, { sequence: 'אב', explanation: 'коротко', status: 'гипотеза' });
assert.strictEqual(result.points, 100);
assert.strictEqual(result.reviewRequired, true);

const cards = [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), word: 'אב', chain: [], image: '', function: '', reconstruction: '', status: 'интерпретация' }));
const match = Battle.createMatch(cards, { a: 'А', b: 'Б' });
assert.match(match.roomCode, /^\d{4}$/);
assert.strictEqual(match.cards.length, 5);
assert.strictEqual(new Set(match.cards.map((item) => item.id)).size, 5);
for (let i = 0; i < 10; i += 1) {
  Battle.submitRound(match, { sequence: 'אב', explanation: 'Содержательное объяснение этапа', status: 'интерпретация' });
  Battle.nextRound(match);
}
assert.strictEqual(match.status, 'finished');
assert.strictEqual(match.history.length, 10);
assert.deepStrictEqual(Battle.winner(match), 'draw');
assert.ok(Battle.achievements(match).length >= 4);
const storage = { value: '', setItem(k, v) { this.value = v; }, getItem() { return this.value; } };
assert.strictEqual(Battle.save(match, storage), true);
assert.strictEqual(Battle.load(storage).history.length, 10);
storage.value = '{broken';
assert.strictEqual(Battle.load(storage), null);

// Режимы задают параметры партии: длину, тайминг и бонус за скорость.
assert.strictEqual(Battle.modeById('blitz').rounds, 3);
assert.strictEqual(Battle.modeById('нет-такого').id, 'duel');
const blitz = Battle.createMatch(cards, { mode: 'blitz', names: ['А', 'Б'] });
assert.strictEqual(blitz.settings.seconds, 45);
assert.strictEqual(blitz.settings.hints, false);
assert.strictEqual(blitz.cards.length, 3);
const timed = Battle.scoreRound(card, { image: 'Сила дома', function: 'образ источника', sequence: 'אב', explanation: 'Сила входит в дом как источник', status: 'интерпретация' }, 0, { timeBonus: true, remaining: 30 });
assert.strictEqual(timed.points, 325 + 3);
assert.strictEqual(timed.bonus, 3);

// Подсказка стоит половины и отключается режимом без подсказок.
const hintedRound = Battle.scoreRound(card, { sequence: 'אב' }, true, { timeBonus: true, remaining: 30 });
assert.strictEqual(hintedRound.points, 50);
assert.strictEqual(hintedRound.maxPoints, 163);

// Статистика игрока: форма по последним раундам и достижения.
const liveCards = [1, 2, 3, 4, 5, 6].map((n) => Object.assign({}, cards[n - 1], { word: 'אב', image: 'сила дома', function: 'образ источника' }));
const live = Battle.createMatch(liveCards, { names: ['А', 'Б'] });
Battle.submitRound(live, { sequence: 'אב', image: 'сила дома', function: 'образ источника', explanation: 'Содержательное объяснение этапа', status: 'интерпретация' });
const stats = Battle.playerStats(live, 0);
assert.strictEqual(stats.rounds, 1);
assert.strictEqual(stats.accuracy, 100);
assert.strictEqual(stats.exact, 1);
assert.deepStrictEqual(stats.form, [100]);
assert.ok(stats.achievements.includes('Точная сборка'));
assert.strictEqual(Battle.playerAchievements(live, 1).length, 0);
assert.ok(Battle.playerShare(live, 0) > 0 && Battle.playerShare(live, 0) <= 1);

// Тема = разрешённые буквы: карточки с чужими буквами отсеиваются.
const deck = Battle.makeCards([{ root: 'אב', paleo: ['𐤀','𐤁'], image: 'сила дома' }, { root: 'אדם', paleo: ['𐤀','𐤃','𐤌'], image: 'земное' }], []);
assert.deepStrictEqual(Battle.filterByLetters(deck, ['א', 'ב']).map((entry) => entry.word), ['אב']);
assert.deepStrictEqual(Battle.filterByLetters(deck, ['ד']).map((entry) => entry.word), []);
assert.strictEqual(Battle.filterByLetters(deck, []).length, 2);

// Состав: аватар по нику, поиск и сохранение исследователя.
assert.strictEqual(Battle.avatarFor('маскиль_а'), Battle.avatarFor('маскиль_а'));
assert.notStrictEqual(Battle.avatarFor('маскиль_а'), Battle.avatarFor('ор_ищет'));
assert.ok(Battle.searchRoster('собир').some((entry) => entry.name === 'собиратель'));
const rosterStore = { value: '', setItem(k, v) { this.value = v; }, getItem() { return this.value; } };
Battle.saveRoster([{ name: 'новый_исследователь' }], rosterStore);
assert.ok(Battle.searchRoster('новый', rosterStore).length === 1);

// Старое сохранение (version 1 без settings/draft/avatar) читается как есть.
const legacy = Battle.sanitizeMatch({ version: 1, roomCode: '1234', status: 'question', round: 1, currentPlayer: 1, players: [{ name: 'А', score: 10 }, { name: 'Б', score: 20 }], cards, history: [] });
assert.strictEqual(legacy.settings.mode, 'duel');
assert.strictEqual(legacy.draft.hinted, undefined);
assert.strictEqual(legacy.players[1].score, 20);
assert.ok(legacy.players[0].avatar);
assert.strictEqual(Battle.sanitizeMatch(null), null);

// Матч без подсказок не должен отмечать подсказку игрока.
Battle.submitRound(blitz, { sequence: 'אב', explanation: 'Достаточно длинное объяснение хода', status: 'интерпретация', hinted: true });
assert.strictEqual(blitz.players[0].hints, 0);
console.log('OK: Paleo Battle scoring, modes, roster, players and storage');
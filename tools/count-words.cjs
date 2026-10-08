// lab-dict-expand.cjs — расширение словарей Research Lab из существующих
// источников проекта (без выдумывания данных):
//   1) data/roots/roots.json  ← src/data/tanakh/data/new_roots.json (уникальные)
//   2) data/paleo-glossary/roots.json ← карточки для всех корней без записи
//   3) data/dictionaries.json ← термины из docs/05-DICTIONARIES/*.md, которых нет в JSON
// Запуск: node tools/lab-dict-expand.cjs [--dry]
const fs = require('fs');
const path = require('path');

const LAB = 'products/website/apps/researchlab';
const DATA = LAB + '/data';
const DRY = process.argv.includes('--dry');

// --- Канонические словари (js/paleo-letters.js, поле meaning) ---
const LETTER_MEANING = {
  'א': 'сила', 'ב': 'вместилище', 'ג': 'движение', 'ד': 'вход', 'ה': 'откровение',
  'ו': 'соединение', 'ז': 'инструмент', 'ח': 'отделение', 'ט': 'оборачивание',
  'י': 'действие', 'כ': 'удержание', 'ך': 'удержание', 'ל': 'направление',
  'מ': 'течение', 'ם': 'течение', 'נ': 'жизнь', 'ן': 'жизнь', 'ס': 'поддержка',
  'ע': 'видение', 'פ': 'речь', 'ף': 'речь', 'צ': 'цель', 'ץ': 'цель',
  'ק': 'окружение', 'ר': 'начало', 'ש': 'разрушение', 'ת': 'завет'
};
const LETTER_PALEO = {
  'א': '𐤀', 'ב': '𐤁', 'ג': '𐤂', 'ד': '𐤃', 'ה': '𐤄', 'ו': '𐤅', 'ז': '𐤆',
  'ח': '𐤇', 'ט': '𐤈', 'י': '𐤉', 'כ': '𐤊', 'ך': '𐤊', 'ל': '𐤋', 'מ': '𐤌',
  'ם': '𐤌', 'נ': '𐤍', 'ן': '𐤍', 'ס': '𐤎', 'ע': '𐤏', 'פ': '𐤐', 'ף': '𐤐',
  'צ': '𐤑', 'ץ': '𐤑', 'ק': '𐤒', 'ר': '𐤓', 'ש': '𐤔', 'ת': '𐤕'
};
function stripNiqqud(value) {
  return String(value || '').replace(/[\u0591-\u05C7]/g, '');
}

const LETTER_TRANSLIT = {
  'א': 'ʾ', 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ה': 'H', 'ו': 'W', 'ז': 'Z',
  'ח': 'ḥ', 'ט': 'ṭ', 'י': 'Y', 'כ': 'K', 'ך': 'K', 'ל': 'L', 'מ': 'M',
  'ם': 'M', 'נ': 'N', 'ן': 'N', 'ס': 'S', 'ע': 'ʿ', 'פ': 'P', 'ף': 'P',
  'צ': 'ṣ', 'ץ': 'ṣ', 'ק': 'Q', 'ר': 'R', 'ש': 'š', 'ת': 'T'
};

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, data) {
  if (DRY) { console.log('[dry] запись пропущена:', p); return; }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// «человек, человечество, земной (от אדמה — земля)» → «человек, человечество, земной»;
// «выходить, уходить, go out» → «выходить, уходить».
function cleanGloss(meaning) {
  let s = String(meaning || '');
  s = s.replace(/\s*\((?:от|см\.|ср\.)[^)]*\)/gi, '');
  s = s.split(',').map(seg => seg.trim())
    .filter(seg => seg && !/^[a-zA-Z\s'-]+$/.test(seg))
    .join(', ');
  return s.trim();
}

function buildMechanics(root) {
  const parts = [];
  for (const ch of String(root)) {
    const glyph = LETTER_PALEO[ch];
    const meaning = LETTER_MEANING[ch];
    if (glyph && meaning) parts.push(glyph + ' (' + meaning + ')');
  }
  return parts.join(' + ');
}

// ===== 1. Корневой словарь =====
function expandRoots() {
  const target = DATA + '/roots/roots.json';
  const roots = readJson(target);
  const source = readJson('products/website/src/data/tanakh/data/new_roots.json');
  const have = new Set(roots.map(r => stripNiqqud(r.root)));

  const added = [];
  const seen = new Set();
  const keys = ['root', 'translit', 'meaning', 'paleo', 'paleoMeanings', 'image', 'examples', 'substitutions'];
  for (const entry of source) {
    if (!entry || !entry.root || have.has(stripNiqqud(entry.root)) || seen.has(entry.root)) continue;
    if (keys.some(k => entry[k] === undefined)) {
      console.log('  пропуск (нет полей):', entry.root);
      continue;
    }
    seen.add(entry.root);
    added.push(entry);
  }

  console.log('1. Корневой словарь: +' + added.length + ' (было ' + roots.length + ')');
  added.forEach(r => console.log('   +', r.root, '—', cleanGloss(r.meaning)));
  if (!DRY && added.length) writeJson(target, roots.concat(added));
  return roots.concat(added);
}

// ===== 2. Палео-глоссарий =====
function expandGlossary(allRoots) {
  const target = DATA + '/paleo-glossary/roots.json';
  const gloss = readJson(target);

  // Дедуп карточек корней по нормализованному корню: никуд-дот (שׂ/שׁ) не должен
  // плодить повторные карточки. Слово-формы (source: 'tanakh') не трогаем.
  const seen = new Set();
  const base = [];
  let normalized = 0;
  for (const card of gloss) {
    if (card.source === 'tanakh') { base.push(card); continue; }
    // hebrew уже без никуд-точки — приводим и корень, чтобы список не дублировался.
    if (card.root) {
      const fixed = stripNiqqud(card.root);
      if (fixed !== card.root) { card.root = fixed; normalized++; }
    }
    const key = card.root;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    base.push(card);
  }
  if (base.length !== gloss.length) console.log('  дедуп глоссария:', gloss.length - base.length, 'повторов');
  if (normalized) console.log('  нормализация корней:', normalized);

  const added = [];
  for (const r of allRoots) {
    const norm = r.root ? stripNiqqud(r.root) : '';
    if (seen.has(norm)) continue;
    const chars = norm ? Array.from(norm) : [];
    const glyphs = chars.map(c => LETTER_PALEO[c]);
    if (glyphs.some(g => !g)) {
      console.log('  пропуск (нет палео-букв):', r.root);
      continue;
    }
    const fn = cleanGloss(r.meaning);
    if (!fn) { console.log('  пропуск (нет функции):', r.root); continue; }
    const entry = {
      paleo: glyphs.join('·'),
      hebrew: chars.join('.'),
      translit: String(r.translit || '').toLowerCase(),
      function: fn,
      root: norm
    };
    const mechanics = buildMechanics(norm);
    if (mechanics) entry.paleoMechanics = mechanics + ' = последовательность, которая собирает функцию «' + fn + '»';
    added.push(entry);
    seen.add(norm);
  }

  console.log('2. Палео-глоссарий: +' + added.length + ' (было ' + gloss.length + ')');
  if (!DRY && (added.length || base.length !== gloss.length || normalized)) writeJson(target, base.concat(added));
}

// ===== 3. Карты подмен: недостающие термины из docs/05-DICTIONARIES =====
const MD_FOR_KEY = {
  economisms: 'ECONOMISMS.md', estethisms: 'ESTETHISMS.md',
  gastronomisms: 'GASTRONOMISMS.md', juridisms: 'JURIDISMS.md',
  latinisms: 'LATINISMS.md', marketisms: 'MARKETISMS.md',
  mediasms: 'MEDIASMS.md', medicinisms: 'MEDICINISMS.md',
  militarisms: 'MILITARISMS.md', modernisms: 'MODERNISMS.md',
  names: 'NAMES.md', newageisms: 'NEWAGEISMS.md',
  phrases: 'PHRASISMS.md', politisms: 'POLITISMS.md',
  psychologisms: 'PSYCHOLOGISMS.md', scientisms: 'SCIENTISMS.md',
  slavicisms: 'SLAVICISMS.md', sportisms: 'SPORTISMS.md',
  technologisms: 'TECHNOLOGISMS.md'
};

// «#### 123. Облатка (oblata) → Лехем (לֶחֶם)» → { word: 'Облатка', hebrew: 'לֶחֶם' }
function parseMdTerms(text) {
  const out = [];
  const re = /^####\s+\d+\.\s+(.+?)\s+→\s+(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const left = m[1];
    const right = m[2];
    const word = left.replace(/\s*\([^)]*\)\s*$/, '').trim();
    let hebrew = '';
    const paren = right.match(/[([]([\u0590-\u05FF][\u0591-\u05C7\s·\u05BE]+)[)\]]/);
    if (paren) hebrew = paren[1].trim();
    else {
      const run = right.match(/[\u0590-\u05FF][\u0591-\u05C7\s\u05F3\u05F4]*/g);
      if (run) hebrew = run.join('').trim();
    }
    if (word) out.push({ word, hebrew });
  }
  return out;
}

function expandSubstitutionMaps() {
  const target = DATA + '/dictionaries.json';
  const dicts = readJson(target);
  const dd = 'docs/05-DICTIONARIES';
  let totalAdded = 0;

  for (const key of Object.keys(MD_FOR_KEY)) {
    const dict = dicts[key];
    if (!dict) continue;
    const mdPath = path.join(dd, MD_FOR_KEY[key]);
    if (!fs.existsSync(mdPath)) continue;
    const mdTerms = parseMdTerms(fs.readFileSync(mdPath, 'utf8'));
    if (!mdTerms.length) continue;

    const have = new Set((dict.terms || []).map(t => String(t.word).toLowerCase()));
    const added = [];
    for (const t of mdTerms) {
      if (have.has(t.word.toLowerCase())) continue;
      if (!t.hebrew) continue; // без иврита карточка в модуле неполноценна
      const bare = Array.from(t.hebrew.replace(/[\u0591-\u05C7]/g, ''));
      const glyphs = bare.map(c => LETTER_PALEO[c]);
      if (glyphs.some(g => !g)) continue; // не-буквенные символы — пропускаем
      added.push({ word: t.word, hebrew: t.hebrew, paleo: glyphs, restored: '' });
      have.add(t.word.toLowerCase());
    }
    if (added.length) {
      console.log('3.', key, ': +' + added.length, '(было', (dict.terms || []).length + ')');
      dict.terms = (dict.terms || []).concat(added);
      totalAdded += added.length;
    }
  }
  console.log('3. Карты подмен: всего +' + totalAdded);
  if (!DRY && totalAdded) writeJson(target, dicts);
}

console.log(DRY ? '=== DRY RUN ===' : '=== ЗАПИСЬ ===');

// --wb: сколько стихов имеют word_breakdown (источник функций слов)
if (process.argv.includes('--wb')) {
  const dir = 'products/website/apps/researchlab/data/scripture';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let versesWithWb = 0, versesTotal = 0;
  const forms = new Map();
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!Array.isArray(d)) continue;
    let wbCount = 0;
    for (const v of d) {
      versesTotal++;
      const wb = v.word_breakdown;
      if (!Array.isArray(wb) || !wb.length) continue;
      versesWithWb++;
      wbCount++;
      for (const w of wb) {
        const bare = String(w.hebrew || '').replace(/[֑-ׇ]/g, '');
        if (!bare || !w.function) continue;
        if (!forms.has(bare)) forms.set(bare, { fn: w.function, paleo: w.paleo || '', book: f });
      }
    }
    if (wbCount) console.log(f, '→ стихов с word_breakdown:', wbCount, 'из', d.length);
  }
  console.log('');
  console.log('стихов всего:', versesTotal, '| с word_breakdown:', versesWithWb);
  console.log('уникальных словоформ с функцией:', forms.size);
  let i = 0;
  for (const [k, v] of forms) {
    if (i++ >= 25) break;
    console.log(k, '|', v.fn.slice(0, 70));
  }
  process.exit(0);
}

// --diag: синхронизация md ↔ JSON карт подмен
if (process.argv.includes('--diag')) {
  const dicts = readJson(DATA + '/dictionaries.json');
  for (const key of Object.keys(MD_FOR_KEY)) {
    const dict = dicts[key];
    if (!dict) continue;
    const mdPath = path.join('docs/05-DICTIONARIES', MD_FOR_KEY[key]);
    if (!fs.existsSync(mdPath)) continue;
    const mdTerms = parseMdTerms(fs.readFileSync(mdPath, 'utf8'));
    const have = new Set((dict.terms || []).map(t => String(t.word).toLowerCase()));
    let dup = 0, noHeb = 0, noGlyph = 0, fresh = 0;
    for (const t of mdTerms) {
      if (have.has(t.word.toLowerCase())) { dup++; continue; }
      if (!t.hebrew) { noHeb++; continue; }
      const bare = Array.from(t.hebrew.replace(/[֑-ׇ]/g, ''));
      if (bare.some(c => !LETTER_PALEO[c])) { noGlyph++; continue; }
      fresh++;
    }
    console.log(key, '| md:', mdTerms.length, '| dup:', dup, '| без иврита:', noHeb, '| нет глифов:', noGlyph, '| новые:', fresh);
  }
  process.exit(0);
}

const roots = expandRoots();
expandGlossary(roots);
expandSubstitutionMaps();

// ===== 4. Палео-глоссарий: слова-формы Танаха — добить словарь до TARGET слов =====
const TARGET = 8500;

function expandGlossaryForms() {
  const target = DATA + '/paleo-glossary/roots.json';
  const all = readJson(target);
  const gloss = all.filter(e => e.source !== 'tanakh'); // формы пересобираем заново
  const bareOf = h => String(h || '').replace(/[^\u05d0-\u05ea]/g, '');
  const glossHave = new Set(gloss.map(g => bareOf(g.hebrew)));
  const rootsJson = readJson(DATA + '/roots/roots.json');
  const rootMap = new Map();
  for (const r of rootsJson) {
    const key = stripNiqqud(r.root);
    if (key && !rootMap.has(key)) rootMap.set(key, { meaning: r.meaning, translit: String(r.translit || '').toLowerCase() });
  }

  const freq = new Map();
  const files = fs.readdirSync(DATA + '/scripture').filter(f => f.endsWith('.json'));
  const QUM = ['11qt', '1qs', '1qphab', 'samaritan_paleo'];
  const PRE = ['וב', 'ול', 'וה', 'ומ', 'כש', 'מה', 'שה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש', 'ה'];
  const SUF = ['ים', 'ות', 'הם', 'הן', 'כם', 'כן', 'תם', 'תן', 'נו', 'תי',
    'ה', 'ם', 'ך', 'ן', 'ף', 'ץ', 'ת', 'י', 'ו', 'א', 'ע', 'ח'];

  // Корень формы: сама форма, без суффикса, без префикса или без обоих.
  function derivRoot(form) {
    if (rootMap.has(form)) return form;
    for (const s of SUF) {
      if (form.length > s.length && form.endsWith(s) && rootMap.has(form.slice(0, -s.length))) return form.slice(0, -s.length);
    }
    for (const p of PRE) {
      if (form.length > p.length && form.startsWith(p) && rootMap.has(form.slice(p.length))) return form.slice(p.length);
    }
    for (const p of PRE) {
      if (form.length <= p.length || !form.startsWith(p)) continue;
      for (const s of SUF) {
        if (form.length > p.length + s.length && form.endsWith(s) && rootMap.has(form.slice(p.length, -s.length))) {
          return form.slice(p.length, -s.length);
        }
      }
    }
    return '';
  }

  let baseTerms = 0;
  {
    const dicts = readJson(DATA + '/dictionaries.json');
    for (const k of Object.keys(dicts)) baseTerms += (dicts[k].terms || []).length;
  }
  const need = Math.max(0, TARGET - (rootsJson.length + gloss.length + baseTerms));
  console.log('Цель ' + TARGET + ': корни ' + rootsJson.length + ' + карточки ' + gloss.length +
    ' + подмены ' + baseTerms + ' → нужно слово-форм: ' + need);

  for (const f of files) {
    if (QUM.some(q => f.startsWith(q))) continue;
    const d = JSON.parse(fs.readFileSync(DATA + '/scripture/' + f, 'utf8'));
    if (!Array.isArray(d)) continue;
    for (const v of d) {
      for (const w of String(v.hebrew || '').split(/\s+/)) {
        const bare = w.replace(/[^\u05d0-\u05ea]/g, '');
        if (!bare) continue;
        freq.set(bare, (freq.get(bare) || 0) + 1);
      }
    }
  }

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'));
  const added = [];
  for (const [form, count] of sorted) {
    if (added.length >= need) break;
    if (glossHave.has(form)) continue;
    const glyphs = Array.from(form).map(c => LETTER_PALEO[c]);
    if (glyphs.some(g => !g)) continue; // защита от не-буквенных символов
    const root = derivRoot(form);
    const meta = root ? rootMap.get(root) : null;
    const entry = {
      paleo: glyphs.join('·'),
      hebrew: form,
      translit: Array.from(form).map(c => LETTER_TRANSLIT[c] || '').join(''),
      function: meta ? cleanGloss(meta.meaning) + ' (по корню ' + root + ')' : '(словоформа; корень не в базе)',
      root: root,
      source: 'tanakh',
      count: count
    };
    if (meta) entry.rootTranslit = meta.translit;
    added.push(entry);
    glossHave.add(form);
  }
  console.log('4. Слово-формы ТаНаха: +' + added.length + ' (глоссарий: ' + gloss.length + ' → ' + (gloss.length + added.length) + ')');
  if (!DRY && (added.length || all.length !== gloss.length)) writeJson(target, gloss.concat(added));
  return added.length;
}

console.log('');
expandGlossaryForms();

const finalRoots = readJson(DATA + '/roots/roots.json');
const finalGloss = readJson(DATA + '/paleo-glossary/roots.json');
const finalDicts = readJson(DATA + '/dictionaries.json');
let terms = 0;
for (const k of Object.keys(finalDicts)) terms += (finalDicts[k].terms || []).length;
console.log('');
console.log('ИТОГО: корни', finalRoots.length, '| глоссарий', finalGloss.length, '| термины подмен', terms,
  '=>', finalRoots.length + finalGloss.length + terms);

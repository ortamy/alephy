// Scripture payload adapters: Samaritan {meta,verses} and paleo-only witnesses.
(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ScriptureAdapters = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
  'use strict';

  var MAX_VERSE_LETTERS = 400;
  var MAX_WORD_LETTERS = 48;
  var STATUS_OK = { draft: true, review: true, verified: true };

  function paleoApi(injected) {
    if (injected) return injected;
    if (typeof require === 'function') {
      try { return require('./paleo-letters.js'); } catch (error) {}
    }
    return (typeof window !== 'undefined' && window.PaleoLetters) || null;
  }

  function isPaleoChar(ch) {
    var cp = ch.codePointAt(0);
    return cp >= 0x10900 && cp <= 0x1091F;
  }

  function letterCount(text) {
    return Array.from(String(text || '')).length;
  }

  function sanitizePaleoToken(token, PALEO) {
    return Array.from(String(token || '')).map(function(ch) {
      if (isPaleoChar(ch)) return ch;
      if (/\s/.test(ch)) return ' ';
      var base = typeof ch.normalize === 'function' ? ch.normalize('NFKC') : ch;
      var mapped = PALEO && PALEO.toPaleo ? PALEO.toPaleo(base) : base;
      return Array.from(String(mapped || '')).filter(isPaleoChar).join('');
    }).join('').replace(/\s+/g, ' ').trim();
  }

  function statusFrom(raw) {
    var value = String(raw || '').toLowerCase();
    if (STATUS_OK[value]) return value;
    if (/провер/.test(String(raw || ''))) return 'review';
    return 'draft';
  }

  function wordObjects(tokens, PALEO) {
    return tokens.filter(Boolean).map(function(paleo) {
      return {
        hebrew: PALEO && PALEO.toHebrew ? PALEO.toHebrew(paleo) : '',
        paleo: paleo,
        translit: '',
        literal: ''
      };
    });
  }

  function tokensFromVerse(raw, PALEO) {
    var listed = Array.isArray(raw.words) ? raw.words : [];
    var stringTokens = listed.map(function(item) {
      if (item && typeof item === 'object') return String(item.paleo || '');
      return String(item || '');
    }).map(function(token) {
      return sanitizePaleoToken(token, PALEO);
    }).filter(Boolean);

    var usable = stringTokens.filter(function(token) {
      return letterCount(token) <= MAX_WORD_LETTERS;
    });
    if (usable.length && usable.length === stringTokens.length) return usable;

    var paleoField = sanitizePaleoToken(raw.paleo || '', PALEO);
    if (paleoField && letterCount(paleoField) <= MAX_VERSE_LETTERS) {
      var spaced = paleoField.split(/\s+/).filter(Boolean);
      if (spaced.length > 1) return spaced;
      if (usable.length) return usable;
      if (spaced.length) return spaced;
    }
    if (usable.length) return usable;

    if (raw.hebrew && PALEO && PALEO.toPaleo && PALEO.normalizeHebrew) {
      return String(raw.hebrew).trim().split(/\s+/).filter(Boolean).map(function(word) {
        return sanitizePaleoToken(PALEO.toPaleo(PALEO.normalizeHebrew(word)), PALEO);
      }).filter(Boolean);
    }

    if (stringTokens.length) {
      return [Array.from(stringTokens.join('')).slice(0, MAX_VERSE_LETTERS).join('')];
    }
    if (paleoField) return [Array.from(paleoField).slice(0, MAX_VERSE_LETTERS).join('')];
    return [];
  }

  function looksCanonical(verse) {
    return !!(verse && verse.hebrew && verse.paleo && Array.isArray(verse.words) && verse.words.length &&
      verse.words.every(function(word) { return word && word.hebrew && word.paleo; }) &&
      verse.paleo_translation && STATUS_OK[verse.paleo_translation_status]);
  }

  function adaptVerse(raw, index, PALEO) {
    var source = raw || {};
    var tokens = tokensFromVerse(source, PALEO);
    var words = Array.isArray(source.words) && source.words[0] && typeof source.words[0] === 'object' && source.words[0].hebrew && source.words[0].paleo
      ? source.words
      : wordObjects(tokens, PALEO);
    var paleo = tokens.join(' ');
    var hebrew = words.map(function(word) { return word.hebrew; }).join(' ');
    var truncated = letterCount(String(source.paleo || '')) > MAX_VERSE_LETTERS;
    return {
      chapter: Number(source.chapter) || 1,
      verse: Number(source.verse) || (index + 1),
      paleo: paleo,
      hebrew: hebrew,
      translit: source.translit || '',
      literal: source.literal || '',
      words: words,
      source_book: source.source_book || source.book || '',
      paleo_translation: source.paleo_translation || (truncated
        ? 'Черновая палео-сборка; словесные границы источника требуют проверки.'
        : 'Черновая палео-сборка свидетельского слоя.'),
      paleo_translation_status: statusFrom(source.paleo_translation_status || source.status),
      paleo_translation_note: source.paleo_translation_note || source.status || ''
    };
  }

  function normalizeScripturePayload(data, injectedPaleo) {
    var PALEO = paleoApi(injectedPaleo);
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.verses) ? data.verses : []);
    if (!list.length) return [];
    if (list.every(looksCanonical)) return list;
    return list.map(function(item, index) {
      return adaptVerse(item, index, PALEO);
    }).filter(function(verse) {
      return verse.hebrew && verse.paleo && verse.words.length;
    });
  }

  return {
    normalizeScripturePayload: normalizeScripturePayload,
    adaptVerse: adaptVerse,
    sanitizePaleoToken: sanitizePaleoToken
  };
}));

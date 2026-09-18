/**
 * section-renderer.js — единая визуальная сборка статей библиотеки.
 * Нормализует старые blocks heading/body в sections id/title/content.
 */
const SectionRenderer = (function() {
  'use strict';

  function padChapter(index) {
    return String(index + 1).padStart(2, '0');
  }

  function escapeHtml(value) {
    var node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  function wrapPaleo(html) {
    return String(html || '').replace(/>([^<]*)</g, function(full, text) {
      return '>' + text.replace(/[\u{10900}-\u{1091F}]+/gu, '<span class="paleo-glyph">$&</span>') + '<';
    });
  }

  function wrapTranslit(html) {
    return String(html || '').replace(/\(([^<>()\n]{1,48})\)/g, '<span class="essence-translit">($1)</span>');
  }

  function renderEssence(value) {
    return wrapTranslit(renderMarkdown(value));
  }

  function renderMarkdown(value) {
    if (Array.isArray(value)) {
      return '<ul>' + value.map(function(item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
    }
    if (value == null || value === '') return '';
    var text = String(value);
    var html = (typeof marked !== 'undefined' && marked.parse) ? marked.parse(text) : '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
    var safe = (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) ? DOMPurify.sanitize(html) : escapeHtml(text).replace(/\n/g, '<br>');
    return wrapPaleo(safe);
  }

  // В контексте ТаНаХа разделяем квадратный текст, транслитерацию и перевод.
  // Строка «Контекст: …» выходит из цитаты отдельной контекст-строкой под ней.
  function contextSpan(text) {
    return text ? '<span class="inner-form-context">' + text + '</span>' : '';
  }

  function renderTanakh(value) {
    var html = renderMarkdown(value);
    html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, function(_, inner) {
      var clean = inner.replace(/<\/p>\s*<p>/gi, '<br>').replace(/<\/?p>/gi, '');
      // Строки внутри цитаты разделены и <br>, и обычным переносом (ленивое
      // продолжение абзаца в blockquote не даёт <br>) — учитываем оба случая.
      var lines = clean.split(/(?:<br\s*\/?>|\n)\s*/i).filter(function(line) { return line.trim(); });
      var context = '';
      lines = lines.filter(function(line) {
        var match = line.match(/^\s*(?:<strong>)?\s*Контекст:?\s*(?:<\/strong>)?\s*([\s\S]*)$/i);
        if (!match) return true;
        context = match[1].trim();
        return false;
      });
      if (lines.length < 2) {
        return '<blockquote class="tanakh-quote inner-form-quote">' + (lines[0] || '') + '</blockquote>' + contextSpan(context);
      }
      var seenHebrew = false;
      var nonHebrewLines = 0;
      var rendered = lines.map(function(line) {
        var isHebrew = /[\u0590-\u05ff]/.test(line);
        var className = isHebrew ? 'tanakh-quote-line tanakh-hebrew-line' : 'tanakh-quote-line';
        var divider = false;
        if (isHebrew) seenHebrew = true;
        else if (seenHebrew) {
          nonHebrewLines += 1;
          divider = nonHebrewLines === 1;
          className += ' tanakh-translation-line';
        }
        return { html: '<span class="' + className + '">' + line + '</span>', divider: divider };
      });
      return '<blockquote class="tanakh-quote inner-form-quote">' + rendered.map(function(line) {
        return (line.divider ? '<span class="tanakh-quote-divider" aria-hidden="true"></span>' : '') + line.html;
      }).join('') + '</blockquote>' + contextSpan(context);
    });
    // Fallback: в части записей контекст идёт отдельным абзацем после цитаты.
    return html.replace(/<\/blockquote>\s*<p>\s*(?:<strong>)?\s*Контекст:?\s*(?:<\/strong>)?\s*([\s\S]*?)<\/p>/gi, function(_, context) {
      return '</blockquote>' + contextSpan(context.trim());
    });
  }

  // Строки «связь — пояснение» → внутренние карточки (форма 1).
  function renderTypology(value) {
    var items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    var cards = items.map(function(item) {
      var line = String(item || '').replace(/^\s*[-*+]\s+/, '').trim();
      if (!line || /^---+$/.test(line)) return '';
      var parts = line.split(/\s+—\s+/);
      var name = parts.shift().trim();
      var description = parts.join(' — ').trim() || 'Связь в образной цепочке';
      return '<article class="typology-link-card inner-form-card" role="listitem">' +
        '<div class="typology-link-copy"><strong class="typology-link-name">' + escapeHtml(name) + '</strong>' +
        '<span class="typology-link-description">' + escapeHtml(description) + '</span></div>' +
      '</article>';
    }).filter(Boolean);
    return '<div class="typology-links-gallery" role="list">' + cards.join('') + '</div>';
  }

  function splitPatchParts(content) {
    var plain = content.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
    var parts = plain.split(/\s+—\s+|\s*:\s+/);
    var title = parts.shift().trim() || 'Фрагмент';
    var detail = parts.join(' — ').trim() || plain;
    return { title: title, detail: detail };
  }

  // Списки в главах практики/сводки — ряды с волосяными разделителями (форма 3).
  function renderPatchCards(items) {
    var cards = items.map(function(item) {
      var content = String(item || '').replace(/^\s*(?:[-*+]\s+|•\s*)/, '').trim();
      if (!content) return '';
      var parts = splitPatchParts(content);
      return '<article class="section-patch-card" role="listitem">' +
        '<div class="section-patch-copy"><strong class="section-patch-title">' + escapeHtml(parts.title) + '</strong>' +
        '<span class="section-patch-detail">' + escapeHtml(parts.detail) + '</span></div>' +
      '</article>';
    }).filter(Boolean);
    return '<div class="section-patches-gallery inner-form-rows" role="list">' + cards.join('') + '</div>';
  }

  function renderPatchList(value) {
    if (Array.isArray(value)) return renderPatchCards(value);
    var lines = String(value || '').split(/\r?\n/);
    var output = [];
    var list = [];
    function flushList() {
      if (!list.length) return;
      output.push(renderPatchCards(list));
      list = [];
    }
    lines.forEach(function(line) {
      if (/^\s*(?:[-*+]\s+|•\s*)/.test(line)) {
        list.push(line);
      } else {
        flushList();
        if (line.trim()) output.push(renderMarkdown(line));
      }
    });
    flushList();
    return output.join('');
  }

  // Цитаты — карточка с волосяной рамкой: цитата (форма 2) + разбор.
  function renderOriginalCards(cards) {
    if (!Array.isArray(cards)) return renderMarkdown(cards);
    return '<div class="original-subcards" role="list">' + cards.map(function(card) {
      return '<article class="original-subcard inner-form-card" role="listitem">' +
        '<h3 class="original-subcard-title">' + escapeHtml(card.title || 'Цитата') + '</h3>' +
        '<blockquote class="original-subcard-quote inner-form-quote">' + renderMarkdown(card.quote || '') + '</blockquote>' +
        '<div class="original-subcard-analysis"><span class="inner-form-context">Разбор</span>' + renderMarkdown(card.analysis || '') + '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  // Сравнение собираем в две подписанные колонки, чтобы цвет не был единственным маркером.
  function renderComparison(comparison) {
    if (!comparison) return '';
    var left = comparison.left || {};
    var right = comparison.right || {};
    var rows = Array.isArray(comparison.rows) ? comparison.rows : [];
    return '<div class="comparison-grid" role="table" aria-label="Сравнение">' +
      '<div class="comparison-header" role="row">' +
        '<div class="comparison-column comparison-column-left" role="columnheader">' + escapeHtml(left.title || 'Левая сторона') + '</div>' +
        '<div class="comparison-column comparison-column-right" role="columnheader">' + escapeHtml(right.title || 'Правая сторона') + '</div>' +
      '</div>' +
      '<div class="comparison-rows">' + rows.map(function(row) {
        return '<div class="comparison-row" role="row">' +
          '<div class="comparison-cell comparison-cell-left" role="cell">' + escapeHtml(row.left || '') + '</div>' +
          '<div class="comparison-cell comparison-cell-right" role="cell">' + escapeHtml(row.right || '') + '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function cleanTitle(value) {
    var title = String(value || 'Раздел').replace(/^!\[icon\]\([^)]*\)\s*/i, '').trim();
    return title || 'Раздел';
  }

  // Сокращает заголовок секции до 1–2 слов по правилам проекта.
  // Используется и для карточек внутри статьи, и для оглавления (TOC).
  function shortenTitle(value) {
    var title = cleanTitle(value);
    var upper = title.toUpperCase();
    var exact = {
      'СУТЬ': 'Суть',
      'ВВЕДЕНИЕ': 'Введение',
      'КОНТЕКСТ ТАНАХА': 'Контекст Танаха',
      'СВЯЗЬ С МАШИАХОМ': 'Связь с Машиахом',
      'ИСКАЖЕНИЯ': 'Искажения',
      'РАЗОБЛАЧЕНИЕ': 'Разоблачение',
      'ПРАКТИКА': 'Практика',
      'СВОДКА': 'Сводка',
      'ТИПОЛОГИЧЕСКИЕ СВЯЗИ': 'Типологии',
      'ОРИГИНАЛ': 'Оригинал',
      'СДВИГ': 'Сдвиг',
      'СВИДЕТЕЛЬСТВА': 'Свидетельства',
      'РЕКОНСТРУКЦИЯ': 'Реконструкция',
      'ОГОВОРКИ': 'Оговорки',
      'ЦЕПОЧКА ПЕРЕДАЧИ': 'Цепочка передачи',
      'ЭТИМОЛОГИЯ': 'Этимология'
    };
    if (exact[upper]) return exact[upper];
    if (/^ЧАСТЬ\s+\d+\s*:/.test(upper)) {
      var after = title.replace(/^Часть\s+\d+\s*:\s*/i, '').trim();
      var firstWord = after.split(/\s+/).filter(function(w) { return w && !/^[—–-]$/.test(w); })[0];
      if (firstWord) return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
      return 'Раздел';
    }
    if (/^КОНТЕКСТ/.test(upper)) return 'Контекст';
    if (/^СВЯЗАННЫЕ/.test(upper)) return 'Связанные';
    var words = title.split(/\s+/).filter(function(w) { return w && !/^[—–-]$/.test(w); });
    if (!words.length) return 'Раздел';
    if (words.length <= 2) {
      return words.map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(' ');
    }
    return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  }

  function idForTitle(value) {
    var title = cleanTitle(value).toLowerCase();
    var known = [
      { id: 'essence', words: ['суть', 'тезис'] },
      { id: 'etymology', words: ['этимология', 'оригинал', 'корень'] },
      { id: 'tanakh', words: ['танах', 'контекст', 'свидетельства'] },
      { id: 'exposure', words: ['искажения', 'разоблачение', 'сдвиг'] },
      { id: 'practice', words: ['практика', 'применение'] },
      { id: 'summary', words: ['сводка', 'вывод', 'реконструкция'] },
      { id: 'typology', words: ['типологические связи'] },
      { id: 'related', words: ['связанные файлы', 'связанные материалы'] },
      { id: 'transmission', words: ['цепочка передачи'] },
      { id: 'caveats', words: ['оговорки'] }
    ];
    for (var i = 0; i < known.length; i += 1) {
      if (known[i].words.some(function(word) { return title.indexOf(word) !== -1; })) return known[i].id;
    }
    return title.replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'section';
  }

  function normalizeSection(section) {
    var title = cleanTitle(section && (section.title || section.heading));
    return {
      id: (section && section.id) || idForTitle(title),
      title: title,
      tocTitle: section && section.tocTitle ? String(section.tocTitle) : '',
      content: section && section.content !== undefined ? section.content : (section && section.body) || '',
      layout: section && section.layout ? String(section.layout) : '',
      cards: section && Array.isArray(section.cards) ? section.cards : null,
      comparison: section && section.comparison ? section.comparison : null
    };
  }

  function normalizeArticle(article) {
    article = article || {};
    var source = article.sections;
    if (Array.isArray(source)) {
      var usedArrayIds = {};
      return source.filter(function(section) {
        return !isHiddenSection(section);
      }).map(function(section) {
        var normalized = normalizeSection(section);
        normalized.id = uniqueId(normalized.id, usedArrayIds);
        return normalized;
      });
    }

    source = source || {};
    var sections = [];
    var usedIds = {};
    function uniqueId(id, registry) {
      var base = id || 'section';
      var unique = base;
      var suffix = 2;
      var used = registry || usedIds;
      while (used[unique]) {
        unique = base + '-' + suffix;
        suffix += 1;
      }
      used[unique] = true;
      return unique;
    }
    function add(title, content) {
      if (content == null || content === '' || (Array.isArray(content) && !content.length)) return;
      var section = normalizeSection({ title: title, content: content });
      section.id = uniqueId(section.id);
      sections.push(section);
    }

    if (source.original) {
      var original = source.original;
      var originalLines = [];
      if (original.hebrew) originalLines.push(original.hebrew);
      if (original.translit) originalLines.push(original.translit);
      if (original.root) originalLines.push('Корень: ' + original.root);
      if (Array.isArray(original.paleo) && original.paleo.length) originalLines.push(original.paleo.join(' '));
      add('Этимология', originalLines);
    }
    add('Сдвиг', source.shift);
    if (Array.isArray(source.transmissionChain) && source.transmissionChain.length) {
      add('Цепочка передачи', source.transmissionChain.map(function(step) {
        return [step.layer, step.word, step.meaning].filter(Boolean).join(' — ');
      }));
    }
    (source.content || []).filter(function(section) {
      return !isHiddenSection(section);
    }).forEach(function(section) {
      var normalized = normalizeSection(section);
      normalized.id = uniqueId(normalized.id);
      sections.push(normalized);
    });
    if (Array.isArray(source.evidence) && source.evidence.length) {
      add('Свидетельства', source.evidence.map(function(item) {
        return [item.type, item.ref, item.hebrew, item.note].filter(Boolean).join(' — ');
      }));
    }
    add('Реконструкция', source.reconstruction);
    if (Array.isArray(source.caveats) && source.caveats.length) {
      add('Оговорки', source.caveats.map(function(item) { return [item.kind, item.text].filter(Boolean).join(' — '); }));
    }
    return sections;
  }

  function isHiddenSection(section) {
    var title = String(section && (section.title || section.heading) || '').replace(/^!\[icon\]\([^)]*\)\s*/i, '').trim().toLowerCase();
    var id = String(section && section.id || '').toLowerCase();
    return id === 'related' || id === 'связанные-файлы' || title === 'связанные файлы' || title === 'связанные материалы';
  }

  var RULES = {
    essence: { className: 'essence-card', render: renderEssence },
    etymology: { className: 'etymology-card', render: renderPatchList },
    tanakh: { className: 'tanakh-card', render: renderTanakh },
    exposure: { className: 'exposure-section-card', render: renderPatchList },
    distortions: { className: 'exposure-section-card', render: renderPatchList },
    practice: { className: 'practice-card', render: renderPatchList },
    summary: { className: 'summary-card', render: renderPatchList },
    typology: { className: 'typology-card', render: renderTypology },
    related: { className: 'related-card', render: renderMarkdown },
    transmission: { className: 'transmission-card', render: renderMarkdown },
    caveats: { className: 'caveats-card', render: renderMarkdown }
  };

  function ruleFor(section) {
    var baseId = String(section.id || '').replace(/-\d+$/, '');
    var content = section && section.content;
    var hasListMarkers = Array.isArray(content) || /(?:^|\n)\s*(?:[-*+]\s+|•\s*)/.test(String(content || ''));
    var knownRule = RULES[baseId];
    if (knownRule && (baseId === 'tanakh' || baseId === 'typology')) return knownRule;
    if (hasListMarkers) {
      return {
        className: (knownRule && knownRule.className) || 'generic-card list-card',
        render: renderPatchList
      };
    }
    if (knownRule) return knownRule;
    return { className: 'generic-card', render: renderMarkdown };
  }

  function isDistortionSection(section) {
    var id = String(section && section.id || '').replace(/-\d+$/, '');
    var title = String(section && section.title || '').toLowerCase();
    return id === 'exposure' || id === 'distortions' || title.indexOf('искажен') !== -1 || title.indexOf('разоблач') !== -1;
  }

  function renderSection(section, index) {
    var rule = ruleFor(section);
    var body = section.layout === 'original-cards'
      ? renderOriginalCards(section.cards)
      : (section.layout === 'comparison' ? renderComparison(section.comparison) : rule.render(section.content));
    var chip = isDistortionSection(section)
      ? '<span class="research-section-chip research-section-chip--swap">подмена</span>'
      : '';
    return '<article class="exposure-section research-section-card ' + rule.className + '" id="exposure-section-' + index + '" data-section-index="' + index + '" data-section-id="' + escapeHtml(section.id) + '">' +
      '<header class="research-section-card-head">' +
        '<span class="research-section-index" aria-hidden="true">' + padChapter(index) + '</span>' +
        '<h2 class="exposure-section-heading-text">' + escapeHtml(shortenTitle(section.title)) + '</h2>' +
        chip +
      '</header>' +
      '<div class="exposure-section-body">' + body + '</div>' +
    '</article>';
  }

  function renderArticle(article) {
    return normalizeArticle(article).map(renderSection).join('');
  }

  window.SectionRenderer = {
    rules: RULES,
    normalizeArticle: normalizeArticle,
    renderSection: renderSection,
    renderArticle: renderArticle,
    shortenTitle: shortenTitle
  };
  return window.SectionRenderer;
})();
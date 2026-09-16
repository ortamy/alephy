/**
 * exposure-case.js — единый рендерер «дела» разоблачения.
 * renderCard/renderCase/renderPreview работают на одной схеме (data/exposures/index.json)
 * и используются и в каталоге (#researches), и в детальном просмотре, и в форме создания.
 */
const ExposureCase = (function() {
  'use strict';

  var CONFIDENCE_META = {
    verified: { label: 'Проверено', className: 'exposure-badge-verified' },
    'needs-review': { label: 'Требует проверки', className: 'exposure-badge-review' },
    hypothesis: { label: 'Гипотеза', className: 'exposure-badge-hypothesis' },
    disputed: { label: 'Спорно', className: 'exposure-badge-disputed' }
  };

  var CLAIM_META = {
    verified: { label: 'факт', className: 'claim-badge claim-badge--fact' },
    'needs-review': { label: 'интерпретация', className: 'claim-badge claim-badge--interpretation' },
    hypothesis: { label: 'гипотеза', className: 'claim-badge claim-badge--hypothesis' },
    disputed: { label: 'гипотеза', className: 'claim-badge claim-badge--hypothesis' }
  };

  var STATUS_LABELS = {
    draft: 'Черновик',
    review: 'На проверке',
    published: 'Опубликовано'
  };

  // Разрешённые пути: старые записи хранят только имя файла иконки.
  var ICON_PATHS = {
    scroll: 'scribe/scroll.png',
    scrolls: 'scribe/scrolls.png',
    book: 'ui/book.png',
    hourglass: 'ui/hourglass.png',
    sword: 'weapons/sword.png',
    anchor: 'ui/anchor.png',
    lamp: 'archaeology/lamp.png',
    scales: 'ui/scales.png',
    question: 'ui/question.png'
  };
  var ICON_BASE = 'assets/icons/32/';

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function renderMd(text) {
    if (!text) return '';
    var raw = (typeof marked !== 'undefined' && marked.parse) ? marked.parse(String(text)) : esc(String(text));
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) return DOMPurify.sanitize(raw);
    return esc(String(text));
  }

  function renderBlocks(block) {
    if (typeof BlockRenderer !== 'undefined' && BlockRenderer.renderSection) {
      return BlockRenderer.renderSection(block);
    }
    return renderMd(block && block.body);
  }

  function confidenceMeta(value) {
    return CONFIDENCE_META[value] || CONFIDENCE_META['needs-review'];
  }

  function claimMeta(value) {
    return CLAIM_META[value] || CLAIM_META['needs-review'];
  }

  function claimBadge(value) {
    var meta = claimMeta(value);
    return '<span class="' + meta.className + '">' + esc(meta.label) + '</span>';
  }

  function confidenceBadge(value) {
    var meta = confidenceMeta(value);
    return '<span class="exposure-badge ' + meta.className + '">' + esc(meta.label) + '</span>';
  }

  function lucideBtn(action, icon, label, extraAttrs) {
    return '<button type="button" class="exposure-icon-btn" data-' + action + (extraAttrs || '') +
      ' aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      '<i data-lucide="' + icon + '" aria-hidden="true"></i></button>';
  }

  function iconKey(value) {
    var match = String(value || '').match(/([^/\\]+?)(?:\.png|\.svg)?$/i);
    return match ? match[1].toLowerCase() : '';
  }

  function iconPath(value) {
    var key = iconKey(value);
    return ICON_BASE + (ICON_PATHS[key] || ICON_PATHS.question);
  }

  function renderIcon(value, alt, className) {
    var label = alt || 'Иконка раздела';
    return '<img class="' + (className || 'exposure-section-icon') + '" src="' + esc(iconPath(value)) + '" alt="' + esc(label) + '" width="24" height="24" loading="lazy">';
  }

  function headingMeta(heading, explicitIcon) {
    var text = String(heading || 'Раздел');
    var match = text.match(/^!\[icon\]\(([^)]+)\)\s*(.*)$/i);
    var icon = explicitIcon || (match && match[1]);
    if (match) text = match[2] || 'Раздел';
    return { text: text, icon: icon };
  }

  function renderHeading(heading, explicitIcon, tagName) {
    var meta = headingMeta(heading, explicitIcon);
    return '<' + (tagName || 'h2') + ' class="exposure-section-heading">' +
      (meta.icon ? renderIcon(meta.icon, meta.text) : '') +
      '<span>' + esc(meta.text) + '</span></' + (tagName || 'h2') + '>';
  }

  function getTerms(item) {
    var values = [];
    ['keyTerms', 'terms', 'tags', 'roots'].forEach(function(key) {
      var value = item && item[key];
      if (Array.isArray(value)) values = values.concat(value);
      else if (value) values.push(value);
    });
    if (item && item.hebrewKeyword) values.push(item.hebrewKeyword);
    return values.map(function(value) {
      return typeof value === 'object' ? (value.term || value.root || value.name || '') : String(value);
    }).filter(Boolean).filter(function(value, index, list) { return list.indexOf(value) === index; }).slice(0, 6);
  }

  function getBodyPreview(item) {
    var sections = item && item.sections || {};
    var content = Array.isArray(sections.content) ? sections.content : [];
    var source = sections.thesis || (content[0] && content[0].body) || sections.shift || '';
    return String(source).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getSummary(item) {
    return (item && item.summary) || getBodyPreview(item) || 'Материалы дела находятся в архиве разоблачений.';
  }

  // ===== КАРТОЧКА (каталог) =====
  function renderCard(item) {
    var terms = getTerms(item);
    var termTags = terms.map(function(tag) {
      return '<span class="exposure-card-tag">' + esc(tag) + '</span>';
    }).join('');
    var firstContent = item.sections && item.sections.content && item.sections.content[0];
    var cardIcon = item.icon || (firstContent && headingMeta(firstContent.heading).icon) || 'scroll';
    var summary = getSummary(item);
    var related = (item.related || []).slice(0, 3).map(function(id) {
      return '<span class="exposure-card-related-item">' + esc(id) + '</span>';
    }).join('');
    var sourcesCount = (item.sources || []).length;
    var archiveTag = (item.status === 'archive' || String(item.category || '').toLowerCase() === 'архив' || String(item.updatedAt || '').indexOf('archive') !== -1)
      ? 'Архив'
      : (item.category || '');
    var statusTag = archiveTag
      ? '<span class="exposure-card-status-tag' + (archiveTag === 'Архив' ? ' exposure-card-status-tag--archive' : '') + '">' + esc(archiveTag) + '</span>'
      : '';
    return '<a class="exposure-card" href="#researches/case/' + encodeURIComponent(item.slug) + '" data-slug="' + esc(item.slug) + '">' +
      '<div class="exposure-card-top">' +
        '<span class="exposure-card-icon-wrap">' + renderIcon(cardIcon, item.title, 'exposure-card-icon') + '</span>' +
        '<span class="exposure-card-status">' + confidenceBadge(item.confidence) + '</span>' +
      '</div>' +
      '<div class="exposure-card-body">' +
        '<div class="exposure-card-title">' + esc(item.title || '') + '</div>' +
        '<div class="exposure-card-summary">' + esc(summary) + '</div>' +
        '<div class="exposure-card-terms"><span class="exposure-card-label">Ключевые термины</span>' + termTags + '</div>' +
        (related ? '<div class="exposure-card-related"><span class="exposure-card-label">Связано</span>' + related + '</div>' : '') +
      '</div>' +
      '<div class="exposure-card-foot">' +
        statusTag +
        '<span class="exposure-card-foot-date">' + esc(item.updatedAt || '') + '</span>' +
      '</div>' +
    '</a>';
  }

  // ===== ДОСЬЕ: вспомогательные блоки =====
  function sectionId(idx) { return 'exposure-section-' + idx; }

  function buildSections(item) {
    var s = item.sections || {};
    var blocks = [];
    if (s.thesis) blocks.push({ heading: 'Тезис', body: s.thesis });
    if (s.original) {
      var o = s.original;
      var originalHtml = '<div class="exposure-original">' +
        (o.hebrew ? '<div class="exposure-original-hebrew" dir="rtl" lang="he">' + esc(o.hebrew) + '</div>' : '') +
        (o.translit ? '<div class="exposure-original-translit">' + esc(o.translit) + '</div>' : '') +
        (o.root ? '<div class="exposure-original-root">Корень: ' + esc(o.root) + '</div>' : '') +
        (o.paleo && o.paleo.length ? '<div class="exposure-original-paleo" dir="rtl">' + esc(o.paleo.join(' ')) + '</div>' : '') +
      '</div>';
      blocks.push({ heading: 'Оригинал', bodyHtml: originalHtml });
    }
    if (s.shift) blocks.push({ heading: 'Сдвиг', body: s.shift });
    if (s.transmissionChain && s.transmissionChain.length) {
      var chainHtml = '<div class="substitution-chain exposure-timeline" role="list">' + s.transmissionChain.map(function(step, i) {
        return '<div class="substitution-step exposure-timeline-step" role="listitem"><span class="substitution-step-number" aria-hidden="true">' + (i + 1) + '</span>' +
          '<strong>' + esc(step.layer || '') + '</strong>' +
          '<span class="substitution-word">' + esc(step.word || '') + '</span>' +
          (step.meaning ? '<span class="substitution-meaning">' + esc(step.meaning) + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
      blocks.push({ heading: 'Цепочка передачи', bodyHtml: chainHtml });
    }
    (s.content || []).forEach(function(c) {
      blocks.push({ heading: c.heading || '', icon: c.icon, body: c.body || '' });
    });
    if (s.evidence && s.evidence.length) {
      var evHtml = '<div class="exposure-evidence-table exposure-card-grid" role="list">' + s.evidence.map(function(e) {
        return '<article class="exposure-evidence-row exposure-info-card" role="listitem"><span class="exposure-evidence-type">' + esc(e.type || '') + '</span>' +
          '<span class="exposure-evidence-ref">' + esc(e.ref || '') + '</span>' +
          (e.hebrew ? '<span class="exposure-evidence-hebrew" dir="rtl" lang="he">' + esc(e.hebrew) + '</span>' : '') +
          (e.note ? '<span class="exposure-evidence-note">' + esc(e.note) + '</span>' : '') +
        '</article>';
      }).join('') + '</div>';
      blocks.push({ heading: 'Свидетельства', bodyHtml: evHtml });
    }
    if (s.reconstruction) blocks.push({ heading: 'Реконструкция', body: s.reconstruction });
    if (s.caveats && s.caveats.length) {
      var cavHtml = '<div class="exposure-caveats exposure-callout-grid" role="list">' + s.caveats.map(function(c) {
        return '<div class="exposure-caveat-card" role="listitem"><span class="exposure-caveat-kind">' + esc(c.kind || '') + '</span><span>' + esc(c.text || '') + '</span></div>';
      }).join('') + '</div>';
      blocks.push({ heading: 'Оговорки', bodyHtml: cavHtml });
    }
    return blocks;
  }

  // Сокращает заголовок раздела до 1–2 слов для содержания (TOC).
  // Использует общий словарь сокращений из SectionRenderer.
  function shortenTocTitle(value) {
    if (typeof SectionRenderer !== 'undefined' && SectionRenderer.shortenTitle) {
      return SectionRenderer.shortenTitle(value);
    }
    return String(value || 'Раздел');
  }

  // ===== ДОСЬЕ (полный детальный просмотр) =====
  function renderCase(item, opts) {
    opts = opts || {};
    var normalizedSections = (typeof SectionRenderer !== 'undefined') ? SectionRenderer.normalizeArticle(item) : [];
    var blocks = normalizedSections.length ? normalizedSections : buildSections(item);
    var toc = blocks.map(function(b, i) {
      var title = b.tocTitle || b.title || headingMeta(b.heading, b.icon).text;
      return '<a href="#' + sectionId(i) + '" data-section-link data-index="' + i + '">' + esc(shortenTocTitle(title)) + '</a>';
    }).join('');
    var chapterCount = blocks.length;
    var tags = getTerms(item).map(function(t) { return '<span class="exposure-card-tag">' + esc(t) + '</span>'; }).join('');
    var relatedItems = opts.relatedItems || {};
    var related = (item.related || []).map(function(id) {
      var relatedItem = relatedItems[id];
      var label = relatedItem ? relatedItem.title : id;
      return '<a href="#researches/case/' + encodeURIComponent(id) + '">' + esc(label) + '</a>';
    }).join('');
    var sources = (item.sources || []).map(function(s) {
      return '<li>' + (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.type || s.ref || 'источник') + '</a>' : esc(s.type || '') + ' ' + esc(s.ref || '')) + '</li>';
    }).join('');
    var sectionsHtml = (typeof SectionRenderer !== 'undefined')
      ? SectionRenderer.renderArticle(item)
      : blocks.map(function(b, i) {
          var body = renderBlocks(b);
          return '<article class="exposure-section" id="' + sectionId(i) + '" data-section-index="' + i + '">' +
            renderHeading(b.heading, b.icon) +
            '<div class="exposure-section-body">' + body + '</div>' +
          '</article>';
        }).join('');
    var headerTags = tags
      ? '<header class="research-detail-header"><div class="research-detail-tags">' + tags + '</div></header>'
      : '';

    return '<div class="exposure-case-page">' +
      '<div class="exposure-case-container">' +
        headerTags +
        '<div class="research-detail-layout exposure-case-layout">' +
          '<main class="research-detail-content">' +
            '<nav class="research-toc exposure-case-toc" data-exposure-toc aria-label="Содержание разоблачения">' +
            toc +
            '<span class="exposure-progress-label" data-exposure-progress-label>чтение 1/' + chapterCount + '</span>' +
            '</nav>' +
            sectionsHtml +
          '</main>' +
          '<aside class="research-infobox exposure-case-infobox">' +
            '<dl>' +
              '<dt>Статус</dt><dd>' + esc(STATUS_LABELS[item.status] || item.status || '') + '</dd>' +
              '<dt>Обновлено</dt><dd>' + esc(item.updatedAt || '') + '</dd>' +
              (item.author ? '<dt>Автор</dt><dd>' + esc(item.author) + '</dd>' : '') +
            '</dl>' +
            (sources ? '<h3>Источники</h3><ul class="exposure-sources-list">' + sources + '</ul>' : '') +
            (related ? '<h3>Связанные дела</h3><div class="research-related">' + related + '</div>' : '') +
            '<div class="exposure-case-actions">' +
              lucideBtn('exposure-copy-link', 'link', 'Скопировать ссылку') +
              lucideBtn('exposure-download-md', 'download', 'Скачать Markdown') +
              (opts.showAskAi === false ? '' : '<button type="button" class="exposure-icon-btn exposure-ask-ai-btn" data-exposure-ask-ai data-slug="' + esc(item.slug) + '" aria-label="AI-дополнение (гипотеза)" title="AI-дополнение (гипотеза)"><i data-lucide="sparkles" aria-hidden="true"></i><span>AI-дополнение (гипотеза)</span></button>') +
            '</div>' +
          '</aside>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ===== ЭКСПОРТ =====
  function toMarkdown(item) {
    var blocks = buildSections(item);
    var lines = ['# ' + (item.title || ''), '', item.summary || '', ''];
    blocks.forEach(function(b) {
      lines.push('## ' + b.heading, '', (b.body || (b.bodyHtml ? '(структурированный блок)' : '')), '');
    });
    return lines.join('\n');
  }

  // ===== БИНДИНГ (используется в детальном просмотре) =====
  function bindCase(container, item) {
    if (typeof BlockRenderer !== 'undefined' && BlockRenderer.bind) BlockRenderer.bind(container);
    var toc = container.querySelector('[data-exposure-toc]');
    var progressLabel = container.querySelector('[data-exposure-progress-label]');
    var sections = container.querySelectorAll('.exposure-section');
    var total = sections.length;

    function setActive(idx) {
      if (toc) toc.querySelectorAll('a').forEach(function(a, i) {
        a.classList.toggle('active', i === idx);
      });
      if (progressLabel) progressLabel.textContent = 'чтение ' + (idx + 1) + '/' + total;
    }

    if (total && typeof IntersectionObserver !== 'undefined') {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var idx = parseInt(entry.target.getAttribute('data-section-index'), 10);
            if (!isNaN(idx)) setActive(idx);
          }
        });
      }, { rootMargin: '-92px 0px -70% 0px' });
      sections.forEach(function(s) { observer.observe(s); });
      setActive(0);
    }

    var copyBtn = container.querySelector('[data-exposure-copy-link]');
    if (copyBtn) copyBtn.addEventListener('click', function() {
      var url = window.location.origin + window.location.pathname + '#researches/case/' + encodeURIComponent(item.slug);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() { if (window.LabToast) LabToast.show('Ссылка скопирована'); });
      }
    });

    var downloadBtn = container.querySelector('[data-exposure-download-md]');
    if (downloadBtn) downloadBtn.addEventListener('click', function() {
      var blob = new Blob([toMarkdown(item)], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = item.slug + '.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    var askAiBtn = container.querySelector('[data-exposure-ask-ai]');
    if (askAiBtn) askAiBtn.addEventListener('click', function() {
      var main = container.querySelector('.research-detail-content');
      if (!main) return;
      item.changelog = item.changelog || [];
      item.changelog.push({ date: new Date().toISOString().slice(0, 10), note: 'Запрошено дополнение от AI-агента (Exposer)' });
      var existing = main.querySelector('[data-exposure-ai-result]');
      if (existing) existing.remove();
      var note = (item.summary || item.title || 'Дополнение по делу') + ' Требует сверки с корнем, палео-механикой и контекстом ТаНаХа.';
      var aside = document.createElement('aside');
      aside.className = 'exposure-ai-hypothesis';
      aside.setAttribute('data-exposure-ai-result', '');
      aside.innerHTML = claimBadge('hypothesis') +
        '<div class="exposure-ai-hypothesis-body">' + esc(note) + '</div>';
      main.appendChild(aside);
      if (window.LabToast) LabToast.show('Гипотеза вставлена. Реальный вызов агента ещё не подключён.');
    });

    if (toc) toc.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        var target = document.getElementById(this.getAttribute('href').slice(1));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ===== ЖИВОЕ ПРЕВЬЮ (в форме создания) =====
  function renderPreview(item) {
    if (!item.title && !item.summary) {
      return '<div class="exposure-preview-empty">Заполните форму — здесь появится страница дела в точности как её увидит читатель</div>';
    }
    return '<div class="exposure-preview-frame">' + renderCase(item, { showAskAi: false }) + '</div>';
  }

  return {
    esc: esc,
    renderMd: renderMd,
    renderBlocks: renderBlocks,
    confidenceMeta: confidenceMeta,
    claimMeta: claimMeta,
    claimBadge: claimBadge,
    confidenceBadge: confidenceBadge,
    renderCard: renderCard,
    renderCase: renderCase,
    renderPreview: renderPreview,
    bindCase: bindCase,
    toMarkdown: toMarkdown,
    buildSections: buildSections,
    sectionId: sectionId,
    CONFIDENCE_META: CONFIDENCE_META,
    STATUS_LABELS: STATUS_LABELS
  };
})();

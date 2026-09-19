/**
 * checkers-comparator.js — Компаратор переводов (#translation-comparator).
 * Канон: панель ввода → секции слоёв (иврит / древние / современные) →
 * аналитика расхождений (hairline-строки + три тонких бара статистики).
 * Маркер расхождения — красное подчёркивание слова с тултипом типа (§6).
 */

const TransComp = (function() {
  'use strict';

  var PAGE_PATH = 'pages/translation-comparator.html';
  var STATE_PATH = 'data/witnesses.json';

  // Демонстрационный корпус стиха (слои ТМ / древние / современные).
  const DATA = {
    'Берешит 1:1': {
      tm: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ',
      lxx: 'Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν καὶ τὴν γῆν',
      synodal: 'В начале сотворил Бог небо и землю.',
      sourceWitness: {
        qumran: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ',
        samaritan: 'בְּרֵאשִׁית בָּרָא אֱלֹהִם אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ'
      }
    },
    'Берешит 1:2': {
      tm: 'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל־פְּנֵי הַמָּיִם',
      lxx: 'ἡ δὲ γῆ ἦν ἀόρατος καὶ ἀκατασκεύαστος, καὶ σκότος ἐπάνω τῆς ἀβύσσου, καὶ πνεῦμα θεοῦ ἐπεφέρετο ἐπάνω τοῦ ὕδατος',
      synodal: 'Земля же была безвидна и пуста, и тьма над бездною, и Дух Божий носился над водою.'
    },
    'Берешит 1:3': {
      tm: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר',
      lxx: 'καὶ εἶπεν ὁ θεός· γενηθήτω φῶς. καὶ ἐγένετο φῶς',
      synodal: 'И сказал Бог: да будет свет. И стал свет.'
    },
    'Теилим 23:1': {
      tm: 'מִזְמוֹר לְדָוִד יְהוָה רֹעִי לֹא אֶחְסָר',
      lxx: 'Ψαλμὸς τῷ Δαυίδ. Κύριος ποιμαίνει με, καὶ οὐδέν με ὑστερήσει',
      synodal: 'Псалом Давида. Господь — Пастырь мой; я ни в чем не буду нуждаться.'
    },
    'Теилим 23:2': {
      tm: 'בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי עַל מֵי מְנֻחוֹת יְנַהֲלֵנִי',
      lxx: 'εἰς τόπον χλόης, ἐκεῖ με κατεσκήνωσεν, ἐπὶ ὕδατος ἀναπαύσεως ἐξέθρεψέν με',
      synodal: 'Он покоит меня на злачных пажитях и водит меня к водам тихим.'
    },
    'Исайя 53:5': {
      tm: 'וְהוּא מְחֹלָל מִפְּשָׁעֵינוּ מְדֻכָּא מֵעֲוֹנֹתֵינוּ מוּסַר שְׁלוֹמֵנוּ עָלָיו וּבַחֲבֻרָתוֹ נִרְפָּא לָנוּ',
      lxx: 'αὐτὸς δὲ ἐτραυματίσθη διὰ τὰς ἀνομίας ἡμῶν καὶ μεμαλάκισται διὰ τὰς ἁμαρτίας ἡμῶν· παιδεία εἰρήνης ἡμῶν ἐπʼ αὐτόν· τῷ μώλωπι αὐτοῦ ἡμεῖς ἰάθημεν',
      synodal: 'Он изъязвлен был за грехи наши и мучим за беззакония наши; наказание мира нашего было на Нем, и ранами Его мы исцелились.'
    },
    'Шмот 20:2': {
      tm: 'אָנֹכִי יְהוָה אֱלֹהֶיךָ אֲשֶׁר הוֹצֵאתִיךָ מֵאֶרֶץ מִצְרַיִם מִבֵּית עֲבָדִים',
      lxx: 'ἐγώ εἰμι κύριος ὁ θεός σου, ὅστις ἐξήγαγόν σε ἐκ γῆς Αἰγύπτου, ἐξ οἴκου δουλείας',
      synodal: 'Я Господь, Бог твой, который вывел тебя из земли Египетской, из дома рабства.'
    },
    'Шмот 20:3': {
      tm: 'לֹא יִהְיֶה לְךָ אֱלֹהִים אֲחֵרִים עַל פָּנָי',
      lxx: 'οὐκ ἔσονταί σοι θεοὶ ἕτεροι πλὴν ἐμοῦ',
      synodal: 'Да не будет у тебя других богов пред лицем Моим.'
    },
    'Дварим 6:4': {
      tm: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד',
      lxx: 'Ἄκουε, Ἰσραήλ· κύριος ὁ θεὸς ἡμῶν κύριος εἷς ἐστιν',
      synodal: 'Слушай, Израиль: Господь, Бог наш, Господь един есть.'
    }
  };

  /* Реестр слоёв: секция → карточки. comparable — слой сравнивается с ТМ пословно. */
  var SECTIONS = [
    { key: 'hebrew', layers: [
      { key: 'tm', value: 'tm', name: 'Масоретский текст', code: 'TM', note: 'квадратное письмо, огласовки', hebrew: true, comparable: true },
      { key: 'qumran', value: 'qumran', name: 'Кумранский свиток', code: 'TM', note: 'кумранское чтение, без огласовок', hebrew: true, comparable: true, witness: true },
      { key: 'samaritan', value: 'samaritan', name: 'Самаритянское Пятикнижие', code: 'hbo', note: 'палео-письмо', paleo: true, comparable: true, witness: true }
    ] },
    { key: 'ancient', layers: [
      { key: 'lxx', value: 'lxx', name: 'Септуагинта (LXX)', code: 'grc', note: 'греческий слой' },
      { key: 'peshitta', value: 'peshitta', name: 'Пешитта', code: 'syr', note: 'сирийский слой', rtl: true, witness: true },
      { key: 'vulgate', value: 'vulgate', name: 'Вульгата', code: 'lat', note: 'латинский слой' }
    ] },
    { key: 'modern', layers: [
      { key: 'synodal', value: 'synodal', name: 'Синодальный перевод', code: 'рус', note: 'славянский слой' },
      { key: 'modern', value: 'modern', name: 'Современный русский', code: 'рус', note: 'современный слой' }
    ] }
  ];

  var DIVERGENCE_LABEL = { critical: 'Расходится', partial: 'Частично', minor: 'Совпадает' };
  var DIVERGENCE_TONE = { critical: 'is-critical', partial: 'is-partial', minor: '' };

  var state = { verse: null, entry: null, witness: null };
  var witnesses = null;
  var loadPromise = null;
  var scopeRef = null;

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function escHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function dataPath(name) {
    return new URL('data/' + name, document.baseURI).href;
  }

  function setStatus(scope, message, stateName) {
    var status = scope.querySelector('#tc-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'lab-status' + (stateName ? ' is-' + stateName : '');
  }

  function layerValue(layer, entry) {
    if (!entry) return '';
    if (layer.witness) return (entry.sourceWitness && entry.sourceWitness[layer.value]) || '';
    return entry[layer.value] || '';
  }

  function loadWitnesses() {
    if (witnesses) return Promise.resolve(witnesses);
    if (loadPromise) return loadPromise;
    loadPromise = fetch(dataPath('witnesses.json'))
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        witnesses = Array.isArray(data) ? data : [];
        return witnesses;
      })
      .catch(function(error) {
        loadPromise = null;
        witnesses = [];
        throw error;
      });
    return loadPromise;
  }

  function witnessFor(verse) {
    if (!witnesses) return null;
    var needle = String(verse || '').toLowerCase();
    for (var i = 0; i < witnesses.length; i++) {
      if (String(witnesses[i].ref || '').toLowerCase() === needle) return witnesses[i];
    }
    return null;
  }

  // ===== СЛОВА И МАРКЕРЫ РАСХОЖДЕНИЙ =====
  function words(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean);
  }

  function normalizeWord(word) {
    return String(word || '')
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/[.,;:!?()\[\]{}"'׳״־—-]/g, '');
  }

  var WORD_TONE = {
    diff: { key: 'lab.comparator.typeDiverge', label: 'Расхождение', className: 'tc-word tc-word-diverge' },
    minor: { key: 'lab.comparator.typeMinorWord', label: 'Частичное совпадение', className: 'tc-word tc-word-minor' },
    missing: { key: 'lab.comparator.typeMissingWord', label: 'Отсутствует', className: 'tc-word tc-word-missing' },
    match: { key: 'lab.comparator.typeMatchWord', label: 'Совпадает', className: 'tc-word' }
  };

  /* Пословное сравнение слоя с ТМ: тултип слова несёт тип расхождения. */
  function markedTextHtml(value, reference, fallback) {
    var list = words(value);
    if (!list.length) {
      return '<span class="tc-word tc-word-missing">' + escHtml(fallback) + '</span>';
    }
    var refWords = words(reference);
    var counts = { match: 0, diff: 0, minor: 0, missing: 0 };
    var html = list.map(function(word, index) {
      var tone = 'match';
      if (index >= refWords.length) tone = 'missing';
      else if (normalizeWord(word) !== normalizeWord(refWords[index])) {
        tone = normalizeWord(word).length === normalizeWord(refWords[index]).length ? 'minor' : 'diff';
      }
      counts[tone] += 1;
      var meta = WORD_TONE[tone];
      return '<span class="' + meta.className + '" title="' + escHtml(t(meta.key, meta.label)) + '">' +
        escHtml(word) + '</span>';
    }).join(' ');

    if (refWords.length > list.length) counts.missing += refWords.length - list.length;
    return html;
  }

  function plainTextHtml(value, fallback) {
    var list = words(value);
    if (!list.length) {
      return '<span class="tc-word tc-word-missing">' + escHtml(fallback) + '</span>';
    }
    return escHtml(String(value).trim());
  }

  function emptyLayerHtml() {
    return '<div class="lab-empty lab-empty--inline">' +
      '<span class="lab-empty-glyph" aria-hidden="true">𐤀</span>' +
      '<p class="lab-empty-hint">' +
      escHtml(t('lab.comparator.layerEmpty', 'Слой не загружен: добавьте данные в corpus')) +
      '</p></div>';
  }


  // ===== КАРТОЧКИ И СЕКЦИИ =====
  function cardHtml(layer, entry) {
    var value = layerValue(layer, entry);
    var hasValue = words(value).length > 0;
    var fallback = t('lab.comparator.layerEmpty', 'Слой не загружен: добавьте данные в corpus');
    var textClass = 'tc-text' + (layer.hebrew ? ' tc-hebrew' : '') + (layer.paleo ? ' tc-paleo' : '');
    var dirAttr = layer.hebrew || layer.paleo || layer.rtl ? ' dir="rtl"' : '';
    var body;

    if (!hasValue) {
      body = emptyLayerHtml();
    } else if (layer.comparable && layer.key !== 'tm') {
      body = '<div class="' + textClass + '"' + dirAttr + '>' + markedTextHtml(value, entry.tm, fallback) + '</div>';
    } else {
      body = '<div class="' + textClass + '"' + dirAttr + '>' + plainTextHtml(value, fallback) + '</div>';
    }

    return '<article class="tc-source-card" data-layer="' + escHtml(layer.key) + '">' +
      '<header class="tc-source-head">' +
      '<h3 class="tc-source-name">' + escHtml(layer.name) + '</h3>' +
      '<span class="tc-lang-chip">' + escHtml(layer.code) + '</span>' +
      '</header>' +
      '<p class="tc-source-note">' + escHtml(layer.note) + '</p>' +
      body +
      '</article>';
  }

  /* Есть ли в слое хоть одно отклонение от эталона (для легенды и статистики). */
  function hasMarkers(value, reference) {
    var list = words(value);
    var refWords = words(reference);
    for (var i = 0; i < list.length; i++) {
      if (i >= refWords.length) return true;
      if (normalizeWord(list[i]) !== normalizeWord(refWords[i])) return true;
    }
    return refWords.length > list.length;
  }

  function renderSections(scope, entry) {
    var stats = { match: 0, diverge: 0, missing: 0 };

    SECTIONS.forEach(function(section) {
      var grid = scope.querySelector('[data-tc-grid="' + section.key + '"]');
      var counter = scope.querySelector('[data-tc-count="' + section.key + '"]');
      if (counter) counter.textContent = String(section.layers.length);
      if (!grid) return;

      grid.innerHTML = section.layers.map(function(layer) { return cardHtml(layer, entry); }).join('');

      var markers = false;
      section.layers.forEach(function(layer) {
        if (!layer.comparable) return;
        var value = layerValue(layer, entry);
        if (!words(value).length) {
          if (section.key === 'hebrew') stats.missing += 1;
          return;
        }
        if (layer.key === 'tm') {
          if (section.key === 'hebrew') stats.match += 1;
          return;
        }
        var diverges = hasMarkers(value, entry.tm);
        if (diverges) markers = true;
        if (section.key === 'hebrew') {
          if (diverges) stats.diverge += 1;
          else stats.match += 1;
        }
      });

      // Легенда маркера — одной строкой, только если в секции есть расхождения.
      var legend = scope.querySelector('[data-tc-legend="' + section.key + '"]');
      if (legend) legend.hidden = !markers;
    });

    return stats;
  }


  // ===== АНАЛИТИКА: СТРОКИ И БАРЫ =====
  function typeLabel(key) {
    if (key === 'critical') return t('lab.comparator.typeCritical', 'Расходится');
    if (key === 'partial') return t('lab.comparator.typePartial', 'Частично');
    return t('lab.comparator.typeMinor', 'Совпадает');
  }

  function divergenceRows(witness) {
    if (!witness) return [];
    var status = witness.divergence || 'minor';
    var rows = [
      { chip: 'LXX', text: witness.lxx_note || witness.lxx || '', type: status },
      { chip: 'QUMRAN', text: witness.qumran_note || witness.qumran || '', type: status },
      { chip: 'PESHITTA', text: witness.peshitta_note || witness.peshitta || '', type: status === 'minor' ? 'minor' : 'partial' }
    ];
    if (witness.paleo_analysis) {
      rows.push({ chip: t('lab.comparator.paleoLayer', 'палео'), text: witness.paleo_analysis, type: 'partial', confidence: true });
    }
    return rows;
  }

  function renderAnalytics(scope, witness, stats) {
    var note = scope.querySelector('#tc-analysis-note');
    var badge = scope.querySelector('#tc-analysis-badge');
    var list = scope.querySelector('#tc-divergence-rows');
    var bars = scope.querySelector('#tc-bars');

    if (note) {
      note.textContent = witness
        ? (witness.topic ? witness.topic + ' — ' : '') + (witness.note || '')
        : t('lab.comparator.noWitness', 'Записей о текстуальных расхождениях для этого стиха нет.');
    }

    if (badge) {
      var badgeMeta = witness
        ? { className: 'wb-badge ' + (witness.divergence === 'critical' ? 'is-error' : 'is-running'), label: typeLabel(witness.divergence) }
        : { className: 'wb-badge is-done', label: typeLabel('minor') };
      badge.className = badgeMeta.className;
      badge.textContent = badgeMeta.label;
    }

    if (list) {
      var rows = divergenceRows(witness);
      if (!rows.length) {
        rows = [{ chip: 'TM', text: t('lab.comparator.noWitness', 'Записей о текстуальных расхождениях для этого стиха нет.'), type: 'minor' }];
      }
      list.innerHTML = rows.map(function(row) {
        var tone = DIVERGENCE_TONE[row.type] || '';
        var conf = row.confidence
          ? '<span class="tc-lang-chip">' + escHtml(t('lab.comparator.confidence', 'интерпретация')) + '</span> '
          : '';
        return '<li class="tc-row">' +
          '<span class="tc-layer-chip">' + escHtml(row.chip) + '</span>' +
          '<p class="tc-row-text">' + escHtml(row.text) + '</p>' +
          '<span class="tc-row-type ' + tone + '">' + conf + escHtml(typeLabel(row.type)) + '</span>' +
          '</li>';
      }).join('');
    }

    if (bars) {
      var total = stats.match + stats.diverge + stats.missing || 1;
      var definitions = [
        { key: 'match', label: t('lab.comparator.barMatch', 'Совпадения'), value: stats.match },
        { key: 'diverge', label: t('lab.comparator.barDiverge', 'Расхождения'), value: stats.diverge },
        { key: 'missing', label: t('lab.comparator.barMissing', 'Отсутствуют'), value: stats.missing }
      ];
      bars.innerHTML = definitions.map(function(bar) {
        var share = Math.round((bar.value / total) * 100);
        return '<div class="tc-bar-row">' +
          '<span class="tc-bar-label">' + escHtml(bar.label) + '</span>' +
          '<span class="tc-bar"><span class="tc-bar-fill is-' + bar.key + '" style="width:' + share + '%"></span></span>' +
          '<span class="tc-bar-value">' + share + '%</span>' +
          '</div>';
      }).join('');
    }
  }


  // ===== ПОИСК И СОСТОЯНИЯ =====
  function findVerse(query) {
    var exact = null;
    var partial = null;
    Object.keys(DATA).forEach(function(key) {
      var lower = key.toLowerCase();
      if (lower === query) exact = key;
      if (!partial && lower.indexOf(query) !== -1) partial = key;
    });
    return exact || partial;
  }

  function renderVerse(scope, verseKey) {
    var entry = DATA[verseKey];
    var results = scope.querySelector('#tc-results');
    var placeholder = scope.querySelector('#tc-placeholder');

    state.verse = verseKey;
    state.entry = entry;

    var stats = renderSections(scope, entry);
    renderAnalytics(scope, state.witness, stats);

    if (placeholder) placeholder.hidden = true;
    if (results) results.hidden = false;
  }

  function showEmpty(scope, hint) {
    var results = scope.querySelector('#tc-results');
    var placeholder = scope.querySelector('#tc-placeholder');
    if (results) results.hidden = true;
    if (placeholder) {
      placeholder.innerHTML = '<span class="lab-empty-glyph" aria-hidden="true">\uD800\uDF00</span>' +
        '<p class="lab-empty-hint">' + escHtml(hint) + '</p>';
      placeholder.hidden = false;
    }
  }

  function search(scope) {
    var input = scope.querySelector('#tc-search');
    if (!input) return;
    var raw = String(input.value || '').trim();
    var query = raw.toLowerCase();

    if (!query) {
      setStatus(scope, t('lab.comparator.errorEmpty', 'Введите ссылку на стих.'), 'error');
      showEmpty(scope, t('lab.comparator.emptyHint', 'Введите ссылку на стих и нажмите «Показать».'));
      return;
    }

    var verseKey = findVerse(query);
    if (!verseKey) {
      var notFound = t('lab.comparator.notFound', 'Данные для «{ref}» пока не загружены. Примеры: Берешит 1:1, Шмот 20:2, Дварим 6:4.')
        .replace('{ref}', raw);
      setStatus(scope, notFound, 'error');
      showEmpty(scope, notFound);
      return;
    }

    var run = function() {
      state.witness = witnessFor(verseKey);
      renderVerse(scope, verseKey);
      setStatus(scope, t('lab.comparator.found', 'Стих показан: ') + verseKey, 'success');
    };

    setStatus(scope, '', '');
    if (witnesses) {
      run();
      return;
    }
    loadWitnesses().then(run).catch(function() {
      state.witness = null;
      run();
    });
  }

  function clear(scope) {
    var input = scope.querySelector('#tc-search');
    if (input) input.value = '';
    state = { verse: null, entry: null, witness: null };
    setStatus(scope, '', '');
    showEmpty(scope, t('lab.comparator.emptyHint', 'Введите ссылку на стих и нажмите «Показать».'));
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function bind(scope) {
    var form = scope.querySelector('#tc-form');
    if (form) form.addEventListener('submit', function(event) {
      event.preventDefault();
      search(scope);
    });

    scope.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var chip = target.closest('.lab-example-chip');
      if (!chip) return;
      var input = scope.querySelector('#tc-search');
      if (input) {
        input.value = chip.getAttribute('data-tc-example') || chip.textContent.trim();
        input.focus();
      }
      setStatus(scope, '', '');
    });
  }

  function init(container) {
    var scope = container || document.getElementById('translation-comparator');
    if (!scope) return;
    scopeRef = scope;

    if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
      window.AlephyI18n.applyTranslations(scope);
    }

    // Повторный заход на маршрут не должен дублировать слушатели.
    if (scope.dataset && scope.dataset.tcInit === '1') return;
    if (scope.dataset) scope.dataset.tcInit = '1';

    bind(scope);
    showEmpty(scope, t('lab.comparator.emptyHint', 'Введите ссылку на стих и нажмите «Показать».'));
  }

  return {
    init: init,
    search: function() { search(scopeRef || document.getElementById('translation-comparator')); },
    clear: function() { clear(scopeRef || document.getElementById('translation-comparator')); }
  };
})();

window.TransComp = TransComp;

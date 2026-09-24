/* Interactive investigation dossier for Research Lab. */
const Investigation = (function() {
  'use strict';

  var state = {
    roots: [],
    dictionaries: {},
    ready: false,
    loading: null,
    current: null
  };

  var PALEO = {
    'א': ['𐤀', 'Алеф', 'бык / сила / начало'],
    'ב': ['𐤁', 'Бет', 'дом / вместилище'],
    'ג': ['𐤂', 'Гимель', 'движение / верблюд'],
    'ד': ['𐤃', 'Далет', 'дверь / вход'],
    'ה': ['𐤄', 'Хе', 'дыхание / откровение'],
    'ו': ['𐤅', 'Вав', 'крюк / связь'],
    'ז': ['𐤆', 'Заин', 'оружие / инструмент'],
    'ח': ['𐤇', 'Хет', 'ограда / отделение'],
    'ט': ['𐤈', 'Тет', 'змея / скрытое благо'],
    'י': ['𐤉', 'Йод', 'рука / действие'],
    'כ': ['𐤊', 'Каф', 'ладонь / удержание'],
    'ך': ['𐤊', 'Каф (софит)', 'ладонь / удержание'],
    'ל': ['𐤋', 'Ламед', 'посох / направление'],
    'מ': ['𐤌', 'Мем', 'вода / течение'],
    'ם': ['𐤌', 'Мем (софит)', 'вода / течение'],
    'נ': ['𐤍', 'Нун', 'рыба / жизнь'],
    'ן': ['𐤍', 'Нун (софит)', 'рыба / жизнь'],
    'ס': ['𐤎', 'Самех', 'опора / поддержка'],
    'ע': ['𐤏', 'Аин', 'глаз / видение'],
    'פ': ['𐤐', 'Пе', 'рот / речь'],
    'ף': ['𐤐', 'Пе (софит)', 'рот / речь'],
    'צ': ['𐤑', 'Цаде', 'крюк / праведность'],
    'ץ': ['𐤑', 'Цаде (софит)', 'крюк / праведность'],
    'ק': ['𐤒', 'Коф', 'игла / отделённость'],
    'ר': ['𐤓', 'Реш', 'голова / начало'],
    'ש': ['𐤔', 'Шин', 'зуб / разрушение'],
    'ת': ['𐤕', 'Тав', 'знак / печать']
  };

  /* The evidence table is deliberately small: it is a readable parallel witness,
     while the searched object and its provenance always come from the JSON data. */
  var EVIDENCE = [
    { ref: 'Берешит 1:1', note: 'Имя и действие в начале повествования.', tm: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים', lxx: 'Ἐν ἀρχῇ ἐποίησεν ὁ θεός', synodal: 'В начале сотворил Бог' },
    { ref: 'Берешит 1:3', note: 'Речь как действие, а не отвлечённая формула.', tm: 'וַיֹּאמֶר אֱלֹהִים יְהִי־אוֹר', lxx: 'καὶ εἶπεν ὁ θεός γενηθήτω φῶς', synodal: 'И сказал Бог: да будет свет' },
    { ref: 'Шмот 20:2', note: 'Имя и освобождение переданы разными слоями текста.', tm: 'אָנֹכִי יְהוָה אֱלֹהֶיךָ אֲשֶׁר הוֹצֵאתִיךָ', lxx: 'ἐγώ εἰμι κύριος ὁ θεός σου ὁ ἐξαγαγών σε', synodal: 'Я Господь, Бог твой, Который вывел тебя' },
    { ref: 'Теилим 23:1', note: 'Образ пастыря превращается в титульную формулу.', tm: 'יְהוָה רֹעִי לֹא אֶחְסָר', lxx: 'κύριος ποιμαίνει με καὶ οὐδέν με ὑστερήσει', synodal: 'Господь — Пастырь мой; я ни в чём не буду нуждаться' }
  ];

  function esc(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function clean(value) {
    return String(value || '').replace(/[\u0591-\u05C7]/g, '').replace(/[«»"'’.,:;!?()\[\]{}]/g, '').trim().toLowerCase();
  }

  function cleanHebrew(value) {
    return String(value || '').replace(/[\u0591-\u05C7]/g, '').replace(/\s/g, '');
  }

  function setStatus(text, type) {
    var status = document.getElementById('investigation-status');
    if (!status) return;
    var label = status.querySelector('span:last-child') || status;
    label.textContent = text;
    status.className = 'investigation-status' + (type ? ' is-' + type : '');
  }

  function setHero(dossier) {
    if (!dossier || !window.LabHero || !window.LabHero.setView) return;
    window.LabHero.setView('investigation', 'detail', {
      kicker: 'АЛЕФИ · РАССЛЕДОВАНИЕ · ' + dossier.query,
      title: 'Дело: ' + dossier.query,
      subtitle: 'Вывод: ' + (dossier.term && dossier.term.restored || dossier.root && dossier.root.meaning || 'связь восстановлена.'),
      titleTone: 'ink',
      meta: [
        { label: 'Источник: ' + (dossier.category || 'словарь'), className: 'lab-hero__chip--label' },
        { label: 'досье собрано', className: 'investigation-hero-ready', dot: true },
        { label: 'Уверенность: высокая', className: 'investigation-hero-confidence' }
      ]
    });
  }

  function init() {
    var form = document.getElementById('investigation-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    state.loading = Promise.all([
    fetch('data/roots/roots.json').then(function(response) {
      if (!response.ok) throw new Error('roots/roots.json: HTTP ' + response.status);
        return response.json();
      }),
      fetch('data/dictionaries.json').then(function(response) {
        if (!response.ok) throw new Error('dictionaries.json: HTTP ' + response.status);
        return response.json();
      })
    ]).then(function(data) {
      state.roots = Array.isArray(data[0]) ? data[0] : [];
      state.dictionaries = data[1] || {};
      state.ready = true;
      setStatus('Готово. Попробуйте «חסד», «милость», «HSD» или «Господь».', 'ready');
      return state;
    }).catch(function(error) {
      setStatus('Не удалось загрузить материалы досье: ' + error.message, 'error');
      throw error;
    });
  }

  function find(query) {
    var needle = clean(query);
    var hebrewNeedle = cleanHebrew(query);
    var root = null;
    var term = null;
    var category = '';
    var terms = [];

    state.roots.some(function(item) {
      var rootValue = clean(item.root);
      if (rootValue === hebrewNeedle || clean(item.translit) === needle || clean(item.meaning).indexOf(needle) !== -1) {
        root = item;
        return true;
      }
      return false;
    });

    Object.keys(state.dictionaries).some(function(key) {
      var dictionary = state.dictionaries[key] || {};
      (dictionary.terms || []).some(function(item) {
        var matches = clean(item.word) === needle || cleanHebrew(item.hebrew) === hebrewNeedle || clean(item.restored).indexOf(needle) !== -1;
        if (matches && !term) {
          term = item;
          category = dictionary.title || key;
        }
        if (matches) terms.push({ item: item, category: dictionary.title || key });
        return matches && !!term;
      });
      return !!term;
    });

    if (!root && term) {
      root = state.roots.find(function(item) {
        return cleanHebrew(item.root) === cleanHebrew(term.hebrew) || clean(item.translit) === clean(term.hebrew);
      }) || null;
    }
    if (!term && root) {
      term = { word: root.meaning.split(',')[0], hebrew: root.root, paleo: root.paleo, restored: root.meaning };
      category = 'Корневой словарь';
    }
    if (!root && !term) return null;

    return { root: root, term: term, category: category, related: terms.slice(0, 4), query: query };
  }

  function letterData(char, root, index) {
    var data = PALEO[char] || ['?', 'Неизвестная буква', 'значение не найдено'];
    var fromRoot = root && root.paleoMeanings && root.paleoMeanings[index];
    return { paleo: data[0], name: data[1], meaning: fromRoot || data[2] };
  }

  function renderOrigin(dossier) {
    var term = dossier.term;
    var root = dossier.root;
    var hebrew = cleanHebrew(term.hebrew || (root && root.root));
    var paleo = (term.paleo && term.paleo.length ? term.paleo : root && root.paleo) || [];
    var letters = hebrew.split('').map(function(char, index) {
      var data = letterData(char, root, index);
      return '<button class="investigation-letter" type="button" aria-label="' + esc(data.name + ': ' + data.meaning) + '">' +
        '<span class="investigation-letter-paleo">' + esc(paleo[index] || data.paleo) + '</span>' +
        '<span class="investigation-letter-hebrew hebrew">' + esc(char) + '</span>' +
        '<span class="investigation-letter-tooltip"><strong>' + esc(data.name) + '</strong><br>' + esc(data.meaning) + '</span>' +
      '</button>';
    }).join('');
    return '<section class="investigation-section dossier-origin" style="--section-delay:80ms">' +
      '<div class="investigation-section-head"><span class="investigation-index">01</span><div><h2>Происхождение</h2><p>Слово до перевода: буква как образ и действие.</p></div></div>' +
      '<div class="investigation-origin-grid"><div class="investigation-origin-word"><span class="investigation-label">Объект</span><strong>' + esc(term.word || dossier.query) + '</strong><span class="hebrew investigation-hebrew">' + esc(hebrew) + '</span><span class="investigation-translit">' + esc(root ? root.translit : '') + '</span></div>' +
      '<div class="investigation-paleo-row" dir="rtl">' + letters + '</div></div>' +
      '<div class="investigation-origin-note"><span class="investigation-label">Восстановленное значение</span>' + esc(term.restored || (root && root.meaning) || '—') + '</div>' +
    '</section>';
  }

  function renderTimeline(dossier) {
    var term = dossier.term;
    var root = dossier.root;
    var original = root ? root.meaning : (term.restored || 'конкретный образ');
    var current = term.word || dossier.query;
    var stages = [
      { title: 'Образ', tag: 'до', detail: 'Палео-образы фиксируют наблюдаемое действие: ' + original + '.' },
      { title: 'Корень', tag: 'слой 1', detail: root ? root.root + ' · ' + root.meaning : 'Словарная форма связывает образ с корнем.' },
      { title: 'Перевод', tag: 'слой 2', detail: 'Слово проходит через другой алфавит и другую систему категорий.' },
      { title: 'Титул', tag: 'слой 3', detail: 'В современном употреблении «' + current + '» может звучать уже как абстрактный термин.' }
    ];
    var points = stages.map(function(stage, index) {
      var active = index === 0 ? ' is-active' : '';
      return '<button class="investigation-timeline-point' + active + '" type="button" data-timeline-index="' + index + '" aria-expanded="' + (index === 0 ? 'true' : 'false') + '"><span class="investigation-timeline-dot"></span><span class="investigation-timeline-tag">' + esc(stage.tag) + '</span><strong>' + esc(stage.title) + '</strong></button>';
    }).join('');
    var details = stages.map(function(stage, index) {
      return '<div class="investigation-timeline-detail' + (index === 0 ? ' is-visible' : '') + '" data-timeline-detail="' + index + '" ' + (index ? 'hidden' : '') + '><span class="investigation-label">Этап ' + (index + 1) + '</span><p>' + esc(stage.detail) + '</p></div>';
    }).join('');
    return '<section class="investigation-section dossier-timeline" style="--section-delay:150ms">' +
      '<div class="investigation-section-head"><span class="investigation-index">02</span><div><h2>Цепочка подмен</h2><p>Нажмите на точку, чтобы раскрыть этап передачи смысла.</p></div></div>' +
      '<div class="investigation-timeline" role="tablist" aria-label="Этапы изменения смысла">' + points + '</div><div class="investigation-timeline-details">' + details + '</div>' +
    '</section>';
  }

  function renderCreators(dossier) {
    var related = dossier.related;
    var people = [
      { name: 'Носитель языка', role: 'исходный слой', icon: 'users', text: 'Сохраняет образ в живом слове и контексте.' },
      { name: 'Переводчик', role: 'переход между системами', icon: 'languages', text: 'Выбирает ближайший эквивалент и тем самым задаёт направление чтения.' },
      { name: 'Редактор традиции', role: 'закрепление формулы', icon: 'pen-line', text: 'Повторение в корпусе превращает выбор в привычную формулу.' }
    ];
    var cards = people.map(function(person, index) {
return '<button class="investigation-creator" type="button" data-creator-index="' + index + '" aria-expanded="false"><span class="investigation-portrait"><i data-lucide="' + esc(person.icon) + '" width="20" height="20" aria-hidden="true"></i></span><span><strong>' + esc(person.name) + '</strong><small>' + esc(person.role) + '</small></span><span class="investigation-creator-chevron" aria-hidden="true">+</span><span class="investigation-creator-detail">' + esc(person.text) + '</span></button>';
    }).join('');
    return '<section class="investigation-section dossier-creators" style="--section-delay:220ms">' +
      '<div class="investigation-section-head"><span class="investigation-index">03</span><div><h2>Кто создал</h2><p>Не один автор, а несколько слоёв, закрепивших новую форму.</p></div></div>' +
      '<div class="investigation-creators-grid">' + cards + '</div>' +
      (related.length ? '<div class="investigation-related"><span class="investigation-label">Связанные записи</span>' + related.map(function(item) { return '<span class="investigation-related-chip">' + esc(item.item.word) + ' · ' + esc(item.category) + '</span>'; }).join('') + '</div>' : '') +
    '</section>';
  }

  function renderLost(dossier) {
    var root = dossier.root;
    var term = dossier.term;
    var concrete = root ? root.image : (term.restored || 'образ действия');
    var abstracted = term.word || dossier.query;
    return '<section class="investigation-section dossier-lost" style="--section-delay:290ms">' +
      '<div class="investigation-section-head"><span class="investigation-index">04</span><div><h2>Что потеряно</h2><p>Сравнение предметного образа с отвлечённой формулой.</p></div></div>' +
      '<div class="investigation-loss-flow"><div class="investigation-loss-node is-concrete"><span class="investigation-label">Конкретное</span><strong>' + esc(concrete) + '</strong></div><div class="investigation-loss-arrow" aria-hidden="true"><span></span><b>→</b></div><div class="investigation-loss-node is-abstract"><span class="investigation-label">Абстрактное</span><strong>' + esc(abstracted) + '</strong></div></div>' +
      '<div class="investigation-examples"><div><span>образ</span><strong>' + esc(root && root.examples ? root.examples[0] : concrete) + '</strong></div><div><span>формула</span><strong>' + esc(term.restored || abstracted) + '</strong></div></div>' +
    '</section>';
  }

      '<div class="investigation-section-head"><span class="investigation-index">01</span><div><h2>Происхождение</h2><p>Слово до перевода: буква как образ и действие.</p></div><span class="investigation-head-line" aria-hidden="true"></span></div>' +
  function renderEvidence() {
    var rows = EVIDENCE.map(function(item, index) {
      return '<div class="investigation-evidence-row" data-evidence-index="' + index + '"><button type="button" class="investigation-evidence-trigger" aria-expanded="false"><span class="investigation-evidence-ref">' + esc(item.ref) + '</span><span class="investigation-evidence-note">' + esc(item.note) + '</span><span class="investigation-evidence-plus" aria-hidden="true" data-evidence-href="#scripture-reader/genesis/1"><i data-lucide="door-open"></i></span></button><div class="investigation-evidence-detail" hidden><div><span>ТМ</span><p class="hebrew" dir="rtl">' + esc(item.tm) + '</p></div><div><span>LXX</span><p>' + esc(item.lxx) + '</p></div><div><span>Синодальный</span><p>' + esc(item.synodal) + '</p></div></div></div>';
    }).join('');
    return '<section class="investigation-section dossier-evidence" style="--section-delay:360ms">' +
      '<div class="investigation-section-head"><span class="investigation-index">05</span><div><h2>Доказательства</h2><p>Раскройте стих, чтобы увидеть три параллельных слоя текста.</p></div></div>' +
      '<div class="investigation-evidence-table"><div class="investigation-evidence-heading"><span>Ссылка</span><span>Почему важно</span><span>Открыть</span></div>' + rows + '</div>' +
    '</section>';
  }

  function bindResult() {
    var result = document.getElementById('investigation-result');
    if (!result || result.dataset.bound) return;
    result.dataset.bound = '1';
    result.addEventListener('click', function(event) {
      var timelinePoint = event.target.closest('[data-timeline-index]');
      if (timelinePoint) {
        var index = timelinePoint.getAttribute('data-timeline-index');
        result.querySelectorAll('[data-timeline-index]').forEach(function(point) {
          var active = point === timelinePoint;
          point.classList.toggle('is-active', active);
          point.setAttribute('aria-expanded', active ? 'true' : 'false');
        });
        result.querySelectorAll('[data-timeline-detail]').forEach(function(detail) {
          var visible = detail.getAttribute('data-timeline-detail') === index;
          detail.hidden = !visible;
          detail.classList.toggle('is-visible', visible);
        });
        return;
      }
      var creator = event.target.closest('[data-creator-index]');
      if (creator) {
        var open = creator.getAttribute('aria-expanded') !== 'true';
        creator.setAttribute('aria-expanded', open ? 'true' : 'false');
        creator.classList.toggle('is-open', open);
        return;
      }
      var evidence = event.target.closest('.investigation-evidence-trigger');
      if (evidence) {
        var door = event.target.closest('[data-evidence-href]');
        if (door && window.LabRouter) { event.preventDefault(); LabRouter.navigate('scripture-reader', ['genesis', '1']); return; }
        var row = evidence.closest('.investigation-evidence-row');
        var detail = row.querySelector('.investigation-evidence-detail');
        var expanded = evidence.getAttribute('aria-expanded') !== 'true';
        evidence.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        detail.hidden = !expanded;
        row.classList.toggle('is-open', expanded);
      }
    });
  }

  function render(dossier) {
    var result = document.getElementById('investigation-result');
    if (!result) return;
    result.innerHTML = '<div class="investigation-case-meta"><span>ДОСЬЕ ' + esc(dossier.query) + '</span><span>' + esc(dossier.category) + '</span></div>' +
      renderOrigin(dossier) + renderTimeline(dossier) + renderCreators(dossier) + renderLost(dossier) + renderEvidence();
    result.classList.add('is-visible');
    bindResult();
  }

  function investigate() {
    var input = document.getElementById('investigation-input');
    var button = document.getElementById('investigation-submit');
    if (!input) return;
    var query = input.value.trim();
    if (!query) return;
    if (!state.ready) {
      setStatus('Дождитесь загрузки материалов досье.', 'busy');
      return;
    }
    var dossier = find(query);
    if (!dossier) {
      setStatus('Совпадение не найдено. Попробуйте корень, транслитерацию или термин из словаря.', 'error');
      var result = document.getElementById('investigation-result');
      if (result) result.innerHTML = '<div class="investigation-empty"><strong>Улика не обнаружена</strong><p>Например: חסד, HSD, милость, תורה или закон.</p></div>';
      return;
    }
    if (button) button.disabled = true;
    setStatus('Собираю досье из словарей…', 'busy');
    window.setTimeout(function() {
      state.current = dossier;
      render(dossier);
      setHero(dossier);
      setStatus('Досье собрано: найдено в ' + (dossier.category || 'источниках') + '.', 'ready');
      if (button) button.disabled = false;
    }, 180);
  }

  return { init: init, investigate: investigate };
})();

window.Investigation = Investigation;

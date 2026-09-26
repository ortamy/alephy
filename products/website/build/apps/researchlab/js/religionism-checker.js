/**
 * religionism-checker.js — Чекер религионимов v2
 * Bug #4 fix: экранирование спецсимволов в пользовательском тексте
 * + экспорт словаря для глобального поиска
 */

const RelChecker = (function() {
  'use strict';

  const DICT = [
    ['Господь', 'Яхве (יהוה)', 'Замена имени Яхве на титул «Господь»'],
    ['Господа', 'Яхве (יהוה)', 'Замена имени Яхве'],
    ['Господом', 'Яхве (יהוה)', 'Замена имени Яхве'],
    ['Господе', 'Яхве (יהוה)', 'Замена имени Яхве'],
    ['Бог', 'Элоhим (אלהים)', 'Замена «Элоhим» (судьи, властители) на «Бог»'],
    ['Бога', 'Элоhим (אלהים)', 'Замена «Элоhим»'],
    ['Богу', 'Элоhим (אלהים)', 'Замена «Элоhим»'],
    ['Богом', 'Элоhим (אלהים)', 'Замена «Элоhим»'],
    ['Боже', 'Элоhим (אלהים)', 'Замена «Элоhим»'],
    ['Всевышний', 'Эльон (עליון)', 'Замена «Эльон» (Вышний) на «Всевышний»'],
    ['Всевышнего', 'Эльон (עליון)', 'Замена «Эльон»'],
    ['Иисус', 'Яхшуа (יהושע)', 'Замена имени Яхшуа на греческую форму «Иисус»'],
    ['Иисуса', 'Яхшуа (יהושע)', 'Замена имени Яхшуа'],
    ['Иисусе', 'Яхшуа (יהושע)', 'Замена имени Яхшуа'],
    ['Христос', 'Машиах (משיח)', 'Замена «Машиах» (помазанник) на греч. «Христос»'],
    ['Христа', 'Машиах (משיח)', 'Замена «Машиах»'],
    ['Христу', 'Машиах (משיח)', 'Замена «Машиах»'],
    ['Христом', 'Машиах (משיח)', 'Замена «Машиах»'],
    ['Христе', 'Машиах (משיח)', 'Замена «Машиах»'],
    ['Спаситель', 'Мошиа (מושיע)', 'Замена «Мошиа» (избавитель) на «Спаситель»'],
    ['Спасителя', 'Мошиа (מושיע)', 'Замена «Мошиа»'],
    ['ангел', 'малах (מלאך)', 'Замена «малах» (вестник) на греч. «ангел»'],
    ['ангела', 'малах (מלאך)', 'Замена «малах»'],
    ['ангелов', 'малахим (מלאכים)', 'Замена «малахим»'],
    ['архангел', 'сар малах (שר מלאך)', 'Замена «сар малах» (князь вестников)'],
    ['апостол', 'шалиах (שליח)', 'Замена «шалиах» (посланник) на греч. «апостол»'],
    ['апостола', 'шалиах (שליח)', 'Замена «шалиах»'],
    ['евангелие', 'бесора (בשורה)', 'Замена «бесора» (благая весть) на греч. «евангелие»'],
    ['евангелия', 'бесора (בשורה)', 'Замена «бесора»'],
    ['церковь', 'каhаль (קהל)', 'Замена «каhаль» (собрание) на греч. «церковь»'],
    ['церкви', 'каhаль (קהל)', 'Замена «каhаль»'],
    ['церковью', 'каhаль (קהל)', 'Замена «каhаль»'],
    ['крещение', 'твила (טבילה)', 'Замена «твила» (погружение) на греч. «крещение»'],
    ['крещения', 'твила (טבילה)', 'Замена «твила»'],
    ['крестить', 'таваль (טבל)', 'Замена «таваль» (погружать)'],
    ['пророк', 'нави (נביא)', 'Замена «нави» (провозвестник) на греч. «пророк»'],
    ['пророка', 'нави (נביא)', 'Замена «нави»'],
    ['пророки', 'невиим (נביאים)', 'Замена «невиим»'],
    ['священник', 'коhен (כהן)', 'Замена «коhен» (стоящий перед) на «священник»'],
    ['священника', 'коhен (כהן)', 'Замена «коhен»'],
    ['первосвященник', 'коhен гадоль (כהן גדול)', 'Замена «коhен гадоль»'],
    ['закон', 'тора (תורה)', 'Замена «тора» (наставление) на «закон»'],
    ['закона', 'тора (תורה)', 'Замена «тора»'],
    ['покаяние', 'тшува (תשובה)', 'Замена «тшува» (возвращение) на «покаяние»'],
    ['покаяния', 'тшува (תשובה)', 'Замена «тшува»'],
    ['грех', 'хет (חטא)', 'Замена «хет» (промах, ошибка) на «грех»'],
    ['греха', 'хет (חטא)', 'Замена «хет»'],
    ['грехи', 'хатаим (חטאים)', 'Замена «хатаим»'],
    ['рай', 'ган эден (גן עדן)', 'Замена «ган эден» (сад наслаждения) на «рай»'],
    ['ад', 'шеол (שאול)', 'Замена «шеол» (преисподняя) на «ад»'],
    ['ада', 'шеол (שאול)', 'Замена «шеол»'],
    ['сатана', 'сатан (שטן)', 'Замена «сатан» (противник) на греч. «сатана»'],
    ['сатаны', 'сатан (שטן)', 'Замена «сатан»'],
    ['дьявол', 'сатан (שטן)', 'Замена «сатан» на греч. «дьявол»'],
    ['дьявола', 'сатан (שטן)', 'Замена «сатан»'],
    ['бес', 'шед (שד)', 'Замена «шед» (разрушитель) на греч. «бес»'],
    ['беса', 'шед (שד)', 'Замена «шед»'],
    ['демон', 'шед (שד)', 'Замена «шед» на греч. «демон»'],
    ['демона', 'шед (שד)', 'Замена «шед»'],
    ['искупление', 'капара (כפרה)', 'Замена «капара» (покрытие) на «искупление»'],
    ['искупления', 'капара (כפרה)', 'Замена «капара»'],
    ['жертва', 'корбан (קרבן)', 'Замена «корбан» (приближение) на «жертва»'],
    ['жертвы', 'корбан (קרבן)', 'Замена «корбан»'],
    ['алтарь', 'мизбеах (מזבח)', 'Замена «мизбеах» (место заклания) на «алтарь»'],
    ['алтаря', 'мизбеах (מזבח)', 'Замена «мизбеах»'],
    ['скиния', 'мишкан (משכן)', 'Замена «мишкан» (обиталище) на «скиния»'],
    ['скинии', 'мишкан (משכן)', 'Замена «мишкан»'],
    ['храм', 'бейт hамикдаш (בית המקדש)', 'Замена на «храм»'],
    ['храма', 'бейт hамикдаш (בית המקדש)', 'Замена на «храм»'],
    ['суббота', 'шаббат (שבת)', 'Замена «шаббат» (покой) на греч. «суббота»'],
    ['субботы', 'шаббат (שבת)', 'Замена «шаббат»'],
    ['Пасха', 'Песах (פסח)', 'Замена «Песах» (прохождение) на греч. «Пасха»'],
    ['Пасхи', 'Песах (פסח)', 'Замена «Песах»'],
    ['Пятидесятница', 'Шавуот (שבועות)', 'Замена «Шавуот» (недели) на греч. «Пятидесятница»'],
    ['благодать', 'хен (חן)', 'Замена «хен» (милость, красота) на «благодать»'],
    ['благодати', 'хен (חן)', 'Замена «хен»'],
    ['милость', 'хесед (חסד)', 'Замена «хесед» (верность, любовь) на «милость»'],
    ['милости', 'хесед (חסד)', 'Замена «хесед»'],
    ['вера', 'эмуна (אמונה)', 'Замена «эмуна» (верность, доверие) на «вера»'],
    ['веры', 'эмуна (אמונה)', 'Замена «эмуна»'],
    ['истина', 'эмет (אמת)', 'Замена «эмет» (истина, верность)'],
    ['истины', 'эмет (אמת)', 'Замена «эмет»'],
    ['слава', 'кавод (כבוד)', 'Замена «кавод» (вес, тяжесть) на «слава»'],
    ['славы', 'кавод (כבוד)', 'Замена «кавод»'],
    ['мир (покой)', 'шалом (שלום)', 'Замена «шалом» (целостность) на «мир»'],
    ['мира (покой)', 'шалом (שלום)', 'Замена «шалом»'],
    ['правда', 'цедек (צדק)', 'Замена «цедек» (праведность) на «правда»'],
    ['правды', 'цедек (צדק)', 'Замена «цедек»'],
    ['праведность', 'цедака (צדקה)', 'Замена «цедака» (справедливость)'],
    ['праведности', 'цедака (צדקה)', 'Замена «цедака»'],
    ['святой', 'кадош (קדוש)', 'Замена «кадош» (отделённый) на «святой»'],
    ['святого', 'кадош (קדוש)', 'Замена «кадош»'],
    ['святость', 'кдуша (קדושה)', 'Замена «кдуша» (отделённость)'],
    ['святости', 'кдуша (קדושה)', 'Замена «кдуша»'],
    ['завет', 'брит (ברית)', 'Замена «брит» (союз, очищение) на «завет»'],
    ['завета', 'брит (ברית)', 'Замена «брит»'],
    ['обетование', 'автаха (הבטחה)', 'Замена «автаха» (обещание)'],
    ['обетования', 'автаха (הבטחה)', 'Замена «автаха»'],
    ['заповедь', 'мицва (מצוה)', 'Замена «мицва» (повеление) на «заповедь»'],
    ['заповеди', 'мицва (מצוה)', 'Замена «мицва»'],
    ['воскресение', 'тхият hаметим (תחיית המתים)', 'Замена на «воскресение мёртвых»'],
    ['воскресения', 'тхият hаметим (תחיית המתים)', 'Замена'],
    ['спасение', 'йешуа (ישועה)', 'Замена «йешуа» (избавление) на «спасение»'],
    ['спасения', 'йешуа (ישועה)', 'Замена «йешуа»'],
    ['благословение', 'браха (ברכה)', 'Замена «браха» (благословение)'],
    ['благословения', 'браха (ברכה)', 'Замена «браха»'],
    ['проклятие', 'клала (קללה)', 'Замена «клала» (проклятие)'],
    ['проклятия', 'клала (קללה)', 'Замена «клала»'],
    ['испытание', 'нисайон (ניסיון)', 'Замена «нисайон» (испытание)'],
    ['испытания', 'нисайон (ניסיון)', 'Замена «нисайон»'],
    ['чудо', 'нес (נס)', 'Замена «нес» (знамя, чудо)'],
    ['чуда', 'нес (נס)', 'Замена «нес»'],
    ['знамение', 'от (אות)', 'Замена «от» (знак) на «знамение»'],
    ['знамения', 'от (אות)', 'Замена «от»'],
    ['пророчество', 'невуа (נבואה)', 'Замена «невуа» (провозвестие)'],
    ['пророчества', 'невуа (נבואה)', 'Замена «невуа»'],
    ['видение', 'хазон (חזון)', 'Замена «хазон» (видение)'],
    ['видения', 'хазон (חזון)', 'Замена «хазон»'],
    ['откровение', 'хитгалут (התגלות)', 'Замена «хитгалут» (раскрытие)'],
    ['откровения', 'хитгалут (התגלות)', 'Замена «хитгалут»'],
    ['молитва', 'тфила (תפילה)', 'Замена «тфила» (молитва, самооценка)'],
    ['молитвы', 'тфила (תפילה)', 'Замена «тфила»'],
    ['псалом', 'мизмор (מזמור)', 'Замена «мизмор» (струнная песнь) на «псалом»'],
    ['псалма', 'мизмор (מזמור)', 'Замена «мизмор»'],
    ['аллилуйя', 'hалелу Я (הללו יה)', 'Замена «hалелу Я» (хвалите Ях) на «аллилуйя»'],
    ['аминь', 'амен (אמן)', 'Замена «амен» (истинно) на греч. «аминь»'],
    ['осанна', 'ошиа на (הושע נא)', 'Замена «ошиа на» (спаси же) на греч. «осанна»']
  ];

  // Экспортируем для глобального поиска
  window._relDict = DICT;

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* Тип подмены выводится из ивритского оригинала: детерминированно, без ручной
     разметки 127 строк словаря. Порядок массива = порядок групп в результате. */
  var TYPES = [
    { key: 'nameYah', re: /יהוה/ },
    { key: 'elohim', re: /אלהים|עליון/ },
    { key: 'mashiach', re: /משיח|יהושע|מושיע|ישועה/ },
    { key: 'servants', re: /מלאך|שליח|נביא|נבואה|כהן|קהל/ },
    { key: 'cult', re: /טבילה|טבל|שבת|פסח|שבועות|תפילה|מזמור|הללו|אמן|הושע/ },
    { key: 'temple', re: /חטא|שאול|גן עדן|כפרה|קרבן|מזבח|משכן|בית המקדש/ },
    { key: 'adversary', re: /שטן|שד/ },
    { key: 'concepts', re: /./ }
  ];

  var TYPE_FALLBACK = {
    nameYah: 'Имя Яхве',
    elohim: 'Имена Элоhим',
    mashiach: 'Машиах и избавление',
    servants: 'Служители и собрание',
    cult: 'Праздники и служение',
    temple: 'Храм, жертва и судьба',
    adversary: 'Противник',
    concepts: 'Понятия и состояния'
  };

  function typeOf(entry) {
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].re.test(entry[1])) return TYPES[i].key;
    }
    return 'concepts';
  }

  /* Подписи типов — литеральными ключами (иначе экстрактор не увидит их):
     вызываются лениво, чтобы t() читал уже загруженный словарь. */
  function typeLabel(key) {
    if (key === 'nameYah') return t('lab.religionism.type.nameYah', 'Имя Яхве');
    if (key === 'elohim') return t('lab.religionism.type.elohim', 'Имена Элоhим');
    if (key === 'mashiach') return t('lab.religionism.type.mashiach', 'Машиах и избавление');
    if (key === 'servants') return t('lab.religionism.type.servants', 'Служители и собрание');
    if (key === 'cult') return t('lab.religionism.type.cult', 'Праздники и служение');
    if (key === 'temple') return t('lab.religionism.type.temple', 'Храм, жертва и судьба');
    if (key === 'adversary') return t('lab.religionism.type.adversary', 'Противник');
    return t('lab.religionism.type.concepts', 'Понятия и состояния');
  }

  /* Уверенность (DESIGN-SYSTEM §6): глосса оригинала или указание греческого
     слоя — зафиксированная подмена (эмет); прочее — интерпретация, и на ней бейдж. */
  function isInterpretation(entry) {
    var note = entry[2] || '';
    return note.indexOf('(') === -1 && note.indexOf('греч.') === -1;
  }

  /* «Яхве (יהוה)» → транслитерация + иврит для колонки оригинала. */
  function splitOriginal(original) {
    var match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(original || '');
    if (!match) return { translit: original || '', hebrew: '' };
    return { translit: match[1].trim(), hebrew: match[2].trim() };
  }

  function toNode(html) {
    var box = document.createElement('div');
    box.innerHTML = html;
    return box.firstElementChild || box;
  }

  function raf(callback) {
    if (window.requestAnimationFrame) window.requestAnimationFrame(callback);
    else window.setTimeout(callback, 16);
  }

  function setStatus(element, message, stateName) {
    if (!element) return;
    element.textContent = message || '';
    element.className = 'lab-status' + (stateName ? ' is-' + stateName : '');
  }

  /* Бейдж состояния панели: empty / running / success / clean / error. */
  function setState(badge, stateName) {
    if (!badge) return;
    var meta = {
      empty: { className: 'wb-badge', label: t('lab.religionism.stateEmpty', 'Ожидание') },
      running: { className: 'wb-badge is-running', label: t('lab.religionism.stateRunning', 'Проверка') },
      success: { className: 'wb-badge is-done', label: t('lab.religionism.stateSuccess', 'Готово') },
      clean: { className: 'wb-badge is-done', label: t('lab.religionism.stateClean', 'Чисто') },
      error: { className: 'wb-badge is-error', label: t('lab.religionism.stateError', 'Ошибка') }
    }[stateName] || { className: 'wb-badge', label: '' };
    badge.className = meta.className;
    badge.textContent = meta.label;
  }

  function summaryLine(hits, types) {
    return t('lab.religionism.summary', '{hits} подмен · {types} типов')
      .replace('{hits}', String(hits))
      .replace('{types}', String(types));
  }

  function emptyBox(hint) {
    return '<div class="lab-empty">' +
      '<span class="lab-empty-glyph" aria-hidden="true">\uD800\uDF00</span>' +
      '<p class="lab-empty-hint">' + esc(hint) + '</p>' +
      '</div>';
  }

  function skeletonBox() {
    return '<div class="lab-skeleton" role="status" aria-live="polite">' +
      '<span class="lab-skeleton-line"></span>' +
      '<span class="lab-skeleton-line"></span>' +
      '<span class="lab-skeleton-line"></span>' +
      '<span class="lab-skeleton-line" style="width:40%"></span>' +
      '</div>';
  }

  function errorBox(message) {
    return '<div class="rc-error">' +
      '<p class="rc-error-text">' + esc(message) + '</p>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-rc-retry>' +
      esc(t('lab.religionism.retry', 'Повторить')) + '</button>' +
      '</div>';
  }

  function headHtml() {
    return '<div class="rc-table-head" role="row">' +
      '<span class="rc-cell" role="columnheader">' + esc(t('lab.religionism.colReplacement', 'Подмена')) + '</span>' +
      '<span class="rc-cell" role="columnheader">' + esc(t('lab.religionism.colOriginal', 'Оригинал')) + '</span>' +
      '<span class="rc-cell" role="columnheader">' + esc(t('lab.religionism.colNote', 'Пояснение')) + '</span>' +
      '</div>';
  }

  /* Строка подмены: чип + оригинал (сериф/иврит) + пояснение с бейджем уверенности.
     Ссылка ведёт deep-link'ом на запись термина в словаре модуля. */
  function rowHtml(entry, options) {
    var parts = splitOriginal(entry[1]);
    var term = entry[0];
    var conf = isInterpretation(entry)
      ? '<span class="rc-conf">' + esc(t('lab.religionism.confidence', 'интерпретация')) + '</span>'
      : '';
    var attrs = ' class="rc-row' + (options && options.targetClass ? ' ' + options.targetClass : '') + '"' +
      ' data-term="' + esc(term) + '"' +
      ' role="row" tabindex="0"' +
      ' href="#religionism-checker?term=' + encodeURIComponent(term) + '"' +
      ' aria-label="' + esc(t('lab.religionism.deepLink', 'Термин в словаре: ')) + esc(term) + '"';
    return '<a' + attrs + '>' +
      '<span class="rc-cell rc-cell-repl" role="cell"><span class="rc-chip">' + esc(term) + '</span></span>' +
      '<span class="rc-cell rc-cell-orig" role="cell"><span class="rc-orig">' + esc(parts.translit) + '</span>' +
        (parts.hebrew ? '<span class="rc-heb" dir="rtl" lang="hbo">' + esc(parts.hebrew) + '</span>' : '') + '</span>' +
      '<span class="rc-cell rc-cell-note" role="cell">' + conf + esc(entry[2]) + '</span>' +
      '</a>';
  }

  /* Панель 03: словарь терминов — цель deep-link'а строки результата. */
  function renderDict(scope) {
    var el = scope.querySelector('#rc-dict');
    var count = scope.querySelector('#rc-dict-count');
    if (!el) return;

    el.innerHTML = headHtml() + DICT.map(function (entry) {
      return rowHtml(entry, { targetClass: '' });
    }).join('');

    if (count) count.textContent = String(DICT.length);
  }

  // ===== Deep-link: #religionism-checker?term=<слово> =====
  function termFromHash() {
    var raw = String(window.location.hash || '').replace('#', '');
    if (raw.indexOf('religionism-checker') !== 0) return '';
    var queryIndex = raw.indexOf('?');
    if (queryIndex === -1) return '';
    var params = {};
    raw.substring(queryIndex + 1).split('&').forEach(function (pair) {
      var eq = pair.indexOf('=');
      if (eq === -1) return;
      params[decodeURIComponent(pair.substring(0, eq))] = decodeURIComponent(pair.substring(eq + 1));
    });
    return params.term || '';
  }

  function clearTargets(scope) {
    scope.querySelectorAll('.rc-row.is-target').forEach(function (row) {
      row.classList.remove('is-target');
    });
  }

  /* Deep-link ведёт в словарь (панель 03): сначала ищем запись там,
     и только если её нет — подсвечиваем строку результата. */
  function findRow(rows, needle) {
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].getAttribute('data-term')).toLowerCase() === needle) return rows[i];
    }
    return null;
  }

  function focusTerm(term) {
    var scope = rootScope();
    if (!term || !scope) return;
    var needle = term.toLowerCase();
    var row = findRow(scope.querySelectorAll('#rc-dict .rc-row[data-term]'), needle) ||
      findRow(scope.querySelectorAll('#rc-output .rc-row[data-term]'), needle);
    if (!row) return;
    clearTargets(scope);
    row.classList.add('is-target');
    if (row.scrollIntoView) row.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var scopeRef = null;

  function rootScope() {
    return scopeRef || document.getElementById('religionism-checker') || document;
  }

  /* Поиск подмен: самое длинное совпадение (сначала «Господа», затем «Господь»),
     граница слова — чтобы «ад» не срабатывал внутри «сад». */
  function findHits(text) {
    var sorted = DICT.slice().filter(function (entry) {
      return entry[0].indexOf('(') === -1; // «мир (покой)» — служебная форма словаря
    }).sort(function (a, b) { return b[0].length - a[0].length; });

    var hits = [];
    var position = 0;

    while (position < text.length) {
      var best = null;
      sorted.forEach(function (entry) {
        var match = text.slice(position).match(new RegExp(escapeRegex(entry[0]) + '(?![А-Яа-яЁё])', 'i'));
        if (!match) return;
        var index = position + match.index;
        if (!best || index < best.index || (index === best.index && entry[0].length > best.entry[0].length)) {
          best = { entry: entry, index: index, value: match[0] };
        }
      });

      if (!best) break;
      hits.push({ entry: best.entry, value: best.value, index: best.index });
      position = best.index + best.value.length;
    }

    return hits;
  }

  function countTypes(hits) {
    var seen = {};
    var total = 0;
    hits.forEach(function (hit) {
      var key = typeOf(hit.entry);
      if (seen[key]) return;
      seen[key] = true;
      total++;
    });
    return total;
  }

  /* Группы по типам подмен: uppercase-лейбл + бейдж-счётчик + таблица строк. */
  function hitsHtml(hits) {
    var groups = {};
    hits.forEach(function (hit) {
      var key = typeOf(hit.entry);
      if (!groups[key]) groups[key] = [];
      groups[key].push(hit.entry);
    });

    var html = '<div class="rc-groups">';
    TYPES.forEach(function (type) {
      var entries = groups[type.key];
      if (!entries) return;
      html += '<section class="rc-group">' +
        '<header class="rc-group-head">' +
        '<h3 class="rc-group-title">' + esc(typeLabel(type.key)) + '</h3>' +
        '<span class="wb-badge">' + entries.length + '</span>' +
        '</header>' +
        '<div class="rc-table" role="table">' + headHtml() +
        entries.map(function (entry) { return rowHtml(entry, null); }).join('') +
        '</div>' +
        '</section>';
    });
    return html + '</div>';
  }

  var state = { hits: [], types: 0 };

  function resetState(scope) {
    var output = scope.querySelector('#rc-output');
    if (output) output.innerHTML = emptyBox(t('lab.religionism.emptyHint', 'Вставьте текст и нажмите «Проверить».'));
    var summary = scope.querySelector('#rc-summary');
    if (summary) summary.hidden = true;
    setState(scope.querySelector('#rc-result-badge'), 'empty');
    setStatus(scope.querySelector('#rc-status'), '', '');
    state.hits = [];
    state.types = 0;
    clearTargets(scope);
  }

  function runCheck(scope) {
    var input = scope.querySelector('#rc-input');
    var output = scope.querySelector('#rc-output');
    var badge = scope.querySelector('#rc-result-badge');
    var summary = scope.querySelector('#rc-summary');
    var summaryText = scope.querySelector('#rc-summary-text');
    var status = scope.querySelector('#rc-status');
    if (!input || !output) return;

    var text = (input.value || '').trim();
    if (!text) {
      var message = t('lab.religionism.errorEmpty', 'Вставьте текст для проверки.');
      if (summary) summary.hidden = true;
      setState(badge, 'error');
      setStatus(status, message, 'error');
      output.replaceChildren(toNode(errorBox(message)));
      return;
    }

    setStatus(status, '', '');
    setState(badge, 'running');
    if (summary) summary.hidden = true;
    output.replaceChildren(toNode(skeletonBox()));

    // Скелетон показываем честно: расчёт синхронный, отдаём кадр браузеру.
    raf(function () {
      var hits = findHits(text);
      state.hits = hits;
      state.types = countTypes(hits);

      if (hits.length) {
        setState(badge, 'success');
        output.replaceChildren(toNode(hitsHtml(hits)));
        if (summary) {
          summary.hidden = false;
          summaryText.textContent = summaryLine(hits.length, state.types);
        }
        setStatus(status, t('lab.religionism.found', 'Найдено подмен: ') + hits.length, 'success');
        return;
      }

      var clean = t('lab.religionism.cleanHint', 'Подмен не найдено — текст чист.');
      setState(badge, 'clean');
      output.replaceChildren(toNode(emptyBox(clean)));
      if (summary) {
        summary.hidden = false;
        summaryText.textContent = summaryLine(0, 0);
      }
      setStatus(status, clean, 'success');
    });
  }

  function clearInput(scope) {
    var input = scope.querySelector('#rc-input');
    if (input) input.value = '';
    resetState(scope);
  }

  function markdownReport() {
    var lines = [
      '# ' + t('lab.religionism.dictTitle', 'Словарь религионизмов'),
      '',
      summaryLine(state.hits.length, state.types || 0),
      '',
      '| ' + t('lab.religionism.colReplacement', 'Подмена') + ' | ' + t('lab.religionism.colOriginal', 'Оригинал') +
        ' | ' + t('lab.religionism.colNote', 'Пояснение') + ' |',
      '| --- | --- | --- |'
    ];
    state.hits.forEach(function (hit) {
      lines.push('| ' + hit.entry[0] + ' | ' + hit.entry[1] + ' | ' + hit.entry[2] + ' |');
    });
    return lines.join('\n') + '\n';
  }

  function copyMarkdown(scope) {
    var status = scope.querySelector('#rc-status');
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      setStatus(status, t('lab.religionism.copyFailed', 'Копирование недоступно'), 'error');
      return;
    }
    navigator.clipboard.writeText(markdownReport()).then(function () {
      setStatus(status, t('lab.religionism.copied', 'Markdown скопирован'), 'success');
    }).catch(function () {
      setStatus(status, t('lab.religionism.copyFailed', 'Копирование недоступно'), 'error');
    });
  }

  function downloadMarkdown() {
    var blob = new Blob([markdownReport()], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'religionism-check-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function init(container) {
    var scope = container || document.getElementById('religionism-checker');
    if (!scope) return;
    scopeRef = scope;

    // Повторный заход на маршрут не должен дублировать слушатели.
    if (scope.dataset && scope.dataset.rcInit === '1') {
      focusTerm(termFromHash());
      return;
    }
    if (scope.dataset) scope.dataset.rcInit = '1';

    // Разметка страницы приходит после старта i18n — переводим её здесь.
    if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
      window.AlephyI18n.applyTranslations(scope);
    }

    renderDict(scope);
    resetState(scope);

    var form = scope.querySelector('#rc-form');
    var input = scope.querySelector('#rc-input');
    var clearBtn = scope.querySelector('#rc-clear-btn');
    var copyBtn = scope.querySelector('#rc-copy-btn');
    var downloadBtn = scope.querySelector('#rc-download-btn');

    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      runCheck(scope);
    });
    if (clearBtn) clearBtn.addEventListener('click', function () { clearInput(scope); });
    if (copyBtn) copyBtn.addEventListener('click', function () { copyMarkdown(scope); });
    if (downloadBtn) downloadBtn.addEventListener('click', downloadMarkdown);

    // Ctrl/Cmd+Enter — проверка из textarea.
    if (input) input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      runCheck(scope);
    });

    scope.addEventListener('click', function (event) {
      var target = event.target;
      var chip = target && target.closest ? target.closest('.lab-example-chip') : null;
      if (chip) {
        if (input) {
          input.value = chip.getAttribute('data-rc-example') || chip.textContent.trim();
          input.focus();
        }
        setStatus(scope.querySelector('#rc-status'), '', '');
        return;
      }
      if (target && target.closest && target.closest('[data-rc-retry]')) {
        if (input && !input.value.trim()) input.focus();
        runCheck(scope);
      }
    });

    window.addEventListener('hashchange', function () {
      var term = termFromHash();
      if (term) focusTerm(term);
    });

    focusTerm(termFromHash());
  }

  return {
    init: init,
    check: function () { runCheck(rootScope()); },
    clear: function () { clearInput(rootScope()); }
  };
})();

window.RelChecker = RelChecker;

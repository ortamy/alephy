/**
 * Давар-чекер — проверка физической воплощаемости слова.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/davar-checker.html';
  var davarList = ['вода', 'дверь', 'рука', 'рыба', 'ветер', 'дом', 'хлеб', 'земля', 'дух', 'закон', 'любовь', 'завет'];
  var noiseList = ['духовность', 'самореализация', 'энергия', 'ресурс', 'травма'];
  var lastVerdict = '';
  var corpus = { вода: 'поток', дух: 'дыхание и движение', закон: 'направление через слово', любовь: 'сила, направленная через дом' };
  var t = function(key, fallback) { return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t('lab.davar.' + key, fallback) : fallback; };
  function esc(value) { var el = document.createElement('div'); el.textContent = value; return el.innerHTML; }
  function getNode(root, selector) { return root && root.querySelector ? root.querySelector(selector) : document.querySelector(selector); }
  function icons(root) { if (window.LabIcons) window.LabIcons.sync(); }
  function reason(icon, label, text) { return '<div class="davar-checker-reason"><i data-lucide="' + icon + '" aria-hidden="true"></i><strong>' + esc(label) + '</strong><span>' + esc(text) + '</span></div>'; }
  var section = function(num, title, text, icon) { return '<section class="davar-section" data-davar-section="' + num + '"><div class="davar-section-head"><span>' + num + '</span><b>' + title + '</b><i></i></div><div class="davar-empty"><i data-lucide="' + icon + '" aria-hidden="true"></i><span>' + text + '</span></div></section>'; };
  var emptySections = function() { return section('01','ВЕРДИКТ','После проверки здесь появится вердикт.','gavel') + section('02','КРИТЕРИИ','Здесь появятся три критерия воплощения.','list-checks') + section('03','ПРИМЕРЫ ИЗ КОРПУСА','Здесь появятся строки употребления слова.','book-open') + section('04','ОПРОВЕРЖЕНИЕ','Здесь появится условие смены вердикта.','circle-help') + section('05','ДВЕРИ','Здесь появятся связанные маршруты.','door-open'); };
  function initialRender(root) { var result = getNode(root, '#davar-checker-result'); if (result) { result.innerHTML = emptySections(); icons(root); } }
  function renderVerdict(root, kind, word) {
    var result = getNode(root, '#davar-checker-result');
    if (!result) return;
    if (kind === 'running') { result.innerHTML = emptySections().replace(/davar-empty/g, 'davar-running'); icons(root); return; }
    if (kind === 'empty') { result.innerHTML = emptySections(); icons(root); return; }
    if (kind === 'error') { result.innerHTML = '<div class="davar-error" role="alert"><span>Слово не из набора</span><button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-davar-retry>Повторить</button></div>' + emptySections(); icons(root); return; }
    var davar = kind === 'davar', noise = kind === 'noise';
    var status = davar ? 'воплощается' : noise ? 'пустой звук' : 'требует проверки';
    var criteria = davar ? corpus[word] || 'Наблюдаемая форма действия' : 'Не зафиксировано';
    var verses = davar ? '<div class="davar-verse"><code>בראשית</code><span>поток, который можно наблюдать</span></div>' : '';
    var doors = davar && corpus[word] ? '<a href="#root-dictionary/search/' + encodeURIComponent(word) + '">Корень слова → корневой словарь</a><a href="#etymology-checker">Слово → чекер подмен</a>' : noise ? '<a href="#etymology-checker">Слово → чекер подмен</a>' : '';
    result.innerHTML = '<section class="davar-section"><div class="davar-section-head"><span>01</span><b>ВЕРДИКТ</b><i></i></div><div class="davar-checker-status davar-checker-status-' + kind + '">' + status + '</div><p class="davar-checker-verdict">' + esc(word) + '</p><p>' + (davar ? 'Слово указывает на наблюдаемую конструкцию.' : 'Звук не закреплён за физическим действием.') + '</p></section><section class="davar-section"><div class="davar-section-head"><span>02</span><b>КРИТЕРИИ</b><i></i></div><div class="davar-reasons">' + reason('scan','Физический эквивалент',davar ? criteria : 'Не зафиксирован.') + reason('mouse-pointer-2','Действие',davar ? 'Обозначает наблюдаемое действие.' : 'Не зафиксировано.') + reason('box','Материал',davar ? 'Опирается на предметный образ.' : 'Не зафиксирован.') + '</div></section><section class="davar-section"><div class="davar-section-head"><span>03</span><b>ПРИМЕРЫ ИЗ КОРПУСА</b><i></i></div>' + (verses || '<div class="davar-empty"><i data-lucide="book-open"></i><span>Для этого слова строки употребления не найдены.</span></div>') + '</section><section class="davar-section"><div class="davar-section-head"><span>04</span><b>ОПРОВЕРЖЕНИЕ</b><i></i></div><p class="davar-counter">' + (davar ? 'Перестанет быть Даваром, если исчезнет наблюдаемое действие.' : 'Станет Даваром, если появится физический эквивалент.') + '</p></section><section class="davar-section"><div class="davar-section-head"><span>05</span><b>ДВЕРИ</b><i></i></div><div class="davar-doors">' + doors + '</div></section>'; lastVerdict = result.innerHTML;
    icons(root);
  }
  function check(root) {
    root = root || document; var input = getNode(root, '#davar-checker-input'); if (!input) return '';
    var word = input.value.trim().toLowerCase();
    if (!word) { renderVerdict(root, 'empty', ''); return ''; }
    renderVerdict(root, 'running', word);
    window.setTimeout(function() { renderVerdict(root, davarList.indexOf(word) !== -1 ? 'davar' : noiseList.indexOf(word) !== -1 ? 'noise' : 'error', word); }, 180);
    return word;
  }
  function bind(container) {
    var form = container.querySelector('#davar-checker-form'); var input = container.querySelector('#davar-checker-input'); if (!form || !input) return;
    if (!container.dataset.davarBound) { container.dataset.davarBound = '1'; form.addEventListener('submit', function(event) { event.preventDefault(); check(container); }); input.addEventListener('keydown', function(event) { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); check(container); } }); container.addEventListener('click', function(event) { var example = event.target.closest('[data-davar-example]'); if (example) { input.value = example.dataset.davarExample; input.focus(); } if (event.target.closest('[data-davar-retry]')) { input.focus(); check(container); } }); initialRender(container); }
    input.focus();
  }
  function applyMarkup(container, markup) {
    container.innerHTML = markup;
    container.dataset.loaded = '1';
    delete container.dataset.loading;
    bind(container);
  }

  var cachedMarkup = null;
  function init(container) {
    if (!container) return;
    if (container.querySelector('#davar-checker-form')) {
      container.dataset.loaded = '1';
      delete container.dataset.loading;
      bind(container);
      return;
    }
    if (container.dataset.loading === '1') return;
    container.dataset.loading = '1';
    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка…</div></div>';

    if (cachedMarkup) {
      applyMarkup(container, cachedMarkup);
      return;
    }

    fetch(PAGE_PATH)
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + PAGE_PATH);
        return response.text();
      })
      .then(function(markup) {
        cachedMarkup = markup;
        applyMarkup(container, markup);
      })
      .catch(function(error) {
        delete container.dataset.loading;
        container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить Давар-чекер: ' + error.message + '</div>';
      });
  }

  window.DavarChecker = {
    init: init,
    check: function() { return check(document); },
    davarList: davarList,
    noiseList: noiseList
  };
})(window, document);
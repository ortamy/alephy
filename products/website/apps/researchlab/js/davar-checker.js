/**
 * Давар-чекер — проверка физической воплощаемости слова.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/davar-checker.html';
  var davarList = ['вода', 'дверь', 'рука', 'рыба', 'ветер', 'дом', 'хлеб', 'земля', 'дух', 'закон', 'любовь'];
  var noiseList = ['духовность', 'самореализация', 'энергия', 'ресурс', 'травма'];
  var corpus = { вода: 'поток', дух: 'дыхание и движение', закон: 'направление через слово', любовь: 'сила, направленная через дом' };
  var t = function(key, fallback) { return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t('lab.davar.' + key, fallback) : fallback; };
  function esc(value) { var el = document.createElement('div'); el.textContent = value; return el.innerHTML; }
  function getNode(root, selector) { return root && root.querySelector ? root.querySelector(selector) : document.querySelector(selector); }
  function icons(root) { if (window.LabIcons) window.LabIcons.sync(); }
  function reason(icon, label, text) { return '<div class="davar-checker-reason"><i data-lucide="' + icon + '" aria-hidden="true"></i><strong>' + esc(label) + '</strong><span>' + esc(text) + '</span></div>'; }
  function renderVerdict(root, kind, word) {
    var result = getNode(root, '#davar-checker-result');
    if (!result) return;
    if (kind === 'running') { result.innerHTML = '<div class="davar-checker-running" aria-label="Проверка"><span></span><span></span><span></span></div>'; icons(root); return; }
    if (kind === 'empty') { result.innerHTML = '<div class="davar-checker-empty"><i data-lucide="scan-search" aria-hidden="true"></i><span>' + esc(t('empty', 'Введите слово из проверяемого набора')) + '</span></div>'; icons(root); return; }
    if (kind === 'error') { result.innerHTML = '<div class="davar-checker-error"><span>' + esc(t('error', 'Слово не из набора')) + '</span><button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-davar-retry>' + esc(t('retry', 'Повторить')) + '</button></div>'; icons(root); return; }
    var davar = kind === 'davar', noise = kind === 'noise';
    var status = davar ? t('embodied', 'воплощается') : noise ? t('noise', 'пустой звук') : t('review', 'требует проверки');
    var explanation = davar ? t('davarText', 'Слово указывает на наблюдаемую конструкцию.') : noise ? t('noiseText', 'Звук не закреплён за физическим действием.') : t('reviewText', 'Слово требует отдельной палео-сборки.');
    var doors = davar && corpus[word] ? '<a href="#root-dictionary/search/' + encodeURIComponent(word) + '">' + esc(t('root', 'Корень слова → корневой словарь')) + '</a>' : '';
    result.innerHTML = '<div class="davar-checker-status davar-checker-status-' + kind + '">' + esc(status) + '</div><p class="davar-checker-verdict">' + esc(word) + '</p><p>' + esc(explanation) + '</p><div class="davar-checker-reasons">' + reason('scan', t('physical', 'Физический эквивалент'), davar ? corpus[word] || t('observed', 'Наблюдаемая форма действия.') : t('none', 'Не зафиксирован.')) + reason('mouse-pointer-2', t('action', 'Действие'), davar ? t('actionYes', 'Обозначает наблюдаемое действие.') : t('none', 'Не зафиксировано.')) + reason('box', t('material', 'Материал'), davar ? t('materialYes', 'Опирается на предметный образ.') : t('none', 'Не зафиксирован.')) + '</div>' + (doors ? '<div class="davar-checker-doors">' + doors + '</div>' : '');
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
    if (form.dataset.bound !== '1') { form.dataset.bound = '1'; form.addEventListener('submit', function(event) { event.preventDefault(); check(container); }); input.addEventListener('keydown', function(event) { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); check(container); } }); container.addEventListener('click', function(event) { var example = event.target.closest('[data-davar-example]'); if (example) { input.value = example.dataset.davarExample; input.focus(); } if (event.target.closest('[data-davar-retry]')) { input.focus(); check(container); } }); }
    input.focus();
  }
  var cachedMarkup = null;



  function applyMarkup(container, markup) {
    container.innerHTML = markup;
    container.dataset.loaded = '1';
    delete container.dataset.loading;
    bind(container);
  }

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
/**
 * Лингвистический тензор — точечное сравнение двух языков по шести осям.
 * Оценки являются исследовательской моделью поверх базовых данных Карты языков.
 */
(function(window, document) {
  'use strict';

  var DATA_PATH = 'data/language-map/languages.json';
  var dataPromise = null;
  var current = { languages: [], left: '', right: '', analysis: null };
  var levelScores = { низкая: 35, средняя: 65, высокая: 90 };
  var axes = [
    { key: 'davar', title: 'Сборка Давара', hint: 'Глагольность vs существительность', source: 'has_davar' },
    { key: 'transitions', title: 'Переходы', hint: 'Смена состояния и фаза действия', source: 'has_transitions' },
    { key: 'roots', title: 'Корневая система', hint: 'Наличие и видимость корней', source: 'has_davar' },
    { key: 'transparency', title: 'Грамматическая прозрачность', hint: 'Видимость отношений внутри формы', source: 'has_transitions' },
    { key: 'paleo', title: 'Близость к палео-ивриту', hint: 'Корневой и семитский контур', source: 'proximity_to_reality' },
    { key: 'image', title: 'Физика образа', hint: 'Конкретное vs абстрактное', source: 'proximity_to_reality' }
  ];

  function escapeHtml(value) {
    var node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  function scoreLevel(value) { return levelScores[String(value || '').toLowerCase()] || 50; }

  function scoreLanguage(language, axis) {
    var score = scoreLevel(language[axis.source]);
    if (axis.key === 'roots') {
      if (language.family === 'семитский') score = 95;
      else if (language.family === 'тюркский' || language.family === 'японский' || language.family === 'корейский') score += 8;
    }
    if (axis.key === 'transparency' && language.script === 'иероглифы') score -= 12;
    if (axis.key === 'image' && language.family === 'семитский') score += 5;
    return Math.max(0, Math.min(100, score));
  }

  function getLanguage(id) {
    return current.languages.filter(function(language) { return language.id === id; })[0] || null;
  }

  function selectOptions(selected, exclude) {
    return current.languages.map(function(language) {
      return '<option value="' + escapeHtml(language.id) + '"' +
        (language.id === selected ? ' selected' : '') + (language.id === exclude ? ' disabled' : '') + '>' +
        escapeHtml(language.name) + '</option>';
    }).join('');
  }

  function bar(score, tone) {
    return '<div class="tensor-score-wrap"><div class="tensor-score-bar" aria-hidden="true"><span class="tensor-score-fill tensor-score-' + tone + '" style="width:' + score + '%"></span></div><strong class="tensor-score-value">' + score + '</strong></div>';
  }

  function buildAnalysis(left, right) {
    var rows = axes.map(function(axis) {
      var leftScore = scoreLanguage(left, axis);
      var rightScore = scoreLanguage(right, axis);
      return { axis: axis, left: leftScore, right: rightScore, delta: leftScore - rightScore };
    });
    var leftTotal = Math.round(rows.reduce(function(sum, row) { return sum + row.left; }, 0) / rows.length);
    var rightTotal = Math.round(rows.reduce(function(sum, row) { return sum + row.right; }, 0) / rows.length);
    var winner = leftTotal === rightTotal ? null : (leftTotal > rightTotal ? left : right);
    var verdict = winner
      ? winner.name + ' собирает Давар плотнее: ' + (winner === left ? leftTotal : rightTotal) + ' против ' + (winner === left ? rightTotal : leftTotal) + '. '
      : 'Оба языка дают сопоставимую плотность сборки Давара. ';
    verdict += 'Тензор показывает исследовательскую гипотезу, а не окончательный приговор языку.';
    return { rows: rows, leftTotal: leftTotal, rightTotal: rightTotal, verdict: verdict, winner: winner };
  }

  function render(container) {
    var left = getLanguage(current.left);
    var right = getLanguage(current.right);
    if (!left || !right || left.id === right.id) return;
    current.analysis = buildAnalysis(left, right);
    var analysis = current.analysis;
    var cards = analysis.rows.map(function(row, index) {
      var leftTone = row.left > row.right ? 'lead' : (row.left < row.right ? 'trail' : 'equal');
      var rightTone = row.right > row.left ? 'lead' : (row.right < row.left ? 'trail' : 'equal');
      var lead = row.delta === 0 ? 'Сопоставимая плотность' :
        (row.delta > 0 ? left.name + ' · выше плотность' : right.name + ' · выше плотность');
      return '<article class="tensor-axis-card" aria-labelledby="tensor-axis-' + index + '">' +
        '<div class="tensor-axis-head"><span class="tensor-axis-number">0' + (index + 1) + '</span><div><h3 id="tensor-axis-' + index + '">' + escapeHtml(row.axis.title) + '</h3><p>' + escapeHtml(row.axis.hint) + '</p></div></div>' +
        '<div class="tensor-lane"><div class="tensor-lane-label"><span>' + escapeHtml(left.name) + '</span><strong>' + row.left + '</strong></div>' + bar(row.left, leftTone) + '</div>' +
        '<div class="tensor-lane"><div class="tensor-lane-label"><span>' + escapeHtml(right.name) + '</span><strong>' + row.right + '</strong></div>' + bar(row.right, rightTone) + '</div>' +
        '<p class="tensor-axis-verdict">' + escapeHtml(lead) + '</p></article>';
    }).join('');
    container.querySelector('#tensor-results').innerHTML =
      '<section class="tensor-results" aria-labelledby="tensor-results-title">' +
      '<div class="tensor-results-head"><div><p class="tensor-kicker">СЛОЙ СРАВНЕНИЯ · 06 ОСЕЙ</p><h2 id="tensor-results-title">Плотность языкового потока</h2></div>' +
      '<div class="tensor-totals"><span><b>' + analysis.leftTotal + '</b> ' + escapeHtml(left.name) + '</span><span><b>' + analysis.rightTotal + '</b> ' + escapeHtml(right.name) + '</span></div></div>' +
      '<div class="tensor-axis-grid" aria-label="Сравнение по шести осям">' + cards + '</div>' +
      '<aside class="tensor-verdict" aria-labelledby="tensor-verdict-title"><div><p class="tensor-kicker">ИТОГОВЫЙ ВЕРДИКТ</p><h2 id="tensor-verdict-title">' + escapeHtml(analysis.verdict) + '</h2><p>Баллы нормированы по шкале 0–100 и собраны из исследовательских признаков Карты языков.</p></div><button type="button" class="lab-btn lab-btn-secondary tensor-copy" id="tensor-copy">Копировать как промпт</button></aside>' +
      '</section>';
    var copyButton = container.querySelector('#tensor-copy');
    if (copyButton) copyButton.addEventListener('click', function() { copyPrompt(container, left, right, analysis, copyButton); });
  }

  function promptText(left, right, analysis) {
    var lines = analysis.rows.map(function(row) { return '- ' + row.axis.title + ': ' + left.name + ' — ' + row.left + '/100; ' + right.name + ' — ' + row.right + '/100.'; });
    return 'Проанализируй языки в методологии ALEPHY: ' + left.name + ' и ' + right.name + '.\n\n' + lines.join('\n') + '\n\nВердикт: ' + analysis.verdict + '\n\nУточни, какие конкретные корни, формы и переходы нужно проверить корпусом.';
  }

  function copyPrompt(container, left, right, analysis, button) {
    var text = promptText(left, right, analysis);
    var done = function() { button.textContent = 'Промпт скопирован'; setTimeout(function() { button.textContent = 'Копировать как промпт'; }, 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function() { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    var field = document.createElement('textarea');
    field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.appendChild(field); field.select();
    try { document.execCommand('copy'); done(); } finally { document.body.removeChild(field); }
  }

  function renderShell(container) {
    var defaultLeft = current.languages.filter(function(language) { return language.id === 'russian'; })[0] || current.languages[0];
    var defaultRight = current.languages.filter(function(language) { return language.id === 'hebrew'; })[0] || current.languages[1];
    current.left = current.left || (defaultLeft && defaultLeft.id);
    current.right = current.right || (defaultRight && defaultRight.id);
    container.innerHTML = '<section class="tensor-shell" aria-label="Лингвистический тензор">' +
      '<form class="tensor-controls" id="tensor-form"><div class="tensor-field"><label for="tensor-left">Первый язык</label><select id="tensor-left" class="lab-select">' + selectOptions(current.left, current.right) + '</select></div><div class="tensor-vs" aria-hidden="true">VS</div><div class="tensor-field"><label for="tensor-right">Второй язык</label><select id="tensor-right" class="lab-select">' + selectOptions(current.right, current.left) + '</select></div><button type="submit" class="lab-btn lab-btn-primary tensor-run"><img src="assets/icons/32/archaeology/testtube.svg" width="24" height="24" alt="">Запустить анализ</button></form>' +
      '<p class="tensor-status" id="tensor-status" role="status" aria-live="polite">Выберите два языка, чтобы собрать тензор.</p><div id="tensor-results"></div></section>';
    container.querySelector('#tensor-form').addEventListener('submit', function(event) {
      event.preventDefault();
      current.left = container.querySelector('#tensor-left').value;
      current.right = container.querySelector('#tensor-right').value;
      var status = container.querySelector('#tensor-status');
      if (current.left === current.right) { status.textContent = 'Выберите два разных языка.'; return; }
      status.textContent = 'Анализ собран по шести осям.';
      render(container);
    });
  }

  function fetchData() {
    if (!dataPromise) dataPromise = fetch(DATA_PATH).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function(payload) { return payload.languages || []; });
    return dataPromise;
  }

  function init(container) {
    if (!container) return;
    fetchData().then(function(languages) { current.languages = languages; renderShell(container); }).catch(function(error) {
      container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить данные языков: ' + escapeHtml(error.message) + '</div>';
    });
  }

  window.LinguisticTensor = { init: init };
})(window, document);
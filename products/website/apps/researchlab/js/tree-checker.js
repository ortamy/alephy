/** Чекер дерева: шесть уровней от семени до плодов (канон страницы — panels.css). */
(function(window, document) {
  'use strict';
  var PAGE_PATH = 'pages/tree-checker.html';
  var levels = [
    { key: 'seed', name: 'Семя', description: 'Человек или дыхание, с которого учение началось.', question: 'Как жил основатель? Совпадает ли его жизнь с учением?' },
    { key: 'soil', name: 'Почва', description: 'Культурная, политическая и экономическая среда произрастания.', question: 'В какой среде родилось учение и кто поддерживал его рост?' },
    { key: 'roots', name: 'Корни', description: 'Источник дыхания: связь с Авраhамом, Ицхаком, Яаковом и Израилем.', question: 'Признаёт ли учение Израиль корнем или заменяет его?' },
    { key: 'trunk', name: 'Ствол', description: 'Центральная идея, на которой держится вся система.', question: 'Кто находится в центре? Противоречит ли идея Шма — Яхве один?' },
    { key: 'branches', name: 'Ветви', description: 'Видимые действия, практики, привычки и дисциплины.', question: 'Ведут ли ежедневные практики к свободе или к зависимости?' },
    { key: 'fruits', name: 'Плоды', description: 'Поведение, характер и результат жизни последователей.', question: 'Что это учение рождает: жизнь и целостность или страх и разделения?' }
  ];
  var preset = {
    seed: ['Никейский собор и имперская власть', 'rotten'],
    soil: ['Греческая философия и римская политика', 'rotten'],
    roots: ['Израиль заменён общиной системы', 'rotten'],
    trunk: ['Единство описывается как три лица', 'rotten'],
    branches: ['Догматы, соборы, анафемы и обряды', 'rotten'],
    fruits: ['Разделения, преследования и антисемитизм', 'rotten']
  };
  var state = { index: 0, answers: {} };
  var scopeRef = null;

  // ===== i18n и утилиты =====
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
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

  /* Вердикт уровня — семантика легенды §6: зелёная точка / золотая / accent-red. */
  var VERDICTS = [
    { key: 'healthy', tone: 'healthy', badge: 'is-done', label: 'Держится' },
    { key: 'unclear', tone: 'unclear', badge: 'is-running', label: 'Требует проверки' },
    { key: 'rotten', tone: 'rotten', badge: 'is-error', label: 'Гнилое место' }
  ];

  function verdictByKey(key) {
    for (var i = 0; i < VERDICTS.length; i++) {
      if (VERDICTS[i].key === key) return VERDICTS[i];
    }
    return VERDICTS[1];
  }

  function verdictLabel(key) {
    if (key === 'healthy') return t('lab.treeChecker.verdictHealthy', 'Держится');
    if (key === 'rotten') return t('lab.treeChecker.verdictRotten', 'Гнилое место');
    return t('lab.treeChecker.verdictUnclear', 'Требует проверки');
  }

  function answerOf(level) {
    return state.answers[level.key] || ['', ''];
  }

  function isAnswered(level) {
    return !!(state.answers[level.key] && state.answers[level.key][1]);
  }

  function statusOf(level, index) {
    if (index === state.index) return 'current';
    return isAnswered(level) ? 'passed' : 'new';
  }

  function progressLabel() {
    var level = levels[state.index];
    return t('lab.treeChecker.progressLabel', 'Уровень {n} из 6 · {name}')
      .replace('{n}', String(state.index + 1))
      .replace('{name}', level.name);
  }

  function levelLabel() {
    return t('lab.treeChecker.levelLabel', 'Уровень {n} из 6').replace('{n}', String(state.index + 1));
  }

  function setStatus(scope, message, stateName) {
    var status = scope.querySelector('#trc-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'lab-status' + (stateName ? ' is-' + stateName : '');
  }

  // ===== ПРОГРЕСС =====
  function renderProgress(scope) {
    var label = scope.querySelector('#trc-progress-label');
    var dots = scope.querySelector('#trc-dots');
    var fill = scope.querySelector('#trc-bar-fill');
    if (label) label.textContent = progressLabel();

    if (dots) {
      dots.innerHTML = levels.map(function (level, index) {
        var status = statusOf(level, index);
        var verdict = verdictByKey(answerOf(level)[1]);
        var classes = 'trc-dot';
        if (status === 'current') classes += ' is-current';
        if (status === 'passed') classes += ' is-passed-' + verdict.tone;
        return '<button type="button" class="' + classes + '" data-tree-goto="' + index + '"' +
          ' role="tab" aria-selected="' + (status === 'current' ? 'true' : 'false') + '"' +
          ' title="' + esc(t('lab.treeChecker.dot', 'Уровень {n}: {name}')
            .replace('{n}', String(index + 1)).replace('{name}', level.name)) + '"' +
          ' aria-label="' + esc(t('lab.treeChecker.dot', 'Уровень {n}: {name}')
            .replace('{n}', String(index + 1)).replace('{name}', level.name)) + '"></button>';
      }).join('');
    }

    if (fill) fill.style.width = ((state.index + 1) / levels.length * 100) + '%';
  }

  // ===== КАРТОЧКА УРОВНЯ =====
  function verdictChipsHtml(current) {
    return VERDICTS.map(function (verdict) {
      var checked = current === verdict.key;
      return '<label class="trc-verdict trc-verdict--' + verdict.tone + (checked ? ' is-checked' : '') + '">' +
        '<input type="radio" name="trc-rating" value="' + verdict.key + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="trc-verdict-dot" aria-hidden="true"></span>' + esc(verdictLabel(verdict.key)) +
        '</label>';
    }).join('');
  }

  function renderCard(scope) {
    var level = levels[state.index];
    var answer = answerOf(level);
    var rating = answer[1];

    var label = scope.querySelector('#trc-level-label');
    var badge = scope.querySelector('#trc-level-badge');
    var name = scope.querySelector('#trc-level-name');
    var description = scope.querySelector('#trc-level-description');
    var question = scope.querySelector('#trc-level-question');
    var text = scope.querySelector('#trc-text');
    var verdicts = scope.querySelector('#trc-verdicts');
    var prev = scope.querySelector('#trc-prev');
    var next = scope.querySelector('#trc-next');

    if (label) label.textContent = levelLabel();
    if (badge) {
      var meta = rating ? verdictByKey(rating) : null;
      badge.className = meta ? 'wb-badge ' + meta.badge : 'wb-badge';
      badge.textContent = meta ? verdictLabel(rating) : t('lab.treeChecker.stateNew', 'Новый');
    }
    if (name) name.textContent = level.name;
    if (description) description.textContent = level.description;
    if (question) question.textContent = level.question;
    if (text) text.value = answer[0];
    if (verdicts) verdicts.innerHTML = verdictChipsHtml(rating);
    if (prev) prev.disabled = state.index === 0;
    if (next) {
      next.textContent = state.index === levels.length - 1
        ? t('lab.treeChecker.finish', 'Завершить')
        : t('lab.treeChecker.next', 'Далее');
    }
    setStatus(scope, '', '');
  }

  function syncVerdictChips(scope, value) {
    scope.querySelectorAll('.trc-verdict').forEach(function (chip) {
      var input = chip.querySelector('input');
      chip.classList.toggle('is-checked', !!input && input.value === value);
    });
    var badge = scope.querySelector('#trc-level-badge');
    if (badge && value) {
      var meta = verdictByKey(value);
      badge.className = 'wb-badge ' + meta.badge;
      badge.textContent = verdictLabel(value);
    }
  }

  function save(scope) {
    var level = levels[state.index];
    var text = scope.querySelector('#trc-text');
    var rating = scope.querySelector('input[name="trc-rating"]:checked');
    state.answers[level.key] = [text ? text.value.trim() : '', rating ? rating.value : ''];
  }

  function render(scope) {
    renderProgress(scope);
    renderCard(scope);
  }


  // ===== ФИНАЛЬНАЯ СВОДКА =====
  function scoreOf() {
    return levels.reduce(function (sum, level) {
      var rating = answerOf(level)[1];
      return sum + (rating === 'healthy' ? 1 : (rating === 'unclear' ? 0.5 : 0));
    }, 0);
  }

  function outcomeOf() {
    var score = scoreOf();
    var rotten = levels.filter(function (level) { return answerOf(level)[1] === 'rotten'; }).length;
    if (rotten === 0 && score >= 5) return { tone: 'healthy', badge: 'is-done', score: score, rotten: rotten };
    if (score >= 3) return { tone: 'unclear', badge: 'is-running', score: score, rotten: rotten };
    return { tone: 'rotten', badge: 'is-error', score: score, rotten: rotten };
  }

  function verdictText(tone) {
    if (tone === 'healthy') return t('lab.treeChecker.verdictHealthyText', 'Дерево держится: признаки эмет обнаружены на всех уровнях.');
    if (tone === 'rotten') return t('lab.treeChecker.verdictRottenText', 'Дерево гнилое: ключевые уровни ведут в Мицраим, а не в Шамаим.');
    return t('lab.treeChecker.verdictUnclearText', 'Дерево требует дальнейшей проверки: есть смешанные уровни.');
  }

  function showResult(scope) {
    save(scope);
    var outcome = outcomeOf();
    var form = scope.querySelector('#trc-form');
    var result = scope.querySelector('#trc-result');
    if (!result || !form) return;

    result.querySelector('#trc-verdict-chip').className = 'wb-badge ' + outcome.badge;
    result.querySelector('#trc-verdict-chip').textContent = verdictLabel(outcome.tone);
    result.querySelector('#trc-result-badge').className = 'wb-badge is-done';
    result.querySelector('#trc-result-badge').textContent = t('lab.treeChecker.stateSuccess', 'Готово');
    result.querySelector('#trc-verdict-text').textContent = verdictText(outcome.tone);
    result.querySelector('#trc-tree').innerHTML = levels.map(function (level) {
      var verdict = verdictByKey(answerOf(level)[1]);
      return '<li class="trc-row">' +
        '<span class="trc-row-dot is-' + verdict.tone + '" aria-hidden="true"></span>' +
        '<span class="trc-row-name">' + esc(level.name) + '</span>' +
        '<span class="trc-row-verdict">' + esc(verdictLabel(verdict.key)) + '</span>' +
        '</li>';
    }).join('');
    scope.querySelector('#trc-copy-status').textContent = '';
    form.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function markdown() {
    var outcome = outcomeOf();
    var lines = ['# ' + t('lab.treeChecker.mdTitle', 'Чекер дерева'), ''];
    lines.push('**' + verdictLabel(outcome.tone) + '** — ' + verdictText(outcome.tone));
    lines.push('');
    lines.push('| ' + t('lab.treeChecker.resultTitle', 'Дерево') + ' | ' + t('lab.treeChecker.verdictLabel', 'Оценка уровня') + ' |');
    lines.push('| --- | --- |');
    levels.forEach(function (level) {
      lines.push('| ' + level.name + ' | ' + verdictLabel(answerOf(level)[1]) + ' |');
    });
    lines.push('');
    lines.push('## ' + t('lab.treeChecker.mdObservations', 'Наблюдения'));
    levels.forEach(function (level) {
      lines.push('');
      lines.push('### ' + level.name);
      lines.push(answerOf(level)[0] || '—');
    });
    return lines.join('\n') + '\n';
  }

  function copyMarkdown(scope) {
    var status = scope.querySelector('#trc-copy-status');
    function report(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.className = 'trc-footer-status' + (isError ? ' is-error' : '');
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      report(t('lab.treeChecker.copyFailed', 'Копирование недоступно'), true);
      return;
    }
    navigator.clipboard.writeText(markdown()).then(function () {
      report(t('lab.treeChecker.copied', 'Markdown скопирован'), false);
    }).catch(function () {
      report(t('lab.treeChecker.copyFailed', 'Копирование недоступно'), true);
    });
  }

  function resetState(scope) {
    state = { index: 0, answers: {} };
    var form = scope.querySelector('#trc-form');
    var result = scope.querySelector('#trc-result');
    if (result) {
      result.hidden = true;
      scope.querySelector('#trc-copy-status').textContent = '';
    }
    if (form) form.hidden = false;
    render(scope);
  }

  function applyPreset(scope) {
    state = { index: 0, answers: JSON.parse(JSON.stringify(preset)) };
    var form = scope.querySelector('#trc-form');
    var result = scope.querySelector('#trc-result');
    if (result) result.hidden = true;
    if (form) form.hidden = false;
    render(scope);
  }

  function goTo(scope, index) {
    if (index < 0 || index >= levels.length) return;
    save(scope);
    state.index = index;
    render(scope);
  }


  // ===== СОБЫТИЯ =====
  function bind(scope) {
    var form = scope.querySelector('#trc-form');

    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      save(scope);
      if (state.index === levels.length - 1) {
        showResult(scope);
        return;
      }
      state.index += 1;
      render(scope);
    });

    if (form) form.addEventListener('change', function (event) {
      if (event.target && event.target.name === 'trc-rating') {
        syncVerdictChips(scope, event.target.value);
        renderProgress(scope);
      }
    });

    // Делегирование: точки прогресса, чипы шапки (LabHero), действия результата.
    scope.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var dot = target.closest('[data-tree-goto]');
      if (dot) {
        goTo(scope, parseInt(dot.getAttribute('data-tree-goto'), 10) || 0);
        return;
      }
      if (target.closest('#trc-prev')) {
        goTo(scope, state.index - 1);
        return;
      }
      if (target.closest('#trc-copy')) { copyMarkdown(scope); return; }
      if (target.closest('#trc-again')) { resetState(scope); return; }
      if (target.closest('[data-lab-action="tree-reset"]')) { resetState(scope); return; }
      if (target.closest('[data-lab-action="tree-preset"]')) { applyPreset(scope); return; }
    });
  }

  function init(container) {
    if (!container || container.dataset.loading === '1') return;
    scopeRef = container;

    if (container.dataset.loaded === '1') {
      if (container.dataset.treeBound !== '1') bind(container);
      return;
    }

    container.dataset.loading = '1';
    fetch(PAGE_PATH)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(function (markup) {
        container.innerHTML = markup;
        container.dataset.loaded = '1';
        delete container.dataset.loading;
        container.dataset.treeBound = '1';

        // Разметка страницы приходит после старта i18n — переводим её здесь.
        if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
          window.AlephyI18n.applyTranslations(container);
        }
        bind(container);
        render(container);
      })
      .catch(function (error) {
        delete container.dataset.loading;
        container.innerHTML = '<div class="lab-alert lab-alert-error">' +
          esc(t('lab.treeChecker.loadFailed', 'Не удалось загрузить Чекер дерева: ')) + esc(error.message) + '</div>';
      });
  }

  window.TreeChecker = { init: init, render: function () { render(scopeRef || document); } };
})(window, document);

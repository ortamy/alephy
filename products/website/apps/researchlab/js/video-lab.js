/**
 * video-lab.js — Генератор видео-образов.
 * Визуализирует физику переходов между палео-буквами в слове.
 */
(function(window, document) {
  'use strict';

  var PALEO_CHARS = {
    'א': { char: '𐤀', name: 'Алеф', meaning: 'сила, бык, начало', motion: 'Инициация импульса, зарождение силы из источника.' },
    'ב': { char: '𐤁', name: 'Бет', meaning: 'дом, семья', motion: 'Концентрация и удержание силы внутри пространства.' },
    'ג': { char: '𐤂', name: 'Гимель', meaning: 'движение, верблюд', motion: 'Направленное перемещение, перенос импульса.' },
    'ד': { char: '𐤃', name: 'Далет', meaning: 'дверь, выбор', motion: 'Прохождение через барьер, изменение уровня или состояния.' },
    'ה': { char: '𐤄', name: 'Хе', meaning: 'откровение, окно', motion: 'Излучение вовне, проявление скрытого.' },
    'ו': { char: '𐤅', name: 'Вав', meaning: 'соединение, крюк', motion: 'Сцепление элементов, выстраивание оси связи.' },
    'ז': { char: '𐤆', name: 'Заин', meaning: 'оружие, защита', motion: 'Разделение сред, отсечение лишнего, фиксация границы.' },
    'ח': { char: '𐤇', name: 'Хет', meaning: 'ограда, жизнь', motion: 'Ограничение области для сохранения жизненной энергии.' },
    'ט': { char: '𐤈', name: 'Тет', meaning: 'скрытое благо', motion: 'Сворачивание силы во внутренний центр.' },
    'י': { char: '𐤉', name: 'Йод', meaning: 'рука, действие', motion: 'Точечное приложение силы, вектор направленного действия.' },
    'כ': { char: '𐤊', name: 'Каф', meaning: 'ладонь, власть', motion: 'Охват, принятие формы, подчинение импульса структуре.' },
    'ך': { char: '𐤊', name: 'Каф (софит)', meaning: 'ладонь, власть', motion: 'Завершение охвата и фиксация формы.' },
    'ל': { char: '𐤋', name: 'Ламед', meaning: 'посох, учение', motion: 'Управление движением, направление потока сверху вниз.' },
    'מ': { char: '𐤌', name: 'Мем', meaning: 'вода, народ', motion: 'Волновой процесс, непрерывный поток, растворение и перенос.' },
    'ם': { char: '𐤌', name: 'Мем (софит)', meaning: 'вода, народ', motion: 'Замыкание волнового процесса в конечный объем.' },
    'נ': { char: '𐤍', name: 'Нун', meaning: 'рыба, потомство', motion: 'Прорастание, непрерывное продолжение жизни, активность.' },
    'ן': { char: '𐤍', name: 'Нун (софит)', meaning: 'рыба, потомство', motion: 'Финальное закрепление ростка в структуре.' },
    'ס': { char: '𐤎', name: 'Самех', meaning: 'поддержка, основа', motion: 'Круговая защита, стабилизация опорного каркаса.' },
    'ע': { char: '𐤏', name: 'Аин', meaning: 'глаз, источник', motion: 'Фокусировка внимания, вскрытие глубинного пласта.' },
    'פ': { char: '𐤐', name: 'Пе', meaning: 'рот, речь', motion: 'Выброс энергии, расширение и передача импульса вовне.' },
    'ף': { char: '𐤐', name: 'Пе (софит)', meaning: 'рот, речь', motion: 'Выход во внешнюю среду завершен.' },
    'צ': { char: '𐤑', name: 'Цаде', meaning: 'праведность, цель', motion: 'Стремление к вершине, выстраивание вертикали напряжения.' },
    'ץ': { char: '𐤑', name: 'Цаде (софит)', meaning: 'праведность, цель', motion: 'Достижение цели и её жесткая фиксация.' },
    'ק': { char: '𐤒', name: 'Коф', meaning: 'святость, окружение', motion: 'Выделение священного контура, фильтрация хаоса.' },
    'ר': { char: '𐤓', name: 'Реш', meaning: 'голова, начало', motion: 'Определение главного вектора, доминирование идеи.' },
    'ש': { char: '𐤔', name: 'Шин', meaning: 'мир, разрушение', motion: 'Динамическое трение, огонь, поглощение старой структуры.' },
    'ת': { char: '𐤕', name: 'Тав', meaning: 'знак, завет, истина', motion: 'Печать завершенности, кристаллизация опыта в форму завета.' }
  };

  // i18n: литералы t('lab.video.*', 'русский резерв') читает tools/i18n-extract.py.
  function t(key, fallback) {
    return window.AlephyI18n && window.AlephyI18n.t ? window.AlephyI18n.t(key, fallback) : fallback;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  /* Бейдж состояния панели (DESIGN-SYSTEM §6): empty — нейтральный,
     running — золото, error — --accent-red, success — --accent-green. */
  function badgeState(badge, state) {
    if (!badge) return;
    var meta = {
      empty: { className: 'wb-badge', label: t('lab.video.stateEmpty', 'Ожидание') },
      running: { className: 'wb-badge is-running', label: t('lab.video.stateRunning', 'Генерация') },
      error: { className: 'wb-badge is-error', label: t('lab.video.stateError', 'Ошибка') },
      success: { className: 'wb-badge is-done', label: t('lab.video.stateSuccess', 'Готово') }
    }[state] || { className: 'wb-badge', label: '' };
    badge.className = meta.className;
    badge.textContent = meta.label;
  }

  /* Empty-state (§4.6): пунктирная рамка, глиф по центру, подсказка muted. */
  function emptyState(hint) {
    return '<div class="vl-empty">' +
      '<span class="vl-empty-glyph" aria-hidden="true">\uD800\uDF00</span>' +
      '<p class="vl-empty-hint">' + esc(hint) + '</p>' +
      '</div>';
  }

  function runningState() {
    return '<div class="vl-empty">' +
      '<i data-lucide="loader-circle" class="vl-run-icon" aria-hidden="true"></i>' +
      '<p class="vl-empty-hint">' + esc(t('lab.video.running', 'Собираем образ слова…')) + '</p>' +
      '</div>';
  }

  /* Лента состояний: глиф → имя → значение, между ними волосяная стрелка. */
  function renderTimeline(letters) {
    var html = '<div class="vl-timeline">';
    letters.forEach(function (item, idx) {
      html += '<div class="vl-timeline-node">' +
        '<span class="vl-paleo-char" lang="hbo" aria-hidden="true">' + esc(item.info.char) + '</span>' +
        '<span class="vl-char-name">' + esc(item.info.name) + ' (' + esc(item.raw) + ')</span>' +
        '<span class="vl-char-meaning">' + esc(item.info.meaning) + '</span>' +
        '</div>';
      if (idx < letters.length - 1) {
        html += '<div class="vl-timeline-arrow" aria-hidden="true">' +
          '<span class="vl-arrow-shaft"></span>' +
          '<span class="vl-arrow-label">' + esc(t('lab.video.transition', 'переход')) + '</span>' +
          '</div>';
      }
    });
    return html + '</div>';
  }

  /* Описание физики движения + синтез общей динамики перехода. */
  function renderDescription(letters) {
    var html = '<ol class="vl-desc-list">';
    letters.forEach(function (item, idx) {
      html += '<li><strong>' + esc(t('lab.video.statePrefix', 'Состояние ')) + (idx + 1) +
        ' — ' + esc(item.info.name) + ':</strong> ' + esc(item.info.motion) + '</li>';
    });
    html += '</ol>';
    if (letters.length > 1) {
      var first = letters[0].info.meaning;
      var middle = letters[Math.min(1, letters.length - 1)].info.meaning;
      var last = letters[letters.length - 1].info.meaning;
      var sentence = esc(t('lab.video.synthesis', 'Импульс начинается как {first}, проходит трансформацию через состояние {second} и запечатывается в финальном состоянии {last}.'))
        .replace('{first}', '<strong>' + esc(first) + '</strong>')
        .replace('{second}', '<strong>' + esc(middle) + '</strong>')
        .replace('{last}', '<strong>' + esc(last) + '</strong>');
      html += '<div class="vl-synthesis">' +
        '<h3>' + esc(t('lab.video.synthesisTitle', 'Общая динамика перехода')) + '</h3>' +
        '<p>' + sentence + '</p>' +
        '</div>';
    }
    return html;
  }

  function init(container) {
    if (!container) return;

    var form = container.querySelector('#vl-form');
    var wordInput = container.querySelector('#vl-word-input');
    var clearBtn = container.querySelector('#vl-clear-btn');
    var visualOutput = container.querySelector('#vl-visual-output');
    var descOutput = container.querySelector('#vl-description-output');
    var visualBadge = container.querySelector('#vl-visual-badge');
    var descBadge = container.querySelector('#vl-description-badge');
    var status = container.querySelector('#vl-status');

    if (!form || !wordInput || !visualOutput || !descOutput) return;

    // Повторный заход на маршрут не должен дублировать слушатели:
    // разметка и последний результат живут в DOM контейнера.
    if (container.dataset.vlInit === '1') return;
    container.dataset.vlInit = '1';

    // Разметка страницы приходит после старта i18n — переводим её здесь.
    if (window.AlephyI18n && window.AlephyI18n.applyTranslations) {
      window.AlephyI18n.applyTranslations(container);
    }

    var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (cb) { cb(); };

    function setStatus(message, state) {
      if (!status) return;
      status.textContent = message || '';
      status.className = 'vl-status' + (state ? ' is-' + state : '');
    }

    function setState(state) {
      badgeState(visualBadge, state);
      badgeState(descBadge, state);
    }

    function reset() {
      visualOutput.innerHTML = emptyState(t('lab.video.emptyVisual', 'Введите слово и нажмите «Сгенерировать».'));
      descOutput.innerHTML = emptyState(t('lab.video.emptyDescription', 'Здесь появится описание.'));
      setState('empty');
      setStatus('', '');
    }

    function fail(messageKey, fallback) {
      var hint = emptyState(t(messageKey, fallback));
      setState('error');
      setStatus(t(messageKey, fallback), 'error');
      visualOutput.innerHTML = hint;
      descOutput.innerHTML = hint;
    }

    function collectLetters(word) {
      var letters = [];
      word.split('').forEach(function (letter) {
        var clean = letter.replace(/[\u0591-\u05C7]/g, ''); // Очистка от огласовок
        if (clean && PALEO_CHARS[clean]) letters.push({ raw: clean, info: PALEO_CHARS[clean] });
      });
      return letters;
    }

    function generate() {
      var word = wordInput.value.trim();
      if (!word) {
        fail('lab.video.errorEmptyWord', 'Введите слово на иврите.');
        return;
      }

      var letters = collectLetters(word);
      if (!letters.length) {
        fail('lab.video.errorNoPaleo', 'Не найдено палео-символов в введённом слове.');
        return;
      }

      setStatus('', '');
      // Состояние running показываем честно: рендер синхронный,
      // поэтому отдаём кадр браузеру до сборки ленты.
      setState('running');
      visualOutput.innerHTML = runningState();
      descOutput.innerHTML = runningState();
      raf(function () {
        visualOutput.innerHTML = renderTimeline(letters);
        descOutput.innerHTML = renderDescription(letters);
        setState('success');
        setStatus(t('lab.video.done', 'Образ собран'), 'success');
      });
    }

    function clear() {
      wordInput.value = '';
      reset();
      wordInput.focus();
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      generate();
    });

    // Ctrl/Cmd+Enter — запуск генерации из любого поля модуля.
    container.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      generate();
    });

    if (clearBtn) clearBtn.addEventListener('click', clear);

    reset();
  }

  window.VideoLab = {
    init: init,
    PALEO_CHARS: PALEO_CHARS
  };
})(window, document);

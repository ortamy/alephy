/* agent-passport.js — внутренний паспорт агента с кодовой базой (§5.2q).

   Общий шаблон паспорта (ЗАПУСК / СВЯЗИ / РЕЗУЛЬТАТ) остаётся в
   page-controller. Этот модуль добавляет к нему четвёртую часть — «ПАСПОРТ»:
   контракт агента, результат его работы на реальном репозитории, исходник
   модуля и готовые задачи лаборатории.

   Зачем отдельный файл: у каждого агента с кодовой базой свой домен
   (у фронтенд-разработчика — дизайн-канон §4.1a). Общая оболочка и правила
   проверки остаются здесь, предметная часть приходит полем `frontend`.
   Префикс `ap-` (agent passport), каркас bento — по §5.2a, шапка ячейки
   обязана соответствовать §4.1a. */
(function (global) {
  'use strict';

  var API = 'http://127.0.0.1:5000';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --- Шапка ячейки: ровно §4.1a, иначе базовой h2 напечатает чёрку ---
  function cell(num, title, hint, body, modifier) {
    return '<section class="ap-cell' + (modifier ? ' ' + modifier : '') + '">' +
      '<header class="ap-cell-head"><span class="ap-num" aria-hidden="true">' + escapeHtml(num) + '</span>' +
      '<span class="ap-cell-title">' + escapeHtml(title) + '</span>' +
      (hint ? '<span class="ap-cell-hint">' + escapeHtml(hint) + '</span>' : '') +
      '</header>' + body + '</section>';
  }

  function metaLine(label, value) {
    return '<div class="ap-meta"><dt class="ap-meta-key">' + escapeHtml(label) + '</dt>' +
      '<dd class="ap-meta-val">' + escapeHtml(value) + '</dd></div>';
  }

  // Список «ключ: значение» — вход, выход, запуск.
  function pairsMarkup(items) {
    return '<dl class="ap-meta">' + items.map(function (item) {
      return metaLine(item[0], item[1]);
    }).join('') + '</dl>';
  }

  function listMarkup(items, emptyText) {
    if (!items || !items.length) {
      return '<p class="ap-note">' + escapeHtml(emptyText || '—') + '</p>';
    }
    return '<ul class="ap-bullets">' + items.map(function (item) {
      return '<li class="ap-bullet">' + escapeHtml(item) + '</li>';
    }).join('') + '</ul>';
  }
  // --- Контракт: вход, выход, границы ---
  function contractMarkup(contract) {
    if (!contract) return '';
    var input = contract.input || {};
    var output = contract.output || {};
    var run = contract.run || {};

    return '<div class="ap-stack">' +
      '<div class="ap-block"><h3 class="ap-block-title">Вход</h3>' +
        pairsMarkup([
          ['Тип', input.type],
          ['Обязательные поля', (input.required || []).join(', ')],
          ['Поле query', input.query]
        ]) + '</div>' +
      '<div class="ap-block"><h3 class="ap-block-title">Выход</h3>' +
        pairsMarkup([
          ['Тип', output.type],
          ['Ключи', (output.keys || []).join(', ')],
          ['Примечание', output.note]
        ]) + '</div>' +
      '<div class="ap-block"><h3 class="ap-block-title">Запуск</h3>' +
        pairsMarkup([
          ['Эндпоинт', run.endpoint],
          ['Пример', run.example],
          ['Сервер', run.server]
        ]) + '</div>' +
      '<div class="ap-block"><h3 class="ap-block-title">Границы</h3>' +
        listMarkup(contract.boundaries, 'Границы не объявлены.') + '</div>' +
      '</div>';
  }

  function emptyState(icon, text) {
    return '<div class="ap-empty"><span class="ap-empty-glyph" aria-hidden="true">' +
      '<i data-lucide="' + icon + '"></i></span>' +
      '<p class="ap-empty-hint">' + text + '</p></div>';
  }

  // --- Исходник модуля ---
  function sourceMarkup(source) {
    if (!source) {
      return emptyState('code-2',
        'Исходник подтянется с сервера агентов. Запустите ' +
        '<code>python products/agents/server.py</code>, чтобы видеть код здесь.');
    }
    return '<div class="ap-source">' +
      '<div class="ap-source-head">' +
        '<span class="ap-source-path">' + escapeHtml(source.path) + '</span>' +
        '<span class="ap-source-meta">' + escapeHtml(source.lines) + ' строк · ' +
          escapeHtml(String(Math.round((source.bytes || 0) / 1024))) + ' КБ</span>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-btn-compact ap-source-copy" ' +
          'data-ap-copy="1">Скопировать</button>' +
      '</div>' +
      '<pre class="ap-source-code"><code>' + escapeHtml(source.source || '') + '</code></pre>' +
      '<p class="ap-note ap-copy-status" data-ap-copy-status aria-live="polite"></p>' +
      '</div>';
  }

  // --- Задачи лаборатории: кнопка подставляет запрос в поле ЗАПУСК ---
  function tasksMarkup(tasks) {
    if (!tasks || !tasks.length) return '';
    return '<ul class="ap-tasks">' + tasks.map(function (task) {
      return '<li class="ap-task">' +
        '<span class="ap-task-head"><span class="ap-task-title">' + escapeHtml(task.title) + '</span>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-btn-compact ap-task-run" ' +
          'data-ap-task="' + escapeHtml(task.query) + '">Подставить</button></span>' +
        '<span class="ap-task-about">' + escapeHtml(task.about) + '</span></li>';
    }).join('') + '</ul>';
  }
  // --- Аудит: сводка + построчные расхождения ---
  function auditMarkup(report) {
    if (!report) {
      return emptyState('scan-line',
        'Запустите агента, чтобы увидеть результат проверки.');
    }

    var metrics = '<dl class="ap-metrics">' +
      metaLine('Заголовков ячеек', report.titles) +
      metaLine('Соответствуют канону', report.clean) +
      metaLine('Расхождений', report.violations) +
      metaLine('Файлов в области', report.files) +
      metaLine('Канон', report.canon) +
      '</dl>';

    var byRule = report.byRule || {};
    var keys = Object.keys(byRule);
    var rules = keys.length
      ? '<ul class="ap-rules">' + keys.map(function (key) {
        return '<li class="ap-rule"><span class="ap-rule-name">' + escapeHtml(key) + '</span>' +
          '<span class="ap-rule-count">' + escapeHtml(byRule[key]) + '</span></li>';
      }).join('') + '</ul>'
      : '';

    var findings = report.findings || [];
    var rows = findings.length
      ? '<ul class="ap-findings" data-ap-findings>' + findings.map(function (item) {
        return '<li class="ap-finding" data-ap-finding="' + escapeHtml(item.rule) + '">' +
          '<span class="ap-finding-where"><span class="ap-finding-file">' + escapeHtml(item.file) + '</span>' +
          '<span class="ap-finding-line">' + escapeHtml(item.line) + '</span></span>' +
          '<span class="ap-finding-body"><span class="ap-finding-rule">' + escapeHtml(item.rule) + '</span>' +
          '<span class="ap-finding-detail">' + escapeHtml(item.detail) + '</span>' +
          '<span class="ap-finding-fix">Исправить: ' + escapeHtml(item.fix) + '</span></span></li>';
      }).join('') + '</ul>'
      : emptyState('check-check',
        'Расхождений не найдено: все заголовки ячеек соответствуют канону.');

    return '<div class="ap-stack">' +
      '<div class="ap-block"><h3 class="ap-block-title">Сводка</h3>' + metrics + rules + '</div>' +
      '<div class="ap-block"><h3 class="ap-block-title">Расхождения</h3>' + rows + '</div>' +
      '</div>';
  }

  // Кода нет только когда сервер выключен: показываем, чем его поднять.
  function sourceHint() {
    return '<p class="ap-note ap-source-hint">Текст модуля подтянется с сервера агентов: ' +
      '<code>python products/agents/server.py</code>. Метрики и функции выше — из статического паспорта.</p>';
  }

  // --- Модуль: где лежит, как подключён, какие функции ---
  function moduleMarkup(info) {
    if (!info) return '';
    var functions = (info.functions || []).map(function (fn) {
      return '<li class="ap-fn">' +
        '<span class="ap-fn-name">' + escapeHtml(fn.name) + '</span>' +
        '<span class="ap-fn-line">' + escapeHtml(fn.line) + '</span>' +
        (fn.doc ? '<span class="ap-fn-doc">' + escapeHtml(fn.doc) + '</span>' : '') +
        '</li>';
    }).join('');

    return '<div class="ap-stack">' +
      '<dl class="ap-meta">' +
        metaLine('Путь', info.path) +
        metaLine('Размер', info.lines + ' строк · ' + Math.round((info.bytes || 0) / 1024) + ' КБ') +
        metaLine('Точка входа', info.entrypoint) +
        metaLine('Регистрация', info.registration) +
      '</dl>' +
      (functions ? '<div class="ap-block"><h3 class="ap-block-title">Функции модуля</h3>' +
        '<ul class="ap-fns">' + functions + '</ul></div>' : '') +
      '</div>';
  }

  // --- Канон: правила, которые агент проверяет (справочник §4.1a) ---
  function canonMarkup(canon) {
    if (!canon) return '';
    var rules = (canon.rules || []).map(function (rule) {
      return '<li class="ap-canon" data-ap-searchable>' +
        '<span class="ap-canon-label">' + escapeHtml(rule.label) + '</span>' +
        '<span class="ap-canon-value">' + escapeHtml(rule.value) + '</span>' +
        '<span class="ap-canon-why">' + escapeHtml(rule.why) + '</span></li>';
    }).join('');

    return '<p class="ap-note">Проверяет <span class="ap-canon-ref">' +
        escapeHtml(canon.reference) + '</span> по области <code>' +
        escapeHtml(canon.scope) + '</code></p>' +
      '<ul class="ap-canon-list">' + rules + '</ul>';
  }

  function capabilitiesMarkup(capabilities) {
    if (!capabilities) return emptyState('sliders-horizontal', 'Способности агента не объявлены.');
    var labels = {
      execution: 'Запуск',
      readRepository: 'Чтение репозитория',
      writesFiles: 'Запись файлов',
      streaming: 'Потоковый вывод'
    };
    var rows = Object.keys(labels).map(function (key) {
      var enabled = capabilities[key] === true;
      return '<li class="ap-capability" data-ap-searchable>' +
        '<span class="ap-capability-dot ap-capability-dot--' + (enabled ? 'on' : 'off') + '" aria-hidden="true"></span>' +
        '<span class="ap-capability-label">' + escapeHtml(labels[key]) + '</span>' +
        '<span class="ap-capability-value">' + (enabled ? 'да' : 'нет') + '</span></li>';
    }).join('');
    return '<ul class="ap-capabilities">' + rows + '</ul>';
  }

  // Собирает весь экран «Паспорт». Данные приходят из статического файла,
  // дополненного результатом запуска и исходником с сервера.
  function render(view, data) {
    data = data || {};
    var report = data.frontend || null;
    var contract = data.frontend_contract || data.contract || null;
    var source = data.frontend_source || data.source || null;
    var info = data.module || null;
    var canon = data.canon || null;
    var tasks = data.frontend_tasks || data.tasks || [];
    var capabilities = data.capabilities || (contract && contract.capabilities) || null;

    // Раскладка: 5+7 (контракт и канон), 8+4 (аудит и задачи), 12 (код).
    // Порядок в DOM повторяет визуальный — иначе ячейка на 12 колонок
    // разрывает строку и под ней остаётся дыра.
    view.innerHTML = '<div class="ap-bento">' +
      cell('01', 'Контракт агента', contract ? 'вход · выход · границы' : 'нет данных',
        contractMarkup(contract), 'ap-cell--contract') +
      cell('02', 'Канон проверки', canon ? canon.reference : 'нет данных',
        canon ? canonMarkup(canon) : emptyState('book-open', 'Справочник канона не собран.'),
        'ap-cell--canon') +
      cell('06', 'Способности', capabilities ? 'единый контракт' : 'нет данных',
        capabilitiesMarkup(capabilities)) +
      cell('03', 'Аудит канона', report ? report.clean + ' из ' + report.titles + ' чисто' : 'не запускался',
        auditMarkup(report), 'ap-cell--wide') +
      cell('05', 'Задачи лаборатории', tasks.length ? tasks.length + ' готовых' : 'нет',
        tasksMarkup(tasks)) +
      // Код — во всю ширину: листинг требует её, иначе строки Python
      // переносятся по 20 символов.
      cell('04', 'Код агента', source ? source.lines + ' строк' : (info ? info.lines + ' строк' : 'нет данных'),
        source ? sourceMarkup(source) : moduleMarkup(info) + sourceHint(), 'ap-cell--full') +
      '</div>' +
      // «Ничего не нашлось» живёт внутри паспорта, а не рядом с ним: рендер
      // перезаписывает view целиком, узел должен пересоздаваться с ячейками.
      '<div class="ap-view-empty" data-ap-search-empty hidden>' +
        emptyState('search-x', 'По запросу ничего не нашлось. Уточните запрос или очистите строку поиска.') +
      '</div>';

    bind(view);
    return view;
  }
  // --- Поведение: копирование кода, запуск задачи, поиск по расхождениям ---
  function bind(view) {
    view.querySelectorAll('[data-ap-copy]').forEach(function (button) {
      button.addEventListener('click', function() {
        var code = view.querySelector('.ap-source-code code');
        var status = view.querySelector('[data-ap-copy-status]');
        if (!code) return;
        var done = function(ok) {
          if (!status) return;
          status.textContent = ok ? 'Код скопирован.' : 'Копирование недоступно в этом браузере.';
        };
        if (!navigator.clipboard) { done(false); return; }
        navigator.clipboard.writeText(code.textContent)
          .then(function() { done(true); })
          .catch(function() { done(false); });
      });
    });

    view.querySelectorAll('[data-ap-task]').forEach(function (button) {
      button.addEventListener('click', function() {
        var input = document.getElementById('agent-run-input');
        if (!input) return;
        input.value = button.dataset.apTask;
        input.focus();
      });
    });

    // Поиск по всему паспорту: расхождения, правила канона, функции модуля.
    // Счётчик показывает, сколько строк совпало с запросом.
    var search = view.querySelector('[data-ap-search]');
    if (search) {
      search.addEventListener('input', function() {
        var query = search.value.trim().toLowerCase();
        var rows = view.querySelectorAll('[data-ap-finding], [data-ap-searchable]');
        var visible = 0;

        rows.forEach(function (row) {
          var match = query === '' || row.textContent.toLowerCase().indexOf(query) !== -1;
          row.hidden = !match;
          if (match) visible += 1;
        });

        var counter = view.querySelector('[data-ap-findings-count]');
        if (counter) {
          counter.innerHTML = query
            ? '<strong>' + visible + '</strong> совпадений'
            : '<strong>' + visible + '</strong> строк';
        }

        // Ноль совпадений — честное пустое состояние (§4.6): иначе паспорт
        // молча выглядит как пустой, хотя строки просто отфильтрованы.
        var empty = view.querySelector('[data-ap-search-empty]');
        if (empty) empty.hidden = !(query && visible === 0);
      });
    }

    if (global.lucide && global.lucide.createIcons) {
      try { global.lucide.createIcons(); } catch (error) { /* не критично */ }
    }
  }

  // Тулбар внутренней страницы (§4.7): оболочка .lab-toolbar — та же, что у
  // конвейеров и каталогов. Одна строка: поиск по строкам паспорта, счётчик
  // совпадений и возврат к списку агентов. Стоит сразу под шапкой модуля:
  // хром страницы читается сверху вниз, до содержимого ячеек.
  function toolbar() {
    return '<div class="lab-toolbar ap-toolbar" role="group" aria-label="Навигация и поиск по паспорту">' +
      '<input type="search" class="lab-input lab-toolbar-search ap-search" data-ap-search ' +
        'placeholder="Поиск по паспорту: правила, функции, расхождения…" ' +
        'aria-label="Поиск по паспорту агента">' +
      '<div class="lab-toolbar-actions">' +
        '<span class="lab-toolbar-count" data-ap-findings-count aria-live="polite"></span>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm lab-toolbar-btn ap-back" ' +
          'onclick="LabRouter.navigate(\'ai-agents\')">' +
          '<i data-lucide="arrow-left" class="lab-icon" aria-hidden="true"></i>К списку агентов</button>' +
      '</div></div>';
  }

  // Исходник с сервера. Ошибка и офлайн дают null: паспорт остаётся рабочим,
  // ячейка «Код агента» показывает подсказку с командой запуска сервера.
  function loadSource(agentName) {
    return fetch(API + '/api/agents/source?agent=' + encodeURIComponent(agentName), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .catch(function () { return null; });
  }

  // Статический паспорт: собран генератором из самого модуля агента, поэтому
  // открывается без сервера. Исходник сюда не входит — его отдаёт сервер.
  function load(slug) {
    if (!slug) return Promise.resolve(null);
    return fetch('data/agents/' + slug + '.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .catch(function () { return null; });
  }

  global.AgentPassport = {
    toolbar: toolbar,
    render: render,
    load: load,
    loadSource: loadSource
  };
})(window);

/**
 * architecture.js — модуль «Архитектура» (#architecture).
 *
 * Показывает, как устроен проект: слои системы сверху вниз, стек, поток данных
 * и гейты. Данные объявлены здесь, рядом с потребителем, по образцу
 * #design-system (ADR-004): статический экран не должен зависеть от сети, а
 * fetch без нужды добавил бы офлайн-риск (§9) и второй источник правды.
 *
 * Каждая запись слоя и стека несёт путь в репозитории. Эти пути проверяет
 * tools/design-baseline/registry-check.mjs (ARCH_PATH_RE): переименованный
 * каталог или файл превратит экран в красивую ложь.
 */
window.Architecture = (function () {
  'use strict';

  function escapeHtml(text) {
    if (text == null) return '';
    if (window.AlephyUtils) return AlephyUtils.escapeHtml(text);
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // ===== СЛОИ СИСТЕМЫ =====
  // Порядок сверху вниз = путь запроса пользователя. owns — за что слой отвечает,
  // path — где он лежит в репозитории.
  var LAYERS = [
    {
      name: 'Страница',
      owns: 'адрес, навигация, крошки',
      detail: 'hash-маршруты без перезагрузки; состав экранов приходит из реестра, а не из копии в роутере',
      path: 'js/router.js'
    },
    {
      name: 'Реестр модулей',
      owns: 'единственный список маршрутов лаборатории',
      detail: 'panel- и markdown-записи, группы документов, коллекции данных; сверяется гейтом со всем остальным',
      path: 'js/module-registry.js'
    },
    {
      name: 'Модули лаборатории',
      owns: 'рендеринг экранов',
      detail: 'panel-модули рисует код в switch, документы — страница по данным коллекции',
      path: 'js/page-controller.js'
    },
    {
      name: 'Данные лаборатории',
      owns: 'содержимое: словари, корни, документы',
      detail: 'JSON в data/; корпус методичек разложен на указатель и тела по файлам',
      path: 'data/'
    },
    {
      name: 'Агентный сервер',
      owns: 'единственная точка входа для ИИ',
      detail: 'HTTP на 127.0.0.1:5000; эндпоинты не дублируются по модулям',
      path: 'products/agents/server.py'
    },
    {
      name: 'Адаптеры и пайплайны',
      owns: 'обращение к моделям и обработка задач',
      detail: 'Ollama и облачные модели за адаптером; обработка — в пайплайнах, а не в разметке',
      path: 'products/agents/pipelines/'
    }
  ];
  // ===== СТЕК =====
  // Технология → зачем она в проекте → где лежит. Отсутствие фреймворка и
  // сборщика — сознательное решение, а не недосмотр.
  var STACK = [
    { layer: 'Интерфейс', tech: 'Vanilla JS (ES5)', role: 'без фреймворков и сборщиков: страница должна открываться с диска', path: 'apps/researchlab/js/' },
    { layer: 'Разметка', tech: 'Статический HTML', role: 'каркас и сайдбар; активен один модуль', path: 'apps/researchlab/index.html' },
    { layer: 'Стили', tech: 'CSS-токены', role: 'две темы из одних переменных, без дублей правил', path: 'apps/researchlab/css/tokens.css' },
    { layer: 'Иконки', tech: 'Lucide', role: 'одна библиотека глифов вместо разнобоя', path: 'js/lucide-init.js' },
    { layer: 'Данные', tech: 'JSON + fetch', role: 'отдельные файлы с локальным fallback, не инлайн', path: 'apps/researchlab/data/' },
    { layer: 'Сервер', tech: 'Python (stdlib)', role: 'агентный сервер без внешних зависимостей', path: 'products/agents/server.py' },
    { layer: 'Модели', tech: 'Ollama / облако', role: 'за адаптером: модуль не знает, где живёт модель', path: 'products/agents/ollama_adapter.py' },
    { layer: 'Сборка', tech: 'bash-контур', role: 'apps/ — источник, build/ — зеркало', path: 'products/website/tools/build.sh' },
    { layer: 'Проверки', tech: 'node:test + Playwright', role: 'расчёты без браузера, интерфейс — в smoke', path: 'apps/researchlab/tests/' },
    { layer: 'CI', tech: 'GitHub Actions', role: 'unit → smoke → гейты на каждом пуше', path: '.github/workflows/smoke.yml' }
  ];

  // ===== ПОТОК ДАННЫХ =====
  var FLOW = [
    { step: 'hash', detail: 'адрес разбирает роутер и сверяет с реестром' },
    { step: 'page-controller', detail: 'находит case модуля или источник документа' },
    { step: 'fetch(data/**)', detail: 'данные приходят отдельным файлом, не вшиты в разметку' },
    { step: 'jsonCache', detail: 'повторный вход в модуль не ходит в сеть' },
    { step: 'рендер + шапка', detail: 'содержимое пишется в контейнер, шапка — после innerHTML' }
  ];

  // ===== ГЕЙТЫ =====
  // Что проверяет и чем. Гейт, которого нет, — правило, которое однажды
  // нарушится молча.
  var GATES = [
    { what: 'Синтаксис JS', how: 'node --check', scope: 'изменённый файл' },
    { what: 'Расчёты и индексы', how: 'tests/*.test.js', scope: 'node + vm, без браузера' },
    { what: 'Реестр ↔ код ↔ данные', how: 'registry-check.mjs', scope: 'маршруты, сайдбар, коллекции, гейты' },
    { what: 'docs → data', how: 'generate-methodology-docs.py --check', scope: 'методички в lab и build' },
    { what: 'build = зеркало', how: 'check-build-sync.py', scope: 'каждый файл build/' },
    { what: 'Документация', how: 'check-docs.py check', scope: 'шапки, ссылки, навигация' },
    { what: 'Перед коммитом', how: 'check-commit.py', scope: 'индекс: конвенция, секреты, build' },
    { what: 'Интерфейс', how: 'smoke.spec.js', scope: 'Playwright в CI на каждом пуше' }
  ];
  // Канон одной клетки: номер + заголовок + ссылка на раздел документации.
  function cell(n, title, ref, body, modifier) {
    return '<section class="arch-cell arch-cell--' + modifier + '">' +
      '<header class="arch-cell-head">' +
        '<span class="arch-num" aria-hidden="true">' + n + '</span>' +
        '<h2 class="arch-cell-title">' + escapeHtml(title) + '</h2>' +
        (ref ? '<span class="arch-cell-ref">' + escapeHtml(ref) + '</span>' : '') +
      '</header>' +
      '<div class="arch-cell-body">' + body + '</div>' +
    '</section>';
  }

  function cellLayers(n) {
    var rows = LAYERS.map(function (layer, index) {
      return (
        '<li class="arch-layer">' +
          '<span class="arch-layer-num" aria-hidden="true">' + (index + 1) + '</span>' +
          '<span class="arch-layer-body">' +
            '<span class="arch-layer-head">' +
              '<b class="arch-layer-name">' + escapeHtml(layer.name) + '</b>' +
              '<code class="arch-code">' + escapeHtml(layer.path) + '</code>' +
            '</span>' +
            '<span class="arch-layer-owns">' + escapeHtml(layer.owns) + '</span>' +
            '<span class="arch-layer-detail">' + escapeHtml(layer.detail) + '</span>' +
          '</span>' +
        '</li>'
      );
    }).join('');
    return cell(
      n, 'Слои системы', 'сверху вниз = путь запроса',
      '<ol class="arch-layers">' + rows + '</ol>',
      'layers'
    );
  }

  function cellDoctrine(n) {
    return cell(
      n, 'Один источник правды', 'ARCHITECTURE.md',
      '<p class="arch-note">Список маршрутов живёт в реестре, содержимое — в data/, ' +
        'иконки — в одной библиотеке. Второе место для одного и того же факта — ' +
        'это расхождение, которое проявится позже и в другом модуле.</p>' +
      '<ul class="arch-list">' +
        '<li class="arch-item"><code class="arch-code">js/module-registry.js</code><span>маршруты, группы, коллекции</span></li>' +
        '<li class="arch-item"><code class="arch-code">data/**</code><span>содержимое документов и словарей</span></li>' +
        '<li class="arch-item"><code class="arch-code">products/agents/server.py</code><span>единственный агентный сервер</span></li>' +
      '</ul>' +
      '<p class="arch-note">Канон оформления живёт рядом: <a class="arch-link" href="#design-system">Дизайн-система</a>.</p>',
      'doctrine'
    );
  }
  function cellStack(n) {
    var rows = STACK.map(function (row) {
      return (
        '<div class="arch-stack-row">' +
          '<span class="arch-stack-layer">' + escapeHtml(row.layer) + '</span>' +
          '<span class="arch-stack-tech">' + escapeHtml(row.tech) + '</span>' +
          '<span class="arch-stack-role">' + escapeHtml(row.role) + '</span>' +
          '<code class="arch-code arch-stack-path">' + escapeHtml(row.path) + '</code>' +
        '</div>'
      );
    }).join('');
    return cell(n, 'Стек', 'чем и зачем', '<div class="arch-stack">' + rows + '</div>', 'stack');
  }

  function cellFlow(n) {
    var steps = FLOW.map(function (item, index) {
      return (
        '<li class="arch-flow-step">' +
          '<span class="arch-flow-num" aria-hidden="true">' + (index + 1) + '</span>' +
          '<span class="arch-flow-body">' +
            '<b class="arch-flow-name">' + escapeHtml(item.step) + '</b>' +
            '<span class="arch-flow-detail">' + escapeHtml(item.detail) + '</span>' +
          '</span>' +
        '</li>'
      );
    }).join('');
    return cell(
      n, 'Поток данных', 'hash → рендер',
      '<ol class="arch-flow">' + steps + '</ol>' +
        '<p class="arch-note">Сборка: <code class="arch-code">apps/researchlab</code> копируется в ' +
        '<code class="arch-code">build/</code> — правки идут только в исходники.</p>',
      'flow'
    );
  }

  function cellGates(n) {
    var rows = GATES.map(function (gate) {
      return (
        '<div class="arch-gate">' +
          '<span class="arch-gate-what">' + escapeHtml(gate.what) + '</span>' +
          '<code class="arch-code arch-gate-how">' + escapeHtml(gate.how) + '</code>' +
          '<span class="arch-gate-scope">' + escapeHtml(gate.scope) + '</span>' +
        '</div>'
      );
    }).join('');
    return cell(n, 'Гейты', 'правило без проверки нарушится', '<div class="arch-gates">' + rows + '</div>', 'gates');
  }

  function render(container) {
    var num = 0;
    function next() {
      num += 1;
      return num < 10 ? '0' + num : String(num);
    }

    container.innerHTML =
      '<div class="arch-shell">' +
        '<div class="arch-bento">' +
          cellLayers(next()) +
          cellDoctrine(next()) +
          cellStack(next()) +
          cellFlow(next()) +
          cellGates(next()) +
        '</div>' +
      '</div>';
    if (window.LabIcons && typeof LabIcons.sync === 'function') LabIcons.sync();
  }

  return { render: render, init: render };
})();
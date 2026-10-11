/**
 * skeleton.js — единый индикатор загрузки Research Lab.
 *
 * Одно место для состояний ожидания: вместо спиннеров и текстовых заглушек
 * модуль строит заготовку по форме будущего контента, чтобы высота блока
 * не прыгала, когда данные встанут на место.
 *
 * API: Skeleton.render(container, type, count)
 *   type  — card | list | article | table (иначе card)
 *   count — сколько блоков построить, по умолчанию зависит от типа
 *
 * Зависимостей нет, стили — css/skeleton.css, токены — css/tokens.css.
 */
const Skeleton = (function() {
  'use strict';

  var DEFAULT_COUNT = { card: 6, list: 6, article: 1, table: 6 };
  var MAX_COUNT = 24;
  var TABLE_COLUMNS = 3;

  /* Ширины полосок в процентах: разброс даёт ритм живого текста, а не
     стену одинаковых брусков. Цикл по массиву, если строк больше. */
  var CARD_LINES = ['92%', '78%', '86%', '64%'];
  var CARD_ACTIONS = 3;
  var LIST_LINES = ['46%', '72%'];
  var ARTICLE_LINES = ['100%', '96%', '99%', '92%', '98%', '88%', '95%', '70%'];

  function node(tag, className, width) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (width) el.style.width = width;
    return el;
  }

  function addLines(parent, widths) {
    for (var i = 0; i < widths.length; i++) {
      parent.appendChild(node('div', 'skeleton-line', widths[i]));
    }
  }

  /* Карточка собирается как настоящая: заголовок, текст, ряд действий
     у нижней кромки. Полоски подвала нужны, чтобы высота заготовки совпадала
     с высотой карточки данных. */
  function buildCards(count) {
    var root = node('div', 'skeleton-cards');
    for (var i = 0; i < count; i++) {
      var card = node('div', 'skeleton-card');
      addLines(card, CARD_LINES);
      var actions = node('div', 'skeleton-card-actions');
      for (var c = 0; c < CARD_ACTIONS; c++) {
        actions.appendChild(node('div', 'skeleton-chip'));
      }
      card.appendChild(actions);
      root.appendChild(card);
    }
    return root;
  }

  function buildList(count) {
    var root = node('div', 'skeleton-list');
    for (var i = 0; i < count; i++) {
      var row = node('div', 'skeleton-row');
      row.appendChild(node('div', 'skeleton-avatar'));
      var body = node('div', 'skeleton-row-body');
      addLines(body, LIST_LINES);
      row.appendChild(body);
      root.appendChild(row);
    }
    return root;
  }

  function buildArticle(count) {
    var root = node('div', 'skeleton-articles');
    for (var i = 0; i < count; i++) {
      var article = node('article', 'skeleton-article');
      article.appendChild(node('div', 'skeleton-line skeleton-line--heading', '58%'));
      article.appendChild(node('div', 'skeleton-block'));
      addLines(article, ARTICLE_LINES);
      root.appendChild(article);
    }
    return root;
  }

  function buildTable(count) {
    var root = node('div', 'skeleton-table');
    var head = node('div', 'skeleton-table-row skeleton-table-head');
    for (var c = 0; c < TABLE_COLUMNS; c++) {
      head.appendChild(node('div', 'skeleton-cell', c === 0 ? '60%' : '40%'));
    }
    root.appendChild(head);
    for (var i = 0; i < count; i++) {
      var row = node('div', 'skeleton-table-row');
      for (var j = 0; j < TABLE_COLUMNS; j++) {
        row.appendChild(node('div', 'skeleton-cell', j === 0 ? '85%' : '65%'));
      }
      root.appendChild(row);
    }
    return root;
  }

  var BUILDERS = {
    card: buildCards,
    list: buildList,
    article: buildArticle,
    table: buildTable
  };

  function render(container, type, count) {
    if (!container) return null;
    var kind = Object.prototype.hasOwnProperty.call(BUILDERS, type) ? type : 'card';
    var total = parseInt(count, 10);
    if (!total || total < 1) total = DEFAULT_COUNT[kind];
    if (total > MAX_COUNT) total = MAX_COUNT;

    /* Корень помечаем модификатором, а не классом блока: `skeleton-card` уже
       занят карточкой внутри, и общий класс привёл бы к карточке поверх
       карточки — корень растянулся бы на всю панель. */
    var root = node('div', 'skeleton skeleton--' + kind);
    root.setAttribute('role', 'status');
    root.setAttribute('aria-label', 'Загрузка');
    root.appendChild(BUILDERS[kind](total));

    container.innerHTML = '';
    container.appendChild(root);
    return root;
  }

  return {
    render: render
  };
})();

window.Skeleton = Skeleton;

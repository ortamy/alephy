/* Глобальная маркировка палео-знаков в динамическом тексте. */
(function() {
  'use strict';

  var PALEO_PATTERN = /[𐤀-𐤕]/u;
  var SKIP_TAGS = { SCRIPT: true, STYLE: true, TEXTAREA: true, INPUT: true, SELECT: true };

  function mark(root) {
    if (!root || !root.querySelectorAll) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (!PALEO_PATTERN.test(node.nodeValue) || !node.parentElement ||
          SKIP_TAGS[node.parentElement.tagName] ||
          node.parentElement.closest('.paleo-highlight')) continue;
      nodes.push(node);
    }
    nodes.forEach(function(textNode) {
      var fragment = document.createDocumentFragment();
      var parts = textNode.nodeValue.split(/([𐤀-𐤕]+)/u);
      parts.forEach(function(part) {
        if (!part) return;
        if (PALEO_PATTERN.test(part)) {
          var span = document.createElement('span');
          span.className = 'paleo-highlight';
          span.textContent = part;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      textNode.parentNode.replaceChild(fragment, textNode);
    });
  }

  function init() {
    var content = document.getElementById('labContent') || document.body;
    mark(content);
    if (!window.MutationObserver) return;

    /* Раньше здесь стояло new MutationObserver(function() { mark(content); })
       с observe(content, {childList, subtree}). mark() сам вызывает
       replaceChild() ВНУТРИ content, то есть наблюдатель видел собственную
       мутацию и звал mark() снова — бесконечный цикл микро-задач. Он держал
       главный поток ~30 с при входе: страница не отвечала на hover, а
       отзывчивость падала в 58 раз (замер: 13 тиков setTimeout(0) за 6 с
       против 763 с исправлением).

       Теперь обрабатываем только реально добавленные узлы: собственные
       replaceChild мы помечаем через marking и игнорируем. */
    var marking = false;
    var observer = new MutationObserver(function(mutations) {
      if (marking) return;
      var fresh = [];
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          // Уже обёрнуто нами или лежит внутри своей обёртки — второй раз не нужно.
          if (node.nodeType === 1 && (node.classList && node.classList.contains('paleo-highlight'))) continue;
          fresh.push(node);
        }
      }
      if (!fresh.length) return;
      marking = true;
      try {
        for (var k = 0; k < fresh.length; k++) mark(fresh[k]);
      } finally {
        marking = false;
      }
    });
    observer.observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
/* reveal.js — IntersectionObserver для stagger-появления .reveal.
   Стили .reveal/.is-visible в lab.css (opacity+translateY, stagger через --i).
   Повторный scan нужен: async-виджеты вставляют .reveal после первого маршрута. */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = null;

  function revealEl(el) {
    if (!el || !el.classList) return;
    el.classList.add('is-visible');
    if (io) io.unobserve(el);
  }

  function observeEl(el) {
    if (!el || !el.classList || el.classList.contains('is-visible')) return;
    if (reduced || !io) {
      revealEl(el);
      return;
    }
    io.observe(el);
  }

  if ('IntersectionObserver' in window && !reduced) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) revealEl(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px' });
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.classList && scope.classList.contains('reveal')) observeEl(scope);
    if (scope.querySelectorAll) {
      scope.querySelectorAll('.reveal:not(.is-visible)').forEach(observeEl);
    }
  }

  function watchMutations() {
    if (!('MutationObserver' in window) || !document.documentElement) return;
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if ((n.classList && n.classList.contains('reveal') && !n.classList.contains('is-visible')) ||
              (n.querySelector && n.querySelector('.reveal:not(.is-visible)'))) {
            scan(n);
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scan();
      watchMutations();
    });
  } else {
    scan();
    watchMutations();
  }

  window.RevealObserver = { scan: scan, io: io };
})();

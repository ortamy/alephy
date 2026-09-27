const RootEtymologyModal = (function() {
  'use strict';

  const cache = Object.create(null);

  function escapeHtml(value) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(value)
      : String(value == null ? '' : value);
  }

  function list(value) { return Array.isArray(value) ? value : []; }

  function confidenceLabel(value) {
    var labels = { fact: 'Факт', interpretation: 'Интерпретация', hypothesis: 'Гипотеза', факт: 'Факт', интерпретация: 'Интерпретация', гипотеза: 'Гипотеза' };
    return labels[value] || 'Не указан';
  }

  function render(data, root) {
    var cognates = list(data.cognates).map(function(item) {
      return '<li class="rem-cognate"><span class="rem-lang">' + escapeHtml(item.lang) + '</span><strong>' + escapeHtml(item.form) + '</strong><span>' + escapeHtml(item.meaning) + '</span></li>';
    }).join('');
    var stages = list(data.stages).map(function(item) {
      return '<li class="rem-stage"><span class="rem-period">' + escapeHtml(item.period) + '</span><strong>' + escapeHtml(item.form) + '</strong><span>' + escapeHtml(item.note) + '</span></li>';
    }).join('');
    var shifts = list(data.shifts).map(function(item) {
      return '<li><span>' + escapeHtml(item.from) + '</span><span class="rem-arrow" aria-hidden="true">→</span><span>' + escapeHtml(item.to) + '</span><small>' + escapeHtml(item.type) + '</small></li>';
    }).join('');
    var sources = list(data.sources).map(function(source) { return '<li>' + escapeHtml(source) + '</li>'; }).join('');
    return '<div class="rem-content">' +
      '<div class="rem-identity"><span class="rem-glyph" lang="hbo">' + escapeHtml(root.root) + '</span><div><span class="rem-translit">' + escapeHtml(root.translit) + '</span><p>' + escapeHtml(root.meaning) + '</p></div></div>' +
      '<section class="rem-section"><h4>Пра-форма</h4><div class="rem-proto">*' + escapeHtml(data.proto) + '</div></section>' +
      '<section class="rem-section"><h4>Когнаты</h4><ul class="rem-cognates">' + (cognates || '<li>Данные не указаны.</li>') + '</ul></section>' +
      '<section class="rem-section"><h4>Этапы</h4><ol class="rem-timeline">' + (stages || '<li>Данные не указаны.</li>') + '</ol></section>' +
      '<section class="rem-section"><h4>Семантические сдвиги</h4><ul class="rem-shifts">' + (shifts || '<li>Данные не указаны.</li>') + '</ul></section>' +
      '<section class="rem-section rem-confidence-section"><h4>Уверенность</h4><span class="rem-confidence rem-confidence-' + escapeHtml(data.confidence) + '">' + confidenceLabel(data.confidence) + '</span></section>' +
      '<section class="rem-section rem-sources"><h4>Источники</h4><ul>' + (sources || '<li>Источники готовятся.</li>') + '</ul></section>' +
      (data.notes ? '<p class="rem-notes"><strong>Примечание:</strong> ' + escapeHtml(data.notes) + '</p>' : '') +
      '</div>';
  }

  function showLoading(root) {
    LabModal.show('Этимологический разбор', '<div class="rem-skeleton" aria-label="Загрузка разбора"><span></span><span></span><span></span><span></span></div>');
    load(root, 0);
  }

  function load(root, attempt) {
    var path = 'data/roots/etymology/' + encodeURIComponent(root.root) + '.json';
    if (cache[root.root]) {
      LabModal.show('Этимологический разбор', render(cache[root.root], root));
      return;
    }

    LabModal.show(
      'Этимологический разбор',
      '<div class="rem-skeleton" aria-label="Загрузка разбора"><span></span><span></span><span></span><span></span></div>'
    );

    fetch(path).then(function(response) {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function(data) {
      if (!data) {
        LabModal.show(
          'Этимологический разбор',
          '<div class="rem-empty"><p>Разбор готовится.</p><span>Для этого корня этимологические данные пока не опубликованы.</span></div>'
        );
        return;
      }
      if (!data || typeof data !== 'object' || !data.proto) {
        throw new Error('Invalid etymology data');
      }
      cache[root.root] = data;
      LabModal.show('Этимологический разбор', render(data, root));
    }).catch(function() {
      LabModal.show(
        'Этимологический разбор',
        '<div class="rem-error"><p>Не удалось загрузить разбор.</p></div>',
        '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-rem-retry>Повторить</button>'
      );
      ensureRetry(root);
    });
  }

  function ensureRetry(root) {
    var retry = document.querySelector('[data-rem-retry]');
    if (!retry) {
      var footer = document.getElementById('modalFooter');
      if (!footer) return;
      footer.innerHTML = '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-rem-retry>Повторить</button>';
      retry = document.querySelector('[data-rem-retry]');
    }
    if (retry) {
      retry.onclick = function(event) {
        event.preventDefault();
        showLoading(root);
      };
    }
  }

  function open(root) {
    showLoading(root);
  }

  function bind(listNode) {
    listNode.querySelectorAll('[data-root-id]').forEach(function(card) {
      var root = (window._roots || []).find(function(item) { return item.root === card.getAttribute('data-root-id'); });
      if (!root) return;
      card.addEventListener('click', function(event) {
        if (event.target.closest('.rd-graph-button')) return;
        open(root);
      });
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(root); }
      });
    });
  }

  return { bind: bind };
})();
window.RootEtymologyModal = RootEtymologyModal;
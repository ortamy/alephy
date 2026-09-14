/**
 * religionisms.js — Модуль «Религионизмы»
 * Краткий обзор сфер и полный inline-разбор по клику.
 */
const Religionisms = (function() {
  'use strict';

  const COMPONENTS = [
    ['altar', 'Алтарь'],
    ['victim', 'Жертва'],
    ['priest', 'Жрец'],
    ['promise', 'Обетование'],
    ['ritual', 'Ритуал'],
    ['sanctuary', 'Святыня'],
    ['teaching', 'Учение'],
    ['pattern', 'Образец'],
    ['end', 'Конец пути']
  ];

  let spheres = [];
  let activeSphereId = '';
  let query = '';
  let loading = false;

  function init() {
    if (spheres.length) {
      render();
      return;
    }
    if (loading) return;
    loading = true;
    fetch('data/religionisms/religionisms.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        loading = false;
        spheres = data.spheres || [];
        render();
      })
      .catch(function(err) {
        loading = false;
        console.error(err);
        var grid = document.getElementById('rel-grid');
        if (grid) grid.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки данных о религионизмах.</div>';
      });
  }

  function filter(value) {
    query = (value || '').trim().toLowerCase();
    render();
  }

  function getFiltered() {
    if (!query) return spheres;
    return spheres.filter(function(s) {
      if (s.name.toLowerCase().indexOf(query) !== -1) return true;
      if (s.keyRoot && (
        (s.keyRoot.translit || '').toLowerCase().indexOf(query) !== -1 ||
        (s.keyRoot.meaning || '').toLowerCase().indexOf(query) !== -1
      )) return true;
      return COMPONENTS.some(function(c) {
        return (s[c[0]] || '').toLowerCase().indexOf(query) !== -1;
      });
    });
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : text;
    return d.innerHTML;
  }

  function render() {
    if (activeSphereId) {
      renderDetail();
      return;
    }
    renderGrid();
  }

  function renderGrid() {
    var grid = document.getElementById('rel-grid');
    var empty = document.getElementById('rel-empty');
    var detail = document.getElementById('rel-detail');
    if (!grid) return;
    if (detail) detail.style.display = 'none';
    grid.style.display = '';

    var list = getFiltered();

    if (list.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = list.map(function(s, idx) {
      var iconPath = 'assets/icons/32/' + (s.icon || 'ui/question.png');
      var description = getShortDescription(s);
      var roleText = getRoleText(s);

      return '<div class="lab-card rel-card" data-id="' + escapeHtml(s.id) + '" role="button" tabindex="0" aria-label="Сфера: ' + escapeHtml(s.name) + '" style="animation-delay:' + (idx * 40) + 'ms">' +
        '<div class="rel-card-icon"><img src="' + iconPath + '" alt="" onerror="this.style.display=\'none\'"></div>' +
        '<h2 class="rel-card-title">' + escapeHtml(s.name) + '</h2>' +
        '<div class="rel-card-role">' + escapeHtml(roleText) + '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.rel-card').forEach(function(card) {
      function openCard() {
        var id = card.getAttribute('data-id');
        if (id) open(id);
      }
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCard();
        }
      });
    });
  }

  function getShortDescription(sphere) {
    var description = sphere.description || (sphere.keyRoot && sphere.keyRoot.note) || sphere.promise || '';
    return truncate(description.replace(/\s+/g, ' ').trim(), 150);
  }

  function getRoleText(sphere) {
    // Роль/подзаголовок — короткая метка для карточки в стиле pl-lang-role
    if (sphere.role) return sphere.role;
    if (sphere.keyRoot) return (sphere.keyRoot.translit || '') + ' — ' + (sphere.keyRoot.meaning || '');
    return '';
  }

  function truncate(text, len) {
    text = text || '';
    return text.length > len ? text.slice(0, len).trim() + '…' : text;
  }

  function open(id) {
    activeSphereId = id;
    render();
    var container = document.getElementById('religionisms');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function close() {
    activeSphereId = '';
    render();
  }

  function renderDetail() {
    var grid = document.getElementById('rel-grid');
    var detail = document.getElementById('rel-detail');
    if (!detail) return;
    if (grid) grid.style.display = 'none';
    detail.style.display = '';

    var sphere = spheres.filter(function(item) { return item.id === activeSphereId; })[0];
    if (!sphere) {
      detail.innerHTML = '<div class="lab-alert lab-alert-error">Сфера не найдена.</div>';
      return;
    }

    var iconPath = 'assets/icons/32/' + (sphere.icon || 'ui/question.png');
    var componentsHtml = COMPONENTS.map(function(c) {
      return '<div class="rel-comp-block">' +
        '<div class="rel-comp-title">' + c[1] + '</div>' +
        '<div class="rel-comp-text">' + escapeHtml(sphere[c[0]] || '—') + '</div>' +
        '</div>';
    }).join('');
    var rootHtml = sphere.keyRoot
      ? '<div class="rel-root-block">' +
        '<div class="rel-root-title">Ключевой корень</div>' +
        '<div class="rel-root-heb" dir="rtl">' + escapeHtml(sphere.keyRoot.root) + '</div>' +
        '<div class="rel-root-translit">' + escapeHtml(sphere.keyRoot.translit) + ' — ' + escapeHtml(sphere.keyRoot.meaning) + '</div>' +
        '<div class="rel-root-note">' + escapeHtml(sphere.keyRoot.note || '') + '</div>' +
        '</div>'
      : '';

    detail.innerHTML = '<button class="lab-btn lab-btn-secondary lab-btn-sm mb-16" onclick="Religionisms.close()">Назад к сферам</button>' +
      '<div class="rel-detail-header">' +
      '<img src="' + iconPath + '" class="rel-detail-icon" alt="">' +
      '<h2>' + escapeHtml(sphere.name) + '</h2>' +
      '</div>' +
      '<div class="rel-comp-detail-grid">' + componentsHtml + '</div>' +
      rootHtml;
  }

  return {
    init: init,
    filter: filter,
    open: open,
    close: close
  };
})();

window.Religionisms = Religionisms;

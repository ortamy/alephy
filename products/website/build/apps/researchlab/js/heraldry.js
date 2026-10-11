/**
 * heraldry.js — Модуль «Гербовник»
 * 
 * Исследование государственных конструкций через палео-анализ
 * гербов, флагов и символов.
 * 
 * Маршрут: #heraldry
 * Детальный просмотр: #heraldry/<id>
 */

const Heraldry = (function() {
  'use strict';

const DATA_PATH = 'data/heraldry/heraldry.json';
  let countries = [];
  let currentCountry = null;
  let dataPromise = null;

  function dataPath() {
    // Путь считается от страницы лаборатории, а не от текущего hash-маршрута.
    return new URL(DATA_PATH, document.baseURI).href;
  }

  function text(value, fallback) {
    return escapeHtml(value == null || value === '' ? (fallback || '') : String(value));
  }

  function visualAsset(value, className, alt) {
    if (!value) return '';
    var asset = String(value);
    if (/^(https?:\/\/|\/|\.\.?\/)/i.test(asset)) {
      return '<img class="' + className + '" src="' + escapeHtml(asset) + '" alt="' + escapeHtml(alt || '') + '" loading="lazy" onerror="this.style.display=\'none\'">';
    }
    return '<span class="' + className + ' heraldry-asset-text">' + escapeHtml(asset) + '</span>';
  }

  function channelLabel() {
    return 'Искусственный канал';
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init(el) {
    var container = el || document.getElementById('heraldry');
    if (container) loadData(container);
  }

  // ===== ЗАГРУЗКА ДАННЫХ =====
  function loadData(target) {
    var container = target || document.getElementById('heraldry');
    if (!container) return;

    if (countries.length) {
      renderGrid(container);
      return Promise.resolve(countries);
    }

    if (dataPromise) return dataPromise;

    if (window.Skeleton) { Skeleton.render(container, 'card', 6); }
    else container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div></div>';

    dataPromise = fetch(dataPath())
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (!Array.isArray(data)) throw new Error('Неверный формат данных');
        countries = data.filter(function(country) { return country && country.id && country.name; });
        renderGrid(container);
        return countries;
      })
      .catch(function(error) {
        dataPromise = null;
        container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки гербовника: ' + escapeHtml(error.message) + '</div>';
        throw error;
      });

    // Не оставляем незавершённый Promise единственным состоянием модуля.
    dataPromise.catch(function() {});
    return dataPromise;
  }

  // ===== РЕНДЕРИНГ СЕТКИ КАРТОЧЕК =====
  function renderGrid(container) {
    if (!countries.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Гербовник пока пуст. Исследования добавляются.</div>';
      return;
    }

    var cards = countries.map(function(c, index) {
      var flag = c.emoji || c.flag || '';
      var paleo = c.paleo || c.hebrew || '';
      return '<article class="heraldry-card" data-id="' + escapeHtml(c.id) + '" style="animation-delay: ' + (index * 80) + 'ms">' +
        '<div class="heraldry-card-header">' +
          '<div class="heraldry-card-country">' +
            (flag && flag !== '--' ? '<span class="heraldry-card-flag" role="img" aria-label="Флаг ' + escapeHtml(c.name) + '">' + text(flag) + '</span>' : '') +
            '<h2 class="heraldry-card-title">' + text(c.name) + '</h2>' +
          '</div>' +
          (paleo ? '<div class="heraldry-card-paleo" dir="rtl" lang="he">' + text(paleo) + '</div>' : '') +
        '</div>' +
        '<div class="heraldry-card-symbol"><span class="heraldry-card-symbol-label">Символ</span> ' + text(c.symbol) + '</div>' +
        '<button class="lab-btn lab-btn-secondary lab-btn-sm heraldry-detail-btn" data-id="' + escapeHtml(c.id) + '" aria-label="Открыть разбор: ' + escapeHtml(c.name) + '">Подробнее</button>' +
      '</article>';
    }).join('');

    container.innerHTML = '<header class="section-hero">' +
        '<div class="section-hero-watermark" aria-hidden="true">𐤀 𐤁 𐤂 𐤃 𐤄 𐤅</div>' +
        '<div class="section-hero-kicker">АЛЕФИ · ГЕРБОВНИК</div>' +
        '<h1><img src="assets/icons/32/scribe/scrolls.png" class="lab-icon" alt="">Гербовник</h1>' +
        '<p class="section-hero-lead">Исследование государственных конструкций через палео-анализ гербов, флагов и символов власти.</p>' +
      '</header>' +
      '<div class="heraldry-page">' +
        '<div class="heraldry-grid" aria-label="Страны в гербовнике">' + cards + '</div>' +
      '</div>';

    // Обработчики кликов
    container.querySelectorAll('.heraldry-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        // Не открываем детали при клике на кнопку
        if (e.target.closest('.heraldry-detail-btn')) return;
        var id = this.getAttribute('data-id');
        if (id) showDetail(id);
      });
    });

    container.querySelectorAll('.heraldry-detail-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        if (id) showDetail(id);
      });
    });
  }

  // ===== ДЕТАЛЬНЫЙ ПРОСМОТР СТРАНЫ =====
  function showDetail(countryId) {
    var country = countries.filter(function(c) { return c.id === countryId; })[0];
    if (!country) {
      LabToast.show('Страна не найдена');
      return;
    }

    currentCountry = country;

    // Используем модальное окно для детального просмотра
    var html = buildDetailHTML(country);
    LabModal.show(
      '<img src="assets/icons/32/scribe/scrolls.png" class="lab-icon" alt=""> ' + escapeHtml(country.name),
      html,
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>' +
      '<button class="lab-btn lab-btn-primary lab-btn-sm" onclick="Heraldry.exportDetail()">Экспорт TXT</button>'
    );
  }

  // ===== СБОРКА HTML ДЕТАЛЬНОГО ПРОСМОТРА =====
  function buildDetailHTML(country) {
    var conclusion = country.conclusion || 'Исследование ещё не завершено.';
    var breakdown = country.symbol_paleo_breakdown || {};
    var conclusionClass = conclusion.indexOf('Искусственный') !== -1 ? 'heraldry-conclusion-channel' : 'heraldry-conclusion-flow';
    var conclusionLabel = conclusion.indexOf('Искусственный') !== -1 ? 'Искусственный канал' : 'Естественный поток';

    // Палео-разбор ключевого символа
    var symbolBreakdown = (breakdown.elements || []).map(function(el) {
      return '<div class="heraldry-breakdown-item"><strong>' + escapeHtml(el.element) + '</strong> — <span class="heraldry-paleo-text">' + escapeHtml(el.paleo) + '</span><br><span class="text-muted">' + escapeHtml(el.meaning) + '</span></div>';
    }).join('');

    // Детальный разбор всех символов
    var symbolsDetail = (country.symbols_detail || []).map(function(s) {
      return '<div class="heraldry-symbol-detail">' +
        '<div class="heraldry-symbol-detail-header">' +
          '<span class="heraldry-symbol-detail-name">' + escapeHtml(s.symbol) + '</span>' +
          '<span class="heraldry-symbol-detail-paleo" dir="rtl">' + escapeHtml(s.paleo) + '</span>' +
          '<span class="heraldry-symbol-detail-hebrew" dir="rtl">' + escapeHtml(s.hebrew) + '</span>' +
        '</div>' +
        '<div class="heraldry-symbol-detail-meaning">' + escapeHtml(s.meaning) + '</div>' +
        '<div class="heraldry-symbol-detail-function"><strong>Функция:</strong> ' + escapeHtml(s.function) + '</div>' +
      '</div>';
    }).join('');

    // Карта утрат
    var lossMapHTML = '';
    if (country.loss_map) {
      var layers = [
        { key: 'paleo_layer', label: 'Палео-слой' },
        { key: 'greek_layer', label: 'Греческий слой' },
        { key: 'latin_layer', label: 'Латинский слой' },
        { key: 'russian_layer', label: 'Русский слой' },
        { key: 'current', label: 'Текущий слой' }
      ];
      lossMapHTML = layers.map(function(layer) {
        var text = country.loss_map[layer.key];
        if (!text) return '';
        return '<div class="heraldry-loss-item"><span class="heraldry-loss-label">' + layer.label + '</span><span class="heraldry-loss-text">' + escapeHtml(text) + '</span></div>';
      }).join('');
    }

    // Инструменты
    var instrumentsHTML = (country.instruments || []).map(function(inst, index) {
      return '<div class="heraldry-instrument-card" role="listitem"><span class="heraldry-instrument-index" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span><span>' + escapeHtml(inst) + '</span></div>';
    }).join('');

    // Связанные
    var relatedHTML = (country.related || []).map(function(r) {
      return '<span class="heraldry-related-tag">' + escapeHtml(r) + '</span>';
    }).join('');

    return '<div class="heraldry-detail">' +
      '<div class="heraldry-detail-flags">' +
        visualAsset(country.flag, 'heraldry-flag-lg', 'Флаг ' + country.name) +
        visualAsset(country.coat, 'heraldry-coat-lg', 'Герб ' + country.name) +
      '</div>' +
      '<div class="heraldry-detail-names">' +
        '<div class="heraldry-detail-name">' + escapeHtml(country.name) + '</div>' +
        '<div class="heraldry-detail-symbol">Символ: ' + escapeHtml(country.symbol || '—') + '</div>' +
        '<div class="heraldry-detail-hebrew" dir="rtl">' + escapeHtml(country.hebrew) + '</div>' +
        '<div class="heraldry-detail-paleo" dir="rtl">' + escapeHtml(country.paleo) + '</div>' +
      '</div>' +

      '<div class="heraldry-detail-section">' +
        '<h3>Краткий палео-смысл</h3>' +
        '<p>' + escapeHtml(country.meaning || country.card_description || 'Описание уточняется.') + '</p>' +
      '</div>' +

      '<div class="heraldry-detail-section">' +
        '<h3>Палео-разбор ключевого символа: ' + escapeHtml(country.symbol) + '</h3>' +
        '<p class="text-muted">' + escapeHtml(breakdown.description || 'Описание символа уточняется.') + '</p>' +
        symbolBreakdown +
      '</div>' +

      '<div class="heraldry-detail-section">' +
        '<h3>Историческая функция</h3>' +
        '<p>' + escapeHtml(country.historical_function) + '</p>' +
      '</div>' +

      '<div class="heraldry-detail-section">' +
        '<h3>Текущая функция</h3>' +
        '<p>' + escapeHtml(country.current_function) + '</p>' +
      '</div>' +

      '<div class="heraldry-detail-section">' +
        '<h3>Инструменты</h3>' +
        '<div class="heraldry-instruments" role="list">' + instrumentsHTML + '</div>' +
      '</div>' +

      (lossMapHTML ? '<div class="heraldry-detail-section"><h3>Карта утрат</h3><div class="heraldry-loss-map">' + lossMapHTML + '</div></div>' : '') +

      '<div class="heraldry-detail-section">' +
        '<h3>Детальный разбор символов</h3>' +
        symbolsDetail +
      '</div>' +

      '<div class="heraldry-detail-section">' +
        '<h3>Вывод</h3>' +
        '<div class="heraldry-conclusion-big ' + conclusionClass + '">' + conclusionLabel + '</div>' +
        '<p>' + escapeHtml(conclusion) + '</p>' +
      '</div>' +

      (relatedHTML ? '<div class="heraldry-detail-section"><h3>Связанные исследования</h3><div class="heraldry-related">' + relatedHTML + '</div></div>' : '') +
    '</div>';
  }

  // ===== ЭКСПОРТ =====
  function exportDetail() {
    if (!currentCountry) return;
    var c = currentCountry;
    var lines = [
      '# Гербовник: ' + c.name,
      '',
      '**Название:** ' + c.name + ' (' + c.name_en + ')',
      '**Иврит:** ' + c.hebrew,
      '**Палео-иврит:** ' + c.paleo,
      '',
      '---',
      '',
      '## Ключевой символ: ' + c.symbol,
      '',
      (c.symbol_paleo_breakdown || {}).description || 'Описание символа уточняется.',
      ''
    ];

    ((c.symbol_paleo_breakdown || {}).elements || []).forEach(function(el) {
      lines.push('- **' + el.element + '** (' + el.paleo + '): ' + el.meaning);
    });

    lines.push('');
    lines.push('## Историческая функция');
    lines.push('');
    lines.push(c.historical_function);
    lines.push('');
    lines.push('## Текущая функция');
    lines.push('');
    lines.push(c.current_function);
    lines.push('');
    lines.push('## Инструменты');
    (c.instruments || []).forEach(function(inst) {
      lines.push('- ' + inst);
    });
    lines.push('');

    if (c.loss_map) {
      lines.push('## Карта утрат');
      lines.push('');
      if (c.loss_map.paleo_layer) lines.push('- **Палео-слой:** ' + c.loss_map.paleo_layer);
      if (c.loss_map.greek_layer) lines.push('- **Греческий слой:** ' + c.loss_map.greek_layer);
      if (c.loss_map.latin_layer) lines.push('- **Латинский слой:** ' + c.loss_map.latin_layer);
      if (c.loss_map.russian_layer) lines.push('- **Русский слой:** ' + c.loss_map.russian_layer);
      if (c.loss_map.current) lines.push('- **Текущий слой:** ' + c.loss_map.current);
      lines.push('');
    }

    lines.push('## Вывод');
    lines.push('');
    lines.push(c.conclusion || 'Исследование ещё не завершено.');

    var filename = 'gerbovnik-' + c.id + '-' + new Date().toISOString().slice(0, 10);
    LabExport.exportTXT(filename, lines.join('\n'));
  }

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    init: init,
    loadData: loadData,
    showDetail: showDetail,
    exportDetail: exportDetail,
    getCountries: function() { return countries; }
  };
})();

window.Heraldry = Heraldry;
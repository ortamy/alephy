/**
 * lucide-init.js — инициализация Lucide-иконок (vendored: js/vendor/lucide.min.js)
 *
 * Задачи:
 *  1. Рендер статических `<i data-lucide>` в шапке/сайдбаре/модалке.
 *  2. Автоповтор `lucide.createIcons()` после любых DOM-изменений
 *     (рендеры модулей, модалки, результаты поиска) через MutationObserver.
 *  3. Автодополнение иконок в кнопках `.lab-btn` без собственной иконки:
 *     подставляем Lucide-иконку по смыслу текста кнопки (правила ниже).
 *  4. Публичный API LabIcons: icon(), sync(), enhance(), valid().
 *
 * Подключён сразу после js/vendor/lucide.min.js.
 * Тематические паки assets/icons/32/... этим слоем не затрагиваются.
 */
(function (global) {
  'use strict';

  var ATTR = 'data-lucide';

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait || 80);
    };
  }

  /* Имя в PascalCase, как его запрашивает createIcons (см. Q$ в lucide UMD). */
  function pascal(name) {
    return String(name || '')
      .replace(/(\w)(\w*)(_|-|\s*)/g, function (m, c, rest) { return c.toUpperCase() + rest.toLowerCase(); });
  }

  function lucideReady() {
    return !!(global.lucide && global.lucide.createIcons && global.lucide.icons);
  }

  function iconNode(name) {
    return lucideReady() ? global.lucide.icons[pascal(name)] : null;
  }

  function validIcon(name) {
    return !!iconNode(name);
  }

  /* ===== Правила «текст кнопки → иконка». Первое совпадение побеждает. ===== */
  var TEXT_ICON_RULES = [
    [/^(закрыть|отмена)$/i, 'x'],
    [/(поиск|найти|искать|разобрать)/i, 'search'],
    [/(проверить|проверка)/i, 'check-circle'],
    [/(сгенерировать|генерировать|создать|сделать|составить)/i, 'sparkles'],
    [/(добавить|новый|новая|новое)/i, 'plus'],
    [/(сохранить|скачать|экспорт)/i, 'download'],
    [/(копировать|скопировать)/i, 'copy'],
    [/(загрузить|импорт)/i, 'upload'],
    [/(удалить|очистить|сбросить|сброс)/i, 'trash-2'],
    [/(редактировать|изменить|править)/i, 'pencil'],
    [/(запустить|запуск)/i, 'play'],
    [/(остановить|стоп)/i, 'square'],
    [/(обновить|перезапустить)/i, 'refresh-cw'],
    [/(отправить)/i, 'send'],
    [/(далее|дальше|вперёд|вперед|перейти|переход)/i, 'arrow-right'],
    [/(назад|обратно|вернуться)/i, 'arrow-left'],
    [/(открыть|открыть карту)/i, 'external-link'],
    [/(переключить|показать|скрыть|свернуть|развернуть)/i, 'eye'],
    [/(подробнее|детальн)/i, 'info'],
    [/(выбрать|интересно|нравится)/i, 'mouse-pointer-click']
  ];

  var SKIP_CLASS = /(?:^|\s)(theme-toggle|mobile-icon-link|lab-hamburger|modal-close|icon-only|no-icon|with-icon|icon-link)(?:\s|$)/i;

  function pickIcon(text) {
    var t = String(text || '').trim();
    if (t.length < 2) return null;
    for (var i = 0; i < TEXT_ICON_RULES.length; i++) {
      if (TEXT_ICON_RULES[i][0].test(t)) return TEXT_ICON_RULES[i][1];
    }
    return null;
  }

  function addIconToButton(btn) {
    if (!btn || btn.getAttribute('data-no-icon') != null) return false;
    if (btn.querySelector('svg, img, [' + ATTR + ']')) return false;
    if (SKIP_CLASS.test(String(btn.className || ''))) return false;

    var text = (btn.textContent || '').trim();
    if (text.length < 2) return false;

    var icon = pickIcon(text);
    if (!icon || !validIcon(icon)) return false;

    var i = global.document.createElement('i');
    i.setAttribute(ATTR, icon);
    i.setAttribute('aria-hidden', 'true');
    btn.insertBefore(i, btn.firstChild);
    return true;
  }

  function enhanceButtons(root) {
    if (!root || !root.querySelectorAll) return 0;
    var nodes = root.querySelectorAll('button.lab-btn, a.lab-btn');
    var added = 0;
    for (var k = 0; k < nodes.length; k++) {
      if (addIconToButton(nodes[k])) added++;
    }
    return added;
  }

  function runCreateIcons() {
    if (!lucideReady()) return;
    try { global.lucide.createIcons(); } catch (e) { /* не критично */ }

    /* Лупим цикл пересоздания: lucide сохраняет data-lucide на готовом svg,
     * из-за чего повторный createIcons() заново «заменяет» уже готовые иконки
     * (новая DOM-мутация -> observer -> createIcons -> ... -> мерцание).
     * Снимаем атрибут со сгенерированных svg: теперь createIcons() трогает
     * только свежие <i data-lucide> из разметки модулей. */
    var svgs = global.document.querySelectorAll('svg.lucide[' + ATTR + ']');
    for (var i = 0; i < svgs.length; i++) {
      svgs[i].removeAttribute(ATTR);
    }
  }

  function sync() {
    runCreateIcons();
  }

  function init() {
    if (!lucideReady()) return;

    /* enhanceButtons() вставляет <i data-lucide> в кнопки, а эта вставка
       попадает в собственный MutationObserver ниже: узел несёт маркер
       data-lucide → hasMarker → handleChange → enhanceButtons + createIcons
       снова. Повторяющийся прогон и съедал главный поток микро-задачами.

       busy снимает реакцию на собственные мутации, а пропуск <i data-lucide>
       в наблюдателе не даёт заново реагировать на уже обработанные узлы. */
    var busy = false;

    // Статичная разметка уже распарсена (скрипт в конце body).
    busy = true;
    runCreateIcons();
    enhanceButtons(global.document);
    busy = false;

    var handleChange = debounce(function () {
      if (busy) return;
      busy = true;
      try {
        enhanceButtons(global.document);
        runCreateIcons();
      } finally {
        busy = false;
      }
    }, 80);

    if (global.MutationObserver && global.document && global.document.body) {
      var observer = new MutationObserver(function (mutations) {
        if (busy) return;
        for (var i = 0; i < mutations.length; i++) {
          var nodes = mutations[i].addedNodes || [];
          for (var j = 0; j < nodes.length; j++) {
            var n = nodes[j];
            if (!n || n.nodeType !== 1) continue;
            // Сгенерированные createIcons() svg — результат нашей же работы,
            // а не новая разметка: не должны запускать повторный рендер.
            if (n.tagName && n.tagName.toLowerCase() === 'svg') continue;
            // <i data-lucide>, который вставил enhanceButtons выше: второй
            // проход по нему ничего не добавит.
            if (n.hasAttribute && n.hasAttribute(ATTR)) continue;
            // Узел мог быть заменён ещё до срабатывания колбэка.
            if (!global.document.contains(n)) continue;
            var hasMarker =
              (n.getAttribute && n.getAttribute(ATTR) != null) ||
              (n.querySelector && n.querySelector('[data-lucide], button.lab-btn, a.lab-btn'));
            if (hasMarker) { handleChange(); return; }
          }
        }
      });
      observer.observe(global.document.body, { childList: true, subtree: true });
    }

    // Страховка: после полной загрузки (все модульные рендеры).
    if (global.document.readyState === 'loading' && global.document.addEventListener) {
      global.document.addEventListener('DOMContentLoaded', function () {
        enhanceButtons(global.document);
        runCreateIcons();
      }, { once: true });
    }
    if (global.addEventListener) {
      global.addEventListener('load', function () {
        enhanceButtons(global.document);
        runCreateIcons();
      }, { once: true });
    }
  }

  global.LabIcons = {
    /** Разметка иконки для вставки в шаблоны; после вставки вызвать LabIcons.sync(). */
    icon: function (name, className) {
      if (!validIcon(name)) return '';
      var cls = className ? ' class="' + String(className) + '"' : '';
      return '<i ' + ATTR + '="' + name + '"' + cls + ' aria-hidden="true"></i>';
    },
    sync: sync,
    enhance: function (root) {
      enhanceButtons(root || global.document);
      runCreateIcons();
    },
    valid: validIcon
  };

  init();
})(window);
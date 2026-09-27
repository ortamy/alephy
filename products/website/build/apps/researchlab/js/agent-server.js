(function(window, document) {
  'use strict';

  // v3: компактный редизайн панели (#agent-server).
  // Каркас — .lab-panel/.lab-chapter (css/components/panels.css), карточки
  // действий — анатомия .gc-card (css/generators-checkers.css).
  // Новое в v3: факты процесса из /api/info, проверка подлинности сервера по
  // /api/health.service, живой предпросмотр команды, сброс к умолчанию.
  var STORAGE_KEY = 'alephy_agent_server_v2';
  var POLL_MS = 7000;
  var SERVICE_ID = 'alephy-agents';
  var DEFAULTS = {
    python: 'python',
    script: 'server.py',
    cwd: 'products/agents',
    host: '127.0.0.1',
    port: 5000,
    cors: true
  };
  var container = null;
  var state = null;
  var pollTimer = null;
  var LAST_INFO = null;
  var LAST_CHECK = null;

  function q(selector) {
    return container ? container.querySelector(selector) : null;
  }

  function escapeHtml(value) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(value)
      : String(value == null ? '' : value);
  }

  // Иконки вставляются через LabIcons (js/lucide-init.js): без lucide разметка
  // остаётся валидной, просто без глифа.
  function icon(name) {
    return window.LabIcons && window.LabIcons.icon ? window.LabIcons.icon(name) : '';
  }

  function readState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Object.assign({}, DEFAULTS, saved || {});
    } catch (error) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveState() {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function shellQuote(value) {
    return '"' + String(value || '').replace(/"/g, '\\"') + '"';
  }

  function trimValue(form, name, fallback) {
    return (form.elements[name].value || '').trim() || fallback;
  }

  function makeCommand(values) {
    var python = values.python.trim() || DEFAULTS.python;
    var script = values.script.trim() || DEFAULTS.script;
    var cwd = values.cwd.trim() || DEFAULTS.cwd;
    // Команда рассчитана на Windows cmd.exe: /d меняет и диск, && останавливает цепочку при ошибке.
    var command = 'cd /d ' + shellQuote(cwd) + ' && ' +
      (/[\\/\s]/.test(python) ? shellQuote(python) : python) + ' ' +
      shellQuote(script) + ' --host ' + shellQuote(values.host) +
      ' --port ' + String(values.port);
    if (!values.cors) command += ' --no-cors';
    return command;
  }

  function makeStartBat(values) {
    var python = values.python.trim() || DEFAULTS.python;
    var script = values.script.trim() || DEFAULTS.script;
    var cwd = values.cwd.trim() || DEFAULTS.cwd;
    return [
      '@echo off',
      'setlocal',
      'cd /d ' + shellQuote(cwd),
      'REM ALEPHY: запуск сервера агентов и Лаборатории',
      (/[\\/\s]/.test(python) ? shellQuote(python) : python) + ' ' + shellQuote(script) +
        ' --host ' + shellQuote(values.host) + ' --port ' + String(values.port) +
        (values.cors ? '' : ' --no-cors'),
      'if errorlevel 1 (',
      '  echo. & echo Ошибка запуска. Проверьте Python и зависимости.',
      '  pause',
      ')',
      'endlocal'
    ].join('\r\n');
  }

  function makeStopBat(values) {
    return [
      '@echo off',
      'setlocal',
      'set PORT=' + String(values.port),
      'REM ALEPHY: остановка сервера по порту',
      'for /f "tokens=5" %%a in (\'netstat -aon ^| findstr :%PORT% ^| findstr LISTENING\') do taskkill /f /pid %%a',
      'endlocal'
    ].join('\r\n');
  }

  function baseUrl(values) {
    var host = String(values.host || DEFAULTS.host).trim() || DEFAULTS.host;
    return 'http://' + host + ':' + String(values.port || DEFAULTS.port);
  }

  function labUrl(values) {
    return baseUrl(values) + '/apps/researchlab/';
  }

  // Нетерпимая к недописанным значениям версия формы — для живого предпросмотра.
  function formValues(form) {
    return {
      python: trimValue(form, 'python', DEFAULTS.python),
      script: trimValue(form, 'script', DEFAULTS.script),
      cwd: trimValue(form, 'cwd', DEFAULTS.cwd),
      host: form.elements.host.value.trim(),
      port: form.elements.port.value.trim(),
      cors: form.elements.cors.checked
    };
  }

  function readPreview() {
    var form = q('[data-agent-server-form]');
    if (!form) return null;
    var values = formValues(form);
    if (!values.host) values.host = DEFAULTS.host;
    if (!values.port) values.port = String(DEFAULTS.port);
    return values;
  }

  // Сохранение идёт только через валидацию: host не пустой, порт 1..65535.
  function readForm() {
    var form = q('[data-agent-server-form]');
    if (!form) return null;
    var values = formValues(form);
    var port = parseInt(values.port, 10);
    if (!values.host) {
      form.elements.host.focus();
      throw new Error('Укажите host сервера.');
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      form.elements.port.focus();
      throw new Error('Порт должен быть числом от 1 до 65535.');
    }
    values.port = port; // сохранённое состояние держит число (совместимо с v2)
    return values;
  }

  function clockTime(stamp) {
    try {
      return new Date(stamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (error) {
      return '';
    }
  }

  function formatUptime(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 60) return total + ' с';
    var minutes = Math.floor(total / 60);
    if (minutes < 60) return minutes + ' мин ' + (total % 60) + ' с';
    return Math.floor(minutes / 60) + ' ч ' + (minutes % 60) + ' мин';
  }

  function snapshot(values) {
    var copy = Object.assign({}, values);
    var port = parseInt(values.port, 10);
    if (Number.isInteger(port)) copy.port = port;
    return copy;
  }

  function renderOutput(values) {
    var command = q('[data-agent-server-command]');
    var config = q('[data-agent-server-config]');
    var endpoint = q('[data-agent-server-endpoint]');
    if (command) command.textContent = makeCommand(values);
    if (config) config.textContent = JSON.stringify(snapshot(values), null, 2);
    if (endpoint) endpoint.textContent = baseUrl(values);
  }

  // Состояние по легенде §6: ok — факт, warn — интерпретация, error — сбой.
  function setStatus(text, tone) {
    var status = q('[data-agent-server-status]');
    if (!status) return;
    status.dataset.state = tone || 'info';
    var textNode = q('[data-agent-server-status-text]');
    if (textNode) textNode.textContent = text;
  }

  // Факты процесса живут от опроса к опросу: без сервера остаются прочерки.
  function setFacts(info) {
    var facts = q('[data-agent-server-facts]');
    if (!facts) return;
    var map = {
      uptime: info && info.uptime != null ? formatUptime(info.uptime) : '—',
      pid: info && info.pid ? String(info.pid) : '—',
      python: info && info.python ? String(info.python) : '—',
      checked: LAST_CHECK ? clockTime(LAST_CHECK) : '—'
    };
    var rows = facts.querySelectorAll('[data-as-fact]');
    for (var i = 0; i < rows.length; i++) {
      var value = map[rows[i].getAttribute('data-as-fact')];
      rows[i].textContent = value == null ? '—' : value;
    }
  }

  function setSaveState(text, tone) {
    var node = q('[data-agent-server-save]');
    if (!node) return;
    node.textContent = text || '';
    node.dataset.tone = tone || '';
  }

  // Управление процессом зависит от живого сервера; primary offline — muted
  // с причиной в title (§4.4, честное состояние вместо скрытой кнопки).
  function refreshControls(online) {
    var values = state || readState();
    var base = baseUrl(values);
    var restart = q('[data-agent-server-restart]');
    var stop = q('[data-agent-server-stop]');
    var open = q('[data-agent-server-open]');
    var links = q('[data-agent-server-links]');
    if (restart) restart.disabled = !online;
    if (stop) stop.disabled = !online;
    if (open) {
      open.href = online ? labUrl(values) : '#';
      open.title = online ? 'Открыть лабораторию в новой вкладке' : 'Сначала запустите сервер';
      open.classList.toggle('is-disabled', !online);
      open.setAttribute('aria-disabled', online ? 'false' : 'true');
      // Выключенная ссылка не должна ловить Tab и Enter — как у disabled-кнопки.
      if (online) open.removeAttribute('tabindex');
      else open.setAttribute('tabindex', '-1');
    }
    if (links) {
      links.hidden = !online;
      var hrefs = { health: base + '/api/health', info: base + '/api/info' };
      var anchors = links.querySelectorAll('[data-as-link]');
      for (var i = 0; i < anchors.length; i++) {
        var href = hrefs[anchors[i].getAttribute('data-as-link')];
        if (href) anchors[i].href = href;
      }
    }
  }

  function checkServer(manual) {
    var values = state || readState();
    var base = baseUrl(values);
    if (manual) setStatus('Проверка доступности…', 'info');
    return fetch(base + '/api/health', { cache: 'no-store' })
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(health) {
        // Порт может занимать чужой процесс: раньше «Сервер работает» показывал
        // любой отвечающий сервер, поэтому подлинность сверяем по service.
        if (!health || health.service !== SERVICE_ID) {
          var foreign = new Error('foreign service');
          foreign.foreign = true;
          throw foreign;
        }
        return fetch(base + '/api/info', { cache: 'no-store' }).then(function(response) {
          return response.ok ? response.json() : {};
        });
      })
      .then(function(info) {
        LAST_INFO = info || {};
        LAST_CHECK = Date.now();
        refreshControls(true);
        setFacts(LAST_INFO);
        setStatus('Сервер работает · ' + (LAST_INFO.host || values.host) + ':' + (LAST_INFO.port || values.port), 'ok');
      })
      .catch(function(error) {
        LAST_INFO = null;
        LAST_CHECK = Date.now();
        refreshControls(false);
        setFacts(null);
        if (error && error.foreign) {
          setStatus('Порт ' + values.port + ' отвечает, но это не сервер Алефи. Смените порт или остановите чужой процесс.', 'warn');
        } else {
          setStatus('Сервер не отвечает. Первый запуск — скрипт start-server.bat в панели 03.', 'error');
        }
      });
  }

  // Единая точка сохранения: её же используют команда и .bat, чтобы артефакт
  // не собрался из устаревшего состояния.
  function applyForm(options) {
    var silent = !!(options && options.silent);
    try {
      state = readForm();
      saveState();
      renderOutput(state);
      // Отметка «не сохранено» снимается всегда: значения уже записаны.
      setSaveState('Сохранено · ' + clockTime(Date.now()), 'ok');
      if (!silent) {
        setStatus('Настройки сохранены. Проверьте доступность сервера.', 'info');
        // Новый host/port меняет адрес проверки — состояние сверяем сразу.
        checkServer(false);
      }
      return true;
    } catch (error) {
      setStatus(error.message, 'error');
      return false;
    }
  }

  function resetToDefaults() {
    if (!window.confirm('Вернуть настройки к значениям по умолчанию?')) return;
    var form = q('[data-agent-server-form]');
    if (form) {
      form.elements.python.value = DEFAULTS.python;
      form.elements.script.value = DEFAULTS.script;
      form.elements.cwd.value = DEFAULTS.cwd;
      form.elements.host.value = DEFAULTS.host;
      form.elements.port.value = String(DEFAULTS.port);
      form.elements.cors.checked = DEFAULTS.cors;
    }
    state = Object.assign({}, DEFAULTS);
    saveState();
    renderOutput(state);
    setSaveState('Умолчания восстановлены.', 'ok');
    checkServer(true);
  }

  function copyText(text, okMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        setStatus(okMessage, 'ok');
      }).catch(function() { copyTextFallback(text, okMessage); });
      return;
    }
    copyTextFallback(text, okMessage);
  }

  function copyTextFallback(text, okMessage) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setStatus(okMessage, 'ok');
    } catch (error) {
      setStatus('Не удалось скопировать. Выделите текст вручную.', 'error');
    }
    document.body.removeChild(textarea);
  }

  function downloadFile(name, content) {
    try {
      var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
      setStatus('Файл ' + name + ' создан. Дважды щёлкните его, чтобы запустить сервер.', 'ok');
    } catch (error) {
      setStatus('Не удалось создать файл: ' + error.message, 'error');
    }
  }

  function postLab(action) {
    var values = state || readState();
    var base = baseUrl(values);
    setStatus((action === 'shutdown' ? 'Остановка' : 'Перезапуск') + ' сервера…', 'info');
    return fetch(base + '/api/lab/' + action, { method: 'POST', cache: 'no-store' })
      .then(function(response) { return response.json(); })
      .then(function(body) {
        if (body && body.stopped) {
          refreshControls(false);
          setFacts(null);
          setStatus('Сервер остановлен. Для повторного запуска — start-server.bat.', 'error');
        } else if (body && body.restarted) {
          setStatus('Сервер перезапускается в новом окне. Обновите страницу через несколько секунд.', 'ok');
          setTimeout(function() { checkServer(true); }, 3000);
        } else {
          setStatus((action === 'shutdown' ? 'Остановка' : 'Перезапуск') + ' не выполнена.', 'error');
        }
      })
      .catch(function() {
        // При остановке сервер умирает раньше ответа — это нормально.
        if (action === 'shutdown') {
          refreshControls(false);
          setFacts(null);
          setStatus('Сервер остановлен.', 'error');
        } else {
          refreshControls(false);
          setFacts(null);
          setStatus('Не удалось перезапустить: сервер недоступен.', 'error');
        }
      });
  }

  // ===== Разметка =====
  // Глава панели по §4.1: номер + uppercase-лейбл + волосяная линия;
  // селектор в panels.css рассчитан именно на h2.lab-chapter-title.
  function chapter(num, title, id, extra) {
    return '<header class="lab-chapter">' +
      '<span class="lab-chapter-num" aria-hidden="true">' + num + '</span>' +
      '<h2 class="lab-chapter-title" id="' + id + '">' + escapeHtml(title) + '</h2>' +
      (extra || '') +
      '</header>';
  }

  function field(name, label, value, placeholder, attrs) {
    return '<label class="as-field"><span class="as-field-label">' + escapeHtml(label) + '</span>' +
      '<input class="lab-input" type="text" name="' + name + '" autocomplete="off" spellcheck="false"' +
      ' value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder) + '"' +
      (attrs ? ' ' + attrs : '') + '></label>';
  }

  function fact(key, label) {
    return '<div class="as-fact"><dt>' + escapeHtml(label) + '</dt>' +
      '<dd data-as-fact="' + key + '">—</dd></div>';
  }

  // Моно-фрагмент описания: имя файла читается кодом, но остаётся экранированным.
  function mono(text) {
    return '<code>' + escapeHtml(text) + '</code>';
  }

  // Карточка действия: анатомия .gc-card (генераторы), с иконкой-чипом.
  // desc приходит готовым HTML: вызывающий код собирает его из mono() и литералов,
  // поэтому внешние данные в него не попадают.
  function card(dataAttr, iconName, title, desc) {
    return '<button type="button" class="as-card" ' + dataAttr + '>' +
      '<span class="as-card-icon" aria-hidden="true">' + icon(iconName) + '</span>' +
      '<span class="as-card-body">' +
        '<span class="as-card-title">' + escapeHtml(title) + '</span>' +
        '<span class="as-card-desc">' + desc + '</span>' +
      '</span>' +
    '</button>';
  }

  function render() {
    var values = state || readState();
    // Три главы в одном потоке: состояние → настройки → первый запуск.
    var html = '<div class="as-stack">' +

          // 01 Состояние: строка статуса с управлением, факты процесса, адреса API
          '<section class="lab-panel" aria-labelledby="as-status-title">' +
            chapter('01', 'Состояние', 'as-status-title',
              '<span class="as-endpoint" title="Адрес локального API">' +
                '<code data-agent-server-endpoint>' + escapeHtml(baseUrl(values)) + '</code>' +
                '<button type="button" class="as-icon-btn" data-agent-server-copy-url' +
                ' aria-label="Копировать адрес API" title="Копировать адрес API">' + icon('copy') + '</button>' +
              '</span>') +
            '<div class="as-statusbar">' +
              '<div class="as-status" data-agent-server-status data-state="info" role="status" aria-live="polite">' +
                '<span class="as-status-dot" aria-hidden="true"></span>' +
                '<p class="as-status-text" data-agent-server-status-text>Проверка доступности…</p>' +
              '</div>' +
              '<div class="as-actions">' +
                '<button type="button" class="lab-btn lab-btn-secondary lab-btn-compact" data-agent-server-check>' +
                  icon('activity') + 'Проверить связь</button>' +
                '<button type="button" class="lab-btn lab-btn-secondary lab-btn-compact" data-agent-server-restart disabled>' +
                  icon('refresh-cw') + 'Перезапустить</button>' +
                '<button type="button" class="lab-btn lab-btn-secondary-orange lab-btn-compact" data-agent-server-stop disabled>' +
                  icon('power') + 'Остановить</button>' +
                '<a class="lab-btn lab-btn-secondary lab-btn-compact as-open is-disabled" data-agent-server-open href="#"' +
                ' aria-disabled="true" tabindex="-1">' +
                  icon('external-link') + 'Открыть лабораторию</a>' +
              '</div>' +
            '</div>' +
            '<div class="as-strip">' +
              '<dl class="as-facts" data-agent-server-facts>' +
                fact('uptime', 'Работает') + fact('pid', 'PID') +
                fact('python', 'Python') + fact('checked', 'Проверено') +
              '</dl>' +
              // Адрес /apps/researchlab/ живёт кнопкой «Открыть лабораторию»: чипа-дубля нет.
              '<nav class="as-links" data-agent-server-links hidden aria-label="Адреса сервера">' +
                '<a class="as-link" data-as-link="health" href="#" target="_blank" rel="noopener">/api/health</a>' +
                '<a class="as-link" data-as-link="info" href="#" target="_blank" rel="noopener">/api/info</a>' +
              '</nav>' +
            '</div>' +
          '</section>' +
          // 02 Настройки запуска: среда, сеть, команда, JSON и сохранение — одна форма
          '<form class="lab-panel" data-agent-server-form novalidate aria-labelledby="as-config-title">' +
            chapter('02', 'Настройки запуска', 'as-config-title') +
            '<div class="as-fields">' +
              field('python', 'Интерпретатор Python', values.python, 'python или путь к python.exe') +
              field('cwd', 'Рабочая папка', values.cwd, 'products/agents') +
              field('script', 'Скрипт сервера', values.script, 'server.py') +
              field('host', 'Адрес (host)', values.host, '127.0.0.1') +
              field('port', 'Порт', values.port, '5000', 'inputmode="numeric"') +
              // Третья ячейка второй строки — галка: сетка 3×2 без пустого места.
              '<div class="as-field as-field--check">' +
                '<span class="as-field-label">Доступ из браузера</span>' +
                '<label class="as-check"><input type="checkbox" name="cors"' + (values.cors ? ' checked' : '') + '>' +
                  '<span>Разрешить CORS</span></label>' +
              '</div>' +
            '</div>' +
            '<p class="as-hint">127.0.0.1 — только этот компьютер, 0.0.0.0 откроет порт всей локальной сети. ' +
              'CORS нужен, чтобы страницы Лаборатории читали ответы сервера.</p>' +
            '<div class="as-command">' + icon('terminal') +
              '<code data-agent-server-command></code>' +
              '<button type="button" class="as-icon-btn" data-agent-server-copy' +
              ' aria-label="Копировать команду" title="Копировать команду">' + icon('copy') + '</button>' +
            '</div>' +
            '<details class="as-details">' +
              '<summary>Конфигурация (JSON)</summary>' +
              '<div class="as-command as-command--json"><pre data-agent-server-config></pre>' +
                '<button type="button" class="as-icon-btn" data-agent-server-copy-config' +
                ' aria-label="Копировать конфигурацию" title="Копировать конфигурацию">' + icon('copy') + '</button>' +
              '</div>' +
            '</details>' +
            '<div class="as-form-actions">' +
              '<button type="submit" class="lab-btn lab-btn-primary lab-btn-compact">' + icon('save') + 'Сохранить</button>' +
              '<button type="button" class="lab-btn lab-btn-secondary lab-btn-compact" data-agent-server-reset' +
              ' title="Вернуть значения по умолчанию">' +
                icon('rotate-ccw') + 'Сбросить настройки</button>' +
              '<span class="as-save-state" data-agent-server-save role="status" aria-live="polite"></span>' +
            '</div>' +
          '</form>' +

          // 03 Первый запуск: .bat-файлы собираются из значений панели 02
          '<section class="lab-panel" aria-labelledby="as-first-title">' +
            chapter('03', 'Первый запуск', 'as-first-title') +
            '<div class="as-cards">' +
              card('data-agent-server-start-download', 'download', 'Скачать скрипт запуска', mono('start-server.bat') + ' — запуск одним щелчком') +
              card('data-agent-server-stop-download', 'power', 'Скачать скрипт остановки', mono('stop-server.bat') + ' — остановить процесс') +
              card('data-agent-server-copy-command', 'terminal', 'Скопировать команду', 'запуск из терминала вручную') +
            '</div>' +
            '<p class="as-note">Браузер не запускает процессы: сохраните настройки панели 02, ' +
              'скачайте <code>start-server.bat</code> и щёлкните по нему.</p>' +
          '</section>' +
      '</div>';

    container.innerHTML = html;
    renderOutput(values);
    setFacts(null);
    refreshControls(false);
    bind();
    checkServer(false);
  }

  function bind() {
    var form = q('[data-agent-server-form]');
    if (form) {
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        applyForm();
      });
      // Живой предпросмотр: команда, JSON и адрес идут за полями, но состояние
      // не перезаписывается, пока не нажато «Сохранить».
      var preview = function() {
        var values = readPreview();
        if (!values) return;
        renderOutput(values);
        setSaveState('Не сохранено', 'warn');
      };
      form.addEventListener('input', preview);
      form.addEventListener('change', preview);
    }

    var check = q('[data-agent-server-check]');
    if (check) check.addEventListener('click', function() { checkServer(true); });

    var reset = q('[data-agent-server-reset]');
    if (reset) reset.addEventListener('click', resetToDefaults);

    // Команда копируется и из строки панели 05, и из карточки панели 02.
    ['[data-agent-server-copy]', '[data-agent-server-copy-command]'].forEach(function(selector) {
      var button = q(selector);
      if (!button) return;
      button.addEventListener('click', function() {
        if (applyForm({ silent: true })) copyText(makeCommand(state), 'Команда скопирована в буфер обмена.');
      });
    });

    var copyConfig = q('[data-agent-server-copy-config]');
    if (copyConfig) copyConfig.addEventListener('click', function() {
      if (applyForm({ silent: true })) copyText(JSON.stringify(snapshot(state), null, 2), 'Конфигурация скопирована.');
    });

    var copyUrl = q('[data-agent-server-copy-url]');
    if (copyUrl) copyUrl.addEventListener('click', function() {
      copyText(baseUrl(state || readState()), 'Адрес API скопирован.');
    });

    // Артефакты собираются из актуальных значений формы (applyForm), иначе
    // .bat отправит сервер по устаревшим host/port.
    var startDownload = q('[data-agent-server-start-download]');
    if (startDownload) startDownload.addEventListener('click', function() {
      if (applyForm({ silent: true })) downloadFile('start-server.bat', makeStartBat(state));
    });

    var stopDownload = q('[data-agent-server-stop-download]');
    if (stopDownload) stopDownload.addEventListener('click', function() {
      if (applyForm({ silent: true })) downloadFile('stop-server.bat', makeStopBat(state));
    });

    var stop = q('[data-agent-server-stop]');
    if (stop) stop.addEventListener('click', function() {
      if (window.confirm('Остановить локальный сервер агентов (порт ' + (state || readState()).port + ')?')) {
        postLab('shutdown');
      }
    });

    var restart = q('[data-agent-server-restart]');
    if (restart) restart.addEventListener('click', function() {
      if (window.confirm('Перезапустить сервер в новом окне? Текущий процесс завершится.')) {
        postLab('restart');
      }
    });
  }

  function close() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (container) applyForm({ silent: true });
    if (window.LabRouter) window.LabRouter.navigate('ai-agents');
  }

  function open(target) {
    container = target || document.getElementById('agent-server');
    if (!container) return;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    state = readState();
    render();
    pollTimer = setInterval(function() {
      if (container && container.isConnected) checkServer(false);
    }, POLL_MS);
  }

  window.AgentServer = { open: open, close: close };
})(window, document);

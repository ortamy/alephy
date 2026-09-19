/**
 * workbench.js — «Мастерская» (#workbench): визуальный хаб действий.
 *
 * Экраны (внутри одного модуля, как #pipelines):
 *   #workbench                  — хаб: каталог конвейеров + мои проекты
 *   #workbench/run/<id>         — запуск: форма из конфига → смета → прогресс
 *   #workbench/project/<runId>  — проект: результат во вьювере pipeline.viewer
 *
 * Реестр конвейеров и движки — в workbench-pipelines.js.
 * Метаданные проектов — localStorage (alephy.workbench.projects).
 * Результаты (большие) — только в памяти + «Скачать»; в localStorage мета.
 */
const Workbench = (function() {
  'use strict';

  /* Плюрализация из общего источника js/plural.js. */
  function labChars(n) {
    return window.LabPluralWord ? LabPluralWord(n, 'знак', 'знака', 'знаков') : 'знаков';
  }

  var STORE_KEY = 'alephy.workbench.projects';
  var AGENT_API_URL = 'http://127.0.0.1:5000';

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  // ===== ХРАНИЛИЩЕ МЕТАДАННЫХ (localStorage) =====
  function loadProjects() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function saveProjects(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* переполнение — мета важнее */ }
  }

  function getProject(runId) {
    return loadProjects().filter(function(p) { return p.runId === runId; })[0] || null;
  }

  function upsertProject(meta) {
    var list = loadProjects();
    var index = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].runId === meta.runId) { index = i; break; } }
    if (index === -1) list.unshift(meta); else list[index] = meta;
    saveProjects(list);
    return meta;
  }

  function removeProject(runId) {
    saveProjects(loadProjects().filter(function(p) { return p.runId !== runId; }));
  }

  // ===== РАНТАЙМ (в памяти; переживёт переходы маршрутов, не перезагрузку) =====
  var runtime = {
    results: {},  // runId -> результат движка
    states: {},   // runId -> { statuses:[], percent, log:[] } для живого прогресса
    live: {},     // runId -> { signal } активного запуска
    form: {}      // форма запуска: fileText/fileChars/fileName
  };

  function statusLabel(status) {
    return { running: 'В работе', done: 'Готово', cancelled: 'Отменён', error: 'Ошибка' }[status] || status;
  }

  function formatDate(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '—'; }
  }

  // ===== ТИТУЛЫ ДЛЯ КРОШЕК (router.js → routeTitle) =====
  function routeTitle(route) {
    var parts = route.split('/');
    if (parts[0] !== 'workbench') return '';
    if (parts.length === 1) return 'Мастерская';
    if (parts[1] === 'run') {
      if (!parts[2]) return 'Запуск конвейера';
      var pipeline = window.WorkbenchPipelines && WorkbenchPipelines.get(parts[2]);
      return pipeline ? pipeline.title : 'Запуск конвейера';
    }
    if (parts[1] === 'project') {
      var meta = parts[2] ? getProject(parts[2]) : null;
      return meta ? meta.name : 'Проект';
    }
    return '';
  }

  // ===== МАРШРУТИЗАЦИЯ ЭКРАНОВ =====
  // Повторные вызовы handleHash (init + load) не должны пересоздавать экран
  // и стирать введённые данные — рендерим только при смене маршрута.
  var lastRouteKey = null;

  function applyRoute(parsed) {
    var container = document.getElementById('workbench');
    if (!container) return;
    var segments = (parsed && parsed.segments) || [];
    var params = (parsed && parsed.params) || {};
    var routeKey = (parsed && parsed.raw) || segments.join('/');
    if (routeKey === lastRouteKey && container.innerHTML.trim() !== '') return;
    lastRouteKey = routeKey;
    var view = segments[1];
    if (view === 'run' && segments[2]) renderRun(container, segments[2], params);
    else if (view === 'project' && segments[2]) renderProject(container, segments[2]);
    else renderHub(container);
  }

  // ===== ЭКРАН 1: ХАБ =====
  function renderHub(container) {
    container._labHeroOverride = null;
    var pipelines = window.WorkbenchPipelines ? WorkbenchPipelines.list() : [];
    var projects = loadProjects();

    var cards = pipelines.map(function(pipeline) {
      return '' +
        '<article class="wb-pipeline-card">' +
          '<header class="wb-pipeline-head">' +
            '<img class="wb-pipeline-icon" src="assets/icons/32/' + esc(pipeline.icon) + '" alt="" aria-hidden="true">' +
            '<h3 class="wb-pipeline-title">' + esc(pipeline.title) + '</h3>' +
          '</header>' +
          '<p class="wb-pipeline-desc">' + esc(pipeline.description) + '</p>' +
          '<div class="wb-tags" aria-label="Входы конвейера">' +
            pipeline.tags.map(function(tag) { return '<span class="wb-tag">' + esc(tag) + '</span>'; }).join('') +
          '</div>' +
          '<footer class="wb-pipeline-foot">' +
            '<span class="wb-steps-hint">' + pipeline.steps.length + ' этапов</span>' +
            '<a class="lab-btn lab-btn-primary lab-btn-sm" href="#workbench/run/' + esc(pipeline.id) + '">Запустить</a>' +
          '</footer>' +
        '</article>';
    }).join('');

    var rows = projects.map(projectRowHtml).join('');
    var projectsHtml = projects.length
      ? '<div class="wb-projects">' + rows + '</div>'
      : '<div class="lab-alert lab-alert-info">Пока пусто. Запустите конвейер — проект появится здесь.</div>';

    container.innerHTML =
      '<div class="wb-hub">' +
        '<section class="wb-pipeline-section" aria-labelledby="wb-pipelines-heading">' +
          '<h2 class="wb-section-title" id="wb-pipelines-heading">Конвейеры</h2>' +
          '<p class="wb-section-sub">Подключаемые цепочки действий: вход → смета → этапы → результат.</p>' +
          '<div class="wb-pipeline-grid">' + cards + '</div>' +
        '</section>' +
        '<section class="wb-project-section" aria-labelledby="wb-projects-heading">' +
          '<div class="wb-section-head">' +
            '<h2 class="wb-section-title" id="wb-projects-heading">Мои проекты</h2>' +
            (projects.length ? '<span class="wb-count">' + projects.length + '</span>' : '') +
          '</div>' +
          projectsHtml +
        '</section>' +
      '</div>';

    bindHubActions(container);
  }

  function projectRowHtml(meta) {
    var pipeline = window.WorkbenchPipelines ? WorkbenchPipelines.get(meta.pipelineId) : null;
    var pipelineTitle = pipeline ? pipeline.title : meta.pipelineId;
    var actions = '';
    if (meta.status === 'running') {
      actions += '<a class="lab-btn lab-btn-primary lab-btn-sm" href="#workbench/run/' + esc(meta.pipelineId) + '?run=' + esc(meta.runId) + '">Продолжить</a>';
    } else if (meta.status === 'done') {
      actions += '<a class="lab-btn lab-btn-secondary lab-btn-sm" href="#workbench/project/' + esc(meta.runId) + '">Открыть</a>';
      if (runtime.results[meta.runId]) {
        actions += '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="export" data-runid="' + esc(meta.runId) + '">Экспорт</button>';
      }
    }
    actions += '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="delete" data-runid="' + esc(meta.runId) + '">Удалить</button>';

    var percent = meta.progress ? meta.progress.percent : (meta.status === 'done' ? 100 : 0);

    return '' +
      '<article class="wb-project-row" data-runid="' + esc(meta.runId) + '">' +
        '<div class="wb-project-main">' +
          '<a class="wb-project-name" href="#workbench/project/' + esc(meta.runId) + '">' + esc(meta.name) + '</a>' +
          '<div class="wb-project-meta">' + esc(pipelineTitle) + ' · обновлено ' + esc(formatDate(meta.updatedAt)) + '</div>' +
        '</div>' +
        '<div class="wb-project-status">' +
          '<span class="wb-badge is-' + esc(meta.status) + '">' + esc(statusLabel(meta.status)) + '</span>' +
          '<div class="wb-miniprogress" aria-hidden="true"><i style="width:' + percent + '%"></i></div>' +
        '</div>' +
        '<div class="wb-project-actions">' + actions + '</div>' +
      '</article>';
  }

  function bindHubActions(container) {
    container.addEventListener('click', function(event) {
      var target = event.target.closest('[data-wb-action]');
      if (!target) return;
      var runId = target.getAttribute('data-runid');
      if (target.getAttribute('data-wb-action') === 'delete') {
        if (window.confirm('Удалить проект? Метаданные будут стёрты.')) {
          removeProject(runId);
          delete runtime.results[runId];
          delete runtime.states[runId];
          delete runtime.live[runId];
          renderHub(container);
        }
      } else if (target.getAttribute('data-wb-action') === 'export') {
        openExportModal(runId);
      }
    });
  }

  // ===== ЭКРАН 2: ЗАПУСК =====
  function renderRun(container, pipelineId, params) {
    var pipeline = window.WorkbenchPipelines ? WorkbenchPipelines.get(pipelineId) : null;
    if (!pipeline) {
      container._labHeroOverride = null;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Конвейер «' + esc(pipelineId) + '» не найден.</div>' +
        '<p><a class="lab-btn lab-btn-secondary lab-btn-sm" href="#workbench">К каталогу конвейеров</a></p>';
      return;
    }

    container._labHeroOverride = { title: pipeline.title, subtitle: pipeline.description, meta: pipeline.tags.slice() };

    var resumeRunId = params && params.run;
    var meta = resumeRunId ? getProject(resumeRunId) : null;
    if (resumeRunId && !meta) resumeRunId = null;

    // Прерванный или завершённый запуск — показываем монитор вместо пустой формы.
    if (resumeRunId && (meta.status !== 'running' || runtime.states[resumeRunId])) {
      runtime.form = {};
      container.innerHTML = runMonitorHtml(pipeline, meta, resumeRunId);
      syncMonitor(resumeRunId);
      bindRunActions(container, pipeline, resumeRunId);
      return;
    }

    runtime.form = { fileText: '', fileChars: 0, fileName: '' };
    container.innerHTML = runFormHtml(pipeline, resumeRunId, meta);
    bindRunForm(container, pipeline, resumeRunId, meta);
  }

  // Генерация полей ВХОДА из inputs конфига.
  function inputFieldHtml(field) {
    var id = 'wb-field-' + field.key;
    var required = field.required ? ' aria-required="true" data-wb-required="1"' : '';
    var hint = field.hint ? '<small class="wb-field-hint">' + esc(field.hint) + '</small>' : '';
    if (field.type === 'file') {
      return '' +
        '<div class="wb-field">' +
          '<label class="wb-label" for="' + id + '">' + esc(field.label) + '</label>' +
          '<input type="file" class="lab-input wb-input-file" id="' + id + '" name="' + esc(field.key) + '"' +
            (field.accept ? ' accept="' + esc(field.accept) + '"' : '') + required + '>' +
          hint +
          '<div class="wb-file-status" id="' + id + '-status" role="status">Файл не выбран</div>' +
           '<div class="wb-file-progress" id="' + id + '-progress" hidden>' +
             '<div class="wb-file-progress-track" role="progressbar" aria-label="Чтение файла" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
               '<span class="wb-file-progress-fill"></span>' +
             '</div>' +
             '<span class="wb-file-progress-label">0%</span>' +
           '</div>' +
        '</div>';
    }
    if (field.type === 'text') {
      return '' +
        '<div class="wb-field">' +
          '<label class="wb-label" for="' + id + '">' + esc(field.label) + '</label>' +
          '<textarea class="lab-textarea" id="' + id + '" name="' + esc(field.key) + '" rows="6"' + required +
            (field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') + '></textarea>' +
          hint +
        '</div>';
    }
    if (field.type === 'word') {
      return '' +
        '<div class="wb-field">' +
          '<label class="wb-label" for="' + id + '">' + esc(field.label) + '</label>' +
          '<input type="text" class="lab-input" id="' + id + '" name="' + esc(field.key) + '"' + required +
            (field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') + '>' +
          hint +
        '</div>';
    }
    if (field.type === 'select') {
      var options = (field.options || []).map(function(option) {
        var selected = (option.value === field.default) ? ' selected' : '';
        return '<option value="' + esc(option.value) + '"' + selected + '>' + esc(option.label) + '</option>';
      }).join('');
      return '' +
        '<div class="wb-field">' +
          '<label class="wb-label" for="' + id + '">' + esc(field.label) + '</label>' +
          '<select class="lab-input" id="' + id + '" name="' + esc(field.key) + '"' + required + '>' + options + '</select>' +
          hint +
        '</div>';
    }
    return '';
  }

  // Генерация тумблеров из options конфига.
  function optionFieldHtml(option) {
    var id = 'wb-option-' + option.key;
    return '' +
      '<div class="wb-field wb-toggle">' +
        '<input type="checkbox" id="' + id + '" name="' + esc(option.key) + '"' + (option.default ? ' checked' : '') + '>' +
        '<label for="' + id + '">' + esc(option.label) + (option.hint ? ' <small class="wb-field-hint">' + esc(option.hint) + '</small>' : '') + '</label>' +
      '</div>';
  }

  function runFormHtml(pipeline, resumeRunId, meta) {
    var inputs = pipeline.inputs.map(inputFieldHtml).join('');
    var options = pipeline.options.map(optionFieldHtml).join('');
    var optionsBlock = options ? '<h3 class="wb-group-title">Опции</h3>' + options : '';
    var heading = resumeRunId && meta
      ? 'Продолжение запуска «' + esc(meta.name) + '» — проверьте вход и запустите заново (mock-движок).'
      : '';
    return '' +
      '<div class="wb-run">' +
        (heading ? '<div class="lab-alert lab-alert-info">' + heading + '</div>' : '') +
        '<form id="wb-run-form" class="wb-form" novalidate>' +
          '<h3 class="wb-group-title">Вход</h3>' +
          inputs +
          optionsBlock +
          '<section class="wb-estimate" aria-label="Смета запуска">' +
            '<h3 class="wb-group-title">Смета</h3>' +
            '<div id="wb-estimate-body" class="wb-estimate-body">Размер входа не измерен — нажмите «Оценить».</div>' +
          '</section>' +
          '<div class="wb-run-actions">' +
            '<button type="button" class="lab-btn lab-btn-secondary" id="wb-estimate-btn">Оценить</button>' +
            '<button type="submit" class="lab-btn lab-btn-primary" id="wb-start-btn">Старт</button>' +
            '<a class="lab-btn lab-btn-secondary lab-btn-sm" href="#workbench">Отмена</a>' +
          '</div>' +
          '<div id="wb-form-status" class="wb-form-status" role="status"></div>' +
        '</form>' +
        '<section id="wb-monitor" class="wb-monitor" hidden aria-label="Прогресс запуска"></section>' +
      '</div>';
  }

  // Сбор значений формы и объёма входа.
  function collectForm(pipeline) {
    var values = {};
    pipeline.inputs.forEach(function(field) {
      if (field.type === 'file') return;
      var el = document.getElementById('wb-field-' + field.key);
      if (el) values[field.key] = el.value;
    });
    pipeline.options.forEach(function(option) {
      var el = document.getElementById('wb-option-' + option.key);
      if (el) values[option.key] = !!el.checked;
    });
    var chars = 0;
    pipeline.inputs.forEach(function(field) {
      if (field.type === 'file') chars += runtime.form.fileChars || 0;
      else if (field.type === 'text' || field.type === 'word') {
        var el = document.getElementById('wb-field-' + field.key);
        if (el) chars += el.value.length;
      }
    });
    return { values: values, chars: chars };
  }

  // Привязка формы запуска: чтение файла, смета, старт.
  function bindRunForm(container, pipeline, resumeRunId, meta) {
    var form = document.getElementById('wb-run-form');
    if (!form) return;

    pipeline.inputs.forEach(function(field) {
      if (field.type !== 'file') return;
      var input = document.getElementById('wb-field-' + field.key);
      if (!input) return;
      input.addEventListener('change', function() {
        var file = input.files && input.files[0];
        var status = document.getElementById('wb-field-' + field.key + '-status');
        var progress = document.getElementById('wb-field-' + field.key + '-progress');
        var progressTrack = progress && progress.querySelector('.wb-file-progress-track');
        var progressFill = progress && progress.querySelector('.wb-file-progress-fill');
        var progressLabel = progress && progress.querySelector('.wb-file-progress-label');
        function setProgress(value, label) {
          if (!progress) return;
          progress.hidden = false;
          if (progressTrack) progressTrack.setAttribute('aria-valuenow', value);
          if (progressFill) progressFill.style.width = value + '%';
          if (progressLabel) progressLabel.textContent = label || (value + '%');
        }
        if (!file) {
          runtime.form = { fileText: '', fileChars: 0, fileName: '' };
          if (status) status.textContent = 'Файл не выбран';
          if (progress) progress.hidden = true;
          return;
        }
        runtime.form = { fileText: '', fileChars: 0, fileName: file.name };
        if (status) status.textContent = 'Читаю «' + file.name + '»…';
        if (/\.pdf$/i.test(file.name)) {
          setProgress(0, 'Загрузка 0%');
          var request = new XMLHttpRequest();
          request.open('POST', AGENT_API_URL + '/api/workbench/pdf-text', true);
          request.upload.onprogress = function(event) {
            if (!event.lengthComputable) return;
            setProgress(Math.min(80, Math.round(event.loaded / event.total * 80)), 'Загрузка ' + Math.round(event.loaded / event.total * 100) + '%');
          };
          request.upload.onload = function() {
            setProgress(85, 'Извлекаю текстовый слой…');
          };
          request.onload = function() {
            var payload = {};
            try { payload = request.responseText ? JSON.parse(request.responseText) : {}; } catch (error) {}
            if (request.status < 200 || request.status >= 300) {
              runtime.form.fileText = '';
              runtime.form.fileChars = 0;
              if (status) status.textContent = 'Не удалось извлечь текст из PDF: ' + (payload.error || ('сервер вернул HTTP ' + request.status + '. Запустите сервер агентов на порту 5000.'));
              setProgress(0, 'Ошибка');
              return;
            }
            if (!payload.text) {
              runtime.form.fileText = '';
              runtime.form.fileChars = 0;
              if (status) status.textContent = 'PDF не содержит доступного текстового слоя.';
              setProgress(0, 'Нет текста');
              return;
            }
              runtime.form.fileText = String(payload.text || '');
              runtime.form.fileChars = runtime.form.fileText.length;
              if (status) status.textContent = '«' + file.name + '» — ' + runtime.form.fileChars + ' ' + labChars(runtime.form.fileChars) + ', ' + (payload.pages || 0) + ' стр.';
              setProgress(100, 'Прочитано ' + runtime.form.fileChars + ' ' + labChars(runtime.form.fileChars));
          };
          request.onerror = function() {
            runtime.form.fileText = '';
            runtime.form.fileChars = 0;
            if (status) status.textContent = 'Не удалось связаться с сервером извлечения PDF. Запустите products/agents/server.py на порту 5000.';
            setProgress(0, 'Сервер недоступен');
          };
          var formData = new FormData();
          formData.append('file', file);
          request.send(formData);
          return;
        }
        var reader = new FileReader();
        reader.onload = function() {
          runtime.form.fileText = String(reader.result || '');
          runtime.form.fileChars = runtime.form.fileText.length;
          runtime.form.fileName = file.name;
          if (status) status.textContent = '«' + file.name + '» — ' + runtime.form.fileChars + ' ' + labChars(runtime.form.fileChars);
        };
        reader.onerror = function() {
          if (status) status.textContent = 'Не удалось прочитать файл.';
        };
        reader.readAsText(file);
      });
    });

    document.getElementById('wb-estimate-btn').addEventListener('click', function() {
      var collected = collectForm(pipeline);
      showEstimate(pipeline, collected.chars);
    });

    form.addEventListener('submit', function(event) {
      event.preventDefault();
      var status = document.getElementById('wb-form-status');
      var missing = pipeline.inputs.filter(function(field) {
        if (!field.required) return false;
        if (field.type === 'file') return !runtime.form.fileText;
        var el = document.getElementById('wb-field-' + field.key);
        return !el || !el.value.trim();
      });
      if (missing.length) {
        if (status) status.textContent = 'Заполните вход: ' + missing.map(function(f) { return f.label; }).join(', ') + '.';
        return;
      }
      var collected = collectForm(pipeline);
      showEstimate(pipeline, collected.chars);
      var inputName = runtime.form.fileName || pipeline.title;
      startRun(container, pipeline, {
        runId: resumeRunId || ('wb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)),
        values: collected.values,
        inputText: collected.chars ? inputTextFor(pipeline) : '',
        inputName: inputName,
        chars: collected.chars,
        resumeMeta: resumeRunId ? meta : null
      });
    });

    if (resumeRunId && meta && meta.progress && meta.progress.chars) {
      showEstimate(pipeline, meta.progress.chars);
    }
  }

  function inputTextFor(pipeline) {
    var parts = [];
    pipeline.inputs.forEach(function(field) {
      if (field.type === 'file') { if (runtime.form.fileText) parts.push(runtime.form.fileText); return; }
      // Текст входа — только из полей текста; селекты и тумблеры в текст не идут.
      if (field.type !== 'text' && field.type !== 'word') return;
      var el = document.getElementById('wb-field-' + field.key);
      if (el && el.value) parts.push(el.value);
    });
    return parts.join('\n\n');
  }

  // Смета: токены ≈ chars/4, цена из констант конфига.
  function showEstimate(pipeline, chars) {
    var body = document.getElementById('wb-estimate-body');
    if (!body) return;
    if (!chars) {
      body.textContent = 'Вход пуст — смета нулевая.';
      return;
    }
    var estimate = WorkbenchPipelines.estimate(pipeline, chars);
    body.innerHTML =
      '<ul class="wb-estimate-list">' +
        '<li>Вход: <b>' + estimate.chars + '</b> ' + labChars(estimate.chars) + '</li>' +
        '<li>Токены (≈знаки/4): <b>' + estimate.tokens + '</b></li>' +
        '<li>Стоимость: <b>' + estimate.price + ' ' + esc(estimate.currency) + '</b></li>' +
        '<li>Время (mock): <b>~' + Math.round(estimate.seconds) + ' с</b></li>' +
      '</ul>';
  }

  // Запуск движка: мета проекта, живой прогресс, отмена, завершение.
  function startRun(container, pipeline, spec) {
    var runId = spec.runId;
    var now = Date.now();
    var meta = spec.resumeMeta || {
      runId: runId,
      pipelineId: pipeline.id,
      name: (spec.inputName || pipeline.title).replace(/\.(txt|md)$/i, ''),
      status: 'running',
      progress: { stepIndex: -1, percent: 0, chars: spec.chars },
      input: { name: spec.inputName, chars: spec.chars },
      options: spec.values,
      createdAt: now,
      updatedAt: now
    };
    meta.status = 'running';
    meta.steps = pipeline.steps.slice();
    meta.progress = { stepIndex: -1, percent: 0, chars: spec.chars };
    meta.updatedAt = now;
    upsertProject(meta);

    runtime.states[runId] = {
      statuses: pipeline.steps.map(function() { return 'pending'; }),
      percent: 0,
      log: ['[' + formatDate(now) + '] Запуск конвейера «' + pipeline.title + '»']
    };
    runtime.results[runId] = null;
    var signal = { aborted: false };
    runtime.live[runId] = { signal: signal };

    // Форма уходит, появляется монитор прогресса.
    var formEl = document.getElementById('wb-run-form');
    if (formEl) formEl.hidden = true;
    var monitor = document.getElementById('wb-monitor');
    if (monitor) monitor.hidden = false;
    monitor.innerHTML = runMonitorBodyHtml(pipeline, meta, runId, true);
    bindRunActions(container, pipeline, runId);
    syncMonitor(runId);

    var context = {
      runId: runId,
      pipeline: pipeline,
      values: spec.values,
      inputText: spec.inputText,
      inputMeta: { name: spec.inputName, chars: spec.chars },
      signal: signal
    };

    var engineRef = WorkbenchPipelines.engine(pipeline.engine);
    engineRef.run(context, function(update) {
      handleProgress(runId, pipeline, update);
    }).then(function(result) {
      runtime.results[runId] = result;
      delete runtime.live[runId];
      meta.status = 'done';
      meta.progress = { stepIndex: pipeline.steps.length - 1, percent: 100, chars: spec.chars };
      meta.updatedAt = Date.now();
      upsertProject(meta);
      runtime.states[runId].log.push('[' + formatDate(Date.now()) + '] Готово. Открываю проект…');
      syncMonitor(runId);
      // Сквозной поток: форма → смета → прогресс → проект → вьювер.
      setTimeout(function() {
        if (window.LabRouter) LabRouter.navigate('workbench', ['project', runId]);
      }, 900);
    }).catch(function(error) {
      delete runtime.live[runId];
      meta.status = error && error.cancelled ? 'cancelled' : 'error';
      meta.updatedAt = Date.now();
      upsertProject(meta);
      var state = runtime.states[runId];
      if (state) state.log.push('[' + formatDate(Date.now()) + '] ' + (error && error.cancelled ? 'Запуск отменён.' : 'Ошибка: ' + error.message));
      syncMonitor(runId);
    });
  }

  // ===== МОНИТОР ПРОГРЕССА =====
  function runMonitorHtml(pipeline, meta, runId) {
    return '<div class="wb-run"><section id="wb-monitor" class="wb-monitor" aria-label="Прогресс запуска">' +
      runMonitorBodyHtml(pipeline, meta, runId, false) + '</section></div>';
  }

  function runMonitorBodyHtml(pipeline, meta, runId, cancellable) {
    var steps = pipeline.steps.map(function(step, index) {
      var status = (runtime.states[runId] && runtime.states[runId].statuses[index]) || 'pending';
      return '<li class="wb-step is-' + status + '" data-step="' + index + '">' +
        '<span class="wb-step-mark" aria-hidden="true">' + (status === 'done' ? '✓' : (status === 'active' ? '●' : '○')) + '</span>' +
        esc(step) + '</li>';
    }).join('');
    var percent = runtime.states[runId] ? runtime.states[runId].percent : (meta.progress ? meta.progress.percent : 0);
    var actions = '';
    if (cancellable && meta.status === 'running' && runtime.live[runId]) {
      actions = '<button type="button" class="lab-btn lab-btn-secondary" data-wb-action="cancel" data-runid="' + esc(runId) + '">Отмена</button>';
    } else if (meta.status === 'running') {
      actions = '<div class="lab-alert lab-alert-info">Сессия прервана перезагрузкой. Продолжить — перезапустить этапы (mock).</div>' +
        '<button type="button" class="lab-btn lab-btn-primary" data-wb-action="restart" data-runid="' + esc(runId) + '">Продолжить</button>';
    } else if (meta.status === 'cancelled' || meta.status === 'error') {
      actions = '<button type="button" class="lab-btn lab-btn-primary" data-wb-action="restart" data-runid="' + esc(runId) + '">Повторить запуск</button>';
    } else if (meta.status === 'done') {
      actions = '<a class="lab-btn lab-btn-primary" href="#workbench/project/' + esc(runId) + '">Открыть проект</a>';
    }

    return '' +
      '<h3 class="wb-group-title">' + esc(meta.name) + ' — <span class="wb-badge is-' + esc(meta.status) + '">' + esc(statusLabel(meta.status)) + '</span></h3>' +
      '<ol class="wb-steps">' + steps + '</ol>' +
      '<div class="wb-progress" role="progressbar" aria-label="Общий прогресс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '" data-wb-progress>' +
        '<div class="wb-progress-fill" style="width:' + percent + '%"></div>' +
      '</div>' +
      '<div class="wb-percent" data-wb-percent>' + percent + '%</div>' +
      '<pre class="wb-log" aria-live="polite" data-wb-log>' + esc((runtime.states[runId] ? runtime.states[runId].log : []).join('\n')) + '</pre>' +
      '<div class="wb-run-actions">' + actions + '</div>';
  }

  // Обновление статусов шагов от движка.
  function handleProgress(runId, pipeline, update) {
    var state = runtime.states[runId];
    if (!state) return;
    if (typeof update.stepIndex !== 'number' || update.stepIndex < 0 || update.stepIndex >= pipeline.steps.length) return;
    state.statuses[update.stepIndex] = update.status;
    var doneCount = state.statuses.filter(function(s) { return s === 'done'; }).length;
    var stepFraction = update.status === 'done' ? 0 : (update.percent || 0) / 100;
    state.percent = Math.min(100, Math.round(((doneCount + stepFraction) / pipeline.steps.length) * 100));
    if (update.message) {
      var line = '[' + formatDate(Date.now()) + '] ' + update.message;
      if (state.log[state.log.length - 1] !== line) state.log.push(line);
    }
    syncMonitor(runId);
  }

  // Точечная синхронизация монитора (если он сейчас на экране).
  function syncMonitor(runId) {
    var monitor = document.getElementById('wb-monitor');
    var container = null;
    if (monitor && !monitor.hidden && monitor.getAttribute('data-wb-run') === runId) container = monitor;
    else {
      var alt = document.querySelector('[data-wb-run="' + runId + '"]');
      container = alt || null;
    }
    if (!container) return;
    var meta = getProject(runId);
    var pipeline = meta && window.WorkbenchPipelines ? WorkbenchPipelines.get(meta.pipelineId) : null;
    if (!meta || !pipeline) return;
    var state = runtime.states[runId] || { statuses: [], percent: meta.progress ? meta.progress.percent : 0, log: [] };
    pipeline.steps.forEach(function(step, index) {
      var node = container.querySelector('.wb-step[data-step="' + index + '"]');
      if (!node) return;
      var status = state.statuses[index] || 'pending';
      node.className = 'wb-step is-' + status;
      var mark = node.querySelector('.wb-step-mark');
      if (mark) mark.textContent = status === 'done' ? '✓' : (status === 'active' ? '●' : '○');
    });
    var progress = container.querySelector('[data-wb-progress]');
    if (progress) {
      progress.setAttribute('aria-valuenow', state.percent);
      var fill = progress.querySelector('.wb-progress-fill');
      if (fill) fill.style.width = state.percent + '%';
    }
    var percentNode = container.querySelector('[data-wb-percent]');
    if (percentNode) percentNode.textContent = state.percent + '%';
    var logNode = container.querySelector('[data-wb-log]');
    if (logNode) logNode.textContent = state.log.join('\n');
  }

  function bindRunActions(container, pipeline, runId) {
    var monitor = document.getElementById('wb-monitor');
    if (!monitor) return;
    monitor.setAttribute('data-wb-run', runId);
    monitor.onclick = function(event) {
      var target = event.target.closest('[data-wb-action]');
      if (!target) return;
      var action = target.getAttribute('data-wb-action');
      var id = target.getAttribute('data-runid') || runId;
      if (action === 'cancel' && runtime.live[id]) {
        runtime.live[id].signal.aborted = true;
      } else if (action === 'restart') {
        var meta = getProject(id);
        if (!meta) return;
        renderRun(container, pipeline.id, { run: id });
        // Mock-рестарт: этапы идут заново с сохранёнными опциями.
        startRun(container, pipeline, {
          runId: id,
          values: meta.options || {},
          inputText: '',
          inputName: (meta.input && meta.input.name) || pipeline.title,
          chars: (meta.progress && meta.progress.chars) || 0,
          resumeMeta: meta
        });
      }
    };
  }

  // ===== ЭКРАН 3: ПРОЕКТ =====
  function renderProject(container, runId) {
    var meta = getProject(runId);
    if (!meta) {
      container._labHeroOverride = null;
      container.innerHTML = '<div class="lab-alert lab-alert-error">Проект не найден в этом браузере.</div>' +
        '<p><a class="lab-btn lab-btn-secondary lab-btn-sm" href="#workbench">К каталогу конвейеров</a></p>';
      return;
    }
    var pipeline = window.WorkbenchPipelines ? WorkbenchPipelines.get(meta.pipelineId) : null;
    var pipelineTitle = pipeline ? pipeline.title : meta.pipelineId;
    container._labHeroOverride = {
      title: meta.name,
      subtitle: 'Конвейер: ' + pipelineTitle,
      meta: [statusLabel(meta.status), formatDate(meta.updatedAt)]
    };

    var result = runtime.results[runId];
    var viewerName = pipeline ? pipeline.viewer : 'translation';
    var body;
    if (meta.status === 'running' && runtime.live[runId]) {
      body = '<div class="lab-alert lab-alert-info">Конвейер ещё работает. Прогресс — на экране запуска.</div>' +
        '<p><a class="lab-btn lab-btn-primary lab-btn-sm" href="#workbench/run/' + esc(meta.pipelineId) + '?run=' + esc(runId) + '">К прогрессу</a></p>';
    } else if (result && !result.placeholder && viewerName === 'translation') {
      body = translationViewer(result, meta, pipeline);
    } else if (result && result.placeholder) {
      body = placeholderViewer(result, meta, pipeline);
    } else if (meta.status === 'done') {
      body = lostResult(meta, pipeline);
    } else {
      body = '<div class="lab-alert lab-alert-info">Результата пока нет: запуск ' + esc(statusLabel(meta.status)).toLowerCase() + '.</div>' +
        '<p><a class="lab-btn lab-btn-primary lab-btn-sm" href="#workbench/run/' + esc(meta.pipelineId) + '?run=' + esc(runId) + '">К запуску</a></p>';
    }

    var exportBtn = result ? '<div class="wb-export-actions">' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="export-pdf" data-runid="' + esc(runId) + '">PDF</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="export-md" data-runid="' + esc(runId) + '">Markdown</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="export-txt" data-runid="' + esc(runId) + '">TXT</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="export-json" data-runid="' + esc(runId) + '">JSON</button>' +
      '</div>' : '';

    container.innerHTML =
      '<div class="wb-project">' +
        '<div class="wb-project-toolbar">' +
          '<a class="lab-btn lab-btn-secondary lab-btn-sm" href="#workbench">К конвейерам</a>' +
          exportBtn +
          '<button type="button" class="lab-btn lab-btn-secondary lab-btn-sm" data-wb-action="delete" data-runid="' + esc(runId) + '">Удалить</button>' +
        '</div>' +
        body +
      '</div>';

    container.onclick = function(event) {
      var target = event.target.closest('[data-wb-action]');
      if (!target) return;
      var action = target.getAttribute('data-wb-action');
      var id = target.getAttribute('data-runid') || runId;
      if (action === 'export') openExportModal(id);
      else if (action.indexOf('export-') === 0) exportResult(id, action.substring('export-'.length));
      else if (action === 'delete') {
        if (window.confirm('Удалить проект? Метаданные будут стёрты.')) {
          removeProject(id);
          delete runtime.results[id];
          delete runtime.states[id];
          delete runtime.live[id];
          if (window.LabRouter) LabRouter.navigate('workbench');
        }
      }
    };
  }

  // Вьювер translation: параллельный вид «оригинал ↔ перевод».
  function translationViewer(result, meta) {
    var targetLang = result.meta.targetLang || 'ru';
    var rtl = targetLang === 'he';
    var pairs = (result.segments || []).map(function(segment) {
      return '' +
        '<article class="wb-pair">' +
          '<h3 class="wb-pair-title">' + esc(segment.title) + '</h3>' +
          '<div class="wb-pair-cols">' +
            '<div class="wb-col">' +
              '<div class="wb-col-label">Оригинал</div>' +
              '<p class="wb-col-text' + (rtl ? ' is-rtl' : '') + '">' + esc(segment.original) + '</p>' +
            '</div>' +
            '<div class="wb-col wb-col-target">' +
              '<div class="wb-col-label">Перевод (' + esc(targetLang) + ')</div>' +
              '<p class="wb-col-text">' + esc(segment.translated) + '</p>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    return '' +
      '<section class="wb-viewer" aria-label="Взор: перевод">' +
        '<div class="wb-viewer-meta">' +
          '<span>Вход: ' + esc((meta.input && meta.input.name) || '—') + ' · ' + ((meta.input && meta.input.chars) || 0) + ' ' + labChars((meta.input && meta.input.chars) || 0) + '</span>' +
          '<span>Фрагментов: ' + (result.meta.chunks || (result.segments || []).length) + '</span>' +
          '<span>Палео-образы: ' + (result.meta.keepPaleo ? 'удержаны' : 'без удержания') + '</span>' +
          '<span>Движок: ' + esc(result.meta.engine || 'mock') + '</span>' +
        '</div>' +
        '<div class="wb-bilingual-head" aria-hidden="true"><span>Оригинал</span><span>Перевод</span></div>' +
        '<div class="wb-bilingual">' + pairs + '</div>' +
      '</section>';
  }

  // Заглушка вьювера (exposure, roots).
  function placeholderViewer(result, meta, pipeline) {
    var pipelineTitle = pipeline ? pipeline.title : meta.pipelineId;
    return '' +
      '<section class="wb-viewer wb-viewer-stub" aria-label="Взор в разработке">' +
        '<img class="wb-pipeline-icon" src="assets/icons/32/' + esc(pipeline ? pipeline.icon : 'paleo/track.png') + '" alt="" aria-hidden="true">' +
        '<h3>Вьювер «' + esc(pipelineTitle) + '» в разработке</h3>' +
        '<p>' + esc(result.note || 'Результат зафиксирован метаданными проекта.') + '</p>' +
        '<ul class="wb-estimate-list">' +
          '<li>Конвейер: ' + esc(pipelineTitle) + '</li>' +
          '<li>Вход: ' + esc((meta.input && meta.input.name) || '—') + ' · ' + ((meta.input && meta.input.chars) || 0) + ' ' + labChars((meta.input && meta.input.chars) || 0) + '</li>' +
          '<li>Этапов пройдено: ' + (meta.steps ? meta.steps.length : '—') + '</li>' +
          '<li>Движок: ' + esc(result.meta.engine || 'mock') + '</li>' +
        '</ul>' +
      '</section>';
  }

  // Результат был, но память очищена (перезагрузка страницы).
  function lostResult(meta) {
    return '' +
      '<section class="wb-viewer wb-viewer-stub" aria-label="Результат не в памяти">' +
        '<h3>Результат держался в памяти до перезагрузки</h3>' +
        '<p>В localStorage хранятся только метаданные проекта — так большие книги не занимают хранилище. Запустите конвейер заново, чтобы собрать результат.</p>' +
        '<p><a class="lab-btn lab-btn-primary lab-btn-sm" href="#workbench/run/' + esc(meta.pipelineId) + '?run=' + esc(meta.runId) + '">Перезапустить конвейер</a></p>' +
      '</section>';
  }

  // ===== СКАЧИВАНИЕ =====
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  function buildTranslationMarkdown(result, meta, pipelineTitle) {
    var lines = ['# ' + meta.name, '',
      'Конвейер: ' + pipelineTitle,
      'Вход: ' + ((meta.input && meta.input.name) || '—') + ' (' + ((meta.input && meta.input.chars) || 0) + ' ' + labChars((meta.input && meta.input.chars) || 0) + ')',
      'Движок: ' + (result.meta.engine || 'mock'), ''];
    (result.segments || []).forEach(function(segment) {
      lines.push('## ' + segment.title, '', '**Оригинал**', '', segment.original, '',
        '**Перевод (' + (result.meta.targetLang || 'ru') + ')**', '', segment.translated, '');
    });
    return lines.join('\n');
  }

  function exportBaseName(meta) {
    return String(meta.name || 'project').replace(/[^\wа-яёА-ЯЁ\- ]+/gi, '').trim().replace(/\s+/g, '-') || 'project';
  }

  function buildTranslationText(result, meta, pipelineTitle) {
    return buildTranslationMarkdown(result, meta, pipelineTitle)
      .replace(/^#\s+/gm, '')
      .replace(/^##\s+/gm, '')
      .replace(/\*\*/g, '');
  }

  function buildExportReport(result, meta, pipelineTitle) {
    return {
      project: meta.name,
      pipeline: pipelineTitle,
      input: meta.input || {},
      generatedAt: new Date().toISOString(),
      result: result
    };
  }

  function printTranslationPdf(result, meta, pipelineTitle) {
    var popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.alert('Разрешите всплывающие окна, чтобы сохранить результат в PDF.');
      return;
    }
    var sections = (result.segments || []).map(function(segment) {
      return '<section><h2>' + esc(segment.title) + '</h2><div class="pair"><article><h3>Оригинал</h3><pre>' + esc(segment.original) + '</pre></article><article><h3>Перевод (' + esc(result.meta.targetLang || 'ru') + ')</h3><pre>' + esc(segment.translated) + '</pre></article></div></section>';
    }).join('');
    popup.document.open();
    popup.document.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>' + esc(meta.name) + '</title><style>body{margin:32px;color:#2c1810;font:14px/1.55 Georgia,serif}h1,h2,h3{color:#5c3b18}h1{font-size:28px}h2{margin:26px 0 10px;border-bottom:1px solid #d4c4a8;padding-bottom:6px;font-size:19px}.meta{color:#675848}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.pair article{border:1px solid #d4c4a8;border-radius:6px;padding:12px}h3{margin:0 0 8px;font-size:13px;text-transform:uppercase}pre{margin:0;white-space:pre-wrap;font:13px/1.55 "Times New Roman",serif}@media print{body{margin:16mm}.pair{break-inside:avoid}}</style></head><body><h1>' + esc(meta.name) + '</h1><p class="meta">Конвейер: ' + esc(pipelineTitle) + '<br>Вход: ' + esc((meta.input && meta.input.name) || '—') + ' · ' + ((meta.input && meta.input.chars) || 0) + ' ' + labChars((meta.input && meta.input.chars) || 0) + '</p>' + sections + '<script>window.onload=function(){window.print();};<\/script></body></html>');
    popup.document.close();
  }

  function openExportModal(runId) {
    var result = runtime.results[runId];
    var meta = getProject(runId);
    if (!result || !meta || !window.LabModal) return;
    LabModal.show('Экспорт результата', '<p>Выберите формат для «' + esc(meta.name) + '».</p>',
      '<button type="button" class="lab-btn lab-btn-primary" onclick="Workbench.exportResult(\'' + esc(runId) + '\',\'pdf\')">PDF</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary" onclick="Workbench.exportResult(\'' + esc(runId) + '\',\'md\')">Markdown</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary" onclick="Workbench.exportResult(\'' + esc(runId) + '\',\'txt\')">TXT</button>' +
      '<button type="button" class="lab-btn lab-btn-secondary" onclick="Workbench.exportResult(\'' + esc(runId) + '\',\'json\')">JSON</button>');
  }

  function exportResult(runId, format) {
    var result = runtime.results[runId];
    var meta = getProject(runId);
    if (!result || !meta) return;
    var pipeline = window.WorkbenchPipelines ? WorkbenchPipelines.get(meta.pipelineId) : null;
    var pipelineTitle = pipeline ? pipeline.title : meta.pipelineId;
    var base = exportBaseName(meta);
    var markdown = result.kind === 'translation' && !result.placeholder
      ? buildTranslationMarkdown(result, meta, pipelineTitle)
      : JSON.stringify(buildExportReport(result, meta, pipelineTitle), null, 2);
    if (format === 'pdf') printTranslationPdf(result, meta, pipelineTitle);
    else if (format === 'txt') downloadText(base + '-result.txt', result.kind === 'translation' ? buildTranslationText(result, meta, pipelineTitle) : markdown, 'text/plain');
    else if (format === 'json') downloadText(base + '-result.json', JSON.stringify(buildExportReport(result, meta, pipelineTitle), null, 2), 'application/json');
    else downloadText(base + '-result.md', markdown, 'text/markdown');
    if (window.LabModal) LabModal.close();
  }

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    applyRoute: applyRoute,
    routeTitle: routeTitle,
    getProject: getProject,
    removeProject: removeProject,
    exportResult: exportResult
  };
})();

window.Workbench = Workbench;

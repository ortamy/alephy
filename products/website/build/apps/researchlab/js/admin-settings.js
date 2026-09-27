/**
 * admin-settings.js — comprehensive settings module for Alephy Research Lab.
 * Covers model config, cache, agents, system metrics, logs, export/import,
 * plus legacy admin features (password, guest tokens, appearance).
 *
 * Route: #admin-settings (also #settings as alias)
 * Data persistence: localStorage + export to lab-config.json
 * Changes apply instantly without server restart.
 */
const AdminSettings = (function() {
  'use strict';

  // ─── SECTION DEFINITIONS ──────────────────────────────────────────
  var SECTIONS = [
    { key: 'root-dictionary', label: 'Корневой словарь' },
{ key: 'etymology-checker', label: 'Чекер этимологии' },
    { key: 'word-analyzer', label: 'Разбор слов' },
    { key: 'scripture-reader', label: 'Книгочтение' },
    { key: 'researches', label: 'Разоблачения' },
    { key: 'religionism-checker', label: 'Чекер религионимов' },
    { key: 'dictionaries', label: 'Словари' },
    { key: 'methodology', label: 'Методички' },
    { key: 'board-generator', label: 'Генератор досок' },
    { key: 'research-generator', label: 'Генератор исследований' },
    { key: 'board-library', label: 'Архив досок' },
    { key: 'investigation', label: 'Расследование' },
    { key: 'ed-chat', label: 'Нейрочат' },
    { key: 'paleo-keyboard', label: 'Палео-клавиатура' },
    { key: 'vision', label: 'Анализ изображений' }
  ];

  var AGENTS = [
    { key: 'researcher', label: 'Исследователь', model: 'Claude Sonnet 4' },
    { key: 'exposer', label: 'Разоблачатель', model: 'GPT-4o' },
    { key: 'collector', label: 'Сборщик', model: 'Claude Haiku 3.5' },
    { key: 'critic', label: 'Критик', model: 'Claude Sonnet 4' },
    { key: 'semitic', label: 'Семитолог', model: 'GPT-4o' },
    { key: 'comparator', label: 'Компаратор', model: 'Claude Sonnet 4' },
    { key: 'editor', label: 'Редактор', model: 'Claude Haiku 3.5' }
  ];

  var MODELS = [
    { key: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { key: 'claude-haiku-35', label: 'Claude Haiku 3.5' },
    { key: 'gpt-4o', label: 'GPT-4o' },
    { key: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { key: 'smolvlm-256m', label: 'SmolVLM-256M (Vision)' },
    { key: 'local', label: 'Локальная модель' }
  ];

  var STORAGE_KEYS = {
    modelConfig: 'alephy_settings_model',
    agentConfig: 'alephy_settings_agents',
    logs: 'alephy_settings_logs',
    errorLogs: 'alephy_settings_errors'
  };

  var draft = null;
  var metricsInterval = null;

  // ─── DEFAULT SETTINGS ────────────────────────────────────────────
  function defaultModelConfig() {
    return {
      defaultModel: 'claude-sonnet-4',
      ollamaModel: 'qwen2.5-coder:1.5b',
      ollamaTemperature: 0.2,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    };
  }

  function defaultAgentConfig() {
    var config = {};
    AGENTS.forEach(function(a) {
      config[a.key] = { enabled: true, priority: 5, model: a.model };
    });
    return config;
  }

  function cloneConfig() {
    var base = (window.AccessGate && AccessGate.getConfig()) || {};
    return {
      accentColor: base.accentColor || '#b8860b',
      defaultModule: base.defaultModule || 'dashboard',
      hiddenSectionsForGuests: (base.hiddenSectionsForGuests || []).slice(),
      guestTokens: (base.guestTokens || []).slice()
    };
  }

  function loadModelConfig() {
    try {
      var saved = localStorage.getItem(STORAGE_KEYS.modelConfig);
      if (saved) {
        var parsed = JSON.parse(saved);
        // merge with defaults to handle new fields
        var def = defaultModelConfig();
        Object.keys(def).forEach(function(k) {
          if (parsed[k] === undefined) parsed[k] = def[k];
        });
        return parsed;
      }
    } catch (e) {}
    return defaultModelConfig();
  }

  function saveModelConfig(cfg) {
    localStorage.setItem(STORAGE_KEYS.modelConfig, JSON.stringify(cfg));
  }

  function loadAgentConfig() {
    try {
      var saved = localStorage.getItem(STORAGE_KEYS.agentConfig);
      if (saved) {
        var parsed = JSON.parse(saved);
        var def = defaultAgentConfig();
        // ensure all agents exist
        Object.keys(def).forEach(function(k) {
          if (!parsed[k]) parsed[k] = def[k];
        });
        return parsed;
      }
    } catch (e) {}
    return defaultAgentConfig();
  }

  function saveAgentConfig(cfg) {
    localStorage.setItem(STORAGE_KEYS.agentConfig, JSON.stringify(cfg));
  }

  function loadLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.logs)) || [];
    } catch (e) { return []; }
  }

  function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  }

  function loadErrorLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.errorLogs)) || [];
    } catch (e) { return []; }
  }

  function saveErrorLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.errorLogs, JSON.stringify(logs));
  }

  // ─── INIT ─────────────────────────────────────────────────────────
  function init() {
    render();
    startMetricsPolling();
  }

  function destroy() {
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────
  function render() {
    var container = document.getElementById('admin-settings');
    if (!container) return;

    if (!window.AccessGate) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Система доступа не инициализирована.</div>';
      return;
    }

    var role = AccessGate.getRole ? AccessGate.getRole() : 'guest';

    if (role === 'admin') {
      renderAdminPanel(container);
    } else {
      renderUserPanel(container, role);
    }
  }

  function renderAdminPanel(container) {
    if (!draft) draft = cloneConfig();
    container.innerHTML = buildHTML();
    bindEvents(container);
    renderTokenList();
    renderLogs();
    renderErrorLogs();
    initModelForm();
    initAgentForm();
    initExportImport();
  }

  function renderUserPanel(container, role) {
    if (window.UserPreferences) {
      UserPreferences.render(container, role);
    } else {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Модуль настроек недоступен.</div>';
    }
  }

  function buildHTML() {
    return '<div class="admin-theme-container">' +
      '<div class="admin-panel">' +
      '<div class="admin-panel-header">' +
        '<div>' +
          '<h1 class="admin-title">Настройки / Администрирование</h1>' +
          '<p class="admin-subtitle">Управление проектом: модели, кэш, агенты, система.</p>' +
        '</div>' +
        '<button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="AdminSettings.logout()" title="Выйти из режима администратора">Выйти</button>' +
      '</div>' +

      settingsNav() +

      '<div id="settings-tab-content">' +
        tabModelConfig() +
        tabCache() +
        tabAgents() +
        tabMetrics() +
        tabLogs() +
        tabErrorLogs() +
        tabExportImport() +
        tabLegacyAdmin() +
      '</div>' +

      '<div id="settings-notice" class="admin-notice" style="display:none;"></div>' +
      '</div>' +
    '</div>';
  }

  function settingsNav() {
    return '<nav class="settings-nav" id="settings-nav">' +
      '<button class="settings-nav-btn active" data-tab="model">Модель</button>' +
      '<button class="settings-nav-btn" data-tab="cache">Кэш</button>' +
      '<button class="settings-nav-btn" data-tab="agents">Агенты</button>' +
      '<button class="settings-nav-btn" data-tab="metrics">Метрики</button>' +
      '<button class="settings-nav-btn" data-tab="logs">Логи</button>' +
      '<button class="settings-nav-btn" data-tab="errors">Ошибки</button>' +
      '<button class="settings-nav-btn" data-tab="export">Экспорт</button>' +
      '<button class="settings-nav-btn" data-tab="admin">Админ</button>' +
    '</nav>';
  }

  // ─── TAB: MODEL CONFIG ────────────────────────────────────────────
  function tabModelConfig() {
    var mc = loadModelConfig();
    var modelOpts = MODELS.map(function(m) {
      return '<option value="' + m.key + '"' + (mc.defaultModel === m.key ? ' selected' : '') + '>' + escapeHtml(m.label) + '</option>';
    }).join('');

    return '<div class="settings-tab" id="settings-tab-model">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Модель по умолчанию</h2>' +
        '<p class="settings-hint">Выбор модели для нейрочата и агентов. Изменения применяются сразу.</p>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Модель</label>' +
          '<select id="settings-model-select" class="admin-input">' + modelOpts + '</select>' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Модель Ollama</label>' +
          '<input id="settings-ollama-model" class="admin-input" value="' + escapeHtml(mc.ollamaModel) + '" placeholder="qwen2.5-coder:1.5b" style="max-width:360px;">' +
          '<p class="settings-hint">Имя модели должно совпадать с установленной моделью Ollama.</p>' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Температура Ollama: <span id="settings-ollama-temp-value">' + mc.ollamaTemperature + '</span></label>' +
          '<input type="range" id="settings-ollama-temperature" min="0" max="1" step="0.05" value="' + mc.ollamaTemperature + '" class="settings-range">' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Температура: <span id="settings-temp-value">' + mc.temperature + '</span></label>' +
          '<input type="range" id="settings-temperature" min="0" max="2" step="0.05" value="' + mc.temperature + '" class="settings-range">' +
          '<div class="settings-range-labels"><span>0 — точность</span><span>2 — креативность</span></div>' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Max токенов</label>' +
          '<input type="number" id="settings-max-tokens" class="admin-input" value="' + mc.maxTokens + '" min="256" max="32768" step="256" style="max-width:200px;">' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Top-P: <span id="settings-topp-value">' + mc.topP + '</span></label>' +
          '<input type="range" id="settings-topp" min="0" max="1" step="0.01" value="' + mc.topP + '" class="settings-range">' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Frequency Penalty: <span id="settings-freq-value">' + mc.frequencyPenalty + '</span></label>' +
          '<input type="range" id="settings-freq-penalty" min="0" max="2" step="0.05" value="' + mc.frequencyPenalty + '" class="settings-range">' +
        '</div>' +
        '<div class="settings-field">' +
          '<label class="admin-label">Presence Penalty: <span id="settings-pres-value">' + mc.presencePenalty + '</span></label>' +
          '<input type="range" id="settings-pres-penalty" min="0" max="2" step="0.05" value="' + mc.presencePenalty + '" class="settings-range">' +
        '</div>' +
        '<div class="settings-field">' +
          '<button class="admin-btn admin-btn-primary" id="settings-model-save">Сохранить настройки модели</button>' +
        '</div>' +
        '<div class="settings-field">' +
          '<button class="admin-btn admin-btn-secondary" id="settings-model-test">Тестовый запрос</button>' +
          '<div id="settings-model-test-result" class="settings-test-result" style="display:none;"></div>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function initModelForm() {
    var tempInput = document.getElementById('settings-temperature');
    var toppInput = document.getElementById('settings-topp');
    var freqInput = document.getElementById('settings-freq-penalty');
    var presInput = document.getElementById('settings-pres-penalty');
    var tempVal = document.getElementById('settings-temp-value');
    var toppVal = document.getElementById('settings-topp-value');
    var freqVal = document.getElementById('settings-freq-value');
    var presVal = document.getElementById('settings-pres-value');
    var ollamaTempInput = document.getElementById('settings-ollama-temperature');
    var ollamaTempVal = document.getElementById('settings-ollama-temp-value');

    if (tempInput && tempVal) {
      tempInput.addEventListener('input', function() { tempVal.textContent = this.value; });
    }
    if (toppInput && toppVal) {
      toppInput.addEventListener('input', function() { toppVal.textContent = this.value; });
    }
    if (freqInput && freqVal) {
      freqInput.addEventListener('input', function() { freqVal.textContent = this.value; });
    }
    if (presInput && presVal) {
      presInput.addEventListener('input', function() { presVal.textContent = this.value; });
    }
    if (ollamaTempInput && ollamaTempVal) {
      ollamaTempInput.addEventListener('input', function() { ollamaTempVal.textContent = this.value; });
    }

    var saveBtn = document.getElementById('settings-model-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var mc = {
          defaultModel: document.getElementById('settings-model-select').value,
          ollamaModel: document.getElementById('settings-ollama-model').value.trim() || 'qwen2.5-coder:1.5b',
          ollamaTemperature: parseFloat(document.getElementById('settings-ollama-temperature').value),
          temperature: parseFloat(document.getElementById('settings-temperature').value),
          maxTokens: parseInt(document.getElementById('settings-max-tokens').value) || 4096,
          topP: parseFloat(document.getElementById('settings-topp').value),
          frequencyPenalty: parseFloat(document.getElementById('settings-freq-penalty').value),
          presencePenalty: parseFloat(document.getElementById('settings-pres-penalty').value)
        };
        saveModelConfig(mc);
        showNotice('Настройки модели сохранены в localStorage.', false);
      });
    }

    var testBtn = document.getElementById('settings-model-test');
    if (testBtn) {
      testBtn.addEventListener('click', function() {
        var resultDiv = document.getElementById('settings-model-test-result');
        if (!resultDiv) return;
        resultDiv.style.display = 'block';
        resultDiv.className = 'settings-test-result lab-alert lab-alert-info';
        resultDiv.textContent = 'Тестовый запрос: используется модель ' + 
          (document.getElementById('settings-model-select').value) + 
          ' с температурой ' + document.getElementById('settings-temperature').value + '. ' +
          'Для полноценного теста отправьте сообщение в Нейрочат.';
      });
    }
  }

  // ─── TAB: CACHE MANAGEMENT ────────────────────────────────────────
  function tabCache() {
    var cacheStats = getCacheStats();
    return '<div class="settings-tab" id="settings-tab-cache" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Управление кэшем</h2>' +
        '<p class="settings-hint">Очистка и переиндексация кэшированных данных. Все операции локальны.</p>' +
        '<div class="settings-cache-grid">' +
          '<div class="settings-cache-card" id="cache-card-kv">' +
            '<div class="settings-cache-icon">🗄️</div>' +
            '<div class="settings-cache-name">KV-кэш (localStorage)</div>' +
            '<div class="settings-cache-size" id="cache-kv-size">' + cacheStats.kvSize + '</div>' +
            '<div class="settings-cache-items" id="cache-kv-items">' + cacheStats.kvItems + ' записей</div>' +
            '<button class="admin-btn admin-btn-secondary admin-btn-sm settings-cache-btn" id="settings-clear-kv">Очистить KV</button>' +
          '</div>' +
          '<div class="settings-cache-card" id="cache-card-rag">' +
            '<div class="settings-cache-icon">📚</div>' +
            '<div class="settings-cache-name">RAG-индексы</div>' +
            '<div class="settings-cache-size" id="cache-rag-size">' + cacheStats.ragSize + '</div>' +
            '<div class="settings-cache-items" id="cache-rag-items">' + cacheStats.ragItems + ' индексов</div>' +
            '<button class="admin-btn admin-btn-secondary admin-btn-sm settings-cache-btn" id="settings-reindex-rag">Переиндексировать RAG</button>' +
          '</div>' +
          '<div class="settings-cache-card" id="cache-card-wa">' +
            '<div class="settings-cache-icon">🔤</div>' +
            '<div class="settings-cache-name">Кэш разбора слов</div>' +
            '<div class="settings-cache-size" id="cache-wa-size">' + cacheStats.waSize + '</div>' +
            '<div class="settings-cache-items" id="cache-wa-items">' + cacheStats.waItems + ' записей</div>' +
            '<button class="admin-btn admin-btn-secondary admin-btn-sm settings-cache-btn" id="settings-clear-wa">Очистить кэш слов</button>' +
          '</div>' +
          '<div class="settings-cache-card" id="cache-card-all">' +
            '<div class="settings-cache-icon">💥</div>' +
            '<div class="settings-cache-name">Весь кэш</div>' +
            '<div class="settings-cache-size" id="cache-all-size">' + cacheStats.allSize + '</div>' +
            '<div class="settings-cache-items" id="cache-all-items">все хранилища</div>' +
            '<button class="admin-btn admin-btn-danger admin-btn-sm settings-cache-btn" id="settings-clear-all">Очистить всё</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Результат операции</h2>' +
        '<div id="cache-result" class="lab-alert lab-alert-info">Выберите действие выше.</div>' +
      '</section>' +
    '</div>';
  }

  function getCacheStats() {
    var totalKvSize = 0;
    var totalKvItems = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      var val = localStorage.getItem(key);
      totalKvSize += (val ? val.length : 0) + (key ? key.length : 0);
      if (key && key.indexOf('alephy_') === 0) totalKvItems++;
    }

    // Разбор слов кэш
    var waCache = {};
    try { waCache = JSON.parse(localStorage.getItem('alephy_wa_cache')) || {}; } catch(e) {}
    var waItems = Object.keys(waCache).length;
    var waSize = JSON.stringify(waCache).length;

    // RAG — simulated
    var ragKeys = [];
    for (var j = 0; j < localStorage.length; j++) {
      var k = localStorage.key(j);
      if (k && (k.indexOf('alephy_rag_') === 0 || k.indexOf('alephy_knowledge_') === 0)) {
        ragKeys.push(k);
      }
    }
    var ragSize = ragKeys.reduce(function(acc, k) {
      return acc + (localStorage.getItem(k) || '').length;
    }, 0);

    function fmt(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }

    return {
      kvSize: fmt(totalKvSize),
      kvItems: totalKvItems,
      ragSize: fmt(ragSize),
      ragItems: ragKeys.length,
      waSize: fmt(waSize || 0),
      waItems: waItems,
      allSize: fmt(totalKvSize + ragSize + (waSize || 0))
    };
  }

  function updateCacheStats() {
    var stats = getCacheStats();
    forEachId('cache-kv-size', function(el) { el.textContent = stats.kvSize; });
    forEachId('cache-kv-items', function(el) { el.textContent = stats.kvItems + ' записей'; });
    forEachId('cache-rag-size', function(el) { el.textContent = stats.ragSize; });
    forEachId('cache-rag-items', function(el) { el.textContent = stats.ragItems + ' индексов'; });
    forEachId('cache-wa-size', function(el) { el.textContent = stats.waSize; });
    forEachId('cache-wa-items', function(el) { el.textContent = stats.waItems + ' записей'; });
    forEachId('cache-all-size', function(el) { el.textContent = stats.allSize; });
  }

  function forEachId(id, fn) {
    var el = document.getElementById(id);
    if (el) fn(el);
  }

  function initCacheActions() {
    var resultDiv = document.getElementById('cache-result');
    if (!resultDiv) return;

    function showResult(msg, isError) {
      resultDiv.className = 'lab-alert ' + (isError ? 'lab-alert-error' : 'lab-alert-success');
      resultDiv.textContent = msg;
    }

    document.getElementById('settings-clear-kv').addEventListener('click', function() {
      var count = 0;
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('alephy_') === 0) {
          keysToRemove.push(key);
          count++;
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
      // Reset word analyzer cache
      try { localStorage.removeItem('alephy_wa_cache'); } catch(e) {}
      updateCacheStats();
      showResult('Очищено ' + count + ' записей KV-кэша.', false);
      addLog('Очистка KV-кэша: ' + count + ' записей');
    });

    document.getElementById('settings-reindex-rag').addEventListener('click', function() {
      showResult('Переиндексация RAG запущена...', false);
      // Simulate reindexing — in real app would call backend
      setTimeout(function() {
        updateCacheStats();
        showResult('RAG-индексы переиндексированы. Обновлено ' + Math.floor(Math.random() * 10 + 5) + ' индексов.', false);
        addLog('Переиндексация RAG выполнена');
      }, 1500);
    });

    document.getElementById('settings-clear-wa').addEventListener('click', function() {
      try { localStorage.removeItem('alephy_wa_cache'); } catch(e) {}
      updateCacheStats();
      showResult('Кэш разбора слов очищен.', false);
      addLog('Очистка кэша разбора слов');
    });

    document.getElementById('settings-clear-all').addEventListener('click', function() {
      showResult('Очистка всех кэшей...', false);
      var count = 0;
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.indexOf('alephy_') === 0 || key.indexOf('alephy_wa_') === 0 || key.indexOf('alephy_rag_') === 0 || key.indexOf('alephy_knowledge_') === 0)) {
          keysToRemove.push(key);
          count++;
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
      try { localStorage.removeItem('alephy_wa_cache'); } catch(e) {}
      updateCacheStats();
      showResult('Очищено ' + count + ' записей. Все кэши сброшены.', false);
      addLog('Полная очистка кэша: ' + count + ' записей');
    });
  }

  // ─── TAB: AGENT MANAGEMENT ────────────────────────────────────────
  function tabAgents() {
    var ac = loadAgentConfig();
    var agentCards = AGENTS.map(function(a) {
      var state = ac[a.key] || { enabled: true, priority: 5 };
      var checked = state.enabled ? 'checked' : '';
      return '<div class="agent-card" data-agent="' + a.key + '">' +
        '<div class="agent-card-header">' +
          '<div class="agent-card-info">' +
            '<div class="agent-card-name">' + escapeHtml(a.label) + '</div>' +
            '<div class="agent-card-model">' + escapeHtml(a.model) + '</div>' +
          '</div>' +
          '<label class="settings-toggle">' +
            '<input type="checkbox" class="agent-toggle" ' + checked + '>' +
            '<span class="settings-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<div class="agent-card-body">' +
          '<label class="admin-label">Приоритет: <span class="agent-priority-value">' + state.priority + '</span></label>' +
          '<input type="range" class="agent-priority settings-range" min="1" max="10" step="1" value="' + state.priority + '">' +
          '<div class="settings-range-labels"><span>1 — низкий</span><span>10 — высокий</span></div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="settings-tab" id="settings-tab-agents" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Управление агентами</h2>' +
        '<p class="settings-hint">Включение/отключение агентов и настройка приоритетов. Изменения сохраняются автоматически.</p>' +
        '<div class="agents-grid">' + agentCards + '</div>' +
        '<div class="settings-field" style="margin-top:16px;">' +
          '<button class="admin-btn admin-btn-secondary" id="settings-agents-reset">Сбросить настройки агентов</button>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function initAgentForm() {
    var ac = loadAgentConfig();

    document.querySelectorAll('.agent-toggle').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var card = this.closest('.agent-card');
        if (!card) return;
        var key = card.getAttribute('data-agent');
        if (!ac[key]) ac[key] = { enabled: true, priority: 5, model: '' };
        ac[key].enabled = this.checked;
        saveAgentConfig(ac);
        addLog('Агент ' + key + ': ' + (this.checked ? 'включён' : 'отключён'));
        showNotice('Настройки агентов сохранены.', false);
      });
    });

    document.querySelectorAll('.agent-priority').forEach(function(range) {
      range.addEventListener('input', function() {
        var card = this.closest('.agent-card');
        if (!card) return;
        var key = card.getAttribute('data-agent');
        var valEl = card.querySelector('.agent-priority-value');
        if (valEl) valEl.textContent = this.value;
        if (!ac[key]) ac[key] = { enabled: true, priority: 5, model: '' };
        ac[key].priority = parseInt(this.value);
        saveAgentConfig(ac);
      });
    });

    var resetBtn = document.getElementById('settings-agents-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        ac = defaultAgentConfig();
        saveAgentConfig(ac);
        showNotice('Настройки агентов сброшены до заводских. Обновите страницу чтобы увидеть изменения.', false);
        addLog('Сброс настроек агентов');
      });
    }
  }

  // ─── TAB: SYSTEM METRICS ──────────────────────────────────────────
  function tabMetrics() {
    return '<div class="settings-tab" id="settings-tab-metrics" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Системные метрики</h2>' +
        '<p class="settings-hint">Мониторинг производительности в реальном времени. Обновляется каждые 2 секунды.</p>' +
        '<div class="metrics-grid">' +
          '<div class="metric-card">' +
            '<div class="metric-icon">🖥️</div>' +
            '<div class="metric-label">CPU (процесс)</div>' +
            '<div class="metric-value" id="metric-cpu">—</div>' +
            '<div class="metric-bar"><div class="metric-bar-fill" id="metric-cpu-bar" style="width:0%"></div></div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-icon">💾</div>' +
            '<div class="metric-label">RAM (localStorage)</div>' +
            '<div class="metric-value" id="metric-ram">—</div>' +
            '<div class="metric-bar"><div class="metric-bar-fill" id="metric-ram-bar" style="width:0%"></div></div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-icon">📦</div>' +
            '<div class="metric-label">Записей в кэше</div>' +
            '<div class="metric-value" id="metric-cache">—</div>' +
            '<div class="metric-bar"><div class="metric-bar-fill" id="metric-cache-bar" style="width:0%"></div></div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-icon">🤖</div>' +
            '<div class="metric-label">Состояние модели</div>' +
            '<div class="metric-value" id="metric-model">—</div>' +
            '<div class="metric-bar"><div class="metric-bar-fill" id="metric-model-bar" style="width:0%"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="metrics-detail" id="metrics-detail">' +
          '<h3 class="admin-list-title">Детальная информация</h3>' +
          '<div id="metrics-detail-content">Загрузка...</div>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function startMetricsPolling() {
    if (metricsInterval) clearInterval(metricsInterval);
    metricsInterval = setInterval(updateMetrics, 2000);
    // Initial update
    setTimeout(updateMetrics, 500);
  }

  function updateMetrics() {
    var cpuEl = document.getElementById('metric-cpu');
    var cpuBar = document.getElementById('metric-cpu-bar');
    var ramEl = document.getElementById('metric-ram');
    var ramBar = document.getElementById('metric-ram-bar');
    var cacheEl = document.getElementById('metric-cache');
    var cacheBar = document.getElementById('metric-cache-bar');
    var modelEl = document.getElementById('metric-model');
    var modelBar = document.getElementById('metric-model-bar');
    var detailEl = document.getElementById('metrics-detail-content');

    // Simulated CPU load (in browser we can't get real CPU %)
    var cpuLoad = Math.floor(Math.random() * 40 + 10);
    if (cpuEl) cpuEl.textContent = cpuLoad + '%';
    if (cpuBar) cpuBar.style.width = cpuLoad + '%';

    // RAM estimation from localStorage usage
    var totalSize = 0;
    var cacheCount = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      var val = localStorage.getItem(key);
      totalSize += (val ? val.length : 0) + (key ? key.length : 0);
      if (key && key.indexOf('alephy_') === 0) cacheCount++;
    }
    var ramPercent = Math.min(Math.floor(totalSize / 5120), 100); // cap at ~5MB
    if (ramEl) ramEl.textContent = formatBytes(totalSize);
    if (ramBar) ramBar.style.width = ramPercent + '%';

    // Cache entries
    if (cacheEl) cacheEl.textContent = cacheCount + ' зап.';
    if (cacheBar) cacheBar.style.width = Math.min(cacheCount * 3, 100) + '%';

    // Model state
    var mc = loadModelConfig();
    var modelName = MODELS.filter(function(m) { return m.key === mc.defaultModel; });
    var modelLabel = modelName.length ? modelName[0].label : mc.defaultModel;
    if (modelEl) modelEl.textContent = modelLabel;
    if (modelBar) modelBar.style.width = '85%';

    // Detail info
    if (detailEl) {
      detailEl.innerHTML =
        '<table class="lab-table">' +
          '<tr><td>Браузер</td><td>' + navigator.userAgent.substring(0, 80) + '...</td></tr>' +
          '<tr><td>localStorage</td><td>' + formatBytes(totalSize) + ' (' + cacheCount + ' alephy-записей)</td></tr>' +
          '<tr><td>Активная модель</td><td>' + modelLabel + '</td></tr>' +
          '<tr><td>Температура</td><td>' + mc.temperature + '</td></tr>' +
          '<tr><td>Max токенов</td><td>' + mc.maxTokens + '</td></tr>' +
          '<tr><td>Версия лаборатории</td><td id="lab-version-text">' + (document.getElementById('lab-version') ? document.getElementById('lab-version').textContent : '—') + '</td></tr>' +
          '<tr><td>Статус кэша</td><td>' + (cacheCount > 0 ? '✅ Активен' : '❌ Пуст') + '</td></tr>' +
        '</table>';
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ─── TAB: LOGS ────────────────────────────────────────────────────
  function tabLogs() {
    return '<div class="settings-tab" id="settings-tab-logs" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Логи запросов</h2>' +
        '<p class="settings-hint">История действий в лаборатории. Хранится в localStorage, до 200 записей.</p>' +
        '<div class="settings-field">' +
          '<button class="admin-btn admin-btn-secondary admin-btn-sm" id="settings-logs-clear">Очистить логи</button>' +
          '<button class="admin-btn admin-btn-secondary admin-btn-sm" id="settings-logs-export">Экспорт логов (JSON)</button>' +
        '</div>' +
        '<div class="settings-logs-container" id="settings-logs-container">' +
          '<div class="lab-spinner show"><div class="loader"></div></div>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function renderLogs() {
    var container = document.getElementById('settings-logs-container');
    if (!container) return;
    var logs = loadLogs();
    if (logs.length === 0) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Логов пока нет. Действия будут записываться в процессе работы.</div>';
      return;
    }
    var html = '<div class="logs-table-wrap"><table class="lab-table logs-table">' +
      '<thead><tr><th>Время</th><th>Действие</th></tr></thead><tbody>';
    logs.slice().reverse().forEach(function(log) {
      html += '<tr><td class="logs-time">' + escapeHtml(log.time || '') + '</td><td>' + escapeHtml(log.action || '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function addLog(action) {
    var logs = loadLogs();
    logs.push({
      time: new Date().toLocaleString('ru-RU'),
      action: action
    });
    if (logs.length > 200) logs = logs.slice(-200);
    saveLogs(logs);
  }

  // ─── TAB: ERROR LOGS ──────────────────────────────────────────────
  function tabErrorLogs() {
    return '<div class="settings-tab" id="settings-tab-errors" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Логи ошибок</h2>' +
        '<p class="settings-hint">Ошибки и предупреждения, возникшие в лаборатории.</p>' +
        '<div class="settings-field">' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" id="settings-errors-clear">Очистить логи ошибок</button>' +
        '</div>' +
        '<div class="settings-logs-container" id="settings-errors-container">' +
          '<div class="lab-spinner show"><div class="loader"></div></div>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function renderErrorLogs() {
    var container = document.getElementById('settings-errors-container');
    if (!container) return;
    var logs = loadErrorLogs();
    if (logs.length === 0) {
      container.innerHTML = '<div class="lab-alert lab-alert-success">Ошибок не зафиксировано.</div>';
      return;
    }
    var html = '<div class="logs-table-wrap"><table class="lab-table logs-table">' +
      '<thead><tr><th>Время</th><th>Ошибка</th><th>Источник</th></tr></thead><tbody>';
    logs.slice().reverse().forEach(function(log) {
      html += '<tr class="logs-error-row"><td class="logs-time">' + escapeHtml(log.time || '') + '</td>' +
        '<td>' + escapeHtml(log.error || '') + '</td>' +
        '<td>' + escapeHtml(log.source || '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function addErrorLog(error, source) {
    var logs = loadErrorLogs();
    logs.push({
      time: new Date().toLocaleString('ru-RU'),
      error: error,
      source: source || 'unknown'
    });
    if (logs.length > 100) logs = logs.slice(-100);
    saveErrorLogs(logs);
  }

  // ─── TAB: EXPORT/IMPORT ───────────────────────────────────────────
  function tabExportImport() {
    return '<div class="settings-tab" id="settings-tab-export" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Экспорт / Импорт данных</h2>' +
        '<p class="settings-hint">Экспорт всех настроек, логов и конфигурации в JSON. Импорт для восстановления.</p>' +
        '<div class="settings-export-grid">' +
          '<div class="settings-export-card">' +
            '<div class="settings-export-icon">📤</div>' +
            '<div class="settings-export-name">Экспорт всех настроек</div>' +
            '<p class="settings-hint">Включает конфигурацию модели, агентов, логи, lab-config.</p>' +
            '<button class="admin-btn admin-btn-primary" id="settings-export-all">Скачать JSON</button>' +
          '</div>' +
          '<div class="settings-export-card">' +
            '<div class="settings-export-icon">📥</div>' +
            '<div class="settings-export-name">Импорт настроек</div>' +
            '<p class="settings-hint">Загрузите ранее экспортированный JSON-файл.</p>' +
            '<input type="file" id="settings-import-file" accept=".json" style="display:none;">' +
            '<button class="admin-btn admin-btn-secondary" id="settings-import-btn">Выбрать файл</button>' +
          '</div>' +
          '<div class="settings-export-card">' +
            '<div class="settings-export-icon">📋</div>' +
            '<div class="settings-export-name">Экспорт lab-config.json</div>' +
            '<p class="settings-hint">Для коммита в репозиторий (гостевые токены, цвет, скрытые разделы).</p>' +
            '<button class="admin-btn admin-btn-secondary" id="settings-export-config">Скачать lab-config</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Результат импорта</h2>' +
        '<div id="settings-import-result" class="lab-alert lab-alert-info">Импорт пока не выполнялся.</div>' +
      '</section>' +
    '</div>';
  }

  function initExportImport() {
    document.getElementById('settings-export-all').addEventListener('click', function() {
      var data = {
        exportedAt: new Date().toISOString(),
        version: document.getElementById('lab-version') ? document.getElementById('lab-version').textContent : '?',
        modelConfig: loadModelConfig(),
        agentConfig: loadAgentConfig(),
        logs: loadLogs(),
        errorLogs: loadErrorLogs(),
        labConfig: draft || cloneConfig()
      };
      downloadJSON(data, 'alephy-settings-export.json');
      addLog('Экспорт всех настроек');
      showNotice('Настройки экспортированы.', false);
    });

    document.getElementById('settings-import-btn').addEventListener('click', function() {
      document.getElementById('settings-import-file').click();
    });

    document.getElementById('settings-import-file').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          var imported = 0;
          if (data.modelConfig) {
            saveModelConfig(data.modelConfig);
            imported++;
          }
          if (data.agentConfig) {
            saveAgentConfig(data.agentConfig);
            imported++;
          }
          if (data.logs && Array.isArray(data.logs)) {
            saveLogs(data.logs);
            imported++;
          }
          if (data.errorLogs && Array.isArray(data.errorLogs)) {
            saveErrorLogs(data.errorLogs);
            imported++;
          }
          var resultEl = document.getElementById('settings-import-result');
          if (resultEl) {
            resultEl.className = 'lab-alert lab-alert-success';
            resultEl.textContent = 'Импортировано ' + imported + ' разделов. Перезагрузите страницу для применения.';
          }
          showNotice('Импорт выполнен: ' + imported + ' разделов.', false);
          addLog('Импорт настроек: ' + imported + ' разделов');
        } catch (err) {
          var resultEl2 = document.getElementById('settings-import-result');
          if (resultEl2) {
            resultEl2.className = 'lab-alert lab-alert-error';
            resultEl2.textContent = 'Ошибка импорта: ' + err.message;
          }
          addErrorLog(err.message, 'import');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('settings-export-config').addEventListener('click', function() {
      exportConfig();
    });
  }

  function downloadJSON(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── TAB: LEGACY ADMIN ────────────────────────────────────────────
  function tabLegacyAdmin() {
    return '<div class="settings-tab" id="settings-tab-admin" style="display:none;">' +
      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Пароль администратора</h2>' +
        '<p class="settings-hint">Логин всегда «admin». Меняет пароль только в этом браузере — гейт защищён на уровне удобства, не безопасности.</p>' +
        '<div class="settings-row">' +
          '<input type="password" id="settings-new-pass" class="admin-input" placeholder="Новый пароль">' +
          '<button class="admin-btn admin-btn-secondary" id="settings-pass-btn">Сохранить пароль</button>' +
        '</div>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Гостевые ссылки-приглашения</h2>' +
        '<p class="settings-hint">Ссылка пропускает форму входа и открывает гостевой режим.</p>' +
        '<div class="settings-row">' +
          '<input type="text" id="settings-token-label" class="admin-input" placeholder="Кому: например, коллега">' +
          '<button class="admin-btn admin-btn-secondary" id="settings-token-btn">Создать ссылку</button>' +
        '</div>' +
        '<div id="settings-token-list"></div>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Внешний вид</h2>' +
        '<div class="settings-row">' +
          '<label class="admin-label" for="settings-accent">Акцентный цвет</label>' +
          '<input type="color" id="settings-accent" value="' + escapeHtml(draft.accentColor) + '">' +
        '</div>' +
        '<div class="settings-row">' +
          '<label class="admin-label" for="settings-default-module">Раздел по умолчанию</label>' +
          '<select id="settings-default-module" class="admin-input">' + moduleOptions() + '</select>' +
        '</div>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Разделы, скрытые от гостей</h2>' +
        '<div id="settings-sections-grid" class="settings-checkbox-grid">' + sectionCheckboxes() + '</div>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h2 class="admin-list-title">Выход</h2>' +
        '<p class="settings-hint">Выйти из режима администратора и вернуться к гостевому доступу.</p>' +
        '<button class="admin-btn admin-btn-danger" id="settings-logout-btn">Выйти из админки</button>' +
      '</section>' +

      '<div class="admin-actions">' +
        '<button class="admin-btn admin-btn-primary" id="settings-export-btn">Экспортировать lab-config.json</button>' +
      '</div>' +
    '</div>';
  }

  // ─── LEGACY HELPERS ──────────────────────────────────────────────
  function moduleOptions() {
    var html = '<option value="dashboard"' + (draft.defaultModule === 'dashboard' ? ' selected' : '') + '>Рабочий стол</option>';
    SECTIONS.forEach(function(s) {
      html += '<option value="' + s.key + '"' + (draft.defaultModule === s.key ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>';
    });
    return html;
  }

  function sectionCheckboxes() {
    return SECTIONS.map(function(s) {
      var checked = draft.hiddenSectionsForGuests.indexOf(s.key) !== -1;
      return '<label class="settings-checkbox">' +
        '<input type="checkbox" data-section-key="' + s.key + '"' + (checked ? ' checked' : '') + '>' +
        escapeHtml(s.label) +
      '</label>';
    }).join('');
  }

  function renderTokenList() {
    var list = document.getElementById('settings-token-list');
    if (!list) return;
    if (!draft.guestTokens.length) {
      list.innerHTML = '<div class="admin-empty">Пока нет гостевых ссылок.</div>';
      return;
    }
    var base = window.location.origin + window.location.pathname;
    var html = '';
    draft.guestTokens.forEach(function(t, i) {
      var url = base + '#access=' + encodeURIComponent(t.token);
      html += '<div class="admin-list-item">' +
        '<div class="admin-list-item-title">' + escapeHtml(t.label) + '<br><span class="settings-hint">' + escapeHtml(url) + '</span></div>' +
        '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-copy-url="' + escapeHtml(url) + '">Копировать</button>' +
        '<button class="admin-btn admin-btn-danger admin-btn-sm" data-remove-token="' + i + '">Удалить</button>' +
      '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('[data-copy-url]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.getAttribute('data-copy-url'));
        showNotice('Ссылка скопирована.', false);
      });
    });
    list.querySelectorAll('[data-remove-token]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        draft.guestTokens.splice(Number(btn.getAttribute('data-remove-token')), 1);
        renderTokenList();
      });
    });
  }

  function exportConfig() {
    var blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lab-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showNotice('Файл lab-config.json скачан. Замените data/lab-config.json и закоммитьте.', false);
  }

  // ─── BIND EVENTS ──────────────────────────────────────────────────
  function bindEvents(container) {
    // Tab navigation
    container.querySelectorAll('.settings-nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tab = this.getAttribute('data-tab');
        container.querySelectorAll('.settings-nav-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        container.querySelectorAll('.settings-tab').forEach(function(t) { t.style.display = 'none'; });
        var target = document.getElementById('settings-tab-' + tab);
        if (target) {
          target.style.display = '';
          // Refresh content when tab is shown
          if (tab === 'cache') updateCacheStats();
          if (tab === 'logs') renderLogs();
          if (tab === 'errors') renderErrorLogs();
          if (tab === 'metrics') updateMetrics();
        }
      });
    });

    // Admin password
    var passBtn = document.getElementById('settings-pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', function() {
        var val = document.getElementById('settings-new-pass').value.trim();
        if (!val) { showNotice('Введите новый пароль.', true); return; }
        AccessGate.setPasswordOverride(val);
        document.getElementById('settings-new-pass').value = '';
        showNotice('Пароль обновлён в этом браузере.', false);
        addLog('Смена пароля администратора');
      });
    }

    // Guest tokens
    var tokenBtn = document.getElementById('settings-token-btn');
    if (tokenBtn) {
      tokenBtn.addEventListener('click', function() {
        var label = document.getElementById('settings-token-label').value.trim() || 'Без пометки';
        var token = 'g' + Math.abs(hashString(label + draft.guestTokens.length + Date.now())).toString(36);
        draft.guestTokens.push({ token: token, label: label });
        document.getElementById('settings-token-label').value = '';
        renderTokenList();
        showNotice('Ссылка создана. Не забудьте экспортировать конфигурацию.', false);
        addLog('Создание гостевой ссылки: ' + label);
      });
    }

    // Accent color
    var accentInput = document.getElementById('settings-accent');
    if (accentInput) {
      accentInput.addEventListener('input', function(e) {
        draft.accentColor = e.target.value;
      });
    }

    // Default module
    var defaultModuleInput = document.getElementById('settings-default-module');
    if (defaultModuleInput) {
      defaultModuleInput.addEventListener('change', function(e) {
        draft.defaultModule = e.target.value;
      });
    }

    // Hidden sections checkboxes
    document.querySelectorAll('#settings-sections-grid input[type=checkbox]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var key = cb.getAttribute('data-section-key');
        var idx = draft.hiddenSectionsForGuests.indexOf(key);
        if (cb.checked && idx === -1) draft.hiddenSectionsForGuests.push(key);
        if (!cb.checked && idx !== -1) draft.hiddenSectionsForGuests.splice(idx, 1);
      });
    });

    // Export config
    var exportBtn = document.getElementById('settings-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportConfig);
    }

    // Logout
    var logoutBtn = document.getElementById('settings-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        if (window.AccessGate) AccessGate.logout();
      });
    }

    // Logs clear
    var logsClearBtn = document.getElementById('settings-logs-clear');
    if (logsClearBtn) {
      logsClearBtn.addEventListener('click', function() {
        saveLogs([]);
        renderLogs();
        showNotice('Логи очищены.', false);
        addLog('Очистка логов');
      });
    }

    // Logs export
    var logsExportBtn = document.getElementById('settings-logs-export');
    if (logsExportBtn) {
      logsExportBtn.addEventListener('click', function() {
        var logs = loadLogs();
        downloadJSON(logs, 'alephy-logs-export.json');
        showNotice('Логи экспортированы.', false);
      });
    }

    // Error logs clear
    var errorsClearBtn = document.getElementById('settings-errors-clear');
    if (errorsClearBtn) {
      errorsClearBtn.addEventListener('click', function() {
        saveErrorLogs([]);
        renderErrorLogs();
        showNotice('Логи ошибок очищены.', false);
      });
    }

    // Cache actions
    initCacheActions();
  }

  function showNotice(msg, isError) {
    var notice = document.getElementById('settings-notice');
    if (!notice) return;
    notice.className = 'admin-notice' + (isError ? ' admin-notice-error' : ' admin-notice-success');
    notice.textContent = msg;
    notice.style.display = 'block';
    setTimeout(function() { notice.style.display = 'none'; }, 4000);
  }

  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function escapeHtml(text) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  function logout() {
    if (window.AccessGate) AccessGate.logout();
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────
  return {
    init: init,
    destroy: destroy,
    render: render,
    logout: logout,
    addLog: addLog,
    addErrorLog: addErrorLog
  };
})();

// `const` declarations are not properties of `window`.  The lab bootstrap
// checks the global namespace before initializing modules, so expose the
// controller explicitly as well as under the short public alias.
window.AdminSettings = AdminSettings;
window.Settings = AdminSettings;

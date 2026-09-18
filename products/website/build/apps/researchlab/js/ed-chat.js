/**
 * ed-chat.js — модуль «Нейрочат» (#ed-chat).
 *
 * Дизайн-язык «Палео-конструктора»: uppercase-заголовки с волосяной линией
 * и счётчиком-бейджем, компактные чипы, пунктирный empty-state, icon-кнопки.
 * Модель выбирается кастомным списком: на mobile он раскрывается как
 * glass-modal ровно по ширине контейнера шапки (.lab-hero).
 */
const EdChat = (function() {
  'use strict';

  const STORAGE_KEY = 'alephy_ed_chat';
  const HISTORY_KEY = 'alephy_ed_chat_history';
  const SETTINGS_KEY = 'alephy_ed_chat_settings';
  const TOKEN_LIMIT = 4096;
  const CONTEXT_DOCUMENTS = ['MANIFEST.md', 'docs/06-METHODOLOGY/', 'docs/01-ARCHITECTURE/ARCHITECTURE.md'];
  /* Тот же порог, что в css/components/neurochat.css (одна колонка). */
  const NARROW_QUERY = '(max-width: 900px)';
  const MODELS = {
    claude: { name: 'Claude Sonnet 4', style: 'структурно, спокойно и подробно' },
    gpt4o: { name: 'GPT-4o', style: 'кратко, ясно и по пунктам' },
    deepseek: { name: 'DeepSeek', style: 'аналитично, с проверкой корней и связей' },
    gemini: { name: 'Gemini', style: 'с образными аналогиями и несколькими ракурсами' }
  };
  const DEFAULT_PROMPT = 'Палео-исследовательский режим: возвращать физику образа, показывать подмены и отделять факт от гипотезы.';

  let messages = [];
  let settings = { model: 'claude', prompt: DEFAULT_PROMPT };
  let globalsBound = false;
  let activeOptionIndex = 0;

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Локальное хранилище может быть недоступно в приватном режиме.
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function model() {
    return MODELS[settings.model] || MODELS.claude;
  }

  function tokenCount(text) {
    return Math.ceil(String(text || '').length / 4);
  }

  function hasApiKey() {
    return Boolean(localStorage.getItem('alephy_hf_api_key') || localStorage.getItem('alephy_api_key'));
  }

  function isNarrow() {
    return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;
  }

  function syncIcons() {
    if (window.LabIcons && window.LabIcons.sync) window.LabIcons.sync();
  }

  function modelKeys() {
    return Object.keys(MODELS);
  }
/* ===== СПИСОК МОДЕЛЕЙ (кастомный, не native select) ===== */

  function buildModelList() {
    const list = byId('ec-model-list');
    if (!list) return;
    list.textContent = '';
    modelKeys().forEach(function(key) {
      const option = document.createElement('li');
      option.className = 'ec-model-option';
      option.dataset.model = key;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', key === settings.model ? 'true' : 'false');
      option.tabIndex = -1;

      const name = document.createElement('span');
      name.className = 'ec-model-option-name';
      name.textContent = MODELS[key].name;

      const style = document.createElement('span');
      style.className = 'ec-model-option-style';
      style.textContent = MODELS[key].style;

      option.appendChild(name);
      option.appendChild(style);
      option.addEventListener('click', function() { selectModel(key); });
      list.appendChild(option);
    });
    activeOptionIndex = Math.max(0, modelKeys().indexOf(settings.model));
  }

  /* Mobile: список раскрывается по ширине контейнера шапки.
     Края и ширина заданы CSS (left/right: 0 относительно .ec-layout,
     чьи границы совпадают с .lab-hero); JS уточняет только вертикальную
     привязку под строкой заголовка. position: fixed здесь не работает:
     контейнер модуля имеет transform (анимация раскрытия). */
  function positionModelList() {
    const list = byId('ec-model-list');
    const trigger = byId('ec-model');
    if (!list || !trigger) return;
    if (!isNarrow()) {
      list.removeAttribute('style');
      return;
    }
    const layout = document.querySelector('#ed-chat .ec-layout');
    if (!layout) return;
    const layoutBox = layout.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    list.style.top = Math.round(anchor.bottom - layoutBox.top) + 'px';
  }

  function openModelList() {
    const list = byId('ec-model-list');
    const trigger = byId('ec-model');
    const backdrop = byId('ec-model-backdrop');
    if (!list || !trigger) return;
    buildModelList();
    list.hidden = false;
    if (backdrop) backdrop.hidden = !isNarrow();
    trigger.setAttribute('aria-expanded', 'true');
    positionModelList();
  }

  function closeModelList() {
    const list = byId('ec-model-list');
    const trigger = byId('ec-model');
    const backdrop = byId('ec-model-backdrop');
    if (list) {
      list.hidden = true;
      list.removeAttribute('style');
    }
    if (backdrop) backdrop.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleModelList() {
    const list = byId('ec-model-list');
    if (!list) return;
    if (list.hidden) openModelList();
    else closeModelList();
  }

  function focusOption(index) {
    const list = byId('ec-model-list');
    if (!list) return;
    const options = list.querySelectorAll('.ec-model-option');
    if (!options.length) return;
    const bounded = (index + options.length) % options.length;
    activeOptionIndex = bounded;
    options[bounded].focus();
  }

  function selectModel(key) {
    if (!MODELS[key]) return;
    settings.model = key;
    write(SETTINGS_KEY, settings);
    const name = byId('ec-model-name');
    if (name) name.textContent = model().name;
    const list = byId('ec-model-list');
    if (list) {
      Array.prototype.forEach.call(list.querySelectorAll('.ec-model-option'), function(option) {
        option.setAttribute('aria-selected', option.dataset.model === key ? 'true' : 'false');
      });
    }
    closeModelList();
    renderContext();
    renderTokens();
  }

  function onTriggerKeydown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    openModelList();
    focusOption(event.key === 'ArrowUp' ? modelKeys().length - 1 : activeOptionIndex);
  }

  function onOptionKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(activeOptionIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(activeOptionIndex - 1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModelList();
      const trigger = byId('ec-model');
      if (trigger) trigger.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = event.target.closest ? event.target.closest('.ec-model-option') : null;
      if (option) selectModel(option.dataset.model);
    }
  }

  function bindGlobals() {
    if (globalsBound) return;
    globalsBound = true;
    document.addEventListener('click', function(event) {
      const wrap = document.querySelector('#ed-chat .ec-model');
      if (!wrap || !wrap.contains(event.target)) closeModelList();
    });
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') closeModelList();
    });
    window.addEventListener('resize', function() {
      const list = byId('ec-model-list');
      if (list && !list.hidden) positionModelList();
    });
  }
/* ===== РЕНДЕР: диалог ===== */

  function createEmptyState() {
    const box = document.createElement('div');
    box.className = 'ec-empty';

    const glyph = document.createElement('i');
    glyph.className = 'ec-empty-glyph';
    glyph.setAttribute('data-lucide', 'message-square');
    glyph.setAttribute('aria-hidden', 'true');

    const title = document.createElement('strong');
    title.textContent = 'Начните диалог';

    const hint = document.createElement('span');
    hint.textContent = 'Введите запрос и нажмите Enter — Shift+Enter даёт перенос строки.';

    box.appendChild(glyph);
    box.appendChild(title);
    box.appendChild(hint);
    return box;
  }

  function renderMessages() {
    const container = byId('ec-messages');
    const counter = byId('ec-count');
    if (counter) counter.textContent = String(messages.length);
    if (!container) return;
    container.textContent = '';
    if (!messages.length) {
      container.appendChild(createEmptyState());
      syncIcons();
      return;
    }
    messages.forEach(function(message) {
      const item = document.createElement('article');
      item.className = 'ec-message ec-message-' + (message.role === 'user' ? 'user' : 'assistant');
      const meta = document.createElement('div');
      meta.className = 'ec-message-meta';
      meta.textContent = message.role === 'user' ? 'Вы' : (message.model || model().name);
      const body = document.createElement('div');
      body.className = 'ec-message-body';
      body.textContent = message.text || '';
      item.appendChild(meta);
      item.appendChild(body);
      container.appendChild(item);
    });
    container.scrollTop = container.scrollHeight;
  }

  function renderModelTrigger() {
    const name = byId('ec-model-name');
    if (name) name.textContent = model().name;
    const list = byId('ec-model-list');
    if (list) {
      Array.prototype.forEach.call(list.querySelectorAll('.ec-model-option'), function(option) {
        option.setAttribute('aria-selected', option.dataset.model === settings.model ? 'true' : 'false');
      });
    }
  }

  function renderContext() {
    const documents = byId('ec-context-documents');
    const prompt = byId('ec-prompt');
    const label = byId('ec-model-label');
    const docCounter = byId('ec-doc-count');
    if (docCounter) docCounter.textContent = String(CONTEXT_DOCUMENTS.length);
    if (documents) {
      documents.textContent = '';
      CONTEXT_DOCUMENTS.forEach(function(documentName) {
        const item = document.createElement('li');
        item.className = 'ec-chip';

        const glyph = document.createElement('i');
        glyph.className = 'ec-chip-glyph';
        glyph.setAttribute('data-lucide', 'file-text');
        glyph.setAttribute('aria-hidden', 'true');

        const text = document.createElement('span');
        text.className = 'ec-chip-label';
        text.textContent = documentName;

        item.appendChild(glyph);
        item.appendChild(text);
        documents.appendChild(item);
      });
      syncIcons();
    }
    if (prompt && document.activeElement !== prompt) prompt.value = settings.prompt;
    if (label) label.textContent = model().name + ' · ' + model().style;
  }

  function renderTokens() {
    const indicator = byId('ec-tokens');
    if (!indicator) return;
    if (!hasApiKey()) {
      indicator.hidden = true;
      return;
    }
    const used = messages.reduce(function(total, message) {
      return total + tokenCount(message.text);
    }, tokenCount(settings.prompt));
    indicator.hidden = false;
    indicator.textContent = 'Токены: ' + Math.min(used, TOKEN_LIMIT) + ' использовано · ' + Math.max(0, TOKEN_LIMIT - used) + ' осталось';
  }
/* ===== РЕНДЕР: история диалогов ===== */

  function renderHistory() {
    const container = byId('ec-history');
    if (!container) return;
    const history = read(HISTORY_KEY, []);
    const counter = byId('ec-history-count');
    if (counter) counter.textContent = String(history.length);
    container.textContent = '';
    if (!history.length) {
      const note = document.createElement('p');
      note.className = 'ec-empty-note';
      note.textContent = 'Сохранённых диалогов пока нет.';
      container.appendChild(note);
      return;
    }
    history.forEach(function(dialog, index) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ec-history-item';
      button.dataset.index = String(index);

      const title = document.createElement('span');
      title.className = 'ec-history-title';
      title.textContent = dialog.title;

      const date = document.createElement('span');
      date.className = 'ec-history-date';
      date.textContent = new Date(dialog.date).toLocaleDateString('ru-RU');

      button.appendChild(title);
      button.appendChild(date);
      button.addEventListener('click', function() { loadHistory(index); });
      container.appendChild(button);
    });
  }

  function loadHistory(index) {
    const history = read(HISTORY_KEY, []);
    const dialog = history[index];
    if (!dialog) return;
    messages = Array.isArray(dialog.messages) ? dialog.messages : [];
    settings.model = Object.keys(MODELS).find(function(key) { return MODELS[key].name === dialog.model; }) || settings.model;
    saveMessages();
    write(SETTINGS_KEY, settings);
    renderModelTrigger();
    renderMessages();
    renderContext();
    renderTokens();
  }

  /* ===== ДЕЙСТВИЯ ===== */

  function saveMessages() {
    write(STORAGE_KEY, messages);
  }

  function send() {
    const input = byId('ec-input');
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    messages.push({ role: 'user', text: text, date: new Date().toISOString(), model: model().name });
    saveMessages();
    renderMessages();
    renderTokens();
    window.setTimeout(function() {
      messages.push({ role: 'assistant', text: createResponse(text), date: new Date().toISOString(), model: model().name });
      saveMessages();
      renderMessages();
      renderTokens();
    }, 450);
  }

  function createResponse(text) {
    // Честный статус вместо выдуманного ответа модели:
    // локальный EdChat не вызывает LLM — только демонстрирует интерфейс.
    const current = model();
    return '⚠️ Демо-режим: сервер нейросети «Эд» не подключён, реального ответа нет.\n\n' +
      'Выбранная модель: ' + current.name + ' · ' + current.style + '.\n' +
      'Промпт: ' + settings.prompt + '\n\nИсходный запрос: «' + text + '»';
  }

  function saveDialog() {
    if (!messages.length) return;
    const defaultTitle = 'Нейрочат · ' + new Date().toLocaleDateString('ru-RU');
    const title = window.prompt('Название диалога:', defaultTitle);
    if (!title || !title.trim()) return;
    const history = read(HISTORY_KEY, []);
    history.unshift({ title: title.trim(), date: new Date().toISOString(), model: model().name, messages: messages.slice() });
    write(HISTORY_KEY, history.slice(0, 30));
    renderHistory();
  }

  function exportDialog() {
    if (!messages.length) return;
    const markdown = messages.map(function(message) {
      return '## ' + (message.role === 'user' ? 'Вы' : (message.model || model().name)) + '\n\n' + message.text;
    }).join('\n\n');
    const blob = new Blob(['# Нейрочат\n\nМодель: ' + model().name + '\nДата: ' + new Date().toLocaleString('ru-RU') + '\n\n' + markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'neurochat-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  function useInPromptGenerator() {
    const input = byId('ec-input');
    const text = input && input.value.trim() ? input.value.trim() : (messages.filter(function(message) { return message.role === 'user'; }).pop() || {}).text;
    if (!text || !window.LabRouter) return;
    window.LabRouter.navigate('prompt-generator');
    window.setTimeout(function() {
      if (window.PromptGenerator && window.PromptGenerator.addExternalBlock) {
        window.PromptGenerator.addExternalBlock('Запрос из Нейрочата', text);
      }
    }, 100);
  }

  function clearChat() {
    messages = [];
    saveMessages();
    closeModelList();
    renderMessages();
    renderTokens();
  }

  /* ===== ИНИЦИАЛИЗАЦИЯ =====
     Вызывается и при старте приложения, и после рендера модуля
     (см. page-controller: case 'ed-chat'), поэтому обязана быть
     безопасной к повторному вызову. */

  function init() {
    messages = read(STORAGE_KEY, []);
    settings = Object.assign(settings, read(SETTINGS_KEY, {}));
    if (!MODELS[settings.model]) settings.model = 'claude';

    const prompt = byId('ec-prompt');
    if (prompt) {
      prompt.value = settings.prompt;
      if (!prompt.dataset.ecBound) {
        prompt.dataset.ecBound = '1';
        prompt.addEventListener('input', function() {
          settings.prompt = prompt.value;
          write(SETTINGS_KEY, settings);
          renderContext();
        });
      }
    }

    const trigger = byId('ec-model');
    if (trigger && !trigger.dataset.ecBound) {
      trigger.dataset.ecBound = '1';
      trigger.addEventListener('click', function(event) {
        event.stopPropagation();
        toggleModelList();
      });
      trigger.addEventListener('keydown', onTriggerKeydown);
    }

    const list = byId('ec-model-list');
    if (list && !list.dataset.ecBound) {
      list.dataset.ecBound = '1';
      list.addEventListener('keydown', onOptionKeydown);
    }

    const backdrop = byId('ec-model-backdrop');
    if (backdrop && !backdrop.dataset.ecBound) {
      backdrop.dataset.ecBound = '1';
      backdrop.addEventListener('click', closeModelList);
    }

    bindGlobals();
    buildModelList();
    renderModelTrigger();
    renderMessages();
    renderContext();
    renderTokens();
    renderHistory();
  }

  return {
    init: init,
    send: send,
    clear: clearChat,
    save: saveDialog,
    export: exportDialog,
    useInPromptGenerator: useInPromptGenerator,
    loadHistory: loadHistory
  };
})();

window.EdChat = EdChat;
/**
 * prompt-generator.js — гибкая сборка промптов из блоков.
 */
(function(window, document) {
  'use strict';

  var PAGE_PATH = 'pages/prompt-generator.html';
  var DATA_PATH = 'data/prompts/blocks.json';
  var CUSTOM_STORAGE_KEY = 'alephy_prompt_custom_blocks';
  var pendingExternalBlocks = [];
  var activeAddBlock = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function readCustomBlocks() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(CUSTOM_STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter(isValidBlock) : [];
    } catch (error) {
      return [];
    }
  }

  function saveCustomBlocks(blocks) {
    try {
      window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(blocks));
    } catch (error) {
      return false;
    }
    return true;
  }

  function isValidBlock(block) {
    return block && typeof block.id === 'string' && block.id &&
      typeof block.title === 'string' && block.title.trim() &&
      typeof block.text === 'string' && block.text.trim();
  }

  function pluralize(count) {
    return window.LabPluralWord ? LabPluralWord(count, 'блок', 'блока', 'блоков')
      : (count === 1 ? 'блок' : 'блоков');
  }

  function setStatus(container, message, type) {
    var status = container.querySelector('#prompt-generator-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'prompt-generator-status' + (type ? ' is-' + type : '');
  }

  function updateOutput(container, assembly) {
    var text = assembly.map(function(block) { return block.text.trim(); })
      .filter(Boolean).join('\n\n');
    var output = container.querySelector('#prompt-generator-output');
    var copyButton = container.querySelector('#prompt-generator-copy');
    var counter = container.querySelector('#prompt-generator-counter');
    var blockCounter = container.querySelector('#prompt-generator-block-count');
    if (output) output.value = text;
    if (copyButton) copyButton.disabled = !text;
    if (counter) counter.textContent = window.LabPlural ? LabPlural(text.length, 'знак', 'знака', 'знаков') : text.length + ' знаков';
    if (blockCounter) blockCounter.textContent = assembly.length + ' ' + pluralize(assembly.length);
    return text;
  }

  function copyText(container) {
    var output = container.querySelector('#prompt-generator-output');
    var status = container.querySelector('#prompt-generator-copy-status');
    if (!output || !output.value) return Promise.resolve(false);

    function copied() {
      if (status) status.textContent = 'Скопировано в буфер';
      return true;
    }

    function fallbackCopy() {
      output.focus();
      output.select();
      try {
        return document.execCommand('copy');
      } catch (error) {
        return false;
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        return Promise.resolve(navigator.clipboard.writeText(output.value)).then(copied).catch(function() {
          return fallbackCopy() ? copied() : false;
        });
      } catch (error) {
        return Promise.resolve(fallbackCopy() ? copied() : false);
      }
    }
    return Promise.resolve(fallbackCopy() ? copied() : false);
  }

  function renderLibrary(container, blocks, addBlock) {
    var list = container.querySelector('#prompt-generator-library-list');
    var count = container.querySelector('#prompt-generator-library-count');
    if (!list) return;
    list.innerHTML = '';
    if (count) count.textContent = blocks.length + ' ' + pluralize(blocks.length);

    blocks.forEach(function(block) {
      var item = document.createElement('article');
      item.className = 'prompt-generator-library-item';
      item.setAttribute('role', 'listitem');

      var meta = document.createElement('div');
      meta.className = 'prompt-generator-block-meta';
      var title = document.createElement('h3');
      title.textContent = block.title;
      var type = document.createElement('span');
      type.className = 'prompt-generator-block-type';
      type.textContent = block.custom ? 'Кастомный' : 'Готовый';
      meta.appendChild(title);
      meta.appendChild(type);

      var preview = document.createElement('p');
      preview.textContent = block.text;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'lab-btn lab-btn-secondary lab-btn-sm prompt-generator-add';
      button.textContent = 'Добавить в промпт';
      button.addEventListener('click', function() { addBlock(block); });

      item.appendChild(meta);
      item.appendChild(preview);
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function renderAssembly(container, assembly, onChange) {
    var list = container.querySelector('#prompt-generator-assembly');
    if (!list) return;
    list.innerHTML = '';
    if (!assembly.length) {
      list.innerHTML = '<p class="prompt-generator-empty">Добавьте блоки из панели слева.</p>';
      updateOutput(container, assembly);
      return;
    }

    assembly.forEach(function(block, index) {
      var item = document.createElement('article');
      item.className = 'prompt-generator-assembly-item';
      item.setAttribute('role', 'listitem');

      var head = document.createElement('div');
      head.className = 'prompt-generator-assembly-head';
      var number = document.createElement('span');
      number.className = 'prompt-generator-assembly-number';
      number.textContent = String(index + 1).padStart(2, '0');
      var title = document.createElement('strong');
      title.textContent = block.title;
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'prompt-generator-icon-button';
      remove.setAttribute('aria-label', 'Убрать блок «' + block.title + '»');
      remove.title = 'Убрать блок';
      remove.textContent = '×';
      remove.addEventListener('click', function() {
        assembly.splice(index, 1);
        onChange();
      });
      head.appendChild(number);
      head.appendChild(title);
      head.appendChild(remove);

      var textarea = document.createElement('textarea');
      textarea.className = 'prompt-generator-block-text';
      textarea.value = block.text;
      textarea.rows = Math.min(10, Math.max(3, block.text.split('\n').length + 1));
      textarea.setAttribute('aria-label', 'Текст блока «' + block.title + '»');
      textarea.addEventListener('input', function() {
        block.text = textarea.value;
        updateOutput(container, assembly);
      });

      var controls = document.createElement('div');
      controls.className = 'prompt-generator-move-controls';
      var up = document.createElement('button');
      up.type = 'button';
      up.className = 'lab-btn lab-btn-secondary lab-btn-sm';
      up.textContent = '↑ Вверх';
      up.disabled = index === 0;
      up.addEventListener('click', function() {
        var previous = assembly[index - 1];
        assembly[index - 1] = assembly[index];
        assembly[index] = previous;
        onChange();
      });
      var down = document.createElement('button');
      down.type = 'button';
      down.className = 'lab-btn lab-btn-secondary lab-btn-sm';
      down.textContent = '↓ Вниз';
      down.disabled = index === assembly.length - 1;
      down.addEventListener('click', function() {
        var next = assembly[index + 1];
        assembly[index + 1] = assembly[index];
        assembly[index] = next;
        onChange();
      });
      controls.appendChild(up);
      controls.appendChild(down);

      item.appendChild(head);
      item.appendChild(textarea);
      item.appendChild(controls);
      list.appendChild(item);
    });
    updateOutput(container, assembly);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog, form) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    if (form) form.reset();
  }

  function init(container) {
    if (!container || container.dataset.promptGeneratorReady === '1') return;
    container.dataset.promptGeneratorReady = '1';
    container.innerHTML = '<div class="prompt-generator-loading">Загрузка конструктора…</div>';

    Promise.all([
      fetch(PAGE_PATH).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + PAGE_PATH);
        return response.text();
      }),
      fetch(DATA_PATH).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + DATA_PATH);
        return response.json();
      })
    ]).then(function(result) {
      var data = result[1] || {};
      var readyBlocks = Array.isArray(data.blocks) ? data.blocks.filter(isValidBlock) : [];
      if (!readyBlocks.length) throw new Error('Готовые блоки не найдены');
      var customBlocks = readCustomBlocks();
      var allBlocks = readyBlocks.concat(customBlocks);
      var assembly = [];
      container.innerHTML = result[0];

      function refresh() {
        renderAssembly(container, assembly, refresh);
      }

      function addBlock(block) {
        assembly.push({
          instanceId: block.id + '-' + Date.now() + '-' + assembly.length,
          sourceId: block.id,
          title: block.title,
          text: block.text
        });
        refresh();
        setStatus(container, 'Блок добавлен в сборку.', 'success');
      }

      activeAddBlock = addBlock;
      if (pendingExternalBlocks.length) {
        pendingExternalBlocks.forEach(addBlock);
        pendingExternalBlocks = [];
      }

      renderLibrary(container, allBlocks, addBlock);
      refresh();

      var clearButton = container.querySelector('#prompt-generator-clear');
      var copyButton = container.querySelector('#prompt-generator-copy');
      var createButton = container.querySelector('#prompt-generator-create');
      var dialog = container.querySelector('#prompt-generator-dialog');
      var form = container.querySelector('#prompt-generator-custom-form');
      var dialogClose = container.querySelector('#prompt-generator-dialog-close');
      var dialogCancel = container.querySelector('#prompt-generator-dialog-cancel');
      var customStatus = container.querySelector('#prompt-generator-custom-status');

      if (clearButton) clearButton.addEventListener('click', function() {
        assembly.length = 0;
        refresh();
        setStatus(container, 'Сборка очищена.', 'success');
      });
      if (copyButton) copyButton.addEventListener('click', function() {
        copyButton.disabled = true;
        copyText(container).then(function(success) {
          copyButton.disabled = !container.querySelector('#prompt-generator-output').value;
          if (!success) setStatus(container, 'Не удалось скопировать текст.', 'error');
        });
      });
      if (createButton) createButton.addEventListener('click', function() { openDialog(dialog); });
      if (dialogClose) dialogClose.addEventListener('click', function() { closeDialog(dialog, form); });
      if (dialogCancel) dialogCancel.addEventListener('click', function() { closeDialog(dialog, form); });
      if (dialog) dialog.addEventListener('click', function(event) {
        if (event.target === dialog) closeDialog(dialog, form);
      });
      if (form) form.addEventListener('submit', function(event) {
        event.preventDefault();
        var titleField = form.querySelector('[name="title"]');
        var textField = form.querySelector('[name="text"]');
        var title = titleField ? titleField.value.trim() : '';
        var text = textField ? textField.value.trim() : '';
        if (!title || !text) {
          if (customStatus) customStatus.textContent = 'Заполните название и текст блока.';
          return;
        }
        var customBlock = {
          id: 'custom_' + Date.now(),
          title: title,
          text: text,
          custom: true
        };
        customBlocks.push(customBlock);
        if (!saveCustomBlocks(customBlocks)) {
          if (customStatus) customStatus.textContent = 'Не удалось сохранить блок в браузере.';
          customBlocks.pop();
          return;
        }
        allBlocks.push(customBlock);
        renderLibrary(container, allBlocks, addBlock);
        closeDialog(dialog, form);
        setStatus(container, 'Кастомный блок сохранён и добавлен в панель.', 'success');
      });
    }).catch(function(error) {
      container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить конструктор: ' + escapeHtml(error.message) + '</div>';
      container.dataset.promptGeneratorReady = '0';
    });
  }

  function addExternalBlock(title, text) {
    var block = { id: 'ext_' + Date.now(), title: title, text: text };
    if (activeAddBlock) {
      activeAddBlock(block);
    } else {
      pendingExternalBlocks.push(block);
    }
  }

  window.PromptGenerator = { init: init, addExternalBlock: addExternalBlock };
})(window, document);
/**
 * vision-ui.js — Визуальный анализатор v2
 * Bug #6 fix: сохранение режима в localStorage
 */

const VisionUI = (function() {
  'use strict';

  const HF_API_URL = 'https://api-inference.huggingface.co/models/HuggingFaceTB/SmolVLM-256M-Instruct';
  const LOCAL_API_URL = 'http://localhost:8000/describe';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const API_KEY_STORAGE = 'alephy_hf_api_key';
  const MODE_STORAGE = 'alephy_vision_mode';

  let toastTimer = null;

  let state = {
    mode: localStorage.getItem(MODE_STORAGE) || 'huggingface',
    currentBase64: null,
    isAnalyzing: false
  };

  function init() {
    var savedKey = localStorage.getItem(API_KEY_STORAGE);
    if (savedKey) {
      var el = document.getElementById('vi-apikey');
      if (el) el.value = savedKey;
    }
    // Восстанавливаем режим
    setMode(state.mode);
  }

  // Выбранный режим показываем золотой заливкой сегмента и aria-pressed,
  // а не подменой базовых lab-btn классов — иначе теряется база сегмента.
  function setMode(mode) {
    state.mode = mode;
    localStorage.setItem(MODE_STORAGE, mode);
    document.querySelectorAll('#vision .vi-segment-btn').forEach(function(btn) {
      var active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var note = document.getElementById('vi-mode-note');
    if (note) {
      note.textContent = mode === 'local'
        ? 'Локальный сервер: изображение не покидает машину. Ключ не нужен.'
        : 'Hugging Face Inference API: нужен бесплатный ключ, снимок уходит на внешний сервис.';
    }
    var endpoint = document.getElementById('vi-endpoint');
    if (endpoint) endpoint.textContent = mode === 'local' ? LOCAL_API_URL : HF_API_URL;
    var rMode = document.getElementById('vi-r-mode');
    if (rMode) {
      rMode.textContent = mode === 'local' ? 'локальный сервер' : 'Hugging Face API';
    }
  }

  function saveKey() {
    var el = document.getElementById('vi-apikey');
    if (el && el.value.trim()) {
      localStorage.setItem(API_KEY_STORAGE, el.value.trim());
      showToast('API ключ сохранён');
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
      showToast('API ключ удалён');
    }
  }

  // Drag & drop: файл приходит в dataTransfer, а не в input.files, поэтому
  // проверку формата и размера выносим в общий acceptFile.
  function dragOver(event) {
    event.preventDefault();
    var drop = event.currentTarget;
    if (drop) drop.classList.add('is-over');
  }

  function dragLeave(event) {
    var drop = event.currentTarget;
    if (drop) drop.classList.remove('is-over');
  }

  function drop(event) {
    event.preventDefault();
    var zone = event.currentTarget;
    if (zone) zone.classList.remove('is-over');
    var files = event.dataTransfer && event.dataTransfer.files;
    if (files && files[0]) acceptFile(files[0]);
  }

  function acceptFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError('Неподдерживаемый формат. Используйте PNG, JPG или WEBP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError('Файл слишком большой. Максимум 10 МБ.');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      state.currentBase64 = e.target.result;
      var img = document.getElementById('vi-img');
      if (img) {
        img.onload = function() { renderFileMeta(file, img.naturalWidth, img.naturalHeight); };
        img.src = state.currentBase64;
      }
      var preview = document.getElementById('vi-preview');
      if (preview) preview.style.display = 'flex';
      var placeholder = document.getElementById('vi-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      var btn = document.getElementById('vi-analyze-btn');
      if (btn) btn.disabled = false;
      setStatus('Изображение загружено. Можно запускать анализ.', 'success');
      hideError();
    };
    reader.readAsDataURL(file);
  }

  // Имя, вес и реальные пиксели: пользователь должен видеть, что именно
  // уйдёт в модель, иначе результат невозможно соотнести со снимком.
  function renderFileMeta(file, width, height) {
    var meta = document.getElementById('vi-file-meta');
    if (!meta) return;
    var parts = [file.name, formatBytes(file.size)];
    if (width && height) parts.push(width + '×' + height);
    meta.textContent = parts.join(' · ');
    var rFile = document.getElementById('vi-r-file');
    if (rFile) rFile.textContent = file.name + ' · ' + formatBytes(file.size);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function load(event) {
    var file = event.target.files[0];
    if (!file) return;
    acceptFile(file);
  }

  function remove() {
    state.currentBase64 = null;
    var img = document.getElementById('vi-img');
    if (img) img.src = '';
    var meta = document.getElementById('vi-file-meta');
    if (meta) meta.textContent = '';
    var rFile = document.getElementById('vi-r-file');
    if (rFile) rFile.textContent = 'не выбран';
    var preview = document.getElementById('vi-preview');
    if (preview) preview.style.display = 'none';
    var placeholder = document.getElementById('vi-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    var fileInput = document.getElementById('vi-file');
    if (fileInput) fileInput.value = '';
    var btn = document.getElementById('vi-analyze-btn');
    if (btn) btn.disabled = true;
    var result = document.getElementById('vi-result');
    if (result) result.style.display = 'none';
    setStatus('');
    hideError();
  }

  function copyResult() {
    var body = document.getElementById('vi-result-body');
    var text = body ? body.textContent.trim() : '';
    if (!text) {
      showToast('Пока нечего копировать');
      return;
    }
    var done = function() { showToast('Описание скопировано'); };
    var failed = function() { showToast('Браузер запретил доступ к буферу'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, failed);
    } else {
      failed();
    }
  }

  async function analyze() {
    if (state.isAnalyzing || !state.currentBase64) return;

    var key = document.getElementById('vi-apikey') ? document.getElementById('vi-apikey').value.trim() : '';
    if (state.mode === 'huggingface' && !key) {
      showError('Введите API ключ Hugging Face.');
      return;
    }

    state.isAnalyzing = true;
    var btn = document.getElementById('vi-analyze-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-circle" aria-hidden="true"></i> Анализ…';
      if (window.LabIcons) window.LabIcons.sync();
    }
    var spinner = document.getElementById('vi-spinner');
    if (spinner) spinner.classList.add('show');
    var result = document.getElementById('vi-result');
    if (result) result.style.display = 'none';
    setStatus('Модель читает изображение…');
    hideError();

    try {
      var description;
      if (state.mode === 'huggingface') {
        description = await analyzeHF(key);
      } else {
        description = await analyzeLocal();
      }

      var body = document.getElementById('vi-result-body');
      if (body) body.textContent = description;
      var badge = document.getElementById('vi-model-badge');
      if (badge) badge.textContent = state.mode === 'huggingface' ? 'SmolVLM-256M (HF)' : 'SmolVLM-256M (Local)';
      var ts = document.getElementById('vi-timestamp');
      if (ts) ts.textContent = new Date().toLocaleString('ru-RU');
      if (result) result.style.display = 'flex';
      setStatus('Описание готово.', 'success');

    } catch (err) {
      showError(err.message || 'Ошибка анализа.');
      console.error('[VisionUI]', err);
    } finally {
      state.isAnalyzing = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="image" aria-hidden="true"></i> Анализировать';
        if (window.LabIcons) window.LabIcons.sync();
      }
      if (spinner) spinner.classList.remove('show');
    }
  }

  async function analyzeHF(apiKey) {
    var base64Data = state.currentBase64.split(',')[1];
    var response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          image: base64Data,
          prompt: 'Опиши подробно, что изображено на этой картинке. Обрати внимание на текст, символы, знаки, объекты и их расположение. Если видишь древние письмена, символы или подозрительные элементы — укажи их.'
        },
        parameters: { max_new_tokens: 500, temperature: 0.2, top_p: 0.95 }
      })
    });

    if (!response.ok) {
      var errMsg = 'Ошибка API: ' + response.status;
      try {
        var errData = await response.json();
        if (errData.error) errMsg += ' — ' + errData.error;
      } catch(e) {}
      throw new Error(errMsg);
    }

    var data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].generated_text || JSON.stringify(data[0]);
    }
    return data.generated_text || JSON.stringify(data);
  }

  async function analyzeLocal() {
    var response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: state.currentBase64,
        prompt: 'Опиши подробно, что изображено на этой картинке.'
      })
    });

    if (!response.ok) {
      var errMsg = 'Ошибка сервера: ' + response.status;
      try {
        var errData = await response.json();
        if (errData.detail) errMsg += ' — ' + errData.detail;
      } catch(e) {}
      throw new Error(errMsg);
    }

    var data = await response.json();
    return data.description || data.text || data.result || JSON.stringify(data);
  }

  function showError(msg) {
    var el = document.getElementById('vi-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
    setStatus('', 'error');
  }

  function hideError() {
    var el = document.getElementById('vi-error');
    if (el) el.style.display = 'none';
  }

  // Строка статуса в ячейке «Анализ» — служебный текст без рамки (§4.1/§4.6).
  function setStatus(text, tone) {
    var el = document.getElementById('vi-status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.remove('is-success', 'is-error');
    if (tone === 'success' || tone === 'error') el.classList.add('is-' + tone);
  }

  // Тост оформлен классом .vi-toast (css/vision.css): оверлей на токенах,
  // литералы цветов в JS запрещены DESIGN-SYSTEM §1.1.
  function showToast(msg) {
    var t = document.getElementById('vision-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'vision-toast';
      t.className = 'vi-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { t.classList.remove('is-open'); }, 2000);
  }

  return {
    init: init,
    setMode: setMode,
    saveKey: saveKey,
    load: load,
    remove: remove,
    analyze: analyze,
    copyResult: copyResult,
    dragOver: dragOver,
    dragLeave: dragLeave,
    drop: drop
  };
})();

/**
 * exposure-editor.js — «Рабочий стол исследователя»
 * Форма создания разоблачения с живым превью, drag-and-drop секций,
 * сохранением черновиков в localStorage и экспортом.
 */

const ExposureEditor = (function() {
  'use strict';

  // ===== КОНСТАНТЫ =====
  var STORAGE_KEY = 'alephy_exposure_drafts';
  var CATEGORIES = [
    'linguistic', 'historical', 'theological', 'social',
    'economic', 'political', 'technological', 'other'
  ];
  var CONFIDENCE_LEVELS = [
    { value: 'low', label: 'Низкая (требуется верификация)' },
    { value: 'medium', label: 'Средняя (частично подтверждено)' },
    { value: 'high', label: 'Высокая (подтверждено источниками)' },
    { value: 'certain', label: 'Достоверно (множественные источники)' }
  ];
  var STATUSES = [
    { value: 'draft', label: 'Черновик' },
    { value: 'review', label: 'На проверке' },
    { value: 'published', label: 'Опубликовано' }
  ];

  // ===== СОСТОЯНИЕ =====
  var state = {
    title: '',
    category: '',
    description: '',
    sections: [],
    roots: '',
    sources: '',
    confidence: 'medium',
    status: 'draft'
  };

  var container = null;
  var editingId = null;

  // ===== ВСПОМОГАТЕЛЬНЫЕ =====
  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : text;
    return d.innerHTML;
  }

  function generateId() {
    return 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  // ===== TOAST =====
  function showToast(msg) {
    var t = document.getElementById('exposure-toast-global');
    if (!t) {
      t = document.createElement('div');
      t.id = 'exposure-toast-global';
      t.className = 'exposure-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  // ===== СОХРАНЕНИЕ ЧЕРНОВИКОВ =====
  function getDrafts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch(e) {
      return [];
    }
  }

  function saveDrafts(drafts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch(e) {
      showToast('Ошибка сохранения черновиков');
    }
  }

  function saveCurrentDraft(publish) {
    var drafts = getDrafts();
    var draft = {
      id: editingId || generateId(),
      title: state.title,
      category: state.category,
      description: state.description,
      sections: state.sections.map(function(s) { return { title: s.title, content: s.content }; }),
      roots: state.roots,
      sources: state.sources,
      confidence: state.confidence,
      status: publish ? 'published' : 'draft',
      updatedAt: new Date().toISOString(),
      createdAt: editingId ? (drafts.filter(function(d) { return d.id === editingId; })[0] || {}).createdAt || new Date().toISOString() : new Date().toISOString()
    };

    var idx = -1;
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i].id === draft.id) { idx = i; break; }
    }
    if (idx >= 0) {
      drafts[idx] = draft;
    } else {
      drafts.push(draft);
    }
    saveDrafts(drafts);
    editingId = draft.id;
    return draft;
  }

  // ===== ЗАГРУЗКА ЧЕРНОВИКА =====
  function loadDraft(id) {
    var drafts = getDrafts();
    var draft = null;
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i].id === id) { draft = drafts[i]; break; }
    }
    if (!draft) { showToast('Черновик не найден'); return; }

    editingId = draft.id;
    state.title = draft.title || '';
    state.category = draft.category || '';
    state.description = draft.description || '';
    state.sections = (draft.sections || []).map(function(s) { return { title: s.title || '', content: s.content || '' }; });
    state.roots = draft.roots || '';
    state.sources = draft.sources || '';
    state.confidence = draft.confidence || 'medium';
    state.status = draft.status || 'draft';
    renderForm();
  }

  // ===== УДАЛЕНИЕ ЧЕРНОВИКА =====
  function deleteDraft(id) {
    var drafts = getDrafts().filter(function(d) { return d.id !== id; });
    saveDrafts(drafts);
    if (editingId === id) {
      editingId = null;
      resetState();
    }
    if (container) renderForm();
    showToast('Черновик удалён');
  }

  // ===== СБРОС СОСТОЯНИЯ =====
  function resetState() {
    state = {
      title: '',
      category: '',
      description: '',
      sections: [],
      roots: '',
      sources: '',
      confidence: 'medium',
      status: 'draft'
    };
    editingId = null;
  }

  // ===== РЕНДЕР ФОРМЫ =====
  function renderForm() {
    if (!container) return;
    container.innerHTML = '';
    container.className = 'module active';
    container.style.display = 'block';

    var wrap = document.createElement('div');
    wrap.className = 'exposure-editor-wrap';
    wrap.innerHTML = buildHeader() + buildLayout();
    container.appendChild(wrap);

    bindEvents();
    updatePreview();
    updateToc();
  }

  function buildHeader() {
    var label = editingId ? 'Редактировать разоблачение' : 'Новое разоблачение';
    return '<div class="exposure-editor-header">' +
'<h1><img src="assets/icons/32/archaeology/lamp.png" alt="">' + esc(label) + '</h1>' +
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="ExposureEditor.showDrafts()">' +
      '📋 Черновики (' + getDrafts().length + ')</button>' +
      '</div>';
  }

  function buildLayout() {
    return '<div class="exposure-editor-layout">' +
      buildToc() +
      buildMain() +
      buildPreview() +
      '</div>';
  }

  // ===== МИНИ-ОГЛАВЛЕНИЕ =====
  function buildToc() {
    var items = [
      { id: 'block-basic', label: 'Основные данные' },
      { id: 'block-sections', label: 'Секции' },
      { id: 'block-meta', label: 'Метаданные' }
    ];
    var html = '<div class="exposure-editor-toc">' +
      '<div class="exposure-toc-title">📑 Содержание</div>';
    items.forEach(function(item) {
      html += '<button class="exposure-toc-item" data-scroll-to="' + item.id + '">' + esc(item.label) + '</button>';
    });
    html += '</div>';
    return html;
  }

  // ===== ОСНОВНАЯ ФОРМА =====
  function buildMain() {
    return '<div class="exposure-editor-main" id="exposure-editor-main">' +
      buildBlockBasic() +
      buildBlockSections() +
      buildBlockMeta() +
      buildActions() +
      '</div>';
  }

  function buildBlockBasic() {
    var catOptions = '<option value="">Выберите категорию</option>';
    CATEGORIES.forEach(function(c) {
      catOptions += '<option value="' + c + '"' + (state.category === c ? ' selected' : '') + '>' + esc(categoryLabel(c)) + '</option>';
    });

    return '<div class="exposure-form-block" id="block-basic">' +
      '<div class="exposure-form-block-title">📝 Основные данные</div>' +
      '<div class="exposure-field">' +
        '<label>Название разоблачения</label>' +
        '<input class="lab-input" id="ef-title" type="text" value="' + esc(state.title) + '" placeholder="Например: Подмена понятия «жертва»">' +
      '</div>' +
      '<div class="exposure-field">' +
        '<label>Категория</label>' +
        '<select class="lab-input lab-select" id="ef-category">' + catOptions + '</select>' +
      '</div>' +
      '<div class="exposure-field">' +
        '<label>Описание</label>' +
        '<textarea class="lab-textarea" id="ef-description" rows="3" placeholder="Краткое описание разоблачения (2-3 предложения)">' + esc(state.description) + '</textarea>' +
      '</div>' +
    '</div>';
  }

  function buildBlockSections() {
    var sectionsHtml = '';
    if (state.sections.length === 0) {
      sectionsHtml = '<div class="lab-alert lab-alert-info" style="margin-bottom:12px;">Секции не добавлены. Нажмите «➕ Добавить секцию».</div>';
    } else {
      sectionsHtml = '<div class="exposure-sections-list" id="ef-sections-list">';
      state.sections.forEach(function(section, idx) {
        sectionsHtml += buildSectionItem(section, idx);
      });
      sectionsHtml += '</div>';
    }

    return '<div class="exposure-form-block" id="block-sections">' +
      '<div class="exposure-form-block-title" style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span>📄 Секции</span>' +
        '<button class="lab-btn lab-btn-secondary lab-btn-sm" id="ef-add-section" type="button">➕ Добавить секцию</button>' +
      '</div>' +
      sectionsHtml +
    '</div>';
  }

  function buildSectionItem(section, idx) {
    return '<div class="exposure-section-item" data-section-index="' + idx + '">' +
      '<div class="exposure-section-header">' +
        '<span class="drag-handle" title="Перетащить">⠿</span>' +
        '<input class="lab-input exposure-section-title-input" type="text" data-section-field="title" data-section-idx="' + idx + '" value="' + esc(section.title) + '" placeholder="Заголовок секции">' +
        '<button class="exposure-section-remove" data-section-idx="' + idx + '" type="button" title="Удалить секцию">✕</button>' +
      '</div>' +
      '<div class="exposure-section-content-input">' +
        '<textarea class="lab-textarea" data-section-field="content" data-section-idx="' + idx + '" rows="3" placeholder="Содержание секции...">' + esc(section.content) + '</textarea>' +
      '</div>' +
    '</div>';
  }

  function buildBlockMeta() {
    var confOptions = '';
    CONFIDENCE_LEVELS.forEach(function(c) {
      confOptions += '<option value="' + c.value + '"' + (state.confidence === c.value ? ' selected' : '') + '>' + esc(c.label) + '</option>';
    });
    var statusOptions = '';
    STATUSES.forEach(function(s) {
      statusOptions += '<option value="' + s.value + '"' + (state.status === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    });

    return '<div class="exposure-form-block" id="block-meta">' +
      '<div class="exposure-form-block-title">🔬 Метаданные</div>' +
      '<div class="exposure-field">' +
        '<label>Корни (ивритские, через запятую)</label>' +
        '<input class="lab-input" id="ef-roots" type="text" value="' + esc(state.roots) + '" placeholder="например: ק.ר.ב, כ.פ.ר, ג.א.ל">' +
      '</div>' +
      '<div class="exposure-field">' +
        '<label>Источники (ссылки, через запятую)</label>' +
        '<textarea class="lab-textarea" id="ef-sources" rows="2" placeholder="Ссылки на источники, документы, стихи ТаНаХа">' + esc(state.sources) + '</textarea>' +
      '</div>' +
      '<div class="exposure-field">' +
        '<label>Уровень уверенности</label>' +
        '<select class="lab-input lab-select" id="ef-confidence">' + confOptions + '</select>' +
      '</div>' +
      '<div class="exposure-field">' +
        '<label>Статус</label>' +
        '<select class="lab-input lab-select" id="ef-status">' + statusOptions + '</select>' +
      '</div>' +
    '</div>';
  }

  function buildActions() {
    return '<div class="exposure-editor-actions">' +
      '<button class="lab-btn lab-btn-secondary" id="ef-save-draft" type="button">💾 Сохранить как черновик</button>' +
      '<button class="lab-btn lab-btn-primary" id="ef-publish" type="button">📢 Опубликовать</button>' +
      '<button class="lab-btn lab-btn-secondary" id="ef-preview-toggle" type="button">👁 Предпросмотр</button>' +
      '<button class="lab-btn lab-btn-danger" id="ef-cancel" type="button" style="margin-left:auto;">✕ Отмена</button>' +
    '</div>';
  }

  // ===== ПРЕВЬЮ =====
  function buildPreview() {
    return '<div class="exposure-editor-preview">' +
      '<div class="exposure-preview-card" id="ef-preview-card">' +
        '<div class="exposure-preview-title">👁 Живое превью</div>' +
        '<div id="ef-preview-content">' +
          '<div class="exposure-preview-empty">Заполните форму — превью появится здесь</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function updatePreview() {
    var el = document.getElementById('ef-preview-content');
    if (!el) return;

    if (!state.title && !state.description) {
      el.innerHTML = '<div class="exposure-preview-empty">Заполните форму — превью появится здесь</div>';
      return;
    }

    var statusLabel = '';
    STATUSES.forEach(function(s) {
      if (s.value === state.status) statusLabel = s.label;
    });

    var sectionsHtml = '';
    if (state.sections.length > 0) {
      sectionsHtml = '<div class="exposure-preview-sections"><strong>Секции:</strong>';
      state.sections.forEach(function(section) {
        if (section.title) {
          sectionsHtml += '<div class="exposure-preview-section-item"><strong>' + esc(section.title) + '</strong> — ' + esc(section.content.substring(0, 80)) + (section.content.length > 80 ? '...' : '') + '</div>';
        }
      });
      sectionsHtml += '</div>';
    }

    var confLabel = '';
    CONFIDENCE_LEVELS.forEach(function(c) {
      if (c.value === state.confidence) confLabel = c.label;
    });

    el.innerHTML = '<div class="exposure-preview-content">' +
      '<h3>' + esc(state.title || '(без названия)') + '</h3>' +
      (state.category ? '<div class="exposure-preview-category">' + esc(categoryLabel(state.category)) + '</div>' : '') +
      (state.description ? '<div class="exposure-preview-desc">' + esc(state.description) + '</div>' : '') +
      (state.roots ? '<div class="exposure-preview-root">📎 Корни: ' + esc(state.roots) + '</div>' : '') +
      (state.sources ? '<div class="exposure-preview-source">📚 Источники: ' + esc(state.sources.substring(0, 100)) + (state.sources.length > 100 ? '...' : '') + '</div>' : '') +
      (state.confidence ? '<div class="exposure-preview-confidence">🎯 Уверенность: ' + esc(confLabel) + '</div>' : '') +
      sectionsHtml +
      '<div style="margin-top:12px;font-size:12px;color:var(--text-muted);">Статус: ' + esc(statusLabel) + '</div>' +
    '</div>';
  }

  function updateToc() {
    var items = document.querySelectorAll('.exposure-toc-item');
    items.forEach(function(item) {
      item.addEventListener('click', function(e) {
        var targetId = this.getAttribute('data-scroll-to');
        var target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ===== СИНХРОНИЗАЦИЯ ПОЛЕЙ =====
  function syncState() {
    var title = document.getElementById('ef-title');
    var category = document.getElementById('ef-category');
    var desc = document.getElementById('ef-description');
    var roots = document.getElementById('ef-roots');
    var sources = document.getElementById('ef-sources');
    var confidence = document.getElementById('ef-confidence');
    var status = document.getElementById('ef-status');

    if (title) state.title = title.value;
    if (category) state.category = category.value;
    if (desc) state.description = desc.value;
    if (roots) state.roots = roots.value;
    if (sources) state.sources = sources.value;
    if (confidence) state.confidence = confidence.value;
    if (status) state.status = status.value;

    // Синхронизация секций
    var sectionItems = document.querySelectorAll('.exposure-section-item');
    var newSections = [];
    sectionItems.forEach(function(item) {
      var idx = parseInt(item.getAttribute('data-section-index'), 10);
      var titleInput = item.querySelector('[data-section-field="title"]');
      var contentInput = item.querySelector('[data-section-field="content"]');
      if (titleInput && contentInput) {
        newSections.push({
          title: titleInput.value || '',
          content: contentInput.value || ''
        });
      }
    });
    state.sections = newSections;
  }

  // ===== БИНДИНГ СОБЫТИЙ =====
  function bindEvents() {
    // Все поля формы — обновление превью по input
    var formFields = document.querySelectorAll('#ef-title, #ef-category, #ef-description, #ef-roots, #ef-sources, #ef-confidence, #ef-status');
    formFields.forEach(function(field) {
      field.addEventListener('input', function() { syncState(); updatePreview(); });
      field.addEventListener('change', function() { syncState(); updatePreview(); });
    });

    // Секции — делегирование событий
    var main = document.getElementById('exposure-editor-main');
    if (main) {
      main.addEventListener('input', function(e) {
        if (e.target.matches('[data-section-field]')) {
          syncState();
          updatePreview();
        }
      });

      main.addEventListener('click', function(e) {
        // Удаление секции
        if (e.target.closest('.exposure-section-remove')) {
          var btn = e.target.closest('.exposure-section-remove');
          var idx = parseInt(btn.getAttribute('data-section-idx'), 10);
          if (!isNaN(idx) && idx >= 0 && idx < state.sections.length) {
            state.sections.splice(idx, 1);
            renderForm();
            showToast('Секция удалена');
          }
        }
      });
    }

    // Добавление секции
    var addBtn = document.getElementById('ef-add-section');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        state.sections.push({ title: '', content: '' });
        renderForm();
        // Скролл к последней секции
        var items = document.querySelectorAll('.exposure-section-item');
        if (items.length > 0) {
          items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // Drag and drop для секций
    var sectionsList = document.getElementById('ef-sections-list');
    if (sectionsList) {
      setupDragAndDrop(sectionsList);
    }

    // Сохранить как черновик
    var saveBtn = document.getElementById('ef-save-draft');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        syncState();
        if (!state.title) { showToast('Введите название разоблачения'); return; }
        var draft = saveCurrentDraft(false);
        showToast('Черновик «' + draft.title + '» сохранён');
      });
    }

    // Опубликовать
    var publishBtn = document.getElementById('ef-publish');
    if (publishBtn) {
      publishBtn.addEventListener('click', function() {
        syncState();
        if (!state.title) { showToast('Введите название разоблачения'); return; }
        if (state.sections.length === 0) { showToast('Добавьте хотя бы одну секцию'); return; }
        var draft = saveCurrentDraft(true);
        // Редактор хранит черновики в браузере: в корпус и на сайт ничего
        // не уходит. «Опубликовано» здесь значит «готово», а не «в продакшене».
        showToast('«' + draft.title + '» сохранено в браузере как готовое (в корпус не отправляется)');
      });
    }

    // Предпросмотр — скролл к превью
    var previewToggle = document.getElementById('ef-preview-toggle');
    if (previewToggle) {
      previewToggle.addEventListener('click', function() {
        var preview = document.querySelector('.exposure-editor-preview');
        if (preview) preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Отмена
    var cancelBtn = document.getElementById('ef-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        if (confirm('Отменить редактирование? Несохранённые данные будут потеряны.')) {
          LabRouter.navigate('researches');
        }
      });
    }
  }

  // ===== DRAG AND DROP =====
  function setupDragAndDrop(list) {
    var items = list.querySelectorAll('.exposure-section-item');
    var draggedItem = null;

    items.forEach(function(item) {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', function(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.getAttribute('data-section-index'));
      });

      item.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        document.querySelectorAll('.exposure-section-item').forEach(function(el) {
          el.classList.remove('drag-over');
        });
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (this !== draggedItem) {
          this.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (draggedItem && this !== draggedItem) {
          var fromIdx = parseInt(draggedItem.getAttribute('data-section-index'), 10);
          var toIdx = parseInt(this.getAttribute('data-section-index'), 10);
          if (!isNaN(fromIdx) && !isNaN(toIdx)) {
            // Перемещаем секцию
            var moved = state.sections.splice(fromIdx, 1)[0];
            state.sections.splice(toIdx, 0, moved);
            renderForm();
            showToast('Секция перемещена');
          }
        }
        draggedItem = null;
      });
    });
  }

  // ===== ДОСКА ЧЕРНОВИКОВ =====
  function showDrafts() {
    if (!container) return;
    var drafts = getDrafts();
    if (drafts.length === 0) {
      showToast('Нет сохранённых черновиков');
      return;
    }

    // Показываем через LabModal
    var html = '<div class="exposure-drafts-board">' +
      '<div class="exposure-drafts-grid">';
    drafts.sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
    drafts.forEach(function(d) {
      var statusIcon = d.status === 'published' ? '📢' : '📝';
      html += '<div class="exposure-draft-card" data-draft-id="' + esc(d.id) + '">' +
        '<div class="draft-title">' + esc(d.title || '(без названия)') + '</div>' +
        '<div class="draft-status">' + statusIcon + ' ' + esc(d.status === 'published' ? 'Опубликовано' : 'Черновик') + '</div>' +
        '<div class="draft-meta">' + esc(new Date(d.updatedAt).toLocaleString('ru-RU')) + '</div>' +
        '<div class="draft-actions">' +
          '<button class="lab-btn lab-btn-secondary lab-btn-sm" data-action="load" data-draft-id="' + esc(d.id) + '">✏️ Редактировать</button>' +
          '<button class="lab-btn lab-btn-danger lab-btn-sm" data-action="delete" data-draft-id="' + esc(d.id) + '" style="margin-left:auto;">🗑</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div></div>';

    LabModal.show(
'<img src="assets/icons/32/scribe/scrolls.png" width="28" height="28" alt="" style="vertical-align:middle;margin-right:8px;"> Черновики разоблачений',
      html,
      '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>'
    );

    // Биндинг кнопок в модалке
    setTimeout(function() {
      var cards = document.querySelectorAll('.exposure-draft-card');
      cards.forEach(function(card) {
        var loadBtn = card.querySelector('[data-action="load"]');
        var deleteBtn = card.querySelector('[data-action="delete"]');
        if (loadBtn) {
          loadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = this.getAttribute('data-draft-id');
            LabModal.close();
            setTimeout(function() { loadDraft(id); }, 200);
          });
        }
        if (deleteBtn) {
          deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Удалить черновик?')) {
              var id = this.getAttribute('data-draft-id');
              deleteDraft(id);
              showDrafts(); // обновить список
            }
          });
        }
        // Клик по карточке — редактировать
        card.addEventListener('click', function(e) {
          if (e.target.closest('.draft-actions')) return;
          var id = this.getAttribute('data-draft-id');
          LabModal.close();
          setTimeout(function() { loadDraft(id); }, 200);
        });
      });
    }, 100);
  }

  // ===== ВСПОМОГАТЕЛЬНАЯ =====
  function categoryLabel(val) {
    var labels = {
      'linguistic': 'Языковая подмена',
      'historical': 'Историческая подмена',
      'theological': 'Богословская подмена',
      'social': 'Социальная подмена',
      'economic': 'Экономическая подмена',
      'political': 'Политическая подмена',
      'technological': 'Технологическая подмена',
      'other': 'Прочее'
    };
    return labels[val] || val;
  }

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    init: function(el) {
      container = el;
      resetState();
      renderForm();
    },
    render: function(el) {
      container = el;
      renderForm();
    },
    showDrafts: showDrafts,
    reset: function() {
      resetState();
      if (container) renderForm();
    },
    categoryLabel: categoryLabel
  };
})();

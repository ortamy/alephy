/**
 * club.js — Палео-клуб: лента исследований, деталь, комментарии.
 * Данные через ClubData (MOCK или Supabase).
 */

const ClubModule = (function() {
  'use strict';

  var STORAGE_KEY = 'alephy_waitlist';
  var currentCardId = null;
  var isCreateRoute = false;

  function escapeHtml(text) {
    var el = document.createElement('div');
    el.textContent = text == null ? '' : String(text);
    return el.innerHTML;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function loadWaitlist() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveWaitlist(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function alreadyExists(email) {
    var list = loadWaitlist();
    return list.some(function(item) {
      return item.email.toLowerCase() === email.toLowerCase();
    });
  }

  function addToWaitlist(email) {
    return new Promise(function(resolve) {
      if (!isValidEmail(email)) {
        resolve({ ok: false, error: 'Введите корректный email.' });
        return;
      }
      if (alreadyExists(email)) {
        resolve({ ok: false, duplicate: true, message: 'Вы уже в списке.' });
        return;
      }

      var list = loadWaitlist();
      list.push({ email: email, created_at: new Date().toISOString() });
      saveWaitlist(list);

      if (window.supabaseClient) {
        window.supabaseClient.from('waitlist').insert({ email: email }).then(function(res) {
          resolve({ ok: true, message: 'Вы в списке. Код придёт на почту.' });
        }).catch(function() {
          resolve({ ok: true, message: 'Вы в списке. Код придёт на почту.' });
        });
      } else {
        resolve({ ok: true, message: 'Вы в списке. Код придёт на почту.' });
      }
    });
  }

  function getRole() {
    return (window.AccessGate && AccessGate.getRole) ? AccessGate.getRole() : 'guest';
  }

  function render(container, parsed) {
    isCreateRoute = !!(parsed && parsed.segments && parsed.segments[1] === 'create');
    var isDiscussionsRoute = !!(parsed && parsed.segments && parsed.segments[1] === 'discussions');
    var isSessionsRoute = !!(parsed && parsed.segments && parsed.segments[1] === 'sessions');
    var discussions = container.parentNode && container.parentNode.querySelector('#club-discussions');
    var archive = container.parentNode && container.parentNode.querySelector('#club-session-archive');
    if (isCreateRoute) {
      if (discussions) discussions.innerHTML = '';
      if (archive) archive.innerHTML = '';
      renderCreate(container);
      return;
    }
    if (isDiscussionsRoute) {
      if (discussions) discussions.innerHTML = '';
      if (archive) archive.innerHTML = '';
      renderFeed(container, null, true);
      return;
    }
    if (isSessionsRoute) {
      if (discussions) discussions.innerHTML = '';
      if (archive) archive.innerHTML = '';
      renderSessions(container);
      return;
    }
    if (currentCardId) {
      if (discussions) discussions.innerHTML = '';
      if (archive) archive.innerHTML = '';
      renderDetail(container, currentCardId);
    } else {
      renderFeed(container, discussions, false, archive);
    }
  }

  function renderFeed(container, discussions, onlyDiscussions, archive) {
    if (!window.ClubData) {
      container.innerHTML = '<div class="lab-alert">Загрузка данных...</div>';
      return;
    }
    ClubData.getCards().then(function(cards) {
      var feed = buildFeedHTML(cards);
      if (onlyDiscussions) {
        container.innerHTML = feed.discussions;
        bindFeedEvents(container);
        return;
      }
      container.innerHTML = feed.top;
      if (archive) archive.innerHTML = '';
      if (discussions) {
        discussions.innerHTML = '';
      }
    });
  }

  function buildFeedHTML(cards) {
    var role = getRole();

    var cardsHtml = cards.map(function(card, i) {
      var typeLabels = { word: 'Слово', state: 'Состояние', board: 'Доска', verse: 'Стих' };
      var participants = card.participants || [];
      return '<article class="club-card reveal" data-id="' + escapeHtml(card.id) + '" data-type="' + escapeHtml(card.type || 'word') + '" style="--i:' + i + '">' +
        '<div class="club-card-head">' +
          '<span class="club-card-type type-' + (card.type || 'word') + '">' + (typeLabels[card.type] || card.type) + '</span>' +
        '</div>' +
        '<h3 class="club-card-title">' + escapeHtml(card.title) + '</h3>' +
        '<p class="club-card-synthesis">' + escapeHtml(card.synthesis) + '</p>' +
        '<div class="club-card-foot">' +
          renderAvatarStack(participants, 5) +
          '<span class="club-card-meta">· ' + (card.posts_count || 0) + ' постов · эмет: ' + (card.emet || 0) + ' · вопрос: ' + (card.questions || 0) + '</span>' +
        '</div>' +
        '<div class="club-card-actions">' +
      '<a class="lab-btn lab-btn-secondary lab-btn-sm" href="#club/' + encodeURIComponent(card.id) + '">Посмотреть</a>' +
          '<button class="lab-btn lab-btn-primary lab-btn-sm club-join" data-id="' + escapeHtml(card.id) + '">Вступить</button>' +
        '</div>' +
      '</article>';
    }).join('');

    var topPanel = buildTopPanel(role);
    return {
      top: '<div class="club-feed club-top-feed">' + topPanel + '</div>',
      discussions: '<main class="club-main club-discussions">' +
        '<div class="club-discussions-head"><div class="club-discussions-title"><h2>Обсуждения</h2></div>' +
          '<label class="club-topic-filter">Тема<select class="lab-select" id="club-topic-filter" aria-label="Фильтр обсуждений по теме"><option value="all">Все темы</option><option value="word">Слова и корни</option><option value="state">Состояния</option><option value="board">Исследовательские доски</option><option value="verse">Стихи и переводы</option></select></label>' +
        '</div>' +
        '<div class="club-cards">' + cardsHtml + '</div>' +
        '<p class="club-filter-empty" id="club-filter-empty" hidden>По этой теме пока нет обсуждений.</p>' +
      '</main>'
    };
  }

  function renderCreate(container) {
    container.innerHTML =
      '<div class="club-detail-head"><span class="club-card-type">Новая тема</span><h2>Создать обсуждение</h2><p>Опишите вопрос так, чтобы участники могли отделить факт от интерпретации и гипотезы.</p></div>' +
      '<form id="club-create-form" class="club-create-form" novalidate>' +
        '<label>Тема обсуждения *<input class="club-input" id="club-topic" required maxlength="140" placeholder="Например: Как меняется образ дома в корне אב"></label>' +
        '<label>Описание темы *<textarea class="club-textarea" id="club-description" required minlength="20" placeholder="Опишите наблюдение, контекст и границы вопроса..."></textarea></label>' +
        '<div class="club-form-grid"><label>Тип обсуждения<select class="club-input" id="club-type"><option value="question">Исследовательский вопрос</option><option value="comparison">Сравнение</option><option value="hypothesis">Гипотеза</option><option value="method">Методология</option></select></label>' +
        '<label>Уверенность<select class="club-input" id="club-confidence"><option value="needs-review">Требует проверки</option><option value="hypothesis">Рабочая гипотеза</option><option value="verified">Подтверждается</option></select></label></div>' +
        '<label>Исследовательский вопрос<textarea class="club-textarea" id="club-question" placeholder="Что именно должны проверить участники?"></textarea></label>' +
        '<label>Ожидаемый результат<textarea class="club-textarea" id="club-outcome" placeholder="Какой вывод, карту связей или контрпример нужно получить?"></textarea></label>' +
        '<fieldset><legend>Приложенные исследования из архива</legend><div id="club-research-picker" class="club-research-picker"><span class="club-picker-loading">Загрузка архива…</span></div></fieldset>' +
        '<label>Методологические ограничения и контекст<textarea class="club-textarea" id="club-context" placeholder="Какие источники, уровни уверенности и различия эмет/шекер нужно учитывать?"></textarea></label>' +
        '<label>Теги<input class="club-input" id="club-tags" placeholder="корень, образ, перевод"></label>' +
        '<div id="club-create-error" class="lab-alert lab-alert-error" hidden></div><div class="club-create-actions"><button class="lab-btn lab-btn-primary" type="submit">Опубликовать тему</button><button class="lab-btn lab-btn-secondary" type="button" id="club-save-draft">Сохранить черновик</button></div>' +
      '</form>';
    bindCreateEvents(container);
    loadResearchPicker(container);
  }

  function loadResearchPicker(container) {
    var picker = container.querySelector('#club-research-picker');
    fetch('data/exposures/index.json').then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function(items) {
      picker.innerHTML = (items || []).slice(0, 60).map(function(item) {
        return '<label class="club-research-option"><input type="checkbox" value="' + escapeHtml(item.id || item.slug) + '" data-title="' + escapeHtml(item.title) + '"><span><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.category || 'Архив') + '</small></span></label>';
      }).join('') || '<span class="club-picker-empty">Архив пока пуст.</span>';
    }).catch(function() { picker.innerHTML = '<span class="club-picker-empty">Архив недоступен. Можно сохранить тему без приложения.</span>'; });
  }

  function bindCreateEvents(container) {
    var form = container.querySelector('#club-create-form');
    var save = container.querySelector('#club-save-draft');
    function submit(status) {
      var topic = container.querySelector('#club-topic').value.trim();
      var description = container.querySelector('#club-description').value.trim();
      var error = container.querySelector('#club-create-error');
      if (!topic || description.length < 20) { error.textContent = 'Укажите тему и описание не короче 20 символов.'; error.hidden = false; return; }
      error.hidden = true;
      var selected = Array.prototype.slice.call(container.querySelectorAll('#club-research-picker input:checked')).map(function(input) { return { id: input.value, title: input.dataset.title }; });
      ClubData.addThread({ id: 'local_thread_' + Date.now(), title: topic, synthesis: description, type: 'board', ref: 'новая тема', status: status, confidence: container.querySelector('#club-confidence').value, question: container.querySelector('#club-question').value.trim(), outcome: container.querySelector('#club-outcome').value.trim(), context: container.querySelector('#club-context').value.trim(), tags: container.querySelector('#club-tags').value.split(',').map(function(tag) { return tag.trim(); }).filter(Boolean), research: selected }).then(function() { LabRouter.navigate('club'); });
    }
    if (form) form.addEventListener('submit', function(event) { event.preventDefault(); submit('published'); });
    if (save) save.addEventListener('click', function() { submit('draft'); });
  }

  function buildTopPanel(role) {
    var circlePlaceholders = [
      { id: 'shabbat', paleo: '𐤔', image: 'зуб', topic: 'Шаббат — остановка в потоке' },
      { id: 'mitsraim', paleo: '𐤌', image: 'вода', topic: 'Мицраим — сужение потока' },
      { id: 'sheol', paleo: '𐤏', image: 'глаз', topic: 'Состояние Шеол' },
      { id: 'board-avraam', paleo: '𐤀', image: 'бык', topic: 'Авраам — отец множества' }
    ];
    var circlesChips = circlePlaceholders.map(function(circle) {
      return '<a class="club-circle-chip paleo" href="#club/' + encodeURIComponent(circle.id) + '" title="' + circle.topic + ' — образ: ' + circle.image + '" aria-label="Открыть обсуждение: ' + circle.topic + '">' + circle.paleo + '</a>';
    }).join('');
    var circlesBlock = circlePlaceholders.length ?
      '<span class="club-circle-chips">' + circlesChips + '</span>' :
      '<span class="club-pulse-note">Нет кругов — создайте первый.</span>';
    var previewSessions = (ClubData.MOCK.sessions || []).slice(0, 2);
    var sessionsBlock = previewSessions.length ?
      '<div class="club-session-grid">' + previewSessions.map(buildSessionCard).join('') + '</div>' :
      '<div class="club-empty" role="status"><span class="club-empty-glyph" aria-hidden="true">𐤀</span><p>Сессий пока нет — поле ждёт первый знак.</p></div>';

    var groups = '<section class="club-group" aria-label="Круг">' +
        '<div class="club-group-head"><span class="club-group-label">Круг</span><span class="club-group-line" aria-hidden="true"></span></div>' +
        '<p class="club-group-desc">Создайте тему, соберите контекст и пригласите участников к проверяемому обсуждению.</p>' +
        '<div class="club-group-actions">' +
          '<a class="lab-btn lab-btn-primary lab-btn-sm" href="#club/create">Создать обсуждение</a>' +
          '<a class="lab-btn lab-btn-secondary lab-btn-sm" href="#club/discussions">Обсуждения</a>' +
        '</div>' +
      '</section>' +
      '<section class="club-group" aria-label="Пульс клуба">' +
        '<div class="club-group-head"><span class="club-group-label">Пульс</span><span class="club-group-line" aria-hidden="true"></span></div>' +
        '<div class="club-pulse-strip">' +
          '<div class="club-pulse-cluster">' +
            renderAvatarStack(ClubData.MOCK.profiles, 5) +
            '<span class="club-pulse-note">6 онлайн</span>' +
          '</div>' +
          '<div class="club-pulse-sep" aria-hidden="true"></div>' +
          '<div class="club-pulse-cluster"><span class="club-pulse-note">Мои круги</span>' + circlesBlock + '</div>' +
          '<div class="club-pulse-sep" aria-hidden="true"></div>' +
          '<div class="club-pulse-cluster club-pulse-session">' +
            '<span class="club-pulse-session-title">Как рождается значение</span>' +
            '<span class="club-pulse-session-meta">Сегодня, 19:00</span>' +
            '<span class="club-status-chip is-active"><i aria-hidden="true"></i>Идёт сейчас</span>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="club-group" aria-label="Сессии">' +
        '<div class="club-group-head"><span class="club-group-label">Сессии</span><span class="club-group-badge" aria-label="Количество сессий">' + (ClubData.MOCK.sessions || []).length + '</span><span class="club-group-line" aria-hidden="true"></span></div>' +
        sessionsBlock +
      '</section>';

    var subscribeHtml = role === 'guest' ?
      '<section class="club-subscribe" aria-label="Подписка на открытие клуба">' +
        '<span class="club-subscribe-note">Оставьте email — мы пришлём код для входа.</span>' +
        '<input type="email" id="club-email" class="club-input" placeholder="your@email.com" aria-label="Email для уведомления">' +
        '<button class="lab-btn lab-btn-primary lab-btn-sm" id="club-submit">Сообщить</button>' +
        '<div id="club-notice" class="club-notice" style="display:none;"></div>' +
      '</section>' : '';

    return groups + subscribeHtml;
  }

  function sessionStatusLabel(status) {
    return { active: 'Идёт сейчас', upcoming: 'Предстоящая', completed: 'Завершена' }[status] || 'Сессия';
  }

  function buildSessionCard(session) {
    var progress = typeof session.progress === 'number' && session.progress > 0 ?
      '<div class="club-session-progress" role="progressbar" aria-valuenow="' + session.progress + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + session.progress + '%"></span></div>' +
      '<small class="club-session-progress-meta">' + session.progress + '% · ' + session.participants + '/' + session.capacity + '</small>' : '';
    return '<article class="club-session-card club-session-' + escapeHtml(session.status) + '">' +
      '<div class="club-session-card-head"><span class="club-session-status"><i aria-hidden="true"></i>' + sessionStatusLabel(session.status) + '</span><time>' + escapeHtml(session.date) + '</time></div>' +
      '<h3>' + escapeHtml(session.title) + '</h3>' +
      '<p class="club-session-card-findings">' + escapeHtml(session.findings) + '</p>' +
      '<div class="club-session-card-foot">' + progress +
        '<a class="lab-btn lab-btn-secondary lab-btn-sm club-session-join" href="#club/sessions">' + escapeHtml(session.action) + '</a>' +
      '</div>' +
    '</article>';
  }

  function renderSessions(container) {
    if (!window.ClubData || !ClubData.getSessions) {
      container.innerHTML = '<div class="lab-alert">Архив сессий пока недоступен.</div>';
      return;
    }
    ClubData.getSessions().then(function(sessions) {
      var order = { active: 0, upcoming: 1, completed: 2 };
      sessions.sort(function(a, b) { return order[a.status] - order[b.status]; });
      container.innerHTML = '<main class="club-sessions-page"><div class="club-sessions-intro"><span class="club-card-type">Живая хроника</span><h1>Архив сессий</h1><p>Здесь остаются маршруты, которые клуб проходит вместе: текущие, будущие и уже проверенные встречи.</p></div><div class="club-sessions-timeline" aria-label="Хронология сессий">' + sessions.map(buildSessionCard).join('') + '</div><a class="lab-btn lab-btn-secondary" href="#club">Вернуться в клуб</a></main>';
    }).catch(function() { container.innerHTML = '<div class="lab-alert lab-alert-error">Не удалось загрузить архив сессий.</div>'; });
  }

  function renderDetail(container, cardId) {
    if (!window.ClubData) {
      container.innerHTML = '<div class="lab-alert">Загрузка...</div>';
      return;
    }
    Promise.all([ClubData.getCard(cardId), ClubData.getComments(cardId)]).then(function(results) {
      var card = results[0];
      var comments = results[1];
      if (!card) {
        container.innerHTML = '<div class="lab-alert">Исследование не найдено.</div>';
        return;
      }
      currentCardId = cardId;
      container.innerHTML = buildDetailHTML(card, comments);
      bindDetailEvents(container);
    });
  }

  function buildDetailHTML(card, comments) {
    var role = getRole();
    var typeLabels = { word: 'Слово', state: 'Состояние', board: 'Доска', verse: 'Стих' };
    var participants = card.participants || [];

    var commentsHtml = comments.map(function(c) {
      var author = (window.ClubData && window.ClubData.getProfile) ? window.ClubData.getProfile(c.author) : { handle: '?', initial: '?', color: '#999' };
      var attachHtml = c.attachment ? '<a class="club-comment-attach" href="' + attachmentHref(c.attachment) + '">📎 ' + escapeHtml(c.attachment.label) + ' ↗</a>' : '';
      var reactions = role !== 'guest' ? '<div class="club-reactions">' +
        '<button class="club-react" data-type="emet" data-id="' + c.id + '">эмет (' + (c.emet || 0) + ')</button>' +
        '<button class="club-react" data-type="question" data-id="' + c.id + '">вопрос (' + (c.questions || 0) + ')</button>' +
      '</div>' : '';
      return '<div class="club-comment">' +
        '<button type="button" class="avatar-circle sm" data-profile="' + (c.author || 0) + '" style="background:' + (author.color || '#999') + ';" title="Профиль ' + escapeHtml(author.handle) + '">' + (author.initial || '?') + '</button>' +
        '<div class="club-comment-body">' +
          '<strong>' + escapeHtml(author.handle) + '</strong>' +
          '<p>' + escapeHtml(c.body) + '</p>' +
          attachHtml +
          reactions +
        '</div>' +
      '</div>';
    }).join('');

    var composerHtml = role !== 'guest' ? '<div class="club-composer">' +
      '<textarea id="club-comment-text" class="club-textarea" placeholder="Ваш комментарий..."></textarea>' +
      '<div class="club-composer-actions">' +
        '<button class="lab-btn lab-btn-secondary lab-btn-sm" id="club-attach" type="button">📎 Прикрепить</button>' +
        '<button class="lab-btn lab-btn-primary lab-btn-sm" id="club-publish">Опубликовать</button>' +
      '</div>' +
      '<div id="club-attachment-picker" class="club-attachment-picker" hidden>' +
        '<button type="button" data-attachment="verse">Стих</button>' +
        '<button type="button" data-attachment="word">Слово</button>' +
        '<button type="button" data-attachment="board">Доска</button>' +
        '<button type="button" data-attachment="state">Состояние</button>' +
        '<button type="button" data-attachment="search">Поиск</button>' +
      '</div>' +
    '</div>' : '<div class="club-guest-hint">Войдите, чтобы участвовать в обсуждении.</div>';

    var attachHtml = card.attachment ? '<div class="club-attachment">' +
      '<span class="club-attach-label">' + escapeHtml(card.attachment.label) + '</span>' +
      '<span class="club-attachment-confidence">Уверенность: ' + escapeHtml(card.confidence || 'рабочая карта') + '</span>' +
      '<p class="club-attachment-synthesis">' + escapeHtml(card.synthesis) + '</p>' +
      '<a class="lab-btn lab-btn-secondary lab-btn-sm" href="' + attachmentHref(card.attachment) + '">Открыть в модуле ↗</a>' +
    '</div>' : '';

    return '<div class="club-detail">' +
      '<button class="club-back" id="club-back">Назад</button>' +
      '<div class="club-detail-head">' +
        '<span class="club-card-type type-' + (card.type || 'word') + '">' + (typeLabels[card.type] || card.type) + '</span>' +
        '<h2>' + escapeHtml(card.title) + '</h2>' +
        '<p>' + escapeHtml(card.synthesis) + '</p>' +
        renderAvatarStack(participants, 5) +
        '<span class="club-participants-count">= ' + participants.length + ' участников</span>' +
      '</div>' +
      attachHtml +
      '<div class="club-comments">' + commentsHtml + '</div>' +
      composerHtml +
    '</div>';
  }

  function bindFeedEvents(container) {
    var cards = container.querySelectorAll('.club-card');
    var filter = container.querySelector('#club-topic-filter');
    var empty = container.querySelector('#club-filter-empty');
    if (filter) {
      filter.addEventListener('change', function() {
        var visible = 0;
        cards.forEach(function(card) {
          var show = filter.value === 'all' || card.getAttribute('data-type') === filter.value;
          card.hidden = !show;
          if (show) visible += 1;
        });
        if (empty) empty.hidden = visible > 0;
      });
    }
    cards.forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('a') || e.target.closest('button')) return;
        var id = card.getAttribute('data-id');
        if (id && window.LabRouter) {
          window.LabRouter.navigate('club', [id]);
        }
      });
    });
    container.querySelectorAll('.club-join').forEach(function(button) {
      button.addEventListener('click', function() {
        button.textContent = 'Вы в круге';
        button.disabled = true;
      });
    });
    bindAvatarProfiles(container);
    bindWaitlistEvents(container);
  }

  function bindDetailEvents(container) {
    var back = container.querySelector('#club-back');
    if (back) {
      back.addEventListener('click', function() {
        currentCardId = null;
        if (window.LabRouter) window.LabRouter.navigate('club');
      });
    }
    container.querySelectorAll('[data-attachment]').forEach(function(button) {
      button.addEventListener('click', function() {
        var picker = container.querySelector('#club-attachment-picker');
        if (picker) {
          picker.dataset.selected = button.getAttribute('data-attachment');
          picker.hidden = true;
          button.classList.add('is-selected');
        }
      });
    });
    var publish = container.querySelector('#club-publish');
    if (publish) {
      publish.addEventListener('click', function() {
        var textarea = container.querySelector('#club-comment-text');
        var body = textarea.value.trim();
        if (!body || !window.ClubData) return;
        var role = getRole();
        var authorIdx = 0;
        ClubData.addComment(currentCardId, { author: authorIdx, body: body }).then(function() {
          renderDetail(container, currentCardId);
        });
      });
    }
    var reacts = container.querySelectorAll('.club-react');
    reacts.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var count = parseInt(btn.textContent.match(/\d+/)[0], 10) + 1;
        btn.textContent = btn.textContent.replace(/\d+/, count);
        btn.disabled = true;
      });
    });
    bindAvatarProfiles(container);
  }

  function attachmentHref(attachment) {
    if (!attachment || !attachment.route) return '#club';
    return attachment.route + (attachment.params ? '?' + encodeURIComponent(attachment.params) : '');
  }

  function bindAvatarProfiles(container) {
    container.querySelectorAll('.avatar-circle[data-profile]').forEach(function(avatar) {
      avatar.addEventListener('click', function(event) {
        event.stopPropagation();
        var profile = ClubData.getProfile(parseInt(avatar.getAttribute('data-profile'), 10) || 0);
        var old = document.querySelector('.club-mini-profile');
        if (old) old.remove();
        var popup = document.createElement('div');
        popup.className = 'club-mini-profile';
        popup.innerHTML = '<strong>' + escapeHtml(profile.handle) + '</strong><span>Уровень ' + profile.initial + '– · плоды: ' + (profile.level * 3) + '</span>';
        document.body.appendChild(popup);
        var rect = avatar.getBoundingClientRect();
        popup.style.left = Math.max(8, Math.min(window.innerWidth - 230, rect.left)) + 'px';
        popup.style.top = (rect.bottom + 8) + 'px';
        setTimeout(function() {
          document.addEventListener('click', function closeProfile(e) {
            if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closeProfile); }
          });
        }, 0);
      });
    });
  }

  function bindWaitlistEvents(container) {
    var submit = container.querySelector('#club-submit');
    var emailInput = container.querySelector('#club-email');
    var notice = container.querySelector('#club-notice');

    function showNotice(message, isError) {
      notice.textContent = message;
      notice.className = 'club-notice ' + (isError ? 'club-notice-error' : 'club-notice-success');
      notice.style.display = 'block';
      setTimeout(function() { notice.style.display = 'none'; }, 4000);
    }

    function submitForm() {
      var email = emailInput.value.trim();
      addToWaitlist(email).then(function(res) {
        if (res.ok) {
          showNotice(res.message, false);
          emailInput.value = '';
        } else if (res.duplicate) {
          showNotice('Вы уже в списке.', false);
        } else {
          showNotice(res.error || 'Ошибка.', true);
        }
      });
    }

    if (submit) {
      submit.addEventListener('click', submitForm);
    }
    if (emailInput) {
      emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitForm();
      });
    }
  }

  function setCardId(id) {
    currentCardId = id || null;
  }

  return {
    render: render,
    addToWaitlist: addToWaitlist,
    _setCardId: setCardId
  };
})();

window.ClubModule = ClubModule;

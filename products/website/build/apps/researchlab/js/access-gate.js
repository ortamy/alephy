/**
 * access-gate.js — режимы лаборатории: администратор / исследователь / гость.
 *
 * Это UX-разделение, а не защита: код виден любому, сервер агентов доверяет
 * только своему origin. Пароль администратора убран: он лежал в исходнике и
 * ничего не защищал. На своём компьютере админ включается кнопкой без пароля
 * (becomeAdmin), на опубликованном сайте доступен гостевой режим и
 * ссылки-приглашения вида `?access=<token>`.
 */
const AccessGate = (function() {
  'use strict';

  var SESSION_ADMIN_KEY = 'alephy_admin_session';
  var SESSION_RESEARCHER_KEY = 'alephy_researcher_session';
  var SESSION_GUEST_KEY = 'alephy_guest_session';
  var CONFIG_PATH = 'data/lab-config.json';

  var config = null;

  function isAdmin() {
    return sessionStorage.getItem(SESSION_ADMIN_KEY) === '1';
  }

  function isGuest() {
    return sessionStorage.getItem(SESSION_GUEST_KEY) === '1';
  }

  function isResearcher() {
    return sessionStorage.getItem(SESSION_RESEARCHER_KEY) === '1';
  }

  function getRole() {
    return isAdmin() ? 'admin' : isResearcher() ? 'researcher' : 'guest';
  }

  /** Свой компьютер: здесь допустим вход администратора без пароля. */
  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  }

  /**
   * Включить админ-режим на этом компьютере. Пароля нет осознанно: страница
   * статическая, и пароль в исходнике создавал ложное чувство защиты.
   * На опубликованном домене кнопки нет, а вызов вернёт false.
   */
  function becomeAdmin() {
    if (!isLocalHost()) return false;
    sessionStorage.setItem(SESSION_ADMIN_KEY, '1');
    window.location.reload();
    return true;
  }

  function loadConfig() {
    return fetch(CONFIG_PATH)
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function() {
        return { accentColor: '#b8860b', defaultModule: 'dashboard', hiddenSectionsForGuests: [], guestTokens: [], researcherTokens: [] };
      })
      .then(function(data) {
        config = data;
        return data;
      });
  }

  function getConfig() {
    return config;
  }

  /** Ссылка-приглашение: ?access=<token> → роль researcher или guest. */
  function checkTokenInHash() {
    var match = window.location.hash.match(/access=([^&]+)/);
    if (!match || !config) return false;
    var token = decodeURIComponent(match[1]);
    var researcher = (config.researcherTokens || []).some(function(t) { return t.token === token; });
    var guest = (config.guestTokens || []).some(function(t) { return t.token === token; });
    if (researcher || guest) {
      sessionStorage.setItem(researcher ? SESSION_RESEARCHER_KEY : SESSION_GUEST_KEY, '1');
      return true;
    }
    return false;
  }

  function init(onReady) {
    loadConfig().then(function() {
      if (checkTokenInHash()) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      onReady(getRole());
    });
  }

  function logout() {
    sessionStorage.removeItem(SESSION_ADMIN_KEY);
    sessionStorage.removeItem(SESSION_RESEARCHER_KEY);
    // Гость остаётся гостем: иначе на localhost админ вернулся бы сам.
    sessionStorage.setItem(SESSION_GUEST_KEY, '1');
    window.location.reload();
  }

  window.AccessGate = {
    init: init,
    isAdmin: isAdmin,
    isResearcher: isResearcher,
    getRole: getRole,
    isGuest: isGuest,
    getConfig: getConfig,
    isLocalHost: isLocalHost,
    becomeAdmin: becomeAdmin,
    logout: logout
  };
  return window.AccessGate;
})();

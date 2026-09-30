/**
 * cartography.js — Модуль «Картография»
 *
 * Смысловая карта стран, городов и регионов: название на иврите/палео-иврите,
 * значение, ключевые события, связь с распространением алфавита.
 *
 * Маршрут: #cartography
 */

const Cartography = (function() {
  'use strict';

  // Путь считается от страницы лаборатории, а не от каталога js/.
  const DATA_PATH = 'data/cartography.json';
  const HERALDRY_DATA_PATH = 'data/heraldry/heraldry.json';
  const STATE_MATRIX_PATH = 'data/state-matrix.json';
  const GENDER_MATRIX_PATH = 'data/gender-matrix.json';
  const MODERN_COUNTRIES_PATH = 'data/modern-countries.json';
  const TYPE_LABELS = { country: 'Страна', 'modern-state': 'Современное государство', city: 'Город', region: 'Регион', empire: 'Империя' };

  let entries = [];
  let entriesById = {};
  let dataPromise = null;
  let worldMapPromise = null;
  let worldMapMarkup = '';
  let countryStates = {};
  let stateMatrixCountries = [];
  // Слой каталога: карты и исследования лежат в одной сетке (MAP_THEMES),
  // но читаются по-разному — фильтр отделяет их, а не прячет.
  const LAYER_LABELS = { all: 'Все слои', theme: 'Карты', research: 'Исследования' };
  const catalog = { query: '', layer: 'all' };
  let countryQuery = '';
  let mapView = false;
  let mapZoom = 1;
  let mapPan = { x: 0, y: 0 };
  let mapDragging = false;
  let mapDragStart = { x: 0, y: 0 };
  // Выбранный объект карты: { kind: 'country', id } либо
  // { kind: 'obelisk', index }. Один выбор на карту, список и паспорт.
  let mapSelection = null;
  let genderMatrix = { zones: {} };
  let genderMapMarkup = '';

  const MAP_THEMES = [
    { id: 'near-east', kind: 'theme', visual: 'silhouette-east', title: 'Ближний Восток', description: 'Узлы Леванта, Египта и Месопотамии: среда ранних потоков и сдвигов.', mark: '𐤀' },
    { id: 'europe', kind: 'theme', visual: 'silhouette-europe', title: 'Европа', description: 'Континентальная карта состояний, границ и исторических переходов.', mark: '𐤄' },
    { id: 'empires', kind: 'theme', visual: 'blobs', title: 'Империи', description: 'Крупные державы как пространственные конструкции и зоны влияния.', mark: '𐤌' },
    { id: 'ancient-routes', kind: 'theme', visual: 'route', title: 'Древние маршруты', description: 'Регионы, города и коридоры, через которые двигался Давар.', mark: '𐤃' },
    { id: 'modern-states', kind: 'theme', visual: 'scatter', title: 'Современные государства', description: 'Глобальный слой диагностики по матрице состояний стран.', mark: '𐤔' },
    { id: 'state-matrix', kind: 'theme', visual: 'matrix', title: 'Матрица состояний', description: 'Поле Хошех и Ор: сравнение доминирующих состояний на одной карте.', mark: '𐤏' },
    { id: 'gender-images', kind: 'research', visual: 'chips', title: 'Эшет хаиль и Иш хаиль', topic: 'Карта сохранённых образов', description: 'В каких культурах женщина-строитель (эшет хаиль) и мужчина-созидатель (иш хаиль) сохранили свою палео-функцию? Греко-римский слой vs естественная среда', mark: '𐤀' },
    { id: 'obelisks', kind: 'research', visual: 'needles', title: 'Обелиски', topic: 'Карта городских доминант', description: 'Страны и города, где стоят крупные обелиски — вертикальные знаки, собранные в один исследовательский слой.', mark: '𐤋' }
  ];

  // Рабочий реестр: обелиски от 18 м и крупные городские доминанты той же формы.
  const OBELISKS = [
    { country: 'Египет', city: 'Каир', name: 'Обелиск Гелиополя', height: '20,7 м', x: 557, y: 302, note: 'Древний монолит в аэропорту Каира; единственный сохранившийся обелиск Гелиополя.' },
    { country: 'Италия', city: 'Рим', name: 'Латеранский обелиск', height: '32,18 м', x: 674, y: 272, note: 'Крупнейший древнеегипетский обелиск, установленный в Риме.' },
    { country: 'Франция', city: 'Париж', name: 'Луксорский обелиск', height: '22,84 м', x: 681, y: 260, note: 'Монолит на площади Согласия, перенесённый из Луксора.' },
    { country: 'Великобритания', city: 'Лондон', name: 'Игла Клеопатры', height: '21 м', x: 686, y: 248, note: 'Древнеегипетский обелиск на набережной Виктории.' },
    { country: 'США', city: 'Вашингтон', name: 'Вашингтонский монумент', height: '169,3 м', x: 350, y: 270, note: 'Монументальный обелиск XIX века, городская доминанта столицы.' },
    { country: 'Аргентина', city: 'Буэнос-Айрес', name: 'Обелиск Буэнос-Айреса', height: '67,5 м', x: 404, y: 448, note: 'Современный городской обелиск на площади Республики.' },
    { country: 'Бразилия', city: 'Сан-Паулу', name: 'Обелиск Ибирапуэра', height: '72 м', x: 449, y: 389, note: 'Крупный городской обелиск в парке Ибирапуэра.' },
    { country: 'Россия', city: 'Москва', name: 'Обелиск покорителям космоса', height: '107 м', x: 697, y: 190, note: 'Монументальный обелиск на проспекте Мира.' },
    { country: 'Турция', city: 'Стамбул', name: 'Обелиск Феодосия', height: '18,45 м', x: 718, y: 270, note: 'Древнеегипетский обелиск на ипподроме Константинополя.' },
    { country: 'Эфиопия', city: 'Аксум', name: 'Аксумский обелиск', height: '24 м', x: 534, y: 335, note: 'Стела Аксума, возвращённая из Рима и вновь установленная в городе.' }
  ];

  const MAP_INFO = {
    russia: ['Россия', 'Европа и Азия'], usa: ['США', 'Северная Америка'], canada: ['Канада', 'Северная Америка'],
    mexico: ['Мексика', 'Северная Америка'], brazil: ['Бразилия', 'Южная Америка'], argentina: ['Аргентина', 'Южная Америка'],
    egypt: ['Египет', 'Африка'], 'south africa': ['ЮАР', 'Африка'], china: ['Китай', 'Азия'], india: ['Индия', 'Азия'],
    japan: ['Япония', 'Азия'], israel: ['Израиль', 'Азия'], iran: ['Иран', 'Азия'], iraq: ['Ирак', 'Азия'],
    turkey: ['Турция', 'Европа и Азия'], france: ['Франция', 'Европа'], germany: ['Германия', 'Европа'],
    ukraine: ['Украина', 'Европа'], australia: ['Австралия', 'Океания'],
    britain: ['Великобритания', 'Европа'], italy: ['Италия', 'Европа'], spain: ['Испания', 'Европа'],
    mexico: ['Мексика', 'Северная Америка'], argentina: ['Аргентина', 'Южная Америка'],
    canada: ['Канада', 'Северная Америка'], 'south africa': ['ЮАР', 'Африка'], saudi: ['Саудовская Аравия', 'Азия']
  };
  const MAP_COUNTRY_NAMES = {
    finland: ['Финляндия', 'Европа'], norway: ['Норвегия', 'Европа'], sweden: ['Швеция', 'Европа'],
    poland: ['Польша', 'Европа'], kazakhstan: ['Казахстан', 'Азия'], indonesia: ['Индонезия', 'Азия'],
    philippines: ['Филиппины', 'Азия'], colombia: ['Колумбия', 'Южная Америка'], peru: ['Перу', 'Южная Америка'],
    chile: ['Чили', 'Южная Америка'], venezuela: ['Венесуэла', 'Южная Америка'], ecuador: ['Эквадор', 'Южная Америка'],
    bolivia: ['Боливия', 'Южная Америка'], paraguay: ['Парагвай', 'Южная Америка'], uruguay: ['Уругвай', 'Южная Америка'],
    guyana: ['Гайана', 'Южная Америка'], suriname: ['Суринам', 'Южная Америка'],
    algeria: ['Алжир', 'Африка'], morocco: ['Марокко', 'Африка'], tunisia: ['Тунис', 'Африка'],
    nigeria: ['Нигерия', 'Африка'], kenya: ['Кения', 'Африка'], ethiopia: ['Эфиопия', 'Африка'],
    madagascar: ['Мадагаскар', 'Африка'], namibia: ['Намибия', 'Африка'], botswana: ['Ботсвана', 'Африка'],
    iran: ['Иран', 'Азия'], iraq: ['Ирак', 'Азия'], afghanistan: ['Афганистан', 'Азия'], pakistan: ['Пакистан', 'Азия'],
    mongolia: ['Монголия', 'Азия'], vietnam: ['Вьетнам', 'Азия'], thailand: ['Таиланд', 'Азия'], malaysia: ['Малайзия', 'Азия'],
    'north korea': ['Северная Корея', 'Азия'], 'south korea': ['Южная Корея', 'Азия'],
    portugal: ['Португалия', 'Европа'], netherlands: ['Нидерланды', 'Европа'], belgium: ['Бельгия', 'Европа'],
    switzerland: ['Швейцария', 'Европа'], austria: ['Австрия', 'Европа'], czechia: ['Чехия', 'Европа'],
    romania: ['Румыния', 'Европа'], greece: ['Греция', 'Европа'], serbia: ['Сербия', 'Европа'],
    'new zealand': ['Новая Зеландия', 'Австралия'], papua: ['Папуа — Новая Гвинея', 'Австралия']
  };
  const CONTINENT_COUNTRIES = {
    'Северная Америка': ['Канада', 'США', 'Мексика', 'Гватемала', 'Белиз', 'Гондурас', 'Сальвадор', 'Никарагуа', 'Коста-Рика', 'Панама', 'Куба', 'Гаити', 'Доминиканская Республика', 'Ямайка'],
    'Южная Америка': ['Аргентина', 'Боливия', 'Бразилия', 'Чили', 'Колумбия', 'Эквадор', 'Гайана', 'Парагвай', 'Перу', 'Суринам', 'Уругвай', 'Венесуэла'],
    'Европа': ['Австрия', 'Бельгия', 'Болгария', 'Великобритания', 'Венгрия', 'Германия', 'Греция', 'Дания', 'Ирландия', 'Исландия', 'Испания', 'Италия', 'Латвия', 'Литва', 'Нидерланды', 'Норвегия', 'Польша', 'Португалия', 'Румыния', 'Сербия', 'Словакия', 'Словения', 'Финляндия', 'Франция', 'Хорватия', 'Чехия', 'Швейцария', 'Швеция', 'Эстония'],
    'Азия': ['Афганистан', 'Бангладеш', 'Бахрейн', 'Вьетнам', 'Индия', 'Индонезия', 'Иордания', 'Ирак', 'Иран', 'Израиль', 'Казахстан', 'Камбоджа', 'Катар', 'Китай', 'Киргизия', 'Кувейт', 'Лаос', 'Малайзия', 'Монголия', 'Непал', 'Оман', 'Пакистан', 'Палестина', 'Саудовская Аравия', 'Северная Корея', 'Сингапур', 'Сирия', 'Таиланд', 'Таджикистан', 'Туркменистан', 'Турция', 'Узбекистан', 'Филиппины', 'Шри-Ланка', 'Южная Корея', 'Япония'],
    'Африка': ['Алжир', 'Ангола', 'Бенин', 'Ботсвана', 'Буркина-Фасо', 'Бурунди', 'Габон', 'Гана', 'Гвинея', 'Египет', 'Замбия', 'Зимбабве', 'Камерун', 'Кения', 'Конго', 'Либерия', 'Ливия', 'Мадагаскар', 'Малави', 'Мали', 'Марокко', 'Мозамбик', 'Намибия', 'Нигер', 'Нигерия', 'Руанда', 'Сенегал', 'Сомали', 'Судан', 'Тунис', 'Уганда', 'ЦАР', 'Чад', 'Эфиопия', 'ЮАР'],
    'Австралия': ['Австралия', 'Новая Зеландия', 'Папуа — Новая Гвинея', 'Фиджи', 'Вануату', 'Самоа', 'Тонга']
  };
  function registerCountryAliases(countryNames) {
    countryNames.forEach(function(name) {
      var id = String(name).toLowerCase().replace(/[—’']/g, ' ').replace(/[^a-zа-яё0-9]+/gi, ' ').trim();
      if (!MAP_INFO[id]) {
        var continent = Object.keys(CONTINENT_COUNTRIES).find(function(key) { return CONTINENT_COUNTRIES[key].indexOf(name) !== -1; }) || 'Не определён';
        MAP_INFO[id] = [name, continent];
      }
    });
  }
  Object.keys(MAP_COUNTRY_NAMES).forEach(function(id) { MAP_INFO[id] = MAP_COUNTRY_NAMES[id]; });
  const STATE_COUNTRY_IDS = {
    'Россия': 'russia', 'Израиль': 'israel', 'США': 'usa', 'Египет': 'egypt',
    'Германия': 'germany', 'Китай': 'china', 'Индия': 'india', 'Украина': 'ukraine',
    'Япония': 'japan', 'Франция': 'france', 'Бразилия': 'brazil', 'Саудовская Аравия': 'saudi',
    'Австралия': 'australia', 'Канада': 'canada', 'Великобритания': 'britain', 'Италия': 'italy',
    'Испания': 'spain', 'Мексика': 'mexico', 'Аргентина': 'argentina', 'Турция': 'turkey', 'ЮАР': 'south africa'
  };

  function dataPath() {
    return new URL(DATA_PATH, document.baseURI).href;
  }

  function heraldryDataPath() {
    return new URL(HERALDRY_DATA_PATH, document.baseURI).href;
  }

  function stateMatrixPath() {
    return new URL(STATE_MATRIX_PATH, document.baseURI).href;
  }

  function modernCountriesPath() {
    return new URL(MODERN_COUNTRIES_PATH, document.baseURI).href;
  }

  function genderMatrixPath() {
    return new URL(GENDER_MATRIX_PATH, document.baseURI).href;
  }

  function modernCountryId(name) {
    return 'modern-' + String(name).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
  }

  function applyStateClasses(markup) {
    return markup.replace(/(<path\b[^>]*class="world-country"[^>]*data-country-id="([^"]+)"[^>]*)(\/?>)/gi, function(match, prefix, id, close) {
      var info = MAP_INFO[id] || MAP_COUNTRY_NAMES[id];
      var state = info && countryStates[info[0]];
      return prefix.replace('class="world-country"', 'class="world-country world-state-' + (state || 'unknown') + '"') + close;
    });
  }

  function genderZoneForCountry(countryId) {
    var info = MAP_INFO[countryId] || MAP_COUNTRY_NAMES[countryId];
    if (!info) return 'unknown';
    var zones = genderMatrix.zones || {};
    var direct = zones.direct && zones.direct.countries || [];
    var indirect = zones.indirect && zones.indirect.countries || [];
    if (direct.indexOf(info[0]) !== -1) return 'direct';
    if (indirect.indexOf(info[0]) !== -1) return 'indirect';
    if ((zones.lost && zones.lost.countries || []).indexOf(info[0]) !== -1 || (zones.lost && zones.lost.continents || []).indexOf(info[1]) !== -1) return 'lost';
    return 'unknown';
  }

  // Зона образа по названию: не у всех стран из матрицы полов есть
  // путь на карте, а зона хранится именно по названию.
  function genderZoneForName(name) {
    var zones = (genderMatrix && genderMatrix.zones) || {};
    if (((zones.direct && zones.direct.countries) || []).indexOf(name) !== -1) return 'direct';
    if (((zones.indirect && zones.indirect.countries) || []).indexOf(name) !== -1) return 'indirect';
    if (((zones.lost && zones.lost.countries) || []).indexOf(name) !== -1) return 'lost';
    return 'unknown';
  }

  function applyGenderClasses(markup) {
    return markup.replace(/class="world-country world-state-[^"]+" data-country-id="([^"]+)"/gi, function(match, id) {
      return match.replace('world-state-' + (match.match(/world-state-([\w-]+)/) || ['', 'unknown'])[1], 'gender-zone-' + genderZoneForCountry(id));
    });
  }

  function loadWorldMap() {
    if (worldMapPromise) return worldMapPromise;
    var mapUrl = new URL('../../assets/maps/world-map.svg', document.baseURI).href;
    worldMapPromise = fetch(mapUrl).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for world map');
      return response.text();
    }).then(function(source) {
      var documentNode = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (documentNode.querySelector('parsererror')) throw new Error('Неверный формат world-map.svg');
      return Array.prototype.map.call(documentNode.querySelectorAll('path'), function(path) {
        var id = path.getAttribute('id');
        if (!id || id === 'path1' || id === 'path-1') return '';
        path.removeAttribute('style');
        path.removeAttribute('inkscape:path-effect');
        path.removeAttribute('inkscape:original-d');
        path.removeAttribute('transform');
        path.setAttribute('class', 'world-country');
        path.setAttribute('data-country-id', id);
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        return new XMLSerializer().serializeToString(path);
      }).join('');
    }).catch(function(error) {
      console.warn('[Cartography] Карта мира недоступна, продолжаем без геометрии:', error.message);
      return '';
    });
    return worldMapPromise;
  }

  function escapeHtml(text) {
    // Канон в js/utils.js: там же кавычки — обязательны для атрибутов.
    return window.AlephyUtils
      ? AlephyUtils.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  function themeObjectCount(theme) {
    var zones;
    switch (theme.id) {
      case 'near-east':
        return entries.filter(function(e) { return e.region === 'Levant' || e.region === 'Egypt' || e.region === 'Mesopotamia'; }).length;
      case 'europe':
        return entries.filter(function(e) { return e.region === 'Europe'; }).length;
      case 'empires':
        return entries.filter(function(e) { return e.type === 'empire'; }).length;
      case 'ancient-routes':
        return entries.filter(function(e) { return e.era === 'ancient'; }).length;
      case 'modern-states':
        return entries.filter(function(e) { return e.type === 'modern-state' || e.era === 'modern'; }).length;
      case 'state-matrix':
        return stateMatrixCountries.length;
      case 'gender-images':
        zones = (genderMatrix && genderMatrix.zones) || {};
        return ['direct', 'indirect', 'lost'].reduce(function(n, key) {
          return n + ((zones[key] && zones[key].countries) || []).length;
        }, 0);
      case 'obelisks':
        return OBELISKS.length;
      default:
        return 0;
    }
  }

  function openThemeMap(themeId, openMap) {
    // Новая тема — новая карта: прошлый масштаб и выбор относятся к другой
    // карте и в новой были бы ложной подсказкой.
    mapZoom = 1;
    mapPan = { x: 0, y: 0 };
    mapSelection = null;
    if (openMap) {
      mapView = 'states';
      return;
    }
    mapView = themeId === 'gender-images' ? 'gender' : (themeId === 'obelisks' ? 'obelisks' : true);
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init(el) {
    var container = el || document.getElementById('cartography');
    if (container) loadData(container);
  }

  // ===== ЗАГРУЗКА ДАННЫХ =====
  function loadData(target) {
    var container = target || document.getElementById('cartography');
    if (!container) return;

    if (entries.length) {
      renderPage(container);
      return Promise.resolve(entries);
    }

    if (dataPromise) return dataPromise;

    container.innerHTML = '<div class="lab-spinner show"><div class="loader"></div><div class="spinner-text">Загрузка картографии...</div></div>';

    dataPromise = Promise.all([
      fetch(dataPath()).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      }),
      fetch(heraldryDataPath()).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for heraldry');
        return response.json();
      }),
      fetch(stateMatrixPath()).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for state matrix');
        return response.json();
      }),
      fetch(modernCountriesPath()).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for modern countries');
        return response.json();
      }),
      fetch(genderMatrixPath()).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for gender matrix');
        return response.json();
      }),
      loadWorldMap()
    ])
      .then(function(results) {
        var data = results[0];
        var heraldryList = Array.isArray(results[1]) ? results[1] : [];
        var matrix = results[2] && Array.isArray(results[2].countries) ? results[2].countries : [];
        var countryNames = results[3] && Array.isArray(results[3].countries) ? results[3].countries : [];
        var matrixByName = {};
        matrix.forEach(function(country) { if (country && country.name) matrixByName[country.name] = country; });
        stateMatrixCountries = countryNames.map(function(name) {
          return matrixByName[name] || { name: name, diagnosis: 'Нет диагноза в state-matrix.json.', note: 'Данные по состояниям для этой страны ещё не внесены.' };
        });
        matrix.forEach(function(country) {
          if (country && country.name && !matrixByName[country.name]) stateMatrixCountries.push(country);
        });
        registerCountryAliases(countryNames);
        matrix.forEach(function(country) {
          var states = country.states || {};
          countryStates[country.name] = Object.keys(states).sort(function(a, b) { return Number(states[b]) - Number(states[a]); })[0] || '';
        });
        genderMatrix = results[4] || { zones: {} };
        worldMapMarkup = applyStateClasses(results[5]);
        genderMapMarkup = applyGenderClasses(worldMapMarkup);
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : null);
        if (!list) throw new Error('Неверный формат данных');
        var ancientEntries = list.filter(function(e) { return e && e.id && e.name; }).map(function(e) {
          e.era = e.era || 'ancient';
          return e;
        });
        var heraldryByName = {};
        heraldryList.forEach(function(e) { if (e && e.name) heraldryByName[e.name] = e; });
        var modernEntries = countryNames.map(function(name) {
          var source = heraldryByName[name] || {};
          var e = Object.assign({}, source);
          e.id = source.id || modernCountryId(name);
          e.name = name;
          e.era = 'modern';
          e.type = 'modern-state';
          e.paleo = e.paleo || e.hebrew || '';
          e.summary = e.summary || e.card_description || e.description || (name + ' — современное государство со своей территорией, историей и языковой средой.');
          e.meaning = e.meaning || e.card_description || 'Государство и его географическая среда';
          e.dominantState = countryStates[name] || '';
          return e;
        });
        entries = ancientEntries.concat(modernEntries);
        entriesById = {};
        entries.forEach(function(e) { entriesById[e.id] = e; });
        renderPage(container);
        return entries;
      })
      .catch(function(error) {
        console.error('[Cartography] Ошибка загрузки:', error);
        dataPromise = null;
        container.innerHTML = '<div class="lab-alert lab-alert-error">Ошибка загрузки картографии: ' + escapeHtml(error.message) + '</div>';
        throw error;
      });

    dataPromise.catch(function() {});
    return dataPromise;
  }

  // ===== ФИЛЬТРАЦИЯ =====
  function visibleThemes() {
    var query = String(catalog.query || '').trim().toLowerCase();
    return MAP_THEMES.filter(function(theme) {
      if (catalog.layer !== 'all' && theme.kind !== catalog.layer) return false;
      if (!query) return true;
      return [theme.title, theme.description, theme.topic].join(' ').toLowerCase().indexOf(query) !== -1;
    });
  }

  function catalogFiltersActive() {
    return catalog.layer !== 'all' || String(catalog.query || '').trim() !== '';
  }

  // ===== ВНУТРЕННЯЯ СТРАНИЦА КАРТЫ =====
  // Бенто по DESIGN-SYSTEM §5.2a: каркас 12 колонок, ячейки 01–04,
  // hairline-рамки без теней. Кнопка «Назад к темам» больше не нужна:
  // выход в каталог — компактная кнопка в панели, а не отдельная
  // полоса под заголовком карты.
  const STATE_META = [
    { key: 'tohu', label: 'Тоху' }, { key: 'hoshekh', label: 'Хошех' },
    { key: 'mizraim', label: 'Мицраим' }, { key: 'rakia', label: 'Ракиа' },
    { key: 'shamaim', label: 'Шамаим' }, { key: 'midbar', label: 'Мидбар' },
    { key: 'erets', label: 'Эрец' }, { key: 'eden', label: 'Эден' }
  ];
  const GENDER_ZONE_LABELS = {
    direct: 'Образ сохранён напрямую',
    indirect: 'Сохранён косвенно',
    lost: 'Образ утрачен',
    unknown: 'Нет данных'
  };

  function mapMode() {
    return mapView === 'gender' ? 'gender' : mapView === 'obelisks' ? 'obelisks' : 'states';
  }

  function dominantStateOf(country) {
    var states = (country && country.states) || {};
    return Object.keys(states).sort(function(a, b) { return Number(states[b]) - Number(states[a]); })[0] || '';
  }

  function stateLabel(key) {
    var found = STATE_META.filter(function(item) { return item.key === key; })[0];
    return found ? found.label : 'Нет данных';
  }

  function countryByName(name) {
    return stateMatrixCountries.filter(function(item) { return item.name === name; })[0] || null;
  }

  // Имя из карты приходит как id пути, из списка — как название
  // государства. Обратный индекс связывает оба входа в один выбор.
  function mapIdByName(name) {
    var ids = Object.keys(MAP_INFO);
    for (var i = 0; i < ids.length; i++) {
      if (MAP_INFO[ids[i]][0] === name) return ids[i];
    }
    return '';
  }

  // Выбор приходит и из SVG (id пути), и из списка (название).
  // Часть стран из modern-countries.json не имеет пути на карте,
  // поэтому источник правды — название, а id восстанавливается.
  function selectedCountry() {
    if (!mapSelection || mapSelection.kind !== 'country') return null;
    var name = mapSelection.name || '';
    var id = mapSelection.id || (name ? mapIdByName(name) : '');
    var info = id ? (MAP_INFO[id] || MAP_COUNTRY_NAMES[id]) : null;
    if (!info && !name) return null;
    var resolved = info ? info[0] : name;
    return {
      id: id,
      name: resolved,
      continent: (info && info[1]) || '',
      data: countryByName(resolved)
    };
  }
  function mapSvgMarkup() {
    var mode = mapMode();
    var mapMarkup = mode === 'gender' ? genderMapMarkup : worldMapMarkup;
    var markers = mode === 'obelisks'
      ? '<g class="obelisk-map-markers">' + OBELISKS.map(function(item, index) {
        return '<g class="obelisk-map-marker" data-obelisk-index="' + index + '" tabindex="0" role="button" aria-label="' + escapeHtml(item.city + ': ' + item.name) + '"><circle cx="' + item.x + '" cy="' + item.y + '" r="7"></circle><path d="M' + item.x + ' ' + (item.y - 5) + 'v-13"></path></g>';
      }).join('') + '</g>'
      : '';
    return '<div class="cartography-map-canvas"><svg class="cartography-world-svg" viewBox="0 0 950 620" role="img" aria-label="Интерактивная карта мира" focusable="false">' +
      '<rect class="world-sea" x="0" y="0" width="950" height="620"></rect>' +
      '<g class="world-map-viewport" transform="translate(' + mapPan.x + ' ' + mapPan.y + ') scale(' + mapZoom + ')"><g class="world-countries">' + mapMarkup + '</g>' + markers + '</g>' +
      '</svg></div>';
  }

  function cellHead(num, title, hint) {
    return '<header class="cmb-cell-head"><span class="cmb-num" aria-hidden="true">' + num + '</span>' +
      '<h2 class="cmb-cell-title">' + escapeHtml(title) + '</h2>' +
      (hint ? '<span class="cmb-cell-hint">' + escapeHtml(hint) + '</span>' : '') + '</header>';
  }

  function cmbField(label, value) {
    return '<div class="cmb-field"><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(value) + '</b></div>';
  }

  function cmbEmpty(text) {
    return '<p class="cmb-empty">' + escapeHtml(text) + '</p>';
  }

  function cmbBar(ratio) {
    return '<span class="cmb-bar"><span style="width:' + Math.max(0, Math.min(100, Math.round(ratio * 100))) + '%"></span></span>';
  }
  // Ячейка 02 — срез по теме карты. Для карты состояний это
  // распределение доминирующих состояний, для исследовательских карт
  // — их собственные счётчики: зоны образа и реестр городов.
  function mapSliceMarkup() {
    var mode = mapMode();
    var zones = (genderMatrix && genderMatrix.zones) || {};

    if (mode === 'gender') {
      return ['direct', 'indirect', 'lost'].map(function(zone) {
        var names = (zones[zone] && zones[zone].countries) || [];
        return '<li class="cmb-slice"><span class="cmb-slice-name cmb-dot-' + zone + '">' + GENDER_ZONE_LABELS[zone] + '</span>' +
          cmbBar(names.length ? 1 : 0) +
          '<span class="cmb-slice-count">' + names.length + '</span></li>';
      }).join('');
    }

    if (mode === 'obelisks') {
      var cities = OBELISKS.map(function(item) { return item.city; })
        .filter(function(city, index, all) { return all.indexOf(city) === index; });
      return '<li class="cmb-slice"><span class="cmb-slice-name">Обелисков в реестре</span>' + cmbBar(1) + '<span class="cmb-slice-count">' + OBELISKS.length + '</span></li>' +
        '<li class="cmb-slice"><span class="cmb-slice-name">Городов</span>' + cmbBar(1) + '<span class="cmb-slice-count">' + cities.length + '</span></li>';
    }

    var counts = {};
    var max = 0;
    stateMatrixCountries.forEach(function(country) {
      var key = dominantStateOf(country);
      if (!(key in counts)) counts[key] = 0;
      counts[key]++;
      if (counts[key] > max) max = counts[key];
    });
    return STATE_META.map(function(item) {
      var count = counts[item.key] || 0;
      return '<li class="cmb-slice"><span class="cmb-slice-name"><i class="world-state-' + item.key + '" aria-hidden="true"></i>' + item.label + '</span>' +
        cmbBar(max ? count / max : 0) + '<span class="cmb-slice-count">' + count + '</span></li>';
    }).join('');
  }

  // Ячейка 03 — паспорт выбранного объекта. Раньше те же данные
  // открывались модалкой поверх карты; в бенто им место в ячейке,
  // поэтому карта остаётся видимой при выборе.
  function mapPassportMarkup() {
    var mode = mapMode();

    if (mode === 'obelisks') {
      var item = mapSelection && mapSelection.kind === 'obelisk' ? OBELISKS[mapSelection.index] : null;
      if (!item) return cmbEmpty('Нажмите на маркер обелиска — здесь появятся город и высота.');
      return '<h3 class="cmb-name">' + escapeHtml(item.name) + '</h3>' +
        cmbField('Город', item.city + ', ' + item.country) +
        cmbField('Высота', item.height) +
        '<p class="cmb-note">' + escapeHtml(item.note) + '</p>';
    }

    var country = selectedCountry();
    if (!country) return cmbEmpty('Нажмите на страну или на строку списка — здесь появится её диагноз.');

    if (mode === 'gender') {
      return '<h3 class="cmb-name">' + escapeHtml(country.name) + '</h3>' +
        cmbField('Материк', country.continent || 'Материк не указан') +
        cmbField('Зона', GENDER_ZONE_LABELS[genderZoneForName(country.name)]) +
        '<p class="cmb-note">Эшет хаиль — женщина-строитель, Иш хаиль — мужчина-созидатель. Карта фиксирует, сохранила ли среда палео-функцию образа.</p>';
    }

    var data = country.data;
    var states = (data && data.states) || {};
    var total = STATE_META.reduce(function(sum, item) { return sum + (Number(states[item.key]) || 0); }, 0);
    return '<h3 class="cmb-name">' + escapeHtml(country.name) + '</h3>' +
      cmbField('Материк', (data && data.continent) || country.continent || 'Материк не указан') +

      cmbField('Доминирующее состояние', stateLabel(dominantStateOf(data))) +
      '<p class="cmb-note">' + escapeHtml((data && (data.diagnosis || data.note)) || 'Данные по этой стране ещё не внесены.') + '</p>' +
      (total ? '<ul class="cmb-states">' + STATE_META.map(function(meta) {
        var value = Number(states[meta.key]) || 0;
        return '<li class="cmb-slice"><span class="cmb-slice-name"><i class="world-state-' + meta.key + '" aria-hidden="true"></i>' + meta.label + '</span>' +
          cmbBar(value / total) + '<span class="cmb-slice-count">' + Math.round(value / total * 100) + '%</span></li>';
      }).join('') + '</ul>' : '');
  }


  // Ячейка 04 — список объектов темы. Поиск в панели фильтрует
  // только её: карта и срез остаются на месте.
  function mapListMarkup() {
    var mode = mapMode();
    var query = String(countryQuery || '').trim().toLowerCase();

    if (mode === 'obelisks') {
      var marks = OBELISKS.filter(function(item) {
        return !query || (item.name + ' ' + item.city + ' ' + item.country).toLowerCase().indexOf(query) !== -1;
      });
      if (!marks.length) return cmbEmpty('Объект не найден.');
      return marks.map(function(item) {
        return '<li><button type="button" class="cmb-row" data-obelisk-index="' + OBELISKS.indexOf(item) + '">' +
          '<i class="cmb-dot-obelisk" aria-hidden="true"></i>' +
          '<span class="cmb-row-name">' + escapeHtml(item.name) + '</span>' +
          '<span class="cmb-row-meta">' + escapeHtml(item.city) + ' · ' + escapeHtml(item.height) + '</span>' +
          '</button></li>';
      }).join('');
    }

    if (mode === 'gender') {
      var zones = (genderMatrix && genderMatrix.zones) || {};
      var groups = ['direct', 'indirect', 'lost'].map(function(zone) {
        var names = ((zones[zone] && zones[zone].countries) || []).filter(function(name) {
          return !query || name.toLowerCase().indexOf(query) !== -1;
        });
        if (!names.length) return '';
        return '<li class="cmb-group"><span class="cmb-group-name cmb-dot-' + zone + '">' + GENDER_ZONE_LABELS[zone] + '</span>' +
          '<ul class="cmb-chips">' + names.map(function(name) {
            return '<li><button type="button" class="cmb-chip" data-country-name="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button></li>';
          }).join('') + '</ul></li>';
      }).join('');
      return groups || cmbEmpty('Страна не найдена.');
    }

    // В списке только страны с диагнозом: modern-countries.json
    // приносит ещё и материки, а строка без состояний ничего
    // не сообщает и не открывает паспорт.
    var list = stateMatrixCountries.filter(function(country) {
      if (!dominantStateOf(country)) return false;
      return !query || String(country.name || '').toLowerCase().indexOf(query) !== -1;
    });
    if (!list.length) return cmbEmpty('Страна не найдена.');
    return list.map(function(country) {
      return '<li><button type="button" class="cmb-row" data-country-name="' + escapeHtml(country.name) + '">' +
        '<i class="world-state-' + escapeHtml(dominantStateOf(country)) + '" aria-hidden="true"></i>' +
        '<span class="cmb-row-name">' + escapeHtml(country.name) + '</span>' +
        '<span class="cmb-row-meta">' + escapeHtml(country.continent || 'Материк не указан') + '</span>' +
        '</button></li>';
    }).join('');
  }

  function mapListCount() {
    var markup = mapListMarkup();
    var rows = markup.match(/class="cmb-row"/g);
    if (rows) return rows.length;
    return (markup.match(/class="cmb-chip"/g) || []).length;
  }

  function mapObjectTotal() {
    if (mapMode() === 'obelisks') return OBELISKS.length;
    if (mapMode() === 'gender') {
      var zones = (genderMatrix && genderMatrix.zones) || {};
      return ['direct', 'indirect', 'lost'].reduce(function(sum, zone) {
        return sum + ((zones[zone] && zones[zone].countries) || []).length;
      }, 0);
    }
    return stateMatrixCountries.filter(function(country) { return Boolean(dominantStateOf(country)); }).length;
  }

  // Панель карты повторяет панель каталога (§4.7): поиск слева, масштаб
  // в группе, счётчик и выход к темам справа. Отдельная кнопка «Назад
  // к темам» под заголовком карты была вторым способом сделать то же.
  function mapToolbarMarkup() {
    return '<div class="lab-toolbar" role="search" aria-label="Управление картой">' +
      '<input type="search" class="lab-input lab-toolbar-search" id="cartography-map-search" autocomplete="off" placeholder="Поиск по объектам карты…" aria-label="Поиск по объектам карты" value="' + escapeHtml(countryQuery) + '">' +
      '<div class="lab-toolbar-group" role="group" aria-label="Масштаб карты">' +
        '<div class="lab-toolbar-zoom">' +
          '<button type="button" class="lab-btn lab-btn-secondary" id="cartography-zoom-out" title="Уменьшить масштаб" aria-label="Уменьшить масштаб"><i data-lucide="minus" class="lab-icon" aria-hidden="true"></i></button>' +
          '<button type="button" class="lab-btn lab-btn-secondary" id="cartography-zoom-in" title="Увеличить масштаб" aria-label="Увеличить масштаб"><i data-lucide="plus" class="lab-icon" aria-hidden="true"></i></button>' +
        '</div>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-btn" id="cartography-zoom-reset" title="Сбросить масштаб и сдвиг"><i data-lucide="maximize" class="lab-icon" aria-hidden="true"></i>Сбросить</button>' +
      '</div>' +
      '<div class="lab-toolbar-actions">' +
        '<span class="lab-toolbar-count" aria-live="polite"><strong>' + mapListCount() + '</strong> из ' + mapObjectTotal() + '</span>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-btn" id="cartography-catalog-link" title="Вернуться к темам карт"><i data-lucide="layout-grid" class="lab-icon" aria-hidden="true"></i>Темы</button>' +
      '</div>' +
    '</div>';
  }



  // Заголовки ячеек и их подсказки зависят от темы карты: у карты
  // состояний это срез по восьми состояниям, у двух исследовательских
  // карт — их собственные счётчики.
  function mapPageMeta() {
    if (mapMode() === 'gender') return { title: 'Эшет хаиль и Иш хаиль', slice: 'Зоны образа', list: 'Страны по зонам', hint: 'gender-matrix.json' };
    if (mapMode() === 'obelisks') return { title: 'Обелиски', slice: 'Реестр городов', list: 'Города', hint: 'рабочая выборка, не полный каталог' };
    return { title: 'Карта мира', slice: 'Срез по состояниям', list: 'Страны', hint: 'state-matrix.json' };
  }

  function renderMapPage(container) {
    var meta = mapPageMeta();
    container.innerHTML = '<div class="cmb-page">' + mapToolbarMarkup() +
      '<div class="cmb-bento">' +
        '<section class="cmb-cell cmb-cell--map">' + cellHead('01', meta.title, 'тянуть · колесо') + mapSvgMarkup() + '</section>' +
        '<section class="cmb-cell cmb-cell--slice">' + cellHead('02', meta.slice, meta.hint) + '<ul class="cmb-slices">' + mapSliceMarkup() + '</ul></section>' +
        '<section class="cmb-cell cmb-cell--passport">' + cellHead('03', 'Паспорт объекта', 'выбор на карте или в списке') + '<div id="cmb-passport-body">' + mapPassportMarkup() + '</div></section>' +
        '<section class="cmb-cell cmb-cell--list">' + cellHead('04', meta.list, '') + '<ul class="cmb-list" id="cmb-list-body">' + mapListMarkup() + '</ul></section>' +
      '</div>' +
    '</div>';
    bindMapInteractions(container);
    bindMapToolbar(container);
    markSelectedOnMap(container);
    refreshIcons();
  }

  // Выделение синхронно во всех трёх входах: контур на карте, строка
  // списка и маркер обелиска. Ключ один — разрешённое имя объекта,
  // потому что часть стран не имеет пути в SVG.
  function selectionKey() {
    if (!mapSelection) return '';
    if (mapSelection.kind === 'obelisk') return 'obelisk:' + mapSelection.index;
    if (mapSelection.kind === 'country') {
      var id = mapSelection.id;
      return 'country:' + (mapSelection.name || (id ? (MAP_INFO[id] || MAP_COUNTRY_NAMES[id] || [''])[0] : ''));
    }
    return '';
  }

  function markSelectedOnMap(container) {
    var key = selectionKey();
    var countryId = key.indexOf('country:') === 0 ? (mapSelection.id || '') : '';
    container.querySelectorAll('.world-country').forEach(function(country) {
      country.classList.toggle('is-selected', Boolean(countryId) && country.getAttribute('data-country-id') === countryId);
    });
    container.querySelectorAll('.cmb-row, .cmb-chip').forEach(function(row) {
      var own = row.hasAttribute('data-obelisk-index')
        ? 'obelisk:' + row.getAttribute('data-obelisk-index')
        : 'country:' + (row.getAttribute('data-country-name') || '');
      row.classList.toggle('is-selected', own === key);
    });
    container.querySelectorAll('.obelisk-map-marker').forEach(function(marker) {
      marker.classList.toggle('is-selected', 'obelisk:' + marker.getAttribute('data-obelisk-index') === key);
    });
  }

  /* Паспорт и список обновляются точечно: перерисовка всей страницы
     на каждом клике сбрасывала бы масштаб и сдвиг карты. */
  function refreshMapPanels(container) {
    var passport = container.querySelector('#cmb-passport-body');
    if (passport) passport.innerHTML = mapPassportMarkup();
    var list = container.querySelector('#cmb-list-body');
    if (list) list.innerHTML = mapListMarkup();
    var count = container.querySelector('.lab-toolbar-count strong');
    if (count) count.textContent = String(mapListCount());
    markSelectedOnMap(container);
  }

  function applyViewport(container) {
    var viewport = container.querySelector('.world-map-viewport');
    if (viewport) viewport.setAttribute('transform', 'translate(' + mapPan.x + ' ' + mapPan.y + ') scale(' + mapZoom + ')');
  }

  // Масштаб и колесом, и кнопками — точка под курсором остаётся на месте,
  // иначе карта «уезжала» из-под пользователя при каждом шаге.
  const MAP_VIEW_W = 950;
  const MAP_VIEW_H = 620;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

  function zoomMap(container, factor, clientX, clientY) {
    var svg = container.querySelector('.cartography-world-svg');
    var next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, mapZoom * factor)) * 100) / 100;
    if (next === mapZoom) return;
    if (svg && typeof clientX === 'number') {
      var rect = svg.getBoundingClientRect();
      var px = (clientX - rect.left) * MAP_VIEW_W / rect.width;
      var py = (clientY - rect.top) * MAP_VIEW_H / rect.height;
      var ratio = next / mapZoom;
      mapPan.x = px - (px - mapPan.x) * ratio;
      mapPan.y = py - (py - mapPan.y) * ratio;
    }
    mapZoom = next;
    if (mapZoom === ZOOM_MIN) mapPan = { x: 0, y: 0 };
    applyViewport(container);
  }

  function resetView(container) {
    mapZoom = ZOOM_MIN;
    mapPan = { x: 0, y: 0 };
    applyViewport(container);
  }

  // Иконки тем — из lucide, как в паспорте агента. Раньше здесь стояли
  // самописные мини-превью (miniVisualSvg): у них не было ни общего
  // калибра, ни подписи, и они гасли на всех темах кроме картографических.
  const THEME_ICON = {
    'near-east': 'pyramid',
    'europe': 'compass',
    'empires': 'crown',
    'ancient-routes': 'route',
    'modern-states': 'flag',
    'state-matrix': 'grid-3x3',
    'gender-images': 'users',
    'obelisks': 'navigation'
  };

  function themeIcon(theme) {
    return THEME_ICON[theme.id] || 'map';
  }

  // Карта и слой считаются по-разному: у темы это узлы на карте, у
  // исследования — реестр городов. Единой единицы в данных нет, поэтому
  // подпись в статус-пилюле нейтральная.
  function pluralizeObjects(n) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'объект';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'объекта';
    return 'объектов';
  }

  function themeKindLabel(theme) {
    return theme.kind === 'research' ? 'Исследование' : 'Карта';
  }

  // Паспорт карточки повторяет карточку агента (renderAgentCard): тот же
  // икон-чип, то же серифное имя, та же статус-пилюля и подвал с чипом.
  function renderThemeCard(theme, index) {
    var count = themeObjectCount(theme);
    return '<article class="cartography-theme-card" data-theme-id="' + escapeHtml(theme.id) + '" tabindex="0" role="button" aria-label="Открыть карту: ' + escapeHtml(theme.title) + '" style="animation-delay:' + (index * 40) + 'ms">' +
      '<div class="cartography-theme-head">' +
        '<span class="cartography-theme-chip" aria-hidden="true"><i data-lucide="' + themeIcon(theme) + '" class="lab-icon"></i></span>' +
        '<h2 class="cartography-theme-name">' + escapeHtml(theme.title) + '</h2>' +
        '<span class="cartography-theme-count" aria-label="' + count + ' ' + pluralizeObjects(count) + '">' + count + '</span>' +
      '</div>' +
      '<p class="cartography-theme-desc">' + escapeHtml(theme.description) + '</p>' +
      '<div class="cartography-theme-foot">' +
        '<span class="cartography-theme-kind">' + themeKindLabel(theme) + '</span>' +
        (theme.topic ? '<span class="cartography-theme-topic">' + escapeHtml(theme.topic) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  // Заголовок группы — формула секций агентов (§4.1): микро-лейбл, за ним
  // волосяная линия до счётчика. Прежняя рамка снизу дублировала линию.
  function renderCatalogGroup(label, items) {
    return '<section class="cartography-catalog-group">' +
      '<header class="cartography-section-head">' +
        '<h2 class="cartography-section-label">' + escapeHtml(label) + '</h2>' +
        '<span class="cartography-section-rule" aria-hidden="true"></span>' +
        '<span class="cartography-section-count">' + items.length + '</span>' +
      '</header>' +
      '<div class="cartography-theme-grid">' + items.map(function(theme, i) { return renderThemeCard(theme, i); }).join('') + '</div>' +
    '</section>';
  }

  // ===== РЕНДЕРИНГ СТРАНИЦЫ =====
  function renderPage(container) {
    if (!entries.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Картография пока пуста. Записи добавляются.</div>';
      return;
    }

    if (mapView) {
      // 'states' — тот же бенто, только список стран и счётчик
      // считаются по матрице состояний; отдельная страница ради
      // другой сетки карточек больше не нужна.
      if (mapView === 'states') mapView = true;
      renderMapPage(container);
      return;
    }

    // Исследования — такой же слой каталога, поэтому живут в одной сетке с темами.
    var shown = visibleThemes();
    container.innerHTML = '<div class="cartography-page">' +
      catalogToolbarMarkup(shown.length) +
      '<div id="cartography-catalog-body">' +
        (shown.length
          ? renderCatalogGroup('Темы карт', shown)
          : '<div class="lab-alert lab-alert-info">По фильтру карт не осталось.</div>') +
      '</div>' +
    '</div>';

    bindCatalog(container);
    bindCatalogToolbar(container);
    refreshIcons();
  }

  function catalogToolbarMarkup(shown) {
    var options = Object.keys(LAYER_LABELS).map(function(value) {
      return '<option value="' + value + '"' + (value === catalog.layer ? ' selected' : '') + '>' + LAYER_LABELS[value] + '</option>';
    }).join('');

    return '<div class="lab-toolbar" role="search" aria-label="Управление каталогом карт">' +
      '<input type="search" class="lab-input lab-toolbar-search" id="cartography-search" autocomplete="off" placeholder="Поиск по картам и исследованиям…" aria-label="Поиск по картам и исследованиям" value="' + escapeHtml(catalog.query) + '">' +
      '<div class="lab-toolbar-group" role="group" aria-label="Фильтры каталога">' +
        '<select id="cartography-layer" class="lab-input lab-toolbar-select' + (catalog.layer !== 'all' ? ' is-filtered' : '') + '" aria-label="Слой каталога">' + options + '</select>' +
        '<button type="button" class="lab-btn lab-btn-secondary lab-toolbar-reset" id="cartography-reset" title="Сбросить фильтры" aria-label="Сбросить фильтры"' + (catalogFiltersActive() ? '' : ' hidden') + '><i data-lucide="rotate-ccw" class="lab-icon" aria-hidden="true"></i></button>' +
      '</div>' +
      '<div class="lab-toolbar-actions">' +
        '<span class="lab-toolbar-count" aria-live="polite"><strong>' + shown + '</strong> из ' + MAP_THEMES.length + '</span>' +
        // Шапка-фича «Глобальная карта состояний» стала кнопкой в панели:
        // целая строка ради одного перехода. data-open-map — штатный
        // делегированный хук модуля (bindCatalog), отдельная привязка не нужна.
        '<button type="button" class="lab-btn lab-btn-primary lab-toolbar-btn" id="cartography-open-map" data-open-map="1" title="Открыть глобальную карту состояний"><i data-lucide="globe" class="lab-icon" aria-hidden="true"></i>Глобальная карта</button>' +
      '</div>' +
    '</div>';
  }

  /* Обновляется только тело каталога: перерисовка всей страницы сбрасывала
     бы фокус в поиске на каждом символе. */
  function refreshCatalogBody(container) {
    var body = container.querySelector('#cartography-catalog-body');
    if (!body) return renderPage(container);
    var shown = visibleThemes();
    body.innerHTML = shown.length
      ? renderCatalogGroup('Темы карт', shown)
      : '<div class="lab-alert lab-alert-info">По фильтру карт не осталось.</div>';
    var count = container.querySelector('.lab-toolbar-count strong');
    if (count) count.textContent = String(shown.length);
    var reset = container.querySelector('#cartography-reset');
    if (reset) reset.hidden = !catalogFiltersActive();
    // Фильтр пересобрал карточки: их data-lucide надо материализовать заново,
    // иначе после первого ввода в поиск чипы останутся пустыми.
    refreshIcons();
  }

  function bindCatalogToolbar(container) {
    var search = container.querySelector('#cartography-search');
    var layer = container.querySelector('#cartography-layer');
    var reset = container.querySelector('#cartography-reset');

    if (search) {
      search.addEventListener('input', function() {
        catalog.query = search.value;
        refreshCatalogBody(container);
      });
    }
    if (layer) {
      layer.addEventListener('change', function() {
        catalog.layer = layer.value;
        layer.classList.toggle('is-filtered', layer.value !== 'all');
        refreshCatalogBody(container);
      });
    }
    if (reset) {
      reset.addEventListener('click', function() {
        catalog.query = '';
        catalog.layer = 'all';
        renderPage(container);
      });
    }
  }

  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (error) { /* иконки не критичны */ }
    }
  }

  function bindCatalog(container) {
    if (container.dataset.cartographyBound === '1') return;
    container.dataset.cartographyBound = '1';
    container.addEventListener('click', function(event) {
      var el = event.target && event.target.closest ? event.target : (event.target && event.target.parentElement);
      if (!el || !el.closest) return;
      var launch = el.closest('[data-open-map]');
      var card = el.closest('.cartography-theme-card');
      if (!launch && !card) return;
      event.preventDefault();
      openThemeMap(card ? card.getAttribute('data-theme-id') : null, !card && !!launch);
      renderPage(container);
    });
    container.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var el = event.target && event.target.closest ? event.target : null;
      if (!el) return;
      var launch = el.closest('[data-open-map]');
      var card = el.closest('.cartography-theme-card');
      if (!launch && !card) return;
      event.preventDefault();
      openThemeMap(card ? card.getAttribute('data-theme-id') : null, !card && !!launch);
      renderPage(container);
    });
  }

  // Выбор объекта идёт через mapSelection: и карта, и список пишут
  // в одно состояние, поэтому паспорт в ячейке 03 всегда соответствует
  // последнему клику в любом из двух входов.
  function selectMapObject(container, selection) {
    mapSelection = selection;
    refreshMapPanels(container);
  }

  function bindMapToolbar(container) {
    var search = container.querySelector('#cartography-map-search');
    var zoomIn = container.querySelector('#cartography-zoom-in');
    var zoomOut = container.querySelector('#cartography-zoom-out');
    var zoomReset = container.querySelector('#cartography-zoom-reset');
    var toCatalog = container.querySelector('#cartography-catalog-link');

    if (search) {
      search.addEventListener('input', function() {
        countryQuery = search.value;
        refreshMapPanels(container);
      });
    }
    // Масштаб применяется к transform напрямую: перерисовка страницы
    // на каждый шаг зума мигала бы и теряла фокус в поиске.
    if (zoomIn) zoomIn.addEventListener('click', function() { zoomMap(container, 1.25); });
    if (zoomOut) zoomOut.addEventListener('click', function() { zoomMap(container, .8); });
    if (zoomReset) zoomReset.addEventListener('click', function() { resetView(container); });
    if (toCatalog) toCatalog.addEventListener('click', function() { mapView = false; mapSelection = null; renderPage(container); });
  }

  function bindMapInteractions(container) {
    var svg = container.querySelector('.cartography-world-svg');

    if (svg) {
      svg.addEventListener('pointerdown', function(event) { mapDragging = true; mapDragStart = { x: event.clientX, y: event.clientY }; svg.setPointerCapture(event.pointerId); svg.classList.add('is-dragging'); });
      svg.addEventListener('pointermove', function(event) { if (!mapDragging) return; var rect = svg.getBoundingClientRect(); mapPan.x += (event.clientX - mapDragStart.x) * 950 / rect.width; mapPan.y += (event.clientY - mapDragStart.y) * 620 / rect.height; mapDragStart = { x: event.clientX, y: event.clientY }; applyViewport(container); });
      svg.addEventListener('pointerup', function() { mapDragging = false; svg.classList.remove('is-dragging'); });
      svg.addEventListener('pointercancel', function() { mapDragging = false; svg.classList.remove('is-dragging'); });
      // Колесо зумит карту, а не страницу: preventDefault обязателен, иначе
      // жест прокручивал модуль и сбивал масштаб мимо ожидания.
      svg.addEventListener('wheel', function(event) {
        event.preventDefault();
        zoomMap(container, event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
      }, { passive: false });
    }

    container.querySelectorAll('.world-country').forEach(function(country) {
      var open = function() { selectMapObject(container, { kind: 'country', id: country.getAttribute('data-country-id') }); };
      country.addEventListener('click', open);
      country.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    container.querySelectorAll('.obelisk-map-marker').forEach(function(marker) {
      var open = function() { selectMapObject(container, { kind: 'obelisk', index: Number(marker.getAttribute('data-obelisk-index')) }); };
      marker.addEventListener('click', open);
      marker.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });

    // Делегирование на контейнере: строки списка и чипы зон
    // перерисовываются вместе с паспортом, отдельные слушатели
    // на каждом элементе пришлось бы вешать заново.
    container.addEventListener('click', function(event) {
      var row = event.target.closest ? event.target.closest('.cmb-row, .cmb-chip') : null;
      if (!row || !container.contains(row)) return;
      if (row.hasAttribute('data-obelisk-index')) {
        selectMapObject(container, { kind: 'obelisk', index: Number(row.getAttribute('data-obelisk-index')) });
        return;
      }
      var name = row.getAttribute('data-country-name');
      if (name) selectMapObject(container, { kind: 'country', name: name });
    });
  }

  function renderCard(e, index) {
    return '<article class="cartography-card" data-id="' + escapeHtml(e.id) + '" tabindex="0" role="button" aria-label="Открыть карточку: ' + escapeHtml(e.name) + '" style="animation-delay:' + (index * 80) + 'ms">' +
      '<header class="cartography-card-header">' +
        '<div class="cartography-card-title-wrap">' +
          '<div class="cartography-card-type">' + escapeHtml(TYPE_LABELS[e.type] || e.type || '') + '</div>' +
          '<h2 class="cartography-card-title">' + escapeHtml(e.name) + '</h2>' +
        '</div>' +
        (e.hebrew ? '<div class="cartography-card-hebrew" dir="rtl" lang="he">' + escapeHtml(e.hebrew) + '</div>' : '') +
      '</header>' +
      '<div class="cartography-card-paleo" dir="rtl">' + escapeHtml(e.paleo || '') + '</div>' +
      '<div class="cartography-card-symbol"><span class="cartography-card-symbol-label">Значение</span> ' + escapeHtml(e.meaning || '') + '</div>' +
      (e.summary ? '<div class="cartography-card-description">' + escapeHtml(e.summary) + '</div>' : '') +
    '</article>';
  }

  // ===== ДЕТАЛЬНЫЙ ПРОСМОТР =====
  function showDetail(id) {
    var entry = entriesById[id];
    if (!entry) {
      if (window.LabToast) LabToast.show('Запись не найдена');
      return;
    }

    var html = buildDetailHTML(entry);
    if (typeof LabModal !== 'undefined') {
      LabModal.show(escapeHtml(entry.name), html, '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>');
    }
  }

  function buildDetailHTML(entry) {
    var eventsHtml = (entry.key_events || []).map(function(ev, index) {
      return '<div class="cartography-event" role="listitem"><span class="cartography-event-number" aria-hidden="true">' + (index + 1) + '</span><span>' + escapeHtml(ev) + '</span></div>';
    }).join('');

    var relatedHtml = (entry.related || []).map(function(id) {
      var target = entriesById[id];
      var label = target ? target.name : id;
      return '<span class="cartography-related-tag" data-related-id="' + escapeHtml(id) + '">' + escapeHtml(label) + '</span>';
    }).join('');

    var paleoBreakdown = entry.symbol_paleo_breakdown && entry.symbol_paleo_breakdown.elements
      ? entry.symbol_paleo_breakdown.elements.map(function(element) {
          return '<li><strong>' + escapeHtml(element.element || '') + '</strong>: ' + escapeHtml(element.paleo || '') + ' — ' + escapeHtml(element.meaning || '') + '</li>';
        }).join('')
      : '<li><strong>' + escapeHtml(entry.paleo || 'Палео-форма не задана') + '</strong>: последовательность знаков для отдельного исследования.</li>';

    var html = '<div class="cartography-detail">' +
      '<div class="cartography-detail-names">' +
        '<div class="cartography-detail-name">' + escapeHtml(entry.name) + '</div>' +
        '<div class="cartography-detail-hebrew" dir="rtl">' + escapeHtml(entry.hebrew || '') + '</div>' +
        '<div class="cartography-detail-paleo" dir="rtl">' + escapeHtml(entry.paleo || '') + '</div>' +
      '</div>' +
      '<div class="cartography-detail-section cartography-callout cartography-meaning">' +
        '<h3>Значение</h3>' +
        '<p>' + escapeHtml(entry.meaning || '—') + '</p>' +
      '</div>' +
      '<div class="cartography-detail-section cartography-callout cartography-summary">' +
        '<h3>Описание</h3>' +
        '<p>' + escapeHtml(entry.summary || '—') + '</p>' +
      '</div>' +
      '<div class="cartography-detail-section cartography-paleo-analysis">' +
        '<h3>Разбор на палео-иврите</h3>' +
        '<p><strong>Палео-форма:</strong> <span class="cartography-detail-paleo" dir="rtl">' + escapeHtml(entry.paleo || '—') + '</span></p>' +
        '<p><strong>Смысловая сборка:</strong> ' + escapeHtml(entry.meaning || 'Географическая среда и её поток') + '</p>' +
        '<ul>' + paleoBreakdown + '</ul>' +
      '</div>' +
      (eventsHtml ? '<div class="cartography-detail-section"><h3>Ключевые события</h3><div class="cartography-events" role="list">' + eventsHtml + '</div></div>' : '') +
      (relatedHtml ? '<div class="cartography-detail-section"><h3>Связанные</h3><div class="cartography-related">' + relatedHtml + '</div></div>' : '') +
    '</div>';

    return html;
  }

  document.addEventListener('click', function(e) {
    var tag = e.target.closest ? e.target.closest('.cartography-related-tag') : null;
    if (tag) {
      var id = tag.getAttribute('data-related-id');
      if (id && entriesById[id]) showDetail(id);
    }
  });

  // ===== ПУБЛИЧНЫЙ API =====
  return {
    init: init,
    loadData: loadData,
    showDetail: showDetail,
    getEntries: function() { return entries; }
  };
})();

window.Cartography = Cartography;

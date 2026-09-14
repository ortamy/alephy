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
  const ERA_LABELS = { ancient: 'Древние', modern: 'Современные' };
  const REGION_LABELS = {
    Levant: 'Левант', Egypt: 'Египет', Mesopotamia: 'Месопотамия',
    Arabia: 'Аравия', Europe: 'Европа', Persia: 'Персия'
  };

  let entries = [];
  let entriesById = {};
  let dataPromise = null;
  let worldMapPromise = null;
  let worldMapMarkup = '';
  let countryDescriptions = {};
  let countryStates = {};
  let stateMatrixCountries = [];
  let filters = { era: '', type: '', region: '' };
  let mapView = false;
  let mapZoom = 1;
  let mapPan = { x: 0, y: 0 };
  let mapDragging = false;
  let mapDragStart = { x: 0, y: 0 };
  let genderMatrix = { zones: {} };
  let genderMapMarkup = '';

  const MAP_THEMES = [
    { id: 'near-east', title: 'Ближний Восток', description: 'Узлы Леванта, Египта и Месопотамии: среда ранних потоков и сдвигов.', mark: '𐤀' },
    { id: 'europe', title: 'Европа', description: 'Континентальная карта состояний, границ и исторических переходов.', mark: '𐤄' },
    { id: 'empires', title: 'Империи', description: 'Крупные державы как пространственные конструкции и зоны влияния.', mark: '𐤌' },
    { id: 'ancient-routes', title: 'Древние маршруты', description: 'Регионы, города и коридоры, через которые двигался Давар.', mark: '𐤃' },
    { id: 'modern-states', title: 'Современные государства', description: 'Глобальный слой диагностики по матрице состояний стран.', mark: '𐤔' },
    { id: 'state-matrix', title: 'Матрица состояний', description: 'Поле Хошех и Ор: сравнение доминирующих состояний на одной карте.', mark: '𐤏' },
    { id: 'gender-images', title: 'Эшет хаиль и Иш хаиль', topic: 'Карта сохранённых образов', description: 'В каких культурах женщина-строитель (эшет хаиль) и мужчина-созидатель (иш хаиль) сохранили свою палео-функцию? Греко-римский слой vs естественная среда', mark: '𐤀' },
    { id: 'obelisks', title: 'Обелиски', topic: 'Карта городских доминант', description: 'Страны и города, где стоят крупные обелиски — вертикальные знаки, собранные в один исследовательский слой.', mark: '𐤋' }
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
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
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
          countryDescriptions[country.name] = country.note || '';
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
  function getFiltered() {
    return entries.filter(function(e) {
      if (filters.era && e.era !== filters.era) return false;
      if (filters.type && e.type !== filters.type) return false;
      if (filters.region && e.region !== filters.region) return false;
      return true;
    });
  }

  function setFilter(kind, value) {
    filters[kind] = filters[kind] === value ? '' : value;
    var container = document.getElementById('cartography');
    if (container) renderPage(container);
  }

  // ===== СБОРКА НАБОРА ЗНАЧЕНИЙ ДЛЯ ФИЛЬТРОВ =====
  function buildFilterGroup(kind, labels) {
    var seen = {};
    entries.forEach(function(e) { if (e[kind]) seen[e[kind]] = true; });
    var values = Object.keys(seen);
    if (!values.length) return '';
    var buttons = values.map(function(v) {
      var active = filters[kind] === v ? ' active' : '';
      var label = (labels[v] || v);
      return '<button type="button" class="cartography-filter-btn' + active + '" data-filter-kind="' + kind + '" data-filter-value="' + escapeHtml(v) + '">' + escapeHtml(label) + '</button>';
    }).join('');
    return '<div class="cartography-filter-group" data-filter-group="' + kind + '">' + buttons + '</div>';
  }

  function renderWorldMap(fullscreen, gender) {
    var obeliskMap = fullscreen && mapView === 'obelisks';
    var mapMarkup = gender ? genderMapMarkup : worldMapMarkup;
    var title = obeliskMap ? 'Обелиски' : (gender ? 'Эшет хаиль и Иш хаиль' : 'Карта мира');
    var kicker = obeliskMap ? 'КАРТА ГОРОДСКИХ ДОМИНАНТ' : (gender ? 'КАРТА СОХРАНЁННЫХ ОБРАЗОВ' : 'RESEARCH LAB · КАРТА СОСТОЯНИЙ');
    var legend = obeliskMap ? '<div class="cartography-map-legend" aria-label="Легенда обелисков"><span><i class="obelisk-map-marker" aria-hidden="true"></i>Город с крупным обелиском</span></div>' : (gender ? '<div class="gender-map-legend"><span class="gender-legend-direct">Образ сохранён напрямую</span><span class="gender-legend-indirect">Сохранён косвенно</span><span class="gender-legend-lost">Образ утрачен</span><span class="gender-legend-unknown">Нет данных</span></div>' : '<div class="cartography-map-legend" aria-label="Легенда состояний">' + [['tohu', 'Тоху'], ['hoshekh', 'Хошех'], ['mizraim', 'Мицраим'], ['rakia', 'Ракиа'], ['shamaim', 'Шамаим'], ['midbar', 'Мидбар'], ['erets', 'Эрец'], ['eden', 'Эден']].map(function(item) { return '<span><i class="world-state-' + item[0] + '" aria-hidden="true"></i>' + item[1] + '</span>'; }).join('') + '</div>');
    var controls = gender ? '' : '<div class="cartography-map-controls" role="group" aria-label="Управление масштабом карты"><button type="button" class="cartography-map-zoom-in" title="Увеличить масштаб">+</button><button type="button" class="cartography-map-zoom-out" title="Уменьшить масштаб">−</button><button type="button" class="cartography-map-zoom-reset">Сбросить масштаб</button></div>';
    var description = obeliskMap ? 'Маркеры показывают города из рабочего реестра. Нажмите на маркер, чтобы увидеть название и высоту.' : (gender ? 'Зоны показывают, где палео-функция образа сохранилась, сместилась или утрачена.' : 'Наведите на страну, чтобы открыть диагноз по state-matrix.json.');
    var markers = obeliskMap ? '<g class="obelisk-map-markers">' + OBELISKS.map(function(item, index) { return '<g class="obelisk-map-marker" data-obelisk-index="' + index + '" tabindex="0" role="button" aria-label="' + escapeHtml(item.city + ': ' + item.name) + '"><circle cx="' + item.x + '" cy="' + item.y + '" r="7"></circle><path d="M' + item.x + ' ' + (item.y - 5) + 'v-13"></path></g>'; }).join('') + '</g>' : '';
    return '<section class="cartography-world' + (fullscreen ? ' cartography-world-fullscreen' : '') + '" aria-labelledby="cartography-world-title">' +
      '<div class="cartography-world-head"><div><span class="cartography-world-kicker">' + kicker + '</span><h2 id="cartography-world-title">' + title + '</h2><p>' + description + '</p></div>' +
      (fullscreen ? '<button type="button" class="lab-btn lab-btn-secondary cartography-back">Назад к темам</button>' : '') + '</div>' +
      '<div class="cartography-map-canvas"><svg class="cartography-world-svg" viewBox="0 0 950 620" role="img" aria-label="Интерактивная карта мира" focusable="false">' +
        '<rect class="world-sea" x="0" y="0" width="950" height="620"></rect>' +
        '<g class="world-map-viewport" transform="translate(' + mapPan.x + ' ' + mapPan.y + ') scale(' + mapZoom + ')"><g class="world-countries">' + mapMarkup + '</g>' + markers + '</g>' +
      '</svg>' + controls + '</div>' +
      legend + (obeliskMap ? '<div class="obelisk-registry"><h3>Страны и города в реестре</h3><div class="obelisk-registry-grid">' + OBELISKS.map(function(item) { return '<article><strong>' + escapeHtml(item.country) + '</strong><span>' + escapeHtml(item.city) + ' · ' + escapeHtml(item.height) + '</span></article>'; }).join('') + '</div><p class="obelisk-note">Рабочая выборка, не полный мировой каталог. Высота указана для самого обелиска или стелы; состав реестра можно расширять.</p></div>' : '') +
    '</section>';
  }

  function renderThemeCard(theme, index) {
    return '<article class="cartography-theme-card" style="animation-delay:' + (index * 70) + 'ms">' +
      '<div class="cartography-theme-preview" aria-hidden="true"><svg viewBox="0 0 950 620" focusable="false"><rect class="world-sea" x="0" y="0" width="950" height="620"></rect><g class="world-countries">' + worldMapMarkup + '</g></svg><span class="cartography-theme-mark">' + theme.mark + '</span></div>' +
      '<div class="cartography-theme-body"><span class="cartography-card-type">' + escapeHtml(theme.topic || 'Тема карты') + '</span><h2 class="cartography-card-title">' + escapeHtml(theme.title) + '</h2><p class="cartography-card-summary">' + escapeHtml(theme.description) + '</p>' +
      '<button type="button" class="lab-btn lab-btn-primary cartography-open-map" data-theme-id="' + escapeHtml(theme.id) + '">Открыть карту</button></div></article>';
  }

  function renderStateCard(country, index) {
    var states = country.states || {};
    var dominantState = Object.keys(states).sort(function(a, b) { return Number(states[b]) - Number(states[a]); })[0] || 'unknown';
    var diagnosis = country.diagnosis || country.note || 'Диагноз уточняется.';
    return '<article class="cartography-state-card" data-country-name="' + escapeHtml(country.name) + '" tabindex="0" role="button" aria-label="Открыть диагноз: ' + escapeHtml(country.name) + '" style="animation-delay:' + (index * 35) + 'ms">' +
      '<div class="cartography-state-card-head"><span class="cartography-card-type">Карта состояний</span><span class="cartography-state-dot world-state-' + escapeHtml(dominantState) + '" aria-hidden="true"></span></div>' +
      '<h2>' + escapeHtml(country.name) + '</h2><p>' + escapeHtml(diagnosis) + '</p></article>';
  }

  function renderStateMatrixPage(container) {
    container.innerHTML = '<div class="cartography-state-page"><div class="cartography-map-shell">' + renderWorldMap(true, false) + '</div><div class="cartography-state-search"><label for="cartography-country-search">Поиск страны</label><input id="cartography-country-search" type="search" placeholder="Введите название страны" autocomplete="off"></div><div class="cartography-state-grid">' + stateMatrixCountries.map(renderStateCard).join('') + '</div></div>';
    bindMapInteractions(container);
    var openCountry = function(card) {
      var country = stateMatrixCountries.find(function(item) { return item.name === card.getAttribute('data-country-name'); });
      if (country) showStateCountryDetail(country);
    };
    container.querySelector('.cartography-back').addEventListener('click', function() { mapView = false; renderPage(container); });
    container.querySelector('#cartography-country-search').addEventListener('input', function() {
      var query = this.value.trim().toLocaleLowerCase();
      container.querySelectorAll('.cartography-state-card').forEach(function(card) {
        card.hidden = query && card.getAttribute('data-country-name').toLocaleLowerCase().indexOf(query) === -1;
      });
    });
    container.querySelectorAll('.cartography-state-card').forEach(function(card) {
      card.addEventListener('click', function() { openCountry(this); });
      card.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCountry(this); } });
    });
  }

  function showStateCountryDetail(country) {
    var diagnosis = country.diagnosis || country.note || 'Диагноз уточняется.';
    var html = '<div class="cartography-detail cartography-map-detail"><div class="cartography-detail-section cartography-callout"><p><strong>Диагноз:</strong> ' + escapeHtml(diagnosis) + '</p><p>' + escapeHtml(country.note || '') + '</p></div></div>';
    if (typeof LabModal !== 'undefined') LabModal.show(escapeHtml(country.name), html, '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>');
  }

  // ===== РЕНДЕРИНГ СТРАНИЦЫ =====
  function renderPage(container) {
    if (!entries.length) {
      container.innerHTML = '<div class="lab-alert lab-alert-info">Картография пока пуста. Записи добавляются.</div>';
      return;
    }

    if (mapView) {
      if (mapView === 'states') {
        renderStateMatrixPage(container);
        return;
      }
      container.innerHTML = '<div class="cartography-map-shell">' + renderWorldMap(true, mapView === 'gender') + '</div>';
      bindMapInteractions(container);
      return;
    }

    container.innerHTML = '<header class="section-hero">' +
        '<div class="section-hero-watermark" aria-hidden="true">𐤀 𐤁 𐤂 𐤃 𐤄 𐤅</div>' +
        '<div class="section-hero-kicker">АЛЕФИ · КАРТОГРАФИЯ</div>' +
        '<h1><img src="assets/icons/32/ui/web.png" class="lab-icon" alt="">Картография</h1>' +
        '<p class="section-hero-lead">Смысловая карта: страны, города и регионы как пространственные конструкции.</p>' +
      '</header>' +
      '<button type="button" class="cartography-world-launch" data-open-map="1"><span aria-hidden="true">𐤌</span><span><strong>Глобальная карта состояний</strong><small>Открыть полный слой диагностики</small></span></button>' +
      '<div class="cartography-theme-grid">' + MAP_THEMES.map(renderThemeCard).join('') + '</div>';

    container.querySelectorAll('.cartography-open-map, .cartography-world-launch').forEach(function(button) {
      button.addEventListener('click', function() { var themeId = this.getAttribute('data-theme-id'); mapView = this.hasAttribute('data-open-map') ? 'states' : (themeId === 'gender-images' ? 'gender' : (themeId === 'obelisks' ? 'obelisks' : true)); renderPage(container); });
    });
    bindMapInteractions(container);
  }

  function bindMapInteractions(container) {
    var back = container.querySelector('.cartography-back');
    if (back) back.addEventListener('click', function() { mapView = false; renderPage(container); });
    var svg = container.querySelector('.cartography-world-svg');
    var zoomIn = container.querySelector('.cartography-map-zoom-in');
    var zoomOut = container.querySelector('.cartography-map-zoom-out');
    var zoomReset = container.querySelector('.cartography-map-zoom-reset');
    function rerenderMap() { renderPage(container); }
    if (zoomIn) zoomIn.addEventListener('click', function() { mapZoom = Math.min(3, +(mapZoom + .25).toFixed(2)); rerenderMap(); });
    if (zoomOut) zoomOut.addEventListener('click', function() { mapZoom = Math.max(1, +(mapZoom - .25).toFixed(2)); rerenderMap(); });
    if (zoomReset) zoomReset.addEventListener('click', function() { mapZoom = 1; mapPan = { x: 0, y: 0 }; rerenderMap(); });
    if (svg && !container.querySelector('.cartography-map-shell .cartography-state-grid')) {
      svg.addEventListener('pointerdown', function(event) { mapDragging = true; mapDragStart = { x: event.clientX, y: event.clientY }; svg.setPointerCapture(event.pointerId); svg.classList.add('is-dragging'); });
      svg.addEventListener('pointermove', function(event) { if (!mapDragging) return; var rect = svg.getBoundingClientRect(); mapPan.x += (event.clientX - mapDragStart.x) * 950 / rect.width; mapPan.y += (event.clientY - mapDragStart.y) * 620 / rect.height; mapDragStart = { x: event.clientX, y: event.clientY }; var viewport = svg.querySelector('.world-map-viewport'); if (viewport) viewport.setAttribute('transform', 'translate(' + mapPan.x + ' ' + mapPan.y + ') scale(' + mapZoom + ')'); });
      svg.addEventListener('pointerup', function() { mapDragging = false; svg.classList.remove('is-dragging'); });
      svg.addEventListener('pointercancel', function() { mapDragging = false; svg.classList.remove('is-dragging'); });
    }
    container.querySelectorAll('.world-country').forEach(function(country) {
      country.addEventListener('click', function() { showCountryDetail(this.getAttribute('data-country-id')); });
      country.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showCountryDetail(this.getAttribute('data-country-id')); }
      });
    });
    container.querySelectorAll('.obelisk-map-marker').forEach(function(marker) {
      var open = function() { showObeliskDetail(OBELISKS[Number(marker.getAttribute('data-obelisk-index'))]); };
      marker.addEventListener('click', open);
      marker.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
  }

  function showObeliskDetail(item) {
    if (!item || typeof LabModal === 'undefined') return;
    var html = '<div class="cartography-detail cartography-map-detail"><div class="cartography-detail-section cartography-callout"><p><strong>Город:</strong> ' + escapeHtml(item.city + ', ' + item.country) + '</p><p><strong>Высота:</strong> ' + escapeHtml(item.height) + '</p><p>' + escapeHtml(item.note) + '</p></div></div>';
    LabModal.show(escapeHtml(item.name), html, '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>');
  }

  function showCountryDetail(countryId) {
    var info = MAP_INFO[countryId] || MAP_COUNTRY_NAMES[countryId] || [countryId.replace(/[-_]/g, ' '), 'Не определён'];
    if (mapView === 'gender') {
      var zone = genderZoneForCountry(countryId);
      var labels = { direct: 'Образ сохранён напрямую', indirect: 'Образ сохранён косвенно', lost: 'Образ утрачен', unknown: 'Нет данных' };
      var genderHtml = '<div class="cartography-detail cartography-map-detail"><div class="cartography-detail-section cartography-callout"><p><strong>Зона:</strong> ' + escapeHtml(labels[zone]) + '</p><p>Эшет хаиль — женщина-строитель; Иш хаиль — мужчина-созидатель. Карта фиксирует сохранённость функции в культурной среде.</p></div></div>';
      if (typeof LabModal !== 'undefined') LabModal.show(escapeHtml(info[0]), genderHtml, '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>');
      return;
    }
    var hasData = Boolean(countryStates[info[0]]);
    var description = countryDescriptions[info[0]] || (hasData
      ? 'Географическая точка в карте потока.'
      : 'Данные уточняются. Поток в этой стране пока не диагностирован');
    var diagnosis = hasData ? countryStates[info[0]] : 'Данные уточняются. Поток в этой стране пока не диагностирован';
    var html = '<div class="cartography-detail cartography-map-detail"><div class="cartography-detail-section cartography-callout">' +
      '<p><strong>Материк:</strong> ' + escapeHtml(info[1]) + '</p>' +
      '<p><strong>Диагноз:</strong> ' + escapeHtml(diagnosis) + '</p>' +
      '<p>' + escapeHtml(description) + '</p>' +
      '</div></div>';
    if (typeof LabModal !== 'undefined') LabModal.show(escapeHtml(info[0]), html, '<button class="lab-btn lab-btn-secondary lab-btn-sm" onclick="LabModal.close()">Закрыть</button>');
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

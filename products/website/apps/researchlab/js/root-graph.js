(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RootGraph = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
  'use strict';

  var PALEO_RANGE = /^[\u{10900}-\u{1091F}]+$/u;

  function rootId(entry) { return String(entry && entry.translit || '').trim().toUpperCase(); }
  function paleo(entry) {
    var value = Array.isArray(entry && entry.paleo) ? entry.paleo.join('') : String(entry && entry.paleo || '');
    return PALEO_RANGE.test(value) ? value : '';
  }
  function getRootById(roots, id) {
    var wanted = decodeURIComponent(String(id || '')).trim().toUpperCase();
    return (roots || []).filter(function(entry) { return rootId(entry) === wanted; })[0] || null;
  }
  function getRootLinks(links, id) {
    var wanted = String(id || '').trim().toUpperCase();
    return (links || []).filter(function(link) {
      return String(link.from || '').toUpperCase() === wanted || String(link.to || '').toUpperCase() === wanted;
    });
  }
  /* Кэш палео-знаков по корню: shared() зовёт paleo() для каждой пары, то есть
     один и тот же корень пересчитывался до 328 раз за проход. */
  function shared(list) {
    var result = [];
    var glyphs = list.map(function(entry) { return paleo(entry).split(''); });
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var aGlyphs = glyphs[i], bGlyphs = glyphs[j];
        var overlap = aGlyphs.filter(function(g) { return bGlyphs.indexOf(g) !== -1; });
        if (overlap.length) result.push({ from:rootId(list[i]), to:rootId(list[j]), type:'shared-letter', source:'computed', confidence:'probable', label:'Общая палео-буква', note:'Совпадают знаки: ' + overlap.join(' · ') });
      }
    }
    return result;
  }
  function buildComputedLinks(roots) {
    var links = shared((roots || []).filter(function(entry) { return rootId(entry) && paleo(entry); }));
    /* Дедуп по паре (from, to) через Set. Раньше здесь стоял
       links.filter(... links.findIndex(...)): O(m^2) поверх m = O(n^2) пар.
       При 329 корнях это ~54 тыс. связей и ~2.9 млрд сравнений — на старте
       страницы график корней съедал ~5.7 с главного потока, и интерфейс
       не отвечал на hover. Смысл (оставить первую связь пары) тот же. */
    var seen = Object.create(null);
    return links.filter(function(link) {
      var key = link.from + '|' + link.to;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function mergeLinks(roots, manualLinks) {
    var computed = buildComputedLinks(roots), manual = (manualLinks || []).filter(function(link) {
      return link && link.from && link.to && ['shared-letter','shared-function','semantic-field','example','substitution','paleo-chain'].indexOf(link.type) !== -1;
    }).map(function(link) { return Object.assign({ source:'researcher', confidence:'hypothesis' }, link); });
    var manualKeys = manual.reduce(function(result, link) {
      result[String(link.from).toUpperCase() + '|' + String(link.to).toUpperCase() + '|' + link.type] = true;
      return result;
    }, {});
    computed = computed.filter(function(link) {
      return !manualKeys[String(link.from).toUpperCase() + '|' + String(link.to).toUpperCase() + '|' + link.type];
    });
    return manual.concat(computed);
  }
  function localGraph(roots, links, id) {
    var selected = getRootById(roots, id), selectedId = rootId(selected);
    if (!selected) return { root:null, nodes:[], links:[] };
    // Local-first guard: common letters can create many computed edges.
    var localLinks = getRootLinks(links, selectedId).slice(0, 12), ids = [selectedId];
    localLinks.forEach(function(link) { var other = link.from === selectedId ? link.to : link.from; if (ids.indexOf(other) === -1) ids.push(other); });
    return { root:selected, nodes:ids.map(function(nodeId) { return getRootById(roots, nodeId); }).filter(Boolean), links:localLinks };
  }
  return { rootId:rootId, paleo:paleo, getRootById:getRootById, getRootLinks:getRootLinks, buildComputedLinks:buildComputedLinks, mergeLinks:mergeLinks, localGraph:localGraph, isPaleo:function(value) { return PALEO_RANGE.test(String(value || '')); } };
}));
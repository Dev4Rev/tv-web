(function () {
  'use strict';

  function parseM3U(text) {
    var lines = text.split(/\r?\n/);
    var channels = [];
    var current = null;
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) continue;
      if (t.indexOf('#EXTINF') === 0) {
        var afterComma = t.indexOf(',');
        var name = afterComma !== -1 ? t.slice(afterComma + 1).trim() : 'Без названия';
        var logoMatch = t.match(/tvg-logo="([^"]*)"/);
        var groupMatch = t.match(/group-title="([^"]*)"/);
        current = {
          name: name,
          logo: logoMatch ? logoMatch[1] : '',
          group: (groupMatch && groupMatch[1]) ? groupMatch[1] : 'Без группы'
        };
      } else if (t.charAt(0) !== '#' && current) {
        current.url = t;
        channels.push(current);
        current = null;
      }
    }
    return channels;
  }

  function normalizeUrl(url) {
    return url.replace(/^["']|["']$/g, '').trim();
  }

  function loadPlaylist(url) {
    // Таймаут 20 секунд через AbortController
    var controller = null;
    var timeoutId = null;
    var signal = null;

    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(function () { controller.abort(); }, 20000);
    }

    var opts = { cache: 'no-cache' };
    if (signal) opts.signal = signal;

    return fetch(url, opts)
      .then(function (r) {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        if (!text || text.length < 10) throw new Error('empty');
        return parseM3U(text);
      })
      .catch(function (e) {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        if (e && e.name === 'AbortError') throw new Error('timeout');
        throw e;
      });
  }

  window.dev4revParseM3U = parseM3U;
  window.dev4revLoadPlaylist = loadPlaylist;
  window.dev4revNormalizeUrl = normalizeUrl;
})();
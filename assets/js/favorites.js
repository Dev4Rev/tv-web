(function () {
  'use strict';

  var KEY = 'dev4rev.tv.favorites';
  var MAX = 400;

  function valid(ch) {
    return !!ch && typeof ch.url === 'string' && /^https?:\/\//i.test(ch.url);
  }

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(valid).map(function (ch) {
        return {
          name: String(ch.name || 'Без названия'),
          url: ch.url,
          logo: String(ch.logo || ''),
          group: String(ch.group || 'Без группы'),
          ts: Number(ch.ts) || Date.now()
        };
      });
    } catch (e) { return []; }
  }

  function emit() {
    try {
      window.dispatchEvent(new CustomEvent('dev4rev:favoriteschange', {
        detail: { count: read().length }
      }));
    } catch (e) {}
  }

  function write(list) {
    var next = list.filter(valid).slice(0, MAX);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
    emit();
    return next;
  }

  function has(url) {
    if (!url) return false;
    return read().some(function (ch) { return ch.url === url; });
  }

  function plain(ch) {
    return {
      name: String((ch && ch.name) || 'Без названия'),
      url: String((ch && ch.url) || ''),
      logo: String((ch && ch.logo) || ''),
      group: String((ch && ch.group) || 'Без группы'),
      ts: Date.now()
    };
  }

  function toggle(ch) {
    var item = plain(ch);
    if (!valid(item)) return read();
    var list = read().filter(function (x) { return x.url !== item.url; });
    if (!has(item.url)) list.unshift(item);
    return write(list);
  }

  function remove(url) {
    return write(read().filter(function (ch) { return ch.url !== url; }));
  }

  function clear() { return write([]); }

  window.dev4revFavorites = {
    key: KEY,
    get: read,
    has: has,
    toggle: toggle,
    remove: remove,
    clear: clear
  };

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) emit();
  });
})();

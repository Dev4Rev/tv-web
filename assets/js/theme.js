(function () {
  'use strict';
<<<<<<< HEAD
  var THEME_KEY = 'dev4rev.theme';
  var TV_KEY = 'dev4rev.tvMode';

  // ─── Theme ─────────────────────────────────────────────────
  var themeButtons = document.querySelectorAll('[data-theme-value]');
  function getTheme() { return document.documentElement.dataset.theme || 'auto'; }
  function setTheme(value) {
    var v = (value === 'light' || value === 'dark') ? value : 'auto';
    document.documentElement.dataset.theme = v;
    try { localStorage.setItem(THEME_KEY, v); } catch (e) {}
    themeButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.themeValue === v ? 'true' : 'false');
    });
  }
  themeButtons.forEach(function (b) {
    b.addEventListener('click', function () { setTheme(b.dataset.themeValue); });
  });
  setTheme(getTheme());

    // ─── TV mode ───────────────────────────────────────────────
=======
  var TV_KEY = 'dev4rev.tvMode';

  // ─── TV mode ───────────────────────────────────────────────
>>>>>>> 08f7507 (updated playlists, new visual)
  var tvToggle = document.getElementById('tvToggle');

  function isMobileDevice() {
    try {
      if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        return false;
      }
    } catch (e) { return false; }
    var ua = navigator.userAgent || '';
    if (/SmartTV|Tizen|Web0S|WebOS|HbbTV|NETCAST|Viera|BRAVIA|Aquos|SmartHub|AndroidTV|GoogleTV|AppleTV|PhilipsTV|Hisense|Vestel|Roku/i.test(ua)) {
      return false; // SmartTV с пультом — touch может быть
    }
    return true;
  }

  function getTvMode() { return document.documentElement.dataset.tvMode || 'auto'; }
  function isTvActive() { return getTvMode() === 'on'; }

  function setTvMode(value) {
<<<<<<< HEAD
    // На мобильных ТВ-режим запрещён
=======
>>>>>>> 08f7507 (updated playlists, new visual)
    if (isMobileDevice()) {
      document.documentElement.dataset.tvMode = 'off';
      try { localStorage.removeItem(TV_KEY); } catch (e) {}
      updateTvToggleState();
      return;
    }

    var v = (value === 'on' || value === 'off') ? value : 'auto';
    if (v === 'auto') {
      try { localStorage.removeItem(TV_KEY); } catch (e) {}
      var ua = navigator.userAgent || '';
      var isTvUA = /SmartTV|Tizen|Web0S|WebOS|HbbTV|NETCAST|Viera|BRAVIA|Aquos|SmartHub|AndroidTV|GoogleTV|AppleTV|PhilipsTV|Hisense|Vestel|Roku/i.test(ua);
      var isBigScreen = window.screen && window.screen.width >= 1600 && window.screen.height >= 900;
      var isDesktopBig = !('ontouchstart' in window) && isBigScreen;
      document.documentElement.dataset.tvMode = (isTvUA || isDesktopBig) ? 'on' : 'off';
    } else {
      try { localStorage.setItem(TV_KEY, v); } catch (e) {}
      document.documentElement.dataset.tvMode = v;
    }
    updateTvToggleState();
    window.dispatchEvent(new CustomEvent('dev4rev:tvchange', { detail: { active: isTvActive() } }));
  }

  function updateTvToggleState() {
    if (!tvToggle) return;
    var active = isTvActive();
    tvToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
<<<<<<< HEAD
=======
    tvToggle.setAttribute('aria-label', active ? 'Выключить ТВ-режим' : 'Включить ТВ-режим');
    tvToggle.setAttribute('title', active ? 'ТВ-режим включён' : 'ТВ-режим');
>>>>>>> 08f7507 (updated playlists, new visual)
    tvToggle.classList.toggle('is-active', active);
  }

  if (tvToggle) {
    tvToggle.addEventListener('click', function () {
<<<<<<< HEAD
      if (isMobileDevice()) return; // защита от случайного клика
=======
      if (isMobileDevice()) return;
>>>>>>> 08f7507 (updated playlists, new visual)
      setTvMode(isTvActive() ? 'off' : 'on');
    });
  }

<<<<<<< HEAD
  // При инициализации: если мобильный — принудительно off
=======
>>>>>>> 08f7507 (updated playlists, new visual)
  if (isMobileDevice()) {
    document.documentElement.dataset.tvMode = 'off';
    try { localStorage.removeItem(TV_KEY); } catch (e) {}
  }
  updateTvToggleState();

<<<<<<< HEAD
  // Экспорт
  window.dev4revSetTheme = setTheme;
  window.dev4revGetTheme = getTheme;
=======
  // Кинотеатр и ТВ-режим исключают друг друга.
  window.addEventListener('dev4rev:tvchange', function (e) {
    if (e.detail && e.detail.active === false && isTvActive()) setTvMode('off');
  });

>>>>>>> 08f7507 (updated playlists, new visual)
  window.dev4revSetTvMode = setTvMode;
  window.dev4revIsTvActive = isTvActive;
  window.dev4revIsMobileDevice = isMobileDevice;
})();

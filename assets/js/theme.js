(function () {
  'use strict';
  var TV_KEY = 'dev4rev.tvMode';

  // ─── TV mode ───────────────────────────────────────────────
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
      document.documentElement.dataset.tvMode = isTvUA ? 'on' : 'off';
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
    tvToggle.setAttribute('aria-label', active ? 'Выключить ТВ-режим' : 'Включить ТВ-режим');
    tvToggle.setAttribute('title', active ? 'ТВ-режим включён' : 'ТВ-режим');
    tvToggle.classList.toggle('is-active', active);
  }

  if (tvToggle) {
    tvToggle.addEventListener('click', function () {
      if (isMobileDevice()) return;
      setTvMode(isTvActive() ? 'off' : 'on');
    });
  }

  if (isMobileDevice()) {
    document.documentElement.dataset.tvMode = 'off';
    try { localStorage.removeItem(TV_KEY); } catch (e) {}
  }
  updateTvToggleState();

  // Кинотеатр и ТВ-режим исключают друг друга.
  window.addEventListener('dev4rev:tvchange', function (e) {
    if (e.detail && e.detail.active === false && isTvActive()) setTvMode('off');
  });

  window.dev4revSetTvMode = setTvMode;
  window.dev4revIsTvActive = isTvActive;
  window.dev4revIsMobileDevice = isMobileDevice;
})();

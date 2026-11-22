(function () {
  'use strict';

  var slot = null;
  var player = null;
  var wrap = null;
  var toPlayerBtn = null;
  var miniExpandBtn = null;
  var miniCloseBtn = null;

  var raf = null;
  var miniActive = false;
  var miniSuspended = false;
  var wasMiniBeforeFs = false;
  var dismissed = false;
  var savedSlotHeight = 0;

  function isFullscreen() {
    return !!(wrap && (document.fullscreenElement === wrap ||
                       document.webkitFullscreenElement === wrap));
  }

  // На мобильных мини-плеер и кнопка «К плееру» закрывают слишком много
  // контента — полностью отключаем этот режим.
  function isMobileLayout() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
  }

  function topbarHeight() {
    var v = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--topbar-h'));
    return isFinite(v) ? v : 64;
  }

  function syncMiniHeight() {
    if (!player) return;
    var h = player.getBoundingClientRect().height;
    if (h > 0) document.documentElement.style.setProperty('--mini-h', Math.round(h) + 'px');
  }

  function setMini(active) {
    if (!player || !slot) return;
    if (active && isMobileLayout()) active = false;
    if (active && miniActive && !miniSuspended) { syncMiniHeight(); return; }
    if (!active && !miniActive) return;

    if (active) {
      // В мини-плеере панели не нужны — убираем их мгновенно, до изменения
      // размеров окна, иначе панель «проезжает» по уменьшающемуся видео.
      // Сначала закрываем контекст cinema (он тоже дёргает панель), и только
      // потом накладываем мгновенное скрытие — иначе анимация перезапишет его.
      if (window.dev4revCinema && window.dev4revCinema.closeContext) {
        window.dev4revCinema.closeContext();
      }
      if (window.dev4revApp && window.dev4revApp.setPlayerListOpen) {
        window.dev4revApp.setPlayerListOpen(false, null, true);
      }
      var quality = document.getElementById('qualityMenu');
      if (quality) quality.classList.remove('is-open');
      if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();

      if (!savedSlotHeight) savedSlotHeight = slot.getBoundingClientRect().height;
      if (savedSlotHeight > 0) slot.style.height = savedSlotHeight + 'px';
      player.classList.add('is-mini');
      document.body.classList.add('has-mini-player');
      miniActive = true;
      syncMiniHeight();
    } else {
      player.classList.remove('is-mini');
      document.body.classList.remove('has-mini-player');
      miniActive = false;
      var panel = document.getElementById('playerChannels');
      if (panel) panel.classList.remove('is-instant-close');
      if (!miniSuspended) {
        slot.style.height = '';
        savedSlotHeight = 0;
        document.documentElement.style.removeProperty('--mini-h');
      }
    }
  }

  function update() {
    raf = null;
    if (!player || player.hidden) {
      setMini(false);
      if (toPlayerBtn) toPlayerBtn.classList.remove('is-visible', 'is-above-mini');
      return;
    }
    if (isFullscreen()) {
      // В fullscreen мини-плеер не нужен, но высоту слота сохраняем.
      if (toPlayerBtn) toPlayerBtn.classList.remove('is-visible', 'is-above-mini');
      return;
    }
    if (isMobileLayout()) {
      if (toPlayerBtn) toPlayerBtn.classList.remove('is-visible', 'is-above-mini');
      if (miniActive) setMini(false);
      return;
    }

    var rect = slot.getBoundingClientRect();
    var topEdge = topbarHeight();
    // Плеер считается ушедшим из поля зрения, когда он полностью скрылся
    // под шапкой ИЛИ его верхняя граница зашла за шапку и внизу осталось
    // меньше четверти высоты. На коротких страницах плеер никогда не уезжает
    // целиком за экран, поэтому одного первого условия недостаточно.
    var past = rect.bottom < topEdge + 72 ||
      (rect.top < topEdge && rect.bottom < topEdge + rect.height * 0.8);
    var below = rect.top > window.innerHeight - 72;

    if (!past && !below) dismissed = false;
    setMini(past && !dismissed);

    if (toPlayerBtn) {
      toPlayerBtn.classList.toggle('is-visible', past || below);
      toPlayerBtn.classList.toggle('is-above-mini', miniActive);
    }
  }

  function updateSoon() {
    if (raf) return;
    raf = requestAnimationFrame(update);
  }

  function scrollToPlayer(immediate) {
    if (!player || !slot) return;
    dismissed = false;
    var y = Math.max(0, slot.getBoundingClientRect().top + window.scrollY - topbarHeight() - 8);
    if (immediate) {
      // Нужно, чтобы мини-режим сбросился ещё до открытия панели плеера.
      window.scrollTo(0, y);
      update();
    } else {
      try {
        window.scrollTo({ top: y, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, y);
      }
      updateSoon();
    }
    if (window.dev4revControls && window.dev4revControls.show) {
      window.dev4revControls.show();
    }
  }

  function suspendForFullscreen(active) {
    if (!player || active === miniSuspended) return;
    if (active) {
      wasMiniBeforeFs = miniActive;
      if (miniActive) {
        player.classList.remove('is-mini');
        document.body.classList.remove('has-mini-player');
        miniSuspended = true;
      }
    } else {
      if (miniSuspended) {
        miniSuspended = false;
        if (wasMiniBeforeFs && !dismissed && !isMobileLayout()) {
          player.classList.add('is-mini');
          document.body.classList.add('has-mini-player');
          syncMiniHeight();
        } else {
          slot.style.height = '';
          savedSlotHeight = 0;
          document.documentElement.style.removeProperty('--mini-h');
          var panel = document.getElementById('playerChannels');
          if (panel) panel.classList.remove('is-instant-close');
        }
      }
      updateSoon();
    }
  }

  function init() {
    slot = document.getElementById('playerSlot');
    player = document.getElementById('playerSection');
    wrap = document.getElementById('playerWrap');
    toPlayerBtn = document.getElementById('toPlayerBtn');
    miniExpandBtn = document.getElementById('miniExpandBtn');
    miniCloseBtn = document.getElementById('miniCloseBtn');

    if (!player || !slot) return;

    if (toPlayerBtn) toPlayerBtn.addEventListener('click', function () { scrollToPlayer(); });
    if (miniExpandBtn) miniExpandBtn.addEventListener('click', function () { scrollToPlayer(); });
    if (miniCloseBtn) {
      miniCloseBtn.addEventListener('click', function () {
        dismissed = true;
        setMini(false);
        updateSoon();
      });
    }

    // Скролл обрабатываем синхронно: в некоторых встраиваемых браузерах
    // requestAnimationFrame может задерживаться, и мини-плеер «не возвращается».
    window.addEventListener('scroll', function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      update();
    }, { passive: true });
    window.addEventListener('resize', updateSoon);
    window.addEventListener('dev4rev:playerstate', function (e) {
      if (e.detail && e.detail.loaded === false) {
        dismissed = false;
        setMini(false);
      }
      updateSoon();
    });
    window.addEventListener('dev4rev:playlistchange', updateSoon);
    window.addEventListener('dev4rev:fullscreenchange', function (e) {
      suspendForFullscreen(!!(e.detail && e.detail.active));
    });

    updateSoon();
  }

  window.dev4revMiniPlayer = {
    collapse: function () { setMini(true); },
    expand: function (immediate) { scrollToPlayer(immediate); },
    isActive: function () { return miniActive && !miniSuspended; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

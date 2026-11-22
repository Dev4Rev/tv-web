(function () {
  'use strict';

  // Живая подсветка вокруг плеера: цвета берутся из текущего кадра видео,
  // а не только из палитры подборки. Работает для CORS-доступных потоков
  // (в том числе HLS через hls.js/MSE). Если поток «загрязняет» canvas —
  // остаётся палитра подборки, воспроизведение при этом не ломается.
  var root = document.documentElement;
  var video = null;
  var ambient = null;
  var canvas = null;
  var ctx = null;
  var timer = 0;
  var TICK = 110;   // ~9 кадров в секунду — достаточно и не греет CPU
  var BLEND = 0.16; // сглаживание, чтобы цвет не дёргался
  var cur1 = null;
  var cur2 = null;
  var tainted = false;
  var palette = { accent: '#ff4d6d', accent2: '#7c5cff' };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function init() {
    video = document.getElementById('video');
    ambient = document.getElementById('cinemaAmbient');
    if (!video || !ambient) return;

    canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 9;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    window.addEventListener('dev4rev:palettechange', function (e) {
      if (e.detail && e.detail.accent) palette.accent = e.detail.accent;
      if (e.detail && e.detail.accent2) palette.accent2 = e.detail.accent2;
      // Пока нет кадра — подсветка должна сразу принять цвета новой подборки.
      if (!cur1) applyColors(palette.accent, palette.accent2);
    });

    ['loadeddata', 'play', 'playing', 'seeked'].forEach(function (name) {
      video.addEventListener(name, activate);
    });
    video.addEventListener('loadstart', function () {
      // Новый поток может быть с нормальными CORS-заголовками.
      tainted = false;
      cur1 = cur2 = null;
      applyColors(palette.accent, palette.accent2);
    });
    window.addEventListener('dev4rev:channelchange', function () {
      tainted = false;
      cur1 = cur2 = null;
      applyColors(palette.accent, palette.accent2);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.clearInterval(timer);
        timer = 0;
      } else {
        activate();
      }
    });
    window.addEventListener('pagehide', function () {
      window.clearInterval(timer);
      timer = 0;
    });

    // Подсветка видна сразу после загрузки плеера, ещё до первого кадра.
    activate();
  }

  function applyColors(c1, c2) {
    if (!ambient) return;
    ambient.style.setProperty('--glow-1', c1);
    ambient.style.setProperty('--glow-2', c2);
    root.style.setProperty('--glow-1', c1);
    root.style.setProperty('--glow-2', c2);
  }

  function activate() {
    if (!ambient || document.hidden) return;
    if (!ambient.classList.contains('is-live')) ambient.classList.add('is-live');
    // Не requestAnimationFrame: во встраиваемых/TV-браузерах он может идти с
    // большой задержкой, из-за чего живая подсветка «замирала».
    if (!timer) timer = window.setInterval(frame, TICK);
  }

  // Средний цвет области кадра. Серые и почти чёрные пиксели отбрасываем:
  // они не несут оттенка и «размывают» подсветку в грязно-белый.
  function region(data, x0, y0, x1, y1) {
    var r = 0, g = 0, b = 0, n = 0;
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var i = (y * canvas.width + x) * 4;
        var R = data[i], G = data[i + 1], B = data[i + 2];
        var max = Math.max(R, G, B);
        var min = Math.min(R, G, B);
        if (max < 24) continue;
        if ((max - min) / max < 0.10) continue;
        r += R; g += G; b += B; n++;
      }
    }
    return n ? [r / n, g / n, b / n] : null;
  }

  function vivid(rgb) {
    if (!rgb) return null;
    var r = rgb[0], g = rgb[1], b = rgb[2];
    var avg = (r + g + b) / 3;
    var f = 1.45;
    r = clamp(avg + (r - avg) * f, 0, 255);
    g = clamp(avg + (g - avg) * f, 0, 255);
    b = clamp(avg + (b - avg) * f, 0, 255);
    var m = Math.max(r, g, b);
    if (m > 0) {
      var k = Math.min(1.75, 190 / m);
      r *= k; g *= k; b *= k;
    }
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
  }

  function blend(prev, next) {
    if (!prev) return next.slice();
    return [
      prev[0] + (next[0] - prev[0]) * BLEND,
      prev[1] + (next[1] - prev[1]) * BLEND,
      prev[2] + (next[2] - prev[2]) * BLEND
    ];
  }

  function css(rgb) {
    return 'rgb(' + Math.round(rgb[0]) + ' ' + Math.round(rgb[1]) + ' ' +
      Math.round(rgb[2]) + ')';
  }

  function frame() {
    if (document.hidden) return;
    // Не останавливаем цикл на паузе/буферизации: у видео всё ещё есть кадр,
    // и подсветка должна сохранять его цвет, а не мигать палитрой подборки.
    if (tainted || !video || video.readyState < 2 || !video.videoWidth) return;

    var data;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (e) {
      tainted = true; // без CORS считаем по палитре, плеер не трогаем
      return;
    }

    var W = canvas.width, H = canvas.height;
    var half = Math.floor(W / 2);
    var left = vivid(region(data, 0, 0, half, H));
    var right = vivid(region(data, half, 0, W, H));
    if (!left && !right) return;
    if (!left) left = right;
    if (!right) right = left;

    cur1 = blend(cur1, left);
    cur2 = blend(cur2, right);
    var c1 = css(cur1);
    var c2 = css(cur2);

    // Общий фон страницы в cinema-режиме тоже использует эти переменные.
    applyColors(c1, c2);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

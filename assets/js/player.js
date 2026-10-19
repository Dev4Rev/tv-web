(function () {
  'use strict';
  function log(section, e) { console.error('[dev4rev/' + section + ']', e); }

  var video = document.getElementById('video');
  var wrap = document.getElementById('playerWrap');
  var hls = null;
  var currentIdx = -1;
  var onFatal = null;

  // Токен сессии: каждое play() увеличивает его.
  // Все async колбэки проверяют актуальность токена, чтобы не влиять на чужой поток.
  var sessionToken = 0;
  var watchdogTimer = null;

  function nextToken() {
    sessionToken += 1;
    return sessionToken;
  }
  function isActual(token) {
    return token === sessionToken;
  }

  function isAbort(err) {
    if (!err) return false;
    var name = err.name || '';
    var msg = err.message || '';
    return name === 'AbortError' || msg.indexOf('interrupted') !== -1;
  }

  // ─── Нормализация URL ───────────────────────────────────
  // Если снаружи определена dev4revNormalizeUrl — используем её.
  // Иначе — безопасный fallback (без него play() падал с TypeError).
  function normalizeUrl(url) {
    var s = String(url == null ? '' : url).trim();
    if (!s) return s;

    if (typeof window.dev4revNormalizeUrl === 'function') {
      try {
        var r = window.dev4revNormalizeUrl(s);
        if (typeof r === 'string' && r) return r;
      } catch (e) {
        log('normalize-url', e);
      }
    }

    // Fallback: протокол-относительные ссылки → https
    if (s.indexOf('//') === 0) return 'https:' + s;
    return s;
  }

  function destroy() {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    if (hls) {
      try { hls.stopLoad(); } catch (e) {}
      try { hls.detachMedia(); } catch (e) {}
      try { hls.destroy(); } catch (e) {}
      hls = null;
    }
    if (video) {
      try { video.pause(); } catch (e) {}
      try { video.removeAttribute('src'); } catch (e) {}
      try { video.load(); } catch (e) {}
    }
  }

  function showOverlay(text) {
    var overlay = document.getElementById('playerOverlay');
    if (!overlay) return;
    var t = overlay.querySelector('.player__overlay-text');
    if (t) t.textContent = text;
    overlay.classList.remove('is-hidden');
  }

  function hideOverlay() {
    var overlay = document.getElementById('playerOverlay');
    if (overlay) overlay.classList.add('is-hidden');
  }

  function failCurrent(reason, token) {
    if (!isActual(token)) return;
    showOverlay(reason);
    if (typeof onFatal === 'function') onFatal(currentIdx, reason);
  }

  // ─── HLS check ─────────────────────────────────────────
  function waitForHls(timeout) {
    return new Promise(function (resolve) {
      if (window.Hls) { resolve(true); return; }
      var start = Date.now();
      var iv = setInterval(function () {
        if (window.Hls) { clearInterval(iv); resolve(true); return; }
        if (Date.now() - start > timeout) { clearInterval(iv); resolve(false); }
      }, 100);
    });
  }

  // ─── Play ──────────────────────────────────────────────
  function play(url, idx) {
    if (!video) return;

    var token = nextToken();
    destroy();
    currentIdx = (typeof idx === 'number') ? idx : -1;

    url = normalizeUrl(url);

    if (!url) {
      showOverlay('Некорректная ссылка на поток.');
      failCurrent('Некорректная ссылка на поток.', token);
      return;
    }

    var isHls = /\.m3u8(\?|#|$)/i.test(url);

    showOverlay('Загружаем канал…');

    // Watchdog: если за 15 секунд не началось воспроизведение — ошибка
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function () {
      if (!isActual(token)) return;
      if (!video || video.paused || video.readyState < 2) {
        failCurrent('Поток не отвечает. Переходим к следующему каналу…', token);
      }
    }, 15000);

    if (isHls) {
      waitForHls(3000).then(function (available) {
        if (!isActual(token)) return;

        if (!available) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            playNative(url, token);
          } else {
            failCurrent('Не удалось загрузить плеер. Проверьте соединение.', token);
          }
          return;
        }

        if (window.Hls.isSupported()) {
          playHls(url, token);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          playNative(url, token);
        } else {
          failCurrent('Браузер не поддерживает воспроизведение HLS.', token);
        }
      });
    } else {
      playNative(url, token);
    }
  }

  function playHls(url, token) {
    hls = new window.Hls({
      lowLatencyMode: false,
      enableWorker: true,
      manifestLoadingTimeOut: 6000,
      manifestLoadingMaxRetry: 1,
      manifestLoadingRetryDelay: 500,
      levelLoadingTimeOut: 6000,
      levelLoadingMaxRetry: 1,
      fragLoadingTimeOut: 12000,
      fragLoadingMaxRetry: 1,
      startLevel: -1,
      capLevelToPlayerSize: true,
      maxBufferLength: 30
    });

    hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
      if (!isActual(token)) return;
      video.play().catch(function (err) {
        if (!isAbort(err) && isActual(token)) {
          log('hls-autoplay', err);
          showOverlay('Нажмите Play, чтобы начать воспроизведение');
          if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
        }
      });
    });

    hls.on(window.Hls.Events.ERROR, function (event, data) {
      if (!isActual(token)) return;
      if (!data.fatal) return;

      try { hls.stopLoad(); } catch (e) {}
      try { hls.detachMedia(); } catch (e) {}
      try { hls.destroy(); } catch (e) {}
      hls = null;

      var reason = 'Не удалось воспроизвести канал.';
      if (data.type === 'networkError') {
        if (data.details === 'manifestLoadError' || data.details === 'manifestLoadTimeOut') {
          reason = 'Поток не отвечает. Возможно, канал больше не работает.';
        } else if (data.details === 'levelLoadError' || data.details === 'manifestParsingError') {
          reason = 'Поток недоступен.';
        } else {
          reason = 'Ошибка сети при загрузке потока.';
        }
      } else if (data.type === 'mediaError') {
        reason = 'Ошибка воспроизведения. Попробуйте другой канал.';
      } else if (data.type === 'otherError') {
        reason = 'Поток в неподдерживаемом формате.';
      }

      failCurrent(reason + ' Переходим к следующему…', token);
    });

    try {
      hls.loadSource(url);
      hls.attachMedia(video);
    } catch (e) {
      log('hls-attach', e);
      failCurrent('Не удалось подключить поток.', token);
    }
  }

  function playNative(url, token) {
    try {
      video.src = url;
    } catch (e) {
      log('native-src', e);
      failCurrent('Не удалось загрузить поток.', token);
      return;
    }
    video.play().catch(function (err) {
      if (!isAbort(err) && isActual(token)) {
        log('native-autoplay', err);
        showOverlay('Нажмите Play, чтобы начать воспроизведение');
        if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
      }
    });
  }

  // ─── Video events ──────────────────────────────────────
  if (video) {
    video.addEventListener('playing', function () {
      hideOverlay();
      if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
    });

    video.addEventListener('error', function () {
      if (!video.src && !hls) return;
      showOverlay('Ошибка воспроизведения. Попробуйте другой канал.');
    });

    // Если видео зависло и не буферизуется — пингуем hls
    var stallTimer = null;
    video.addEventListener('waiting', function () {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(function () {
        if (!video.paused && video.readyState < 3 && hls) {
          try { hls.startLoad(); } catch (e) {}
        }
      }, 5000);
    });
    video.addEventListener('playing', function () {
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    });
  }

  // ─── Fullscreen: если браузер развернул <video> вместо wrap ────
  function handleFullscreenChange() {
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;

    if (fsEl && fsEl === video && wrap) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
      if (exit) {
        var p = exit.call(document);
        if (p && p.catch) p.catch(function () {});
      }
      setTimeout(function () {
        var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.webkitRequestFullScreen;
        if (req) {
          var r = req.call(wrap);
          if (r && r.catch) r.catch(function () {});
        }
      }, 50);
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  // ─── Public API ────────────────────────────────────────
  window.dev4revPlayer = {
    play: play,
    destroy: destroy,
    showOverlay: showOverlay,
    hideOverlay: hideOverlay,
    onFatal: function (fn) { onFatal = fn; },
    getCurrentIndex: function () { return currentIdx; }
  };
})();
(function () {
  'use strict';
  function log(section, e) { console.error('[dev4rev/' + section + ']', e); }

  var video = document.getElementById('video');
  var wrap = document.getElementById('playerWrap');
  var hls = null;
  var dash = null;
  var mpegts = null;
  var currentIdx = -1;
  var currentFormat = 'unknown';
  var onFatal = null;

  // Библиотеки подключаются только при реальной необходимости.
  var CDN = {
    dash: 'https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js',
    ts: 'https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js'
  };

  // Токен сессии: каждое play() увеличивает его.
  var sessionToken = 0;
  var watchdogTimer = null;

  // Качество
  var qualityLevels = [];
  var currentQuality = -1;

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

  function normalizeUrl(url) {
    var s = String(url == null ? '' : url).trim();
    if (!s) return s;

    if (typeof window.dev4revNormalizeUrl === 'function') {
      try {
        var r = window.dev4revNormalizeUrl(s);
        if (typeof r === 'string' && r) return r;
      } catch (e) { log('normalize-url', e); }
    }

    if (s.indexOf('//') === 0) return 'https:' + s;
    return s;
  }

  function showControls() {
    if (window.dev4revControls && window.dev4revControls.show) {
      window.dev4revControls.show();
    }
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
    if (dash) {
      try { dash.reset(); } catch (e) {}
      try { dash.destroy(); } catch (e) {}
      dash = null;
    }
    if (mpegts) {
      try { mpegts.destroy(); } catch (e) {}
      mpegts = null;
    }
    if (video) {
      try { video.pause(); } catch (e) {}
      try { video.removeAttribute('src'); } catch (e) {}
      try { video.load(); } catch (e) {}
    }
    qualityLevels = [];
    currentQuality = -1;
    currentFormat = 'unknown';
    resetVideoAspect();
    updateQualityUI();
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

  // ─── Форматы потоков ────────────────────────────────────
  // Расширение может быть спрятано за параметрами (?token=…), поэтому
  // ищем расширение как «слово», после которого нет латинской цифры/буквы.
  var RE_HLS = /\.m3u8(?![a-z0-9])/i;
  var RE_DASH = /\.mpd(?![a-z0-9])/i;
  var RE_TS = /\.ts(?![a-z0-9])/i;
  var RE_NATIVE = /\.(?:mp4|m4v|webm|ogv|ogg|mov)(?![a-z0-9])/i;

  function detectFormat(url) {
    if (RE_HLS.test(url)) return 'hls';
    if (RE_DASH.test(url)) return 'dash';
    if (RE_TS.test(url)) return 'ts';
    if (RE_NATIVE.test(url)) return 'native';
    return 'unknown';
  }

  // Ссылки без расширения часто ведут на тот же HLS-манифест.
  // Читаем только первый чанк и сразу закрываем соединение.
  function sniffFormat(url) {
    if (!window.fetch) return Promise.resolve('unknown');
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    var opts = { cache: 'no-store' };
    if (ctrl) opts.signal = ctrl.signal;

    return fetch(url, opts).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) return 'unknown';
      if (!r.body || !r.body.getReader) {
        return r.text().then(function (t) { return /^\s*#EXTM3U/.test(t) ? 'hls' : 'unknown'; });
      }
      var reader = r.body.getReader();
      return reader.read().then(function (res) {
        try { reader.cancel(); } catch (e) {}
        var text = '';
        try { text = new TextDecoder('utf-8').decode(res.value || new Uint8Array(0)); } catch (e) {}
        return /^\s*#EXTM3U/.test(text) ? 'hls' : 'unknown';
      });
    }).catch(function () {
      clearTimeout(timer);
      return 'unknown';
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Не удалось загрузить библиотеку: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureLibrary(name, token) {
    if (name === 'dash' && window.dashjs) return Promise.resolve(true);
    if (name === 'ts' && window.mpegts) return Promise.resolve(true);
    return loadScript(CDN[name]).then(function () {
      if (!isActual(token)) return false;
      var ok = (name === 'dash') ? !!window.dashjs : !!window.mpegts;
      if (!ok) throw new Error('Библиотека не инициализировалась');
      return true;
    });
  }

  // ─── Соотношение сторон ─────────────────────────────────
  function resetVideoAspect() {
    if (!wrap) return;
    wrap.classList.remove('has-video-ratio');
    wrap.style.removeProperty('--video-ratio');
  }

  function applyVideoAspect() {
    if (!video || !wrap) return;
    var w = video.videoWidth;
    var h = video.videoHeight;
    if (!w || !h || !isFinite(w) || !isFinite(h)) return;

    // Ограничиваем диапазон, чтобы вертикальный или сверхширокий поток
    // не растягивал страницу. Сам кадр при этом НЕ обрезается —
    // object-fit: contain оставляет поля, но без искажений.
    var ratio = w / h;
    if (ratio < 0.75) ratio = 0.75;
    if (ratio > 2.4) ratio = 2.4;
    var next = ratio.toFixed(4);
    if (wrap.classList.contains('has-video-ratio') &&
        wrap.style.getPropertyValue('--video-ratio').trim() === next) return;

    wrap.style.setProperty('--video-ratio', next);
    wrap.classList.add('has-video-ratio');
  }

  // ─── Качество ──────────────────────────────────────────
  function buildQualityLevels() {
    if (!hls || !hls.levels) return [];
    var levels = [];
    hls.levels.forEach(function (lvl, i) {
      if (!lvl || !lvl.height) return;
      levels.push({
        index: i,
        height: lvl.height,
        bitrate: lvl.bitrate || 0,
        name: lvl.height + 'p'
      });
    });
    levels.sort(function (a, b) { return b.height - a.height; });
    levels.forEach(function (l, i) { l.display = i; });
    return levels;
  }

  function updateQualityUI() {
    var btn = document.getElementById('qualityBtn');
    var menu = document.getElementById('qualityMenu');
    var list = document.getElementById('qualityList');
    var label = document.getElementById('qualityLabel');
    if (!btn || !menu || !list) return;

    // Показываем кнопку только если hls активен
    if (!hls) {
      btn.hidden = true;
      menu.hidden = true;
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.disabled = false;
      if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
      return;
    }

    // Если уровней < 2 — скрываем кнопку (нет выбора)
    if (qualityLevels.length < 2) {
      btn.hidden = true;
      menu.hidden = true;
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.disabled = false;
      if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
      return;
    }

    btn.hidden = false;
    menu.hidden = false;

    btn.disabled = false;
    btn.title = 'Качество';

    if (label) {
      if (currentQuality === -1) {
        label.textContent = 'auto';
      } else {
        var active = null;
        for (var i = 0; i < qualityLevels.length; i++) {
          if (qualityLevels[i].index === currentQuality) { active = qualityLevels[i]; break; }
        }
        label.textContent = active ? active.name : 'auto';
      }
    }

    var html = '<li><button type="button" class="player__quality-item' +
      (currentQuality === -1 ? ' is-active' : '') +
      '" data-q="auto" role="option">auto</button></li>';
    qualityLevels.forEach(function (q) {
      html += '<li><button type="button" class="player__quality-item' +
        (currentQuality === q.index ? ' is-active' : '') +
        '" data-q="' + q.index + '" role="option">' +
        q.name +
        (q.bitrate ? '<small>' + Math.round(q.bitrate / 1000) + ' kbps</small>' : '') +
        '</button></li>';
    });
    list.innerHTML = html;

    // Прокрутить к активному пункту — при малой высоте меню
    // выбранный уровень должен быть виден сразу
    var activeItem = list.querySelector('.player__quality-item.is-active');
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      try { activeItem.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }

  function setQuality(levelIndex) {
    if (!hls) return;
    try {
      if (levelIndex === -1) {
        hls.currentLevel = -1;
        currentQuality = -1;
      } else {
        hls.nextLevel = levelIndex;
        currentQuality = levelIndex;
      }
    } catch (e) {
      log('set-quality', e);
    }
    updateQualityUI();
  }

  function closeQualityMenu() {
    var menu = document.getElementById('qualityMenu');
    var btn = document.getElementById('qualityBtn');
    if (menu) menu.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
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

    showOverlay('Загружаем канал…');

    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function () {
      if (!isActual(token)) return;
      if (!video || video.paused || video.readyState < 2) {
        failCurrent('Поток не отвечает. Переходим к следующему каналу…', token);
      }
    }, 15000);

    var format = detectFormat(url);
    if (format === 'unknown') {
      sniffFormat(url).then(function (sniffed) {
        if (!isActual(token)) return;
        route(sniffed === 'hls' ? 'hls' : 'native', url, token);
      });
      return;
    }
    route(format, url, token);
  }

  function route(format, url, token) {
    if (!isActual(token)) return;
    currentFormat = format;

    if (format === 'hls') {
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
      return;
    }

    if (format === 'dash') {
      ensureLibrary('dash', token).then(function (ok) {
        if (!isActual(token) || !ok) return;
        playDash(url, token);
      }).catch(function (e) {
        if (!isActual(token)) return;
        log('dash-lib', e);
        failCurrent('Не удалось загрузить поддержку DASH. Проверьте соединение.', token);
      });
      return;
    }

    if (format === 'ts') {
      ensureLibrary('ts', token).then(function (ok) {
        if (!isActual(token) || !ok) return;
        playTs(url, token);
      }).catch(function (e) {
        if (!isActual(token)) return;
        log('mpegts-lib', e);
        failCurrent('Не удалось загрузить поддержку MPEG-TS. Проверьте соединение.', token);
      });
      return;
    }

    playNative(url, token);
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
      capLevelToPlayerSize: false,
      maxBufferLength: 30
    });

    hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
      if (!isActual(token)) return;

      qualityLevels = buildQualityLevels();
      updateQualityUI();
      if (qualityLevels.length) {
        console.log("[dev4rev/quality] levels:", qualityLevels.length, qualityLevels.map(function (l) { return l.name; }).join(", "));
      } else {
        console.log("[dev4rev/quality] уровней нет — кнопка качества не появится");
      }

      video.play().catch(function (err) {
        if (!isAbort(err) && isActual(token)) {
          log('hls-autoplay', err);
          showOverlay('Нажмите Play, чтобы начать воспроизведение');
          if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
        }
      });
    });

    hls.on(window.Hls.Events.LEVEL_SWITCHED, function (event, data) {
      if (!isActual(token)) return;
      if (currentQuality === -1 && qualityLevels.length >= 2) {
        var lvl = hls.levels && hls.levels[data.level];
        var label = document.getElementById('qualityLabel');
        if (label && lvl && lvl.height) {
          label.textContent = lvl.height + 'p';
        } else if (label) {
          label.textContent = 'auto';
        }
      }
    });

    hls.on(window.Hls.Events.ERROR, function (event, data) {
      if (!isActual(token)) return;
      if (!data.fatal) return;

      try { hls.stopLoad(); } catch (e) {}
      try { hls.detachMedia(); } catch (e) {}
      try { hls.destroy(); } catch (e) {}
      hls = null;

      qualityLevels = [];
      currentQuality = -1;
      updateQualityUI();

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

  function playDash(url, token) {
    try {
      dash = window.dashjs.MediaPlayer().create();

      var events = window.dashjs.MediaPlayer.events;
      if (events && events.ERROR) {
        dash.on(events.ERROR, function (e) {
          if (!isActual(token)) return;
          log('dash-error', e);
          failCurrent('Ошибка DASH-потока. Переходим к следующему…', token);
        });
      }

      dash.initialize(video, url, true);
      video.play().catch(function (err) {
        if (!isAbort(err) && isActual(token)) {
          log('dash-autoplay', err);
          showOverlay('Нажмите Play, чтобы начать воспроизведение');
          if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
        }
      });
    } catch (e) {
      log('dash-init', e);
      failCurrent('Не удалось подключить DASH-поток.', token);
    }
  }

  function playTs(url, token) {
    try {
      mpegts = window.mpegts.createPlayer({
        type: 'mpegts',
        url: url,
        isLive: true,
        lazilyLoad: false
      });

      var events = window.mpegts.Events;
      // У mpegts.js нет единого ERROR — ошибки приходят как IO_ERROR / DEMUX_ERROR.
      [events && events.IO_ERROR, events && events.DEMUX_ERROR].forEach(function (ev) {
        if (!ev) return;
        mpegts.on(ev, function (detail) {
          if (!isActual(token)) return;
          log('mpegts-error', detail);
          failCurrent('Ошибка MPEG-TS потока. Переходим к следующему…', token);
        });
      });

      mpegts.attachMediaElement(video);
      mpegts.load();
      video.play().catch(function (err) {
        if (!isAbort(err) && isActual(token)) {
          log('mpegts-autoplay', err);
          showOverlay('Нажмите Play, чтобы начать воспроизведение');
          if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
        }
      });
    } catch (e) {
      log('mpegts-init', e);
      failCurrent('Не удалось подключить MPEG-TS поток.', token);
    }
  }

  // ─── Video events ──────────────────────────────────────
  if (video) {
    video.addEventListener('playing', function () {
      hideOverlay();
      if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
    });

    video.addEventListener('error', function () {
      // У MSE-плееров (hls.js / dash.js / mpegts.js) video.src пуст —
      // их фатальные ошибки обрабатываются самими библиотеками.
      if (!video.src || !video.error) return;
      var code = video.error.code;
      var reason = (code === 4)
        ? 'Неподдерживаемый формат потока. Переходим к следующему…'
        : 'Ошибка воспроизведения. Переходим к следующему…';
      failCurrent(reason, sessionToken);
    });

    // Реальное соотношение сторон становится известно после метаданных.
    video.addEventListener('loadedmetadata', applyVideoAspect);
    video.addEventListener('loadeddata', applyVideoAspect);
    video.addEventListener('resize', applyVideoAspect);

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

  // ─── iOS fullscreen (video.webkitEnterFullscreen) ─────
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#fullscreenBtn');
      if (!btn) return;
      // Не делаем preventDefault / stopPropagation —
      // пусть controls.js тоже попробует (fallback)
      if (video && typeof video.webkitEnterFullscreen === 'function') {
        try { video.webkitEnterFullscreen(); } catch (err) { log('ios-fs', err); }
      }
    }, true);
  }

  // ─── Свайпы по видео (мобильные) ──────────────────────
  var touchStartX = null;
  var touchStartY = null;
  var touchStartTime = 0;

  if (wrap) {
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      if (e.target.closest('.player__quality, .player__channels')) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    wrap.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      var dt = Date.now() - touchStartTime;
      touchStartX = null;
      touchStartY = null;

      if (dt > 600) return;

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        var btn = document.getElementById(dx > 0 ? 'videoPrevBtn' : 'videoNextBtn');
        if (btn) {
          btn.click();
          showControls();
        }
      }
    }, { passive: true });
  }

  // ─── Кнопка качества и меню ───────────────────────────
  var qualityBtn = document.getElementById('qualityBtn');
  var qualityMenu = document.getElementById('qualityMenu');

  if (qualityBtn && qualityMenu) {
    qualityBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      showControls();
      var willOpen = !qualityMenu.classList.contains('is-open');
      if (willOpen && window.dev4revClosePlayerDialogs) window.dev4revClosePlayerDialogs('quality');
      var open = qualityMenu.classList.toggle('is-open');
      qualityBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && window.dev4revEnsurePlayerDialogVisible) window.dev4revEnsurePlayerDialogVisible();
      if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
    });

    qualityMenu.addEventListener('click', function (e) {
      var item = e.target.closest('.player__quality-item');
      if (!item) return;
      e.stopPropagation();
      var q = item.dataset.q;
      if (q === 'auto') {
        setQuality(-1);
      } else {
        setQuality(parseInt(q, 10));
      }
      closeQualityMenu();
      showControls();
    });

    document.addEventListener('click', function (e) {
      if (qualityMenu.contains(e.target) || qualityBtn.contains(e.target)) return;
      closeQualityMenu();
    });
  }

  // ─── Public API ────────────────────────────────────────
  window.dev4revPlayer = {
    play: play,
    destroy: destroy,
    showOverlay: showOverlay,
    hideOverlay: hideOverlay,
    onFatal: function (fn) { onFatal = fn; },
    getCurrentIndex: function () { return currentIdx; },
    getFormat: function () { return currentFormat; },
    getVideoSize: function () {
      return { width: video ? video.videoWidth : 0, height: video ? video.videoHeight : 0 };
    },
    getQualityLevels: function () { return qualityLevels.slice(); },
    setQuality: setQuality
  };

  // Поиск в панели каналов (fullscreen)
  (function () {
    var searchEl = document.getElementById('playerChannelSearch');
    var listEl = document.getElementById('playerChannelsList');
    if (!searchEl || !listEl) return;

    function filterChannels() {
      var q = searchEl.value.trim().toLowerCase();
      var items = listEl.querySelectorAll('.player__channel');
      var visible = 0;
      for (var i = 0; i < items.length; i++) {
        var li = items[i];
        var text = (li.textContent || '').toLowerCase();
        var show = !q || text.indexOf(q) !== -1;
        li.style.display = show ? '' : 'none';
        if (show) visible++;
      }
      var emptyEl = listEl.querySelector('.player__channels-empty');
      if (visible === 0 && q) {
        if (!emptyEl) {
          emptyEl = document.createElement('li');
          emptyEl.className = 'player__channels-empty';
          emptyEl.textContent = 'Ничего не найдено';
          listEl.appendChild(emptyEl);
        }
        emptyEl.style.display = '';
      } else if (emptyEl) {
        emptyEl.style.display = 'none';
      }
    }

    searchEl.addEventListener('input', filterChannels);
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchEl.value = '';
        filterChannels();
      }
    });

    var closeBtn = document.getElementById('channelsCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        searchEl.value = '';
        filterChannels();
      });
    }
  })();

})();
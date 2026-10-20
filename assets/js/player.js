(function () {
  'use strict';
  function log(section, e) { console.error('[dev4rev/' + section + ']', e); }

  var video = document.getElementById('video');
  var wrap = document.getElementById('playerWrap');
  var hls = null;
  var currentIdx = -1;
  var onFatal = null;

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
    if (video) {
      try { video.pause(); } catch (e) {}
      try { video.removeAttribute('src'); } catch (e) {}
      try { video.load(); } catch (e) {}
    }
    qualityLevels = [];
    currentQuality = -1;
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
      return;
    }

    // Если уровней < 2 — скрываем кнопку (нет выбора)
    if (qualityLevels.length < 2) {
      btn.hidden = true;
      menu.hidden = true;
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.disabled = false;
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
      var open = qualityMenu.classList.toggle('is-open');
      qualityBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
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
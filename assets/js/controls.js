(function () {
  'use strict';

  function log(section, e) {
    console.error('[dev4rev/' + section + ']', e);
  }

  var HIDE_DELAY = 5000;
  var VOLUME_KEY = 'dev4rev.tv.volume';

  var wrap = null;
  var video = null;
  var controls = null;
  var bigPlay = null;
  var playPauseBtn = null;
  var seekBar = null;
  var volumeBar = null;
  var currentTimeEl = null;
  var durationEl = null;
  var muteBtn = null;
  var fullscreenBtn = null;
  var hideTimer = null;

  var seeking = false;
  var volumeSaveTimer = null;

  function fmtTime(sec) {
    if (!sec || !isFinite(sec) || sec < 0) return '0:00';
    var s = Math.floor(sec % 60);
    var m = Math.floor(sec / 60) % 60;
    var h = Math.floor(sec / 3600);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function isLive() {
    if (!video) return false;
    return !isFinite(video.duration) || video.duration === Infinity || video.duration === 0;
  }

  function hasMedia() {
    if (!video) return false;
    if (video.src) return true;
    if (video.currentSrc) return true;
    return false;
  }

  // ─── Volume persistence ─────────────────────────────────
  function loadVolumePref() {
    try {
      var raw = localStorage.getItem(VOLUME_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        var vol = typeof data.volume === 'number' ? Math.max(0, Math.min(1, data.volume)) : 1;
        return { volume: vol, muted: !!data.muted };
      }
    } catch (e) {}
    return null;
  }

  function saveVolumePref() {
    if (!video) return;
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({
        volume: video.volume,
        muted: video.muted
      }));
    } catch (e) {}
  }

  function scheduleVolumeSave() {
    if (volumeSaveTimer) clearTimeout(volumeSaveTimer);
    volumeSaveTimer = setTimeout(saveVolumePref, 200);
  }

  function updatePlayState() {
    if (!wrap || !video) return;
    var playing = !video.paused && !video.ended;
    wrap.classList.toggle('is-playing', playing);
    if (bigPlay) bigPlay.hidden = playing;
  }

  function updateMuteState() {
    if (!wrap || !video) return;
    wrap.classList.toggle('is-muted', video.muted || video.volume === 0);
  }

  function updateSeek() {
    if (!seekBar || !video) return;

    if (video.readyState < 1) {
      seekBar.disabled = true;
      seekBar.style.opacity = '0.4';
      seekBar.style.cursor = 'default';
      if (currentTimeEl) currentTimeEl.textContent = '0:00';
      if (durationEl) durationEl.textContent = '0:00';
      return;
    }

    if (isLive()) {
      seekBar.disabled = true;
      seekBar.style.opacity = '0.4';
      seekBar.style.cursor = 'default';
      if (currentTimeEl) currentTimeEl.textContent = 'live';
      if (durationEl) durationEl.textContent = '';
      return;
    }

    seekBar.disabled = false;
    seekBar.style.opacity = '';
    seekBar.style.cursor = '';

    var ratio = video.currentTime / video.duration;
    if (!seeking && !seekBar.matches(':active')) {
      seekBar.value = String(Math.round(ratio * 1000));
    }
    seekBar.style.setProperty('--progress', (ratio * 100).toFixed(2) + '%');
    if (currentTimeEl) currentTimeEl.textContent = fmtTime(video.currentTime);
    if (durationEl) durationEl.textContent = fmtTime(video.duration);
  }

  function updateVolume() {
    if (!volumeBar || !video) return;
    var val = video.muted ? 0 : Math.round(video.volume * 100);
    if (!volumeBar.matches(':active')) volumeBar.value = String(val);
    volumeBar.style.setProperty('--progress', val + '%');
    updateMuteState();
  }

  // ─── Ключевое: пустое видео отдаём main.js ──────────────
  function togglePlay() {
    if (!video) return;

    if (!hasMedia()) {
      window.dispatchEvent(new CustomEvent('dev4rev:request-play'));
      return;
    }

    if (video.paused || video.ended) {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      video.pause();
    }
  }

  function showControls() {
    if (!wrap) return;
    wrap.classList.remove('is-controls-hidden');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (isFullscreen()) wrap.classList.add('is-controls-hidden');
    }, HIDE_DELAY);
  }

  function isFullscreen() {
    if (!wrap) return false;
    return document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap;
  }

  function toggleFullscreen() {
    if (!wrap) return;
    if (!isFullscreen()) {
      var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.webkitRequestFullScreen;
      if (req) { var p = req.call(wrap); if (p && p.catch) p.catch(function () {}); }
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
      if (exit) { var p2 = exit.call(document); if (p2 && p2.catch) p2.catch(function () {}); }
    }
  }

  function bind() {
    if (!video) return;

    video.addEventListener('click', function () {
      togglePlay();
      showControls();
    });

    video.addEventListener('dblclick', function (e) {
      e.preventDefault();
      toggleFullscreen();
    });

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        showControls();
      });
    }

    if (bigPlay) {
      bigPlay.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        showControls();
      });
    }

    ['play', 'pause', 'ended'].forEach(function (ev) {
      video.addEventListener(ev, function () {
        updatePlayState();
        showControls();
      });
    });

    video.addEventListener('loadedmetadata', function () {
      updateSeek();
      updatePlayState();
    });

    video.addEventListener('durationchange', updateSeek);
    video.addEventListener('timeupdate', updateSeek);
    video.addEventListener('volumechange', function () {
      updateVolume();
      scheduleVolumeSave();
    });

    if (seekBar) {
      seekBar.addEventListener('input', function (e) {
        if (isLive() || video.readyState < 1 || !video.duration || !isFinite(video.duration)) return;
        var ratio = Number(e.target.value) / 1000;
        var t = video.duration * ratio;
        if (isFinite(t) && t >= 0) {
          try { video.currentTime = t; } catch (err) { log('seek', err); }
        }
        seekBar.style.setProperty('--progress', (ratio * 100).toFixed(2) + '%');
        if (currentTimeEl) currentTimeEl.textContent = fmtTime(video.currentTime);
      });

      seekBar.addEventListener('pointerdown', function () { seeking = true; showControls(); });
      seekBar.addEventListener('mousedown', function () { seeking = true; showControls(); });
      seekBar.addEventListener('touchstart', function () { seeking = true; showControls(); }, { passive: true });
      seekBar.addEventListener('pointerup', function () { seeking = false; });
      seekBar.addEventListener('mouseup', function () { seeking = false; });
      seekBar.addEventListener('touchend', function () { seeking = false; });
      seekBar.addEventListener('change', function () { seeking = false; });
    }

    if (volumeBar) {
      volumeBar.addEventListener('input', function (e) {
        var v = Number(e.target.value) / 100;
        video.volume = v;
        video.muted = v === 0;
        volumeBar.style.setProperty('--progress', e.target.value + '%');
        updateMuteState();
      });
      volumeBar.addEventListener('mousedown', function () { showControls(); });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        video.muted = !video.muted;
        updateVolume();
        showControls();
      });
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
      });
    }

    ['mousemove', 'mousedown', 'touchstart', 'touchmove'].forEach(function (ev) {
      wrap.addEventListener(ev, showControls, { passive: true });
    });

    document.addEventListener('keydown', function () {
      if (isFullscreen()) showControls();
    });

    document.addEventListener('fullscreenchange', function () {
      var fsEl = document.fullscreenElement;
      if (fsEl === video && wrap) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
        setTimeout(function () {
          var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
          if (req) { var p = req.call(wrap); if (p && p.catch) p.catch(function () {}); }
        }, 100);
        return;
      }
      if (fsEl === wrap) showControls();
      else {
        if (hideTimer) clearTimeout(hideTimer);
        wrap.classList.remove('is-controls-hidden');
      }
    });

    document.addEventListener('webkitfullscreenchange', function () {
      if (isFullscreen()) showControls();
      else {
        if (hideTimer) clearTimeout(hideTimer);
        wrap.classList.remove('is-controls-hidden');
      }
    });

    updatePlayState();
    updateVolume();
    updateSeek();
    showControls();
  }

  document.addEventListener('DOMContentLoaded', function () {
    wrap = document.getElementById('playerWrap');
    video = document.getElementById('video');
    controls = document.getElementById('videoControls');
    bigPlay = document.getElementById('bigPlayBtn');
    playPauseBtn = document.getElementById('playPauseBtn');
    seekBar = document.getElementById('seekBar');
    volumeBar = document.getElementById('volumeBar');
    currentTimeEl = document.getElementById('currentTime');
    durationEl = document.getElementById('duration');
    muteBtn = document.getElementById('muteBtn');
    fullscreenBtn = document.getElementById('fullscreenBtn');

    if (!wrap || !video) return;

    var volPref = loadVolumePref();
    if (volPref) {
      try {
        video.volume = volPref.volume;
        video.muted = volPref.muted;
      } catch (e) { log('apply-volume-pref', e); }
    }

    bind();

    window.dev4revControls = {
      show: showControls,
      isFullscreen: isFullscreen,
      toggleFullscreen: toggleFullscreen
    };
  });
})();
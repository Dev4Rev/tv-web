(function () {
  try {
    // Режим «Кинотеатр».
    var cinemaPref = 'off';
    try {
      if (localStorage.getItem('dev4rev.cinema') === 'on') cinemaPref = 'on';
    } catch (e) {}
    document.documentElement.dataset.cinema = cinemaPref;

    // ТВ-режим недоступен на мобильных (touch-only без hover, не SmartTV)
    var isMobile = false;
    try {
      isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    } catch (e) {}

    if (isMobile) {
      var uaM = navigator.userAgent || '';
      var isTvUAM = /SmartTV|Tizen|Web0S|WebOS|HbbTV|NETCAST|Viera|BRAVIA|Aquos|SmartHub|AndroidTV|GoogleTV|AppleTV|PhilipsTV|Hisense|Vestel|Roku/i.test(uaM);
      if (!isTvUAM) {
        document.documentElement.dataset.tvMode = 'off';
        try { localStorage.removeItem('dev4rev.tvMode'); } catch (e) {}
        return;
      }
    }

    var tvPref = localStorage.getItem('dev4rev.tvMode');
    if (tvPref === 'on' || tvPref === 'off') {
      document.documentElement.dataset.tvMode = tvPref;
    } else {
      var ua = navigator.userAgent || '';
      var isTvUA = /SmartTV|Tizen|Web0S|WebOS|HbbTV|NETCAST|Viera|BRAVIA|Aquos|SmartHub|AndroidTV|GoogleTV|AppleTV|PhilipsTV|Hisense|Vestel|Roku/i.test(ua);
      var isBigScreen = false;
      try {
        isBigScreen = window.screen && window.screen.width >= 1600 && window.screen.height >= 900;
      } catch (e) {}
      var isDesktopBig = !('ontouchstart' in window) && isBigScreen;
      document.documentElement.dataset.tvMode = (isTvUA || isDesktopBig) ? 'on' : 'off';
    }
  } catch (e) {}
})();

// Публичные ссылки на плейлисты всегда ведут на канонический хост сайта.
// Относительные пути и короткая форма tv.dev4rev.ru/... превращаются в
// https://tv.dev4rev.ru/{путь до плейлиста}.m3u.
window.dev4revPlaylistLink = function (raw) {
  var value = String(raw == null ? '' : raw).trim();
  if (!value) return '';
  // Локальные подборки существуют только в этом браузере — оставляем как есть.
  if (/^local:/i.test(value)) return value;
  if (/^tv\.dev4rev\.ru\//i.test(value)) value = 'https://' + value;
  if (/^\.?\//.test(value)) {
    var canonical = document.querySelector('link[rel="canonical"]');
    var base = canonical && canonical.href && /^https:\/\//i.test(canonical.href)
      ? canonical.href : 'https://tv.dev4rev.ru/';
    try { value = new URL(value, base).href; } catch (e) {}
  }
  return value;
};

// Диалоги плеера live внутри .player__video-wrap (нужно для fullscreen).
// Пока какой-то из них открыт, снимаем transform у .reveal и разрешаем
// панелям выходить за пределы маленького окна видео.
window.dev4revSyncPlayerDialogs = function () {
  var player = document.getElementById('playerSection');
  if (!player) return;
  var channels = document.getElementById('playerChannels');
  var quality = document.getElementById('qualityMenu');
  var open = !!(channels && (channels.classList.contains('is-open') ||
                             channels.classList.contains('is-closing'))) ||
             !!(quality && quality.classList.contains('is-open') && !quality.hidden);
  player.classList.toggle('has-dialog', open);
  var wrap = document.getElementById('playerWrap');
  if (wrap) wrap.classList.toggle('has-dialog', open);
};

// Панели плеера открываются по очереди: выдвижная панель и меню качества
// не должны перекрывать друг друга.
window.dev4revClosePlayerDialogs = function (except) {
  if (except !== 'channels' && window.dev4revApp && window.dev4revApp.setPlayerListOpen) {
    window.dev4revApp.setPlayerListOpen(false);
  }
  var quality = document.getElementById('qualityMenu');
  if (except !== 'quality' && quality) {
    quality.classList.remove('is-open');
    var btn = document.getElementById('qualityBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
};

// Если плеер стоит низко на странице, панель может уйти за нижнюю границу
// экрана. Подкручиваем плеер к центру только когда он реально не помещается.
window.dev4revEnsurePlayerDialogVisible = function (target) {
  var player = document.getElementById('playerSection');
  if (!player) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) return;
  var channels = document.getElementById('playerChannels');
  target = target ||
    (channels && channels.classList.contains('is-open') ? channels : null) ||
    document.getElementById('playerWrap') || player;
  var r = target.getBoundingClientRect();
  var topLimit = 76;
  var bottomLimit = window.innerHeight - 12;
  if (r.top < topLimit || r.bottom > bottomLimit) {
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
};

// Длинные названия в шапке плеера (канал, подборка, плейлист) не обрезаем:
// если строка не помещается, она медленно прокручивается туда-обратно.
// Каждый элемент-контейнер получает внутренний span.ticker__text.
(function () {
  var tickers = [];

  var TICKER_DURATION = '10s';

  function measure(entry) {
    var el = entry.el;
    if (!el || !el.isConnected) return;
    var text = entry.text.getBoundingClientRect().width;
    var box = el.clientWidth;
    var shift = Math.max(0, Math.ceil(text - box + 4));
    entry.shift = shift;
    if (shift > 0) {
      el.style.setProperty('--ticker-shift', shift + 'px');
      // Одна длительность на все строки: они движутся синхронно.
      el.style.setProperty('--ticker-duration', TICKER_DURATION);
    } else {
      el.style.removeProperty('--ticker-shift');
      el.style.removeProperty('--ticker-duration');
    }
  }

  // Перезапускаем все анимации одновременно — иначе строки, обновлённые
  // в разные моменты, ползут в разных фазах.
  function syncAnimations() {
    tickers.forEach(function (entry) {
      if (entry.el) entry.el.classList.remove('is-overflowing');
    });
    void document.documentElement.offsetWidth;
    tickers.forEach(function (entry) {
      if (entry.el && entry.shift > 0) entry.el.classList.add('is-overflowing');
    });
  }

  function refresh() {
    tickers.forEach(measure);
    syncAnimations();
  }

  window.dev4revTicker = {
    set: function (el, text) {
      if (!el) return;
      var entry = null;
      for (var i = 0; i < tickers.length; i++) {
        if (tickers[i].el === el) { entry = tickers[i]; break; }
      }
      if (!entry) {
        var inner = document.createElement('span');
        inner.className = 'ticker__text';
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(inner);
        entry = { el: el, text: inner, shift: 0 };
        tickers.push(entry);
      }
      var value = String(text == null ? '' : text);
      if (entry.text.textContent !== value) entry.text.textContent = value;
      el.title = value;
      // Замеряем сразу: в фоновой вкладке requestAnimationFrame может не
      // вызваться вовсе, а ширина строки уже актуальна после вставки текста.
      measure(entry);
      syncAnimations();
      if (window.requestAnimationFrame) requestAnimationFrame(function () {
        measure(entry);
        syncAnimations();
      });
    },
    refresh: refresh
  };

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 120);
  });
  window.addEventListener('dev4rev:tvchange', refresh);
  ['dev4rev:playerstate', 'dev4rev:channelchange', 'dev4rev:playlistchange',
   'dev4rev:cinemachange'].forEach(function (name) {
    window.addEventListener(name, refresh);
  });
})();

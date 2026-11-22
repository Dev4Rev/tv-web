(function () {
  'use strict';

  function log(section, e) {
    console.error('[dev4rev/' + section + ']', e);
  }

  var RECENT_KEY = 'dev4rev.tv.recent';
<<<<<<< HEAD
  var PIN_KEY = 'dev4rev.tv.pinned';
  var LAST_CHANNEL_URL_KEY = 'dev4rev.tv.lastChannelUrl';
  var MAX_RECENT = 5;

  var PUBLIC_SOURCES = [];
  var sourcesState = 'loading';

  var allChannels = [];
  var visibleChannels = [];
  var currentIdx = -1;
  var pinned = false;
  var playerLoaded = false;
  var playerListOpen = false;
=======
  var LAST_CHANNEL_URL_KEY = 'dev4rev.tv.lastChannelUrl';
  var MAX_RECENT = 5;

  var allChannels = [];
  var visibleChannels = [];
  var currentPlaylistUrl = '';
  var currentIdx = -1;
  var playerLoaded = false;
  var playerListOpen = false;
  var channelQuery = '';
  var channelGroup = '';
>>>>>>> 08f7507 (updated playlists, new visual)

  var playEpoch = 0;
  var fatalRetries = 0;
  var FATAL_RETRY_LIMIT = 2;
  var FATAL_RETRY_DELAY = 2500;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

<<<<<<< HEAD
=======
  var FAV_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.8 3.1 1.1-6.5L2.6 9.8l6.5-.9z"/></svg>';

  function isFavorite(url) {
    return !!(window.dev4revFavorites && window.dev4revFavorites.has(url));
  }

  function favButton(ch, cls) {
    var active = isFavorite(ch.url);
    return '<button type="button" class="' + cls + ' fav-btn' + (active ? ' is-active' : '') + '"' +
      ' data-fav-url="' + esc(ch.url) + '"' +
      ' aria-label="' + (active ? 'Убрать из избранного' : 'Добавить в избранное') + '"' +
      ' aria-pressed="' + (active ? 'true' : 'false') + '"' +
      ' title="' + (active ? 'Убрать из избранного' : 'В избранное') + '">' + FAV_ICON + '</button>';
  }

>>>>>>> 08f7507 (updated playlists, new visual)
  function initials(name) {
    var s = String(name || '').trim();
    if (!s) return '?';
    var parts = s.split(/\s+/);
    if (parts.length === 1) return s.slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function shortUrl(url) {
    try {
      var u = new URL(url);
      var path = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
      return u.hostname + '/' + path.slice(0, 32);
    } catch (e) { return url.slice(0, 48); }
  }

  function timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад';
    var d = Math.floor(diff / 86400);
    if (d < 7) return d + ' дн назад';
    return new Date(ts).toLocaleDateString('ru-RU');
  }

<<<<<<< HEAD
  function copyToClipboard(text, btn) {
    var done = function () {
      if (btn) {
        btn.classList.add('is-copied');
        setTimeout(function () { btn.classList.remove('is-copied'); }, 1500);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text); done();
      });
    } else { fallbackCopy(text); done(); }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
  }

=======
>>>>>>> 08f7507 (updated playlists, new visual)
  function getRecent() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function setRecent(list) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch (e) {}
  }

  function saveRecent(url, channelCount) {
    var list = getRecent().filter(function (x) { return x.url !== url; });
    list.unshift({ url: url, ts: Date.now(), count: channelCount || 0 });
    setRecent(list); renderRecent();
  }

  function removeRecent(url) {
    var list = getRecent().filter(function (x) { return x.url !== url; });
    setRecent(list); renderRecent();
  }

  function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    renderRecent();
  }

  function renderRecent() {
    var section = document.getElementById('recentSection');
    var list = document.getElementById('recentList');
    var count = document.getElementById('recentCount');
    var details = document.getElementById('recentDetails');
    if (!section || !list) return;

    var items = getRecent();
    if (!items.length) {
      section.hidden = true;
      list.innerHTML = '';
      if (details) details.open = false;
      return;
    }
    section.hidden = false;
    if (count) count.textContent = items.length + ' шт.';

    // При первом показе — всегда свёрнуто
    if (details && !details.dataset.init) {
      details.open = false;
      details.dataset.init = '1';
    }

    list.innerHTML = items.map(function (item) {
      return '<li class="recent">' +
        '<button type="button" class="recent__body" data-url="' + esc(item.url) + '">' +
          '<span class="recent__title">' + esc(shortUrl(item.url)) + '</span>' +
          '<span class="recent__meta">' + timeAgo(item.ts) +
            (item.count ? ' · ' + item.count + ' каналов' : '') +
          '</span>' +
        '</button>' +
        '<button type="button" class="recent__remove" data-remove="' + esc(item.url) + '" aria-label="Удалить">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</li>';
    }).join('');
  }

<<<<<<< HEAD
  function renderSources() {
    var list = document.getElementById('sourceList');
    if (!list) return;

    if (sourcesState === 'loading') {
      list.innerHTML = '<li class="sources-empty"><span class="sources-empty__text">Загружаем список…</span></li>';
      return;
    }

    if (sourcesState === 'error' || !PUBLIC_SOURCES.length) {
      list.innerHTML = '<li class="sources-empty">' +
        '<span class="sources-empty__text">Публичных плейлистов пока нет</span>' +
        '<span class="sources-empty__hint">вставьте свою ссылку в поле выше или вернитесь позже</span>' +
      '</li>';
      return;
    }

    list.innerHTML = PUBLIC_SOURCES.map(function (s) {
      return '<li class="source">' +
        '<button type="button" class="source__load" data-url="' + esc(s.url) + '" aria-label="Загрузить: ' + esc(s.title) + '">' +
          '<span class="source__flag">' + esc(s.flag) + '</span>' +
          '<span class="source__body">' +
            '<span class="source__title">' + esc(s.title) + '</span>' +
            '<span class="source__desc">' + esc(s.desc) + '</span>' +
          '</span>' +
        '</button>' +
        '<button type="button" class="source__copy" data-url="' + esc(s.url) + '" aria-label="Скопировать ссылку" title="Скопировать ссылку">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>' +
        '</button>' +
      '</li>';
    }).join('');
  }

  function loadSourcesFromJson() {
    var path = './assets/data/sources.json';
    if (!window.fetch) { sourcesState = 'error'; renderSources(); return; }

    fetch(path, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var arr = null;
        if (Array.isArray(data)) arr = data;
        else if (data && Array.isArray(data.sources)) arr = data.sources;

        if (!arr) { sourcesState = 'error'; renderSources(); return; }

        var clean = arr.filter(function (s) {
          return s && typeof s.url === 'string' && s.url;
        }).map(function (s) {
          return {
            url: s.url,
            flag: String(s.flag || '·').slice(0, 6).toUpperCase(),
            title: String(s.title || 'Плейлист'),
            desc: String(s.desc || '')
          };
        });

        if (!clean.length) { sourcesState = 'error'; renderSources(); return; }

        PUBLIC_SOURCES = clean;
        sourcesState = 'ready';
        renderSources();
      })
      .catch(function (e) { log('sources-json', e); sourcesState = 'error'; renderSources(); });
  }

  function renderChannels(list) {
    var ul = document.getElementById('channelList');
    var empty = document.getElementById('channelEmpty');
    var count = document.getElementById('channelsCount');
=======
  function renderChannels(list) {
    var ul = document.getElementById('channelList');
    var empty = document.getElementById('channelEmpty');
>>>>>>> 08f7507 (updated playlists, new visual)
    if (!ul) return;

    if (!list.length) {
      ul.innerHTML = '';
      if (empty) empty.hidden = false;
<<<<<<< HEAD
      if (count) count.textContent = 'ничего не найдено';
=======
>>>>>>> 08f7507 (updated playlists, new visual)
      renderPlayerChannels();
      return;
    }
    if (empty) empty.hidden = true;
<<<<<<< HEAD
    if (count) count.textContent = list.length + ' из ' + allChannels.length + ' каналов';
=======
>>>>>>> 08f7507 (updated playlists, new visual)

    ul.innerHTML = list.map(function (ch) {
      var logoHtml;
      if (ch.logo) {
        logoHtml = '<img class="channel__logo" src="' + esc(ch.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'channel__logo channel__logo--placeholder\',textContent:\'' + esc(initials(ch.name)) + '\'}))">';
      } else {
        logoHtml = '<span class="channel__logo channel__logo--placeholder">' + esc(initials(ch.name)) + '</span>';
      }
<<<<<<< HEAD
      return '<li><button type="button" class="channel' + (ch._idx === currentIdx ? ' is-playing' : '') + '" data-idx="' + ch._idx + '">' +
        logoHtml +
        '<span class="channel__body">' +
          '<span class="channel__name">' +
            '<span class="channel__name-track">' +
              '<span class="channel__name-text">' + esc(ch.name) + '</span>' +
              '<span class="channel__name-text" aria-hidden="true">' + esc(ch.name) + '</span>' +
            '</span>' +
          '</span>' +
          '<span class="channel__group">' + esc(ch.group) + '</span>' +
        '</span>' +
      '</button></li>';
=======
      return '<li class="channel-item">' +
        '<button type="button" class="channel' + (ch._idx === currentIdx ? ' is-playing' : '') + '" data-idx="' + ch._idx + '">' +
          logoHtml +
          '<span class="channel__body">' +
            '<span class="channel__name">' +
              '<span class="channel__name-track">' +
                '<span class="channel__name-text">' + esc(ch.name) + '</span>' +
                '<span class="channel__name-text" aria-hidden="true">' + esc(ch.name) + '</span>' +
              '</span>' +
            '</span>' +
            '<span class="channel__group">' + esc(ch.group) + '</span>' +
          '</span>' +
        '</button>' +
        favButton(ch, '') +
      '</li>';
>>>>>>> 08f7507 (updated playlists, new visual)
    }).join('');

    applyMarqueeOverflow();
    renderPlayerChannels();
  }

  function applyMarqueeOverflow() {
    requestAnimationFrame(function () {
      var nodes = document.querySelectorAll('.channel__name');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var track = el.querySelector('.channel__name-track');
        if (!track) continue;
        el.classList.remove('is-overflow');
        var trackWidth = track.scrollWidth;
        var containerWidth = el.clientWidth;
        if (trackWidth / 2 > containerWidth + 1) el.classList.add('is-overflow');
      }
    });
  }

<<<<<<< HEAD
  function filterChannels() {
    var searchEl = document.getElementById('channelSearch');
    var groupEl = document.getElementById('groupFilter');
    var q = ((searchEl && searchEl.value) || '').toLowerCase().trim();
    var g = (groupEl && groupEl.value) || '';

    visibleChannels = allChannels.filter(function (ch) {
      if (g && ch.group !== g) return false;
      if (q && ch.name.toLowerCase().indexOf(q) === -1 && ch.group.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    renderChannels(visibleChannels);
  }

  function buildGroups(channels) {
    var sel = document.getElementById('groupFilter');
    if (!sel) return;
    var groups = {};
    channels.forEach(function (ch) { groups[ch.group] = (groups[ch.group] || 0) + 1; });
    var keys = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'ru'); });
=======
  function syncFilterInputs() {
    var pairs = [
      ['channelSearch', channelQuery],
      ['playerChannelSearch', channelQuery],
      ['groupFilter', channelGroup],
      ['playerGroupFilter', channelGroup]
    ];
    pairs.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      // Не перезаписываем поле, в которое пользователь печатает прямо сейчас.
      if (el && document.activeElement !== el && el.value !== pair[1]) el.value = pair[1];
    });
  }

  function setChannelFilter(q, g) {
    channelQuery = String(q || '').toLowerCase().trim();
    channelGroup = String(g || '');
    syncFilterInputs();
    filterChannels();
    // Внешнее меню под плеером дублирует поиск каналов из панели.
    window.dispatchEvent(new CustomEvent('dev4rev:channelfilter', {
      detail: { query: channelQuery, group: channelGroup }
    }));
  }

  function filterChannels() {
    visibleChannels = allChannels.filter(function (ch) {
      if (channelGroup && ch.group !== channelGroup) return false;
      if (channelQuery &&
          ch.name.toLowerCase().indexOf(channelQuery) === -1 &&
          ch.group.toLowerCase().indexOf(channelQuery) === -1) return false;
      return true;
    });
    renderChannels(visibleChannels);
    syncFilterInputs();
  }

  function buildGroups(channels) {
    var selects = ['groupFilter', 'playerGroupFilter']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (!selects.length) return;

    var groups = {};
    channels.forEach(function (ch) { groups[ch.group] = (groups[ch.group] || 0) + 1; });
    var keys = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'ru'); });
    if (channelGroup && !groups[channelGroup]) channelGroup = '';
>>>>>>> 08f7507 (updated playlists, new visual)
    var html = '<option value="">Все группы (' + channels.length + ')</option>';
    keys.forEach(function (k) {
      html += '<option value="' + esc(k) + '">' + esc(k) + ' (' + groups[k] + ')</option>';
    });
<<<<<<< HEAD
    sel.innerHTML = html;
=======
    selects.forEach(function (sel) { sel.innerHTML = html; });
    syncFilterInputs();
>>>>>>> 08f7507 (updated playlists, new visual)
  }

  function renderPlayerChannels() {
    var panel = document.getElementById('playerChannels');
    var list = document.getElementById('playerChannelsList');
    var count = document.getElementById('playerChannelsCount');
<<<<<<< HEAD
    if (!panel || !list) return;

    if (!visibleChannels.length) {
      list.innerHTML = '<li style="padding:24px 16px;text-align:center;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:rgba(255,255,255,0.5);">Сначала загрузите плейлист</li>';
      if (count) count.textContent = '0';
      return;
    }
=======
    var empty = document.getElementById('playerChannelsEmpty');
    if (!panel || !list) return;

    if (!visibleChannels.length) {
      list.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.textContent = allChannels.length ? 'Каналы не найдены' : 'Сначала загрузите плейлист';
      }
      if (count) count.textContent = '0';
      return;
    }
    if (empty) empty.hidden = true;
>>>>>>> 08f7507 (updated playlists, new visual)

    if (count) count.textContent = visibleChannels.length + '';

    list.innerHTML = visibleChannels.map(function (ch) {
      var logoHtml;
      if (ch.logo) {
        logoHtml = '<img class="player__channel-logo" src="' + esc(ch.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'player__channel-logo player__channel-logo--placeholder\',textContent:\'' + esc(initials(ch.name)) + '\'}))">';
      } else {
        logoHtml = '<span class="player__channel-logo player__channel-logo--placeholder">' + esc(initials(ch.name)) + '</span>';
      }
<<<<<<< HEAD
      return '<li><button type="button" class="player__channel' + (ch._idx === currentIdx ? ' is-playing' : '') + '" data-idx="' + ch._idx + '" role="option" aria-selected="' + (ch._idx === currentIdx ? 'true' : 'false') + '">' +
        logoHtml +
        '<span class="player__channel-body">' +
          '<span class="player__channel-name">' + esc(ch.name) + '</span>' +
          '<span class="player__channel-group">' + esc(ch.group) + '</span>' +
        '</span>' +
        '<span class="player__channel-indicator" aria-hidden="true"></span>' +
      '</button></li>';
=======
      return '<li class="player__channel-item">' +
        '<button type="button" class="player__channel' + (ch._idx === currentIdx ? ' is-playing' : '') + '" data-idx="' + ch._idx + '" role="option" aria-selected="' + (ch._idx === currentIdx ? 'true' : 'false') + '">' +
          logoHtml +
          '<span class="player__channel-body">' +
            '<span class="player__channel-name">' + esc(ch.name) + '</span>' +
            '<span class="player__channel-group">' + esc(ch.group) + '</span>' +
          '</span>' +
          '<span class="player__channel-indicator" aria-hidden="true"></span>' +
        '</button>' +
        favButton(ch, '') +
      '</li>';
>>>>>>> 08f7507 (updated playlists, new visual)
    }).join('');

    if (playerListOpen) {
      var playing = list.querySelector('.player__channel.is-playing');
      if (playing) {
        var offset = playing.offsetTop - list.clientHeight / 2 + playing.offsetHeight / 2;
        list.scrollTop = Math.max(0, offset);
      }
    }
  }

<<<<<<< HEAD
  function setPlayerListOpen(open) {
    playerListOpen = !!open;
    var panel = document.getElementById('playerChannels');
    var fsListBtn = document.getElementById('fsListBtn');

    if (panel) {
      panel.classList.toggle('is-open', playerListOpen);
      panel.setAttribute('data-state', playerListOpen ? 'open' : 'closed');
      panel.style.visibility = playerListOpen ? 'visible' : 'hidden';
      panel.style.pointerEvents = playerListOpen ? 'auto' : 'none';
      panel.style.transform = playerListOpen ? 'translateX(0)' : 'translateX(100%)';
    }

    if (fsListBtn) {
      fsListBtn.classList.toggle('is-active', playerListOpen);
      fsListBtn.setAttribute('aria-pressed', playerListOpen ? 'true' : 'false');
    }

    if (playerListOpen) {
=======
  function syncPlayerListButton() {
    var fsListBtn = document.getElementById('fsListBtn');
    if (!fsListBtn) return;
    fsListBtn.classList.toggle('is-active', playerListOpen);
    fsListBtn.setAttribute('aria-pressed', playerListOpen ? 'true' : 'false');
    fsListBtn.setAttribute('aria-expanded', playerListOpen ? 'true' : 'false');
  }

  function setPlayerListOpen(open, tab, immediate) {
    // В свёрнутом плеере выдвижная панель не имеет права появляться.
    // Разворачиваем плеер и только потом открываем нужную вкладку.
    if (open && !immediate && window.dev4revMiniPlayer &&
        window.dev4revMiniPlayer.isActive()) {
      window.dev4revMiniPlayer.expand(true);
    }

    playerListOpen = !!open;
    var panel = document.getElementById('playerChannels');
    if (panel) {
      if (playerListOpen) {
        // Открытие: снимаем состояние закрытия, чтобы обрезка окна видео
        // не мешала панели выехать.
        panel.classList.remove('is-closing', 'is-instant-close');
        if (panel._closeTimer) { clearTimeout(panel._closeTimer); panel._closeTimer = null; }
      } else if (immediate) {
        // Сворачивание плеера: убираем панель без анимации, иначе она
        // успевает «проехать» по уменьшающемуся окну и обрезается.
        if (panel._closeTimer) { clearTimeout(panel._closeTimer); panel._closeTimer = null; }
        panel.classList.remove('is-closing');
        panel.classList.add('is-instant-close');
      } else {
        // Закрытие: сохраняем overflow video-wrap на время анимации уезда,
        // иначе панель исчезает рывком, не успев уехать за край.
        panel.classList.remove('is-instant-close');
        panel.classList.add('is-closing');
        if (panel._closeTimer) clearTimeout(panel._closeTimer);
        panel._closeTimer = setTimeout(function () {
          panel.classList.remove('is-closing');
          panel._closeTimer = null;
          if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
        }, 460);
      }
      panel.classList.toggle('is-open', playerListOpen);
      panel.setAttribute('data-state', playerListOpen ? 'open' : 'closed');
    }
    syncPlayerListButton();

    // Содержимое панели (плейлисты/каналы) рисует cinema.js.
    if (window.dev4revCinema) {
      window.dev4revCinema.setContextTab(tab || 'channels', playerListOpen);
    }

    if (playerListOpen) {
      if (window.dev4revClosePlayerDialogs) window.dev4revClosePlayerDialogs('channels');
      if (window.dev4revEnsurePlayerDialogVisible) window.dev4revEnsurePlayerDialogVisible();
>>>>>>> 08f7507 (updated playlists, new visual)
      renderPlayerChannels();
      var panelListEl = document.getElementById('playerChannelsList');
      if (panelListEl) {
        var active = panelListEl.querySelector('.player__channel.is-playing');
        if (active) {
          var offset = active.offsetTop - panelListEl.clientHeight / 2 + active.offsetHeight / 2;
          panelListEl.scrollTop = Math.max(0, offset);
          try { active.focus({ preventScroll: true }); } catch (e) {}
        }
      }
    }

<<<<<<< HEAD
  }

  function togglePlayerList() {
    setPlayerListOpen(!playerListOpen);
  }

  function loadPinPref() {
    try { pinned = localStorage.getItem(PIN_KEY) === '1'; } catch (e) { pinned = false; }
  }

  function savePinPref() {
    try { localStorage.setItem(PIN_KEY, pinned ? '1' : '0'); } catch (e) {}
  }

  function applyPin() {
    var player = document.getElementById('playerSection');
    var head = document.getElementById('channelsHead');
    var pinBtn = document.getElementById('pinBtn');

    if (pinBtn) {
      pinBtn.classList.toggle('is-active', pinned);
      pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pinBtn.setAttribute('aria-label', pinned ? 'Открепить плеер' : 'Закрепить плеер');
      pinBtn.setAttribute('title', pinned ? 'Открепить плеер' : 'Закрепить плеер');
    }

    var shouldStickPlayer = pinned && playerLoaded && player && !player.hidden;
    if (player) player.classList.toggle('is-sticky', !!shouldStickPlayer);
    if (head) {
      head.classList.toggle('is-sticky', playerLoaded);
      head.classList.toggle('is-under-player', !!shouldStickPlayer);
    }
    updatePlayerHeight();
  }

  function updatePlayerHeight() {
    var target = document.querySelector('.player__video-wrap');
    if (!target) return;
    var h = target.getBoundingClientRect().height;
    if (h > 0) document.documentElement.style.setProperty('--player-h', h + 'px');
=======
    if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
  }

  function togglePlayerList() {
    // Одна кнопка открывает панель на последней выбранной вкладке.
    var tab = window.dev4revCinema && window.dev4revCinema.getContextTab
      ? window.dev4revCinema.getContextTab().tab
      : 'channels';
    setPlayerListOpen(!playerListOpen, tab);
>>>>>>> 08f7507 (updated playlists, new visual)
  }

  function setStatus(text, kind) {
    var el = document.getElementById('playlistStatus');
<<<<<<< HEAD
    if (!el) return;
    el.textContent = text || '';
    el.className = 'playlist-status' + (kind ? ' is-' + kind : '');
=======
    if (el) {
      el.textContent = text || '';
      el.className = 'playlist-status' + (kind ? ' is-' + kind : '');
    }
>>>>>>> 08f7507 (updated playlists, new visual)
  }

  function syncFsHead(name, group) {
    var t = document.getElementById('fsTitle');
    var g = document.getElementById('fsGroup');
    if (t) t.textContent = name || '—';
    if (g) g.textContent = group || '';
  }

  // ── Playback ───────────────────────────────────────────
  function playChannel(idx) {
    var ch = null;
    for (var i = 0; i < allChannels.length; i++) {
      if (allChannels[i]._idx === idx) { ch = allChannels[i]; break; }
    }
    if (!ch) return;

    if (!window.dev4revPlayer || typeof window.dev4revPlayer.play !== 'function') {
      log('play-channel', 'player not ready');
      setStatus('Плеер не инициализирован', 'error');
      return;
    }

    playEpoch++;
    currentIdx = idx;

    try { localStorage.setItem(LAST_CHANNEL_URL_KEY, ch.url); } catch (e) {}

    window.dev4revPlayer.play(ch.url, idx);

    var playerSection = document.getElementById('playerSection');
    var nowPlaying = document.getElementById('nowPlaying');
    var nowGroup = document.getElementById('nowGroup');
    if (playerSection) playerSection.hidden = false;
<<<<<<< HEAD
    if (nowPlaying) nowPlaying.textContent = ch.name;
    if (nowGroup) nowGroup.textContent = ch.group;
=======
    // Плеер может быть просто развёрнут заново (уже загруженный плейлист) —
    // сообщаем об этом, чтобы меню под плеером снова появилось.
    window.dispatchEvent(new CustomEvent('dev4rev:playerstate', { detail: { loaded: true } }));
    if (window.dev4revTicker) {
      window.dev4revTicker.set(nowPlaying, ch.name);
      window.dev4revTicker.set(nowGroup, ch.group ? '· ' + ch.group : '');
    } else {
      if (nowPlaying) nowPlaying.textContent = ch.name;
      if (nowGroup) nowGroup.textContent = ch.group;
    }
>>>>>>> 08f7507 (updated playlists, new visual)
    syncFsHead(ch.name, ch.group);

    document.querySelectorAll('.channel').forEach(function (el) {
      el.classList.toggle('is-playing', Number(el.dataset.idx) === idx);
    });
    document.querySelectorAll('.player__channel').forEach(function (el) {
      var isPlaying = Number(el.dataset.idx) === idx;
      el.classList.toggle('is-playing', isPlaying);
      el.setAttribute('aria-selected', isPlaying ? 'true' : 'false');
    });

    if (playerListOpen) {
      var panelActive = document.querySelector('.player__channel.is-playing');
      if (panelActive) panelActive.scrollIntoView({ block: 'nearest' });
    }

<<<<<<< HEAD
    if (!pinned && playerSection) {
      var rect = playerSection.getBoundingClientRect();
      var topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      var fullyHidden = rect.bottom <= topbarH || rect.top >= window.innerHeight;
      if (fullyHidden) playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
=======
    window.dispatchEvent(new CustomEvent('dev4rev:channelchange', {
      detail: { idx: idx, name: ch.name, group: ch.group, url: ch.url }
    }));
>>>>>>> 08f7507 (updated playlists, new visual)

    showControls();
  }

  // ── Выбор канала при пустом плеере ─────────────────────
  function playLastOrFirst() {
    if (!allChannels.length) {
      setStatus('Загрузите плейлист — потом выберите канал', 'error');
      return;
    }

    fatalRetries = 0;

    // 1. Текущий выбранный (если был)
    if (currentIdx >= 0) {
      for (var i = 0; i < allChannels.length; i++) {
        if (allChannels[i]._idx === currentIdx) {
          playChannel(currentIdx);
          return;
        }
      }
    }

    // 2. Последний сыгранный в предыдущих сессиях (по URL)
    var lastUrl = null;
    try { lastUrl = localStorage.getItem(LAST_CHANNEL_URL_KEY); } catch (e) {}
    if (lastUrl) {
      for (var j = 0; j < allChannels.length; j++) {
        if (allChannels[j].url === lastUrl) {
          playChannel(allChannels[j]._idx);
          return;
        }
      }
    }

    // 3. Первый из видимых (с учётом фильтра) или из всех
    var firstCh = visibleChannels.length > 0 ? visibleChannels[0] : allChannels[0];
    if (firstCh) playChannel(firstCh._idx);
  }

  function nextChannel() {
    if (!visibleChannels.length) return;
    var pos = -1;
    for (var i = 0; i < visibleChannels.length; i++) {
      if (visibleChannels[i]._idx === currentIdx) { pos = i; break; }
    }
    playChannel(visibleChannels[(pos + 1) % visibleChannels.length]._idx);
    focusPlaying();
  }

  function prevChannel() {
    if (!visibleChannels.length) return;
    var pos = -1;
    for (var i = 0; i < visibleChannels.length; i++) {
      if (visibleChannels[i]._idx === currentIdx) { pos = i; break; }
    }
    playChannel(visibleChannels[(pos - 1 + visibleChannels.length) % visibleChannels.length]._idx);
    focusPlaying();
  }

  function focusPlaying() {
    var el = document.querySelector('.channel.is-playing');
    if (el) el.focus({ preventScroll: true });
  }

  function load(url) {
    var loadBtn = document.getElementById('loadBtn');
    var input = document.getElementById('playlistUrl');
<<<<<<< HEAD
    var details = document.getElementById('sourcesDetails');
    if (input) input.value = url;
    if (loadBtn) loadBtn.disabled = true;
    setStatus('Загружаем плейлист…');
    if (details) details.open = false;

    window.dev4revLoadPlaylist(url)
=======
    // Загружаем по относительным ./... путям (они работают и в локальном превью),
    // но в поле показываем публичный адрес tv.dev4rev.ru/...m3u.
    if (input) {
      input.value = window.dev4revPlaylistLink ? window.dev4revPlaylistLink(url) : url;
    }
    currentPlaylistUrl = url;
    channelQuery = '';
    channelGroup = '';
    syncFilterInputs();
    if (loadBtn) loadBtn.disabled = true;
    setStatus('Загружаем плейлист…');

    var promise = window.dev4revLoadPlaylist(url)
>>>>>>> 08f7507 (updated playlists, new visual)
      .then(function (channels) {
        allChannels = channels.map(function (ch, i) { ch._idx = i; return ch; });
        if (!channels.length) { setStatus('Плейлист пуст или не распознан', 'error'); return; }
        setStatus('Загружено каналов: ' + channels.length, 'ok');
        buildGroups(allChannels);
        filterChannels();

        var playerSection = document.getElementById('playerSection');
        var channelsSection = document.getElementById('channelsSection');
        if (playerSection) playerSection.hidden = false;
        if (channelsSection) channelsSection.hidden = false;

        playerLoaded = true;
<<<<<<< HEAD
        applyPin();
        saveRecent(url, channels.length);
=======
        window.dispatchEvent(new CustomEvent('dev4rev:playerstate', { detail: { loaded: true } }));
        saveRecent(url, channels.length);
        window.dispatchEvent(new CustomEvent('dev4rev:playlistchange', {
          detail: { url: url, count: channels.length }
        }));
>>>>>>> 08f7507 (updated playlists, new visual)
      })
      .catch(function (e) {
        log('load', e);
        setStatus('Не удалось загрузить. Проверьте ссылку и CORS.', 'error');
      })
      .then(function () { if (loadBtn) loadBtn.disabled = false; });
<<<<<<< HEAD
=======

    return promise;
  }

  // Загрузка каналов без сети: избранное и сохранённые подборки.
  function loadChannels(channels, opts) {
    var o = opts || {};
    var input = document.getElementById('playlistUrl');
    var loadBtn = document.getElementById('loadBtn');
    var list = (Array.isArray(channels) ? channels : []).filter(function (ch) {
      return ch && typeof ch.url === 'string' && /^https?:\/\//i.test(ch.url);
    }).map(function (ch, i) {
      return {
        name: String(ch.name || 'Без названия'),
        url: ch.url,
        logo: String(ch.logo || ''),
        group: String(ch.group || 'Без группы'),
        _idx: i
      };
    });

    currentPlaylistUrl = o.url || ('local:' + (o.label || 'collection'));
    if (input) input.value = currentPlaylistUrl;
    channelQuery = '';
    channelGroup = '';
    syncFilterInputs();
    if (loadBtn) loadBtn.disabled = true;

    allChannels = list;
    buildGroups(allChannels);
    filterChannels();

    var playerSection = document.getElementById('playerSection');
    var channelsSection = document.getElementById('channelsSection');
    if (playerSection) playerSection.hidden = false;
    if (channelsSection) channelsSection.hidden = false;

    playerLoaded = list.length > 0;
    setStatus(list.length
      ? 'Загружено каналов: ' + list.length + (o.label ? ' · ' + o.label : '')
      : 'В этой подборке пока нет каналов', list.length ? 'ok' : 'warn');
    window.dispatchEvent(new CustomEvent('dev4rev:playerstate', { detail: { loaded: playerLoaded } }));
    window.dispatchEvent(new CustomEvent('dev4rev:playlistchange', {
      detail: { url: currentPlaylistUrl, count: list.length, local: true }
    }));
    if (loadBtn) loadBtn.disabled = false;
    return Promise.resolve(list.length > 0);
>>>>>>> 08f7507 (updated playlists, new visual)
  }

  function unload() {
    var playerSection = document.getElementById('playerSection');
    var channelsSection = document.getElementById('channelsSection');
<<<<<<< HEAD
    var details = document.getElementById('sourcesDetails');
=======
>>>>>>> 08f7507 (updated playlists, new visual)

    if (window.dev4revPlayer && window.dev4revPlayer.destroy) window.dev4revPlayer.destroy();

    setPlayerListOpen(false);
    if (playerSection) playerSection.hidden = true;
    if (channelsSection) channelsSection.hidden = true;
<<<<<<< HEAD
    if (details) details.open = true;
=======
>>>>>>> 08f7507 (updated playlists, new visual)

    playerLoaded = false;
    currentIdx = -1;
    fatalRetries = 0;
    syncFsHead('—', '');
<<<<<<< HEAD
    applyPin();

    var sources = document.getElementById('sourcesSection');
    if (sources) {
      var topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      var rect = sources.getBoundingClientRect();
      if (rect.top < topbarH || rect.top > window.innerHeight * 0.4) {
        sources.scrollIntoView({ behavior: 'smooth', block: 'start' });
=======
    window.dispatchEvent(new CustomEvent('dev4rev:playerstate', { detail: { loaded: false } }));

    var shelf = document.getElementById('homeShelf');
    if (shelf) {
      var topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      var rect = shelf.getBoundingClientRect();
      if (rect.top < topbarH || rect.top > window.innerHeight * 0.4) {
        shelf.scrollIntoView({ behavior: 'smooth', block: 'start' });
>>>>>>> 08f7507 (updated playlists, new visual)
      }
    }
  }

  function isFullscreen() {
    var wrap = document.getElementById('playerWrap');
    if (!wrap) return false;
    return document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap;
  }

  function updateFsIcon() {
<<<<<<< HEAD
    var btn = document.getElementById('videoFsBtn');
=======
    var btn = document.getElementById('fullscreenBtn');
>>>>>>> 08f7507 (updated playlists, new visual)
    if (!btn) return;
    var active = isFullscreen();
    btn.setAttribute('aria-label', active ? 'Выйти из полноэкранного режима' : 'На весь экран');
    btn.setAttribute('title', active ? 'Выйти из полноэкранного режима' : 'На весь экран');
  }

  function toggleFullscreen() {
    var wrap = document.getElementById('playerWrap');
    if (!wrap) return;
    if (!isFullscreen()) {
      var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.webkitRequestFullScreen;
      if (req) { var p = req.call(wrap); if (p && p.catch) p.catch(function () {}); }
    } else { exitFullscreen(); }
  }

  function exitFullscreen() {
    if (!isFullscreen()) return;
    var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (exit) { var p = exit.call(document); if (p && p.catch) p.catch(function () {}); }
  }

  function handleFullscreenChange() {
    updateFsIcon();
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    var wrap = document.getElementById('playerWrap');
<<<<<<< HEAD

    if (fsEl === wrap) {
=======
    var active = fsEl === wrap;
    document.body.classList.toggle('player-immersive', active);

    if (active) {
>>>>>>> 08f7507 (updated playlists, new visual)
      var ch = allChannels.find(function (c) { return c._idx === currentIdx; });
      if (ch) syncFsHead(ch.name, ch.group);
      if (window.dev4revControls) window.dev4revControls.show();
    } else {
      if (playerListOpen) setPlayerListOpen(false);
    }
<<<<<<< HEAD
=======
    window.dispatchEvent(new CustomEvent('dev4rev:fullscreenchange', { detail: { active: active } }));
>>>>>>> 08f7507 (updated playlists, new visual)
  }

  function showControls() {
    if (window.dev4revControls && window.dev4revControls.show) window.dev4revControls.show();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sinceEl = document.getElementById('since');
    var yEl = document.getElementById('y');
    if (sinceEl) sinceEl.textContent = '2023';
    if (yEl) yEl.textContent = new Date().getFullYear();

<<<<<<< HEAD
    loadPinPref();
    renderSources();
    renderRecent();
    loadSourcesFromJson();
=======
    renderRecent();
>>>>>>> 08f7507 (updated playlists, new visual)

    var input = document.getElementById('playlistUrl');
    var loadBtn = document.getElementById('loadBtn');

    try {
      var recent = getRecent();
<<<<<<< HEAD
      if (recent.length && input && !input.value) input.value = recent[0].url;
    } catch (e) {}

    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (!input) return;
        var url = input.value.trim();
=======
      if (recent.length && input && !input.value) {
        input.value = window.dev4revPlaylistLink
          ? window.dev4revPlaylistLink(recent[0].url) : recent[0].url;
      }
    } catch (e) {}

    function readPlaylistInput() {
      if (!input) return '';
      var raw = input.value.trim();
      var url = window.dev4revPlaylistLink ? window.dev4revPlaylistLink(raw) : raw;
      input.value = url;
      return url;
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (!input) return;
        var url = readPlaylistInput();
>>>>>>> 08f7507 (updated playlists, new visual)
        if (!url) { setStatus('Введите ссылку на плейлист', 'error'); return; }
        load(url);
      });
    }

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (loadBtn) loadBtn.click(); }
      });
<<<<<<< HEAD
    }

    var sourceList = document.getElementById('sourceList');
    if (sourceList) {
      sourceList.addEventListener('click', function (e) {
        var copyBtn = e.target.closest('.source__copy');
        if (copyBtn && copyBtn.dataset.url) {
          e.preventDefault(); e.stopPropagation();
          copyToClipboard(copyBtn.dataset.url, copyBtn);
          return;
        }
        var loadBtnEl = e.target.closest('.source__load');
        if (loadBtnEl && loadBtnEl.dataset.url) { e.preventDefault(); load(loadBtnEl.dataset.url); return; }
      });
    }
=======
      // Вставленную короткую форму tv.dev4rev.ru/... сразу показываем в полном виде.
      input.addEventListener('blur', readPlaylistInput);
    }

    // Ссылка «поделиться плейлистом» может содержать ?playlist=... — загружаем её автоматически.
    try {
      var shared = new URLSearchParams(window.location.search).get('playlist');
      if (shared) {
        if (/^https?:\/\//i.test(shared)) load(shared);
        else if (/^\.?\//.test(shared)) load(new URL(shared, window.location.href).href);
      }
    } catch (e) {}
>>>>>>> 08f7507 (updated playlists, new visual)

    var recentList = document.getElementById('recentList');
    if (recentList) {
      recentList.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('.recent__remove');
        if (removeBtn) { removeRecent(removeBtn.dataset.remove); return; }
        var body = e.target.closest('.recent__body');
        if (body && body.dataset.url) load(body.dataset.url);
      });
    }

    var clearBtn = document.getElementById('clearRecent');
    if (clearBtn) clearBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearRecent();
      var det = document.getElementById('recentDetails');
      if (det) det.open = false;
    });

    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', unload);

<<<<<<< HEAD
    var search = document.getElementById('channelSearch');
    if (search) search.addEventListener('input', filterChannels);
    var group = document.getElementById('groupFilter');
    if (group) group.addEventListener('change', filterChannels);
=======
    ['channelSearch', 'playerChannelSearch'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { setChannelFilter(el.value, channelGroup); });
    });
    ['groupFilter', 'playerGroupFilter'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { setChannelFilter(channelQuery, el.value); });
    });
>>>>>>> 08f7507 (updated playlists, new visual)

    var list = document.getElementById('channelList');
    if (list) {
      list.addEventListener('click', function (e) {
<<<<<<< HEAD
=======
        var fav = e.target.closest('[data-fav-url]');
        if (fav) {
          e.preventDefault();
          e.stopPropagation();
          if (window.dev4revFavorites) window.dev4revFavorites.toggle({
            url: fav.dataset.favUrl,
            name: (fav.closest('.channel-item').querySelector('.channel__name-text') || {}).textContent,
            logo: (fav.closest('.channel-item').querySelector('.channel__logo[src]') || {}).src || '',
            group: (fav.closest('.channel-item').querySelector('.channel__group') || {}).textContent
          });
          return;
        }
>>>>>>> 08f7507 (updated playlists, new visual)
        var btn = e.target.closest('.channel');
        if (!btn) return;
        playChannel(Number(btn.dataset.idx));
      });
    }

<<<<<<< HEAD
=======
    window.addEventListener('dev4rev:favoriteschange', function () {
      renderChannels(visibleChannels);
    });

>>>>>>> 08f7507 (updated playlists, new visual)
    var nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.addEventListener('click', nextChannel);
    var prevBtn = document.getElementById('prevBtn');
    if (prevBtn) prevBtn.addEventListener('click', prevChannel);

    var videoPrevBtn = document.getElementById('videoPrevBtn');
    if (videoPrevBtn) {
      videoPrevBtn.addEventListener('click', function (e) { e.preventDefault(); prevChannel(); });
    }
    var videoNextBtn = document.getElementById('videoNextBtn');
    if (videoNextBtn) {
      videoNextBtn.addEventListener('click', function (e) { e.preventDefault(); nextChannel(); });
    }

    var fsListBtn = document.getElementById('fsListBtn');
    if (fsListBtn) {
      fsListBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePlayerList();
      });
    }

    var channelsCloseBtn = document.getElementById('channelsCloseBtn');
    if (channelsCloseBtn) {
      channelsCloseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setPlayerListOpen(false);
        if (fsListBtn && fsListBtn.offsetParent !== null) fsListBtn.focus();
      });
    }

    var playerChannelsList = document.getElementById('playerChannelsList');
    if (playerChannelsList) {
      playerChannelsList.addEventListener('click', function (e) {
<<<<<<< HEAD
        var btn = e.target.closest('.player__channel');
        if (!btn) return;
        playChannel(Number(btn.dataset.idx));
      });
    }

    var pinBtn = document.getElementById('pinBtn');
    if (pinBtn) {
      pinBtn.addEventListener('click', function () {
        pinned = !pinned;
        savePinPref();
        applyPin();
      });
    }

    var videoFsBtn = document.getElementById('videoFsBtn');
    if (videoFsBtn) {
      videoFsBtn.addEventListener('click', function (e) { e.preventDefault(); toggleFullscreen(); });
    }

=======
        var fav = e.target.closest('[data-fav-url]');
        if (fav) {
          e.preventDefault();
          e.stopPropagation();
          if (window.dev4revFavorites) window.dev4revFavorites.toggle({
            url: fav.dataset.favUrl,
            name: (fav.closest('.player__channel-item').querySelector('.player__channel-name') || {}).textContent,
            logo: (fav.closest('.player__channel-item').querySelector('.player__channel-logo[src]') || {}).src || '',
            group: (fav.closest('.player__channel-item').querySelector('.player__channel-group') || {}).textContent
          });
          return;
        }
        var btn = e.target.closest('.player__channel');
        if (!btn) return;
        playChannel(Number(btn.dataset.idx));
        if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches &&
            window.dev4revCinema) {
          window.dev4revCinema.closeContext();
        }
      });
    }

>>>>>>> 08f7507 (updated playlists, new visual)
    var fsExitBtn = document.getElementById('fsExitBtn');
    if (fsExitBtn) {
      fsExitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        exitFullscreen();
      });
    }

    // ── Событие «клик по Play при пустом плеере» ───────────
    window.addEventListener('dev4rev:request-play', function () {
      playLastOrFirst();
    });

<<<<<<< HEAD
=======
    window.addEventListener('dev4rev:contexttab', function (e) {
      var detail = e.detail || {};
      playerListOpen = !!detail.open;
      syncPlayerListButton();
    });

>>>>>>> 08f7507 (updated playlists, new visual)
    ['mousemove', 'mousedown', 'touchstart', 'touchmove'].forEach(function (ev) {
      document.addEventListener(ev, function () {
        if (isFullscreen()) showControls();
      }, { passive: true });
    });

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    updateFsIcon();

    document.addEventListener('keydown', function (e) {
      var active = document.activeElement;
      var inInput = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
      );
      var inPlayerList = active && active.classList && active.classList.contains('player__channel');

      if (e.key === 'Escape' && isFullscreen()) return;

      if (e.key === 'Escape' && playerListOpen) {
        e.preventDefault();
        setPlayerListOpen(false);
        return;
      }

      if (!inInput && (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д')) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        togglePlayerList();
        return;
      }

      if (inPlayerList) {
        var items = Array.prototype.slice.call(document.querySelectorAll('.player__channel'));
        var currentPos = items.indexOf(active);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[(currentPos + 1) % items.length].focus({ preventScroll: false });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[(currentPos - 1 + items.length) % items.length].focus({ preventScroll: false });
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') return;
        if (e.key === 'n' || e.key === 'т') { e.preventDefault(); nextChannel(); return; }
        if (e.key === 'p' || e.key === 'з') { e.preventDefault(); prevChannel(); return; }
      }

      if (inInput) return;

      var key = e.key.toLowerCase();
      if (key === 'n' || key === 'т') { e.preventDefault(); nextChannel(); }
      if (key === 'p' || key === 'з') { e.preventDefault(); prevChannel(); }
<<<<<<< HEAD
=======
      if (key === 'i' || key === 'и') {
        e.preventDefault();
        if (window.dev4revControls && window.dev4revControls.togglePip) {
          window.dev4revControls.togglePip();
        }
      }
>>>>>>> 08f7507 (updated playlists, new visual)
      if (e.key === 'MediaTrackNext') { e.preventDefault(); nextChannel(); }
      if (e.key === 'MediaTrackPrevious') { e.preventDefault(); prevChannel(); }
    });

    if (window.dev4revPlayer && window.dev4revPlayer.onFatal) {
      window.dev4revPlayer.onFatal(function (idx, reason) {
        var myEpoch = playEpoch;
        setTimeout(function () {
          if (playEpoch !== myEpoch) return;
          if (window.dev4revPlayer.getCurrentIndex() !== idx) return;
          if (fatalRetries >= FATAL_RETRY_LIMIT) {
            fatalRetries = 0;
            setStatus(reason || 'Поток не запускается. Выберите другой канал.', 'error');
            return;
          }
          fatalRetries++;
          nextChannel();
        }, FATAL_RETRY_DELAY);
      });
    }

    var videoEl = document.getElementById('video');
    if (videoEl) {
      videoEl.addEventListener('playing', function () { fatalRetries = 0; });
    }

    var topbar = document.getElementById('topbar');
    var raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 8);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var revealEls = document.querySelectorAll('.reveal');
    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    if (!reduceMotion && revealEls.length) {
      revealEls.forEach(function (el) { el.classList.add('is-pending'); });
      var checkReveal = function () {
        var pending = document.querySelectorAll('.reveal.is-pending:not(.is-visible)');
        for (var i = 0; i < pending.length; i++) {
          if (pending[i].getBoundingClientRect().top < window.innerHeight - 60) {
            pending[i].classList.add('is-visible');
          }
        }
      };
      checkReveal();
      window.addEventListener('scroll', checkReveal, { passive: true });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }

<<<<<<< HEAD
    if (window.ResizeObserver) {
      var wrapEl = document.getElementById('playerWrap');
      if (wrapEl) {
        var ro = new ResizeObserver(function () { updatePlayerHeight(); });
        ro.observe(wrapEl);
      }
    } else {
      window.addEventListener('resize', updatePlayerHeight);
    }
    setTimeout(updatePlayerHeight, 300);

    // ── Кнопка «К плееру» ──────────────────────────────────
    var toPlayerBtn = document.getElementById('toPlayerBtn');
    var toPlayerRaf = null;

    function updateToPlayerBtn() {
      if (!toPlayerBtn) return;
      if (toPlayerRaf) return;
      toPlayerRaf = requestAnimationFrame(function () {
        toPlayerRaf = null;
        if (!playerLoaded) { toPlayerBtn.classList.remove('is-visible'); return; }
        var ps = document.getElementById('playerSection');
        if (!ps || ps.hidden) { toPlayerBtn.classList.remove('is-visible'); return; }
        var wrap = document.getElementById('playerWrap');
        if (wrap && (document.fullscreenElement === wrap ||
                     document.webkitFullscreenElement === wrap)) {
          toPlayerBtn.classList.remove('is-visible');
          return;
        }
        var topbarH = parseFloat(getComputedStyle(document.documentElement)
          .getPropertyValue('--topbar-h')) || 64;
        var rect = ps.getBoundingClientRect();
        // Показать: плеер уехал выше topbar ИЛИ плеер ниже вьюпорта
        var scrolledPast = rect.bottom < topbarH + 40;
        var playerBelow = rect.top > window.innerHeight;
        var show = scrolledPast || playerBelow;
        toPlayerBtn.classList.toggle('is-visible', show);
      });
    }

    if (toPlayerBtn) {
      toPlayerBtn.addEventListener('click', function () {
        var ps = document.getElementById('playerSection');
        if (!ps) return;
        var topbarH = parseFloat(getComputedStyle(document.documentElement)
          .getPropertyValue('--topbar-h')) || 64;
        var y = ps.getBoundingClientRect().top + window.scrollY - topbarH - 8;
        try {
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        } catch (e) {
          window.scrollTo(0, Math.max(0, y));
        }
        if (window.dev4revControls && window.dev4revControls.show) {
          window.dev4revControls.show();
        }
      });

      window.addEventListener('scroll', updateToPlayerBtn, { passive: true });
      window.addEventListener('resize', updateToPlayerBtn);
      document.addEventListener('fullscreenchange', updateToPlayerBtn);
      document.addEventListener('webkitfullscreenchange', updateToPlayerBtn);
      updateToPlayerBtn();
    }

=======
>>>>>>> 08f7507 (updated playlists, new visual)
    var marqueeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(marqueeTimer);
      marqueeTimer = setTimeout(applyMarqueeOverflow, 200);
    });

    if (window.dev4revIsTvActive && window.dev4revIsTvActive()) {
      var cursorTimer = null;
      var hideCursor = function () { document.body.classList.add('is-idle'); };
      var wakeCursor = function () {
        document.body.classList.remove('is-idle');
        clearTimeout(cursorTimer);
        cursorTimer = setTimeout(hideCursor, 3000);
      };
      ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(function (ev) {
        document.addEventListener(ev, wakeCursor, { passive: true });
      });
      wakeCursor();
    }
  });
<<<<<<< HEAD
=======

  // ── Публичный API для кинотеатра ──────────────────────────
  window.dev4revApp = {
    load: function (url) { return load(url); },
    loadChannels: loadChannels,
    playChannel: playChannel,
    next: nextChannel,
    prev: prevChannel,
    unload: unload,
    getChannels: function () { return allChannels.slice(); },
    getVisibleChannels: function () { return visibleChannels.slice(); },
    hasChannels: function () { return allChannels.length > 0; },
    getCurrentIndex: function () { return currentIdx; },
    isPlayerLoaded: function () { return playerLoaded; },
    togglePlayerList: togglePlayerList,
    setPlayerListOpen: setPlayerListOpen,
    setChannelFilter: setChannelFilter,
    renderPlayerChannels: renderPlayerChannels,
    getPlaylistUrl: function () {
      var input = document.getElementById('playlistUrl');
      return currentPlaylistUrl || (input ? input.value.trim() : '');
    },
    setStatus: setStatus
  };
>>>>>>> 08f7507 (updated playlists, new visual)
})();
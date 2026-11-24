(function () {
  'use strict';

  function log(section, e) {
    console.error('[dev4rev/' + section + ']', e);
  }

  var RECENT_KEY = 'dev4rev.tv.recent';
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
  var attachedTorrentFile = null;

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

  function renderChannels(list) {
    var ul = document.getElementById('channelList');
    var empty = document.getElementById('channelEmpty');
    if (!ul) return;

    if (!list.length) {
      ul.innerHTML = '';
      if (empty) empty.hidden = false;
      renderPlayerChannels();
      return;
    }
    if (empty) empty.hidden = true;

    ul.innerHTML = list.map(function (ch) {
      var logoHtml;
      if (ch.logo) {
        logoHtml = '<img class="channel__logo" src="' + esc(ch.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'channel__logo channel__logo--placeholder\',textContent:\'' + esc(initials(ch.name)) + '\'}))">';
      } else {
        logoHtml = '<span class="channel__logo channel__logo--placeholder">' + esc(initials(ch.name)) + '</span>';
      }
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
    var html = '<option value="">Все группы (' + channels.length + ')</option>';
    keys.forEach(function (k) {
      html += '<option value="' + esc(k) + '">' + esc(k) + ' (' + groups[k] + ')</option>';
    });
    selects.forEach(function (sel) { sel.innerHTML = html; });
    syncFilterInputs();
  }

  function renderPlayerChannels() {
    var panel = document.getElementById('playerChannels');
    var list = document.getElementById('playerChannelsList');
    var count = document.getElementById('playerChannelsCount');
    var empty = document.getElementById('playerChannelsEmpty');
    if (!panel || !list) return;

    if (!visibleChannels.length) {
      list.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.textContent = allChannels.length ? 'Каналы не найдены' : 'Сначала загрузите плейлист';
      }
      if (count) {
        var tab = window.dev4revCinema && window.dev4revCinema.getContextTab
          ? window.dev4revCinema.getContextTab().tab : 'channels';
        if (tab === 'channels') count.textContent = '0';
      }
      return;
    }
    if (empty) empty.hidden = true;

    if (count) {
      var activeTab = window.dev4revCinema && window.dev4revCinema.getContextTab
        ? window.dev4revCinema.getContextTab().tab : 'channels';
      if (activeTab === 'channels') count.textContent = visibleChannels.length + '';
    }

    list.innerHTML = visibleChannels.map(function (ch) {
      var logoHtml;
      if (ch.logo) {
        logoHtml = '<img class="player__channel-logo" src="' + esc(ch.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'player__channel-logo player__channel-logo--placeholder\',textContent:\'' + esc(initials(ch.name)) + '\'}))">';
      } else {
        logoHtml = '<span class="player__channel-logo player__channel-logo--placeholder">' + esc(initials(ch.name)) + '</span>';
      }
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
    }).join('');

    if (playerListOpen) {
      var playing = list.querySelector('.player__channel.is-playing');
      if (playing) {
        var offset = playing.offsetTop - list.clientHeight / 2 + playing.offsetHeight / 2;
        list.scrollTop = Math.max(0, offset);
      }
    }
  }

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

    if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
  }

  function togglePlayerList() {
    // Одна кнопка открывает панель на последней выбранной вкладке.
    var tab = window.dev4revCinema && window.dev4revCinema.getContextTab
      ? window.dev4revCinema.getContextTab().tab
      : 'channels';
    setPlayerListOpen(!playerListOpen, tab);
  }

  function setStatus(text, kind) {
    var el = document.getElementById('playlistStatus');
    if (el) {
      el.textContent = text || '';
      el.className = 'playlist-status' + (kind ? ' is-' + kind : '');
    }
  }

  function clearAttachedTorrent(clearInput) {
    attachedTorrentFile = null;
    var fileInput = document.getElementById('torrentFileInput');
    var attachBtn = document.getElementById('attachTorrentBtn');
    if (fileInput) fileInput.value = '';
    if (attachBtn) attachBtn.classList.remove('is-active');
    if (clearInput) {
      var input = document.getElementById('playlistUrl');
      if (input) input.value = '';
    }
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

    window.dev4revPlayer.play(ch.file || ch.url, idx);

    var playerSection = document.getElementById('playerSection');
    var nowPlaying = document.getElementById('nowPlaying');
    var nowGroup = document.getElementById('nowGroup');
    if (playerSection) playerSection.hidden = false;
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

    window.dispatchEvent(new CustomEvent('dev4rev:channelchange', {
      detail: { idx: idx, name: ch.name, group: ch.group, url: ch.url }
    }));

    showControls();
  }

  // Локальный .torrent из скрепки: показываем его как один «канал».
  function playTorrentFile(file, idx) {
    if (!file) return;
    var idxNum = (typeof idx === 'number' && idx >= 0) ? idx : 0;
    var fakeUrl = 'torrent-file:' + file.name;
    var channel = {
      _idx: idxNum,
      name: String(file.name || 'Торрент').replace(/\.torrent$/i, ''),
      url: fakeUrl,
      file: file,
      group: 'Файл',
      logo: ''
    };

    allChannels = [channel];
    visibleChannels = allChannels.slice();
    currentPlaylistUrl = fakeUrl;
    channelQuery = '';
    channelGroup = '';
    playerLoaded = true;

    var input = document.getElementById('playlistUrl');
    if (input) input.value = file.name;
    buildGroups(allChannels);
    filterChannels();

    var playerSection = document.getElementById('playerSection');
    var channelsSection = document.getElementById('channelsSection');
    if (playerSection) playerSection.hidden = false;
    if (channelsSection) channelsSection.hidden = false;

    setStatus('Торрент-файл: ' + file.name, 'ok');
    window.dispatchEvent(new CustomEvent('dev4rev:playlistchange', {
      detail: { url: fakeUrl, count: 1, local: true }
    }));
    playChannel(idxNum);
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
    clearAttachedTorrent(false);
    var loadBtn = document.getElementById('loadBtn');
    var input = document.getElementById('playlistUrl');
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
        window.dispatchEvent(new CustomEvent('dev4rev:playerstate', { detail: { loaded: true } }));
        saveRecent(url, channels.length);
        window.dispatchEvent(new CustomEvent('dev4rev:playlistchange', {
          detail: { url: url, count: channels.length }
        }));
      })
      .catch(function (e) {
        log('load', e);
        setStatus('Не удалось загрузить. Проверьте ссылку и CORS.', 'error');
      })
      .then(function () { if (loadBtn) loadBtn.disabled = false; });

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
  }

  function unload() {
    var playerSection = document.getElementById('playerSection');
    var channelsSection = document.getElementById('channelsSection');

    if (window.dev4revPlayer && window.dev4revPlayer.destroy) window.dev4revPlayer.destroy();

    setPlayerListOpen(false);
    if (playerSection) playerSection.hidden = true;
    if (channelsSection) channelsSection.hidden = true;

    playerLoaded = false;
    currentIdx = -1;
    fatalRetries = 0;
    syncFsHead('—', '');
    window.dispatchEvent(new CustomEvent('dev4rev:playerstate', { detail: { loaded: false } }));

    var shelf = document.getElementById('homeShelf');
    if (shelf) {
      var topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      var rect = shelf.getBoundingClientRect();
      if (rect.top < topbarH || rect.top > window.innerHeight * 0.4) {
        shelf.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  var fsScrollX = 0;
  var fsScrollY = 0;
  var fsWasActive = false;

  function isFullscreen() {
    var wrap = document.getElementById('playerWrap');
    var video = document.getElementById('video');
    if (!wrap) return !!(video && video.webkitDisplayingFullscreen);
    return document.fullscreenElement === wrap ||
      document.webkitFullscreenElement === wrap ||
      !!(video && video.webkitDisplayingFullscreen);
  }

  function updateFsIcon() {
    var btn = document.getElementById('fullscreenBtn');
    if (!btn) return;
    var active = isFullscreen();
    btn.setAttribute('aria-label', active ? 'Выйти из полноэкранного режима' : 'На весь экран');
    btn.setAttribute('title', active ? 'Выйти из полноэкранного режима' : 'На весь экран');
  }

  // После выхода из fullscreen на мобильных браузерах layout viewport иногда
  // остаётся «ландшафтным»: страница выглядит приближенной и сдвинутой.
  // Пересоздаём viewport-meta и возвращаем предыдущую позицию скролла.
  function restoreMobileViewport() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) return;
    var meta = document.head && document.head.querySelector('meta[name="viewport"]');
    if (meta && meta.parentNode) {
      var clone = meta.cloneNode(false);
      meta.parentNode.replaceChild(clone, meta);
    }
    var x = fsScrollX;
    var y = fsScrollY;
    function finish() {
      try { window.scrollTo(x, y); } catch (e) {}
      window.dispatchEvent(new Event('resize'));
    }
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(finish); });
    } else {
      setTimeout(finish, 32);
    }
  }

  function applyFullscreenState(active) {
    updateFsIcon();
    document.body.classList.toggle('player-immersive', active);

    if (active) {
      fsScrollX = window.pageXOffset || 0;
      fsScrollY = window.pageYOffset || 0;
      fsWasActive = true;
      var ch = allChannels.find(function (c) { return c._idx === currentIdx; });
      if (ch) syncFsHead(ch.name, ch.group);
      if (window.dev4revControls) window.dev4revControls.show();
    } else {
      if (playerListOpen) setPlayerListOpen(false);
      if (fsWasActive) {
        fsWasActive = false;
        restoreMobileViewport();
      }
    }
    window.dispatchEvent(new CustomEvent('dev4rev:fullscreenchange', { detail: { active: active } }));
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
    var video = document.getElementById('video');
    if (video && video.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === 'function') {
      try { video.webkitExitFullscreen(); } catch (e) {}
      return;
    }
    if (!isFullscreen()) return;
    var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (exit) { var p = exit.call(document); if (p && p.catch) p.catch(function () {}); }
  }

  function handleFullscreenChange() {
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    var wrap = document.getElementById('playerWrap');
    applyFullscreenState(fsEl === wrap);
  }

  function showControls() {
    if (window.dev4revControls && window.dev4revControls.show) window.dev4revControls.show();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sinceEl = document.getElementById('since');
    var yEl = document.getElementById('y');
    if (sinceEl) sinceEl.textContent = '2023';
    if (yEl) yEl.textContent = new Date().getFullYear();

    renderRecent();

    var input = document.getElementById('playlistUrl');
    var loadBtn = document.getElementById('loadBtn');

    try {
      var recent = getRecent();
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
        if (attachedTorrentFile) {
          playTorrentFile(attachedTorrentFile);
          return;
        }
        if (!input) return;
        var url = readPlaylistInput();
        if (!url) { setStatus('Введите ссылку на плейлист', 'error'); return; }
        load(url);
      });
    }

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (loadBtn) loadBtn.click(); }
      });
      // Вставленную короткую форму tv.dev4rev.ru/... сразу показываем в полном виде.
      input.addEventListener('blur', readPlaylistInput);
      input.addEventListener('input', function () {
        if (attachedTorrentFile) clearAttachedTorrent(false);
      });
    }

    var attachBtn = document.getElementById('attachTorrentBtn');
    var torrentFileInput = document.getElementById('torrentFileInput');
    if (attachBtn && torrentFileInput) {
      torrentFileInput.addEventListener('change', function () {
        var files = torrentFileInput.files || [];
        if (files.length > 1) {
          clearAttachedTorrent(false);
          setStatus('Можно приложить только один торрент-файл', 'error');
          return;
        }
        var file = files[0];
        if (!file) { clearAttachedTorrent(false); return; }
        if (!/\.torrent$/i.test(file.name) && file.type !== 'application/x-bittorrent') {
          clearAttachedTorrent(false);
          setStatus('Нужен файл с расширением .torrent', 'error');
          return;
        }
        attachedTorrentFile = file;
        attachBtn.classList.add('is-active');
        if (input) input.value = file.name;
        setStatus('Торрент приложен: ' + file.name, 'ok');
      });
    }

    (function () {
      var wrap = document.getElementById('playlistLinksHelp');
      var btn = document.getElementById('playlistLinksHelpBtn');
      var tip = document.getElementById('playlistLinksHelpTip');
      if (!wrap || !btn || !tip) return;

      var tipParent = tip.parentNode;
      var tipNext = tip.nextSibling;
      var portaled = false;
      var pinned = false;
      var hideTimer = null;

      // Подсказку переносим в <body>: внутри hero её перекрывают более поздние
      // слои (шапка, плеер, кнопки). Так она всегда остаётся на переднем плане.
      function place() {
        var r = btn.getBoundingClientRect();
        var margin = 12;
        var width = Math.min(520, Math.max(240, window.innerWidth - margin * 2));
        var left = Math.max(margin, Math.min(r.left + r.width / 2 - width / 2,
          window.innerWidth - width - margin));
        var top = r.bottom + 8;
        tip.style.position = 'fixed';
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tip.style.width = width + 'px';
        tip.style.maxHeight = Math.max(160, window.innerHeight - top - margin) + 'px';
        tip.style.overflowY = 'auto';
        tip.style.transform = 'none';
        tip.style.zIndex = '2147483647';
      }

      function show() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!portaled) { document.body.appendChild(tip); portaled = true; }
        place();
        tip.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }

      function restore() {
        if (!portaled) return;
        if (tipNext && tipNext.parentNode === tipParent) tipParent.insertBefore(tip, tipNext);
        else tipParent.appendChild(tip);
        portaled = false;
        tip.removeAttribute('style');
      }

      function hide() {
        if (pinned) return;
        tip.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        restore();
      }

      function scheduleHide() {
        if (pinned) return;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () { hideTimer = null; hide(); }, 140);
      }

      function close() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        pinned = false;
        tip.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        restore();
      }

      wrap.addEventListener('mouseenter', show);
      wrap.addEventListener('mouseleave', scheduleHide);
      tip.addEventListener('mouseenter', show);
      tip.addEventListener('mouseleave', scheduleHide);
      btn.addEventListener('focus', show);
      btn.addEventListener('blur', scheduleHide);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (pinned) { close(); return; }
        pinned = true;
        show();
      });
      document.addEventListener('click', function (e) {
        if (pinned && !wrap.contains(e.target) && !tip.contains(e.target)) close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !tip.hidden) {
          close();
          btn.focus();
        }
      });
      window.addEventListener('resize', function () { if (!tip.hidden) place(); });
      window.addEventListener('scroll', function () { if (!tip.hidden) place(); }, { passive: true });
    }());

    // Ссылка «поделиться плейлистом» может содержать ?playlist=... — загружаем её автоматически.
    try {
      var shared = new URLSearchParams(window.location.search).get('playlist');
      if (shared) {
        if (/^https?:\/\//i.test(shared)) load(shared);
        else if (/^\.?\//.test(shared)) load(new URL(shared, window.location.href).href);
      }
    } catch (e) {}

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

    ['channelSearch', 'playerChannelSearch'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { setChannelFilter(el.value, channelGroup); });
    });
    ['groupFilter', 'playerGroupFilter'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { setChannelFilter(channelQuery, el.value); });
    });

    var list = document.getElementById('channelList');
    if (list) {
      list.addEventListener('click', function (e) {
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
        var btn = e.target.closest('.channel');
        if (!btn) return;
        playChannel(Number(btn.dataset.idx));
      });
    }

    window.addEventListener('dev4rev:favoriteschange', function () {
      renderChannels(visibleChannels);
    });

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

    window.addEventListener('dev4rev:contexttab', function (e) {
      var detail = e.detail || {};
      playerListOpen = !!detail.open;
      syncPlayerListButton();
    });

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
      if (key === 'i' || key === 'и') {
        e.preventDefault();
        if (window.dev4revControls && window.dev4revControls.togglePip) {
          window.dev4revControls.togglePip();
        }
      }
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

  // ── Публичный API для кинотеатра ──────────────────────────
  window.dev4revApp = {
    load: function (url) { return load(url); },
    playTorrentFile: playTorrentFile,
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
    setStatus: setStatus,
    syncFullscreenState: function (active) { applyFullscreenState(!!active); }
  };
})();
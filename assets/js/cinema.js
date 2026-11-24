(function () {
  'use strict';

  var KEY = 'dev4rev.cinema';
  var USER_KEY = 'dev4rev.tv.userCollections';
  var FAV_ID = 'favorites';
  var DATA_URL = './assets/data/collections.json';
  var SEARCH_URL = './assets/data/search-index.json';
  var root = document.documentElement;

  var toggle = document.getElementById('cinemaToggle');
  var exitBtn = document.getElementById('cinemaExitBtn');
  var ambient = document.getElementById('cinemaAmbient');
  var shelfRail = document.getElementById('homeShelfRail');
  var shelfSearch = document.getElementById('shelfSearch');
  var shelfSearchClear = document.getElementById('shelfSearchClear');
  var globalSearchBox = document.getElementById('globalSearchBox');
  var globalResults = document.getElementById('globalSearchResults');
  var searchIndex = { playlists: [], channels: [] };
  var searchIndexPromise = null;
  var shelfEmpty = document.getElementById('shelfEmpty');
  var shelfAllBtn = document.getElementById('shelfAllBtn');
  var saveBtn = document.getElementById('saveCollectionBtn');
  var saveHelpBtn = document.getElementById('saveHelpBtn');
  var saveHelpPopover = document.getElementById('saveHelpPopover');
  var saveDialog = document.getElementById('saveDialog');
  var saveDialogForm = document.getElementById('saveDialogForm');
  var saveDialogName = document.getElementById('saveDialogName');
  var saveDialogOpener = null;
  var saveDialogAction = null;
  var playerContext = document.getElementById('playerContext');
  var contextEyebrow = document.getElementById('contextEyebrow');
  var contextTitle = document.getElementById('contextTitle');
  var contextDesc = document.getElementById('contextDesc');
  var contextInfo = document.getElementById('contextInfo');
  var contextPlaylists = document.getElementById('contextPlaylists');
  var contextPlaylistCount = document.getElementById('contextPlaylistCount');
  var contextTabs = Array.prototype.slice.call(
    document.querySelectorAll('[data-context-tab]'));
  var channelPlaylistNote = document.getElementById('channelPlaylistNote');
  var channelsPane = document.getElementById('playerChannelsPane');
  var collectionsPane = document.getElementById('playerCollectionsPane');
  var playerCollectionsList = document.getElementById('playerCollectionsList');
  var playerCollectionsEmpty = document.getElementById('playerCollectionsEmpty');
  var playerCollectionSearch = document.getElementById('playerCollectionSearch');
  // Единая кнопка в шапке плеера открывает панель плейлистов/каналов.
  var fsListBtn = document.getElementById('fsListBtn');
  // Блок под плеером: вкладки и поиск, дублирующие панель плеера.
  var channelsSection = document.getElementById('channelsSection');
  var sectionTabs = Array.prototype.slice.call(
    (channelsSection || document).querySelectorAll('[data-context-tab]'));
  var channelsChannelFilter = document.getElementById('channelsChannelFilter');
  var channelsPlaylistFilter = document.getElementById('channelsPlaylistFilter');
  var channelsPlaylistList = document.getElementById('channelsPlaylistList');
  var channelsChannelView = document.getElementById('channelsChannelView');
  var channelsPlaylistSearch = document.getElementById('channelsPlaylistSearch');
  var playlistSearch = document.getElementById('playlistSearch');
  var playlistQuery = '';
  var collectionQuery = '';
  var filteredCollectionId = null;
  var channelFilterQuery = '';
  // Панель описания не перекрывает видео по умолчанию — открывается одной кнопкой.
  var contextOpen = false;
  var contextTab = 'playlists';
  var sectionTab = 'channels';

  var staticCollections = [];
  var collections = [];
  var activeId = null;
  var activeCollectionId = null;
  var activePlaylistId = null;
  var loadedIds = {};
  var loadSeq = 0;
  var shelfDebounce = null;

  function isCinema() {
    return root.dataset.cinema === 'on';
  }

  var currentPalette = { accent: '#ff4d6d', accent2: '#7c5cff', source: 'default' };

  function hashString(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hueOf(color) {
    var s = String(color || '').trim();
    var m = s.match(/hsl\(\s*([\d.]+)/i);
    if (m) return parseFloat(m[1]);
    m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return 0;
    var hex = m[1];
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(hex.slice(0, 2), 16) / 255;
    var g = parseInt(hex.slice(2, 4), 16) / 255;
    var b = parseInt(hex.slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, hue = 0;
    if (d) {
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    return hue;
  }

  function paletteFromText(text) {
    var h = hashString(text);
    var hue = h % 360;
    var hue2 = (hue + 70 + ((h >>> 8) % 70)) % 360;
    return {
      accent: 'hsl(' + hue + ' 86% 64%)',
      accent2: 'hsl(' + hue2 + ' 82% 60%)'
    };
  }

  // Оттенок канала слегка сдвигает палитру подборки, но не ломает её тематику.
  function paletteForChannel(seed, base) {
    var p = paletteFromText(seed);
    if (!base || !base.accent) return p;
    var h1 = hueOf(base.accent);
    var h2 = hueOf(p.accent);
    var diff = ((h2 - h1 + 540) % 360) - 180;
    var h = Math.round((h1 + diff * 0.35 + 360) % 360);
    var hb = (h + 70 + ((hashString(seed) >>> 8) % 50)) % 360;
    return {
      accent: 'hsl(' + h + ' 86% 64%)',
      accent2: 'hsl(' + Math.round(hb) + ' 82% 60%)'
    };
  }

  function applyPalette(palette, source) {
    if (!palette) return;
    currentPalette = {
      accent: palette.accent || currentPalette.accent,
      accent2: palette.accent2 || currentPalette.accent2,
      source: source || 'default'
    };

    root.style.setProperty('--glow-1', currentPalette.accent);
    root.style.setProperty('--glow-2', currentPalette.accent2);
    root.style.setProperty('--dynamic-accent', currentPalette.accent);
    root.style.setProperty('--dynamic-accent-2', currentPalette.accent2);
    document.body.dataset.paletteSource = currentPalette.source;

    var el = ambient || document.getElementById('cinemaAmbient');
    if (el) {
      el.style.setProperty('--glow-1', currentPalette.accent);
      el.style.setProperty('--glow-2', currentPalette.accent2);
      el.classList.add('is-live');
    }
    window.dispatchEvent(new CustomEvent('dev4rev:palettechange', {
      detail: { accent: currentPalette.accent, accent2: currentPalette.accent2, source: currentPalette.source }
    }));
  }

  function syncToggle() {
    if (!toggle) return;
    var on = isCinema();
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.setAttribute('aria-label', on ? 'Выйти из кинотеатра' : 'Включить кинотеатр');
    toggle.setAttribute('title', on
      ? 'Кинотеатр включён — нажмите, чтобы выйти'
      : 'Кинотеатр: иммерсивный плеер и подборки');
    toggle.classList.toggle('is-active', on);
  }

  function status(text, kind) {
    var el = document.getElementById('playlistStatus');
    if (!el) return;
    var k = kind === 'err' ? 'error' : kind;
    el.textContent = text || '';
    el.className = 'playlist-status' + (k ? ' is-' + k : '');
  }

  function setCinema(on, opts) {
    var o = opts || {};
    if (on && root.dataset.tvMode === 'on') {
      window.dispatchEvent(new CustomEvent('dev4rev:tvchange', { detail: { active: false } }));
    }

    var wasOn = isCinema();
    var value = on ? 'on' : 'off';
    root.dataset.cinema = value;
    try {
      if (on) localStorage.setItem(KEY, 'on');
      else localStorage.removeItem(KEY);
    } catch (e) {}
    syncToggle();

    if (!wasOn || o.force) {
      window.dispatchEvent(new CustomEvent('dev4rev:cinemachange', {
        detail: { active: on, autoplay: !!o.autoplay, collectionId: o.collectionId || null }
      }));
    }

    if (on) {
      if (o.collectionId) {
        return openCollection(o.collectionId, {
          silent: true,
          autoplay: o.autoplay !== false,
          playlistId: o.playlistId
        });
      }
      if (!window.dev4revApp || !window.dev4revApp.isPlayerLoaded()) return openFirstCollection();
    } else if (window.dev4revControls && window.dev4revControls.hide) {
      window.dev4revControls.hide();
    }
    return Promise.resolve(true);
  }

  var ICONS = {
    'tv': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 21h8M12 19v2M7 9l3 3-3 3"/></svg>',
    'cartoons': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 3v-4a3 3 0 0 1-1-2V8Z"/><path d="M9 10h.01M15 10h.01M9.5 13c.8.8 1.7 1.2 2.5 1.2s1.7-.4 2.5-1.2"/></svg>',
    'kids': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8.5 14.5c1 1.4 2.2 2.1 3.5 2.1s2.5-.7 3.5-2.1"/></svg>',
    'movies': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 10h4M17 10h4M3 14h4M17 14h4"/></svg>',
    'series': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 8h4M7 12h8"/></svg>',
    'sports': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3c2.5 2.2 4 5.4 4 9s-1.5 6.8-4 9c-2.5-2.2-4-5.4-4-9s1.5-6.8 4-9ZM3 12h18"/></svg>',
    'news': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5Z"/><path d="M8 9h7M8 13h7M8 17h4M19 9h1v8a2 2 0 0 1-2 2"/></svg>',
    'music': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    'documentary': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v6.5M12 15.5V22M2 12h6.5M15.5 12H22"/></svg>',
    'entertainment': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="12" rx="3"/><path d="m10 10 5 3-5 3v-6ZM7 4l2 2M17 4l-2 2"/></svg>',
    'new-year': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v3M5 5l2 2M19 5l-2 2M2 12h3M19 12h3"/><path d="M12 22c-4.4 0-8-3.1-8-7 0-3 2.3-5.6 5.5-6.6L12 6l2.5 2.4C17.7 9.4 20 12 20 15c0 3.9-3.6 7-8 7Z"/><path d="M9 15h.01M12 12h.01M15 15h.01M10.5 18h3"/></svg>',
    'valentine': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/></svg>',
    'defender': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    'women': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M12 12v9m0 0c-2.5-2.2-5-3.2-8-3m8 3c2.5-2.2 5-3.2 8-3M4 8c0-1.5 1-2.5 2.5-2.5S9 6.5 9 8M15 8c0-1.5 1-2.5 2.5-2.5S20 6.5 20 8"/></svg>',
    'victory': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c4-1.6 7-5.2 7-10V5l-7-3-7 3v6c0 4.8 3 8.4 7 10Z"/><path d="M9 11h6M12 8v6"/></svg>',
    'halloween': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12a10 10 0 1 1 20 0c0 5-4 9-10 9S2 17 2 12Z"/><path d="M8 11h.01M16 11h.01M8.5 16c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5M5 6l3-3M19 6l-3-3"/></svg>',
    'classic': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/><path d="M8 15c1.2-1 2.6-1.5 4-1.5s2.8.5 4 1.5M2 9l3-2M22 9l-3-2"/></svg>',
    'comedy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14c1.2 1.8 2.6 2.7 4 2.7s2.8-.9 4-2.7M8.5 9h.01M15.5 9h.01"/></svg>',
    'world': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
    'russian': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M12 8.5 13 11l2.7.2-2 1.7.6 2.6-2.3-1.4-2.3 1.4.6-2.6-2-1.7 2.7-.2z"/></svg>',
    'family': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 14.5c2.8 0 5 2 5 5"/></svg>',
    'anime': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8c3-3 15-3 18 0v8c-3 3-15 3-18 0z"/><path d="M8 10h.01M16 10h.01M9 14c1 1.2 2 1.8 3 1.8s2-.6 3-1.8M8 5l1-3M16 5l-1-3"/></svg>',
    'star': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.8 3.1 1.1-6.5L2.6 9.8l6.5-.9z"/></svg>',
    'bookmark': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h9a2 2 0 0 1 2 2v14l-6-4-6 4V6a2 2 0 0 1 1-2z"/></svg>'
  };

  function collectionIcon(c) {
    return ICONS[c.id] || ICONS[c.icon] || ICONS.tv;
  }

  // Общедоступные линейные иконки (стиль Lucide), подобранные по смыслу
  // каждой подборки. Хранятся локально — карточки не делают сетевых запросов.
  var P = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  function art(paths) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" ' + P + '>' + paths + '</svg>';
  }
  var POSTERS = {
    'ru-audience': art('<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="6" y="9" width="12" height="6" rx="1"/><path d="m12 9.8 1 2.1 2.2.2-1.7 1.5.5 2.2-2-1.1-2 1.1.5-2.2-1.7-1.5 2.2-.2z"/>'),
    'franchise-films': art('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m3 12 18-4M7 8l2-4 4 2-2 4M14 6l4-2 2 4-4 2"/><path d="m12 13 .8 1.7 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2z"/>'),
    'tv': art('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 21h8M12 19v2m-2-12 5 3-5 3z"/>'),
    'russian': art('<path d="M4 5h16v14H4z"/><path d="m12 8.5 1 2.5 2.6.2-2 1.7.6 2.6-2.2-1.4-2.2 1.4.6-2.6-2-1.7 2.6-.2z"/>'),
    'world': art('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>'),
    'cartoons': art('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"/>'),
    'kids': art('<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8 14.5c1.2 1.5 2.5 2.2 4 2.2s2.8-.7 4-2.2"/>'),
    'family': art('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 14.5c2.8 0 5 2 5 5"/>'),
    'movies': art('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m3 12 18-4M7 8l2-4 4 2-2 4M14 6l4-2 2 4-4 2"/>'),
    'series': art('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M3 9h18M9 13h6"/>'),
    'anime': art('<path d="M4 8c4-3 12-3 16 0v8c-4 3-12 3-16 0z"/><circle cx="9.5" cy="11.5" r="1"/><circle cx="14.5" cy="11.5" r="1"/><path d="M9 14.5c1 1 2 1.5 3 1.5s2-.5 3-1.5M9 4l1-2M15 4l-1-2"/>'),
    'sports': art('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8"/>'),
    'news': art('<path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2z"/><path d="M8 9h7M8 13h7M8 17h4M19 9h1v8a2 2 0 0 1-2 2"/>'),
    'music': art('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
    'documentary': art('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3z"/><circle cx="9" cy="12" r="2"/>'),
    'entertainment': art('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    'classic': art('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="5.5" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/><circle cx="12" cy="18.5" r="1.5"/><circle cx="5.5" cy="12" r="1.5"/>'),
    'comedy': art('<circle cx="12" cy="12" r="9"/><path d="M7.5 13c0 2 1.2 3.2 2.5 3.2s2.5-1.2 2.5-3.2M11.5 13c0 2 1.2 3.2 2.5 3.2s2.5-1.2 2.5-3.2M8 9h.01M16 9h.01"/>'),
    'new-year': art('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    'valentine': art('<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/>'),
    'defender': art('<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>'),
    'women': art('<circle cx="12" cy="12" r="2"/><path d="M12 10c-3-4-7-2-6 1 .6 2 3 2 4 1M12 14c3 4 7 2 6-1-.6-2-3-2-4-1M10 12c-4-3-2-7 1-6 2 .6 2 3 1 4M14 12c4 3 2 7-1 6-2-.6-2-3-1-4"/>'),
    'victory': art('<circle cx="12" cy="15" r="5"/><path d="m8 3 3 6M16 3l-3 6"/><path d="m12 12.5 1 2 2.2.3-1.6 1.5.4 2.2L12 17.5l-2 1.5.4-2.2-1.6-1.5 2.2-.3z"/>'),
    'halloween': art('<path d="M5 20v-9a7 7 0 0 1 14 0v9l-2.3-1.5L14.3 20 12 18.5 9.7 20 7.3 18.5z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>'),
    'star': art('<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.8 3.1 1.1-6.5L2.6 9.8l6.5-.9z"/>'),
    'bookmark': art('<path d="M6 4h9a2 2 0 0 1 2 2v14l-6-4-6 4V6a2 2 0 0 1 1-2z"/>')
  };

  // Иконки карточек берём из публичного CDN (Iconify, набор Lucide).
  var CDN_ICONS = {
    'ru-audience': 'tv',
    'franchise-films': 'clapperboard',
    'tv': 'tv',
    'russian': 'flag',
    'world': 'globe',
    'cartoons': 'smile',
    'kids': 'baby',
    'family': 'users',
    'movies': 'clapperboard',
    'series': 'list-video',
    'anime': 'sparkles',
    'sports': 'trophy',
    'news': 'newspaper',
    'music': 'music',
    'documentary': 'camera',
    'entertainment': 'party-popper',
    'classic': 'film',
    'comedy': 'laugh',
    'new-year': 'sparkles',
    'valentine': 'heart',
    'defender': 'shield',
    'women': 'flower-2',
    'victory': 'medal',
    'halloween': 'ghost',
    'star': 'star',
    'bookmark': 'bookmark'
  };

  function collectionArt(c) {
    var name = CDN_ICONS[c.id] || CDN_ICONS[c.icon] || 'tv';
    // Без loading="lazy": иконки небольшие, а отложенная загрузка в
    // горизонтальной полке оставляет карточки пустыми до прокрутки.
    return '<img class="poster__icon-img" alt="" ' +
      'src="https://api.iconify.design/lucide/' + name +
      '.svg?color=%23ffffff&width=96&height=96">';
  }

  // Если CDN недоступен, карточка остаётся с локальной SVG-иконкой.
  function collectionArtFallback(c) {
    return POSTERS[c.id] || POSTERS[c.icon] || ICONS[c.id] || ICONS[c.icon] || ICONS.tv;
  }

  // «Всегда» не несёт информации — в карточках и подсказках не показываем его.
  function displaySeason(c) {
    var value = String((c && c.seasonLabel) || '').trim();
    return /^всегда$/i.test(value) ? '' : value;
  }

  function collectionById(id) {
    for (var i = 0; i < collections.length; i++) {
      if (collections[i].id === id) return collections[i];
    }
    return null;
  }

  // Подборка может содержать несколько плейлистов. Старый формат с одним
  // полем `file` поддерживается как подборка с одним плейлистом.
  function playlistsOf(c) {
    if (!c) return [];
    if (Array.isArray(c.playlists) && c.playlists.length) return c.playlists;
    if (c.file) return [{ id: c.id, name: c.title, file: c.file }];
    return [];
  }

  function sameUrl(a, b) {
    if (a === b) return true;
    try { return new URL(a, document.baseURI).href === new URL(b, document.baseURI).href; }
    catch (e) { return false; }
  }

  function findPlaylistByUrl(url) {
    if (!url) return null;
    for (var i = 0; i < collections.length; i++) {
      var list = playlistsOf(collections[i]);
      for (var j = 0; j < list.length; j++) {
        if (sameUrl(list[j].url || list[j].file, url) || sameUrl(list[j].file, url)) {
          return { collection: collections[i], playlist: list[j] };
        }
      }
    }
    return null;
  }

  function playlistLabel(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' плейлист';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' плейлиста';
    return n + ' плейлистов';
  }

  function channelLabel(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' канал';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' канала';
    return n + ' каналов';
  }

  // ─── Сезонные подборки: не скрываются, а поднимаются выше ──
  function inSeason(c) {
    var windows = c && c.season;
    if (!Array.isArray(windows) || !windows.length) return false;
    var d = new Date();
    var md = ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    for (var i = 0; i < windows.length; i++) {
      var w = windows[i];
      if (!w || !w.from || !w.to) continue;
      if (w.from <= w.to) {
        if (md >= w.from && md <= w.to) return true;
      } else if (md >= w.from || md <= w.to) {
        return true;
      }
    }
    return false;
  }

  // ─── Избранное и собственные подборки в localStorage ────────
  function normalizeLocalPlaylist(p, i) {
    var channels = Array.isArray(p.channels) ? p.channels : [];
    return {
      id: String(p.id || ('p' + (i + 1))),
      name: String(p.name || ('Плейлист ' + (i + 1))),
      file: String(p.file || ''),
      url: String(p.url || (channels.length ? 'local:' + p.id : (p.file || ''))),
      channels: channels,
      local: !!p.local || channels.length > 0,
      count: Number(p.count) || channels.length || 0
    };
  }

  function normalizeUserCollection(c) {
    var out = {
      id: String(c.id || ('user-' + Date.now())),
      title: String(c.title || 'Моя подборка'),
      icon: String(c.icon || 'bookmark'),
      desc: String(c.desc || 'Сохранённая вами подборка'),
      seasonLabel: String(c.seasonLabel || 'моя'),
      accent: String(c.accent || '#60a5fa'),
      accent2: String(c.accent2 || '#a78bfa'),
      tags: Array.isArray(c.tags) ? c.tags.slice() : ['моя подборка'],
      custom: true,
      playlists: []
    };
    var src = Array.isArray(c.playlists) ? c.playlists : [];
    if (!src.length && c.file) {
      src = [{ id: out.id + '-p', name: out.title, file: c.file, channels: c.channels || [] }];
    }
    src.forEach(function (p, i) { if (p) out.playlists.push(normalizeLocalPlaylist(p, i)); });
    return out;
  }

  function readUserCollections() {
    try {
      var raw = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (c) { return c && c.id && c.title; }).map(normalizeUserCollection);
    } catch (e) { return []; }
  }

  function writeUserCollections(list) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(list || [])); } catch (e) {}
  }

  function favoritesCollection() {
    var favs = window.dev4revFavorites ? window.dev4revFavorites.get() : [];
    return {
      id: FAV_ID,
      title: 'Избранное',
      icon: 'star',
      desc: 'Каналы, отмеченные звездой',
      seasonLabel: favs.length ? channelLabel(favs.length) : 'пока пусто',
      accent: '#facc15',
      accent2: '#f472b6',
      tags: ['избранное', 'любимые каналы', 'моё'],
      favorite: true,
      playlists: [normalizeLocalPlaylist({
        id: 'fav-list',
        name: 'Избранные каналы',
        url: 'local:favorites',
        channels: favs,
        local: true,
        count: favs.length
      }, 0)]
    };
  }

  function rebuildCollections() {
    collections = [favoritesCollection()].concat(readUserCollections(), staticCollections);
  }

  function orderedCollections(query) {
    var list = filteredCollections(query);
    var pinned = [], seasonal = [], rest = [];
    list.forEach(function (c) {
      if (c.favorite || c.custom) pinned.push(c);
      else if (inSeason(c)) seasonal.push(c);
      else rest.push(c);
    });
    return pinned.concat(seasonal, rest);
  }

  function openSaveDialog(defaultName, onSave) {
    if (!saveDialog || !saveDialogForm || !saveDialogName) return;
    saveDialogAction = onSave;
    saveDialogOpener = document.activeElement;
    saveDialogName.value = defaultName || '';
    closeSaveHelp();
    if (window.dev4revClosePlayerDialogs) window.dev4revClosePlayerDialogs();
    saveDialog.hidden = false;
    document.body.classList.add('is-dialog-open');
    saveDialogName.focus();
    saveDialogName.select();
    // В фоновой вкладке rAF может не вызваться — повторяем при первом кадре.
    requestAnimationFrame(function () {
      if (!saveDialog.hidden) { saveDialogName.focus(); saveDialogName.select(); }
    });
  }

  function closeSaveDialog() {
    if (!saveDialog || saveDialog.hidden) return;
    saveDialog.hidden = true;
    document.body.classList.remove('is-dialog-open');
    saveDialogAction = null;
    if (saveDialogOpener && typeof saveDialogOpener.focus === 'function') {
      saveDialogOpener.focus();
    }
    saveDialogOpener = null;
  }

  function submitSaveDialog(e) {
    e.preventDefault();
    if (!saveDialogName) return;
    var name = String(saveDialogName.value || '').trim();
    if (!name) { saveDialogName.focus(); return; }
    var action = saveDialogAction;
    closeSaveDialog();
    if (typeof action === 'function') action(name);
  }

  function saveCurrentCollection() {
    var app = window.dev4revApp;
    if (!app || !app.hasChannels()) {
      status('Сначала загрузите плейлист', 'warn');
      return;
    }

    var channels = app.getChannels().map(function (ch) {
      return { name: ch.name, url: ch.url, logo: ch.logo, group: ch.group };
    });
    var url = app.getPlaylistUrl() || '';
    var current = collectionById(activeCollectionId);
    var found = findPlaylistByUrl(url);
    var defaultName = current && current.id !== FAV_ID
      ? current.title
      : (found ? found.collection.title : 'Моя подборка');

    // Повторное сохранение внутри моей подборки добавляет в неё плейлист.
    if (current && current.custom && current.id !== FAV_ID) {
      var all = readUserCollections();
      for (var i = 0; i < all.length; i++) {
        if (all[i].id !== current.id) continue;
        var pid = current.id + '-' + Date.now();
        var addedPlaylist = normalizeLocalPlaylist({
          id: pid,
          name: (found ? found.playlist.name : defaultName),
          file: url,
          url: 'local:' + pid,
          channels: channels,
          local: true,
          count: channels.length
        }, all[i].playlists.length);
        all[i].playlists.push(addedPlaylist);
        writeUserCollections(all);
        rebuildCollections();
        activeCollectionId = current.id;
        activePlaylistId = pid;
        renderHomeShelf(shelfSearch ? shelfSearch.value : '');
        renderPlaylistSwitch();
        status('Добавлено в «' + current.title + '»', 'ok');
        return;
      }
    }

    openSaveDialog(defaultName, function (name) {
    var now = Date.now();
    var id = 'user-' + now;
    var pl = normalizeLocalPlaylist({
      id: 'p-' + now,
      name: found ? found.playlist.name : name,
      file: url,
      url: 'local:p-' + now,
      channels: channels,
      local: true,
      count: channels.length
    }, 0);

    var col = normalizeUserCollection({
      id: id,
      title: name,
      icon: 'bookmark',
      desc: 'Сохранённая вами подборка · ' + channelLabel(channels.length),
      seasonLabel: 'моя',
      accent: currentPalette.accent,
      accent2: currentPalette.accent2,
      tags: ['моя подборка', 'сохранённое', name.toLowerCase()],
      playlists: [pl]
    });

    var stored = readUserCollections();
    stored.unshift(col);
    writeUserCollections(stored);
    rebuildCollections();
    activeId = id;
    activeCollectionId = id;
    activePlaylistId = pl.id;
    renderHomeShelf(shelfSearch ? shelfSearch.value : '');
    renderPlaylistSwitch();
    status('Подборка сохранена: ' + name, 'ok');
    });
  }

  function removeUserCollection(id) {
    var stored = readUserCollections().filter(function (c) { return c.id !== id; });
    writeUserCollections(stored);
    if (activeCollectionId === id) {
      activeId = null;
      activeCollectionId = null;
      activePlaylistId = null;
    }
    rebuildCollections();
    renderHomeShelf(shelfSearch ? shelfSearch.value : '');
    renderPlaylistSwitch();
    status('Подборка удалена', 'ok');
  }

  function activePlaylistOf(c, list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === activePlaylistId) return list[i];
    }
    return list[0] || null;
  }

  function playlistChannelCount(p) {
    if (!p) return 0;
    if (Array.isArray(p.channels)) return p.channels.length;
    return Number(p.count) || 0;
  }

  function playlistItemHtml(p, isActive) {
    var count = playlistChannelCount(p);
    return '<button type="button" class="playlist-item' + (isActive ? ' is-active' : '') + '"' +
      ' data-playlist-id="' + escapeAttr(p.id) + '" aria-pressed="' + (isActive ? 'true' : 'false') + '"' +
      ' title="' + escapeAttr(p.name + (p.note ? ' — ' + p.note : '')) + '">' +
      '<span class="playlist-item__check" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>' +
      '</span>' +
      '<span class="playlist-item__name">' + escapeHtml(p.name) + '</span>' +
      '<span class="playlist-item__sub">' +
        (p.label ? '<span class="playlist-item__label">' + escapeHtml(p.label) + '</span> ' : '') +
        '<span class="playlist-item__meta">' + (count ? channelLabel(count) : 'каналы уточняются') + '</span>' +
      '</span>' +
      '<span class="playlist-item__note">' + escapeHtml(p.note || '') + '</span>' +
    '</button>';
  }

  function filteredPlaylists(c, list) {
    var q = String(playlistQuery || '').toLowerCase().trim();
    if (!c || !q) return list;
    return list.filter(function (p) {
      return String(p.name || '').toLowerCase().indexOf(q) !== -1 ||
             String(p.note || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  // Блок под плеером и панель плеера показывают одно и то же: у каналов
  // общий запрос живёт в main.js, у плейлистов — здесь.
  function syncSection() {
    var tab = (sectionTab === 'channels') ? 'channels' : 'playlists';
    var isChannels = tab === 'channels';
    var isPlaylists = tab === 'playlists';
    var channelInput = document.getElementById('playerChannelSearch');
    if (channelInput && channelInput.value.toLowerCase().trim() !== channelFilterQuery) {
      channelFilterQuery = channelInput.value.toLowerCase().trim();
    }
    var channelSearch = document.getElementById('channelSearch');
    if (channelSearch && document.activeElement !== channelSearch &&
        channelSearch.value !== channelFilterQuery) {
      channelSearch.value = channelFilterQuery;
    }
    if (channelsPlaylistSearch && document.activeElement !== channelsPlaylistSearch &&
        channelsPlaylistSearch.value !== playlistQuery) {
      channelsPlaylistSearch.value = playlistQuery;
    }
    if (playlistSearch && document.activeElement !== playlistSearch &&
        playlistSearch.value !== playlistQuery) {
      playlistSearch.value = playlistQuery;
    }
    if (playerCollectionSearch && document.activeElement !== playerCollectionSearch &&
        playerCollectionSearch.value !== collectionQuery) {
      playerCollectionSearch.value = collectionQuery;
    }
    if (channelsChannelFilter) channelsChannelFilter.hidden = !isChannels;
    if (channelsPlaylistFilter) channelsPlaylistFilter.hidden = !isPlaylists;
    if (channelsPlaylistList) channelsPlaylistList.hidden = !isPlaylists;
    if (channelsChannelView) channelsChannelView.hidden = !isChannels;
    if (channelsSection) {
      channelsSection.querySelectorAll('[data-context-tab]').forEach(function(b){
        var t=b.dataset.contextTab; var sel=(t==='channels')?isChannels:isPlaylists;
        b.classList.toggle('is-active', sel);
        b.setAttribute('aria-selected', sel?'true':'false');
      });
    }
  }

  function setPlaylistQuery(value) {
    playlistQuery = String(value || '');
    if (playlistSearch && document.activeElement !== playlistSearch &&
        playlistSearch.value !== playlistQuery) {
      playlistSearch.value = playlistQuery;
    }
    if (channelsPlaylistSearch && document.activeElement !== channelsPlaylistSearch &&
        channelsPlaylistSearch.value !== playlistQuery) {
      channelsPlaylistSearch.value = playlistQuery;
    }
    var c = collectionById(activeCollectionId);
    renderPlayerContext(c, playlistsOf(c));
  }

  function setCollectionQuery(value) {
    collectionQuery = String(value || '');
    if (playerCollectionSearch && document.activeElement !== playerCollectionSearch &&
        playerCollectionSearch.value !== collectionQuery) {
      playerCollectionSearch.value = collectionQuery;
    }
    renderCollectionsPane();
  }

  function filteredCollectionsList() {
    var q = String(collectionQuery || '').toLowerCase().trim();
    var list = collections.slice();
    if (!q) return list;
    return list.filter(function (c) {
      return String(c.title || '').toLowerCase().indexOf(q) !== -1 ||
             String(c.desc || '').toLowerCase().indexOf(q) !== -1 ||
             String((c.tags || []).join(' ')).toLowerCase().indexOf(q) !== -1;
    });
  }

  function collectionItemHtml(c) {
    var active = c.id === activeCollectionId;
    var count = playlistsOf(c).length;
    return '<button type="button" class="collection-pick' + (active ? ' is-active' : '') + '"' +
      ' data-collection-id="' + escapeAttr(c.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
      '<span class="collection-pick__icon">' + (c.thumb ? '<img src="' + escapeAttr(c.thumb) + '" alt="" loading="lazy" decoding="async">' : collectionArtFallback(c)) + '</span>' +
      '<span class="collection-pick__body">' +
        '<span class="collection-pick__title">' + escapeHtml(c.title || '') + '</span>' +
        '<span class="collection-pick__meta">' + escapeHtml(playlistLabel(count)) + (c.user ? ' · моя' : '') + '</span>' +
      '</span>' +
      '<span class="collection-pick__check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg></span>' +
    '</button>';
  }

  function renderCollectionsPane() {
    var list = filteredCollectionsList();
    var html = list.length ? list.map(collectionItemHtml).join('') : '';
    if (playerCollectionsList) playerCollectionsList.innerHTML = html;
    if (playerCollectionsEmpty) playerCollectionsEmpty.hidden = list.length > 0;
  }

  // Чистая отрисовка содержимого панели. Вызывается и из main.js, когда
  // выдвижная панель уже открыта/закрыта — поэтому сама её не переключает.
  function setContextTab(tab, open) {
    if (tab === 'playlists' || tab === 'channels' || tab === 'collections') contextTab = tab;
    if (typeof open === 'boolean') contextOpen = open;
    var c = collectionById(activeCollectionId);
    renderPlayerContext(c, playlistsOf(c));
    window.dispatchEvent(new CustomEvent('dev4rev:contexttab', {
      detail: { open: contextOpen, tab: contextTab }
    }));
  }

  // Открыть/закрыть выдвижную панель с нужной вкладкой.
  function setContextOpen(open, tab) {
    contextOpen = !!open;
    if (tab === 'playlists' || tab === 'channels' || tab === 'collections') contextTab = tab;
    if (window.dev4revApp && window.dev4revApp.setPlayerListOpen) {
      window.dev4revApp.setPlayerListOpen(contextOpen, contextTab);
    } else {
      setContextTab(contextTab, contextOpen);
    }
  }

  function renderPlayerContext(c, list) {
    if (!playerContext) return;
    if (!c) {
      if (contextPlaylists) contextPlaylists.hidden = true;
      if (channelsPane) channelsPane.hidden = true;
      if (fsListBtn) {
        fsListBtn.setAttribute('aria-expanded', 'false');
        fsListBtn.classList.remove('is-active');
      }
      if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();
      syncSection();
      return;
    }
    if (filteredCollectionId !== activeCollectionId) {
      filteredCollectionId = activeCollectionId;
      playlistQuery = '';
      if (playlistSearch) playlistSearch.value = '';
    }
    var shown = filteredPlaylists(c, list);
    var isCollections = contextTab === 'collections';
    var isChannels = contextTab === 'channels';
    var isPlaylists = !isCollections && !isChannels;
    playerContext.hidden = !isPlaylists;
    playerContext.dataset.tab = contextTab;
    contextTabs.forEach(function (tabBtn) {
      if (channelsSection && channelsSection.contains(tabBtn)) return;
      var selected = tabBtn.dataset.contextTab === contextTab;
      tabBtn.classList.toggle('is-active', selected);
      tabBtn.setAttribute('aria-selected', selected ? 'true' : 'false');
      tabBtn.tabIndex = selected ? 0 : -1;
    });
    if (fsListBtn) {
      fsListBtn.setAttribute('aria-expanded', contextOpen ? 'true' : 'false');
      fsListBtn.classList.toggle('is-active', contextOpen);
    }
    if (window.dev4revSyncPlayerDialogs) window.dev4revSyncPlayerDialogs();

    var active = activePlaylistOf(c, list);
    var count = playlistChannelCount(active);
    if (contextEyebrow) contextEyebrow.textContent = 'Подборка';
    if (contextTitle) contextTitle.textContent = c.title;
    if (contextDesc) contextDesc.textContent = c.desc || '';
    if (contextInfo) {
      contextInfo.innerHTML = active
        ? '<span>Сейчас: <strong>' + escapeHtml(active.name) + '</strong></span>' +
          '<span class="context-dot">·</span>' +
          '<span>' + (count ? channelLabel(count) : 'каналы загружаются') + '</span>' +
          (list.length > 1 ? '<span class="context-dot">·</span><span>' + playlistLabel(list.length) + '</span>' : '') +
          (active.note ? '<span class="player__context-note">' + escapeHtml(active.note) + '</span>' : '')
        : '';
    }
    if (contextPlaylists) {
      contextPlaylists.hidden = !isPlaylists;
      if (contextPlaylistCount) {
        contextPlaylistCount.textContent = shown.length !== list.length
          ? shown.length + ' / ' + list.length
          : playlistLabel(list.length);
      }
    }
    var panelCount = document.getElementById('playerChannelsCount');
    if (panelCount) {
      panelCount.textContent = isCollections ? (filteredCollectionsList().length + '')
        : isChannels ? (panelCount.textContent || '—')
        : (shown.length + '');
    }
    if (channelsPane) channelsPane.hidden = !isChannels;
    if (collectionsPane) collectionsPane.hidden = !isCollections;
    if (channelPlaylistNote) {
      channelPlaylistNote.textContent = active
        ? 'Плейлист: ' + active.name + (list.length > 1 ? ' · ' + playlistLabel(list.length) + ' в подборке' : '')
        : '';
    }
    document.querySelectorAll('[data-playlist-list="context"], [data-playlist-list="channels"]').forEach(function (box) {
      box.innerHTML = shown.length
        ? shown.map(function (p) {
            return playlistItemHtml(p, !!active && p.id === active.id);
          }).join('')
        : '<p class="playlist-list__empty">Плейлисты не найдены</p>';
    });
    renderCollectionsPane();
    syncSection();
  }

  function renderPlaylistSwitch() {
    var c = collectionById(activeCollectionId);
    var list = playlistsOf(c);
    var show = !!c && list.length > 1;
    var active = activePlaylistOf(c, list);

    document.querySelectorAll('[data-playlist-switch]').forEach(function (sel) {
      sel.hidden = !show;
      if (!show) return;
      if (sel.dataset.builtFor !== activeCollectionId) {
        sel.innerHTML = list.map(function (p) {
          return '<option value="' + escapeAttr(p.id) + '">' +
            escapeHtml(p.name) + (p.count ? ' · ' + p.count : '') + '</option>';
        }).join('');
        sel.dataset.builtFor = activeCollectionId;
      }
      if (sel.value !== activePlaylistId) sel.value = activePlaylistId;
    });

    // Вся подстрока подборки — один тикер: разделитель и название плейлиста
    // прокручиваются вместе, а не отдельными кусками.
    var subline = (c ? c.title : 'Подборка') +
      (active && active.name ? ' · ' + active.name : '');
    document.querySelectorAll('.player__subline').forEach(function (el) {
      if (window.dev4revTicker) window.dev4revTicker.set(el, subline);
      else el.textContent = subline;
    });

    renderPlayerContext(c, list);
  }

  function collectionStyle(c) {
    return '--c1:' + escapeAttr(c.accent || '#ff4d6d') +
      ';--c2:' + escapeAttr(c.accent2 || '#7c5cff');
  }

  function filteredCollections(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(function (c) {
      var hay = [c.title, c.desc, c.icon, (c.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function ensureSearchIndex() {
    if (!searchIndexPromise) {
      searchIndexPromise = fetch(SEARCH_URL, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        searchIndex = {
          playlists: Array.isArray(data.playlists) ? data.playlists : [],
          channels: Array.isArray(data.channels) ? data.channels : []
        };
        return searchIndex;
      }).catch(function () {
        return searchIndex;
      });
    }
    return searchIndexPromise;
  }

  function searchScore(text, q) {
    var s = String(text || '').toLowerCase();
    var i = s.indexOf(q);
    if (i < 0) return -1;
    if (i === 0) return 0;
    return /[\s·(/;,]/.test(s.charAt(i - 1)) ? 1 : 2;
  }

  function bestScore(values, q) {
    var scores = [];
    for (var i = 0; i < values.length; i++) {
      var s = searchScore(values[i], q);
      if (s >= 0) scores.push(s);
    }
    return scores.length ? Math.min.apply(null, scores) : -1;
  }

  function highlight(text, q) {
    var s = String(text || '');
    var i = s.toLowerCase().indexOf(q);
    if (i < 0 || !q) return escapeHtml(s);
    return escapeHtml(s.slice(0, i)) + '<mark>' +
      escapeHtml(s.slice(i, i + q.length)) + '</mark>' + escapeHtml(s.slice(i + q.length));
  }

  function searchSection(label, items, count) {
    if (!items.length) return '';
    return '<div class="global-search__section">' +
      '<div class="global-search__label">' + escapeHtml(label) +
      (count ? ' <span class="mono">' + count + '</span>' : '') + '</div>' +
      items.join('') + '</div>';
  }

  function closeSaveHelp() {
    if (saveHelpPopover) saveHelpPopover.hidden = true;
    if (saveHelpBtn) saveHelpBtn.setAttribute('aria-expanded', 'false');
  }

  function closeGlobalResults() {
    if (globalResults) {
      globalResults.hidden = true;
      globalResults.innerHTML = '';
    }
    if (shelfSearch) shelfSearch.setAttribute('aria-expanded', 'false');
  }

  function syncShelfClear() {
    if (shelfSearchClear) {
      shelfSearchClear.hidden = !shelfSearch || !shelfSearch.value;
    }
  }

  function clearShelfSearch() {
    if (!shelfSearch) return;
    shelfSearch.value = '';
    syncShelfClear();
    closeGlobalResults();
    if (shelfDebounce) clearTimeout(shelfDebounce);
    renderHomeShelf('');
    shelfSearch.focus();
  }

  function onGlobalSearchKeydown(e) {
    if (!globalResults || globalResults.hidden) return;
    var items = Array.prototype.slice.call(
      globalResults.querySelectorAll('.global-search__item'));
    var index = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[index < 0 ? 0 : Math.min(index + 1, items.length - 1)].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[index <= 0 ? items.length - 1 : index - 1].focus();
    }
  }

  function renderGlobalResults(query) {
    if (!globalResults) return;
    var q = String(query || '').trim().toLowerCase();
    if (q.length < 2) { closeGlobalResults(); return; }

    // Прокрутку страницы здесь не делаем: фокус в поле уже возвращает его
    // в видимую область, а принудительный center дёргает экран при вводе.

    var collectionItems = filteredCollections(q).slice(0, 4).map(function (c) {
      return '<button type="button" class="global-search__item" data-gs-collection="' + escapeAttr(c.id) + '">' +
        '<span class="global-search__kind">подборка</span>' +
        '<span class="global-search__title">' + highlight(c.title, q) + '</span>' +
        '<span class="global-search__meta">' +
          escapeHtml([displaySeason(c), playlistLabel(playlistsOf(c).length)].filter(Boolean).join(' · ')) +
          '</span>' +
      '</button>';
    });

    var playlistItems = searchIndex.playlists.map(function (p) {
      var score = bestScore([p.n, p.note, p.label, p.cn, p.file], q);
      return score < 0 ? null : { item: p, score: score };
    }).filter(Boolean).sort(function (a, b) {
      return a.score - b.score || String(a.item.n).localeCompare(String(b.item.n), 'ru');
    }).slice(0, 5).map(function (r) {
      var p = r.item;
      return '<button type="button" class="global-search__item" data-gs-playlist="' +
          escapeAttr(p.ci + '|' + p.id) + '">' +
        '<span class="global-search__kind">плейлист</span>' +
        '<span class="global-search__title">' + highlight(p.n, q) + '</span>' +
        '<span class="global-search__meta">' +
          (p.label ? '<span class="global-search__badge">' + escapeHtml(p.label) + '</span> ' : '') +
          highlight(p.cn, q) + (p.count ? ' · ' + channelLabel(p.count) : '') +
        '</span>' +
      '</button>';
    });

    var channelItems = searchIndex.channels.map(function (ch, i) {
      var score = bestScore([ch.n, ch.g, ch.pn, ch.cn], q);
      return score < 0 ? null : { item: ch, index: i, score: score };
    }).filter(Boolean).sort(function (a, b) {
      return a.score - b.score || String(a.item.n).localeCompare(String(b.item.n), 'ru');
    }).slice(0, 8).map(function (r) {
      var ch = r.item;
      return '<button type="button" class="global-search__item" data-gs-channel="' + r.index + '">' +
        '<span class="global-search__kind">канал</span>' +
        '<span class="global-search__title">' + highlight(ch.n, q) + '</span>' +
        '<span class="global-search__meta">' + highlight(ch.g || 'Без группы', q) +
          ' · ' + escapeHtml(ch.pn) + '</span>' +
      '</button>';
    });

    var html = searchSection('Подборки', collectionItems, collectionItems.length) +
      searchSection('Плейлисты', playlistItems, playlistItems.length) +
      searchSection('Каналы', channelItems, channelItems.length);
    if (!html) {
      html = '<p class="global-search__empty">Ничего не найдено. Попробуйте название канала, плейлиста или подборки.</p>';
    }
    globalResults.innerHTML = html;
    globalResults.hidden = false;
    // results-панель привязана к строке поиска, но должно хватать и места
    // до краёв окна — иначе список уезжает за нижнюю границу экрана.
    var box = (globalSearchBox || shelfSearch).getBoundingClientRect();
    var below = window.innerHeight - box.bottom - 16;
    var above = box.top - 16;
    if (below >= 200) {
      globalResults.style.top = '';
      globalResults.style.bottom = '';
      globalResults.style.maxHeight = Math.min(520, below) + 'px';
    } else {
      globalResults.style.top = 'auto';
      globalResults.style.bottom = 'calc(100% + 8px)';
      globalResults.style.maxHeight = Math.max(160, Math.min(520, above)) + 'px';
    }
    if (shelfSearch) shelfSearch.setAttribute('aria-expanded', 'true');
  }

  function openGlobalResult(el) {
    if (!el) return;
    closeGlobalResults();
    if (el.dataset.gsCollection) {
      setCinema(true, { collectionId: el.dataset.gsCollection, autoplay: true, force: true });
      return;
    }
    if (el.dataset.gsPlaylist) {
      var parts = String(el.dataset.gsPlaylist).split('|');
      setCinema(true, {
        collectionId: parts[0],
        playlistId: parts[1],
        autoplay: true,
        force: true
      });
      return;
    }
    if (el.dataset.gsChannel === undefined) return;
    var ch = searchIndex.channels[Number(el.dataset.gsChannel)];
    if (!ch || !window.dev4revApp) return;
    var promise = setCinema(true, {
      collectionId: ch.ci,
      playlistId: ch.pi,
      autoplay: false,
      force: true
    });
    Promise.resolve(promise).then(function (ok) {
      if (!ok) return;
      var list = window.dev4revApp.getVisibleChannels();
      for (var i = 0; i < list.length; i++) {
        if (list[i].url === ch.u || list[i].name === ch.n) {
          window.dev4revApp.playChannel(list[i]._idx);
          return;
        }
      }
    });
  }

  function renderHomeShelf(query) {
    if (!shelfRail || !collections.length) return;
    var list = orderedCollections(query);

    if (shelfEmpty) shelfEmpty.hidden = list.length > 0;
    shelfRail.innerHTML = list.map(function (c) {
      var isFav = c.id === FAV_ID;
      var isUser = !!c.custom;
      var badge = isFav ? 'ИЗБРАННОЕ' : (isUser ? 'МОЯ' : (inSeason(c) ? 'СЕЙЧАС' : ''));
      var remove = '';
      if (isFav) {
        remove = '<button type="button" class="poster__remove" data-clear-favorites="1"' +
          ' aria-label="Очистить избранное" title="Очистить избранное">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
      } else if (isUser) {
        remove = '<button type="button" class="poster__remove" data-remove-user="' + escapeAttr(c.id) + '"' +
          ' aria-label="Удалить подборку" title="Удалить подборку">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
      }
      var posterMeta = [displaySeason(c),
        playlistsOf(c).length > 1 ? playlistLabel(playlistsOf(c).length) : ''
      ].filter(Boolean).join(' · ');
      return '<div class="poster' +
        (activeId === c.id ? ' is-active' : '') +
        (isFav ? ' poster--favorites' : '') + (isUser ? ' poster--user' : '') + '"' +
        ' role="button" tabindex="0"' +
        ' data-collection="' + escapeAttr(c.id) + '" style="' + collectionStyle(c) + '"' +
        ' aria-label="Открыть подборку: ' + escapeAttr(c.title) + '">' +
        '<span class="poster__art">' +
          '<span class="poster__glow"></span>' +
          (badge ? '<span class="poster__badge">' + badge + '</span>' : '') +
          remove +
          '<span class="poster__icon poster__icon--scene">' + collectionArt(c) + '</span>' +
        '</span>' +
        '<span class="poster__meta">' +
          '<span class="poster__title">' + escapeHtml(c.title) + '</span>' +
          (posterMeta ? '<span class="poster__date">' + escapeHtml(posterMeta) + '</span>' : '') +
        '</span>' +
      '</div>';
    }).join('');
  }

  function ensureAppLoaded() {
    if (!window.dev4revApp && typeof window.dev4revLoadPlaylist === 'function') {
      return new Promise(function (resolve) {
        var tries = 0;
        var timer = setInterval(function () {
          tries++;
          if (window.dev4revApp || tries > 40) {
            clearInterval(timer);
            resolve(!!window.dev4revApp);
          }
        }, 50);
      });
    }
    return Promise.resolve(!!window.dev4revApp);
  }

  function loadM3U(url, opts) {
    var o = opts || {};
    if (!window.dev4revApp || typeof window.dev4revApp.load !== 'function') {
      status('Плеер ещё загружается…', 'warn');
      return Promise.reject(new Error('not-ready'));
    }
    var seq = ++loadSeq;
    status('Загружаю ' + (o.label ? '«' + o.label + '»' : 'подборку') + '…', 'load');

    return window.dev4revApp.load(url).then(function () {
      if (seq !== loadSeq) return false;
      var channels = window.dev4revApp.getChannels();
      if (!channels.length) {
        status('В подборке не найдено каналов', 'err');
        return false;
      }
      status('Загружено каналов: ' + channels.length + (o.label ? ' · ' + o.label : ''), 'ok');
      return true;
    }).catch(function (err) {
      if (seq !== loadSeq) return false;
      status('Ошибка загрузки: ' + ((err && err.message) || 'неизвестная') + '. Попробуйте другую подборку.', 'err');
      throw err;
    });
  }

  function openCollection(id, opts) {
    var o = opts || {};
    var c = collectionById(id);
    if (!c) return Promise.resolve(false);

    var list = playlistsOf(c);
    if (!list.length) return Promise.resolve(false);

    var chosen = null;
    if (o.playlistId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === o.playlistId) { chosen = list[i]; break; }
      }
    }
    if (!chosen && activeCollectionId === c.id) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === activePlaylistId) { chosen = list[j]; break; }
      }
    }
    if (!chosen) chosen = list[0];

    var isLocal = !!chosen.local && Array.isArray(chosen.channels);
    if (isLocal && !chosen.channels.length) {
      status(c.id === FAV_ID
        ? 'В избранном пока пусто — отметьте каналы звездой'
        : 'В сохранённой подборке пока нет каналов', 'warn');
      return Promise.resolve(false);
    }
    var localUrl = chosen.url || ('local:' + chosen.id);
    var checkUrl = isLocal ? localUrl : chosen.file;
    var label = c.title + ' · ' + chosen.name;

    activeId = c.id;
    activeCollectionId = c.id;
    activePlaylistId = chosen.id;
    renderHomeShelf(shelfSearch ? shelfSearch.value : '');
    renderPlaylistSwitch();
    applyPalette({ accent: c.accent, accent2: c.accent2 }, c.title);

    var key = c.id + '/' + chosen.id;
    var alreadyLoaded = loadedIds[key] &&
      window.dev4revApp &&
      sameUrl(window.dev4revApp.getPlaylistUrl(), checkUrl) &&
      window.dev4revApp.hasChannels();

    if (alreadyLoaded) {
      status('Уже загружено: ' + label, 'ok');
      if (o.autoplay !== false) {
        var first = window.dev4revApp.getVisibleChannels();
        if (first.length) window.dev4revApp.playChannel(first[0]._idx);
      }
      return Promise.resolve(true);
    }

    return ensureAppLoaded().then(function (ready) {
      if (!ready) {
        status('Плеер ещё загружается…', 'warn');
        return false;
      }
      var promise = isLocal
        ? window.dev4revApp.loadChannels(chosen.channels, { url: localUrl, label: label })
        : loadM3U(chosen.file, { label: label });
      return promise.then(function (ok) {
        loadedIds[key] = !!ok;
        if (o.autoplay !== false && ok) {
          var first = window.dev4revApp.getVisibleChannels();
          if (first.length) window.dev4revApp.playChannel(first[0]._idx);
        }
        return !!ok;
      });
    });
  }

  function openFirstCollection() {
    if (!staticCollections.length) return Promise.resolve(false);
    return openCollection(staticCollections[0].id);
  }

  // ─── Fullscreen / immersive helpers ─────────────────────
  function isImmersive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function shouldAutoImmersive() {
    // На ПК полноэкранный режим по выбору подборки навязчив; оставляем
    // автопереход только для явного ТВ-режима.
    try {
      return document.documentElement.dataset.tvMode === 'on';
    } catch (e) {
      return false;
    }
  }

  function requestImmersive(opts) {
    var wrap = document.getElementById('playerWrap');
    if (!wrap || isImmersive()) return;
    var o = opts || {};
    if (!o.force && !shouldAutoImmersive()) return;
    var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.webkitRequestFullScreen;
    if (req) {
      try {
        var p = req.call(wrap);
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
  }

  function exitImmersive() {
    if (!isImmersive()) return;
    var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (exit) {
      try {
        var p = exit.call(document);
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
  }

  // ─── События ────────────────────────────────────────────
  if (toggle) toggle.addEventListener('click', function () {
    var turningOn = !isCinema();
    setCinema(turningOn);
    if (turningOn) {
      setTimeout(function () {
        if (window.dev4revApp && window.dev4revApp.isPlayerLoaded()) requestImmersive();
      }, 80);
    }
  });

  if (exitBtn) exitBtn.addEventListener('click', function () {
    if (isImmersive()) exitImmersive();
    else setCinema(false);
  });

  if (shelfRail) {
    // error не всплывает, поэтому ловим его на стадии захвата.
    shelfRail.addEventListener('error', function (e) {
      var img = e.target;
      if (!img.classList || !img.classList.contains('poster__icon-img')) return;
      var card = img.closest('[data-collection]');
      var c = card ? collectionById(card.dataset.collection) : null;
      img.outerHTML = '<span class="poster__icon-fallback">' +
        collectionArtFallback(c || {}) + '</span>';
    }, true);

    shelfRail.addEventListener('keydown', function (e) {
      var card = e.target.closest('.poster');
      if (!card || e.target.closest('.poster__remove')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });

    shelfRail.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-remove-user]');
      if (rm) {
        e.preventDefault();
        e.stopPropagation();
        removeUserCollection(rm.dataset.removeUser);
        return;
      }
      var clr = e.target.closest('[data-clear-favorites]');
      if (clr) {
        e.preventDefault();
        e.stopPropagation();
        if (window.dev4revFavorites) window.dev4revFavorites.clear();
        status('Избранное очищено', 'ok');
        return;
      }
      var btn = e.target.closest('[data-collection]');
      if (!btn) return;
      setCinema(true, { collectionId: btn.dataset.collection, autoplay: true, force: true });
      setTimeout(requestImmersive, 120);
    });
  }

  if (saveBtn) saveBtn.addEventListener('click', saveCurrentCollection);
  if (saveBtn) {
    saveBtn.addEventListener('click', function () { closeSaveHelp(); });
  }

  if (saveDialog) {
    saveDialog.addEventListener('click', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-dialog-close')) closeSaveDialog();
    });
  }
  if (saveDialogForm) saveDialogForm.addEventListener('submit', submitSaveDialog);

  // Диалог модальный: Escape закрывает его, Tab не уходит за пределы окна.
  document.addEventListener('keydown', function (e) {
    if (!saveDialog || saveDialog.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSaveDialog();
      return;
    }
    if (e.key !== 'Tab') return;
    var items = Array.prototype.slice.call(
      saveDialog.querySelectorAll('button:not([disabled]), input:not([disabled])'));
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }, true);

  window.addEventListener('dev4rev:favoriteschange', function () {
    rebuildCollections();
    renderHomeShelf(shelfSearch ? shelfSearch.value : '');
    if (activeCollectionId === FAV_ID) {
      document.querySelectorAll('[data-playlist-switch]').forEach(function (sel) {
        sel.dataset.builtFor = '';
      });
      renderPlaylistSwitch();
    }
  });

  window.addEventListener('dev4rev:playerstate', function (e) {
    var loaded = !!(e.detail && e.detail.loaded);
    if (saveBtn) saveBtn.disabled = !loaded;
    syncSection();
  });

  window.addEventListener('dev4rev:channelfilter', function (e) {
    channelFilterQuery = (e.detail && e.detail.query) || '';
    syncSection();
  });

  if (channelsPlaylistSearch) {
    channelsPlaylistSearch.addEventListener('input', function () {
      setPlaylistQuery(channelsPlaylistSearch.value);
    });
  }
  if (playlistSearch) {
    playlistSearch.addEventListener('input', function () {
      setPlaylistQuery(playlistSearch.value);
    });
  }
  if (playerCollectionSearch) {
    playerCollectionSearch.addEventListener('input', function () {
      setCollectionQuery(playerCollectionSearch.value);
    });
  }

  function activateTab(tabBtn, tab) {
    if (channelsSection && channelsSection.contains(tabBtn)) {
      sectionTab = (tab === 'channels') ? 'channels' : 'playlists';
      var st = channelsSection.querySelectorAll('[data-context-tab]');
      st.forEach(function(b){ var sel=b.dataset.contextTab===sectionTab; b.classList.toggle('is-active',sel); b.setAttribute('aria-selected', sel?'true':'false'); b.tabIndex=sel?0:-1; });
      syncSection();
    } else {
      setContextOpen(true, tab);
    }
    if (window.dev4revApp && window.dev4revApp.renderPlayerChannels) {
      window.dev4revApp.renderPlayerChannels();
    }
  }

  contextTabs.forEach(function (tabBtn) {
    tabBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      activateTab(tabBtn, tabBtn.dataset.contextTab);
    });
    tabBtn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      // Стрелки переключают вкладки только внутри своей группы
      // (в панели и под плеером переключатели независимые).
      var group = Array.prototype.slice.call(
        tabBtn.parentElement.querySelectorAll('[data-context-tab]'));
      var next = group[(group.indexOf(tabBtn) + 1) % group.length];
      next.focus();
      activateTab(next, next.dataset.contextTab);
    });
  });

  // Переключение плейлистов внутри активной подборки.
  document.addEventListener('change', function (e) {
    var sel = e.target && e.target.closest ? e.target.closest('[data-playlist-switch]') : null;
    if (!sel || sel.hidden) return;
    var c = collectionById(activeCollectionId);
    if (!c) return;
    var list = playlistsOf(c);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== sel.value) continue;
      openCollection(c.id, {
        playlistId: list[i].id,
        autoplay: true,
        force: true
      });
      return;
    }
  });

  // Единственный выбор плейлиста — карточки в панели подборки,
  // плюс результаты глобального поиска.
  document.addEventListener('click', function (e) {
    var result = e.target && e.target.closest ? e.target.closest('.global-search__item') : null;
    if (result) {
      e.preventDefault();
      e.stopPropagation();
      openGlobalResult(result);
      return;
    }

    if (globalSearchBox && (!e.target.closest || !e.target.closest('#globalSearchBox'))) {
      closeGlobalResults();
    }
    if (saveHelpPopover && (!e.target.closest || !e.target.closest('.shelf__help-wrap'))) {
      closeSaveHelp();
    }

    var collectionItem = e.target && e.target.closest ? e.target.closest('[data-collection-id]') : null;
    if (collectionItem && collectionItem.closest('#playerCollectionsList')) {
      var nextC = collectionById(collectionItem.dataset.collectionId);
      if (!nextC) return;
      if (nextC.id === activeCollectionId) {
        setContextOpen(true, 'playlists');
      } else {
        openCollection(nextC.id, { autoplay: true, force: true });
      }
      return;
    }

    var item = e.target && e.target.closest ? e.target.closest('[data-playlist-id]') : null;
    if (!item || !item.closest('[data-playlist-list]')) return;
    var c = collectionById(activeCollectionId);
    if (!c) return;
    var list = playlistsOf(c);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== item.dataset.playlistId) continue;
      openCollection(c.id, { playlistId: list[i].id, autoplay: true, force: true });
      // На телефоне после выбора возвращаем экран видео.
      if (item.closest('#playerContext') && window.matchMedia &&
          window.matchMedia('(max-width: 720px)').matches) {
        setContextOpen(false);
      }
      return;
    }
  });

  if (shelfSearch) {
    syncShelfClear();
    shelfSearch.addEventListener('input', function () {
      var value = shelfSearch.value;
      syncShelfClear();
      if (shelfDebounce) clearTimeout(shelfDebounce);
      shelfDebounce = setTimeout(function () {
        renderHomeShelf(value);
      }, 120);
      ensureSearchIndex().then(function () {
        if (shelfSearch.value === value) renderGlobalResults(value);
      });
    });
    shelfSearch.addEventListener('focus', function () {
      if (shelfSearch.value.trim().length < 2) return;
      ensureSearchIndex().then(function () { renderGlobalResults(shelfSearch.value); });
    });
    shelfSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeGlobalResults(); return; }
      onGlobalSearchKeydown(e);
      if (e.key === 'Enter' && globalResults && !globalResults.hidden) {
        var first = globalResults.querySelector('.global-search__item');
        if (first) { e.preventDefault(); first.click(); }
      }
    });
  }

  if (shelfSearchClear) {
    shelfSearchClear.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearShelfSearch();
    });
  }

  if (saveHelpBtn) {
    saveHelpBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = saveHelpPopover && saveHelpPopover.hidden;
      closeSaveHelp();
      if (saveHelpPopover) saveHelpPopover.hidden = !willOpen;
      if (saveHelpBtn) saveHelpBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }

  if (shelfAllBtn) {
    shelfAllBtn.addEventListener('click', function () {
      if (shelfSearch) shelfSearch.value = '';
      syncShelfClear();
      closeGlobalResults();
      renderHomeShelf('');
      var shelf = document.getElementById('homeShelf');
      if (shelf) shelf.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!isCinema()) return;
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');

    if (e.key === 'Escape') {
      if (typing) return;
      if (contextOpen) { setContextOpen(false); return; }
      if (isImmersive()) exitImmersive();
      else setCinema(false);
      return;
    }
    if (typing) return;
    if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
      e.preventDefault();
      if (isImmersive()) exitImmersive();
      else requestImmersive({ force: true });
    }
  });

  function syncImmersive() {
    var immersive = isCinema() && isImmersive();
    document.body.classList.toggle('cinema-immersive', immersive);
    setContextOpen(!immersive);
  }
  document.addEventListener('fullscreenchange', syncImmersive);
  document.addEventListener('webkitfullscreenchange', syncImmersive);

  // Подсветка плеера и общий фон меняются вместе с текущим плейлистом/каналом.
  window.addEventListener('dev4rev:playlistchange', function (e) {
    var detail = e.detail || {};
    // Один M3U-файл может входить в несколько подборок. Если мы сами его
    // открыли, не перескакиваем на первое совпадение с таким же URL.
    var currentCollection = collectionById(activeCollectionId);
    var currentPlaylist = null;
    if (currentCollection) {
      var currentList = playlistsOf(currentCollection);
      for (var k = 0; k < currentList.length; k++) {
        if (currentList[k].id === activePlaylistId) { currentPlaylist = currentList[k]; break; }
      }
    }
    if (currentPlaylist &&
        (sameUrl(currentPlaylist.file || currentPlaylist.url, detail.url) ||
         sameUrl(currentPlaylist.url, detail.url))) {
      renderPlaylistSwitch();
      return;
    }

    var found = findPlaylistByUrl(detail.url);
    if (found) {
      activeCollectionId = found.collection.id;
      activePlaylistId = found.playlist.id;
      renderPlaylistSwitch();
      applyPalette({ accent: found.collection.accent, accent2: found.collection.accent2 }, found.collection.title);
    } else {
      activeCollectionId = null;
      activePlaylistId = null;
      renderPlaylistSwitch();
      applyPalette(paletteFromText(detail.url || 'playlist'), 'playlist');
    }
  });

  window.addEventListener('dev4rev:channelchange', function (e) {
    var d = e.detail || {};
    var c = collectionById(activeCollectionId);
    var base = c ? { accent: c.accent, accent2: c.accent2 } : null;
    var seed = [d.group, d.name].filter(Boolean).join(' · ') || d.name || 'channel';
    applyPalette(paletteForChannel(seed, base), d.name || 'channel');
  });

  window.addEventListener('dev4rev:tvchange', function (e) {
    if (e.detail && e.detail.active && isCinema()) {
      if (isImmersive()) exitImmersive();
      setCinema(false);
    }
  });

  window.addEventListener('dev4rev:open-collection', function (e) {
    var d = e.detail || {};
    if (!d.id) return;
    setCinema(true, {
      collectionId: d.id,
      playlistId: d.playlistId,
      autoplay: true,
      force: true
    });
    setTimeout(requestImmersive, 120);
  });

  // ─── Init ───────────────────────────────────────────────
  function init() {
    syncToggle();
    if (saveBtn) saveBtn.disabled = !(window.dev4revApp && window.dev4revApp.isPlayerLoaded());
    ensureSearchIndex();

    fetch(DATA_URL, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      staticCollections = Array.isArray(data.collections) ? data.collections : [];
      rebuildCollections();
      renderHomeShelf(shelfSearch ? shelfSearch.value : '');

      // Плейлист мог быть загружен по ?playlist= раньше, чем подборки.
      var currentUrl = window.dev4revApp && window.dev4revApp.getPlaylistUrl
        ? window.dev4revApp.getPlaylistUrl() : '';
      var current = findPlaylistByUrl(currentUrl);
      if (current) {
        activeCollectionId = current.collection.id;
        activePlaylistId = current.playlist.id;
      }
      renderPlaylistSwitch();

      // Если плейлист пришёл по ?playlist=, не подменяем его первой подборкой.
      var hasSharedPlaylist = false;
      try { hasSharedPlaylist = !!new URLSearchParams(window.location.search).get('playlist'); } catch (e) {}
      if (isCinema() && !hasSharedPlaylist &&
          (!window.dev4revApp || !window.dev4revApp.isPlayerLoaded())) {
        openFirstCollection();
      }
    }).catch(function () {
      status('Не удалось загрузить список подборок', 'err');
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  window.dev4revCinema = {
    open: function (id, opts) { return openCollection(id, opts); },
    openFirst: openFirstCollection,
    toggle: function () { setCinema(!isCinema()); },
    isActive: isCinema,
    closeContext: function () { setContextOpen(false); },
    setContextTab: function (tab, open) { setContextTab(tab, open); },
    getContextTab: function () { return { open: contextOpen, tab: contextTab }; },
    setPanel: function () {},
    getCollections: function () { return collections.slice(); },
    getPlaylists: function (id) {
      return playlistsOf(collectionById(id || activeCollectionId)).slice();
    },
    getActive: function () {
      return { collectionId: activeCollectionId, playlistId: activePlaylistId };
    },
    getShelfOrder: function () {
      return orderedCollections(shelfSearch ? shelfSearch.value : '').map(function (c) { return c.id; });
    },
    saveCurrent: saveCurrentCollection
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
  'use strict';

  var pageBtn = document.getElementById('sharePageBtn');
  var playerBtn = document.getElementById('sharePlayerBtn');
  var menu = document.getElementById('shareMenu');
  var toast = document.getElementById('shareToast');
  var hint = document.getElementById('sharePlaylistHint');
  var opener = null;
  var toastTimer = null;

  function siteUrl() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href && /^https:\/\//i.test(canonical.href)) return canonical.href;
    return window.location.origin + window.location.pathname;
  }

  function playlistUrl() {
    var raw = '';
    if (window.dev4revApp && typeof window.dev4revApp.getPlaylistUrl === 'function') {
      raw = window.dev4revApp.getPlaylistUrl() || '';
    } else {
      var input = document.getElementById('playlistUrl');
      raw = input ? input.value.trim() : '';
    }
    if (!raw) return '';
    // Для VLC и шеринга нужна ссылка вида https://tv.dev4rev.ru/...m3u,
    // а не адрес локального превью.
    if (window.dev4revPlaylistLink) return window.dev4revPlaylistLink(raw);
    if (/^tv\.dev4rev\.ru\//i.test(raw)) raw = 'https://' + raw;
    try { return new URL(raw, siteUrl()).href; } catch (e) { return raw; }
  }

  function shortUrl(url) {
    var text = String(url || '').replace(/^https?:\/\//i, '');
    return text.length > 56 ? text.slice(0, 53) + '…' : text;
  }

  function refreshHint() {
    if (!hint) return;
    var url = playlistUrl();
    hint.textContent = url ? shortUrl(url) : 'Загрузите плейлист';
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.remove('is-visible');
    // Force reflow so the animation restarts on repeated shares.
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
      toastTimer = setTimeout(function () { toast.hidden = true; }, 220);
    }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (e) {
      return false;
    }
  }

  function shareOrCopy(data) {
    var done = function (message) { showToast(message); closeMenu(); };
    if (navigator.share) {
      navigator.share(data).then(function () {
        done('Ссылка отправлена');
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        copyText(data.url || data.text).then(function (ok) {
          done(ok ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку');
        });
      });
      return;
    }
    copyText(data.url || data.text).then(function (ok) {
      done(ok ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку');
    });
  }

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    if (opener) opener.setAttribute('aria-expanded', 'false');
    opener = null;
  }

  function openMenu(btn) {
    if (!menu || !btn) return;
    if (opener === btn && !menu.hidden) { closeMenu(); return; }
    if (window.dev4revClosePlayerDialogs) window.dev4revClosePlayerDialogs();
    opener = btn;
    refreshHint();
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');

    var r = btn.getBoundingClientRect();
    var mw = menu.offsetWidth;
    var mh = menu.offsetHeight;
    var left = Math.min(Math.max(8, r.right - mw), Math.max(8, window.innerWidth - mw - 8));
    var top = r.bottom + 8;
    if (top + mh > window.innerHeight - 8) {
      top = r.top - mh - 8;
      if (top < 8) top = Math.max(8, window.innerHeight - mh - 8);
    }
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  function init() {
    refreshHint();

    [pageBtn, playerBtn].forEach(function (btn) {
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openMenu(btn);
      });
    });

    if (menu) {
      menu.addEventListener('click', function (e) {
        var item = e.target.closest('[data-share]');
        if (!item) return;
        e.stopPropagation();

        if (item.dataset.share === 'site') {
          var site = siteUrl();
          shareOrCopy({
            title: 'TV — IPTV-плейлисты M3U',
            text: 'TV dev4rev — смотрите IPTV прямо в браузере',
            url: site
          });
          return;
        }

        var url = playlistUrl();
        if (!url) {
          showToast('Сначала загрузите плейлист');
          closeMenu();
          return;
        }
        shareOrCopy({
          title: 'IPTV-плейлист M3U',
          text: 'Плейлист для VLC и IPTV-плееров: ' + url,
          url: url
        });
      });
    }

    document.addEventListener('click', function (e) {
      if (!menu || menu.hidden) return;
      if (menu.contains(e.target)) return;
      if (opener && opener.contains(e.target)) return;
      closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu && !menu.hidden) closeMenu();
    });

    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, { passive: true });
    window.addEventListener('dev4rev:playlistchange', refreshHint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

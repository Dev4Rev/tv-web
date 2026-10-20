(function () {
  try {
    var t = localStorage.getItem('dev4rev.theme') || 'auto';
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;

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

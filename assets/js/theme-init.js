(function () {
  try {
    var t = localStorage.getItem('dev4rev.theme') || 'auto';
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;

    // TV-mode: сначала явный выбор пользователя, иначе — auto
    var tvPref = localStorage.getItem('dev4rev.tvMode');
    if (tvPref === 'on' || tvPref === 'off') {
      document.documentElement.dataset.tvMode = tvPref;
    } else {
      // Автоопределение: ТВ-браузеры и широкие экраны
      var ua = navigator.userAgent || '';
      var isTvUA = /SmartTV|Tizen|Web0S|WebOS|HbbTV|NETCAST|Viera|BRAVIA|Aquos|SmartHub|AndroidTV|GoogleTV|AppleTV|PhilipsTV|Hisense|Vestel|Roku/i.test(ua);

      // Определение по разрешению: Full HD и выше + широкая ориентация
      var isBigScreen = false;
      try {
        isBigScreen = window.screen && window.screen.width >= 1600 && window.screen.height >= 900;
      } catch (e) {}

      // Определение по отсутствию touch + большой экран
      var isDesktopBig = !('ontouchstart' in window) && isBigScreen;

      if (isTvUA || isDesktopBig) {
        document.documentElement.dataset.tvMode = 'on';
      } else {
        document.documentElement.dataset.tvMode = 'off';
      }
    }
  } catch (e) {}
})();
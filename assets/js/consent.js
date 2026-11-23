// Небольшая плашка об использовании данных браузера.
// Решение сохраняется локально и может быть отозвано со страницы политики.
(function () {
  var KEY = 'dev4rev.dataNotice';
  var box = null;
  var stored = '';

  try { stored = localStorage.getItem(KEY) || ''; } catch (e) {}
  document.documentElement.dataset.consent = stored || 'unset';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function remember(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    document.documentElement.dataset.consent = value;
    hide();
  }

  function hide() {
    if (!box) return;
    box.classList.remove('is-visible');
    var node = box;
    box = null;
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 240);
  }

  function show() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'data-notice';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Использование данных');
    box.innerHTML =
      '<p class="data-notice__text">Мы сохраняем в браузере настройки плеера и историю просмотров. ' +
      'Подробнее — в <a href="./privacy">политике конфиденциальности</a>.</p>' +
      '<div class="data-notice__actions">' +
      '<button type="button" class="data-notice__btn" data-consent="dismissed">Отклонить</button>' +
      '<button type="button" class="data-notice__btn data-notice__btn--accept" data-consent="accepted">Принимаю</button>' +
      '</div>';

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (btn) remember(btn.getAttribute('data-consent'));
    });

    document.body.appendChild(box);
    // Форсируем reflow, чтобы переход от无固定ного состояния к видимому
    // отработал даже в фоновой вкладке, где requestAnimationFrame тормозится.
    void box.offsetWidth;
    box.classList.add('is-visible');
  }

  ready(function () {
    var reset = document.getElementById('consentReset');
    if (reset) {
      reset.addEventListener('click', function () {
        try { localStorage.removeItem(KEY); } catch (e) {}
        document.documentElement.dataset.consent = 'unset';
        show();
      });
    }
    if (!stored) show();
  });
})();

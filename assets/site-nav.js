(function () {
  function closeAll() {
    document.querySelectorAll('.w-header.is-nav-open').forEach(function (header) {
      header.classList.remove('is-nav-open');
      var btn = header.querySelector('.w-nav-toggle');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('.w-nav-toggle');
    if (toggle) {
      var header = toggle.closest('.w-header');
      var open = toggle.getAttribute('aria-expanded') === 'true';
      closeAll();
      if (!open) {
        toggle.setAttribute('aria-expanded', 'true');
        header.classList.add('is-nav-open');
      }
      return;
    }
    if (!e.target.closest('.w-header.is-nav-open')) closeAll();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();

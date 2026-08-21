(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 1. Phone 3D Tilt on Product Pages
  document.querySelectorAll('[data-tilt]').forEach(function (phone) {
    if (!fineHover) {
      phone.classList.add('phone-frame--auto');
      return;
    }

    var wrap = phone.closest('[data-tilt-stage]') || phone.parentElement;
    if (!wrap) return;
    wrap.addEventListener('mousemove', function (e) {
      var r = phone.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      var rx = (px - 0.5) * 10;
      var ry = (0.5 - py) * 8;
      phone.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      phone.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      phone.classList.add('tilting');
    });
    wrap.addEventListener('mouseleave', function () {
      phone.style.setProperty('--rx', '0deg');
      phone.style.setProperty('--ry', '0deg');
      phone.classList.remove('tilting');
    });
  });

  // 2. Deals Hero Multi-plane Subtle Parallax Depth
  var heroWrap = document.querySelector('.deals-hero-art-wrap');
  if (heroWrap && fineHover) {
    var bg = heroWrap.querySelector('.deals-hero-bg');
    var house = heroWrap.querySelector('.deals-hero-house');
    var phoneEl = heroWrap.querySelector('.deals-hero-phone');
    var bleedL = heroWrap.querySelector('.deals-hero-bleed-l');
    var bleedR = heroWrap.querySelector('.deals-hero-bleed-r');

    var ticking = false;
    heroWrap.addEventListener('mousemove', function (e) {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var rect = heroWrap.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;

        if (bg) bg.style.transform = 'translate(' + (x * -6).toFixed(1) + 'px, ' + (y * -4).toFixed(1) + 'px) scale(1.02)';
        if (house) house.style.transform = 'translate(' + (x * 4).toFixed(1) + 'px, ' + (y * 3).toFixed(1) + 'px)';
        if (phoneEl) phoneEl.style.transform = 'translate(' + (x * 8).toFixed(1) + 'px, ' + (y * 6).toFixed(1) + 'px) rotate(' + (x * 2).toFixed(1) + 'deg)';
        if (bleedL) bleedL.style.transform = 'translate(' + (x * 7).toFixed(1) + 'px, ' + (y * 4).toFixed(1) + 'px)';
        if (bleedR) bleedR.style.transform = 'translate(' + (x * 7).toFixed(1) + 'px, ' + (y * 4).toFixed(1) + 'px)';
        ticking = false;
      });
    });

    heroWrap.addEventListener('mouseleave', function () {
      if (bg) bg.style.transform = '';
      if (house) house.style.transform = '';
      if (phoneEl) phoneEl.style.transform = '';
      if (bleedL) bleedL.style.transform = '';
      if (bleedR) bleedR.style.transform = '';
    });
  }
})();

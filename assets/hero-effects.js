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

  // 2. Interactive Deals Hero Wi-Fi Broadcast (Desktop Hover & Mobile Touch/Scroll Ping)
  var heroArt = document.querySelector('[data-interactive-hero]');
  var signal = document.querySelector('[data-hero-signal]');

  if (heroArt && signal) {
    var pingTimeout = null;

    function triggerBroadcastPing(durationMs) {
      signal.classList.add('is-broadcasting');
      if (pingTimeout) clearTimeout(pingTimeout);
      pingTimeout = setTimeout(function () {
        signal.classList.remove('is-broadcasting');
      }, durationMs || 3500);
    }

    // Mobile / Touch: Tap anywhere on hero to trigger energetic broadcast burst
    heroArt.addEventListener('pointerdown', function () {
      triggerBroadcastPing(4000);
    });

    // Mobile / Touch: Play a single welcome ping when scrolled into view
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            triggerBroadcastPing(3000);
            observer.disconnect();
          }
        });
      }, { threshold: 0.4 });
      observer.observe(heroArt);
    }
  }
})();

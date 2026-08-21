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

  // 3. Big Brand Dynamic Horizontal Scroll Masks (Apple / Airbnb / Google style)
  function initScrollMasks() {
    var scrollContainers = document.querySelectorAll('.deals-filter-group, .deals-tier-tabs, .deals-upload-tabs, .deals-filter-row--toggles');
    scrollContainers.forEach(function (el) {
      function updateMask() {
        if (el.scrollWidth <= el.clientWidth + 2) {
          el.style.maskImage = 'none';
          el.style.webkitMaskImage = 'none';
          return;
        }
        var atStart = el.scrollLeft <= 4;
        var atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
        if (atStart) {
          el.style.maskImage = 'linear-gradient(to right, black calc(100% - 36px), transparent 100%)';
          el.style.webkitMaskImage = 'linear-gradient(to right, black calc(100% - 36px), transparent 100%)';
        } else if (atEnd) {
          el.style.maskImage = 'linear-gradient(to left, black calc(100% - 36px), transparent 100%)';
          el.style.webkitMaskImage = 'linear-gradient(to left, black calc(100% - 36px), transparent 100%)';
        } else {
          el.style.maskImage = 'linear-gradient(to right, transparent 0, black 32px, black calc(100% - 32px), transparent 100%)';
          el.style.webkitMaskImage = 'linear-gradient(to right, transparent 0, black 32px, black calc(100% - 32px), transparent 100%)';
        }
      }
      el.addEventListener('scroll', updateMask, { passive: true });
      window.addEventListener('resize', updateMask, { passive: true });
      // Run initial check and after tabs change
      updateMask();
      setTimeout(updateMask, 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollMasks);
  } else {
    initScrollMasks();
  }

})();

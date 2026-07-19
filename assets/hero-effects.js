(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduce || !fineHover) return;

  document.querySelectorAll('[data-tilt]').forEach(function (phone) {
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
})();

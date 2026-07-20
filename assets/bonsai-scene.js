/* Bonsai showcase — vanilla-JS port of a React/Canvas "living tree" component.
   Ported down to a single fruit (PriceMinder is the only app JRS Digital has
   right now) and to plain Canvas2D + Web Audio, since this site has no build
   step, no React, and no bundler to compile JSX/TSX.

   The tree itself (trunk, branches, leaf clusters) is drawn procedurally —
   the original leaned on a photographed backdrop image that doesn't exist in
   this repo. Drop a real photo at /assets/img/bonsai-backdrop.jpg and wire it
   into drawBackdrop() below (grayscale, object-fit: cover) if you'd rather
   use that than the generated one.

   Respects prefers-reduced-motion (renders one static frame, no physics/
   particles/sway) and falls back to a plain link if canvas isn't supported.
   Pauses the render loop when scrolled off-screen. */
(function () {
  var root = document.querySelector('[data-bonsai]');
  if (!root) return;

  var canvas = root.querySelector('[data-bonsai-canvas]');
  var stage = root.querySelector('[data-bonsai-stage]');
  var fallback = root.querySelector('[data-bonsai-fallback]');
  var popover = root.querySelector('[data-bonsai-popover]');
  var windBtn = root.querySelector('[data-bonsai-wind]');
  var regrowBtn = root.querySelector('[data-bonsai-regrow]');
  var regrowLabel = root.querySelector('[data-bonsai-regrow-label]');
  var launchLink = root.querySelector('[data-bonsai-launch]');

  var supportsCanvas = !!(canvas && canvas.getContext && canvas.getContext('2d'));
  if (!supportsCanvas) {
    if (fallback) fallback.hidden = false;
    if (canvas) canvas.remove();
    if (windBtn) windBtn.hidden = true;
    if (regrowBtn) regrowBtn.hidden = true;
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var width = 0, height = 0;
  var time = 0;
  var windSpeed = 1.2;
  var windSwayAngle = 0;
  var shakeIntensity = 0;
  var running = false;
  var rafId = null;

  var audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var dest = audioCtx.destination;
      var t = audioCtx.currentTime;

      if (type === 'pluck') {
        var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(); osc.stop(t + 0.3);
      } else if (type === 'thud') {
        var osc2 = audioCtx.createOscillator(), gain2 = audioCtx.createGain();
        osc2.connect(gain2); gain2.connect(dest);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(140, t);
        osc2.frequency.exponentialRampToValueAtTime(60, t + 0.2);
        gain2.gain.setValueAtTime(0.26, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc2.start(); osc2.stop(t + 0.25);
      } else if (type === 'sweep') {
        var o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
        var g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(dest);
        o1.type = 'sine'; o1.frequency.setValueAtTime(220, t); o1.frequency.exponentialRampToValueAtTime(660, t + 0.4);
        o2.type = 'triangle'; o2.frequency.setValueAtTime(440, t); o2.frequency.exponentialRampToValueAtTime(1320, t + 0.45);
        f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.1, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o1.start(); o2.start(); o1.stop(t + 0.55); o2.stop(t + 0.55);
      } else if (type === 'rustle') {
        var bufferSize = Math.floor(audioCtx.sampleRate * 0.4);
        var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        var noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        var filt = audioCtx.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = 500; filt.Q.value = 1;
        var g2 = audioCtx.createGain();
        g2.gain.setValueAtTime(0.001, t);
        g2.gain.linearRampToValueAtTime(0.05, t + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        noise.connect(filt); filt.connect(g2); g2.connect(dest);
        noise.start();
      }
    } catch (e) { /* Web Audio unavailable — silently skip, visuals still work */ }
  }

  function mapCoords(px, py) { return { x: px * width, y: py * height }; }

  // ---------- single fruit (PriceMinder) ----------
  var fruit = {
    x: 0, y: 0, vx: 0, vy: 0, radius: 26, bounceCount: 0,
    rotation: 0, rotVelocity: 0, pulseTimer: 0,
    isAttached: true, isHovered: false
  };
  var isFruitGrown = true;
  var isCompiling = false;

  // ---------- procedurally generated tree (computed once per resize, not per frame) ----------
  var tree = null;
  function buildTree() {
    var base = mapCoords(0.5, 0.84);
    var fork = mapCoords(0.48, 0.56);
    var apex = mapCoords(0.52, 0.30);
    var left = mapCoords(0.28, 0.46);
    var right = mapCoords(0.70, 0.50);

    function seededLeaves(anchor, count, spread, seed) {
      var out = [];
      for (var i = 0; i < count; i++) {
        // Deterministic pseudo-random so leaf clusters don't jitter frame to frame.
        var s = Math.sin(seed * 999 + i * 57.13) * 43758.5453;
        var r1 = s - Math.floor(s);
        var s2 = Math.sin(seed * 471 + i * 12.9898) * 12543.7;
        var r2 = s2 - Math.floor(s2);
        out.push({
          dx: (r1 - 0.5) * spread,
          dy: (r2 - 0.5) * spread * 0.7,
          w: 7 + r1 * 6,
          h: 3 + r2 * 3,
          rot: r1 * Math.PI,
          shade: 0.35 + r2 * 0.35
        });
      }
      return out;
    }

    tree = {
      base: base, fork: fork, apex: apex, left: left, right: right,
      leaves: seededLeaves(apex, 10, 46, 1).concat(
        seededLeaves(left, 9, 40, 2).map(function (l) { return { dx: l.dx - 6, dy: l.dy, w: l.w, h: l.h, rot: l.rot, shade: l.shade }; }),
        seededLeaves(right, 9, 40, 3)
      )
    };
  }

  // ---------- particles (wind-blown leaves/petals + ambient fireflies) ----------
  var particles = [];
  function spawnGroundDust(x, y) {
    for (var i = 0; i < 6; i++) {
      particles.push({
        x: x, y: y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2 - 0.5,
        radius: 1.5 + Math.random() * 2, alpha: 0.75, color: 'rgba(255,255,255,0.35)',
        life: 0, maxLife: 40 + Math.random() * 30, type: 'dust'
      });
    }
  }
  function triggerShake() {
    shakeIntensity = 14;
    var apex = tree.apex;
    for (var i = 0; i < 8; i++) {
      var angle = -Math.PI / 4 - Math.random() * (Math.PI / 2);
      var speed = 1 + Math.random() * 2;
      particles.push({
        x: apex.x + (Math.random() * 100 - 50),
        y: apex.y + (Math.random() * 40 - 10),
        vx: Math.cos(angle) * speed + windSpeed * 0.4,
        vy: Math.sin(angle) * speed + (Math.random() * 1.4 + 0.4),
        radius: 3 + Math.random() * 5, alpha: 0.85,
        color: Math.random() > 0.4 ? '#e9e9e9' : '#5a5a5a',
        life: 0, maxLife: 110 + Math.random() * 70,
        angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.08,
        type: Math.random() > 0.5 ? 'petal' : 'leaf'
      });
    }
  }
  function windGust() {
    windSpeed = 3.4;
    playSound('rustle');
    for (var i = 0; i < 16; i++) {
      particles.push({
        x: tree.apex.x + Math.random() * width * 0.25 - width * 0.05,
        y: tree.apex.y + Math.random() * height * 0.2,
        vx: 1.8 + Math.random() * 2.2, vy: Math.random() * 0.7 - 0.2,
        radius: 2.5 + Math.random() * 3, alpha: 0.85,
        color: Math.random() > 0.4 ? '#eaeaea' : '#585858',
        life: 0, maxLife: 130 + Math.random() * 90, type: 'petal'
      });
    }
    setTimeout(function () { windSpeed = 1.2; }, 1600);
  }

  function distanceToFruit(mx, my) { return Math.hypot(fruit.x - mx, fruit.y - my); }
  function isOverFruit(mx, my) { return distanceToFruit(mx, my) <= fruit.radius + 10; }

  // ---------- popover ----------
  function showPopover() {
    if (!popover) return;
    popover.hidden = false;
    var statusEl = popover.querySelector('[data-bonsai-popover-status]');
    var actionEl = popover.querySelector('[data-bonsai-popover-action]');
    if (statusEl) statusEl.textContent = fruit.isAttached ? 'On the tree' : 'Harvested';
    if (actionEl) actionEl.textContent = fruit.isAttached ? 'Tap to pluck it off the branch' : 'Tap again to open PriceMinder';
    positionPopover();
  }
  function hidePopover() { if (popover) popover.hidden = true; }
  function positionPopover() {
    if (!popover || popover.hidden) return;
    popover.style.left = fruit.x + 'px';
    popover.style.top = (fruit.y - 26) + 'px';
  }

  // ---------- pointer interaction ----------
  var hovering = false;
  function handleMove(mx, my) {
    var over = isOverFruit(mx, my);
    if (over && !hovering) {
      hovering = true;
      fruit.isHovered = true;
      playSound('rustle');
      showPopover();
    } else if (!over && hovering) {
      hovering = false;
      fruit.isHovered = false;
      hidePopover();
    } else if (over) {
      positionPopover();
    }
  }
  function handleTap(mx, my) {
    if (!isOverFruit(mx, my)) return;
    if (fruit.isAttached) {
      fruit.isAttached = false;
      fruit.vy = -1.1;
      fruit.vx = (Math.random() - 0.5) * 4 + windSpeed * 0.4;
      fruit.rotVelocity = (Math.random() - 0.5) * 0.22;
      playSound('pluck');
      triggerShake();
      showPopover();
    } else {
      playSound('sweep');
      window.location.href = launchLink ? launchLink.getAttribute('href') : '/priceminder/';
    }
  }

  function regrow() {
    if (isCompiling || isFruitGrown) return;
    isCompiling = true;
    if (regrowBtn) regrowBtn.disabled = true;
    playSound('sweep');
    var progress = 0;
    var interval = setInterval(function () {
      progress += 8;
      if (regrowLabel) regrowLabel.textContent = 'Regrowing… ' + Math.min(progress, 100) + '%';
      if (progress >= 100) {
        clearInterval(interval);
        isCompiling = false;
        isFruitGrown = true;
        if (regrowBtn) { regrowBtn.disabled = false; regrowBtn.hidden = true; }
        fruit.isAttached = true;
        fruit.vx = 0; fruit.vy = 0; fruit.rotation = 0; fruit.rotVelocity = 0; fruit.bounceCount = 0;
      }
    }, 45);
  }

  // ---------- render ----------
  function drawBackdrop() {
    var g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#1c2224');
    g.addColorStop(1, '#101414');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // soft ground mist / moss platform
    var moss = ctx.createRadialGradient(width * 0.5, height * 0.9, 4, width * 0.5, height * 0.9, width * 0.42);
    moss.addColorStop(0, 'rgba(255,255,255,0.05)');
    moss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = moss;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTree(sway) {
    ctx.save();
    ctx.translate(tree.base.x, tree.base.y);
    ctx.rotate(sway);
    ctx.translate(-tree.base.x, -tree.base.y);

    // trunk (tapered fill, curving from base to fork)
    var trunkGrad = ctx.createLinearGradient(tree.base.x, tree.base.y, tree.fork.x, tree.fork.y);
    trunkGrad.addColorStop(0, '#2b2b2b');
    trunkGrad.addColorStop(1, '#4a4a4a');
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.moveTo(tree.base.x - 13, tree.base.y);
    ctx.quadraticCurveTo(tree.base.x - 9, (tree.base.y + tree.fork.y) / 2, tree.fork.x - 5, tree.fork.y);
    ctx.lineTo(tree.fork.x + 5, tree.fork.y);
    ctx.quadraticCurveTo(tree.base.x + 9, (tree.base.y + tree.fork.y) / 2, tree.base.x + 13, tree.base.y);
    ctx.closePath();
    ctx.fill();

    // three branches forking out from the same point
    [
      { to: tree.apex, w0: 5, w1: 2 },
      { to: tree.left, w0: 4.5, w1: 1.6 },
      { to: tree.right, w0: 4.5, w1: 1.6 }
    ].forEach(function (b) {
      var midX = (tree.fork.x + b.to.x) / 2 + (b.to.x - tree.fork.x) * 0.15;
      var midY = (tree.fork.y + b.to.y) / 2 - 10;
      var grad = ctx.createLinearGradient(tree.fork.x, tree.fork.y, b.to.x, b.to.y);
      grad.addColorStop(0, '#454545');
      grad.addColorStop(1, '#5c5c5c');
      ctx.strokeStyle = grad;
      ctx.lineWidth = b.w0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tree.fork.x, tree.fork.y);
      ctx.quadraticCurveTo(midX, midY, b.to.x, b.to.y);
      ctx.stroke();
    });

    // leaf clusters (precomputed, just placed — no per-frame randomness)
    tree.leaves.forEach(function (l, i) {
      var anchor = i < 10 ? tree.apex : (i < 19 ? tree.left : tree.right);
      var gray = Math.round(70 + l.shade * 70);
      ctx.fillStyle = 'rgba(' + gray + ',' + gray + ',' + gray + ',0.85)';
      ctx.save();
      ctx.translate(anchor.x + l.dx, anchor.y + l.dy);
      ctx.rotate(l.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, l.w, l.h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  function drawStem(sway) {
    if (!fruit.isAttached) return;
    var apex = tree.apex;
    var sx = apex.x + Math.sin(sway) * 18;
    var sy = apex.y;
    ctx.save();
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + fruit.x) / 2, (sy + fruit.y) / 2 - 6, fruit.x, fruit.y - fruit.radius + 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawFruit() {
    var pulse = Math.sin(fruit.pulseTimer) * 0.15 + 0.95;
    var glowRadius = fruit.radius * 2.1 * pulse;

    ctx.save();
    var glow = ctx.createRadialGradient(fruit.x, fruit.y, 1, fruit.x, fruit.y, glowRadius);
    glow.addColorStop(0, 'rgba(92,124,147,0.55)');
    glow.addColorStop(0.4, 'rgba(92,124,147,0.16)');
    glow.addColorStop(1, 'rgba(92,124,147,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(fruit.x, fruit.y);
    ctx.rotate(fruit.rotation);
    ctx.beginPath();
    ctx.fillStyle = '#4A6577';
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();

    var hi = ctx.createRadialGradient(-5, -5, 1, 0, 0, fruit.radius);
    hi.addColorStop(0, 'rgba(255,255,255,0.4)');
    hi.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    hi.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.beginPath();
    ctx.fillStyle = hi;
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = fruit.isHovered ? '#ffffff' : 'rgba(255,255,255,0.32)';
    ctx.lineWidth = fruit.isHovered ? 2.4 : 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    particles = particles.filter(function (p) {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vx += (windSpeed * 0.005) * Math.sin(time * 2 + p.y * 0.01);
      if (p.angle !== undefined) p.angle += p.spin || 0;
      var a = p.alpha * (1 - p.life / p.maxLife);
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.angle !== undefined) ctx.rotate(p.angle);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.type === 'leaf' ? '#5a5a5a' : p.color;
      ctx.beginPath();
      if (p.type === 'petal') ctx.ellipse(0, 0, p.radius * 1.4, p.radius * 0.85, 0, 0, Math.PI * 2);
      else if (p.type === 'leaf') ctx.ellipse(0, 0, p.radius * 1.5, p.radius * 0.6, Math.PI / 4, 0, Math.PI * 2);
      else ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return p.life < p.maxLife && p.y < height + 30 && p.x > -50 && p.x < width + 50;
    });
    if (Math.random() < 0.05) {
      particles.push({
        x: width * 0.5 + (Math.random() * 220 - 110), y: height * 0.88,
        vx: (Math.random() - 0.5) * 0.5, vy: -0.35 - Math.random() * 0.5,
        radius: 1 + Math.random() * 1.4, alpha: 0.75, color: 'rgba(200,200,200,0.4)',
        life: 0, maxLife: 100 + Math.random() * 70, type: 'spark'
      });
    }
  }

  function updateFruit(sway) {
    fruit.pulseTimer += 0.04;
    if (fruit.isAttached) {
      var apex = tree.apex;
      var swing = Math.sin(time * 2.2 + fruit.pulseTimer) * 4 * (windSpeed * 0.5);
      fruit.x = apex.x + Math.sin(sway) * 18 + swing;
      fruit.y = apex.y + 24 + Math.abs(swing) * 0.2;
      fruit.rotation = swing * 0.02;
      return;
    }
    fruit.vy += 0.32;
    fruit.vx *= 0.99;
    fruit.x += fruit.vx;
    fruit.y += fruit.vy;
    fruit.rotation += fruit.rotVelocity;
    fruit.rotVelocity *= 0.98;

    var groundY = height * 0.86;
    if (fruit.y + fruit.radius >= groundY) {
      fruit.y = groundY - fruit.radius;
      fruit.vy = -fruit.vy * 0.32;
      fruit.vx *= 0.55;
      fruit.rotVelocity = fruit.vx * 0.03;
      if (Math.abs(fruit.vy) < 0.8) fruit.vy = 0;
      if (fruit.bounceCount < 3) {
        fruit.bounceCount++;
        playSound('thud');
        spawnGroundDust(fruit.x, groundY);
      }
    }
    if (fruit.y > height + 60) {
      fruit.y = height + 50; fruit.vy = 0;
      isFruitGrown = false;
      if (regrowBtn) regrowBtn.hidden = false;
    }
  }

  function frame() {
    if (!running) return;
    time += 0.015;
    width = canvas.width / dpr;
    height = canvas.height / dpr;

    windSwayAngle = Math.sin(time * 1.4) * (windSpeed * 0.01);
    if (shakeIntensity > 0.05) shakeIntensity *= 0.88; else shakeIntensity = 0;

    ctx.clearRect(0, 0, width, height);
    drawBackdrop();
    updateFruit(windSwayAngle);
    drawTree(windSwayAngle);
    drawStem(windSwayAngle);
    drawFruit();
    drawParticles();

    if (hovering) positionPopover();

    rafId = requestAnimationFrame(frame);
  }

  function renderStaticFrame() {
    width = canvas.width / dpr;
    height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);
    drawBackdrop();
    fruit.x = tree.apex.x;
    fruit.y = tree.apex.y + 24;
    drawTree(0);
    drawStem(0);
    drawFruit();
  }

  function resize() {
    var rect = stage.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = rect.width;
    height = rect.height;
    buildTree();
    fruit.x = tree.apex.x;
    fruit.y = tree.apex.y + 24;
    if (reduceMotion) renderStaticFrame();
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  window.addEventListener('resize', resize);
  resize();

  if (!reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
    }, { threshold: 0.1 });
    io.observe(canvas);

    canvas.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      handleMove(e.clientX - r.left, e.clientY - r.top);
      canvas.style.cursor = hovering ? 'pointer' : 'default';
    });
    canvas.addEventListener('pointerleave', function () {
      hovering = false; fruit.isHovered = false; hidePopover();
    });
    canvas.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect();
      handleTap(e.clientX - r.left, e.clientY - r.top);
    });

    if (windBtn) windBtn.addEventListener('click', windGust);
    if (regrowBtn) regrowBtn.addEventListener('click', regrow);
  } else {
    if (windBtn) windBtn.hidden = true;
    if (regrowBtn) regrowBtn.hidden = true;
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('click', function () {
      window.location.href = launchLink ? launchLink.getAttribute('href') : '/priceminder/';
    });
  }

  if (launchLink) {
    launchLink.addEventListener('click', function () { playSound('sweep'); });
  }
})();

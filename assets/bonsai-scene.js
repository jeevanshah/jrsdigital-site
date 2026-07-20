/* Bonsai showcase — vanilla-JS port of a React/Canvas "living tree" component.
   Ported down to a single icon (PriceMinder is the only app JRS Digital has
   right now) and to plain Canvas2D + Web Audio, since this site has no build
   step, no React, and no bundler to compile JSX/TSX.

   The backdrop is the real photo (/assets/img/bonsai-backdrop.webp) — a
   bonsai growing out of a phone in moss, city skyline behind it — laid in
   as a plain <img> (grayscale via CSS) behind this transparent canvas. The
   canvas only draws the interactive icon, its glow, its connecting stem,
   and a few wind-blown particles on top of that photo.

   Respects prefers-reduced-motion (renders one static frame, no physics/
   particles) and falls back to the phone-mockup card if canvas isn't
   supported. Pauses the render loop when scrolled off-screen. */
(function () {
  var root = document.querySelector('[data-bonsai]');
  if (!root) return;

  var canvas = root.querySelector('[data-bonsai-canvas]');
  var stage = root.querySelector('[data-bonsai-stage]');
  var fallback = root.querySelector('[data-bonsai-fallback]');
  var popover = root.querySelector('[data-bonsai-popover]');
  var windBtn = root.querySelector('[data-bonsai-wind]');
  var regrowBtn = root.querySelector('[data-bonsai-regrow]');
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
  var windSpeed = 1;
  var windSway = 0;
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

  // The photo's own pixel dimensions — needed to work out exactly how
  // object-fit: cover crops it once .bonsai-stage is free to be any size
  // (full width, viewport-relative height) rather than matching the
  // photo's aspect ratio 1:1.
  var PHOTO_W = 1376, PHOTO_H = 768;

  // Converts a fraction of the *original photo* (0-1, 0-1) into a pixel
  // coordinate inside the stage, replicating what object-fit: cover +
  // object-position: center do to the image. Without this, the icon's
  // anchor point drifts off the branch as soon as the stage's aspect
  // ratio stops matching the photo's.
  function photoFractionToPixel(fx, fy) {
    var containerAspect = width / height;
    var photoAspect = PHOTO_W / PHOTO_H;
    var scale, offsetX = 0, offsetY = 0;
    if (containerAspect > photoAspect) {
      // Stage is wider/shorter than the photo — photo scales to the
      // stage's width, top/bottom get cropped evenly.
      scale = width / PHOTO_W;
      offsetY = (PHOTO_H * scale - height) / 2;
      return { x: fx * PHOTO_W * scale, y: fy * PHOTO_H * scale - offsetY };
    }
    // Stage is taller/narrower than the photo — photo scales to the
    // stage's height, left/right get cropped evenly.
    scale = height / PHOTO_H;
    offsetX = (PHOTO_W * scale - width) / 2;
    return { x: fx * PHOTO_W * scale - offsetX, y: fy * PHOTO_H * scale };
  }

  // The one spot on the real photo's left-hand blossom branch where the
  // icon sits — measured directly against bonsai-backdrop.webp.
  var anchorFrac = { x: 0.40, y: 0.47 };
  // Same technique for the moss bed the icon lands/bounces on when plucked.
  var groundFracY = 0.74;
  var anchor = { x: 0, y: 0 };

  var icon = {
    x: 0, y: 0, vx: 0, vy: 0, size: 24, bounceCount: 0,
    rotation: 0, rotVelocity: 0, pulseTimer: 0,
    isAttached: true, isHovered: false
  };
  var isIconGrown = true;
  var isCompiling = false;

  function isOverIcon(mx, my) {
    return Math.hypot(icon.x - mx, icon.y - my) <= icon.size + 12;
  }

  // ---------- particles: a light scatter of blossom petals on pluck/gust ----------
  var particles = [];
  function spawnGroundDust(x, y) {
    for (var i = 0; i < 6; i++) {
      particles.push({
        x: x, y: y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2 - 0.5,
        radius: 1.5 + Math.random() * 2, alpha: 0.7, color: 'rgba(255,255,255,0.4)',
        life: 0, maxLife: 40 + Math.random() * 30
      });
    }
  }
  function triggerShake() {
    shakeIntensity = 10;
    for (var i = 0; i < 7; i++) {
      var angle = -Math.PI / 4 - Math.random() * (Math.PI / 2);
      var speed = 1 + Math.random() * 1.8;
      particles.push({
        x: anchor.x + (Math.random() * 60 - 30),
        y: anchor.y + (Math.random() * 30 - 10),
        vx: Math.cos(angle) * speed + windSpeed * 0.4,
        vy: Math.sin(angle) * speed + (Math.random() * 1.2 + 0.3),
        radius: 2.5 + Math.random() * 3.5, alpha: 0.85, color: '#f2f2f2',
        life: 0, maxLife: 90 + Math.random() * 60,
        angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.08
      });
    }
  }
  function windGust() {
    windSpeed = 2.6;
    playSound('rustle');
    for (var i = 0; i < 12; i++) {
      particles.push({
        x: anchor.x + Math.random() * width * 0.3 - width * 0.05,
        y: anchor.y + Math.random() * height * 0.25,
        vx: 1.4 + Math.random() * 1.8, vy: Math.random() * 0.6 - 0.15,
        radius: 2 + Math.random() * 2.6, alpha: 0.8, color: '#f0f0f0',
        life: 0, maxLife: 110 + Math.random() * 70
      });
    }
    setTimeout(function () { windSpeed = 1; }, 1500);
  }

  // ---------- popover ----------
  function showPopover() {
    if (!popover) return;
    popover.hidden = false;
    var statusEl = popover.querySelector('[data-bonsai-popover-status]');
    var actionEl = popover.querySelector('[data-bonsai-popover-action]');
    if (statusEl) statusEl.textContent = icon.isAttached ? 'On the tree' : 'Harvested';
    if (actionEl) actionEl.textContent = icon.isAttached ? 'Tap to pluck it off the branch' : 'Tap again to open PriceMinder';
    positionPopover();
  }
  function hidePopover() { if (popover) popover.hidden = true; }
  function positionPopover() {
    if (!popover || popover.hidden) return;
    popover.style.left = icon.x + 'px';
    popover.style.top = (icon.y - icon.size - 10) + 'px';
  }

  // ---------- pointer interaction ----------
  var hovering = false;
  function handleMove(mx, my) {
    var over = isOverIcon(mx, my);
    if (over && !hovering) {
      hovering = true;
      icon.isHovered = true;
      playSound('rustle');
      showPopover();
    } else if (!over && hovering) {
      hovering = false;
      icon.isHovered = false;
      hidePopover();
    } else if (over) {
      positionPopover();
    }
  }
  function handleTap(mx, my) {
    if (!isOverIcon(mx, my)) return;
    if (icon.isAttached) {
      icon.isAttached = false;
      icon.vy = -1;
      icon.vx = (Math.random() - 0.5) * 3.4 + windSpeed * 0.4;
      icon.rotVelocity = (Math.random() - 0.5) * 0.2;
      playSound('pluck');
      triggerShake();
      showPopover();
    } else {
      playSound('sweep');
      window.location.href = launchLink ? launchLink.getAttribute('href') : '/priceminder/';
    }
  }

  function regrow() {
    if (isCompiling || isIconGrown) return;
    isCompiling = true;
    if (regrowBtn) { regrowBtn.disabled = true; regrowBtn.setAttribute('aria-label', 'Regrowing'); }
    playSound('sweep');
    var progress = 0;
    var interval = setInterval(function () {
      progress += 8;
      if (progress >= 100) {
        clearInterval(interval);
        isCompiling = false;
        isIconGrown = true;
        if (regrowBtn) { regrowBtn.disabled = false; regrowBtn.hidden = true; regrowBtn.setAttribute('aria-label', 'Regrow'); }
        icon.isAttached = true;
        icon.vx = 0; icon.vy = 0; icon.rotation = 0; icon.rotVelocity = 0; icon.bounceCount = 0;
      }
    }, 45);
  }

  // ---------- drawing ----------
  function roundedSquarePath(cx, cy, half, r) {
    ctx.beginPath();
    ctx.moveTo(cx - half + r, cy - half);
    ctx.arcTo(cx + half, cy - half, cx + half, cy + half, r);
    ctx.arcTo(cx + half, cy + half, cx - half, cy + half, r);
    ctx.arcTo(cx - half, cy + half, cx - half, cy - half, r);
    ctx.arcTo(cx - half, cy - half, cx + half, cy - half, r);
    ctx.closePath();
  }

  function drawIcon() {
    var pulse = Math.sin(icon.pulseTimer) * 0.15 + 0.95;
    var glowRadius = icon.size * 2.4 * pulse;
    var r = icon.size * 0.28; // squircle corner radius — closer to a real app-icon shape than a plain rounded square

    // Ambient color glow — reads at a distance, separate from the hard
    // drop shadow below (which sells the icon sitting a little in front
    // of the photo, not just glowing).
    ctx.save();
    var glow = ctx.createRadialGradient(icon.x, icon.y, 1, icon.x, icon.y, glowRadius);
    glow.addColorStop(0, 'rgba(92,124,147,0.5)');
    glow.addColorStop(0.45, 'rgba(92,124,147,0.14)');
    glow.addColorStop(1, 'rgba(92,124,147,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(icon.x, icon.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(icon.x, icon.y);
    ctx.rotate(icon.rotation);

    // Elevation shadow, drawn under the body separately so it doesn't
    // also blur the highlight/stroke/glyph drawn on top of it.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = icon.size * 0.6;
    ctx.shadowOffsetY = icon.size * 0.22;
    roundedSquarePath(0, 0, icon.size, r);
    ctx.fillStyle = '#000'; // fully opaque so the cast shadow is visible — this square itself gets completely covered by the body fill drawn right after
    ctx.fill();
    ctx.restore();

    roundedSquarePath(0, 0, icon.size, r);
    var body = ctx.createLinearGradient(-icon.size, -icon.size, icon.size, icon.size);
    body.addColorStop(0, '#5C7C93');
    body.addColorStop(1, '#3A4E5E');
    ctx.fillStyle = body;
    ctx.fill();

    // Soft top-left gloss, kept subtle so the icon still reads as flat/
    // modern rather than glassy.
    roundedSquarePath(0, 0, icon.size, r);
    var hi = ctx.createLinearGradient(-icon.size, -icon.size, icon.size * 0.2, icon.size * 0.2);
    hi.addColorStop(0, 'rgba(255,255,255,0.28)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fill();

    roundedSquarePath(0, 0, icon.size, r);
    ctx.strokeStyle = icon.isHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = icon.isHovered ? 1.8 : 1;
    ctx.stroke();

    // "$" glyph — PriceMinder is a subscription/price tracker, not a
    // generic app mark, so the glyph should say that at a glance.
    ctx.fillStyle = '#F6F8F9';
    ctx.font = '600 ' + Math.round(icon.size * 1.05) + "px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, icon.size * 0.04);

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
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 1.3, p.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return p.life < p.maxLife && p.y < height + 30 && p.x > -50 && p.x < width + 50;
    });
  }

  function updateIcon() {
    icon.pulseTimer += 0.04;
    if (icon.isAttached) {
      // Small sway, on purpose — this icon is "hanging" on a real, static
      // photo of a branch, so it should stay close to that exact point
      // rather than swinging far enough to look detached from it.
      var swing = Math.sin(time * 2 + icon.pulseTimer) * 2.2 * windSpeed;
      icon.x = anchor.x + swing;
      icon.y = anchor.y + Math.abs(swing) * 0.15;
      icon.rotation = swing * 0.012;
      return;
    }
    icon.vy += 0.3;
    icon.vx *= 0.99;
    icon.x += icon.vx;
    icon.y += icon.vy;
    icon.rotation += icon.rotVelocity;
    icon.rotVelocity *= 0.98;

    // Lands roughly on the moss bed around the phone in the photo, not the
    // very bottom edge of the frame — same crop-aware mapping as the anchor.
    var groundY = photoFractionToPixel(0.5, groundFracY).y;
    if (icon.y + icon.size >= groundY) {
      icon.y = groundY - icon.size;
      icon.vy = -icon.vy * 0.3;
      icon.vx *= 0.5;
      icon.rotVelocity = icon.vx * 0.03;
      if (Math.abs(icon.vy) < 0.8) icon.vy = 0;
      if (icon.bounceCount < 3) {
        icon.bounceCount++;
        playSound('thud');
        spawnGroundDust(icon.x, groundY);
      }
    }
    if (icon.y > height + 60) {
      icon.y = height + 50; icon.vy = 0;
      isIconGrown = false;
      if (regrowBtn) regrowBtn.hidden = false;
    }
  }

  function frame() {
    if (!running) return;
    time += 0.015;
    width = canvas.width / dpr;
    height = canvas.height / dpr;

    windSway = Math.sin(time * 1.2) * (windSpeed * 0.01);
    if (shakeIntensity > 0.05) shakeIntensity *= 0.88; else shakeIntensity = 0;

    ctx.clearRect(0, 0, width, height);
    updateIcon();
    drawIcon();
    drawParticles();

    if (hovering) positionPopover();

    rafId = requestAnimationFrame(frame);
  }

  function renderStaticFrame() {
    width = canvas.width / dpr;
    height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);
    icon.x = anchor.x;
    icon.y = anchor.y;
    drawIcon();
  }

  function resize() {
    var rect = stage.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = rect.width;
    height = rect.height;
    anchor = photoFractionToPixel(anchorFrac.x, anchorFrac.y);
    icon.size = Math.max(22, Math.min(40, Math.min(width, height) * 0.06));
    if (icon.isAttached) { icon.x = anchor.x; icon.y = anchor.y; }
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
      hovering = false; icon.isHovered = false; hidePopover();
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

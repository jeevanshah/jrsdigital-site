// Live 3D phone render for the "Visual engineering" section.
// A real-time WebGL object (not a video/GIF): a rounded slab body rendered
// with a studio 3-point light rig + a violet accent light matching the
// app's own button/accent color, and the real dashboard screenshot mapped
// onto the screen face. Oscillates gently forever; respects
// prefers-reduced-motion, pauses off-screen, and falls back to the static
// CSS phone mockup if WebGL isn't available.

(function () {
  var mount = document.querySelector('[data-scene-3d]');
  if (!mount) return;

  var fallback = mount.querySelector('[data-scene-fallback]');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showFallback() {
    mount.classList.add('scene-3d--fallback');
    if (fallback) fallback.style.display = 'flex';
  }

  // Bail out early and cleanly if the browser can't do WebGL at all.
  try {
    var testCanvas = document.createElement('canvas');
    if (!(window.WebGLRenderingContext &&
      (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')))) {
      showFallback();
      return;
    }
  } catch (e) {
    showFallback();
    return;
  }

  import('https://unpkg.com/three@0.160.0/build/three.module.js')
    .then(function (THREE) { init(THREE); })
    .catch(function () { showFallback(); });

  function init(THREE) {
    var canvas = mount.querySelector('canvas');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      showFallback();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    // Distance tuned so the full phone (with a margin to spare) fits in
    // frame — see the fit calc below, after we know the geometry's real size.
    camera.lookAt(0, 0, 0);

    // ---- studio 3-point rig + a violet accent light matching the app's
    // real button/accent color, standing in for "screen glow" bleeding
    // onto the case. ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    var key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3.5, 4, 4);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-4, -1, 3);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xaeb8ff, 0.55);
    rim.position.set(-2, 2, -4);
    scene.add(rim);

    // Softer + farther than the first pass, which produced a small blown-out
    // hotspot on the metal body instead of a gentle ambient bleed.
    var glow = new THREE.PointLight(0x5852ff, 1.6, 10, 1.6);
    glow.position.set(0.3, -0.2, 2.4);
    scene.add(glow);

    // ---- rounded phone slab, built from an extruded rounded-rect shape
    // rather than a plain box, so the edges actually read as a device
    // rather than a brick. ----
    var w = 1.9, h = 1.9 * 19.3 / 9, r = 0.22, depth = 0.16;
    var shape = new THREE.Shape();
    var x = -w / 2, y = -h / 2;
    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);

    var bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 5,
      curveSegments: 24
    });
    bodyGeo.center();

    // bevelEnabled adds bevelThickness *on top of* `depth` at the front
    // face — positioning the screen at depth/2 (ignoring the bevel) buried
    // it just behind the body's own front surface, so only the metal body
    // was ever visible. Read the geometry's real bounding box instead of
    // hand-computing it, so this can't drift out of sync again.
    bodyGeo.computeBoundingBox();
    var frontZ = bodyGeo.boundingBox.max.z;

    var bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b1b20,
      metalness: 0.85,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    scene.add(body);

    // Screen: its own emissive-lit plane so it reads as "on" regardless of
    // the studio lighting angle, with the real app screenshot as the texture.
    var texture = new THREE.TextureLoader().load('/assets/img/priceminder-dashboard.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    var screenGeo = new THREE.PlaneGeometry(w - 0.16, h - 0.16);
    var screenMat = new THREE.MeshBasicMaterial({ map: texture });
    var screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = frontZ + 0.005;
    scene.add(screen);

    // Punch-hole camera, same visual language as the CSS phone-frame shell.
    var cam = new THREE.Mesh(
      new THREE.CircleGeometry(0.035, 20),
      new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6 })
    );
    cam.position.set(0, h / 2 - 0.14, frontZ + 0.006);
    scene.add(cam);

    var group = new THREE.Group();
    group.add(body, screen, cam);
    group.rotation.y = -0.32;
    group.rotation.x = 0.08;
    scene.add(group);

    // Fit the camera distance to the phone's actual height so the whole
    // device sits inside the frame with breathing room, instead of the
    // fixed guessed distance that was cropping the top/bottom off.
    var vFov = (camera.fov * Math.PI) / 180;
    var fitDistance = (h * 1.35) / (2 * Math.tan(vFov / 2));
    camera.position.set(fitDistance * 0.14, fitDistance * 0.05, fitDistance);
    camera.lookAt(0, 0, 0);

    function size() {
      var w0 = mount.clientWidth, h0 = mount.clientHeight;
      if (!w0 || !h0) return;
      camera.aspect = w0 / h0;
      camera.updateProjectionMatrix();
      renderer.setSize(w0, h0, false);
    }
    size();
    window.addEventListener('resize', size);

    var clock = new THREE.Clock();
    var running = true;
    var raf = null;

    function render() {
      var t = clock.getElapsedTime();
      if (!reduceMotion) {
        group.rotation.y = -0.32 + Math.sin(t * 0.5) * 0.26;
        group.rotation.x = 0.08 + Math.cos(t * 0.4) * 0.09;
        group.position.y = Math.sin(t * 0.8) * 0.05;
      }
      renderer.render(scene, camera);
      if (running && !reduceMotion) raf = requestAnimationFrame(render);
    }
    render();

    // Pause the render loop when scrolled out of view, and don't bother
    // animating at all if the user asked for reduced motion.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !running) {
            running = true;
            if (!reduceMotion) render();
          } else if (!entry.isIntersecting && running) {
            running = false;
            if (raf) cancelAnimationFrame(raf);
          }
        });
      }, { threshold: 0.05 }).observe(mount);
    }
  }
})();

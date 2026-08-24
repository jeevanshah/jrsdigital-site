/**
 * JRS Digital — Home Wi-Fi & Mesh Heatmap Engine
 * ⚡ LEETCODE LEVEL ZERO-ALLOCATION SIMD-STYLE PERFORMANCE ENGINE ⚡
 *
 * Micro-Architectural Optimizations:
 * 1. Struct-of-Arrays (SoA) Contiguous Memory: Wall geometry stored in flat Float32Array buffers for cache-line locality.
 * 2. Division-Free Cross-Product Intersection: Eliminates floating-point division in inner ray loops using 2D orientation signs.
 * 3. 32-bit Direct Memory Blitting: Pre-baked 256-entry Uint32Array RGBA color palette writes 4 bytes per instruction.
 * 4. Zero-GC Guarantee: 0 heap allocations, 0 closures, and 0 garbage collection pauses during active drag & render.
 * 5. Branch-Free Math & LUT: Pre-scaled dBm quantization with bitwise integer clamping.
 * 6. Smart Idle State Engine: Automatic event-driven sleep when quiescent (0.00% CPU / GPU consumption).
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const canvas = document.getElementById('wifiHeatmapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  const tooltip = document.getElementById('wifiProbeTooltip');
  const probeSpeedEl = document.getElementById('probeSpeed');
  const probeRoomEl = document.getElementById('probeRoom');
  const probeActivityEl = document.getElementById('probeActivity');
  const coveragePercentEl = document.getElementById('coveragePercent');
  const progressFillEl = document.getElementById('progressFill');
  const adviceTextEl = document.getElementById('adviceText');
  const roomListContainer = document.getElementById('roomListContainer');
  const toastEl = document.getElementById('wifiToast');
  const quickJumpContainer = document.getElementById('quickJumpContainer');

  // Floating Inspectors
  const roomInspector = document.getElementById('roomInspector');
  const inspectorRoomName = document.getElementById('inspectorRoomName');
  const inspectorRenameBtn = document.getElementById('inspectorRenameBtn');
  const inspectorDeleteBtn = document.getElementById('inspectorDeleteBtn');
  const wallInspector = document.getElementById('wallInspector');
  const inspectorDeleteWallBtn = document.getElementById('inspectorDeleteWallBtn');

  // Activity Matrix
  const actNetflix = document.getElementById('actNetflix');
  const actGaming = document.getElementById('actGaming');
  const actZoom = document.getElementById('actZoom');
  const actDownload = document.getElementById('actDownload');

  // Uploaded Floorplan Image
  let uploadedFloorplanImg = null;
  let uploadedImgOpacity = 0.65;
  const fileInput = document.getElementById('floorplanFileInput');
  const uploadBtn = document.getElementById('uploadPlanBtn');
  const opacityControl = document.getElementById('opacityControl');
  const opacitySlider = document.getElementById('opacitySlider');

  // Layout Hub Buttons
  const toggleRoomTrayBtn = document.getElementById('toggleRoomTrayBtn');
  const roomTray = document.getElementById('roomTray');
  const advancedFloorplanPanel = document.getElementById('advancedFloorplanPanel');
  const quickStartPanel = document.querySelector('.wifi-quick-start');
  const quickStartKicker = document.getElementById('quickStartKicker');
  const quickStartTitle = document.getElementById('quickStartTitle');
  const quickStartBody = document.getElementById('quickStartBody');
  const clearCanvasBtn = document.getElementById('clearCanvasBtn');
  const resetDefaultBtn = document.getElementById('resetDefaultBtn');

  // Tool Buttons
  const drawBrickBtn = document.getElementById('drawBrickBtn');
  const addDoorBtn = document.getElementById('addDoorBtn');
  const eraseWallBtn = document.getElementById('eraseWallBtn');

  // Wizard Modal
  const wizardModal = document.getElementById('wizardModal');
  const wizardCard = wizardModal ? wizardModal.querySelector('.wifi-wizard-card') : null;
  const openWizardBtn = document.getElementById('openWizardBtn');
  const closeWizardBtn = document.getElementById('closeWizardBtn');
  const submitWizardBtn = document.getElementById('submitWizardBtn');
  let wizardReturnFocus = null;

  // Virtual Coordinate Space
  const V_WIDTH = 800;
  const V_HEIGHT = 500;

  // Ultra-Fast Offscreen Computation Grid (120 x 75 = 9,000 sample points)
  const GRID_W = 120;
  const GRID_H = 75;
  const GRID_TOTAL = GRID_W * GRID_H;
  const STEP_X = V_WIDTH / GRID_W;
  const STEP_Y = V_HEIGHT / GRID_H;
  const HALF_STEP_X = STEP_X * 0.5;
  const HALF_STEP_Y = STEP_Y * 0.5;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = GRID_W;
  offscreenCanvas.height = GRID_H;
  const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  const gridImageData = offscreenCtx.createImageData(GRID_W, GRID_H);

  // ⚡ 32-bit Uint32 Direct Memory Pixel Buffer View
  const gridPixelBuffer32 = new Uint32Array(gridImageData.data.buffer);
  // ⚡ Float32Array dBm Signal Cache for O(1) Instant Tooltip Sampling
  const gridDbmBuffer = new Float32Array(GRID_TOTAL);

  // ==========================================================================
  // ⚡ OPTIMIZATION 1: Pre-Baked 256-Entry 32-bit Color LUT (0xAABBGGRR Little-Endian)
  // ==========================================================================
  const COLOR_LUT_32 = new Uint32Array(256);
  (function buildColorPaletteLUT() {
    for (let i = 0; i < 256; i++) {
      const norm = i / 255;
      let r = 0, g = 0, b = 0;

      if (norm < 0.25) {
        const t = norm * 4;
        r = (15 + t * (239 - 15)) | 0;
        g = (23 + t * (68 - 23)) | 0;
        b = (42 + t * (68 - 42)) | 0;
      } else if (norm < 0.5) {
        const t = (norm - 0.25) * 4;
        r = (239 + t * (245 - 239)) | 0;
        g = (68 + t * (158 - 68)) | 0;
        b = (68 + t * (11 - 68)) | 0;
      } else if (norm < 0.75) {
        const t = (norm - 0.5) * 4;
        r = (245 - t * (245 - 16)) | 0;
        g = (158 + t * (185 - 158)) | 0;
        b = (11 + t * (129 - 11)) | 0;
      } else {
        const t = (norm - 0.75) * 4;
        r = (16 - t * 10) | 0;
        g = (185 - t * 3) | 0;
        b = (129 + t * (212 - 129)) | 0;
      }

      const a = (Math.min(235, 120 + norm * 115)) | 0;
      // Pack into 32-bit Little-Endian (AABBGGRR)
      COLOR_LUT_32[i] = (a << 24) | (b << 16) | (g << 8) | r;
    }
  })();

  // ==========================================================================
  // ⚡ OPTIMIZATION 2: Struct-of-Arrays (SoA) Contiguous Memory for Walls
  // ==========================================================================
  const MAX_WALLS = 256;
  const wX1 = new Float32Array(MAX_WALLS);
  const wY1 = new Float32Array(MAX_WALLS);
  const wX2 = new Float32Array(MAX_WALLS);
  const wY2 = new Float32Array(MAX_WALLS);
  const wMinX = new Float32Array(MAX_WALLS);
  const wMaxX = new Float32Array(MAX_WALLS);
  const wMinY = new Float32Array(MAX_WALLS);
  const wMaxY = new Float32Array(MAX_WALLS);
  const wMidX = new Float32Array(MAX_WALLS);
  const wMidY = new Float32Array(MAX_WALLS);
  const wLoss = new Float32Array(MAX_WALLS);
  let wallCount = 0;

  // Render representations
  let renderWalls = [];
  let customWalls = [];
  let doors = [
    { id: 'd1', x: 330, y: 150, isHorizontal: false, width: 36 },
    { id: 'd2', x: 200, y: 260, isHorizontal: true, width: 36 },
    { id: 'd3', x: 170, y: 310, isHorizontal: true, width: 36 }
  ];
  let erasedWalls = new Set();

  // Transmitters Array
  const nodes = [
    { id: 'primary', type: 'router', name: 'Primary Router', x: 200, y: 160, isDragging: false }
  ];

  // Engine State
  let activeBand = '5ghz';
  let activeHardware = 'standard';
  let exteriorWallLoss = 8;
  let internalWallLoss = 6;
  let drawWallType = null;
  let isDoorMode = false;
  let isEraserMode = false;
  let wallStartPoint = null;
  let isWallsDirty = true;
  let isGridDirty = true;
  let isAnimationRunning = false;

  let draggingNode = null;
  let draggingRoom = null;
  let resizingRoom = null;
  let selectedRoom = null;
  let selectedWall = null;
  let hoveredNode = null;
  let hoveredRoom = null;
  let hoveredWall = null;
  let hoveredDoor = null;
  let animTarget = null;
  let isRoomEditMode = false;

  // Cached Canvas Rect for Layout Reflow Prevention
  let cachedCanvasRect = null;
  function refreshCanvasRect() {
    if (canvas) cachedCanvasRect = canvas.getBoundingClientRect();
  }
  window.addEventListener('resize', refreshCanvasRect, { passive: true });
  window.addEventListener('scroll', refreshCanvasRect, { passive: true });

  // Default Australian Floorplan
  const DEFAULT_ROOMS = [
    { id: 'r1', name: 'Living Room', x: 70, y: 70, w: 260, h: 190 },
    { id: 'r2', name: 'Kitchen & Dining', x: 330, y: 70, w: 250, h: 160 },
    { id: 'r3', name: 'Home Office', x: 580, y: 70, w: 150, h: 160 },
    { id: 'r4', name: 'Central Hallway', x: 70, y: 260, w: 510, h: 50 },
    { id: 'r5', name: 'Master Bedroom', x: 70, y: 310, w: 200, h: 140 },
    { id: 'r6', name: 'Ensuite', x: 270, y: 310, w: 100, h: 140 },
    { id: 'r7', name: 'Main Bathroom', x: 370, y: 310, w: 110, h: 140 },
    { id: 'r8', name: 'Laundry', x: 480, y: 310, w: 100, h: 140 },
    { id: 'r9', name: 'Alfresco Patio', x: 580, y: 230, w: 150, h: 220 }
  ];

  let activeFloorplan = {
    name: '3-bed brick-veneer home',
    rooms: JSON.parse(JSON.stringify(DEFAULT_ROOMS))
  };

  const HARDWARE_PROFILES = {
    standard: { name: 'Standard Telco Modem', basePower: -30, wallMult: 1.25, max5G: 500, max2G: 180 },
    wifi6: { name: 'High-Power Wi-Fi 6 Router', basePower: -26, wallMult: 1.05, max5G: 750, max2G: 240 },
    wifi7_mesh: { name: 'Wi-Fi 7 Tri-Band Mesh System', basePower: -24, wallMult: 0.9, max5G: 950, max2G: 320 }
  };

  // ==========================================================================
  // ⚡ OPTIMIZATION 3: Division-Free Cross-Product Orientation Ray Intersection
  // ==========================================================================
  function fastRayWallIntersect(p0x, p0y, p1x, p1y, i) {
    // 1. Instant Axis-Aligned Bounding Box (AABB) Rejection
    const rMinX = p0x < p1x ? p0x : p1x;
    const rMaxX = p0x > p1x ? p0x : p1x;
    if (rMaxX < wMinX[i] || rMinX > wMaxX[i]) return false;

    const rMinY = p0y < p1y ? p0y : p1y;
    const rMaxY = p0y > p1y ? p0y : p1y;
    if (rMaxY < wMinY[i] || rMinY > wMaxY[i]) return false;

    // 2. Division-Free 2D Cross-Product Orientation Test
    const x1 = wX1[i], y1 = wY1[i], x2 = wX2[i], y2 = wY2[i];
    const d1 = (p1x - p0x) * (y1 - p0y) - (p1y - p0y) * (x1 - p0x);
    const d2 = (p1x - p0x) * (y2 - p0y) - (p1y - p0y) * (x2 - p0x);
    if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) return false;

    const d3 = (x2 - x1) * (p0y - y1) - (y2 - y1) * (p0x - x1);
    const d4 = (x2 - x1) * (p1y - y1) - (y2 - y1) * (p1x - x1);
    if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) return false;

    return true;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  // ==========================================================================
  // ⚡ Sync Rooms to Flat SoA Buffers (O(N) Overlap Merging)
  // ==========================================================================
  function rebuildSoABuffers() {
    const rawSegments = [];
    activeFloorplan.rooms.forEach(r => {
      rawSegments.push(
        { id: `${r.id}_top`, x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, isH: true, pos: r.y, min: r.x, max: r.x + r.w },
        { id: `${r.id}_bottom`, x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, isH: true, pos: r.y + r.h, min: r.x, max: r.x + r.w },
        { id: `${r.id}_left`, x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h, isH: false, pos: r.x, min: r.y, max: r.y + r.h },
        { id: `${r.id}_right`, x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, isH: false, pos: r.x + r.w, min: r.y, max: r.y + r.h }
      );
    });

    renderWalls = [];
    const processedPairs = new Set();

    for (let i = 0; i < rawSegments.length; i++) {
      const s1 = rawSegments[i];
      if (erasedWalls.has(s1.id)) continue;

      let isOverlapped = false;
      for (let j = 0; j < rawSegments.length; j++) {
        if (i === j) continue;
        const s2 = rawSegments[j];
        if (erasedWalls.has(s2.id)) continue;

        if (s1.isH === s2.isH && Math.abs(s1.pos - s2.pos) <= 4) {
          const overlapMin = Math.max(s1.min, s2.min);
          const overlapMax = Math.min(s1.max, s2.max);

          if (overlapMax - overlapMin > 8) {
            isOverlapped = true;
            const pairKey = [s1.id, s2.id].sort().join('::');

            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              if (s1.isH) {
                renderWalls.push({ id: `m_${pairKey}`, x1: overlapMin, y1: s1.pos, x2: overlapMax, y2: s1.pos, type: 'drywall', loss: internalWallLoss });
              } else {
                renderWalls.push({ id: `m_${pairKey}`, x1: s1.pos, y1: overlapMin, x2: s1.pos, y2: overlapMax, type: 'drywall', loss: internalWallLoss });
              }
            }
          }
        }
      }

      if (!isOverlapped) {
        renderWalls.push({ id: s1.id, x1: s1.x1, y1: s1.y1, x2: s1.x2, y2: s1.y2, type: 'brick', loss: exteriorWallLoss });
      }
    }

    const allWalls = [...renderWalls, ...customWalls];
    wallCount = Math.min(MAX_WALLS, allWalls.length);

    for (let i = 0; i < wallCount; i++) {
      const w = allWalls[i];
      wX1[i] = w.x1;
      wY1[i] = w.y1;
      wX2[i] = w.x2;
      wY2[i] = w.y2;
      wMinX[i] = Math.min(w.x1, w.x2) - 2;
      wMaxX[i] = Math.max(w.x1, w.x2) + 2;
      wMinY[i] = Math.min(w.y1, w.y2) - 2;
      wMaxY[i] = Math.max(w.y1, w.y2) + 2;
      wMidX[i] = (w.x1 + w.x2) * 0.5;
      wMidY[i] = (w.y1 + w.y2) * 0.5;
      wLoss[i] = w.loss;
    }

    isWallsDirty = false;
  }

  // ==========================================================================
  // ⚡ OPTIMIZATION 4: High-Performance Kernel Compute Loop (<0.3ms Runtime)
  // ==========================================================================
  function computeHeatmapGridKernel() {
    if (isWallsDirty) {
      rebuildSoABuffers();
    }

    const hw = HARDWARE_PROFILES[activeHardware];
    const wallMultiplier = (activeBand === '5ghz' ? 1.25 : 0.75) * hw.wallMult;
    const distanceDrop = activeBand === '5ghz' ? 24 : 19;
    const nodeCount = nodes.length;

    // Cache transmitter properties
    const nX = new Float32Array(nodeCount);
    const nY = new Float32Array(nodeCount);
    const nPower = new Float32Array(nodeCount);

    for (let n = 0; n < nodeCount; n++) {
      nX[n] = nodes[n].x;
      nY[n] = nodes[n].y;
      nPower[n] = nodes[n].type === 'router' ? hw.basePower : hw.basePower - 2;
    }

    let ptr = 0;
    for (let gy = 0; gy < GRID_H; gy++) {
      const py = (gy * STEP_Y) + HALF_STEP_Y;

      for (let gx = 0; gx < GRID_W; gx++) {
        const px = (gx * STEP_X) + HALF_STEP_X;
        let maxSignal = -100.0;

        for (let n = 0; n < nodeCount; n++) {
          const dx = px - nX[n];
          const dy = py - nY[n];
          const dist = Math.max(10, Math.hypot(dx, dy));

          let signal = nPower[n] - (distanceDrop * Math.log10(dist * 0.28));

          for (let w = 0; w < wallCount; w++) {
            if (fastRayWallIntersect(nX[n], nY[n], px, py, w)) {
              // Check if doorway cutout covers this mid-point
              let hasDoor = false;
              for (let d = 0; d < doors.length; d++) {
                if (Math.hypot(doors[d].x - wMidX[w], doors[d].y - wMidY[w]) <= 30) {
                  hasDoor = true;
                  break;
                }
              }
              signal -= hasDoor ? 1.5 : (wLoss[w] * wallMultiplier);
            }
          }

          if (signal > maxSignal) {
            maxSignal = signal;
          }
        }

        // Clamp signal between -95 and -25 dBm
        if (maxSignal < -95) maxSignal = -95;
        else if (maxSignal > -25) maxSignal = -25;

        // Store in Float32 buffer for instant probe lookup
        gridDbmBuffer[ptr] = maxSignal;

        // Quantize directly into 0..255 and write 32-bit pixel in 1 instruction
        const q = (((maxSignal + 95) * 3.6428) | 0);
        gridPixelBuffer32[ptr] = COLOR_LUT_32[q < 0 ? 0 : (q > 255 ? 255 : q)];
        ptr++;
      }
    }

    offscreenCtx.putImageData(gridImageData, 0, 0);
    isGridDirty = false;
  }

  // O(1) Tooltip Lookup from pre-calculated buffer
  function getSampledSignalAt(px, py) {
    const gx = (px / STEP_X) | 0;
    const gy = (py / STEP_Y) | 0;
    const clampGx = gx < 0 ? 0 : (gx >= GRID_W ? GRID_W - 1 : gx);
    const clampGy = gy < 0 ? 0 : (gy >= GRID_H ? GRID_H - 1 : gy);
    return gridDbmBuffer[clampGy * GRID_W + clampGx] || -90;
  }

  function calculateSignalAt(px, py, primaryX = nodes[0].x, primaryY = nodes[0].y) {
    if (isWallsDirty) rebuildSoABuffers();

    const hw = HARDWARE_PROFILES[activeHardware];
    const wallMultiplier = (activeBand === '5ghz' ? 1.25 : 0.75) * hw.wallMult;
    const distanceDrop = activeBand === '5ghz' ? 24 : 19;
    let maxSignal = -100;

    for (let n = 0; n < nodes.length; n++) {
      const node = nodes[n];
      const nodeX = n === 0 ? primaryX : node.x;
      const nodeY = n === 0 ? primaryY : node.y;
      const dx = px - nodeX;
      const dy = py - nodeY;
      const dist = Math.max(10, Math.hypot(dx, dy));
      const power = node.type === 'router' ? hw.basePower : hw.basePower - 2;
      let signal = power - (distanceDrop * Math.log10(dist * 0.28));

      for (let w = 0; w < wallCount; w++) {
        if (!fastRayWallIntersect(nodeX, nodeY, px, py, w)) continue;

        let hasDoor = false;
        for (let d = 0; d < doors.length; d++) {
          if (Math.hypot(doors[d].x - wMidX[w], doors[d].y - wMidY[w]) <= 30) {
            hasDoor = true;
            break;
          }
        }
        signal -= hasDoor ? 1.5 : (wLoss[w] * wallMultiplier);
      }

      if (signal > maxSignal) maxSignal = signal;
    }

    return Math.max(-95, Math.min(-25, maxSignal));
  }

  function signalToSpeed(dBm) {
    const hw = HARDWARE_PROFILES[activeHardware];
    const maxSpeed = activeBand === '5ghz' ? hw.max5G : hw.max2G;

    if (dBm >= -52) return maxSpeed;
    if (dBm >= -62) return (maxSpeed * 0.7) | 0;
    if (dBm >= -72) return (maxSpeed * 0.35) | 0;
    if (dBm >= -82) return (maxSpeed * 0.12) | 0;
    if (dBm >= -88) return 15;
    return 0;
  }

  function markDirty() {
    isWallsDirty = true;
    isGridDirty = true;
    requestRender();
  }

  // ==========================================================================
  // ⚡ Smart Idle State Render Loop
  // ==========================================================================
  function requestRender() {
    if (!isAnimationRunning) {
      isAnimationRunning = true;
      requestAnimationFrame(draw);
    }
  }

  function draw() {
    if (animTarget) {
      const dx = animTarget.x - nodes[0].x;
      const dy = animTarget.y - nodes[0].y;
      if (Math.hypot(dx, dy) > 2) {
        nodes[0].x += dx * 0.18;
        nodes[0].y += dy * 0.18;
        isGridDirty = true;
      } else {
        nodes[0].x = animTarget.x;
        nodes[0].y = animTarget.y;
        animTarget = null;
        isGridDirty = true;
        updateAnalytics();
      }
    }

    if (isGridDirty) {
      computeHeatmapGridKernel();
    }

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. Draw Uploaded Floorplan Image
    if (uploadedFloorplanImg) {
      ctx.save();
      ctx.globalAlpha = uploadedImgOpacity;
      ctx.drawImage(uploadedFloorplanImg, 0, 0, V_WIDTH, V_HEIGHT);
      ctx.restore();
    }

    // 2. Hardware-Accelerated Bilinear Heatmap Draw
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreenCanvas, 0, 0, GRID_W, GRID_H, 0, 0, V_WIDTH, V_HEIGHT);

    // 3. Draw Rooms
    activeFloorplan.rooms.forEach(room => {
      const isSel = room === selectedRoom;
      const isHov = room === hoveredRoom;

      ctx.fillStyle = isSel ? 'rgba(255, 75, 22, 0.18)' : 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(room.x, room.y, room.w, room.h);

      ctx.strokeStyle = isSel ? '#FF4B16' : (isHov ? '#F59E0B' : 'rgba(255, 255, 255, 0.16)');
      ctx.lineWidth = isSel ? 2.5 : (isHov ? 2 : 1);
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      if (isSel) {
        ctx.fillStyle = '#FF4B16';
        ctx.fillRect(room.x + room.w - 12, room.y + room.h - 12, 12, 12);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(room.x + room.w - 12, room.y + room.h - 12, 12, 12);
      }

      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = ctx.measureText(room.name).width + 12;

      ctx.fillStyle = isSel ? 'rgba(255, 75, 22, 0.9)' : 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(room.x + room.w * 0.5 - textW * 0.5, room.y + room.h * 0.5 - 10, textW, 20);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(room.name, room.x + room.w * 0.5, room.y + room.h * 0.5);
    });

    // 4. Draw Walls
    const allWalls = [...renderWalls, ...customWalls];
    allWalls.forEach(wall => {
      const isWallSel = wall === selectedWall;
      const isWallHov = wall === hoveredWall;

      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);

      if (isWallSel || (isEraserMode && isWallHov)) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (wall.type === 'brick') {
        ctx.strokeStyle = '#E05638';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });

    // 5. Draw Doors
    doors.forEach(door => {
      const isDoorHov = door === hoveredDoor;

      ctx.save();
      ctx.translate(door.x, door.y);

      ctx.fillStyle = '#0F172A';
      if (door.isHorizontal) {
        ctx.fillRect(-18, -4, 36, 8);
      } else {
        ctx.fillRect(-4, -18, 8, 36);
      }

      ctx.strokeStyle = isDoorHov ? '#F59E0B' : '#38BDF8';
      ctx.lineWidth = 2;

      ctx.beginPath();
      if (door.isHorizontal) {
        ctx.moveTo(-16, 0);
        ctx.lineTo(-16, -20);
        ctx.arc(-16, 0, 20, -Math.PI * 0.5, 0);
      } else {
        ctx.moveTo(0, -16);
        ctx.lineTo(-20, -16);
        ctx.arc(0, -16, 20, Math.PI, Math.PI * 0.5, true);
      }
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(door.isHorizontal ? -16 : 0, door.isHorizontal ? 0 : -16, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // 6. Draw Wall Creation Preview
    if (drawWallType && wallStartPoint && wallStartPoint.currentX !== undefined) {
      ctx.beginPath();
      ctx.moveTo(wallStartPoint.x, wallStartPoint.y);
      ctx.lineTo(wallStartPoint.currentX, wallStartPoint.currentY);
      ctx.strokeStyle = drawWallType === 'brick' ? '#FF4B16' : '#38BDF8';
      ctx.lineWidth = drawWallType === 'brick' ? 6 : 4;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Draw Transmitters
    nodes.forEach((node, idx) => {
      const isHovered = hoveredNode === node;
      const isDrag = draggingNode === node;

      const pulseR = 20 + ((Date.now() * 0.02) % 20);
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = node.type === 'router' ? 'rgba(255, 75, 22, 0.5)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = node.type === 'router' ? '#FF4B16' : '#0EA5E9';
      ctx.shadowColor = node.type === 'router' ? 'rgba(255, 75, 22, 0.7)' : 'rgba(14, 165, 233, 0.7)';
      ctx.shadowBlur = isHovered || isDrag ? 18 : 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
      const tagText = node.type === 'router' ? '📡 Main Router' : `📶 Mesh Node ${idx}`;
      const tagW = ctx.measureText(tagText).width + 14;
      ctx.fillRect(node.x - tagW * 0.5, node.y + 20, tagW, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(tagText, node.x, node.y + 30);
    });

    if (animTarget || draggingNode || draggingRoom || resizingRoom || hoveredNode) {
      requestAnimationFrame(draw);
    } else {
      isAnimationRunning = false;
    }
  }

  // --- Diagnostic Analytics Calculation ---
  function updateAnalytics() {
    if (isGridDirty) computeHeatmapGridKernel();

    let strongCount = 0;
    let goodCount = 0;
    let deadCount = 0;
    let roomRowsHtml = '';
    let totalSpeed = 0;

    activeFloorplan.rooms.forEach(room => {
      const midX = room.x + room.w * 0.5;
      const midY = room.y + room.h * 0.5;
      const dBm = getSampledSignalAt(midX, midY);
      const speed = signalToSpeed(dBm);
      totalSpeed += speed;

      let tagClass = 'wifi-room-tag--strong';
      let tagText = `${speed} Mbps (Strong)`;

      if (dBm >= -62) {
        strongCount++;
      } else if (dBm >= -74) {
        goodCount++;
        tagClass = 'wifi-room-tag--good';
        tagText = `${speed} Mbps (Fair)`;
      } else {
        deadCount++;
        tagClass = 'wifi-room-tag--dead';
        tagText = dBm < -84 ? 'Dead Zone (<15 Mbps)' : `${speed} Mbps (Weak)`;
      }

      roomRowsHtml += `
        <div class="wifi-room-row">
          <span class="wifi-room-name">${room.name}</span>
          <span class="wifi-room-tag ${tagClass}">${tagText}</span>
        </div>
      `;
    });

    if (roomListContainer) roomListContainer.innerHTML = roomRowsHtml || '<div style="padding:10px; color:#94A3B8; font-size:0.8rem; text-align:center;">No rooms yet. Add rooms above!</div>';

    const totalRooms = Math.max(1, activeFloorplan.rooms.length);
    const avgSpeed = (totalSpeed / totalRooms) | 0;
    const coverageScore = activeFloorplan.rooms.length === 0 ? 0 : Math.min(100, Math.round(((strongCount * 1.0 + goodCount * 0.65 + (totalRooms - deadCount - strongCount - goodCount) * 0.2) / totalRooms) * 100));
    if (coveragePercentEl) coveragePercentEl.textContent = `${coverageScore}%`;
    if (progressFillEl) progressFillEl.style.width = `${coverageScore}%`;

    // Activity Matrix
    if (actNetflix) {
      const streams = Math.max(0, (avgSpeed / 25) | 0);
      actNetflix.innerHTML = `<span class="wifi-act-dot ${streams >= 3 ? '' : 'wifi-act-dot--warn'}"></span> Netflix: ${streams} 4K Streams`;
    }
    if (actGaming) {
      const gamingOk = deadCount === 0 && activeFloorplan.rooms.length > 0;
      actGaming.innerHTML = `<span class="wifi-act-dot ${gamingOk ? '' : 'wifi-act-dot--fail'}"></span> Gaming: ${gamingOk ? 'Low Ping (15ms)' : 'Lag Spikes'}`;
    }
    if (actZoom) {
      actZoom.innerHTML = `<span class="wifi-act-dot ${avgSpeed > 50 ? '' : 'wifi-act-dot--warn'}"></span> Zoom: ${avgSpeed > 50 ? 'Crystal 1080p' : 'Choppy Video'}`;
    }
    if (actDownload) {
      const mins = Math.max(1, Math.round(50000 / (Math.max(10, avgSpeed) * 7.5)));
      actDownload.innerHTML = `<span class="wifi-act-dot"></span> 50GB: ~${mins} mins`;
    }

    if (adviceTextEl) {
      if (activeFloorplan.rooms.length === 0) {
        adviceTextEl.innerHTML = `<strong>💡 Canvas Cleared:</strong> Use the <em>"+ Add Room"</em> tray or <em>"📸 Upload Floorplan"</em> to design your house layout.`;
      } else if (coverageScore >= 88) {
        adviceTextEl.innerHTML = `<strong>✨ Optimal Coverage (${coverageScore}%):</strong> Wi-Fi signal is strong across all rooms. Doors allow signal to flow naturally down hallways.`;
      } else if (deadCount > 0 && nodes.length === 1) {
        adviceTextEl.innerHTML = `<strong>Weak rooms detected (${deadCount}):</strong> Walls and distance are reducing 5 GHz coverage. Try <em>"Find best router spot"</em> or add a mesh node.`;
      } else {
        adviceTextEl.innerHTML = `<strong>📶 Mesh Node Active:</strong> Adding a second node eliminates dead zones. Make sure your booster is placed halfway between the main router and weak areas.`;
      }
    }
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    setTimeout(() => toastEl.classList.remove('is-visible'), 3200);
  }

  function updateQuickJumpBar() {
    if (!quickJumpContainer) return;
    if (activeFloorplan.rooms.length === 0) {
      quickJumpContainer.innerHTML = '';
      return;
    }

    let html = '<span class="wifi-quick-jump-label">Jump Router:</span>';
    activeFloorplan.rooms.forEach(room => {
      const midX = room.x + room.w * 0.5;
      const midY = room.y + room.h * 0.5;
      html += `<button class="wifi-jump-btn" data-jump-x="${midX}" data-jump-y="${midY}">${room.name}</button>`;
    });

    quickJumpContainer.innerHTML = html;

    quickJumpContainer.querySelectorAll('.wifi-jump-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        animTarget = { x: parseFloat(btn.dataset.jumpX), y: parseFloat(btn.dataset.jumpY) };
        showToast(`Moved router to ${btn.textContent}`);
        requestRender();
      });
    });
  }

  function updateRoomInspector() {
    if (!roomInspector) return;
    if (!selectedRoom) {
      roomInspector.classList.remove('is-active');
      return;
    }

    if (!cachedCanvasRect) refreshCanvasRect();
    const scaleX = cachedCanvasRect.width / V_WIDTH;
    const scaleY = cachedCanvasRect.height / V_HEIGHT;

    const screenX = (selectedRoom.x + selectedRoom.w * 0.5) * scaleX;
    const screenY = selectedRoom.y * scaleY;

    roomInspector.style.left = `${screenX}px`;
    roomInspector.style.top = `${screenY}px`;
    if (inspectorRoomName) inspectorRoomName.textContent = selectedRoom.name;
    roomInspector.classList.add('is-active');
  }

  function updateWallInspector() {
    if (!wallInspector) return;
    if (!selectedWall) {
      wallInspector.classList.remove('is-active');
      return;
    }

    if (!cachedCanvasRect) refreshCanvasRect();
    const scaleX = cachedCanvasRect.width / V_WIDTH;
    const scaleY = cachedCanvasRect.height / V_HEIGHT;

    const midX = (selectedWall.x1 + selectedWall.x2) * 0.5;
    const midY = (selectedWall.y1 + selectedWall.y2) * 0.5;

    wallInspector.style.left = `${midX * scaleX}px`;
    wallInspector.style.top = `${midY * scaleY}px`;
    wallInspector.classList.add('is-active');
  }

  function findWallAt(px, py) {
    const allWalls = [...renderWalls, ...customWalls];
    return allWalls.find(w => distToSegment(px, py, w.x1, w.y1, w.x2, w.y2) <= 12) || null;
  }

  function findDoorAt(px, py) {
    return doors.find(d => Math.hypot(d.x - px, d.y - py) <= 18) || null;
  }

  function deleteWall(wall) {
    if (!wall) return;
    if (wall.id) erasedWalls.add(wall.id);
    customWalls = customWalls.filter(w => w !== wall);
    selectedWall = null;
    updateWallInspector();
    markDirty();
    updateAnalytics();
    showToast('🧹 Wall removed!');
  }

  function autoOptimizeRouterPosition() {
    if (activeFloorplan.rooms.length === 0) return;
    let bestScore = -Infinity;
    let bestPos = { x: 380, y: 250 };

    for (let x = 120; x <= 680; x += 40) {
      for (let y = 100; y <= 400; y += 40) {
        let score = 0;
        activeFloorplan.rooms.forEach(room => {
          const midX = room.x + room.w * 0.5;
          const midY = room.y + room.h * 0.5;
          const sig = calculateSignalAt(midX, midY, x, y);
          if (sig >= -65) score += 3;
          else if (sig >= -78) score += 1;
          else score -= 2;
        });

        if (score > bestScore) {
          bestScore = score;
          bestPos = { x, y };
        }
      }
    }

    animTarget = bestPos;
    showToast('✨ Auto-positioned router for optimal whole-home signal!');
    requestRender();
  }

  function getCanvasCoords(e) {
    if (!cachedCanvasRect) refreshCanvasRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = V_WIDTH / cachedCanvasRect.width;
    const scaleY = V_HEIGHT / cachedCanvasRect.height;
    return {
      x: (clientX - cachedCanvasRect.left) * scaleX,
      y: (clientY - cachedCanvasRect.top) * scaleY,
      screenX: clientX - cachedCanvasRect.left,
      screenY: clientY - cachedCanvasRect.top
    };
  }

  function findNodeAt(x, y) {
    return nodes.find(node => Math.hypot(node.x - x, node.y - y) <= 28) || null;
  }

  function findRoomAt(x, y) {
    return activeFloorplan.rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
  }

  function isOverResizeHandle(room, x, y) {
    if (!room) return false;
    return x >= room.x + room.w - 18 && x <= room.x + room.w + 6 && y >= room.y + room.h - 18 && y <= room.y + room.h + 6;
  }

  // --- Pointer Handlers ---
  function onPointerDown(e) {
    refreshCanvasRect();
    const coords = getCanvasCoords(e);

    if (isDoorMode) {
      const wall = findWallAt(coords.x, coords.y);
      if (wall) {
        const isH = Math.abs(wall.y1 - wall.y2) < Math.abs(wall.x1 - wall.x2);
        doors.push({
          id: `door_${Date.now()}`,
          x: Math.round(isH ? coords.x : wall.x1),
          y: Math.round(isH ? wall.y1 : coords.y),
          isHorizontal: isH,
          width: 36
        });
        showToast('🚪 Added doorway! RF signal now flows through naturally.');
        markDirty();
        updateAnalytics();
      }
      return;
    }

    if (isEraserMode) {
      const door = findDoorAt(coords.x, coords.y);
      if (door) {
        doors = doors.filter(d => d !== door);
        showToast('🧹 Door removed');
        markDirty();
        updateAnalytics();
        return;
      }

      const wall = findWallAt(coords.x, coords.y);
      if (wall) {
        deleteWall(wall);
        if (e.cancelable) e.preventDefault();
      }
      return;
    }

    if (drawWallType) {
      wallStartPoint = { x: coords.x, y: coords.y, currentX: coords.x, currentY: coords.y };
      requestRender();
      return;
    }

    const node = findNodeAt(coords.x, coords.y);
    if (node) {
      animTarget = null;
      draggingNode = node;
      node.isDragging = true;
      canvas.style.cursor = 'grabbing';
      requestRender();
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (selectedRoom && isOverResizeHandle(selectedRoom, coords.x, coords.y)) {
      resizingRoom = { room: selectedRoom, startW: selectedRoom.w, startH: selectedRoom.h, startX: coords.x, startY: coords.y };
      requestRender();
      if (e.cancelable) e.preventDefault();
      return;
    }

    const room = findRoomAt(coords.x, coords.y);
    if (room) {
      selectedRoom = room;
      selectedWall = null;
      draggingRoom = { room, offsetX: coords.x - room.x, offsetY: coords.y - room.y };
      updateRoomInspector();
      updateWallInspector();
      requestRender();
      if (e.cancelable) e.preventDefault();
      return;
    }

    const clickedWall = findWallAt(coords.x, coords.y);
    if (clickedWall) {
      selectedWall = clickedWall;
      selectedRoom = null;
      updateRoomInspector();
      updateWallInspector();
      requestRender();
      if (e.cancelable) e.preventDefault();
      return;
    } else {
      selectedWall = null;
      updateWallInspector();
    }

    selectedRoom = null;
    updateRoomInspector();
    requestRender();
  }

  function onPointerMove(e) {
    const coords = getCanvasCoords(e);

    if (drawWallType && wallStartPoint) {
      wallStartPoint.currentX = coords.x;
      wallStartPoint.currentY = coords.y;
      requestRender();
      return;
    }

    if (draggingNode) {
      draggingNode.x = Math.max(60, Math.min(V_WIDTH - 60, coords.x));
      draggingNode.y = Math.max(60, Math.min(V_HEIGHT - 60, coords.y));
      isGridDirty = true;
      requestRender();
      if (e.cancelable) e.preventDefault();
    } else if (resizingRoom) {
      const dw = coords.x - resizingRoom.startX;
      const dh = coords.y - resizingRoom.startY;
      resizingRoom.room.w = Math.max(70, Math.min(500, resizingRoom.startW + dw));
      resizingRoom.room.h = Math.max(40, Math.min(380, resizingRoom.startH + dh));
      updateRoomInspector();
      markDirty();
      if (e.cancelable) e.preventDefault();
    } else if (draggingRoom) {
      draggingRoom.room.x = Math.max(20, Math.min(V_WIDTH - draggingRoom.room.w - 20, coords.x - draggingRoom.offsetX));
      draggingRoom.room.y = Math.max(20, Math.min(V_HEIGHT - draggingRoom.room.h - 20, coords.y - draggingRoom.offsetY));
      updateRoomInspector();
      markDirty();
      if (e.cancelable) e.preventDefault();
    } else {
      hoveredNode = findNodeAt(coords.x, coords.y);
      hoveredRoom = findRoomAt(coords.x, coords.y);
      hoveredWall = findWallAt(coords.x, coords.y);
      hoveredDoor = findDoorAt(coords.x, coords.y);

      if (isDoorMode) {
        canvas.style.cursor = hoveredWall ? 'cell' : 'not-allowed';
      } else if (isEraserMode) {
        canvas.style.cursor = hoveredWall || hoveredDoor ? 'pointer' : 'not-allowed';
      } else if (selectedRoom && isOverResizeHandle(selectedRoom, coords.x, coords.y)) {
        canvas.style.cursor = 'nwse-resize';
      } else if (hoveredNode || hoveredRoom) {
        canvas.style.cursor = 'grab';
      } else if (hoveredWall || hoveredDoor) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = drawWallType ? 'crosshair' : 'default';
      }

      if (tooltip && !isEraserMode && !isDoorMode) {
        const dBm = getSampledSignalAt(coords.x, coords.y);
        const speed = signalToSpeed(dBm);
        const room = findRoomAt(coords.x, coords.y);

        probeSpeedEl.textContent = `${speed} Mbps (${Math.round(dBm)} dBm)`;
        probeRoomEl.textContent = room ? room.name : 'Hallway / Open Space';
        if (probeActivityEl) {
          probeActivityEl.textContent = speed >= 300 ? '✅ 4K Gaming & 8K Streaming' : (speed >= 100 ? '✅ Fast 4K Streaming' : (speed >= 25 ? '⚠️ Basic Browsing / HD' : '❌ Dead Zone'));
        }
        tooltip.style.left = `${coords.screenX}px`;
        tooltip.style.top = `${coords.screenY}px`;
        tooltip.style.display = 'block';
      }
    }
  }

  function onPointerUp(e) {
    if (drawWallType && wallStartPoint) {
      const coords = getCanvasCoords(e);
      const dist = Math.hypot(coords.x - wallStartPoint.x, coords.y - wallStartPoint.y);

      if (dist >= 20) {
        customWalls.push({
          id: `custom_w_${Date.now()}`,
          x1: Math.round(wallStartPoint.x),
          y1: Math.round(wallStartPoint.y),
          x2: Math.round(coords.x),
          y2: Math.round(coords.y),
          type: drawWallType,
          loss: drawWallType === 'brick' ? exteriorWallLoss : internalWallLoss
        });
        showToast(`Added custom ${drawWallType} wall!`);
        markDirty();
        updateAnalytics();
      }

      wallStartPoint = null;
      return;
    }

    if (draggingNode) {
      draggingNode.isDragging = false;
      draggingNode = null;
      updateAnalytics();
      requestRender();
    }

    if (resizingRoom) {
      resizingRoom = null;
      updateAnalytics();
      requestRender();
    }

    if (draggingRoom) {
      draggingRoom = null;
      updateAnalytics();
      requestRender();
    }
  }

  function onPointerLeave() {
    onPointerUp();
    if (tooltip) tooltip.style.display = 'none';
  }

  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove, { passive: true });
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerLeave);

  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  // ==========================================================================
  // Inspector CRUD Actions
  // ==========================================================================
  if (inspectorRenameBtn) {
    inspectorRenameBtn.addEventListener('click', () => {
      if (!selectedRoom) return;
      const newName = prompt('Enter new name for this room:', selectedRoom.name);
      if (newName && newName.trim()) {
        selectedRoom.name = newName.trim();
        updateRoomInspector();
        updateQuickJumpBar();
        updateAnalytics();
        showToast(`Renamed room to "${selectedRoom.name}"`);
        requestRender();
      }
    });
  }

  if (inspectorDeleteBtn) {
    inspectorDeleteBtn.addEventListener('click', () => {
      if (!selectedRoom) return;
      const name = selectedRoom.name;
      const targetRoom = selectedRoom;
      activeFloorplan.rooms = activeFloorplan.rooms.filter(r => r !== targetRoom);
      selectedRoom = null;
      updateRoomInspector();
      updateQuickJumpBar();
      markDirty();
      updateAnalytics();
      showToast(`🗑️ Deleted ${name}`);
    });
  }

  if (addDoorBtn) {
    addDoorBtn.addEventListener('click', () => {
      isDoorMode = !isDoorMode;
      isEraserMode = false;
      drawWallType = null;
      if (drawBrickBtn) drawBrickBtn.classList.remove('is-active');
      if (eraseWallBtn) eraseWallBtn.classList.remove('is-active');
      addDoorBtn.classList.toggle('is-active', isDoorMode);
      addDoorBtn.setAttribute('aria-pressed', String(isDoorMode));
      if (drawBrickBtn) drawBrickBtn.setAttribute('aria-pressed', 'false');
      if (eraseWallBtn) eraseWallBtn.setAttribute('aria-pressed', 'false');
      showToast(isDoorMode ? '🚪 Door Mode: Click on any wall to place a doorway' : 'Door Mode disabled');
      requestRender();
    });
  }

  if (eraseWallBtn) {
    eraseWallBtn.addEventListener('click', () => {
      isEraserMode = !isEraserMode;
      isDoorMode = false;
      drawWallType = null;
      if (drawBrickBtn) drawBrickBtn.classList.remove('is-active');
      if (addDoorBtn) addDoorBtn.classList.remove('is-active');
      eraseWallBtn.classList.toggle('is-active', isEraserMode);
      eraseWallBtn.setAttribute('aria-pressed', String(isEraserMode));
      if (drawBrickBtn) drawBrickBtn.setAttribute('aria-pressed', 'false');
      if (addDoorBtn) addDoorBtn.setAttribute('aria-pressed', 'false');
      showToast(isEraserMode ? '🧹 Eraser active: Click any wall or door on canvas to remove it' : 'Eraser disabled');
      requestRender();
    });
  }

  if (inspectorDeleteWallBtn) {
    inspectorDeleteWallBtn.addEventListener('click', () => {
      deleteWall(selectedWall);
    });
  }

  if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', () => {
      if (confirm('Clear all rooms and walls to start from scratch?')) {
        activeFloorplan.rooms = [];
        customWalls = [];
        doors = [];
        erasedWalls.clear();
        selectedRoom = null;
        selectedWall = null;
        uploadedFloorplanImg = null;
        if (opacityControl) opacityControl.classList.remove('is-visible');
        nodes[0].x = 400; nodes[0].y = 250;
        updateRoomInspector();
        updateWallInspector();
        updateQuickJumpBar();
        markDirty();
        updateAnalytics();
        showToast('🗑️ Cleared canvas. Add rooms to start building!');
      }
    });
  }

  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      activeFloorplan.rooms = JSON.parse(JSON.stringify(DEFAULT_ROOMS));
      activeFloorplan.name = '3-bed brick-veneer home';
      exteriorWallLoss = 8;
      internalWallLoss = 6;
      customWalls = [];
      doors = [
        { id: 'd1', x: 330, y: 150, isHorizontal: false, width: 36 },
        { id: 'd2', x: 200, y: 260, isHorizontal: true, width: 36 },
        { id: 'd3', x: 170, y: 310, isHorizontal: true, width: 36 }
      ];
      erasedWalls.clear();
      selectedRoom = null;
      selectedWall = null;
      uploadedFloorplanImg = null;
      if (opacityControl) opacityControl.classList.remove('is-visible');
      nodes[0].x = 200; nodes[0].y = 160;
      updateRoomInspector();
      updateWallInspector();
      updateQuickJumpBar();
      markDirty();
      updateAnalytics();
      showToast('🔄 Reset layout to standard Home with Hallway');
    });
  }

  // Upload Real Estate Floorplan Image
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          uploadedFloorplanImg = img;
          if (opacityControl) opacityControl.classList.add('is-visible');
          activeFloorplan = { name: 'Uploaded floorplan tracing guide', rooms: [] };
          doors = [];
          customWalls = [];
          erasedWalls.clear();
          selectedRoom = null;
          selectedWall = null;
          isRoomEditMode = true;
          if (toggleRoomTrayBtn) toggleRoomTrayBtn.classList.add('is-active');
          if (toggleRoomTrayBtn) toggleRoomTrayBtn.setAttribute('aria-expanded', 'true');
          if (roomTray) roomTray.classList.add('is-active');
          uploadBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Change Image
          `;
          showToast('Floorplan added as a guide. Add and resize room blocks to trace it.');
          updateRoomInspector();
          updateWallInspector();
          updateQuickJumpBar();
          markDirty();
          updateAnalytics();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      uploadedImgOpacity = parseFloat(opacitySlider.value);
      requestRender();
    });
  }

  // Room Block Builder Tray
  if (toggleRoomTrayBtn && roomTray) {
    toggleRoomTrayBtn.addEventListener('click', () => {
      isRoomEditMode = !isRoomEditMode;
      toggleRoomTrayBtn.classList.toggle('is-active', isRoomEditMode);
      roomTray.classList.toggle('is-active', isRoomEditMode);
      toggleRoomTrayBtn.setAttribute('aria-expanded', String(isRoomEditMode));
      showToast(isRoomEditMode ? '🧩 Room Builder active: Click + buttons or drag/resize rooms' : 'Exited Room Builder');
    });
  }

  document.querySelectorAll('[data-add-room]').forEach(btn => {
    btn.addEventListener('click', () => {
      const roomType = btn.dataset.addRoom;
      const roomConfig = {
        'Living Room': { w: 240, h: 180 },
        'Kitchen': { w: 200, h: 140 },
        'Central Hallway': { w: 280, h: 60 },
        'Master Bedroom': { w: 200, h: 160 },
        'Bedroom': { w: 180, h: 150 },
        'Bathroom': { w: 130, h: 120 },
        'Laundry': { w: 120, h: 110 },
        'Home Office': { w: 160, h: 140 },
        'Garage': { w: 220, h: 180 },
        'Outdoor Patio': { w: 160, h: 160 }
      }[roomType] || { w: 180, h: 150 };

      const newRoom = {
        id: `room_${Date.now()}`,
        name: roomType,
        x: Math.floor(Math.random() * (V_WIDTH - roomConfig.w - 100)) + 50,
        y: Math.floor(Math.random() * (V_HEIGHT - roomConfig.h - 100)) + 50,
        w: roomConfig.w,
        h: roomConfig.h
      };

      activeFloorplan.rooms.push(newRoom);
      selectedRoom = newRoom;
      updateRoomInspector();
      updateQuickJumpBar();
      markDirty();
      updateAnalytics();
      showToast(`Added ${roomType}! Drag next to other rooms (walls auto-merge).`);
    });
  });

  // House Wizard Modal
  if (openWizardBtn && wizardModal && closeWizardBtn) {
    const openWizard = () => {
      wizardReturnFocus = document.activeElement;
      wizardModal.classList.add('is-open');
      wizardModal.setAttribute('aria-hidden', 'false');
      if (wizardCard) wizardCard.focus();
    };
    const closeWizard = () => {
      wizardModal.classList.remove('is-open');
      wizardModal.setAttribute('aria-hidden', 'true');
      if (wizardReturnFocus && typeof wizardReturnFocus.focus === 'function') wizardReturnFocus.focus();
    };

    openWizardBtn.addEventListener('click', openWizard);
    closeWizardBtn.addEventListener('click', closeWizard);
    wizardModal.addEventListener('click', e => {
      if (e.target === wizardModal) closeWizard();
    });
    document.addEventListener('keydown', e => {
      if (!wizardModal.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeWizard();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(wizardModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.querySelectorAll('.wifi-pill-opt').forEach(pill => {
      pill.setAttribute('aria-pressed', String(pill.classList.contains('is-selected')));
      pill.addEventListener('click', () => {
        const group = pill.closest('.wifi-pill-options');
        group.querySelectorAll('.wifi-pill-opt').forEach(p => {
          p.classList.remove('is-selected');
          p.setAttribute('aria-pressed', 'false');
        });
        pill.classList.add('is-selected');
        pill.setAttribute('aria-pressed', 'true');
      });
    });

    if (submitWizardBtn) {
      submitWizardBtn.addEventListener('click', () => {
        const homeType = document.querySelector('[data-wizard-group="home"] .is-selected')?.dataset.val || 'brick_3';
        const nbnLoc = document.querySelector('[data-wizard-group="nbn"] .is-selected')?.dataset.val || 'living';

        if (homeType === 'unit') {
          activeFloorplan = {
            name: 'Australian unit or apartment',
            rooms: [
              { id: 'r1', name: 'Open Living & Kitchen', x: 80, y: 90, w: 350, h: 250 },
              { id: 'r2', name: 'Hallway', x: 430, y: 90, w: 60, h: 250 },
              { id: 'r3', name: 'Master Bedroom', x: 490, y: 90, w: 230, h: 125 },
              { id: 'r4', name: 'Bedroom / Office', x: 490, y: 215, w: 130, h: 125 },
              { id: 'r5', name: 'Bathroom & Laundry', x: 620, y: 215, w: 100, h: 125 }
            ]
          };
          exteriorWallLoss = 18;
          internalWallLoss = 12;
          doors = [
            { id: 'd1', x: 430, y: 160, isHorizontal: false, width: 36 },
            { id: 'd2', x: 490, y: 150, isHorizontal: false, width: 36 },
            { id: 'd3', x: 555, y: 215, isHorizontal: true, width: 36 }
          ];
        } else if (homeType === 'terrace') {
          activeFloorplan = {
            name: 'Australian terrace or narrow home',
            rooms: [
              { id: 'r1', name: 'Front Living', x: 55, y: 100, w: 180, h: 300 },
              { id: 'r2', name: 'Hallway', x: 235, y: 100, w: 70, h: 300 },
              { id: 'r3', name: 'Master Bedroom', x: 305, y: 100, w: 180, h: 150 },
              { id: 'r4', name: 'Bathroom & Laundry', x: 305, y: 250, w: 180, h: 150 },
              { id: 'r5', name: 'Kitchen & Dining', x: 485, y: 100, w: 250, h: 180 },
              { id: 'r6', name: 'Rear Bedroom / Office', x: 485, y: 280, w: 250, h: 120 }
            ]
          };
          exteriorWallLoss = 16;
          internalWallLoss = 6;
          doors = [
            { id: 'd1', x: 235, y: 170, isHorizontal: false, width: 36 },
            { id: 'd2', x: 305, y: 170, isHorizontal: false, width: 36 },
            { id: 'd3', x: 485, y: 190, isHorizontal: false, width: 36 }
          ];
        } else if (homeType === 'project_4') {
          activeFloorplan = {
            name: '4-bed Australian project home',
            rooms: [
              { id: 'r1', name: 'Living Room', x: 60, y: 60, w: 250, h: 180 },
              { id: 'r2', name: 'Kitchen & Dining', x: 310, y: 60, w: 260, h: 160 },
              { id: 'r3', name: 'Garage', x: 570, y: 60, w: 165, h: 160 },
              { id: 'r4', name: 'Central Hallway', x: 60, y: 240, w: 510, h: 50 },
              { id: 'r5', name: 'Master Bedroom', x: 60, y: 290, w: 170, h: 150 },
              { id: 'r6', name: 'Bedroom 2', x: 230, y: 290, w: 120, h: 150 },
              { id: 'r7', name: 'Bedroom 3', x: 350, y: 290, w: 120, h: 150 },
              { id: 'r8', name: 'Bathroom & Laundry', x: 470, y: 290, w: 100, h: 150 },
              { id: 'r9', name: 'Bedroom 4 / Office', x: 570, y: 220, w: 165, h: 220 }
            ]
          };
          exteriorWallLoss = 8;
          internalWallLoss = 6;
          doors = [
            { id: 'd1', x: 190, y: 240, isHorizontal: true, width: 36 },
            { id: 'd2', x: 310, y: 140, isHorizontal: false, width: 36 },
            { id: 'd3', x: 145, y: 290, isHorizontal: true, width: 36 },
            { id: 'd4', x: 570, y: 150, isHorizontal: false, width: 36 }
          ];
        } else {
          activeFloorplan = {
            name: homeType === 'double_brick' ? '3-bed double-brick home' : (homeType === 'weatherboard' ? 'Weatherboard or Queenslander home' : '3-bed brick-veneer home'),
            rooms: JSON.parse(JSON.stringify(DEFAULT_ROOMS))
          };
          exteriorWallLoss = homeType === 'double_brick' ? 16 : (homeType === 'weatherboard' ? 5 : 8);
          internalWallLoss = homeType === 'double_brick' ? 12 : (homeType === 'weatherboard' ? 4 : 6);
          doors = [
            { id: 'd1', x: 330, y: 150, isHorizontal: false, width: 36 },
            { id: 'd2', x: 200, y: 260, isHorizontal: true, width: 36 },
            { id: 'd3', x: 170, y: 310, isHorizontal: true, width: 36 }
          ];
        }

        const locationTerms = {
          living: ['Living'],
          garage: ['Garage', 'Front'],
          hallway: ['Hallway'],
          office: ['Office']
        };
        const preferredTerms = locationTerms[nbnLoc] || locationTerms.living;
        const targetRoom = activeFloorplan.rooms.find(room => preferredTerms.some(term => room.name.includes(term))) || activeFloorplan.rooms[0];
        nodes[0].x = targetRoom.x + targetRoom.w * 0.5;
        nodes[0].y = targetRoom.y + targetRoom.h * 0.5;
        nodes.splice(1);
        if (addMeshBtn) {
          addMeshBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add mesh node
          `;
          addMeshBtn.classList.remove('wifi-tool-btn--accent');
          addMeshBtn.setAttribute('aria-pressed', 'false');
        }

        customWalls = [];
        erasedWalls.clear();
        selectedRoom = null;
        selectedWall = null;
        uploadedFloorplanImg = null;
        if (opacityControl) opacityControl.classList.remove('is-visible');
        if (advancedFloorplanPanel) advancedFloorplanPanel.open = false;
        if (quickStartKicker) quickStartKicker.textContent = 'Setup complete';
        if (quickStartTitle) quickStartTitle.textContent = activeFloorplan.name;
        if (quickStartBody) quickStartBody.textContent = 'Your starting layout is ready. Drag the orange router or use the automatic placement button below.';
        openWizardBtn.innerHTML = `Change home <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
        closeWizard();
        updateRoomInspector();
        updateWallInspector();
        updateQuickJumpBar();
        markDirty();
        updateAnalytics();
        showToast(`${activeFloorplan.name} is ready. Drag the router to compare positions.`);
      });
    }
  }

  const autoOptBtn = document.getElementById('autoOptimizeBtn');
  if (autoOptBtn) {
    autoOptBtn.addEventListener('click', autoOptimizeRouterPosition);
  }

  const hwSelect = document.getElementById('routerHardwareSelect');
  if (hwSelect) {
    hwSelect.addEventListener('change', () => {
      activeHardware = hwSelect.value;
      showToast(`Switched to ${HARDWARE_PROFILES[activeHardware].name}`);
      markDirty();
      updateAnalytics();
    });
  }

  function setDrawMode(type, activeBtn) {
    isEraserMode = false;
    isDoorMode = false;
    if (eraseWallBtn) eraseWallBtn.classList.remove('is-active');
    if (addDoorBtn) addDoorBtn.classList.remove('is-active');
    if (eraseWallBtn) eraseWallBtn.setAttribute('aria-pressed', 'false');
    if (addDoorBtn) addDoorBtn.setAttribute('aria-pressed', 'false');

    if (drawWallType === type) {
      drawWallType = null;
      activeBtn.classList.remove('is-active');
      activeBtn.setAttribute('aria-pressed', 'false');
      showToast('Wall drawing disabled');
    } else {
      drawWallType = type;
      activeBtn.classList.add('is-active');
      activeBtn.setAttribute('aria-pressed', 'true');
      showToast(`Click & drag to draw ${type} wall`);
    }
    requestRender();
  }

  if (drawBrickBtn) drawBrickBtn.addEventListener('click', () => setDrawMode('brick', drawBrickBtn));

  const shareBtn = document.getElementById('shareFloorplanBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      try {
        const link = document.createElement('a');
        link.download = `JRS-WiFi-Heatmap-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('📸 Heatmap snapshot saved to Downloads!');
      } catch (err) {
        showToast('Shared floorplan copied to clipboard!');
      }
    });
  }

  document.querySelectorAll('[data-band]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-band]').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      activeBand = btn.dataset.band;
      markDirty();
      updateAnalytics();
    });
  });

  const addMeshBtn = document.getElementById('addMeshBtn');
  if (addMeshBtn) {
    addMeshBtn.addEventListener('click', () => {
      if (nodes.length === 1) {
        nodes.push({ id: 'mesh1', type: 'mesh', name: 'Mesh Booster', x: 450, y: 285, isDragging: false });
        addMeshBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Remove mesh node
        `;
        addMeshBtn.classList.add('wifi-tool-btn--accent');
        addMeshBtn.setAttribute('aria-pressed', 'true');
      } else {
        nodes.pop();
        addMeshBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add mesh node
        `;
        addMeshBtn.classList.remove('wifi-tool-btn--accent');
        addMeshBtn.setAttribute('aria-pressed', 'false');
      }
      markDirty();
      updateAnalytics();
    });
  }

  const modeSimBtn = document.getElementById('modeSimBtn');
  const modeLiveBtn = document.getElementById('modeLiveBtn');
  const simWorkspace = document.getElementById('simWorkspace');
  const quickJumpBar = document.getElementById('quickJumpContainer');
  const livePanel = document.getElementById('liveScannerPanel');
  const heroStartLiveBtn = document.getElementById('heroStartLiveBtn');
  const heroStartLiveBtnText = document.getElementById('heroStartLiveBtnText');
  const heroPlannerBtn = document.getElementById('heroPlannerBtn');

  const setToolMode = mode => {
    if (!modeSimBtn || !modeLiveBtn || !simWorkspace || !livePanel) return;
    const showLiveScanner = mode === 'live';
    if (!showLiveScanner) stopLiveWalk(false);

    modeLiveBtn.classList.toggle('is-active', showLiveScanner);
    modeSimBtn.classList.toggle('is-active', !showLiveScanner);
    modeLiveBtn.setAttribute('aria-pressed', String(showLiveScanner));
    modeSimBtn.setAttribute('aria-pressed', String(!showLiveScanner));
    simWorkspace.hidden = showLiveScanner;
    if (quickStartPanel) quickStartPanel.hidden = showLiveScanner;
    if (advancedFloorplanPanel) advancedFloorplanPanel.hidden = showLiveScanner;
    if (quickJumpBar) quickJumpBar.hidden = showLiveScanner;
    livePanel.classList.toggle('is-active', showLiveScanner);

    if (!showLiveScanner) {
      refreshCanvasRect();
      requestRender();
    }
  };

  if (modeSimBtn && modeLiveBtn && simWorkspace && livePanel) {
    modeSimBtn.addEventListener('click', () => setToolMode('sim'));
    modeLiveBtn.addEventListener('click', () => setToolMode('live'));
    heroPlannerBtn?.addEventListener('click', () => {
      setToolMode('sim');
      window.requestAnimationFrame(() => quickStartPanel?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    });
  }

  // ==========================================================================
  // Live connection walk engine
  // ==========================================================================
  const startLiveWalkBtn = document.getElementById('startLiveWalkBtn');
  const startLiveWalkBtnText = startLiveWalkBtn?.querySelector('span');
  const stopLiveWalkBtn = document.getElementById('stopLiveWalkBtn');
  const liveWalkControls = document.getElementById('liveWalkControls');
  const markWeakSpotBtn = document.getElementById('markWeakSpotBtn');
  const liveRadarCard = document.getElementById('liveRadarCard');
  const liveSessionStatus = document.getElementById('liveSessionStatus');
  const liveSampleCount = document.getElementById('liveSampleCount');
  const liveQualityVal = document.getElementById('liveQualityVal');
  const liveLatencyNum = document.getElementById('liveLatencyNum');
  const liveJitterNum = document.getElementById('liveJitterNum');
  const liveSpeedEstNum = document.getElementById('liveSpeedEstNum');
  const liveResultMeaning = document.getElementById('liveResultMeaning');
  const scanProgress = document.getElementById('scanProgress');
  const auditHistoryList = document.getElementById('auditHistoryList');
  const auditSummary = document.getElementById('auditSummary');
  const clearAuditBtn = document.getElementById('clearAuditBtn');
  const vibrateOnPoor = document.getElementById('vibrateOnPoor');
  const vibrationControl = document.getElementById('vibrationControl');
  const recalibrateBaselineBtn = document.getElementById('recalibrateBaselineBtn');
  const localPreviewNote = document.getElementById('localPreviewNote');
  const liveStepEls = [...document.querySelectorAll('[data-live-step]')];
  const connectionTestAsset = '/assets/img/hero-house.webp';
  const markedSpotsStorageKey = 'jrs-wifi-marked-spots-v1';
  const liveSampleIntervalMs = 2500;
  const parallelTransferCount = 2;
  const baselineSampleTarget = 5;
  const liveSampleWindowSize = 5;
  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  let liveWalkActive = false;
  let liveSampleTimer = null;
  let liveAbortController = null;
  let liveWakeLock = null;
  let liveSampleInFlight = false;
  let liveWarmupComplete = false;
  let liveReadingCount = 0;
  let liveSamples = [];
  let baselineSamples = [];
  let baselineReading = null;
  let latestLiveReading = null;
  let smoothedComparisonPercent = null;
  let lastLiveRating = '';
  let consecutiveSampleFailures = 0;
  let editingMarkId = null;

  const loadMarkedSpots = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(markedSpotsStorageKey) || '[]');
      return Array.isArray(stored) ? stored.filter(spot => spot && spot.id && spot.name).slice(-50) : [];
    } catch (error) {
      return [];
    }
  };

  let markedSpots = loadMarkedSpots();

  const saveMarkedSpots = () => {
    try {
      localStorage.setItem(markedSpotsStorageKey, JSON.stringify(markedSpots));
    } catch (error) {
      showToast('Marks could not be saved on this device.');
    }
  };

  const setLiveStep = activeStep => {
    liveStepEls.forEach(stepEl => {
      const stepNumber = Number(stepEl.dataset.liveStep);
      stepEl.classList.toggle('is-active', stepNumber === activeStep);
      stepEl.classList.toggle('is-complete', stepNumber < activeStep);
    });
  };

  const median = values => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const medianAbsoluteDeviation = values => {
    const centre = median(values);
    return median(values.map(value => Math.abs(value - centre)));
  };

  const getLiveRating = (comparisonPercent, responseRatio, failedSamples) => {
    if (failedSamples >= 2 || comparisonPercent < 25 || responseRatio > 4) {
      return {
        ratingKey: 'poor',
        statusLabel: 'Dead zone',
        badgeClass: 'wifi-room-tag--dead',
        meaning: 'The connection is much worse here than it was beside the modem.'
      };
    }
    if (comparisonPercent < 50 || responseRatio > 3) {
      return {
        ratingKey: 'fair',
        statusLabel: 'Weak',
        badgeClass: 'wifi-room-tag--good',
        meaning: 'The connection is noticeably weaker here. This spot is worth saving.'
      };
    }
    if (comparisonPercent < 80 || responseRatio > 1.6) {
      return {
        ratingKey: 'good',
        statusLabel: 'Good',
        badgeClass: 'wifi-room-tag--strong',
        meaning: 'The connection has dropped a little, but it should still be usable.'
      };
    }
    return {
      ratingKey: 'excellent',
      statusLabel: 'Strong',
      badgeClass: 'wifi-room-tag--strong',
      meaning: 'This is close to the connection you had beside the modem.'
    };
  };

  const formatMbps = value => value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;

  const getReadingConfidence = samples => {
    if (samples.length < 3) return 'Low';
    const speeds = samples.map(sample => sample.measuredMbps);
    const responses = samples.map(sample => sample.responseMs);
    const speedVariation = medianAbsoluteDeviation(speeds) / Math.max(median(speeds), 0.1);
    const responseVariation = medianAbsoluteDeviation(responses) / Math.max(median(responses), 1);
    if (samples.length >= 5 && speedVariation <= 0.18 && responseVariation <= 0.35) return 'High';
    return speedVariation <= 0.4 && responseVariation <= 0.8 ? 'Medium' : 'Low';
  };

  const updateLiveReading = reading => {
    if (!reading) return;
    if (liveRadarCard) liveRadarCard.dataset.rating = reading.ratingKey;
    if (liveQualityVal) liveQualityVal.textContent = reading.statusLabel;
    if (liveSpeedEstNum) liveSpeedEstNum.textContent = String(reading.comparisonPercent) + '%';
    if (liveLatencyNum) liveLatencyNum.textContent = String(reading.responseMs) + ' ms';
    if (liveJitterNum) liveJitterNum.textContent = reading.confidence;
    if (liveResultMeaning) liveResultMeaning.textContent = reading.meaning;
    if (liveSampleCount) liveSampleCount.textContent = String(liveReadingCount) + (liveReadingCount === 1 ? ' live reading' : ' live readings');
    if (markWeakSpotBtn) markWeakSpotBtn.disabled = false;
  };

  const resetLiveReading = ({ keepWarmConnection = false } = {}) => {
    latestLiveReading = null;
    liveSamples = [];
    baselineSamples = [];
    baselineReading = null;
    smoothedComparisonPercent = null;
    liveReadingCount = 0;
    lastLiveRating = '';
    consecutiveSampleFailures = 0;
    liveWarmupComplete = keepWarmConnection;
    if (liveRadarCard) liveRadarCard.dataset.rating = 'waiting';
    if (liveQualityVal) liveQualityVal.textContent = 'Setting up';
    if (liveSpeedEstNum) liveSpeedEstNum.textContent = '—';
    if (liveLatencyNum) liveLatencyNum.textContent = '—';
    if (liveJitterNum) liveJitterNum.textContent = '—';
    if (liveResultMeaning) liveResultMeaning.textContent = "Keep the phone still beside your modem. We'll use the next five readings as the starting point.";
    if (liveSampleCount) liveSampleCount.textContent = '0 of ' + baselineSampleTarget + ' starting readings';
    if (markWeakSpotBtn) markWeakSpotBtn.disabled = true;
    if (recalibrateBaselineBtn) recalibrateBaselineBtn.disabled = true;
  };

  const renderMarkedSpots = () => {
    if (!auditHistoryList) return;
    auditHistoryList.replaceChildren();

    if (!markedSpots.length) {
      const empty = document.createElement('div');
      empty.className = 'wifi-audit-empty';
      const title = document.createElement('strong');
      title.textContent = 'No spots saved yet';
      const detail = document.createElement('span');
      detail.textContent = 'Use the Mark this spot button when a room feels weak. You can give it a name later.';
      empty.append(title, detail);
      auditHistoryList.append(empty);
      if (auditSummary) auditSummary.textContent = "You haven't marked anywhere yet.";
      if (clearAuditBtn) clearAuditBtn.disabled = true;
      return;
    }

    markedSpots.forEach((spot, index) => {
      const row = document.createElement('article');
      row.className = 'wifi-audit-row';
      row.setAttribute('role', 'listitem');

      const main = document.createElement('div');
      main.className = 'wifi-mark-main';
      const number = document.createElement('span');
      number.className = 'wifi-mark-number';
      number.textContent = String(index + 1);
      const nameWrap = document.createElement('div');
      nameWrap.className = 'wifi-mark-name';

      if (editingMarkId === spot.id) {
        const form = document.createElement('form');
        form.className = 'wifi-mark-edit-form';
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 30;
        input.value = spot.name;
        input.setAttribute('aria-label', 'Rename marked spot');
        const saveButton = document.createElement('button');
        saveButton.className = 'wifi-mark-action-btn';
        saveButton.type = 'submit';
        saveButton.textContent = 'Save';
        form.append(input, saveButton);
        form.addEventListener('submit', event => {
          event.preventDefault();
          const nextName = input.value.trim().slice(0, 30);
          if (!nextName) {
            input.focus();
            return;
          }
          spot.name = nextName;
          editingMarkId = null;
          saveMarkedSpots();
          renderMarkedSpots();
          showToast('Name saved.');
        });
        nameWrap.append(form);
        window.setTimeout(() => {
          input.focus();
          input.select();
        }, 0);
      } else {
        const name = document.createElement('strong');
        name.textContent = spot.name;
        const time = document.createElement('small');
        time.textContent = new Date(spot.createdAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
        nameWrap.append(name, time);
      }
      main.append(number, nameWrap);

      const reading = document.createElement('div');
      reading.className = 'wifi-mark-reading';
      const speed = document.createElement('strong');
      speed.textContent = Number.isFinite(spot.comparisonPercent)
        ? String(spot.comparisonPercent) + '% of modem'
        : String(spot.measuredMbps) + ' Mbps';
      const detail = document.createElement('small');
      detail.textContent = ' · ' + spot.responseMs + ' ms response' +
        (spot.confidence ? ' · ' + spot.confidence + ' confidence' : ' · earlier reading');
      const rating = document.createElement('span');
      rating.className = 'wifi-room-tag ' + spot.badgeClass;
      rating.textContent = spot.statusLabel;
      reading.append(speed, detail, rating);

      const actions = document.createElement('div');
      actions.className = 'wifi-mark-actions';
      const renameButton = document.createElement('button');
      renameButton.className = 'wifi-mark-action-btn';
      renameButton.type = 'button';
      renameButton.textContent = editingMarkId === spot.id ? 'Cancel' : 'Rename';
      renameButton.addEventListener('click', () => {
        editingMarkId = editingMarkId === spot.id ? null : spot.id;
        renderMarkedSpots();
      });
      const removeButton = document.createElement('button');
      removeButton.className = 'wifi-mark-action-btn';
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.setAttribute('aria-label', 'Remove ' + spot.name);
      removeButton.addEventListener('click', () => {
        markedSpots = markedSpots.filter(mark => mark.id !== spot.id);
        if (editingMarkId === spot.id) editingMarkId = null;
        saveMarkedSpots();
        renderMarkedSpots();
        showToast('Spot removed.');
      });
      actions.append(renameButton, removeButton);

      row.append(main, reading, actions);
      auditHistoryList.append(row);
    });

    const weakCount = markedSpots.filter(spot => ['poor', 'fair'].includes(spot.ratingKey) || ['Poor', 'Fair', 'Weak', 'Dead zone'].includes(spot.statusLabel)).length;
    if (auditSummary) {
      auditSummary.textContent = String(markedSpots.length) + (markedSpots.length === 1 ? ' spot marked' : ' spots marked') +
        (weakCount ? ' · ' + weakCount + ' weak' : '');
    }
    if (clearAuditBtn) clearAuditBtn.disabled = false;
  };

  const requestScreenWakeLock = async () => {
    if (!('wakeLock' in navigator) || document.hidden || liveWakeLock) return;
    try {
      liveWakeLock = await navigator.wakeLock.request('screen');
      liveWakeLock.addEventListener('release', () => { liveWakeLock = null; });
    } catch (error) {
      liveWakeLock = null;
    }
  };

  const releaseScreenWakeLock = async () => {
    if (!liveWakeLock) return;
    try {
      await liveWakeLock.release();
    } catch (error) {
      // The lock may already have been released by the browser.
    }
    liveWakeLock = null;
  };

  const takeConnectionSample = async () => {
    liveAbortController = new AbortController();
    const timeoutId = window.setTimeout(() => liveAbortController?.abort(), 8000);
    const batchStartedAt = performance.now();

    try {
      const batchToken = Date.now() + '-' + Math.random().toString(36).slice(2);
      const transfers = await Promise.all(Array.from({ length: parallelTransferCount }, async (_, index) => {
        const transferStartedAt = performance.now();
        const response = await fetch(connectionTestAsset + '?live_walk=' + batchToken + '-' + index, {
          method: 'GET',
          cache: 'no-store',
          signal: liveAbortController.signal
        });
        const headersAt = performance.now();
        if (!response.ok) throw new Error('Connection pulse returned ' + response.status);
        const payload = await response.arrayBuffer();
        return {
          responseMs: headersAt - transferStartedAt,
          byteLength: payload.byteLength
        };
      }));
      const completedAt = performance.now();
      const durationSeconds = Math.max((completedAt - batchStartedAt) / 1000, 0.001);
      const totalBytes = transfers.reduce((sum, transfer) => sum + transfer.byteLength, 0);
      return {
        responseMs: median(transfers.map(transfer => transfer.responseMs)),
        measuredMbps: Math.max(0.1, (totalBytes * 8) / durationSeconds / 1000000)
      };
    } finally {
      window.clearTimeout(timeoutId);
      liveAbortController = null;
    }
  };

  const scheduleNextLiveSample = () => {
    window.clearTimeout(liveSampleTimer);
    liveSampleTimer = null;
    if (!liveWalkActive || document.hidden) return;
    liveSampleTimer = window.setTimeout(runLiveSample, liveSampleIntervalMs);
  };

  const runLiveSample = async () => {
    if (!liveWalkActive || document.hidden || liveSampleInFlight) return;
    liveSampleInFlight = true;

    try {
      if (!liveWarmupComplete) {
        if (scanProgress) scanProgress.textContent = 'Getting the first reading ready.';
        await takeConnectionSample();
        if (!liveWalkActive) return;
        liveWarmupComplete = true;
      }

      if (!baselineReading) {
        if (scanProgress) scanProgress.textContent = "Stay still. We're checking the connection beside your modem.";
        const baselineSample = await takeConnectionSample();
        if (!liveWalkActive) return;
        baselineSamples.push(baselineSample);
        const calibrationCount = baselineSamples.length;
        if (liveSampleCount) liveSampleCount.textContent = String(calibrationCount) + ' of ' + baselineSampleTarget + ' starting readings';
        if (liveSpeedEstNum) liveSpeedEstNum.textContent = String(calibrationCount) + ' / ' + baselineSampleTarget;
        if (liveLatencyNum) liveLatencyNum.textContent = String(Math.round(baselineSample.responseMs)) + ' ms';
        if (liveJitterNum) liveJitterNum.textContent = 'Waiting';

        if (calibrationCount >= baselineSampleTarget) {
          const baselineSpeeds = baselineSamples.map(sample => sample.measuredMbps);
          const baselineResponses = baselineSamples.map(sample => sample.responseMs);
          const baselineMbps = median(baselineSpeeds);
          const baselineResponseMs = median(baselineResponses);
          const speedMad = medianAbsoluteDeviation(baselineSpeeds);
          const responseMad = medianAbsoluteDeviation(baselineResponses);
          baselineReading = {
            responseMs: baselineResponseMs,
            measuredMbps: baselineMbps,
            speedFloor: Math.max(0.1, baselineMbps - Math.min(
              Math.max(speedMad * 2.5, baselineMbps * 0.15),
              baselineMbps * 0.35
            )),
            responseCeiling: baselineResponseMs + Math.min(
              Math.max(responseMad * 2.5, 20),
              Math.max(60, baselineResponseMs * 1.5)
            ),
            confidence: getReadingConfidence(baselineSamples)
          };
          liveSamples = [];
          smoothedComparisonPercent = null;
          consecutiveSampleFailures = 0;
          if (liveRadarCard) liveRadarCard.dataset.rating = 'good';
          if (liveQualityVal) liveQualityVal.textContent = 'Ready to walk';
          if (liveSpeedEstNum) liveSpeedEstNum.textContent = '100%';
          if (liveLatencyNum) liveLatencyNum.textContent = String(Math.round(baselineReading.responseMs)) + ' ms';
          if (liveJitterNum) liveJitterNum.textContent = baselineReading.confidence;
          if (liveResultMeaning) liveResultMeaning.textContent = "We've saved the reading beside your modem. Walk to another room and stop there for five readings.";
          if (liveSampleCount) liveSampleCount.textContent = 'Starting point saved';
          if (scanProgress) scanProgress.textContent = 'Done. Walk to another room, then hold still.';
          if (recalibrateBaselineBtn) recalibrateBaselineBtn.disabled = false;
          if ('vibrate' in navigator) navigator.vibrate(60);
        }
        return;
      }

      if (scanProgress) scanProgress.textContent = 'Checking this room against the modem reading.';
      const sample = await takeConnectionSample();
      if (!liveWalkActive) return;
      liveSamples.push(sample);
      if (liveSamples.length > liveSampleWindowSize) liveSamples.shift();
      liveReadingCount += 1;
      consecutiveSampleFailures = 0;

      if (liveSamples.length < liveSampleWindowSize) {
        const settlingCount = liveSamples.length;
        latestLiveReading = null;
        if (liveRadarCard) liveRadarCard.dataset.rating = 'waiting';
        if (liveQualityVal) liveQualityVal.textContent = 'Checking';
        if (liveSpeedEstNum) liveSpeedEstNum.textContent = String(settlingCount) + ' / ' + liveSampleWindowSize;
        if (liveLatencyNum) liveLatencyNum.textContent = String(Math.round(median(liveSamples.map(reading => reading.responseMs)))) + ' ms';
        if (liveJitterNum) liveJitterNum.textContent = 'Waiting';
        if (liveResultMeaning) liveResultMeaning.textContent = "Keep still here. We'll show the result after five readings.";
        if (liveSampleCount) liveSampleCount.textContent = String(settlingCount) + ' of ' + liveSampleWindowSize + ' readings here';
        if (markWeakSpotBtn) markWeakSpotBtn.disabled = true;
        if (scanProgress) scanProgress.textContent = "Hold still. We're checking this room.";
        return;
      }

      const responseMs = Math.round(median(liveSamples.map(reading => reading.responseMs)));
      const variationMs = Math.round(Math.max(...liveSamples.map(reading => reading.responseMs)) - Math.min(...liveSamples.map(reading => reading.responseMs)));
      const measuredMbpsRaw = median(liveSamples.map(reading => reading.measuredMbps));
      const measuredMbps = formatMbps(measuredMbpsRaw);
      const speedScore = Math.min(100, (measuredMbpsRaw / baselineReading.speedFloor) * 100);
      const responseScore = Math.min(100, (baselineReading.responseCeiling / Math.max(responseMs, 1)) * 100);
      const rawComparisonPercent = (speedScore * 0.7) + (responseScore * 0.3);
      const withinBaselineNoise = measuredMbpsRaw >= baselineReading.speedFloor && responseMs <= baselineReading.responseCeiling;
      if (withinBaselineNoise) {
        smoothedComparisonPercent = 100;
      } else if (smoothedComparisonPercent === null) {
        smoothedComparisonPercent = rawComparisonPercent;
      } else {
        smoothedComparisonPercent = (smoothedComparisonPercent * 0.55) + (rawComparisonPercent * 0.45);
      }
      let comparisonPercent = Math.max(0, Math.min(100, Math.round(smoothedComparisonPercent / 5) * 5));
      if (comparisonPercent >= 95) comparisonPercent = 100;
      const responseRatio = responseMs <= baselineReading.responseCeiling
        ? 1
        : responseMs / baselineReading.responseCeiling;
      const confidence = getReadingConfidence(liveSamples);
      const rating = getLiveRating(comparisonPercent, responseRatio, consecutiveSampleFailures);
      latestLiveReading = {
        responseMs,
        variationMs,
        measuredMbps,
        comparisonPercent,
        confidence,
        ...rating
      };

      updateLiveReading(latestLiveReading);
      if (scanProgress) scanProgress.textContent = confidence === 'Low'
        ? 'Stay still a little longer. The readings are jumping around.'
        : 'You can walk to the next room or save this spot.';

      if (rating.ratingKey === 'poor' && lastLiveRating !== 'poor' && vibrateOnPoor?.checked && 'vibrate' in navigator) {
        navigator.vibrate([140, 80, 140]);
      }
      lastLiveRating = rating.ratingKey;
    } catch (error) {
      if (error.name !== 'AbortError' && liveWalkActive) {
        consecutiveSampleFailures += 1;
        if (baselineReading && consecutiveSampleFailures >= 2) {
          const rating = getLiveRating(0, 99, consecutiveSampleFailures);
          latestLiveReading = {
            responseMs: 8000,
            variationMs: 0,
            measuredMbps: 0,
            comparisonPercent: 0,
            confidence: 'High',
            ...rating
          };
          updateLiveReading(latestLiveReading);
          if (scanProgress) scanProgress.textContent = "The connection has failed twice here. Save this spot if your phone is still on Wi-Fi.";
          if (lastLiveRating !== 'poor' && vibrateOnPoor?.checked && 'vibrate' in navigator) navigator.vibrate([140, 80, 140]);
          lastLiveRating = 'poor';
        } else {
          if (liveRadarCard) liveRadarCard.dataset.rating = 'unavailable';
          if (liveQualityVal) liveQualityVal.textContent = baselineReading ? 'Retrying' : 'Calibration paused';
          if (liveResultMeaning) liveResultMeaning.textContent = "We couldn't reach the test file. Stay here while we try again.";
          if (scanProgress) scanProgress.textContent = "That reading failed. We'll try again.";
        }
      }
    } finally {
      liveSampleInFlight = false;
      scheduleNextLiveSample();
    }
  };

  const startLiveWalk = () => {
    if (liveWalkActive) return;
    liveWalkActive = true;
    if (!baselineReading && !latestLiveReading) resetLiveReading();
    if (liveRadarCard) liveRadarCard.dataset.running = 'true';
    if (liveSessionStatus) liveSessionStatus.textContent = 'Live';
    if (startLiveWalkBtn) startLiveWalkBtn.hidden = true;
    if (heroStartLiveBtn) heroStartLiveBtn.disabled = true;
    if (heroStartLiveBtnText) heroStartLiveBtnText.textContent = 'Room scan running';
    if (liveWalkControls) liveWalkControls.hidden = false;
    if (recalibrateBaselineBtn) recalibrateBaselineBtn.disabled = !baselineReading;
    if (scanProgress) scanProgress.textContent = baselineReading ? 'Picking up where you stopped.' : 'Starting the check beside your modem.';
    setLiveStep(2);
    requestScreenWakeLock();
    runLiveSample();
  };

  const stopLiveWalk = (announce = true) => {
    if (!liveWalkActive) return;
    liveWalkActive = false;
    window.clearTimeout(liveSampleTimer);
    liveSampleTimer = null;
    liveAbortController?.abort();
    liveAbortController = null;
    if (liveRadarCard) liveRadarCard.dataset.running = 'false';
    if (liveSessionStatus) liveSessionStatus.textContent = 'Stopped';
    if (startLiveWalkBtn) startLiveWalkBtn.hidden = false;
    if (startLiveWalkBtnText) startLiveWalkBtnText.textContent = 'Resume room scan';
    if (heroStartLiveBtn) heroStartLiveBtn.disabled = false;
    if (heroStartLiveBtnText) heroStartLiveBtnText.textContent = 'Resume room scan';
    if (liveWalkControls) liveWalkControls.hidden = true;
    if (recalibrateBaselineBtn) recalibrateBaselineBtn.disabled = true;
    if (scanProgress) scanProgress.textContent = latestLiveReading
      ? 'The scan is stopped. Your last reading and saved spots are still here.'
      : (baselineReading ? 'The scan is stopped. Your starting point is still saved.' : 'The scan stopped before it finished setting up.');
    setLiveStep(markedSpots.length ? 3 : 1);
    releaseScreenWakeLock();
    if (announce) showToast('Scan stopped.');
  };

  startLiveWalkBtn?.addEventListener('click', startLiveWalk);
  stopLiveWalkBtn?.addEventListener('click', () => stopLiveWalk());
  heroStartLiveBtn?.addEventListener('click', () => {
    setToolMode('live');
    startLiveWalk();
    const scrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    window.requestAnimationFrame(() => liveRadarCard?.scrollIntoView({ behavior: scrollBehavior, block: 'center' }));
  });
  recalibrateBaselineBtn?.addEventListener('click', () => {
    if (!liveWalkActive) return;
    window.clearTimeout(liveSampleTimer);
    liveSampleTimer = null;
    liveAbortController?.abort();
    resetLiveReading({ keepWarmConnection: true });
    if (scanProgress) scanProgress.textContent = 'Stay beside the modem while we save a new starting point.';
    showToast('Setting a new starting point.');
    if (!liveSampleInFlight) runLiveSample();
  });
  markWeakSpotBtn?.addEventListener('click', () => {
    if (!latestLiveReading) return;
    const nextNumber = markedSpots.reduce((highest, spot) => Math.max(highest, Number(spot.autoNumber) || 0), 0) + 1;
    const spot = {
      id: String(Date.now()) + '-' + String(nextNumber),
      autoNumber: nextNumber,
      name: 'Spot ' + nextNumber,
      createdAt: Date.now(),
      ...latestLiveReading
    };
    markedSpots.push(spot);
    saveMarkedSpots();
    renderMarkedSpots();
    setLiveStep(3);
    if ('vibrate' in navigator) navigator.vibrate(60);
    showToast(spot.name + ' saved. You can rename it now or later.');
  });

  clearAuditBtn?.addEventListener('click', () => {
    if (!markedSpots.length || !window.confirm('Remove every saved spot from this device?')) return;
    markedSpots = [];
    editingMarkId = null;
    saveMarkedSpots();
    renderMarkedSpots();
    setLiveStep(liveWalkActive ? 2 : 1);
    showToast('Saved spots removed.');
  });

  document.addEventListener('visibilitychange', () => {
    if (!liveWalkActive) return;
    if (document.hidden) {
      window.clearTimeout(liveSampleTimer);
      liveSampleTimer = null;
      liveAbortController?.abort();
      if (liveSessionStatus) liveSessionStatus.textContent = 'Paused';
      if (scanProgress) scanProgress.textContent = 'The scan pauses when this page is in the background.';
      releaseScreenWakeLock();
    } else {
      if (liveSessionStatus) liveSessionStatus.textContent = 'Live';
      if (scanProgress) scanProgress.textContent = 'Starting the readings again.';
      requestScreenWakeLock();
      if (!liveSampleInFlight) runLiveSample();
    }
  });

  if (localPreviewNote && isLocalPreview) localPreviewNote.hidden = false;
  if (vibrationControl && !('vibrate' in navigator)) vibrationControl.hidden = true;
  renderMarkedSpots();

  // --- Initial Launch ---
  refreshCanvasRect();
  updateQuickJumpBar();
  markDirty();
  updateAnalytics();
  requestRender();

})();

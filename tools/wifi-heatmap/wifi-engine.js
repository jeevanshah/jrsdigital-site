/**
 * JRS Digital — Home Wi-Fi & Mesh Heatmap Engine (HTML5 Canvas 2D)
 * Real-time 60fps RF signal propagation, wall attenuation, and coverage analytics.
 */

(function () {
  'use strict';

  // --- Canvas & Stage References ---
  const canvas = document.getElementById('wifiHeatmapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('wifiProbeTooltip');
  const probeSpeedEl = document.getElementById('probeSpeed');
  const probeRoomEl = document.getElementById('probeRoom');
  const coveragePercentEl = document.getElementById('coveragePercent');
  const progressFillEl = document.getElementById('progressFill');
  const adviceTextEl = document.getElementById('adviceText');
  const roomListContainer = document.getElementById('roomListContainer');

  // Virtual resolution for physics & layout
  const V_WIDTH = 800;
  const V_HEIGHT = 500;

  // Offscreen low-res grid for fast RF calculation (upscaled for 60fps rendering)
  const GRID_W = 160;
  const GRID_H = 100;
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = GRID_W;
  offscreenCanvas.height = GRID_H;
  const offscreenCtx = offscreenCanvas.getContext('2d');
  const gridImageData = offscreenCtx.createImageData(GRID_W, GRID_H);

  // --- State ---
  let currentPreset = 'suburban';
  let activeBand = '5ghz'; // '5ghz' or '2.4ghz'
  let draggingNode = null;
  let hoveredNode = null;

  // --- Transmitters ---
  const nodes = [
    { id: 'primary', type: 'router', name: 'Primary Router', x: 230, y: 200, power: -30, isDragging: false }
  ];

  // --- Pre-defined Australian Floorplans ---
  const FLOORPLANS = {
    suburban: {
      name: 'Suburban 3-Bed Brick Home',
      rooms: [
        { name: 'Living Room', x: 80, y: 70, w: 280, h: 210 },
        { name: 'Kitchen & Dining', x: 360, y: 70, w: 260, h: 170 },
        { name: 'Home Office / Bed 3', x: 620, y: 70, w: 120, h: 170 },
        { name: 'Master Bedroom', x: 80, y: 280, w: 220, h: 170 },
        { name: 'Ensuite / Bath', x: 300, y: 280, w: 110, h: 170 },
        { name: 'Bedroom 2', x: 410, y: 240, w: 210, h: 210 },
        { name: 'Outdoor Patio / Alfresco', x: 620, y: 240, w: 120, h: 210 }
      ],
      walls: [
        // Outer Boundary Walls (Double Brick: heavy RF drop)
        { x1: 80, y1: 70, x2: 740, y2: 70, type: 'brick', loss: 16 },
        { x1: 740, y1: 70, x2: 740, y2: 450, type: 'brick', loss: 16 },
        { x1: 740, y1: 450, x2: 80, y2: 450, type: 'brick', loss: 16 },
        { x1: 80, y1: 450, x2: 80, y2: 70, type: 'brick', loss: 16 },

        // Internal Structural Brick Walls
        { x1: 360, y1: 70, x2: 360, y2: 240, type: 'brick', loss: 14 },  // Living/Kitchen dividing wall
        { x1: 410, y1: 240, x2: 620, y2: 240, type: 'brick', loss: 12 }, // Dining/Bed 2 dividing wall

        // Internal Drywall Partitions
        { x1: 80, y1: 280, x2: 410, y2: 280, type: 'drywall', loss: 6 },
        { x1: 300, y1: 280, x2: 300, y2: 450, type: 'drywall', loss: 6 },
        { x1: 410, y1: 240, x2: 410, y2: 450, type: 'drywall', loss: 6 },
        { x1: 620, y1: 70, x2: 620, y2: 450, type: 'drywall', loss: 8 }
      ]
    },

    townhouse: {
      name: '2-Storey Townhouse',
      rooms: [
        { name: 'Ground: Living Room', x: 80, y: 90, w: 300, h: 280 },
        { name: 'Ground: Kitchen & Dining', x: 380, y: 90, w: 340, h: 140 },
        { name: 'Ground: Garage / Storage', x: 380, y: 230, w: 340, h: 140 },
        { name: 'Upper: Master Bed', x: 80, y: 90, w: 200, h: 160, isUpper: true },
        { name: 'Upper: Bedroom 2', x: 280, y: 90, w: 200, h: 160, isUpper: true }
      ],
      walls: [
        { x1: 80, y1: 90, x2: 720, y2: 90, type: 'brick', loss: 18 },
        { x1: 720, y1: 90, x2: 720, y2: 370, type: 'brick', loss: 18 },
        { x1: 720, y1: 370, x2: 80, y2: 370, type: 'brick', loss: 18 },
        { x1: 80, y1: 370, x2: 80, y2: 90, type: 'brick', loss: 18 },
        { x1: 380, y1: 90, x2: 380, y2: 370, type: 'brick', loss: 16 },
        { x1: 380, y1: 230, x2: 720, y2: 230, type: 'drywall', loss: 6 }
      ]
    },

    apartment: {
      name: 'Modern 2-Bed Apartment',
      rooms: [
        { name: 'Open Living & Balcony', x: 100, y: 90, w: 340, h: 280 },
        { name: 'Kitchen & Island', x: 440, y: 90, w: 260, h: 130 },
        { name: 'Master Bedroom', x: 440, y: 220, w: 260, h: 150 }
      ],
      walls: [
        { x1: 100, y1: 90, x2: 700, y2: 90, type: 'brick', loss: 18 },
        { x1: 700, y1: 90, x2: 700, y2: 370, type: 'brick', loss: 18 },
        { x1: 700, y1: 370, x2: 100, y2: 370, type: 'brick', loss: 18 },
        { x1: 100, y1: 370, x2: 100, y2: 90, type: 'brick', loss: 18 },
        { x1: 440, y1: 90, x2: 440, y2: 370, type: 'brick', loss: 14 },
        { x1: 440, y1: 220, x2: 700, y2: 220, type: 'drywall', loss: 5 }
      ]
    }
  };

  // --- Line Intersection ---
  function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  // --- Calculate Signal dBm at (px, py) ---
  function getSignalStrengthAt(px, py) {
    const walls = FLOORPLANS[currentPreset].walls;
    const wallMultiplier = activeBand === '5ghz' ? 1.25 : 0.75;
    const distanceDrop = activeBand === '5ghz' ? 24 : 19;
    let maxSignal = -100; // dBm

    nodes.forEach(node => {
      const dx = px - node.x;
      const dy = py - node.y;
      const dist = Math.max(10, Math.hypot(dx, dy));

      // Realistic log-distance path loss
      let signal = node.power - (distanceDrop * Math.log10(dist * 0.28));

      // Wall attenuation ray-casting
      walls.forEach(wall => {
        if (linesIntersect(node.x, node.y, px, py, wall.x1, wall.y1, wall.x2, wall.y2)) {
          signal -= (wall.loss * wallMultiplier);
        }
      });

      if (signal > maxSignal) {
        maxSignal = signal;
      }
    });

    return Math.max(-95, Math.min(-30, maxSignal));
  }

  // Convert dBm to Est. Speed (Mbps)
  function signalToSpeed(dBm) {
    if (dBm >= -52) return activeBand === '5ghz' ? 550 : 220;
    if (dBm >= -62) return activeBand === '5ghz' ? 380 : 160;
    if (dBm >= -72) return activeBand === '5ghz' ? 180 : 90;
    if (dBm >= -82) return activeBand === '5ghz' ? 45 : 35;
    if (dBm >= -88) return 12;
    return 0; // Dead zone
  }

  // Map dBm to RGB Heatmap Color
  function signalToColor(dBm) {
    // Normalise: -88 dBm (Dead Zone) to -48 dBm (500+ Mbps)
    const norm = Math.max(0, Math.min(1, (dBm + 88) / 40));

    let r = 0, g = 0, b = 0;
    if (norm < 0.25) {
      // Dark Navy/Charcoal to Vivid Red
      const t = norm / 0.25;
      r = Math.floor(15 + t * (239 - 15));
      g = Math.floor(23 + t * (68 - 23));
      b = Math.floor(42 + t * (68 - 42));
    } else if (norm < 0.5) {
      // Red to Amber / Orange
      const t = (norm - 0.25) / 0.25;
      r = Math.floor(239 + t * (245 - 239));
      g = Math.floor(68 + t * (158 - 68));
      b = Math.floor(68 + t * (11 - 68));
    } else if (norm < 0.75) {
      // Amber to Emerald Green
      const t = (norm - 0.5) / 0.25;
      r = Math.floor(245 - t * (245 - 16));
      g = Math.floor(158 + t * (185 - 158));
      b = Math.floor(11 + t * (129 - 11));
    } else {
      // Emerald Green to Electric Cyan
      const t = (norm - 0.75) / 0.25;
      r = Math.floor(16 - t * 10);
      g = Math.floor(185 - t * 3);
      b = Math.floor(129 + t * (212 - 129));
    }

    const alpha = Math.floor(Math.min(235, 120 + norm * 115));
    return { r, g, b, a: alpha };
  }

  // --- Compute Heatmap Grid ---
  function computeHeatmapGrid() {
    const data = gridImageData.data;
    const stepX = V_WIDTH / GRID_W;
    const stepY = V_HEIGHT / GRID_H;

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const px = (gx + 0.5) * stepX;
        const py = (gy + 0.5) * stepY;
        const dBm = getSignalStrengthAt(px, py);
        const col = signalToColor(dBm);

        const idx = (gy * GRID_W + gx) * 4;
        data[idx] = col.r;
        data[idx + 1] = col.g;
        data[idx + 2] = col.b;
        data[idx + 3] = col.a;
      }
    }

    offscreenCtx.putImageData(gridImageData, 0, 0);
  }

  // --- Render Loop (60fps Canvas) ---
  function draw() {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. Draw Smooth Upscaled Heatmap
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreenCanvas, 0, 0, GRID_W, GRID_H, 0, 0, V_WIDTH, V_HEIGHT);

    // 2. Draw Floorplan Rooms
    const plan = FLOORPLANS[currentPreset];

    plan.rooms.forEach(room => {
      // Subtle room grid fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(room.x, room.y, room.w, room.h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      // Room Name Label with pill backing
      ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = ctx.measureText(room.name).width + 12;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(room.x + room.w / 2 - textW / 2, room.y + room.h / 2 - 10, textW, 20);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(room.name, room.x + room.w / 2, room.y + room.h / 2);
    });

    // 3. Draw Physical Architectural Walls
    plan.walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);

      if (wall.type === 'brick') {
        ctx.strokeStyle = '#E05638'; // Terracotta Brick
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#CBD5E1'; // Drywall
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });

    // 4. Draw Transmitters (Routers & Mesh Nodes)
    nodes.forEach((node, idx) => {
      const isHovered = hoveredNode === node;
      const isDrag = draggingNode === node;

      // Pulse ring animation
      const pulseR = 20 + ((Date.now() * 0.02) % 20);
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = node.type === 'router' ? 'rgba(255, 75, 22, 0.5)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer glow circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = node.type === 'router' ? '#FF4B16' : '#0EA5E9';
      ctx.shadowColor = node.type === 'router' ? 'rgba(255, 75, 22, 0.7)' : 'rgba(14, 165, 233, 0.7)';
      ctx.shadowBlur = isHovered || isDrag ? 18 : 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Center transmitter core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Label Pill Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
      const tagText = node.type === 'router' ? '📡 Main Router' : `📶 Mesh Node ${idx}`;
      const tagW = ctx.measureText(tagText).width + 14;
      ctx.fillRect(node.x - tagW / 2, node.y + 20, tagW, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(tagText, node.x, node.y + 30);
    });

    requestAnimationFrame(draw);
  }

  // --- Diagnostic Analytics Calculation ---
  function updateAnalytics() {
    const plan = FLOORPLANS[currentPreset];
    let strongCount = 0;
    let goodCount = 0;
    let deadCount = 0;
    let roomRowsHtml = '';

    plan.rooms.forEach(room => {
      const midX = room.x + room.w / 2;
      const midY = room.y + room.h / 2;
      const dBm = getSignalStrengthAt(midX, midY);
      const speed = signalToSpeed(dBm);

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

    if (roomListContainer) roomListContainer.innerHTML = roomRowsHtml;

    // Coverage Score
    const totalRooms = plan.rooms.length;
    const coverageScore = Math.min(100, Math.round(((strongCount * 1.0 + goodCount * 0.65 + (totalRooms - deadCount - strongCount - goodCount) * 0.2) / totalRooms) * 100));
    if (coveragePercentEl) coveragePercentEl.textContent = `${coverageScore}%`;
    if (progressFillEl) progressFillEl.style.width = `${coverageScore}%`;

    // Smart Actionable Advice
    if (adviceTextEl) {
      if (coverageScore >= 88) {
        adviceTextEl.innerHTML = `<strong>✨ Optimal Coverage (${coverageScore}%):</strong> Your home Wi-Fi signal is strong across living spaces and bedrooms. If downloads feel slow or 4K streams buffer, your NBN speed tier is the bottleneck.`;
      } else if (deadCount > 0 && nodes.length === 1) {
        adviceTextEl.innerHTML = `<strong>⚠️ Dead Zones Detected (${deadCount} room${deadCount > 1 ? 's' : ''}):</strong> Double brick walls are blocking 5GHz Wi-Fi to outer bedrooms/office. Try moving your router centrally or click <em>"+ Add Mesh Booster"</em> to test dual-node coverage.`;
      } else {
        adviceTextEl.innerHTML = `<strong>📶 Mesh Node Active:</strong> Adding a second node eliminates dead zones across outer rooms. Make sure your mesh node is placed halfway between the main router and weak areas.`;
      }
    }
  }

  // --- Coordinate Mapping Helpers ---
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      screenX: clientX - rect.left,
      screenY: clientY - rect.top
    };
  }

  function findNodeAt(x, y) {
    return nodes.find(node => Math.hypot(node.x - x, node.y - y) <= 28) || null;
  }

  // --- Interaction Event Listeners ---
  function onPointerDown(e) {
    const coords = getCanvasCoords(e);
    const node = findNodeAt(coords.x, coords.y);
    if (node) {
      draggingNode = node;
      node.isDragging = true;
      canvas.style.cursor = 'grabbing';
      if (e.cancelable) e.preventDefault();
    }
  }

  function onPointerMove(e) {
    const coords = getCanvasCoords(e);

    if (draggingNode) {
      draggingNode.x = Math.max(60, Math.min(V_WIDTH - 60, coords.x));
      draggingNode.y = Math.max(60, Math.min(V_HEIGHT - 60, coords.y));
      computeHeatmapGrid();
      updateAnalytics();
      if (e.cancelable) e.preventDefault();
    } else {
      hoveredNode = findNodeAt(coords.x, coords.y);
      canvas.style.cursor = hoveredNode ? 'grab' : 'crosshair';

      // Live Tooltip Probe
      if (tooltip) {
        const dBm = getSignalStrengthAt(coords.x, coords.y);
        const speed = signalToSpeed(dBm);
        const plan = FLOORPLANS[currentPreset];
        const room = plan.rooms.find(r => coords.x >= r.x && coords.x <= r.x + r.w && coords.y >= r.y && coords.y <= r.y + r.h);

        probeSpeedEl.textContent = `${speed} Mbps (${Math.round(dBm)} dBm)`;
        probeRoomEl.textContent = room ? room.name : 'Hallway / Open Space';
        tooltip.style.left = `${coords.screenX}px`;
        tooltip.style.top = `${coords.screenY}px`;
        tooltip.style.display = 'block';
      }
    }
  }

  function onPointerUp() {
    if (draggingNode) {
      draggingNode.isDragging = false;
      draggingNode = null;
      canvas.style.cursor = hoveredNode ? 'grab' : 'crosshair';
      computeHeatmapGrid();
      updateAnalytics();
    }
  }

  function onPointerLeave() {
    onPointerUp();
    if (tooltip) tooltip.style.display = 'none';
  }

  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerLeave);

  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  // --- UI Controls: Preset Buttons ---
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentPreset = btn.dataset.preset;

      if (currentPreset === 'suburban') {
        nodes[0].x = 230; nodes[0].y = 200;
        if (nodes[1]) { nodes[1].x = 520; nodes[1].y = 340; }
      } else if (currentPreset === 'townhouse') {
        nodes[0].x = 220; nodes[0].y = 220;
        if (nodes[1]) { nodes[1].x = 530; nodes[1].y = 160; }
      } else if (currentPreset === 'apartment') {
        nodes[0].x = 260; nodes[0].y = 220;
        if (nodes[1]) { nodes[1].x = 560; nodes[1].y = 280; }
      }

      computeHeatmapGrid();
      updateAnalytics();
    });
  });

  // --- UI Controls: Frequency Band Toggle ---
  document.querySelectorAll('[data-band]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-band]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeBand = btn.dataset.band;
      computeHeatmapGrid();
      updateAnalytics();
    });
  });

  // --- UI Controls: Add / Remove Mesh Booster ---
  const addMeshBtn = document.getElementById('addMeshBtn');
  if (addMeshBtn) {
    addMeshBtn.addEventListener('click', () => {
      if (nodes.length === 1) {
        nodes.push({ id: 'mesh1', type: 'mesh', name: 'Mesh Booster', x: 540, y: 340, power: -32, isDragging: false });
        addMeshBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Remove Mesh Booster
        `;
        addMeshBtn.classList.add('wifi-tool-btn--accent');
      } else {
        nodes.pop();
        addMeshBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Add Mesh Booster
        `;
        addMeshBtn.classList.remove('wifi-tool-btn--accent');
      }
      computeHeatmapGrid();
      updateAnalytics();
    });
  }

  // --- Initial Launch ---
  computeHeatmapGrid();
  updateAnalytics();
  requestAnimationFrame(draw);

})();

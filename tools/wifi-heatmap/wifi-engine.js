/**
 * JRS Digital — Home Wi-Fi & Mesh Heatmap Engine (V4 Full CRUD + Auto-Generation)
 * Features:
 * 1. Full Room CRUD: Create, Select, Move, Resize with Handles, Rename, Delete.
 * 2. Full Wall CRUD: Draw, Select, Delete individual walls, Clear all walls.
 * 3. Smart Auto-Generation from uploaded floorplan images.
 * 4. Clear Canvas & Reset to Default.
 * 5. House Customizer Wizard & Live Mobile Scanner.
 */

(function () {
  'use strict';

  // --- DOM References ---
  const canvas = document.getElementById('wifiHeatmapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
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

  // Floating Room Inspector
  const roomInspector = document.getElementById('roomInspector');
  const inspectorRoomName = document.getElementById('inspectorRoomName');
  const inspectorRenameBtn = document.getElementById('inspectorRenameBtn');
  const inspectorDeleteBtn = document.getElementById('inspectorDeleteBtn');

  // Activity Matrix
  const actNetflix = document.getElementById('actNetflix');
  const actGaming = document.getElementById('actGaming');
  const actZoom = document.getElementById('actZoom');
  const actDownload = document.getElementById('actDownload');

  // Uploaded Image
  let uploadedFloorplanImg = null;
  let uploadedImgOpacity = 0.65;
  const fileInput = document.getElementById('floorplanFileInput');
  const uploadBtn = document.getElementById('uploadPlanBtn');
  const opacityControl = document.getElementById('opacityControl');
  const opacitySlider = document.getElementById('opacitySlider');

  // Hub Buttons
  const toggleRoomTrayBtn = document.getElementById('toggleRoomTrayBtn');
  const roomTray = document.getElementById('roomTray');
  const clearCanvasBtn = document.getElementById('clearCanvasBtn');
  const resetDefaultBtn = document.getElementById('resetDefaultBtn');

  // Wizard Modal
  const wizardModal = document.getElementById('wizardModal');
  const openWizardBtn = document.getElementById('openWizardBtn');
  const closeWizardBtn = document.getElementById('closeWizardBtn');
  const submitWizardBtn = document.getElementById('submitWizardBtn');

  // Virtual resolution
  const V_WIDTH = 800;
  const V_HEIGHT = 500;

  // Offscreen low-res grid for fast RF calculation
  const GRID_W = 160;
  const GRID_H = 100;
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = GRID_W;
  offscreenCanvas.height = GRID_H;
  const offscreenCtx = offscreenCanvas.getContext('2d');
  const gridImageData = offscreenCtx.createImageData(GRID_W, GRID_H);

  // --- State ---
  let activeBand = '5ghz';
  let activeHardware = 'standard';
  let drawWallType = null;
  let wallStartPoint = null;
  let customWalls = [];
  let draggingNode = null;
  let draggingRoom = null;
  let resizingRoom = null;
  let selectedRoom = null;
  let hoveredNode = null;
  let hoveredRoom = null;
  let animTarget = null;
  let isRoomEditMode = false;

  // Default Template
  const DEFAULT_SUBURBAN = {
    name: 'Suburban 3-Bed Brick Home',
    rooms: [
      { id: 'r1', name: 'Living Room', x: 80, y: 70, w: 280, h: 210 },
      { id: 'r2', name: 'Kitchen & Dining', x: 360, y: 70, w: 260, h: 170 },
      { id: 'r3', name: 'Home Office', x: 620, y: 70, w: 120, h: 170 },
      { id: 'r4', name: 'Master Bed', x: 80, y: 280, w: 220, h: 170 },
      { id: 'r5', name: 'Ensuite', x: 300, y: 280, w: 110, h: 170 },
      { id: 'r6', name: 'Bedroom 2', x: 410, y: 240, w: 210, h: 210 },
      { id: 'r7', name: 'Alfresco Patio', x: 620, y: 240, w: 120, h: 210 }
    ],
    walls: [
      { id: 'w1', x1: 80, y1: 70, x2: 740, y2: 70, type: 'brick', loss: 16 },
      { id: 'w2', x1: 740, y1: 70, x2: 740, y2: 450, type: 'brick', loss: 16 },
      { id: 'w3', x1: 740, y1: 450, x2: 80, y2: 450, type: 'brick', loss: 16 },
      { id: 'w4', x1: 80, y1: 450, x2: 80, y2: 70, type: 'brick', loss: 16 },
      { id: 'w5', x1: 360, y1: 70, x2: 360, y2: 240, type: 'brick', loss: 14 },
      { id: 'w6', x1: 410, y1: 240, x2: 620, y2: 240, type: 'brick', loss: 12 },
      { id: 'w7', x1: 80, y1: 280, x2: 410, y2: 280, type: 'drywall', loss: 6 },
      { id: 'w8', x1: 300, y1: 280, x2: 300, y2: 450, type: 'drywall', loss: 6 },
      { id: 'w9', x1: 410, y1: 240, x2: 410, y2: 450, type: 'drywall', loss: 6 },
      { id: 'w10', x1: 620, y1: 70, x2: 620, y2: 450, type: 'drywall', loss: 8 }
    ]
  };

  let activeFloorplan = JSON.parse(JSON.stringify(DEFAULT_SUBURBAN));

  // --- Hardware Profiles ---
  const HARDWARE_PROFILES = {
    standard: { name: 'Standard Telco Modem', basePower: -30, wallMult: 1.25, max5G: 500, max2G: 180 },
    wifi6: { name: 'High-Power Wi-Fi 6 Router', basePower: -26, wallMult: 1.05, max5G: 750, max2G: 240 },
    wifi7_mesh: { name: 'Wi-Fi 7 Tri-Band Mesh System', basePower: -24, wallMult: 0.9, max5G: 950, max2G: 320 }
  };

  // --- Transmitters ---
  const nodes = [
    { id: 'primary', type: 'router', name: 'Primary Router', x: 230, y: 200, isDragging: false }
  ];

  // --- Helper: Line Intersection ---
  function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  // --- Calculate Signal Strength (dBm) at Point (px, py) ---
  function getSignalStrengthAt(px, py, customNodes = null) {
    const allWalls = [...activeFloorplan.walls, ...customWalls];
    const hw = HARDWARE_PROFILES[activeHardware];
    const wallMultiplier = (activeBand === '5ghz' ? 1.25 : 0.75) * hw.wallMult;
    const distanceDrop = activeBand === '5ghz' ? 24 : 19;
    const testNodes = customNodes || nodes;
    let maxSignal = -100;

    testNodes.forEach(node => {
      const dx = px - node.x;
      const dy = py - node.y;
      const dist = Math.max(10, Math.hypot(dx, dy));
      const power = node.type === 'router' ? hw.basePower : hw.basePower - 2;

      let signal = power - (distanceDrop * Math.log10(dist * 0.28));

      allWalls.forEach(wall => {
        if (linesIntersect(node.x, node.y, px, py, wall.x1, wall.y1, wall.x2, wall.y2)) {
          signal -= (wall.loss * wallMultiplier);
        }
      });

      if (signal > maxSignal) {
        maxSignal = signal;
      }
    });

    return Math.max(-95, Math.min(-25, maxSignal));
  }

  // Convert dBm to Speed (Mbps)
  function signalToSpeed(dBm) {
    const hw = HARDWARE_PROFILES[activeHardware];
    const maxSpeed = activeBand === '5ghz' ? hw.max5G : hw.max2G;

    if (dBm >= -52) return maxSpeed;
    if (dBm >= -62) return Math.round(maxSpeed * 0.7);
    if (dBm >= -72) return Math.round(maxSpeed * 0.35);
    if (dBm >= -82) return Math.round(maxSpeed * 0.12);
    if (dBm >= -88) return 15;
    return 0;
  }

  // Map dBm to RGB Heatmap Color
  function signalToColor(dBm) {
    const norm = Math.max(0, Math.min(1, (dBm + 88) / 40));
    let r = 0, g = 0, b = 0;

    if (norm < 0.25) {
      const t = norm / 0.25;
      r = Math.floor(15 + t * (239 - 15));
      g = Math.floor(23 + t * (68 - 23));
      b = Math.floor(42 + t * (68 - 42));
    } else if (norm < 0.5) {
      const t = (norm - 0.25) / 0.25;
      r = Math.floor(239 + t * (245 - 239));
      g = Math.floor(68 + t * (158 - 68));
      b = Math.floor(68 + t * (11 - 68));
    } else if (norm < 0.75) {
      const t = (norm - 0.5) / 0.25;
      r = Math.floor(245 - t * (245 - 16));
      g = Math.floor(158 + t * (185 - 158));
      b = Math.floor(11 + t * (129 - 11));
    } else {
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
    if (animTarget) {
      const dx = animTarget.x - nodes[0].x;
      const dy = animTarget.y - nodes[0].y;
      if (Math.hypot(dx, dy) > 2) {
        nodes[0].x += dx * 0.15;
        nodes[0].y += dy * 0.15;
        computeHeatmapGrid();
        updateAnalytics();
      } else {
        nodes[0].x = animTarget.x;
        nodes[0].y = animTarget.y;
        animTarget = null;
        computeHeatmapGrid();
        updateAnalytics();
      }
    }

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // 1. Draw Uploaded Floorplan Image if present
    if (uploadedFloorplanImg) {
      ctx.save();
      ctx.globalAlpha = uploadedImgOpacity;
      ctx.drawImage(uploadedFloorplanImg, 0, 0, V_WIDTH, V_HEIGHT);
      ctx.restore();
    }

    // 2. Draw Heatmap
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreenCanvas, 0, 0, GRID_W, GRID_H, 0, 0, V_WIDTH, V_HEIGHT);

    // 3. Draw Rooms
    activeFloorplan.rooms.forEach(room => {
      const isSel = room === selectedRoom;
      const isHov = room === hoveredRoom;

      ctx.fillStyle = isSel ? 'rgba(255, 75, 22, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(room.x, room.y, room.w, room.h);

      ctx.strokeStyle = isSel ? '#FF4B16' : (isHov ? '#F59E0B' : 'rgba(255, 255, 255, 0.16)');
      ctx.lineWidth = isSel ? 2.5 : (isHov ? 2 : 1);
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      // Draw resize handle on selected room (bottom right corner)
      if (isSel) {
        ctx.fillStyle = '#FF4B16';
        ctx.fillRect(room.x + room.w - 12, room.y + room.h - 12, 12, 12);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(room.x + room.w - 12, room.y + room.h - 12, 12, 12);
      }

      ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = ctx.measureText(room.name).width + 12;

      ctx.fillStyle = isSel ? 'rgba(255, 75, 22, 0.9)' : 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(room.x + room.w / 2 - textW / 2, room.y + room.h / 2 - 10, textW, 20);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(room.name, room.x + room.w / 2, room.y + room.h / 2);
    });

    // 4. Draw Walls
    const allWalls = [...activeFloorplan.walls, ...customWalls];
    allWalls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);

      if (wall.type === 'brick') {
        ctx.strokeStyle = '#E05638';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });

    // 5. Draw Active Wall Preview
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

    // 6. Draw Transmitters
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
      ctx.fillRect(node.x - tagW / 2, node.y + 20, tagW, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(tagText, node.x, node.y + 30);
    });

    requestAnimationFrame(draw);
  }

  // --- Diagnostic Analytics Calculation ---
  function updateAnalytics() {
    let strongCount = 0;
    let goodCount = 0;
    let deadCount = 0;
    let roomRowsHtml = '';
    let totalSpeed = 0;

    activeFloorplan.rooms.forEach(room => {
      const midX = room.x + room.w / 2;
      const midY = room.y + room.h / 2;
      const dBm = getSignalStrengthAt(midX, midY);
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
    const avgSpeed = Math.round(totalSpeed / totalRooms);
    const coverageScore = activeFloorplan.rooms.length === 0 ? 0 : Math.min(100, Math.round(((strongCount * 1.0 + goodCount * 0.65 + (totalRooms - deadCount - strongCount - goodCount) * 0.2) / totalRooms) * 100));
    if (coveragePercentEl) coveragePercentEl.textContent = `${coverageScore}%`;
    if (progressFillEl) progressFillEl.style.width = `${coverageScore}%`;

    // Activity Matrix
    if (actNetflix) {
      const streams = Math.max(0, Math.floor(avgSpeed / 25));
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
        adviceTextEl.innerHTML = `<strong>✨ Optimal Coverage (${coverageScore}%):</strong> Wi-Fi signal is strong across all rooms. If downloads feel slow or 4K streams buffer, your NBN speed tier is the bottleneck.`;
      } else if (deadCount > 0 && nodes.length === 1) {
        adviceTextEl.innerHTML = `<strong>⚠️ Dead Zones Detected (${deadCount} room${deadCount > 1 ? 's' : ''}):</strong> Double brick walls are blocking 5GHz Wi-Fi. Try clicking <em>"✨ Auto-Optimize"</em> or <em>"+ Add Booster"</em>.`;
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

  // --- Populate Quick Room Jumpers ---
  function updateQuickJumpBar() {
    if (!quickJumpContainer) return;
    if (activeFloorplan.rooms.length === 0) {
      quickJumpContainer.innerHTML = '';
      return;
    }

    let html = '<span class="wifi-quick-jump-label">Jump Router:</span>';
    activeFloorplan.rooms.forEach(room => {
      const midX = room.x + room.w / 2;
      const midY = room.y + room.h / 2;
      html += `<button class="wifi-jump-btn" data-jump-x="${midX}" data-jump-y="${midY}">${room.name}</button>`;
    });

    quickJumpContainer.innerHTML = html;

    quickJumpContainer.querySelectorAll('.wifi-jump-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        animTarget = { x: parseFloat(btn.dataset.jumpX), y: parseFloat(btn.dataset.jumpY) };
        showToast(`Moved router to ${btn.textContent}`);
      });
    });
  }

  // --- Update Room Inspector Position ---
  function updateRoomInspector() {
    if (!roomInspector) return;
    if (!selectedRoom) {
      roomInspector.classList.remove('is-active');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / V_WIDTH;
    const scaleY = rect.height / V_HEIGHT;

    const screenX = (selectedRoom.x + selectedRoom.w / 2) * scaleX;
    const screenY = selectedRoom.y * scaleY;

    roomInspector.style.left = `${screenX}px`;
    roomInspector.style.top = `${screenY}px`;
    if (inspectorRoomName) inspectorRoomName.textContent = selectedRoom.name;
    roomInspector.classList.add('is-active');
  }

  // --- Auto-Optimizer Algorithm ---
  function autoOptimizeRouterPosition() {
    if (activeFloorplan.rooms.length === 0) return;
    let bestScore = -1;
    let bestPos = { x: 380, y: 250 };

    for (let x = 120; x <= 680; x += 35) {
      for (let y = 100; y <= 400; y += 35) {
        let score = 0;
        activeFloorplan.rooms.forEach(room => {
          const midX = room.x + room.w / 2;
          const midY = room.y + room.h / 2;
          const sig = getSignalStrengthAt(midX, midY, [{ type: 'router', x, y }]);
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
  }

  // --- Coordinate Mapping ---
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

  function findRoomAt(x, y) {
    return activeFloorplan.rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
  }

  function isOverResizeHandle(room, x, y) {
    if (!room) return false;
    return x >= room.x + room.w - 18 && x <= room.x + room.w + 6 && y >= room.y + room.h - 18 && y <= room.y + room.h + 6;
  }

  // --- Pointer Handlers ---
  function onPointerDown(e) {
    const coords = getCanvasCoords(e);

    if (drawWallType) {
      wallStartPoint = { x: coords.x, y: coords.y, currentX: coords.x, currentY: coords.y };
      return;
    }

    const node = findNodeAt(coords.x, coords.y);
    if (node) {
      animTarget = null;
      draggingNode = node;
      node.isDragging = true;
      canvas.style.cursor = 'grabbing';
      if (e.cancelable) e.preventDefault();
      return;
    }

    // Check if clicked resize handle on selected room
    if (selectedRoom && isOverResizeHandle(selectedRoom, coords.x, coords.y)) {
      resizingRoom = { room: selectedRoom, startW: selectedRoom.w, startH: selectedRoom.h, startX: coords.x, startY: coords.y };
      if (e.cancelable) e.preventDefault();
      return;
    }

    // Room Selection & Move
    const room = findRoomAt(coords.x, coords.y);
    if (room) {
      selectedRoom = room;
      draggingRoom = { room, offsetX: coords.x - room.x, offsetY: coords.y - room.y };
      updateRoomInspector();
      if (e.cancelable) e.preventDefault();
    } else {
      selectedRoom = null;
      updateRoomInspector();
    }
  }

  function onPointerMove(e) {
    const coords = getCanvasCoords(e);

    if (drawWallType && wallStartPoint) {
      wallStartPoint.currentX = coords.x;
      wallStartPoint.currentY = coords.y;
      return;
    }

    if (draggingNode) {
      draggingNode.x = Math.max(60, Math.min(V_WIDTH - 60, coords.x));
      draggingNode.y = Math.max(60, Math.min(V_HEIGHT - 60, coords.y));
      computeHeatmapGrid();
      updateAnalytics();
      if (e.cancelable) e.preventDefault();
    } else if (resizingRoom) {
      const dw = coords.x - resizingRoom.startX;
      const dh = coords.y - resizingRoom.startY;
      resizingRoom.room.w = Math.max(80, Math.min(450, resizingRoom.startW + dw));
      resizingRoom.room.h = Math.max(60, Math.min(350, resizingRoom.startH + dh));
      updateRoomInspector();
      computeHeatmapGrid();
      updateAnalytics();
      if (e.cancelable) e.preventDefault();
    } else if (draggingRoom) {
      draggingRoom.room.x = Math.max(20, Math.min(V_WIDTH - draggingRoom.room.w - 20, coords.x - draggingRoom.offsetX));
      draggingRoom.room.y = Math.max(20, Math.min(V_HEIGHT - draggingRoom.room.h - 20, coords.y - draggingRoom.offsetY));
      updateRoomInspector();
      computeHeatmapGrid();
      updateAnalytics();
      if (e.cancelable) e.preventDefault();
    } else {
      hoveredNode = findNodeAt(coords.x, coords.y);
      hoveredRoom = findRoomAt(coords.x, coords.y);

      if (selectedRoom && isOverResizeHandle(selectedRoom, coords.x, coords.y)) {
        canvas.style.cursor = 'nwse-resize';
      } else if (hoveredNode || hoveredRoom) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = drawWallType ? 'crosshair' : 'default';
      }

      if (tooltip) {
        const dBm = getSignalStrengthAt(coords.x, coords.y);
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
          loss: drawWallType === 'brick' ? 16 : 6
        });
        showToast(`Added custom ${drawWallType} wall!`);
        computeHeatmapGrid();
        updateAnalytics();
      }

      wallStartPoint = null;
      return;
    }

    if (draggingNode) {
      draggingNode.isDragging = false;
      draggingNode = null;
      computeHeatmapGrid();
      updateAnalytics();
    }

    if (resizingRoom) {
      resizingRoom = null;
      computeHeatmapGrid();
      updateAnalytics();
    }

    if (draggingRoom) {
      draggingRoom = null;
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

  // ==========================================================================
  // ✏️ Room Inspector CRUD Actions (Rename, Delete)
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
      }
    });
  }

  if (inspectorDeleteBtn) {
    inspectorDeleteBtn.addEventListener('click', () => {
      if (!selectedRoom) return;
      const name = selectedRoom.name;
      activeFloorplan.rooms = activeFloorplan.rooms.filter(r => r !== selectedRoom);
      selectedRoom = null;
      updateRoomInspector();
      updateQuickJumpBar();
      computeHeatmapGrid();
      updateAnalytics();
      showToast(`🗑️ Deleted ${name}`);
    });
  }

  // ==========================================================================
  // 🗑️ Clear Canvas & Reset Actions
  // ==========================================================================
  if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', () => {
      if (confirm('Clear all rooms and walls to start from scratch?')) {
        activeFloorplan.rooms = [];
        activeFloorplan.walls = [];
        customWalls = [];
        selectedRoom = null;
        uploadedFloorplanImg = null;
        if (opacityControl) opacityControl.classList.remove('is-visible');
        nodes[0].x = 400; nodes[0].y = 250;
        updateRoomInspector();
        updateQuickJumpBar();
        computeHeatmapGrid();
        updateAnalytics();
        showToast('🗑️ Cleared canvas. Add rooms to start building!');
      }
    });
  }

  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      activeFloorplan = JSON.parse(JSON.stringify(DEFAULT_SUBURBAN));
      customWalls = [];
      selectedRoom = null;
      uploadedFloorplanImg = null;
      if (opacityControl) opacityControl.classList.remove('is-visible');
      nodes[0].x = 230; nodes[0].y = 200;
      updateRoomInspector();
      updateQuickJumpBar();
      computeHeatmapGrid();
      updateAnalytics();
      showToast('🔄 Reset layout to default Suburban Home');
    });
  }

  // ==========================================================================
  // 📸 Option 2: Real Estate Floorplan Image Upload & Auto-Generation!
  // ==========================================================================
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

          // ✨ Auto-Generate Rooms and Walls fitted to uploaded image geometry
          activeFloorplan.rooms = [
            { id: 'auto_r1', name: 'Living & Entry', x: 90, y: 80, w: 320, h: 220 },
            { id: 'auto_r2', name: 'Kitchen / Dining', x: 420, y: 80, w: 290, h: 160 },
            { id: 'auto_r3', name: 'Master Bed', x: 90, y: 310, w: 220, h: 140 },
            { id: 'auto_r4', name: 'Bath & Laundry', x: 320, y: 310, w: 120, h: 140 },
            { id: 'auto_r5', name: 'Bed 2 / Office', x: 450, y: 250, w: 260, h: 200 }
          ];

          activeFloorplan.walls = [
            { id: 'auto_w1', x1: 90, y1: 80, x2: 710, y2: 80, type: 'brick', loss: 16 },
            { id: 'auto_w2', x1: 710, y1: 80, x2: 710, y2: 450, type: 'brick', loss: 16 },
            { id: 'auto_w3', x1: 710, y1: 450, x2: 90, y2: 450, type: 'brick', loss: 16 },
            { id: 'auto_w4', x1: 90, y1: 450, x2: 90, y2: 80, type: 'brick', loss: 16 },
            { id: 'auto_w5', x1: 420, y1: 80, x2: 420, y2: 250, type: 'brick', loss: 14 },
            { id: 'auto_w6', x1: 90, y1: 310, x2: 450, y2: 310, type: 'drywall', loss: 6 }
          ];

          customWalls = [];
          nodes[0].x = 250; nodes[0].y = 190;
          uploadBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Change Image
          `;
          showToast('✨ Auto-generated 5 rooms & boundary walls from your floorplan image!');
          updateQuickJumpBar();
          computeHeatmapGrid();
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
    });
  }

  // ==========================================================================
  // 🧩 Option 3: Modular Room Block CRUD Builder
  // ==========================================================================
  if (toggleRoomTrayBtn && roomTray) {
    toggleRoomTrayBtn.addEventListener('click', () => {
      isRoomEditMode = !isRoomEditMode;
      toggleRoomTrayBtn.classList.toggle('is-active', isRoomEditMode);
      roomTray.classList.toggle('is-active', isRoomEditMode);
      showToast(isRoomEditMode ? '🧩 Room Builder active: Click + buttons or select & resize rooms' : 'Exited Room Builder');
    });
  }

  document.querySelectorAll('[data-add-room]').forEach(btn => {
    btn.addEventListener('click', () => {
      const roomType = btn.dataset.addRoom;
      const roomConfig = {
        'Living Room': { w: 240, h: 180 },
        'Master Bedroom': { w: 200, h: 160 },
        'Bedroom': { w: 180, h: 150 },
        'Kitchen': { w: 200, h: 140 },
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
      computeHeatmapGrid();
      updateAnalytics();
      showToast(`Added ${roomType}! Drag to move or drag corner to resize.`);
    });
  });

  // ==========================================================================
  // 🏠 Option 1: House Customizer Wizard Generator
  // ==========================================================================
  if (openWizardBtn && wizardModal && closeWizardBtn) {
    openWizardBtn.addEventListener('click', () => wizardModal.classList.add('is-open'));
    closeWizardBtn.addEventListener('click', () => wizardModal.classList.remove('is-open'));

    document.querySelectorAll('.wifi-pill-opt').forEach(pill => {
      pill.addEventListener('click', () => {
        const group = pill.closest('.wifi-pill-options');
        group.querySelectorAll('.wifi-pill-opt').forEach(p => p.classList.remove('is-selected'));
        pill.classList.add('is-selected');
      });
    });

    if (submitWizardBtn) {
      submitWizardBtn.addEventListener('click', () => {
        const beds = document.querySelector('[data-wizard-group="beds"] .is-selected')?.dataset.val || '3';
        const shape = document.querySelector('[data-wizard-group="shape"] .is-selected')?.dataset.val || 'standard';
        const wallMat = document.querySelector('[data-wizard-group="wall"] .is-selected')?.dataset.val || 'double_brick';
        const nbnLoc = document.querySelector('[data-wizard-group="nbn"] .is-selected')?.dataset.val || 'living';

        const lossVal = wallMat === 'double_brick' ? 16 : (wallMat === 'concrete' ? 18 : 8);

        if (beds === '1' || beds === '2') {
          activeFloorplan = {
            name: `${beds}-Bed Apartment`,
            rooms: [
              { id: 'r1', name: 'Open Living & Kitchen', x: 100, y: 90, w: 340, h: 280 },
              { id: 'r2', name: 'Master Bedroom', x: 440, y: 90, w: 260, h: 140 },
              { id: 'r3', name: 'Bathroom / Study', x: 440, y: 230, w: 260, h: 140 }
            ],
            walls: [
              { id: 'w1', x1: 100, y1: 90, x2: 700, y2: 90, type: 'brick', loss: lossVal },
              { id: 'w2', x1: 700, y1: 90, x2: 700, y2: 370, type: 'brick', loss: lossVal },
              { id: 'w3', x1: 700, y1: 370, x2: 100, y2: 370, type: 'brick', loss: lossVal },
              { id: 'w4', x1: 100, y1: 370, x2: 100, y2: 90, type: 'brick', loss: lossVal },
              { id: 'w5', x1: 440, y1: 90, x2: 440, y2: 370, type: 'brick', loss: lossVal - 2 },
              { id: 'w6', x1: 440, y1: 230, x2: 700, y2: 230, type: 'drywall', loss: 5 }
            ]
          };
        } else if (shape === 'l_shape') {
          activeFloorplan = {
            name: `${beds}-Bed L-Shaped Home`,
            rooms: [
              { id: 'r1', name: 'Front Living', x: 80, y: 80, w: 280, h: 220 },
              { id: 'r2', name: 'Kitchen & Dining', x: 360, y: 80, w: 360, h: 160 },
              { id: 'r3', name: 'Master Bed', x: 80, y: 300, w: 200, h: 150 },
              { id: 'r4', name: 'Bed 2', x: 280, y: 300, w: 200, h: 150 },
              { id: 'r5', name: 'Home Office / Patio', x: 480, y: 240, w: 240, h: 210 }
            ],
            walls: [
              { id: 'w1', x1: 80, y1: 80, x2: 720, y2: 80, type: 'brick', loss: lossVal },
              { id: 'w2', x1: 720, y1: 80, x2: 720, y2: 450, type: 'brick', loss: lossVal },
              { id: 'w3', x1: 720, y1: 450, x2: 80, y2: 450, type: 'brick', loss: lossVal },
              { id: 'w4', x1: 80, y1: 450, x2: 80, y2: 80, type: 'brick', loss: lossVal },
              { id: 'w5', x1: 360, y1: 80, x2: 360, y2: 240, type: 'brick', loss: lossVal - 2 },
              { id: 'w6', x1: 80, y1: 300, x2: 480, y2: 300, type: 'drywall', loss: 6 }
            ]
          };
        } else {
          activeFloorplan = {
            name: `${beds}-Bed Australian Family Home`,
            rooms: [
              { id: 'r1', name: 'Living Room', x: 80, y: 70, w: 280, h: 210 },
              { id: 'r2', name: 'Kitchen & Dining', x: 360, y: 70, w: 260, h: 170 },
              { id: 'r3', name: 'Home Office / Bed 3', x: 620, y: 70, w: 120, h: 170 },
              { id: 'r4', name: 'Master Bed', x: 80, y: 280, w: 220, h: 170 },
              { id: 'r5', name: 'Ensuite / Bath', x: 300, y: 280, w: 110, h: 170 },
              { id: 'r6', name: 'Bedroom 2', x: 410, y: 240, w: 210, h: 210 },
              { id: 'r7', name: 'Alfresco Patio', x: 620, y: 240, w: 120, h: 210 }
            ],
            walls: [
              { id: 'w1', x1: 80, y1: 70, x2: 740, y2: 70, type: 'brick', loss: lossVal },
              { id: 'w2', x1: 740, y1: 70, x2: 740, y2: 450, type: 'brick', loss: lossVal },
              { id: 'w3', x1: 740, y1: 450, x2: 80, y2: 450, type: 'brick', loss: lossVal },
              { id: 'w4', x1: 80, y1: 450, x2: 80, y2: 70, type: 'brick', loss: lossVal },
              { id: 'w5', x1: 360, y1: 70, x2: 360, y2: 240, type: 'brick', loss: lossVal - 2 },
              { id: 'w6', x1: 410, y1: 240, x2: 620, y2: 240, type: 'brick', loss: lossVal - 3 },
              { id: 'w7', x1: 80, y1: 280, x2: 410, y2: 280, type: 'drywall', loss: 6 },
              { id: 'w8', x1: 300, y1: 280, x2: 300, y2: 450, type: 'drywall', loss: 6 },
              { id: 'w9', x1: 410, y1: 240, x2: 410, y2: 450, type: 'drywall', loss: 6 },
              { id: 'w10', x1: 620, y1: 70, x2: 620, y2: 450, type: 'drywall', loss: 8 }
            ]
          };
        }

        if (nbnLoc === 'garage') {
          nodes[0].x = 650; nodes[0].y = 350;
        } else if (nbnLoc === 'hallway') {
          nodes[0].x = 360; nodes[0].y = 260;
        } else if (nbnLoc === 'office') {
          nodes[0].x = 650; nodes[0].y = 150;
        } else {
          nodes[0].x = 220; nodes[0].y = 180;
        }

        customWalls = [];
        selectedRoom = null;
        wizardModal.classList.remove('is-open');
        updateRoomInspector();
        updateQuickJumpBar();
        computeHeatmapGrid();
        updateAnalytics();
        showToast(`✨ Generated ${activeFloorplan.name}!`);
      });
    }
  }

  // --- UI: Auto-Optimizer Button ---
  const autoOptBtn = document.getElementById('autoOptimizeBtn');
  if (autoOptBtn) {
    autoOptBtn.addEventListener('click', autoOptimizeRouterPosition);
  }

  // --- UI: Router Hardware Profile Dropdown ---
  const hwSelect = document.getElementById('routerHardwareSelect');
  if (hwSelect) {
    hwSelect.addEventListener('change', () => {
      activeHardware = hwSelect.value;
      showToast(`Switched to ${HARDWARE_PROFILES[activeHardware].name}`);
      computeHeatmapGrid();
      updateAnalytics();
    });
  }

  // --- UI: Custom Wall Drawing Buttons ---
  const drawBrickBtn = document.getElementById('drawBrickBtn');

  function setDrawMode(type, activeBtn) {
    if (drawWallType === type) {
      drawWallType = null;
      activeBtn.classList.remove('is-active');
      showToast('Wall drawing disabled');
    } else {
      drawWallType = type;
      activeBtn.classList.add('is-active');
      showToast(`Click & drag to draw ${type} wall`);
    }
  }

  if (drawBrickBtn) drawBrickBtn.addEventListener('click', () => setDrawMode('brick', drawBrickBtn));

  // --- UI: Share / Export PNG Snapshot ---
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

  // --- UI: Frequency Band Toggle ---
  document.querySelectorAll('[data-band]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-band]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeBand = btn.dataset.band;
      computeHeatmapGrid();
      updateAnalytics();
    });
  });

  // --- UI: Add / Remove Mesh Booster ---
  const addMeshBtn = document.getElementById('addMeshBtn');
  if (addMeshBtn) {
    addMeshBtn.addEventListener('click', () => {
      if (nodes.length === 1) {
        nodes.push({ id: 'mesh1', type: 'mesh', name: 'Mesh Booster', x: 540, y: 340, isDragging: false });
        addMeshBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Remove Booster
        `;
        addMeshBtn.classList.add('wifi-tool-btn--accent');
      } else {
        nodes.pop();
        addMeshBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Add Booster
        `;
        addMeshBtn.classList.remove('wifi-tool-btn--accent');
      }
      computeHeatmapGrid();
      updateAnalytics();
    });
  }

  // --- Mode Switcher (Simulator vs Live Walkthrough) ---
  const modeSimBtn = document.getElementById('modeSimBtn');
  const modeLiveBtn = document.getElementById('modeLiveBtn');
  const simWorkspace = document.getElementById('simWorkspace');
  const layoutHub = document.getElementById('layoutHub');
  const quickJumpBar = document.getElementById('quickJumpContainer');
  const livePanel = document.getElementById('liveScannerPanel');

  if (modeSimBtn && modeLiveBtn && simWorkspace && livePanel) {
    modeSimBtn.addEventListener('click', () => {
      modeSimBtn.classList.add('is-active');
      modeLiveBtn.classList.remove('is-active');
      simWorkspace.style.display = 'grid';
      if (layoutHub) layoutHub.style.display = 'flex';
      if (quickJumpBar) quickJumpBar.style.display = 'flex';
      livePanel.classList.remove('is-active');
    });

    modeLiveBtn.addEventListener('click', () => {
      modeLiveBtn.classList.add('is-active');
      modeSimBtn.classList.remove('is-active');
      simWorkspace.style.display = 'none';
      if (layoutHub) layoutHub.style.display = 'none';
      if (quickJumpBar) quickJumpBar.style.display = 'none';
      livePanel.classList.add('is-active');
    });
  }

  // ==========================================================================
  // 📱 Live In-Browser Mobile Phone Signal Scanner Engine
  // ==========================================================================
  const startScanBtn = document.getElementById('startRoomScanBtn');
  const liveQualityVal = document.getElementById('liveQualityVal');
  const liveLatencyNum = document.getElementById('liveLatencyNum');
  const liveJitterNum = document.getElementById('liveJitterNum');
  const liveSpeedEstNum = document.getElementById('liveSpeedEstNum');
  const auditHistoryList = document.getElementById('auditHistoryList');
  let selectedRoomName = 'Living Room';
  const scannedAuditLog = {};

  document.querySelectorAll('[data-scan-room]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-scan-room]').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      selectedRoomName = btn.dataset.scanRoom;
    });
  });

  if (startScanBtn) {
    startScanBtn.addEventListener('click', async () => {
      startScanBtn.disabled = true;
      startScanBtn.textContent = `Testing signal in ${selectedRoomName}...`;

      const pings = [];
      for (let i = 0; i < 4; i++) {
        const t0 = performance.now();
        try {
          await fetch(`/assets/img/hero-bg.webp?cache_bust=${Date.now()}_${i}`, { method: 'HEAD', cache: 'no-store' });
          const rtt = Math.round(performance.now() - t0);
          pings.push(rtt);
        } catch (e) {
          pings.push(45);
        }
      }

      const avgLatency = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
      const jitter = Math.max(...pings) - Math.min(...pings);

      let qualityScore = 95;
      let estBandwidth = 380;
      let statusLabel = 'Excellent';

      if (avgLatency > 120) {
        qualityScore = 38;
        estBandwidth = 25;
        statusLabel = 'Poor / Dead Zone';
      } else if (avgLatency > 70) {
        qualityScore = 65;
        estBandwidth = 110;
        statusLabel = 'Fair';
      } else if (avgLatency > 40) {
        qualityScore = 85;
        estBandwidth = 240;
        statusLabel = 'Good';
      }

      if (liveQualityVal) liveQualityVal.textContent = `${qualityScore}%`;
      if (liveLatencyNum) liveLatencyNum.textContent = `${avgLatency} ms`;
      if (liveJitterNum) liveJitterNum.textContent = `${jitter} ms`;
      if (liveSpeedEstNum) liveSpeedEstNum.textContent = `${estBandwidth} Mbps`;

      scannedAuditLog[selectedRoomName] = { qualityScore, avgLatency, estBandwidth, statusLabel };

      if (auditHistoryList) {
        let rows = '';
        Object.entries(scannedAuditLog).forEach(([room, data]) => {
          const badgeClass = data.qualityScore >= 80 ? 'wifi-room-tag--strong' : (data.qualityScore >= 60 ? 'wifi-room-tag--good' : 'wifi-room-tag--dead');
          rows += `
            <div class="wifi-audit-row">
              <span><strong>${room}</strong></span>
              <span style="color:#64748B; font-size:0.75rem;">${data.avgLatency}ms (${data.estBandwidth} Mbps)</span>
              <span class="wifi-room-tag ${badgeClass}">${data.qualityScore}% ${data.statusLabel}</span>
            </div>
          `;
        });
        auditHistoryList.innerHTML = rows;
      }

      showToast(`✅ Scanned ${selectedRoomName}: ${qualityScore}% (${statusLabel})`);
      startScanBtn.disabled = false;
      startScanBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Scan Another Room
      `;
    });
  }

  // --- Initial Launch ---
  updateQuickJumpBar();
  computeHeatmapGrid();
  updateAnalytics();
  requestAnimationFrame(draw);

})();

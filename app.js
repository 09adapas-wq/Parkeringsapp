/* ==================== TILLSTÅND & DATA ==================== */
const MAX_PARK_MINUTES = 7 * 24 * 60; // 7 dagar = 10 080 minuter
const MIN_PARK_MINUTES = 15;          // Minsta parkeringstid = 15 minuter

const ZONES = {
  "1042": {
    code: "1042",
    letter: "A",
    name: "Sjöparkeringen",
    address: "Sjövägen 12 · Södra hamnen",
    rate: 20,
    free: 30,
    total: 58,
    walk: "2 min till fots",
    type: "Utomhus · markerad zon A",
    pinX: 69,
    pinY: 75
  },
  "1053": {
    code: "1053",
    letter: "B",
    name: "Shopping & Pool",
    address: "Centrumstråket 4",
    rate: 25,
    free: 14,
    total: 42,
    walk: "1 min till fots",
    type: "Utomhus · vid Shopping & Pool",
    pinX: 50,
    pinY: 47
  },
  "1064": {
    code: "1064",
    letter: "C",
    name: "Skogsparkeringen",
    address: "Skogsbrynet 8",
    rate: 15,
    free: 22,
    total: 36,
    walk: "3 min till fots",
    type: "Utomhus · vid skogsområdet",
    pinX: 34,
    pinY: 59
  },
  "1075": {
    code: "1075",
    letter: "D",
    name: "Norra Hamnen",
    address: "Helikopterplattan · Kajen",
    rate: 20,
    free: 11,
    total: 24,
    walk: "4 min till fots",
    type: "Kajparkering · öppet dygnet runt",
    pinX: 54,
    pinY: 22
  },
  "1086": {
    code: "1086",
    letter: "E",
    name: "Södra Skogsvägen",
    address: "Tallstigen 1",
    rate: 10,
    free: 18,
    total: 25,
    walk: "5 min till fots",
    type: "Långtidsparkering · skogskanten",
    pinX: 16,
    pinY: 77
  }
};

const LOT_COLUMNS = [
  [
    { num: 7, status: "free" },
    { num: 6, status: "taken" },
    { num: 5, status: "taken" },
    { num: 4, status: "free" },
    { num: 3, status: "taken" },
    { num: 2, status: "free" },
    { num: 1, status: "taken" }
  ],
  [
    { num: 13, status: "taken" },
    { num: 12, status: "taken" },
    { num: 11, status: "taken" },
    { num: 10, status: "taken" },
    { num: 9, status: "free" },
    { num: 8, status: "taken" }
  ],
  [
    { num: 21, status: "taken" },
    { num: 20, status: "taken" },
    { num: 19, status: "taken" },
    { num: 18, status: "taken" },
    { num: 17, status: "taken" },
    { num: 16, status: "free" },
    { num: 15, status: "taken" },
    { num: 14, status: "taken" }
  ]
];

const state = {
  currentView: "map",
  historyStack: [],
  selectedZoneCode: "1042",
  selectedSpotNum: 16,
  durationMinutes: 120,
  paymentMethod: "Apple Pay",
  extendMinutes: 60,
  reminderEnabled: true,
  favorites: ["1042", "1053"],
  account: {
    name: "Alex Lind",
    email: "alex.lind@info.se",
    vehicles: ["ABC 123", "XYZ 789"],
    activeVehicle: "ABC 123"
  },
  activeSessions: [],
  selectedActiveId: null,
  lastEndedSession: null,
  pastSessions: [
    {
      id: "R-901",
      zoneName: "Sjöparkeringen",
      zoneCode: "1042",
      spot: "A-12",
      dateLabel: "21 okt · 10:00–11:00",
      durationText: "1 timme (60 min)",
      amount: 20,
      plate: "ABC 123",
      paymentMethod: "Apple Pay"
    },
    {
      id: "R-902",
      zoneName: "Shopping & Pool",
      zoneCode: "1053",
      spot: "B-04",
      dateLabel: "18 okt · 12:30–14:30",
      durationText: "2 timmar (120 min)",
      amount: 50,
      plate: "ABC 123",
      paymentMethod: "Kort"
    },
    {
      id: "R-903",
      zoneName: "Skogsparkeringen",
      zoneCode: "1064",
      spot: "C-09",
      dateLabel: "15 okt · 09:00–10:30",
      durationText: "1 timme 30 min (90 min)",
      amount: 22.5,
      plate: "ABC 123",
      paymentMethod: "Swish"
    }
  ]
};

let countdownInterval = null;
let mainMapController = null;

/* ==================== PAN, ZOOM & KOMPASS-ROTATION FÖR KARTAN ==================== */
function initInteractiveMap() {
  const viewport = document.getElementById("main-map-viewport");
  const canvas = document.getElementById("main-map-canvas");
  const img = document.getElementById("main-map-img");
  const compassBtn = document.getElementById("btn-compass");
  const compassNeedle = document.getElementById("compass-needle");

  let scale = 1;
  let angle = 0; // 0 grader = Norr rakt uppåt
  let tx = 0;
  let ty = -65;

  let isDragging = false;
  let isRotating = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  let startAngle = 0;

  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchStartTouchAngle = 0;
  let pinchStartMapAngle = 0;

  const normalizeAngle = deg => {
    const a = ((deg + 180) % 360 + 360) % 360 - 180;
    return Math.abs(a) < 0.4 ? 0 : a;
  };

  const clampTransform = () => {
    const vw = viewport.clientWidth || 390;
    const vh = viewport.clientHeight || 368;
    const baseW = canvas.offsetWidth || vw;
    const baseH = canvas.offsetHeight || vw * 1.34;

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const p1x = scale * baseW * cos;
    const p1y = scale * baseW * sin;
    const p2x = -scale * baseH * sin;
    const p2y = scale * baseH * cos;
    const p3x = p1x + p2x;
    const p3y = p1y + p2y;

    const boxMinX = Math.min(0, p1x, p2x, p3x);
    const boxMaxX = Math.max(0, p1x, p2x, p3x);
    const boxMinY = Math.min(0, p1y, p2y, p3y);
    const boxMaxY = Math.max(0, p1y, p2y, p3y);

    const minTx = Math.min(-boxMinX, vw - boxMaxX);
    const maxTx = Math.max(-boxMinX, vw - boxMaxX);
    const minTy = Math.min(-boxMinY, vh - boxMaxY);
    const maxTy = Math.max(-boxMinY, vh - boxMaxY);

    tx = Math.max(minTx, Math.min(maxTx, tx));
    ty = Math.max(minTy, Math.min(maxTy, ty));
  };

  const updateCompassUI = () => {
    const norm = normalizeAngle(angle);
    if (compassNeedle) {
      compassNeedle.style.transform = `rotate(${angle}deg)`;
    }
    if (compassBtn) {
      compassBtn.classList.toggle("rotated", norm !== 0);
    }
  };

  const applyTransform = () => {
    clampTransform();
    canvas.style.transform = `translate(${tx}px, ${ty}px) rotate(${angle}deg) scale(${scale})`;
    canvas.querySelectorAll(".zone-pin").forEach(pin => {
      pin.style.transform = `rotate(${-angle}deg) scale(${1 / scale})`;
    });
    updateCompassUI();
  };

  const transformAround = (nextScale, nextAngle, cx, cy) => {
    const clampedScale = Math.max(1, Math.min(3.5, nextScale));
    const rad1 = (angle * Math.PI) / 180;
    const cos1 = Math.cos(rad1);
    const sin1 = Math.sin(rad1);

    const dx = cx - tx;
    const dy = cy - ty;
    const u = (dx * cos1 + dy * sin1) / scale;
    const v = (-dx * sin1 + dy * cos1) / scale;

    scale = clampedScale;
    angle = nextAngle;

    const rad2 = (angle * Math.PI) / 180;
    const cos2 = Math.cos(rad2);
    const sin2 = Math.sin(rad2);

    tx = cx - scale * (u * cos2 - v * sin2);
    ty = cy - scale * (u * sin2 + v * cos2);
    applyTransform();
  };

  const animateCanvas = callback => {
    canvas.classList.add("smooth-reset");
    callback();
    clearTimeout(canvas._animTimer);
    canvas._animTimer = setTimeout(() => {
      canvas.classList.remove("smooth-reset");
    }, 300);
  };

  const orientNorth = () => {
    const wasRotated = normalizeAngle(angle) !== 0;
    const cx = (viewport.clientWidth || 390) / 2;
    const cy = (viewport.clientHeight || 368) / 2;
    animateCanvas(() => {
      transformAround(scale, 0, cx, cy);
    });
    showToast(wasRotated ? "Kartan vänd mot norr" : "Kartan är vänd mot norr");
  };

  const resetView = () => {
    animateCanvas(() => {
      scale = 1;
      angle = 0;
      tx = 0;
      ty = -65;
      applyTransform();
    });
  };

  img.addEventListener("load", applyTransform);
  viewport.addEventListener("contextmenu", e => e.preventDefault());

  viewport.addEventListener("mousedown", e => {
    if (e.target.closest(".map-zoom-controls")) return;
    canvas.classList.remove("smooth-reset");
    hasDragged = false;
    startX = e.clientX;
    startY = e.clientY;

    if (e.shiftKey || e.button === 2) {
      isRotating = true;
      isDragging = false;
      startAngle = angle;
    } else {
      isDragging = true;
      isRotating = false;
      startTx = tx;
      startTy = ty;
    }
  });

  window.addEventListener("mousemove", e => {
    if (!isDragging && !isRotating) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged = true;

    if (isRotating) {
      const cx = (viewport.clientWidth || 390) / 2;
      const cy = (viewport.clientHeight || 368) / 2;
      transformAround(scale, startAngle + dx * 0.45, cx, cy);
    } else {
      tx = startTx + dx;
      ty = startTy + dy;
      applyTransform();
    }
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    isRotating = false;
  });

  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    canvas.classList.remove("smooth-reset");
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (e.shiftKey) {
      const deltaAngle = e.deltaY < 0 ? 12 : -12;
      transformAround(scale, angle + deltaAngle, cx, cy);
    } else {
      const factor = e.deltaY < 0 ? 1.18 : 0.85;
      transformAround(scale * factor, angle, cx, cy);
    }
  }, { passive: false });

  viewport.addEventListener("touchstart", e => {
    if (e.target.closest(".map-zoom-controls")) return;
    canvas.classList.remove("smooth-reset");
    if (e.touches.length === 1) {
      isDragging = true;
      hasDragged = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTx = tx;
      startTy = ty;
    } else if (e.touches.length === 2) {
      isDragging = false;
      hasDragged = true;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchStartDist = Math.hypot(dx, dy);
      pinchStartScale = scale;
      pinchStartTouchAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      pinchStartMapAngle = angle;
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", e => {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged = true;
      tx = startTx + dx;
      ty = startTy + dy;
      applyTransform();
    } else if (e.touches.length === 2 && pinchStartDist > 0) {
      e.preventDefault();
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const touchAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

      const rect = viewport.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      const nextScale = pinchStartScale * (dist / pinchStartDist);
      const nextAngle = pinchStartMapAngle + (touchAngle - pinchStartTouchAngle);
      transformAround(nextScale, nextAngle, cx, cy);
    }
  }, { passive: false });

  viewport.addEventListener("touchend", () => {
    isDragging = false;
    pinchStartDist = 0;
  });

  compassBtn.addEventListener("click", orientNorth);

  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    transformAround(scale * 1.3, angle, viewport.clientWidth / 2, viewport.clientHeight / 2);
  });

  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    transformAround(scale * 0.77, angle, viewport.clientWidth / 2, viewport.clientHeight / 2);
  });

  document.getElementById("btn-zoom-reset").addEventListener("click", resetView);

  mainMapController = {
    wasDragged: () => hasDragged,
    refresh: applyTransform
  };

  setTimeout(applyTransform, 50);
}

/* ==================== BILD-FALLBACK (KARTA & LOGOTYP) ==================== */
function setupFallbackOnImage(img) {
  if (!img || !img.dataset.fallbacks) return;
  const list = img.dataset.fallbacks.split(",").map(s => s.trim());
  let idx = 0;
  img.addEventListener("error", () => {
    if (idx < list.length) {
      img.src = list[idx++];
    } else {
      const svgFallback = img.parentElement && img.parentElement.querySelector(".brand-logo-fallback");
      if (svgFallback) {
        img.style.display = "none";
        svgFallback.style.display = "block";
      }
    }
  });
  img.addEventListener("load", () => {
    if (img.id === "zone-detail-photo") renderZoneFocusMap();
  });
}

function initImageFallbacks() {
  document.querySelectorAll("img[data-fallbacks]").forEach(setupFallbackOnImage);
}

/* ==================== INZOOMAD ZONBILD I VY 2 ==================== */
function renderZoneFocusMap() {
  const z = getZone();
  const viewport = document.getElementById("zone-map-viewport");
  const canvas = document.getElementById("zone-map-canvas");
  const photo = document.getElementById("zone-detail-photo");
  const pin = document.getElementById("zone-detail-pin");
  if (!viewport || !canvas || !photo || !pin) return;

  const vw = viewport.clientWidth || 390;
  const vh = viewport.clientHeight || 215;
  const imgRatio = (photo.naturalHeight && photo.naturalWidth)
    ? photo.naturalHeight / photo.naturalWidth
    : 1.34;

  const zoom = 1.6;
  const cw = vw * zoom;
  const ch = vw * imgRatio * zoom;

  const targetX = cw * (z.pinX / 100);
  const targetY = ch * (z.pinY / 100);

  const tx = Math.max(vw - cw, Math.min(0, vw / 2 - targetX));
  const ty = Math.max(vh - ch, Math.min(0, vh / 2 - targetY));

  canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
  pin.style.left = `${z.pinX}%`;
  pin.style.top = `${z.pinY}%`;
  document.getElementById("zone-pin-letter").textContent = z.letter;
  document.getElementById("zone-pin-name").textContent = z.name;
}

/* ==================== HJÄLPFUNKTIONER & VALIDERING ==================== */
function getZone() {
  return ZONES[state.selectedZoneCode];
}

function getZoneAvailability(z) {
  const activeInZone = state.activeSessions.filter(s => s.zoneCode === z.code).length;
  const free = Math.max(0, z.free - activeInZone);
  const occupied = z.total - free;
  return { free, occupied, total: z.total };
}

function isSpotOccupied(zoneCode, spotNum) {
  const baseSpot = LOT_COLUMNS.flat().find(s => s.num === spotNum);
  if (baseSpot && baseSpot.status === "taken") return true;
  return state.activeSessions.some(s => s.zoneCode === zoneCode && s.spotNum === spotNum);
}

function ensureFreeSpotSelected(zoneCode) {
  if (!isSpotOccupied(zoneCode, state.selectedSpotNum)) return;
  const firstFree = LOT_COLUMNS.flat().find(s => !isSpotOccupied(zoneCode, s.num));
  if (firstFree) state.selectedSpotNum = firstFree.num;
}

function normalizePlate(plate) {
  return (plate || "").replace(/\s+/g, "").toUpperCase();
}

function findActiveSessionByPlate(plate) {
  const norm = normalizePlate(plate);
  if (!norm) return null;
  return state.activeSessions.find(s => normalizePlate(s.plate) === norm) || null;
}

function getSelectedActiveSession() {
  if (state.activeSessions.length === 0) return null;
  return state.activeSessions.find(s => s.id === state.selectedActiveId) || state.activeSessions[0];
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(p => p[0]).join("").toUpperCase().slice(0, 2) || "AN";
}

function getStartedMinutes(act) {
  const elapsedSeconds = Math.max(0, act.totalSeconds - act.remainingSeconds);
  return Math.max(1, Math.ceil(elapsedSeconds / 60));
}

function setDurationMinutes(totalMins) {
  const snapped = Math.round(totalMins / 15) * 15;
  if (snapped < MIN_PARK_MINUTES) {
    state.durationMinutes = MIN_PARK_MINUTES;
    showToast("Minsta parkeringstid är 15 minuter");
  } else if (snapped > MAX_PARK_MINUTES) {
    state.durationMinutes = MAX_PARK_MINUTES;
    showToast("Maximal parkeringstid är 7 dagar");
  } else {
    state.durationMinutes = snapped;
  }
}

function formatPrice(kr) {
  const rounded = Math.round(kr * 100) / 100;
  return rounded % 1 === 0 ? `${rounded} kr` : `${rounded.toFixed(2).replace(".", ",")} kr`;
}

function formatDuration(totalMins) {
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const parts = [];
  if (days > 0) parts.push(days === 1 ? "1 dag" : `${days} dagar`);
  if (hours > 0) parts.push(hours === 1 ? "1 timme" : `${hours} timmar`);
  if (mins > 0) parts.push(`${mins} min`);
  return parts.join(" ") || "15 min";
}

function formatClock(dateObj) {
  return `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(dateObj) {
  const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
}

function formatRange(startDate, endDate) {
  const sameDay = startDate.toDateString() === endDate.toDateString();
  return sameDay
    ? `${formatClock(startDate)}–${formatClock(endDate)}`
    : `${formatShortDate(startDate)} ${formatClock(startDate)} – ${formatShortDate(endDate)} ${formatClock(endDate)}`;
}

function formatDigitalTimer(totalSec) {
  const days = Math.floor(totalSec / 86400);
  const hrs = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, "0");
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const secs = String(totalSec % 60).padStart(2, "0");
  return days > 0 ? `${days}d ${hrs}:${mins}:${secs}` : `${hrs}:${mins}:${secs}`;
}

function showToast(msg) {
  const el = document.getElementById("app-toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ==================== NAVIGATION ==================== */
function navigateTo(viewId, pushHistory = true) {
  if (viewId === "spots") {
    ensureFreeSpotSelected(state.selectedZoneCode);
  }

  if (viewId === "booking") {
    ensureFreeSpotSelected(state.selectedZoneCode);
    if (findActiveSessionByPlate(state.account.activeVehicle)) {
      const freeVeh = state.account.vehicles.find(v => !findActiveSessionByPlate(v));
      if (freeVeh) state.account.activeVehicle = freeVeh;
    }
  }

  if (pushHistory && state.currentView && state.currentView !== viewId) {
    state.historyStack.push(state.currentView);
  }
  state.currentView = viewId;

  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.add("active");
    const tabName = target.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("active", t.dataset.navTab === tabName);
    });
  }

  const hideTabViews = ["spots", "booking", "confirmation", "active", "extend", "ended"];
  document.getElementById("main-tab-bar").style.display = hideTabViews.includes(viewId) ? "none" : "grid";
  renderAll();
  if (viewId === "map" && mainMapController) mainMapController.refresh();
  if (viewId === "zone") requestAnimationFrame(renderZoneFocusMap);
}

function goBack() {
  navigateTo(state.historyStack.pop() || "map", false);
}

/* ==================== RENDERING ==================== */
function renderAll() {
  const z = getZone();
  const zAvail = getZoneAvailability(z);
  const acc = state.account;

  // 1. Karta & markörer
  document.querySelectorAll(".zone-pin[data-select-zone]").forEach(pin => {
    const code = pin.dataset.selectZone;
    pin.classList.toggle("active-pin", code === z.code);
    const freeSpan = pin.querySelector(`[data-pin-free="${code}"]`);
    if (freeSpan && ZONES[code]) {
      freeSpan.textContent = `${getZoneAvailability(ZONES[code]).free} lediga`;
    }
  });

  document.getElementById("map-card-letter").textContent = z.letter;
  document.getElementById("map-card-name").textContent = z.name;
  document.getElementById("map-card-meta").textContent = `${z.code} · ${z.rate} kr/tim`;
  document.getElementById("map-card-free").textContent = `${zAvail.free} lediga`;
  document.getElementById("map-card-occ").textContent = `${zAvail.occupied} av ${zAvail.total} upptagna`;
  document.getElementById("map-card-walk").textContent = z.walk;

  // 2. Zon
  renderZoneFocusMap();
  document.getElementById("zone-badge-letter").textContent = z.letter;
  document.getElementById("zone-badge-free").textContent = `${zAvail.free} lediga`;
  document.getElementById("zone-title").textContent = z.name;
  document.getElementById("zone-subtitle").textContent = `${z.address} · Zonkod ${z.code}`;
  document.getElementById("zone-pill-free").textContent = `${zAvail.free} lediga`;
  document.getElementById("zone-pill-occ").textContent = `${zAvail.occupied} av ${zAvail.total} upptagna`;
  document.getElementById("zone-type-text").textContent = z.type;
  document.getElementById("zone-rate-text").textContent = `${z.rate} kr/tim`;
  document.getElementById("btn-toggle-favorite").textContent = state.favorites.includes(z.code)
    ? "♥ Sparad som favorit"
    : "♡ Spara som favorit";

  // 3. Riktig parkeringskarta
  document.getElementById("spots-zone-tag").textContent = `Zon ${z.letter} · ${z.name}`;
  renderRealParkingLot();
  document.getElementById("selected-spot-label").textContent = `Ruta ${z.letter}-${state.selectedSpotNum}`;
  document.getElementById("btn-confirm-spot").textContent = `→ Parkera på ruta ${z.letter}-${state.selectedSpotNum}`;

  // 4. Bokning (15-minuterssteg + fordonskonflikt)
  const totalMins = state.durationMinutes;
  const d = Math.floor(totalMins / 1440);
  const h = Math.floor((totalMins % 1440) / 60);
  const m = totalMins % 60;
  const now = new Date();
  const endDate = new Date(now.getTime() + totalMins * 60000);
  const maxKr = (totalMins / 60) * z.rate;

  document.getElementById("book-spot-badge").textContent = `${z.letter}-${state.selectedSpotNum}`;
  document.getElementById("book-zone-name").textContent = z.name;
  document.getElementById("book-zone-sub").textContent = `Zon ${z.code} · ${z.address}`;

  const plateInput = document.getElementById("plate-field");
  if (document.activeElement !== plateInput) {
    plateInput.value = acc.activeVehicle;
  }
  renderBookingVehicleChips();

  const plateConflict = findActiveSessionByPlate(acc.activeVehicle);
  const plateBox = document.getElementById("plate-input-box");
  const conflictEl = document.getElementById("plate-conflict-warning");
  const startBtn = document.getElementById("btn-pay-and-start");

  if (plateConflict) {
    plateBox.classList.add("conflict");
    conflictEl.style.display = "block";
    conflictEl.textContent = `⚠️ ${plateConflict.plate} är redan parkerad på ${plateConflict.spot} (${plateConflict.zoneName}). Samma fordon kan inte parkeras på två ställen samtidigt.`;
    startBtn.classList.add("btn-blocked");
    startBtn.textContent = `⛔ ${plateConflict.plate} är redan parkerad`;
  } else {
    plateBox.classList.remove("conflict");
    conflictEl.style.display = "none";
    startBtn.classList.remove("btn-blocked");
    startBtn.textContent = `🔒 Starta parkering (max ${formatPrice(maxKr)})`;
  }

  document.getElementById("book-rate-label").textContent = `${z.rate} kr/tim`;
  document.getElementById("timer-days-input").value = String(d);
  document.getElementById("timer-hours-input").value = String(h).padStart(2, "0");
  document.getElementById("timer-mins-input").value = String(m).padStart(2, "0");

  document.getElementById("book-time-range").textContent = formatRange(now, endDate);
  document.getElementById("book-pay-hint").textContent = `Debiteras per påbörjad minut via ${state.paymentMethod}.`;
  document.getElementById("book-formula").textContent = `Max ${formatDuration(totalMins)} · faktureras per påbörjad min`;
  document.getElementById("book-total-price").textContent = formatPrice(maxKr);

  document.querySelectorAll("#book-payment-seg .seg-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.val === state.paymentMethod);
  });

  // 5 & 6. Aktiva sessioner, Bekräftelse, Timer & Förläng
  const activeCount = state.activeSessions.length;
  const shortcutBtn = document.getElementById("btn-active-shortcut");
  shortcutBtn.style.display = activeCount > 0 ? "inline-flex" : "none";
  document.getElementById("active-shortcut-label").textContent = activeCount === 1
    ? `1 aktiv (${state.activeSessions[0].plate})`
    : `${activeCount} aktiva`;
  document.getElementById("tab-active-dot").style.display = activeCount > 0 ? "block" : "none";

  renderActiveSessionSwitcher();

  const act = getSelectedActiveSession();
  if (act) {
    const startedMins = getStartedMinutes(act);
    const currentBilled = (startedMins / 60) * act.rate;

    document.getElementById("conf-subtitle").textContent = `Din parkering har startat på ${act.zoneName}. Debiteras per påbörjad minut.`;
    document.getElementById("conf-spot").textContent = act.spot;
    document.getElementById("conf-plate").textContent = act.plate;
    document.getElementById("conf-time").textContent = act.rangeText;
    document.getElementById("conf-pay-method").textContent = `Maxbelopp (${act.paymentMethod})`;
    document.getElementById("conf-paid").textContent = formatPrice(act.totalPaid);
    document.getElementById("conf-availability-note").textContent = `Ruta ${act.spot} är nu upptagen.`;

    document.getElementById("act-zone-name").textContent = act.zoneName;
    document.getElementById("act-zone-sub").textContent = `Zon ${act.zoneCode} · Ruta ${act.spot}`;
    document.getElementById("act-remaining-text").textContent = formatDigitalTimer(act.remainingSeconds);
    document.getElementById("act-end-text").textContent = `Slutar ${act.endLabel}`;
    document.getElementById("act-plate").textContent = act.plate;
    document.getElementById("act-time-range").textContent = act.rangeText;
    document.getElementById("act-duration-label").textContent = `Upplupet · ${startedMins} påbörjade min`;
    document.getElementById("act-paid").textContent = formatPrice(currentBilled);
    document.getElementById("act-reminder-note").textContent = state.reminderEnabled
      ? "🔔 Påminnelse aktiv 15 min före sluttid."
      : "🔕 Påminnelser är avstängda i profilen.";

    const pct = Math.max(0.05, act.remainingSeconds / act.totalSeconds);
    document.getElementById("timer-progress-ring").setAttribute("stroke-dashoffset", String(477 * (1 - pct)));

    const extraCost = (state.extendMinutes / 60) * act.rate;
    const newEndDate = new Date(act.endDate.getTime() + state.extendMinutes * 60000);
    document.getElementById("ext-spot").textContent = act.spot;
    document.getElementById("ext-sub").textContent = `${act.zoneName} · ${act.plate}`;
    document.getElementById("ext-old-end").textContent = act.endLabel;
    document.getElementById("ext-new-end").textContent = formatClock(newEndDate);
    document.getElementById("ext-extra-formula").textContent = `${formatDuration(state.extendMinutes)} · ${act.rate} kr/tim`;
    document.getElementById("ext-new-total").textContent = formatPrice(act.totalPaid + extraCost);
    document.getElementById("ext-pay-method").textContent = act.paymentMethod;
    document.getElementById("ext-pay-now").textContent = formatPrice(extraCost);
    document.getElementById("btn-confirm-extend").textContent = `🔒 Förläng (+${formatPrice(extraCost)} max)`;
  }

  // 7. Avslutad
  if (state.lastEndedSession) {
    const end = state.lastEndedSession;
    const minNote = end.billedMins ? ` (${end.billedMins} påbörjade min)` : "";
    document.getElementById("end-spot").textContent = end.spot;
    document.getElementById("end-subtitle").innerHTML = `Din parkering avslutades ${end.endedAt}${minNote}.<br>Ruta ${end.spot} är ledig igen.`;
    document.getElementById("end-zone-line").textContent = `${end.zoneName} · Zon ${end.zoneCode}`;
    document.getElementById("end-plate").textContent = end.plate;
    document.getElementById("end-duration").textContent = end.durationText;
    document.getElementById("end-range").textContent = end.dateLabel;
    document.getElementById("end-pay-label").textContent = `Fakturerat (${end.paymentMethod})`;
    document.getElementById("end-paid").textContent = formatPrice(end.amount);
  }

  // 8. Sparade
  renderSaved();

  // 9. Avslutade & aktiva parkeringar
  renderHistory();

  // 10. Profil
  document.getElementById("profile-avatar").textContent = getInitials(acc.name);
  document.getElementById("profile-name").textContent = acc.name;
  document.getElementById("profile-email").textContent = acc.email;
  document.getElementById("profile-vehicle-sub").textContent = `${acc.activeVehicle} (${acc.vehicles.length} st) · Byt eller lägg till`;
  document.getElementById("profile-pay-sub").textContent = `${state.paymentMethod} (standard) · Tryck för att byta`;
  document.getElementById("profile-reminder-sub").textContent = state.reminderEnabled ? "Påminn 15 min före sluttid (På)" : "Avstängd (Av)";
  document.getElementById("btn-toggle-reminder").classList.toggle("active", state.reminderEnabled);
}

/* ==================== SNABBVAL AV FORDON I BOKNINGSVYN ==================== */
function renderBookingVehicleChips() {
  const container = document.getElementById("book-vehicle-chips");
  if (!container) return;
  container.innerHTML = "";

  const currentNorm = normalizePlate(state.account.activeVehicle);

  state.account.vehicles.forEach(veh => {
    const parkedSession = findActiveSessionByPlate(veh);
    const isSelected = normalizePlate(veh) === currentNorm;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `veh-chip ${isSelected ? "active" : ""} ${parkedSession ? "parked" : ""}`;
    chip.textContent = parkedSession ? `${veh} (${parkedSession.spot})` : veh;
    chip.addEventListener("click", () => {
      state.account.activeVehicle = veh;
      document.getElementById("plate-field").value = veh;
      renderAll();
    });
    container.appendChild(chip);
  });

  const addChip = document.createElement("button");
  addChip.type = "button";
  addChip.className = "veh-chip";
  addChip.textContent = "+ Nytt fordon";
  addChip.addEventListener("click", openVehicleModal);
  container.appendChild(addChip);
}

/* ==================== VÄXLARE MELLAN FLERA AKTIVA PARKERINGAR ==================== */
function renderActiveSessionSwitcher() {
  const bar = document.getElementById("active-session-switcher");
  if (!bar) return;

  if (state.activeSessions.length <= 1) {
    bar.style.display = "none";
    bar.innerHTML = "";
    return;
  }

  bar.style.display = "flex";
  bar.innerHTML = "";
  const current = getSelectedActiveSession();

  state.activeSessions.forEach(session => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `switcher-pill ${current && current.id === session.id ? "active" : ""}`;
    btn.innerHTML = `<span class="pulse-dot"></span> ${session.spot} · ${session.plate}`;
    btn.addEventListener("click", () => {
      state.selectedActiveId = session.id;
      renderAll();
    });
    bar.appendChild(btn);
  });
}

/* ==================== RIKTIG PARKERINGSKARTA ==================== */
function renderRealParkingLot() {
  const container = document.getElementById("interactive-parking-lot");
  const zoneCode = state.selectedZoneCode;

  const buildBayColumn = (spots, sideClass) => {
    const col = document.createElement("div");
    col.className = "lot-bay-col";
    spots.forEach(spot => {
      const btn = document.createElement("button");
      btn.type = "button";
      const occupied = isSpotOccupied(zoneCode, spot.num);
      const isSelected = !occupied && spot.num === state.selectedSpotNum;
      btn.className = `bay ${sideClass} ${isSelected ? "selected" : occupied ? "taken" : "free"}`;

      if (isSelected) {
        btn.innerHTML = `<span>${spot.num}</span><span>✓ VALD</span>`;
      } else if (occupied) {
        btn.innerHTML = `<span>${spot.num}</span><span class="bay-car-icon"></span>`;
      } else {
        btn.innerHTML = `<span>${spot.num}</span><span class="bay-open-tag">LEDIG</span>`;
      }

      if (!occupied) {
        btn.addEventListener("click", () => {
          state.selectedSpotNum = spot.num;
          renderAll();
        });
      } else {
        btn.addEventListener("click", () => showToast(`Ruta ${spot.num} är upptagen`));
      }
      col.appendChild(btn);
    });
    return col;
  };

  container.innerHTML = `
    <div class="lot-gate-bar">
      <span>↓ INFART</span>
      <span>ASFALTPLAN · ${getZone().name.toUpperCase()}</span>
      <span>UTFART ↑</span>
    </div>
  `;

  const surface = document.createElement("div");
  surface.className = "lot-surface";

  surface.appendChild(buildBayColumn(LOT_COLUMNS[0], "left-side"));

  const lane1 = document.createElement("div");
  lane1.className = "lot-lane";
  lane1.innerHTML = "<span>↓</span><span>↓</span><span>↓</span>";
  surface.appendChild(lane1);

  const islandWrap = document.createElement("div");
  islandWrap.className = "lot-island-wrap";
  islandWrap.innerHTML = `<div class="lot-curb-top"></div>`;
  islandWrap.appendChild(buildBayColumn(LOT_COLUMNS[1], "center-side"));
  const bottomCurb = document.createElement("div");
  bottomCurb.className = "lot-curb-bottom";
  islandWrap.appendChild(bottomCurb);
  surface.appendChild(islandWrap);

  const lane2 = document.createElement("div");
  lane2.className = "lot-lane";
  lane2.innerHTML = "<span>↑</span><span>↑</span><span>↑</span>";
  surface.appendChild(lane2);

  surface.appendChild(buildBayColumn(LOT_COLUMNS[2], "right-side"));

  container.appendChild(surface);
}

/* ==================== SPARADE & AVSLUTADE ==================== */
function renderSaved() {
  const container = document.getElementById("saved-cards-container");
  document.getElementById("saved-count-label").textContent = `${state.favorites.length} favoriter · tillgänglighet just nu`;
  const miniBadge = document.getElementById("saved-mini-free");
  if (miniBadge && ZONES["1042"]) {
    miniBadge.textContent = `${getZoneAvailability(ZONES["1042"]).free} lediga`;
  }
  container.innerHTML = "";

  if (state.favorites.length === 0) {
    container.innerHTML = `<div class="card-flat muted-xs text-center">Inga sparade favoriter ännu.</div>`;
    return;
  }

  state.favorites.forEach(code => {
    const z = ZONES[code];
    if (!z) return;
    const avail = getZoneAvailability(z);
    const card = document.createElement("div");
    card.className = "card-border";
    card.innerHTML = `
      <div class="row-between">
        <div>
          <strong>Zon ${z.letter} · ${z.name}</strong>
          <p class="muted-xs">${z.address} · ${z.code}</p>
        </div>
        <button type="button" class="text-btn" data-unfav="${z.code}">♥</button>
      </div>
      <div class="row-between small-text my-xs">
        <span><i class="dot-amber"></i> ${avail.free} lediga</span>
        <span class="muted">${z.rate} kr/tim · ${z.walk.replace(" till fots", "")}</span>
      </div>
      <div class="row-between card-link" data-open-fav="${z.code}">
        <strong>Visa parkeringsplatser</strong>
        <span>→</span>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-unfav]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      state.favorites = state.favorites.filter(x => x !== btn.dataset.unfav);
      showToast("Borttagen från sparade");
      renderAll();
    });
  });

  container.querySelectorAll("[data-open-fav]").forEach(link => {
    link.addEventListener("click", () => {
      state.selectedZoneCode = link.dataset.openFav;
      navigateTo("spots");
    });
  });
}

function renderHistory() {
  const banner = document.getElementById("active-session-banner");
  const activeList = document.getElementById("active-sessions-list");
  const kicker = document.getElementById("active-banner-kicker");

  if (state.activeSessions.length > 0) {
    banner.style.display = "block";
    kicker.textContent = state.activeSessions.length === 1
      ? "PÅGÅENDE JUST NU"
      : `PÅGÅENDE JUST NU (${state.activeSessions.length} ST)`;
    activeList.innerHTML = "";

    state.activeSessions.forEach(session => {
      const card = document.createElement("div");
      card.className = "card-border";
      card.innerHTML = `
        <div class="row-between">
          <strong class="spot-code-lg">${session.spot}</strong>
          <span class="pill-active">● Aktiv</span>
        </div>
        <strong>${session.zoneName}</strong>
        <p class="muted-xs">${session.plate} · Zon ${session.zoneCode}</p>
        <div class="row-between small-text my-xs">
          <strong>${formatDigitalTimer(session.remainingSeconds)} kvar</strong>
          <span class="muted">Slutar ${session.endLabel}</span>
        </div>
        <button type="button" class="btn-primary btn-sm" data-manage-active="${session.id}">Hantera parkering</button>
      `;
      activeList.appendChild(card);
    });

    activeList.querySelectorAll("[data-manage-active]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.selectedActiveId = btn.dataset.manageActive;
        navigateTo("active");
      });
    });
  } else {
    banner.style.display = "none";
    activeList.innerHTML = "";
  }

  document.getElementById("history-count-label").textContent = `${state.pastSessions.length} kvitton`;
  const list = document.getElementById("history-list-container");
  list.innerHTML = "";

  state.pastSessions.forEach(item => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "history-item";
    row.innerHTML = `
      <div class="receipt-icon">🧾</div>
      <div class="history-info">
        <strong>${item.zoneName} (${item.spot}) · ${item.plate}</strong>
        <span>${item.dateLabel} · ${item.durationText}</span>
      </div>
      <strong>${formatPrice(item.amount)} ›</strong>
    `;
    row.addEventListener("click", () => openReceiptModal(item));
    list.appendChild(row);
  });
}

/* ==================== AVSLUTA & FAKTURERA PÅBÖRJAD MINUT ==================== */
function finishActiveSession(sessionId) {
  const targetId = sessionId || (getSelectedActiveSession() && getSelectedActiveSession().id);
  const idx = state.activeSessions.findIndex(s => s.id === targetId);
  if (idx === -1) return;

  const act = state.activeSessions[idx];
  const now = new Date();
  const nowStr = formatClock(now);
  const billedMins = getStartedMinutes(act);
  const billedAmount = (billedMins / 60) * act.rate;

  const finished = {
    id: `R-${Math.floor(100 + Math.random() * 900)}`,
    zoneName: act.zoneName,
    zoneCode: act.zoneCode,
    spot: act.spot,
    dateLabel: `${formatShortDate(now)} · ${act.startTime}–${nowStr}`,
    durationText: `${formatDuration(billedMins)} (${billedMins} påbörjade min)`,
    billedMins,
    amount: billedAmount,
    plate: act.plate,
    paymentMethod: act.paymentMethod,
    endedAt: nowStr
  };

  state.pastSessions.unshift(finished);
  state.lastEndedSession = finished;
  state.activeSessions.splice(idx, 1);
  state.selectedActiveId = state.activeSessions[0] ? state.activeSessions[0].id : null;

  if (state.activeSessions.length === 0) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  navigateTo("ended");
}

/* ==================== MODALER ==================== */
function openModal(title, htmlContent) {
  document.getElementById("modal-title").textContent = title;
  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = htmlContent;
  modalBody.querySelectorAll("img[data-fallbacks]").forEach(setupFallbackOnImage);
  document.getElementById("app-modal").style.display = "grid";
}

function closeModal() {
  document.getElementById("app-modal").style.display = "none";
}

function openReceiptModal(item) {
  openModal("Parkeringskvitto", `
    <div class="receipt-paper">
      <div class="row-between">
        <div class="brand-logo-wrap brand-logo-sm">
          <img src="logga.jpg"
               data-fallbacks="logga.png,logo.jpg,logo.png,Gemini_Generated_Image_fs422ifs422ifs42_2.jpg,Gemini_Generated_Image_fs422ifs422ifs42.jpg"
               alt="RUTA"
               class="brand-logo-img">
          <svg class="brand-logo-fallback" viewBox="0 0 260 100" aria-hidden="true">
            <rect x="4" y="4" width="252" height="92" rx="16" fill="#FB9504"/>
            <text x="26" y="71" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-weight="900" font-size="60" letter-spacing="1">RUT</text>
            <rect x="172" y="13" width="74" height="74" rx="12" fill="#104184"/>
            <rect x="176" y="17" width="66" height="66" rx="9" fill="none" stroke="#FFFFFF" stroke-width="3.2"/>
            <text x="209" y="70" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-weight="900" font-size="56">A</text>
          </svg>
        </div>
        <span class="muted">${item.id}</span>
      </div>
      <div class="row-between"><span class="muted">Plats</span><strong>${item.zoneName} (${item.zoneCode})</strong></div>
      <div class="row-between"><span class="muted">Ruta</span><strong>${item.spot}</strong></div>
      <div class="row-between"><span class="muted">Fordon</span><strong>${item.plate}</strong></div>
      <div class="row-between"><span class="muted">Tid</span><strong>${item.dateLabel}</strong></div>
      <div class="row-between"><span class="muted">Debiterad tid</span><strong>${item.durationText}</strong></div>
      <div class="row-between border-top-subtle"><strong>Totalt inkl. moms</strong><strong>${formatPrice(item.amount)}</strong></div>
    </div>
  `);
}

function openEditAccountModal() {
  const acc = state.account;
  openModal("Redigera konto", `
    <div class="stack-sm">
      <label class="field-label">Namn
        <input type="text" id="edit-acc-name" class="modal-input" value="${acc.name}">
      </label>
      <label class="field-label">E-post
        <input type="email" id="edit-acc-email" class="modal-input" value="${acc.email}">
      </label>
      <button type="button" class="btn-primary btn-sm mt-xs" id="btn-save-acc">Spara ändringar</button>
    </div>
  `);

  document.getElementById("btn-save-acc").addEventListener("click", () => {
    const name = document.getElementById("edit-acc-name").value.trim();
    const email = document.getElementById("edit-acc-email").value.trim();
    if (name) acc.name = name;
    if (email) acc.email = email;
    closeModal();
    showToast("Kontouppgifter sparade");
    renderAll();
  });
}

function openVehicleModal() {
  const acc = state.account;
  const listHtml = acc.vehicles.map(v => {
    const parked = findActiveSessionByPlate(v);
    const statusText = parked
      ? `Parkerad på ${parked.spot}`
      : (normalizePlate(v) === normalizePlate(acc.activeVehicle) ? "✓ Valt" : "Välj");
    return `
      <button type="button" class="account-option ${normalizePlate(v) === normalizePlate(acc.activeVehicle) ? "active" : ""}" data-pick-veh="${v}">
        <strong>🚗 ${v}</strong>
        <span class="muted-xs">${statusText}</span>
      </button>
    `;
  }).join("");

  openModal("Mina fordon", `
    <div class="stack-sm">
      ${listHtml}
      <div class="row-gap-xs mt-xs">
        <input type="text" id="new-veh-input" class="modal-input" placeholder="Nytt regnr (t.ex. MLB 99A)" maxlength="8" style="margin-top:0;text-transform:uppercase;">
        <button type="button" class="btn-primary btn-sm" id="btn-add-veh" style="width:auto;white-space:nowrap;">+ Lägg till</button>
      </div>
    </div>
  `);

  document.querySelectorAll("[data-pick-veh]").forEach(btn => {
    btn.addEventListener("click", () => {
      acc.activeVehicle = btn.dataset.pickVeh;
      closeModal();
      showToast(`Valt fordon: ${acc.activeVehicle}`);
      renderAll();
    });
  });

  document.getElementById("btn-add-veh").addEventListener("click", () => {
    const reg = document.getElementById("new-veh-input").value.trim().toUpperCase();
    if (!reg) return;
    if (!acc.vehicles.some(v => normalizePlate(v) === normalizePlate(reg))) {
      acc.vehicles.push(reg);
    }
    acc.activeVehicle = reg;
    closeModal();
    showToast(`Fordon ${reg} tillagt`);
    renderAll();
  });
}

/* ==================== HÄNDELSER ==================== */
function initEvents() {
  document.querySelectorAll("[data-go]").forEach(el => {
    el.addEventListener("click", () => navigateTo(el.dataset.go));
  });

  document.querySelectorAll("[data-back]").forEach(el => {
    el.addEventListener("click", goBack);
  });

  document.querySelectorAll("[data-nav-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.historyStack = [];
      navigateTo(btn.dataset.navTab, false);
    });
  });

  document.querySelectorAll("[data-toast]").forEach(el => {
    el.addEventListener("click", () => showToast(el.dataset.toast));
  });

  document.querySelectorAll("[data-select-zone]").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      if (mainMapController && mainMapController.wasDragged()) return;
      state.selectedZoneCode = el.dataset.selectZone;
      navigateTo("zone");
    });
  });

  document.getElementById("map-bottom-card").addEventListener("click", () => navigateTo("zone"));

  document.getElementById("zone-search-input").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const match = Object.values(ZONES).find(z =>
      z.code.includes(q) ||
      z.name.toLowerCase().includes(q) ||
      z.letter.toLowerCase() === q ||
      `zon ${z.letter.toLowerCase()}` === q
    );
    if (match) {
      state.selectedZoneCode = match.code;
      renderAll();
    }
  });

  document.getElementById("btn-zone-choose-spots").addEventListener("click", () => navigateTo("spots"));

  document.getElementById("btn-toggle-favorite").addEventListener("click", () => {
    const code = getZone().code;
    if (state.favorites.includes(code)) {
      state.favorites = state.favorites.filter(c => c !== code);
      showToast("Borttagen från favoriter");
    } else {
      state.favorites.push(code);
      showToast("Sparad som favorit ♥");
    }
    renderAll();
  });

  document.getElementById("btn-confirm-spot").addEventListener("click", () => navigateTo("booking"));

  document.getElementById("plate-field").addEventListener("input", e => {
    state.account.activeVehicle = e.target.value.toUpperCase();
    renderAll();
  });

  const syncFromTimerInputs = () => {
    const d = Math.max(0, Math.min(7, parseInt(document.getElementById("timer-days-input").value, 10) || 0));
    const h = Math.max(0, Math.min(23, parseInt(document.getElementById("timer-hours-input").value, 10) || 0));
    const rawM = Math.max(0, Math.min(59, parseInt(document.getElementById("timer-mins-input").value, 10) || 0));
    const m = Math.round(rawM / 15) * 15;
    setDurationMinutes(d * 1440 + h * 60 + m);
    renderAll();
  };

  document.getElementById("timer-days-up").addEventListener("click", () => { setDurationMinutes(state.durationMinutes + 1440); renderAll(); });
  document.getElementById("timer-days-down").addEventListener("click", () => { setDurationMinutes(state.durationMinutes - 1440); renderAll(); });
  document.getElementById("timer-hours-up").addEventListener("click", () => { setDurationMinutes(state.durationMinutes + 60); renderAll(); });
  document.getElementById("timer-hours-down").addEventListener("click", () => { setDurationMinutes(state.durationMinutes - 60); renderAll(); });
  document.getElementById("timer-mins-up").addEventListener("click", () => { setDurationMinutes(state.durationMinutes + 15); renderAll(); });
  document.getElementById("timer-mins-down").addEventListener("click", () => { setDurationMinutes(state.durationMinutes - 15); renderAll(); });

  document.getElementById("timer-days-input").addEventListener("change", syncFromTimerInputs);
  document.getElementById("timer-hours-input").addEventListener("change", syncFromTimerInputs);
  document.getElementById("timer-mins-input").addEventListener("change", syncFromTimerInputs);

  document.querySelectorAll("#book-payment-seg .seg-item").forEach(btn => {
    btn.addEventListener("click", () => {
      state.paymentMethod = btn.dataset.val;
      renderAll();
    });
  });

  document.getElementById("btn-pay-and-start").addEventListener("click", () => {
    const z = getZone();
    const plate = state.account.activeVehicle.trim().toUpperCase();

    if (!plate) {
      showToast("Ange ett registreringsnummer");
      return;
    }

    const existing = findActiveSessionByPlate(plate);
    if (existing) {
      showToast(`${existing.plate} är redan parkerad på ${existing.spot} (${existing.zoneName})`);
      return;
    }

    if (isSpotOccupied(z.code, state.selectedSpotNum)) {
      showToast(`Ruta ${z.letter}-${state.selectedSpotNum} är redan upptagen`);
      ensureFreeSpotSelected(z.code);
      renderAll();
      return;
    }

    if (!state.account.vehicles.some(v => normalizePlate(v) === normalizePlate(plate))) {
      state.account.vehicles.push(plate);
    }

    const totalMins = state.durationMinutes;
    const now = new Date();
    const endDate = new Date(now.getTime() + totalMins * 60000);
    const totalSec = totalMins * 60;
    const newId = `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newSession = {
      id: newId,
      spot: `${z.letter}-${state.selectedSpotNum}`,
      spotNum: state.selectedSpotNum,
      zoneName: z.name,
      zoneCode: z.code,
      rate: z.rate,
      plate,
      paymentMethod: state.paymentMethod,
      startTime: formatClock(now),
      rangeText: formatRange(now, endDate),
      endLabel: totalMins >= 1440 ? `${formatShortDate(endDate)} ${formatClock(endDate)}` : formatClock(endDate),
      endDate,
      durationMinutes: totalMins,
      totalPaid: (totalMins / 60) * z.rate,
      remainingSeconds: totalSec,
      totalSeconds: totalSec
    };

    state.activeSessions.unshift(newSession);
    state.selectedActiveId = newSession.id;
    ensureFreeSpotSelected(z.code);

    startCountdown();
    navigateTo("confirmation");
  });

  document.getElementById("btn-active-shortcut").addEventListener("click", () => {
    if (state.activeSessions.length === 1) {
      state.selectedActiveId = state.activeSessions[0].id;
      navigateTo("active");
    } else if (state.activeSessions.length > 1) {
      navigateTo("history");
    }
  });

  document.querySelectorAll("#ext-duration-pills .choice-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#ext-duration-pills .choice-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.extendMinutes = Number(pill.dataset.mins);
      renderAll();
    });
  });

  document.getElementById("btn-confirm-extend").addEventListener("click", () => {
    const act = getSelectedActiveSession();
    if (!act) return;
    if (act.durationMinutes + state.extendMinutes > MAX_PARK_MINUTES) {
      showToast("Total parkeringstid får inte överstiga 7 dagar");
      return;
    }
    const extraCost = (state.extendMinutes / 60) * act.rate;
    act.endDate = new Date(act.endDate.getTime() + state.extendMinutes * 60000);
    act.endLabel = formatClock(act.endDate);
    act.durationMinutes += state.extendMinutes;
    act.totalPaid += extraCost;
    act.remainingSeconds += state.extendMinutes * 60;
    act.totalSeconds += state.extendMinutes * 60;
    showToast(`Förlängd med ${formatDuration(state.extendMinutes)}`);
    navigateTo("active");
  });

  document.getElementById("btn-end-parking").addEventListener("click", () => {
    const act = getSelectedActiveSession();
    if (act) finishActiveSession(act.id);
  });

  document.getElementById("btn-show-last-receipt").addEventListener("click", () => {
    if (state.lastEndedSession) openReceiptModal(state.lastEndedSession);
  });

  document.getElementById("btn-edit-account").addEventListener("click", openEditAccountModal);
  document.getElementById("btn-manage-vehicles").addEventListener("click", openVehicleModal);

  document.getElementById("btn-cycle-payment").addEventListener("click", () => {
    const order = ["Apple Pay", "Swish", "Kort"];
    state.paymentMethod = order[(order.indexOf(state.paymentMethod) + 1) % order.length];
    showToast(`Standardbetalning: ${state.paymentMethod}`);
    renderAll();
  });

  document.getElementById("btn-toggle-reminder").addEventListener("click", () => {
    state.reminderEnabled = !state.reminderEnabled;
    showToast(state.reminderEnabled ? "Påminnelse aktiverad" : "Påminnelse avstängd");
    renderAll();
  });

  document.getElementById("btn-toggle-help").addEventListener("click", () => {
    const panel = document.getElementById("help-panel");
    const open = panel.style.display === "none";
    panel.style.display = open ? "block" : "none";
    document.getElementById("help-chevron").textContent = open ? "⌄" : "›";
  });

  document.getElementById("btn-toggle-privacy").addEventListener("click", () => {
    const panel = document.getElementById("privacy-panel");
    const open = panel.style.display === "none";
    panel.style.display = open ? "block" : "none";
    document.getElementById("privacy-chevron").textContent = open ? "⌄" : "›";
  });

  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
}

function startCountdown() {
  if (countdownInterval) return;
  countdownInterval = setInterval(() => {
    if (state.activeSessions.length === 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }

    const expiredIds = [];
    state.activeSessions.forEach(session => {
      if (session.remainingSeconds > 0) {
        session.remainingSeconds--;
      }
      if (session.remainingSeconds <= 0) {
        expiredIds.push(session.id);
      }
    });

    if (expiredIds.length > 0) {
      expiredIds.forEach(id => finishActiveSession(id));
      return;
    }

    if (state.currentView === "active" || state.currentView === "history") {
      renderAll();
    }
  }, 1000);
}

function updateStatusClock() {
  document.getElementById("status-clock").textContent = formatClock(new Date());
}

document.addEventListener("DOMContentLoaded", () => {
  updateStatusClock();
  setInterval(updateStatusClock, 15000);
  initImageFallbacks();
  initInteractiveMap();
  initEvents();
  renderAll();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
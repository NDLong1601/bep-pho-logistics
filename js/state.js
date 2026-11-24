// =========================================================================
// 3. GAME STATE & PERSISTENCE
// =========================================================================
function createInitialState() {
  return {
    coins: 650,
    ingredients: 12,
    dishes: 4,
    parcels: 0,
    rep: 10,
    day: 1,
    dayTimer: 0,
    totalServed: 0,
    totalEarned: 650,
    contractIdx: 0,
    rooms: [
      { gx: 1, gy: 1, type: 'warehouse', level: 1, staff: 1, progress: 0.25 },
      { gx: 2, gy: 1, type: 'kitchen', level: 1, staff: 2, progress: 0.55 },
      { gx: 2, gy: 2, type: 'dining', level: 1, staff: 2, progress: 0.15 },
      { gx: 1, gy: 2, type: 'packing', level: 1, staff: 1, progress: 0.35 }
    ]
  };
}

let state = createInitialState();
let isPaused = false;
let gameSpeed = 1;
let selectedPlot = null;
let hoveredPlot = null;
let confirmDemolishKey = null;

function saveGame(showMsg = false) {
  try {
    localStorage.setItem(GAME_CONFIG.SAVE_KEY, JSON.stringify(state));
    if (showMsg) showToast('Đã lưu tiến trình vào trình duyệt!');
  } catch (e) {
    if (showMsg) showToast('Không thể truy cập bộ nhớ trình duyệt.');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(GAME_CONFIG.SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.rooms) && typeof parsed.coins === 'number') {
      state = Object.assign(createInitialState(), parsed);
    }
  } catch (e) {}
}

function getRoomAt(gx, gy) {
  return state.rooms.find(r => r.gx === gx && r.gy === gy) || null;
}

function getGlobalBonuses() {
  let speedPct = 0;
  let revenuePct = 0;
  for (const r of state.rooms) {
    const cfg = GAME_CONFIG.rooms[r.type];
    if (!cfg || !cfg.passiveBonus) continue;
    const scale = 1 + (r.level - 1) * 0.35;
    if (cfg.passiveBonus.speedPct) speedPct += cfg.passiveBonus.speedPct * scale;
    if (cfg.passiveBonus.revenuePct) revenuePct += cfg.passiveBonus.revenuePct * scale;
  }
  return {
    speedMult: 1 + speedPct,
    revenueMult: 1 + revenuePct,
    speedPct: Math.round(speedPct * 100),
    revenuePct: Math.round(revenuePct * 100)
  };
}

function getUpgradeCost(room) {
  return Math.round(GAME_CONFIG.rooms[room.type].upgradeBase * Math.pow(1.65, room.level - 1));
}

function getStaffCost(room) {
  return Math.round(GAME_CONFIG.rooms[room.type].staffCost * Math.pow(1.55, room.staff - 1));
}

const RESOURCE_LABELS = {
  ingredients: 'Kho',
  dishes: 'Món',
  parcels: 'Đơn',
  coins: 'Xu',
  rep: 'Uy tín'
};

function getMissingInputInfo(room) {
  const cfg = GAME_CONFIG.rooms[room.type];
  if (!cfg || !cfg.requires) return null;
  for (const [key, needed] of Object.entries(cfg.requires)) {
    const current = state[key] || 0;
    if (current < needed) {
      const label = RESOURCE_LABELS[key] ? `Thiếu ${RESOURCE_LABELS[key]}` : `Thiếu ${key}`;
      return { key, label, needed, current };
    }
  }
  return null;
}

function getRoomCycleStats(room, level = room.level, staff = room.staff, bonuses = getGlobalBonuses()) {
  const cfg = GAME_CONFIG.rooms[room.type];
  if (!cfg) return { cycleSec: 1, output: {} };
  const speed = (1 / cfg.cycleTime) * bonuses.speedMult * (1 + (level - 1) * 0.14);
  const cycleSec = 1 / Math.max(0.01, speed);
  const output = cfg.produce(level, staff, 1, bonuses);
  return { cycleSec, output };
}

function formatRoomOutput(output) {
  if (!output) return '';
  const parts = [];
  if (output.ingredients) parts.push(`+${output.ingredients} Kho`);
  if (output.dishes) parts.push(`+${output.dishes} Món`);
  if (output.parcels) parts.push(`+${output.parcels} Đơn`);
  if (output.coins) parts.push(`+${output.coins} Xu`);
  if (output.rep) parts.push(`+${output.rep} Uy tín`);
  return parts.join(' · ');
}

function getNetResourceRates() {
  const bonuses = getGlobalBonuses();
  const rates = { coins: 0, ingredients: 0, dishes: 0, parcels: 0 };
  for (const room of state.rooms) {
    const cfg = GAME_CONFIG.rooms[room.type];
    if (!cfg || getMissingInputInfo(room)) continue;
    const { cycleSec, output } = getRoomCycleStats(room, room.level, room.staff, bonuses);
    if (cfg.requires) {
      for (const [k, amt] of Object.entries(cfg.requires)) {
        if (k in rates) rates[k] -= amt / cycleSec;
      }
    }
    for (const [k, amt] of Object.entries(output)) {
      if (k in rates) rates[k] += amt / cycleSec;
    }
  }
  return rates;
}

function showToast(msg) {
  const box = document.getElementById('toast-box');
  const el = document.createElement('div');
  el.className = 'toast-anim hud-glass rounded-full px-4 py-1.5 text-xs font-semibold text-stone-800';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 2200);
}

function bumpStat(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 180);
}

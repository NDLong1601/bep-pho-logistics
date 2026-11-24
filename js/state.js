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

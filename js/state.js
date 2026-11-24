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
    dailyEarned: 0,
    contractIdx: 0,
    expressOrder: null,
    expressCooldown: 4,
    gridSize: 4,
    activeMenu: 'pho_bo',
    lastSavedAt: Date.now(),
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
let relocateSource = null;
let pendingOfflineCoins = 0;
let pendingOfflineSec = 0;

function saveGame(showMsg = false) {
  try {
    state.lastSavedAt = Date.now();
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
      if (typeof state.dailyEarned !== 'number') state.dailyEarned = 0;
      if (typeof state.expressCooldown !== 'number') state.expressCooldown = 4;
      if (state.expressOrder && typeof state.expressOrder.timeLeft !== 'number') state.expressOrder = null;
      if (typeof state.gridSize !== 'number' || state.gridSize < 4 || state.gridSize > 6) state.gridSize = 4;
      if (!GAME_CONFIG.menus || !GAME_CONFIG.menus[state.activeMenu]) state.activeMenu = 'pho_bo';

      if (typeof parsed.lastSavedAt === 'number') {
        const elapsedSec = Math.floor((Date.now() - parsed.lastSavedAt) / 1000);
        if (elapsedSec >= 30 && state.rooms.length > 0) {
          const cappedSec = Math.min(elapsedSec, 4 * 3600);
          const rates = getNetResourceRates();
          const maxOfflineCap = Math.max(1500, state.rooms.length * 800);
          const earned = Math.min(maxOfflineCap, Math.round(Math.max(0, rates.coins) * 0.05 * cappedSec));
          if (earned > 0) {
            state.coins += earned;
            state.totalEarned += earned;
            state.dailyEarned = (state.dailyEarned || 0) + earned;
            pendingOfflineCoins = earned;
            pendingOfflineSec = cappedSec;
          }
        }
      }
      state.lastSavedAt = Date.now();
    }
  } catch (e) {}
}

function getGridSize() {
  return state.gridSize || GAME_CONFIG.GRID_COLS || 4;
}

function getNextGridTier() {
  const cur = getGridSize();
  const tiers = GAME_CONFIG.gridTiers || [];
  return tiers.find(t => t.size > cur) || null;
}

function getActiveMenuConfig() {
  const menus = GAME_CONFIG.menus || {};
  return menus[state.activeMenu] || Object.values(menus)[0] || {
    id: 'pho_bo', name: 'Phở Bò Gia Truyền', icon: '🍜', unlockRep: 0,
    kitchenSpeed: 1, packingSpeed: 1, diningRev: 1, dispatchRev: 1
  };
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

function getRoomSynergy(room, customGx, customGy, customType) {
  const gx = customGx !== undefined ? customGx : room.gx;
  const gy = customGy !== undefined ? customGy : room.gy;
  const type = customType || room.type;
  const rules = (GAME_CONFIG.synergies && GAME_CONFIG.synergies[type]) || [];

  let speedPct = 0;
  let revenuePct = 0;
  const links = [];
  const matchedTypes = new Set();

  if (rules.length > 0) {
    for (const neighbor of state.rooms) {
      if (neighbor === room || (neighbor.gx === gx && neighbor.gy === gy)) continue;
      if (Math.abs(neighbor.gx - gx) + Math.abs(neighbor.gy - gy) !== 1) continue;
      const rule = rules.find(r => r.withType === neighbor.type);
      if (!rule || matchedTypes.has(neighbor.type)) continue;
      matchedTypes.add(neighbor.type);
      speedPct += rule.speedPct || 0;
      revenuePct += rule.revenuePct || 0;
      links.push({ targetRoom: neighbor, label: rule.label, speedPct: rule.speedPct || 0, revenuePct: rule.revenuePct || 0 });
    }
  }

  return {
    speedMult: 1 + speedPct,
    revenueMult: 1 + revenuePct,
    speedPct: Math.round(speedPct * 100),
    revenuePct: Math.round(revenuePct * 100),
    links
  };
}

function getCurrentDayPhase() {
  const phases = GAME_CONFIG.dayPhases || [];
  const t = state.dayTimer || 0;
  const phase = phases.find(p => t >= p.start && t < p.end) || phases[phases.length - 1] || {
    id: 'morning', start: 0, end: 45, label: '☀️ Buổi sáng', speedPct: 0, revenuePct: 0, isNight: false, isRush: false
  };
  return {
    ...phase,
    rushSpeedMult: 1 + (phase.speedPct || 0),
    rushRevenueMult: 1 + (phase.revenuePct || 0)
  };
}

function getRoomEffectiveMultipliers(room, bonuses = getGlobalBonuses()) {
  const synergy = getRoomSynergy(room);
  const phase = getCurrentDayPhase();
  const menu = getActiveMenuConfig();

  let menuSpeed = 1;
  if (room.type === 'kitchen') menuSpeed = menu.kitchenSpeed || 1;
  else if (room.type === 'packing') menuSpeed = menu.packingSpeed || 1;

  let menuRev = 1;
  if (room.type === 'dining') menuRev = menu.diningRev || 1;
  else if (room.type === 'dispatch' || room.type === 'drone_hub') menuRev = menu.dispatchRev || 1;

  const isServiceRoom = room.type === 'dining' || room.type === 'dispatch' || room.type === 'drone_hub' || room.type === 'cafe';
  const rushRevMult = isServiceRoom ? phase.rushRevenueMult : 1;

  return {
    speedMult: bonuses.speedMult * synergy.speedMult * phase.rushSpeedMult * menuSpeed,
    revenueMult: bonuses.revenueMult * synergy.revenueMult * rushRevMult * menuRev,
    synergy,
    phase,
    menu
  };
}

function getRoomCycleStats(room, level = room.level, staff = room.staff, bonuses = getGlobalBonuses()) {
  const cfg = GAME_CONFIG.rooms[room.type];
  if (!cfg) return { cycleSec: 1, output: {} };
  const effBonuses = getRoomEffectiveMultipliers(room, bonuses);
  const speed = (1 / cfg.cycleTime) * effBonuses.speedMult * (1 + (level - 1) * 0.14);
  const cycleSec = 1 / Math.max(0.01, speed);
  const output = cfg.produce(level, staff, 1, effBonuses);
  return { cycleSec, output, synergy: effBonuses.synergy, phase: effBonuses.phase, menu: effBonuses.menu };
}

function getActiveContract() {
  if (state.contractIdx < GAME_CONFIG.contracts.length) {
    return GAME_CONFIG.contracts[state.contractIdx];
  }
  const extraIdx = state.contractIdx - GAME_CONFIG.contracts.length;
  const tier = Math.floor(extraIdx / 3) + 1;
  const kind = extraIdx % 3;
  if (kind === 0) {
    const target = 45 + tier * 25;
    return {
      id: `dyn_${state.contractIdx}`,
      title: `Chiến dịch Phục vụ Bậc ${tier}`,
      desc: `Phục vụ tổng cộng ${target.toLocaleString('vi-VN')} lượt khách / đơn`,
      metric: 'totalServed',
      target,
      reward: 1350 + tier * 400,
      rep: 16 + tier * 3
    };
  }
  if (kind === 1) {
    const target = 60 + tier * 30;
    return {
      id: `dyn_${state.contractIdx}`,
      title: `Thương hiệu Vàng Bậc ${tier}`,
      desc: `Đạt ${target.toLocaleString('vi-VN')} điểm Uy tín thương hiệu`,
      metric: 'rep',
      target,
      reward: 1500 + tier * 450,
      rep: 18 + tier * 4
    };
  }
  const target = 5000 + tier * 3500;
  return {
    id: `dyn_${state.contractIdx}`,
    title: `Mục tiêu Doanh thu Bậc ${tier}`,
    desc: `Đạt tổng doanh thu ${target.toLocaleString('vi-VN')} Xu`,
    metric: 'totalEarned',
    target,
    reward: 1650 + tier * 500,
    rep: 20 + tier * 4
  };
}

function generateExpressOrder() {
  const templates = GAME_CONFIG.expressTemplates || [];
  if (!templates.length) return null;
  const ownedTypes = new Set(state.rooms.map(r => r.type));
  const eligible = templates.filter((tpl) => {
    if (tpl.resource === 'ingredients') return ownedTypes.has('warehouse');
    if (tpl.resource === 'dishes') return ownedTypes.has('kitchen');
    if (tpl.resource === 'parcels') return ownedTypes.has('packing');
    return true;
  });
  const pool = eligible.length > 0 ? eligible : templates;
  const tpl = pool[Math.floor(Math.random() * pool.length)];
  const dayScale = 1 + Math.min(2, (state.day - 1) * 0.12);
  const amount = Math.max(2, Math.round(tpl.baseAmount * dayScale));
  const reward = Math.round(tpl.baseReward * (amount / tpl.baseAmount));
  return {
    title: tpl.title,
    desc: `Giao gấp ${amount} ${RESOURCE_LABELS[tpl.resource] || tpl.resource}`,
    resource: tpl.resource,
    amount,
    reward,
    rep: tpl.rep,
    timeLeft: tpl.timeLimit,
    maxTime: tpl.timeLimit
  };
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

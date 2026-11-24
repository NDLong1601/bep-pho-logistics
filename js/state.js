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
    playerLevel: 1,
    exp: 0,
    totalExp: 0,
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
    tickets: [],
    ticketSpawnTimer: 2.5,
    nextTicketSeq: 1,
    comboCount: 0,
    dailyTips: 0,
    dailyPenalties: 0,
    dailyOrdersCompleted: 0,
    dailyOrdersFailed: 0,
    perks: {},
    autoNextDay: false,
    rooms: [
      { gx: 1, gy: 2, type: 'warehouse', level: 1, staff: 1, progress: 0.25 },
      { gx: 2, gy: 2, type: 'kitchen', level: 1, staff: 2, progress: 0.55 },
      { gx: 2, gy: 3, type: 'dining', level: 1, staff: 2, progress: 0.15 }
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
let hazardSpawnTimer = 9;

function normalizeLoadedState(parsed) {
  const s = Object.assign(createInitialState(), parsed);
  if (typeof s.dailyEarned !== 'number') s.dailyEarned = 0;
  if (typeof s.expressCooldown !== 'number') s.expressCooldown = 4;
  if (s.expressOrder && typeof s.expressOrder.timeLeft !== 'number') s.expressOrder = null;
  if (typeof s.gridSize !== 'number' || s.gridSize < 4 || s.gridSize > 6) s.gridSize = 4;
  if (!GAME_CONFIG.menus || !GAME_CONFIG.menus[s.activeMenu]) s.activeMenu = 'pho_bo';
  if (!Array.isArray(s.tickets)) s.tickets = [];
  if (typeof s.ticketSpawnTimer !== 'number') s.ticketSpawnTimer = 2.5;
  if (typeof s.nextTicketSeq !== 'number') s.nextTicketSeq = 1;
  if (typeof s.comboCount !== 'number') s.comboCount = 0;
  if (typeof s.dailyTips !== 'number') s.dailyTips = 0;
  if (typeof s.dailyPenalties !== 'number') s.dailyPenalties = 0;
  if (typeof s.dailyOrdersCompleted !== 'number') s.dailyOrdersCompleted = 0;
  if (typeof s.dailyOrdersFailed !== 'number') s.dailyOrdersFailed = 0;
  if (!s.perks || typeof s.perks !== 'object' || Array.isArray(s.perks)) s.perks = {};
  if (typeof s.playerLevel !== 'number' || s.playerLevel < 1) s.playerLevel = 1;
  if (typeof s.exp !== 'number' || s.exp < 0) s.exp = 0;
  if (typeof s.totalExp !== 'number' || s.totalExp < 0) s.totalExp = 0;
  s.autoNextDay = !!s.autoNextDay;
  return s;
}

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
      state = normalizeLoadedState(parsed);

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

function getRoomUpgradeRequirements(room) {
  const cfg = GAME_CONFIG.rooms[room.type];
  const curLv = room.level || 1;
  const nextLv = curLv + 1;
  const coins = Math.round(cfg.upgradeBase * Math.pow(1.36, curLv - 1));
  const reqPlayerLv = Math.max(1, Math.ceil(nextLv / 2));
  const reqRep = nextLv >= 4 ? (nextLv - 3) * 6 : 0;
  const reqIngredients = nextLv >= 3 ? Math.min(45, Math.floor(nextLv * 1.5)) : 0;
  const expGain = 18 + curLv * 14;
  const met = (state.coins >= coins)
    && ((state.playerLevel || 1) >= reqPlayerLv)
    && ((state.rep || 0) >= reqRep)
    && ((state.ingredients || 0) >= reqIngredients);

  return {
    nextLv,
    coins,
    reqPlayerLv,
    reqRep,
    reqIngredients,
    expGain,
    isMilestone: nextLv % 5 === 0,
    met
  };
}

function getUpgradeCost(room) {
  return getRoomUpgradeRequirements(room).coins;
}

function getStaffCost(room) {
  return Math.round(GAME_CONFIG.rooms[room.type].staffCost * Math.pow(1.55, room.staff - 1));
}

function getExpForNextLevel(lv = state.playerLevel || 1) {
  return Math.round(90 * Math.pow(1.35, Math.max(0, lv - 1)));
}

function isRoomUnlocked(typeId) {
  const cfg = GAME_CONFIG.rooms[typeId];
  if (!cfg) return false;
  return (state.playerLevel || 1) >= (cfg.unlockLevel || 1);
}

function getUnlocksAtLevel(lv) {
  const items = [];
  for (const r of Object.values(GAME_CONFIG.rooms)) {
    if (r.unlockLevel === lv) items.push(`${r.icon} ${r.name}`);
  }
  for (const m of Object.values(GAME_CONFIG.menus || {})) {
    if (m.unlockLevel === lv) items.push(`${m.icon} Thực đơn ${m.name}`);
  }
  for (const g of (GAME_CONFIG.gridTiers || [])) {
    if (g.unlockLevel === lv && g.size > 4) items.push(`🗺️ Đất ${g.label}`);
  }
  if (lv === 2) items.push('⚡ Đơn Khẩn Cấp');
  return items;
}

function gainExp(amount) {
  const add = Math.max(1, Math.round(amount || 0));
  state.exp = (state.exp || 0) + add;
  state.totalExp = (state.totalExp || 0) + add;
  if (typeof bumpStat === 'function') bumpStat('pill-exp');

  let leveledUp = false;
  while (state.exp >= getExpForNextLevel(state.playerLevel || 1)) {
    state.exp -= getExpForNextLevel(state.playerLevel || 1);
    state.playerLevel = (state.playerLevel || 1) + 1;
    leveledUp = true;
    const bonusCoins = state.playerLevel * 85;
    state.coins += bonusCoins;
    state.totalEarned += bonusCoins;
    state.dailyEarned = (state.dailyEarned || 0) + bonusCoins;

    const unlocked = getUnlocksAtLevel(state.playerLevel);
    const unlockMsg = unlocked.length > 0 ? ` · Mở khóa: ${unlocked.join(', ')}` : '';
    if (typeof showToast === 'function') {
      showToast(`🎉 Thăng Cấp ${state.playerLevel}! +${bonusCoins} Xu${unlockMsg}`);
    }
  }

  if (leveledUp) {
    if (typeof SoundFX !== 'undefined' && SoundFX.levelUp) SoundFX.levelUp();
    if (typeof selectedPlot !== 'undefined' && selectedPlot && typeof renderDrawer === 'function') {
      renderDrawer();
    }
  }
  if (typeof updateHUD === 'function') updateHUD();
  return leveledUp;
}

function getMergedZoneInfo(room) {
  if (!room) return { size: 1, rooms: [], isMerged: false, outputMult: 1, speedMult: 1, outputPct: 0, speedPct: 0 };
  const visited = new Set();
  const queue = [room];
  const component = [];
  visited.add(`${room.gx}_${room.gy}`);

  while (queue.length > 0) {
    const cur = queue.shift();
    component.push(cur);
    for (const nb of state.rooms) {
      if (nb.type !== room.type) continue;
      const k = `${nb.gx}_${nb.gy}`;
      if (visited.has(k)) continue;
      if (Math.abs(nb.gx - cur.gx) + Math.abs(nb.gy - cur.gy) === 1) {
        visited.add(k);
        queue.push(nb);
      }
    }
  }

  const size = component.length;
  const extra = Math.min(5, Math.max(0, size - 1));
  const outputPct = extra * 16;
  const speedPct = extra * 10;
  return {
    size,
    rooms: component,
    isMerged: size >= 2,
    outputMult: 1 + outputPct / 100,
    speedMult: 1 + speedPct / 100,
    outputPct,
    speedPct
  };
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

function getPerkBonus(perkId) {
  return Number((state.perks && state.perks[perkId]) || 0);
}

function getComboMultiplier() {
  const c = state.comboCount || 0;
  if (c >= 8) return 2.5;
  if (c >= 5) return 2.0;
  if (c >= 3) return 1.5;
  if (c >= 1) return 1.2;
  return 1.0;
}

function getDailyUpkeep() {
  let total = 0;
  for (const room of state.rooms) {
    total += 18 + (room.level - 1) * 8 + room.staff * 10;
  }
  const leanLv = getPerkBonus('lean_operation');
  return Math.max(0, Math.round(total * Math.pow(0.75, leanLv)));
}

function pickRandomPerkChoices(count = 3) {
  const cards = (GAME_CONFIG.perkCards || []).slice();
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.slice(0, count);
}

function applyPerkCard(perkId) {
  const card = (GAME_CONFIG.perkCards || []).find(c => c.id === perkId);
  if (!card) return null;
  if (!state.perks) state.perks = {};
  state.perks[perkId] = (state.perks[perkId] || 0) + 1;
  if (card.instantRep) {
    state.rep += card.instantRep;
  }
  return card;
}

function spawnCustomerTicket() {
  if (!Array.isArray(state.tickets)) state.tickets = [];
  if (state.tickets.length >= 4) return null;
  const templates = GAME_CONFIG.ticketTemplates || [];
  if (!templates.length) return null;

  const owned = new Set(state.rooms.map(r => r.type));
  const eligible = templates.filter((tpl) => {
    if (tpl.vip && state.rep < 12 && !owned.has('marketing')) return false;
    if (tpl.requiresType === 'dining') return owned.has('dining') || owned.has('kitchen');
    if (tpl.requiresType === 'cafe') return owned.has('cafe');
    if (tpl.requiresType === 'dispatch') return owned.has('dispatch') || owned.has('packing');
    if (tpl.requiresType === 'drone_hub') return owned.has('drone_hub');
    return true;
  });

  const pool = eligible.length > 0 ? eligible : [templates[0]];
  const tpl = pool[Math.floor(Math.random() * pool.length)];

  let amount = tpl.amount;
  let reward = tpl.reward;
  let tip = tpl.tip;
  if ((tpl.id === 'bistro_table' || tpl.id === 'office_delivery') && state.day >= 3 && Math.random() < 0.35) {
    amount = 2;
    reward = Math.round(tpl.reward * 1.65);
    tip = Math.round(tpl.tip * 1.5);
  }

  const patienceMult = 1 + 0.25 * getPerkBonus('warm_hospitality');
  const patience = Math.round(tpl.patience * patienceMult);

  const ticket = {
    id: state.nextTicketSeq++,
    tplId: tpl.id,
    title: tpl.title,
    icon: tpl.icon,
    resource: tpl.resource,
    amount,
    delivered: 0,
    reward,
    tip,
    rep: tpl.rep,
    vip: !!tpl.vip,
    timeLeft: patience,
    maxTime: patience
  };
  state.tickets.push(ticket);
  return ticket;
}

function fulfillTicket(ticketId, isManualClick = false, skipResourceCost = false) {
  if (!Array.isArray(state.tickets)) return false;
  const idx = state.tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return false;
  const t = state.tickets[idx];
  const remaining = Math.max(1, t.amount - (t.delivered || 0));

  if (!skipResourceCost) {
    if ((state[t.resource] || 0) < remaining) {
      if (isManualClick && typeof showToast === 'function') {
        showToast(`Chưa đủ ${remaining} ${RESOURCE_LABELS[t.resource] || t.resource} để giao!`);
      }
      return false;
    }
    state[t.resource] -= remaining;
  }

  const viralMult = 1 + 0.15 * getPerkBonus('viral_brand');
  const baseCoins = skipResourceCost ? Math.round(t.reward * 0.35 * viralMult) : Math.round(t.reward * viralMult);
  const comboMult = getComboMultiplier();
  const tipPerkMult = 1 + 0.35 * getPerkBonus('tip_jar');
  const manualMult = isManualClick ? 1.25 : 1.0;
  const tipCoins = Math.round(t.tip * comboMult * tipPerkMult * manualMult);
  const totalGain = baseCoins + tipCoins;

  state.coins += totalGain;
  state.totalEarned += totalGain;
  state.dailyEarned = (state.dailyEarned || 0) + totalGain;
  state.dailyTips = (state.dailyTips || 0) + tipCoins;
  state.rep += t.rep;
  state.totalServed += 1;
  state.dailyOrdersCompleted = (state.dailyOrdersCompleted || 0) + 1;
  state.comboCount = (state.comboCount || 0) + 1;

  state.tickets.splice(idx, 1);

  const ticketExp = t.vip ? 45 : (16 + t.amount * 8);
  gainExp(ticketExp);

  if (typeof bumpStat === 'function') {
    bumpStat('pill-coins');
    bumpStat('pill-rep');
  }
  if (typeof SoundFX !== 'undefined') {
    if (isManualClick || t.vip) SoundFX.reward();
    else SoundFX.upgrade();
  }
  if ((isManualClick || t.vip) && typeof showToast === 'function') {
    showToast(`${t.icon} Phục vụ ${t.title}! +${totalGain} Xu (Tip +${tipCoins} · Combo ${getComboMultiplier()}x)`);
  }
  if (typeof renderTicketRail === 'function') renderTicketRail();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof updateContractUI === 'function') updateContractUI();

  return { baseCoins, tipCoins, totalGain, combo: getComboMultiplier() };
}

function failTicket(ticket) {
  if (!Array.isArray(state.tickets)) return;
  const idx = state.tickets.findIndex(t => t.id === ticket.id);
  if (idx !== -1) state.tickets.splice(idx, 1);

  const penalty = Math.min(state.coins, 25);
  state.coins -= penalty;
  state.dailyPenalties = (state.dailyPenalties || 0) + penalty;
  state.rep = Math.max(0, state.rep - 2);
  state.comboCount = 0;
  state.dailyOrdersFailed = (state.dailyOrdersFailed || 0) + 1;

  if (typeof showToast === 'function') {
    showToast(`😡 ${ticket.title} bỏ về vì chờ lâu! (-2⭐, -${penalty} Xu, gãy Combo)`);
  }
  if (typeof renderTicketRail === 'function') renderTicketRail();
  if (typeof updateHUD === 'function') updateHUD();
}

function triggerRandomRoomHazard() {
  const candidates = state.rooms.filter(r => !r.hazard && !r.starved);
  if (!candidates.length) return null;

  const safeLv = getPerkBonus('safe_kitchen');
  const room = candidates[Math.floor(Math.random() * candidates.length)];
  let hazard = null;

  if (room.type === 'kitchen' || room.type === 'packing') {
    if (safeLv > 0 && Math.random() < 1 - Math.pow(0.55, safeLv)) return null;
    hazard = { type: 'overheat', icon: '🔥', label: 'Quá nhiệt!', blocking: true, timeLeft: 10, maxTime: 10 };
  } else if (room.type === 'dining' || room.type === 'cafe') {
    if (safeLv > 0 && Math.random() < 1 - Math.pow(0.55, safeLv)) return null;
    hazard = { type: 'dirty_table', icon: '🫧', label: 'Dọn bàn +Tip', blocking: false, timeLeft: 12, maxTime: 12 };
  } else if (room.type === 'warehouse' || room.type === 'cold_storage') {
    hazard = { type: 'bonus_crate', icon: '🎁', label: '+3 Kho quà', blocking: false, timeLeft: 9, maxTime: 9 };
  } else if (room.type === 'dispatch' || room.type === 'drone_hub') {
    hazard = { type: 'jam', icon: '⚡', label: 'Đẩy nhanh +45%', blocking: false, timeLeft: 10, maxTime: 10 };
  }

  if (!hazard) return null;
  room.hazard = hazard;
  if (hazard.type === 'overheat' && typeof showToast === 'function') {
    const cfg = GAME_CONFIG.rooms[room.type];
    showToast(`🔥 ${cfg.name} đang quá nhiệt! Nhấn bong bóng lửa trên 3D để dập!`);
  }
  return { room, hazard };
}

function resolveRoomHazard(gx, gy) {
  const room = getRoomAt(gx, gy);
  if (!room || !room.hazard) return false;
  const h = room.hazard;
  room.hazard = null;

  if (h.type === 'overheat') {
    state.coins += 25;
    state.totalEarned += 25;
    state.dailyEarned = (state.dailyEarned || 0) + 25;
    state.dailyTips = (state.dailyTips || 0) + 25;
    if (typeof spawnFloater === 'function') spawnFloater(gx, gy, '🔥 Dập lửa +25 Xu', '#266E56');
    if (typeof showToast === 'function') showToast('🚒 Đã dập quá nhiệt kịp thời! +25 Xu');
  } else if (h.type === 'dirty_table') {
    const tip = Math.round(30 * (1 + 0.35 * getPerkBonus('tip_jar')));
    state.coins += tip;
    state.totalEarned += tip;
    state.dailyEarned = (state.dailyEarned || 0) + tip;
    state.dailyTips = (state.dailyTips || 0) + tip;
    if (typeof spawnFloater === 'function') spawnFloater(gx, gy, `🫧 +${tip} Tip`, '#B85524');
    if (typeof showToast === 'function') showToast(`🫧 Đã dọn bàn sạch sẽ! +${tip} Xu Tip`);
  } else if (h.type === 'bonus_crate') {
    state.ingredients += 3;
    if (typeof spawnFloater === 'function') spawnFloater(gx, gy, '🎁 +3 Kho', '#266E56');
    if (typeof showToast === 'function') showToast('🎁 Nhận kiện nguyên liệu khuyến mãi: +3 Kho!');
  } else if (h.type === 'jam') {
    room.progress += 0.45;
    if (room.progress >= 1) {
      room.progress -= 1;
      if (typeof completeRoomCycle === 'function') completeRoomCycle(room, getGlobalBonuses());
    }
    if (typeof spawnFloater === 'function') spawnFloater(gx, gy, '⚡ +45% Tiến độ', '#266E56');
    if (typeof showToast === 'function') showToast('⚡ Đã điều phối xe xuất bến nhanh!');
  }

  if (typeof SoundFX !== 'undefined') SoundFX.upgrade();
  gainExp(15);
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof updateContractUI === 'function') updateContractUI();
  if (selectedPlot && selectedPlot.gx === gx && selectedPlot.gy === gy && typeof renderDrawer === 'function') {
    renderDrawer();
  }
  return true;
}

function getRoomEffectiveMultipliers(room, bonuses = getGlobalBonuses()) {
  const synergy = getRoomSynergy(room);
  const mergeInfo = getMergedZoneInfo(room);
  const phase = getCurrentDayPhase();
  const menu = getActiveMenuConfig();

  let menuSpeed = 1;
  if (room.type === 'kitchen') menuSpeed = menu.kitchenSpeed || 1;
  else if (room.type === 'packing') menuSpeed = menu.packingSpeed || 1;

  let perkSpeed = 1;
  if (room.type === 'kitchen' || room.type === 'warehouse' || room.type === 'cold_storage') {
    perkSpeed += 0.18 * getPerkBonus('sharp_knives');
  } else if (room.type === 'packing' || room.type === 'dispatch' || room.type === 'drone_hub') {
    perkSpeed += 0.22 * getPerkBonus('fast_packaging');
  }

  let menuRev = 1;
  if (room.type === 'dining') menuRev = menu.diningRev || 1;
  else if (room.type === 'dispatch' || room.type === 'drone_hub') menuRev = menu.dispatchRev || 1;

  const viralMult = 1 + 0.15 * getPerkBonus('viral_brand');
  const isServiceRoom = room.type === 'dining' || room.type === 'dispatch' || room.type === 'drone_hub' || room.type === 'cafe';
  const rushRevMult = isServiceRoom ? phase.rushRevenueMult : 1;

  return {
    speedMult: bonuses.speedMult * synergy.speedMult * mergeInfo.speedMult * phase.rushSpeedMult * menuSpeed * perkSpeed,
    revenueMult: bonuses.revenueMult * synergy.revenueMult * rushRevMult * menuRev * viralMult,
    synergy,
    mergeInfo,
    phase,
    menu
  };
}

function getRoomCycleStats(room, level = room.level, staff = room.staff, bonuses = getGlobalBonuses()) {
  const cfg = GAME_CONFIG.rooms[room.type];
  if (!cfg) return { cycleSec: 1, output: {}, expGain: 0 };
  const effBonuses = getRoomEffectiveMultipliers(room, bonuses);
  const speed = (1 / cfg.cycleTime) * effBonuses.speedMult * (1 + (level - 1) * 0.12);
  const cycleSec = 1 / Math.max(0.01, speed);
  const tierMult = Math.pow(1.20, Math.floor(level / 5));
  const totalOutMult = tierMult * effBonuses.mergeInfo.outputMult;
  const output = cfg.produce(level, staff, totalOutMult, effBonuses);
  const expGain = Math.max(2, Math.round((cfg.expPerCycle || 8) * (1 + (level - 1) * 0.18) * effBonuses.mergeInfo.outputMult));
  return { cycleSec, output, expGain, synergy: effBonuses.synergy, mergeInfo: effBonuses.mergeInfo, phase: effBonuses.phase, menu: effBonuses.menu };
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
  if (!box) return;
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

// =========================================================================
// 3. GAME STATE & PERSISTENCE
// =========================================================================
function createInitialState() {
  return {
    saveVersion: GAME_CONFIG.SAVE_VERSION,
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
    totalEarned: 0,
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

let automaticSaveBlocked = false;

function isSaveRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSaveInteger(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function hasValidOrderTimer(order) {
  return Number.isFinite(order.timeLeft) && order.timeLeft > 0
    && Number.isFinite(order.maxTime) && order.timeLeft <= order.maxTime;
}

function createRoomHazard(type, timeLeft = GAME_CONFIG.roomHazards[type].duration) {
  const cfg = GAME_CONFIG.roomHazards[type];
  return { type, icon: cfg.icon, label: cfg.label, blocking: cfg.blocking, timeLeft, maxTime: cfg.duration };
}

function normalizeLoadedState(parsed) {
  if (!isSaveRecord(parsed)) throw new Error('Dữ liệu lưu phải là một đối tượng.');
  const version = parsed.saveVersion ?? 1;
  if (!isSaveInteger(version, 1, GAME_CONFIG.SAVE_VERSION)) {
    throw new Error('Phiên bản bản lưu không được hỗ trợ.');
  }

  const next = createInitialState();
  const counters = [
    'coins', 'ingredients', 'dishes', 'parcels', 'rep', 'exp', 'totalExp', 'totalServed',
    'totalEarned', 'dailyEarned', 'contractIdx', 'comboCount', 'dailyTips',
    'dailyPenalties', 'dailyOrdersCompleted', 'dailyOrdersFailed', 'lastSavedAt'
  ];
  for (const key of counters) {
    if (!Object.hasOwn(parsed, key) && key !== 'coins') continue;
    if (!isSaveInteger(parsed[key])) throw new Error(`Giá trị "${key}" không hợp lệ.`);
    next[key] = parsed[key];
  }
  for (const key of ['day', 'playerLevel', 'nextTicketSeq']) {
    if (!Object.hasOwn(parsed, key)) continue;
    if (!isSaveInteger(parsed[key], 1)) throw new Error(`Giá trị "${key}" không hợp lệ.`);
    next[key] = parsed[key];
  }
  for (const key of ['dayTimer', 'ticketSpawnTimer', 'expressCooldown']) {
    if (!Object.hasOwn(parsed, key)) continue;
    if (!Number.isFinite(parsed[key])) throw new Error(`Giá trị "${key}" không hợp lệ.`);
    // The express cooldown can be slightly negative while an order is active.
    next[key] = Math.max(0, parsed[key]);
  }
  const dayLength = GAME_CONFIG.dayPhases.at(-1).end;
  if (next.dayTimer >= dayLength) throw new Error('Thời gian trong ngày không hợp lệ.');

  const gridSize = parsed.gridSize ?? next.gridSize;
  if (!GAME_CONFIG.gridTiers.some(t => t.size === gridSize)) throw new Error('Kích thước bản đồ không hợp lệ.');
  next.gridSize = gridSize;
  const menu = parsed.activeMenu ?? next.activeMenu;
  if (typeof menu !== 'string' || !Object.hasOwn(GAME_CONFIG.menus, menu)) throw new Error('Thực đơn không hợp lệ.');
  next.activeMenu = menu;
  if ('autoNextDay' in parsed && typeof parsed.autoNextDay !== 'boolean') {
    throw new Error('Cài đặt qua ngày không hợp lệ.');
  }
  next.autoNextDay = parsed.autoNextDay ?? next.autoNextDay;

  if (!Array.isArray(parsed.rooms) || !parsed.rooms.length) throw new Error('Bản lưu thiếu phân khu.');
  const occupied = new Set();
  next.rooms = parsed.rooms.map(room => {
    if (!isSaveRecord(room)) throw new Error('Phân khu không hợp lệ.');
    const { gx, gy, type, level, staff, progress = 0 } = room;
    if (!isSaveInteger(gx, 0, gridSize - 1) || !isSaveInteger(gy, 0, gridSize - 1)
        || typeof type !== 'string' || !Object.hasOwn(GAME_CONFIG.rooms, type) || !isSaveInteger(level, 1)
        || !isSaveInteger(staff, 1, GAME_CONFIG.MAX_STAFF_PER_ROOM)
        || !Number.isFinite(progress) || progress < 0) {
      throw new Error('Tọa độ, loại hoặc cấp phân khu không hợp lệ.');
    }
    const lastUpgradeCost = GAME_CONFIG.rooms[type].upgradeBase * Math.pow(1.36, level - 2);
    if (lastUpgradeCost > Number.MAX_SAFE_INTEGER) throw new Error('Cấp phân khu không hợp lệ.');
    const key = `${gx}_${gy}`;
    if (occupied.has(key)) throw new Error('Hai phân khu trùng tọa độ.');
    occupied.add(key);
    const result = { gx, gy, type, level, staff, progress: Math.min(progress, 1) };
    if (room.hazard != null) {
      const hazard = room.hazard;
      if (!isSaveRecord(hazard) || typeof hazard.type !== 'string' || !Object.hasOwn(GAME_CONFIG.roomHazards, hazard.type)
          || !GAME_CONFIG.roomHazards[hazard.type].rooms.includes(type) || !hasValidOrderTimer(hazard)
          || hazard.timeLeft > GAME_CONFIG.roomHazards[hazard.type].duration) {
        throw new Error('Sự cố phân khu không hợp lệ.');
      }
      result.hazard = createRoomHazard(hazard.type, hazard.timeLeft);
    }
    return result;
  });

  if ('perks' in parsed) {
    if (!isSaveRecord(parsed.perks)) throw new Error('Đặc quyền không hợp lệ.');
    for (const [id, level] of Object.entries(parsed.perks)) {
      if (!GAME_CONFIG.perkCards.some(card => card.id === id) || !isSaveInteger(level)) {
        throw new Error('Đặc quyền không hợp lệ.');
      }
      next.perks[id] = level;
    }
  }

  const tickets = Object.hasOwn(parsed, 'tickets') ? parsed.tickets : [];
  if (!Array.isArray(tickets) || tickets.length > 4) throw new Error('Danh sách phiếu không hợp lệ.');
  const ticketIds = new Set();
  next.tickets = tickets.map(ticket => {
    if (!isSaveRecord(ticket)) throw new Error('Phiếu khách không hợp lệ.');
    const template = GAME_CONFIG.ticketTemplates.find(t => t.id === ticket.tplId);
    const { id, amount, delivered = 0, timeLeft, maxTime } = ticket;
    if (!template || ticket.resource !== template.resource || !isSaveInteger(id, 1, Number.MAX_SAFE_INTEGER - 1)
        || ticketIds.has(id) || !isSaveInteger(delivered, 0, amount - 1) || !hasValidOrderTimer(ticket)) {
      throw new Error('Phiếu khách không hợp lệ.');
    }
    const terms = getTicketTerms(template, amount);
    if (!terms) throw new Error('Số lượng trên phiếu khách không hợp lệ.');
    ticketIds.add(id);
    return { ...terms, id, delivered, timeLeft, maxTime };
  });
  next.nextTicketSeq = Math.max(next.nextTicketSeq, ...next.tickets.map(ticket => ticket.id + 1));

  if (parsed.expressOrder != null) {
    const order = parsed.expressOrder;
    if (!isSaveRecord(order)) throw new Error('Đơn khẩn cấp không hợp lệ.');
    const template = GAME_CONFIG.expressTemplates.find(t => t.title === order.title && t.resource === order.resource);
    if (!template || !isSaveInteger(order.amount, template.baseAmount, template.baseAmount * 3)
        || !hasValidOrderTimer(order) || order.timeLeft > template.timeLimit) {
      throw new Error('Đơn khẩn cấp không hợp lệ.');
    }
    next.expressOrder = { ...getExpressOrderTerms(template, order.amount), timeLeft: order.timeLeft };
  }
  return next;
}

function saveGame(showMsg = false, replaceInvalidSave = false) {
  if (automaticSaveBlocked && !showMsg && !replaceInvalidSave) return false;
  try {
    const lastSavedAt = Date.now();
    localStorage.setItem(GAME_CONFIG.SAVE_KEY, JSON.stringify({ ...state, lastSavedAt }));
    state.lastSavedAt = lastSavedAt;
    automaticSaveBlocked = false;
    if (showMsg) showToast('Đã lưu tiến trình vào trình duyệt!');
    return true;
  } catch (e) {
    if (showMsg) showToast('Không thể truy cập bộ nhớ trình duyệt.');
    return false;
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(GAME_CONFIG.SAVE_KEY);
    if (!raw) return true;
    state = normalizeLoadedState(JSON.parse(raw));

    const elapsedSec = Math.floor((Date.now() - state.lastSavedAt) / 1000);
    if (elapsedSec >= 30) {
      const cappedSec = Math.min(elapsedSec, 4 * 3600);
      const { coins: passiveRate } = getNetResourceRates();
      const maxOfflineCap = Math.max(1500, state.rooms.length * 800);
      const earned = Math.min(maxOfflineCap, Math.round(Math.max(0, passiveRate) * 0.05 * cappedSec));
      if (earned > 0) {
        state.coins += earned;
        state.totalEarned += earned;
        state.dailyEarned += earned;
        pendingOfflineCoins = earned;
        pendingOfflineSec = cappedSec;
      }
    }
    saveGame();
    return true;
  } catch (e) {
    automaticSaveBlocked = true;
    return false;
  }
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
  if (!cfg) return null;
  if (cfg.service && !getRoomServiceTicket(room)) return { label: 'Đang chờ phiếu', waitingForOrder: true };
  const inputs = cfg.service ? { [cfg.service.resource]: 1 } : cfg.requires;
  if (!inputs) return null;
  for (const [key, needed] of Object.entries(inputs)) {
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

function getTicketTerms(template, amount) {
  const largerOrder = template.id === 'bistro_table' || template.id === 'office_delivery';
  if (amount !== template.amount && !(largerOrder && amount === 2)) return null;
  const isLarger = amount > template.amount;
  return {
    tplId: template.id,
    title: template.title,
    icon: template.icon,
    resource: template.resource,
    amount,
    reward: isLarger ? Math.round(template.reward * 1.65) : template.reward,
    tip: isLarger ? Math.round(template.tip * 1.5) : template.tip,
    rep: template.rep,
    vip: template.vip
  };
}

function getTicketRoomType(ticket) {
  return GAME_CONFIG.ticketTemplates.find(template => template.id === ticket.tplId)?.requiresType;
}

function getRoomServiceTicket(room) {
  return state.tickets.find(ticket => ticket.timeLeft > 0 && getTicketRoomType(ticket) === room.type);
}

function getTicketServiceRoom(ticket) {
  const type = getTicketRoomType(ticket);
  return state.rooms.find(room => room.type === type && !room.hazard?.blocking);
}

function spawnCustomerTicket() {
  if (state.tickets.length >= 4) return null;
  const owned = new Set(state.rooms.map(room => room.type));
  const eligible = GAME_CONFIG.ticketTemplates.filter(template => (
    owned.has(template.requiresType) && (!template.vip || state.rep >= 12 || owned.has('marketing'))
  ));
  if (!eligible.length) return null;

  const template = eligible[Math.floor(Math.random() * eligible.length)];
  const canOrderMore = template.id === 'bistro_table' || template.id === 'office_delivery';
  const amount = canOrderMore && state.day >= 3 && Math.random() < 0.35 ? 2 : template.amount;
  const patience = Math.round(template.patience * (1 + 0.25 * getPerkBonus('warm_hospitality')));
  const ticket = {
    ...getTicketTerms(template, amount),
    id: state.nextTicketSeq++,
    delivered: 0,
    timeLeft: patience,
    maxTime: patience
  };
  state.tickets.push(ticket);
  return ticket;
}

function fulfillTicket(ticketId) {
  const ticket = state.tickets.find(entry => entry.id === ticketId);
  if (!ticket || ticket.timeLeft <= 0) return false;
  const room = getTicketServiceRoom(ticket);
  if (!room) {
    showToast('Cần phân khu phù hợp để phục vụ phiếu này.');
    return false;
  }
  const remaining = ticket.amount - ticket.delivered;
  if (state[ticket.resource] < remaining) {
    showToast(`Chưa đủ ${remaining} ${RESOURCE_LABELS[ticket.resource]} để giao!`);
    return false;
  }
  const delivery = deliverTicket(ticket, room, remaining, true);
  if (delivery) saveGame();
  return delivery;
}

function deliverTicket(ticket, room, capacity, isManualClick = false) {
  const idx = state.tickets.indexOf(ticket);
  if (idx === -1 || ticket.timeLeft <= 0 || room.hazard?.blocking || getTicketRoomType(ticket) !== room.type) return false;

  const remaining = ticket.amount - ticket.delivered;
  const units = Math.min(capacity, remaining, state[ticket.resource]);
  if (units <= 0) return false;
  state[ticket.resource] -= units;
  ticket.delivered += units;
  bumpStat(`pill-${ticket.resource}`);
  if (ticket.delivered < ticket.amount) {
    if (typeof renderTicketRail === 'function') renderTicketRail();
    if (typeof updateHUD === 'function') updateHUD();
    if (typeof updateContractUI === 'function') updateContractUI();
    return { units, totalGain: 0 };
  }

  state.tickets.splice(idx, 1);
  const t = ticket;
  const { output } = getRoomCycleStats(room);
  const baseCoins = Math.round(t.reward * output.orderMultiplier);
  const comboMult = getComboMultiplier();
  const tipPerkMult = 1 + 0.35 * getPerkBonus('tip_jar');
  const manualMult = isManualClick ? 1.25 : 1.0;
  const tipCoins = Math.round(t.tip * comboMult * tipPerkMult * manualMult);
  const totalGain = baseCoins + tipCoins;

  recordCompletedOrder(t.rep, baseCoins, tipCoins);
  state.comboCount += 1;

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

  return { units, totalGain };
}

function recordCompletedOrder(rep, reward, tip = 0) {
  const income = reward + tip;
  state.coins += income;
  state.totalEarned += income;
  state.dailyEarned += income;
  state.dailyTips += tip;
  state.rep += rep;
  state.totalServed += 1;
  state.dailyOrdersCompleted += 1;
}

function fulfillExpressOrder() {
  const order = state.expressOrder;
  if (!order || order.timeLeft <= 0 || state[order.resource] < order.amount) return false;
  state[order.resource] -= order.amount;
  state.expressOrder = null;
  state.expressCooldown = 14;
  recordCompletedOrder(order.rep, order.reward);
  return order;
}

function failTicket(ticket) {
  if (!Array.isArray(state.tickets)) return;
  const idx = state.tickets.findIndex(t => t.id === ticket.id);
  if (idx === -1) return;
  state.tickets.splice(idx, 1);

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

  const type = Object.keys(GAME_CONFIG.roomHazards).find(id => GAME_CONFIG.roomHazards[id].rooms.includes(room.type));
  if (!type) return null;
  const safeLv = getPerkBonus('safe_kitchen');
  if ((type === 'overheat' || type === 'dirty_table') && safeLv > 0 && Math.random() < 1 - Math.pow(0.55, safeLv)) {
    return null;
  }
  const hazard = createRoomHazard(type);
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
  const output = cfg.service
    ? {
        serviceUnits: cfg.service.units,
        orderMultiplier: (1 + (level - 1) * 0.18) * (1 + (staff - 1) * cfg.service.staffBonus)
          * totalOutMult * effBonuses.revenueMult
      }
    : cfg.produce(level, staff, totalOutMult, effBonuses);
  const expGain = cfg.service ? 0 : Math.max(2, Math.round((cfg.expPerCycle || 8) * (1 + (level - 1) * 0.18) * effBonuses.mergeInfo.outputMult));
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
    title: `Mục tiêu Tổng thu Bậc ${tier}`,
    desc: `Đạt tổng thu ${target.toLocaleString('vi-VN')} Xu`,
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
  return { ...getExpressOrderTerms(tpl, amount), timeLeft: tpl.timeLimit };
}

function getExpressOrderTerms(tpl, amount) {
  return {
    title: tpl.title,
    desc: `Giao gấp ${amount} ${RESOURCE_LABELS[tpl.resource] || tpl.resource}`,
    resource: tpl.resource,
    amount,
    reward: Math.round(tpl.baseReward * (amount / tpl.baseAmount)),
    rep: tpl.rep,
    maxTime: tpl.timeLimit
  };
}

function formatRoomOutput(output) {
  if (!output) return '';
  if (output.serviceUnits) {
    const mult = output.orderMultiplier.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `Tối đa ${output.serviceUnits} phần / lượt · Giá đơn ×${mult}`;
  }
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
    if (!cfg || cfg.service || room.hazard?.blocking || getMissingInputInfo(room)) continue;
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

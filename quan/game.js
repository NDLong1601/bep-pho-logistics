export const DISHES = {
  pho: { name: 'Phở bò', short: 'Phở bò', price: 46, stock: 3, time: 8, color: '#b64d34' },
  banhMi: { name: 'Bánh mì thịt', short: 'Bánh mì', price: 31, stock: 2, time: 4.5, color: '#bd7a25' },
  comTam: { name: 'Cơm tấm sườn', short: 'Cơm tấm', price: 54, stock: 4, time: 10, color: '#49734f' }
};

export const CREW = {
  cook: { name: 'Cô Ba', role: 'Đầu bếp', color: '#bb4e38', training: 90 },
  waiter: { name: 'Minh', role: 'Phục vụ', color: '#4c7553', training: 80 },
  cashier: { name: 'An', role: 'Thu ngân', color: '#a56839', training: 70 }
};

export const STAGES = {
  free: 'Trống', choosing: 'Xem thực đơn', order: 'Chờ ghi món', queued: 'Chờ bếp',
  cooking: 'Đang nấu', ready: 'Chờ mang món', eating: 'Đang ăn',
  check: 'Chờ tính tiền', dirty: 'Chờ dọn bàn'
};

export const TASKS = {
  take: { role: 'waiter', stage: 'order', time: 2.6, label: 'Ghi món' },
  cook: { role: 'cook', stage: 'queued', label: 'Nấu món' },
  serve: { role: 'waiter', stage: 'ready', time: 3.6, label: 'Mang món' },
  collect: { role: 'cashier', stage: 'check', time: 2.8, label: 'Tính tiền' },
  clean: { role: 'waiter', stage: 'dirty', time: 3.2, label: 'Dọn bàn' }
};

export const SHIFT_SECONDS = 100;
export const STOCK_PACK = 15;
export const STOCK_COST = 36;
export const SAVE_KEY = 'bep_pho_quan_2d_v1';
export const STEP = 0.1;

const dishKeys = Object.keys(DISHES);
const roleKeys = Object.keys(CREW);
const requestStages = new Set(['choosing', 'order', 'queued', 'cooking', 'ready']);
const taskForStage = Object.fromEntries(Object.entries(TASKS).map(([key, value]) => [value.stage, key]));
const priorities = { cook: ['cook'], waiter: ['serve', 'take', 'clean'], cashier: ['collect'] };
const createTable = id => ({ id, stage: 'free', since: 0, guest: null });
const createStats = () => ({ served: 0, lost: 0, sales: 0, spent: 0, stockUsed: 0 });

export function createGame(seed = Date.now()) {
  return {
    version: 1,
    rng: (seed >>> 0) || 1,
    shift: 1,
    time: 0,
    mode: 'closed',
    cash: 180,
    stock: 23,
    totalServed: 0,
    nextGuest: 1,
    nextArrival: 0,
    autoSeat: false,
    queue: [],
    tables: Array.from({ length: 4 }, (_, i) => createTable(i + 1)),
    workers: Object.fromEntries(roleKeys.map(role => [role, { level: 1, auto: true, job: null }])),
    stats: createStats(),
    events: [],
    eventId: 0
  };
}

function random(game) {
  // Persist the generator state so resuming a shift reproduces future arrivals.
  let value = game.rng;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  game.rng = value >>> 0;
  return game.rng / 4294967296;
}

function note(game, text, tone = 'plain') {
  game.events.unshift({ id: ++game.eventId, text, tone });
  game.events.length = Math.min(game.events.length, 4);
}

function setStage(game, table, stage) {
  table.stage = stage;
  table.since = game.time;
}

function arrive(game) {
  if (game.queue.length >= 6) {
    game.stats.lost += 1;
    note(game, 'Một khách đi qua vì hàng chờ đã đầy.', 'warn');
    return;
  }
  const guest = {
    id: game.nextGuest++,
    dish: dishKeys[Math.floor(random(game) * dishKeys.length)],
    coat: Math.floor(random(game) * 6),
    arrived: game.time,
    seatedAt: null
  };
  game.queue.push(guest);
}

export function openShift(game) {
  if (game.mode !== 'closed' && game.mode !== 'complete') return false;
  if (game.mode === 'complete') game.shift += 1;
  game.time = 0;
  game.mode = 'running';
  game.nextArrival = 7;
  game.stats = createStats();
  game.events = [];
  for (const table of game.tables) Object.assign(table, createTable(table.id));
  arrive(game);
  arrive(game);
  note(game, 'Quán mở cửa. Chạm bàn trống để xếp khách.', 'good');
  return true;
}

export function stopArrivals(game) {
  if (game.mode !== 'running') return false;
  game.mode = 'closing';
  note(game, 'Đã ngừng đón khách mới. Phục vụ nốt ca này.');
  return true;
}

export function seatGuest(game, tableId) {
  const table = game.tables.find(entry => entry.id === tableId);
  if (!table || table.stage !== 'free' || !game.queue.length) return false;
  table.guest = game.queue.shift();
  table.guest.seatedAt = game.time;
  setStage(game, table, 'choosing');
  return true;
}

export function buyStock(game) {
  if (game.cash < STOCK_COST) return false;
  game.cash -= STOCK_COST;
  game.stock += STOCK_PACK;
  if (game.mode === 'running' || game.mode === 'closing') game.stats.spent += STOCK_COST;
  note(game, `Nhập thêm ${STOCK_PACK} phần nguyên liệu.`, 'good');
  return true;
}

export function trainingCost(role, level) {
  return CREW[role].training + (level - 1) * 45;
}

export function trainWorker(game, role) {
  if (!Object.hasOwn(CREW, role)) return false;
  const worker = game.workers[role];
  const cost = trainingCost(role, worker.level);
  if (worker.level >= 3 || game.cash < cost) return false;
  game.cash -= cost;
  if (game.mode === 'running' || game.mode === 'closing') game.stats.spent += cost;
  worker.level += 1;
  note(game, `${CREW[role].name} đã lên cấp ${worker.level}.`, 'good');
  return true;
}

function startTask(game, kind, table) {
  const task = TASKS[kind];
  const worker = game.workers[task.role];
  if (worker.job || task.stage !== table.stage) return false;
  const dish = table.guest ? DISHES[table.guest.dish] : null;
  if (kind === 'cook') {
    if (game.stock < dish.stock) return false;
    game.stock -= dish.stock;
    game.stats.stockUsed += dish.stock;
    setStage(game, table, 'cooking');
  }
  const duration = (task.time ?? dish.time) / (1 + (worker.level - 1) * 0.3);
  worker.job = { kind, tableId: table.id, remaining: duration, duration };
  return true;
}

export function helpTable(game, tableId) {
  const table = game.tables.find(entry => entry.id === tableId);
  if (!table) return null;
  if (table.stage === 'free') return seatGuest(game, tableId) ? 'Đã xếp khách.' : null;
  const taskKey = table.stage === 'cooking' ? 'cook' : taskForStage[table.stage];
  if (!taskKey) return null;
  const task = TASKS[taskKey];
  const worker = game.workers[task.role];
  if (worker.job?.tableId === table.id) return `${CREW[task.role].name} đang ${task.label.toLowerCase()}.`;
  if (worker.job) return `${CREW[task.role].name} đang làm bàn ${worker.job.tableId}.`;
  if (startTask(game, taskKey, table)) return `Đã giao việc cho ${CREW[task.role].name}.`;
  return taskKey === 'cook' ? 'Thiếu nguyên liệu để nấu món.' : null;
}

function finishTask(game, job) {
  const table = game.tables[job.tableId - 1];
  switch (job.kind) {
    case 'take':
      setStage(game, table, 'queued');
      break;
    case 'cook':
      setStage(game, table, 'ready');
      break;
    case 'serve':
      setStage(game, table, 'eating');
      break;
    case 'collect': {
      if (table.stage !== 'check') break;
      const { price } = DISHES[table.guest.dish];
      game.cash += price;
      game.stats.sales += price;
      game.stats.served += 1;
      game.totalServed += 1;
      table.guest = null;
      setStage(game, table, 'dirty');
      note(game, `Bàn ${table.id} đã thanh toán +${price} xu.`, 'good');
      break;
    }
    case 'clean':
      setStage(game, table, 'free');
      break;
  }
}

function dispatchTask(game, role) {
  for (const kind of priorities[role]) {
    const tables = game.tables.filter(table => table.stage === TASKS[kind].stage);
    tables.sort((a, b) => a.since - b.since || a.id - b.id);
    // A chef works through the oldest order first, so a stock shortage is visible.
    if (tables.length) return startTask(game, kind, tables[0]);
  }
  return false;
}

export function tick(game, dt = STEP) {
  if (game.mode !== 'running' && game.mode !== 'closing') return;
  game.time += dt;
  if (game.mode === 'running') {
    if (game.time >= SHIFT_SECONDS) stopArrivals(game);
    else if (game.time >= game.nextArrival) {
      arrive(game);
      const rush = game.time >= 30 && game.time < 67;
      game.nextArrival = game.time + (rush ? 4.2 : 6.6) + random(game) * 2.4;
    }
  }

  const queuedBefore = game.queue.length;
  game.queue = game.queue.filter(guest => game.time - guest.arrived < 30);
  if (game.queue.length < queuedBefore) {
    const lost = queuedBefore - game.queue.length;
    game.stats.lost += lost;
    note(game, `${lost} khách rời hàng vì chờ bàn quá lâu.`, 'warn');
  }

  for (const table of game.tables) {
    const timedOutForFood = requestStages.has(table.stage) && game.time - table.guest.seatedAt >= 44;
    const timedOutForCheckout = table.stage === 'check' && game.time - table.since >= 30;
    if (timedOutForFood || timedOutForCheckout) {
      for (const worker of Object.values(game.workers)) {
        if (worker.job?.tableId === table.id) worker.job = null;
      }
      table.guest = null;
      setStage(game, table, 'dirty');
      game.stats.lost += 1;
      const reason = timedOutForCheckout ? 'chờ tính tiền' : 'chờ món';
      note(game, `Khách bàn ${table.id} rời quán vì ${reason} lâu.`, 'warn');
    } else if (table.stage === 'choosing' && game.time - table.since >= 1.7) {
      setStage(game, table, 'order');
    } else if (table.stage === 'eating' && game.time - table.since >= 6.4) {
      setStage(game, table, 'check');
    }
  }

  for (const role of roleKeys) {
    const worker = game.workers[role];
    if (worker.job) {
      worker.job.remaining -= dt;
      if (worker.job.remaining <= 0) {
        const job = worker.job;
        worker.job = null;
        finishTask(game, job);
      }
    }
    if (worker.auto && !worker.job) dispatchTask(game, role);
  }

  if (game.autoSeat) {
    for (const table of game.tables) seatGuest(game, table.id);
  }
  if (game.mode === 'closing' && !game.queue.length && game.tables.every(table => table.stage === 'free')) {
    game.mode = 'complete';
    note(game, `Ca ${game.shift} kết thúc. Đã phục vụ ${game.stats.served} đơn.`, 'good');
  }
}

export function demand(game) {
  const waitingKitchen = game.tables.filter(t => t.stage === 'queued').sort((a, b) => a.since - b.since);
  const firstDish = waitingKitchen[0]?.guest?.dish;
  return {
    door: game.queue.length,
    kitchen: waitingKitchen.length,
    ready: game.tables.filter(t => t.stage === 'ready').length,
    dirty: game.tables.filter(t => t.stage === 'dirty').length,
    shortStock: Boolean(firstDish && game.stock < DISHES[firstDish].stock),
    payments: game.tables.filter(t => t.stage === 'check').length
  };
}

function int(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function validGuest(guest, time, seated) {
  return guest && int(guest.id, 1) && typeof guest.dish === 'string' && Object.hasOwn(DISHES, guest.dish) && int(guest.coat, 0, 5)
    && Number.isFinite(guest.arrived) && guest.arrived >= 0 && guest.arrived <= time
    && (seated ? Number.isFinite(guest.seatedAt) && guest.seatedAt >= guest.arrived && guest.seatedAt <= time
      : guest.seatedAt === null);
}

export function readSave(raw) {
  try {
    const game = JSON.parse(raw);
    if (!game || game.version !== 1 || !['closed', 'running', 'closing', 'complete'].includes(game.mode)
        || !['cash', 'stock', 'totalServed', 'eventId'].every(key => int(game[key]))
        || !int(game.shift, 1) || !int(game.nextGuest, 1) || !int(game.rng, 1, 0xffffffff)
        || !Number.isFinite(game.time) || game.time < 0 || !Number.isFinite(game.nextArrival) || game.nextArrival < 0
        || typeof game.autoSeat !== 'boolean'
        || !Object.keys(createStats()).every(key => int(game.stats?.[key]))
        || !Array.isArray(game.queue) || game.queue.length > 6 || !game.queue.every(guest => validGuest(guest, game.time, false))
        || !Array.isArray(game.tables) || game.tables.length !== 4
        || !Array.isArray(game.events) || game.events.length > 4
        || !game.events.every(event => event && int(event.id, 1, game.eventId)
          && typeof event.text === 'string' && ['plain', 'good', 'warn'].includes(event.tone))) return null;

    const ids = new Set(game.queue.map(guest => guest.id));
    if (ids.size !== game.queue.length) return null;
    for (const [i, table] of game.tables.entries()) {
      if (!table || table.id !== i + 1 || typeof table.stage !== 'string' || !Object.hasOwn(STAGES, table.stage) || !Number.isFinite(table.since)
          || table.since < 0 || table.since > game.time) return null;
      if (table.stage === 'free' || table.stage === 'dirty') {
        if (table.guest !== null) return null;
      } else {
        if (!validGuest(table.guest, game.time, true) || ids.has(table.guest.id)) return null;
        ids.add(table.guest.id);
      }
    }
    if ([...ids].some(id => id >= game.nextGuest)) return null;
    const assigned = new Set();
    for (const role of roleKeys) {
      const worker = game.workers?.[role];
      if (!worker || !int(worker.level, 1, 3) || typeof worker.auto !== 'boolean') return null;
      if (worker.job === null) continue;
      const job = worker.job;
      const task = job && typeof job.kind === 'string' && Object.hasOwn(TASKS, job.kind) ? TASKS[job.kind] : null;
      if (!task || task.role !== role || !int(job.tableId, 1, 4) || assigned.has(job.tableId)
          || !Number.isFinite(job.remaining) || !Number.isFinite(job.duration)
          || job.remaining <= 0 || job.remaining > job.duration
          || game.tables[job.tableId - 1].stage !== (job.kind === 'cook' ? 'cooking' : task.stage)) return null;
      assigned.add(job.tableId);
    }
    if (game.tables.some(table => table.stage === 'cooking' && !assigned.has(table.id))) return null;
    return game;
  } catch {
    return null;
  }
}

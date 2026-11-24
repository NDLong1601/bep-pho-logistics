// =========================================================================
// 7b. RESTAURANT FLOOR: REAL CUSTOMERS, SEATS, BROTH POT & DISH SINK
// =========================================================================
// Customers walk in from the street, queue with a patience bar, sit at a free
// seat in a dining room, wait for a bowl from the kitchen counter (state.dishes),
// eat, pay and leave a dirty bowl in the sink. The kitchen needs broth from the
// pot and room in the sink to keep cooking.
//
// Customers are not saved: on load the dining rooms start empty.

const customersGroup = new THREE.Group();
scene.add(customersGroup);

const diningCustomers = [];
let customerSpawnTimer = 2.5;

const FLOOR_Y = 0.29;      // standing height inside rooms (matches other agents)
const SIDEWALK_Y = 0.11;   // standing height on the sidewalk
const SEATED_Y = 0.335;    // hips on the chair seat
const WALK_SPEED = 1.45;

// ---- Seat layout (shared with the dining room 3D builder) ----------------
function getDiningTables(level) {
  const tables = [[-0.85, 0.62], [0.85, 0.68]];
  if (level >= 2) tables.push([1.15, -0.38]);
  if (level >= 4) tables.push([-0.85, -0.38]);
  return tables;
}

function getDiningSeats(level) {
  const seats = [];
  for (const [tx, tz] of getDiningTables(level)) {
    seats.push({ x: tx - 0.56, z: tz, rotY: Math.PI / 2 });
    seats.push({ x: tx + 0.56, z: tz, rotY: -Math.PI / 2 });
  }
  return seats;
}

function isVenueRoom(room) {
  const cfg = room && GAME_CONFIG.rooms[room.type];
  return !!(cfg && cfg.customerVenue);
}

function getVenueRooms() {
  return state.rooms.filter(isVenueRoom);
}

function getVenueOccupancy(room) {
  let seated = 0;
  let queued = 0;
  let waitingFood = 0;
  for (const c of diningCustomers) {
    if (c.room !== room) continue;
    if (c.seatIdx >= 0 && c.stage !== 'leave') seated += 1;
    if (c.stage === 'arrive' || c.stage === 'queue') queued += 1;
    if (c.stage === 'waitFood') waitingFood += 1;
  }
  return { seated, queued, waitingFood, seats: getDiningSeats(room.level).length };
}

// ---- Kitchen support: broth pot, dish sink, serving counter --------------
function getKitchenRooms() {
  return state.rooms.filter(r => r.type === 'kitchen');
}

function getKitchenLevel() {
  return getKitchenRooms().reduce((m, r) => Math.max(m, r.level || 1), 0);
}

function scaleByKitchen(base, perLevel) {
  const lv = Math.max(1, getKitchenLevel());
  return base + perLevel * (lv - 1);
}

function getBrothCap() {
  const c = GAME_CONFIG.restaurant.broth;
  return scaleByKitchen(c.baseCap, c.capPerLevel);
}

function getSinkCap() {
  const c = GAME_CONFIG.restaurant.sink;
  return scaleByKitchen(c.baseCap, c.capPerLevel);
}

function getDishCounterCap() {
  const c = GAME_CONFIG.restaurant.counter;
  return scaleByKitchen(c.baseCap, c.capPerLevel);
}

function getBrothSimmerTime() {
  return GAME_CONFIG.restaurant.broth.simmerSec;
}

function startBrothPot(isManual = false) {
  const c = GAME_CONFIG.restaurant.broth;
  if (!getKitchenRooms().length) return false;
  if ((state.brothCooking || 0) > 0) {
    if (isManual) showToast('Nồi nước dùng đang ninh rồi!');
    return false;
  }
  if ((state.broth || 0) >= getBrothCap()) {
    if (isManual) showToast('Nồi nước dùng vẫn còn đầy.');
    return false;
  }
  if ((state.ingredients || 0) < c.ingredientCost) {
    if (isManual) showToast(`Cần ${c.ingredientCost} Kho nguyên liệu để ninh nồi mới.`);
    return false;
  }
  state.ingredients -= c.ingredientCost;
  state.brothCooking = getBrothSimmerTime();
  if (isManual) {
    if (typeof SoundFX !== 'undefined') SoundFX.click();
    showToast(`🍲 Bắt đầu ninh nồi nước dùng mới (-${c.ingredientCost} Kho)`);
  }
  updateHUD();
  return true;
}

function washBowls(count) {
  const before = state.dirtyBowls || 0;
  if (before <= 0) return 0;
  const washed = Math.min(before, count);
  state.dirtyBowls = Math.max(0, before - washed);
  return washed;
}

function washBowlsByHand() {
  const n = washBowls(GAME_CONFIG.restaurant.sink.washPerTap);
  if (n > 0) {
    if (typeof SoundFX !== 'undefined') SoundFX.click();
    const k = getKitchenRooms()[0];
    if (k) spawnFloater(k.gx, k.gy, `🧽 Rửa ${Math.ceil(n)} bát`, '#266E56');
  }
  return n;
}

function updateKitchenSupport(effDt) {
  const kitchens = getKitchenRooms();
  if (!kitchens.length) return;
  const c = GAME_CONFIG.restaurant;

  if ((state.brothCooking || 0) > 0) {
    state.brothCooking -= effDt;
    if (state.brothCooking <= 0) {
      state.brothCooking = 0;
      state.broth = getBrothCap();
      spawnFloater(kitchens[0].gx, kitchens[0].gy, '🍲 Nồi nước dùng mới!', '#266E56');
    }
  } else if ((state.broth || 0) < 1) {
    // Kitchen staff put a new pot on by themselves when it runs dry.
    startBrothPot(false);
  }

  // Kitchen staff wash a few bowls between orders. Slow on purpose:
  // a busy lunch fills the sink unless the player helps.
  const staff = kitchens.reduce((s, r) => s + (r.staff || 0), 0);
  if ((state.dirtyBowls || 0) > 0) {
    washBowls(staff * c.sink.autoWashPerStaffSec * effDt);
  }
}

// ---- Customer spawning ----------------------------------------------------
function getCustomerArrivalInterval(phase) {
  const c = GAME_CONFIG.restaurant.customers;
  let t = c.baseIntervalSec / (1 + Math.min(c.maxRepBoost, (state.rep || 0) / c.repPerBoost));
  if (phase && phase.isRush) t *= c.rushIntervalMult;
  return Math.max(c.minIntervalSec, t);
}

function getFrontEntryX(room, roomPos) {
  return room.gy === getGridSize() - 1 ? roomPos.x : 0;
}

function getQueueSpot(room, idx) {
  const p = gridToWorld3D(room.gx, room.gy);
  return new THREE.Vector3(p.x - 1.25 + idx * 0.5, FLOOR_Y, p.z + 1.65);
}

function getSeatWorld(room, seat) {
  const p = gridToWorld3D(room.gx, room.gy);
  return new THREE.Vector3(p.x + seat.x, FLOOR_Y, p.z + seat.z);
}

function spawnCustomerFor(room, forceVip = false) {
  const c = GAME_CONFIG.restaurant.customers;
  const occ = getVenueOccupancy(room);
  if (occ.queued >= c.maxQueue) return null;

  const vip = forceVip || ((state.rep || 0) >= c.vipMinRep && Math.random() < c.vipChance);
  const colors = [0xD97B6C, 0x5B8FB3, 0x62A87C, 0xC99559, 0x8E6BB0, 0xD4828E];
  const mesh = createMiniCharacter('dining', vip ? 0xE6B34C : colors[Math.floor(Math.random() * colors.length)], true);

  // Bowl that appears on the table while eating (child of the customer).
  const bowl = new THREE.Group();
  addCyl(bowl, 0.12, 0.08, 0.07, 0, 0, 0, 0xFAF6F0);
  addCyl(bowl, 0.105, 0.105, 0.01, 0, 0.03, 0, 0xD9A55B);
  bowl.position.set(0, 0.58, 0.32);
  bowl.visible = false;
  mesh.add(bowl);

  const roomPos = gridToWorld3D(room.gx, room.gy);
  const fromLeft = Math.random() < 0.5;
  const entryX = getFrontEntryX(room, roomPos);
  // Appear a short walk up the sidewalk so guests reach the door in a few seconds.
  const edge = streetMetrics.halfSpan - 0.6;
  const offset = 4 + Math.random() * 3;
  const startX = Math.max(-edge, Math.min(edge, entryX + (fromLeft ? -offset : offset)));
  const laneZ = streetMetrics.sidewalkZ + (Math.random() - 0.5) * 0.55;
  mesh.position.set(startX, SIDEWALK_Y, laneZ);
  customersGroup.add(mesh);

  const patience = c.queuePatienceSec * (1 + 0.25 * getPerkBonus('warm_hospitality'));
  const customer = {
    mesh,
    bowl,
    room,
    gx: room.gx,
    gy: room.gy,
    gridSize: getGridSize(),
    vip,
    stage: 'arrive',
    path: [
      new THREE.Vector3(entryX, SIDEWALK_Y, streetMetrics.sidewalkZ - 0.25),
      new THREE.Vector3(roomPos.x, FLOOR_Y, roomPos.z + 1.95)
    ],
    seatIdx: -1,
    timer: 0,
    patience,
    maxPatience: patience,
    exitX: fromLeft ? streetMetrics.halfSpan - 0.6 : -streetMetrics.halfSpan + 0.6,
    laneZ,
    phase: Math.random() * 6,
    speed: WALK_SPEED * (vip ? 1.2 : (0.9 + Math.random() * 0.2))
  };
  diningCustomers.push(customer);
  return customer;
}

function inviteCustomer(room) {
  const cust = spawnCustomerFor(room);
  if (!cust) {
    showToast('Hàng chờ đã đủ khách, hãy phục vụ nhanh hơn!');
    return false;
  }
  if (typeof SoundFX !== 'undefined') SoundFX.click();
  spawnFloater(room.gx, room.gy, '👋 Mời khách vào', '#266E56');
  return true;
}

// ---- Customer life cycle --------------------------------------------------
function removeCustomer(idx) {
  const c = diningCustomers[idx];
  disposeObject3D(c.mesh);
  customersGroup.remove(c.mesh);
  diningCustomers.splice(idx, 1);
}

function clearAllCustomers() {
  for (let i = diningCustomers.length - 1; i >= 0; i--) removeCustomer(i);
  customerSpawnTimer = 2.5;
}

function setSeatedPose(c, seated) {
  const legs = c.mesh.userData;
  legs.legL.rotation.x = seated ? -Math.PI / 2 : 0;
  legs.legR.rotation.x = seated ? -Math.PI / 2 : 0;
  legs.seated = seated;
}

function buildExitPath(c) {
  const roomPos = gridToWorld3D(c.gx, c.gy);
  const entryX = getFrontEntryX(c.room, roomPos);
  return [
    new THREE.Vector3(roomPos.x, FLOOR_Y, roomPos.z + 1.95),
    new THREE.Vector3(entryX, SIDEWALK_Y, streetMetrics.sidewalkZ - 0.25),
    new THREE.Vector3(c.exitX, SIDEWALK_Y, c.laneZ)
  ];
}

function sendCustomerHome(c) {
  if (c.mesh.userData.seated) {
    setSeatedPose(c, false);
    c.mesh.position.y = FLOOR_Y;
  }
  c.bowl.visible = false;
  c.stage = 'leave';
  c.seatIdx = -1;
  c.path = buildExitPath(c);
}

function customerLeavesAngry(c) {
  const room = c.room;
  state.rep = Math.max(0, (state.rep || 0) - 1);
  state.dailyOrdersFailed = (state.dailyOrdersFailed || 0) + 1;
  state.comboCount = 0;
  spawnFloater(room.gx, room.gy, c.stage === 'waitFood' ? '😤 Chờ món lâu quá' : '😤 Khách bỏ về', '#B4532A');
  sendCustomerHome(c);
  updateHUD();
}

function payCustomer(c) {
  const room = c.room;
  const cfg = GAME_CONFIG.restaurant.customers;
  const stats = getRoomCycleStats(room);
  const out = stats.output || {};
  const coins = Math.round((out.coins || 0) * (c.vip ? cfg.vipPayMult : 1));
  const rep = (out.rep || 1) + (c.vip ? cfg.vipBonusRep : 0);

  state.coins += coins;
  state.totalEarned += coins;
  state.dailyEarned = (state.dailyEarned || 0) + coins;
  state.rep += rep;
  state.totalServed += 1;
  state.dirtyBowls = (state.dirtyBowls || 0) + 1;
  gainExp(stats.expGain);

  spawnFloater(room.gx, room.gy, `${c.vip ? '👑 ' : ''}+${coins} Xu`, '#B85524');
  bumpStat('pill-coins');
  bumpStat('pill-rep');
  if (c.vip && typeof SoundFX !== 'undefined') SoundFX.reward();
  updateHUD();
  updateContractUI();
}

function stepAlongPath(c, effDt) {
  const target = c.path[0];
  if (!target) return true;
  const dx = target.x - c.mesh.position.x;
  const dz = target.z - c.mesh.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.06) {
    c.mesh.position.copy(target);
    c.path.shift();
    return c.path.length === 0;
  }
  const move = Math.min(dist, effDt * c.speed);
  c.mesh.position.x += (dx / dist) * move;
  c.mesh.position.z += (dz / dist) * move;
  c.mesh.position.y += (target.y - c.mesh.position.y) * Math.min(1, effDt * 8);
  c.mesh.rotation.y = Math.atan2(dx, dz);
  c.phase += effDt * 10;
  c.mesh.userData.legL.rotation.x = Math.sin(c.phase) * 0.48;
  c.mesh.userData.legR.rotation.x = -Math.sin(c.phase) * 0.48;
  return false;
}

function standStill(c) {
  if (c.mesh.userData.seated) return;
  c.mesh.userData.legL.rotation.x = 0;
  c.mesh.userData.legR.rotation.x = 0;
}

function isCustomerStale(c) {
  return !state.rooms.includes(c.room)
    || c.room.gx !== c.gx || c.room.gy !== c.gy
    || !isVenueRoom(c.room)
    || c.gridSize !== getGridSize();
}

function updateCustomers(effDt, phase) {
  const cfg = GAME_CONFIG.restaurant.customers;

  // Drop customers whose room was moved, demolished or re-gridded.
  for (let i = diningCustomers.length - 1; i >= 0; i--) {
    if (isCustomerStale(diningCustomers[i])) removeCustomer(i);
  }

  const venues = getVenueRooms();
  if (venues.length > 0) {
    customerSpawnTimer -= effDt;
    if (customerSpawnTimer <= 0) {
      // Send the new customer to the room with the most free seats.
      const ranked = venues
        .map(r => ({ r, occ: getVenueOccupancy(r) }))
        .filter(x => x.occ.queued < cfg.maxQueue)
        .sort((a, b) => (b.occ.seats - b.occ.seated - b.occ.queued) - (a.occ.seats - a.occ.seated - a.occ.queued));
      if (ranked.length) spawnCustomerFor(ranked[0].r);
      customerSpawnTimer = getCustomerArrivalInterval(phase) / Math.sqrt(venues.length) * (0.75 + Math.random() * 0.5);
    }
  }

  // Queue order per room, by arrival (the array is in arrival order).
  const queueSlot = new Map();
  const perRoomCount = new Map();
  for (const c of diningCustomers) {
    if (c.stage !== 'queue' && c.stage !== 'arrive') continue;
    const n = perRoomCount.get(c.room) || 0;
    perRoomCount.set(c.room, n + 1);
    queueSlot.set(c, n);
  }

  for (let i = diningCustomers.length - 1; i >= 0; i--) {
    const c = diningCustomers[i];
    const room = c.room;

    if (c.stage === 'arrive') {
      if (stepAlongPath(c, effDt)) c.stage = 'queue';
      c.patience -= effDt * 0.5; // walking in costs a little patience
    }

    if (c.stage === 'queue') {
      c.patience -= effDt;
      const blocked = room.hazard && room.hazard.blocking;
      const seats = getDiningSeats(room.level);
      const taken = new Set(diningCustomers.filter(o => o.room === room && o.seatIdx >= 0).map(o => o.seatIdx));
      const freeIdx = blocked ? -1 : seats.findIndex((_, idx) => !taken.has(idx));
      if (freeIdx >= 0) {
        c.seatIdx = freeIdx;
        c.stage = 'toSeat';
        c.path = [getSeatWorld(room, seats[freeIdx])];
      } else if (c.patience <= 0) {
        customerLeavesAngry(c);
      }
    }

    if (c.stage === 'toSeat') {
      if (stepAlongPath(c, effDt)) {
        const seat = getDiningSeats(room.level)[c.seatIdx];
        c.mesh.position.y = SEATED_Y;
        c.mesh.rotation.y = seat.rotY;
        setSeatedPose(c, true);
        c.stage = 'waitFood';
        c.timer = cfg.serveDelaySec / (1 + 0.2 * Math.max(0, (room.staff || 1) - 1));
        c.patience = cfg.foodPatienceSec * (1 + 0.25 * getPerkBonus('warm_hospitality'));
        c.maxPatience = c.patience;
      }
    } else if (c.stage === 'waitFood') {
      c.timer -= effDt;
      if (c.timer <= 0 && (state.dishes || 0) >= 1) {
        state.dishes -= 1;
        c.bowl.visible = true;
        c.stage = 'eating';
        c.timer = cfg.eatSec * (0.85 + Math.random() * 0.3);
        if (Math.random() < 0.5) spawnSteamAt(c.mesh.position);
      } else {
        c.patience -= effDt;
        if (c.patience <= 0) customerLeavesAngry(c);
      }
    } else if (c.stage === 'eating') {
      c.timer -= effDt;
      if (Math.random() < effDt * 0.6) spawnSteamAt(c.mesh.position);
      if (c.timer <= 0) {
        payCustomer(c);
        sendCustomerHome(c);
      }
    } else if (c.stage === 'leave') {
      if (stepAlongPath(c, effDt)) {
        removeCustomer(i);
        continue;
      }
    } else if (c.stage === 'queue') {
      const spot = getQueueSpot(room, queueSlot.get(c) || 0);
      const dist = Math.hypot(spot.x - c.mesh.position.x, spot.z - c.mesh.position.z);
      if (dist > 0.06) {
        c.path = [spot];
        stepAlongPath(c, effDt);
      } else {
        standStill(c);
      }
    }
  }

  // Room status: occupancy bar, and a warning when seated guests wait on the kitchen.
  for (const room of venues) {
    const occ = getVenueOccupancy(room);
    room.progress = occ.seats > 0 ? occ.seated / occ.seats : 0;
    const waitingNoFood = occ.waitingFood > 0 && (state.dishes || 0) < 1;
    room.starved = waitingNoFood;
    room.missingLabel = waitingNoFood ? 'Khách đang chờ món' : '';
  }
}

function spawnSteamAt(pos) {
  if (typeof sharedSteamGeo === 'undefined') return;
  const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4, depthWrite: false });
  const puff = new THREE.Mesh(sharedSteamGeo, mat);
  puff.position.set(pos.x, 0.95, pos.z);
  effectsGroup.add(puff);
  const life = 1.2 + Math.random() * 0.5;
  steamPuffs.push({ mesh: puff, life, maxLife: life });
}

// ---- Rough steady-state rates (HUD rate badges & offline earnings) -------
function estimateVenueRates(room, bonuses) {
  const cfg = GAME_CONFIG.restaurant.customers;
  const venues = Math.max(1, getVenueRooms().length);
  const arrivalsPerSec = Math.sqrt(venues) / getCustomerArrivalInterval(getCurrentDayPhase()) / venues;
  const seats = getDiningSeats(room.level).length;
  const mealSec = cfg.eatSec + cfg.serveDelaySec + 4;
  const servedPerSec = Math.min(arrivalsPerSec, seats / mealSec);
  const out = getRoomCycleStats(room, room.level, room.staff, bonuses).output || {};
  return { coins: servedPerSec * (out.coins || 0), dishes: servedPerSec };
}

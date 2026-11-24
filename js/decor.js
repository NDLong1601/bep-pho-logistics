// =========================================================================
// 7e. DECOR & RESTAURANT RANK
// =========================================================================
// Decor items are bought once for the whole restaurant. Each one shows up in
// 3D (sidewalk in front of the dining room, the dining hall or the kitchen),
// gives a small gameplay effect and adds Space points.
// Three scores (Space, Service, Food) add up to the restaurant rank, which
// brings more customers, higher prices and longer offline earnings.

function ownsDecor(id) {
  return Array.isArray(state.decor) && state.decor.includes(id);
}

function getDecorConfig(id) {
  return (GAME_CONFIG.decor || []).find(d => d.id === id) || null;
}

// Sum of one effect key over every owned decor item.
function getDecorBonus(key) {
  let total = 0;
  for (const id of state.decor || []) {
    const d = getDecorConfig(id);
    if (d && d.effect && typeof d.effect[key] === 'number') total += d.effect[key];
  }
  return total;
}

function buyDecor(id) {
  const d = getDecorConfig(id);
  if (!d || ownsDecor(id)) return false;
  const rank = getRestaurantRank();
  if ((d.minRank || 1) > rank.index + 1) {
    showToast(`Cần hạng ${GAME_CONFIG.restaurantRanks[(d.minRank || 1) - 1].name} để đặt ${d.name}.`);
    return false;
  }
  if (state.coins < d.cost) {
    showToast(`Cần ${d.cost.toLocaleString('vi-VN')} Xu để mua ${d.name}.`);
    return false;
  }
  state.coins -= d.cost;
  if (!Array.isArray(state.decor)) state.decor = [];
  state.decor.push(id);
  gainExp(25);
  if (typeof SoundFX !== 'undefined') SoundFX.build();
  showToast(`${d.icon} Đã đặt ${d.name}: ${d.effectText}`);
  rebuildRooms3D();
  checkRankUp();
  updateHUD();
  saveGame(false);
  return true;
}

// ---- Scores & rank ---------------------------------------------------------
function getRestaurantScores() {
  const c = GAME_CONFIG.rankScoring;
  let space = 0;
  for (const id of state.decor || []) {
    const d = getDecorConfig(id);
    if (d) space += d.points;
  }
  let service = 0;
  for (const r of state.rooms) {
    if (r.type === 'dining' || r.type === 'kitchen') space += c.spacePerRoomLevel * (r.level || 1);
    service += c.servicePerStaff * (r.staff || 0);
    service += c.servicePerWasher * (Array.isArray(r.washers) ? r.washers.length : 0);
    for (const m of r.crew || []) service += c.serviceTraitBonus * (getStaffTrait(m.trait).staffBonus || 0);
  }
  let food = 0;
  for (const d of GAME_CONFIG.dishes || []) {
    if (!isDishUnlocked(d.id)) continue;
    food += c.foodPerDish + c.foodPerStar * (getDishStars(d.id) - 1);
  }
  space = Math.round(space);
  service = Math.round(service);
  food = Math.round(food);
  return { space, service, food, total: space + service + food };
}

function getRestaurantRank(scores = getRestaurantScores()) {
  const ranks = GAME_CONFIG.restaurantRanks;
  let index = 0;
  for (let i = 0; i < ranks.length; i++) {
    if (scores.total >= ranks[i].minScore) index = i;
  }
  return Object.assign({ index }, ranks[index], { next: ranks[index + 1] || null, scores });
}

function getRankPriceBonus() {
  return getRestaurantRank().priceBonus || 0;
}

function getRankArrivalBonus() {
  return getRestaurantRank().arrivalBonus || 0;
}

function getOfflineHours() {
  return getRestaurantRank().offlineHours || 4;
}

// Announce a new rank once (state.rankIndex remembers the last one shown).
function checkRankUp() {
  const rank = getRestaurantRank();
  const prev = typeof state.rankIndex === 'number' ? state.rankIndex : 0;
  if (prev < 0) {
    state.rankIndex = rank.index; // save migrated from before ranks existed: adopt silently
    return;
  }
  if (rank.index > prev) {
    state.rankIndex = rank.index;
    showStoryCard(rank.icon, `Quán lên hạng ${rank.name}!`, rank.story, 'Hạng quán mới');
    if (typeof SoundFX !== 'undefined') SoundFX.levelUp();
    gainExp(60);
    saveGame(false);
  } else if (rank.index !== prev) {
    state.rankIndex = rank.index; // a demolished room can lower the score; follow it quietly
  }
}

let rankCheckTimer = 0;
function updateRankCheck(dt) {
  rankCheckTimer -= dt;
  if (rankCheckTimer > 0) return;
  rankCheckTimer = 1.5;
  checkRankUp();
  updateRankPill();
}

function updateRankPill() {
  const el = document.getElementById('stat-rank');
  if (!el) return;
  const rank = getRestaurantRank();
  const text = `${rank.icon} ${rank.name}`;
  if (el.textContent !== text) el.textContent = text;
}

// ---- 3D decor --------------------------------------------------------------
// Called from buildRoomShell for dining rooms and kitchens.
// `group` is the room's ground-level group, `interior` sits on the floor.
function buildDecor3D(room, group, interior, animHooks, isStreetFront) {
  const has = ownsDecor;
  const hs = (GAME_CONFIG.TILE_SIZE - 0.06) / 2;

  if (room.type === 'dining') {
    if (isStreetFront) {
      // Sidewalk in front of the shop
      if (has('ghe_nhua')) {
        [[0.95, 0.42], [1.55, 0.42], [0.95, 0.98], [1.55, 0.98]].forEach(([x, z], i) => {
          addChair(group, x, hs + z, i < 2 ? 0 : Math.PI, 0xD9483B);
        });
        addBox(group, 0.5, 0.04, 0.5, 1.25, 0.34, hs + 0.7, 0x3B78B5);
        addCyl(group, 0.04, 0.05, 0.32, 1.25, 0.16, hs + 0.7, 0x3B78B5);
      }
      if (has('cay_xanh')) {
        addCyl(group, 0.24, 0.2, 0.36, -1.75, 0.18, hs + 0.42, 0x8E5B36);
        addPlant(group, -1.75, hs + 0.42, 1.35);
      }
      if (has('bien_hieu')) {
        // Lit standing sign on the sidewalk, left of the entry
        const sx = -1.0, sz = hs + 0.95;
        addCyl(group, 0.035, 0.04, 1.45, sx - 0.4, 0.72, sz, 0x4A3A2E);
        addCyl(group, 0.035, 0.04, 1.45, sx + 0.4, 0.72, sz, 0x4A3A2E);
        const sign = addBox(group, 0.95, 0.5, 0.07, sx, 1.2, sz, 0xC8352B, { emissive: 0xB52A20, emissiveIntensity: 0.35 });
        sign.castShadow = false;
        addBox(group, 0.78, 0.22, 0.02, sx, 1.2, sz + 0.045, 0xFFD45E, { emissive: 0xFFC233, emissiveIntensity: 0.6 });
      }
    }
    if (has('quat_tran')) {
      const fan = new THREE.Group();
      fan.position.set(0.1, 2.05, 0.3);
      addCyl(fan, 0.02, 0.02, 0.25, 0, 0.12, 0, 0x5A4130);
      addCyl(fan, 0.09, 0.09, 0.06, 0, 0, 0, 0x5A4130);
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((a) => {
        const blade = addBox(fan, 0.62, 0.015, 0.11, Math.cos(a) * 0.36, -0.01, Math.sin(a) * 0.36, 0x9A653E);
        blade.rotation.y = -a;
      });
      interior.add(fan);
      animHooks.push((t) => { fan.rotation.y = t * 4.2; });
    }
    if (has('tranh_pho_co')) {
      const art = addBox(interior, 0.62, 0.48, 0.05, -1.25, 1.5, -1.86, 0xFFFFFF, { map: makeWallArtTexture('phoco'), roughness: 0.6 });
      art.userData.wallSide = 'NZ';
      const frame = addBox(interior, 0.7, 0.56, 0.03, -1.25, 1.5, -1.885, 0x6B4226);
      frame.userData.wallSide = 'NZ';
    }
    if (has('khay_gia_vi')) {
      getDiningTables(room.level).forEach(([tx, tz]) => {
        addBox(interior, 0.26, 0.03, 0.12, tx + 0.12, 0.615, tz - 0.3, 0x8A5A35);
        addCyl(interior, 0.03, 0.03, 0.07, tx + 0.04, 0.665, tz - 0.3, 0xE5482F);
        addCyl(interior, 0.03, 0.03, 0.07, tx + 0.12, 0.665, tz - 0.3, 0x9BC53D);
        addCyl(interior, 0.03, 0.03, 0.07, tx + 0.2, 0.665, tz - 0.3, 0xF4EBD0);
      });
    }
    if (has('den_long')) {
      [[-1.55, 1.55], [1.6, 1.55], [-1.55, -1.4]].forEach(([x, z]) => {
        addCyl(interior, 0.006, 0.006, 0.3, x, 2.0, z, 0x3D3530);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), toonMat({ color: 0xD8332A, emissive: 0xE0452B, emissiveIntensity: 0.55, roughness: 0.5 }));
        lamp.scale.y = 1.2;
        lamp.position.set(x, 1.75, z);
        interior.add(lamp);
      });
    }
  }

  if (room.type === 'kitchen') {
    if (has('noi_lon')) {
      addCyl(interior, 0.3, 0.27, 0.5, 1.55, 0.25, -0.62, 0xB8C2CB, { metalness: 0.55, roughness: 0.3 });
      addCyl(interior, 0.31, 0.31, 0.03, 1.55, 0.5, -0.62, 0x8D99A3, { metalness: 0.6 });
      animHooks.push((t) => {
        if (Math.sin(t * 2.3) > 0.97 && typeof spawnSteamAt === 'function') {
          const p = interior.localToWorld(new THREE.Vector3(1.55, 0, -0.62));
          spawnSteamAt(p);
        }
      });
    }
    if (has('ke_bat')) {
      addBox(interior, 0.3, 0.04, 1.1, 1.92, 1.45, 0.55, 0xC5D0DA, { metalness: 0.5 });
      [0.15, 0.4, 0.65, 0.9].forEach((dz) => {
        addCyl(interior, 0.1, 0.07, 0.14, 1.9, 1.54, 0.05 + dz, 0xFAF6F0);
      });
    }
    if (has('hut_mui')) {
      addBox(interior, 2.14, 0.07, 0.76, 0.15, 1.74, -1.48, 0xC77A3A, { metalness: 0.6, roughness: 0.3 });
    }
  }
}

// ---- Decor & rank panel (system modal tab) ---------------------------------
function renderDecorPanel() {
  const rankBox = document.getElementById('decor-rank-card');
  const list = document.getElementById('decor-list');
  if (!rankBox || !list) return;
  const rank = getRestaurantRank();
  const s = rank.scores;
  const next = rank.next;
  const pct = next ? Math.min(100, Math.round(((s.total - rank.minScore) / (next.minScore - rank.minScore)) * 100)) : 100;
  const bar = (label, icon, value, color, hint) => `
    <div>
      <div class="flex justify-between text-[11px] mb-0.5"><span class="text-stone-600">${icon} ${label} <span class="text-stone-400">· ${hint}</span></span><strong class="tabular-nums text-stone-900">${value}</strong></div>
      <div class="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div class="h-full ${color} rounded-full" style="width:${Math.min(100, Math.round((value / Math.max(1, s.total)) * 100))}%"></div></div>
    </div>`;
  rankBox.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Hạng quán</div>
        <div class="text-base font-bold text-stone-900">${rank.icon} ${rank.name}</div>
        <div class="text-[11px] text-stone-600 mt-0.5">Khách đến +${Math.round(rank.arrivalBonus * 100)}% · Giá +${Math.round(rank.priceBonus * 100)}% · Thu nhập offline tối đa ${rank.offlineHours} giờ</div>
      </div>
      <div class="text-right"><div class="text-[10px] text-stone-500">Tổng điểm</div><div class="text-lg font-bold tabular-nums text-stone-900">${s.total}</div></div>
    </div>
    <div>
      <div class="flex justify-between text-[11px] mb-1"><span class="text-stone-600">${next ? `Lên ${next.icon} ${next.name}` : 'Đã đạt hạng cao nhất'}</span><span class="tabular-nums font-bold text-stone-900">${next ? `${s.total}/${next.minScore}` : ''}</span></div>
      <div class="h-2 bg-stone-200 rounded-full overflow-hidden"><div class="h-full bg-amber-600 rounded-full" style="width:${pct}%"></div></div>
    </div>
    <div class="space-y-2 pt-1">
      ${bar('Không gian', '🪴', s.space, 'bg-emerald-600', 'đồ trang trí, cấp Phòng Ăn & Bếp')}
      ${bar('Phục vụ', '🤝', s.service, 'bg-sky-600', 'số nhân viên, người rửa bát, tính cách')}
      ${bar('Món ăn', '🍜', s.food, 'bg-orange-500', 'số món đã mở, số sao')}
    </div>`;

  const zones = GAME_CONFIG.decorZones;
  list.innerHTML = Object.entries(zones).map(([zoneId, zone]) => {
    const items = (GAME_CONFIG.decor || []).filter(d => d.zone === zoneId);
    return `
      <div>
        <div class="font-bold text-xs text-stone-900 mb-1.5">${zone.icon} ${zone.name} <span class="font-normal text-stone-500">· ${zone.desc}</span></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${items.map((d) => {
            const owned = ownsDecor(d.id);
            const lockedRank = (d.minRank || 1) > rank.index + 1;
            const canBuy = !owned && !lockedRank && state.coins >= d.cost;
            const label = owned ? '✓ Đã đặt' : (lockedRank ? `🔒 Hạng ${GAME_CONFIG.restaurantRanks[d.minRank - 1].name}` : `${d.cost.toLocaleString('vi-VN')} Xu`);
            return `
              <div class="bg-white border ${owned ? 'border-emerald-300' : 'border-stone-200/80'} rounded-2xl p-2.5 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-xs font-bold text-stone-900">${d.icon} ${d.name} <span class="font-semibold text-emerald-700">+${d.points}</span></div>
                  <div class="text-[10.5px] text-stone-500 leading-snug">${d.effectText}</div>
                </div>
                <button data-buy-decor="${d.id}" class="${owned ? 'btn-ghost' : 'btn-primary'} px-2.5 py-1 rounded-xl text-[10.5px] font-bold whitespace-nowrap shrink-0" ${canBuy ? '' : 'disabled'}>${label}</button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-buy-decor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (buyDecor(btn.getAttribute('data-buy-decor'))) renderDecorPanel();
    });
  });
}

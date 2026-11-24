// =========================================================================
// 8. SIMULATION LOOP
// =========================================================================
function updateCutawayWalls() {
  const cutNX = Math.sin(camYawCurrent) < -0.05;
  const cutNZ = Math.cos(camYawCurrent) < -0.05;
  const targetNX = cutNX ? 0.26 : 1.0;
  const targetNZ = cutNZ ? 0.26 : 1.0;

  roomMeshesMap.forEach((entry) => {
    if (entry.wallNX) {
      entry.wallNX.scale.y += (targetNX - entry.wallNX.scale.y) * 0.18;
    }
    if (entry.wallNZ) {
      entry.wallNZ.scale.y += (targetNZ - entry.wallNZ.scale.y) * 0.18;
    }
    if (entry.windowNX) {
      entry.windowNX.visible = !cutNX;
    }
    if (entry.wallPropsNX) {
      for (const prop of entry.wallPropsNX) prop.visible = !cutNX;
    }
    if (entry.wallPropsNZ) {
      for (const prop of entry.wallPropsNZ) prop.visible = !cutNZ;
    }
  });
}

function updateSimulation(dt, timeSec) {
  updateCutawayWalls();
  if (isPaused) return;
  const effDt = dt * gameSpeed;
  const bonuses = getGlobalBonuses();
  let starvedChanged = false;

  state.dayTimer += effDt;
  if (state.dayTimer >= 45) {
    state.dayTimer -= 45;
    state.day += 1;
    updateHUD();
  }

  for (const room of state.rooms) {
    const cfg = GAME_CONFIG.rooms[room.type];
    if (!cfg) continue;

    const missing = getMissingInputInfo(room);
    const wasStarved = !!room.starved;
    const prevMissingLabel = room.missingLabel || '';

    if (!missing) {
      room.starved = false;
      room.missingLabel = '';
      const speed = (1 / cfg.cycleTime) * bonuses.speedMult * (1 + (room.level - 1) * 0.14);
      room.progress += effDt * speed;
      if (room.progress >= 1) {
        room.progress -= 1;
        completeRoomCycle(room, bonuses);
      }
    } else {
      room.starved = true;
      room.missingLabel = missing.label;
      room.progress = Math.min(room.progress, 0.15);
    }

    if (wasStarved !== room.starved || prevMissingLabel !== room.missingLabel) {
      starvedChanged = true;
      if (selectedPlot && selectedPlot.gx === room.gx && selectedPlot.gy === room.gy) {
        updateSelectedRoomProgressOnly(room);
      }
    }

    // Kitchen steam wisps
    if (room.type === 'kitchen' && !room.starved && Math.random() < effDt * 2.2) {
      spawnSteamPuff(room.gx, room.gy);
    }
  }

  if (starvedChanged) {
    updateHUD();
  }

  // Animate room hooks (conveyors, vans) and 3D characters
  roomMeshesMap.forEach((entry) => {
    for (const fn of entry.animHooks) fn(timeSec);

    for (const a of entry.agents) {
      if (a.wait > 0) {
        a.wait -= effDt;
      } else {
        const dx = a.tx - a.mesh.position.x;
        const dz = a.tz - a.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.08) {
          a.tx = (Math.random() - 0.5) * 2.5;
          a.tz = (Math.random() - 0.5) * 2.5;
          a.wait = 0.7 + Math.random() * 1.6;
          a.mesh.userData.legL.rotation.x = 0;
          a.mesh.userData.legR.rotation.x = 0;
        } else {
          const step = Math.min(dist, effDt * 1.15);
          a.mesh.position.x += (dx / dist) * step;
          a.mesh.position.z += (dz / dist) * step;
          a.mesh.rotation.y = Math.atan2(dx, dz);
          a.phase += effDt * 10;
          a.mesh.position.y = Math.abs(Math.sin(a.phase)) * 0.06;
          a.mesh.userData.legL.rotation.x = Math.sin(a.phase) * 0.45;
          a.mesh.userData.legR.rotation.x = -Math.sin(a.phase) * 0.45;
        }
      }
    }
  });

  // Update steam puffs
  for (let i = steamPuffs.length - 1; i >= 0; i--) {
    const p = steamPuffs[i];
    p.life -= effDt;
    p.mesh.position.y += effDt * 0.85;
    p.mesh.scale.setScalar(1 + (1 - p.life / p.maxLife) * 1.4);
    p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.42);
    if (p.life <= 0) {
      if (p.mesh.material) p.mesh.material.dispose();
      effectsGroup.remove(p.mesh);
      steamPuffs.splice(i, 1);
    }
  }

  // Update floating popups
  for (let i = activeFloaters.length - 1; i >= 0; i--) {
    const f = activeFloaters[i];
    f.life -= effDt;
    f.pos.y += effDt * 1.05;
    f.el.style.opacity = Math.min(1, f.life / 0.45).toFixed(2);
    if (f.life <= 0) {
      f.el.remove();
      activeFloaters.splice(i, 1);
    }
  }
}

function completeRoomCycle(room, bonuses) {
  const cfg = GAME_CONFIG.rooms[room.type];
  if (cfg.requires) {
    for (const [k, amt] of Object.entries(cfg.requires)) {
      if ((state[k] || 0) < amt) return;
    }
    for (const [k, amt] of Object.entries(cfg.requires)) {
      state[k] -= amt;
    }
  }

  const out = cfg.produce(room.level, room.staff, 1, bonuses);
  const msgs = [];
  if (out.ingredients) { state.ingredients += out.ingredients; msgs.push(`+${out.ingredients} Kho`); bumpStat('pill-ingredients'); }
  if (out.dishes) { state.dishes += out.dishes; msgs.push(`+${out.dishes} Món`); bumpStat('pill-dishes'); }
  if (out.parcels) { state.parcels += out.parcels; msgs.push(`+${out.parcels} Đơn`); bumpStat('pill-parcels'); }
  if (out.coins) { state.coins += out.coins; state.totalEarned += out.coins; msgs.push(`+${out.coins} Xu`); bumpStat('pill-coins'); }
  if (out.rep) { state.rep += out.rep; bumpStat('pill-rep'); }
  if (out.served) state.totalServed += out.served;

  if (msgs.length) spawnFloater(room.gx, room.gy, msgs[0], out.coins ? '#B85524' : '#266E56');
  updateHUD();
  updateContractUI();
  if (selectedPlot && selectedPlot.gx === room.gx && selectedPlot.gy === room.gy) {
    updateSelectedRoomProgressOnly(room);
  }
}

function syncOverlays() {
  roomMeshesMap.forEach((entry, key) => {
    const tag = roomTagMap.get(key);
    if (!tag) return;
    const topPos = entry.group.position.clone();
    topPos.y = GAME_CONFIG.WALL_HEIGHT + 0.55;
    const sc = worldToScreen(topPos);
    tag.style.transform = `translate3d(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px, 0) translate(-50%, -100%)`;

    const pct = `${Math.min(100, Math.round(entry.room.progress * 100))}%`;
    if (tag.dataset.pct !== pct) {
      tag.dataset.pct = pct;
      const fill = tag.querySelector('.room-tag-fill');
      if (fill) fill.style.width = pct;
    }

    const isStarved = !!entry.room.starved;
    if (tag.dataset.starved !== String(isStarved)) {
      tag.dataset.starved = String(isStarved);
      tag.classList.toggle('starved', isStarved);
    }

    const warnText = isStarved ? `⚠️ ${entry.room.missingLabel || 'Thiếu đầu vào'}` : '';
    if (tag.dataset.warn !== warnText) {
      tag.dataset.warn = warnText;
      const warnEl = tag.querySelector('.room-tag-warn');
      if (warnEl) {
        warnEl.textContent = warnText;
        warnEl.classList.toggle('hidden', !isStarved);
      }
    }

    const canUpgrade = entry.room.level < GAME_CONFIG.MAX_LEVEL && state.coins >= getUpgradeCost(entry.room);
    if (tag.dataset.canUp !== String(canUpgrade)) {
      tag.dataset.canUp = String(canUpgrade);
      const upEl = tag.querySelector('.room-tag-up');
      if (upEl) upEl.classList.toggle('hidden', !canUpgrade);
    }
  });

  for (const f of activeFloaters) {
    const sc = worldToScreen(f.pos);
    f.el.style.transform = `translate3d(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
  }
}

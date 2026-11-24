// =========================================================================
// 8. SIMULATION LOOP
// =========================================================================
function updateSimulation(dt, timeSec) {
  if (isPaused) return;
  const effDt = dt * gameSpeed;
  const bonuses = getGlobalBonuses();

  state.dayTimer += effDt;
  if (state.dayTimer >= 45) {
    state.dayTimer -= 45;
    state.day += 1;
    updateHUD();
  }

  for (const room of state.rooms) {
    const cfg = GAME_CONFIG.rooms[room.type];
    if (!cfg) continue;

    let hasInputs = true;
    if (cfg.requires) {
      for (const [k, amt] of Object.entries(cfg.requires)) {
        if ((state[k] || 0) < amt) hasInputs = false;
      }
    }

    if (hasInputs) {
      const speed = (1 / cfg.cycleTime) * bonuses.speedMult * (1 + (room.level - 1) * 0.14);
      room.progress += effDt * speed;
      if (room.progress >= 1) {
        room.progress -= 1;
        completeRoomCycle(room, bonuses);
      }
    } else {
      room.progress = Math.min(room.progress, 0.15);
    }

    // Kitchen steam wisps
    if (room.type === 'kitchen' && Math.random() < effDt * 2.2) {
      spawnSteamPuff(room.gx, room.gy);
    }
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
    tag.style.left = `${sc.x}px`;
    tag.style.top = `${sc.y}px`;
    const fill = tag.querySelector('.room-tag-fill');
    if (fill) fill.style.width = `${Math.min(100, Math.round(entry.room.progress * 100))}%`;
  });

  for (const f of activeFloaters) {
    const sc = worldToScreen(f.pos);
    f.el.style.left = `${sc.x}px`;
    f.el.style.top = `${sc.y}px`;
  }
}

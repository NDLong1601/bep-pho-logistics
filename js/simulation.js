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
      for (const prop of entry.wallPropsNX) {
        prop.visible = prop.userData.removedByMerge ? false : !cutNX;
      }
    }
    if (entry.wallPropsNZ) {
      for (const prop of entry.wallPropsNZ) {
        prop.visible = prop.userData.removedByMerge ? false : !cutNZ;
      }
    }
  });
}

let lastDayPhaseId = null;

function updateSimulation(dt, timeSec) {
  updateCutawayWalls();
  updateDayNightLighting(dt);

  // Animate synergy pulse spheres along 3D supply arcs
  for (const p of synergyPulses) {
    const u = (timeSec * p.speed + p.offset) % 1;
    p.curve.getPointAt(u, p.mesh.position);
  }

  // Animate spring pop-in on newly built / upgraded / relocated rooms
  popAnimMap.forEach((anim, key) => {
    anim.t += dt;
    const progress = Math.min(1, anim.t / anim.duration);
    const entry = roomMeshesMap.get(key);
    if (entry && entry.group) {
      if (progress >= 1) {
        entry.group.scale.set(1, 1, 1);
      } else {
        const s = 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 2.2) * 0.85;
        entry.group.scale.set(s, s, s);
      }
    }
    if (progress >= 1) popAnimMap.delete(key);
  });

  if (isPaused) return;
  const effDt = dt * gameSpeed;
  const bonuses = getGlobalBonuses();
  let starvedChanged = false;

  const prevPhase = getCurrentDayPhase();
  state.dayTimer += effDt;
  if (state.dayTimer >= 45) {
    state.dayTimer -= 45;
    const finishedDay = state.day;
    state.day += 1;

    const upkeep = getDailyUpkeep();
    const paidUpkeep = Math.min(state.coins, upkeep);
    state.coins -= paidUpkeep;

    const totalEarnedToday = state.dailyEarned || 0;
    const tipsToday = state.dailyTips || 0;
    const penaltiesToday = state.dailyPenalties || 0;
    const dayReport = {
      day: finishedDay,
      grossSales: Math.max(0, totalEarnedToday - tipsToday),
      tips: tipsToday,
      upkeep,
      penalties: penaltiesToday,
      netProfit: totalEarnedToday - upkeep - penaltiesToday,
      completed: state.dailyOrdersCompleted || 0,
      failed: state.dailyOrdersFailed || 0
    };

    state.dailyEarned = 0;
    state.dailyTips = 0;
    state.dailyPenalties = 0;
    state.dailyOrdersCompleted = 0;
    state.dailyOrdersFailed = 0;

    const choices = pickRandomPerkChoices(3);
    if (state.autoNextDay && choices.length > 0) {
      const picked = applyPerkCard(choices[0].id);
      showToast(`🧾 Ngày ${finishedDay}: Lợi nhuận ${dayReport.netProfit >= 0 ? '+' : ''}${dayReport.netProfit} Xu · Thẻ: ${picked.icon} ${picked.name}`);
      saveGame(false);
    } else if (typeof openDaySummaryModal === 'function') {
      openDaySummaryModal(dayReport, choices);
    }
    updateHUD();
  }

  const phase = getCurrentDayPhase();
  if (lastDayPhaseId !== phase.id) {
    lastDayPhaseId = phase.id;
    updateHUD();
    if (phase.id === 'lunch_rush') showToast('🔥 Giờ Cao Điểm Trưa: +30% tốc độ & +20% doanh thu!');
    else if (phase.id === 'night_rush') showToast('🌙 Đêm Phố Cổ lên đèn: +25% doanh thu quán!');
  } else if (prevPhase.id !== phase.id) {
    updateHUD();
  }

  // Live Customer Tickets Loop (Overcooked + Diner Dash pattern)
  state.ticketSpawnTimer = (state.ticketSpawnTimer !== undefined ? state.ticketSpawnTimer : 2.5) - effDt;
  if (state.ticketSpawnTimer <= 0) {
    const newTicket = spawnCustomerTicket();
    if (newTicket) {
      if (typeof renderTicketRail === 'function') renderTicketRail();
      if (newTicket.resource === 'dishes' && typeof spawnStreetWalker === 'function') {
        spawnStreetWalker(true, newTicket.vip);
      }
    }
    const baseSpawn = phase.isRush ? 5.0 : 8.2;
    state.ticketSpawnTimer = Math.max(3.4, baseSpawn - Math.min(2.4, state.rooms.length * 0.22));
  }

  if (Array.isArray(state.tickets) && state.tickets.length > 0) {
    for (let i = state.tickets.length - 1; i >= 0; i--) {
      const t = state.tickets[i];
      t.timeLeft -= effDt;
      if (t.timeLeft <= 0) {
        failTicket(t);
      }
    }
    if (typeof updateTicketRailProgress === 'function') updateTicketRailProgress();
  }

  // Interactive 3D Room Hazards / Opportunities
  hazardSpawnTimer -= effDt;
  if (hazardSpawnTimer <= 0) {
    triggerRandomRoomHazard();
    hazardSpawnTimer = 11 + Math.random() * 7;
  }

  // Express order countdown / generation (unlocks at Player Level 2+)
  if ((state.playerLevel || 1) >= 2) {
    if (state.expressOrder) {
      state.expressOrder.timeLeft -= effDt;
      if (state.expressOrder.timeLeft <= 0) {
        state.expressOrder = null;
        state.expressCooldown = 10;
        showToast('Đơn hàng khẩn cấp đã hết thời gian!');
      }
      updateExpressOrderUI();
    } else {
      state.expressCooldown -= effDt;
      if (state.expressCooldown <= 0) {
        state.expressOrder = generateExpressOrder();
        state.expressCooldown = 12;
        updateExpressOrderUI();
        if (state.expressOrder) showToast(`⚡ Đơn khẩn cấp mới: ${state.expressOrder.title}`);
      }
    }
  }

  for (const room of state.rooms) {
    const cfg = GAME_CONFIG.rooms[room.type];
    if (!cfg) continue;

    if (room.hazard) {
      room.hazard.timeLeft -= effDt;
      if (room.hazard.timeLeft <= 0) {
        const expiredHazard = room.hazard;
        room.hazard = null;
        if (expiredHazard.type === 'overheat') {
          const fee = Math.min(state.coins, 50);
          state.coins -= fee;
          state.dailyPenalties = (state.dailyPenalties || 0) + fee;
          state.comboCount = 0;
          showToast(`💥 ${cfg.name} cháy khét do không dập lửa! (-${fee} Xu & mất Combo)`);
          updateHUD();
        }
      }
    }

    if (room.hazard && room.hazard.blocking) {
      continue;
    }

    const missing = getMissingInputInfo(room);
    const wasStarved = !!room.starved;
    const prevMissingLabel = room.missingLabel || '';

    if (!missing) {
      room.starved = false;
      room.missingLabel = '';
      const eff = getRoomEffectiveMultipliers(room, bonuses);
      const speed = (1 / cfg.cycleTime) * eff.speedMult * (1 + (room.level - 1) * 0.12);
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

  // Animate street vehicles, entering/exiting customers, and inter-room doorway staff
  for (const v of streetVehicles) {
    v.mesh.position.x += v.dir * v.speed * effDt;
    if (v.dir > 0 && v.mesh.position.x > streetMetrics.halfSpan) {
      v.mesh.position.x = -streetMetrics.halfSpan;
    } else if (v.dir < 0 && v.mesh.position.x < -streetMetrics.halfSpan) {
      v.mesh.position.x = streetMetrics.halfSpan;
    }
  }

  if (Math.random() < effDt * 0.55) {
    spawnStreetWalker(Math.random() < 0.6, false);
  }

  for (let i = streetWalkers.length - 1; i >= 0; i--) {
    const w = streetWalkers[i];
    if (w.wait > 0) {
      w.wait -= effDt;
      w.mesh.userData.legL.rotation.x = 0;
      w.mesh.userData.legR.rotation.x = 0;
      continue;
    }
    const target = w.waypoints[w.wpIdx];
    if (!target) {
      disposeObject3D(w.mesh);
      worldAgentsGroup.remove(w.mesh);
      streetWalkers.splice(i, 1);
      continue;
    }
    const dx = target.pos.x - w.mesh.position.x;
    const dy = target.pos.y - w.mesh.position.y;
    const dz = target.pos.z - w.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      w.mesh.position.copy(target.pos);
      w.wait = target.wait || 0;
      w.wpIdx += 1;
      if (w.wpIdx >= w.waypoints.length) {
        disposeObject3D(w.mesh);
        worldAgentsGroup.remove(w.mesh);
        streetWalkers.splice(i, 1);
      }
    } else {
      const move = Math.min(dist, effDt * w.speed);
      w.mesh.position.x += (dx / dist) * move;
      w.mesh.position.z += (dz / dist) * move;
      w.mesh.position.y += dy * Math.min(1, effDt * 8);
      w.mesh.rotation.y = Math.atan2(dx, dz);
      w.phase += effDt * 10;
      w.mesh.userData.legL.rotation.x = Math.sin(w.phase) * 0.48;
      w.mesh.userData.legR.rotation.x = -Math.sin(w.phase) * 0.48;
    }
  }

  for (const s of roamingStaff) {
    if (s.wait > 0) {
      s.wait -= effDt;
      s.mesh.userData.legL.rotation.x = 0;
      s.mesh.userData.legR.rotation.x = 0;
      continue;
    }
    const wp = s.waypoints[s.wpIdx];
    if (!wp) {
      const neighbors = getAdjacentRoomsOf(s.curRoom);
      if (neighbors.length > 0) {
        const nextRoom = neighbors[Math.floor(Math.random() * neighbors.length)];
        s.waypoints = buildDoorwayPath(s.curRoom, nextRoom);
        s.curRoom = nextRoom;
        s.wpIdx = 0;
        s.wait = 0.6 + Math.random() * 1.1;
      } else {
        s.wait = 1.5;
      }
      continue;
    }
    const dx = wp.x - s.mesh.position.x;
    const dz = wp.z - s.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.07) {
      s.mesh.position.x = wp.x;
      s.mesh.position.z = wp.z;
      s.wpIdx += 1;
    } else {
      const stepMove = Math.min(dist, effDt * 1.45);
      s.mesh.position.x += (dx / dist) * stepMove;
      s.mesh.position.z += (dz / dist) * stepMove;
      s.mesh.rotation.y = Math.atan2(dx, dz);
      s.phase += effDt * 11;
      s.mesh.position.y = 0.29 + Math.abs(Math.sin(s.phase)) * 0.05;
      s.mesh.userData.legL.rotation.x = Math.sin(s.phase) * 0.48;
      s.mesh.userData.legR.rotation.x = -Math.sin(s.phase) * 0.48;
    }
  }

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

  const cycleStats = getRoomCycleStats(room, room.level, room.staff, bonuses);
  const out = cycleStats.output;
  const msgs = [];
  if (out.ingredients) { state.ingredients += out.ingredients; msgs.push(`+${out.ingredients} Kho`); bumpStat('pill-ingredients'); }
  if (out.dishes) { state.dishes += out.dishes; msgs.push(`+${out.dishes} Món`); bumpStat('pill-dishes'); }
  if (out.parcels) { state.parcels += out.parcels; msgs.push(`+${out.parcels} Đơn`); bumpStat('pill-parcels'); }
  if (out.coins) {
    state.coins += out.coins;
    state.totalEarned += out.coins;
    state.dailyEarned = (state.dailyEarned || 0) + out.coins;
    msgs.push(`+${out.coins} Xu`);
    bumpStat('pill-coins');
  }
  if (out.rep) { state.rep += out.rep; bumpStat('pill-rep'); }
  if (out.served) state.totalServed += out.served;
  gainExp(cycleStats.expGain);

  // Auto-advance matching live customer ticket when service rooms finish a cycle
  if ((room.type === 'dining' || room.type === 'cafe' || room.type === 'dispatch' || room.type === 'drone_hub') && Array.isArray(state.tickets) && state.tickets.length > 0) {
    const targetRes = (room.type === 'dining' || room.type === 'cafe') ? 'dishes' : 'parcels';
    const match = state.tickets.find(t => t.resource === targetRes);
    if (match) {
      const units = room.type === 'drone_hub' ? 2 : 1;
      match.delivered = (match.delivered || 0) + units;
      if (match.delivered >= match.amount) {
        fulfillTicket(match.id, false, true);
      } else if (typeof renderTicketRail === 'function') {
        renderTicketRail();
      }
    }
  }

  if (msgs.length) spawnFloater(room.gx, room.gy, msgs[0], out.coins ? '#B85524' : '#266E56');
  updateHUD();
  updateContractUI();
  if (selectedPlot) {
    const selRoom = getRoomAt(selectedPlot.gx, selectedPlot.gy);
    if (selRoom) updateSelectedRoomProgressOnly(selRoom);
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

    const canUpgrade = getRoomUpgradeRequirements(entry.room).met;
    if (tag.dataset.canUp !== String(canUpgrade)) {
      tag.dataset.canUp = String(canUpgrade);
      const upEl = tag.querySelector('.room-tag-up');
      if (upEl) upEl.classList.toggle('hidden', !canUpgrade);
    }

    const mergeInfo = getMergedZoneInfo(entry.room);
    const mergeText = mergeInfo.isMerged ? `🔗${mergeInfo.size}ô` : '';
    if (tag.dataset.merge !== mergeText) {
      tag.dataset.merge = mergeText;
      const mergeEl = tag.querySelector('.room-tag-merge');
      if (mergeEl) {
        mergeEl.textContent = mergeText;
        mergeEl.classList.toggle('hidden', !mergeText);
      }
    }

    const syn = getRoomSynergy(entry.room);
    const synPct = syn.speedPct + syn.revenuePct;
    const synText = syn.links.length > 0 ? `⚡+${synPct}%` : '';
    if (tag.dataset.syn !== synText) {
      tag.dataset.syn = synText;
      const synEl = tag.querySelector('.room-tag-syn');
      if (synEl) {
        synEl.textContent = synText;
        synEl.classList.toggle('hidden', !synText);
      }
    }

    const hz = entry.room.hazard;
    const hzState = hz ? `${hz.type}_${Math.ceil(hz.timeLeft)}` : '';
    if (tag.dataset.hz !== hzState) {
      tag.dataset.hz = hzState;
      const hzBtn = tag.querySelector('.room-hazard-btn');
      if (hzBtn) {
        if (hz) {
          hzBtn.textContent = `${hz.icon} ${hz.label} (${Math.max(1, Math.ceil(hz.timeLeft))}s)`;
          hzBtn.classList.remove('hidden');
          hzBtn.classList.toggle('opportunity', !hz.blocking);
        } else {
          hzBtn.classList.add('hidden');
        }
      }
    }
  });

  for (const f of activeFloaters) {
    const sc = worldToScreen(f.pos);
    f.el.style.transform = `translate3d(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
  }
}

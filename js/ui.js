// =========================================================================
// 9. HUD, CONTRACT & INSPECTOR DRAWER
// =========================================================================
function updateRateBadge(id, rate) {
  const el = document.getElementById(id);
  if (!el) return;
  if (Math.abs(rate) < 0.05) {
    el.textContent = '';
    return;
  }
  const sign = rate > 0 ? '+' : '';
  const numStr = Math.abs(rate) >= 10 ? Math.round(rate).toString() : rate.toFixed(1);
  el.textContent = `${sign}${numStr}/s`;
  el.className = rate > 0
    ? 'text-[10px] font-semibold tabular-nums text-emerald-700'
    : 'text-[10px] font-semibold tabular-nums text-amber-700';
}

function updateHUD() {
  const gridSize = getGridSize();
  const maxPlots = gridSize * gridSize;
  document.getElementById('stat-coins').textContent = state.coins.toLocaleString('vi-VN');
  document.getElementById('stat-ingredients').textContent = state.ingredients;
  document.getElementById('stat-dishes').textContent = state.dishes;
  document.getElementById('stat-parcels').textContent = state.parcels;
  document.getElementById('stat-rep').textContent = state.rep;
  document.getElementById('stat-day').textContent = state.day;
  document.getElementById('stat-rooms').textContent = `${state.rooms.length}/${maxPlots}`;
  document.getElementById('stat-total-served').textContent = state.totalServed;
  document.getElementById('stat-total-earned').textContent = `${state.totalEarned.toLocaleString('vi-VN')} Xu`;

  const rates = getNetResourceRates();
  updateRateBadge('rate-coins', rates.coins);
  updateRateBadge('rate-ingredients', rates.ingredients);
  updateRateBadge('rate-dishes', rates.dishes);
  updateRateBadge('rate-parcels', rates.parcels);

  const menu = getActiveMenuConfig();
  const menuIconEl = document.getElementById('menu-icon');
  const menuLabelEl = document.getElementById('menu-label');
  if (menuIconEl) menuIconEl.textContent = menu.icon;
  if (menuLabelEl) menuLabelEl.textContent = menu.name;

  const nextTier = getNextGridTier();
  const expandLabelEl = document.getElementById('expand-label');
  const expandBtn = document.getElementById('btn-expand-grid');
  if (expandLabelEl) {
    expandLabelEl.textContent = nextTier ? `Mở ${nextTier.size}×${nextTier.size}` : `${gridSize}×${gridSize} Max`;
  }
  if (expandBtn && nextTier) {
    const canExpand = state.coins >= nextTier.cost && state.rep >= nextTier.minRep;
    expandBtn.classList.toggle('border-emerald-500/60', canExpand);
  }

  const phase = getCurrentDayPhase();
  const phaseEl = document.getElementById('stat-day-phase');
  if (phaseEl) {
    phaseEl.textContent = phase.label;
    phaseEl.className = phase.isRush
      ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-500/20 text-orange-900 border border-orange-500/30'
      : (phase.id === 'sunset'
        ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/20 text-amber-900'
        : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-stone-500/12 text-stone-700');
  }

  updateTicketMetaBadges();
  if (typeof updateTicketRailProgress === 'function') updateTicketRailProgress();

  const perksBox = document.getElementById('active-perks-box');
  const perksList = document.getElementById('active-perks-list');
  if (perksBox && perksList) {
    const entries = Object.entries(state.perks || {}).filter(([, lv]) => lv > 0);
    perksBox.classList.toggle('hidden', entries.length === 0);
    if (entries.length > 0) {
      perksList.innerHTML = entries.map(([id, lv]) => {
        const card = (GAME_CONFIG.perkCards || []).find(c => c.id === id);
        if (!card) return '';
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-300/70 text-[11px] font-semibold text-stone-800">${card.icon} ${card.name} <strong>Lv.${lv}</strong></span>`;
      }).join('');
    }
  }
}

function updateTicketMetaBadges() {
  const comboEl = document.getElementById('combo-badge');
  const upkeepEl = document.getElementById('upkeep-badge');
  if (comboEl) {
    const mult = getComboMultiplier();
    comboEl.textContent = `🔥 Combo ${mult.toFixed(1)}x`;
    comboEl.className = mult >= 2.0 ? 'text-rose-700 font-extrabold' : (mult > 1.0 ? 'text-amber-700 font-bold' : 'text-stone-600 font-semibold');
  }
  if (upkeepEl) {
    upkeepEl.textContent = `💸 -${getDailyUpkeep()}/ngày`;
  }
}

function renderTicketRail() {
  const rail = document.getElementById('ticket-rail');
  if (!rail) return;
  updateTicketMetaBadges();

  const tickets = state.tickets || [];
  if (!tickets.length) {
    rail.innerHTML = `<div class="hud-glass rounded-xl px-3 py-1.5 text-[11px] text-stone-500">⏳ Đang chờ khách gọi món...</div>`;
    return;
  }

  rail.innerHTML = tickets.map((t) => {
    const rem = Math.max(1, t.amount - (t.delivered || 0));
    const canServe = (state[t.resource] || 0) >= rem;
    const pct = Math.max(0, Math.min(100, Math.round((t.timeLeft / t.maxTime) * 100)));
    const isUrgent = pct <= 25;
    const resIcon = t.resource === 'dishes' ? '🍲' : '📦';
    const progressText = t.delivered > 0 ? `${t.delivered}/${t.amount}` : `${t.amount}`;
    const barColor = isUrgent ? 'bg-rose-500' : (pct <= 55 ? 'bg-amber-500' : 'bg-emerald-600');

    return `
      <button type="button" data-ticket-id="${t.id}" class="order-ticket text-left ${t.vip ? 'vip' : ''} ${canServe ? 'ready' : ''} ${isUrgent ? 'urgent' : ''}" title="Nhấn để phục vụ ngay (+25% Tip)">
        <div class="flex items-center justify-between gap-1.5 text-[11px] font-bold text-stone-900">
          <span class="truncate">${t.icon} ${t.title}</span>
          <span class="ticket-time tabular-nums ${isUrgent ? 'text-rose-600' : 'text-stone-500'}">${Math.max(1, Math.ceil(t.timeLeft))}s</span>
        </div>
        <div class="flex items-center justify-between gap-1.5 mt-1 text-[10.5px]">
          <span class="font-semibold ${canServe ? 'text-emerald-700' : 'text-stone-600'}">${resIcon} ${progressText} ${RESOURCE_LABELS[t.resource] || ''}</span>
          <span class="font-bold text-amber-800">+${t.reward}Xu</span>
        </div>
        <div class="mt-1.5 h-1 bg-stone-900/10 rounded-full overflow-hidden">
          <div class="ticket-bar h-full ${barColor} rounded-full transition-all duration-150" style="width:${pct}%"></div>
        </div>
      </button>
    `;
  }).join('');

  rail.querySelectorAll('[data-ticket-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-ticket-id'));
      fulfillTicket(id, true, false);
    });
  });
}

function updateTicketRailProgress() {
  const rail = document.getElementById('ticket-rail');
  if (!rail) return;
  for (const t of (state.tickets || [])) {
    const el = rail.querySelector(`[data-ticket-id="${t.id}"]`);
    if (!el) continue;
    const pct = Math.max(0, Math.min(100, Math.round((t.timeLeft / t.maxTime) * 100)));
    const isUrgent = pct <= 25;
    const rem = Math.max(1, t.amount - (t.delivered || 0));
    const canServe = (state[t.resource] || 0) >= rem;

    el.classList.toggle('urgent', isUrgent);
    el.classList.toggle('ready', canServe);
    const timeEl = el.querySelector('.ticket-time');
    if (timeEl) {
      timeEl.textContent = `${Math.max(1, Math.ceil(t.timeLeft))}s`;
      timeEl.className = `ticket-time tabular-nums ${isUrgent ? 'text-rose-600' : 'text-stone-500'}`;
    }
    const barEl = el.querySelector('.ticket-bar');
    if (barEl) {
      barEl.style.width = `${pct}%`;
      barEl.className = `ticket-bar h-full rounded-full transition-all duration-150 ${isUrgent ? 'bg-rose-500' : (pct <= 55 ? 'bg-amber-500' : 'bg-emerald-600')}`;
    }
  }
}

let wasPausedBeforeSummary = false;

function openDaySummaryModal(dayReport, choices) {
  const modalEl = document.getElementById('day-summary-modal');
  if (!modalEl) return;

  wasPausedBeforeSummary = isPaused;
  isPaused = true;

  document.getElementById('summary-day-num').textContent = dayReport.day;
  document.getElementById('summary-orders').textContent = `Hoàn thành ${dayReport.completed} đơn · Khách bỏ về ${dayReport.failed}`;

  const stars = (dayReport.failed === 0 && dayReport.netProfit >= 0) ? '⭐⭐⭐' : (dayReport.failed <= 1 ? '⭐⭐' : '⭐');
  document.getElementById('summary-stars').textContent = stars;

  document.getElementById('sum-gross').textContent = `+${dayReport.grossSales.toLocaleString('vi-VN')} Xu`;
  document.getElementById('sum-tips').textContent = `+${dayReport.tips.toLocaleString('vi-VN')} Xu`;
  document.getElementById('sum-upkeep').textContent = `-${(dayReport.upkeep + dayReport.penalties).toLocaleString('vi-VN')} Xu`;

  const netEl = document.getElementById('sum-net');
  netEl.textContent = `${dayReport.netProfit >= 0 ? '+' : ''}${dayReport.netProfit.toLocaleString('vi-VN')} Xu`;
  netEl.className = dayReport.netProfit >= 0 ? 'font-extrabold text-emerald-700 tabular-nums' : 'font-extrabold text-rose-700 tabular-nums';

  const autoCb = document.getElementById('toggle-auto-day');
  if (autoCb) autoCb.checked = !!state.autoNextDay;

  const choicesBox = document.getElementById('summary-perk-choices');
  choicesBox.innerHTML = choices.map((c) => {
    const curLv = getPerkBonus(c.id);
    return `
      <button type="button" data-pick-perk="${c.id}" class="perk-card flex flex-col justify-between gap-2">
        <div>
          <div class="flex items-center justify-between gap-1.5">
            <span class="text-xl">${c.icon}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">${curLv > 0 ? `Cấp ${curLv} → ${curLv + 1}` : 'Mới'}</span>
          </div>
          <div class="font-bold text-xs text-stone-900 mt-1.5">${c.name}</div>
          <p class="text-[11px] text-stone-500 mt-1 leading-snug">${c.desc}</p>
        </div>
        <div class="text-[11px] font-bold text-amber-800 pt-1.5 border-t border-stone-100">Chọn đặc quyền →</div>
      </button>
    `;
  }).join('');

  choicesBox.querySelectorAll('[data-pick-perk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeDaySummaryModal(btn.getAttribute('data-pick-perk'));
    });
  });

  modalEl.classList.remove('hidden');
  modalEl.classList.add('flex');
}

function closeDaySummaryModal(chosenPerkId) {
  const modalEl = document.getElementById('day-summary-modal');
  if (chosenPerkId) {
    const picked = applyPerkCard(chosenPerkId);
    if (picked) {
      if (typeof SoundFX !== 'undefined') SoundFX.reward();
      showToast(`✨ Đã kích hoạt đặc quyền: ${picked.icon} ${picked.name}!`);
    }
  }
  if (modalEl) {
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
  }
  isPaused = wasPausedBeforeSummary;
  updateHUD();
  updateContractUI();
  if (selectedPlot) renderDrawer();
  saveGame(false);
}

function getContractMetricValue(metric) {
  return metric === 'roomCount' ? state.rooms.length : (state[metric] || 0);
}

function updateExpressOrderUI() {
  const box = document.getElementById('express-box');
  if (!box) return;
  const o = state.expressOrder;
  if (!o) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  const have = state[o.resource] || 0;
  const resLabel = RESOURCE_LABELS[o.resource] || o.resource;
  document.getElementById('express-timer').textContent = `${Math.max(0, Math.ceil(o.timeLeft))}s`;
  document.getElementById('express-title').textContent = o.title;
  document.getElementById('express-desc').textContent = `Giao ${o.amount} ${resLabel} (Có ${have}/${o.amount})`;
  document.getElementById('express-reward').textContent = `+${o.reward} Xu · +${o.rep}★`;
  const pct = Math.max(0, Math.min(100, Math.round((o.timeLeft / o.maxTime) * 100)));
  document.getElementById('express-bar').style.width = `${pct}%`;
  document.getElementById('btn-claim-express').disabled = have < o.amount;
}

function updateContractUI() {
  const c = getActiveContract();
  if (!c) {
    document.getElementById('contract-title').textContent = 'Khu phức hợp thịnh vượng';
    document.getElementById('contract-desc').textContent = 'Bạn đã hoàn thành toàn bộ đơn hàng khởi đầu. Tự do mở rộng theo ý thích!';
    document.getElementById('contract-reward').textContent = 'Tự do';
    document.getElementById('contract-bar').style.width = '100%';
    document.getElementById('contract-progress').textContent = '✓';
    document.getElementById('btn-claim-contract').classList.add('hidden');
    updateExpressOrderUI();
    return;
  }
  const cur = getContractMetricValue(c.metric);
  const pct = Math.min(100, Math.round((cur / c.target) * 100));
  document.getElementById('contract-title').textContent = c.title;
  document.getElementById('contract-desc').textContent = c.desc;
  document.getElementById('contract-reward').textContent = `+${c.reward} Xu`;
  document.getElementById('contract-bar').style.width = `${pct}%`;
  document.getElementById('contract-progress').textContent = `${Math.min(cur, c.target)}/${c.target}`;
  document.getElementById('btn-claim-contract').classList.toggle('hidden', cur < c.target);
  updateExpressOrderUI();
}

function openInspector(gx, gy) {
  selectedPlot = { gx, gy };
  confirmDemolishKey = null;
  updatePlotHighlights();
  rebuildSynergyLines3D();
  renderDrawer();
}

function closeInspector() {
  selectedPlot = null;
  confirmDemolishKey = null;
  relocateSource = null;
  updatePlotHighlights();
  rebuildSynergyLines3D();
  document.getElementById('inspector-drawer').classList.add('hidden');
}

function updateSelectedRoomProgressOnly(room) {
  const bar = document.getElementById('drawer-room-progress');
  if (bar) bar.style.width = `${Math.min(100, Math.round(room.progress * 100))}%`;

  const statusBox = document.getElementById('drawer-room-status');
  if (statusBox) {
    const missing = getMissingInputInfo(room);
    const curStats = getRoomCycleStats(room);
    if (missing) {
      statusBox.className = 'text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300/80 rounded-xl px-2.5 py-1.5';
      statusBox.textContent = `⚠️ Đang tạm dừng: ${missing.label} (Cần ${missing.needed}, hiện có ${missing.current})`;
    } else {
      statusBox.className = 'text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 rounded-xl px-2.5 py-1.5';
      statusBox.textContent = `✅ Đang vận hành · Chu kỳ ${curStats.cycleSec.toFixed(1)}s`;
    }
  }
}

function renderDrawer() {
  if (!selectedPlot) return;
  const { gx, gy } = selectedPlot;
  const drawer = document.getElementById('inspector-drawer');
  const body = document.getElementById('drawer-body');
  const room = getRoomAt(gx, gy);
  drawer.classList.remove('hidden');

  if (!room) {
    document.getElementById('drawer-icon').textContent = '🏗️';
    document.getElementById('drawer-title').textContent = 'Xây phân khu mới';
    document.getElementById('drawer-subtitle').textContent = `Ô đất trống (${gx + 1}, ${gy + 1})`;

    let html = `<p class="text-xs text-stone-500">Chọn một bộ phận nhà hàng hoặc logistics để mở rộng trên ô đất này:</p><div class="space-y-2.5">`;
    for (const cfg of Object.values(GAME_CONFIG.rooms)) {
      const canAfford = state.coins >= cfg.cost;
      const syn = getRoomSynergy(null, gx, gy, cfg.id);
      const synBadge = syn.links.length > 0
        ? `<div class="text-[10.5px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 rounded-xl px-2 py-1">✨ Liên kết tại ô này: ${syn.links.map(l => l.label).join(' · ')}</div>`
        : '';
      html += `
        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center text-base border border-stone-900/10" style="background:${cfg.floorTint}">${cfg.icon}</div>
              <div>
                <div class="font-bold text-xs text-stone-900">${cfg.name}</div>
                <span class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">${cfg.category}</span>
              </div>
            </div>
            <span class="text-xs font-bold ${canAfford ? 'text-amber-800' : 'text-stone-400'}">${cfg.cost} Xu</span>
          </div>
          <p class="text-[11px] text-stone-600 leading-snug">${cfg.desc}</p>
          ${synBadge}
          <div class="flex items-center justify-between pt-1.5 border-t border-stone-100">
            <span class="text-[11px] font-semibold text-emerald-700">${cfg.effectText}</span>
            <button data-build="${cfg.id}" class="btn-primary px-3 py-1 rounded-xl text-xs font-bold" ${canAfford ? '' : 'disabled'}>Xây ngay</button>
          </div>
        </div>
      `;
    }
    html += `</div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-build]').forEach(btn => {
      btn.addEventListener('click', () => buildRoom(gx, gy, btn.getAttribute('data-build')));
    });
  } else {
    const cfg = GAME_CONFIG.rooms[room.type];
    const upCost = getUpgradeCost(room);
    const staffCost = getStaffCost(room);
    const canUp = room.level < GAME_CONFIG.MAX_LEVEL && state.coins >= upCost;
    const canStaff = room.staff < GAME_CONFIG.MAX_STAFF_PER_ROOM && state.coins >= staffCost;
    const bonuses = getGlobalBonuses();
    const refund = Math.round(cfg.cost * 0.6);
    const key = `${gx}_${gy}`;

    const curStats = getRoomCycleStats(room, room.level, room.staff, bonuses);
    const nextLvStats = room.level < GAME_CONFIG.MAX_LEVEL
      ? getRoomCycleStats(room, room.level + 1, room.staff, bonuses)
      : null;
    const nextStaffStats = room.staff < GAME_CONFIG.MAX_STAFF_PER_ROOM
      ? getRoomCycleStats(room, room.level, room.staff + 1, bonuses)
      : null;
    const missing = getMissingInputInfo(room);

    const statusClass = missing
      ? 'text-amber-800 bg-amber-50 border-amber-300/80'
      : 'text-emerald-800 bg-emerald-50 border-emerald-200/70';
    const statusText = missing
      ? `⚠️ Đang tạm dừng: ${missing.label} (Cần ${missing.needed}, hiện có ${missing.current})`
      : `✅ Đang vận hành · Chu kỳ ${curStats.cycleSec.toFixed(1)}s`;

    const upgradeDesc = nextLvStats
      ? `Lên Lv.${room.level + 1}: ${formatRoomOutput(curStats.output)} → ${formatRoomOutput(nextLvStats.output)} · Chu kỳ ${curStats.cycleSec.toFixed(1)}s → ${nextLvStats.cycleSec.toFixed(1)}s`
      : 'Đã đạt cấp tối đa';

    const staffDesc = nextStaffStats
      ? `Hiện có ${room.staff} người: ${formatRoomOutput(curStats.output)} → ${formatRoomOutput(nextStaffStats.output)} (+1 nhân sự 3D)`
      : 'Đã đủ nhân sự';

    const synLinks = curStats.synergy ? curStats.synergy.links : [];
    const synRules = (GAME_CONFIG.synergies && GAME_CONFIG.synergies[room.type]) || [];
    let synergyHtml = '';
    if (synLinks.length > 0) {
      synergyHtml = `
        <div class="bg-orange-50/90 border border-orange-200/80 rounded-2xl p-3 space-y-1">
          <div class="text-[10.5px] font-bold text-amber-900 uppercase tracking-wide">⚡ Liên kết liền kề đang bật</div>
          ${synLinks.map(l => `<div class="text-[11.5px] font-semibold text-emerald-800">• ${l.label}</div>`).join('')}
        </div>
      `;
    } else if (synRules.length > 0) {
      const hints = synRules.map(r => GAME_CONFIG.rooms[r.withType]?.name).filter(Boolean);
      synergyHtml = `
        <div class="bg-stone-50 border border-stone-200/70 rounded-2xl p-2.5 text-[11px] text-stone-600">
          💡 <strong class="text-stone-800">Mẹo vị trí:</strong> Đặt cạnh <strong>${hints.join(' hoặc ')}</strong> để nhận thưởng liền kề.
        </div>
      `;
    }
    const isRelocating = relocateSource && relocateSource.gx === gx && relocateSource.gy === gy;
    const activeMenu = getActiveMenuConfig();
    const menuHtml = (room.type === 'kitchen' || room.type === 'dining' || room.type === 'packing' || room.type === 'dispatch' || room.type === 'drone_hub')
      ? `<div class="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-2.5 flex items-center justify-between gap-2">
           <span class="text-[11px] text-amber-900">Thực đơn: <strong>${activeMenu.icon} ${activeMenu.name}</strong></span>
           <button id="btn-drawer-menu" class="btn-ghost px-2 py-1 rounded-lg text-[10.5px] font-bold">Đổi</button>
         </div>`
      : '';
    const hazardHtml = room.hazard
      ? `<div class="bg-rose-50 border border-rose-300 rounded-2xl p-2.5 flex items-center justify-between gap-2">
           <span class="text-[11px] font-bold text-rose-800">${room.hazard.icon} ${room.hazard.label} (${Math.max(1, Math.ceil(room.hazard.timeLeft))}s)</span>
           <button id="btn-resolve-hazard" class="btn-primary px-2.5 py-1 rounded-lg text-[10.5px] font-bold">Xử lý</button>
         </div>`
      : '';
    const activePerkEntries = Object.entries(state.perks || {}).filter(([, lv]) => lv > 0);
    const perksHtml = activePerkEntries.length > 0
      ? `<div class="bg-stone-50 border border-stone-200/70 rounded-2xl p-2.5 space-y-1">
           <div class="text-[10px] font-bold uppercase tracking-wider text-stone-500">✨ Đặc quyền đang bật</div>
           <div class="flex flex-wrap gap-1">${activePerkEntries.map(([id, lv]) => {
             const card = (GAME_CONFIG.perkCards || []).find(c => c.id === id);
             return card ? `<span class="px-1.5 py-0.5 rounded-full bg-white border border-stone-200 text-[10px] font-semibold text-stone-700">${card.icon} Lv.${lv}</span>` : '';
           }).join('')}</div>
         </div>`
      : '';

    document.getElementById('drawer-icon').textContent = cfg.icon;
    document.getElementById('drawer-title').textContent = `${cfg.name} · Lv.${room.level}`;
    document.getElementById('drawer-subtitle').textContent = `${cfg.category} · ${room.staff}/${GAME_CONFIG.MAX_STAFF_PER_ROOM} nhân sự`;

    body.innerHTML = `
      ${hazardHtml}
      <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 space-y-2.5">
        <p class="text-xs text-stone-600 leading-relaxed">${cfg.desc}</p>
        <div id="drawer-room-status" class="text-xs font-semibold border rounded-xl px-2.5 py-1.5 ${statusClass}">
          ${statusText}
        </div>
        <div class="text-[11.5px] text-stone-700 bg-stone-50 border border-stone-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span class="text-stone-500">Sản lượng thực tế:</span>
          <span class="font-bold text-stone-900">${formatRoomOutput(curStats.output)}</span>
        </div>
        <div>
          <div class="flex justify-between text-[11px] text-stone-500 mb-1">
            <span>Tiến độ chu kỳ</span>
            <span>Tốc độ +${bonuses.speedPct}%</span>
          </div>
          <div class="h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div id="drawer-room-progress" class="h-full bg-amber-600 rounded-full transition-all duration-100" style="width: ${Math.round(room.progress * 100)}%"></div>
          </div>
        </div>
        <button id="btn-boost-room" class="btn-ghost w-full py-2 rounded-xl text-xs font-bold">
          Hỗ trợ vận hành (+35% tiến độ)
        </button>
      </div>

      ${synergyHtml}
      ${menuHtml}
      ${perksHtml}

      <div class="space-y-2">
        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-stone-900">Nâng cấp thiết bị</div>
            <div class="text-[11px] text-stone-500 leading-snug mt-0.5">${upgradeDesc}</div>
          </div>
          <button id="btn-upgrade-room" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0" ${canUp ? '' : 'disabled'}>
            ${room.level >= GAME_CONFIG.MAX_LEVEL ? 'Tối đa' : `${upCost} Xu`}
          </button>
        </div>

        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-stone-900">Thuê thêm nhân viên</div>
            <div class="text-[11px] text-stone-500 leading-snug mt-0.5">${staffDesc}</div>
          </div>
          <button id="btn-hire-staff" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0" ${canStaff ? '' : 'disabled'}>
            ${room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM ? 'Đủ' : `${staffCost} Xu`}
          </button>
        </div>
      </div>

      <button id="btn-relocate-room" class="btn-ghost w-full py-2 rounded-xl text-xs font-bold ${isRelocating ? 'active' : ''}">
        ${isRelocating ? '❌ Hủy chọn ô đích (Nhấn lên bản đồ)' : '🔄 Di dời / Đổi vị trí (Miễn phí)'}
      </button>

      <div class="pt-2 border-t border-stone-200/80 flex items-center justify-between">
        <span class="text-[11px] text-stone-500">Hoàn lại ${refund} Xu khi tháo dỡ</span>
        <button id="btn-demolish-room" class="px-3 py-1.5 rounded-xl text-xs font-semibold ${confirmDemolishKey === key ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'}">
          ${confirmDemolishKey === key ? 'Xác nhận tháo dỡ?' : 'Tháo dỡ'}
        </button>
      </div>
    `;

    document.getElementById('btn-boost-room').addEventListener('click', () => {
      SoundFX.click();
      room.progress += 0.35;
      if (room.progress >= 1) {
        room.progress -= 1;
        completeRoomCycle(room, getGlobalBonuses());
      }
      updateSelectedRoomProgressOnly(room);
    });

    const drawerMenuBtn = document.getElementById('btn-drawer-menu');
    if (drawerMenuBtn) {
      drawerMenuBtn.addEventListener('click', () => {
        if (typeof openSystemModal === 'function') openSystemModal('tab-expansion');
      });
    }

    const hazardBtn = document.getElementById('btn-resolve-hazard');
    if (hazardBtn) {
      hazardBtn.addEventListener('click', () => resolveRoomHazard(gx, gy));
    }

    document.getElementById('btn-relocate-room').addEventListener('click', () => {
      SoundFX.click();
      if (relocateSource && relocateSource.gx === gx && relocateSource.gy === gy) {
        relocateSource = null;
      } else {
        relocateSource = { gx, gy };
        showToast('Chọn một ô đất bất kỳ trên bản đồ để di dời hoặc đổi chỗ!');
      }
      updatePlotHighlights();
      renderDrawer();
    });

    document.getElementById('btn-upgrade-room').addEventListener('click', () => {
      if (room.level >= GAME_CONFIG.MAX_LEVEL || state.coins < upCost) return;
      state.coins -= upCost;
      room.level += 1;
      triggerRoomPop(room.gx, room.gy);
      rebuildRooms3D();
      SoundFX.upgrade();
      spawnFloater(room.gx, room.gy, `Lên Lv.${room.level}`, '#B85524');
      showToast(`Đã nâng cấp ${cfg.name} lên Lv.${room.level}!`);
      updateHUD();
      renderDrawer();
      saveGame(false);
    });

    document.getElementById('btn-hire-staff').addEventListener('click', () => {
      if (room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM || state.coins < staffCost) return;
      state.coins -= staffCost;
      room.staff += 1;
      rebuildRooms3D();
      SoundFX.upgrade();
      spawnFloater(room.gx, room.gy, '+1 Nhân sự', '#266E56');
      showToast(`Đã tuyển thêm nhân viên cho ${cfg.name}!`);
      updateHUD();
      renderDrawer();
      saveGame(false);
    });

    document.getElementById('btn-demolish-room').addEventListener('click', () => {
      if (state.rooms.length <= 1) {
        showToast('Cần giữ lại ít nhất 1 phân khu hoạt động!');
        return;
      }
      if (confirmDemolishKey !== key) {
        confirmDemolishKey = key;
        renderDrawer();
        return;
      }
      state.coins += refund;
      state.rooms = state.rooms.filter(r => !(r.gx === gx && r.gy === gy));
      confirmDemolishKey = null;
      relocateSource = null;
      rebuildRooms3D();
      SoundFX.click();
      showToast(`Đã tháo dỡ ${cfg.name} (+${refund} Xu)`);
      updateHUD();
      updateContractUI();
      renderDrawer();
      saveGame(false);
    });
  }
}

function buildRoom(gx, gy, typeId) {
  const cfg = GAME_CONFIG.rooms[typeId];
  if (!cfg || getRoomAt(gx, gy) || state.coins < cfg.cost) return;
  state.coins -= cfg.cost;
  state.rooms.push({ gx, gy, type: typeId, level: 1, staff: 1, progress: 0 });
  triggerRoomPop(gx, gy);
  rebuildRooms3D();
  SoundFX.build();
  spawnFloater(gx, gy, `Khai trương ${cfg.name}`, '#266E56');
  showToast(`Đã xây dựng ${cfg.name}!`);
  updateHUD();
  updateContractUI();
  renderDrawer();
  saveGame(false);
}

function renderExpansionPanel() {
  const gridCard = document.getElementById('expansion-grid-card');
  const menuList = document.getElementById('expansion-menu-list');
  if (!gridCard || !menuList) return;

  const curSize = getGridSize();
  const nextTier = getNextGridTier();
  if (!nextTier) {
    gridCard.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-bold text-stone-900">Quỹ đất hiện tại: ${curSize}×${curSize} (${curSize * curSize} ô)</div>
          <div class="text-[11px] text-emerald-700 mt-0.5">Đã mở rộng tối đa diện tích khu phức hợp!</div>
        </div>
        <span class="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">Tối đa</span>
      </div>
    `;
  } else {
    const hasCoins = state.coins >= nextTier.cost;
    const hasRep = state.rep >= nextTier.minRep;
    gridCard.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="font-bold text-stone-900">Mở rộng Quỹ đất: ${curSize}×${curSize} → ${nextTier.label}</div>
          <div class="text-[11px] text-stone-500 mt-0.5">Yêu cầu: <strong class="${hasCoins ? 'text-amber-800' : 'text-red-600'}">${nextTier.cost.toLocaleString('vi-VN')} Xu</strong> & <strong class="${hasRep ? 'text-emerald-700' : 'text-red-600'}">${nextTier.minRep} Uy tín</strong></div>
        </div>
        <button id="btn-do-expand-grid" class="btn-primary px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap" ${(hasCoins && hasRep) ? '' : 'disabled'}>
          Mở rộng ngay
        </button>
      </div>
    `;
    const expandActionBtn = document.getElementById('btn-do-expand-grid');
    if (expandActionBtn) {
      expandActionBtn.addEventListener('click', () => {
        if (state.coins < nextTier.cost || state.rep < nextTier.minRep) return;
        state.coins -= nextTier.cost;
        state.gridSize = nextTier.size;
        buildGroundGrid();
        rebuildRooms3D();
        resetCamera();
        SoundFX.build();
        showToast(`🗺️ Đã mở rộng khu đất lên ${nextTier.label}!`);
        updateHUD();
        updateContractUI();
        renderExpansionPanel();
        saveGame(false);
      });
    }
  }

  const activeId = getActiveMenuConfig().id;
  menuList.innerHTML = Object.values(GAME_CONFIG.menus || {}).map((m) => {
    const unlocked = state.rep >= m.unlockRep;
    const isActive = m.id === activeId;
    return `
      <div class="bg-white border ${isActive ? 'border-amber-600 ring-1 ring-amber-500/30' : 'border-stone-200/80'} rounded-2xl p-3 flex flex-col justify-between gap-2">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-stone-900">${m.icon} ${m.name}</span>
            <span class="text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${unlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}">
              ${unlocked ? (isActive ? 'Đang phục vụ' : 'Đã mở khóa') : `Cần ${m.unlockRep}★`}
            </span>
          </div>
          <p class="text-[11px] text-stone-500 mt-1 leading-snug">${m.desc}</p>
        </div>
        <button data-select-menu="${m.id}" class="${isActive ? 'btn-ghost active' : 'btn-primary'} w-full py-1.5 rounded-xl text-[11px] font-bold" ${(!unlocked || isActive) ? 'disabled' : ''}>
          ${isActive ? '✓ Đang áp dụng' : (unlocked ? 'Chọn thực đơn này' : `Mở khóa ở ${m.unlockRep} Uy tín`)}
        </button>
      </div>
    `;
  }).join('');

  menuList.querySelectorAll('[data-select-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const menuId = btn.getAttribute('data-select-menu');
      const cfg = GAME_CONFIG.menus[menuId];
      if (!cfg || state.rep < cfg.unlockRep) return;
      state.activeMenu = menuId;
      SoundFX.upgrade();
      showToast(`${cfg.icon} Đã chuyển thực đơn sang ${cfg.name}!`);
      updateHUD();
      renderExpansionPanel();
      if (selectedPlot) renderDrawer();
      saveGame(false);
    });
  });
}

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
  document.getElementById('stat-ingredients').textContent = `${state.ingredients}/${getIngredientCap()}`;
  document.getElementById('stat-dishes').textContent = state.dishes;
  document.getElementById('stat-parcels').textContent = state.parcels;
  document.getElementById('stat-rep').textContent = state.rep;
  document.getElementById('stat-day').textContent = state.day;
  document.getElementById('stat-rooms').textContent = `${state.rooms.length}/${maxPlots}`;
  document.getElementById('stat-total-served').textContent = state.totalServed;
  document.getElementById('stat-total-earned').textContent = `${state.totalEarned.toLocaleString('vi-VN')} Xu`;

  const curLv = state.playerLevel || 1;
  const nextExp = getExpForNextLevel(curLv);
  const expPct = Math.max(0, Math.min(100, Math.round(((state.exp || 0) / nextExp) * 100)));
  const lvEl = document.getElementById('stat-level');
  const expEl = document.getElementById('stat-exp');
  const expBarEl = document.getElementById('stat-exp-bar');
  if (lvEl) lvEl.textContent = curLv;
  if (expEl) expEl.textContent = `${state.exp || 0}/${nextExp} EXP`;
  if (expBarEl) expBarEl.style.width = `${expPct}%`;

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
    const canExpand = state.coins >= nextTier.cost && state.rep >= nextTier.minRep && curLv >= (nextTier.unlockLevel || 1);
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
    const st = getRoomStatusInfo(room);
    statusBox.className = `text-xs font-semibold border rounded-xl px-2.5 py-1.5 ${st.cls}`;
    statusBox.textContent = st.text;
  }
  updateKitchenPanel();
}

function getRoomStatusInfo(room) {
  const okCls = 'text-emerald-800 bg-emerald-50 border-emerald-200/70';
  const warnCls = 'text-amber-800 bg-amber-50 border-amber-300/80';
  if (isVenueRoom(room)) {
    const occ = getVenueOccupancy(room);
    const text = `🪑 ${occ.seated}/${occ.seats} ghế có khách · ${occ.queued} khách đang chờ`;
    return room.starved
      ? { cls: warnCls, text: `${text} · ⚠️ Bếp chưa kịp món` }
      : { cls: okCls, text };
  }
  const missing = getMissingInputInfo(room);
  if (missing) {
    return { cls: warnCls, text: `⚠️ Đang tạm dừng: ${missing.label} (${missing.detail || `Cần ${missing.needed}, hiện có ${missing.current}`})` };
  }
  if (isStorageRoom(room) && (state.ingredients || 0) >= getIngredientCap()) {
    return { cls: okCls, text: `✅ Kho đã đầy ${state.ingredients}/${getIngredientCap()}, tạm ngừng nhập hàng` };
  }
  if (room.type === 'kitchen' && (state.dishes || 0) >= getDishCounterCap()) {
    return { cls: okCls, text: `✅ Quầy đã đủ ${state.dishes} bát, bếp chờ khách gọi thêm` };
  }
  return { cls: okCls, text: `✅ Đang vận hành · Chu kỳ ${getRoomCycleStats(room).cycleSec.toFixed(1)}s` };
}

function getKitchenPanelHtml() {
  return `
    <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 space-y-2.5">
      <div class="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">Nồi nước dùng & bồn rửa</div>
      <div>
        <div class="flex justify-between text-[11px] text-stone-600 mb-1">
          <span>🍲 Nước dùng</span><span id="kp-broth-text" class="font-bold text-stone-900"></span>
        </div>
        <div class="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div id="kp-broth-bar" class="h-full bg-amber-600 rounded-full transition-all duration-150"></div></div>
      </div>
      <div>
        <div class="flex justify-between text-[11px] text-stone-600 mb-1">
          <span>🧽 Bát bẩn trong bồn</span><span id="kp-sink-text" class="font-bold text-stone-900"></span>
        </div>
        <div class="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div id="kp-sink-bar" class="h-full bg-sky-600 rounded-full transition-all duration-150"></div></div>
      </div>
      <div class="text-[11px] text-stone-500" id="kp-counter-text"></div>
      <div class="text-[11px] text-stone-500" id="kp-washer-text"></div>
      <div class="grid grid-cols-2 gap-2">
        <button id="btn-kp-broth" class="btn-ghost py-1.5 rounded-xl text-[11px] font-bold">Ninh nồi mới (${GAME_CONFIG.restaurant.broth.ingredientCost} Kho)</button>
        <button id="btn-kp-wash" class="btn-ghost py-1.5 rounded-xl text-[11px] font-bold">Rửa ${GAME_CONFIG.restaurant.sink.washPerTap} bát</button>
        <button id="btn-kp-washer" class="btn-primary col-span-2 py-1.5 rounded-xl text-[11px] font-bold">🧽 Thuê người rửa bát (${GAME_CONFIG.staff.washerCost} Xu)</button>
      </div>
    </div>`;
}

function updateKitchenPanel() {
  const brothText = document.getElementById('kp-broth-text');
  if (!brothText) return;
  const cap = getBrothCap();
  const broth = Math.floor(state.broth || 0);
  brothText.textContent = state.brothCooking > 0
    ? `${broth}/${cap} bát · nồi mới sau ${Math.ceil(state.brothCooking)}s`
    : `${broth}/${cap} bát`;
  document.getElementById('kp-broth-bar').style.width = `${Math.min(100, Math.round((broth / cap) * 100))}%`;
  const sinkCap = getSinkCap();
  const dirty = Math.ceil(state.dirtyBowls || 0);
  document.getElementById('kp-sink-text').textContent = `${dirty}/${sinkCap}`;
  const sinkBar = document.getElementById('kp-sink-bar');
  sinkBar.style.width = `${Math.min(100, Math.round((dirty / sinkCap) * 100))}%`;
  sinkBar.classList.toggle('bg-rose-500', dirty >= sinkCap);
  document.getElementById('kp-counter-text').textContent = `Quầy ra món: ${state.dishes || 0}/${getDishCounterCap()} bát sẵn sàng`;
  const brothBtn = document.getElementById('btn-kp-broth');
  brothBtn.disabled = state.brothCooking > 0 || broth >= cap || (state.ingredients || 0) < GAME_CONFIG.restaurant.broth.ingredientCost;
  document.getElementById('btn-kp-wash').disabled = dirty <= 0;
  const washers = getWasherCount();
  const maxW = GAME_CONFIG.staff.maxWashersPerKitchen * getKitchenRooms().length;
  document.getElementById('kp-washer-text').textContent = washers > 0
    ? `Người rửa bát: ${washers}/${maxW} · rửa ${(getAwakeWasherCount() * GAME_CONFIG.staff.washerBowlsPerSec * 60).toFixed(0)} bát/phút`
    : 'Chưa có người rửa bát riêng, đầu bếp rửa tranh thủ rất chậm.';
  const washerBtn = document.getElementById('btn-kp-washer');
  washerBtn.disabled = washers >= maxW || state.coins < GAME_CONFIG.staff.washerCost;
  washerBtn.textContent = washers >= maxW ? '🧽 Đã đủ người rửa bát' : `🧽 Thuê người rửa bát (${GAME_CONFIG.staff.washerCost} Xu)`;
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
    const isFrontStreet = gy === getGridSize() - 1;
    document.getElementById('drawer-subtitle').textContent = `Ô đất trống (${gx + 1}, ${gy + 1})${isFrontStreet ? ' · Mặt tiền Phố' : ''}`;

    let html = `<p class="text-xs text-stone-500">Chọn phân khu xây dựng (đặt 2 phòng <strong>cùng loại</strong> sát nhau sẽ <strong>xóa tường gộp ô</strong>; khác loại sẽ <strong>mở cửa thông phòng</strong>):</p><div class="space-y-2.5">`;
    for (const cfg of Object.values(GAME_CONFIG.rooms)) {
      const unlocked = isRoomUnlocked(cfg.id);
      const reqLv = cfg.unlockLevel || 1;
      const canAfford = unlocked && state.coins >= cfg.cost;
      const syn = getRoomSynergy(null, gx, gy, cfg.id);
      const adjSame = state.rooms.filter(r => r.type === cfg.id && Math.abs(r.gx - gx) + Math.abs(r.gy - gy) === 1);
      const adjDiff = state.rooms.filter(r => r.type !== cfg.id && Math.abs(r.gx - gx) + Math.abs(r.gy - gy) === 1);

      const mergePreviewBadge = adjSame.length > 0
        ? `<div class="text-[10.5px] font-bold text-teal-900 bg-teal-50 border border-teal-300/80 rounded-xl px-2 py-1">🔗 Sẽ xóa tường gộp ô với ${cfg.name} cạnh bên (+16% sản lượng & +10% tốc độ)</div>`
        : (adjDiff.length > 0
          ? `<div class="text-[10px] font-medium text-stone-600 bg-stone-50 border border-stone-200/70 rounded-xl px-2 py-1">🚪 Sẽ mở ${adjDiff.length} cửa thông phòng cho nhân viên qua lại</div>`
          : '');

      const synBadge = syn.links.length > 0
        ? `<div class="text-[10.5px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 rounded-xl px-2 py-1">✨ Liên kết tại ô này: ${syn.links.map(l => l.label).join(' · ')}</div>`
        : '';
      const lockBadge = !unlocked
        ? `<span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">🔒 Mở ở Cấp ${reqLv}</span>`
        : '';

      html += `
        <div class="bg-white/90 border ${unlocked ? 'border-stone-200/80' : 'border-stone-200/60 opacity-75'} rounded-2xl p-3 flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center text-base border border-stone-900/10" style="background:${cfg.floorTint}">${cfg.icon}</div>
              <div>
                <div class="font-bold text-xs text-stone-900">${cfg.name}</div>
                <div class="flex flex-wrap items-center gap-1 mt-0.5">
                  <span class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">${cfg.category}</span>
                  ${lockBadge}
                </div>
              </div>
            </div>
            <span class="text-xs font-bold ${canAfford ? 'text-amber-800' : 'text-stone-400'}">${cfg.cost.toLocaleString('vi-VN')} Xu</span>
          </div>
          <p class="text-[11px] text-stone-600 leading-snug">${cfg.desc}</p>
          ${mergePreviewBadge}
          ${synBadge}
          <div class="flex items-center justify-between pt-1.5 border-t border-stone-100 gap-2">
            <span class="text-[10.5px] font-semibold text-emerald-700">${cfg.effectText} · +${cfg.expPerCycle || 8} EXP</span>
            <button data-build="${cfg.id}" class="btn-primary px-3 py-1 rounded-xl text-xs font-bold shrink-0" ${canAfford ? '' : 'disabled'}>
              ${unlocked ? 'Xây ngay' : `Cấp ${reqLv}`}
            </button>
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
    const upReq = getRoomUpgradeRequirements(room);
    const staffCost = getStaffCost(room);
    const canUp = upReq.met;
    const canStaff = room.staff < GAME_CONFIG.MAX_STAFF_PER_ROOM && state.coins >= staffCost;
    const bonuses = getGlobalBonuses();
    const refund = Math.round(cfg.cost * 0.6);
    const key = `${gx}_${gy}`;

    const curStats = getRoomCycleStats(room, room.level, room.staff, bonuses);
    const nextLvStats = getRoomCycleStats(room, room.level + 1, room.staff, bonuses);
    const nextStaffStats = room.staff < GAME_CONFIG.MAX_STAFF_PER_ROOM
      ? getRoomCycleStats(room, room.level, room.staff + 1, bonuses)
      : null;
    const missing = getMissingInputInfo(room);

    const isVenue = isVenueRoom(room);
    const roomStatus = getRoomStatusInfo(room);
    const statusClass = roomStatus.cls;
    const statusText = roomStatus.text;

    const upgradeDesc = isVenue
      ? `Lên Lv.${upReq.nextLv}: Mỗi bát ${formatRoomOutput(curStats.output)} → ${formatRoomOutput(nextLvStats.output)} · Ghế ${getDiningSeats(room.level).length} → ${getDiningSeats(upReq.nextLv).length} · Thưởng +${upReq.expGain} EXP`
      : `Lên Lv.${upReq.nextLv}: ${formatRoomOutput(curStats.output)} → ${formatRoomOutput(nextLvStats.output)} · Chu kỳ ${curStats.cycleSec.toFixed(1)}s → ${nextLvStats.cycleSec.toFixed(1)}s · Thưởng +${upReq.expGain} EXP`;

    const hasLv = (state.playerLevel || 1) >= upReq.reqPlayerLv;
    const hasCoins = state.coins >= upReq.coins;
    const hasRep = (state.rep || 0) >= upReq.reqRep;
    const hasIng = (state.ingredients || 0) >= upReq.reqIngredients;

    const reqBadges = [
      `<span class="px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${hasLv ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}">⭐ Cấp ${upReq.reqPlayerLv}</span>`,
      `<span class="px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${hasCoins ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}">💰 ${upReq.coins.toLocaleString('vi-VN')} Xu</span>`
    ];
    if (upReq.reqRep > 0) {
      reqBadges.push(`<span class="px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${hasRep ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}">🏆 ${upReq.reqRep}★ Uy tín</span>`);
    }
    if (upReq.reqIngredients > 0) {
      reqBadges.push(`<span class="px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${hasIng ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}">🥬 Tiêu ${upReq.reqIngredients} Kho</span>`);
    }
    const milestoneHtml = upReq.isMilestone
      ? `<div class="text-[10.5px] font-bold text-amber-900 bg-amber-100/80 border border-amber-300 rounded-lg px-2 py-1 mt-1.5">🌟 Cột mốc Đột phá Lv.${upReq.nextLv}: Nhân ×1.20 sản lượng & nâng bậc kiến trúc 3D!</div>`
      : '';

    const staffDesc = nextStaffStats
      ? `Hiện có ${room.staff} người: ${isVenue ? 'mỗi bát ' : ''}${formatRoomOutput(curStats.output)} → ${formatRoomOutput(nextStaffStats.output)} (+1 nhân sự 3D${isVenue ? ', bưng món nhanh hơn' : ''})`
      : 'Đã đủ nhân sự';

    const mergeInfo = curStats.mergeInfo;
    const mergeHtml = (mergeInfo && mergeInfo.isMerged)
      ? `<div class="bg-teal-50/90 border border-teal-300/80 rounded-2xl p-3 space-y-1">
           <div class="text-[10.5px] font-bold text-teal-900 uppercase tracking-wide">🔗 Đã Gộp Không Gian (${mergeInfo.size} ô thông tường)</div>
           <div class="text-[11.5px] font-semibold text-teal-800">Tường ngăn đã mở thông · Thưởng +${mergeInfo.outputPct}% sản lượng & +${mergeInfo.speedPct}% tốc độ!</div>
         </div>`
      : `<div class="bg-stone-50 border border-stone-200/70 rounded-2xl p-2.5 text-[11px] text-stone-600">
           🧱 <strong class="text-stone-800">Mẹo Gộp Ô:</strong> Đặt thêm một <strong>${cfg.name}</strong> ngay sát cạnh để xóa tường ngăn và nhận +16% sản lượng, +10% tốc độ.
         </div>`;

    const synLinks = curStats.synergy ? curStats.synergy.links : [];
    const synRules = (GAME_CONFIG.synergies && GAME_CONFIG.synergies[room.type]) || [];
    let synergyHtml = '';
    if (synLinks.length > 0) {
      synergyHtml = `
        <div class="bg-orange-50/90 border border-orange-200/80 rounded-2xl p-3 space-y-1">
          <div class="text-[10.5px] font-bold text-amber-900 uppercase tracking-wide">⚡ Liên kết liền kề & Cửa thông phòng</div>
          ${synLinks.map(l => `<div class="text-[11.5px] font-semibold text-emerald-800">• ${l.label}</div>`).join('')}
        </div>
      `;
    } else if (synRules.length > 0) {
      const hints = synRules.map(r => GAME_CONFIG.rooms[r.withType]?.name).filter(Boolean);
      synergyHtml = `
        <div class="bg-stone-50 border border-stone-200/70 rounded-2xl p-2.5 text-[11px] text-stone-600">
          💡 <strong class="text-stone-800">Mẹo vị trí:</strong> Đặt cạnh <strong>${hints.join(' hoặc ')}</strong> để mở cửa nối & nhận thưởng liền kề.
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

    const tierCount = Math.floor(room.level / 5);
    const tierBadge = tierCount > 0 ? ` · Tinh Anh Bậc ${tierCount}` : '';
    document.getElementById('drawer-icon').textContent = cfg.icon;
    document.getElementById('drawer-title').textContent = `${cfg.name} · Lv.${room.level}`;
    document.getElementById('drawer-subtitle').textContent = `${cfg.category} · ${room.staff}/${GAME_CONFIG.MAX_STAFF_PER_ROOM} nhân sự${tierBadge}`;

    body.innerHTML = `
      ${hazardHtml}
      <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 space-y-2.5">
        <p class="text-xs text-stone-600 leading-relaxed">${cfg.desc}</p>
        <div id="drawer-room-status" class="text-xs font-semibold border rounded-xl px-2.5 py-1.5 ${statusClass}">
          ${statusText}
        </div>
        <div class="text-[11.5px] text-stone-700 bg-stone-50 border border-stone-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span class="text-stone-500">${isVenue ? 'Mỗi bát khách trả:' : 'Sản lượng & EXP:'}</span>
          <span class="font-bold text-stone-900">${formatRoomOutput(curStats.output)} · <span class="text-amber-700">+${curStats.expGain} EXP</span></span>
        </div>
        <div>
          <div class="flex justify-between text-[11px] text-stone-500 mb-1">
            <span>${isVenue ? 'Ghế đang có khách' : 'Tiến độ chu kỳ'}</span>
            <span>Tốc độ +${bonuses.speedPct}%</span>
          </div>
          <div class="h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div id="drawer-room-progress" class="h-full bg-amber-600 rounded-full transition-all duration-100" style="width: ${Math.round(room.progress * 100)}%"></div>
          </div>
        </div>
        <button id="btn-boost-room" class="btn-ghost w-full py-2 rounded-xl text-xs font-bold">
          ${isVenue ? '👋 Mời khách ngoài phố vào quán' : 'Hỗ trợ vận hành (+35% tiến độ)'}
        </button>
      </div>
      ${room.type === 'kitchen' ? getKitchenPanelHtml() : ''}
      ${getCrewListHtml(room)}

      ${mergeHtml}
      ${synergyHtml}
      ${menuHtml}
      ${perksHtml}

      <div class="space-y-2">
        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-stone-900">Nâng cấp vô hạn (Lv.${room.level} → Lv.${upReq.nextLv})</div>
              <div class="text-[11px] text-stone-500 leading-snug mt-0.5">${upgradeDesc}</div>
            </div>
            <button id="btn-upgrade-room" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0" ${canUp ? '' : 'disabled'}>
              Nâng cấp
            </button>
          </div>
          <div class="flex flex-wrap gap-1 pt-1 border-t border-stone-100">
            ${reqBadges.join('')}
          </div>
          ${milestoneHtml}
        </div>

        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-stone-900">Thuê thêm nhân viên</div>
            <div class="text-[11px] text-stone-500 leading-snug mt-0.5">${staffDesc}</div>
          </div>
          <button id="btn-hire-staff" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0" ${canStaff ? '' : 'disabled'}>
            ${room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM ? 'Đủ' : `${staffCost.toLocaleString('vi-VN')} Xu`}
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
      if (isVenue) {
        inviteCustomer(room);
        updateSelectedRoomProgressOnly(room);
        return;
      }
      SoundFX.click();
      room.progress += 0.35;
      if (room.progress >= 1) {
        room.progress -= 1;
        completeRoomCycle(room, getGlobalBonuses());
      }
      updateSelectedRoomProgressOnly(room);
    });

    if (room.type === 'kitchen') {
      document.getElementById('btn-kp-broth').addEventListener('click', () => { startBrothPot(true); updateKitchenPanel(); });
      document.getElementById('btn-kp-wash').addEventListener('click', () => { washBowlsByHand(); updateSelectedRoomProgressOnly(room); });
      document.getElementById('btn-kp-washer').addEventListener('click', () => { if (hireWasher(room)) renderDrawer(); });
      updateKitchenPanel();
    }

    const wakeBtn = document.getElementById('btn-wake-crew');
    if (wakeBtn) wakeBtn.addEventListener('click', () => { wakeRoomCrew(room); renderDrawer(); });

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
      const req = getRoomUpgradeRequirements(room);
      if (!req.met) return;
      state.coins -= req.coins;
      if (req.reqIngredients > 0) {
        state.ingredients = Math.max(0, state.ingredients - req.reqIngredients);
      }
      room.level += 1;
      triggerRoomPop(room.gx, room.gy);
      rebuildRooms3D();
      SoundFX.upgrade();
      spawnFloater(room.gx, room.gy, `Lên Lv.${room.level} · +${req.expGain} EXP`, '#B85524');
      showToast(`⬆️ Đã nâng cấp ${cfg.name} lên Lv.${room.level}! (+${req.expGain} EXP)`);
      gainExp(req.expGain);
      updateHUD();
      renderDrawer();
      saveGame(false);
    });

    document.getElementById('btn-hire-staff').addEventListener('click', () => {
      if (room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM || state.coins < staffCost) return;
      state.coins -= staffCost;
      room.staff += 1;
      rebuildRooms3D();
      const newcomer = room.crew[room.crew.length - 1];
      if (newcomer) showToast(`👋 ${newcomer.name} (${getStaffTrait(newcomer.trait).name}) gia nhập ${cfg.name}!`);
      SoundFX.upgrade();
      spawnFloater(room.gx, room.gy, '+1 Nhân sự · +20 EXP', '#266E56');
      showToast(`Đã tuyển thêm nhân viên cho ${cfg.name}! (+20 EXP)`);
      gainExp(20);
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
  if (!cfg || !isRoomUnlocked(typeId) || getRoomAt(gx, gy) || state.coins < cfg.cost) return;
  state.coins -= cfg.cost;
  const newRoom = { gx, gy, type: typeId, level: 1, staff: 1, progress: 0 };
  state.rooms.push(newRoom);
  triggerRoomPop(gx, gy);
  rebuildRooms3D();
  SoundFX.build();
  const mInfo = getMergedZoneInfo(newRoom);
  if (mInfo.isMerged) {
    spawnFloater(gx, gy, `🔗 Gộp ${mInfo.size} ô ${cfg.name}`, '#1F5E49');
    showToast(`🔗 Đã xây & xóa tường gộp ô ${cfg.name} (${mInfo.size} phân khu thông nhau)! (+35 EXP)`);
  } else {
    spawnFloater(gx, gy, `Khai trương ${cfg.name}`, '#266E56');
    showToast(`Đã xây dựng ${cfg.name}! (+35 EXP)`);
  }
  gainExp(35);
  updateHUD();
  updateContractUI();
  renderDrawer();
  saveGame(false);
}

function renderExpansionPanel() {
  const gridCard = document.getElementById('expansion-grid-card');
  const menuList = document.getElementById('expansion-menu-list');
  const roadmapList = document.getElementById('expansion-roadmap-list');
  if (!gridCard || !menuList) return;

  const playerLv = state.playerLevel || 1;
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
    const reqLv = nextTier.unlockLevel || 1;
    const hasLv = playerLv >= reqLv;
    const hasCoins = state.coins >= nextTier.cost;
    const hasRep = state.rep >= nextTier.minRep;
    gridCard.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="font-bold text-stone-900">Mở rộng Quỹ đất: ${curSize}×${curSize} → ${nextTier.label}</div>
          <div class="text-[11px] text-stone-500 mt-0.5">Yêu cầu: <strong class="${hasLv ? 'text-emerald-700' : 'text-red-600'}">Cấp ${reqLv}</strong> · <strong class="${hasCoins ? 'text-amber-800' : 'text-red-600'}">${nextTier.cost.toLocaleString('vi-VN')} Xu</strong> · <strong class="${hasRep ? 'text-emerald-700' : 'text-red-600'}">${nextTier.minRep}★ Uy tín</strong></div>
        </div>
        <button id="btn-do-expand-grid" class="btn-primary px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap" ${(hasLv && hasCoins && hasRep) ? '' : 'disabled'}>
          Mở rộng ngay
        </button>
      </div>
    `;
    const expandActionBtn = document.getElementById('btn-do-expand-grid');
    if (expandActionBtn) {
      expandActionBtn.addEventListener('click', () => {
        if ((state.playerLevel || 1) < reqLv || state.coins < nextTier.cost || state.rep < nextTier.minRep) return;
        state.coins -= nextTier.cost;
        state.gridSize = nextTier.size;
        buildGroundGrid();
        rebuildRooms3D();
        resetCamera();
        SoundFX.build();
        showToast(`🗺️ Đã mở rộng khu đất lên ${nextTier.label}! (+80 EXP)`);
        gainExp(80);
        updateHUD();
        updateContractUI();
        renderExpansionPanel();
        saveGame(false);
      });
    }
  }

  const activeId = getActiveMenuConfig().id;
  menuList.innerHTML = Object.values(GAME_CONFIG.menus || {}).map((m) => {
    const reqLv = m.unlockLevel || 1;
    const unlocked = playerLv >= reqLv && state.rep >= m.unlockRep;
    const isActive = m.id === activeId;
    return `
      <div class="bg-white border ${isActive ? 'border-amber-600 ring-1 ring-amber-500/30' : 'border-stone-200/80'} rounded-2xl p-3 flex flex-col justify-between gap-2">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-stone-900">${m.icon} ${m.name}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${unlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}">
              ${unlocked ? (isActive ? 'Đang phục vụ' : 'Đã mở khóa') : `Cấp ${reqLv} · ${m.unlockRep}★`}
            </span>
          </div>
          <p class="text-[11px] text-stone-500 mt-1 leading-snug">${m.desc}</p>
        </div>
        <button data-select-menu="${m.id}" class="${isActive ? 'btn-ghost active' : 'btn-primary'} w-full py-1.5 rounded-xl text-[11px] font-bold" ${(!unlocked || isActive) ? 'disabled' : ''}>
          ${isActive ? '✓ Đang áp dụng' : (unlocked ? 'Chọn thực đơn này' : `Cần Cấp ${reqLv} & ${m.unlockRep} Uy tín`)}
        </button>
      </div>
    `;
  }).join('');

  menuList.querySelectorAll('[data-select-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const menuId = btn.getAttribute('data-select-menu');
      const cfg = GAME_CONFIG.menus[menuId];
      if (!cfg || (state.playerLevel || 1) < (cfg.unlockLevel || 1) || state.rep < cfg.unlockRep) return;
      state.activeMenu = menuId;
      SoundFX.upgrade();
      showToast(`${cfg.icon} Đã chuyển thực đơn sang ${cfg.name}!`);
      updateHUD();
      renderExpansionPanel();
      if (selectedPlot) renderDrawer();
      saveGame(false);
    });
  });

  if (roadmapList) {
    const milestones = GAME_CONFIG.levelMilestones || [];
    roadmapList.innerHTML = milestones.map((ms) => {
      const reached = playerLv >= ms.level;
      const isNext = !reached && playerLv + 1 === ms.level;
      const boxCls = reached
        ? 'bg-emerald-50/70 border-emerald-200/80'
        : (isNext ? 'bg-amber-50/80 border-amber-300/80' : 'bg-white border-stone-200/80');
      const badgeCls = reached
        ? 'bg-emerald-600 text-white'
        : (isNext ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-700');
      return `
        <div class="border ${boxCls} rounded-xl px-3 py-2 flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold shrink-0 ${badgeCls}">Cấp ${ms.level}</span>
            <div class="min-w-0">
              <div class="font-bold text-[11.5px] text-stone-900 truncate">${ms.title}</div>
              <div class="text-[10.5px] text-stone-600 leading-snug">${ms.unlocks}</div>
            </div>
          </div>
          <span class="text-[10.5px] font-bold shrink-0 ${reached ? 'text-emerald-700' : (isNext ? 'text-amber-800' : 'text-stone-400')}">
            ${reached ? '✓ Đã mở' : (isNext ? 'Sắp tới' : 'Khóa')}
          </span>
        </div>
      `;
    }).join('');
  }
}

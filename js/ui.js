// =========================================================================
// 9. HUD, CONTRACT & INSPECTOR DRAWER
// =========================================================================
function updateHUD() {
  const maxPlots = GAME_CONFIG.GRID_COLS * GAME_CONFIG.GRID_ROWS;
  document.getElementById('stat-coins').textContent = state.coins.toLocaleString('vi-VN');
  document.getElementById('stat-ingredients').textContent = state.ingredients;
  document.getElementById('stat-dishes').textContent = state.dishes;
  document.getElementById('stat-parcels').textContent = state.parcels;
  document.getElementById('stat-rep').textContent = state.rep;
  document.getElementById('stat-day').textContent = state.day;
  document.getElementById('stat-rooms').textContent = `${state.rooms.length}/${maxPlots}`;
  document.getElementById('stat-total-served').textContent = state.totalServed;
  document.getElementById('stat-total-earned').textContent = `${state.totalEarned.toLocaleString('vi-VN')} Xu`;
}

function getContractMetricValue(metric) {
  return metric === 'roomCount' ? state.rooms.length : (state[metric] || 0);
}

function updateContractUI() {
  const c = GAME_CONFIG.contracts[state.contractIdx];
  if (!c) {
    document.getElementById('contract-title').textContent = 'Khu phức hợp thịnh vượng';
    document.getElementById('contract-desc').textContent = 'Bạn đã hoàn thành toàn bộ đơn hàng khởi đầu. Tự do mở rộng theo ý thích!';
    document.getElementById('contract-reward').textContent = 'Tự do';
    document.getElementById('contract-bar').style.width = '100%';
    document.getElementById('contract-progress').textContent = '✓';
    document.getElementById('btn-claim-contract').classList.add('hidden');
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
}

function openInspector(gx, gy) {
  selectedPlot = { gx, gy };
  confirmDemolishKey = null;
  updatePlotHighlights();
  renderDrawer();
}

function closeInspector() {
  selectedPlot = null;
  confirmDemolishKey = null;
  updatePlotHighlights();
  document.getElementById('inspector-drawer').classList.add('hidden');
}

function updateSelectedRoomProgressOnly(room) {
  const bar = document.getElementById('drawer-room-progress');
  if (bar) bar.style.width = `${Math.min(100, Math.round(room.progress * 100))}%`;
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

    document.getElementById('drawer-icon').textContent = cfg.icon;
    document.getElementById('drawer-title').textContent = `${cfg.name} · Lv.${room.level}`;
    document.getElementById('drawer-subtitle').textContent = `${cfg.category} · ${room.staff}/${GAME_CONFIG.MAX_STAFF_PER_ROOM} nhân sự`;

    body.innerHTML = `
      <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 space-y-2.5">
        <p class="text-xs text-stone-600 leading-relaxed">${cfg.desc}</p>
        <div class="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 rounded-xl px-2.5 py-1.5">
          ${cfg.effectText}
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

      <div class="space-y-2">
        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div>
            <div class="text-xs font-bold text-stone-900">Nâng cấp thiết bị</div>
            <div class="text-[11px] text-stone-500">${room.level >= GAME_CONFIG.MAX_LEVEL ? 'Đã đạt cấp tối đa' : `Lên Lv.${room.level + 1} · Thêm nội thất & năng suất`}</div>
          </div>
          <button id="btn-upgrade-room" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap" ${canUp ? '' : 'disabled'}>
            ${room.level >= GAME_CONFIG.MAX_LEVEL ? 'Tối đa' : `${upCost} Xu`}
          </button>
        </div>

        <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div>
            <div class="text-xs font-bold text-stone-900">Thuê thêm nhân viên</div>
            <div class="text-[11px] text-stone-500">${room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM ? 'Đã đủ nhân sự' : `Hiện có ${room.staff} người · +40% sản lượng`}</div>
          </div>
          <button id="btn-hire-staff" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap" ${canStaff ? '' : 'disabled'}>
            ${room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM ? 'Đủ' : `${staffCost} Xu`}
          </button>
        </div>
      </div>

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

    document.getElementById('btn-upgrade-room').addEventListener('click', () => {
      if (room.level >= GAME_CONFIG.MAX_LEVEL || state.coins < upCost) return;
      state.coins -= upCost;
      room.level += 1;
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
  rebuildRooms3D();
  SoundFX.build();
  spawnFloater(gx, gy, `Khai trương ${cfg.name}`, '#266E56');
  showToast(`Đã xây dựng ${cfg.name}!`);
  updateHUD();
  updateContractUI();
  renderDrawer();
  saveGame(false);
}

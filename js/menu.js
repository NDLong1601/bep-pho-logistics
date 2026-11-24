// =========================================================================
// 7f. MAIN MENU TABS: BUILDINGS AND STAFF
// =========================================================================
// Everything the player manages lives behind one Menu button. The modal's
// other tabs (dishes, decor, expansion, settings) are rendered by their own
// modules; this file renders the "Công trình" and "Nhân viên" tabs.

function getSortedRooms() {
  const order = Object.keys(GAME_CONFIG.rooms);
  return [...state.rooms].sort((a, b) =>
    order.indexOf(a.type) - order.indexOf(b.type) || a.gy - b.gy || a.gx - b.gx);
}

function getUpgradeBlockReason(room, req) {
  if ((state.playerLevel || 1) < req.reqPlayerLv) return `Cần Cấp ${req.reqPlayerLv}`;
  if (state.coins < req.coins) return `Cần ${req.coins.toLocaleString('vi-VN')} Xu`;
  if ((state.rep || 0) < req.reqRep) return `Cần ${req.reqRep}★ uy tín`;
  if ((state.ingredients || 0) < req.reqIngredients) return `Cần ${req.reqIngredients} nguyên liệu`;
  return '';
}

// Close the menu and show a room on the map with its detail drawer.
function focusRoomFromMenu(room) {
  closeSystemModal();
  camTarget.copy(gridToWorld3D(room.gx, room.gy));
  openInspector(room.gx, room.gy);
}

function renderBuildPanel() {
  const list = document.getElementById('build-list');
  if (!list) return;
  const maxPlots = getGridSize() * getGridSize();
  const rows = getSortedRooms().map((room) => {
    const cfg = GAME_CONFIG.rooms[room.type];
    const req = getRoomUpgradeRequirements(room);
    const reason = req.met ? '' : getUpgradeBlockReason(room, req);
    const key = `${room.gx}_${room.gy}`;
    const warn = room.hazard ? `<span class="text-[10.5px] font-bold text-rose-700">${room.hazard.icon} ${room.hazard.label}</span>` : '';
    return `
      <div class="menu-card bg-white rounded-2xl p-2.5 flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border-2 border-stone-900/80" style="background:${cfg.floorTint}">${cfg.icon}</div>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-bold text-stone-900 truncate">${cfg.name} <span class="text-amber-700">Lv.${room.level}</span></div>
          <div class="text-[11px] text-stone-500 truncate">${room.staff}/${GAME_CONFIG.MAX_STAFF_PER_ROOM} nhân viên · ${reason || `Lên Lv.${req.nextLv}: ${req.coins.toLocaleString('vi-VN')} Xu`}</div>
          ${warn}
        </div>
        <div class="flex flex-col gap-1 shrink-0">
          <button data-up-room="${key}" class="btn-primary px-3 py-1 rounded-xl text-xs font-bold" ${req.met ? '' : 'disabled'}>⬆️ Nâng</button>
          <button data-see-room="${key}" class="btn-ghost px-3 py-1 rounded-xl text-xs font-bold">Xem</button>
        </div>
      </div>`;
  }).join('');
  list.innerHTML = `
    <div class="text-[12px] text-stone-600 bg-amber-50 rounded-xl px-3 py-2 border-2 border-dashed border-amber-300">
      🏗️ Muốn xây phòng mới: đóng menu rồi chạm vào <strong>ô cỏ trống</strong> trên bản đồ. Đã dùng ${state.rooms.length}/${maxPlots} ô.
    </div>
    ${rows}`;

  list.querySelectorAll('[data-up-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [gx, gy] = btn.getAttribute('data-up-room').split('_').map(Number);
      const room = getRoomAt(gx, gy);
      if (room && upgradeRoom(room)) renderBuildPanel();
    });
  });
  list.querySelectorAll('[data-see-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [gx, gy] = btn.getAttribute('data-see-room').split('_').map(Number);
      const room = getRoomAt(gx, gy);
      if (room) focusRoomFromMenu(room);
    });
  });
}

function renderStaffPanel() {
  const list = document.getElementById('staff-list');
  if (!list) return;
  const sc = GAME_CONFIG.staff;
  list.innerHTML = getSortedRooms().map((room) => {
    const cfg = GAME_CONFIG.rooms[room.type];
    ensureCrew(room);
    const cost = getStaffCost(room);
    const full = room.staff >= GAME_CONFIG.MAX_STAFF_PER_ROOM;
    const key = `${room.gx}_${room.gy}`;
    const washerBtn = room.type === 'kitchen'
      ? `<button data-hire-washer="${key}" class="btn-ghost px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap" ${room.washers.length >= sc.maxWashersPerKitchen || state.coins < sc.washerCost ? 'disabled' : ''}>🧽 Rửa bát · ${sc.washerCost} Xu</button>`
      : '';
    return `
      <div class="space-y-1.5">
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-1">
          <div class="text-[13px] font-bold text-stone-900">${cfg.icon} ${cfg.name} <span class="text-stone-500 font-semibold">· ${room.staff}/${GAME_CONFIG.MAX_STAFF_PER_ROOM}</span></div>
          <div class="flex items-center gap-1.5">
            ${washerBtn}
            <button data-hire-room="${key}" class="btn-primary px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap" ${full || state.coins < cost ? 'disabled' : ''}>${full ? 'Đã đủ' : `+ Thuê · ${cost.toLocaleString('vi-VN')} Xu`}</button>
          </div>
        </div>
        ${getCrewListHtml(room)}
      </div>`;
  }).join('');

  list.querySelectorAll('[data-hire-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [gx, gy] = btn.getAttribute('data-hire-room').split('_').map(Number);
      const room = getRoomAt(gx, gy);
      if (room && hireRoomStaff(room)) renderStaffPanel();
    });
  });
  list.querySelectorAll('[data-hire-washer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [gx, gy] = btn.getAttribute('data-hire-washer').split('_').map(Number);
      const room = getRoomAt(gx, gy);
      if (room && hireWasher(room)) renderStaffPanel();
    });
  });
  list.querySelectorAll('[data-wake-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [gx, gy] = btn.getAttribute('data-wake-room').split('_').map(Number);
      const room = getRoomAt(gx, gy);
      if (room) { wakeRoomCrew(room); renderStaffPanel(); }
    });
  });
}

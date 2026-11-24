// =========================================================================
// 7c. STAFF AS CHARACTERS: NAMES, TRAITS, DOZING, DISHWASHERS
// =========================================================================
// Every staff slot of a room (room.staff) has a crew member in room.crew with
// a name and a trait. Kitchens can also hire dishwashers (room.washers) who
// don't cook but empty the sink. Crew members are saved with the room.

const CREW_NAMES = [
  'Anh Tuấn', 'Chị Lan', 'Bé Na', 'Chú Bảy', 'Cô Hoa', 'Anh Minh', 'Chị Thu', 'Em Bình',
  'Anh Khoa', 'Chị Mai', 'Cô Hạnh', 'Chú Tư', 'Em Hùng', 'Chị Ngọc', 'Anh Phát', 'Em Vy',
  'Cô Sáu', 'Anh Đạt', 'Chị Hằng', 'Em Tí', 'Chú Lộc', 'Chị Trang', 'Anh Quân', 'Em My'
];

function getStaffTrait(id) {
  return GAME_CONFIG.staff.traits.find(t => t.id === id) || GAME_CONFIG.staff.traits[0];
}

function getAllCrew() {
  const all = [];
  for (const r of state.rooms) {
    if (Array.isArray(r.crew)) all.push(...r.crew);
    if (Array.isArray(r.washers)) all.push(...r.washers);
  }
  return all;
}

function pickWeightedTrait() {
  const traits = GAME_CONFIG.staff.traits;
  const total = traits.reduce((s, t) => s + (t.weight || 1), 0);
  let roll = Math.random() * total;
  for (const t of traits) {
    roll -= (t.weight || 1);
    if (roll <= 0) return t.id;
  }
  return traits[0].id;
}

function createCrewMember(role = 'staff') {
  const used = new Set(getAllCrew().map(m => m.name));
  const free = CREW_NAMES.filter(n => !used.has(n));
  const pool = free.length ? free : CREW_NAMES;
  const trait = pickWeightedTrait();
  return {
    name: pool[Math.floor(Math.random() * pool.length)],
    trait,
    role,
    dozing: false,
    dozeLeft: 0,
    dozeTimer: randomDozeGap()
  };
}

function randomDozeGap() {
  const [a, b] = GAME_CONFIG.staff.dozeEverySec;
  return a + Math.random() * (b - a);
}

// Keep room.crew the same length as room.staff (called on every rebuild).
function ensureCrew(room) {
  if (!Array.isArray(room.crew)) room.crew = [];
  while (room.crew.length < room.staff) room.crew.push(createCrewMember(room.type === 'dining' ? 'waiter' : 'staff'));
  if (room.crew.length > room.staff) room.crew.length = room.staff;
  if (room.type === 'kitchen' && !Array.isArray(room.washers)) room.washers = [];
}

function getCrewRoleLabel(room, member) {
  if (member.role === 'washer') return 'Rửa bát';
  const labels = { dining: 'Bồi bàn', kitchen: 'Đầu bếp', warehouse: 'Thủ kho', cold_storage: 'Thủ kho lạnh', packing: 'Đóng gói', dispatch: 'Shipper', cafe: 'Pha chế', office: 'Điều phối', marketing: 'Tiếp thị', drone_hub: 'Điều khiển drone' };
  return labels[room.type] || 'Nhân viên';
}

// Extra "effective staff" from traits; a dozing member counts as nobody.
function getCrewStaffBonus(room) {
  if (!Array.isArray(room.crew)) return 0;
  let bonus = 0;
  for (const m of room.crew) {
    if (m.dozing) bonus -= 1;
    else bonus += getStaffTrait(m.trait).staffBonus || 0;
  }
  return bonus;
}

function getCrewPatienceMult(room) {
  if (!room || !Array.isArray(room.crew)) return 1;
  let bonus = 0;
  for (const m of room.crew) bonus += getStaffTrait(m.trait).patienceBonus || 0;
  return 1 + Math.min(0.6, bonus);
}

function getCrewSpeedMult(member) {
  return member ? (getStaffTrait(member.trait).speedMult || 1) : 1;
}

function getDozingCrew(room) {
  const list = [];
  for (const m of room.crew || []) if (m.dozing) list.push(m);
  for (const m of room.washers || []) if (m.dozing) list.push(m);
  return list;
}

function wakeRoomCrew(room) {
  const dozing = getDozingCrew(room);
  if (!dozing.length) return;
  for (const m of dozing) {
    m.dozing = false;
    m.dozeLeft = 0;
    m.dozeTimer = randomDozeGap();
  }
  gainExp(GAME_CONFIG.staff.wakeExp * dozing.length);
  if (typeof SoundFX !== 'undefined') SoundFX.click();
  spawnFloater(room.gx, room.gy, `☀️ ${dozing[0].name} dậy làm tiếp!`, '#266E56');
  updateHUD();
}

function updateCrew(effDt) {
  const c = GAME_CONFIG.staff;
  for (const room of state.rooms) {
    const members = [...(room.crew || []), ...(room.washers || [])];
    for (const m of members) {
      if (!getStaffTrait(m.trait).dozes) continue;
      if (m.dozing) {
        m.dozeLeft -= effDt;
        if (m.dozeLeft <= 0) {
          m.dozing = false;
          m.dozeTimer = randomDozeGap();
        }
      } else {
        m.dozeTimer = (typeof m.dozeTimer === 'number' ? m.dozeTimer : randomDozeGap()) - effDt;
        if (m.dozeTimer <= 0) {
          m.dozing = true;
          m.dozeLeft = c.dozeMaxSec;
        }
      }
    }
  }
}

// ---- Dishwashers (kitchen only) -------------------------------------------
function getWasherCount() {
  return getKitchenRooms().reduce((s, r) => s + (Array.isArray(r.washers) ? r.washers.length : 0), 0);
}

function getAwakeWasherCount() {
  let n = 0;
  for (const r of getKitchenRooms()) for (const m of r.washers || []) if (!m.dozing) n += 1;
  return n;
}

function hireWasher(room) {
  const c = GAME_CONFIG.staff;
  ensureCrew(room);
  if (room.washers.length >= c.maxWashersPerKitchen) {
    showToast('Bếp đã đủ người rửa bát.');
    return false;
  }
  if (state.coins < c.washerCost) {
    showToast(`Cần ${c.washerCost} Xu để thuê người rửa bát.`);
    return false;
  }
  state.coins -= c.washerCost;
  const m = createCrewMember('washer');
  room.washers.push(m);
  rebuildRooms3D();
  if (typeof SoundFX !== 'undefined') SoundFX.upgrade();
  spawnFloater(room.gx, room.gy, `🧽 ${m.name} vào rửa bát`, '#266E56');
  showToast(`Đã thuê ${m.name} rửa bát (${getStaffTrait(m.trait).name}).`);
  gainExp(15);
  updateHUD();
  saveGame(false);
  return true;
}

// ---- Crew list for the inspector drawer -----------------------------------
function getCrewListHtml(room) {
  const members = [...(room.crew || []), ...(room.washers || [])];
  if (!members.length) return '';
  const rows = members.map((m) => {
    const t = getStaffTrait(m.trait);
    const badge = m.dozing
      ? '<span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">💤 Ngủ gật</span>'
      : '';
    return `
      <div class="flex items-center justify-between gap-2 py-1">
        <div class="min-w-0">
          <div class="text-[11.5px] font-bold text-stone-900">${m.name} <span class="font-medium text-stone-500">· ${getCrewRoleLabel(room, m)}</span></div>
          <div class="text-[10.5px] text-stone-500">${t.icon} ${t.name}: ${t.desc}</div>
        </div>
        ${badge}
      </div>`;
  }).join('');
  const anyDozing = members.some(m => m.dozing);
  return `
    <div class="bg-white/90 border border-stone-200/80 rounded-2xl p-3">
      <div class="flex items-center justify-between mb-1">
        <div class="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">Đội ngũ</div>
        ${anyDozing ? '<button id="btn-wake-crew" class="btn-primary px-2 py-1 rounded-lg text-[10.5px] font-bold">☀️ Đánh thức</button>' : ''}
      </div>
      <div class="divide-y divide-stone-100">${rows}</div>
    </div>`;
}

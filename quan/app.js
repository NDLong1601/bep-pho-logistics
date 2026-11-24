import {
  CREW, DISHES, SAVE_KEY, SHIFT_SECONDS, STAGES, STEP, STOCK_COST, STOCK_PACK, TASKS,
  buyStock, createGame, demand, helpTable, openShift, readSave, stopArrivals, tick, trainWorker, trainingCost
} from './game.js';
import { createScene } from './scene.js';

const byId = id => document.getElementById(id);
const num = new Intl.NumberFormat('vi-VN');
const renderScene = createScene(byId('scene'));
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const seed = new URLSearchParams(location.search).get('seed');
const tableTiles = [...document.querySelectorAll('[data-table]')];
const signalKeys = ['door', 'kitchen', 'ready', 'dirty'];
const soundKey = SAVE_KEY + '_sound';
const dialogs = { closed: 'Chưa mở cửa', running: 'Đang phục vụ', closing: 'Đang chốt ca', complete: 'Đã xong ca' };

let rawSave = null;
try {
  rawSave = localStorage.getItem(SAVE_KEY);
  SoundFX.enabled = localStorage.getItem(soundKey) === 'on';
} catch {
  SoundFX.enabled = false;
}
const loaded = readSave(rawSave);
const game = loaded ?? createGame(seed === null ? undefined : Number(seed));
let canSave = !rawSave || Boolean(loaded);
let paused = false;
let activatedAudio = false;
let previousFrame = 0;
let accumulated = 0;
let paintTime = 0;
let lastSave = game.time;
let shownEvent = -1;
let savedEvent = game.eventId;
let toastTimer = 0;

function persist() {
  if (!canSave) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    lastSave = game.time;
    savedEvent = game.eventId;
  } catch {
    // Playing remains possible if the browser disables local storage.
  }
}

function toast(message) {
  const el = byId('toast');
  clearTimeout(toastTimer);
  el.hidden = false;
  el.textContent = message;
  toastTimer = setTimeout(() => { el.hidden = true; }, 2700);
}

function updateSound() {
  const el = byId('sound');
  const label = SoundFX.enabled ? 'Âm thanh: bật' : 'Âm thanh: tắt';
  el.querySelector('span').textContent = label;
  el.setAttribute('aria-label', label);
  el.setAttribute('aria-pressed', String(SoundFX.enabled));
}

function activateAudio() {
  if (!SoundFX.enabled) return;
  activatedAudio = true;
  SoundFX.init();
}

function labelCrew() {
  const wrap = byId('crew-list');
  for (const [role, profile] of Object.entries(CREW)) {
    const row = document.createElement('div');
    row.className = 'crew-row';
    row.innerHTML = `
      <div class="crew-symbol" aria-hidden="true" style="background:${profile.color}">${profile.name[0]}</div>
      <div class="crew-info"><strong>${profile.name} · ${profile.role}</strong><small id="job-${role}"></small></div>
      <div class="crew-tools">
        <button class="button quiet" id="auto-${role}" type="button" aria-label="${profile.role} tự nhận việc">Tự làm</button>
        <button class="button quiet" id="train-${role}" type="button" aria-label="Đào tạo ${profile.name}"></button>
      </div>`;
    wrap.append(row);
    byId(`auto-${role}`).addEventListener('click', () => {
      const worker = game.workers[role];
      worker.auto = !worker.auto;
      persist();
      render();
    });
    byId(`train-${role}`).addEventListener('click', () => {
      activateAudio();
      if (trainWorker(game, role)) {
        if (activatedAudio) SoundFX.upgrade();
        persist();
        render();
      }
    });
  }
}

function render() {
  const { mode, stats } = game;
  const inShift = mode === 'running' || mode === 'closing';
  const counts = demand(game);
  byId('cash').textContent = num.format(game.cash);
  byId('stock').textContent = num.format(game.stock);
  byId('shift-number').textContent = `Ca ${game.shift}`;
  byId('mode-dot').dataset.mode = paused ? 'paused' : mode;
  byId('shift-mode').textContent = paused ? 'Đang tạm dừng' : dialogs[mode];
  const remaining = mode === 'complete' ? 0 : Math.max(0, Math.ceil(SHIFT_SECONDS - game.time));
  byId('clock').textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  byId('shift-fill').style.width = `${mode === 'complete' ? 100 : Math.min(game.time / SHIFT_SECONDS * 100, 100)}%`;
  byId('start').hidden = inShift;
  byId('start').textContent = mode === 'complete' ? 'Mở ca tiếp theo' : 'Mở cửa';
  byId('pause').hidden = !inShift;
  byId('pause').textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
  byId('end-shift').hidden = mode !== 'running';
  byId('end-shift').disabled = paused;
  byId('shift-hint').textContent = {
    closed: 'Mở cửa, xếp khách vào bàn và điều phối ca bán.',
    running: 'Chọn bàn trống để xếp khách. Nhân viên sẽ tự nhận việc.',
    closing: 'Quán đã ngừng đón khách mới và đang phục vụ các bàn còn lại.',
    complete: `Ca ${game.shift} đã hoàn tất · ${stats.served} đơn đã thanh toán.`
  }[mode];
  byId('served-label').textContent = `${stats.served} đơn`;
  byId('sales').textContent = `${num.format(stats.sales)} xu`;
  byId('restock').disabled = game.cash < STOCK_COST;
  byId('stock-warning').hidden = !counts.shortStock;
  byId('auto-seat').checked = game.autoSeat;

  for (const key of signalKeys) {
    const count = byId(`wait-${key}`);
    count.textContent = counts[key];
    count.parentElement.dataset.active = String(counts[key] > 0);
  }
  byId('kitchen-label').textContent = counts.shortStock ? 'Bếp · thiếu nguyên liệu'
    : counts.kitchen ? `Bếp · chờ ${counts.kitchen}` : game.workers.cook.job ? 'Bếp · đang nấu' : 'Bếp';
  byId('counter-label').textContent = counts.ready ? `Quầy · sẵn ${counts.ready} món`
    : counts.payments ? `Quầy · ${counts.payments} hóa đơn` : 'Quầy ra món';
  byId('entrance-label').textContent = counts.door ? `Cửa vào · ${counts.door} khách` : 'Cửa vào';
  byId('scene-tip').textContent = counts.shortStock ? 'Nhập thêm nguyên liệu để bếp nấu tiếp.'
    : counts.ready ? `${counts.ready} món đang chờ người mang ra.`
    : counts.door && !game.tables.some(table => table.stage === 'free') ? 'Khách đang chờ bàn trống.'
    : 'Chạm bàn để xếp khách hoặc giao việc.';

  for (const table of game.tables) {
    const chip = tableTiles[table.id - 1];
    const seat = table.stage === 'free' && counts.door > 0;
    const stateLabel = seat ? 'Xếp khách' : STAGES[table.stage];
    const dish = table.guest ? DISHES[table.guest.dish].name : '';
    chip.dataset.stage = table.stage;
    chip.dataset.seat = String(seat);
    chip.querySelector('.table-stage').textContent = stateLabel;
    chip.setAttribute('aria-label', `Bàn ${table.id} · ${stateLabel}${dish ? ' · ' + dish : ''}`);
    chip.title = dish || stateLabel;
    chip.disabled = paused || !inShift || (table.stage === 'free' && !seat);
  }

  for (const [role, worker] of Object.entries(game.workers)) {
    const job = worker.job;
    byId(`job-${role}`).textContent = `Cấp ${worker.level} · ${job ? TASKS[job.kind].label + ' bàn ' + job.tableId
      : worker.auto ? 'Sẵn sàng' : 'Chờ giao việc'}`;
    const auto = byId(`auto-${role}`);
    auto.textContent = worker.auto ? 'Tự làm' : 'Thủ công';
    auto.setAttribute('aria-pressed', String(worker.auto));
    const train = byId(`train-${role}`);
    const cost = trainingCost(role, worker.level);
    train.textContent = worker.level >= 3 ? 'Cấp 3' : `↑ ${cost} xu`;
    train.disabled = worker.level >= 3 || game.cash < cost;
    train.setAttribute('aria-label', worker.level >= 3 ? `${CREW[role].name} đã đạt cấp 3` : `Đào tạo ${CREW[role].name} lên cấp ${worker.level + 1}, ${cost} xu`);
  }

  if (shownEvent !== game.eventId) {
    const list = byId('event-list');
    list.replaceChildren();
    if (!game.events.length) {
      const li = document.createElement('li');
      li.textContent = 'Nhật ký sẽ cập nhật khi quán mở cửa.';
      list.append(li);
    }
    for (const event of game.events) {
      const li = document.createElement('li');
      li.dataset.tone = event.tone;
      li.textContent = event.text;
      list.append(li);
    }
    if (shownEvent !== -1 && game.events[0]?.text.includes('đã thanh toán') && activatedAudio) SoundFX.reward();
    shownEvent = game.eventId;
  }

  byId('summary').hidden = mode !== 'complete';
  if (mode === 'complete') {
    byId('summary-title').textContent = `Tổng kết ca ${game.shift}`;
    const rows = [
      ['Đơn đã phục vụ', num.format(stats.served)],
      ['Khách rời quán', num.format(stats.lost)],
      ['Thu từ đơn', `${num.format(stats.sales)} xu`],
      ['Chi trong ca', `${num.format(stats.spent)} xu`],
      ['Chênh lệch tiền trong ca', `${num.format(stats.sales - stats.spent)} xu`]
    ];
    byId('summary-stats').innerHTML = rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  }
}

byId('dish-list').innerHTML = Object.values(DISHES).map(dish => `
  <li style="--dish-color:${dish.color}"><strong>${dish.name}</strong>
  <span>${dish.price} xu · ${dish.stock} nguyên liệu · ${String(dish.time).replace('.', ',')} giây</span></li>
`).join('');
byId('restock').innerHTML = `Nhập +${STOCK_PACK} nguyên liệu <span>${STOCK_COST} xu</span>`;
labelCrew();
updateSound();
render();
renderScene(game, 0, motion.matches);
if (!canSave) toast('Bản lưu quán phở không đọc được. Mở ca mới để bắt đầu lại.');

byId('start').addEventListener('click', () => {
  activateAudio();
  if (!openShift(game)) return;
  paused = false;
  accumulated = 0;
  canSave = true;
  if (activatedAudio) SoundFX.build();
  persist();
  render();
});
byId('pause').addEventListener('click', () => {
  paused = !paused;
  persist();
  render();
});
byId('end-shift').addEventListener('click', () => {
  if (stopArrivals(game)) {
    persist();
    render();
  }
});
byId('restock').addEventListener('click', () => {
  activateAudio();
  if (buyStock(game)) {
    if (activatedAudio) SoundFX.click();
    persist();
    render();
  }
});
byId('auto-seat').addEventListener('change', event => {
  game.autoSeat = event.target.checked;
  persist();
  render();
});
byId('sound').addEventListener('click', () => {
  SoundFX.enabled = !SoundFX.enabled;
  if (SoundFX.enabled) {
    activateAudio();
    SoundFX.click();
  }
  updateSound();
  try { localStorage.setItem(soundKey, SoundFX.enabled ? 'on' : 'off'); } catch { /* optional */ }
});
for (const chip of tableTiles) {
  chip.addEventListener('click', () => {
    if (paused) return;
    activateAudio();
    const tableId = Number(chip.dataset.table);
    const message = helpTable(game, tableId);
    const table = game.tables[tableId - 1];
    if (message) {
      toast(message);
      if (activatedAudio) SoundFX.click();
      persist();
    } else if (table.guest) {
      toast(`Bàn ${tableId} · ${DISHES[table.guest.dish].name} · ${STAGES[table.stage]}`);
    }
    render();
  });
}

function frame(time) {
  const delta = previousFrame === 0 ? 0 : Math.min((time - previousFrame) / 1000, .25);
  previousFrame = time;
  if (!paused && !document.hidden && (game.mode === 'running' || game.mode === 'closing')) {
    const previousMode = game.mode;
    accumulated += delta;
    while (accumulated >= STEP) {
      tick(game);
      accumulated -= STEP;
    }
    if (game.time - lastSave >= 5 || savedEvent !== game.eventId) persist();
    if (game.mode !== previousMode || time - paintTime > 110) {
      render();
      paintTime = time;
    }
  }
  renderScene(game, delta, motion.matches);
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  previousFrame = 0;
  if (document.hidden) persist();
});
window.addEventListener('pagehide', persist);
requestAnimationFrame(frame);

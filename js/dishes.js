// =========================================================================
// 7d. MENU: DISHES WITH PRICES, PREP TIME, STARS AND REGULARS' RECIPES
// =========================================================================
// Customers order one main dish and sometimes a side. The bill is the dining
// room's base bowl price × the dish's price factor × its star bonus.
// Bowl dishes (needsBroth) take a bowl from the kitchen counter; the others
// (spring rolls, sides, drinks) are made at the counter by the waiter.
// New dishes unlock when a regular customer shares a family recipe after the
// restaurant has served enough guests (no random draws).

function getDishConfig(id) {
  return (GAME_CONFIG.dishes || []).find(d => d.id === id) || null;
}

function isDishUnlocked(id) {
  return Array.isArray(state.unlockedDishes) && state.unlockedDishes.includes(id);
}

function getDishStars(id) {
  return Math.max(1, Math.min(GAME_CONFIG.dishStars.max, (state.dishStars && state.dishStars[id]) || 1));
}

function getDishStarMult(id) {
  return 1 + GAME_CONFIG.dishStars.pricePerStar * (getDishStars(id) - 1);
}

function getDishUpgradeCost(id) {
  const d = getDishConfig(id);
  const stars = getDishStars(id);
  if (!d || stars >= GAME_CONFIG.dishStars.max) return null;
  return Math.round(GAME_CONFIG.dishStars.costs[stars - 1] * (d.costMult || 1));
}

function upgradeDish(id) {
  const cost = getDishUpgradeCost(id);
  const d = getDishConfig(id);
  if (!d || cost === null || !isDishUnlocked(id)) return false;
  if (state.coins < cost) {
    showToast(`Cần ${cost.toLocaleString('vi-VN')} Xu để nâng ${d.name}.`);
    return false;
  }
  state.coins -= cost;
  if (!state.dishStars) state.dishStars = {};
  state.dishStars[id] = getDishStars(id) + 1;
  gainExp(20 + 10 * state.dishStars[id]);
  if (typeof SoundFX !== 'undefined') SoundFX.upgrade();
  showToast(`${d.icon} ${d.name} lên ${state.dishStars[id]}★: khách trả nhiều hơn và gọi món này thường hơn!`);
  updateHUD();
  saveGame(false);
  return true;
}

function getUnlockedDishes(category) {
  return (GAME_CONFIG.dishes || []).filter(d => d.category === category && isDishUnlocked(d.id));
}

function pickWeightedDish(list) {
  if (!list.length) return null;
  const weights = list.map(d => (d.popularity || 1) * (1 + 0.15 * (getDishStars(d.id) - 1)));
  let roll = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}

// One main dish, and a side/drink some of the time.
function pickCustomerOrder() {
  const main = pickWeightedDish(getUnlockedDishes('main')) || getDishConfig('pho_tai');
  const sides = getUnlockedDishes('side');
  const side = sides.length && Math.random() < GAME_CONFIG.dishStars.sideChance ? pickWeightedDish(sides) : null;
  return { main: main.id, side: side ? side.id : null };
}

function orderNeedsBowl(order) {
  const main = order && getDishConfig(order.main);
  return !main || main.needsBroth !== false;
}

function getOrderPrepSec(order) {
  let t = 0;
  for (const id of [order.main, order.side]) {
    const d = id && getDishConfig(id);
    if (d) t += d.prepSec || 0;
  }
  return t;
}

// Price factor of the whole order relative to the room's base bowl price.
function getOrderPriceMult(order) {
  let m = 0;
  for (const id of [order.main, order.side]) {
    const d = id && getDishConfig(id);
    if (d) m += (d.priceMult || 1) * getDishStarMult(id);
  }
  return m || 1;
}

function getOrderLabel(order) {
  const parts = [order.main, order.side].map(id => getDishConfig(id)).filter(Boolean);
  return parts.map(d => `${d.icon} ${d.name}`).join(' + ');
}

// Average price factor of an order, for HUD rates and offline earnings.
function getExpectedOrderPriceMult() {
  const avg = (list) => {
    if (!list.length) return 0;
    const w = list.map(d => (d.popularity || 1) * (1 + 0.15 * (getDishStars(d.id) - 1)));
    const total = w.reduce((s, x) => s + x, 0);
    return list.reduce((s, d, i) => s + (d.priceMult || 1) * getDishStarMult(d.id) * w[i], 0) / total;
  };
  const mains = getUnlockedDishes('main');
  const sides = getUnlockedDishes('side');
  return (avg(mains) || 1) + (sides.length ? GAME_CONFIG.dishStars.sideChance * avg(sides) : 0);
}

function recordDishSale(order) {
  if (!state.dishSales) state.dishSales = {};
  for (const id of [order.main, order.side]) {
    if (id) state.dishSales[id] = (state.dishSales[id] || 0) + 1;
  }
}

// A regular shares a recipe once the restaurant has served enough guests.
function checkRecipeUnlocks() {
  if (!Array.isArray(state.unlockedDishes)) state.unlockedDishes = [];
  for (const d of GAME_CONFIG.dishes || []) {
    if (!d.unlock || isDishUnlocked(d.id)) continue;
    if ((state.totalServed || 0) >= d.unlock.served) {
      state.unlockedDishes.push(d.id);
      showStoryCard(d.icon, `${d.unlock.giver} kể công thức ${d.name}`, d.unlock.story);
      if (typeof SoundFX !== 'undefined') SoundFX.levelUp();
      gainExp(40);
      saveGame(false);
      return; // one story at a time
    }
  }
}

function getNextRecipe() {
  return (GAME_CONFIG.dishes || [])
    .filter(d => d.unlock && !isDishUnlocked(d.id))
    .sort((a, b) => a.unlock.served - b.unlock.served)[0] || null;
}

function showStoryCard(icon, title, text, label = 'Món mới · Công thức từ khách quen') {
  const box = document.getElementById('toast-box');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast-anim hud-glass rounded-2xl px-4 py-3 max-w-sm text-left pointer-events-auto';
  el.innerHTML = `
    <div class="flex items-start gap-2.5">
      <div class="text-2xl leading-none">${icon}</div>
      <div>
        <div class="text-[10px] font-bold uppercase tracking-wide text-amber-700">${label}</div>
        <div class="text-xs font-bold text-stone-900 mt-0.5">${title}</div>
        <div class="text-[11px] text-stone-600 mt-1 leading-snug">${text}</div>
      </div>
    </div>`;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => el.remove(), 320);
  }, 7000);
}

// ---- Menu panel (system modal tab) ----------------------------------------
function getBaseBowlPrice() {
  const venue = state.rooms.find(r => GAME_CONFIG.rooms[r.type] && GAME_CONFIG.rooms[r.type].customerVenue);
  if (!venue) return 0;
  return (getRoomCycleStats(venue).output || {}).coins || 0;
}

function renderDishesPanel() {
  const list = document.getElementById('dishes-list');
  if (!list) return;
  const base = getBaseBowlPrice();
  const next = getNextRecipe();
  const nextEl = document.getElementById('dishes-next-recipe');
  if (nextEl) {
    if (next) {
      const pct = Math.min(100, Math.round(((state.totalServed || 0) / next.unlock.served) * 100));
      nextEl.innerHTML = `
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="text-stone-600">Công thức tiếp theo: <strong class="text-stone-900">${next.icon} ${next.name}</strong> từ ${next.unlock.giver}</span>
          <span class="font-bold text-stone-900 tabular-nums">${state.totalServed || 0}/${next.unlock.served} khách</span>
        </div>
        <div class="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div class="h-full bg-amber-600 rounded-full" style="width:${pct}%"></div></div>`;
    } else {
      nextEl.innerHTML = '<div class="text-[11px] font-semibold text-emerald-800">Đã có đủ mọi công thức của khách quen!</div>';
    }
  }

  list.innerHTML = (GAME_CONFIG.dishes || []).map((d) => {
    const unlocked = isDishUnlocked(d.id);
    const stars = getDishStars(d.id);
    const starStr = '★'.repeat(stars) + '☆'.repeat(GAME_CONFIG.dishStars.max - stars);
    const price = Math.round(base * (d.priceMult || 1) * getDishStarMult(d.id) * getVenuePriceMult());
    const cost = getDishUpgradeCost(d.id);
    const sold = (state.dishSales && state.dishSales[d.id]) || 0;
    const kind = d.category === 'side' ? 'Món kèm / đồ uống' : (d.needsBroth === false ? 'Món chính, không cần nước dùng' : 'Món chính, dùng nước dùng');
    if (!unlocked) {
      return `
        <div class="bg-stone-50 border border-stone-200/70 rounded-2xl p-3 opacity-80">
          <div class="flex items-center gap-2"><span class="text-xl grayscale">${d.icon}</span><span class="font-bold text-xs text-stone-700">${d.name}</span></div>
          <div class="text-[10.5px] text-stone-500 mt-1.5">🔒 Phục vụ ${d.unlock.served} khách, ${d.unlock.giver} sẽ kể công thức.</div>
        </div>`;
    }
    return `
      <div class="bg-white border border-stone-200/80 rounded-2xl p-3 flex flex-col gap-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2"><span class="text-xl">${d.icon}</span>
            <div><div class="font-bold text-xs text-stone-900">${d.name}</div><div class="text-[10px] text-stone-500">${kind}</div></div>
          </div>
          <span class="text-amber-600 text-xs tracking-tight">${starStr}</span>
        </div>
        <div class="text-[10.5px] text-stone-600">Giá ~${price.toLocaleString('vi-VN')} Xu · Chuẩn bị ${d.prepSec}s · Đã bán ${sold}</div>
        <button data-upgrade-dish="${d.id}" class="btn-primary w-full py-1.5 rounded-xl text-[11px] font-bold" ${cost === null || state.coins < cost ? 'disabled' : ''}>
          ${cost === null ? 'Đã đạt 5★' : `Nâng lên ${stars + 1}★ (+${Math.round(GAME_CONFIG.dishStars.pricePerStar * 100)}% giá) · ${cost.toLocaleString('vi-VN')} Xu`}
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-upgrade-dish]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (upgradeDish(btn.getAttribute('data-upgrade-dish'))) renderDishesPanel();
    });
  });
}

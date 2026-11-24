// =========================================================================
// 10. POINTER, PAN, ZOOM, ROTATE & CONTROLS
// =========================================================================
const dragState = { active: false, moved: false, sx: 0, sy: 0, startTarget: new THREE.Vector3() };
const activePointers = new Map();
let lastPinchDist = 0;

function getPinchDistance() {
  if (activePointers.size < 2) return 0;
  const pts = Array.from(activePointers.values());
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

function isHitVisibleAndValid(hit) {
  let obj = hit.object;
  while (obj) {
    if (!obj.visible) return false;
    if (obj.userData && obj.userData.wallSide && obj.scale && obj.scale.y < 0.9 && hit.point.y > 0.92) {
      return false;
    }
    obj = obj.parent;
  }
  return true;
}

function pickPlot(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects([roomsGroup, ...plotHitMeshes], true);
  for (const hit of hits) {
    if (!isHitVisibleAndValid(hit)) continue;
    let curr = hit.object;
    while (curr) {
      if (curr.userData && typeof curr.userData.gx === 'number' && typeof curr.userData.gy === 'number') {
        return { gx: curr.userData.gx, gy: curr.userData.gy };
      }
      if (curr === roomsGroup) break;
      curr = curr.parent;
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  SoundFX.init();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}

  if (activePointers.size === 1) {
    dragState.active = true;
    dragState.moved = false;
    dragState.sx = e.clientX;
    dragState.sy = e.clientY;
    dragState.startTarget.copy(camTarget);
    lastPinchDist = 0;
    canvas.classList.add('dragging');
  } else if (activePointers.size === 2) {
    dragState.active = false;
    dragState.moved = true;
    lastPinchDist = getPinchDistance();
    canvas.classList.remove('dragging');
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  if (activePointers.size === 2) {
    dragState.moved = true;
    const dist = getPinchDistance();
    if (lastPinchDist > 0 && dist > 0) {
      viewSize = Math.min(40, Math.max(8.5, viewSize * (lastPinchDist / dist)));
      updateCameraProjection();
    }
    lastPinchDist = dist;
    return;
  }

  if (dragState.active && activePointers.size <= 1) {
    const dx = e.clientX - dragState.sx;
    const dy = e.clientY - dragState.sy;
    if (Math.hypot(dx, dy) > 5) dragState.moved = true;

    const panScale = viewSize / Math.max(300, canvas.clientHeight);
    const right = new THREE.Vector3(Math.cos(camYawCurrent), 0, -Math.sin(camYawCurrent));
    const forward = new THREE.Vector3(-Math.sin(camYawCurrent), 0, -Math.cos(camYawCurrent));
    const panLimit = getGridSize() * 3.5;
    camTarget.copy(dragState.startTarget)
      .addScaledVector(right, -dx * panScale * 1.15)
      .addScaledVector(forward, dy * panScale * 1.65);
    camTarget.x = Math.max(-panLimit, Math.min(panLimit, camTarget.x));
    camTarget.z = Math.max(-panLimit, Math.min(panLimit, camTarget.z));
  } else if (activePointers.size === 0) {
    const plot = pickPlot(e.clientX, e.clientY);
    const changed = (plot?.gx !== hoveredPlot?.gx) || (plot?.gy !== hoveredPlot?.gy);
    hoveredPlot = plot;
    canvas.classList.toggle('pointer', !!plot);
    if (changed) updatePlotHighlights();
  }
});

function relocateRoomTo(srcGx, srcGy, dstGx, dstGy) {
  const srcRoom = getRoomAt(srcGx, srcGy);
  if (!srcRoom) {
    relocateSource = null;
    updatePlotHighlights();
    return;
  }
  if (srcGx === dstGx && srcGy === dstGy) {
    relocateSource = null;
    updatePlotHighlights();
    renderDrawer();
    showToast('Đã hủy di dời phân khu.');
    return;
  }
  const dstRoom = getRoomAt(dstGx, dstGy);
  srcRoom.gx = dstGx;
  srcRoom.gy = dstGy;
  triggerRoomPop(dstGx, dstGy);
  if (dstRoom) {
    dstRoom.gx = srcGx;
    dstRoom.gy = srcGy;
    triggerRoomPop(srcGx, srcGy);
  }
  relocateSource = null;
  selectedPlot = { gx: dstGx, gy: dstGy };
  rebuildRooms3D();
  SoundFX.build();
  const cfg = GAME_CONFIG.rooms[srcRoom.type];
  showToast(dstRoom ? `Đã đổi chỗ ${cfg.name}!` : `Đã di dời ${cfg.name}!`);
  updateHUD();
  renderDrawer();
  saveGame(false);
}

function handlePointerEnd(e) {
  const wasSingleTap = e.type === 'pointerup' && dragState.active && !dragState.moved && activePointers.size === 1;
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) lastPinchDist = 0;

  if (activePointers.size === 0) {
    dragState.active = false;
    canvas.classList.remove('dragging');
    if (wasSingleTap) {
      const plot = pickPlot(e.clientX, e.clientY);
      if (relocateSource) {
        if (plot) {
          SoundFX.click();
          relocateRoomTo(relocateSource.gx, relocateSource.gy, plot.gx, plot.gy);
        } else {
          relocateSource = null;
          closeInspector();
        }
        return;
      }
      if (plot) {
        SoundFX.click();
        openInspector(plot.gx, plot.gy);
      } else {
        closeInspector();
      }
    }
  } else {
    dragState.active = false;
    dragState.moved = true;
    canvas.classList.remove('dragging');
  }
}

canvas.addEventListener('pointerup', handlePointerEnd);
canvas.addEventListener('pointercancel', handlePointerEnd);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  viewSize = Math.min(40, Math.max(8.5, viewSize * (e.deltaY > 0 ? 1.09 : 0.91)));
  updateCameraProjection();
}, { passive: false });

// Toolbar buttons
document.getElementById('btn-pause').addEventListener('click', () => {
  isPaused = !isPaused;
  SoundFX.click();
  document.getElementById('pause-icon').textContent = isPaused ? '▶' : '⏸';
  document.getElementById('pause-label').textContent = isPaused ? 'Tạm dừng' : 'Chạy';
  document.getElementById('btn-pause').classList.toggle('active', isPaused);
});

document.getElementById('btn-speed').addEventListener('click', () => {
  gameSpeed = gameSpeed === 1 ? 2 : 1;
  SoundFX.click();
  const btn = document.getElementById('btn-speed');
  btn.textContent = `${gameSpeed}x`;
  btn.classList.toggle('active', gameSpeed === 2);
});

document.getElementById('btn-sound').addEventListener('click', () => {
  SoundFX.enabled = !SoundFX.enabled;
  document.getElementById('btn-sound').textContent = SoundFX.enabled ? '🔊' : '🔇';
  if (SoundFX.enabled) SoundFX.click();
});

document.getElementById('btn-rotate').addEventListener('click', () => {
  camYawIndex = (camYawIndex + 1) % 4;
  camYawGoal = Math.PI / 4 + camYawIndex * (Math.PI / 2);
  SoundFX.click();
});

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  viewSize = Math.max(8.5, viewSize * 0.85);
  updateCameraProjection();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  viewSize = Math.min(40, viewSize * 1.16);
  updateCameraProjection();
});
document.getElementById('btn-cam-reset').addEventListener('click', () => { SoundFX.click(); resetCamera(); });
document.getElementById('btn-close-drawer').addEventListener('click', closeInspector);

document.getElementById('btn-claim-contract').addEventListener('click', () => {
  const c = getActiveContract();
  if (!c || getContractMetricValue(c.metric) < c.target) return;
  state.coins += c.reward;
  state.totalEarned += c.reward;
  state.dailyEarned = (state.dailyEarned || 0) + c.reward;
  state.rep += c.rep;
  state.contractIdx += 1;
  SoundFX.reward();
  showToast(`Hoàn thành đơn hàng! +${c.reward} Xu & +${c.rep} Uy tín`);
  updateHUD();
  updateContractUI();
  if (selectedPlot) renderDrawer();
  saveGame(false);
});

document.getElementById('btn-claim-express').addEventListener('click', () => {
  const o = state.expressOrder;
  if (!o || (state[o.resource] || 0) < o.amount) return;
  state[o.resource] -= o.amount;
  state.coins += o.reward;
  state.totalEarned += o.reward;
  state.dailyEarned = (state.dailyEarned || 0) + o.reward;
  state.rep += o.rep;
  state.totalServed += 1;
  state.expressOrder = null;
  state.expressCooldown = 14;
  SoundFX.reward();
  showToast(`⚡ Hoàn thành đơn khẩn cấp! +${o.reward} Xu & +${o.rep} Uy tín`);
  updateHUD();
  updateContractUI();
  if (selectedPlot) renderDrawer();
  saveGame(false);
});

// Modal & Tabs
const modal = document.getElementById('system-modal');
const tabs = [
  { btn: 'tab-save', panel: 'panel-save' },
  { btn: 'tab-expansion', panel: 'panel-expansion' },
  { btn: 'tab-extend', panel: 'panel-extend' },
  { btn: 'tab-deploy', panel: 'panel-deploy' }
];

function selectModalTab(tabBtnId) {
  tabs.forEach(x => {
    const active = x.btn === tabBtnId;
    document.getElementById(x.btn).className = active
      ? 'px-3 py-2 text-xs font-bold border-b-2 border-amber-700 text-amber-800'
      : 'px-3 py-2 text-xs font-bold border-b-2 border-transparent text-stone-500 hover:text-stone-800';
    document.getElementById(x.panel).classList.toggle('hidden', !active);
  });
  if (tabBtnId === 'tab-expansion') renderExpansionPanel();
}

function openSystemModal(tabBtnId = 'tab-save') {
  SoundFX.click();
  updateHUD();
  selectModalTab(tabBtnId);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

document.getElementById('btn-system').addEventListener('click', () => openSystemModal('tab-save'));
document.getElementById('btn-menu-select').addEventListener('click', () => openSystemModal('tab-expansion'));
document.getElementById('btn-expand-grid').addEventListener('click', () => openSystemModal('tab-expansion'));

document.getElementById('btn-close-modal').addEventListener('click', () => {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
});

tabs.forEach(t => {
  document.getElementById(t.btn).addEventListener('click', () => selectModalTab(t.btn));
});

document.getElementById('btn-manual-save').addEventListener('click', () => saveGame(true));

document.getElementById('btn-export-json').addEventListener('click', () => {
  const json = JSON.stringify(state);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(() => showToast('Đã copy mã Save JSON!')).catch(() => fallbackCopy(json));
  } else {
    fallbackCopy(json);
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  showToast('Đã copy mã Save JSON!');
}

document.getElementById('btn-toggle-import').addEventListener('click', () => {
  document.getElementById('import-area').classList.toggle('hidden');
});

document.getElementById('btn-confirm-import').addEventListener('click', () => {
  try {
    const parsed = JSON.parse(document.getElementById('import-textarea').value.trim());
    if (!parsed || !Array.isArray(parsed.rooms)) throw new Error('invalid');
    state = Object.assign(createInitialState(), parsed);
    if (typeof state.dailyEarned !== 'number') state.dailyEarned = 0;
    if (typeof state.expressCooldown !== 'number') state.expressCooldown = 4;
    if (state.expressOrder && typeof state.expressOrder.timeLeft !== 'number') state.expressOrder = null;
    if (typeof state.gridSize !== 'number' || state.gridSize < 4 || state.gridSize > 6) state.gridSize = 4;
    if (!GAME_CONFIG.menus || !GAME_CONFIG.menus[state.activeMenu]) state.activeMenu = 'pho_bo';
    lastDayPhaseId = null;
    closeInspector();
    buildGroundGrid();
    rebuildRooms3D();
    resetCamera();
    updateHUD();
    updateContractUI();
    saveGame(false);
    showToast('Đã khôi phục dữ liệu thành công!');
    document.getElementById('import-area').classList.add('hidden');
  } catch (e) {
    showToast('Mã JSON không hợp lệ, vui lòng kiểm tra lại.');
  }
});

let resetArmed = false;
document.getElementById('btn-reset-game').addEventListener('click', (e) => {
  if (!resetArmed) {
    resetArmed = true;
    e.target.textContent = 'Nhấn lần nữa để xác nhận';
    setTimeout(() => {
      resetArmed = false;
      e.target.textContent = 'Chơi lại từ đầu';
    }, 3000);
    return;
  }
  resetArmed = false;
  e.target.textContent = 'Chơi lại từ đầu';
  state = createInitialState();
  lastDayPhaseId = null;
  closeInspector();
  buildGroundGrid();
  rebuildRooms3D();
  updateHUD();
  updateContractUI();
  resetCamera();
  saveGame(false);
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  showToast('Đã khởi tạo khu bếp mới!');
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); document.getElementById('btn-pause').click(); }
  else if (e.key === '1') { gameSpeed = 1; document.getElementById('btn-speed').textContent = '1x'; document.getElementById('btn-speed').classList.remove('active'); }
  else if (e.key === '2') { gameSpeed = 2; document.getElementById('btn-speed').textContent = '2x'; document.getElementById('btn-speed').classList.add('active'); }
  else if (e.key === 'q' || e.key === 'Q') { document.getElementById('btn-rotate').click(); }
  else if (e.key === 'r' || e.key === 'R') { resetCamera(); }
  else if (e.key === 'Escape') { closeInspector(); modal.classList.add('hidden'); modal.classList.remove('flex'); }
  else if (e.key === '+' || e.key === '=') { viewSize = Math.max(8.5, viewSize * 0.88); updateCameraProjection(); }
  else if (e.key === '-') { viewSize = Math.min(40, viewSize * 1.14); updateCameraProjection(); }
});
// =========================================================================
// 11. BOOTSTRAP & MAIN LOOP
// =========================================================================
let lastTime = 0;
let rafId = null;

function animate(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(0.1, (ts - lastTime) / 1000);
  lastTime = ts;

  updateSimulation(dt, ts / 1000);
  updateCameraTransform();
  renderer.render(scene, camera);
  syncOverlays();

  rafId = requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  updateCameraProjection();
  renderer.render(scene, camera);
  syncOverlays();
});

window.onload = () => {
  loadGame();
  buildGroundGrid();
  rebuildRooms3D();
  resetCamera();
  updateHUD();
  updateContractUI();
  if (pendingOfflineCoins > 0) {
    const mins = Math.max(1, Math.round(pendingOfflineSec / 60));
    showToast(`🌙 Chào mừng trở lại! Bếp thu về +${pendingOfflineCoins.toLocaleString('vi-VN')} Xu (${mins} phút)`);
    pendingOfflineCoins = 0;
    pendingOfflineSec = 0;
  }
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animate);
  setInterval(() => saveGame(false), 12000);
};

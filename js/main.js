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
      viewSize = Math.min(28, Math.max(8.5, viewSize * (lastPinchDist / dist)));
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
    camTarget.copy(dragState.startTarget)
      .addScaledVector(right, -dx * panScale * 1.15)
      .addScaledVector(forward, dy * panScale * 1.65);
    camTarget.x = Math.max(-14, Math.min(14, camTarget.x));
    camTarget.z = Math.max(-14, Math.min(14, camTarget.z));
  } else if (activePointers.size === 0) {
    const plot = pickPlot(e.clientX, e.clientY);
    const changed = (plot?.gx !== hoveredPlot?.gx) || (plot?.gy !== hoveredPlot?.gy);
    hoveredPlot = plot;
    canvas.classList.toggle('pointer', !!plot);
    if (changed) updatePlotHighlights();
  }
});

function handlePointerEnd(e) {
  const wasSingleTap = e.type === 'pointerup' && dragState.active && !dragState.moved && activePointers.size === 1;
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) lastPinchDist = 0;

  if (activePointers.size === 0) {
    dragState.active = false;
    canvas.classList.remove('dragging');
    if (wasSingleTap) {
      const plot = pickPlot(e.clientX, e.clientY);
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
  viewSize = Math.min(28, Math.max(8.5, viewSize * (e.deltaY > 0 ? 1.09 : 0.91)));
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
  viewSize = Math.min(28, viewSize * 1.16);
  updateCameraProjection();
});
document.getElementById('btn-cam-reset').addEventListener('click', () => { SoundFX.click(); resetCamera(); });
document.getElementById('btn-close-drawer').addEventListener('click', closeInspector);

document.getElementById('btn-claim-contract').addEventListener('click', () => {
  const c = GAME_CONFIG.contracts[state.contractIdx];
  if (!c || getContractMetricValue(c.metric) < c.target) return;
  state.coins += c.reward;
  state.totalEarned += c.reward;
  state.rep += c.rep;
  state.contractIdx += 1;
  SoundFX.reward();
  showToast(`Hoàn thành đơn hàng! +${c.reward} Xu & +${c.rep} Uy tín`);
  updateHUD();
  updateContractUI();
  if (selectedPlot) renderDrawer();
  saveGame(false);
});

// Modal & Tabs
const modal = document.getElementById('system-modal');
document.getElementById('btn-system').addEventListener('click', () => {
  SoundFX.click();
  updateHUD();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
});
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

const tabs = [
  { btn: 'tab-save', panel: 'panel-save' },
  { btn: 'tab-extend', panel: 'panel-extend' },
  { btn: 'tab-deploy', panel: 'panel-deploy' }
];
tabs.forEach(t => {
  document.getElementById(t.btn).addEventListener('click', () => {
    tabs.forEach(x => {
      const active = x.btn === t.btn;
      document.getElementById(x.btn).className = active
        ? 'px-3 py-2 text-xs font-bold border-b-2 border-amber-700 text-amber-800'
        : 'px-3 py-2 text-xs font-bold border-b-2 border-transparent text-stone-500 hover:text-stone-800';
      document.getElementById(x.panel).classList.toggle('hidden', !active);
    });
  });
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
    rebuildRooms3D();
    updateHUD();
    updateContractUI();
    closeInspector();
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
  rebuildRooms3D();
  updateHUD();
  updateContractUI();
  closeInspector();
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
  else if (e.key === '-') { viewSize = Math.min(28, viewSize * 1.14); updateCameraProjection(); }
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
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animate);
  setInterval(() => saveGame(false), 12000);
};

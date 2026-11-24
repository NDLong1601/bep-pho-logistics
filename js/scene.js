// =========================================================================
// 5. THREE.JS 3D ISOMETRIC ARCHITECTURAL DIORAMA ENGINE
// =========================================================================
const canvas = document.getElementById('game-canvas');
const overlayLayer = document.getElementById('overlay-layer');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();

// ---- Art style: warm cartoon (toon shading + soft ink outlines) -----------
const ART = {
  saturation: 1.2,   // pushes the pastel palette towards warmer, livelier colours
  outline: 0x3B2A20,  // dark brown ink, softer than black
  outlineWidth: 0.022
};
const toonGradient = (() => {
  const data = new Uint8Array([120, 120, 120, 200, 200, 200, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();
function artColor(c) {
  const col = new THREE.Color(c);
  const hsl = {};
  col.getHSL(hsl);
  // Deepen near-whites a little so walls and floors stop washing out.
  const l = hsl.l > 0.78 ? 0.78 + (hsl.l - 0.78) * 0.55 : hsl.l;
  col.setHSL(hsl.h, Math.min(1, hsl.s * ART.saturation + (hsl.l > 0.78 ? 0.08 : 0)), l);
  return col;
}
// Drop-in replacement for MeshStandardMaterial params.
function toonMat(p = {}) {
  const m = new THREE.MeshToonMaterial({
    color: p.map && (p.color === undefined || p.color === 0xFFFFFF) ? 0xEAD6BA : (p.color !== undefined ? artColor(p.color) : 0xffffff),
    map: p.map || null,
    gradientMap: toonGradient,
    transparent: !!p.transparent,
    opacity: p.opacity !== undefined ? p.opacity : 1,
    emissive: p.emissive !== undefined ? artColor(p.emissive) : 0x000000,
    emissiveIntensity: p.emissiveIntensity || 0,
    side: p.side !== undefined ? p.side : THREE.FrontSide
  });
  return m;
}
const outlineMat = new THREE.MeshBasicMaterial({ color: ART.outline, side: THREE.BackSide });
// Inverted-hull outline: a slightly larger back-face copy drawn in ink colour.
function addOutline(mesh, size) {
  if (!mesh.geometry) return mesh;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const w = ART.outlineWidth * (size || 1);
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.set(1 + (2 * w) / Math.max(sx, 0.01), 1 + (2 * w) / Math.max(sy, 0.01), 1 + (2 * w) / Math.max(sz, 0.01));
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.isOutline = true;
  mesh.add(o);
  return mesh;
}

// Orthographic Isometric Camera
let viewSize = 15.5;
let camTarget = new THREE.Vector3(0, 0, 0);
let camYawIndex = 0; // 0, 1, 2, 3 (90 deg steps)
let camYawCurrent = Math.PI / 4;
let camYawGoal = Math.PI / 4;
const camPitch = Math.atan(1 / Math.sqrt(2)); // True 35.264° isometric angle
const camDist = 42;

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 140);

// Warm Architectural Studio Lighting (matches reference image warmth & soft shadows)
const hemiLight = new THREE.HemisphereLight(0xFFF4E0, 0xC9A98A, 0.62);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xFFF3DE, 0.62);
sunLight.position.set(16, 28, 12);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 4;
sunLight.shadow.camera.far = 85;
const d = 28;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xDCEBFF, 0.28);
fillLight.position.set(-18, 14, -14);
scene.add(fillLight);

// Groups
const groundGroup = new THREE.Group();
const streetGroup = new THREE.Group();
const roomsGroup = new THREE.Group();
const worldAgentsGroup = new THREE.Group();
const synergyLinesGroup = new THREE.Group();
const effectsGroup = new THREE.Group();
scene.add(groundGroup, streetGroup, roomsGroup, worldAgentsGroup, synergyLinesGroup, effectsGroup);

// Raycasting & Plot meshes
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const plotHitMeshes = [];
const plotOutlineMeshes = new Map();
const roomMeshesMap = new Map(); // key -> { group, animHooks, agents, ... }
const roomTagMap = new Map();    // key -> DOM element
const activeFloaters = [];
const steamPuffs = [];
const synergyPulses = [];
const popAnimMap = new Map();
const streetLampMats = [];
const streetVehicles = [];
const streetWalkers = [];
const roamingStaff = [];
let streetMetrics = { sidewalkZ: 10, roadZ: 13, halfSpan: 14 };
const sharedSteamGeo = new THREE.SphereGeometry(0.12, 8, 8);
sharedSteamGeo.userData = { shared: true };

const LIGHTING_PRESETS = {
  morning: {
    sunCol: new THREE.Color(0xFFF3DE), sunInt: 0.62, sunPos: new THREE.Vector3(16, 28, 12),
    hemiSky: new THREE.Color(0xFFFBF2), hemiGnd: new THREE.Color(0xD2C3B2), hemiInt: 0.5,
    fillCol: new THREE.Color(0xDCEBFF), fillInt: 0.28, roomLight: 0
  },
  lunch_rush: {
    sunCol: new THREE.Color(0xFFF8E6), sunInt: 0.7, sunPos: new THREE.Vector3(10, 32, 8),
    hemiSky: new THREE.Color(0xFFFDF7), hemiGnd: new THREE.Color(0xDACBB8), hemiInt: 0.54,
    fillCol: new THREE.Color(0xE3F0FF), fillInt: 0.32, roomLight: 0
  },
  sunset: {
    sunCol: new THREE.Color(0xFF9F5A), sunInt: 0.62, sunPos: new THREE.Vector3(-14, 18, 16),
    hemiSky: new THREE.Color(0xFFD4AD), hemiGnd: new THREE.Color(0x9E7B64), hemiInt: 0.64,
    fillCol: new THREE.Color(0x9BB5E8), fillInt: 0.30, roomLight: 0.65
  },
  night_rush: {
    sunCol: new THREE.Color(0x7A98D6), sunInt: 0.38, sunPos: new THREE.Vector3(-16, 24, -12),
    hemiSky: new THREE.Color(0x53668E), hemiGnd: new THREE.Color(0x362C2B), hemiInt: 0.48,
    fillCol: new THREE.Color(0x6E8AC4), fillInt: 0.25, roomLight: 1.35
  }
};
let currentRoomLightIntensity = 0;

function triggerRoomPop(gx, gy) {
  popAnimMap.set(`${gx}_${gy}`, { t: 0, duration: 0.36 });
}

function rebuildSynergyLines3D() {
  while (synergyLinesGroup.children.length) {
    const child = synergyLinesGroup.children[0];
    disposeObject3D(child);
    synergyLinesGroup.remove(child);
  }
  synergyPulses.length = 0;

  if (!selectedPlot) return;
  const selRoom = getRoomAt(selectedPlot.gx, selectedPlot.gy);
  if (!selRoom) return;

  const drawnPairs = new Set();
  const connections = [];
  const selSyn = getRoomSynergy(selRoom);

  for (const link of selSyn.links) {
    connections.push({
      from: link.targetRoom,
      to: selRoom,
      color: link.revenuePct > 0 ? 0xD36C3D : 0x2F7D63
    });
  }

  for (const other of state.rooms) {
    if (other === selRoom) continue;
    const otherSyn = getRoomSynergy(other);
    for (const link of otherSyn.links) {
      if (link.targetRoom === selRoom) {
        connections.push({
          from: selRoom,
          to: other,
          color: link.revenuePct > 0 ? 0xD36C3D : 0x2F7D63
        });
      }
    }
  }

  connections.forEach((conn, idx) => {
    const keyA = `${conn.from.gx}_${conn.from.gy}`;
    const keyB = `${conn.to.gx}_${conn.to.gy}`;
    const pairKey = [keyA, keyB].sort().join('|');
    if (drawnPairs.has(pairKey)) return;
    drawnPairs.add(pairKey);

    const p0 = gridToWorld3D(conn.from.gx, conn.from.gy);
    p0.y = 1.45;
    const p2 = gridToWorld3D(conn.to.gx, conn.to.gy);
    p2.y = 1.45;
    const mid = p0.clone().lerp(p2, 0.5);
    mid.y = 2.65;

    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.045, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: conn.color, transparent: true, opacity: 0.72 });
    synergyLinesGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    for (let p = 0; p < 2; p++) {
      const pulseGeo = new THREE.SphereGeometry(0.11, 10, 10);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xFFFDF5 });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      synergyLinesGroup.add(pulseMesh);
      synergyPulses.push({ mesh: pulseMesh, curve, offset: idx * 0.25 + p * 0.5, speed: 0.75 });
    }
  });
}

function updateDayNightLighting(dt) {
  const phase = getCurrentDayPhase();
  const preset = LIGHTING_PRESETS[phase.id] || LIGHTING_PRESETS.morning;
  const k = Math.min(1, dt * 2.4);

  sunLight.color.lerp(preset.sunCol, k);
  sunLight.intensity += (preset.sunInt - sunLight.intensity) * k;
  sunLight.position.lerp(preset.sunPos, k);

  hemiLight.color.lerp(preset.hemiSky, k);
  hemiLight.groundColor.lerp(preset.hemiGnd, k);
  hemiLight.intensity += (preset.hemiInt - hemiLight.intensity) * k;

  fillLight.color.lerp(preset.fillCol, k);
  fillLight.intensity += (preset.fillInt - fillLight.intensity) * k;

  currentRoomLightIntensity += (preset.roomLight - currentRoomLightIntensity) * k;
  const lightVisible = currentRoomLightIntensity > 0.02;
  const lanternGlow = Math.min(1, currentRoomLightIntensity / 1.1);

  roomMeshesMap.forEach((entry) => {
    if (entry.roomLight) {
      entry.roomLight.intensity = currentRoomLightIntensity;
      entry.roomLight.visible = lightVisible;
    }
    if (entry.lanternMat) {
      entry.lanternMat.emissiveIntensity = 0.15 + lanternGlow * 0.85;
    }
  });

  for (const mat of streetLampMats) {
    mat.emissiveIntensity = 0.18 + lanternGlow * 0.95;
  }

  if (document.body.dataset.dayPhase !== phase.id) {
    document.body.dataset.dayPhase = phase.id;
  }
}

// Free GPU geometries and materials safely (preserving TextureCache & shared geometries)
function disposeObject3D(root) {
  if (!root) return;
  root.traverse((child) => {
    if (child.isMesh || child.isLineSegments) {
      if (child.geometry && !(child.geometry.userData && child.geometry.userData.shared)) {
        child.geometry.dispose();
      }
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (m && typeof m.dispose === 'function') m.dispose();
        }
      }
    }
  });
}

function gridToWorld3D(gx, gy) {
  const gridSize = getGridSize();
  const step = GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_GAP;
  const ox = (gridSize - 1) / 2;
  const oz = (gridSize - 1) / 2;
  return new THREE.Vector3((gx - ox) * step, 0, (gy - oz) * step);
}

// Build Studio Ground Grid (expandable plots + subtle decorative outer architectural grid)
function buildGroundGrid() {
  while (groundGroup.children.length) {
    const child = groundGroup.children[0];
    disposeObject3D(child);
    groundGroup.remove(child);
  }
  plotHitMeshes.length = 0;
  plotOutlineMeshes.clear();

  // Shadow-receiving studio tabletop plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.ShadowMaterial({ opacity: 0.14 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.02;
  shadowPlane.receiveShadow = true;
  groundGroup.add(shadowPlane);

  const gridSize = getGridSize();
  const tileGeo = new THREE.BoxGeometry(GAME_CONFIG.TILE_SIZE, 0.08, GAME_CONFIG.TILE_SIZE);
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(GAME_CONFIG.TILE_SIZE - 0.04, 0.09, GAME_CONFIG.TILE_SIZE - 0.04));

  // Outer decorative grid lines (skip +Z side where the 3D street & sidewalk sit)
  const pad = 2;
  for (let gx = -pad; gx < gridSize + pad; gx++) {
    for (let gy = -pad; gy < gridSize; gy++) {
      const inBounds = gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize;
      const pos = gridToWorld3D(gx, gy);

      if (!inBounds) {
        const line = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.42 })
        );
        line.position.set(pos.x, 0.0, pos.z);
        groundGroup.add(line);
      } else {
        const mat = toonMat({
          color: 0xE6D7BE,
          roughness: 0.92,
          metalness: 0.0
        });
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.position.set(pos.x, -0.04, pos.z);
        tile.receiveShadow = true;
        tile.userData = { gx, gy };
        groundGroup.add(tile);
        plotHitMeshes.push(tile);

        const border = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85 })
        );
        border.position.set(pos.x, 0.01, pos.z);
        groundGroup.add(border);
        plotOutlineMeshes.set(`${gx}_${gy}`, { tile, border });
      }
    }
  }

  buildStreetScene();
}

function buildStreetScooter(bodyColor) {
  const sc = new THREE.Group();
  addBox(sc, 0.64, 0.22, 0.26, 0, 0.28, 0, bodyColor, { roughness: 0.4 });
  addBox(sc, 0.08, 0.36, 0.08, 0.24, 0.48, 0, 0x3A4046);
  addBox(sc, 0.06, 0.05, 0.32, 0.24, 0.66, 0, 0x2B3036);
  addBox(sc, 0.06, 0.10, 0.12, 0.33, 0.46, 0, 0xFFF4B8, { emissive: 0xFFE07D, emissiveIntensity: 0.8 });
  [-0.22, 0.22].forEach((wx) => {
    const wheel = addCyl(sc, 0.13, 0.13, 0.08, wx, 0.13, 0, 0x25282C);
    wheel.rotation.x = Math.PI / 2;
  });
  // Rider
  addCyl(sc, 0.13, 0.15, 0.34, -0.04, 0.56, 0, 0x455A64);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    toonMat({ color: 0xF2C94C, roughness: 0.4 })
  );
  helmet.position.set(-0.02, 0.84, 0);
  sc.add(helmet);
  return sc;
}

function buildStreetScene() {
  while (streetGroup.children.length) {
    const child = streetGroup.children[0];
    disposeObject3D(child);
    streetGroup.remove(child);
  }
  streetLampMats.length = 0;
  streetVehicles.length = 0;

  const gridSize = getGridSize();
  const step = GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_GAP;
  const frontRowCenterZ = ((gridSize - 1) / 2) * step;
  const frontEdgeZ = frontRowCenterZ + GAME_CONFIG.TILE_SIZE / 2;

  const spanX = (gridSize + 3.2) * step;
  const sidewalkW = 2.05;
  const roadW = 3.35;
  const sidewalkZ = frontEdgeZ + sidewalkW / 2 + 0.06;
  const roadZ = sidewalkZ + sidewalkW / 2 + roadW / 2;
  streetMetrics = { sidewalkZ, roadZ, halfSpan: spanX / 2, frontEdgeZ };

  // Warm tiled Vietnamese sidewalk
  const swTex = makeFloorTexture('tile', '#E7DFD3');
  swTex.wrapS = THREE.RepeatWrapping;
  swTex.wrapT = THREE.RepeatWrapping;
  addBox(streetGroup, spanX, 0.14, sidewalkW, 0, 0.03, sidewalkZ, 0xFFFFFF, { map: swTex, roughness: 0.85, castShadow: false });
  // Stone curb between sidewalk and asphalt
  addBox(streetGroup, spanX, 0.16, 0.14, 0, 0.04, sidewalkZ + sidewalkW / 2, 0xABA297, { roughness: 0.8 });

  // Asphalt 2-lane street
  addBox(streetGroup, spanX, 0.08, roadW, 0, -0.02, roadZ, 0x454B54, { roughness: 0.9, castShadow: false });
  // Far-side curb trim
  addBox(streetGroup, spanX, 0.15, 0.36, 0, 0.03, roadZ + roadW / 2 + 0.16, 0xD2C8BC, { roughness: 0.85 });

  // Dashed center lane markings
  for (let lx = -spanX / 2 + 1.2; lx < spanX / 2 - 1.0; lx += 2.1) {
    if (Math.abs(lx) < 1.8) continue; // leave gap for zebra crosswalk
    addBox(streetGroup, 0.95, 0.02, 0.10, lx, 0.025, roadZ, 0xF2C94C, { castShadow: false });
  }

  // Zebra Crosswalk leading to restaurant entrance
  for (let cz = -1.2; cz <= 1.2; cz += 0.48) {
    addBox(streetGroup, 1.55, 0.022, 0.24, 0, 0.026, roadZ + cz, 0xF7F5F0, { castShadow: false });
  }

  // Welcoming Entrance Archway & Red Carpet Mat on Sidewalk
  addBox(streetGroup, 1.95, 0.03, 0.95, 0, 0.11, sidewalkZ - 0.35, 0xC86234);
  const arch = new THREE.Group();
  arch.position.set(0, 0.10, sidewalkZ + 0.62);
  addBox(arch, 0.14, 2.25, 0.14, -1.05, 1.12, 0, 0x7A4B2E);
  addBox(arch, 0.14, 2.25, 0.14, 1.05, 1.12, 0, 0x7A4B2E);
  addBox(arch, 2.46, 0.28, 0.24, 0, 2.28, 0, 0x8E5B36);
  addBox(arch, 1.75, 0.34, 0.12, 0, 2.28, 0.10, 0xFFF3D6, { emissive: 0xFF9F43, emissiveIntensity: 0.45 });
  streetGroup.add(arch);

  // Waiting bench & A-frame sidewalk menu board
  addBox(streetGroup, 1.15, 0.08, 0.38, -2.35, 0.36, sidewalkZ - 0.42, 0x9C6B43);
  addBox(streetGroup, 1.15, 0.30, 0.06, -2.35, 0.54, sidewalkZ - 0.58, 0x8A5A35);
  addBox(streetGroup, 0.08, 0.28, 0.34, -2.82, 0.22, sidewalkZ - 0.42, 0x3D3530);
  addBox(streetGroup, 0.08, 0.28, 0.34, -1.88, 0.22, sidewalkZ - 0.42, 0x3D3530);
  // A-frame menu board
  addBox(streetGroup, 0.42, 0.58, 0.06, 1.68, 0.38, sidewalkZ + 0.25, 0x332A24, { rotY: -0.25 });
  addBox(streetGroup, 0.32, 0.42, 0.02, 1.68, 0.40, sidewalkZ + 0.29, 0xF5E7D3, { rotY: -0.25 });

  // Classic Phố Cổ Streetlamps & Sidewalk Trees
  const lampOffsets = [-spanX * 0.34, -3.6, 3.6, spanX * 0.34];
  lampOffsets.forEach((lx, idx) => {
    addCyl(streetGroup, 0.05, 0.08, 2.35, lx, 1.25, sidewalkZ + 0.72, 0x2C3238, { metalness: 0.5 });
    addBox(streetGroup, 0.36, 0.05, 0.05, lx, 2.40, sidewalkZ + 0.72, 0x2C3238);
    const bulbMat = toonMat({
      color: 0xFFF6D6,
      emissive: 0xFFA940,
      emissiveIntensity: 0.25,
      roughness: 0.25
    });
    streetLampMats.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), bulbMat);
    bulb.position.set(lx, 2.28, sidewalkZ + 0.72);
    streetGroup.add(bulb);

    if (idx % 2 === 0) {
      addPlant(streetGroup, lx + (idx === 0 ? 1.4 : -1.4), sidewalkZ + 0.65, 1.15);
    }
  });

  // Passing street scooters on both lanes
  const scooterCols = [0xD65A42, 0x2F7D63, 0x3E84A8];
  scooterCols.forEach((col, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const sc = buildStreetScooter(col);
    const laneZ = roadZ + (dir > 0 ? 0.76 : -0.76);
    sc.position.set(-spanX * 0.35 + i * 7.5, 0.02, laneZ);
    if (dir < 0) sc.rotation.y = Math.PI;
    streetGroup.add(sc);
    streetVehicles.push({ mesh: sc, dir, speed: 3.2 + i * 0.55 });
  });
}

// Reusable 3D Builder Helpers
function addBox(parent, w, h, d, x, y, z, color, opts = {}) {
  const mat = toonMat({
    color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.72,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.04,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    map: opts.map || null,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  if (opts.outline !== false && !opts.transparent && Math.min(w, h, d) > 0.015) addOutline(mesh);
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, rt, rb, h, x, y, z, color, opts = {}) {
  const mat = toonMat({
    color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.65,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.05
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 14), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  if (opts.outline !== false && h > 0.015) addOutline(mesh);
  parent.add(mesh);
  return mesh;
}

function addPlant(parent, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  addCyl(g, 0.20, 0.14, 0.34, 0, 0.17, 0, 0xC28258, { roughness: 0.78 });
  addCyl(g, 0.17, 0.17, 0.04, 0, 0.34, 0, 0x5A4232);
  const leafMat = toonMat({ color: 0x4A8B57, roughness: 0.65 });
  const leafMat2 = toonMat({ color: 0x62A86E, roughness: 0.65 });
  [[0,0.62,0,0.24],[0.14,0.54,0.08,0.17],[-0.13,0.56,-0.07,0.18],[0.04,0.74,-0.06,0.16]].forEach(([lx,ly,lz,r], idx) => {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), idx % 2 === 0 ? leafMat : leafMat2);
    s.position.set(lx, ly, lz);
    s.castShadow = true;
    g.add(s);
  });
  parent.add(g);
}

function addChair(parent, x, z, rotY = 0, seatColor = 0x9C6B43) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  addBox(g, 0.34, 0.05, 0.34, 0, 0.32, 0, seatColor);
  addBox(g, 0.34, 0.32, 0.05, 0, 0.50, -0.15, seatColor);
  [[-0.13,-0.13],[0.13,-0.13],[-0.13,0.13],[0.13,0.13]].forEach(([lx,lz]) => {
    addBox(g, 0.04, 0.30, 0.04, lx, 0.15, lz, 0x5C4332);
  });
  parent.add(g);
}

function createMiniCharacter(role, outfitColor, isGuest = false) {
  const g = new THREE.Group();
  const hairColors = [0x362820, 0x523726, 0x26211F, 0x6E4C34];
  const hairCol = hairColors[Math.floor(Math.random() * hairColors.length)];

  // Chibi proportions: short body, big round head with a face.
  const legL = addBox(g, 0.11, 0.26, 0.12, -0.075, 0.13, 0, 0x3D3A38);
  const legR = addBox(g, 0.11, 0.26, 0.12, 0.075, 0.13, 0, 0x3D3A38);
  addCyl(g, 0.15, 0.2, 0.34, 0, 0.42, 0, outfitColor);
  if (!isGuest && (role === 'kitchen' || role === 'dining')) {
    addBox(g, 0.22, 0.24, 0.02, 0, 0.4, 0.17, 0xFFF8EC); // apron
  }
  [-1, 1].forEach((side) => {
    addCyl(g, 0.045, 0.05, 0.24, side * 0.2, 0.46, 0.02, outfitColor);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), toonMat({ color: 0xF6CFAE }));
    hand.position.set(side * 0.21, 0.33, 0.03);
    g.add(addOutline(hand));
  });

  const headY = 0.82;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), toonMat({ color: 0xF6CFAE }));
  head.scale.set(1, 0.94, 0.96);
  head.position.set(0, headY, 0);
  head.castShadow = true;
  g.add(addOutline(head, 1.2));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2A1E18 });
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xF29A8B, transparent: true, opacity: 0.75 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMat);
    eye.scale.set(0.8, 1.15, 0.5);
    eye.position.set(side * 0.085, headY - 0.01, 0.225);
    g.add(eye);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), blushMat);
    blush.position.set(side * 0.15, headY - 0.07, 0.2);
    blush.rotation.y = side * 0.55;
    g.add(blush);
  });

  const hatOrHair = (geo, color, y, scale) => {
    const m = new THREE.Mesh(geo, toonMat({ color }));
    m.position.set(0, y, 0);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    g.add(addOutline(m, 1.2));
    return m;
  };
  if (role === 'kitchen' && !isGuest) {
    hatOrHair(new THREE.SphereGeometry(0.262, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairCol, headY + 0.01, [1, 0.9, 1]);
    hatOrHair(new THREE.CylinderGeometry(0.17, 0.16, 0.16, 16), 0xFFFFFF, headY + 0.27);
    hatOrHair(new THREE.SphereGeometry(0.2, 14, 10), 0xFFFFFF, headY + 0.38, [1, 0.7, 1]);
  } else if ((role === 'dispatch' || role === 'drone_hub') && !isGuest) {
    hatOrHair(new THREE.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), role === 'drone_hub' ? 0x2B6E8C : 0xD15540, headY + 0.02);
  } else if (role === 'cold_storage' && !isGuest) {
    hatOrHair(new THREE.SphereGeometry(0.265, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x7DB8D8, headY + 0.02);
  } else if (role === 'dining' && !isGuest) {
    // Waiter: hair plus a little red headband
    hatOrHair(new THREE.SphereGeometry(0.265, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairCol, headY + 0.02);
    hatOrHair(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 18), 0xD8402F, headY + 0.1);
  } else {
    hatOrHair(new THREE.SphereGeometry(0.265, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairCol, headY + 0.02);
    // fringe on the forehead
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), toonMat({ color: hairCol }));
    fringe.position.set(0, headY + 0.06, 0.07);
    fringe.rotation.x = 0.5;
    g.add(fringe);
    if (isGuest && Math.random() < 0.4) {
      // ponytail / bun
      hatOrHair(new THREE.SphereGeometry(0.1, 10, 8), hairCol, headY + 0.14).position.z = -0.24;
    }
  }

  // Carried prop
  if ((role === 'packing' || role === 'warehouse') && !isGuest) {
    addBox(g, 0.24, 0.20, 0.22, 0, 0.52, 0.22, 0xC9935B, { roughness: 0.85 });
  } else if (role === 'cold_storage' && !isGuest) {
    addBox(g, 0.24, 0.18, 0.22, 0, 0.52, 0.22, 0x7EC8E3, { roughness: 0.45 });
  } else if (role === 'marketing' && !isGuest) {
    addBox(g, 0.08, 0.14, 0.03, 0.12, 0.58, 0.22, 0x2B333B);
  } else if (role === 'drone_hub' && !isGuest) {
    addBox(g, 0.20, 0.06, 0.14, 0, 0.52, 0.22, 0x3D434A);
  } else if (role === 'dining' && !isGuest) {
    addCyl(g, 0.16, 0.14, 0.03, 0.14, 0.52, 0.20, 0x3D3530);
    addCyl(g, 0.08, 0.06, 0.06, 0.14, 0.56, 0.20, 0xE67E45);
  }

  g.userData = { legL, legR };
  return g;
}
// =========================================================================
// 7. CAMERA RESIZE & UPDATE
// =========================================================================
function updateCameraProjection() {
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  const aspect = w / Math.max(1, h);
  renderer.setSize(w, h, false);
  camera.left = (-viewSize * aspect) / 2;
  camera.right = (viewSize * aspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
}

function updateCameraTransform() {
  camYawCurrent += (camYawGoal - camYawCurrent) * 0.14;
  const horiz = camDist * Math.cos(camPitch);
  camera.position.set(
    camTarget.x + Math.sin(camYawCurrent) * horiz,
    camTarget.y + camDist * Math.sin(camPitch),
    camTarget.z + Math.cos(camYawCurrent) * horiz
  );
  camera.lookAt(camTarget);
}

function resetCamera() {
  const w = canvas.parentElement.clientWidth;
  const scale = getGridSize() / 4;
  viewSize = (w < 640 ? 17 : (w < 1024 ? 14 : 11.5)) * scale;
  camTarget.set(0.4, 0.35, 2.3 * scale);
  camYawIndex = 0;
  camYawGoal = Math.PI / 4;
  updateCameraProjection();
}

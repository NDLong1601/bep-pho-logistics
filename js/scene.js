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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();

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
const hemiLight = new THREE.HemisphereLight(0xFFFBF2, 0xD2C3B2, 0.78);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xFFF3DE, 0.92);
sunLight.position.set(16, 28, 12);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 4;
sunLight.shadow.camera.far = 70;
const d = 22;
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
const roomsGroup = new THREE.Group();
const effectsGroup = new THREE.Group();
scene.add(groundGroup, roomsGroup, effectsGroup);

// Raycasting & Plot meshes
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const plotHitMeshes = [];
const plotOutlineMeshes = new Map();
const roomMeshesMap = new Map(); // key -> { group, animHooks, agents }
const roomTagMap = new Map();    // key -> DOM element
const activeFloaters = [];
const steamPuffs = [];
const sharedSteamGeo = new THREE.SphereGeometry(0.12, 8, 8);
sharedSteamGeo.userData = { shared: true };

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
  const step = GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_GAP;
  const ox = (GAME_CONFIG.GRID_COLS - 1) / 2;
  const oz = (GAME_CONFIG.GRID_ROWS - 1) / 2;
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
    new THREE.PlaneGeometry(120, 120),
    new THREE.ShadowMaterial({ opacity: 0.14 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.02;
  shadowPlane.receiveShadow = true;
  groundGroup.add(shadowPlane);

  const step = GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_GAP;
  const tileGeo = new THREE.BoxGeometry(GAME_CONFIG.TILE_SIZE, 0.08, GAME_CONFIG.TILE_SIZE);
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(GAME_CONFIG.TILE_SIZE - 0.04, 0.09, GAME_CONFIG.TILE_SIZE - 0.04));

  // Outer decorative grid lines (2 rings outside buildable area like reference image)
  const pad = 2;
  for (let gx = -pad; gx < GAME_CONFIG.GRID_COLS + pad; gx++) {
    for (let gy = -pad; gy < GAME_CONFIG.GRID_ROWS + pad; gy++) {
      const inBounds = gx >= 0 && gx < GAME_CONFIG.GRID_COLS && gy >= 0 && gy < GAME_CONFIG.GRID_ROWS;
      const pos = gridToWorld3D(gx, gy);

      if (!inBounds) {
        const line = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.42 })
        );
        line.position.set(pos.x, 0.0, pos.z);
        groundGroup.add(line);
      } else {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xF5F0E8,
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
}

// Reusable 3D Builder Helpers
function addBox(parent, w, h, d, x, y, z, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
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
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, rt, rb, h, x, y, z, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.65,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.05
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 14), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

function addPlant(parent, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  addCyl(g, 0.20, 0.14, 0.34, 0, 0.17, 0, 0xC28258, { roughness: 0.78 });
  addCyl(g, 0.17, 0.17, 0.04, 0, 0.34, 0, 0x5A4232);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4A8B57, roughness: 0.65 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x62A86E, roughness: 0.65 });
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

  // Legs
  const legL = addBox(g, 0.11, 0.30, 0.11, -0.075, 0.15, 0, 0x3D3A38);
  const legR = addBox(g, 0.11, 0.30, 0.11, 0.075, 0.15, 0, 0x3D3A38);

  // Torso
  addCyl(g, 0.16, 0.19, 0.40, 0, 0.48, 0, outfitColor, { roughness: 0.75 });

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xF3C7A4, roughness: 0.65 })
  );
  head.position.set(0, 0.84, 0);
  head.castShadow = true;
  g.add(head);

  // Role headwear / hair
  if (role === 'kitchen' && !isGuest) {
    addCyl(g, 0.14, 0.13, 0.16, 0, 1.03, 0, 0xFFFFFF, { roughness: 0.5 });
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 })
    );
    puff.position.set(0, 1.12, 0);
    g.add(puff);
  } else if (role === 'dispatch' && !isGuest) {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({ color: 0xD15540, roughness: 0.35 })
    );
    helmet.position.set(0, 0.87, 0);
    g.add(helmet);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.8 })
    );
    hair.position.set(0, 0.87, 0);
    g.add(hair);
  }

  // Carried prop
  if ((role === 'packing' || role === 'warehouse') && !isGuest) {
    addBox(g, 0.24, 0.20, 0.22, 0, 0.52, 0.22, 0xC9935B, { roughness: 0.85 });
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
  viewSize = w < 640 ? 22 : (w < 1024 ? 17.5 : 14.8);
  camTarget.set(0, 0.4, 0);
  camYawIndex = 0;
  camYawGoal = Math.PI / 4;
  updateCameraProjection();
}

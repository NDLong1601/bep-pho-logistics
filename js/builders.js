// =========================================================================
// 6. DETAILED ARCHITECTURAL ROOM BUILDERS (EXTENSIBLE REGISTRY)
// =========================================================================
function buildRoomShell(room, cfg) {
  const group = new THREE.Group();
  const s = GAME_CONFIG.TILE_SIZE - 0.06;
  const step = GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_GAP;
  const wh = GAME_CONFIG.WALL_HEIGHT;
  const floorH = 0.26;
  const wallT = 0.14;
  const hs = s / 2;
  const gridSize = getGridSize();

  const nbNX = getRoomAt(room.gx - 1, room.gy);
  const nbPX = getRoomAt(room.gx + 1, room.gy);
  const nbNZ = getRoomAt(room.gx, room.gy - 1);
  const nbPZ = getRoomAt(room.gx, room.gy + 1);

  const mergeNX = !!(nbNX && nbNX.type === room.type);
  const mergePX = !!(nbPX && nbPX.type === room.type);
  const mergeNZ = !!(nbNZ && nbNZ.type === room.type);
  const mergePZ = !!(nbPZ && nbPZ.type === room.type);

  const doorNX = !!(nbNX && nbNX.type !== room.type);
  const doorPX = !!(nbPX && nbPX.type !== room.type);
  const doorNZ = !!(nbNZ && nbNZ.type !== room.type);
  const doorPZ = !!(nbPZ && nbPZ.type !== room.type);
  const isStreetFront = (room.gy === gridSize - 1) && (room.type === 'dining' || room.type === 'cafe' || room.type === 'marketing' || room.type === 'dispatch');

  // Wooden architectural base plinth
  addBox(group, s, floorH, s, 0, floorH / 2, 0, cfg.trimColor, { roughness: 0.72 });

  // Prestige milestone base trim for high/infinite levels (Lv.5+, Lv.10+, Lv.15+)
  if (room.level >= 5) {
    const tierCol = room.level >= 15 ? 0x5CE1E6 : (room.level >= 10 ? 0xE2ECF5 : 0xE6B34C);
    const tierEm = room.level >= 15 ? 0x2AB7CA : (room.level >= 10 ? 0x8FA8BF : 0xB8860B);
    addBox(group, s + 0.05, 0.05, s + 0.05, 0, 0.06, 0, tierCol, {
      metalness: 0.65, roughness: 0.25, emissive: tierEm, emissiveIntensity: room.level >= 15 ? 0.45 : 0.18
    });
  }

  // Textured floor surface
  const floorTex = makeFloorTexture(cfg.floorStyle, cfg.floorTint);
  addBox(group, s - 0.12, 0.05, s - 0.12, 0, floorH + 0.01, 0, 0xFFFFFF, {
    map: floorTex, roughness: 0.82, castShadow: false
  });

  // Seamless Floor Bridges when merging adjacent same-type rooms
  const plinthGap = step - s + 0.06;
  const floorGap = step - (s - 0.12) + 0.06;
  if (mergePX) {
    addBox(group, plinthGap, floorH, s, step / 2, floorH / 2, 0, cfg.trimColor, { roughness: 0.72 });
    addBox(group, floorGap, 0.05, s - 0.12, step / 2, floorH + 0.012, 0, 0xFFFFFF, { map: floorTex, roughness: 0.82, castShadow: false });
  }
  if (mergePZ) {
    addBox(group, s, floorH, plinthGap, 0, floorH / 2, step / 2, cfg.trimColor, { roughness: 0.72 });
    addBox(group, s - 0.12, 0.05, floorGap, 0, floorH + 0.012, step / 2, 0xFFFFFF, { map: floorTex, roughness: 0.82, castShadow: false });
  }
  if (mergePX && mergePZ) {
    const nbDiag = getRoomAt(room.gx + 1, room.gy + 1);
    if (nbDiag && nbDiag.type === room.type) {
      addBox(group, plinthGap, floorH, plinthGap, step / 2, floorH / 2, step / 2, cfg.trimColor, { roughness: 0.72 });
      addBox(group, floorGap, 0.05, floorGap, step / 2, floorH + 0.012, step / 2, 0xFFFFFF, { map: floorTex, roughness: 0.82, castShadow: false });
    }
  }

  // Doorway Threshold Bridges between different-type rooms & Street Entrance Steps
  const doorW = 1.08;
  const doorH = 1.68;
  if (doorPX) {
    addBox(group, floorGap, floorH, doorW + 0.18, step / 2, floorH / 2, 0, cfg.trimColor);
    addBox(group, floorGap + 0.04, 0.055, doorW + 0.06, step / 2, floorH + 0.014, 0, 0xD2A473);
  }
  if (doorPZ) {
    addBox(group, doorW + 0.18, floorH, floorGap, 0, floorH / 2, step / 2, cfg.trimColor);
    addBox(group, doorW + 0.06, 0.055, floorGap + 0.04, 0, floorH + 0.014, step / 2, 0xD2A473);
  }
  if (isStreetFront) {
    addBox(group, 1.32, 0.16, 0.34, 0, 0.08, hs + 0.16, cfg.trimColor);
    addBox(group, 1.24, 0.04, 0.30, 0, 0.17, hs + 0.16, 0xC86234);
  }

  // Back-Left Wall (along -X) & Back-Right Wall (along -Z) wrapped for dynamic cutaway
  const wallNX = new THREE.Group();
  wallNX.position.set(0, floorH, 0);
  wallNX.userData = { wallSide: 'NX' };
  group.add(wallNX);

  const wallNZ = new THREE.Group();
  wallNZ.position.set(0, floorH, 0);
  wallNZ.userData = { wallSide: 'NZ' };
  group.add(wallNZ);

  let windowNX = null;

  if (!mergeNX) {
    if (doorNX) {
      const seg = (s - doorW) / 2;
      addBox(wallNX, wallT, wh, seg, -hs + wallT / 2, wh / 2, -(hs - seg / 2), cfg.wallColor, { roughness: 0.88 });
      addBox(wallNX, wallT, wh, seg, -hs + wallT / 2, wh / 2, (hs - seg / 2), cfg.wallColor, { roughness: 0.88 });
      addBox(wallNX, wallT, wh - doorH, doorW, -hs + wallT / 2, doorH + (wh - doorH) / 2, 0, cfg.wallColor, { roughness: 0.88 });
      // Wooden doorway jambs & lintel
      addBox(wallNX, wallT + 0.06, doorH, 0.08, -hs + wallT / 2, doorH / 2, -doorW / 2, cfg.trimColor);
      addBox(wallNX, wallT + 0.06, doorH, 0.08, -hs + wallT / 2, doorH / 2, doorW / 2, cfg.trimColor);
      addBox(wallNX, wallT + 0.07, 0.09, doorW + 0.16, -hs + wallT / 2, doorH + 0.02, 0, cfg.trimColor);
    } else {
      addBox(wallNX, wallT, wh, s, -hs + wallT / 2, wh / 2, 0, cfg.wallColor, { roughness: 0.88 });
      if (cfg.glassFront) {
        const winH = wh - 0.55;
        windowNX = new THREE.Group();
        wallNX.add(windowNX);
        addBox(windowNX, 0.05, winH, 2.2, -hs + wallT + 0.01, 0.35 + winH / 2, 0.15, 0xB8DDF0, {
          transparent: true, opacity: 0.42, roughness: 0.12, metalness: 0.15, castShadow: false
        });
        addBox(windowNX, 0.08, winH + 0.08, 0.07, -hs + wallT + 0.02, 0.35 + winH / 2, -0.95, cfg.trimColor);
        addBox(windowNX, 0.08, winH + 0.08, 0.07, -hs + wallT + 0.02, 0.35 + winH / 2, 0.15, cfg.trimColor);
        addBox(windowNX, 0.08, winH + 0.08, 0.07, -hs + wallT + 0.02, 0.35 + winH / 2, 1.25, cfg.trimColor);
        addBox(windowNX, 0.08, 0.07, 2.26, -hs + wallT + 0.02, 0.35, 0.15, cfg.trimColor);
        addBox(windowNX, 0.08, 0.07, 2.26, -hs + wallT + 0.02, 0.35 + winH, 0.15, cfg.trimColor);
      }
    }
    addBox(wallNX, wallT + 0.05, 0.09, s + 0.04, -hs + wallT / 2, wh + 0.04, 0, cfg.trimColor, { roughness: 0.6 });
  }

  if (!mergeNZ) {
    if (doorNZ) {
      const seg = (s - doorW) / 2;
      addBox(wallNZ, seg, wh, wallT, -(hs - seg / 2), wh / 2, -hs + wallT / 2, cfg.wallColor, { roughness: 0.88 });
      addBox(wallNZ, seg, wh, wallT, (hs - seg / 2), wh / 2, -hs + wallT / 2, cfg.wallColor, { roughness: 0.88 });
      addBox(wallNZ, doorW, wh - doorH, wallT, 0, doorH + (wh - doorH) / 2, -hs + wallT / 2, cfg.wallColor, { roughness: 0.88 });
      // Wooden doorway jambs & lintel
      addBox(wallNZ, 0.08, doorH, wallT + 0.06, -doorW / 2, doorH / 2, -hs + wallT / 2, cfg.trimColor);
      addBox(wallNZ, 0.08, doorH, wallT + 0.06, doorW / 2, doorH / 2, -hs + wallT / 2, cfg.trimColor);
      addBox(wallNZ, doorW + 0.16, 0.09, wallT + 0.07, 0, doorH + 0.02, -hs + wallT / 2, cfg.trimColor);
    } else {
      addBox(wallNZ, s, wh, wallT, 0, wh / 2, -hs + wallT / 2, cfg.wallColor, { roughness: 0.88 });
    }
    addBox(wallNZ, s + 0.04, 0.09, wallT + 0.05, 0, wh + 0.04, -hs + wallT / 2, cfg.trimColor, { roughness: 0.6 });
  }

  // Low front architectural glass partitions (+Z and +X), removed on merged sides & split at doorways
  if (cfg.glassFront) {
    const railH = 0.62;
    if (!mergePZ) {
      if (doorPZ || isStreetFront) {
        const seg = (s - 0.18 - doorW) / 2;
        addBox(group, seg, railH, 0.05, -(doorW / 2 + seg / 2), floorH + railH / 2, hs - 0.07, 0xBCE0F2, { transparent: true, opacity: 0.30, roughness: 0.1, castShadow: false });
        addBox(group, seg, railH, 0.05, (doorW / 2 + seg / 2), floorH + railH / 2, hs - 0.07, 0xBCE0F2, { transparent: true, opacity: 0.30, roughness: 0.1, castShadow: false });
        addBox(group, seg + 0.06, 0.06, 0.09, -(doorW / 2 + seg / 2), floorH + railH + 0.02, hs - 0.07, cfg.trimColor);
        addBox(group, seg + 0.06, 0.06, 0.09, (doorW / 2 + seg / 2), floorH + railH + 0.02, hs - 0.07, cfg.trimColor);
        addBox(group, 0.08, railH + 0.06, 0.09, -doorW / 2, floorH + railH / 2, hs - 0.07, cfg.trimColor);
        addBox(group, 0.08, railH + 0.06, 0.09, doorW / 2, floorH + railH / 2, hs - 0.07, cfg.trimColor);
      } else {
        addBox(group, s - 0.18, railH, 0.05, 0, floorH + railH / 2, hs - 0.07, 0xBCE0F2, { transparent: true, opacity: 0.30, roughness: 0.1, metalness: 0.1, castShadow: false });
        addBox(group, s - 0.06, 0.06, 0.09, 0, floorH + railH + 0.02, hs - 0.07, cfg.trimColor);
      }
    }

    if (!mergePX) {
      if (doorPX) {
        const seg = (s - 0.18 - doorW) / 2;
        addBox(group, 0.05, railH, seg, hs - 0.07, floorH + railH / 2, -(doorW / 2 + seg / 2), 0xBCE0F2, { transparent: true, opacity: 0.28, roughness: 0.1, castShadow: false });
        addBox(group, 0.05, railH, seg, hs - 0.07, floorH + railH / 2, (doorW / 2 + seg / 2), 0xBCE0F2, { transparent: true, opacity: 0.28, roughness: 0.1, castShadow: false });
        addBox(group, 0.09, 0.06, seg + 0.06, hs - 0.07, floorH + railH + 0.02, -(doorW / 2 + seg / 2), cfg.trimColor);
        addBox(group, 0.09, 0.06, seg + 0.06, hs - 0.07, floorH + railH + 0.02, (doorW / 2 + seg / 2), cfg.trimColor);
        addBox(group, 0.09, railH + 0.06, 0.08, hs - 0.07, floorH + railH / 2, -doorW / 2, cfg.trimColor);
        addBox(group, 0.09, railH + 0.06, 0.08, hs - 0.07, floorH + railH / 2, doorW / 2, cfg.trimColor);
      } else {
        addBox(group, 0.05, railH, s - 0.18, hs - 0.07, floorH + railH / 2, 0, 0xBCE0F2, { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, castShadow: false });
        addBox(group, 0.09, 0.06, s - 0.06, hs - 0.07, floorH + railH + 0.02, 0, cfg.trimColor);
      }
    }

    if (!mergePX && !mergePZ) {
      addBox(group, 0.10, railH + 0.08, 0.10, hs - 0.07, floorH + railH / 2, hs - 0.07, cfg.trimColor);
    }
  }

  const interior = new THREE.Group();
  interior.position.y = floorH + 0.03;
  group.add(interior);

  // Warm interior pendant lantern & PointLight for sunset/night cycle
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xFFF3D6,
    emissive: 0xFF9F43,
    emissiveIntensity: 0.15,
    roughness: 0.35
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), lanternMat);
  lantern.position.set(0, floorH + 1.98, 0);
  group.add(lantern);

  const roomLight = new THREE.PointLight(0xFF9E44, 0, 5.5, 2);
  roomLight.position.set(0, floorH + 1.85, 0);
  roomLight.visible = false;
  group.add(roomLight);

  const animHooks = [];
  const builder = ROOM_BUILDERS[room.type];
  if (builder) builder(interior, room, animHooks);

  const wallPropsNX = [];
  const wallPropsNZ = [];
  interior.traverse((child) => {
    if (child.userData && child.userData.wallSide === 'NX') {
      if (mergeNX) {
        child.visible = false;
        child.userData.removedByMerge = true;
      } else if (doorNX) {
        child.position.z = -1.25;
        child.scale.z = 0.62;
      }
      wallPropsNX.push(child);
    }
    if (child.userData && child.userData.wallSide === 'NZ') {
      if (mergeNZ || (doorNZ && room.type === 'dispatch')) {
        child.visible = false;
        child.userData.removedByMerge = true;
      } else if (doorNZ && Math.abs(child.position.x) < 0.75 && child.position.y < 1.75) {
        child.position.x = 1.24;
        child.scale.x = 0.62;
      }
      wallPropsNZ.push(child);
    }
  });

  return { group, interior, animHooks, wallNX, wallNZ, windowNX, wallPropsNX, wallPropsNZ, roomLight, lanternMat };
}

const ROOM_BUILDERS = {
  warehouse(g, room) {
    // Double-door commercial cold storage fridge
    addBox(g, 0.95, 1.72, 0.72, -1.32, 0.86, -1.35, 0xEFF3F7, { roughness: 0.35, metalness: 0.18 });
    addBox(g, 0.04, 1.56, 0.04, -1.32, 0.86, -0.97, 0x9BA9B5); // door split
    addBox(g, 0.04, 0.35, 0.05, -1.42, 0.95, -0.96, 0x6E7D8A);
    addBox(g, 0.04, 0.35, 0.05, -1.22, 0.95, -0.96, 0x6E7D8A);

    // Industrial steel shelving rack with colorful produce crates
    const rack = new THREE.Group();
    rack.position.set(0.55, 0, -1.48);
    [[-0.85,-0.25],[0.85,-0.25],[-0.85,0.25],[0.85,0.25]].forEach(([px,pz]) => {
      addBox(rack, 0.06, 1.65, 0.06, px, 0.82, pz, 0x62707D, { metalness: 0.4 });
    });
    [0.45, 1.0, 1.52].forEach(sy => {
      addBox(rack, 1.76, 0.05, 0.56, 0, sy, 0, 0x8A98A6, { metalness: 0.25 });
    });
    // Crates on shelves
    addBox(rack, 0.42, 0.28, 0.38, -0.5, 0.62, 0, 0x64A36F);
    addBox(rack, 0.42, 0.28, 0.38, 0.02, 0.62, 0, 0xD99A55);
    addBox(rack, 0.42, 0.28, 0.38, 0.52, 0.62, 0, 0xE0734F);
    addBox(rack, 0.48, 0.30, 0.40, -0.32, 1.18, 0, 0xC99559);
    addBox(rack, 0.44, 0.30, 0.38, 0.32, 1.18, 0, 0x5B8FB3);
    g.add(rack);

    // Wooden pallet with stacked shipping boxes
    addBox(g, 1.05, 0.10, 0.95, 1.0, 0.05, 0.65, 0xB88754);
    addBox(g, 0.46, 0.40, 0.44, 0.78, 0.30, 0.55, 0xD4A066);
    addBox(g, 0.42, 0.36, 0.42, 1.24, 0.28, 0.72, 0xC48F56);
    if (room.level >= 2) {
      addBox(g, 0.40, 0.32, 0.38, 0.92, 0.66, 0.62, 0xE0B078);
    }
    if (room.level >= 3) {
      addBox(g, 0.72, 0.55, 0.55, -1.25, 0.28, 0.95, 0x64A36F);
      // Yellow Pallet Jack (xe nâng tay)
      const jack = new THREE.Group();
      jack.position.set(-0.15, 0, 0.88);
      addBox(jack, 0.14, 0.06, 0.72, -0.14, 0.06, -0.1, 0xE5A93B, { metalness: 0.3 });
      addBox(jack, 0.14, 0.06, 0.72, 0.14, 0.06, -0.1, 0xE5A93B, { metalness: 0.3 });
      addBox(jack, 0.42, 0.22, 0.22, 0, 0.14, 0.32, 0xD69128, { metalness: 0.3 });
      addCyl(jack, 0.03, 0.03, 0.78, 0, 0.56, 0.36, 0x3D434A);
      addBox(jack, 0.28, 0.05, 0.06, 0, 0.95, 0.36, 0x2F353B);
      g.add(jack);
    }
    if (room.level >= 4) {
      // Second compact cold produce bin rack along -X
      addBox(g, 0.58, 0.95, 0.92, -1.42, 0.48, -0.12, 0xDCE5EC, { roughness: 0.35, metalness: 0.25 });
      addBox(g, 0.44, 0.22, 0.34, -1.38, 1.06, -0.32, 0x5B9A68);
      addBox(g, 0.44, 0.22, 0.34, -1.38, 1.06, 0.12, 0xE2924E);
    }
    if (room.level >= 5) {
      // Smart warehouse status beacon & extra top crate
      addBox(g, 0.75, 0.09, 0.16, -1.32, 1.77, -1.06, 0x3BD69F, { emissive: 0x2F7D63, emissiveIntensity: 0.7 });
      addBox(g, 0.46, 0.30, 0.38, 0.55, 1.70, -1.48, 0xE6BA67);
    }
  },

  kitchen(g, room) {
    // Stainless back cooking line
    addBox(g, 2.75, 0.74, 0.76, 0.15, 0.37, -1.42, 0xD8E0E8, { roughness: 0.35, metalness: 0.35 });
    addBox(g, 2.78, 0.06, 0.80, 0.15, 0.76, -1.42, 0xEEF3F7, { roughness: 0.25, metalness: 0.45 });

    // Glowing stove burners & stock pots
    [-0.55, 0.15, 0.85].forEach((bx, idx) => {
      addCyl(g, 0.18, 0.18, 0.03, bx, 0.80, -1.42, 0x2F353B);
      addCyl(g, 0.12, 0.12, 0.04, bx, 0.81, -1.42, 0xEE6A2E, { emissive: 0xEE5A22, emissiveIntensity: 0.65 });
      if (idx < 2 || room.level >= 4) {
        addCyl(g, 0.17, 0.16, 0.24, bx, 0.94, -1.42, idx === 0 ? 0xC5CED6 : (idx === 1 ? 0xD17643 : 0xD8A852), { metalness: 0.45, roughness: 0.3 });
      }
    });

    // Overhead stainless range hood
    const hood1 = addBox(g, 2.1, 0.26, 0.72, 0.15, 1.88, -1.48, 0xCFD8E0, { roughness: 0.3, metalness: 0.45 });
    const hood2 = addBox(g, 0.42, 0.45, 0.36, 0.15, 2.18, -1.56, 0xBCC7D1, { metalness: 0.4 });
    hood1.userData.wallSide = 'NZ';
    hood2.userData.wallSide = 'NZ';

    // Central wooden butcher-block prep island
    addBox(g, 1.75, 0.66, 0.88, 0.05, 0.33, 0.35, 0xEFE6D8, { roughness: 0.75 });
    addBox(g, 1.84, 0.08, 0.96, 0.05, 0.70, 0.35, 0xC99562, { roughness: 0.6 });
    // Cutting board & plated dishes
    addBox(g, 0.42, 0.04, 0.28, -0.45, 0.76, 0.35, 0xE2BA8A);
    addCyl(g, 0.16, 0.12, 0.08, 0.35, 0.78, 0.32, 0xFFFDF8);
    addCyl(g, 0.12, 0.12, 0.04, 0.35, 0.82, 0.32, 0xD96B38);

    if (room.level >= 2) {
      // Side prep counter along left wall
      addBox(g, 0.66, 0.72, 1.45, -1.45, 0.36, 0.42, 0xDCE3EA, { metalness: 0.25 });
    }

    // Dish sink along the right wall (dishwashers stand in front of it)
    addBox(g, 0.62, 0.72, 1.3, 1.55, 0.36, 0.55, 0xDCE3EA, { metalness: 0.25, roughness: 0.4 });
    addBox(g, 0.5, 0.05, 0.9, 1.55, 0.735, 0.55, 0x9FB3C2, { metalness: 0.5, roughness: 0.25 });
    addCyl(g, 0.03, 0.03, 0.3, 1.78, 0.9, 0.55, 0xBCC7D1, { metalness: 0.6 });
    // Stack of bowls waiting to be washed
    addCyl(g, 0.12, 0.08, 0.16, 1.5, 0.82, 1.05, 0xFAF6F0);
    if (room.level >= 3) {
      // 2-tier Convection Oven with glowing glass doors
      addBox(g, 0.72, 1.24, 0.76, -1.42, 0.62, -0.78, 0xC5D0DA, { metalness: 0.4, roughness: 0.3 });
      addBox(g, 0.05, 0.36, 0.56, -1.05, 0.88, -0.78, 0xFF8C3B, { emissive: 0xFF6A1A, emissiveIntensity: 0.65 });
      addBox(g, 0.05, 0.36, 0.56, -1.05, 0.42, -0.78, 0xFF8C3B, { emissive: 0xFF6A1A, emissiveIntensity: 0.55 });
    }
    if (room.level >= 4) {
      // Overhead copper pot rack above prep island
      addBox(g, 1.35, 0.05, 0.52, 0.05, 1.82, 0.35, 0x4A3A30, { metalness: 0.5 });
      [-0.35, 0.05, 0.42].forEach((px, idx) => {
        addCyl(g, 0.13, 0.13, 0.04, px, 1.66, 0.35, idx % 2 === 0 ? 0xD17643 : 0xC5CED6, { metalness: 0.5 });
      });
    }
    if (room.level >= 5) {
      // Golden heat lamps over prep island + extra plated bowl
      [-0.38, 0.42].forEach((lx) => {
        addCyl(g, 0.03, 0.03, 0.42, lx, 1.56, 0.35, 0xB88B44);
        addCyl(g, 0.06, 0.15, 0.14, lx, 1.32, 0.35, 0xE0AE53, { emissive: 0xFFB84D, emissiveIntensity: 0.55, metalness: 0.5 });
      });
      addCyl(g, 0.15, 0.11, 0.08, -0.05, 0.78, 0.48, 0xFFFDF8);
    }
    addPlant(g, 1.55, -1.48, 0.85);
  },

  dining(g, room) {
    // Framed Bistro Menu on back-right wall
    const menuArt = addBox(g, 1.45, 0.82, 0.06, 0.25, 1.48, -1.86, 0xFFFFFF, { map: makeWallArtTexture('menu'), roughness: 0.6 });
    menuArt.userData.wallSide = 'NZ';

    // Warm wood-slat reception / order counter
    addBox(g, 1.95, 0.84, 0.62, 0.15, 0.42, -1.32, 0x9A653E, { roughness: 0.65 });
    addBox(g, 2.04, 0.07, 0.72, 0.15, 0.86, -1.32, 0xEFE2D0, { roughness: 0.5 });
    // POS tablet on counter
    addBox(g, 0.26, 0.20, 0.05, -0.35, 1.00, -1.30, 0x2F353C, { rotY: 0.2 });

    // Cozy Dining Tables + Chairs (layout shared with customer seating in customers.js;
    // bowls appear when real customers are served)
    getDiningTables(room.level).forEach(([tx, tz]) => {
      addBox(g, 0.88, 0.07, 0.88, tx, 0.56, tz, 0xC68E5A, { roughness: 0.58 });
      addCyl(g, 0.07, 0.09, 0.54, tx, 0.27, tz, 0x5A4130);
      // Chopstick holder
      addCyl(g, 0.035, 0.035, 0.12, tx, 0.65, tz - 0.3, 0x8A5A35);
      if (room.level >= 4) {
        addCyl(g, 0.07, 0.09, 0.12, tx, 0.66, tz, 0xFFE3A3, { emissive: 0xFFAF45, emissiveIntensity: 0.6 });
      }
      addChair(g, tx - 0.56, tz, Math.PI / 2, 0x8F5E3A);
      addChair(g, tx + 0.56, tz, -Math.PI / 2, 0x8F5E3A);
    });

    if (room.level >= 3) {
      // Classic wooden wine/tea display cabinet along -X wall
      addBox(g, 0.42, 1.48, 1.15, -1.56, 0.74, -0.25, 0x7A4B2E, { roughness: 0.6 });
      [0.52, 0.96].forEach((sy) => {
        [-0.3, 0, 0.3].forEach((bz, bi) => {
          addCyl(g, 0.05, 0.05, 0.22, -1.52, sy + 0.12, -0.25 + bz, bi % 2 === 0 ? 0x3D8B6E : 0xC86234);
        });
      });
    }
    if (room.level >= 5) {
      // Golden Bistro Star Plaque & reception flowers
      addBox(g, 0.34, 0.24, 0.08, 0.55, 1.02, -1.30, 0xE6B34C, { emissive: 0xD98A2B, emissiveIntensity: 0.35, metalness: 0.4 });
      addPlant(g, 0.08, 1.45, 0.8);
    }

    addPlant(g, -1.52, -1.48, 0.95);
    addPlant(g, 1.58, 1.52, 0.85);
  },

  packing(g, room, animHooks) {
    // Tall KPI Whiteboard on back-right wall (homage to reference image!)
    const kpiBoard = addBox(g, 1.85, 1.02, 0.06, 0.05, 1.42, -1.86, 0xFFFFFF, { map: makeWallArtTexture('kpi'), roughness: 0.4 });
    const kpiTray = addBox(g, 1.92, 0.06, 0.10, 0.05, 0.90, -1.84, 0x7A8794);
    kpiBoard.userData.wallSide = 'NZ';
    kpiTray.userData.wallSide = 'NZ';

    // Roller conveyor belt
    addBox(g, 2.65, 0.54, 0.72, -0.05, 0.27, -0.35, 0x5C6D7D, { roughness: 0.5, metalness: 0.3 });
    addBox(g, 2.60, 0.06, 0.64, -0.05, 0.56, -0.35, 0x3D4854, { roughness: 0.8 });

    // Animated moving parcels on conveyor
    const parcel1 = addBox(g, 0.42, 0.34, 0.40, -0.8, 0.76, -0.35, 0xD69D5E);
    const parcel2 = addBox(g, 0.38, 0.30, 0.36, 0.4, 0.74, -0.35, 0xC88F52);
    const parcel3 = room.level >= 5 ? addBox(g, 0.36, 0.32, 0.36, 0.0, 0.75, -0.35, 0xE2AE6E) : null;
    animHooks.push((t) => {
      parcel1.position.x = -1.1 + ((t * 0.42) % 2.2);
      parcel2.position.x = -1.1 + (((t * 0.42) + 1.1) % 2.2);
      if (parcel3) parcel3.position.x = -1.1 + (((t * 0.42) + 1.65) % 2.2);
    });

    // Dispatch computer workstation
    addBox(g, 1.15, 0.64, 0.62, -0.85, 0.32, 0.95, 0x9C6B43);
    addBox(g, 0.48, 0.32, 0.05, -0.95, 0.82, 0.85, 0x2B333B);
    addBox(g, 0.42, 0.26, 0.02, -0.95, 0.82, 0.88, 0x65B2D4, { emissive: 0x3B8AB0, emissiveIntensity: 0.4 });

    // Stacked ready-to-ship boxes
    addBox(g, 0.48, 0.40, 0.46, 1.15, 0.20, 0.95, 0xD69D5E);
    addBox(g, 0.42, 0.36, 0.42, 1.15, 0.58, 0.95, 0xDFAC71);
    if (room.level >= 2) {
      addBox(g, 0.44, 0.38, 0.44, 0.62, 0.19, 1.05, 0xC68C4E);
    }
    if (room.level >= 3) {
      // Automated barcode scanner arch over conveyor
      addBox(g, 0.12, 0.88, 0.08, 0.15, 0.96, -0.72, 0x3D4854, { metalness: 0.5 });
      addBox(g, 0.12, 0.88, 0.08, 0.15, 0.96, 0.02, 0x3D4854, { metalness: 0.5 });
      addBox(g, 0.18, 0.10, 0.84, 0.15, 1.38, -0.35, 0x4E5C6B, { metalness: 0.5 });
      addBox(g, 0.06, 0.04, 0.62, 0.15, 1.31, -0.35, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.85 });
    }
    if (room.level >= 4) {
      // Thermal bag prep bench along -X wall
      addBox(g, 0.56, 0.64, 1.15, -1.48, 0.32, 0.12, 0xB8C2CC, { metalness: 0.25 });
      addBox(g, 0.38, 0.32, 0.38, -1.48, 0.80, -0.15, 0xD15540);
      addBox(g, 0.38, 0.32, 0.38, -1.48, 0.80, 0.35, 0x2B8080);
    }
    if (room.level >= 5) {
      // Green logistics status tower light
      addCyl(g, 0.04, 0.06, 0.95, 1.42, 0.48, -0.35, 0x46525E);
      addCyl(g, 0.08, 0.08, 0.16, 1.42, 1.02, -0.35, 0x44D688, { emissive: 0x2F9E62, emissiveIntensity: 0.85 });
    }
  },

  dispatch(g, room, animHooks) {
    // Roll-up garage bay frame on back-right wall
    const bayBack = addBox(g, 2.15, 1.75, 0.12, 0.25, 0.88, -1.84, 0xB8C2CC, { roughness: 0.55, metalness: 0.25 });
    bayBack.userData.wallSide = 'NZ';
    for (let i = 0; i < 6; i++) {
      const slat = addBox(g, 2.08, 0.03, 0.14, 0.25, 0.25 + i * 0.28, -1.83, 0x8F9AA6);
      slat.userData.wallSide = 'NZ';
    }

    // Parcel staging table on left
    addBox(g, 0.72, 0.62, 1.55, -1.42, 0.31, -0.25, 0xB59B82);
    addBox(g, 0.40, 0.32, 0.40, -1.42, 0.78, -0.55, 0xD69D5E);
    addBox(g, 0.38, 0.30, 0.38, -1.42, 0.77, 0.05, 0xE2B27A);

    if (room.level >= 2) {
      // EV Charging / Fuel station pillar
      addBox(g, 0.28, 1.15, 0.26, 1.48, 0.58, -1.25, 0x3C4856, { metalness: 0.4 });
      addBox(g, 0.18, 0.28, 0.05, 1.48, 0.88, -1.11, 0x49D48A, { emissive: 0x2F9E62, emissiveIntensity: 0.75 });
    }

    // Cute 3D Mini Delivery Van (smoothly departs & returns!)
    const van = new THREE.Group();
    van.position.set(0.45, 0, 0.35);
    // Chassis & Cargo box
    addBox(van, 0.92, 0.72, 1.25, 0, 0.54, -0.22, 0xFAF6F0, { roughness: 0.4 });
    addBox(van, 0.94, 0.18, 1.27, 0, 0.34, -0.22, 0xD65A42); // coral stripe
    // Cab
    addBox(van, 0.88, 0.62, 0.62, 0, 0.49, 0.68, 0xD65A42, { roughness: 0.38 });
    // Windshield
    addBox(van, 0.78, 0.28, 0.06, 0, 0.62, 0.98, 0xA8D5EB, { roughness: 0.15, metalness: 0.2 });
    // Headlights
    addBox(van, 0.16, 0.10, 0.05, -0.28, 0.34, 0.99, 0xFFF2B2, { emissive: 0xFFE382, emissiveIntensity: 0.7 });
    addBox(van, 0.16, 0.10, 0.05, 0.28, 0.34, 0.99, 0xFFF2B2, { emissive: 0xFFE382, emissiveIntensity: 0.7 });
    if (room.level >= 4) {
      // Illuminated express roof sign
      addBox(van, 0.52, 0.16, 0.28, 0, 0.88, 0.62, 0xFFE382, { emissive: 0xFFB84D, emissiveIntensity: 0.65 });
    }
    // Wheels
    [[-0.46, 0.58], [0.46, 0.58], [-0.46, -0.45], [0.46, -0.45]].forEach(([wx, wz]) => {
      const w = addCyl(van, 0.18, 0.18, 0.12, wx, 0.18, wz, 0x2F3236);
      w.rotation.z = Math.PI / 2;
    });
    g.add(van);

    let scooter = null;
    if (room.level >= 3) {
      // 3D Delivery Scooter with orange insulated box
      scooter = new THREE.Group();
      scooter.position.set(-0.68, 0, 0.55);
      addBox(scooter, 0.26, 0.22, 0.66, 0, 0.32, 0, 0x2F7D63);
      addBox(scooter, 0.36, 0.34, 0.38, 0, 0.58, -0.22, 0xE67E45);
      addBox(scooter, 0.08, 0.36, 0.08, 0, 0.52, 0.26, 0x3D434A);
      addBox(scooter, 0.32, 0.05, 0.06, 0, 0.72, 0.26, 0x3D434A);
      [0.24, -0.24].forEach((wz) => {
        const sw = addCyl(scooter, 0.13, 0.13, 0.08, 0, 0.13, wz, 0x25282C);
        sw.rotation.z = Math.PI / 2;
      });
      g.add(scooter);
    }

    if (room.level >= 5) {
      // Express logistics gantry arch over exit bay
      addBox(g, 0.12, 1.55, 0.12, -1.25, 0.78, 1.68, 0x495664, { metalness: 0.4 });
      addBox(g, 0.12, 1.55, 0.12, 1.35, 0.78, 1.68, 0x495664, { metalness: 0.4 });
      addBox(g, 2.75, 0.18, 0.18, 0.05, 1.58, 1.68, 0xD65A42);
      addBox(g, 0.85, 0.08, 0.20, 0.05, 1.58, 1.68, 0xFFE382, { emissive: 0xFFB84D, emissiveIntensity: 0.7 });
    }

    animHooks.push((t) => {
      const wave = Math.sin(t * 0.9 + room.gx);
      van.position.z = 0.35 + (wave > 0.65 ? (wave - 0.65) * 2.2 : 0);
      if (scooter) {
        const sWave = Math.sin(t * 1.25 + room.gy + 1.8);
        scooter.position.z = 0.55 + (sWave > 0.55 ? (sWave - 0.55) * 2.1 : 0);
      }
    });
  },

  cafe(g, room) {
    // Curved-look espresso bar
    addBox(g, 2.25, 0.84, 0.68, 0.15, 0.42, -1.22, 0x7A4B2E, { roughness: 0.6 });
    addBox(g, 2.34, 0.07, 0.76, 0.15, 0.86, -1.22, 0xF5ECE0, { roughness: 0.45 });
    // Espresso machine
    addBox(g, 0.56, 0.44, 0.42, -0.45, 1.12, -1.25, 0xD2DCE3, { metalness: 0.5, roughness: 0.25 });
    addBox(g, 0.48, 0.08, 0.36, -0.45, 1.36, -1.25, 0xC69356, { metalness: 0.6 });
    // Glass pastry showcase
    addBox(g, 0.74, 0.38, 0.48, 0.55, 1.08, -1.20, 0xD2ECF7, { transparent: true, opacity: 0.48, roughness: 0.1 });
    addCyl(g, 0.10, 0.10, 0.08, 0.42, 0.95, -1.20, 0xE69A58);
    addCyl(g, 0.10, 0.10, 0.08, 0.68, 0.95, -1.20, 0xD96D7A);

    if (room.level >= 2) {
      // Cold brew glass tower & grinder
      addCyl(g, 0.09, 0.11, 0.42, 1.08, 1.10, -1.22, 0x6E4730, { roughness: 0.25 });
      addCyl(g, 0.08, 0.08, 0.16, 1.08, 1.38, -1.22, 0xD5ECF7, { transparent: true, opacity: 0.5 });
    }

    // Cafe round tables + stools
    const cafeTables = [[-0.82, 0.68], [0.85, 0.68]];
    if (room.level >= 3) cafeTables.push([0.0, 1.18]);
    cafeTables.forEach(([tx, tz]) => {
      addCyl(g, 0.42, 0.42, 0.06, tx, 0.58, tz, 0xDDB282);
      addCyl(g, 0.05, 0.08, 0.56, tx, 0.28, tz, 0x4A3A30);
      addChair(g, tx - 0.52, tz, Math.PI / 2, 0xC48A5A);
      addChair(g, tx + 0.52, tz, -Math.PI / 2, 0xC48A5A);
    });

    if (room.level >= 4) {
      // Warm neon coffee sign on back-right wall
      const neonBack = addBox(g, 0.95, 0.55, 0.05, 0.15, 1.52, -1.86, 0x332822);
      const neonGlow = addBox(g, 0.72, 0.34, 0.03, 0.15, 1.52, -1.82, 0xFFD08A, { emissive: 0xFF9F43, emissiveIntensity: 0.85 });
      neonBack.userData.wallSide = 'NZ';
      neonGlow.userData.wallSide = 'NZ';
    }
    if (room.level >= 5) {
      // Tiered cake stand & warm pendant bar lights
      addCyl(g, 0.18, 0.20, 0.04, 0.55, 1.32, -1.20, 0xFFFDF8);
      addCyl(g, 0.12, 0.14, 0.06, 0.55, 1.37, -1.20, 0xE67E45);
      [-0.45, 0.15, 0.75].forEach((lx) => {
        addCyl(g, 0.08, 0.12, 0.12, lx, 1.72, -1.22, 0xFFE3A3, { emissive: 0xFFAF45, emissiveIntensity: 0.7 });
      });
    }
    addPlant(g, 1.55, -1.45, 0.9);
  },

  office(g, room) {
    // World / Logistics route map on back-left wall (direct homage to reference image!)
    const routeMap = addBox(g, 0.06, 0.96, 1.65, -1.86, 1.45, -0.15, 0xFFFFFF, { map: makeWallArtTexture('map'), roughness: 0.65 });
    routeMap.userData.wallSide = 'NX';

    // Tall Mahogany Bookshelf on back-right wall filled with colorful binders
    addBox(g, 1.72, 1.75, 0.44, 0.48, 0.88, -1.62, 0x6B4026, { roughness: 0.65 });
    const bookCols = [0xC95B48, 0x4F7D99, 0xD99B4E, 0x4C8C68, 0x8F5E7E];
    [0.42, 0.92, 1.42].forEach((by, row) => {
      for (let i = 0; i < 6; i++) {
        addBox(g, 0.18, 0.30, 0.28, -0.15 + i * 0.24, by, -1.52, bookCols[(i + row) % bookCols.length]);
      }
    });

    // Executive Mahogany Desk + Chair + Dual Monitors
    addBox(g, 1.55, 0.68, 0.78, -0.05, 0.34, 0.22, 0x7A482B, { roughness: 0.55 });
    addBox(g, 1.64, 0.07, 0.86, -0.05, 0.70, 0.22, 0x8C5535, { roughness: 0.48 });
    // Monitors
    addBox(g, 0.44, 0.28, 0.04, -0.25, 0.88, 0.12, 0x2B333B, { rotY: 0.12 });
    addBox(g, 0.44, 0.28, 0.04, 0.22, 0.88, 0.12, 0x2B333B, { rotY: -0.12 });
    addChair(g, -0.05, -0.42, 0, 0x3A4652);

    if (room.level >= 2) {
      // Filing cabinet & printer station
      addBox(g, 0.62, 0.88, 0.56, -1.42, 0.44, 1.05, 0xB8C2CC, { metalness: 0.25 });
      addBox(g, 0.42, 0.24, 0.38, -1.42, 1.00, 1.05, 0x46525E);
    }
    if (room.level >= 3) {
      // Glass round meeting table + 2 chairs
      addCyl(g, 0.48, 0.48, 0.05, 1.15, 0.56, 0.62, 0xBCE0F2, { transparent: true, opacity: 0.65, roughness: 0.1 });
      addCyl(g, 0.05, 0.08, 0.54, 1.15, 0.27, 0.62, 0x4A3A30);
      addChair(g, 1.15, 1.12, Math.PI, 0x4A6E8F);
      addChair(g, 1.15, 0.12, 0, 0x4A6E8F);
    }
    if (room.level >= 4) {
      // Logistics Server Rack with glowing cyan LEDs
      addBox(g, 0.54, 1.48, 0.54, -1.46, 0.74, -1.05, 0x2B333B, { metalness: 0.5, roughness: 0.35 });
      [0.45, 0.78, 1.12].forEach((ly) => {
        addBox(g, 0.04, 0.06, 0.34, -1.18, ly, -1.05, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.8 });
      });
    }
    if (room.level >= 5) {
      // 3rd command monitor & Golden Trophy award
      addBox(g, 0.40, 0.26, 0.04, -0.02, 1.16, 0.10, 0x65B2D4, { emissive: 0x3B8AB0, emissiveIntensity: 0.55 });
      addCyl(g, 0.09, 0.06, 0.22, 0.58, 0.84, 0.22, 0xF2C04B, { emissive: 0xC98D1E, emissiveIntensity: 0.3, metalness: 0.7 });
    }

    addPlant(g, -1.48, -1.48, 0.95);
    addPlant(g, 1.55, 1.35, 0.8);
  },

  cold_storage(g, room, animHooks) {
    // Walk-in Glass Freezer Chamber on back-left
    addBox(g, 1.65, 1.68, 1.05, -0.92, 0.84, -1.25, 0xDCEAF2, { roughness: 0.3, metalness: 0.2 });
    addBox(g, 1.32, 1.32, 0.06, -0.92, 0.86, -0.71, 0x8ED6F0, { transparent: true, opacity: 0.42, roughness: 0.1 });
    addBox(g, 1.55, 0.06, 0.06, -0.92, 1.62, -0.71, 0x62E0FF, { emissive: 0x35C2E8, emissiveIntensity: 0.75 });
    // Chilled produce crates inside/near freezer
    addBox(g, 0.42, 0.30, 0.38, -1.25, 0.30, -1.10, 0x5BA3C6);
    addBox(g, 0.42, 0.30, 0.38, -0.65, 0.30, -1.10, 0x7BC4A6);

    // Overhead Cooling Condenser + Spinning Fan
    addBox(g, 0.92, 0.42, 0.36, 0.75, 1.55, -1.55, 0x9FB2C2, { metalness: 0.35 });
    const fan = new THREE.Group();
    fan.position.set(0.75, 1.55, -1.35);
    addBox(fan, 0.34, 0.06, 0.04, 0, 0, 0, 0x2F353B);
    addBox(fan, 0.06, 0.34, 0.04, 0, 0, 0, 0x2F353B);
    g.add(fan);

    // Temp readout display on back-right wall
    const tempBoard = addBox(g, 0.95, 0.56, 0.06, 0.82, 1.48, -1.86, 0x23303D);
    const tempScreen = addBox(g, 0.78, 0.38, 0.03, 0.82, 1.48, -1.82, 0x62E0FF, { emissive: 0x2FB2E0, emissiveIntensity: 0.6 });
    tempBoard.userData.wallSide = 'NZ';
    tempScreen.userData.wallSide = 'NZ';

    // Insulated pallet & frozen boxes
    addBox(g, 1.15, 0.10, 0.95, 0.85, 0.05, 0.55, 0x5B7C92);
    addBox(g, 0.46, 0.40, 0.44, 0.65, 0.30, 0.48, 0xB8E0F2);
    addBox(g, 0.44, 0.36, 0.42, 1.12, 0.28, 0.62, 0x89C4E1);

    if (room.level >= 2) {
      // Stainless chilled prep counter
      addBox(g, 1.15, 0.72, 0.62, 0.88, 0.36, -1.25, 0xDCE5EC, { metalness: 0.35, roughness: 0.25 });
    }
    if (room.level >= 3) {
      // Cryogenic cold-chain rolling cart
      addBox(g, 0.68, 0.52, 0.56, -1.22, 0.28, 0.82, 0x4E89AE);
      addBox(g, 0.54, 0.08, 0.48, -1.22, 0.58, 0.82, 0xBCE8FA);
    }
    if (room.level >= 4) {
      // Extra frozen storage rack along -X wall
      addBox(g, 0.56, 1.25, 0.95, -1.48, 0.62, 0.02, 0x9FB2C2, { metalness: 0.35 });
    }
    if (room.level >= 5) {
      // Glowing frost-blue smart status beacon
      addCyl(g, 0.05, 0.07, 0.98, 1.48, 0.49, 1.25, 0x4E5C6B);
      addCyl(g, 0.09, 0.09, 0.18, 1.48, 1.04, 1.25, 0x62E0FF, { emissive: 0x35C2E8, emissiveIntensity: 0.9 });
    }

    animHooks.push((t) => {
      fan.rotation.z = t * 6.5;
    });
  },

  marketing(g, room, animHooks) {
    // KPI & Rating Campaign Board on -Z wall
    const board = addBox(g, 1.75, 0.96, 0.06, 0.25, 1.44, -1.86, 0xFFFFFF, { map: makeWallArtTexture('kpi'), roughness: 0.4 });
    board.userData.wallSide = 'NZ';

    // Food photography studio table with Ring Light
    addBox(g, 1.15, 0.66, 0.76, -0.82, 0.33, -0.95, 0xF5ECE0, { roughness: 0.55 });
    addCyl(g, 0.22, 0.16, 0.08, -0.82, 0.70, -0.95, 0xFFFDF8);
    addCyl(g, 0.14, 0.14, 0.05, -0.82, 0.75, -0.95, 0xD96B38);
    // Studio Ring Light stand
    addCyl(g, 0.03, 0.05, 0.82, -0.82, 1.08, -1.35, 0x3D434A);
    addCyl(g, 0.22, 0.22, 0.05, -0.82, 1.48, -1.32, 0xFFF5D6, { emissive: 0xFFE382, emissiveIntensity: 0.85 });

    // Content & App dispatch desk
    addBox(g, 1.35, 0.66, 0.72, 0.75, 0.33, 0.48, 0x8C5535);
    addBox(g, 0.42, 0.28, 0.04, 0.52, 0.84, 0.36, 0x2B333B, { rotY: 0.15 });
    addBox(g, 0.38, 0.22, 0.02, 0.52, 0.84, 0.38, 0x65B2D4, { emissive: 0x3B8AB0, emissiveIntensity: 0.5, rotY: 0.15 });
    addBox(g, 0.42, 0.28, 0.04, 1.02, 0.84, 0.36, 0x2B333B, { rotY: -0.15 });
    addBox(g, 0.38, 0.22, 0.02, 1.02, 0.84, 0.38, 0xFF9F43, { emissive: 0xE67E45, emissiveIntensity: 0.5, rotY: -0.15 });
    addChair(g, 0.75, 1.06, Math.PI, 0xB84B6E);

    if (room.level >= 2) {
      // Softbox studio light
      addCyl(g, 0.03, 0.06, 1.15, -1.48, 0.58, -1.32, 0x2F353B);
      addBox(g, 0.36, 0.36, 0.16, -1.48, 1.22, -1.28, 0xFFFDF8, { emissive: 0xFFF2B2, emissiveIntensity: 0.65, rotY: 0.5 });
    }
    if (room.level >= 3) {
      // Livestream tripod + phone rig with LIVE LED
      addCyl(g, 0.03, 0.05, 1.05, -1.12, 0.52, 0.75, 0x2F353B);
      addBox(g, 0.22, 0.14, 0.04, -1.12, 1.08, 0.75, 0x2B333B);
      addBox(g, 0.08, 0.04, 0.04, -1.12, 1.20, 0.75, 0xFF4757, { emissive: 0xFF4757, emissiveIntensity: 0.9 });
    }
    if (room.level >= 4) {
      // 5-Star Neon Plaque on -X wall
      const neonPlaque = addBox(g, 0.06, 0.72, 1.25, -1.86, 1.42, 0.15, 0x332822);
      const neonStars = addBox(g, 0.03, 0.36, 0.96, -1.82, 1.42, 0.15, 0xFFD08A, { emissive: 0xFFB84D, emissiveIntensity: 0.85 });
      neonPlaque.userData.wallSide = 'NX';
      neonStars.userData.wallSide = 'NX';
    }

    let trophy = null;
    if (room.level >= 5) {
      // Rotating viral golden award pedestal
      addCyl(g, 0.24, 0.28, 0.62, 1.38, 0.31, -1.22, 0xEFE6D8);
      trophy = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.20, 0),
        new THREE.MeshStandardMaterial({ color: 0xF2C04B, emissive: 0xD98A2B, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.25 })
      );
      trophy.position.set(1.38, 0.88, -1.22);
      trophy.castShadow = true;
      g.add(trophy);
    }

    addPlant(g, -1.48, 1.42, 0.85);
    animHooks.push((t) => {
      if (trophy) {
        trophy.rotation.y = t * 1.4;
        trophy.position.y = 0.88 + Math.sin(t * 2.5) * 0.06;
      }
    });
  },

  drone_hub(g, room, animHooks) {
    // Telemetry screen on -Z wall
    const teleBoard = addBox(g, 1.85, 0.92, 0.08, 0.15, 1.35, -1.84, 0x26323D);
    const teleGlow = addBox(g, 1.62, 0.68, 0.03, 0.15, 1.35, -1.79, 0x4CE3FF, { emissive: 0x2E8EB0, emissiveIntensity: 0.55 });
    teleBoard.userData.wallSide = 'NZ';
    teleGlow.userData.wallSide = 'NZ';

    // Helipad Landing Pad with glowing 'H'
    addCyl(g, 0.92, 0.96, 0.05, 0.38, 0.025, 0.35, 0x3D4854);
    addBox(g, 0.12, 0.02, 0.72, 0.12, 0.06, 0.35, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.75 });
    addBox(g, 0.12, 0.02, 0.72, 0.64, 0.06, 0.35, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.75 });
    addBox(g, 0.52, 0.02, 0.12, 0.38, 0.06, 0.35, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.75 });

    // Automated parcel staging shelf
    addBox(g, 0.68, 0.68, 1.45, -1.42, 0.34, -0.35, 0x4A5866, { metalness: 0.35 });
    addBox(g, 0.40, 0.32, 0.40, -1.42, 0.84, -0.65, 0xD69D5E);
    addBox(g, 0.38, 0.30, 0.38, -1.42, 0.83, -0.05, 0xE2B27A);

    function buildQuadcopter(px, pz) {
      const d = new THREE.Group();
      d.position.set(px, 0.18, pz);
      addBox(d, 0.34, 0.12, 0.34, 0, 0.14, 0, 0x2F363D, { metalness: 0.5 });
      addBox(d, 0.30, 0.22, 0.28, 0, -0.02, 0, 0xE67E45); // parcel under drone
      const rotors = [];
      [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].forEach(([ax, az]) => {
        addBox(d, 0.38, 0.04, 0.05, ax * 0.5, 0.16, az * 0.5, 0x5C6D7D, { rotY: Math.atan2(ax, az) });
        const rotor = addBox(d, 0.34, 0.02, 0.05, ax, 0.20, az, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.6 });
        rotors.push(rotor);
      });
      g.add(d);
      return { group: d, rotors };
    }

    const drone1 = buildQuadcopter(0.38, 0.35);
    const drone2 = room.level >= 3 ? buildQuadcopter(-0.78, 0.72) : null;

    if (room.level >= 2) {
      // Solar Battery Dock
      addBox(g, 0.48, 0.75, 0.48, -1.45, 0.38, 1.15, 0x3C4856, { metalness: 0.4 });
      addBox(g, 0.36, 0.06, 0.36, -1.45, 0.79, 1.15, 0x49D48A, { emissive: 0x2F9E62, emissiveIntensity: 0.7 });
    }

    let radarDish = null;
    if (room.level >= 4) {
      addCyl(g, 0.06, 0.09, 0.95, 1.42, 0.48, -1.35, 0x5C6D7D);
      radarDish = addCyl(g, 0.26, 0.08, 0.16, 1.42, 1.02, -1.35, 0xDCE5EC, { metalness: 0.4 });
      radarDish.rotation.x = 0.65;
    }

    if (room.level >= 5) {
      // Illuminated Drone Launch Gantry
      addBox(g, 0.10, 1.75, 0.10, -0.58, 0.88, 1.55, 0x3D4854, { metalness: 0.4 });
      addBox(g, 0.10, 1.75, 0.10, 1.38, 0.88, 1.55, 0x3D4854, { metalness: 0.4 });
      addBox(g, 2.08, 0.14, 0.14, 0.40, 1.78, 1.55, 0x2B6E8C);
      addBox(g, 1.40, 0.06, 0.16, 0.40, 1.78, 1.55, 0x4CE3FF, { emissive: 0x35C2E8, emissiveIntensity: 0.8 });
    }

    animHooks.push((t) => {
      drone1.rotors.forEach(r => { r.rotation.y = t * 22; });
      const lift1 = Math.max(0, Math.sin(t * 1.15 + room.gx));
      drone1.group.position.y = 0.20 + lift1 * 1.35;
      drone1.group.position.z = 0.35 + lift1 * 0.55;

      if (drone2) {
        drone2.rotors.forEach(r => { r.rotation.y = -t * 22; });
        const lift2 = Math.max(0, Math.sin(t * 1.15 + room.gy + 2.4));
        drone2.group.position.y = 0.20 + lift2 * 1.25;
        drone2.group.position.z = 0.72 + lift2 * 0.45;
      }
      if (radarDish) {
        radarDish.rotation.z = t * 1.4;
      }
    });
  }
};

// Rebuild all 3D rooms & sync agents/DOM badges
function rebuildRooms3D() {
  while (roomsGroup.children.length) {
    const child = roomsGroup.children[0];
    disposeObject3D(child);
    roomsGroup.remove(child);
  }
  roomMeshesMap.clear();
  roomTagMap.forEach(el => el.remove());
  roomTagMap.clear();

  for (const room of state.rooms) {
    const cfg = GAME_CONFIG.rooms[room.type];
    if (!cfg) continue;
    const pos = gridToWorld3D(room.gx, room.gy);
    const built = buildRoomShell(room, cfg);
    built.group.position.copy(pos);
    built.group.userData = { gx: room.gx, gy: room.gy, isRoomGroup: true };
    roomsGroup.add(built.group);

    // Spawn 3D animated mini characters inside room, one per crew member
    ensureCrew(room);
    const roomAgents = [];
    for (let i = 0; i < room.staff; i++) {
      const charMesh = createMiniCharacter(room.type, cfg.staffColor, false);
      const agent = {
        mesh: charMesh,
        crew: room.crew[i],
        tx: (Math.random() - 0.5) * 2.4,
        tz: (Math.random() - 0.5) * 2.4,
        wait: Math.random() * 1.4,
        phase: Math.random() * 6
      };
      if (room.type === 'dining') {
        // Waiter: managed by updateWaiters() in customers.js
        const home = getWaiterHome(i);
        charMesh.position.set(home.x, 0, home.z);
        agent.waiter = true;
        agent.task = null;
        const carry = new THREE.Group();
        addCyl(carry, 0.11, 0.075, 0.07, 0, 0, 0, 0xFAF6F0);
        addCyl(carry, 0.095, 0.095, 0.01, 0, 0.03, 0, 0xD9A55B);
        carry.position.set(0.14, 0.6, 0.2);
        carry.visible = false;
        charMesh.add(carry);
        agent.carry = carry;
      } else {
        charMesh.position.set((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 2.2);
      }
      built.interior.add(charMesh);
      roomAgents.push(agent);
    }
    if (room.type === 'kitchen') {
      (room.washers || []).forEach((m, wi) => {
        const charMesh = createMiniCharacter('kitchen_washer', 0x6FA8C9, false);
        charMesh.position.set(1.05, 0, 0.25 + wi * 0.6);
        charMesh.rotation.y = Math.PI / 2;
        built.interior.add(charMesh);
        roomAgents.push({ mesh: charMesh, crew: m, washer: true, phase: Math.random() * 6 });
      });
    }

    const key = `${room.gx}_${room.gy}`;
    if (popAnimMap.has(key)) {
      built.group.scale.set(0.15, 0.15, 0.15);
    }
    roomMeshesMap.set(key, {
      room,
      group: built.group,
      interior: built.interior,
      animHooks: built.animHooks,
      wallNX: built.wallNX,
      wallNZ: built.wallNZ,
      windowNX: built.windowNX,
      wallPropsNX: built.wallPropsNX,
      wallPropsNZ: built.wallPropsNZ,
      roomLight: built.roomLight,
      lanternMat: built.lanternMat,
      agents: roomAgents
    });

    // Floating crisp HTML room badge + clickable 3D hazard/opportunity bubble
    const tag = document.createElement('div');
    tag.className = 'room-tag';
    tag.innerHTML = `
      <button type="button" class="room-hazard-btn hidden"></button>
      <button type="button" class="room-hazard-btn room-chore-btn hidden"></button>
      <button type="button" class="room-hazard-btn room-staff-btn hidden"></button>
      <div class="room-tag-row">
        <span>${cfg.icon}</span>
        <span class="room-tag-lv">Lv.${room.level}</span>
        <span class="room-tag-merge hidden" title="Không gian đã gộp ô"></span>
        <span class="room-tag-syn hidden" title="Thưởng vị trí liền kề"></span>
        <span class="room-tag-up hidden" title="Đủ điều kiện nâng cấp">↑</span>
      </div>
      <div class="room-tag-warn hidden"></div>
      <div class="room-tag-bar"><div class="room-tag-fill" style="width:${Math.round(room.progress * 100)}%"></div></div>
    `;
    tag.querySelector('.room-chore-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      runKitchenChore(room);
    });
    tag.querySelector('.room-staff-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      wakeRoomCrew(room);
      if (selectedPlot && selectedPlot.gx === room.gx && selectedPlot.gy === room.gy) renderDrawer();
    });
    const hzBtn = tag.querySelector('.room-hazard-btn:not(.room-chore-btn):not(.room-staff-btn)');
    hzBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resolveRoomHazard(room.gx, room.gy);
    });
    overlayLayer.appendChild(tag);
    roomTagMap.set(key, tag);
  }
  rebuildWorldAgents3D();
  updatePlotHighlights();
  rebuildSynergyLines3D();
}

function buildDoorwayPath(srcRoom, dstRoom) {
  const pA = gridToWorld3D(srcRoom.gx, srcRoom.gy);
  const pB = gridToWorld3D(dstRoom.gx, dstRoom.gy);
  const preDoor = pA.clone().lerp(pB, 0.36);
  const doorMid = pA.clone().lerp(pB, 0.50);
  const postDoor = pA.clone().lerp(pB, 0.64);
  const dest = new THREE.Vector3(
    pB.x + (Math.random() - 0.5) * 1.1,
    0.29,
    pB.z + 0.25 + (Math.random() - 0.5) * 0.9
  );
  preDoor.y = 0.29;
  doorMid.y = 0.29;
  postDoor.y = 0.29;
  return [preDoor, doorMid, postDoor, dest];
}

function getAdjacentRoomsOf(room) {
  return state.rooms.filter(r => r !== room && (Math.abs(r.gx - room.gx) + Math.abs(r.gy - room.gy) === 1));
}

function spawnStreetWalker(visitRestaurant = false, isVip = false) {
  if (streetWalkers.length >= 10) return;
  const guestColors = [0xD97B6C, 0x5B8FB3, 0x62A87C, 0xC99559, 0x8E6BB0, 0xD4828E];
  const col = isVip ? 0xE6B34C : guestColors[Math.floor(Math.random() * guestColors.length)];
  const mesh = createMiniCharacter('dining', col, true);

  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -streetMetrics.halfSpan + 0.6 : streetMetrics.halfSpan - 0.6;
  const endX = fromLeft ? streetMetrics.halfSpan - 0.6 : -streetMetrics.halfSpan + 0.6;
  const laneZ = streetMetrics.sidewalkZ + (Math.random() - 0.5) * 0.55;

  mesh.position.set(startX, 0.11, laneZ);
  worldAgentsGroup.add(mesh);

  const waypoints = [];
  // Dining room guests are simulated in customers.js; only café visitors are decorative.
  const diningRooms = state.rooms.filter(r => r.type === 'cafe');

  if (visitRestaurant && diningRooms.length > 0) {
    const gridSize = getGridSize();
    const frontChoices = diningRooms.filter(r => r.gy === gridSize - 1);
    const targetRoom = frontChoices.length > 0
      ? frontChoices[Math.floor(Math.random() * frontChoices.length)]
      : diningRooms[Math.floor(Math.random() * diningRooms.length)];
    const rPos = gridToWorld3D(targetRoom.gx, targetRoom.gy);
    const entryX = targetRoom.gy === gridSize - 1 ? rPos.x : 0;

    waypoints.push(
      { pos: new THREE.Vector3(entryX, 0.11, streetMetrics.sidewalkZ - 0.25), wait: 0.15 },
      { pos: new THREE.Vector3(rPos.x + (Math.random() - 0.5) * 0.85, 0.29, rPos.z + 0.55), wait: 3.8 + Math.random() * 2.5, dinegx: targetRoom.gx, dinegy: targetRoom.gy },
      { pos: new THREE.Vector3(entryX, 0.11, streetMetrics.sidewalkZ - 0.25), wait: 0.1 },
      { pos: new THREE.Vector3(endX, 0.11, laneZ), wait: 0 }
    );
  } else {
    waypoints.push({ pos: new THREE.Vector3(endX, 0.11, laneZ), wait: 0 });
  }

  streetWalkers.push({
    mesh,
    waypoints,
    wpIdx: 0,
    wait: 0,
    speed: isVip ? 1.85 : (1.35 + Math.random() * 0.45),
    phase: Math.random() * 6,
    isVip
  });
}

function rebuildWorldAgents3D() {
  while (worldAgentsGroup.children.length) {
    const child = worldAgentsGroup.children[0];
    disposeObject3D(child);
    worldAgentsGroup.remove(child);
  }
  roamingStaff.length = 0;
  streetWalkers.length = 0;

  // Spawn inter-room courier/waiter staff walking between adjacent rooms via doorways
  const connectedRooms = state.rooms.filter(r => getAdjacentRoomsOf(r).length > 0);
  if (connectedRooms.length > 0) {
    const courierCount = Math.min(6, Math.max(2, Math.ceil(connectedRooms.length * 0.65)));
    const roles = ['warehouse', 'dining', 'packing'];
    const cols = [0xD68432, 0x4A6E8F, 0x2B8080];
    for (let i = 0; i < courierCount; i++) {
      const startRoom = connectedRooms[i % connectedRooms.length];
      const neighbors = getAdjacentRoomsOf(startRoom);
      const nextRoom = neighbors[Math.floor(Math.random() * neighbors.length)];
      const role = roles[i % roles.length];
      const charMesh = createMiniCharacter(role, cols[i % cols.length], false);
      const pStart = gridToWorld3D(startRoom.gx, startRoom.gy);
      charMesh.position.set(pStart.x, 0.29, pStart.z + 0.2);
      worldAgentsGroup.add(charMesh);

      roamingStaff.push({
        mesh: charMesh,
        curRoom: nextRoom,
        waypoints: buildDoorwayPath(startRoom, nextRoom),
        wpIdx: 0,
        wait: Math.random() * 0.8,
        phase: Math.random() * 6
      });
    }
  }

  // Seed initial pedestrians & entering restaurant guests on the street
  for (let i = 0; i < 4; i++) {
    spawnStreetWalker(i < 2, false);
    if (streetWalkers[i]) {
      streetWalkers[i].mesh.position.x = (Math.random() - 0.5) * streetMetrics.halfSpan * 1.3;
    }
  }
}

function updatePlotHighlights() {
  plotOutlineMeshes.forEach(({ tile, border }, key) => {
    const [gx, gy] = key.split('_').map(Number);
    const occupied = !!getRoomAt(gx, gy);
    const isSel = selectedPlot && selectedPlot.gx === gx && selectedPlot.gy === gy;
    const isHov = hoveredPlot && hoveredPlot.gx === gx && hoveredPlot.gy === gy;
    const isRelocSrc = relocateSource && relocateSource.gx === gx && relocateSource.gy === gy;

    if (relocateSource) {
      if (isRelocSrc) {
        tile.material.color.setHex(0xF5D9C4);
        border.material.color.setHex(0xC86234);
        border.material.opacity = 1;
      } else if (isHov) {
        tile.material.color.setHex(0xCFECE0);
        border.material.color.setHex(0x2F7D63);
        border.material.opacity = 1;
      } else {
        tile.material.color.setHex(0xE8F5EF);
        border.material.color.setHex(0x2F7D63);
        border.material.opacity = 0.72;
      }
      return;
    }

    if (isSel) {
      tile.material.color.setHex(0xF5D9C4);
      border.material.color.setHex(0xC86234);
      border.material.opacity = 1;
    } else if (isHov) {
      tile.material.color.setHex(occupied ? 0xF7ECE0 : 0xFFFDF8);
      border.material.color.setHex(0xC86234);
      border.material.opacity = 0.72;
    } else {
      tile.material.color.setHex(0xF3EDE5);
      border.material.color.setHex(0xFFFFFF);
      border.material.opacity = occupied ? 0.25 : 0.85;
    }
  });
}

function worldToScreen(vec3) {
  const v = vec3.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
    y: (-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight
  };
}

function spawnFloater(gx, gy, text, color = '#A94D24') {
  const pos = gridToWorld3D(gx, gy);
  pos.y = GAME_CONFIG.WALL_HEIGHT + 0.9;
  const el = document.createElement('div');
  el.className = 'floater-pop';
  el.style.color = color;
  el.textContent = text;
  overlayLayer.appendChild(el);
  activeFloaters.push({ el, pos, life: 1.35, maxLife: 1.35 });
}

function spawnSteamPuff(gx, gy) {
  const pos = gridToWorld3D(gx, gy);
  const puff = new THREE.Mesh(
    sharedSteamGeo,
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.45 })
  );
  puff.position.set(pos.x + (Math.random() - 0.5) * 0.7, 1.35, pos.z - 1.35);
  effectsGroup.add(puff);
  steamPuffs.push({ mesh: puff, life: 1.1, maxLife: 1.1 });
}

// =========================================================================
// 4. PROCEDURAL ARCHITECTURAL TEXTURES (WOOD, TILE, SLATE, WALL CHARTS)
// =========================================================================
const TextureCache = {};

function makeFloorTexture(style, baseHex) {
  const key = style + '_' + baseHex;
  if (TextureCache[key]) return TextureCache[key];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 256, 256);

  if (style === 'wood' || style === 'wood_light' || style === 'wood_dark') {
    const planks = 8;
    const ph = 256 / planks;
    for (let i = 0; i < planks; i++) {
      g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(60,35,15,0.055)';
      g.fillRect(0, i * ph, 256, ph);
      g.strokeStyle = 'rgba(70,42,18,0.16)';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, i * ph); g.lineTo(256, i * ph); g.stroke();
      // Vertical plank joints
      const jx = ((i * 73 + 40) % 210) + 20;
      g.beginPath(); g.moveTo(jx, i * ph); g.lineTo(jx, (i + 1) * ph); g.stroke();
    }
  } else if (style === 'tile') {
    const step = 32;
    for (let y = 0; y < 256; y += step) {
      for (let x = 0; x < 256; x += step) {
        if (((x + y) / step) % 2 === 0) {
          g.fillStyle = 'rgba(255,255,255,0.22)';
          g.fillRect(x, y, step, step);
        }
      }
    }
    g.strokeStyle = 'rgba(130,115,98,0.16)';
    g.lineWidth = 1;
    for (let i = 0; i <= 256; i += step) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
  } else if (style === 'slate') {
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 1.2;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
  } else if (style === 'asphalt') {
    // Subtle safety stripes along front edge
    g.fillStyle = 'rgba(225, 168, 52, 0.78)';
    for (let x = 16; x < 240; x += 42) {
      g.fillRect(x, 214, 24, 10);
    }
  } else {
    // Concrete subtle joints
    g.strokeStyle = 'rgba(90,82,72,0.12)';
    g.lineWidth = 1.5;
    g.strokeRect(4, 4, 120, 120);
    g.strokeRect(132, 4, 120, 120);
    g.strokeRect(4, 132, 120, 120);
    g.strokeRect(132, 132, 120, 120);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  TextureCache[key] = tex;
  return tex;
}

function makeWallArtTexture(kind) {
  if (TextureCache['art_' + kind]) return TextureCache['art_' + kind];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 144;
  const g = c.getContext('2d');

  if (kind === 'kpi') {
    g.fillStyle = '#FCFBF9';
    g.fillRect(0, 0, 256, 144);
    g.fillStyle = '#3B4A5A';
    g.fillRect(16, 16, 86, 10);
    // Bar chart
    const bars = [44, 62, 52, 82, 95, 74];
    bars.forEach((h, i) => {
      g.fillStyle = i % 2 === 0 ? '#4B90A6' : '#E0824B';
      g.fillRect(22 + i * 24, 124 - h, 14, h);
    });
    // Trend line
    g.strokeStyle = '#3D8B6E';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(175, 110); g.lineTo(195, 86); g.lineTo(216, 94); g.lineTo(240, 52);
    g.stroke();
  } else if (kind === 'map') {
    g.fillStyle = '#E5DDD3';
    g.fillRect(0, 0, 256, 144);
    // Stylized continents / city route map
    g.fillStyle = '#9F968C';
    [[46,56,28,18],[128,48,38,22],[188,68,26,18],[82,92,22,16],[154,96,30,16]].forEach(([x,y,rx,ry]) => {
      g.beginPath(); g.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); g.fill();
    });
    // Logistics route arc
    g.strokeStyle = '#C86234';
    g.lineWidth = 2.5;
    g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(54, 58); g.quadraticCurveTo(118, 22, 188, 66); g.stroke();
  } else if (kind === 'menu') {
    g.fillStyle = '#332A24';
    g.fillRect(0, 0, 256, 144);
    g.strokeStyle = '#C6996B';
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 132);
    g.fillStyle = '#F5E7D3';
    g.font = 'bold 24px Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText('BISTRO MENU', 128, 44);
    g.fillStyle = 'rgba(245,231,211,0.55)';
    for (let i = 0; i < 4; i++) {
      g.fillRect(36, 64 + i * 16, 128, 6);
      g.fillRect(190, 64 + i * 16, 32, 6);
    }
  } else if (kind === 'phoco') {
    // Old-quarter street painting: tube houses with tiled roofs at dusk
    const sky = g.createLinearGradient(0, 0, 0, 144);
    sky.addColorStop(0, '#F2C17D');
    sky.addColorStop(1, '#E9875A');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 144);
    const houses = [[8, 54, '#E8D3A6'], [52, 40, '#D9B98A'], [96, 62, '#F0DDB5'], [140, 46, '#D6A979'], [184, 58, '#E6C99B'], [222, 44, '#DDBF92']];
    houses.forEach(([x, top, col]) => {
      g.fillStyle = col;
      g.fillRect(x, top, 40, 144 - top);
      g.fillStyle = '#9C4A2C';
      g.beginPath(); g.moveTo(x - 4, top); g.lineTo(x + 20, top - 16); g.lineTo(x + 44, top); g.closePath(); g.fill();
      g.fillStyle = '#5A7F5E';
      g.fillRect(x + 8, top + 16, 9, 14);
      g.fillRect(x + 23, top + 16, 9, 14);
      g.fillStyle = '#7A4B2E';
      g.fillRect(x + 14, 116, 12, 28);
    });
    g.fillStyle = '#4A3A30';
    g.fillRect(0, 138, 256, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  TextureCache['art_' + kind] = tex;
  return tex;
}

// Grafica dell'arena dei minigiochi col kart: un grande tavolo da gioco con il campo
// che cambia a seconda del gioco, e gli oggetti (palla, birilli, monete, gatto...).
import * as THREE from 'three';
import { OX, OZ, HW, HD, POCKETS, GOAL_HALF, TILE, TNX, TNZ, slalomCans, slalomGates } from './arena.js';

const FLOOR = {
  parcheggio: ['#3b3f4a', '#f2f2f2'], slalom: ['#5fae4f', '#ffffff'], bowling: ['#d8a35d', '#a86c2c'], collina: ['#6cbf5a', '#fff2b0'],
  autoscontro: ['#2d3a6b', '#ffd400'], patata: ['#c96b3a', '#ffcf8a'], bandiera: ['#4caf6a', '#ffffff'], calcetto: ['#2e9a3c', '#ffffff'],
  aspirapolvere: ['#c9a27a', '#a57e57'], pavimento: ['#333', '#333'], birra: ['#b98654', '#8d5c33'], raccogli: ['#b8322a', '#ffd36b'],
  gatto: ['#9fc3e8', '#ffffff'], biliardo: ['#147a4a', '#0d5c37'], monete: ['#4b7bd8', '#ffd400'], battaglia: ['#7a3fb0', '#ff8ad8'],
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5, ...o });

// disegno del campo (vista dall'alto, 1 px = 0.1 unità)
function floorTex(game) {
  const [a, b] = FLOOR[game] || ['#5fae4f', '#fff'];
  return canvasTex(1200, 800, (g, w, h) => {
    const sx = w / (HW * 2), sz = h / (HD * 2);
    const X = (x) => (x - (OX - HW)) * sx, Z = (z) => (z - (OZ - HD)) * sz;
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.strokeStyle = b; g.fillStyle = b; g.lineWidth = 8;
    if (game === 'calcetto') {
      // righe del campo a strisce
      for (let i = 0; i < 12; i++) { if (i % 2) { g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(i * w / 12, 0, w / 12, h); } }
      g.strokeStyle = '#fff'; g.strokeRect(12, 12, w - 24, h - 24);
      g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 12); g.stroke();
      g.beginPath(); g.arc(w / 2, h / 2, 110, 0, 7); g.stroke();
      g.strokeRect(12, h / 2 - 210, 150, 420); g.strokeRect(w - 162, h / 2 - 210, 150, 420);
    } else if (game === 'parcheggio') {
      g.setLineDash([40, 30]); g.strokeStyle = '#ffd400';
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
      g.setLineDash([]);
    } else if (game === 'bowling') {
      for (let i = 0; i < 30; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; g.fillRect(i * w / 30, 0, w / 30, h); }
      g.fillStyle = '#7a3b12';
      for (let i = 0; i < 7; i++) { g.beginPath(); const x = w * 0.2 + i * w * 0.1, y = h * 0.82; g.moveTo(x, y); g.lineTo(x - 18, y + 36); g.lineTo(x + 18, y + 36); g.fill(); }
    } else if (game === 'biliardo') {
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.4, h * 0.35, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 5; g.beginPath(); g.moveTo(w * 0.28, 0); g.lineTo(w * 0.28, h); g.stroke();
    } else if (game === 'pavimento') {
      // sotto le piastrelle: il vuoto
      const gr = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7); gr.addColorStop(0, '#1b1530'); gr.addColorStop(1, '#05040a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    } else if (game === 'slalom') {
      g.lineWidth = 6; g.setLineDash([30, 24]); g.strokeStyle = 'rgba(255,255,255,0.75)';
      const G = slalomGates();
      g.beginPath(); G.forEach((p, i) => { i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z)); }); g.closePath(); g.stroke(); g.setLineDash([]);
    } else {
      // pattern a pois/strisce giocoso
      g.globalAlpha = 0.16;
      for (let x = 0; x < w; x += 80) for (let y = 0; y < h; y += 80) { g.beginPath(); g.arc(x + ((y / 80) % 2) * 40, y, 12, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    }
    // bordo bianco
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 10; g.setLineDash([]); g.strokeRect(5, 5, w - 10, h - 10);
  });
}

function makePin() {
  const g = new THREE.Group();
  const white = std('#fafafa', { roughness: 0.3 }), red = std('#e53935', { roughness: 0.3 });
  const pts = [[0, 0], [0.55, 0], [0.75, 0.6], [0.7, 1.4], [0.38, 2.1], [0.32, 2.5], [0.45, 2.9], [0.3, 3.3], [0, 3.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), white); body.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.18, 18), red); band.position.y = 2.35;
  const band2 = band.clone(); band2.position.y = 2.6;
  g.add(body, band, band2);
  return g;
}
function soccerTex() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#111';
    for (let i = 0; i < 10; i++) { const x = (i % 5) * 52 + (Math.floor(i / 5) ? 26 : 0) + 10, y = Math.floor(i / 5) * 64 + 20; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.fill(); }
  });
}
function makeCat() {
  const g = new THREE.Group();
  const fur = std('#f08a2c'), dark = std('#c25e12'), white = std('#fff');
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 4.5, 6, 14), fur); body.rotation.x = Math.PI / 2; body.position.y = 2.6; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.1, 18, 14), fur); head.position.set(0, 4.4, 4.2); head.castShadow = true;
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4), dark); ear.position.set(s * 1.1, 6.3, 4.1); g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), std('#9be15d', { emissive: '#3a6b12' })); eye.position.set(s * 0.8, 4.8, 6.1); g.add(eye);
    for (const f of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 2.2, 8), fur); leg.position.set(s * 1.2, 1.1, f * 2.4); g.add(leg); }
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), white); muzzle.position.set(0, 3.9, 5.9); muzzle.scale.set(1.2, 0.8, 0.8);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.45, 8, 16, Math.PI), fur); tail.position.set(0, 4, -4.2); tail.rotation.y = Math.PI / 2;
  g.add(body, head, muzzle, tail);
  return g;
}
function makeVacuum() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 1.8, 40), std('#2a2d35', { metalness: 0.4, roughness: 0.3 }));
  body.position.y = 1.1; body.castShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 40), std('#4a4f5c', { metalness: 0.5, roughness: 0.2 })); top.position.y = 2.05;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3b30' })); led.position.set(0, 2.2, 3.4);
  const bump = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.35, 8, 40, Math.PI), std('#111')); bump.rotation.x = Math.PI / 2; bump.position.y = 0.8;
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.15, 12), std('#c9c9c9')); brush.position.set(3.6, 0.15, 3.2);
  g.add(body, top, led, bump, brush);
  g.userData.brush = brush;
  return g;
}
function makeBeer() {
  const g = new THREE.Group();
  const glass = std('#7a3d0a', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 14), glass); b.position.y = 1.2;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.6, 1.2, 12), glass); neck.position.y = 2.95;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 14), std('#ffd400')); label.position.y = 1.2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12), std('#d0d0d0', { metalness: 0.8 })); cap.position.y = 3.6;
  g.add(b, neck, label, cap);
  return g;
}
function makeFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), std('#ddd', { metalness: 0.6 })); pole.position.y = 3;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3, 2, 8, 2), new THREE.MeshStandardMaterial({ color: '#ff2d55', side: THREE.DoubleSide }));
  cloth.position.set(1.5, 5, 0);
  g.add(pole, cloth); g.userData.cloth = cloth;
  return g;
}
function makeBomb() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 14), std('#15151a', { roughness: 0.25, metalness: 0.3 }));
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), std('#c9a26b')); fuse.position.y = 1.4; fuse.rotation.z = 0.4;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcc33' })); spark.position.set(-0.25, 1.85, 0);
  g.add(b, fuse, spark); g.userData.spark = spark;
  return g;
}
function makeSofa() {
  const g = new THREE.Group();
  const red = std('#c0392b');
  const base = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, 4), red); base.position.y = 0.9;
  const back = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 1.2), red); back.position.set(0, 2.2, -1.6);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 4), red); a1.position.set(-4.2, 1.6, 0);
  const a2 = a1.clone(); a2.position.x = 4.2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.2, 7, 48), new THREE.MeshBasicMaterial({ color: '#ffd400', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12;
  g.add(base, back, a1, a2, ring); g.userData.ring = ring;
  return g;
}
const ring = (r0, r1, color, op = 0.9) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 56), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
};

export function createArenaView(scene, cfx) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  // tavolo: piano di legno grande con le gambe, il campo sopra e le sponde
  const wood = std('#8a5a33', { roughness: 0.6 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 26, 3, HD * 2 + 26), wood);
  top.position.set(OX, -1.6, OZ); top.receiveShadow = true; root.add(top);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(5, 80, 5), wood); leg.position.set(OX + a * (HW + 8), -43, OZ + b * (HD + 8)); root.add(leg);
  }
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.8, envMapIntensity: 0.45 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HD * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(OX, 0.02, OZ); floor.receiveShadow = true; root.add(floor);
  // sponde morbide (cuscini) tutto intorno
  const rimMat = std('#e8322b', { roughness: 0.4 });
  const rims = [];
  for (const [w, d, x, z] of [[HW * 2 + 6, 3, OX, OZ - HD - 1.5], [HW * 2 + 6, 3, OX, OZ + HD + 1.5], [3, HD * 2, OX - HW - 1.5, OZ], [3, HD * 2, OX + HW + 1.5, OZ]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), rimMat); m.position.set(x, 1.3, z); m.castShadow = true; root.add(m); rims.push(m);
  }
  // luce propria dell'arena (il sole della Mancave è lontano)
  const sun = new THREE.DirectionalLight('#fff4e0', 0.35); sun.position.set(OX - 30, 100, OZ + 45); sun.target.position.set(OX, 0, OZ);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 55, bottom: -55, near: 10, far: 260 });
  root.add(sun, sun.target);

  let deco = new THREE.Group(); root.add(deco);
  let built = '';
  const items = new Map();        // id -> mesh
  const extra = {};               // oggetti fissi del gioco
  const seenFx = new Set();
  const soccer = soccerTex();
  // crepe disegnate sulle piastrelle colpite una volta
  const crackTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a2410'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(20, 30); g.lineTo(55, 62); g.lineTo(48, 95); g.moveTo(55, 62); g.lineTo(100, 70); g.lineTo(115, 110); g.moveTo(80, 66); g.lineTo(90, 25); g.stroke();
  });

  function buildDeco(game, ka, players) {
    root.remove(deco);
    deco.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    deco = new THREE.Group(); root.add(deco);
    for (const k of Object.keys(extra)) delete extra[k];
    for (const m of items.values()) root.remove(m);
    items.clear();
    if (floorMat.map) floorMat.map.dispose();
    floorMat.map = floorTex(game); floorMat.needsUpdate = true;
    rimMat.color.set(game === 'biliardo' ? '#5b3518' : game === 'calcetto' ? '#f2f2f2' : '#e8322b');
    if (game === 'calcetto') {
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        const post = std('#fff', { metalness: 0.2 });
        for (const z of [-GOAL_HALF, GOAL_HALF]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 10), post); p.position.set(0, 3.5, z); g.add(p); }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, GOAL_HALF * 2, 10), post); bar.rotation.x = Math.PI / 2; bar.position.y = 7; g.add(bar);
        const net = new THREE.Mesh(new THREE.BoxGeometry(5, 7, GOAL_HALF * 2), new THREE.MeshStandardMaterial({ color: s < 0 ? '#ff8a00' : '#2f7bff', transparent: true, opacity: 0.35 }));
        net.position.set(s * 2.5, 3.5, 0); g.add(net);
        g.position.set(OX + s * (HW + 0.5), 0, OZ); deco.add(g);
        // varco nella sponda
      }
      rims[2].scale.z = rims[3].scale.z = 1;
    }
    if (game === 'biliardo') for (const p of POCKETS) { const h = new THREE.Mesh(new THREE.CircleGeometry(3.3, 32), new THREE.MeshBasicMaterial({ color: '#050505' })); h.rotation.x = -Math.PI / 2; h.position.set(p.x, 0.06, p.z); deco.add(h); }
    if (game === 'slalom') {
      const red = std('#e53935', { metalness: 0.5, roughness: 0.25 }), silver = std('#d9d9d9', { metalness: 0.9, roughness: 0.2 });
      slalomCans().forEach((c, i) => {
        const can = new THREE.Group();
        const b = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.2, 18), i % 4 < 2 ? red : std('#2f7bff', { metalness: 0.5, roughness: 0.25 })); b.position.y = 1.6; b.castShadow = true;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.25, 18), silver); t.position.y = 3.3;
        can.add(b, t); can.position.set(c.x, 0, c.z); deco.add(can);
      });
      // numeri delle porte per terra
      slalomGates().forEach((g, i) => {
        const t = canvasTex(128, 128, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '900 72px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), 64, 68); });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(g.x, 0.08, g.z); deco.add(m);
      });
    }
    if (game === 'bandiera') {
      for (const s of Object.keys(ka.base || {})) {
        const p = ka.base[s], col = (players.find(q => q.slot === Number(s)) || {}).color || '#fff';
        const r = ring(5.2, 6.6, col); r.position.set(p.x, 0.1, p.z); deco.add(r);
        const d = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false })); d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.09, p.z); deco.add(d);
      }
    }
    if (game === 'collina') {
      extra.hill = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.4, 0.6, 48), std('#ffd400', { metalness: 0.4, roughness: 0.3, transparent: true, opacity: 0.55 }));
      disc.position.y = 0.3; const r = ring(8.7, 9.6, '#fff'); r.position.y = 0.65;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 1.2, 6, 1, true), std('#ffd400', { metalness: 0.9, roughness: 0.15, side: THREE.DoubleSide }));
      crown.position.y = 7; extra.hill.add(disc, r, crown); extra.crown = crown; deco.add(extra.hill);
    }
    if (game === 'parcheggio') {
      extra.spot = new THREE.Group();
      const t = canvasTex(128, 192, (c, w, h) => { c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = 'rgba(47,123,255,0.45)'; c.fillRect(10, 10, w - 20, h - 20); c.fillStyle = '#fff'; c.font = '900 90px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', w / 2, h / 2 + 4); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 9.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.1; extra.spot.add(m);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 7; extra.spot.add(beam); deco.add(extra.spot);
    }
    if (game === 'pavimento') {
      extra.tiles = [];
      const geo = new THREE.BoxGeometry(TILE - 0.3, 1.2, TILE - 0.3);
      for (let j = 0; j < TNZ; j++) for (let i = 0; i < TNX; i++) {
        const m = new THREE.Mesh(geo, std((i + j) % 2 ? '#f2e6cf' : '#d9c39b', { roughness: 0.5 }));
        m.position.set(OX - HW + (i + 0.5) * TILE, -0.55, OZ - HD + (j + 0.5) * TILE); m.receiveShadow = true;
        deco.add(m); extra.tiles.push(m);
      }
    }
    if (game === 'birra') { extra.sofa = makeSofa(); deco.add(extra.sofa); }
    if (game === 'aspirapolvere') { extra.vac = makeVacuum(); deco.add(extra.vac); }
    if (game === 'gatto') {
      extra.cat = makeCat(); deco.add(extra.cat);
      extra.aim = ring(6.5, 7.5, '#ff2d2d', 0.95); extra.aim.position.y = 0.12; deco.add(extra.aim);
      extra.aimFill = new THREE.Mesh(new THREE.CircleGeometry(7.5, 40), new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.2, depthWrite: false })); extra.aimFill.rotation.x = -Math.PI / 2; extra.aimFill.position.y = 0.1; deco.add(extra.aimFill);
    }
    if (game === 'patata') { extra.bomb = makeBomb(); deco.add(extra.bomb); }
    if (game === 'battaglia') {
      extra.balloons = {};
      for (const p of players) {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 12), std(p.color, { roughness: 0.2, metalness: 0.1 })); b.scale.y = 1.2;
          b.position.set((i - 1) * 1.3, 6 + (i % 2) * 0.6, -1.2); g.add(b);
        }
        deco.add(g); extra.balloons[p.slot] = g;
      }
    }
    if (game === 'collina') { /* fatto sopra */ }
  }

  function makeItem(o) {
    switch (o.k) {
      case 'pin': { const m = makePin(); m.children.forEach(c => c.scale.setScalar(1.5)); m.children.forEach(c => c.position.y *= 1.5); return m; }
      case 'ball': { const m = new THREE.Mesh(new THREE.SphereGeometry(o.r, 24, 18), std('#fff', { map: soccer, roughness: 0.4 })); m.castShadow = true; return m; }
      case 'pball': { const m = new THREE.Mesh(new THREE.SphereGeometry(o.r, 20, 16), std(o.c || '#fff', { roughness: 0.12, metalness: 0.1 })); m.castShadow = true; return m; }
      case 'beer': return makeBeer();
      case 'chip': { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), std(o.gold ? '#ffd700' : '#ffc21a', { roughness: 0.35, metalness: o.gold ? 0.7 : 0, emissive: o.gold ? '#8a6000' : '#5a3a00' })); m.scale.set(1.6, 0.35, 1.1); return m; }
      case 'coin': { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 28), std('#ffd23f', { metalness: 0.6, roughness: 0.25, emissive: '#8a6000' })); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); return g; }
    }
    return new THREE.Group();
  }

  // ritorna true se l'arena è attiva (la telecamera la inquadra)
  function update(snap, players, kartMeshes, dt, tsec) {
    const P = snap.pit;
    const on = !!(P && P.kart && P.ka && ['intro', 'count', 'play', 'tie'].includes(P.stage));
    root.visible = on;
    if (!on) return false;
    const ka = P.ka;
    const key = P.id + ':' + P.game;
    if (built !== key) { built = key; buildDeco(P.game, ka, players); }
    // oggetti che vanno e vengono
    const seen = new Set();
    for (const o of ka.items) {
      let m = items.get(o.id);
      if (!m) { m = makeItem(o); root.add(m); items.set(o.id, m); }
      seen.add(o.id);
      const t = m.userData;
      // movimento morbido verso la posizione arrivata dal PC
      if (t.x == null) { t.x = o.x; t.z = o.z; }
      t.x += (o.x - t.x) * Math.min(1, dt * 18); t.z += (o.z - t.z) * Math.min(1, dt * 18);
      if (o.k === 'pin') {
        m.position.set(t.x, o.up ? 0 : 0.8, t.z);
        const want = o.up ? 0 : Math.PI / 2;
        t.tilt = (t.tilt || 0) + (want - (t.tilt || 0)) * Math.min(1, dt * 10);
        m.rotation.set(0, o.ang || 0, 0); m.rotateX(t.tilt);
      } else if (o.k === 'ball' || o.k === 'pball') {
        const dx = t.x - (t.px ?? t.x), dz = t.z - (t.pz ?? t.z);
        m.position.set(t.x, o.r, t.z);
        const ax = new THREE.Vector3(dz, 0, -dx); const l = ax.length();
        if (l > 1e-4) m.rotateOnWorldAxis(ax.normalize(), l / o.r);
        t.px = t.x; t.pz = t.z;
      } else if (o.k === 'coin') { m.position.set(t.x, 1.4 + Math.sin(tsec * 3 + o.id) * 0.3, t.z); m.rotation.y = tsec * 3 + o.id; }
      else if (o.k === 'chip') { m.position.set(t.x, 0.6 + Math.sin(tsec * 4 + o.id) * 0.2, t.z); m.rotation.y = tsec + o.id; }
      else { m.position.set(t.x, 0, t.z); m.rotation.y = tsec * 0.8 + o.id; }
    }
    for (const [id, m] of items) if (!seen.has(id)) { root.remove(m); items.delete(id); }

    const kartAt = (slot) => { const m = kartMeshes.get(slot); return m ? m.root.position : null; };
    if (extra.hill) {
      extra.hill.position.set(ka.hill.x, 0, ka.hill.z);
      extra.crown.visible = ka.king >= 0;
      const kp = ka.king >= 0 ? kartAt(ka.king) : null;
      if (kp) { extra.crown.position.set(kp.x - ka.hill.x, 6.5 + Math.sin(tsec * 5) * 0.3, kp.z - ka.hill.z); extra.crown.rotation.y = tsec * 2; }
    }
    if (extra.spot) { extra.spot.position.set(ka.spot.x, 0, ka.spot.z); extra.spot.rotation.y = ka.spot.yaw; extra.spot.children[1].material.opacity = 0.14 + Math.sin(tsec * 6) * 0.06; }
    if (extra.tiles) extra.tiles.forEach((m, i) => {
      const v = ka.tl[i];
      if (v < 0) { m.position.y = Math.max(-60, m.position.y - dt * 40); m.visible = m.position.y > -55; }
      else if (v === 2) { m.position.y = -0.55; m.material.color.set(Math.sin(tsec * 30) > 0 ? '#ff6b4a' : '#c94a2a'); m.position.x = OX - HW + ((i % TNX) + 0.5) * TILE + Math.sin(tsec * 60 + i) * 0.15; }
      else if (v === 1) { m.position.y = -0.55; m.visible = true; m.material.color.set('#d8b98a'); if (m.material.map !== crackTex) { m.material.map = crackTex; m.material.needsUpdate = true; } }
      else { m.position.y = -0.55; m.visible = true; }
    });
    if (extra.sofa) { extra.sofa.position.set(ka.sofa.x, 0, ka.sofa.z); extra.sofa.userData.ring.material.opacity = 0.6 + Math.sin(tsec * 6) * 0.3; }
    if (extra.vac) { extra.vac.position.set(ka.vac.x, 0, ka.vac.z); extra.vac.rotation.y = ka.vac.yaw; extra.vac.userData.brush.rotation.y = tsec * 25; }
    if (extra.cat) {
      const C = ka.cat;
      let y = 0;
      if (C.ph === 'jump') { const u = Math.min(1, C.pt / 0.45); y = Math.sin(u * Math.PI) * 14; }
      extra.cat.position.set(C.x, y, C.z);
      extra.cat.rotation.y = Math.atan2(C.tx - C.x, C.tz - C.z) || extra.cat.rotation.y;
      const aiming = C.ph === 'aim' || C.ph === 'jump';
      extra.aim.visible = extra.aimFill.visible = aiming;
      extra.aim.position.set(C.tx, 0.12, C.tz); extra.aimFill.position.set(C.tx, 0.1, C.tz);
      extra.aimFill.material.opacity = 0.15 + Math.abs(Math.sin(tsec * 10)) * 0.2;
    }
    if (extra.bomb) {
      const kp = ka.bomb >= 0 ? kartAt(ka.bomb) : null;
      extra.bomb.visible = !!kp;
      if (kp) { extra.bomb.position.set(kp.x, kp.y + 6 + Math.sin(tsec * 8) * 0.3, kp.z); extra.bomb.userData.spark.visible = Math.sin(tsec * (ka.bt < 3 ? 40 : 15)) > 0; const s = 1 + (ka.bt < 3 ? Math.sin(tsec * 20) * 0.15 : 0); extra.bomb.scale.setScalar(s); }
    }
    if (extra.balloons) for (const [slot, g] of Object.entries(extra.balloons)) {
      const kp = kartAt(Number(slot)), n = ka.bal[slot] || 0;
      g.visible = !!kp && n > 0;
      if (kp) { g.position.copy(kp); const m = kartMeshes.get(Number(slot)); g.rotation.y = m ? m.root.rotation.y : 0; g.children.forEach((b, i) => { b.visible = i < n; b.position.y = 6 + (i % 2) * 0.6 + Math.sin(tsec * 3 + i) * 0.25; }); }
    }
    // bandiera e birre portate in giro
    for (const o of ka.items) if (o.k === 'flag') { /* la bandiera non è un oggetto */ }
    if (ka.flag) {
      if (!extra.flag) { extra.flag = makeFlag(); deco.add(extra.flag); }
      const kp = ka.flag.by >= 0 ? kartAt(ka.flag.by) : null;
      if (kp) extra.flag.position.set(kp.x, kp.y + 1.5, kp.z); else extra.flag.position.set(ka.flag.x, 0, ka.flag.z);
      const cl = extra.flag.userData.cloth.geometry.attributes.position;
      for (let i = 0; i < cl.count; i++) { const x = cl.getX(i) + 1.5; cl.setZ(i, Math.sin(tsec * 8 - x * 1.5) * 0.25 * x); }
      cl.needsUpdate = true;
    }
    if (P.game === 'birra') {
      extra.held = extra.held || {};
      for (const p of players) {
        let m = extra.held[p.slot];
        const has = !!ka.hold[p.slot], kp = kartAt(p.slot);
        if (has && !m) { m = extra.held[p.slot] = makeBeer(); deco.add(m); }
        if (m) { m.visible = has && !!kp; if (kp) m.position.set(kp.x, kp.y + 4.2, kp.z); }
      }
    }
    // effetti: punti, esplosioni, gol
    for (const e of ka.fx || []) {
      if (seenFx.has(e.id)) continue;
      seenFx.add(e.id);
      if (!cfx) continue;
      const big = ['boom', 'goal', 'pop', 'suck', 'pounce'].includes(e.kind);
      const col = { boom: ['#ff6a00', '#ffd400', '#555'], goal: ['#ffd400', '#ffffff', '#2f7bff'], pop: ['#ff4fa3', '#fff'], gold: ['#ffd700', '#fff'], pick: ['#ffd36b', '#fff'], park: ['#4fc3ff', '#fff'], deliver: ['#ffd400', '#fff'], suck: ['#888', '#ccc'], fall: ['#555', '#222'], pounce: ['#f08a2c', '#fff'], scratch: ['#ff2d2d', '#fff'] }[e.kind] || ['#ffffff', '#ffd400'];
      cfx.burst(e.x, 2, e.z, big ? 60 : 18, { color: col, speed: big ? 22 : 10, life: big ? 1.1 : 0.6, s0: big ? 2.2 : 1.2, s1: 0.3, a: 1, grav: 18, up: 6 });
    }
    if (seenFx.size > 500) seenFx.clear();
    return true;
  }
  // telecamera fissa che inquadra tutto il tavolo
  function placeCamera(cam, aspect, tsec) {
    cam.fov = 50; cam.aspect = aspect;
    const dist = aspect < 1.4 ? 112 : 80;
    cam.position.set(OX + Math.sin(tsec * 0.15) * 2, dist * 0.84, OZ + dist * 0.6);
    cam.up.set(0, 1, 0);
    cam.lookAt(OX, 0, OZ + 3);
    cam.updateProjectionMatrix();
  }
  return { update, placeCamera, root };
}

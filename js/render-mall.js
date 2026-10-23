// Grafica della pista "Centro commerciale": kart giocattolo in un centro commerciale vero.
// Scala: 1 unità ≈ 4 cm. Piazza con la fontana, negozi con le vetrine, scala mobile che sale
// alla balconata, salto sulla pedana promozionale, porte automatiche e corsie del supermercato.
// Di giorno la luce entra dal lucernario; di notte il centro è chiuso e restano accese le insegne.
import * as THREE from 'three';
import { rng, canvas, toTex, grain, roadTex, roundBox } from './render-mancave.js';
import { addNeon } from './render.js';
import { doorOpen } from './track.js';

const RX = 200, RZ = 175, CEIL = 230, GAL = 34;      // piazza, soffitto, altezza della balconata
const GAL_X0 = -112, GAL_X1 = 58, GAL_Z0 = 118;       // balconata (lato nord)

// ------------------------------------------------------------------ texture
function marbleTex(R) {
  const c = canvas(1024, 1024), g = c.getContext('2d');
  const T = 256;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const light = (x + y) % 2 === 0;
    g.fillStyle = light ? '#efe9df' : '#e2d8c8'; g.fillRect(x * T, y * T, T, T);
    // venature
    g.strokeStyle = light ? 'rgba(150,135,115,0.18)' : 'rgba(120,100,80,0.2)'; g.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      g.beginPath(); let px = x * T + R() * T, py = y * T;
      g.moveTo(px, py);
      for (let s = 0; s < 8; s++) { px += (R() - 0.5) * 50; py += T / 8; g.lineTo(px, py); }
      g.stroke();
    }
  }
  g.strokeStyle = '#b9ae9c'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * T, 0); g.lineTo(i * T, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i * T); g.lineTo(1024, i * T); g.stroke(); }
  grain(g, 1024, 1024, 6, R);
  return toTex(c, { repeat: [1, 1] });
}
function signTex(text, bg, fg, sub = '') {
  const c = canvas(1024, 256), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 1024, 20);
  g.font = `900 ${text.length > 14 ? 96 : 120}px "Arial Black", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeText(text, 512, sub ? 112 : 134);
  g.fillStyle = fg; g.fillText(text, 512, sub ? 112 : 134);
  if (sub) { g.font = '700 46px Inter, sans-serif'; g.fillText(sub, 512, 208); }
  return toTex(c);
}
// vetrina: interno illuminato con scaffali e prodotti disegnati
function windowTex(kind, color, R) {
  const c = canvas(512, 256), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#fffaf0'); grd.addColorStop(1, '#e8dcc8');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.fillStyle = color; g.globalAlpha = 0.18; g.fillRect(0, 0, 512, 256); g.globalAlpha = 1;
  const shelf = (y) => { g.fillStyle = '#8a6a4a'; g.fillRect(20, y, 472, 6); };
  const item = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y - h, w, h); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, y - h + 2, w * 0.3, h - 4); };
  const pal = ['#e8322b', '#2f7bff', '#ffcc00', '#2ec46b', '#ff8a00', '#9b5cff', '#ff4fa3', '#1fb5c9'];
  if (kind === 'moda') {
    // manichini con vestiti
    for (let i = 0; i < 4; i++) {
      const x = 70 + i * 120, col = pal[Math.floor(R() * pal.length)];
      g.fillStyle = '#d8c8b8'; g.beginPath(); g.arc(x, 60, 16, 0, 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(x - 30, 80); g.lineTo(x + 30, 80); g.lineTo(x + 45, 220); g.lineTo(x - 45, 220); g.fill();
    }
  } else if (kind === 'pizza') {
    g.fillStyle = '#7a3b12'; g.fillRect(0, 170, 512, 86);
    for (let i = 0; i < 3; i++) { const x = 100 + i * 150; g.fillStyle = '#f2c46b'; g.beginPath(); g.arc(x, 150, 55, 0, 7); g.fill(); g.fillStyle = '#d9412b'; g.beginPath(); g.arc(x, 150, 46, 0, 7); g.fill(); g.fillStyle = '#fff3c8'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * 60, 150 + (R() - 0.5) * 60, 8, 0, 7); g.fill(); } }
  } else if (kind === 'gelato') {
    for (let i = 0; i < 8; i++) { const x = 40 + i * 58, col = pal[i % pal.length]; g.fillStyle = '#cfd8dc'; g.fillRect(x - 24, 150, 48, 70); g.fillStyle = col; g.beginPath(); g.ellipse(x, 150, 24, 18, 0, Math.PI, 0); g.fill(); }
    g.fillStyle = '#5d4037'; g.fillRect(0, 220, 512, 36);
  } else if (kind === 'tech') {
    g.fillStyle = '#1b1f2a'; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 6; i++) { const x = 30 + (i % 3) * 160, y = 30 + Math.floor(i / 3) * 110; g.fillStyle = '#0d0f14'; g.fillRect(x, y, 140, 85); const gr = g.createLinearGradient(x, y, x + 140, y + 85); gr.addColorStop(0, pal[i]); gr.addColorStop(1, '#101830'); g.fillStyle = gr; g.fillRect(x + 6, y + 6, 128, 73); }
  } else if (kind === 'giochi') {
    for (let i = 0; i < 10; i++) { const x = 30 + R() * 450, y = 90 + R() * 140, col = pal[i % pal.length]; g.fillStyle = col; g.beginPath(); g.arc(x, y, 18 + R() * 20, 0, 7); g.fill(); }
    for (let i = 0; i < 5; i++) item(40 + i * 95, 80, 60, 50, pal[(i + 3) % pal.length]);
  } else {
    // scaffali con scatole colorate
    for (const y of [90, 160, 230]) { shelf(y); for (let x = 30; x < 480; x += 30 + R() * 14) item(x, y, 20 + R() * 10, 30 + R() * 30, pal[Math.floor(R() * pal.length)]); }
  }
  grain(g, 512, 256, 6, R);
  return toTex(c);
}
// scaffale del supermercato: prodotti fitti su 5 ripiani
function shelfTex(R) {
  const c = canvas(1024, 512), g = c.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 1024, 512);
  const pal = ['#e8322b', '#2f7bff', '#ffcc00', '#2ec46b', '#ff8a00', '#ffffff', '#ff4fa3', '#8b5a2b', '#1fb5c9'];
  for (let r = 0; r < 5; r++) {
    const y = 100 * r + 96;
    g.fillStyle = '#c9ced6'; g.fillRect(0, y, 1024, 8);
    g.fillStyle = '#ffd400'; for (let x = 20; x < 1024; x += 120) g.fillRect(x, y + 1, 30, 6);   // cartellini dei prezzi
    let x = 4;
    while (x < 1020) {
      const w = 22 + R() * 30, h = 50 + R() * 38, col = pal[Math.floor(R() * pal.length)];
      g.fillStyle = col; g.fillRect(x, y - h, w, h);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + w * 0.2, y - h * 0.7, w * 0.6, h * 0.25);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x + w - 3, y - h, 3, h);
      x += w + 2;
    }
  }
  grain(g, 1024, 512, 6, R);
  return toTex(c);
}
function waterTex() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#7fd8ff'); gr.addColorStop(1, '#1f8fd1');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
  for (let r = 20; r < 180; r += 22) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); }
  const t = toTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildMall(root, track, opts = {}) {
  const night = !!opts.night;
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(77);
  const P = (i) => pts[((i % count) + count) % count];
  const H = (i) => track.hs[((i % count) + count) % count];
  const Z = (i) => track.zone[((i % count) + count) % count];
  const STEP = (i) => track.step[((i % count) + count) % count];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, mat, x, y, z, ry = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = root) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);
  const cyl = (rt, rb, h, mat, x, y, z, seg = 24, parent = root) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, 0, parent);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const M = {
    white: std({ color: '#f4f2ee', roughness: 0.5 }),
    wall: std({ color: '#d9c7ae', roughness: 0.85 }),
    chrome: std({ color: '#e8e8ea', roughness: 0.15, metalness: 1 }),
    steel: std({ color: '#9aa3ad', roughness: 0.3, metalness: 0.8 }),
    dark: std({ color: '#24262b', roughness: 0.4 }),
    rubber: std({ color: '#111214', roughness: 0.6 }),
    glass: std({ color: '#cfe8f2', roughness: 0.03, transparent: true, opacity: 0.28, depthWrite: false }),
    glassRail: std({ color: '#bfe3ef', roughness: 0.03, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    wood: std({ color: '#b07a4a', roughness: 0.55 }),
    plant: std({ color: '#3a9c4a', roughness: 0.7 }),
    pot: std({ color: '#e9e2d4', roughness: 0.4 }),
    stone: std({ color: '#d9d2c4', roughness: 0.35 }),
    gold: std({ color: '#ffc93c', roughness: 0.25, metalness: 0.9 }),
  };
  // distanza dal centro pista: per non mettere cose sulla strada
  function distTrack(x, z) { let bd = Infinity; for (let i = 0; i < count; i += 2) { if (H(i) > 1) continue; const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); }
  const free = (x, z, r) => distTrack(x, z) > wall + r;

  // ---------------------------------------------------------------- pavimento, pareti, soffitto con lucernario
  {
    const t = marbleTex(R); t.repeat.set(RX * 2 / 80, RZ * 2 / 80); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), std({ map: t, roughness: 0.18, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.userData.noCast = true; root.add(floor);
    for (const [w, x, z, ry] of [[RX * 2, 0, RZ, Math.PI], [RX * 2, 0, -RZ, 0], [RZ * 2, RX, 0, -Math.PI / 2], [RZ * 2, -RX, 0, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, CEIL), M.wall); m.position.set(x, CEIL / 2, z); m.rotation.y = ry; m.userData.noCast = true; root.add(m);
    }
    // soffitto con il lucernario di vetro in mezzo
    const ceil = std({ color: '#f7f4ee', roughness: 0.9 });
    for (const [w, d, x, z] of [[RX * 2, 70, 0, -RZ + 35], [RX * 2, 70, 0, RZ - 35], [70, RZ * 2 - 140, -RX + 35, 0], [70, RZ * 2 - 140, RX - 35, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceil); m.rotation.x = Math.PI / 2; m.position.set(x, CEIL, z); m.userData.noCast = true; root.add(m);
    }
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2 - 140, RZ * 2 - 140), new THREE.MeshBasicMaterial({ color: night ? '#1a2350' : '#cfeaff', side: THREE.DoubleSide }));
    sky.rotation.x = Math.PI / 2; sky.position.set(0, CEIL + 8, 0); sky.userData.noShadow = true; root.add(sky);
    // travi del lucernario
    for (let x = -RX + 70; x <= RX - 70; x += 26) box(1.5, 3, RZ * 2 - 140, M.steel, x, CEIL + 2, 0).userData.noShadow = true;
    // lampade sospese a palla
    for (const [x, z] of [[-90, -60], [10, -90], [110, -60], [-40, 60], [90, 30], [130, 140], [-10, -10]]) {
      cyl(0.25, 0.25, CEIL - 120, M.dark, x, (CEIL + 120) / 2, z, 6).userData.noShadow = true;
      const b = add(new THREE.SphereGeometry(6, 18, 14), night ? glow('#ffd9a0') : std({ color: '#fff6e0', emissive: '#fff0c8', emissiveIntensity: 0.8 }), x, 117, z);
      b.userData.noShadow = true;
    }
  }

  // ---------------------------------------------------------------- negozi con le vetrine
  const SHOPS = [
    ['PIZZERIA DA GINO', '#c0392b', '#fff3c8', 'pizza'], ['GELATERIA POLO', '#ff8ab8', '#ffffff', 'gelato'], ['SCARPE FRIZZ', '#2f7bff', '#ffffff', 'scaffale'],
    ['TECNO MARTE', '#151a28', '#4fd1ff', 'tech'], ['GIOCATTOLI ZIG ZAG', '#ffcc00', '#c0392b', 'giochi'], ['MODA LUNA', '#2b2b2b', '#f1d38a', 'moda'],
    ['LIBRERIA PAGINA', '#2e7d4f', '#ffffff', 'scaffale'], ['CAFFÈ MOKA', '#5d3a1a', '#ffd9a0', 'scaffale'], ['SPORT SPRINT', '#e8322b', '#ffffff', 'scaffale'],
    ['PROFUMI ROSA', '#f4c7d9', '#8a1c4a', 'moda'], ['OTTICA VISTA', '#1fb5c9', '#ffffff', 'scaffale'], ['FIORI E PIANTE', '#3a9c4a', '#ffffff', 'giochi'],
  ];
  let shopN = 0;
  const signs = [];
  function shop(x, z, ry, w, y0 = 0, h = 32) {
    const [name, bg, fg, kind] = SHOPS[shopN++ % SHOPS.length];
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; root.add(g);
    // interno illuminato dietro il vetro
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w - 4, h - 4), new THREE.MeshBasicMaterial({ map: windowTex(kind, bg, R), color: night ? '#9a8f7a' : '#ffffff' }));
    back.position.set(0, h / 2, 0.6); back.userData.noShadow = true; g.add(back);
    box(w - 4, 0.5, 6, M.stone, 0, 0.25, 3.6, 0, g);
    // vetro e montanti
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 4, h - 4), M.glass); glass.position.set(0, h / 2, 6.6); glass.userData.noShadow = true; g.add(glass);
    for (const sx of [-w / 2 + 1.5, w / 2 - 1.5]) box(3, h + 8, 7, M.dark, sx, (h + 8) / 2, 3.5, 0, g);
    box(w, 2, 3, M.dark, 0, 1, 6.6, 0, g);
    // insegna
    const sm = new THREE.MeshBasicMaterial({ map: signTex(name, bg, fg), toneMapped: !night });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w, 9, 2), [M.dark, M.dark, M.dark, M.dark, sm, M.dark]);
    sign.position.set(0, h + 4.5, 6.6); sign.userData.noShadow = true; g.add(sign);
    signs.push(sign);
    return g;
  }
  // lato sud (dietro il rettilineo del via)
  for (let x = -110; x <= 165; x += 68) shop(x, -RZ + 1, 0, 64);
  // lato est
  for (let z = -120; z <= 40; z += 62) shop(RX - 1, z, -Math.PI / 2, 58);
  // sotto la balconata (piano terra) e sopra (primo piano)
  for (let x = -60; x <= 40; x += 62) shop(x, RZ - 1, Math.PI, 58, 0, 26);
  for (let x = -95; x <= 45; x += 56) shop(x, RZ - 1, Math.PI, 52, GAL, 30);
  for (const x of [100, 160]) shop(x, RZ - 1, Math.PI, 56);

  // ---------------------------------------------------------------- pista giocattolo (stessa costruzione della Mancave)
  const runs = [];
  { let s = 0; for (let i = 1; i <= count; i++) if (i === count || STEP(i)) { runs.push([s, i]); s = i; } }
  if (runs.length > 1 && !STEP(0)) { const last = runs.pop(); runs[0] = [last[0], runs[0][1] + count]; }
  const Hr = (i, i1) => (i === i1 && STEP(i)) ? H(i - 1) : H(i);
  function strip(i0, i1, latA, latB, yOff, mat, vScale, filter) {
    const v = [], uv = [], id = [];
    let k = 0;
    for (let i = i0; i <= i1; i++) {
      if (filter && !filter(i)) { k = -1; continue; }
      const p = P(i), y = Hr(i, i1) + yOff;
      v.push(p.x + p.rx * latA, y, p.z + p.rz * latA, p.x + p.rx * latB, y, p.z + p.rz * latB);
      const s = i * track.ds;
      uv.push(0, s / vScale, 1, s / vScale);
      const n = v.length / 3;
      if (k > 0) id.push(n - 4, n - 3, n - 2, n - 3, n - 1, n - 2);
      k = k < 0 ? 1 : k + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(id); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); root.add(m); return m;
  }
  function side(i0, i1, lat, mat, filter, top = 0, bottom = () => 0) {
    const v = [], uv = [], id = [];
    let k = 0;
    for (let i = i0; i <= i1; i++) {
      if (filter && !filter(i)) { k = -1; continue; }
      const p = P(i), y = Hr(i, i1) + top;
      v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * lat, bottom(i), p.z + p.rz * lat);
      uv.push(i * track.ds / 20, y / 20, i * track.ds / 20, 0);
      const n = v.length / 3;
      if (k > 0) id.push(n - 4, n - 2, n - 3, n - 3, n - 2, n - 1);
      k = k < 0 ? 1 : k + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(id); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; root.add(m); return m;
  }
  const ROAD = roadTex(R);
  const road = std({ map: ROAD.map, bumpMap: ROAD.bump, bumpScale: 0.6, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const kerbC = canvas(16, 64), kg = kerbC.getContext('2d');
  kg.fillStyle = '#f4f4f4'; kg.fillRect(0, 0, 16, 64); kg.fillStyle = '#2f7bff'; kg.fillRect(0, 0, 16, 32);
  const kerbMat = std({ map: toTex(kerbC, { repeat: [1, 1] }), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const curvy = (i) => Math.abs(P(i - 5).tx * P(i + 5).tz - P(i - 5).tz * P(i + 5).tx) > 0.12;
  const inSlab = (i) => { const p = P(i); return p.x > GAL_X0 && p.x < GAL_X1 && p.z > GAL_Z0; };
  const isEsc = (i) => Z(i) === 'esc' && H(i) > 0.3;
  const isStage = (i) => Z(i) === 'stage' && H(i) > 0.3;
  const isGalOut = (i) => Z(i) === 'gallery' && !inSlab(i);
  // scala mobile: gradini (texture a righe), fianchi di vetro e corrimano nero
  const stepC = canvas(64, 64), sg = stepC.getContext('2d');
  sg.fillStyle = '#8d949c'; sg.fillRect(0, 0, 64, 64); sg.fillStyle = '#5c636b'; for (let y = 0; y < 64; y += 8) sg.fillRect(0, y, 64, 3);
  sg.fillStyle = '#ffd400'; sg.fillRect(0, 0, 4, 64); sg.fillRect(60, 0, 4, 64);
  const stepMat = std({ map: toTex(stepC, { repeat: [1, 1] }), roughness: 0.4, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const stageMat = std({ color: '#2a1d4a', roughness: 0.35 });
  const ledMat = glow('#ff4fd8');
  for (const [a, b] of runs) {
    strip(a, b, -hw, hw, 0.06, road, hw * 4, (i) => !isEsc(i));
    strip(a, b, -hw, hw, 0.06, stepMat, 6, isEsc);
    strip(a, b, -hw - 1.8, -hw, 0.1, kerbMat, 5, curvy).userData.noCast = true;
    strip(a, b, hw, hw + 1.8, 0.1, kerbMat, 5, curvy).userData.noCast = true;
    // fianchi della scala mobile fino a terra (lamiera), con un vetro sopra
    for (const sgn of [-1, 1]) {
      side(a, b, sgn * (wall + 0.6), M.steel, isEsc, 0.02);
      side(a, b, sgn * (wall + 0.6), M.glassRail, isEsc, 7, (i) => Hr(i, b) + 0.5);
      // pedana promozionale: fianchi viola con la striscia LED
      side(a, b, sgn * (wall + 3), stageMat, isStage, 0.02);
      side(a, b, sgn * (wall + 3.05), ledMat, isStage, -1, (i) => Hr(i, b) - 2.2).userData.noShadow = true;
      side(a, b, sgn * (wall + 0.6), M.steel, isGalOut, 0.02, (i) => Hr(i, b) - 4);
    }
    strip(a, b, -wall - 3, wall + 3, 0.02, stageMat, 20, isStage);
    strip(a, b, -wall - 0.6, wall + 0.6, -4, M.steel, 20, isGalOut);
  }
  // corrimano neri della scala mobile
  {
    const seg = [[], []];
    for (let i = 0; i < count; i++) if (isEsc(i) || (Z(i) === 'esc')) {
      const p = P(i);
      for (const [k, sgn] of [[0, -1], [1, 1]]) seg[k].push(new THREE.Vector3(p.x + p.rx * sgn * (wall + 0.6), H(i) + 7.6, p.z + p.rz * sgn * (wall + 0.6)));
    }
    for (const s of seg) if (s.length > 2) root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s), 60, 0.7, 8, false), M.rubber));
  }
  // barriere (bianche e blu) dove la strada è a terra o sulla balconata
  {
    const RH2 = 1.9, wl = wall - 0.2;
    const rail = new THREE.MeshPhysicalMaterial({ color: '#f4f2ec', roughness: 0.3, clearcoat: 0.6 });
    const railTop = new THREE.MeshPhysicalMaterial({ color: '#2f7bff', roughness: 0.3, clearcoat: 0.8 });
    const ok = (i) => !isEsc(i) && !isStage(i);
    for (const [a, b] of runs) for (const sgn of [-1, 1]) {
      const v = [], id = [];
      let k = 0;
      for (let i = a; i <= b; i++) {
        if (!ok(i)) { k = -1; continue; }
        const p = P(i), y = Hr(i, b), l = sgn * wl;
        v.push(p.x + p.rx * l, y + 0.2, p.z + p.rz * l, p.x + p.rx * l, y + RH2, p.z + p.rz * l);
        const n = v.length / 3;
        if (k > 0) id.push(n - 4, n - 2, n - 3, n - 3, n - 2, n - 1);
        k = k < 0 ? 1 : k + 1;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(id); g.computeVertexNormals();
      const m = new THREE.Mesh(g, rail); m.material.side = THREE.DoubleSide; root.add(m);
      let seg = [];
      const flush = () => { if (seg.length >= 2) root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seg), Math.max(4, seg.length * 3), 0.42, 8, false), railTop)); seg = []; };
      for (let i = a; i <= b; i += 3) { if (!ok(i)) { flush(); continue; } const p = P(i), l = sgn * wl; seg.push(new THREE.Vector3(p.x + p.rx * l, Hr(Math.min(i, b), b) + RH2, p.z + p.rz * l)); }
      flush();
    }
  }

  // ---------------------------------------------------------------- balconata del primo piano
  {
    const slab = box(GAL_X1 - GAL_X0, 4, RZ - GAL_Z0, M.white, (GAL_X0 + GAL_X1) / 2, GAL - 2, (GAL_Z0 + RZ) / 2);
    slab.userData.noCast = false;
    // bordo con il vetro e il corrimano
    box(GAL_X1 - GAL_X0, 9, 0.6, M.glassRail, (GAL_X0 + GAL_X1) / 2, GAL + 4.5, GAL_Z0 + 0.4).userData.noShadow = true;
    box(GAL_X1 - GAL_X0, 1, 1.4, M.chrome, (GAL_X0 + GAL_X1) / 2, GAL + 9, GAL_Z0 + 0.4);
    // colonne sotto la balconata (lontane dalla strada)
    for (let x = GAL_X0 + 8; x < GAL_X1; x += 34) if (free(x, GAL_Z0 + 4, 3)) cyl(3, 3, GAL - 4, M.white, x, (GAL - 4) / 2, GAL_Z0 + 4, 20);
    // insegna "PRIMO PIANO"
    const t = signTex('PRIMO PIANO', '#1d2a5a', '#ffffff', 'negozi · ristoranti');
    const s = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ map: t, toneMapped: !night }));
    s.position.set(-20, GAL - 9, GAL_Z0 - 0.2); s.rotation.y = Math.PI; s.userData.noShadow = true; root.add(s);
    s.rotation.y = 0; s.position.z = GAL_Z0 - 0.4;
  }

  // ---------------------------------------------------------------- pedana promozionale: arco di palloncini e cartello
  {
    const pts2 = []; for (let i = 0; i < count; i++) if (isStage(i)) pts2.push(i);
    if (pts2.length) {
      const i = pts2[Math.floor(pts2.length * 0.35)], p = P(i), y = H(i);
      const cols = ['#ff4fa3', '#ffcc00', '#2f7bff', '#2ec46b', '#ff8a00'];
      for (let k = 0; k <= 22; k++) {
        const a = k / 22 * Math.PI, r = wall + 4;
        const bx = p.x + p.rx * Math.cos(a) * r, bz = p.z + p.rz * Math.cos(a) * r, by = y + Math.sin(a) * 22;
        add(new THREE.SphereGeometry(2.1, 12, 10), std({ color: cols[k % cols.length], roughness: 0.2 }), bx, by, bz).userData.noShadow = true;
      }
      const t = signTex('SALTO PROMO!', '#ff2d7a', '#ffffff');
      const s = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: !night }));
      s.position.set(p.x, y + 18, p.z); s.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI; s.userData.noShadow = true; root.add(s);
    }
  }

  // ---------------------------------------------------------------- supermercato: parete di vetro, porte automatiche, scaffali, casse
  const doorPanels = [];
  {
    const di = Math.floor(track.marks.door / track.ds) % count, dp = P(di);
    const dyaw = Math.atan2(dp.tx, dp.tz);
    // parete di vetro perpendicolare alla strada, da muro a muro (con il varco della porta)
    const wallG = new THREE.Group(); wallG.position.set(dp.x, 0, dp.z); wallG.rotation.y = dyaw; root.add(wallG);
    const L1 = 60;
    for (const sgn of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(L1, 40, 0.6), M.glass); g.position.set(sgn * (wall + L1 / 2), 20, 0); g.userData.noShadow = true; wallG.add(g);
      box(1.2, 40, 1.2, M.dark, sgn * (wall + 0.6), 20, 0, 0, wallG);
    }
    box(wall * 2 + 2, 6, 2, M.dark, 0, 33, 0, 0, wallG);
    const sgn2 = new THREE.Mesh(new THREE.PlaneGeometry(wall * 2 + 30, 10), new THREE.MeshBasicMaterial({ map: signTex('SUPER MANCAVE', '#d62828', '#ffffff', 'supermercato · porte automatiche'), side: THREE.DoubleSide, toneMapped: !night }));
    sgn2.position.set(0, 44, -0.4); sgn2.rotation.y = Math.PI; sgn2.userData.noShadow = true; wallG.add(sgn2);
    // due ante che scorrono
    for (const sgn of [-1, 1]) {
      const d = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.BoxGeometry(wall, 29, 0.5), std({ color: '#bfe6f5', roughness: 0.02, transparent: true, opacity: 0.45, depthWrite: false }));
      pane.position.y = 15; pane.userData.noShadow = true;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(wall, 1.2, 0.8), M.chrome); frame.position.y = 0.8;
      const frame2 = frame.clone(); frame2.position.y = 29.5;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(wall, 1, 0.6), glow('#ff3b30')); stripe.position.y = 10;
      d.add(pane, frame, frame2, stripe);
      wallG.add(d);
      doorPanels.push({ g: d, sgn });
    }
    // sensore
    const sensor = box(4, 1.5, 1.5, M.dark, 0, 31, 1.4, 0, wallG);
    const led = box(1, 0.8, 0.4, glow('#2ec46b'), 0, 31, 2.2, 0, wallG);
    track.doorLed = led;
    // scaffali ai lati della corsia
    const shelfMat = std({ map: shelfTex(R), roughness: 0.6 });
    const metal = std({ color: '#dfe3e8', roughness: 0.4, metalness: 0.4 });
    for (let i = 0; i < count; i += 6) {
      if (Z(i) !== 'market' && Z(i) !== 'spill') continue;
      const p = P(i), yaw = Math.atan2(p.tx, p.tz);
      for (const sgn of [-1, 1]) {
        const off = sgn * (wall + 7);
        const x = p.x + p.rx * off, z = p.z + p.rz * off;
        if (Math.abs(x) > RX - 3) continue;
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2); root.add(g);
        const s = new THREE.Mesh(new THREE.BoxGeometry(9.5, 30, 8), [metal, metal, metal, metal, shelfMat, shelfMat]);
        s.position.y = 15; g.add(s);
      }
    }
    // pavimento bagnato: pozza lucida e cartello giallo
    for (let i = 0; i < count; i += 3) {
      if (Z(i) !== 'spill') continue;
      const p = P(i);
      const w = new THREE.Mesh(new THREE.CircleGeometry(7 + R() * 4, 20), std({ color: '#9fd9ff', roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -10 }));
      w.rotation.x = -Math.PI / 2; w.position.set(p.x + p.rx * (R() - 0.5) * 8, 0.16, p.z + p.rz * (R() - 0.5) * 8); w.userData.noShadow = true; root.add(w);
    }
    {
      let si = -1; for (let i = 0; i < count; i++) if (Z(i) === 'spill') { si = i; break; }
      if (si >= 0) {
        const p = P(si), x = p.x + p.rx * (wall + 2.5), z = p.z + p.rz * (wall + 2.5);
        const t = canvasSignWet();
        for (const sgn of [-1, 1]) {
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), std({ map: t, side: THREE.DoubleSide, roughness: 0.5 }));
          pl.position.set(x, 4.3, z); pl.rotation.y = Math.atan2(p.tx, p.tz) + sgn * 0.25; pl.rotation.x = sgn * 0.2; root.add(pl);
        }
      }
    }
    // pavimento del supermercato (grigio chiaro a quadrotti) e cartelli appesi sopra le corsie
    {
      const c = canvas(256, 256), g = c.getContext('2d');
      g.fillStyle = '#d7dbe0'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#bfc5cc'; g.lineWidth = 3;
      for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
      const t = toTex(c, { repeat: [6, 9] });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(82, 136), std({ map: t, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      f.rotation.x = -Math.PI / 2; f.position.set(-159, 0.05, -45); f.userData.noCast = true; root.add(f);
      const names = [['FRUTTA', '#2ec46b'], ['PASTA', '#ff8a00'], ['DOLCI', '#ff4fa3'], ['BIBITE', '#2f7bff']];
      let k = 0;
      for (let i = 0; i < count; i += 26) {
        if (Z(i) !== 'market' && Z(i) !== 'spill') continue;
        const [nm, col] = names[k++ % names.length];
        const p = P(i);
        const sm = new THREE.MeshBasicMaterial({ map: signTex(nm, col, '#ffffff'), side: THREE.DoubleSide, toneMapped: !night });
        const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), sm);
        sg2.position.set(p.x, 30, p.z); sg2.rotation.y = Math.atan2(p.tx, p.tz); sg2.userData.noShadow = true; root.add(sg2);
        for (const sx of [-7, 7]) { const w = cyl(0.12, 0.12, 30, M.dark, p.x + p.rx * sx, 30 + 2.2 + 15, p.z + p.rz * sx, 4); w.userData.noShadow = true; }
      }
    }
    // casse all'uscita
    let ei = -1; for (let i = count - 1; i >= 0; i--) if (Z(i) === 'market') { ei = i; break; }
    if (ei >= 0) {
      const p = P(ei + 6), yaw = Math.atan2(p.tx, p.tz);
      for (const sgn of [-1, 1]) for (const k of [1, 2]) {
        const off = sgn * (wall + 4 + k * 12), x = p.x + p.rx * off, z = p.z + p.rz * off;
        if (Math.abs(x) > RX - 4 || Math.abs(z) > RZ - 4) continue;
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; root.add(g);
        box(5, 9, 16, std({ color: '#3a3f4b', roughness: 0.4 }), 0, 4.5, 0, 0, g);
        box(5.4, 0.6, 16.4, std({ color: '#111', roughness: 0.3 }), 0, 9.2, 0, 0, g);
        cyl(0.3, 0.3, 8, M.steel, 0, 13, 6, 6, g);
        box(3, 2.2, 0.6, glow('#2ec46b'), 0, 17.5, 6, 0, g);
      }
    }
  }
  function canvasSignWet() {
    const c = canvas(128, 192), g = c.getContext('2d');
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, 128, 192);
    g.fillStyle = '#111'; g.font = '900 22px Inter, sans-serif'; g.textAlign = 'center';
    g.fillText('ATTENZIONE', 64, 34);
    g.beginPath(); g.moveTo(64, 56); g.lineTo(100, 118); g.lineTo(28, 118); g.closePath(); g.lineWidth = 6; g.stroke();
    g.font = '900 40px Inter'; g.fillText('!', 64, 112);
    g.font = '900 18px Inter, sans-serif'; g.fillText('PAVIMENTO', 64, 150); g.fillText('BAGNATO', 64, 172);
    return toTex(c);
  }

  // ---------------------------------------------------------------- fontana della piazza (con le monetine)
  const fountain = { jets: [], water: null };
  {
    const F = track.marks.fountain, cx = F.x, cz = F.z;
    const rim = std({ color: '#e7e1d6', roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 2.4, 12, 64), rim); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 5, cz); root.add(ring);
    const wallF = new THREE.Mesh(new THREE.CylinderGeometry(30, 30.5, 5, 64, 1, true), rim); wallF.position.set(cx, 2.5, cz); wallF.material.side = THREE.DoubleSide; root.add(wallF);
    const wt = waterTex();
    const water = new THREE.Mesh(new THREE.CircleGeometry(29, 48), std({ map: wt, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.88 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, 3.6, cz); water.userData.noShadow = true; root.add(water);
    fountain.water = wt;
    // monetine sul fondo
    for (let k = 0; k < 40; k++) { const a = R() * 6.28, r = 4 + R() * 23; const c = add(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 10), M.gold, cx + Math.cos(a) * r, 3.3, cz + Math.sin(a) * r); c.rotation.x = (R() - 0.5) * 0.4; c.userData.noShadow = true; }
    // vasca alta in mezzo e colonna
    cyl(4, 5, 16, rim, cx, 8, cz, 24);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(12, 9, 2.5, 40), rim); top.position.set(cx, 16, cz); root.add(top);
    const water2 = new THREE.Mesh(new THREE.CircleGeometry(11, 32), std({ map: wt, roughness: 0.05, transparent: true, opacity: 0.88 })); water2.rotation.x = -Math.PI / 2; water2.position.set(cx, 17.3, cz); root.add(water2);
    cyl(1.6, 2.4, 9, rim, cx, 21, cz, 16);
    // getti d'acqua: archi trasparenti che pulsano
    const jetMat = std({ color: '#c9f0ff', roughness: 0.05, transparent: true, opacity: 0.55, emissive: '#5fb8e0', emissiveIntensity: 0.25 });
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(cx + Math.cos(a) * 10, 17.5, cz + Math.sin(a) * 10), new THREE.Vector3(cx + Math.cos(a) * 20, 30, cz + Math.sin(a) * 20), new THREE.Vector3(cx + Math.cos(a) * 26, 4, cz + Math.sin(a) * 26));
      const j = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.45, 6, false), jetMat); j.userData.noShadow = true; root.add(j);
      fountain.jets.push(j);
    }
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 14, 10, 1, true), jetMat); spout.position.set(cx, 32, cz); spout.userData.noShadow = true; root.add(spout);
    fountain.jets.push(spout);
    // panchine e piante intorno
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3, x = cx + Math.cos(a) * 40, z = cz + Math.sin(a) * 40;
      if (!free(x, z, 4)) continue;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a + Math.PI / 2; root.add(g);
      box(14, 1, 4, M.wood, 0, 4.5, 0, 0, g); box(14, 4, 0.8, M.wood, 0, 7, -1.8, 0, g);
      for (const sx of [-6, 6]) box(0.8, 4.5, 3.5, M.dark, sx, 2.2, 0, 0, g);
    }
  }
  // piante grandi in vaso e cestini, dove c'è posto
  for (const [x, z] of [[-185, 70], [185, 60], [-60, -160], [185, -160], [100, 160], [-185, 150], [-100, 100], [120, 40], [-80, -40], [10, -100]]) {
    if (!free(x, z, 7)) continue;
    cyl(6, 5, 9, M.pot, x, 4.5, z, 20);
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * 6.28, l = new THREE.Mesh(new THREE.SphereGeometry(4 + R() * 2, 10, 8), M.plant);
      l.position.set(x + Math.cos(a) * 3, 13 + R() * 9, z + Math.sin(a) * 3); l.scale.set(0.8, 1.4, 0.8); root.add(l);
    }
  }

  // ---------------------------------------------------------------- carrelli della spesa (ostacoli che attraversano)
  function makeCart() {
    const g = new THREE.Group();
    const wire = std({ color: '#c9ced6', roughness: 0.25, metalness: 0.9, wireframe: false });
    const gridC = canvas(64, 64), gg = gridC.getContext('2d'); gg.strokeStyle = '#e8ecf0'; gg.lineWidth = 3;
    for (let i = 0; i <= 64; i += 8) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 64); gg.stroke(); gg.beginPath(); gg.moveTo(0, i); gg.lineTo(64, i); gg.stroke(); }
    const gt = toTex(gridC, { repeat: [3, 2] });
    const mesh = std({ map: gt, alphaMap: gt, transparent: true, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.3, color: '#ffffff' });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 10), mesh); basket.position.y = 7; g.add(basket);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7.4, 8), std({ color: '#e8322b', roughness: 0.4 })); handle.rotation.z = Math.PI / 2; handle.position.set(0, 10.5, -5.8); g.add(handle);
    for (const [x, z] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 6), wire); leg.position.set(x, 2.5, z); g.add(leg);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 12), M.rubber); w.rotation.z = Math.PI / 2; w.position.set(x, 0.9, z); g.add(w);
    }
    // spesa nel carrello
    for (const [c, x, z] of [['#ffcc00', -1.5, 1], ['#2f7bff', 1.8, -1.5], ['#e8322b', 0, 2.8]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 2), std({ color: c, roughness: 0.5 })); b.position.set(x, 8, z); g.add(b); }
    g.traverse(o => { o.userData.noShadow = true; });
    return g;
  }
  const cart1 = makeCart(), cart2 = makeCart();
  root.add(cart1, cart2);
  track.obstacleMeshes = { cart1, cart2 };

  // ---------------------------------------------------------------- animazioni: porte, fontana, insegne
  track.animate = (t, tsec) => {
    const o = doorOpen(t);
    for (const d of doorPanels) d.g.position.x = d.sgn * (wall / 2 + o * (wall - 1));
    if (track.doorLed) track.doorLed.material.color.set(o > 0.35 ? '#2ec46b' : '#ff3b30');
    if (fountain.water) { fountain.water.offset.set(Math.sin(tsec * 0.6) * 0.03, tsec * 0.05); }
    fountain.jets.forEach((j, k) => { const s = 1 + Math.sin(tsec * 3 + k) * 0.08; j.scale.set(s, 1, s); });
  };

  // ---------------------------------------------------------------- luci
  if (!night) {
    root.add(new THREE.HemisphereLight('#ffffff', '#d9cbb5', 1.0));
    const sun = new THREE.DirectionalLight('#fff6e6', 2.4);
    sun.position.set(-120, 420, 140); sun.target.position.set(0, 0, 0); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 240; sc.bottom = -240; sc.near = 150; sc.far = 900;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 4;
    root.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#e6f0ff', 0.7); fill.position.set(300, 200, -250); root.add(fill);
  } else {
    // centro chiuso: luci di sicurezza azzurre, insegne accese, luna dal lucernario
    root.add(new THREE.HemisphereLight('#5866c8', '#1a1426', 0.55));
    const moon = new THREE.DirectionalLight('#9fb4ff', 1.0);
    moon.position.set(-100, 420, 120); moon.target.position.set(0, 0, 0); moon.castShadow = true;
    const sc = moon.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 240; sc.bottom = -240; sc.near = 150; sc.far = 900;
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35;
    root.add(moon, moon.target);
    for (const [x, y, z, c, i] of [[0, 60, -150, '#ff4fd8', 2.4], [170, 60, -40, '#4fd1ff', 2.2], [-150, 50, -40, '#ff3b30', 1.8], [60, 40, 6, '#5fd0ff', 2.6], [-20, 70, 150, '#ffcf8a', 2.2], [-125, 40, 90, '#ff4fd8', 2.4]]) {
      const l = new THREE.PointLight(c, i, 360, 1); l.position.set(x, y, z); root.add(l);
    }
    addNeon(root, track, 0.02);
  }

  // ombre: calcolate una volta sola
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noShadow) return;
    o.receiveShadow = true;
    o.castShadow = !o.userData.noCast && !(o.material && o.material.transparent);
  });
  const seen = new Set();
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) { if (seen.has(m) || !m.isMeshStandardMaterial) continue; seen.add(m); m.envMapIntensity = m.metalness > 0.5 ? 1 : m.transparent ? 0.9 : 0.4; }
  });
  track.ready = Promise.resolve();

  root.userData.fog = new THREE.Fog(night ? '#0e1024' : '#f3efe6', 700, 1600);
  root.userData.background = new THREE.Color(night ? '#0e1024' : '#f3efe6');
  root.userData.toneMapping = THREE.ACESFilmicToneMapping;
  root.userData.exposure = night ? 1.2 : 1.0;
  root.userData.night = night;
  root.userData.makeEnv = makeEnvMall;
}

// riflessi: un salone chiaro col lucernario
function makeEnvMall(renderer, night = false) {
  const pm = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  const cols = ['#e9e1d3', '#e9e1d3', '#ffffff', '#d9cbb5', '#e9e1d3', '#e9e1d3'];
  const room = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 100), cols.map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })));
  if (night) room.material.forEach((m) => m.color.multiplyScalar(0.15));
  sc.add(room);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ color: night ? new THREE.Color(0.4, 0.5, 1.2) : new THREE.Color(3, 3, 3.2) }));
  panel.rotation.x = Math.PI / 2; panel.position.y = 19.5; sc.add(panel);
  const rt = pm.fromScene(sc, 0.03);
  pm.dispose();
  return rt.texture;
}

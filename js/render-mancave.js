// Grafica della pista "La Mancave": una stanza vera, in scala, vista da un kart giocattolo.
// Scala: 1 unità ≈ 2 cm. Il kart è lungo 6 cm, il divano è un palazzo.
// Luce calda della sera, ombre vere (calcolate una volta sola), riflessi sul parquet.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { addNeon } from './render.js';

// ------------------------------------------------------------------ modelli 3D gratuiti (Kenney, licenza CC0)
// colori più vivi al posto di quelli pastello originali
const RECOLOR = {
  carpet: '#e0413c', carpetDarker: '#b52d2a', carpetWhite: '#f4f1ea', wood: '#e2a463', woodDark: '#a8683a',
  metal: '#d5dbe2', metalLight: '#f2f5f8', metalMedium: '#9aa6b2', metalDark: '#3b4250', glass: '#bfe6f5',
  plant: '#3cbf5c', lamp: '#fff2c0',
  red: '#e8392f', yellow: '#ffc834', orange: '#ff8a2c', green: '#4cc463', brownLight: '#f2b465', brown: '#c98a4e',
  brownDark: '#7c4a29', brownDarkest: '#4b2c1b', greyLight: '#eef2f6', greyDark: '#8d97a3', purpleLight: '#ff74c4', _defaultMat: '#ffffff',
};
const KCACHE = new Map();
let LOADER = null;
function loadK(name) {
  if (!KCACHE.has(name)) {
    LOADER = LOADER || new GLTFLoader();
    KCACHE.set(name, new Promise((res) => LOADER.load(`assets/kenney/${name}.glb`, (g) => {
      const sc = g.scene;
      sc.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (RECOLOR[m.name]) m.color.set(RECOLOR[m.name]);
        const metal = /^metal/.test(m.name);
        m.metalness = metal ? 0.55 : 0; m.roughness = metal ? 0.3 : 0.62;
        if (m.name === 'lamp') { m.emissive.set('#ffe6a0'); m.emissiveIntensity = 0.9; }
        if (m.name === 'glass') { m.transparent = true; m.opacity = 0.45; m.roughness = 0.05; }
      });
      const box = new THREE.Box3().setFromObject(sc);
      res({ scene: sc, box });
    }, undefined, (e) => { console.warn('modello non caricato', name, e); res(null); })));
  }
  return KCACHE.get(name);
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ------------------------------------------------------------------ texture disegnate a codice
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
// rumore fine pixel per pixel (fibre, grana)
function grain(g, w, h, amount, R, mono = true) {
  const d = g.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const n = (R() - 0.5) * amount;
    a[i] += n; a[i + 1] += mono ? n : (R() - 0.5) * amount; a[i + 2] += mono ? n : (R() - 0.5) * amount;
  }
  g.putImageData(d, 0, 0);
}

function parquetTex(R) {
  // 2048 px = 120 unità; doghe da 7,5 x 60 unità (15 x 120 cm)
  const S = 2048, PW = 128, PL = 1024;
  const col = canvas(S, S), bump = canvas(S / 2, S / 2);
  const g = col.getContext('2d'), b = bump.getContext('2d');
  b.fillStyle = '#808080'; b.fillRect(0, 0, S / 2, S / 2);
  const plank = (x, y, seed) => {
    const r = rng(seed);
    const hue = 26 + r() * 8, sat = 50 + r() * 14, lig = 42 + r() * 12;
    g.fillStyle = `hsl(${hue},${sat}%,${lig}%)`; g.fillRect(x, y, PW, PL);
    // venature lunghe e ondulate
    for (let k = 0; k < 34; k++) {
      const dark = r() < 0.6;
      g.strokeStyle = dark ? `rgba(70,38,16,${0.05 + r() * 0.13})` : `rgba(255,230,190,${0.03 + r() * 0.07})`;
      g.lineWidth = 0.6 + r() * 2.4;
      const x0 = x + r() * PW, amp = 1 + r() * 5, fr = 0.002 + r() * 0.006, ph = r() * 6;
      g.beginPath();
      for (let t = 0; t <= PL; t += 16) {
        const xx = x0 + Math.sin(t * fr + ph) * amp;
        if (t === 0) g.moveTo(xx, y + t); else g.lineTo(xx, y + t);
      }
      g.stroke();
    }
    // nodi
    if (r() < 0.35) {
      const kx = x + 20 + r() * (PW - 40), ky = y + 80 + r() * (PL - 160);
      const gr = g.createRadialGradient(kx, ky, 1, kx, ky, 14);
      gr.addColorStop(0, 'rgba(50,25,10,0.7)'); gr.addColorStop(1, 'rgba(50,25,10,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, 9, 22, 0, 0, Math.PI * 2); g.fill();
    }
    // fughe tra le doghe
    g.fillStyle = 'rgba(35,18,8,0.85)'; g.fillRect(x, y, 2, PL); g.fillRect(x, y, PW, 2);
    g.fillStyle = 'rgba(255,235,200,0.12)'; g.fillRect(x + 2, y + 2, 2, PL - 2);
    b.fillStyle = '#3a3a3a'; b.fillRect(x / 2, y / 2, 1.5, PL / 2); b.fillRect(x / 2, y / 2, PW / 2, 1.5);
  };
  for (let c = 0; c < S / PW; c++) {
    const off = Math.floor(R() * PL);
    for (let k = 0; k < 3; k++) {
      const seed = 1000 + c * 10 + k;
      const y = -off + k * PL;
      plank(c * PW, y, seed);
      if (y < 0) plank(c * PW, y + S, seed);   // la doga che esce in alto rientra dal basso
    }
  }
  grain(g, S, S, 10, R);
  return { map: toTex(col, { repeat: [1, 1] }), bump: toTex(bump, { srgb: false, repeat: [1, 1] }) };
}

function fabricTex(base, R, { size = 256, weave = 0.18, knit = false } = {}) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  if (knit) {
    // maglia grossa a trecce
    for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) {
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.ellipse(x + 5, y + 8, 3.5, 7, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(x + 11, y + 8, 3.5, 7, -0.5, 0, Math.PI * 2); g.fill();
    }
  } else {
    for (let y = 0; y < size; y += 2) { g.fillStyle = `rgba(255,255,255,${weave * 0.35})`; g.fillRect(0, y, size, 1); }
    for (let x = 0; x < size; x += 2) { g.fillStyle = `rgba(0,0,0,${weave * 0.4})`; g.fillRect(x, 0, 1, size); }
  }
  grain(g, size, size, 26, R);
  return toTex(c, { repeat: [1, 1] });
}

function woodTex(light, dark, R, { w = 1024, h = 512, rings = 60 } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = light; g.fillRect(0, 0, w, h);
  for (let k = 0; k < rings; k++) {
    g.strokeStyle = dark; g.globalAlpha = 0.05 + R() * 0.2; g.lineWidth = 0.6 + R() * 3;
    const y0 = R() * h, amp = 2 + R() * 9, fr = 0.002 + R() * 0.008, ph = R() * 6;
    g.beginPath();
    for (let x = 0; x <= w; x += 12) { const y = y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 3.1) * amp * 0.3; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  grain(g, w, h, 12, R);
  return toTex(c, { repeat: [1, 1] });
}

function roadTex(R) {
  // un pezzo di pista giocattolo: 17 unità di larghezza, 34 di lunghezza
  const W = 256, Hh = 512;
  const c = canvas(W, Hh), g = c.getContext('2d');
  g.fillStyle = '#3c3f45'; g.fillRect(0, 0, W, Hh);
  // granella dell'asfalto stampato
  for (let k = 0; k < 9000; k++) { const v = R() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${R() * 0.09})`; g.fillRect(R() * W, R() * Hh, 1.5, 1.5); }
  // segni delle gomme
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = `rgba(15,15,18,${0.12 + R() * 0.15})`; g.lineWidth = 6 + R() * 6;
    const x0 = 50 + R() * 156; g.beginPath(); g.moveTo(x0, 0); g.bezierCurveTo(x0 + (R() - 0.5) * 60, Hh * 0.3, x0 + (R() - 0.5) * 60, Hh * 0.7, x0 + (R() - 0.5) * 40, Hh); g.stroke();
  }
  // linee bianche ai bordi e tratteggio centrale
  g.fillStyle = '#ecebe6';
  g.fillRect(12, 0, 7, Hh); g.fillRect(W - 19, 0, 7, Hh);
  g.fillRect(W / 2 - 3, 40, 6, 150); g.fillRect(W / 2 - 3, 296, 6, 150);
  // bordino rialzato del pezzo e giunto con incastro
  g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 5, Hh); g.fillRect(W - 5, 0, 5, Hh);
  g.fillStyle = '#1d1f22'; g.fillRect(0, 0, W, 3);
  for (const x of [W * 0.3, W * 0.7]) { g.beginPath(); g.arc(x, 2, 7, 0, Math.PI); g.fill(); }
  grain(g, W, Hh, 8, R);
  const bump = canvas(64, 128), b = bump.getContext('2d');
  b.fillStyle = '#909090'; b.fillRect(0, 0, 64, 128);
  b.fillStyle = '#ffffff'; b.fillRect(0, 0, 2, 128); b.fillRect(62, 0, 2, 128);
  b.fillStyle = '#202020'; b.fillRect(0, 0, 64, 1.5);
  return { map: toTex(c, { repeat: [1, 1] }), bump: toTex(bump, { srgb: false, repeat: [1, 1] }) };
}

function cardboardTex(R) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#b98a5b'; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 7) { g.fillStyle = `rgba(90,60,30,${0.06 + R() * 0.05})`; g.fillRect(x, 0, 2, 512); }
  g.fillStyle = 'rgba(160,30,30,0.55)'; g.font = '900 54px Arial Black, sans-serif'; g.save(); g.translate(256, 300); g.rotate(-0.08);
  g.textAlign = 'center'; g.fillText('FRAGILE', 0, 0); g.font = '700 26px Arial, sans-serif'; g.fillText('▲ ALTO ▲', 0, 44); g.restore();
  g.fillStyle = 'rgba(225,205,160,0.75)'; g.fillRect(0, 90, 512, 46);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 96, 512, 6);
  grain(g, 512, 512, 18, R);
  return toTex(c, { repeat: [1, 1] });
}

function paintTex(R) {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
  grain(g, 256, 256, 9, R);
  return toTex(c, { repeat: [1, 1] });
}

function rugTex(R) {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#d8cdb8'; g.fillRect(0, 0, S, S);
  // disegno moderno: linee spezzate e campiture a mano
  g.lineCap = 'round';
  const cols = ['#2f3338', '#b5653e', '#c9a35a', '#5d6b6a'];
  for (let k = 0; k < 26; k++) {
    g.strokeStyle = cols[k % cols.length]; g.globalAlpha = 0.75; g.lineWidth = 6 + R() * 22;
    g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += (R() - 0.5) * 500; y += (R() - 0.5) * 500; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#2f3338'; g.lineWidth = 18; g.strokeRect(40, 40, S - 80, S - 80);
  // pelo del tappeto
  const d = g.getImageData(0, 0, S, S), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const n = (R() - 0.5) * 46; a[i] += n; a[i + 1] += n; a[i + 2] += n; }
  g.putImageData(d, 0, 0);
  return toTex(c);
}

function labelTex(R) {
  const c = canvas(512, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0f5132'); gr.addColorStop(1, '#0a3a24');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#d9b44a'; g.fillRect(0, 30, 512, 8); g.fillRect(0, 218, 512, 8);
  g.font = '900 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const x of [128, 384]) { g.fillStyle = '#f5e7b8'; g.fillText('MANCAVE', x, 110); g.font = '700 28px Georgia, serif'; g.fillStyle = '#d9b44a'; g.fillText('LAGER · ROMA', x, 160); g.font = '900 54px Georgia, serif'; }
  return toTex(c);
}

function screenTex() {
  // sullo schermo della TV gira... il gioco stesso
  const c = canvas(1024, 576), g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, '#3a7bd5'); sky.addColorStop(1, '#bfe3ff');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 300);
  g.fillStyle = '#3f9b4a'; g.fillRect(0, 300, 1024, 276);
  g.fillStyle = '#44464c'; g.beginPath(); g.moveTo(470, 300); g.lineTo(554, 300); g.lineTo(900, 576); g.lineTo(124, 576); g.fill();
  g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const t = i / 6, y = 300 + t * t * 276, w = 3 + t * 14; g.fillRect(512 - w / 2, y, w, 6 + t * 30); }
  const kart = (x, y, s, col) => { g.fillStyle = col; g.fillRect(x - 30 * s, y - 16 * s, 60 * s, 22 * s); g.fillStyle = '#111'; g.fillRect(x - 36 * s, y - 2 * s, 14 * s, 12 * s); g.fillRect(x + 22 * s, y - 2 * s, 14 * s, 12 * s); g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(x, y - 26 * s, 12 * s, 0, 7); g.fill(); };
  kart(560, 360, 0.7, '#e53935'); kart(470, 410, 1.1, '#1e88e5'); kart(520, 500, 1.8, '#8e24aa');
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(20, 20, 220, 70);
  g.fillStyle = '#fff'; g.font = '900 44px Arial Black, sans-serif'; g.fillText('GIRO 2/3', 34, 72);
  g.fillStyle = '#ffd400'; g.font = '900 120px Arial Black, sans-serif'; g.fillText('1°', 40, 540);
  return toTex(c);
}

function posterTex(kind) {
  const c = canvas(512, 720), g = c.getContext('2d');
  if (kind === 0) {
    g.fillStyle = '#f1e4c8'; g.fillRect(0, 0, 512, 720);
    g.fillStyle = '#c0392b'; g.beginPath(); g.arc(256, 300, 170, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1c2833'; g.beginPath(); g.moveTo(60, 470); g.quadraticCurveTo(256, 120, 452, 470); g.lineTo(452, 520); g.lineTo(60, 520); g.fill();
    g.fillStyle = '#f1e4c8'; g.font = '900 64px Georgia, serif'; g.textAlign = 'center'; g.fillText('GRAN PREMIO', 256, 600);
    g.font = '700 40px Georgia, serif'; g.fillStyle = '#1c2833'; g.fillText('DELLA MANCAVE · 2026', 256, 650);
  } else if (kind === 1) {
    g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, 512, 720);
    // il Colosseo in silhouette, al tramonto
    const gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#f39c12'); gr.addColorStop(1, '#8e44ad');
    g.fillStyle = gr; g.fillRect(30, 30, 452, 560);
    g.fillStyle = '#1b1b1f'; g.beginPath(); g.moveTo(60, 590); g.lineTo(60, 360); g.quadraticCurveTo(256, 300, 452, 330); g.lineTo(452, 590); g.fill();
    g.fillStyle = '#e67e22'; for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(88 + i * 42, 400 + r * 62, 12, 20, 0, Math.PI, 0); g.lineTo(100 + i * 42, 425 + r * 62); g.lineTo(76 + i * 42, 425 + r * 62); g.fill(); }
    g.fillStyle = '#f5f5f5'; g.font = '900 72px Georgia, serif'; g.textAlign = 'center'; g.fillText('ROMA', 256, 670);
  } else {
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, 512, 720);
    g.fillStyle = '#7a1f2b'; g.fillRect(80, 120, 352, 420);
    g.fillStyle = '#f0c040'; g.font = '900 220px Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('10', 256, 420);
    g.fillStyle = '#f0c040'; g.font = '900 46px Arial Black, sans-serif'; g.fillText('SIMONE', 256, 220);
  }
  return toTex(c);
}

function neonTex(text, color) {
  const c = canvas(1024, 256), g = c.getContext('2d');
  g.font = '700 150px "Brush Script MT", "Segoe Script", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 40; g.fillStyle = color;
  for (let i = 0; i < 3; i++) g.fillText(text, 512, 132);
  g.shadowBlur = 8; g.fillStyle = '#ffffff'; g.fillText(text, 512, 132);
  return toTex(c);
}

function leafTex() {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#2f6b34';
  g.beginPath(); g.moveTo(128, 250); g.bezierCurveTo(10, 200, 10, 40, 128, 6); g.bezierCurveTo(246, 40, 246, 200, 128, 250); g.fill();
  // tagli della foglia (stile monstera)
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) { const y = 60 + i * 38; g.beginPath(); g.moveTo(0, y - 10); g.lineTo(100, y + 12); g.lineTo(0, y + 6); g.fill(); g.beginPath(); g.moveTo(256, y - 10); g.lineTo(156, y + 12); g.lineTo(256, y + 6); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#8fbf6a'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 250); g.lineTo(128, 12); g.stroke();
  g.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const y = 40 + i * 30; g.beginPath(); g.moveTo(128, y + 20); g.lineTo(40, y); g.moveTo(128, y + 20); g.lineTo(216, y); g.stroke(); }
  return toTex(c);
}

// ------------------------------------------------------------------ forme
// scatola con spigoli arrotondati (cuscini, mobili): altezza lungo y, centrata
function roundBox(w, h, d, r, seg = 3) {
  r = Math.max(0.05, Math.min(r, w / 2 - 0.05, d / 2 - 0.05, h / 2 - 0.05));
  const iw = w - 2 * r, id = d - 2 * r, s = new THREE.Shape();
  s.moveTo(-iw / 2, -id / 2); s.lineTo(iw / 2, -id / 2); s.lineTo(iw / 2, id / 2); s.lineTo(-iw / 2, id / 2); s.lineTo(-iw / 2, -id / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - 2 * r) / 2, 0);
  g.computeVertexNormals();
  return g;
}

export function buildMancave(root, track, opts = {}) {
  const night = !!opts.night;
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(23);
  const P = (i) => pts[((i % count) + count) % count];
  const H = (i) => track.hs[((i % count) + count) % count];
  const Z = (i) => track.zone[((i % count) + count) % count];
  const STEP = (i) => track.step[((i % count) + count) % count];

  // distanza di un punto dal centro pista (per non mettere oggetti sulla strada)
  function distTrack(x, z) { let bd = Infinity; for (let i = 0; i < count; i += 2) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); }
  const free = (x, z, r) => distTrack(x, z) > wall + r;

  // mette un modello Kenney: (x, z) è il centro, y la base; scala uniforme (s) o su misura (w, h, d nelle misure del modello)
  const pending = [];
  const solidObjs = [];        // mobili che fanno da ostacolo (gambe, sgabelli, casse...)
  function K(name, o) {
    const pr = loadK(name).then((m) => {
      if (!m) return null;
      const size = m.box.getSize(new THREE.Vector3()), ctr = m.box.getCenter(new THREE.Vector3());
      let sx, sy, sz;
      if (o.s) sx = sy = sz = o.s;
      else {
        const u = o.h ? o.h / size.y : o.w ? o.w / size.x : o.d / size.z;
        sx = o.w ? o.w / size.x : u; sy = o.h ? o.h / size.y : u; sz = o.d ? o.d / size.z : u;
      }
      const inner = m.scene.clone(true);
      if (o.colors) inner.traverse((q) => { if (q.isMesh && o.colors[q.material.name]) { q.material = q.material.clone(); q.material.color.set(o.colors[q.material.name]); } });
      inner.position.set(-ctr.x, -m.box.min.y, -ctr.z);
      const pivot = new THREE.Group(); pivot.scale.set(sx, sy, sz); pivot.add(inner);
      const outer = new THREE.Group(); outer.position.set(o.x, o.y || 0, o.z); outer.rotation.y = o.ry || 0; outer.add(pivot);
      if (o.tilt) outer.rotation.x = o.tilt;
      root.add(outer);
      if (!o.ghost) { outer.userData.kname = name; solidObjs.push(outer); }
      outer.userData.size = new THREE.Vector3(size.x * sx, size.y * sy, size.z * sz);
      if (o.then) o.then(outer);
      return outer;
    });
    pending.push(pr);
    return pr;
  }

  // ---------------------------------------------------------------- materiali
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tile = (t, size) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(1 / size, 1 / size); return c; };
  const PQ = parquetTex(R);
  const ROAD = roadTex(R);
  const M = {
    road: std({ map: ROAD.map, bumpMap: ROAD.bump, bumpScale: 0.6, roughness: 0.62, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    rail: new THREE.MeshPhysicalMaterial({ color: '#f4f2ec', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    railTop: new THREE.MeshPhysicalMaterial({ color: '#e0372b', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    paint: std({ map: paintTex(R), color: '#f7dfa6', roughness: 0.92 }),
    ceiling: std({ color: '#fbf6ec', roughness: 0.95 }),
    white: std({ color: '#f3f1ec', roughness: 0.55 }),
    black: std({ color: '#151517', roughness: 0.45 }),
    blackMatte: std({ color: '#1d1d20', roughness: 0.85 }),
    chrome: std({ color: '#e8e8ea', roughness: 0.18, metalness: 1 }),
    brass: std({ color: '#c9a25a', roughness: 0.28, metalness: 1 }),
    steelDark: std({ color: '#2a2b2e', roughness: 0.35, metalness: 0.9 }),
    cardboard: std({ map: cardboardTex(R), roughness: 0.95 }),
  };
  const fabric = (col, size, o = {}) => { const t = fabricTex(col, R, o); t.repeat.set(1 / size, 1 / size); return std({ map: t, roughness: 1, bumpMap: t, bumpScale: 0.4 }); };
  M.sofa = fabric('#56606b', 14);
  M.sofaDark = fabric('#454e58', 14);
  M.pillowA = fabric('#c8963e', 10);
  M.pillowB = fabric('#9a4a35', 10);
  M.pouf = fabric('#7d8c74', 14, { knit: true });
  M.wedge = fabric('#8b8f96', 16);
  M.blanket = fabric('#d9cfc0', 10, { knit: true });
  M.curtain = fabric('#7b6a58', 30, { weave: 0.3 });
  M.leather = std({ color: '#3a2418', roughness: 0.5 });
  const wood = (light, dark, size, rough = 0.5) => { const t = woodTex(light, dark, R); t.repeat.set(1 / size, 1 / (size / 2)); return std({ map: t, roughness: rough }); };
  M.oak = wood('#b58a5c', '#5e3b1c', 70, 0.42);
  M.walnut = wood('#6b4a33', '#2a180c', 60, 0.4);
  M.walnutBox = (() => { const t = woodTex('#6b4a33', '#2a180c', R); return std({ map: t, roughness: 0.42 }); })();
  M.oakBox = (() => { const t = woodTex('#b58a5c', '#5e3b1c', R); return std({ map: t, roughness: 0.42 }); })();
  M.darkWood = (() => { const t = woodTex('#4a3122', '#1c110a', R); return std({ map: t, roughness: 0.45 }); })();
  M.slat = (() => { const t = woodTex('#7a5538', '#33200f', R, { w: 128, h: 1024, rings: 30 }); return std({ map: t, roughness: 0.55 }); })();
  M.granite = std({ color: '#1f2023', roughness: 0.16, metalness: 0.1 });
  M.glassAmber = std({ color: '#8a4b0c', roughness: 0.06, transparent: true, opacity: 0.82 });
  M.glassGreen = std({ color: '#1f5a2a', roughness: 0.06, transparent: true, opacity: 0.82 });
  M.glassClear = std({ color: '#cfe3ea', roughness: 0.04, transparent: true, opacity: 0.35 });
  M.can = std({ map: labelTex(R), roughness: 0.25, metalness: 0.75 });
  M.canTop = std({ color: '#cfd2d6', roughness: 0.2, metalness: 1 });
  M.terracotta = std({ color: '#b5603c', roughness: 0.85 });
  M.leaf = new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  M.dust = std({ color: '#9a958d', roughness: 1 });

  const add = (geo, mat, x, y, z, ry = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry);
  const rbox = (w, h, d, r, mat, x, y, z, ry = 0) => add(roundBox(w, h, d, r), mat, x, y, z, ry);
  const cyl = (rt, rb, h, mat, x, y, z, seg = 24) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);

  // ---------------------------------------------------------------- stanza
  const RX = 200, RZ = 175, RH = 135;
  {
    const floorTex = PQ.map.clone(); floorTex.needsUpdate = true; floorTex.repeat.set(RX * 2 / 120, RZ * 2 / 120);
    const floorBump = PQ.bump.clone(); floorBump.needsUpdate = true; floorBump.repeat.copy(floorTex.repeat);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), std({ map: floorTex, bumpMap: floorBump, bumpScale: 0.8, roughness: 0.34, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.userData.noCast = true; root.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), M.ceiling);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; ceil.userData.noCast = true; root.add(ceil);
    // faretti a incasso
    const spotMat = new THREE.MeshBasicMaterial({ color: '#fff4e0' });
    for (const [x, z] of [[-110, -80], [0, -80], [110, -80], [-110, 70], [0, 70], [110, 70]]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(4, 20), spotMat); d.rotation.x = Math.PI / 2; d.position.set(x, RH - 0.1, z); d.userData.noShadow = true; root.add(d);
    }
    const wallMat = M.paint.clone(); wallMat.map = M.paint.map.clone(); wallMat.map.needsUpdate = true; wallMat.map.repeat.set(4, 2);
    const mkWall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), wallMat); m.position.set(x, RH / 2, z); m.rotation.y = ry; m.userData.noCast = true; root.add(m); };
    mkWall(RX * 2, 0, RZ, Math.PI);       // nord (divano)
    mkWall(RX * 2, 0, -RZ, 0);            // sud (TV)
    mkWall(RZ * 2, RX, 0, -Math.PI / 2);  // est (bar)
    mkWall(RZ * 2, -RX, 0, Math.PI / 2);  // ovest (finestra)
    // battiscopa
    for (const [w, x, z, ry] of [[RX * 2, 0, RZ - 0.6, 0], [RX * 2, 0, -RZ + 0.6, 0], [RZ * 2, RX - 0.6, 0, Math.PI / 2], [RZ * 2, -RX + 0.6, 0, Math.PI / 2]]) box(w, 5, 1.2, M.white, x, 2.5, z, ry);
  }

  // ---------------------------------------------------------------- pista: pezzi di pista giocattolo
  // tratti continui (si spezzano dove c'è un salto)
  const runs = [];
  { let s = 0; for (let i = 1; i <= count; i++) if (i === count || STEP(i)) { runs.push([s, i]); s = i; } }
  if (runs.length > 1 && !STEP(0)) { const last = runs.pop(); runs[0] = [last[0], runs[0][1] + count]; }
  // altezza al campione i, ma alla fine di un tratto che finisce su un salto resta in alto
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
  // fianco verticale: dal bordo a altezza pista giù fino al pavimento
  function side(i0, i1, lat, mat, filter, top = 0) {
    const v = [], uv = [], id = [];
    let k = 0;
    for (let i = i0; i <= i1; i++) {
      if (filter && !filter(i)) { k = -1; continue; }
      const p = P(i), y = Hr(i, i1) + top;
      v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * lat, 0, p.z + p.rz * lat);
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
  const raised = (i) => H(i) > 0.3 && Z(i) !== 'table' && Z(i) !== 'pouf';
  const support = (i) => H(i) > 0.3 && Z(i) !== 'table';
  const kerbC = canvas(16, 64), kg = kerbC.getContext('2d');
  kg.fillStyle = '#f4f4f4'; kg.fillRect(0, 0, 16, 64); kg.fillStyle = '#e8322b'; kg.fillRect(0, 0, 16, 32);
  const kerbT = toTex(kerbC, { repeat: [1, 1] });
  const kerbMat = std({ map: kerbT, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const curvy = (i) => Math.abs(P(i - 5).tx * P(i + 5).tz - P(i - 5).tz * P(i + 5).tx) > 0.12;
  for (const [a, b] of runs) {
    strip(a, b, -hw, hw, 0.06, M.road, hw * 4);
    // cordoli rossi e bianchi nelle curve
    strip(a, b, -hw - 1.8, -hw, 0.1, kerbMat, 5, curvy).userData.noCast = true;
    strip(a, b, hw, hw + 1.8, 0.1, kerbMat, 5, curvy).userData.noCast = true;
    // sotto la pista in salita: la rampa di cartone, il cuneo di gommapiuma dopo il pouf
    const isRamp = (i) => raised(i) && Z(i) === 'ramp';
    const isWedge = (i) => raised(i) && Z(i) !== 'ramp';
    for (const [f, mat] of [[isRamp, M.cardboard], [isWedge, M.wedge]]) {
      strip(a, b, -hw - 2.2, -hw, 0.02, mat, 20, f);
      strip(a, b, hw, hw + 2.2, 0.02, mat, 20, f);
      side(a, b, -hw - 2.2, mat, f, 0.02);
      side(a, b, hw + 2.2, mat, f, 0.02);
    }
  }
  // barriere di plastica (non sul tavolino, dove si può cadere)
  {
    const RH2 = 1.9, wl = wall - 0.2;
    const ok = (i) => Z(i) !== 'table' && !(Z(i) === 'pouf' && H(i) > 0.3);
    for (const [a, b] of runs) for (const sgn of [-1, 1]) {
      // pannello verticale
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
      const m = new THREE.Mesh(g, M.rail); m.material.side = THREE.DoubleSide; root.add(m);
      // bordo tondo rosso in cima (un tubo liscio che segue la barriera)
      let seg = [];
      const flush = () => {
        if (seg.length >= 2) {
          const curve = new THREE.CatmullRomCurve3(seg);
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(4, seg.length * 3), 0.42, 8, false), M.railTop);
          root.add(tube);
        }
        seg = [];
      };
      for (let i = a; i <= b; i += 3) {
        if (!ok(i)) { flush(); continue; }
        const p = P(i), l = sgn * wl;
        seg.push(new THREE.Vector3(p.x + p.rx * l, Hr(Math.min(i, b), b) + RH2, p.z + p.rz * l));
      }
      if (ok(b)) { const p = P(b), l = sgn * wl; seg.push(new THREE.Vector3(p.x + p.rx * l, Hr(b, b) + RH2, p.z + p.rz * l)); }
      flush();
    }
    // paletti ogni 6 unità
    const post = new THREE.BoxGeometry(0.9, RH2 + 0.4, 0.9);
    const list = [];
    for (let i = 0; i < count; i += 4) if (ok(i)) for (const sgn of [-1, 1]) list.push([i, sgn]);
    const inst = new THREE.InstancedMesh(post, M.rail, list.length);
    const mm = new THREE.Matrix4();
    list.forEach(([i, sgn], n) => { const p = P(i), l = sgn * (wall - 0.2 + sgn * 0.45 * sgn); mm.makeRotationY(Math.atan2(p.tx, p.tz)); mm.setPosition(p.x + p.rx * l, H(i) + (RH2 + 0.4) / 2, p.z + p.rz * l); inst.setMatrixAt(n, mm); });
    root.add(inst);
  }

  // ---------------------------------------------------------------- tappeto
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(210, 150), std({ map: rugTex(R), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-40, 0.02, 45); rug.userData.noCast = true; root.add(rug);
  }

  // ---------------------------------------------------------------- parete TV (sud)
  {
    const z0 = -RZ;
    // parete colorata dietro la TV
    box(230, RH, 0.6, std({ color: '#2f6fb3', roughness: 0.9 }), 0, RH / 2, z0 + 0.4).userData.noCast = true;
    // mobile TV, TV, casse, piante
    K('cabinetTelevision', { x: 0, z: z0 + 16, w: 170, h: 30, d: 30 });
    K('televisionModern', { x: 0, z: z0 + 14, y: 30, s: 125, then: (tv) => {
      const sz = tv.userData.size;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * 0.93, sz.y * 0.74), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false }));
      scr.position.set(0, sz.y * 0.6, sz.z / 2 + 0.3); scr.userData.noShadow = true; tv.add(scr);
    } });
    K('speaker', { x: -105, z: z0 + 14, s: 110, ry: 0.15 });
    K('speaker', { x: 105, z: z0 + 14, s: 110, ry: -0.15 });
    K('pottedPlant', { x: -150, z: z0 + 18, s: 190 });
    K('radio', { x: 55, z: z0 + 18, y: 30, s: 70, ry: -0.3 });
    K('books', { x: -55, z: z0 + 18, y: 30, s: 90, ry: 0.2 });
    // luce LED dietro la TV
    const glow = canvas(256, 256), gg = glow.getContext('2d');
    const gr = gg.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(120,200,255,0.8)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, 256, 256);
    const g2 = new THREE.Mesh(new THREE.PlaneGeometry(150, 100), new THREE.MeshBasicMaterial({ map: toTex(glow), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    g2.position.set(0, 62, z0 + 1); g2.userData.noShadow = true; root.add(g2);
  }

  // ---------------------------------------------------------------- divano (nord): rialzato sulle gambe, la pista ci passa sotto
  {
    const x0 = -85, x1 = 60, z0 = 112, z1 = 172, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lift = 17;
    for (const x of [x0 + 6, cx, x1 - 6]) for (const z of [z0 + 5, z1 - 5]) solidObjs.push(cyl(1.8, 1.3, lift, std({ color: '#7a4a29', roughness: 0.5 }), x, lift / 2, z, 12));
    box(x1 - x0 - 4, 2, z1 - z0 - 4, std({ color: '#7a4a29', roughness: 0.6 }), cx, lift - 1, cz);
    K('loungeSofa', { x: cx, z: cz, y: lift, w: x1 - x0, d: z1 - z0, h: 66, ry: Math.PI });
    K('pillowBlue', { x: x0 + 30, z: z1 - 22, y: lift + 26, s: 95, ry: Math.PI + 0.3, tilt: -0.2 });
    K('pillow', { x: x1 - 30, z: z1 - 22, y: lift + 26, s: 95, ry: Math.PI - 0.3, tilt: -0.2 });
    // sotto il divano: polvere e monetine
    for (let k = 0; k < 9; k++) {
      const x = x0 + 8 + R() * (x1 - x0 - 16), z = R() < 0.5 ? z0 + 4 + R() * 6 : z1 - 4 - R() * 6;
      const d = new THREE.Mesh(new THREE.SphereGeometry(1.5 + R() * 1.6, 7, 5), M.dust); d.scale.y = 0.45; d.position.set(x, 0.6, z); root.add(d);
    }
    for (let k = 0; k < 5; k++) { const x = x0 + 10 + R() * (x1 - x0 - 20), z = z0 + 5 + R() * 4; cyl(1.2, 1.2, 0.2, M.brass, x, 0.12, z, 16); }
  }

  // ---------------------------------------------------------------- tavolino (la pista ci sale sopra, senza sponde)
  {
    const x0 = -100, x1 = 14, z0 = 14, z1 = 80, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = 18;
    K('tableCoffee', { x: cx, z: cz, w: x1 - x0, h: top, d: z1 - z0 });
    // sul piano, lontano dalla pista: pizza, lattina, patatine
    const onTop = (x, z, r) => distTrack(x, z) > hw + r + 2 && x - r > x0 && x + r < x1 && z - r > z0 && z + r < z1;
    if (onTop(-30, 30, 13)) K('pizzaBox', { x: -30, z: 30, y: top, s: 26, ry: 0.25 });
    if (onTop(4, 24, 5)) K('sodaCan', { x: 4, z: 24, y: top, s: 30 });
    if (onTop(-88, 70, 6)) K('fries', { x: -88, z: 70, y: top, s: 45, ry: 0.6 });
  }

  // ---------------------------------------------------------------- pouf (atterraggio dopo il salto)
  {
    const prof = [[0, 0], [18, 0], [19.5, 1.5], [20, 5], [19.5, 8.5], [18, 10], [0, 10]].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.LatheGeometry(prof, 40), M.pouf, 26, 0, 50);
  }

  // ---------------------------------------------------------------- bar (est): bancone, sgabelli, bottiglie, insegna
  {
    const xw = RX;
    // bancone fatto di tre pezzi, rivolto verso la stanza
    for (const z of [-50, 0, 50]) K('kitchenBar', { x: xw - 14, z, h: 52, w: 50, d: 28, ry: -Math.PI / 2 });
    // sgabelli
    for (const z of [-40, 0, 40]) K('stoolBar', { x: xw - 34, z, h: 38, ry: Math.PI / 2 });
    // sul bancone: bottiglie, cocktail, bicchieri
    K('wineRed', { x: xw - 16, z: -30, y: 52, s: 30 });
    K('sodaBottle', { x: xw - 18, z: -18, y: 52, s: 28 });
    K('cocktail', { x: xw - 20, z: 12, y: 52, s: 34 });
    K('glass', { x: xw - 20, z: 30, y: 52, s: 34 });
    K('sodaCan', { x: xw - 14, z: 44, y: 52, s: 28 });
    // mensole sul muro con altre bottiglie
    for (const y of [78, 98]) {
      box(12, 1.6, 120, std({ color: '#a8683a', roughness: 0.5 }), xw - 6, y, 0);
      for (let z = -52; z <= 52; z += 13) K(R() < 0.5 ? 'wineRed' : 'sodaBottle', { x: xw - 6, z: z + R() * 4, y: y + 0.8, s: 22 + R() * 8 });
    }
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(90, 22), new THREE.MeshBasicMaterial({ map: neonTex('Mancave', '#ff3d9a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    neon.position.set(xw - 0.6, 118, 0); neon.rotation.y = -Math.PI / 2; neon.userData.noShadow = true; root.add(neon);
    // frigo delle birre
    K('kitchenFridgeSmall', { x: xw - 18, z: 100, h: 56, ry: -Math.PI / 2 });
  }

  // ---------------------------------------------------------------- birra rovesciata (si scivola)
  {
    let a = -1, b = -1;
    for (let i = 0; i < count; i++) if (Z(i) === 'spill') { if (a < 0) a = i; b = i; }
    if (a >= 0) {
      const mid = P(Math.floor((a + b) / 2));
      const shape = new THREE.Shape();
      for (let k = 0; k <= 40; k++) {
        const t = k / 40 * Math.PI * 2, r = 1 + 0.18 * Math.sin(t * 3 + 1) + 0.1 * Math.sin(t * 7);
        const x = Math.cos(t) * 13 * r, y = Math.sin(t) * 22 * r;
        if (k) shape.lineTo(x, y); else shape.moveTo(x, y);
      }
      const puddle = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), std({ color: '#b07515', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.62, depthWrite: false }));
      puddle.rotation.x = -Math.PI / 2; puddle.rotation.z = -Math.atan2(mid.tx, mid.tz);
      puddle.position.set(mid.x, 0.09, mid.z); puddle.userData.noShadow = true; root.add(puddle);
      // la lattina che l'ha versata, coricata a lato
      for (const l of [hw + 7, -hw - 7]) {
        const x = mid.x + mid.rx * l * 1.2, z = mid.z + mid.rz * l * 1.2;
        if (free(x, z, 3)) { const c = can(x, 3.3, z); c.rotation.set(0, 0, Math.PI / 2); c.rotation.y = 0.6; break; }
      }
    }
  }

  // ---------------------------------------------------------------- tavolo da pranzo (ovest): la pista ci passa sotto
  {
    const x0 = -198, x1 = -138, z0 = -130, z1 = -50, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = 38;
    K('table', { x: cx, z: cz, w: z1 - z0, h: top, d: x1 - x0, ry: Math.PI / 2 });
    for (const z of [-72, -102]) if (free(-122, z, 12)) K('chair', { x: -122, z, h: 48, ry: -Math.PI / 2 });
    K('cupcake', { x: cx - 8, z: cz + 14, y: top, s: 40 });
    K('donutSprinkles', { x: cx + 6, z: cz - 10, y: top, s: 40 });
  }

  // ---------------------------------------------------------------- finestra (ovest) con il tramonto
  {
    const zc = 40, y0 = 42, y1 = 118, w = 84;
    const c = canvas(256, 256), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3d9bff'); gr.addColorStop(0.7, '#a9dcff'); gr.addColorStop(1, '#e6f6ff');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#ffffff'; for (const [x, y, r] of [[50, 60, 18], [72, 52, 22], [96, 62, 16], [180, 90, 14], [198, 84, 18], [216, 92, 12]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#5fbf5a'; g.beginPath(); g.moveTo(0, 256); g.quadraticCurveTo(70, 170, 140, 220); g.quadraticCurveTo(200, 180, 256, 210); g.lineTo(256, 256); g.fill();
    g.fillStyle = '#e8d3a8'; for (let x = 8; x < 256; x += 34) { const h = 30 + (x * 37 % 40); g.fillRect(x, 256 - h, 22, h); g.fillStyle = '#c4534a'; g.fillRect(x - 2, 256 - h - 6, 26, 7); g.fillStyle = '#e8d3a8'; }
    if (night) {
      // di notte: cielo scuro, luna, stelle e finestre accese
      const ng = g.createLinearGradient(0, 0, 0, 256); ng.addColorStop(0, '#060a1f'); ng.addColorStop(1, '#2a2350');
      g.fillStyle = ng; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) g.fillRect((i * 97) % 256, (i * 53) % 150, 1.5, 1.5);
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(196, 52, 18, 0, 7); g.fill();
      g.fillStyle = '#12101e'; for (let x = 0; x < 256; x += 30) { const h = 60 + (x * 41 % 70); g.fillRect(x, 256 - h, 26, h); }
      g.fillStyle = '#ffd56a'; for (let x = 4; x < 256; x += 30) for (let y = 120; y < 250; y += 12) if ((x * 7 + y * 3) % 5 < 2) g.fillRect(x, y, 5, 6);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), new THREE.MeshBasicMaterial({ map: toTex(c), toneMapped: false }));
    glass.position.set(-RX + 0.5, (y0 + y1) / 2, zc); glass.rotation.y = Math.PI / 2; glass.userData.noShadow = true; root.add(glass);
    box(3, 3, w + 6, M.white, -RX + 1.5, y0 - 1.5, zc); box(3, 3, w + 6, M.white, -RX + 1.5, y1 + 1.5, zc);
    box(3, y1 - y0, 3, M.white, -RX + 1.5, (y0 + y1) / 2, zc - w / 2 - 1.5); box(3, y1 - y0, 3, M.white, -RX + 1.5, (y0 + y1) / 2, zc + w / 2 + 1.5);
    box(2, y1 - y0, 2, M.white, -RX + 1.5, (y0 + y1) / 2, zc); box(2, 2, w, M.white, -RX + 1.5, y0 + (y1 - y0) * 0.6, zc);
    box(9, 1.6, w + 14, M.white, -RX + 4.5, y0 - 3.5, zc);
    // tende con le pieghe
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(26, RH - 8, 24, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.9) * 1.6);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, M.curtain); m.material.side = THREE.DoubleSide;
      m.position.set(-RX + 6, (RH - 8) / 2 + 2, zc + s * (w / 2 + 14)); m.rotation.y = Math.PI / 2; root.add(m);
    }
    const rod = cyl(0.7, 0.7, w + 70, M.brass, -RX + 6, RH - 5, zc, 10); rod.rotation.x = Math.PI / 2;
  }

  // ---------------------------------------------------------------- quadri e porta
  {
    const frame = (x, y, z, ry, kind, w = 34, h = 48) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
      add(new THREE.BoxGeometry(w + 3, h + 3, 1.6), M.black, 0, 0, 0, 0, g);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: posterTex(kind), roughness: 0.6 })); p.position.z = 0.85; g.add(p);
    };
    frame(-40, 82, RZ - 1, Math.PI, 0);
    frame(10, 82, RZ - 1, Math.PI, 1);
    frame(RX - 1, 72, 128, -Math.PI / 2, 2);
    frame(-RX + 1, 78, -110, Math.PI / 2, 1, 44, 30);
    // porta (nord-est)
    const dx = 140;
    rbox(46, 100, 2.4, 0.4, M.white, dx, 50, RZ - 1.2);
    for (const y of [25, 72]) box(38, 38, 0.6, std({ color: '#e9e6df', roughness: 0.6 }), dx, y, RZ - 2.6);
    cyl(1, 1, 7, M.chrome, dx - 18, 48, RZ - 4, 10).rotation.z = Math.PI / 2;
  }

  // ---------------------------------------------------------------- piante, lampada
  K('pottedPlant', { x: -178, z: 150, s: 230 });
  K('pottedPlant', { x: 180, z: -152, s: 200, ry: 1 });
  K('plantSmall1', { x: -180, z: -158, s: 260 });
  K('lampRoundFloor', { x: 84, z: 158, s: 150 });
  if (free(-172, 150, 22) && false) K('loungeChair', { x: -172, z: 150, h: 62, ry: Math.PI * 0.75 });
  if (free(-RX + 16, -28, 26)) K('bookcaseOpen', { x: -RX + 16, z: -28, h: 110, ry: Math.PI / 2 });
  if (free(-122, -20, 14)) K('cardboardBoxOpen', { x: -122, z: -20, s: 70, ry: 0.4 });
  K('ceilingFan', { x: -20, z: 20, y: RH - 25, s: 120 });
  // chitarra appoggiata al muro
  {
    const s = new THREE.Shape();
    s.moveTo(0, -18); s.bezierCurveTo(14, -18, 14, -2, 8, 1); s.bezierCurveTo(12, 5, 11, 14, 0, 14); s.bezierCurveTo(-11, 14, -12, 5, -8, 1); s.bezierCurveTo(-14, -2, -14, -18, 0, -18);
    const g = new THREE.Group(); g.position.set(-140, 19, -RZ + 9); g.rotation.x = -0.22; root.add(g);
    const sb = canvas(256, 256), sg = sb.getContext('2d');
    const grd = sg.createRadialGradient(128, 128, 20, 128, 128, 128); grd.addColorStop(0, '#e8a53c'); grd.addColorStop(0.55, '#a8461c'); grd.addColorStop(1, '#2a0f06');
    sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
    const sbt = toTex(sb); sbt.repeat.set(1 / 30, 1 / 34); sbt.offset.set(0.5, 0.55);
    add(new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 2 }), std({ map: sbt, roughness: 0.25 }), 0, 0, 0, 0, g);
    for (let k = 0; k < 6; k++) { const st = add(new THREE.CylinderGeometry(0.06, 0.06, 52, 4), M.chrome, -1 + k * 0.4, 18, 5.3, 0, g); }
    add(new THREE.BoxGeometry(5, 1.2, 1), M.black, 0, -8, 4.8, 0, g);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), M.black); hole.position.set(0, 3, 4.7); g.add(hole);
    add(new THREE.BoxGeometry(3.4, 34, 2), M.darkWood, 0, 30, 3.5, 0, g);
    add(new THREE.BoxGeometry(4.4, 9, 1.6), M.darkWood, 0, 51, 3.3, 0, g);
  }

  // oggetti a grandezza vera, che per un kart sono enormi
  function can(x, y, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); root.add(g);
    add(new THREE.CylinderGeometry(3.3, 3.3, 10, 28, 1, true), M.can, 0, 5.4, 0, 0, g);
    add(new THREE.LatheGeometry([[0, 0], [2.6, 0], [3.3, 0.6], [3.3, 0.8], [0, 0.8]].map(([a, b]) => new THREE.Vector2(a, b)), 28), M.canTop, 0, 0, 0, 0, g);
    add(new THREE.LatheGeometry([[0, 0], [3.3, 0], [2.6, 1.2], [2.7, 1.5], [0, 1.4]].map(([a, b]) => new THREE.Vector2(a, b)), 28), M.canTop, 0, 10.4, 0, 0, g);
    return g;
  }
  function bottle(x, y, z, mat, s = 1) {
    const prof = [[0, 0], [3, 0], [3.2, 0.5], [3.2, 13], [2.4, 16], [1.1, 19], [1.1, 23], [1.3, 23.4], [0, 23.4]];
    return add(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a * s, b * s)), 20), mat, x, y, z);
  }
  // slalom: "birilli" fatti di lattine, scarpe, pallone, libri all'interno delle curve
  {
    const props = [];
    for (let i = 0; i < count; i += 3) {
      const a = P(i - 6), b = P(i + 6);
      const cross = a.tx * b.tz - a.tz * b.tx;
      if (Math.abs(cross) > 0.35) props.push({ i, sgn: Math.sign(cross) });
    }
    // un oggetto ogni curva (non troppo vicini tra loro)
    const chosen = [];
    for (const p of props) if (!chosen.some(c => Math.abs(c.i - p.i) < 40)) chosen.push(p);
    let k = 0;
    for (const { i, sgn } of chosen) {
      const p = P(i);
      if (H(i) > 0.3) continue;
      // lato interno: la curva gira verso -sgn * destra
      const l = -sgn * (wall + 9);
      const x = p.x + p.rx * l, z = p.z + p.rz * l;
      if (!free(x, z, 6) || Math.abs(x) > RX - 12 || Math.abs(z) > RZ - 12) continue;
      if (x > -100 && x < 14 && z > 14 && z < 80) continue;      // c'è il tavolino
      if (x > -198 && x < -138 && z > -130 && z < -50) continue; // c'è il tavolo
      // oggetti giganti per un kart: lattine, panini, ciambelle, patatine, bottiglie, palloni
      const kind = k++ % 6, ry = R() * 6;
      if (kind === 0) K('sodaCan', { x, z, s: 36, ry });
      else if (kind === 1) K('burger', { x, z, s: 42, ry });
      else if (kind === 2) K('donutSprinkles', { x, z, s: 55, ry });
      else if (kind === 3) K('fries', { x, z, s: 55, ry });
      else if (kind === 4) K('sodaBottle', { x, z, s: 40, ry });
      else {
        add(new THREE.SphereGeometry(6.5, 28, 18), std({ color: '#ff8a2c', roughness: 0.6 }), x, 6.5, z);
        const seam = add(new THREE.TorusGeometry(6.52, 0.15, 6, 40), M.black, x, 6.5, z); seam.rotation.y = 0.6;
        const seam2 = add(new THREE.TorusGeometry(6.52, 0.15, 6, 40), M.black, x, 6.5, z); seam2.rotation.x = Math.PI / 2;
      }
    }
  }
  // joypad e cuffie a terra vicino al tappeto
  {
    const pad = (x, z, ry) => {
      if (!free(x, z, 8)) return;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      add(roundBox(15, 3.4, 9, 1.6), M.blackMatte, 0, 1.7, 0, 0, g);
      for (const s of [-1, 1]) { const grip = add(new THREE.SphereGeometry(3.4, 14, 10), M.blackMatte, s * 6, 1.7, -3, 0, g); grip.scale.set(1, 0.55, 1.4); }
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(1, 1, 1.4, 10), M.black, s * 3, 3.6, 1, 0, g);
    };
    pad(95, 40, 0.5); pad(-60, -10, 2.2); pad(40, -75, 1.2);
    // cavo del joypad che serpeggia sul pavimento
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(95, 0.5, 40), new THREE.Vector3(110, 0.5, 10), new THREE.Vector3(100, 0.5, -30), new THREE.Vector3(80, 0.5, -60)]);
    if ([0, 0.3, 0.6, 1].every(t => { const p = curve.getPoint(t); return free(p.x, p.z, 1); })) add(new THREE.TubeGeometry(curve, 60, 0.5, 6, false), M.black, 0, 0, 0);
  }

  // ---------------------------------------------------------------- ostacoli che si muovono
  {
    // aspirapolvere robot (17 cm di diametro, per un kart è un carro armato)
    const vac = new THREE.Group();
    add(new THREE.CylinderGeometry(4.2, 4.2, 2.4, 32), std({ color: '#26272b', roughness: 0.3, metalness: 0.3 }), 0, 1.4, 0, 0, vac);
    add(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 32), std({ color: '#3b3d42', roughness: 0.2, metalness: 0.6 }), 0, 2.7, 0, 0, vac);
    add(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16), std({ color: '#e9e9ea', roughness: 0.3 }), 0, 2.9, 1.6, 0, vac);
    const ledV = add(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: '#4dff88', toneMapped: false }), 0, 2.9, -1, 0, vac);
    const brush = add(new THREE.BoxGeometry(5, 0.2, 0.4), std({ color: '#999' }), 2.5, 0.2, 2.5, 0, vac);
    // gatto rosso tigrato (si siede in mezzo... no, attraversa)
    const cat = new THREE.Group();
    const fur = (() => { const c = canvas(256, 128), g = c.getContext('2d'); g.fillStyle = '#d98a3d'; g.fillRect(0, 0, 256, 128); g.fillStyle = 'rgba(120,55,15,0.55)'; for (let x = 6; x < 256; x += 22) { g.beginPath(); g.ellipse(x, 64, 5, 60, 0.2, 0, Math.PI * 2); g.fill(); } grain(g, 256, 128, 30, R); return std({ map: toTex(c), roughness: 0.95 }); })();
    const body = add(new THREE.CapsuleGeometry(3.2, 9, 8, 16), fur, 0, 7.5, 0, 0, cat); body.rotation.x = Math.PI / 2;
    const head = add(new THREE.SphereGeometry(3, 18, 14), fur, 0, 10.5, 7.8, 0, cat);
    for (const s of [-1, 1]) {
      const ear = add(new THREE.ConeGeometry(1.1, 2.4, 4), fur, s * 1.6, 13.4, 7.6, 0, cat);
      const eye = add(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: '#c8e04a' }), s * 1.1, 11, 10.5, 0, cat);
    }
    for (const [x, z] of [[-1.8, 4.5], [1.8, 4.5], [-1.8, -4.5], [1.8, -4.5]]) add(new THREE.CylinderGeometry(0.9, 0.8, 6, 8), fur, x, 3, z, 0, cat);
    const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 8, -7), new THREE.Vector3(0, 10, -11), new THREE.Vector3(0, 15, -12), new THREE.Vector3(0, 17, -9)]);
    add(new THREE.TubeGeometry(tailCurve, 16, 0.75, 8, false), fur, 0, 0, 0, 0, cat);
    vac.traverse(o => { o.userData.noShadow = true; });
    cat.traverse(o => { o.userData.noShadow = true; });
    root.add(vac, cat);
    track.obstacleMeshes = { vacuum: vac, cat };
  }

  // ---------------------------------------------------------------- luci: pomeriggio pieno di sole, o sera con neon e lampade
  if (!night) {
    root.add(new THREE.HemisphereLight('#ffffff', '#c89a6a', 0.85));
    const key = new THREE.DirectionalLight('#fff4e0', 2.7);
    key.position.set(-260, 380, 90); key.target.position.set(0, 0, 0);
    key.castShadow = true;
    const sc = key.shadow.camera; sc.left = -250; sc.right = 250; sc.top = 230; sc.bottom = -230; sc.near = 150; sc.far = 900;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.35; key.shadow.radius = 4;
    root.add(key, key.target);
    const fill = new THREE.DirectionalLight('#dfeaff', 0.8);
    fill.position.set(300, 200, -200); fill.target.position.set(0, 0, 0);
    root.add(fill, fill.target);
    const barL = new THREE.PointLight('#ffc27a', 1.2, 200, 1); barL.position.set(170, 90, 0); root.add(barL);
  } else {
    root.add(new THREE.HemisphereLight('#6a5cff', '#1a1020', 0.5));
    // luce della luna dalla finestra, con le ombre
    const moon = new THREE.DirectionalLight('#8fa6ff', 1.1);
    moon.position.set(-320, 300, 60); moon.target.position.set(0, 0, 0);
    moon.castShadow = true;
    const sc = moon.shadow.camera; sc.left = -250; sc.right = 250; sc.top = 230; sc.bottom = -230; sc.near = 150; sc.far = 900;
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35;
    root.add(moon, moon.target);
    // lampade calde, LED viola dietro la TV, luce rosa del neon del bar
    for (const [x, y, z, c, i] of [[84, 120, 158, '#ffcf8a', 2.4], [0, 70, -150, '#7b5cff', 2.6], [178, 110, 0, '#ff4fb0', 2.4], [-170, 60, -90, '#ffcf8a', 1.4], [0, 120, 20, '#5fd0ff', 1.0]]) {
      const l = new THREE.PointLight(c, i, 320, 1); l.position.set(x, y, z); root.add(l);
    }
    // strisce LED lungo le pareti in basso
    for (const [w, x, z, ry, c] of [[RX * 2, 0, RZ - 1.4, 0, '#ff3dbb'], [RX * 2, 0, -RZ + 1.4, 0, '#29e6ff'], [RZ * 2, RX - 1.4, 0, Math.PI / 2, '#b26bff'], [RZ * 2, -RX + 1.4, 0, Math.PI / 2, '#29e6ff']]) {
      const led = box(w, 1.2, 0.6, new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), x, 6.5, z, ry); led.userData.noShadow = true;
    }
    addNeon(root, track, 0.02);
  }

  // ombre: i mobili le proiettano, pavimento e pista le ricevono (calcolate una volta sola)
  function finalize() {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.noShadow) return;
    o.receiveShadow = true;
    o.castShadow = !o.userData.noCast && !(o.material && o.material.transparent);
  });
  // la luce ambiente dei riflessi non deve cancellare le ombre: forte solo su metallo e vetro
  const seen = new Set();
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (seen.has(m) || !m.isMeshStandardMaterial) continue;
      seen.add(m);
      m.envMapIntensity = m.metalness > 0.5 ? 1 : m.transparent ? 0.9 : 0.35;
    }
  });
  }
  finalize();
  // i modelli arrivano dopo: quando ci sono tutti ricalcolo le ombre
  track.ready = Promise.all(pending).then(() => { finalize(); buildSolid(); if (root.userData.refresh) root.userData.refresh(); });

  // griglia dei mobili solidi: per ogni triangolo dei mobili segno le celle che copre con la sua fascia di altezza
  function buildSolid() {
    const cs = 1, x0 = -RX, z0 = -RZ, nx = Math.ceil(RX * 2 / cs), nz = Math.ceil(RZ * 2 / cs);
    const cells = new Map();
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    root.updateMatrixWorld(true);
    const mark = (ia, ib, ja, jb, y0, y1) => {
      for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const key = j * nx + i;
        let sp = cells.get(key);
        if (!sp) { sp = []; cells.set(key, sp); }
        // unisco con una fascia che si sovrappone, così le liste restano corte
        let merged = false;
        for (let k = 0; k < sp.length; k += 2) if (sp[k] <= y1 + 0.2 && sp[k + 1] >= y0 - 0.2) { sp[k] = Math.min(sp[k], y0); sp[k + 1] = Math.max(sp[k + 1], y1); merged = true; break; }
        if (!merged) sp.push(y0, y1);
      }
    };
    for (const obj of solidObjs) obj.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const pos = m.geometry.attributes.position, idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        for (let q = 0; q < 3; q++) v[q].fromBufferAttribute(pos, idx ? idx.getX(t + q) : t + q).applyMatrix4(m.matrixWorld);
        const minX = Math.min(v[0].x, v[1].x, v[2].x), maxX = Math.max(v[0].x, v[1].x, v[2].x);
        const minZ = Math.min(v[0].z, v[1].z, v[2].z), maxZ = Math.max(v[0].z, v[1].z, v[2].z);
        const minY = Math.min(v[0].y, v[1].y, v[2].y), maxY = Math.max(v[0].y, v[1].y, v[2].y);
        if (maxY < 0.3) continue;                              // cose stese per terra (tappeti)
        if (maxX - minX > 12 && maxZ - minZ > 12 && maxY - minY < 1.5) continue;   // piani orizzontali grandi (sopra dei tavoli)
        mark(Math.floor((minX - x0) / cs), Math.floor((maxX - x0) / cs), Math.floor((minZ - z0) / cs), Math.floor((maxZ - z0) / cs), minY, maxY);
      }
    });
    // dove la pista sale sul tavolino il suo bordo non deve fermare il kart: tolgo quelle celle
    const { pts, count, halfWidth: hw } = track;
    for (let i = 0; i < count; i++) {
      // solo dove si sale sopra un mobile (rampa e tavolino): altrove i mobili dentro la pista restano ostacoli
      if (track.zone[i] !== 'ramp' && track.zone[i] !== 'table') continue;
      const a = pts[i], b = pts[(i + 1) % count];
      const w2 = track.wall + 1;
      for (let u = 0; u < 1; u += 0.25) {                 // passi piccoli, così non resta nessuna cella scoperta
        const px = a.x + (b.x - a.x) * u, pz = a.z + (b.z - a.z) * u;
        for (let lat = -w2; lat <= w2; lat += 0.4) {
          const ci = Math.floor((px + a.rx * lat - x0) / cs), cj = Math.floor((pz + a.rz * lat - z0) / cs);
          cells.delete(cj * nx + ci);
        }
      }
    }
    track.solid = { x0, z0, cs, nx, nz, cells };
  }

  root.userData.fog = new THREE.Fog(night ? '#120d24' : '#f7dfa6', 700, 1600);
  root.userData.background = new THREE.Color(night ? '#120d24' : '#f7dfa6');
  root.userData.toneMapping = THREE.ACESFilmicToneMapping;
  root.userData.exposure = night ? 1.25 : 1.05;
  root.userData.night = night;
  root.userData.makeEnv = makeEnv;
}

// riflessi: una stanza finta (soffitto chiaro, finestra arancio, LED viola) da cui prendere la luce ambiente
function makeEnv(renderer, night = false) {
  const pm = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 100), [
    new THREE.MeshBasicMaterial({ color: '#c9a77a', side: THREE.BackSide }),   // +x bar
    new THREE.MeshBasicMaterial({ color: '#bfe3ff', side: THREE.BackSide }),   // -x finestra
    new THREE.MeshBasicMaterial({ color: '#fbf6ec', side: THREE.BackSide }),   // soffitto
    new THREE.MeshBasicMaterial({ color: '#a8743f', side: THREE.BackSide }),   // pavimento
    new THREE.MeshBasicMaterial({ color: '#f2d9a0', side: THREE.BackSide }),   // nord
    new THREE.MeshBasicMaterial({ color: '#2f6fb3', side: THREE.BackSide }),   // sud
  ]);
  if (night) room.material.forEach((m) => m.color.multiplyScalar(0.18));
  sc.add(room);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: night ? new THREE.Color(0.6, 0.3, 1.2) : new THREE.Color(3, 2.8, 2.5) }));
  panel.rotation.x = Math.PI / 2; panel.position.y = 19.5; sc.add(panel);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.2, 2.6) }));
  win.rotation.y = Math.PI / 2; win.position.x = -49.5; sc.add(win);
  const rt = pm.fromScene(sc, 0.03);
  pm.dispose();
  return rt.texture;
}

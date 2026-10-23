// Grafica della pista "La Mancave": una stanza vera, in scala, vista da un kart giocattolo.
// Scala: 1 unità ≈ 2 cm. Il kart è lungo 6 cm, il divano è un palazzo.
// Luce calda della sera, ombre vere (calcolate una volta sola), riflessi sul parquet.
import * as THREE from 'three';

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
    const hue = 24 + r() * 8, sat = 42 + r() * 16, lig = 28 + r() * 13;
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

export function buildMancave(root, track) {
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(23);
  const P = (i) => pts[((i % count) + count) % count];
  const H = (i) => track.hs[((i % count) + count) % count];
  const Z = (i) => track.zone[((i % count) + count) % count];
  const STEP = (i) => track.step[((i % count) + count) % count];

  // distanza di un punto dal centro pista (per non mettere oggetti sulla strada)
  function distTrack(x, z) { let bd = Infinity; for (let i = 0; i < count; i += 2) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); }
  const free = (x, z, r) => distTrack(x, z) > wall + r;

  // ---------------------------------------------------------------- materiali
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tile = (t, size) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(1 / size, 1 / size); return c; };
  const PQ = parquetTex(R);
  const ROAD = roadTex(R);
  const M = {
    road: std({ map: ROAD.map, bumpMap: ROAD.bump, bumpScale: 0.6, roughness: 0.62, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    rail: std({ color: '#f1efe9', roughness: 0.38 }),
    railTop: std({ color: '#d63a2f', roughness: 0.4 }),
    paint: std({ map: paintTex(R), color: '#d9d2c7', roughness: 0.92 }),
    ceiling: std({ color: '#ebe6dd', roughness: 0.95 }),
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
  for (const [a, b] of runs) {
    strip(a, b, -hw, hw, 0.06, M.road, hw * 4);
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
      // bordo rosso in cima
      const t = strip(a, b, sgn * wl - 0.35, sgn * wl + 0.35, RH2, M.railTop, 10, ok);
      t.userData.noCast = true;
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
    // pannello a listelli di legno
    box(220, RH, 0.6, M.blackMatte, 0, RH / 2, z0 + 0.4);
    const slat = new THREE.BoxGeometry(3, RH, 2);
    const n = 44, inst = new THREE.InstancedMesh(slat, M.slat, n), mm = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { mm.makeTranslation(-108 + i * 5, RH / 2, z0 + 1.8); inst.setMatrixAt(i, mm); }
    inst.userData.noCast = true; root.add(inst);
    // mobile TV sospeso
    rbox(170, 24, 26, 1.2, M.walnutBox, 0, 18, z0 + 15);
    for (let i = 0; i < 4; i++) {
      box(0.3, 20, 0.3, M.black, -85 + 42.5 * (i + 0.5) - 21, 18, z0 + 28.1).visible = i > 0;
      box(14, 1, 1, M.brass, -85 + 42.5 * (i + 0.5), 25, z0 + 28.4);
    }
    box(170, 0.3, 0.3, M.black, 0, 6.2, z0 + 28.1);
    // TV
    const tv = new THREE.Group(); tv.position.set(0, 66, z0 + 3.2); root.add(tv);
    add(new THREE.BoxGeometry(76, 43, 1.4), M.black, 0, 0, 0, 0, tv);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(74, 41.5), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false }));
    scr.position.z = 0.75; scr.userData.noShadow = true; tv.add(scr);
    // luce LED dietro la TV
    const glow = canvas(256, 256), gg = glow.getContext('2d');
    const gr = gg.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(140,90,255,0.9)'); gr.addColorStop(1, 'rgba(140,90,255,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, 256, 256);
    const g2 = new THREE.Mesh(new THREE.PlaneGeometry(130, 90), new THREE.MeshBasicMaterial({ map: toTex(glow), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    g2.position.set(0, 66, z0 + 2.5); g2.userData.noShadow = true; root.add(g2);
    // soundbar, console, joypad, piantina
    rbox(64, 4, 7, 1.5, M.blackMatte, 0, 32, z0 + 22);
    rbox(9, 22, 18, 2, M.white, 58, 41, z0 + 14);
    box(1.4, 21, 16, M.black, 58, 41, z0 + 14);
    rbox(12, 2, 8, 1.5, M.blackMatte, 30, 31, z0 + 20, 0.4);
    add(new THREE.LatheGeometry([[0, 0], [5, 0], [6, 9], [5.5, 10], [0, 10]].map(([x, y]) => new THREE.Vector2(x, y)), 20), M.white, -60, 30, z0 + 14);
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 6), std({ color: '#5a8a4a', roughness: 0.7 })); l.position.set(-60 + Math.cos(i) * 2, 44, z0 + 14 + Math.sin(i) * 2); l.rotation.set(Math.sin(i * 2) * 0.5, 0, Math.cos(i * 2) * 0.5); root.add(l); }
    // casse da pavimento
    for (const x of [-100, 100]) {
      rbox(20, 62, 20, 1.5, M.walnutBox, x, 31, z0 + 14);
      box(17, 54, 0.4, std({ color: '#2b2b2e', roughness: 1 }), x, 33, z0 + 24.2);
      for (const [y, r] of [[52, 3.5], [36, 6], [18, 6]]) { const c = cyl(r, r, 0.6, M.black, x, y, z0 + 24.6); c.rotation.x = Math.PI / 2; const dc = cyl(r * 0.35, r * 0.35, 0.8, M.steelDark, x, y, z0 + 24.8); dc.rotation.x = Math.PI / 2; }
    }
  }

  // ---------------------------------------------------------------- divano (nord): la pista ci passa sotto
  {
    const x0 = -85, x1 = 60, z0 = 112, z1 = 172, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
    for (const x of [x0 + 4, cx, x1 - 4]) for (const z of [z0 + 3, z1 - 3]) cyl(1.3, 1.8, 14, M.darkWood, x, 7, z, 12);
    rbox(W, 9, D, 2, M.sofaDark, cx, 18.5, cz);
    // braccioli
    for (const x of [x0 + 7, x1 - 7]) rbox(14, 26, D, 4, M.sofa, x, 27, cz);
    // schienale e cuscini
    rbox(W - 28, 30, 13, 4, M.sofaDark, cx, 37, z1 - 7);
    const cw = (W - 28) / 3;
    for (let i = 0; i < 3; i++) {
      const x = x0 + 14 + cw * (i + 0.5);
      rbox(cw - 1, 10, D - 16, 4, M.sofa, x, 27.5, z0 + (D - 16) / 2 + 1);
      const b = rbox(cw - 2, 24, 10, 4.5, M.sofa, x, 42, z1 - 17); b.rotation.x = -0.18;
    }
    const pa = rbox(20, 20, 7, 3.5, M.pillowA, x0 + 26, 40, z1 - 26); pa.rotation.set(-0.35, 0.3, 0.12);
    const pb = rbox(18, 18, 7, 3.5, M.pillowB, x1 - 26, 39, z1 - 26); pb.rotation.set(-0.3, -0.25, -0.1);
    // plaid piegato sul bracciolo
    rbox(16, 3, 30, 1.4, M.blanket, x1 - 7, 41.5, cz - 4);
    // sotto il divano: polvere, monete, un calzino perso
    for (let k = 0; k < 9; k++) {
      const x = x0 + 8 + R() * (W - 16), z = R() < 0.5 ? z0 + 4 + R() * 6 : z1 - 4 - R() * 6;
      const d = new THREE.Mesh(new THREE.SphereGeometry(1.5 + R() * 1.6, 7, 5), M.dust); d.scale.y = 0.45; d.position.set(x, 0.6, z); root.add(d);
    }
    for (let k = 0; k < 5; k++) { const x = x0 + 10 + R() * (W - 20), z = z0 + 5 + R() * 4; cyl(1.2, 1.2, 0.2, M.brass, x, 0.12, z, 16); }
    const sock = rbox(5, 1.2, 12, 0.6, fabric('#e5e1d8', 6), x0 + 20, 0.6, z1 - 6, 0.7);
  }

  // ---------------------------------------------------------------- tavolino (la pista ci sale sopra, senza sponde)
  {
    const x0 = -100, x1 = 14, z0 = 14, z1 = 80, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = 18;
    rbox(x1 - x0, 3, z1 - z0, 0.8, M.oak, cx, top - 1.5, cz);
    // ripiano sotto e gambe di metallo nero
    rbox(x1 - x0 - 10, 1.5, z1 - z0 - 10, 0.5, M.oak, cx, 5, cz);
    for (const x of [x0 + 4, x1 - 4]) for (const z of [z0 + 4, z1 - 4]) cyl(0.9, 0.9, top - 3, M.steelDark, x, (top - 3) / 2, z, 12);
    // riviste sul ripiano basso
    for (let k = 0; k < 4; k++) { const m = box(20, 0.6, 27, std({ color: ['#c0392b', '#2c3e50', '#f1c40f', '#ecf0f1'][k], roughness: 0.4 }), cx - 20 + k * 3, 6.1 + k * 0.6, cz - 6 + k * 2); m.rotation.y = k * 0.2; }
    // sul piano: cartone della pizza, birre, ciotola di patatine, telecomando
    const onTop = (x, z, r) => free(x, z, r) || distTrack(x, z) > hw + r + 1.5;
    const items = [];
    const place = (x, z, r, fn) => { if (onTop(x, z, r) && x - r > x0 && x + r < x1 && z - r > z0 && z + r < z1) { fn(x, z); items.push([x, z]); } };
    place(-30, 30, 13, (x, z) => { rbox(24, 1.6, 24, 0.3, std({ color: '#e3d3b4', roughness: 0.9 }), x, top + 0.8, z, 0.25); });
    place(2, 28, 4, (x, z) => bottle(x, top, z, M.glassAmber));
    place(6, 20, 4, (x, z) => can(x, top, z));
    place(-90, 70, 7, (x, z) => { add(new THREE.LatheGeometry([[0, 0], [5, 0], [8, 4], [8.4, 4.4], [0, 4.4]].map(([a, b]) => new THREE.Vector2(a, b)), 24), M.white, x, top, z); for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.CircleGeometry(1.2, 6), std({ color: '#e8b64c', roughness: 0.6, side: THREE.DoubleSide })); c.position.set(x + (R() - 0.5) * 9, top + 4.3 + R(), z + (R() - 0.5) * 9); c.rotation.set(-Math.PI / 2 + (R() - 0.5), R(), 0); root.add(c); } });
    place(-55, 22, 6, (x, z) => { rbox(4, 1, 12, 0.5, M.blackMatte, x, top + 0.5, z, 0.9); });
  }

  // ---------------------------------------------------------------- pouf (atterraggio dopo il salto)
  {
    const prof = [[0, 0], [18, 0], [19.5, 1.5], [20, 5], [19.5, 8.5], [18, 10], [0, 10]].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.LatheGeometry(prof, 40), M.pouf, 26, 0, 50);
  }

  // ---------------------------------------------------------------- bar (est): bancone, sgabelli, mensole, insegna
  {
    const xw = RX, z0 = -60, z1 = 60;
    rbox(32, 52, z1 - z0, 1, M.darkWood, xw - 18, 26, 0);
    for (let z = z0 + 10; z < z1; z += 10) box(0.4, 46, 0.4, M.black, xw - 34.1, 26, z);
    rbox(37, 3, z1 - z0 + 4, 0.6, M.granite, xw - 19, 53.5, 0);
    const rail = cyl(0.8, 0.8, z1 - z0, M.brass, xw - 38, 9, 0, 12); rail.rotation.x = Math.PI / 2;
    for (const z of [z0 + 6, z1 - 6]) box(4, 1, 1, M.brass, xw - 36, 9, z);
    // sgabelli
    for (const z of [-38, 0, 38]) {
      cyl(8, 8, 1, M.chrome, xw - 36, 0.5, z, 28);
      cyl(1.1, 1.1, 36, M.chrome, xw - 36, 18, z, 12);
      const ring = add(new THREE.TorusGeometry(5.5, 0.45, 8, 28), M.chrome, xw - 36, 14, z); ring.rotation.x = Math.PI / 2;
      add(new THREE.LatheGeometry([[0, 0], [8, 0], [8.8, 1.5], [8.6, 3.5], [0, 3.5]].map(([a, b]) => new THREE.Vector2(a, b)), 28), M.leather, xw - 36, 36, z);
    }
    // spillatore e bicchiere
    cyl(1.2, 1.6, 14, M.chrome, xw - 22, 62, -20, 16);
    const tap = cyl(0.6, 0.6, 6, M.chrome, xw - 25, 67, -20, 10); tap.rotation.z = Math.PI / 2;
    add(new THREE.LatheGeometry([[0, 0], [2.5, 0], [3.2, 9], [0, 9]].map(([a, b]) => new THREE.Vector2(a, b)), 20), M.glassClear, xw - 26, 55, -10);
    // mensole con bottiglie
    const glassMats = [M.glassAmber, M.glassGreen, M.glassClear, std({ color: '#5a1d1d', roughness: 0.08, transparent: true, opacity: 0.85 })];
    for (const y of [76, 96]) {
      box(14, 1, 110, M.glassClear, xw - 7, y, 0).userData.noCast = true;
      for (let z = -48; z <= 48; z += 8 + R() * 5) bottle(xw - 7, y + 0.5, z, glassMats[Math.floor(R() * 4)], 0.8 + R() * 0.5);
      // luce LED sotto la mensola
      const led = box(1, 0.4, 108, new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }), xw - 2, y - 0.8, 0); led.userData.noShadow = true;
    }
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(90, 22), new THREE.MeshBasicMaterial({ map: neonTex('Mancave', '#ff3d9a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    neon.position.set(xw - 0.6, 116, 0); neon.rotation.y = -Math.PI / 2; neon.userData.noShadow = true; root.add(neon);
    // frigo per le birre con l'anta di vetro
    const fz = 95, fx = xw - 16;
    rbox(28, 52, 26, 1.5, M.blackMatte, fx, 26, fz);
    const inside = box(24, 46, 20, new THREE.MeshBasicMaterial({ color: '#dff3ff', toneMapped: false }), fx - 1, 26, fz); inside.userData.noShadow = true;
    for (const y of [9, 22, 35]) for (let k = 0; k < 4; k++) can(fx - 8, y, fz - 7 + k * 4.6, 0.85);
    box(0.5, 48, 22, M.glassClear, fx - 14.2, 26, fz).userData.noShadow = true;
    box(1, 30, 1.4, M.chrome, fx - 14.6, 30, fz + 9);
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
    const x0 = -198, x1 = -138, z0 = -130, z1 = -50, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = 37;
    rbox(x1 - x0, 3, z1 - z0, 0.8, M.walnut, cx, top - 1.5, cz);
    for (const x of [x0 + 3, x1 - 3]) for (const z of [z0 + 3, z1 - 3]) box(3.6, top - 3, 3.6, M.walnutBox, x, (top - 3) / 2, z);
    box(x1 - x0 - 8, 4, 1.2, M.walnutBox, cx, top - 5, z0 + 3); box(x1 - x0 - 8, 4, 1.2, M.walnutBox, cx, top - 5, z1 - 3);
    // sedie dal lato libero
    for (const z of [-72, -100]) {
      const x = -126;
      if (!free(x, z, 12)) continue;
      rbox(22, 2.5, 22, 0.8, M.walnutBox, x, 22, z);
      for (const dx of [-9.5, 9.5]) for (const dz of [-9.5, 9.5]) box(1.6, 21, 1.6, M.walnutBox, x + dx, 10.5, z + dz);
      rbox(2, 22, 22, 0.8, M.walnutBox, x + 10, 34, z);
    }
    // sopra il tavolo: lampada e fruttiera
    add(new THREE.LatheGeometry([[0, 0], [9, 0], [10, 5], [0, 5]].map(([a, b]) => new THREE.Vector2(a, b)), 28), M.white, cx, top, cz + 10);
    for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), std({ color: ['#e67e22', '#c0392b', '#f1c40f', '#27ae60', '#e67e22'][k], roughness: 0.5 })); f.position.set(cx + Math.cos(k * 1.3) * 4, top + 5, cz + 10 + Math.sin(k * 1.3) * 4); root.add(f); }
  }

  // ---------------------------------------------------------------- finestra (ovest) con il tramonto
  {
    const zc = 40, y0 = 42, y1 = 118, w = 84;
    const c = canvas(256, 256), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2c3e70'); gr.addColorStop(0.55, '#c86b5b'); gr.addColorStop(0.85, '#f5b26b'); gr.addColorStop(1, '#ffd79a');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#1d1a26'; for (let x = 0; x < 256; x += 10 + Math.random() * 18) { const h = 18 + Math.random() * 60; g.fillRect(x, 256 - h, 8 + Math.random() * 14, h); }
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

  // ---------------------------------------------------------------- piante, lampada, oggetti sparsi a terra
  function plant(x, z, s = 1) {
    add(new THREE.LatheGeometry([[0, 0], [10 * s, 0], [13 * s, 24 * s], [12 * s, 25 * s], [0, 25 * s]].map(([a, b]) => new THREE.Vector2(a, b)), 28), M.terracotta, x, 0, z);
    const leafGeo = new THREE.PlaneGeometry(16 * s, 16 * s); leafGeo.translate(0, 8 * s, 0);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, h = 26 * s + R() * 28 * s, out = 4 + R() * 9 * s;
      const stem = cyl(0.35 * s, 0.4 * s, h - 22 * s, std({ color: '#4c7a3a', roughness: 0.7 }), x + Math.cos(a) * out * 0.4, 24 * s + (h - 22 * s) / 2, z + Math.sin(a) * out * 0.4, 6);
      stem.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      const l = new THREE.Mesh(leafGeo, M.leaf);
      l.position.set(x + Math.cos(a) * out, h, z + Math.sin(a) * out);
      l.rotation.set(-0.9 - R() * 0.4, -a + Math.PI / 2, 0, 'YXZ'); root.add(l);
    }
  }
  plant(-178, 150, 1.25);
  plant(178, -150, 1.1);
  plant(-180, -158, 0.9);
  // lampada ad arco nell'angolo del divano
  {
    const bx = 82, bz = 160;
    cyl(10, 10, 3, std({ color: '#efece6', roughness: 0.3 }), bx, 1.5, bz, 32);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(bx, 3, bz), new THREE.Vector3(bx + 10, 150, bz - 10), new THREE.Vector3(bx - 40, 110, bz - 50));
    add(new THREE.TubeGeometry(curve, 40, 0.8, 8, false), M.chrome, 0, 0, 0);
    const shade = add(new THREE.SphereGeometry(12, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#d8d4cc', roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }), bx - 40, 104, bz - 50);
    const bulb = add(new THREE.SphereGeometry(3, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false }), bx - 40, 103, bz - 50);
    bulb.userData.noShadow = true; shade.userData.noCast = true;
  }
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
      const kind = k++ % 5;
      if (kind === 0) { can(x, 0, z); }
      else if (kind === 1) {
        const ball = add(new THREE.SphereGeometry(6, 28, 18), std({ color: '#d86a2a', roughness: 0.7 }), x, 6, z);
        const seam = add(new THREE.TorusGeometry(6.02, 0.12, 6, 40), M.black, x, 6, z); seam.rotation.y = 0.6;
        const seam2 = add(new THREE.TorusGeometry(6.02, 0.12, 6, 40), M.black, x, 6, z); seam2.rotation.x = Math.PI / 2;
      } else if (kind === 2) {
        const cols = ['#2c3e50', '#8e2c2c', '#d4ac0d', '#1e6f5c'];
        for (let j = 0; j < 4; j++) { const bk = rbox(22 - j, 3.2, 15 - j * 0.5, 0.4, std({ color: cols[j], roughness: 0.6 }), x, 1.6 + j * 3.3, z, R() * 0.5); bk.rotation.y = R() * 0.6 - 0.3; }
      } else if (kind === 3) {
        // scarpa da ginnastica
        const sh = new THREE.Group(); sh.position.set(x, 0, z); sh.rotation.y = R() * 6; root.add(sh);
        add(roundBox(10, 2.2, 28, 1), M.white, 0, 1.1, 0, 0, sh);
        add(roundBox(9, 8, 20, 3.5), std({ color: '#2b3a55', roughness: 0.7 }), 0, 6, -3, 0, sh);
        add(roundBox(8, 4, 8, 3), std({ color: '#2b3a55', roughness: 0.7 }), 0, 4, 8.5, 0, sh);
      } else {
        bottle(x, 0, z, M.glassGreen);
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

  // ---------------------------------------------------------------- luci
  {
    root.add(new THREE.HemisphereLight('#fff3e2', '#4a3528', 0.3));
    const key = new THREE.DirectionalLight('#ffe9cf', 2.6);
    key.position.set(150, 400, 110); key.target.position.set(-10, 0, -10);
    key.castShadow = true;
    const sc = key.shadow.camera; sc.left = -235; sc.right = 235; sc.top = 210; sc.bottom = -210; sc.near = 150; sc.far = 700;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.35; key.shadow.radius = 4;
    root.add(key, key.target);
    // tramonto dalla finestra
    const sunset = new THREE.DirectionalLight('#ffb070', 0.9);
    sunset.position.set(-400, 120, 40); sunset.target.position.set(0, 0, 20);
    root.add(sunset, sunset.target);
    // lampada ad arco, LED viola dietro la TV, luce del bar
    const lamp = new THREE.PointLight('#ffd7a0', 2.2, 260, 1); lamp.position.set(42, 96, 110); root.add(lamp);
    const led = new THREE.PointLight('#8c5aff', 1.6, 200, 1); led.position.set(0, 66, -160); root.add(led);
    const barL = new THREE.PointLight('#ffb36b', 1.4, 180, 1); barL.position.set(175, 90, 0); root.add(barL);
  }

  // ombre: i mobili le proiettano, pavimento e pista le ricevono (calcolate una volta sola)
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

  root.userData.fog = new THREE.Fog('#2a221c', 520, 1400);
  root.userData.background = new THREE.Color('#2a221c');
  root.userData.toneMapping = THREE.ACESFilmicToneMapping;
  root.userData.exposure = 0.9;
  root.userData.makeEnv = makeEnv;
}

// riflessi: una stanza finta (soffitto chiaro, finestra arancio, LED viola) da cui prendere la luce ambiente
function makeEnv(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 100), [
    new THREE.MeshBasicMaterial({ color: '#7a5c48', side: THREE.BackSide }),   // +x bar
    new THREE.MeshBasicMaterial({ color: '#c77a4a', side: THREE.BackSide }),   // -x finestra
    new THREE.MeshBasicMaterial({ color: '#d9cbb8', side: THREE.BackSide }),   // soffitto
    new THREE.MeshBasicMaterial({ color: '#4a3424', side: THREE.BackSide }),   // pavimento
    new THREE.MeshBasicMaterial({ color: '#6b5a50', side: THREE.BackSide }),   // nord
    new THREE.MeshBasicMaterial({ color: '#40365a', side: THREE.BackSide }),   // sud (LED)
  ]);
  sc.add(room);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.5) }));
  panel.rotation.x = Math.PI / 2; panel.position.y = 19.5; sc.add(panel);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.4, 0.7) }));
  win.rotation.y = Math.PI / 2; win.position.x = -49.5; sc.add(win);
  const rt = pm.fromScene(sc, 0.03);
  pm.dispose();
  return rt.texture;
}

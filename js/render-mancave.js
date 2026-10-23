// Grafica della pista "La Mancave": una stanza vera vista da un kart in miniatura.
// Tappeto con il via, mobile TV, divano col salto dal bracciolo, bancone del bar (pit stop),
// cucina col frigo dove si scivola, tavolo senza bordi (salto) e biliardino.
import * as THREE from 'three';
import { groundHeight } from './track.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function buildMancave(root, track, canvasTex) {
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(11);
  const H = (i) => track.hs[((i % count) + count) % count];
  const P = (i) => pts[((i % count) + count) % count];
  const sIdx = (s) => Math.floor((((s % track.length) + track.length) % track.length) / track.ds) % count;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  track.center = { x: cx, z: cz };
  const M = 150;                                     // margine tra pista e muri della stanza
  const RW = maxX - minX + M * 2, RD = maxZ - minZ + M * 2, RH = 320;

  // ---------------------------------------------------------------- luci e atmosfera
  root.add(new THREE.HemisphereLight('#fff8ee', '#8a7480', 1.9));
  const sun = new THREE.DirectionalLight('#fff3e0', 1.5);
  sun.position.set(cx - 200, 600, cz - 300);
  root.add(sun);
  const fill = new THREE.DirectionalLight('#d8c8ff', 0.6);
  fill.position.set(cx + 300, 200, cz + 400);
  root.add(fill);
  root.userData.fog = new THREE.Fog('#5a4a66', 900, 2200);

  // ---------------------------------------------------------------- texture
  const T = {};
  T.parquet = canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      const v = 150 + R() * 40;
      g.fillStyle = `rgb(${v},${v * 0.66},${v * 0.4})`; g.fillRect(0, i * 32, w, 32);
      g.fillStyle = 'rgba(60,30,10,0.5)'; g.fillRect(0, i * 32, w, 2);
      const off = R() * w; g.fillRect(off, i * 32, 2, 32);
      for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(90,50,20,0.12)'; g.fillRect(R() * w, i * 32 + R() * 32, 30 + R() * 50, 1); }
    }
  }, true);
  T.parquet.repeat.set(RW / 60, RD / 60);
  T.rug = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9c1f2e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8b04a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#1d2a55';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(32 + i * 64, 16 + j * 64); g.lineTo(48 + i * 64, 32 + j * 64); g.lineTo(32 + i * 64, 48 + j * 64); g.lineTo(16 + i * 64, 32 + j * 64); g.fill(); }
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.12})`; g.fillRect(R() * w, R() * h, 1, 2); }
  }, true);
  const road = (base, line, extra) => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (extra) extra(g, w, h);
    g.fillStyle = line; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    g.fillRect(w / 2 - 2, 0, 4, h / 2);
  }, true);
  T.tape = road('#dcd6c4', '#ffffff', (g, w, h) => { for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(120,110,90,${R() * 0.15})`; g.fillRect(R() * w, R() * h, 2, 1); } });
  T.rugRoad = road('#c93445', '#f5d06a', (g, w, h) => { for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.15})`; g.fillRect(R() * w, R() * h, 1, 2); } });
  T.wood = road('#b07a4a', '#fff1c8', (g, w, h) => { for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(40,20,8,0.25)'; g.fillRect(0, R() * h, w, 1); } });
  T.books = road('#a83a2a', '#f0e6c8', (g, w, h) => { g.fillStyle = '#5a1e14'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 3); });
  T.sofa = road('#3d76c9', '#e3eeff', (g, w, h) => { g.fillStyle = 'rgba(10,30,70,0.45)'; g.fillRect(0, 0, w, 4); for (let k = 0; k < 1200; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.06})`; g.fillRect(R() * w, R() * h, 1, 1); } });
  T.marble = road('#55556a', '#f2cf6a', (g, w, h) => { g.strokeStyle = 'rgba(220,220,230,0.25)'; g.lineWidth = 1.5; for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(R() * w, 0); g.bezierCurveTo(R() * w, h / 3, R() * w, h * 0.66, R() * w, h); g.stroke(); } });
  T.tiles = road('#e9ecef', '#2f7bff', (g, w, h) => { g.fillStyle = '#cfd4da'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h); for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 2); });
  T.ice = road('#dff4ff', '#7fd0ff', (g, w, h) => { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; for (let k = 0; k < 10; k++) { g.beginPath(); g.moveTo(R() * w, R() * h); g.lineTo(R() * w, R() * h); g.stroke(); } });
  T.cloth = canvasTex(128, 128, (g, w, h) => { const sq = 32; for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#d62f2f' : '#f7f2ea'; g.fillRect(x * sq, y * sq, sq, sq); } g.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 0; x < 4; x++) g.fillRect(x * sq + 14, 0, 4, h); }, true);
  T.felt = road('#27a548', '#ffffff', (g, w, h) => { for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.1})`; g.fillRect(R() * w, R() * h, 1, 1); } });
  const ZT = { rug: T.rugRoad, books: T.books, tv: T.wood, floor: T.tape, sofa: T.sofa, arm: T.sofa, bar: T.marble, kitchen: T.tiles, fridge: T.ice, chair: T.wood, table: T.cloth, foos: T.felt };
  const lambert = (o) => new THREE.MeshLambertMaterial(o);
  const SKIRT = { books: '#8f3324', tv: '#6b4429', sofa: '#2f64b0', arm: '#2f64b0', bar: '#6e4426', chair: '#8f6240', table: '#f1ebe0' };
  const RAIL = { rug: ['#ffd400', '#e8322b', '#2f7bff', '#2ec46b'], books: ['#e8d9a8'], tv: ['#2a1a10'], floor: ['#ffd400', '#e8322b', '#2f7bff', '#2ec46b'],
    sofa: ['#1b3f78'], arm: ['#1b3f78'], bar: ['#d8b45a'], kitchen: ['#ffffff', '#2f7bff'], fridge: ['#ffffff'], chair: ['#5a3a22'], foos: ['#3b2416'] };

  // ---------------------------------------------------------------- tratti di pista per zona
  const runs = [];
  {
    let start = 0;
    for (let i = 1; i <= count; i++) {
      if (i === count || track.zone[i] !== track.zone[start]) { runs.push([start, i, track.zone[start]]); start = i; }
    }
  }
  function ribbon(i0, i1, latA, latB, yOff, mat, uvW = 1) {
    const v = [], u = [], id = [];
    let s0 = 0;
    for (let i = i0, k = 0; i <= i1; i++, k++) {
      const p = P(i), y = H(i) + yOff;
      v.push(p.x + p.rx * latA, y, p.z + p.rz * latA, p.x + p.rx * latB, y, p.z + p.rz * latB);
      const s = s0 + k * track.ds;
      u.push(0, s / 16, uvW, s / 16);
      if (i < i1) { const a = k * 2; id.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(id); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    root.add(m);
    return m;
  }
  // fianco verticale (il mobile sotto la pista) da altezza pista fino al pavimento
  function skirt(i0, i1, lat, color) {
    const v = [], id = [];
    for (let i = i0, k = 0; i <= i1; i++, k++) {
      const p = P(i), y = H(i);
      v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * lat, 0, p.z + p.rz * lat);
      if (i < i1) { const a = k * 2; id.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(id); g.computeVertexNormals();
    root.add(new THREE.Mesh(g, lambert({ color, side: THREE.DoubleSide })));
  }
  // bordino colorato a blocchi (mattoncini giocattolo o bordo del mobile)
  function rail(i0, i1, colors) {
    const v = [], c = [];
    const hgt = 1.3;
    for (let i = i0; i < i1; i++) {
      const a = P(i), b = P(i + 1), ya = H(i), yb = H(i + 1);
      if (Math.abs(ya - yb) > 2) continue;
      const col = new THREE.Color(colors[Math.floor(i / 3) % colors.length]);
      for (const side of [-1, 1]) {
        const w = wall;
        const q = [[a.x + a.rx * side * w, ya, a.z + a.rz * side * w], [a.x + a.rx * side * w, ya + hgt, a.z + a.rz * side * w],
          [b.x + b.rx * side * w, yb, b.z + b.rz * side * w], [b.x + b.rx * side * w, yb + hgt, b.z + b.rz * side * w]];
        for (const k of [0, 2, 1, 1, 2, 3]) { v.push(...q[k]); c.push(col.r, col.g, col.b); }
        const qt = [[a.x + a.rx * side * w, ya + hgt, a.z + a.rz * side * w], [a.x + a.rx * side * (w + 1), ya + hgt, a.z + a.rz * side * (w + 1)],
          [b.x + b.rx * side * w, yb + hgt, b.z + b.rz * side * w], [b.x + b.rx * side * (w + 1), yb + hgt, b.z + b.rz * side * (w + 1)]];
        for (const k of [0, 2, 1, 1, 2, 3]) { v.push(...qt[k]); c.push(col.r * 0.85, col.g * 0.85, col.b * 0.85); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    root.add(new THREE.Mesh(g, lambert({ vertexColors: true, side: THREE.DoubleSide })));
  }
  const kerbTex = canvasTex(32, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8322b'; g.fillRect(0, 0, w, h / 2); }, true);
  const kerbMat = lambert({ map: kerbTex, side: THREE.DoubleSide });
  for (const [i0, i1, z] of runs) {
    const tex = ZT[z] || T.tape;
    ribbon(i0, i1, -hw, hw, 0.04, lambert({ map: tex, side: THREE.DoubleSide }));
    ribbon(i0, i1, hw, hw + 1.3, 0.05, kerbMat, 0.25); ribbon(i0, i1, -hw - 1.3, -hw, 0.05, kerbMat, 0.25);
    const elevated = SKIRT[z] && pts.slice(i0, i1).some((_, k) => H(i0 + k) > 0.5);
    if (elevated) {
      // piano del mobile ai lati della pista e fianchi fino a terra
      const topMat = lambert({ color: SKIRT[z], side: THREE.DoubleSide });
      const edge = z === 'table' ? hw + 3.5 : wall + 1.5;
      ribbon(i0, i1, hw + 1.2, edge, 0.02, topMat); ribbon(i0, i1, -edge, -hw - 1.2, 0.02, topMat);
      skirt(i0, i1, edge, SKIRT[z]); skirt(i0, i1, -edge, SKIRT[z]);
    }
    if (z !== 'table' && RAIL[z]) rail(i0, i1, RAIL[z]);
  }

  // ---------------------------------------------------------------- utilità per i mobili
  const at = (s, lat = 0, up = 0) => { const p = P(sIdx(s)); return new THREE.Vector3(p.x + p.rx * lat, groundHeight(track, s, 0) + up, p.z + p.rz * lat); };
  const yawAt = (s) => { const p = P(sIdx(s)); return Math.atan2(p.tx, p.tz); };
  // scatola allineata alla pista tra sA e sB (tratti dritti), da latA a latB, da y0 a y1
  function boxAlong(sA, sB, latA, latB, y0, y1, mat) {
    const a = at(sA, (latA + latB) / 2), b = at(sB, (latA + latB) / 2);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(latB - latA), y1 - y0, len), mat);
    m.position.set((a.x + b.x) / 2, (y0 + y1) / 2, (a.z + b.z) / 2);
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    root.add(m);
    return m;
  }
  const zoneRange = (z) => { const r = runs.filter(q => q[2] === z); return r.length ? [pts[r[0][0]].s, pts[Math.min(count - 1, r[r.length - 1][1] - 1)].s] : null; };
  const textPlane = (w, h, draw, basic = false) => {
    const t = canvasTex(Math.round(w * 8), Math.round(h * 8), draw);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }) : lambert({ map: t, side: THREE.DoubleSide }));
  };

  // ---------------------------------------------------------------- stanza
  {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), lambert({ map: T.parquet }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -0.05, cz);
    root.add(floor);
    const wallMat = lambert({ color: '#b3a3c4', side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, RD), wallMat);
    room.position.set(cx, RH / 2 - 0.1, cz);
    root.add(room);
    // battiscopa e strisce LED
    const led = (color, y) => {
      const m = new THREE.MeshBasicMaterial({ color });
      for (const [w, x, z, ry] of [[RW, cx, minZ - M + 1, 0], [RW, cx, maxZ + M - 1, 0], [RD, minX - M + 1, cz, Math.PI / 2], [RD, maxX + M - 1, cz, Math.PI / 2]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 1.6), m);
        b.position.set(x, y, z); b.rotation.y = ry; root.add(b);
      }
    };
    led('#c23cff', 2); led('#3fa9ff', RH - 6);
    // insegna al neon MANCAVE sulla parete di fondo
    const neon = textPlane(220, 60, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = `900 ${h * 0.62}px "Bungee", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff3fd2'; g.shadowBlur = 40; g.lineWidth = 14; g.strokeStyle = '#ff7ae3'; g.strokeText('MANCAVE', w / 2, h / 2);
      g.shadowBlur = 20; g.fillStyle = '#ffe6fb'; g.fillText('MANCAVE', w / 2, h / 2);
    }, true);
    neon.position.set(cx, 200, minZ - M + 3);
    root.add(neon);
    // poster e sciarpe
    const posters = [['MANCAVE KART GP', '#e8322b', '#ffd400'], ['FANTACALCIO', '#1f8f3a', '#ffffff'], ['TORNEI MANCAVE', '#2f6fe0', '#ffffff'], ['GAME NIGHT', '#9b5cff', '#ffd400']];
    posters.forEach(([txt, bg, fg], i) => {
      const pl = textPlane(60, 84, (g, w, h) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = fg; g.fillRect(16, 16, w - 32, 8); g.fillRect(16, h - 24, w - 32, 8);
        g.font = `900 ${w * 0.13}px "Bungee", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const words = txt.split(' ');
        words.forEach((wd, k) => g.fillText(wd, w / 2, h / 2 + (k - (words.length - 1) / 2) * w * 0.17));
      });
      const side = i % 2;
      if (side === 0) { pl.position.set(minX - M + 3, 110, minZ + 60 + i * 120); pl.rotation.y = Math.PI / 2; }
      else { pl.position.set(maxX + M - 3, 110, minZ + 60 + i * 120); pl.rotation.y = -Math.PI / 2; }
      root.add(pl);
    });
    const scarf = textPlane(180, 22, (g, w, h) => {
      const cols = ['#ffd400', '#c8102e'];
      for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % 2]; g.fillRect(i * w / 12, 0, w / 12 + 1, h); }
      g.font = `900 ${h * 0.6}px "Bungee", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1a1a1a'; g.fillText('MANCAVE ULTRAS', w / 2, h / 2 + 2);
    });
    scarf.position.set(cx, 120, maxZ + M - 3); scarf.rotation.y = Math.PI;
    root.add(scarf);
    // lampade sul soffitto
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 20), new THREE.MeshBasicMaterial({ color: '#fff4d6' }));
      l.position.set(minX - M + (i % 3 + 1) * RW / 4, RH - 2, minZ - M + (Math.floor(i / 3) + 1) * RD / 3);
      root.add(l);
    }
  }

  // ---------------------------------------------------------------- tappeto del via, cavi e joypad
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), lambert({ map: T.rug }));
    T.rug.repeat.set(2, 1.2);
    rug.rotation.x = -Math.PI / 2;
    const c = at(20, 0);
    rug.position.set(c.x, 0.01, c.z + 10);
    rug.rotation.z = -yawAt(20) + Math.PI / 2;
    root.add(rug);
    const padMat = lambert({ color: '#2b2d35' });
    for (const [s, lat] of [[50, -26], [110, 28], [-40, 30]]) {
      const pad = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 5), padMat); body.position.y = 0.8; pad.add(body);
      for (const [x, z] of [[-4, 1.5], [4, 1.5]]) { const g = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.6, 12), padMat); g.position.set(x, 0.8, z); pad.add(g); }
      for (const [x, col] of [[2.5, '#e8322b'], [3.6, '#2ec46b'], [3.05, '#2f7bff']]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 8), lambert({ color: col })); b.position.set(x, 1.7, -0.5); pad.add(b); }
      pad.position.copy(at(s, lat)); pad.rotation.y = R() * 6;
      root.add(pad);
      // cavo
      const pts3 = [];
      for (let k = 0; k < 6; k++) pts3.push(at(s - 10 - k * 14, lat + Math.sin(k) * 6, 0.4));
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3), 40, 0.45, 6), lambert({ color: '#111' })));
    }
  }

  // ---------------------------------------------------------------- mobile TV con la televisione accesa
  const tvR = zoneRange('tv');
  if (tvR) {
    const [a, b] = tvR;
    const dark = lambert({ color: '#3b2416' });
    boxAlong(a + 10, b - 40, -wall - 1.5, -wall - 22, 0, 12, dark);
    const mid = (a + b) / 2 - 15;
    const tv = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(150, 84, 4), lambert({ color: '#111' }));
    const screen = textPlane(144, 78, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f8fe0'); gr.addColorStop(1, '#7fd0ff');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#5fbf47'; g.fillRect(0, h * 0.62, w, h);
      g.fillStyle = '#5d6270'; g.beginPath(); g.moveTo(w * 0.35, h); g.lineTo(w * 0.48, h * 0.62); g.lineTo(w * 0.52, h * 0.62); g.lineTo(w * 0.65, h); g.fill();
      g.font = `900 ${h * 0.14}px "Bungee", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = '#1a1a1a'; g.strokeText('MANCAVE KART', w / 2, h * 0.3); g.fillStyle = '#ffd400'; g.fillText('MANCAVE KART', w / 2, h * 0.3);
    }, true);
    screen.position.z = 2.2;
    frame.position.y = 0; tv.add(frame, screen);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 14), lambert({ color: '#222' })); stand.position.set(0, -44, 0); tv.add(stand);
    tv.position.copy(at(mid, -wall - 12, 58));
    tv.rotation.y = yawAt(mid) - Math.PI / 2;   // lo schermo guarda la pista
    root.add(tv);
    // console, telecomandi e coppa
    const console1 = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 7), lambert({ color: '#f2f2f2' })); console1.position.copy(at(a + 40, -wall - 6, 1.2)); console1.rotation.y = yawAt(a + 40); root.add(console1);
    const remoteM = lambert({ color: '#1d1f26' });
    for (const s of [a + 70, b - 70]) { const r = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 8), remoteM); r.position.copy(at(s, wall + 0.5, 0.4)); r.rotation.y = yawAt(s) + 0.3; root.add(r); }
    const gold = lambert({ color: '#f2c230', emissive: '#4a3500' });
    const cup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 2.5, 10), lambert({ color: '#3b2416' })); base.position.y = 1.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 8), gold); stem.position.y = 4.5;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.2, 5, 14), gold); bowl.position.y = 8.8;
    cup.add(base, stem, bowl); cup.position.copy(at(b - 25, -wall - 8)); root.add(cup);
  }

  // ---------------------------------------------------------------- rampa di libri: pile di libri ai lati
  const bkR = zoneRange('books');
  if (bkR) {
    const cols = ['#c0392b', '#2f6fe0', '#2ec46b', '#f2c230', '#8e44ad', '#e67e22'];
    for (let k = 0; k < 6; k++) {
      const s = bkR[0] + (k / 6) * (bkR[1] - bkR[0]);
      const h = groundHeight(track, s, 0);
      for (const side of [-1, 1]) {
        let y = 0;
        while (y < h) {
          const t = 2 + R() * 1.5;
          const b = new THREE.Mesh(new THREE.BoxGeometry(6, t, 9), lambert({ color: cols[Math.floor(R() * cols.length)] }));
          b.position.copy(at(s, side * (wall + 4.5))); b.position.y = y + t / 2; b.rotation.y = yawAt(s) + (R() - 0.5) * 0.3;
          root.add(b); y += t;
        }
      }
    }
  }

  // ---------------------------------------------------------------- divano: schienale, braccioli, cuscini
  const sfR = zoneRange('sofa'), arR = zoneRange('arm');
  if (sfR && arR) {
    const blue = lambert({ color: '#2f5fa8' }), blue2 = lambert({ color: '#3a6fbf' });
    boxAlong(sfR[0] + 25, arR[1] + 5, -wall - 1.5, -wall - 14, 0, 34, blue);       // schienale
    boxAlong(sfR[0] + 25, arR[1] + 5, wall + 1.5, wall + 4, 0, 9, blue);            // davanti del divano
    for (let k = 0; k < 3; k++) {
      const s0 = sfR[0] + 30 + k * 50;
      const c = new THREE.Mesh(new THREE.BoxGeometry(14, 18, 40), blue2);
      c.position.copy(at(s0 + 20, -wall - 8, 40)); c.rotation.y = yawAt(s0 + 20); c.rotation.z = 0.2;
      root.add(c);
    }
    // plaid giallo sul bracciolo
    const plaid = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 18), lambert({ color: '#f2c230' }));
    plaid.position.copy(at(arR[0] + 10, wall + 8, 0.3)); plaid.rotation.y = yawAt(arR[0]); root.add(plaid);
  }

  // ---------------------------------------------------------------- bancone del bar: bottiglie e spina della birra
  const brR = zoneRange('bar');
  if (brR) {
    const [a, b] = brR;
    const wood = lambert({ color: '#4a2c18' });
    boxAlong(a + 70, b - 75, -wall - 1.5, -wall - 10, 0, 40, wood);                 // mensola dietro
    const glassCols = ['#2e7d32', '#6d4c41', '#1565c0', '#c62828', '#f9a825'];
    for (let s = a + 75; s < b - 80; s += 9) {
      const col = glassCols[Math.floor(R() * glassCols.length)];
      const mat = lambert({ color: col, emissive: col, emissiveIntensity: 0.25 });
      const bt = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 10), mat); body.position.y = 3.5;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 3, 8), mat); neck.position.y = 8.5;
      bt.add(body, neck); bt.position.copy(at(s, -wall - 5)); bt.position.y = 40;
      root.add(bt);
    }
    // spina della birra sul bancone
    const tap = new THREE.Group();
    const chrome = lambert({ color: '#cfd6e0', emissive: '#222' });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 12, 12), chrome); col.position.y = 6;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 8), chrome); spout.rotation.z = Math.PI / 2; spout.position.set(2, 10, 0);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 7, 8), lambert({ color: '#111' })); handle.position.set(0, 15, 0);
    tap.add(col, spout, handle);
    const mid = (a + b) / 2 + 20;
    tap.position.copy(at(mid, wall - 0.5)); tap.rotation.y = yawAt(mid);
    root.add(tap);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.6, 6, 12), lambert({ color: '#f9c74f', emissive: '#7a4f00', emissiveIntensity: 0.3 }));
    glass.position.copy(at(mid + 12, wall - 1, 3)); root.add(glass);
  }

  // ---------------------------------------------------------------- frigo aperto (si scivola) e lavandino
  const frR = zoneRange('fridge');
  if (frR) {
    const [a, b] = frR;
    const white = lambert({ color: '#f4f6f8' }), inside = new THREE.MeshBasicMaterial({ color: '#cfefff' });
    boxAlong(a + 4, b - 4, wall + 0.5, wall + 4, 0, 36, white);
    boxAlong(a + 4, b - 4, -wall - 0.5, -wall - 4, 0, 36, white);
    boxAlong(a + 4, b - 4, -wall - 4, wall + 4, 36, 40, white);
    boxAlong(a + 4, b - 4, wall + 0.4, wall + 0.6, 1, 35, inside);
    boxAlong(a + 4, b - 4, -wall - 0.4, -wall - 0.6, 1, 35, inside);
    // porta aperta
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 40, 34), white);
    const d0 = at(a + 4, wall + 18, 20); door.position.copy(d0); door.rotation.y = yawAt(a) + 0.9; root.add(door);
    // verdure e lattine sui lati
    const cols = ['#e53935', '#43a047', '#fb8c00', '#fdd835', '#8e24aa'];
    for (let s = a + 10; s < b - 8; s += 8) for (const side of [-1, 1]) {
      const it = new THREE.Mesh(R() < 0.5 ? new THREE.SphereGeometry(1.6, 10, 8) : new THREE.CylinderGeometry(1.1, 1.1, 3.4, 10), lambert({ color: cols[Math.floor(R() * cols.length)] }));
      it.position.copy(at(s, side * (wall - 1.5), 1.6)); root.add(it);
    }
  }
  if (track.marks.sink) {
    const s = track.marks.sink;
    const counter = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(70, 30, 26), lambert({ color: '#e9ecef' })); body.position.y = 15;
    const top = new THREE.Mesh(new THREE.BoxGeometry(72, 2, 28), lambert({ color: '#5d6270' })); top.position.y = 31;
    const sink = new THREE.Mesh(new THREE.BoxGeometry(26, 1, 16), lambert({ color: '#9aa4b2' })); sink.position.y = 32.1;
    const tapM = lambert({ color: '#cfd6e0' });
    const tap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10, 8), tapM); tap1.position.set(0, 37, -9);
    const tap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 8, 8), tapM); tap2.rotation.x = Math.PI / 2; tap2.position.set(0, 42, -5);
    counter.add(body, top, sink, tap1, tap2);
    counter.position.copy(at(s, -wall - 20, 0)); counter.position.y = 0; counter.rotation.y = yawAt(s);
    root.add(counter);
  }

  // ---------------------------------------------------------------- tavolo: tovaglia a quadri, pizza e carte
  const tbR = zoneRange('table');
  if (tbR) {
    const [a, b] = tbR;
    const legM = lambert({ color: '#5a3a22' });
    for (const s of [a + 15, b - 15]) for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12, 2.4), legM);
      leg.position.copy(at(s, side * (hw + 2))); leg.position.y = 6; root.add(leg);
    }
    const pizzaTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#d9a35b'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, 7); g.fill();
      g.fillStyle = '#d6452e'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, 7); g.fill();
      g.fillStyle = '#f7e7b0'; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(w / 2 + (R() - 0.5) * w * 0.6, h / 2 + (R() - 0.5) * h * 0.6, 6, 0, 7); g.fill(); }
      g.fillStyle = '#8b1e1e'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(w / 2 + (R() - 0.5) * w * 0.55, h / 2 + (R() - 0.5) * h * 0.55, 5, 0, 7); g.fill(); }
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 16), lambert({ color: '#c49a6c' }));
    box.position.copy(at((a + b) / 2, -hw - 10, -11.4)); box.position.y = 0.6; root.add(box);
    const pizza = new THREE.Mesh(new THREE.CircleGeometry(7, 24), lambert({ map: pizzaTex }));
    pizza.rotation.x = -Math.PI / 2; pizza.position.copy(box.position); pizza.position.y = 1.3; root.add(pizza);
    const cardTex = canvasTex(64, 88, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = R() < 0.5 ? '#c62828' : '#111'; g.font = '900 40px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['♥', '♠', '♦', '♣'][Math.floor(R() * 4)], w / 2, h / 2); });
    for (let k = 0; k < 7; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), lambert({ map: cardTex, side: THREE.DoubleSide }));
      c.rotation.x = -Math.PI / 2; c.rotation.z = R() * 6;
      c.position.copy(at(a + 15 + R() * (b - a - 30), (R() < 0.5 ? -1 : 1) * (hw + 1.5 + R() * 1.5), 0.05)); root.add(c);
    }
  }

  // ---------------------------------------------------------------- biliardino: aste con gli omini sopra la pista
  const fsR = zoneRange('foos');
  if (fsR) {
    const [a, b] = fsR;
    const frameM = lambert({ color: '#3b2416' });
    boxAlong(a + 4, b - 4, wall + 1, wall + 4, 0, 7, frameM);
    boxAlong(a + 4, b - 4, -wall - 1, -wall - 4, 0, 7, frameM);
    const rodM = lambert({ color: '#cfd6e0' });
    const teams = [lambert({ color: '#e8322b' }), lambert({ color: '#2f7bff' })];
    let k = 0;
    for (let s = a + 12; s < b - 8; s += 16, k++) {
      const c = at(s, 0, 8.5), yaw = yawAt(s);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, wall * 2 + 14, 8), rodM);
      rod.rotation.z = Math.PI / 2; rod.position.copy(c); rod.rotation.y = yaw; root.add(rod);
      for (const lat of [-7, 0, 7]) {
        const man = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.6, 1.2), teams[k % 2]); body.position.y = -1.4;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), lambert({ color: '#ffd2a6' })); head.position.y = 1;
        man.add(body, head);
        man.position.copy(at(s, lat, 8.5)); man.rotation.y = yaw; root.add(man);
      }
      for (const side of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 10), lambert({ color: '#111' }));
        h.rotation.z = Math.PI / 2; h.position.copy(at(s, side * (wall + 8), 8.5)); h.rotation.y = yaw; root.add(h);
      }
    }
    // bersaglio delle freccette sulla parete
    const darts = textPlane(40, 40, (g, w, h) => {
      const cols = ['#111', '#f4e3b5'];
      for (let r = 5; r > 0; r--) { g.fillStyle = r % 2 ? '#c62828' : '#1f8f3a'; g.beginPath(); g.arc(w / 2, h / 2, (w / 2) * r / 5, 0, 7); g.fill(); }
      for (let i = 0; i < 20; i++) { g.fillStyle = cols[i % 2]; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, w * 0.38, i / 20 * 6.283, (i + 1) / 20 * 6.283); g.fill(); }
      g.fillStyle = '#c62828'; g.beginPath(); g.arc(w / 2, h / 2, 4, 0, 7); g.fill();
    });
    darts.position.set(minX - M + 3, 90, at((a + b) / 2).z); darts.rotation.y = Math.PI / 2;
    root.add(darts);
  }

  // ---------------------------------------------------------------- aspirapolvere robot e gatto (si muovono, vedi obstaclesAt)
  {
    const vac = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 1, 24), lambert({ color: '#2b2d35' })); body.position.y = 0.6;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 20), lambert({ color: '#444' })); top.position.y = 1.2;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: '#3fa9ff' })); led.position.set(0, 1.4, 1.6);
    vac.add(body, top, led);
    const cat = new THREE.Group();
    const fur = lambert({ color: '#e67e22' });
    const cb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 3.6), fur); cb.position.y = 1.6;
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.4), fur); ch.position.set(0, 2.6, 2.2);
    for (const x of [-0.45, 0.45]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), fur); e.position.set(x, 3.6, 2.2); cat.add(e); }
    for (const [x, z] of [[-0.5, 1.2], [0.5, 1.2], [-0.5, -1.2], [0.5, -1.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), fur); l.position.set(x, 0.5, z); cat.add(l); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.6, 6), fur); tail.position.set(0, 2.6, -2.2); tail.rotation.x = -0.6;
    cat.add(cb, ch, tail);
    root.add(vac, cat);
    track.obstacleMeshes = { vacuum: vac, cat };
  }
}

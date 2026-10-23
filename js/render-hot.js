// Grafica della "Pista Hot Wheels": la pista arancione di plastica, sospesa sui piloni, in una cameretta
// di bambini (kart giocattolo, mobili giganti). Giro della morte vero, curve sopraelevate, trampolino
// con il buco, spinte turbo con le ruote che girano.
import * as THREE from 'three';
import { rng, canvas, toTex, grain, loadK } from './render-mancave.js';
import { addNeon } from './render.js';
import { loopPose } from './track.js';

const RX = 220, RZ = 190, RH = 230;

function carpetTex(R) {
  // tappeto "città" visto dall'alto: prato, strade, case
  const c = canvas(1024, 1024), g = c.getContext('2d');
  g.fillStyle = '#7cc46a'; g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = '#5b5f68';
  for (const x of [180, 520, 860]) g.fillRect(x, 0, 90, 1024);
  for (const y of [150, 560, 900]) g.fillRect(0, y, 1024, 90);
  g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.setLineDash([30, 30]);
  for (const x of [225, 565, 905]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  for (const y of [195, 605, 945]) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  g.setLineDash([]);
  const cols = ['#e8322b', '#2f7bff', '#ffcc00', '#ff8a00', '#9b5cff', '#ffffff'];
  for (let k = 0; k < 40; k++) {
    const x = R() * 1024, y = R() * 1024;
    if ([180, 520, 860].some(a => x > a - 50 && x < a + 140) || [150, 560, 900].some(a => y > a - 50 && y < a + 140)) continue;
    g.fillStyle = cols[k % cols.length]; g.fillRect(x, y, 50, 40);
    g.fillStyle = '#7a3b12'; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 25, y - 22); g.lineTo(x + 55, y); g.fill();
  }
  for (let k = 0; k < 60; k++) { g.fillStyle = '#2f8a3a'; g.beginPath(); g.arc(R() * 1024, R() * 1024, 10 + R() * 10, 0, 7); g.fill(); }
  grain(g, 1024, 1024, 14, R);
  return toTex(c, { repeat: [1, 1] });
}
function wallTex(R) {
  const c = canvas(512, 512), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#7fc8ff'); gr.addColorStop(1, '#b9e2ff');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  // nuvolette e stelline
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 6; k++) { const x = R() * 512, y = R() * 300; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x + j * 22, y + (j % 2) * 8, 22, 0, 7); g.fill(); } }
  g.fillStyle = '#ffe066';
  for (let k = 0; k < 14; k++) { const x = R() * 512, y = R() * 512; g.beginPath(); for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2, r = j % 2 ? 5 : 12; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
  return toTex(c, { repeat: [3, 1] });
}
function orangeTex(R) {
  // plastica arancione lucida con la riga scura in mezzo e i bordini
  const c = canvas(128, 256), g = c.getContext('2d');
  g.fillStyle = '#ff6a00'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(10, 0, 18, 256);
  g.fillStyle = 'rgba(120,40,0,0.25)'; g.fillRect(60, 0, 8, 256);
  g.fillStyle = 'rgba(120,40,0,0.35)'; g.fillRect(0, 0, 6, 256); g.fillRect(122, 0, 6, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 3);
  grain(g, 128, 256, 6, R);
  return toTex(c, { repeat: [1, 1] });
}
function chevronTex() {
  const c = canvas(128, 256), g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  g.fillStyle = '#ffe600';
  for (let y = 10; y < 256; y += 64) { g.beginPath(); g.moveTo(14, y + 40); g.lineTo(64, y); g.lineTo(114, y + 40); g.lineTo(114, y + 58); g.lineTo(64, y + 20); g.lineTo(14, y + 58); g.fill(); }
  return toTex(c, { repeat: [1, 1] });
}
function blockTex(letter, col) {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 10; g.strokeRect(8, 8, 112, 112);
  g.fillStyle = '#ffffff'; g.font = '900 86px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 64, 70);
  return toTex(c);
}

export function buildHot(root, track, opts = {}) {
  const night = !!opts.night;
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(91);
  const P = (i) => pts[((i % count) + count) % count];
  const H = (i) => track.hs[((i % count) + count) % count];
  const Z = (i) => track.zone[((i % count) + count) % count];
  const B = (i) => track.bank ? track.bank[((i % count) + count) % count] : 0;
  const STEP = (i) => track.step[((i % count) + count) % count];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, mat, x, y, z, ry = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = root) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);
  const cyl = (rt, rb, h, mat, x, y, z, seg = 20, parent = root) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, 0, parent);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const orange = new THREE.MeshPhysicalMaterial({ map: orangeTex(R), color: '#ff8a3a', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const orangeLip = new THREE.MeshPhysicalMaterial({ color: '#f25500', roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide });
  const blue = new THREE.MeshPhysicalMaterial({ color: '#1f5fff', roughness: 0.3, clearcoat: 0.7 });
  const pole = std({ color: '#c9d2dc', roughness: 0.3, metalness: 0.6 });
  const dark = std({ color: '#22252b', roughness: 0.5 });
  function distTrack(x, z) { let bd = Infinity; for (let i = 0; i < count; i += 2) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); }
  const free = (x, z, r) => distTrack(x, z) > wall + r;

  // ---------------------------------------------------------------- cameretta
  {
    const t = carpetTex(R); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), std({ map: t, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.userData.noCast = true; root.add(floor);
    const wt = wallTex(R);
    for (const [w, x, z, ry] of [[RX * 2, 0, RZ, Math.PI], [RX * 2, 0, -RZ, 0], [RZ * 2, RX, 0, -Math.PI / 2], [RZ * 2, -RX, 0, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), std({ map: wt, roughness: 0.9, color: night ? '#5a6ab0' : '#ffffff' })); m.position.set(x, RH / 2, z); m.rotation.y = ry; m.userData.noCast = true; root.add(m);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), std({ color: '#f6f8ff', roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; root.add(ceil);
    // battiscopa
    for (const [w, x, z, ry] of [[RX * 2, 0, RZ - 0.6, 0], [RX * 2, 0, -RZ + 0.6, 0], [RZ * 2, RX - 0.6, 0, Math.PI / 2], [RZ * 2, -RX + 0.6, 0, Math.PI / 2]]) box(w, 6, 1.2, std({ color: '#ffffff' }), x, 3, z, ry);
    // finestra con il cielo
    const win = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshBasicMaterial({ color: night ? '#1b2456' : '#9fdcff' }));
    win.position.set(-RX + 0.8, 120, -20); win.rotation.y = Math.PI / 2; win.userData.noShadow = true; root.add(win);
    for (const [w, h, y, z] of [[124, 4, 160, -20], [124, 4, 80, -20], [4, 84, 120, -82], [4, 84, 120, 42], [4, 84, 120, -20]]) box(2, h, w === 4 ? 4 : w, std({ color: '#ffffff' }), -RX + 1.5, y, z, 0);
    if (night) { const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), glow('#fff8d0')); moon.position.set(-RX + 1, 140, 10); moon.rotation.y = Math.PI / 2; root.add(moon); }
    // poster a scacchi e bandiera
    const flagC = canvas(256, 160), fg = flagC.getContext('2d');
    for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { fg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; fg.fillRect(x * 32, y * 32, 32, 32); }
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(70, 44), std({ map: toTex(flagC) })); poster.position.set(40, 140, RZ - 0.8); poster.rotation.y = Math.PI; root.add(poster);
  }

  // ---------------------------------------------------------------- mobili giganti e giocattoli (fuori dalla pista)
  const pending = [];
  function K(name, o) {
    const pr = loadK(name).then((m) => {
      if (!m) return null;
      const size = m.box.getSize(new THREE.Vector3()), ctr = m.box.getCenter(new THREE.Vector3());
      const u = o.h / size.y;
      const inner = m.scene.clone(true);
      inner.position.set(-ctr.x, -m.box.min.y, -ctr.z);
      const pivot = new THREE.Group(); pivot.scale.setScalar(u); pivot.add(inner);
      const outer = new THREE.Group(); outer.position.set(o.x, o.y || 0, o.z); outer.rotation.y = o.ry || 0; outer.add(pivot);
      root.add(outer);
      return outer;
    });
    pending.push(pr);
  }
  K('lampRoundFloor', { x: -185, z: RZ - 30, h: 170 });
  K('cardboardBoxOpen', { x: 195, z: 150, h: 40, ry: 0.3 });
  K('pottedPlant', { x: 195, z: -165, h: 80 });
  K('speaker', { x: -195, z: -165, h: 70, ry: Math.PI / 4 });
  // letto contro il muro nord-ovest
  {
    const bed = new THREE.Group(); bed.position.set(RX - 58, 0, RZ - 45); root.add(bed);
    box(120, 22, 80, std({ color: '#8a5a33', roughness: 0.6 }), 0, 11, 0, 0, bed);
    box(116, 10, 76, std({ color: '#ffffff', roughness: 0.9 }), 0, 27, 0, 0, bed);
    const blanketC = canvas(256, 256), bg = blanketC.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { bg.fillStyle = (x + y) % 2 ? '#2f7bff' : '#e8322b'; bg.fillRect(x * 32, y * 32, 32, 32); }
    box(118, 4, 56, std({ map: toTex(blanketC), roughness: 1 }), 0, 33, -10, 0, bed);
    box(40, 8, 22, std({ color: '#fff7e0', roughness: 1 }), -30, 35, 26, 0, bed);
    box(122, 50, 6, std({ color: '#8a5a33' }), 0, 25, 40, 0, bed);
  }
  // cubi dei giocattoli con le lettere, palla, macchinine sparse
  const BL = [['M', '#e8322b'], ['K', '#2f7bff'], ['A', '#ffcc00'], ['R', '#2ec46b'], ['T', '#9b5cff'], ['!', '#ff8a00']];
  let bn = 0;
  for (const [x, z, s] of [[-60, -40, 16], [-75, -30, 12], [90, -60, 18], [60, 30, 14], [-180, -40, 20], [195, 60, 16], [120, 130, 15], [-30, 150, 14], [0, -120, 12], [-140, 140, 16]]) {
    if (!free(x, z, s * 0.8)) continue;
    const [l, c] = BL[bn++ % BL.length];
    const m = box(s, s, s, std({ map: blockTex(l, c), roughness: 0.5 }), x, s / 2, z, R() * 1.5);
  }
  for (const [x, z, r, c] of [[100, 10, 10, '#ff3b30'], [-100, 40, 8, '#2f7bff']]) {
    if (!free(x, z, r)) continue;
    add(new THREE.SphereGeometry(r, 24, 18), std({ color: c, roughness: 0.3 }), x, r, z);
  }

  // ---------------------------------------------------------------- pista arancione
  const runs = [];
  { let s = 0; for (let i = 1; i <= count; i++) if (i === count || STEP(i)) { runs.push([s, i]); s = i; } }
  if (runs.length > 1 && !STEP(0)) { const last = runs.pop(); runs[0] = [last[0], runs[0][1] + count]; }
  const Hr = (i, i1) => (i === i1 && STEP(i)) ? H(i - 1) : H(i);
  const isRoad = (i) => Z(i) !== 'loop' && Z(i) !== 'gap';
  // nastro: da latA a latB, con la sopraelevazione (bank) e uno spostamento in alto
  function ribbon(i0, i1, latA, latB, yA, yB, mat, vScale, filter, flipNormals = false) {
    const v = [], uv = [], id = [];
    let k = 0;
    for (let i = i0; i <= i1; i++) {
      if (filter && !filter(i)) { k = -1; continue; }
      const p = P(i), h = Hr(i, i1), b = B(i);
      v.push(p.x + p.rx * latA, h + latA * b + yA, p.z + p.rz * latA, p.x + p.rx * latB, h + latB * b + yB, p.z + p.rz * latB);
      const s = i * track.ds; uv.push(0, s / vScale, 1, s / vScale);
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
  const chev = std({ map: chevronTex(), transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, emissive: '#ffb000', emissiveIntensity: 0.5 });
  for (const [a, b] of runs) {
    ribbon(a, b, -wall + 0.4, wall - 0.4, 0.06, 0.06, orange, wall * 3, isRoad);
    // spessore sotto la pista
    ribbon(a, b, -wall + 0.4, wall - 0.4, -1.4, -1.4, orangeLip, 40, isRoad);
    // bordini laterali
    for (const sgn of [-1, 1]) {
      const l = sgn * (wall - 0.4);
      ribbon(a, b, l, l, -1.4, 2.4, orangeLip, 20, isRoad);
    }
    // frecce gialle sulle spinte turbo
    ribbon(a, b, -hw + 1, hw - 1, 0.12, 0.12, chev, 16, (i) => Z(i) === 'boost');
  }
  // giunti blu tra un pezzo e l'altro, piloni sotto la pista
  {
    const clip = new THREE.BoxGeometry(2.2, 3.2, 3);
    const list = [];
    for (let i = 0; i < count; i += Math.round(34 / track.ds)) if (isRoad(i)) for (const sgn of [-1, 1]) list.push([i, sgn]);
    const inst = new THREE.InstancedMesh(clip, blue, list.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([i, sgn], n) => {
      const p = P(i), l = sgn * (wall - 0.4);
      e.set(0, Math.atan2(p.tx, p.tz), 0); q.setFromEuler(e);
      mm.compose(new THREE.Vector3(p.x + p.rx * l, H(i) + l * B(i) + 0.6, p.z + p.rz * l), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(n, mm);
    });
    root.add(inst);
    // piloni: ogni 30 unità, dal pavimento a sotto la pista, con il morsetto blu
    for (let i = 0; i < count; i += Math.round(30 / track.ds)) {
      if (!isRoad(i) || H(i) < 3) continue;
      const p = P(i), h = H(i) - 1.4;
      cyl(1.1, 1.4, h, pole, p.x, h / 2, p.z, 12);
      cyl(4, 4.5, 0.8, pole, p.x, 0.4, p.z, 20);
      box(6, 1.6, 4, blue, p.x, h - 0.4, p.z, Math.atan2(p.tx, p.tz));
    }
  }
  // ---------------------------------------------------------------- giro della morte
  for (const L of track.loops || []) {
    const N = 120;
    const road = [], lipL = [], lipR = [];
    const rx = P(L.i0).rx, rz = P(L.i0).rz;
    const v = [], idx = [], lv = [[], []];
    for (let n = 0; n <= N; n++) {
      const s = L.s0 + (L.s1 - L.s0) * n / N;
      const i = Math.floor(s / track.ds) % count, p = P(i);
      const f = (s - p.s) || 0;
      const cx = p.x + p.tx * f, cz = p.z + p.tz * f;
      const lp = loopPose(track, s, cx, H(i), cz);
      // asse "su" della strada nel giro (ruota con la pendenza)
      const up = new THREE.Vector3(-L.fx * Math.sin(lp.pitch), Math.cos(lp.pitch), -L.fz * Math.sin(lp.pitch));
      for (const sgn of [-1, 1]) {
        const lat = sgn * (wall - 0.4);
        v.push(lp.x + rx * lat + up.x * 0.06, lp.y + up.y * 0.06, lp.z + rz * lat + up.z * 0.06);
      }
      for (const [k, sgn] of [[0, -1], [1, 1]]) {
        const lat = sgn * (wall - 0.4);
        lv[k].push(lp.x + rx * lat - up.x * 1.4, lp.y - up.y * 1.4, lp.z + rz * lat - up.z * 1.4, lp.x + rx * lat + up.x * 2.4, lp.y + up.y * 2.4, lp.z + rz * lat + up.z * 2.4);
      }
      if (n > 0) { const b = n * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
    const uv = []; for (let n = 0; n <= N; n++) uv.push(0, n / 6, 1, n / 6);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    root.add(new THREE.Mesh(g, orange));
    for (const arr of lv) {
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g2.setIndex(idx.slice()); g2.computeVertexNormals();
      root.add(new THREE.Mesh(g2, orangeLip));
    }
    // due piloni sotto il giro e la scritta
    const a = P(L.i0), y0 = H(L.i0);
    const mid = { x: a.x + L.fx * (L.s1 - L.s0) * 0.5, z: a.z + L.fz * (L.s1 - L.s0) * 0.5 };
    for (const sgn of [-1, 1]) { const x = mid.x + rx * sgn * (wall + 3), z = mid.z + rz * sgn * (wall + 3); cyl(1.5, 2, y0 + L.R * 2, pole, x, (y0 + L.R * 2) / 2, z, 12); }
  }
  // ---------------------------------------------------------------- spinte turbo: arco con due ruote che girano
  const spinners = [];
  {
    let i0 = -1;
    for (let i = 0; i < count; i++) if (Z(i) === 'boost' && Z(i - 1) !== 'boost') {
      const p = P(i + 4), h = H(i + 4), yaw = Math.atan2(p.tx, p.tz);
      const g = new THREE.Group(); g.position.set(p.x, h, p.z); g.rotation.y = yaw; root.add(g);
      const red = new THREE.MeshPhysicalMaterial({ color: '#e8322b', roughness: 0.3, clearcoat: 0.8 });
      for (const sgn of [-1, 1]) {
        box(3, 12, 8, red, sgn * (wall + 1.5), 6, 0, 0, g);
        const w = new THREE.Group(); w.position.set(sgn * (wall - 3.2), 3.4, 0); g.add(w);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 2.6, 24), dark); tire.rotation.z = Math.PI / 2; w.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.8, 12), std({ color: '#ffcc00', metalness: 0.6, roughness: 0.3 })); hub.rotation.z = Math.PI / 2; w.add(hub);
        spinners.push(w);
      }
      box(wall * 2 + 6, 3, 8, red, 0, 13, 0, 0, g);
      const sC = canvas(512, 96), sg = sC.getContext('2d'); sg.fillStyle = '#111'; sg.fillRect(0, 0, 512, 96); sg.fillStyle = '#ffe600'; sg.font = '900 64px "Arial Black", sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('TURBO ▶▶', 256, 50);
      const sm = new THREE.MeshBasicMaterial({ map: toTex(sC), toneMapped: false });
      for (const sgn of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(wall * 2, 3.6), sm); pl.position.set(0, 13, sgn * 4.05); pl.rotation.y = sgn > 0 ? 0 : Math.PI; g.add(pl); }
    }
  }
  // ---------------------------------------------------------------- trampolino: bandierine sul bordo del buco
  for (let i = 0; i < count; i++) if (Z(i) === 'gap' && Z(i - 1) !== 'gap') {
    const p = P(i - 1), h = H(i - 1);
    for (const sgn of [-1, 1]) {
      const x = p.x + p.rx * sgn * wall, z = p.z + p.rz * sgn * wall;
      cyl(0.3, 0.3, 10, pole, x, h + 5, z, 6);
      const fC = canvas(64, 64), g = fC.getContext('2d'); for (let y = 0; y < 4; y++) for (let xx = 0; xx < 4; xx++) { g.fillStyle = (xx + y) % 2 ? '#111' : '#fff'; g.fillRect(xx * 16, y * 16, 16, 16); }
      const f = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.5), std({ map: toTex(fC), side: THREE.DoubleSide })); f.position.set(x + p.tx * 2.5, h + 8.5, z + p.tz * 2.5); f.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI / 2; root.add(f);
    }
  }

  track.animate = (t, tsec) => { for (const w of spinners) w.rotation.x = -tsec * 20; };

  // ---------------------------------------------------------------- luci
  if (!night) {
    root.add(new THREE.HemisphereLight('#ffffff', '#8fbf7a', 0.95));
    const sun = new THREE.DirectionalLight('#fff3dc', 2.5);
    sun.position.set(-320, 380, 60); sun.target.position.set(0, 0, 0); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -270; sc.right = 270; sc.top = 250; sc.bottom = -250; sc.near = 150; sc.far = 1000;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 4;
    root.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#dfeaff', 0.7); fill.position.set(300, 200, -200); root.add(fill);
  } else {
    root.add(new THREE.HemisphereLight('#5a62d0', '#1b1430', 0.6));
    const moon = new THREE.DirectionalLight('#9fb4ff', 1.0); moon.position.set(-320, 340, 40); moon.target.position.set(0, 0, 0); moon.castShadow = true;
    const sc = moon.shadow.camera; sc.left = -270; sc.right = 270; sc.top = 250; sc.bottom = -250; sc.near = 150; sc.far = 1000;
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35;
    root.add(moon, moon.target);
    // lampada accesa e lucine sulla pista
    for (const [x, y, z, c, i] of [[-185, 160, RZ - 30, '#ffcf8a', 2.6], [150, 120, RZ - 40, '#ff8ad8', 1.8], [0, 80, 0, '#5fd0ff', 1.6], [150, 60, -100, '#ffb000', 1.6]]) { const l = new THREE.PointLight(c, i, 380, 1); l.position.set(x, y, z); root.add(l); }
    addNeon(root, track, 0.12);
  }
  function finalize() {
    root.traverse((o) => { if (!o.isMesh || o.userData.noShadow) return; o.receiveShadow = true; o.castShadow = !o.userData.noCast && !(o.material && o.material.transparent); });
    const seen = new Set();
    root.traverse((o) => { const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of mats) { if (seen.has(m) || !m.isMeshStandardMaterial) continue; seen.add(m); m.envMapIntensity = m.metalness > 0.5 ? 1 : m.transparent ? 0.9 : 0.45; } });
  }
  finalize();
  track.ready = Promise.all(pending).then(() => { finalize(); if (root.userData.refresh) root.userData.refresh(); });

  root.userData.fog = new THREE.Fog(night ? '#141a3a' : '#cfeaff', 700, 1600);
  root.userData.background = new THREE.Color(night ? '#141a3a' : '#cfeaff');
  root.userData.toneMapping = THREE.ACESFilmicToneMapping;
  root.userData.exposure = night ? 1.2 : 1.0;
  root.userData.night = night;
  root.userData.makeEnv = (renderer, n) => {
    const pm = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    const cols = ['#9fd3ff', '#9fd3ff', '#ffffff', '#7cc46a', '#9fd3ff', '#9fd3ff'];
    const room = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 100), cols.map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })));
    if (n) room.material.forEach((m) => m.color.multiplyScalar(0.18));
    sc.add(room);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: n ? new THREE.Color(0.5, 0.5, 1.2) : new THREE.Color(3, 2.9, 2.7) }));
    panel.rotation.x = Math.PI / 2; panel.position.y = 19.5; sc.add(panel);
    const rt = pm.fromScene(sc, 0.03); pm.dispose(); return rt.texture;
  };
}

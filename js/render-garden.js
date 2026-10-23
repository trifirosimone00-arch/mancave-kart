// Grafica della pista "Giardino": kart giocattolo nel prato di casa. Fiori giganti (i gambi sono in mezzo
// alla pista), stagno con il ponte di legno e il salto, fango, irrigatore che spruzza, lumaca, nano da giardino.
// All'aperto: cielo, sole (o luna e lucciole di notte), staccionata e il muro di casa col patio.
import * as THREE from 'three';
import { rng, canvas, toTex, grain, roadTex } from './render-mancave.js';
import { addNeon } from './render.js';
import { obstaclesAt } from './track.js';

const RX = 200, RZ = 175;

function grassTex(R) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#4fa63a'; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 9000; k++) {
    const x = R() * 512, y = R() * 512, l = 4 + R() * 10;
    g.strokeStyle = `hsl(${95 + R() * 30}, ${45 + R() * 25}%, ${26 + R() * 22}%)`; g.lineWidth = 1 + R();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 4, y - l); g.stroke();
  }
  return toTex(c, { repeat: [1, 1] });
}
function stoneTex(R) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#9a9184'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 ? -64 : 0; x < 512; x += 128) {
    const v = 150 + R() * 50; g.fillStyle = `rgb(${v},${v - 8},${v - 18})`; g.fillRect(x + 3, y + 3, 122, 58);
  }
  grain(g, 512, 512, 20, R);
  return toTex(c, { repeat: [1, 1] });
}
function plankTex(R) {
  const c = canvas(256, 256), g = c.getContext('2d');
  for (let y = 0; y < 256; y += 32) {
    const v = R() * 30; g.fillStyle = `rgb(${150 + v},${100 + v},${55 + v * 0.5})`; g.fillRect(0, y, 256, 30);
    g.fillStyle = 'rgba(60,35,15,0.6)'; g.fillRect(0, y + 30, 256, 2);
    g.fillStyle = 'rgba(60,35,15,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(R() * 256, y + 4 + R() * 22, 30 + R() * 50, 1.5);
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(20, y + 15, 2.5, 0, 7); g.arc(236, y + 15, 2.5, 0, 7); g.fill();
  }
  grain(g, 256, 256, 14, R);
  return toTex(c, { repeat: [1, 1] });
}
function brickTex(R) {
  const c = canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = '#d8cfc0'; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < 512; x += 64) { const v = R() * 30; g.fillStyle = `rgb(${170 + v},${80 + v * 0.5},${55})`; g.fillRect(x + 2, y + 2, 60, 28); }
  grain(g, 512, 256, 14, R);
  return toTex(c, { repeat: [1, 1] });
}
function skyTex(night) {
  const c = canvas(16, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  if (night) { gr.addColorStop(0, '#060a24'); gr.addColorStop(1, '#2a2a5a'); } else { gr.addColorStop(0, '#3f8fe8'); gr.addColorStop(1, '#cfeaff'); }
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  return toTex(c);
}

export function buildGarden(root, track, opts = {}) {
  const night = !!opts.night;
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(55);
  const P = (i) => pts[((i % count) + count) % count];
  const H = (i) => track.hs[((i % count) + count) % count];
  const Z = (i) => track.zone[((i % count) + count) % count];
  const STEP = (i) => track.step[((i % count) + count) % count];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, mat, x, y, z, ry = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = root) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);
  const cyl = (rt, rb, h, mat, x, y, z, seg = 20, parent = root) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, 0, parent);
  const sph = (r, mat, x, y, z, parent = root) => add(new THREE.SphereGeometry(r, 18, 14), mat, x, y, z, 0, parent);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  function distTrack(x, z) { let bd = Infinity; for (let i = 0; i < count; i += 2) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); }
  const free = (x, z, r) => distTrack(x, z) > wall + r;
  const pond = track.marks.pond;
  const inPond = (x, z, m = 0) => ((x - pond.x) / (46 + m)) ** 2 + ((z - pond.z) / (30 + m)) ** 2 < 1;

  // ---------------------------------------------------------------- cielo, prato, patio, muro di casa, staccionata
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(night), side: THREE.BackSide, fog: false }));
    sky.userData.noShadow = true; root.add(sky);
    const gt = grassTex(R); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(14, 12);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), std({ map: gt, roughness: 1, color: '#d7f0c8' }));
    ground.rotation.x = -Math.PI / 2; ground.userData.noCast = true; root.add(ground);
    const st = stoneTex(R); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(5, 1.3);
    const patio = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, 70), std({ map: st, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    patio.rotation.x = -Math.PI / 2; patio.position.set(0, 0.05, -RZ + 35); patio.userData.noCast = true; root.add(patio);
    // muro di casa con la porta finestra
    const bt = brickTex(R); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(6, 3);
    const wallM = std({ map: bt, roughness: 0.9 });
    const house = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2 + 200, 260), wallM); house.position.set(0, 130, -RZ - 2); root.add(house);
    box(70, 110, 2, std({ color: night ? '#ffcf7a' : '#9fd0ff', roughness: 0.05, emissive: night ? '#ffb040' : '#000', emissiveIntensity: night ? 0.8 : 0 }), 40, 55, -RZ - 1);
    for (const [w, h, x, y] of [[74, 4, 40, 112], [4, 112, 3, 55], [4, 112, 77, 55], [4, 112, 40, 55]]) box(w, h, 3, std({ color: '#ffffff' }), x, y, -RZ);
    for (const x of [-120, 140]) { box(50, 40, 2, std({ color: night ? '#ffd68a' : '#a8d4ff', roughness: 0.05, emissive: night ? '#ffb040' : '#000', emissiveIntensity: night ? 0.7 : 0 }), x, 90, -RZ - 1); box(56, 4, 4, std({ color: '#fff' }), x, 68, -RZ); }
    // staccionata bianca intorno
    const fence = std({ color: '#f6f3ec', roughness: 0.7 });
    const pick = new THREE.BoxGeometry(5, 34, 1.6);
    const list = [];
    for (let x = -RX - 20; x <= RX + 20; x += 9) list.push([x, RZ + 18, 0]);
    for (let z = -RZ; z <= RZ + 18; z += 9) { list.push([-RX - 20, z, Math.PI / 2]); list.push([RX + 20, z, Math.PI / 2]); }
    const inst = new THREE.InstancedMesh(pick, fence, list.length);
    const mm = new THREE.Matrix4();
    list.forEach(([x, z, ry], n) => { mm.makeRotationY(ry); mm.setPosition(x, 17, z); inst.setMatrixAt(n, mm); });
    root.add(inst);
    for (const [w, x, z, ry] of [[RX * 2 + 40, 0, RZ + 18, 0], [RZ * 2 + 40, -RX - 20, 0, Math.PI / 2], [RZ * 2 + 40, RX + 20, 0, Math.PI / 2]]) { box(w, 3, 2, fence, x, 10, z, ry); box(w, 3, 2, fence, x, 26, z, ry); }
    // alberi grandi agli angoli, fuori dalla staccionata e dentro dove c'è posto
    const bark = std({ color: '#6b4a2e', roughness: 0.9 }), leaves = std({ color: '#3c8f3a', roughness: 0.8 }), leaves2 = std({ color: '#2f7a30', roughness: 0.8 });
    for (const [x, z, s] of [[-260, 230, 1.6], [250, 240, 1.8], [-300, -40, 1.5], [300, 30, 1.7], [-250, -200, 1.3], [270, -210, 1.4], [0, 300, 2]]) {
      cyl(6 * s, 9 * s, 90 * s, bark, x, 45 * s, z, 12);
      for (let k = 0; k < 6; k++) sph((28 + R() * 14) * s, k % 2 ? leaves : leaves2, x + (R() - 0.5) * 50 * s, (95 + R() * 40) * s, z + (R() - 0.5) * 50 * s);
    }
  }

  // ---------------------------------------------------------------- stagno con le ninfee
  {
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), std({ color: night ? '#1a3a5a' : '#3d8fb8', roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.92 }));
    water.scale.set(46, 30, 1); water.rotation.x = -Math.PI / 2; water.position.set(pond.x, 0.3, pond.z); water.userData.noShadow = true; root.add(water);
    const rock = std({ color: '#8d8a83', roughness: 0.85 });
    for (let k = 0; k < 34; k++) { const a = k / 34 * 6.28, x = pond.x + Math.cos(a) * 48, z = pond.z + Math.sin(a) * 32; if (distTrack(x, z) < hw + 3) continue; const r = sph(3 + R() * 3, rock, x, 1, z); r.scale.y = 0.55; }
    const pad = std({ color: '#3da23a', roughness: 0.6, side: THREE.DoubleSide });
    for (let k = 0; k < 9; k++) {
      const a = R() * 6.28, rr = R() * 0.8, x = pond.x + Math.cos(a) * 40 * rr, z = pond.z + Math.sin(a) * 25 * rr;
      if (distTrack(x, z) < wall + 3) continue;
      const m = new THREE.Mesh(new THREE.CircleGeometry(4 + R() * 3, 20, 0.3, 5.9), pad); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.5, z); root.add(m);
      if (R() < 0.4) { sph(1.2, std({ color: '#ff8ad8', roughness: 0.5 }), x, 1.5, z); }
    }
  }

  // ---------------------------------------------------------------- pista giocattolo
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
      const s = i * track.ds; uv.push(0, s / vScale, 1, s / vScale);
      const n = v.length / 3;
      if (k > 0) id.push(n - 4, n - 3, n - 2, n - 3, n - 1, n - 2);
      k = k < 0 ? 1 : k + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(id); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); root.add(m); return m;
  }
  function side(i0, i1, lat, mat, filter, top = 0) {
    const v = [], id = [];
    let k = 0;
    for (let i = i0; i <= i1; i++) {
      if (filter && !filter(i)) { k = -1; continue; }
      const p = P(i), y = Hr(i, i1) + top;
      v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * lat, -1, p.z + p.rz * lat);
      const n = v.length / 3;
      if (k > 0) id.push(n - 4, n - 2, n - 3, n - 3, n - 2, n - 1);
      k = k < 0 ? 1 : k + 1;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(id); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; root.add(m); return m;
  }
  const ROAD = roadTex(R);
  const road = std({ map: ROAD.map, bumpMap: ROAD.bump, bumpScale: 0.6, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const planks = std({ map: plankTex(R), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mudM = std({ color: '#5b3a1e', roughness: 0.25, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const kerbC = canvas(16, 64), kg = kerbC.getContext('2d');
  kg.fillStyle = '#f4f4f4'; kg.fillRect(0, 0, 16, 64); kg.fillStyle = '#2ec46b'; kg.fillRect(0, 0, 16, 32);
  const kerbMat = std({ map: toTex(kerbC, { repeat: [1, 1] }), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const curvy = (i) => Math.abs(P(i - 5).tx * P(i + 5).tz - P(i - 5).tz * P(i + 5).tx) > 0.12;
  const isBridge = (i) => Z(i) === 'bridge' || (Z(i) === 'ramp');
  const wood = std({ color: '#7a5130', roughness: 0.8 });
  for (const [a, b] of runs) {
    strip(a, b, -hw, hw, 0.06, road, hw * 4, (i) => !isBridge(i));
    strip(a, b, -wall, wall, 0.06, planks, 14, isBridge);
    strip(a, b, -hw - 1.8, -hw, 0.1, kerbMat, 5, (i) => curvy(i) && !isBridge(i)).userData.noCast = true;
    strip(a, b, hw, hw + 1.8, 0.1, kerbMat, 5, (i) => curvy(i) && !isBridge(i)).userData.noCast = true;
    // fango: macchie lucide sulla strada
    strip(a, b, -hw + 1, hw - 1, 0.14, mudM, 20, (i) => Z(i) === 'mud' && (Math.floor(i / 7) % 3 !== 0));
    // fianchi del ponte (tavole) fino all'acqua
    for (const sgn of [-1, 1]) side(a, b, sgn * wall, wood, (i) => isBridge(i) && H(i) > 0.5, 0.02);
  }
  // pali e corde del ponte
  {
    const rope = std({ color: '#c9a66b', roughness: 0.9 });
    const segs = [[], []];
    for (let i = 0; i < count; i += 4) {
      if (!isBridge(i) || H(i) < 0.5) continue;
      const p = P(i);
      for (const [k, sgn] of [[0, -1], [1, 1]]) {
        const x = p.x + p.rx * sgn * (wall + 0.5), z = p.z + p.rz * sgn * (wall + 0.5);
        if (i % 12 === 0) cyl(0.8, 0.9, H(i) + 9, wood, x, (H(i) + 9) / 2 - 1, z, 8);
        segs[k].push(new THREE.Vector3(x, H(i) + 6.5, z));
      }
    }
    for (const s of segs) if (s.length > 2) root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s), 80, 0.4, 6, false), rope));
  }
  // barriere bianche col bordo verde (non sul ponte)
  {
    const RH2 = 1.9, wl = wall - 0.2;
    const rail = new THREE.MeshPhysicalMaterial({ color: '#f4f2ec', roughness: 0.3, clearcoat: 0.6 });
    const railTop = new THREE.MeshPhysicalMaterial({ color: '#2ec46b', roughness: 0.3, clearcoat: 0.8 });
    const ok = (i) => !isBridge(i);
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

  // ---------------------------------------------------------------- fiori giganti: i gambi in mezzo alla pista e tanti fiori intorno
  const petalCols = ['#ff4f6d', '#ffcc00', '#ff8ad8', '#ffffff', '#9b5cff', '#ff8a00'];
  const stemM = std({ color: '#3c9a3a', roughness: 0.6 });
  function flower(x, z, h, kind, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    cyl(1.3, 1.6, h, stemM, 0, h / 2, 0, 10, g);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), stemM); leaf.scale.set(1.4, 0.25, 0.6); leaf.position.set(4, h * 0.3, 0); leaf.rotation.z = 0.5; g.add(leaf);
    if (kind === 'sun') {
      for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28, p = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), std({ color: '#ffc61a', roughness: 0.5 })); p.scale.set(1.6, 0.35, 0.7); p.position.set(Math.cos(a) * 8, h + 1, Math.sin(a) * 8); p.rotation.y = -a; g.add(p); }
      const c = sph(6, std({ color: '#5a3416', roughness: 0.9 }), 0, h + 1.5, 0, g); c.scale.y = 0.45;
    } else if (kind === 'tulip') {
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28, p = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 10), std({ color: col, roughness: 0.4 })); p.scale.set(0.7, 1.4, 0.7); p.position.set(Math.cos(a) * 2.6, h + 4, Math.sin(a) * 2.6); g.add(p); }
    } else {
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28, p = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), std({ color: col, roughness: 0.5 })); p.scale.set(1.8, 0.3, 0.7); p.position.set(Math.cos(a) * 5.5, h, Math.sin(a) * 5.5); p.rotation.y = -a; g.add(p); }
      const c = sph(3.2, std({ color: '#ffd400', roughness: 0.6 }), 0, h + 0.5, 0, g); c.scale.y = 0.5;
    }
    return g;
  }
  (track.stems || []).forEach((s, i) => flower(s.x, s.z, s.h, ['sun', 'tulip', 'daisy'][i % 3], petalCols[i % petalCols.length]));
  for (let k = 0; k < 70; k++) {
    const x = (R() * 2 - 1) * (RX + 10), z = (R() * 2 - 1) * (RZ + 10);
    if (z < -RZ + 72 || !free(x, z, 6) || inPond(x, z, 8)) continue;
    flower(x, z, 18 + R() * 40, ['sun', 'tulip', 'daisy'][k % 3], petalCols[k % petalCols.length]);
  }
  // ciuffi d'erba alta
  {
    const blade = new THREE.ConeGeometry(0.9, 9, 4);
    const gm = std({ color: '#3f9a32', roughness: 0.8 });
    const list = [];
    for (let k = 0; k < 900; k++) { const x = (R() * 2 - 1) * (RX + 15), z = (R() * 2 - 1) * (RZ + 15); if (z < -RZ + 72 || !free(x, z, 2) || inPond(x, z, 4)) continue; list.push([x, z, 0.6 + R() * 0.9, R() * 0.5 - 0.25]); }
    const inst = new THREE.InstancedMesh(blade, gm, list.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([x, z, s, t], n) => { e.set(t, R() * 6, t * 0.5); q.setFromEuler(e); mm.compose(new THREE.Vector3(x, 4 * s, z), q, new THREE.Vector3(s, s, s)); inst.setMatrixAt(n, mm); });
    inst.userData.noShadow = true; root.add(inst);
  }
  // funghi, nano da giardino, annaffiatoio, tubo dell'acqua
  {
    for (const [x, z, s] of [[-90, -40, 1], [80, 60, 1.3], [-120, 60, 0.9], [120, -60, 1.1]]) {
      if (!free(x, z, 8 * s)) continue;
      cyl(2.2 * s, 2.8 * s, 9 * s, std({ color: '#f4efe4' }), x, 4.5 * s, z, 12);
      const cap = sph(7 * s, std({ color: '#e8322b', roughness: 0.4 }), x, 10 * s, z); cap.scale.y = 0.6;
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; sph(1.1 * s, std({ color: '#fff' }), x + Math.cos(a) * 4.2 * s, 12.5 * s, z + Math.sin(a) * 4.2 * s); }
    }
    // nano
    const gx = -175, gz = -30;
    if (free(gx, gz, 8)) {
      cyl(4, 5, 10, std({ color: '#2f7bff' }), gx, 5, gz, 16);
      sph(3.4, std({ color: '#ffd2b0' }), gx, 13, gz);
      const beard = sph(3.2, std({ color: '#ffffff' }), gx, 11, gz + 1.5); beard.scale.set(1, 1.2, 0.8);
      add(new THREE.ConeGeometry(3.6, 9, 16), std({ color: '#e8322b' }), gx, 19.5, gz);
    }
    // annaffiatoio verde
    const wx = 185, wz = 140;
    cyl(10, 10, 16, std({ color: '#2ec46b', roughness: 0.35, metalness: 0.3 }), wx, 8, wz, 24);
    const sp = add(new THREE.CylinderGeometry(1, 1.6, 22, 10), std({ color: '#2ec46b', roughness: 0.35, metalness: 0.3 }), wx - 12, 14, wz); sp.rotation.z = 0.9;
    const hd = add(new THREE.TorusGeometry(6, 1.2, 8, 20, Math.PI), std({ color: '#2ec46b' }), wx, 17, wz); hd.rotation.y = Math.PI / 2;
    // tubo dell'acqua che serpeggia fino all'irrigatore
    const sI = Math.floor(track.marks.sprinkler / track.ds) % count, sp2 = P(sI);
    const sx = sp2.x + sp2.rx * (wall + 6), sz = sp2.z + sp2.rz * (wall + 6);
    const hosePts = [new THREE.Vector3(-RX - 10, 1, 20), new THREE.Vector3(-150, 1, 60 * 0 + 50), new THREE.Vector3(-100, 1, 70), new THREE.Vector3(sx - 10, 1, sz + 25), new THREE.Vector3(sx, 1, sz)];
    if (hosePts.every(p => free(p.x, p.z, 1) || p === hosePts[hosePts.length - 1])) root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 80, 1.1, 8, false), std({ color: '#2ec46b', roughness: 0.4 })));
  }
  // ---------------------------------------------------------------- irrigatore e lumaca (ostacoli che si muovono)
  const spray = new THREE.Group();
  {
    const jetM = std({ color: '#cdefff', roughness: 0.05, transparent: true, opacity: 0.6, emissive: '#7fc8ff', emissiveIntensity: 0.3 });
    const drop = new THREE.SphereGeometry(0.8, 8, 6);
    for (let k = 0; k < 26; k++) { const d = new THREE.Mesh(drop, jetM); d.userData.k = k; spray.add(d); }
    spray.traverse(o => { o.userData.noShadow = true; });
    const base = new THREE.Group();
    const sI = Math.floor(track.marks.sprinkler / track.ds) % count, p = P(sI);
    base.position.set(p.x + p.rx * (wall + 6), 0, p.z + p.rz * (wall + 6));
    cyl(2.5, 3, 3, std({ color: '#333' }), 0, 1.5, 0, 12, base);
    const head = cyl(1, 1, 4, std({ color: '#ffcc00', metalness: 0.5, roughness: 0.3 }), 0, 5, 0, 10, base);
    root.add(base);
    track.sprinklerBase = base;
  }
  const snail = new THREE.Group();
  {
    const shell = new THREE.Mesh(new THREE.TorusGeometry(2.6, 1.8, 12, 24), std({ color: '#c9783a', roughness: 0.5 }));
    shell.position.y = 4.4; shell.rotation.y = Math.PI / 2; snail.add(shell);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 7, 6, 10), std({ color: '#d9c48a', roughness: 0.6 })); body.rotation.x = Math.PI / 2; body.position.set(0, 1.4, 0.5); snail.add(body);
    for (const sgn of [-1, 1]) { const st = cyl(0.25, 0.25, 3, std({ color: '#d9c48a' }), sgn * 0.8, 3.4, 4.6, 6, snail); st.rotation.x = 0.4; sph(0.5, std({ color: '#222' }), sgn * 0.8, 4.9, 5.2, snail); }
    snail.traverse(o => { o.userData.noShadow = true; });
  }
  root.add(spray, snail);
  track.obstacleMeshes = { snail };
  track.animate = (t, tsec) => {
    // goccioline dell'irrigatore: un ventaglio dall'irrigatore al punto dove arriva il getto
    const b = track.sprinklerBase;
    const o = obstaclesAt(track, t).find(q => q.kind === 'spray');
    if (b && o) {
      const tx = o.x, tz = o.z;
      spray.children.forEach((d) => {
        const u = ((d.userData.k / 26) + tsec * 0.8) % 1;
        const x = b.position.x + (tx - b.position.x) * u, z = b.position.z + (tz - b.position.z) * u;
        d.position.set(x + Math.sin(d.userData.k * 7) * 0.8, 6 + Math.sin(u * Math.PI) * 9, z + Math.cos(d.userData.k * 5) * 0.8);
      });
    }
  };

  // ---------------------------------------------------------------- luci
  if (!night) {
    root.add(new THREE.HemisphereLight('#cfe8ff', '#4f8a3a', 1.1));
    const sun = new THREE.DirectionalLight('#fff1d6', 2.8);
    sun.position.set(-200, 420, 160); sun.target.position.set(0, 0, 0); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 240; sc.bottom = -240; sc.near = 150; sc.far = 1000;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 4;
    root.add(sun, sun.target);
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: '#fff6c8', fog: false }));
    sunDisc.position.set(-500, 700, 600); sunDisc.lookAt(0, 0, 0); root.add(sunDisc);
  } else {
    root.add(new THREE.HemisphereLight('#4a5ab8', '#14200f', 0.6));
    const moon = new THREE.DirectionalLight('#9fb4ff', 1.1); moon.position.set(-200, 400, 160); moon.target.position.set(0, 0, 0); moon.castShadow = true;
    const sc = moon.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 240; sc.bottom = -240; sc.near = 150; sc.far = 1000;
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35;
    root.add(moon, moon.target);
    const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: '#fff8d8', fog: false })); moonDisc.position.set(-500, 650, 600); moonDisc.lookAt(0, 0, 0); root.add(moonDisc);
    // lucine appese al muro di casa e lucciole
    const cols = ['#ffcf6a', '#ff8ad8', '#7fe0ff', '#b6ff7a'];
    for (let x = -RX; x <= RX; x += 12) { const y = 150 - Math.abs(Math.sin(x / 40)) * 14; sph(1.6, glow(cols[Math.abs(Math.round(x / 12)) % 4]), x, y, -RZ + 2).userData.noShadow = true; }
    for (let k = 0; k < 60; k++) { const x = (R() * 2 - 1) * RX, z = (R() * 2 - 1) * RZ; if (!free(x, z, 2)) continue; sph(0.6, glow('#d8ff6a'), x, 6 + R() * 30, z).userData.noShadow = true; }
    for (const [x, y, z, c, i] of [[40, 110, -RZ + 10, '#ffb050', 2.6], [8, 30, 100, '#5fd0ff', 1.6], [-150, 60, 60, '#d8ff6a', 1.2], [150, 60, 40, '#ff8ad8', 1.2]]) { const l = new THREE.PointLight(c, i, 380, 1); l.position.set(x, y, z); root.add(l); }
    addNeon(root, track, 0.12);
  }
  root.traverse((o) => { if (!o.isMesh || o.userData.noShadow) return; o.receiveShadow = true; o.castShadow = !o.userData.noCast && !(o.material && o.material.transparent); });
  const seen = new Set();
  root.traverse((o) => { const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of mats) { if (seen.has(m) || !m.isMeshStandardMaterial) continue; seen.add(m); m.envMapIntensity = m.metalness > 0.5 ? 1 : m.transparent ? 0.9 : 0.4; } });
  track.ready = Promise.resolve();

  root.userData.fog = new THREE.Fog(night ? '#1a2048' : '#cfe6ff', 600, 1500);
  root.userData.background = new THREE.Color(night ? '#0a0e2a' : '#9fd0ff');
  root.userData.toneMapping = THREE.ACESFilmicToneMapping;
  root.userData.exposure = night ? 1.25 : 1.0;
  root.userData.night = night;
  root.userData.makeEnv = (renderer, n) => {
    const pm = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    const cols = ['#a8d4ff', '#a8d4ff', '#cfe8ff', '#4f8a3a', '#a8d4ff', '#a8d4ff'];
    const room = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 100), cols.map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })));
    if (n) room.material.forEach((m) => m.color.multiplyScalar(0.18));
    sc.add(room);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: n ? new THREE.Color(0.5, 0.5, 1.2) : new THREE.Color(3, 2.9, 2.6) }));
    panel.rotation.x = Math.PI / 2; panel.position.y = 19.5; sc.add(panel);
    const rt = pm.fromScene(sc, 0.03); pm.dispose(); return rt.texture;
  };
}

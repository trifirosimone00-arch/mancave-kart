// Grafica della pista "Roma": sampietrini, via dei Fori Imperiali, il Tevere con due ponti (uno con le statue
// come Ponte Sant'Angelo), la cupola di San Pietro sullo sfondo, la Fontana di Trevi e il giro intorno al Colosseo.
// Traffico romano: Vespe e autobus che attraversano. Di notte i monumenti sono illuminati.
import * as THREE from 'three';
import { rng, canvas, toTex, grain } from './render-mancave.js';
import { addNeon } from './render.js';

const RIVER_X0 = 150, RIVER_X1 = 215;

function cobbleTex(R, light) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = light ? '#8d8a84' : '#3d3c3a'; g.fillRect(0, 0, 512, 512);
  const S = 32;
  for (let y = 0; y < 512; y += S) for (let x = ((y / S) % 2) * S / 2 - S; x < 512; x += S) {
    const v = (light ? 150 : 70) + R() * (light ? 40 : 30);
    g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    g.beginPath(); g.roundRect ? g.roundRect(x + 2, y + 2, S - 4, S - 4, 6) : g.rect(x + 2, y + 2, S - 4, S - 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 5, y + 5, S - 14, 4);
  }
  grain(g, 512, 512, 14, R);
  return toTex(c, { repeat: [1, 1] });
}
function travTex(R, arches = false, alpha = false) {
  // travertino; con arches = archi del Colosseo (buchi trasparenti)
  const c = canvas(1024, 512), g = c.getContext('2d');
  g.fillStyle = '#d9c7a3'; g.fillRect(0, 0, 1024, 512);
  for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${120 + R() * 60},${100 + R() * 50},${70},${R() * 0.18})`; g.fillRect(R() * 1024, R() * 512, 2 + R() * 14, 1 + R() * 3); }
  for (let y = 0; y < 512; y += 32) { g.fillStyle = 'rgba(90,70,40,0.18)'; g.fillRect(0, y, 1024, 2); }
  if (arches) {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) {
      const x = i * 128 + 24, y = row * 160 + 30, w = 80, h = 110;
      g.fillStyle = alpha ? '#000' : '#4a3a26';
      g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.fill();
      if (!alpha) { g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(x - 16, y, 10, h); }
    }
  }
  if (!alpha) grain(g, 1024, 512, 10, R);
  if (alpha) { g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, 1024, 512); }
  return toTex(c, { repeat: [1, 1], srgb: !alpha });
}
function facadeTex(R, col) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.05})`; g.fillRect(R() * 512, R() * 512, 6, 6); }
  for (let fy = 0; fy < 4; fy++) {
    const y = 40 + fy * 118;
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + 96, 512, 6);
    for (let fx = 0; fx < 4; fx++) {
      const x = 30 + fx * 125;
      g.fillStyle = '#e9dcc0'; g.fillRect(x - 6, y - 6, 62, 92);
      g.fillStyle = '#2e5a3a'; g.fillRect(x, y, 24, 80); g.fillRect(x + 26, y, 24, 80);       // persiane verdi
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 8; k++) { g.fillRect(x, y + k * 10, 24, 2); g.fillRect(x + 26, y + k * 10, 24, 2); }
    }
  }
  return toTex(c, { repeat: [1, 1] });
}

export function buildRoma(root, track, opts = {}) {
  const night = !!opts.night;
  const { pts, count, halfWidth: hw, wall } = track;
  const R = rng(1946);
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
  const inRiver = (x, m = 0) => x > RIVER_X0 - m && x < RIVER_X1 + m;
  const trav = std({ map: travTex(R), roughness: 0.8 });
  const C = track.marks.colosseo, T = track.marks.trevi;
  const nearMonument = (x, z, r) => Math.hypot(x - C.x, z - C.z) < 66 + r || (x > T.x - 90 && x < T.x + 90 && z > T.z - 40 - r);

  // ---------------------------------------------------------------- cielo, terreno di sampietrini, Tevere
  {
    const ct = cobbleTex(R, true); ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
    for (const [x0, x1] of [[-900, RIVER_X0], [RIVER_X1, 900]]) {
      const t = ct.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 60, 1800 / 60);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1800), std({ map: t, roughness: 0.85 }));
      g.rotation.x = -Math.PI / 2; g.position.set((x0 + x1) / 2, 0, 0); g.userData.noCast = true; root.add(g);
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(RIVER_X1 - RIVER_X0, 1800), std({ color: night ? '#1d3a48' : '#4f7d6a', roughness: 0.08, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.set((RIVER_X0 + RIVER_X1) / 2, -9, 0); water.userData.noShadow = true; root.add(water);
    for (const x of [RIVER_X0, RIVER_X1]) { const w = box(2, 9.5, 1800, trav, x, -4.5, 0); w.userData.noCast = true; }
    // platani lungo il fiume
    const bark = std({ color: '#8a7a5a', roughness: 0.9 }), leaf = std({ color: '#5c8f3a', roughness: 0.8 });
    for (let z = -300; z <= 300; z += 34) for (const x of [RIVER_X0 - 9, RIVER_X1 + 9]) {
      if (!free(x, z, 5)) continue;
      cyl(1.6, 2.2, 30, bark, x, 15, z, 8);
      sph(11, leaf, x, 34, z).scale.y = 0.8;
    }
  }

  // ---------------------------------------------------------------- strada di sampietrini, cordoli di travertino, transenne
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
  function side(i0, i1, lat, mat, filter, top, bottom) {
    const v = [], uv = [], id = [];
    let k = 0;
    for (let i = i0; i <= i1; i++) {
      if (filter && !filter(i)) { k = -1; continue; }
      const p = P(i), y = Hr(i, i1) + top;
      v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * lat, bottom, p.z + p.rz * lat);
      uv.push(i * track.ds / 40, 1, i * track.ds / 40, 0);
      const n = v.length / 3;
      if (k > 0) id.push(n - 4, n - 2, n - 3, n - 3, n - 2, n - 1);
      k = k < 0 ? 1 : k + 1;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(id); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; root.add(m); return m;
  }
  const cob = cobbleTex(R, false);
  const road = std({ map: cob, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const lineC = canvas(16, 128), lg = lineC.getContext('2d'); lg.clearRect(0, 0, 16, 128); lg.fillStyle = '#f2efe6'; lg.fillRect(2, 0, 12, 64);
  const lineM = std({ map: toTex(lineC, { repeat: [1, 1] }), transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const kerbM = std({ color: '#e4dccb', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const isBridge = (i) => Z(i) === 'bridge';
  // pietra dei ponti con gli archi disegnati
  const archC = canvas(512, 128), ag = archC.getContext('2d');
  ag.fillStyle = '#cdbb94'; ag.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 128) { ag.fillStyle = '#2d2a22'; ag.beginPath(); ag.moveTo(x + 14, 128); ag.lineTo(x + 14, 80); ag.arc(x + 64, 80, 50, Math.PI, 0); ag.lineTo(x + 114, 128); ag.fill(); }
  grain(ag, 512, 128, 12, R);
  const archM = std({ map: toTex(archC, { repeat: [1, 1] }), roughness: 0.85 });
  for (const [a, b] of runs) {
    strip(a, b, -hw, hw, 0.06, road, 26);
    strip(a, b, -0.35, 0.35, 0.1, lineM, 10, (i) => !isBridge(i));
    strip(a, b, -hw - 2.2, -hw, 0.12, kerbM, 10);
    strip(a, b, hw, hw + 2.2, 0.12, kerbM, 10);
    for (const sgn of [-1, 1]) side(a, b, sgn * (wall + 0.4), archM, isBridge, 0, -9);
    strip(a, b, -wall - 0.4, wall + 0.4, -0.5, archM, 30, isBridge);
  }
  // transenne bianche e rosse lungo la pista (parapetto di pietra sui ponti)
  {
    const RH2 = 2.2, wl = wall - 0.2;
    const rail = new THREE.MeshPhysicalMaterial({ color: '#f4f2ec', roughness: 0.35, clearcoat: 0.4 });
    const railTop = new THREE.MeshPhysicalMaterial({ color: '#d62828', roughness: 0.3, clearcoat: 0.8 });
    for (const [a, b] of runs) for (const sgn of [-1, 1]) {
      const v = [], id = [];
      let k = 0;
      for (let i = a; i <= b; i++) {
        const p = P(i), y = Hr(i, b), l = sgn * wl, top = isBridge(i) ? 4.5 : RH2;
        v.push(p.x + p.rx * l, y + 0.2, p.z + p.rz * l, p.x + p.rx * l, y + top, p.z + p.rz * l);
        const n = v.length / 3;
        if (k > 0) id.push(n - 4, n - 2, n - 3, n - 3, n - 2, n - 1);
        k++;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(id); g.computeVertexNormals();
      const rm = new THREE.Mesh(g, rail); rm.material.side = THREE.DoubleSide; root.add(rm);
      let seg = [];
      const flush = () => { if (seg.length >= 2) root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seg), Math.max(4, seg.length * 3), 0.45, 8, false), railTop)); seg = []; };
      for (let i = a; i <= b; i += 3) { if (isBridge(i)) { flush(); continue; } const p = P(i), l = sgn * wl; seg.push(new THREE.Vector3(p.x + p.rx * l, Hr(Math.min(i, b), b) + RH2, p.z + p.rz * l)); }
      flush();
    }
    // statue bianche sul ponte nord (come Ponte Sant'Angelo)
    const marble = std({ color: '#f1ede4', roughness: 0.4 });
    for (let i = 0; i < count; i += 9) {
      if (!isBridge(i) || P(i).z < 60) continue;
      const p = P(i);
      for (const sgn of [-1, 1]) {
        const x = p.x + p.rx * sgn * (wall + 0.6), z = p.z + p.rz * sgn * (wall + 0.6), y = H(i) + 4.5;
        box(3, 3, 3, trav, x, y + 1.5, z);
        cyl(1, 1.3, 7, marble, x, y + 6.5, z, 10); sph(1.2, marble, x, y + 10.8, z);
        const wing = add(new THREE.SphereGeometry(2.5, 10, 8), marble, x - p.tx * 1, y + 8, z - p.tz * 1); wing.scale.set(0.3, 1.2, 1);
      }
    }
  }
  // lampioni romani
  {
    const iron = std({ color: '#1f2225', roughness: 0.5, metalness: 0.6 });
    const lampM = night ? glow('#ffd28a') : std({ color: '#fff6dc', emissive: '#ffe6a8', emissiveIntensity: 0.3 });
    for (let i = 0; i < count; i += Math.round(46 / track.ds)) {
      if (isBridge(i)) continue;
      const p = P(i), sgn = (i / Math.round(46 / track.ds)) % 2 ? 1 : -1;
      const x = p.x + p.rx * sgn * (wall + 3.5), z = p.z + p.rz * sgn * (wall + 3.5);
      cyl(0.5, 0.8, 22, iron, x, 11, z, 8);
      const l = box(2.4, 3.2, 2.4, lampM, x, 23.5, z); l.userData.noShadow = true;
      add(new THREE.ConeGeometry(2, 1.6, 4), iron, x, 25.9, z, Math.PI / 4);
    }
  }

  // ---------------------------------------------------------------- Colosseo
  {
    const g = new THREE.Group(); g.position.set(C.x, 0, C.z); root.add(g);
    const archT = travTex(R, true), archA = travTex(R, true, true);
    archT.wrapS = archA.wrapS = THREE.RepeatWrapping; archT.repeat.set(6, 1); archA.repeat.set(6, 1);
    const wallM = std({ map: archT, alphaMap: archA, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, emissive: night ? '#ffb347' : '#000', emissiveIntensity: night ? 0.35 : 0 });
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 52, 72, 1, true), wallM); outer.position.y = 26; outer.scale.z = 0.86; g.add(outer);
    // l'anello più alto è crollato da una parte
    const top = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 12, 72, 1, true, 0, Math.PI * 1.25), std({ map: trav.map, roughness: 0.85, side: THREE.DoubleSide })); top.position.y = 58; top.scale.z = 0.86; g.add(top);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 40, 64, 1, true), wallM); inner.position.y = 20; inner.scale.z = 0.82; g.add(inner);
    // gradinate tra i due anelli e arena di sabbia
    const steps = new THREE.Mesh(new THREE.CylinderGeometry(49, 30, 36, 64, 1, true), std({ color: '#b9a37c', roughness: 0.9, side: THREE.DoubleSide })); steps.position.y = 18; steps.scale.z = 0.84; g.add(steps);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(30, 48), std({ color: '#d9b87a', roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.3; sand.scale.y = 0.82; g.add(sand);
  }

  // ---------------------------------------------------------------- Fontana di Trevi: palazzo, scogli, statua, vasca
  {
    const g = new THREE.Group(); g.position.set(T.x, 0, T.z); root.add(g);
    const lit = night ? { emissive: '#ffcf8a', emissiveIntensity: 0.3 } : {};
    box(180, 64, 14, std({ map: trav.map, roughness: 0.8, ...lit }), 0, 32, 26, 0, g);
    box(186, 6, 18, std({ map: trav.map, roughness: 0.8, ...lit }), 0, 66, 26, 0, g);
    box(80, 10, 16, std({ map: trav.map, roughness: 0.8, ...lit }), 0, 74, 26, 0, g);
    // colonne e nicchia centrale
    for (const x of [-34, -22, 22, 34, -80, -60, 60, 80]) cyl(2.2, 2.4, 52, std({ color: '#e7dcc4', roughness: 0.6, ...lit }), x, 30, 18.5, 14, g);
    const niche = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 40, 24, 1, true, Math.PI / 2, Math.PI), std({ color: '#c9b791', side: THREE.DoubleSide, roughness: 0.8 })); niche.position.set(0, 24, 19); g.add(niche);
    // statua di Oceano (semplificata) e cavalli
    const marble = std({ color: '#f3efe6', roughness: 0.35 });
    cyl(2.8, 3.2, 12, marble, 0, 16, 14, 12, g); sph(2.6, marble, 0, 24, 14, g);
    const cloak = sph(5, marble, 0, 14, 12, g); cloak.scale.set(1, 1.5, 0.6);
    for (const sgn of [-1, 1]) { const h = sph(5, marble, sgn * 16, 6, 4, g); h.scale.set(0.6, 0.8, 1.6); sph(2.4, marble, sgn * 16, 10, -2, g); }
    // scogli
    const rock = std({ color: '#cfc3a6', roughness: 0.9 });
    for (let k = 0; k < 26; k++) { const r = sph(3 + R() * 5, rock, (R() - 0.5) * 120, R() * 6, 6 + R() * 10, g); r.scale.y = 0.6; }
    // vasca con l'acqua turchese e le cascatelle
    const waterM = std({ color: '#3fc7d6', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.9, emissive: night ? '#1a8aa0' : '#000', emissiveIntensity: night ? 0.6 : 0 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(150, 22), waterM); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 1.2, -6); g.add(pool);
    box(154, 3, 2, trav, 0, 1.5, -17.5, 0, g);
    for (const sgn of [-1, 1]) box(2, 3, 22, trav, sgn * 76, 1.5, -6, 0, g);
    const fallM = std({ color: '#d8f6ff', transparent: true, opacity: 0.55, roughness: 0.05, emissive: '#7fdcff', emissiveIntensity: 0.2 });
    for (const x of [-40, -12, 12, 40]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), fallM); f.position.set(x, 5, 3); f.rotation.x = -0.4; g.add(f); f.userData.noShadow = true; }
    // monetine
    const gold = std({ color: '#ffcc33', metalness: 0.9, roughness: 0.3 });
    for (let k = 0; k < 40; k++) { const c = cyl(0.6, 0.6, 0.1, gold, (R() - 0.5) * 140, 1.0, -6 + (R() - 0.5) * 18, 8, g); c.userData.noShadow = true; }
  }

  // ---------------------------------------------------------------- San Pietro sullo sfondo (oltre il Tevere)
  {
    const g = new THREE.Group(); g.position.set(470, 0, 40); g.rotation.y = -Math.PI / 2; root.add(g);
    const lit = night ? { emissive: '#ffd9a0', emissiveIntensity: 0.35 } : {};
    const stone = std({ color: '#e6dcc6', roughness: 0.75, ...lit });
    box(160, 70, 40, stone, 0, 35, 0, 0, g);
    for (let x = -70; x <= 70; x += 17.5) cyl(3, 3.4, 60, stone, x, 30, -21, 14, g);
    const ped = add(new THREE.ConeGeometry(50, 18, 3), stone, 0, 79, -20, 0, g); ped.rotation.z = Math.PI; ped.rotation.y = Math.PI / 2; ped.scale.set(1, 1, 0.15);
    cyl(42, 44, 30, stone, 0, 85, 40, 32, g);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; cyl(1.6, 1.6, 26, stone, Math.cos(a) * 44, 85, 40 + Math.sin(a) * 44, 8, g); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: night ? '#8aa0b8' : '#9fb4b8', roughness: 0.55, metalness: 0.2, ...lit })); dome.position.set(0, 100, 40); dome.scale.y = 1.25; g.add(dome);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const rib = add(new THREE.TorusGeometry(42, 0.8, 4, 24, Math.PI / 2), stone, 0, 100, 40, a, g); rib.scale.y = 1.25; rib.rotation.z = Math.PI / 2; }
    cyl(5, 6, 14, stone, 0, 160, 40, 16, g); add(new THREE.ConeGeometry(4, 8, 16), stone, 0, 171, 40, 0, g);
    // colonnato a braccia aperte
    for (const sgn of [-1, 1]) for (let k = 0; k <= 12; k++) {
      const a = k / 12 * Math.PI * 0.7, x = sgn * (80 + Math.sin(a) * 70), z = -30 - Math.cos(a) * 10 - k * 9;
      cyl(2.4, 2.4, 30, stone, x, 15, z, 10, g);
    }
  }

  // ---------------------------------------------------------------- palazzi colorati, pini, edicola dove c'è posto
  {
    const cols = ['#e2a65a', '#d9774a', '#e8c46a', '#c8603e', '#efd49a', '#b85a3a'];
    const mats = cols.map(c => std({ map: facadeTex(R, c), roughness: 0.9 }));
    const roof = std({ color: '#a2552e', roughness: 0.9 });
    for (let k = 0; k < 220; k++) {
      const x = (R() * 2 - 1) * 380, z = (R() * 2 - 1) * 330;
      const w = 40 + R() * 40, d = 30 + R() * 30, h = 40 + R() * 40;
      const r = Math.hypot(w, d) / 2;
      if (!free(x, z, r + 6) || inRiver(x, r + 12) || nearMonument(x, z, r) || (x > RIVER_X1 && Math.abs(z - 40) < 120 && x > 330)) continue;
      const m = mats[k % mats.length];
      const b = box(w, h, d, m, x, h / 2, z, 0);
      box(w + 2, 2, d + 2, roof, x, h + 1, z, 0);
    }
    const bark = std({ color: '#7a5a3a', roughness: 0.9 }), pine = std({ color: '#3f6f34', roughness: 0.8 });
    for (let k = 0; k < 60; k++) {
      const x = (R() * 2 - 1) * 300, z = (R() * 2 - 1) * 260;
      if (!free(x, z, 10) || inRiver(x, 14) || nearMonument(x, z, 8)) continue;
      const h = 34 + R() * 20;
      const tr = cyl(1.4, 2, h, bark, x, h / 2, z, 8); tr.rotation.z = (R() - 0.5) * 0.25;
      const c = sph(14, pine, x, h + 3, z); c.scale.set(1.3, 0.45, 1.3);
    }
  }

  // ---------------------------------------------------------------- traffico: Vespe e autobus
  function vespa(col) {
    const g = new THREE.Group();
    const body = std({ color: col, roughness: 0.3, metalness: 0.3 });
    const back = sph(2.2, body, 0, 2.4, -1.2, g); back.scale.set(0.9, 0.8, 1.4);
    box(1.4, 1.2, 3.2, body, 0, 1.4, 1, 0, g);
    const front = box(1.6, 3.6, 0.8, body, 0, 2.6, 2.6, 0, g); front.rotation.x = -0.2;
    box(3.4, 0.3, 0.3, std({ color: '#222' }), 0, 4.6, 2.8, 0, g);
    for (const z of [-2.2, 2.6]) { const w = cyl(1, 1, 0.6, std({ color: '#111' }), 0, 1, z, 14, g); w.rotation.z = Math.PI / 2; }
    // pilota col casco
    cyl(0.9, 1.1, 3, std({ color: '#2b4c7e' }), 0, 4.6, -0.6, 10, g); sph(1, std({ color: '#ffffff', roughness: 0.2 }), 0, 6.8, -0.4, g);
    g.traverse(o => { o.userData.noShadow = true; });
    return g;
  }
  function bus() {
    const g = new THREE.Group();
    const orange = std({ color: '#e8792b', roughness: 0.4 });
    box(5.5, 6, 22, orange, 0, 4, 0, 0, g);
    box(5.6, 2.4, 20, std({ color: '#1a2a38', roughness: 0.1, metalness: 0.3 }), 0, 5.3, 0, 0, g);
    box(5.6, 1, 22, std({ color: '#f4f2ec' }), 0, 7.4, 0, 0, g);
    for (const z of [-7, 7]) for (const sgn of [-1, 1]) { const w = cyl(1.3, 1.3, 0.8, std({ color: '#111' }), sgn * 2.6, 1.3, z, 14, g); w.rotation.z = Math.PI / 2; }
    g.traverse(o => { o.userData.noShadow = true; });
    return g;
  }
  const v1 = vespa('#7fc6c0'), v2 = vespa('#d62828'), b1 = bus();
  root.add(v1, v2, b1);
  track.obstacleMeshes = { vespa: v1, vespa2: v2, bus: b1 };

  // ---------------------------------------------------------------- luci
  if (!night) {
    root.add(new THREE.HemisphereLight('#dfefff', '#b8a07a', 1.0));
    const sun = new THREE.DirectionalLight('#fff0d4', 2.8);
    sun.position.set(-220, 420, -160); sun.target.position.set(0, 0, 0); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -320; sc.right = 320; sc.top = 280; sc.bottom = -280; sc.near = 150; sc.far = 1100;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 4;
    root.add(sun, sun.target);
  } else {
    root.add(new THREE.HemisphereLight('#4a5ab8', '#2a1e14', 0.6));
    const moon = new THREE.DirectionalLight('#9fb4ff', 0.9); moon.position.set(-220, 400, -160); moon.target.position.set(0, 0, 0); moon.castShadow = true;
    const sc = moon.shadow.camera; sc.left = -320; sc.right = 320; sc.top = 280; sc.bottom = -280; sc.near = 150; sc.far = 1100;
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35;
    root.add(moon, moon.target);
    for (const [x, y, z, c, i] of [[C.x, 70, C.z, '#ffb347', 3], [T.x, 40, T.z - 20, '#5fe0ff', 2.4], [180, 30, 100, '#ffd28a', 1.6], [180, 30, -30, '#ffd28a', 1.6], [-60, 40, -150, '#ffd28a', 1.8], [400, 120, 40, '#ffe0a0', 2.4]]) { const l = new THREE.PointLight(c, i, 420, 1); l.position.set(x, y, z); root.add(l); }
    addNeon(root, track, 0.15);
  }
  root.traverse((o) => { if (!o.isMesh || o.userData.noShadow) return; o.receiveShadow = true; o.castShadow = !o.userData.noCast && !(o.material && o.material.transparent && !o.material.alphaTest); });
  const seen = new Set();
  root.traverse((o) => { const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of mats) { if (seen.has(m) || !m.isMeshStandardMaterial) continue; seen.add(m); m.envMapIntensity = m.metalness > 0.5 ? 1 : m.transparent ? 0.9 : 0.4; } });
  track.ready = Promise.resolve();

  root.userData.fog = new THREE.Fog(night ? '#141a38' : '#e8dcc8', 650, 1700);
  root.userData.background = new THREE.Color(night ? '#0b1030' : '#9ccbf0');
  root.userData.toneMapping = THREE.ACESFilmicToneMapping;
  root.userData.exposure = night ? 1.25 : 1.0;
  root.userData.night = night;
  root.userData.makeEnv = (renderer, n) => {
    const pm = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    const cols = ['#e2c79a', '#e2c79a', '#bfe0ff', '#8d8a84', '#e2c79a', '#e2c79a'];
    const room = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 100), cols.map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })));
    if (n) room.material.forEach((m) => m.color.multiplyScalar(0.18));
    sc.add(room);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: n ? new THREE.Color(0.5, 0.5, 1.2) : new THREE.Color(3, 2.9, 2.6) }));
    panel.rotation.x = Math.PI / 2; panel.position.y = 19.5; sc.add(panel);
    const rt = pm.fromScene(sc, 0.03); pm.dispose(); return rt.texture;
  };
}

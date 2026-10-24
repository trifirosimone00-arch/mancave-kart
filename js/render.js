// Grafica 3D: pista di prova, kart, telecamere per riquadro, HUD stile Wii.
import * as THREE from 'three';
import { groundHeight, RAMP_LENGTH, obstaclesAt, locate, solidAt, loopPose } from './track.js';
import { MT_BLUE, MT_ORANGE, MAX_SPEED } from './sim.js';
import { LAMPO, LAMPO_MAX } from './minigames.js';
import { buildMancave } from './render-mancave.js';
import { buildMall } from './render-mall.js';
import { buildHot } from './render-hot.js';
import { buildGarden } from './render-garden.js';
import { buildRoma } from './render-roma.js';
import { buildKartModel } from './kart-model.js';
import { createCardFx } from './card-fx.js';
import { createArenaView } from './arena-render.js';

const TAG_LAYER0 = 1; // layer delle etichette nome: 1 + slot

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ mondo
function buildProva(scene, track, night = false) {
  const R = rng(7);
  const { pts, count, halfWidth: hw, wall } = track;

  // cielo a gradiente
  const skyGeo = new THREE.SphereGeometry(1800, 32, 16);
  const col = [];
  const top = new THREE.Color(night ? '#050a1e' : '#2f8fe0'), mid = new THREE.Color(night ? '#0e1a3e' : '#8fd2ff'), hor = new THREE.Color(night ? '#3a2a5a' : '#e6f6ff');
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 1800;
    const c = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : hor.clone().lerp(mid, Math.max(0, y / 0.25));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));

  // luci
  scene.add(new THREE.HemisphereLight(night ? '#6d7cff' : '#dff3ff', night ? '#14202a' : '#4f8f3a', night ? 0.55 : 1.25));
  const sun = new THREE.DirectionalLight(night ? '#9fb4ff' : '#fff4dc', night ? 0.7 : 1.6);   // di notte: la luna
  sun.position.set(-300, 500, -200);
  scene.add(sun);
  scene.userData.fog = new THREE.Fog(night ? '#0b1030' : '#d9f0ff', 260, 900);
  if (night) {
    // stelle e neon lungo la pista
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 900; i++) { const a = R() * Math.PI * 2, e = 0.12 + R() * 1.3; sp.push(Math.cos(a) * Math.cos(e) * 1700, Math.sin(e) * 1700, Math.sin(a) * Math.cos(e) * 1700); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 3, fog: false, sizeAttenuation: false })));
    addNeon(scene, track, 0);
  }

  // centro della pista
  let cx = 0, cz = 0;
  pts.forEach(p => { cx += p.x; cz += p.z; });
  cx /= count; cz /= count;
  track.center = { x: cx, z: cz };

  // prato a strisce
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5fbf47'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#56b23f'; g.fillRect(0, 0, w, h / 2);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(40,110,30,0.18)' : 'rgba(170,230,120,0.16)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
  }, true);
  grassTex.repeat.set(90, 90);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.02, cz);
  scene.add(ground);

  // asfalto
  const asphalt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5d6270'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const v = 70 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v + 4},${v + 14},0.35)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }, true);
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= count; i++) {
    const p = pts[i % count], s = i === count ? track.length : p.s;
    const y = Math.max(groundHeight(track, s, 0), 0) + 0.03;
    verts.push(p.x - p.rx * hw, y, p.z - p.rz * hw, p.x + p.rx * hw, y, p.z + p.rz * hw);
    uvs.push(0, s / 14, 1.3, s / 14);
    if (i < count) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const road = new THREE.BufferGeometry();
  road.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  road.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  road.setIndex(idx); road.computeVertexNormals();
  scene.add(new THREE.Mesh(road, new THREE.MeshLambertMaterial({ map: asphalt, side: THREE.DoubleSide })));

  // cordoli rossi e bianchi + muretto a gomme
  const strip = (inner, outer, yFn, colorFn, every) => {
    const v = [], c = [];
    for (let i = 0; i < count; i++) {
      const a = pts[i], b = pts[(i + 1) % count];
      const col = new THREE.Color(colorFn(Math.floor(i / every)));
      for (const side of [-1, 1]) {
        const ya = yFn(a.s, side), yb = yFn(b.s >= a.s ? b.s : track.length, side);
        const q = [
          [a.x + a.rx * side * inner, ya, a.z + a.rz * side * inner],
          [a.x + a.rx * side * outer, ya, a.z + a.rz * side * outer],
          [b.x + b.rx * side * inner, yb, b.z + b.rz * side * inner],
          [b.x + b.rx * side * outer, yb, b.z + b.rz * side * outer],
        ];
        for (const k of [0, 2, 1, 1, 2, 3]) { v.push(...q[k]); c.push(col.r, col.g, col.b); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  };
  scene.add(strip(hw, hw + 1.5, (s) => Math.max(groundHeight(track, s, 0), 0) + 0.06, (k) => (k % 2 ? '#ffffff' : '#e8322b'), 3));

  // muretto: pannelli verticali
  {
    const v = [], c = [];
    const H = 1.3;
    for (let i = 0; i < count; i++) {
      const a = pts[i], b = pts[(i + 1) % count];
      const col = new THREE.Color(Math.floor(i / 4) % 2 ? '#ffffff' : '#2f6fe0');
      for (const side of [-1, 1]) {
        const ax = a.x + a.rx * side * wall, az = a.z + a.rz * side * wall;
        const bx = b.x + b.rx * side * wall, bz = b.z + b.rz * side * wall;
        const q = [[ax, 0, az], [ax, H, az], [bx, 0, bz], [bx, H, bz]];
        for (const k of [0, 2, 1, 1, 2, 3]) { v.push(...q[k]); c.push(col.r, col.g, col.b); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }

  // rampa: superficie con frecce + fianchi a strisce
  {
    const arrows = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ffcc00'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ff6a00'; g.lineWidth = 34; g.lineJoin = 'round';
      for (const y0 of [70, 190]) { g.beginPath(); g.moveTo(40, y0 + 50); g.lineTo(128, y0 - 30); g.lineTo(216, y0 + 50); g.stroke(); }
    }, true);
    const stripes = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffcc00';
      for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 40, h); g.lineTo(i * 40 + 20, h); g.lineTo(i * 40 + 20 + h, 0); g.lineTo(i * 40 + h, 0); g.fill(); }
    }, true);
    const n = 12, v = [], u = [], id = [], sv = [], su = [], sid = [];
    for (let k = 0; k <= n; k++) {
      const s = track.rampStartS + (RAMP_LENGTH * k) / n;
      const i = Math.floor(s / track.ds) % count;
      const p = pts[i], y = groundHeight(track, s, 0) + 0.06;
      v.push(p.x - p.rx * hw, y, p.z - p.rz * hw, p.x + p.rx * hw, y, p.z + p.rz * hw);
      u.push(0, k / n * 2, 2, k / n * 2);
      if (k < n) { const a = k * 2; id.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      for (const side of [-1, 1]) {
        sv.push(p.x + p.rx * side * hw, y, p.z + p.rz * side * hw, p.x + p.rx * side * hw, 0, p.z + p.rz * side * hw);
        su.push(k / n * 3, y / 2.4, k / n * 3, 0);
      }
      if (k < n) {
        for (const off of [0, 2]) {
          const a = k * 4 + off, b = (k + 1) * 4 + off;
          sid.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    // retro della rampa (parete verticale)
    const last = sv.length / 3;
    const pe = pts[Math.floor((track.rampStartS + RAMP_LENGTH) / track.ds) % count];
    const ye = groundHeight(track, track.rampStartS + RAMP_LENGTH - 0.01, 0) + 0.06;
    sv.push(pe.x - pe.rx * hw, ye, pe.z - pe.rz * hw, pe.x - pe.rx * hw, 0, pe.z - pe.rz * hw,
      pe.x + pe.rx * hw, ye, pe.z + pe.rz * hw, pe.x + pe.rx * hw, 0, pe.z + pe.rz * hw);
    su.push(0, 1, 0, 0, 6, 1, 6, 0);
    sid.push(last, last + 2, last + 1, last + 1, last + 2, last + 3);
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    top.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    top.setIndex(id); top.computeVertexNormals();
    scene.add(new THREE.Mesh(top, new THREE.MeshLambertMaterial({ map: arrows, side: THREE.DoubleSide })));
    const sides = new THREE.BufferGeometry();
    sides.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    sides.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
    sides.setIndex(sid); sides.computeVertexNormals();
    scene.add(new THREE.Mesh(sides, new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide })));
  }

  // alberi (istanziati)
  {
    const N = 360;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 6), new THREE.MeshLambertMaterial({ color: '#8a5a33' }), N);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.4, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), N);
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 8, 7), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const greens = ['#2f9e44', '#3fb553', '#278c3a', '#57c25e', '#1f7a33'].map(c => new THREE.Color(c));
    let placed = 0, cones = 0, rounds = 0, tries = 0;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
    while (placed < N && tries < 20000) {
      tries++;
      const x = minX - 90 + R() * (maxX - minX + 180), z = minZ - 90 + R() * (maxZ - minZ + 180);
      let d = Infinity;
      for (let i = 0; i < count; i += 3) d = Math.min(d, (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2);
      if (d < (wall + 5) ** 2) continue;
      const s = 0.8 + R() * 0.7;
      ps.set(x, 1.5 * s, z); sc.set(s, s, s); q.identity();
      m.compose(ps, q, sc); trunk.setMatrixAt(placed, m);
      const c = greens[Math.floor(R() * greens.length)];
      if (R() < 0.5) {
        ps.set(x, 7 * s, z); m.compose(ps, q, sc); cone.setMatrixAt(cones, m); cone.setColorAt(cones, c); cones++;
      } else {
        ps.set(x, 5.3 * s, z); q.setFromEuler(new THREE.Euler(R(), R(), R())); m.compose(ps, q, sc);
        crown.setMatrixAt(rounds, m); crown.setColorAt(rounds, c); rounds++;
      }
      placed++;
    }
    trunk.count = placed; cone.count = cones; crown.count = rounds;
    scene.add(trunk, cone, crown);
  }

  // colline e nuvole in lontananza
  {
    const hillMat = new THREE.MeshLambertMaterial({ color: '#4c9a52', flatShading: true });
    const far = new THREE.MeshLambertMaterial({ color: '#7fae9a', flatShading: true });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + R() * 0.2, r = 560 + R() * 220;
      const h = new THREE.Mesh(new THREE.SphereGeometry(80 + R() * 90, 9, 6), i % 2 ? hillMat : far);
      h.scale.y = 0.45 + R() * 0.35;
      h.position.set(cx + Math.cos(a) * r, -10, cz + Math.sin(a) * r);
      scene.add(h);
    }
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#c9e6ff', emissiveIntensity: 0.35, fog: false });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(14 + R() * 10, 8, 6), cloudMat);
        s.position.set(k * 16 - 24, R() * 6, R() * 10);
        s.scale.y = 0.65;
        g.add(s);
      }
      const a = R() * Math.PI * 2, r = 300 + R() * 600;
      g.position.set(cx + Math.cos(a) * r, 140 + R() * 90, cz + Math.sin(a) * r);
      g.rotation.y = R() * 3;
      scene.add(g);
    }
  }

  // bandierine lungo il rettilineo di partenza
  {
    const cols = ['#e8322b', '#ffd400', '#2f6fe0', '#2ec46b'];
    for (let i = -12; i <= 12; i += 2) {
      const p = pts[(i * 4 + count) % count];
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 5), new THREE.MeshLambertMaterial({ color: '#dddddd' }));
        const x = p.x + p.rx * side * (wall + 2), z = p.z + p.rz * side * (wall + 2);
        pole.position.set(x, 3, z);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshLambertMaterial({ color: cols[(i / 2 + 12) % 4], side: THREE.DoubleSide }));
        flag.position.set(x + p.tx * 1.1, 5.2, z + p.tz * 1.1);
        flag.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI / 2;
        scene.add(pole, flag);
      }
    }
  }
}

// ------------------------------------------------------------------ parti comuni a tutte le piste: via, griglia, portali-carta, pit stop
function buildCommon(scene, track) {
  const { pts, count, halfWidth: hw } = track;
  // traguardo a scacchi + portale
  {
    const p0 = pts[0];
    const checker = canvasTex(256, 64, (g, w, h) => {
      const sq = 16;
      for (let x = 0; x < w / sq; x++) for (let y = 0; y < h / sq; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * sq, y * sq, sq, sq);
      }
    });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 3), new THREE.MeshLambertMaterial({ map: checker }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(p0.tx, p0.tz) + Math.PI / 2;
    line.position.set(p0.x, 0.06, p0.z);
    // rotazione corretta: allineo con il vettore destro
    line.rotation.set(-Math.PI / 2, 0, -Math.atan2(p0.rz, p0.rx));
    scene.add(line);

    const gate = new THREE.Group();
    const postMat = new THREE.MeshLambertMaterial({ color: '#d7dbe6' });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 1), postMat);
      post.position.set(side * (hw + 2), 4.5, 0);
      gate.add(post);
    }
    const banner = canvasTex(1024, 128, (g, w, h) => {
      g.fillStyle = '#e8322b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.font = '900 76px "Bungee", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#1a1a1a'; g.strokeText('MANCAVE KART', w / 2, h / 2 + 4);
      g.fillStyle = '#ffffff'; g.fillText('MANCAVE KART', w / 2, h / 2 + 4);
    });
    const bannerMesh = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 6, 2.4, 0.6),
      [postMat, postMat, postMat, postMat, new THREE.MeshLambertMaterial({ map: banner }), new THREE.MeshLambertMaterial({ map: banner })]);
    bannerMesh.position.set(0, 8.2, 0);
    gate.add(bannerMesh);
    gate.position.set(p0.x, 0, p0.z);
    gate.rotation.y = Math.atan2(p0.tx, p0.tz);
    scene.add(gate);
    track.bannerTex = banner;
    document.fonts?.ready.then(() => {
      const c = banner.image, g = c.getContext('2d'), w = c.width, h = c.height;
      g.fillStyle = '#e8322b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.font = '76px "Bungee", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#1a1a1a'; g.strokeText('MANCAVE KART', w / 2, h / 2 + 4);
      g.fillStyle = '#ffffff'; g.fillText('MANCAVE KART', w / 2, h / 2 + 4);
      banner.needsUpdate = true;
    });
  }

  // piazzole della griglia
  {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
    for (let g = 0; g < 4; g++) {
      const row = Math.floor(g / 2), side = g % 2 ? 1 : -1;
      const s = track.length - 8 - row * 7 - (side > 0 ? 3.5 : 0);
      const p = pts[Math.floor(s / track.ds) % count];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.35), mat);
      m.rotation.set(-Math.PI / 2, 0, -Math.atan2(p.rz, p.rx));
      m.position.set(p.x + p.rx * side * 4 + p.tx * 2.2, 0.07, p.z + p.rz * side * 4 + p.tz * 2.2);
      scene.add(m);
    }
  }

  // portali-carta: archi luminosi con una carta che gira
  track.portalMeshes = track.portalFractions.map((f) => {
    const p = pts[Math.floor((f * track.length) / track.ds) % count];
    const g = new THREE.Group();
    const glow = new THREE.MeshBasicMaterial({ color: '#ffd400' });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 0.6, 0.45, 8, 32, Math.PI), glow);
    arch.position.y = 0;
    g.add(arch);
    const cardTex = canvasTex(128, 176, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 16); c.fill();
      c.fillStyle = '#9b5cff'; c.beginPath(); c.roundRect(14, 14, w - 28, h - 28, 10); c.fill();
      c.fillStyle = '#ffd400'; c.font = '900 96px Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, h / 2 + 6);
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.3), new THREE.MeshBasicMaterial({ map: cardTex, side: THREE.DoubleSide, transparent: true }));
    card.position.y = hw - 1.2;
    g.add(card);
    g.position.set(p.x, groundHeight(track, f * track.length, 0), p.z);
    g.rotation.y = Math.atan2(p.tx, p.tz);
    scene.add(g);
    return { g, arch, card, glow };
  });

  // pit stop: portale a scacchi con l'insegna
  {
    const p = pts[Math.floor((track.pitFraction * track.length) / track.ds) % count];
    const g = new THREE.Group();
    const postMat = new THREE.MeshLambertMaterial({ color: '#2b2f45' });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8, 1.1), postMat);
      post.position.set(side * (hw + 1.5), 4, 0);
      g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd400' }));
      lamp.position.set(side * (hw + 1.5), 8.4, 0);
      g.add(lamp);
    }
    const sign = canvasTex(1024, 160, (c, w, h) => {
      const sq = 20;
      for (let x = 0; x < w / sq; x++) for (let y = 0; y < h / sq; y++) { c.fillStyle = (x + y) % 2 ? '#1a1a1a' : '#ffffff'; c.fillRect(x * sq, y * sq, sq, sq); }
      c.fillStyle = '#ffd400'; c.beginPath(); c.roundRect(150, 22, w - 300, h - 44, 18); c.fill();
      c.font = '900 84px "Bungee", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#1a1a1a'; c.fillText('PIT STOP', w / 2, h / 2 + 4);
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 4, 2.6, 0.5),
      [postMat, postMat, postMat, postMat, new THREE.MeshLambertMaterial({ map: sign }), new THREE.MeshLambertMaterial({ map: sign })]);
    board.position.set(0, 7, 0);
    g.add(board);
    g.position.set(p.x, groundHeight(track, track.pitFraction * track.length, 0), p.z);
    g.rotation.y = Math.atan2(p.tx, p.tz);
    scene.add(g);
  }

}

function buildWorld(root, track, night = false) {
  if (track.id === 'mancave') buildMancave(root, track, { night });
  else if (track.id === 'mall') buildMall(root, track, { night });
  else if (track.id === 'hot') buildHot(root, track, { night });
  else if (track.id === 'garden') buildGarden(root, track, { night });
  else if (track.id === 'roma') buildRoma(root, track, { night });
  else buildProva(root, track, night);
  buildCommon(root, track);
}

// foto del kart (per la lobby): un piccolo renderer a parte, una sola volta per colore
let thumbR = null;
const thumbCache = new Map();
export function kartThumb(slot, color) {
  const key = slot + color;
  if (thumbCache.has(key)) return thumbCache.get(key);
  try {
    if (!thumbR) {
      thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbR.setSize(240, 160, false); thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping;
    }
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#ffffff', '#556', 1.1));
    const d = new THREE.DirectionalLight('#fff', 2.4); d.position.set(-4, 6, 5); sc.add(d);
    const m = buildKartModel(slot, color);
    m.body.rotation.y = 0.65; sc.add(m.body);
    const cam = new THREE.PerspectiveCamera(30, 1.5, 0.1, 100); cam.position.set(0, 3.4, 7.2); cam.lookAt(0, 1.3, 0);
    thumbR.render(sc, cam);
    const url = thumbR.domElement.toDataURL('image/png');
    thumbCache.set(key, url);
    return url;
  } catch (e) { return null; }
}

// strisce al neon ai bordi della pista (di notte)
export function addNeon(scene, track, baseY = 0) {
  const { pts, count, halfWidth: hw } = track;
  const H = (i) => (track.hs ? track.hs[(i + count) % count] : 0) + baseY;
  for (const [lat, col] of [[-(hw + 0.5), '#ff3dbb'], [hw + 0.5, '#29e6ff']]) {
    const v = [], id = [];
    for (let i = 0; i <= count; i++) {
      const p = pts[i % count], y = H(i % count) + 0.13;
      if (track.step && track.step[i % count]) { v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * (lat + Math.sign(lat) * 0.5), y, p.z + p.rz * (lat + Math.sign(lat) * 0.5)); continue; }
      v.push(p.x + p.rx * lat, y, p.z + p.rz * lat, p.x + p.rx * (lat + Math.sign(lat) * 0.5), y, p.z + p.rz * (lat + Math.sign(lat) * 0.5));
      if (i > 0 && !(track.step && track.step[i % count])) { const a = (i - 1) * 2; id.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(id);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 }));
    m.userData.noShadow = true;
    scene.add(m);
  }
}

// ------------------------------------------------------------------ kart
function nameSprite(name, color, photo = null) {
  // etichetta col nome; se c'è il selfie, la faccia in un cerchio sopra il nome
  const H = photo ? 160 : 64;
  const pill = (g, w, y0) => {
    g.font = '900 34px "Nunito", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(w - 8, g.measureText(name).width + 34);
    g.fillStyle = 'rgba(14,18,34,0.78)';
    g.beginPath(); g.roundRect((w - tw) / 2, y0 + 8, tw, 48, 20); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc((w - tw) / 2 + 18, y0 + 32, 7, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(name, w / 2 + 8, y0 + 34);
  };
  const tex = canvasTex(256, H, (g, w) => pill(g, w, H - 64));
  if (photo) {
    const img = new Image();
    img.onload = () => {
      const c = tex.image, g = c.getContext('2d');
      g.save(); g.beginPath(); g.arc(128, 50, 46, 0, 7); g.clip(); g.drawImage(img, 82, 4, 92, 92); g.restore();
      g.lineWidth = 7; g.strokeStyle = color; g.beginPath(); g.arc(128, 50, 46, 0, 7); g.stroke();
      tex.needsUpdate = true;
    };
    img.src = photo;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(5, 5 * H / 256, 1);
  sp.renderOrder = 10;
  return sp;
}

function makeKart(slot, name, color, photo = null) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const metal = new THREE.MeshStandardMaterial({ color: '#dfe3ea', roughness: 0.2, metalness: 1 });
  const model = buildKartModel(slot, color);
  body.add(model.body);
  const wheels = model.wheels;
  // scarichi e fiamma del turbo
  const flames = [];
  for (const x of [-0.45, 0.45]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 8), metal);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(x, 1.15, -2.2); body.add(pipe);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 8), new THREE.MeshBasicMaterial({ color: '#ff9a1f', transparent: true, opacity: 0.9 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(x, 1.15, -3.1); fl.visible = false;
    body.add(fl); flames.push(fl);
  }
  // scintille della derapata
  const sparks = [];
  for (const x of [-1.3, 1.3]) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }));
    sp.position.set(x, 0.25, -1.6); sp.visible = false; body.add(sp); sparks.push(sp);
  }
  // ombra
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 1.35, 1);
  // etichetta nome
  const tag = nameSprite(name, color, photo);
  tag.position.set(0, photo ? 4.9 : 4.1, 0);
  tag.layers.set(TAG_LAYER0 + slot);
  root.add(tag);
  // scudo (bolla) e bomba sopra la testa
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.7, 18, 12), new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.y = 1.3; shield.visible = false; root.add(shield);
  const bomb = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), new THREE.MeshLambertMaterial({ color: '#1b1b1b' }));
  const fuse = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b30' }));
  fuse.position.y = 0.75; bomb.add(ball, fuse); bomb.position.y = 3.4; bomb.visible = false; root.add(bomb);
  const mats = [];
  body.traverse(o => { if (o.material && !o.material.transparent && !mats.includes(o.material)) mats.push(o.material); });
  return { root, body, wheels, flames, sparks, shadow, tag, color, name, spin: 0, shield, bomb, fuse, mats, ghost: false };
}

// ------------------------------------------------------------------ renderer
export function createRenderer(canvas, hudRoot, track) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // risoluzione adattiva: parte da 1 (non oltre lo schermo) e scende se il PC fatica
  const MAX_PR = Math.min(window.devicePixelRatio || 1, 1);
  const STEPS = [1, 0.85, 0.7, 0.55];
  let prStep = 0;
  renderer.setPixelRatio(MAX_PR * STEPS[prStep]);
  const perf = { frames: 0, time: 0, fps: 60, slowFor: 0, fastFor: 0 };
  function adapt(dt) {
    perf.frames++; perf.time += dt;
    if (perf.time < 1) return;
    perf.fps = perf.frames / perf.time; perf.frames = 0; perf.time = 0;
    if (perf.fps < 45) { perf.slowFor++; perf.fastFor = 0; } else if (perf.fps > 57) { perf.fastFor++; perf.slowFor = 0; } else { perf.slowFor = 0; perf.fastFor = 0; }
    if (perf.slowFor >= 2 && prStep < STEPS.length - 1) { prStep++; renderer.setPixelRatio(MAX_PR * STEPS[prStep]); perf.slowFor = 0; }
    if (perf.fastFor >= 8 && prStep > 0) { prStep--; renderer.setPixelRatio(MAX_PR * STEPS[prStep]); perf.fastFor = 0; }
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ombre statiche: si calcolano una volta quando si costruisce la pista
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  let world = new THREE.Group();
  let night = false;
  buildWorld(world, track, night);
  scene.add(world);
  const cfx = createCardFx(scene);
  const arena = createArenaView(scene, cfx);
  const arenaCam = new THREE.PerspectiveCamera(50, 16 / 9, 1, 3000);
  arenaCam.layers.enable(0);
  for (let s = 0; s < 8; s++) arenaCam.layers.enable(TAG_LAYER0 + s);
  applyLook();
  // aspetto della pista: nebbia, tone mapping, riflessi, sfondo
  function applyLook() {
    const u = world.userData;
    scene.fog = u.fog || null;
    scene.background = u.background || null;
    renderer.toneMapping = u.toneMapping || THREE.NoToneMapping;
    renderer.toneMappingExposure = u.exposure || 1;
    if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
    if (u.makeEnv) scene.environment = u.makeEnv(renderer, !!u.night);
    renderer.shadowMap.needsUpdate = true;
    u.refresh = () => { renderer.shadowMap.needsUpdate = true; };
  }
  // cambio pista: butto via il mondo vecchio e costruisco il nuovo
  function setTrack(t, nightOn = night) {
    night = !!nightOn;
    scene.remove(world);
    world.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
    });
    track = t;
    world = new THREE.Group();
    buildWorld(world, track, night);
    scene.add(world);
    applyLook();
    bounds = computeBounds();
    views.forEach(v => { v.mapBase = null; v.init = false; v.init2 = false; });
    for (const kind of Object.keys(pool)) { for (const m of pool[kind].values()) scene.remove(m); pool[kind].clear(); }
  }

  const karts = new Map();
  let snapPhotos = {};
  let layout = [];        // [{slot}] per riquadro
  let views = [];         // stato per riquadro
  let mapBase = null;
  let lastSig = '';

  // minimappa: percorso disegnato una volta
  function computeBounds() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    track.pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
    return { minX, maxX, minZ, maxZ };
  }
  let bounds = computeBounds();
  function mapXY(x, z, size) {
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.12;
    const ox = (bounds.minX + bounds.maxX) / 2, oz = (bounds.minZ + bounds.maxZ) / 2;
    // specchio orizzontale: la "destra" del mondo è -x
    return [size / 2 - (x - ox) / span * size, size / 2 - (z - oz) / span * size];
  }
  function drawMapBase(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    track.pts.forEach((p, i) => { const [x, y] = mapXY(p.x, p.z, size); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = size * 0.07; g.stroke();
    g.strokeStyle = 'rgba(70,78,98,0.95)'; g.lineWidth = size * 0.045; g.stroke();
    const p0 = track.pts[0]; const [sx, sy] = mapXY(p0.x, p0.z, size);
    g.fillStyle = '#fff'; g.fillRect(sx - size * 0.03, sy - size * 0.012, size * 0.06, size * 0.024);
    if (track.rampStartS >= 0) {
      const pr = track.pts[Math.floor(track.rampStartS / track.ds)]; const [rx, ry] = mapXY(pr.x, pr.z, size);
      g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(rx, ry, size * 0.022, 0, 7); g.fill();
    }
    return c;
  }

  function ensureKart(k) {
    let m = karts.get(k.slot);
    if (!m || m.name !== k.name || m.color !== k.color || m.photo !== (snapPhotos[k.slot] || null)) {
      if (m) { scene.remove(m.root, m.shadow); }
      m = makeKart(k.slot, k.name, k.color, snapPhotos[k.slot] || null);
      m.photo = snapPhotos[k.slot] || null;
      cfx.attachKart(m);
      scene.add(m.root, m.shadow);
      karts.set(k.slot, m);
    }
    return m;
  }

  function buildHud(n) {
    hudRoot.innerHTML = '';
    views = layout.map((v, i) => {
      const el = document.createElement('div');
      el.className = 'view';
      el.innerHTML = `
        <div class="v-place"><span class="num"></span><span class="suf"></span></div>
        <div class="v-top"><div class="v-lap"></div><div class="v-time"></div></div>
        <canvas class="v-map"></canvas>
        <div class="v-center"></div>
        <div class="v-msg"></div>
        <div class="v-mt"><i></i><i></i><i></i></div>
        <div class="v-label"></div>
        <div class="v-fog"></div>
        <div class="v-fx"></div>
        <div class="v-rank"></div>
        <div class="v-meters"><div class="vm-card"></div><div class="vm-pit"></div></div>
        <div class="v-mirror"></div>
        <div class="v-hit"></div>
        <div class="v-police"></div>
        <div class="v-rewind"><b>⏪</b><span>RALLENTATORE</span></div>
        <div class="v-call"><div class="vc-top">Chiamata in arrivo…</div><div class="vc-name"></div><div class="vc-sub">rifiuta dal telefono!</div><div class="vc-btns"><i class="no">✕</i><i class="yes">✆</i></div></div>
        <div class="v-big"></div>
        <div class="v-lampo"><small>MINIGIOCO LAMPO</small><b></b><span>sul telefono · chi finisce riparte subito</span></div>`;
      hudRoot.appendChild(el);
      const cam = new THREE.PerspectiveCamera(72, 1, 0.3, 2500);
      cam.layers.enable(0);
      for (let s = 0; s < 8; s++) if (s !== v.slot) cam.layers.enable(TAG_LAYER0 + s);
      return {
        el, cam, slot: v.slot, init: false,
        pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, fov: 72,
        place: el.querySelector('.v-place'), num: el.querySelector('.num'), suf: el.querySelector('.suf'),
        lap: el.querySelector('.v-lap'), time: el.querySelector('.v-time'), map: el.querySelector('.v-map'),
        center: el.querySelector('.v-center'), msg: el.querySelector('.v-msg'), mt: el.querySelector('.v-mt'),
        label: el.querySelector('.v-label'), msgUntil: 0, lastLap: -1, lastPlace: 0,
        fog: el.querySelector('.v-fog'), fx: el.querySelector('.v-fx'),
        rank: el.querySelector('.v-rank'), mCard: el.querySelector('.vm-card'), mPit: el.querySelector('.vm-pit'),
        lampo: el.querySelector('.v-lampo'), lampoOn: false,
        police: el.querySelector('.v-police'), rewind: el.querySelector('.v-rewind'), call: el.querySelector('.v-call'), big: el.querySelector('.v-big'), bigUntil: 0,
        mirrorEl: el.querySelector('.v-mirror'), hit: el.querySelector('.v-hit'), hitUntil: 0, rankSig: '', prevPlaces: {}, arrows: {},
        mcam: (() => { const c = new THREE.PerspectiveCamera(60, 3, 0.3, 2500); c.layers.enable(0); for (let s = 0; s < 8; s++) if (s !== v.slot) c.layers.enable(TAG_LAYER0 + s); return c; })(),
      };
    });
    hudRoot.dataset.n = String(n);
    feedEl = document.createElement('div');
    feedEl.className = 'feed';
    hudRoot.appendChild(feedEl);
  }
  let feedEl = null, feedSig = '';

  // oggetti delle carte sulla pista (olio, missili): li riuso
  const pool = { oil: new Map(), missile: new Map() };
  // pozza d'olio nera e lucida, dal bordo irregolare
  const oilGeo = (() => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2, r = 2.3 * (1 + 0.16 * Math.sin(a * 3 + 1) + 0.09 * Math.sin(a * 7) + 0.05 * Math.sin(a * 11));
      if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ShapeGeometry(sh, 24);
  })();
  const oilMat = new THREE.MeshPhysicalMaterial({ color: '#07070a', roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  // razzo: corpo bianco e rosso, punta, alette e fiamma (la scia di fumo la fanno le particelle)
  function makeMissile() {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.3, metalness: 0.2 });
    const red = new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.3, metalness: 0.2 });
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.0, 16), white); bodyM.rotation.x = Math.PI / 2;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.35, 16), red); band.rotation.x = Math.PI / 2; band.position.z = 0.35;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 16), red); nose.rotation.x = Math.PI / 2; nose.position.z = 1.45;
    g.add(bodyM, band, nose);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.6), red);
      const a = i * Math.PI / 2; fin.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.8); fin.rotation.z = a; g.add(fin);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.3, 10), new THREE.MeshBasicMaterial({ color: '#ffb300' }));
    flame.rotation.x = -Math.PI / 2; flame.position.z = -1.65;
    g.add(flame);
    return g;
  }
  // macchina della polizia (carta Inseguimento) con le luci che lampeggiano
  function makePolice() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3), new THREE.MeshLambertMaterial({ color: '#f5f7fb' }));
    body.position.y = 0.55;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.25, 2.2), new THREE.MeshLambertMaterial({ color: '#1565c0' }));
    stripe.position.y = 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.4), new THREE.MeshLambertMaterial({ color: '#263238' }));
    cab.position.set(0, 1.15, -0.2);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: '#ff1744' }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: '#2979ff' }));
    red.position.set(-0.3, 1.55, -0.2); blue.position.set(0.3, 1.55, -0.2);
    g.add(body, stripe, cab, red, blue);
    g.userData.lights = [red, blue];
    return g;
  }
  // altezza del terreno sotto un oggetto (sulle piste con mobili da scalare)
  function groundAt(o, x, z) {
    if (!track.hs) return 0;
    const l = locate(track, x, z, o.userData.gIdx ?? -1);
    o.userData.gIdx = l.idx;
    return groundHeight(track, l.s, l.lat);
  }
  // ---- vista doppia dello Sbronzo
  const drunkRT = new THREE.WebGLRenderTarget(640, 360, { colorSpace: THREE.SRGBColorSpace });
  const ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const ovMat = new THREE.MeshBasicMaterial({ map: drunkRT.texture, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false, toneMapped: false });
  const ovScene = new THREE.Scene(); ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ovMat));
  const ghostCam = new THREE.PerspectiveCamera();
  function drunkPass(v, k, x, y, w, h, H, tsec) {
    const wob = Math.min(1, k.drunkT);
    ghostCam.copy(v.cam);
    const off = (0.9 + Math.sin(tsec * 1.7) * 0.5) * wob;
    ghostCam.translateX(off); ghostCam.rotateY(-0.012 * wob); ghostCam.updateProjectionMatrix();
    ghostCam.layers.mask = v.cam.layers.mask;
    renderer.setScissorTest(false);
    renderer.setRenderTarget(drunkRT);
    renderer.render(scene, ghostCam);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(true);
    renderer.setViewport(x, H - y - h, w, h);
    renderer.setScissor(x, H - y - h, w, h);
    ovMat.color.setHSL((tsec * 0.35) % 1, 1, 0.72);   // colori che cambiano: rosa, verde, azzurro...
    ovMat.opacity = 0.42 * wob;
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.render(ovScene, ovCam);
    renderer.autoClear = ac;
  }
  function syncPool(kind, list, make, place) {
    const seen = new Set();
    for (const it of list || []) {
      let m = pool[kind].get(it.id);
      if (!m) { m = make(it); scene.add(m); pool[kind].set(it.id, m); }
      place(m, it); seen.add(it.id);
    }
    for (const [id, m] of pool[kind]) if (!seen.has(id)) { scene.remove(m); pool[kind].delete(id); }
  }

  function rects(n, W, H) {
    if (n <= 1) return [[0, 0, W, H]];
    if (n === 2) return [[0, 0, W, H / 2], [0, H / 2, W, H / 2]];
    return [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2]];
  }

  function fmt(t) {
    if (!(t >= 0)) t = 0;
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
  }

  function flash(v, text, ms, cls = '') {
    v.msg.textContent = text; v.msg.className = 'v-msg show ' + cls;
    v.msgUntil = performance.now() + ms;
  }

  // classifica dal vivo in alto a sinistra, con triangolo verde/rosso quando si sale o si scende
  function drawRank(v, snap, now) {
    const list = [...snap.karts].sort((a, b) => a.place - b.place);
    for (const q of list) {
      const prev = v.prevPlaces[q.slot];
      if (prev && prev !== q.place) v.arrows[q.slot] = { up: q.place < prev, until: now + 2500 };
      v.prevPlaces[q.slot] = q.place;
    }
    const sig = list.map(q => {
      const a = v.arrows[q.slot] && v.arrows[q.slot].until > now ? (v.arrows[q.slot].up ? 'u' : 'd') : '';
      return `${q.slot}:${q.place}:${a}:${q.name}:${q.color}:${snap.photoVer || 0}`;
    }).join('|');
    if (sig === v.rankSig) return;
    v.rankSig = sig;
    v.rank.innerHTML = '';
    for (const q of list) {
      const a = v.arrows[q.slot] && v.arrows[q.slot].until > now ? (v.arrows[q.slot].up ? 'up' : 'down') : '';
      const row = document.createElement('div');
      row.className = 'vr' + (q.slot === v.slot ? ' me' : '');
      row.innerHTML = '<b></b><i></i><span></span><em></em>';
      row.querySelector('b').textContent = q.place;
      const ph = snap.photos && snap.photos[q.slot];
      const dot = row.querySelector('i');
      dot.style.background = q.color;
      if (ph) { dot.classList.add('ph'); dot.style.backgroundImage = `url(${ph})`; dot.style.borderColor = q.color; }
      row.querySelector('span').textContent = q.name;
      const em = row.querySelector('em');
      if (a) { em.className = a; em.textContent = a === 'up' ? '▲' : '▼'; }
      v.rank.appendChild(row);
    }
  }
  // metri al prossimo arco delle carte e al pit stop (in alto a destra)
  function drawMeters(v, snap, k) {
    const L = track.length;
    let best = Infinity, lit = true;
    track.portalFractions.forEach((f, i) => {
      const d = (f * L - k.s + L) % L;
      if (d < best) { best = d; lit = !snap.portals || snap.portals[i] !== false; }
    });
    const ct = `Carta ${Math.round(best)} m`;
    if (v.mCard.textContent !== ct) v.mCard.textContent = ct;
    v.mCard.classList.toggle('off', !lit);
    let pt = '';
    if (snap.pitAt != null && !k.finished) {
      const d = snap.pitAt - ((k.lapCount - 1) * L + k.s);
      if (d > 0) pt = `Pit stop ${Math.round(d)} m`;
    }
    if (v.mPit.textContent !== pt) v.mPit.textContent = pt;
    v.mPit.style.display = pt ? '' : 'none';
  }
  // "COLPITO: nome" / "COLPITO DA nome"
  function drawHits(v, snap, now) {
    for (const n of snap.notes || []) {
      if (n.slot !== v.slot || (v.seenNotes || (v.seenNotes = new Set())).has(n.id)) continue;
      v.seenNotes.add(n.id);
      if (n.cls === 'big') {   // scritta grande della carta che ti ha colpito
        v.big.textContent = n.text; v.big.className = 'v-big'; void v.big.offsetWidth; v.big.className = 'v-big show k-' + (n.kind || '');
        v.bigUntil = now + 1500; continue;
      }
      v.hit.textContent = n.text;
      v.hit.className = 'v-hit show ' + (n.cls || '');
      v.hitUntil = now + 1800;
    }
    if (now > v.hitUntil && v.hit.classList.contains('show')) v.hit.className = 'v-hit';
    if (now > v.bigUntil && v.big.classList.contains('show')) v.big.className = 'v-big';
  }

  // snap: stato di gioco; slots: array di slot (o -1) per riquadro
  let lastPhase = '';
  function render(snap, slots, dt) {
    adapt(dt);
    if (snap.phase !== lastPhase) {
      if (snap.phase === 'intro') views.forEach(v => { v.msgUntil = 0; v.lastLap = -1; v.lastPlace = 0; v.finishedShown = false; v.msg.className = 'v-msg'; v.init = false; });
      lastPhase = snap.phase;
    }
    if (!!snap.night !== night && snap.trackId === track.id) setTrack(track, !!snap.night);
    const sig = slots.join(',');
    if (sig !== lastSig) { layout = slots.map(s => ({ slot: s })); buildHud(slots.length); lastSig = sig; }
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) {
      renderer.setSize(W, H, false);
    }
    const now = performance.now();
    const tsec = now / 1000;

    // minigioco col kart: si gioca nell'arena, con una sola telecamera che inquadra tutto
    const arenaOn = !!(snap.pit && snap.pit.kart && snap.pit.ka && ['intro', 'count', 'play', 'tie'].includes(snap.pit.stage));
    // aggiorna i kart
    snapPhotos = snap.photos || {};
    const present = new Set();
    for (const k of snap.karts) {
      present.add(k.slot);
      const m = ensureKart(k);
      m.root.position.set(k.x, k.y + (k.hop > 0 ? Math.sin((k.hop / 0.18) * Math.PI) * 0.5 : 0), k.z);
      // giro della morte (pista Hot Wheels): il kart si vede sull'anello, girato col muso verso l'alto
      const lpk = !arenaOn && track.loops && track.loops.length ? loopPose(track, k.s, k.x, k.y, k.z) : null;
      m.root.rotation.order = 'YXZ';
      if (lpk) { m.root.position.set(lpk.x, lpk.y, lpk.z); m.root.rotation.x = -lpk.pitch; } else m.root.rotation.x = 0;
      // curve sopraelevate: il kart si inclina con la pista
      const bki = track.bank && !arenaOn ? track.bank[Math.floor(((k.s % track.length) + track.length) % track.length / track.ds) % track.count] : 0;
      m.root.rotation.z += ((bki ? Math.atan(bki) : 0) - m.root.rotation.z) * Math.min(1, dt * 8);
      m.loopPose = lpk;
      const driftAngle = k.drifting ? k.driftDir * -0.42 : 0;
      m.root.rotation.y = k.yaw;
      m.body.rotation.y += ((driftAngle) - m.body.rotation.y) * Math.min(1, dt * 10);
      m.body.rotation.z = k.drifting ? k.driftDir * 0.08 : 0;
      // acrobazia: giro su se stessi
      if (k.trickT > 0) m.spin = Math.min(1, m.spin + dt * 2.4); else if (!k.air) m.spin = 0;
      m.body.rotation.x = k.air && !(k.trickT > 0) && m.spin === 0 ? -Math.max(-0.3, Math.min(0.3, k.vy * 0.03)) : 0;
      if (m.spin > 0 && m.spin < 1) m.body.rotation.z = m.spin * Math.PI * 2;
      if (k.spinT > 0) m.body.rotation.y = (tsec * 14) % (Math.PI * 2);
      m.wheels.forEach(w => { w.rotation.x += k.speed * dt * 2; });
      // ombra
      const gnd = arenaOn ? 0 : Math.max(0, groundHeight(track, k.s, k.lat));
      m.shadow.position.set(k.x, gnd + 0.08, k.z);
      m.shadow.visible = (!arenaOn || k.y > -1) && !lpk;
      m.shadow.rotation.z = k.yaw;
      const air = Math.max(0, k.y - gnd);
      m.shadow.material.opacity = Math.max(0.08, 0.28 - air * 0.03);
      // turbo
      const boosting = k.boostT > 0;
      m.flames.forEach((f, i) => {
        f.visible = boosting;
        if (boosting) {
          const s = 1.35 + Math.sin(tsec * 40 + i) * 0.35;
          f.scale.set(s, s * (k.boostKind === 'orange' || k.boostKind === 'start' ? 1.8 : 1.3), s);
          f.material.color.set(k.boostKind === 'blue' ? '#4fc3ff' : '#ff9a1f');
        }
      });
      // effetti delle carte
      m.shield.visible = false;
      cfx.updateKart(m, k, tsec, dt);
      m.bomb.visible = k.bombT > 0;
      if (m.bomb.visible) m.fuse.visible = Math.sin(tsec * (k.bombT < 3 ? 30 : 12)) > 0;
      const ghost = k.ghostT > 0 || (arenaOn && snap.pit.ka.out[k.slot] != null);
      if (ghost !== m.ghost) {
        m.mats.forEach(mt => { mt.transparent = ghost; mt.opacity = ghost ? 0.35 : 1; mt.needsUpdate = true; });
        m.ghost = ghost;
      }
      const sc0 = arenaOn ? 1.25 : k.miniT > 0 ? 0.6 : 1;
      m.root.scale.setScalar(m.root.scale.x + (sc0 - m.root.scale.x) * Math.min(1, dt * 8));
      // scintille
      const showSparks = k.drifting && k.driftT > 0.2;
      const sc = k.driftCharge >= MT_ORANGE ? '#ff8a00' : k.driftCharge >= MT_BLUE ? '#3fb8ff' : '#fff7c2';
      m.sparks.forEach((sp, i) => {
        sp.visible = showSparks && (k.driftCharge >= MT_BLUE || Math.sin(tsec * 50 + i * 2) > 0);
        sp.material.color.set(sc);
        const s = k.driftCharge >= MT_BLUE ? 1 + Math.sin(tsec * 45 + i) * 0.35 : 0.6;
        sp.scale.set(s, s, s);
      });
    }
    for (const [slot, m] of karts) if (!present.has(slot)) { scene.remove(m.root, m.shadow); karts.delete(slot); }
    // effetti delle carte (icone, esplosioni, teletrasporto...) e particelle
    if (snap.phase === 'race' || snap.phase === 'finish') cfx.cardEvents(snap, karts, (e) => onEvent(e));
    // aspirapolvere e gatto
    if (track.animate) track.animate(snap.raceTime || tsec, tsec);
    if (track.obstacleMeshes) {
      const obs = obstaclesAt(track, snap.raceTime || tsec);
      for (const [kind, mesh] of Object.entries(track.obstacleMeshes)) {
        const o = obs.find(q => q.kind === kind);
        mesh.visible = !!o;
        if (o) { mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.yaw + (kind === 'vacuum' ? tsec * 2 : 0); }
      }
    }

    // portali: accesi se si può pescare
    (track.portalMeshes || []).forEach((pm, i) => {
      const ready = !snap.portals || snap.portals[i] !== false;
      pm.card.visible = ready;
      pm.card.rotation.y = tsec * 2.5;
      pm.glow.color.set(ready ? '#ffd400' : '#6b7080');
    });
    syncPool('oil', snap.hazards, () => { const o = new THREE.Mesh(oilGeo, oilMat); o.rotation.x = -Math.PI / 2; o.scale.setScalar(1.4); return o; },
      (o, h) => o.position.set(h.x, groundAt(o, h.x, h.z) + 0.1, h.z));
    syncPool('missile', snap.missiles, (it) => (it.kind === 'police' ? makePolice() : makeMissile()), (o, m) => {
      if (m.kind === 'police') {
        o.position.set(m.x, groundAt(o, m.x, m.z), m.z); o.rotation.y = m.yaw;
        const on = Math.sin(tsec * 18) > 0;
        o.userData.lights[0].visible = on; o.userData.lights[1].visible = !on;
      } else { o.position.set(m.x, groundAt(o, m.x, m.z) + 1.1, m.z); o.rotation.y = m.yaw; }
    });
    // scia di fumo dei missili
    for (const [id, o] of pool.missile) if (!o.userData.lights && Math.random() < dt * 45) {
      const fx = Math.sin(o.rotation.y), fz = Math.cos(o.rotation.y);
      cfx.emit(o.position.x - fx * 1.4, o.position.y, o.position.z - fz * 1.4, { vy: 0.6, life: 1.1, s0: 0.9, s1: 3.4, color: '#cfcfcf', a: 0.6, drag: 1 });
      cfx.emit(o.position.x - fx * 1.2, o.position.y, o.position.z - fz * 1.2, { life: 0.18, s0: 1.2, s1: 0.3, color: '#ffb340', a: 1, drag: 0 });
    }
    cfx.setScale(H); cfx.update(dt);
    if (feedEl) {
      const fs = (snap.feed || []).join('|');
      if (fs !== feedSig) {
        feedSig = fs;
        feedEl.innerHTML = '';
        for (const t of snap.feed || []) { const d = document.createElement('div'); d.textContent = t; feedEl.appendChild(d); }
      }
    }

    if (arena.update(snap, snap.karts.map(k => ({ slot: k.slot, color: k.color, name: k.name })), karts, dt, tsec)) {
      hudRoot.classList.add('arena-on');
      if (!arena.lit) { arena.lit = true; renderer.shadowMap.needsUpdate = true; }
      for (const m of karts.values()) m.tag.visible = true;
      arena.placeCamera(arenaCam, W / H, tsec);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
      // l'arena è all'aperto sotto la luce della stanza: abbasso un po' l'esposizione per colori più pieni
      const ex = renderer.toneMappingExposure, fog = scene.fog;
      renderer.toneMappingExposure = ex * 0.8; scene.fog = null;
      renderer.render(scene, arenaCam);
      renderer.toneMappingExposure = ex; scene.fog = fog;
      return;
    }
    if (hudRoot.classList.contains('arena-on')) { hudRoot.classList.remove('arena-on'); arena.lit = false; renderer.shadowMap.needsUpdate = true; }
    const rs = rects(slots.length, W, H);
    renderer.setScissorTest(true);
    views.forEach((v, i) => {
      const [x, y, w, h] = rs[i] || [0, 0, 1, 1];
      v.el.style.left = (x / W * 100) + '%'; v.el.style.top = (y / H * 100) + '%';
      v.el.style.width = (w / W * 100) + '%'; v.el.style.height = (h / H * 100) + '%';
      v.cam.aspect = w / h;
      const k = snap.karts.find(q => q.slot === v.slot);

      // ---- telecamera
      if (snap.phase === 'intro' || snap.phase === 'lobby' || !k) {
        const u = snap.phase === 'intro' ? (snap.introT || 0) : (tsec * 0.02) % 1;
        const L = track.length;
        const sCam = (L * 0.08 + u * L * 0.95) % L;
        const p = track.pts[Math.floor(sCam / track.ds) % track.count];
        const q = track.pts[Math.floor(((sCam + 45) % L) / track.ds) % track.count];
        const hp = track.hs ? track.hs[Math.floor(sCam / track.ds) % track.count] : 0, hq = track.hs ? track.hs[Math.floor(((sCam + 45) % L) / track.ds) % track.count] : 0;
        v.cam.position.set(p.x - p.rx * 30, 26 + Math.max(0, hp), p.z - p.rz * 30);
        v.cam.lookAt(q.x, 2 + Math.max(0, hq), q.z);
        v.init = false;
      } else if (karts.get(v.slot) && karts.get(v.slot).loopPose) {
        // giro della morte: inquadratura da fuori, di lato all'anello
        const lp = karts.get(v.slot).loopPose, L = lp.L, a = track.pts[L.i0];
        const len = L.s1 - L.s0, cx = a.x + L.fx * len * 0.5, cz = a.z + L.fz * len * 0.5, cy = track.hs[L.i0] + L.R;
        v.cam.position.set(cx - a.rx * L.R * 3.4 - L.fx * L.R * 0.8, cy + L.R * 0.4, cz - a.rz * L.R * 3.4 - L.fz * L.R * 0.8);
        v.cam.up.set(0, 1, 0);
        v.cam.lookAt(lp.x, lp.y, lp.z);
        v.cam.fov = 62;
        v.init = false;
      } else {
        const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
        if (!v.init) { v.yaw = k.yaw; v.init = true; }
        let d = k.yaw - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        v.yaw += d * Math.min(1, dt * 5.5);
        const cx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
        // telecamera alta e indietro: il kart sta piccolo in basso e si vede tanta strada davanti
        const back = snap.phase === 'finish' && k.finished ? 12 : 9.6;
        // la telecamera segue l'altezza del kart (mobili, salti) senza scatti
        if (v.camY == null || !v.init2) { v.camY = k.y; v.init2 = true; }
        v.camY += (k.y - v.camY) * Math.min(1, dt * (k.y > v.camY ? 8 : 4));
        const camY = v.camY + 4.7;
        v.cam.position.set(k.x - cx * back, camY, k.z - cz * back);
        // la telecamera non entra nelle barriere: se dietro c'è un muro (curve strette) si avvicina al kart e sale un po'
        {
          const lim = track.wall - 1.2;
          const out = (t) => {
            const x = k.x - cx * back * t, z = k.z - cz * back * t;
            let l = locate(track, x, z, v.camIdx ?? -1);
            if (Math.abs(l.lat) > track.wall * 2) l = locate(track, x, z, -1);
            v.camIdx = l.idx;
            if (Math.abs(l.lat) > lim) return true;
            // ...e non entra nei mobili
            const cy = camY + (1 - t) * 3;
            return solidAt(track, x, z, cy - 1.2, cy + 1.2);
          };
          let t = 1;
          if (out(1)) { for (const tt of [0.85, 0.7, 0.55, 0.4]) { t = tt; if (!out(tt)) break; } }
          v.camT = (v.camT ?? 1) + (t - (v.camT ?? 1)) * Math.min(1, dt * (t < (v.camT ?? 1) ? 10 : 3));
          v.cam.position.set(k.x - cx * back * v.camT, camY + (1 - v.camT) * 3, k.z - cz * back * v.camT);
        }
        // Sbronzo: la visuale ondeggia
        const wob = k.drunkT > 0 ? Math.min(1, k.drunkT) : 0;
        v.cam.up.set(Math.sin(tsec * 2.6) * 0.16 * wob * cz, 1, -Math.sin(tsec * 2.6) * 0.16 * wob * cx);
        // lo sguardo punta più avanti, sulla curva che arriva
        v.cam.lookAt(k.x + cx * 11 + Math.sin(tsec * 1.9) * 1.2 * wob, v.camY + (k.y - v.camY) * 0.5 + 0.9, k.z + cz * 11 + Math.cos(tsec * 1.7) * 1.2 * wob);
        // più vai forte, più la visuale si allarga (col turbo ancora di più)
        const sp = Math.min(1, Math.max(0, Math.abs(k.speed || 0) / MAX_SPEED));
        const target = 64 + sp * 8 + (k.boostT > 0 ? 12 : 0);
        v.fov += (target - v.fov) * Math.min(1, dt * 4);
        v.cam.fov = v.fov;
      }
      v.cam.updateProjectionMatrix();
      // le etichette dei nomi troppo vicine alla telecamera coprirebbero tutto: le nascondo
      for (const m of karts.values()) m.tag.visible = m.root.position.distanceTo(v.cam.position) > 11;
      renderer.setViewport(x, H - y - h, w, h);
      renderer.setScissor(x, H - y - h, w, h);
      renderer.render(scene, v.cam);
      // Sbronzo: vista doppia con i colori sfasati (una seconda immagine spostata e colorata sopra)
      if (k && k.drunkT > 0 && snap.phase === 'race') drunkPass(v, k, x, y, w, h, H, tsec);

      // ---- specchietto retrovisore (in alto al centro)
      const showMirror = k && !(karts.get(v.slot) && karts.get(v.slot).loopPose) && (snap.phase === 'race' || snap.phase === 'finish') && !k.finished && (mirrorOn === 'force' || (mirrorOn && prStep < STEPS.length - 1));
      v.mirrorEl.style.display = showMirror ? 'block' : 'none';
      if (showMirror) {
        const mw = Math.round(w * 0.26), mh = Math.round(h * 0.12), mx = Math.round(x + (w - mw) / 2), my = Math.round(y + h * 0.025);
        v.mirrorEl.style.left = ((mx - x) / w * 100) + '%'; v.mirrorEl.style.top = ((my - y) / h * 100) + '%';
        v.mirrorEl.style.width = (mw / w * 100) + '%'; v.mirrorEl.style.height = (mh / h * 100) + '%';
        const fx2 = Math.sin(k.yaw), fz2 = Math.cos(k.yaw);
        v.mcam.aspect = mw / mh;
        v.mcam.position.set(k.x - fx2 * 1.0, k.y + 1.9, k.z - fz2 * 1.0);
        v.mcam.lookAt(k.x - fx2 * 30, k.y + 1.2, k.z - fz2 * 30);
        v.mcam.updateProjectionMatrix();
        renderer.setViewport(mx, H - my - mh, mw, mh);
        renderer.setScissor(mx, H - my - mh, mw, mh);
        // nello specchietto il proprio kart (pilota, alettone, fiamme) non c'è: si vede solo chi sta dietro
        const own = karts.get(v.slot);
        if (own) own.root.visible = false;
        renderer.render(scene, v.mcam);
        if (own) own.root.visible = true;
      }

      // ---- HUD
      const racing = k && (snap.phase === 'race' || snap.phase === 'countdown' || snap.phase === 'finish');
      v.el.classList.toggle('racing', !!racing);
      if (!k) { v.label.textContent = v.slot < 0 ? '' : 'Riquadro libero'; }
      else v.label.textContent = '';
      if (racing) {
        v.num.textContent = k.place; v.suf.textContent = '°';
        v.place.dataset.p = k.place;
        if (k.place !== v.lastPlace) { v.place.classList.remove('pop'); void v.place.offsetWidth; v.place.classList.add('pop'); v.lastPlace = k.place; }
        const lap = Math.max(1, Math.min(snap.laps, k.lapCount));
        v.lap.innerHTML = `GIRO <b>${lap}</b>/${snap.laps}`;
        v.time.textContent = fmt(k.finished ? k.finishTime : snap.raceTime);
        if (k.lapCount !== v.lastLap) {
          if (v.lastLap >= 1 && k.lapCount === snap.laps && !k.finished) { flash(v, 'ULTIMO GIRO!', 1800, 'gold'); onEvent('lastlap', v.slot); }
          else if (v.lastLap >= 1 && k.lapCount > v.lastLap && k.lapCount < snap.laps) { flash(v, `GIRO ${k.lapCount}`, 1500, ''); onEvent('lap', v.slot); }
          v.lastLap = k.lapCount;
        }
        // indicatore mini-turbo
        const bars = v.mt.children;
        const c = k.drifting ? k.driftCharge : 0;
        bars[0].className = c > 0.05 ? 'on y' : '';
        bars[1].className = c >= MT_BLUE ? 'on b' : '';
        bars[2].className = c >= MT_ORANGE ? 'on o' : '';
        v.mt.classList.toggle('show', !!k.drifting);
        v.fog.style.opacity = k.fogT > 0 ? Math.min(0.94, k.fogT * 0.6) : 0;
        // polizia: bordo che lampeggia blu e rosso per chi è inseguito
        const chased = k.copT > 0 || (snap.missiles || []).some(q => q.kind === 'police' && q.to === v.slot);
        v.police.classList.toggle('show', chased);
        // Telecomando: simbolo del rallentatore
        v.rewind.classList.toggle('show', k.slowmoT > 0);
        // Telefonata: la chiamata in arrivo anche sulla TV
        const calling = k.callT > 0;
        if (calling !== v.call.classList.contains('show')) {
          v.call.classList.toggle('show', calling);
          if (calling) { const c = snap.karts.find(q => q.slot === k.callFrom); v.call.querySelector('.vc-name').textContent = c ? c.name : 'Numero sconosciuto'; }
        }
        const fx = [];
        if (k.shieldT > 0) fx.push(`Scudo ${Math.ceil(k.shieldT)}`);
        if (k.mirror > 0) fx.push(k.mirrorT > 0 ? `Specchio ${Math.ceil(k.mirrorT)}` : 'Specchio');

        if (k.copT > 0) fx.push('Fermato dalla polizia!');
        if (k.invertT > 0) fx.push('Sterzo al contrario!');
        if (k.stopT > 0) fx.push('Bloccato!');
        if (k.miniT > 0) fx.push('Mini');
        if (k.bombT > 0) fx.push(`BOMBA ${Math.ceil(k.bombT)}`);
        const fxs = fx.join(' · ');
        if (v.fx.textContent !== fxs) v.fx.textContent = fxs;
        v.fx.classList.toggle('bomb', k.bombT > 0);
        drawRank(v, snap, now);
        drawMeters(v, snap, k);
      }
      drawHits(v, snap, now);
      // minigioco lampo: kart fermo finché non finisci la missione
      const lm = snap.lampo && k && snap.lampo.done[k.slot] == null && snap.lampo.t < LAMPO_MAX ? snap.lampo : null;
      if (lm) { v.lampo.querySelector('b').textContent = LAMPO[lm.mission].short; }
      if (!!lm !== v.lampoOn) {
        v.lampo.classList.toggle('show', !!lm);
        if (v.lampoOn && !lm) flash(v, 'VIA!', 1200, 'gold');
        v.lampoOn = !!lm;
      }
      // centro: countdown e messaggi
      let center = '';
      if (snap.phase === 'countdown') {
        const n = Math.ceil(snap.countdown);
        center = n >= 1 && n <= 3 ? String(n) : '';
      } else if (snap.phase === 'race' && snap.raceTime < 1) center = 'VIA!';
      if (k && k.finished) center = '';
      v.center.textContent = center;
      v.center.className = 'v-center' + (center ? ' show c' + center.replace('!', '') : '');
      if (k && k.finished && !v.finishedShown) { flash(v, `TRAGUARDO! ${k.place}°`, 99999, 'gold'); v.finishedShown = true; }
      if (k && !k.finished && v.finishedShown) { v.finishedShown = false; v.msgUntil = 0; }
      if (k && k.wrongWay > 1.2 && !k.finished) { v.msg.textContent = 'CONTROMANO!'; v.msg.className = 'v-msg show red'; v.msgUntil = now + 300; }
      if (k && k.spinT > 0 && snap.raceTime < 2) { v.msg.textContent = 'Partenza bruciata!'; v.msg.className = 'v-msg show red'; v.msgUntil = now + 400; }
      if (now > v.msgUntil && v.msg.classList.contains('show')) v.msg.className = 'v-msg';

      // minimappa
      const ms = Math.round(Math.min(w, h) * 0.3);
      if (!v.mapBase || v.map.width !== ms) { v.map.width = v.map.height = ms; v.mapBase = drawMapBase(ms); }
      const g = v.map.getContext('2d');
      g.clearRect(0, 0, ms, ms);
      if (v.mapBase) g.drawImage(v.mapBase, 0, 0);
      track.portalFractions.forEach((f, i) => {
        const p = track.pts[Math.floor((f * track.length) / track.ds) % track.count];
        const [px, py] = mapXY(p.x, p.z, ms);
        const on = !snap.portals || snap.portals[i] !== false;
        g.beginPath(); g.arc(px, py, ms * 0.03, 0, 7);
        g.fillStyle = on ? '#ffd400' : '#6b7080'; g.fill();
        g.lineWidth = 2; g.strokeStyle = '#1a1a1a'; g.stroke();
      });
      {
        const p = track.pts[Math.floor((track.pitFraction * track.length) / track.ds) % track.count];
        const [px, py] = mapXY(p.x, p.z, ms);
        const r = ms * 0.03;
        g.fillStyle = '#fff'; g.fillRect(px - r, py - r, r * 2, r * 2);
        g.fillStyle = '#1a1a1a'; g.fillRect(px - r, py - r, r, r); g.fillRect(px, py, r, r);
      }
      const sorted = [...snap.karts].sort((a, b) => (a.slot === v.slot) - (b.slot === v.slot));
      for (const q of sorted) {
        const [mx, my] = mapXY(q.x, q.z, ms);
        const me = q.slot === v.slot;
        g.beginPath(); g.arc(mx, my, ms * (me ? 0.045 : 0.032), 0, 7);
        g.fillStyle = q.color; g.fill();
        g.lineWidth = me ? 3 : 2; g.strokeStyle = '#fff'; g.stroke();
      }
    });
    renderer.setScissorTest(false);
  }

  let onEvent = () => {};
  let mirrorOn = true;
  return {
    render, renderer, perf, quality: () => STEPS[prStep], setTrack, scene,
    onEvent: (fn) => { onEvent = fn; }, setMirror: (on) => { mirrorOn = on; },
  };
}

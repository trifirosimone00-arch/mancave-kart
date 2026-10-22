// Grafica 3D: pista di prova, kart, telecamere per riquadro, HUD stile Wii.
import * as THREE from 'three';
import { groundHeight, RAMP_LENGTH } from './track.js';
import { MT_BLUE, MT_ORANGE } from './sim.js';

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
function buildWorld(scene, track) {
  const R = rng(7);
  const { pts, count, halfWidth: hw, wall } = track;

  // cielo a gradiente
  const skyGeo = new THREE.SphereGeometry(1800, 32, 16);
  const col = [];
  const top = new THREE.Color('#2f8fe0'), mid = new THREE.Color('#8fd2ff'), hor = new THREE.Color('#e6f6ff');
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 1800;
    const c = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : hor.clone().lerp(mid, Math.max(0, y / 0.25));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));

  // luci
  scene.add(new THREE.HemisphereLight('#dff3ff', '#4f8f3a', 1.25));
  const sun = new THREE.DirectionalLight('#fff4dc', 1.6);
  sun.position.set(-300, 500, -200);
  scene.add(sun);
  scene.fog = new THREE.Fog('#d9f0ff', 260, 900);

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

// ------------------------------------------------------------------ kart
function nameSprite(name, color) {
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.font = '900 34px "Nunito", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(w - 8, g.measureText(name).width + 34);
    g.fillStyle = 'rgba(14,18,34,0.78)';
    g.beginPath(); g.roundRect((w - tw) / 2, 8, tw, h - 16, 20); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc((w - tw) / 2 + 18, h / 2, 7, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(name, w / 2 + 8, h / 2 + 2);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(5, 1.25, 1);
  sp.renderOrder = 10;
  return sp;
}

function makeKart(slot, name, color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: '#23252d' });
  const metal = new THREE.MeshLambertMaterial({ color: '#c9ced8' });
  const white = new THREE.MeshLambertMaterial({ color: '#f4f4f4' });
  const skin = new THREE.MeshLambertMaterial({ color: '#ffd2a6' });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 3.1), paint); chassis.position.set(0, 0.6, 0); body.add(chassis);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.9), paint); nose.position.set(0, 0.62, 1.85); body.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.3), dark); bumper.position.set(0, 0.45, 2.35); body.add(bumper);
  const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 2.0), white); side1.position.set(-1.15, 0.7, 0); body.add(side1);
  const side2 = side1.clone(); side2.position.x = 1.15; body.add(side2);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.3), dark); seat.position.set(0, 1.25, -0.95); body.add(seat);
  const wheelsGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.5, 14);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.52, 10);
  const wheels = [];
  for (const [x, z, r] of [[-1.25, 1.15, 0.9], [1.25, 1.15, 0.9], [-1.3, -1.05, 1.08], [1.3, -1.05, 1.08]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelsGeo, dark); tyre.rotation.z = Math.PI / 2; tyre.scale.set(r, 1, r);
    const rim = new THREE.Mesh(rimGeo, metal); rim.rotation.z = Math.PI / 2;
    w.add(tyre, rim); w.position.set(x, 0.48 * r, z);
    body.add(w); wheels.push(w);
  }
  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 14), dark);
  steerWheel.position.set(0, 1.25, 0.75); steerWheel.rotation.x = -0.9; body.add(steerWheel);
  // pilota
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.95, 10), white); torso.position.set(0, 1.45, -0.35); body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), skin); head.position.set(0, 2.25, -0.25); body.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), paint); helmet.position.set(0, 2.3, -0.3); body.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.2), new THREE.MeshLambertMaterial({ color: '#1b2a4a' })); visor.position.set(0, 2.32, 0.18); body.add(visor);
  // numero
  const numTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
    g.fillStyle = '#111'; g.font = '900 40px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(slot + 1), 32, 35);
  });
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: numTex, transparent: true }));
  num.position.set(0, 0.85, 2.31); body.add(num);
  // scarichi e fiamma del turbo
  const flames = [];
  for (const x of [-0.45, 0.45]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 8), metal);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(x, 0.75, -1.75); body.add(pipe);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 8), new THREE.MeshBasicMaterial({ color: '#ff9a1f', transparent: true, opacity: 0.9 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(x, 0.75, -2.7); fl.visible = false;
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
  const tag = nameSprite(name, color);
  tag.position.set(0, 4.1, 0);
  tag.layers.set(TAG_LAYER0 + slot);
  root.add(tag);
  return { root, body, wheels, flames, sparks, shadow, tag, color, name, spin: 0 };
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
  const scene = new THREE.Scene();
  buildWorld(scene, track);

  const karts = new Map();
  let layout = [];        // [{slot}] per riquadro
  let views = [];         // stato per riquadro
  let mapBase = null;
  let lastSig = '';

  // minimappa: percorso disegnato una volta
  const bounds = (() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    track.pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
    return { minX, maxX, minZ, maxZ };
  })();
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
    const pr = track.pts[Math.floor(track.rampStartS / track.ds)]; const [rx, ry] = mapXY(pr.x, pr.z, size);
    g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(rx, ry, size * 0.022, 0, 7); g.fill();
    return c;
  }

  function ensureKart(k) {
    let m = karts.get(k.slot);
    if (!m || m.name !== k.name || m.color !== k.color) {
      if (m) { scene.remove(m.root, m.shadow); }
      m = makeKart(k.slot, k.name, k.color);
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
        <div class="v-label"></div>`;
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
      };
    });
    hudRoot.dataset.n = String(n);
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

  // snap: stato di gioco; slots: array di slot (o -1) per riquadro
  let lastPhase = '';
  function render(snap, slots, dt) {
    adapt(dt);
    if (snap.phase !== lastPhase) {
      if (snap.phase === 'intro') views.forEach(v => { v.msgUntil = 0; v.lastLap = -1; v.lastPlace = 0; v.finishedShown = false; v.msg.className = 'v-msg'; v.init = false; });
      lastPhase = snap.phase;
    }
    const sig = slots.join(',');
    if (sig !== lastSig) { layout = slots.map(s => ({ slot: s })); buildHud(slots.length); lastSig = sig; }
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) {
      renderer.setSize(W, H, false);
    }
    const now = performance.now();
    const tsec = now / 1000;

    // aggiorna i kart
    const present = new Set();
    for (const k of snap.karts) {
      present.add(k.slot);
      const m = ensureKart(k);
      m.root.position.set(k.x, k.y + (k.hop > 0 ? Math.sin((k.hop / 0.18) * Math.PI) * 0.5 : 0), k.z);
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
      m.shadow.position.set(k.x, Math.max(0, groundHeight(track, k.s, k.lat)) + 0.08, k.z);
      m.shadow.rotation.z = k.yaw;
      const air = Math.max(0, k.y - groundHeight(track, k.s, k.lat));
      m.shadow.material.opacity = Math.max(0.08, 0.28 - air * 0.03);
      // turbo
      const boosting = k.boostT > 0;
      m.flames.forEach((f, i) => {
        f.visible = boosting;
        if (boosting) {
          const s = 0.8 + Math.sin(tsec * 40 + i) * 0.25;
          f.scale.set(s, s * (k.boostKind === 'orange' || k.boostKind === 'start' ? 1.4 : 1), s);
          f.material.color.set(k.boostKind === 'blue' ? '#4fc3ff' : '#ff9a1f');
        }
      });
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
        v.cam.position.set(p.x - p.rx * 30, 26, p.z - p.rz * 30);
        v.cam.lookAt(q.x, 2, q.z);
        v.init = false;
      } else {
        const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
        if (!v.init) { v.yaw = k.yaw; v.init = true; }
        let d = k.yaw - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        v.yaw += d * Math.min(1, dt * 5.5);
        const cx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
        const back = snap.phase === 'finish' && k.finished ? 9 : 7.2;
        const camY = k.y * 0.7 + 3.1;
        v.cam.position.set(k.x - cx * back, camY, k.z - cz * back);
        v.cam.lookAt(k.x + fx * 3.5, k.y * 0.85 + 1.6, k.z + fz * 3.5);
        const target = k.boostT > 0 ? 84 : 72;
        v.fov += (target - v.fov) * Math.min(1, dt * 4);
        v.cam.fov = v.fov;
      }
      v.cam.updateProjectionMatrix();
      renderer.setViewport(x, H - y - h, w, h);
      renderer.setScissor(x, H - y - h, w, h);
      renderer.render(scene, v.cam);

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
          if (v.lastLap >= 1 && k.lapCount === snap.laps && !k.finished) flash(v, 'ULTIMO GIRO!', 1800, 'gold');
          v.lastLap = k.lapCount;
        }
        // indicatore mini-turbo
        const bars = v.mt.children;
        const c = k.drifting ? k.driftCharge : 0;
        bars[0].className = c > 0.05 ? 'on y' : '';
        bars[1].className = c >= MT_BLUE ? 'on b' : '';
        bars[2].className = c >= MT_ORANGE ? 'on o' : '';
        v.mt.classList.toggle('show', !!k.drifting);
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

  return { render, renderer, perf, quality: () => STEPS[prStep] };
}

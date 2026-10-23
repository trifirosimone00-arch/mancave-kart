// Effetti visivi delle carte e particelle (fumo, esplosioni, scintille).
// - sopra ogni kart: stelline (Sbronzo), frecce che girano (Sterzo al contrario), telefono che squilla,
//   ganascia gialla (Freno a mano), fumetto "Documenti, prego!", bolla dello Scudo, cornice dello Specchio
// - eventi che vedono tutti (snap.cfx): icona della carta sopra chi la usa, esplosione del missile,
//   teletrasporto dello Scambio, calamita del Magnete, manina del Ladro, lampo dello Specchio
import * as THREE from 'three';
import { CARDS } from './cards.js';

const ICON = {
  turbo: '🔥', superturbo: '🔥', shield: '🛡️', supershield: '🛡️', oil: '🛢️', drunk: '🍺', missile: '🚀', magnet: '🧲',
  invert: '🔄', handbrake: '✋', mini: '🐜', call: '📞', police: '🚓', remote: '⏪', swap: '🔀', thief: '🦹', mirror: '🪞',
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// carta disegnata: bordo bianco, colore della carta, simbolo e nome
const cardTexCache = new Map();
function cardTex(id) {
  if (cardTexCache.has(id)) return cardTexCache.get(id);
  const def = CARDS[id] || { name: id, color: '#555' };
  const t = canvasTex(160, 220, (g, w, h) => {
    g.fillStyle = '#ffffff'; roundRect(g, 4, 4, w - 8, h - 8, 22); g.fill();
    g.fillStyle = def.color; roundRect(g, 14, 14, w - 28, h - 28, 14); g.fill();
    const gr = g.createLinearGradient(0, 14, 0, h / 2); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; roundRect(g, 14, 14, w - 28, h / 2 - 14, 14); g.fill();
    g.font = '86px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ICON[id] || '?', w / 2, h * 0.43);
    g.font = '900 22px "Nunito","Arial Black",sans-serif'; g.fillStyle = '#ffffff';
    g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.55)';
    const name = def.name.toUpperCase();
    g.strokeText(name, w / 2, h * 0.82, w - 30); g.fillText(name, w / 2, h * 0.82, w - 30);
  });
  cardTexCache.set(id, t);
  return t;
}

function softDot() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}
function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r2 : r1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

export function createCardFx(scene) {
  // ---------------------------------------------------------------- particelle (un unico sistema per tutto)
  const MAXP = 700;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAXP * 3), col = new Float32Array(MAXP * 3), size = new Float32Array(MAXP), alpha = new Float32Array(MAXP);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: softDot() }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
      void main() { vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 5;
  scene.add(points);
  const parts = [];   // {x,y,z,vx,vy,vz,life,max,s0,s1,r,g,b,a0,grav,drag}
  const tmpC = new THREE.Color();
  function emit(x, y, z, o) {
    if (parts.length >= MAXP) parts.shift();
    tmpC.set(o.color || '#ffffff');
    parts.push({ x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.life || 1, s0: o.s0 ?? 1, s1: o.s1 ?? 2,
      r: tmpC.r, g: tmpC.g, b: tmpC.b, a0: o.a ?? 0.7, grav: o.grav || 0, drag: o.drag ?? 1.5 });
  }
  function burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.6, sp = (o.speed || 8) * (0.4 + Math.random() * 0.8);
      emit(x, y, z, { ...o, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + (o.up || 0), vz: Math.sin(a) * Math.cos(e) * sp,
        color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color, life: (o.life || 1) * (0.7 + Math.random() * 0.6) });
    }
  }
  function stepParticles(dt) {
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; if (p.life >= p.max) parts.splice(i, 1); }
    for (const p of parts) {
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vz *= f; p.vy = p.vy * f - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const u = p.life / p.max;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col[n * 3] = p.r; col[n * 3 + 1] = p.g; col[n * 3 + 2] = p.b;
      size[n] = p.s0 + (p.s1 - p.s0) * u; alpha[n] = p.a0 * (1 - u) * Math.min(1, u * 8);
      n++;
    }
    pGeo.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) pGeo.attributes[k].needsUpdate = true;
  }

  // ---------------------------------------------------------------- oggetti da appendere a ogni kart
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.32, 0.14), { depth: 0.08, bevelEnabled: false });
  const starMat = new THREE.MeshBasicMaterial({ color: '#ffe14d' });
  const arrowMat = new THREE.MeshBasicMaterial({ color: '#b26bff' });
  const yellow = new THREE.MeshStandardMaterial({ color: '#ffd000', roughness: 0.35, metalness: 0.3 });
  const darkM = new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.4 });
  const docsTex = canvasTex(512, 200, (g, w, h) => {
    g.fillStyle = '#ffffff'; roundRect(g, 6, 6, w - 12, h - 52, 40); g.fill();
    g.beginPath(); g.moveTo(w * 0.42, h - 48); g.lineTo(w * 0.5, h - 6); g.lineTo(w * 0.58, h - 48); g.fill();
    g.strokeStyle = '#1565c0'; g.lineWidth = 8; roundRect(g, 6, 6, w - 12, h - 52, 40); g.stroke();
    g.font = '900 52px "Nunito","Arial Black",sans-serif'; g.fillStyle = '#1565c0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Documenti, prego!', w / 2, (h - 46) / 2 + 4);
  });
  const phoneTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#16181d'; roundRect(g, 0, 0, w, h, 26); g.fill();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2fd36b'); gr.addColorStop(1, '#0f8a41');
    g.fillStyle = gr; roundRect(g, 8, 10, w - 16, h - 20, 18); g.fill();
    g.font = '70px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('📞', w / 2, h * 0.45);
    g.font = '900 22px sans-serif'; g.fillStyle = '#fff'; g.fillText('RING!', w / 2, h * 0.78);
  });

  // bolla dello scudo con il bordo che brilla (effetto fresnel)
  const shieldMat = (color) => new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, t: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float t; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float a = 0.08 + f * (0.75 + 0.25 * sin(t * 6.0)); gl_FragColor = vec4(color * (0.8 + f), a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });

  function attachKart(m) {
    const fx = {};
    // stelline che girano sopra il casco
    fx.stars = new THREE.Group(); fx.stars.position.y = 3.35;
    for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(starGeo, starMat); const a = i / 5 * Math.PI * 2; st.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85); fx.stars.add(st); }
    // due frecce circolari (sterzo al contrario)
    fx.arrows = new THREE.Group(); fx.arrows.position.y = 3.5;
    for (let i = 0; i < 2; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.11, 8, 24, Math.PI * 0.8), arrowMat);
      arc.rotation.x = Math.PI / 2; arc.rotation.z = i * Math.PI;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 10), arrowMat);
      const a = i * Math.PI + Math.PI * 0.8;
      tip.position.set(Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75); tip.rotation.set(0, -a, Math.PI / 2);
      fx.arrows.add(arc, tip);
    }
    // telefono che squilla sopra il kart
    fx.phone = new THREE.Sprite(new THREE.SpriteMaterial({ map: phoneTex, depthTest: false }));
    fx.phone.scale.set(0.9, 1.8, 1); fx.phone.position.y = 3.9; fx.phone.renderOrder = 9;
    // ganascia gialla sulla ruota anteriore sinistra
    fx.clamp = new THREE.Group(); fx.clamp.position.set(-1.55, 0.46, 1.45);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20), yellow); plate.rotation.z = Math.PI / 2; fx.clamp.add(plate);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.22), yellow); arm.position.set(0, -0.12, 0.45); arm.rotation.x = 0.5; fx.clamp.add(arm);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), darkM); lock.position.set(0.05, 0, 0); fx.clamp.add(lock);
    // fumetto della polizia
    fx.docs = new THREE.Sprite(new THREE.SpriteMaterial({ map: docsTex, depthTest: false }));
    fx.docs.scale.set(5.2, 2.0, 1); fx.docs.position.y = 5.2; fx.docs.renderOrder = 9;
    // scudo: bolla col bordo luminoso (azzurra, dorata per il Super Scudo)
    fx.shieldMatBlue = shieldMat('#4fc3ff'); fx.shieldMatGold = shieldMat('#ffc928');
    fx.bubble = new THREE.Mesh(new THREE.SphereGeometry(2.8, 28, 18), fx.shieldMatBlue); fx.bubble.position.y = 1.4; fx.bubble.renderOrder = 4;
    // specchio: cornice argentata luccicante attorno al kart
    fx.mirror = new THREE.Group(); fx.mirror.position.y = 0.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 40), new THREE.MeshStandardMaterial({ color: '#e8eef5', metalness: 1, roughness: 0.12, emissive: '#8899aa', emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; fx.mirror.add(ring);
    fx.mirrorSparks = [];
    for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPARK, color: '#ffffff', depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(0.7); fx.mirror.add(sp); fx.mirrorSparks.push(sp); }
    for (const o of [fx.stars, fx.arrows, fx.phone, fx.docs, fx.bubble, fx.mirror]) { o.visible = false; m.root.add(o); }
    fx.clamp.visible = false; m.body.add(fx.clamp);
    if (m.shield) m.shield.visible = false;
    m.fx = fx;
  }
  const SPARK = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff'; g.fillRect(30, 2, 4, 60); g.fillRect(2, 30, 60, 4);
  });

  function updateKart(m, k, tsec, dt) {
    const fx = m.fx; if (!fx) return;
    fx.stars.visible = k.drunkT > 0;
    if (fx.stars.visible) { fx.stars.rotation.y = tsec * 3; fx.stars.children.forEach((s, i) => { s.rotation.y = -tsec * 3 + i; s.position.y = Math.sin(tsec * 6 + i) * 0.12; }); }
    fx.arrows.visible = k.invertT > 0;
    if (fx.arrows.visible) fx.arrows.rotation.y = -tsec * 4;
    fx.phone.visible = k.callT > 0;
    if (fx.phone.visible) { fx.phone.position.x = Math.sin(tsec * 60) * 0.06; fx.phone.material.rotation = Math.sin(tsec * 40) * 0.12; }
    fx.clamp.visible = k.clampT > 0;
    fx.docs.visible = k.copT > 0;
    const shield = k.shieldT > 0;
    fx.bubble.visible = shield;
    if (shield) {
      fx.bubble.material = k.goldT > 0 ? fx.shieldMatGold : fx.shieldMatBlue;
      fx.bubble.material.uniforms.t.value = tsec;
      const s = 1 + Math.sin(tsec * 6) * 0.025; fx.bubble.scale.setScalar(s);
      if (k.shieldT < 2) fx.bubble.visible = Math.sin(tsec * 25) > -0.2;   // sta per finire: lampeggia
    }
    fx.mirror.visible = k.mirror > 0 && !shield;
    if (fx.mirror.visible) {
      fx.mirror.rotation.y = tsec * 1.5;
      fx.mirrorSparks.forEach((sp, i) => { const a = i / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 2.6, 0.2 + Math.sin(tsec * 4 + i) * 0.3, Math.sin(a) * 2.6); sp.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(tsec * 5 + i * 1.7)); });
    }
    // fumo dalle gomme: derapata, testacoda, frenata forte
    const v = Math.abs(k.speed || 0);
    if (!k.air && ((k.drifting && v > 8) || k.spinT > 0 || (k.stopT > 0 && v > 4)) && Math.random() < dt * 40) {
      const fx2 = Math.sin(k.yaw), fz2 = Math.cos(k.yaw), rx = fz2, rz = -fx2;
      for (const sd of [-1, 1]) {
        const x = k.x - fx2 * 1.3 + rx * sd * 1.3, z = k.z - fz2 * 1.3 + rz * sd * 1.3;
        emit(x, (k.y || 0) + 0.4, z, { vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 2, life: 0.8, s0: 0.6, s1: 2.4, color: '#e6e3dd', a: 0.38, drag: 2 });
      }
    }
  }

  // ---------------------------------------------------------------- eventi delle carte
  const seen = new Set();
  const live = [];   // oggetti temporanei { obj, t, dur, update }
  function addLive(obj, dur, update) { scene.add(obj); live.push({ obj, t: 0, dur, update }); }
  const kartPos = (karts, slot) => { const m = karts.get(slot); return m ? m.root.position : null; };
  function cardEvents(snap, karts, onSound) {
    for (const c of snap.cfx || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      if ((snap.raceTime || 0) - c.t > 1.2) continue;   // evento vecchio (es. appena collegati)
      if (c.kind === 'use') {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cardTex(c.card), depthTest: false, transparent: true }));
        sp.renderOrder = 10; sp.scale.set(1.9, 2.6, 1);
        addLive(sp, 1.4, (u) => {
          const p = kartPos(karts, c.from); if (!p) return;
          sp.position.set(p.x, p.y + 4.6 + u * 1.6, p.z);
          const s = u < 0.15 ? u / 0.15 : 1; sp.scale.set(1.9 * s, 2.6 * s, 1);
          sp.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
          sp.material.rotation = Math.sin(u * 10) * 0.08;
        });
        onSound('card:' + c.card);
      } else if (c.kind === 'boom') {
        const p = kartPos(karts, c.to) || new THREE.Vector3(c.x, 0, c.z);
        burst(p.x, p.y + 1, p.z, 40, { color: ['#ffd23a', '#ff8a1f', '#ff3d1f'], speed: 11, life: 0.55, s0: 1.1, s1: 0.3, a: 1, drag: 3 });
        burst(p.x, p.y + 1.5, p.z, 22, { color: ['#8a8784', '#a29e99', '#6f6c69'], speed: 4, up: 4, life: 1.3, s0: 1.2, s1: 3.2, a: 0.45, drag: 2 });
        const flash = new THREE.PointLight('#ffb050', 30, 30, 2); flash.position.set(p.x, p.y + 2, p.z);
        addLive(flash, 0.35, (u) => { flash.intensity = 30 * (1 - u); });
        onSound('explode');
      } else if (c.kind === 'swap') {
        for (const slot of [c.from, c.to]) {
          const p = kartPos(karts, slot); if (!p) continue;
          burst(p.x, p.y + 1.5, p.z, 36, { color: ['#ffffff', '#9fe3ff', '#d6a8ff'], speed: 7, up: 2, life: 0.8, s0: 1, s1: 0.2, a: 1, drag: 2 });
          const col = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#cfefff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          addLive(col, 0.6, (u) => { const q = kartPos(karts, slot); if (q) col.position.set(q.x, q.y + 7, q.z); col.material.opacity = 0.8 * (1 - u); col.scale.set(1 - u * 0.7, 1, 1 - u * 0.7); });
        }
        onSound('teleport');
      } else if (c.kind === 'magnet') {
        // calamita rossa sopra chi la usa e scintille che volano dall'altro kart
        const mag = makeMagnet();
        addLive(mag, 1.5, (u) => {
          const a = kartPos(karts, c.from), b = kartPos(karts, c.to); if (!a) return;
          mag.position.set(a.x, a.y + 4.2, a.z); mag.rotation.y = u * 8;
          if (b && Math.random() < 0.9) {
            const t = Math.random();
            emit(b.x + (a.x - b.x) * t, b.y + 1.5 + (a.y - b.y) * t + Math.sin(t * Math.PI) * 2, b.z + (a.z - b.z) * t,
              { color: Math.random() < 0.5 ? '#ffe14d' : '#7fd3ff', life: 0.35, s0: 0.9, s1: 0.2, a: 1, drag: 0 });
          }
        });
        onSound('zap');
      } else if (c.kind === 'thief') {
        // manina che prende la carta dal derubato e la porta al ladro (c.from = ladro, c.to = derubato)
        const hand = new THREE.Sprite(new THREE.SpriteMaterial({ map: HAND, depthTest: false, transparent: true }));
        hand.renderOrder = 10; hand.scale.set(2.2, 2.2, 1);
        addLive(hand, 1.4, (u) => {
          const a = kartPos(karts, c.to), b = kartPos(karts, c.from); if (!a) return;
          const t = u < 0.35 ? 0 : (u - 0.35) / 0.65, e = t * t * (3 - 2 * t);
          const tgt = b || a;
          hand.position.set(a.x + (tgt.x - a.x) * e, a.y + 4.2 + Math.sin(e * Math.PI) * 3, a.z + (tgt.z - a.z) * e);
          hand.material.opacity = u > 0.85 ? (1 - u) / 0.15 : 1;
        });
        onSound('steal');
      } else if (c.kind === 'mirror') {
        const p = kartPos(karts, c.from); if (!p) continue;
        burst(p.x, p.y + 1.5, p.z, 28, { color: ['#ffffff', '#dfe9f5'], speed: 9, life: 0.5, s0: 1.2, s1: 0.2, a: 1, drag: 3 });
        onSound('ding');
      }
    }
    if (seen.size > 400) { const keep = [...seen].slice(-100); seen.clear(); keep.forEach(x => seen.add(x)); }
  }
  const HAND = canvasTex(128, 128, (g, w, h) => {
    g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('🫳', w / 2, h / 2 + 6);
  });
  function makeMagnet() {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.35 });
    const tip = new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 0.8, roughness: 0.2 });
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.24, 10, 24, Math.PI), red); u.rotation.z = Math.PI; g.add(u);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 12), red); leg.position.set(s * 0.6, 0.3, 0); g.add(leg);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.25, 12), tip); t.position.set(s * 0.6, 0.72, 0); g.add(t);
    }
    g.rotation.x = Math.PI; g.scale.setScalar(1.3);
    return g;
  }

  // scia di fumo dei missili
  function missileTrail(missiles, dt) {
    for (const ms of missiles || []) {
      if (ms.kind === 'police') continue;
      if (Math.random() < dt * 45) {
        const fx = Math.sin(ms.yaw), fz = Math.cos(ms.yaw);
        emit(ms.x - fx * 1.4, (ms.y || 0) + 1.1, ms.z - fz * 1.4, { vy: 0.6, life: 1.1, s0: 0.9, s1: 3.4, color: '#cfcfcf', a: 0.6, drag: 1 });
        emit(ms.x - fx * 1.2, (ms.y || 0) + 1.1, ms.z - fz * 1.2, { life: 0.18, s0: 1.0, s1: 0.3, color: '#ffb340', a: 1, drag: 0 });
      }
    }
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; L.t += dt;
      const u = Math.min(1, L.t / L.dur);
      L.update(u);
      if (L.t >= L.dur) { scene.remove(L.obj); L.obj.traverse?.((o) => { if (o.material && o.material.map && !cardTexCache.has(o.material.map)) o.material.dispose(); }); live.splice(i, 1); }
    }
    stepParticles(dt);
  }
  function setScale(h) { pMat.uniforms.scale.value = h * 0.6; }

  return { attachKart, updateKart, cardEvents, missileTrail, update, emit, burst, setScale };
}

// Kart e pilota in stile cartoon: forme tonde, colori pieni, pilota con la testa grande.
// Le misure restano quelle di prima (2,3 di larghezza, 4,7 di lunghezza) per non cambiare la fisica.
import * as THREE from 'three';

const geoCache = {};
function cached(key, make) { return geoCache[key] || (geoCache[key] = make()); }

// scatola arrotondata, centrata, altezza lungo y
function roundBox(w, h, d, r, seg = 3) {
  r = Math.max(0.02, Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01));
  const iw = w - 2 * r, id = d - 2 * r, s = new THREE.Shape();
  s.moveTo(-iw / 2, -id / 2); s.lineTo(iw / 2, -id / 2); s.lineTo(iw / 2, id / 2); s.lineTo(-iw / 2, id / 2); s.lineTo(-iw / 2, -id / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 3 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - 2 * r) / 2, 0);
  g.computeVertexNormals();
  return g;
}

// fiancata del kart vista di lato, estrusa in larghezza con gli spigoli smussati
function sideProfile(width) {
  const s = new THREE.Shape();
  // z avanti, y su (disegnata nel piano x=z, y=y)
  s.moveTo(-2.05, 0.32);
  s.lineTo(1.75, 0.32);
  s.quadraticCurveTo(2.45, 0.34, 2.4, 0.62);      // muso arrotondato
  s.quadraticCurveTo(2.25, 0.86, 1.55, 0.9);
  s.lineTo(0.75, 0.98);
  s.quadraticCurveTo(0.45, 1.0, 0.3, 0.78);        // abitacolo
  s.lineTo(-1.25, 0.78);
  s.quadraticCurveTo(-1.5, 0.8, -1.55, 1.05);      // cofano motore
  s.lineTo(-2.0, 1.05);
  s.quadraticCurveTo(-2.2, 1.0, -2.15, 0.6);
  s.quadraticCurveTo(-2.15, 0.35, -2.05, 0.32);
  const g = new THREE.ExtrudeGeometry(s, { depth: width - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.13, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -(width - 0.3) / 2);
  g.rotateY(-Math.PI / 2);                          // x del disegno -> z del kart
  g.computeVertexNormals();
  return g;
}

function tyreGeo(r, w) {
  // gomma tonda (sezione arrotondata) fatta col tornio, asse lungo y
  const pts = [];
  const rr = w / 2;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    pts.push(new THREE.Vector2(r - rr * 0.55 + Math.cos(a) * rr * 0.55, Math.sin(a) * rr));
  }
  pts.unshift(new THREE.Vector2(r * 0.55, -rr));
  pts.push(new THREE.Vector2(r * 0.55, rr));
  const g = new THREE.LatheGeometry(pts, 22);
  g.computeVertexNormals();
  return g;
}

function eyeTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(64, 64, 46, 60, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a7be4'; g.beginPath(); g.ellipse(70, 70, 28, 36, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0d0f14'; g.beginPath(); g.ellipse(72, 72, 17, 23, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(80, 56, 9, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(62, 86, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1b1b1b'; g.lineWidth = 5; g.beginPath(); g.ellipse(64, 64, 46, 60, 0, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let EYE = null;

function numberTex(n, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.strokeStyle = color; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
  g.fillStyle = '#15171c'; g.font = '900 78px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// pelle, capelli e accessorio diversi per ogni posto, così i 4 piloti si distinguono
const LOOKS = [
  { skin: '#f2c29b', hair: '#3b2416', hat: 'cap' },
  { skin: '#e9b48a', hair: '#e8b23a', hat: 'helmet' },
  { skin: '#c98a5e', hair: '#1c1410', hat: 'cap' },
  { skin: '#f6d2b6', hair: '#a8452a', hat: 'helmet' },
  { skin: '#d9a07a', hair: '#2b2b2b', hat: 'helmet' },
  { skin: '#f2c29b', hair: '#6b4a2e', hat: 'cap' },
  { skin: '#b9784f', hair: '#111111', hat: 'cap' },
  { skin: '#f6d2b6', hair: '#d8d8d8', hat: 'helmet' },
];

export function buildKartModel(slot, color) {
  const body = new THREE.Group();
  const C = new THREE.Color(color);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const paint = std({ color: C, roughness: 0.32, metalness: 0.15 });
  const paintDark = std({ color: C.clone().multiplyScalar(0.62), roughness: 0.4 });
  const white = std({ color: '#f6f6f2', roughness: 0.45 });
  const black = std({ color: '#1e1f24', roughness: 0.6 });
  const rubber = std({ color: '#25262b', roughness: 0.85 });
  const chrome = std({ color: '#dfe3ea', roughness: 0.2, metalness: 1 });
  const look = LOOKS[slot % LOOKS.length];
  const skin = std({ color: look.skin, roughness: 0.7 });
  const hair = std({ color: look.hair, roughness: 0.8 });
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // ---------------------------------------------------------------- carrozzeria
  add(cached('side', () => sideProfile(2.0)), paint, 0, 0, 0);
  // pianale scuro sotto
  add(cached('floor', () => roundBox(2.1, 0.22, 4.1, 0.1)), black, 0, 0.3, 0.05);
  // paraurti tondi davanti e dietro
  const bumpF = add(cached('bumpF', () => new THREE.CapsuleGeometry(0.2, 2.0, 6, 12)), black, 0, 0.42, 2.45); bumpF.rotation.z = Math.PI / 2;
  const bumpR = add(cached('bumpF', () => new THREE.CapsuleGeometry(0.2, 2.0, 6, 12)), black, 0, 0.5, -2.2); bumpR.rotation.z = Math.PI / 2;
  // fiancate laterali bianche (pance)
  for (const s of [-1, 1]) {
    const pod = add(cached('pod', () => new THREE.CapsuleGeometry(0.3, 1.5, 6, 12)), white, s * 1.08, 0.58, 0.05); pod.rotation.x = Math.PI / 2;
  }
  // striscia bianca sul muso e numero
  add(cached('stripe', () => roundBox(0.5, 0.06, 1.3, 0.03)), white, 0, 0.99, 1.45).rotation.x = 0.06;
  const num = add(cached('numPlane', () => new THREE.CircleGeometry(0.34, 24)), new THREE.MeshBasicMaterial({ map: numberTex(slot + 1, color) }), 0, 0.66, 2.62);
  // sedile
  add(cached('seat', () => roundBox(1.1, 1.1, 0.35, 0.15)), black, 0, 1.25, -0.95).rotation.x = -0.2;
  add(cached('seatB', () => roundBox(1.1, 0.25, 0.9, 0.1)), black, 0, 0.88, -0.55);
  // motore dietro con scarichi cromati
  add(cached('engine', () => roundBox(1.2, 0.55, 0.7, 0.12)), std({ color: '#3a3d46', roughness: 0.4, metalness: 0.6 }), 0, 1.25, -1.75);
  // alettone
  const wing = add(cached('wing', () => roundBox(2.3, 0.1, 0.55, 0.05)), paint, 0, 1.95, -2.05); wing.rotation.x = 0.12;
  for (const s of [-1, 1]) {
    add(cached('wingPost', () => roundBox(0.1, 0.62, 0.22, 0.04)), black, s * 0.55, 1.62, -2.0);
    add(cached('wingEnd', () => roundBox(0.08, 0.42, 0.65, 0.04)), paintDark, s * 1.17, 1.95, -2.05);
  }
  // volante
  const sw = new THREE.Group(); sw.position.set(0, 1.3, 0.62); sw.rotation.x = -1.0; body.add(sw);
  add(cached('swRing', () => new THREE.TorusGeometry(0.34, 0.07, 8, 20)), black, 0, 0, 0, sw);
  add(cached('swHub', () => new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12)), paint, 0, 0, 0, sw).rotation.x = Math.PI / 2;
  add(cached('swCol', () => new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8)), black, 0, -0.05, -0.3).rotation.x = -0.6;

  // ---------------------------------------------------------------- ruote
  const wheels = [];
  for (const [x, z, r, w] of [[-1.22, 1.45, 0.46, 0.5], [1.22, 1.45, 0.46, 0.5], [-1.28, -1.3, 0.56, 0.7], [1.28, -1.3, 0.56, 0.7]]) {
    const wg = new THREE.Group(); wg.position.set(x, r, z);
    const t = new THREE.Mesh(cached(`tyre${r}`, () => tyreGeo(r, w)), rubber); t.rotation.z = Math.PI / 2; wg.add(t);
    const rim = new THREE.Mesh(cached(`rim${r}`, () => new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 0.8, 18)), chrome); rim.rotation.z = Math.PI / 2; wg.add(rim);
    const hub = new THREE.Mesh(cached(`hub${r}`, () => new THREE.CylinderGeometry(r * 0.22, r * 0.22, w * 0.9, 10)), paint); hub.rotation.z = Math.PI / 2; wg.add(hub);
    // raggi, così si vede la ruota girare
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(cached(`spoke${r}`, () => new THREE.BoxGeometry(w * 0.84, r * 0.95, r * 0.12)), chrome); sp.rotation.x = k * Math.PI / 3; wg.add(sp); }
    body.add(wg); wheels.push(wg);
  }
  // assale posteriore
  add(cached('axle', () => new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8)), black, 0, 0.56, -1.3).rotation.z = Math.PI / 2;

  // ---------------------------------------------------------------- pilota
  const driver = new THREE.Group(); driver.position.set(0, 0, -0.35); body.add(driver);
  // tuta del colore del kart con la pancia bianca
  add(cached('torso', () => new THREE.CapsuleGeometry(0.46, 0.45, 6, 14)), paint, 0, 1.5, 0, driver);
  add(cached('belly', () => new THREE.SphereGeometry(0.4, 16, 12)), white, 0, 1.42, 0.2, driver).scale.set(1, 1.1, 0.7);
  // braccia verso il volante, guanti bianchi
  for (const s of [-1, 1]) {
    const arm = add(cached('arm', () => new THREE.CapsuleGeometry(0.15, 0.6, 4, 10)), paint, s * 0.45, 1.6, 0.42, driver);
    arm.rotation.set(1.15, 0, s * 0.35);
    add(cached('glove', () => new THREE.SphereGeometry(0.19, 12, 10)), white, s * 0.3, 1.38, 0.95, driver);
  }
  // testa grande (stile cartoon)
  const head = new THREE.Group(); head.position.set(0, 2.45, 0.05); driver.add(head);
  add(cached('head', () => new THREE.SphereGeometry(0.72, 24, 18)), skin, 0, 0, 0, head);
  add(cached('nose', () => new THREE.SphereGeometry(0.16, 12, 10)), skin, 0, -0.08, 0.72, head).scale.set(1.1, 0.9, 1);
  for (const s of [-1, 1]) {
    add(cached('ear', () => new THREE.SphereGeometry(0.16, 10, 8)), skin, s * 0.7, -0.05, 0, head).scale.set(0.6, 1, 0.8);
  }
  // occhi grandi
  EYE = EYE || eyeTex();
  const eyeMat = new THREE.MeshBasicMaterial({ map: EYE, transparent: true });
  for (const s of [-1, 1]) {
    const e = add(cached('eye', () => new THREE.PlaneGeometry(0.3, 0.38)), eyeMat, s * 0.22, 0.12, 0.69, head);
    e.rotation.y = s * 0.3; e.scale.x = s;   // pupille rivolte un po' verso il centro
  }
  // sorriso
  const smile = add(cached('smile', () => new THREE.TorusGeometry(0.17, 0.035, 6, 14, Math.PI)), std({ color: '#5a1d1d', roughness: 0.6 }), 0, -0.28, 0.66, head);
  smile.rotation.z = Math.PI;
  // capelli che spuntano
  // (nelle sfere di three.js il davanti, +z, è a phi = PI/2: lascio scoperta la faccia)
  add(cached('hairBack', () => new THREE.SphereGeometry(0.75, 20, 14, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, Math.PI * 0.3, Math.PI * 0.42)), hair, 0, 0.02, -0.04, head);
  for (const s of [-1, 1]) add(cached('hairSide', () => new THREE.SphereGeometry(0.22, 10, 8)), hair, s * 0.6, 0.18, 0.18, head).scale.set(0.6, 1, 0.9);
  if (look.hat === 'cap') {
    // cappellino con visiera e iniziale
    add(cached('capTop', () => new THREE.SphereGeometry(0.77, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.36)), paint, 0, 0.1, -0.02, head);
    const brim = add(cached('brim', () => new THREE.CylinderGeometry(0.46, 0.46, 0.06, 22, 1, false, -Math.PI / 2, Math.PI)), paint, 0, 0.5, 0.42, head);
    brim.rotation.x = -0.25; brim.scale.z = 1.2;
    const dot = add(cached('capDot', () => new THREE.CircleGeometry(0.17, 20)), white, 0, 0.66, 0.5, head); dot.rotation.x = -0.75;
  } else {
    // casco aperto davanti
    add(cached('helmet', () => new THREE.SphereGeometry(0.82, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.38)), paint, 0, 0.02, -0.03, head);
    add(cached('helmetBack', () => new THREE.SphereGeometry(0.82, 22, 10, Math.PI / 2 + 1.1, Math.PI * 2 - 2.2, Math.PI * 0.38, Math.PI * 0.27)), paint, 0, 0.02, -0.03, head);
    add(cached('helmetStripe', () => new THREE.TorusGeometry(0.825, 0.05, 6, 30, Math.PI)), white, 0, 0.02, -0.03, head).rotation.y = Math.PI / 2;
    // occhialoni alzati sulla fronte
    for (const s of [-1, 1]) add(cached('lens', () => new THREE.SphereGeometry(0.14, 12, 10)), std({ color: '#7fd3ff', roughness: 0.05, metalness: 0.4 }), s * 0.2, 0.55, 0.5, head).scale.z = 0.5;
  }

  return { body, wheels, paint, head };
}

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

// adesivo dello sponsor sulle fiancate
function decalTex(color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(150, 0); g.lineTo(110, 128); g.lineTo(0, 128); g.fill();
  g.fillStyle = '#15171c'; g.beginPath(); g.moveTo(150, 0); g.lineTo(172, 0); g.lineTo(132, 128); g.lineTo(110, 128); g.fill();
  g.font = 'italic 900 64px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#15171c'; g.fillText('MANCAVE', 330, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

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

export function buildKartModel(slot, color) {
  const body = new THREE.Group();
  const C = new THREE.Color(color);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  // vernice lucida con la mano trasparente sopra (riflessi)
  const paint = new THREE.MeshPhysicalMaterial({ color: C, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 });
  const paintDark = std({ color: C.clone().multiplyScalar(0.62), roughness: 0.4 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#f6f6f2', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const black = std({ color: '#1e1f24', roughness: 0.55 });
  const carbon = std({ color: '#2a2c33', roughness: 0.35, metalness: 0.4 });
  const rubber = std({ color: '#222327', roughness: 0.9 });
  const chrome = std({ color: '#e6e9ee', roughness: 0.15, metalness: 1 });
  const steel = std({ color: '#8d939c', roughness: 0.35, metalness: 0.9 });
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
  // adesivi sulle fiancate
  const decal = new THREE.MeshStandardMaterial({ map: decalTex(color), roughness: 0.4 });
  for (const s of [-1, 1]) {
    const d = add(cached('decal', () => new THREE.PlaneGeometry(1.4, 0.3)), decal, s * 1.395, 0.58, 0.05);
    d.rotation.y = s * Math.PI / 2;
  }
  // presa d'aria sul muso
  add(cached('intake', () => roundBox(0.9, 0.18, 0.12, 0.05)), carbon, 0, 0.52, 2.5);
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

  // ---------------------------------------------------------------- ruote (gomme scolpite, cerchi a 5 razze, disco del freno)
  const wheels = [];
  const lip = std({ color: C, roughness: 0.3, metalness: 0.5 });
  for (const [x, z, r, w] of [[-1.22, 1.45, 0.46, 0.5], [1.22, 1.45, 0.46, 0.5], [-1.28, -1.3, 0.56, 0.7], [1.28, -1.3, 0.56, 0.7]]) {
    const wg = new THREE.Group(); wg.position.set(x, r, z);
    const t = new THREE.Mesh(cached(`tyre${r}`, () => tyreGeo(r, w)), rubber); t.rotation.z = Math.PI / 2; wg.add(t);
    // scanalature del battistrada
    for (const o of [-0.22, 0, 0.22]) { const gr = new THREE.Mesh(cached(`groove${r}`, () => new THREE.TorusGeometry(r * 0.985, 0.025, 4, 30)), black); gr.rotation.y = Math.PI / 2; gr.position.x = o * w; wg.add(gr); }
    const rim = new THREE.Mesh(cached(`rim${r}`, () => new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.82, 24)), chrome); rim.rotation.z = Math.PI / 2; wg.add(rim);
    const rimLip = new THREE.Mesh(cached(`lip${r}`, () => new THREE.TorusGeometry(r * 0.6, 0.035, 6, 24)), lip); rimLip.rotation.y = Math.PI / 2; rimLip.position.x = Math.sign(x) * w * 0.42; wg.add(rimLip);
    const disc = new THREE.Mesh(cached(`disc${r}`, () => new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.05, 20)), steel); disc.rotation.z = Math.PI / 2; disc.position.x = -Math.sign(x) * w * 0.3; wg.add(disc);
    const hub = new THREE.Mesh(cached(`hub${r}`, () => new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 0.9, 12)), lip); hub.rotation.z = Math.PI / 2; wg.add(hub);
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5;
      const sp = new THREE.Mesh(cached(`spoke${r}`, () => new THREE.BoxGeometry(w * 0.86, r * 0.5, r * 0.12)), chrome);
      sp.rotation.x = a; sp.position.set(0, Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
      wg.add(sp);
    }
    body.add(wg); wheels.push(wg);
  }
  // pedali e catena
  for (const s of [-1, 1]) add(cached('pedal', () => roundBox(0.18, 0.28, 0.06, 0.02)), steel, s * 0.22, 0.62, 1.55).rotation.x = -0.5;
  add(cached('chain', () => new THREE.TorusGeometry(0.28, 0.035, 4, 18)), steel, 0.75, 0.6, -1.3).rotation.y = Math.PI / 2;
  // assale posteriore
  add(cached('axle', () => new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8)), black, 0, 0.56, -1.3).rotation.z = Math.PI / 2;

  // ---------------------------------------------------------------- pilota: tuta da corsa e casco integrale (niente faccia)
  const driver = new THREE.Group(); driver.position.set(0, 0, -0.4); body.add(driver);
  const suit = std({ color: C.clone().multiplyScalar(0.85), roughness: 0.6 });
  // busto con la fascia bianca
  add(cached('torso2', () => new THREE.CapsuleGeometry(0.42, 0.55, 6, 14)), suit, 0, 1.55, 0, driver).scale.set(1.15, 1, 0.85);
  add(cached('band', () => new THREE.CylinderGeometry(0.45, 0.47, 0.16, 18)), white, 0, 1.38, 0, driver).scale.set(1.15, 1, 0.85);
  add(cached('collar', () => new THREE.CylinderGeometry(0.2, 0.26, 0.18, 14)), black, 0, 2.08, 0.02, driver);
  // braccia tese verso il volante, guanti neri
  for (const s of [-1, 1]) {
    const up = add(cached('upperArm', () => new THREE.CapsuleGeometry(0.14, 0.42, 4, 10)), suit, s * 0.52, 1.72, 0.2, driver);
    up.rotation.set(1.0, 0, s * 0.25);
    const fore = add(cached('foreArm', () => new THREE.CapsuleGeometry(0.12, 0.4, 4, 10)), suit, s * 0.38, 1.48, 0.62, driver);
    fore.rotation.set(1.35, 0, s * 0.5);
    add(cached('glove2', () => new THREE.SphereGeometry(0.15, 12, 10)), black, s * 0.27, 1.38, 0.98, driver);
  }
  // casco integrale lucido con visiera scura a fascia
  const head = new THREE.Group(); head.position.set(0, 2.5, 0.05); driver.add(head);
  const helm = add(cached('helmet2', () => new THREE.SphereGeometry(0.5, 32, 24)), paint, 0, 0, 0, head);
  helm.scale.set(1, 1.02, 1.1);
  // mentoniera
  const chin = add(cached('chin', () => new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45)), paint, 0, -0.06, 0.07, head);
  chin.scale.set(1.05, 1, 1.15);
  // visiera: una fascia di sfera nera a specchio sul davanti
  const visor = add(cached('visor2', () => new THREE.SphereGeometry(0.515, 32, 10, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.36, Math.PI * 0.2)), new THREE.MeshPhysicalMaterial({ color: '#0e1320', roughness: 0.05, metalness: 0.7, clearcoat: 1 }), 0, 0.02, 0, head);
  visor.scale.set(1, 1.02, 1.1);
  // riga bianca centrale e spoiler dietro
  const stripe2 = add(cached('helmStripe', () => new THREE.TorusGeometry(0.51, 0.045, 6, 32, Math.PI)), white, 0, 0, 0, head);
  stripe2.rotation.set(0, Math.PI / 2, 0); stripe2.scale.set(1.1, 1.02, 1);
  

  return { body, wheels, paint, head };
}

// Le piste: curva chiusa, campionata per lunghezza d'arco.
// Nessuna dipendenza da Three.js, così la fisica gira anche senza grafica.
// - "prova": la pista all'aperto di prova (piatta, con una rampa)
// - "mancave": la Mancave in miniatura, con mobili da scalare, salti e zone speciali

export const TRACK_LIST = [
  { id: 'prova', name: 'Pista di prova' },
  { id: 'mancave', name: 'La Mancave' },
  { id: 'mall', name: 'Centro commerciale' },
  { id: 'hot', name: 'Pista Hot Wheels' },
];
const PORTALS_PROVA = [0.18, 0.47, 0.76];
const PIT_PROVA = 0.56;

const CONTROL = [
  [0, 0], [90, -5], [160, 15], [190, 70], [175, 125], [125, 145], [95, 185],
  [110, 240], [170, 258], [225, 235], [255, 180], [285, 120], [330, 100],
  [372, 132], [378, 205], [345, 280], [270, 325], [170, 335], [70, 315],
  [10, 265], [-20, 200], [-10, 140], [-40, 90], [-40, 35],
];

export const TRACK_HALF_WIDTH = 9;      // metà larghezza asfalto
export const WALL_OFFSET = 15;          // distanza dal centro del muretto
export const RAMP_LENGTH = 16;
export const RAMP_HEIGHT = 2.4;

const SCALE = 0.8;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

export function buildTrack(id = 'prova', step = 1.5) {
  if (typeof id === 'number') { step = id; id = 'prova'; }
  if (id === 'mancave') return buildMancave(step);
  if (id === 'mall') return buildMall(step);
  if (id === 'hot') return buildHot(step);
  const n = CONTROL.length;
  const C = CONTROL.map(([x, z]) => [x * SCALE, z * SCALE]);
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = C[(i - 1 + n) % n], p1 = C[i], p2 = C[(i + 1) % n], p3 = C[(i + 2) % n];
    for (let k = 0; k < 60; k++) dense.push(catmull(p0, p1, p2, p3, k / 60));
  }
  // lunghezze cumulative
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[cum.length - 1];
  const count = Math.round(length / step);
  const pts = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const d = (i / count) * length;
    while (cum[j + 1] < d) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length];
    const u = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pts.push({ x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, s: d });
  }
  for (let i = 0; i < count; i++) {
    const a = pts[(i - 1 + count) % count], b = pts[(i + 1) % count];
    let tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    pts[i].tx = tx; pts[i].tz = tz;
    pts[i].rx = -tz; pts[i].rz = tx; // destra rispetto al senso di marcia
  }
  // curvatura, per scegliere il rettilineo del salto
  for (let i = 0; i < count; i++) {
    const a = pts[(i - 3 + count) % count], b = pts[(i + 3) % count];
    pts[i].turn = Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz));
  }
  // il traguardo va su un rettilineo: la griglia sta dietro, la prima curva davanti
  const per = length / count;
  const back = Math.round(45 / per), ahead = Math.round(25 / per);
  let startIdx = 0, startScore = Infinity;
  for (let i = 0; i < Math.floor(count * 0.3); i++) {
    let sc = 0;
    for (let k = -back; k <= ahead; k++) sc = Math.max(sc, pts[(i + k + count) % count].turn);
    if (sc < startScore) { startScore = sc; startIdx = i; }
  }
  const rot = pts.splice(0, startIdx);
  pts.push(...rot);
  pts.forEach((p, i) => { p.s = i * per; });

  const rampSamples = Math.round(RAMP_LENGTH / (length / count));
  const win = rampSamples + Math.round(40 / (length / count));
  let best = -1, bestScore = Infinity;
  for (let i = Math.floor(count * 0.42); i < Math.floor(count * 0.85); i++) {
    let sc = 0;
    for (let k = 0; k < win; k++) sc = Math.max(sc, pts[(i + k) % count].turn);
    if (sc < bestScore) { bestScore = sc; best = i; }
  }
  const rampStart = (best + Math.round(8 / (length / count))) % count;
  const track = {
    id: 'prova', name: 'Pista di prova',
    pts, count, length, ds: length / count,
    rampStartS: pts[rampStart].s, rampEndS: pts[rampStart].s + RAMP_LENGTH,
    halfWidth: TRACK_HALF_WIDTH, wall: WALL_OFFSET,
    portalFractions: PORTALS_PROVA, pitFraction: PIT_PROVA,
  };
  return track;
}

// ------------------------------------------------------------------ La Mancave in miniatura
// Scala: 1 unità ≈ 2 cm. Un kart è un giocattolo di 6 cm, i mobili sono enormi.
// La stanza va da x -200 a 200 e da z -175 a 175 (8 x 7 metri).
// [x, z, altezza, zona fino al punto dopo, salto?]
// zone: floor (parquet), rug (tappeto), bar (lungo il bancone), spill (birra versata: si scivola),
// under (sotto il divano), diner (sotto il tavolo da pranzo), ramp (asse che sale), table (tavolino: senza bordi),
// pouf (il pouf dopo il salto)
// salto = l'altezza cambia di colpo in questo punto (si vola giù)
const MANCAVE = [
  [20, -112, 0, 'floor'], [80, -110, 0, 'floor'], [118, -92, 0, 'floor'],
  [138, -55, 0, 'bar'], [142, -10, 0, 'bar'], [142, 35, 0, 'floor'], [136, 75, 0, 'spill'],
  [118, 108, 0, 'floor'], [85, 130, 0, 'floor'],
  [45, 140, 0, 'under'], [0, 142, 0, 'under'], [-50, 142, 0, 'under'], [-90, 138, 0, 'floor'],
  [-125, 122, 0, 'floor'], [-148, 92, 0, 'floor'],
  [-137, 62, 0, 'floor'], [-153, 32, 0, 'floor'], [-139, 2, 0, 'floor'], [-157, -30, 0, 'diner'],
  [-165, -70, 0, 'diner'], [-160, -110, 0, 'floor'], [-140, -138, 0, 'floor'], [-112, -136, 0, 'floor'],
  [-98, -105, 0, 'floor'], [-98, -60, 0, 'ramp'], [-96, -28, 7, 'ramp'],
  [-82, 22, 18, 'table'], [-72, 48, 18, 'table'], [-48, 62, 18, 'table'], [-12, 60, 18, 'table'],
  [14, 54, 10, 'pouf', true], [30, 46, 10, 'pouf'], [55, 30, 4, 'rug'],
  [78, 8, 0, 'rug'], [72, -22, 0, 'floor'], [45, -38, 0, 'floor'], [10, -38, 0, 'floor'], [-25, -48, 0, 'floor'],
  [-50, -68, 0, 'floor'], [-62, -90, 0, 'floor'], [-40, -108, 0, 'floor'],
];
const MANCAVE_SCALE = 1;

function buildMancave(step) {
  const t = buildCtrl(MANCAVE, step);
  const { sNear, length } = t;
  const portalFractions = [sNear(90, -106) / length, sNear(-140, 110) / length, sNear(25, -38) / length];
  const pitFraction = sNear(141, -20) / length;            // lungo il bancone del bar
  return {
    ...t.track, id: 'mancave', name: 'La Mancave', portalFractions, pitFraction,
    marks: { vacuum: sNear(-5, -42), cat: sNear(-146, 48), bar: sNear(141, -20), spill: sNear(132, 90) },
  };
}

// pista da punti di controllo [x, z, altezza, zona, salto?] (Mancave, Centro commerciale...)
function buildCtrl(CTRL, step) {
  const MANCAVE = CTRL;
  const n = MANCAVE.length;
  const C = MANCAVE.map(([x, z]) => [x * MANCAVE_SCALE, z * MANCAVE_SCALE]);
  // curva liscia, ricordando da quale punto di controllo viene ogni campione
  const dense = [], from = [];
  for (let i = 0; i < n; i++) {
    const p0 = C[(i - 1 + n) % n], p1 = C[i], p2 = C[(i + 1) % n], p3 = C[(i + 2) % n];
    for (let k = 0; k < 60; k++) { dense.push(catmull(p0, p1, p2, p3, k / 60)); from.push(i + k / 60); }
  }
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[cum.length - 1];
  const count = Math.round(length / step);
  const pts = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const d = (i / count) * length;
    while (cum[j + 1] < d) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length];
    const u = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pts.push({ x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, s: d, cp: from[j] + (from[(j + 1) % from.length] - from[j] + (j + 1 === from.length ? n : 0)) * u });
  }
  const ds = length / count;
  for (let i = 0; i < count; i++) {
    const a = pts[(i - 1 + count) % count], b = pts[(i + 1) % count];
    let tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    pts[i].tx = tx; pts[i].tz = tz;
    pts[i].rx = -tz; pts[i].rz = tx;
    pts[i].turn = 0;
  }
  // altezze e zone: tra due punti di controllo l'altezza cambia in modo lineare (rampe);
  // dove c'è un salto resta in alto fino al bordo e poi cade di colpo
  const hs = new Float32Array(count), zone = new Array(count), step0 = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const cp = pts[i].cp % n;
    const a = Math.floor(cp), u = cp - a, b = (a + 1) % n;
    const A = MANCAVE[a], B = MANCAVE[b];
    hs[i] = B[4] ? A[2] : A[2] + (B[2] - A[2]) * u;
    zone[i] = A[3];
    // piccole onde sui cuscini del divano
  }
  // nel buco dopo il trampolino non c'è pavimento: si cade di sotto
  for (let i = 0; i < count; i++) if (zone[i] === 'gap') hs[i] = -60;
  for (let i = 1; i < count; i++) if (hs[i] < hs[i - 1] - 3) step0[i] = 1;
  // punti notevoli (come distanza dal via)
  const sAt = (cpIdx, frac = 0) => { let best = 0, bd = Infinity; for (let i = 0; i < count; i++) { const d = Math.abs(pts[i].cp - (cpIdx + frac)); if (d < bd) { bd = d; best = i; } } return pts[best].s; };
  const sNear = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < count; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return pts[best].s; };
  // curve sopraelevate (zona 'bank'): il lato esterno della curva è più alto (pendenza per unità di lato)
  let bank = null;
  if (zone.includes('bank')) {
    const raw = new Float32Array(count);
    const K = 6;
    for (let i = 0; i < count; i++) {
      if (zone[i] !== 'bank') continue;
      const a = pts[(i - K + count) % count], b = pts[(i + K) % count], p = pts[i];
      // verso il centro della curva: da che parte gira la strada
      const cx = b.tx - a.tx, cz = b.tz - a.tz, mag = Math.hypot(cx, cz);
      const side = cx * p.rx + cz * p.rz;                 // > 0: il centro è a destra
      raw[i] = -Math.sign(side) * Math.min(0.42, mag * 0.9);
    }
    bank = new Float32Array(count);
    const W = 14;
    for (let i = 0; i < count; i++) { let sm = 0; for (let k = -W; k <= W; k++) sm += raw[(i + k + count) % count]; bank[i] = sm / (2 * W + 1); }
  }
  // giri della morte (zona 'loop'): un rettilineo "virtuale" che si vede come un anello verticale
  const loops = [];
  for (let i = 0; i < count; i++) {
    if (zone[i] === 'loop' && zone[(i - 1 + count) % count] !== 'loop') {
      let j = i; while (zone[(j + 1) % count] === 'loop') j++;
      const a = pts[i], b = pts[j % count], L = Math.hypot(b.x - a.x, b.z - a.z);
      loops.push({ i0: i, i1: j, s0: a.s, s1: pts[j % count].s + ds, fx: (b.x - a.x) / L, fz: (b.z - a.z) / L, R: L / (1.6 * Math.PI) });
    }
  }
  return {
    sNear, sAt, length,
    track: { pts, count, length, ds, hs, zone, step: step0, bank, loops, rampStartS: -1e9, rampEndS: -1e9, halfWidth: 8.5, wall: 13.5 },
  };
}

// dove si vede davvero un kart che è nel giro della morte: { x, y, z, pitch } (o null fuori dal giro)
// avanti: f(u) = R·sin(2πu) in più del rettilineo, su: R·(1 − cos 2πu); in cima si è a testa in giù
export function loopPose(track, s, x, y, z) {
  if (!track.loops || !track.loops.length) return null;
  for (const L of track.loops) {
    if (s < L.s0 || s > L.s1) continue;
    const len = L.s1 - L.s0, u = (s - L.s0) / len, w = 2 * Math.PI * u;
    const f = L.R * Math.sin(w), h = L.R * (1 - Math.cos(w));
    // pendenza: derivate rispetto a u
    const df = len + L.R * 2 * Math.PI * Math.cos(w), dh = L.R * 2 * Math.PI * Math.sin(w);
    return { x: x + L.fx * f, y: y + h, z: z + L.fz * f, pitch: Math.atan2(dh, df), u, L };
  }
  return null;
}

// ------------------------------------------------------------------ Pista Hot Wheels: pista arancione sospesa in una cameretta
// zone: track (pista normale), bank (curva sopraelevata), boost (spinta turbo), loop (giro della morte),
// ramp (trampolino che sale), gap (il buco dopo il salto: se ci arrivi piano, cadi)
const HOT = [
  [-110, -150, 8, 'track'], [-20, -152, 8, 'boost'], [60, -150, 8, 'track'],
  [130, -135, 9, 'bank'], [170, -90, 11, 'bank'], [178, -30, 14, 'track'],
  [165, 25, 20, 'track'], [140, 62, 26, 'track'],
  [110, 74, 26, 'loop'], [38, 94, 26, 'track'], [8, 102, 26, 'track'],
  [-25, 108, 26, 'ramp'], [-48, 110, 33, 'ramp'], [-58, 110, 14, 'gap', true], [-82, 107, 14, 'track'], [-104, 100, 14, 'track'],
  [-130, 88, 14, 'bank'], [-160, 48, 13, 'bank'], [-150, 5, 12, 'track'],
  [-110, -15, 12, 'track'], [-62, 0, 14, 'boost'], [-18, 20, 16, 'track'],
  [24, 2, 16, 'bank'], [30, -45, 14, 'bank'], [-5, -80, 12, 'track'],
  [-60, -96, 10, 'track'], [-128, -108, 9, 'bank'], [-168, -138, 8, 'bank'], [-148, -156, 8, 'track'],
];
function buildHot(step) {
  const t = buildCtrl(HOT, step);
  const { sNear, length } = t;
  return {
    ...t.track, id: 'hot', name: 'Pista Hot Wheels',
    portalFractions: [sNear(175, -60) / length, sNear(-150, 20) / length, sNear(10, 15) / length],
    pitFraction: sNear(160, 30) / length,
    marks: {},
  };
}

// ------------------------------------------------------------------ Centro commerciale (kart giocattolo, scala 1 unità ≈ 4 cm)
// La "piazza" va da x -200 a 200 e da z -175 a 175. Zone: floor (pavimento lucido), piazza (intorno alla fontana),
// esc (scala mobile che sale), gallery (balconata al primo piano), stage (pedana dell'auto in mostra, scende),
// door (porte automatiche del supermercato), market (corsie del supermercato), spill (pavimento bagnato: si scivola)
const MALL = [
  [-40, -132, 0, 'floor'], [40, -134, 0, 'floor'], [110, -128, 0, 'floor'], [150, -108, 0, 'floor'],
  [166, -70, 0, 'floor'], [164, -30, 0, 'floor'], [140, -10, 0, 'floor'],
  [100, -32, 0, 'piazza'], [55, -58, 0, 'piazza'], [5, -54, 0, 'piazza'], [-30, -20, 0, 'piazza'], [-24, 30, 0, 'piazza'],
  [15, 60, 0, 'piazza'], [70, 70, 0, 'floor'], [118, 76, 0, 'floor'], [152, 94, 0, 'floor'], [150, 118, 0, 'floor'],
  [125, 130, 0, 'esc'], [55, 140, 34, 'gallery'], [0, 142, 34, 'gallery'], [-55, 141, 34, 'gallery'], [-96, 130, 34, 'gallery'],
  [-120, 106, 16, 'stage', true], [-133, 80, 16, 'stage'], [-142, 50, 0, 'floor'],
  [-150, 22, 0, 'door'], [-157, -8, 0, 'market'], [-160, -45, 0, 'spill'], [-158, -80, 0, 'market'],
  [-142, -112, 0, 'floor'], [-100, -132, 0, 'floor'],
];
function buildMall(step) {
  const t = buildCtrl(MALL, step);
  const { sNear, length } = t;
  return {
    ...t.track, id: 'mall', name: 'Centro commerciale',
    portalFractions: [sNear(100, -130) / length, sNear(-20, 40) / length, sNear(-158, -40) / length],
    pitFraction: sNear(165, -40) / length,
    marks: { door: sNear(-150, 22), cart1: sNear(-158, -75), cart2: sNear(40, -57), fountain: { x: 60, z: 6 } },
  };
}

export function zoneAt(track, s) {
  if (!track.zone) return '';
  return track.zone[Math.floor(((s % track.length) + track.length) % track.length / track.ds) % track.count];
}

// ostacoli che si muovono (aspirapolvere robot e gatto): dipendono solo dal tempo di gara,
// così ogni schermo li vede uguali senza mandarli in rete
export function obstaclesAt(track, t) {
  if (track.id === 'mall') return mallObstacles(track, t);
  if (track.id !== 'mancave') return [];
  const out = [];
  const at = (s, lat, y = 0) => {
    const p = track.pts[Math.floor(s / track.ds) % track.count];
    return { x: p.x + p.rx * lat, z: p.z + p.rz * lat, y, yaw: Math.atan2(p.tx, p.tz) };
  };
  // aspirapolvere robot: va avanti e indietro attraverso la pista nel rettilineo centrale
  const v = at(track.marks.vacuum, Math.sin(t * Math.PI * 2 / 10) * 9);
  out.push({ kind: 'vacuum', r: 4.2, ...v });
  // gatto: ogni 14 secondi attraversa la pista vicino al tavolo da pranzo
  const ph = ((t % 14) + 14) % 14;
  if (ph < 4.5) { const c = at(track.marks.cat, -30 + 60 * (ph / 4.5)); out.push({ kind: 'cat', r: 4, ...c, yaw: c.yaw + Math.PI / 2 }); }
  return out;
}

// Centro commerciale: carrelli della spesa che attraversano la pista e porte automatiche del supermercato
// (porte chiuse = ostacolo per tutta la larghezza: bisogna passare quando sono aperte)
export const DOOR_CYCLE = 6, DOOR_OPEN = 3.8;
export function doorOpen(t) { const ph = ((t % DOOR_CYCLE) + DOOR_CYCLE) % DOOR_CYCLE; return ph < DOOR_OPEN ? Math.min(1, ph / 0.5, (DOOR_OPEN - ph) / 0.5) : 0; }
function mallObstacles(track, t) {
  const out = [];
  const at = (s, lat) => {
    const p = track.pts[Math.floor(((s % track.length) + track.length) % track.length / track.ds) % track.count];
    return { x: p.x + p.rx * lat, z: p.z + p.rz * lat, y: 0, yaw: Math.atan2(p.tx, p.tz) };
  };
  // carrelli: attraversano la pista ogni tanto (sfasati)
  for (const [mk, per, off] of [['cart1', 9, 0], ['cart2', 11, 4]]) {
    const ph = (((t + off) % per) + per) % per;
    if (ph < 4) { const c = at(track.marks[mk], -30 + 60 * (ph / 4)); out.push({ kind: mk, r: 5, ...c, yaw: c.yaw + Math.PI / 2 }); }
  }
  // porte chiuse: tre "pezzi" che coprono la strada
  if (doorOpen(t) < 0.35) for (const lat of [-6, 0, 6]) out.push({ kind: 'door', r: 3.2, ...at(track.marks.door, lat) });
  return out;
}

// altezza del terreno a progresso s e scostamento laterale lat
export function groundHeight(track, s, lat) {
  if (track.hs) {
    const L = track.length;
    s = ((s % L) + L) % L;
    const f = s / track.ds, i = Math.floor(f) % track.count, i2 = (i + 1) % track.count;
    const bk = track.bank ? track.bank[i] * Math.max(-track.wall, Math.min(track.wall, lat)) : 0;
    if (track.step[i2]) return track.hs[i] + bk;
    return track.hs[i] + (track.hs[i2] - track.hs[i]) * (f - Math.floor(f)) + bk;
  }
  if (Math.abs(lat) > track.halfWidth + 0.5) return 0;
  const d = s - track.rampStartS;
  if (d >= 0 && d <= RAMP_LENGTH) return RAMP_HEIGHT * (d / RAMP_LENGTH);
  return 0;
}

// trova il campione più vicino partendo da un indice noto
export function locate(track, x, z, hint = -1) {
  const { pts, count } = track;
  let best = 0, bd = Infinity;
  if (hint < 0) {
    for (let i = 0; i < count; i++) {
      const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  } else {
    for (let k = -40; k <= 40; k++) {
      const i = (hint + k + count) % count;
      const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  }
  const p = pts[best];
  const dx = x - p.x, dz = z - p.z;
  const along = dx * p.tx + dz * p.tz;
  const lat = dx * p.rx + dz * p.rz;
  let s = p.s + along;
  if (s < 0) s += track.length;
  if (s >= track.length) s -= track.length;
  return { idx: best, lat, s };
}

// ------------------------------------------------------------------ mobili solidi
// track.solid è una griglia (riempita dalla grafica quando i mobili sono caricati): per ogni cella
// le fasce di altezza occupate. Un kart (o la telecamera) non può entrare in una cella occupata alla sua altezza.
export function solidAt(track, x, z, y0, y1) {
  const S = track.solid;
  if (!S) return false;
  const i = Math.floor((x - S.x0) / S.cs), j = Math.floor((z - S.z0) / S.cs);
  if (i < 0 || j < 0 || i >= S.nx || j >= S.nz) return false;
  const spans = S.cells.get(j * S.nx + i);
  if (!spans) return false;
  for (let k = 0; k < spans.length; k += 2) if (spans[k] < y1 && spans[k + 1] > y0) return true;
  return false;
}
// il kart è un cerchio di raggio ~1,2 alto ~3
export function kartBlocked(track, x, z, y) {
  if (!track.solid) return false;
  const y0 = y + 0.35, y1 = y + 3;
  if (solidAt(track, x, z, y0, y1)) return true;
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4;
    if (solidAt(track, x + Math.cos(ang) * 1.2, z + Math.sin(ang) * 1.2, y0, y1)) return true;
  }
  return false;
}

// direzione per uscire dai mobili (somma delle direzioni libere meno quelle occupate), o null
export function solidPush(track, x, z, y, r = 1.6) {
  if (!track.solid) return null;
  let px = 0, pz = 0, hit = false;
  for (let a = 0; a < 12; a++) {
    const ang = a * Math.PI / 6, cx = Math.cos(ang), cz = Math.sin(ang);
    for (const rr of [r * 0.6, r]) if (solidAt(track, x + cx * rr, z + cz * rr, y + 0.35, y + 3)) { px -= cx; pz -= cz; hit = true; break; }
  }
  if (!hit) return null;
  const l = Math.hypot(px, pz) || 1;
  return { x: px / l, z: pz / l };
}

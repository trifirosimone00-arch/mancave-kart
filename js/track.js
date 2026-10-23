// Le piste: curva chiusa, campionata per lunghezza d'arco.
// Nessuna dipendenza da Three.js, così la fisica gira anche senza grafica.
// - "prova": la pista all'aperto di prova (piatta, con una rampa)
// - "mancave": la Mancave in miniatura, con mobili da scalare, salti e zone speciali

export const TRACK_LIST = [
  { id: 'prova', name: 'Pista di prova' },
  { id: 'mancave', name: 'La Mancave' },
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
// [x, z, altezza, zona fino al punto dopo, salto?]
// zone: rug (tappeto), books (rampa di libri), tv (mobile TV), floor (pavimento), sofa (divano),
// arm (bracciolo), bar (bancone), fridge (frigo: si scivola), kitchen, chair, table (tavolo: senza bordi), foos (biliardino)
// salto = l'altezza cambia di colpo in questo punto (si vola giù)
const MANCAVE = [
  [0, 0, 0, 'rug'], [80, 0, 0, 'rug'], [140, 4, 0, 'books'], [200, 8, 12, 'tv'], [320, 8, 12, 'tv'], [380, 24, 12, 'tv'],
  [405, 75, 0, 'floor'], [420, 130, 0, 'floor'], [425, 180, 10, 'sofa'], [425, 250, 10, 'sofa'], [425, 320, 10, 'arm'],
  [420, 350, 13, 'arm'], [415, 368, 0, 'floor', true], [405, 420, 0, 'floor'], [370, 460, 0, 'floor'],
  [310, 472, 0, 'bar'], [250, 474, 14, 'bar'], [130, 474, 14, 'bar'], [50, 470, 0, 'kitchen'], [-10, 458, 0, 'fridge'],
  [-70, 440, 0, 'fridge'], [-110, 400, 0, 'kitchen'], [-130, 345, 0, 'chair'], [-135, 290, 12, 'table'], [-135, 200, 12, 'table'],
  [-130, 152, 0, 'floor', true], [-115, 95, 0, 'foos'], [-90, 50, 0, 'foos'], [-50, 12, 0, 'rug'],
];
const MANCAVE_SCALE = 1;

function buildMancave(step) {
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
    if (A[3] === 'sofa' && B[3] !== 'floor') hs[i] += Math.sin(pts[i].s * 0.22) * 0.45 * Math.min(1, u * 4, (1 - u) * 4);
  }
  for (let i = 1; i < count; i++) if (hs[i] < hs[i - 1] - 3) step0[i] = 1;
  // punti notevoli (come distanza dal via)
  const sAt = (cpIdx, frac = 0) => { let best = 0, bd = Infinity; for (let i = 0; i < count; i++) { const d = Math.abs(pts[i].cp - (cpIdx + frac)); if (d < bd) { bd = d; best = i; } } return pts[best].s; };
  const portalFractions = [sAt(1, 0.3) / length, sAt(9, 0.2) / length, sAt(21, 0.5) / length];
  const pitFraction = sAt(16, 0.55) / length;              // sul bancone del bar
  return {
    id: 'mancave', name: 'La Mancave',
    pts, count, length, ds, hs, zone, step: step0,
    rampStartS: -1e9, rampEndS: -1e9,
    halfWidth: 8.5, wall: 13.5,
    portalFractions, pitFraction,
    marks: { vacuum: sAt(1, 0.75), cat: sAt(19, 0.3), sink: sAt(21, 0.1), bar: sAt(16, 0.5), tv: sAt(4, 0), table: sAt(23, 0.5), foos: sAt(26, 0.5), sofa: sAt(9, 0) },
  };
}

export function zoneAt(track, s) {
  if (!track.zone) return '';
  return track.zone[Math.floor(((s % track.length) + track.length) % track.length / track.ds) % track.count];
}

// ostacoli che si muovono (aspirapolvere robot e gatto): dipendono solo dal tempo di gara,
// così ogni schermo li vede uguali senza mandarli in rete
export function obstaclesAt(track, t) {
  if (track.id !== 'mancave') return [];
  const out = [];
  const at = (s, lat, y = 0) => {
    const p = track.pts[Math.floor(s / track.ds) % track.count];
    return { x: p.x + p.rx * lat, z: p.z + p.rz * lat, y, yaw: Math.atan2(p.tx, p.tz) };
  };
  // aspirapolvere: va avanti e indietro attraverso la pista sul tappeto
  const v = at(track.marks.vacuum, Math.sin(t * Math.PI * 2 / 9) * 12);
  out.push({ kind: 'vacuum', r: 2.2, ...v });
  // gatto: ogni 14 secondi attraversa la cucina
  const ph = ((t % 14) + 14) % 14;
  if (ph < 4) { const c = at(track.marks.cat, -22 + 44 * (ph / 4)); out.push({ kind: 'cat', r: 1.8, ...c, yaw: c.yaw + Math.PI / 2 }); }
  return out;
}

// altezza del terreno a progresso s e scostamento laterale lat
export function groundHeight(track, s, lat) {
  if (track.hs) {
    const L = track.length;
    s = ((s % L) + L) % L;
    const f = s / track.ds, i = Math.floor(f) % track.count, i2 = (i + 1) % track.count;
    if (track.step[i2]) return track.hs[i];
    return track.hs[i] + (track.hs[i2] - track.hs[i]) * (f - Math.floor(f));
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

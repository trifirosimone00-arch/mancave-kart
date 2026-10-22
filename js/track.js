// Pista di prova: curva chiusa, campionata per lunghezza d'arco.
// Nessuna dipendenza da Three.js, così la fisica gira anche senza grafica.

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

export function buildTrack(step = 1.5) {
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
    pts, count, length, ds: length / count,
    rampStartS: pts[rampStart].s, rampEndS: pts[rampStart].s + RAMP_LENGTH,
    halfWidth: TRACK_HALF_WIDTH, wall: WALL_OFFSET,
  };
  return track;
}

// altezza del terreno a progresso s e scostamento laterale lat
export function groundHeight(track, s, lat) {
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

// Minigiochi col kart: si gioca in un'arena (un grande tavolo da gioco accanto alla Mancave).
// Niente Three.js qui: regole, fisica semplice degli oggetti e piloti del computer.
// Il PC principale tiene lo stato del gioco (P.ka, viaggia dentro W.pit); ogni schermo
// muove i propri kart con stepArenaKart e applica quello che il PC decide (fermo, eliminato).

export const OX = 1500, OZ = 0;          // centro dell'arena (lontano dalla pista)
export const HW = 44, HD = 28;           // metà larghezza e metà profondità del campo
const KR = 2.1;                          // raggio del kart
const ARENA_MAX = 20;

// ------------------------------------------------------------------ numeri a caso dentro lo stato (si può mandare in rete)
function rr(ka) { ka.rs = (Math.imul(ka.rs, 1664525) + 1013904223) >>> 0; return ka.rs / 4294967296; }
const rnd = (ka, a, b) => a + rr(ka) * (b - a);
const ptIn = (ka, m = 8) => ({ x: OX + (rr(ka) * 2 - 1) * (HW - m), z: OZ + (rr(ka) * 2 - 1) * (HD - m) });
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clampIn = (p, m = 4) => ({ x: Math.max(OX - HW + m, Math.min(OX + HW - m, p.x)), z: Math.max(OZ - HD + m, Math.min(OZ + HD - m, p.z)) });

// ------------------------------------------------------------------ i giochi
// kind/title/help per la TV e il telefono; dur = durata (1 minuto), short = versione corta
export const KART_GAMES = {
  parcheggio: { title: 'Parcheggio', emoji: '🅿️', dur: 50, short: 30, help: 'Un posto auto si accende sul tavolo: entraci e fermati (FRENO) dentro le strisce. Ogni parcheggio è un punto.' },
  slalom:     { title: 'Slalom tra le lattine', emoji: '🥫', dur: 50, short: 30, help: 'Passa tra le lattine in ordine, porta dopo porta. Chi passa più porte vince.' },
  bowling:    { title: 'Bowling', emoji: '🎳', dur: 45, short: 30, help: 'Butta giù i birilli col kart! Ogni birillo che cade è un punto per chi l\'ha colpito.' },
  collina:    { title: 'Re della collina', emoji: '👑', dur: 45, short: 30, help: 'Resta nel cerchio dorato: da solo fai punti doppi. Spingi fuori gli altri a spallate.' },
  autoscontro:{ title: 'Autoscontro', emoji: '💥', dur: 45, short: 30, help: 'Centra gli altri col muso del kart: ogni botta data è un punto, chi la prende gira su se stesso.' },
  patata:     { title: 'Patata bollente', emoji: '💣', dur: 75, short: 45, help: 'Chi ha la bomba la passa toccando un altro kart. Quando scoppia, chi ce l\'ha è fuori. L\'ultimo rimasto vince.' },
  bandiera:   { title: 'Ruba bandiera', emoji: '🚩', dur: 50, short: 30, help: 'Prendi la bandiera in mezzo e portala nella tua base (il cerchio del tuo colore). Tocca chi ce l\'ha per rubargliela.' },
  calcetto:   { title: 'Calcetto', emoji: '⚽', dur: 60, short: 40, help: 'Due squadre, un pallone gigante: spingilo nella porta degli avversari col kart.' },
  aspirapolvere: { title: 'Fuga dall\'aspirapolvere', emoji: '🧹', dur: 60, short: 40, help: 'L\'aspirapolvere robot insegue chi gli è più vicino e va sempre più forte. Chi viene risucchiato è fuori.' },
  pavimento:  { title: 'Pavimento che crolla', emoji: '🧱', dur: 75, short: 45, help: 'Le piastrelle dove passi si crepano e crollano. Non fermarti e non finire nei buchi: l\'ultimo rimasto vince.' },
  birra:      { title: 'Consegna la birra', emoji: '🍺', dur: 50, short: 30, help: 'Prendi una birra e portala al divano. Se ti speronano la fai cadere!' },
  raccogli:   { title: 'Raccogli le patatine', emoji: '🍟', dur: 40, short: 30, help: 'Passa sopra alle patatine: 1 punto. Quelle dorate valgono 3.' },
  gatto:      { title: 'Scappa dal gatto', emoji: '🐈', dur: 50, short: 30, help: 'Ogni secondo vale un punto. Il gatto prende la mira (cerchio rosso) e salta: se ti prende perdi 5 punti.' },
  biliardo:   { title: 'Biliardo', emoji: '🎱', dur: 60, short: 40, help: 'Spingi le palle nelle buche col kart. Ogni palla in buca è un punto per l\'ultimo che l\'ha toccata.' },
  monete:     { title: 'Raccogli le monete', emoji: '🪙', dur: 45, short: 30, help: 'Raccogli più monete che puoi. Se ti speronano ne perdi 3 per terra!' },
  battaglia:  { title: 'Battaglia', emoji: '🎈', dur: 90, short: 60, help: 'Ogni kart ha 3 palloncini. Centra gli altri col muso per scoppiarne uno. Senza palloncini sei fuori: l\'ultimo rimasto vince.' },
};
export const KART_IDS = Object.keys(KART_GAMES);
// giochi a eliminazione (classifica per chi resta più a lungo)
const ELIM = new Set(['patata', 'aspirapolvere', 'pavimento', 'battaglia']);

// tavolo da biliardo: 6 buche; calcetto: porte sui lati corti
export const POCKETS = [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]].map(([a, b]) => ({ x: OX + a * (HW - 1.5), z: OZ + b * (HD - 1.5) }));
export const GOAL_HALF = 8;
export const TILE = 8, TNX = 11, TNZ = 7;
const SLALOM_N = 10;
export function slalomGates() {
  const out = [];
  for (let i = 0; i < SLALOM_N; i++) {
    const a = i / SLALOM_N * Math.PI * 2;
    const r = i % 2 ? 0.5 : 0.82;
    const x = OX + Math.cos(a) * (HW - 8) * r, z = OZ + Math.sin(a) * (HD - 6) * r;
    out.push({ x, z });
  }
  // le lattine stanno di traverso rispetto alla strada (perpendicolari a chi arriva)
  out.forEach((g, i) => {
    const p = out[(i - 1 + out.length) % out.length], n = out[(i + 1) % out.length];
    const dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1;
    g.px = -dz / l; g.pz = dx / l;
  });
  return out;
}
const BASES = [[-1, -1], [1, 1], [1, -1], [-1, 1]].map(([a, b]) => ({ x: OX + a * (HW - 8), z: OZ + b * (HD - 7) }));

// dove partono i kart (slots nell'ordine dei giocatori)
export function spawnOf(game, idx, n) {
  if (game === 'calcetto') {
    const team = idx % 2, row = Math.floor(idx / 2);
    return { x: OX + (team ? 22 : -22), z: OZ + (row ? 9 : -9) * (n > 2 ? 1 : 0), yaw: team ? -Math.PI / 2 : Math.PI / 2 };
  }
  if (game === 'slalom') return { x: OX + (HW - 8) * 0.82 + (idx - 1.5) * 4.5, z: OZ - 10, yaw: 0 };
  const c = [[-1, -1], [1, 1], [1, -1], [-1, 1]][idx % 4];
  const x = OX + c[0] * (HW - 10), z = OZ + c[1] * (HD - 8);
  return { x, z, yaw: Math.atan2(OX - x, OZ - z) };
}

// ------------------------------------------------------------------ stato iniziale (PC principale)
export function kgInit(game, seed, slots) {
  const ka = { g: game, rs: (seed >>> 0) || 1, t: 0, sc: {}, out: {}, stun: {}, hold: {}, items: [], nid: 1, fx: [], cd: {}, over: false, slots: [...slots] };
  for (const s of slots) ka.sc[s] = 0;
  const add = (o) => { o.id = ka.nid++; ka.items.push(o); return o; };
  switch (game) {
    case 'parcheggio': newSpot(ka); ka.park = {}; break;
    case 'slalom': ka.gate = {}; for (const s of slots) ka.gate[s] = 0; break;
    case 'bowling': rackPins(ka, add); break;
    case 'collina': ka.hill = { x: OX, z: OZ, r: 9 }; ka.hillT = 0; break;
    case 'patata': ka.bomb = slots[Math.floor(rr(ka) * slots.length)]; ka.bt = rnd(ka, 11, 15); ka.passCD = 0; break;
    case 'bandiera': ka.flag = { x: OX, z: OZ, by: -1 }; ka.base = {}; slots.forEach((s, i) => { ka.base[s] = BASES[i % 4]; }); break;
    case 'calcetto': add({ k: 'ball', x: OX, z: OZ, vx: 0, vz: 0, r: 3.2, by: -1 }); ka.team = {}; slots.forEach((s, i) => { ka.team[s] = i % 2; }); ka.tg = [0, 0]; break;
    case 'aspirapolvere': ka.vac = { x: OX, z: OZ, yaw: 0, sp: 8 }; break;
    case 'pavimento': ka.tl = Array(TNX * TNZ).fill(0); break;
    case 'birra': ka.sofa = ptIn(ka, 10); for (let i = 0; i < 2; i++) add({ k: 'beer', ...ptIn(ka, 8) }); break;
    case 'raccogli': ka.want = 8; break;
    case 'gatto': ka.cat = { x: OX, z: OZ - HD - 6, ph: 'rest', pt: 0, tx: OX, tz: OZ, fx: OX, fz: OZ }; for (const s of slots) ka.sc[s] = 0; break;
    case 'biliardo': rackBalls(ka, add); break;
    case 'monete': ka.want = 10; break;
    case 'battaglia': ka.bal = {}; for (const s of slots) ka.bal[s] = 3; break;
  }
  return ka;
}
function newSpot(ka) { const p = ptIn(ka, 12); ka.spot = { x: p.x, z: p.z, yaw: rr(ka) < 0.5 ? 0 : Math.PI / 2 }; }
function rackPins(ka, add) {
  ka.items = ka.items.filter(o => o.k !== 'pin');
  let n = 0;
  for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) {
    add({ k: 'pin', x: OX + (i - row / 2) * 3.4, z: OZ + 4 - row * 3, vx: 0, vz: 0, r: 0.9, up: 1, by: -1, n: n++ });
  }
  ka.downT = -1;
}
function rackBalls(ka, add) {
  const cols = ['#ffd400', '#2f7bff', '#e8322b', '#9b5cff', '#ff8a00', '#2ec46b', '#8b1a1a'];
  let n = 0;
  for (let row = 0; row < 3; row++) for (let i = 0; i <= row; i++) {
    if (n >= 6) break;
    add({ k: 'pball', x: OX + 6 + row * 3.1, z: OZ + (i - row / 2) * 3.2, vx: 0, vz: 0, r: 1.5, c: cols[n++], by: -1 });
  }
  add({ k: 'pball', x: OX - 14, z: OZ, vx: 0, vz: 0, r: 1.5, c: '#111', by: -1 });
}

// ------------------------------------------------------------------ fisica del kart nell'arena (ogni schermo per i propri kart)
// ctx: { stun, out, fall, solids: [{x,z,r}], frozen }
export function stepArenaKart(k, input, dt, ctx = {}) {
  k.events.length = 0;
  k.contacts.length = 0;
  if (k.bumpCD > 0) k.bumpCD -= dt;
  if (ctx.out) {
    k.speed *= Math.pow(0.05, dt); k.drifting = false;
    if (ctx.fall) { k.vy = (k.vy || 0) - 30 * dt; k.y = Math.max(-40, k.y + k.vy * dt); k.air = true; }
    k.x += Math.sin(k.yaw) * k.speed * dt; k.z += Math.cos(k.yaw) * k.speed * dt;
    return;
  }
  k.y = 0; k.vy = 0; k.air = false;
  let steer = Math.max(-1, Math.min(1, input.steer || 0));
  const brake = !!input.brake, drift = !!input.drift;
  if (ctx.frozen) { k.speed = 0; k.drifting = false; return; }
  if (ctx.stun) { k.spinT = Math.max(k.spinT || 0, 0.15); k.speed *= Math.pow(0.1, dt); k.yaw += dt * 9; moveArena(k, dt, ctx); return; }
  k.spinT = 0;
  const max = ARENA_MAX * (ctx.speedMul || 1);
  if (brake) { if (k.speed > 0.5) k.speed -= 42 * dt; else k.speed = Math.max(k.speed - 14 * dt, -10); }
  else if (k.speed < max) k.speed = Math.min(max, k.speed + 20 * (1.1 - 0.6 * Math.max(0, k.speed) / max) * dt);
  else k.speed = Math.max(max, k.speed - 25 * dt);
  k.drifting = drift && Math.abs(steer) > 0.25 && k.speed > 8;
  k.driftDir = k.drifting ? Math.sign(steer) : 0;
  k.driftT = k.drifting ? (k.driftT || 0) + dt : 0;
  k.driftCharge = 0;
  const speedF = Math.min(1, Math.abs(k.speed) / 6);
  let turn = steer * (2.3 - 0.5 * Math.min(1, Math.abs(k.speed) / max)) * (k.drifting ? 1.45 : 1);
  if (k.speed < 0) turn = -turn;
  k.yaw -= turn * speedF * dt;
  moveArena(k, dt, ctx);
}
function moveArena(k, dt, ctx) {
  let vx = Math.sin(k.yaw) * k.speed + (k.shX || 0), vz = Math.cos(k.yaw) * k.speed + (k.shZ || 0);
  const f = Math.exp(-6 * dt); k.shX = (k.shX || 0) * f; k.shZ = (k.shZ || 0) * f;
  if (k.shoveCD > 0) k.shoveCD -= dt;
  k.x += vx * dt; k.z += vz * dt;
  // bordi del tavolo: rimbalzo morbido
  const lx = HW - KR, lz = HD - KR;
  let hit = false;
  if (k.x < OX - lx) { k.x = OX - lx; hit = true; } else if (k.x > OX + lx) { k.x = OX + lx; hit = true; }
  if (k.z < OZ - lz) { k.z = OZ - lz; hit = true; } else if (k.z > OZ + lz) { k.z = OZ + lz; hit = true; }
  // ostacoli rotondi (lattine, palle...)
  for (const o of ctx.solids || []) {
    const dx = k.x - o.x, dz = k.z - o.z, d = Math.hypot(dx, dz), m = o.r + KR;
    if (d < m && d > 0.001) { k.x += dx / d * (m - d); k.z += dz / d * (m - d); hit = true; }
  }
  if (hit) {
    if (k.bumpCD <= 0 && Math.abs(k.speed) > 7) { k.events.push('bump'); k.bumpCD = 0.4; }
    k.speed *= Math.pow(0.02, dt);
  }
  k.s = 0; k.lat = 0;
}

// ostacoli solidi per la fisica locale (dallo stato del PC)
export function arenaSolids(ka) {
  if (!ka) return [];
  if (ka.g === 'slalom') return slalomCans();
  return [];
}
let cansCache = null;
export function slalomCans() {
  if (cansCache) return cansCache;
  cansCache = [];
  for (const g of slalomGates()) {
    const cx = g.px, cz = g.pz;
    // le porte sono larghe 9: due lattine ai lati
    cansCache.push({ x: g.x + cx * 5.5, z: g.z + cz * 5.5, r: 1.1 }, { x: g.x - cx * 5.5, z: g.z - cz * 5.5, r: 1.1 });
  }
  return cansCache;
}

// ------------------------------------------------------------------ regole (PC principale), una volta per passo
// ks: [{ slot, x, z, yaw, speed }] posizioni di tutti i kart
export function kgStep(ka, ks, dt) {
  ka.t += dt;
  ka.fx = ka.fx.filter(e => ka.t - e.t < 1.5);
  const alive = ks.filter(k => ka.out[k.slot] == null);
  const add = (o) => { o.id = ka.nid++; ka.items.push(o); return o; };
  const fwd = (k) => ({ x: Math.sin(k.yaw), z: Math.cos(k.yaw) });
  const stunned = (s) => (ka.stun[s] || 0) > ka.t;
  const fx = (kind, x, z, slot = -1) => ka.fx.push({ kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, slot, t: ka.t, id: ka.nid++ });
  // speronate: chi arriva col muso e veloce colpisce l'altro
  const rams = () => {
    const out = [];
    for (const a of alive) for (const b of alive) {
      if (a === b) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 4.2 || d < 0.01) continue;
      const f = fwd(a);
      if (a.speed > 9 && (f.x * dx + f.z * dz) / d > 0.55 && !stunned(a.slot)) {
        const key = a.slot + '>' + b.slot;
        if ((ka.cd[key] || 0) > ka.t) continue;
        ka.cd[key] = ka.t + 1.1; ka.cd[b.slot + '>' + a.slot] = ka.t + 0.6;
        out.push([a, b]);
      }
    }
    return out;
  };
  const near = (a, b, r = 3.6) => d2(a, b) < r;

  switch (ka.g) {
    case 'parcheggio': {
      for (const k of alive) {
        const dx = k.x - ka.spot.x, dz = k.z - ka.spot.z;
        const c = Math.cos(ka.spot.yaw), s = Math.sin(ka.spot.yaw);
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        const inside = Math.abs(lx) < 3.2 && Math.abs(lz) < 4.8 && Math.abs(k.speed) < 2.5;
        ka.park[k.slot] = inside ? (ka.park[k.slot] || 0) + dt : 0;
        if (ka.park[k.slot] > 0.4) { ka.sc[k.slot]++; fx('park', ka.spot.x, ka.spot.z, k.slot); newSpot(ka); for (const q in ka.park) ka.park[q] = 0; break; }
      }
      break;
    }
    case 'slalom': {
      const G = slalomGates();
      for (const k of alive) {
        const g = G[ka.gate[k.slot] % G.length];
        if (Math.hypot(k.x - g.x, k.z - g.z) < 4.6) { ka.gate[k.slot]++; ka.sc[k.slot]++; fx('gate', g.x, g.z, k.slot); }
      }
      break;
    }
    case 'bowling': {
      physics(ka, ks, dt, 2.2, 0.5);
      for (const p of ka.items) if (p.k === 'pin' && p.up && Math.hypot(p.vx, p.vz) > 2.2) {
        p.up = 0; p.ang = Math.atan2(p.vx, p.vz);
        if (p.by >= 0 && ka.sc[p.by] != null) ka.sc[p.by]++;
        fx('pin', p.x, p.z, p.by);
      }
      // birilli giù che toccano birilli in piedi: passano il "colpevole"
      const pins = ka.items.filter(o => o.k === 'pin');
      if (pins.every(p => !p.up)) { if (ka.downT < 0) ka.downT = ka.t; else if (ka.t - ka.downT > 1.6) rackPins(ka, add); }
      break;
    }
    case 'collina': {
      if (ka.t - ka.hillT > 12) { const p = ptIn(ka, 12); ka.hill.x = p.x; ka.hill.z = p.z; ka.hillT = ka.t; fx('hill', p.x, p.z); }
      const inside = alive.filter(k => d2(k, ka.hill) < ka.hill.r);
      for (const k of inside) ka.sc[k.slot] += dt * (inside.length === 1 ? 2 : 1);
      ka.king = inside.length === 1 ? inside[0].slot : -1;
      break;
    }
    case 'autoscontro': {
      for (const [a, b] of rams()) { ka.sc[a.slot]++; ka.stun[b.slot] = ka.t + 0.8; fx('bam', (a.x + b.x) / 2, (a.z + b.z) / 2, a.slot); }
      break;
    }
    case 'battaglia': {
      for (const [a, b] of rams()) {
        if (ka.out[b.slot] != null || ka.bal[b.slot] <= 0) continue;
        ka.bal[b.slot]--; ka.sc[a.slot]++; ka.stun[b.slot] = ka.t + 0.7; fx('pop', b.x, b.z, b.slot);
        if (ka.bal[b.slot] <= 0) ka.out[b.slot] = ka.t;
      }
      if (alive.length <= 1 && ks.length > 1) ka.over = true;
      break;
    }
    case 'patata': {
      ka.bt -= dt; ka.passCD -= dt;
      const h = alive.find(k => k.slot === ka.bomb);
      if (h && ka.passCD <= 0) {
        const o = alive.find(k => k !== h && near(k, h, 4));
        if (o) { ka.bomb = o.slot; ka.passCD = 1; fx('pass', o.x, o.z, o.slot); }
      }
      if (ka.bt <= 0 || !h) {
        if (h) { ka.out[h.slot] = ka.t; fx('boom', h.x, h.z, h.slot); }
        const rest = alive.filter(k => k.slot !== ka.bomb);
        if (rest.length <= 1) { ka.over = true; ka.bomb = -1; }
        else { ka.bomb = rest[Math.floor(rr(ka) * rest.length)].slot; ka.bt = rnd(ka, 8, 12); ka.passCD = 1.5; }
      }
      break;
    }
    case 'bandiera': {
      const F = ka.flag;
      const h = F.by >= 0 ? alive.find(k => k.slot === F.by) : null;
      if (h) {
        F.x = h.x; F.z = h.z;
        if (d2(h, ka.base[h.slot]) < 6.5) { ka.sc[h.slot]++; fx('flag', h.x, h.z, h.slot); F.by = -1; F.x = OX; F.z = OZ; ka.cd.flag = ka.t + 1; }
        else {
          const o = alive.find(k => k !== h && near(k, h, 3.8));
          if (o && (ka.cd.flag || 0) < ka.t) { F.by = o.slot; ka.cd.flag = ka.t + 1.5; fx('steal', o.x, o.z, o.slot); }
        }
      } else {
        F.by = -1;
        if ((ka.cd.flag || 0) < ka.t) { const o = alive.find(k => near(k, F, 3.4)); if (o) { F.by = o.slot; ka.cd.flag = ka.t + 1; fx('grab', o.x, o.z, o.slot); } }
      }
      break;
    }
    case 'calcetto': {
      physics(ka, ks, dt, 0.7, 0.85, true);
      const b = ka.items.find(o => o.k === 'ball');
      if (b && Math.abs(b.z - OZ) < GOAL_HALF && Math.abs(b.x - OX) > HW - b.r * 0.5) {
        const team = b.x > OX ? 0 : 1;                  // porta a destra = gol della squadra 0
        ka.tg[team]++;
        if (b.by >= 0 && ka.team[b.by] === team) ka.sc[b.by]++;
        fx('goal', b.x, b.z, b.by);
        Object.assign(b, { x: OX, z: OZ, vx: 0, vz: 0, by: -1 });
      }
      break;
    }
    case 'aspirapolvere': {
      const V = ka.vac;
      V.sp = Math.min(21, 8 + ka.t * 0.28);
      let tgt = null, bd = Infinity;
      for (const k of alive) { const d = d2(k, V); if (d < bd) { bd = d; tgt = k; } }
      if (tgt) {
        let want = Math.atan2(tgt.x - V.x, tgt.z - V.z), dd = want - V.yaw;
        while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
        V.yaw += Math.sign(dd) * Math.min(Math.abs(dd), 1.9 * dt);
        V.x += Math.sin(V.yaw) * V.sp * dt; V.z += Math.cos(V.yaw) * V.sp * dt;
        Object.assign(V, clampIn(V, 5));
        if (bd < 5) { ka.out[tgt.slot] = ka.t; fx('suck', tgt.x, tgt.z, tgt.slot); }
      }
      if (alive.length <= 1 && ks.length > 1) ka.over = true;
      break;
    }
    case 'pavimento': {
      for (const k of alive) {
        const i = Math.floor((k.x - (OX - HW)) / TILE), j = Math.floor((k.z - (OZ - HD)) / TILE);
        if (i < 0 || j < 0 || i >= TNX || j >= TNZ) continue;
        const ti = j * TNX + i, v = ka.tl[ti];
        ka.on = ka.on || {}; ka.onT = ka.onT || {};
        // la piastrella si crepa quando la lasci (o se ci resti fermo più di 2,5 secondi)
        const prev = ka.on[k.slot];
        if (prev != null && prev !== ti && ka.tl[prev] === 0) ka.tl[prev] = Math.max(0.01, Math.round(ka.t * 100) / 100);
        if (prev !== ti) { ka.on[k.slot] = ti; ka.onT[k.slot] = ka.t; }
        else if (v === 0 && ka.t - ka.onT[k.slot] > 2.5) ka.tl[ti] = ka.t;
        if (v < 0) { ka.out[k.slot] = ka.t; fx('fall', k.x, k.z, k.slot); }
      }
      // dopo 25 secondi crollano anche piastrelle a caso, così finisce
      if (ka.t > 20 && rr(ka) < dt * (0.8 + (ka.t - 20) * 0.08)) { const ti = Math.floor(rr(ka) * ka.tl.length); if (ka.tl[ti] === 0) ka.tl[ti] = ka.t; }
      for (let i = 0; i < ka.tl.length; i++) if (ka.tl[i] > 0 && ka.t - ka.tl[i] > 1.4) ka.tl[i] = -1;
      if (alive.length <= 1 && ks.length > 1) ka.over = true;
      break;
    }
    case 'birra': {
      for (const [a, b] of rams()) if (ka.hold[b.slot]) { delete ka.hold[b.slot]; add({ k: 'beer', ...clampIn({ x: b.x + rnd(ka, -5, 5), z: b.z + rnd(ka, -5, 5) }), cd: ka.t + 0.8 }); ka.stun[b.slot] = ka.t + 0.6; fx('drop', b.x, b.z, b.slot); }
      for (const k of alive) {
        if (ka.hold[k.slot]) {
          if (d2(k, ka.sofa) < 7) { delete ka.hold[k.slot]; ka.sc[k.slot]++; fx('deliver', k.x, k.z, k.slot); ka.sofa = ptIn(ka, 10); add({ k: 'beer', ...ptIn(ka, 8) }); }
          continue;
        }
        const it = ka.items.find(o => o.k === 'beer' && (o.cd || 0) < ka.t && near(k, o, 3.4));
        if (it) { ka.items.splice(ka.items.indexOf(it), 1); ka.hold[k.slot] = 'beer'; fx('grab', k.x, k.z, k.slot); }
      }
      break;
    }
    case 'raccogli': case 'monete': {
      const kind = ka.g === 'raccogli' ? 'chip' : 'coin';
      while (ka.items.filter(o => o.k === kind).length < ka.want) {
        const gold = ka.g === 'raccogli' && rr(ka) < 0.15;
        add({ k: kind, ...ptIn(ka, 5), v: gold ? 3 : 1, gold: gold ? 1 : 0 });
      }
      if (ka.g === 'monete') {
        for (const [a, b] of rams()) {
          const lose = Math.min(3, ka.sc[b.slot]);
          ka.sc[b.slot] -= lose; ka.stun[b.slot] = ka.t + 0.6; fx('bam', b.x, b.z, b.slot);
          for (let i = 0; i < lose; i++) { const ang = rr(ka) * 6.28; add({ k: 'coin', ...clampIn({ x: b.x + Math.sin(ang) * 6, z: b.z + Math.cos(ang) * 6 }), v: 1, cd: ka.t + 0.7 }); }
        }
      }
      for (const k of alive) {
        for (let i = ka.items.length - 1; i >= 0; i--) {
          const o = ka.items[i];
          if (o.k !== kind || (o.cd || 0) > ka.t || !near(k, o, 3.3)) continue;
          ka.sc[k.slot] += o.v || 1; ka.items.splice(i, 1); fx(o.gold ? 'gold' : 'pick', o.x, o.z, k.slot);
        }
      }
      break;
    }
    case 'gatto': {
      const C = ka.cat;
      for (const k of alive) ka.sc[k.slot] += dt;
      C.pt += dt;
      if (C.ph === 'rest' && C.pt > (ka.t < 3 ? 2 : 0.7)) {
        const tg = alive[Math.floor(rr(ka) * alive.length)];
        if (tg) { C.ph = 'aim'; C.pt = 0; C.tx = tg.x + Math.sin(tg.yaw) * tg.speed * 0.9; C.tz = tg.z + Math.cos(tg.yaw) * tg.speed * 0.9; Object.assign(C, { tx: clampIn({ x: C.tx, z: C.tz }, 6).x, tz: clampIn({ x: C.tx, z: C.tz }, 6).z }); }
      } else if (C.ph === 'aim' && C.pt > Math.max(0.8, 1.4 - ka.t * 0.012)) { C.ph = 'jump'; C.pt = 0; C.fx = C.x; C.fz = C.z; }
      else if (C.ph === 'jump') {
        const u = Math.min(1, C.pt / 0.55);
        C.x = C.fx + (C.tx - C.fx) * u; C.z = C.fz + (C.tz - C.fz) * u;
        if (u >= 1) {
          C.ph = 'rest'; C.pt = 0; fx('pounce', C.x, C.z);
          for (const k of alive) if (Math.hypot(k.x - C.x, k.z - C.z) < 7.5) { ka.sc[k.slot] -= 5; ka.stun[k.slot] = ka.t + 1.1; fx('scratch', k.x, k.z, k.slot); }
        }
      }
      break;
    }
    case 'biliardo': {
      physics(ka, ks, dt, 0.55, 0.9);
      for (let i = ka.items.length - 1; i >= 0; i--) {
        const b = ka.items[i];
        if (b.k !== 'pball') continue;
        if (POCKETS.some(p => Math.hypot(b.x - p.x, b.z - p.z) < 3.6)) {
          if (b.by >= 0 && ka.sc[b.by] != null) ka.sc[b.by]++;
          fx('pot', b.x, b.z, b.by); ka.items.splice(i, 1);
        }
      }
      if (!ka.items.some(o => o.k === 'pball')) rackBalls(ka, add);
      break;
    }
  }
}

// oggetti che si muovono (palla, birilli, palle da biliardo): urti con i kart, tra loro e coi bordi
function physics(ka, ks, dt, fric, rest, goals = false) {
  const B = ka.items.filter(o => o.vx != null);
  const ff = Math.exp(-fric * dt);
  for (const b of B) {
    for (const k of ks) {
      if (ka.out[k.slot] != null) continue;
      const dx = b.x - k.x, dz = b.z - k.z, d = Math.hypot(dx, dz), m = b.r + KR;
      if (d < m && d > 0.01) {
        const nx = dx / d, nz = dz / d;
        b.x = k.x + nx * m; b.z = k.z + nz * m;
        const kv = Math.max(0, (Math.sin(k.yaw) * nx + Math.cos(k.yaw) * nz) * k.speed);
        const vn = b.vx * nx + b.vz * nz;
        const want = kv * 1.35 + 3;
        if (vn < want) { b.vx += nx * (want - vn); b.vz += nz * (want - vn); }
        b.by = k.slot;
      }
    }
  }
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
    if (d < m && d > 0.01) {
      const nx = dx / d, nz = dz / d, push = (m - d) / 2;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) {
        const j2 = -rv * 0.95;
        a.vx -= nx * j2; a.vz -= nz * j2; b.vx += nx * j2; b.vz += nz * j2;
        // chi spinge passa il "merito" (birilli e biliardo)
        if (a.by >= 0 && Math.hypot(a.vx, a.vz) >= Math.hypot(b.vx, b.vz)) b.by = a.by; else if (b.by >= 0) a.by = b.by;
      }
    }
  }
  for (const b of B) {
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.vx *= ff; b.vz *= ff;
    const inGoal = goals && Math.abs(b.z - OZ) < GOAL_HALF;
    if (!inGoal) {
      if (b.x < OX - HW + b.r) { b.x = OX - HW + b.r; b.vx = Math.abs(b.vx) * rest; }
      if (b.x > OX + HW - b.r) { b.x = OX + HW - b.r; b.vx = -Math.abs(b.vx) * rest; }
    }
    if (b.z < OZ - HD + b.r) { b.z = OZ - HD + b.r; b.vz = Math.abs(b.vz) * rest; }
    if (b.z > OZ + HD - b.r) { b.z = OZ + HD - b.r; b.vz = -Math.abs(b.vz) * rest; }
    b.x = Math.round(b.x * 100) / 100; b.z = Math.round(b.z * 100) / 100;
  }
}

// ------------------------------------------------------------------ classifica e scritte
export function kgRankKey(ka, slot) {
  if (!ka) return [0];
  if (ELIM.has(ka.g)) return [ka.out[slot] == null ? 1e6 : ka.out[slot], ka.g === 'battaglia' ? ka.sc[slot] || 0 : 0];
  if (ka.g === 'calcetto') return [ka.tg[ka.team[slot]] - ka.tg[1 - ka.team[slot]], ka.sc[slot] || 0];
  return [Math.floor(ka.sc[slot] || 0)];
}
export function kgLabel(ka, slot) {
  if (!ka) return '';
  const v = Math.floor(ka.sc[slot] || 0);
  switch (ka.g) {
    case 'patata': case 'aspirapolvere': case 'pavimento': return ka.out[slot] != null ? 'Fuori' : (ka.g === 'patata' && ka.bomb === slot ? '💣 ha la bomba!' : 'In gioco');
    case 'battaglia': return ka.out[slot] != null ? 'Fuori' : `${'🎈'.repeat(Math.max(0, ka.bal[slot] || 0))} · ${v} colpi`;
    case 'calcetto': return `${ka.team[slot] ? 'Blu' : 'Arancio'} ${ka.tg[ka.team[slot]]}-${ka.tg[1 - ka.team[slot]]}${v ? ` ⚽${v}` : ''}`;
    case 'collina': return `${v} pt${ka.king === slot ? ' 👑' : ''}`;
    case 'slalom': return v === 1 ? '1 porta' : `${v} porte`;
    case 'bowling': return v === 1 ? '1 birillo' : `${v} birilli`;
    case 'parcheggio': return v === 1 ? '1 parcheggio' : `${v} parcheggi`;
    case 'autoscontro': return v === 1 ? '1 botta' : `${v} botte`;
    case 'bandiera': return `${v === 1 ? '1 bandiera' : v + ' bandiere'}${ka.flag && ka.flag.by === slot ? ' 🚩' : ''}`;
    case 'birra': return `${v === 1 ? '1 birra' : v + ' birre'}${ka.hold[slot] ? ' 🍺' : ''}`;
    case 'raccogli': return v === 1 ? '1 patatina' : `${v} patatine`;
    case 'monete': return v === 1 ? '1 moneta' : `${v} monete`;
    case 'biliardo': return `${v} in buca`;
    case 'gatto': return `${v} pt`;
  }
  return `${v}`;
}
export function kgDone(ka, n) { return !!ka.over || (ELIM.has(ka.g) && n > 1 && Object.keys(ka.out).length >= n - 1); }

// ------------------------------------------------------------------ piloti del computer
// ritorna { steer, drift, brake } verso un punto, con un po' di "testa"
export function kgCpu(ka, k, others, brain) {
  brain.t = (brain.t || 0) + 1 / 60;
  const alive = others.filter(o => ka.out[o.slot] == null);
  let tg = { x: OX, z: OZ }, brake = false, flee = null;
  const nearest = (list) => { let b = null, bd = Infinity; for (const o of list) { const d = d2(k, o); if (d < bd) { bd = d; b = o; } } return b; };
  switch (ka.g) {
    case 'parcheggio': {
      tg = ka.spot;
      const d = d2(k, tg);
      if (d < 7 && k.speed > 2) brake = true;
      if (d < 2.5) brake = true;
      break;
    }
    case 'slalom': { const G = slalomGates(); tg = G[(ka.gate[k.slot] || 0) % G.length]; break; }
    case 'bowling': { const p = nearest(ka.items.filter(o => o.k === 'pin' && o.up)); if (p) tg = p; else tg = { x: OX, z: OZ - 25 }; break; }
    case 'collina': tg = { x: ka.hill.x + Math.sin(k.slot * 2) * 3, z: ka.hill.z + Math.cos(k.slot * 2) * 3 }; break;
    case 'autoscontro': case 'battaglia': { const o = nearest(alive); if (o) tg = { x: o.x + Math.sin(o.yaw) * o.speed * 0.3, z: o.z + Math.cos(o.yaw) * o.speed * 0.3 }; break; }
    case 'patata': {
      if (ka.bomb === k.slot) { const o = nearest(alive); if (o) tg = o; }
      else { const h = others.find(o => o.slot === ka.bomb); if (h) flee = h; }
      break;
    }
    case 'bandiera': {
      const F = ka.flag;
      if (F.by === k.slot) tg = ka.base[k.slot];
      else tg = F;
      break;
    }
    case 'calcetto': {
      const b = ka.items.find(o => o.k === 'ball');
      if (b) {
        const gx = ka.team[k.slot] ? OX - HW : OX + HW;      // porta dove devo segnare
        const dx = gx - b.x, dz = OZ - b.z, l = Math.hypot(dx, dz) || 1;
        const aim = { x: b.x - dx / l * 6, z: b.z - dz / l * 6 };
        tg = d2(k, aim) < 4 || (k.x - b.x) * dx < 0 ? b : aim;
        // se sono davanti alla palla giro intorno
        if ((k.x - b.x) * Math.sign(dx) > 0 && d2(k, b) < 10) tg = { x: b.x - Math.sign(dx) * 8, z: b.z + (k.z > b.z ? 7 : -7) };
      }
      break;
    }
    case 'aspirapolvere': flee = ka.vac; break;
    case 'pavimento': {
      if (!brain.pt || brain.t > brain.next || tileState(ka, brain.pt.x, brain.pt.z) !== 0 || d2(k, brain.pt) < 6) {
        let best = null, bs = -Infinity;
        for (let n = 0; n < 24; n++) {
          const p = { x: OX + (Math.random() * 2 - 1) * (HW - 6), z: OZ + (Math.random() * 2 - 1) * (HD - 6) };
          if (tileState(ka, p.x, p.z) !== 0) continue;
          let sc = -Math.abs(d2(k, p) - 16);
          for (let s = 1; s <= 4; s++) { const q = { x: k.x + (p.x - k.x) * s / 4, z: k.z + (p.z - k.z) * s / 4 }; const ts = tileState(ka, q.x, q.z); if (ts < 0) sc -= 40; else if (ts > 0) sc -= 12; }
          if (sc > bs) { bs = sc; best = p; }
        }
        brain.pt = best || { x: OX, z: OZ }; brain.next = brain.t + 0.8;
      }
      tg = brain.pt;
      break;
    }
    case 'birra': {
      if (ka.hold[k.slot]) tg = ka.sofa;
      else { const b = nearest(ka.items.filter(o => o.k === 'beer')); if (b) tg = b; else { const h = others.find(o => ka.hold[o.slot]); if (h) tg = h; } }
      break;
    }
    case 'raccogli': case 'monete': {
      let best = null, bs = Infinity;
      for (const o of ka.items) { if (o.k !== 'chip' && o.k !== 'coin') continue; const s = d2(k, o) / (o.v || 1); if (s < bs) { bs = s; best = o; } }
      if (best) tg = best;
      break;
    }
    case 'gatto': flee = ka.cat.ph === 'rest' ? { x: ka.cat.x, z: ka.cat.z } : { x: ka.cat.tx, z: ka.cat.tz }; if (ka.cat.ph === 'rest' && d2(k, flee) > 25) { flee = null; tg = brain.wander || (brain.wander = { x: OX, z: OZ }); if (d2(k, tg) < 8) brain.wander = { x: OX + (Math.random() * 2 - 1) * 30, z: OZ + (Math.random() * 2 - 1) * 18 }; } break;
    case 'biliardo': {
      let best = null, bs = Infinity, pk = null;
      for (const b of ka.items) { if (b.k !== 'pball') continue; for (const p of POCKETS) { const s = d2(b, p) + d2(k, b) * 0.5; if (s < bs) { bs = s; best = b; pk = p; } } }
      if (best) {
        const dx = pk.x - best.x, dz = pk.z - best.z, l = Math.hypot(dx, dz) || 1;
        const aim = { x: best.x - dx / l * 5, z: best.z - dz / l * 5 };
        tg = d2(k, aim) < 3.5 ? best : aim;
      }
      break;
    }
  }
  if (flee) {
    // scappo: punto lontano da chi mi insegue, restando lontano dai bordi
    const dx = k.x - flee.x, dz = k.z - flee.z, l = Math.hypot(dx, dz) || 1;
    tg = clampIn({ x: k.x + dx / l * 20, z: k.z + dz / l * 20 }, 9);
    if (Math.abs(tg.x - k.x) < 4 && Math.abs(tg.z - k.z) < 4) tg = { x: OX, z: OZ };
    if (l > 24) tg = { x: OX + Math.sin(brain.t * 0.5 + k.slot) * 24, z: OZ + Math.cos(brain.t * 0.4 + k.slot) * 13 };
  }
  const want = Math.atan2(tg.x - k.x, tg.z - k.z);
  let d = want - k.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  // se è dietro di me e vicino, faccio retromarcia sterzando
  const dist = d2(k, tg);
  if (Math.abs(d) > 2.4 && dist < 8 && !flee) return { steer: Math.sign(d) * 1, drift: false, brake: true };
  // sterzo: d > 0 vuol dire che il bersaglio è a sinistra (yaw cresce a sinistra)
  const steer = Math.max(-1, Math.min(1, -d * 1.8));
  // incastrato contro il bordo: un po' di retromarcia
  if (Math.abs(k.speed) < 1.5) brain.stuck = (brain.stuck || 0) + 1 / 60; else brain.stuck = 0;
  if (brain.stuck > 0.8) { brain.rev = 0.7; brain.stuck = 0; }
  if (brain.rev > 0) { brain.rev -= 1 / 60; return { steer: -steer, drift: false, brake: true }; }
  return { steer, drift: Math.abs(d) > 1.1 && k.speed > 12, brake };
}
export function tileState(ka, x, z) {
  const i = Math.floor((x - (OX - HW)) / TILE), j = Math.floor((z - (OZ - HD)) / TILE);
  if (i < 0 || j < 0 || i >= TNX || j >= TNZ) return -1;
  const v = ka.tl[j * TNX + i];
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

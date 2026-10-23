// Piloti guidati dal computer (CPU).
import { CARDS } from './cards.js';
import { kartBlocked, groundHeight, solidPush } from './track.js';

export const CPU_LEVELS = {
  facile:    { label: 'Facile',    speed: 0.84, look: 9,  drift: false, start: 0.1, cardDelay: [6, 12], noise: 0.25 },
  normale:   { label: 'Normale',   speed: 0.93, look: 11, drift: true,  start: 0.4, cardDelay: [3, 8],  noise: 0.12 },
  difficile: { label: 'Difficile', speed: 1.0,  look: 13, drift: true,  start: 0.8, cardDelay: [1.5, 5], noise: 0.05 },
};

export const CPU_NAMES = [
  { name: 'Robo-Rino', color: '#9b5cff' },
  { name: 'Turbo-Tina', color: '#ff4fa3' },
  { name: 'Bot-Bruno', color: '#1fb5c9' },
  { name: 'Chip-Carla', color: '#ffcc00' },
];

export function newBrain(level) {
  return {
    level, lane: (Math.random() - 0.5) * 6, laneT: 0, drifting: false,
    cardT: 3 + Math.random() * 4, stuckT: 0, reverseT: 0, startPressed: false, trickDone: false,
  };
}

function angleTo(k, x, z) {
  let d = Math.atan2(x - k.x, z - k.z) - k.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// curvatura della pista davanti (radianti di cambio direzione su n campioni)
function bendAhead(track, idx, n) {
  const a = track.pts[(idx + 2) % track.count], b = track.pts[(idx + n) % track.count];
  return Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
}

// ctx: { phase, countdownLeft, hand, others: [kart], useCard(i, to) }
export function cpuInput(track, k, brain, dt, ctx) {
  const L = CPU_LEVELS[brain.level] || CPU_LEVELS.normale;
  k.speedMul = L.speed;
  const input = { steer: 0, drift: false, brake: false, trick: false };

  if (ctx.phase === 'countdown') {
    // turbo alla partenza, a volte
    if (!brain.startPressed && ctx.countdownLeft < 0.4 && ctx.countdownLeft > 0.1) {
      brain.startPressed = true;
      input.drift = Math.random() < L.start;
    }
    return input;
  }
  if (ctx.phase !== 'race') return input;

  // corsia preferita che cambia ogni tanto (così non vanno tutti in fila)
  brain.laneT -= dt;
  if (brain.laneT <= 0) { brain.lane = (Math.random() - 0.5) * 8; brain.laneT = 2 + Math.random() * 3; }

  const look = Math.round(L.look * (0.6 + Math.max(0, k.speed) / 30 * 0.6) / track.ds * 1.5);
  // mobili in mezzo alla pista: scelgo una corsia la cui linea dritta dal kart al punto di mira sia libera
  if (track.solid) {
    const clear = (lane) => {
      const q = track.pts[(k.idx + look) % track.count];
      const tx = q.x + q.rx * lane, tz = q.z + q.rz * lane;
      const d = Math.hypot(tx - k.x, tz - k.z), n = Math.max(2, Math.ceil(d / 1.5));
      for (let i = 1; i <= n; i++) {
        const u = i / n, x = k.x + (tx - k.x) * u, z = k.z + (tz - k.z) * u;
        if (kartBlocked(track, x, z, k.y + (groundHeight(track, q.s, lane) - k.y) * u)) return false;
      }
      return true;
    };
    if (!clear(brain.lane)) {
      let best = null;
      for (let d = 1; d <= 22 && best == null; d++) for (const sg of [1, -1]) {
        const ln = brain.lane + sg * d * 0.5;
        if (Math.abs(ln) > track.wall - 2.4) continue;
        if (clear(ln)) { best = ln; break; }
      }
      if (best != null) { brain.lane = best; brain.laneT = 1.2; }
    }
  }
  const p = track.pts[(k.idx + look) % track.count];
  const tx = p.x + p.rx * brain.lane, tz = p.z + p.rz * brain.lane;
  const ang = angleTo(k, tx, tz) + (Math.random() - 0.5) * L.noise;
  input.steer = Math.max(-1, Math.min(1, -ang * 2.6));

  // derapata nelle curve lunghe
  const bend = bendAhead(track, k.idx, Math.round(30 / track.ds));
  if (L.drift && !k.air) {
    // entra in derapata solo se la curva è lunga e il muso deve girare parecchio
    if (!brain.drifting && Math.abs(bend) > 0.6 && Math.abs(ang) > 0.18 && k.speed > 20 && Math.abs(k.lat) < track.halfWidth - 2) brain.drifting = true;
    if (brain.drifting && (Math.abs(ang) < 0.05 || Math.abs(bend) < 0.2 || k.speed < 12 || Math.abs(k.lat) > track.halfWidth)) brain.drifting = false;
    input.drift = brain.drifting;
  }

  // acrobazia sui salti
  if (k.air && !brain.trickDone && k.airTime > 0.1) { input.trick = true; brain.trickDone = true; }
  if (!k.air) brain.trickDone = false;

  // incastrato contro il muro o girato al contrario: retromarcia
  if (brain.reverseT > 0) {
    brain.reverseT -= dt;
    input.brake = true; input.drift = false;
    // in retromarcia giro il muso lontano dal mobile (o dal muro) che mi blocca
    input.steer = brain.revSteer != null ? brain.revSteer : -input.steer;
    if (brain.reverseT <= 0) brain.revSteer = null;
  } else {
    brain.stuckT = k.speed < 3 ? brain.stuckT + dt : 0;
    const pu = track.solid ? solidPush(track, k.x, k.z, k.y, 3.5) : null;
    if ((pu && brain.stuckT > 0.6) || brain.stuckT > 1.5 || k.wrongWayT > 1.5) {
      brain.reverseT = pu ? 0.9 : 1; brain.stuckT = 0;
      if (pu) {
        // il mobile è dalla parte opposta di pu: sterzo in retro in modo che il muso si allontani, poi cambio corsia
        const side = Math.sin(k.yaw) * pu.z - Math.cos(k.yaw) * pu.x;   // >0: il mobile è a destra
        brain.revSteer = side > 0 ? 1 : -1;
        brain.lane = Math.max(-(track.wall - 3), Math.min(track.wall - 3, k.lat + (side > 0 ? -6 : 6)));
        brain.laneT = 2.5;
      }
    }
  }

  // carte
  brain.cardT -= dt;
  if (brain.cardT <= 0 && ctx.hand && ctx.hand.cards.length && ctx.hand.cd <= 0) {
    const i = Math.floor(Math.random() * ctx.hand.cards.length);
    const def = CARDS[ctx.hand.cards[i]];
    let to = null;
    if (def.target === 'pick' && ctx.others.length) {
      // preferisce chi è davanti
      const ahead = ctx.others.filter(o => o.place < k.place);
      const pool = ahead.length ? ahead : ctx.others;
      to = pool[Math.floor(Math.random() * pool.length)].slot;
    }
    ctx.useCard(i, to);
    const [a, b] = L.cardDelay;
    brain.cardT = a + Math.random() * (b - a);
  }
  return input;
}

// Piloti guidati dal computer (CPU).
import { CARDS } from './cards.js';

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
    input.brake = true; input.steer = -input.steer; input.drift = false;
  } else {
    brain.stuckT = k.speed < 3 ? brain.stuckT + dt : 0;
    if (brain.stuckT > 1.5 || k.wrongWayT > 1.5) { brain.reverseT = 1; brain.stuckT = 0; }
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

// Fisica arcade dei kart, stile Mario Kart: accelerazione automatica,
// derapata con mini-turbo, turbo alla partenza, salto con acrobazia.
import { locate, groundHeight, zoneAt, kartBlocked, solidPush } from './track.js';

export const MAX_SPEED = 30;          // ~108 km/h nel tachimetro (x3.6)
const ACCEL = 15;
const GRASS_FACTOR = 0.45;
const BOOST_FACTOR = 1.42;
const GRAVITY = 32;
const KART_RADIUS = 1.6;
export const MT_BLUE = 0.9;           // secondi di derapata per il mini-turbo blu
export const MT_ORANGE = 2.1;         // ... e per quello arancione

export function createKart(track, slot, gridIndex, player) {
  const row = Math.floor(gridIndex / 2), side = gridIndex % 2 ? 1 : -1;
  const s = track.length - 8 - row * 7 - (side > 0 ? 3.5 : 0);
  const k = { slot, name: player.name, color: player.color };
  placeAt(track, k, s, side * 4);
  Object.assign(k, {
    speed: 0, vy: 0, air: false, airTime: 0, trick: false, trickT: 0,
    drifting: false, driftDir: 0, driftT: 0, driftCharge: 0, hop: 0,
    boostT: 0, boostKind: '', lapCount: 0, finished: false, finishTime: 0,
    place: gridIndex + 1, wrongWayT: 0, spinT: 0, startPress: -1,
    prevDrift: false, events: [], bumpCD: 0, grass: false,
    // effetti delle carte (secondi rimasti)
    shieldT: 0, mirror: 0, mirrorT: 0, ghostT: 0, invertT: 0, stopT: 0, miniT: 0, slowT: 0, fogT: 0, bombT: 0,
    drunkT: 0, callT: 0, slowmoT: 0, copT: 0, clampT: 0, goldT: 0,
    contacts: [], shX: 0, shZ: 0, shoveCD: 0,
  });
  return k;
}

export function placeAt(track, k, s, lat) {
  const i = Math.floor(((s % track.length) + track.length) % track.length / track.ds) % track.count;
  const p = track.pts[i];
  k.x = p.x + p.rx * lat; k.z = p.z + p.rz * lat; k.y = 0;
  k.yaw = Math.atan2(p.tx, p.tz);
  const loc = locate(track, k.x, k.z);
  k.idx = loc.idx; k.s = loc.s; k.lat = loc.lat; k.prevS = loc.s;
}

// input: { steer: -1..1 (positivo = destra), drift: bool, brake: bool, trick: bool }
export function stepKart(track, k, input, dt, phase) {
  k.events.length = 0;
  k.contacts.length = 0;
  if (k.bumpCD > 0) k.bumpCD -= dt;
  let steer = Math.max(-1, Math.min(1, input.steer || 0));
  if (k.invertT > 0) steer = -steer;
  // Telefonata: finché non rifiuti la chiamata il kart va dritto
  if (k.callT > 0) { steer = 0; input = { ...input, steer: 0, drift: false }; }
  // Sbronzo: il kart sbanda un po' da solo
  if (k.drunkT > 0) { k.drunkPh = (k.drunkPh || 0) + dt * 5.5; steer = Math.max(-1, Math.min(1, steer * 0.8 + Math.sin(k.drunkPh) * 0.32)); }

  if (phase === 'countdown') {
    // turbo alla partenza: premi DERAPA nell'ultimo mezzo secondo
    if (input.drift && !k.prevDrift && k.startPress < 0) k.startPress = input.countdownLeft;
    k.prevDrift = !!input.drift;
    return;
  }
  if (k.finished) { input = { steer: 0, drift: false, brake: false }; }
  tickEffects(k, dt);

  const forwardX = Math.sin(k.yaw), forwardZ = Math.cos(k.yaw);

  // testacoda (partenza sbagliata o colpo)
  if (k.spinT > 0) {
    k.spinT -= dt;
    k.speed *= Math.pow(0.15, dt);
    k.yaw += dt * 9;
    move(track, k, dt, forwardX, forwardZ);
    return;
  }

  // freno a mano (carta): fermo per qualche istante
  if (k.stopT > 0) {
    k.speed *= Math.pow(0.02, dt);
    k.drifting = false; k.driftDir = 0; k.driftCharge = 0;
    move(track, k, dt, forwardX, forwardZ);
    return;
  }

  // ---- velocità ----
  let max = MAX_SPEED;
  if (k.grass && !k.air) max *= GRASS_FACTOR;
  if (k.speedMul) max *= k.speedMul;
  if (k.miniT > 0) max *= 0.7;
  if (k.slowT > 0) max *= 0.6;
  if (k.slowmoT > 0) max *= 0.5;                 // Telecomando: al rallentatore
  if (k.boostT > 0) { max *= BOOST_FACTOR; k.boostT -= dt; }
  if (input.brake && !k.air) {
    if (k.speed > 0.5) k.speed -= 38 * dt;
    else k.speed = Math.max(k.speed - 12 * dt, -9);
  } else if (k.boostT > 0) {
    k.speed = Math.max(k.speed, max * 0.95);
  } else if (k.speed < max) {
    const t = Math.max(0, k.speed) / max;
    k.speed += ACCEL * (1.1 - 0.6 * t) * dt;
    if (k.speed > max) k.speed = max;
  } else {
    k.speed -= 22 * dt;
    if (k.speed < max) k.speed = max;
  }

  // ---- derapata ----
  const driftPressed = !!input.drift && !k.prevDrift;
  k.prevDrift = !!input.drift;
  if (k.air && (driftPressed || input.trick) && !k.trick && k.airTime > 0.05) {
    k.trick = true; k.trickT = 0.5; k.events.push('trick');
  }
  if (!k.air && input.drift && !k.drifting && Math.abs(steer) > 0.25 && k.speed > 12 && !input.brake) {
    k.drifting = true; k.driftDir = Math.sign(steer); k.driftT = 0; k.driftCharge = 0; k.hop = 0.18;
  }
  if (k.drifting && (!input.drift || k.speed < 8 || input.brake)) {
    if (!input.brake && k.speed >= 8) {
      if (k.driftCharge >= MT_ORANGE) giveBoost(k, 1.15, 'orange');
      else if (k.driftCharge >= MT_BLUE) giveBoost(k, 0.6, 'blue');
    }
    k.drifting = false; k.driftDir = 0; k.driftCharge = 0;
  }

  // ---- sterzo ----
  const speedF = Math.min(1, Math.abs(k.speed) / 9);
  let turn;
  if (k.drifting) {
    const rel = steer * k.driftDir;            // -1 = allarga, +1 = stringi
    turn = k.driftDir * (1.05 + 0.75 * rel);
    k.driftT += dt;
    k.driftCharge += dt * (rel > 0.35 ? 1.35 : rel < -0.35 ? 0.6 : 1);
  } else {
    turn = steer * (2.0 - 0.6 * Math.min(1, Math.abs(k.speed) / MAX_SPEED));
  }
  if (k.air) turn *= 0.25;
  if (k.ice) turn *= 0.6;                        // nel frigo si scivola
  if (k.speed < 0) turn = -turn;
  k.yaw -= turn * speedF * dt;

  if (k.hop > 0) k.hop -= dt;
  if (k.trickT > 0) k.trickT -= dt;

  move(track, k, dt, Math.sin(k.yaw), Math.cos(k.yaw));
}

// timer degli effetti; la bomba esplode a chi ce l'ha quando arriva a zero
function tickEffects(k, dt) {
  for (const f of ['shieldT', 'ghostT', 'invertT', 'stopT', 'miniT', 'slowT', 'fogT', 'drunkT', 'callT', 'slowmoT', 'copT', 'clampT', 'goldT']) if (k[f] > 0) k[f] = Math.max(0, k[f] - dt);
  if (k.mirrorT > 0) { k.mirrorT -= dt; if (k.mirrorT <= 0) { k.mirrorT = 0; k.mirror = 0; } }
  if (k.bombT > 0) {
    k.bombT -= dt;
    if (k.bombT <= 0) { k.bombT = 0; k.spinT = 2; k.speed *= 0.3; k.events.push('boom'); }
  }
}

export function giveBoost(k, t, kind) {
  k.boostT = Math.max(k.boostT, t);
  k.boostKind = kind;
  k.events.push('boost');
}

function move(track, k, dt, fx, fz) {
  let vx = fx * k.speed, vz = fz * k.speed;
  if (k.drifting) {
    // scivolata verso l'esterno della curva
    const rx = -fz, rz = fx;
    vx -= rx * k.driftDir * k.speed * 0.16;
    vz -= rz * k.driftDir * k.speed * 0.16;
  }
  // ghiaccio: la direzione del kart cambia più lentamente (scivola)
  if (k.ice && !k.air) {
    const a = Math.min(1, dt * 2.2);
    vx = (k.pvx ?? vx) + (vx - (k.pvx ?? vx)) * a; vz = (k.pvz ?? vz) + (vz - (k.pvz ?? vz)) * a;
  }
  k.pvx = vx; k.pvz = vz;
  // spallata: spinta di lato che si esaurisce in fretta (la velocità in avanti non cambia)
  vx += k.shX || 0; vz += k.shZ || 0;
  const f = Math.exp(-7 * dt);
  k.shX = (k.shX || 0) * f; k.shZ = (k.shZ || 0) * f;
  if (k.shoveCD > 0) k.shoveCD -= dt;
  // mobili solidi (gambe di tavoli e divano...): se il passo finisce dentro, scivolo lungo il bordo o mi fermo
  const nx = k.x + vx * dt, nz = k.z + vz * dt;
  if (track.solid && kartBlocked(track, nx, nz, k.y) && !kartBlocked(track, k.x, k.z, k.y)) {
    if (!kartBlocked(track, nx, k.z, k.y)) k.x = nx;
    else if (!kartBlocked(track, k.x, nz, k.y)) k.z = nz;
    else {
      // contro uno spigolo: mi spingo via dal mobile e giro il muso, così si scivola via invece di restare incastrati
      const pu = solidPush(track, k.x, k.z, k.y);
      if (pu) {
        k.x += pu.x * 0.35; k.z += pu.z * 0.35;
        let d = Math.atan2(pu.x, pu.z) - k.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) < Math.PI * 0.75) k.yaw += Math.sign(d) * Math.min(Math.abs(d), 2.5 * dt);
      }
    }
    if (k.bumpCD <= 0 && Math.abs(k.speed) > 6) { k.events.push('bump'); k.bumpCD = 0.5; }
    k.speed *= 0.7;
  } else { k.x = nx; k.z = nz; }

  const loc = locate(track, k.x, k.z, k.idx);
  k.prevS = k.s; k.idx = loc.idx; k.s = loc.s; k.lat = loc.lat;

  const zone = zoneAt(track, k.s);
  k.ice = zone === 'spill';
  // spinta turbo della pista Hot Wheels
  if (k.zoneBoostCD > 0) k.zoneBoostCD -= dt;
  if (zone === 'boost' && !(k.zoneBoostCD > 0) && !k.air) { giveBoost(k, 1.1, 'orange'); k.zoneBoostCD = 1.5; }
  // tavolo senza bordi: se esci, cadi e ti rimettono in pista (perdi qualche secondo)
  if (zone === 'table') {
    if (Math.abs(k.lat) > track.halfWidth + 3.5) {
      placeAt(track, k, k.s - 6, 0);
      k.y = groundHeight(track, k.s, 0); k.air = false; k.vy = 0;
      k.speed = 0; k.stopT = Math.max(k.stopT || 0, 1.3); k.shX = k.shZ = 0; k.pvx = k.pvz = undefined;
      k.drifting = false; k.driftDir = 0; k.driftCharge = 0;
      k.events.push('fall');
      return;
    }
  }
  // muretto
  const lim = track.wall - 1.3;
  if (zone !== 'table' && Math.abs(k.lat) > lim) {
    const p = track.pts[k.idx];
    const push = (Math.abs(k.lat) - lim) * Math.sign(k.lat);
    k.x -= p.rx * push; k.z -= p.rz * push; k.lat -= push;
    const along = Math.atan2(p.tx, p.tz);
    let d = along - k.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < Math.PI / 2) k.yaw += d * 0.35;
    if (k.bumpCD <= 0 && Math.abs(k.speed) > 8) { k.events.push('bump'); k.bumpCD = 0.5; k.speed *= 0.6; }
    k.drifting = false; k.driftDir = 0; k.driftCharge = 0;
  }
  k.grass = Math.abs(k.lat) > track.halfWidth;

  // altezza: rampa, volo, atterraggio
  const g = groundHeight(track, k.s, k.lat);
  if (!k.air) {
    if (g < k.y - 0.15) {
      k.air = true; k.airTime = 0; k.trick = false;
      k.vy = Math.max(6, k.speed * (2.4 / 16)) + 2.5;
    } else {
      k.y = g;
    }
  }
  if (k.air) {
    k.airTime += dt;
    k.vy -= GRAVITY * dt;
    k.y += k.vy * dt;
    if (k.y <= g) {
      k.y = g; k.air = false; k.vy = 0;
      k.events.push('land');
      if (k.trick) { giveBoost(k, 0.9, 'trick'); k.trick = false; }
    }
  }

  // buco dopo il trampolino: se ci arrivi senza volare, cadi e ti rimettono prima del salto
  if ((zone === 'gap' && !k.air) || k.y < -15) {
    placeAt(track, k, k.s - 55, 0);
    k.y = groundHeight(track, k.s, 0); k.air = false; k.vy = 0;
    k.speed = 0; k.stopT = Math.max(k.stopT || 0, 1.3); k.shX = k.shZ = 0; k.pvx = k.pvz = undefined;
    k.drifting = false; k.driftDir = 0; k.driftCharge = 0;
    k.events.push('fall');
    return;
  }
  // giri: passaggio sul traguardo (s = 0)
  const L = track.length;
  if (k.prevS > L * 0.75 && k.s < L * 0.25) { k.lapCount++; k.events.push('lap'); }
  else if (k.prevS < L * 0.25 && k.s > L * 0.75) k.lapCount--;

  // contromano
  const p = track.pts[k.idx];
  const dot = Math.sin(k.yaw) * p.tx + Math.cos(k.yaw) * p.tz;
  k.wrongWayT = dot < -0.3 && k.speed > 3 ? k.wrongWayT + dt : 0;
}

export function resolveStartBoost(k) {
  // startPress = secondi mancanti al VIA quando è stato premuto
  if (k.startPress >= 0 && k.startPress <= 0.55 && k.startPress >= 0.05) giveBoost(k, 1.3, 'start');
  else if (k.startPress > 0.55 && k.startPress < 1.4) { k.spinT = 0.9; k.events.push('spin'); }
  k.startPress = -1;
}

// spallate: ci si sposta di lato, ma senza rallentare (gare tirate, curva su curva)
const SHOVE = 4.2, SHOVE_MAX = 9;
function shove(k, nx, nz, closing) {
  if (k.shoveCD > 0) return;
  const j = SHOVE + Math.min(6, Math.max(0, closing) * 0.35);
  k.shX = (k.shX || 0) + nx * j; k.shZ = (k.shZ || 0) + nz * j;
  const m = Math.hypot(k.shX, k.shZ);
  if (m > SHOVE_MAX) { k.shX *= SHOVE_MAX / m; k.shZ *= SHOVE_MAX / m; }
  k.shoveCD = 0.18;
}
const velOf = (k) => [Math.sin(k.yaw) * (k.speed || 0) + (k.shX || 0), Math.cos(k.yaw) * (k.speed || 0) + (k.shZ || 0)];

export function collideKarts(karts) {
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j];
      if (Math.abs(a.y - b.y) > 1.5 || a.ghostT > 0 || b.ghostT > 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const min = KART_RADIUS * 2;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        if (a.bumpCD <= 0) { a.events.push('hit'); a.bumpCD = 0.4; }
        if (b.bumpCD <= 0) { b.events.push('hit'); b.bumpCD = 0.4; }
        a.contacts.push(b.slot); b.contacts.push(a.slot);
        const [avx, avz] = velOf(a), [bvx, bvz] = velOf(b);
        const closing = (avx - bvx) * nx + (avz - bvz) * nz;
        shove(a, -nx, -nz, closing); shove(b, nx, nz, closing);
      }
    }
  }
}

export function raceDistance(track, k) {
  return (k.lapCount - 1) * track.length + k.s;
}

// urto tra un kart calcolato qui e uno calcolato su un altro schermo:
// si sposta solo quello locale (l'altro lo gestisce il suo schermo)
export function collideWithRemote(local, remotes) {
  for (const a of local) {
    for (const b of remotes) {
      if (Math.abs(a.y - b.y) > 1.5 || a.ghostT > 0 || (b.ghostT || 0) > 0) continue;
      const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
      const min = KART_RADIUS * 2;
      if (d > 0.001 && d < min) {
        const push = min - d, nx = dx / d, nz = dz / d;
        a.x += nx * push; a.z += nz * push;
        if (a.bumpCD <= 0) { a.events.push('hit'); a.bumpCD = 0.4; }
        a.contacts.push(b.slot);
        const [avx, avz] = velOf(a), [bvx, bvz] = velOf(b);
        const closing = (bvx - avx) * nx + (bvz - avz) * nz;
        shove(a, nx, nz, closing);
      }
    }
  }
}

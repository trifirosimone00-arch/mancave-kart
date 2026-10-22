// Uno "schermo" della stanza.
// - PC principale (pc.html): apre la stanza, decide fasi e classifica.
// - Schermo collegato (pc.html?join=STANZA): per chi gioca da casa sua.
// Ogni schermo calcola i kart dei telefoni collegati a lui (niente ritardo nella guida)
// e scambia via internet solo le posizioni degli altri.
import { buildTrack } from './track.js';
import { createKart, stepKart, collideKarts, collideWithRemote, resolveStartBoost, raceDistance } from './sim.js';
import { createRenderer } from './render.js';
import { createScreenConfig, bindLayoutButtons, bindScreenBar } from './screen-ui.js';
import { iceServers, PEER_PREFIX, hasTurn } from './net.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const cleanRoom = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const JOIN = cleanRoom(params.get('join'));
const MASTER = !JOIN;
const MAX_PLAYERS = 4;
const INTRO_TIME = 5;
const COUNTDOWN = 3.2;
const AFTER_FIRST = 30;
const DT = 1 / 60;
const NET_MS = 33;           // ~30 aggiornamenti di rete al secondo
const INTERP_MS = 90;        // ritardo di interpolazione per i kart degli altri schermi

const store = {
  get(k, d) { try { const v = localStorage.getItem('mck-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mck-' + k, JSON.stringify(v)); } catch (e) { /* niente */ } },
};

const track = buildTrack();
const view = createRenderer($('game'), $('hud'), track);
const screen = createScreenConfig(MASTER ? 'mck-screen-main' : 'mck-screen-join');

// ------------------------------------------------------------------ stato
const room = MASTER ? cleanRoom(params.get('room') || store.get('room', 'MANCAVE')) || 'MANCAVE' : JOIN;
let suffix = '';
if (!MASTER) {
  suffix = sessionStorage.getItem('mck-suffix') || Math.random().toString(36).slice(2, 6);
  sessionStorage.setItem('mck-suffix', suffix);
}
const myId = PEER_PREFIX + room + (suffix ? '-' + suffix : '');

const W = {                       // stato della stanza (sul PC principale è la verità)
  q: 0, raceId: 0, phase: 'lobby', laps: 3, raceTime: 0, countdown: 0, introT: 0,
  paused: false, pauseMsg: '', players: [], grid: [], karts: [], results: [], captain: -1,
};
let pauseAuto = false, resumeT = 0, firstFinishAt = -1, finishT = 0;
let worldAt = 0;                  // (schermo collegato) quando è arrivato l'ultimo stato
let currentRace = 0;              // gara per cui ho creato i kart
let raceStartedLocal = false;

const locals = new Map();         // cid -> pilota collegato a QUESTO schermo
const karts = new Map();          // slot -> kart (calcolato qui, o contenitore per quelli degli altri)
const remoteBuf = new Map();      // slot -> { prev, cur } posizioni ricevute dagli altri schermi
const stations = new Map();       // (PC principale) id schermo -> { conn }

let peer = null, masterConn = null, masterOk = false;
const bc = new BroadcastChannel('mck-' + myId);

function toast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), ms);
}
function setNet(kind, text) { $('netdot').className = 'dot ' + kind; $('nettext').textContent = text; }
function send(conn, msg) { if (conn && conn.open) { try { conn.send(msg); } catch (e) { /* niente */ } } }
const isLocalSlot = (slot) => [...locals.values()].some(l => l.slot === slot);
const localBySlot = (slot) => [...locals.values()].find(l => l.slot === slot);
const regBySlot = (slot) => W.players.find(p => p.slot === slot);

// ------------------------------------------------------------------ rete: apertura
async function startNet() {
  drawCode();
  if (typeof Peer === 'undefined') { setNet('bad', 'Libreria di rete non caricata: controlla internet e ricarica.'); return; }
  setNet('wait', MASTER ? 'Apro la stanza…' : 'Mi collego alla stanza…');
  const ice = await iceServers();
  let tries = 0;
  const open = () => {
    peer = new Peer(myId, { debug: 1, config: { iceServers: ice } });
    peer.on('open', () => {
      if (MASTER) setNet('ok', hasTurn() ? `Stanza ${room} aperta: si gioca anche a distanza` : `Stanza ${room} aperta`);
      else connectMaster();
    });
    peer.on('connection', onIncoming);
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => peer.reconnect(), 1500); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') {
        peer.destroy();
        tries++;
        if (MASTER && tries > 15) { setNet('bad', `Il nome "${room}" è già usato da un'altra stanza: cambialo qui sotto.`); return; }
        setNet('wait', MASTER ? 'Riapro la stanza…' : 'Mi ricollego…');
        if (!MASTER) { suffix = Math.random().toString(36).slice(2, 6); sessionStorage.setItem('mck-suffix', suffix); location.reload(); return; }
        setTimeout(open, 3000);
      } else if (e.type === 'peer-unavailable') {
        if (!MASTER) { setNet('bad', `Stanza ${room} non trovata: il PC principale l'ha aperta?`); retryMaster(); }
      } else if (['network', 'server-error', 'socket-error'].includes(e.type)) {
        setNet('bad', 'Server non raggiungibile, riprovo…');
        setTimeout(() => { if (peer.disconnected && !peer.destroyed) peer.reconnect(); }, 3000);
      }
    });
  };
  open();
}

function drawCode() {
  $('code').textContent = room;
  const base = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  const url = `${base}telefono.html?r=${room}${suffix ? '&s=' + suffix : ''}`;
  $('url').textContent = url.replace(/^https?:\/\//, '');
  if (typeof qrcode !== 'undefined') {
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    $('qr').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  } else $('qr').textContent = 'Apri il link qui sotto dal telefono';
}

// tutto ciò che si collega a me: telefoni (e, se sono il PC principale, gli altri schermi)
function onIncoming(conn) {
  conn.on('data', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (MASTER && (msg.t === 'station' || conn.isStation)) onStationMsg(conn, msg);
    else onPhoneMsg(conn, msg);
  });
  conn.on('close', () => onClosed(conn));
  conn.on('error', () => onClosed(conn));
}

function onClosed(conn) {
  if (conn.isStation) {
    const id = conn.stationId;
    stations.delete(id);
    for (const p of W.players) if (p.station === id) setConnected(p.slot, false);
    toast('Uno schermo collegato si è scollegato');
    drawLobby();
    return;
  }
  const l = [...locals.values()].find(q => q.conn === conn);
  if (!l) return;
  l.conn = null; l.connected = false;
  l.input = { steer: 0, drift: false, brake: false, trick: false };
  if (MASTER) setConnected(l.slot, false);
  else send(masterConn, { t: 'pconn', slot: l.slot, on: false });
  if (W.phase === 'lobby' || W.phase === 'podium') locals.delete(l.cid);
}

// ------------------------------------------------------------------ telefoni (su qualsiasi schermo)
function onPhoneMsg(conn, msg) {
  if (msg.t === 'hello') {
    const cid = String(msg.cid || '').slice(0, 20);
    const name = String(msg.name || 'Pilota').slice(0, 14);
    const color = /^#[0-9a-f]{6}$/i.test(msg.color) ? msg.color : '#e8322b';
    let l = locals.get(cid);
    if (!l) { l = { cid, slot: -1, input: { steer: 0, drift: false, brake: false, trick: false }, seq: -1 }; locals.set(cid, l); }
    Object.assign(l, { conn, connected: true, name, color, seq: -1 });
    requestJoin(l);
    return;
  }
  const l = [...locals.values()].find(q => q.conn === conn);
  if (!l || l.slot < 0) return;
  switch (msg.t) {
    case 'in':
      if (typeof msg.q === 'number') { if (msg.q <= l.seq && l.seq - msg.q < 1000) break; l.seq = msg.q; }
      l.input.steer = Math.max(-1, Math.min(1, Number(msg.s) || 0));
      l.input.drift = !!msg.d; l.input.brake = !!msg.b;
      if (msg.k) l.input.trick = true;
      if (W.phase === 'intro' && msg.d) command(l.slot, { t: 'skip' });
      break;
    case 'pause': case 'start': case 'laps': case 'again': case 'lobby':
      command(l.slot, msg);
      break;
    case 'leave':
      command(l.slot, { t: 'leave' });
      locals.delete(l.cid);
      break;
  }
}

function requestJoin(l) {
  if (MASTER) {
    const r = assignSlot(l.cid, l.name, l.color, 'self');
    if (r.error) { send(l.conn, { t: r.error }); locals.delete(l.cid); return; }
    l.slot = r.slot;
    send(l.conn, { t: 'welcome', slot: l.slot });
    pushStatus(true);
  } else {
    if (!masterOk) { setTimeout(() => locals.has(l.cid) && requestJoin(l), 1000); return; }
    send(masterConn, { t: 'join', cid: l.cid, name: l.name, color: l.color });
  }
}

function command(slot, msg) {
  if (MASTER) handleCommand(slot, msg);
  else send(masterConn, { t: 'cmd', slot, msg });
}

function vibrate(slot, pattern) {
  const l = localBySlot(slot);
  if (l) send(l.conn, { t: 'vib', p: pattern });
}

function pushStatus(force) {
  const now = performance.now();
  if (!force && now - (pushStatus.last || 0) < 150) return;
  pushStatus.last = now;
  for (const l of locals.values()) {
    if (!l.conn || l.slot < 0) continue;
    const k = karts.get(l.slot);
    const wk = W.karts.find(q => q.slot === l.slot);
    send(l.conn, {
      t: 'st', phase: W.phase, laps: W.laps, n: W.players.length, captain: W.captain === l.slot,
      paused: W.paused, pauseMsg: W.pauseMsg, slot: l.slot,
      place: MASTER ? (k ? k.place : 0) : (wk ? wk.place : 0), lap: k ? Math.max(1, Math.min(W.laps, k.lapCount)) : 0,
      finished: k ? k.finished : false, air: k ? k.air : false,
      results: W.phase === 'podium' ? W.results : undefined,
    });
  }
}

// ------------------------------------------------------------------ PC principale: registro e comandi
function assignSlot(cid, name, color, station) {
  let p = W.players.find(q => q.cid === cid);
  if (p) { Object.assign(p, { name, color, station, connected: true }); maybeResume(); drawLobby(); return { slot: p.slot }; }
  if (W.phase !== 'lobby' && W.phase !== 'podium') return { error: 'busy' };
  if (W.players.length >= MAX_PLAYERS) return { error: 'full' };
  const used = new Set(W.players.map(q => q.slot));
  let slot = 0; while (used.has(slot)) slot++;
  W.players.push({ slot, cid, name, color, station, connected: true, kbd: cid.startsWith('kbd') });
  W.players.sort((a, b) => a.slot - b.slot);
  toast(`${name} è entrato${station === 'self' ? '' : ' (a distanza)'}`);
  updateCaptain(); drawLobby();
  return { slot };
}

function removePlayer(slot) {
  W.players = W.players.filter(p => p.slot !== slot);
  updateCaptain(); drawLobby();
}

function setConnected(slot, on) {
  const p = regBySlot(slot);
  if (!p) return;
  p.connected = on;
  if (!on) {
    if (W.phase === 'lobby' || W.phase === 'podium') removePlayer(slot);
    else if (!W.paused || pauseAuto) setPause(true, `Aspettando ${p.name}…`, true);
  } else maybeResume();
  updateCaptain(); drawLobby();
}

function updateCaptain() {
  const real = W.players.filter(p => p.connected && !p.kbd);
  W.captain = real.length ? real[0].slot : (W.players[0] ? W.players[0].slot : -1);
}

function handleCommand(slot, msg) {
  const racing = ['intro', 'countdown', 'race', 'finish'].includes(W.phase);
  const p = regBySlot(slot);
  const cap = W.captain === slot;
  switch (msg.t) {
    case 'skip': if (W.phase === 'intro') W.introT = INTRO_TIME; break;
    case 'pause': if (racing) setPause(!W.paused, `${p ? p.name : 'Qualcuno'} ha messo in pausa`, false); break;
    case 'start': if (cap && W.phase === 'lobby') startRace(); break;
    case 'again': if (cap && W.phase === 'podium') startRace(); break;
    case 'lobby': if (cap) toLobby(); break;
    case 'laps': if (cap && [1, 3, 5].includes(msg.n) && W.phase === 'lobby') { W.laps = msg.n; drawLobby(); } break;
    case 'leave': if (W.phase === 'lobby' || W.phase === 'podium') removePlayer(slot); break;
  }
  pushStatus(true);
}

function onStationMsg(conn, msg) {
  if (msg.t === 'station') {
    conn.isStation = true; conn.stationId = String(msg.id);
    stations.set(conn.stationId, { conn });
    send(conn, worldMsg());
    toast('Uno schermo a distanza si è collegato');
    drawLobby();
    return;
  }
  const sid = conn.stationId;
  switch (msg.t) {
    case 'join': {
      const r = assignSlot(String(msg.cid), String(msg.name || 'Pilota').slice(0, 14), msg.color, sid);
      send(conn, r.error ? { t: 'deny', cid: msg.cid, why: r.error } : { t: 'joined', cid: msg.cid, slot: r.slot });
      break;
    }
    case 'cmd': { const p = regBySlot(msg.slot); if (p && p.station === sid) handleCommand(msg.slot, msg.msg || {}); break; }
    case 'pconn': { const p = regBySlot(msg.slot); if (p && p.station === sid) setConnected(msg.slot, !!msg.on); break; }
    case 'k':
      if (msg.raceId !== W.raceId) break;
      for (const s of msg.karts || []) {
        const p = regBySlot(s.slot);
        if (!p || p.station !== sid) continue;
        pushRemote(s, msg.q);
      }
      break;
  }
}

// ------------------------------------------------------------------ schermo collegato: rapporto col PC principale
let retryT = 0;
function connectMaster() {
  if (peer.disconnected) { if (!peer.destroyed) peer.reconnect(); return; }
  if (masterConn) { try { masterConn.close(); } catch (e) { /* niente */ } }
  masterConn = peer.connect(PEER_PREFIX + room, { reliable: false, serialization: 'json' });
  if (!masterConn) { retryMaster(); return; }
  const giveUp = setTimeout(() => { if (!masterOk) setNet('bad', 'Non riesco a raggiungere la stanza, riprovo…'); }, 12000);
  masterConn.on('open', () => {
    clearTimeout(giveUp);
    masterOk = true;
    send(masterConn, { t: 'station', id: myId });
    setNet('ok', `Collegato alla stanza ${room}`);
    for (const l of locals.values()) {
      if (l.slot >= 0) send(masterConn, { t: 'join', cid: l.cid, name: l.name, color: l.color });
      if (l.slot >= 0 && !l.connected) send(masterConn, { t: 'pconn', slot: l.slot, on: false });
    }
    $('lost').classList.add('hidden');
  });
  masterConn.on('data', onMasterMsg);
  masterConn.on('close', () => { masterOk = false; $('lost').classList.remove('hidden'); retryMaster(); });
  masterConn.on('error', () => { masterOk = false; retryMaster(); });
}
function retryMaster() {
  clearTimeout(retryT);
  retryT = setTimeout(() => { if (!masterOk) connectMaster(); }, 3000);
}

function onMasterMsg(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'w':
      if (msg.q <= W.q && W.q - msg.q < 100000) return; // vecchio, arrivato in ritardo
      applyWorld(msg);
      break;
    case 'joined': {
      const l = locals.get(String(msg.cid));
      if (!l) return;
      l.slot = msg.slot;
      send(l.conn, { t: 'welcome', slot: l.slot });
      break;
    }
    case 'deny': {
      const l = locals.get(String(msg.cid));
      if (l) { send(l.conn, { t: msg.why }); locals.delete(l.cid); }
      break;
    }
  }
}

function applyWorld(msg) {
  const prevPhase = W.phase;
  Object.assign(W, msg);
  worldAt = performance.now();
  for (const s of msg.karts || []) if (!isLocalSlot(s.slot)) pushRemote(s, msg.q);
  if (W.raceId !== currentRace && W.phase !== 'lobby') buildKarts();
  if (W.phase === 'race' && !raceStartedLocal && currentRace === W.raceId) {
    raceStartedLocal = true;
    for (const k of karts.values()) if (isLocalSlot(k.slot)) { resolveStartBoost(k); startVib(k); }
  }
  if (W.phase !== prevPhase) onPhaseChange();
  pushStatus(W.phase !== prevPhase);
}

// ------------------------------------------------------------------ posizioni degli altri schermi
function pushRemote(s, q) {
  const now = performance.now();
  let b = remoteBuf.get(s.slot);
  if (!b) { b = {}; remoteBuf.set(s.slot, b); }
  if (b.cur && typeof q === 'number' && q <= b.cur.q) return;
  b.prev = b.cur; b.cur = { s, at: now, q };
  // sul PC principale tengo aggiornato anche il "contenitore" del kart (classifica, arrivo)
  const k = karts.get(s.slot);
  if (k && !isLocalSlot(s.slot)) {
    Object.assign(k, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, s: s.s, lat: s.lat, lapCount: s.lapCount, speed: s.speed, air: s.air });
    if (s.finished && !k.finished) { k.finished = true; k.finishTime = s.finishTime; if (MASTER && firstFinishAt < 0) firstFinishAt = W.raceTime; }
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
function remoteRender(slot) {
  const b = remoteBuf.get(slot);
  if (!b || !b.cur) return null;
  if (!b.prev) return b.cur.s;
  const target = performance.now() - INTERP_MS;
  const span = Math.max(10, b.cur.at - b.prev.at);
  let t = (target - b.prev.at) / span;
  t = Math.max(0, Math.min(1.6, t));
  const a = b.prev.s, c = b.cur.s;
  if (Math.hypot(c.x - a.x, c.z - a.z) > 25) return c;
  return { ...c, x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t, z: a.z + (c.z - a.z) * t, yaw: lerpAngle(a.yaw, c.yaw, t) };
}

// ------------------------------------------------------------------ gara
function startRace() {
  if (!W.players.length) return;
  const order = [...W.players].sort(() => Math.random() - 0.5);
  W.grid = order.map((p, i) => ({ slot: p.slot, gi: i }));
  W.raceId = Date.now() % 1e9;
  W.phase = 'intro'; W.introT = 0; W.raceTime = 0; W.countdown = COUNTDOWN; W.results = [];
  firstFinishAt = -1; finishT = 0;
  buildKarts();
  setPause(false);
  onPhaseChange();
  pushStatus(true);
}

function buildKarts() {
  karts.clear(); remoteBuf.clear();
  for (const g of W.grid) {
    const p = regBySlot(g.slot) || { name: 'Pilota', color: '#888888' };
    karts.set(g.slot, createKart(track, g.slot, g.gi, p));
  }
  currentRace = W.raceId; raceStartedLocal = false;
}

function toLobby() {
  W.phase = 'lobby'; karts.clear(); remoteBuf.clear(); W.grid = [];
  setPause(false);
  W.players = W.players.filter(p => p.connected);
  updateCaptain(); onPhaseChange(); pushStatus(true);
}

function setPause(on, msg = '', auto = false) {
  W.paused = on; W.pauseMsg = msg; pauseAuto = on && auto; resumeT = 0;
  pushStatus(true);
}
function maybeResume() {
  if (W.paused && pauseAuto && W.players.every(p => p.connected)) { resumeT = 3; W.pauseMsg = 'Tutti dentro! Si riparte…'; }
}

function finishRace() {
  W.phase = 'podium';
  const ranked = [...karts.values()].sort((a, b) => a.place - b.place);
  W.results = ranked.map(k => {
    const p = regBySlot(k.slot) || k;
    return { slot: k.slot, name: p.name, color: p.color, place: k.place, time: k.finished ? k.finishTime : null };
  });
  onPhaseChange(); pushStatus(true);
}

function updatePlaces() {
  const list = [...karts.values()];
  list.sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return raceDistance(track, b) - raceDistance(track, a);
  });
  list.forEach((k, i) => { k.place = i + 1; });
}

function startVib(k) {
  if (k.boostKind === 'start') vibrate(k.slot, [60, 40, 60]);
  else if (k.spinT > 0) vibrate(k.slot, [250]);
}

// tempo di gara e conto alla rovescia visti da questo schermo
function raceClock() {
  if (MASTER) return { raceTime: W.raceTime, countdown: W.countdown, introT: W.introT };
  const el = W.paused ? 0 : (performance.now() - worldAt) / 1000;
  return {
    raceTime: (W.phase === 'race' || W.phase === 'finish') ? W.raceTime + el : W.raceTime,
    countdown: W.phase === 'countdown' ? W.countdown - el : W.countdown,
    introT: W.phase === 'intro' ? W.introT + el : W.introT,
  };
}

// tastiera (per provare senza telefono), su questo schermo
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  const kb = locals.get('kbd-' + myId);
  if ((e.code === 'KeyP' || e.code === 'Escape') && ['intro', 'countdown', 'race', 'finish'].includes(W.phase)) {
    if (MASTER) setPause(!W.paused, 'Pausa dal PC', false); else if (kb) command(kb.slot, { t: 'pause' });
  }
  if (e.code === 'Space' && W.phase === 'intro') { if (MASTER) W.introT = INTRO_TIME; else if (kb) command(kb.slot, { t: 'skip' }); }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && W.phase !== 'lobby') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function simStep() {
  const kb = locals.get('kbd-' + myId);
  if (kb) {
    kb.input.steer = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    kb.input.drift = !!(keys.Space || keys.ShiftLeft);
    kb.input.brake = !!(keys.ArrowDown || keys.KeyS);
  }
  if (W.paused) {
    if (MASTER && resumeT > 0) {
      resumeT -= DT;
      W.pauseMsg = `Si riparte tra ${Math.ceil(resumeT)}…`;
      if (resumeT <= 0) setPause(false);
    }
    return;
  }
  const clock = raceClock();

  if (W.phase === 'intro') {
    if (MASTER) {
      W.introT += DT;
      if (W.introT >= INTRO_TIME) { W.phase = 'countdown'; W.countdown = COUNTDOWN; onPhaseChange(); pushStatus(true); }
    }
    return;
  }
  if (W.phase === 'countdown') {
    if (MASTER) W.countdown -= DT;
    const left = MASTER ? W.countdown : clock.countdown;
    for (const k of karts.values()) {
      const l = localBySlot(k.slot);
      if (l) stepKart(track, k, { ...l.input, countdownLeft: left }, DT, 'countdown');
    }
    if (MASTER && W.countdown <= 0) {
      W.phase = 'race'; W.raceTime = 0; raceStartedLocal = true;
      for (const k of karts.values()) if (isLocalSlot(k.slot)) { resolveStartBoost(k); startVib(k); }
      onPhaseChange(); pushStatus(true);
    }
    return;
  }
  if (W.phase === 'race' || W.phase === 'finish') {
    if (MASTER) W.raceTime += DT;
    const now = MASTER ? W.raceTime : clock.raceTime;
    const mine = [], others = [];
    for (const k of karts.values()) {
      const l = localBySlot(k.slot);
      if (!l) { others.push(k); continue; }
      mine.push(k);
      stepKart(track, k, l.input, DT, 'race');
      l.input.trick = false;
      if (!k.finished && k.lapCount > W.laps) {
        k.finished = true; k.finishTime = now;
        vibrate(k.slot, [80, 60, 80, 60, 200]);
        if (MASTER && firstFinishAt < 0) firstFinishAt = W.raceTime;
      }
    }
    collideKarts(mine);
    const ghosts = others.map(k => remoteRender(k.slot)).filter(Boolean);
    collideWithRemote(mine, ghosts);
    for (const k of mine) {
      for (const e of k.events) {
        if (e === 'boost') vibrate(k.slot, [35]);
        else if (e === 'bump') vibrate(k.slot, [90]);
        else if (e === 'hit') vibrate(k.slot, [50]);
        else if (e === 'land') vibrate(k.slot, [25]);
        else if (e === 'trick') vibrate(k.slot, [20, 30, 20]);
        else if (e === 'spin') vibrate(k.slot, [250]);
      }
      k.events.length = 0;
    }
    if (MASTER) {
      updatePlaces();
      const all = [...karts.values()];
      const allDone = all.length && all.every(k => k.finished);
      const timeUp = firstFinishAt >= 0 && W.raceTime - firstFinishAt > AFTER_FIRST;
      if (W.phase === 'race' && (allDone || timeUp)) { W.phase = 'finish'; finishT = 0; onPhaseChange(); pushStatus(true); }
      if (W.phase === 'finish') { finishT += DT; if (finishT > 4) finishRace(); }
    }
  }
}

// ------------------------------------------------------------------ messaggi di rete
const r2 = (v) => Math.round(v * 100) / 100;
function compact(k) {
  return {
    slot: k.slot, x: r2(k.x), y: r2(k.y), z: r2(k.z), yaw: Math.round(k.yaw * 1000) / 1000, s: r2(k.s), lat: r2(k.lat),
    speed: r2(k.speed), vy: r2(k.vy), air: k.air, hop: r2(k.hop), drifting: k.drifting, driftDir: k.driftDir, driftT: r2(k.driftT),
    driftCharge: r2(k.driftCharge), boostT: r2(k.boostT), boostKind: k.boostKind, trickT: r2(k.trickT), spinT: r2(k.spinT),
    place: k.place, lapCount: k.lapCount, finished: k.finished, finishTime: r2(k.finishTime || 0), wrongWay: r2(k.wrongWayT),
  };
}
function worldMsg() {
  W.q++;
  return {
    t: 'w', q: W.q, raceId: W.raceId, phase: W.phase, laps: W.laps, raceTime: W.raceTime, countdown: W.countdown,
    introT: W.introT, paused: W.paused, pauseMsg: W.pauseMsg, captain: W.captain, grid: W.grid, results: W.results,
    players: W.players.map(p => ({ slot: p.slot, cid: p.cid, name: p.name, color: p.color, station: p.station, connected: p.connected, kbd: p.kbd })),
    // per i kart degli altri schermi inoltro l'ultima posizione completa ricevuta
    karts: [...karts.values()].map(k => {
      if (isLocalSlot(k.slot)) return compact(k);
      const b = remoteBuf.get(k.slot);
      return b && b.cur ? { ...b.cur.s, place: k.place, finished: k.finished, finishTime: k.finishTime } : compact(k);
    }),
  };
}
let lastNet = 0, kSeq = 0;
function netTick(now) {
  if (now - lastNet < NET_MS) return;
  lastNet = now;
  if (MASTER) {
    if (stations.size) {
      const m = worldMsg();
      for (const s of stations.values()) send(s.conn, m);
    }
    W.karts = [...karts.values()].map(k => ({ slot: k.slot, place: k.place }));
  } else if (masterOk && currentRace && W.phase !== 'lobby') {
    const mine = [...karts.values()].filter(k => isLocalSlot(k.slot));
    if (mine.length) send(masterConn, { t: 'k', q: ++kSeq, raceId: currentRace, karts: mine.map(compact) });
  }
}

// ------------------------------------------------------------------ cosa disegnare
function renderSnap() {
  const clock = raceClock();
  const list = [];
  for (const k of karts.values()) {
    const p = regBySlot(k.slot) || k;
    const s = isLocalSlot(k.slot) ? k : (remoteRender(k.slot) || k);
    const wk = W.karts.find(q => q.slot === k.slot);
    list.push({
      ...s, slot: k.slot, name: p.name, color: p.color, wrongWay: s.wrongWayT ?? s.wrongWay ?? 0,
      place: MASTER ? k.place : (wk ? wk.place : k.place),
    });
  }
  return {
    phase: W.phase, laps: W.laps, raceTime: clock.raceTime, countdown: clock.countdown,
    introT: Math.min(1, clock.introT / INTRO_TIME), paused: W.paused, karts: list,
  };
}

function playerList() {
  return W.players.map(p => ({ slot: p.slot, name: p.name, color: p.color, here: isLocalSlot(p.slot) }));
}

// ------------------------------------------------------------------ interfaccia
function onPhaseChange() {
  $('lobby').classList.toggle('hidden', W.phase !== 'lobby');
  $('podium').classList.toggle('hidden', W.phase !== 'podium');
  if (W.phase === 'podium') drawPodium();
  if (W.phase === 'lobby') { karts.clear(); remoteBuf.clear(); currentRace = 0; drawLobby(); }
}

let lobbySig = '';
function drawLobby() {
  const sig = JSON.stringify([W.players, W.laps, W.captain, stations.size, [...locals.keys()]]);
  if (sig === lobbySig) return;
  lobbySig = sig;
  const el = $('players');
  el.innerHTML = '';
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = W.players[i];
    const d = document.createElement('div');
    if (p) {
      const here = isLocalSlot(p.slot);
      d.className = 'pcard';
      d.style.borderColor = p.color;
      d.innerHTML = `<div class="kart"></div><div><div class="nm"></div><div class="st"></div></div>`;
      d.querySelector('.kart').style.background = p.color;
      d.querySelector('.nm').textContent = p.name;
      if (W.captain === p.slot) d.querySelector('.nm').insertAdjacentHTML('beforeend', '<span class="cap">CAPO</span>');
      const stEl = d.querySelector('.st');
      stEl.textContent = !p.connected ? 'Disconnesso' : p.kbd ? 'Tastiera: frecce + spazio' : here ? 'Pronto' : 'Pronto · a distanza';
      if (!p.connected) stEl.classList.add('off');
      if (MASTER) {
        const rm = document.createElement('button');
        rm.className = 'rm'; rm.type = 'button'; rm.textContent = '×';
        rm.setAttribute('aria-label', 'Togli ' + p.name);
        rm.onclick = () => {
          const l = localBySlot(p.slot);
          if (l) { send(l.conn, { t: 'kicked' }); locals.delete(l.cid); }
          removePlayer(p.slot);
        };
        d.appendChild(rm);
      }
    } else {
      d.className = 'pcard empty';
      d.innerHTML = `<div class="kart none"></div><div><div class="nm" style="color:#9aa0bd">Posto libero</div><div class="st off" style="color:#9aa0bd">In attesa di un pilota</div></div>`;
    }
    el.appendChild(d);
  }
  const lapsEl = $('laps');
  lapsEl.innerHTML = '';
  for (const n of [1, 3, 5]) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = n; b.className = W.laps === n ? 'on' : '';
    b.disabled = !MASTER;
    b.onclick = () => { if (MASTER) { W.laps = n; drawLobby(); pushStatus(true); } };
    lapsEl.appendChild(b);
  }
  $('start').classList.toggle('hidden', !MASTER);
  $('start').disabled = W.players.length === 0;
  $('wait-start').classList.toggle('hidden', MASTER);
  $('kbd').textContent = locals.has('kbd-' + myId) ? 'Togli la tastiera' : 'Prova con la tastiera';
  $('stations-count').textContent = MASTER ? (stations.size ? `${stations.size} schermo${stations.size === 1 ? '' : 'i'} a distanza collegat${stations.size === 1 ? 'o' : 'i'}` : 'Nessuno schermo a distanza collegato') : '';
}

function fmt(t) {
  if (t == null) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

function drawPodium() {
  const st = $('stands');
  st.innerHTML = '';
  for (const place of [2, 1, 3]) {
    const r = W.results.find(x => x.place === place);
    if (!r) continue;
    const d = document.createElement('div');
    d.className = `stand p${place}`;
    d.innerHTML = `<div class="who"><span class="ball"></span><span class="n"></span></div><div class="block">${place}</div>`;
    d.querySelector('.ball').style.background = r.color;
    d.querySelector('.n').textContent = r.name;
    st.appendChild(d);
  }
  const tb = $('results');
  tb.innerHTML = '';
  for (const r of W.results) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="width:60px">${r.place}°</td><td><span class="sw"></span><span class="n"></span></td><td class="r">${r.time == null ? 'non arrivato' : fmt(r.time)}</td>`;
    tr.querySelector('.sw').style.background = r.color;
    tr.querySelector('.n').textContent = r.name;
    tb.appendChild(tr);
  }
  $('again').classList.toggle('hidden', !MASTER);
  $('tolobby').classList.toggle('hidden', !MASTER);
}

// pulsanti
bindLayoutButtons($('layout'), screen);
bindScreenBar($('screenbar'), screen, playerList, { enabled: () => W.phase !== 'lobby' });
$('start').onclick = () => MASTER && startRace();
$('again').onclick = () => MASTER && startRace();
$('tolobby').onclick = () => MASTER && toLobby();
$('quit').onclick = () => { if (MASTER) toLobby(); };
$('resume').onclick = () => { if (MASTER) setPause(false); else { const kb = [...locals.values()][0]; if (kb) command(kb.slot, { t: 'pause' }); } };
$('kbd').onclick = () => {
  const cid = 'kbd-' + myId;
  const l = locals.get(cid);
  if (l) {
    locals.delete(cid);
    if (l.slot >= 0) command(l.slot, { t: 'leave' });
  } else {
    const nl = { cid, name: 'Tastiera', color: '#ff8a00', conn: null, connected: true, slot: -1, input: { steer: 0, drift: false, brake: false, trick: false }, seq: -1 };
    locals.set(cid, nl);
    requestJoin(nl);
  }
  lobbySig = ''; drawLobby();
};
if ($('room-save')) {
  $('room-name').value = room;
  $('room-save').onclick = () => {
    const v = cleanRoom($('room-name').value);
    if (!v || v === room) return;
    store.set('room', v);
    location.href = location.pathname + '?room=' + v;
  };
}
const openMonitor = () => {
  const n = (openMonitor.n = (openMonitor.n || 0) + 1);
  window.open(`monitor.html?ch=${encodeURIComponent(myId)}&m=${n}`, `mck-monitor-${n}`, 'popup,width=1280,height=720');
};
$('open-screen').onclick = openMonitor;
$('sb-open').onclick = openMonitor;
if (!MASTER) {
  document.title = `Mancave Kart – Stanza ${room}`;
  $('subtitle').textContent = `Schermo collegato alla stanza ${room}`;
  $('room-box').classList.add('hidden');
}

// ------------------------------------------------------------------ cicli
let acc = 0, lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  let steps = 0;
  while (acc >= DT && steps < 15) { simStep(); acc -= DT; steps++; }
  if (steps === 15) acc = 0;
  netTick(now);
  pushStatus(false);
  if (W.phase === 'lobby') drawLobby();
  // pausa
  $('pause').classList.toggle('hidden', !W.paused || W.phase === 'lobby' || W.phase === 'podium');
  $('pause-msg').textContent = W.pauseMsg || 'La gara è in pausa';
  $('resume').classList.toggle('hidden', !MASTER || pauseAuto);
}, 1000 / 60);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const snap = renderSnap();
  // in automatico ogni schermo mostra solo i piloti collegati a lui
  const players = playerList();
  const here = players.filter(p => p.here);
  const slots = W.phase === 'lobby' ? [-1] : screen.slots(screen.mode === 'auto' && here.length ? here : players);
  try { view.render(snap, slots, dt); } catch (e) { console.error(e); }
  try { bc.postMessage({ t: 'snap', snap, players }); } catch (e) { /* niente */ }
}

drawLobby();
startNet();
requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => { if (peer) peer.destroy(); });

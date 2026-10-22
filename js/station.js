// Uno "schermo" della stanza.
// - PC principale (pc.html): apre la stanza, decide fasi e classifica.
// - Schermo collegato (pc.html?join=STANZA): per chi gioca da casa sua.
// Ogni schermo calcola i kart dei telefoni collegati a lui (niente ritardo nella guida)
// e scambia via internet solo le posizioni degli altri.
import { buildTrack } from './track.js';
import { createKart, stepKart, collideKarts, collideWithRemote, resolveStartBoost, raceDistance, placeAt, giveBoost } from './sim.js';
import { CARDS, comboOf, drawCard, receive, applySelf, HAND_SIZE, COOLDOWN, PORTAL_COOLDOWN, PORTAL_FRACTIONS } from './cards.js';
import { createRenderer } from './render.js';
import { createScreenConfig, bindLayoutButtons, bindScreenBar } from './screen-ui.js';
import { iceServers, PEER_PREFIX, hasTurn } from './net.js';
import { CPU_LEVELS, CPU_NAMES, newBrain, cpuInput } from './ai.js';
import {
  PIT_FRACTION, PIT_INTRO, PIT_RESULTS, PIT_GO, TIE_INTRO, TIE_TAP, pitLaps, GAMES, GAME_IDS, gameDuration, gameRounds, rankGame, tieGroups, applyTie,
  liveLabel, liveBar, prizeFor, cpuMgNew, cpuMgTick, buildQuiz, duelStart, duelRound, duelPairOf, semRoundTime, QUIZ_CATS,
} from './minigames.js';
import { drawPit } from './mg-tv.js';

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
  portals: PORTAL_FRACTIONS.map(() => 0), hazards: [], missiles: [], feed: [],
  pit: null, pitsDone: 0, pitUsed: [],
};
W.mgShort = !!store.get('mg-short', false);
W.quizCats = (store.get('quiz-cats', QUIZ_CATS) || []).filter(c => QUIZ_CATS.includes(c));
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
    case 'use': useCard(l.slot, Number(msg.i), msg.to == null ? null : Number(msg.to)); break;
    case 'combo': comboCards(l.slot, Number(msg.a), Number(msg.b)); break;
    case 'discard': discardFor(l.slot, Number(msg.i)); break;
    case 'mg': if (W.pit && msg.s && typeof msg.s === 'object' && msg.s.id === W.pit.id && JSON.stringify(msg.s).length < 3000) l.mg = msg.s; break;
    case 'offer': pickOffer(l.slot, msg.pick); break;
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
      pit: pitInfo(l.slot), offer: offerInfo(l.slot),
      hand: handInfo(l.slot), others: W.players.filter(p => p.slot !== l.slot).map(p => ({ slot: p.slot, name: p.name, color: p.color })),
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
  W.players.push({ slot, cid, name, color, station, connected: true, kbd: cid.startsWith('kbd'), cpu: cid.startsWith('cpu') });
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
  const real = W.players.filter(p => p.connected && !p.kbd && !p.cpu);
  W.captain = real.length ? real[0].slot : (W.players[0] ? W.players[0].slot : -1);
}

function handleCommand(slot, msg) {
  const racing = ['intro', 'countdown', 'race', 'pit', 'finish'].includes(W.phase);
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
    case 'c': onMasterCmd(msg.msg || {}, sid); break;
    case 'k':
      if (msg.raceId !== W.raceId) break;
      if (W.pit && Array.isArray(msg.mg)) for (const m of msg.mg) {
        const p = regBySlot(m.slot);
        if (p && p.station === sid && m.s && m.s.id === W.pit.id) mgStates.set(m.slot, m.s);
      }
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
    case 's': onStationCmd(msg.msg || {}); break;
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
  W.portals = PORTAL_FRACTIONS.map(() => 0); W.hazards = []; W.missiles = []; W.feed = [];
  W.pit = null; W.pitsDone = 0; W.pitUsed = []; mgStates.clear(); botMg.clear(); appliedPrizes.clear();
  firstFinishAt = -1; finishT = 0;
  for (const l of locals.values()) if (l.brain) l.brain = newBrain(cpuLevel);
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
  hands.clear(); hitHazards.clear();
}

function toLobby() {
  W.pit = null;
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
  if ((e.code === 'KeyP' || e.code === 'Escape') && ['intro', 'countdown', 'race', 'pit', 'finish'].includes(W.phase)) {
    if (MASTER) setPause(!W.paused, 'Pausa dal PC', false); else if (kb) command(kb.slot, { t: 'pause' });
  }
  if (kb && kb.slot >= 0 && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    const i = Number(e.code.slice(5)) - 1;
    const h = hands.get(kb.slot);
    const id = h && h.cards[i];
    let to = null;
    if (id && CARDS[id].target === 'pick') { const o = W.players.find(p => p.slot !== kb.slot); to = o ? o.slot : null; }
    useCard(kb.slot, i, to);
  }
  if (e.code === 'Space' && W.phase === 'intro') { if (MASTER) W.introT = INTRO_TIME; else if (kb) command(kb.slot, { t: 'skip' }); }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && W.phase !== 'lobby') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// piloti del computer: decidono sterzo, derapata e carte
function cpuThink(countdownLeft) {
  for (const l of locals.values()) {
    if (!l.brain || l.slot < 0) continue;
    const k = karts.get(l.slot);
    if (!k) continue;
    l.brain.level = cpuLevel;
    l.input = cpuInput(track, k, l.brain, DT, {
      phase: W.phase === 'finish' ? 'race' : W.phase, countdownLeft,
      hand: hands.get(l.slot),
      others: [...karts.values()].filter(q => q.slot !== l.slot),
      useCard: (i, to) => useCard(l.slot, i, to),
    });
  }
}

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
  if (['countdown', 'race', 'finish'].includes(W.phase)) cpuThink(MASTER ? W.countdown : clock.countdown);

  if (W.phase === 'intro') {
    if (MASTER) {
      W.introT += DT;
      if (W.introT >= INTRO_TIME) { W.phase = 'countdown'; W.countdown = COUNTDOWN; onPhaseChange(); pushStatus(true); }
    }
    return;
  }
  if (W.phase === 'pit') {
    pitLocalStep();
    if (MASTER) pitStep();
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
    const ghosts = others.map(k => ({ ...(remoteRender(k.slot) || k), slot: k.slot })).filter(Boolean);
    collideWithRemote(mine, ghosts);
    if (W.phase === 'race') cardsStep(mine, now);
    if (MASTER && W.phase === 'race') masterCardsStep();
    for (const k of mine) {
      for (const e of k.events) {
        if (e === 'boost') vibrate(k.slot, [35]);
        else if (e === 'bump') vibrate(k.slot, [90]);
        else if (e === 'hit') vibrate(k.slot, [50]);
        else if (e === 'land') vibrate(k.slot, [25]);
        else if (e === 'trick') vibrate(k.slot, [20, 30, 20]);
        else if (e === 'spin') vibrate(k.slot, [250]);
        else if (e === 'boom') { vibrate(k.slot, [400]); toMaster({ t: 'feed', text: `BOOM! La bomba è esplosa a ${nameOf(k.slot)}` }); }
      }
      k.events.length = 0;
    }
    if (MASTER) {
      updatePlaces();
      if (W.phase === 'race') checkPit();
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
    shieldT: r2(k.shieldT), mirror: k.mirror, ghostT: r2(k.ghostT), miniT: r2(k.miniT), bombT: r2(k.bombT), fogT: r2(k.fogT), invertT: r2(k.invertT), stopT: r2(k.stopT),
  };
}
function worldMsg() {
  W.q++;
  return {
    portals: W.portals, hazards: W.hazards, missiles: W.missiles, feed: W.feed, pit: W.pit, pitsDone: W.pitsDone,
    t: 'w', q: W.q, raceId: W.raceId, phase: W.phase, laps: W.laps, raceTime: W.raceTime, countdown: W.countdown,
    introT: W.introT, paused: W.paused, pauseMsg: W.pauseMsg, captain: W.captain, grid: W.grid, results: W.results,
    players: W.players.map(p => ({ slot: p.slot, cid: p.cid, name: p.name, color: p.color, station: p.station, connected: p.connected, kbd: p.kbd, cpu: p.cpu })),
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
    if (mine.length) {
      const msg = { t: 'k', q: ++kSeq, raceId: currentRace, karts: mine.map(compact) };
      if (W.phase === 'pit') msg.mg = [...locals.values()].filter(l => l.slot >= 0 && l.mg).map(l => ({ slot: l.slot, s: l.mg }));
      send(masterConn, msg);
    }
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
    portals: W.portals.map(u => !(u > clock.raceTime)), hazards: W.hazards.filter(h => h.kind !== 'trap'), missiles: W.missiles,
    feed: W.feed.map(f => f.text), pit: W.phase === 'pit' ? pitView() : null,
  };
}

function playerList() {
  return W.players.map(p => ({ slot: p.slot, name: p.name, color: p.color, here: isLocalSlot(p.slot) && !p.cpu }));
}

// ------------------------------------------------------------------ carte
const hands = new Map();          // slot -> { cards: [], cd, pending, pendingT } (solo piloti di questo schermo)
const hitHazards = new Set();     // macchie d'olio già prese da un mio kart (in attesa che il PC le tolga)
let fxId = 0;

const nameOf = (slot) => (regBySlot(slot) || {}).name || 'Qualcuno';
const stationOf = (slot) => (regBySlot(slot) || {}).station;

// verso il PC principale (o direttamente, se sono io)
function toMaster(msg) {
  if (MASTER) onMasterCmd(msg, 'self');
  else send(masterConn, { t: 'c', msg });
}
// dal PC principale verso lo schermo che gestisce un certo pilota
function toStation(sid, msg) {
  if (sid === 'self') onStationCmd(msg);
  else { const st = stations.get(sid); if (st) send(st.conn, { t: 's', msg }); }
}

function handOf(slot) {
  let h = hands.get(slot);
  if (!h) { h = { cards: [], cd: 0, pending: null, pendingT: 0 }; hands.set(slot, h); }
  return h;
}
function handInfo(slot) {
  const h = hands.get(slot);
  if (!h) return { cards: [], cd: 0, pending: null };
  return { cards: h.cards, cd: Math.max(0, Math.round(h.cd * 10) / 10), pending: h.pending };
}

function addCard(slot, id) {
  if (!isLocalSlot(slot) || !CARDS[id]) return;
  const h = handOf(slot);
  if (h.cards.length < HAND_SIZE) h.cards.push(id);
  else if (h.pending) (h.queue = h.queue || []).push(id);
  else { h.pending = id; h.pendingT = 4; }  // mano piena: il telefono chiede cosa scartare
  vibrate(slot, [30, 40, 30]);
  pushStatus(true);
}

function nextPending(h) {
  if (h.queue && h.queue.length) { h.pending = h.queue.shift(); h.pendingT = 4; }
}

function discardFor(slot, i) {
  const h = hands.get(slot);
  if (!h || !h.pending || !(i >= 0 && i < h.cards.length)) return;
  h.cards[i] = h.pending; h.pending = null;
  nextPending(h);
  pushStatus(true);
}

function comboCards(slot, a, b) {
  const h = hands.get(slot);
  if (!h || a === b || !h.cards[a] || !h.cards[b]) return;
  const c = comboOf(h.cards[a], h.cards[b]);
  if (!c) return;
  h.cards = h.cards.filter((_, i) => i !== a && i !== b);
  h.cards.push(c);
  vibrate(slot, [20, 20, 60]);
  pushStatus(true);
}

function useCard(slot, i, to) {
  if (W.phase !== 'race' || W.paused) return;
  const h = hands.get(slot), k = karts.get(slot);
  if (!h || !k || k.finished || h.cd > 0) return;
  const id = h.cards[i];
  if (!id) return;
  const def = CARDS[id];
  if (def.target === 'pick' && (to == null || to === slot || !regBySlot(to))) return;
  h.cards.splice(i, 1);
  h.cd = COOLDOWN;
  vibrate(slot, [20]);
  applySelf(k, id);
  const msg = { t: 'play', from: slot, card: id, to };
  if (id === 'oil' || id === 'trap') {
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    msg.pos = { x: k.x - fx * 4, z: k.z - fz * 4 };
  }
  toMaster(msg);
  pushStatus(true);
}

function teleport(k, pos) {
  placeAt(track, k, pos.s, pos.lat);
  k.lapCount = pos.lapCount; k.prevS = k.s;
}

function pushFeed(text) {
  W.feed.push({ id: ++fxId, text, until: W.raceTime + 3.5 });
  if (W.feed.length > 3) W.feed.shift();
}

// ---- PC principale: decide portali, bersagli, missili, olio
function targetAhead(from) {
  const k = karts.get(from);
  if (!k) return null;
  const t = [...karts.values()].find(q => q.place === k.place - 1);
  return t ? t.slot : null;
}
function targetFirst(from) {
  const t = [...karts.values()].find(q => q.place === 1);
  return t && t.slot !== from ? t.slot : null;
}
function sendFx(to, from, kind, data = {}) {
  const sid = stationOf(to);
  if (sid) toStation(sid, { t: 'fx', to, from, kind, data });
}

function onMasterCmd(msg, sid) {
  if (!MASTER) return;
  // uno schermo può parlare solo per i suoi piloti
  const owns = (slot) => stationOf(slot) === sid;
  switch (msg.t) {
    case 'portal': {
      if (!owns(msg.slot) || W.phase !== 'race') return;
      const i = msg.pi;
      if (!(i >= 0 && i < W.portals.length) || W.portals[i] > W.raceTime) return;
      W.portals[i] = W.raceTime + PORTAL_COOLDOWN;
      toStation(sid, { t: 'card', slot: msg.slot, card: drawCard() });
      break;
    }
    case 'play': {
      if (!owns(msg.from) || !CARDS[msg.card]) return;
      const def = CARDS[msg.card], from = msg.from;
      let to = msg.to;
      if (def.target === 'ahead') to = targetAhead(from);
      if (def.target === 'first') to = targetFirst(from);
      pushFeed(`${nameOf(from)}: ${def.name.toUpperCase()}${to != null && def.target !== 'none' ? ' → ' + nameOf(to) : ''}`);
      switch (msg.card) {
        case 'missile': case 'missile1': {
          const k = karts.get(from);
          if (!k) return;
          W.missiles.push({ id: ++fxId, from, to, kind: msg.card, s: k.s + 3, lat: k.lat, life: to == null ? 2.5 : 12, x: k.x, z: k.z, yaw: k.yaw });
          break;
        }
        case 'oil': case 'trap':
          if (msg.pos) W.hazards.push({ id: ++fxId, kind: msg.card, x: msg.pos.x, z: msg.pos.z, owner: from, born: W.raceTime });
          break;
        case 'magnet': if (to != null) sendFx(to, from, 'slow'); break;
        case 'invert': case 'fog': case 'handbrake': case 'mini': case 'thief':
          if (to != null) sendFx(to, from, msg.card);
          break;
        case 'swap': {
          if (to == null) break;
          const a = karts.get(from);
          if (a) sendFx(to, from, 'swap', { s: a.s, lat: a.lat, lapCount: a.lapCount });
          break;
        }
      }
      break;
    }
    case 'result': {
      // un dispetto è stato bloccato o rimandato indietro
      if (!owns(msg.to)) return;
      if (msg.res === 'blocked') pushFeed(`${nameOf(msg.to)} si è protetto!`);
      if (msg.res === 'mirror') {
        pushFeed(`Specchio! ${nameOf(msg.to)} rimanda a ${nameOf(msg.from)}`);
        sendFx(msg.from, msg.to, msg.kind, msg.data || {});
      }
      break;
    }
    case 'swapback': if (owns(msg.from)) sendFx(msg.to, msg.from, 'swapto', msg.pos); break;
    case 'give': if (owns(msg.from)) { const st = stationOf(msg.to); if (st) toStation(st, { t: 'card', slot: msg.to, card: msg.card }); } break;
    case 'bomb': if (owns(msg.from)) sendFx(msg.to, msg.from, 'bomb', { left: msg.left }); break;
    case 'hazard-hit': W.hazards = W.hazards.filter(h => h.id !== msg.id); break;
    case 'feed': pushFeed(String(msg.text || '').slice(0, 80)); break;
  }
}

function masterCardsStep() {
  const L = track.length;
  for (const m of W.missiles) {
    m.life -= DT;
    m.s = (m.s + 52 * DT) % L;
    const t = m.to != null ? karts.get(m.to) : null;
    if (t) {
      m.lat += (t.lat - m.lat) * Math.min(1, DT * 3);
      const d = (t.s - m.s + L) % L;
      if (d < 2.5 || d > L - 4) { sendFx(m.to, m.from, m.kind); m.life = 0; }
    }
    const p = track.pts[Math.floor(m.s / track.ds) % track.count];
    m.x = p.x + p.rx * m.lat; m.z = p.z + p.rz * m.lat; m.yaw = Math.atan2(p.tx, p.tz);
  }
  W.missiles = W.missiles.filter(m => m.life > 0);
  W.hazards = W.hazards.filter(h => W.raceTime - h.born < 25);
  W.feed = W.feed.filter(f => f.until > W.raceTime);
}

// ---- ogni schermo: effetti sui propri kart
function onStationCmd(msg) {
  switch (msg.t) {
    case 'card': addCard(msg.slot, msg.card); break;
    case 'fx': {
      const k = karts.get(msg.to);
      if (!k || !isLocalSlot(msg.to)) return;
      if (msg.kind === 'swapto') { teleport(k, msg.data); vibrate(msg.to, [80, 40, 80]); return; }
      if (msg.kind === 'bomb') {
        const r = receive(k, 'bomb');
        if (r === 'ok') { k.bombT = Math.max(1, msg.data.left || 5); k.bombHold = 1; vibrate(msg.to, [60, 30, 60]); }
        else toMaster({ t: 'result', to: msg.to, from: msg.from, kind: 'bomb', res: r, data: msg.data });
        return;
      }
      if (msg.kind === 'swap') {
        const r = receive(k, 'swap');
        if (r !== 'ok') { toMaster({ t: 'result', to: msg.to, from: msg.from, kind: 'swap', res: r === 'mirror' ? 'blocked' : r }); return; }
        const mine = { s: k.s, lat: k.lat, lapCount: k.lapCount };
        teleport(k, msg.data);
        vibrate(msg.to, [80, 40, 80]);
        toMaster({ t: 'swapback', from: msg.to, to: msg.from, pos: mine });
        return;
      }
      const r = receive(k, msg.kind);
      if (r !== 'ok') { toMaster({ t: 'result', to: msg.to, from: msg.from, kind: msg.kind, res: r, data: msg.data }); return; }
      vibrate(msg.to, [150]);
      if (msg.kind === 'thief' || msg.kind === 'missile1') {
        const h = hands.get(msg.to);
        if (h && h.cards.length) {
          const [card] = h.cards.splice(Math.floor(Math.random() * h.cards.length), 1);
          if (msg.kind === 'thief') toMaster({ t: 'give', from: msg.to, to: msg.from, card });
          pushStatus(true);
        }
      }
      break;
    }
  }
}

function cardsStep(mine, now) {
  const L = track.length;
  for (const k of mine) {
    const h = handOf(k.slot);
    if (h.cd > 0) h.cd = Math.max(0, h.cd - DT);
    if (h.pending) { h.pendingT -= DT; if (h.pendingT <= 0) { h.pending = null; nextPending(h); pushStatus(true); } }
    // portali: passo sopra → chiedo una carta (decide il PC principale chi è arrivato prima)
    if (k.lapCount >= 1 && !k.finished) {
      PORTAL_FRACTIONS.forEach((f, pi) => {
        const ps = f * L;
        const crossed = k.prevS < ps && k.s >= ps && k.s - k.prevS < 20;
        if (crossed && Math.abs(k.lat) < track.halfWidth + 1 && !(W.portals[pi] > now)) toMaster({ t: 'portal', slot: k.slot, pi });
      });
    }
    // olio e trappole a terra
    for (const hz of W.hazards) {
      if (hitHazards.has(hz.id)) continue;
      if (hz.owner === k.slot && now - hz.born < 1.2) continue;
      if (Math.hypot(k.x - hz.x, k.z - hz.z) > 2.4 || k.air) continue;
      hitHazards.add(hz.id);
      const r = receive(k, hz.kind);
      if (r === 'mirror') k.mirror = 0;
      if (r === 'ok') vibrate(k.slot, [150]);
      toMaster({ t: 'hazard-hit', id: hz.id });
    }
    // bomba: si passa toccando un altro kart
    if (k.bombHold > 0) k.bombHold -= DT;
    if (k.bombT > 0 && !(k.bombHold > 0) && k.contacts.length) {
      const other = k.contacts[0];
      const ok = karts.get(other);
      if (ok && isLocalSlot(other)) {
        if (receive(ok, 'bomb') === 'ok') { ok.bombT = k.bombT; ok.bombHold = 1; k.bombT = 0; vibrate(other, [60, 30, 60]); }
      } else {
        toMaster({ t: 'bomb', from: k.slot, to: other, left: k.bombT });
        k.bombT = 0;
      }
      toMaster({ t: 'feed', text: `${nameOf(k.slot)} passa la bomba a ${nameOf(other)}!` });
    }
  }
  if (!MASTER) W.feed = W.feed.filter(f => f.until > now);
}

// ------------------------------------------------------------------ interfaccia
let seenPhase = 'lobby';
function onPhaseChange() {
  if (seenPhase === 'pit' && W.phase !== 'pit') pitEnded();
  seenPhase = W.phase;
  $('pit').classList.toggle('hidden', W.phase !== 'pit');
  $('lobby').classList.toggle('hidden', W.phase !== 'lobby');
  $('podium').classList.toggle('hidden', W.phase !== 'podium');
  if (W.phase === 'podium') drawPodium();
  if (W.phase === 'lobby') { karts.clear(); remoteBuf.clear(); currentRace = 0; drawLobby(); }
}

let lobbySig = '';
let cpuLevel = CPU_LEVELS[store.get('cpu-level', 'normale')] ? store.get('cpu-level', 'normale') : 'normale';
function drawLobby() {
  const sig = JSON.stringify([W.players, W.laps, W.captain, stations.size, [...locals.keys()], cpuLevel, W.mgShort, W.quizCats]);
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
      stEl.textContent = !p.connected ? 'Disconnesso' : p.cpu ? `Computer · ${CPU_LEVELS[cpuLevel].label}` : p.kbd ? 'Tastiera: frecce + spazio' : here ? 'Pronto' : 'Pronto · a distanza';
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
  $('cpu-box').classList.toggle('hidden', !MASTER);
  $('mg-settings').classList.toggle('hidden', !MASTER);
  drawMgSettings();
  $('cpu-add').disabled = W.players.length >= MAX_PLAYERS;
  $('cpu-add').textContent = W.players.length >= MAX_PLAYERS ? 'Stanza piena' : '+ Aggiungi computer';
  const lv = $('cpu-level');
  lv.innerHTML = '';
  for (const [id, L] of Object.entries(CPU_LEVELS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = L.label; b.className = cpuLevel === id ? 'on' : '';
    b.onclick = () => { cpuLevel = id; store.set('cpu-level', id); lobbySig = ''; drawLobby(); };
    lv.appendChild(b);
  }
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
// impostazioni dei minigiochi e domande Mancave (solo PC principale, salvate qui)
function drawMgSettings() {
  const len = $('mg-len');
  len.innerHTML = '';
  for (const [v, t] of [[false, '1 minuto'], [true, '30 secondi']]) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t; b.className = W.mgShort === v ? 'on' : '';
    b.onclick = () => { W.mgShort = v; store.set('mg-short', v); lobbySig = ''; drawLobby(); };
    len.appendChild(b);
  }
  const cats = $('quiz-cats');
  cats.innerHTML = '';
  const short = { 'Cultura': 'Cultura', 'Calcio': 'Calcio', 'Videogiochi e film': 'Giochi e film', 'Mancave': 'Mancave' };
  for (const c of QUIZ_CATS) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = short[c]; b.className = W.quizCats.includes(c) ? 'on' : '';
    b.setAttribute('aria-pressed', W.quizCats.includes(c));
    b.onclick = () => {
      const on = W.quizCats.includes(c);
      if (on && W.quizCats.length === 1) return;          // almeno una categoria
      W.quizCats = on ? W.quizCats.filter(x => x !== c) : [...W.quizCats, c];
      store.set('quiz-cats', W.quizCats); lobbySig = ''; drawLobby();
    };
    cats.appendChild(b);
  }
  $('mq-open').textContent = `Modifica (${store.get('mancave-q', []).length})`;
}
function drawMq() {
  const list = store.get('mancave-q', []);
  const el = $('mq-list');
  el.innerHTML = list.length ? '' : '<p class="mq-empty">Ancora nessuna domanda: aggiungi la prima qui sopra.</p>';
  list.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'mq-item';
    d.innerHTML = '<div><b></b><small><i></i> · <span></span></small></div><button type="button" aria-label="Togli la domanda">×</button>';
    d.querySelector('b').textContent = q.q;
    d.querySelector('i').textContent = q.a[0];
    d.querySelector('span').textContent = q.a.slice(1).join(' · ');
    d.querySelector('button').onclick = () => { const l = store.get('mancave-q', []); l.splice(i, 1); store.set('mancave-q', l); drawMq(); lobbySig = ''; drawLobby(); };
    el.appendChild(d);
  });
}
$('mq-open').onclick = () => { $('mq').classList.remove('hidden'); drawMq(); $('mq-q').focus(); };
$('mq-close').onclick = () => $('mq').classList.add('hidden');
$('mq-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('mq-q').value.trim();
  const a = [0, 1, 2, 3].map(i => $('mq-a' + i).value.trim());
  if (!q || a.some(x => !x)) return;
  const l = store.get('mancave-q', []);
  l.push({ q: q.slice(0, 120), a: a.map(x => x.slice(0, 40)) });
  store.set('mancave-q', l);
  for (const id of ['mq-q', 'mq-a0', 'mq-a1', 'mq-a2', 'mq-a3']) $(id).value = '';
  if (!W.quizCats.includes('Mancave')) { W.quizCats = [...W.quizCats, 'Mancave']; store.set('quiz-cats', W.quizCats); }
  drawMq(); lobbySig = ''; drawLobby();
  $('mq-q').focus();
});

$('cpu-add').onclick = () => {
  if (!MASTER || W.players.length >= MAX_PLAYERS) return;
  if (W.phase !== 'lobby' && W.phase !== 'podium') return;
  const taken = new Set(W.players.map(p => p.name));
  const pick = CPU_NAMES.find(c => !taken.has(c.name)) || CPU_NAMES[0];
  let n = 0; while (locals.has('cpu-' + n)) n++;
  const cid = 'cpu-' + n;
  const nl = { cid, name: pick.name, color: pick.color, conn: null, connected: true, slot: -1, cpu: true,
    input: { steer: 0, drift: false, brake: false, trick: false }, seq: -1, brain: newBrain(cpuLevel) };
  locals.set(cid, nl);
  requestJoin(nl);
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
  if (W.phase === 'pit' && now - (frame.pitAt || 0) > 100) { frame.pitAt = now; try { drawPit($('pit'), pitView(), W.players); } catch (e) { console.error(e); } }
  try { bc.postMessage({ t: 'snap', snap, players }); } catch (e) { /* niente */ }
}

// ------------------------------------------------------------------ pit stop e minigiochi
const mgStates = new Map();       // (PC principale) slot -> stato del minigioco riportato
const botMg = new Map();          // slot -> cervello del minigioco (computer e tastiera di questo schermo)
const appliedPrizes = new Set();  // premi già consegnati (id pit : slot)
const isBot = (l) => !!(l.brain || l.cid.startsWith('kbd'));

function checkPit() {
  const laps = pitLaps(W.laps);
  if (W.pitsDone >= laps.length) return;
  const at = (laps[W.pitsDone] - 1 + PIT_FRACTION) * track.length;
  let lead = -Infinity;
  for (const k of karts.values()) if (!k.finished) lead = Math.max(lead, raceDistance(track, k));
  if (lead >= at) startPit();
}

function startPit() {
  const forced = params.get('mg');
  const pool = GAME_IDS.filter(g => !W.pitUsed.includes(g));
  const game = forced && GAMES[forced] ? forced : pool[Math.floor(Math.random() * pool.length)];
  W.pitUsed.push(game);
  W.pitsDone++;
  const short = !!W.mgShort;
  const seed = Math.floor(Math.random() * 1e9);
  W.pit = {
    id: (Date.now() % 1e9) + W.pitsDone, n: W.pitsDone, of: pitLaps(W.laps).length, game, seed, short,
    stage: 'intro', stageT: 0, t: 0, dur: gameDuration(game, short), rounds: gameRounds(game, short),
    round: -1, roundT: 0, rt: 0, reveal: null, revealT: 0, pts: {}, live: [], results: null, tie: null, tieLive: null,
  };
  quizSecret = [];
  if (game === 'quiz') {
    const qs = buildQuiz(seed, W.pit.rounds, W.quizCats, store.get('mancave-q', []));
    quizSecret = qs.map(q => q.correct);
    W.pit.qs = qs.map(({ q, cat, answers }) => ({ q, cat, answers }));
  }
  if (game === 'semaforo') W.pit.duel = duelStart(W.players.map(p => p.slot), seed, short);
  mgStates.clear();
  W.phase = 'pit';
  onPhaseChange(); pushStatus(true);
}
let quizSecret = [];               // (PC principale) risposte giuste del quiz, svelate manche per manche

// tempo del pit stop visto da questo schermo (sugli schermi collegati stimo il tempo passato)
function pitView() {
  const P = W.pit;
  if (!P) return null;
  const el = MASTER || W.paused ? 0 : Math.min(0.5, (performance.now() - worldAt) / 1000);
  return {
    ...P, stageT: P.stageT + el, t: P.stage === 'play' ? P.t + el : P.t,
    roundT: P.reveal == null ? P.roundT + el : P.roundT, revealT: (P.revealT || 0) + (P.reveal != null ? el : 0),
  };
}

function pitInfo(slot) {
  if (W.phase !== 'pit' || !W.pit) return null;
  const P = pitView();
  const me = P.results ? P.results.find(r => r.slot === slot) || null : null;
  return {
    id: P.id, n: P.n, of: P.of, game: P.game, seed: P.seed, short: P.short, stage: P.stage, stageT: r2(P.stageT), t: r2(P.t), dur: P.dur,
    rounds: P.rounds, round: P.round, roundT: r2(P.roundT), reveal: P.reveal, pts: P.pts[slot] || 0, me, places: P.results ? P.results.length : 0,
    q: P.qs && P.round >= 0 ? P.qs[P.round] : null, duel: P.duel || null, tie: P.tie,
  };
}

// su ogni schermo: computer e tastiera giocano da soli, i premi arrivano a chi è collegato qui
function pitLocalStep() {
  const P = W.pit;
  if (!P) return;
  const pv = pitView();
  if (MASTER && P.game === 'quiz') pv.qc = quizSecret[P.round];
  for (const l of locals.values()) {
    if (l.slot < 0 || !isBot(l)) continue;
    let b = botMg.get(l.slot);
    if (!b || b.id !== P.id) { b = cpuMgNew(l.brain ? cpuLevel : 'normale', P.seed + l.slot * 7919); b.id = P.id; botMg.set(l.slot, b); }
    if (P.stage !== 'play' && P.stage !== 'tie') continue;
    l.mg = { ...cpuMgTick(b, P.game, DT, pv, l.slot), id: P.id };
  }
  if (P.results && (P.stage === 'results' || P.stage === 'go')) {
    for (const r of P.results) {
      if (!isLocalSlot(r.slot)) continue;
      const key = P.id + ':' + r.slot;
      if (appliedPrizes.has(key)) continue;
      appliedPrizes.add(key);
      applyPrize(r.slot, r.prize);
    }
  }
}

function pitStep() {
  const P = W.pit;
  if (!P) return;
  P.stageT += DT;
  for (const l of locals.values()) if (l.slot >= 0 && l.mg && l.mg.id === P.id) mgStates.set(l.slot, l.mg);
  const g = GAMES[P.game];
  const st = (slot) => mgStates.get(slot) || {};
  if (P.stage === 'intro') {
    if (P.stageT >= PIT_INTRO) {
      P.stage = 'play'; P.stageT = 0; P.t = 0;
      if (g.rounds || g.duel) { P.round = 0; P.roundT = 0; P.rt = g.duel ? semRoundTime(P.seed, 0) : g.roundTime; }
      if (g.duel && P.duel.over) endPlay();
      pushStatus(true);
    }
  } else if (P.stage === 'play') {
    P.t += DT;
    if (g.rounds || g.duel) {
      if (P.reveal == null) {
        P.roundT += DT;
        const who = g.duel ? W.players.filter(p => duelPairOf(P.duel, p.slot)) : W.players;
        const all = who.length && who.every(p => { const a = st(p.slot).ans; return a && a[P.round] != null; });
        if (P.roundT >= P.rt || (all && P.roundT > (g.duel ? 0.3 : 1))) resolveRound();
      } else {
        P.revealT += DT;
        if (P.revealT >= g.revealTime) {
          P.reveal = null; P.round++; P.roundT = 0;
          P.rt = g.duel ? semRoundTime(P.seed, P.round) : g.roundTime;
          if (g.duel ? P.duel.over : P.round >= P.rounds) { P.round--; endPlay(); }
          pushStatus(true);
        }
      }
    } else {
      const allDone = W.players.length && W.players.every(p => st(p.slot).done);
      if (P.t >= P.dur || allDone) endPlay();
    }
    let maxPts = 0;
    for (const p of W.players) {
      const s = st(p.slot);
      maxPts = Math.max(maxPts, P.game === 'piumeno' ? s.best || 0 : ['barra', 'patatine'].includes(P.game) ? s.score || 0 : P.pts[p.slot] || 0);
    }
    P.live = W.players.map(p => ({
      slot: p.slot, label: liveLabel(P.game, st(p.slot), P, p.slot), bar: liveBar(P.game, st(p.slot), P, p.slot, maxPts),
      out: !!st(p.slot).out, done: !!st(p.slot).done,
    }));
  } else if (P.stage === 'tie') {
    P.tieLive = {};
    for (const slot of P.tie.slots) P.tieLive[slot] = st(slot).tie || 0;
    if (P.stageT >= TIE_INTRO + TIE_TAP + 0.6) finishRanking(applyTie(P.preRank, P.tieLive, P.seed));
  } else if (P.stage === 'results') {
    if (P.stageT >= PIT_RESULTS) { P.stage = 'go'; P.stageT = 0; pushStatus(true); }
  } else if (P.stage === 'go') {
    if (P.stageT >= PIT_GO) { W.phase = 'race'; P.stage = 'done'; onPhaseChange(); pushStatus(true); }
  }
}

function resolveRound() {
  const P = W.pit, g = GAMES[P.game];
  const picks = {};
  for (const p of W.players) {
    const a = (mgStates.get(p.slot) || {}).ans;
    const v = a ? Number(a[P.round]) : NaN;
    if (P.game === 'semaforo') { if (Number.isFinite(v) && v >= 0) picks[p.slot] = Math.round(v); }
    else if (Number.isInteger(v) && v >= 0 && v < (P.game === 'porta' ? 3 : 4)) picks[p.slot] = v;
  }
  if (P.game === 'semaforo') {
    P.reveal = { res: duelRound(P.duel, picks) };
  } else if (P.game === 'porta') {
    const cnt = [0, 0, 0];
    for (const v of Object.values(picks)) cnt[v]++;
    for (const [slot, v] of Object.entries(picks)) if (cnt[v] === 1) P.pts[slot] = (P.pts[slot] || 0) + 1;
    P.reveal = { picks, lone: cnt.map(c => c === 1) };
  } else {
    const correct = quizSecret[P.round];
    for (const [slot, v] of Object.entries(picks)) {
      const at = Number(((mgStates.get(Number(slot)) || {}).at || {})[P.round]);
      const ms = Number.isFinite(at) ? at : g.roundTime * 1000;
      if (v === correct) P.pts[slot] = (P.pts[slot] || 0) + 10 + Math.max(0, Math.round(5 * (1 - ms / (g.roundTime * 1000))));
      else P.pts[slot] = (P.pts[slot] || 0) - 5;
    }
    P.reveal = { picks, correct };
  }
  P.revealT = 0;
  pushStatus(true);
}

// fine del gioco: se qualcuno è a pari merito si fa lo spareggio a tap
function endPlay() {
  const P = W.pit;
  const ranking = rankGame(P.game, W.players.map(p => ({ slot: p.slot, s: mgStates.get(p.slot) })), P);
  const groups = tieGroups(ranking);
  if (groups.length) {
    P.preRank = ranking;
    P.tie = { slots: groups.flat(), groups };
    P.tieLive = {};
    P.stage = 'tie'; P.stageT = 0;
    pushStatus(true);
    return;
  }
  finishRanking(ranking);
}
function finishRanking(ranking) {
  const P = W.pit;
  P.results = ranking.map(r => ({ ...r, prize: prizeFor(r.place, ranking.length) }));
  P.stage = 'results'; P.stageT = 0;
  pushStatus(true);
}

const RAR_ORDER = { combo: 0, rara: 0, media: 1, comune: 2 };
function applyPrize(slot, pr) {
  if (!pr || !pr.draw) return;
  const cards = Array.from({ length: pr.draw }, () => drawCard(Math.random, pr.rare ? 3 : 1));
  const l = localBySlot(slot);
  if (pr.keep < pr.draw && l && !isBot(l)) {
    handOf(slot).offer = { cards, keep: pr.keep };
    vibrate(slot, [40, 40, 40]);
    pushStatus(true);
    return;
  }
  cards.sort((a, b) => RAR_ORDER[CARDS[a].rar] - RAR_ORDER[CARDS[b].rar]).slice(0, pr.keep).forEach(c => addCard(slot, c));
}

function pickOffer(slot, pick) {
  const h = hands.get(slot);
  if (!h || !h.offer) return;
  const o = h.offer;
  h.offer = null;
  const idx = Array.isArray(pick) ? [...new Set(pick.map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < o.cards.length).slice(0, o.keep) : [];
  for (let i = 0; idx.length < o.keep && i < o.cards.length; i++) if (!idx.includes(i)) idx.push(i);
  idx.forEach(i => addCard(slot, o.cards[i]));
  pushStatus(true);
}
function offerInfo(slot) {
  const h = hands.get(slot);
  return h && h.offer ? { cards: h.offer.cards, keep: h.offer.keep } : null;
}

// fine del pit stop: si riparte (turbo al primo, attesa all'ultimo)
function pitEnded() {
  for (const [slot, h] of hands) if (h.offer && isLocalSlot(slot)) pickOffer(slot, []);
  const P = W.pit;
  if (P && P.results && W.phase === 'race') {
    for (const r of P.results) {
      const k = karts.get(r.slot);
      if (!k || !isLocalSlot(r.slot)) continue;
      if (r.prize.boost) giveBoost(k, r.prize.boost, 'orange');
      if (r.prize.wait) k.stopT = Math.max(k.stopT || 0, r.prize.wait);
    }
  }
  for (const l of locals.values()) l.mg = null;
}

// solo per i test (pc.html?debug=1)
if (params.get('debug') === '1') window.__mck = { W, karts, hands, locals, addCard, useCard, track, mgStates, startPit };

drawLobby();
startNet();
requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => { if (peer) peer.destroy(); });

// Telefono = volante. Manda sterzo e tasti allo schermo, riceve posizione, giri e vibrazioni.
import { iceServers, PEER_PREFIX } from './net.js';
import { CARDS, comboOf, HAND_SIZE } from './cards.js';
import { createMgPhone } from './mg-phone.js';
const $ = (id) => document.getElementById(id);
const COLORS = ['#e8322b', '#ff8a00', '#ffcc00', '#2ec46b', '#1fb5c9', '#2f7bff', '#9b5cff', '#ff4fa3'];

const store = {
  get(k, d) { try { const v = localStorage.getItem('mck-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mck-' + k, JSON.stringify(v)); } catch (e) { /* niente */ } },
};

let cid = store.get('cid', null);
if (!cid) { cid = Math.random().toString(36).slice(2, 10); store.set('cid', cid); }

const params = new URLSearchParams(location.search);
const st = {
  code: (params.get('r') || store.get('code', '')).toUpperCase(),
  station: (params.get('s') || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  name: store.get('name', ''),
  color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]),
  mode: store.get('mode', 'tilt'),
  sens: store.get('sens', 28),
  invert: store.get('invert', false),
  offset: 0,
  phase: 'join', status: null,
};

// ------------------------------------------------------------------ schermate
function show(id) {
  for (const s of ['join', 'wait', 'pad', 'mg', 'end']) $(s).classList.toggle('hidden', s !== id);
  st.view = id;
  checkRotate();
}
// durante la gara il telefono resta "in orizzontale": se lo giri, lo schermo resta disegnato di traverso
function checkRotate() {
  const portrait = window.innerHeight > window.innerWidth;
  const playing = st.view === 'pad' || st.view === 'mg';
  document.documentElement.classList.toggle('rot', playing && portrait);
  $('rotate').classList.add('hidden');
  if (playing) lockLandscape();
}
function lockLandscape() {
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* niente */ }
}
window.addEventListener('resize', checkRotate);
window.addEventListener('orientationchange', () => setTimeout(checkRotate, 200));

// ------------------------------------------------------------------ entrata
if (params.get('r')) $('code-field').classList.add('hidden');
$('code').value = st.code;
$('name').value = st.name;
function drawSwatches() {
  const el = $('swatches');
  el.innerHTML = '';
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = c; b.className = st.color === c ? 'on' : '';
    b.setAttribute('aria-label', 'Colore ' + c);
    b.onclick = () => { st.color = c; store.set('color', c); drawSwatches(); };
    el.appendChild(b);
  }
}
drawSwatches();
function drawMode() {
  for (const seg of [$('mode'), $('mode2')]) for (const b of seg.children) b.classList.toggle('on', b.dataset.m === st.mode);
  $('left-tilt').classList.toggle('hidden', st.mode !== 'tilt');
  $('left-touch').classList.toggle('hidden', st.mode !== 'touch');
  $('b-brake-r').classList.toggle('hidden', st.mode !== 'touch');
  $('steer-hint').textContent = st.mode === 'tilt' ? 'Inclina il telefono per sterzare' : 'Usa le frecce per sterzare';
  if ($('cal')) $('cal').classList.toggle('hidden', st.mode !== 'tilt');
}
for (const seg of [$('mode'), $('mode2')]) for (const b of seg.children) b.onclick = () => { st.mode = b.dataset.m; store.set('mode', st.mode); drawMode(); if (st.mode === 'tilt') askMotion(); };
drawMode();

$('join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  st.code = $('code').value.trim().toUpperCase();
  st.name = $('name').value.trim();
  if (!/^[A-Z0-9]{2,12}$/.test(st.code)) { $('join-err').textContent = 'Scrivi il nome della stanza che vedi sullo schermo.'; return; }
  if (!st.name) { $('join-err').textContent = 'Scrivi il tuo nome.'; return; }
  store.set('name', st.name); store.set('code', st.code);
  $('join-err').textContent = '';
  st.left = false;
  if (st.mode === 'tilt') await askMotion();
  goFull();
  wakeLock();
  connect();
});

// ------------------------------------------------------------------ sensori
let motionOK = false;
let gx = 0, gy = 0, steerTilt = 0, lastShake = 0, motionSeen = 0;
async function askMotion() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== 'granted') { $('join-err').textContent = 'Senza il permesso del movimento usa la modalità Tasti.'; st.mode = 'touch'; drawMode(); return; }
    }
    if (!motionOK) { window.addEventListener('devicemotion', onMotion); motionOK = true; }
  } catch (e) {
    st.mode = 'touch'; drawMode();
  }
}
function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  motionSeen = performance.now();
  // filtro passa-basso
  gx += (a.x - gx) * 0.35; gy += (a.y - gy) * 0.35;
  // angolo del "volante" attorno all'asse dello schermo, indipendente da iOS/Android
  if (Math.abs(gx) > 3 || !st.sgn) st.sgn = gx >= 0 ? 1 : -1;
  const sgn = st.sgn;
  let ang = Math.atan2(sgn * gy, Math.abs(gx)) * 180 / Math.PI;
  ang -= st.offset;
  st.rawAngle = ang + st.offset;
  if (st.invert) ang = -ang;
  const dead = 2.5;
  const v = Math.abs(ang) < dead ? 0 : (Math.abs(ang) - dead) * Math.sign(ang) / (st.sens - dead);
  steerTilt = Math.max(-1, Math.min(1, v));
  // scossa = acrobazia sul salto
  const lin = e.acceleration;
  const mag = lin && lin.x != null ? Math.hypot(lin.x, lin.y, lin.z) : 0;
  if (mg.active()) { mg.shake(mag); return; }
  if (mag > 13 && performance.now() - lastShake > 400) { lastShake = performance.now(); trickPending = true; }
}

// ------------------------------------------------------------------ tasti
let drift = false, brake = false, left = false, right = false, trickPending = false;
function hold(el, on, off) {
  const down = (e) => { e.preventDefault(); try { el.setPointerCapture?.(e.pointerId); } catch (err) { /* niente */ } el.classList.add('down'); on(); };
  const up = (e) => { e.preventDefault(); el.classList.remove('down'); off(); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
hold($('b-drift'), () => { drift = true; send(); }, () => { drift = false; send(); });
hold($('b-brake-l'), () => { brake = true; send(); }, () => { brake = false; send(); });
hold($('b-brake-r'), () => { brake = true; send(); }, () => { brake = false; send(); });
hold($('b-left'), () => { left = true; }, () => { left = false; });
hold($('b-right'), () => { right = true; }, () => { right = false; });

// sicurezza: se non c'è più nessun dito sullo schermo, nessun tasto resta premuto
document.addEventListener('touchend', (e) => {
  if (e.touches.length) return;
  if (drift || brake || left || right) { drift = brake = left = right = false; document.querySelectorAll('.pbtn.down').forEach(b => b.classList.remove('down')); send(); }
}, { passive: true });

let steerTouch = 0;
function currentSteer(dt) {
  if (st.mode === 'tilt') return steerTilt;
  const target = (right ? 1 : 0) - (left ? 1 : 0);
  const k = Math.min(1, dt * 9);
  steerTouch += (target - steerTouch) * k;
  if (Math.abs(steerTouch) < 0.02 && !target) steerTouch = 0;
  return steerTouch;
}

// ------------------------------------------------------------------ rete
let peer = null, conn = null, connected = false, retryT = 0;
async function connect() {
  $('enter').disabled = true;
  $('join-err').textContent = 'Mi collego…';
  if (typeof Peer === 'undefined') { $('join-err').textContent = 'Non riesco a caricare il gioco: controlla internet e ricarica.'; $('enter').disabled = false; return; }
  if (!peer || peer.destroyed) {
    const ice = await iceServers();
    if (peer && !peer.destroyed) { openConn(); return; }
    peer = new Peer(undefined, { debug: 1, config: { iceServers: ice } });
    peer.on('open', openConn);
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') {
        if (!connected && st.view === 'join') { $('join-err').textContent = 'Stanza non trovata: controlla il codice sullo schermo.'; $('enter').disabled = false; }
        else scheduleRetry();
      } else if (['network', 'server-error', 'socket-error', 'disconnected'].includes(e.type)) scheduleRetry();
    });
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => peer.reconnect(), 1000); });
  } else openConn();
}
function openConn() {
  if (peer.disconnected) { if (!peer.destroyed) peer.reconnect(); return; }
  if (conn) { try { conn.close(); } catch (e) { /* niente */ } }
  conn = peer.connect(PEER_PREFIX + st.code + (st.station ? '-' + st.station : ''), { reliable: false, serialization: 'json' });
  if (!conn) { scheduleRetry(); return; }
  clearTimeout(st.giveUp);
  st.giveUp = setTimeout(() => {
    if (connected) return;
    const txt = 'Non riesco a collegarmi allo schermo. Se non sei sulla stessa rete Wi-Fi del PC, serve il server ponte: chiedi a chi ha aperto la gara.';
    if (st.view === 'join') { $('join-err').textContent = txt; $('enter').disabled = false; }
    else $('conn-msg').textContent = txt;
  }, 12000);
  conn.on('open', () => {
    clearTimeout(st.giveUp);
    connected = true;
    conn.send({ t: 'hello', cid, name: st.name, color: st.color, remote: params.get('remote') === '1' });
    $('conn').classList.add('hidden');
  });
  conn.on('data', onData);
  conn.on('close', () => { connected = false; if (st.view !== 'join') scheduleRetry(); });
  conn.on('error', () => { connected = false; scheduleRetry(); });
}
function scheduleRetry() {
  if (st.left) return;
  if (st.view !== 'join') $('conn').classList.remove('hidden');
  clearTimeout(retryT);
  retryT = setTimeout(() => { if (!connected) connect(); }, 2000);
}

function onData(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'welcome':
      $('enter').disabled = false; $('join-err').textContent = '';
      if (st.view === 'join') show('wait');
      break;
    case 'full': $('join-err').textContent = 'La stanza è piena (massimo 4 piloti).'; $('enter').disabled = false; st.left = true; break;
    case 'busy': $('join-err').textContent = 'C\'è una gara in corso: aspetta la fine e riprova.'; $('enter').disabled = false; st.left = true; break;
    case 'kicked': st.left = true; try { conn.close(); } catch (e) { /* niente */ } show('join'); $('join-err').textContent = 'Sei stato tolto dalla stanza.'; break;
    case 'vib': if (navigator.vibrate) navigator.vibrate(msg.p); break;
    case 'st': onStatus(msg); break;
  }
}

let lastStatusAt = 0;
function onStatus(s) {
  st.status = s;
  lastStatusAt = performance.now();
  const racing = ['intro', 'countdown', 'race', 'pit', 'finish'].includes(s.phase);
  if (s.phase === 'lobby' && st.view !== 'wait') show('wait');
  const lampoOn = !!(s.lampo && !s.lampo.done && s.phase === 'race');
  if (racing && s.phase !== 'pit' && !lampoOn && st.view !== 'pad') show('pad');
  if ((s.phase === 'pit' || lampoOn) && st.view !== 'mg') { closePick(); show('mg'); }
  mg.update(s);
  if (s.phase === 'podium' && st.view !== 'end') show('end');

  // attesa
  $('wait-kart').style.background = st.color;
  $('wait-title').textContent = `Sei dentro, ${st.name}!`;
  $('captain').classList.toggle('hidden', !s.captain);
  $('wait-text').textContent = s.captain ? 'Sei il capo stanza: quando ci siete tutti, avvia la gara.' : 'Aspetta che il capo stanza faccia partire la gara.';
  const lapsEl = $('laps');
  if (lapsEl.dataset.v !== String(s.laps)) {
    lapsEl.dataset.v = String(s.laps);
    lapsEl.innerHTML = '';
    for (const n of [1, 3, 5]) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = `${n} ${n === 1 ? 'giro' : 'giri'}`; b.className = s.laps === n ? 'on' : '';
      b.onclick = () => conn && conn.send({ t: 'laps', n });
      lapsEl.appendChild(b);
    }
  }
  // volante
  $('p-place').textContent = s.place ? s.place + '°' : '–';
  $('p-lap').textContent = s.lap ? `Giro ${s.lap}/${s.laps}` : '';
  let msg = '';
  if (s.phase === 'intro') msg = 'Si parte! Premi DERAPA per saltare il giro di pista';
  else if (s.phase === 'countdown') msg = 'Premi DERAPA appena prima del VIA per il turbo!';
  else if (s.cop) msg = 'Documenti, prego!';
  else if (s.finished) msg = 'Traguardo!';
  else if (s.air) msg = 'Scuoti il telefono!';
  $('p-msg').textContent = msg;
  drawHand(s);
  drawCall(s);
  $('paused').classList.toggle('hidden', !(s.paused && racing));
  $('paused-msg').textContent = s.pauseMsg || '';
  // fine
  if (s.phase === 'podium' && s.results) {
    const me = s.results.find(r => r.slot === s.slot);
    $('end-place').textContent = me ? me.place + '°' : '–';
    $('end-text').textContent = me && me.place === 1 ? 'Hai vinto!' : me && me.time == null ? 'Non sei arrivato in tempo' : 'Bella gara!';
    $('end-captain').classList.toggle('hidden', !s.captain);
    $('end-wait').classList.toggle('hidden', !!s.captain);
  }
}

$('start').onclick = () => conn && conn.send({ t: 'start' });
$('again').onclick = () => conn && conn.send({ t: 'again' });
$('tolobby').onclick = () => conn && conn.send({ t: 'lobby' });
function leaveRoom() {
  st.left = true;
  closePick();
  if (conn) { try { conn.send({ t: 'leave' }); } catch (e) { /* niente */ } const c = conn; setTimeout(() => { try { c.close(); } catch (e) { /* niente */ } }, 200); }
  connected = false;
  $('settings').classList.add('hidden'); $('conn').classList.add('hidden'); $('paused').classList.add('hidden');
  show('join'); drawQuick();
  $('enter').disabled = false;
}
$('leave').onclick = leaveRoom;
$('set-leave').onclick = leaveRoom;
$('mg-set').onclick = () => { $('settings').classList.remove('hidden'); };
// rientro veloce: stanza e nome ricordati
function drawQuick() {
  const ok = st.name && /^[A-Z0-9]{2,12}$/.test(st.code);
  $('quick').classList.toggle('hidden', !ok);
  $('join-form').classList.toggle('hidden', !!ok);
  if (ok) $('quick-go').textContent = `RIENTRA IN ${st.code} come ${st.name}`;
}
$('quick-go').onclick = () => { $('quick').classList.add('hidden'); $('join-form').classList.remove('hidden'); $('join-form').requestSubmit(); };
$('quick-change').onclick = () => { $('quick').classList.add('hidden'); $('join-form').classList.remove('hidden'); $('code-field').classList.remove('hidden'); };
drawQuick();
// prova dello sterzo nella sala d'attesa
$('cal-sens').value = st.sens; $('cal-sens-v').textContent = st.sens + '°';
$('cal-sens').oninput = () => { st.sens = Number($('cal-sens').value); store.set('sens', st.sens); $('cal-sens-v').textContent = st.sens + '°'; $('sens').value = st.sens; $('sens-v').textContent = st.sens + '°'; };
$('cal-center').onclick = () => { st.offset = st.rawAngle || 0; if (navigator.vibrate) navigator.vibrate(30); };
$('rot-ok').onclick = () => { st.ignoreRotate = true; checkRotate(); };
$('b-pause').onclick = () => conn && conn.send({ t: 'pause' });
$('unpause').onclick = () => conn && conn.send({ t: 'pause' });
$('b-set').onclick = () => { $('settings').classList.remove('hidden'); };
$('set-close').onclick = () => { $('settings').classList.add('hidden'); };
$('sens').value = st.sens; $('sens-v').textContent = st.sens + '°';
$('sens').oninput = () => { st.sens = Number($('sens').value); store.set('sens', st.sens); $('sens-v').textContent = st.sens + '°'; };
$('invert').checked = st.invert;
$('invert').onchange = () => { st.invert = $('invert').checked; store.set('invert', st.invert); };
$('calib').onclick = () => { st.offset = st.rawAngle || 0; if (navigator.vibrate) navigator.vibrate(30); };

// ------------------------------------------------------------------ invio comandi
let lastSent = '', lastSentT = 0, lastLoop = performance.now();
function send() {
  if (!conn || !connected || !conn.open) return;
  const now = performance.now();
  const s = Math.round(currentSteer(0) * 100) / 100;
  const msg = { t: 'in', s, d: drift, b: brake, q: (st.seq = (st.seq || 0) + 1) };
  if (trickPending) { msg.k = 1; trickPending = false; }
  // lo stato completo dei comandi parte sempre (30 volte al secondo): se un messaggio
  // si perde per strada, quello dopo lo corregge e nessun tasto resta "incastrato"
  if (now - lastSentT < 25 && !msg.k) return;
  lastSentT = now;
  try { conn.send(msg); } catch (e) { /* niente */ }
}
function loop() {
  const now = performance.now();
  const dt = (now - lastLoop) / 1000; lastLoop = now;
  const steer = currentSteer(dt);
  $('wheel').style.transform = `rotate(${steer * 90}deg)`;
  // il tasto DERAPA cambia colore come il mini-turbo (stima locale)
  if (st.view === 'pad') {
    if (st.mode === 'tilt' && motionOK && now - motionSeen > 1000) {
      // il sensore a volte si addormenta: lo riaggancio
      if (now - (st.reMotion || 0) > 1000) { st.reMotion = now; window.removeEventListener('devicemotion', onMotion); window.addEventListener('devicemotion', onMotion); }
      if (now - motionSeen > 3000 && st.status && st.status.phase === 'race') $('steer-hint').textContent = 'Il sensore non risponde: passa ai Tasti dalle impostazioni';
    }
  }
  // collegamento: se lo schermo non risponde da 3 secondi mi ricollego da solo
  if (connected && st.view !== 'join' && lastStatusAt && now - lastStatusAt > 3000 && now - (st.reconnAt || 0) > 4000) {
    st.reconnAt = now;
    $('conn').classList.remove('hidden');
    try { conn.close(); } catch (e) { /* niente */ }
    connected = false;
    openConn();
  }
  if (st.view === 'wait') $('cal-wheel').style.transform = `rotate(${steer * 90}deg)`;
  send();
}
setInterval(loop, 33);
document.documentElement.style.setProperty('--kart', st.color);
$('wheel-hub').setAttribute('fill', st.color);
$('wheel-mark').setAttribute('fill', st.color);

// ------------------------------------------------------------------ schermo sempre acceso, schermo intero
let lock = null;
async function wakeLock() {
  try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* niente */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.view !== 'join') { wakeLock(); if (!connected) connect(); } });
function goFull() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}

show('join');

// minigiochi ai pit stop
const mg = createMgPhone({ root: $('mg'), send: (m) => send2(m), vib: (p) => navigator.vibrate && navigator.vibrate(p) });


// ------------------------------------------------------------------ carte
// Un tocco = usi la carta. Il tasto COMBO compare quando due carte si possono unire.
// Per le carte "contro chi?" la scelta compare al centro e intanto si continua a guidare.
let handSig = '', picking = null, pickT = 0;
function drawHand(s) {
  const h = s.hand || { cards: [], cd: 0 };
  const el = $('hand');
  el.classList.toggle('cool', h.cd > 0);
  const hint = $('hand-hint');
  const full = h.cards.length >= HAND_SIZE;
  hint.classList.toggle('warn', h.cd > 0 || full);
  if (h.cd > 0) hint.textContent = `Ricarica: ${Math.ceil(h.cd)} s`;
  else if (full) hint.textContent = 'Mano piena: usa una carta per pescarne altre';
  else if (h.cards.length) hint.textContent = 'Tocca una carta per usarla';
  else hint.textContent = 'Passa sotto gli archi gialli per pescare carte';
  // tasto COMBO
  const combo = findCombo(h.cards);
  const cb = $('combo');
  cb.classList.toggle('hidden', !combo || !!picking);
  if (combo) { cb.querySelector('span').textContent = CARDS[combo.id].name; cb.dataset.a = combo.a; cb.dataset.b = combo.b; }
  if (picking && (cardId(picking.i) !== picking.id || s.phase !== 'race')) closePick();
  else if (picking) drawPick();
  const sig = JSON.stringify(h.cards);
  if (sig === handSig) return;
  handSig = sig;
  el.innerHTML = '';
  for (let i = 0; i < Math.max(HAND_SIZE, h.cards.length); i++) {
    const id = h.cards[i];
    const c = document.createElement('button');
    c.type = 'button';
    if (!id) { c.className = 'card empty'; c.disabled = true; el.appendChild(c); continue; }
    const def = CARDS[id];
    c.className = 'card ' + (def.rar === 'rara' ? 'rara' : def.rar === 'combo' ? 'combo' : '');
    c.style.background = def.color;
    c.innerHTML = '<span class="rar"></span><span class="nm"></span>';
    c.querySelector('.rar').textContent = def.rar;
    c.querySelector('.nm').textContent = def.name;
    c.setAttribute('aria-label', `${def.name}: ${def.desc}`);
    // un tocco solo, appena il dito tocca la carta
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); c.classList.add('press'); setTimeout(() => c.classList.remove('press'), 150); play(i); });
    el.appendChild(c);
  }
}
function findCombo(cards) {
  for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
    const id = comboOf(cards[a], cards[b]);
    if (id) return { a, b, id };
  }
  return null;
}
$('combo').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const b = $('combo');
  send2({ t: 'combo', a: Number(b.dataset.a), b: Number(b.dataset.b) });
  if (navigator.vibrate) navigator.vibrate([20, 30, 40]);
  b.classList.add('hidden');
});

function cardId(i) { const h = (st.status && st.status.hand) || { cards: [] }; return h.cards[i]; }
function send2(msg) { if (conn && conn.open) { try { conn.send(msg); } catch (e) { /* niente */ } } }

function play(i) {
  const id = cardId(i);
  if (!id) return;
  const h = st.status.hand;
  if (h.cd > 0) { if (navigator.vibrate) navigator.vibrate([10, 40, 10]); return; }
  if (CARDS[id].target !== 'pick') { send2({ t: 'use', i }); return; }
  if (!(st.status.others || []).length) return;
  picking = { i, id };
  pickT = performance.now();
  $('combo').classList.add('hidden');
  drawPick();
}
// scelta del bersaglio: nomi grandi con la posizione, al centro; volante, derapata e freno restano attivi
function drawPick() {
  const box = $('pick-inline');
  const others = [...(st.status.others || [])].sort((a, b) => (a.place || 9) - (b.place || 9));
  const sig = JSON.stringify([picking.id, others]);
  box.classList.remove('hidden');
  $('pad').classList.add('picking');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = `<div class="pk-t">${CARDS[picking.id].name}: contro chi?</div>`;
  for (const o of others) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pk';
    b.style.setProperty('--c', o.color);
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = o.place ? o.place + '°' : '';
    b.querySelector('span').textContent = o.name;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      send2({ t: 'use', i: picking.i, to: o.slot });
      if (navigator.vibrate) navigator.vibrate(25);
      closePick();
    });
    box.appendChild(b);
  }
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'pk-x'; x.textContent = 'Annulla';
  x.addEventListener('pointerdown', (e) => { e.preventDefault(); closePick(); });
  box.appendChild(x);
}
function closePick() {
  picking = null;
  const box = $('pick-inline');
  box.classList.add('hidden'); box.dataset.sig = '';
  $('pad').classList.remove('picking');
}
// Telefonata: schermata di chiamata, si rifiuta facendo scorrere il dito
let callOn = false, callEndAt = 0, ringT = null;
function drawCall(s) {
  const on = !!(s.call && s.phase === 'race');
  if (on && !callOn) {
    $('call-name').textContent = s.call.from;
    $('call-av').textContent = (s.call.from || '?').slice(0, 1).toUpperCase();
    $('call-knob').style.transform = '';
    $('callscr').classList.remove('hidden');
    closePick();
    const ring = () => { if (navigator.vibrate) navigator.vibrate([500, 300]); };
    ring(); ringT = setInterval(ring, 800);
  }
  if (!on && callOn) { $('callscr').classList.add('hidden'); clearInterval(ringT); if (navigator.vibrate) navigator.vibrate(0); }
  callOn = on;
}
(() => {
  const knob = $('call-knob'), track = $('call-slide');
  let sx = null;
  knob.addEventListener('pointerdown', (e) => { e.preventDefault(); sx = e.clientX; try { knob.setPointerCapture(e.pointerId); } catch (err) { /* niente */ } });
  knob.addEventListener('pointermove', (e) => {
    if (sx == null) return;
    const max = track.clientWidth - knob.offsetWidth - 8;
    const dx = Math.max(0, Math.min(max, e.clientX - sx));
    knob.style.transform = `translateX(${dx}px)`;
    if (dx >= max * 0.85) { sx = null; endCall(); }
  });
  const up = () => { if (sx != null) { sx = null; knob.style.transform = ''; } };
  knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
})();
function endCall() {
  callEndAt = performance.now();
  send2({ t: 'callend' });
  $('callscr').classList.add('hidden');
  clearInterval(ringT); if (navigator.vibrate) navigator.vibrate(0);
}
// rimando "chiudi chiamata" finché lo schermo non conferma (la rete può perdere un messaggio)
setInterval(() => { if (callOn && callEndAt && performance.now() - callEndAt < 3000) send2({ t: 'callend' }); }, 300);

// la scelta si chiude da sola se non scegli
setInterval(() => { if (picking && performance.now() - pickT > 7000) closePick(); }, 500);

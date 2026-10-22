// Monitor extra.
// - Stesso PC: riceve lo stato dalla finestra principale (BroadcastChannel).
// - A distanza (?remote=1): si collega via internet allo schermo principale.
import { buildTrack } from './track.js';
import { createRenderer } from './render.js';
import { createScreenConfig, bindScreenBar } from './screen-ui.js';
import { iceServers, PEER_PREFIX } from './net.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const code = (params.get('r') || '').toUpperCase();
const remote = params.get('remote') === '1';
const m = Number(params.get('m') || 1);

const track = buildTrack();
const view = createRenderer($('game'), $('hud'), track);
const key = remote ? 'mck-screen-remote' : 'mck-screen-mon-' + m;
const screen = createScreenConfig(key);
if (!localStorage.getItem(key)) { screen.setMode('1'); screen.setSlot(0, remote ? 0 : m % 4); }

let snap = { phase: 'lobby', karts: [], laps: 3, raceTime: 0, countdown: 0 };
let players = [];
let lastMsg = 0;

// buffer per l'interpolazione (gli aggiornamenti a distanza arrivano ~30 volte al secondo)
let prev = null, cur = null;
function receive(data) {
  if (!data || data.t !== 'snap') return;
  players = data.players || [];
  lastMsg = performance.now();
  if (remote) {
    if (typeof data.q === 'number' && cur && data.q <= cur.q) return; // arrivato in ritardo: lo salto
    prev = cur; cur = { snap: data.snap, at: lastMsg, q: data.q };
  }
  else snap = data.snap;
  drawPick();
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
function interpolated(now) {
  if (!cur) return snap;
  if (!prev) return cur.snap;
  const span = Math.max(16, cur.at - prev.at);
  const t = Math.min(1.5, Math.max(0, (now - 40 - prev.at) / span));
  const karts = cur.snap.karts.map(k => {
    const p = prev.snap.karts.find(q => q.slot === k.slot);
    if (!p || Math.hypot(k.x - p.x, k.z - p.z) > 20) return k;
    return {
      ...k,
      x: p.x + (k.x - p.x) * t, y: p.y + (k.y - p.y) * t, z: p.z + (k.z - p.z) * t,
      yaw: lerpAngle(p.yaw, k.yaw, t),
    };
  });
  return { ...cur.snap, karts };
}

// ------------------------------------------------------------------ collegamento
let peer = null, conn = null, retryT = 0, connected = false;
if (!remote) {
  const bc = new BroadcastChannel('mck-' + (params.get('ch') || code));
  bc.onmessage = (e) => receive(e.data);
} else {
  connectRemote();
}

async function connectRemote() {
  setWait('Mi collego allo schermo principale…');
  if (!code) { setWait('Manca il codice stanza nel link.'); return; }
  if (typeof Peer === 'undefined') { setWait('Non riesco a caricare il gioco: controlla internet e ricarica.'); return; }
  if (!peer || peer.destroyed) {
    const ice = await iceServers();
    peer = new Peer(undefined, { debug: 1, config: { iceServers: ice } });
    peer.on('open', openConn);
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => peer.reconnect(), 1000); });
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') setWait('Stanza non trovata: lo schermo principale è aperto?');
      retry();
    });
  } else openConn();
}
function openConn() {
  if (peer.disconnected) { if (!peer.destroyed) peer.reconnect(); return; }
  if (conn) { try { conn.close(); } catch (e) { /* niente */ } }
  conn = peer.connect(PEER_PREFIX + code, { reliable: false, serialization: 'json' });
  if (!conn) { retry(); return; }
  const giveUp = setTimeout(() => {
    if (!connected) setWait('Non riesco a collegarmi. Se sei su un\'altra rete serve il server ponte (TURN).');
  }, 12000);
  conn.on('open', () => { connected = true; clearTimeout(giveUp); conn.send({ t: 'screen' }); });
  conn.on('data', receive);
  conn.on('close', () => { connected = false; retry(); });
  conn.on('error', () => { connected = false; retry(); });
}
function retry() {
  clearTimeout(retryT);
  retryT = setTimeout(() => { if (!connected) connectRemote(); }, 3000);
}

// ------------------------------------------------------------------ interfaccia
function setWait(text) { $('wait-msg').textContent = text; }

// "chi gioca su questo schermo?"
let pickSig = '';
function drawPick() {
  const el = $('who');
  if (!el) return;
  const sig = players.map(p => p.slot + p.name + p.color).join('|') + '#' + screen.mode + screen.manual()[0];
  if (sig === pickSig) return;
  pickSig = sig;
  el.innerHTML = '';
  if (!players.length) return;
  const title = document.createElement('p');
  title.className = 'hint'; title.textContent = 'Chi guarda questo schermo?';
  el.appendChild(title);
  const row = document.createElement('div');
  row.className = 'who-pick';
  for (const p of players) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = screen.mode === '1' && screen.manual()[0] === p.slot ? 'on' : '';
    b.innerHTML = '<i></i><span></span>';
    b.querySelector('i').style.background = p.color;
    b.querySelector('span').textContent = p.name;
    b.onclick = () => { screen.setMode('1'); screen.setSlot(0, p.slot); };
    row.appendChild(b);
  }
  const all = document.createElement('button');
  all.type = 'button'; all.textContent = 'Tutti';
  all.className = screen.mode === 'auto' ? 'on' : '';
  all.onclick = () => screen.setMode('auto');
  row.appendChild(all);
  el.appendChild(row);
}
screen.onChange(drawPick);

bindScreenBar($('screenbar'), screen, () => players, { enabled: () => true });
$('go-full').onclick = () => document.documentElement.requestFullscreen?.().catch(() => {});
document.title = remote ? 'Mancave Kart – Schermo a distanza' : `Mancave Kart – Monitor ${m + 1}`;

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const s = remote ? interpolated(now) : snap;
  const alive = now - lastMsg < 3000;
  $('waiting').classList.toggle('hidden', alive && s.phase !== 'lobby');
  if (alive) setWait(s.phase === 'lobby' ? 'Collegato! La gara compare qui appena parte.' : '');
  else if (!remote) setWait('In attesa dello schermo principale…');
  $('pause').classList.toggle('hidden', !s.paused);
  const slots = s.phase === 'lobby' ? [-1] : screen.slots(players);
  try { view.render(s, slots, dt); } catch (e) { console.error(e); }
}
requestAnimationFrame(frame);

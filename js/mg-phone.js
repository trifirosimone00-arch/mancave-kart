// Minigiochi sul telefono. I giochi a riflessi girano qui (niente ritardo di rete):
// al PC arriva solo lo stato (punti, fatto, eliminato, risposte).
import {
  GAMES, PIT_INTRO, PIT_COUNT, PIT_GO, TIE_INTRO, TIE_TAP, LAMPO, lampoNumbers, BALLOON_TAPS, CAN_FULL, SEM_READY, SEM_FOUL, semDelay, barRound, pmNumbers, chipPlan,
  makeMaze, mazeWall, duelPairOf, DUEL_NAMES,
} from './minigames.js';
import { CARDS } from './cards.js';

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ANS_COLORS = ['#e8322b', '#2f7bff', '#ffb000', '#2ec46b'];
const DOOR_COLORS = ['#e8322b', '#2f7bff', '#2ec46b'];
const now = () => performance.now();

export function createMgPhone({ root, send, vib }) {
  const $ = (sel) => root.querySelector(sel);
  let pit = null, pitAt = 0;         // ultimo stato del pit stop e quando è arrivato
  let mySlot = -1, names = {};
  let g = null;                      // partita in corso { id, game, t0, s, ... }
  let lastSent = 0, sentSig = '';
  let offerSig = '', offerPick = [];
  let built = '';

  const elapsed = () => (g ? (now() - g.t0) / 1000 : 0);
  const buzz = (p) => { try { vib(p); } catch (e) { /* niente */ } };
  const nameOf = (slot) => names[slot] || 'Avversario';

  function report(force) {
    if (!g) return;
    const sig = JSON.stringify(g.s);
    const t = now();
    if (!force && sig === sentSig && t - lastSent < 300) return;
    if (!force && t - lastSent < 90) return;
    sentSig = sig; lastSent = t;
    send({ t: 'mg', s: { ...g.s, id: g.id } });
  }

  // ---------------------------------------------------------------- avvio di un gioco
  function start(p) {
    stopMic();
    g = { id: p.id, game: p.game, seed: p.seed, dur: p.dur, short: !!p.short, t0: now() - (p.t || 0) * 1000, s: {} };
    const s = g.s;
    if (g.game === 'barra') { s.score = 0; s.round = 0; g.roundAt = now() + 600; }
    if (g.game === 'pallone') s.n = 0;
    if (g.game === 'lattina' || g.game === 'regata' || g.game === 'labirinto') s.p = 0;
    if (g.game === 'patatine') { s.score = 0; g.plan = chipPlan(g.seed, g.dur); g.taken = new Set(); }
    if (g.game === 'piumeno') { s.best = 0; s.cur = 0; g.nums = pmNumbers(g.seed); g.i = 0; }
    if (g.game === 'porta' || g.game === 'quiz' || g.game === 'semaforo') { s.ans = {}; s.at = {}; }
    if (g.game === 'labirinto') startMaze();
    build();
    report(true);
  }
  // per lo spareggio serve un contenitore anche se non ho giocato
  function ensureGame(p) { if (!g || g.id !== p.id) { g = { id: p.id, game: p.game, seed: p.seed, dur: p.dur, t0: now(), s: {} }; built = ''; } }

  const timed = () => !GAMES[g.game].rounds && !GAMES[g.game].duel;
  function over() { return !g || g.s.done || (timed() && elapsed() >= g.dur); }

  // ---------------------------------------------------------------- disegno
  function build() {
    const body = $('#mg-body');
    const k = g.game;
    built = g.id + k;
    if (k === 'barra') {
      body.innerHTML = `<div class="bar-wrap"><div class="bar"><i class="bar-g"></i><i class="bar-c"></i></div><div class="mg-big" id="mg-score">0 pt</div></div>
        <button class="mg-btn" type="button" id="mg-act">STOP</button>`;
    } else if (k === 'pallone' || k === 'lattina') {
      body.innerHTML = `<div class="mg-split"><div class="${k === 'pallone' ? 'balloon' : 'can'}" id="mg-vis"><i></i></div><div class="mg-big" id="mg-score">0%</div></div>
        <button class="mg-btn" type="button" id="mg-act">${k === 'pallone' ? 'TOCCA!' : 'SCUOTI!'}<small>${k === 'lattina' ? 'o tocca a raffica' : 'più veloce che puoi'}</small></button>`;
    } else if (k === 'regata') {
      body.innerHTML = `<div class="mg-split"><div class="sink"><i class="boat" id="mg-vis">⛵</i><i class="flag">🏁</i></div><div class="mg-big" id="mg-score">0%</div><div class="mg-sub" id="mg-mic">Tocca il tasto per usare il microfono</div></div>
        <button class="mg-btn" type="button" id="mg-act">SOFFIA!<small id="mg-act-sub">tocca per attivare il microfono</small></button>`;
    } else if (k === 'labirinto') {
      body.innerHTML = `<canvas class="maze" id="mg-maze"></canvas><div class="maze-side"><div class="mg-big" id="mg-score">0%</div><div class="mg-sub" id="mg-tilt">Inclina il telefono</div>
        <button class="btn ghost" type="button" id="mg-sensor">Centra</button><button class="btn ghost" type="button" id="mg-flip">Inverti</button></div>`;
    } else if (k === 'semaforo') {
      body.innerHTML = `<button class="sem" type="button" id="mg-act"><b id="mg-light">PRONTI…</b><small id="mg-score"></small></button>`;
    } else if (k === 'patatine') {
      body.innerHTML = `<div class="chips" id="mg-chips">${Array.from({ length: 9 }, (_, i) => `<button type="button" data-c="${i}" aria-label="Casella ${i + 1}"></button>`).join('')}</div><div class="mg-big side" id="mg-score">0</div>`;
    } else if (k === 'piumeno') {
      body.innerHTML = `<div class="pm"><div class="pm-n" id="mg-num"></div><div class="mg-sub" id="mg-score"></div></div>
        <div class="pm-btns"><button class="mg-btn up" type="button" id="mg-up">PIÙ ALTO</button><button class="mg-btn down" type="button" id="mg-down">PIÙ BASSO</button></div>`;
    } else if (k === 'porta') {
      body.innerHTML = `<div class="pdoors">${[0, 1, 2].map(i => `<button type="button" class="pdoor" data-d="${i}" style="--c:${DOOR_COLORS[i]}">${i + 1}</button>`).join('')}</div><div class="mg-sub" id="mg-score"></div>`;
    } else if (k === 'quiz') {
      body.innerHTML = `<div class="pq"><div class="pq-q" id="mg-q"></div><div class="pq-a">${[0, 1, 2, 3].map(i => `<button type="button" data-a="${i}" style="--c:${ANS_COLORS[i]}"></button>`).join('')}</div></div>`;
    }
    bind();
  }

  function buildTie() {
    built = 'tie' + g.id;
    $('#mg-body').innerHTML = `<button class="mg-btn" type="button" id="mg-tie">SPAREGGIO<small id="mg-tie-sub">preparati…</small></button>`;
    $('#mg-tie').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!pit || pit.stage !== 'tie' || pitStageT() < TIE_INTRO || pitStageT() > TIE_INTRO + TIE_TAP) return;
      g.s.tie = (g.s.tie || 0) + 1;
      if (g.s.tie % 5 === 0) buzz(8);
      report();
    });
  }

  function bind() {
    const k = g.game;
    const act = $('#mg-act');
    const tap = (el, fn) => el && el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); });
    if (k === 'barra') tap(act, barStop);
    if (k === 'pallone') tap(act, () => { if (over() || g.s.popT != null) return; g.s.n++; if (g.s.n % 5 === 0) buzz(8); if (g.s.n >= BALLOON_TAPS) { g.s.popT = Math.round(elapsed() * 1000); g.s.done = 1; buzz([80, 40, 200]); } report(); });
    if (k === 'lattina') tap(act, () => addFill(1.4));
    if (k === 'regata') tap(act, () => { if (!g.mic && !g.micTried) startMic(); else addFill(0.9); });
    if (k === 'semaforo') tap(act, semTap);
    if (k === 'patatine') root.querySelectorAll('#mg-chips button').forEach(b => tap(b, () => chipTap(Number(b.dataset.c))));
    if (k === 'piumeno') { tap($('#mg-up'), () => pmGuess(true)); tap($('#mg-down'), () => pmGuess(false)); }
    if (k === 'porta') root.querySelectorAll('.pdoor').forEach(b => tap(b, () => answer(Number(b.dataset.d))));
    if (k === 'quiz') root.querySelectorAll('.pq-a button').forEach(b => tap(b, () => answer(Number(b.dataset.a))));
    if (k === 'labirinto') bindMaze();
  }

  // ---------------------------------------------------------------- Ferma la barra
  function barPos() {
    const { speed } = barRound(g.s.round);
    const p = Math.max(0, (now() - g.roundAt) / 1000) * speed;
    const f = p % 1;
    return f < 0.5 ? -1 + 4 * f : 3 - 4 * f;
  }
  function barStop() {
    if (over() || now() < g.roundAt) return;
    const { half } = barRound(g.s.round);
    const d = Math.abs(barPos());
    if (d <= half) {
      const pts = Math.max(10, Math.round(100 * (1 - d / half)));
      g.s.score += pts; g.s.round++;
      g.flash = `+${pts}`; g.flashAt = now();
      g.roundAt = now() + 900;
      buzz(30);
    } else {
      g.s.out = 1; g.s.done = 1;
      g.flash = 'FUORI!'; g.flashAt = now();
      buzz([200]);
    }
    report(true);
  }

  // ---------------------------------------------------------------- lattina e regata: riempi fino a 100
  function addFill(v) {
    if (!g || over() || g.s.popT != null) return;
    g.s.p = Math.min(CAN_FULL, g.s.p + v);
    if (g.s.p >= CAN_FULL) { g.s.popT = Math.round(elapsed() * 1000); g.s.done = 1; buzz([80, 40, 200]); stopMic(); }
    report();
  }

  // microfono (Regata): più forte soffi, più va veloce la barchetta
  async function startMic() {
    g.micTried = true;
    const gg = g;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (g !== gg || over()) { stream.getTracks().forEach(t => t.stop()); return; }
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      g.mic = { stream, ctx, an, buf: new Float32Array(an.fftSize), base: 1, t0: now() };
      $('#mg-mic').textContent = 'Soffia forte nel microfono!';
      $('#mg-act-sub').textContent = 'oppure tocca per remare';
    } catch (e) {
      $('#mg-mic').textContent = 'Microfono non disponibile: tocca il tasto per remare';
      $('#mg-act-sub').textContent = 'tocca a raffica per remare';
    }
  }
  function micLevel() {
    const m = g.mic;
    m.an.getFloatTimeDomainData(m.buf);
    let sum = 0;
    for (let i = 0; i < m.buf.length; i++) sum += m.buf[i] * m.buf[i];
    const rms = Math.sqrt(sum / m.buf.length);
    if (now() - m.t0 < 600) m.base = Math.min(m.base, rms);    // rumore di fondo della stanza
    return Math.max(0, rms - m.base - 0.03);
  }
  function stopMic() {
    if (g && g.mic) {
      try { g.mic.stream.getTracks().forEach(t => t.stop()); g.mic.ctx.close(); } catch (e) { /* niente */ }
      g.mic = null;
    }
  }

  // ---------------------------------------------------------------- Labirinto
  let tilt = { x: 0, y: 0, base: null, seen: 0, flip: 1 };
  function onOrient(e) {
    if (e.beta == null) return;
    const a = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    let x, y;
    if (a === 90) { x = e.beta; y = -e.gamma; }
    else if (a === 270 || a === -90) { x = -e.beta; y = e.gamma; }
    else if (a === 180) { x = -e.gamma; y = -e.beta; }
    else { x = e.gamma; y = e.beta; }
    // centro: media delle prime letture (come tieni il telefono adesso = fermo)
    if (!tilt.base) { tilt.cal = tilt.cal || []; tilt.cal.push([x, y]); if (tilt.cal.length >= 8) { tilt.base = { x: tilt.cal.reduce((a, c) => a + c[0], 0) / tilt.cal.length, y: tilt.cal.reduce((a, c) => a + c[1], 0) / tilt.cal.length }; tilt.cal = null; } tilt.seen = now(); return; }
    const dz = (v) => (Math.abs(v) < 2 ? 0 : v - Math.sign(v) * 2);   // zona morta di 2 gradi
    const tx = Math.max(-1, Math.min(1, dz(x - tilt.base.x) / 20)) * tilt.flip;
    const ty = Math.max(-1, Math.min(1, dz(y - tilt.base.y) / 20)) * tilt.flip;
    tilt.x += (tx - tilt.x) * 0.3; tilt.y += (ty - tilt.y) * 0.3;     // filtro: niente scatti
    tilt.seen = now();
  }
  window.addEventListener('deviceorientation', onOrient);
  async function askSensor() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission();
    } catch (e) { /* niente */ }
    tilt.base = null; tilt.cal = null;
  }
  function startMaze() {
    g.M = makeMaze(g.seed, g.short);
    g.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    g.s.falls = 0;
    g.drag = null;
    tilt.base = null;
  }
  function bindMaze() {
    const cv = $('#mg-maze');
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / g.cs, y: (e.clientY - r.top) / g.cs }; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture?.(e.pointerId); } catch (err) { /* niente */ } g.drag = pos(e); });
    cv.addEventListener('pointermove', (e) => { if (g.drag) g.drag = pos(e); });
    const up = () => { g.drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    $('#mg-sensor').addEventListener('click', askSensor);
    $('#mg-flip').addEventListener('click', () => { tilt.flip *= -1; });
  }
  function mazeStep(dt) {
    const M = g.M, b = g.ball, R = 0.22;
    let ax = tilt.x * 11, ay = tilt.y * 11;
    if (g.drag) { const dx = g.drag.x - b.x, dy = g.drag.y - b.y, d = Math.hypot(dx, dy) || 1; ax = dx / d * 12 * Math.min(1, d); ay = dy / d * 12 * Math.min(1, d); }
    const steps = 4, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      b.vx = (b.vx + ax * h) * (1 - 2.6 * h); b.vy = (b.vy + ay * h) * (1 - 2.6 * h);
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 4.2) { b.vx *= 4.2 / sp; b.vy *= 4.2 / sp; }
      // asse x
      let cx = Math.floor(b.x), cy = Math.floor(b.y);
      let nx = b.x + b.vx * h;
      const wallX = (dir) => mazeWall(M, cx, cy, dir) || (b.y - R < cy && cy > 0 && mazeWall(M, cx, cy - 1, dir)) || (b.y + R > cy + 1 && cy < M.H - 1 && mazeWall(M, cx, cy + 1, dir));
      if (nx + R > cx + 1 && wallX('r')) { nx = cx + 1 - R; b.vx *= -0.25; }
      if (nx - R < cx && wallX('l')) { nx = cx + R; b.vx *= -0.25; }
      b.x = Math.max(R, Math.min(M.W - R, nx));
      // asse y
      cx = Math.floor(b.x); cy = Math.floor(b.y);
      let ny = b.y + b.vy * h;
      const wallY = (dir) => mazeWall(M, cx, cy, dir) || (b.x - R < cx && cx > 0 && mazeWall(M, cx - 1, cy, dir)) || (b.x + R > cx + 1 && cx < M.W - 1 && mazeWall(M, cx + 1, cy, dir));
      if (ny + R > cy + 1 && wallY('d')) { ny = cy + 1 - R; b.vy *= -0.25; }
      if (ny - R < cy && wallY('u')) { ny = cy + R; b.vy *= -0.25; }
      b.y = Math.max(R, Math.min(M.H - R, ny));
    }
    const cx = Math.floor(b.x), cy = Math.floor(b.y);
    for (const ho of M.holes) {
      if (Math.hypot(b.x - (ho.x + 0.5), b.y - (ho.y + 0.5)) < 0.3) {
        g.s.falls++; Object.assign(b, { x: 0.5, y: 0.5, vx: 0, vy: 0 }); g.flash = 'Caduto!'; g.flashAt = now(); buzz([200]);
        report(true);
        return;
      }
    }
    if (cx === M.exit.x && cy === M.exit.y) { g.s.popT = Math.round(elapsed() * 1000); g.s.done = 1; g.s.p = 100; buzz([80, 40, 200]); report(true); return; }
    g.s.p = Math.max(0, Math.round(100 * (1 - M.dist[cy][cx] / M.total)));
  }
  function mazeDraw() {
    const cv = $('#mg-maze');
    if (!cv) return;
    const M = g.M, b = g.ball;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cs = Math.floor(Math.min(r.width / M.W, r.height / M.H));
    g.cs = cs;
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    c.fillStyle = '#c8a46a'; c.fillRect(0, 0, M.W * cs, M.H * cs);
    // uscita
    c.fillStyle = '#2ec46b'; c.fillRect(M.exit.x * cs + 3, M.exit.y * cs + 3, cs - 6, cs - 6);
    c.fillStyle = '#fff'; c.font = `900 ${Math.round(cs * 0.45)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🏁', (M.exit.x + 0.5) * cs, (M.exit.y + 0.5) * cs);
    // buchi
    for (const h of M.holes) { c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc((h.x + 0.5) * cs, (h.y + 0.5) * cs, cs * 0.3, 0, Math.PI * 2); c.fill(); }
    // muri
    c.strokeStyle = '#5a3a1a'; c.lineWidth = Math.max(3, cs * 0.09); c.lineCap = 'round';
    c.beginPath();
    for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
      if (mazeWall(M, x, y, 'r')) { c.moveTo((x + 1) * cs, y * cs); c.lineTo((x + 1) * cs, (y + 1) * cs); }
      if (mazeWall(M, x, y, 'd')) { c.moveTo(x * cs, (y + 1) * cs); c.lineTo((x + 1) * cs, (y + 1) * cs); }
      if (x === 0) { c.moveTo(0, y * cs); c.lineTo(0, (y + 1) * cs); }
      if (y === 0) { c.moveTo(x * cs, 0); c.lineTo((x + 1) * cs, 0); }
    }
    c.stroke();
    // pallina
    const grad = c.createRadialGradient((b.x - 0.07) * cs, (b.y - 0.07) * cs, 2, b.x * cs, b.y * cs, cs * 0.22);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#9aa3b5');
    c.fillStyle = grad; c.beginPath(); c.arc(b.x * cs, b.y * cs, cs * 0.22, 0, Math.PI * 2); c.fill();
  }

  // ---------------------------------------------------------------- Semaforo a duelli (le manche le decide il PC)
  function semClock() {
    // secondi dall'inizio della manche (stimati dall'ultimo stato)
    return pit.roundT + (now() - pitAt) / 1000;
  }
  function semTap() {
    if (!pit || pit.stage !== 'play' || pit.reveal || pit.round < 0) return;
    const r = pit.round;
    if (g.s.ans[r] != null || !duelPairOf(pit.duel, mySlot)) return;
    const t = semClock() - SEM_READY;
    if (t < 0) return;
    const d = semDelay(g.seed, r);
    if (t < d) { g.s.ans[r] = SEM_FOUL; g.last = 'Troppo presto!'; buzz([200]); }
    else { g.s.ans[r] = Math.round((t - d) * 1000); g.last = `${g.s.ans[r]} ms`; buzz(30); }
    report(true);
  }

  // ---------------------------------------------------------------- patatine, più o meno, porte e quiz
  function chipTap(cell) {
    if (over()) return;
    const t = elapsed();
    let hit = -1;
    g.plan.forEach((c, i) => { if (c.cell === cell && t >= c.at && t < c.at + c.life && !g.taken.has(i)) hit = i; });
    if (hit < 0) return;
    g.taken.add(hit);
    const bad = g.plan[hit].bad;
    g.s.score += bad ? -2 : 1;
    buzz(bad ? [120] : 15);
    report();
  }
  function pmGuess(up) {
    if (over() || now() < (g.pmWait || 0)) return;
    const cur = g.nums[g.i], next = g.nums[g.i + 1];
    const ok = up ? next > cur : next < cur;
    g.i++;
    g.s.i = g.i;
    if (ok) { g.s.cur++; g.s.best = Math.max(g.s.best, g.s.cur); buzz(20); g.flash = 'Giusto!'; }
    else { g.s.cur = 0; buzz([150]); g.flash = `No! Era ${next}`; g.pmWait = now() + 500; }
    g.flashAt = now();
    report(true);
  }
  function answer(i) {
    if (!pit || pit.stage !== 'play' || pit.reveal || pit.round < 0) return;
    const r = pit.round;
    if (g.s.ans[r] != null) return;
    g.s.ans[r] = i;
    g.s.at[r] = Math.round((pit.roundT + (now() - pitAt) / 1000) * 1000);
    buzz(20);
    report(true);
  }

  // ---------------------------------------------------------------- ogni fotogramma
  const pitStageT = () => pit.stageT + (now() - pitAt) / 1000;
  let lastFrame = now();
  function frame() {
    requestAnimationFrame(frame);
    const tNow = now(), dt = Math.min(0.05, (tNow - lastFrame) / 1000);
    lastFrame = tNow;
    if (root.classList.contains('hidden')) return;
    if (lampo) { lampoFrame(dt); return; }
    if (!pit) return;
    const P = pit;
    if (P.stage === 'count' || P.stage === 'go' || P.stage === 'done') {
      const left = (P.stage === 'count' ? PIT_COUNT : PIT_GO) - pitStageT();
      const txt = left > 0.05 ? String(Math.max(1, Math.ceil(left))) : 'VIA!';
      const ce = $('#mg-count');
      if (ce.textContent !== txt) { ce.textContent = txt; if (txt === 'VIA!') buzz(60); }
    }
    if (skipWant && now() - skipWant.at > 400) { skipWant.at = now(); send({ t: 'pitskip', id: skipWant.id, stage: skipWant.stage }); }
    const lt = P.stage === 'play' && g ? elapsed() : 0;
    const G = GAMES[P.game];
    let time = '';
    if (P.stage === 'intro') time = `Si parte tra ${Math.max(1, Math.ceil(PIT_INTRO - pitStageT()))}`;
    else if (P.stage === 'play' && G.duel) time = `Manche ${P.round + 1}`;
    else if (P.stage === 'play' && G.rounds) time = `${P.game === 'quiz' ? 'Domanda' : 'Manche'} ${P.round + 1}/${P.rounds || G.rounds}`;
    else if (P.stage === 'play') time = `${Math.max(0, Math.ceil(P.dur - lt))}s`;
    else if (P.stage === 'tie') time = pitStageT() < TIE_INTRO ? 'Spareggio!' : `${Math.max(0, Math.ceil(TIE_INTRO + TIE_TAP - pitStageT()))}s`;
    $('#mg-time').textContent = time;

    if (P.stage === 'tie' && g && built === 'tie' + g.id) {
      const st = pitStageT();
      const sub = $('#mg-tie-sub'), btn = $('#mg-tie');
      btn.classList.toggle('go', st >= TIE_INTRO && st <= TIE_INTRO + TIE_TAP);
      sub.textContent = st < TIE_INTRO ? 'preparati…' : st <= TIE_INTRO + TIE_TAP ? `TOCCA A RAFFICA! ${g.s.tie || 0}` : `Fatto: ${g.s.tie || 0} tap`;
      report();
      return;
    }
    if (P.stage !== 'play' || !g || g.id !== P.id) return;
    const s = g.s, k = g.game;
    const flash = g.flash && now() - g.flashAt < 800 ? g.flash : '';
    if (k === 'barra') {
      const { half } = barRound(s.round);
      const gz = $('.bar-g'), c = $('.bar-c');
      gz.style.left = `${50 - half * 50}%`; gz.style.width = `${half * 100}%`;
      const bp = barPos();
      c.style.left = `${50 + bp * 50}%`;
      c.style.opacity = s.out ? 0.3 : 1;
      s.v = { c: Math.round(bp * 100) / 100, h: Math.round(half * 1000) / 1000 };
      $('#mg-score').textContent = flash || (s.out ? `Fuori! ${s.score} pt` : `${s.score} pt`);
      $('#mg-act').disabled = over();
    } else if (k === 'pallone' || k === 'lattina') {
      const f = k === 'pallone' ? s.n / BALLOON_TAPS : s.p / CAN_FULL;
      const vis = $('#mg-vis');
      if (k === 'pallone') vis.style.transform = `scale(${0.35 + f * 0.75})`;
      else vis.firstChild.style.height = `${Math.round(f * 100)}%`;
      vis.classList.toggle('pop', s.popT != null);
      $('#mg-score').textContent = s.popT != null ? (k === 'pallone' ? 'BOOM!' : 'SPLASH!') : `${Math.round(f * 100)}%`;
    } else if (k === 'regata') {
      if (g.mic && !over()) { const lv = micLevel(); if (lv > 0) addFill(Math.min(15, lv * 60) * dt); }
      $('#mg-vis').style.left = `${Math.min(88, s.p * 0.88)}%`;
      $('#mg-score').textContent = s.popT != null ? 'ARRIVATO!' : `${Math.round(s.p)}%`;
      if (over()) stopMic();
    } else if (k === 'labirinto') {
      if (!over()) mazeStep(dt);
      mazeDraw();
      s.v = { x: Math.round(g.ball.x * 100) / 100, y: Math.round(g.ball.y * 100) / 100 };
      $('#mg-score').textContent = flash || (s.popT != null ? 'USCITO!' : `${s.p}%`);
      $('#mg-tilt').textContent = now() - tilt.seen < 1500 ? 'Inclina il telefono' : 'Trascina il dito sul labirinto';
    } else if (k === 'semaforo') {
      const light = $('#mg-light'), btn = $('#mg-act');
      const pair = duelPairOf(P.duel, mySlot);
      const r = P.round;
      let cls = 'pause', txt = '', sub = '';
      if (P.reveal) {
        const res = (P.reveal.res || []).find(x => x.a === mySlot || x.b === mySlot);
        if (res) { txt = res.w === mySlot ? 'MANCHE VINTA!' : res.w == null ? 'Pari' : 'Manche persa'; cls = res.w === mySlot ? 'go' : 'pause'; }
        else txt = 'Guarda la TV';
      } else if (!pair) {
        const D = P.duel;
        txt = D && D.place[mySlot] ? `${D.place[mySlot]}° posto` : D && D.bye === mySlot ? 'Sei già in finale' : 'Guarda la TV';
        sub = 'Tocca agli altri';
      } else {
        const opp = pair.a === mySlot ? pair.b : pair.a;
        const me = pair.a === mySlot ? pair.sa : pair.sb, him = pair.a === mySlot ? pair.sb : pair.sa;
        sub = `${DUEL_NAMES[pair.kind]} contro ${nameOf(opp)} · ${me}-${him}`;
        if (s.ans[r] != null) { txt = g.last || 'Fatto'; cls = s.ans[r] >= SEM_FOUL ? 'wait' : 'pause'; }
        else {
          const t = semClock() - SEM_READY, d = semDelay(g.seed, r);
          if (t < 0) { txt = 'PRONTI…'; cls = 'pause'; }
          else if (t < d) { txt = 'ASPETTA…'; cls = 'wait'; }
          else { txt = 'ORA!'; cls = 'go'; if (!g.goBuzz || g.goBuzz !== r + 1) { g.goBuzz = r + 1; buzz(40); } }
        }
      }
      btn.className = 'sem ' + cls;
      light.textContent = txt;
      $('#mg-score').textContent = sub;
    } else if (k === 'patatine') {
      const show = new Array(9).fill(null);
      g.plan.forEach((c, i) => { if (lt >= c.at && lt < c.at + c.life && !g.taken.has(i)) show[c.cell] = c.bad ? 'bad' : 'good'; });
      root.querySelectorAll('#mg-chips button').forEach((b, i) => { b.className = show[i] || ''; });
      $('#mg-score').textContent = `${s.score}`;
    } else if (k === 'piumeno') {
      $('#mg-num').textContent = g.nums[g.i];
      $('#mg-score').textContent = flash || `Serie ${s.cur} · migliore ${s.best}`;
    } else if (k === 'porta') {
      const mine = s.ans[P.round];
      root.querySelectorAll('.pdoor').forEach((b, i) => {
        b.classList.toggle('on', mine === i);
        b.classList.toggle('off', mine != null && mine !== i);
        b.classList.toggle('lone', !!(P.reveal && P.reveal.lone[i] && mine === i));
      });
      $('#mg-score').textContent = P.reveal ? (mine != null && P.reveal.lone[mine] ? 'Eri da solo: +1!' : mine == null ? 'Non hai scelto' : 'Non eri da solo') + ` · ${P.pts} pt`
        : mine != null ? `Hai scelto la porta ${mine + 1}` : `Scegli una porta · ${P.pts} pt`;
    } else if (k === 'quiz' && P.q) {
      const mine = s.ans[P.round];
      if (g.qr !== P.round) { g.qr = P.round; $('#mg-q').textContent = P.q.q; root.querySelectorAll('.pq-a button').forEach((b, i) => { b.textContent = P.q.answers[i]; }); }
      root.querySelectorAll('.pq-a button').forEach((b, i) => {
        b.classList.toggle('on', mine === i);
        b.classList.toggle('off', (mine != null && mine !== i) || (!!P.reveal && i !== P.reveal.correct));
        b.classList.toggle('ok', !!P.reveal && i === P.reveal.correct);
      });
    }
    // fine tempo: blocco il gioco
    if (timed() && lt >= g.dur && !s.done) { s.done = 1; stopMic(); report(true); }
    report();
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- stato dal PC
  function update(status) {
    const P = status.pit;
    pit = P; pitAt = now();
    mySlot = status.slot;
    for (const o of status.others || []) names[o.slot] = o.name;
    const lampoOn = !P && status.lampo && !status.lampo.done;
    $('#mg-skip').classList.toggle('hidden', !(P && P.canSkip));
    $('#mg-count').classList.toggle('hidden', !(P && (P.stage === 'count' || P.stage === 'go' || P.stage === 'done')));
    if (!P) { stopMic(); if (!lampoOn) { g = null; built = ''; } drawOffer(null); updateLampo(lampoOn ? status.lampo : null); return; }
    lampo = null;
    if (P.canSkip) {
      const btn = $('#mg-skip');
      btn.classList.toggle('done', !!P.skipped);
      btn.textContent = P.skipped ? 'PRONTO ✓' : 'SALTA ▸';
      if (skipWant && (skipWant.id !== P.id || skipWant.stage !== P.stage || P.skipped)) skipWant = null;
    }
    const G = GAMES[P.game];
    $('#mg-tag').textContent = `PIT STOP ${P.n}${P.of ? ' di ' + P.of : ''}`;
    $('#mg-title').textContent = G.title;
    const stageEl = $('#mg-stage'), body = $('#mg-body'), done = $('#mg-done');
    if (P.stage === 'play' && (!g || g.id !== P.id)) start(P);
    if (P.stage === 'intro' || P.stage === 'count') {
      stageEl.className = 'mg-stage';
      stageEl.innerHTML = `<p class="mg-help">${esc(G.help)}</p><p class="mg-sub">Premi SALTA quando sei pronto</p>`;
      body.classList.add('hidden'); done.classList.add('hidden');
    } else if (P.stage === 'play') {
      stageEl.className = 'mg-stage hidden';
      if (g && built !== g.id + g.game) build();
      const doneMsg = g && g.s.done && timed();
      body.classList.toggle('hidden', !!doneMsg);
      done.classList.toggle('hidden', !doneMsg);
      if (doneMsg) done.innerHTML = `<b>Fatto!</b><span>Guarda la TV per la classifica</span>`;
    } else if (P.stage === 'tie') {
      ensureGame(P);
      const inTie = P.tie && P.tie.slots.includes(mySlot);
      done.classList.add('hidden');
      if (inTie) {
        stageEl.className = 'mg-stage hidden';
        if (built !== 'tie' + g.id) buildTie();
        body.classList.remove('hidden');
      } else {
        body.classList.add('hidden');
        stageEl.className = 'mg-stage';
        stageEl.innerHTML = `<p class="mg-help">Spareggio tra ${esc(P.tie.slots.map(nameOf).join(' e '))}</p><p class="mg-sub">Guarda la TV</p>`;
      }
    } else {
      stopMic();
      body.classList.add('hidden'); done.classList.add('hidden');
      stageEl.className = 'mg-stage';
      const me = P.me;
      let html = me ? `<div class="mg-place">${me.place}°</div><p class="mg-help">${esc(me.prize.text)}</p>` : '<p class="mg-help">Classifica sulla TV</p>';
      if (P.stage === 'go' || P.stage === 'done') html += '<p class="mg-sub">Si riparte! Tieni pronto il volante</p>';
      stageEl.innerHTML = html;
    }
    drawOffer(status.offer);
  }

  // SALTA: lo rimando finché lo schermo non conferma (la rete può perdere un messaggio)
  let skipWant = null;
  $('#mg-skip').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!pit || !pit.canSkip || pit.skipped) return;
    skipWant = { id: pit.id, stage: pit.stage, at: now() };
    send({ t: 'pitskip', id: pit.id, stage: pit.stage });
    buzz(20);
    const btn = $('#mg-skip'); btn.classList.add('done'); btn.textContent = 'PRONTO ✓';
  });

  // ---------------------------------------------------------------- minigioco lampo: missione veloce, poi si riparte
  let lampo = null;              // { id, mission, seed, n, of, t0, s, doneAt, sentAt }
  function updateLampo(L) {
    const stageEl = $('#mg-stage'), body = $('#mg-body'), done = $('#mg-done');
    if (!L) { lampo = null; return; }
    if (!lampo || lampo.id !== L.id) {
      lampo = { id: L.id, mission: L.mission, seed: L.seed, n: 0, t0: now() - (L.t || 0) * 1000, nums: lampoNumbers(L.seed), next: 1, p: 0, barAt: now() + 400, doneAt: 0, sentAt: 0 };
      buildLampo();
    }
    $('#mg-tag').textContent = `MINIGIOCO LAMPO · PIT STOP ${L.n}${L.of ? ' di ' + L.of : ''}`;
    $('#mg-title').textContent = LAMPO[L.mission].title;
    stageEl.className = 'mg-stage hidden'; done.classList.add('hidden'); body.classList.remove('hidden');
  }
  function buildLampo() {
    const body = $('#mg-body');
    built = 'lampo' + lampo.id;
    const m = lampo.mission;
    if (m === 'tap' || m === 'shake') {
      body.innerHTML = `<div class="mg-split"><div class="mg-big" id="lp-score"></div><div class="mg-sub">${m === 'shake' ? 'Scuoti il telefono o tocca a raffica' : 'Più veloce che puoi!'}</div></div><button class="mg-btn" type="button" id="lp-act">${m === 'tap' ? 'TOCCA!' : 'SCUOTI!'}</button>`;
    } else if (m === 'barra') {
      body.innerHTML = `<div class="bar-wrap"><div class="bar"><i class="bar-g"></i><i class="bar-c"></i></div><div class="mg-big" id="lp-score">Fermala nel verde</div></div><button class="mg-btn" type="button" id="lp-act">STOP</button>`;
    } else {
      body.innerHTML = `<div class="lp-nums">${lampo.nums.map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}</div><div class="mg-big side" id="lp-score">1</div>`;
    }
    const tap = (el, fn) => el && el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); });
    tap($('#lp-act'), lampoAct);
    root.querySelectorAll('.lp-nums button').forEach(b => tap(b, () => {
      if (lampo.doneAt) return;
      const n = Number(b.dataset.n);
      if (n === lampo.next) { b.classList.add('ok'); lampo.next++; buzz(15); if (lampo.next > 6) lampoFinish(); }
      else { buzz([120]); b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 250); }
    }));
  }
  function lampoBar() { const p = Math.max(0, (now() - lampo.barAt) / 1000) * 0.75, f = p % 1; return f < 0.5 ? -1 + 4 * f : 3 - 4 * f; }
  function lampoAct() {
    if (!lampo || lampo.doneAt) return;
    const m = lampo.mission;
    if (m === 'tap') { lampo.n++; buzz(8); if (lampo.n >= LAMPO.tap.n) lampoFinish(); }
    if (m === 'shake') { lampo.p += 1.5; if (lampo.p >= LAMPO.shake.n) lampoFinish(); }
    if (m === 'barra') {
      if (now() < lampo.barAt) return;
      if (Math.abs(lampoBar()) <= 0.22) lampoFinish();
      else { buzz([150]); lampo.barAt = now() + 600; }
    }
  }
  function lampoFinish() {
    lampo.doneAt = now();
    buzz([60, 40, 160]);
    send({ t: 'lampo', id: lampo.id });
    lampo.sentAt = now();
  }
  function lampoFrame() {
    const L = lampo, m = L.mission;
    $('#mg-time').textContent = `${((now() - L.t0) / 1000).toFixed(1)}s`;
    if (L.doneAt) {
      if (now() - L.sentAt > 300) { L.sentAt = now(); send({ t: 'lampo', id: L.id }); }
      const sc = $('#lp-score'); if (sc) sc.textContent = 'VIA! Riparti!';
      return;
    }
    if (m === 'tap') $('#lp-score').textContent = `${L.n}/${LAMPO.tap.n}`;
    if (m === 'shake') $('#lp-score').textContent = `${Math.min(100, Math.round(100 * L.p / LAMPO.shake.n))}%`;
    if (m === 'barra') { const gz = $('.bar-g'), c = $('.bar-c'); gz.style.left = '39%'; gz.style.width = '22%'; c.style.left = `${50 + lampoBar() * 50}%`; }
    if (m === 'num') $('#lp-score').textContent = L.next <= 6 ? String(L.next) : '✓';
  }

  // premio del 1°: scegli 2 carte su 3
  function drawOffer(o) {
    const el = $('#mg-offer');
    if (!o) { el.classList.add('hidden'); offerSig = ''; return; }
    const sig = JSON.stringify(o);
    el.classList.remove('hidden');
    if (sig === offerSig) return;
    offerSig = sig; offerPick = [];
    el.innerHTML = `<p class="display">Scegli ${o.keep} carte</p><div class="offer-cards">${o.cards.map((id, i) => {
      const c = CARDS[id];
      return `<button type="button" class="card ${c.rar}" data-i="${i}" style="background:${c.color}"><span class="rar">${c.rar}</span><span class="nm">${esc(c.name)}</span></button>`;
    }).join('')}</div><button class="btn primary" type="button" id="offer-ok" disabled>PRENDI</button><p class="mg-sub">Se non scegli in tempo prendo le prime ${o.keep}</p>`;
    el.querySelectorAll('.offer-cards .card').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      if (offerPick.includes(i)) offerPick = offerPick.filter(x => x !== i);
      else { offerPick.push(i); if (offerPick.length > o.keep) offerPick.shift(); }
      el.querySelectorAll('.offer-cards .card').forEach(x => x.classList.toggle('target', offerPick.includes(Number(x.dataset.i))));
      el.querySelector('#offer-ok').disabled = offerPick.length !== o.keep;
    }));
    el.querySelector('#offer-ok').addEventListener('click', () => { send({ t: 'offer', pick: offerPick }); el.classList.add('hidden'); });
  }

  // scossa del telefono (Agita la lattina)
  let lastShake = 0;
  function shake(mag) {
    const t = now();
    if (!(mag > 12 && t - lastShake > 90)) return;
    lastShake = t;
    if (lampo && lampo.mission === 'shake' && !lampo.doneAt) { lampo.p += Math.min(6, (mag - 10) * 0.6); if (lampo.p >= LAMPO.shake.n) lampoFinish(); return; }
    addFill(Math.min(6, (mag - 10) * 0.6));
  }

  return { update, shake, active: () => !!((pit && g && g.game === 'lattina' && pit.stage === 'play') || (lampo && lampo.mission === 'shake' && !lampo.doneAt)) };
}

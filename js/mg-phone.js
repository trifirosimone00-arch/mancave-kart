// Minigiochi sul telefono. I giochi a riflessi girano qui (niente ritardo di rete):
// al PC arriva solo lo stato (punti, fatto, eliminato).
import {
  GAMES, BALLOON_TAPS, CAN_FULL, SEM_ROUNDS, semDelay, barRound, pmNumbers, chipPlan, quizRound,
} from './minigames.js';
import { CARDS } from './cards.js';

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ANS_COLORS = ['#e8322b', '#2f7bff', '#ffb000', '#2ec46b'];
const DOOR_COLORS = ['#e8322b', '#2f7bff', '#2ec46b'];
const now = () => performance.now();

export function createMgPhone({ root, send, vib }) {
  const $ = (sel) => root.querySelector(sel);
  let pit = null, pitAt = 0;         // ultimo stato del pit stop e quando è arrivato
  let g = null;                      // partita in corso { id, game, t0, s, ... }
  let lastSent = 0, sentSig = '';
  let offerSig = '', offerPick = [];
  let built = '';

  const elapsed = () => (g ? (now() - g.t0) / 1000 : 0);
  const buzz = (p) => { try { vib(p); } catch (e) { /* niente */ } };

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
    g = { id: p.id, game: p.game, seed: p.seed, dur: p.dur, t0: now() - (p.t || 0) * 1000, s: {}, ui: {} };
    const s = g.s;
    if (g.game === 'barra') { s.score = 0; s.round = 0; g.roundAt = now() + 600; g.wait = 0; }
    if (g.game === 'pallone') s.n = 0;
    if (g.game === 'lattina') s.p = 0;
    if (g.game === 'semaforo') { s.round = 0; s.total = 0; g.roundAt = now() + 800; g.state = 'wait'; }
    if (g.game === 'patatine') { s.score = 0; g.plan = chipPlan(g.seed, g.dur); g.taken = new Set(); }
    if (g.game === 'piumeno') { s.best = 0; s.cur = 0; g.nums = pmNumbers(g.seed); g.i = 0; }
    if (g.game === 'porta' || g.game === 'quiz') { s.ans = {}; s.at = {}; }
    build();
    report(true);
  }

  function over() { return !g || g.s.done || elapsed() >= g.dur && !GAMES[g.game].rounds; }

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
    } else if (k === 'semaforo') {
      body.innerHTML = `<button class="sem" type="button" id="mg-act"><b id="mg-light">ASPETTA…</b><small id="mg-score"></small></button>`;
    } else if (k === 'patatine') {
      body.innerHTML = `<div class="chips" id="mg-chips">${Array.from({ length: 9 }, (_, i) => `<button type="button" data-c="${i}"></button>`).join('')}</div><div class="mg-big side" id="mg-score">0</div>`;
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

  function bind() {
    const k = g.game;
    const act = $('#mg-act');
    const tap = (el, fn) => el && el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); });
    if (k === 'barra') tap(act, barStop);
    if (k === 'pallone') tap(act, () => { if (over() || g.s.popT != null) return; g.s.n++; if (g.s.n % 5 === 0) buzz(8); if (g.s.n >= BALLOON_TAPS) { g.s.popT = Math.round(elapsed() * 1000); g.s.done = 1; buzz([80, 40, 200]); } report(); });
    if (k === 'lattina') tap(act, () => addFoam(1.4));
    if (k === 'semaforo') tap(act, semTap);
    if (k === 'patatine') root.querySelectorAll('#mg-chips button').forEach(b => tap(b, () => chipTap(Number(b.dataset.c))));
    if (k === 'piumeno') { tap($('#mg-up'), () => pmGuess(true)); tap($('#mg-down'), () => pmGuess(false)); }
    if (k === 'porta') root.querySelectorAll('.pdoor').forEach(b => tap(b, () => answer(Number(b.dataset.d))));
    if (k === 'quiz') root.querySelectorAll('.pq-a button').forEach(b => tap(b, () => answer(Number(b.dataset.a))));
  }

  // ---------------------------------------------------------------- giochi
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

  function addFoam(v) {
    if (!g || g.game !== 'lattina' || over() || g.s.popT != null) return;
    g.s.p = Math.min(CAN_FULL, g.s.p + v);
    if (g.s.p >= CAN_FULL) { g.s.popT = Math.round(elapsed() * 1000); g.s.done = 1; buzz([80, 40, 200]); }
    report();
  }

  function semTap() {
    if (over()) return;
    const t = now();
    if (g.state === 'wait') {
      if (t < g.roundAt) return;               // pausa tra una manche e l'altra
      g.s.total += 1000; g.last = 'Troppo presto! +1s'; semNext();
      buzz([200]);
    } else if (g.state === 'go') {
      const ms = Math.round(t - g.goAt);
      g.s.total += ms; g.last = `${ms} ms`; semNext();
      buzz(30);
    }
  }
  function semNext() {
    g.s.round++;
    if (g.s.round >= SEM_ROUNDS) { g.s.done = 1; g.state = 'done'; } else { g.state = 'wait'; g.roundAt = now() + 1200; }
    report(true);
  }

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
  function frame() {
    requestAnimationFrame(frame);
    if (!pit || root.classList.contains('hidden')) return;
    const P = pit;
    const lt = P.stage === 'play' && g ? elapsed() : 0;
    // tempo in alto
    let time = '';
    if (P.stage === 'intro') time = `Si parte tra ${Math.max(1, Math.ceil(5 - P.stageT - (now() - pitAt) / 1000))}`;
    else if (P.stage === 'play' && GAMES[P.game].rounds) time = `${P.game === 'quiz' ? 'Domanda' : 'Manche'} ${P.round + 1}/${GAMES[P.game].rounds}`;
    else if (P.stage === 'play') time = `${Math.max(0, Math.ceil(P.dur - lt))}s`;
    $('#mg-time').textContent = time;
    if (P.stage !== 'play' || !g || g.id !== P.id) return;
    const s = g.s, k = g.game;
    const flash = g.flash && now() - g.flashAt < 800 ? g.flash : '';
    if (k === 'barra') {
      const { half } = barRound(s.round);
      const gz = $('.bar-g'), c = $('.bar-c');
      gz.style.left = `${50 - half * 50}%`; gz.style.width = `${half * 100}%`;
      c.style.left = `${50 + barPos() * 50}%`;
      c.style.opacity = s.out ? 0.3 : 1;
      $('#mg-score').textContent = flash || (s.out ? `Fuori! ${s.score} pt` : `${s.score} pt`);
      $('#mg-act').disabled = over();
    } else if (k === 'pallone' || k === 'lattina') {
      const f = k === 'pallone' ? s.n / BALLOON_TAPS : s.p / CAN_FULL;
      const vis = $('#mg-vis');
      if (k === 'pallone') vis.style.transform = `scale(${0.35 + f * 0.75})`;
      else vis.firstChild.style.height = `${Math.round(f * 100)}%`;
      vis.classList.toggle('pop', s.popT != null);
      $('#mg-score').textContent = s.popT != null ? (k === 'pallone' ? 'BOOM!' : 'SPLASH!') : `${Math.round(f * 100)}%`;
    } else if (k === 'semaforo') {
      const light = $('#mg-light'), btn = $('#mg-act');
      if (g.state === 'wait' && now() >= g.roundAt) {
        const goAt = g.roundAt + semDelay(g.seed, s.round) * 1000;
        if (now() >= goAt) { g.state = 'go'; g.goAt = goAt; buzz(40); }
      }
      if (g.state === 'go' && now() - g.goAt > 1500) { g.s.total += 1000; g.last = 'Troppo lento! +1s'; semNext(); }
      btn.className = 'sem ' + (g.state === 'go' ? 'go' : g.state === 'done' ? 'done' : now() < g.roundAt ? 'pause' : 'wait');
      light.textContent = g.state === 'go' ? 'ORA!' : g.state === 'done' ? 'FATTO!' : now() < g.roundAt ? (g.last || 'Pronti…') : 'ASPETTA…';
      $('#mg-score').textContent = `Manche ${Math.min(SEM_ROUNDS, s.round + (g.state === 'done' ? 0 : 1))}/${SEM_ROUNDS} · totale ${(s.total / 1000).toFixed(2)}s`;
    } else if (k === 'patatine') {
      const t = lt;
      const cells = root.querySelectorAll('#mg-chips button');
      const show = new Array(9).fill(null);
      g.plan.forEach((c, i) => { if (t >= c.at && t < c.at + c.life && !g.taken.has(i)) show[c.cell] = c.bad ? 'bad' : 'good'; });
      cells.forEach((b, i) => { b.className = show[i] || ''; });
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
    } else if (k === 'quiz') {
      const q = quizRound(g.seed, Math.max(0, P.round));
      const mine = s.ans[P.round];
      if (g.qr !== P.round) { g.qr = P.round; $('#mg-q').textContent = q.q; root.querySelectorAll('.pq-a button').forEach((b, i) => { b.textContent = q.answers[i]; }); }
      root.querySelectorAll('.pq-a button').forEach((b, i) => {
        b.classList.toggle('on', mine === i);
        b.classList.toggle('off', (mine != null && mine !== i) || (!!P.reveal && i !== P.reveal.correct));
        b.classList.toggle('ok', !!P.reveal && i === P.reveal.correct);
      });
    }
    // fine tempo: blocco il gioco
    if (!GAMES[k].rounds && lt >= g.dur && !s.done) { s.done = 1; report(true); }
    report();
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- stato dal PC
  function update(status) {
    const P = status.pit;
    pit = P; pitAt = now();
    if (!P) { g = null; return; }
    const G = GAMES[P.game];
    $('#mg-tag').textContent = `PIT STOP ${P.n}${P.of ? ' di ' + P.of : ''}`;
    $('#mg-title').textContent = G.title;
    const stageEl = $('#mg-stage');
    if (P.stage === 'play' && (!g || g.id !== P.id)) start(P);
    if (P.stage === 'intro') {
      stageEl.className = 'mg-stage';
      stageEl.innerHTML = `<p class="mg-help">${esc(G.help)}</p><p class="mg-sub">Guarda anche la TV · si parte tra poco</p>`;
    } else if (P.stage === 'play') {
      stageEl.className = 'mg-stage hidden';
      if (g && built !== g.id + g.game) build();
      const doneMsg = g && g.s.done && !G.rounds;
      $('#mg-body').classList.toggle('hidden', !!doneMsg);
      $('#mg-done').classList.toggle('hidden', !doneMsg);
      if (doneMsg) $('#mg-done').innerHTML = `<b>Fatto!</b><span>Guarda la TV per la classifica</span>`;
    } else {
      $('#mg-body').classList.add('hidden');
      $('#mg-done').classList.add('hidden');
      stageEl.className = 'mg-stage';
      const me = P.me;
      let html = me ? `<div class="mg-place">${me.place}°</div><p class="mg-help">${esc(me.prize.text)}</p>` : '<p class="mg-help">Classifica sulla TV</p>';
      if (P.stage === 'go' || P.stage === 'done') html += '<p class="mg-sub">Si riparte! Tieni pronto il volante</p>';
      stageEl.innerHTML = html;
    }
    if (P.stage === 'intro') { $('#mg-body').classList.add('hidden'); $('#mg-done').classList.add('hidden'); }
    drawOffer(status.offer);
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
    if (mag > 12 && t - lastShake > 90) { lastShake = t; addFoam(Math.min(6, (mag - 10) * 0.6)); }
  }

  return { update, shake, active: () => !!(pit && g && g.game === 'lattina' && pit.stage === 'play') };
}

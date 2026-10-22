// Pit stop sulla TV: spiegazione, gioco in corso, classifica e premi.
import { GAMES, PIT_INTRO, PIT_GO, TIE_INTRO, TIE_TAP, SEM_READY, SEM_FOUL, semDelay, DUEL_NAMES } from './minigames.js';

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOOR_COLORS = ['#e8322b', '#2f7bff', '#2ec46b'];
const ANS_COLORS = ['#e8322b', '#2f7bff', '#ffb000', '#2ec46b'];
const LETTERS = ['A', 'B', 'C', 'D'];

function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function drawPit(el, P, players) {
  if (!P) { el.innerHTML = ''; return; }
  const g = GAMES[P.game];
  const who = (slot) => players.find(p => p.slot === slot) || { name: '?', color: '#888' };
  const dot = (slot) => `<i class="pdot" style="background:${esc(who(slot).color)}"></i>`;
  let body = '';
  let timer = '';

  if (P.stage === 'intro') {
    timer = `<div class="pit-timer"><b>${Math.max(1, Math.ceil(PIT_INTRO - P.stageT))}</b><span>si comincia</span></div>`;
    body = `<p class="pit-help">${esc(g.help)}</p><p class="pit-sub">Si gioca col telefono</p>`;
  } else if (P.stage === 'play') {
    if (g.duel) {
      timer = `<div class="pit-timer"><b>${P.round + 1}</b><span>manche</span></div>`;
    } else if (g.rounds) {
      const left = P.reveal == null ? g.roundTime - P.roundT : 0;
      timer = `<div class="pit-timer"><b>${P.reveal == null ? Math.ceil(Math.max(0, left)) : '!'}</b><span>${P.game === 'quiz' ? 'domanda' : 'manche'} ${P.round + 1}/${P.rounds || g.rounds}</span></div>`;
    } else {
      timer = `<div class="pit-timer"><b>${clock(P.dur - P.t)}</b><span>tempo</span></div>`;
    }
    if (P.game === 'semaforo' && P.duel) {
      const t = P.roundT - SEM_READY, d = semDelay(P.seed, P.round);
      const light = P.reveal ? 'off' : t < 0 ? 'off' : t < d ? 'red' : 'green';
      body += `<div class="sem-tv"><div class="sem-lamp ${light}"><i></i><i></i><i></i></div><div class="duels">`;
      const res = P.reveal ? P.reveal.res : null;
      const pairs = res ? res : P.duel.pairs.filter(p => p.w == null).map(p => ({ a: p.a, b: p.b, kind: p.kind, sa: p.sa, sb: p.sb }));
      const ms = (v) => v >= SEM_FOUL ? (v === SEM_FOUL ? 'anticipo!' : '—') : `${v} ms`;
      for (const p of pairs) {
        const full = P.duel.pairs.find(q => (q.a === p.a && q.b === p.b)) || null;
        body += `<div class="duel"><div class="duel-k">${esc(DUEL_NAMES[p.kind] || '')}</div>`
          + `<div class="duel-p ${res && p.w === p.a ? 'win' : ''}" style="--c:${esc(who(p.a).color)}"><b>${esc(who(p.a).name)}</b><span>${res ? ms(p.ma) : full ? full.sa : ''}</span></div>`
          + '<div class="duel-vs">VS</div>'
          + `<div class="duel-p ${res && p.w === p.b ? 'win' : ''}" style="--c:${esc(who(p.b).color)}"><b>${esc(who(p.b).name)}</b><span>${res ? ms(p.mb) : full ? full.sb : ''}</span></div></div>`;
      }
      if (P.duel.bye != null && P.duel.phase === 1) body += `<div class="duel bye">${esc(who(P.duel.bye).name)} aspetta in finale</div>`;
      body += '</div></div>';
      if (!res) body += '<p class="pit-sub">Chi tocca prima del verde perde la manche</p>';
    }
    if (P.game === 'quiz' && P.round >= 0 && P.qs) {
      const q = P.qs[P.round];
      const picks = (P.reveal && P.reveal.picks) || {};
      body += `<div class="quiz"><div class="quiz-cat">${esc(q.cat)}</div><div class="quiz-q">${esc(q.q)}</div><div class="quiz-a">`;
      q.answers.forEach((a, i) => {
        const cls = P.reveal ? (i === P.reveal.correct ? 'ok' : 'no') : '';
        const who2 = Object.entries(picks).filter(([, v]) => v === i).map(([s]) => dot(Number(s))).join('');
        body += `<div class="qa ${cls}" style="--c:${ANS_COLORS[i]}"><b>${LETTERS[i]}</b><span>${esc(a)}</span><em>${who2}</em></div>`;
      });
      body += '</div></div>';
    }
    if (P.game === 'porta' && P.round >= 0) {
      const picks = (P.reveal && P.reveal.picks) || {};
      body += '<div class="doors">';
      for (let i = 0; i < 3; i++) {
        const who2 = Object.entries(picks).filter(([, v]) => v === i).map(([s]) => dot(Number(s))).join('');
        const cls = P.reveal ? (P.reveal.lone[i] ? 'ok' : 'no') : '';
        body += `<div class="door ${cls}" style="--c:${DOOR_COLORS[i]}"><b>${i + 1}</b><em>${who2}</em>${P.reveal && P.reveal.lone[i] ? '<span>+1</span>' : ''}</div>`;
      }
      body += '</div>';
      if (!P.reveal) body += '<p class="pit-sub">Scegliete una porta sul telefono…</p>';
    }
    body += '<div class="pit-live">';
    for (const r of P.live || []) {
      const p = who(r.slot);
      body += `<div class="pl ${r.out ? 'out' : ''} ${r.done ? 'done' : ''}" style="--c:${esc(p.color)}"><div class="pl-n">${esc(p.name)}</div>`
        + `<div class="pl-bar"><i style="width:${Math.round((r.bar || 0) * 100)}%"></i></div><div class="pl-l">${esc(r.label)}</div></div>`;
    }
    body += '</div>';
  } else if (P.stage === 'tie') {
    const tapping = P.stageT >= TIE_INTRO;
    timer = `<div class="pit-timer"><b>${tapping ? Math.max(0, Math.ceil(TIE_INTRO + TIE_TAP - P.stageT)) : '!'}</b><span>spareggio</span></div>`;
    body += `<p class="pit-help">${tapping ? 'TOCCA A RAFFICA!' : 'Pari merito! Spareggio lampo: 5 secondi di tap'}</p><div class="pit-live">`;
    const max = Math.max(10, ...Object.values(P.tieLive || {}));
    for (const slot of P.tie.slots) {
      const p = who(slot), n = (P.tieLive || {})[slot] || 0;
      body += `<div class="pl" style="--c:${esc(p.color)}"><div class="pl-n">${esc(p.name)}</div><div class="pl-bar"><i style="width:${Math.round(100 * n / max)}%"></i></div><div class="pl-l">${n} tap</div></div>`;
    }
    body += '</div>';
  } else if (P.stage === 'results' || P.stage === 'go' || P.stage === 'done') {
    if (P.stage === 'go' || P.stage === 'done') timer = `<div class="pit-timer go"><b>${Math.max(1, Math.ceil(PIT_GO - P.stageT))}</b><span>si riparte</span></div>`;
    body += '<div class="pit-res">';
    for (const r of P.results || []) {
      const p = who(r.slot);
      body += `<div class="pr p${r.place}" style="--c:${esc(p.color)}"><div class="pr-pl">${r.place}°</div><div class="pr-n">${esc(p.name)}<small>${esc(r.label)}${r.tie != null ? ` · spareggio ${r.tie} tap` : ''}</small></div><div class="pr-prize">${esc(r.prize.text)}</div></div>`;
    }
    body += '</div><p class="pit-sub">Chi ha vinto sceglie le carte sul telefono</p>';
  }

  el.innerHTML = `<div class="pit-box">
    <div class="pit-head"><div><div class="pit-tag">PIT STOP ${P.n}${P.of ? ' di ' + P.of : ''} · ${esc(g.kind)}</div><h2 class="pit-title">${esc(g.title)}</h2></div>${timer}</div>
    ${body}
    <div class="pit-foot">La gara è in pausa · si riparte dalle posizioni di adesso</div>
  </div>`;
}

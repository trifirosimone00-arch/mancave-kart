// Pit stop e minigiochi: regole condivise da PC, schermi e telefoni.
// I minigiochi "a riflessi" girano sul telefono (niente ritardo di rete): il telefono
// manda solo il suo stato (punti, fatto/eliminato). Porta segreta e Quiz vanno a manche
// decise dal PC principale.

export const PIT_FRACTION = 0.56;        // dove si trova il pit stop nel giro
export const PIT_INTRO = 5;              // spiegazione del minigioco
export const PIT_RESULTS = 9;            // classifica e scelta dei premi
export const PIT_GO = 3;                 // "si riparte" 3-2-1

// giri con un pit stop: uno per giro, massimo 3
export function pitLaps(laps) {
  if (laps <= 3) return Array.from({ length: laps }, (_, i) => i + 1);
  return [1, 3, 5].filter(l => l <= laps);
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GAMES = {
  barra: {
    title: 'Ferma la barra!', kind: 'Riflessi', dur: 60,
    help: 'Premi STOP quando il cursore è nella zona verde. Più sei vicino al centro, più punti fai. Se lo manchi sei fuori.',
    phone: 'Tocca STOP quando il cursore è nel verde',
  },
  pallone: {
    title: 'Gonfia il pallone!', kind: 'Riflessi', dur: 45,
    help: 'Tocca a raffica il telefono: chi fa scoppiare il pallone per primo vince.',
    phone: 'Tocca più veloce che puoi!',
  },
  semaforo: {
    title: 'Semaforo', kind: 'Riflessi', dur: 60,
    help: '5 manche: quando il semaforo diventa verde tocca subito. Chi anticipa prende 1 secondo di penalità. Vince il tempo totale più basso.',
    phone: 'Aspetta il verde, poi tocca!',
  },
  patatine: {
    title: 'Acchiappa le patatine', kind: 'Riflessi', dur: 35,
    help: 'Tocca le patatine buone (+1) ed evita quelle bruciate (−2).',
    phone: 'Buone +1 · bruciate −2',
  },
  lattina: {
    title: 'Agita la lattina', kind: 'Fisico', dur: 40,
    help: 'Scuoti il telefono (o tocca a raffica): chi fa esplodere la schiuma per primo vince.',
    phone: 'Scuoti il telefono!',
  },
  piumeno: {
    title: 'Più o meno', kind: 'Bluff', dur: 45,
    help: 'Esce un numero da 1 a 100: indovina se il prossimo è più alto o più basso. Vince la serie più lunga.',
    phone: 'Il prossimo numero è più alto o più basso?',
  },
  porta: {
    title: 'Porta segreta', kind: 'Bluff', dur: 0, rounds: 8, roundTime: 5, revealTime: 2,
    help: '8 manche con 3 porte: scegli una porta. Se sei l\'unico ad averla scelta prendi 1 punto.',
    phone: 'Scegli una porta: vince chi resta da solo',
  },
  quiz: {
    title: 'Quiz', kind: 'Quiz', dur: 0, rounds: 6, roundTime: 9, revealTime: 3,
    help: '6 domande: rispondi dal telefono. Giusta: 10 punti più un bonus se sei veloce. Sbagliata: −5.',
    phone: 'Leggi la domanda sulla TV e rispondi qui',
  },
};
export const GAME_IDS = Object.keys(GAMES);

export function gameDuration(id) {
  const g = GAMES[id];
  if (g.rounds) return g.rounds * (g.roundTime + g.revealTime);
  return g.dur;
}

// ------------------------------------------------------------------ parametri condivisi dei singoli giochi
export const BALLOON_TAPS = 70;
export const CAN_FULL = 100;
export const SEM_ROUNDS = 5;
export function semDelay(seed, round) { return 1.4 + rng(seed + round * 977)() * 2.6; }
// barra: velocità (giri al secondo) e mezza zona verde (0..1) per manche
export function barRound(r) { return { speed: 0.55 + r * 0.16, half: Math.max(0.05, 0.2 * Math.pow(0.86, r)) }; }
// sequenza di numeri per Più o meno (mai due uguali di fila)
export function pmNumbers(seed, n = 200) {
  const R = rng(seed), out = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    let v; do { v = 1 + Math.floor(R() * 100); } while (v === last);
    out.push(v); last = v;
  }
  return out;
}
// patatine: elenco di comparse { at, cell, bad }
export function chipPlan(seed, dur) {
  const R = rng(seed), out = [];
  for (let t = 0.6; t < dur; t += 0.38 + R() * 0.3) out.push({ at: t, cell: Math.floor(R() * 9), bad: R() < 0.28, life: 0.95 + R() * 0.35 });
  return out;
}

// ------------------------------------------------------------------ quiz
// a = risposta giusta (la prima), b = categoria
export const QUIZ = [
  ['Qual è la capitale dell\'Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Perth'], 'Cultura'],
  ['Qual è il pianeta più grande del sistema solare?', ['Giove', 'Saturno', 'Nettuno', 'Terra'], 'Cultura'],
  ['Chi ha dipinto la Gioconda?', ['Leonardo da Vinci', 'Michelangelo', 'Raffaello', 'Caravaggio'], 'Cultura'],
  ['Qual è il simbolo chimico dell\'oro?', ['Au', 'Ag', 'Or', 'Go'], 'Cultura'],
  ['Qual è il fiume più lungo d\'Italia?', ['Po', 'Tevere', 'Adige', 'Arno'], 'Cultura'],
  ['Quanti lati ha un esagono?', ['6', '5', '7', '8'], 'Cultura'],
  ['In che anno è caduto il Muro di Berlino?', ['1989', '1991', '1985', '1979'], 'Cultura'],
  ['Qual è la montagna più alta del mondo?', ['Everest', 'K2', 'Monte Bianco', 'Kilimangiaro'], 'Cultura'],
  ['Chi ha scritto la Divina Commedia?', ['Dante Alighieri', 'Francesco Petrarca', 'Giovanni Boccaccio', 'Alessandro Manzoni'], 'Cultura'],
  ['Qual è la capitale del Canada?', ['Ottawa', 'Toronto', 'Montréal', 'Vancouver'], 'Cultura'],
  ['Quante zampe ha un ragno?', ['8', '6', '10', '12'], 'Cultura'],
  ['Qual è l\'oceano più grande?', ['Pacifico', 'Atlantico', 'Indiano', 'Artico'], 'Cultura'],
  ['Qual è il gas più abbondante nell\'aria?', ['Azoto', 'Ossigeno', 'Anidride carbonica', 'Argon'], 'Cultura'],
  ['Che lingua si parla in Brasile?', ['Portoghese', 'Spagnolo', 'Brasiliano', 'Inglese'], 'Cultura'],
  ['Bari è il capoluogo di quale regione?', ['Puglia', 'Basilicata', 'Calabria', 'Molise'], 'Cultura'],
  ['Quanti minuti ci sono in un giorno?', ['1440', '1240', '1340', '1640'], 'Cultura'],
  ['Qual è l\'isola più grande del Mediterraneo?', ['Sicilia', 'Sardegna', 'Cipro', 'Corsica'], 'Cultura'],
  ['Chi ha scoperto la penicillina?', ['Alexander Fleming', 'Louis Pasteur', 'Marie Curie', 'Robert Koch'], 'Cultura'],
  ['Quanti Mondiali ha vinto l\'Italia?', ['4', '3', '5', '2'], 'Calcio'],
  ['In quale paese si sono giocati i Mondiali 2006?', ['Germania', 'Francia', 'Italia', 'Sudafrica'], 'Calcio'],
  ['Chi ha vinto i Mondiali 2022?', ['Argentina', 'Francia', 'Croazia', 'Brasile'], 'Calcio'],
  ['Quanti giocatori ha in campo una squadra?', ['11', '10', '9', '12'], 'Calcio'],
  ['Quale squadra italiana ha vinto più Champions League?', ['Milan', 'Inter', 'Juventus', 'Roma'], 'Calcio'],
  ['In quale stadio giocano Roma e Lazio?', ['Olimpico', 'San Siro', 'Maradona', 'Franchi'], 'Calcio'],
  ['Come è soprannominata la Juventus?', ['Vecchia Signora', 'Il Diavolo', 'La Lupa', 'Il Biscione'], 'Calcio'],
  ['Quanto dura una partita senza recupero?', ['90 minuti', '80 minuti', '100 minuti', '120 minuti'], 'Calcio'],
  ['Chi ha vinto l\'Europeo giocato nel 2021?', ['Italia', 'Inghilterra', 'Spagna', 'Francia'], 'Calcio'],
  ['A chi è intitolato lo stadio del Napoli?', ['Diego Armando Maradona', 'Pelé', 'Zico', 'Careca'], 'Calcio'],
  ['In che ruolo giocava Gianluigi Buffon?', ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'], 'Calcio'],
  ['Di che paese è Cristiano Ronaldo?', ['Portogallo', 'Spagna', 'Brasile', 'Argentina'], 'Calcio'],
  ['Quanti punti vale una vittoria in Serie A?', ['3', '2', '1', '4'], 'Calcio'],
  ['In che paese è nato Lionel Messi?', ['Argentina', 'Spagna', 'Uruguay', 'Brasile'], 'Calcio'],
  ['Come si chiama il fratello di Mario?', ['Luigi', 'Wario', 'Toad', 'Yoshi'], 'Videogiochi e film'],
  ['Di che colore è Sonic?', ['Blu', 'Rosso', 'Verde', 'Giallo'], 'Videogiochi e film'],
  ['In Minecraft, quale mostro esplode?', ['Creeper', 'Zombie', 'Scheletro', 'Enderman'], 'Videogiochi e film'],
  ['Quale azienda produce la PlayStation?', ['Sony', 'Microsoft', 'Nintendo', 'Sega'], 'Videogiochi e film'],
  ['Qual è il Pokémon inseparabile di Ash nel cartone?', ['Pikachu', 'Charmander', 'Bulbasaur', 'Squirtle'], 'Videogiochi e film'],
  ['Chi ha diretto Titanic (1997)?', ['James Cameron', 'Steven Spielberg', 'Christopher Nolan', 'Ridley Scott'], 'Videogiochi e film'],
  ['In quale casa di Hogwarts è Harry Potter?', ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'], 'Videogiochi e film'],
  ['Chi interpreta Iron Man nei film Marvel?', ['Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo'], 'Videogiochi e film'],
  ['Come si chiama il protagonista del Re Leone?', ['Simba', 'Mufasa', 'Scar', 'Nala'], 'Videogiochi e film'],
  ['Che lavoro fa Super Mario?', ['Idraulico', 'Muratore', 'Elettricista', 'Cuoco'], 'Videogiochi e film'],
  ['In Star Wars, chi è il padre di Luke Skywalker?', ['Darth Vader', 'Obi-Wan Kenobi', 'Yoda', 'Han Solo'], 'Videogiochi e film'],
  ['Quale di queste console è di Nintendo?', ['Switch', 'Xbox', 'PlayStation', 'Dreamcast'], 'Videogiochi e film'],
  ['Come si chiama il cowboy di Toy Story?', ['Woody', 'Buzz', 'Rex', 'Slinky'], 'Videogiochi e film'],
  ['In che città vivono i Simpson?', ['Springfield', 'Shelbyville', 'Quahog', 'South Park'], 'Videogiochi e film'],
  ['A quale città è ispirata Los Santos di GTA V?', ['Los Angeles', 'Las Vegas', 'Miami', 'New York'], 'Videogiochi e film'],
  ['Chi ha diretto Il Padrino?', ['Francis Ford Coppola', 'Martin Scorsese', 'Sergio Leone', 'Quentin Tarantino'], 'Videogiochi e film'],
];
// le domande della partita: ordine e risposte mescolate, uguali per tutti
export function quizRound(seed, r) {
  const R = rng(seed);
  const order = QUIZ.map((_, i) => i).sort(() => R() - 0.5);
  const [q, ans, cat] = QUIZ[order[r % order.length]];
  const R2 = rng(seed + 31 * (r + 1));
  const idx = [0, 1, 2, 3].sort(() => R2() - 0.5);
  return { q, cat, answers: idx.map(i => ans[i]), correct: idx.indexOf(0) };
}

// ------------------------------------------------------------------ classifica
// entries: [{ slot, s }] dove s è lo stato riportato (o null se non ha giocato)
// ritorna [{ slot, place, label, score }] con parità = stesso posto
export function rankGame(game, entries, pit) {
  const key = (e) => {
    const s = e.s || {};
    switch (game) {
      case 'barra': return [s.score || 0];
      case 'pallone': return s.popT != null ? [1, -s.popT] : [0, s.n || 0];
      case 'lattina': return s.popT != null ? [1, -s.popT] : [0, s.p || 0];
      case 'semaforo': return [s.round || 0, -(s.total || 0)];
      case 'patatine': return [s.score || 0];
      case 'piumeno': return [s.best || 0];
      case 'porta': case 'quiz': return [(pit && pit.pts && pit.pts[e.slot]) || 0];
    }
    return [0];
  };
  const list = entries.map(e => ({ ...e, k: key(e) }));
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.k.length, b.k.length); i++) { const d = (b.k[i] || 0) - (a.k[i] || 0); if (Math.abs(d) > 1e-9) return d; } return 0; };
  list.sort(cmp);
  let place = 0;
  return list.map((e, i) => {
    if (i === 0 || cmp(list[i - 1], e) !== 0) place = i + 1;
    return { slot: e.slot, place, label: liveLabel(game, e.s, pit, e.slot) };
  });
}

// testo breve per la TV (durante e dopo il gioco)
export function liveLabel(game, s, pit, slot) {
  s = s || {};
  switch (game) {
    case 'barra': return `${s.score || 0} pt${s.out ? ' · fuori' : ''}`;
    case 'pallone': return s.popT != null ? `BOOM! ${(s.popT / 1000).toFixed(1)}s` : `${Math.round(100 * (s.n || 0) / BALLOON_TAPS)}%`;
    case 'lattina': return s.popT != null ? `SPLASH! ${(s.popT / 1000).toFixed(1)}s` : `${Math.round(s.p || 0)}%`;
    case 'semaforo': return s.round ? `${s.round}/${SEM_ROUNDS} · ${((s.total || 0) / 1000).toFixed(2)}s` : 'pronto…';
    case 'patatine': return `${s.score || 0} patatine`;
    case 'piumeno': return `serie ${s.best || 0}${s.cur ? ` (ora ${s.cur})` : ''}`;
    case 'porta': case 'quiz': return `${(pit && pit.pts && pit.pts[slot]) || 0} pt`;
  }
  return '';
}
// barra 0..1 per la TV
export function liveBar(game, s, pit, slot, maxPts) {
  s = s || {};
  switch (game) {
    case 'pallone': return s.popT != null ? 1 : Math.min(1, (s.n || 0) / BALLOON_TAPS);
    case 'lattina': return s.popT != null ? 1 : Math.min(1, (s.p || 0) / CAN_FULL);
    case 'semaforo': return (s.round || 0) / SEM_ROUNDS;
    case 'barra': return Math.min(1, (s.score || 0) / Math.max(300, maxPts || 0));
    case 'patatine': return Math.min(1, Math.max(0, s.score || 0) / Math.max(20, maxPts || 0));
    case 'piumeno': return Math.min(1, (s.best || 0) / Math.max(6, maxPts || 0));
    case 'porta': case 'quiz': { const v = (pit && pit.pts && pit.pts[slot]) || 0; return Math.min(1, Math.max(0, v) / Math.max(1, maxPts || 1)); }
  }
  return 0;
}

// ------------------------------------------------------------------ premi
// posto nel minigioco -> premio (l'ultimo non prende niente e riparte dopo)
export function prizeFor(place, n) {
  if (place === 1) return { draw: 3, keep: 2, rare: true, boost: 2, text: 'Pesca 3 carte e ne tiene 2 · turbo alla partenza' };
  if (n >= 3 && place === n) return { draw: 0, keep: 0, wait: 1, text: 'Niente carte · riparte 1 secondo dopo' };
  if (n === 2 && place === 2) return { draw: 0, keep: 0, wait: 1, text: 'Niente carte · riparte 1 secondo dopo' };
  if (place === 2) return { draw: 2, keep: 2, text: 'Pesca 2 carte' };
  return { draw: 1, keep: 1, text: 'Pesca 1 carta' };
}

// ------------------------------------------------------------------ piloti del computer (e tastiera) nei minigiochi
const CPU_MG = {
  facile:    { tap: 5.5, hit: 0.7, react: [0.36, 0.55], foul: 0.08, chip: 0.55, guess: 0.6, quiz: 0.45 },
  normale:   { tap: 7.0, hit: 0.82, react: [0.28, 0.42], foul: 0.05, chip: 0.7, guess: 0.68, quiz: 0.62 },
  difficile: { tap: 8.6, hit: 0.9, react: [0.21, 0.32], foul: 0.03, chip: 0.85, guess: 0.75, quiz: 0.8 },
};
export function cpuMgNew(level, seed) { return { L: CPU_MG[level] || CPU_MG.normale, R: rng(seed), t: 0, s: {}, next: 0.8, ans: {} }; }
// avanza di dt secondi; t = tempo di gioco. Ritorna lo stato da riportare.
export function cpuMgTick(b, game, dt, pit) {
  const L = b.L, R = b.R, s = b.s;
  b.t += dt;
  switch (game) {
    case 'pallone': case 'lattina': {
      if (s.popT != null) break;
      const rate = L.tap * (0.85 + R() * 0.3) * (game === 'lattina' ? 2.2 : 1);
      if (game === 'pallone') { b.n = (b.n || 0) + rate * dt; if (b.n >= BALLOON_TAPS) { b.n = BALLOON_TAPS; s.popT = Math.round(b.t * 1000); s.done = 1; } s.n = Math.floor(b.n); }
      else { s.p = (s.p || 0) + rate * dt; if (s.p >= CAN_FULL) { s.p = CAN_FULL; s.popT = Math.round(b.t * 1000); s.done = 1; } }
      break;
    }
    case 'barra': {
      if (s.out || b.t < b.next) break;
      const r = s.round || 0;
      const p = L.hit * Math.pow(0.88, r);
      if (R() < p) { s.score = (s.score || 0) + Math.round(40 + R() * 60); s.round = r + 1; b.next = b.t + 1.6 + R() * 1.2; }
      else { s.out = 1; s.done = 1; }
      break;
    }
    case 'semaforo': {
      if (s.done || b.t < b.next) break;
      const r = s.round || 0;
      const foul = R() < L.foul;
      const ms = foul ? 1000 : Math.round(1000 * (L.react[0] + R() * (L.react[1] - L.react[0])));
      s.total = (s.total || 0) + ms; s.round = r + 1;
      if (s.round >= SEM_ROUNDS) s.done = 1;
      b.next = b.t + 1 + semDelay(pit.seed, r + 1) + ms / 1000;
      break;
    }
    case 'patatine': {
      if (b.t < b.next) break;
      if (R() < L.chip) s.score = (s.score || 0) + 1; else if (R() < 0.25) s.score = (s.score || 0) - 2;
      b.next = b.t + 0.5 + R() * 0.35;
      break;
    }
    case 'piumeno': {
      if (b.t < b.next) break;
      if (R() < L.guess) { s.cur = (s.cur || 0) + 1; s.best = Math.max(s.best || 0, s.cur); } else s.cur = 0;
      b.next = b.t + 1 + R() * 1.2;
      break;
    }
    case 'porta': {
      const r = pit.round;
      if (r >= 0 && b.ans[r] == null && pit.stage === 'play' && pit.reveal == null && R() < dt * 0.8) b.ans[r] = Math.floor(R() * 3);
      s.ans = b.ans;
      break;
    }
    case 'quiz': {
      const r = pit.round;
      if (r >= 0 && b.ans[r] == null && pit.reveal == null && pit.roundT > 2.5 + R() * 4) {
        const q = quizRound(pit.seed, r);
        b.ans[r] = R() < L.quiz ? q.correct : (q.correct + 1 + Math.floor(R() * 3)) % 4;
        b.at = b.at || {}; b.at[r] = Math.round(pit.roundT * 1000);
      }
      s.ans = b.ans; s.at = b.at;
      break;
    }
  }
  return s;
}

// Pit stop e minigiochi: regole condivise da PC, schermi e telefoni.
// I minigiochi "a riflessi" girano sul telefono (niente ritardo di rete): il telefono
// manda solo il suo stato (punti, fatto/eliminato). Porta segreta, Quiz e Semaforo
// vanno a manche decise dal PC principale.

export const PIT_FRACTION = 0.56;        // dove si trova il pit stop nel giro
export const PIT_INTRO = 10;             // spiegazione del minigioco (si salta col tasto SALTA)
export const PIT_COUNT = 3;              // 3-2-1 prima di giocare
export const PIT_RESULTS = 8;            // classifica e scelta dei premi (si salta)
export const PIT_GO = 3;                 // "si riparte" 3-2-1 VIA!
export const PIT_MIN_SKIP = 1.5;         // anche saltando, almeno questo tempo a schermo
export const LAMPO_CHANCE = 0.34;        // probabilità che un pit stop sia un minigioco lampo
export const LAMPO_MAX = 20;             // dopo questo tempo riparte anche chi non ha finito
export const TIE_INTRO = 2;              // spareggio: "pronti"
export const TIE_TAP = 5;                // spareggio: 5 secondi di tap

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
function shuffle(arr, R) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// dur = durata nella versione da 1 minuto, short = versione da 30 secondi
export const GAMES = {
  barra: {
    title: 'Ferma la barra!', kind: 'Riflessi', dur: 60, short: 30,
    help: 'Premi STOP quando il cursore è nella zona verde. Più sei vicino al centro, più punti fai. Se lo manchi sei fuori.',
  },
  pallone: {
    title: 'Gonfia il pallone!', kind: 'Riflessi', dur: 45, short: 30,
    help: 'Tocca a raffica il telefono: chi fa scoppiare il pallone per primo vince.',
  },
  semaforo: {
    title: 'Semaforo', kind: 'Riflessi', duel: true, revealTime: 2.5,
    help: 'Duelli a coppie stile far west: quando il semaforo diventa verde tocca per primo. Chi anticipa perde la manche. Chi vince passa in finale.',
  },
  patatine: {
    title: 'Acchiappa le patatine', kind: 'Riflessi', dur: 35, short: 25,
    help: 'Tocca le patatine buone (+1) ed evita quelle bruciate (−2).',
  },
  lattina: {
    title: 'Agita la lattina', kind: 'Fisico', dur: 40, short: 30,
    help: 'Scuoti il telefono (o tocca a raffica): chi fa esplodere la schiuma per primo vince.',
  },
  labirinto: {
    title: 'Labirinto', kind: 'Fisico', dur: 60, short: 30,
    help: 'Inclina il telefono per portare la pallina alla bandiera senza cadere nei buchi. Se non hai il sensore, trascina il dito.',
  },
  regata: {
    title: 'Regata nel lavandino', kind: 'Fisico', dur: 45, short: 30,
    help: 'Soffia nel microfono del telefono per spingere la vela della barchetta. Senza microfono si rema toccando.',
  },
  piumeno: {
    title: 'Più o meno', kind: 'Bluff', dur: 45, short: 30,
    help: 'Esce un numero da 1 a 100: indovina se il prossimo è più alto o più basso. Vince la serie più lunga.',
  },
  porta: {
    title: 'Porta segreta', kind: 'Bluff', rounds: 8, shortRounds: 4, roundTime: 5, revealTime: 2,
    help: 'Manche con 3 porte: scegli una porta. Se sei l\'unico ad averla scelta prendi 1 punto.',
  },
  quiz: {
    title: 'Quiz', kind: 'Quiz', rounds: 6, shortRounds: 3, roundTime: 9, revealTime: 3,
    help: 'Rispondi dal telefono. Giusta: 10 punti più un bonus se sei veloce. Sbagliata: −5.',
  },
};
export const GAME_IDS = Object.keys(GAMES);

export function gameRounds(id, short) { const g = GAMES[id]; return short ? g.shortRounds || g.rounds : g.rounds; }
export function gameDuration(id, short) {
  const g = GAMES[id];
  if (g.duel) return 0;
  if (g.rounds) return gameRounds(id, short) * (g.roundTime + g.revealTime);
  return short ? g.short : g.dur;
}

// minigiochi lampo: missione veloce, chi la finisce riparte subito
export const LAMPO = {
  tap:   { title: 'Tocca 25 volte!', short: 'TOCCA 25 VOLTE', n: 25 },
  barra: { title: 'Ferma la barra nel verde!', short: 'FERMA LA BARRA' },
  num:   { title: 'Tocca i numeri da 1 a 6 in ordine!', short: 'NUMERI 1-6', n: 6 },
  shake: { title: 'Scuoti il telefono (o tocca)!', short: 'SCUOTI!', n: 40 },
};
export const LAMPO_IDS = Object.keys(LAMPO);
// tempo (secondi) che ci mette un computer
export function cpuLampoTime(level, R) {
  const [a, b] = level === 'facile' ? [6, 9] : level === 'difficile' ? [3, 4.5] : [4, 6.5];
  return a + R() * (b - a);
}
// numeri della missione "num": posizioni mescolate su una griglia 3x2
export function lampoNumbers(seed) { return shuffle([1, 2, 3, 4, 5, 6], rng(seed + 3)); }

// stato ridotto per disegnare il gioco di ognuno sulla TV
export function liveState(game, s) {
  s = s || {};
  switch (game) {
    case 'barra': return { c: s.v ? s.v.c : 0, h: s.v ? s.v.h : 0.2, out: s.out ? 1 : 0 };
    case 'labirinto': return { x: s.v ? s.v.x : 0.5, y: s.v ? s.v.y : 0.5 };
    case 'pallone': return { n: s.n || 0 };
    case 'lattina': case 'regata': return { p: s.p || 0 };
    case 'piumeno': return { i: s.i || 0, cur: s.cur || 0 };
    case 'patatine': return { score: s.score || 0 };
  }
  return {};
}

// ------------------------------------------------------------------ parametri condivisi dei singoli giochi
export const BALLOON_TAPS = 70;
export const CAN_FULL = 100;
export const SEM_READY = 1;              // "pronti" prima dell'attesa
export const SEM_WINDOW = 2.2;           // secondi per toccare dopo il verde
export const SEM_FOUL = 9000, SEM_NONE = 9999;
export function semDelay(seed, round) { return 1.4 + rng(seed + round * 977)() * 2.6; }
export function semRoundTime(seed, round) { return SEM_READY + semDelay(seed, round) + SEM_WINDOW; }
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

// ------------------------------------------------------------------ labirinto
// muri: right[y][x] = muro a destra della cella, down[y][x] = muro sotto
export function makeMaze(seed, short) {
  const W = short ? 7 : 9, H = short ? 4 : 5;
  const R = rng(seed + 77);
  const right = Array.from({ length: H }, () => Array(W).fill(true));
  const down = Array.from({ length: H }, () => Array(W).fill(true));
  const seen = Array.from({ length: H }, () => Array(W).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[ny][nx]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(R() * nb.length)];
    if (dx === 1) right[y][x] = false; else if (dx === -1) right[y][nx] = false;
    else if (dy === 1) down[y][x] = false; else down[ny][x] = false;
    seen[ny][nx] = true;
    stack.push([nx, ny]);
  }
  // qualche passaggio in più, così non c'è una strada sola
  for (let i = 0; i < Math.floor(W * H / 9); i++) {
    const x = Math.floor(R() * (W - 1)), y = Math.floor(R() * H);
    right[y][x] = false;
  }
  const M = { W, H, right, down, start: { x: 0, y: 0 }, exit: { x: W - 1, y: H - 1 } };
  M.dist = mazeDist(M, M.exit);
  M.total = M.dist[0][0];
  // buchi: solo fuori dalla strada giusta (non bloccano mai l'uscita)
  const path = new Set();
  let cx = 0, cy = 0;
  path.add('0,0');
  while (cx !== M.exit.x || cy !== M.exit.y) {
    const d = M.dist[cy][cx];
    for (const [dx, dy, dir] of [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']]) {
      if (!mazeWall(M, cx, cy, dir) && M.dist[cy + dy][cx + dx] === d - 1) { cx += dx; cy += dy; break; }
    }
    path.add(cx + ',' + cy);
  }
  const free = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!path.has(x + ',' + y)) free.push({ x, y });
  M.holes = shuffle(free, R).slice(0, short ? 3 : 5);
  return M;
}
export function mazeWall(M, x, y, dir) {
  if (dir === 'r') return x >= M.W - 1 || M.right[y][x];
  if (dir === 'l') return x <= 0 || M.right[y][x - 1];
  if (dir === 'd') return y >= M.H - 1 || M.down[y][x];
  return y <= 0 || M.down[y - 1][x];
}
function mazeDist(M, to) {
  const d = Array.from({ length: M.H }, () => Array(M.W).fill(Infinity));
  d[to.y][to.x] = 0;
  const q = [[to.x, to.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy, dir] of [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']]) {
      if (mazeWall(M, x, y, dir)) continue;
      const nx = x + dx, ny = y + dy;
      if (d[ny][nx] > d[y][x] + 1) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); }
    }
  }
  return d;
}

// ------------------------------------------------------------------ semaforo a duelli
// fase 1: semifinali (con 3 giocatori uno aspetta direttamente in finale), fase 2: finale e finalina
export function duelStart(slots, seed, short) {
  const order = shuffle([...slots], rng(seed + 5));
  const D = { need: short ? 1 : 2, phase: 1, pairs: [], bye: null, place: {}, over: false };
  if (order.length <= 1) { if (order.length) D.place[order[0]] = 1; D.over = true; return D; }
  const pair = (a, b, kind) => ({ a, b, kind, sa: 0, sb: 0, ta: 0, tb: 0, n: 0, w: null });
  if (order.length === 2) { D.phase = 2; D.pairs = [pair(order[0], order[1], 'final')]; }
  else if (order.length === 3) { D.pairs = [pair(order[0], order[1], 'semi')]; D.bye = order[2]; }
  else D.pairs = [pair(order[0], order[1], 'semi'), pair(order[2], order[3], 'semi')];
  return D;
}
export function duelPairOf(D, slot) { return D ? D.pairs.find(p => p.w == null && (p.a === slot || p.b === slot)) || null : null; }
// ms: { slot: millisecondi } (SEM_FOUL = ha anticipato, mancante = non ha toccato)
export function duelRound(D, ms) {
  const res = [];
  for (const p of D.pairs) {
    if (p.w != null) continue;
    const ma = ms[p.a] ?? SEM_NONE, mb = ms[p.b] ?? SEM_NONE;
    let w = null;
    if (ma < mb && ma < SEM_FOUL) w = p.a;
    else if (mb < ma && mb < SEM_FOUL) w = p.b;
    else if (ma === SEM_FOUL && mb === SEM_NONE) w = null;
    if (w === p.a) p.sa++; else if (w === p.b) p.sb++;
    p.ta += Math.min(ma, 3000); p.tb += Math.min(mb, 3000); p.n++;
    if (p.sa >= D.need) p.w = p.a;
    else if (p.sb >= D.need) p.w = p.b;
    else if (p.n >= 7) p.w = p.ta <= p.tb ? p.a : p.b;   // nessuno tocca mai: decide il tempo totale
    res.push({ a: p.a, b: p.b, ma, mb, w, kind: p.kind });
  }
  if (D.pairs.every(p => p.w != null)) {
    const lo = (p) => (p.w === p.a ? p.b : p.a);
    if (D.phase === 1) {
      const pair = (a, b, kind) => ({ a, b, kind, sa: 0, sb: 0, ta: 0, tb: 0, n: 0, w: null });
      if (D.bye != null) { D.place[lo(D.pairs[0])] = 3; D.pairs = [pair(D.pairs[0].w, D.bye, 'final')]; }
      else D.pairs = [pair(D.pairs[0].w, D.pairs[1].w, 'final'), pair(lo(D.pairs[0]), lo(D.pairs[1]), 'small')];
      D.phase = 2;
    } else {
      for (const p of D.pairs) { D.place[p.w] = p.kind === 'final' ? 1 : 3; D.place[lo(p)] = p.kind === 'final' ? 2 : 4; }
      D.over = true;
    }
  }
  return res;
}
export const DUEL_NAMES = { semi: 'Semifinale', final: 'Finale', small: 'Finalina 3° posto' };

// ------------------------------------------------------------------ quiz
export const QUIZ_CATS = ['Cultura', 'Calcio', 'Videogiochi e film', 'Mancave'];
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
// le domande della partita: categorie scelte + domande Mancave aggiunte da Simone
// custom: [{ q, a: [giusta, sbagliata, sbagliata, sbagliata] }]
export function buildQuiz(seed, n, cats, custom = []) {
  const R = rng(seed);
  const all = [...QUIZ, ...custom.filter(c => c && c.q && Array.isArray(c.a) && c.a.length === 4).map(c => [c.q, c.a, 'Mancave'])];
  const ok = (q) => !cats || !cats.length || cats.includes(q[2]);
  // le domande Mancave (se accese) sono almeno metà della partita
  const mine = shuffle(all.filter(q => q[2] === 'Mancave' && ok(q)), R).slice(0, Math.ceil(n / 2));
  const want = shuffle(all.filter(q => ok(q) && !mine.includes(q)), R);
  const rest = shuffle(all.filter(q => !ok(q)), R);
  return shuffle([...mine, ...want].slice(0, n), R).concat(rest).slice(0, n).map(([q, ans, cat]) => {
    const idx = shuffle([0, 1, 2, 3], R);
    return { q, cat, answers: idx.map(i => ans[i]), correct: idx.indexOf(0) };
  });
}

// ------------------------------------------------------------------ classifica
// entries: [{ slot, s }] dove s è lo stato riportato (o null se non ha giocato)
// ritorna [{ slot, place, label }] con parità = stesso posto
function rankKey(game, s, pit, slot) {
  s = s || {};
  switch (game) {
    case 'barra': return [s.score || 0];
    case 'pallone': return s.popT != null ? [1, -s.popT] : [0, s.n || 0];
    case 'lattina': case 'regata': case 'labirinto': return s.popT != null ? [1, -s.popT] : [0, s.p || 0];
    case 'semaforo': return [-((pit && pit.duel && pit.duel.place[slot]) || 9)];
    case 'patatine': return [s.score || 0];
    case 'piumeno': return [s.best || 0];
    case 'porta': case 'quiz': return [(pit && pit.pts && pit.pts[slot]) || 0];
  }
  return [0];
}
function cmpKey(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (b[i] || 0) - (a[i] || 0); if (Math.abs(d) > 1e-9) return d; } return 0; }
export function rankGame(game, entries, pit) {
  const list = entries.map(e => ({ ...e, k: rankKey(game, e.s, pit, e.slot) }));
  list.sort((a, b) => cmpKey(a.k, b.k));
  let place = 0;
  return list.map((e, i) => {
    if (i === 0 || cmpKey(list[i - 1].k, e.k) !== 0) place = i + 1;
    return { slot: e.slot, place, label: liveLabel(game, e.s, pit, e.slot) };
  });
}
// gruppi di pari merito (servono lo spareggio)
export function tieGroups(ranking) {
  const by = {};
  for (const r of ranking) (by[r.place] = by[r.place] || []).push(r.slot);
  return Object.values(by).filter(g => g.length > 1);
}
// dopo lo spareggio: dentro ogni gruppo vince chi ha toccato di più (se ancora pari, a sorte)
export function applyTie(ranking, taps, seed) {
  const R = rng(seed + 991);
  const coin = {};
  for (const r of ranking) coin[r.slot] = R();
  const out = [...ranking].sort((a, b) => a.place - b.place || (taps[b.slot] || 0) - (taps[a.slot] || 0) || coin[a.slot] - coin[b.slot]);
  return out.map((r, i) => ({ ...r, place: i + 1, tie: taps[r.slot] != null ? taps[r.slot] : undefined }));
}

// testo breve per la TV (durante e dopo il gioco)
export function liveLabel(game, s, pit, slot) {
  s = s || {};
  switch (game) {
    case 'barra': return `${s.score || 0} pt${s.out ? ' · fuori' : ''}`;
    case 'pallone': return s.popT != null ? `BOOM! ${(s.popT / 1000).toFixed(1)}s` : `${Math.round(100 * (s.n || 0) / BALLOON_TAPS)}%`;
    case 'lattina': return s.popT != null ? `SPLASH! ${(s.popT / 1000).toFixed(1)}s` : `${Math.round(s.p || 0)}%`;
    case 'regata': return s.popT != null ? `Arrivato! ${(s.popT / 1000).toFixed(1)}s` : `${Math.round(s.p || 0)}%`;
    case 'labirinto': return (s.popT != null ? `Uscito! ${(s.popT / 1000).toFixed(1)}s` : `${Math.round(s.p || 0)}%`) + (s.falls ? ` · ${s.falls} cadut${s.falls === 1 ? 'a' : 'e'}` : '');
    case 'semaforo': {
      const D = pit && pit.duel;
      if (!D) return '';
      if (D.place[slot]) return `${D.place[slot]}° posto`;
      const p = duelPairOf(D, slot);
      if (p) return `${DUEL_NAMES[p.kind]} · ${p.a === slot ? p.sa : p.sb}-${p.a === slot ? p.sb : p.sa}`;
      if (D.bye === slot) return 'Aspetta in finale';
      return 'Ha vinto il duello';
    }
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
    case 'lattina': case 'regata': case 'labirinto': return s.popT != null ? 1 : Math.min(1, (s.p || 0) / 100);
    case 'semaforo': {
      const D = pit && pit.duel;
      if (!D) return 0;
      if (D.place[slot]) return (5 - D.place[slot]) / 4;
      const p = duelPairOf(D, slot);
      return p ? (p.a === slot ? p.sa : p.sb) / D.need : 0.5;
    }
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
  if (n >= 2 && place === n) return { draw: 0, keep: 0, wait: 1, text: 'Niente carte · riparte 1 secondo dopo' };
  if (place === 2) return { draw: 2, keep: 2, text: 'Pesca 2 carte' };
  return { draw: 1, keep: 1, text: 'Pesca 1 carta' };
}

// ------------------------------------------------------------------ piloti del computer (e tastiera) nei minigiochi
const CPU_MG = {
  facile:    { tap: 5.5, hit: 0.7, react: [0.36, 0.55], foul: 0.08, chip: 0.55, guess: 0.6, quiz: 0.45, maze: 1.9 },
  normale:   { tap: 7.0, hit: 0.82, react: [0.28, 0.42], foul: 0.05, chip: 0.7, guess: 0.68, quiz: 0.62, maze: 2.6 },
  difficile: { tap: 8.6, hit: 0.9, react: [0.21, 0.32], foul: 0.03, chip: 0.85, guess: 0.75, quiz: 0.8, maze: 3.4 },
};
export function cpuMgNew(level, seed) { return { L: CPU_MG[level] || CPU_MG.normale, R: rng(seed), t: 0, s: {}, next: 0.8, ans: {}, at: {}, plan: {} }; }
// avanza di dt secondi. pit = stato del pit stop visto da questo schermo. Ritorna lo stato da riportare.
export function cpuMgTick(b, game, dt, pit, slot) {
  const L = b.L, R = b.R, s = b.s;
  b.t += dt;
  if (pit.stage === 'tie') {
    if (pit.tie && pit.tie.slots.includes(slot) && pit.stageT > TIE_INTRO) s.tie = Math.floor(L.tap * 1.1 * Math.min(TIE_TAP, pit.stageT - TIE_INTRO));
    return s;
  }
  if (pit.stage !== 'play') return s;
  switch (game) {
    case 'pallone': case 'lattina': case 'regata': {
      if (s.popT != null) break;
      const rate = L.tap * (0.85 + R() * 0.3) * (game === 'pallone' ? 1 : game === 'lattina' ? 2.2 : 1.6);
      if (game === 'pallone') { b.n = (b.n || 0) + rate * dt; if (b.n >= BALLOON_TAPS) { b.n = BALLOON_TAPS; s.popT = Math.round(b.t * 1000); s.done = 1; } s.n = Math.floor(b.n); }
      else { b.p = (b.p || 0) + rate * dt; if (b.p >= CAN_FULL) { b.p = CAN_FULL; s.popT = Math.round(b.t * 1000); s.done = 1; } s.p = Math.floor(b.p); }
      break;
    }
    case 'labirinto': {
      if (s.popT != null) break;
      b.p = (b.p || 0) + L.maze * (pit.short ? 1.6 : 1) * (0.6 + R() * 0.8) * dt;
      if (R() < dt * 0.04) { s.falls = (s.falls || 0) + 1; b.p = Math.max(0, b.p - 15); }
      if (b.p >= 100) { b.p = 100; s.popT = Math.round(b.t * 1000); s.done = 1; }
      s.p = Math.floor(b.p);
      // pallina sulla strada giusta, per la TV
      if (!b.path) {
        const M = makeMaze(pit.seed, pit.short);
        b.path = [[0, 0]];
        let x = 0, y = 0;
        while ((x !== M.exit.x || y !== M.exit.y) && b.path.length < 200) {
          const d = M.dist[y][x];
          for (const [dx, dy, dir] of [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']]) {
            if (!mazeWall(M, x, y, dir) && M.dist[y + dy][x + dx] === d - 1) { x += dx; y += dy; break; }
          }
          b.path.push([x, y]);
        }
      }
      const pc = b.path[Math.min(b.path.length - 1, Math.floor(b.p / 100 * (b.path.length - 1)))];
      s.v = { x: pc[0] + 0.5, y: pc[1] + 0.5 };
      break;
    }
    case 'barra': {
      s.v = { c: Math.round(Math.sin(b.t * 3.4) * 100) / 100, h: barRound(s.round || 0).half };
      if (s.out || b.t < b.next) break;
      const r = s.round || 0;
      const p = L.hit * Math.pow(0.88, r);
      if (R() < p) { s.score = (s.score || 0) + Math.round(40 + R() * 60); s.round = r + 1; b.next = b.t + 1.6 + R() * 1.2; }
      else { s.out = 1; s.done = 1; }
      break;
    }
    case 'semaforo': {
      const r = pit.round;
      if (r < 0 || pit.reveal || b.ans[r] != null || !duelPairOf(pit.duel, slot)) break;
      if (!b.plan[r]) {
        const foul = R() < L.foul;
        b.plan[r] = foul ? { at: SEM_READY + semDelay(pit.seed, r) * (0.4 + R() * 0.5), ms: SEM_FOUL }
          : (() => { const ms = Math.round(1000 * (L.react[0] + R() * (L.react[1] - L.react[0]))); return { at: SEM_READY + semDelay(pit.seed, r) + ms / 1000, ms }; })();
      }
      if (pit.roundT >= b.plan[r].at) b.ans[r] = b.plan[r].ms;
      s.ans = b.ans;
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
      if (r >= 0 && b.ans[r] == null && pit.reveal == null && R() < dt * 0.8) b.ans[r] = Math.floor(R() * 3);
      s.ans = b.ans;
      break;
    }
    case 'quiz': {
      const r = pit.round;
      if (r >= 0 && b.ans[r] == null && pit.reveal == null && pit.roundT > 2.5 + R() * 4) {
        const c = pit.qc;                                   // la risposta giusta la conosce solo il PC principale
        b.ans[r] = c == null ? Math.floor(R() * 4) : R() < L.quiz ? c : (c + 1 + Math.floor(R() * 3)) % 4;
        b.at[r] = Math.round(pit.roundT * 1000);
      }
      s.ans = b.ans; s.at = b.at;
      break;
    }
  }
  return s;
}

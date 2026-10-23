// Pit stop sulla TV: spiegazione, gioco in corso, classifica e premi.
// Grafica a cartone animato: piccoli disegni SVG fatti qui, colori e animazioni in css/mg-tv.css.
// drawPit viene chiamata spesso: lo scheletro si crea una volta e poi si aggiornano solo i pezzi che cambiano
// (variabili CSS, classi, testi), così le animazioni non ripartono a ogni fotogramma.
import {
  GAMES, PIT_INTRO, PIT_COUNT, PIT_GO, TIE_INTRO, TIE_TAP, SEM_READY, SEM_FOUL, semDelay, DUEL_NAMES,
  BALLOON_TAPS, makeMaze, mazeWall, chipPlan, pmNumbers,
} from './minigames.js';

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOOR_COLORS = ['#e8322b', '#2f7bff', '#2ec46b'];
const ANS_COLORS = ['#e8322b', '#2f7bff', '#ffb000', '#2ec46b'];
const LETTERS = ['A', 'B', 'C', 'D'];
const INK = '#1d1733';                       // contorno scuro dei disegni
const MINIS = ['barra', 'pallone', 'lattina', 'labirinto', 'patatine', 'piumeno'];
const MEDALS = ['#ffd400', '#dfe6f2', '#ff9b52', '#8fd0ff'];

function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ piccoli aiuti per il DOM
function put(node, html) { if (node._html !== html) { node._html = html; node.innerHTML = html; } }
function setVar(node, name, val) { const k = '_v' + name; if (node[k] !== val) { node[k] = val; node.style.setProperty(name, val); } }
function setText(node, txt) { if (node && node._t !== txt) { node._t = txt; node.textContent = txt; } }
function flag(node, cls, on) { on = !!on; const k = '_c' + cls; if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); } }
const svg = (vb, inner, cls = '') => `<svg class="tz-svg ${cls}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`;
const initial = (name) => esc((String(name || '?').trim().charAt(0) || '?').toUpperCase());
const tzDot = (p) => `<i class="tz-dot" style="--c:${esc(p.color)}" title="${esc(p.name)}">${initial(p.name)}</i>`;
const S = (w) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

// stella a punte (per scoppi, premi e scintille)
function starPath(cx, cy, r1, r2, n) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r2 : r1;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
  }
  return d + 'Z';
}
// nuvoletta "a fumetto" con la scritta (POP!, SPLASH!)
function burst(cx, cy, r, text, size) {
  return `<path d="${starPath(cx, cy, r, r * 0.68, 12)}" fill="#ffd400" ${S(4)}/>`
    + `<path d="${starPath(cx, cy, r * 0.7, r * 0.5, 12)}" fill="#fff36b"/>`
    + `<text x="${cx}" y="${cy + size * 0.36}" class="tz-bt" font-size="${size}" text-anchor="middle" fill="#e8322b">${text}</text>`;
}

// ------------------------------------------------------------------ disegni dei minigiochi (viewBox 240x120)
function balloonArt() {
  const hose = 'M60 98 C 92 118, 124 116, 150 106';
  return svg('0 0 240 120', `
    <ellipse class="tz-shd" cx="150" cy="113" rx="34" ry="5"/>
    <path d="${hose}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <path d="${hose}" fill="none" stroke="#7d8db3" stroke-width="3.5" stroke-linecap="round"/>
    <g class="tz-pump">
      <g class="tz-ph"><rect x="46" y="18" width="8" height="40" fill="#c9cfe0" ${S(3)}/><rect x="28" y="12" width="44" height="11" rx="5.5" fill="#ffd400" ${S(4)}/></g>
      <rect x="37" y="44" width="26" height="56" rx="7" class="f-c" ${S(4)}/>
      <rect x="42" y="50" width="5" height="44" rx="2.5" fill="#fff" opacity=".5"/>
      <rect x="24" y="98" width="52" height="11" rx="5" fill="#5d6a8a" ${S(4)}/>
    </g>
    <g class="tz-bl"><g class="tz-blw">
      <path d="M144 98 L156 98 L153.5 107 L146.5 107Z" class="f-c" ${S(3.5)}/>
      <ellipse cx="150" cy="55" rx="38" ry="44" class="f-c" ${S(4.5)}/>
      <path d="M170 22 C 192 40, 192 78, 164 94 C 180 72, 181 44, 170 22Z" fill="#000" opacity=".17"/>
      <ellipse cx="135" cy="35" rx="8" ry="14" fill="#fff" opacity=".85" transform="rotate(-28 135 35)"/>
      <circle cx="129" cy="56" r="3.5" fill="#fff" opacity=".75"/>
    </g></g>
    <g class="tz-sweat"><path d="M200 18 L206 46" ${S(6)} stroke-linecap="round"/><path d="M200 18 L206 46" stroke="#ff4d3d" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="208" cy="56" r="4" fill="#ff4d3d" ${S(2.5)}/><path d="M96 26 q-6 10 0 14 q6 -4 0 -14Z" fill="#8fd8ff" ${S(2)}/></g>
    <g class="tz-pop">
      ${burst(150, 58, 50, 'POP!', 28)}
      <path d="M92 30 l-12 -8 l4 12Z M206 24 l12 -6 l-4 12Z M96 98 l-14 6 l12 4Z M206 96 l14 4 l-12 6Z" class="f-c" ${S(2.5)}/>
    </g>`);
}

function canArt() {
  const puffs = [[104, 30, 12], [120, 22, 16], [137, 30, 12], [110, 12, 10], [131, 11, 10], [120, 4, 8]];
  const outline = puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const drops = [[-46, -10], [-34, -34], [-10, -46], [14, -48], [36, -30], [48, -8]]
    .map(([dx, dy], i) => `<circle class="tz-drop" cx="120" cy="24" r="${4 + (i % 3)}" style="--dx:${dx}px;--dy:${dy}px;animation-delay:${(i * 0.07).toFixed(2)}s"/>`).join('');
  return svg('0 0 240 120', `
    <ellipse class="tz-shd" cx="120" cy="114" rx="32" ry="5"/>
    <g class="tz-drops">${drops}</g>
    <g class="tz-can">
      <g class="tz-foam"><g fill="${INK}" stroke="${INK}" stroke-width="8">${outline}</g><g fill="#fff">${outline}</g>
        <circle cx="112" cy="24" r="3" fill="#cdeeff"/><circle cx="128" cy="16" r="2.5" fill="#cdeeff"/><circle cx="134" cy="30" r="2" fill="#cdeeff"/></g>
      <rect x="96" y="36" width="48" height="76" rx="9" class="f-c" ${S(4.5)}/>
      <rect x="96" y="62" width="48" height="25" fill="#fff" ${S(3)}/>
      <text x="120" y="80" class="tz-cant" font-size="13" text-anchor="middle">FIZZ</text>
      <rect x="101" y="42" width="6" height="64" rx="3" fill="#fff" opacity=".45"/>
      <rect x="132" y="39" width="9" height="70" rx="4.5" fill="#000" opacity=".15"/>
      <rect x="99" y="29" width="42" height="12" rx="5" fill="#d9dde8" ${S(4)}/>
      <ellipse cx="128" cy="32" rx="6" ry="2.5" fill="#9aa3b8" ${S(2)}/>
    </g>
    <g class="tz-meter">
      <rect x="186" y="14" width="18" height="84" rx="9" fill="#fff" ${S(4)}/>
      <rect class="tz-mfill f-c" x="190" y="20" width="10" height="80" rx="5"/>
      <circle cx="195" cy="104" r="11" class="f-c" ${S(4)}/>
      <path d="M204 30h6M204 50h6M204 70h6" ${S(3)} stroke-linecap="round"/>
    </g>
    <g class="tz-pop">${burst(120, 52, 54, 'SPLASH!', 19)}</g>`);
}

function barArt() {
  const ticks = Array.from({ length: 11 }, (_, k) => `M${14 + 21.2 * k} 88v${k % 5 ? 5 : 9}`).join('');
  return svg('0 0 240 120', `
    <rect x="14" y="48" width="212" height="34" rx="17" fill="#ff6b5e"/>
    <rect class="tz-gz" x="14" y="48" width="212" height="34" fill="#2ec46b"/>
    <rect class="tz-gz2" x="14" y="48" width="212" height="34" fill="#a6f5c0"/>
    <rect x="28" y="52" width="184" height="7" rx="3.5" fill="#fff" opacity=".35"/>
    <rect x="14" y="48" width="212" height="34" rx="17" fill="none" ${S(5)}/>
    <path d="${ticks}" ${S(3)} stroke-linecap="round"/>
    <circle cx="14" cy="22" r="8" fill="#ff6b5e" ${S(3)}/><circle cx="226" cy="22" r="8" fill="#ff6b5e" ${S(3)}/>
    <g class="tz-cur">
      <rect x="116.5" y="36" width="7" height="58" rx="3.5" fill="#fff" ${S(3)}/>
      <path d="M106 18 L134 18 L120 40 Z" fill="#ffd400" ${S(4)}/>
      <circle cx="120" cy="100" r="7" class="f-c" ${S(3)}/>
    </g>`);
}

// labirinto in un vassoio di legno (lo preparo una volta per partita)
const mazeCache = new Map();
function mazeArt(seed, short) {
  const key = seed + ':' + short;
  if (mazeCache.has(key)) return mazeCache.get(key);
  const M = makeMaze(seed, short);
  let d = '';
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    if (mazeWall(M, x, y, 'r')) d += `M${x + 1} ${y}V${y + 1}`;
    if (mazeWall(M, x, y, 'd')) d += `M${x} ${y + 1}H${x + 1}`;
  }
  d += `M0 0H${M.W}M0 0V${M.H}`;
  let grain = '';
  for (let y = 0; y < M.H; y++) grain += `M0 ${y + 0.3}C${M.W * 0.3} ${y + 0.12} ${M.W * 0.6} ${y + 0.5} ${M.W} ${y + 0.28}`;
  const holes = M.holes.map(h => `<circle cx="${h.x + 0.5}" cy="${h.y + 0.5}" r="0.33" fill="#5a3414" stroke="${INK}" stroke-width="0.05"/><circle cx="${h.x + 0.5}" cy="${h.y + 0.54}" r="0.23" fill="#120a05"/>`).join('');
  const ex = M.exit.x, ey = M.exit.y, px = ex + 0.36;
  const inner = `
    <rect x="-0.55" y="-0.55" width="${M.W + 1.1}" height="${M.H + 1.1}" rx="0.35" fill="#b07035" stroke="${INK}" stroke-width="0.11"/>
    <rect x="-0.4" y="-0.4" width="${M.W + 0.8}" height="0.14" rx="0.07" fill="#fff" opacity=".22"/>
    <rect width="${M.W}" height="${M.H}" fill="#f3d39b"/>
    <path d="${grain}" stroke="#e2b876" stroke-width="0.05" fill="none"/>
    <rect x="${ex + 0.06}" y="${ey + 0.06}" width="0.88" height="0.88" rx="0.15" fill="#2ec46b" opacity=".45"/>
    ${holes}
    <path d="${d}" stroke="#4a2a10" stroke-width="0.24" stroke-linecap="round" fill="none"/>
    <path d="${d}" stroke="#a86b35" stroke-width="0.1" stroke-linecap="round" fill="none"/>
    <path d="M${px} ${ey + 0.88}V${ey + 0.12}" stroke="${INK}" stroke-width="0.08" stroke-linecap="round"/>
    <path d="M${px} ${ey + 0.12}L${px + 0.48} ${ey + 0.28}L${px} ${ey + 0.44}Z" fill="#e8322b" stroke="${INK}" stroke-width="0.05" stroke-linejoin="round"/>`;
  const r = { M, vb: `-0.7 -0.7 ${M.W + 1.4} ${M.H + 1.4}`, inner };
  mazeCache.set(key, r);
  if (mazeCache.size > 6) mazeCache.delete(mazeCache.keys().next().value);
  return r;
}
function mazeTileArt(seed, short) {
  const m = mazeArt(seed, short);
  return svg(m.vb, m.inner + `<g class="tz-ball" style="transform:translate(0.5px,0.5px)"><ellipse cx="0.07" cy="0.12" rx="0.27" ry="0.2" fill="#000" opacity=".3"/>`
    + `<circle r="0.31" class="f-c" stroke="${INK}" stroke-width="0.07"/><circle cx="-0.1" cy="-0.11" r="0.1" fill="#fff" opacity=".9"/></g>`, 'tz-maze');
}

// patatine: 9 piattini, le patatine saltano fuori
const CHIP = 'M-14 2C-15 -8 -6 -12 2 -11C10 -10 16 -5 14 3C13 9 4 11 -3 10C-10 9 -13 7 -14 2Z';
function chipsArt() {
  let cells = '';
  for (let i = 0; i < 9; i++) {
    const cx = 72 + (i % 3) * 48, cy = 20 + Math.floor(i / 3) * 38;
    cells += `<g transform="translate(${cx} ${cy})"><ellipse cy="9" rx="21" ry="8" fill="#fff" ${S(3)}/><ellipse cy="8" rx="13" ry="4" fill="#e3e8f2"/>`
      + `<g class="tz-chip"><g class="cg"><path d="${CHIP}" fill="#ffc93c" ${S(3)}/><path d="M-8 -7C-4 -2 -4 4 -7 7M0 -9C4 -4 4 3 1 8M7 -7C10 -3 10 2 8 5" stroke="#e39a17" stroke-width="2" fill="none" stroke-linecap="round"/>`
      + `<circle cx="-6" cy="-3" r="1.4" fill="#fff" opacity=".8"/></g>`
      + `<g class="cb"><path d="${CHIP}" fill="#5a3518" ${S(3)}/><path d="M-6 -4l3 3M4 -6l2 4M0 3l4 2" stroke="#2a160a" stroke-width="2" stroke-linecap="round"/>`
      + `<path class="tz-smoke" d="M-4 -12c-4 -4 4 -6 0 -10c-4 -4 4 -6 0 -10M6 -12c-3 -3 3 -5 0 -8" stroke="#8a8f9e" stroke-width="2.5" fill="none" stroke-linecap="round"/></g></g></g>`;
  }
  return svg('0 0 240 120', `
    <g transform="translate(6 30)"><path d="M6 14 L4 0 M12 14 L12 -4 M18 14 L20 2 M24 14 L26 -2" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <path d="M6 14 L4 0 M12 14 L12 -4 M18 14 L20 2 M24 14 L26 -2" stroke="#ffc93c" stroke-width="4" stroke-linecap="round"/>
      <path d="M0 12 H32 L28 60 H4Z" fill="#e8322b" ${S(4)}/><path d="M10 20 l6 10 l6 -10" stroke="#ffd400" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    <g transform="translate(212 32)"><rect x="-4" y="-14" width="8" height="10" rx="2" fill="#fff" ${S(3)}/><rect x="-10" y="-6" width="20" height="58" rx="7" fill="#e8322b" ${S(4)}/>
      <rect x="-10" y="14" width="20" height="14" fill="#fff" ${S(3)}/><rect x="-6" y="0" width="4" height="40" rx="2" fill="#fff" opacity=".4"/></g>
    ${cells}`, 'tz-chips');
}

// più o meno: carte da gioco
const pmCache = new Map();
function pmNum(seed, i) {
  if (!pmCache.has(seed)) { pmCache.clear(); pmCache.set(seed, pmNumbers(seed)); }
  const a = pmCache.get(seed);
  return a[Math.min(a.length - 1, Math.max(0, i || 0))];
}
function pmCard(n) {
  const suit = ['♥', '♠', '♦', '♣'][n % 4], red = n % 2 === 0;
  const col = red ? '#e8322b' : INK;
  return `<g class="tz-card"><rect x="90" y="10" width="68" height="96" rx="9" fill="#fff" ${S(4.5)}/>`
    + `<rect x="97" y="17" width="54" height="82" rx="5" fill="none" stroke="${col}" stroke-width="1.5" opacity=".35"/>`
    + `<text x="124" y="${n >= 100 ? 70 : 74}" class="tz-cardn" font-size="${n >= 100 ? 28 : 38}" text-anchor="middle" fill="${col}">${n}</text>`
    + `<text x="100" y="31" font-size="13" class="tz-cards" fill="${col}">${suit}</text><text x="148" y="99" font-size="13" text-anchor="end" class="tz-cards" fill="${col}">${suit}</text></g>`;
}
function pmArt(n, cur) {
  const back = (x, y, r) => `<g transform="rotate(${r} ${x + 24} ${y + 34})"><rect x="${x}" y="${y}" width="48" height="68" rx="7" class="f-c" ${S(4)}/>`
    + `<rect x="${x + 6}" y="${y + 6}" width="36" height="56" rx="4" fill="none" stroke="#fff" stroke-width="2.5"/>`
    + `<path d="M${x + 24} ${y + 18}l9 16l-9 16l-9 -16Z" fill="#fff" opacity=".8"/></g>`;
  return svg('0 0 240 120', `
    <ellipse class="tz-shd" cx="124" cy="111" rx="38" ry="5"/>
    ${back(14, 30, -8)}${back(24, 26, 4)}
    <g class="tz-slot">${pmCard(n)}</g>
    <g transform="translate(176 0)"><path d="M0 40 L12 22 L24 40 H17 V52 H7 V40Z" fill="#2ec46b" ${S(3)}/><path d="M0 72 L12 90 L24 72 H17 V60 H7 V72Z" fill="#ff5a4a" ${S(3)}/></g>
    <g transform="translate(220 56)"><circle r="17" fill="#ffd400" ${S(4)}/><text y="7" class="tz-streak" font-size="19" text-anchor="middle">${cur}</text>
      <text y="34" class="tz-cards tz-serie" font-size="10" text-anchor="middle">SERIE</text></g>`, 'tz-pm');
}

// porta: viewBox 120x170
function doorArt(i, state) {
  const lit = state === 'ok';
  const rays = lit ? `<g class="tz-rays">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M60 88 L${60 + Math.cos(k * 0.785) * 90} ${88 + Math.sin(k * 0.785) * 90} L${60 + Math.cos(k * 0.785 + 0.3) * 90} ${88 + Math.sin(k * 0.785 + 0.3) * 90}Z" fill="#ffd400" opacity=".55"/>`).join('')}</g>` : '';
  return svg('0 0 120 176', `
    <rect x="4" y="4" width="112" height="162" rx="12" fill="#7a4b26" ${S(5)}/>
    <rect x="10" y="8" width="100" height="6" rx="3" fill="#fff" opacity=".2"/>
    <defs><clipPath id="tzdc${i}"><rect x="16" y="16" width="88" height="148" rx="5"/></clipPath></defs>
    <g clip-path="url(#tzdc${i})"><rect x="16" y="16" width="88" height="148" fill="${lit ? '#fff7c2' : '#141022'}"/>${rays}
      ${lit ? `<path d="${starPath(60, 90, 30, 14, 5)}" fill="#ffd400" ${S(4)}/><text x="60" y="98" class="tz-bt" font-size="20" text-anchor="middle" fill="#e8322b">+1</text>` : ''}</g>
    <g class="tz-leaf">
      <rect x="16" y="16" width="88" height="148" rx="5" fill="${DOOR_COLORS[i]}" ${S(4.5)}/>
      <rect x="26" y="28" width="68" height="50" rx="5" fill="#000" opacity=".16"/><rect x="26" y="90" width="68" height="62" rx="5" fill="#000" opacity=".16"/>
      <rect x="22" y="20" width="6" height="140" rx="3" fill="#fff" opacity=".25"/>
      <circle cx="90" cy="96" r="6" fill="#ffd400" ${S(3)}/>
      <circle cx="60" cy="54" r="20" fill="#fff" ${S(4)}/>
      <text x="60" y="64" class="tz-bt" font-size="26" text-anchor="middle" fill="${INK}">${i + 1}</text>
    </g>
    ${state === 'no' ? `<path d="M38 70 L82 114 M82 70 L38 114" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M38 70 L82 114 M82 70 L38 114" stroke="#ff5a4a" stroke-width="7" stroke-linecap="round"/>` : ''}`, 'tz-door-svg');
}

// semaforo: viewBox 90x220
function trafficArt(light) {
  const lamps = [['#ff3b30', '#5c2520'], ['#ffc400', '#5a4a18'], ['#2ee66b', '#1b4a2c']];
  const on = light === 'red' ? 0 : light === 'green' ? 2 : light === 'yellow' ? 1 : -1;
  let g = '';
  lamps.forEach(([hi, lo], k) => {
    const cy = 40 + k * 58;
    g += `<path d="M18 ${cy - 10} Q45 ${cy - 40} 72 ${cy - 10}Z" fill="${INK}"/>`;
    if (k === on) g += `<circle class="tz-halo" cx="45" cy="${cy}" r="31" fill="${hi}" opacity=".35"/>`;
    g += `<circle cx="45" cy="${cy}" r="21" fill="${k === on ? hi : lo}" ${S(4)}/>`;
    g += `<circle cx="38" cy="${cy - 8}" r="${k === on ? 6 : 4}" fill="#fff" opacity="${k === on ? 0.75 : 0.18}"/>`;
  });
  return svg('0 0 90 222', `
    <rect x="37" y="182" width="16" height="38" fill="#5d6a8a" ${S(4)}/>
    <rect x="8" y="6" width="74" height="180" rx="22" fill="#363c5e" ${S(5)}/>
    <rect x="15" y="12" width="8" height="166" rx="4" fill="#fff" opacity=".12"/>
    ${g}`, 'tz-traffic');
}

// icone per l'intestazione (viewBox 64x64)
function icon(game) {
  const b = {
    pallone: `<ellipse cx="32" cy="27" rx="18" ry="21" fill="#e8322b" ${S(4)}/><path d="M28 47h8l-2 6h-4Z" fill="#e8322b" ${S(3)}/><ellipse cx="25" cy="18" rx="4" ry="7" fill="#fff" opacity=".8" transform="rotate(-25 25 18)"/><path d="M32 54 q-6 4 0 8" ${S(2.5)} fill="none"/>`,
    lattina: `<circle cx="26" cy="12" r="7" fill="#fff" ${S(3)}/><circle cx="37" cy="10" r="8" fill="#fff" ${S(3)}/><rect x="18" y="16" width="28" height="44" rx="6" fill="#2f7bff" ${S(4)}/><rect x="18" y="31" width="28" height="13" fill="#fff" ${S(3)}/><rect x="20" y="13" width="24" height="7" rx="3" fill="#d9dde8" ${S(3)}/>`,
    labirinto: `<rect x="6" y="6" width="52" height="52" rx="8" fill="#b07035" ${S(4)}/><rect x="13" y="13" width="38" height="38" fill="#f3d39b"/><path d="M13 26H38M26 38H51M26 26V38" stroke="#4a2a10" stroke-width="4" stroke-linecap="round"/><circle cx="19" cy="19" r="5" fill="#2f7bff" ${S(2.5)}/>`,
    patatine: `<path d="M8 36C6 18 22 8 36 10C52 12 60 26 56 38C52 52 36 56 24 54C14 52 9 46 8 36Z" fill="#ffc93c" ${S(4)}/><path d="M20 20C26 30 26 40 20 48M34 14C40 26 40 40 34 52M46 18C50 28 50 38 46 46" stroke="#e39a17" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    barra: `<rect x="4" y="22" width="56" height="20" rx="10" fill="#ff6b5e" ${S(4)}/><rect x="24" y="24" width="16" height="16" fill="#2ec46b"/><rect x="4" y="22" width="56" height="20" rx="10" fill="none" ${S(4)}/><path d="M26 6H40L33 20Z" fill="#ffd400" ${S(3)}/><rect x="31" y="18" width="4" height="30" rx="2" fill="#fff" ${S(2)}/>`,
    piumeno: `<rect x="6" y="12" width="30" height="42" rx="5" fill="#2f7bff" ${S(3.5)} transform="rotate(-10 21 33)"/><rect x="24" y="8" width="32" height="46" rx="5" fill="#fff" ${S(4)}/><path d="M40 14 L48 26 H32Z" fill="#2ec46b" ${S(2.5)}/><path d="M40 48 L48 36 H32Z" fill="#ff5a4a" ${S(2.5)}/>`,
    porta: `<rect x="12" y="4" width="40" height="56" rx="6" fill="#7a4b26" ${S(4)}/><rect x="18" y="10" width="28" height="50" rx="3" fill="#2ec46b" ${S(3)}/><circle cx="40" cy="36" r="3" fill="#ffd400" ${S(2)}/><text x="32" y="30" class="tz-bt" font-size="14" text-anchor="middle" fill="#fff">?</text>`,
    semaforo: `<rect x="18" y="2" width="28" height="60" rx="10" fill="#363c5e" ${S(4)}/><circle cx="32" cy="16" r="7" fill="#ff3b30" ${S(2.5)}/><circle cx="32" cy="32" r="7" fill="#5a4a18" ${S(2.5)}/><circle cx="32" cy="48" r="7" fill="#1b4a2c" ${S(2.5)}/>`,
    quiz: `<path d="M8 10H56V44H30L18 56V44H8Z" fill="#fff" ${S(4)}/><text x="32" y="38" class="tz-bt" font-size="24" text-anchor="middle" fill="#2f7bff">?</text>`,
  }[game] || `<path d="${starPath(32, 33, 26, 12, 5)}" fill="#ffd400" ${S(4)}/>`;
  return svg('0 0 64 64', b);
}

// ------------------------------------------------------------------ riquadri dal vivo (uno per giocatore)
function tileArt(P, slot) {
  switch (P.game) {
    case 'pallone': return balloonArt();
    case 'lattina': return canArt();
    case 'barra': return barArt();
    case 'labirinto': return mazeTileArt(P.seed, P.short);
    case 'patatine': return chipsArt();
    case 'piumeno': return pmArt(pmNum(P.seed, 0), 0);
  }
  return '';
}
const DONE_STAMP = { labirinto: 'ARRIVATO!', patatine: 'FINITO!', piumeno: 'FINITO!', barra: 'FINITO!' };
function tileHtml(P, r, p) {
  return `<div class="tz-tile g-${P.game}" style="--c:${esc(p.color)}">
    <div class="tz-name"><i>${initial(p.name)}</i><span>${esc(p.name)}</span><b class="tz-lab"></b></div>
    <div class="tz-art">${tileArt(P, r.slot)}</div>
    <div class="tz-stamp out">FUORI!</div>${DONE_STAMP[P.game] ? `<div class="tz-stamp fin">${DONE_STAMP[P.game]}</div>` : ''}
  </div>`;
}

const chipCache = new Map();
function chipShow(P) {
  const key = P.seed + ':' + P.dur;
  if (!chipCache.has(key)) { chipCache.clear(); chipCache.set(key, chipPlan(P.seed, P.dur)); }
  const show = new Array(9).fill('');
  for (const c of chipCache.get(key)) if (P.t >= c.at && P.t < c.at + c.life) show[c.cell] = c.bad ? 'bad' : 'good';
  return show;
}

function updateTile(t, P, r, chips) {
  const v = r.v || {};
  flag(t, 'out', r.out); flag(t, 'done', r.done);
  setText(t._lab, r.label);
  switch (P.game) {
    case 'pallone': {
      const f = Math.min(1, (v.n || 0) / BALLOON_TAPS);
      setVar(t, '--s', (0.3 + 0.75 * f).toFixed(3));
      flag(t, 'hot', f > 0.72 && !r.done);
      flag(t, 'busy', f > 0 && !r.done);
      break;
    }
    case 'lattina': {
      const p = Math.min(1, Math.max(0, (v.p || 0) / 100));
      setVar(t, '--p', p.toFixed(3));
      const lv = r.done ? 0 : p >= 0.66 ? 3 : p >= 0.33 ? 2 : p > 0.02 ? 1 : 0;
      if (t._lv !== lv) { t._lv = lv; t.classList.remove('l1', 'l2', 'l3'); if (lv) t.classList.add('l' + lv); }
      break;
    }
    case 'barra':
      setVar(t, '--cx', (+v.c || 0).toFixed(3));
      setVar(t, '--h', (+v.h || 0).toFixed(3));
      break;
    case 'labirinto': {
      const b = t._ball, tr = `translate(${(v.x == null ? 0.5 : +v.x).toFixed(3)}px, ${(v.y == null ? 0.5 : +v.y).toFixed(3)}px)`;
      if (b && b._tr !== tr) { b._tr = tr; b.style.transform = tr; }
      break;
    }
    case 'patatine':
      (t._cells || []).forEach((c, i) => { const s = chips[i]; if (c._s !== s) { c._s = s; c.setAttribute('class', 'tz-chip ' + s); } });
      break;
    case 'piumeno': {
      const n = pmNum(P.seed, v.i);
      if (t._n !== n) { if (t._slot) t._slot.innerHTML = pmCard(n); flag(t, 'flip', t._n != null); t._n = n; }
      setText(t._streak, String(v.cur || 0));
      flag(t, 'hotstreak', (v.cur || 0) >= 3);
      break;
    }
  }
}

function drawMinis(R, P, who) {
  const live = P.live || [];
  const key = 'minis|' + P.game + '|' + P.seed + '|' + P.short + '|' + live.map(r => { const p = who(r.slot); return r.slot + ':' + p.color + ':' + p.name; }).join(',');
  if (R.body._html !== key) {
    R.body._html = key;
    R.body.innerHTML = `<div class="tz-minis n${live.length}">${live.map(r => tileHtml(P, r, who(r.slot))).join('')}</div>`;
    R.tiles = [...R.body.querySelectorAll('.tz-tile')];
    for (const t of R.tiles) {
      t._lab = t.querySelector('.tz-lab');
      t._ball = t.querySelector('.tz-ball');
      t._slot = t.querySelector('.tz-slot');
      t._streak = t.querySelector('.tz-streak');
      const ch = t.querySelectorAll('.tz-chip');
      if (ch.length) t._cells = [...ch];
    }
  }
  const chips = P.game === 'patatine' ? chipShow(P) : null;
  live.forEach((r, i) => R.tiles[i] && updateTile(R.tiles[i], P, r, chips));
}

// ------------------------------------------------------------------ disegno grande per la spiegazione
function demoArt(P, color) {
  const c = `style="--c:${esc(color)};--s:.82;--p:.55;--h:.22"`;
  switch (P.game) {
    case 'pallone': return `<div class="tz-demo demo busy hot g-pallone" ${c}>${balloonArt()}</div>`;
    case 'lattina': return `<div class="tz-demo demo l2 g-lattina" ${c}>${canArt()}</div>`;
    case 'barra': return `<div class="tz-demo demo g-barra" ${c}>${barArt()}</div>`;
    case 'labirinto': return `<div class="tz-demo demo g-labirinto" ${c}>${mazeTileArt(P.seed, P.short)}</div>`;
    case 'patatine': return `<div class="tz-demo demo g-patatine" ${c}>${chipsArt()}</div>`;
    case 'piumeno': return `<div class="tz-demo demo g-piumeno" ${c}>${pmArt(pmNum(P.seed, 0), 3)}</div>`;
    case 'porta': return `<div class="tz-demo demo g-porta">${[0, 1, 2].map(i => `<div class="tz-door">${doorArt(i, '')}</div>`).join('')}</div>`;
    case 'semaforo': return `<div class="tz-demo demo g-semaforo">${trafficArt('green')}<div class="tz-vsdemo"><b>VS</b></div>${trafficArt('red')}</div>`;
    case 'quiz': return `<div class="tz-demo demo g-quiz">${LETTERS.map((l, i) => `<div class="tz-qmini" style="--c:${ANS_COLORS[i]}"><b>${l}</b></div>`).join('')}</div>`;
  }
  return `<div class="tz-demo demo">${icon(P.game)}</div>`;
}

// ------------------------------------------------------------------ cronometro
const TIMER_HTML = `<div class="tz-timer hidden">
  ${svg('0 0 100 104', `<rect x="41" y="0" width="18" height="12" rx="4" fill="#ffd400" ${S(4)}/><rect x="80" y="18" width="12" height="10" rx="3" fill="#ffd400" ${S(3.5)} transform="rotate(40 86 23)"/>
    <circle cx="50" cy="58" r="44" fill="#fff" ${S(5)}/><circle class="tz-tbg" cx="50" cy="58" r="35"/>
    <circle class="tz-ring" cx="50" cy="58" r="35" pathLength="100" transform="rotate(-90 50 58)"/>`)}
  <b></b><span></span></div>`;
function setTimer(R, num, label, frac, cls) {
  const T = R.timer;
  flag(T, 'hidden', num == null);
  if (num == null) return;
  setText(T._b, String(num));
  setText(T._s, label);
  flag(T, 'long', String(num).length > 2);
  const f = Math.max(0, Math.min(1, frac == null ? 1 : frac));
  const off = (100 * (1 - f)).toFixed(1);
  if (T._off !== off) { T._off = off; T._ring.style.strokeDashoffset = off; }
  flag(T, 'go', cls === 'go');
  flag(T, 'hurry', cls === 'hurry');
}

// ------------------------------------------------------------------ la funzione chiamata dalla TV
export function drawPit(el, P, players) {
  if (!P) { if (el._k) { el._k = null; el.innerHTML = ''; } return; }
  flag(el, 'pit-toon', true);
  flag(el, 'pit-clear', P.stage === 'go' || P.stage === 'done');
  const g = GAMES[P.game];

  // 3-2-1 grande al centro
  if (P.stage === 'count' || P.stage === 'go' || P.stage === 'done') {
    const kind = P.stage === 'count' ? 'count' : 'go';
    if (el._k !== 'big:' + kind) {
      el._k = 'big:' + kind;
      el.innerHTML = `<div class="tz-big ${kind === 'go' ? 'go' : ''}"><div class="tz-burst"></div><div class="tz-bnum"></div>
        <div class="tz-blabel">${kind === 'count' ? `<span class="tz-bico">${icon(P.game)}</span>${esc(g.title)}` : 'Si riparte!'}</div></div>`;
      el._num = el.querySelector('.tz-bnum');
    }
    const left = (P.stage === 'count' ? PIT_COUNT : PIT_GO) - P.stageT;
    const txt = left > 0.05 ? String(Math.max(1, Math.ceil(left))) : 'VIA!';
    put(el._num, `<b class="${txt === 'VIA!' ? 'via' : ''}">${txt}</b>`);
    return;
  }

  // scheletro: intestazione, cronometro, corpo, SALTA, piede
  const sk = ['main', P.game, P.grid ? 1 : 0, P.n, P.of].join('|');
  if (el._k !== sk) {
    el._k = sk;
    el.innerHTML = `<div class="tz-box">
      <div class="tz-head">
        <div class="tz-ico">${icon(P.game)}</div>
        <div class="tz-tt"><div class="tz-tags"><span class="tz-tag">${P.grid ? 'GRIGLIA DI PARTENZA' : `PIT STOP ${esc(P.n)}${P.of ? ' di ' + esc(P.of) : ''}`}</span><span class="tz-kind">${esc(g.kind)}</span></div>
          <h2 class="tz-title">${esc(g.title)}</h2></div>
        ${TIMER_HTML}
      </div>
      <div class="tz-body"></div>
      <div class="tz-skip"></div>
      <div class="tz-foot">${P.grid ? 'Chi vince il minigioco parte in prima fila' : 'La gara è in pausa · si riparte dalle posizioni di adesso'}</div>
    </div>`;
    const R = el._r = { timer: el.querySelector('.tz-timer'), body: el.querySelector('.tz-body'), skip: el.querySelector('.tz-skip'), tiles: [] };
    R.timer._b = R.timer.querySelector('b'); R.timer._s = R.timer.querySelector('span'); R.timer._ring = R.timer.querySelector('.tz-ring');
  }
  const R = el._r;
  const who = (slot) => players.find(p => p.slot === slot) || { name: '?', color: '#888' };
  if (R._stage !== P.stage) { R._stage = P.stage; R.body.className = 'tz-body stage-' + P.stage; }

  const skipLine = () => {
    const humans = players.filter(p => !p.cpu && !p.kbd);
    if (!humans.length) return '';
    return `<div class="tz-skipline">${humans.map(p => `<span class="${P.skips && P.skips[p.slot] === P.stage ? 'ok' : ''}" style="--c:${esc(p.color)}"><i>${initial(p.name)}</i>${esc(p.name)}</span>`).join('')}<em>premete SALTA sul telefono</em></div>`;
  };

  if (P.stage === 'intro') {
    const left = PIT_INTRO - P.stageT;
    setTimer(R, Math.max(1, Math.ceil(left)), 'si comincia', left / PIT_INTRO, left <= 3 ? 'hurry' : '');
    const first = players[0] ? players[0].color : '#e8322b';
    put(R.body, `<div class="tz-intro">${demoArt(P, first)}<div class="tz-bubble"><p>${esc(g.help)}</p></div></div>`);
    put(R.skip, skipLine());
  } else if (P.stage === 'play') {
    if (g.duel) setTimer(R, P.round + 1, 'manche', 1, '');
    else if (g.rounds) {
      const left = P.reveal == null ? g.roundTime - P.roundT : 0;
      setTimer(R, P.reveal == null ? Math.ceil(Math.max(0, left)) : '!', `${P.game === 'quiz' ? 'domanda' : 'manche'} ${P.round + 1}/${P.rounds || g.rounds}`,
        P.reveal == null ? left / g.roundTime : 0, P.reveal == null && left <= 3 ? 'hurry' : '');
    } else {
      const left = P.dur - P.t;
      setTimer(R, clock(left), 'tempo', left / P.dur, left <= 5 ? 'hurry' : '');
    }
    put(R.skip, '');
    if (MINIS.includes(P.game)) drawMinis(R, P, who);
    else if (P.game === 'semaforo') put(R.body, semBody(P, who));
    else if (P.game === 'quiz') put(R.body, quizBody(P, who));
    else if (P.game === 'porta') put(R.body, doorBody(P, who));
    else put(R.body, liveRows(P, who));
  } else if (P.stage === 'tie') {
    const tapping = P.stageT >= TIE_INTRO;
    const left = TIE_INTRO + TIE_TAP - P.stageT;
    setTimer(R, tapping ? Math.max(0, Math.ceil(left)) : '!', 'spareggio', tapping ? left / TIE_TAP : 1, tapping ? 'hurry' : '');
    drawTie(R, P, who, tapping);
    put(R.skip, '');
  } else if (P.stage === 'results') {
    setTimer(R, null);
    put(R.body, resultsBody(P, who));
    put(R.skip, skipLine());
  }
}

// ------------------------------------------------------------------ corpi dei giochi "di gruppo"
function semBody(P, who) {
  if (!P.duel) return '';
  const t = P.roundT - SEM_READY, d = semDelay(P.seed, P.round);
  const light = P.reveal ? 'off' : t < 0 ? 'off' : t < d ? 'red' : 'green';
  const res = P.reveal ? P.reveal.res : null;
  const pairs = res ? res : P.duel.pairs.filter(p => p.w == null).map(p => ({ a: p.a, b: p.b, kind: p.kind, sa: p.sa, sb: p.sb }));
  const ms = (v) => v >= SEM_FOUL ? (v === SEM_FOUL ? 'anticipo!' : '—') : `${v} ms`;
  let h = `<div class="tz-sem"><div class="tz-light ${light}">${trafficArt(light)}<div class="tz-lcap">${light === 'green' ? 'ORA!' : light === 'red' ? 'aspetta…' : res ? 'risultato' : 'pronti…'}</div></div><div class="tz-duels">`;
  for (const p of pairs) {
    const full = P.duel.pairs.find(q => (q.a === p.a && q.b === p.b)) || null;
    const need = P.duel.need || 1;
    const stars = (n) => '<i class="st">★</i>'.repeat(Math.min(n, need)) + '<i class="st off">★</i>'.repeat(Math.max(0, need - n));
    const side = (slot, val, win) => {
      const pl = who(slot);
      return `<div class="tz-dp ${win ? 'win' : ''} ${res && !win ? 'lose' : ''}" style="--c:${esc(pl.color)}"><i>${initial(pl.name)}</i><b>${esc(pl.name)}</b><span>${val}</span>${win ? '<em>VINCE!</em>' : ''}</div>`;
    };
    h += `<div class="tz-duel"><div class="tz-dk">${esc(DUEL_NAMES[p.kind] || '')}</div>`
      + side(p.a, res ? ms(p.ma) : full ? stars(full.sa) : '', res && p.w === p.a)
      + '<div class="tz-vs"><b>VS</b></div>'
      + side(p.b, res ? ms(p.mb) : full ? stars(full.sb) : '', res && p.w === p.b) + '</div>';
  }
  if (P.duel.bye != null && P.duel.phase === 1) h += `<div class="tz-bye">${tzDot(who(P.duel.bye))}<span>${esc(who(P.duel.bye).name)} aspetta in finale</span></div>`;
  h += '</div></div>';
  if (!res) h += '<p class="tz-sub">Chi tocca prima del verde perde la manche</p>';
  return h;
}

function quizBody(P, who) {
  if (!(P.round >= 0 && P.qs)) return '';
  const q = P.qs[P.round];
  const picks = (P.reveal && P.reveal.picks) || {};
  let h = `<div class="tz-quiz"><div class="tz-qcard"><span class="tz-qcat">${esc(q.cat)}</span><div class="tz-qq">${esc(q.q)}</div></div><div class="tz-qa">`;
  q.answers.forEach((a, i) => {
    const cls = P.reveal ? (i === P.reveal.correct ? 'ok' : 'no') : '';
    const dots = Object.entries(picks).filter(([, v]) => v === i).map(([s]) => tzDot(who(Number(s)))).join('');
    h += `<div class="tz-ans ${cls}" style="--c:${ANS_COLORS[i]};--i:${i}"><b>${LETTERS[i]}</b><span>${esc(a)}</span><em>${dots}</em>${cls === 'ok' ? '<strong>✓</strong>' : ''}</div>`;
  });
  return h + '</div></div>';
}

function doorBody(P, who) {
  if (!(P.round >= 0)) return '';
  const picks = (P.reveal && P.reveal.picks) || {};
  let h = '<div class="tz-doors">';
  for (let i = 0; i < 3; i++) {
    const dots = Object.entries(picks).filter(([, v]) => v === i).map(([s]) => tzDot(who(Number(s)))).join('');
    const cls = P.reveal ? (P.reveal.lone[i] ? 'ok' : 'no') : '';
    h += `<div class="tz-door ${cls}" style="--i:${i}">${doorArt(i, cls)}<div class="tz-picks">${dots}</div></div>`;
  }
  h += '</div>';
  h += P.reveal ? '<p class="tz-sub">Chi è da solo dietro una porta prende +1</p>' : '<p class="tz-sub">Scegliete una porta sul telefono…</p>';
  return h;
}

// righe semplici con barra (per giochi senza disegno)
function liveRows(P, who) {
  let h = '<div class="tz-rows">';
  for (const r of P.live || []) {
    const p = who(r.slot);
    h += `<div class="tz-row ${r.out ? 'out' : ''} ${r.done ? 'done' : ''}" style="--c:${esc(p.color)}"><div class="tz-rn"><i>${initial(p.name)}</i>${esc(p.name)}</div>`
      + `<div class="tz-rbar"><i style="width:${Math.round((r.bar || 0) * 100)}%"></i></div><div class="tz-rl">${esc(r.label)}</div></div>`;
  }
  return h + '</div>';
}

// spareggio: righe che si aggiornano senza ricrearle
function drawTie(R, P, who, tapping) {
  const slots = (P.tie && P.tie.slots) || [];
  const key = 'tie|' + slots.map(s => s + ':' + who(s).color + ':' + who(s).name).join(',');
  if (R.body._html !== key) {
    R.body._html = key;
    R.body.innerHTML = `<p class="tz-help"></p><div class="tz-rows tie">${slots.map(s => {
      const p = who(s);
      return `<div class="tz-row" style="--c:${esc(p.color)}"><div class="tz-rn"><i>${initial(p.name)}</i>${esc(p.name)}</div><div class="tz-rbar"><i></i></div><div class="tz-rl"></div></div>`;
    }).join('')}</div>`;
    R.tieHelp = R.body.querySelector('.tz-help');
    R.tieRows = [...R.body.querySelectorAll('.tz-row')];
  }
  setText(R.tieHelp, tapping ? 'TOCCA A RAFFICA!' : 'Pari merito! Spareggio lampo: 5 secondi di tap');
  flag(R.tieHelp, 'go', tapping);
  const max = Math.max(10, ...Object.values(P.tieLive || {}));
  slots.forEach((s, i) => {
    const row = R.tieRows[i]; if (!row) return;
    const n = (P.tieLive || {})[s] || 0;
    setVar(row, '--w', Math.round(100 * n / max) + '%');
    setText(row.querySelector('.tz-rl'), n + ' tap');
  });
}

const GIFT = svg('0 0 40 40', `<rect x="5" y="16" width="30" height="21" rx="3" fill="#e8322b" ${S(3)}/><rect x="3" y="10" width="34" height="9" rx="3" fill="#ff5a4a" ${S(3)}/>
  <rect x="17" y="10" width="6" height="27" fill="#ffd400" ${S(2)}/><path d="M20 10 C12 0 6 6 12 10 M20 10 C28 0 34 6 28 10" fill="none" ${S(3)}/>`, 'tz-gift');
function medal(place) {
  const col = MEDALS[Math.min(place, 4) - 1];
  return svg('0 0 64 76', `
    <path d="M14 2 L28 34 L20 38 L4 6Z" fill="#e8322b" ${S(3)}/><path d="M50 2 L36 34 L44 38 L60 6Z" fill="#2f7bff" ${S(3)}/>
    <circle cx="32" cy="48" r="25" fill="${col}" ${S(4.5)}/><circle cx="32" cy="48" r="18" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="3"/>
    <path d="M18 38 Q24 28 34 28" stroke="#fff" stroke-opacity=".7" stroke-width="4" fill="none" stroke-linecap="round"/>
    <text x="32" y="57" class="tz-bt" font-size="24" text-anchor="middle" fill="${INK}">${place}</text>`);
}
function resultsBody(P, who) {
  let h = '<div class="tz-res">';
  (P.results || []).forEach((r, i) => {
    const p = who(r.slot);
    const stars = r.place === 1 ? `<div class="tz-stars">${[0, 1, 2, 3, 4].map(k => `<i class="s${k}">${svg('0 0 40 40', `<path d="${starPath(20, 21, 18, 8, 5)}" fill="#ffd400" ${S(3)}/>`)}</i>`).join('')}</div>` : '';
    h += `<div class="tz-pr p${Math.min(r.place, 4)}" style="--c:${esc(p.color)};--i:${i}"><div class="tz-medal">${medal(r.place)}</div>`
      + `<div class="tz-prn"><b><i>${initial(p.name)}</i>${esc(p.name)}</b><small>${esc(r.label)}${r.tie != null ? ` · spareggio ${r.tie} tap` : ''}</small></div>`
      + `<div class="tz-prize">${GIFT}${esc(r.prize.text)}</div>${stars}</div>`;
  });
  return h + '</div>';
}

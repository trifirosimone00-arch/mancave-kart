// Configurazione di rete condivisa: server ponte (TURN) per giocare da reti diverse.
// L'indirizzo del Worker Cloudflare che genera le credenziali va in TURN_URL.
// Se è vuoto o non risponde, si usa solo STUN (funziona sulla stessa rete Wi-Fi).
export const TURN_URL = 'https://mancave-turn.trifiro-simone00.workers.dev';

export const PEER_PREFIX = 'mancavekart-';

const FALLBACK = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

let cached = null;
export async function iceServers() {
  if (cached && cached.until > Date.now()) return cached.list;
  if (!TURN_URL) return FALLBACK;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(TURN_URL, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) throw new Error('turn ' + r.status);
    const data = await r.json();
    let list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
    // i browser bloccano la porta 53: la tolgo per non aspettare a vuoto
    list = list.map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) })).filter(s => s.urls.length);
    cached = { list, until: Date.now() + 6 * 3600 * 1000 };
    return list;
  } catch (e) {
    console.warn('Server ponte non disponibile, uso solo STUN', e);
    return FALLBACK;
  }
}

export function hasTurn() { return !!TURN_URL; }

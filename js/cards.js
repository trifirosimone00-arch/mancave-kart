// Le carte di Mancave Kart: definizioni, rarità, pesca, combo ed effetti sul kart.
// I numeri vengono dal documento di progetto (decisi con Simone).
import { giveBoost } from './sim.js';

// target: 'none' = su di sé / a terra, 'pick' = scegli l'avversario,
//         'ahead' = chi è subito davanti, 'first' = chi è primo
export const CARDS = {
  // comuni
  turbo:      { name: 'Turbo',              rar: 'comune',  bad: false, target: 'none',  color: '#ff8a00', desc: 'Scatto per 2 secondi · due Turbo = Super Turbo' },
  shield:     { name: 'Scudo',              rar: 'comune',  bad: false, target: 'none',  color: '#2f7bff', desc: '10 secondi protetto da tutto · quando arriva un attacco usalo al volo per pararlo · due Scudi = Super Scudo' },
  oil:        { name: 'Olio',               rar: 'comune',  bad: true,  target: 'none',  color: '#3a3f55', desc: 'Macchia dietro di te: testacoda' },
  drunk:      { name: 'Sbronzo',            rar: 'comune',  bad: true,  target: 'pick',  color: '#c58b1b', desc: 'Schermo che ondeggia e kart che sbanda per 3 secondi' },
  // medie
  missile:    { name: 'Missile',            rar: 'media',   bad: true,  target: 'pick',  color: '#e8322b', desc: 'Scegli chi colpire, davanti o dietro' },
  magnet:     { name: 'Magnete',            rar: 'media',   bad: true,  target: 'ahead', color: '#c2185b', desc: 'Rubi la velocità a chi è davanti (se sei primo, a chi è dietro)' },
  invert:     { name: 'Sterzo al contrario', rar: 'media',  bad: true,  target: 'pick',  color: '#9b5cff', desc: 'Comandi invertiti per 4 secondi' },
  handbrake:  { name: 'Freno a mano',       rar: 'media',   bad: true,  target: 'pick',  color: '#6d4c41', desc: 'Lo blocchi per 2 secondi' },
  mini:       { name: 'Mini',               rar: 'media',   bad: true,  target: 'pick',  color: '#00897b', desc: 'Rimpicciolito e lento per 5 secondi' },
  call:       { name: 'Telefonata',         rar: 'media',   bad: true,  target: 'pick',  color: '#2e7d32', desc: 'Gli arriva una chiamata: finché non la rifiuta non può sterzare' },
  police:     { name: 'Inseguimento',       rar: 'media',   bad: true,  target: 'pick',  color: '#1565c0', desc: 'La polizia lo insegue veloce: deve guidare senza sbagliare per seminarla' },
  // rare
  remote:     { name: 'Telecomando',        rar: 'rara',    bad: true,  target: 'all',   color: '#37474f', desc: 'Tutti gli avversari al rallentatore per 3 secondi' },
  swap:       { name: 'Scambio',            rar: 'rara',    bad: true,  target: 'ahead', color: '#fbc02d', desc: 'Ti scambi con chi è davanti, se è entro 100 metri' },
  thief:      { name: 'Ladro',              rar: 'rara',    bad: true,  target: 'pick',  color: '#5d4037', desc: 'Rubi una carta: va in un quarto posto in più' },
  mirror:     { name: 'Specchio',           rar: 'rara',    bad: false, target: 'none',  color: '#90a4ae', desc: 'Per 15 secondi il prossimo dispetto torna a chi l\'ha lanciato' },
  // combo (tasto COMBO quando hai due carte uguali)
  superturbo: { name: 'Super Turbo',        rar: 'combo',   bad: false, target: 'none',  color: '#ff5a00', desc: 'Un turbo unico da 5 secondi' },
  supershield:{ name: 'Super Scudo',        rar: 'combo',   bad: false, target: 'none',  color: '#0d47a1', desc: '20 secondi protetto da tutto' },
};

export const COMBOS = {
  'turbo+turbo': 'superturbo',
  'shield+shield': 'supershield',
};
export function comboOf(a, b) { return COMBOS[[a, b].sort().join('+')] || null; }

export const HAND_SIZE = 3;
export const COOLDOWN = 5;          // dopo due carte di fila, la terza si può usare solo dopo 5 secondi
export const STREAK = 2;            // carte che si possono usare di fila senza attesa
export const INCOMING = 1.5;        // un attacco arriva dopo 1,5 secondi: c'è il tempo di parare con lo Scudo
export const PORTAL_COOLDOWN = 3;   // il portale si spegne dopo che qualcuno pesca
export const PORTAL_FRACTIONS = [0.18, 0.47, 0.76]; // 3 portali per giro
export const SPARE = HAND_SIZE;     // indice della carta a contatore: sta fuori dalla mano delle 3 carte
export const COUNTER_SECS = 15;     // la carta a contatore si rigenera in 15 secondi (il doppio veloce nell'ultimo giro)

// rarità: le rare escono poco
const POOL = [
  ...['turbo', 'shield', 'oil', 'drunk'].map(id => [id, 15]),
  ...['missile', 'magnet', 'invert', 'handbrake', 'mini', 'call', 'police'].map(id => [id, 5.2]),
  ...['remote', 'swap', 'thief', 'mirror'].map(id => [id, 3.5]),
];
// rareMul > 1: più probabilità di carte rare (premio del pit stop)
export function drawCard(rand = Math.random, rareMul = 1) {
  const pool = POOL.map(([id, w]) => [id, CARDS[id].rar === 'rara' ? w * rareMul : CARDS[id].rar === 'media' ? w * Math.sqrt(rareMul) : w]);
  let r = rand() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of pool) { r -= w; if (r <= 0) return id; }
  return POOL[0][0];
}

// effetto di una carta che arriva SU un kart (calcolato sullo schermo che lo gestisce).
// Ritorna 'blocked' | 'mirror' | 'ok'.
export function receive(k, kind) {
  const bad = !['give'].includes(kind);
  if (bad && k.mirror > 0) { k.mirror = 0; k.mirrorT = 0; return 'mirror'; }
  if (bad && k.shieldT > 0) return 'blocked';
  switch (kind) {
    case 'missile': k.spinT = Math.max(k.spinT, 1.2); k.speed *= 0.4; break;
    case 'splash': break;
    case 'oil': k.spinT = Math.max(k.spinT, 1); break;
    case 'drunk': k.drunkT = 3; break;
    case 'invert': k.invertT = 4; break;
    case 'handbrake': k.stopT = Math.max(k.stopT, 2); k.clampT = 2; break;   // ganascia gialla sulla ruota
    case 'mini': k.miniT = 5; break;
    case 'slow': k.slowT = 3; break;
    case 'call': k.callT = 8; break;                        // finisce prima, appena rifiuta la chiamata
    case 'police': k.stopT = Math.max(k.stopT, 1.5); k.copT = 2; break;
    case 'remote': k.slowmoT = 3; break;
  }
  return 'ok';
}

// carte che hanno effetto solo su chi le usa
export function applySelf(k, id) {
  switch (id) {
    case 'turbo': giveBoost(k, 2, 'orange'); return true;
    case 'superturbo': giveBoost(k, 5, 'orange'); return true;
    case 'shield': k.shieldT = Math.max(k.shieldT, 10); return true;
    case 'supershield': k.shieldT = 20; k.goldT = 20; return true;   // bolla dorata
    case 'mirror': k.mirror = 1; k.mirrorT = 15; return true;
    case 'magnet': giveBoost(k, 3, 'blue'); return true;
  }
  return false;
}

// Le carte di Mancave Kart: definizioni, rarità, pesca, combo ed effetti sul kart.
// I numeri vengono dal documento di progetto (decisi con Simone).
import { giveBoost } from './sim.js';

// target: 'none' = su di sé / a terra, 'pick' = scegli l'avversario,
//         'ahead' = chi è subito davanti, 'first' = chi è primo
export const CARDS = {
  turbo:      { name: 'Turbo',              rar: 'comune',  bad: false, target: 'none',  color: '#ff8a00', desc: 'Scatto per 2 secondi' },
  shield:     { name: 'Scudo',              rar: 'comune',  bad: false, target: 'none',  color: '#2f7bff', desc: 'Blocca i dispetti per 20 secondi' },
  oil:        { name: 'Olio',               rar: 'comune',  bad: true,  target: 'none',  color: '#3a3f55', desc: 'Macchia dietro di te: testacoda' },
  missile:    { name: 'Missile',            rar: 'comune',  bad: true,  target: 'ahead', color: '#e8322b', desc: 'Insegue chi è davanti' },
  magnet:     { name: 'Magnete',            rar: 'media',   bad: true,  target: 'ahead', color: '#c2185b', desc: 'Rubi la velocità a chi è davanti' },
  invert:     { name: 'Sterzo al contrario', rar: 'media',  bad: true,  target: 'pick',  color: '#9b5cff', desc: 'Comandi invertiti per 5 secondi' },
  fog:        { name: 'Nebbia',             rar: 'media',   bad: true,  target: 'pick',  color: '#78909c', desc: 'Schermo oscurato per 4 secondi' },
  handbrake:  { name: 'Freno a mano',       rar: 'media',   bad: true,  target: 'pick',  color: '#6d4c41', desc: 'Lo blocchi per 2 secondi' },
  mini:       { name: 'Mini',               rar: 'media',   bad: true,  target: 'pick',  color: '#00897b', desc: 'Rimpicciolito e lento per 5 secondi' },
  ghost:      { name: 'Fantasma',           rar: 'rara',    bad: false, target: 'none',  color: '#b0bec5', desc: '8 secondi trasparente: niente ti colpisce' },
  swap:       { name: 'Scambio',            rar: 'rara',    bad: true,  target: 'ahead', color: '#fbc02d', desc: 'Ti scambi con chi è davanti' },
  bomb:       { name: 'Bomba a tempo',      rar: 'rara',    bad: true,  target: 'none',  color: '#212121', desc: 'Passala toccando un kart: a ogni passaggio riparte da 10 secondi' },
  thief:      { name: 'Ladro',              rar: 'rara',    bad: true,  target: 'pick',  color: '#5d4037', desc: 'Rubi una carta a caso' },
  // combo (si ottengono trascinando una carta sull'altra)
  superturbo: { name: 'Super Turbo',        rar: 'combo',   bad: false, target: 'none',  color: '#ff5a00', desc: 'Un turbo unico da 5 secondi' },
  missile1:   { name: 'Missile al primo',   rar: 'combo',   bad: true,  target: 'first', color: '#b71c1c', desc: 'Ferma il primo e gli fa perdere una carta' },
  trap:       { name: 'Trappola invisibile', rar: 'combo',  bad: true,  target: 'none',  color: '#263238', desc: 'Olio che nessuno vede' },
  mirror:     { name: 'Specchio',           rar: 'combo',   bad: false, target: 'none',  color: '#cfd8dc', desc: 'Rimanda indietro il prossimo dispetto' },
};

export const COMBOS = {
  'turbo+turbo': 'superturbo',
  'missile+missile': 'missile1',
  'fog+oil': 'trap',
  'shield+shield': 'mirror',
};
export function comboOf(a, b) { return COMBOS[[a, b].sort().join('+')] || null; }

export const HAND_SIZE = 3;
export const COOLDOWN = 5;          // secondi tra una carta e l'altra
export const PORTAL_COOLDOWN = 3;   // il portale si spegne dopo che qualcuno pesca
export const PORTAL_FRACTIONS = [0.18, 0.47, 0.76]; // 3 portali per giro

// rarità: le rare escono davvero poco (1-2 a gara)
const POOL = [
  ...['turbo', 'shield', 'oil', 'missile'].map(id => [id, 15]),
  ...['magnet', 'invert', 'fog', 'handbrake', 'mini'].map(id => [id, 7.2]),
  ...['ghost', 'swap', 'bomb', 'thief'].map(id => [id, 3.5]),
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
  if (bad && k.ghostT > 0) return 'blocked';
  if (bad && k.mirror > 0) { k.mirror = 0; return 'mirror'; }
  if (bad && k.shieldT > 0) return 'blocked';
  switch (kind) {
    case 'missile': k.spinT = Math.max(k.spinT, 1.2); k.speed *= 0.4; break;
    case 'missile1': k.stopT = Math.max(k.stopT, 2); break;
    case 'oil': k.spinT = Math.max(k.spinT, 1); break;
    case 'trap': k.spinT = Math.max(k.spinT, 2); break;
    case 'invert': k.invertT = 5; break;
    case 'fog': k.fogT = 4; break;
    case 'handbrake': k.stopT = Math.max(k.stopT, 2); break;
    case 'mini': k.miniT = 5; break;
    case 'slow': k.slowT = 3; break;
    case 'bomb': break; // gestita a parte (si passa il tempo rimasto)
  }
  return 'ok';
}

// carte che hanno effetto solo su chi le usa
export function applySelf(k, id) {
  switch (id) {
    case 'turbo': giveBoost(k, 2, 'orange'); return true;
    case 'superturbo': giveBoost(k, 5, 'orange'); return true;
    case 'shield': k.shieldT = 20; return true;
    case 'mirror': k.mirror = 1; return true;
    case 'ghost': k.ghostT = 8; return true;
    case 'magnet': giveBoost(k, 3, 'blue'); return true;
    case 'bomb': k.bombT = 10; return true;
  }
  return false;
}

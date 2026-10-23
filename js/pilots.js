// Gli 8 piloti tra cui scegliere: ognuno ha il suo colore (kart e tuta) e il suo numero sul muso.
// Due giocatori non possono avere lo stesso pilota.
export const PILOTS = [
  { num: 1, color: '#e8322b', name: 'Rosso' },
  { num: 2, color: '#ff8a00', name: 'Arancio' },
  { num: 3, color: '#ffcc00', name: 'Giallo' },
  { num: 4, color: '#2ec46b', name: 'Verde' },
  { num: 5, color: '#1fb5c9', name: 'Azzurro' },
  { num: 6, color: '#2f7bff', name: 'Blu' },
  { num: 7, color: '#9b5cff', name: 'Viola' },
  { num: 8, color: '#ff4fa3', name: 'Rosa' },
];
export const PILOT_COLORS = PILOTS.map(p => p.color);
export function pilotOf(color) { return PILOTS.find(p => p.color.toLowerCase() === String(color || '').toLowerCase()) || null; }
// primo pilota libero, partendo da quello desiderato
export function freePilotColor(want, takenColors) {
  const taken = new Set(takenColors.map(c => String(c).toLowerCase()));
  if (want && pilotOf(want) && !taken.has(want.toLowerCase())) return pilotOf(want).color;
  const p = PILOTS.find(q => !taken.has(q.color.toLowerCase()));
  return p ? p.color : (want || PILOTS[0].color);
}

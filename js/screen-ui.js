// Impostazioni dello schermo: quanti riquadri e quale pilota in ognuno.
// Usato sia dalla finestra principale sia dai monitor extra.

export function createScreenConfig(key, initial = {}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { /* niente */ }
  const cfg = { mode: initial.mode || saved.mode || 'auto', manual: initial.manual || saved.manual || [0, 1, 2, 3] };
  const listeners = [];
  function save() { try { localStorage.setItem(key, JSON.stringify(cfg)); } catch (e) { /* niente */ } }
  return {
    get mode() { return cfg.mode; },
    setMode(m) { cfg.mode = m; save(); listeners.forEach(f => f()); },
    setSlot(i, s) { cfg.manual[i] = s; save(); listeners.forEach(f => f()); },
    manual: () => cfg.manual,
    onChange(f) { listeners.push(f); },
    // players: [{slot, name}] in ordine
    slots(players) {
      if (cfg.mode === 'auto') {
        const n = players.length;
        const v = n <= 1 ? 1 : n === 2 ? 2 : 4;
        return Array.from({ length: v }, (_, i) => (players[i] ? players[i].slot : -1));
      }
      const v = Number(cfg.mode);
      return cfg.manual.slice(0, v).map(s => (players.some(p => p.slot === s) ? s : -1));
    },
  };
}

const MODES = [['auto', 'Auto'], ['1', '1'], ['2', '2'], ['4', '4']];

export function bindLayoutButtons(container, config) {
  function draw() {
    container.innerHTML = '';
    for (const [m, label] of MODES) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.className = config.mode === m ? 'on' : '';
      b.onclick = () => config.setMode(m);
      container.appendChild(b);
    }
  }
  config.onChange(draw);
  draw();
}

// barra in alto che compare muovendo il mouse
export function bindScreenBar(bar, config, getPlayers, opts = {}) {
  const layout = bar.querySelector('#sb-layout');
  const slotsEl = bar.querySelector('#sb-slots');
  bindLayoutButtons(layout, config);
  let hideT = 0;
  function drawSlots() {
    slotsEl.innerHTML = '';
    if (config.mode === 'auto') return;
    const players = getPlayers();
    const n = Number(config.mode);
    for (let i = 0; i < n; i++) {
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `Riquadro ${i + 1}`);
      const none = document.createElement('option');
      none.value = '-1'; none.textContent = `Riquadro ${i + 1}: panoramica`;
      sel.appendChild(none);
      for (const p of players) {
        const o = document.createElement('option');
        o.value = String(p.slot); o.textContent = `Riquadro ${i + 1}: ${p.name}`;
        sel.appendChild(o);
      }
      sel.value = String(config.manual()[i] ?? -1);
      if (!players.some(p => p.slot === config.manual()[i])) sel.value = '-1';
      sel.onchange = () => config.setSlot(i, Number(sel.value));
      slotsEl.appendChild(sel);
    }
  }
  config.onChange(drawSlots);
  drawSlots();
  let lastPlayers = '';
  setInterval(() => {
    const sig = getPlayers().map(p => p.slot + p.name).join('|');
    if (sig !== lastPlayers) { lastPlayers = sig; drawSlots(); }
  }, 1000);
  window.addEventListener('mousemove', () => {
    if (opts.enabled && !opts.enabled()) return;
    bar.classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!bar.matches(':hover')) bar.classList.remove('show'); }, 2500);
  });
  bar.addEventListener('mouseleave', () => { hideT = setTimeout(() => bar.classList.remove('show'), 1200); });
  const full = bar.querySelector('#sb-full');
  if (full) full.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
}

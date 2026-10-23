// Audio della TV, tutto generato nel browser (niente file da scaricare, niente diritti):
// motori morbidi da kart (stile cartone), gomme che stridono, effetti delle carte e una
// musichetta semplice e allegra, tenuta bassa sotto i motori.

const store = {
  get(k, d) { try { const v = localStorage.getItem('mck-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mck-' + k, JSON.stringify(v)); } catch (e) { /* niente */ } },
};

export function createAudio() {
  let ctx = null, master = null, sfxBus = null, musicBus = null, voiceBus = null, engineBus = null, noiseBuf = null, shaper = null;
  let volume = store.get('volume', 0.7);
  const voices = new Map();      // slot -> voce del motore
  let tyre = null;
  let music = null;
  let lastCount = 0, lastMissiles = new Set(), lastNotes = new Set(), lastPhase = '';

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    engineBus = ctx.createGain(); engineBus.gain.value = 0.9; engineBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.1; musicBus.connect(comp);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.0; voiceBus.connect(master);   // lo speaker passa sopra a tutto
    // rumore bianco riutilizzabile
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // distorsione leggera: il motore diventa "ruvido"
    shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.6); }
    shaper.curve = curve;
    shaper.connect(engineBus);
    return true;
  }
  // il browser fa partire l'audio solo dopo un tocco o un tasto
  const unlock = () => { if (ensure() && ctx.state === 'suspended') ctx.resume(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    store.set('volume', volume);
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }

  // ---------------------------------------------------------------- motori
  function makeVoice() {
    // kart da cartone: onda quadra morbida + ottava sotto, filtrata, con un leggero tremolio
    const o1 = ctx.createOscillator(); o1.type = 'square';
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    const o3 = ctx.createOscillator(); o3.type = 'sine';      // tremolio del motore
    const g2 = ctx.createGain(); g2.gain.value = 0.6;
    const lfo = ctx.createGain(); lfo.gain.value = 4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.8;
    const out = ctx.createGain(); out.gain.value = 0;
    o3.frequency.value = 18; o3.connect(lfo); lfo.connect(o1.frequency); lfo.connect(o2.frequency);
    o1.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(out).connect(engineBus);
    o1.start(); o2.start(); o3.start();
    return { o1, o2, o3, lp, out, rpm: 0, gear: 1 };
  }
  // marce: il giro motore sale e ricade a ogni cambio, come in moto
  const GEARS = [0, 7, 13, 18.5, 23.5, 28, 40];
  function rpmOf(v, speed) {
    const s = Math.max(0, speed);
    let gIdx = 1;
    while (gIdx < GEARS.length - 1 && s > GEARS[gIdx]) gIdx++;
    const lo = GEARS[gIdx - 1], hi = GEARS[gIdx];
    v.gear = gIdx;
    return 0.28 + 0.72 * Math.min(1, (s - lo) / Math.max(1, hi - lo));
  }
  function updateEngines(snap, me, dt) {
    const racing = ['countdown', 'race', 'finish'].includes(snap.phase);
    const t = ctx.currentTime;
    const seen = new Set();
    for (const k of snap.karts || []) {
      seen.add(k.slot);
      let v = voices.get(k.slot);
      if (!v) { v = makeVoice(); voices.set(k.slot, v); }
      const target = rpmOf(v, Math.abs(k.speed || 0)) + (k.boostT > 0 ? 0.12 : 0);
      v.rpm += (target - v.rpm) * Math.min(1, dt * (target < v.rpm ? 14 : 6));
      const f = 62 + v.rpm * 175;                      // ronzio da kart, sale con le marce
      v.o1.frequency.setTargetAtTime(f, t, 0.04);
      v.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
      v.o3.frequency.setTargetAtTime(14 + v.rpm * 10, t, 0.1);
      v.lp.frequency.setTargetAtTime(600 + v.rpm * 900 + (k.boostT > 0 ? 700 : 0), t, 0.05);
      let gain = 0;
      if (racing) {
        if (me && k.slot === me.slot) gain = 0.13;
        else if (me) { const d = Math.hypot(k.x - me.x, k.z - me.z); gain = 0.09 * Math.max(0, 1 - d / 60); }
        else gain = 0.05;
        gain *= 0.55 + 0.45 * Math.min(1, Math.abs(k.speed || 0) / 12);
        if (k.finished && snap.phase === 'finish') gain *= 0.5;
      }
      v.out.gain.setTargetAtTime(gain, t, 0.08);
    }
    for (const [slot, v] of voices) if (!seen.has(slot)) { v.out.gain.setTargetAtTime(0, t, 0.05); setTimeout(() => { try { v.o1.stop(); v.o2.stop(); v.o3.stop(); } catch (e) { /* niente */ } }, 300); voices.delete(slot); }
    // gomme che stridono in derapata e in curva stretta
    if (!tyre) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 6;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(sfxBus); src.start();
      tyre = { g, bp };
    }
    let screech = 0;
    if (racing && me && !me.air) {
      if (me.drifting) screech = 0.22 + Math.min(0.2, (me.driftCharge || 0) * 0.08);
      if (me.spinT > 0) screech = 0.35;
      screech *= Math.min(1, Math.abs(me.speed || 0) / 14);
    }
    tyre.g.gain.setTargetAtTime(screech, t, 0.06);
    tyre.bp.frequency.setTargetAtTime(1500 + (me && me.drifting ? 500 : 0), t, 0.1);
  }

  // ---------------------------------------------------------------- effetti
  function tone(type, f0, f1, dur, vol, when = 0) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1, when = 0) {
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(lp).connect(g).connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }
  const FX = {
    beep: () => tone('square', 660, 660, 0.18, 0.18),
    go: () => { tone('square', 990, 990, 0.45, 0.2); tone('square', 1320, 1320, 0.45, 0.08); },
    whistle: () => tone('sine', 2200, 500, 0.9, 0.06),                       // razzo che arriva
    siren: () => { for (let i = 0; i < 4; i++) tone('triangle', i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.3, 0.07, i * 0.3); },
    ring: () => { tone('sine', 1200, 1200, 0.15, 0.08); tone('sine', 1500, 1500, 0.15, 0.08, 0.18); },
    boom: () => { noise(0.6, 0.45, 2200, 80); tone('sine', 120, 40, 0.5, 0.25); },
    hit: () => { noise(0.25, 0.3, 3000, 300); tone('triangle', 300, 120, 0.2, 0.12); },
    card: () => { tone('triangle', 880, 1760, 0.12, 0.12); tone('triangle', 1320, 2640, 0.12, 0.08, 0.08); },
    lap: () => { tone('triangle', 784, 784, 0.12, 0.14); tone('triangle', 1046, 1046, 0.2, 0.14, 0.12); },
    lastlap: () => { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.16, 0.1, i * 0.11)); },
    finish: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, f, 0.2, 0.1, i * 0.13)); },
    // ---- carte: un suono per ogni effetto
    explode: () => { noise(0.9, 0.5, 1800, 60); tone('sine', 90, 30, 0.7, 0.3); },
    teleport: () => { tone('sine', 300, 2400, 0.35, 0.1); tone('sine', 2400, 300, 0.35, 0.08, 0.3); },
    zap: () => { for (let i = 0; i < 5; i++) tone('sawtooth', 900 + i * 120, 200, 0.08, 0.05, i * 0.07); },
    steal: () => { tone('triangle', 500, 900, 0.1, 0.1); tone('triangle', 900, 1400, 0.1, 0.1, 0.12); },
    ding: () => { tone('sine', 1760, 1760, 0.6, 0.1); tone('sine', 2637, 2637, 0.5, 0.05, 0.02); },
    'card:turbo': () => { noise(0.5, 0.25, 4000, 600); tone('sawtooth', 200, 700, 0.4, 0.06); },
    'card:superturbo': () => { noise(0.8, 0.3, 5000, 600); tone('sawtooth', 200, 900, 0.7, 0.07); },
    'card:shield': () => { tone('sine', 400, 1200, 0.3, 0.1); tone('sine', 600, 1800, 0.3, 0.06, 0.05); },
    'card:supershield': () => { [523, 784, 1046, 1568].forEach((f, i) => tone('sine', f, f, 0.25, 0.08, i * 0.06)); },
    'card:oil': () => { noise(0.3, 0.25, 600, 120); tone('sine', 180, 60, 0.3, 0.12); },
    'card:drunk': () => { tone('triangle', 300, 520, 0.12, 0.12); tone('triangle', 420, 250, 0.18, 0.1, 0.16); },
    'card:missile': () => { noise(0.6, 0.3, 3000, 400); tone('sawtooth', 120, 400, 0.5, 0.06); },
    'card:magnet': () => { tone('square', 220, 880, 0.35, 0.06); },
    'card:invert': () => { tone('triangle', 800, 300, 0.2, 0.1); tone('triangle', 300, 800, 0.2, 0.1, 0.2); },
    'card:handbrake': () => { noise(0.15, 0.35, 5000, 2000); tone('square', 160, 120, 0.15, 0.1, 0.05); },
    'card:mini': () => { tone('sine', 1200, 300, 0.35, 0.1); },
    'card:call': () => { for (let i = 0; i < 3; i++) { tone('sine', 1300, 1300, 0.12, 0.08, i * 0.3); tone('sine', 1600, 1600, 0.12, 0.08, i * 0.3 + 0.14); } },
    'card:police': () => { tone('square', 700, 700, 0.15, 0.05); },
    'card:remote': () => { for (let i = 0; i < 6; i++) tone('square', 900 - i * 100, 900 - i * 100, 0.06, 0.05, i * 0.06); },
    'card:swap': () => { tone('sine', 600, 1200, 0.2, 0.08); },
    'card:thief': () => { tone('triangle', 700, 400, 0.15, 0.08); tone('triangle', 400, 700, 0.15, 0.08, 0.15); },
    'card:mirror': () => { tone('sine', 2093, 2093, 0.4, 0.07); tone('sine', 2637, 2637, 0.35, 0.05, 0.08); },
  };
  function play(name) { if (ctx && FX[name]) try { FX[name](); } catch (e) { /* niente */ } }

  // ---------------------------------------------------------------- speaker (frasi registrate con una voce AI)
  const VOICE_IDS = ['benvenuti', 'posti', 'tre', 'due', 'uno', 'via', 'giro2', 'giro3', 'giro4', 'giro5', 'ultimo', 'sorpasso', 'chesorpasso',
    'leader', 'comando', 'missile', 'oil', 'drunk', 'invert', 'handbrake', 'mini', 'magnet', 'call', 'police', 'remote', 'swap', 'thief', 'mirror',
    'shield', 'supershield', 'turbo', 'superturbo', 'pitstop', 'lampo', 'riparte', 'traguardo', 'vincitore', 'chegara',
    'win-Robo-Rino', 'win-Turbo-Tina', 'win-Bot-Bruno', 'win-Chip-Carla'];
  const vbuf = new Map();
  let vLoading = false, vBusyUntil = 0, vLast = {};
  let speakerOn = store.get('speaker', true);
  function loadVoices() {
    if (vLoading || !ctx) return;
    vLoading = true;
    for (const id of VOICE_IDS) {
      fetch(`assets/voce/${id}.mp3`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => vbuf.set(id, buf)).catch(() => {});
    }
  }
  // say: important = parla anche se sta già parlando (lo interrompe la prossima volta), cool = secondi prima di ripetere la stessa frase
  function say(id, { important = false, cool = 4 } = {}) {
    if (!ctx || !speakerOn || ctx.state !== 'running') return;
    const b = vbuf.get(id);
    if (!b) return;
    const t = ctx.currentTime;
    if (!important && t < vBusyUntil) return;
    if (vLast[id] && t - vLast[id] < cool) return;
    vLast[id] = t;
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(voiceBus); src.start();
    vBusyUntil = t + b.duration + 0.15;
    // la musica si abbassa mentre parla
    musicBus.gain.setTargetAtTime(0.03, t, 0.05);
    musicBus.gain.setTargetAtTime(musicLevel, t + b.duration, 0.3);
  }
  let musicLevel = 0.08;
  const sp = { lastLeader: null, leaderAt: 0, lap: 0, lastLeadSay: 0, winSaid: false, cfx: new Set(), phase: '', count: 0, rt: 0 };
  function speaker(snap) {
    if (!vbuf.size) return;
    const ph = snap.phase;
    if (ph !== sp.phase) {
      if (ph === 'intro') { say('benvenuti', { important: true }); sp.lap = 1; sp.lastLeader = null; sp.winSaid = false; }
      if (ph === 'countdown') say('posti', { important: true });
      if (ph === 'race' && sp.phase === 'countdown') say('via', { important: true, cool: 0 });
      if (ph === 'pit') say(snap.pit && snap.pit.grid ? 'posti' : 'pitstop', { important: true });
      if (ph === 'race' && sp.phase === 'pit') say('riparte', { important: true });
      if (ph === 'podium') setTimeout(() => say('chegara', { important: true }), 1200);
      sp.phase = ph;
    }
    if (ph === 'countdown') {
      const n = Math.ceil(snap.countdown);
      if (n !== sp.count && n >= 1 && n <= 3) say(['', 'uno', 'due', 'tre'][n], { important: true, cool: 0.5 });
      sp.count = n;
    }
    if (ph !== 'race' && ph !== 'finish') return;
    const ks = snap.karts || [];
    if (!ks.length) return;
    // giri: segue chi è in testa
    const lead = ks.reduce((a, b) => (a.place <= b.place ? a : b));
    const lap = Math.max(...ks.map(k => k.lapCount || 0));
    if (lap > sp.lap && lap <= snap.laps) {
      if (lap === snap.laps) say('ultimo', { important: true });
      else if (lap >= 2 && lap <= 5) say('giro' + lap, { important: true });
    }
    sp.lap = Math.max(sp.lap, lap);
    // minigioco lampo
    if (snap.lampo && !sp.lampoOn) say('lampo', { important: true });
    sp.lampoOn = !!snap.lampo;
    // cambio in testa (non nei primi secondi, quando si sistema la griglia)
    if (sp.lastLeader != null && lead.slot !== sp.lastLeader && (snap.raceTime || 0) > 6 && !lead.finished) {
      const t = ctx.currentTime;
      if (t - sp.lastLeadSay > 7) { say(Math.random() < 0.5 ? 'leader' : 'comando'); sp.lastLeadSay = t; }
    }
    sp.lastLeader = lead.slot;
    // carte (le dice lo speaker, una alla volta)
    for (const c of snap.cfx || []) {
      if (sp.cfx.has(c.id)) continue;
      sp.cfx.add(c.id);
      if ((snap.raceTime || 0) - c.t > 1.2) continue;
      if (c.kind === 'use' && c.card && c.card !== 'mirror' && c.card !== 'swap') say(c.card, { cool: 6 });
      if (c.kind === 'swap') say('swap', { cool: 6 });
      if (c.kind === 'mirror') say('mirror', { important: true, cool: 3 });
      if (c.kind === 'boom' && Math.random() < 0.4) say('chesorpasso', { cool: 10 });
    }
    if (sp.cfx.size > 300) sp.cfx = new Set([...sp.cfx].slice(-80));
    // arrivo: il primo che taglia il traguardo
    const first = ks.filter(k => k.finished).sort((a, b) => a.finishTime - b.finishTime)[0];
    if (first && !sp.winSaid) {
      sp.winSaid = true;
      say('traguardo', { important: true });
      setTimeout(() => say(vbuf.has('win-' + first.name) ? 'win-' + first.name : 'vincitore', { important: true, cool: 0 }), 1100);
    }
  }
  function setSpeaker(on) { speakerOn = !!on; store.set('speaker', speakerOn); }

  // ---------------------------------------------------------------- musica: semplice, allegra e chiara
  // una sola melodia ben riconoscibile + basso morbido, in Do maggiore (Do - La- - Fa - Sol), 132 bpm
  const BPM = 132, STEP = 60 / BPM / 2;               // ottavi
  const BASS = [48, 45, 41, 43];                      // Do, La, Fa, Sol
  const MELODY = [72, 76, 79, 76, 81, 79, 76, 74,  72, 74, 76, 79, 77, 76, 74, 0,
                  69, 72, 76, 72, 77, 76, 72, 69,  71, 74, 79, 77, 76, 74, 71, 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function startMusic() {
    if (music) return;
    music = { step: 0, next: ctx.currentTime + 0.1, timer: null };
    music.timer = setInterval(() => {
      while (music && music.next < ctx.currentTime + 0.15) { schedule(music.step, music.next); music.step++; music.next += STEP; }
    }, 30);
  }
  function stopMusic() { if (music) { clearInterval(music.timer); music = null; } }
  function note(type, midi, t, dur, vol) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function schedule(step, t) {
    const bar = Math.floor(step / 8) % 4, beat = step % 8;
    if (beat % 2 === 0) note('triangle', BASS[bar], t, STEP * 1.8, 0.35);
    const mel = MELODY[step % 32];
    if (mel) note('triangle', mel, t, STEP * 1.4, 0.3);
  }

  // ---------------------------------------------------------------- ogni fotogramma
  // me: il kart di chi guarda questo schermo (per il volume dei motori e le gomme)
  function update(snap, meSlot, dt) {
    if (!ctx || ctx.state !== 'running') return;
    const me = (snap.karts || []).find(k => k.slot === meSlot) || null;
    updateEngines(snap, me, dt);
    const musicOn = ['intro', 'countdown', 'race', 'pit', 'finish', 'podium'].includes(snap.phase);
    if (musicOn) startMusic(); else stopMusic();
    musicLevel = snap.phase === 'pit' || snap.phase === 'podium' ? 0.14 : 0.08;
    if (ctx.currentTime > vBusyUntil) musicBus.gain.setTargetAtTime(musicLevel, ctx.currentTime, 0.3);
    loadVoices();
    try { speaker(snap); } catch (e) { /* niente */ }
    // conto alla rovescia
    if (snap.phase === 'countdown') {
      const n = Math.ceil(snap.countdown);
      if (n !== lastCount && n >= 1 && n <= 3) play('beep');
      lastCount = n;
    } else if (lastPhase === 'countdown' && snap.phase === 'race') play('go');
    if (snap.phase === 'finish' && lastPhase === 'race') play('finish');
    lastPhase = snap.phase;
    // razzi che partono
    const ms = new Set((snap.missiles || []).map(m => m.id));
    for (const m of snap.missiles || []) if (!lastMissiles.has(m.id)) play(m.kind === 'police' ? 'siren' : 'whistle');
    lastMissiles = ms;
    // colpi
    for (const n of snap.notes || []) {
      if (lastNotes.has(n.id)) continue;
      lastNotes.add(n.id);
      play(n.cls === 'bad' ? 'boom' : 'hit');
    }
    if (lastNotes.size > 200) lastNotes = new Set([...lastNotes].slice(-50));
  }

  return { update, play, setVolume, volume: () => volume, setSpeaker, speaker: () => speakerOn };
}

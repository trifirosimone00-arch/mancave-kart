// Audio della TV, tutto generato nel browser (niente file da scaricare, niente diritti):
// motori morbidi da kart (stile cartone), gomme che stridono, effetti delle carte e una
// musichetta semplice e allegra, tenuta bassa sotto i motori.

const store = {
  get(k, d) { try { const v = localStorage.getItem('mck-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mck-' + k, JSON.stringify(v)); } catch (e) { /* niente */ } },
};

export function createAudio() {
  let ctx = null, master = null, sfxBus = null, musicBus = null, engineBus = null, noiseBuf = null, shaper = null;
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
  };
  function play(name) { if (ctx && FX[name]) try { FX[name](); } catch (e) { /* niente */ } }

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
    musicBus.gain.setTargetAtTime(snap.phase === 'pit' || snap.phase === 'podium' ? 0.14 : 0.08, ctx.currentTime, 0.3);
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

  return { update, play, setVolume, volume: () => volume };
}

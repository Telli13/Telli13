/* Mycelium Forest — music and sound effects, all synthesized with the Web Audio API
 * (no sound files), plus the three recorded intro voice lines (art/voice/intro_N.mp3).
 *
 * window.MF_AUDIO.sfx(name, { pan, vol, kind })  — one sound effect
 * window.MF_AUDIO.voice(n)                        — intro voice line n (1..3)
 * window.MF_AUDIO.setNight(0..1), .setRain(kind|null), .unlock(), .toggleMusic(), .toggleSound()
 */
'use strict';

(() => {
  const SAVE = 'mycelium-forest-audio-v1';
  let prefs = { music: true, sound: true };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(SAVE) || '{}') }; } catch (e) { /* defaults */ }
  const savePrefs = () => { try { localStorage.setItem(SAVE, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  let ac = null, master, musicBus, sfxBus, delay, noiseBuf, rainNode = null;
  let night = 0, started = false, nextBar = 0, nextPluck = 0, nextBird = 0, barIndex = 0;
  const voices = {};

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = prefs.music ? 0.32 : 0; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = prefs.sound ? 0.7 : 0; sfxBus.connect(master);
    // a soft echo for the music: a forest is never dry
    delay = ac.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = ac.createGain(); fb.gain.value = 0.38;
    const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200;
    delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(musicBus);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // call from any tap / click / key: browsers only allow sound after the player touches the page
  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    if (!started) { started = true; nextBar = ac.currentTime + 0.2; setInterval(schedule, 120); }
  }

  const now = () => ac.currentTime;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---- building blocks
  function env(g, t, a, peak, dcy, sus = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dcy);
  }
  function out(node, pan = 0, vol = 1, bus = sfxBus) {
    const g = ac.createGain(); g.gain.value = vol;
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(g); g.connect(p); p.connect(bus);
    } else { node.connect(g); g.connect(bus); }
    return g;
  }
  function tone(freq, t, dur, { type = 'sine', vol = 0.3, a = 0.005, pan = 0, slide = 0, bus = sfxBus, filter = 0 } = {}) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    const g = ac.createGain();
    env(g, t, a, vol, dur);
    let n = o;
    if (filter) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); n = f; }
    n.connect(g); out(g, pan, 1, bus);
    o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  function noise(t, dur, { vol = 0.3, a = 0.005, pan = 0, type = 'bandpass', freq = 1200, q = 1, sweep = 0, bus = sfxBus } = {}) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ac.createGain(); env(g, t, a, vol, dur);
    s.connect(f); f.connect(g); out(g, pan, 1, bus);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  }
  function chirp(t, pan, vol, base = 3200) { // a small bird
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const tt = t + i * 0.09;
      tone(base * (0.9 + Math.random() * 0.3), tt, 0.07, { type: 'sine', vol: vol, slide: 1.35 + Math.random() * 0.3, pan });
    }
  }

  // ---- sound effects
  const PLING = { water: [88, 95], organic: [69, 76], mineral: [93, 100], sugar: [84, 91] };
  const FX = {
    click: (t, p) => tone(1400, t, 0.04, { type: 'triangle', vol: 0.12, pan: p }),
    grow: (t, p) => { noise(t, 0.35, { vol: 0.08, freq: 500, sweep: 3, q: 0.7, pan: p }); tone(midi(64), t + 0.02, 0.18, { type: 'triangle', vol: 0.06, pan: p }); },
    collect: (t, p, o) => { const [a, b] = PLING[o.kind] || PLING.water; tone(midi(a), t, 0.25, { vol: 0.16, pan: p }); tone(midi(b), t + 0.06, 0.3, { vol: 0.12, pan: p }); },
    touch: (t, p) => { tone(midi(79), t, 0.2, { vol: 0.12, pan: p }); tone(midi(86), t + 0.05, 0.25, { vol: 0.1, pan: p }); },
    stage: (t, p) => [72, 76, 79].forEach((n, i) => tone(midi(n), t + i * 0.08, 0.35, { type: 'triangle', vol: 0.15, pan: p })),
    ripe: (t, p) => { [72, 76, 79, 84, 88].forEach((n, i) => tone(midi(n), t + i * 0.09, 0.6, { type: 'triangle', vol: 0.15, pan: p })); noise(t + 0.3, 0.8, { vol: 0.05, freq: 6000, q: 0.5, pan: p }); },
    sprout: (t, p) => { tone(180, t, 0.08, { vol: 0.25, slide: 2.4, pan: p }); tone(midi(84), t + 0.08, 0.3, { vol: 0.12, pan: p }); },
    spores: (t, p) => { for (let i = 0; i < 10; i++) tone(midi(84 + Math.floor(Math.random() * 12)), t + i * 0.05, 0.25, { vol: 0.06, pan: p }); noise(t, 1.2, { vol: 0.05, freq: 3000, sweep: 0.3, pan: p }); },
    rock: (t, p) => { tone(90, t, 0.15, { vol: 0.35, slide: 0.6, pan: p }); noise(t, 0.08, { vol: 0.15, freq: 300, pan: p }); },
    pest: (t, p) => { const o = tone(140, t, 0.6, { type: 'sawtooth', vol: 0.07, filter: 500, slide: 0.7, pan: p }); o.detune.setValueAtTime(0, t); },
    bite: (t, p) => { for (let i = 0; i < 4; i++) noise(t + i * 0.07, 0.05, { vol: 0.22, freq: 1800 + Math.random() * 900, q: 2, pan: p }); },
    squeak: (t, p) => tone(1200, t, 0.12, { type: 'square', vol: 0.06, slide: 1.8, filter: 3000, pan: p }),
    alert: (t, p) => { tone(880, t, 0.12, { type: 'triangle', vol: 0.12, pan: p }); tone(660, t + 0.14, 0.18, { type: 'triangle', vol: 0.12, pan: p }); noise(t, 0.4, { vol: 0.06, freq: 2500, q: 0.6, pan: p }); },
    rustle: (t, p) => noise(t, 0.4, { vol: 0.08, freq: 2400, q: 0.5, sweep: 0.6, pan: p }),
    munch: (t, p) => { for (let i = 0; i < 6; i++) noise(t + i * 0.11, 0.06, { vol: 0.16, freq: 900 + Math.random() * 700, q: 1.5, pan: p }); },
    scare: (t, p) => { noise(t, 0.25, { vol: 0.14, freq: 800, sweep: 4, q: 0.8, pan: p }); tone(500, t, 0.2, { type: 'triangle', vol: 0.1, slide: 2, pan: p }); },
    bird: (t, p) => chirp(t, p, 0.07),
    swoop: (t, p) => { noise(t, 0.6, { vol: 0.08, freq: 600, sweep: 5, q: 0.6, pan: p }); chirp(t + 0.4, p, 0.07, 3600); },
    snore: (t, p) => { tone(110, t, 0.7, { type: 'sawtooth', vol: 0.06, filter: 300, slide: 0.8, a: 0.25, pan: p }); },
    poison: (t, p) => { tone(400, t, 0.5, { type: 'triangle', vol: 0.12, slide: 0.4, pan: p }); tone(300, t + 0.25, 0.6, { type: 'triangle', vol: 0.1, slide: 0.5, pan: p }); },
    lose: (t, p) => [67, 63, 60].forEach((n, i) => tone(midi(n), t + i * 0.16, 0.4, { type: 'triangle', vol: 0.13, pan: p })),
    union: (t, p) => [60, 64, 67, 72].forEach((n) => tone(midi(n), t, 1.2, { type: 'sine', vol: 0.07, a: 0.08, pan: p })),
    sugar: (t, p) => tone(midi(91), t, 0.18, { vol: 0.06, pan: p }),
    merge: (t, p) => { for (let i = 0; i < 8; i++) tone(midi(60 + i * 3), t + i * 0.06, 0.4, { type: 'triangle', vol: 0.08, pan: p }); },
    clash: (t, p) => { tone(220, t, 0.18, { type: 'sawtooth', vol: 0.08, slide: 0.5, filter: 1500, pan: p }); noise(t, 0.12, { vol: 0.12, freq: 2000, pan: p }); },
    thunder: (t) => { noise(t, 2.4, { vol: 0.5, type: 'lowpass', freq: 400, sweep: 0.2, a: 0.02 }); noise(t + 0.05, 0.2, { vol: 0.25, type: 'highpass', freq: 2000 }); },
    gong: (t) => { [1, 2.76, 5.4].forEach((m, i) => tone(110 * m, t, 2.2 - i * 0.5, { vol: 0.12 / (i + 1), a: 0.01 })); },
    win: (t) => { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.1, 0.7, { type: 'triangle', vol: 0.14 })); [60, 67, 72].forEach((n) => tone(midi(n), t + 0.75, 1.4, { type: 'sine', vol: 0.08, a: 0.05 })); },
    owl: (t, p) => { tone(midi(62), t, 0.35, { vol: 0.08, a: 0.06, slide: 0.94, pan: p }); tone(midi(59), t + 0.5, 0.6, { vol: 0.08, a: 0.06, slide: 0.92, pan: p }); },
    dawn: (t) => { for (let i = 0; i < 4; i++) chirp(t + i * 0.35, Math.random() * 1.6 - 0.8, 0.06, 2800 + Math.random() * 1200); },
    night: (t) => { tone(midi(45), t, 2.4, { vol: 0.07, a: 0.6 }); tone(midi(52), t + 0.2, 2.2, { vol: 0.05, a: 0.6 }); },
    mutate: (t) => { for (let i = 0; i < 12; i++) tone(midi(72 + (i % 6) * 2), t + i * 0.04, 0.3, { type: 'triangle', vol: 0.06 }); },
    whoosh: (t, p) => noise(t, 0.5, { vol: 0.12, freq: 400, sweep: 6, q: 0.6, pan: p }),
    title: (t) => { tone(midi(48), t, 1.6, { vol: 0.12, a: 0.05, type: 'triangle' }); [60, 67, 72, 79].forEach((n, i) => tone(midi(n), t + 0.08 * i, 1.0, { type: 'triangle', vol: 0.08 })); },
  };

  const last = {};
  function sfx(name, o = {}) {
    if (!ac || !prefs.sound || !FX[name]) return;
    const t = now();
    if (last[name] && t - last[name] < (o.gap ?? 0.06)) return; // the same sound piling up sounds like noise
    last[name] = t;
    const v = o.vol ?? 1;
    if (v <= 0.02) return;
    const g = ac.createGain(); g.gain.value = v; g.connect(sfxBus);
    const saved = sfxBus; sfxBus = g;
    try { FX[name](t + 0.01, o.pan || 0, o); } finally { sfxBus = saved; }
  }

  // ---- rain: a loop of filtered noise while it falls
  function setRain(kind) {
    if (!ac) return;
    if (rainNode) { const r = rainNode; r.g.gain.setTargetAtTime(0.0001, now(), 0.6); setTimeout(() => r.s.stop(), 3000); rainNode = null; }
    if (!kind || !prefs.sound) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'storm' ? 1400 : 2600;
    const g = ac.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(kind === 'storm' ? 0.28 : 0.18, now(), 0.8);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    rainNode = { s, g };
  }

  // ---- the music: a slow generative forest piece; darker and sparser at night
  const DAY_CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
  const NIGHT_CHORDS = [[57, 60, 64], [52, 55, 59], [53, 57, 60], [52, 56, 59]]; // Am Em F E
  const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
  function pad(notes, t, dur) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 - night * 450;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 1.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    f.connect(g); g.connect(musicBus);
    for (const n of notes) for (const det of [-6, 6]) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n - 12); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 1.6);
    }
  }
  function pluck(n, t) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n);
    const g = ac.createGain(); env(g, t, 0.01, 0.07, 1.4);
    o.connect(g); g.connect(musicBus); g.connect(delay);
    o.start(t); o.stop(t + 1.5);
  }
  function crickets(t) {
    for (let i = 0; i < 6; i++) tone(4300 + Math.random() * 300, t + i * 0.05, 0.025, { vol: 0.025 * night, pan: Math.random() * 2 - 1, bus: musicBus });
  }
  function schedule() {
    if (!ac || ac.state !== 'running') return;
    const t = now(), BAR = 8;
    while (nextBar < t + 0.4) {
      const chords = night > 0.5 ? NIGHT_CHORDS : DAY_CHORDS;
      pad(chords[barIndex % chords.length], nextBar, BAR);
      barIndex++;
      nextBar += BAR;
    }
    if (t > nextPluck) {
      nextPluck = t + (night > 0.5 ? 1.6 : 0.8) + Math.random() * 1.4;
      pluck(SCALE[Math.floor(Math.random() * SCALE.length)] + (night > 0.5 ? -12 : 0), t + 0.05);
    }
    if (t > nextBird) { // the forest around: birds by day, crickets and an owl at night
      nextBird = t + 3 + Math.random() * 6;
      if (night < 0.4) chirpAmb(t); else if (Math.random() < 0.25) FX.owl(t, Math.random() * 1.6 - 0.8); else crickets(t);
    }
  }
  function chirpAmb(t) { const saved = sfxBus; sfxBus = musicBus; chirp(t, Math.random() * 2 - 1, 0.05, 2600 + Math.random() * 1800); sfxBus = saved; }

  // ---- voice lines for the intro
  function voice(n) {
    if (!prefs.sound) return;
    let a = voices[n];
    if (!a) { a = new Audio('art/voice/intro_' + n + '.mp3'); a.preload = 'auto'; voices[n] = a; }
    try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* no audio here */ }
    if (ac && musicBus && prefs.music) { // the music steps back while the narrator speaks
      musicBus.gain.setTargetAtTime(0.12, now(), 0.15);
      musicBus.gain.setTargetAtTime(0.32, now() + 2.8, 0.6);
    }
  }
  function preloadVoices() { for (const n of [1, 2, 3]) if (!voices[n]) { const a = new Audio('art/voice/intro_' + n + '.mp3'); a.preload = 'auto'; voices[n] = a; } }

  function toggleMusic() { prefs.music = !prefs.music; savePrefs(); if (musicBus) musicBus.gain.setTargetAtTime(prefs.music ? 0.32 : 0, now(), 0.3); return prefs.music; }
  function toggleSound() { prefs.sound = !prefs.sound; savePrefs(); if (sfxBus) sfxBus.gain.setTargetAtTime(prefs.sound ? 0.7 : 0, now(), 0.1); if (!prefs.sound) setRain(null); return prefs.sound; }

  window.MF_AUDIO = {
    unlock, sfx, voice, preloadVoices, setRain, toggleMusic, toggleSound,
    setNight(v) { night = v; },
    get music() { return prefs.music; }, get sound() { return prefs.sound; },
    get ready() { return !!ac && ac.state === 'running'; },
  };
})();

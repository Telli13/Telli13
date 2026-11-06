/* Synthesized sound effects (Web Audio, no files) — same approach as Mycelium Forest's audio.js.
 * EF.audio.play(name, strength 0..1.4)
 */
'use strict';

(() => {
  let ac = null, out = null, noise = null, muted = false;
  try { muted = localStorage.getItem('egg-fighters-mute') === '1'; } catch (e) { /* ignore */ }

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    out = ac.createGain(); out.gain.value = muted ? 0 : 0.6; out.connect(ac.destination);
    const len = ac.sampleRate;
    noise = ac.createBuffer(1, len, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  function noiseHit(t, freq, q, peak, dec, type = 'bandpass') {
    const s = ac.createBufferSource(); s.buffer = noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); env(g, t, 0.003, peak, dec);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
    return f;
  }

  function thump(t, f0, f1, peak, dec) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dec);
    const g = ac.createGain(); env(g, t, 0.004, peak, dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
  }

  const sounds = {
    jab(s) { const t = ac.currentTime; thump(t, 190, 70, 0.5 * s + 0.2, 0.12); noiseHit(t, 1800, 0.8, 0.35 * s + 0.1, 0.08); },
    heavy(s) { const t = ac.currentTime; thump(t, 150, 45, 0.8, 0.22); noiseHit(t, 1200, 0.7, 0.5 * s, 0.16); },
    launch(s) { const t = ac.currentTime; thump(t, 130, 38, 1, 0.3); noiseHit(t, 900, 0.6, 0.6, 0.25); noiseHit(t + 0.02, 3500, 1.2, 0.3, 0.12); },
    slash(s) { const t = ac.currentTime; thump(t, 160, 50, 0.8, 0.22); noiseHit(t, 4200, 2.5, 0.45, 0.18, 'highpass'); },
    crack(s) { const t = ac.currentTime; for (let i = 0; i < 3; i++) noiseHit(t + i * 0.018, 2500 + Math.random() * 2500, 4, 0.25 * s + 0.08, 0.04); },
    whoosh(s) {
      const t = ac.currentTime;
      const f = noiseHit(t, 600, 1.4, 0.12 + 0.12 * s, 0.16);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
    },
    dash() { const t = ac.currentTime; const f = noiseHit(t, 500, 1, 0.2, 0.2); f.frequency.exponentialRampToValueAtTime(1600, t + 0.18); },
    land(s) { const t = ac.currentTime; thump(t, 110, 40, 0.5 * s + 0.2, 0.2); noiseHit(t, 400, 0.6, 0.3 * s, 0.15); },
    ko() { const t = ac.currentTime; thump(t, 90, 30, 1, 0.6); noiseHit(t, 700, 0.5, 0.6, 0.5); },
  };

  EF.audio = {
    unlock() { if (init() && ac.state === 'suspended') ac.resume(); },
    play(name, s = 1) {
      if (!ac || muted || !sounds[name]) return;
      try { sounds[name](s); } catch (e) { /* audio must never break the game */ }
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('egg-fighters-mute', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (out) out.gain.value = muted ? 0 : 0.6;
      return !muted;
    },
    get muted() { return muted; },
  };
})();

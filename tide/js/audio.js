// Звук: всё синтезируется WebAudio, файлов нет
'use strict';
const A = (() => {
  let ctx, master, on = true, windG, windF;
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = on ? .5 : 0; master.connect(ctx.destination);
    ambient();
  }
  function tone(f, t0, dur, type, vol, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .2, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  let nbuf;
  function noise(t0, dur, freq, vol, q) {
    if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + t0;
    s.buffer = nbuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05); return { f, g };
  }
  function ambient() {
    // ветер
    const s = ctx.createBufferSource(); nbuf || noise(0, .01, 100, .0001); s.buffer = nbuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ctx.createGain(); g.gain.value = .09;
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = .13; lg.gain.value = 180; l.connect(lg); lg.connect(f.frequency); l.start();
    s.connect(f); f.connect(g); g.connect(master); s.start(); windG = g; windF = f;
    // тихая музыка: медленные аккорды
    const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]]; let i = 0;
    const next = () => {
      if (!ctx) return; const c = chords[i++ % 4];
      c.forEach((fr, k) => { tone(fr, k * .15, 7, 'sine', .035); tone(fr * 2, 1 + k * .4, 5, 'triangle', .012); });
      setTimeout(next, 7000);
    };
    next();
  }
  const sfx = {
    pick: () => tone(520, 0, .09, 'triangle', .18, 760),
    pop: () => tone(300 + Math.random() * 200, 0, .06, 'sine', .12, 600),
    throw: () => noise(0, .18, 900, .12, .8),
    thud: () => tone(110, 0, .12, 'sine', .2, 60),
    no: () => tone(160, 0, .14, 'square', .06, 120),
    burn: n => { noise(0, .3, 1800, .12, .6); const p = 440 * Math.pow(1.0595, Math.min(n || 0, 24)); tone(p, 0, .25, 'triangle', .16); tone(p * 1.5, .05, .25, 'sine', .08); },
    buy: () => { tone(660, 0, .1, 'triangle', .15); tone(880, .08, .16, 'triangle', .15); },
    art: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .5, 'sine', .13)),
    ring: () => { for (let i = 0; i < 3; i++) { tone(440, i * 1.4, .9, 'sine', .1); tone(480, i * 1.4, .9, 'sine', .1); } },
    level: () => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, i * .11, .9, 'triangle', .14)); noise(0, 1.2, 600, .1, .4); }
  };
  return {
    unlock, play(n, a) { if (ctx && on && sfx[n]) try { sfx[n](a); } catch (e) { } },
    wind(v) { if (windG) { windG.gain.value = .09 + v * .5; windF.frequency.value = 420 + v * 500; } },
    set(v) { on = !!v; if (master) master.gain.value = on ? .5 : 0; }
  };
})();

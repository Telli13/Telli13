'use strict';
// ===== Звук: эффекты на ZzFX (MIT) + генеративная музыка на WebAudio =====
const SFX_DEF = {
  grow: [.5, .05, 320, .01, .03, .08, 0, 1.6, 12, 0, 0, 0, 0, 0, 0, 0, 0, .7, .02],
  link: [.7, 0, 520, .01, .08, .22, 0, 1.4, 0, 0, 260, .06, 0, 0, 0, 0, .05, .7, .03],
  plant: [.6, .05, 180, .01, .04, .12, 0, 2, 20, 0, 0, 0, 0, 0, 0, 0, 0, .8, .02],
  pop: [.8, .05, 440, 0, .02, .1, 0, 1.8, 0, 0, 220, .03, 0, 0, 0, 0, 0, .8, .02],
  gold: [.8, 0, 660, .01, .1, .3, 0, 1.2, 0, 0, 330, .05, .06, 0, 0, 0, .08, .7, .03],
  squash: [.9, .1, 140, 0, .02, .14, 4, 2.2, -8, 0, 0, 0, 0, 1.2, 0, .1, 0, .7, .03],
  hit: [.7, .1, 220, 0, .01, .07, 4, 1.5, -6, 0, 0, 0, 0, .8, 0, 0, 0, .8, .01],
  coin: [.6, 0, 880, 0, .04, .16, 0, 1.3, 0, 0, 440, .04, 0, 0, 0, 0, 0, .7, .02],
  err: [.5, 0, 110, .01, .05, .1, 2, 1.5, -4, 0, 0, 0, 0, 0, 0, 0, 0, .7, .02],
  level: [.9, 0, 392, .02, .2, .4, 0, 1.3, 0, 0, 196, .08, .09, 0, 0, 0, .12, .7, .05],
  boss: [1, 0, 70, .05, .3, .5, 2, 2.5, -1, 0, 0, 0, 0, .6, 0, .2, .1, .7, .08],
  thunder: [.9, 0, 60, .02, .2, .7, 4, 3, 0, 0, 0, 0, 0, 2.5, 0, .3, .1, .6, .1],
  quake: [1, 0, 50, .03, .3, .6, 3, 3, -1, 0, 0, 0, .1, 2, 0, .4, 0, .7, .1],
  poison: [.7, 0, 300, .05, .2, .4, 1, 2, -3, 0, 0, 0, 0, 1, 20, 0, .1, .6, .1],
  click: [.4, 0, 600, 0, .01, .04, 0, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, .7, .01],
  crumble: [.6, .1, 90, 0, .05, .25, 4, 2, -2, 0, 0, 0, 0, 2, 0, .2, 0, .6, .05],
  fanfare: [1, 0, 523, .03, .25, .5, 0, 1.2, 0, 0, 262, .1, .1, 0, 0, 0, .15, .7, .06],
  splash: [.6, .1, 500, .01, .05, .2, 0, 2.5, -20, 0, 0, 0, 0, .5, 0, 0, 0, .6, .05],
};
const Snd = {
  on: true, music: true, buf: {}, ready: false, last: {},
  unlock() {
    if (this.ready) { if (ZZFX.audioContext.state === 'suspended') ZZFX.audioContext.resume(); return; }
    this.ready = true;
    try { ZZFX.audioContext.resume(); } catch (e) { }
    ZZFX.volume = .35;
    Music.start();
  },
  play(name, rate, vol) {
    if (!this.on || !this.ready) return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 35) return; this.last[name] = now;
    try {
      let b = this.buf[name];
      if (!b) b = this.buf[name] = ZZFX.buildSamples(...SFX_DEF[name]);
      ZZFX.playSamples([b], vol || 1, rate || 1);
    } catch (e) { }
  },
};

// Мягкая калимба-эмбиент: пентатоника, меняется с сезоном
const Music = {
  timer: 0, step: 0, gain: null, t: 0, mood: 0, tense: false,
  scales: [[0, 2, 4, 7, 9], [0, 2, 5, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8]],
  roots: [57, 60, 55, 53],
  start() {
    const ac = ZZFX.audioContext;
    this.gain = ac.createGain(); this.gain.gain.value = Snd.music ? .5 : 0;
    const comp = ac.createDynamicsCompressor(); this.gain.connect(comp); comp.connect(ac.destination);
    this.t = ac.currentTime + .2;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 120);
  },
  setOn(v) { Snd.music = v; if (this.gain) this.gain.gain.setTargetAtTime(v ? .5 : 0, ZZFX.audioContext.currentTime, .3); },
  note(midi, t, dur, vol, type) {
    const ac = ZZFX.audioContext, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + .05);
  },
  tick() {
    const ac = ZZFX.audioContext;
    if (!Snd.music || ac.state !== 'running' || document.hidden) { this.t = ac.currentTime + .2; return; }
    const beat = this.tense ? .2 : .3;
    while (this.t < ac.currentTime + .35) {
      const s = this.step++, sc = this.scales[this.mood % 4], root = this.roots[this.mood % 4];
      const bar = Math.floor(s / 16), chord = [0, 3, 1, 4][bar % 4];
      const pick = i => root + sc[(i + chord) % 5] + 12 * Math.floor((i + chord) / 5);
      if (s % 16 === 0) { this.note(pick(0) - 24, this.t, 2.6, .16, 'triangle'); this.note(pick(2) - 12, this.t, 2.6, .05, 'sine'); }
      const h = (s * 7 + bar * 3) % 11;
      if (s % 2 === 0 || h < 3) {
        const idx = [0, 2, 4, 1, 3, 5, 2, 6][(s + (h % 3)) % 8];
        this.note(pick(idx) + 12, this.t, .9, s % 4 === 0 ? .1 : .06, 'sine');
        if (h === 5) this.note(pick(idx + 2) + 24, this.t + beat / 2, .5, .03, 'sine');
      }
      if (this.tense && s % 4 === 0) this.note(root - 24, this.t, .25, .14, 'square');
      this.t += beat;
    }
  },
};
function buzz(ms) { if (typeof S !== 'undefined' && S.set.vib && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { } } }

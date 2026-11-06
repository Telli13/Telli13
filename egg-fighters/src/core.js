/* Chocolate Egg Fighters — shared namespace and small math helpers.
 * Every other file adds itself to window.EF (classic scripts, so the game also runs from file://
 * inside the Android WebView, where ES modules are blocked).
 */
'use strict';

window.EF = window.EF || {};

(() => {
  const TAU = Math.PI * 2;

  const M = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    /** frame-rate independent exponential approach */
    damp: (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt),
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    randSign: () => (Math.random() < 0.5 ? -1 : 1),
    chance: (p) => Math.random() < p,
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    wrapAngle(a) {
      a = (a + Math.PI) % TAU;
      if (a < 0) a += TAU;
      return a - Math.PI;
    },
    /** turn angle `a` toward `b` by exponential damping along the shortest way */
    dampAngle(a, b, rate, dt) {
      const d = M.wrapAngle(b - a);
      return a + d * (1 - Math.exp(-rate * dt));
    },
    len2: (x, z) => Math.sqrt(x * x + z * z),
    smoothstep(a, b, v) {
      const t = M.clamp((v - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
  };

  /** A damped spring, used for the inertia of the body (lean, wobble, squash). */
  class Spring {
    constructor(stiffness = 120, damping = 12, value = 0) {
      this.k = stiffness; this.d = damping;
      this.value = value; this.vel = 0; this.target = value;
    }
    impulse(v) { this.vel += v; }
    step(dt) {
      const a = (this.target - this.value) * this.k - this.vel * this.d;
      this.vel += a * dt;
      this.value += this.vel * dt;
      return this.value;
    }
  }

  EF.M = M;
  EF.Spring = Spring;
})();

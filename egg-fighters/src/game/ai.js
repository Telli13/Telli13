/* CPU controller. Writes the same inputs a player would (move vector + attack/heavy/dash presses).
 * Behaviour mirrors the reference: keep moving (approach, circle, back off), burst in with
 * tap-tap strings of varying length and rhythm, dash in/out, sometimes sidestep an attack.
 * Every decision has random timing so two CPUs never move in sync.
 */
'use strict';

(() => {
  const { M } = EF;

  class AIController {
    constructor(opts = {}) {
      this.aggr = opts.aggression ?? 0.7;   // how often it goes in
      this.skill = opts.skill ?? 0.55;      // evasion / spacing
      this.intent = 'approach';
      this.t = M.rand(0.1, 0.4);
      this.circleSign = M.randSign();
      this.combo = 0; this.nextPress = 0;
      this.afterDash = null;
      this.stopFor = 0;
    }

    press(f, k) { f.ctrl[k] = true; }

    update(f, dt) {
      const o = f.opponent;
      const dx = o.x - f.x, dz = o.z - f.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const ux = dx / d, uz = dz / d;
      const px = -uz * this.circleSign, pz = ux * this.circleSign;
      this.t -= dt;
      this.stopFor -= dt;

      // executing a combo string: tap-tap with a human-ish rhythm
      if (this.combo > 0) {
        this.nextPress -= dt;
        const canChain = f.state === 'move' ||
          (f.state === 'attack' && f.moveTime > f.move.startup + f.move.active);
        if (this.nextPress <= 0 && canChain) {
          if (this.combo === 1 && M.chance(0.25)) this.press(f, 'heavy'); else this.press(f, 'attack');
          this.combo--;
          // mostly quick taps, sometimes a short pause (HIT-HIT … HIT-HIT)
          this.nextPress = M.chance(0.25) ? M.rand(0.22, 0.38) : M.rand(0.02, 0.1);
          if (this.combo === 0) { this.intent = M.chance(0.45) ? 'retreat' : 'circle'; this.t = M.rand(0.25, 0.6); }
        }
        this.out(f, ux * 0.6, uz * 0.6);
        return;
      }
      if (this.afterDash && f.state === 'dash') {
        if (f.stateTime > this.afterDash) { this.press(f, 'attack'); this.afterDash = null; }
      } else if (f.state !== 'dash') this.afterDash = null;

      if (this.t <= 0) this.decide(f, o, d, ux, uz, px, pz);

      // steering for the current intent
      let mx = 0, mz = 0;
      switch (this.intent) {
        case 'approach': mx = ux + px * 0.35; mz = uz + pz * 0.35; break;
        case 'circle': {
          const k = M.clamp((d - 2.3) * 0.6, -0.8, 0.8);
          mx = px * 0.9 + ux * k; mz = pz * 0.9 + uz * k; break;
        }
        case 'retreat': mx = -ux + px * 0.5; mz = -uz + pz * 0.5; break;
        case 'wait': mx = px * 0.4; mz = pz * 0.4; break;
      }
      if (this.stopFor > 0) { mx *= 0.15; mz *= 0.15; }
      this.out(f, mx, mz);
    }

    decide(f, o, d, ux, uz, px, pz) {
      this.t = M.rand(0.12, 0.34);
      if (M.chance(0.18)) this.circleSign *= -1;
      if (M.chance(0.08)) this.stopFor = M.rand(0.1, 0.25);
      const oThreat = o.state === 'attack' && o.moveTime < o.move.startup && d < 2.3;
      if (oThreat && M.chance(0.45 * this.skill) && f.state === 'move') {
        // sidestep or hop back
        const side = M.chance(0.6);
        this.forceDir = side ? [px, pz] : [-ux, -uz];
        this.press(f, 'dash');
        this.intent = 'circle';
        return;
      }
      if (o.state === 'down' || o.state === 'getup' || o.state === 'air') { this.intent = d > 2.6 ? 'approach' : 'wait'; return; }
      if (d > 4.2) {
        this.intent = 'approach';
        if (M.chance(0.5 * this.aggr) && f.dashCooldown <= 0) {
          this.forceDir = [ux, uz]; this.press(f, 'dash');
          if (d < 5.5 && M.chance(0.6)) this.afterDash = M.rand(0.06, 0.13);
        }
      } else if (d > 1.75) {
        if (M.chance(0.4 * this.aggr) && f.dashCooldown <= 0) {
          this.forceDir = [ux, uz]; this.press(f, 'dash');
          this.afterDash = M.rand(0.03, 0.1);
        } else this.intent = M.chance(0.45 + 0.4 * this.aggr) ? 'approach' : 'circle';
      } else if (M.chance(0.55 + 0.4 * this.aggr)) {
        this.combo = M.pick([2, 2, 3, 3, 4, 4, 4]);
        this.nextPress = M.rand(0, 0.08);
      } else {
        this.intent = M.chance(0.5) ? 'retreat' : 'circle';
        if (M.chance(0.55 * this.skill) && f.dashCooldown <= 0) {
          this.forceDir = [-ux + px, -uz + pz]; this.press(f, 'dash');
        }
      }
    }

    out(f, mx, mz) {
      if (this.forceDir) { [mx, mz] = this.forceDir; this.forceDir = null; }
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
      f.ctrl.mx = mx; f.ctrl.mz = mz;
    }
  }

  EF.AIController = AIController;
})();

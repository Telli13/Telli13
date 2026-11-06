/* Game management: one 1v1 round. Owns the fighters, runs the fixed-step simulation,
 * hit-stop and slow-motion clocks, and turns fighter events into effects, sound and camera moves.
 */
'use strict';

(() => {
  const { M } = EF;
  const STEP = 1 / 120;

  const CRUMB_BROWN = [0x6b3a22, 0x7a4429, 0x5a2f1b].map((h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; });

  class Match {
    /**
     * @param app   EF.app (scene, camera, arena)
     * @param opts  { ids: ['ninja','samurai'], controllers: ['player'|'cpu', …], onEnd(result) }
     */
    constructor(app, opts) {
      this.app = app;
      this.opts = opts;
      const scene = app.scene;
      this.fx = app.fx || (app.fx = new EF.FX(scene, app.arena));
      this.fighters = opts.ids.map((id, i) => {
        const f = new EF.Fighter(EF.roster[id], i);
        f.x = i ? 2.6 : -2.6; f.z = M.rand(-0.6, 0.6);
        scene.add(f.rig.root);
        return f;
      });
      const [a, b] = this.fighters;
      a.opponent = b; b.opponent = a;
      a.facing = a.angleTo(b); b.facing = b.angleTo(a);
      this.fighters.forEach((f, i) => {
        f.controller = opts.controllers[i] === 'player'
          ? new EF.PlayerController(app.camera)
          : new EF.AIController({ aggression: M.rand(0.6, 0.85), skill: M.rand(0.45, 0.7) });
        f.smears = [this.fx.smear(0xfff4d6), this.fx.smear(0xfff4d6)];
        if (opts.onFighter) opts.onFighter(f);
        EF.animator.update(f, 0.016, 0);
      });
      app.camera.yaw = 0;
      this.labels = opts.ids.map((id, i) => (opts.controllers[i] === 'player' ? 'Ты: ' : 'CPU: ') + EF.roster[id].name);
      this.hud = opts.headless ? null : new EF.hud.HUD(this.fighters, this.labels);
      this.acc = 0;
      this.hitstop = 0; this.slowmo = 0;
      this.time = 0;
      this.intro = opts.headless ? 0 : 1.1;
      this.over = false; this.overT = 0;
      this.stats = { hits: 0, launches: 0, maxCombo: 0, wallHits: 0 };
      if (this.hud) this.hud.say('FIGHT!', 1.0);
    }

    step(dt) {
      const fs = this.fighters;
      this.time += dt;
      for (const f of fs) {
        if (this.intro > 0 || this.over) { f.ctrl.mx = f.ctrl.mz = 0; f.ctrl.attack = f.ctrl.heavy = f.ctrl.dash = false; }
        else if (f.state !== 'ko') f.controller.update(f, dt);
        EF.combat.think(f, dt);
      }
      for (const f of fs) EF.movement.step(f, dt, this.app.arena);
      EF.movement.separate(fs[0], fs[1]);
      EF.combat.checkHit(fs[0], fs[1]);
      EF.combat.checkHit(fs[1], fs[0]);
      for (const f of fs) {
        for (const e of f.events) this.handle(f, e);
        f.events.length = 0;
      }
      if (!this.over) {
        const loser = fs.find((f) => f.hp <= 0);
        if (loser) { this.over = true; this.loser = loser; this.winner = loser.opponent; }
      }
    }

    handle(f, e) {
      const fx = this.fx, cam = this.app.camera, headless = this.opts.headless;
      if (e.type === 'hit') {
        this.stats.hits++;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, f.hitCount);
        if (e.move.lift || e.ko) this.stats.launches++;
        this.hitstop = Math.max(this.hitstop, e.move.hitstop * (e.ko ? 2.4 : 1));
        e.target.anim.shake = 0.05 + e.strength * 0.05;
        if (headless) return;
        const p = new THREE.Vector3(e.info.x, e.info.y, e.info.z);
        fx.impact(p, e.strength);
        fx.crumbsAt(p, e.info.dirX, e.info.dirZ, Math.round(4 + e.strength * 10), CRUMB_BROWN);
        cam.addShake(e.move.shake * (e.ko ? 2 : 1));
        EF.audio.play(e.move.sound, e.strength);
        if (e.ko || (e.move.finisher && M.chance(0.3))) {
          fx.finisher();
          this.slowmo = e.ko ? 0.9 : 0.4;
          cam.finisher(p);
          if (e.ko) EF.audio.play('ko');
        }
      } else if (headless) {
        if (e.type === 'wall') this.stats.wallHits++;
      } else if (e.type === 'swing') {
        EF.audio.play('whoosh', e.move.damage / 10);
      } else if (e.type === 'dash') {
        fx.dust(new THREE.Vector3(f.x, 0, f.z), 3, 0.5);
        EF.audio.play('dash');
      } else if (e.type === 'land') {
        fx.dust(new THREE.Vector3(f.x, 0, f.z), 6, 0.8 * e.strength + 0.3);
        cam.addShake(0.12 * e.strength);
        EF.audio.play('land', e.strength);
      } else if (e.type === 'wall') {
        this.stats.wallHits++;
        cam.addShake(0.15);
        fx.dust(new THREE.Vector3(f.x, 0.6, f.z), 5, 0.6);
        EF.audio.play('land', 1);
      }
    }

    /** smear trails follow the striking fist during the swing */
    sampleSmears() {
      for (const f of this.fighters) {
        const mv = f.move;
        const swinging = f.state === 'attack' && mv && f.moveTime > mv.startup * 0.4 && f.moveTime < mv.startup + mv.active + 0.05;
        if (!swinging) continue;
        const both = mv.anim === 'dashStrike' || mv.anim === 'chop';
        const arms = mv.anim === 'punchL' ? [0] : both ? [0, 1] : [1];
        for (const i of arms) {
          const arm = i ? f.rig.armR : f.rig.armL;
          const tip = new THREE.Vector3();
          const wpn = f.rig.handWeapon[mv.weapon];
          if (wpn && wpn.visible) tip.set(0, -1.0, 0).applyMatrix4(arm.fist.matrixWorld);
          else arm.fist.getWorldPosition(tip);
          const base = new THREE.Vector3();
          arm.fist.getWorldPosition(base);
          const inner = base.lerp(arm.pivot.getWorldPosition(new THREE.Vector3()), wpn && wpn.visible ? 0.2 : 0.55);
          f.smears[i].push(tip, inner);
        }
      }
    }

    /** advance by real time dt (handles hit-stop and slow-mo), animate, update fx/camera/hud */
    update(realDt) {
      let simDt;
      if (this.hitstop > 0) {
        this.hitstop -= realDt;
        simDt = 0;
      } else {
        for (const f of this.fighters) f.anim.shake = 0;
        this.slowmo = Math.max(0, this.slowmo - realDt);
        simDt = realDt * (this.slowmo > 0 ? 0.28 : 1);
      }
      if (this.intro > 0) this.intro -= realDt;
      this.acc += simDt;
      let n = 0;
      while (this.acc >= STEP && n < 12) { this.step(STEP); this.acc -= STEP; n++; }
      for (const f of this.fighters) EF.animator.update(f, simDt, this.time);
      for (const f of this.fighters) f.rig.root.updateMatrixWorld(true);
      this.sampleSmears();
      for (const f of this.fighters) f.smears.forEach((s) => s.update(simDt || 0.0001));
      this.fx.update(simDt);
      const [a, b] = this.fighters;
      this.app.camera.update(realDt, a, b);
      if (this.hud) this.hud.update(realDt);
      if (this.over) {
        this.overT += realDt;
        if (this.overT > 0.5 && !this.koShown && this.hud) { this.koShown = true; this.hud.say('K.O.!', 2.2, 'ko'); }
        if (this.overT > 2.8 && !this.ended) {
          this.ended = true;
          this.opts.onEnd && this.opts.onEnd(this);
        }
      }
    }

    /** run the simulation only (no drawing), for automated tests */
    simulate(seconds) {
      const steps = Math.round(seconds / STEP);
      for (let i = 0; i < steps && !this.over; i++) {
        if (this.intro > 0) this.intro -= STEP;
        this.step(STEP);
      }
      return this;
    }

    destroy() {
      for (const f of this.fighters) {
        this.app.scene.remove(f.rig.root);
        f.smears.forEach((s) => this.app.scene.remove(s.mesh));
      }
      if (this.hud) this.hud.destroy();
    }
  }

  EF.Match = Match;
  EF.STEP = STEP;
})();

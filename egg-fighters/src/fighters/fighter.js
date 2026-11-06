/* A fighter in a match: model + simulation state. The systems that act on it are separate:
 *   movement.js  (locomotion, dash, knock-back, landing)   combat.js (attacks, hits)
 *   animator.js  (procedural poses)                        controllers: input.js / ai.js
 *
 * States: move · dash · attack · hit · air · down · getup · ko
 */
'use strict';

(() => {
  class Fighter {
    constructor(def, slot) {
      this.def = def;
      this.slot = slot;                 // 0 or 1
      this.stats = def.stats;
      this.rig = EF.model.buildFighterModel(def);
      this.x = 0; this.z = 0; this.y = 0;
      this.vx = 0; this.vz = 0; this.vy = 0;
      this.facing = 0;
      this.state = 'move';
      this.stateTime = 0;
      this.maxHp = 100;
      this.hp = 100;
      this.opponent = null;
      this.controller = null;
      // control input written by the controller each step
      this.ctrl = { mx: 0, mz: 0, attack: false, heavy: false, dash: false };
      this.buf = { attack: 0, heavy: 0, dash: 0 };   // input buffers (seconds left)
      // combat
      this.move = null; this.moveId = null; this.moveTime = 0; this.moveHit = false;
      this.comboIndex = 0; this.sinceAttack = 9;
      this.dashTime = 0; this.dashCooldown = 0; this.dashDirX = 0; this.dashDirZ = 0;
      this.hitstun = 0;
      this.tumble = 0; this.tumbleSpeed = 0;
      this.hitCount = 0;               // hits landed in the current combo (for the HUD)
      this.lastHitBy = 0;              // time since last hit taken
      this.events = [];                // things that happened this step (hits, dashes, landings) for fx/audio
      this.anim = EF.animator.createAnimState();
    }

    get alive() { return this.state !== 'ko'; }
    get vulnerable() { return !['down', 'getup', 'ko'].includes(this.state); }
    get airborne() { return this.state === 'air'; }

    setState(s) { this.state = s; this.stateTime = 0; }

    forward() { return { x: Math.sin(this.facing), z: Math.cos(this.facing) }; }

    distTo(o) { return Math.hypot(o.x - this.x, o.z - this.z); }

    angleTo(o) { return Math.atan2(o.x - this.x, o.z - this.z); }

    /** receive damage; Phase 3 routes this into the chocolate shells */
    takeDamage(amount, info) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.onDamage) this.onDamage(amount, info);
      return this.hp <= 0;
    }

    syncModel() {
      this.rig.root.position.set(this.x, 0, this.z);
      this.rig.root.rotation.y = this.facing;
    }
  }

  EF.Fighter = Fighter;
})();

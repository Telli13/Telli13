/* Combat: reading buffered inputs, starting moves, combo chaining, hit detection and hit reactions.
 * Damage itself goes through fighter.takeDamage() so the chocolate system (Phase 3) can hook in.
 */
'use strict';

(() => {
  const { M } = EF;
  const BUFFER = 0.22;

  function startAttack(f, id) {
    const mv = EF.moves[id];
    f.move = mv; f.moveId = id; f.moveTime = 0; f.moveHit = false;
    f.setState('attack');
    f.sinceAttack = 0;
    f.events.push({ type: 'swing', move: mv, id });
  }

  function comboAttack(f) {
    const list = f.def.moves.combo;
    const i = f.comboIndex % list.length;
    f.comboIndex = i + 1 >= list.length ? 0 : i + 1;
    startAttack(f, list[i]);
  }

  /** turn this step's controller presses into actions */
  function think(f, dt) {
    const b = f.buf, c = f.ctrl;
    for (const k of ['attack', 'heavy', 'dash']) {
      b[k] = Math.max(0, b[k] - dt);
      if (c[k]) b[k] = BUFFER;
      c[k] = false;
    }
    f.sinceAttack += dt;
    if (f.state !== 'attack' && f.sinceAttack > EF.COMBO_RESET) f.comboIndex = 0;
    if (f.state !== 'attack' && f.sinceAttack > 0.9) f.hitCount = 0;

    if (f.state === 'move') {
      if (b.dash && f.dashCooldown <= 0) { b.dash = 0; EF.movement.startDash(f); }
      else if (b.heavy) { b.heavy = 0; startAttack(f, f.def.moves.heavy); f.comboIndex = 0; }
      else if (b.attack) { b.attack = 0; comboAttack(f); }
    } else if (f.state === 'dash') {
      if (b.attack || b.heavy) { b.attack = b.heavy = 0; startAttack(f, f.def.moves.dash); }
    } else if (f.state === 'attack') {
      const mv = f.move;
      f.moveTime += dt * (f.stats.attackRate || 1);
      const afterActive = f.moveTime - (mv.startup + mv.active);
      if (afterActive > EF.COMBO_CANCEL) {
        const inCombo = f.def.moves.combo.includes(f.moveId);
        if (b.attack && inCombo && f.comboIndex !== 0) { b.attack = 0; comboAttack(f); return; }
        if (b.heavy && inCombo) { b.heavy = 0; startAttack(f, f.def.moves.heavy); f.comboIndex = 0; return; }
        if (b.dash && f.dashCooldown <= 0 && afterActive > 0.08) { b.dash = 0; EF.movement.startDash(f); return; }
      }
      if (f.moveTime >= mv.startup + mv.active + mv.recovery) {
        f.move = null;
        f.setState('move');
      }
    }
  }

  function segDist(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az;
    const t = M.clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
  }

  function checkHit(att, def) {
    if (att.state !== 'attack' || att.moveHit || !def.vulnerable) return;
    const mv = att.move, t = att.moveTime;
    if (t < mv.startup || t > mv.startup + mv.active) return;
    if (def.y > 1.8) return;
    const fw = att.forward();
    const d = segDist(def.x, def.z, att.x + fw.x * 0.2, att.z + fw.z * 0.2, att.x + fw.x * mv.reach, att.z + fw.z * mv.reach);
    if (d > mv.radius + 0.3) return;
    applyHit(att, def, mv);
  }

  function applyHit(att, def, mv) {
    att.moveHit = true;
    const fw = att.forward();
    let dx = def.x - att.x, dz = def.z - att.z;
    const l = Math.hypot(dx, dz) || 1;
    dx = dx / l * 0.5 + fw.x * 0.5; dz = dz / l * 0.5 + fw.z * 0.5;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;

    const strength = M.clamp(mv.damage / 10, 0.3, 1.4);
    const dmg = mv.damage * att.stats.power * M.rand(0.9, 1.1) * (def.airborne ? 0.8 : 1);
    const hitY = 1.15 + def.y + (mv.anim === 'uppercut' ? -0.15 : mv.anim === 'chop' ? 0.35 : 0) + M.rand(-0.12, 0.12);
    const info = {
      x: def.x - dx * 0.55, y: hitY, z: def.z - dz * 0.55, dirX: dx, dirZ: dz, strength, move: mv,
    };
    const ko = def.takeDamage(dmg, info);
    const w = def.stats.weight;
    let knock = mv.knock / w;

    if (mv.lift > 0 || def.airborne || ko) {
      const lift = (mv.lift || 3.2) / w * (ko ? 1.3 : 1);
      def.setState('air');
      def.vy = Math.max(def.vy * 0.25, 0) + lift;
      def.y = Math.max(def.y, 0.02);
      def.tumbleSpeed = -(5 + lift * 1.1) * M.rand(0.8, 1.2);
      knock *= ko ? 1.35 : 1.1;
    } else {
      def.setState('hit');
      def.hitstun = mv.hitstun;
    }
    def.vx = dx * knock; def.vz = dz * knock;
    def.facing = def.angleTo(att);
    def.move = null;
    def.comboIndex = 0;
    def.lastHitBy = 0;
    // body reactions: snap back, then fold over (animator springs)
    def.anim.lean.impulse(-14 * strength);
    def.anim.wobble.impulse(M.randSign() * 8 * strength);
    def.anim.squash.impulse(-4 * strength);
    def.anim.hurt = 0.45;
    att.anim.squash.impulse(2.5 * strength);
    att.hitCount++;
    att.events.push({ type: 'hit', move: mv, strength, ko, info, target: def });
  }

  EF.combat = { think, checkHit, startAttack };
})();

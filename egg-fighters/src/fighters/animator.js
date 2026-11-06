/* Procedural animation: turns a fighter's simulation state into poses of the blocky rig.
 * No keyframes: every pose is built from the move phase + damped springs, so hits, leans and
 * recoveries always blend with inertia (the "alive, slightly chaotic" feel of the reference).
 */
'use strict';

(() => {
  const { M, Spring } = EF;
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) * (1 - t);

  function createAnimState() {
    return {
      lean: new Spring(150, 13),     // pitch (+ = bend forward)
      roll: new Spring(120, 12),
      wobble: new Spring(170, 8),    // quick side wobble after hits / landings
      squash: new Spring(220, 11),
      walk: 0, rotX: 0, rotY: 0, bodyY: EF.model.BODY_Y,
      hurt: 0, shake: 0, blink: 2,
      arms: { lx: -1.2, lz: 0.2, le: 0, rx: -1.0, rz: -0.2, re: 0 },
      legs: { l: 0, r: 0 },
    };
  }

  /** pose of a move at the current move time; returns overrides on top of the guard pose */
  function movePose(f, P) {
    const mv = f.move, t = f.moveTime;
    const s = M.clamp(t / mv.startup, 0, 1);
    const a = M.clamp((t - mv.startup) / mv.active, 0, 1);
    const r = M.clamp((t - mv.startup - mv.active) / mv.recovery, 0, 1);
    const inStart = t < mv.startup, inActive = !inStart && a < 1;
    const back = 1 - ease(r);          // 1 while striking, fades to 0 in recovery
    switch (mv.anim) {
      case 'punchL':
      case 'punchR': {
        const L = mv.anim === 'punchL', sg = L ? 1 : -1;
        const k = L ? 'l' : 'r';
        if (inStart) {
          P[k + 'x'] = M.lerp(P[k + 'x'], -0.85, ease(s)); P[k + 'e'] = -0.06; P.twist = -0.35 * sg * ease(s);
        } else {
          const e = inActive ? easeOut(a) : back;
          P[k + 'x'] = M.lerp(P[k + 'x'], -1.62, e); P[k + 'z'] = 0; P[k + 'e'] = 0.42 * e;
          P.twist = 0.42 * sg * e; P.lean += 0.18 * e;
        }
        break;
      }
      case 'spin': {
        // the "TURN" between strings: a full body spin with arms out, ending in a backfist
        if (inStart) {
          P.spin = -ease(s) * Math.PI * 2;
          P.lz = -1.25; P.rz = 1.25; P.lx = -0.3; P.rx = -0.3; P.y -= 0.06 * Math.sin(s * Math.PI);
        } else {
          const e = inActive ? easeOut(a) : back;
          P.rx = M.lerp(P.rx, -1.55, e); P.rz = M.lerp(-0.2, 0.5, e); P.re = 0.4 * e; P.twist = -0.5 * e;
        }
        break;
      }
      case 'uppercut': {
        if (inStart) {
          P.y -= 0.14 * ease(s); P.lean += 0.3 * ease(s); P.rx = M.lerp(P.rx, 0.4, ease(s)); P.twist = -0.3 * ease(s);
        } else {
          const e = inActive ? easeOut(a) : back;
          P.rx = M.lerp(0.4, -2.75, e); P.re = 0.3 * e; P.y += 0.22 * e; P.lean -= 0.3 * e; P.twist = 0.35 * e;
          P.legSpread = 0.4 * e;
        }
        break;
      }
      case 'slash': {
        if (inStart) {
          P.rx = -1.45; P.rz = M.lerp(P.rz, -1.1, ease(s)); P.twist = 0.9 * ease(s); P.y -= 0.06 * ease(s);
        } else {
          const e = inActive ? easeOut(a) : back;
          P.rx = -1.45; P.rz = M.lerp(-1.1, 1.0, inActive ? e : 1); P.twist = M.lerp(0.9, -1.0, inActive ? e : 1) * (inActive ? 1 : back);
          P.re = 0.25; P.lean += 0.2 * e;
          if (!inActive) P.rz = M.lerp(-0.2, 1.0, back);
        }
        P.weapon = true;
        break;
      }
      case 'chop': {
        if (inStart) {
          P.rx = P.lx = M.lerp(-1.0, -3.0, ease(s)); P.rz = -0.15; P.lz = 0.15; P.lean -= 0.22 * ease(s); P.y += 0.05 * ease(s);
        } else {
          const e = inActive ? easeOut(a) : back;
          P.rx = P.lx = M.lerp(-3.0, -1.25, inActive ? e : 1);
          if (!inActive) P.rx = P.lx = M.lerp(-1.1, -1.25, back);
          P.rz = -0.15; P.lz = 0.15; P.lean += 0.4 * e; P.y -= 0.1 * e;
        }
        P.weapon = true;
        break;
      }
      case 'dashStrike': {
        const e = inStart ? ease(s) : inActive ? 1 : back;
        P.lx = P.rx = M.lerp(P.lx, -1.6, e); P.le = P.re = 0.38 * e; P.lz = 0.1; P.rz = -0.1; P.lean += 0.45 * e;
        P.legSpread = 0.5 * e;
        break;
      }
    }
  }

  const tmpV = new THREE.Vector3();

  function update(f, dt, time) {
    const A = f.anim, rig = f.rig;
    const fw = f.forward();
    const vFwd = f.vx * fw.x + f.vz * fw.z;
    const vSide = f.vx * fw.z - f.vz * fw.x;
    const speed = Math.hypot(f.vx, f.vz);

    // guard pose (fists up like a boxer)
    const P = { lx: -1.25, lz: 0.22, le: 0, rx: -0.95, rz: -0.22, re: 0, twist: 0, spin: 0, y: 0,
      lean: M.clamp(vFwd * 0.035, -0.25, 0.3), roll: M.clamp(-vSide * 0.04, -0.3, 0.3), legSpread: 0, weapon: false };
    const st = f.state;
    let legsAir = false;

    if (st === 'attack' && f.move) movePose(f, P);
    else if (st === 'dash') {
      P.lean = 0.6; P.lx = P.rx = 0.55; P.lz = -0.15; P.rz = 0.15; P.y = -0.12; P.legSpread = 0.7;
    } else if (st === 'hit') {
      P.lean = 0.42; P.lx = -0.35; P.rx = -0.25; P.lz = -0.35; P.rz = 0.35; P.y = -0.05;
    } else if (st === 'air') {
      P.lx = -0.4; P.rx = -2.6; P.lz = -1.4; P.rz = 1.3; legsAir = true;
    } else if (st === 'down' || st === 'ko') {
      P.lx = -2.9; P.rx = -2.7; P.lz = -0.6; P.rz = 0.5; legsAir = true;
    } else if (st === 'getup') {
      P.lean = 0.3; P.lx = -0.6; P.rx = -0.6;
    }

    // springs: lean/roll follow the pose targets with inertia
    A.lean.target = P.lean; A.roll.target = P.roll;
    A.lean.step(dt); A.roll.step(dt); A.wobble.step(dt); A.squash.step(dt);

    // body rotation: tumble in the air, lying when down, otherwise lean
    if (st === 'air') A.rotX = f.tumble;
    else if (st === 'down' || st === 'ko') {
      const target = -1.45 + Math.round((A.rotX + 1.45) / M.TAU) * M.TAU;
      A.rotX = M.damp(A.rotX, target, 14, dt);
    } else {
      A.rotX = M.wrapAngle(A.rotX);
      A.rotX = M.damp(A.rotX, 0, st === 'getup' ? 10 : 20, dt);
    }
    const lying = st === 'down' || st === 'ko';
    const wantY = lying ? 0.66 : st === 'getup' ? M.lerp(0.66, EF.model.BODY_Y, ease(Math.min(1, f.stateTime / 0.3))) : EF.model.BODY_Y;
    A.bodyY = M.damp(A.bodyY, wantY, lying ? 16 : 22, dt);

    // walk cycle / idle bounce
    const moving = (st === 'move' || st === 'getup') && speed > 0.4;
    A.walk += dt * (moving ? 3.2 * Math.min(speed, 6) : 7);
    const legSwing = moving ? Math.sin(A.walk) * 0.75 * Math.min(1, speed / 3) : 0;
    const bounce = st === 'move' ? Math.abs(Math.sin(A.walk)) * (moving ? 0.07 : 0.035) : 0;

    // apply to the rig
    const pv = rig.pivot;
    pv.position.set(0, A.bodyY + f.y + P.y + bounce, 0);
    pv.rotation.set(A.rotX + A.lean.value, P.spin + P.twist * 0.6, A.roll.value + A.wobble.value * 0.08, 'YXZ');
    const sq = M.clamp(A.squash.value * 0.1, -0.25, 0.25);
    rig.body.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    if (A.shake > 0) { pv.position.x += (Math.random() - 0.5) * A.shake; pv.position.z += (Math.random() - 0.5) * A.shake; }

    // arms (damped toward the pose so nothing pops)
    const R = 34;
    const ar = A.arms;
    for (const k of ['lx', 'lz', 'le', 'rx', 'rz', 're']) ar[k] = M.damp(ar[k], P[k], R, dt);
    rig.armL.pivot.rotation.set(ar.lx, 0, ar.lz);
    rig.armR.pivot.rotation.set(ar.rx, 0, ar.rz);
    rig.armL.inner.position.y = -ar.le;
    rig.armR.inner.position.y = -ar.re;

    // legs
    let ll, lr;
    if (legsAir) { ll = -0.9 + Math.sin(time * 18) * 0.3; lr = -0.5 - Math.sin(time * 18) * 0.3; }
    else { ll = legSwing - P.legSpread; lr = -legSwing + P.legSpread * 0.6; }
    A.legs.l = M.damp(A.legs.l, ll, 25, dt); A.legs.r = M.damp(A.legs.r, lr, 25, dt);
    rig.legL.pivot.rotation.x = A.legs.l;
    rig.legR.pivot.rotation.x = A.legs.r;

    // weapon in hand
    const wpn = f.move && P.weapon ? f.move.weapon : null;
    for (const [name, g] of Object.entries(rig.handWeapon)) g.visible = wpn === name;
    if (rig.backBlade) rig.backBlade.visible = wpn !== 'katana';

    // eyes: squint when hurt, blink now and then, closed lines on KO
    A.hurt = Math.max(0, A.hurt - dt);
    A.blink -= dt;
    if (A.blink < -0.1) A.blink = M.rand(1.5, 4);
    const eyeY = st === 'ko' ? 0.12 : A.hurt > 0 ? 0.3 : A.blink < 0 ? 0.15 : 1;
    for (const e of rig.eyes) {
      e.group.scale.y = M.damp(e.group.scale.y, eyeY, 30, dt);
      e.brow.rotation.z = e.side * (A.hurt > 0 ? -0.2 : 0.38);
    }

    f.syncModel();
  }

  /** world position of a fist (for smear trails) */
  function fistWorld(f, right, out) {
    return (right ? f.rig.armR.fist : f.rig.armL.fist).getWorldPosition(out || tmpV);
  }

  EF.animator = { createAnimState, update, fistWorld };
})();

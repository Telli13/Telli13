/* Movement: walking/circling, fast turning toward the opponent, dashes, knock-back slides,
 * launches, landings and arena walls. Pure simulation, no drawing.
 */
'use strict';

(() => {
  const { M } = EF;
  const GRAVITY = 30;
  const BODY_R = 0.62;          // collision radius between fighters

  function wantFace(f, rate) {
    if (!f.opponent) return;
    f.facing = M.dampAngle(f.facing, f.angleTo(f.opponent), rate, f._dt);
  }

  function startDash(f) {
    let dx = f.ctrl.mx, dz = f.ctrl.mz;
    const l = Math.hypot(dx, dz);
    if (l < 0.2) { const fw = f.forward(); dx = fw.x; dz = fw.z; } else { dx /= l; dz /= l; }
    f.dashDirX = dx; f.dashDirZ = dz;
    f.setState('dash');
    f.dashTime = 0.17;
    f.dashCooldown = 0.42;
    f.vx = dx * f.stats.dashSpeed; f.vz = dz * f.stats.dashSpeed;
    f.anim.lean.impulse(9);
    f.events.push({ type: 'dash' });
  }

  function step(f, dt, arena) {
    f._dt = dt;
    f.stateTime += dt;
    f.dashCooldown = Math.max(0, f.dashCooldown - dt);
    const st = f.state;
    const fw = f.forward();

    if (st === 'move') {
      const sp = f.stats.speed;
      f.vx = M.damp(f.vx, f.ctrl.mx * sp, 14, dt);
      f.vz = M.damp(f.vz, f.ctrl.mz * sp, 14, dt);
      wantFace(f, f.stats.turnRate);
    } else if (st === 'dash') {
      f.dashTime -= dt;
      wantFace(f, f.stats.turnRate * 0.6);
      if (f.dashTime <= 0) {
        f.vx *= 0.35; f.vz *= 0.35;
        f.setState('move');
      }
    } else if (st === 'attack') {
      const mv = f.move;
      // lunge forward during startup + active, then brake hard
      if (f.moveTime < mv.startup + mv.active && mv.lunge) {
        const close = f.opponent ? M.smoothstep(0.9, 1.6, f.distTo(f.opponent)) : 1;
        const want = mv.lunge * (0.35 + 0.65 * close);
        f.vx = M.damp(f.vx, fw.x * want, 18, dt);
        f.vz = M.damp(f.vz, fw.z * want, 18, dt);
      } else {
        f.vx = M.damp(f.vx, 0, 10, dt);
        f.vz = M.damp(f.vz, 0, 10, dt);
      }
      // can still track the opponent during the wind-up (the fast "turn" of the video)
      if (f.moveTime < mv.startup) wantFace(f, f.stats.turnRate);
    } else if (st === 'hit') {
      f.vx = M.damp(f.vx, 0, 5.5, dt);
      f.vz = M.damp(f.vz, 0, 5.5, dt);
      f.hitstun -= dt;
      if (f.hitstun <= 0) f.setState('move');
    } else if (st === 'air') {
      f.vy -= GRAVITY * dt;
      f.vx = M.damp(f.vx, 0, 0.6, dt);
      f.vz = M.damp(f.vz, 0, 0.6, dt);
      f.tumble += f.tumbleSpeed * dt;
      f.y += f.vy * dt;
      if (f.y <= 0) {
        f.y = 0;
        if (f.vy < -7) {
          // bounce once, keep tumbling a bit
          f.vy = -f.vy * 0.32;
          f.tumbleSpeed *= 0.5;
          f.vx *= 0.6; f.vz *= 0.6;
          f.events.push({ type: 'land', strength: 1 });
        } else {
          f.vy = 0;
          f.events.push({ type: 'land', strength: 0.6 });
          f.setState(f.hp <= 0 ? 'ko' : 'down');
        }
      }
    } else if (st === 'down') {
      f.vx = M.damp(f.vx, 0, 6, dt);
      f.vz = M.damp(f.vz, 0, 6, dt);
      if (f.stateTime > 0.42) f.setState('getup');
    } else if (st === 'getup') {
      f.vx = M.damp(f.vx, 0, 10, dt);
      f.vz = M.damp(f.vz, 0, 10, dt);
      wantFace(f, 8);
      if (f.stateTime > 0.3) { f.setState('move'); f.anim.wobble.impulse(6); }
    } else if (st === 'ko') {
      f.vx = M.damp(f.vx, 0, 4, dt);
      f.vz = M.damp(f.vz, 0, 4, dt);
      if (f.y > 0 || f.vy > 0) {
        f.vy -= GRAVITY * dt; f.y = Math.max(0, f.y + f.vy * dt);
        if (f.y === 0) f.vy = 0;
      }
    }

    f.x += f.vx * dt;
    f.z += f.vz * dt;

    // arena walls: knocked fighters bounce off them
    const lim = arena.HALF - 0.45;
    for (const axis of ['x', 'z']) {
      const v = axis === 'x' ? 'vx' : 'vz';
      if (Math.abs(f[axis]) > lim) {
        f[axis] = Math.sign(f[axis]) * lim;
        if ((f.state === 'hit' || f.state === 'air') && Math.abs(f[v]) > 3.5) {
          f.events.push({ type: 'wall', strength: Math.abs(f[v]) });
          f[v] = -f[v] * 0.45;
        } else if (f[v] * Math.sign(f[axis]) > 0) f[v] = 0;
      }
    }
  }

  /** keep the two eggs from overlapping */
  function separate(a, b) {
    if (Math.abs(a.y - b.y) > 1.2) return;
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    const min = BODY_R * 2;
    if (d < min) {
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
    }
  }

  EF.movement = { step, separate, startDash, GRAVITY, BODY_R };
})();

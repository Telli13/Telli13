/* Fight camera: side-on to the line between the fighters (like the reference video),
 * follows their midpoint, zooms with their distance, shakes on impacts and punches in on finishers.
 */
'use strict';

(() => {
  const { M } = EF;

  class FightCamera {
    constructor(aspect) {
      this.cam = new THREE.PerspectiveCamera(38, aspect, 0.1, 200);
      this.yaw = 0;            // camera sits at target + (sin yaw, cos yaw) * dist
      this.dist = 9;
      this.target = new THREE.Vector3(0, 1.1, 0);
      this.shakeAmp = 0;
      this.punch = 0;          // 0..1 finisher zoom
      this.punchAt = new THREE.Vector3();
      this.orbit = 0;          // showcase orbiting speed
    }

    addShake(a) { this.shakeAmp = Math.min(0.5, this.shakeAmp + a); }

    finisher(at) { this.punch = 1; this.punchAt.copy(at); }

    /** a, b: positions {x, z} of the two fighters */
    update(dt, a, b) {
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const dx = b.x - a.x, dz = b.z - a.z;
      const sep = Math.sqrt(dx * dx + dz * dz);
      // ideal yaw: perpendicular to the fighter axis, on whichever side is closer to where we are
      if (sep > 0.3 && !this.orbit) {
        const axis = Math.atan2(dx, dz);
        let ideal = axis + Math.PI / 2;
        if (Math.abs(M.wrapAngle(ideal - this.yaw)) > Math.PI / 2) ideal += Math.PI;
        this.yaw = M.dampAngle(this.yaw, ideal, 1.6, dt);
      }
      if (this.orbit) this.yaw += this.orbit * dt;
      const wantDist = M.clamp(6.2 + sep * 0.95, 7.2, 14);
      this.dist = M.damp(this.dist, wantDist, 3, dt);
      this.target.x = M.damp(this.target.x, mx, 6, dt);
      this.target.z = M.damp(this.target.z, mz, 6, dt);

      // finisher punch-in toward the impact point
      this.punch = Math.max(0, this.punch - dt * 1.6);
      const p = M.smoothstep(0, 1, this.punch);
      const tx = M.lerp(this.target.x, this.punchAt.x, p * 0.7);
      const tz = M.lerp(this.target.z, this.punchAt.z, p * 0.7);
      const dist = this.dist * (1 - 0.38 * p);

      const h = 3.0 + dist * 0.12;
      this.cam.position.set(tx + Math.sin(this.yaw) * dist, h, tz + Math.cos(this.yaw) * dist);
      const look = new THREE.Vector3(tx, 1.05, tz);
      // shake
      this.shakeAmp = M.damp(this.shakeAmp, 0, 9, dt);
      if (this.shakeAmp > 0.002) {
        const s = this.shakeAmp;
        this.cam.position.x += (Math.random() - 0.5) * s;
        this.cam.position.y += (Math.random() - 0.5) * s;
        look.x += (Math.random() - 0.5) * s * 0.5;
      }
      this.cam.lookAt(look);
    }
  }

  EF.FightCamera = FightCamera;
})();

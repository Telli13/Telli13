/* Visual effects: swing smears, impact flashes, chocolate crumbs, dust puffs and the
 * finisher overlay (dark vignette + flash, like the big hits in the reference video).
 */
'use strict';

(() => {
  const { M } = EF;

  function radialTexture(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const starTex = () => radialTexture((g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,170,.95)');
    gr.addColorStop(0.6, 'rgba(255,170,40,.35)'); gr.addColorStop(1, 'rgba(255,140,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,230,.95)';
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 14 : 62;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  });

  const puffTex = () => radialTexture((g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });

  class Smear {
    constructor(scene, color) {
      this.N = 14;
      this.pts = [];
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array(this.N * 2 * 3);
      this.col = new Float32Array(this.N * 2 * 4);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
      const idx = [];
      for (let i = 0; i < this.N - 1; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      g.setIndex(idx);
      this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
      }));
      this.mesh.frustumCulled = false;
      this.color = new THREE.Color(color);
      scene.add(this.mesh);
    }

    /** add a sample: outer (fist) and inner (toward the shoulder) points */
    push(outer, inner) {
      this.pts.unshift({ o: outer.clone(), i: inner.clone(), age: 0 });
      if (this.pts.length > this.N) this.pts.pop();
    }

    update(dt) {
      for (const p of this.pts) p.age += dt;
      while (this.pts.length && this.pts[this.pts.length - 1].age > 0.14) this.pts.pop();
      const n = this.pts.length;
      for (let k = 0; k < this.N; k++) {
        const p = this.pts[Math.min(k, n - 1)];
        const j = k * 2;
        if (!p) { this.col[j * 4 + 3] = this.col[j * 4 + 7] = 0; continue; }
        this.pos.set([p.o.x, p.o.y, p.o.z, p.i.x, p.i.y, p.i.z], j * 3);
        const alpha = k < n ? (1 - k / this.N) * (1 - p.age / 0.14) * 0.9 : 0;
        const c = this.color;
        this.col.set([c.r, c.g, c.b, alpha, c.r, c.g, c.b, alpha * 0.05], j * 4);
      }
      this.mesh.geometry.attributes.position.needsUpdate = true;
      this.mesh.geometry.attributes.color.needsUpdate = true;
      this.mesh.visible = n > 1;
    }
  }

  class FX {
    constructor(scene, arena) {
      this.scene = scene;
      this.arena = arena;
      this.sprites = [];
      this.starMat = new THREE.SpriteMaterial({ map: starTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      this.puffMat = new THREE.SpriteMaterial({ map: puffTex(), depthWrite: false, transparent: true, color: 0xd9d4cc });
      // chocolate crumbs: one instanced mesh, crumbs settle on the floor and stay for a while
      this.MAX = 360;
      this.crumbs = [];
      const geo = new THREE.BoxGeometry(1, 1, 1);
      this.crumbMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4 }), this.MAX);
      this.crumbMesh.castShadow = true;
      this.crumbMesh.count = 0;
      this.crumbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.crumbMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.MAX * 3), 3);
      this.crumbMesh.frustumCulled = false;
      scene.add(this.crumbMesh);
      this.dummy = new THREE.Object3D();
      this.overlay = document.createElement('div');
      this.overlay.className = 'finisher';
      document.getElementById('ui').appendChild(this.overlay);
      this.flashEl = document.createElement('div');
      this.flashEl.className = 'flash';
      document.getElementById('ui').appendChild(this.flashEl);
      this.vignette = 0; this.flash = 0;
    }

    smear(color) { return new Smear(this.scene, color); }

    sprite(mat, pos, size, life, grow = 1.6, vel = null) {
      const s = new THREE.Sprite(mat.clone());
      s.position.copy(pos);
      s.scale.setScalar(size);
      s.material.rotation = Math.random() * Math.PI;
      this.scene.add(s);
      this.sprites.push({ s, life, t: 0, size, grow, vel });
    }

    impact(pos, strength) {
      this.sprite(this.starMat, pos, 0.7 + strength * 0.9, 0.16 + strength * 0.06, 1.8);
      if (strength > 0.7) this.sprite(this.starMat, pos, 0.4, 0.28, 4.5);
    }

    dust(pos, n = 5, size = 0.6) {
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3(M.rand(-1.5, 1.5), M.rand(0.3, 1.2), M.rand(-1.5, 1.5));
        this.sprite(this.puffMat, pos.clone().add(new THREE.Vector3(M.rand(-0.3, 0.3), 0.15, M.rand(-0.3, 0.3))),
          size * M.rand(0.6, 1.2), M.rand(0.35, 0.6), 2.2, v);
      }
    }

    /** spray of small chocolate crumbs from a hit point; colors: [[r,g,b] …] picked at random */
    crumbsAt(pos, dirX, dirZ, n, colors) {
      for (let i = 0; i < n; i++) {
        if (this.crumbs.length >= this.MAX) this.crumbs.shift();
        const sp = M.rand(2, 6);
        this.crumbs.push({
          x: pos.x, y: pos.y, z: pos.z,
          vx: dirX * sp + M.rand(-2, 2), vy: M.rand(1.5, 5.5), vz: dirZ * sp + M.rand(-2, 2),
          rx: M.rand(0, 6), ry: M.rand(0, 6), spin: M.rand(-15, 15),
          s: M.rand(0.035, 0.09), c: M.pick(colors), rest: false, age: 0,
        });
      }
    }

    finisher() { this.vignette = 1; this.flash = 1; }

    update(dt) {
      // sprites
      for (let i = this.sprites.length - 1; i >= 0; i--) {
        const p = this.sprites[i];
        p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) { this.scene.remove(p.s); p.s.material.dispose(); this.sprites.splice(i, 1); continue; }
        p.s.scale.setScalar(p.size * (1 + (p.grow - 1) * k));
        p.s.material.opacity = 1 - k * k;
        if (p.vel) p.s.position.addScaledVector(p.vel, dt);
      }
      // crumbs
      const lim = this.arena.HALF + 0.1;
      const m = this.crumbMesh, d = this.dummy;
      for (let i = 0; i < this.crumbs.length; i++) {
        const c = this.crumbs[i];
        c.age += dt;
        if (!c.rest) {
          c.vy -= 22 * dt;
          c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
          c.rx += c.spin * dt; c.ry += c.spin * 0.7 * dt;
          if (Math.abs(c.x) > lim) { c.x = Math.sign(c.x) * lim; c.vx *= -0.4; }
          if (Math.abs(c.z) > lim) { c.z = Math.sign(c.z) * lim; c.vz *= -0.4; }
          if (c.y < c.s / 2) {
            c.y = c.s / 2;
            if (c.vy < -2) { c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; c.spin *= 0.5; }
            else { c.rest = true; c.rx = Math.round(c.rx / 1.57) * 1.57; c.rz = 0; }
          }
        }
        d.position.set(c.x, c.y, c.z);
        d.rotation.set(c.rx, c.ry, 0);
        d.scale.setScalar(c.s);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
        m.instanceColor.setXYZ(i, c.c[0], c.c[1], c.c[2]);
      }
      m.count = this.crumbs.length;
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
      // overlay
      this.vignette = Math.max(0, this.vignette - dt * 2.2);
      this.flash = Math.max(0, this.flash - dt * 7);
      this.overlay.style.opacity = this.vignette.toFixed(3);
      this.flashEl.style.opacity = (this.flash * 0.85).toFixed(3);
    }

    clearDebris() { this.crumbs.length = 0; }
  }

  EF.FX = FX;
})();

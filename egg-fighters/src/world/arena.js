/* The arena: a blocky stone plaza with low walls, voxel trees and blocks around it.
 * Fighters stay inside `bounds` (half-size HALF); fragments bounce off the same walls.
 */
'use strict';

(() => {
  const HALF = 7;          // playable half-size (metres)
  const WALL_H = 0.55;

  function tileTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const n = 4, s = 256 / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 168 + ((i * 7 + j * 13) % 5) * 7 + Math.random() * 10;
        g.fillStyle = `rgb(${v - 8},${v - 2},${v + 10})`;
        g.fillRect(i * s, j * s, s, s);
        // soft bevel
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(i * s + 3, j * s + 3, s - 6, 4);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(i * s + 3, j * s + s - 7, s - 6, 4);
        // a few speckles
        for (let k = 0; k < 14; k++) {
          g.fillStyle = `rgba(60,60,80,${Math.random() * 0.12})`;
          g.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 3, 3);
        }
      }
    }
    g.strokeStyle = 'rgba(70,72,90,.55)'; g.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  function skyTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#3f7fd6'); gr.addColorStop(0.55, '#8fc3f2'); gr.addColorStop(1, '#dcebf7');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function buildArena(scene) {
    const { mat, box } = EF.model;
    const group = new THREE.Group();
    scene.add(group);
    scene.background = skyTexture();
    scene.fog = new THREE.Fog(0xb9d6ef, 22, 60);

    // light
    scene.add(new THREE.HemisphereLight(0xdbeeff, 0x6a5a48, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    sun.position.set(6, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0x9cc8ff, 0.6);
    rim.position.set(-8, 5, -9);
    scene.add(rim);

    // grass ground far around
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x5fae4a, { roughness: 0.95 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.42;
    grass.receiveShadow = true;
    group.add(grass);

    // stone plaza platform
    const tiles = tileTexture();
    const size = HALF * 2 + 3;
    tiles.repeat.set(size / 2, size / 2);
    const topMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 });
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(size, 0.42, size), [
      mat(0x8e8fa0), mat(0x8e8fa0), topMat, mat(0x8e8fa0), mat(0x8e8fa0), mat(0x8e8fa0)]);
    plaza.position.y = -0.21;
    plaza.receiveShadow = true;
    group.add(plaza);

    // low block walls around the fighting area (with gaps at the corners)
    const wallMat = mat(0x9a9caf, { roughness: 0.8 }), capMat = mat(0xb9bccb, { roughness: 0.7 });
    const W = HALF + 0.35;
    for (let i = -HALF; i < HALF; i += 1) {
      const darker = (i & 1) ? wallMat : mat(0x8f91a3, { roughness: 0.8 });
      for (const [x, z, rot] of [[i + 0.5, -W, 0], [i + 0.5, W, 0], [-W, i + 0.5, 1], [W, i + 0.5, 1]]) {
        const b = box(rot ? 0.5 : 0.98, WALL_H, rot ? 0.98 : 0.5, darker, x, WALL_H / 2, z);
        group.add(b);
      }
    }
    // corner pillars
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = box(0.9, 1.6, 0.9, capMat, sx * W, 0.8, sz * W);
      p.add(box(1.05, 0.2, 1.05, wallMat, 0, 0.85, 0));
      const flame = box(0.35, 0.35, 0.35, mat(0xffb23d, { emissive: 0xff7a00, emissiveIntensity: 1.2 }), 0, 1.15, 0);
      flame.rotation.set(0.6, 0.7, 0);
      p.add(flame);
      group.add(p);
    }

    // voxel trees and blocks around
    const leaf = [mat(0x3f9a3a), mat(0x4fb043), mat(0x2f8034)];
    const trunk = mat(0x7a4e2c);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const placeOutside = (minR, maxR) => {
      for (;;) {
        const x = rnd(-maxR, maxR), z = rnd(-maxR, maxR);
        if (Math.max(Math.abs(x), Math.abs(z)) > minR) return [x, z];
      }
    };
    for (let i = 0; i < 26; i++) {
      const [x, z] = placeOutside(HALF + 3.2, 26);
      const h = rnd(1.6, 3);
      const t = new THREE.Group();
      t.position.set(x, -0.42, z);
      t.add(box(0.6, h, 0.6, trunk, 0, h / 2, 0));
      const s = rnd(1.8, 2.8);
      t.add(box(s, s * 0.8, s, leaf[i % 3], 0, h + s * 0.3, 0));
      t.add(box(s * 0.6, s * 0.5, s * 0.6, leaf[(i + 1) % 3], 0, h + s * 0.85, 0));
      group.add(t);
    }
    const stone = [mat(0x7d8092), mat(0x8c8fa2), mat(0x6f7283)];
    for (let i = 0; i < 18; i++) {
      const [x, z] = placeOutside(HALF + 2.4, 30);
      const s = rnd(0.8, 2.6);
      const b = box(s, s * rnd(0.6, 2.2), s, stone[i % 3], x, 0, z);
      b.position.y = -0.42 + b.geometry.parameters.height / 2;
      b.rotation.y = rnd(0, 1.5);
      group.add(b);
    }
    // distant blocky "buildings" for the Roblox-city feel
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(34, 44);
      const w = rnd(4, 8), h = rnd(5, 14);
      const b = box(w, h, w, stone[i % 3], Math.cos(a) * r, h / 2 - 0.42, Math.sin(a) * r);
      b.castShadow = false;
      group.add(b);
    }

    return { group, HALF, WALL_H, sun };
  }

  EF.arena = { buildArena, HALF };
})();

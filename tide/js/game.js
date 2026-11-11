// Отлив: Хранитель маяка — мир, симуляция, игровой цикл
'use strict';
const G = (() => {
  const T = THREE, V3 = T.Vector3;
  const KEY = 'tide_save_v1';
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const HP = { x: 0, z: 9, y: .6 };                 // горн
  const GRAV = 20, CELL = 1.6, EYE = 1.65;

  // ---------- сохранение ----------
  const fresh = () => ({
    light: 0, total: 0, lh: 0, up: {}, arts: [], letters: [], chests: [], bottles: [], quest: 0, pearls: 0,
    heartDone: false, crabRate: 0, last: Date.now(), runs: 0,
    st: { picked: 0, burned: 0, bought: 0, goldBurned: 0, bestCombo: 0, maxZone: 0, heartPicked: 0, time: 0 },
    opt: { snd: 1, q: touch ? 0 : 1, sens: 1 }
  });
  let S = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) { const f = fresh(); S = Object.assign(f, raw); S.st = Object.assign(fresh().st, raw.st); S.opt = Object.assign(fresh().opt, raw.opt); }
  } catch (e) { }
  for (const id in D.UP) S.up[id] = S.up[id] || 0;
  const save = () => { S.last = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

  // ---------- производные характеристики ----------
  const C = {};
  function calc() {
    const a = { speed: 0, light: 0, combo: 0, crab: 0, gold: 0, bag: 0, tide: 0 };
    S.arts.forEach(i => { const b = D.ARTS[i][3]; a[b[0]] += b[1]; });
    const u = S.up;
    C.str = D.STR[u.str]; C.bagCap = u.bag * 4 + (u.bag ? a.bag : 0);
    C.speed = 5.6 * (1 + u.speed * .12 + a.speed); C.throwV = 16 * (1 + u.thr * .15);
    C.reach = 4 + u.reach * 1.5; C.vacR = 5 + u.vacR * 1.5; C.vacW = D.VACW[u.vacP]; C.vacDt = .09 / (1 + u.vacP * .5);
    C.crabN = u.crab; C.crabSp = 3.2 * (1 + u.crabSp * .25); C.crabW = D.CRABW[u.crabSt];
    C.crabMul = .5 * (1 + u.crabV * .3) * (1 + a.crab); C.offH = u.crab ? 1 + u.night * 2 : 0;
    C.lightMul = (1 + u.lens * .2) * (1 + a.light) * (1 + S.pearls * .5);
    C.comboMax = 1.5 + u.combo * .5; C.comboTime = 5 + a.combo; C.critP = u.crit * .05;
    C.respawn = 200 * (1 - u.tide * .2) * (1 - Math.min(.5, a.tide)); C.goldMul = 1 + u.gold * .3 + a.gold;
    C.lit = D.LIT[S.lh];
  }

  // ---------- утилиты ----------
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => sm(clamp((x - a) / (b - a), 0, 1));
  function groundH(x, z) {
    const r = Math.hypot(x, z);
    const base = (noise(x * .03 + 50, z * .03 + 50) - .5) * 3.4 + (noise(x * .12, z * .12) - .5) * .6 - r * .028;
    return lerp(HP.y, base, sstep(12, 19, r));
  }
  const zoneAt = r => r < D.ZONES[0].r1 ? 0 : r < D.ZONES[1].r1 ? 1 : r < D.ZONES[2].r1 ? 2 : 3;

  // ---------- сцена ----------
  let renderer, scene, camera, sun, hemi, sky, wall, water, flame = [], fireLight, beam, sunBall;
  let itemMat, rarMats, decorMat;
  const colliders = [{ x: 0, z: 0, r: 3.9 }, { x: HP.x, z: HP.z, r: 2.5 }];
  const geo = {}, meshes = {}, inst = {};
  const cells = new Map();
  const specials = [], crabs = [], dyn = [], dead = [];
  const dummy = new T.Object3D(), col = new T.Color();
  let sparks, sparkFree = [], fxPts, fxN = 240, fxData = [];
  const P = { x: 5.5, z: 4.5, y: 0, yaw: 0, pitch: -.08, bob: 0, held: null, bag: [], incoming: 0, back: null };
  let heldMesh, vacMesh, heartPillar;
  const input = { mx: 0, mz: 0, vac: false, keys: {} };
  let time = 0, combo = { n: 0, t: 0 }, ev = { type: null, t: 0, next: 70 }, rate = 0, rateAcc = 0, rateT = 0, crabAcc = 0;
  let running = false, ending = 0, dumpT = 0, vacT = 0, saveT = 0, zoneShown = -1, wallR = 30, lastToastWall = 0;

  function init() {
    calc();
    const cv = document.getElementById('cv');
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: !touch, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.opt.q ? 2 : 1.25));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    if (S.opt.q && !touch) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; }
    scene = new T.Scene(); scene.fog = new T.Fog(0xf2d2a0, 25, 210);
    camera = new T.PerspectiveCamera(70, 1, .1, 900); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new T.HemisphereLight(0xcfe8ff, 0xb08a60, 1.5); scene.add(hemi);
    sun = new T.DirectionalLight(0xfff0d0, 2.6); scene.add(sun); scene.add(sun.target);
    if (renderer.shadowMap.enabled) {
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera;
      c.left = c.bottom = -38; c.right = c.top = 38; c.near = 1; c.far = 260; sun.shadow.bias = -.0004; sun.shadow.normalBias = .12; sun.shadow.radius = 3;
    }
    itemMat = new T.MeshLambertMaterial({ vertexColors: true });
    decorMat = new T.MeshLambertMaterial({ vertexColors: true });
    rarMats = D.RAR.map(r => { const m = new T.MeshLambertMaterial({ vertexColors: true }); m.color.setRGB(...r.color); return m; });
    buildSky(); buildTerrain(); buildLighthouse(); buildDecor(); buildItems(); buildSpecials(); buildFx(); buildHands();
    wallR = C.lit; syncCrabs();
    P.yaw = Math.atan2(-(HP.x - P.x), -(HP.z - P.z)) - .5;
    resize(); window.addEventListener('resize', resize);
    bindInput(cv);
    offline();
    if (S.lh >= 8 && !S.heartDone) spawnHeart();
    requestAnimationFrame(loop);
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 68; camera.updateProjectionMatrix();
  }

  // ---------- небо, земля ----------
  function buildSky() {
    sky = new T.Mesh(new T.SphereGeometry(700, 24, 12), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color() }, hor: { value: new T.Color() } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying float h; void main(){ float t = pow(clamp(h*1.5,0.,1.),.6); gl_FragColor = vec4(pow(mix(hor,top,t),vec3(.4545)),1.); }'
    }));
    scene.add(sky);
    sunBall = new T.Mesh(new T.CircleGeometry(26, 20), new T.MeshBasicMaterial({ color: 0xfff6dc, fog: false }));
    scene.add(sunBall);
    const r = rng(11), parts = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * 6.283, d = 200 + r() * 320, s = 14 + r() * 26;
      for (let k = 0; k < 3; k++) parts.push(M.P(M.ico(1, 0), 0xffffff,
        [Math.cos(a) * d + (k - 1) * s * .9, 70 + r() * 70 + (k == 1 ? s * .18 : 0), Math.sin(a) * d], [r() * 3, r() * 3, 0], [s * (k == 1 ? 1 : .7), s * .32, s * .6]));
    }
    const cl = new T.Mesh(M.merge(parts, false), new T.MeshBasicMaterial({ vertexColors: true, fog: false }));
    scene.add(cl); sky.userData.clouds = cl;
  }
  function buildTerrain() {
    const N = S.opt.q ? 180 : 120, g = new T.PlaneGeometry(520, 520, N, N).toNonIndexed(); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
    const A = new T.Color(0xe9cf9a), B = new T.Color(0xb99a66), W = new T.Color(0x6e9a93), Dp = new T.Color(0x4f7a86);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, y = p.getY(i);
      const r = Math.hypot(x, z);
      col.copy(A).lerp(B, noise(x * .08, z * .08));
      col.lerp(W, sstep(.2, -1.6, y + r * .028) * .7);          // сырые низины
      col.lerp(Dp, sstep(70, 160, r) * .45);                     // к бездне дно холоднее
      const f = .92 + hash(i, 7) * .16;
      for (let k = 0; k < 3; k++) { c[(i + k) * 3] = col.r * f; c[(i + k) * 3 + 1] = col.g * f; c[(i + k) * 3 + 2] = col.b * f; }
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; scene.add(m);
    water = new T.Mesh(new T.CircleGeometry(520, 40), new T.MeshLambertMaterial({ color: 0x2fa7b0, transparent: true, opacity: .86 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -30; water.visible = false; scene.add(water);
    // стена мглы
    const cvs = document.createElement('canvas'); cvs.width = 4; cvs.height = 128; const x = cvs.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
    wall = new T.Mesh(new T.CylinderGeometry(1, 1, 30, 56, 1, true), new T.MeshBasicMaterial({
      color: 0x2b3f52, transparent: true, opacity: .93, map: new T.CanvasTexture(cvs), side: T.DoubleSide, depthWrite: false, fog: false }));
    wall.position.y = 9; wall.renderOrder = 5; scene.add(wall);
  }

  // ---------- маяк и горн ----------
  function buildLighthouse() {
    const parts = [], Pp = M.P;
    parts.push(Pp(M.cyl(12, 12.6, 1.2, 18), 0xb9b09c, [0, .08, 0]));                      // пирс
    for (let i = 0; i < 5; i++) parts.push(Pp(M.cyl(3.3 - i * .22, 3.52 - i * .22, 4.4, 10), i % 2 ? 0xd9482f : 0xf4efe2, [0, 2.8 + i * 4.4, 0]));
    parts.push(Pp(M.cyl(3.4, 3.0, .5, 10), 0x4a4f58, [0, 22.9, 0]));                    // галерея
    parts.push(Pp(M.cyl(1.7, 1.7, 2.6, 8, true), 0x3d4650, [0, 24.4, 0]));
    parts.push(Pp(M.cone(2.4, 2.2, 8), 0xd9482f, [0, 26.8, 0]));
    parts.push(Pp(M.box(1.3, 2.3, .3), 0x5a3d28, [0, 1.75, 3.45]));                     // дверь
    // горн: чаша на постаменте
    parts.push(Pp(M.cyl(1.7, 2.1, .7, 8), 0x8f8676, [HP.x, HP.y + .35, HP.z]));
    parts.push(Pp(M.cyl(2.25, 1.5, 1.0, 9, true), 0xc98f3a, [HP.x, HP.y + 1.2, HP.z]));
    parts.push(Pp(M.tor(2.25, .14, 4, 9), 0xe8b85a, [HP.x, HP.y + 1.7, HP.z], [Math.PI / 2, 0, 0]));
    parts.push(Pp(M.cyl(1.5, 1.5, .1, 9), 0x3a2a1a, [HP.x, HP.y + .75, HP.z]));
    const m = new T.Mesh(M.merge(parts), decorMat); m.castShadow = m.receiveShadow = true; scene.add(m);
    const lamp = new T.Mesh(M.ico(1.3, 1), new T.MeshBasicMaterial({ color: 0xfff3c0, fog: false })); lamp.position.y = 24.4; scene.add(lamp);
    beam = new T.Group(); beam.position.y = 24.4; scene.add(beam);
    const bm = new T.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    for (const s of [1, -1]) { const b = new T.Mesh(new T.ConeGeometry(9, 170, 10, 1, true), bm); b.rotation.z = s * Math.PI / 2; b.position.x = s * 85; beam.add(b); }
    beam.userData.mat = bm;
    // живой огонь
    const fm = [0xfff0a0, 0xffc040, 0xff8a2a, 0x58e8d8];
    for (let i = 0; i < 9; i++) {
      const f = new T.Mesh(new T.ConeGeometry(.5 + (i % 3) * .16, 1.3 + (i % 4) * .4, 5),
        new T.MeshBasicMaterial({ color: fm[i % 4], transparent: true, opacity: .92, fog: false, toneMapped: false }));
      const a = i / 9 * 6.283, r = i ? .9 : 0; f.position.set(HP.x + Math.cos(a) * r, HP.y + 1.9, HP.z + Math.sin(a) * r);
      f.userData = { ph: i * 1.7, h: 1 + (i % 4) * .22 }; scene.add(f); flame.push(f);
    }
    fireLight = new T.PointLight(0xffb060, 30, 26, 1.6); fireLight.position.set(HP.x, HP.y + 3, HP.z); scene.add(fireLight);
  }

  // ---------- декорации: корабли, киты, руины, скалы ----------
  function buildDecor() {
    const parts = [], Pp = M.P, r = rng(77);
    const at = (a, d) => [Math.cos(a) * d, Math.sin(a) * d];
    function ship(a, d, len, rot) {
      const [x, z] = at(a, d), y = groundH(x, z), g = new T.BoxGeometry(5, 4.2, len, 2, 2, 8), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const zz = p.getZ(i) / (len / 2), k = (1 - Math.pow(Math.abs(zz), 2.4) * .85) * (p.getY(i) < 0 ? .45 : 1);
        p.setX(i, p.getX(i) * k); if (p.getY(i) < 0) p.setY(i, p.getY(i) + Math.abs(zz) * 1.2);
      }
      const roll = .32 + r() * .2;
      parts.push(Pp(g, 0x6a4830, [x, y + 1.6, z], [0, rot, roll]));
      parts.push(Pp(M.box(3.6, .2, len * .8), 0x9a7448, [x, y + 3.5, z], [0, rot, roll]));
      for (const k of [-.25, .2]) {
        const mx = x + Math.sin(rot) * len * k, mz = z + Math.cos(rot) * len * k;
        parts.push(Pp(M.cyl(.22, .3, 11, 5), 0x7d5a3a, [mx - 1.6, y + 7.5, mz], [0, 0, roll + .05]));
        parts.push(Pp(M.box(5, .25, .25), 0x7d5a3a, [mx - 2.6, y + 10, mz], [0, rot + 1.57, roll]));
      }
      for (const k of [-.3, 0, .3]) colliders.push({ x: x + Math.sin(rot) * len * k, z: z + Math.cos(rot) * len * k, r: 2.6 });
    }
    ship(.5, 56, 22, .7); ship(2.4, 64, 26, 2.2); ship(4.3, 60, 20, 5.1); ship(5.6, 70, 24, 1.3); ship(3.4, 50, 16, 0.2);
    function whale(a, d, rot) {
      const [x, z] = at(a, d);
      for (let i = 0; i < 11; i++) {
        const k = i / 10, px = x + Math.sin(rot) * (i * 2.6 - 13), pz = z + Math.cos(rot) * (i * 2.6 - 13), py = groundH(px, pz);
        const R = 4.6 * (1 - Math.pow(Math.abs(k - .35) * 1.3, 2));
        if (R > .8) parts.push(Pp(M.tor(R, .22, 4, 9, Math.PI), 0xece4cf, [px, py - .2, pz], [0, rot, 0]));
        parts.push(Pp(M.ico(.6, 0), 0xddd3ba, [px, py + Math.max(R, .5), pz]));
      }
      const hx = x + Math.sin(rot) * -17, hz = z + Math.cos(rot) * -17;
      parts.push(Pp(M.ico(1, 1), 0xece4cf, [hx, groundH(hx, hz) + 1.6, hz], [0, rot, 0], [2.6, 1.8, 4.2]));
      colliders.push({ x: hx, z: hz, r: 3 });
    }
    whale(1.2, 96, .4); whale(3.9, 100, 2.6); whale(5.4, 92, 4.4);
    for (let i = 0; i < 26; i++) {                                  // руины у бездны
      const a = r() * 6.283, d = 120 + r() * 34, [x, z] = at(a, d), y = groundH(x, z), h = 5 + r() * 9, fallen = r() < .25;
      parts.push(Pp(M.cyl(.9, 1.05, h, 6), 0x7f9ea4, fallen ? [x, y + .8, z] : [x, y + h / 2 - .3, z], fallen ? [1.5, a, 0] : [r() * .12, 0, r() * .12]));
      if (!fallen) { parts.push(Pp(M.box(2.6, .7, 2.6), 0x94b0b4, [x, y + h - .2, z])); colliders.push({ x, z, r: 1.4 }); }
    }
    for (let i = 0; i < 4; i++) {                                    // арки
      const a = i * 1.57 + .6, [x, z] = at(a, 138), y = groundH(x, z);
      parts.push(Pp(M.tor(7, 1.1, 5, 9, Math.PI), 0x6f9096, [x, y, z], [0, -a, 0]));
    }
    for (let i = 0; i < 40; i++) {                                   // дальние скалы за мглой
      const a = i / 40 * 6.283 + r() * .1, d = 175 + r() * 110, [x, z] = at(a, d), h = 20 + r() * 60;
      parts.push(Pp(M.cone(10 + r() * 16, h, 5), 0x6b6f86, [x, groundH(x, z) + h / 2 - 4, z], [0, r() * 6, r() * .2 - .1]));
    }
    const m = new T.Mesh(M.merge(parts), decorMat); m.castShadow = m.receiveShadow = true; scene.add(m);
    // россыпь: камни, кораллы, водоросли
    const scatter = (g, n, r0, r1, s0, s1, seed) => {
      const im = new T.InstancedMesh(g, decorMat, n), rr = rng(seed);
      for (let i = 0; i < n; i++) {
        const a = rr() * 6.283, d = Math.sqrt(lerp(r0 * r0, r1 * r1, rr())), x = Math.cos(a) * d, z = Math.sin(a) * d, s = lerp(s0, s1, rr() * rr());
        dummy.position.set(x, groundH(x, z) - (g === geo.rock ? s * .15 : .05), z); dummy.rotation.set(0, rr() * 6.283, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
    };
    geo.rock = M.rock(); scatter(geo.rock, 260, 16, 260, .4, 3.2, 5);
    scatter(M.kelp(), S.opt.q ? 500 : 250, 15, 80, .7, 1.5, 6);
    scatter(M.coral(), S.opt.q ? 600 : 300, 74, 158, .8, 2.4, 7);
  }

  // ---------- находки ----------
  const cellKey = (x, z) => (Math.floor(x / CELL) + 160) * 512 + Math.floor(z / CELL) + 160;
  function cellAt(x, z, make) { const k = cellKey(x, z); let c = cells.get(k); if (!c && make) { c = { h: 0, items: [] }; cells.set(k, c); } return c; }
  function rollRar(r) { const v = r(); return v < .004 ? 2 : v < .03 ? 1 : 0; }
  function buildItems() {
    const r = rng(2026 + S.runs * 13), counts = {}, list = [];
    const dens = S.opt.q ? 1 : .6;
    D.ZONES.forEach((Z, zi) => {
      const types = Object.keys(Z.w), tot = types.reduce((s, t) => s + Z.w[t], 0);
      let n = Math.round(Z.count * dens), guard = n * 12;
      while (n > 0 && guard-- > 0) {
        const a = r() * 6.283, d = Math.sqrt(lerp(Z.r0 * Z.r0, Z.r1 * Z.r1, r())), x = Math.cos(a) * d, z = Math.sin(a) * d;
        const dn = noise(x * .055 + 9, z * .055 + 3) * .7 + noise(x * .2, z * .2) * .3;
        if (r() > sstep(.4, .56, dn) * .97 + .03) continue;
        if (colliders.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + .6) ** 2)) continue;
        let k = r() * tot, t = types[0]; for (const id of types) { k -= Z.w[id]; if (k <= 0) { t = id; break; } }
        list.push({ t, x, z, ry: r() * 6.283, rx: (r() - .5) * 1.2, rz: (r() - .5) * 1.2, s: 1.05 + r() * .55, rar: rollRar(r), zone: zi, home: true, tint: .82 + r() * .3 });
        counts[t] = (counts[t] || 0) + 1; n--;
      }
    });
    for (const t in D.ITEMS) {
      geo[t] = M.items[t]();
      const cap = t === 'heart' ? 2 : (counts[t] || 0) + 260;
      const m = new T.InstancedMesh(geo[t], itemMat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
      m.setColorAt(0, col.set(1, 1, 1)); m.userData.cap = cap; scene.add(m); meshes[t] = m; inst[t] = [];
    }
    // блёстки редких находок
    const SN = 900, sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(new Float32Array(SN * 3).fill(-9999), 3));
    sg.setAttribute('color', new T.BufferAttribute(new Float32Array(SN * 3), 3));
    sparks = new T.Points(sg, new T.PointsMaterial({ size: 1.5, map: glowTex(), vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    sparks.frustumCulled = false; scene.add(sparks); for (let i = SN - 1; i >= 0; i--) sparkFree.push(i);
    list.forEach(it => addItem(it));
  }
  function glowTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }
  function writeItem(it) {
    const m = meshes[it.t];
    dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(it.rx, it.ry, it.rz); dummy.scale.setScalar(it.s); dummy.updateMatrix();
    m.setMatrixAt(it.slot, dummy.matrix); m.instanceMatrix.needsUpdate = true;
    const rc = D.RAR[it.rar].color, zt = it.zone >= 2 ? .9 : 1;
    m.setColorAt(it.slot, col.setRGB(rc[0] * it.tint * zt, rc[1] * it.tint, rc[2] * it.tint * (it.zone >= 2 ? 1.08 : 1))); m.instanceColor.needsUpdate = true;
    if (it.sp != null) {
      const p = sparks.geometry.attributes.position, c = sparks.geometry.attributes.color;
      p.setXYZ(it.sp, it.x, it.y + .3, it.z); c.setXYZ(it.sp, it.rar == 2 ? .7 : 1, it.rar == 2 ? .35 : .75, it.rar == 2 ? 1 : .2); p.needsUpdate = c.needsUpdate = true;
    }
  }
  function addItem(it) {
    const m = meshes[it.t], L = inst[it.t];
    if (L.length >= m.userData.cap) return false;
    const c = cellAt(it.x, it.z, true), sz = D.ITEMS[it.t].size * it.s;
    it.y = groundH(it.x, it.z) + c.h + sz * .45; c.h += sz * .62; c.items.push(it); it.cell = c;
    it.slot = L.length; L.push(it); m.count = L.length;
    if (it.rar && it.sp == null && sparkFree.length) it.sp = sparkFree.pop();
    it.alive = true; writeItem(it); return true;
  }
  function removeItem(it) {
    if (!it.alive) return; it.alive = false;
    const m = meshes[it.t], L = inst[it.t], last = L.pop();
    if (last !== it) { L[it.slot] = last; last.slot = it.slot; writeItem(last); }
    m.count = L.length; m.instanceMatrix.needsUpdate = true;
    const c = it.cell, sz = D.ITEMS[it.t].size * it.s * .62; c.items.splice(c.items.indexOf(it), 1); c.h = Math.max(0, c.h - sz);
    c.items.forEach(o => { if (o.y > it.y) { o.y -= sz; writeItem(o); } });
    if (it.sp != null) { sparks.geometry.attributes.position.setY(it.sp, -9999); sparks.geometry.attributes.position.needsUpdate = true; sparkFree.push(it.sp); it.sp = null; }
    if (it.home) dead.push({ it, at: time });
  }
  function nearItems(x, z, R, fn) {
    const n = Math.ceil(R / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const c = cells.get((cx + i + 160) * 512 + cz + j + 160); if (c) for (let k = c.items.length - 1; k >= 0; k--) fn(c.items[k]);
    }
  }

  // ---------- сундуки, письма, звёзды ----------
  function buildSpecials() {
    const r = rng(404), cg = M.chest(), lg = M.letter();
    const place = (zi) => {
      for (let n = 0; n < 60; n++) {
        const Z = D.ZONES[zi], a = r() * 6.283, d = lerp(Z.r0 + 4, Z.r1 - 3, r()), x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!colliders.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 2) ** 2) && !specials.some(s => (s.x - x) ** 2 + (s.z - z) ** 2 < 100)) return [x, z];
      }
      return [D.ZONES[zi].r0 + 5, 0];
    };
    let id = 0;
    [4, 5, 5, 6].forEach((n, zi) => { for (let i = 0; i < n; i++, id++) { const [x, z] = place(zi); if (!S.chests.includes(id)) addSpecial('chest', id, x, z, cg); } });
    id = 0;
    [3, 3, 3, 3].forEach((n, zi) => { for (let i = 0; i < n; i++, id++) { const [x, z] = place(zi); if (!S.bottles.includes(id)) addSpecial('bottle', id, x, z, lg); } });
  }
  function addSpecial(kind, id, x, z, g, extra) {
    const mesh = new T.Mesh(g, kind === 'star' ? new T.MeshBasicMaterial({ vertexColors: true }) : decorMat);
    const c = cellAt(x, z), y = groundH(x, z) + (c ? c.h : 0) + (kind === 'chest' ? 0 : .45);
    mesh.position.set(x, y, z); mesh.rotation.y = x * 7; if (kind === 'bottle') mesh.rotation.z = .5; mesh.castShadow = true; scene.add(mesh);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: kind === 'chest' ? 0xffd070 : kind === 'bottle' ? 0x9ff0e0 : 0xfff0a0, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.setScalar(kind === 'star' ? 7 : 3.2); glow.position.set(x, y + .5, z); scene.add(glow);
    const s = Object.assign({ kind, id, x, y, z, mesh, glow }, extra || {}); specials.push(s); return s;
  }
  function takeSpecial(s) {
    scene.remove(s.mesh); scene.remove(s.glow); specials.splice(specials.indexOf(s), 1);
    burst(s.x, s.y + .5, s.z, 30, 0xffe090);
    if (s.kind === 'chest') {
      S.chests.push(s.id); const ai = D.ARTS.findIndex((a, i) => !S.arts.includes(i));
      if (ai >= 0) { S.arts.push(ai); calc(); A.play('art'); UI.artifact(ai); } else gain(500 * D.ZONES[zoneAt(Math.hypot(s.x, s.z))].mult, s, 'Сундук');
    } else if (s.kind === 'bottle') {
      S.bottles.push(s.id); const li = D.LETTERS.findIndex((a, i) => !S.letters.includes(i));
      if (li >= 0) { S.letters.push(li); A.play('art'); UI.letter(li); }
    } else if (s.kind === 'star') { A.play('level'); gain(s.val, s, 'Упавшая звезда'); }
    save();
  }
  function spawnHeart() {
    if (inst.heart.length || (P.held && P.held.t === 'heart')) return;
    const x = -98, z = -106;
    addItem({ t: 'heart', x, z, ry: 0, rx: 0, rz: 0, s: 1, rar: 0, zone: 3, home: false, tint: 1 });
  }

  // ---------- эффекты ----------
  function buildFx() {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(fxN * 3).fill(-9999), 3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(fxN * 3), 3));
    fxPts = new T.Points(g, new T.PointsMaterial({ size: .7, map: glowTex(), vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    fxPts.frustumCulled = false; scene.add(fxPts);
    for (let i = 0; i < fxN; i++) fxData.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    heartPillar = new T.Mesh(new T.CylinderGeometry(.9, .9, 160, 8, 1, true), new T.MeshBasicMaterial({ color: 0x7ffff0, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    heartPillar.visible = false; scene.add(heartPillar);
  }
  let fxI = 0;
  function burst(x, y, z, n, hex) {
    const p = fxPts.geometry.attributes.position, c = fxPts.geometry.attributes.color; col.set(hex);
    for (let i = 0; i < n; i++) {
      const k = fxI = (fxI + 1) % fxN, d = fxData[k]; d.life = .6 + Math.random() * .7;
      d.vx = (Math.random() - .5) * 5; d.vy = 2 + Math.random() * 6; d.vz = (Math.random() - .5) * 5;
      p.setXYZ(k, x, y, z); c.setXYZ(k, col.r, col.g, col.b);
    }
    p.needsUpdate = c.needsUpdate = true;
  }
  function buildHands() {
    heldMesh = new T.Mesh(geo.bottle, itemMat); heldMesh.visible = false; camera.add(heldMesh);
    vacMesh = new T.Mesh(M.merge([M.P(M.cone(.16, .5, 7), 0xf3c3a2, [0, 0, 0], [Math.PI / 2, 0, 0]), M.P(M.cyl(.06, .09, .3, 6), 0xc98f3a, [0, 0, .35], [Math.PI / 2, 0, 0]),
      M.P(M.tor(.16, .03, 4, 7), 0xe8b85a, [0, 0, -.25])]), decorMat);
    vacMesh.position.set(.42, -.34, -.75); vacMesh.scale.setScalar(.6); vacMesh.visible = false; camera.add(vacMesh);
  }

  // ---------- крабы ----------
  let crabGeo;
  function syncCrabs() {
    crabGeo = crabGeo || M.crab();
    while (crabs.length < C.crabN) {
      const m = new T.Mesh(crabGeo, decorMat); m.scale.setScalar(.6); m.castShadow = true; scene.add(m);
      const cm = new T.Mesh(geo.bottle, itemMat); cm.position.y = 1.15; cm.visible = false; m.add(cm);
      const a = crabs.length * 2.4; crabs.push({ m, cm, x: HP.x + Math.cos(a) * 4, z: HP.z + Math.sin(a) * 4, st: 0, tg: null, carry: null, wait: Math.random() });
    }
  }
  function crabTarget() {
    let best = null, bd = 1e9; const types = Object.keys(inst).filter(t => t !== 'heart' && inst[t].length && D.ITEMS[t].w <= C.crabW);
    if (!types.length) return null;
    for (let i = 0; i < 24; i++) {
      const L = inst[types[Math.random() * types.length | 0]], it = L[Math.random() * L.length | 0], d = Math.hypot(it.x, it.z);
      if (d > C.lit - 2 || it.claimed) continue;
      const score = d * (1.6 - it.zone * .25) / (1 + it.rar * 2); if (score < bd) { bd = score; best = it; }
    }
    return best;
  }
  function updCrabs(dt) {
    for (const c of crabs) {
      let tx, tz;
      if (c.st === 0) {
        c.wait -= dt; if (c.wait > 0) continue;
        c.tg = crabTarget(); if (!c.tg) { c.wait = 2; continue; } c.tg.claimed = true; c.st = 1;
      }
      if (c.st === 1) {
        if (!c.tg.alive) { c.tg.claimed = false; c.st = 0; c.wait = .3; continue; } tx = c.tg.x; tz = c.tg.z;
      } else { tx = HP.x; tz = HP.z; }
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), sp = C.crabSp * dt;
      if (d > (c.st === 1 ? .9 : 3.4)) {
        c.x += dx / d * sp; c.z += dz / d * sp;
        for (const o of colliders) { const ox = c.x - o.x, oz = c.z - o.z, od = Math.hypot(ox, oz); if (od < o.r + .5 && !(c.st === 2 && o.x === HP.x && o.z === HP.z)) { c.x = o.x + ox / od * (o.r + .5) + -oz / od * sp; c.z = o.z + oz / od * (o.r + .5) + ox / od * sp; } }
        c.m.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      } else if (c.st === 1) {
        const it = c.tg; it.claimed = false; removeItem(it); c.carry = { t: it.t, rar: it.rar, zone: it.zone };
        c.cm.geometry = geo[it.t]; c.cm.material = rarMats[it.rar]; c.cm.visible = true; c.st = 2;
      } else {
        c.cm.visible = false; launch(c.carry, c.x, c.m.position.y + 1, c.z, 'crab'); c.carry = null; c.st = 0; c.wait = .4;
      }
      const cl = cellAt(c.x, c.z);
      c.m.position.set(c.x, groundH(c.x, c.z) + (cl ? cl.h * .5 : 0) + Math.abs(Math.sin(time * 14 + c.x)) * .08, c.z);
    }
  }

  // ---------- полёт находок ----------
  function launch(info, x, y, z, from, vel) {
    const m = new T.Mesh(geo[info.t], rarMats[info.rar]); m.position.set(x, y, z); m.castShadow = true; scene.add(m);
    const d = { m, info, from, vx: 0, vy: 0, vz: 0, mode: 'fly', far: 0 };
    if (vel) { d.vx = vel.x; d.vy = vel.y; d.vz = vel.z; }
    else { const t = .55; d.vx = (HP.x - x) / t; d.vz = (HP.z - z) / t; d.vy = (HP.y + 1.9 - y + .5 * GRAV * t * t) / t; }
    dyn.push(d); return d;
  }
  function updDyn(dt) {
    for (let i = dyn.length - 1; i >= 0; i--) {
      const d = dyn[i], p = d.m.position; let done = false;
      if (d.mode === 'suck') {
        const tx = camera.position.x, ty = camera.position.y - .5, tz = camera.position.z, dx = tx - p.x, dy = ty - p.y, dz = tz - p.z, L = Math.hypot(dx, dy, dz), sp = 22 * dt;
        if (L < sp + .5) { P.bag.push(d.info); P.incoming--; A.play('pop'); done = true; }
        else { p.x += dx / L * sp; p.y += dy / L * sp; p.z += dz / L * sp; d.m.scale.setScalar(Math.min(1, L / 3)); }
      } else {
        d.vy -= GRAV * dt; p.x += d.vx * dt; p.y += d.vy * dt; p.z += d.vz * dt;
        const hd = Math.hypot(p.x - HP.x, p.z - HP.z);
        if (hd < 2.1 && p.y < HP.y + 2.5 && p.y > HP.y) { burn(d); done = true; }
        else if (p.y < groundH(p.x, p.z) + .3) {
          const r = Math.hypot(p.x, p.z);
          if (r < D.WORLD_R) addItem({ t: d.info.t, x: p.x, z: p.z, ry: Math.random() * 6, rx: 0, rz: 0, s: 1, rar: d.info.rar, zone: d.info.zone, home: false, tint: 1 });
          else if (d.info.t === 'heart') spawnHeart();
          A.play('thud'); done = true;
        }
      }
      d.m.rotation.x += dt * 6; d.m.rotation.z += dt * 4;
      if (done) { scene.remove(d.m); dyn.splice(i, 1); }
    }
  }
  function valueOf(info) {
    let v = D.ITEMS[info.t].v * D.ZONES[info.zone].mult * D.RAR[info.rar].mult;
    if (info.rar) v *= C.goldMul; return v;
  }
  function burn(d) {
    const info = d.info, p = d.m.position;
    if (info.t === 'heart') { finish(); return; }
    let v = valueOf(info) * C.lightMul * (ev.type === 'glow' ? 2 : 1), tag = '';
    if (d.from === 'crab') { v *= C.crabMul; crabAcc += v; }
    else {
      combo.n++; combo.t = C.comboTime; S.st.bestCombo = Math.max(S.st.bestCombo, combo.n);
      v *= 1 + Math.min(combo.n, 20) / 20 * (C.comboMax - 1);
      if (d.far > 15) { v *= 1.5; tag = 'Дальний бросок! '; }
      if (Math.random() < C.critP) { v *= 5; tag += 'Вспышка ×5! '; }
      S.st.burned++; if (info.rar) S.st.goldBurned++;
      A.play('burn', combo.n);
    }
    burst(p.x, HP.y + 2, p.z, d.from === 'crab' ? 5 : 12 + info.rar * 14, info.rar == 2 ? 0xc080ff : info.rar ? 0xffd040 : 0xffb060);
    gain(v, { x: HP.x, y: HP.y + 3, z: HP.z }, tag, d.from === 'crab');
    fireKick = 1;
  }
  let fireKick = 0;
  function gain(v, pos, tag, small) {
    S.light += v; S.total += v; rateAcc += v;
    if (pos) UI.floater(pos, (tag || '') + '+' + D.fmt(v) + ' ✦', small);
  }

  // ---------- действия игрока ----------
  const ray = new T.Raycaster(), ndc = new T.Vector2(), tv = new V3();
  function pickAt(o, d, reach) {
    let best = null, bt = 1e9, heavy = null;
    for (const s of specials) {
      tv.set(s.x - o.x, s.y + .3 - o.y, s.z - o.z); const t = tv.dot(d);
      if (t > 0 && t < reach + 1.5 && tv.lengthSq() - t * t < 1.2 && t < bt) { bt = t; best = s; }
    }
    if (best) return { sp: best };
    nearItems(o.x + d.x * reach * .5, o.z + d.z * reach * .5, reach * .5 + 1.5, it => {
      tv.set(it.x - o.x, it.y - o.y, it.z - o.z); const t = tv.dot(d); if (t < .2 || t > reach) return;
      const rad = D.ITEMS[it.t].size * it.s * .75 + .12;
      if (tv.lengthSq() - t * t < rad * rad && t < bt) { bt = t; best = it; }
    });
    return best ? { it: best } : null;
  }
  function action(sx, sy) {                      // тап по миру или кнопка действия
    if (!running || ending) return;
    if (sx == null) ndc.set(0, 0); else ndc.set(sx / window.innerWidth * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction;
    const hit = pickAt(o, d, C.reach);
    if (hit && hit.sp) { takeSpecial(hit.sp); return; }
    if (P.held) {                                 // с находкой в руках: целишься в горн — бросок
      const hx = HP.x - o.x, hz = HP.z - o.z, hl = Math.hypot(hx, hz);
      if (hl < 30 && (d.x * hx + d.z * hz) / (hl * Math.hypot(d.x, d.z) || 1) > .93) { throwHeld(d); return; }
    }
    if (hit) {
      const it = hit.it, I = D.ITEMS[it.t];
      if (I.w > C.str) { UI.toast('Слишком тяжело: ' + I.w + ' кг. Прокачай «Силу» (сейчас ' + C.str + ' кг)'); A.play('no'); return; }
      if (P.held) {
        if (P.held.t !== 'heart' && it.t !== 'heart' && P.bag.length + P.incoming < C.bagCap) P.bag.push(P.held);
        else { if (time - lastToastWall > 3) { UI.toast(C.bagCap ? 'Мешок полон — неси к горну' : 'Руки заняты: купи мешок, чтобы носить больше'); lastToastWall = time; } throwHeld(d); return; }
      }
      removeItem(it); P.held = { t: it.t, rar: it.rar, zone: it.zone }; S.st.picked++; A.play('pick');
      if (it.t === 'heart') { S.st.heartPicked = 1; UI.toast('Сердце моря у тебя. Неси его к маяку!'); }
      showHeld(); return;
    }
    if (P.held) throwHeld(d);
  }
  function showHeld() {
    if (!P.held) { heldMesh.visible = false; return; }
    heldMesh.geometry = geo[P.held.t]; heldMesh.material = rarMats[P.held.rar]; heldMesh.visible = true;
    const s = .2 / D.ITEMS[P.held.t].size; heldMesh.scale.setScalar(s); heldMesh.position.set(vacMesh.visible ? -.34 : .34, -.3, -.8); heldMesh.rotation.set(.3, .6, 0);
  }
  function throwHeld(d) {
    const o = camera.position, dx = HP.x - o.x, dz = HP.z - o.z, dist = Math.hypot(dx, dz);
    let vel = null;
    const aim = (d.x * dx + d.z * dz) / (dist * Math.hypot(d.x, d.z) || 1);
    if (aim > .93 && dist < C.throwV * C.throwV / GRAV * .95 && dist > 1) {     // помощь в прицеливании
      const t = Math.max(.35, dist / (C.throwV * .8)), y0 = o.y - .3;
      vel = new V3(dx / t, (HP.y + 1.9 - y0 + .5 * GRAV * t * t) / t, dz / t);
    } else vel = new V3(d.x * C.throwV, d.y * C.throwV + 2.5, d.z * C.throwV);
    const dd = launch(P.held, o.x + d.x * .6, o.y - .3, o.z + d.z * .6, 'hand', vel); dd.far = dist;
    P.held = null; showHeld(); A.play('throw');
  }
  function updVac(dt) {
    vacMesh.visible = !!S.up.vac; if (!S.up.vac) return;
    vacMesh.rotation.z = input.vac ? time * 20 : 0; vacMesh.position.z = input.vac ? -.75 + Math.sin(time * 40) * .01 : -.75;
    if (!input.vac) return;
    vacT -= dt; if (vacT > 0) return;
    if (P.bag.length + P.incoming >= C.bagCap) { if (time - lastToastWall > 2) { UI.toast('Мешок полон — к горну!'); lastToastWall = time; } return; }
    camera.getWorldDirection(tv); const dx = tv.x, dy = tv.y, dz = tv.z, o = camera.position; let best = null, bd = 1e9;
    nearItems(o.x + dx * C.vacR * .5, o.z + dz * C.vacR * .5, C.vacR * .5 + 1, it => {
      if (D.ITEMS[it.t].w > C.vacW || it.t === 'heart') return;
      const ex = it.x - o.x, ey = it.y - o.y, ez = it.z - o.z, L = Math.hypot(ex, ey, ez); if (L > C.vacR) return;
      if ((ex * dx + ey * dy + ez * dz) / L < .72) return; if (L < bd) { bd = L; best = it; }
    });
    if (best) {
      removeItem(best); P.incoming++; S.st.picked++; vacT = C.vacDt;
      const d = launch({ t: best.t, rar: best.rar, zone: best.zone }, best.x, best.y, best.z, 'bag'); d.mode = 'suck';
    }
  }
  function goHome() {
    if (!S.up.home || ending) return;
    if (Math.hypot(P.x, P.z) > 14) { P.back = { x: P.x, z: P.z, yaw: P.yaw }; P.x = 4.5; P.z = 13.5; P.yaw = Math.atan2(-(HP.x - P.x), -(HP.z - P.z)); }
    else if (P.back) { P.x = P.back.x; P.z = P.back.z; P.yaw = P.back.yaw; P.back = null; }
    else { UI.toast('Отойди от маяка — тогда раковина запомнит место'); return; }
    A.play('art'); burst(P.x, groundH(P.x, P.z) + 1, P.z, 24, 0x9ff0e0);
  }

  // ---------- покупки ----------
  function canSee(id) { const u = D.UP[id]; return S.lh >= u.req && (!u.need || S.up[u.need[0]] >= u.need[1]); }
  function buy(id) {
    const u = D.UP[id], l = S.up[id]; if (l >= u.max || !canSee(id)) return false;
    const c = D.cost(id, l); if (S.light < c) { A.play('no'); return false; }
    S.light -= c; S.up[id]++; S.st.bought++; calc(); syncCrabs(); A.play('buy'); save(); return true;
  }
  function kindle() {
    if (S.lh >= 8) return false; const c = D.LH_COST[S.lh]; if (S.light < c) { A.play('no'); return false; }
    S.light -= c; S.lh++; calc(); A.play('level'); burst(HP.x, HP.y + 3, HP.z, 80, 0xfff0a0); fireKick = 3;
    UI.banner('Маяк: ' + D.LH_NAMES[S.lh], S.lh >= 8 ? 'Вдали вспыхнул столб света. Сердце моря ждёт на краю бездны.' : 'Мгла отступила. Открыто новое дно.');
    if (S.lh >= 8) spawnHeart(); save(); return true;
  }

  // ---------- события ----------
  function updEvents(dt) {
    if (ev.type) { ev.t -= dt; if (ev.t <= 0) { ev.type = null; UI.eventBar(null); } else UI.eventBar(ev); return; }
    ev.next -= dt; if (ev.next > 0 || S.st.burned < 5) return;
    ev.next = 80 + Math.random() * 50; const k = Math.random();
    if (k < .34) { ev.type = 'glow'; ev.t = ev.dur = 30; ev.name = '🌟 Сияние: весь свет ×2'; UI.banner('Сияние!', '30 секунд горн даёт двойной свет'); }
    else if (k < .67) {
      let n = 0; nearItems(P.x, P.z, 26, it => { if (n < 16 && !it.rar && Math.random() < .12 && Math.hypot(it.x, it.z) < C.lit - 1 && it.t !== 'heart') { it.rar = 1; if (sparkFree.length) it.sp = sparkFree.pop(); writeItem(it); n++; } });
      UI.banner('Золотой отлив!', 'Рядом с тобой заблестели находки: ' + n); ev.type = 'gold'; ev.t = ev.dur = 4; ev.name = '✨ Золотой отлив';
    } else {
      const a = Math.random() * 6.283, d = 14 + Math.random() * 18; let x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; const r = Math.hypot(x, z);
      if (r > C.lit - 4) { x *= (C.lit - 4) / r; z *= (C.lit - 4) / r; } if (Math.hypot(x, z) < 15) { x = 18; z = 6; }
      const zi = zoneAt(Math.hypot(x, z));
      addSpecial('star', 0, x, z, M.star(), { val: 60 * D.ZONES[zi].mult * C.lightMul, pillar: true });
      UI.banner('Звездопад!', 'Где-то рядом упала звезда — ищи сияние'); ev.type = 'star'; ev.t = ev.dur = 4; ev.name = '⭐ Звездопад'; A.play('art');
    }
  }
  function offline() {
    const dt = Math.min((Date.now() - S.last) / 1000, C.offH * 3600);
    if (dt > 120 && S.crabRate > 0 && C.crabN) { const v = S.crabRate * dt * .6; S.light += v; S.total += v; G.offlineGain = { v, dt }; }
  }

  // ---------- финал ----------
  function finish() {
    S.heartDone = true; save(); ending = .001; water.visible = true; A.play('level'); UI.ending();
    burst(HP.x, HP.y + 3, HP.z, 200, 0x7ffff0);
  }
  function rebirth() {
    const keep = { arts: S.arts, letters: S.letters, chests: S.chests, bottles: S.bottles, opt: S.opt, pearls: S.pearls + 1 + Math.floor(S.arts.length / 5), runs: S.runs + 1 };
    S = Object.assign(fresh(), keep); for (const id in D.UP) S.up[id] = 0; save(); location.reload();
  }
  function wipe() { localStorage.removeItem(KEY); location.reload(); }

  // ---------- ввод ----------
  function bindInput(cv) {
    const K = input.keys;
    window.addEventListener('keydown', e => {
      K[e.code] = 1; if (!running) return;
      if (e.code === 'KeyU' || e.code === 'Tab') { e.preventDefault(); UI.toggle('shop'); }
      if (e.code === 'KeyC') UI.toggle('book'); if (e.code === 'KeyH') goHome(); if (e.code === 'KeyF') input.vac = true;
      if (e.code === 'KeyE' || e.code === 'Space') action();
    });
    window.addEventListener('keyup', e => { K[e.code] = 0; if (e.code === 'KeyF') input.vac = false; });
    {
      cv.addEventListener('mousedown', e => {
        if (!running || UI.open()) return;
        if (document.pointerLockElement !== cv) { cv.requestPointerLock && cv.requestPointerLock(); drag = { x: e.clientX, y: e.clientY }; return; }
        if (e.button === 0) action(); if (e.button === 2) input.vac = true;
      });
      let drag = null;
      window.addEventListener('mouseup', e => { if (e.button === 2) input.vac = false; drag = null; });
      window.addEventListener('mousemove', e => {
        if (document.pointerLockElement === cv) look(e.movementX, e.movementY, .0023);
        else if (drag) { look(-(e.clientX - drag.x), -(e.clientY - drag.y), .004); drag = { x: e.clientX, y: e.clientY }; }
      });
      cv.addEventListener('contextmenu', e => e.preventDefault());
    }
    // тач: левая часть — джойстик, остальное — обзор, короткий тап — действие
    let joy = null, lk = null; const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    cv.addEventListener('touchstart', e => {
      e.preventDefault(); A.unlock();
      for (const t of e.changedTouches) {
        if (!joy && t.clientX < window.innerWidth * .42 && t.clientY > window.innerHeight * .4) {
          joy = { id: t.identifier, x: t.clientX, y: t.clientY }; stick.style.display = 'block'; stick.style.left = t.clientX - 60 + 'px'; stick.style.top = t.clientY - 60 + 'px'; knob.style.transform = '';
        } else if (!lk) lk = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), mv: 0 };
      }
    }, { passive: false });
    cv.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (joy && t.identifier === joy.id) {
          let dx = t.clientX - joy.x, dy = t.clientY - joy.y; const L = Math.hypot(dx, dy), m = 55; if (L > m) { dx *= m / L; dy *= m / L; }
          input.mx = dx / m; input.mz = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (lk && t.identifier === lk.id) { const dx = t.clientX - lk.x, dy = t.clientY - lk.y; lk.mv += Math.abs(dx) + Math.abs(dy); look(dx, dy, .0055); lk.x = t.clientX; lk.y = t.clientY; }
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (joy && t.identifier === joy.id) { joy = null; input.mx = input.mz = 0; stick.style.display = 'none'; }
        else if (lk && t.identifier === lk.id) { if (lk.mv < 14 && performance.now() - lk.t0 < 350) action(lk.sx, lk.sy); lk = null; }
      }
    };
    cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
  }
  function look(dx, dy, k) { P.yaw -= dx * k * S.opt.sens; P.pitch = clamp(P.pitch - dy * k * S.opt.sens, -1.35, 1.2); }

  // ---------- цикл ----------
  const SKY = [ // верх, горизонт, солнце, сила солнца, сила неба
    [0x4f9fd0, 0xf6dcae, 0xfff2d6, 2.7, 1.5], [0x4a68b0, 0xf7a868, 0xffb478, 2.3, 1.25], [0x18224a, 0x6d5a90, 0x9fb0ff, .9, .8], [0x3f7fc0, 0xf2c8a0, 0xffe2c0, 2.3, 1.35]];
  const c1 = new T.Color(), c2 = new T.Color();
  function updSky() {
    const t = (time / 420 + .05) % 1 * 4, i = Math.floor(t), f = sm(t - i), a = SKY[i], b = SKY[(i + 1) % 4];
    const u = sky.material.uniforms; u.top.value.set(a[0]).lerp(c1.set(b[0]), f); u.hor.value.set(a[1]).lerp(c1.set(b[1]), f);
    scene.fog.color.copy(u.hor.value); sun.color.set(a[2]).lerp(c1.set(b[2]), f); sun.intensity = lerp(a[3], b[3], f); hemi.intensity = lerp(a[4], b[4], f);
    hemi.color.copy(u.top.value).lerp(c2.set(0xffffff), .55);
    const night = i === 2 ? 1 - Math.abs(f - .5) * 1.2 : i === 1 ? f * .4 : i === 3 ? 0 : 0;
    beam.userData.mat.opacity = .05 + night * .16 + S.lh * .008; wall.material.color.set(0x34557c).lerp(u.hor.value, .12);
    sunBall.material.color.copy(sun.color); sky.userData.clouds.material.color.copy(u.hor.value).lerp(c2.set(0xffffff), .6);
    const ang = t / 4 * 6.283, sx = Math.cos(ang * .5 + .6), sy = .35 + .3 * Math.cos(ang), sz = Math.sin(ang * .5 + .6);
    sun.position.set(P.x + sx * 90, 60 + sy * 60, P.z + sz * 90); sun.target.position.set(P.x, 0, P.z);
    sunBall.position.set(camera.position.x + sx * 600, camera.position.y + 90 + sy * 160, camera.position.z + sz * 600); sunBall.lookAt(camera.position);
    sky.position.copy(camera.position);
  }
  let lastT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - lastT) / 1000 || 0); lastT = now; time += dt;
    if (running && !ending) step(dt);
    if (ending) {
      ending += dt; water.position.y = lerp(-30, 2.5, sm(clamp(ending / 14, 0, 1)));
      const a = ending * .08 + 1; camera.position.set(Math.cos(a) * 9, 27 + ending * .15, Math.sin(a) * 9); camera.rotation.set(-.32, Math.atan2(Math.cos(a), Math.sin(a)) + 0, 0);
      camera.rotation.y = Math.atan2(camera.position.x, camera.position.z); wallR += dt * 30; scene.fog.far = 210 + ending * 20;
    }
    for (const f of flame) { const s = (1 + .25 * Math.sin(time * 9 + f.userData.ph)) * (1 + fireKick * .5) * (.8 + S.lh * .06); f.scale.set(1, s * f.userData.h, 1); f.position.y = HP.y + 1.4 + s * f.userData.h * .8; f.rotation.y += dt * 2; }
    fireKick = Math.max(0, fireKick - dt * 2.5); fireLight.intensity = 26 + Math.sin(time * 13) * 5 + fireKick * 40;
    beam.rotation.y += dt * .35;
    wallR = ending ? wallR : lerp(wallR, C.lit + 1.5, Math.min(1, dt * 1.2)); wall.scale.set(wallR, 1, wallR);
    updFx(dt); updDyn(dt); updSky();
    for (const s of specials) { s.mesh.rotation.y += dt * (s.kind === 'star' ? 2 : .4); s.glow.material.opacity = .55 + .3 * Math.sin(time * 3 + s.x); if (s.kind === 'star') s.mesh.position.y = s.y + .6 + Math.sin(time * 2) * .2; }
    const h = inst.heart[0]; heartPillar.visible = !!h; if (h) heartPillar.position.set(h.x, h.y + 78, h.z);
    renderer.render(scene, camera);
    UI.frame(dt);
  }
  function updFx(dt) {
    const p = fxPts.geometry.attributes.position; let any = false;
    for (let i = 0; i < fxN; i++) { const d = fxData[i]; if (d.life <= 0) continue; d.life -= dt; any = true;
      if (d.life <= 0) p.setY(i, -9999); else { d.vy -= 7 * dt; p.setXYZ(i, p.getX(i) + d.vx * dt, p.getY(i) + d.vy * dt, p.getZ(i) + d.vz * dt); } }
    if (any) p.needsUpdate = true;
  }
  function step(dt) {
    S.st.time += dt;
    // движение
    const K = input.keys; let mx = input.mx + (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), mz = input.mz + (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    if (ml > .05 && !UI.open()) {
      const s = Math.sin(P.yaw), c = Math.cos(P.yaw), sp = C.speed * dt * (P.held && P.held.t === 'heart' ? .8 : 1);
      P.x += (mx * c + mz * s) * sp; P.z += (-mx * s + mz * c) * sp; P.bob += dt * 11 * Math.min(1, ml);
      for (const o of colliders) { const ox = P.x - o.x, oz = P.z - o.z, od = Math.hypot(ox, oz), R = o.r + .45; if (od < R) { P.x = o.x + ox / od * R; P.z = o.z + oz / od * R; } }
      const r = Math.hypot(P.x, P.z), lim = Math.min(C.lit - .8, D.WORLD_R - 1);
      if (r > lim) { P.x *= lim / r; P.z *= lim / r; if (time - lastToastWall > 4) { UI.toast(S.lh >= 7 ? 'Дальше — бездна' : 'Дальше мгла. Разожги маяк, чтобы пройти'); lastToastWall = time; } }
    }
    const cl = cellAt(P.x, P.z), ty = groundH(P.x, P.z) + Math.min(1.3, cl ? cl.h * .55 : 0);
    P.y = lerp(P.y, ty, Math.min(1, dt * 9));
    camera.position.set(P.x, P.y + EYE + Math.sin(P.bob) * .045, P.z); camera.rotation.set(P.pitch, P.yaw, 0);
    const pr = Math.hypot(P.x, P.z), z = pr < 16 ? -1 : zoneAt(pr);
    if (z !== zoneShown) { zoneShown = z; if (z >= 0) { UI.zone(D.ZONES[z].name, '×' + D.ZONES[z].mult + ' света'); S.st.maxZone = Math.max(S.st.maxZone, z); } }
    // мешок высыпается у горна
    const hd = Math.hypot(P.x - HP.x, P.z - HP.z); dumpT -= dt;
    if (hd < 8.5 && P.bag.length && dumpT <= 0) { launch(P.bag.pop(), P.x, P.y + 1.2, P.z, 'bag'); dumpT = .11; A.play('throw'); }
    updVac(dt); updCrabs(dt); updEvents(dt);
    if (combo.t > 0) { combo.t -= dt; if (combo.t <= 0) combo.n = 0; }
    // возвращение находок течением
    if (dead.length && time - dead[0].at > C.respawn) {
      const d = dead.shift(), it = d.it;
      if ((it.x - P.x) ** 2 + (it.z - P.z) ** 2 > 500) { it.rar = rollRar(Math.random); addItem(it); } else { d.at = time - C.respawn + 20; dead.push(d); }
    }
    rateT += dt; if (rateT >= 2) { rate = lerp(rate, rateAcc / rateT, .5); S.crabRate = lerp(S.crabRate, crabAcc / rateT, .1); rateAcc = crabAcc = rateT = 0; }
    // задания
    const q = D.QUESTS[S.quest];
    if (q && q[1](S)) { S.quest++; if (q[2]) gain(q[2] * (1 + S.pearls * .5), null); UI.questDone(q[0], q[2] * (1 + S.pearls * .5)); A.play('buy'); }
    saveT += dt; if (saveT > 8) { saveT = 0; save(); }
  }
  function senseTarget() {
    if (!S.up.sense) return null; let best = null, bd = 1e9;
    for (const s of specials) { if (Math.hypot(s.x, s.z) > C.lit - 1) continue; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; best = s; } }
    return best && { d: bd, ang: Math.atan2(-(best.x - P.x), -(best.z - P.z)) - P.yaw, kind: best.kind };
  }
  function lookInfo() {            // подпись под прицелом
    ndc.set(0, 0); ray.setFromCamera(ndc, camera); const h = pickAt(ray.ray.origin, ray.ray.direction, C.reach);
    if (!h) return null; if (h.sp) return { name: h.sp.kind === 'chest' ? 'Сундук' : h.sp.kind === 'bottle' ? 'Бутылка с письмом' : 'Упавшая звезда', sp: 1 };
    const I = D.ITEMS[h.it.t]; return { name: I.name, w: I.w, rar: h.it.rar, v: valueOf(h.it) * C.lightMul, heavy: I.w > C.str };
  }
  window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  return {
    init, get S() { return S; }, C, P, input, buy, kindle, canSee, action, goHome, save, rebirth, wipe, calc, senseTarget, lookInfo, touch,
    start() { running = true; A.unlock(); A.set(S.opt.snd); }, get running() { return running; }, get rate() { return rate; }, get combo() { return combo; },
    get ending() { return ending; }, project(p) { tv.set(p.x, p.y, p.z).project(camera); return tv.z > 1 ? null : { x: (tv.x + 1) / 2 * window.innerWidth, y: (1 - tv.y) / 2 * window.innerHeight }; },
    HP, _dbg: { inst, specials, crabs, dyn, takeSpecial, sim(n, dt) { for (let i = 0; i < n; i++) { time += dt; step(dt); updDyn(dt); } }, get camera() { return camera; }, get ev() { return ev; } }
  };
})();

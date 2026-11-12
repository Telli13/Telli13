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
    heartDone: false, parts: [], posts: [], door: false, belt: [], hunger: 100, food: 0, meds: 0, beam: { on: 1, sp: 1, hold: 0 }, calls: 0, crabRate: 0, last: Date.now(), runs: 0,
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
    C.lightMul = (1 + u.lens * .2) * (1 + a.light) * (1 + S.pearls * .5) * (S.door ? 2 : 1);
    C.comboMax = 1.5 + u.combo * .5; C.comboTime = 5 + a.combo; C.critP = u.crit * .05;
    C.respawn = 200 * (1 - u.tide * .2) * (1 - Math.min(.5, a.tide)); C.goldMul = 1 + u.gold * .3 + a.gold;
    C.lit = D.LIT[S.lh]; C.beltSp = 4 * (1 + u.beltSp * .3);
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
  let renderer, scene, camera, sun, hemi, sky, wall, water, flame = [], embers = [], coals, fireGlow, fireLight, beam, sunBall, lampMesh;
  let itemMat, rarMats, decorMat;
  const colliders = [{ x: 0, z: 0, r: 3.9 }, { x: HP.x, z: HP.z, r: 2.6, forge: true }];
  // горны: главный у маяка и дальние, которые игрок зажигает сам
  const forges = [{ x: HP.x, z: HP.z, y: HP.y, r: 2.2, h: 1.9, ty: 1.3, main: true }];
  function nearForge(x, z) { let b = forges[0], bd = 1e9; for (const f of forges) { const d = (f.x - x) ** 2 + (f.z - z) ** 2; if (d < bd) { bd = d; b = f; } } return b; }
  let sprF, flameT;
  function flameMat(seed) {
    return new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
      uniforms: { t: { value: 0 }, seed: { value: seed }, pw: { value: 1 } },
      vertexShader: `uniform float t, seed; varying vec2 vUv; varying float ang;
        void main(){ vUv = uv; ang = atan(position.z, position.x); vec3 p = position; float k = uv.y*uv.y;
          p.x += sin(t*3.1 + seed*5. + p.y*1.7)*.16*k; p.z += cos(t*2.6 + seed*3. + p.y*1.3)*.16*k;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.); }`,
      fragmentShader: `uniform float t, seed, pw; varying vec2 vUv; varying float ang;
        float hs(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float ns(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(mix(hs(i), hs(i+vec3(1,0,0)), f.x), mix(hs(i+vec3(0,1,0)), hs(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(hs(i+vec3(0,0,1)), hs(i+vec3(1,0,1)), f.x), mix(hs(i+vec3(0,1,1)), hs(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){ float y = vUv.y;
          vec3 q = vec3(cos(ang)*1.6, sin(ang)*1.6, y*2.6 - t*2.1) + seed*9.;
          float n = ns(q)*.6 + ns(q*2.1 + 3.)*.28 + ns(q*4.3 + 9.)*.12;
          float f = n*1.5 + (1. - y)*1.15 - .95 - y*y*.55 + (pw - 1.)*.35;
          float a = smoothstep(0., .22, f) * smoothstep(0., .06, y) * (1. - smoothstep(.85, 1., y));
          vec3 col = mix(vec3(.85,.13,.02), vec3(1.,.42,.04), smoothstep(0., .3, f));
          col = mix(col, vec3(1.,.74,.2), smoothstep(.25, .6, f));
          col = mix(col, vec3(1.,.96,.72), smoothstep(.6, 1.05, f));
          gl_FragColor = vec4(col, a*.93); }` });
  }
  function addFlames(bx, by, bz, n, R, sc) {           // пламя: три вложенные оболочки с бегущим шумом
    [[1.12, .16, 2.5], [.78, .1, 3.1], [.44, .04, 3.6]].forEach((d, i) => {
      const g = new T.CylinderGeometry(d[1] * R, d[0] * R, d[2], 28, 10, true); g.translate(0, d[2] / 2, 0);
      const m = new T.Mesh(g, flameMat(Math.random() * 10 + i)); m.position.set(bx, by, bz); m.renderOrder = 6 + i; m.userData.sc = sc; scene.add(m); flame.push(m);
    });
  }

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
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.opt.q ? 2 : 1.6));
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
    const atlas = M.atlas(), mk = () => new T.MeshPhongMaterial({ vertexColors: true, map: atlas, shininess: 28, specular: 0x2a2a2a });
    itemMat = mk(); decorMat = mk(); decorMat.shininess = 8; decorMat.specular.set(0x111111);
    rarMats = D.RAR.map((r, i) => { const m = mk(); m.color.setRGB(...r.color); if (i) { m.shininess = 90; m.specular.set(i == 1 ? 0xffe9a0 : 0xd0a0ff); } return m; });
    buildSky(); buildTerrain(); buildLighthouse(); buildDecor(); buildItems(); buildSpecials(); buildPosts(); buildFx(); buildHands(); buildTop(); buildTornado(); for (let i = 0; i + 1 < S.belt.length; i++) addSeg(i);
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
    sky = new T.Mesh(new T.SphereGeometry(700, 32, 16), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color() }, hor: { value: new T.Color() }, sunCol: { value: new T.Color() }, sunDir: { value: new V3(0, 1, 0) }, t: { value: 0 }, storm: { value: 0 } },
      vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, hor, sunCol, sunDir; uniform float t, storm; varying vec3 d;
        float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float ns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = .5, v = 0.; for(int i=0;i<5;i++){ v += a*ns(p); p = p*2.03 + 7.3; a *= .5; } return v; }
        void main(){ vec3 n = normalize(d); float h = max(n.y, 0.);
          vec3 col = mix(hor, top, pow(clamp(h*1.4, 0., 1.), .55));
          float s = max(dot(n, sunDir), 0.);
          col += sunCol * (pow(s, 900.)*6. + pow(s, 60.)*.5 + pow(s, 6.)*.22);
          vec2 uv = n.xz / (n.y + .14);
          float c = fbm(uv*.9 + vec2(t*.012, t*.005)), c2 = fbm(uv*2.3 - vec2(t*.02, 0.));
          float cov = mix(.44, .26, storm);
          float cl = smoothstep(cov, cov + .28, c*.75 + c2*.25) * smoothstep(0., .22, n.y);
          vec3 lit = mix(hor, vec3(1.), .62) + sunCol*pow(s, 4.)*.5;
          vec3 shade = mix(hor*.55, top*.5, .5);
          vec3 cc = mix(lit, shade, smoothstep(.45, .9, c2*.6 + c*.5));
          cc = mix(cc, vec3(.13,.14,.17), storm*.6);
          col = mix(col, cc, cl*.92);
          col = mix(col, hor, pow(1. - h, 14.)*.8);
          gl_FragColor = vec4(pow(col, vec3(.4545)), 1.); }`
    }));
    scene.add(sky);
  }
  function buildTerrain() {
    const N = S.opt.q ? 180 : 120, g = new T.PlaneGeometry(520, 520, N, N); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, c = new Float32Array(p.count * 3), uv = g.attributes.uv;
    const A = new T.Color(0xe9cf9a), B = new T.Color(0xb99a66), W = new T.Color(0x6e9a93), Dp = new T.Color(0x4f7a86);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = groundH(x, z), r = Math.hypot(x, z); p.setY(i, y);
      col.copy(A).lerp(B, noise(x * .08, z * .08));
      col.lerp(W, sstep(.2, -1.6, y + r * .028) * .7);          // сырые низины
      col.lerp(Dp, sstep(70, 160, r) * .45);                     // к бездне дно холоднее
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; uv.setXY(i, x / 9, z / 9);
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, map: M.sandTex() })); m.receiveShadow = true; scene.add(m);
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
    const parts = [], Pp = M.P, W = M.WOOD, Mt = M.METAL;
    parts.push(Pp(M.cyl(12, 12.6, 1.2, 28), 0xb9b09c, [0, .08, 0]));                     // пирс
    for (let i = 0; i < 5; i++) parts.push(Pp(M.cyl(3.3 - i * .22, 3.52 - i * .22, 4.4, 24), i % 2 ? 0xd9482f : 0xf4efe2, [0, 2.8 + i * 4.4, 0]));
    parts.push(Pp(M.cyl(4.6, 3.4, .5, 28), 0x4a4f58, [0, 22.9, 0], 0, 1, Mt));           // галерея
    parts.push(Pp(M.tor(4.45, .045, 5, 28), 0x30343a, [0, 24.0, 0], [Math.PI / 2, 0, 0], 1, Mt)); parts.push(Pp(M.tor(4.45, .04, 5, 28), 0x30343a, [0, 23.7, 0], [Math.PI / 2, 0, 0], 1, Mt));
    for (let i = 0; i < 18; i++) parts.push(Pp(M.cyl(.035, .035, .9, 5), 0x30343a, [Math.cos(i * .349) * 4.45, 23.58, Math.sin(i * .349) * 4.45], 0, 1, Mt));
    parts.push(Pp(M.cyl(1.7, 1.7, 2.6, 16), 0x3d4650, [0, 24.4, 0], 0, 1, Mt));
    parts.push(Pp(M.cone(2.4, 2.2, 16), 0xd9482f, [0, 26.8, 0], 0, 1, Mt));
    parts.push(Pp(M.sph(.3, 8, 6), 0xe8b85a, [0, 28, 0], 0, 1, Mt));
    parts.push(Pp(M.box(1.3, 2.3, .3), 0x6a4830, [0, 1.75, 3.45], 0, 1, W));              // дверь
    parts.push(Pp(M.cyl(.8, .8, .3, 12, false, Math.PI), 0x6a4830, [0, 2.9, 3.45], [Math.PI / 2, Math.PI / 2, 0], [1, 1, .8], W));
    for (const y of [8, 13, 18]) parts.push(Pp(M.box(.7, 1.1, .3), 0x24343f, [0, y, 3.2 - y * .045]));
    // горн: низкая широкая чаша — в огонь можно смотреть сверху
    parts.push(Pp(M.cyl(1.5, 2.0, .5, 16), 0x8f8676, [HP.x, HP.y + .25, HP.z]));
    parts.push(Pp(M.lathe([[0, .42], [1.2, .42], [1.95, .8], [2.25, 1.12], [2.4, 1.12], [2.15, .72], [1.3, .36], [0, .36]], 24), 0xc98f3a, [HP.x, HP.y, HP.z], 0, 1, Mt));
    parts.push(Pp(M.tor(2.32, .09, 6, 24), 0xe8b85a, [HP.x, HP.y + 1.12, HP.z], [Math.PI / 2, 0, 0], 1, Mt));
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + .3, r = .35 + (i % 3) * .4;      // поленья и угли
      parts.push(Pp(M.cyl(.12, .14, 1.1, 7), 0x2a1a10, [HP.x + Math.cos(a) * r, HP.y + .68 + (i % 2) * .12, HP.z + Math.sin(a) * r], [Math.PI / 2 + (i % 2 ? .1 : -.08), a + 1.2, 0], 1, W)); }
    const m = new T.Mesh(M.merge(parts), decorMat); m.castShadow = m.receiveShadow = true; scene.add(m);
    coals = new T.Mesh(new T.CircleGeometry(1.5, 20), new T.MeshBasicMaterial({ map: M.coalTex(), fog: false, toneMapped: false }));
    coals.rotation.x = -Math.PI / 2; coals.position.set(HP.x, HP.y + .56, HP.z); scene.add(coals);
    lampMesh = new T.Mesh(M.sph(1.0, 12, 8), new T.MeshBasicMaterial({ color: 0xfff3c0, fog: false })); lampMesh.position.y = 25.3; scene.add(lampMesh);
    beam = new T.Group(); beam.position.y = 24.4; scene.add(beam);
    const bm = new T.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    for (const s of [1, -1]) { const b = new T.Mesh(new T.ConeGeometry(9, 170, 14, 1, true), bm); b.rotation.z = s * Math.PI / 2; b.position.x = s * 85; beam.add(b); }
    beam.userData.mat = bm;
    // живой огонь: языки пламени и искры из спрайтов
    const ft = M.flameTex(), gt = glowTex();
    const spr = (tex, norm) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, blending: norm ? T.NormalBlending : T.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false })); sp.renderOrder = 6; scene.add(sp); return sp; };
    addFlames(HP.x, HP.y + .62, HP.z, 0, 1.35, 1);
    for (let i = 0; i < 22; i++) embers.push({ s: spr(gt), life: Math.random() * 2, max: 2, x: 0, z: 0, vy: 1, ph: Math.random() * 6 });
    fireGlow = spr(gt); fireGlow.material.color.set(0xff8a30); fireGlow.material.color.set(0x3a1a05); fireGlow.position.set(HP.x, HP.y + 1.5, HP.z);
    fireLight = new T.PointLight(0xffa050, 30, 28, 1.6); fireLight.position.set(HP.x, HP.y + 2, HP.z); scene.add(fireLight);
  }
  function updFire(dt) {
    const pw = (.9 + S.lh * .04) * (1 + fireKick * .3);
    for (const f of flame) { const u = f.material.uniforms; u.t.value = time; u.pw.value = pw; f.scale.set(1, f.userData.sc * (.9 + pw * .12), 1); }
    for (const e of embers) {
      e.life -= dt;
      if (e.life <= 0) { const a = Math.random() * 6.283, r = Math.random() * 1.2; e.x = Math.cos(a) * r; e.z = Math.sin(a) * r; e.max = e.life = 1.2 + Math.random() * 1.6; e.vy = 1.6 + Math.random() * 1.8; e.teal = Math.random() < .25; }
      const k = 1 - e.life / e.max, t = e.max - e.life, o = (1 - k) * 1.2;
      e.s.position.set(HP.x + e.x + Math.sin(time * 3 + e.ph) * .35 * k, HP.y + 1 + e.vy * t, HP.z + e.z + Math.cos(time * 2.3 + e.ph) * .35 * k);
      e.s.scale.setScalar(.09 + .03 * Math.sin(time * 20 + e.ph));
      if (e.teal) e.s.material.color.setRGB(.3 * o, 1 * o, .9 * o); else e.s.material.color.setRGB(1 * o, .55 * o, .12 * o);
    }
    const fl = .85 + .1 * Math.sin(time * 11) + .08 * Math.sin(time * 23.7);
    coals.material.color.setScalar(.75 + fl * .35 + fireKick * .4); fireGlow.scale.setScalar(8 * pw * fl);
    fireLight.intensity = (11 + S.lh * 1.5) * fl + fireKick * 25;
    fireKick = Math.max(0, fireKick - dt * 2.5);
  }

  // ---------- декорации: корабли, киты, руины, скалы ----------
  function buildDecor() {
    const parts = [], Pp = M.P, r = rng(77);
    const at = (a, d) => [Math.cos(a) * d, Math.sin(a) * d];
    function ship(a, d, len, rot, model, sink, roll) {       // корабли — готовые модели, полузасыпанные песком
      const [x, z] = at(a, d), y = groundH(x, z), g = M.asset(model, len), m = new T.Mesh(g, decorMat);
      m.position.set(x, y - (sink || 0) * g.userData.dims[1], z); m.rotation.set(0, rot, roll == null ? .22 + r() * .25 : roll); m.castShadow = m.receiveShadow = true; scene.add(m);
      const n = Math.max(1, Math.round(len / 7)), w = Math.max(1.4, g.userData.dims[0] * .5);
      for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : (k / (n - 1) - .5) * .8; colliders.push({ x: x + Math.sin(rot) * len * t, z: z + Math.cos(rot) * len * t, r: w }); }
    }
    ship(.5, 56, 30, .7, 'Ship_Sail', .06); ship(2.4, 64, 22, 2.2, 'Ship_Viking', .08); ship(4.3, 60, 34, 5.1, 'Ship_Sail', .1); ship(5.6, 70, 20, 1.3, 'Ship_Viking', .05);
    ship(3.4, 50, 14, .2, 'Ship_BoatSail', .04); ship(1.5, 30, 6, 2.6, 'Ship_Lifeboat', .15, .5); ship(4.9, 27, 5, .9, 'Ship_Boat', .1, .4); ship(.1, 36, 6, 4.2, 'Ship_Lifeboat', .2, -.45);
    ship(2.05, 108, 95, .55, 'Ship_Cruise', .12, .16);       // огромный лайнер у бездны
    ship(.15, 98, 26, 3.3, 'Ship_Sail', .1); ship(5.0, 128, 24, 1.9, 'Ship_Viking', .1); ship(3.0, 86, 12, 5.5, 'Ship_BoatSail', .05);
    function whale(a, d, rot) {
      const [x, z] = at(a, d);
      for (let i = 0; i < 11; i++) {
        const k = i / 10, px = x + Math.sin(rot) * (i * 2.6 - 13), pz = z + Math.cos(rot) * (i * 2.6 - 13), py = groundH(px, pz);
        const R = 4.6 * (1 - Math.pow(Math.abs(k - .35) * 1.3, 2));
        if (R > .8) parts.push(Pp(M.tor(R, .22, 6, 14, Math.PI), 0xece4cf, [px, py - .2, pz], [0, rot, 0]));
        parts.push(Pp(M.sph(.6, 8, 6), 0xddd3ba, [px, py + Math.max(R, .5), pz]));
      }
      const hx = x + Math.sin(rot) * -17, hz = z + Math.cos(rot) * -17;
      parts.push(Pp(M.sph(1, 12, 8), 0xece4cf, [hx, groundH(hx, hz) + 1.6, hz], [0, rot, 0], [2.6, 1.8, 4.2]));
      colliders.push({ x: hx, z: hz, r: 3 });
    }
    whale(1.2, 96, .4); whale(3.9, 100, 2.6); whale(5.4, 92, 4.4);
    for (let i = 0; i < 26; i++) {                                  // руины у бездны
      const a = r() * 6.283, d = 120 + r() * 34, [x, z] = at(a, d), y = groundH(x, z), h = 5 + r() * 9, fallen = r() < .25;
      parts.push(Pp(M.cyl(.9, 1.05, h, 12), 0x7f9ea4, fallen ? [x, y + .8, z] : [x, y + h / 2 - .3, z], fallen ? [1.5, a, 0] : [r() * .12, 0, r() * .12]));
      if (!fallen) { parts.push(Pp(M.box(2.6, .7, 2.6), 0x94b0b4, [x, y + h - .2, z])); colliders.push({ x, z, r: 1.4 }); }
    }
    for (let i = 0; i < 4; i++) {                                    // арки
      const a = i * 1.57 + .6, [x, z] = at(a, 138), y = groundH(x, z);
      parts.push(Pp(M.tor(7, 1.1, 8, 16, Math.PI), 0x6f9096, [x, y, z], [0, -a, 0]));
    }
    if (M.has('Rock_1')) for (let i = 0; i < 34; i++) {              // дальние скалы за мглой
      const a = i / 34 * 6.283 + r() * .12, d = 180 + r() * 110, [x, z] = at(a, d), h = 22 + r() * 45, g = M.asset(['Rock_1', 'Rock_2', 'Rock_3'][i % 3], h * (i % 3 ? 1.5 : 1));
      const m = new T.Mesh(g, decorMat); m.position.set(x, groundH(x, z) - 3, z); m.rotation.y = r() * 6; scene.add(m);
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
    geo.rock = M.rock();
    if (M.has('Rock_1')) { ['Rock_1', 'Rock_2', 'Rock_3'].forEach((n, i) => scatter(M.asset(n, 1.6), 90, 16, 260, .5, 3.4, 50 + i));
      scatter(M.asset('Tree_Dead1', 5), S.opt.q ? 45 : 20, 30, 150, .7, 1.5, 61); scatter(M.asset('Tree_Dead2', 5), S.opt.q ? 45 : 20, 30, 150, .7, 1.6, 62);
      scatter(M.asset('Deco_Log', 2.4), 80, 16, 150, .6, 1.6, 63); }
    else scatter(geo.rock, 260, 16, 260, .4, 3.2, 5);
    scatter(M.kelp(), S.opt.q ? 500 : 250, 15, 80, .7, 1.5, 6);
    scatter(M.coral(), S.opt.q ? 600 : 300, 74, 158, .8, 2.4, 7);
  }

  // ---------- находки ----------
  const cellKey = (x, z) => (Math.floor(x / CELL) + 160) * 512 + Math.floor(z / CELL) + 160;
  function cellAt(x, z, make) { const k = cellKey(x, z); let c = cells.get(k); if (!c && make) { c = { h: 0, items: [] }; cells.set(k, c); } return c; }
  function rollRar(r) { const v = r(); return v < .004 ? 2 : v < .03 ? 1 : 0; }
  function buildItems() {
    const r = rng(2026 + S.runs * 13), counts = {}, list = [];
    const dens = +(new URLSearchParams(location.search).get('dens')) || (S.opt.q ? 1 : .45);
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
      const I = D.ITEMS[t]; geo[t] = I.m && M.has(I.m) && (S.opt.q || !M.items[t]) ? M.asset(I.m, I.size * 1.9) : M.items[t]();
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
    const r = rng(404), cg = M.has('Chest') ? M.asset('Chest', 1.1) : M.chest(), lg = M.letter();
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
    let keyG; const pg = M.part();                                   // спрятанные детали: 3 обломка ключа и по 3 детали горна на зону
    for (id = 0; id < 12; id++) { const [x, z] = place(Math.floor(id / 3)); if (!S.parts.includes(id)) addSpecial('part', id, x, z, id < 3 && M.has('Key') ? (keyG = keyG || M.asset('Key', .8)) : pg); }
    if (S.door) openDoor();
    { const d = addSpecial('door', 0, 0, 4.3, M.box(.01, .01, .01)); d.mesh.visible = false; d.y = 1.5; d.glow.position.set(0, 1.9, 3.9); d.glow.scale.setScalar(2.2); }
  }
  function openDoor() {
    const m = new T.Mesh(M.box(1.1, 2.2, .34), new T.MeshBasicMaterial({ color: 0x1a0c04 })); m.position.set(0, 1.75, 3.46); scene.add(m);
    const g = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffb050, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); g.scale.setScalar(3); g.position.set(0, 1.8, 3.7); scene.add(g);
  }
  const partsIn = z => S.parts.filter(i => Math.floor(i / 3) === z).length;
  // дальние горны: по одному в зонах 2–4
  let postGeo;
  function buildPosts() {
    postGeo = M.merge([M.P(M.cyl(1.0, 1.35, .4, 14), 0x8f8676, [0, .2, 0]),
      M.P(M.lathe([[0, .36], [.8, .36], [1.3, .62], [1.5, .85], [1.6, .85], [1.42, .56], [.85, .3], [0, .3]], 18), 0xc98f3a, 0, 0, 1, M.METAL),
      M.P(M.tor(1.55, .07, 6, 18), 0xe8b85a, [0, .85, 0], [Math.PI / 2, 0, 0], 1, M.METAL),
      ...[0, 1, 2, 3, 4].map(i => M.P(M.cyl(.09, .1, .8, 6), 0x2a1a10, [Math.cos(i * 1.3) * .4, .5, Math.sin(i * 1.3) * .4], [Math.PI / 2, i * 1.3 + 1, 0], 1, M.WOOD))]);
    [[1, 60, 1.5], [2, 97, 2.75], [3, 136, 4.6]].forEach(([zi, r, a0]) => {
      let a = a0, x, z;
      for (let k = 0; k < 40; k++, a += .12) { x = Math.cos(a) * r; z = Math.sin(a) * r; if (!colliders.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 4) ** 2)) break; }
      const y = groundH(x, z), m = new T.Mesh(postGeo, decorMat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m);
      nearItems(x, z, 3.2, it => { if ((it.x - x) ** 2 + (it.z - z) ** 2 < 7) { it.home = false; removeItem(it); } });
      colliders.push({ x, z, r: 1.75, forge: true });
      const post = { id: zi, x, y, z };
      if (S.posts.includes(zi)) lightPost(post);
      else { const sp = addSpecial('post', zi, x, z, M.box(.01, .01, .01)); sp.mesh.visible = false; sp.y = y + .9; sp.glow.position.set(x, y + 1.6, z); sp.glow.scale.setScalar(4); sp.post = post; }
    });
  }
  function lightPost(p) {
    forges.push({ x: p.x, z: p.z, y: p.y, r: 1.7, h: 1.7, ty: 1.0 });
    addFlames(p.x, p.y + .45, p.z, 0, .85, .62);
    const c = new T.Mesh(new T.CircleGeometry(.95, 14), coals.material); c.rotation.x = -Math.PI / 2; c.position.set(p.x, p.y + .42, p.z); scene.add(c);
    if (S.opt.q) { const l = new T.PointLight(0xffa050, 14, 18, 1.6); l.position.set(p.x, p.y + 1.8, p.z); scene.add(l); }
  }
  function dropSpecial(s) { scene.remove(s.mesh); scene.remove(s.glow); specials.splice(specials.indexOf(s), 1); }
  function useSpecial(s) {                                  // дверь маяка и дальние горны
    if (s.kind === 'door') {
      const n = partsIn(0);
      if (n < 3 && !S.door) { UI.toast('Дверь заперта. Обломки ключа спрятаны на Отмели: найдено ' + n + ' из 3'); A.play('no'); return; }
      if (S.door) { goTop(); return; }
      S.door = true; calc(); openDoor(); A.play('level'); burst(0, 2, 4.2, 60, 0xffd080); save();
      UI.popup('🗝️', 'Дверь маяка открыта', 'Внутри — комната прежнего хранителя. На столе карта дна с отметками и запасная линза, завёрнутая в парусину. Ты ставишь её в фонарь.', 'Линза хранителя: весь свет ×2 · Карта: стрелка ведёт к ближайшей находке · Нажми на дверь ещё раз — поднимешься наверх, к фонарю');
    } else {
      const n = partsIn(s.id);
      if (n < 3) { UI.toast('Потухший горн. Не хватает деталей: найдено ' + n + ' из 3 — ищи в этой зоне'); A.play('no'); return; }
      S.posts.push(s.id); dropSpecial(s); lightPost(s.post); A.play('level'); burst(s.x, s.y + 1, s.z, 70, 0xffc060); save();
      UI.banner('Горн зажжён!', 'Теперь находки можно сжигать прямо здесь — и мешок, и крабы');
    }
  }
  function addSpecial(kind, id, x, z, g, extra) {
    const mesh = new T.Mesh(g, kind === 'star' ? new T.MeshBasicMaterial({ vertexColors: true }) : decorMat);
    const c = cellAt(x, z), y = groundH(x, z) + (c ? c.h : 0) + (kind === 'chest' ? (g.userData.dims ? g.userData.dims[1] * .45 : 0) : .45);
    mesh.position.set(x, y, z); mesh.rotation.y = x * 7; if (kind === 'bottle') mesh.rotation.z = .5; mesh.castShadow = true; scene.add(mesh);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: kind === 'chest' ? 0xffd070 : kind === 'bottle' ? 0x9ff0e0 : kind === 'part' ? 0xff9a50 : kind === 'door' || kind === 'post' ? 0xffc070 : 0xfff0a0, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
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
    else if (s.kind === 'part') {
      S.parts.push(s.id); A.play('art'); const z = Math.floor(s.id / 3), n = partsIn(z), nm = D.PARTS[s.id];
      UI.popup(nm[1], nm[0], z ? 'Деталь дальнего горна в зоне «' + D.ZONES[z].name + '».' : 'Обломок ключа от двери маяка.',
        n < 3 ? 'Найдено ' + n + ' из 3' : z ? 'Все детали собраны! Иди к потухшему горну и зажги его' : 'Ключ собран! Открой дверь маяка');
    }
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
    vacMesh = new T.Mesh(M.merge([M.P(M.cone(.16, .5, 14), 0xf3c3a2, [0, 0, 0], [Math.PI / 2, 0, 0]), M.P(M.cyl(.06, .09, .3, 10), 0xc98f3a, [0, 0, .35], [Math.PI / 2, 0, 0]),
      M.P(M.tor(.16, .03, 6, 14), 0xe8b85a, [0, 0, -.25])]), decorMat);
    vacMesh.position.set(.42, -.34, -.75); vacMesh.scale.setScalar(.6); vacMesh.visible = false; camera.add(vacMesh);
  }

  // ---------- еда и лекарства ----------
  let hungryT = -99, shake = 0, boardT = 0;
  function collect(t) {
    const I = D.ITEMS[t];
    if (I.med) { S.meds += I.med; UI.toast('💊 ' + I.name + ' — в аптечку (всего ' + S.meds + ')'); A.play('pick'); return; }
    if (S.hunger <= 100 - I.food * .6) { S.hunger = Math.min(100, S.hunger + I.food); UI.toast('🍖 Съел: ' + I.name + ' (+' + I.food + ' сытости)'); }
    else { S.food++; UI.toast('🍖 ' + I.name + ' — в припасы (' + S.food + ')'); }
    A.play('pop');
  }

  // ---------- верх маяка: галерея с приборами ----------
  const gadgets = [], boards = [];
  function goTop() { S.st.climbed = 1; P.top = true; P.x = 0; P.z = 3.2; P.yaw = Math.PI; P.pitch = -.05; boardT = 0; A.play('art'); UI.banner('Фонарная галерея', 'Осмотрись. На стене — журнал, пульт фонаря, телефон и радио'); }
  function goDown() { P.top = false; P.x = 0; P.z = 6.2; P.yaw = Math.PI; P.y = HP.y; A.play('thud'); }
  function buildTop() {
    const Y = 23.15, R = 1.74, at = (th, y, r) => [Math.sin(th) * (r || R), y, Math.cos(th) * (r || R)];
    const put = (g, th, y, r, mat) => { const m = new T.Mesh(g, mat || decorMat), p = at(th, y, r); m.position.set(...p); m.rotation.y = th; scene.add(m); return m; };
    const brass = 0xc98f3a, P_ = M.P;
    const board = (th, title) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 360; const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
      put(M.merge([P_(M.box(1.86, 1.36, .06), brass)], false), th, Y + 1.6, R + .02);
      put(new T.PlaneGeometry(1.72, 1.22), th, Y + 1.6, R + .06, new T.MeshBasicMaterial({ map: tex, fog: false }));
      boards.push({ c, tex, title });
    };
    board(0, 'ЖУРНАЛ МАЯКА'); board(Math.PI / 2, 'ЧТО СДЕЛАТЬ');
    // пульт фонаря
    const th = Math.PI, cp = at(th, Y + .55, R + .32);
    put(M.merge([P_(M.box(1.7, 1.1, .6), 0x5a3d28, 0, 0, 1, M.WOOD), P_(M.box(1.76, .06, .66), brass, [0, .56, 0]), P_(M.box(1.5, .5, .04), 0x24343f, [0, .1, .31])], false), th, Y + .55, R + .32);
    const knob = (dx, color, name, use) => {
      const m = new T.Mesh(M.sph(.085, 10, 8), new T.MeshBasicMaterial({ color })); m.position.set(cp[0] + Math.cos(th) * dx, Y + 1.2, cp[2] - Math.sin(th) * dx); scene.add(m);
      const g = { x: m.position.x, y: m.position.y, z: m.position.z, r: .3, m, use: () => { use(); save(); }, get name() { return name(); } }; gadgets.push(g); return g;
    };
    knob(-.55, 0x58e06a, () => 'Фонарь: ' + (S.beam.on ? 'горит' : 'выключен') + ' — нажми', () => { S.beam.on = S.beam.on ? 0 : 1; UI.toast(S.beam.on ? 'Фонарь зажжён' : 'Фонарь погашен'); });
    knob(0, 0xffc040, () => 'Скорость луча: ×' + S.beam.sp + ' — нажми', () => { S.beam.sp = { .5: 1, 1: 2, 2: 4, 4: .5 }[S.beam.sp] || 1; UI.toast('Скорость луча ×' + S.beam.sp); });
    knob(.55, 0xff5a4a, () => (S.beam.hold ? 'Луч остановлен и идёт за взглядом' : 'Остановить луч') + ' — нажми', () => { S.beam.hold = S.beam.hold ? 0 : 1; UI.toast(S.beam.hold ? 'Луч остановлен: он светит туда, куда ты смотришь' : 'Луч снова вращается'); });
    // телефон и радио
    const th2 = -Math.PI / 2;
    put(M.merge([P_(M.box(1.2, .06, .4), 0x5a3d28, 0, 0, 1, M.WOOD), P_(M.box(.06, .3, .3), brass, [-.5, -.16, 0]), P_(M.box(.06, .3, .3), brass, [.5, -.16, 0])], false), th2, Y + 1.15, R + .2);
    const dev = (asset, size, dx, name, use, rot) => {
      const p = at(th2, Y + 1.18 + size * .5, R + .2), x = p[0] + Math.cos(th2) * dx, z = p[2] - Math.sin(th2) * dx;
      if (M.has(asset)) { const m = new T.Mesh(M.asset(asset, size), decorMat); m.position.set(x, p[1], z); m.rotation.y = th2 + (rot || 0); scene.add(m); }
      gadgets.push({ x, y: p[1], z, r: .32, name, use });
    };
    dev('Phone', .42, -.3, 'Телефон — позвонить', () => {
      S.calls++; A.play('ring'); UI.toast('Гудки…');
      setTimeout(() => UI.toast(S.calls % 5 ? 'Никто не берёт трубку.' : 'Никто не берёт трубку… но в ней слышен шум моря.'), 4200);
    });
    dev('Radio', .46, .3, 'Радио — прогноз', () => {
      const m = Math.max(0, Math.ceil(tor.next / 60));
      UI.toast(tor.on ? 'Сквозь треск: «…смерч идёт ' + (tor.near ? 'прямо на маяк' : 'стороной') + '…»' : 'Сквозь помехи: «…смерч ожидается через ' + (m <= 1 ? 'минуту' : m + ' мин') + '…»');
    }, Math.PI);
    // люк вниз
    const hp = at(2.3, Y + .05, 3.3), hm = new T.Mesh(M.merge([P_(M.box(1.1, .08, 1.1), 0x5a3d28, 0, 0, 1, M.WOOD), P_(M.tor(.14, .03, 5, 10), brass, [0, .06, .3], [Math.PI / 2, 0, 0], 1, M.METAL)], false), decorMat);
    hm.position.set(...hp); hm.rotation.y = 2.3; scene.add(hm);
    gadgets.push({ x: hp[0], y: Y + .1, z: hp[2], r: .7, name: 'Люк — спуститься вниз', use: goDown });
  }
  function drawBoards() {
    const f = D.fmt, q = D.QUESTS, lines = [
      [['Свет сейчас', f(S.light) + ' ✦'], ['Всего добыто', f(S.total) + ' ✦'], ['Сожжено находок', S.st.burned], ['Маяк', S.lh + ' / 8'],
        ['Артефакты', S.arts.length + ' / ' + D.ARTS.length], ['Письма', S.letters.length + ' / ' + D.LETTERS.length], ['Крабы · лента', S.up.crab + ' · ' + beltSegs() * 10 + ' м'],
        ['На дне', Math.floor(S.st.time / 60) + ' мин']],
      [[q[S.quest] ? '▶ ' + q[S.quest][0] : 'Все задания выполнены', ''], [q[S.quest + 1] ? '· ' + q[S.quest + 1][0] : '', ''], [q[S.quest + 2] ? '· ' + q[S.quest + 2][0] : '', ''],
        ['Дальние горны', S.posts.length + ' / 3'], ['Сытость', Math.round(S.hunger) + '%  припасы ' + S.food], ['Аптечка', S.meds + ' шт.'],
        ['До маяка', S.lh < 8 ? f(Math.max(0, D.LH_COST[S.lh] - S.light)) + ' ✦' : 'горит в полную силу']]];
    boards.forEach((b, i) => {
      const x = b.c.getContext('2d'); x.fillStyle = '#0e1c2a'; x.fillRect(0, 0, 512, 360); x.strokeStyle = '#e8b85a'; x.lineWidth = 4; x.strokeRect(8, 8, 496, 344);
      x.fillStyle = '#ffd66e'; x.font = '800 30px Rubik, sans-serif'; x.textAlign = 'center'; x.fillText(b.title, 256, 50);
      x.font = '600 21px Rubik, sans-serif'; let y = 90;
      for (const [k, v] of lines[i]) { if (!k) continue; x.textAlign = 'left'; x.fillStyle = '#d8e6ee';
        const kk = String(k); x.fillText(kk.length > 40 ? kk.slice(0, 39) + '…' : kk, 28, y); x.textAlign = 'right'; x.fillStyle = '#7ff0e0'; x.fillText(String(v), 484, y); y += 33; }
      b.tex.needsUpdate = true;
    });
  }

  // ---------- торнадо ----------
  const tor = { on: false, next: 150, x: 0, z: 0, orb: [] }; let torG, torMat, torDust, stormK = 0;
  function buildTornado() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(255,255,255,${.15 + Math.random() * .5})`; x.lineWidth = 1 + Math.random() * 4; const y = Math.random() * 64, x0 = Math.random() * 256, l = 30 + Math.random() * 90;
      for (const o of [-256, 0, 256]) { x.beginPath(); x.moveTo(x0 + o, y); x.lineTo(x0 + o + l, y + Math.random() * 6 - 3); x.stroke(); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 1);
    torMat = new T.MeshBasicMaterial({ map: t, color: 0xcdb78f, transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false });
    torG = new T.Group(); torG.visible = false; scene.add(torG);
    for (let k = 0; k < 18; k++) {
      const r0 = 1.1 + Math.pow(k, 1.45) * .42, r1 = 1.1 + Math.pow(k + 1, 1.45) * .42;
      const m = new T.Mesh(new T.CylinderGeometry(r1, r0, 3.6, 20, 1, true), torMat); m.position.y = k * 3.5 + 1.8; m.renderOrder = 7; torG.add(m);
    }
    torDust = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xcdb78f, transparent: true, opacity: .55, depthWrite: false })); torDust.scale.set(22, 9, 1); torDust.position.y = 3; torG.add(torDust);
  }
  function orbiter(info, fake) {
    const m = new T.Mesh(geo[info.t], rarMats[info.rar]); scene.add(m);
    return { m, info, fake, ang: Math.random() * 6.283, h: fake ? Math.random() * 30 : .5, vh: 3 + Math.random() * 4, w: 2.5 + Math.random() * 2.5, hmax: 12 + Math.random() * 22 };
  }
  function startTornado(near) {
    if (tor.on) return;
    if (near == null) near = S.lh >= 1 && Math.random() < .5;
    let tx, tz, dir = Math.random() * 6.283, sp;
    if (near) {
      const a = Math.random() * 6.283, d = 9 + Math.random() * 14; tx = (P.top ? 0 : P.x) + Math.cos(a) * d; tz = (P.top ? 14 : P.z) + Math.sin(a) * d;
      const r = Math.hypot(tx, tz) || 1, k = clamp(r, 22, Math.max(23, C.lit - 3)) / r; tx *= k; tz *= k; sp = 8; tor.dur = 21;
    } else { const a = Math.random() * 6.283, r = Math.min(235, C.lit + 38 + Math.random() * 30); tx = Math.cos(a) * r; tz = Math.sin(a) * r; dir = a + Math.PI / 2; sp = 7; tor.dur = 27; }
    tor.vx = Math.cos(dir) * sp; tor.vz = Math.sin(dir) * sp; tor.x = tx - tor.vx * tor.dur / 2; tor.z = tz - tor.vz * tor.dur / 2;
    tor.on = true; tor.near = near; tor.t = 0; tor.grabT = 0; tor.warned = false; torG.visible = true;
    const light = Object.keys(D.ITEMS).filter(t => D.ITEMS[t].w <= 9 && t !== 'heart');
    for (let i = 0; i < 26; i++) tor.orb.push(orbiter({ t: light[Math.random() * light.length | 0], rar: 0, zone: 0 }, true));
    UI.banner('Торнадо!', near ? 'Идёт прямо сюда — находки поднимет и разбросает' : 'Проходит вдалеке. Можно просто смотреть');
    A.play('level');
  }
  function torRelease(o, cx, cz) {
    const p = o.m.position, dx = p.x - cx, dz = p.z - cz, L = Math.hypot(dx, dz) || 1, sp = 7 + Math.random() * 9, out = 4 + Math.random() * 7;
    scene.remove(o.m);
    if (!o.fake) launch(o.info, p.x, p.y, p.z, 'hand', new V3(-dz / L * sp + dx / L * out, 2 + Math.random() * 4, dx / L * sp + dz / L * out));
  }
  function updTornado(dt) {
    stormK = lerp(stormK, tor.on ? (tor.near ? .85 : .45) : 0, Math.min(1, dt * .6)); sky.material.uniforms.storm.value = stormK;
    shake = Math.max(0, shake - dt * 2);
    if (!tor.on) { if (S.st.burned >= 3) tor.next -= dt; if (tor.next <= 0) startTornado(); A.wind(0); return; }
    tor.t += dt; tor.x += tor.vx * dt; tor.z += tor.vz * dt;
    const k = Math.min(1, tor.t / 2.5, (tor.dur - tor.t) / 2.5), gy = groundH(tor.x, tor.z);
    torG.position.set(tor.x, gy, tor.z); torG.scale.set(k, 1, k); torMat.opacity = .62 * k; torMat.map.offset.x -= dt * 1.4; torDust.material.opacity = .5 * k;
    const sway = h => [Math.sin(time * 1.3 + h * .14) * h * .06, Math.cos(time * 1.1 + h * .12) * h * .06];
    torG.children.forEach((m, i) => { if (m === torDust) return; const sw = sway(m.position.y); m.position.x = sw[0]; m.position.z = sw[1]; m.rotation.y += dt * (3.2 - i * .08); });
    // поднимает находки
    if ((tor.grabT -= dt) <= 0 && tor.orb.length < 96) {
      tor.grabT = .05; let got = null;
      nearItems(tor.x, tor.z, 6, it => { if (!got && it.t !== 'heart' && (it.x - tor.x) ** 2 + (it.z - tor.z) ** 2 < 30) got = it; });
      if (got) { removeItem(got); const o = orbiter({ t: got.t, rar: got.rar, zone: got.zone }, false); o.m.position.set(got.x, got.y, got.z); tor.orb.push(o); }
    }
    for (let i = tor.orb.length - 1; i >= 0; i--) {
      const o = tor.orb[i]; o.ang += o.w * dt; o.h += o.vh * dt; if (o.fake && o.h > 34) o.h = 0;
      const sw = sway(o.h), rad = (1.4 + o.h * .4) * k;
      o.m.position.set(tor.x + sw[0] + Math.cos(o.ang) * rad, gy + o.h + .5, tor.z + sw[1] + Math.sin(o.ang) * rad); o.m.rotation.x += dt * 5; o.m.rotation.z += dt * 3.3;
      if ((!o.fake && o.h > o.hmax) || tor.t >= tor.dur) { torRelease(o, tor.x, tor.z); tor.orb.splice(i, 1); }
    }
    const pd = P.top ? 99 : Math.hypot(P.x - tor.x, P.z - tor.z);
    A.wind(clamp(1 - pd / 70, .15, 1) * k);
    if (pd < 12) { shake = Math.max(shake, (1 - pd / 12) * .12); const pull = (1 - pd / 12) * 3 * dt; P.x += (tor.x - P.x) / pd * pull; P.z += (tor.z - P.z) / pd * pull;
      if (!tor.warned) { tor.warned = true; UI.toast('Торнадо совсем рядом — держись!'); } }
    if (tor.t >= tor.dur) { tor.on = false; torG.visible = false; tor.next = 190 + Math.random() * 150; }
  }

  // ---------- лента: покупные секции по 10 м, везут находки в главный горн ----------
  const SEG = 10, beltItems = []; let beltMat, segGeo;
  const beltSegs = () => Math.max(0, S.belt.length - 1), beltCost = () => Math.round(300 * Math.pow(1.5, beltSegs()));
  const beltY = i => i === 0 ? HP.y + 1.0 : groundH(S.belt[i][0], S.belt[i][1]) + .6;
  function addSeg(i) {
    if (!beltMat) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#3a3d44'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#23252a'; for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 5);
      x.fillStyle = '#e8b85a'; x.fillRect(0, 0, 4, 64); x.fillRect(60, 0, 4, 64);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, SEG);
      beltMat = new T.MeshLambertMaterial({ map: t });
      segGeo = M.merge([M.P(M.box(.09, .22, SEG), 0xc98f3a, [.66, .04, 0], 0, 1, M.METAL), M.P(M.box(.09, .22, SEG), 0xc98f3a, [-.66, .04, 0], 0, 1, M.METAL),
        ...[-4, 0, 4].flatMap(z => [M.P(M.cyl(.07, .09, .9, 6), 0x5a4a3a, [.55, -.5, z], 0, 1, M.WOOD), M.P(M.cyl(.07, .09, .9, 6), 0x5a4a3a, [-.55, -.5, z], 0, 1, M.WOOD),
          M.P(M.cyl(.09, .09, 1.3, 8), 0x4c5864, [0, -.07, z], [0, 0, Math.PI / 2], 1, M.METAL)])], false);
    }
    const a = S.belt[i], b = S.belt[i + 1], ya = beltY(i), yb = beltY(i + 1), g = new T.Group();
    const top = new T.Mesh(new T.BoxGeometry(1.24, .1, SEG), beltMat), fr = new T.Mesh(segGeo, decorMat); top.receiveShadow = fr.castShadow = true; g.add(top, fr);
    g.position.set((a[0] + b[0]) / 2, (ya + yb) / 2, (a[1] + b[1]) / 2); g.lookAt(b[0], yb, b[1]); scene.add(g);
    for (let k = 0; k <= SEG; k += 1.5) {                    // расчищаем место под лентой
      const x = lerp(a[0], b[0], k / SEG), z = lerp(a[1], b[1], k / SEG);
      nearItems(x, z, 1.6, it => { if ((it.x - x) ** 2 + (it.z - z) ** 2 < 2 && it.t !== 'heart') { it.home = false; removeItem(it); } });
    }
  }
  function buildBelt() {
    if (S.lh < 1) return 'Сначала разожги маяк хотя бы раз';
    if (beltSegs() >= 16) return 'Лента уже максимальной длины';
    const c = beltCost(); if (S.light < c) return 'Не хватает света: нужно ' + D.fmt(c) + ' ✦';
    let from = S.belt[S.belt.length - 1], first = !from;
    if (first) { const dx = P.x - HP.x, dz = P.z - HP.z, d = Math.hypot(dx, dz); if (d < 8) return 'Отойди от горна в ту сторону, куда вести ленту'; from = [HP.x + dx / d * 2.7, HP.z + dz / d * 2.7]; }
    const dx = P.x - from[0], dz = P.z - from[1], d = Math.hypot(dx, dz);
    if (d < 5) return 'Отойди дальше от конца ленты — секция строится в твою сторону';
    const to = [from[0] + dx / d * SEG, from[1] + dz / d * SEG];
    if (Math.hypot(to[0], to[1]) > C.lit - 1) return 'Туда лента не дотянется — там мгла. Разожги маяк сильнее';
    if (Math.hypot(to[0], to[1]) < 8) return 'Слишком близко к маяку';
    S.light -= c; if (first) S.belt.push(from); S.belt.push(to); addSeg(S.belt.length - 2); A.play('level'); save();
    UI.banner('Секция ленты построена', 'Клади находки на ленту — они сами поедут в огонь'); return true;
  }
  function nearBelt(x, z) {                                   // ближайшая точка ленты: расстояние d и путь s от горна
    let best = null;
    for (let i = 0; i + 1 < S.belt.length; i++) {
      const a = S.belt[i], b = S.belt[i + 1], t = clamp(((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (SEG * SEG), 0, 1);
      const px = lerp(a[0], b[0], t), pz = lerp(a[1], b[1], t), d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { d, s: (i + t) * SEG, x: px, z: pz, y: lerp(beltY(i), beltY(i + 1), t) };
    }
    return best;
  }
  function beltPut(info, s, from) {
    const m = new T.Mesh(geo[info.t], rarMats[info.rar]); m.castShadow = true; m.rotation.y = Math.random() * 6; scene.add(m);
    beltItems.push({ m, info, s, from });
  }
  function updBelt(dt) {
    if (beltMat) beltMat.map.offset.y -= dt * C.beltSp;
    for (let k = beltItems.length - 1; k >= 0; k--) {
      const b = beltItems[k]; b.s -= C.beltSp * dt;
      const i = Math.min(S.belt.length - 2, Math.max(0, Math.floor(b.s / SEG))), t = clamp(b.s / SEG - i, 0, 1), A0 = S.belt[i], B0 = S.belt[i + 1];
      const x = lerp(A0[0], B0[0], t), z = lerp(A0[1], B0[1], t), y = lerp(beltY(i), beltY(i + 1), t) + .08 + D.ITEMS[b.info.t].size * .45;
      b.m.position.set(x, y, z);
      if (b.s <= 0) { scene.remove(b.m); beltItems.splice(k, 1); const d = launch(b.info, x, y, z, b.from); d.noBelt = true; }
    }
  }

  // ---------- крабы ----------
  let crabGeo;
  function syncCrabs() {
    crabGeo = crabGeo || M.crab();
    while (crabs.length < C.crabN) {
      const m = new T.Mesh(crabGeo, decorMat); m.scale.setScalar(.6); m.castShadow = true; scene.add(m);
      const cm = new T.Mesh(geo.bottle, itemMat); cm.position.y = 1.25; cm.visible = false; m.add(cm);
      const a = crabs.length * 2.4; crabs.push({ m, cm, x: HP.x + Math.cos(a) * 4, z: HP.z + Math.sin(a) * 4, st: 0, tg: null, carry: null, wait: Math.random() });
    }
  }
  function crabTarget() {
    let best = null, bd = 1e9; const types = Object.keys(inst).filter(t => t !== 'heart' && inst[t].length && D.ITEMS[t].w <= C.crabW && !D.ITEMS[t].food && !D.ITEMS[t].med);
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
      } else if (c.b) { tx = c.b.x; tz = c.b.z; } else { tx = c.f.x; tz = c.f.z; }
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), sp = C.crabSp * dt;
      if (d > (c.st === 1 ? .9 : c.b ? 1.1 : c.f.r + 1.3)) {
        c.x += dx / d * sp; c.z += dz / d * sp;
        for (const o of colliders) { const ox = c.x - o.x, oz = c.z - o.z, od = Math.hypot(ox, oz); if (od < o.r + .5 && !(c.st === 2 && o.forge)) { c.x = o.x + ox / od * (o.r + .5) + -oz / od * sp; c.z = o.z + oz / od * (o.r + .5) + ox / od * sp; } }
        c.m.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      } else if (c.st === 1) {
        const it = c.tg; it.claimed = false; removeItem(it); c.carry = { t: it.t, rar: it.rar, zone: it.zone };
        c.cm.geometry = geo[it.t]; c.cm.material = rarMats[it.rar]; c.cm.visible = true; c.st = 2; c.f = nearForge(c.x, c.z); c.b = null;
        if (S.belt.length > 1) { const nb = nearBelt(c.x, c.z); if (nb.d + 3 < Math.hypot(c.f.x - c.x, c.f.z - c.z)) c.b = nb; }
      } else {
        c.cm.visible = false; if (c.b) beltPut(c.carry, c.b.s, 'crab'); else launch(c.carry, c.x, c.m.position.y + 1, c.z, 'crab'); c.carry = null; c.st = 0; c.wait = .4;
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
    else { const f = nearForge(x, z), t = .55; d.vx = (f.x - x) / t; d.vz = (f.z - z) / t; d.vy = (f.y + f.ty - y + .5 * GRAV * t * t) / t; }
    dyn.push(d); return d;
  }
  function updDyn(dt) {
    for (let i = dyn.length - 1; i >= 0; i--) {
      const d = dyn[i], p = d.m.position; let done = false, nb;
      if (d.mode === 'suck') {
        const tx = camera.position.x, ty = camera.position.y - .5, tz = camera.position.z, dx = tx - p.x, dy = ty - p.y, dz = tz - p.z, L = Math.hypot(dx, dy, dz), sp = 22 * dt;
        if (L < sp + .5) { if (D.ITEMS[d.info.t].food || D.ITEMS[d.info.t].med) collect(d.info.t); else P.bag.push(d.info); P.incoming--; A.play('pop'); done = true; }
        else { p.x += dx / L * sp; p.y += dy / L * sp; p.z += dz / L * sp; d.m.scale.setScalar(Math.min(1, L / 3)); }
      } else {
        d.vy -= GRAV * dt; p.x += d.vx * dt; p.y += d.vy * dt; p.z += d.vz * dt;
        const f = nearForge(p.x, p.z), hd = Math.hypot(p.x - f.x, p.z - f.z);
        if (hd < f.r && p.y < f.y + f.h && p.y > f.y - .2) { burn(d, f); done = true; }
        else if (!d.noBelt && d.vy < 0 && S.belt.length > 1 && (nb = nearBelt(p.x, p.z)).d < 1.15 && p.y < nb.y + .5 && beltItems.length < 200) {
          beltPut(d.info, nb.s, d.from === 'crab' ? 'crab' : 'hand'); A.play('pop'); done = true;
        }
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
  function burn(d, F) {
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
    burst(p.x, F.y + 1.2, p.z, d.from === 'crab' ? 5 : 12 + info.rar * 14, info.rar == 2 ? 0xc080ff : info.rar ? 0xffd040 : 0xffb060);
    gain(v, { x: F.x, y: F.y + 2.4, z: F.z }, tag, d.from === 'crab');
    if (F.main) fireKick = 1;
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
    if (P.top) {
      for (const g of gadgets) { tv.set(g.x - o.x, g.y - o.y, g.z - o.z); const t = tv.dot(d); if (t > 0 && t < 3.6 && tv.lengthSq() - t * t < g.r * g.r && t < bt) { bt = t; best = g; } }
      return best ? { gd: best } : null;
    }
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
    camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction;
    const hit = pickAt(o, d, C.reach);
    if (P.top) { if (hit) { hit.gd.use(); A.play('pick'); } return; }
    if (hit && hit.sp) { if (hit.sp.kind === 'door' || hit.sp.kind === 'post') useSpecial(hit.sp); else takeSpecial(hit.sp); return; }
    if (P.held) {                                 // с находкой в руках: целишься в горн — бросок
      const F = nearForge(o.x, o.z), hx = F.x - o.x, hz = F.z - o.z, hl = Math.hypot(hx, hz);
      if (hl < 30 && (d.x * hx + d.z * hz) / (hl * Math.hypot(d.x, d.z) || 1) > .93) { throwHeld(d); return; }
    }
    if (hit) {
      const it = hit.it, I = D.ITEMS[it.t];
      if (I.food || I.med) { removeItem(it); collect(it.t); S.st.picked++; return; }
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
    const o = camera.position, F = nearForge(o.x, o.z), dx = F.x - o.x, dz = F.z - o.z, dist = Math.hypot(dx, dz);
    let vel = null;
    const aim = (d.x * dx + d.z * dz) / (dist * Math.hypot(d.x, d.z) || 1);
    if (aim > .93 && dist < C.throwV * C.throwV / GRAV * .95 && dist > 1) {     // помощь в прицеливании
      const t = Math.max(.35, dist / (C.throwV * .8)), y0 = o.y - .3;
      vel = new V3(dx / t, (F.y + F.ty - y0 + .5 * GRAV * t * t) / t, dz / t);
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
    if (!S.up.home || ending) return; if (P.top) { goDown(); return; }
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
    const keep = { door: false, arts: S.arts, letters: S.letters, chests: S.chests, bottles: S.bottles, opt: S.opt, pearls: S.pearls + 1 + Math.floor(S.arts.length / 5), runs: S.runs + 1 };
    S = Object.assign(fresh(), keep); for (const id in D.UP) S.up[id] = 0; save(); location.reload();
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); }

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
    const ang = t / 4 * 6.283, sx = Math.cos(ang * .5 + .6), sy = .35 + .3 * Math.cos(ang), sz = Math.sin(ang * .5 + .6);
    sun.position.set(P.x + sx * 90, 60 + sy * 60, P.z + sz * 90); sun.target.position.set(P.x, 0, P.z);
    u.sunDir.value.set(sx * 90, 60 + sy * 60, sz * 90).normalize(); u.sunCol.value.copy(sun.color); u.t.value = time;
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
    updFire(dt);
    if (S.beam.hold) { if (P.top) beam.rotation.y = P.yaw + Math.PI / 2; } else beam.rotation.y += dt * .35 * S.beam.sp;
    beam.visible = !!S.beam.on; lampMesh.material.color.setHex(S.beam.on ? 0xfff3c0 : 0x39424a);
    wallR = ending ? wallR : lerp(wallR, C.lit + 1.5, Math.min(1, dt * 1.2)); wall.scale.set(wallR, 1, wallR);
    updFx(dt); updDyn(dt); updSky();
    for (const s of specials) { s.mesh.rotation.y += dt * (s.kind === 'star' || s.kind === 'part' ? 2 : .4); if (s.kind === 'part') s.mesh.position.y = s.y + .25 + Math.sin(time * 2 + s.x) * .12; s.glow.material.opacity = .55 + .3 * Math.sin(time * 3 + s.x); if (s.kind === 'star') s.mesh.position.y = s.y + .6 + Math.sin(time * 2) * .2; }
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
      const s = Math.sin(P.yaw), c = Math.cos(P.yaw), sp = C.speed * dt * (P.held && P.held.t === 'heart' ? .8 : 1) * (S.hunger <= 0 ? .6 : 1) * (P.top ? .55 : 1);
      P.x += (mx * c + mz * s) * sp; P.z += (-mx * s + mz * c) * sp; P.bob += dt * 11 * Math.min(1, ml);
      if (!P.top) for (const o of colliders) { const ox = P.x - o.x, oz = P.z - o.z, od = Math.hypot(ox, oz), R = o.r + .45; if (od < R) { P.x = o.x + ox / od * R; P.z = o.z + oz / od * R; } }
      const r = Math.hypot(P.x, P.z) || 1, lim = Math.min(C.lit - .8, D.WORLD_R - 1);
      if (P.top) { const k = clamp(r, 2.3, 4.05) / r; P.x *= k; P.z *= k; }
      else if (r > lim) { P.x *= lim / r; P.z *= lim / r; if (time - lastToastWall > 4) { UI.toast(S.lh >= 7 ? 'Дальше — бездна' : 'Дальше мгла. Разожги маяк, чтобы пройти'); lastToastWall = time; } }
    }
    const cl = cellAt(P.x, P.z), ty = P.top ? 23.15 : groundH(P.x, P.z) + Math.min(1.3, cl ? cl.h * .55 : 0);
    P.y = P.top ? ty : lerp(P.y, ty, Math.min(1, dt * 9));
    if (P.top && (boardT -= dt) <= 0) { boardT = 1; drawBoards(); }
    camera.position.set(P.x + shake * (Math.random() - .5), P.y + EYE + Math.sin(P.bob) * .045 + shake * (Math.random() - .5), P.z); camera.rotation.set(P.pitch, P.yaw, 0);
    const pr = Math.hypot(P.x, P.z), z = pr < 16 || P.top ? -1 : zoneAt(pr);
    if (z !== zoneShown) { zoneShown = z; if (z >= 0) { UI.zone(D.ZONES[z].name, '×' + D.ZONES[z].mult + ' света'); S.st.maxZone = Math.max(S.st.maxZone, z); if (z >= 1 && !S.posts.includes(z)) UI.toast('Здесь есть потухший горн. Найди 3 детали (' + partsIn(z) + '/3) и зажги его — не придётся бегать к маяку'); } }
    // мешок высыпается у горна
    const nf = nearForge(P.x, P.z), hd = Math.hypot(P.x - nf.x, P.z - nf.z); dumpT -= dt;
    if (P.top) { /* наверху мешок не высыпается */ }
    else if (hd < (nf.main ? 8.5 : 6.5) && P.bag.length && dumpT <= 0) { launch(P.bag.pop(), P.x, P.y + 1.2, P.z, 'bag'); dumpT = .11; A.play('throw'); }
    else if (P.bag.length && dumpT <= 0 && S.belt.length > 1) {              // мешок высыпается на ленту
      const nb = nearBelt(P.x, P.z);
      if (nb.d < 4.5) { const t = .4, y0 = P.y + 1.2; launch(P.bag.pop(), P.x, y0, P.z, 'bag', new V3((nb.x - P.x) / t, (nb.y + .3 - y0 + .5 * GRAV * t * t) / t, (nb.z - P.z) / t)); dumpT = .13; A.play('throw'); }
    }
    if (!P.top) updVac(dt); updCrabs(dt); updBelt(dt); updEvents(dt); updTornado(dt);
    // сытость
    S.hunger = Math.max(0, S.hunger - dt * .2);
    if (S.hunger < 35 && S.food > 0) { S.food--; S.hunger += 40; UI.toast('🍖 Перекусил из припасов. Осталось: ' + S.food); }
    if (S.hunger <= 0 && time - hungryT > 25) { hungryT = time; UI.toast('Ты голоден и идёшь медленно. Ищи еду: консервы, фляги, вяленое мясо'); }
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
    if (!S.up.sense && !S.door) return null; let best = null, bd = 1e9;
    for (const s of specials) {
      if (s.kind === 'door' && (S.door || partsIn(0) < 3)) continue; if (s.kind === 'post' && partsIn(s.id) < 3) continue;
      if (Math.hypot(s.x, s.z) > C.lit - 1) continue; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; best = s; }
    }
    return best && { d: bd, ang: Math.atan2(-(best.x - P.x), -(best.z - P.z)) - P.yaw, kind: best.kind };
  }
  function lookInfo() {            // подпись под прицелом
    ndc.set(0, 0); camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera); const h = pickAt(ray.ray.origin, ray.ray.direction, C.reach);
    if (!h) return null; if (h.gd) return { name: h.gd.name, sp: 1 };
    if (h.sp) return { name: { chest: 'Сундук', bottle: 'Бутылка с письмом', star: 'Упавшая звезда', part: 'Спрятанная деталь', door: 'Дверь маяка', post: 'Потухший горн' }[h.sp.kind], sp: 1 };
    const I = D.ITEMS[h.it.t]; return { name: I.name, w: I.w, rar: h.it.rar, v: valueOf(h.it) * C.lightMul, heavy: I.w > C.str };
  }
  window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  return {
    init, get S() { return S; }, C, P, input, buy, kindle, canSee, action, goHome, save, rebirth, wipe, calc, senseTarget, lookInfo, touch, partsIn, goTop, goDown, startTornado, get tor() { return tor; }, get forges() { return forges; }, buildBelt, beltCost, beltSegs, get beltItems() { return beltItems; },
    start() { running = true; A.unlock(); A.set(S.opt.snd); }, get running() { return running; }, get rate() { return rate; }, get combo() { return combo; },
    get ending() { return ending; }, project(p) { tv.set(p.x, p.y, p.z).project(camera); return tv.z > 1 ? null : { x: (tv.x + 1) / 2 * window.innerWidth, y: (1 - tv.y) / 2 * window.innerHeight }; },
    HP, _dbg: { inst, specials, crabs, dyn, takeSpecial, sim(n, dt) { for (let i = 0; i < n; i++) { time += dt; step(dt); updDyn(dt); updFire(dt); } }, get camera() { return camera; }, get ev() { return ev; } }
  };
})();

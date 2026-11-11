// Модели, собранные кодом: сглаженные формы, вершинные цвета и общий атлас текстур
'use strict';
const M = (() => {
  const T = THREE, tmpC = new T.Color(), e = new T.Euler(), q = new T.Quaternion(), mt = new T.Matrix4();
  const WOOD = 0, METAL = 1, CLAY = 2, ROPE = 3;         // плитки атласа

  // P(геометрия, цвет, позиция, поворот, масштаб, текстура) → часть модели
  function P(g, hex, p, r, s, tex) {
    if (g.index) g = g.toNonIndexed();
    p = p || [0, 0, 0]; r = r || [0, 0, 0]; s = s || [1, 1, 1];
    if (typeof s === 'number') s = [s, s, s];
    mt.compose(new T.Vector3(...p), q.setFromEuler(e.set(...r)), new T.Vector3(...s));
    g.applyMatrix4(mt);
    g.userData.hex = hex; g.userData.tex = tex == null ? CLAY : tex;
    return g;
  }
  // flat: true — гранёные нормали (камни, звёзды); иначе сглаженные нормали примитивов
  function merge(parts, ao, flat) {
    let n = 0; parts.forEach(g => n += g.attributes.position.count);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0, minY = 1e9, maxY = -1e9;
    parts.forEach(g => {
      const a = g.attributes.position.array, cnt = a.length / 3, t = g.userData.tex, tx = t % 2, ty = t >> 1;
      pos.set(a, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      tmpC.set(g.userData.hex);
      const gu = g.attributes.uv;
      for (let i = 0; i < cnt; i++) {
        const j = (o + i) * 3;
        col[j] = tmpC.r; col[j + 1] = tmpC.g; col[j + 2] = tmpC.b;
        minY = Math.min(minY, a[i * 3 + 1]); maxY = Math.max(maxY, a[i * 3 + 1]);
        const u = gu ? Math.min(1, Math.max(0, gu.getX(i))) : .5, v = gu ? Math.min(1, Math.max(0, gu.getY(i))) : .5;
        uv[(o + i) * 2] = (tx + .04 + u * .92) / 2; uv[(o + i) * 2 + 1] = (ty + .04 + v * .92) / 2;
      }
      o += cnt;
    });
    if (ao !== false) for (let i = 0; i < n; i++) {           // мягкое затемнение к низу
      const f = .7 + .3 * (pos[i * 3 + 1] - minY) / (maxY - minY || 1);
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (flat) g.computeVertexNormals(); else g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    return g;
  }
  const lathe = (pts, seg) => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg || 12);
  const box = (x, y, z) => new T.BoxGeometry(x, y, z);
  const cyl = (a, b, h, s, open, arc) => new T.CylinderGeometry(a, b, h, s || 12, 1, !!open, 0, arc || Math.PI * 2);
  const cone = (r, h, s) => new T.ConeGeometry(r, h, s || 10);
  const ico = (r, d) => new T.IcosahedronGeometry(r, d || 0);
  const sph = (r, w, h) => new T.SphereGeometry(r, w || 12, h || 8);
  const tor = (r, t, a, b, arc) => new T.TorusGeometry(r, t, a || 6, b || 14, arc || Math.PI * 2);
  const H = Math.PI / 2;

  const items = {
    bottle: () => merge([
      P(lathe([[0, -.3], [.11, -.3], [.13, -.26], [.13, .02], [.1, .1], [.05, .17], [.045, .3], [.06, .31], [.06, .34], [0, .34]], 10), 0x3f9f72),
      P(cyl(.04, .045, .07, 8), 0xc9a36a, [0, .37, 0], 0, 1, WOOD)]),
    conch: () => merge([
      P(lathe([[0, -.34], [.07, -.26], [.2, -.1], [.25, .03], [.18, .11], [.2, .16], [.11, .23], [.12, .27], [.04, .35], [0, .38]], 12), 0xf3c7aa, [0, 0, 0], [H, 0, .3]),
      P(sph(.13, 8, 6), 0xe58f84, [.1, 0, -.12], 0, [1.2, .6, 1.3])]),
    lantern: () => merge([
      P(cyl(.19, .21, .07, 10), 0x8f6424, [0, -.2, 0], 0, 1, METAL), P(cyl(.13, .13, .32, 10), 0xffdc8a, [0, 0, 0]),
      ...[0, 1, 2, 3].map(i => P(box(.025, .34, .025), 0x8f6424, [Math.cos(i * H + .78) * .16, 0, Math.sin(i * H + .78) * .16], 0, 1, METAL)),
      P(cone(.22, .15, 10), 0x9a6a22, [0, .24, 0], 0, 1, METAL), P(cyl(.05, .05, .06, 8), 0x8f6424, [0, .33, 0], 0, 1, METAL),
      P(tor(.085, .016, 5, 10), 0x8f6424, [0, .42, 0], 0, 1, METAL)]),
    amphora: () => merge([
      P(lathe([[0, -.52], [.05, -.5], [.2, -.3], [.3, -.05], [.3, .1], [.2, .27], [.09, .36], [.09, .44], [.14, .5], [.12, .52], [0, .52]], 12), 0xc66a3c),
      P(tor(.12, .026, 5, 8, Math.PI), 0xb85c32, [.16, .33, 0], [0, 0, -H * .35]), P(tor(.12, .026, 5, 8, Math.PI), 0xb85c32, [-.16, .33, 0], [0, Math.PI, -H * .35]),
      P(cyl(.305, .305, .05, 12, true), 0x8a4226, [0, .02, 0])]),
    rope: () => merge([P(tor(.3, .1, 7, 14), 0xd2b877, [0, -.1, 0], [H, 0, 0], 1, ROPE), P(tor(.27, .095, 7, 14), 0xc4a866, [0, .06, 0], [H, 0, 0], 1, ROPE),
      P(tor(.22, .09, 7, 12), 0xb99c5c, [0, .2, 0], [H, 0, 0], 1, ROPE)]),
    buoy: () => merge([P(sph(.38, 14, 10), 0xdc4630, 0, 0, 1, METAL), P(cyl(.385, .385, .14, 14, true), 0xf3ede0),
      P(cyl(.05, .07, .42, 8), 0xf3ede0, [0, .52, 0]), P(sph(.08, 8, 6), 0xffd24a, [0, .76, 0]), P(tor(.1, .025, 5, 10), 0x4c5864, [0, -.44, 0], 0, 1, METAL)]),
    crate: () => merge([P(box(.78, .58, .78), 0xb9824a, 0, 0, 1, WOOD),
      ...[-1, 1].flatMap(x => [-1, 1].map(z => P(box(.09, .64, .09), 0x8a5a2e, [x * .38, 0, z * .38], 0, 1, WOOD))),
      ...[-1, 1].flatMap(y => [P(box(.86, .08, .09), 0x8a5a2e, [0, y * .27, .38], 0, 1, WOOD), P(box(.86, .08, .09), 0x8a5a2e, [0, y * .27, -.38], 0, 1, WOOD),
        P(box(.09, .08, .86), 0x8a5a2e, [.38, y * .27, 0], 0, 1, WOOD), P(box(.09, .08, .86), 0x8a5a2e, [-.38, y * .27, 0], 0, 1, WOOD)]),
      P(box(.9, .07, .04), 0x9a6436, [0, 0, .4], [0, 0, .6], 1, WOOD), P(box(.9, .07, .04), 0x9a6436, [0, 0, -.4], [0, 0, -.6], 1, WOOD)]),
    wheel: () => merge([P(tor(.46, .06, 6, 18), 0x7d4c28, 0, 0, 1, WOOD), P(tor(.2, .035, 5, 12), 0x8a5a2e, 0, 0, 1, WOOD),
      ...[0, 1, 2, 3].map(i => P(cyl(.03, .03, 1.26, 6), 0x9a6436, 0, [0, 0, i * H / 2], 1, WOOD)),
      P(cyl(.1, .1, .13, 10), 0xc9973a, 0, [H, 0, 0], 1, METAL)]),
    barrel: () => merge([P(lathe([[0, -.45], [.3, -.45], [.36, -.3], [.41, -.1], [.42, 0], [.41, .1], [.36, .3], [.3, .45], [0, .45]], 14), 0x9c6c3c, 0, 0, 1, WOOD),
      P(tor(.375, .022, 4, 14), 0x3d4248, [0, .27, 0], [H, 0, 0], 1, METAL), P(tor(.375, .022, 4, 14), 0x3d4248, [0, -.27, 0], [H, 0, 0], 1, METAL),
      P(tor(.42, .02, 4, 14), 0x3d4248, [0, .06, 0], [H, 0, 0], 1, METAL), P(cyl(.04, .04, .05, 6), 0x5a3d28, [0, 0, .42], [H, 0, 0], 1, WOOD)]),
    helmet: () => merge([P(sph(.4, 14, 10), 0xcf9c3c, 0, 0, 1, METAL),
      P(lathe([[.3, -.3], [.44, -.38], [.5, -.48], [.46, -.5], [.3, -.42]], 14), 0xa87a2a, 0, 0, 1, METAL),
      ...[[0, 0], [1.25, 0], [-1.25, 0]].flatMap(a => { const x = Math.sin(a[0]) * .37, z = Math.cos(a[0]) * .37;
        return [P(tor(.13, .03, 5, 12), 0xe8c060, [x, .04, z], [0, a[0], 0], 1, METAL), P(cyl(.12, .12, .03, 12), 0x24545f, [x * .97, .04, z * .97], [H, 0, -a[0]])]; }),
      P(cyl(.06, .08, .1, 8), 0xa87a2a, [0, .42, 0], 0, 1, METAL)]),
    propeller: () => merge([P(cyl(.15, .17, .3, 12), 0x8f6a2c, 0, [H, 0, 0], 1, METAL), P(cone(.15, .2, 12), 0x8f6a2c, [0, 0, .25], [H, 0, 0], 1, METAL),
      ...[0, 1, 2].map(i => { const a = i * 2.094; return P(sph(.5, 10, 6), 0xb58a3c, [Math.sin(a) * .45, Math.cos(a) * .45, 0], [0, .5, -a], [.42, .82, .07], METAL); })]),
    anchor: () => merge([P(cyl(.06, .075, 1.4, 8), 0x4c5864, 0, 0, 1, METAL), P(tor(.15, .04, 6, 12), 0x4c5864, [0, .84, 0], 0, 1, METAL),
      P(cyl(.045, .045, .72, 8), 0x4c5864, [0, .52, 0], [0, 0, H], 1, METAL), P(sph(.07, 6, 5), 0x4c5864, [.36, .52, 0], 0, 1, METAL), P(sph(.07, 6, 5), 0x4c5864, [-.36, .52, 0], 0, 1, METAL),
      P(tor(.5, .07, 6, 14, Math.PI), 0x5a6672, [0, -.2, 0], [0, 0, Math.PI], 1, METAL),
      P(cone(.16, .32, 4), 0x5a6672, [.52, -.08, 0], [0, .78, .25], [1, 1, .45], METAL), P(cone(.16, .32, 4), 0x5a6672, [-.52, -.08, 0], [0, .78, -.25], [1, 1, .45], METAL)]),
    cannon: () => merge([
      P(lathe([[0, -.9], [.16, -.9], [.2, -.82], [.17, -.78], [.2, -.3], [.23, -.25], [.23, .2], [.27, .25], [.28, .75], [.2, .85], [.08, .95], [0, .97]], 12), 0x3a4046, [0, .12, 0], [-H, 0, 0], 1, METAL),
      P(box(.62, .14, 1.05), 0x8a5a2e, [0, -.14, .28], 0, 1, WOOD), P(box(.1, .3, .9), 0x7d4c28, [.3, 0, .3], 0, 1, WOOD), P(box(.1, .3, .9), 0x7d4c28, [-.3, 0, .3], 0, 1, WOOD),
      ...[-1, 1].flatMap(x => [0, .6].map(z => P(cyl(.2, .2, .1, 12), 0x6a4426, [x * .4, -.16, z], [0, 0, H], 1, WOOD)))]),
    heart: () => merge([P(sph(.6, 16, 12), 0x58f0dc), P(ico(.3, 0), 0xcffff6, [.34, .42, .1]), P(ico(.34, 0), 0x2fc9c0, [-.3, -.34, .2]),
      P(ico(.22, 0), 0xa0fff0, [-.2, .45, -.25])], false)
  };

  const chest = () => merge([P(box(.9, .48, .6), 0x7d4c28, [0, .24, 0], 0, 1, WOOD),
    P(cyl(.3, .3, .9, 12, false, Math.PI), 0x9a6436, [0, .48, 0], [H, 0, H], 1, WOOD),
    ...[-.3, .3].flatMap(x => [P(box(.1, .5, .63), 0xe2b04a, [x, .25, 0], 0, 1, METAL), P(cyl(.315, .315, .1, 12, false, Math.PI), 0xe2b04a, [x, .48, 0], [H, 0, H], 1, METAL)]),
    P(box(.16, .2, .06), 0xffe08a, [0, .44, .32], 0, 1, METAL)]);
  const letter = () => merge([P(lathe([[0, -.3], [.14, -.3], [.16, -.25], [.16, .03], [.12, .12], [.06, .2], [.055, .33], [.07, .35], [0, .35]], 10), 0x9fe8d8),
    P(cyl(.07, .07, .34, 8), 0xf6ecd0, [0, -.1, 0]), P(cyl(.055, .055, .08, 8), 0x9a6436, [0, .38, 0], 0, 1, WOOD)], false);
  const star = () => merge([P(new T.OctahedronGeometry(.5), 0xfff0a0, 0, 0, [.55, 1.3, .55]),
    P(new T.OctahedronGeometry(.5), 0xffd060, 0, [0, 0, H], [.55, 1.3, .55]),
    P(new T.OctahedronGeometry(.5), 0xffd060, 0, [H, 0, 0], [.55, 1.3, .55])], false, true);
  const part = () => merge([P(tor(.26, .08, 6, 14), 0xe8a040, 0, 0, 1, METAL), P(cyl(.1, .1, .2, 8), 0xc9772a, 0, [H, 0, 0], 1, METAL),
    ...[0, 1, 2, 3, 4, 5].map(i => P(box(.12, .14, .12), 0xe8a040, [Math.cos(i * 1.047) * .36, Math.sin(i * 1.047) * .36, 0], [0, 0, i * 1.047], 1, METAL))], false);
  const crab = () => merge([P(sph(.5, 12, 8), 0xe8552e, [0, .35, 0], 0, [1.25, .55, 1]),
    P(sph(.2, 8, 6), 0xf07a4a, [.58, .4, .5], 0, [1, .7, 1.4]), P(sph(.2, 8, 6), 0xf07a4a, [-.58, .4, .5], 0, [1, .7, 1.4]),
    P(cyl(.035, .035, .25, 6), 0xe8552e, [.2, .65, .35]), P(cyl(.035, .035, .25, 6), 0xe8552e, [-.2, .65, .35]),
    P(sph(.07, 6, 5), 0x151515, [.2, .8, .37]), P(sph(.07, 6, 5), 0x151515, [-.2, .8, .37]),
    ...[-1, 1].flatMap(s => [-.3, 0, .3].map(z => P(cyl(.04, .03, .55, 5), 0xc23f1e, [s * .75, .2, z - .1], [0, 0, H + s * -.5])))]);
  const rock = () => {
    const g = sph(1, 9, 7), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = .78 + .3 * Math.sin(x * 3.1 + y * 5.3) * Math.cos(z * 4.2 + x * 1.7) + .12 * Math.sin(y * 9 + z * 7);
      p.setXYZ(i, x * k, y * k * .65, z * k * .9);
    }
    g.computeVertexNormals(); return merge([P(g, 0x8f8676)]);
  };
  const coral = () => merge([[0, 0, 0, 1.3, 0, 0], [.22, .1, 0, .9, 0, -.5], [-.2, -.1, 0, 1, .2, .45], [.05, -.25, 0, .7, -.6, 0], [-.05, .2, 0, .8, .5, .1]].flatMap((b, i) => {
    const c = [0xff7fa6, 0xff9fbc, 0xf0608f, 0xffb3c8, 0xff8fb0][i];
    return [P(cyl(.04, .1, b[3], 6), c, [b[0] - Math.sin(b[5]) * b[3] / 2, Math.cos(b[5]) * Math.cos(b[4]) * b[3] / 2, b[1] + Math.sin(b[4]) * b[3] / 2], [b[4], 0, b[5]]),
      P(sph(.075, 6, 5), 0xffd0de, [b[0] - Math.sin(b[5]) * b[3], Math.cos(b[5]) * Math.cos(b[4]) * b[3], b[1] + Math.sin(b[4]) * b[3]])];
  }), false);
  const kelp = () => merge([[0, 1.7, .12, 0, 0x3f9a6a], [.16, 1.2, -.15, .8, 0x58b47c], [-.15, 1.0, .2, -.6, 0x2f8258], [.05, 1.4, -.08, 2, 0x4aa672]].map(k =>
    P(sph(.5, 6, 8), k[4], [k[0], k[1] / 2, k[0] * .5], [0, k[3], k[2]], [.16, k[1], .035])), false);

  // ---------- текстуры ----------
  function atlas() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), R = Math.random;
    const tile = (i, fn) => { x.save(); x.beginPath(); x.rect(i % 2 * 256, (1 - (i >> 1)) * 256, 256, 256); x.clip(); x.translate(i % 2 * 256, (1 - (i >> 1)) * 256); fn(); x.restore(); };
    tile(WOOD, () => {
      x.fillStyle = '#efe4d2'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(90,55,25,${.08 + R() * .22})`; x.lineWidth = .6 + R() * 1.6; const y = R() * 256; x.beginPath(); x.moveTo(0, y);
        x.bezierCurveTo(80, y + R() * 8 - 4, 170, y + R() * 8 - 4, 256, y + R() * 6 - 3); x.stroke(); }
      for (let y = 0; y <= 256; y += 64) { x.fillStyle = 'rgba(40,22,8,.55)'; x.fillRect(0, y - 1.5, 256, 3); }
      for (let i = 0; i < 5; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 9); g.addColorStop(0, 'rgba(60,35,15,.6)'); g.addColorStop(1, 'rgba(60,35,15,0)');
        x.save(); x.translate(R() * 256, R() * 256); x.scale(1.8, 1); x.fillStyle = g; x.fillRect(-9, -9, 18, 18); x.restore(); }
    });
    tile(METAL, () => {
      x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) { const r = 2 + R() * 9, g = x.createRadialGradient(0, 0, 0, 0, 0, r), k = R() < .5;
        g.addColorStop(0, k ? `rgba(120,60,25,${.15 + R() * .3})` : `rgba(30,30,35,${.1 + R() * .2})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.save(); x.translate(R() * 256, R() * 256); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.restore(); }
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,255,255,${.25 + R() * .3})`; x.lineWidth = .7; const a = R() * 256, b = R() * 256; x.beginPath(); x.moveTo(a, b); x.lineTo(a + R() * 40 - 20, b + R() * 40 - 20); x.stroke(); }
    });
    tile(CLAY, () => {
      x.fillStyle = '#f2f0ec'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) { x.fillStyle = R() < .5 ? `rgba(0,0,0,${R() * .12})` : `rgba(255,255,255,${R() * .25})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 2.5, 1 + R() * 2.5); }
      for (let i = 0; i < 26; i++) { const r = 8 + R() * 22, g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(60,50,40,${.06 + R() * .1})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.save(); x.translate(R() * 256, R() * 256); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.restore(); }
      for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(40,30,25,.3)'; x.lineWidth = .8; let a = R() * 256, b = R() * 256; x.beginPath(); x.moveTo(a, b); for (let k = 0; k < 5; k++) { a += R() * 26 - 13; b += R() * 26 - 6; x.lineTo(a, b); } x.stroke(); }
    });
    tile(ROPE, () => {
      x.fillStyle = '#f0e8d6'; x.fillRect(0, 0, 256, 256);
      for (let i = -256; i < 512; i += 9) { x.strokeStyle = 'rgba(80,55,25,.5)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 90, 256); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(i + 4, 0); x.lineTo(i + 94, 256); x.stroke(); }
    });
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function sandTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = Math.random;
    x.fillStyle = '#eeeae4'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { x.fillStyle = R() < .55 ? `rgba(70,50,30,${R() * .16})` : `rgba(255,255,255,${R() * .3})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2); }
    for (let y = -20; y < 276; y += 16) for (const o of [-256, 0, 256]) {          // рябь от ушедшей воды
      x.strokeStyle = 'rgba(90,65,40,.16)'; x.lineWidth = 3; x.beginPath(); x.moveTo(o, y);
      for (let k = 0; k <= 256; k += 32) x.lineTo(o + k, y + Math.sin(k / 256 * 6.283 * 2 + y * .3) * 5); x.stroke();
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function flameTex() {            // язык пламени: светлое основание, оранжевая середина, красный кончик
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(.25, '#ffd24a'); g.addColorStop(.55, '#ff9318'); g.addColorStop(.85, '#f04a0c'); g.addColorStop(1, '#c01800');
    x.fillStyle = g; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(40, 40, 62, 70, 56, 104); x.bezierCurveTo(52, 124, 12, 124, 8, 104); x.bezierCurveTo(2, 70, 26, 44, 32, 2); x.fill();
    x.globalCompositeOperation = 'destination-in';
    const m = x.createRadialGradient(32, 92, 4, 32, 80, 30); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.7, 'rgba(0,0,0,.9)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(32, 80); x.scale(1, 2.7); x.translate(-32, -80); x.fillStyle = m; x.fillRect(0, 0, 64, 128); x.restore();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function coalTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), R = Math.random;
    x.fillStyle = '#1a0d06'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 130; i++) { const r = 3 + R() * 9, g = x.createRadialGradient(0, 0, 0, 0, 0, r), h = R();
      g.addColorStop(0, h < .3 ? '#fff0a0' : h < .7 ? '#ff9a2a' : '#d8401a'); g.addColorStop(1, 'rgba(120,20,0,0)');
      x.save(); x.translate(R() * 128, R() * 128); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.restore(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  return { P, merge, items, chest, letter, star, part, crab, rock, coral, kelp, box, cyl, cone, ico, sph, tor, lathe, atlas, sandTex, flameTex, coalTex, WOOD, METAL, CLAY, ROPE };
})();

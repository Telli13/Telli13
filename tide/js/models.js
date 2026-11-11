// Низкополигональные модели, собранные кодом (вершинные цвета, плоские грани)
'use strict';
const M = (() => {
  const T = THREE, tmpC = new T.Color(), e = new T.Euler(), q = new T.Quaternion(), mt = new T.Matrix4();

  // P(геометрия, цвет, позиция, поворот, масштаб) → неиндексированная геометрия с цветом
  function P(g, hex, p, r, s) {
    if (g.index) g = g.toNonIndexed();
    p = p || [0, 0, 0]; r = r || [0, 0, 0]; s = s || [1, 1, 1];
    if (typeof s === 'number') s = [s, s, s];
    mt.compose(new T.Vector3(...p), q.setFromEuler(e.set(...r)), new T.Vector3(...s));
    g.applyMatrix4(mt);
    g.userData.hex = hex;
    return g;
  }
  function merge(parts, ao) {
    let n = 0; parts.forEach(g => n += g.attributes.position.count);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0, minY = 1e9, maxY = -1e9;
    parts.forEach(g => {
      const a = g.attributes.position.array;
      pos.set(a, o * 3);
      tmpC.set(g.userData.hex);
      for (let i = 0; i < a.length / 3; i++) {
        const j = (o + i) * 3;
        col[j] = tmpC.r; col[j + 1] = tmpC.g; col[j + 2] = tmpC.b;
        minY = Math.min(minY, a[i * 3 + 1]); maxY = Math.max(maxY, a[i * 3 + 1]);
      }
      o += a.length / 3;
    });
    if (ao !== false) for (let i = 0; i < n; i++) {           // лёгкое затемнение снизу и разнобой по граням
      const k = .72 + .28 * (pos[i * 3 + 1] - minY) / (maxY - minY || 1);
      const f = k * (.93 + .14 * ((Math.floor(i / 3) * 7919) % 13) / 13);
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  const lathe = (pts, seg) => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg);
  const box = (x, y, z) => new T.BoxGeometry(x, y, z);
  const cyl = (a, b, h, s, open) => new T.CylinderGeometry(a, b, h, s, 1, !!open);
  const cone = (r, h, s) => new T.ConeGeometry(r, h, s);
  const ico = (r, d) => new T.IcosahedronGeometry(r, d || 0);
  const tor = (r, t, a, b, arc) => new T.TorusGeometry(r, t, a, b, arc || Math.PI * 2);
  const H = Math.PI / 2;

  const items = {
    bottle: () => merge([P(lathe([[0, -.3], [.13, -.3], [.13, .04], [.05, .2], [.05, .33]], 6), 0x3f9f72)]),
    conch: () => merge([P(cone(.22, .5, 6), 0xf3c3a2, [0, 0, 0], [H, 0, 0]),
      P(cone(.13, .26, 5), 0xe89a86, [0, .05, -.12], [H * .6, 0, 0])]),
    lantern: () => merge([P(cyl(.15, .19, .36, 5), 0xffd27a), P(cone(.22, .16, 5), 0x9a6a22, [0, .26, 0]),
      P(cyl(.21, .21, .06, 5), 0x9a6a22, [0, -.2, 0]), P(tor(.09, .02, 3, 6), 0x9a6a22, [0, .4, 0])]),
    amphora: () => merge([P(lathe([[0, -.5], [.1, -.5], [.3, -.12], [.29, .12], [.1, .34], [.15, .5]], 7), 0xc66a3c)]),
    rope: () => merge([P(tor(.3, .12, 5, 8), 0xd2b877, [0, 0, 0], [H, 0, 0]),
      P(tor(.22, .1, 4, 7), 0xb99c5c, [0, .14, 0], [H, 0, 0])]),
    buoy: () => merge([P(ico(.38), 0xdc4630), P(cyl(.4, .4, .13, 7), 0xf3ede0),
      P(cone(.1, .45, 5), 0xf3ede0, [0, .5, 0])]),
    crate: () => merge([P(box(.8, .6, .8), 0xb9824a), P(box(.84, .1, .84), 0x8a5a2e, [0, .2, 0]),
      P(box(.84, .1, .84), 0x8a5a2e, [0, -.2, 0])]),
    wheel: () => merge([P(tor(.48, .07, 4, 10), 0x7d4c28), P(box(1.2, .07, .07), 0x9a6436),
      P(box(1.2, .07, .07), 0x9a6436, [0, 0, 0], [0, 0, H * .667]),
      P(box(1.2, .07, .07), 0x9a6436, [0, 0, 0], [0, 0, -H * .667]), P(cyl(.11, .11, .14, 6), 0xc9973a, [0, 0, 0], [H, 0, 0])]),
    barrel: () => merge([P(lathe([[0, -.45], [.32, -.45], [.42, 0], [.32, .45], [0, .45]], 8), 0x9c6c3c),
      P(cyl(.385, .385, .08, 8, true), 0x3d4248, [0, .25, 0]), P(cyl(.385, .385, .08, 8, true), 0x3d4248, [0, -.25, 0])]),
    helmet: () => merge([P(ico(.4, 1), 0xcf9c3c), P(cyl(.17, .17, .12, 6), 0x2f6a78, [0, .04, .36], [H, 0, 0]),
      P(cyl(.44, .5, .16, 8), 0xa87a2a, [0, -.4, 0])]),
    propeller: () => merge([P(cyl(.16, .16, .3, 6), 0x8f6a2c, [0, 0, 0], [H, 0, 0]),
      P(box(.34, .7, .06), 0xb58a3c, [0, .45, 0], [0, .5, 0]),
      P(box(.34, .7, .06), 0xb58a3c, [.39, -.22, 0], [0, .5, -2.094]),
      P(box(.34, .7, .06), 0xb58a3c, [-.39, -.22, 0], [0, .5, 2.094])]),
    anchor: () => merge([P(box(.12, 1.4, .12), 0x4c5864), P(tor(.15, .045, 4, 6), 0x4c5864, [0, .82, 0]),
      P(box(.7, .1, .1), 0x4c5864, [0, .5, 0]), P(tor(.5, .075, 4, 8, Math.PI), 0x5a6672, [0, -.2, 0], [0, 0, Math.PI]),
      P(cone(.13, .3, 4), 0x5a6672, [.5, -.1, 0]), P(cone(.13, .3, 4), 0x5a6672, [-.5, -.1, 0])]),
    cannon: () => merge([P(cyl(.2, .3, 1.8, 8), 0x3a4046, [0, .1, 0], [H, 0, 0]),
      P(cyl(.25, .25, .12, 8), 0x565e66, [0, .1, -.85], [H, 0, 0]),
      P(cyl(.3, .3, .12, 8), 0x7d4c28, [.36, -.12, .3], [0, 0, H]), P(cyl(.3, .3, .12, 8), 0x7d4c28, [-.36, -.12, .3], [0, 0, H]),
      P(box(.6, .16, 1.0), 0x8a5a2e, [0, -.12, .25])]),
    heart: () => merge([P(ico(.62, 1), 0x58f0dc), P(ico(.3, 0), 0xcffff6, [.34, .4, .1]),
      P(ico(.34, 0), 0x2fc9c0, [-.3, -.34, .2])], false)
  };

  const chest = () => merge([P(box(.9, .5, .6), 0x7d4c28, [0, .25, 0]),
    P(cyl(.3, .3, .9, 7, false), 0x9a6436, [0, .5, 0], [0, 0, H], [1, 1, 1]),
    P(box(.12, .56, .64), 0xe2b04a, [-.3, .27, 0]), P(box(.12, .56, .64), 0xe2b04a, [.3, .27, 0]),
    P(box(.16, .18, .06), 0xffe08a, [0, .46, .32])]);
  const letter = () => merge([P(lathe([[0, -.3], [.16, -.3], [.16, .04], [.06, .2], [.06, .36]], 6), 0x9fe8d8),
    P(cyl(.07, .07, .34, 5), 0xf6ecd0, [0, -.1, 0]), P(cyl(.065, .065, .08, 5), 0x9a6436, [0, .38, 0])], false);
  const star = () => merge([P(new T.OctahedronGeometry(.5), 0xfff0a0, [0, 0, 0], [0, 0, 0], [.55, 1.3, .55]),
    P(new T.OctahedronGeometry(.5), 0xffd060, [0, 0, 0], [0, 0, H], [.55, 1.3, .55]),
    P(new T.OctahedronGeometry(.5), 0xffd060, [0, 0, 0], [H, 0, 0], [.55, 1.3, .55])], false);
  const crab = () => merge([P(ico(.5, 1), 0xe8552e, [0, .35, 0], [0, 0, 0], [1.25, .55, 1]),
    P(ico(.2), 0xf07a4a, [.55, .4, .5], [0, 0, 0], [1, .7, 1.4]), P(ico(.2), 0xf07a4a, [-.55, .4, .5], [0, 0, 0], [1, .7, 1.4]),
    P(box(.08, .25, .08), 0xe8552e, [.2, .65, .35]), P(box(.08, .25, .08), 0xe8552e, [-.2, .65, .35]),
    P(ico(.07), 0x151515, [.2, .8, .37]), P(ico(.07), 0x151515, [-.2, .8, .37]),
    ...[-1, 1].flatMap(s => [-.3, 0, .3].map(z => P(box(.5, .07, .08), 0xc23f1e, [s * .75, .2, z - .1], [0, 0, s * -.5])))]);
  const rock = () => merge([P(ico(1, 0), 0x8f8676, [0, 0, 0], [.3, .5, 0], [1, .6, .9])]);
  const coral = () => merge([P(cone(.16, 1.3, 5), 0xff7fa6, [0, .65, 0]), P(cone(.12, .9, 5), 0xff9fbc, [.25, .5, .1], [0, 0, -.5]),
    P(cone(.12, 1.0, 5), 0xf0608f, [-.22, .5, -.1], [.2, 0, .45]), P(cone(.1, .7, 5), 0xffb3c8, [.05, .4, -.28], [-.6, 0, 0])], false);
  const kelp = () => merge([P(box(.14, 1.6, .04), 0x3f9a6a, [0, .8, 0], [0, 0, .12]), P(box(.12, 1.2, .04), 0x58b47c, [.16, .6, .08], [0, .8, -.15]),
    P(box(.12, 1.0, .04), 0x2f8258, [-.15, .5, -.05], [0, -.6, .2])], false);

  return { P, merge, items, chest, letter, star, crab, rock, coral, kelp, box, cyl, cone, ico, tor, lathe };
})();

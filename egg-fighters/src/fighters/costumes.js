/* Costumes: accessory builders that dress the shared rig. One function per costume id.
 * Pieces that wrap the egg are built from the egg profile (EF.egg.bandGeometry) so they hug it.
 * Add a new fighter look by adding a function here and an entry in roster.js.
 */
'use strict';

(() => {
  const TAU = Math.PI * 2;

  function mesh(geo, material) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function starShape(points, outer, inner) {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer, a = (i / (points * 2)) * TAU + Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }

  function katana(mat, box) {
    const g = new THREE.Group();
    const steel = mat(0xd6dde4, { metalness: 0.85, roughness: 0.25 });
    g.add(box(0.035, 0.9, 0.085, steel, 0, -0.3, 0));
    g.add(box(0.055, 0.28, 0.065, mat(0x1a1414), 0, 0.31, 0));
    g.add(box(0.06, 0.04, 0.07, mat(0xb7202a), 0, 0.2, 0));
    const guard = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14), mat(0xd9a627, { metalness: 0.7, roughness: 0.35 }));
    guard.position.y = 0.16;
    g.add(guard);
    return g;
  }

  const costumes = {
    ninja(rig, { mat, box }) {
      const C = rig.costume;
      const black = mat(0x16161b, { roughness: 0.75 });
      const red = mat(0xc0212c, { roughness: 0.65 });
      // headband above the eyes
      C.add(mesh(EF.egg.bandGeometry(0.34, 0.47, 1.055, 0.99), black));
      // metal plate with a shuriken mark
      const plateY = 0.405, plateP = EF.egg.surfacePoint(plateY, 0, 1.075);
      const plate = box(0.32, 0.13, 0.04, mat(0xc9ced6, { metalness: 0.8, roughness: 0.3 }), plateP.x, plateP.y, plateP.z);
      plate.rotation.x = -0.25;
      const star = mesh(new THREE.ExtrudeGeometry(starShape(4, 0.05, 0.016), { depth: 0.01, bevelEnabled: false }), mat(0x111111));
      star.position.z = 0.02;
      plate.add(star);
      C.add(plate);
      // headband tails fluttering behind
      for (const s of [-1, 1]) {
        const tail = box(0.07, 0.36, 0.025, black, s * 0.08, 0.28, -0.66);
        tail.rotation.set(0.5, 0, s * 0.35);
        C.add(tail);
      }
      // mask over the lower face (front only, so the chocolate stays visible at the sides)
      C.add(mesh(EF.egg.bandGeometry(-0.27, 0.035, 1.045, 0.99, -1.35, 2.7), black));
      // red scarf around the lower egg + tail
      C.add(mesh(EF.egg.bandGeometry(-0.4, -0.27, 1.06, 0.99), red));
      const knot = box(0.18, 0.14, 0.1, red, 0.25, -0.36, -0.55);
      knot.rotation.y = -0.4;
      C.add(knot);
      const scarfTail = box(0.14, 0.42, 0.04, red, 0.32, -0.58, -0.6);
      scarfTail.rotation.set(0.35, -0.3, 0.25);
      C.add(scarfTail);
      // two katanas crossed on the back, handles over the shoulders
      for (const s of [-1, 1]) {
        const k = katana(mat, box);
        k.position.set(s * 0.17, 0.12, -0.7);
        k.rotation.set(-0.15, 0, s * 0.62);
        C.add(k);
      }
      // red wrist wraps and a belt stripe on the boots
      for (const arm of [rig.armL, rig.armR]) arm.pivot.add(box(0.28, 0.06, 0.28, red, 0, -0.27, 0));
    },

    samurai(rig, { mat, box }) {
      const C = rig.costume;
      const red = mat(0xb3202b, { roughness: 0.45, metalness: 0.1 });
      const dark = mat(0x1d1517, { roughness: 0.6 });
      const gold = mat(0xe0ac2b, { metalness: 0.75, roughness: 0.3 });
      const yH = 0.36;
      // kabuto: dome over the top of the egg
      const domePts = EF.egg.points(yH, EF.egg.H, 14, 1.08)
        .concat(EF.egg.points(yH, EF.egg.H, 14, 1.0).reverse());
      domePts.push(domePts[0].clone());
      const dome = mesh(new THREE.LatheGeometry(domePts, 40), red);
      dome.geometry.computeVertexNormals();
      C.add(dome);
      // gold rim + black ribs on the dome
      C.add(mesh(EF.egg.bandGeometry(yH, yH + 0.05, 1.1, 1.0), gold));
      for (let i = 0; i < 8; i++) {
        const rib = mesh(EF.egg.bandGeometry(yH + 0.05, EF.egg.H - 0.04, 1.095, 1.07, (i / 8) * TAU - 0.02, 0.04, 2), dark);
        C.add(rib);
      }
      // shikoro: flared neck guard around the back and sides
      const r0 = EF.egg.radiusAt(yH) * 1.09;
      const flare = [
        new THREE.Vector2(r0, yH + 0.02), new THREE.Vector2(r0 + 0.26, yH - 0.2),
        new THREE.Vector2(r0 + 0.23, yH - 0.24), new THREE.Vector2(r0 - 0.03, yH - 0.02),
        new THREE.Vector2(r0, yH + 0.02),
      ];
      const shikoro = mesh(new THREE.LatheGeometry(flare, 32, 1.05, TAU - 2.1), red);
      shikoro.geometry.computeVertexNormals();
      C.add(shikoro);
      // stripes on the neck guard
      const stripePts = [new THREE.Vector2(r0 + 0.1, yH - 0.07), new THREE.Vector2(r0 + 0.14, yH - 0.12),
        new THREE.Vector2(r0 + 0.13, yH - 0.125), new THREE.Vector2(r0 + 0.09, yH - 0.075), new THREE.Vector2(r0 + 0.1, yH - 0.07)];
      C.add(mesh(new THREE.LatheGeometry(stripePts, 32, 1.05, TAU - 2.1), dark));
      // kuwagata crest: a golden U on the front + the round crest plate
      const front = EF.egg.surfacePoint(0.55, 0, 1.12);
      const crest = mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 24, Math.PI), gold);
      crest.rotation.z = Math.PI;
      crest.position.set(0, 0.86, front.z + 0.04);
      crest.scale.set(1.15, 1.25, 1);
      C.add(crest);
      for (const s of [-1, 1]) {
        const tip = mesh(new THREE.ConeGeometry(0.055, 0.16, 10), gold);
        tip.position.set(s * 0.3, 0.92, front.z + 0.04);
        tip.rotation.z = -s * 0.25;
        C.add(tip);
      }
      const mon = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20), gold);
      mon.rotation.x = Math.PI / 2 - 0.35;
      mon.position.set(0, 0.55, front.z - 0.02);
      C.add(mon);
      const knob = mesh(new THREE.SphereGeometry(0.06, 12, 8), gold);
      knob.position.y = EF.egg.H * 1.08;
      C.add(knob);
      // do (chest armour) around the lower egg with gold rim and black lacing
      C.add(mesh(EF.egg.bandGeometry(-0.66, -0.2, 1.06, 0.99), red));
      C.add(mesh(EF.egg.bandGeometry(-0.24, -0.18, 1.085, 1.0), gold));
      for (const y of [-0.36, -0.5]) C.add(mesh(EF.egg.bandGeometry(y, y + 0.025, 1.075, 1.04), dark));
      // obi belt knot
      const obiP = EF.egg.surfacePoint(-0.6, 0, 1.08);
      C.add(box(0.26, 0.12, 0.08, gold, obiP.x, obiP.y, obiP.z));
      // sode: shoulder plates that move with the arms
      for (const [arm, s] of [[rig.armL, -1], [rig.armR, 1]]) {
        const sode = box(0.34, 0.32, 0.38, red, s * 0.07, -0.07, 0);
        sode.rotation.z = s * 0.28;
        sode.add(box(0.36, 0.05, 0.4, gold, 0, 0.15, 0));
        sode.add(box(0.35, 0.03, 0.39, dark, 0, -0.02, 0));
        arm.pivot.add(sode);
      }
      // shin guards
      for (const leg of [rig.legL, rig.legR]) leg.pivot.add(box(0.3, 0.2, 0.06, red, 0, -0.22, 0.15));
      // sheathed sword at the left hip
      const saya = box(0.06, 0.08, 0.95, dark, -0.62, -0.45, -0.05);
      saya.rotation.x = 0.25;
      saya.add(box(0.065, 0.065, 0.25, mat(0xece4d4), 0, 0, 0.58));
      C.add(saya);
    },
  };

  EF.costumes = costumes;
})();

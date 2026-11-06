/* The shared fighter rig: a chocolate egg with blocky arms and legs and a cartoon face.
 * All fighters use the same body so they share the same combat system; costumes.js dresses it.
 *
 *  root            ground position, facing (rotation.y; local +z is forward)
 *   └ pivot        body centre — lean, wobble, tumble, squash
 *      ├ body      egg layers (eggLayer), face, costume pieces
 *      ├ armL/R    shoulder pivots (rotation.x = -PI/2 points the arm forward)
 *      └ legL/R    hip pivots
 */
'use strict';

(() => {
  const BODY_Y = 1.17;         // height of the egg centre above the ground
  const SHOULDER_X = 0.74;
  const HIP_Y = -0.62, HIP_X = 0.22;
  const LEG_LEN = BODY_Y + HIP_Y; // hip to sole

  const matCache = {};
  /** shared materials by name + colour */
  function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!matCache[key]) {
      matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, opts));
    }
    return matCache[key];
  }

  const MATS = {
    milk: () => mat(0x6b3a22, { roughness: 0.32 }),        // milk chocolate
    white: () => mat(0xf3e6cf, { roughness: 0.4 }),        // white chocolate
    capsule: () => mat(0xffcf1f, { roughness: 0.18, metalness: 0.05 }),
  };

  function box(w, h, d, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** rounded-ish block: a box with slightly bevelled look via a second inset box (cheap Roblox feel) */
  function block(w, h, d, material, x = 0, y = 0, z = 0) {
    return box(w, h, d, material, x, y, z);
  }

  function shadowed(o) {
    o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    return o;
  }

  /** big angry cartoon eye placed on the egg surface */
  function makeEye(side, def) {
    const g = new THREE.Group();
    const y = def.eyeY ?? 0.16, phi = side * 0.3;
    const p = EF.egg.surfacePoint(y, phi, 1.0);
    g.position.copy(p);
    g.rotation.y = phi;
    g.rotation.x = -0.12;
    const white = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24), mat(0xffffff, { roughness: 0.3 }));
    white.scale.set(1, 1.15, 1);
    white.position.z = 0.012;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), mat(0x15100c, { roughness: 0.2 }));
    pupil.position.set(-side * 0.02, -0.01, 0.02);
    const shine = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }));
    shine.position.set(-side * 0.015, 0.025, 0.004);
    pupil.add(shine);
    // angry brow: a thick black block slanting down toward the middle
    const brow = box(0.2, 0.05, 0.04, mat(0x120c08), side * 0.01, 0.13, 0.03);
    brow.rotation.z = side * 0.38;
    brow.castShadow = false;
    g.add(white, pupil, brow);
    return { group: g, white, pupil, brow, side };
  }

  /**
   * Build a fighter model from a roster definition (see roster.js).
   * Returns the rig parts; the egg layers are added into `eggLayer`.
   */
  function buildFighterModel(def) {
    const root = new THREE.Group();
    root.name = def.id;
    const pivot = new THREE.Group();
    pivot.position.y = BODY_Y;
    root.add(pivot);
    const body = new THREE.Group();
    pivot.add(body);

    // egg layers (Phase 1: the intact outer chocolate; Phase 3 replaces it with fractured shells)
    const eggLayer = new THREE.Group();
    body.add(eggLayer);
    const egg = new THREE.Mesh(EF.egg.eggGeometry(1, 48), MATS.milk());
    egg.castShadow = true; egg.receiveShadow = true;
    eggLayer.add(egg);

    // face
    const face = new THREE.Group();
    body.add(face);
    const eyes = [makeEye(-1, def), makeEye(1, def)];
    eyes.forEach((e) => face.add(e.group));

    // arms: sleeve block + fist block, hanging from the shoulder pivot
    const c = def.colors;
    const makeArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * SHOULDER_X, 0.02, 0);
      const upper = block(0.25, 0.34, 0.25, mat(c.sleeve), 0, -0.13, 0);
      const cuff = block(0.27, 0.08, 0.27, mat(c.cuff), 0, -0.32, 0);
      const fist = block(0.3, 0.27, 0.3, mat(c.fist, { roughness: 0.5 }), 0, -0.48, 0);
      const inner = new THREE.Group();   // slides out of the shoulder for long punches
      inner.add(upper, cuff, fist);
      sh.add(inner);
      pivot.add(sh);
      return { pivot: sh, inner, fist };
    };
    const armL = makeArm(-1), armR = makeArm(1);

    // legs: trouser block + boot
    const makeLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * HIP_X, HIP_Y, 0);
      const leg = block(0.27, LEG_LEN - 0.14, 0.28, mat(c.leg), 0, -(LEG_LEN - 0.14) / 2, 0);
      const boot = block(0.31, 0.16, 0.4, mat(c.boot), 0, -LEG_LEN + 0.08, 0.05);
      hip.add(leg, boot);
      pivot.add(hip);
      return { pivot: hip };
    };
    const legL = makeLeg(-1), legR = makeLeg(1);

    const rig = { def, root, pivot, body, eggLayer, egg, face, eyes, armL, armR, legL, legR, costume: new THREE.Group(), handWeapon: {}, backBlade: null };
    body.add(rig.costume);
    if (def.costume) EF.costumes[def.costume](rig, { mat, box: block });
    shadowed(rig.costume);
    return rig;
  }

  EF.model = { buildFighterModel, mat, MATS, box, BODY_Y, SHOULDER_X, LEG_LEN };
})();

/* Boot: renderer, scene, arena, camera and the main loop.
 * URL options:
 *   (none)            menu → pick a fighter → you vs CPU
 *   ?mode=demo        CPU vs CPU, rounds repeat forever
 *   ?p=ninja|samurai  skip the menu and fight as that egg
 *   ?mode=showcase    fighters only, camera orbits (?view=ninja|samurai, ?yaw=radians)
 */
'use strict';

(() => {
  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: params.has('shot') });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const arena = EF.arena.buildArena(scene);
  const camera = new EF.FightCamera(1);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    camera.cam.aspect = w / h;
    camera.cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const app = { renderer, scene, arena, camera, params, mode: null, time: 0 };
  EF.app = app;

  // ---- showcase mode (Phase 1): the two fighters standing in the arena ----
  function showcase() {
    const view = params.get('view');
    const ids = view ? [view] : ['ninja', 'samurai'];
    const rigs = ids.map((id, i) => {
      const rig = EF.model.buildFighterModel(EF.roster[id]);
      const x = ids.length === 1 ? 0 : (i ? 1.3 : -1.3);
      rig.root.position.set(x, 0, 0);
      rig.root.rotation.y = ids.length === 1 ? 0 : (i ? -Math.PI / 2 : Math.PI / 2) * 0.55;
      scene.add(rig.root);
      return rig;
    });
    camera.orbit = params.has('yaw') ? 0 : 0.25;
    camera.yaw = parseFloat(params.get('yaw') || '0');
    camera.dist = ids.length === 1 ? 4.6 : 7;
    return {
      update(dt, t) {
        rigs.forEach((r, i) => {
          // idle "boxing bounce"
          const b = Math.sin(t * 7 + i * 1.7);
          r.pivot.position.y = EF.model.BODY_Y + Math.abs(b) * 0.05;
          r.pivot.rotation.z = Math.sin(t * 3.5 + i) * 0.04;
          r.armL.pivot.rotation.x = -0.9 + b * 0.08;
          r.armR.pivot.rotation.x = -0.6 - b * 0.08;
        });
        const a = { x: -0.1, z: 0 }, c = { x: 0.1, z: 0 };
        camera.update(dt, a, c);
        if (ids.length === 1) camera.dist = 4.6;
      },
    };
  }

  // ---- fight mode (Phase 2+): menu, you vs CPU, or CPU vs CPU demo ----
  function fight() {
    let match = null;
    const begin = (choice) => {
      if (match) match.destroy();
      app.fx && app.fx.clearDebris();
      const demo = choice === 'demo';
      const me = demo ? EF.M.pick(['ninja', 'samurai']) : choice;
      const other = me === 'ninja' ? 'samurai' : 'ninja';
      match = new EF.Match(app, {
        ids: [me, other],
        controllers: demo ? ['cpu', 'cpu'] : ['player', 'cpu'],
        onEnd(m) {
          if (demo) { begin('demo'); return; }
          const won = m.winner && m.winner.slot === 0;
          EF.hud.result(won ? 'Победа!' : 'Поражение…', () => begin(choice), () => { match.destroy(); match = null; showMenu(); });
        },
      });
      app.match = match;
    };
    const showMenu = () => EF.hud.menu(begin);
    const p = params.get('p');
    if (params.get('mode') === 'demo') begin('demo');
    else if (p && EF.roster[p]) begin(p);
    else showMenu();

    const mute = document.createElement('button');
    mute.className = 'mute';
    mute.textContent = EF.audio.muted ? '🔇' : '🔊';
    mute.addEventListener('click', () => { mute.textContent = EF.audio.toggle() ? '🔊' : '🔇'; });
    document.getElementById('ui').appendChild(mute);

    // idle camera while the menu is open
    return {
      update(dt) {
        if (match) match.update(dt);
        else {
          camera.orbit = 0.15;
          camera.update(dt, { x: -1, z: 0 }, { x: 1, z: 0 });
          if (app.fx) app.fx.update(dt);
        }
        if (match) camera.orbit = 0;
      },
    };
  }

  const MODES = { showcase, fight, demo: fight };
  EF.registerMode = (name, fn) => { MODES[name] = fn; };

  function start() {
    const name = params.get('mode') || 'fight';
    app.mode = (MODES[name] || showcase)();
    document.getElementById('loading')?.remove();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      app.time += dt;
      app.mode.update(dt, app.time);
      renderer.render(scene, camera.cam);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  EF.start = start;
  window.addEventListener('load', start);
})();

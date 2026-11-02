/* Mycelium Forest — first playable prototype.
 *
 * Core loop: click the soil -> the mycelium grows toward the click, rocks block it,
 * touching a resource drains it along the network into the counters, and enough
 * resources grow the mushroom on the surface through 6 stages.
 *
 * All coordinates are logical (1600 x 900); the canvas is scaled to the window.
 */
'use strict';

(() => {
  // ---------------------------------------------------------------- constants
  const W = 1600;
  const H = 900;
  const GROUND_Y = 430;            // grass line between forest and soil
  const SOIL_TOP = GROUND_Y + 22;  // mycelium may not grow above this
  const SOIL_PAD = 12;             // keep away from the left/right/bottom edges
  const ROOT = { x: 800, y: GROUND_Y + 26 };

  const STEP = 5;                  // px per mycelium node
  const PLAYER_SPEED = 75;         // px / s of a tip the player steers
  const AUTO_SPEED = 40;           // px / s of small side branches
  const MAX_PLAYER_TIPS = 4;
  const MAX_SLIDE = 0.8;           // rad: how far a tip may bend to slide along a rock
  const DRAIN_INTERVAL = 0.4;      // s between units pulled from a connected resource
  const FLOW_SPEED = 340;          // px / s of a resource unit travelling to the mushroom
  const MUSH_SCALE = 0.56;
  const MUSH_X = ROOT.x;

  const RES = {
    water:   { name: 'Вода',     sprite: 'water_drop', color: '#62cbff', glow: '98,203,255' },
    organic: { name: 'Органика', sprite: 'leaf',       color: '#9ad957', glow: '154,217,87' },
    mineral: { name: 'Минералы', sprite: 'crystal',    color: '#b9a2ff', glow: '185,162,255' },
    sugar:   { name: 'Сахар',    sprite: 'sugar',      color: '#ffc53d', glow: '255,197,61' },
  };
  const RES_ORDER = ['water', 'organic', 'mineral', 'sugar'];

  // What the mushroom needs to reach stage 1..6 (spent when the stage grows).
  const STAGES = [
    { water: 2, organic: 2, mineral: 0, sugar: 0 },
    { water: 3, organic: 2, mineral: 1, sugar: 0 },
    { water: 4, organic: 3, mineral: 2, sugar: 1 },
    { water: 5, organic: 4, mineral: 3, sugar: 2 },
    { water: 6, organic: 5, mineral: 4, sugar: 3 },
    { water: 8, organic: 6, mineral: 5, sugar: 4 },
  ];

  const SPRITES = [
    'background.jpg',
    'oak', 'birch', 'spruce', 'bush_berries', 'bush_flowers', 'fern_1', 'fern_2',
    'daisies', 'bluebells', 'buttercups', 'grass_1', 'grass_2', 'grass_3',
    'hedgehog', 'squirrel', 'rabbit', 'robin', 'bluetit',
    'mushroom_1', 'mushroom_2', 'mushroom_3', 'mushroom_4', 'mushroom_5', 'mushroom_6',
    'soil_tile_1', 'soil_tile_2', 'soil_tile_3',
    'rock_mossy', 'rock_1', 'rock_2', 'rock_3', 'rock_4',
    'roots_stump', 'roots_long', 'roots_turf',
    'water_drop', 'water_pool', 'leaf', 'crystal', 'sugar',
    'worm', 'woodlouse', 'log',
  ];

  // ---------------------------------------------------------------- helpers
  const params = new URLSearchParams(location.search);
  let seed = Number(params.get('seed')) || (Date.now() % 1e9);
  function rand() { // mulberry32 — seeded so a layout can be reproduced with ?seed=N
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + rand() * (b - a);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

  const img = {};
  function loadSprites() {
    return Promise.all(SPRITES.map((name) => new Promise((resolve, reject) => {
      const file = name.includes('.') ? name : name + '.png';
      const key = name.replace(/\.\w+$/, '');
      const im = new Image();
      im.onload = () => { img[key] = im; resolve(); };
      im.onerror = () => reject(new Error('Не удалось загрузить art/sprites/' + file));
      im.src = 'art/sprites/' + file;
    })));
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Draw a sprite by its bottom-centre point. scale is relative to the PNG size.
  function drawSprite(ctx, im, x, bottom, scale, flip = false, alpha = 1, rot = 0) {
    const w = im.width * scale;
    const h = im.height * scale;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, bottom);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  }

  // ---------------------------------------------------------------- canvas / scaling
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let RS = 1;                                 // backing pixels per logical pixel
  let soilCanvas = null;                      // pre-rendered soil cross-section
  let glowCanvas = null, glowCtx = null;      // wide soft halo of the mycelium
  let coreCanvas = null, coreCtx = null;      // bright thin threads

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fit = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * fit), cssH = Math.floor(H * fit);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.left = Math.floor((vw - cssW) / 2) + 'px';
    canvas.style.top = Math.floor((vh - cssH) / 2) + 'px';
    const newRS = clamp(fit * (window.devicePixelRatio || 1), 0.5, 2);
    if (Math.abs(newRS - RS) < 0.01 && soilCanvas) return;
    RS = newRS;
    canvas.width = Math.round(W * RS);
    canvas.height = Math.round(H * RS);
    if (state) {
      buildSoil();
      rebuildMycelium();
    }
  }

  // ---------------------------------------------------------------- world state
  let state = null;

  function newWorld() {
    state = {
      t: 0,
      nodes: [],          // {x, y, parent, w}
      tips: [],           // growing ends
      rocks: [],
      resources: [],
      particles: [],      // units flowing through the mycelium
      flyers: [],         // units flying from the mushroom to the counter
      fx: [],             // rings, sparks, blocked puffs
      msgs: [],
      counts: { water: 0, organic: 0, mineral: 0, sugar: 0 },
      bump: { water: 0, organic: 0, mineral: 0, sugar: 0 },
      collected: 0,
      stage: 0,
      stageAnim: 1,
      prevStage: 0,
      respawnTimer: 4,
      pointer: null,
      activeTip: null,
      animals: makeAnimals(),
      critters: [],
    };
    makeRocks();
    makeResources();
    makeCritters();
    // the network starts as a small knot under the spot where the mushroom will rise
    addNode(ROOT.x, ROOT.y, -1, 3.6);
    for (const a of [Math.PI / 2, Math.PI / 2 + 0.9, Math.PI / 2 - 0.9]) {
      addTip(0, a, null, rr(35, 55), AUTO_SPEED, false);
    }
    msg('Кликните по почве — грибница прорастёт в ту сторону', 5);
  }

  // ---- obstacles
  function rockHit(x, y, pad = 0) {
    for (const r of state.rocks) {
      const dx = (x - r.cx) / (r.rx + pad), dy = (y - r.cy) / (r.ry + pad);
      if (dx * dx + dy * dy < 1) return r;
    }
    return null;
  }
  function outOfSoil(x, y) {
    return x < SOIL_PAD || x > W - SOIL_PAD || y < SOIL_TOP || y > H - SOIL_PAD;
  }
  const blocked = (x, y) => outOfSoil(x, y) || !!rockHit(x, y);

  function makeRocks() {
    const kinds = [
      { s: 'rock_mossy', w: [150, 230] },
      { s: 'rock_mossy', w: [120, 190] },
      { s: 'rock_1', w: [130, 200] },
      { s: 'rock_2', w: [120, 180] },
      { s: 'rock_3', w: [100, 150] },
      { s: 'rock_4', w: [80, 120] },
    ];
    let tries = 0;
    while (state.rocks.length < 10 && tries++ < 600) {
      const k = pick(kinds);
      const im = img[k.s];
      const w = rr(k.w[0], k.w[1]);
      const scale = w / im.width;
      const h = im.height * scale;
      const x = rr(70, W - 70);
      const y = rr(SOIL_TOP + 70, H - 40);
      const rock = {
        s: k.s, x, bottom: y + h / 2, scale, flip: rand() < 0.5,
        cx: x, cy: y + h * 0.02, rx: w * 0.44, ry: h * 0.45,
      };
      if (dist(x, y, ROOT.x, ROOT.y + 40) < 190) continue;
      if (state.rocks.some((o) => dist(o.cx, o.cy, rock.cx, rock.cy) < (o.rx + rock.rx) * 0.9 + 30)) continue;
      state.rocks.push(rock);
    }
  }

  // ---- resources
  function resourceSprite(type, big) {
    if (type === 'water' && big) return { s: 'water_pool', size: 92, amount: 7 };
    return {
      water: { s: 'water_drop', size: 40, amount: 3 },
      organic: { s: 'leaf', size: 52, amount: 3 },
      mineral: { s: 'crystal', size: 50, amount: 3 },
      sugar: { s: 'sugar', size: 44, amount: 2 },
    }[type];
  }

  function freeSpot(x, y, radius) {
    if (outOfSoil(x, y) || y < SOIL_TOP + 25) return false;
    if (rockHit(x, y, radius + 12)) return false;
    if (state.resources.some((r) => dist(r.x, r.y, x, y) < r.radius + radius + 40)) return false;
    return true;
  }

  function placeResource(type, opts = {}) {
    const big = !!opts.big;
    const def = resourceSprite(type, big);
    const radius = def.size * 0.42;
    for (let i = 0; i < 80; i++) {
      const a = opts.near ? rr(0.25, Math.PI - 0.25) : 0;
      const d = opts.near ? rr(opts.near[0], opts.near[1]) : 0;
      const x = opts.near ? ROOT.x + Math.cos(a) * d * 1.4 : rr(60, W - 60);
      const y = opts.near ? ROOT.y + Math.sin(a) * d : rr(SOIL_TOP + 40, H - 40);
      if (!freeSpot(x, y, radius)) continue;
      if (opts.awayFromNetwork && nearestNode(x, y).d < 110) continue;
      const res = {
        type, s: def.s, x, y, size: def.size, radius,
        amount: def.amount + (big ? 0 : Math.floor(rr(0, 2))),
        connected: false, node: -1, path: null, timer: 0.2,
        phase: rr(0, Math.PI * 2), fade: 0, dead: false,
      };
      res.total = res.amount;
      state.resources.push(res);
      return res;
    }
    return null;
  }

  function makeResources() {
    // a gentle start: something to grab right next to the knot
    placeResource('water', { near: [110, 170] });
    placeResource('organic', { near: [110, 170] });
    placeResource('water', { big: true });
    const plan = ['water', 'water', 'water', 'organic', 'organic', 'organic', 'organic',
      'mineral', 'mineral', 'mineral', 'mineral', 'sugar', 'sugar', 'sugar', 'sugar'];
    for (const t of plan) placeResource(t);
  }

  // Keep the soil stocked with whatever the mushroom is shortest of.
  function respawn(dt) {
    state.respawnTimer -= dt;
    if (state.respawnTimer > 0) return;
    state.respawnTimer = 3.5;
    const alive = state.resources.filter((r) => !r.dead);
    if (alive.length >= 16) return;
    const need = state.stage < 6 ? STAGES[state.stage] : { water: 1, organic: 1, mineral: 1, sugar: 1 };
    let best = null, bestScore = Infinity;
    for (const t of RES_ORDER) {
      const inWorld = alive.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);
      const score = (state.counts[t] + inWorld) / (need[t] + 1) + rand() * 0.3;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    const r = placeResource(best, { awayFromNetwork: true });
    if (r) r.fade = -1; // fades in
  }

  // ---- mycelium graph
  const grid = new Map(); // spatial hash of node indices, 40px cells
  const cellKey = (x, y) => (Math.floor(x / 40) << 16) ^ Math.floor(y / 40);

  function addNode(x, y, parent, w) {
    const idx = state.nodes.length;
    state.nodes.push({ x, y, parent, w });
    const k = cellKey(x, y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(idx);
    if (parent >= 0) drawSegment(state.nodes[parent], state.nodes[idx]);
    touchResources(idx);
    return idx;
  }

  function nearestNode(x, y) {
    let best = -1, bd = Infinity;
    const cx = Math.floor(x / 40), cy = Math.floor(y / 40);
    for (let ring = 0; ring < 50 && best < 0; ring++) {
      for (let gx = cx - ring; gx <= cx + ring; gx++) {
        for (let gy = cy - ring; gy <= cy + ring; gy++) {
          if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== ring) continue;
          const list = grid.get((gx << 16) ^ gy);
          if (!list) continue;
          for (const i of list) {
            const n = state.nodes[i];
            const d = dist(n.x, n.y, x, y);
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
      if (best >= 0) { // one more ring guarantees the true nearest
        ring++;
        for (let gx = cx - ring; gx <= cx + ring; gx++) {
          for (let gy = cy - ring; gy <= cy + ring; gy++) {
            const list = grid.get((gx << 16) ^ gy);
            if (!list) continue;
            for (const i of list) {
              const n = state.nodes[i];
              const d = dist(n.x, n.y, x, y);
              if (d < bd) { bd = d; best = i; }
            }
          }
        }
      }
    }
    return { i: best, d: bd };
  }

  function addTip(nodeIdx, angle, target, len, speed, player) {
    const base = state.nodes[nodeIdx];
    const tip = {
      node: nodeIdx, angle, target, len, speed, player,
      w: Math.max(1.1, base.w * (player ? 0.9 : 0.62)),
      acc: 0, wander: 0, side: rand() < 0.5 ? 1 : -1,
      travelled: 0, maxTravel: target ? dist(base.x, base.y, target.x, target.y) * 2.2 + 80 : len,
      sinceBranch: 0, nextBranch: rr(35, 80), alive: true, born: state.t,
    };
    state.tips.push(tip);
    return tip;
  }

  function stepTip(tip) {
    const n = state.nodes[tip.node];
    let desired = tip.angle;
    if (tip.target) desired = Math.atan2(tip.target.y - n.y, tip.target.x - n.x);
    tip.wander = tip.wander * 0.85 + (rand() - 0.5) * 0.55;
    const turn = tip.target ? 0.3 : 0.05;
    const a0 = tip.angle + angDiff(tip.angle, desired) * turn + tip.wander * 0.3;

    // try straight first, then bend a little to slide along rocks (sticky side)
    let chosen = null;
    const offsets = [0];
    for (let o = 0.2; o <= MAX_SLIDE + 1e-6; o += 0.2) offsets.push(o * tip.side, -o * tip.side);
    for (const off of offsets) {
      const a = a0 + off;
      const nx = n.x + Math.cos(a) * STEP, ny = n.y + Math.sin(a) * STEP;
      const ax = n.x + Math.cos(a) * STEP * 2.4, ay = n.y + Math.sin(a) * STEP * 2.4;
      if (!blocked(nx, ny) && (!tip.player || !rockHit(ax, ay))) {
        chosen = { a, x: nx, y: ny };
        if (off !== 0) tip.side = Math.sign(off);
        break;
      }
    }
    if (!chosen) {
      tip.alive = false;
      const px = n.x + Math.cos(a0) * 9, py = n.y + Math.sin(a0) * 9;
      if (tip.player) {
        const rock = rockHit(px, py, 6);
        state.fx.push({ kind: 'blocked', x: px, y: py, t: 0, life: 0.9 });
        if (rock) { rock.shake = 0.35; msg('Камень! Грибница не может пройти — обойдите его', 2.2); }
      }
      return;
    }
    const w = Math.max(0.9, tip.w * 0.996);
    tip.w = w;
    tip.node = addNode(chosen.x, chosen.y, tip.node, w);
    tip.angle = chosen.a;
    tip.travelled += STEP;

    if (tip.target && dist(chosen.x, chosen.y, tip.target.x, tip.target.y) < STEP * 1.2) tip.alive = false;
    if (tip.travelled >= tip.maxTravel) tip.alive = false;

    // little side hairs make the network look alive
    tip.sinceBranch += STEP;
    if (tip.sinceBranch >= tip.nextBranch && tip.w > 1.0) {
      tip.sinceBranch = 0;
      tip.nextBranch = rr(30, 90);
      if (rand() < (tip.player ? 0.75 : 0.35)) {
        const s = rand() < 0.5 ? 1 : -1;
        addTip(tip.node, tip.angle + s * rr(0.5, 1.2), null, rr(18, tip.player ? 70 : 35), AUTO_SPEED, false);
      }
    }
  }

  function updateTips(dt) {
    for (const tip of state.tips) {
      if (!tip.alive) continue;
      tip.acc += tip.speed * dt;
      while (tip.acc >= STEP && tip.alive) { tip.acc -= STEP; stepTip(tip); }
    }
    state.tips = state.tips.filter((t) => t.alive);
  }

  // Player input: grow from the closest part of the network toward the point.
  function growToward(x, y) {
    if (y < SOIL_TOP - 6) { msg('Грибница растёт только в почве — кликайте ниже травы', 2); return null; }
    x = clamp(x, SOIL_PAD + 2, W - SOIL_PAD - 2);
    y = clamp(y, SOIL_TOP + 2, H - SOIL_PAD - 2);
    state.fx.push({ kind: 'target', x, y, t: 0, life: 0.8 });
    if (rockHit(x, y)) msg('Там камень — грибница остановится у него', 2);

    // retarget a growing tip if it is the closest thing to the click
    const { i } = nearestNode(x, y);
    let tip = state.tips.find((t) => t.player && t.node === i);
    if (tip) {
      tip.target = { x, y };
      tip.maxTravel = tip.travelled + dist(state.nodes[i].x, state.nodes[i].y, x, y) * 2.2 + 80;
    } else {
      const n = state.nodes[i];
      tip = addTip(i, Math.atan2(y - n.y, x - n.x), { x, y }, 0, PLAYER_SPEED, true);
    }
    const players = state.tips.filter((t) => t.player);
    if (players.length > MAX_PLAYER_TIPS) players[0].alive = false;
    return tip;
  }

  // ---- resource gathering
  function touchResources(nodeIdx) {
    const n = state.nodes[nodeIdx];
    for (const r of state.resources) {
      if (r.connected || r.dead || r.fade < 0) continue;
      if (dist(n.x, n.y, r.x, r.y) <= r.radius + 6) {
        r.connected = true;
        r.node = nodeIdx;
        r.path = pathToRoot(nodeIdx);
        state.fx.push({ kind: 'ring', x: r.x, y: r.y, t: 0, life: 0.8, color: RES[r.type].glow });
        if (state.collected === 0 && !state.firstTouch) {
          state.firstTouch = true;
          msg(RES[r.type].name + '! Ресурс течёт по грибнице к грибу', 2.5);
        }
      }
    }
  }

  function pathToRoot(idx) {
    const path = [];
    while (idx >= 0) { path.push(idx); idx = state.nodes[idx].parent; }
    return path;
  }

  function updateResources(dt) {
    for (const r of state.resources) {
      if (r.fade < 0) r.fade = Math.min(0, r.fade + dt * 1.5);
      if (r.dead) { r.fade += dt * 2; continue; }
      if (!r.connected) continue;
      r.timer -= dt;
      if (r.timer <= 0 && r.amount > 0) {
        r.timer = DRAIN_INTERVAL;
        r.amount--;
        state.particles.push({ type: r.type, path: r.path, i: 0, frac: 0, x: r.x, y: r.y, fromRes: true, t: 0 });
        if (r.amount === 0) r.dead = true;
      }
    }
    state.resources = state.resources.filter((r) => !(r.dead && r.fade >= 1));
  }

  function updateParticles(dt) {
    const nodes = state.nodes;
    for (const p of state.particles) {
      p.t += dt;
      if (p.fromRes) { // first hop: from the resource into the thread
        const n = nodes[p.path[0]];
        const k = Math.min(1, p.t / 0.18);
        p.x = p.x + (n.x - p.x) * k;
        p.y = p.y + (n.y - p.y) * k;
        if (k >= 1) p.fromRes = false;
        continue;
      }
      let move = FLOW_SPEED * dt;
      while (move > 0 && p.i < p.path.length - 1) {
        const a = nodes[p.path[p.i]], b = nodes[p.path[p.i + 1]];
        const len = dist(a.x, a.y, b.x, b.y) || 1;
        const left = len * (1 - p.frac);
        if (move < left) { p.frac += move / len; move = 0; } else { move -= left; p.i++; p.frac = 0; }
      }
      if (p.i >= p.path.length - 1) {
        p.done = true;
        const slot = hudSlot(p.type);
        state.flyers.push({ type: p.type, x0: ROOT.x, y0: GROUND_Y - 10, x1: slot.x, y1: slot.y, t: 0 });
        continue;
      }
      const a = nodes[p.path[p.i]], b = nodes[p.path[p.i + 1]];
      p.x = a.x + (b.x - a.x) * p.frac;
      p.y = a.y + (b.y - a.y) * p.frac;
    }
    state.particles = state.particles.filter((p) => !p.done);

    for (const f of state.flyers) {
      f.t += dt / 0.75;
      if (f.t >= 1) {
        f.done = true;
        state.counts[f.type]++;
        state.collected++;
        state.bump[f.type] = 1;
      }
    }
    state.flyers = state.flyers.filter((f) => !f.done);
    for (const t of RES_ORDER) state.bump[t] = Math.max(0, state.bump[t] - dt * 3);
  }

  // ---- mushroom
  function updateMushroom(dt) {
    state.stageAnim = Math.min(1, state.stageAnim + dt / 0.9);
    if (state.stage >= 6 || state.stageAnim < 1) return;
    const need = STAGES[state.stage];
    if (!RES_ORDER.every((t) => state.counts[t] >= need[t])) return;
    for (const t of RES_ORDER) state.counts[t] -= need[t];
    state.prevStage = state.stage;
    state.stage++;
    state.stageAnim = 0;
    for (let k = 0; k < 26; k++) {
      const a = rr(0, Math.PI * 2), s = rr(60, 220);
      state.fx.push({ kind: 'spark', x: MUSH_X, y: GROUND_Y - 40, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, life: rr(0.7, 1.3) });
    }
    if (state.stage === 6) msg('Плодоношение! Гриб полностью вырос 🍄', 6);
    else msg('Гриб растёт: стадия ' + state.stage + ' из 6', 2.5);
  }

  // ---- surface life
  function makeAnimals() {
    return {
      hedgehog: { x: 450, dir: 1, min: 390, max: 610, pause: 0 },
      rabbit: { x: 1040, y: 0, hop: -1, from: 1040, to: 1040, wait: 3, flip: true },
      robin: { x: 1150, peck: 0, wait: 2 },
      squirrel: { x: 300 },
      bluetit: { x: -200, y: 120, active: false, wait: 4, dir: 1 },
    };
  }

  function updateAnimals(dt) {
    const A = state.animals;
    const h = A.hedgehog;
    if (h.pause > 0) h.pause -= dt;
    else {
      h.x += h.dir * 22 * dt;
      if (h.x > h.max || h.x < h.min) { h.dir *= -1; h.pause = rr(1, 3); h.x = clamp(h.x, h.min, h.max); }
      else if (rand() < dt * 0.08) h.pause = rr(0.8, 2.5);
    }
    const r = A.rabbit;
    if (r.hop < 0) {
      r.wait -= dt;
      if (r.wait <= 0) {
        r.hop = 0; r.from = r.x;
        r.to = clamp(r.x + rr(-90, 90), 960, 1120);
        if (Math.abs(r.to - r.from) < 25) r.to = r.from + (r.from < 1040 ? 50 : -50);
        r.flip = r.to < r.from;
      }
    } else {
      r.hop += dt / 0.45;
      const k = Math.min(1, r.hop);
      r.x = r.from + (r.to - r.from) * k;
      r.y = -Math.sin(k * Math.PI) * 26;
      if (r.hop >= 1) { r.hop = -1; r.y = 0; r.wait = rr(2.5, 6); }
    }
    const b = A.robin;
    b.wait -= dt;
    if (b.wait <= 0) { b.peck = 1; b.wait = rr(1.2, 4); }
    b.peck = Math.max(0, b.peck - dt * 3);
    const t = A.bluetit;
    if (!t.active) {
      t.wait -= dt;
      if (t.wait <= 0) { t.active = true; t.dir = rand() < 0.5 ? 1 : -1; t.x = t.dir > 0 ? -120 : W + 120; t.baseY = rr(70, 200); }
    } else {
      t.x += t.dir * 210 * dt;
      t.y = t.baseY + Math.sin(state.t * 5) * 14;
      if (t.x > W + 150 || t.x < -150) { t.active = false; t.wait = rr(8, 16); }
    }
  }

  function makeCritters() {
    state.critters = [
      { s: 'worm', x: 250, y: H - 70, dir: 1, speed: 9, scale: 0.26 },
      { s: 'woodlouse', x: 1300, y: SOIL_TOP + 150, dir: -1, speed: 12, scale: 0.2 },
    ];
    for (const c of state.critters) { // don't start inside a rock
      for (let k = 0; k < 40 && rockHit(c.x, c.y, 40); k++) c.x = rr(80, W - 80);
    }
  }

  function updateCritters(dt) {
    for (const c of state.critters) {
      const nx = c.x + c.dir * c.speed * dt;
      const ahead = nx + c.dir * 45;
      if (rockHit(ahead, c.y, 8) || ahead < 30 || ahead > W - 30) c.dir *= -1;
      else c.x = nx;
    }
  }

  // ---- messages / fx
  function msg(text, life = 2.5) {
    state.msgs = state.msgs.filter((m) => m.text !== text);
    state.msgs.push({ text, t: 0, life });
    if (state.msgs.length > 3) state.msgs.shift();
  }

  function updateFx(dt) {
    for (const f of state.fx) {
      f.t += dt;
      if (f.kind === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; }
    }
    state.fx = state.fx.filter((f) => f.t < f.life);
    for (const m of state.msgs) m.t += dt;
    state.msgs = state.msgs.filter((m) => m.t < m.life);
    for (const r of state.rocks) if (r.shake) r.shake = Math.max(0, r.shake - dt);
  }

  // ---------------------------------------------------------------- rendering
  function buildSoil() {
    const top = GROUND_Y - 60;
    const h = H - top;
    soilCanvas = makeCanvas(W * RS, h * RS);
    const s = soilCanvas.getContext('2d');
    s.setTransform(RS, 0, 0, RS, 0, -top * RS); // draw in world coordinates

    // deep soil gradient
    const g = s.createLinearGradient(0, GROUND_Y, 0, H);
    g.addColorStop(0, '#73401f');
    g.addColorStop(0.3, '#55301a');
    g.addColorStop(1, '#22120b');
    s.fillStyle = g;
    s.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y);

    // grain, crumbs and pebbles (fixed seed so it looks the same after resize)
    const saved = seed;
    seed = 4242;
    for (let i = 0; i < 5200; i++) {
      const x = rr(0, W), y = rr(GROUND_Y + 30, H);
      const l = rr(-30, 30);
      s.fillStyle = `rgba(${120 + l},${70 + l * 0.6},${40 + l * 0.4},${rr(0.15, 0.45)})`;
      s.fillRect(x, y, rr(1, 3), rr(1, 3));
    }
    for (let i = 0; i < 140; i++) {
      const x = rr(0, W), y = rr(GROUND_Y + 60, H), rx = rr(3, 11), ry = rx * rr(0.5, 0.8);
      s.fillStyle = `rgba(${rr(50, 90)},${rr(38, 60)},${rr(30, 45)},0.85)`;
      s.beginPath(); s.ellipse(x, y, rx, ry, rr(-0.5, 0.5), 0, Math.PI * 2); s.fill();
      s.fillStyle = 'rgba(255,230,200,0.10)';
      s.beginPath(); s.ellipse(x - rx * 0.25, y - ry * 0.35, rx * 0.5, ry * 0.35, 0, 0, Math.PI * 2); s.fill();
    }
    // faint strata
    for (let i = 0; i < 9; i++) {
      const y = rr(GROUND_Y + 120, H - 20);
      s.strokeStyle = 'rgba(20,10,5,0.18)';
      s.lineWidth = rr(6, 16);
      s.beginPath();
      s.moveTo(0, y);
      for (let x = 0; x <= W; x += 80) s.lineTo(x, y + Math.sin(x * 0.006 + i) * 10);
      s.stroke();
    }

    // painted soil tiles along the grass line, faded into the deep soil
    const strip = makeCanvas(W * RS, 230 * RS);
    const st = strip.getContext('2d');
    st.setTransform(RS, 0, 0, RS, 0, 0);
    const tileScale = 0.62;
    let x = -20;
    while (x < W) {
      const im = img[pick(['soil_tile_1', 'soil_tile_2', 'soil_tile_3'])];
      const tw = im.width * tileScale, th = im.height * tileScale;
      st.drawImage(im, x, 0, tw, th);
      x += tw - 16;
    }
    st.globalCompositeOperation = 'destination-in';
    const fade = st.createLinearGradient(0, 0, 0, 230);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.4, 'rgba(0,0,0,1)');
    fade.addColorStop(0.97, 'rgba(0,0,0,0)');
    st.fillStyle = fade;
    st.fillRect(0, 0, W, 230);
    s.drawImage(strip, 0, GROUND_Y - 42, W, 230);
    seed = saved;

    // darken a bit so the glowing threads read well
    const d = s.createLinearGradient(0, GROUND_Y + 40, 0, H);
    d.addColorStop(0, 'rgba(10,4,2,0.10)');
    d.addColorStop(1, 'rgba(10,4,2,0.45)');
    s.fillStyle = d;
    s.fillRect(0, GROUND_Y + 40, W, H);
  }

  function rebuildMycelium() {
    glowCanvas = makeCanvas(W * RS, H * RS);
    coreCanvas = makeCanvas(W * RS, H * RS);
    glowCtx = glowCanvas.getContext('2d');
    coreCtx = coreCanvas.getContext('2d');
    for (const c of [glowCtx, coreCtx]) {
      c.setTransform(RS, 0, 0, RS, 0, 0);
      c.lineCap = 'round';
      c.lineJoin = 'round';
    }
    const nodes = state.nodes;
    for (let i = 1; i < nodes.length; i++) drawSegment(nodes[nodes[i].parent], nodes[i]);
  }

  // The glow is built in code: every new thread segment is stroked once into two
  // persistent layers (soft halo + bright core); each frame they are composited
  // additively with a slow "breathing" pulse.
  function drawSegment(a, b) {
    if (!glowCtx) return;
    glowCtx.shadowColor = 'rgba(255,150,40,0.9)';
    glowCtx.shadowBlur = 18 * RS;
    glowCtx.strokeStyle = 'rgba(255,140,35,0.16)';
    glowCtx.lineWidth = b.w * 6 + 4;
    glowCtx.beginPath(); glowCtx.moveTo(a.x, a.y); glowCtx.lineTo(b.x, b.y); glowCtx.stroke();

    coreCtx.shadowColor = 'rgba(255,190,80,1)';
    coreCtx.shadowBlur = 6 * RS;
    coreCtx.strokeStyle = 'rgba(255,233,160,0.95)';
    coreCtx.lineWidth = b.w;
    coreCtx.beginPath(); coreCtx.moveTo(a.x, a.y); coreCtx.lineTo(b.x, b.y); coreCtx.stroke();
    if (b.w > 1.6) { // white-hot centre on the thick threads
      coreCtx.shadowBlur = 0;
      coreCtx.strokeStyle = 'rgba(255,255,235,0.8)';
      coreCtx.lineWidth = b.w * 0.4;
      coreCtx.beginPath(); coreCtx.moveTo(a.x, a.y); coreCtx.lineTo(b.x, b.y); coreCtx.stroke();
    }
  }

  function glowDot(x, y, r, rgb, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,240,${a})`);
    g.addColorStop(0.25, `rgba(${rgb},${a * 0.8})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawBackground() {
    const bg = img.background;
    const srcH = 800; // source rows above the painted soil strip
    const scale = W / bg.width;
    const dh = srcH * scale;
    ctx.drawImage(bg, 0, 0, bg.width, srcH, 0, GROUND_Y + 14 - dh, W, dh);
    // soft sun rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = 380 + i * 260 + Math.sin(state.t * 0.2 + i) * 30;
      const a = 0.045 + 0.025 * Math.sin(state.t * 0.5 + i * 1.7);
      const g = ctx.createLinearGradient(x, 0, x - 160, GROUND_Y);
      g.addColorStop(0, `rgba(255,240,180,${a})`);
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 30, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x - 120, GROUND_Y); ctx.lineTo(x - 260, GROUND_Y);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawUnderground() {
    ctx.drawImage(soilCanvas, 0, GROUND_Y - 60, W, H - (GROUND_Y - 60));
    // tree roots (decor)
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawSprite(ctx, img.roots_stump, 200, GROUND_Y + 12 + 284 * 0.62, 0.62);
    drawSprite(ctx, img.roots_long, 1270, GROUND_Y + 20 + 228 * 0.5, 0.5, true);
    drawSprite(ctx, img.roots_turf, 1490, GROUND_Y + 4 + 261 * 0.52, 0.52);
    ctx.restore();
    for (const c of state.critters) {
      const im = img[c.s];
      const wig = Math.sin(state.t * 4 + c.x * 0.05) * 0.03;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(c.x, c.y);
      ctx.scale(c.dir < 0 ? -1 : 1, 1);
      ctx.scale(1 + wig, 1 - wig);
      ctx.drawImage(im, -im.width * c.scale / 2, -im.height * c.scale / 2, im.width * c.scale, im.height * c.scale);
      ctx.restore();
    }
    for (const r of state.rocks) {
      const sh = r.shake ? Math.sin(r.shake * 70) * r.shake * 8 : 0;
      drawSprite(ctx, img[r.s], r.x + sh, r.bottom, r.scale, r.flip);
    }
  }

  function drawResources() {
    for (const r of state.resources) {
      const im = img[r.s];
      const vis = r.fade < 0 ? 1 + r.fade : (r.dead ? 1 - r.fade : 1);
      const left = r.dead ? 0.3 : 0.55 + 0.45 * (r.amount / r.total);
      const bob = Math.sin(state.t * 1.6 + r.phase) * 2.5;
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 3 + r.phase);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(r.x, r.y + bob, r.size * (r.connected ? 1.1 + pulse * 0.25 : 0.8), RES[r.type].glow,
        (r.connected ? 0.45 : 0.18 + pulse * 0.08) * vis);
      ctx.restore();
      const sc = (r.size / Math.max(im.width, im.height)) * left;
      drawSprite(ctx, im, r.x, r.y + bob + im.height * sc / 2, sc, false, vis);
      if (!r.connected && !r.dead && vis > 0.9) { // glint
        const k = (state.t * 0.6 + r.phase) % 3;
        if (k < 0.4) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          glowDot(r.x + r.size * 0.2, r.y - r.size * 0.25 + bob, 10 * Math.sin(k / 0.4 * Math.PI), '255,255,255', 0.8);
          ctx.restore();
        }
      }
    }
  }

  function drawMycelium() {
    const t = state.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.setTransform(1, 0, 0, 1, 0, 0); // offscreen layers are already in backing pixels
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 1.3);
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 2.1 + 1);
    ctx.drawImage(coreCanvas, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // links from connected resources to the thread
    for (const r of state.resources) {
      if (!r.connected || r.dead) continue;
      const n = state.nodes[r.node];
      ctx.strokeStyle = `rgba(${RES[r.type].glow},0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
    // the knot under the mushroom
    glowDot(ROOT.x, ROOT.y, 34 + Math.sin(t * 2) * 5, '255,170,50', 0.55);
    // growing tips
    for (const tip of state.tips) {
      const n = state.nodes[tip.node];
      const big = tip.player ? 16 : 7;
      glowDot(n.x, n.y, big + Math.sin(t * 9 + tip.born) * 2.5, '255,190,70', tip.player ? 0.95 : 0.6);
    }
    // resource units flowing to the mushroom
    for (const p of state.particles) {
      glowDot(p.x, p.y, 11, RES[p.type].glow, 0.95);
    }
    ctx.restore();
  }

  function drawSurface() {
    const t = state.t;
    // back row
    drawSprite(ctx, img.spruce, 1500, GROUND_Y + 14, 0.74);
    drawSprite(ctx, img.birch, 1275, GROUND_Y + 12, 0.62);
    drawSprite(ctx, img.oak, 205, GROUND_Y + 14, 0.74);
    drawSprite(ctx, img.bush_berries, 530, GROUND_Y + 12, 0.36);
    drawSprite(ctx, img.fern_2, 1120, GROUND_Y + 12, 0.34, true);
    drawSprite(ctx, img.bush_flowers, 1380, GROUND_Y + 14, 0.34);

    const A = state.animals;
    drawSprite(ctx, img.squirrel, A.squirrel.x, GROUND_Y + 12, 0.24, false, 1, Math.sin(t * 1.4) * 0.015);
    const h = A.hedgehog;
    const step = h.pause > 0 ? 0 : Math.abs(Math.sin(t * 9)) * 2;
    drawSprite(ctx, img.hedgehog, h.x, GROUND_Y + 12 - step, 0.27, h.dir < 0);
    const r = A.rabbit;
    drawSprite(ctx, img.rabbit, r.x, GROUND_Y + 12 + r.y, 0.27, r.flip);
    const b = A.robin;
    drawSprite(ctx, img.robin, b.x, GROUND_Y + 12, 0.22, true, 1, Math.sin(b.peck * Math.PI) * 0.35);

    drawMushroom();

    // front plants
    drawSprite(ctx, img.fern_1, 640, GROUND_Y + 16, 0.3);
    drawSprite(ctx, img.daisies, 700, GROUND_Y + 16, 0.28);
    drawSprite(ctx, img.bluebells, 905, GROUND_Y + 16, 0.3);
    drawSprite(ctx, img.buttercups, 965, GROUND_Y + 16, 0.28);
    drawSprite(ctx, img.grass_1, 400, GROUND_Y + 18, 0.26);
    drawSprite(ctx, img.grass_2, 1200, GROUND_Y + 18, 0.26);
    drawSprite(ctx, img.grass_3, 760, GROUND_Y + 18, 0.24);
    drawSprite(ctx, img.grass_3, 850, GROUND_Y + 18, 0.24, true);
    drawSprite(ctx, img.grass_1, 60, GROUND_Y + 18, 0.24, true);
    drawSprite(ctx, img.grass_2, 1580, GROUND_Y + 18, 0.24);

    const bt = A.bluetit;
    if (bt.active) {
      drawSprite(ctx, img.bluetit, bt.x, bt.y, 0.22, bt.dir < 0, 1, Math.sin(t * 14) * 0.06);
    }
  }

  function drawMushroom() {
    const base = GROUND_Y + 14;
    const t = state.t;
    if (state.stage === 0) { // a faint glowing bump: something is waking up
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(MUSH_X, GROUND_Y + 2, 26 + Math.sin(t * 2.5) * 5, '255,190,80', 0.5);
      ctx.restore();
      return;
    }
    const k = state.stageAnim;
    const sway = Math.sin(t * 1.1) * 0.012;
    if (k < 1 && state.prevStage > 0) {
      drawSprite(ctx, img['mushroom_' + state.prevStage], MUSH_X, base, MUSH_SCALE, false, 1 - k, sway);
    }
    const s = MUSH_SCALE * (k < 1 ? 0.6 + 0.4 * easeOutBack(k) : 1);
    const squash = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.06 : 1;
    ctx.save();
    ctx.translate(MUSH_X, base);
    ctx.scale(squash, 1 / squash);
    drawSprite(ctx, img['mushroom_' + state.stage], 0, 0, s, false, Math.min(1, k * 2 + 0.2), sway);
    ctx.restore();
    if (state.stage === 6) { // gentle spore shimmer once fully grown
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const p = (t * 0.25 + i / 6) % 1;
        glowDot(MUSH_X + Math.sin(i * 2.3 + t) * 80 * p, base - 200 - p * 140, 6 * (1 - p), '255,220,150', 0.8);
      }
      ctx.restore();
    }
  }

  function drawFx() {
    ctx.save();
    for (const f of state.fx) {
      const k = f.t / f.life;
      if (f.kind === 'target') {
        ctx.strokeStyle = `rgba(255,220,140,${(1 - k) * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 22, 0, Math.PI * 2); ctx.stroke();
      } else if (f.kind === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${f.color},${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, 10 + k * 50, 0, Math.PI * 2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'blocked') {
        ctx.fillStyle = `rgba(255,90,60,${(1 - k) * 0.7})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,230,210,${1 - k})`;
        ctx.lineWidth = 3;
        const s = 7;
        ctx.beginPath();
        ctx.moveTo(f.x - s, f.y - s); ctx.lineTo(f.x + s, f.y + s);
        ctx.moveTo(f.x + s, f.y - s); ctx.lineTo(f.x - s, f.y + s);
        ctx.stroke();
      } else if (f.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        glowDot(f.x, f.y, 9 * (1 - k) + 2, '255,210,110', 1 - k);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
    // units flying from the mushroom to the counter
    for (const f of state.flyers) {
      const k = f.t, e = k * k * (3 - 2 * k);
      const x = f.x0 + (f.x1 - f.x0) * e;
      const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 90;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowDot(x, y, 13, RES[f.type].glow, 0.9);
      ctx.restore();
      const im = img[RES[f.type].sprite];
      const sc = 22 / Math.max(im.width, im.height);
      drawSprite(ctx, im, x, y + im.height * sc / 2, sc);
    }
  }

  // ---- HUD
  const HUD = { x: 800, y: 14, w: 600, h: 58 };
  function hudSlot(type) {
    const i = RES_ORDER.indexOf(type);
    return { x: HUD.x - HUD.w / 2 + 34 + i * (HUD.w / 4), y: HUD.y + HUD.h / 2 };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function panel(x, y, w, h, r = 16) {
    ctx.save();
    roundRect(x, y, w, h, r);
    ctx.fillStyle = 'rgba(28,18,12,0.78)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,163,82,0.85)';
    ctx.stroke();
    ctx.restore();
  }

  function text(str, x, y, size, color = '#f7e8c6', align = 'left', weight = 700) {
    ctx.font = `${weight} ${size}px "Trebuchet MS", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,10,5,0.75)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawHud() {
    // resource counters
    panel(HUD.x - HUD.w / 2, HUD.y, HUD.w, HUD.h, 28);
    for (const t of RES_ORDER) {
      const slot = hudSlot(t);
      const im = img[RES[t].sprite];
      const bump = state.bump[t];
      const sc = (34 / Math.max(im.width, im.height)) * (1 + bump * 0.35);
      drawSprite(ctx, im, slot.x, slot.y + im.height * sc / 2, sc);
      text(String(state.counts[t]), slot.x + 26, slot.y + 1, 26 + bump * 6, bump > 0.1 ? RES[t].color : '#f7e8c6');
      text(RES[t].name, slot.x + 27, slot.y + 22, 11, 'rgba(247,232,198,0.7)', 'left', 600);
    }

    // mushroom goal
    const px = W - 300, py = 14, pw = 286, ph = 150;
    panel(px, py, pw, ph);
    const st = state.stage;
    const icon = img['mushroom_' + Math.max(1, Math.min(6, st + 1))];
    const isc = 64 / icon.height;
    drawSprite(ctx, icon, px + 46, py + 82, isc, false, st >= 6 ? 1 : 0.95);
    if (st >= 6) {
      text('Гриб вырос!', px + 90, py + 34, 22, '#ffd27a');
      text('Плодоношение 6/6', px + 90, py + 62, 16, '#f7e8c6', 'left', 600);
      text('Грибница продолжает', px + 90, py + 92, 14, 'rgba(247,232,198,0.8)', 'left', 600);
      text('собирать ресурсы', px + 90, py + 112, 14, 'rgba(247,232,198,0.8)', 'left', 600);
    } else {
      text('Гриб: стадия ' + st + '/6', px + 90, py + 26, 19, '#ffd27a');
      text('Нужно для стадии ' + (st + 1) + ':', px + 90, py + 50, 13, 'rgba(247,232,198,0.8)', 'left', 600);
      const need = STAGES[st];
      let i = 0, have = 0, total = 0;
      for (const t of RES_ORDER) {
        if (!need[t]) continue;
        const ix = px + 92 + (i % 2) * 96, iy = py + 76 + Math.floor(i / 2) * 28;
        const im = img[RES[t].sprite];
        const sc = 20 / Math.max(im.width, im.height);
        drawSprite(ctx, im, ix, iy + im.height * sc / 2, sc);
        const ok = state.counts[t] >= need[t];
        text(Math.min(state.counts[t], need[t]) + '/' + need[t], ix + 16, iy + 1, 16, ok ? '#9be86b' : '#f7e8c6');
        have += Math.min(state.counts[t], need[t]);
        total += need[t];
        i++;
      }
      // progress bar
      const bx = px + 16, by = py + ph - 22, bw = pw - 32, bh = 10;
      roundRect(bx, by, bw, bh, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
      const k = total ? have / total : 0;
      if (k > 0) {
        roundRect(bx, by, Math.max(bh, bw * k), bh, 5);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, '#f0a43a'); g.addColorStop(1, '#ffe08a');
        ctx.fillStyle = g; ctx.fill();
      }
    }

    // messages
    let y = HUD.y + HUD.h + 30;
    for (const m of state.msgs) {
      const a = Math.min(1, m.t * 4, (m.life - m.t) * 2);
      ctx.save();
      ctx.globalAlpha = a;
      text(m.text, W / 2, y, 21, '#fff1cf', 'center');
      ctx.restore();
      y += 30;
    }

    // controls hint
    ctx.save();
    ctx.globalAlpha = 0.75;
    text('ЛКМ / тап по почве — расти туда · удерживайте и ведите — управлять ростом · R — новая карта',
      W / 2, H - 16, 14, '#f7e8c6', 'center', 600);
    ctx.restore();
  }

  function drawCursor() {
    const p = state.pointer;
    if (!p || p.y < SOIL_TOP) return;
    const { i } = nearestNode(p.x, p.y);
    if (i < 0) return;
    const n = state.nodes[i];
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.lineDashOffset = -state.t * 30;
    const onRock = rockHit(p.x, p.y);
    ctx.strokeStyle = onRock ? 'rgba(255,120,90,0.55)' : 'rgba(255,225,150,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawBackground();
    drawUnderground();
    drawResources();
    drawMycelium();
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    drawSurface();
    drawCursor();
    drawFx();
    drawHud();
  }

  // ---------------------------------------------------------------- loop & input
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    state.t += dt;
    if (state.pointer && state.pointer.down && state.activeTip && state.activeTip.alive) {
      // dragging steers the tip that was started by this press
      const p = state.pointer;
      if (p.y >= SOIL_TOP) {
        const tip = state.activeTip;
        tip.target = { x: clamp(p.x, SOIL_PAD + 2, W - SOIL_PAD - 2), y: p.y };
        tip.maxTravel = tip.travelled + 400;
      }
    }
    updateTips(dt);
    updateResources(dt);
    updateParticles(dt);
    updateMushroom(dt);
    updateAnimals(dt);
    updateCritters(dt);
    updateFx(dt);
    respawn(dt);
  }

  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * W,
      y: (e.clientY - rect.top) / rect.height * H,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toWorld(e);
    state.pointer = { ...p, down: true };
    state.activeTip = growToward(p.x, p.y);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toWorld(e);
    state.pointer = { ...p, down: state.pointer ? state.pointer.down : false };
    canvas.style.cursor = p.y >= SOIL_TOP ? 'crosshair' : 'default';
  });
  const up = () => { if (state.pointer) state.pointer.down = false; state.activeTip = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (state.pointer && !state.pointer.down) state.pointer = null; });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') restart();
  });
  window.addEventListener('resize', resize);

  function restart() {
    grid.clear();
    newWorld();
    rebuildMycelium();
  }

  loadSprites().then(() => {
    document.getElementById('loading').remove();
    resize();
    newWorld();
    buildSoil();
    rebuildMycelium();
    // the starting knot was created before the layers existed: draw it now
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }).catch((err) => {
    document.getElementById('loading').textContent =
      err.message + '. Запустите игру через локальный сервер (см. README).';
    console.error(err);
  });

  // handy for debugging / automated tests in the console
  window.mycelium = {
    get state() { return state; }, growToward, W, H, GROUND_Y, SOIL_TOP,
  };
})();

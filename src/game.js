/* Mycelium Forest — prototype v2.
 *
 * Core loop: click the soil -> the mycelium grows toward the click, rocks block it,
 * touching a resource drains it along the network into the counters, and the
 * collected resources grow mushrooms on the surface through 6 stages.
 *
 * v2 adds: levels with goals and stars, dangers (grubs bite threads underground,
 * hedgehog and rabbit eat mushrooms, the squirrel steals them) and reproduction
 * (a ripe mushroom releases spores that start a new colony elsewhere).
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
  const ROOT_DY = 26;              // depth of a colony knot under its mushroom
  const START_X = 800;

  const STEP = 5;                  // px per mycelium node
  const PLAYER_SPEED = 75;         // px / s of a tip the player steers
  const AUTO_SPEED = 40;           // px / s of small side branches
  const MAX_PLAYER_TIPS = 4;
  const MAX_SLIDE = 0.8;           // rad: how far a tip may bend to slide along a rock
  const DRAIN_INTERVAL = 0.4;      // s between units pulled from a connected resource
  const FLOW_SPEED = 340;          // px / s of a resource unit travelling to the mushroom
  const MUSH_SCALE = 0.5;
  const RIPE = 6;                  // last mushroom stage
  const MIN_EDIBLE = 2;            // animals only go for mushrooms at this stage or older
  const SPORE_DROP_TO = 4;         // a mushroom falls back to this stage after releasing spores
  const COLONY_GAP = 130;          // min distance between two mushrooms
  const GRUB_SAFE_DEPTH = 22;
  const CHEW_TIME = 2.2;           // s a grub chews before the thread snaps      // grubs never bite this close (in nodes) to a colony knot

  const RES = {
    water:   { name: 'Вода',     sprite: 'water_drop', color: '#62cbff', glow: '98,203,255' },
    organic: { name: 'Органика', sprite: 'leaf',       color: '#9ad957', glow: '154,217,87' },
    mineral: { name: 'Минералы', sprite: 'crystal',    color: '#b9a2ff', glow: '185,162,255' },
    sugar:   { name: 'Сахар',    sprite: 'sugar',      color: '#ffc53d', glow: '255,197,61' },
  };
  const RES_ORDER = ['water', 'organic', 'mineral', 'sugar'];

  // What a mushroom needs to go from stage i to stage i+1 (spent from the shared stock).
  const STAGES = [
    { water: 1, organic: 1, mineral: 0, sugar: 0 },
    { water: 2, organic: 1, mineral: 1, sugar: 0 },
    { water: 2, organic: 2, mineral: 1, sugar: 1 },
    { water: 3, organic: 2, mineral: 2, sugar: 1 },
    { water: 3, organic: 3, mineral: 2, sugar: 2 },
    { water: 4, organic: 3, mineral: 3, sugar: 2 },
  ];

  const ANIMAL_INFO = {
    hedgehog: { name: 'Ёж', scale: 0.27, speed: 40, eat: 3.6, home: 470, verb: 'съел' },
    rabbit:   { name: 'Заяц', scale: 0.27, speed: 62, eat: 3.0, home: 1040, verb: 'съел' },
    squirrel: { name: 'Белка', scale: 0.24, speed: 95, eat: 1.8, home: 300, verb: 'украла' },
  };

  const LEVELS = [
    {
      name: 'Пробуждение',
      text: 'Грибница проснулась. Растите нити к ресурсам и вырастите первый гриб.',
      goal: { ripeNow: 1 },
      seed: 11, rocks: 7, pools: 1, cap: 16,
      plan: { water: 4, organic: 4, mineral: 3, sugar: 3 },
      maxColonies: 1, grubs: null, eaters: [], par: 90,
    },
    {
      name: 'Споры',
      text: 'Зрелый гриб может размножаться: кликните по нему, а потом по месту на поверхности — туда полетят споры, и там появится новая колония.',
      goal: { colonies: 3 },
      seed: 22, rocks: 9, pools: 1, cap: 16,
      plan: { water: 5, organic: 4, mineral: 3, sugar: 3 },
      maxColonies: 4, grubs: null, eaters: [], par: 170,
    },
    {
      name: 'Личинки',
      text: 'В почве завелись личинки: они ползут к нитям и перегрызают их, отрезанная часть засыхает. Кликайте по личинке, чтобы прогнать её.',
      goal: { ripeNow: 2 },
      seed: 33, rocks: 10, pools: 1, cap: 15,
      plan: { water: 5, organic: 4, mineral: 4, sugar: 3 },
      maxColonies: 3, grubs: { every: [11, 16], max: 2 }, eaters: [], par: 200,
    },
    {
      name: 'Голодные звери',
      text: 'Ёж и заяц обожают грибы! Когда зверь идёт к грибу, над ним загорается «!». Кликните по зверю, чтобы спугнуть его, пока он не съел гриб.',
      goal: { colonies: 3, ripeNow: 2 },
      seed: 44, rocks: 11, pools: 1, cap: 15,
      plan: { water: 5, organic: 5, mineral: 4, sugar: 3 },
      maxColonies: 4, grubs: { every: [16, 22], max: 2 },
      eaters: ['hedgehog', 'rabbit'], attackEvery: [14, 22], par: 260,
    },
    {
      name: 'Белка-воришка',
      text: 'Белка быстро хватает гриб и уносит его. Звери, личинки, тяжёлая каменистая почва — вырастите три зрелых гриба одновременно.',
      goal: { ripeNow: 3 },
      seed: 55, rocks: 14, pools: 1, cap: 13,
      plan: { water: 5, organic: 4, mineral: 4, sugar: 3 },
      maxColonies: 4, grubs: { every: [10, 15], max: 3 },
      eaters: ['hedgehog', 'rabbit', 'squirrel'], attackEvery: [11, 17], par: 330,
    },
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
    'worm', 'woodlouse', 'grub',
  ];

  // ---------------------------------------------------------------- helpers
  let seed = 1;
  function rand() { // mulberry32 — seeded so every level has the same layout
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
  function drawSprite(c, im, x, bottom, scale, flip = false, alpha = 1, rot = 0) {
    const w = im.width * scale;
    const h = im.height * scale;
    c.save();
    c.globalAlpha *= alpha;
    c.translate(x, bottom);
    if (rot) c.rotate(rot);
    if (flip) c.scale(-1, 1);
    c.drawImage(im, -w / 2, -h, w, h);
    c.restore();
  }

  // ---------------------------------------------------------------- progress (per browser)
  const SAVE_KEY = 'mycelium-forest-progress-v1';
  let progress = { unlocked: 1, stars: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved && saved.unlocked) progress = saved;
  } catch (e) { /* storage unavailable: progress lives for this visit only */ }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
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
  let mode = 'menu';        // menu | intro | play | won
  let levelIndex = 0;
  const grid = new Map();   // spatial hash of node indices, 40px cells
  const cellKey = (x, y) => (Math.floor(x / 40) << 16) ^ Math.floor(y / 40);

  function newWorld(li) {
    levelIndex = li;
    const L = LEVELS[li];
    seed = L.seed;
    grid.clear();
    state = {
      L,
      t: 0,
      time: 0,
      nodes: [],          // {x, y, parent, w, depth, children, dead}
      tips: [],
      rocks: [],
      resources: [],
      particles: [],      // units flowing through the mycelium
      flyers: [],         // units flying from a mushroom to the counter
      fx: [],
      withering: [],      // bitten-off thread segments fading out
      msgs: [],
      counts: { water: 0, organic: 0, mineral: 0, sugar: 0 },
      bump: { water: 0, organic: 0, mineral: 0, sugar: 0 },
      mushrooms: [],
      growCooldown: 0,
      respawnTimer: 4,
      pointer: null,
      activeTip: null,
      sporeFrom: null,    // mushroom whose spores the player is aiming
      spores: [],         // spore clouds in flight
      animals: makeAnimals(L),
      attackTimer: L.attackEvery ? rr(L.attackEvery[0], L.attackEvery[1]) : 0,
      grubs: [],
      grubTimer: L.grubs ? rr(6, 9) : 0,
      critters: [],
      needRebuild: false,
      lost: 0,            // mushrooms eaten or stolen (for the result screen)
      ripened: 0,
      bluetit: { x: -200, y: 120, active: false, wait: 4, dir: 1 },
      robin: { x: 1150, peck: 0, wait: 2 },
      result: null,
    };
    makeRocks(L.rocks);
    newColony(START_X, true);
    makeResources(L);
    makeCritters();
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

  function makeRocks(count) {
    const kinds = [
      { s: 'rock_mossy', w: [150, 230] },
      { s: 'rock_mossy', w: [120, 190] },
      { s: 'rock_1', w: [130, 200] },
      { s: 'rock_2', w: [120, 180] },
      { s: 'rock_3', w: [100, 150] },
      { s: 'rock_4', w: [80, 120] },
    ];
    let tries = 0;
    while (state.rocks.length < count && tries++ < 900) {
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
      if (dist(x, y, START_X, GROUND_Y + 60) < 190) continue;
      if (state.rocks.some((o) => dist(o.cx, o.cy, rock.cx, rock.cy) < (o.rx + rock.rx) * 0.9 + 30)) continue;
      state.rocks.push(rock);
    }
  }

  // ---- resources
  function resourceSprite(type, big) {
    if (type === 'water' && big) return { s: 'water_pool', size: 92, amount: 6 };
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
      const x = opts.near ? START_X + Math.cos(a) * d * 1.4 : rr(60, W - 60);
      const y = opts.near ? GROUND_Y + ROOT_DY + Math.sin(a) * d : rr(SOIL_TOP + 40, H - 40);
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

  function makeResources(L) {
    // a gentle start: something to grab right next to the first knot
    placeResource('water', { near: [110, 170] });
    placeResource('organic', { near: [110, 170] });
    for (let i = 0; i < L.pools; i++) placeResource('water', { big: true });
    for (const t of RES_ORDER) for (let i = 0; i < L.plan[t]; i++) placeResource(t);
  }

  // Keep the soil stocked with whatever the mushrooms are shortest of.
  function respawn(dt) {
    state.respawnTimer -= dt;
    if (state.respawnTimer > 0) return;
    state.respawnTimer = 3.5;
    const alive = state.resources.filter((r) => !r.dead);
    if (alive.length >= state.L.cap) return;
    const m = growthTarget();
    const need = m ? STAGES[m.stage] : { water: 1, organic: 1, mineral: 1, sugar: 1 };
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
  function addNode(x, y, parent, w) {
    const idx = state.nodes.length;
    const p = parent >= 0 ? state.nodes[parent] : null;
    state.nodes.push({ x, y, parent, w, depth: p ? p.depth + 1 : 0, children: [], dead: false });
    if (p) p.children.push(idx);
    const k = cellKey(x, y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(idx);
    if (p) drawSegment(p, state.nodes[idx]);
    touchResources(idx);
    return idx;
  }

  function nearestNode(x, y) {
    let best = -1, bd = Infinity;
    const cx = Math.floor(x / 40), cy = Math.floor(y / 40);
    const scan = (ring, full) => {
      for (let gx = cx - ring; gx <= cx + ring; gx++) {
        for (let gy = cy - ring; gy <= cy + ring; gy++) {
          if (!full && Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== ring) continue;
          const list = grid.get((gx << 16) ^ gy);
          if (!list) continue;
          for (const i of list) {
            const n = state.nodes[i];
            if (n.dead) continue;
            const d = dist(n.x, n.y, x, y);
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
    };
    for (let ring = 0; ring < 50; ring++) {
      scan(ring, false);
      if (best >= 0) { scan(ring + 1, true); break; } // one more ring guarantees the true nearest
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
    if (n.dead) { tip.alive = false; return; }
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
    x = clamp(x, SOIL_PAD + 2, W - SOIL_PAD - 2);
    y = clamp(y, SOIL_TOP + 2, H - SOIL_PAD - 2);
    const { i } = nearestNode(x, y);
    if (i < 0) return null;
    state.fx.push({ kind: 'target', x, y, t: 0, life: 0.8 });
    if (rockHit(x, y)) msg('Там камень — грибница остановится у него', 2);

    // retarget a growing tip if it is the closest thing to the click
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

  // A grub bit through node i: it and everything grown from it dries up.
  function killSubtree(i) {
    const killed = new Set();
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      const n = state.nodes[k];
      if (n.dead) continue;
      n.dead = true;
      killed.add(k);
      if (n.parent >= 0) state.withering.push({ a: state.nodes[n.parent], b: n, t: 0 });
      for (const c of n.children) stack.push(c);
    }
    const p = state.nodes[i].parent;
    if (p >= 0) state.nodes[p].children = state.nodes[p].children.filter((c) => c !== i);
    for (const r of state.resources) {
      if (r.connected && killed.has(r.node)) { r.connected = false; r.node = -1; r.path = null; }
    }
    state.particles = state.particles.filter((pt) => !pt.path.some((k) => killed.has(k)));
    state.tips = state.tips.filter((t) => !killed.has(t.node));
    state.needRebuild = true;
    return killed.size;
  }

  // ---- colonies & mushrooms
  function newColony(x, first) {
    const root = addNode(x, GROUND_Y + ROOT_DY, -1, 3.6);
    for (const a of [Math.PI / 2, Math.PI / 2 + 0.9, Math.PI / 2 - 0.9]) {
      addTip(root, a, null, rr(35, 55), AUTO_SPEED, false);
    }
    const m = { x, root, stage: 0, prevStage: 0, anim: 1, hurt: 0, born: state.t, first: !!first };
    state.mushrooms.push(m);
    return m;
  }

  function mushroomBox(m) {
    const im = img['mushroom_' + Math.max(1, m.stage)];
    const w = im.width * MUSH_SCALE, h = im.height * MUSH_SCALE;
    return { x: m.x - w / 2, y: GROUND_Y + 14 - h, w, h };
  }

  // Stock goes to the most advanced unripe mushroom first, so ripe ones come quickly.
  function growthTarget() {
    let best = null;
    for (const m of state.mushrooms) {
      if (m.stage >= RIPE || m.carried) continue;
      if (!best || m.stage > best.stage) best = m;
    }
    return best;
  }

  const canSpore = () => state.mushrooms.length < state.L.maxColonies;

  function updateMushrooms(dt) {
    for (const m of state.mushrooms) {
      m.anim = Math.min(1, m.anim + dt / 0.9);
      m.hurt = Math.max(0, m.hurt - dt);
    }
    state.growCooldown -= dt;
    if (state.growCooldown > 0) return;
    const m = growthTarget();
    if (!m) return;
    const need = STAGES[m.stage];
    if (!RES_ORDER.every((t) => state.counts[t] >= need[t])) return;
    for (const t of RES_ORDER) state.counts[t] -= need[t];
    m.prevStage = m.stage;
    m.stage++;
    m.anim = 0;
    state.growCooldown = 0.9;
    burst(m.x, GROUND_Y - 30, '255,210,110', 22);
    if (m.stage === RIPE) {
      state.ripened++;
      msg(canSpore() ? 'Гриб созрел! Кликните по нему, чтобы выпустить споры' : 'Гриб созрел!', 4);
    }
  }

  function burst(x, y, rgb, n) {
    for (let k = 0; k < n; k++) {
      const a = rr(0, Math.PI * 2), s = rr(60, 220);
      state.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, life: rr(0.7, 1.3), rgb });
    }
  }

  function loseMushroom(m, who) {
    state.lost++;
    m.prevStage = 0;
    m.stage = 0;
    m.anim = 1;
    m.hurt = 1;
    burst(m.x, GROUND_Y - 20, '200,120,60', 18);
    msg(ANIMAL_INFO[who].name + ' ' + ANIMAL_INFO[who].verb + ' гриб! Грибница вырастит новый', 3);
  }

  function sporeSpotProblem(x) {
    if (x < 70 || x > W - 70) return 'Слишком близко к краю';
    if (state.mushrooms.some((m) => Math.abs(m.x - x) < COLONY_GAP)) return 'Слишком близко к другому грибу';
    if (rockHit(x, GROUND_Y + ROOT_DY, 14)) return 'Под этим местом камень';
    return null;
  }

  function releaseSpores(m, x) {
    m.prevStage = m.stage;
    m.stage = SPORE_DROP_TO;
    m.anim = 0.4;
    const cloud = { x0: m.x, y0: GROUND_Y - 150, x1: x, t: 0, dots: [] };
    for (let i = 0; i < 26; i++) cloud.dots.push({ ox: rr(-30, 30), oy: rr(-24, 24), ph: rr(0, 6) });
    state.spores.push(cloud);
    msg('Споры летят!', 2);
  }

  function updateSpores(dt) {
    for (const c of state.spores) {
      c.t += dt / 1.6;
      if (c.t >= 1) {
        c.done = true;
        newColony(c.x1);
        burst(c.x1, GROUND_Y, '210,160,255', 16);
        msg('Новая колония! Теперь растите и её', 2.5);
      }
    }
    state.spores = state.spores.filter((c) => !c.done);
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
        const root = nodes[p.path[p.path.length - 1]];
        const slot = hudSlot(p.type);
        state.flyers.push({ type: p.type, x0: root.x, y0: GROUND_Y - 10, x1: slot.x, y1: slot.y, t: 0 });
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
        state.bump[f.type] = 1;
      }
    }
    state.flyers = state.flyers.filter((f) => !f.done);
    for (const t of RES_ORDER) state.bump[t] = Math.max(0, state.bump[t] - dt * 3);
  }

  // ---- surface animals (ambient, or threats on later levels)
  function makeAnimals(L) {
    const list = [];
    for (const kind of ['hedgehog', 'rabbit', 'squirrel']) {
      const info = ANIMAL_INFO[kind];
      list.push({
        kind, info, threat: L.eaters.includes(kind),
        x: info.home, y: 0, dir: kind === 'squirrel' ? 1 : (kind === 'rabbit' ? -1 : 1),
        state: 'idle', timer: rr(1, 3), target: null, eatT: 0, carrying: 0,
        hop: 0, walkT: 0,
      });
    }
    return list;
  }

  function moveToward(a, tx, speed, dt) {
    const d = tx - a.x;
    if (Math.abs(d) < 2) return true;
    a.dir = Math.sign(d);
    a.x += a.dir * Math.min(Math.abs(d), speed * dt);
    a.walkT += dt;
    return false;
  }

  function animalBox(a) {
    const im = img[a.kind];
    const w = im.width * a.info.scale, h = im.height * a.info.scale;
    return { x: a.x - w / 2, y: GROUND_Y + 12 + a.y - h, w, h };
  }

  function scareAnimal(a) {
    a.state = 'flee';
    a.target = null;
    a.dir = a.x < W / 2 ? -1 : 1;
    burst(a.x, GROUND_Y - 30, '255,240,200', 8);
    msg(a.info.name + ' убегает!', 1.6);
  }

  function updateAnimals(dt) {
    for (const a of state.animals) {
      const valid = a.target && state.mushrooms.includes(a.target) && a.target.stage >= MIN_EDIBLE;
      switch (a.state) {
        case 'idle': ambientAnimal(a, dt); break;
        case 'approach': {
          if (!valid) { a.state = 'return'; break; }
          const side = a.x < a.target.x ? -1 : 1;
          if (moveToward(a, a.target.x + side * 46, a.info.speed, dt)) {
            a.state = 'eat'; a.eatT = 0; a.dir = -side;
          }
          a.y = a.kind === 'rabbit' ? -Math.abs(Math.sin(a.walkT * 7)) * 18 : 0;
          break;
        }
        case 'eat':
          a.y = 0;
          if (!valid) { a.state = 'return'; break; }
          a.eatT += dt;
          if (a.eatT >= a.info.eat) {
            if (a.kind === 'squirrel') {
              a.carrying = a.target.stage;
              loseMushroom(a.target, a.kind);
              a.state = 'carry';
              a.dir = a.x < W / 2 ? -1 : 1;
            } else {
              loseMushroom(a.target, a.kind);
              a.state = 'return';
            }
            a.target = null;
          }
          break;
        case 'flee':
        case 'carry':
          a.x += a.dir * (a.state === 'flee' ? 330 : 220) * dt;
          a.walkT += dt;
          a.y = a.kind === 'rabbit' ? -Math.abs(Math.sin(a.walkT * 9)) * 22 : 0;
          if (a.x < -120 || a.x > W + 120) { a.state = 'away'; a.timer = rr(5, 9); a.carrying = 0; }
          break;
        case 'away':
          a.timer -= dt;
          if (a.timer <= 0) a.state = 'return';
          break;
        case 'return':
          a.y = a.kind === 'rabbit' ? -Math.abs(Math.sin(a.walkT * 7)) * 18 : 0;
          if (moveToward(a, a.info.home, a.info.speed * 0.8, dt)) { a.state = 'idle'; a.y = 0; a.timer = rr(1, 3); }
          break;
      }
    }
    if (!state.L.attackEvery) return;
    state.attackTimer -= dt;
    if (state.attackTimer > 0) return;
    const free = state.animals.filter((a) => a.threat && ['idle', 'away', 'return'].includes(a.state));
    const prey = state.mushrooms.filter((m) => m.stage >= MIN_EDIBLE &&
      !state.animals.some((a) => a.target === m));
    if (!free.length || !prey.length) { state.attackTimer = 3; return; }
    const ev = state.L.attackEvery;
    state.attackTimer = rr(ev[0], ev[1]);
    prey.sort((p, q) => q.stage - p.stage + rr(-1.5, 1.5));
    const target = prey[0];
    free.sort((p, q) => Math.abs(p.x - target.x) - Math.abs(q.x - target.x));
    const a = free[0];
    if (a.state === 'away') a.x = target.x < W / 2 ? -100 : W + 100;
    a.state = 'approach';
    a.target = target;
    msg(a.info.name + ' идёт к грибу! Кликните по зверю, чтобы спугнуть', 3);
  }

  function ambientAnimal(a, dt) {
    a.y = 0;
    if (a.kind === 'hedgehog') {
      if (a.timer > 0) { a.timer -= dt; return; }
      a.x += a.dir * 22 * dt;
      a.walkT += dt;
      if (Math.abs(a.x - a.info.home) > 110) { a.dir = Math.sign(a.info.home - a.x); a.timer = rr(1, 3); }
      else if (rand() < dt * 0.08) a.timer = rr(0.8, 2.5);
    } else if (a.kind === 'rabbit') {
      if (a.hop <= 0) {
        a.timer -= dt;
        if (a.timer <= 0) {
          a.hop = 0.001; a.from = a.x;
          a.to = clamp(a.x + rr(-90, 90), a.info.home - 80, a.info.home + 80);
          if (Math.abs(a.to - a.from) < 25) a.to = a.from + (a.from < a.info.home ? 50 : -50);
          a.dir = Math.sign(a.to - a.from);
        }
      } else {
        a.hop += dt / 0.45;
        const k = Math.min(1, a.hop);
        a.x = a.from + (a.to - a.from) * k;
        a.y = -Math.sin(k * Math.PI) * 26;
        if (a.hop >= 1) { a.hop = 0; a.y = 0; a.timer = rr(2.5, 6); }
      }
    }
    // the squirrel just sits and looks around
  }

  function updateBirds(dt) {
    const b = state.robin;
    b.wait -= dt;
    if (b.wait <= 0) { b.peck = 1; b.wait = rr(1.2, 4); }
    b.peck = Math.max(0, b.peck - dt * 3);
    const t = state.bluetit;
    if (!t.active) {
      t.wait -= dt;
      if (t.wait <= 0) { t.active = true; t.dir = rand() < 0.5 ? 1 : -1; t.x = t.dir > 0 ? -120 : W + 120; t.baseY = rr(70, 200); }
    } else {
      t.x += t.dir * 210 * dt;
      t.y = t.baseY + Math.sin(state.t * 5) * 14;
      if (t.x > W + 150 || t.x < -150) { t.active = false; t.wait = rr(8, 16); }
    }
  }

  // ---- grubs: crawl to a thread and bite it
  function spawnGrub() {
    const fromLeft = rand() < 0.5;
    const g = {
      x: fromLeft ? -40 : W + 40, y: rr(SOIL_TOP + 90, H - 50),
      dir: fromLeft ? 1 : -1, state: 'seek', target: -1, t: 0, chew: 0, wig: rr(0, 6),
    };
    state.grubs.push(g);
    if (!state.grubWarned) {
      state.grubWarned = true;
      msg('Личинка! Кликните по ней, пока она не перегрызла нить', 3.5);
    }
  }

  function grubTarget(g) {
    let best = -1, bd = Infinity;
    const nodes = state.nodes;
    for (let i = 0; i < nodes.length; i += 3) {
      const n = nodes[i];
      if (n.dead || n.depth < GRUB_SAFE_DEPTH) continue;
      const d = dist(n.x, n.y, g.x, g.y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function updateGrubs(dt) {
    const G = state.L.grubs;
    if (G) {
      state.grubTimer -= dt;
      if (state.grubTimer <= 0) {
        state.grubTimer = rr(G.every[0], G.every[1]);
        if (state.grubs.filter((g) => g.state !== 'flee').length < G.max && grubTarget({ x: W / 2, y: H }) >= 0) spawnGrub();
      }
    }
    for (const g of state.grubs) {
      g.t += dt;
      if (g.state === 'flee') {
        g.x += g.dir * 130 * dt;
        if (g.x < -60 || g.x > W + 60) g.gone = true;
        continue;
      }
      if (g.state === 'pause') {
        g.chew -= dt;
        if (g.chew <= 0) g.state = 'seek';
        continue;
      }
      if (g.target < 0 || state.nodes[g.target].dead) g.target = grubTarget(g);
      if (g.target < 0) { g.state = 'flee'; g.dir = g.x < W / 2 ? -1 : 1; continue; }
      const n = state.nodes[g.target];
      const d = dist(n.x, n.y, g.x, g.y);
      if (g.state === 'seek') {
        if (d < 8) { g.state = 'chew'; g.chew = CHEW_TIME; continue; }
        const sp = 26 * dt;
        g.dir = n.x >= g.x ? 1 : -1;
        g.x += (n.x - g.x) / d * sp;
        g.y += (n.y - g.y) / d * sp;
        if (rand() < dt * 0.5) g.target = grubTarget(g); // the network changes as it grows
      } else if (g.state === 'chew') {
        g.chew -= dt;
        if (g.chew <= 0) {
          const lostCount = killSubtree(g.target);
          state.fx.push({ kind: 'bite', x: n.x, y: n.y, t: 0, life: 0.8 });
          if (lostCount > 3) msg('Личинка перегрызла нить — отрезанная часть засохла', 2.5);
          g.target = -1;
          g.state = 'flee'; // one bite and it crawls away, full
          g.dir = g.x < W / 2 ? -1 : 1;
        }
      }
    }
    state.grubs = state.grubs.filter((g) => !g.gone);
  }

  // ---- underground ambient critters
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

  // ---- goals
  function goalLines() {
    const g = state.L.goal;
    const lines = [];
    const ripeNow = state.mushrooms.filter((m) => m.stage >= RIPE).length;
    if (g.colonies) lines.push({ text: 'Колонии', have: state.mushrooms.length, need: g.colonies });
    if (g.ripeNow) lines.push({ text: g.ripeNow > 1 ? 'Зрелых грибов сразу' : 'Зрелый гриб', have: ripeNow, need: g.ripeNow });
    return lines;
  }

  function checkWin() {
    if (!goalLines().every((l) => l.have >= l.need)) return;
    const par = state.L.par;
    let stars = state.time <= par ? 3 : state.time <= par * 1.6 ? 2 : 1;
    if (state.lost >= 3) stars = Math.max(1, stars - 1);
    state.result = { stars, time: state.time };
    progress.stars[levelIndex] = Math.max(progress.stars[levelIndex] || 0, stars);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
    saveProgress();
    mode = 'won';
    for (const m of state.mushrooms) burst(m.x, GROUND_Y - 60, '255,220,140', 20);
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
    for (const w of state.withering) w.t += dt;
    state.withering = state.withering.filter((w) => w.t < 1.4);
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
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.parent >= 0 && !n.dead) drawSegment(nodes[n.parent], n);
    }
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

    // bitten-off threads dry up: brown, then gone
    ctx.save();
    ctx.lineCap = 'round';
    for (const w of state.withering) {
      const k = w.t / 1.4;
      ctx.strokeStyle = `rgba(150,110,70,${0.8 * (1 - k)})`;
      ctx.lineWidth = Math.max(1, w.b.w);
      ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of state.resources) {
      if (!r.connected || r.dead) continue;
      const n = state.nodes[r.node];
      ctx.strokeStyle = `rgba(${RES[r.type].glow},0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
    for (const m of state.mushrooms) {
      const n = state.nodes[m.root];
      glowDot(n.x, n.y, 30 + Math.sin(t * 2 + m.x) * 5, '255,170,50', 0.5);
    }
    for (const tip of state.tips) {
      const n = state.nodes[tip.node];
      const big = tip.player ? 16 : 7;
      glowDot(n.x, n.y, big + Math.sin(t * 9 + tip.born) * 2.5, '255,190,70', tip.player ? 0.95 : 0.6);
    }
    for (const p of state.particles) glowDot(p.x, p.y, 11, RES[p.type].glow, 0.95);
    ctx.restore();
  }

  function drawGrubs() {
    for (const g of state.grubs) {
      const im = img.grub;
      const sc = 0.3;
      const chewing = g.state === 'chew';
      const wig = Math.sin(g.t * (chewing ? 18 : 6) + g.wig) * (chewing ? 0.08 : 0.05);
      // red warning halo so the threat reads against the dark soil
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(g.x, g.y, 42 + Math.sin(g.t * 6) * 5, '255,60,40', g.state === 'flee' ? 0.15 : 0.55);
      ctx.restore();
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(g.dir > 0 ? -1 : 1, 1); // the sprite faces left
      ctx.scale(1 + wig, 1 - wig);
      ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
      ctx.restore();
      if (chewing) ring(g.x, g.y - 34, 12, 1 - g.chew / CHEW_TIME, '#ff6a50');
    }
  }

  function ring(x, y, r, k, color) {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    ctx.restore();
  }

  function drawAnimal(a) {
    if (a.state === 'away') return;
    const im = img[a.kind];
    const bottom = GROUND_Y + 12 + a.y;
    let rot = 0;
    if (a.kind === 'squirrel' && a.state === 'idle') rot = Math.sin(state.t * 1.4) * 0.015;
    if (a.state === 'eat') rot = Math.sin(state.t * 14) * 0.04;
    const step = a.kind === 'hedgehog' && (a.state === 'approach' || a.state === 'return' || a.state === 'flee')
      ? Math.abs(Math.sin(a.walkT * 9)) * 2 : 0;
    drawSprite(ctx, im, a.x, bottom - step, a.info.scale, a.dir < 0, 1, rot);
    if (a.carrying) {
      const mi = img['mushroom_' + a.carrying];
      drawSprite(ctx, mi, a.x - a.dir * 10, bottom - im.height * a.info.scale * 0.55, MUSH_SCALE * 0.5, false, 1, a.dir * 0.4);
    }
    if (a.state === 'approach' || a.state === 'eat') { // danger marker
      const box = animalBox(a);
      const y = box.y - 22 + Math.sin(state.t * 8) * 3;
      ctx.save();
      ctx.fillStyle = '#e8402f';
      ctx.beginPath(); ctx.arc(a.x, y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff3e0'; ctx.stroke();
      text('!', a.x, y + 1, 20, '#fff3e0', 'center');
      ctx.restore();
      if (a.state === 'eat') ring(a.target.x, mushroomBox(a.target).y - 18, 14, a.eatT / a.info.eat, '#ff6a50');
    }
  }

  function drawSurface() {
    const t = state.t;
    drawSprite(ctx, img.spruce, 1500, GROUND_Y + 14, 0.74);
    drawSprite(ctx, img.birch, 1275, GROUND_Y + 12, 0.62);
    drawSprite(ctx, img.oak, 205, GROUND_Y + 14, 0.74);
    drawSprite(ctx, img.bush_berries, 530, GROUND_Y + 12, 0.36);
    drawSprite(ctx, img.fern_2, 1120, GROUND_Y + 12, 0.34, true);
    drawSprite(ctx, img.bush_flowers, 1380, GROUND_Y + 14, 0.34);

    const b = state.robin;
    drawSprite(ctx, img.robin, b.x, GROUND_Y + 12, 0.22, true, 1, Math.sin(b.peck * Math.PI) * 0.35);

    for (const m of state.mushrooms) drawMushroom(m);
    for (const a of state.animals) drawAnimal(a);

    drawSprite(ctx, img.fern_1, 640, GROUND_Y + 16, 0.3);
    drawSprite(ctx, img.daisies, 700, GROUND_Y + 16, 0.28);
    drawSprite(ctx, img.bluebells, 905, GROUND_Y + 16, 0.3);
    drawSprite(ctx, img.buttercups, 965, GROUND_Y + 16, 0.28);
    drawSprite(ctx, img.grass_1, 400, GROUND_Y + 18, 0.26);
    drawSprite(ctx, img.grass_2, 1200, GROUND_Y + 18, 0.26);
    drawSprite(ctx, img.grass_1, 60, GROUND_Y + 18, 0.24, true);
    drawSprite(ctx, img.grass_2, 1580, GROUND_Y + 18, 0.24);

    for (const m of state.mushrooms) drawMushroomLabel(m);

    const bt = state.bluetit;
    if (bt.active) drawSprite(ctx, img.bluetit, bt.x, bt.y, 0.22, bt.dir < 0, 1, Math.sin(t * 14) * 0.06);
  }

  function drawMushroom(m) {
    const base = GROUND_Y + 14;
    const t = state.t;
    if (m.stage === 0) { // a faint glowing bump: a new mushroom is forming
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(m.x, GROUND_Y + 2, 24 + Math.sin(t * 2.5 + m.x) * 5, '255,190,80', 0.5);
      ctx.restore();
      return;
    }
    const k = m.anim;
    const sway = Math.sin(t * 1.1 + m.x) * 0.012;
    if (m.stage === RIPE && canSpore() && mode === 'play') { // ripe: ready to spread spores
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(m.x, base - 120, 120 + Math.sin(t * 3) * 14, '220,170,255', state.sporeFrom === m ? 0.45 : 0.25);
      ctx.restore();
    }
    if (k < 1 && m.prevStage > 0) {
      drawSprite(ctx, img['mushroom_' + m.prevStage], m.x, base, MUSH_SCALE, false, 1 - k, sway);
    }
    const s = MUSH_SCALE * (k < 1 ? 0.6 + 0.4 * easeOutBack(k) : 1);
    const squash = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.06 : 1;
    ctx.save();
    ctx.translate(m.x, base);
    ctx.scale(squash, 1 / squash);
    drawSprite(ctx, img['mushroom_' + m.stage], 0, 0, s, false, Math.min(1, k * 2 + 0.2), sway);
    ctx.restore();
    if (m.stage === RIPE) { // spore shimmer
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.25 + i / 5) % 1;
        glowDot(m.x + Math.sin(i * 2.3 + t) * 60 * p, base - 180 - p * 100, 5 * (1 - p), '255,220,150', 0.8);
      }
      ctx.restore();
    }
  }

  function drawMushroomLabel(m) {
    // stage pips above every mushroom
    const box = m.stage ? mushroomBox(m) : { y: GROUND_Y - 20 };
    const y = box.y - 10;
    ctx.save();
    for (let i = 0; i < RIPE; i++) {
      ctx.fillStyle = i < m.stage ? '#ffd27a' : 'rgba(30,18,10,0.6)';
      ctx.strokeStyle = 'rgba(30,18,10,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.x - 25 + i * 10, y, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    if (m.stage === RIPE && canSpore() && mode === 'play') {
      const a = 0.75 + 0.25 * Math.sin(state.t * 4);
      ctx.save(); ctx.globalAlpha = a;
      text(state.sporeFrom === m ? 'Куда? Кликните по поверхности' : 'Споры готовы!', m.x, y - 20, 16, '#e9d2ff', 'center');
      ctx.restore();
    }
  }

  function drawSporeAim() {
    const m = state.sporeFrom;
    const p = state.pointer;
    if (!m || !p) return;
    const x = clamp(p.x, 0, W);
    const bad = sporeSpotProblem(x);
    const x0 = m.x, y0 = mushroomBox(m).y + 20;
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -state.t * 40;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = bad ? 'rgba(255,120,100,0.8)' : 'rgba(225,190,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x) / 2, y0 - 160, x, GROUND_Y + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 6, 26, 8, 0, 0, Math.PI * 2); ctx.stroke();
    if (bad) text(bad, x, GROUND_Y - 28, 15, '#ffb3a6', 'center');
    ctx.restore();
  }

  function drawSporeClouds() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of state.spores) {
      const k = c.t, e = k * k * (3 - 2 * k);
      const cx = c.x0 + (c.x1 - c.x0) * e;
      const cy = c.y0 + (GROUND_Y - c.y0) * e - Math.sin(k * Math.PI) * 140;
      for (const d of c.dots) {
        const spread = 0.4 + Math.sin(k * Math.PI) * 0.8;
        glowDot(cx + d.ox * spread + Math.sin(state.t * 4 + d.ph) * 4, cy + d.oy * spread, 7, '220,170,255', 0.8);
      }
    }
    ctx.restore();
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
      } else if (f.kind === 'blocked' || f.kind === 'bite') {
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
        glowDot(f.x, f.y, 9 * (1 - k) + 2, f.rgb || '255,210,110', 1 - k);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
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

  // ---- HUD & screens
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
    ctx.fillStyle = 'rgba(28,18,12,0.82)';
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

  function wrap(str, x, y, maxW, size, lineH, color, align = 'left', weight = 600) {
    ctx.font = `${weight} ${size}px "Trebuchet MS", system-ui, sans-serif`;
    const words = str.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        text(line, x, y, size, color, align, weight);
        y += lineH;
        line = w;
      } else line = test;
    }
    if (line) text(line, x, y, size, color, align, weight);
    return y + lineH;
  }

  let buttons = [];
  let hoverBtn = null;
  function button(x, y, w, h, label, onClick, opts = {}) {
    const hot = hoverBtn && hoverBtn.label === label && hoverBtn.x === x && hoverBtn.y === y;
    ctx.save();
    roundRect(x, y, w, h, Math.min(16, h / 2));
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (opts.disabled) { g.addColorStop(0, '#4a3a2c'); g.addColorStop(1, '#2f241b'); }
    else if (opts.primary) { g.addColorStop(0, hot ? '#f6c25e' : '#e8a83f'); g.addColorStop(1, hot ? '#c47b25' : '#a9641d'); }
    else { g.addColorStop(0, hot ? '#7a5a3a' : '#634629'); g.addColorStop(1, hot ? '#4e3622' : '#3d2a19'); }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.disabled ? 'rgba(160,130,100,0.4)' : 'rgba(255,215,140,0.9)';
    ctx.stroke();
    ctx.restore();
    text(label, x + w / 2, y + h / 2 + 1, opts.size || 20, opts.disabled ? 'rgba(247,232,198,0.45)' : '#fff3da', 'center');
    if (!opts.disabled) buttons.push({ x, y, w, h, label, onClick });
  }

  function stars(x, y, n, size = 30) {
    for (let i = 0; i < 3; i++) {
      text('★', x + (i - 1) * size * 1.05, y, size, i < n ? '#ffd24a' : 'rgba(60,40,25,0.9)', 'center');
    }
  }

  function drawHud() {
    // menu button
    button(14, 14, 120, 44, '☰ Уровни', () => openMenu(), { size: 18 });

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

    // goal + next stage
    const px = W - 334, py = 14, pw = 320;
    const goals = goalLines();
    const target = growthTarget();
    const ph = 92 + goals.length * 26 + (target ? 74 : 26);
    panel(px, py, pw, ph);
    text((levelIndex + 1) + '. ' + state.L.name, px + 16, py + 22, 17, '#ffd27a');
    text(fmtTime(state.time), px + pw - 16, py + 22, 15, 'rgba(247,232,198,0.75)', 'right', 600);
    let y = py + 52;
    for (const g of goals) {
      const ok = g.have >= g.need;
      text(ok ? '✓' : '○', px + 18, y, 18, ok ? '#9be86b' : '#f7e8c6');
      text(g.text, px + 40, y, 15, '#f7e8c6', 'left', 600);
      text(Math.min(g.have, g.need) + '/' + g.need, px + pw - 16, y, 17, ok ? '#9be86b' : '#f7e8c6', 'right');
      y += 26;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(214,163,82,0.35)';
    ctx.beginPath(); ctx.moveTo(px + 14, y - 6); ctx.lineTo(px + pw - 14, y - 6); ctx.stroke();
    ctx.restore();
    if (!target) {
      text('Все грибы зрелые', px + 16, y + 14, 14, 'rgba(247,232,198,0.8)', 'left', 600);
    } else {
      const idx = state.mushrooms.indexOf(target) + 1;
      const label = state.mushrooms.length > 1 ? 'Гриб ' + idx + ': ' : 'Гриб: ';
      text(label + 'стадия ' + target.stage + ' → ' + (target.stage + 1), px + 16, y + 12, 14, 'rgba(247,232,198,0.85)', 'left', 600);
      const need = STAGES[target.stage];
      let i = 0, have = 0, total = 0;
      for (const t of RES_ORDER) {
        if (!need[t]) continue;
        const ix = px + 28 + i * 68, iy = y + 40;
        const im = img[RES[t].sprite];
        const sc = 20 / Math.max(im.width, im.height);
        drawSprite(ctx, im, ix, iy + im.height * sc / 2, sc);
        const ok = state.counts[t] >= need[t];
        text(Math.min(state.counts[t], need[t]) + '/' + need[t], ix + 15, iy + 1, 15, ok ? '#9be86b' : '#f7e8c6');
        have += Math.min(state.counts[t], need[t]);
        total += need[t];
        i++;
      }
      const bx = px + 16, by = y + 58, bw = pw - 32, bh = 8;
      roundRect(bx, by, bw, bh, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
      const k = total ? have / total : 0;
      if (k > 0) {
        roundRect(bx, by, Math.max(bh, bw * k), bh, 4);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, '#f0a43a'); g.addColorStop(1, '#ffe08a');
        ctx.fillStyle = g; ctx.fill();
      }
    }

    // messages
    let my = HUD.y + HUD.h + 30;
    for (const m of state.msgs) {
      const a = Math.min(1, m.t * 4, (m.life - m.t) * 2);
      ctx.save();
      ctx.globalAlpha = a;
      text(m.text, W / 2, my, 21, '#fff1cf', 'center');
      ctx.restore();
      my += 30;
    }

    ctx.save();
    ctx.globalAlpha = 0.75;
    const hint = state.sporeFrom
      ? 'Кликните по поверхности, куда лететь спорам · Esc — отмена'
      : 'Клик по почве — расти туда · клик по личинке или зверю — прогнать · клик по зрелому грибу — споры · R — заново';
    text(hint, W / 2, H - 16, 14, '#f7e8c6', 'center', 600);
    ctx.restore();
  }

  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  function dim(a = 0.55) {
    ctx.save();
    ctx.fillStyle = `rgba(12,7,4,${a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawMenu() {
    dim(0.6);
    const pw = 1040, ph = 560, px = (W - pw) / 2, py = (H - ph) / 2;
    panel(px, py, pw, ph, 24);
    text('Mycelium Forest', W / 2, py + 62, 54, '#ffd27a', 'center');
    text('Выберите уровень', W / 2, py + 112, 20, 'rgba(247,232,198,0.85)', 'center', 600);

    // the levels sit on a glowing thread, like the mycelium itself
    const xs = LEVELS.map((_, i) => px + 120 + i * ((pw - 240) / (LEVELS.length - 1)));
    const ys = LEVELS.map((_, i) => py + 280 + (i % 2 ? 46 : -30));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,170,60,0.55)';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255,160,40,1)';
    ctx.shadowBlur = 16 * RS;
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) {
      ctx.bezierCurveTo((xs[i - 1] + xs[i]) / 2, ys[i - 1], (xs[i - 1] + xs[i]) / 2, ys[i], xs[i], ys[i]);
    }
    ctx.stroke();
    ctx.restore();

    LEVELS.forEach((L, i) => {
      const x = xs[i], y = ys[i];
      const open = i < progress.unlocked;
      const r = 50;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(x - 14, y - 18, 4, x, y, r);
      if (open) { g.addColorStop(0, '#ffe6a3'); g.addColorStop(1, '#c9772a'); }
      else { g.addColorStop(0, '#6d5a4a'); g.addColorStop(1, '#3a2c22'); }
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = open ? '#fff0c9' : 'rgba(160,130,100,0.6)'; ctx.stroke();
      ctx.restore();
      if (open) {
        const im = img['mushroom_' + Math.min(6, i + 2)];
        drawSprite(ctx, im, x, y + 30, 62 / im.height);
        text(String(i + 1), x + 34, y - 34, 24, '#fff3da', 'center');
        buttons.push({ x: x - r, y: y - r, w: r * 2, h: r * 2, label: 'lvl' + i, onClick: () => startLevel(i) });
      } else {
        drawLock(x, y);
      }
      text(L.name, x, y + r + 26, 18, open ? '#f7e8c6' : 'rgba(247,232,198,0.45)', 'center');
      if (open) stars(x, y + r + 54, progress.stars[i] || 0, 22);
    });
    wrap('Растите грибницу к ресурсам, защищайте её от личинок, а грибы — от зверей, и распространяйте споры.',
      W / 2, py + ph - 56, pw - 160, 17, 24, 'rgba(247,232,198,0.8)', 'center');
  }

  function drawLock(x, y) {
    ctx.save();
    ctx.strokeStyle = '#d8c2a0'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y - 6, 12, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#d8c2a0';
    roundRect(x - 17, y - 6, 34, 26, 5); ctx.fill();
    ctx.fillStyle = '#3a2c22';
    ctx.beginPath(); ctx.arc(x, y + 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawIntro() {
    dim(0.5);
    const pw = 720, px = (W - pw) / 2, py = 200;
    const L = state.L;
    panel(px, py, pw, 420, 22);
    text('Уровень ' + (levelIndex + 1), W / 2, py + 44, 20, 'rgba(247,232,198,0.75)', 'center', 600);
    text(L.name, W / 2, py + 84, 40, '#ffd27a', 'center');
    let y = wrap(L.text, W / 2, py + 140, pw - 90, 19, 28, '#f7e8c6', 'center');
    y += 10;
    text('Цель:', W / 2, y, 20, '#ffd27a', 'center');
    y += 32;
    for (const g of goalLines()) {
      text(g.text + ': ' + g.need, W / 2, y, 19, '#f7e8c6', 'center', 600);
      y += 28;
    }
    button(W / 2 - 110, py + 340, 220, 54, 'Играть', () => { mode = 'play'; msg('Кликните по почве — грибница прорастёт в ту сторону', 4); }, { primary: true, size: 24 });
  }

  function drawWon() {
    dim(0.45);
    const pw = 620, ph = 360, px = (W - pw) / 2, py = 230;
    panel(px, py, pw, ph, 22);
    text('Уровень пройден!', W / 2, py + 56, 40, '#ffd27a', 'center');
    stars(W / 2, py + 120, state.result.stars, 54);
    text('Время: ' + fmtTime(state.result.time) + '   ·   потеряно грибов: ' + state.lost, W / 2, py + 180, 18, '#f7e8c6', 'center', 600);
    text('3 звезды — быстрее ' + fmtTime(state.L.par), W / 2, py + 208, 15, 'rgba(247,232,198,0.7)', 'center', 600);
    const last = levelIndex >= LEVELS.length - 1;
    button(px + 30, py + 260, 170, 52, 'Уровни', () => openMenu(), { size: 20 });
    button(px + 220, py + 260, 170, 52, 'Заново', () => startLevel(levelIndex), { size: 20 });
    button(px + 410, py + 260, 180, 52, last ? 'Финал!' : 'Дальше', () => last ? openMenu() : startLevel(levelIndex + 1), { primary: true, size: 20 });
  }

  function drawCursor() {
    const p = state.pointer;
    if (!p || p.y < SOIL_TOP || state.sporeFrom || mode !== 'play') return;
    if (hoverTarget(p)) return;
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
    buttons = [];
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawBackground();
    drawUnderground();
    drawResources();
    drawMycelium();
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    drawGrubs();
    drawSurface();
    drawSporeClouds();
    drawSporeAim();
    drawCursor();
    drawFx();
    if (mode === 'play') drawHud();
    if (mode === 'menu') drawMenu();
    if (mode === 'intro') drawIntro();
    if (mode === 'won') drawWon();
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
    updateBirds(dt);
    updateCritters(dt);
    updateFx(dt);
    if (mode !== 'play') {
      for (const a of state.animals) if (a.state === 'idle') ambientAnimal(a, dt);
      updateTips(dt);
      updateMushrooms(dt);
      if (state.needRebuild) { state.needRebuild = false; rebuildMycelium(); }
      return;
    }
    state.time += dt;
    if (state.pointer && state.pointer.down && state.activeTip && state.activeTip.alive) {
      const p = state.pointer; // dragging steers the tip that was started by this press
      if (p.y >= SOIL_TOP) {
        const tip = state.activeTip;
        tip.target = { x: clamp(p.x, SOIL_PAD + 2, W - SOIL_PAD - 2), y: p.y };
        tip.maxTravel = tip.travelled + 400;
      }
    }
    updateTips(dt);
    updateResources(dt);
    updateParticles(dt);
    updateMushrooms(dt);
    updateSpores(dt);
    updateAnimals(dt);
    updateGrubs(dt);
    respawn(dt);
    if (state.needRebuild) { state.needRebuild = false; rebuildMycelium(); }
    checkWin();
  }

  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * W,
      y: (e.clientY - rect.top) / rect.height * H,
    };
  }

  const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

  // What a click at p would act on (other than growing the mycelium).
  function hoverTarget(p) {
    for (const b of buttons) if (inBox(p, b)) return { kind: 'button', b };
    if (mode !== 'play') return null;
    for (const a of state.animals) {
      if (a.threat && (a.state === 'approach' || a.state === 'eat' || a.state === 'idle' || a.state === 'return') && inBox(p, animalBox(a))) {
        return { kind: 'animal', a };
      }
    }
    for (const g of state.grubs) if (g.state !== 'flee' && dist(p.x, p.y, g.x, g.y) < 38) return { kind: 'grub', g };
    for (const m of state.mushrooms) {
      if (m.stage === RIPE && canSpore() && inBox(p, mushroomBox(m))) return { kind: 'mushroom', m };
    }
    return null;
  }

  function onPress(p) {
    const hit = hoverTarget(p);
    if (hit && hit.kind === 'button') { hit.b.onClick(); return; }
    if (mode !== 'play') return;

    if (state.sporeFrom) {
      if (hit && hit.kind === 'mushroom' && hit.m === state.sporeFrom) { state.sporeFrom = null; return; }
      if (p.y < SOIL_TOP) {
        const bad = sporeSpotProblem(p.x);
        if (bad) { msg(bad + ' — выберите другое место', 2); return; }
        releaseSpores(state.sporeFrom, p.x);
        state.sporeFrom = null;
        return;
      }
      state.sporeFrom = null; // a click in the soil cancels aiming and grows as usual
    }
    if (hit && hit.kind === 'animal') { scareAnimal(hit.a); return; }
    if (hit && hit.kind === 'grub') {
      hit.g.state = 'flee';
      hit.g.dir = hit.g.x < W / 2 ? -1 : 1;
      state.fx.push({ kind: 'ring', x: hit.g.x, y: hit.g.y, t: 0, life: 0.6, color: '255,120,90' });
      msg('Личинка уползает!', 1.4);
      return;
    }
    if (hit && hit.kind === 'mushroom') {
      state.sporeFrom = hit.m;
      msg('Кликните по поверхности, куда полетят споры', 3);
      return;
    }
    if (p.y < SOIL_TOP - 6) { msg('Грибница растёт только в почве — кликайте ниже травы', 2); return; }
    state.activeTip = growToward(p.x, p.y);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state) return;
    const p = toWorld(e);
    state.pointer = { ...p, down: true };
    onPress(p);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state) return;
    const p = toWorld(e);
    state.pointer = { ...p, down: state.pointer ? state.pointer.down : false };
    const hit = hoverTarget(p);
    hoverBtn = hit && hit.kind === 'button' ? hit.b : null;
    canvas.style.cursor = hit ? 'pointer' : (mode === 'play' && (p.y >= SOIL_TOP || state.sporeFrom) ? 'crosshair' : 'default');
  });
  const up = () => { if (state && state.pointer) state.pointer.down = false; if (state) state.activeTip = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (state && state.pointer && !state.pointer.down) state.pointer = null; });
  window.addEventListener('keydown', (e) => {
    if (!state) return;
    if (e.key === 'Escape') { if (state.sporeFrom) state.sporeFrom = null; else if (mode === 'play') openMenu(); }
    if ((e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') && mode === 'play') startLevel(levelIndex);
  });
  window.addEventListener('resize', resize);

  function startLevel(i) {
    newWorld(i);
    rebuildMycelium();
    mode = 'intro';
  }

  function openMenu() {
    if (state) state.sporeFrom = null;
    mode = 'menu';
  }

  loadSprites().then(() => {
    document.getElementById('loading').remove();
    resize();
    newWorld(Math.min(progress.unlocked, LEVELS.length) - 1);
    buildSoil();
    rebuildMycelium();
    const params = new URLSearchParams(location.search);
    if (params.get('level')) startLevel(clamp(Number(params.get('level')) - 1, 0, LEVELS.length - 1));
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }).catch((err) => {
    document.getElementById('loading').textContent =
      err.message + '. Запустите игру через локальный сервер (см. README).';
    console.error(err);
  });

  // handy for debugging / automated tests in the console
  window.mycelium = {
    get state() { return state; }, get mode() { return mode; },
    startLevel, growToward, LEVELS, W, H, GROUND_Y, SOIL_TOP,
    play() { mode = 'play'; },
  };
})();

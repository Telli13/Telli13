/* Mycelium Forest — prototype v3.
 *
 * Core loop: click the soil -> the mycelium grows toward the click, rocks block it,
 * touching a resource drains it along the network into the shared stock, and the
 * stock grows mushrooms on the surface through 6 stages.
 *
 * v2: levels, dangers (grubs, hedgehog, rabbit, squirrel), spore reproduction.
 * v3: a big world with a camera (wider and deeper), child mushrooms that sprout
 *     from the roots of a strong mother, every animal hunts its own kind of prey,
 *     a bird pecks young mushrooms, ants steal resources underground, a minimap
 *     and edge markers for off-screen danger.
 *
 * World coordinates are in logical pixels; the view is 1600 x 900 of them.
 */
'use strict';

(() => {
  // ---------------------------------------------------------------- constants
  const W = 1600;                  // view size (logical px)
  const H = 900;
  const GROUND_Y = 430;            // grass line between forest and soil (world y)
  const SOIL_TOP = GROUND_Y + 22;  // mycelium may not grow above this
  const SOIL_PAD = 12;
  const ROOT_DY = 26;              // depth of a colony knot under its mushroom

  const STEP = 5;
  const PLAYER_SPEED = 80;
  const AUTO_SPEED = 40;
  const MAX_PLAYER_TIPS = 4;
  const MAX_SLIDE = 0.8;
  const DRAIN_INTERVAL = 0.4;
  const FLOW_SPEED = 420;
  const MUSH_SCALE = 0.5;
  const RIPE = 6;
  const SPORE_DROP_TO = 4;
  const COLONY_GAP = 130;          // min distance between two mushrooms
  const CHILD_MIN_STAGE = 3;       // a mother needs this stage to raise a child
  const CHILD_GOAL_STAGE = 2;     // a child counts for goals once it reaches this stage
  const SPROUT_DEPTH = 10;         // a thread this close to the grass line can sprout a child
  const GRUB_SAFE_DEPTH = 22;
  const CHEW_TIME = 2.2;
  const TILE = 512;                // mycelium layer tile size (world px)
  const CAM_SPEED = 950;           // px / s for keyboard panning

  const RES = {
    water:   { name: 'Вода',     sprite: 'water_drop', color: '#62cbff', glow: '98,203,255' },
    organic: { name: 'Органика', sprite: 'leaf',       color: '#9ad957', glow: '154,217,87' },
    mineral: { name: 'Минералы', sprite: 'crystal',    color: '#b9a2ff', glow: '185,162,255' },
    sugar:   { name: 'Сахар',    sprite: 'sugar',      color: '#ffc53d', glow: '255,197,61' },
  };
  const RES_ORDER = ['water', 'organic', 'mineral', 'sugar'];

  const STAGES = [
    { water: 1, organic: 1, mineral: 0, sugar: 0 },
    { water: 2, organic: 1, mineral: 1, sugar: 0 },
    { water: 2, organic: 2, mineral: 1, sugar: 1 },
    { water: 3, organic: 2, mineral: 2, sugar: 1 },
    { water: 3, organic: 3, mineral: 2, sugar: 2 },
    { water: 4, organic: 3, mineral: 3, sugar: 2 },
  ];

  // Every hunter has its own taste: what stages it goes for.
  const HUNTERS = {
    rabbit:   { name: 'Заяц',  scale: 0.27, speed: 95,  eat: 2.6, prey: [1, 3], verb: 'объел' },
    hedgehog: { name: 'Ёж',    scale: 0.27, speed: 60,  eat: 3.6, prey: [3, 6], verb: 'съел' },
    squirrel: { name: 'Белка', scale: 0.24, speed: 140, eat: 1.8, prey: [5, 6], verb: 'украла' },
    bird:     { name: 'Синица', scale: 0.22, speed: 300, eat: 2.4, prey: [1, 2], verb: 'склевала' },
  };

  const CONTROLS = 'Карту двигают стрелки / WASD, колесо мыши, перетаскивание неба или клик по мини-карте.';

  const LEVELS = [
    {
      name: 'Пробуждение',
      text: 'Грибница проснулась. Растите нити к ресурсам и вырастите первый гриб. Звери пока сыты. ' + CONTROLS,
      goal: { ripeNow: 1 },
      seed: 11, ww: 2400, wh: 1250, rocks: 12, pools: 1, cap: 18,
      plan: { water: 5, organic: 5, mineral: 4, sugar: 4 },
      maxMushrooms: 1, hunters: [], grubs: null, ants: null, par: 100,
    },
    {
      name: 'Дети',
      text: 'Когда мать дорастёт до 3-й стадии, ведите нить к самой поверхности подальше от неё — там из корней вырастет гриб-ребёнок. Осторожно: заяц обожает молодые грибы, кликайте по нему!',
      goal: { children: 2 },
      seed: 22, ww: 3000, wh: 1400, rocks: 17, pools: 2, cap: 20,
      plan: { water: 7, organic: 6, mineral: 5, sugar: 4 },
      maxMushrooms: 4, hunters: ['rabbit'], attackEvery: [18, 26], grubs: null, ants: null, par: 220,
    },
    {
      name: 'Споры',
      text: 'Зрелый гриб может выпустить споры: кликните по нему и по месту на поверхности — там начнётся новая колония со своими корнями. Синица пикирует на маленькие грибы.',
      goal: { roots: 2, ripeNow: 2 },
      seed: 33, ww: 3400, wh: 1500, rocks: 20, pools: 2, cap: 20,
      plan: { water: 7, organic: 6, mineral: 6, sugar: 5 },
      maxMushrooms: 5, hunters: ['rabbit', 'bird'], attackEvery: [16, 24], grubs: null, ants: null, par: 300,
    },
    {
      name: 'Подземные воры',
      text: 'Личинки перегрызают нити — если нить к ребёнку оборвётся, ребёнок погибнет. Муравьи утаскивают ресурсы. Кликайте по ним, чтобы прогнать.',
      goal: { children: 3 },
      seed: 44, ww: 3400, wh: 1600, rocks: 22, pools: 2, cap: 20,
      plan: { water: 7, organic: 7, mineral: 6, sugar: 5 },
      maxMushrooms: 5, hunters: ['rabbit'], attackEvery: [22, 30],
      grubs: { every: [14, 20], max: 2 }, ants: { every: [16, 24], max: 2 }, par: 320,
    },
    {
      name: 'Голодные звери',
      text: 'Ёж ест взрослые грибы, заяц — молодые, синица клюёт малышей. Следите за красными метками по краям экрана — там опасность.',
      goal: { mushrooms: 5, ripeNow: 2 },
      seed: 55, ww: 4000, wh: 1700, rocks: 26, pools: 2, cap: 22,
      plan: { water: 8, organic: 7, mineral: 7, sugar: 6 },
      maxMushrooms: 6, hunters: ['hedgehog', 'rabbit', 'bird'], attackEvery: [12, 18],
      grubs: { every: [18, 26], max: 2 }, ants: null, par: 420,
    },
    {
      name: 'Белка-воришка',
      text: 'Белка хватает зрелые грибы и уносит их. Все опасности сразу, тяжёлая каменистая почва и мало ресурсов — богатые залежи прячутся глубже.',
      goal: { ripeNow: 3, children: 2 },
      seed: 66, ww: 4000, wh: 1800, rocks: 34, pools: 2, cap: 18,
      plan: { water: 7, organic: 6, mineral: 6, sugar: 5 },
      maxMushrooms: 6, hunters: ['hedgehog', 'rabbit', 'squirrel', 'bird'], attackEvery: [10, 15],
      grubs: { every: [14, 20], max: 3 }, ants: { every: [18, 26], max: 2 }, par: 500,
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
    'worm', 'woodlouse', 'grub', 'ant', 'log', 'leaf_pile',
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
  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

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
  const SAVE_KEY = 'mycelium-forest-progress-v3';
  let progress = { unlocked: 1, stars: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved && saved.unlocked) progress = saved;
  } catch (e) { /* storage unavailable: progress lives for this visit only */ }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- canvas / camera
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let RS = 1;                 // backing pixels per logical pixel
  let TS = 1;                 // resolution of the mycelium tiles
  let WW = 2400, WH = 1250;   // world size of the current level
  const cam = { x: 0, y: 0 };
  let soilTile = null, soilPattern = null, stripCanvas = null;
  let tiles = new Map();      // mycelium glow layer, split into lazily created tiles

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fit = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * fit), cssH = Math.floor(H * fit);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.left = Math.floor((vw - cssW) / 2) + 'px';
    canvas.style.top = Math.floor((vh - cssH) / 2) + 'px';
    const newRS = clamp(fit * (window.devicePixelRatio || 1), 0.5, 2);
    if (Math.abs(newRS - RS) < 0.01 && soilTile) return;
    RS = newRS;
    TS = Math.min(RS, 1.25);
    canvas.width = Math.round(W * RS);
    canvas.height = Math.round(H * RS);
    if (state) {
      buildSoil();
      rebuildMycelium();
    }
  }

  function clampCam() {
    cam.x = clamp(cam.x, 0, Math.max(0, WW - W));
    cam.y = clamp(cam.y, 0, Math.max(0, WH - H));
  }
  function centerOn(x, y) { cam.x = x - W / 2; cam.y = y - H / 2; clampCam(); }

  // ---------------------------------------------------------------- world state
  let state = null;
  let mode = 'menu';
  let levelIndex = 0;
  const grid = new Map();
  const cellKey = (x, y) => (Math.floor(x / 40) << 16) ^ Math.floor(y / 40);

  function newWorld(li) {
    levelIndex = li;
    const L = LEVELS[li];
    seed = L.seed;
    WW = L.ww; WH = L.wh;
    grid.clear();
    tiles = new Map();
    const startX = Math.round(WW * 0.42);
    state = {
      L, startX,
      t: 0, time: 0,
      nodes: [], tips: [], rocks: [], resources: [],
      particles: [], flyers: [], fx: [], withering: [], msgs: [],
      counts: { water: 0, organic: 0, mineral: 0, sugar: 0 },
      bump: { water: 0, organic: 0, mineral: 0, sugar: 0 },
      mushrooms: [],
      growCooldown: 0, respawnTimer: 4,
      pointer: null, activeTip: null, drag: null, keys: new Set(),
      sporeFrom: null, spores: [],
      hunters: [], attackTimer: L.attackEvery ? rr(L.attackEvery[0], L.attackEvery[1]) : 0,
      grubs: [], grubTimer: L.grubs ? rr(8, 12) : 0,
      ants: [], antTimer: L.ants ? rr(10, 14) : 0,
      critters: [], decor: [],
      needRebuild: false, lost: 0, result: null,
      sproutMsgAt: -10, motherReadyShown: false,
      bluetit: { x: -200, y: 120, active: false, wait: 6, dir: 1 },
    };
    makeDecor();
    makeRocks(L.rocks);
    newColony(startX, null);
    makeResources(L);
    makeCritters();
    makeHunters(L);
    centerOn(startX, GROUND_Y + 120);
    cam.y = 0;
  }

  // ---- surface decor (trees, bushes, flowers) and the roots under trees
  function makeDecor() {
    const d = state.decor;
    const sx = state.startX;
    let x = rr(60, 200);
    while (x < WW - 60) {
      if (Math.abs(x - sx) > 190) {
        const kind = pick(['oak', 'birch', 'spruce', 'oak', 'spruce']);
        const scale = { oak: rr(0.62, 0.76), birch: rr(0.55, 0.66), spruce: rr(0.62, 0.78) }[kind];
        d.push({ s: kind, x, scale, flip: rand() < 0.5, layer: 0 });
        d.push({ s: { oak: 'roots_stump', birch: 'roots_long', spruce: 'roots_turf' }[kind], x, scale: scale * 0.85, flip: rand() < 0.5, layer: -1 });
      }
      x += rr(330, 620);
    }
    for (let i = 0; i < WW / 170; i++) {
      const bx = rr(30, WW - 30);
      if (Math.abs(bx - sx) < 120) continue;
      d.push({ s: pick(['bush_berries', 'bush_flowers', 'fern_1', 'fern_2', 'log', 'leaf_pile']), x: bx, scale: rr(0.28, 0.36), flip: rand() < 0.5, layer: 1 });
    }
    for (let i = 0; i < WW / 90; i++) {
      const fx = rr(20, WW - 20);
      if (Math.abs(fx - sx) < 90) continue;
      d.push({ s: pick(['daisies', 'bluebells', 'buttercups', 'grass_1', 'grass_2', 'grass_3']), x: fx, scale: rr(0.22, 0.3), flip: rand() < 0.5, layer: 2 });
    }
    d.push({ s: 'robin', x: sx + rr(260, 380), scale: 0.22, flip: true, layer: 1, robin: true, peck: 0, wait: 2 });
  }

  // ---- obstacles
  function rockHit(x, y, pad = 0) {
    for (const r of state.rocks) {
      if (Math.abs(x - r.cx) > r.rx + pad || Math.abs(y - r.cy) > r.ry + pad) continue;
      const dx = (x - r.cx) / (r.rx + pad), dy = (y - r.cy) / (r.ry + pad);
      if (dx * dx + dy * dy < 1) return r;
    }
    return null;
  }
  function outOfSoil(x, y) {
    return x < SOIL_PAD || x > WW - SOIL_PAD || y < SOIL_TOP || y > WH - SOIL_PAD;
  }
  const blocked = (x, y) => outOfSoil(x, y) || !!rockHit(x, y);

  function makeRocks(count) {
    const kinds = [
      { s: 'rock_mossy', w: [150, 240] },
      { s: 'rock_mossy', w: [120, 190] },
      { s: 'rock_1', w: [130, 220] },
      { s: 'rock_2', w: [120, 190] },
      { s: 'rock_3', w: [100, 160] },
      { s: 'rock_4', w: [80, 120] },
    ];
    let tries = 0;
    while (state.rocks.length < count && tries++ < count * 120) {
      const k = pick(kinds);
      const im = img[k.s];
      const w = rr(k.w[0], k.w[1]);
      const x = rr(70, WW - 70);
      const y = rr(SOIL_TOP + 70, WH - 50);
      const ww = w * (y > GROUND_Y + 600 ? 1.2 : 1); // deeper rocks are bigger
      const scale = ww / im.width;
      const h = im.height * scale;
      const rock = {
        s: k.s, x, bottom: y + h / 2, scale, flip: rand() < 0.5,
        cx: x, cy: y + h * 0.02, rx: ww * 0.44, ry: h * 0.45,
      };
      if (dist(x, y, state.startX, GROUND_Y + 60) < 200) continue;
      if (state.rocks.some((o) => dist(o.cx, o.cy, rock.cx, rock.cy) < (o.rx + rock.rx) * 0.9 + 30)) continue;
      state.rocks.push(rock);
    }
  }

  // ---- resources (deeper deposits are richer)
  function resourceDef(type, big) {
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
    if (state.resources.some((r) => !r.dead && dist(r.x, r.y, x, y) < r.radius + radius + 40)) return false;
    return true;
  }

  function makeResource(type, x, y, big, amount) {
    const def = resourceDef(type, big);
    const depth = clamp((y - SOIL_TOP) / 900, 0, 1);
    const rich = 1 + depth * 0.45; // deeper = bigger and richer
    const res = {
      type, s: def.s, x, y, size: def.size * rich, radius: def.size * rich * 0.42,
      amount: amount != null ? amount : def.amount + Math.floor(depth * 3 + rand() * 1.5),
      connected: false, node: -1, path: null, timer: 0.2,
      phase: rr(0, Math.PI * 2), fade: 0, dead: false, rich: depth > 0.5,
    };
    res.total = res.amount;
    state.resources.push(res);
    return res;
  }

  function placeResource(type, opts = {}) {
    const def = resourceDef(type, !!opts.big);
    for (let i = 0; i < 90; i++) {
      let x, y;
      if (opts.near) {
        const a = rr(0.25, Math.PI - 0.25), d = rr(opts.near[0], opts.near[1]);
        x = state.startX + Math.cos(a) * d * 1.4;
        y = GROUND_Y + ROOT_DY + Math.sin(a) * d;
      } else {
        x = rr(60, WW - 60);
        y = rr(SOIL_TOP + 40, WH - 40);
      }
      if (!freeSpot(x, y, def.size * 0.6)) continue;
      if (opts.awayFromNetwork && nearestNode(x, y).d < 110) continue;
      return makeResource(type, x, y, !!opts.big);
    }
    return null;
  }

  function makeResources(L) {
    placeResource('water', { near: [110, 170] });
    placeResource('organic', { near: [110, 170] });
    for (let i = 0; i < L.pools; i++) placeResource('water', { big: true });
    for (const t of RES_ORDER) for (let i = 0; i < L.plan[t]; i++) placeResource(t);
  }

  function respawn(dt) {
    state.respawnTimer -= dt;
    if (state.respawnTimer > 0) return;
    state.respawnTimer = 3;
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
    if (r) r.fade = -1;
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
    for (let ring = 0; ring < 110; ring++) {
      scan(ring, false);
      if (best >= 0) { scan(ring + 1, true); break; }
    }
    return { i: best, d: bd };
  }

  function treeRoot(i) {
    while (state.nodes[i].parent >= 0) i = state.nodes[i].parent;
    return i;
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
        if (rock) {
          rock.shake = 0.35;
          state.fx.push({ kind: 'blocked', x: px, y: py, t: 0, life: 0.9 });
          msg('Камень! Грибница не может пройти — обойдите его', 2.2);
        } else if (py < SOIL_TOP + 8) {
          trySprout(tip.node, true);
        }
      }
      return;
    }
    const w = Math.max(0.9, tip.w * 0.996);
    tip.w = w;
    tip.node = addNode(chosen.x, chosen.y, tip.node, w);
    tip.angle = chosen.a;
    tip.travelled += STEP;
    if (tip.alive && tip.target && dist(chosen.x, chosen.y, tip.target.x, tip.target.y) < STEP * 1.2) {
      tip.alive = false;
      if (tip.player && chosen.y < SOIL_TOP + SPROUT_DEPTH) trySprout(tip.node, true);
    }
    if (tip.travelled >= tip.maxTravel) tip.alive = false;

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

  function growToward(x, y) {
    x = clamp(x, SOIL_PAD + 2, WW - SOIL_PAD - 2);
    y = clamp(y, SOIL_TOP + 2, WH - SOIL_PAD - 2);
    const { i } = nearestNode(x, y);
    if (i < 0) return null;
    state.fx.push({ kind: 'target', x, y, t: 0, life: 0.8 });
    if (rockHit(x, y)) msg('Там камень — грибница остановится у него', 2);
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
    // a child fed by a bitten thread withers with it
    for (const m of state.mushrooms.slice()) {
      if (m.mother && killed.has(m.node)) {
        removeMushroom(m);
        burst(m.x, GROUND_Y - 10, '170,120,80', 12);
        msg('Нить к грибу-ребёнку перегрызена — он погиб', 3);
      }
    }
    state.needRebuild = true;
    return killed.size;
  }

  // ---- mushrooms: mothers (own root knot) and children (sprouted from the threads)
  function newColony(x, fromSpore) {
    const root = addNode(x, GROUND_Y + ROOT_DY, -1, 3.6);
    for (const a of [Math.PI / 2, Math.PI / 2 + 0.9, Math.PI / 2 - 0.9]) {
      addTip(root, a, null, rr(35, 55), AUTO_SPEED, false);
    }
    const m = { x, node: root, root, mother: null, stage: 0, prevStage: 0, anim: 1, born: state.t, spore: !!fromSpore };
    state.mushrooms.push(m);
    return m;
  }

  function removeMushroom(m) {
    state.mushrooms = state.mushrooms.filter((o) => o !== m);
    for (const h of state.hunters) {
      if (h.target === m) { h.target = null; if (h.state === 'approach' || h.state === 'eat') h.state = h.ground ? 'return' : 'flee'; }
    }
    if (state.sporeFrom === m) state.sporeFrom = null;
  }

  const roomForMore = () => state.mushrooms.length < state.L.maxMushrooms;

  function sproutProblem(x, rootIdx) {
    if (!roomForMore()) return 'В этом уровне больше грибов не вырастить';
    const mother = state.mushrooms.find((m) => !m.mother && m.root === rootIdx);
    if (!mother) return 'У этой нити нет гриба-матери';
    if (mother.stage < CHILD_MIN_STAGE) return 'Матери нужна ' + CHILD_MIN_STAGE + '-я стадия, чтобы вырастить ребёнка';
    if (state.mushrooms.some((m) => Math.abs(m.x - x) < COLONY_GAP)) return 'Слишком близко к другому грибу';
    return null;
  }

  // A player thread reached the grass line: maybe a child mushroom sprouts here.
  function trySprout(nodeIdx, loud) {
    const n = state.nodes[nodeIdx];
    const root = treeRoot(nodeIdx);
    const bad = sproutProblem(n.x, root);
    if (bad) {
      if (loud && state.t - state.sproutMsgAt > 3 && state.L.maxMushrooms > 1) {
        state.sproutMsgAt = state.t;
        msg(bad, 2.5);
      }
      return false;
    }
    const mother = state.mushrooms.find((m) => !m.mother && m.root === root);
    const child = { x: n.x, node: nodeIdx, root, mother, stage: 0, prevStage: 0, anim: 1, born: state.t };
    state.mushrooms.push(child);
    burst(n.x, GROUND_Y, '255,220,140', 14);
    msg('Из корней проклюнулся гриб-ребёнок!', 2.5);
    return true;
  }

  function mushroomBox(m) {
    const im = img['mushroom_' + Math.max(1, m.stage)];
    const w = im.width * MUSH_SCALE, h = im.height * MUSH_SCALE;
    return { x: m.x - w / 2, y: GROUND_Y + 14 - h, w, h };
  }

  function growthTarget() {
    let best = null;
    for (const m of state.mushrooms) {
      if (m.stage >= RIPE) continue;
      if (!best || m.stage > best.stage) best = m;
    }
    return best;
  }

  function updateMushrooms(dt) {
    for (const m of state.mushrooms) m.anim = Math.min(1, m.anim + dt / 0.9);
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
    burst(m.x, GROUND_Y - 30, '255,210,110', 18);
    if (!m.mother && m.stage === CHILD_MIN_STAGE && state.L.maxMushrooms > 1 && !state.motherReadyShown) {
      state.motherReadyShown = true;
      msg('Мать окрепла! Ведите нить к поверхности подальше от неё — там вырастет ребёнок', 5);
    }
    if (m.stage === RIPE) {
      msg(!m.mother && roomForMore() ? 'Гриб созрел! Кликните по нему, чтобы выпустить споры' : 'Гриб созрел!', 4);
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
    burst(m.x, GROUND_Y - 20, '200,120,60', 18);
    const info = HUNTERS[who];
    if (m.mother) {
      removeMushroom(m);
      msg(info.name + ' ' + info.verb + ' гриб-ребёнка!', 3);
    } else {
      m.prevStage = 0; m.stage = 0; m.anim = 1;
      msg(info.name + ' ' + info.verb + ' гриб-мать! Корни вырастят новый', 3);
    }
  }

  // ---- spores: a ripe mother starts an independent colony elsewhere
  const canSpore = (m) => !m.mother && m.stage === RIPE && roomForMore();

  function sporeSpotProblem(x) {
    if (x < 70 || x > WW - 70) return 'Слишком близко к краю';
    if (state.mushrooms.some((m) => Math.abs(m.x - x) < COLONY_GAP)) return 'Слишком близко к другому грибу';
    if (state.spores.some((c) => Math.abs(c.x1 - x) < COLONY_GAP)) return 'Туда уже летят споры';
    if (rockHit(x, GROUND_Y + ROOT_DY, 14)) return 'Под этим местом камень';
    return null;
  }

  function releaseSpores(m, x) {
    m.prevStage = m.stage;
    m.stage = SPORE_DROP_TO;
    m.anim = 0.4;
    const d = Math.abs(x - m.x);
    const cloud = { x0: m.x, y0: GROUND_Y - 150, x1: x, t: 0, dur: 1.2 + d / 1400, dots: [] };
    for (let i = 0; i < 26; i++) cloud.dots.push({ ox: rr(-30, 30), oy: rr(-24, 24), ph: rr(0, 6) });
    state.spores.push(cloud);
    msg('Споры летят!', 2);
  }

  function updateSpores(dt) {
    for (const c of state.spores) {
      c.t += dt / c.dur;
      if (c.t >= 1) c.done = true;
    }
    for (const c of state.spores) {
      if (!c.done) continue;
      if (roomForMore() && !state.mushrooms.some((m) => Math.abs(m.x - c.x1) < COLONY_GAP)) {
        newColony(c.x1, true);
        burst(c.x1, GROUND_Y, '210,160,255', 16);
        msg('Новая колония со своими корнями!', 2.5);
      }
    }
    state.spores = state.spores.filter((c) => !c.done);
  }

  // ---- resource gathering
  function touchResources(nodeIdx) {
    const n = state.nodes[nodeIdx];
    for (const r of state.resources) {
      if (r.connected || r.dead || r.fade < 0) continue;
      if (Math.abs(n.x - r.x) > 80) continue;
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
      if (p.fromRes) {
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
        // the unit pops out of the knot and flies to the counter (screen space)
        state.flyers.push({ type: p.type, x0: clamp(root.x - cam.x, -40, W + 40), y0: clamp(GROUND_Y - 10 - cam.y, -40, H + 40), x1: slot.x, y1: slot.y, t: 0 });
        continue;
      }
      const a = nodes[p.path[p.i]], b = nodes[p.path[p.i + 1]];
      p.x = a.x + (b.x - a.x) * p.frac;
      p.y = a.y + (b.y - a.y) * p.frac;
    }
    state.particles = state.particles.filter((p) => !p.done);

    for (const f of state.flyers) {
      f.t += dt / 0.75;
      if (f.t >= 1) { f.done = true; state.counts[f.type]++; state.bump[f.type] = 1; }
    }
    state.flyers = state.flyers.filter((f) => !f.done);
    for (const t of RES_ORDER) state.bump[t] = Math.max(0, state.bump[t] - dt * 3);
  }

  // ---- hunters on the surface: rabbit, hedgehog, squirrel, bird
  function makeHunters(L) {
    for (const kind of ['rabbit', 'hedgehog', 'squirrel']) {
      const threat = L.hunters.includes(kind);
      // calm first level: a few animals as scenery; later only real hunters roam the forest
      if (!threat && levelIndex > 0) continue;
      const home = threat ? rr(200, WW - 200) : state.startX + { rabbit: 300, hedgehog: -320, squirrel: -520 }[kind];
      state.hunters.push({
        kind, info: HUNTERS[kind], threat, ground: true,
        x: home, y: 0, home, dir: rand() < 0.5 ? -1 : 1,
        state: 'idle', timer: rr(1, 3), target: null, eatT: 0, carrying: 0, hop: 0, walkT: 0,
      });
    }
    if (L.hunters.includes('bird')) {
      state.hunters.push({
        kind: 'bird', info: HUNTERS.bird, threat: true, ground: false,
        x: -300, y: 100, dir: 1, state: 'away', timer: 4, target: null, eatT: 0, walkT: 0,
      });
    }
  }

  const preyFor = (h, m) => m.stage >= h.info.prey[0] && m.stage <= h.info.prey[1];

  function hunterBox(h) {
    const im = img[h.ground ? h.kind : 'bluetit'];
    const w = im.width * h.info.scale, hh = im.height * h.info.scale;
    if (!h.ground) return { x: h.x - w / 2, y: h.y - hh / 2, w, h: hh };
    return { x: h.x - w / 2, y: GROUND_Y + 12 + h.y - hh, w, h: hh };
  }

  function scareHunter(h) {
    h.state = 'flee';
    h.target = null;
    h.dir = h.x < cam.x + W / 2 ? -1 : 1;
    burst(h.x, h.ground ? GROUND_Y - 30 : h.y, '255,240,200', 8);
    msg(h.info.name + (h.kind === 'bird' ? ' улетает!' : ' убегает!'), 1.6);
  }

  function moveToward(a, tx, speed, dt) {
    const d = tx - a.x;
    if (Math.abs(d) < 2) return true;
    a.dir = Math.sign(d);
    a.x += a.dir * Math.min(Math.abs(d), speed * dt);
    a.walkT += dt;
    return false;
  }

  function updateHunters(dt) {
    for (const h of state.hunters) {
      if (h.ground) updateGroundHunter(h, dt);
      else updateBird(h, dt);
    }
    if (!state.L.attackEvery) return;
    state.attackTimer -= dt;
    if (state.attackTimer > 0) return;
    const free = state.hunters.filter((h) => h.threat && ['idle', 'away', 'return'].includes(h.state));
    const options = [];
    for (const h of free) {
      for (const m of state.mushrooms) {
        if (!preyFor(h, m) || state.hunters.some((o) => o.target === m)) continue;
        // children are the favourite target
        options.push({ h, m, score: Math.abs(h.x - m.x) / 1000 + (m.mother ? -0.6 : 0) + rand() });
      }
    }
    if (!options.length) { state.attackTimer = 3; return; }
    const ev = state.L.attackEvery;
    state.attackTimer = rr(ev[0], ev[1]);
    options.sort((a, b) => a.score - b.score);
    const { h, m } = options[0];
    h.target = m;
    if (h.ground) {
      if (h.state === 'away') h.x = m.x < WW / 2 ? -100 : WW + 100;
      h.state = 'approach';
    } else {
      h.state = 'swoop';
      h.x = m.x + (rand() < 0.5 ? -1 : 1) * 900;
      h.y = 60;
    }
    msg(h.info.name + (h.kind === 'bird' ? ' летит к ' : ' идёт к ') + (m.mother ? 'грибу-ребёнку' : 'грибу') + '! Кликните, чтобы спугнуть', 3);
  }

  function targetValid(h) {
    return h.target && state.mushrooms.includes(h.target) && preyFor(h, h.target);
  }

  function updateGroundHunter(h, dt) {
    const bounce = () => (h.kind === 'rabbit' ? -Math.abs(Math.sin(h.walkT * 7)) * 18 : 0);
    switch (h.state) {
      case 'idle': ambientHunter(h, dt); break;
      case 'approach': {
        if (!targetValid(h)) { h.state = 'return'; break; }
        const side = h.x < h.target.x ? -1 : 1;
        if (moveToward(h, h.target.x + side * 46, h.info.speed, dt)) { h.state = 'eat'; h.eatT = 0; h.dir = -side; }
        h.y = bounce();
        break;
      }
      case 'eat':
        h.y = 0;
        if (!targetValid(h)) { h.state = 'return'; break; }
        h.eatT += dt;
        if (h.eatT >= h.info.eat) {
          const m = h.target;
          h.target = null;
          if (h.kind === 'squirrel') {
            h.carrying = m.stage;
            loseMushroom(m, h.kind);
            h.state = 'carry';
            h.dir = h.x < WW / 2 ? -1 : 1;
          } else {
            loseMushroom(m, h.kind);
            h.state = 'return';
          }
        }
        break;
      case 'flee':
      case 'carry':
        h.x += h.dir * (h.state === 'flee' ? 380 : 260) * dt;
        h.walkT += dt;
        h.y = h.kind === 'rabbit' ? -Math.abs(Math.sin(h.walkT * 9)) * 22 : 0;
        if (h.x < -120 || h.x > WW + 120 || (h.state === 'flee' && Math.abs(h.x - cam.x - W / 2) > W)) {
          h.state = 'away'; h.timer = rr(6, 10); h.carrying = 0;
          if (h.x > -120 && h.x < WW + 120) h.x = h.dir < 0 ? -110 : WW + 110;
        }
        break;
      case 'away':
        h.timer -= dt;
        if (h.timer <= 0) h.state = 'return';
        break;
      case 'return':
        h.y = bounce();
        if (moveToward(h, h.home, h.info.speed * 0.7, dt)) { h.state = 'idle'; h.y = 0; h.timer = rr(1, 3); }
        break;
    }
  }

  function updateBird(h, dt) {
    h.walkT += dt;
    if (h.state === 'away') return;
    if (h.state === 'swoop') {
      if (!targetValid(h)) { h.state = 'flee'; return; }
      const tx = h.target.x - 20, ty = mushroomBox(h.target).y - 4;
      const d = dist(h.x, h.y, tx, ty);
      h.dir = tx >= h.x ? 1 : -1;
      if (d < 6) { h.state = 'eat'; h.eatT = 0; return; }
      const sp = Math.min(d, h.info.speed * dt);
      h.x += (tx - h.x) / d * sp;
      h.y += (ty - h.y) / d * sp;
    } else if (h.state === 'eat') {
      if (!targetValid(h)) { h.state = 'flee'; return; }
      h.eatT += dt;
      if (h.eatT >= h.info.eat) { const m = h.target; h.target = null; h.state = 'flee'; loseMushroom(m, 'bird'); }
    } else if (h.state === 'flee') {
      h.x += h.dir * 380 * dt;
      h.y -= 200 * dt;
      if (h.y < -120) { h.state = 'away'; h.y = 80; }
    }
  }

  function ambientHunter(h, dt) {
    h.y = 0;
    if (h.kind === 'rabbit') {
      if (h.hop <= 0) {
        h.timer -= dt;
        if (h.timer <= 0) {
          h.hop = 0.001; h.from = h.x;
          h.to = clamp(h.x + rr(-90, 90), h.home - 120, h.home + 120);
          if (Math.abs(h.to - h.from) < 25) h.to = h.from + (h.from < h.home ? 50 : -50);
          h.dir = Math.sign(h.to - h.from);
        }
      } else {
        h.hop += dt / 0.45;
        const k = Math.min(1, h.hop);
        h.x = h.from + (h.to - h.from) * k;
        h.y = -Math.sin(k * Math.PI) * 26;
        if (h.hop >= 1) { h.hop = 0; h.y = 0; h.timer = rr(2.5, 6); }
      }
    } else if (h.kind === 'hedgehog') {
      if (h.timer > 0) { h.timer -= dt; return; }
      h.x += h.dir * 22 * dt;
      h.walkT += dt;
      if (Math.abs(h.x - h.home) > 120) { h.dir = Math.sign(h.home - h.x); h.timer = rr(1, 3); }
      else if (rand() < dt * 0.08) h.timer = rr(0.8, 2.5);
    }
  }

  function updateAmbient(dt) {
    for (const d of state.decor) {
      if (!d.robin) continue;
      d.wait -= dt;
      if (d.wait <= 0) { d.peck = 1; d.wait = rr(1.2, 4); }
      d.peck = Math.max(0, d.peck - dt * 3);
    }
    const t = state.bluetit;
    if (state.L.hunters.includes('bird')) { t.active = false; return; }
    if (!t.active) {
      t.wait -= dt;
      if (t.wait <= 0) { t.active = true; t.dir = rand() < 0.5 ? 1 : -1; t.x = cam.x + (t.dir > 0 ? -120 : W + 120); t.baseY = rr(70, 200); }
    } else {
      t.x += t.dir * 210 * dt;
      t.y = t.baseY + Math.sin(state.t * 5) * 14;
      if (t.x > cam.x + W + 150 || t.x < cam.x - 150) { t.active = false; t.wait = rr(8, 16); }
    }
  }

  // ---- grubs: crawl to a thread and bite it once
  function spawnNear(x, y, minD, maxD) {
    for (let k = 0; k < 30; k++) {
      const a = rr(0, Math.PI * 2), d = rr(minD, maxD);
      const px = x + Math.cos(a) * d, py = y + Math.abs(Math.sin(a)) * d * 0.7 + 40;
      if (!outOfSoil(px, py) && py > SOIL_TOP + 60 && !rockHit(px, py, 20)) return { x: px, y: py };
    }
    return { x: x < WW / 2 ? 30 : WW - 30, y: clamp(y + 200, SOIL_TOP + 80, WH - 40) };
  }

  function biteable() {
    const out = [];
    const nodes = state.nodes;
    for (let i = 0; i < nodes.length; i += 4) if (!nodes[i].dead && nodes[i].depth >= GRUB_SAFE_DEPTH) out.push(i);
    return out;
  }

  function grubTarget(g) {
    let best = -1, bd = Infinity;
    for (const i of biteable()) {
      const n = state.nodes[i];
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
        const cands = biteable();
        if (state.grubs.filter((g) => g.state !== 'flee').length < G.max && cands.length) {
          const n = state.nodes[pick(cands)];
          const p = spawnNear(n.x, n.y, 380, 600);
          state.grubs.push({ x: p.x, y: p.y, dir: 1, state: 'seek', target: -1, t: 0, chew: 0, wig: rr(0, 6) });
          if (!state.grubWarned) { state.grubWarned = true; msg('Личинка! Кликните по ней, пока она не перегрызла нить', 3.5); }
        }
      }
    }
    for (const g of state.grubs) {
      g.t += dt;
      if (g.state === 'flee') {
        g.x += g.dir * 140 * dt;
        g.y += 20 * dt;
        if (g.t > 6 || g.x < -60 || g.x > WW + 60) g.gone = true;
        continue;
      }
      if (g.target < 0 || state.nodes[g.target].dead) g.target = grubTarget(g);
      if (g.target < 0) { g.state = 'flee'; g.t = 0; g.dir = g.x < WW / 2 ? -1 : 1; continue; }
      const n = state.nodes[g.target];
      const d = dist(n.x, n.y, g.x, g.y);
      if (g.state === 'seek') {
        if (d < 8) { g.state = 'chew'; g.chew = CHEW_TIME; continue; }
        const sp = 30 * dt;
        g.dir = n.x >= g.x ? 1 : -1;
        g.x += (n.x - g.x) / d * sp;
        g.y += (n.y - g.y) / d * sp;
        if (rand() < dt * 0.4) g.target = grubTarget(g);
      } else if (g.state === 'chew') {
        g.chew -= dt;
        if (g.chew <= 0) {
          const lost = killSubtree(g.target);
          state.fx.push({ kind: 'bite', x: n.x, y: n.y, t: 0, life: 0.8 });
          if (lost > 3) msg('Личинка перегрызла нить — отрезанная часть засохла', 2.5);
          g.target = -1;
          g.state = 'flee'; g.t = 0;
          g.dir = g.x < WW / 2 ? -1 : 1;
        }
      }
    }
    state.grubs = state.grubs.filter((g) => !g.gone);
  }

  // ---- ants: carry resources away underground
  function updateAnts(dt) {
    const A = state.L.ants;
    if (A) {
      state.antTimer -= dt;
      if (state.antTimer <= 0) {
        state.antTimer = rr(A.every[0], A.every[1]);
        const prey = state.resources.filter((r) => !r.dead && r.fade >= 0 && r.amount > 0 &&
          !state.ants.some((a) => a.target === r));
        if (state.ants.filter((a) => a.state !== 'flee').length < A.max && prey.length) {
          // ants go for what the network already taps, or anything else
          prey.sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0) + rr(-0.6, 0.6));
          const r = prey[0];
          const p = spawnNear(r.x, r.y, 380, 560);
          state.ants.push({ x: p.x, y: p.y, dir: 1, state: 'seek', target: r, t: 0, grab: 0, loot: null });
          if (!state.antWarned) { state.antWarned = true; msg('Муравей идёт за ресурсом! Кликните по нему', 3.5); }
        }
      }
    }
    for (const a of state.ants) {
      a.t += dt;
      if (a.state === 'flee' || a.state === 'carry') {
        a.x += a.dir * (a.state === 'flee' ? 160 : 70) * dt;
        if (a.x < -60 || a.x > WW + 60 || (a.state === 'flee' && a.t > 5)) a.gone = true;
        continue;
      }
      const r = a.target;
      if (!r || r.dead || !state.resources.includes(r)) { a.state = 'flee'; a.t = 0; a.dir = a.x < WW / 2 ? -1 : 1; continue; }
      const d = dist(a.x, a.y, r.x, r.y);
      if (a.state === 'seek') {
        if (d < r.radius + 4) { a.state = 'grab'; a.grab = 1.8; continue; }
        const sp = 48 * dt;
        a.dir = r.x >= a.x ? 1 : -1;
        a.x += (r.x - a.x) / d * sp;
        a.y += (r.y - a.y) / d * sp;
      } else if (a.state === 'grab') {
        a.grab -= dt;
        if (a.grab <= 0) {
          a.loot = { type: r.type, amount: r.amount, big: r.s === 'water_pool' };
          r.dead = true; r.fade = 0.999; r.connected = false;
          a.state = 'carry';
          a.dir = a.x < WW / 2 ? -1 : 1;
          msg('Муравей утащил ресурс: ' + RES[r.type].name.toLowerCase() + '!', 2.5);
        }
      }
    }
    state.ants = state.ants.filter((a) => !a.gone);
  }

  function scareAnt(a) {
    if (a.state === 'carry' && a.loot) { // drops the loot where it stands
      const r = makeResource(a.loot.type, a.x, clamp(a.y, SOIL_TOP + 30, WH - 30), a.loot.big, a.loot.amount);
      msg('Муравей бросил добычу!', 1.8);
      const { i, d } = nearestNode(r.x, r.y);
      if (i >= 0 && d <= r.radius + 6) touchResources(i);
    } else msg('Муравей убегает!', 1.4);
    a.loot = null;
    a.state = 'flee'; a.t = 0;
    a.dir = a.x < cam.x + W / 2 ? -1 : 1;
  }

  // ---- underground ambient critters
  function makeCritters() {
    state.critters = [];
    for (let i = 0; i < Math.round(WW / 900); i++) {
      state.critters.push({ s: pick(['worm', 'woodlouse']), x: rr(100, WW - 100), y: rr(SOIL_TOP + 120, WH - 60), dir: rand() < 0.5 ? -1 : 1, speed: rr(8, 13), scale: 0.22 });
    }
    for (const c of state.critters) for (let k = 0; k < 40 && rockHit(c.x, c.y, 40); k++) c.x = rr(80, WW - 80);
  }

  function updateCritters(dt) {
    for (const c of state.critters) {
      const nx = c.x + c.dir * c.speed * dt;
      const ahead = nx + c.dir * 45;
      if (rockHit(ahead, c.y, 8) || ahead < 30 || ahead > WW - 30) c.dir *= -1;
      else c.x = nx;
    }
  }

  // ---- goals
  function goalLines() {
    const g = state.L.goal;
    const ms = state.mushrooms;
    const lines = [];
    if (g.roots) lines.push({ text: 'Колонии со своими корнями', have: ms.filter((m) => !m.mother).length, need: g.roots });
    if (g.children) lines.push({ text: 'Подросшие дети (стадия ' + CHILD_GOAL_STAGE + '+)', have: ms.filter((m) => m.mother && m.stage >= CHILD_GOAL_STAGE).length, need: g.children });
    if (g.mushrooms) lines.push({ text: 'Всего грибов', have: ms.length, need: g.mushrooms });
    if (g.ripeNow) lines.push({ text: g.ripeNow > 1 ? 'Зрелых грибов сразу' : 'Зрелый гриб', have: ms.filter((m) => m.stage >= RIPE).length, need: g.ripeNow });
    return lines;
  }

  function checkWin() {
    if (!goalLines().every((l) => l.have >= l.need)) return;
    const par = state.L.par;
    let stars = state.time <= par ? 3 : state.time <= par * 1.6 ? 2 : 1;
    if (state.lost >= 4) stars = Math.max(1, stars - 1);
    state.result = { stars, time: state.time };
    progress.stars[levelIndex] = Math.max(progress.stars[levelIndex] || 0, stars);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
    saveProgress();
    mode = 'won';
    for (const m of state.mushrooms) burst(m.x, GROUND_Y - 60, '255,220,140', 16);
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

  // ---------------------------------------------------------------- rendering: world
  function buildSoil() {
    // a repeating tile of grain and pebbles
    const T = 512;
    soilTile = makeCanvas(T * RS, T * RS);
    const s = soilTile.getContext('2d');
    s.setTransform(RS, 0, 0, RS, 0, 0);
    const saved = seed;
    seed = 4242;
    for (let i = 0; i < 1100; i++) {
      const x = rr(0, T), y = rr(0, T), l = rr(-30, 30);
      s.fillStyle = `rgba(${120 + l},${70 + l * 0.6},${40 + l * 0.4},${rr(0.12, 0.4)})`;
      s.fillRect(x, y, rr(1, 3), rr(1, 3));
    }
    for (let i = 0; i < 26; i++) {
      const x = rr(14, T - 14), y = rr(14, T - 14), rx = rr(3, 11), ry = rx * rr(0.5, 0.8);
      s.fillStyle = `rgba(${rr(50, 90)},${rr(38, 60)},${rr(30, 45)},0.8)`;
      s.beginPath(); s.ellipse(x, y, rx, ry, rr(-0.5, 0.5), 0, Math.PI * 2); s.fill();
      s.fillStyle = 'rgba(255,230,200,0.10)';
      s.beginPath(); s.ellipse(x - rx * 0.25, y - ry * 0.35, rx * 0.5, ry * 0.35, 0, 0, Math.PI * 2); s.fill();
    }
    soilPattern = ctx.createPattern(soilTile, 'repeat');
    if (soilPattern.setTransform) soilPattern.setTransform(new DOMMatrix([1 / RS, 0, 0, 1 / RS, 0, 0]));

    // painted soil tiles along the grass line, faded into the deep soil
    stripCanvas = makeCanvas(WW * RS, 230 * RS);
    const st = stripCanvas.getContext('2d');
    st.setTransform(RS, 0, 0, RS, 0, 0);
    let x = -20;
    while (x < WW) {
      const im = img[pick(['soil_tile_1', 'soil_tile_2', 'soil_tile_3'])];
      const tw = im.width * 0.62, th = im.height * 0.62;
      st.drawImage(im, x, 0, tw, th);
      x += tw - 16;
    }
    st.globalCompositeOperation = 'destination-in';
    const fade = st.createLinearGradient(0, 0, 0, 230);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.4, 'rgba(0,0,0,1)');
    fade.addColorStop(0.97, 'rgba(0,0,0,0)');
    st.fillStyle = fade;
    st.fillRect(0, 0, WW, 230);
    seed = saved;
  }

  // Mycelium glow is drawn in code into persistent tiles: every new segment is
  // stroked once (soft halo + bright core); each frame the visible tiles are
  // composited additively with a slow "breathing" pulse.
  function tileAt(tx, ty) {
    const key = tx * 4096 + ty;
    let t = tiles.get(key);
    if (!t) {
      const c = makeCanvas(TILE * TS, TILE * TS);
      const g = c.getContext('2d');
      g.setTransform(TS, 0, 0, TS, -tx * TILE * TS, -ty * TILE * TS);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      t = { c, g, tx, ty };
      tiles.set(key, t);
    }
    return t;
  }

  function drawSegment(a, b) {
    const m = 34;
    const tx0 = Math.floor((Math.min(a.x, b.x) - m) / TILE), tx1 = Math.floor((Math.max(a.x, b.x) + m) / TILE);
    const ty0 = Math.floor((Math.min(a.y, b.y) - m) / TILE), ty1 = Math.floor((Math.max(a.y, b.y) + m) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const g = tileAt(tx, ty).g;
        g.shadowColor = 'rgba(255,150,40,0.9)';
        g.shadowBlur = 18 * TS;
        g.strokeStyle = 'rgba(255,140,35,0.16)';
        g.lineWidth = b.w * 6 + 4;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.shadowColor = 'rgba(255,190,80,1)';
        g.shadowBlur = 6 * TS;
        g.strokeStyle = 'rgba(255,233,160,0.95)';
        g.lineWidth = b.w;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        if (b.w > 1.6) {
          g.shadowBlur = 0;
          g.strokeStyle = 'rgba(255,255,235,0.8)';
          g.lineWidth = b.w * 0.4;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
      }
    }
  }

  function rebuildMycelium() {
    tiles = new Map();
    const nodes = state.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.parent >= 0 && !n.dead) drawSegment(nodes[n.parent], n);
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

  const view = () => ({ x0: cam.x - 60, x1: cam.x + W + 60, y0: cam.y - 60, y1: cam.y + H + 60 });
  const visibleX = (x, pad = 300) => x > cam.x - pad && x < cam.x + W + pad;

  // screen space, parallax: the painted forest is mirrored every other copy so it tiles
  function drawBackdrop() {
    ctx.fillStyle = '#1b100a';
    ctx.fillRect(0, 0, W, H);
    const bg = img.background;
    const srcH = 800;
    const dh = srcH * (W / bg.width);
    const y = GROUND_Y + 14 - dh - cam.y;
    if (y + dh <= 0) return;
    const px = cam.x * 0.55;
    const k0 = Math.floor(px / W);
    for (let k = k0; k <= k0 + 1; k++) {
      const x = k * W - px;
      ctx.save();
      if (k % 2) { ctx.translate(x + W, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
      ctx.drawImage(bg, 0, 0, bg.width, srcH, -0.5, 0, W + 1, dh);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = 380 + i * 260 + Math.sin(state.t * 0.2 + i) * 30;
      const a = 0.045 + 0.025 * Math.sin(state.t * 0.5 + i * 1.7);
      const g = ctx.createLinearGradient(x, -cam.y, x - 160, GROUND_Y - cam.y);
      g.addColorStop(0, `rgba(255,240,180,${a})`);
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 30, -cam.y); ctx.lineTo(x + 40, -cam.y); ctx.lineTo(x - 120, GROUND_Y - cam.y); ctx.lineTo(x - 260, GROUND_Y - cam.y);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSoil() {
    const v = view();
    const top = Math.max(GROUND_Y + 20, v.y0);
    if (v.y1 <= top) return;
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, WH);
    g.addColorStop(0, '#73401f');
    g.addColorStop(Math.min(0.9, 200 / (WH - GROUND_Y)), '#6a3a1e');
    g.addColorStop(Math.min(0.95, 520 / (WH - GROUND_Y)), '#4a2816');
    g.addColorStop(1, '#170c07');
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, top, v.x1 - v.x0, v.y1 - top);
    ctx.fillStyle = soilPattern;
    ctx.fillRect(v.x0, top, v.x1 - v.x0, v.y1 - top);
    if (v.y0 < GROUND_Y + 190) { // the painted strip along the grass line
      const sx = clamp(v.x0, 0, WW), ex = clamp(v.x1, 0, WW);
      if (ex > sx) ctx.drawImage(stripCanvas, sx * RS, 0, (ex - sx) * RS, 230 * RS, sx, GROUND_Y - 42, ex - sx, 230);
    }
    const d = ctx.createLinearGradient(0, GROUND_Y + 40, 0, WH);
    d.addColorStop(0, 'rgba(10,4,2,0.10)');
    d.addColorStop(1, 'rgba(6,2,1,0.55)');
    ctx.fillStyle = d;
    const dTop = Math.max(GROUND_Y + 40, v.y0);
    ctx.fillRect(v.x0, dTop, v.x1 - v.x0, v.y1 - dTop);
    if (v.y1 > WH - 30) { // bedrock at the very bottom of the world
      ctx.fillStyle = 'rgba(30,22,20,0.95)';
      ctx.fillRect(v.x0, WH - 8, v.x1 - v.x0, 40);
    }
  }

  function drawUnderground() {
    drawSoil();
    for (const d of state.decor) {
      if (d.layer !== -1 || !visibleX(d.x)) continue;
      const im = img[d.s];
      ctx.save(); ctx.globalAlpha = 0.9;
      drawSprite(ctx, im, d.x, GROUND_Y + 14 + im.height * d.scale, d.scale, d.flip);
      ctx.restore();
    }
    for (const c of state.critters) {
      if (!visibleX(c.x)) continue;
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
    const v = view();
    for (const r of state.rocks) {
      if (r.cx + r.rx < v.x0 || r.cx - r.rx > v.x1 || r.cy + r.ry < v.y0 || r.cy - r.ry > v.y1 + 40) continue;
      const sh = r.shake ? Math.sin(r.shake * 70) * r.shake * 8 : 0;
      drawSprite(ctx, img[r.s], r.x + sh, r.bottom, r.scale, r.flip);
    }
  }

  function drawResources() {
    const v = view();
    for (const r of state.resources) {
      if (r.x < v.x0 - 60 || r.x > v.x1 + 60 || r.y < v.y0 - 60 || r.y > v.y1 + 60) continue;
      const im = img[r.s];
      const vis = r.fade < 0 ? 1 + r.fade : (r.dead ? 1 - r.fade : 1);
      const left = r.dead ? 0.3 : 0.55 + 0.45 * (r.amount / r.total);
      const bob = Math.sin(state.t * 1.6 + r.phase) * 2.5;
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 3 + r.phase);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(r.x, r.y + bob, r.size * (r.connected ? 1.1 + pulse * 0.25 : 0.8), RES[r.type].glow,
        (r.connected ? 0.45 : 0.18 + pulse * 0.08 + (r.rich ? 0.1 : 0)) * vis);
      ctx.restore();
      const sc = (r.size / Math.max(im.width, im.height)) * left;
      drawSprite(ctx, im, r.x, r.y + bob + im.height * sc / 2, sc, false, vis);
    }
  }

  function drawMycelium() {
    const t = state.t;
    const v = view();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.82 + 0.18 * Math.sin(t * 1.5);
    for (const tile of tiles.values()) {
      const x = tile.tx * TILE, y = tile.ty * TILE;
      if (x > v.x1 || x + TILE < v.x0 || y > v.y1 || y + TILE < v.y0) continue;
      ctx.drawImage(tile.c, x, y, TILE, TILE);
    }
    ctx.restore();

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
      if (!r.connected || r.dead || !visibleX(r.x)) continue;
      const n = state.nodes[r.node];
      ctx.strokeStyle = `rgba(${RES[r.type].glow},0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
    for (const m of state.mushrooms) {
      if (!visibleX(m.x)) continue;
      const n = state.nodes[m.node];
      glowDot(n.x, n.y, (m.mother ? 18 : 30) + Math.sin(t * 2 + m.x) * 5, '255,170,50', 0.5);
    }
    for (const tip of state.tips) {
      const n = state.nodes[tip.node];
      if (!visibleX(n.x)) continue;
      const big = tip.player ? 16 : 7;
      glowDot(n.x, n.y, big + Math.sin(t * 9 + tip.born) * 2.5, '255,190,70', tip.player ? 0.95 : 0.6);
    }
    for (const p of state.particles) if (visibleX(p.x, 40)) glowDot(p.x, p.y, 11, RES[p.type].glow, 0.95);
    ctx.restore();
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

  function drawPests() {
    for (const g of state.grubs) {
      if (!visibleX(g.x, 80)) continue;
      const im = img.grub, sc = 0.3;
      const chewing = g.state === 'chew';
      const wig = Math.sin(g.t * (chewing ? 18 : 6) + g.wig) * (chewing ? 0.08 : 0.05);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowDot(g.x, g.y, 42 + Math.sin(g.t * 6) * 5, '255,60,40', g.state === 'flee' ? 0.15 : 0.55);
      ctx.restore();
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(g.dir > 0 ? -1 : 1, 1);
      ctx.scale(1 + wig, 1 - wig);
      ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
      ctx.restore();
      if (chewing) ring(g.x, g.y - 34, 12, 1 - g.chew / CHEW_TIME, '#ff6a50');
    }
    for (const a of state.ants) {
      if (!visibleX(a.x, 80)) continue;
      const im = img.ant, sc = 0.22;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowDot(a.x, a.y, 36 + Math.sin(a.t * 7) * 4, '255,60,40', a.state === 'flee' ? 0.12 : 0.5);
      ctx.restore();
      ctx.save();
      ctx.translate(a.x, a.y + Math.sin(a.t * 20));
      ctx.scale(a.dir > 0 ? -1 : 1, 1);
      ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
      ctx.restore();
      if (a.state === 'carry' && a.loot) {
        const li = img[resourceDef(a.loot.type, a.loot.big).s];
        drawSprite(ctx, li, a.x + a.dir * 12, a.y - 6, 24 / Math.max(li.width, li.height));
      }
      if (a.state === 'grab') ring(a.x, a.y - 30, 11, 1 - a.grab / 1.8, '#ff6a50');
    }
  }

  function drawHunter(h) {
    if (h.state === 'away' || !visibleX(h.x, 200)) return;
    if (h.ground) {
      const im = img[h.kind];
      const bottom = GROUND_Y + 12 + h.y;
      let rot = 0;
      if (h.kind === 'squirrel' && h.state === 'idle') rot = Math.sin(state.t * 1.4) * 0.015;
      if (h.state === 'eat') rot = Math.sin(state.t * 14) * 0.04;
      const step = h.kind === 'hedgehog' && ['approach', 'return', 'flee'].includes(h.state) ? Math.abs(Math.sin(h.walkT * 9)) * 2 : 0;
      drawSprite(ctx, im, h.x, bottom - step, h.info.scale, h.dir < 0, 1, rot);
      if (h.carrying) {
        const mi = img['mushroom_' + h.carrying];
        drawSprite(ctx, mi, h.x - h.dir * 10, bottom - im.height * h.info.scale * 0.55, MUSH_SCALE * 0.5, false, 1, h.dir * 0.4);
      }
    } else {
      const im = img.bluetit;
      const flap = h.state === 'eat' ? Math.sin(state.t * 20) * 0.12 : Math.sin(state.t * 14) * 0.06;
      drawSprite(ctx, im, h.x, h.y + im.height * h.info.scale / 2, h.info.scale, h.dir < 0, 1, flap);
    }
    if (h.state === 'approach' || h.state === 'eat' || h.state === 'swoop') {
      const box = hunterBox(h);
      const y = box.y - 22 + Math.sin(state.t * 8) * 3;
      ctx.save();
      ctx.fillStyle = '#e8402f';
      ctx.beginPath(); ctx.arc(h.x, y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff3e0'; ctx.stroke();
      ctx.restore();
      text('!', h.x, y + 1, 20, '#fff3e0', 'center');
      if (h.state === 'eat' && h.target) ring(h.target.x, mushroomBox(h.target).y - 30, 14, h.eatT / h.info.eat, '#ff6a50');
    }
  }

  function drawSurface() {
    for (const d of state.decor) {
      if (d.layer !== 0 || !visibleX(d.x, 400)) continue;
      drawSprite(ctx, img[d.s], d.x, GROUND_Y + 14, d.scale, d.flip);
    }
    for (const d of state.decor) {
      if (d.layer !== 1 || !visibleX(d.x)) continue;
      drawSprite(ctx, img[d.s], d.x, GROUND_Y + 13, d.scale, d.flip, 1, d.robin ? Math.sin(d.peck * Math.PI) * 0.35 : 0);
    }
    for (const m of state.mushrooms) if (visibleX(m.x)) drawMushroom(m);
    for (const h of state.hunters) if (h.ground) drawHunter(h);
    for (const d of state.decor) {
      if (d.layer !== 2 || !visibleX(d.x)) continue;
      drawSprite(ctx, img[d.s], d.x, GROUND_Y + 17, d.scale, d.flip);
    }
    for (const m of state.mushrooms) if (visibleX(m.x)) drawMushroomLabel(m);
    for (const h of state.hunters) if (!h.ground) drawHunter(h);
    const bt = state.bluetit;
    if (bt.active) drawSprite(ctx, img.bluetit, bt.x, bt.y, 0.22, bt.dir < 0, 1, Math.sin(state.t * 14) * 0.06);
  }

  function drawMushroom(m) {
    const base = GROUND_Y + 14;
    const t = state.t;
    if (m.stage === 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(m.x, GROUND_Y + 2, (m.mother ? 18 : 24) + Math.sin(t * 2.5 + m.x) * 5, '255,190,80', 0.5);
      ctx.restore();
      return;
    }
    const k = m.anim;
    const sway = Math.sin(t * 1.1 + m.x) * 0.012;
    if (canSpore(m) && mode === 'play') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(m.x, base - 120, 120 + Math.sin(t * 3) * 14, '220,170,255', state.sporeFrom === m ? 0.45 : 0.25);
      ctx.restore();
    }
    if (k < 1 && m.prevStage > 0) drawSprite(ctx, img['mushroom_' + m.prevStage], m.x, base, MUSH_SCALE, false, 1 - k, sway);
    const s = MUSH_SCALE * (k < 1 ? 0.6 + 0.4 * easeOutBack(k) : 1);
    const squash = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.06 : 1;
    ctx.save();
    ctx.translate(m.x, base);
    ctx.scale(squash, 1 / squash);
    drawSprite(ctx, img['mushroom_' + m.stage], 0, 0, s, false, Math.min(1, k * 2 + 0.2), sway);
    ctx.restore();
    if (m.stage === RIPE) {
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
    const box = m.stage ? mushroomBox(m) : { y: GROUND_Y - 20 };
    const y = box.y - 10;
    ctx.save();
    for (let i = 0; i < RIPE; i++) {
      ctx.fillStyle = i < m.stage ? (m.mother ? '#ffe9a8' : '#ffd27a') : 'rgba(30,18,10,0.6)';
      ctx.strokeStyle = 'rgba(30,18,10,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.x - 25 + i * 10, y, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    if (m.mother) text('ребёнок', m.x, y - 15, 12, 'rgba(255,240,210,0.85)', 'center', 600);
    if (canSpore(m) && mode === 'play') {
      ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(state.t * 4);
      text(state.sporeFrom === m ? 'Куда? Кликните по поверхности' : 'Споры готовы!', m.x, y - 20, 16, '#e9d2ff', 'center');
      ctx.restore();
    }
  }

  function drawSporeAim() {
    const m = state.sporeFrom;
    const p = state.pointer;
    if (!m || !p) return;
    const x = clamp(p.wx, 0, WW);
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
    ctx.restore();
    if (bad) text(bad, x, GROUND_Y - 28, 15, '#ffb3a6', 'center');
  }

  function drawSporeClouds() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of state.spores) {
      const k = c.t, e = k * k * (3 - 2 * k);
      const cx = c.x0 + (c.x1 - c.x0) * e;
      const cy = c.y0 + (GROUND_Y - c.y0) * e - Math.sin(k * Math.PI) * 160;
      for (const d of c.dots) {
        const spread = 0.4 + Math.sin(k * Math.PI) * 0.8;
        glowDot(cx + d.ox * spread + Math.sin(state.t * 4 + d.ph) * 4, cy + d.oy * spread, 7, '220,170,255', 0.8);
      }
    }
    ctx.restore();
  }

  function drawWorldFx() {
    ctx.save();
    for (const f of state.fx) {
      if (!visibleX(f.x, 60)) continue;
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
  }

  function drawCursor() {
    const p = state.pointer;
    if (!p || p.wy < SOIL_TOP || state.sporeFrom || mode !== 'play' || state.drag) return;
    if (hoverTarget(p)) return;
    const { i } = nearestNode(p.wx, p.wy);
    if (i < 0) return;
    const n = state.nodes[i];
    // near the grass line: tell whether a child could sprout here
    let note = null, good = false;
    if (p.wy < SOIL_TOP + 40 && state.L.maxMushrooms > 1) {
      const bad = sproutProblem(p.wx, treeRoot(i));
      note = bad || 'Здесь вырастет гриб-ребёнок';
      good = !bad;
    }
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.lineDashOffset = -state.t * 30;
    const onRock = rockHit(p.wx, p.wy);
    ctx.strokeStyle = onRock ? 'rgba(255,120,90,0.55)' : good ? 'rgba(160,255,140,0.75)' : 'rgba(255,225,150,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(p.wx, p.wy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p.wx, p.wy, good ? 14 : 9, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (note) text(note, p.wx, GROUND_Y - 34, 15, good ? '#bfffaa' : '#ffd9b0', 'center');
  }

  // ---------------------------------------------------------------- rendering: HUD
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
    if (opts.primary) { g.addColorStop(0, hot ? '#f6c25e' : '#e8a83f'); g.addColorStop(1, hot ? '#c47b25' : '#a9641d'); }
    else { g.addColorStop(0, hot ? '#7a5a3a' : '#634629'); g.addColorStop(1, hot ? '#4e3622' : '#3d2a19'); }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,215,140,0.9)';
    ctx.stroke();
    ctx.restore();
    text(label, x + w / 2, y + h / 2 + 1, opts.size || 20, '#fff3da', 'center');
    buttons.push({ x, y, w, h, label, onClick });
  }

  function stars(x, y, n, size = 30) {
    for (let i = 0; i < 3; i++) text('★', x + (i - 1) * size * 1.05, y, size, i < n ? '#ffd24a' : 'rgba(60,40,25,0.9)', 'center');
  }

  function drawFlyers() {
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

  // ---- minimap
  function mmRect() {
    const w = 300, h = Math.round(300 * WH / WW);
    return { x: W - w - 16, y: H - h - 16, w, h };
  }

  function drawMinimap() {
    const R = mmRect();
    const sx = R.w / WW, sy = R.h / WH;
    ctx.save();
    roundRect(R.x - 4, R.y - 4, R.w + 8, R.h + 8, 8);
    ctx.fillStyle = 'rgba(20,12,8,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(214,163,82,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#4f7a3a';
    ctx.fillRect(R.x, R.y, R.w, GROUND_Y * sy);
    const g = ctx.createLinearGradient(0, R.y + GROUND_Y * sy, 0, R.y + R.h);
    g.addColorStop(0, '#6a3b1e'); g.addColorStop(1, '#1d100a');
    ctx.fillStyle = g;
    ctx.fillRect(R.x, R.y + GROUND_Y * sy, R.w, R.h - GROUND_Y * sy);
    ctx.fillStyle = 'rgba(160,150,140,0.8)';
    for (const r of state.rocks) ctx.fillRect(R.x + (r.cx - r.rx) * sx, R.y + (r.cy - r.ry * 0.6) * sy, Math.max(2, r.rx * 2 * sx), Math.max(1.5, r.ry * 1.2 * sy));
    for (const r of state.resources) {
      if (r.dead) continue;
      ctx.fillStyle = RES[r.type].color;
      ctx.fillRect(R.x + r.x * sx - 1.5, R.y + r.y * sy - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ffcf6a';
    const nodes = state.nodes;
    const stepN = Math.max(1, Math.floor(nodes.length / 1500));
    for (let i = 0; i < nodes.length; i += stepN) {
      const n = nodes[i];
      if (!n.dead) ctx.fillRect(R.x + n.x * sx, R.y + n.y * sy, 1.2, 1.2);
    }
    for (const m of state.mushrooms) {
      ctx.fillStyle = m.stage >= RIPE ? '#ff5a3c' : '#ffe08a';
      ctx.beginPath(); ctx.arc(R.x + m.x * sx, R.y + (GROUND_Y - 6) * sy, m.mother ? 2.5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff3b30';
    for (const th of threats()) {
      const blink = Math.sin(state.t * 10) > 0 ? 3.5 : 2.2;
      ctx.beginPath(); ctx.arc(R.x + th.x * sx, R.y + th.y * sy, blink, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(R.x + cam.x * sx, R.y + cam.y * sy, W * sx, H * sy);
    ctx.restore();
  }

  // everything dangerous that is happening right now
  function threats() {
    const out = [];
    for (const h of state.hunters) {
      if (h.state === 'approach' || h.state === 'eat') out.push({ x: h.x, y: GROUND_Y - 30 });
      if (h.state === 'swoop') out.push({ x: h.x, y: Math.max(h.y, 40) });
    }
    for (const g of state.grubs) if (g.state !== 'flee') out.push({ x: g.x, y: g.y });
    for (const a of state.ants) if (a.state !== 'flee') out.push({ x: a.x, y: a.y });
    return out;
  }

  // red markers on the screen edge pointing at danger outside the view
  function drawThreatMarkers() {
    const pad = 34;
    for (const th of threats()) {
      const sx = th.x - cam.x, sy = th.y - cam.y;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const cx = clamp(sx, pad, W - pad), cy = clamp(sy, pad + 70, H - pad - 40);
      const a = Math.atan2(sy - cy, sx - cx);
      const pulse = 1 + Math.sin(state.t * 8) * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#e8402f';
      ctx.beginPath(); ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff3e0'; ctx.stroke();
      ctx.rotate(a);
      ctx.fillStyle = '#fff3e0';
      ctx.beginPath(); ctx.moveTo(30 * pulse, 0); ctx.lineTo(19, -8); ctx.lineTo(19, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      text('!', cx, cy + 1, 20, '#fff3e0', 'center');
      buttons.push({ x: cx - 24, y: cy - 24, w: 48, h: 48, label: 'threat', onClick: () => centerOn(th.x, th.y) });
    }
  }

  function drawHud() {
    button(14, 14, 120, 44, '☰ Уровни', () => openMenu(), { size: 18 });

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

    const px = W - 344, py = 14, pw = 330;
    const goals = goalLines();
    const target = growthTarget();
    const ph = 64 + goals.length * 26 + (target ? 74 : 26);
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
      text(state.mushrooms.length ? 'Все грибы зрелые' : 'Грибов нет', px + 16, y + 14, 14, 'rgba(247,232,198,0.8)', 'left', 600);
    } else {
      const label = target.mother ? 'Ребёнок' : 'Гриб';
      text(label + ': стадия ' + target.stage + ' → ' + (target.stage + 1) + '  (показать)', px + 16, y + 12, 14, 'rgba(247,232,198,0.85)', 'left', 600);
      buttons.push({ x: px, y, w: pw, h: 24, label: 'goto', onClick: () => centerOn(target.x, GROUND_Y + 60) });
      const need = STAGES[target.stage];
      let i = 0, have = 0, total = 0;
      for (const t of RES_ORDER) {
        if (!need[t]) continue;
        const ix = px + 28 + i * 72, iy = y + 40;
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

    let my = HUD.y + HUD.h + 30;
    for (const m of state.msgs) {
      const a = Math.min(1, m.t * 4, (m.life - m.t) * 2);
      ctx.save();
      ctx.globalAlpha = a;
      text(m.text, W / 2, my, 21, '#fff1cf', 'center');
      ctx.restore();
      my += 30;
    }

    drawMinimap();
    drawThreatMarkers();

    ctx.save();
    ctx.globalAlpha = 0.75;
    const hint = state.sporeFrom
      ? 'Кликните по поверхности, куда лететь спорам · Esc — отмена'
      : 'Клик по почве — расти · по вредителю — прогнать · по зрелому грибу — споры · карта: стрелки, колесо, тянуть небо';
    text(hint, (W - 330) / 2, H - 16, 14, '#f7e8c6', 'center', 600);
    ctx.restore();
  }

  function dim(a = 0.55) {
    ctx.save();
    ctx.fillStyle = `rgba(12,7,4,${a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawMenu() {
    dim(0.6);
    const pw = 1180, ph = 580, px = (W - pw) / 2, py = (H - ph) / 2;
    panel(px, py, pw, ph, 24);
    text('Mycelium Forest', W / 2, py + 62, 54, '#ffd27a', 'center');
    text('Выберите уровень', W / 2, py + 112, 20, 'rgba(247,232,198,0.85)', 'center', 600);
    const xs = LEVELS.map((_, i) => px + 110 + i * ((pw - 220) / (LEVELS.length - 1)));
    const ys = LEVELS.map((_, i) => py + 280 + (i % 2 ? 50 : -30));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,170,60,0.55)';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255,160,40,1)';
    ctx.shadowBlur = 16 * RS;
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.bezierCurveTo((xs[i - 1] + xs[i]) / 2, ys[i - 1], (xs[i - 1] + xs[i]) / 2, ys[i], xs[i], ys[i]);
    ctx.stroke();
    ctx.restore();
    LEVELS.forEach((L, i) => {
      const x = xs[i], y = ys[i];
      const open = i < progress.unlocked;
      const r = 48;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(x - 14, y - 18, 4, x, y, r);
      if (open) { g.addColorStop(0, '#ffe6a3'); g.addColorStop(1, '#c9772a'); }
      else { g.addColorStop(0, '#6d5a4a'); g.addColorStop(1, '#3a2c22'); }
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = open ? '#fff0c9' : 'rgba(160,130,100,0.6)'; ctx.stroke();
      ctx.restore();
      if (open) {
        const im = img['mushroom_' + Math.min(6, i + 1)];
        drawSprite(ctx, im, x, y + 30, 60 / im.height);
        text(String(i + 1), x + 33, y - 33, 24, '#fff3da', 'center');
        buttons.push({ x: x - r, y: y - r, w: r * 2, h: r * 2, label: 'lvl' + i, onClick: () => startLevel(i) });
      } else drawLock(x, y);
      text(L.name, x, y + r + 26, 17, open ? '#f7e8c6' : 'rgba(247,232,198,0.45)', 'center');
      if (open) stars(x, y + r + 52, progress.stars[i] || 0, 20);
    });
    wrap('Растите грибницу к ресурсам, выращивайте грибы-детей из корней, защищайте их от зверей, личинок и муравьёв и распространяйте споры.',
      W / 2, py + ph - 60, pw - 200, 17, 24, 'rgba(247,232,198,0.8)', 'center');
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
    const pw = 760, px = (W - pw) / 2, py = 170;
    const L = state.L;
    panel(px, py, pw, 500, 22);
    text('Уровень ' + (levelIndex + 1), W / 2, py + 44, 20, 'rgba(247,232,198,0.75)', 'center', 600);
    text(L.name, W / 2, py + 84, 40, '#ffd27a', 'center');
    let y = wrap(L.text, W / 2, py + 140, pw - 90, 19, 28, '#f7e8c6', 'center');
    y += 10;
    text('Цель:', W / 2, y, 20, '#ffd27a', 'center');
    y += 32;
    for (const g of goalLines()) { text(g.text + ': ' + g.need, W / 2, y, 19, '#f7e8c6', 'center', 600); y += 28; }
    button(W / 2 - 110, py + 420, 220, 54, 'Играть', () => { mode = 'play'; msg('Кликните по почве — грибница прорастёт в ту сторону', 4); }, { primary: true, size: 24 });
  }

  function drawWon() {
    dim(0.45);
    const pw = 640, ph = 360, px = (W - pw) / 2, py = 230;
    panel(px, py, pw, ph, 22);
    text('Уровень пройден!', W / 2, py + 56, 40, '#ffd27a', 'center');
    stars(W / 2, py + 120, state.result.stars, 54);
    text('Время: ' + fmtTime(state.result.time) + '   ·   потеряно грибов: ' + state.lost, W / 2, py + 180, 18, '#f7e8c6', 'center', 600);
    text('3 звезды — быстрее ' + fmtTime(state.L.par), W / 2, py + 208, 15, 'rgba(247,232,198,0.7)', 'center', 600);
    const last = levelIndex >= LEVELS.length - 1;
    button(px + 30, py + 260, 180, 52, 'Уровни', () => openMenu(), { size: 20 });
    button(px + 230, py + 260, 180, 52, 'Заново', () => startLevel(levelIndex), { size: 20 });
    button(px + 430, py + 260, 180, 52, last ? 'Финал!' : 'Дальше', () => (last ? openMenu() : startLevel(levelIndex + 1)), { primary: true, size: 20 });
  }

  function render() {
    buttons = [];
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawBackdrop();
    ctx.setTransform(RS, 0, 0, RS, -cam.x * RS, -cam.y * RS); // world space
    drawUnderground();
    drawResources();
    drawMycelium();
    drawPests();
    drawSurface();
    drawSporeClouds();
    drawSporeAim();
    drawCursor();
    drawWorldFx();
    ctx.setTransform(RS, 0, 0, RS, 0, 0); // screen space
    drawFlyers();
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
    updateAmbient(dt);
    updateCritters(dt);
    updateFx(dt);
    if (state.pointer) { state.pointer.wx = state.pointer.sx + cam.x; state.pointer.wy = state.pointer.sy + cam.y; }
    if (mode !== 'play') {
      for (const h of state.hunters) if (h.ground && h.state === 'idle') ambientHunter(h, dt);
      updateTips(dt);
      if (state.needRebuild) { state.needRebuild = false; rebuildMycelium(); }
      return;
    }
    const k = state.keys; // keyboard panning
    const kx = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
    const ky = (k.has('ArrowDown') || k.has('s') ? 1 : 0) - (k.has('ArrowUp') || k.has('w') ? 1 : 0);
    if (kx || ky) { cam.x += kx * CAM_SPEED * dt; cam.y += ky * CAM_SPEED * dt; clampCam(); }

    state.time += dt;
    const p = state.pointer;
    if (p && p.down && state.activeTip && state.activeTip.alive && p.wy >= SOIL_TOP) {
      const tip = state.activeTip; // dragging steers the tip started by this press
      tip.target = { x: clamp(p.wx, SOIL_PAD + 2, WW - SOIL_PAD - 2), y: p.wy };
      tip.maxTravel = tip.travelled + 400;
    }
    updateTips(dt);
    updateResources(dt);
    updateParticles(dt);
    updateMushrooms(dt);
    updateSpores(dt);
    updateHunters(dt);
    updateGrubs(dt);
    updateAnts(dt);
    respawn(dt);
    if (state.needRebuild) { state.needRebuild = false; rebuildMycelium(); }
    checkWin();
  }

  function toScreen(e) {
    const rect = canvas.getBoundingClientRect();
    return { sx: (e.clientX - rect.left) / rect.width * W, sy: (e.clientY - rect.top) / rect.height * H };
  }

  const inBox = (x, y, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

  function hoverTarget(p) {
    for (let i = buttons.length - 1; i >= 0; i--) if (inBox(p.sx, p.sy, buttons[i])) return { kind: 'button', b: buttons[i] };
    if (mode !== 'play') return null;
    if (inBox(p.sx, p.sy, mmRect())) return { kind: 'minimap' };
    for (const h of state.hunters) {
      if (h.threat && ['approach', 'eat', 'idle', 'return', 'swoop'].includes(h.state) && inBox(p.wx, p.wy, hunterBox(h))) return { kind: 'hunter', h };
    }
    for (const g of state.grubs) if (g.state !== 'flee' && dist(p.wx, p.wy, g.x, g.y) < 40) return { kind: 'grub', g };
    for (const a of state.ants) if (a.state !== 'flee' && dist(p.wx, p.wy, a.x, a.y) < 36) return { kind: 'ant', a };
    for (const m of state.mushrooms) if (canSpore(m) && inBox(p.wx, p.wy, mushroomBox(m))) return { kind: 'mushroom', m };
    return null;
  }

  function minimapJump(p) {
    const R = mmRect();
    centerOn((p.sx - R.x) / R.w * WW, (p.sy - R.y) / R.h * WH);
  }

  function onPress(p, buttonIdx) {
    const hit = hoverTarget(p);
    if (hit && hit.kind === 'button') { hit.b.onClick(); return; }
    if (mode !== 'play') return;
    if (buttonIdx !== 0) { state.drag = { sx: p.sx, sy: p.sy, cx: cam.x, cy: cam.y }; return; }
    if (hit && hit.kind === 'minimap') { state.mmDrag = true; minimapJump(p); return; }

    if (state.sporeFrom) {
      if (hit && hit.kind === 'mushroom' && hit.m === state.sporeFrom) { state.sporeFrom = null; return; }
      if (p.wy < SOIL_TOP) {
        const bad = sporeSpotProblem(p.wx);
        if (bad) { msg(bad + ' — выберите другое место', 2); return; }
        releaseSpores(state.sporeFrom, p.wx);
        state.sporeFrom = null;
        return;
      }
      state.sporeFrom = null;
    }
    if (hit && hit.kind === 'hunter') { scareHunter(hit.h); return; }
    if (hit && hit.kind === 'grub') {
      hit.g.state = 'flee'; hit.g.t = 0;
      hit.g.dir = hit.g.x < cam.x + W / 2 ? -1 : 1;
      state.fx.push({ kind: 'ring', x: hit.g.x, y: hit.g.y, t: 0, life: 0.6, color: '255,120,90' });
      msg('Личинка уползает!', 1.4);
      return;
    }
    if (hit && hit.kind === 'ant') { scareAnt(hit.a); return; }
    if (hit && hit.kind === 'mushroom') { state.sporeFrom = hit.m; msg('Кликните по поверхности, куда полетят споры', 3); return; }
    if (p.wy < SOIL_TOP - 6) { state.drag = { sx: p.sx, sy: p.sy, cx: cam.x, cy: cam.y }; return; } // drag the sky to pan
    state.activeTip = growToward(p.wx, p.wy);
  }

  function setPointer(e, down) {
    const s = toScreen(e);
    state.pointer = { ...s, wx: s.sx + cam.x, wy: s.sy + cam.y, down };
    return state.pointer;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state) return;
    const p = setPointer(e, true);
    onPress(p, e.button);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state) return;
    const p = setPointer(e, state.pointer ? state.pointer.down : false);
    if (state.drag) {
      cam.x = state.drag.cx - (p.sx - state.drag.sx);
      cam.y = state.drag.cy - (p.sy - state.drag.sy);
      clampCam();
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (state.mmDrag) { minimapJump(p); return; }
    const hit = hoverTarget(p);
    hoverBtn = hit && hit.kind === 'button' ? hit.b : null;
    canvas.style.cursor = hit ? 'pointer'
      : mode !== 'play' ? 'default'
        : (p.wy >= SOIL_TOP || state.sporeFrom) ? 'crosshair' : 'grab';
  });
  const up = () => {
    if (!state) return;
    if (state.pointer) state.pointer.down = false;
    state.activeTip = null;
    state.drag = null;
    state.mmDrag = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (state && state.pointer && !state.pointer.down) state.pointer = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (!state || mode !== 'play') return;
    e.preventDefault();
    const f = e.deltaMode === 1 ? 30 : 1;
    if (e.shiftKey) cam.x += (e.deltaY + e.deltaX) * f;
    else { cam.x += e.deltaX * f; cam.y += e.deltaY * f; }
    clampCam();
  }, { passive: false });

  const KEYMAP = { ц: 'w', ф: 'a', ы: 's', в: 'd', W: 'w', A: 'a', S: 's', D: 'd', Ц: 'w', Ф: 'a', Ы: 's', В: 'd' };
  window.addEventListener('keydown', (e) => {
    if (!state) return;
    const key = KEYMAP[e.key] || e.key;
    if (key.startsWith('Arrow')) e.preventDefault();
    state.keys.add(key);
    if (e.key === 'Escape') { if (state.sporeFrom) state.sporeFrom = null; else if (mode === 'play') openMenu(); }
    if (['r', 'R', 'к', 'К'].includes(e.key) && mode === 'play') startLevel(levelIndex);
  });
  window.addEventListener('keyup', (e) => { if (state) state.keys.delete(KEYMAP[e.key] || e.key); });
  window.addEventListener('blur', () => { if (state) state.keys.clear(); });
  window.addEventListener('resize', resize);

  function startLevel(i) {
    newWorld(i);
    buildSoil();
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
    document.getElementById('loading').textContent = err.message + '. Запустите игру через локальный сервер (см. README).';
    console.error(err);
  });

  window.mycelium = {
    get state() { return state; }, get mode() { return mode; }, cam,
    startLevel, growToward, centerOn, LEVELS, GROUND_Y, SOIL_TOP,
    play() { mode = 'play'; },
  };
})();

'use strict';
// ===== Симуляция мира: грибница, залежи, грибы, враги, события, прогресс =====
let S = null, M = {};
const W = {
  nodes: [], grid: new Map(), growing: [], deps: [], rocks: [], trees: [], spots: [], enemies: [], flyers: [], pulses: [], parts: [],
  buffs: {}, cd: {}, combo: 0, comboT: 0, comboBest: 0, ev: null, boss: null, time: 0, shake: 0, flash: 0, view: { x0: 0, x1: 800, y0: -300, y1: 600 },
  beetleT: 20, slugT: 30, spiritT: 0, guardT: 0, treeT: 0, saveT: 0, offline: null, paused: true, core: null, nid: 1,
};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fmt = n => { n = Math.floor(n); if (n < 1000) return '' + n; if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace('.0', '') + 'K'; return (n / 1e6).toFixed(1).replace('.0', '') + 'M'; };

function defaultSave() {
  return {
    v: 1, res: { w: 30, n: 60, m: 0, s: 0 }, xp: 0, lvl: 1, zones: 1, nodes: [[CORE.x, CORE.y, -1]], dep: {}, spots: [],
    upg: [0, 0, 0, 0, 0], pow: { root: 1 }, arts: [], daily: { day: '', streak: 0 }, q: null, qi: 0, stats: {},
    set: { snd: true, mus: true, vib: true, fx: true }, season: 0, seasonT: 0, evT: 45, bossT: 230, bossN: 0, evN: 0, sel: 0,
    prestige: 0, won: false, last: Date.now(), played: 0,
  };
}
function loadSave() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { }
  const def = defaultSave();
  if (!d || d.v !== 1 || !Array.isArray(d.nodes) || !d.nodes.length) d = def;
  for (const k in def) if (d[k] === undefined) d[k] = def[k];
  for (const k in def.set) if (d.set[k] === undefined) d.set[k] = def.set[k];
  S = d;
}
function saveGame() {
  if (!S) return;
  const idx = new Map(); W.nodes.forEach((n, i) => idx.set(n, i));
  S.nodes = W.nodes.map(n => [Math.round(n.x), Math.round(n.y), n.p ? idx.get(n.p) : -1]);
  S.spots = W.spots.filter(s => idx.has(s.node)).map(s => [Math.round(s.x), idx.get(s.node), s.m ? s.m.ty : -1, s.m ? +s.m.t.toFixed(2) : 0, s.m && s.m.g ? 1 : 0]);
  S.dep = {}; W.deps.forEach(d => { if (d.done) S.dep[d.id] = -1; else if (d.a < d.max) S.dep[d.id] = Math.round(d.a); });
  S.last = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
}

function recalc() {
  const a = {}; S.arts.forEach(i => { const A = ARTIFACTS[i]; a[A.stat] = (a[A.stat] || 0) + A.v; });
  const g = k => a[k] || 0, p = k => S.pow[k] || 0, god = p('god') ? 2 : 1;
  M = {
    reach: 120 * (1 + .12 * S.upg[0]) * (1 + g('reach')),
    cost: .085 * Math.pow(.94, S.upg[4]) * (1 - g('cost')) / god,
    flow: (1 + .25 * S.upg[1]) * (1 + g('flow')),
    cap: 150 + 120 * S.upg[2] + g('cap'),
    spores: (1 + .1 * S.upg[3]) * (1 + .15 * p('c1')) * (1 + g('spores')) * (1 + .5 * S.prestige) * (1 + .1 * p('bless')) * god,
    mush: 1 + g('mush'), trickle: 1 + .6 * p('a1'), chew: (1 + .5 * p('b1')) * (1 + g('chew')),
    comboTime: 2.6 + g('combo'), tree: (p('a4') ? 2 : 1) * (1 + g('tree')), golden: .04 + g('golden'),
    min: 1 + g('min'), kill: 1 + g('kill'), dmg: p('b1') >= 3 ? 2 : 1,
  };
}

// ---------- построение мира ----------
function gkey(x, y) { return ((x / 150) | 0) + ':' + ((y / 150) | 0); }
function gridAdd(n) { const k = gkey(n.x, n.y); let a = W.grid.get(k); if (!a) W.grid.set(k, a = []); a.push(n); }
function rebuildGrid() { W.grid.clear(); W.nodes.forEach(gridAdd); }
function nearestNode(x, y, maxD, grownOnly) {
  let best = null, bd = maxD * maxD; const c = Math.ceil(maxD / 150), gx = (x / 150) | 0, gy = (y / 150) | 0;
  for (let i = gx - c; i <= gx + c; i++) for (let j = gy - c; j <= gy + c; j++) {
    const a = W.grid.get(i + ':' + j); if (!a) continue;
    for (const n of a) { if (grownOnly && n.g < 1) continue; const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y); if (d < bd) { bd = d; best = n; } }
  }
  return best;
}
function mkNode(x, y, p, g) {
  const n = { id: W.nid++, x, y, p, kids: [], g, sz: 1, dead: false, cx: 0, cy: 0 };
  if (p) {
    p.kids.push(n);
    const dx = x - p.x, dy = y - p.y, k = ((n.id * 37) % 21 - 10) / 60;
    n.cx = (x + p.x) / 2 - dy * k; n.cy = (y + p.y) / 2 + dx * k;
    for (let q = p; q; q = q.p) q.sz++;
  }
  W.nodes.push(n); gridAdd(n); return n;
}
function buildWorld() {
  Object.assign(W, { nodes: [], growing: [], deps: [], rocks: [], trees: [], spots: [], enemies: [], flyers: [], pulses: [], parts: [], buffs: {}, cd: {}, combo: 0, comboT: 0, ev: null, boss: null, nid: 1 });
  W.grid.clear();
  for (let z = 0; z < ZONES.length; z++) { const g = genZone(z); W.deps.push(...g.deps); W.rocks.push(...g.rocks); W.trees.push(...g.trees); }
  W.deps.forEach(d => {
    const k = 1 + d.z * .6;
    d.max = d.type === 'n' ? 80 * k : d.type === 'w' ? 60 * k : d.type === 'm' ? 26 * (1 + d.z * .9) : 1;
    d.regen = d.type === 'n' ? .55 * k : d.type === 'w' ? .42 * k : d.type === 'm' ? .07 * (1 + d.z * .8) : 0;
    d.chunk = d.type === 'n' ? 4 * k : d.type === 'w' ? 3 * k : d.type === 'm' ? 1 + d.z * .5 : 0;
    const sv = S.dep[d.id]; d.done = sv === -1; d.a = sv === undefined || sv === -1 ? d.max : sv; d.node = null; d.t = Math.random(); d.pop = 0; d.seen = false;
  });
  W.trees.forEach(t => { t.node = null; t.acc = 0; t.pop = 0; t.ph = Math.random() * 6; });
  const arr = [];
  S.nodes.forEach(([x, y, pi]) => arr.push(mkNode(x, y, pi >= 0 ? arr[pi] : null, 1)));
  W.core = arr[0];
  W.nodes.forEach(n => linkAround(n, true));
  S.spots.forEach(([x, ni, ty, t, g]) => { const sp = { x, node: arr[ni], m: null, ph: Math.random() * 6 }; if (!sp.node) return; if (ty >= 0) sp.m = newMush(ty, t, g); W.spots.push(sp); });
  W.nodes.forEach(ensureSpot);
  recalc();
  if (!S.q) newQuest();
}
function newMush(ty, t, g) { return { ty, t: t || .05, g: !!g, thirsty: false, sq: 0, ph: Math.random() * 6, blink: rand(1, 5) }; }

function unlockedMaxX() { return S.zones * ZONE_W; }
function zoneAt(x) { return clamp((x / ZONE_W) | 0, 0, ZONES.length - 1); }

// ---------- рост ----------
function segHitsCircle(ax, ay, bx, by, c) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((c.x - ax) * dx + (c.y - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(ax + dx * t - c.x, ay + dy * t - c.y) < c.r * .86;
}
function tryGrow(px, py) {
  const free = W.buffs.free > 0, R = M.reach * (free ? 2 : 1);
  py = Math.max(py, 30);
  const n = nearestNode(px, py, R * 3, true);
  if (!n) { UI.toast('Слишком далеко от грибницы'); Snd.play('err'); return false; }
  let dx = px - n.x, dy = py - n.y, d = Math.hypot(dx, dy);
  if (d < 20) return false;
  const L = Math.min(d, R); let tx = n.x + dx / d * L, ty = n.y + dy / d * L;
  tx = clamp(tx, 12, unlockedMaxX() - 14); ty = clamp(ty, 30, ZONES[zoneAt(tx)].depth - 12);
  if (Math.hypot(tx - n.x, ty - n.y) < 18) { if (px > unlockedMaxX() - 30) UI.toast('Сначала открой следующую зону'); return false; }
  for (const r of W.rocks) if (segHitsCircle(n.x, n.y, tx, ty, r)) { r.hit = .4; fxText(tx, ty, 'Камень!', '#d8dbe6', 18); Snd.play('err'); return false; }
  const cost = free ? 0 : Math.ceil(Math.hypot(tx - n.x, ty - n.y) * M.cost);
  if (S.res.n < cost) { UI.toast('Не хватает питания — тянись к перегною'); UI.pulseRes('n'); Snd.play('err'); return false; }
  S.res.n -= cost;
  const nn = mkNode(tx, ty, n, 0); W.growing.push(nn);
  Snd.play('grow', rand(.9, 1.3)); track('grow', 1);
  return true;
}
function linkAround(n, silent) {
  for (const d of W.deps) {
    if (d.node || d.done || d.z >= S.zones) continue;
    if (Math.hypot(d.x - n.x, d.y - n.y) > d.r + 22) continue;
    if (d.type === 'relic' || d.type === 'amber' || d.type === 'heart') { if (!silent) openTreasure(d); continue; }
    d.node = n; d.pop = 1;
    if (!silent) { fxRing(d.x, d.y, '#ffffff', d.r + 20); fxBurst(d.x, d.y, DEP_COL[d.type], 14, 160); Snd.play('link'); addXp(3); track('link', 1); track('link_' + d.type, 1); fxText(d.x, d.y - d.r, 'Подключено!', '#fff', 20); buzz(15); }
  }
  for (const t of W.trees) {
    if (t.node || t.z >= S.zones || Math.hypot(t.x - n.x, t.ry - n.y) > 48) continue;
    t.node = n; t.pop = 1;
    if (!silent) { fxRing(t.x, t.ry, '#aaff7a', 70); fxBurst(t.x, -120, '#8fe04a', 26, 220); Snd.play('fanfare', 1.2); addXp(8); track('tree', 1); fxText(t.x, -150, 'Дерево проснулось!', '#d7ff7a', 22); UI.forest(); }
  }
  if (!silent) ensureSpot(n);
}
function ensureSpot(n) {
  if (n.y < 128 && !W.spots.some(s => Math.abs(s.x - n.x) < 46) && n.x > 30 && n.x < unlockedMaxX() - 30) W.spots.push({ x: n.x, node: n, m: null, ph: Math.random() * 6 });
}
const DEP_COL = { n: '#ff9a2e', w: '#3fb2ff', m: '#b48bff' };
function openTreasure(d) {
  d.done = true; fxRing(d.x, d.y, '#ffe27a', 90); fxBurst(d.x, d.y, '#ffd24a', 30, 260); fxStars(d.x, d.y, 12); W.shake = 8; buzz(40);
  if (d.type === 'amber') { const v = Math.round(12 * (1 + d.z * 1.5) * M.spores); addRes('s', v); fxText(d.x, d.y - 20, '+' + v + ' спор', '#ffe27a', 24); Snd.play('gold'); addXp(8); return; }
  if (d.type === 'heart') { S.won = true; Snd.play('fanfare'); addRes('s', 5000); UI.win(); return; }
  Snd.play('fanfare'); addXp(12);
  if (S.arts.includes(d.art)) { const v = Math.round(40 * (1 + d.z) * M.spores); addRes('s', v); addRes('m', 20 * (1 + d.z)); fxText(d.x, d.y - 20, 'Клад! +' + v, '#ffe27a', 24); }
  else giveArtifact(d.art);
}
function giveArtifact(i) { if (S.arts.includes(i)) return; S.arts.push(i); recalc(); track('art', 1); UI.artifact(i); }
function randomArtifact() { const c = []; for (let i = 0; i < Math.min(ARTIFACTS.length, S.zones * 4); i++) if (!S.arts.includes(i)) c.push(i); return c.length ? c[(Math.random() * c.length) | 0] : -1; }

function killNode(n) {
  if (n === W.core || n.dead) return 0;
  const st = [n], all = []; while (st.length) { const q = st.pop(); all.push(q); q.dead = true; st.push(...q.kids); }
  const dead = new Set(all);
  n.p.kids = n.p.kids.filter(k => k !== n); for (let q = n.p; q; q = q.p) q.sz -= all.length;
  W.deps.forEach(d => { if (dead.has(d.node)) d.node = null; });
  W.trees.forEach(t => { if (dead.has(t.node)) t.node = null; });
  W.spots = W.spots.filter(s => { if (!dead.has(s.node)) return true; if (s.m) fxBurst(s.x, -30, MUSH[s.m.ty].cap, 12, 180); return false; });
  W.pulses = W.pulses.filter(p => !dead.has(p.n));
  W.growing = W.growing.filter(q => !dead.has(q));
  all.slice(0, 40).forEach(q => fxBurst(q.x, q.y, '#e8d7b0', 5, 90));
  W.nodes = W.nodes.filter(q => !q.dead); rebuildGrid();
  Snd.play('crumble'); W.shake = Math.max(W.shake, 6); buzz(60); UI.forest();
  return all.length;
}

// ---------- ресурсы и прогресс ----------
function addRes(k, v) {
  if (k === 'w' || k === 'n') S.res[k] = clamp(S.res[k] + v, 0, M.cap);
  else { S.res[k] += v; if (k === 's' && v > 0) track('spores', v); }
}
function addXp(v) {
  S.xp += v;
  while (S.xp >= xpNeed(S.lvl)) {
    S.xp -= xpNeed(S.lvl); const r0 = rankOf(S.lvl); S.lvl++;
    const gift = 4 + S.lvl * 2; S.res.s += gift;
    Snd.play('level'); UI.levelUp(S.lvl, gift, rankOf(S.lvl) !== r0);
  }
}
function track(key, n) {
  S.stats[key] = (S.stats[key] || 0) + n;
  const q = S.q; if (!q || q.done || q.key !== key) return;
  if (key === 'combo') q.have = Math.max(q.have, n); else q.have += n;
  if (q.have >= q.need) { q.have = q.need; q.done = true; Snd.play('coin', 1.3); UI.questDone(); }
}
function newQuest() {
  if (S.qi < TUTORIAL.length) {
    const t = TUTORIAL[S.qi]; S.q = { key: t.key, need: t.need, have: 0, text: t.text, s: t.s, m: t.m || 0 };
    if (t.need === 1 && S.stats[t.key] > 0) { S.q.have = 1; S.q.done = true; }
    return;
  }
  const k = Math.min(1, S.lvl / 30), freeTrees = W.trees.some(t => !t.node && t.z < S.zones);
  const pool = QUESTS.filter(q => (!q.lvl || S.lvl >= q.lvl) && (q.key !== 'tree' || freeTrees) && (!S.q || q.key !== S.q.key) && (q.key !== 'plant' || W.spots.some(s => !s.m)) && (q.key !== 'link' || W.deps.some(d => !d.node && !d.done && d.z < S.zones && 'nwm'.includes(d.type))));
  const t = pool[(Math.random() * pool.length) | 0];
  let need = Math.round(t.n[0] + (t.n[1] - t.n[0]) * k * rand(.6, 1));
  if (t.key === 'spores') need = Math.round((30 + S.lvl * S.lvl * 3) * rand(.7, 1.2));
  S.q = { key: t.key, need, have: 0, text: t.text.replace('{n}', need), s: Math.round((10 + S.lvl * 4) * rand(1, 1.5) * (1 + S.lvl / 12)), m: Math.round((6 + S.lvl * 3) * rand(.8, 1.3)) };
}
function rerollQuest() { if (S.qi < TUTORIAL.length || !S.q || S.q.done) return; newQuest(); }
function claimQuest() {
  const q = S.q; if (!q || !q.done) return false;
  S.res.s += q.s; S.res.m += q.m; addXp(6 + S.lvl); S.qi++; S.q = null; newQuest();
  if (S.qi === TUTORIAL.length - 1) W.beetleT = 3;
  Snd.play('gold'); return true;
}

// ---------- эффекты (данные; рисует render.js) ----------
function part(o) { if (W.parts.length < 500) W.parts.push(o); }
function fxBurst(x, y, col, n, sp, g) { if (!S.set.fx) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * rand(.3, 1); part({ k: 'c', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .3, g: g === undefined ? 500 : g, r: rand(3, 7), col, life: rand(.4, .9), max: .9 }); } }
function fxRing(x, y, col, r) { part({ k: 'ring', x, y, r, col, life: .45, max: .45 }); }
function fxStars(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rand(60, 220); part({ k: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, r: rand(4, 9), col: '#fff7b0', life: rand(.4, .8), max: .8 }); } }
function fxText(x, y, txt, col, size) { part({ k: 'txt', x, y, vy: -60, txt, col, r: size || 20, life: 1.1, max: 1.1 }); }

// ---------- комбо ----------
function addCombo(x, y) {
  W.combo++; W.comboT = M.comboTime; W.comboPop = 1;
  if (W.combo > W.comboBest) W.comboBest = W.combo;
  track('combo', W.combo);
  if (W.combo === 10 || W.combo === 25 || W.combo === 50 || (W.combo > 50 && W.combo % 50 === 0)) {
    W.buffs.frenzy = 10; W.flash = .5; Snd.play('fanfare', 1.4); W.shake = 10; buzz(80);
    UI.banner('ГРИБНОЙ ЭКСТАЗ!', 'Комбо ×' + W.combo + ' — всё растёт втрое быстрее', '#ff4fa3');
    const v = W.combo * (1 + S.lvl / 4) | 0; addRes('s', v);
  }
}
function comboMul() { return 1 + Math.min(W.combo, 40) * .025; }

// ---------- грибы ----------
function plant(sp) {
  const T = MUSH[S.sel];
  if (S.res.n < T.n || S.res.w < T.w) { UI.toast(`Нужно ${T.n} питания и ${T.w} воды`); UI.pulseRes(S.res.n < T.n ? 'n' : 'w'); Snd.play('err'); return; }
  S.res.n -= T.n; S.res.w -= T.w; sp.m = newMush(S.sel); sp.m.sq = 1;
  fxBurst(sp.x, -6, '#8fe04a', 12, 160); fxRing(sp.x, -10, '#ffffff', 40); Snd.play('plant'); track('plant', 1); addXp(3);
}
function harvest(sp, auto) {
  const m = sp.m, T = MUSH[m.ty];
  let v = T.val * M.spores * SEASONS[S.season].spores * (W.buffs.x2 > 0 ? 2 : 1) * (m.g ? 5 : 1);
  if (!auto) { addCombo(sp.x, -60); v *= comboMul(); }
  v = Math.max(1, Math.round(v));
  addRes('s', v); addXp((1 + m.ty) * (m.g ? 2 : 1)); track('harvest', 1); if (m.g) track('golden', 1);
  if (m.ty === 5) { const mn = Math.round(2 * M.min * SEASONS[S.season].min); addRes('m', mn); }
  const y = -T.sh - 30;
  fxBurst(sp.x, y, m.g ? '#ffd24a' : T.cap, m.g ? 26 : 12, 240); fxBurst(sp.x, y, '#eaff8a', 6, 160, -100); fxRing(sp.x, y, m.g ? '#ffe27a' : '#ffffff', 46);
  if (m.g) { fxStars(sp.x, y, 10); W.shake = Math.max(W.shake, 5); }
  fxText(sp.x, y - 26, '+' + fmt(v), m.g ? '#ffe27a' : '#eaff8a', m.g ? 30 : 20 + Math.min(10, W.combo * .4));
  if (!auto) { Snd.play(m.g ? 'gold' : 'pop', Math.min(2.2, 1 + W.combo * .04)); buzz(m.g ? 40 : 12); }
  const wc = T.w * .2;
  m.t = .12; m.g = false; m.sq = 1; m.thirsty = S.res.w < wc; if (!m.thirsty) S.res.w -= wc;
}

// ---------- враги ----------
function spawnEnemy(kind, o) {
  const e = Object.assign({ kind, x: 0, y: 0, hp: 1, max: 1, t: 0, chew: 0, bites: 0, hit: 0, ph: Math.random() * 6, a: 0, stun: 0, state: 'move', target: null, boss: false, dead: false }, o);
  e.max = e.hp; W.enemies.push(e); return e;
}
function pickTarget(leafOnly) {
  // вредители грызут только кончики и небольшие ветки — потери обидны, но не фатальны
  const c = W.nodes.filter(n => n !== W.core && n.g >= 1 && (leafOnly ? n.sz <= 3 : n.sz <= 9));
  if (!c.length) return null;
  return c[(Math.random() * c.length) | 0];
}
function spawnBeetle(near) {
  const t = pickTarget(true); if (!t) return;
  let x, y;
  if (near) { x = near.x + rand(-40, 40); y = near.y + rand(-30, 30); }
  else { const a = rand(.1, Math.PI - .1); x = clamp(t.x + Math.cos(a) * rand(380, 520), 20, unlockedMaxX() - 20); y = clamp(t.y + Math.sin(a) * rand(300, 440), 80, ZONES[zoneAt(x)].depth - 20); }
  spawnEnemy('beetle', { x, y, hp: S.lvl >= 12 ? 3 : S.lvl >= 5 ? 2 : 1, target: t, sp: 34 + Math.min(30, S.lvl) });
}
function spawnSlug() {
  const c = W.spots.filter(s => s.m); if (!c.length) return;
  const s = c[(Math.random() * c.length) | 0], dir = Math.random() < .5 ? -1 : 1;
  spawnEnemy('slug', { x: clamp(s.x + dir * rand(330, 460), 10, unlockedMaxX() - 10), y: -4, hp: S.lvl >= 14 ? 2 : 1, sp: 26 + Math.min(20, S.lvl) });
}
function spawnBoss() {
  const tier = ++S.bossN, kinds = ['mole', 'queen', 'bigslug'], kind = kinds[(tier - 1) % 3];
  const hasM = W.spots.some(s => s.m);
  const k = kind === 'bigslug' && !hasM ? 'mole' : kind, t = pickTarget(false) || W.core;
  const hp = Math.round((14 + tier * 7) * (k === 'queen' ? 1.2 : 1));
  let e;
  if (k === 'bigslug') e = spawnEnemy(k, { x: clamp(W.core.x + (Math.random() < .5 ? -1 : 1) * 520, 60, unlockedMaxX() - 60), y: -6, hp, sp: 30, boss: true });
  else e = spawnEnemy(k, { x: clamp(t.x + rand(-300, 300), 60, unlockedMaxX() - 60), y: clamp(t.y + 380, 200, ZONES[zoneAt(t.x)].depth - 60), hp, sp: k === 'mole' ? 62 : 9, boss: true, target: k === 'mole' ? t : null });
  e.tier = tier; e.life = 55; W.boss = e; Music.tense = true;
  const nm = { mole: 'Крот-землерой', queen: 'Королева жуков', bigslug: 'Слизень-обжора' }[k]; e.name = nm;
  Snd.play('boss'); W.shake = 14; buzz(120);
  UI.banner('МИНИ-БОСС!', nm + ' — бей его скорее!', '#ff3b3b'); UI.focus(e.x, e.y);
}
function hitEnemy(e, dmg, quiet) {
  if (e.dead) return;
  e.hp -= dmg; e.hit = .18; fxBurst(e.x, e.y, '#fff', 4, 120);
  if (e.hp > 0) { if (!quiet) { Snd.play('hit', rand(.9, 1.2)); buzz(10); } if (e.boss) W.shake = Math.max(W.shake, 3); return; }
  e.dead = true; const k = 1 + S.lvl * .2;
  if (e.boss) {
    const sp = Math.round(30 * e.tier * (1 + S.lvl / 6) * M.spores), mn = Math.round(25 * e.tier * M.min);
    addRes('s', sp); addRes('m', mn); addXp(40 + e.tier * 10); track('boss', 1); track('kill', 1);
    fxBurst(e.x, e.y, '#ffd24a', 50, 380); fxStars(e.x, e.y, 20); fxRing(e.x, e.y, '#fff', 160); W.shake = 18; W.flash = .6; Snd.play('fanfare'); buzz(150);
    fxText(e.x, e.y - 40, '+' + fmt(sp) + ' спор', '#ffe27a', 30); fxText(e.x, e.y - 5, '+' + mn + ' минералов', '#c9b0ff', 22);
    W.boss = null; Music.tense = false; UI.banner('ПОБЕДА!', e.name + ' повержен', '#7ed957');
    if (Math.random() < .4) { const a = randomArtifact(); if (a >= 0) setTimeout(() => giveArtifact(a), 900); }
  } else {
    addRes('n', 6 * k * M.kill); addRes('s', Math.round((1 + S.lvl / 5) * M.kill)); addXp(3); track('kill', 1);
    fxBurst(e.x, e.y, e.kind === 'slug' ? '#b5e03a' : '#7a3bd1', 14, 220); fxRing(e.x, e.y, '#fff', 34);
    fxText(e.x, e.y - 20, 'Шлёп!', '#fff', 18);
    if (!quiet) { Snd.play('squash', rand(.9, 1.3)); buzz(25); addCombo(e.x, e.y); }
  }
}
function updEnemies(dt) {
  for (const e of W.enemies) {
    e.t += dt; if (e.hit > 0) e.hit -= dt;
    if (e.stun > 0) { e.stun -= dt; continue; }
    if (e.boss) { e.life -= dt; if (e.life <= 0) { e.dead = true; W.boss = null; Music.tense = false; UI.banner('Босс сбежал…', 'В следующий раз бей быстрее', '#9aa3b5'); continue; } }
    if (e.kind === 'beetle' || e.kind === 'mole') {
      if (e.state === 'leave') { e.y += e.sp * 2 * dt; e.a = Math.PI / 2; if (e.t > 6) e.dead = true; continue; }
      if (!e.target || e.target.dead) { e.target = pickTarget(e.kind === 'beetle'); e.chew = 0; if (!e.target) { e.state = 'leave'; e.t = 0; continue; } }
      const dx = e.target.x - e.x, dy = e.target.y - e.y, d = Math.hypot(dx, dy);
      if (d > 10) { e.a = Math.atan2(dy, dx); e.x += dx / d * e.sp * dt; e.y += dy / d * e.sp * dt; e.state = 'move'; }
      else {
        e.state = 'chew'; e.chew += dt; const need = e.kind === 'mole' ? 1.5 : 5 * M.chew; e.need = need;
        if (Math.random() < dt * 8) fxBurst(e.x, e.y, '#e8d7b0', 1, 80);
        if (e.chew >= need) { killNode(e.target); e.target = null; e.chew = 0; e.bites++; if (e.kind === 'beetle') { UI.toast('Жук перегрыз гифу!'); if (e.bites >= 2) { e.state = 'leave'; e.t = 0; } } }
      }
    } else if (e.kind === 'queen') {
      const dx = W.core.x - e.x, dy = W.core.y - e.y, d = Math.hypot(dx, dy); if (d > 200) { e.x += dx / d * e.sp * dt; e.y += dy / d * e.sp * dt; }
      e.chew += dt; if (e.chew > 3.5 && W.enemies.length < 9) { e.chew = 0; spawnBeetle(e); fxRing(e.x, e.y, '#c06bff', 50); }
    } else {
      // слизни ползут по поверхности к грибам
      let best = null, bd = 1e9; for (const s of W.spots) { if (!s.m || s.m.t < .3) continue; const d = Math.abs(s.x - e.x); if (d < bd) { bd = d; best = s; } }
      if (e.state === 'leave' || !best) { e.x += (e.dir || 1) * e.sp * dt; if (e.t > 8 && !e.boss) e.dead = true; if (!best && !e.boss) e.state = 'leave'; if (best && e.boss) e.state = 'move'; continue; }
      e.dir = best.x > e.x ? 1 : -1;
      if (bd > 14) { e.x += e.dir * e.sp * dt; e.chew = 0; }
      else {
        e.chew += dt;
        if (Math.random() < dt * 8) fxBurst(e.x + e.dir * 10, -20, MUSH[best.m.ty].cap, 1, 80);
        if (e.chew > (e.boss ? 2 : 3.2)) {
          e.chew = 0; e.bites++;
          if (best.m.ty === 3) { fxText(e.x, -50, 'Отравился!', '#ff6b6b', 20); best.m.t = .12; best.m.g = false; hitEnemy(e, e.boss ? 4 : 9, false); }
          else { best.m.t = .08; best.m.g = false; best.m.sq = 1; fxText(best.x, -60, 'Съеден!', '#ff6b6b', 20); Snd.play('crumble', 1.5); if (!e.boss && e.bites >= 2) { e.state = 'leave'; e.t = 0; } }
        }
      }
    }
  }
  W.enemies = W.enemies.filter(e => !e.dead);
}

// ---------- события ----------
const EVENTS = {
  rain: { name: 'ДОЖДЬ!', sub: 'Вода прибывает. Лови золотые капли!', dur: 18, lvl: 1, col: '#3fb2ff', w: [4, 1, 2, 0] },
  drought: { name: 'ЗАСУХА!', sub: 'Жми на тучки — выжимай из них дождь!', dur: 26, lvl: 4, col: '#ff8a1f', w: [1, 5, 1, 0] },
  wind: { name: 'СПОРОВЫЙ ВЕТЕР', sub: 'Споры ×2 — собирай грибы скорее!', dur: 20, lvl: 2, col: '#c6f03a', w: [2, 2, 5, 1] },
  stars: { name: 'ЗВЕЗДОПАД', sub: 'Лови звёзды — в них минералы', dur: 14, lvl: 3, col: '#ffe14a', w: [1, 2, 2, 5] },
  flies: { name: 'ТАНЕЦ СВЕТЛЯЧКОВ', sub: 'Лови их всех — это комбо!', dur: 15, lvl: 2, col: '#d7ff3a', w: [3, 3, 1, 0] },
  swarm: { name: 'НАШЕСТВИЕ ЖУКОВ!', sub: 'Дави их, пока не сгрызли грибницу', dur: 18, lvl: 5, col: '#c06bff', w: [2, 2, 2, 2] },
  wisp: { name: 'БЛУЖДАЮЩИЙ ОГОНЁК', sub: 'Найди его под землёй и коснись', dur: 15, lvl: 3, col: '#6ff5d0', w: [2, 1, 2, 3] },
};
function startEvent(id) {
  const E = EVENTS[id]; W.ev = { id, t: E.dur, sp: 0 }; S.evN++;
  UI.banner(E.name, E.sub, E.col);
  if (id === 'rain') { W.buffs.rain = E.dur; delete W.buffs.drought; Snd.play('thunder'); }
  if (id === 'drought') { W.buffs.drought = E.dur; Snd.play('boss', 1.6); }
  if (id === 'wind') { W.buffs.x2 = E.dur; Snd.play('fanfare', .8); }
  if (id === 'stars' || id === 'flies') Snd.play('gold', .8);
  if (id === 'swarm') { const n = 3 + Math.min(6, (S.lvl / 5) | 0); for (let i = 0; i < n; i++) spawnBeetle(); Snd.play('boss', 1.3); }
  if (id === 'wisp') { const n = W.nodes[(Math.random() * W.nodes.length) | 0]; W.flyers.push({ k: 'wisp', x: n.x + rand(-60, 60), y: Math.max(60, n.y + rand(-40, 60)), bx: n.x, by: Math.max(70, n.y), life: E.dur, ph: 0, r: 30 }); Snd.play('link', .7); UI.focus(n.x, n.y); }
}
function pickEvent() {
  if (S.evN === 0) return 'rain';
  const ids = Object.keys(EVENTS).filter(k => S.lvl >= EVENTS[k].lvl && k !== W.lastEv && EVENTS[k].w[S.season] > 0 && (k !== 'swarm' || W.nodes.length > 6));
  let tot = 0; ids.forEach(k => tot += EVENTS[k].w[S.season]); let r = Math.random() * tot;
  for (const k of ids) { r -= EVENTS[k].w[S.season]; if (r <= 0) return k; }
  return 'rain';
}
function updEvents(dt) {
  const v = W.view, vw = v.x1 - v.x0;
  if (W.buffs.rain > 0) { W.rainT = (W.rainT || 0) - dt; if (W.rainT <= 0) { W.rainT = 1.3; W.flyers.push({ k: 'gdrop', x: rand(v.x0 + 30, v.x1 - 30), y: Math.min(v.y0, -200) - 20, vy: 150, life: 9, r: 26, ph: 0 }); } }
  if (W.ev) {
    const e = W.ev; e.t -= dt; e.sp -= dt;
    if (e.id === 'drought' && e.sp <= 0) { e.sp = 2.2; const dir = Math.random() < .5 ? 1 : -1; W.flyers.push({ k: 'cloud', x: dir > 0 ? v.x0 - 60 : v.x1 + 60, y: rand(-230, -130), vx: dir * rand(35, 60), life: 30, r: 46, ph: Math.random() * 6 }); }
    if (e.id === 'stars' && e.sp <= 0) { e.sp = 1.1; W.flyers.push({ k: 'star', x: rand(v.x0 + 20, v.x1 - 20), y: Math.min(v.y0, -220) - 20, vx: rand(-40, 40), vy: rand(100, 140), life: 9, r: 28, ph: Math.random() * 6 }); }
    if (e.id === 'flies' && e.sp <= 0) { e.sp = 1; W.flyers.push({ k: 'fly', x: rand(v.x0 + 30, v.x1 - 30), y: rand(-220, -50), bx: 0, life: 7, r: 26, ph: Math.random() * 6 }); }
    if (e.t <= 0) { if (e.id === 'drought') UI.toast('Засуха отступила'); W.lastEv = e.id; W.ev = null; S.evT = rand(32, 48); }
  } else if (!W.boss) {
    S.evT -= dt; if (S.evT <= 0) startEvent(pickEvent());
  }
  if (S.lvl >= 4 && !W.boss) { S.bossT -= dt; if (S.bossT <= 0 && !W.ev) { S.bossT = rand(200, 260); spawnBoss(); } }
  for (const f of W.flyers) {
    f.life -= dt; f.ph += dt;
    if (f.k === 'cloud') f.x += f.vx * dt;
    else if (f.k === 'gdrop' || f.k === 'star') { f.x += (f.vx || 0) * dt; f.y += f.vy * dt; if (f.y > -6) { f.life = 0; fxBurst(f.x, -4, f.k === 'star' ? '#ffe14a' : '#ffc531', 6, 120); } }
    else if (f.k === 'fly') { f.x += Math.cos(f.ph * 1.7 + f.r) * 50 * dt; f.y += Math.sin(f.ph * 2.3) * 40 * dt; f.y = clamp(f.y, -260, -30); }
    else if (f.k === 'wisp') { f.x = f.bx + Math.cos(f.ph * 1.1) * 50; f.y = f.by + Math.sin(f.ph * 1.6) * 30; if (Math.random() < dt * 10) part({ k: 'c', x: f.x, y: f.y, vx: rand(-20, 20), vy: -30, g: -40, r: 3, col: '#6ff5d0', life: .6, max: .6 }); }
  }
  W.flyers = W.flyers.filter(f => f.life > 0 && (f.k !== 'cloud' || (f.x > v.x0 - vw && f.x < v.x1 + vw)));
  if (W.ev && W.ev.id !== 'drought') W.flyers = W.flyers.filter(f => f.k !== 'cloud');
}
function tapFlyer(f) {
  f.life = 0; addCombo(f.x, f.y); track('catch', 1); buzz(15);
  if (f.k === 'cloud') {
    addRes('w', 25); if (W.ev && W.ev.id === 'drought') { W.ev.t -= 5; W.buffs.drought = Math.max(0, W.ev.t); }
    for (let i = 0; i < 14; i++) part({ k: 'c', x: f.x + rand(-40, 40), y: f.y + 10, vx: 0, vy: rand(150, 300), g: 300, r: rand(3, 5), col: '#3fb2ff', life: .8, max: .8 });
    fxRing(f.x, f.y, '#fff', 60); fxText(f.x, f.y - 30, '+25 воды', '#9fdcff', 22); Snd.play('splash'); addXp(2);
  } else if (f.k === 'gdrop') { const v = Math.round((3 + S.lvl * .6) * M.spores * comboMul()); addRes('s', v); fxBurst(f.x, f.y, '#ffc531', 10, 200); fxText(f.x, f.y - 20, '+' + fmt(v), '#ffe27a', 22); Snd.play('coin', 1 + Math.min(1, W.combo * .04)); }
  else if (f.k === 'star') { const v = Math.round((4 + S.lvl * .7) * M.min * SEASONS[S.season].min); addRes('m', v); fxStars(f.x, f.y, 8); fxText(f.x, f.y - 20, '+' + v + ' минералов', '#d9c7ff', 20); Snd.play('coin', 1.5); }
  else if (f.k === 'fly') { const v = Math.round((2 + S.lvl * .5) * M.spores * comboMul()); addRes('s', v); fxBurst(f.x, f.y, '#d7ff3a', 10, 200, 0); fxText(f.x, f.y - 20, '+' + fmt(v), '#eaff8a', 20); Snd.play('coin', 1.2 + Math.min(1, W.combo * .04)); }
  else if (f.k === 'wisp') {
    const r = Math.random(); fxStars(f.x, f.y, 14); fxRing(f.x, f.y, '#6ff5d0', 80); Snd.play('fanfare', 1.3); addXp(10);
    if (r < .34) { W.buffs.x2 = 25; UI.banner('ДАР ОГОНЬКА', 'Споры ×2 на 25 секунд', '#6ff5d0'); }
    else if (r < .67) { W.buffs.free = 14; UI.banner('ДАР ОГОНЬКА', 'Бесплатный рост на 14 секунд — тапай!', '#6ff5d0'); }
    else { S.res.w = S.res.n = M.cap; const m = 10 + S.lvl * 3; addRes('m', m); UI.banner('ДАР ОГОНЬКА', 'Кладовые полны и +' + m + ' минералов', '#6ff5d0'); }
  }
}

// ---------- умения ----------
function usePower(id) {
  const P = POWERS.find(p => p.id === id); if (!S.pow[id] || !P.active || W.cd[id] > 0) return;
  W.cd[id] = P.active.cd; W.cdMax = W.cdMax || {}; W.cdMax[id] = P.active.cd; buzz(50);
  const v = W.view, inView = e => e.x > v.x0 - 80 && e.x < v.x1 + 80 && e.y > v.y0 - 80 && e.y < v.y1 + 80;
  if (id === 'a2') { W.buffs.free = 12; Snd.play('fanfare', 1.5); UI.banner('ВЗРЫВ РОСТА', 'Бесплатно и вдвое дальше — тапай!', '#7ed957'); W.flash = .3; }
  if (id === 'b2') { Snd.play('poison'); W.flash = .3; W.enemies.filter(inView).forEach(e => { fxBurst(e.x, e.y, '#8dff5a', 16, 200, -60); hitEnemy(e, e.boss ? 6 : 99, true); }); for (let i = 0; i < 30; i++) part({ k: 'c', x: rand(v.x0, v.x1), y: rand(v.y0, v.y1), vx: rand(-30, 30), vy: rand(-60, 0), g: -30, r: rand(8, 18), col: '#8dff5a', life: 1.2, max: 1.2 }); }
  if (id === 'b4') { Snd.play('quake'); W.shake = 30; W.flash = .5; buzz(300); W.enemies.slice().forEach(e => { e.stun = 4; hitEnemy(e, e.boss ? 14 : 99, true); }); W.rocks.forEach(r => r.hit = .5); }
  if (id === 'c2') { W.buffs.rain = 16; delete W.buffs.drought; if (W.ev && W.ev.id === 'drought') { W.ev.t = 0; } S.res.w = Math.min(M.cap, S.res.w + M.cap * .5); Snd.play('thunder'); UI.banner('ПРИЗЫВ ДОЖДЯ', 'Небо слушается тебя', '#3fb2ff'); W.flash = .4; }
  if (id === 'c4') { Snd.play('fanfare', 1.1); W.flash = .6; W.spots.forEach(s => { if (s.m) { s.m.t = 1; s.m.g = s.m.g || Math.random() < .4; s.m.sq = 1; s.m.thirsty = false; fxStars(s.x, -50, 3); } }); UI.banner('ЗОЛОТАЯ ПОРА', 'Все грибы созрели — собирай!', '#ffc531'); }
}

// ---------- главный тик ----------
function update(dt) {
  W.time += dt; S.played += dt;
  const SE = SEASONS[S.season], B = W.buffs;
  for (const k in B) { B[k] -= dt; if (B[k] <= 0) delete B[k]; }
  for (const k in W.cd) { W.cd[k] -= dt; if (W.cd[k] <= 0) delete W.cd[k]; }
  if (W.shake > 0) W.shake = Math.max(0, W.shake - dt * 40);
  if (W.flash > 0) W.flash -= dt;
  if (W.comboT > 0) { W.comboT -= dt; if (W.comboT <= 0) { if (W.combo >= 5) fxText((W.view.x0 + W.view.x1) / 2, W.view.y0 + 150, 'Комбо ×' + W.combo + '!', '#ffb3e0', 26); W.combo = 0; } }
  if (W.comboPop > 0) W.comboPop -= dt * 4;
  // сезоны
  S.seasonT += dt;
  if (S.seasonT >= SEASON_LEN) { S.seasonT = 0; S.season = (S.season + 1) % 4; Music.mood = S.season; const s = SEASONS[S.season]; UI.banner(s.name.toUpperCase(), s.tip, s.col); Snd.play('link', .8); W.flash = .25; }
  // рост гиф
  for (const n of W.growing) {
    n.g += dt * 3.2;
    if (Math.random() < dt * 30) part({ k: 'c', x: n.p.x + (n.x - n.p.x) * n.g, y: n.p.y + (n.y - n.p.y) * n.g, vx: rand(-40, 40), vy: rand(-40, 40), g: 0, r: rand(2, 4), col: '#fff3d1', life: .35, max: .35 });
    if (n.g >= 1) { n.g = 1; fxRing(n.x, n.y, '#fff3d1', 18); addXp(1); linkAround(n); }
  }
  if (W.growing.length) W.growing = W.growing.filter(n => n.g < 1);
  // сердце грибницы понемногу кормит само
  addRes('n', 1.1 * M.trickle * dt); if (!B.drought) addRes('w', .55 * M.trickle * dt);
  if (B.rain) addRes('w', 5 * dt); if (B.drought) addRes('w', -1.6 * dt);
  // залежи
  for (const d of W.deps) {
    if (d.pop > 0) d.pop -= dt * 2;
    if (!d.regen || d.z >= S.zones) continue;
    let rg = d.regen; if (d.type === 'w') rg *= SE.water * (B.rain ? 5 : 1) * (B.drought ? 0 : 1);
    if (d.a < d.max) d.a = Math.min(d.max, d.a + rg * dt);
    if (!d.node) continue;
    d.t += dt * 1.1 * M.flow;
    if (d.t >= 1 && d.a >= d.chunk) {
      d.t = 0; d.a -= d.chunk; let amt = d.chunk;
      if (d.type === 'n' && SE.nut) amt *= SE.nut; if (d.type === 'm') amt *= M.min * SE.min;
      if (W.pulses.length < 160) W.pulses.push({ n: d.node, t: 0, type: d.type, amt }); else addRes(d.type, amt);
    }
  }
  for (const p of W.pulses) {
    const n = p.n; if (!n.p) { p.done = true; addRes(p.type, p.amt); W.corePop = 1; continue; }
    const len = Math.hypot(n.x - n.p.x, n.y - n.p.y) || 1; p.t += 260 * dt / len;
    if (p.t >= 1) { p.n = n.p; p.t = 0; }
  }
  if (W.pulses.length) W.pulses = W.pulses.filter(p => !p.done);
  if (W.corePop > 0) W.corePop -= dt * 5;
  // грибы
  const gk = M.mush * SE.mush * (B.frenzy ? 3 : 1) * (B.drought ? .35 : 1);
  for (const s of W.spots) {
    const m = s.m; if (!m) continue;
    if (m.sq > 0) m.sq -= dt * 3;
    m.blink -= dt; if (m.blink < -.12) m.blink = rand(2, 6);
    if (m.t >= 1) continue;
    if (m.thirsty) { const wc = MUSH[m.ty].w * .2; if (S.res.w >= wc + 2) { S.res.w -= wc; m.thirsty = false; } else continue; }
    m.t += dt / MUSH[m.ty].time * gk;
    if (m.t >= 1) { m.t = 1; m.sq = 1; m.g = Math.random() < M.golden; if (s.x > W.view.x0 && s.x < W.view.x1) { fxStars(s.x, -MUSH[m.ty].sh - 30, m.g ? 8 : 3); if (m.g) Snd.play('gold', 1.4, .5); } }
  }
  // духи и стражи
  if (S.pow.c3) { W.spiritT -= dt; if (W.spiritT <= 0) { W.spiritT = 4.5 / S.pow.c3; const r = W.spots.filter(s => s.m && s.m.t >= 1); if (r.length) { const s = r[(Math.random() * r.length) | 0]; harvest(s, true); part({ k: 'c', x: s.x, y: -90, vx: 0, vy: -40, g: 0, r: 8, col: '#6ff5d0', life: .7, max: .7 }); } } }
  if (S.pow.b3 && W.enemies.length) { W.guardT -= dt; if (W.guardT <= 0) { W.guardT = 3.6 / S.pow.b3; const e = W.enemies[(Math.random() * W.enemies.length) | 0]; fxBurst(e.x, e.y, '#d7ff3a', 8, 160, 0); hitEnemy(e, 1, true); } }
  // деревья-союзники
  W.treeT += dt;
  for (const t of W.trees) { if (t.pop > 0) t.pop -= dt * 1.5; if (t.node) t.acc += .08 * (1 + t.z * 1.2) * M.tree * M.spores * SE.spores * dt; }
  if (W.treeT > 5) { W.treeT = 0; for (const t of W.trees) if (t.acc >= 1) { const v = Math.floor(t.acc); t.acc -= v; addRes('s', v); if (t.x > W.view.x0 && t.x < W.view.x1) { fxText(t.x, -170, '+' + fmt(v), '#d7ff7a', 16); fxBurst(t.x, -150, '#c6f03a', 4, 80, -40); } } }
  // вредители
  const maxE = 3 + (S.lvl / 5 | 0);
  if (S.lvl >= 3 || S.qi >= TUTORIAL.length - 1) {
    W.beetleT -= dt; if (W.beetleT <= 0) { W.beetleT = rand(.7, 1.3) * Math.max(10, 28 - S.lvl * .6); if (W.enemies.length < maxE && W.nodes.length > 3) { spawnBeetle(); if (S.lvl > 9 && Math.random() < .5) spawnBeetle(); } }
  }
  if (S.lvl >= 4) { W.slugT -= dt; if (W.slugT <= 0) { W.slugT = rand(.7, 1.3) * Math.max(14, 36 - S.lvl * .7); if (W.enemies.length < maxE) spawnSlug(); } }
  updEnemies(dt); updEvents(dt);
  for (const r of W.rocks) if (r.hit > 0) r.hit -= dt;
  // частицы
  for (const p of W.parts) { p.life -= dt; if (p.k === 'ring') continue; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.g) p.vy += p.g * dt; if (p.k === 'txt') p.vy *= 1 - dt * 1.5; }
  if (W.parts.length) W.parts = W.parts.filter(p => p.life > 0);
  W.saveT += dt; if (W.saveT > 8) { W.saveT = 0; saveGame(); }
}

// ---------- офлайн, зоны, перерождение ----------
function sporeRate() {
  let r = 0; const SE = SEASONS[S.season];
  W.trees.forEach(t => { if (t.node) r += .08 * (1 + t.z * 1.2) * M.tree * M.spores; });
  let mr = 0; W.spots.forEach(s => { if (s.m) mr += MUSH[s.m.ty].val / MUSH[s.m.ty].time; });
  return { tree: r * SE.spores, mush: mr * M.spores };
}
function calcOffline() {
  const sec = Math.min((Date.now() - S.last) / 1000, 4 * 3600);
  if (sec < 90 || W.nodes.length < 4) return;
  const r = sporeRate(), sp = Math.floor(sec * (r.tree * .6 + r.mush * (S.pow.c3 ? .5 : .15)));
  S.res.w = S.res.n = M.cap; let mn = 0; W.deps.forEach(d => { if (d.node && d.type === 'm') mn += d.regen * sec * .5; d.a = d.max; });
  mn = Math.floor(mn); S.res.s += sp; S.res.m += mn;
  W.spots.forEach(s => { if (s.m) s.m.t = 1; });
  W.offline = { sec, sp, mn };
}
function unlockZone() {
  const z = S.zones, Z = ZONES[z]; if (!Z || S.lvl < Z.lvl || S.res.m < Z.cost) return false;
  S.res.m -= Z.cost; S.zones++; addXp(30); W.flash = .6; W.shake = 16; Snd.play('fanfare'); buzz(200);
  for (let i = 0; i < 40; i++) fxBurst(z * ZONE_W, rand(-100, 500), '#d9c27a', 2, 300);
  W.nodes.forEach(n => { if (n.x > z * ZONE_W - 80) linkAround(n, false); });
  UI.banner('НОВАЯ ЗОНА!', Z.name, ZONES[z].grass); UI.forest(); saveGame(); return true;
}
function forestStat() { let own = 0, tot = W.trees.length; W.trees.forEach(t => { if (t.node) own++; }); return { own, tot }; }
function prestige() {
  const d = defaultSave();
  S.prestige++; S.won = false; S.zones = 1; S.nodes = d.nodes; S.dep = {}; S.spots = []; S.upg = d.upg; S.res.w = d.res.w; S.res.n = d.res.n; S.res.m = 0;
  S.bossN = 0; S.evT = 30; S.bossT = 200; S.sel = 0; S.last = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
  buildWorld();
}
function dailyState() {
  const today = new Date(), key = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  const y = new Date(today.getTime() - 864e5), ykey = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
  const can = S.daily.day !== key; let streak = S.daily.streak;
  if (can && S.daily.day !== ykey) streak = 0;
  return { can, key, day: streak % 7, streak };
}
function claimDaily() {
  const d = dailyState(); if (!d.can) return null;
  const R = DAILY[d.day]; S.res.s += R.s || 0; S.res.m += R.m || 0;
  let art = -1; if (R.art) { art = randomArtifact(); if (art < 0) S.res.s += 500; }
  S.daily = { day: d.key, streak: d.streak + 1 }; saveGame(); Snd.play('fanfare');
  if (art >= 0) giveArtifact(art);
  return R;
}

'use strict';
// ===== Отрисовка =====
const cam = { x: CORE.x, y: 150, z: 1 };
let cv, g, cw = 800, ch = 600, dpr = 1;
const amb = [];
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = window.innerWidth; ch = window.innerHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  clampCam();
}
function defZoom() { return clamp(Math.min(cw, ch * 1.15) / 520, .62, 1.15); }
function clampCam() {
  cam.z = clamp(cam.z, defZoom() * .4, defZoom() * 1.6);
  const hw = cw / 2 / cam.z, hh = ch / 2 / cam.z, maxX = unlockedMaxX() + (S.zones < ZONES.length ? 150 : 0);
  let depth = 0; for (let i = 0; i < S.zones; i++) depth = Math.max(depth, ZONES[i].depth);
  cam.x = maxX <= hw * 2 ? maxX / 2 : clamp(cam.x, hw, maxX - hw);
  const y0 = -ch * .34 / cam.z + hh - 40, y1 = depth + 60 - hh;
  cam.y = y1 < y0 ? y0 : clamp(cam.y, y0, y1);
}
function w2s(x, y) { return [(x - cam.x) * cam.z + cw / 2, (y - cam.y) * cam.z + ch / 2]; }
function s2w(x, y) { return [(x - cw / 2) / cam.z + cam.x, (y - ch / 2) / cam.z + cam.y]; }
function spr(s, x, y, sc, rot, sx, sy) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale((sx || 1) * sc, (sy || 1) * sc); g.drawImage(s, -s.w / 2, -s.h / 2, s.w, s.h); g.restore();
}
function txt(s, x, y, size, col, align) {
  g.font = '800 ' + size + 'px Rubik, sans-serif'; g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size * .22); g.strokeStyle = 'rgba(40,20,30,.85)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
}
function seasonGrass(z) {
  const c = ZONES[z].grass;
  return S.season === 3 ? '#f4fbff' : S.season === 2 ? mix(c, '#e8a02e', .55) : S.season === 0 ? mix(c, '#b6f06a', .3) : c;
}
function skyCols() {
  const z = zoneAt(cam.x), Z = ZONES[z]; let a = Z.sky[0], b = Z.sky[1];
  if (S.season === 3) { a = mix(a, '#b9d6f2', .55); b = mix(b, '#ffffff', .5); }
  if (S.season === 2) { a = mix(a, '#ff9d5c', .3); b = mix(b, '#ffe0a8', .5); }
  if (W.buffs.drought) { a = mix(a, '#ff8a2a', .5); b = mix(b, '#ffd27a', .6); }
  if (W.buffs.rain) { a = mix(a, '#4a5d7a', .6); b = mix(b, '#93a5bd', .6); }
  if (W.boss) { a = mix(a, '#5a2340', .45); }
  return [a, b];
}

function draw() {
  const T = W.time, z = cam.z;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hw = cw / 2 / z, hh = ch / 2 / z;
  const v = W.view; v.x0 = cam.x - hw; v.x1 = cam.x + hw; v.y0 = cam.y - hh; v.y1 = cam.y + hh;
  const surfY = w2s(0, 0)[1];
  // --- небо
  if (surfY > 0) {
    const [a, b] = skyCols(), gr = g.createLinearGradient(0, Math.min(0, surfY - 500), 0, surfY);
    gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, cw, surfY + 2);
    const dr = W.buffs.drought ? 1.5 + Math.sin(T * 5) * .08 : 1;
    spr(SPR.sun, cw * .8, Math.max(Math.min((UI.hudBottom || 170) + 50, surfY - 120 * z), surfY - 330 * z), .75 * z / .8 * dr, T * .15);
    for (let i = 0; i < 4; i++) { const x = ((i * 290 + T * (6 + i * 2) - cam.x * .12) % (cw + 300) + cw + 300) % (cw + 300) - 150; spr(W.buffs.rain ? SPR.cloudDark : SPR.cloud, x, surfY - (260 - (i % 2) * 70) * z, (.7 + (i % 3) * .2) * z, 0); }
    // холмы
    for (let L = 0; L < 2; L++) {
      const par = L ? .45 : .22, base = seasonGrass(zoneAt(cam.x)), col = mix(base, skyCols()[1], L ? .25 : .5), amp = (L ? 46 : 70) * z, off = cam.x * par;
      g.beginPath(); g.moveTo(0, surfY + 4);
      for (let x = 0; x <= cw + 30; x += 30) { const wx = (x / z + off) * (L ? .007 : .0045); g.lineTo(x, surfY - (L ? 30 : 90) * z - Math.sin(wx + L * 2) * amp - Math.sin(wx * 2.3 + L) * amp * .4); }
      g.lineTo(cw, surfY + 4); g.closePath(); g.fillStyle = col; g.fill();
      g.strokeStyle = shade(col, .18); g.lineWidth = 5 * z; g.stroke();
    }
  }
  // --- мир
  g.save();
  const shx = W.shake ? rand(-1, 1) * W.shake : 0, shy = W.shake ? rand(-1, 1) * W.shake : 0;
  g.translate(cw / 2 + shx, ch / 2 + shy); g.scale(z, z); g.translate(-cam.x, -cam.y);
  const vis = (x, y, m) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
  // деревья
  for (const t of W.trees) {
    if (t.z > S.zones || !vis(t.x, -150, 220)) continue;
    const s = treeSprite(ZONES[t.z].tree, S.season, !!t.node), sc = t.s * (1 + Math.max(0, t.pop) * .15), sw = Math.sin(T * (t.node ? 1.5 : .7) + t.ph) * (t.node ? .035 : .012);
    g.save(); g.translate(t.x, 6); g.rotate(sw); g.scale(sc, sc * (1 + Math.sin(T * 2 + t.ph) * .012)); g.drawImage(s, -130, -296, 260, 300); g.restore();
    if (t.node && Math.random() < .03) part({ k: 'c', x: t.x + rand(-60, 60) * t.s, y: -200 * t.s + rand(-50, 40), vx: rand(-10, 10), vy: -20, g: -10, r: rand(2, 4), col: '#eaff8a', life: 1.2, max: 1.2 });
  }
  // почва
  const zMax = Math.min(ZONES.length - 1, S.zones);
  g.fillStyle = '#2a1812'; g.fillRect(v.x0 - 20, 0, v.x1 - v.x0 + 40, Math.max(0, v.y1 + 20));
  for (let i = 0; i <= zMax; i++) {
    if ((i + 1) * ZONE_W < v.x0 || i * ZONE_W > v.x1) continue;
    const s = soilSprite(i); g.drawImage(s, i * ZONE_W, 0, ZONE_W + 1, ZONES[i].depth + 80);
  }
  // корни деревьев
  for (const t of W.trees) {
    if (t.z >= S.zones || !vis(t.x, 60, 120)) continue;
    const col = t.node ? '#b98a55' : '#7d6650';
    g.lineCap = 'round'; g.strokeStyle = shade(col, -.35); g.lineWidth = 12; g.beginPath(); g.moveTo(t.x, 0); g.quadraticCurveTo(t.x + 14, t.ry * .5, t.x, t.ry); g.stroke();
    g.strokeStyle = col; g.lineWidth = 8; g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(t.x + 4, t.ry * .4); g.lineTo(t.x + 34, t.ry * .7); g.moveTo(t.x + 4, t.ry * .3); g.lineTo(t.x - 30, t.ry * .6); g.stroke();
    if (!t.node) { const p = .5 + Math.sin(T * 4 + t.ph) * .5; g.globalAlpha = .35 + p * .4; g.fillStyle = '#d7ff7a'; g.beginPath(); g.arc(t.x, t.ry, 13 + p * 6, 0, TAU); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = t.node ? '#eaff8a' : '#b6e05a'; g.beginPath(); g.arc(t.x, t.ry, 8, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(t.x - 2.5, t.ry - 2.5, 2.5, 0, TAU); g.fill();
  }
  // трава
  for (let i = 0; i <= zMax; i++) {
    const a = Math.max(i * ZONE_W, v.x0 - 30), b = Math.min((i + 1) * ZONE_W, v.x1 + 30); if (a >= b) continue;
    const col = seasonGrass(i);
    g.beginPath(); g.moveTo(a, 16); const st = Math.floor(a / 14) * 14;
    for (let x = st; x <= b + 14; x += 14) g.lineTo(clamp(x, a, b), -9 - Math.abs(Math.sin(x * .09)) * 7 - Math.sin(x * .023) * 3);
    g.lineTo(b, 16); g.closePath(); g.fillStyle = shade(col, -.3); g.fill();
    g.save(); g.translate(0, -3); g.fillStyle = col; g.fill(); g.restore();
    g.strokeStyle = shade(col, .25); g.lineWidth = 2.5; g.beginPath(); for (let x = st; x <= b + 14; x += 14) g.lineTo(clamp(x, a, b), -11.5 - Math.abs(Math.sin(x * .09)) * 7 - Math.sin(x * .023) * 3); g.stroke();
    const ts = tuftSprite(shade(col, -.06));
    for (let x = Math.ceil(a / 52) * 52; x < b; x += 52) { const k = Math.sin(x * 12.9898) * 43758.5453, r = k - Math.floor(k); if (r < .25) continue; g.save(); g.translate(x + r * 20, -8); g.rotate(Math.sin(T * 2 + x) * .12); g.scale(.6 + r * .5, .6 + r * .5); g.drawImage(ts, -20, -30, 40, 30); g.restore(); }
  }
  // камни
  for (const r of W.rocks) {
    if (!vis(r.x, r.y, r.r + 20) || r.x > (S.zones + 1) * ZONE_W) continue;
    spr(SPR['rock' + r.seed % 3], r.x + (r.hit > 0 ? Math.sin(T * 60) * 4 : 0), r.y, r.r / 62, (r.seed % 7));
  }
  // залежи
  const scout = S.pow.a3;
  for (const d of W.deps) {
    if (d.done || d.z > S.zones || !vis(d.x, d.y, 80)) continue;
    if (d.type === 'relic' && !scout) { if (!d.seen) { if (nearestNode(d.x, d.y, 230)) d.seen = true; else continue; } }
    const k = d.max > 1 ? .62 + .38 * d.a / d.max : 1, pop = 1 + Math.max(0, d.pop) * .35, bob = Math.sin(T * 2 + d.id) * .04;
    if (d.type === 'relic' || d.type === 'amber' || d.type === 'heart') { const p = .5 + Math.sin(T * 3 + d.id) * .5; g.globalAlpha = .18 + p * .2; g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(d.x, d.y, d.r * (1.5 + p * .3), 0, TAU); g.fill(); g.globalAlpha = 1; }
    if (d.node) { g.globalAlpha = .25; g.fillStyle = '#fff'; g.beginPath(); g.arc(d.x, d.y, d.r * (1.15 + (d.t % 1) * .25), 0, TAU); g.fill(); g.globalAlpha = 1; }
    const s = SPR[d.type]; spr(s, d.x, d.y, d.r * 2.5 / s.w * k * pop, 0, 1 + bob, 1 - bob);
  }
  // --- грибница
  drawHyphae(v, T);
  // импульсы сока
  for (const p of W.pulses) {
    const n = p.n; if (!n.p || !vis(n.x, n.y, 60)) continue;
    const t = 1 - p.t, u = 1 - t, x = u * u * n.p.x + 2 * u * t * n.cx + t * t * n.x, y = u * u * n.p.y + 2 * u * t * n.cy + t * t * n.y;
    g.fillStyle = DEP_COL[p.type]; g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2, 0, TAU); g.fill();
  }
  // сердце грибницы
  { const c = W.core, pop = 1 + Math.max(0, W.corePop || 0) * .12, br = Math.sin(T * 2.2) * .03; spr(SPR.core, c.x, c.y, .8 * pop, 0, 1 + br, 1 - br); const bl = (T % 4) < .12; eyes(g, c.x, c.y - 6, 11, 4, bl); }
  // грибы и ростки
  for (const s of W.spots) {
    if (!vis(s.x, -40, 90)) continue;
    const m = s.m;
    if (!m) { const T0 = MUSH[S.sel], ok = S.res.n >= T0.n && S.res.w >= T0.w, b = Math.sin(T * 4 + s.ph); g.globalAlpha = ok ? 1 : .55; spr(SPR.bud, s.x, -22 - Math.abs(b) * (ok ? 7 : 2), .85, b * .1); g.globalAlpha = 1; continue; }
    drawMushroom(s, m, T);
  }
  // летуны
  for (const f of W.flyers) {
    if (f.k === 'cloud') spr(SPR.cloudDark, f.x, f.y + Math.sin(f.ph * 2) * 5, .85, 0, 1 + Math.sin(f.ph * 3) * .04, 1 - Math.sin(f.ph * 3) * .04);
    else if (f.k === 'gdrop') spr(SPR.gdrop, f.x, f.y, 1, Math.sin(f.ph * 5) * .15);
    else if (f.k === 'star') { g.globalAlpha = .4; g.strokeStyle = '#fff7b0'; g.lineWidth = 6; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x - (f.vx || 0) * .4, f.y - f.vy * .4); g.stroke(); g.globalAlpha = 1; spr(SPR.star, f.x, f.y, .9, f.ph * 3); }
    else if (f.k === 'fly') { g.globalAlpha = .35 + Math.sin(f.ph * 8) * .15; g.fillStyle = '#eaff5a'; g.beginPath(); g.arc(f.x, f.y + 6, 20, 0, TAU); g.fill(); g.globalAlpha = 1; spr(SPR.fly, f.x, f.y, .9, Math.sin(f.ph * 3) * .2); }
    else if (f.k === 'wisp') { g.globalAlpha = .3; g.fillStyle = '#6ff5d0'; g.beginPath(); g.arc(f.x, f.y, 34 + Math.sin(f.ph * 6) * 6, 0, TAU); g.fill(); g.globalAlpha = 1; spr(SPR.wisp, f.x, f.y, .9, Math.sin(f.ph * 4) * .15); }
  }
  // враги
  for (const e of W.enemies) {
    if (!vis(e.x, e.y, 120)) continue;
    const hs = e.hit > 0 ? 1.25 : 1, wob = Math.sin(T * 14 + e.ph);
    if (e.kind === 'beetle') spr(SPR['beetle' + ((T * 10 + e.ph | 0) % 2)], e.x, e.y, .8 * hs, e.a + (e.state === 'chew' ? wob * .2 : 0));
    else if (e.kind === 'queen') { spr(SPR['beetle' + ((T * 5 | 0) % 2)], e.x, e.y, 2.3 * hs, Math.PI * 1.5 + wob * .05); spr(SPR.crown, e.x, e.y - 62, 1.2, wob * .05); }
    else if (e.kind === 'mole') spr(SPR.mole, e.x, e.y, 1.05 * hs, wob * .06, 1 + wob * .03, 1 - wob * .03);
    else { const big = e.kind === 'bigslug' ? 2.3 : .85, st = Math.sin(T * 6 + e.ph) * .08; spr(SPR.slug, e.x, e.y - 22 * big, big * hs, 0, (e.dir || 1) * (1 + st), 1 - st); if (e.boss) spr(SPR.crown, e.x + (e.dir || 1) * 50, e.y - 118, 1.1, 0); }
    if (e.stun > 0) txt('★ ★', e.x, e.y - 50, 16, '#ffe14a');
    if (e.state === 'chew' && e.need) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 7; g.beginPath(); g.arc(e.x, e.y, 34, 0, TAU); g.stroke(); g.strokeStyle = '#ff3b3b'; g.lineWidth = 5; g.beginPath(); g.arc(e.x, e.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, e.chew / e.need)); g.stroke(); }
    if (!e.boss && e.max > 1) for (let i = 0; i < e.max; i++) { g.fillStyle = i < e.hp ? '#ff5d73' : 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(e.x - (e.max - 1) * 6 + i * 12, e.y - 34, 4.5, 0, TAU); g.fill(); }
  }
  // ворота в следующую зону
  if (S.zones < ZONES.length) {
    const gx = S.zones * ZONE_W, Z = ZONES[S.zones];
    if (v.x1 > gx - 80) {
      const fg = g.createLinearGradient(gx - 30, 0, gx + 260, 0); fg.addColorStop(0, 'rgba(20,12,24,0)'); fg.addColorStop(.25, 'rgba(20,12,24,.55)'); fg.addColorStop(1, 'rgba(20,12,24,.8)');
      g.fillStyle = fg; g.fillRect(gx - 30, v.y0 - 20, v.x1 - gx + 60, v.y1 - v.y0 + 40);
      for (let y = Math.max(-160, Math.floor((v.y0 + 160) / 190) * 190 - 160); y < v.y1 + 100; y += 190) g.drawImage(SPR.gate, gx - 60, y, 120, 200);
      const ok = S.lvl >= Z.lvl && S.res.m >= Z.cost, b = ok ? Math.abs(Math.sin(T * 5)) * 10 : 0, ly = clamp(-70, v.y0 + 200 / z, v.y1 - 190 / z);
      spr(SPR.lock, gx, ly - b, 1.15, ok ? Math.sin(T * 10) * .12 : 0);
      txt(Z.name, gx, ly + 54, 17, '#fff');
      txt(S.lvl < Z.lvl ? 'Нужен уровень ' + Z.lvl : Z.cost + ' минералов', gx, ly + 76, 15, ok ? '#b6ff8a' : '#ffb3b3');
    }
  }
  // обучающий указатель
  if (S.qi < TUTORIAL.length) {
    if (!W.hintT || T - W.hintT > .3) { W.hintT = T; W.hint = hintTarget(); }
    if (W.hint) { const [hx0, hy0] = W.hint, p = .5 + Math.sin(T * 5) * .5; g.strokeStyle = 'rgba(255,255,255,' + (.5 + p * .4) + ')'; g.lineWidth = 4; g.setLineDash([9, 7]); g.lineDashOffset = -T * 30; g.beginPath(); g.arc(hx0, hy0, 20 + p * 5, 0, TAU); g.stroke(); g.setLineDash([]); spr(SPR.hint, hx0, hy0 - 46 - p * 12, .8, 0); }
  }
  // частицы
  for (const p of W.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 'c') { g.globalAlpha = Math.min(1, a * 2.5); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r * (.5 + a * .5), 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(p.x - p.r * .25, p.y - p.r * .25, p.r * .3, 0, TAU); g.fill(); }
    else if (p.k === 'ring') { g.globalAlpha = a; g.strokeStyle = p.col; g.lineWidth = 7 * a + 1; g.beginPath(); g.arc(p.x, p.y, p.r * (1 - a * .7), 0, TAU); g.stroke(); }
    else if (p.k === 'star') { g.globalAlpha = a; g.fillStyle = p.col; star4(g, p.x, p.y, p.r * (.4 + a)); }
  }
  g.globalAlpha = 1;
  for (const p of W.parts) if (p.k === 'txt') { const a = clamp(p.life / p.max, 0, 1), pop = a > .85 ? 1 + (a - .85) * 5 : 1; g.globalAlpha = Math.min(1, a * 3); txt(p.txt, p.x, p.y, p.r * pop / Math.max(.75, Math.min(1.2, z)), p.col); }
  g.globalAlpha = 1;
  g.restore();

  // --- поверх мира, в экранных координатах
  drawAmbient(T, surfY);
  if (W.buffs.drought) { g.fillStyle = 'rgba(255,150,40,' + (.1 + Math.sin(T * 3) * .03) + ')'; g.fillRect(0, 0, cw, ch); }
  if (W.buffs.frenzy) { g.strokeStyle = 'rgba(255,79,163,' + (.5 + Math.sin(T * 10) * .3) + ')'; g.lineWidth = 14; g.strokeRect(0, 0, cw, ch); }
  if (W.buffs.free) { g.strokeStyle = 'rgba(126,217,87,' + (.5 + Math.sin(T * 10) * .3) + ')'; g.lineWidth = 10; g.strokeRect(0, 0, cw, ch); }
  if (W.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(.7, W.flash) + ')'; g.fillRect(0, 0, cw, ch); }
  // стрелки на врагов за экраном
  W.arrows = [];
  const top = (UI.hudBottom || 170) + 26, bot = ch - 120;
  for (const e of W.enemies) {
    const [sx, sy] = w2s(e.x, e.y); if (sx > 10 && sx < cw - 10 && sy > top - 40 && sy < bot + 60) continue;
    const ax = clamp(sx, 30, cw - 30), ay = clamp(sy, top, bot), an = Math.atan2(sy - ay, sx - ax), p = 1 + Math.sin(T * 8) * .12;
    spr(SPR.arrow, ax, ay, (e.boss ? 1.25 : .85) * p, an); W.arrows.push({ x: ax, y: ay, e });
  }
  // комбо
  if (W.combo >= 2) {
    const y = (UI.hudBottom || 170) + 44, pop = 1 + Math.max(0, W.comboPop || 0) * .35, sz = Math.min(54, 30 + W.combo * .6) * pop;
    txt('×' + W.combo, cw / 2, y, sz, W.combo >= 25 ? '#ff4fa3' : W.combo >= 10 ? '#ffc531' : '#ffffff');
    txt('КОМБО', cw / 2, y + sz * .62, 13, '#ffe9f5');
    const k = clamp(W.comboT / M.comboTime, 0, 1); g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, cw / 2 - 40, y + sz * .62 + 12, 80, 7, 3.5); g.fill(); g.fillStyle = '#ff7ac0'; rr(g, cw / 2 - 40, y + sz * .62 + 12, 80 * k, 7, 3.5); g.fill();
  }
}

function drawHyphae(v, T) {
  const W4 = [5, 7, 9.5, 12.5], paths = [[], [], [], []], m = 140;
  for (const n of W.nodes) {
    if (!n.p || n.g < 1) continue;
    if ((n.x < v.x0 - m && n.p.x < v.x0 - m) || (n.x > v.x1 + m && n.p.x > v.x1 + m) || (n.y < v.y0 - m && n.p.y < v.y0 - m) || (n.y > v.y1 + m && n.p.y > v.y1 + m)) continue;
    paths[n.sz < 3 ? 0 : n.sz < 10 ? 1 : n.sz < 40 ? 2 : 3].push(n);
  }
  const buff = W.buffs.free ? '#c8ffb0' : W.buffs.frenzy ? '#ffd0ea' : '#fff1d0';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pass = (dw, col, ox) => {
    for (let c = 0; c < 4; c++) {
      if (!paths[c].length) continue;
      g.beginPath(); for (const n of paths[c]) { g.moveTo(n.p.x + ox, n.p.y + ox); g.quadraticCurveTo(n.cx + ox, n.cy + ox, n.x + ox, n.y + ox); }
      g.lineWidth = dw < 0 ? W4[c] * .3 : W4[c] + dw; g.strokeStyle = col; g.stroke();
    }
  };
  pass(4.5, '#6b4526', 0); pass(0, buff, 0); pass(-1, 'rgba(255,255,255,.75)', -1.2);
  for (const n of W.growing) {
    const t = n.g, p = n.p, c1x = p.x + (n.cx - p.x) * t, c1y = p.y + (n.cy - p.y) * t, u = 1 - t;
    const ex = u * u * p.x + 2 * u * t * n.cx + t * t * n.x, ey = u * u * p.y + 2 * u * t * n.cy + t * t * n.y;
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(c1x, c1y, ex, ey);
    g.lineWidth = 8.5; g.strokeStyle = '#6b4526'; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#fff1d0'; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, 5 + Math.sin(T * 30) * 1.5, 0, TAU); g.fill();
  }
  // узелки на кончиках
  g.fillStyle = buff;
  for (const n of paths[0]) if (!n.kids.length) { g.beginPath(); g.arc(n.x, n.y, 4.2 + Math.sin(T * 3 + n.id) * .8, 0, TAU); g.fill(); }
}

function drawMushroom(s, m, T) {
  const Ty = MUSH[m.ty], ripe = m.t >= 1, e = 1 - Math.pow(1 - m.t, 2);
  let sc = (.28 + .72 * e) * .92, hop = 0, rot = Math.sin(T * 1.5 + m.ph) * .06;
  if (ripe) { hop = Math.abs(Math.sin(T * 4.5 + m.ph)) * 9; sc *= 1 + Math.sin(T * 9 + m.ph) * .035; rot += Math.sin(T * 4.5 + m.ph) * .05; }
  if (m.thirsty) rot += .22;
  const sq = Math.max(0, m.sq), sx = 1 + sq * .3 * Math.cos(sq * 9), sy = 1 - sq * .25 * Math.cos(sq * 9);
  const top = -(Ty.sh + Ty.ch * .5) * sc;
  if (ripe && (m.g || Ty.deco === 'glow')) { g.globalAlpha = .28 + Math.sin(T * 5 + m.ph) * .1; g.fillStyle = m.g ? '#ffe27a' : '#5ff5e0'; g.beginPath(); g.arc(s.x, top - hop, 52 * sc, 0, TAU); g.fill(); g.globalAlpha = 1; }
  g.save(); g.translate(s.x, 3 - hop); g.rotate(rot); g.scale(sc * sx, sc * sy);
  g.drawImage(SPR['m' + m.ty + (m.g ? 'g' : '')], -60, -122, 120, 130);
  if (m.t > .35) {
    const ey = Ty.shape === 'funnel' ? -Ty.sh * .5 : -Ty.sh * .42;
    eyes(g, 0, ey, Math.max(4, Ty.sw * .22), 2.6, m.blink < 0);
    if (ripe) smile(g, 0, ey + 7, 3.5);
  }
  g.restore();
  if (m.thirsty) spr(SPR.drop, s.x + 16, top - 22 + Math.sin(T * 5) * 3, .3, 0);
  if (ripe && Math.random() < .04) part({ k: 'star', x: s.x + rand(-24, 24), y: top + rand(-20, 20), vx: 0, vy: -20, g: 0, r: rand(3, 6), col: m.g ? '#ffe27a' : '#ffffff', life: .5, max: .5 });
}

function drawAmbient(T, surfY) {
  const n = S.set.fx ? 34 : 12;
  while (amb.length < n) amb.push({ x: Math.random() * cw, y: Math.random() * ch, ph: Math.random() * 6, s: rand(.6, 1.4) });
  const rain = W.buffs.rain > 0, se = S.season;
  if (rain) { g.strokeStyle = 'rgba(190,225,255,.55)'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); }
  for (let i = 0; i < n; i++) {
    const a = amb[i]; a.ph += .016;
    if (rain) { a.y += 14 * a.s; a.x -= 3; if (a.y > surfY || a.y > ch) { a.y = -20; a.x = Math.random() * (cw + 80); } g.moveTo(a.x, a.y); g.lineTo(a.x - 4, a.y + 16); continue; }
    const sp = se === 3 ? 1.1 : se === 2 ? 1.4 : .5; a.y += sp * a.s; a.x += Math.sin(a.ph * 2) * .8 + (W.buffs.x2 ? 3 : .3);
    if (a.y > Math.min(ch, surfY - 4) || a.x > cw + 20) { a.y = se === 1 ? Math.min(ch, surfY) * Math.random() : -10; a.x = Math.random() * cw; }
    if (a.y > surfY) continue;
    if (se === 3) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(a.x, a.y, 3 * a.s, 0, TAU); g.fill(); }
    else if (se === 2) { g.save(); g.translate(a.x, a.y); g.rotate(a.ph * 2); g.fillStyle = i % 2 ? '#ff9a2e' : '#f5c32c'; g.beginPath(); g.ellipse(0, 0, 7 * a.s, 3.5 * a.s, 0, 0, TAU); g.fill(); g.restore(); }
    else if (se === 0) { g.save(); g.translate(a.x, a.y); g.rotate(a.ph * 2); g.fillStyle = '#ffc0e0'; g.beginPath(); g.ellipse(0, 0, 5 * a.s, 3 * a.s, 0, 0, TAU); g.fill(); g.restore(); }
    else { g.fillStyle = 'rgba(255,250,180,' + (.4 + Math.sin(a.ph * 4) * .3) + ')'; g.beginPath(); g.arc(a.x, a.y, 2.5 * a.s, 0, TAU); g.fill(); }
    if (W.buffs.x2 && i % 3 === 0) { g.fillStyle = 'rgba(214,255,90,.8)'; g.beginPath(); g.arc(a.x + 30, a.y + 20, 3, 0, TAU); g.fill(); }
  }
  if (rain) g.stroke();
}

// Куда показать пальцем в обучении
function hintTarget() {
  const q = S.q; if (!q || q.done) return null; const k = q.key;
  const toward = (tx, ty) => { const n = nearestNode(tx, ty, 3000, true); if (!n) return null; const d = Math.hypot(tx - n.x, ty - n.y); if (d < 1) return null; const L = Math.min(d, M.reach * .92); return [n.x + (tx - n.x) / d * L, n.y + (ty - n.y) / d * L]; };
  const near = list => { let b = null, bd = 1e9; for (const d of list) { const n = nearestNode(d.x, d.y, 3000, true), dd = n ? Math.hypot(n.x - d.x, n.y - d.y) : 1e9; if (dd < bd) { bd = dd; b = d; } } return b && toward(b.x, b.y); };
  const dep = t => near(W.deps.filter(d => d.type === t && !d.node && d.z < S.zones));
  if (k === 'grow' || k === 'link_n') return dep('n');
  if (k === 'link_w') return dep('w');
  if (k === 'link_m') return dep('m');
  if (k === 'tree') return near(W.trees.filter(t => !t.node && t.z < S.zones).map(t => ({ x: t.x, y: t.ry })));
  if (k === 'plant') { const s = W.spots.find(s => !s.m); return s ? [s.x, -28] : toward(W.core.x + 90, 60); }
  if (k === 'harvest') { const s = W.spots.find(s => s.m && s.m.t >= 1); return s ? [s.x, -56] : null; }
  return null;
}

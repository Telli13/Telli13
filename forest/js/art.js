'use strict';
// ===== Пластилиновая графика: всё лепится кодом в offscreen-канвасы =====
const TAU = Math.PI * 2;
function hx(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
function toHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join(''); }
function shade(c, a) { const [r, g, b] = hx(c), t = a < 0 ? 0 : 255, p = Math.abs(a); return toHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p); }
function mix(c1, c2, t) { const a = hx(c1), b = hx(c2); return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
function mk(w, h, draw, sc) {
  sc = sc || 2; const c = document.createElement('canvas'); c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
  const g = c.getContext('2d'); g.scale(sc, sc); g.lineJoin = g.lineCap = 'round'; draw(g, w, h); c.w = w; c.h = h; return c;
}
// Основа стиля: объёмный матовый «пластилин» с бликом, тенью снизу и отпечатками
function clay(g, col, path, cx, cy, r, o) {
  o = o || {};
  g.save();
  if (o.rim !== 0) { g.save(); g.translate(0, o.rim || 3); path(g); g.fillStyle = shade(col, -.4); g.fill(); g.restore(); }
  path(g); g.fillStyle = col; g.fill(); g.clip();
  const gr = g.createRadialGradient(cx - r * .35, cy - r * .45, r * .05, cx - r * .15, cy - r * .25, r * 1.3);
  gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(.45, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = gr; g.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + r * .3, cy + r * .55, r * (.45 + i * .2), Math.PI * 1.05, Math.PI * 1.65); g.stroke(); }
  if (o.gloss !== 0) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx - r * .38, cy - r * .5, r * .2, r * .09, -.6, 0, TAU); g.fill(); }
  g.restore();
}
function ball(g, col, x, y, rx, ry, o) { ry = ry || rx; clay(g, col, c => { c.beginPath(); c.ellipse(x, y, rx, ry, (o && o.rot) || 0, 0, TAU); }, x, y, Math.max(rx, ry), o); }
function blobPath(x, y, r, seed, wob) {
  const rnd = mulberry(seed || 1), n = 9, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 - (wob || .22) * rnd()); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  return c => {
    c.beginPath();
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (!i) c.moveTo(mx, my); else c.quadraticCurveTo(p[0], p[1], mx, my); }
    const p = pts[0], q = pts[1]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); c.closePath();
  };
}
function blob(g, col, x, y, r, seed, o) { clay(g, col, blobPath(x, y, r, seed, o && o.wob), x, y, r, o); }
function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function box(g, col, x, y, w, h, r, o) { clay(g, col, c => rr(c, x, y, w, h, r), x + w / 2, y + h / 2, Math.max(w, h) / 2, o); }
function poly(g, col, pts, o) {
  let cx = 0, cy = 0, r = 0; pts.forEach(p => { cx += p[0] / pts.length; cy += p[1] / pts.length; });
  pts.forEach(p => r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy)));
  clay(g, col, c => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }, cx, cy, r, o);
}
function dome(g, col, x, y, w, h, o) {
  clay(g, col, c => { c.beginPath(); c.moveTo(x - w / 2, y); c.bezierCurveTo(x - w / 2, y - h * 1.35, x + w / 2, y - h * 1.35, x + w / 2, y); c.quadraticCurveTo(x, y + h * .28, x - w / 2, y); c.closePath(); }, x, y - h * .45, w / 2, o);
}
function eyes(g, x, y, d, r, blink) {
  g.fillStyle = '#2a1a22';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * d, y, r, r * (blink ? .15 : 1), 0, 0, TAU); g.fill(); }
  if (!blink) { g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * d - r * .3, y - r * .35, r * .35, 0, TAU); g.fill(); } }
}
function smile(g, x, y, w) { g.strokeStyle = '#2a1a22'; g.lineWidth = Math.max(1.4, w * .22); g.beginPath(); g.arc(x, y - w * .3, w, .25 * Math.PI, .75 * Math.PI); g.stroke(); }

const SPR = {};
function drawMush(g, T, gold) {
  const bx = 60, by = 122, cap = gold ? '#ffc21a' : T.cap, stem = gold ? '#fff3c4' : T.stem, top = by - T.sh;
  if (T.shape === 'funnel') {
    clay(g, stem, c => { c.beginPath(); c.moveTo(bx - 8, by); c.quadraticCurveTo(bx - 12, top + 8, bx - T.cw / 2, top - 6); c.lineTo(bx + T.cw / 2, top - 6); c.quadraticCurveTo(bx + 12, top + 8, bx + 8, by); c.closePath(); }, bx, by - T.sh / 2, T.sh * .7);
    clay(g, cap, c => { c.beginPath(); const w = T.cw / 2 + 4; c.moveTo(bx - w, top - 4); for (let i = 0; i <= 6; i++) { const x = bx - w + i * w / 3; c.quadraticCurveTo(x - w / 6, top - 20 - (i % 2) * 7, x, top - 8); } c.quadraticCurveTo(bx, top + 12, bx - w, top - 4); c.closePath(); }, bx, top - 8, T.cw / 2);
  } else {
    box(g, stem, bx - T.sw / 2, top - 4, T.sw, T.sh + 4, T.sw / 2.2);
    if (T.deco === 'dots') { clay(g, '#fff', c => { c.beginPath(); c.ellipse(bx, top + 12, T.sw / 2 + 6, 6, 0, 0, TAU); }, bx, top + 12, T.sw / 2 + 6, { rim: 2, gloss: 0 }); }
    if (T.deco === 'crystal' && !gold) {
      poly(g, cap, [[bx - T.cw / 2, top + 4], [bx - T.cw * .32, top - T.ch * .75], [bx - 4, top - T.ch * 1.05], [bx + T.cw * .3, top - T.ch * .8], [bx + T.cw / 2, top + 4], [bx, top + 12]]);
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 4, top - T.ch * 1.0); g.lineTo(bx - 10, top + 6); g.moveTo(bx - 4, top - T.ch * 1.0); g.lineTo(bx + 16, top + 5); g.stroke();
    } else dome(g, cap, bx, top + 4, T.cw, T.ch);
    if (T.deco === 'dots') for (const [dx, dy, r] of [[-20, -12, 6], [4, -24, 7], [22, -10, 5], [-4, -6, 4], [-30, 0, 3.5]]) ball(g, '#fff', bx + dx, top + dy, r, r * .85, { rim: 1.5, gloss: 0 });
    if (T.deco === 'glow' && !gold) for (const [dx, dy, r] of [[-14, -10, 5], [8, -22, 6], [18, -6, 4]]) ball(g, '#d6fff0', bx + dx, top + dy, r, r, { rim: 1 });
    if (T.deco === 'crown') { drawCrown(g, bx, top - T.ch * .82, 1.1); }
  }
  if (gold) { g.fillStyle = 'rgba(255,255,255,.9)'; for (const [x, y, s] of [[bx - 22, top - 20, 5], [bx + 20, top - 8, 4], [bx + 2, top - 34, 3]]) star4(g, x, y, s); }
}
function star4(g, x, y, s) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? s * .32 : s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }
function drawCrown(g, x, y, s) {
  poly(g, '#ffc531', [[x - 14 * s, y + 8 * s], [x - 16 * s, y - 8 * s], [x - 7 * s, y - 1 * s], [x, y - 12 * s], [x + 7 * s, y - 1 * s], [x + 16 * s, y - 8 * s], [x + 14 * s, y + 8 * s]], { rim: 2 });
  ball(g, '#ff3b5c', x, y + 3 * s, 3 * s, 3 * s, { rim: 1 });
}
function treeCols(kind, season, awake) {
  let trunk = '#8a5633', crown = '#4fbf4a', accent = null;
  if (kind === 'birch') { trunk = '#f4efe2'; crown = '#9be04f'; }
  if (kind === 'willow') { trunk = '#5d5a3c'; crown = '#3e9c7c'; }
  if (kind === 'crystal') { trunk = '#7a7f9c'; crown = '#5fe3f0'; }
  if (kind === 'ancient') { trunk = '#6a3f2a'; crown = '#2f8f45'; }
  if (kind === 'heart') { trunk = '#c98a2b'; crown = '#ff6fa3'; }
  if (kind !== 'crystal' && kind !== 'heart') {
    if (season === 0) accent = '#ffb3d9';
    if (season === 2) { crown = ['#ff9a2e', '#f5c32c', '#ff9a2e', '#e8632a', '#d9542b'][['oak', 'birch', 'x', 'willow', 'ancient'].indexOf(kind)] || '#ff9a2e'; accent = '#ffd24a'; }
    if (season === 3) { crown = mix(crown, '#eaf6ff', .72); accent = '#ffffff'; }
  }
  if (!awake) { trunk = mix(trunk, '#77807a', .35); crown = mix(crown, '#8a9a8c', .42); if (accent) accent = mix(accent, '#9aa39d', .5); }
  return { trunk, crown, accent };
}
function drawTree(g, kind, season, awake) {
  const C = treeCols(kind, season, awake), bx = 130, by = 296, rnd = mulberry(kind.length * 31 + 5);
  const tw = kind === 'ancient' ? 46 : kind === 'birch' ? 20 : 30, th = kind === 'birch' ? 190 : 150;
  clay(g, C.trunk, c => { c.beginPath(); c.moveTo(bx - tw * .75, by); c.quadraticCurveTo(bx - tw * .4, by - th * .5, bx - tw * .32, by - th); c.lineTo(bx + tw * .32, by - th); c.quadraticCurveTo(bx + tw * .4, by - th * .5, bx + tw * .75, by); c.closePath(); }, bx, by - th / 2, th / 2, { gloss: 0 });
  if (kind === 'birch') { g.fillStyle = awake ? '#3a3330' : '#6d6d68'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(bx + (i % 2 ? 4 : -4), by - 25 - i * 24, 5, 2, .2, 0, TAU); g.fill(); } }
  const cy = by - th - 10;
  let balls;
  if (kind === 'birch') balls = [[0, 20, 46], [-34, 46, 34], [34, 44, 36], [-22, -22, 40], [24, -26, 38], [0, -62, 34]];
  else if (kind === 'ancient') balls = [[-62, 30, 52], [62, 28, 54], [0, 34, 60], [-40, -28, 56], [44, -30, 54], [0, -70, 50]];
  else if (kind === 'willow') balls = [[-44, 10, 44], [44, 8, 46], [0, -18, 56]];
  else balls = [[-46, 22, 46], [46, 20, 48], [0, 28, 50], [-26, -26, 48], [28, -30, 46], [0, -58, 40]];
  if (kind === 'crystal') {
    for (const [dx, h, w, a] of [[-40, 90, 30, -.35], [36, 100, 32, .3], [0, 140, 40, 0], [-18, 70, 22, -.15], [20, 76, 24, .18]]) {
      g.save(); g.translate(bx + dx, cy + 60); g.rotate(a);
      poly(g, mix(C.crown, '#b48bff', rnd() * .6), [[-w / 2, 0], [-w / 2, -h * .7], [0, -h], [w / 2, -h * .7], [w / 2, 0]]);
      g.restore();
    }
    return;
  }
  if (kind === 'willow') for (let i = 0; i < 9; i++) { const x = bx - 80 + i * 20, l = 50 + rnd() * 50; box(g, shade(C.crown, -.12 + rnd() * .15), x - 6, cy + 10, 12, l, 6, { gloss: 0, rim: 2 }); }
  for (const [dx, dy, r] of balls) blob(g, shade(C.crown, (rnd() - .5) * .2), bx + dx, cy + dy, r, (rnd() * 999) | 0, { wob: .12 });
  if (C.accent) for (let i = 0; i < 12; i++) { const b = balls[(rnd() * balls.length) | 0], a = rnd() * TAU, d = rnd() * b[2] * .75; ball(g, C.accent, bx + b[0] + Math.cos(a) * d, cy + b[1] + Math.sin(a) * d - (season === 3 ? b[2] * .2 : 0), season === 3 ? 10 + rnd() * 8 : 5 + rnd() * 3, season === 3 ? 6 : 0, { rim: 1.5, gloss: 0 }); }
  if (kind === 'heart' && awake) for (let i = 0; i < 6; i++) { const b = balls[i]; ball(g, '#ffe27a', bx + b[0] * .8, cy + b[1] * .8, 6, 6, { rim: 1 }); }
  if (awake) { eyes(g, bx, by - th * .52, tw * .2 + 3, 3.2); smile(g, bx, by - th * .52 + 9, 5); }
  else { g.strokeStyle = '#3a2a22'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.arc(bx + s * (tw * .2 + 3), by - th * .52, 3.5, .1 * Math.PI, .9 * Math.PI); g.stroke(); } }
}
const tuftCache = {};
function tuftSprite(col) {
  return tuftCache[col] || (tuftCache[col] = mk(40, 30, g => { for (const [x, a, h] of [[10, -.35, 20], [20, 0, 26], [30, .35, 19]]) { g.save(); g.translate(x, 30); g.rotate(a); ball(g, col, 0, -h / 2, 5, h / 2, { rim: 1.5, gloss: 0 }); g.restore(); } }, 1.5));
}
const treeCache = {};
function treeSprite(kind, season, awake) {
  const k = kind + season + (awake ? 1 : 0);
  return treeCache[k] || (treeCache[k] = mk(260, 300, g => drawTree(g, kind, season, awake), 1.5));
}

const ART_ICON = {
  acorn(g, c) { ball(g, c, 32, 38, 16, 19); dome(g, shade(c, -.35), 32, 28, 38, 16); box(g, shade(c, -.5), 30, 6, 4, 10, 2, { rim: 1 }); },
  shell(g, c) { ball(g, c, 32, 34, 22, 20); g.strokeStyle = shade(c, -.4); g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 14; a += .2) { const r = 1.3 * a; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); } g.stroke(); },
  coin(g, c) { ball(g, c, 32, 32, 22, 22); ball(g, shade(c, -.15), 32, 32, 15, 15, { rim: 0, gloss: 0 }); g.fillStyle = shade(c, .5); star4(g, 32, 32, 9); },
  bone(g, c) { g.save(); g.translate(32, 32); g.rotate(-.7); box(g, c, -18, -5, 36, 10, 5); for (const [x, y] of [[-19, -6], [-19, 6], [19, -6], [19, 6]]) ball(g, c, x, y, 7, 7, { rim: 2 }); g.restore(); },
  scroll(g, c) { box(g, c, 14, 14, 36, 36, 5); box(g, shade(c, -.2), 10, 10, 44, 9, 4.5, { rim: 2 }); box(g, shade(c, -.2), 10, 46, 44, 9, 4.5, { rim: 2 }); g.strokeStyle = shade(c, -.45); g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(20, 26 + i * 6); g.lineTo(44, 26 + i * 6); g.stroke(); } },
  feather(g, c) { g.save(); g.translate(32, 32); g.rotate(.6); ball(g, c, 0, -4, 11, 24); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 28); g.stroke(); g.restore(); },
  drop(g, c) { clay(g, c, k => { k.beginPath(); k.moveTo(32, 6); k.bezierCurveTo(54, 30, 52, 56, 32, 56); k.bezierCurveTo(12, 56, 10, 30, 32, 6); k.closePath(); }, 32, 38, 20); },
  ring(g, c) { g.save(); g.lineWidth = 9; g.strokeStyle = shade(c, -.4); g.beginPath(); g.arc(32, 39, 15, 0, TAU); g.stroke(); g.strokeStyle = c; g.beginPath(); g.arc(32, 37, 15, 0, TAU); g.stroke(); g.restore(); poly(g, '#ff3b5c', [[32, 6], [42, 16], [32, 26], [22, 16]], { rim: 2 }); },
  flame(g, c) { clay(g, c, k => { k.beginPath(); k.moveTo(32, 4); k.bezierCurveTo(44, 20, 54, 30, 50, 44); k.bezierCurveTo(46, 60, 18, 60, 14, 44); k.bezierCurveTo(11, 32, 22, 28, 24, 18); k.bezierCurveTo(28, 22, 30, 14, 32, 4); k.closePath(); }, 32, 38, 22); ball(g, shade(c, .6), 32, 44, 8, 10, { rim: 0 }); },
  tooth(g, c) { clay(g, c, k => { k.beginPath(); k.moveTo(18, 12); k.quadraticCurveTo(32, 4, 46, 12); k.quadraticCurveTo(48, 40, 34, 58); k.quadraticCurveTo(28, 44, 18, 12); k.closePath(); }, 32, 28, 22); },
  mask(g, c) { clay(g, c, k => { k.beginPath(); k.moveTo(12, 14); k.quadraticCurveTo(32, 2, 52, 14); k.quadraticCurveTo(54, 44, 32, 60); k.quadraticCurveTo(10, 44, 12, 14); k.closePath(); }, 32, 30, 24); g.fillStyle = '#20141a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(32 + s * 9, 27, 5.5, 3.5, s * .3, 0, TAU); g.fill(); } g.beginPath(); g.ellipse(32, 45, 5, 3, 0, 0, TAU); g.fill(); },
  crown(g, c) { g.save(); g.translate(0, 6); drawCrown(g, 32, 30, 1.5); g.restore(); if (c !== '#ffc531') ball(g, c, 32, 50, 12, 6, { rim: 2 }); },
  gem(g, c) { poly(g, c, [[32, 6], [52, 22], [44, 54], [20, 54], [12, 22]]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 8); g.lineTo(32, 52); g.moveTo(14, 23); g.lineTo(32, 30); g.lineTo(50, 23); g.stroke(); },
};

function buildArt() {
  MUSH.forEach((T, i) => { SPR['m' + i] = mk(120, 130, g => drawMush(g, T, false)); SPR['m' + i + 'g'] = mk(120, 130, g => drawMush(g, T, true)); });
  SPR.w = mk(80, 80, g => { ball(g, '#2e9bff', 28, 46, 22, 20); ball(g, '#3fb2ff', 52, 44, 20, 22); ball(g, '#62c6ff', 40, 30, 20, 18); });
  SPR.n = mk(80, 80, g => {
    blob(g, '#8a4f24', 40, 46, 30, 7); blob(g, '#a8632c', 30, 38, 15, 3);
    g.save(); g.translate(52, 34); g.rotate(-.5); ball(g, '#ff9a2e', 0, 0, 15, 8); g.strokeStyle = '#c96a12'; g.lineWidth = 2; g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); g.stroke(); g.restore();
    ball(g, '#7ed957', 26, 56, 6, 5, { rim: 1.5 }); ball(g, '#ffd24a', 46, 58, 5, 5, { rim: 1.5 }); ball(g, '#fff1d6', 38, 26, 4, 4, { rim: 1 });
  });
  SPR.m = mk(80, 80, g => {
    poly(g, '#7b5cff', [[12, 66], [16, 34], [26, 22], [34, 36], [34, 66]]);
    poly(g, '#39d5ff', [[28, 68], [32, 22], [42, 6], [52, 24], [54, 68]]);
    poly(g, '#c06bff', [[48, 68], [52, 40], [62, 28], [70, 44], [68, 68]]);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(42, 8); g.lineTo(40, 64); g.moveTo(26, 24); g.lineTo(24, 62); g.moveTo(62, 30); g.lineTo(60, 64); g.stroke();
  });
  SPR.amber = mk(50, 50, g => { poly(g, '#ff9f1a', [[25, 4], [42, 14], [44, 34], [28, 46], [10, 38], [6, 18]]); ball(g, '#ffd27a', 20, 20, 7, 5, { rim: 0 }); g.fillStyle = '#7a3d00'; g.beginPath(); g.ellipse(28, 28, 4, 2.5, .5, 0, TAU); g.fill(); });
  SPR.relic = mk(64, 60, g => {
    box(g, '#8a4f24', 8, 22, 48, 30, 6); clay(g, '#a8632c', c => { c.beginPath(); c.moveTo(6, 28); c.quadraticCurveTo(32, 2, 58, 28); c.closePath(); }, 32, 20, 26);
    box(g, '#ffc531', 6, 24, 52, 7, 3, { rim: 2 }); ball(g, '#ffe27a', 32, 30, 7, 7, { rim: 2 }); g.fillStyle = '#7a4b00'; g.beginPath(); g.arc(32, 29, 2, 0, TAU); g.fill(); g.fillRect(31, 29, 2, 5);
  });
  SPR.heart = mk(170, 160, g => {
    clay(g, '#ff3b5c', c => { c.beginPath(); c.moveTo(85, 148); c.bezierCurveTo(10, 100, 0, 40, 44, 22); c.bezierCurveTo(66, 14, 80, 28, 85, 44); c.bezierCurveTo(90, 28, 104, 14, 126, 22); c.bezierCurveTo(170, 40, 160, 100, 85, 148); c.closePath(); }, 85, 80, 80, { rim: 6 });
    g.strokeStyle = '#ffd24a'; g.lineWidth = 4; g.beginPath(); g.moveTo(85, 50); g.lineTo(85, 130); g.moveTo(85, 70); g.lineTo(52, 54); g.moveTo(85, 90); g.lineTo(122, 66); g.moveTo(85, 104); g.lineTo(56, 96); g.stroke();
  });
  for (let i = 0; i < 3; i++) SPR['rock' + i] = mk(140, 140, g => { blob(g, ['#8d8f9c', '#7b8091', '#9a9590'][i], 70, 70, 64, 11 + i * 17, { wob: .28 }); ball(g, shade(['#8d8f9c', '#7b8091', '#9a9590'][i], .12), 52, 52, 16, 12, { rim: 0, gloss: 0 }); ball(g, shade('#8d8f9c', -.12), 88, 86, 13, 10, { rim: 0, gloss: 0 }); });
  SPR.rock = SPR.rock0;
  for (let f = 0; f < 2; f++) SPR['beetle' + f] = mk(70, 54, g => {
    g.strokeStyle = '#2b1b3a'; g.lineWidth = 4;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const x = 22 + i * 11, k = ((i + f) % 2 ? 5 : -5); g.beginPath(); g.moveTo(x, 27); g.lineTo(x + k, 27 + s * 22); g.stroke(); }
    ball(g, '#2b1b3a', 52, 27, 11, 11); ball(g, '#7a3bd1', 30, 27, 23, 17);
    g.strokeStyle = '#4a1f8a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(10, 27); g.lineTo(50, 27); g.stroke();
    ball(g, '#ffd24a', 24, 19, 4, 3, { rim: 0, gloss: 0 }); ball(g, '#ffd24a', 34, 36, 4, 3, { rim: 0, gloss: 0 });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(56, 22, 3.5, 0, TAU); g.arc(56, 32, 3.5, 0, TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(57, 22, 1.6, 0, TAU); g.arc(57, 32, 1.6, 0, TAU); g.fill();
    g.strokeStyle = '#2b1b3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(60, 23); g.lineTo(68, 16); g.moveTo(60, 31); g.lineTo(68, 38); g.stroke();
  });
  SPR.beetle = SPR.beetle0;
  SPR.slug = mk(90, 56, g => {
    box(g, '#9bcf2e', 62, 4, 6, 22, 3, { rim: 1 }); box(g, '#9bcf2e', 74, 6, 6, 20, 3, { rim: 1 });
    clay(g, '#b5e03a', c => { c.beginPath(); c.moveTo(4, 50); c.quadraticCurveTo(10, 22, 44, 22); c.quadraticCurveTo(84, 16, 86, 38); c.quadraticCurveTo(86, 50, 70, 50); c.closePath(); }, 45, 36, 40);
    for (const [x, y, r] of [[26, 36, 5], [42, 32, 4], [54, 40, 3.5]]) ball(g, '#7fae1c', x, y, r, r, { rim: 0, gloss: 0 });
    ball(g, '#fff', 65, 6, 5.5, 5.5, { rim: 1 }); ball(g, '#fff', 77, 8, 5.5, 5.5, { rim: 1 }); g.fillStyle = '#000'; g.beginPath(); g.arc(66, 6, 2.4, 0, TAU); g.arc(78, 8, 2.4, 0, TAU); g.fill();
    g.strokeStyle = '#3d5a0a'; g.lineWidth = 2; g.beginPath(); g.arc(76, 36, 5, .1 * Math.PI, .8 * Math.PI); g.stroke();
  });
  SPR.mole = mk(140, 110, g => {
    for (const s of [-1, 1]) { g.save(); g.translate(70 + s * 50, 78); ball(g, '#ffb3c7', 0, 0, 16, 11); g.strokeStyle = '#fff'; g.lineWidth = 4; for (let i = -1; i < 2; i++) { g.beginPath(); g.moveTo(i * 7, 6); g.lineTo(i * 9, 17); g.stroke(); } g.restore(); }
    blob(g, '#6b4a3a', 70, 56, 52, 5, { wob: .1 }); ball(g, '#8a6450', 70, 70, 30, 22, { rim: 0, gloss: 0 });
    ball(g, '#ff7fa3', 70, 60, 10, 8); g.fillStyle = '#fff'; rr(g, 63, 72, 6, 10, 2); g.fill(); rr(g, 71, 72, 6, 10, 2); g.fill();
    g.strokeStyle = '#1c1210'; g.lineWidth = 3.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(70 + s * 14, 34); g.lineTo(70 + s * 30, 42); g.stroke(); g.beginPath(); g.arc(70 + s * 21, 46, 4, 0, TAU); g.stroke(); }
  });
  SPR.crown = mk(48, 40, g => drawCrown(g, 24, 22, 1.3));
  SPR.cloud = mk(130, 80, g => { for (const [x, y, r] of [[36, 50, 24], [94, 50, 24], [64, 36, 30], [66, 54, 26]]) ball(g, '#ffffff', x, y, r, r * .85, { rim: 4 }); eyes(g, 64, 46, 10, 3.2); smile(g, 64, 54, 5); });
  SPR.cloudDark = mk(130, 80, g => { for (const [x, y, r] of [[36, 50, 24], [94, 50, 24], [64, 36, 30], [66, 54, 26]]) ball(g, '#b9c6e6', x, y, r, r * .85, { rim: 4 }); eyes(g, 64, 46, 10, 3.2); });
  SPR.sun = mk(120, 120, g => { for (let i = 0; i < 10; i++) { g.save(); g.translate(60, 60); g.rotate(i / 10 * TAU); poly(g, '#ffb21a', [[-8, -34], [0, -56], [8, -34]], { rim: 2, gloss: 0 }); g.restore(); } ball(g, '#ffd21f', 60, 60, 36, 36); eyes(g, 60, 55, 12, 4); smile(g, 60, 66, 8); ball(g, '#ff9f8a', 40, 66, 6, 4, { rim: 0, gloss: 0 }); ball(g, '#ff9f8a', 80, 66, 6, 4, { rim: 0, gloss: 0 }); });
  SPR.gdrop = mk(44, 56, g => ART_ICON.drop(g, '#ffc531'), 1.5);
  SPR.drop = mk(64, 64, g => ART_ICON.drop(g, '#3fb2ff'));
  SPR.star = mk(60, 60, g => { clay(g, '#ffe14a', c => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? 13 : 27; c.lineTo(30 + Math.cos(a) * r, 30 + Math.sin(a) * r); } c.closePath(); }, 30, 30, 26); eyes(g, 30, 30, 6, 2.4); });
  SPR.fly = mk(44, 40, g => { g.globalAlpha = .7; ball(g, '#e9fbff', 14, 12, 10, 6, { rim: 0, rot: -.5 }); ball(g, '#e9fbff', 30, 12, 10, 6, { rim: 0, rot: .5 }); g.globalAlpha = 1; ball(g, '#3a3340', 22, 18, 7, 7, { rim: 2 }); ball(g, '#d7ff3a', 22, 28, 9, 9, { rim: 2 }); });
  SPR.wisp = mk(60, 64, g => { ART_ICON.flame(g, '#6ff5d0'); eyes(g, 32, 40, 6, 2.6); });
  SPR.bud = mk(50, 50, g => { box(g, '#63c132', 22, 22, 6, 24, 3, { rim: 1.5 }); ball(g, '#8fe04a', 14, 22, 11, 7, { rot: .6, rim: 2 }); ball(g, '#8fe04a', 36, 22, 11, 7, { rot: -.6, rim: 2 }); ball(g, '#fff27a', 25, 12, 6, 6, { rim: 1.5 }); });
  SPR.core = mk(110, 100, g => {
    for (const [x, y, r] of [[18, 70, 12], [92, 70, 12], [34, 86, 11], [76, 86, 11], [55, 90, 10]]) ball(g, '#f7dfb8', x, y, r, r, { rim: 2, gloss: 0 });
    blob(g, '#ffe9c4', 55, 50, 42, 21, { wob: .1 }); ball(g, '#ffb3a8', 30, 58, 8, 5, { rim: 0, gloss: 0 }); ball(g, '#ffb3a8', 80, 58, 8, 5, { rim: 0, gloss: 0 });
    smile(g, 55, 60, 8);
  });
  SPR.s = mk(64, 64, g => { ball(g, '#c6f03a', 32, 34, 20, 20); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; ball(g, '#eaff8a', 32 + Math.cos(a) * 25, 34 + Math.sin(a) * 25, 4.5, 4.5, { rim: 1 }); } });
  SPR.tree = mk(64, 64, g => { box(g, '#8a5633', 27, 34, 10, 26, 4); ball(g, '#4fbf4a', 20, 30, 14, 14); ball(g, '#4fbf4a', 44, 30, 14, 14); ball(g, '#63d15a', 32, 18, 16, 16); });
  SPR.gate = mk(120, 200, g => {
    const r = mulberry(77);
    for (let i = 0; i < 9; i++) { const y = 12 + i * 23, x = 60 + Math.sin(i * 1.3) * 16; blob(g, i % 2 ? '#4a6b2f' : '#3d5a2a', x, y, 30 + r() * 8, i + 3, { wob: .15 }); for (const s of [-1, 1]) if (r() < .7) poly(g, '#d9c27a', [[x + s * 30, y - 6], [x + s * 48, y], [x + s * 30, y + 6]], { rim: 1.5, gloss: 0 }); }
  });
  SPR.lock = mk(64, 70, g => { g.lineWidth = 9; g.strokeStyle = '#8b93a8'; g.beginPath(); g.arc(32, 26, 14, Math.PI, 0); g.lineTo(46, 36); g.moveTo(18, 26); g.lineTo(18, 36); g.stroke(); box(g, '#ffc531', 10, 30, 44, 34, 8); g.fillStyle = '#7a4b00'; g.beginPath(); g.arc(32, 44, 5, 0, TAU); g.fill(); g.fillRect(29.5, 44, 5, 12); });
  SPR.hint = mk(56, 60, g => { poly(g, '#ffe14a', [[18, 6], [38, 6], [38, 30], [50, 30], [28, 54], [6, 30], [18, 30]], { rim: 3 }); });
  SPR.arrow = mk(48, 48, g => { poly(g, '#ff3b3b', [[8, 8], [42, 24], [8, 40], [16, 24]], { rim: 3 }); });
  ARTIFACTS.forEach((a, i) => { SPR['art' + i] = mk(64, 64, g => ART_ICON[a.icon](g, a.col)); });
}
const urlCache = {};
function iconURL(name) { return urlCache[name] || (urlCache[name] = SPR[name].toDataURL()); }
function icon(name, size) { return `<img class="ic" src="${iconURL(name)}" style="width:${size || 24}px;height:${size || 24}px" alt="">`; }

// Слоистая почва зоны — тоже «пластилин»
const soilCache = {};
function soilSprite(z) {
  if (soilCache[z]) return soilCache[z];
  const Z = ZONES[z], sc = .5, H = Z.depth + 80;
  const c = mk(ZONE_W, H, g => {
    const r = mulberry(99 + z * 13), x0 = z * ZONE_W;
    g.fillStyle = Z.soil[0]; g.fillRect(0, 0, ZONE_W, H);
    const wave = (x, k) => Math.sin((x0 + x) * .006 + k * 2.1) * 22 + Math.sin((x0 + x) * .017 + k) * 9;
    for (let k = 1; k < 4; k++) {
      const by = H * (k / 4) - 30;
      g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= ZONE_W; x += 20) g.lineTo(x, by + wave(x, k)); g.lineTo(ZONE_W, H); g.closePath();
      g.fillStyle = Z.soil[k]; g.fill();
      g.beginPath(); for (let x = 0; x <= ZONE_W; x += 20) g.lineTo(x, by + wave(x, k) + 3); g.strokeStyle = shade(Z.soil[k], .16); g.lineWidth = 6; g.stroke();
    }
    for (let i = 0; i < 150; i++) {
      const x = r() * ZONE_W, y = 20 + r() * (H - 30), k = Math.min(3, (y / H * 4) | 0), rad = 3 + r() * 9;
      g.fillStyle = shade(Z.soil[k], r() < .5 ? -.16 : .13); g.beginPath(); g.ellipse(x, y, rad, rad * (.55 + r() * .4), r() * 3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x - rad * .3, y - rad * .3, rad * .35, rad * .2, -.5, 0, TAU); g.fill();
    }
    g.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const x = r() * ZONE_W, y = 40 + r() * (H - 60), rad = 20 + r() * 40, a = r() * TAU; g.strokeStyle = 'rgba(255,255,255,.05)'; for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x, y, rad + j * 7, a, a + 1.6); g.stroke(); } }
    const sh = g.createLinearGradient(0, 0, 0, 60); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 0, ZONE_W, 60);
    const dk = g.createLinearGradient(0, H - 260, 0, H); dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = dk; g.fillRect(0, H - 260, ZONE_W, 260);
  }, sc);
  return soilCache[z] = c;
}

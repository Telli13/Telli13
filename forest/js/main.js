'use strict';
// ===== Запуск, ввод, игровой цикл =====
const ptrs = new Map();
let pinch = null, lastT = 0, uiT = 0;

function hitAt(wx, wy, first) {
  const z = cam.z, now = performance.now(), slack = 14 / z;
  for (const f of W.flyers) if (f.life > 0 && Math.hypot(f.x - wx, f.y - wy) < f.r + slack + 8) { tapFlyer(f); return true; }
  for (const e of W.enemies) {
    const r = (e.kind === 'queen' || e.kind === 'mole' ? 62 : e.kind === 'bigslug' ? 80 : 30) + slack, cy = e.kind === 'bigslug' ? e.y - 50 : e.kind === 'slug' ? e.y - 16 : e.y;
    if (Math.hypot(e.x - wx, cy - wy) < r) { if (now - (e.lastHit || 0) > (first ? 60 : 230)) { e.lastHit = now; hitEnemy(e, M.dmg); } return true; }
  }
  if (wy < 20 && wy > -130) for (const s of W.spots) if (s.m && s.m.t >= 1 && Math.abs(s.x - wx) < 30 + slack) { harvest(s); return true; }
  return false;
}
function tapWorld(wx, wy) {
  if (S.zones < ZONES.length && Math.abs(wx - S.zones * ZONE_W) < 62) { UI.gate(); return; }
  if (wy < 26 && wy > -130) {
    let best = null, bd = 34; for (const s of W.spots) { const d = Math.abs(s.x - wx); if (d < bd) { bd = d; best = s; } }
    if (best) {
      if (!best.m) plant(best);
      else if (best.m.t < 1) { best.m.sq = 1; if (best.m.ty !== S.sel) UI.replace(best); else UI.toast(best.m.thirsty ? 'Грибу не хватает воды' : 'Ещё растёт…'); }
      return;
    }
  }
  if (wy > 10) tryGrow(wx, wy);
}
function bindInput() {
  cv.addEventListener('pointerdown', e => {
    Snd.unlock(); if (W.paused) return;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { }
    const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), mode: null };
    ptrs.set(e.pointerId, p); UI.camT = null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; a.mode = b.mode = 'pinch'; return; }
    for (const a of W.arrows || []) if (Math.hypot(a.x - p.x, a.y - p.y) < 36) { UI.focus(a.e.x, a.e.y); p.mode = 'none'; return; }
    const [wx, wy] = s2w(p.x, p.y);
    if (hitAt(wx, wy, true)) p.mode = 'swipe';
  });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p || W.paused) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      cam.z = pinch.z * d / pinch.d; cam.x -= dx / cam.z / 2; cam.y -= dy / cam.z / 2; clampCam(); return;
    }
    if (p.mode === 'swipe') { const [wx, wy] = s2w(p.x, p.y); hitAt(wx, wy, false); return; }
    if (p.mode === 'none' || p.mode === 'pinch') return;
    if (!p.mode && Math.hypot(p.x - p.sx, p.y - p.sy) > 11) p.mode = 'pan';
    if (p.mode === 'pan') { cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); }
  });
  const up = e => {
    const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (W.paused || e.type === 'pointercancel') return;
    if (!p.mode && performance.now() - p.t < 600) { const [wx, wy] = s2w(p.x, p.y); tapWorld(wx, wy); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); if (W.paused) return; const [wx, wy] = s2w(e.clientX, e.clientY); cam.z *= e.deltaY < 0 ? 1.1 : .9; clampCam(); const [nx, ny] = s2w(e.clientX, e.clientY); cam.x += wx - nx; cam.y += wy - ny; clampCam(); }, { passive: false });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); else lastT = performance.now(); });
  window.addEventListener('pagehide', saveGame);
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
  if (!S) return;
  if (!W.paused) { update(dt); if (W.comboBest > (S.stats.bestCombo || 0)) S.stats.bestCombo = W.comboBest; }
  else { W.time += dt; for (const p of W.parts) { p.life -= dt; } W.parts = W.parts.filter(p => p.life > 0); if (W.flash > 0) W.flash -= dt; W.shake = 0; }
  if (UI.camT) { const k = Math.min(1, dt * 6); cam.x += (UI.camT.x - cam.x) * k; cam.y += (UI.camT.y - cam.y) * k; if (Math.hypot(UI.camT.x - cam.x, UI.camT.y - cam.y) < 4) UI.camT = null; clampCam(); }
  draw();
  uiT += dt; if (uiT > .12) { uiT = 0; if (!$('hud').classList.contains('hidden')) UI.tick(); }
}
function boot() {
  cv = $('cv'); g = cv.getContext('2d', { alpha: false });
  loadSave(); buildArt(); buildWorld(); calcOffline();
  Snd.on = S.set.snd; Snd.music = S.set.mus; Music.mood = S.season;
  cam.z = 1; resize(); cam.z = defZoom(); cam.x = W.core.x; cam.y = 150; clampCam();
  UI.init(); bindInput();
  if (document.fonts && document.fonts.load) { document.fonts.load('800 20px Rubik'); }
  requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', boot);

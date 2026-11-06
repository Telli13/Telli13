/* Player controller: keyboard + on-screen touch controls. Movement is camera-relative.
 *   WASD / arrows — move      J / Z — attack (tap-tap for combos)
 *   K / X / Shift — dash      L / C — heavy (katana / sword)
 */
'use strict';

(() => {
  const keys = new Set();
  const pressed = { attack: false, heavy: false, dash: false };
  const KEYMAP = {
    KeyJ: 'attack', KeyZ: 'attack', Enter: 'attack',
    KeyK: 'dash', KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyL: 'heavy', KeyC: 'heavy',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a) { pressed[a] = true; e.preventDefault(); }
    EF.audio && EF.audio.unlock();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ---- touch controls ----
  const touch = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  let touchUI = null;
  function buildTouchUI() {
    if (touchUI) return touchUI;
    const ui = document.getElementById('ui');
    const root = document.createElement('div');
    root.className = 'touch';
    root.innerHTML = `
      <div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <div class="btns">
        <button data-a="heavy" class="b-heavy">⚔</button>
        <button data-a="dash" class="b-dash">»</button>
        <button data-a="attack" class="b-attack">👊</button>
      </div>`;
    ui.appendChild(root);
    const zone = root.querySelector('.stick-zone'), base = root.querySelector('.stick-base'), knob = root.querySelector('.stick-knob');
    zone.addEventListener('pointerdown', (e) => {
      touch.active = true; touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; touch.dx = touch.dy = 0;
      base.style.left = (e.clientX - 60) + 'px'; base.style.top = (e.clientY - 60) + 'px'; base.classList.add('on');
      zone.setPointerCapture(e.pointerId);
      EF.audio.unlock();
    });
    zone.addEventListener('pointermove', (e) => {
      if (!touch.active || e.pointerId !== touch.id) return;
      let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy;
      const l = Math.hypot(dx, dy), max = 50;
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      touch.dx = dx / max; touch.dy = dy / max;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (e) => {
      if (e.pointerId !== touch.id) return;
      touch.active = false; touch.dx = touch.dy = 0; knob.style.transform = ''; base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    root.querySelectorAll('button').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed[b.dataset.a] = true; b.classList.add('down'); EF.audio.unlock(); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
    });
    touchUI = root;
    return root;
  }

  class PlayerController {
    constructor(camera) {
      this.camera = camera;
      if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) buildTouchUI();
    }

    update(f) {
      let ix = 0, iy = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
      if (touch.active) { ix = touch.dx; iy = -touch.dy; }
      const l = Math.hypot(ix, iy);
      if (l > 1) { ix /= l; iy /= l; }
      const yaw = this.camera.yaw;
      // screen right = (cos yaw, -sin yaw), screen up (away from camera) = (-sin yaw, -cos yaw)
      f.ctrl.mx = ix * Math.cos(yaw) - iy * Math.sin(yaw);
      f.ctrl.mz = -ix * Math.sin(yaw) - iy * Math.cos(yaw);
      for (const k of ['attack', 'heavy', 'dash']) { if (pressed[k]) { f.ctrl[k] = true; pressed[k] = false; } }
    }
  }

  EF.PlayerController = PlayerController;
  EF.input = { keys, buildTouchUI };
})();

// Magic wand cursor + sparkle bursts on click.
// The cursor is a native system cursor image, so it costs nothing per mouse move.
(function () {
  const ML = window.ML;

  function wandSVG(hot) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs><radialGradient id="g"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffd36a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></radialGradient></defs>
      <circle cx="5" cy="5" r="${hot ? 5 : 3.6}" fill="url(#g)"/>
      ${hot ? '<path d="M5 0v3M5 7v3M0 5h3M7 5h3" stroke="#fff3c4" stroke-width="1" stroke-linecap="round"/>' : ''}
      <path d="M7 7L29 29" stroke="#140a03" stroke-width="5" stroke-linecap="round"/>
      <path d="M7 7L29 29" stroke="#6b3f1f" stroke-width="3" stroke-linecap="round"/>
      <path d="M7.5 7.5L11 11" stroke="#e8c27a" stroke-width="3" stroke-linecap="round"/>
      <path d="M21 21L28 28" stroke="#3a2010" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M20.5 20.5l1.5 1.5" stroke="#e8c27a" stroke-width="3.4"/>
      <circle cx="5" cy="5" r="1.5" fill="#fffbe6"/></svg>`;
  }
  const uri = svg => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}") 5 5`;

  let active = [];
  function sparkle(x, y, big) {
    const el = document.createElement('div');
    el.className = 'spark' + (big ? ' big' : '');
    el.style.transform = `translate(${x}px, ${y}px)`;
    const n = big ? 12 : 8;
    let html = '<b></b>';
    for (let i = 0; i < n; i++) {
      const a = Math.round(i * (360 / n) + Math.random() * 24);
      const d = Math.round((big ? 34 : 18) + Math.random() * (big ? 40 : 22));
      html += `<i style="--a:${a}deg;--d:${d}px"></i>`;
    }
    el.innerHTML = html;
    document.body.appendChild(el);
    active.push(el);
    if (active.length > 8) active.shift().remove();
    setTimeout(() => { el.remove(); active = active.filter(e => e !== el); }, 650);
  }

  function sparkleAt(el, big) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2, big);
  }

  // Use art/wand.png as the cursor when it exists. Cursors must be small (≤ 64 px),
  // so the picture is shrunk to 32×32 here when the browser allows it.
  function setWandImage(url) {
    const img = new Image();
    img.onload = () => {
      let data = url;
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        c.getContext('2d').drawImage(img, 0, 0, 32, 32);
        data = c.toDataURL('image/png');
      } catch (e) { /* local files may block this: then the file must already be 32×32 */ }
      const root = document.documentElement.style;
      root.setProperty('--wand', `url("${data}") 3 3, auto`);
      root.setProperty('--wand-hot', `url("${data}") 3 3, pointer`);
    };
    img.src = url;
  }

  // ---------- Calm mode ----------
  let calm = false;
  function setCalm(on) {
    calm = !!on;
    document.body.classList.toggle('calm', calm);
    if (calm) { tx = ty = 0; } // parallax back to centre
    wake();
  }

  // ---------- Mouse parallax + dust (one animation loop, sleeps when idle) ----------
  // The bookcase stays still (cheap, and books never slide under the cursor). The room behind
  // shifts with the mouse and the desk in front shifts against it: that reads as depth.
  const LAYERS = [['.l-room', -7], ['.l-beam', -9], ['.l-front', 22]];
  let layers = [];
  let tx = 0, ty = 0, cx = 0, cy = 0, wx = 9, wy = 9;   // target, current, last written (-1…1)
  let running = false, paused = false;
  let dust = null, motes = [], sprite = null, lastT = 0, dustT = 0;

  function makeSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    rg.addColorStop(0, 'rgba(255,246,214,1)');
    rg.addColorStop(0.4, 'rgba(255,230,170,.55)');
    rg.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 16, 16);
    return c;
  }
  function resetDust() {
    dust = ML.scene.dustCanvas();
    if (!dust) return;
    const n = Math.round(Math.min(60, dust.width * dust.height / 5500));
    motes = [];
    for (let i = 0; i < n; i++) motes.push(newMote(true));
  }
  function newMote(anywhere) {
    const W = dust.width, H = dust.height;
    // Spawn inside the window-light beam (a slanted band from the window to the floor).
    const t = Math.random();
    const bx = W * (0.08 + t * 0.6) + (Math.random() - 0.5) * W * 0.25;
    const by = H * (0.18 + t * 0.78);
    return {
      x: bx, y: by, s: 0.8 + Math.random() * 1.8,
      vx: (Math.random() - 0.3) * 2, vy: -0.8 - Math.random() * 1.5,
      a: 0, life: anywhere ? Math.random() * 20 : 0, max: 12 + Math.random() * 16, ph: Math.random() * 6.28,
    };
  }
  function drawDust(dt) {
    const g = dust.getContext('2d');
    g.clearRect(0, 0, dust.width, dust.height);
    for (let i = 0; i < motes.length; i++) {
      const p = motes[i];
      p.life += dt;
      if (p.life > p.max) { motes[i] = newMote(false); continue; }
      p.ph += dt * 0.8;
      p.x += (p.vx + Math.sin(p.ph) * 2) * dt;
      p.y += p.vy * dt;
      const fade = Math.min(1, p.life / 3, (p.max - p.life) / 3);
      g.globalAlpha = 0.55 * fade * (0.6 + 0.4 * Math.sin(p.ph * 2));
      g.drawImage(sprite, p.x, p.y, p.s * 2, p.s * 2);
    }
    g.globalAlpha = 1;
  }

  // Safety net: if this computer can't keep ~45+ fps with parallax and dust,
  // switch to "lite" (they stop; candles and glow stay). Calm mode is separate.
  let lite = false, slowFrames = 0, sampled = 0;
  function watchSpeed(dt) {
    if (lite || calm) return;
    sampled++;
    if (dt > 1 / 40) slowFrames++;
    if (sampled >= 120) {
      if (slowFrames > 50) {
        lite = true;
        document.body.classList.add('lite');
        tx = ty = 0;
      }
      sampled = slowFrames = 0;
    }
  }

  function quiet() { return calm || lite; }
  function wantLoop() { return !paused && !document.hidden && (!quiet() || Math.abs(cx - tx) + Math.abs(cy - ty) > 0.002); }
  function wake() { if (!running && wantLoop()) { running = true; lastT = performance.now(); requestAnimationFrame(tick); } }
  function tick(t) {
    if (!wantLoop()) { running = false; return; }
    const raw = (t - lastT) / 1000;
    const dt = Math.min(0.05, raw);
    lastT = t;
    if (raw < 0.5) watchSpeed(raw);
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    if (Math.abs(cx - wx) + Math.abs(cy - wy) > 0.0005) {
      wx = cx; wy = cy;
      for (const [el, k] of layers) el.style.transform = `translate3d(${(-cx * k).toFixed(2)}px, ${(-cy * k * 0.6).toFixed(2)}px, 0)`;
    }
    dustT += dt;
    if (!quiet() && dust && dustT >= 1 / 30) { drawDust(dustT); dustT = 0; } // dust drifts slowly: 30 updates/s is plenty
    requestAnimationFrame(tick);
  }

  function init() {
    const root = document.documentElement.style;
    root.setProperty('--wand', `${uri(wandSVG(false))}, auto`);
    root.setProperty('--wand-hot', `${uri(wandSVG(true))}, pointer`);
    document.addEventListener('pointerdown', e => {
      if (e.button === 0) sparkle(e.clientX, e.clientY);
    }, { capture: true, passive: true });

    // Placeholder leather grain for book spines (art/spine-*.png replaces it).
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 160;
      const g = c.getContext('2d');
      const img = g.createImageData(64, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 70 + Math.sin(i * 0.013) * 8;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      root.setProperty('--leather', `url("${c.toDataURL()}")`);
    } catch (e) { /* no texture: plain colour */ }

    layers = LAYERS.map(([sel, k]) => [document.querySelector(sel), k]).filter(l => l[0]);
    sprite = makeSprite();
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || quiet()) return;
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
      wake();
    }, { passive: true });
    document.addEventListener('visibilitychange', wake);
  }

  // Freeze the scene while a book is open (nothing behind it needs to move).
  function pause(on) { paused = !!on; wake(); }

  ML.fx = { init, sparkle, sparkleAt, setWandImage, setCalm, isCalm: () => calm, isLite: () => lite, pause, resetDust, wake };
})();

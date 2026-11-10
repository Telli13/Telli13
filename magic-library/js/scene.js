// The room around the bookcase, in layers (back → front):
//   .l-room  (wall, arched window)  →  .l-beam (window light + dust)  →  #hall (bookcase)
//   →  .l-front (desk, armchair, globe, plant, candles, open book, cup, quill)  →  light & vignette
// Every picture carries data-slot="…" so a real image in art/ replaces the placeholder (js/art-slots.js).
(function () {
  const ML = window.ML;
  const { candle, decor } = ML.art;

  // ---------- placeholder drawings (simple SVG; replaced by generated art later) ----------
  const ROOM = `<svg class="ph" viewBox="0 0 1920 1080" preserveAspectRatio="xMinYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="r-wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2a170c"/><stop offset=".55" stop-color="#21110a"/><stop offset="1" stop-color="#120804"/></linearGradient>
      <pattern id="r-panels" width="170" height="1080" patternUnits="userSpaceOnUse">
        <rect width="170" height="1080" fill="url(#r-wall)"/>
        <rect width="4" height="1080" fill="#0b0502" opacity=".75"/><rect x="4" width="2" height="1080" fill="#6a3d1c" opacity=".22"/>
        <rect x="22" y="110" width="126" height="420" rx="8" fill="#000" opacity=".12" stroke="#5a3418" stroke-opacity=".25" stroke-width="3"/>
        <rect x="22" y="580" width="126" height="300" rx="8" fill="#000" opacity=".12" stroke="#5a3418" stroke-opacity=".25" stroke-width="3"/>
      </pattern>
      <linearGradient id="r-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff7de"/><stop offset=".3" stop-color="#f6e2a6"/><stop offset=".62" stop-color="#c9b56a"/><stop offset="1" stop-color="#7d7a3a"/></linearGradient>
      <radialGradient id="r-sun" cx=".45" cy=".22" r=".6"><stop offset="0" stop-color="#fffbea" stop-opacity=".95"/><stop offset="1" stop-color="#fffbea" stop-opacity="0"/></radialGradient>
      <linearGradient id="r-stone" x1="0" x2="1"><stop offset="0" stop-color="#2c170b"/><stop offset=".5" stop-color="#5b3519"/><stop offset="1" stop-color="#2c170b"/></linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#r-panels)"/>
    <rect width="1920" height="60" fill="#0d0603" opacity=".7"/>
    <g transform="translate(60 40)">
      <path d="M-18 790V215A168 168 0 0 1 318 215V790Z" fill="url(#r-stone)"/>
      <path d="M22 760V220A128 128 0 0 1 278 220V760Z" fill="url(#r-sky)"/>
      <g fill="#3d3a1c" opacity=".6"><rect x="58" y="230" width="16" height="530"/><rect x="190" y="180" width="22" height="580"/><rect x="132" y="300" width="9" height="460"/><rect x="240" y="260" width="12" height="500"/></g>
      <g fill="#d69a3a" opacity=".55"><circle cx="70" cy="240" r="46"/><circle cx="205" cy="200" r="58"/><circle cx="140" cy="330" r="40"/><circle cx="255" cy="300" r="40"/><circle cx="40" cy="420" r="34"/></g>
      <g fill="#8a9a3c" opacity=".45"><circle cx="110" cy="250" r="34"/><circle cx="230" cy="380" r="30"/><circle cx="60" cy="520" r="36"/></g>
      <path d="M22 760V220A128 128 0 0 1 278 220V760Z" fill="url(#r-sun)"/>
      <g stroke="#24130a" stroke-width="10" fill="none"><path d="M150 92V760M22 330H278M22 520H278M86 135V760M214 135V760"/><path d="M22 760V220A128 128 0 0 1 278 220V760Z" stroke-width="14"/></g>
      <rect x="-40" y="760" width="380" height="30" rx="4" fill="#4a2a14"/>
      <g fill="#4f7a3a"><path d="M-10 230c40 10 60 60 50 110-20-30-50-60-50-110z"/><path d="M20 150c40 0 60 40 60 80-30-20-60-40-60-80z"/><path d="M-20 360c30 20 40 50 30 90-20-20-40-50-30-90z"/></g>
    </g>
    <rect y="940" width="1920" height="140" fill="#0f0703"/>
  </svg>`;

  const BEAM = `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMinYMax slice" aria-hidden="true">
    <defs><linearGradient id="b-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0c8" stop-opacity=".30"/><stop offset=".55" stop-color="#ffd890" stop-opacity=".10"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></linearGradient></defs>
    <path d="M90 220L340 170L1250 1080L330 1080Z" fill="url(#b-g)"/></svg>`;

  const ARMCHAIR = `<svg class="ph" viewBox="0 0 400 520" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
    <defs><linearGradient id="a-l" x1="0" x2="1"><stop offset="0" stop-color="#2a1208"/><stop offset=".6" stop-color="#5a2a14"/><stop offset="1" stop-color="#3a1a0c"/></linearGradient>
      <pattern id="a-p" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><rect width="36" height="36" fill="#7a1c18"/><rect width="36" height="5" fill="#c9883a" opacity=".6"/><rect y="14" width="36" height="2" fill="#3a0c0a"/><rect x="16" width="3" height="36" fill="#a13a22" opacity=".7"/></pattern></defs>
    <path d="M0 40c90-30 190-20 240 40 30 40 30 140 26 230H0z" fill="url(#a-l)"/>
    <g fill="#1a0904" opacity=".6"><circle cx="60" cy="110" r="5"/><circle cx="130" cy="100" r="5"/><circle cx="190" cy="130" r="5"/><circle cx="90" cy="170" r="5"/><circle cx="160" cy="180" r="5"/><circle cx="60" cy="230" r="5"/><circle cx="130" cy="240" r="5"/><circle cx="200" cy="240" r="5"/></g>
    <path d="M150 300c60-30 150-30 200 10 30 30 20 80-10 90H140z" fill="#4a2010"/>
    <path d="M0 300h330v220H0z" fill="url(#a-l)"/>
    <path d="M-10 250c80 40 170 30 240 80 50 40 70 120 50 190H-10z" fill="url(#a-p)"/>
    <path d="M-10 250c80 40 170 30 240 80 50 40 70 120 50 190" fill="none" stroke="#2a0604" stroke-width="5" opacity=".6"/>
  </svg>`;

  const GLOBE = `<svg class="ph" viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <ellipse cx="100" cy="292" rx="60" ry="8" fill="#000" opacity=".5"/>
    <path d="M55 290h90l-12-22H67z" fill="#4a2a14"/><rect x="94" y="200" width="12" height="70" fill="url(#g-brass)"/>
    <circle cx="100" cy="120" r="74" fill="url(#g-globe)"/>
    <g fill="#7a6a2c" opacity=".75"><path d="M48 92c14-12 32-4 44-10s12-18 28-14 16 22 4 28-26 0-32 14-22 10-32 4-22-10-12-22z"/><path d="M104 140c12-6 28 0 32 12s-6 26-18 26-22-10-20-20z"/><path d="M60 150c8 0 14 10 10 20s-16 6-18-4 0-16 8-16z"/></g>
    <circle cx="100" cy="120" r="74" fill="none" stroke="#3a2010" stroke-opacity=".5" stroke-width="2"/>
    <path d="M100 30a90 90 0 0 1 0 180" fill="none" stroke="url(#g-brass)" stroke-width="7"/>
    <path d="M100 30a90 90 0 0 0 0 180" fill="none" stroke="url(#g-brass)" stroke-width="3" opacity=".5"/>
    <ellipse cx="72" cy="86" rx="20" ry="12" fill="#fff8e0" opacity=".35"/>
  </svg>`;

  const PLANT = `<svg class="ph" viewBox="0 0 200 320" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    <ellipse cx="110" cy="312" rx="60" ry="8" fill="#000" opacity=".5"/>
    <path d="M60 240h100l-14 70H74z" fill="#7a3e1c"/><rect x="54" y="232" width="112" height="16" rx="4" fill="#9a5226"/>
    <g fill="#4f7a3a"><path d="M110 236c-10-60-50-90-96-96 20 40 50 80 96 96z"/><path d="M110 236c4-70 40-120 84-136-8 56-36 110-84 136z"/><path d="M110 236c-6-80-2-150 12-210 22 70 16 150-12 210z"/></g>
    <g fill="#3c6430"><path d="M110 236c-30-30-70-36-100-30 30 20 60 32 100 30z"/><path d="M110 236c30-40 70-50 90-46-20 30-50 46-90 46z"/></g>
    <g stroke="#2c4a22" stroke-width="2" fill="none" opacity=".6"><path d="M110 236C90 190 60 160 20 145M110 236c10-50 40-100 80-130M110 236c-2-70 2-140 12-200"/></g>
  </svg>`;

  const OPEN_BOOK = `<svg class="ph" viewBox="0 0 400 180" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <path d="M10 160L40 40c60-14 120-6 160 18 40-24 100-32 160-18l30 120c-60-12-130-6-190 16-60-22-130-28-190-16z" fill="#5a1a14"/>
    <path d="M24 150L50 46c54-10 110-2 150 20v104c-50-20-120-26-176-20z" fill="#f2e3c0"/>
    <path d="M376 150L350 46c-54-10-110-2-150 20v104c50-20 120-26 176-20z" fill="#ead7ad"/>
    <path d="M200 66v104" stroke="#a88a5a" stroke-width="2"/>
    <g stroke="#8a6a3a" stroke-width="1.4" fill="none" opacity=".7"><path d="M110 140v-50M110 100c-14-10-26-8-34-2M110 100c14-10 26-8 34-2M110 112c-16-6-30-2-36 6M110 112c16-6 30-2 36 6"/></g>
    <g stroke="#b59a6a" stroke-width="1.4" opacity=".55"><path d="M226 80h110M228 92h108M230 104h104M232 116h100M234 128h96"/></g>
  </svg>`;

  const QUILL = `<svg class="ph" viewBox="0 0 120 260" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <path d="M30 220h50l-6-36H36z" fill="#140b10"/><ellipse cx="55" cy="184" rx="20" ry="6" fill="#2a1a20"/><ellipse cx="50" cy="196" rx="6" ry="10" fill="#fff" opacity=".2"/>
    <path d="M58 186C70 120 92 60 116 4 100 50 86 110 64 186z" fill="#f4ead6"/>
    <path d="M58 186C66 140 80 96 100 40c-4 40-14 90-34 146z" fill="#d9c9a6"/>
    <path d="M60 186L110 14" stroke="#9a8a6a" stroke-width="1.4"/>
    <ellipse cx="55" cy="224" rx="34" ry="5" fill="#000" opacity=".4"/>
  </svg>`;

  const CUP = `<svg class="ph" viewBox="0 0 150 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <ellipse cx="66" cy="124" rx="56" ry="6" fill="#000" opacity=".45"/>
    <path d="M114 46c26 0 30 40 0 46" fill="none" stroke="#5a2e14" stroke-width="10"/>
    <path d="M14 30h104l-8 82c-2 10-10 14-20 14H42c-10 0-18-4-20-14z" fill="#6a3418"/>
    <path d="M14 30h104l-2 14H16z" fill="#8a4a24"/><ellipse cx="66" cy="30" rx="52" ry="8" fill="#2a1206"/>
    <g stroke="#e0b060" stroke-width="2" fill="none" opacity=".85"><path d="M66 104V70M66 80c-8-6-16-6-20-2M66 80c8-6 16-6 20-2M66 90c-10-4-18-2-22 2M66 90c10-4 18-2 22 2"/></g>
  </svg>`;

  const IVY = `<svg class="ph" viewBox="0 0 320 200" preserveAspectRatio="xMinYMin meet" aria-hidden="true">
    <path d="M0 20C80 30 160 10 320 26" stroke="#3a2a12" stroke-width="4" fill="none"/>
    <path d="M60 24c-4 50 6 100-6 160M200 18c4 40-4 70 4 110" stroke="#3a2a12" stroke-width="3" fill="none"/>
    <g fill="#5f8a3a"><path d="M20 20c10-14 30-10 30 4-14 8-24 6-30-4z"/><path d="M90 26c10-14 30-10 30 4-14 8-24 6-30-4z"/><path d="M160 16c10-14 30-10 30 4-14 8-24 6-30-4z"/><path d="M250 22c10-14 30-10 30 4-14 8-24 6-30-4z"/>
      <path d="M58 70c-14-10-12-30 2-30 8 14 6 24-2 30z"/><path d="M62 120c14-10 12-30-2-30-8 14-6 24 2 30z"/><path d="M56 170c-14-10-12-30 2-30 8 14 6 24-2 30z"/><path d="M202 70c14-10 12-30-2-30-8 14-6 24 2 30z"/><path d="M200 120c-14-10-12-30 2-30 8 14 6 24-2 30z"/></g>
    <g fill="#c99a3a" opacity=".85"><path d="M130 22c10-12 26-8 26 4-12 6-20 4-26-4z"/><path d="M58 96c-12-8-10-24 2-24 6 12 4 20-2 24z"/></g>
  </svg>`;

  let els = {};

  function item(cls, slot, inner, extra) {
    return `<div class="fg ${cls}" data-slot="${slot}">${inner}${extra || ''}</div>`;
  }

  function init() {
    els.room = document.querySelector('.l-room');
    els.beam = document.querySelector('.l-beam');
    els.front = document.querySelector('.l-front');
    els.room.innerHTML = `<div class="room-art" data-slot="room">${ROOM}</div>`;
    els.beam.innerHTML = `<div class="beam">${BEAM}</div><canvas class="dust" aria-hidden="true"></canvas>`;
    els.front.innerHTML = [
      item('globe-big', 'globe', GLOBE),
      item('plant-big', 'plant', PLANT),
      '<div class="desk" data-slot="desk"></div>',
      `<div class="fg candles-left">${candle('', 'height:100%')}${candle('small', 'height:72%')}</div>`,
      `<div class="fg candles-right">${candle('', 'height:100%')}</div>`,
      item('open-book', 'open-book', OPEN_BOOK),
      item('cup', 'cup', CUP, '<i class="steam s1"></i><i class="steam s2"></i>'),
      item('quill', 'quill', QUILL),
      `<div class="fg desk-stack">${decor('stack')}</div>`,
      item('armchair', 'armchair', ARMCHAIR),
    ].join('');
    els.ivy = document.createElement('div');
    els.ivy.className = 'ivy';
    els.ivy.dataset.slot = 'ivy';
    els.ivy.innerHTML = IVY;
    els.dust = els.beam.querySelector('.dust');
  }

  const px = v => Math.round(v) + 'px';
  function put(sel, o) {
    const el = els.front.querySelector(sel);
    if (!el) return;
    el.hidden = !!o.hide;
    if (o.hide) return;
    const s = el.style;
    s.left = o.left != null ? px(o.left) : '';
    s.right = o.right != null ? px(o.right) : '';
    s.bottom = px(o.bottom);
    s.width = px(o.w);
    s.height = px(o.h);
  }

  // Place the furniture around the bookcase (pl = bookcase rectangle from ML.layout.place).
  function layout(m, pl, hallEl) {
    const W = m.W, H = m.H, dh = m.deskH;
    const surface = H - m.deskTop - dh * 0.32;          // y (from bottom) where things stand on the desk
    const caseR = pl.left + pl.width;
    const full = !m.compact;
    const leftSpace = pl.left, rightSpace = W - caseR;

    const chairH = Math.min(H * 0.42, W * 0.28);
    put('.armchair', { hide: !full || leftSpace < 90, left: -chairH * 0.16, bottom: -chairH * 0.05, w: chairH * 0.77, h: chairH });
    // The globe stands on a side table by the window, above the armchair.
    const gH = Math.min(H * 0.3, leftSpace * 1.2);
    put('.globe-big', { hide: !full || leftSpace < 140, left: Math.max(4, leftSpace * 0.42 - gH * 0.33), bottom: chairH * 0.62, w: gH * 0.67, h: gH });
    const pW = Math.min(rightSpace + 20, H * 0.22);
    put('.plant-big', { hide: !full || rightSpace < 70, right: -pW * 0.08, bottom: surface, w: pW, h: pW * 1.6 });

    const cH = dh * 0.95;
    put('.candles-left', { hide: !full, left: leftSpace > 140 ? leftSpace - cH * 0.75 : W * 0.02, bottom: surface - dh * 0.06, w: cH * 0.8, h: cH });
    put('.candles-right', { hide: !full || rightSpace < 40, right: Math.max(8, rightSpace * 0.3), bottom: surface, w: cH * 0.4, h: cH });

    const bookW = dh * 1.35;
    const bx = pl.left + Math.min(pl.width * 0.08, 80);
    put('.open-book', { hide: !full, left: bx, bottom: surface - dh * 0.14, w: bookW, h: bookW * 0.45 });
    put('.cup', { hide: !full, left: bx + bookW + dh * 0.12, bottom: surface, w: dh * 0.52, h: dh * 0.45 });
    put('.quill', { hide: !full, left: bx + bookW + dh * 0.62, bottom: surface - dh * 0.02, w: dh * 0.3, h: dh * 0.64 });
    put('.desk-stack', { hide: !full || pl.width < 700, left: bx + bookW + dh * 0.95, bottom: surface - dh * 0.06, w: dh * 0.36, h: dh * 0.62 });

    // Ivy hangs over the top-left corner of the bookcase crown.
    hallEl.appendChild(els.ivy);
    els.ivy.hidden = !full;
    const iw = Math.min(pl.width * 0.32, 340);
    Object.assign(els.ivy.style, { left: px(pl.left - iw * 0.08), top: px(pl.top - 6), width: px(iw), height: px(Math.min(m.crownH + 12, iw * 0.4)) });

    // Dust canvas covers the window-light area only (left part of the screen).
    const c = els.dust;
    // Drawn at half resolution (soft dust needs no detail) and stretched: 4× fewer pixels.
    c.width = Math.round(W * 0.31); c.height = Math.round(H / 2);
    c.style.width = Math.round(W * 0.62) + 'px'; c.style.height = H + 'px';
  }

  ML.scene = { init, layout, dustCanvas: () => els.dust };
})();

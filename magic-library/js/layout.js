// Pure math: how big books are, how many shelves fit, and how folders are
// split into bookcases ("units") and walls (one wall = one screen).
(function () {
  const ML = window.ML;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // compact = small/short screen: search gets its own top bar, and Favorites
  // becomes the first bookcase on the wall instead of a separate top shelf.
  function compute(W, H, bookH, compact) {
    const bookW = Math.round(bookH * 0.4);
    const gap = Math.max(4, Math.round(bookW * 0.08));
    const boardH = Math.max(8, Math.round(bookH * 0.07));
    const rowGap = Math.round(bookH * 0.07);
    const plaqueH = Math.round(clamp(bookH * 0.19, 26, 40));
    const framePad = Math.round(bookW * 0.24);
    const border = W < 500 ? 7 : 9;
    const footerH = Math.round(clamp(H * 0.065, 44, 60));
    const slot = bookW + gap;
    const unitH = border * 2 + framePad * 2;
    const topH = compact ? 64 : 0;                       // search bar row (compact only)
    const rightCol = compact ? 0 : Math.round(clamp(W * 0.26, 240, 360));
    // Favorites may only use the space left of the Exit/Search column (+ 24px breathing room).
    const favMaxCols = compact ? 0 : Math.floor((W - 24 - 24 - rightCol - 24 - unitH + gap) / slot);
    const favH = compact ? 0 : border * 2 + plaqueH + 6 + bookH + boardH + 12;
    const hallTop = compact ? topH : favH + 6;
    const hallH = H - hallTop - footerH;
    const unitV = border * 2 + plaqueH + 6 + 30; // frame + plaque + crown + breathing room
    const rows = clamp(Math.floor((hallH - unitV + rowGap) / (bookH + boardH + rowGap)), 0, 4);
    const navM = Math.round(clamp(W * 0.045, 30, 80));
    const wallW = W - navM * 2;
    const maxCols = clamp(Math.floor((wallW - unitH + gap) / slot), 1, 12);
    const unitGap = Math.round(bookW * 0.45);

    // Open book: one page at a time on narrow (phone) screens, two pages otherwise.
    const single = W < 700;
    let spreadW, spreadH;
    if (single) {
      spreadW = Math.round(Math.min(W - 40, 520));
      spreadH = Math.round(Math.min(H - 170, spreadW * 1.55));
    } else {
      spreadW = Math.round(Math.min(W * 0.88, (H - 140) * 1.5, 1300));
      spreadH = Math.round(Math.min(H * 0.8, H - 140, spreadW / 1.45));
    }
    const entryH = Math.round(clamp(spreadH / 17, 30, 42));
    const pageW = single ? spreadW : spreadW / 2;

    return {
      W, H, compact, bookW, bookH, gap, boardH, rowGap, plaqueH, framePad, border, footerH, topH, favH, hallTop, hallH,
      rows, navM, wallW, maxCols, favMaxCols, unitGap, rightCol, single, spreadW, spreadH, entryH, tight: pageW < 330,
      unitWidth: cols => border * 2 + framePad * 2 + cols * bookW + (cols - 1) * gap,
    };
  }

  function metrics(W, H) {
    let compact = W < 760 || H < 600;
    let bookH = Math.round(clamp(Math.min(H * 0.19, W * 0.4), 100, 214));
    let m = compute(W, H, bookH, compact);
    if (!compact && m.favMaxCols < 4) { compact = true; m = compute(W, H, bookH, compact); }
    // Prefer two shelves per bookcase; on very short screens accept one, but it must fit.
    while ((m.rows < 2 && bookH > 110) || (m.rows < 1 && bookH > 72)) {
      bookH = Math.round(bookH * 0.92);
      m = compute(W, H, bookH, compact);
    }
    m.rows = Math.max(1, m.rows);
    return m;
  }

  function pickDecor(seed, i) {
    const names = ML.art.DECOR_NAMES;
    return names[ML.art.hash(seed + ':' + i) % names.length];
  }

  // shelves: [{ loc, folders }] → walls: [{ units: [unit], width }]
  function build(shelves, m) {
    const units = [];
    for (const { loc, folders } of shelves) {
      const n = folders.length;
      const cap = m.rows * m.maxCols;
      const parts = Math.max(1, Math.ceil(n / cap));
      const per = Math.ceil(n / parts);
      for (let p = 0; p < parts; p++) {
        const items = folders.slice(p * per, (p + 1) * per);
        const cols = clamp(Math.ceil(Math.max(items.length, 1) / m.rows), Math.min(3, m.maxCols), m.maxCols);
        const slots = [];
        for (let i = 0; i < cols * m.rows; i++) {
          if (i < items.length) { slots.push({ book: items[i] }); continue; }
          let d = pickDecor(loc.id + p, i);
          const prev = slots[i - 1], above = slots[i - cols];
          for (let k = 1; k < 4 && ((prev && prev.decor === d) || (above && above.decor === d)); k++) d = pickDecor(loc.id + p, i + k * 97);
          slots.push({ decor: d });
        }
        units.push({ loc, part: p, parts, cols, rows: m.rows, slots, width: m.unitWidth(cols) });
      }
    }
    const walls = [];
    let cur = null;
    for (const u of units) {
      if (!cur || cur.width + m.unitGap + u.width > m.wallW) {
        cur = { units: [], width: -m.unitGap };
        walls.push(cur);
      }
      cur.units.push(u);
      cur.width += m.unitGap + u.width;
    }
    return walls;
  }

  ML.layout = { metrics, build, pickDecor, clamp };
})();

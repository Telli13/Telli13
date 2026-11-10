// Pure math: how big books are, how many shelves fit, and how folders are
// split into bookcases ("units") and walls (one wall = one screen).
(function () {
  const ML = window.ML;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function compute(W, H, bookH) {
    const bookW = Math.round(bookH * 0.4);
    const gap = Math.max(4, Math.round(bookW * 0.08));
    const boardH = Math.max(10, Math.round(bookH * 0.07));
    const rowGap = Math.round(bookH * 0.07);
    const plaqueH = Math.round(clamp(bookH * 0.19, 28, 40));
    const framePad = Math.round(bookW * 0.24);
    const border = 9;
    const footerH = Math.round(clamp(H * 0.065, 44, 60));
    const favH = border * 2 + plaqueH + 6 + bookH + boardH + 12;
    const hallTop = favH + 6;
    const hallH = H - hallTop - footerH;
    const unitV = border * 2 + plaqueH + 6 + 16; // frame + plaque + breathing room
    const rows = clamp(Math.floor((hallH - unitV + rowGap) / (bookH + boardH + rowGap)), 1, 4);
    const navM = Math.round(clamp(W * 0.045, 44, 80));
    const wallW = W - navM * 2;
    const unitH = border * 2 + 2 * framePad;
    const slot = bookW + gap;
    const maxCols = clamp(Math.floor((wallW - unitH + gap) / slot), 3, 12);
    const rightCol = clamp(W * 0.26, 230, 360); // search + exit area
    const favMaxCols = clamp(Math.floor((W - 48 - rightCol - unitH + gap) / slot), 2, 16);
    const unitGap = Math.round(bookW * 0.45);

    // Open book ("tome") size
    const spreadW = Math.round(Math.min(W * 0.86, (H * 0.8) * 1.5, 1300));
    const spreadH = Math.round(Math.min(H * 0.8, spreadW / 1.45));
    const entryH = Math.round(clamp(spreadH / 17, 28, 42));

    return {
      W, H, bookW, bookH, gap, boardH, rowGap, plaqueH, framePad, border, footerH, favH, hallTop, hallH,
      rows, navM, wallW, maxCols, favMaxCols, unitGap, rightCol, spreadW, spreadH, entryH,
      unitWidth: cols => border * 2 + framePad * 2 + cols * bookW + (cols - 1) * gap,
    };
  }

  function metrics(W, H) {
    let bookH = Math.round(clamp(H * 0.19, 118, 214));
    let m = compute(W, H, bookH);
    // Prefer at least two shelves per bookcase: shrink books a little if needed.
    while (m.rows < 2 && bookH > 118) {
      bookH = Math.max(118, Math.round(bookH * 0.92));
      m = compute(W, H, bookH);
    }
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
        const cols = clamp(Math.ceil(Math.max(items.length, 1) / m.rows), 3, m.maxCols);
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

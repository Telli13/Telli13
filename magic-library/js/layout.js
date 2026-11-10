// Pure math for the 2.5D scene: book size, how many shelf tiers fit, where the big
// bookcase stands, and how sections (Drive C, HDD…) flow onto the tiers.
//
// Picture (wide screens):                 Picture (compact: phones / short screens):
//   [ room · window ]  [  crown  ]  Exit     [ search spell ............ ] [Exit]
//                      | Favorites | spell|  |  crown                         |
//                      | Drive C | HDD 2TB |  | Favorites | Drive C ...        |
//                      | Downloads | Docs  |  |  ...                           |
//   armchair  [ desk with book, cup, candles ]  [ thin desk with controls ]
(function () {
  const ML = window.ML;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function compute(W, H, bookH, compact) {
    const bookW = Math.round(bookH * 0.4);
    const gap = Math.max(3, Math.round(bookW * 0.07));
    const boardH = Math.max(8, Math.round(bookH * 0.08));
    const plaqueH = Math.round(clamp(bookH * 0.2, 24, 40));
    const plaqueBand = plaqueH + Math.round(bookH * 0.07);
    const tierH = plaqueBand + bookH + boardH;
    const secPad = Math.round(bookW * 0.2);
    const pillarW = Math.round(clamp(bookW * 0.45, 12, 40));
    const frameSide = Math.round(clamp(bookW * 0.42, 14, 46));
    const crownH = compact ? Math.round(frameSide * 1.1) : Math.round(clamp(H * 0.06, 30, 76));
    const deskH = compact ? 52 : Math.round(clamp(H * 0.155, 96, 180));
    const controlsH = compact ? 52 : Math.round(clamp(deskH * 0.34, 36, 48));
    const rise = compact ? 6 : Math.round(deskH * 0.3);      // how far desk decor rises above the desk top
    const baseMin = compact ? frameSide : Math.max(rise + 8, Math.round(H * 0.035));
    const topPad = compact ? 64 : Math.round(clamp(H * 0.05, 40, 62));
    const favTierH = compact ? 0 : tierH;
    const deskTop = H - deskH;
    const tiersSpace = deskTop - baseMin - topPad - crownH - favTierH;
    const tiers = clamp(Math.floor(tiersSpace / tierH), 0, 5);

    const navM = compact ? 30 : Math.round(clamp(W * 0.034, 36, 64));
    const leftRoom = compact ? 0 : W >= 1500 ? Math.round(W * 0.16) : W >= 1150 ? Math.round(W * 0.09) : 0;
    const rightRoom = compact ? 0 : W >= 1150 ? Math.round(W * 0.045) : 0;
    const regionL = leftRoom + navM;
    const regionW = W - leftRoom - rightRoom - navM * 2;
    const innerWMax = regionW - frameSide * 2;
    const searchW = compact ? 0 : Math.round(clamp(innerWMax * 0.3, 220, 380));

    // Open book (unchanged behaviour): one page on phones, two pages otherwise.
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
      W, H, compact, bookW, bookH, gap, boardH, plaqueH, plaqueBand, tierH, secPad, pillarW, frameSide,
      crownH, deskH, controlsH, rise, baseMin, topPad, favTierH, deskTop, tiers, navM, leftRoom, rightRoom,
      regionL, regionW, innerWMax, searchW, single, spreadW, spreadH, entryH, tight: pageW < 330,
      slot: bookW + gap,
      secW: n => n * bookW + (n - 1) * gap + 2 * secPad,
      slotsFit: w => Math.max(1, Math.floor((w - 2 * secPad + gap) / (bookW + gap))),
    };
  }

  function metrics(W, H) {
    let compact = W < 760 || H < 680;
    const pick = c => {
      // Biggest books (up to ~19% of the height) that still give the wanted number of tiers.
      const want = c ? 2 : 2; // tiers below Favorites (compact: Favorites is in the flow)
      let bookH = Math.round(clamp(Math.min(H * 0.19, c ? W * 0.36 : 1e9), 96, 214));
      let m = compute(W, H, bookH, c);
      while (m.tiers < want && bookH > 100) { bookH = Math.round(bookH * 0.95); m = compute(W, H, bookH, c); }
      while (m.tiers < 1 && bookH > 70) { bookH = Math.round(bookH * 0.92); m = compute(W, H, bookH, c); }
      m.tiers = Math.max(1, m.tiers);
      return m;
    };
    let m = pick(compact);
    // Wide layout needs room for Favorites + the search scroll on the top tier.
    if (!compact && (m.bookH < 110 || m.slotsFit(m.innerWMax - m.searchW - m.pillarW) < 3)) m = pick(true);
    return m;
  }

  function pickDecor(seed, i) {
    const names = ML.art.DECOR_NAMES;
    return names[ML.art.hash(seed + ':' + i) % names.length];
  }

  // sections: [{ loc, folders }] → { walls: [{ tiers: [tier] }], innerW, tiersShown }
  // tier = { secs: [{ loc, part, parts, slots: [{book}|{decor}], x }], spare }
  function build(sections, m, favCount) {
    const maxSlots = m.slotsFit(m.innerWMax);
    const minSlots = Math.min(3, maxSlots);
    const chunks = [];
    for (const { loc, folders } of sections) {
      const parts = Math.max(1, Math.ceil(folders.length / maxSlots));
      const per = Math.ceil(folders.length / parts) || 0;
      for (let p = 0; p < parts; p++) {
        const items = folders.slice(p * per, (p + 1) * per);
        chunks.push({ loc, part: p, parts, items, n: Math.max(items.length, minSlots) });
      }
    }
    const pack = innerW => {
      const tiers = [];
      let cur = null;
      for (const c of chunks) {
        const w = m.secW(c.n);
        if (!cur || cur.used + m.pillarW + w > innerW) { cur = { secs: [], used: -m.pillarW }; tiers.push(cur); }
        cur.secs.push({ ...c });
        cur.used += m.pillarW + w;
      }
      return tiers;
    };

    // Small libraries get a smaller bookcase: the narrowest width that still fits on one wall.
    let minInner = Math.max(...chunks.map(c => m.secW(c.n)), 0);
    if (!m.compact) minInner = Math.max(minInner, m.secW(Math.min(Math.max(favCount, 3), 8)) + m.pillarW + m.searchW);
    minInner = Math.min(minInner, m.innerWMax);
    let innerW = m.innerWMax;
    let tiers = pack(innerW);
    if (tiers.length <= m.tiers) {
      for (let w = minInner; w < m.innerWMax; w += m.slot) {
        const t = pack(w);
        if (t.length <= m.tiers) { innerW = w; tiers = t; break; }
      }
    }

    // Fill each tier's leftover space with decor (candles, globes…) at the sections' ends.
    tiers.forEach((t, ti) => {
      let free = innerW - t.used, k = 0;
      while (free >= m.slot && t.secs.length) { t.secs[k % t.secs.length].n++; free -= m.slot; k++; }
      t.spare = free;
      let x = 0;
      t.secs.forEach((s, si) => {
        s.x = x;
        s.slots = [];
        for (let i = 0; i < s.n; i++) {
          if (i < s.items.length) { s.slots.push({ book: s.items[i] }); continue; }
          let d = pickDecor(s.loc.id + s.part + ':' + ti, i);
          const prev = s.slots[i - 1];
          for (let j = 1; j < 4 && prev && prev.decor === d; j++) d = pickDecor(s.loc.id + s.part + ':' + ti, i + j * 97);
          s.slots.push({ decor: d });
        }
        x += m.secW(s.n) + m.pillarW + (t.secs.length > 1 ? t.spare / (t.secs.length - 1) : 0);
        if (t.secs.length === 1) s.x = t.spare / 2;
      });
    });

    const walls = [];
    for (let i = 0; i < tiers.length; i += m.tiers) walls.push({ tiers: tiers.slice(i, i + m.tiers) });
    if (!walls.length) walls.push({ tiers: [] });
    const tiersShown = Math.max(1, walls.length > 1 ? m.tiers : tiers.length);
    return { walls, innerW, tiersShown };
  }

  // Where the bookcase stands (it rests on the floor behind the desk).
  function place(m, innerW, tiersShown) {
    const width = innerW + m.frameSide * 2;
    const left = Math.round(m.regionL + (m.regionW - width) / 2);
    const bottom = m.compact ? m.H - m.deskH + 4 : m.H - Math.round(m.deskH * 0.45);
    const tiersBottom = m.deskTop - m.baseMin;
    const tiersTop = tiersBottom - tiersShown * m.tierH;
    const top = tiersTop - m.favTierH - m.crownH;
    return { left, top, width, height: bottom - top, tiersTop, tiersBottom, baseH: bottom - tiersBottom, innerW };
  }

  ML.layout = { metrics, build, place, pickDecor, clamp };
})();

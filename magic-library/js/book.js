// The open book: a two-page spread showing one folder ("chapter").
// Only the two visible pages (plus a turning leaf during animation) exist in the page.
(function () {
  const ML = window.ML;
  const { icon, folderIcon, fileIcon, esc, hash } = ML.art;
  const T = ML.T;

  let layer, backdrop, tome, board, pagesEl, leftEl, rightEl, ribbonsEl, prevBtn, nextBtn, closeBtn;
  let cover = null;
  let st = null;     // { top, source, stack, chapter, spread }
  let busy = false;
  let fit = { first: 8, per: 12 };
  let lastWheel = 0;
  let per = 2;       // pages visible at once: 2 (open spread) or 1 (phones)
  let swiped = false;
  let tightNow = false;

  const EASE = 'cubic-bezier(.45,.05,.35,1)';
  const SKIM = '<div class="page-inner skim"></div>';

  // ---------- helpers ----------
  function fmtSize(b) {
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (i ? b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i];
  }
  const fmtDate = t => new Date(t).toLocaleDateString();

  function setMetrics(m) {
    const padT = Math.round(m.spreadH * 0.07), padB = Math.round(m.spreadH * 0.085);
    const head = Math.round(m.entryH * 2.6);
    const inner = m.spreadH - padT - padB;
    fit = {
      per: Math.max(3, Math.floor(inner / m.entryH)),
      first: Math.max(1, Math.floor((inner - head) / m.entryH)),
    };
    const s = document.documentElement.style;
    s.setProperty('--page-pad-t', padT + 'px');
    s.setProperty('--page-pad-b', padB + 'px');
    s.setProperty('--chap-head-h', head + 'px');
    per = m.single ? 1 : 2;
    tightNow = m.tight;
    if (tome) {
      tome.classList.toggle('single', m.single);
      tome.classList.toggle('tight', m.tight);
    }
    if (st) { // re-paginate, keep the same first visible entry
      const firstEntry = (st.chapter.pages[st.spread * per] || { s: 0 }).s;
      per = m.single ? 1 : 2;
      paginate(st.chapter);
      st.spread = Math.floor(pageOf(firstEntry) / per);
      renderSpread();
    }
  }

  function paginate(ch) {
    const n = ch.entries.length;
    const pages = [{ s: 0, e: Math.min(n, fit.first) }];
    for (let s = pages[0].e; s < n; s += fit.per) pages.push({ s, e: Math.min(n, s + fit.per) });
    ch.pages = pages;
  }
  function pageOf(entryIndex) {
    const p = st.chapter.pages.findIndex(pg => entryIndex >= pg.s && entryIndex < pg.e);
    return p < 0 ? 0 : p;
  }
  const spreads = () => Math.ceil(st.chapter.pages.length / per);
  const L = s => per === 2 ? s * 2 : -1;         // left page index of spread s
  const R = s => per === 2 ? s * 2 + 1 : s;      // right (or only) page index

  function setChapter(item, listing, highlight) {
    const ch = {
      name: item.name, path: item.path,
      folders: listing.folders.length, files: listing.files.length,
      entries: listing.folders.concat(listing.files), pages: [], highlight: highlight || null,
    };
    paginate(ch);
    st.chapter = ch;
    st.spread = 0;
    if (highlight) {
      const i = ch.entries.findIndex(e => e.name === highlight);
      if (i >= 0) st.spread = Math.floor(pageOf(i) / per);
    }
  }

  // ---------- rendering ----------
  function entryHTML(e, i) {
    const f = e.type === 'folder';
    const hl = st.chapter.highlight === e.name ? ' glint' : '';
    const meta = f ? T.folderMeta : `${fmtSize(e.size)} · ${fmtDate(e.modified)}`;
    return `<button type="button" class="entry ${f ? 'is-folder' : 'is-file'}${hl}" data-i="${i}" title="${esc(e.name)}">`
      + icon(f ? folderIcon(e.name) : fileIcon(e.ext))
      + `<span class="en">${esc(e.name)}</span><span class="em">${esc(meta)}</span></button>`;
  }

  function pageHTML(p) {
    if (p < 0) return '';
    const ch = st.chapter, pg = ch.pages[p];
    if (!pg) {
      const fin = p === ch.pages.length ? `<div class="fin">❦ ${esc(T.theEnd)} ❦</div>` : '';
      return `<div class="page-inner blank">${fin}</div>`;
    }
    let h = '<div class="page-inner">';
    if (p === 0) {
      h += `<header class="chap-head"><div class="chap-kicker">${esc(T.chapter(st.stack.length))}</div>`
        + `<h2>${esc(ch.name)}</h2><div class="chap-sub">${esc(T.counts(ch.folders, ch.files))}</div></header>`;
    }
    if (!ch.entries.length) h += `<p class="empty-note">${esc(T.emptyChapter)}</p>`;
    let list = '';
    for (let i = pg.s; i < pg.e; i++) list += entryHTML(ch.entries[i], i);
    h += `<div class="entries">${list}</div><div class="folio">${p + 1}</div></div>`;
    return h;
  }

  function renderSpread() {
    leftEl.innerHTML = pageHTML(L(st.spread));
    rightEl.innerHTML = pageHTML(R(st.spread));
    updateControls();
  }
  function updateControls() {
    prevBtn.disabled = busy || st.spread <= 0;
    nextBtn.disabled = busy || st.spread >= spreads() - 1;
  }

  function renderRibbons(animateLast) {
    const s = st.stack;
    let list = s.map((x, i) => ({ x, i }));
    if (list.length > 6) list = [list[0], { gap: true }].concat(list.slice(-4));
    ribbonsEl.innerHTML = list.map(o => o.gap ? '<span class="ribbon gap">…</span>'
      : `<button type="button" class="ribbon r${o.i % 4}${o.i === s.length - 1 ? ' current' : ''}" data-i="${o.i}" title="${esc(o.x.name)}"><span>${esc(o.x.name)}</span></button>`).join('');
    if (animateLast) {
      const last = ribbonsEl.lastElementChild;
      if (last) last.animate([{ transform: 'translateY(-70%)' }, { transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    }
  }

  function coverHTML(item, colorCls) {
    return `<div class="face front ${colorCls}"><div class="cover-frame">`
      + icon(folderIcon(item.name), 'cover-ico') + `<div class="cover-title">${esc(item.name)}</div>`
      + icon('tree', 'cover-emblem') + `</div></div><div class="face back paper-left"></div>`;
  }

  // ---------- page turning ----------
  function makeLeaf(dir, frontHTML, backHTML, z0, z1) {
    const leaf = document.createElement('div');
    leaf.className = 'leaf ' + (dir > 0 ? 'fwd' : 'bwd');
    leaf.innerHTML = `<div class="face front ${dir > 0 ? 'paper-right' : 'paper-left'}">${frontHTML}</div>`
      + `<div class="face back ${dir > 0 ? 'paper-left' : 'paper-right'}">${backHTML}</div>`;
    if (per === 1) {
      // One page at a time: the old page swings away to the left (forward),
      // or the new page swings in from the left (back).
      leaf.className = 'leaf solo';
      leaf.innerHTML = `<div class="face front paper-right">${frontHTML}</div><div class="face back paper-left">${backHTML}</div>`;
      leaf._kf = dir > 0
        ? [{ transform: `translateZ(${z0}px) rotateY(0deg)`, opacity: 1 }, { opacity: 1, offset: 0.6 }, { transform: `translateZ(${z1}px) rotateY(-180deg)`, opacity: 0 }]
        : [{ transform: `translateZ(${z0}px) rotateY(-180deg)`, opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: `translateZ(${z1}px) rotateY(0deg)`, opacity: 1 }];
      return leaf;
    }
    leaf._kf = [
      { transform: `translateZ(${z0}px) rotateY(0deg)` },
      { transform: `translateZ(${z1}px) rotateY(${dir > 0 ? -180 : 180}deg)` },
    ];
    return leaf;
  }

  // Turn one page (dir = +1 forward, -1 back).
  async function flip(dir) {
    if (busy || !st) return;
    const ns = st.spread + dir;
    if (ns < 0 || ns >= spreads()) return;
    busy = true;
    let leaf;
    if (per === 1) {
      const oldHTML = rightEl.innerHTML;
      st.spread = ns;
      const nu = pageHTML(R(ns));
      if (dir > 0) { rightEl.innerHTML = nu; leaf = makeLeaf(1, oldHTML, '', 1, 1); }
      else leaf = makeLeaf(-1, nu, '', 1, 1);
      pagesEl.appendChild(leaf);
      updateControls();
      try { await leaf.animate(leaf._kf, { duration: 420, easing: EASE }).finished; } catch (e) { /* cancelled */ }
      rightEl.innerHTML = nu;
    } else {
      const oldFront = dir > 0 ? rightEl.innerHTML : leftEl.innerHTML;
      st.spread = ns;
      const back = dir > 0 ? pageHTML(L(ns)) : pageHTML(R(ns));
      if (dir > 0) rightEl.innerHTML = pageHTML(R(ns)); else leftEl.innerHTML = pageHTML(L(ns));
      leaf = makeLeaf(dir, oldFront, back, 1, 1);
      pagesEl.appendChild(leaf);
      updateControls();
      try { await leaf.animate(leaf._kf, { duration: 460, easing: EASE }).finished; } catch (e) { /* cancelled */ }
      if (dir > 0) leftEl.innerHTML = back; else rightEl.innerHTML = back;
    }
    leaf.remove();
    busy = false;
    updateControls();
  }

  // Quickly riffle several pages, then show a new chapter (or go back to an older one).
  async function riffle(dir, apply) {
    const n = 3;
    const leaves = [];
    let finalBack, solo = null;
    if (per === 1) {
      const oldHTML = rightEl.innerHTML;
      apply();
      solo = pageHTML(R(st.spread));
      for (let k = 0; k < n; k++) {
        const front = dir > 0 ? (k === 0 ? oldHTML : SKIM) : (k === n - 1 ? solo : SKIM);
        leaves.push(makeLeaf(dir, front, '', n - k, k + 1));
      }
      if (dir > 0) rightEl.innerHTML = solo;
    } else {
      const oldFront = dir > 0 ? rightEl.innerHTML : leftEl.innerHTML;
      apply();
      finalBack = dir > 0 ? pageHTML(L(st.spread)) : pageHTML(R(st.spread));
      if (dir > 0) rightEl.innerHTML = pageHTML(R(st.spread)); else leftEl.innerHTML = pageHTML(L(st.spread));
      for (let k = 0; k < n; k++) {
        leaves.push(makeLeaf(dir, k === 0 ? oldFront : SKIM, k === n - 1 ? finalBack : SKIM, n - k, k + 1));
      }
    }
    for (const l of leaves) pagesEl.appendChild(l);
    const anims = leaves.map((l, k) => l.animate(l._kf, { duration: 280, delay: k * 75, easing: EASE, fill: 'both' }));
    try { await Promise.all(anims.map(a => a.finished)); } catch (e) { /* cancelled */ }
    if (solo != null) rightEl.innerHTML = solo;
    else if (dir > 0) leftEl.innerHTML = finalBack; else rightEl.innerHTML = finalBack;
    leaves.forEach(l => l.remove());
  }

  async function openChild(entry) {
    if (busy) return;
    busy = true; updateControls();
    const listing = await ML.data.listFolder(entry.path);
    await riffle(1, () => {
      st.stack.push({ name: entry.name, path: entry.path });
      setChapter(entry, listing);
    });
    renderRibbons(true);
    busy = false; updateControls();
  }

  async function backTo(i) {
    if (busy || !st || i < 0 || i >= st.stack.length - 1) return;
    busy = true; updateControls();
    const target = st.stack[i];
    const listing = await ML.data.listFolder(target.path);
    await riffle(-1, () => {
      st.stack = st.stack.slice(0, i + 1);
      setChapter(target, listing);
    });
    renderRibbons(false);
    busy = false; updateControls();
  }

  async function goChain(chain, highlight) {
    busy = true; updateControls();
    const last = chain[chain.length - 1];
    const listing = await ML.data.listFolder(last.path);
    await riffle(1, () => {
      st.stack = chain.map(c => ({ name: c.name, path: c.path }));
      setChapter(last, listing, highlight);
    });
    renderRibbons(true);
    busy = false; updateControls();
  }

  // ---------- open / close ----------
  // Transform that squeezes the cover onto the book spine on the shelf.
  function spineTransform(r, c, pull) {
    const k = pull ? 1.12 : 1;
    const sx = (r.width / c.width) * k, sy = (r.height / c.height) * k;
    const dx = r.left - c.left - (pull ? r.width * 0.06 : 0);
    const dy = (r.top + r.height / 2) - (c.top + c.height / 2) - (pull ? r.height * 0.05 : 0);
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  }

  async function open(item, sourceEl, opts = {}) {
    if (busy || st) return;
    busy = true;
    const chain = opts.chain && opts.chain.length ? opts.chain : [item];
    const listing = await ML.data.listFolder(item.path);
    st = { top: item, source: sourceEl, stack: [{ name: item.name, path: item.path }], spread: 0 };
    setChapter(item, listing, chain.length === 1 ? opts.highlight : null);

    const colorCls = 'c' + (hash(item.name) % ML.art.BOOK_COLORS);
    tome.className = 'tome closed ' + colorCls + (per === 1 ? ' single' : '') + (tightNow ? ' tight' : '');
    layer.hidden = false;
    renderSpread();
    renderRibbons(false);
    updateControls();

    cover = document.createElement('div');
    cover.className = 'cover';
    cover.innerHTML = coverHTML(item, colorCls);
    tome.appendChild(cover);

    backdrop.getAnimations().forEach(a => a.cancel());
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });

    const c = cover.getBoundingClientRect();
    if (sourceEl) {
      const r = sourceEl.getBoundingClientRect();
      sourceEl.classList.add('taken');
      sourceEl.classList.remove('summon');
      try {
        await cover.animate([
          { transform: spineTransform(r, c, false) },
          { transform: spineTransform(r, c, true), offset: 0.28 },
          { transform: 'none' },
        ], { duration: 480, easing: 'cubic-bezier(.3,.6,.2,1)' }).finished;
      } catch (e) { /* cancelled */ }
    }
    if (!st) return; // closed meanwhile
    tome.classList.replace('closed', 'opening');
    board.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360 });
    try {
      await cover.animate(per === 1
        ? [{ transform: 'rotateY(0deg)', opacity: 1 }, { opacity: 1, offset: 0.55 }, { transform: 'rotateY(-180deg)', opacity: 0 }]
        : [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }],
        { duration: 380, easing: 'cubic-bezier(.5,.1,.4,1)' }).finished;
    } catch (e) { /* cancelled */ }
    if (!st) return;
    cover.style.transform = 'rotateY(-180deg)';
    cover.hidden = true;
    tome.classList.remove('opening');
    busy = false;
    updateControls();
    if (chain.length > 1) await goChain(chain, opts.highlight);
  }

  async function close(instant) {
    if (!st || (busy && !instant)) return;
    busy = true;
    const src = st.source && document.body.contains(st.source) ? st.source : null;
    if (!instant && cover) {
      cover.hidden = false;
      tome.classList.add('opening');
      try {
        await cover.animate(per === 1
          ? [{ transform: 'rotateY(-180deg)', opacity: 0 }, { opacity: 1, offset: 0.45 }, { transform: 'rotateY(0deg)', opacity: 1 }]
          : [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }],
          { duration: 300, easing: 'cubic-bezier(.5,.1,.4,1)' }).finished;
      } catch (e) { /* cancelled */ }
      cover.style.transform = 'none';
      tome.classList.replace('opening', 'closed');
      backdrop.getAnimations().forEach(a => a.cancel());
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
      const c = cover.getBoundingClientRect();
      try {
        if (src) {
          const r = src.getBoundingClientRect();
          await cover.animate([{ transform: 'none' }, { transform: spineTransform(r, c, false) }],
            { duration: 330, easing: 'cubic-bezier(.5,0,.7,.5)', fill: 'forwards' }).finished;
        } else {
          await cover.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(60px) scale(.5)', opacity: 0 }],
            { duration: 300, fill: 'forwards' }).finished;
        }
      } catch (e) { /* cancelled */ }
    }
    if (st.source) st.source.classList.remove('taken');
    if (cover) cover.remove();
    cover = null;
    backdrop.getAnimations().forEach(a => a.cancel());
    pagesEl.querySelectorAll('.leaf').forEach(l => l.remove());
    layer.hidden = true;
    leftEl.innerHTML = rightEl.innerHTML = ribbonsEl.innerHTML = '';
    tome.className = 'tome' + (per === 1 ? ' single' : '') + (tightNow ? ' tight' : '');
    st = null;
    busy = false;
  }

  // ---------- input ----------
  function swipeEaten() { const s = swiped; swiped = false; return s; }

  function onEntryClick(e) {
    const btn = e.target.closest('.entry');
    if (!btn) return false;
    const entry = st.chapter.entries[+btn.dataset.i];
    if (!entry) return true;
    if (entry.type === 'folder') openChild(entry);
    else ML.platform.openFile(entry).then(ok => { if (!ok) ML.ui.toast(T.openFile(entry.name)); });
    return true;
  }

  function init() {
    layer = document.getElementById('book-layer');
    layer.innerHTML = `<div class="backdrop"></div>
      <div class="tome">
        <div class="tome-board"></div>
        <div class="pages">
          <div class="page left paper-left"></div>
          <div class="page right paper-right"></div>
        </div>
        <div class="ribbons"></div>
        <button type="button" class="corner prev" aria-label="Previous page">${icon('arrowL')}</button>
        <button type="button" class="corner next" aria-label="Next page">${icon('arrowR')}</button>
        <button type="button" class="tome-close">${icon('close')}<span>${esc(T.close)}</span></button>
        <div class="tome-hint">${esc(T.hintBook)}</div>
      </div>`;
    backdrop = layer.querySelector('.backdrop');
    tome = layer.querySelector('.tome');
    board = layer.querySelector('.tome-board');
    pagesEl = layer.querySelector('.pages');
    leftEl = layer.querySelector('.page.left');
    rightEl = layer.querySelector('.page.right');
    ribbonsEl = layer.querySelector('.ribbons');
    prevBtn = layer.querySelector('.corner.prev');
    nextBtn = layer.querySelector('.corner.next');
    closeBtn = layer.querySelector('.tome-close');

    backdrop.addEventListener('click', () => close());
    closeBtn.addEventListener('click', () => close());
    prevBtn.addEventListener('click', () => flip(-1));
    nextBtn.addEventListener('click', () => flip(1));
    leftEl.addEventListener('click', e => { if (!swipeEaten() && !busy && !onEntryClick(e)) flip(-1); });
    rightEl.addEventListener('click', e => {
      if (swipeEaten() || busy || onEntryClick(e)) return;
      if (per === 1) {
        const r = rightEl.getBoundingClientRect();
        flip(e.clientX < r.left + r.width / 3 ? -1 : 1);
      } else flip(1);
    });
    // Swipe to turn pages on touch screens.
    let sx = 0, sy = 0;
    pagesEl.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; swiped = false; }, { passive: true });
    pagesEl.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (e.pointerType !== 'mouse' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped = true;
        flip(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    ribbonsEl.addEventListener('click', e => {
      const r = e.target.closest('.ribbon[data-i]');
      if (r) backTo(+r.dataset.i);
    });
    tome.addEventListener('wheel', e => {
      const now = performance.now();
      if (Math.abs(e.deltaY) < 8 || now - lastWheel < 380) return;
      lastWheel = now;
      flip(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
  }

  function onKey(e) {
    if (!st) return false;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') flip(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') flip(-1);
    else if (e.key === 'Backspace') backTo(st.stack.length - 2);
    else return false;
    return true;
  }

  ML.book = {
    init, open, close, setMetrics, onKey,
    isOpen: () => !!st,
    isBusy: () => busy,
  };
})();

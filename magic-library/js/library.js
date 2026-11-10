// The big carved bookcase: Favorites tier on top (with the search scroll beside it),
// then tiers of sections (Drive C, HDD 2TB…). Only the visible wall of tiers exists
// in the page; other walls are only data until you move there.
(function () {
  const ML = window.ML;
  const { icon, folderIcon, locationIcon, decor, esc, hash } = ML.art;
  const T = ML.T;

  let m = null, pl = null, built = null;
  let shelves = [];      // [{ loc, folders }]
  let favorites = [];
  let walls = [];
  let wallOf = new Map(); // top folder path → wall index
  let cur = 0;
  let wallEl = null;
  let moving = null;
  let summoned = null;
  let els = {};
  let swiped = false;

  // ---- Book names: measured, never split inside a word ----
  // Try the normal size, then slightly smaller sizes. If a word still doesn't
  // fit, cut it with "…" (the full name then shows on a name plate on hover).
  let ctx = null, family = '';
  const widths = new Map();
  function textW(str, size) {
    const k = size + '|' + str;
    let w = widths.get(k);
    if (w == null) {
      if (!ctx) { ctx = document.createElement('canvas').getContext('2d'); family = getComputedStyle(document.body).fontFamily; }
      ctx.font = `700 ${size}px ${family}`;
      w = ctx.measureText(str).width;
      widths.set(k, w);
    }
    return w;
  }
  // tokens: [{ t: text, sp: true if a space goes before it }]
  function wrap(tokens, size, avail) {
    const lines = [];
    let line = '';
    for (const { t, sp } of tokens) {
      const cand = line ? line + (sp ? ' ' : '') + t : t;
      if (!line || textW(cand, size) <= avail) line = cand;
      else { lines.push(line); line = t; }
    }
    if (line) lines.push(line);
    return lines;
  }
  function ellipsize(str, size, avail) {
    while (str.length > 1 && textW(str + '…', size) > avail) str = str.slice(0, -1);
    return str.trimEnd() + '…';
  }
  const MAX_LINES = 3;
  function fitName(name) {
    const avail = m.bookW * 0.86 - 2;
    const base = ML.layout.clamp(m.bookW * 0.185, 11, 17);
    const sizes = [1, 0.9, 0.8, 0.72].map(k => Math.max(9, Math.round(base * k * 2) / 2));
    const words = name.split(/\s+/).filter(Boolean);
    const byWord = words.map((t, i) => ({ t, sp: i > 0 }));
    // Second choice: also allow a break between joined words, e.g. "Program|Data", "my-|notes".
    const byPart = words.flatMap((w, i) => w.split(/(?<=[a-z])(?=[A-Z])|(?<=[-_.])/).map((t, j) => ({ t, sp: i > 0 && j === 0 })));
    for (const tokens of [byWord, byPart]) {
      for (const size of sizes) {
        if (tokens.every(k => textW(k.t, size) <= avail)) {
          const lines = wrap(tokens, size, avail);
          if (lines.length <= MAX_LINES) return { size, lines, cut: false };
        }
      }
    }
    const size = sizes[sizes.length - 1];
    let lines = wrap(byPart.map(k => textW(k.t, size) <= avail ? k : { t: ellipsize(k.t, size, avail), sp: k.sp }), size, avail);
    if (lines.length > MAX_LINES) {
      lines = lines.slice(0, MAX_LINES);
      lines[MAX_LINES - 1] = ellipsize(lines[MAX_LINES - 1], size, avail);
    }
    return { size, lines, cut: true };
  }

  // A book spine. side "sl" = left of the bookcase centre (its right side face shows), "sr" = right.
  function bookHTML(item, side, tilt) {
    const h = hash(item.name);
    const f = fitName(item.name);
    return `<button class="book c${h % ML.art.BOOK_COLORS} v${(h >> 4) % 3} ${side}" style="--tilt:${tilt.toFixed(2)}" type="button"`
      + ` data-slot="spine-${1 + (h >> 7) % 3}" data-path="${esc(item.path)}" data-name="${esc(item.name)}"${f.cut ? ' data-cut="1"' : ''} aria-label="${esc(item.name)}">`
      + `<span class="spine-shade"></span><span class="band"></span>${icon(folderIcon(item.name), 'book-ico')}`
      + `<span class="book-name" style="font-size:${f.size}px">${f.lines.map(l => `<span>${esc(l)}</span>`).join('')}</span>`
      + `${icon('tree', 'book-emblem')}<span class="band b"></span></button>`;
  }

  function plaqueHTML(loc, part, parts) {
    const sub = parts > 1 ? `<small>${T.part(part + 1, parts)}</small>` : '';
    return `<div class="plaque">${icon(locationIcon(loc.kind))}<span>${esc(loc.name)}</span>${sub}</div>`;
  }

  // One section = brass plate + a row of books/decor, placed at x inside the tier.
  function sectionHTML(sec) {
    let h = '';
    sec.slots.forEach((s, i) => {
      const x = sec.x + m.secPad + i * m.slot + m.bookW / 2;
      const dx = (x - built.innerW / 2) / (built.innerW / 2);
      if (s.book) h += bookHTML(s.book, dx < 0 ? 'sl' : 'sr', Math.min(1, Math.abs(dx)));
      else if (s.more) h += `<span class="decor more">${T.more(s.more)}</span>`;
      else h += `<span class="decor d-${s.decor}">${decor(s.decor)}</span>`;
    });
    return `<section class="sec${sec.loc.fav ? ' fav-sec' : ''}" style="left:${Math.round(sec.x)}px;width:${m.secW(sec.slots.length)}px">`
      + plaqueHTML(sec.loc, sec.part, sec.parts) + `<div class="books">${h}</div></section>`;
  }

  function pillarsHTML(secs) {
    let h = '';
    for (let i = 0; i < secs.length - 1; i++) {
      const end = secs[i].x + m.secW(secs[i].slots.length);
      const mid = (end + secs[i + 1].x) / 2;
      h += `<div class="pillar" data-slot="pillar" style="left:${Math.round(mid - m.pillarW / 2)}px"></div>`;
    }
    return h;
  }

  function tierHTML(t, cls, extra) {
    return `<div class="tier ${cls}"><div class="tier-shade"></div>${t.secs.map(sectionHTML).join('')}${pillarsHTML(t.secs)}${extra || ''}<div class="shelf" data-slot="shelf"></div></div>`;
  }

  // Eye level is the middle of the bookcase: tiers above show the shelf's underside, below show its top.
  function eyeClass(index, total) { return index < (total - 1) / 2 ? 'above' : 'below'; }

  function renderWall(i) {
    const el = document.createElement('div');
    el.className = 'wall';
    const w = walls[i];
    const total = built.tiersShown + (m.compact ? 0 : 1);
    el.innerHTML = w ? w.tiers.map((t, k) => tierHTML(t, eyeClass(k + (m.compact ? 0 : 1), total))).join('') : '';
    return el;
  }

  function favTierHTML() {
    const favSlots = Math.max(1, m.slotsFit(built.innerW - m.searchW - m.pillarW));
    const n = favorites.length;
    const cols = Math.max(1, Math.min(Math.max(n, 3), favSlots));
    const shown = n > cols ? favorites.slice(0, cols - 1) : favorites;
    const slots = shown.map(b => ({ book: b }));
    if (n > cols) slots.push({ more: n - shown.length });
    while (slots.length < cols) slots.push({ decor: ML.layout.pickDecor('fav', slots.length) });
    const sec = { loc: { id: 'fav', name: T.favorites, kind: 'fav', fav: true }, part: 0, parts: 1, slots, x: 0 };
    const alcoveX = m.secW(cols) + m.pillarW;
    const t = { secs: [sec] };
    const pillar = `<div class="pillar" data-slot="pillar" style="left:${m.secW(cols)}px"></div>`;
    // Decor on both ends of the alcove when there is room beside the search scroll.
    const alcoveW = built.innerW - alcoveX;
    const room = Math.floor((alcoveW - Math.min(m.searchW, alcoveW - 16)) / 2 / m.slot);
    const ends = room >= 1 ? `<div class="alcove-decor l">${decorRow(['candle', 'potion', 'stack'], room)}</div>`
      + `<div class="alcove-decor r">${decorRow(['hourglass', 'candle', 'plant'], room)}</div>` : '';
    return tierHTML(t, 'fav-tier above', pillar + `<div class="alcove" style="left:${alcoveX}px">${ends}</div>`);
  }

  function decorRow(names, n) {
    return names.slice(0, Math.min(n, names.length)).map(d => `<span class="decor d-${d}">${decor(d)}</span>`).join('');
  }

  function updateNav() {
    const many = walls.length > 1;
    els.left.hidden = els.right.hidden = !many;
    els.left.disabled = cur <= 0;
    els.right.disabled = cur >= walls.length - 1;
    els.dots.innerHTML = many ? walls.map((w, i) =>
      `<button type="button" class="dot${i === cur ? ' on' : ''}" data-i="${i}" title="${esc(wallName(i))}"></button>`).join('') : '';
    els.label.textContent = wallName(cur);
  }
  function wallName(i) {
    const w = walls[i];
    if (!w) return '';
    return [...new Set(w.tiers.flatMap(t => t.secs.map(s => s.loc.name)))].join(' · ');
  }

  async function goTo(i, opts = {}) {
    i = ML.layout.clamp(i, 0, walls.length - 1);
    if (moving) await moving;
    if (i === cur && wallEl && !opts.force) return;
    hidePlate();
    const dir = i > cur ? 1 : -1;
    const next = renderWall(i);
    const old = wallEl;
    els.view.appendChild(next);
    wallEl = next;
    cur = i;
    updateNav();
    if (old && !opts.instant) {
      const d = 380, easing = 'cubic-bezier(.4,0,.2,1)';
      const a = old.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * 30}%)`, opacity: 0 }], { duration: d, easing });
      const b = next.animate([{ transform: `translateX(${dir * 30}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: d, easing });
      moving = Promise.all([a.finished, b.finished]).catch(() => {});
      await moving;
      moving = null;
    }
    if (old) old.remove();
  }

  function findBook(path) {
    const p = CSS.escape(path);
    return (wallEl && wallEl.querySelector(`.sec:not(.fav-sec) .book[data-path="${p}"]`))
      || els.hall.querySelector(`.book[data-path="${p}"]`);
  }

  // Make sure the book for a top-level folder is on screen; returns its element.
  async function reveal(path) {
    const w = wallOf.get(path);
    if (w != null && w !== cur) await goTo(w);
    return findBook(path);
  }

  async function summon(path) {
    if (summoned) summoned.classList.remove('summon');
    summoned = null;
    if (!path) return null;
    const el = await reveal(path);
    if (el) { el.classList.add('summon'); summoned = el; }
    return el;
  }

  function relayout(metrics) {
    m = metrics;
    const keep = walls[cur] && walls[cur].tiers[0] && walls[cur].tiers[0].secs.flatMap(s => s.slots).find(s => s.book);
    const favShelf = { loc: { id: 'fav', name: T.favorites, kind: 'fav', fav: true }, folders: favorites };
    built = ML.layout.build(m.compact && favorites.length ? [favShelf].concat(shelves) : shelves, m, favorites.length);
    walls = built.walls;
    pl = ML.layout.place(m, built.innerW, built.tiersShown);
    wallOf = new Map();
    walls.forEach((w, i) => w.tiers.forEach(t => t.secs.forEach(s => {
      if (!s.loc.fav) s.slots.forEach(x => { if (x.book) wallOf.set(x.book.path, i); });
    })));
    let target = keep ? (wallOf.get(keep.book.path) || 0) : 0;
    if (target >= walls.length) target = 0;

    // Bookcase skeleton: back, sides, crown, base, then the Favorites tier and the tier viewport.
    const bc = els.bookcase;
    Object.assign(bc.style, { left: pl.left + 'px', top: pl.top + 'px', width: pl.width + 'px', height: pl.height + 'px' });
    bc.style.setProperty('--crown-h', m.crownH + 'px');
    bc.style.setProperty('--base-h', pl.baseH + 'px');
    bc.innerHTML = '<div class="bc-back" data-slot="bookcase-back"></div>'
      + '<div class="bc-side l" data-slot="bookcase-side"></div><div class="bc-side r" data-slot="bookcase-side"></div>'
      + `<div class="bc-crown" data-slot="bookcase-crown"><svg class="ph" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">${CROWN}</svg></div>`
      + '<div class="bc-base" data-slot="bookcase-base"></div>'
      + `<div class="bc-inner" style="width:${built.innerW}px">${m.compact ? '' : favTierHTML()}`
      + `<div class="tiers-view" style="height:${built.tiersShown * m.tierH}px"></div></div>`
      + '<div class="bc-light"></div>';
    els.view = bc.querySelector('.tiers-view');

    // Arrows beside the bookcase, centred on the tiers.
    const midY = pl.tiersTop + built.tiersShown * m.tierH / 2;
    Object.assign(els.left.style, { left: Math.max(2, pl.left - m.navM + 4) + 'px', top: midY + 'px' });
    Object.assign(els.right.style, { left: Math.min(m.W - m.navM + 2, pl.left + pl.width + 4) + 'px', top: midY + 'px' });

    // The search scroll: in the alcove next to Favorites (wide) or the top bar (compact).
    const alcove = bc.querySelector('.alcove');
    if (alcove) {
      alcove.appendChild(els.search);
      els.search.style.width = Math.min(m.searchW, built.innerW - parseFloat(alcove.style.left) - 16) + 'px';
    } else {
      els.top.appendChild(els.search);
      els.search.style.width = '';
    }

    wallEl = null;
    cur = target;
    ML.scene.layout(m, pl, els.hall);
    goTo(target, { instant: true, force: true });
  }

  // Carved crown placeholder (stretches with the bookcase width).
  const CROWN = `<defs>
      <linearGradient id="cr-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a0602e"/><stop offset=".3" stop-color="#6a3a1a"/><stop offset=".7" stop-color="#3e1f0c"/><stop offset="1" stop-color="#1e0e05"/></linearGradient>
      <linearGradient id="cr-b" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c88a4a"/><stop offset="1" stop-color="#5a2e12"/></linearGradient></defs>
    <path d="M0 60V30Q0 22 6 22H150Q170 4 200 2Q230 4 250 22H394Q400 22 400 30V60Z" fill="url(#cr-g)"/>
    <path d="M0 38H400" stroke="#1a0c05" stroke-width="3" opacity=".7"/><path d="M0 41H400" stroke="#c88a4a" stroke-width="1" opacity=".55"/>
    <path d="M0 52H400" stroke="#1a0c05" stroke-width="2" opacity=".6"/>
    <path d="M160 24Q200 -2 240 24" fill="none" stroke="url(#cr-b)" stroke-width="2"/>
    <path d="M182 22c6-10 30-10 36 0-10 4-26 4-36 0z" fill="#c88a4a" opacity=".7"/><circle cx="200" cy="14" r="3" fill="#e0a860" opacity=".8"/>
    <g fill="none" stroke="#c88a4a" stroke-width="1.4" opacity=".55"><path d="M150 30c-10 0-14 8-8 12s12-2 6-6M250 30c10 0 14 8 8 12s-12-2-6-6"/><path d="M20 30c-6 0-8 6-4 8M380 30c6 0 8 6 4 8"/></g>
    <g fill="#c88a4a" opacity=".45"><circle cx="60" cy="46" r="2.4"/><circle cx="100" cy="46" r="2.4"/><circle cx="300" cy="46" r="2.4"/><circle cx="340" cy="46" r="2.4"/></g>`;

  async function load(metrics) {
    const locs = await ML.data.getLocations();
    shelves = [];
    for (const loc of locs) {
      const l = await ML.data.listFolder(loc.path);
      shelves.push({ loc, folders: l.folders });
    }
    favorites = await ML.data.getFavorites();
    walls = [];
    cur = 0;
    relayout(metrics);
  }

  function init(onBookClick) {
    els = {
      hall: document.getElementById('hall'),
      bookcase: document.getElementById('bookcase'),
      top: document.getElementById('top'),
      search: document.getElementById('search'),
      left: document.querySelector('.nav-arrow.left'),
      right: document.querySelector('.nav-arrow.right'),
      dots: document.getElementById('wall-dots'),
      label: document.getElementById('wall-label'),
    };
    els.left.innerHTML = icon('arrowL');
    els.right.innerHTML = icon('arrowR');
    els.left.title = T.prevBookcase;
    els.right.title = T.nextBookcase;
    els.left.addEventListener('click', () => goTo(cur - 1));
    els.right.addEventListener('click', () => goTo(cur + 1));
    els.dots.addEventListener('click', e => { const d = e.target.closest('.dot'); if (d) goTo(+d.dataset.i); });
    // One click listener for all books (cheaper than one per book).
    els.bookcase.addEventListener('click', e => {
      if (swiped) { swiped = false; return; }
      const b = e.target.closest('.book');
      if (b) { hidePlate(); onBookClick({ type: 'folder', name: b.dataset.name, path: b.dataset.path }, b); }
    });

    // Name plate with the full name, for books whose name had to be cut with "…".
    els.plate = document.createElement('div');
    els.plate.className = 'nameplate';
    els.plate.hidden = true;
    document.body.appendChild(els.plate);
    els.bookcase.addEventListener('pointerover', e => {
      const b = e.target.closest('.book[data-cut]');
      if (!b) return;
      const r = b.getBoundingClientRect();
      els.plate.textContent = b.dataset.name;
      els.plate.hidden = false;
      const w = els.plate.offsetWidth;
      els.plate.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      els.plate.style.top = Math.max(8, r.top - els.plate.offsetHeight - 10) + 'px';
    });
    els.bookcase.addEventListener('pointerout', e => { if (e.target.closest('.book[data-cut]')) hidePlate(); });

    // Swipe left/right on touch screens to move between walls of tiers.
    let sx = 0, sy = 0;
    els.bookcase.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; swiped = false; }, { passive: true });
    els.bookcase.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (e.pointerType !== 'mouse' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped = true;
        goTo(cur + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
  }

  function hidePlate() { if (els.plate) els.plate.hidden = true; }

  ML.library = {
    init, load, relayout, goTo, reveal, summon, findBook,
    next: () => goTo(cur + 1),
    prev: () => goTo(cur - 1),
    rect: () => pl,
  };
})();

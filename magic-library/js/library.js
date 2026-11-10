// The library: favorites shelf + bookcase walls. Only the visible wall exists
// in the page at any time (the others are just data until you move there).
(function () {
  const ML = window.ML;
  const { icon, folderIcon, locationIcon, decor, esc, hash } = ML.art;
  const T = ML.T;

  let m = null;
  let shelves = [];      // [{ loc, folders }]
  let favorites = [];
  let walls = [];
  let wallOf = new Map(); // top folder path → wall index
  let cur = 0;
  let wallEl = null;
  let moving = null;
  let summoned = null;
  let els = {};

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

  function bookHTML(item) {
    const h = hash(item.name);
    const f = fitName(item.name);
    return `<button class="book c${h % ML.art.BOOK_COLORS} v${(h >> 4) % 3}" type="button" data-path="${esc(item.path)}" data-name="${esc(item.name)}"${f.cut ? ' data-cut="1"' : ''} aria-label="${esc(item.name)}">`
      + `<span class="band"></span>${icon(folderIcon(item.name), 'book-ico')}`
      + `<span class="book-name" style="font-size:${f.size}px">${f.lines.map(l => `<span>${esc(l)}</span>`).join('')}</span>`
      + `${icon('tree', 'book-emblem')}<span class="band b"></span></button>`;
  }
  function slotHTML(s) {
    return s.book ? bookHTML(s.book) : `<span class="decor d-${s.decor}">${decor(s.decor)}</span>`;
  }
  function rowsHTML(slots, cols, rows) {
    let h = '';
    for (let r = 0; r < rows; r++) h += `<div class="row">${slots.slice(r * cols, (r + 1) * cols).map(slotHTML).join('')}</div>`;
    return h;
  }
  function unitHTML(u) {
    const part = u.parts > 1 ? `<small>${T.part(u.part + 1, u.parts)}</small>` : '';
    return `<section class="unit${u.loc.fav ? ' fav-unit' : ''}" style="width:${u.width}px">`
      + `<div class="plaque">${icon(locationIcon(u.loc.kind))}<span>${esc(u.loc.name)}</span>${part}</div>`
      + rowsHTML(u.slots, u.cols, u.rows) + '</section>';
  }

  function renderWall(i) {
    const el = document.createElement('div');
    el.className = 'wall';
    el.innerHTML = walls[i] ? walls[i].units.map(unitHTML).join('') : '';
    return el;
  }

  function renderFavorites() {
    els.fav.hidden = m.compact;
    if (m.compact) { els.fav.innerHTML = ''; return; } // shown as the first bookcase instead
    const n = favorites.length;
    const cols = Math.max(1, Math.min(Math.max(n, 3), m.favMaxCols));
    const shown = n > cols ? favorites.slice(0, cols - 1) : favorites;
    const slots = shown.map(b => ({ book: b }));
    if (n > cols) slots.push({ more: n - shown.length });
    while (slots.length < cols) slots.push({ decor: ML.layout.pickDecor('fav', slots.length) });
    els.fav.style.width = m.unitWidth(cols) + 'px';
    els.fav.innerHTML = `<div class="plaque">${icon('star')}<span>${esc(T.favorites)}</span></div>`
      + `<div class="row">${slots.map(s => s.more ? `<span class="decor more">${T.more(s.more)}</span>` : slotHTML(s)).join('')}</div>`;
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
    return [...new Set(w.units.map(u => u.loc.name))].join(' · ');
  }

  async function goTo(i, opts = {}) {
    i = ML.layout.clamp(i, 0, walls.length - 1);
    if (moving) await moving;
    if (i === cur && wallEl && !opts.force) return;
    const dir = i > cur ? 1 : -1;
    hidePlate();
    const next = renderWall(i);
    const old = wallEl;
    els.walls.appendChild(next);
    wallEl = next;
    cur = i;
    updateNav();
    if (old && !opts.instant) {
      const d = 360, easing = 'cubic-bezier(.4,0,.2,1)';
      const a = old.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * 35}%)`, opacity: 0 }], { duration: d, easing });
      const b = next.animate([{ transform: `translateX(${dir * 35}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: d, easing });
      moving = Promise.all([a.finished, b.finished]).catch(() => {});
      await moving;
      moving = null;
    }
    if (old) old.remove();
  }

  function findBook(path) {
    const sel = `.unit:not(.fav-unit) .book[data-path="${CSS.escape(path)}"]`;
    return (wallEl && wallEl.querySelector(sel)) || els.fav.querySelector(`.book[data-path="${CSS.escape(path)}"]`);
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
    const firstPath = walls[cur] && walls[cur].units[0].slots.find(s => s.book);
    const favShelf = { loc: { id: 'fav', name: T.favorites, kind: 'fav', fav: true }, folders: favorites };
    walls = ML.layout.build(m.compact && favorites.length ? [favShelf].concat(shelves) : shelves, m);
    wallOf = new Map();
    walls.forEach((w, i) => w.units.forEach(u => {
      if (!u.loc.fav) u.slots.forEach(s => { if (s.book) wallOf.set(s.book.path, i); });
    }));
    let target = firstPath ? (wallOf.get(firstPath.book.path) || 0) : 0;
    if (target >= walls.length) target = 0;
    if (wallEl) { wallEl.remove(); wallEl = null; }
    cur = target;
    renderFavorites();
    goTo(target, { instant: true, force: true });
  }

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
      fav: document.getElementById('favorites'),
      walls: document.getElementById('walls'),
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
    const onClick = e => {
      if (swiped) { swiped = false; return; }
      const b = e.target.closest('.book');
      if (b) { hidePlate(); onBookClick({ type: 'folder', name: b.dataset.name, path: b.dataset.path }, b); }
    };
    els.walls.addEventListener('click', onClick);
    els.fav.addEventListener('click', onClick);

    // Name plate with the full name, for books whose name had to be cut with "…".
    els.plate = document.createElement('div');
    els.plate.className = 'nameplate';
    els.plate.hidden = true;
    document.body.appendChild(els.plate);
    const over = e => {
      const b = e.target.closest('.book[data-cut]');
      if (!b) return;
      const r = b.getBoundingClientRect();
      els.plate.textContent = b.dataset.name;
      els.plate.hidden = false;
      const w = els.plate.offsetWidth;
      els.plate.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      els.plate.style.top = Math.max(8, r.top - els.plate.offsetHeight - 10) + 'px';
    };
    const out = e => { if (e.target.closest('.book[data-cut]')) hidePlate(); };
    for (const el of [els.walls, els.fav]) { el.addEventListener('pointerover', over); el.addEventListener('pointerout', out); }

    // Swipe left/right on touch screens to move between bookcases.
    let sx = 0, sy = 0, swiped = false;
    els.walls.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; swiped = false; }, { passive: true });
    els.walls.addEventListener('pointerup', e => {
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
  };
})();

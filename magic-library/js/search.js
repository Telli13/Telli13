// "Search spell": as you type, the best matching book glows on its shelf.
// Pause typing (or press Enter) and the book flies off the shelf to you.
(function () {
  const ML = window.ML;
  const { icon, folderIcon, fileIcon, esc } = ML.art;
  const T = ML.T;

  let input, list, box;
  let results = [];
  let sel = 0;
  let typeTimer = 0, castTimer = 0, seq = 0;
  const CAST_DELAY = 1100; // ms of no typing before the book flies to you

  function render() {
    if (!input.value.trim()) { list.hidden = true; return; }
    list.hidden = false;
    if (!results.length) { list.innerHTML = `<li class="none">${esc(T.searchNothing)}</li>`; return; }
    list.innerHTML = results.map((r, i) => {
      const where = [r.location].concat(r.chain.map(c => c.name)).filter((x, k, a) => k === 0 || x !== a[k - 1]);
      if (r.type === 'folder') where.pop();
      return `<li><button type="button" class="${i === sel ? 'on' : ''}" data-i="${i}">`
        + icon(r.type === 'folder' ? folderIcon(r.name) : fileIcon(r.name.split('.').pop()))
        + `<span class="sn">${esc(r.name)}</span><span class="sp">${esc(where.join(' › '))}</span></button></li>`;
    }).join('');
  }

  async function run() {
    const q = input.value.trim();
    const my = ++seq;
    clearTimeout(castTimer);
    if (!q) { results = []; render(); ML.library.summon(null); box.classList.remove('casting'); return; }
    const r = await ML.data.search(q, 7);
    if (my !== seq) return; // a newer search started meanwhile
    results = r; sel = 0;
    render();
    const best = results[0];
    box.classList.toggle('casting', !!best);
    if (ML.book.isOpen()) return;
    await ML.library.summon(best ? best.chain[0].path : null);
    if (best && q.length >= 3) castTimer = setTimeout(() => cast(best), CAST_DELAY);
  }

  async function cast(result) {
    clearTimeout(castTimer); clearTimeout(typeTimer);
    if (!result) return;
    list.hidden = true;
    box.classList.remove('casting');
    input.blur();
    await ML.app.summon(result);
  }

  function clear() {
    clearTimeout(castTimer); clearTimeout(typeTimer);
    input.value = '';
    results = [];
    render();
    box.classList.remove('casting');
    ML.library.summon(null);
  }

  function init() {
    box = document.getElementById('search');
    input = document.getElementById('search-input');
    list = document.getElementById('search-results');
    box.querySelector('.search-ico').innerHTML = icon('search');
    input.placeholder = T.searchPlaceholder;

    input.addEventListener('input', () => { clearTimeout(typeTimer); clearTimeout(castTimer); typeTimer = setTimeout(run, 110); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); cast(results[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); clear(); input.blur(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!results.length) return;
        clearTimeout(castTimer);
        sel = (sel + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length;
        render();
        ML.library.summon(results[sel].chain[0].path);
      }
      e.stopPropagation();
    });
    input.addEventListener('focus', () => { if (input.value.trim()) render(); });
    list.addEventListener('pointerdown', e => e.preventDefault()); // keep focus while clicking a result
    list.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (b) cast(results[+b.dataset.i]);
    });
    document.addEventListener('pointerdown', e => { if (!box.contains(e.target)) list.hidden = true; });
  }

  ML.search = { init, clear, focus: () => input.focus() };
})();

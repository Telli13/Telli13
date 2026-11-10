// Glue: starts everything, sizes the screen, keyboard, exit dialog, sample-data switch.
(function () {
  const ML = window.ML;
  const { icon, esc } = ML.art;
  const T = ML.T;

  // The data source. Later, in the Tauri app, this will be a real one.
  ML.data = ML.createFakeData();

  let m = null;

  function applyMetrics() {
    m = ML.layout.metrics(window.innerWidth, window.innerHeight);
    const s = document.documentElement.style;
    const px = {
      'book-w': m.bookW, 'book-h': m.bookH, gap: m.gap, 'board-h': m.boardH, 'plaque-h': m.plaqueH,
      'plaque-band': m.plaqueBand, 'tier-h': m.tierH, 'sec-pad': m.secPad, 'pillar-w': m.pillarW,
      'frame-side': m.frameSide, 'desk-h': m.deskH, 'controls-h': m.controlsH, 'top-pad': m.topPad, 'nav-m': m.navM,
      'spread-w': m.spreadW, 'spread-h': m.spreadH, 'entry-h': m.entryH,
    };
    for (const k in px) s.setProperty('--' + k, px[k] + 'px');
    document.body.classList.toggle('compact', m.compact);
    document.body.classList.toggle('single', m.single);
    ML.book.setMetrics(m);
    return m;
  }

  // ---------- calm mode (dims effects for daily work) ----------
  function initCalm() {
    const btn = document.getElementById('calm-btn');
    let on = false;
    try { on = localStorage.getItem('ml-calm') === '1'; } catch (e) { /* ignore */ }
    const set = v => {
      on = v;
      ML.fx.setCalm(on);
      btn.setAttribute('aria-pressed', String(on));
      btn.title = on ? T.calmOnTitle : T.calmOffTitle;
      btn.innerHTML = `${icon(on ? 'moon' : 'flame')}<span>${esc(T.calm)}</span>`;
      try { localStorage.setItem('ml-calm', on ? '1' : '0'); } catch (e) { /* ignore */ }
    };
    btn.addEventListener('click', () => { set(!on); btn.blur(); });
    set(on);
  }

  // ---------- small UI helpers ----------
  let toastTimer = 0;
  ML.ui = {
    toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    },
  };

  function dialog(html) {
    const d = document.getElementById('dialog-layer');
    d.innerHTML = `<div class="dialog-back"></div><div class="dialog">${html}</div>`;
    d.hidden = false;
    d.querySelector('.dialog').animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
    return d;
  }
  function closeDialog() {
    const d = document.getElementById('dialog-layer');
    d.hidden = true; d.innerHTML = '';
  }
  const dialogOpen = () => !document.getElementById('dialog-layer').hidden;

  function askExit() {
    const d = dialog(`<h3>${esc(T.exitTitle)}</h3><p>${esc(T.exitText)}</p>
      <div class="dialog-btns"><button type="button" class="btn ghost" data-a="stay">${esc(T.exitStay)}</button>
      <button type="button" class="btn" data-a="leave">${icon('exit')}${esc(T.exitLeave)}</button></div>`);
    d.querySelector('[data-a=stay]').onclick = closeDialog;
    d.querySelector('.dialog-back').onclick = closeDialog;
    d.querySelector('[data-a=leave]').onclick = async () => {
      if (await ML.platform.exit()) return;
      const f = dialog(`<h3>${esc(T.farewellTitle)}</h3><p>${esc(T.farewellText)}</p>
        <div class="dialog-btns"><button type="button" class="btn" data-a="back">${esc(T.farewellBack)}</button></div>`);
      f.classList.add('farewell');
      f.querySelector('[data-a=back]').onclick = () => { f.classList.remove('farewell'); closeDialog(); };
    };
    d.querySelector('[data-a=leave]').focus();
  }

  // ---------- opening books ----------
  async function openBook(item, el, opts) {
    if (ML.book.isOpen() || ML.book.isBusy()) return;
    ML.search.clear();
    ML.fx.sparkleAt(el, false);
    await ML.book.open(item, el, opts);
  }

  // Called by the search spell: bring the book to the reader and open the right chapter.
  async function summon(result) {
    if (ML.book.isOpen()) await ML.book.close(true);
    const top = result.chain[0];
    const el = await ML.library.reveal(top.path);
    if (el) ML.fx.sparkleAt(el, true);
    ML.library.summon(null);
    await ML.book.open({ type: 'folder', name: top.name, path: top.path }, el, {
      chain: result.chain,
      highlight: result.type === 'file' ? result.name : null,
    });
  }

  // ---------- sample data switch ----------
  function initDemo() {
    const sel = document.getElementById('demo-select');
    document.getElementById('demo-label').innerHTML =
      `<span class="long">${esc(T.demoLabel)}</span><span class="short">${esc(T.demoLabelShort)}</span>`;
    let saved = 'normal';
    try { saved = localStorage.getItem('ml-demo') || 'normal'; } catch (e) { /* ignore */ }
    ML.data.setScenario(saved);
    sel.innerHTML = ML.data.scenarios.map(s => `<option value="${s}"${s === ML.data.scenario ? ' selected' : ''}>${esc(T.demo[s] || s)}</option>`).join('');
    sel.addEventListener('change', async () => {
      try { localStorage.setItem('ml-demo', sel.value); } catch (e) { /* ignore */ }
      if (ML.book.isOpen()) await ML.book.close(true);
      ML.search.clear();
      ML.data.setScenario(sel.value);
      await ML.library.load(m);
      warmup();
      sel.blur();
    });
  }

  function warmup() {
    const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
    idle(() => ML.data.warmup && ML.data.warmup());
  }

  // ---------- keyboard ----------
  function onKey(e) {
    if (dialogOpen()) { if (e.key === 'Escape') closeDialog(); return; }
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (ML.book.onKey(e)) { e.preventDefault(); return; }
    if (ML.book.isOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { ML.library.next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { ML.library.prev(); e.preventDefault(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      ML.search.focus(); // start typing anywhere = cast a search spell
    }
  }

  // ---------- start ----------
  async function start() {
    ML.fx.init();
    ML.scene.init();
    ML.slots.init();
    ML.book.init();
    ML.search.init();
    ML.library.init(openBook);

    const exitBtn = document.getElementById('exit-btn');
    exitBtn.innerHTML = `${icon('exit')}<span>${esc(T.exit)}</span>`;
    exitBtn.addEventListener('click', askExit);
    document.getElementById('hint').textContent = T.hint;
    initDemo();
    initCalm();

    applyMetrics();
    await ML.library.load(m);
    ML.fx.resetDust();
    warmup();

    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { applyMetrics(); ML.library.relayout(m); ML.fx.resetDust(); }, 150);
    });
    document.addEventListener('keydown', onKey);
    document.body.classList.add('ready');
  }

  ML.app = { summon, openBook };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

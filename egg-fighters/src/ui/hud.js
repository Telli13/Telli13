/* HUD and menus (DOM over the canvas): health bars, combo counter, round banners, menu, result. */
'use strict';

(() => {
  const ui = () => document.getElementById('ui');

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  class HUD {
    constructor(fighters, labels) {
      this.root = el('div', 'hud');
      this.bars = fighters.map((f, i) => {
        const b = el('div', 'bar bar' + i, `
          <div class="name">${labels[i]}</div>
          <div class="track"><div class="lag"></div><div class="fill" style="background:${f.def.ui}"></div></div>
          <div class="stage"></div>`);
        this.root.appendChild(b);
        return { b, fill: b.querySelector('.fill'), lag: b.querySelector('.lag'), stage: b.querySelector('.stage'), shown: 1, lagV: 1 };
      });
      this.combo = [el('div', 'combo combo0'), el('div', 'combo combo1')];
      this.combo.forEach((c) => this.root.appendChild(c));
      this.banner = el('div', 'banner');
      this.root.appendChild(this.banner);
      ui().appendChild(this.root);
      this.fighters = fighters;
      this.comboShown = [0, 0];
      this.bannerT = 0;
    }

    say(text, time = 1.1, cls = '') {
      this.banner.textContent = text;
      this.banner.className = 'banner show ' + cls;
      this.bannerT = time;
    }

    update(dt) {
      this.fighters.forEach((f, i) => {
        const bar = this.bars[i];
        const v = f.hp / f.maxHp;
        bar.shown = v;
        bar.lagV = bar.lagV > v ? Math.max(v, bar.lagV - dt * 0.35) : v;
        bar.fill.style.width = (v * 100).toFixed(1) + '%';
        bar.lag.style.width = (bar.lagV * 100).toFixed(1) + '%';
        if (f.stageText) bar.stage.textContent = f.stageText();
        // combo counter for hits landed by this fighter
        const c = this.combo[i];
        if (f.hitCount >= 2 && f.hitCount !== this.comboShown[i]) {
          c.textContent = f.hitCount + ' HITS!';
          c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        }
        if (f.hitCount === 0 && this.comboShown[i]) c.classList.remove('pop');
        this.comboShown[i] = f.hitCount;
      });
      if (this.bannerT > 0) {
        this.bannerT -= dt;
        if (this.bannerT <= 0) this.banner.classList.remove('show');
      }
    }

    destroy() { this.root.remove(); }
  }

  /** start menu: pick a fighter or watch CPU vs CPU */
  function menu(onPick) {
    const m = el('div', 'menu', `
      <h1>Chocolate<br><span>Egg Fighters</span></h1>
      <div class="pick">
        <button data-p="ninja" class="pk ninja"><b>Ниндзя</b><small>быстрый, катана</small></button>
        <button data-p="samurai" class="pk samurai"><b>Самурай</b><small>тяжёлый, меч</small></button>
      </div>
      <button data-p="demo" class="watch">Смотреть бой: CPU vs CPU</button>
      <div class="help">
        <span><kbd>WASD</kbd> движение</span><span><kbd>J</kbd> удар (тук-тук = комбо)</span>
        <span><kbd>K</kbd> рывок</span><span><kbd>L</kbd> сильный удар</span>
      </div>`);
    ui().appendChild(m);
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      EF.audio.unlock();
      m.remove();
      onPick(b.dataset.p);
    }));
    return m;
  }

  /** end-of-round panel */
  function result(text, onAgain, onMenu) {
    const r = el('div', 'result', `<div class="rt">${text}</div>
      <div class="row"><button class="again">Ещё раз</button><button class="tomenu">Меню</button></div>`);
    ui().appendChild(r);
    r.querySelector('.again').addEventListener('click', () => { r.remove(); onAgain(); });
    r.querySelector('.tomenu').addEventListener('click', () => { r.remove(); onMenu(); });
    return r;
  }

  EF.hud = { HUD, menu, result };
})();

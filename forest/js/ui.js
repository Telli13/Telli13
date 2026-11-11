'use strict';
// ===== Интерфейс: HUD, меню, панели =====
const $ = id => document.getElementById(id);
const UI = {
  hudBottom: 170, last: {}, camT: null, selPow: 'a1', selArt: -1, toastT: 0, panelKind: null, queue: [],
  init() {
    SPR.lens = mk(64, 64, g => { g.lineWidth = 9; g.strokeStyle = '#4a2a1c'; g.beginPath(); g.arc(27, 27, 16, 0, TAU); g.moveTo(40, 40); g.lineTo(56, 56); g.stroke(); g.fillStyle = 'rgba(143,216,255,.7)'; g.beginPath(); g.arc(27, 27, 12, 0, TAU); g.fill(); });
    SPR.gear = mk(64, 64, g => { for (let i = 0; i < 8; i++) { g.save(); g.translate(32, 32); g.rotate(i / 8 * TAU); box(g, '#7b8aa0', -6, -29, 12, 16, 4, { rim: 2, gloss: 0 }); g.restore(); } ball(g, '#93a3ba', 32, 32, 20, 20); ball(g, '#4a5568', 32, 32, 8, 8, { rim: 0, gloss: 0 }); });
    SPR.gift = mk(64, 64, g => { box(g, '#ff5d73', 10, 26, 44, 32, 7); box(g, '#ff8fa0', 6, 16, 52, 14, 6); box(g, '#ffe27a', 27, 16, 10, 42, 3, { rim: 0 }); ball(g, '#ffe27a', 22, 11, 10, 7, { rot: .5, rim: 2 }); ball(g, '#ffe27a', 42, 11, 10, 7, { rot: -.5, rim: 2 }); });
    $('res').innerHTML = [['w', '#bfe6ff'], ['n', '#ffd9a8'], ['m', '#dccbff'], ['s', '#e6f7a0']].map(([k, c]) => `<div class="chip clay" id="r_${k}" style="--c:${c}">${icon(k, 26)}<span></span></div>`).join('');
    $('btnUpg').innerHTML = icon('m', 30) + 'Грибница<span class="dot hidden"></span>';
    $('btnPow').innerHTML = icon('s', 30) + 'Силы<span class="dot hidden"></span>';
    $('btnHome').innerHTML = icon('core', 34); $('btnZoom').innerHTML = icon('lens', 30);
    $('mPow').innerHTML = icon('s', 32) + 'Сверх&shy;способности';
    $('mCol').innerHTML = icon('relic', 32) + 'Коллекция';
    $('mDaily').innerHTML = icon('gift', 32) + 'Подарок дня<span class="dot hidden">!</span>';
    $('mSet').innerHTML = icon('gear', 32) + 'Настройки';
    const cols = ['#ff5d73', '#ff9416', '#ffc531', '#7ed957', '#3fb2ff', '#b48bff', '#ff8fc7', '#5ff0c0'];
    const logo = (id, s, o) => $(id).innerHTML = [...s].map((ch, i) => `<span style="--lc:${cols[(i + o) % 8]};--ld:${shade(cols[(i + o) % 8], -.4)};--i:${i + o}">${ch}</span>`).join('');
    logo('logo1', 'MYCELIUM', 0); logo('logo2', 'FOREST', 3);
    const on = (id, f) => $(id).addEventListener('click', e => { Snd.unlock(); Snd.play('click'); f(e); });
    on('mPlay', () => this.play()); on('mPow', () => this.powers()); on('mCol', () => this.collection()); on('mDaily', () => this.daily()); on('mSet', () => this.settings());
    on('btnMenu', () => this.menu()); on('rank', () => this.menu()); on('btnUpg', () => this.upgrades()); on('btnPow', () => this.powers());
    on('btnHome', () => this.focus(W.core.x, 150)); on('btnZoom', () => { const d = defZoom(); cam.z = cam.z > d * .8 ? d * .5 : d; clampCam(); });
    on('pClose', () => this.closePanel());
    on('quest', () => { if (claimQuest()) { fxStars(cam.x, W.view.y0 + 120 / cam.z, 16); this.last = {}; this.tick(); } else if (S.q) this.questInfo(); });
    $('pBody').addEventListener('click', e => this.panelClick(e));
    $('mBody').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { Snd.play('click'); this.modalAct(b.dataset.m); } });
    $('types').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; const i = +b.dataset.t; if (S.lvl < MUSH[i].lvl) { this.toast(MUSH[i].name + ' откроется на уровне ' + MUSH[i].lvl); return; } S.sel = i; Snd.play('click'); this.types(); this.toast(MUSH[i].name + (MUSH[i].tip ? ' — ' + MUSH[i].tip : ` — ${MUSH[i].val} спор за сбор`)); });
    $('abilities').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) usePower(b.dataset.p); });
    this.types(); this.abilities(); this.menuInfo();
  },
  // ---------- HUD ----------
  set(id, v, f) { if (this.last[id] === v) return; this.last[id] = v; f($(id), v); },
  tick() {
    if (!S) return;
    const r = S.res;
    for (const k of ['w', 'n']) this.set('r_' + k, Math.floor(r[k]) + '/' + M.cap, e => { e.lastChild.innerHTML = `${fmt(r[k])}<small>/${fmt(M.cap)}</small>`; e.style.filter = r[k] >= M.cap ? 'saturate(1.5)' : ''; });
    this.set('r_m', fmt(r.m), (e, v) => e.lastChild.textContent = v);
    this.set('r_s', fmt(r.s), (e, v) => e.lastChild.textContent = v);
    const rk = rankOf(S.lvl);
    this.set('rankName', RANKS[rk].name, (e, v) => { e.textContent = v; $('rankIc').src = iconURL(['s', 'bud', 'core', 'm3', 'tree', 'wisp', 'm6', 'heart'][rk]); });
    this.set('lvlTxt', 'Ур. ' + S.lvl, (e, v) => e.textContent = v);
    this.set('xpFill', Math.round(S.xp / xpNeed(S.lvl) * 100), (e, v) => e.style.width = v + '%');
    const se = SEASONS[S.season];
    this.set('seasonChip', S.season, e => { e.firstChild.textContent = se.name; e.style.setProperty('--c', mix(se.col, '#ffffff', .45)); e.lastChild.firstChild.style.background = se.col; });
    this.set('seasonBar', Math.round(S.seasonT / SEASON_LEN * 50), (e, v) => $('seasonChip').lastChild.firstChild.style.width = v * 2 + '%');
    const q = S.q;
    if (q) this.set('quest', q.text + q.have + q.done, e => {
      e.classList.toggle('done', !!q.done);
      e.children[0].textContent = q.done ? 'Готово! Нажми, чтобы забрать награду' : q.text;
      e.children[1].firstChild.style.width = Math.round(q.have / q.need * 100) + '%';
      e.children[2].innerHTML = `+${q.s}${icon('s', 15)}` + (q.m ? ` +${q.m}${icon('m', 15)}` : '');
    });
    const b = W.boss;
    this.set('bossBar', b ? b.name + Math.ceil(b.hp) + Math.ceil(b.life) : '', e => {
      e.classList.toggle('hidden', !b); if (!b) return;
      e.firstChild.textContent = `${b.name} — ${Math.ceil(b.life)} с`; e.lastChild.firstChild.style.width = Math.max(0, b.hp / b.max * 100) + '%';
    });
    const B = W.buffs, nm = { frenzy: ['Экстаз ×3', '#ff4fa3'], free: ['Бесплатный рост', '#5fc13a'], x2: ['Споры ×2', '#a5c21a'], rain: ['Дождь', '#3f8fe0'], drought: ['Засуха', '#ff8a1f'] };
    let bs = ''; for (const k in B) if (nm[k]) bs += `<span class="buff" style="background:${nm[k][1]}">${nm[k][0]} ${Math.ceil(B[k])}с</span>`;
    this.set('buffs', bs, (e, v) => e.innerHTML = v);
    // кулдауны умений
    for (const el of $('abilities').children) {
      const id = el.dataset.p, cd = W.cd[id] || 0, mx = (W.cdMax && W.cdMax[id]) || 1;
      el.children[1].style.height = (cd / mx * 100) + '%'; el.children[2].textContent = cd > 0 ? Math.ceil(cd) : ''; el.classList.toggle('ready', cd <= 0);
    }
    // подсказки-точки на кнопках
    const canU = UPG.some((u, i) => S.upg[i] < u.max && r.m >= upgCost(i));
    this.set('dotU', canU, (e, v) => $('btnUpg').lastChild.classList.toggle('hidden', !v));
    const canP = POWERS.some(p => powState(p) === 'can' && r.s >= powCost(p, S.pow[p.id] || 0));
    this.set('dotP', canP, (e, v) => $('btnPow').lastChild.classList.toggle('hidden', !v));
    this.set('typesKey', S.lvl + ':' + S.sel, () => this.types());
    this.hudBottom = $('top').getBoundingClientRect().bottom;
    if (this.toastT > 0 && performance.now() > this.toastT) { $('toast').classList.remove('show'); this.toastT = 0; }
  },
  types() {
    let h = '', shownLock = false;
    MUSH.forEach((T, i) => {
      const lock = S.lvl < T.lvl; if (lock && shownLock) return; if (lock) shownLock = true;
      h += `<button class="type clay ${i === S.sel ? 'sel' : ''} ${lock ? 'lock' : ''}" data-t="${i}">${icon('m' + i, 40)}<span>${lock ? 'Ур. ' + T.lvl : T.name}</span>${lock ? '' : `<span>${T.n}${icon('n', 11)} ${T.w}${icon('w', 11)}</span>`}</button>`;
    });
    $('types').innerHTML = h; const se = $('types').querySelector('.sel'); if (se && se.scrollIntoView) se.scrollIntoView({ inline: 'center', block: 'nearest' });
  },
  abilities() {
    $('abilities').innerHTML = POWERS.filter(p => p.active && S.pow[p.id]).map(p => `<button class="abil clay" data-p="${p.id}" style="--c:${{ a2: '#8fe04a', b2: '#ff8a8a', b4: '#c9a37a', c2: '#8fd8ff', c4: '#ffd24a' }[p.id]}">${icon(p.icon, 40)}<u></u><s></s></button>`).join('');
  },
  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); this.toastT = performance.now() + 2200; },
  banner(title, sub, col) {
    const b = $('banner'); b.classList.remove('show'); void b.offsetWidth;
    b.firstElementChild.textContent = title; b.lastElementChild.textContent = sub || ''; b.style.setProperty('--bc', col || '#ff4fa3'); b.classList.add('show');
  },
  pulseRes(k) { const e = $('r_' + k); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); },
  questDone() { this.tick(); },
  forest() { this.last.menu = null; },
  focus(x, y) { this.camT = { x, y }; },
  levelUp(lvl, gift, rankUp) {
    const news = [];
    MUSH.forEach(T => { if (T.lvl === lvl) news.push('Новый гриб: ' + T.name); });
    ZONES.forEach((Z, i) => { if (Z.lvl === lvl && i === S.zones) news.push('Можно открыть зону «' + Z.name + '»'); });
    if (lvl === 4) news.push('Берегись: засуха, слизни и мини-боссы!');
    if (rankUp) {
      const rk = rankOf(lvl);
      this.modal(`${icon(['s', 'bud', 'core', 'm3', 'tree', 'wisp', 'm6', 'heart'][rk], 96).replace('class="ic"', 'class="ic bigic"')}<p>Новый ранг</p><h2>${RANKS[rk].name}</h2><p>Уровень ${lvl}. Подарок: +${gift} ${icon('s', 18)}</p>${news.map(n => `<p><b>${n}</b></p>`).join('')}<button class="btn clay" data-m="close">Дальше расти!</button>`);
      fxStars(cam.x, cam.y - 100, 30);
    } else this.banner('УРОВЕНЬ ' + lvl + '!', news[0] || '+' + gift + ' спор в подарок', '#7ed957');
    this.last = {};
  },
  artifact(i) {
    const A = ARTIFACTS[i], R = RARITY[A.r];
    this.modal(`${icon('art' + i, 96).replace('class="ic"', 'class="ic bigic"')}<p style="color:${shade(R.col, -.35)};font-weight:800">${R.name} артефакт</p><h2>${A.name}</h2><p><b>${A.txt}</b></p><p class="note">Коллекция: ${S.arts.length} / ${ARTIFACTS.length}</p><button class="btn clay" data-m="close">Забрать</button>`);
    W.flash = .4;
  },
  win() {
    this.modal(`${icon('heart', 110).replace('class="ic"', 'class="ic bigic"')}<h2>Ты — Бог земли!</h2><p>Грибница дотянулась до Сердца земли. Весь лес теперь дышит вместе с тобой.</p><p><b>+5000 спор</b></p><p class="note">Можно продолжать растить лес — или переродиться в Настройках: мир начнётся заново, а споры будут приносить на 50% больше. Силы и артефакты останутся.</p><button class="btn clay" data-m="close">Править лесом</button>`);
  },
  // ---------- экраны ----------
  show(id, v) { $(id).classList.toggle('hidden', !v); },
  pauseCheck() { W.paused = !$('menu').classList.contains('hidden') || !$('panel').classList.contains('hidden') || !$('modal').classList.contains('hidden'); },
  menu() { saveGame(); this.menuInfo(); this.show('menu', true); this.show('hud', false); this.pauseCheck(); },
  menuInfo() {
    const f = forestStat(), rk = rankOf(S.lvl), d = dailyState();
    $('menuRank').innerHTML = `${icon(['s', 'bud', 'core', 'm3', 'tree', 'wisp', 'm6', 'heart'][rk], 46)}<div style="flex:1"><b>${RANKS[rk].name} · ур. ${S.lvl}</b>Лес под твоей властью: ${f.own} из ${f.tot} деревьев<span class="bar" style="margin-top:4px"><i style="width:${f.own / f.tot * 100}%"></i></span>${S.prestige ? 'Перерождений: ' + S.prestige : ''}</div>`;
    $('mDaily').lastChild.classList.toggle('hidden', !d.can);
    $('mPlay').textContent = S.played > 5 ? 'Продолжить' : 'Играть';
  },
  play() {
    this.show('menu', false); this.show('hud', true); this.pauseCheck(); this.last = {}; this.tick();
    if (S.played < 1) this.modal(`${icon('core', 96).replace('class="ic"', 'class="ic bigic"')}<h2>Ты — крошечная спора</h2><p>Под землёй растёт твоя грибница. Тянись гифами к воде и перегною, выращивай грибы на поверхности, буди деревья.</p><p>Защищай грибницу от жуков, переживи засуху и зиму — и стань <b>Богом земли</b>.</p><button class="btn clay" data-m="intro">Проснуться</button>`);
    else if (W.offline) { const o = W.offline; W.offline = null; const m = Math.floor(o.sec / 60); this.modal(`${icon('s', 96).replace('class="ic"', 'class="ic bigic"')}<h2>С возвращением!</h2><p>Тебя не было ${m >= 60 ? Math.floor(m / 60) + ' ч ' + m % 60 + ' мин' : m + ' мин'}. Лес не спал:</p><div class="have"><span>+${fmt(o.sp)} ${icon('s', 22)}</span>${o.mn ? `<span>+${fmt(o.mn)} ${icon('m', 22)}</span>` : ''}</div><p class="note">Кладовые полны, все грибы созрели — собирай комбо!</p><button class="btn clay" data-m="close">Отлично</button>`); }
    else if (dailyState().can && S.played > 120) this.daily();
  },
  modal(html) {
    if (!$('modal').classList.contains('hidden')) { this.queue.push(html); return; }
    $('mBody').innerHTML = html; this.show('modal', true); this.pauseCheck();
  },
  modalAct(a) {
    if (a === 'gate') { if (!unlockZone()) return; }
    if (a === 'reroll') rerollQuest();
    if (a === 'intro') this.toast('Двигай мир пальцем, щипком меняй масштаб');
    if (a === 'replace' && this.repSpot) { const sp = this.repSpot; sp.m = null; plant(sp); }
    if (a === 'reset') { localStorage.removeItem(SAVE_KEY); S = null; location.reload(); return; }
    if (a === 'prestige') { prestige(); cam.x = CORE.x; cam.y = 150; this.closePanel(); this.types(); UI.banner('ПЕРЕРОЖДЕНИЕ', 'Споры теперь ×' + (1 + .5 * S.prestige), '#ff8fc7'); }
    this.show('modal', false);
    if (this.queue.length) this.modal(this.queue.shift());
    this.pauseCheck(); this.last = {};
  },
  questInfo() {
    const q = S.q, tut = S.qi < TUTORIAL.length;
    this.modal(`<h2>Задание</h2><p>${q.text}</p><span class="bar" style="width:100%"><i style="width:${q.have / q.need * 100}%"></i></span><p><b>${fmt(q.have)} / ${fmt(q.need)}</b></p><div class="have"><span>Награда: +${q.s} ${icon('s', 22)}</span>${q.m ? `<span>+${q.m} ${icon('m', 22)}</span>` : ''}</div><button class="btn clay" data-m="close">Понятно</button>${tut ? '' : '<button class="btn clay alt" data-m="reroll">Другое задание</button>'}`);
  },
  gate() {
    const Z = ZONES[S.zones], okL = S.lvl >= Z.lvl, okM = S.res.m >= Z.cost;
    this.modal(`${icon('lock', 80)}<h2>${Z.name}</h2><p>Новая зона: свежие залежи, спящие деревья и 4 артефакта.</p><p>Нужен уровень <b style="color:${okL ? '#3a8a1c' : '#d0342c'}">${Z.lvl}</b> и <b style="color:${okM ? '#3a8a1c' : '#d0342c'}">${Z.cost}</b> ${icon('m', 18)}</p><button class="btn clay ${okL && okM ? '' : 'off'}" data-m="${okL && okM ? 'gate' : 'close'}">${okL && okM ? 'Прорасти туда!' : 'Пока рано'}</button>${okL && okM ? '<button class="btn clay alt" data-m="close">Позже</button>' : ''}`);
  },
  replace(sp) {
    const T = MUSH[S.sel]; this.repSpot = sp;
    this.modal(`${icon('m' + S.sel, 80)}<h2>Пересадить?</h2><p>Заменить «${MUSH[sp.m.ty].name}» на «${T.name}» за ${T.n} ${icon('n', 16)} и ${T.w} ${icon('w', 16)}</p><button class="btn clay" data-m="replace">Пересадить</button><button class="btn clay alt" data-m="close">Оставить</button>`);
  },
  openPanel(kind, title, html) { this.panelKind = kind; $('pTitle').textContent = title; $('pBody').innerHTML = html; this.show('panel', true); this.pauseCheck(); },
  closePanel() { this.show('panel', false); this.pauseCheck(); this.menuInfo(); this.last = {}; saveGame(); },
  have() { return `<div class="have"><span>${icon('s', 24)}${fmt(S.res.s)}</span><span>${icon('m', 24)}${fmt(S.res.m)}</span></div>`; },
  upgrades() {
    this.openPanel('upg', 'Грибница', this.have() + UPG.map((u, i) => {
      const l = S.upg[i], mx = l >= u.max, c = upgCost(i);
      return `<div class="rowi clay">${icon(u.icon, 42)}<div class="tx"><b>${u.name} · ${l}/${u.max}</b>${u.desc}</div><button class="btn clay ${mx || S.res.m < c ? 'off' : ''}" data-a="upg" data-i="${i}">${mx ? 'Макс.' : c + icon('m', 18)}</button></div>`;
    }).join('') + '<p class="note">Минералы добывай из кристаллов в глубине, лови в звездопад и выбивай из боссов.</p>');
  },
  powers() {
    const P = POWERS.find(p => p.id === this.selPow), l = S.pow[P.id] || 0, st = powState(P), c = powCost(P, l);
    const nodes = POWERS.map(p => { const s = powState(p), lv = S.pow[p.id] || 0; return `<button class="pn clay r${p.row} ${s === 'max' ? 'own max' : lv ? 'own' : s === 'can' ? 'can' : ''} ${p.id === this.selPow ? 'cur' : ''}" style="grid-column:${p.col + 1};grid-row:${p.row + 1}" data-a="psel" data-i="${p.id}">${icon(p.icon, 44)}${p.max > 1 ? `<em>${lv}/${p.max}</em>` : p.active ? '<em>умение</em>' : ''}</button>`; }).join('');
    const req = P.req ? [].concat(P.req).map(r => POWERS.find(p => p.id === r).name).join(', ') : '';
    this.openPanel('pow', 'Сверхспособности', this.have() + `<div class="tree"><i class="hb" style="top:74px"></i><i class="hb" style="top:403px"></i>${nodes}</div>
      <div class="pinfo clay"><b>${P.name}${P.max > 1 ? ` · ${l}/${P.max}` : ''}</b><span>${P.desc}</span>${st === 'lock' ? `<span class="note">Сначала изучи: ${req}</span>` : ''}
      ${st === 'max' ? '<button class="btn clay off">Изучено</button>' : `<button class="btn clay ${st !== 'can' || S.res.s < c ? 'off' : ''}" data-a="pbuy" data-i="${P.id}">${l ? 'Усилить' : 'Изучить'} за ${fmt(c)}${icon('s', 20)}</button>`}</div>`);
  },
  collection() {
    const i = this.selArt, A = ARTIFACTS[i], own = i >= 0 && S.arts.includes(i);
    const info = i < 0 ? '<span>Артефакты спрятаны в сундуках глубоко под землёй, выпадают из боссов и на 7-й день подарков. Каждый даёт постоянный бонус.</span>' :
      own ? `<b>${A.name}</b><span style="color:${shade(RARITY[A.r].col, -.4)};font-weight:800">${RARITY[A.r].name}</span><span>${A.txt}</span>` : `<b>???</b><span>${RARITY[A.r].name} артефакт. Ищи в зоне «${ZONES[(i / 4) | 0].name}».</span>`;
    this.openPanel('col', `Коллекция ${S.arts.length}/${ARTIFACTS.length}`, `<div class="pinfo clay">${info}</div><div class="col">` + ARTIFACTS.map((a, k) => `<button class="ac clay ${S.arts.includes(k) ? '' : 'no'} ${k === i ? 'cur' : ''}" data-a="asel" data-i="${k}" style="--rc:${RARITY[a.r].col}${S.arts.includes(k) ? ';--c:' + mix(RARITY[a.r].col, '#ffffff', .6) : ''}">${icon('art' + k, 48)}<i></i></button>`).join('') + '</div>');
  },
  daily() {
    const d = dailyState();
    this.openPanel('day', 'Подарок дня', `<p class="note" style="font-size:13px">Заходи каждый день — подарки растут. На 7-й день — артефакт!${d.streak ? ' Дней подряд: ' + d.streak : ''}</p><div class="days">` + DAILY.map((R, i) => `<div class="day clay ${i < d.day || (!d.can && i === (d.streak - 1) % 7) ? 'got' : ''} ${d.can && i === d.day ? 'now' : ''}"><b>День ${i + 1}</b>${icon(R.art ? 'relic' : R.m && !R.s ? 'm' : 's', 30)}${R.txt}</div>`).join('') + `</div><button class="btn clay ${d.can ? '' : 'off'}" data-a="daily">${d.can ? 'Забрать подарок!' : 'Приходи завтра'}</button>`);
  },
  settings() {
    const t = (k, n) => `<button class="tog clay ${S.set[k] ? 'on' : ''}" data-a="tog" data-i="${k}">${n}<u></u></button>`;
    const pt = Math.floor(S.played / 60);
    this.openPanel('set', 'Настройки', t('snd', 'Звуки') + t('mus', 'Музыка') + t('vib', 'Вибрация') + t('fx', 'Много частиц') +
      `<p class="note">В игре: ${pt >= 60 ? Math.floor(pt / 60) + ' ч ' : ''}${pt % 60} мин · собрано грибов: ${fmt(S.stats.harvest || 0)} · лучшее комбо: ×${S.stats.bestCombo || 0}</p>` +
      (S.won ? '<button class="btn clay" style="--c:#ff8fc7" data-a="prestige">Перерождение (+50% спор)</button>' : '') +
      '<button class="btn clay red" data-a="reset">Сбросить весь прогресс</button><p class="note">Прогресс сохраняется на этом устройстве автоматически.<br>Звуки: ZzFX (MIT, Frank Force) · шрифт Rubik (OFL)</p>');
  },
  panelClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, i = b.dataset.i;
    Snd.play('click');
    if (a === 'upg') { const c = upgCost(+i); if (S.upg[+i] >= UPG[+i].max) return; if (S.res.m < c) { Snd.play('err'); return; } S.res.m -= c; S.upg[+i]++; recalc(); track('upgrade', 1); Snd.play('gold'); this.upgrades(); }
    if (a === 'psel') { this.selPow = i; this.powers(); }
    if (a === 'pbuy') { const P = POWERS.find(p => p.id === i), l = S.pow[i] || 0; if (powState(P) !== 'can' || S.res.s < powCost(P, l)) { Snd.play('err'); return; } S.res.s -= powCost(P, l); S.pow[i] = l + 1; recalc(); track('power', 1); Snd.play('fanfare', 1.2); this.abilities(); this.powers(); if (i === 'god') this.banner('БОГ ЗЕМЛИ', 'Лес — это ты', '#ffc531'); }
    if (a === 'asel') { this.selArt = +i; this.collection(); }
    if (a === 'daily') { const R = claimDaily(); if (R) { this.toast('Получено: ' + R.txt); this.daily(); } }
    if (a === 'tog') { S.set[i] = !S.set[i]; Snd.on = S.set.snd; Music.setOn(S.set.mus); this.settings(); }
    if (a === 'reset') this.modal('<h2>Сбросить всё?</h2><p>Грибница, силы, артефакты и ранг исчезнут навсегда.</p><button class="btn clay red" data-m="reset">Да, начать с нуля</button><button class="btn clay alt" data-m="close">Нет</button>');
    if (a === 'prestige') this.modal(`${icon('heart', 80)}<h2>Перерождение</h2><p>Мир и прокачка грибницы начнутся заново. Останутся ранг, силы и артефакты, а споры будут приносить ещё на 50% больше.</p><button class="btn clay" data-m="prestige">Переродиться</button><button class="btn clay alt" data-m="close">Не сейчас</button>`);
  },
};
function upgCost(i) { return Math.round(UPG[i].base * Math.pow(UPG[i].k, S.upg[i])); }
function powState(p) {
  const l = S.pow[p.id] || 0; if (l >= p.max) return 'max';
  const ok = !p.req || [].concat(p.req).every(r => S.pow[r]);
  return ok ? 'can' : 'lock';
}

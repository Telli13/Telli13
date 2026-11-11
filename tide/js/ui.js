// Интерфейс: HUD, дерево улучшений, коллекция, всплывающие окна
'use strict';
const UI = (() => {
  const $ = id => document.getElementById(id);
  let tab = 'fire', openName = null, hudT = 0, popQ = [], endT = 0, endStage = -1;

  function init() {
    const S = G.S;
    document.body.classList.toggle('desk', !G.touch);
    $('help').innerHTML = G.touch
      ? 'Левый палец — идти · правый — смотреть · тап по находке — поднять · тап в сторону горна или ✋ — бросить'
      : 'WASD — идти · мышь — смотреть (клик захватывает курсор) · ЛКМ / E — поднять и бросить · ПКМ / F — вихрь · U — улучшения · C — коллекция · H — домой';
    if (S.st.time > 5) { $('play').textContent = 'Продолжить'; $('intro').innerHTML = 'Огонь ещё горит. Дно ждёт.' + (S.pearls ? '<br>Жемчужин прилива: ' + S.pearls + ' (свет +' + S.pearls * 50 + '%)' : ''); }
    $('play').onclick = () => {
      $('start').classList.add('hide'); $('hud').classList.remove('hide'); G.start();
      if (G.offlineGain) popup('🦀', 'Пока тебя не было', 'Крабы работали ' + Math.round(G.offlineGain.dt / 60) + ' мин и принесли', '+' + D.fmt(G.offlineGain.v) + ' ✦');
      if (S.heartDone) toast('Море вернулось. В настройках можно начать новый отлив.');
    };
    $('bShop').onclick = () => toggle('shop'); $('bBook').onclick = () => toggle('book'); $('bSet').onclick = () => toggle('set');
    document.querySelectorAll('.panel .x').forEach(b => b.onclick = () => toggle(null));
    document.querySelectorAll('.panel').forEach(p => p.addEventListener('pointerdown', e => { if (e.target === p && p.id !== 'popup') toggle(null); }));
    const hold = (el, on, off) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); on(); });
      for (const n of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(n, () => { el.classList.remove('on'); off && off(); });
    };
    hold($('bAct'), () => G.action()); hold($('bVac'), () => G.input.vac = true, () => G.input.vac = false); hold($('bHome'), () => G.goHome());
    $('popOk').onclick = () => { $('popup').classList.add('hide'); openName = null; nextPop(); };
    $('tabs').innerHTML = D.TABS.map(t => `<button data-t="${t[0]}">${t[1]}</button>`).join('');
    $('tabs').onclick = e => { const t = e.target.dataset.t; if (t) { tab = t; drawShop(); } };
    $('shopBody').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.id === 'lh') G.kindle(); else G.buy(b.dataset.id); drawShop();
    };
  }

  // ---------- панели ----------
  function toggle(name) {
    if ($('popup').classList.contains('hide') === false) return;
    if (openName === name) name = null;
    for (const n of ['shop', 'book', 'set']) $(n).classList.toggle('hide', n !== name);
    openName = name; if (name && document.exitPointerLock) document.exitPointerLock();
    if (name === 'shop') drawShop(); if (name === 'book') drawBook(); if (name === 'set') drawSet();
  }
  const affordable = id => { const S = G.S, u = D.UP[id]; return G.canSee(id) && S.up[id] < u.max && S.light >= D.cost(id, S.up[id]); };
  function drawShop() {
    const S = G.S; let h = '<div class="cards">';
    document.querySelectorAll('#tabs button').forEach(b => {
      b.classList.toggle('on', b.dataset.t === tab);
      b.classList.toggle('dot', Object.keys(D.UP).some(id => D.UP[id].tab === b.dataset.t && affordable(id)) || (b.dataset.t === 'fire' && S.lh < 8 && S.light >= D.LH_COST[S.lh]));
    });
    document.querySelector('#shop .wallet').textContent = D.fmt(S.light) + ' ✦';
    if (tab === 'fire') {
      const c = D.LH_COST[S.lh], can = S.lh < 8 && S.light >= c;
      h += `<div class="card main ${can ? 'can' : ''}"><div class="hd"><span class="ic">🗼</span>Маяк: ${D.LH_NAMES[S.lh]}<span class="lv">${S.lh}/8</span></div>` +
        (S.lh < 8 ? `<p>Разожги огонь сильнее: мгла отступит до ${D.LIT[S.lh + 1]} м, откроются новые улучшения${[1, 3, 5].includes(S.lh) ? ' и <b>новая зона с дорогими находками</b>' : ''}.</p><button data-id="lh">Разжечь — ${D.fmt(c)} ✦</button>`
          : `<p>Огонь горит в полную силу. ${S.heartDone ? 'Море вернулось.' : 'Найди Сердце моря на краю бездны — иди на столб света.'}</p>`) + '</div>';
    }
    for (const id in D.UP) {
      const u = D.UP[id]; if (u.tab !== tab) continue;
      const l = S.up[id], see = G.canSee(id), mx = l >= u.max, c = D.cost(id, l), can = see && !mx && S.light >= c;
      if (!see) { h += `<div class="card lock"><div class="hd"><span class="ic">🔒</span>???</div><p>${S.lh < u.req ? 'Откроется на ' + u.req + '-м уровне маяка' : 'Сначала купи «' + D.UP[u.need[0]].name + '»'}</p></div>`; continue; }
      h += `<div class="card ${mx ? 'max' : can ? 'can' : ''}"><div class="hd"><span class="ic">${u.icon}</span>${u.name}<span class="lv">${l}/${u.max}</span></div>` +
        `<p>${l ? u.desc(l) : u.desc(1)}</p>${!mx && l ? `<div class="nx">→ ${u.desc(l + 1)}</div>` : ''}` +
        `<button data-id="${id}">${mx ? 'Максимум' : D.fmt(c) + ' ✦'}</button></div>`;
    }
    $('shopBody').innerHTML = h + '</div>';
  }
  function drawBook() {
    const S = G.S;
    let h = `<h3>Артефакты ${S.arts.length}/${D.ARTS.length}</h3><div class="arts">`;
    D.ARTS.forEach((a, i) => {
      const has = S.arts.includes(i);
      h += has ? `<div class="art"><i>${a[1]}</i><b>${a[0]}</b>${a[2]}<br><em>${D.BONUS_TXT[a[3][0]](a[3][1])}</em></div>` : `<div class="art no"><i>❔</i><b>???</b>Спрятан в сундуке на дне</div>`;
    });
    h += `</div><h3>Письма хранителя ${S.letters.length}/${D.LETTERS.length}</h3>`;
    D.LETTERS.forEach((l, i) => { h += S.letters.includes(i) ? `<div class="letter"><b>${l[0]}</b>${l[1]}</div>` : `<div class="letter no"><b>Письмо ${i + 1}</b>Ещё лежит в бутылке где-то на дне…</div>`; });
    const m = Math.floor(S.st.time / 60);
    h += `<h3>Журнал</h3><div class="row"><span>Сожжено находок</span><b>${S.st.burned}</b></div><div class="row"><span>Всего света</span><b>${D.fmt(S.total)} ✦</b></div>
      <div class="row"><span>Лучшая серия</span><b>${S.st.bestCombo}</b></div><div class="row"><span>На дне</span><b>${m} мин</b></div><div class="row"><span>Жемчужины прилива</span><b>${S.pearls}</b></div>`;
    $('bookBody').innerHTML = h;
  }
  function drawSet() {
    const S = G.S;
    $('setBody').innerHTML = `<div class="row"><span>Звук</span><button id="oSnd">${S.opt.snd ? 'Вкл' : 'Выкл'}</button></div>
      <div class="row"><span>Графика <small>(перезапуск)</small></span><button id="oQ">${S.opt.q ? 'Высокая' : 'Лёгкая'}</button></div>
      <div class="row"><span>Чувствительность</span><input id="oSens" type="range" min=".4" max="2.2" step=".1" value="${S.opt.sens}"></div>
      ${S.heartDone ? '<div class="row"><span>Новый отлив: начать заново с жемчужинами (+50% света за каждую)</span><button id="oNew">Начать</button></div>' : ''}
      <div class="row"><span>Стереть весь прогресс</span><button id="oWipe">Стереть</button></div>`;
    $('oSnd').onclick = () => { S.opt.snd = S.opt.snd ? 0 : 1; A.set(S.opt.snd); G.save(); drawSet(); };
    $('oQ').onclick = () => { S.opt.q = S.opt.q ? 0 : 1; G.save(); location.reload(); };
    $('oSens').oninput = e => { S.opt.sens = +e.target.value; G.save(); };
    $('oWipe').onclick = () => { if (confirm('Точно стереть весь прогресс?')) G.wipe(); };
    if ($('oNew')) $('oNew').onclick = () => G.rebirth();
  }
  function popup(em, title, text, extra) { popQ.push([em, title, text, extra]); if ($('popup').classList.contains('hide')) nextPop(); }
  function nextPop() {
    const p = popQ.shift(); if (!p) return;
    toggle(null); openName = 'popup'; if (document.exitPointerLock) document.exitPointerLock();
    $('popBody').innerHTML = `<div class="em">${p[0]}</div><h2>${p[1]}</h2><p>${p[2]}</p>${p[3] ? `<p class="bonus">${p[3]}</p>` : ''}`;
    $('popup').classList.remove('hide');
  }
  const artifact = i => { const a = D.ARTS[i]; popup(a[1], a[0], a[2], D.BONUS_TXT[a[3][0]](a[3][1]) + ' · артефакт ' + G.S.arts.length + '/' + D.ARTS.length); };
  const letter = i => { const l = D.LETTERS[i]; popup('📜', 'Письмо в бутылке', `<span class="letter" style="display:block"><b>${l[0]}</b>${l[1]}</span>`, 'Письмо ' + G.S.letters.length + '/' + D.LETTERS.length); };

  // ---------- мелочи HUD ----------
  function toast(t) { const d = document.createElement('div'); d.textContent = t; const box = $('toasts'); box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 3000); }
  function floater(pos, text, small) {
    const p = G.project(pos); if (!p) return; const d = document.createElement('div'); d.textContent = text; if (small) d.className = 's';
    d.style.left = p.x + (Math.random() - .5) * 60 + 'px'; d.style.top = p.y + (Math.random() - .5) * 30 + 'px'; $('floaters').appendChild(d); setTimeout(() => d.remove(), 1300);
  }
  function banner(t, s) { const b = $('banner'); b.querySelector('b').textContent = t; b.querySelector('span').textContent = s || ''; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  let zt;
  function zone(n, s) { const z = $('zone'); z.innerHTML = n + '<small>' + s + '</small>'; z.classList.add('on'); clearTimeout(zt); zt = setTimeout(() => z.classList.remove('on'), 2600); }
  function eventBar(ev) { const e = $('event'); e.classList.toggle('hide', !ev); if (ev) { e.querySelector('span').textContent = ev.name; e.querySelector('i').style.width = ev.t / ev.dur * 100 + '%'; } }
  function questDone(t, r) { toast('✔ ' + t + (r ? ' · +' + D.fmt(r) + ' ✦' : '')); const q = $('quest'); q.classList.remove('done'); void q.offsetWidth; q.classList.add('done'); }

  function frame(dt) {
    if (G.ending) return endFrame(dt);
    if (!G.running) return;
    hudT -= dt; if (hudT > 0) return; hudT = .12;
    const S = G.S, C = G.C, P = G.P;
    $('light').textContent = D.fmt(S.light); $('rate').textContent = G.rate > .05 ? '+' + D.fmt(G.rate) + ' ✦/с' : '';
    $('lhName').textContent = '🗼 ' + D.LH_NAMES[S.lh] + (S.lh < 8 ? ' · до огня ' + D.fmt(D.LH_COST[S.lh]) + ' ✦' : '');
    $('lhBar').firstChild.style.width = (S.lh < 8 ? Math.min(100, S.light / D.LH_COST[S.lh] * 100) : 100) + '%';
    const q = D.QUESTS[S.quest]; $('quest').innerHTML = q ? '🎯 ' + q[0] + (q[2] ? `<small>+${D.fmt(q[2] * (1 + S.pearls * .5))} ✦</small>` : '') : '🌊 Море вернулось. Спасибо, хранитель.';
    const any = Object.keys(D.UP).some(affordable) || (S.lh < 8 && S.light >= D.LH_COST[S.lh]); $('shopDot').classList.toggle('on', any);
    $('bVac').classList.toggle('hide', !S.up.vac); $('bHome').classList.toggle('hide', !S.up.home);
    $('bHome').textContent = Math.hypot(P.x, P.z) > 14 ? '🏠' : '↩';
    $('held').textContent = P.held ? '✋ ' + D.ITEMS[P.held.t].name + ' · ' + D.ITEMS[P.held.t].w + ' кг' : '';
    $('bag').textContent = C.bagCap ? '🎒 ' + P.bag.length + '/' + C.bagCap : '';
    const cb = G.combo; $('combo').classList.toggle('hide', cb.n < 2);
    if (cb.n >= 2) $('combo').innerHTML = 'серия ' + cb.n + '<small>×' + (1 + Math.min(cb.n, 20) / 20 * (C.comboMax - 1)).toFixed(2) + ' света</small>';
    const li = openName ? null : G.lookInfo();
    $('look').innerHTML = !li ? '' : li.sp ? `<b class="g">${li.name}</b><br>нажми, чтобы открыть` :
      `<b class="${li.rar == 2 ? 'a' : li.rar ? 'g' : ''}">${li.name}${li.rar ? ' — ' + D.RAR[li.rar].name : ''}</b> · <span class="${li.heavy ? 'h' : ''}">${li.w} кг</span> · ${D.fmt(li.v)} ✦`;
    const st = G.senseTarget(); $('sense').classList.toggle('hide', !st);
    if (st) { $('sense').firstChild.style.transform = `rotate(${-st.ang * 180 / Math.PI - 90}deg)`; $('sense').lastChild.textContent = (st.kind === 'chest' ? 'сундук' : st.kind === 'bottle' ? 'письмо' : 'звезда') + ' · ' + Math.round(st.d) + ' м'; }
    if (openName === 'shop') document.querySelector('#shop .wallet').textContent = D.fmt(S.light) + ' ✦';
  }

  // ---------- финал ----------
  const END = ['Огонь не сжёг Сердце. Он его разбудил.', 'Сначала вернулся звук.', 'Потом — вода.', 'Крабы успели на камни. Киты в долине вздохнули и поплыли.', 'Маяк горит. Море знает дорогу домой.'];
  function ending() { $('hud').classList.add('hide'); toggle(null); $('end').classList.remove('hide'); endT = 0; endStage = -1; }
  function endFrame(dt) {
    endT += dt; const st = Math.floor(endT / 3.6);
    if (st !== endStage && st < END.length) { endStage = st; $('endText').textContent = END[st]; }
    if (st >= END.length && endStage !== 99) {
      endStage = 99; const S = G.S, pearls = 1 + Math.floor(S.arts.length / 5);
      $('endBox').classList.remove('hide');
      $('endBox').innerHTML = `<h2>Отлив окончен</h2>Время на дне: ${Math.floor(S.st.time / 60)} мин · сожжено находок: ${S.st.burned}<br>Артефакты: ${S.arts.length}/${D.ARTS.length} · письма: ${S.letters.length}/${D.LETTERS.length}<br><br>
        Море оставило тебе <b style="color:#7ff0e0">${pearls} жемч.</b> — каждая навсегда даёт +50% света.<br>Артефакты и письма останутся с тобой.<br><button class="big" id="reb">Новый отлив</button>`;
      $('reb').onclick = () => G.rebirth();
    }
  }
  return { init, toast, floater, artifact, letter, banner, eventBar, ending, toggle, open: () => !!openName, zone, questDone, frame, popup };
})();

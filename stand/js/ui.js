'use strict';
/* UI: HUD, task tracker, station popup, sheets (upgrades, map, settings), modals and effects. */
const $ = (id) => document.getElementById(id);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const UI = (() => {
  let popK = -1, holdTimer = 0;

  function vibrate(ms) { if (Save.d.settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

  function toast(msg, cls = '') {
    const n = h(`<div class="toast ${cls}">${msg}</div>`);
    $('fx').append(n);
    setTimeout(() => n.remove(), 1900);
  }

  function burst(x, y, chars, n = 8) {
    for (let i = 0; i < n; i++) {
      const p = h(`<div class="burst">${chars[i % chars.length]}</div>`);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      $('fx').append(p);
      const a = (Math.PI * 2 * i) / n, r = 50 + Math.random() * 40;
      p.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1)`, opacity: 0 }],
      { duration: 700, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => p.remove();
    }
  }

  // Coins fly from a point in the world into the coin counter.
  function coinsFly(wx, wy, n = 6) {
    const from = R.w2s(wx, wy);
    const to = $('coins-pill').getBoundingClientRect();
    const app = $('app').getBoundingClientRect();
    const tx = to.left - app.left + 22, ty = to.top - app.top + 20;
    for (let i = 0; i < n; i++) {
      const c = h('<div class="fly-coin">🪙</div>');
      $('fx').append(c);
      const sx = from.x + (Math.random() - 0.5) * 30, sy = from.y + (Math.random() - 0.5) * 20;
      c.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(1)` },
        { transform: `translate(${(sx + tx) / 2 + 30}px, ${Math.min(sy, ty) - 30}px) scale(1.2)`, offset: 0.4 },
        { transform: `translate(${tx}px, ${ty}px) scale(.7)` },
      ], { duration: 650, delay: i * 55, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'backwards' }).onfinish = () => {
        c.remove();
        if (i === n - 1) { $('coins-pill').classList.remove('bump'); void $('coins-pill').offsetWidth; $('coins-pill').classList.add('bump'); }
      };
    }
  }

  /* ---------- HUD & task ---------- */
  function hud() {
    $('coins').textContent = fmt(Save.d.coins);
    const L = Sim.L;
    const li = L.iconItem ? itemIcon(L.iconItem) : L.icon;
    if ($('loc-ico').dataset.k !== li) { $('loc-ico').innerHTML = li; $('loc-ico').dataset.k = li; }
    $('loc-name').textContent = L.name;
    const anyUp = GUPS.some((g) => { const c = Eco.gupCost(g, Sim.LS.ups[g.id] || 0, L); return c != null && Save.d.coins >= c; });
    $('ups-dot').hidden = !anyUp;
    // boost button
    const now = Date.now(), b = $('btn-boost');
    if (Save.boostOn()) { $('boost-label').textContent = '2× ' + Math.ceil((Save.d.boostUntil - now) / 1000) + 's'; b.classList.add('active'); b.classList.remove('cool'); }
    else if (now < Save.d.boostReady) { const s = Math.ceil((Save.d.boostReady - now) / 1000); $('boost-label').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; b.classList.remove('active'); b.classList.add('cool'); }
    else { $('boost-label').textContent = '2× Boost'; b.classList.remove('active', 'cool'); }
  }

  function taskList() { return tasksFor(Sim.L); }
  function currentTask() { return taskList()[Sim.LS.task] || null; }

  function taskProgress(t) {
    const LS = Sim.LS, st = Sim.stations;
    switch (t.type) {
      case 'sell': return [Math.min(t.n, LS.sold[Sim.L.slots[t.slot].item] || 0), t.n];
      case 'level': return [Math.min(t.n, st[t.slot].s.lvl), t.n];
      case 'build': return [st[t.slot].s.lvl > 0 ? 1 : 0, 1];
      case 'serve': return [Math.min(t.n, LS.served), t.n];
      case 'gup': return [Math.min(t.n, LS.ups[t.id] || 0), t.n];
      case 'all': return [st.filter((x) => x.s.lvl >= t.n).length, st.length];
    }
    return [0, 1];
  }

  function taskInfo(t) {
    const slot = t.slot != null ? Sim.L.slots[t.slot] : null;
    const it = slot ? ITEMS[slot.item] : null;
    const ic = slot ? itemIcon(slot.item) : '';
    switch (t.type) {
      case 'sell': return { ico: ic, title: `Sell ${t.n} ${it.name}` };
      case 'level': return { ico: ic, title: `Upgrade ${it.name} to Lv ${t.n}` };
      case 'build': return { ico: ic, title: `Build ${it.name}` };
      case 'serve': return { ico: '😊', title: `Serve ${t.n} customers` };
      case 'gup': { const g = GUPS.find((x) => x.id === t.id); return { ico: g.icon, title: `Buy ${g.name}` }; }
      case 'all': return { ico: '🏆', title: `Every station to Lv ${t.n}` };
    }
    return { ico: '⭐', title: '' };
  }

  function task() {
    const t = currentTask();
    const box = $('task');
    if (!t) {
      $('t-ico').textContent = '🏆'; $('t-ico').dataset.k = '';
      $('t-title').textContent = Sim.index < LOCATIONS.length - 1 ? 'Stand complete! Open the map' : 'Every stand complete!';
      $('t-fill').style.transform = 'scaleX(1)';
      $('t-count').textContent = '✓';
      $('t-claim').hidden = true;
      box.classList.add('done');
      return;
    }
    const info = taskInfo(t);
    const [a, b] = taskProgress(t);
    if ($('t-ico').dataset.k !== info.ico) { $('t-ico').innerHTML = info.ico; $('t-ico').dataset.k = info.ico; }
    $('t-title').textContent = info.title;
    $('t-fill').style.transform = `scaleX(${a / b})`;
    $('t-count').textContent = `${a}/${b}`;
    const done = a >= b;
    $('t-claim').hidden = !done;
    $('t-reward').textContent = t.type === 'all' ? 'Next stand' : '🪙 ' + fmt(t.reward);
    box.classList.toggle('done', done);
    $('btn-ups').classList.toggle('pulse', !done && t.type === 'gup');
  }

  function claimTask() {
    const t = currentTask();
    if (!t) return;
    const [a, b] = taskProgress(t);
    if (a < b) return;
    Save.d.coins += t.reward;
    Sim.LS.task++;
    Sfx.perfect();
    vibrate(20);
    const r = $('t-claim').getBoundingClientRect(), app = $('app').getBoundingClientRect();
    burst(r.left - app.left + r.width / 2, r.top - app.top + r.height / 2, ['✨', '🪙', '⭐']);
    if (t.type === 'all') {
      if (Sim.index + 1 < LOCATIONS.length) Save.d.unlocked = Math.max(Save.d.unlocked, Sim.index + 2);
      Save.save();
      setTimeout(openMap, 500);
    }
    Save.save();
    task();
    hud();
  }

  // Where the guide arrow points for the current task (world coordinates), or null.
  function arrowTarget() {
    const t = currentTask();
    if (!t) return null;
    const [a, b] = taskProgress(t);
    if (a >= b) return null;
    const st = Sim.stations, p = Sim.player;
    const sellPt = { x: LAYOUT.sell.x + LAYOUT.sell.w / 2, y: LAYOUT.sell.y + 8 };
    const above = (s) => ({ x: s.r.cx, y: s.r.cy - 44 });
    if (Sim.LS.cash >= 1 && Save.d.coins < 5 && Sim.LS.served < 3) return { x: LAYOUT.cash.x + 26, y: LAYOUT.cash.y + 4 };
    if (t.type === 'sell') {
      const item = Sim.L.slots[t.slot].item;
      return p.carry.includes(item) ? sellPt : above(st[t.slot]);
    }
    if (t.type === 'serve') return p.carry.length ? sellPt : null;
    if (t.type === 'level' || t.type === 'build') return above(st[t.slot]);
    if (t.type === 'all') { const low = st.filter((x) => x.s.lvl > 0).sort((x, y) => x.s.lvl - y.s.lvl)[0]; return low ? above(low) : null; }
    return null;
  }

  /* ---------- station popup ---------- */
  function openStation(k) {
    popK = k;
    renderPop(true);
    Sfx.tap();
  }
  function closePop() { popK = -1; $('pop').hidden = true; stopHold(); }

  function renderPop(place) {
    if (popK < 0) return;
    const st = Sim.stations[popK], pop = $('pop'), it = ITEMS[st.def.item], s = st.s;
    const nx = Sim.nextSlot();
    let html;
    if (s.lvl > 0) {
      const stars = Eco.stars(s.lvl), next = Eco.nextStar(s.lvl), prev = Eco.prevStar(s.lvl);
      const cost = Eco.upCost(st.def, s.lvl), max = s.lvl >= MAX_LVL;
      const boost = Save.boostOn() ? 2 : 1;
      html = `<span class="lv">LVL ${s.lvl}</span><h3>${itemIcon(st.def.item)} ${it.name}</h3>
        <div class="stars">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < stars ? 'on' : ''}">★</i>`).join('')}</div>
        <div class="mile"><i style="transform:scaleX(${max ? 1 : (s.lvl - prev) / (next - prev)})"></i></div>
        <p class="mile-note">${max ? 'Max level!' : `Next ★ at Lv ${next}: money ×2`}</p>
        <div class="stats"><div><b>🪙 ${fmt(Eco.profit(st.def, s.lvl, Sim.LS.ups) * boost)}</b>per item</div>
          <div><b>⏱ ${Eco.time(st.def, s.lvl, Sim.LS.ups).toFixed(1)}s</b>to grow</div><div><b>📦 ${Eco.cap(s.lvl)}</b>max stock</div></div>
        ${max ? '<button class="btn off" disabled>MAX</button>' : `<button class="btn ${Save.d.coins >= cost ? '' : 'off'}" id="pop-up">⬆ <span>🪙 ${fmt(cost)}</span></button><p class="hold-tip">Hold to upgrade faster</p>`}`;
    } else if (st === nx) {
      const left = Math.ceil(st.def.build - s.paid);
      html = `<span class="lv">NEW STATION</span><h3>${itemIcon(st.def.item)} ${it.name}</h3>
        <p class="mile-note">Stand on the plot to pay little by little, or build it now.</p>
        <div class="stats"><div><b>🪙 ${fmt(Eco.profit(st.def, 1, Sim.LS.ups))}</b>per item</div><div><b>⏱ ${st.def.time}s</b>to grow</div><div><b>📦 6</b>max stock</div></div>
        <button class="btn green ${Save.d.coins >= left ? '' : 'off'}" id="pop-build">Build · 🪙 ${fmt(left)}</button>`;
    } else {
      const prev = Sim.stations.find((x) => x.s.lvl === 0);
      html = `<span class="lv">LOCKED</span><h3>🔒 ${it.name}</h3><p class="mile-note">Build ${ITEMS[prev.def.item].name} first.</p>`;
    }
    pop.innerHTML = html;
    pop.hidden = false;
    if (place) positionPop(st);
    const up = $('pop-up');
    if (up) bindHold(up, () => tryUpgrade());
    const bd = $('pop-build');
    if (bd) bd.onclick = () => {
      if (Sim.buyBuild(popK)) { closePop(); } else { Sfx.error(); toast('Not enough coins yet'); }
    };
  }

  function positionPop(st) {
    const pop = $('pop'), app = $('app').getBoundingClientRect();
    const top = R.w2s(st.r.cx, st.r.y), bot = R.w2s(st.r.cx, st.r.y + st.r.h);
    const w = pop.offsetWidth, ht = pop.offsetHeight;
    let x = Math.max(8, Math.min(app.width - w - 8, top.x - w / 2));
    let y = top.y - ht - 12, cls = 'above';
    if (y < 120) { y = bot.y + 10; cls = 'below'; }
    pop.style.left = x + 'px'; pop.style.top = Math.min(y, app.height - ht - 8) + 'px';
    pop.className = 'pop ' + cls;
    pop.style.setProperty('--tail', Math.max(20, Math.min(w - 20, top.x - x)) + 'px');
  }

  function tryUpgrade() {
    if (popK < 0) return false;
    if (Sim.upgrade(popK)) { renderPop(false); return true; }
    Sfx.error();
    stopHold();
    return false;
  }

  function bindHold(btn, fn) {
    btn.onpointerdown = (e) => {
      e.preventDefault();
      stopHold();
      if (!fn()) return;
      let delay = 320;
      const rep = () => { if (fn()) { delay = Math.max(45, delay * 0.82); holdTimer = setTimeout(rep, delay); } };
      holdTimer = setTimeout(rep, delay);
    };
    btn.onpointerup = btn.onpointerleave = btn.onpointercancel = stopHold;
  }
  function stopHold() { clearTimeout(holdTimer); holdTimer = 0; }
  // The popup re-renders while you hold, so the release is caught on the window.
  window.addEventListener('pointerup', stopHold);
  window.addEventListener('pointercancel', stopHold);

  /* ---------- sheets ---------- */
  function sheet(title, body, onClose) {
    closePop();
    const w = h(`<div class="sheet-wrap"><div class="sheet"><div class="sheet-head"><h2>${title}</h2><button class="sheet-x" aria-label="Close">✕</button></div><div class="sheet-body"></div></div></div>`);
    const close = () => { w.classList.add('out'); setTimeout(() => w.remove(), 200); onClose && onClose(); };
    w.querySelector('.sheet-x').onclick = () => { Sfx.tap(); close(); };
    w.addEventListener('pointerdown', (e) => { if (e.target === w) close(); });
    w.querySelector('.sheet-body').append(body);
    $('sheet-root').append(w);
    return { el: w, close, body: w.querySelector('.sheet-body') };
  }

  function openUpgrades() {
    const body = h('<div style="display:flex;flex-direction:column;gap:10px"></div>');
    const render = () => {
      body.innerHTML = '';
      GUPS.forEach((g) => {
        const lvl = Sim.LS.ups[g.id] || 0, cost = Eco.gupCost(g, lvl, Sim.L);
        const row = h(`<div class="row${cost == null ? ' maxed' : ''}"><div class="r-ico">${g.icon}</div>
          <div><h4>${g.name}</h4><p>${g.desc}</p><div class="lvls">${g.costs.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
          ${cost == null ? '<button class="btn off" disabled>MAX</button>' : `<button class="btn ${Save.d.coins >= cost ? '' : 'off'}">🪙 ${fmt(cost)}</button>`}</div>`);
        const b = row.querySelector('button');
        if (cost != null) b.onclick = () => {
          if (Sim.buyGup(g.id)) { Sfx.coin(); Sfx.happy(); vibrate(15); toast(`${g.icon} ${g.name}!`, 'good'); render(); hud(); task(); Save.save(); }
          else { Sfx.error(); b.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250 }); }
        };
        body.append(row);
      });
    };
    render();
    Sfx.tap();
    sheet('UPGRADES', body);
  }

  function openMap() {
    const body = h('<div class="map"></div>');
    LOCATIONS.forEach((L, i) => {
      const unlocked = i < Save.d.unlocked, here = i === Sim.index;
      const ls = Save.d.locs[L.id];
      const doneCount = ls ? ls.st.filter((s) => s.lvl >= L.goal).length : 0;
      const complete = ls && ls.task >= tasksFor(L).length;
      let goal = `<div class="goal">Goal: <b>every station to Lv ${L.goal}</b> · ${doneCount}/6</div>`;
      if (!unlocked) goal = `<div class="goal">Finish <b>${LOCATIONS[i - 1].name}</b> to unlock</div>`;
      const node = h(`<div class="stop${unlocked ? '' : ' locked'}${here ? ' here' : ''}"><div class="s-ico">${L.iconItem ? itemIcon(L.iconItem, 'ii big') : L.icon}</div>
        <h4>${L.name} ${complete ? '<span class="tick">✓</span>' : ''}</h4><p>${here ? '📍 You are here · ' : ''}${L.blurb}</p>${goal}
        ${unlocked && !here ? `<button class="btn green">Travel here</button>` : ''}</div>`);
      const b = node.querySelector('button');
      if (b) b.onclick = () => { Sfx.whoosh(); s.close(); travel(i); };
      body.append(node);
    });
    Sfx.tap();
    const s = sheet('MAP', body);
    requestAnimationFrame(() => { const here = body.querySelector('.here'); here && here.scrollIntoView({ block: 'center' }); });
  }

  function travel(i) {
    Save.d.cur = i;
    Save.save();
    Sim.load(i);
    hud(); task();
    toast(`${LOCATIONS[i].icon} Welcome to ${LOCATIONS[i].name}!`, 'good');
  }

  function openSettings() {
    const s = Save.d.settings;
    const body = h(`<div style="display:flex;flex-direction:column;gap:10px">
      <label class="toggle"><span>🔊 Sound</span><input type="checkbox" id="st-sound" ${s.sound ? 'checked' : ''}><i></i></label>
      <label class="toggle"><span>📳 Vibration</span><input type="checkbox" id="st-vibe" ${s.vibe ? 'checked' : ''}><i></i></label>
      <div class="card"><b>How to play</b><br>Drag anywhere to walk. Walk onto a station to pick up what it grew, then stand on the green mat to sell to customers. Walk over the cash box to collect coins. Stand on an empty plot to build it. Tap any station to upgrade it.</div>
      <a class="btn soft link-btn" id="st-kitchen" href="../index.html">🍳 Play Pocket Kitchen</a>
      <button class="btn danger" id="st-reset">Reset progress</button></div>`);
    body.querySelector('#st-sound').onchange = (e) => { s.sound = e.target.checked; Sfx.enabled = s.sound; Save.save(); };
    body.querySelector('#st-vibe').onchange = (e) => { s.vibe = e.target.checked; Save.save(); };
    if (window.STANDALONE) body.querySelector('#st-kitchen').remove();
    body.querySelector('#st-reset').onclick = () => {
      modal('Reset progress?', '<p>Coins, stands and upgrades will be cleared.</p>', [
        { label: 'Keep playing', cls: 'green' },
        { label: 'Reset', cls: 'danger', fn: () => { Save.reset(); Save.save(); sh.close(); travel(0); } },
      ]);
    };
    Sfx.tap();
    const sh = sheet('SETTINGS', body);
  }

  function modal(title, html, buttons) {
    const m = h(`<div class="modal"><div class="modal-card"><h2>${title}</h2>${html}<div class="modal-btns"></div></div></div>`);
    buttons.forEach((b) => {
      const btn = h(`<button class="btn ${b.cls || ''}">${b.label}</button>`);
      btn.onclick = () => { Sfx.tap(); m.remove(); b.fn && b.fn(); };
      m.querySelector('.modal-btns').append(btn);
    });
    $('app').append(m);
  }

  function boost() {
    const now = Date.now();
    if (Save.boostOn()) { toast('Boost is running!'); return; }
    if (now < Save.d.boostReady) { Sfx.error(); toast('Boost is recharging'); return; }
    Save.d.boostUntil = now + 90000;
    Save.d.boostReady = now + 90000 + 240000;
    Save.save();
    Sfx.perfect();
    vibrate(25);
    toast('⚡ 2× money for 90 seconds!', 'star');
    hud();
  }

  function tick() {
    hud();
    task();
    if (popK >= 0) renderPop(false);
  }

  return {
    toast, burst, coinsFly, vibrate, hud, task, tick, claimTask, arrowTarget, openStation, closePop,
    openUpgrades, openMap, openSettings, modal, boost, travel,
    get popOpen() { return popK >= 0; },
  };
})();

'use strict';
/* Main: canvas sizing, touch joystick, taps, sounds for game events, the frame loop and saving. */
(() => {
  const cv = $('cv');
  R.init(cv);
  Sfx.enabled = Save.d.settings.sound;
  Sim.load(Math.min(Save.d.cur, Save.d.unlocked - 1));

  function layout() {
    const app = $('app').getBoundingClientRect();
    const hud = $('hud').getBoundingClientRect();
    const dock = $('dock').getBoundingClientRect();
    R.resize(hud.bottom - app.top + 6, app.bottom - dock.top + 4);
  }

  /* ---------- input: floating joystick + taps ---------- */
  let stick = null;
  const RAD = 46;
  const rel = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  cv.addEventListener('pointerdown', (e) => {
    if (stick) return;
    Sfx.init();
    const p = rel(e);
    stick = { id: e.pointerId, x0: p.x, y0: p.y, kx: 0, ky: 0, t0: performance.now(), active: false };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!stick || e.pointerId !== stick.id) return;
    const p = rel(e);
    let dx = p.x - stick.x0, dy = p.y - stick.y0;
    const d = Math.hypot(dx, dy);
    if (!stick.active && d > 10) {
      stick.active = true;
      if (UI.popOpen) UI.closePop();
      if (!Save.d.walked) { Save.d.walked = true; $('walk-hint').hidden = true; }
    }
    if (d > RAD) { dx = (dx / d) * RAD; dy = (dy / d) * RAD; }
    stick.kx = dx; stick.ky = dy;
    Sim.input.x = dx / RAD; Sim.input.y = dy / RAD;
  });
  const end = (e) => {
    if (!stick || e.pointerId !== stick.id) return;
    const wasTap = !stick.active && performance.now() - stick.t0 < 350;
    const p = rel(e);
    stick = null;
    Sim.input.x = 0; Sim.input.y = 0;
    if (wasTap) tap(p.x, p.y);
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  function tap(x, y) {
    const w = R.s2w(x, y);
    const C = LAYOUT.cash;
    if (w.x >= C.x - 8 && w.x <= C.x + C.w + 8 && w.y >= C.y - 16 && w.y <= C.y + C.h + 8) {
      if (Sim.collect() === 0) UI.toast('The cash box is empty');
      return;
    }
    const st = Sim.stationAt(w.x, w.y);
    if (st) { UI.openStation(st.k); return; }
    if (UI.popOpen) UI.closePop();
  }

  // Keyboard for desktop testing
  const keys = new Set();
  const keyVec = () => {
    const x = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    const y = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    if (!stick) { Sim.input.x = x; Sim.input.y = y; }
  };
  window.addEventListener('keydown', (e) => { keys.add(e.key); keyVec(); });
  window.addEventListener('keyup', (e) => { keys.delete(e.key); keyVec(); });

  /* ---------- buttons ---------- */
  $('btn-ups').onclick = () => UI.openUpgrades();
  $('btn-map').onclick = () => UI.openMap();
  $('btn-loc').onclick = () => UI.openMap();
  $('btn-settings').onclick = () => UI.openSettings();
  $('btn-boost').onclick = () => UI.boost();
  $('t-claim').onclick = () => UI.claimTask();
  document.addEventListener('pointerdown', () => Sfx.init(), { capture: true, passive: true });
  document.addEventListener('touchmove', (e) => { if (!e.target.closest('.sheet-body')) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  /* ---------- game events -> feedback ---------- */
  let pickSnd = 0, sellSnd = 0;
  Sim.ev.pick = (isPlayer) => { if (isPlayer && performance.now() - pickSnd > 70) { pickSnd = performance.now(); Sfx.pick(); UI.vibrate(6); } };
  Sim.ev.sell = (isPlayer) => { if (performance.now() - sellSnd > 70 && (isPlayer || Math.random() < 0.3)) { sellSnd = performance.now(); Sfx.drop(); } };
  Sim.ev.drop = (isPlayer) => { if (isPlayer) Sfx.tap(); };
  Sim.ev.pay = () => Sfx.coin();
  Sim.ev.served = () => Sfx.happy();
  Sim.ev.collect = (amt, wx, wy) => { UI.coinsFly(wx, wy, Math.min(10, 3 + Math.floor(Math.log10(amt + 1) * 2))); Sfx.coin(); UI.vibrate(12); UI.hud(); };
  Sim.ev.built = (st) => {
    Sfx.perfect(); UI.vibrate(30);
    const p = R.w2s(st.r.cx, st.r.cy);
    UI.burst(p.x, p.y, ['✨', ITEMS[st.def.item].e, '⭐'], 10);
    UI.toast(`${itemIcon(st.def.item)} ${ITEMS[st.def.item].name} built!`, 'good');
    Save.save();
  };
  Sim.ev.upgraded = (st, star) => {
    const p = R.w2s(st.r.cx, st.r.cy);
    if (star) { Sfx.perfect(); UI.burst(p.x, p.y, ['⭐', '✨'], 10); UI.toast(`★ ${ITEMS[st.def.item].name} star! Money ×2`, 'star'); UI.vibrate(30); }
    else { Sfx.pop(); UI.vibrate(8); }
  };

  /* ---------- welcome back ---------- */
  function welcomeBack() {
    const away = (Date.now() - (Save.d.lastSeen || Date.now())) / 1000;
    const rate = Sim.idleRate();
    if (away < 60 || rate <= 0) return;
    const amt = Math.floor(rate * Math.min(away, 7200));
    if (amt < 1) return;
    const mins = Math.round(Math.min(away, 7200) / 60);
    UI.modal('Welcome back!', `<div class="big">🧑‍🌾</div><p>Your helpers kept the stand open for ${mins} min.</p><p class="amount">🪙 ${fmt(amt)}</p>`,
      [{ label: 'Collect', cls: 'green', fn: () => { Save.d.coins += amt; Save.save(); UI.coinsFly(180, 300, 8); Sfx.coin(); UI.hud(); } }]);
  }

  /* ---------- loop ---------- */
  let last = performance.now(), uiT = 0, saveT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    while (dt > 0) { const s = Math.min(0.034, dt); Sim.update(s); dt -= s; }
    R.frame(now / 1000, { arrow: UI.arrowTarget(), stick: stick && stick.active ? stick : null });
    uiT -= 1; if (uiT <= 0) { uiT = 12; UI.tick(); }
    saveT += 1; if (saveT > 300) { saveT = 0; Save.save(); }
  }

  window.addEventListener('resize', () => { layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Save.save(); else { last = performance.now(); welcomeBack(); } });
  window.addEventListener('pagehide', () => Save.save());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());

  layout();
  UI.hud(); UI.task();
  $('walk-hint').hidden = !!Save.d.walked;
  welcomeBack();
  Save.save();
  requestAnimationFrame(loop);
})();

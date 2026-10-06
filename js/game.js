'use strict';
/* Game: the service loop. Customer arrives -> order -> steps -> serve -> reaction -> reward -> next.
   One requestAnimationFrame loop runs only while the game screen is open. */
const Game = (() => {
  let day = null, raf = 0, last = 0, paused = false;
  let hintFn = null, idle = 0, hintGap = 1;
  let lastSec = -1;

  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  const stage = () => $('stage');

  /* ---------- day lifecycle ---------- */

  function start(level, practice = null) {
    stop();
    const base = levelCfg(level);
    const cfg = practice
      ? { ...base, name: 'Practice', customers: 1, types: ['normal'], recipes: [practice], pace: 1, newRecipe: null }
      : base;
    day = { cfg, level, practice, i: 0, sats: [], served: 0, coins: 0, score: 0, mods: mods(), cust: null, step: null, scope: Scope(), recent: [] };
    UI.show('game');
    $('s-game').classList.toggle('area-beach', cfg.area === 'beach');
    renderDecor();
    resize();
    clearStage();
    $('steps').innerHTML = '';
    $('bubble').className = 'bubble';
    $('cust-slot').innerHTML = '';
    say('Get ready!', '');
    $('hud-time-pill').classList.toggle('hide', !!practice);
    hud();
    paused = false;
    last = performance.now();
    raf = requestAnimationFrame(loop);

    const r = practice ? RECIPES[practice] : null;
    const html = practice
      ? `<div class="intro-dish">${r.emoji}</div><p>${r.blurb}</p><p class="muted">Practice has no timer and no coins. Take your time!</p>`
      : `<div class="intro-dish">${cfg.recipes.filter((id) => RECIPES[id].lvl <= cfg.n).map((id) => RECIPES[id].emoji).join(' ')}${Store.has('hotdog') && cfg.n >= 2 ? ' 🌭' : ''}</div>
         <p>${cfg.desc}</p><p class="muted">👥 ${cfg.customers} customers · ⭐ keep them happy to earn stars</p>`;
    UI.modal({
      title: practice ? 'Practice · ' + r.name : `Level ${cfg.n} · ${cfg.name}`,
      html,
      buttons: [{ label: 'Start cooking ▶', cls: 'btn-play', fn: () => { Sfx.init(); nextCustomer(); } }],
    });
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (day) {
      day.step && day.step.scope.destroy();
      day.scope.destroy();
    }
    day = null;
    hintFn = null;
    Hint.clear();
    Sfx.stopSizzle();
    Input.reset();
  }

  function quit() { stop(); Menu.open(); }

  /* ---------- customers ---------- */

  function nextCustomer() {
    if (!day) return;
    const cfg = day.cfg;
    if (day.i >= cfg.customers) return endDay();
    day.i++;

    let type = day.practice || (cfg.n === 1 && day.i === 1) ? 'normal' : pickOne(cfg.types);
    if (type === 'family' && Math.random() < 0.4) type = 'normal';
    const pool = cfg.recipes.filter((id) => RECIPES[id].lvl <= cfg.n);
    if (!day.practice && Store.has('hotdog') && cfg.n >= 2) pool.push('hotdog');
    let rid = day.practice || (day.i === 1 && cfg.newRecipe) || pickOne(pool);
    if (!day.practice && day.recent.length >= 2 && day.recent.every((x) => x === rid) && pool.length > 1) rid = pickOne(pool.filter((x) => x !== rid));
    day.recent = [...day.recent.slice(-1), rid];

    const recipe = RECIPES[rid];
    const extras = recipe.extras.filter((x) => Store.has(x.id) && Math.random() < 0.5).map((x) => x.id);
    const steps = recipe.build({ level: cfg.n, extras });
    const ct = CTYPES[type];
    const patience = (14 + steps.length * 7.5) * ct.patience * cfg.pace * day.mods.patience;
    const c = Customers.create(type);
    $('cust-slot').innerHTML = '';
    $('cust-slot').append(c.el);
    c.enter();
    day.cust = { type, ct, recipe, extras, steps, patience, left: patience, c, active: false, done: false, qs: [], mistakes: 0, dish: Dish(rid), cook: null, si: 0, impatient: false };
    $('queue-count').textContent = `👥 ${day.i}/${cfg.customers}`;
    clearStage('🛎️ Here comes a customer…');
    $('steps').innerHTML = '';
    say(type === 'normal' ? 'A customer is coming…' : `${ct.badge} ${ct.label} customer!`, '');
    day.scope.later(showOrder, 750);
  }

  function showOrder() {
    const cu = day.cust;
    $('b-dish').textContent = cu.recipe.emoji;
    $('b-name').textContent = cu.recipe.name;
    $('b-extras').textContent = cu.extras.length
      ? 'with ' + cu.extras.map((id) => cu.recipe.extras.find((x) => x.id === id).emoji + ' ' + ING[id === 'cheese' ? 'cheese' : id].name).join(', ')
      : cu.ct.label;
    $('b-type').textContent = cu.ct.badge;
    $('b-react').innerHTML = '';
    $('pat-fill').style.transform = 'scaleX(1)';
    $('bubble').className = 'bubble show' + (day.practice ? ' no-timer' : '');
    Sfx.ding();
    cu.active = !day.practice;
    lastSec = -1;
    if (day.practice) $('hud-time').textContent = '∞';
    $('steps').innerHTML = cu.steps.map((s) => `<i>${STEP_ICON[s.type]}</i>`).join('');
    runStep(0);
  }

  /* ---------- steps ---------- */

  function runStep(i) {
    const cu = day && day.cust;
    if (!cu || cu.done) return;
    if (day.step) day.step.scope.destroy();
    Hint.clear();
    Input.reset();
    Sfx.sizzle(0);
    cu.si = i;
    const def = cu.steps[i];
    const scope = Scope();
    clearStage();
    [...$('steps').children].forEach((n, k) => n.classList.toggle('cur', k === i));
    say(def.text || 'Swipe the dish up to serve!', '');
    const ctx = makeCtx(def, scope, cu);
    const impl = Steps[def.type](ctx, def) || {};
    day.step = { scope, impl, def };
    hintGap = Store.d.seen[def.type] ? 3.5 : 0.8;
    idle = 0;
  }

  function makeCtx(def, scope, cu) {
    const ctx = {
      def, scope, stage: stage(), tray: $('tray'), mods: day.mods, level: day.cfg.n,
      get dish() { return cu.dish; },
      get cook() { return cu.cook; },
      set cook(v) { cu.cook = v; },
      put(node) { stage().append(node); node.classList.add('st-in'); },
      tile(id) {
        const t = el(`<div class="tile" data-id="${id}"><div class="art">${ING[id].art(cu.dish)}</div><span>${ING[id].name}</span></div>`);
        $('tray').append(t);
        return t;
      },
      say,
      hint(fn) { hintFn = fn; idle = 0; Hint.clear(); },
      good(node, pts = 5) {
        const { x, y } = UI.center(node);
        UI.float('+' + pts, x, y - 30, 'f-score');
        addScore(pts);
        UI.bounce(node, 1.05);
      },
      mistake(node, msg) {
        cu.mistakes++;
        UI.shake(node);
        UI.flash(node, 'bad');
        Sfx.error();
        UI.vibrate([20, 40, 20]);
        if (msg) { const { x, y } = UI.center(node); UI.float(msg, x, y - 36, 'f-bad'); }
      },
      done(q, o = {}) {
        if (!scope.alive || ctx.finished) return;
        ctx.finished = true;
        stepDone(cu, def, q, o);
      },
    };
    return ctx;
  }

  function stepDone(cu, def, q, o) {
    if (!day || day.cust !== cu || cu.done) return;
    Store.d.seen[def.type] = true;
    Hint.clear();
    hintFn = null;
    Sfx.sizzle(0);
    if (o.serve) return serve(cu);
    cu.qs.push(q);
    const dot = $('steps').children[cu.si];
    if (dot) dot.className = q >= 0.75 ? 'ok' : q >= 0.5 ? 'meh' : 'bad';
    const pts = q >= 0.95 ? 15 : q >= 0.75 ? 10 : q >= 0.5 ? 5 : 0;
    const { x, y } = UI.center(stage());
    if (o.banner) {
      const label = o.label || (q >= 0.95 ? 'PERFECT!' : q >= 0.75 ? 'GOOD!' : q >= 0.5 ? 'OK!' : 'Oops! 😅');
      UI.banner(label, q >= 0.95 ? 'b-perfect' : q >= 0.75 ? 'b-good' : 'b-bad');
      if (q >= 0.95) { Sfx.perfect(); UI.burst(x, y - 40, ['✨', '⭐'], 8, 90); UI.vibrate(25); }
      else if (q >= 0.75) Sfx.good();
      else Sfx.error();
    } else Sfx.good();
    if (pts) { addScore(pts); if (o.banner) UI.float('+' + pts, x, y + 20, 'f-score'); }
    day.scope.later(() => runStep(cu.si + 1), o.banner ? 800 : 480);
  }

  /* ---------- serving & reactions ---------- */

  function serve(cu) {
    cu.done = true;
    cu.active = false;
    if (day.step) { day.step.scope.destroy(); day.step = null; }
    clearStage('😋 Enjoy your meal!');
    say('Served! 🛎️', '');
    const q = Math.max(0, Math.min(1, avg(cu.qs) - Math.min(0.3, cu.mistakes * 0.05)));
    const speed = day.practice ? 1 : Math.max(0, cu.left / cu.patience);
    const W = cu.ct.weight;
    const sat = Math.max(0, Math.min(100, Math.round(q * 100 * W + speed * 100 * (1 - W) + day.mods.deco)));
    const fast = !day.practice && speed > 0.5;
    const extraBonus = cu.extras.reduce((s, id) => s + cu.recipe.extras.find((x) => x.id === id).bonus, 0);
    let coins = Math.round((cu.recipe.price + extraBonus) * (0.4 + q * 0.8) * cu.ct.tip * day.mods.coins) + (fast ? 3 : 0) + (q >= 0.95 ? 3 : 0);
    if (day.practice) coins = 0;
    const score = Math.round((q * 100 + speed * 60) * (cu.ct.score || 1)) + (fast ? 30 : 0);
    day.sats.push(sat);
    day.served++;

    const b = $('bubble');
    b.classList.add('react');
    $('b-react').innerHTML = `<span class="eating">${cu.recipe.emoji}</span>`;
    cu.c.setMood('eat');
    [0, 330, 660].forEach((t) => day.scope.later(() => Sfx.pop(), t + 120));

    day.scope.later(() => {
      const mood = sat >= 85 ? 'love' : sat >= 65 ? 'happy' : sat >= 40 ? 'meh' : 'angry';
      const face = { love: '😍', happy: '😋', meh: '🙂', angry: '😒' }[mood];
      cu.c.setMood(mood);
      $('b-react').innerHTML = `<span class="face">${face}</span><small>${sat}%</small>`;
      const slot = UI.center($('cust-slot'));
      if (mood === 'love' || mood === 'happy') {
        Sfx.happy();
        UI.burst(slot.x, slot.y - 30, mood === 'love' ? ['❤️', '💖'] : ['✨'], mood === 'love' ? 8 : 5, 80);
      } else if (mood === 'angry') Sfx.sad();
      if (fast) UI.banner('⚡ FAST!', 'b-fast');
      else if (q >= 0.95) UI.banner('🔥 CHEF!', 'b-perfect');

      if (coins > 0) {
        const pill = $('hud-coins-pill');
        const n = Math.min(8, Math.max(3, Math.ceil(coins / 4)));
        for (let k = 0; k < n; k++) {
          UI.fly('<span class="emo coin">🪙</span>', { x: slot.x + (Math.random() - 0.5) * 50, y: slot.y - 20 }, pill,
            { duration: 600, delay: k * 70, scale: 0.6, onEnd: () => { Sfx.coin(); UI.bounce(pill, 1.12); } });
        }
        UI.float(`+${coins} 🪙`, slot.x, slot.y - 60, 'f-coin');
        Store.d.coins += coins;
        Store.save();
        day.coins += coins;
      }
      addScore(score, false);
      UI.float(`+${score} ⭐`, slot.x + 70, slot.y - 30, 'f-score');
      day.scope.later(hud, 700);
      day.scope.later(() => leave(cu), 1700);
    }, 1100);
  }

  function timeout(cu) {
    cu.done = true;
    cu.active = false;
    if (day.step) { day.step.scope.destroy(); day.step = null; }
    Hint.clear();
    hintFn = null;
    Sfx.stopSizzle();
    clearStage('😢 Be quicker next time');
    day.sats.push(0);
    cu.c.setMood('angry');
    cu.c.emote('💢');
    $('bubble').classList.add('react');
    $('b-react').innerHTML = '<span class="face">😠</span><small>Too slow</small>';
    Sfx.sad();
    UI.banner('Too slow! 😢', 'b-bad');
    say('The customer left…', 'Faster next time!');
    hud();
    day.scope.later(() => leave(cu), 1400);
  }

  function leave(cu) {
    $('bubble').className = 'bubble';
    cu.c.leave(() => { if (day && day.cust === cu) day.scope.later(nextCustomer, 250); });
  }

  /* ---------- end of day ---------- */

  function endDay() {
    const cfg = day.cfg;
    const sat = Math.round(avg(day.sats));
    const stars = sat >= 85 ? 3 : sat >= 65 ? 2 : sat >= 40 ? 1 : 0;
    const res = { level: cfg.n, name: cfg.name, practice: day.practice, sat, stars, served: day.served, total: cfg.customers, coins: day.coins, score: day.score };
    if (!day.practice) {
      const d = Store.d;
      res.best = Math.max(d.bestScore[cfg.n] || 0, day.score);
      res.newBest = day.score > (d.bestScore[cfg.n] || 0);
      d.best[cfg.n] = Math.max(d.best[cfg.n] || 0, stars);
      d.bestScore[cfg.n] = res.best;
      if (stars >= 1 && d.level === cfg.n) { d.level = cfg.n + 1; res.unlocked = levelCfg(cfg.n + 1); }
    }
    Store.save();
    stop();
    Menu.results(res);
  }

  /* ---------- per-frame ---------- */

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!day || paused) return;
    const cu = day.cust;
    if (cu && cu.active && !cu.done) {
      cu.left -= dt;
      const f = Math.max(0, cu.left / cu.patience);
      $('pat-fill').style.transform = `scaleX(${f.toFixed(4)})`;
      const s = Math.max(0, Math.ceil(cu.left));
      if (s !== lastSec) {
        lastSec = s;
        $('hud-time').textContent = s;
        $('hud-time-pill').classList.toggle('low', f < 0.25);
        $('bubble').classList.toggle('mid', f < 0.5 && f >= 0.25);
        $('bubble').classList.toggle('low', f < 0.25);
      }
      if (f < 0.35 && !cu.impatient) { cu.impatient = true; cu.c.setMood('impatient'); cu.c.emote('💢'); }
      if (cu.left <= 0) timeout(cu);
    }
    if (day && day.step && day.step.impl.update) day.step.impl.update(dt);
    if (hintFn && Store.d.settings.hints && !Input.busy) {
      idle += dt;
      if (idle >= hintGap) { idle = 0; hintGap = 3.6; try { hintFn(); } catch (e) { /* target gone */ } }
    }
  }

  /* ---------- HUD & helpers ---------- */

  function addScore(n, refresh = true) { day.score += n; if (refresh) hud(); }

  function hud() {
    if (!day) return;
    const sat = day.sats.length ? Math.round(avg(day.sats)) : 100;
    $('hud-sat').textContent = sat + '%';
    $('hud-sat-fill').style.transform = `scaleX(${sat / 100})`;
    $('hud-sat-fill').parentElement.parentElement.classList.toggle('low', sat < 40);
    $('hud-coins').textContent = Store.d.coins;
    $('hud-score').textContent = day.score;
  }

  function say(text, sub) {
    if (text != null) $('say').textContent = text;
    if (sub != null) $('say-sub').textContent = sub;
  }

  function clearStage(msg = '👆 Use your finger in the kitchen above') {
    stage().innerHTML = '';
    $('tray').innerHTML = '';
    $('tray').className = 'tray';
    $('tray').dataset.msg = msg;
  }

  function renderDecor() {
    const s = $('street');
    ['plant', 'lights', 'lantern', 'cat'].forEach((id) => s.classList.toggle('has-' + id, Store.has(id)));
  }

  function resize() {
    const r = stage().getBoundingClientRect();
    if (!r.width) return;
    document.documentElement.style.setProperty('--u', (Math.min(r.width, r.height * 1.15) / 100).toFixed(2) + 'px');
  }

  function pause() {
    if (!day || paused) return;
    paused = true;
    Sfx.stopSizzle();
    Hint.clear();
    UI.modal({
      title: 'Paused',
      html: `<p>Level ${day.cfg.n} · ${day.cfg.name}</p><label class="row-toggle small"><span>🔊 Sound</span><input type="checkbox" id="pause-sound" ${Store.d.settings.sound ? 'checked' : ''}><i></i></label>`,
      buttons: [
        { label: '▶ Resume', cls: 'btn-play', fn: resume },
        { label: '↻ Restart', fn: () => start(day.level, day.practice) },
        { label: '🏠 Menu', fn: quit },
      ],
    });
    const box = $('pause-sound');
    box && box.addEventListener('change', () => { Store.d.settings.sound = box.checked; Sfx.enabled = box.checked; Store.save(); });
  }
  function resume() { paused = false; last = performance.now(); idle = 0; }

  return {
    start, stop, pause, resize,
    poke() { idle = 0; Hint.clear(); },
    get active() { return !!day; },
  };
})();

'use strict';
/* Steps: one interactive mini-game per cooking action.
   Each step gets a ctx from the game (stage, tray, scope, dish, done(), mistake()...) and may
   return { update(dt) } to animate every frame. Quality is reported to ctx.done(q) with q in 0..1. */

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const speedQ = (ms, perfect, good) => (ms <= perfect ? 1 : ms <= good ? 0.8 : 0.6);
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

// Widen a [a, b] zone around its centre (Pro Pan upgrade).
function widen([a, b], k) { const m = (a + b) / 2, h = ((b - a) / 2) * k; return [Math.max(0.05, m - h), Math.min(0.97, m + h)]; }

// Quality for releasing a timing meter at c with a target zone [a, b].
function zoneQ(c, [a, b]) {
  if (c >= a && c <= b) return Math.abs(c - (a + b) / 2) / ((b - a) / 2) < 0.45 ? 1 : 0.8;
  if (c < a) return c > a - 0.12 ? 0.55 : 0.35;
  return c - b < 0.07 ? 0.55 : 0.25;
}

// Timing meter: vertical ('v') or horizontal ('h'), with a green zone and a darker perfect band.
function meter([a, b], dir) {
  const m = el(`<div class="meter ${dir}"><div class="m-zone"></div><div class="m-perfect"></div><div class="m-fill"></div><div class="m-mark"></div></div>`);
  const mid = (a + b) / 2, ph = ((b - a) / 2) * 0.45;
  const [s0, s1] = dir === 'v' ? ['bottom', 'height'] : ['left', 'width'];
  Object.assign(m.querySelector('.m-zone').style, { [s0]: a * 100 + '%', [s1]: (b - a) * 100 + '%' });
  Object.assign(m.querySelector('.m-perfect').style, { [s0]: (mid - ph) * 100 + '%', [s1]: ph * 200 + '%' });
  m.set = (c) => m.style.setProperty('--p', c.toFixed(4));
  m.set(0);
  return m;
}

const Steps = {};

/* DRAG: drag ingredients from the tray onto a pan, grill or the dish. */
Steps.drag = (ctx, def) => {
  let station, target;
  if (def.station === 'pan' || def.station === 'grill') {
    station = def.station === 'pan' ? Art.pan() : Art.grill();
    target = station.querySelector('.' + def.station);
  } else {
    station = el('<div class="st st-dish"></div>');
    station.append(ctx.dish.el);
    target = ctx.dish.el;
  }
  ctx.put(station);
  const need = def.items.slice();
  const ids = [...need, ...(def.decoys || [])];
  if (ids.length > 1) shuffle(ids);
  const tiles = ids.map((id) => ctx.tile(id));
  let mistakes = 0;
  const t0 = now();
  const nextSub = () => def.ordered && need.length > 0 && ctx.say(null, 'Next: ' + ING[need[0]].name);
  nextSub();

  function place(id) {
    if (def.station === 'pan' || def.station === 'grill') {
      const kind = def.station === 'pan' ? 'chicken' : 'sausage';
      const f = Art.food(kind);
      Art.setCook(f, kind, 0);
      target.querySelector('.pan-in, .grill-in').append(f);
      f.animate([{ transform: 'translateY(-60px) scale(1.2)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 300, easing: 'cubic-bezier(.3,1.5,.6,1)' });
      ctx.cook = { kind, el: f, c: 0 };
    } else {
      ctx.dish.add(id);
    }
  }

  tiles.forEach((tile) => Input.drag(ctx.scope, tile, {
    targets: () => [target],
    accept: () => {
      const id = tile.dataset.id;
      const ok = def.ordered ? id === need[0] : need.includes(id);
      if (!ok) {
        mistakes++;
        ctx.mistake(target, need.includes(id) ? 'Not yet!' : 'Not in this order!');
        return false;
      }
      need.splice(need.indexOf(id), 1);
      place(id);
      Sfx.drop();
      UI.vibrate(10);
      ctx.good(target, 5);
      if (!need.length) {
        const n = def.items.length;
        ctx.done(mistakes > 1 ? 0.55 : mistakes ? 0.75 : speedQ(now() - t0, n * 1800 + 900, n * 3600 + 1500));
      } else nextSub();
      return true;
    },
  }));

  ctx.hint(() => Hint.drag(tiles.find((t) => t.dataset.id === need[0] && !t.classList.contains('used')), target));
};

/* HOLD: press and hold to cook (pan) or boil (pot). Release inside the green zone. */
Steps.hold = (ctx, def) => {
  const pot = def.station === 'pot';
  const station = pot ? Art.pot() : Art.pan();
  ctx.put(station);
  const kind = def.food;
  let food;
  if (pot) {
    food = Art.food('noodles');
    const inside = station.querySelector('.pot-in');
    inside.append(food);
    inside.insertAdjacentHTML('beforeend', '<span class="bit" style="left:18%;top:30%">🍄</span><span class="bit" style="left:70%;top:24%">🧄</span>');
    ctx.cook = { kind, el: food, c: 0 };
  } else {
    food = ctx.cook ? ctx.cook.el : Art.food(kind);
    station.querySelector('.pan-in').append(food);
    if (!ctx.cook) ctx.cook = { kind, el: food, c: 0 };
  }
  Art.setCook(food, kind, 0);
  const zone = widen(def.zone, ctx.mods.zone);
  const m = meter(zone, 'v');
  station.append(m);
  const T = def.time / ctx.mods.cook;
  let c = 0, holding = false, finished = false, bubbleT = 0;

  function finish() {
    finished = true; holding = false;
    station.classList.remove('on');
    Sfx.sizzle(0);
    const q = zoneQ(c, zone);
    ctx.cook.c = c;
    ctx.dish.colors[kind] = Art.cookColor(kind, c);
    let label = null;
    if (c >= 0.995) label = pot ? 'Mushy! 😅' : 'Burnt! 😅';
    else if (c > zone[1]) label = 'Overcooked 😅';
    else if (c < zone[0]) label = 'A bit raw 😅';
    ctx.done(q, { banner: true, label });
  }

  Input.press(ctx.scope, ctx.stage, {
    down() {
      if (finished) return;
      holding = true;
      station.classList.add('on');
      UI.vibrate(12);
      ctx.say(null, 'Keep holding… let go in the green!');
    },
    up() {
      if (finished || !holding) return;
      holding = false;
      station.classList.remove('on');
      Sfx.sizzle(0);
      if (c < zone[0] - 0.12) { ctx.say(null, c > 0.03 ? 'Not cooked yet. Hold again!' : 'Press and hold!'); return; }
      finish();
    },
  });

  ctx.hint(() => Hint.hold(station.querySelector(pot ? '.pot' : '.pan')));

  return {
    update(dt) {
      if (!holding || finished) return;
      c = Math.min(1, c + dt / T);
      Art.setCook(food, kind, c);
      m.set(c);
      station.style.setProperty('--heat', Math.min(1, c * 1.4).toFixed(3));
      station.classList.toggle('burning', c > zone[1]);
      if (pot) {
        station.style.setProperty('--boil', c.toFixed(3));
        bubbleT -= dt;
        if (c > 0.25 && bubbleT <= 0) { Sfx.bubble(); bubbleT = 0.35 - c * 0.25; }
      } else Sfx.sizzle(0.3 + c * 0.6);
      if (c >= 1) finish();
    },
  };
};

/* FLIP: a marker swings across a bar. Swipe up when it is in the green. */
Steps.flip = (ctx) => {
  const station = Art.pan();
  ctx.put(station);
  station.classList.add('warm');
  const food = ctx.cook.el;
  station.querySelector('.pan-in').append(food);
  const zh = 0.13 * ctx.mods.zone;
  const zone = [0.5 - zh, 0.5 + zh];
  const bar = meter(zone, 'h');
  bar.classList.add('swing');
  station.append(bar);
  let t = Math.random() * 6, m = 0, done = false;
  const speed = 2.3 + Math.min(1.4, ctx.level * 0.18);

  function flip() {
    done = true;
    const q = zoneQ(m, zone);
    Sfx.flip();
    UI.vibrate(15);
    const off = q < 0.5 ? (Math.random() < 0.5 ? -1 : 1) * 16 : 0;
    const hgt = Math.min(140, ctx.stage.offsetHeight * 0.32);
    if (ctx.cook.kind === 'egg') { ctx.dish.flipped = true; ctx.scope.later(() => food.classList.add('over'), 280); }
    food.animate([
      { transform: 'translateY(0) rotateX(0) scale(1)' },
      { transform: `translateY(${-hgt}px) rotateX(180deg) scale(1.15)`, offset: 0.5 },
      { transform: `translate(${off}px, 0) rotateX(360deg) scale(1)` },
    ], { duration: 620, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }).onfinish = () => {
      Sfx.drop();
      UI.bounce(station.querySelector('.pan'), 1.04);
      ctx.done(q, { banner: true, label: q < 0.5 ? 'Oops! 😅' : null });
    };
  }

  Input.press(ctx.scope, ctx.stage, {
    move(p) { if (!done && p.dy < -40) flip(); },
    up(p) {
      if (done) return;
      if (p.dy < -18) flip();
      else if (Math.abs(p.dy) < 12) ctx.say(null, 'Swipe UP to flip!');
    },
  });
  ctx.hint(() => Hint.swipe(station.querySelector('.pan'), 'up'));

  return { update(dt) { if (done) return; t += dt * speed; m = 0.5 + 0.5 * Math.sin(t); bar.set(m); } };
};

/* SAUCE: swipe across the food to squeeze sauce. Draws a real line where you swipe. */
Steps.sauce = (ctx, def) => {
  const station = el('<div class="st st-dish"></div>');
  station.append(ctx.dish.el);
  ctx.put(station);
  const target = ctx.dish.sauceEl;
  const svg = el(`<svg class="sauce" style="--sauce:${def.color}"><path class="s-main"/><path class="s-hi"/></svg>`);
  target.append(svg);
  const paths = svg.querySelectorAll('path');
  const bottle = el(`<div class="bottle" style="--sauce:${def.color}"><i></i></div>`);
  $('fx').append(bottle);
  ctx.scope.add(() => bottle.remove());
  const bar = el('<div class="sbar"><i></i></div>');
  station.append(bar);
  let d = '', len = 0, last = null, t0 = null, done = false, sq = 0, rect = null;
  const LIFT = 34;

  function add(p) {
    const y = p.y - LIFT;
    bottle.style.transform = `translate3d(${p.x}px, ${y}px, 0)`;
    const r = rect;
    if (p.x < r.left - 6 || p.x > r.right + 6 || y < r.top - 30 || y > r.bottom + 30) { last = null; return; }
    const lx = p.x - r.left, ly = clamp(y - r.top, -r.height * 0.6, r.height * 1.6);
    if (last) {
      const dd = Math.hypot(lx - last.x, ly - last.y);
      if (dd < 3) return;
      len += dd;
      d += `L${lx.toFixed(1)} ${ly.toFixed(1)}`;
    } else d += `M${lx.toFixed(1)} ${ly.toFixed(1)}`;
    last = { x: lx, y: ly };
    paths.forEach((pa) => pa.setAttribute('d', d));
    if (now() - sq > 110) { Sfx.squirt(); sq = now(); }
    const prog = len / (r.width * 2.6);
    bar.style.setProperty('--p', Math.min(1, prog).toFixed(3));
    if (prog >= 1) finish();
  }
  function finish() {
    done = true;
    bottle.remove();
    ctx.done(speedQ(now() - t0, 2600, 4800));
  }

  Input.press(ctx.scope, ctx.stage, {
    down(p) { if (done) return; t0 = t0 || now(); rect = target.getBoundingClientRect(); last = null; bottle.classList.add('on'); add(p); },
    move(p) { if (!done) add(p); },
    up() { last = null; bottle.classList.remove('on'); },
  });
  ctx.hint(() => Hint.swipe(target, 'zigzag'));
};

/* CRACK: tap the egg three times, it splits and drops into the pan. */
Steps.crack = (ctx) => {
  const station = Art.pan();
  ctx.put(station);
  station.classList.add('warm');
  const egg = Art.eggShell();
  station.append(egg);
  let taps = 0, t0 = null, done = false;

  Input.press(ctx.scope, ctx.stage, {
    down(p) {
      if (done) return;
      t0 = t0 || now();
      taps++;
      Sfx.crack();
      UI.vibrate(14);
      egg.classList.add('c' + taps);
      egg.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }], { duration: 260 });
      const { x, y } = UI.center(egg);
      UI.burst(x, y + 10, ['·'], 4, 30);
      if (taps < 3) { ctx.say(null, taps === 1 ? 'Again!' : 'One more!'); return; }
      done = true;
      egg.classList.add('open');
      ctx.scope.later(() => {
        Sfx.splat();
        const f = Art.food('egg');
        Art.setCook(f, 'egg', 0);
        station.querySelector('.pan-in').append(f);
        f.animate([{ transform: 'scale(.3)', opacity: 0.4 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }],
          { duration: 360, easing: 'ease-out' });
        ctx.cook = { kind: 'egg', el: f, c: 0 };
        ctx.scope.later(() => ctx.done(speedQ(now() - t0, 2200, 4000)), 350);
      }, 260);
    },
  });
  ctx.hint(() => Hint.tap(egg, 3));
};

/* TOAST: drag bread into the toaster, then tap to pop it when golden. */
Steps.toast = (ctx) => {
  const station = Art.toaster();
  ctx.put(station);
  const toaster = station.querySelector('.toaster');
  const toast = station.querySelector('.toast-in');
  const zone = widen([0.62, 0.82], ctx.mods.zone);
  const m = meter(zone, 'h');
  m.classList.add('low');
  station.append(m);
  const T = 3.4 / ctx.mods.cook;
  let phase = 0, c = 0, done = false;
  const tile = ctx.tile('bread');

  Input.drag(ctx.scope, tile, {
    targets: () => [toaster],
    accept: () => {
      phase = 1;
      station.classList.add('loaded');
      Sfx.drop();
      ctx.good(toaster, 5);
      ctx.say('Tap anywhere to pop it when golden!', 'Watch the meter');
      ctx.hint(() => Hint.tap(toaster, 1));
      return true;
    },
  });
  function pop() {
    done = true;
    station.classList.add('popped');
    Sfx.pop();
    UI.vibrate(15);
    ctx.dish.colors.toast = Art.cookColor('toast', c);
    ctx.done(zoneQ(c, zone), { banner: true, label: c >= 0.995 ? 'Burnt toast! 😅' : null });
  }
  Input.press(ctx.scope, ctx.stage, { down() { if (phase === 1 && !done && c > 0.05) pop(); } });
  ctx.hint(() => Hint.drag(tile, toaster));

  return {
    update(dt) {
      if (phase !== 1 || done) return;
      c = Math.min(1, c + dt / T);
      Art.setCook(toast, 'toast', c);
      m.set(c);
      if (c >= 1) pop();
    },
  };
};

/* PICK: tap the right ingredients for the soup, avoid the silly ones. */
Steps.pick = (ctx, def) => {
  const station = Art.pot();
  ctx.put(station);
  const water = station.querySelector('.pot-water');
  const inside = station.querySelector('.pot-in');
  const list = el('<div class="checklist"></div>');
  def.items.forEach((id) => list.append(el(`<div class="chk" data-id="${id}"><div class="art">${ING[id].art()}</div><b>✓</b></div>`)));
  station.append(list);
  ctx.tray.classList.add('grid3');
  const tiles = shuffle([...def.items, ...def.decoys]).map((id) => ctx.tile(id));
  const need = new Set(def.items);
  let mistakes = 0, landed = 0;
  const t0 = now();

  tiles.forEach((tile) => Input.press(ctx.scope, tile, {
    down() {
      const id = tile.dataset.id;
      if (tile.classList.contains('used')) return;
      if (!need.has(id)) { mistakes++; ctx.mistake(tile, 'Not in soup!'); return; }
      need.delete(id);
      tile.classList.add('used');
      Sfx.pick();
      UI.fly(`<div class="art fly-art">${ING[id].art()}</div>`, UI.center(tile), water, {
        duration: 480, scale: 0.7,
        onEnd: () => {
          if (!ctx.scope.alive) return;
          Sfx.drop();
          landed++;
          const bit = id === 'noodles' ? Art.food('noodles') : el(`<span class="bit" style="left:${20 + Math.random() * 55}%;top:${18 + Math.random() * 30}%">${ID_EMO[id]}</span>`);
          if (id === 'noodles') Art.setCook(bit, 'noodles', 0);
          inside.append(bit);
          list.querySelector(`[data-id="${id}"]`).classList.add('ok');
          ctx.good(water, 5);
          if (landed === def.items.length) ctx.done(mistakes > 1 ? 0.55 : mistakes ? 0.75 : speedQ(now() - t0, 3600, 6500));
        },
      });
    },
  }));
  ctx.hint(() => Hint.tap(tiles.find((t) => need.has(t.dataset.id) && !t.classList.contains('used')), 1));
};
const ID_EMO = { garlic: '🧄', mushroom: '🍄' };

/* STIR: swipe in circles around the pot. */
Steps.stir = (ctx) => {
  const station = Art.potTop();
  ctx.put(station);
  const swirl = station.querySelector('.pt-swirl');
  const ring = station.querySelector('.ring-fg');
  const pot = station.querySelector('.pt-rim');
  const need = Math.PI * 2 * 3;
  let total = 0, rot = 0, prev = null, t0 = null, done = false, snd = 0, c = null;

  Input.press(ctx.scope, ctx.stage, {
    down() { prev = null; t0 = t0 || now(); c = UI.center(pot); },
    move(p) {
      if (done) return;
      const dx = p.x - c.x, dy = p.y - c.y;
      if (Math.hypot(dx, dy) < 16) { prev = null; return; }
      const a = Math.atan2(dy, dx);
      if (prev !== null) {
        let d = a - prev;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < 1.2) {
          total += Math.abs(d);
          rot += d;
          swirl.style.transform = `rotate(${rot.toFixed(3)}rad)`;
          ring.style.strokeDashoffset = (100 - Math.min(100, (total / need) * 100)).toFixed(1);
          if (total - snd > 1.5) { snd = total; Sfx.swish(); if (Math.random() < 0.5) Sfx.bubble(); }
        }
      }
      prev = a;
      if (total >= need) {
        done = true;
        UI.bounce(pot, 1.05);
        ctx.done(speedQ(now() - t0, 4000, 7000), { banner: true });
      }
    },
    up() { prev = null; },
  });
  ctx.hint(() => Hint.swipe(pot, 'circle'));
};

/* CHOP: tap fast; every tap chops a piece off the scallion. */
Steps.chop = (ctx) => {
  const station = Art.board();
  ctx.put(station);
  const board = station.querySelector('.board');
  const inner = station.querySelector('.board-in');
  const veg = el(`<div class="chopveg">${Art.veg('scallion')}</div>`);
  const pile = el('<div class="pile"></div>');
  const knife = el('<div class="knife">🔪</div>');
  inner.append(veg, pile, knife);
  const N = ctx.mods.chops;
  let n = 0, t0 = null, done = false;

  Input.press(ctx.scope, ctx.stage, {
    down() {
      if (done) return;
      t0 = t0 || now();
      n++;
      const f = n / N;
      veg.style.setProperty('--cut', f.toFixed(3));
      knife.style.left = (8 + 60 * (1 - f * 0.85) - 4) + '%';
      knife.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(45%) rotate(-8deg)' }, { transform: 'translateY(0) rotate(0)' }],
        { duration: 140, easing: 'ease-in' });
      for (let i = 0; i < 3; i++) {
        const pc = el(`<i style="left:${Math.random() * 80}%;top:${Math.random() * 80}%"></i>`);
        pile.append(pc);
        pc.animate([{ transform: 'translate(-40px,-20px) scale(.4)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
      }
      Sfx.chop();
      UI.vibrate(10);
      UI.bounce(board, 1.015);
      if (n >= N) {
        done = true;
        ctx.dish.add('scallion');
        ctx.scope.later(() => ctx.done(speedQ(now() - t0, N * 280 + 450, N * 560 + 1000), { banner: true }), 220);
      }
    },
  });
  ctx.hint(() => Hint.tap(board, 3));
};

/* SLICE: slide a finger down across the vegetable to cut it into even slices. */
Steps.slice = (ctx, def) => {
  const station = Art.board();
  ctx.put(station);
  const box = el(`<div class="slicebox sb-${def.veg}"></div>`);
  station.querySelector('.board-in').append(box);
  const N = ctx.mods.slices;
  const cuts = [];
  let done = false;
  const trail = el('<svg class="trail"><line/></svg>');
  $('fx').append(trail);
  ctx.scope.add(() => trail.remove());
  const line = trail.querySelector('line');

  function render() {
    const edges = [0, ...cuts, 1];
    const k = edges.length - 1;
    box.innerHTML = '';
    for (let i = 0; i < k; i++) {
      const a = edges[i], b = edges[i + 1];
      const piece = el(`<div class="piece" style="clip-path:inset(0 ${((1 - b) * 100).toFixed(2)}% 0 ${(a * 100).toFixed(2)}%)">${Art.veg(def.veg)}</div>`);
      piece.style.transform = `translateX(${((i - (k - 1) / 2) * 7).toFixed(1)}px)`;
      box.append(piece);
    }
  }
  render();

  Input.press(ctx.scope, ctx.stage, {
    down(p) {
      line.setAttribute('x1', p.x); line.setAttribute('y1', p.y);
      line.setAttribute('x2', p.x); line.setAttribute('y2', p.y);
      trail.classList.add('on');
    },
    move(p) { line.setAttribute('x2', p.x); line.setAttribute('y2', p.y); },
    up(p) {
      trail.classList.remove('on');
      if (done) return;
      const r = box.getBoundingClientRect();
      const top = Math.min(p.y0, p.y), bot = Math.max(p.y0, p.y);
      const vertical = Math.abs(p.dy) > Math.abs(p.dx) * 1.3;
      const covers = top <= r.top + r.height * 0.3 && bot >= r.bottom - r.height * 0.3;
      const fx = ((p.x0 + p.x) / 2 - r.left) / r.width;
      if (!vertical || !covers) { if (Math.hypot(p.dx, p.dy) > 12 || p.dt < 250) ctx.say(null, 'Slide all the way down across it!'); return; }
      if (fx < 0.1 || fx > 0.9) { ctx.say(null, 'Cut nearer the middle'); return; }
      if (cuts.some((c) => Math.abs(c - fx) < 0.08)) { ctx.say(null, 'Too close to the last cut'); return; }
      cuts.push(fx);
      cuts.sort((a, b) => a - b);
      render();
      Sfx.slice();
      UI.vibrate(12);
      UI.float('✂', (p.x0 + p.x) / 2, r.top, 'f-cut');
      if (cuts.length >= N) {
        done = true;
        const edges = [0, ...cuts, 1], ideal = 1 / (N + 1);
        const dev = avg(edges.slice(1).map((e, i) => Math.abs(e - edges[i] - ideal) / ideal));
        ctx.done(dev < 0.3 ? 1 : dev < 0.6 ? 0.8 : 0.6, { banner: true, label: dev < 0.3 ? 'Even slices!' : null });
      } else ctx.say(null, `${N - cuts.length} more cut${N - cuts.length > 1 ? 's' : ''}`);
    },
  });
  ctx.hint(() => Hint.swipe(box, 'down'));
};

/* ROLL: the sausage cooks one side at a time. Swipe sideways to roll it when it glows. */
Steps.roll = (ctx) => {
  const station = Art.grill();
  ctx.put(station);
  station.classList.add('on');
  const food = ctx.cook.el;
  station.querySelector('.grill-in').append(food);
  const zone = widen([0.6, 0.86], ctx.mods.zone);
  const m = meter(zone, 'h');
  station.append(m);
  const dots = el('<div class="sides"><i></i><i></i><i></i><i></i></div>');
  station.append(dots);
  const T = 1.8 / ctx.mods.cook;
  const hs = [], qs = [];
  let h = 0, done = false, lock = 0;

  function roll(dir) {
    const q = zoneQ(h, zone);
    hs.push(h); qs.push(q);
    const dot = dots.children[qs.length - 1];
    dot.className = q >= 0.95 ? 'perfect' : q >= 0.75 ? 'good' : 'bad';
    const { x, y } = UI.center(food);
    UI.float(q >= 0.95 ? 'Perfect!' : q >= 0.75 ? 'Good' : h < zone[0] ? 'Too early' : 'Too late', x, y - 30, q >= 0.75 ? 'f-score' : 'f-bad');
    food.animate([{ transform: 'translateX(0) scaleY(1)' }, { transform: `translateX(${dir * 22}px) scaleY(.82)` }, { transform: 'translateX(0) scaleY(1)' }],
      { duration: 280, easing: 'ease-out' });
    food.style.setProperty('--marks', (hs.length / 4).toFixed(2));
    Sfx.swish();
    UI.vibrate(10);
    h = 0;
    lock = 0.25;
    if (hs.length >= 4) {
      done = true;
      station.classList.remove('on');
      Sfx.sizzle(0);
      ctx.dish.colors.sausage = Art.cookColor('sausage', clamp(avg(hs), 0, 1));
      ctx.cook.c = avg(hs);
      ctx.done(avg(qs), { banner: true });
    }
  }

  Input.press(ctx.scope, ctx.stage, {
    down(p) { p.used = false; },
    move(p) { if (!done && !p.used && lock <= 0 && Math.abs(p.dx) > 36 && Math.abs(p.dx) > Math.abs(p.dy)) { p.used = true; roll(Math.sign(p.dx)); } },
  });
  ctx.hint(() => Hint.swipe(station.querySelector('.grill'), 'side'));

  return {
    update(dt) {
      if (done) return;
      lock -= dt;
      h = Math.min(1, h + dt / T);
      m.set(h);
      Art.setCook(food, 'sausage', clamp((hs.reduce((s, v) => s + v, 0) + h) / 4 + 0.15, 0, 1));
      food.classList.toggle('glow', h >= zone[0] && h <= zone[1]);
      station.classList.toggle('burning', h > zone[1]);
      Sfx.sizzle(0.45);
      if (h >= 1) roll(1);
    },
  };
};

/* SERVE: swipe the finished dish up towards the customer. */
Steps.serve = (ctx) => {
  const station = el('<div class="st st-dish st-serve"><div class="shine"></div><div class="serve-arrow">⬆</div></div>');
  station.append(ctx.dish.el);
  ctx.put(station);
  const dish = ctx.dish.el;
  dish.style.transform = '';
  dish.style.visibility = '';
  let done = false;
  Sfx.ding();

  Input.press(ctx.scope, ctx.stage, {
    move(p) {
      if (done) return;
      const dy = Math.min(0, p.dy);
      dish.style.transform = `translateY(${dy}px) scale(${1 + Math.min(0.08, -dy / 1200)})`;
    },
    up(p) {
      if (done) return;
      if (p.dy < -60 || (p.dy < -25 && p.dt < 260)) {
        done = true;
        Sfx.whoosh();
        const from = UI.center(dish);
        const html = dish.outerHTML;
        dish.style.visibility = 'hidden';
        UI.fly(`<div class="fly-dish">${html}</div>`, from, $('cust-slot'), { duration: 480, scale: 0.4, onEnd: () => ctx.done(1, { serve: true }) });
      } else {
        dish.animate([{ transform: dish.style.transform || 'none' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
        dish.style.transform = '';
        if (Math.abs(p.dy) < 12) ctx.say(null, 'Swipe the dish UP to the customer!');
      }
    },
  });
  ctx.hint(() => Hint.swipe(dish, 'up'));
};

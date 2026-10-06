'use strict';
/* Sim: the living stand. Stations grow items, customers queue at the counter, the player and
   helpers carry items around, and coins pile up in the cash box. World units are 360 x 600. */

const LAYOUT = {
  w: 360, h: 600,
  counter: { x: 56, y: 92, w: 236, h: 28 },
  sell: { x: 88, y: 124, w: 176, h: 38 },
  cash: { x: 300, y: 94, w: 52, h: 64 },
  queueY: 76, queueX: [78, 122, 166, 210, 254], streetY: 34,
  slots: [[94, 252], [266, 252], [94, 372], [266, 372], [94, 492], [266, 492]],
  slotW: 116, slotH: 78,
  bounds: { x0: 14, x1: 346, y0: 132, y1: 584 },
};

const LOOKS = {
  skin: ['#ffd9b8', '#f5c49c', '#e3a982', '#c58860', '#9a6440', '#ffe1c6'],
  hair: ['#3a2a22', '#6b4226', '#d9a441', '#26211f', '#b5523b', '#8e8e96', '#f2c46d'],
  shirt: ['#5fb4e5', '#ff8fab', '#7bd389', '#ffb347', '#a28bf0', '#4ecdc4', '#f97d6d', '#ffd166'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

const Sim = (() => {
  let L, LS, li;
  let stations = [], player, helpers = [], customers = [], flyers = [], floaters = [];
  let spawnT = 1, t = 0;
  const input = { x: 0, y: 0 };
  const ev = {}; // event hooks set by the UI

  function mkChar(x, y, look) {
    return { x, y, dir: { x: 0, y: 1 }, moving: false, walkT: 0, carry: [], look, seed: Math.random() * 10, pickT: 0, sellT: 0, dropT: 0 };
  }
  const randomLook = () => ({ skin: pick(LOOKS.skin), hair: pick(LOOKS.hair), shirt: pick(LOOKS.shirt), style: Math.floor(Math.random() * 3) });

  function slotRect(k) {
    const [cx, cy] = LAYOUT.slots[k];
    return { x: cx - LAYOUT.slotW / 2, y: cy - LAYOUT.slotH / 2, w: LAYOUT.slotW, h: LAYOUT.slotH, cx, cy };
  }

  function load(i) {
    li = i;
    L = LOCATIONS[i];
    LS = Save.loc(i);
    stations = L.slots.map((def, k) => ({ def, k, s: LS.st[k], r: slotRect(k), shake: 0 }));
    player = mkChar(180, 300, { skin: '#ffd9b8', hair: '#c4572d', shirt: '#3fae7a', style: 0, hat: '#ff6b4a', apron: true });
    helpers = [];
    customers = [];
    flyers = [];
    floaters = [];
    syncHelpers();
    spawnT = 0.8;
  }

  function syncHelpers() {
    const n = LS.ups.helper || 0;
    while (helpers.length < n) {
      const h = mkChar(180, 560, { ...randomLook(), shirt: '#4d8fe0', hat: '#f2c46d', straw: true });
      h.idx = helpers.length;
      h.think = 0;
      helpers.push(h);
    }
  }

  const ups = () => LS.ups;
  const built = () => stations.filter((st) => st.s.lvl > 0);
  const nextSlot = () => stations.find((st) => st.s.lvl === 0) || null;
  const profitOf = (st) => Eco.profit(st.def, st.s.lvl, LS.ups) * (Save.boostOn() ? 2 : 1);
  const stationFor = (item) => stations.find((st) => st.def.item === item);

  function demand(item, except) {
    let d = 0;
    customers.forEach((c) => { if (c.state === 'wait' && c.want === item) d += c.need - c.got; });
    [player, ...helpers].forEach((h) => { if (h !== except) d -= h.carry.filter((x) => x === item).length; });
    return d;
  }

  /* ---------- movement ---------- */
  function step(c, tx, ty, speed, dt) {
    const dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy);
    if (dist < 2) { c.moving = false; return true; }
    const s = Math.min(dist, speed * dt);
    c.x += (dx / dist) * s; c.y += (dy / dist) * s;
    c.dir = { x: dx / dist, y: dy / dist };
    c.moving = true;
    c.walkT += dt;
    return false;
  }
  function clampToYard(c) {
    const b = LAYOUT.bounds;
    c.x = Math.max(b.x0, Math.min(b.x1, c.x));
    c.y = Math.max(b.y0, Math.min(b.y1, c.y));
  }

  /* ---------- interactions shared by player and helpers ---------- */
  function interact(c, dt, isPlayer) {
    c.pickT -= dt; c.sellT -= dt; c.dropT -= dt;
    const cap = isPlayer ? Eco.carry(LS.ups) : 3 + (LS.ups.basket || 0);
    for (const st of stations) {
      if (st.s.lvl < 1 || !inRect(c.x, c.y, st.r, 6)) continue;
      // feed a machine with its raw input
      if (st.def.kind === 'machine' && c.dropT <= 0 && st.s.input < 12) {
        const i = c.carry.lastIndexOf(st.def.input);
        if (i >= 0) {
          c.carry.splice(i, 1);
          st.s.input++;
          c.dropT = 0.08;
          fly(ITEMS[st.def.input].e, c.x, c.y - 40, st.r.cx - 20, st.r.cy - 10);
          ev.drop && ev.drop(isPlayer);
        }
      }
      // pick up finished items
      const want = isPlayer || (c.job && c.job.k === st.k);
      if (want && c.pickT <= 0 && st.s.stock >= 1 && c.carry.length < cap && (isPlayer || c.carry.length < c.job.n)) {
        st.s.stock--;
        c.carry.push(st.def.item);
        c.pickT = 0.1;
        fly(ITEMS[st.def.item].e, st.r.cx + 30, st.r.cy + 22, c.x, c.y - 40 - c.carry.length * 9);
        ev.pick && ev.pick(isPlayer);
      }
    }
    // sell at the counter
    if (inRect(c.x, c.y, LAYOUT.sell, 4) && c.sellT <= 0 && c.carry.length) {
      for (let i = c.carry.length - 1; i >= 0; i--) {
        const item = c.carry[i];
        const cu = customers.find((q) => q.state === 'wait' && q.want === item && q.got < q.need);
        if (!cu) continue;
        c.carry.splice(i, 1);
        cu.got++;
        cu.pay += profitOf(stationFor(item));
        LS.sold[item] = (LS.sold[item] || 0) + 1;
        c.sellT = 0.11;
        fly(ITEMS[item].e, c.x, c.y - 40, cu.x, cu.y - 30);
        ev.sell && ev.sell(isPlayer);
        break;
      }
    }
  }

  function playerOnly(dt) {
    // pay into the next plot by standing on it
    const nx = nextSlot();
    if (nx && inRect(player.x, player.y, nx.r, 4) && Save.d.coins >= 1) {
      const cost = nx.def.build;
      const rate = Math.max(cost / 1.4, 25);
      const pay = Math.min(Save.d.coins, cost - nx.s.paid, rate * dt);
      Save.d.coins -= pay;
      nx.s.paid += pay;
      player.payT = (player.payT || 0) - dt;
      if (player.payT <= 0) { player.payT = 0.09; fly('🪙', player.x, player.y - 30, nx.r.cx, nx.r.cy); ev.pay && ev.pay(); }
      if (nx.s.paid >= cost - 0.001) buildSlot(nx);
    }
    // empty the cash box
    if (LS.cash >= 1 && inRect(player.x, player.y, LAYOUT.cash, 6)) collect();
  }

  function buildSlot(st) {
    st.s.lvl = 1; st.s.paid = 0; st.s.stock = 0; st.s.prog = 0;
    ev.built && ev.built(st);
  }

  function collect() {
    const amt = Math.floor(LS.cash);
    if (amt < 1) return 0;
    LS.cash -= amt;
    Save.d.coins += amt;
    ev.collect && ev.collect(amt, LAYOUT.cash.x + 26, LAYOUT.cash.y + 20);
    return amt;
  }

  /* ---------- helpers ---------- */
  function plan(h) {
    const cap = 3 + (LS.ups.basket || 0);
    h.job = null;
    if (h.carry.length) {
      const it = h.carry[h.carry.length - 1];
      const mach = stations.find((st) => st.s.lvl > 0 && st.def.kind === 'machine' && st.def.input === it);
      if (mach && demand(it, h) <= 0 && mach.s.input < 12) { h.tx = mach.r.cx; h.ty = mach.r.cy; return; }
      h.tx = LAYOUT.sell.x + 24 + ((h.idx * 52) % 130); h.ty = LAYOUT.sell.y + 22;
      return;
    }
    let best = null, bestScore = 0;
    for (const st of built()) {
      const d = demand(st.def.item, h);
      if (d > 0 && st.s.stock >= 1) {
        const score = d * profitOf(st) / (1 + Math.hypot(st.r.cx - h.x, st.r.cy - h.y) / 200);
        if (score > bestScore) { bestScore = score; best = st; }
      }
    }
    if (best) { h.job = { k: best.k, n: Math.min(cap, Math.max(1, demand(best.def.item, h))) }; h.tx = best.r.cx; h.ty = best.r.cy; return; }
    const mach = built().find((st) => st.def.kind === 'machine' && st.s.input < 4);
    if (mach) {
      const raw = stationFor(mach.def.input);
      if (raw && raw.s.lvl > 0 && raw.s.stock >= 1) { h.job = { k: raw.k, n: Math.min(cap, 4) }; h.tx = raw.r.cx; h.ty = raw.r.cy; return; }
    }
    h.tx = 150 + h.idx * 30; h.ty = 196 + (h.idx % 2) * 14;
  }

  function updateHelper(h, dt) {
    h.think -= dt;
    if (h.think <= 0) { plan(h); h.think = 0.6; }
    step(h, h.tx, h.ty, Eco.speed(LS.ups) * 0.78, dt);
    interact(h, dt, false);
    if (h.job) {
      const st = stations[h.job.k];
      if (h.carry.length >= h.job.n || (inRect(h.x, h.y, st.r, 6) && st.s.stock < 1 && h.carry.length)) h.think = 0;
    }
  }

  /* ---------- customers ---------- */
  function spawnCustomer() {
    const slots = Eco.queue(LS.ups);
    const taken = new Set(customers.filter((c) => c.state !== 'out').map((c) => c.q));
    const free = [...Array(slots).keys()].filter((q) => !taken.has(q));
    const items = built().map((st) => st.def.item);
    if (!free.length || !items.length) return;
    const q = pick(free);
    const side = Math.random() < 0.5 ? -1 : 1;
    const c = mkChar(side < 0 ? -24 : LAYOUT.w + 24, LAYOUT.streetY, randomLook());
    c.q = q;
    c.state = 'in';
    c.want = pick(items);
    c.need = 1 + Math.floor(Math.random() * (2 + Math.min(3, items.length / 2)));
    c.got = 0;
    c.pay = 0;
    c.exit = side < 0 ? LAYOUT.w + 30 : -30;
    c.path = [[LAYOUT.queueX[q], LAYOUT.streetY], [LAYOUT.queueX[q], LAYOUT.queueY]];
    customers.push(c);
  }

  function updateCustomer(c, dt) {
    if (c.path.length) {
      const [tx, ty] = c.path[0];
      if (step(c, tx, ty, 78, dt)) c.path.shift();
    } else if (c.state === 'in') {
      c.state = 'wait'; c.dir = { x: 0, y: 1 }; c.moving = false;
      ev.arrive && ev.arrive(c);
    } else if (c.state === 'out') {
      c.gone = true;
    }
    if (c.state === 'wait' && c.got >= c.need) { c.state = 'happy'; c.happyT = 0.6; }
    if (c.state === 'happy') {
      c.happyT -= dt;
      if (c.happyT <= 0) {
        LS.cash += c.pay;
        LS.served++;
        floaters.push({ text: '+' + fmt(c.pay), x: c.x, y: c.y - 50, t: 0, color: '#ffd23f' });
        c.state = 'out';
        c.heart = 0;
        c.path = [[c.x, LAYOUT.streetY], [c.exit, LAYOUT.streetY]];
        ev.served && ev.served(c);
      }
    }
    if (c.heart !== undefined) c.heart += dt;
  }

  /* ---------- stations ---------- */
  function updateStation(st, dt) {
    const s = st.s;
    if (s.lvl < 1) return;
    const cap = Eco.cap(s.lvl);
    if (s.stock >= cap) { s.prog = 0; return; }
    if (st.def.kind === 'machine') {
      if (s.input < 1) { s.prog = 0; return; }
      st.shake += dt;
    }
    s.prog += dt / Eco.time(st.def, s.lvl, LS.ups);
    if (s.prog >= 1) {
      s.prog = 0;
      s.stock++;
      if (st.def.kind === 'machine') s.input--;
    }
  }

  function fly(e, x0, y0, x1, y1) { if (flyers.length < 40) flyers.push({ e, x0, y0, x1, y1, t: 0 }); }

  function update(dt) {
    t += dt;
    // player
    const m = Math.hypot(input.x, input.y);
    if (m > 0.05) {
      const sp = Eco.speed(LS.ups) * Math.min(1, m);
      player.x += (input.x / m) * sp * dt;
      player.y += (input.y / m) * sp * dt;
      player.dir = { x: input.x / m, y: input.y / m };
      player.moving = true;
      player.walkT += dt;
      clampToYard(player);
    } else player.moving = false;
    interact(player, dt, true);
    playerOnly(dt);

    helpers.forEach((h) => updateHelper(h, dt));
    stations.forEach((st) => updateStation(st, dt));

    spawnT -= dt;
    if (spawnT <= 0) { spawnCustomer(); spawnT = 1.4 + Math.random() * 1.8; }
    customers.forEach((c) => updateCustomer(c, dt));
    customers = customers.filter((c) => !c.gone);

    flyers.forEach((f) => { f.t += dt / 0.28; });
    flyers = flyers.filter((f) => f.t < 1);
    floaters.forEach((f) => { f.t += dt; });
    floaters = floaters.filter((f) => f.t < 1.2);
  }

  /* ---------- player actions from the UI ---------- */
  function upgrade(k) {
    const st = stations[k];
    if (!st || st.s.lvl < 1 || st.s.lvl >= MAX_LVL) return false;
    const cost = Eco.upCost(st.def, st.s.lvl);
    if (Save.d.coins < cost) return false;
    Save.d.coins -= cost;
    const before = Eco.stars(st.s.lvl);
    st.s.lvl++;
    ev.upgraded && ev.upgraded(st, Eco.stars(st.s.lvl) > before);
    return true;
  }
  function buyBuild(k) {
    const st = stations[k];
    if (st !== nextSlot()) return false;
    const need = st.def.build - st.s.paid;
    if (Save.d.coins < need) return false;
    Save.d.coins -= need;
    buildSlot(st);
    return true;
  }
  function buyGup(id) {
    const g = GUPS.find((x) => x.id === id);
    const lvl = LS.ups[id] || 0;
    const cost = Eco.gupCost(g, lvl, L);
    if (cost == null || Save.d.coins < cost) return false;
    Save.d.coins -= cost;
    LS.ups[id] = lvl + 1;
    syncHelpers();
    return true;
  }

  // Rough idle income for "welcome back" earnings: what helpers alone would make.
  function idleRate() {
    const h = LS.ups.helper || 0;
    if (!h) return 0;
    const best = built().map((st) => Eco.profit(st.def, st.s.lvl, LS.ups) / Eco.time(st.def, st.s.lvl, LS.ups));
    const avg = best.reduce((a, b) => a + b, 0) / Math.max(1, best.length);
    return avg * h * 0.35;
  }

  function stationAt(x, y) { return stations.find((st) => inRect(x, y, st.r, 4)) || null; }

  return {
    load, update, upgrade, buyBuild, buyGup, collect, demand, idleRate, stationAt, nextSlot,
    input, ev,
    get L() { return L; }, get LS() { return LS; }, get index() { return li; },
    get stations() { return stations; }, get player() { return player; }, get helpers() { return helpers; },
    get customers() { return customers; }, get flyers() { return flyers; }, get floaters() { return floaters; },
    get time() { return t; },
  };
})();

'use strict';
/* Render: one canvas. The static scene is painted once into an offscreen canvas and reused;
   only moving things (people, crops, coins, bubbles) are drawn each frame. */
const R = (() => {
  let cv, ctx, dpr = 1, sw = 0, sh = 0, scale = 1, ox = 0, oy = 0;
  let bg = null, bgKey = '';
  const emoCache = new Map();
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); }

  function resize(top, bottom) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    sw = cv.clientWidth; sh = cv.clientHeight;
    cv.width = Math.round(sw * dpr); cv.height = Math.round(sh * dpr);
    const availH = sh - top - bottom;
    scale = Math.min(sw / LAYOUT.w, availH / LAYOUT.h);
    ox = (sw - LAYOUT.w * scale) / 2;
    oy = top + (availH - LAYOUT.h * scale) / 2;
    bgKey = '';
  }
  const w2s = (x, y) => ({ x: ox + x * scale, y: oy + y * scale });
  const s2w = (x, y) => ({ x: (x - ox) / scale, y: (y - oy) / scale });

  /* ---------- primitives ---------- */
  function emoSprite(e, px) {
    const key = e + '|' + px;
    let c = emoCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      const s = Math.ceil(px * 1.35);
      c.width = c.height = s;
      const x = c.getContext('2d');
      x.font = `${px}px ${EMOJI_FONT}`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(e, s / 2, s / 2 + px * 0.06);
      if (emoCache.size > 400) emoCache.clear();
      emoCache.set(key, c);
    }
    return c;
  }
  // Draw an emoji centred at world (x, y) with world size `size`.
  // Optional image sprites (see js/sprites.js). Loaded once; emoji are used until an image is ready.
  const sprImg = {};
  const emoToId = {};
  Object.keys(ITEMS).forEach((id) => { emoToId[ITEMS[id].e] = id; });
  Object.entries(typeof SPRITES === 'object' ? SPRITES : {}).forEach(([id, file]) => {
    const im = new Image();
    im.onload = () => { sprImg[id] = im; bgKey = ''; };
    im.src = SPRITE_DIR + file;
  });
  function emo(g, e, x, y, size, alpha = 1) {
    const im = sprImg[emoToId[e]];
    if (im) {
      const s = size * 1.2, k = Math.min(s / im.width, s / im.height);
      if (alpha !== 1) g.globalAlpha = alpha;
      g.drawImage(im, x - (im.width * k) / 2, y - (im.height * k) / 2, im.width * k, im.height * k);
      if (alpha !== 1) g.globalAlpha = 1;
      return;
    }
    const px = Math.max(6, Math.round(size * scale * dpr));
    const c = emoSprite(e, px);
    const w = c.width / (scale * dpr);
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(c, x - w / 2, y - w / 2, w, w);
    if (alpha !== 1) g.globalAlpha = 1;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function fillRR(g, x, y, w, h, r, color) { rr(g, x, y, w, h, r); g.fillStyle = color; g.fill(); }
  function circle(g, x, y, r, color) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill(); }
  function ellipse(g, x, y, rx, ry, color) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = color; g.fill(); }
  function text(g, s, x, y, size, color, stroke, weight = 700) {
    g.font = `${weight} ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = size * 0.28; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = color; g.fillText(s, x, y);
  }

  /* ---------- static scene ---------- */
  function seeded(n) { let s = n; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function paintBg() {
    const L = Sim.L, th = L.theme;
    bg = document.createElement('canvas');
    bg.width = cv.width; bg.height = cv.height;
    const g = bg.getContext('2d');
    g.fillStyle = th.grass; g.fillRect(0, 0, bg.width, bg.height);
    // grass texture over the whole screen
    const rnd = seeded(7 + Sim.index);
    g.fillStyle = th.grass2;
    for (let i = 0; i < 90; i++) { const x = rnd() * bg.width, y = rnd() * bg.height; g.beginPath(); g.ellipse(x, y, 6 * dpr, 3 * dpr, 0, 0, Math.PI * 2); g.fill(); }
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    const C = LAYOUT.counter, SL = LAYOUT.sell, CA = LAYOUT.cash;

    // street or sea along the top
    if (th.sea) {
      g.fillStyle = '#7fd0e6'; g.fillRect(-400, -400, LAYOUT.w + 800, 418);
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2;
      for (let y = -30; y < 14; y += 14) for (let x = -20; x < LAYOUT.w + 20; x += 40) { g.beginPath(); g.arc(x, y, 8, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
      g.fillStyle = '#f6e7bf'; g.fillRect(-400, 18, LAYOUT.w + 800, 46);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-400, 16, LAYOUT.w + 800, 3);
    } else {
      g.fillStyle = th.road; g.fillRect(-400, -400, LAYOUT.w + 800, 452);
      g.fillStyle = 'rgba(255,255,255,.75)';
      for (let x = -400; x < LAYOUT.w + 400; x += 34) g.fillRect(x, 24, 18, 4);
      g.fillStyle = '#d9d4cc'; g.fillRect(-400, 50, LAYOUT.w + 800, 14);
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(-400, 62, LAYOUT.w + 800, 3);
    }
    // stall floor where customers wait
    fillRR(g, 30, 60, 300, 40, 6, '#f6eee0');
    // awning with scallops
    for (let x = 30, i = 0; x < 330; x += 25, i++) {
      g.fillStyle = i % 2 ? '#fff6ea' : th.awning;
      g.fillRect(x, 50, 25, 10);
      g.beginPath(); g.arc(x + 12.5, 60, 12.5, 0, Math.PI); g.fill();
    }
    // counter
    g.fillStyle = 'rgba(0,0,0,.12)'; rr(g, C.x + 2, C.y + 6, C.w, C.h, 6); g.fill();
    fillRR(g, C.x, C.y, C.w, C.h, 6, '#c98b52');
    fillRR(g, C.x, C.y, C.w, 9, 5, '#e2a96b');
    g.strokeStyle = 'rgba(120,70,30,.25)'; g.lineWidth = 1.2;
    for (let x = C.x + 30; x < C.x + C.w; x += 30) { g.beginPath(); g.moveTo(x, C.y + 11); g.lineTo(x, C.y + C.h - 2); g.stroke(); }
    // cash box
    fillRR(g, CA.x + 2, CA.y + 6, CA.w, CA.h - 8, 8, 'rgba(0,0,0,.12)');
    fillRR(g, CA.x, CA.y, CA.w, CA.h - 8, 8, '#8e6a4a');
    fillRR(g, CA.x + 5, CA.y + 5, CA.w - 10, CA.h - 22, 6, '#6e4f35');
    text(g, 'CASH', CA.x + CA.w / 2, CA.y + CA.h - 14, 8, '#ffe8b0');
    // sell mat
    fillRR(g, SL.x, SL.y, SL.w, SL.h, 10, '#88cfa6');
    g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
    rr(g, SL.x + 4, SL.y + 4, SL.w - 8, SL.h - 8, 8); g.stroke(); g.setLineDash([]);
    text(g, 'SELL HERE', SL.x + SL.w / 2, SL.y + SL.h / 2, 11, 'rgba(255,255,255,.95)');
    // yard
    fillRR(g, 6, 172, LAYOUT.w - 12, 424, 18, th.yard);
    g.fillStyle = 'rgba(160,110,60,.08)';
    for (let i = 0; i < 120; i++) { const x = 12 + rnd() * 336, y = 178 + rnd() * 410; g.beginPath(); g.arc(x, y, 1.2 + rnd() * 1.6, 0, Math.PI * 2); g.fill(); }
    fillRR(g, 150, 168, 60, 430, 8, 'rgba(255,255,255,.28)');
    // fence along the top of the yard with a gate gap
    const post = (x, y) => { fillRR(g, x - 3, y - 12, 6, 16, 2, '#fff'); };
    g.fillStyle = '#fff';
    [[10, 144], [216, 350]].forEach(([a, b]) => {
      g.fillRect(a, 160, b - a, 3); g.fillRect(a, 167, b - a, 3);
      for (let x = a; x <= b; x += 22) post(x, 170);
    });
    // station bases
    Sim.stations.forEach((st) => { if (st.s.lvl > 0) paintBase(g, st); });
    // sign at the gate
    fillRR(g, 112, 572, 136, 26, 8, '#9b6b43');
    fillRR(g, 116, 575, 128, 20, 6, '#f6e7c8');
    text(g, Sim.L.name.toUpperCase(), 180, 585, 10.5, '#7a4e2c');
    // flowers along the grass edge
    for (let i = 0; i < 14; i++) {
      const x = rnd() < 0.5 ? -14 - rnd() * 40 : LAYOUT.w + 14 + rnd() * 40;
      emo(g, rnd() < 0.5 ? '🌼' : '🌷', x, 180 + rnd() * 400, 12);
    }
  }

  function paintBase(g, st) {
    const { cx, cy } = st.r, k = st.def.kind;
    g.fillStyle = 'rgba(0,0,0,.1)'; rr(g, cx - 54, cy - 30, 108, 70, 12); g.fill();
    if (k === 'bed') {
      fillRR(g, cx - 54, cy - 34, 108, 66, 12, '#b9814f');
      fillRR(g, cx - 48, cy - 28, 96, 54, 9, '#8d5b3a');
      g.strokeStyle = 'rgba(60,35,20,.35)'; g.lineWidth = 2.5;
      for (const y of [cy - 14, cy, cy + 14]) { g.beginPath(); g.moveTo(cx - 42, y); g.lineTo(cx + 42, y); g.stroke(); }
    } else if (k === 'tree') {
      ellipse(g, cx, cy + 4, 52, 32, 'rgba(70,140,60,.35)');
      fillRR(g, cx - 5, cy - 6, 10, 26, 3, '#8a5a36');
      circle(g, cx - 20, cy - 12, 20, '#5aa64a'); circle(g, cx + 18, cy - 14, 21, '#5aa64a');
      circle(g, cx, cy - 28, 22, '#6cbd57'); circle(g, cx - 4, cy - 18, 18, '#73c55d');
    } else if (k === 'coop') {
      fillRR(g, cx - 54, cy - 30, 108, 62, 12, '#f0cf75');
      fillRR(g, cx - 46, cy - 40, 40, 30, 4, '#e76f51');
      g.fillStyle = '#b54a34'; g.beginPath(); g.moveTo(cx - 50, cy - 38); g.lineTo(cx - 26, cy - 54); g.lineTo(cx - 2, cy - 38); g.fill();
      fillRR(g, cx - 32, cy - 26, 12, 16, 3, '#5a3a26');
    } else if (k === 'barn') {
      fillRR(g, cx - 54, cy - 30, 108, 62, 12, '#c8e39a');
      fillRR(g, cx - 50, cy - 42, 44, 36, 3, '#d64b3c');
      g.fillStyle = '#9e3328'; g.beginPath(); g.moveTo(cx - 54, cy - 40); g.lineTo(cx - 28, cy - 58); g.lineTo(cx - 2, cy - 40); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(cx - 38, cy - 26, 20, 20);
      g.beginPath(); g.moveTo(cx - 38, cy - 26); g.lineTo(cx - 18, cy - 6); g.moveTo(cx - 18, cy - 26); g.lineTo(cx - 38, cy - 6); g.stroke();
    } else if (k === 'hive') {
      fillRR(g, cx - 54, cy - 30, 108, 62, 12, '#cfe6a0');
      fillRR(g, cx - 44, cy - 34, 34, 18, 3, '#f2b632'); fillRR(g, cx - 44, cy - 16, 34, 18, 3, '#e9a21f');
      fillRR(g, cx - 46, cy - 38, 38, 6, 2, '#a86d1b');
    } else if (k === 'machine') {
      fillRR(g, cx - 54, cy - 30, 108, 62, 12, '#d9dee6');
      fillRR(g, cx - 40, cy - 40, 50, 52, 8, '#9aa6b6');
      fillRR(g, cx - 36, cy - 36, 42, 30, 6, '#c9d2de');
      g.fillStyle = '#7f8b9c'; g.beginPath(); g.moveTo(cx - 30, cy - 40); g.lineTo(cx - 4, cy - 40); g.lineTo(cx - 10, cy - 50); g.lineTo(cx - 24, cy - 50); g.fill();
      fillRR(g, cx - 2, cy + 2, 18, 8, 3, '#7f8b9c');
    }
    // tray for finished items
    ellipse(g, cx + 30, cy + 26, 24, 10, 'rgba(0,0,0,.12)');
    ellipse(g, cx + 30, cy + 23, 24, 10, '#ffffff');
    ellipse(g, cx + 30, cy + 23, 17, 6.5, '#eef1f5');
  }

  /* ---------- dynamic layers ---------- */
  const ANIMAL = { coop: '🐔', barn: '🐄', hive: '🐝' };

  function drawStation(g, st, tm) {
    const { cx, cy } = st.r, s = st.s, def = st.def, e = ITEMS[def.item].e;
    const cap = Eco.cap(s.lvl);
    const full = s.stock >= cap;
    const grow = full ? 1 : s.prog;
    if (def.kind === 'bed') {
      [-30, 0, 30].forEach((dx, i) => {
        const gsz = 12 + 10 * Math.min(1, grow + i * 0.15);
        emo(g, '🌱', cx + dx - 10, cy - 8 + (i % 2) * 14, 12);
        emo(g, e, cx + dx + 4, cy - 10 + (i % 2) * 14, gsz * 0.9);
      });
    } else if (def.kind === 'tree') {
      [[-20, -16], [16, -20], [0, -32]].forEach(([dx, dy], i) => emo(g, e, cx + dx, cy + dy, 10 + 6 * Math.min(1, grow + i * 0.2)));
    } else if (def.kind === 'machine') {
      const sh = s.input > 0 && !full ? Math.sin(tm * 40) * 0.8 : 0;
      emo(g, ITEMS[def.input].e, cx - 17 + sh, cy - 22, 16);
      text(g, '×' + s.input, cx - 2 + sh, cy - 6, 9, '#3d2c2a');
      emo(g, e, cx + 2, cy + 18, 14);
    } else {
      const a = ANIMAL[def.kind];
      const hop = Math.abs(Math.sin(tm * 3 + st.k)) * 3;
      emo(g, a, cx + 8 + Math.sin(tm * 0.8 + st.k) * 8, cy - 4 - hop, 20);
      if (def.kind === 'hive') emo(g, '🐝', cx - 30 + Math.cos(tm * 2) * 16, cy - 40 + Math.sin(tm * 3) * 6, 10);
    }
    // stock on the tray
    const shown = Math.min(s.stock, 8);
    for (let i = 0; i < shown; i++) {
      const row = i < 4 ? 0 : 1, col = row ? i - 4 : i;
      emo(g, e, cx + 18 + col * 8 + row * 4, cy + 20 - row * 8, 13);
    }
    if (s.stock > 8) text(g, '×' + s.stock, cx + 46, cy + 8, 9, '#fff', '#3d2c2a');
    // progress bar / full tag
    const bx = cx - 40, by = cy + 38;
    if (full) { fillRR(g, cx - 18, by - 3, 36, 11, 5, '#ff8a3d'); text(g, 'FULL', cx, by + 2.5, 7.5, '#fff'); }
    else if (def.kind !== 'machine' || s.input > 0) {
      fillRR(g, bx, by, 80, 5, 2.5, 'rgba(0,0,0,.15)');
      fillRR(g, bx, by, Math.max(5, 80 * s.prog), 5, 2.5, '#3cc48f');
    } else text(g, 'Bring ' + ITEMS[def.input].e, cx, by + 2, 8, '#fff', '#3d2c2a');
    // level pill
    fillRR(g, cx - 56, cy - 44, 34, 15, 7.5, '#fff');
    text(g, 'Lv ' + s.lvl, cx - 39, cy - 36.5, 8.5, '#3d2c2a');
    // upgrade available badge
    if (s.lvl < MAX_LVL && Save.d.coins >= Eco.upCost(def, s.lvl)) {
      const b = Math.abs(Math.sin(tm * 4)) * 3;
      circle(g, cx + 50, cy - 38 - b, 9, '#2fbf71');
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx + 50, cy - 44 - b); g.lineTo(cx + 55, cy - 37 - b); g.lineTo(cx + 45, cy - 37 - b); g.fill();
      g.fillRect(cx + 48, cy - 37 - b, 4, 5);
    }
  }

  function drawPlot(g, st, isNext, tm) {
    const { x, y, w, h, cx, cy } = st.r;
    g.setLineDash([7, 6]); g.lineWidth = 2.5;
    g.strokeStyle = isNext ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.4)';
    rr(g, x + 6, y + 6, w - 12, h - 12, 12); g.stroke(); g.setLineDash([]);
    if (!isNext) { emo(g, '🔒', cx, cy, 16, 0.5); return; }
    const pulse = 1 + Math.sin(tm * 4) * 0.04;
    fillRR(g, x + 8, y + 8, w - 16, h - 16, 10, 'rgba(255,255,255,.18)');
    if (st.s.paid > 0) { fillRR(g, x + 8, y + 8, (w - 16) * (st.s.paid / st.def.build), h - 16, 10, 'rgba(60,196,143,.35)'); }
    emo(g, ITEMS[st.def.item].e, cx, cy - 8, 26 * pulse, 0.85);
    const left = Math.ceil(st.def.build - st.s.paid);
    fillRR(g, cx - 30, cy + 12, 60, 17, 8.5, Save.d.coins >= 1 ? '#ffcf3f' : '#e7dccd');
    emo(g, '🪙', cx - 18, cy + 20.5, 10);
    text(g, fmt(left), cx + 5, cy + 21, 9.5, '#5a3b16');
  }

  function drawChar(g, c, tm, kind) {
    const lk = c.look;
    const bob = c.moving ? Math.abs(Math.sin(c.walkT * 12)) * 2.2 : Math.sin(tm * 2 + c.seed) * 0.6;
    ellipse(g, c.x, c.y, 10, 4.5, 'rgba(0,0,0,.18)');
    if (c.moving) {
      const f = Math.sin(c.walkT * 12) * 3;
      ellipse(g, c.x - 4, c.y - 1 + f * 0.3, 3, 2.4, '#3d3a44');
      ellipse(g, c.x + 4, c.y - 1 - f * 0.3, 3, 2.4, '#3d3a44');
    }
    const by = c.y - 11 - bob;
    ellipse(g, c.x, by, 9.5, 10, lk.shirt);
    if (lk.apron) fillRR(g, c.x - 5, by - 3, 10, 11, 3, '#fff');
    const sx = c.carry.length ? -7.5 : -9.5;
    circle(g, c.x + sx, by - (c.carry.length ? 6 : 0), 3.2, lk.skin);
    circle(g, c.x - sx, by - (c.carry.length ? 6 : 0), 3.2, lk.skin);
    const hy = c.y - 27 - bob;
    const back = c.dir.y < -0.55;
    circle(g, c.x, hy, 10.5, lk.skin);
    g.fillStyle = lk.hair;
    if (back) { g.beginPath(); g.arc(c.x, hy, 10.8, 0, Math.PI * 2); g.fill(); }
    else {
      g.beginPath(); g.arc(c.x, hy - 1, 10.8, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      if (lk.style === 1) circle(g, c.x, hy - 11, 4.5, lk.hair);
      if (lk.style === 2) { circle(g, c.x - 9, hy - 3, 4, lk.hair); circle(g, c.x + 9, hy - 3, 4, lk.hair); }
      const ex = c.dir.x * 3, ey = Math.max(0, c.dir.y) * 1.5;
      circle(g, c.x - 3.8 + ex, hy + 1 + ey, 1.7, '#2b2222');
      circle(g, c.x + 3.8 + ex, hy + 1 + ey, 1.7, '#2b2222');
      ellipse(g, c.x - 6.5 + ex, hy + 4.5 + ey, 2, 1.2, 'rgba(255,120,120,.45)');
      ellipse(g, c.x + 6.5 + ex, hy + 4.5 + ey, 2, 1.2, 'rgba(255,120,120,.45)');
    }
    if (lk.hat && lk.straw) { ellipse(g, c.x, hy - 7, 14, 4.5, lk.hat); ellipse(g, c.x, hy - 10, 8, 5, lk.hat); }
    else if (lk.hat) { g.fillStyle = lk.hat; g.beginPath(); g.arc(c.x, hy - 3, 11, Math.PI, Math.PI * 2); g.fill(); fillRR(g, c.x - 2 + c.dir.x * 6, hy - 5, 14, 4, 2, lk.hat); }
    // carried stack
    for (let i = 0; i < c.carry.length; i++) emo(g, ITEMS[c.carry[i]].e, c.x, hy - 16 - i * 8.5, 15);
    if (kind === 'cust') drawBubble(g, c, hy, tm);
  }

  function drawBubble(g, c, hy, tm) {
    if (c.state === 'wait' || c.state === 'happy') {
      const done = c.got >= c.need;
      const bx = c.x, byy = hy - 26 + Math.sin(tm * 2.5 + c.seed) * 1.2;
      fillRR(g, bx - 19, byy - 11, 38, 22, 11, '#fff');
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(bx - 4, byy + 10); g.lineTo(bx + 4, byy + 10); g.lineTo(bx, byy + 15); g.fill();
      if (done) text(g, '✓', bx, byy, 13, '#2fbf71');
      else { emo(g, ITEMS[c.want].e, bx - 7, byy, 14); text(g, String(c.need - c.got), bx + 9, byy + 0.5, 11, '#3d2c2a'); }
    }
    if (c.heart !== undefined && c.heart < 1) emo(g, '❤️', c.x + 8, hy - 20 - c.heart * 26, 14, 1 - c.heart);
  }

  function drawArrow(g, x, y, tm) {
    const b = Math.abs(Math.sin(tm * 5)) * 8;
    g.save();
    g.translate(x, y - b);
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#3d2c2a'; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-7, -26); g.lineTo(7, -26); g.lineTo(7, -12); g.lineTo(15, -12); g.lineTo(0, 2); g.lineTo(-15, -12); g.lineTo(-7, -12); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  function frame(tm, opts) {
    const key = [Sim.index, sw, sh, Sim.stations.map((s) => (s.s.lvl > 0 ? 1 : 0)).join('')].join('|');
    if (key !== bgKey) { paintBg(); bgKey = key; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    const g = ctx;
    const nx = Sim.nextSlot();
    Sim.stations.forEach((st) => { if (st.s.lvl > 0) drawStation(g, st, tm); else drawPlot(g, st, st === nx, tm); });
    // coin pile in the cash box
    const cash = Sim.LS.cash, CA = LAYOUT.cash;
    if (cash >= 1) {
      const n = Math.min(9, 1 + Math.floor(Math.log2(cash + 1)));
      for (let i = 0; i < n; i++) emo(g, '🪙', CA.x + 14 + (i % 3) * 12, CA.y + 30 - Math.floor(i / 3) * 6, 13);
      text(g, fmt(cash), CA.x + CA.w / 2, CA.y - 6, 10, '#fff', '#5a3b16');
    }
    // people, sorted by depth
    const people = [
      ...Sim.customers.map((c) => [c, 'cust']), ...Sim.helpers.map((h) => [h, 'helper']), [Sim.player, 'player'],
    ].sort((a, b) => a[0].y - b[0].y);
    people.forEach(([c, k]) => drawChar(g, c, tm, k));
    // items flying between hands, trays and customers
    Sim.flyers.forEach((f) => {
      const k = f.t, x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 22;
      emo(g, f.e, x, y, 14);
    });
    Sim.floaters.forEach((f) => text(g, f.text, f.x, f.y - f.t * 30, 13, f.color, '#5a3b16'));
    if (opts.arrow) drawArrow(g, opts.arrow.x, opts.arrow.y, tm);
    // joystick (screen space)
    if (opts.stick) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = opts.stick;
      circle(ctx, s.x0, s.y0, 46, 'rgba(255,255,255,.28)');
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(s.x0, s.y0, 46, 0, Math.PI * 2); ctx.stroke();
      circle(ctx, s.x0 + s.kx, s.y0 + s.ky, 22, 'rgba(255,255,255,.9)');
    }
  }

  return { init, resize, frame, w2s, s2w, get scale() { return scale; } };
})();

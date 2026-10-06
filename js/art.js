'use strict';
/* Art: tiny HTML/CSS/SVG illustrations for food, cooking stations and finished dishes.
   No image files. Sizes inside the stage scale with the CSS variable --u (1% of the stage). */

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/* Cooking colour ramps: raw -> cooking -> perfect -> overdone -> burnt */
const COOK_RAMP = {
  chicken: ['#f6b5a4', '#efc08f', '#dc9d4b', '#a8622a', '#3b2416'],
  egg:     ['#ece6d8', '#ffffff', '#fffaf0', '#e8c48d', '#6e4320'],
  noodles: ['#eadba8', '#f3e3b6', '#fbefcf', '#efe3c7', '#d2c8b0'],
  sausage: ['#f0a08f', '#e07b5d', '#c4553a', '#913a22', '#3a1a10'],
  toast:   ['#f6e2b8', '#eecb8a', '#d9a259', '#a8692d', '#3a2414'],
};
const RAMP_AT = [0, 0.45, 0.72, 0.88, 1];
const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

function cookColor(kind, c) {
  const s = COOK_RAMP[kind];
  c = Math.max(0, Math.min(1, c));
  let i = 0;
  while (i < RAMP_AT.length - 2 && c > RAMP_AT[i + 1]) i++;
  const t = (c - RAMP_AT[i]) / (RAMP_AT[i + 1] - RAMP_AT[i]);
  const a = hexRgb(s[i]), b = hexRgb(s[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;
}

function noodleSvg(rows = 6) {
  let p = '';
  for (let i = 0; i < rows; i++) {
    const y = 7 + i * (26 / (rows - 1));
    p += `<path d="M${2 + (i % 2) * 6} ${y.toFixed(1)} q6 -6 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0"/>`;
  }
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><g>${p}</g></svg>`;
}

function swirlSvg() {
  let paths = '';
  for (let k = 0; k < 4; k++) {
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = k * Math.PI / 2 + t * Math.PI * 3, r = 6 + t * 36 + Math.sin(t * 40) * 1.6;
      d += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1);
    }
    paths += `<path d="${d}"/>`;
  }
  return `<svg viewBox="-50 -50 100 100">${paths}</svg>`;
}

const FLAMES = '<div class="flames"><i></i><i></i><i></i><i></i><i></i></div>';
const STEAM = '<div class="steam"><i></i><i></i><i></i></div>';

const Art = {
  cookColor,
  emo: (e) => `<span class="emo">${e}</span>`,

  food(kind) {
    switch (kind) {
      case 'chicken': return el('<div class="food f-chicken"><i></i></div>');
      case 'egg': return el('<div class="food f-egg"><div class="egg-white"></div><div class="egg-yolk"></div></div>');
      case 'sausage': return el('<div class="food f-sausage"><i></i><b class="marks"></b></div>');
      case 'noodles': return el(`<div class="food f-noodles">${noodleSvg()}</div>`);
    }
    return el('<div class="food"></div>');
  },
  setCook(node, kind, c) { node.style.setProperty('--c', cookColor(kind, c)); },

  pan: () => el(`<div class="st st-pan"><div class="burner">${FLAMES}</div>
    <div class="pan"><div class="pan-handle"></div><div class="pan-in"></div></div>${STEAM}<div class="smoke">${'<i></i>'.repeat(3)}</div></div>`),

  pot: () => el(`<div class="st st-pot"><div class="burner">${FLAMES}</div>
    <div class="pot"><div class="pot-body"></div><div class="pot-rim"><div class="pot-water"><div class="pot-in"></div>
    <div class="bubbles">${'<i></i>'.repeat(8)}</div></div></div><div class="pot-handle l"></div><div class="pot-handle r"></div></div>${STEAM}</div>`),

  potTop: () => el(`<div class="st st-pottop"><div class="pt-rim"><div class="pt-broth"><div class="pt-swirl">${swirlSvg()}
    <span class="bit" style="--x:-18;--y:-6">🍄</span><span class="bit" style="--x:14;--y:12">🧄</span><span class="bit" style="--x:6;--y:-20">🍄</span></div></div></div>
    <svg class="ring" viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="47"/><circle class="ring-fg" cx="50" cy="50" r="47" pathLength="100"/></svg></div>`),

  grill: () => el(`<div class="st st-grill"><div class="burner">${FLAMES}</div><div class="grill"><div class="grill-in"></div></div>${STEAM}</div>`),

  board: () => el('<div class="st st-board"><div class="board"><div class="board-in"></div></div></div>'),

  toaster: () => el(`<div class="st st-toaster"><div class="toaster"><div class="toast-in"></div>
    <div class="t-body"><div class="slot"></div><div class="t-glow"></div><div class="t-dial"></div></div><div class="lever"></div></div></div>`),

  eggShell: () => el(`<div class="eggshell"><div class="shell"></div>
    <svg class="cracks" viewBox="0 0 100 120"><path pathLength="1" d="M18 58 L32 50 L40 62 L52 48 L60 60 L72 50 L84 58"/>
    <path pathLength="1" d="M40 62 L36 76"/><path pathLength="1" d="M60 60 L66 74"/></svg></div>`),

  veg(kind) {
    if (kind === 'tomato') return '<div class="veg v-tomato"><i></i></div>';
    if (kind === 'pickle') return '<div class="veg v-pickle"></div>';
    return '<div class="veg v-scallion"><i></i></div>';
  },

  layer(id, d) {
    switch (id) {
      case 'bunB': return '<div class="ly ly-bunB"></div>';
      case 'patty': return `<div class="ly ly-patty" style="--c:${d ? d.colors.chicken : '#dc9d4b'}"></div>`;
      case 'cheese': return '<div class="ly ly-cheese"><i></i><i></i></div>';
      case 'lettuce': return '<div class="ly ly-lettuce"></div>';
      case 'tomato': return '<div class="ly ly-tomato"><i></i><i></i></div>';
      case 'bunT': return '<div class="ly ly-bunT"><i></i><i></i><i></i><i></i><i></i></div>';
    }
    return '';
  },
};

/* Ingredient catalogue used by the tray. art(dish) returns HTML. */
const ING = {
  chicken:    { name: 'Chicken',    art: () => '<div class="food f-chicken" style="--c:#f6b5a4"><i></i></div>' },
  bunB:       { name: 'Bottom bun', art: () => Art.layer('bunB') },
  patty:      { name: 'Chicken',    art: (d) => Art.layer('patty', d) },
  cheese:     { name: 'Cheese',     art: () => Art.layer('cheese') },
  lettuce:    { name: 'Lettuce',    art: () => Art.layer('lettuce') },
  tomato:     { name: 'Tomato',     art: () => Art.layer('tomato') },
  bunT:       { name: 'Top bun',    art: () => Art.layer('bunT') },
  egg:        { name: 'Egg',        art: (d) => `<div class="food f-egg${d && d.flipped ? ' over' : ''}" style="--c:${d ? d.colors.egg : '#fff'}"><div class="egg-white"></div><div class="egg-yolk"></div></div>` },
  bread:      { name: 'Bread',      art: () => '<div class="f-toast" style="--c:#f6e2b8"></div>' },
  toast:      { name: 'Toast',      art: (d) => `<div class="f-toast" style="--c:${d ? d.colors.toast : '#d9a259'}"></div>` },
  bacon:      { name: 'Bacon',      art: () => Art.emo('🥓') },
  noodles:    { name: 'Noodles',    art: () => `<div class="f-nest">${noodleSvg(5)}</div>` },
  garlic:     { name: 'Garlic',     art: () => Art.emo('🧄') },
  mushroom:   { name: 'Mushroom',   art: () => Art.emo('🍄') },
  strawberry: { name: 'Strawberry', art: () => Art.emo('🍓') },
  choco:      { name: 'Chocolate',  art: () => Art.emo('🍫') },
  banana:     { name: 'Banana',     art: () => Art.emo('🍌') },
  candy:      { name: 'Candy',      art: () => Art.emo('🍬') },
  eggHalf:    { name: 'Soft egg',   art: () => '<div class="f-egghalf"></div>' },
  naruto:     { name: 'Fish cake',  art: () => Art.emo('🍥') },
  nori:       { name: 'Seaweed',    art: () => '<div class="f-nori"></div>' },
  shrimp:     { name: 'Shrimp',     art: () => Art.emo('🍤') },
  sausage:    { name: 'Sausage',    art: (d) => `<div class="food f-sausage" style="--c:${d ? d.colors.sausage : '#f0a08f'}"><i></i></div>` },
  pickles:    { name: 'Pickles',    art: () => '<div class="f-pickles"><i></i><i></i><i></i></div>' },
};

/* A dish being assembled. It survives between steps so the plate keeps what was added. */
function Dish(kind) {
  const root = el(`<div class="dish dish-${kind}"></div>`);
  const d = {
    kind, el: root, flipped: false, sauceEl: null,
    colors: { chicken: cookColor('chicken', 0.75), egg: cookColor('egg', 0.75), toast: cookColor('toast', 0.75), sausage: cookColor('sausage', 0.75) },
  };
  if (kind === 'burger') root.innerHTML = '<div class="plate"></div><div class="stack"></div>';
  if (kind === 'breakfast') root.innerHTML = '<div class="plate-top"><div class="slots"></div></div>';
  if (kind === 'noodles') root.innerHTML = `<div class="bowl"><div class="broth"><div class="noodles">${noodleSvg(7)}</div><div class="tops"></div></div><div class="bowl-front"></div></div>`;
  if (kind === 'hotdog') root.innerHTML = '<div class="plate"></div><div class="hd"><div class="hd-back"></div><div class="hd-fill"></div><div class="hd-front"></div></div>';

  const drop = (node) => node.animate(
    [{ transform: 'translateY(-50px) scale(1.1)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 280, easing: 'cubic-bezier(.3,1.5,.6,1)' });

  d.add = (id) => {
    let node = null;
    if (kind === 'burger') {
      node = el(Art.layer(id, d));
      root.querySelector('.stack').append(node);
      if (id === 'patty') d.sauceEl = node;
    } else if (kind === 'breakfast') {
      node = el(`<div class="slot-${id}">${ING[id].art(d)}</div>`);
      root.querySelector('.slots').append(node);
      if (id === 'egg') d.sauceEl = node.firstElementChild;
    } else if (kind === 'noodles') {
      node = el(id === 'scallion'
        ? '<div class="top-scallion">' + '<i></i>'.repeat(9) + '</div>'
        : `<div class="top-${id}">${ING[id].art(d)}</div>`);
      root.querySelector('.tops').append(node);
    } else if (kind === 'hotdog') {
      node = el(`<div class="hd-${id}">${ING[id].art(d)}</div>`);
      root.querySelector('.hd-fill').append(node);
      if (id === 'sausage') d.sauceEl = node;
    }
    if (node) drop(node);
  };
  return d;
}

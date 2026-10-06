'use strict';
/* Game state that persists between sessions, plus level and shop definitions (progression). */
const Store = (() => {
  const KEY = 'pocket-kitchen-v1';
  const fresh = () => ({
    coins: 0,
    level: 1,          // highest unlocked level
    best: {},          // level -> best stars
    bestScore: {},     // level -> best score
    owned: {},         // shop item id -> true
    seen: {},          // gesture hints already shown at least once
    settings: { sound: true, vibe: true, hints: true },
  });
  let d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      d = Object.assign(fresh(), saved);
      d.settings = Object.assign(fresh().settings, saved.settings);
    }
  } catch (e) { /* storage blocked: play without saving */ }

  return {
    get d() { return d; },
    has: id => !!d.owned[id],
    save() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } },
    reset() { d = fresh(); this.save(); },
  };
})();

const ALL_TYPES = ['normal', 'impatient', 'foodie', 'slow', 'family', 'vip'];

const LEVELS = [
  { n: 1, name: 'Little Stall', desc: 'Your first day! Cook crispy chicken burgers.', customers: 4,
    types: ['normal', 'normal', 'slow'], recipes: ['burger'], pace: 1.3, area: 'street' },
  { n: 2, name: 'More Ingredients', desc: 'Eggs and toast join the menu.', customers: 5,
    types: ['normal', 'slow', 'foodie'], recipes: ['burger', 'breakfast'], pace: 1.2, area: 'street', newRecipe: 'breakfast' },
  { n: 3, name: 'Chef Specials', desc: 'Noodle bowls arrive, and recipes get extra steps.', customers: 6,
    types: ['normal', 'slow', 'foodie', 'impatient'], recipes: ['burger', 'breakfast', 'noodles'], pace: 1.1, area: 'street', newRecipe: 'noodles' },
  { n: 4, name: 'Rush Hour', desc: 'Customers are in a hurry. VIPs are watching!', customers: 7,
    types: ['normal', 'impatient', 'impatient', 'foodie', 'vip'], recipes: ['burger', 'breakfast', 'noodles'], pace: 0.85, area: 'street' },
  { n: 5, name: 'Seaside Diner', desc: 'A brand new restaurant by the beach. Families welcome!', customers: 8,
    types: ALL_TYPES, recipes: ['burger', 'breakfast', 'noodles'], pace: 0.9, area: 'beach' },
];

function levelCfg(n) {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  const k = n - LEVELS.length;
  return {
    n, name: 'Beach Day ' + (k + 1), desc: 'Endless service. How long can you keep them happy?',
    customers: Math.min(10, 8 + Math.floor(k / 2)), types: ALL_TYPES,
    recipes: ['burger', 'breakfast', 'noodles'], pace: Math.max(0.62, 0.86 - k * 0.04), area: 'beach',
  };
}

const SHOP = [
  { id: 'hotdog',  cat: 'Recipes',     icon: '🌭', name: 'Hot Dog',        cost: 80,  lvl: 2, desc: 'New recipe: roll sausages on the grill.' },
  { id: 'cheese',  cat: 'Ingredients', icon: '🧀', name: 'Cheese Slices',  cost: 30,  lvl: 1, desc: 'Cheeseburger orders pay +4 🪙.' },
  { id: 'bacon',   cat: 'Ingredients', icon: '🥓', name: 'Crispy Bacon',   cost: 50,  lvl: 2, desc: 'Breakfast with bacon pays +5 🪙.' },
  { id: 'shrimp',  cat: 'Ingredients', icon: '🍤', name: 'Tempura Shrimp', cost: 70,  lvl: 3, desc: 'Noodles with shrimp pay +6 🪙.' },
  { id: 'pan',     cat: 'Equipment',   icon: '🍳', name: 'Pro Pan',        cost: 60,  lvl: 1, desc: 'Wider green zones for cooking and flipping.' },
  { id: 'stove',   cat: 'Equipment',   icon: '🔥', name: 'Turbo Stove',    cost: 90,  lvl: 2, desc: 'Food cooks 25% faster.' },
  { id: 'knife',   cat: 'Equipment',   icon: '🔪', name: 'Chef Knife',     cost: 55,  lvl: 2, desc: 'Chop and slice with fewer strokes.' },
  { id: 'bell',    cat: 'Kitchen',     icon: '🛎️', name: 'Service Bell',   cost: 70,  lvl: 1, desc: 'Customers wait 15% longer.' },
  { id: 'tipjar',  cat: 'Kitchen',     icon: '🫙', name: 'Tip Jar',        cost: 110, lvl: 2, desc: '+20% coins from every order.' },
  { id: 'plant',   cat: 'Decor',       icon: '🪴', name: 'Potted Plant',   cost: 25,  lvl: 1, desc: '+3 satisfaction from every customer.' },
  { id: 'lights',  cat: 'Decor',       icon: '✨', name: 'String Lights',  cost: 45,  lvl: 2, desc: '+4 satisfaction. Very cozy.' },
  { id: 'lantern', cat: 'Decor',       icon: '🏮', name: 'Paper Lantern',  cost: 40,  lvl: 3, desc: '+4 satisfaction.' },
  { id: 'cat',     cat: 'Decor',       icon: '🐈', name: 'Lucky Cat',      cost: 150, lvl: 4, desc: '+6 satisfaction and +5% tips.' },
];

/* Upgrade effects, read once per step/day. */
function mods() {
  const h = Store.has;
  return {
    zone: h('pan') ? 1.35 : 1,
    cook: h('stove') ? 1.25 : 1,
    chops: h('knife') ? 4 : 6,
    slices: h('knife') ? 2 : 3,
    patience: h('bell') ? 1.15 : 1,
    coins: (h('tipjar') ? 1.2 : 1) * (h('cat') ? 1.05 : 1),
    deco: (h('plant') ? 3 : 0) + (h('lights') ? 4 : 0) + (h('lantern') ? 4 : 0) + (h('cat') ? 6 : 0),
  };
}

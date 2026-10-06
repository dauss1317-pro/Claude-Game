'use strict';
/* Sunny Stand data: items, locations, global upgrades, tasks and the economy formulas. */

const ITEMS = {
  tomato: { e: '🍅', name: 'Tomatoes' }, lettuce: { e: '🥬', name: 'Lettuce' }, egg: { e: '🥚', name: 'Eggs' },
  carrot: { e: '🥕', name: 'Carrots' }, corn: { e: '🌽', name: 'Corn' }, pumpkin: { e: '🎃', name: 'Pumpkins' },
  apple: { e: '🍎', name: 'Apples' }, orange: { e: '🍊', name: 'Oranges' }, juice: { e: '🧃', name: 'Apple Juice' },
  pear: { e: '🍐', name: 'Pears' }, grapes: { e: '🍇', name: 'Grapes' }, lemon: { e: '🍋', name: 'Lemons' },
  wheat: { e: '🌾', name: 'Wheat' }, milk: { e: '🥛', name: 'Milk' }, bread: { e: '🍞', name: 'Bread' },
  honey: { e: '🍯', name: 'Honey' }, strawberry: { e: '🍓', name: 'Strawberries' }, cheese: { e: '🧀', name: 'Cheese' },
  coconut: { e: '🥥', name: 'Coconuts' }, banana: { e: '🍌', name: 'Bananas' }, smoothie: { e: '🥤', name: 'Smoothies' },
  pineapple: { e: '🍍', name: 'Pineapples' }, mango: { e: '🥭', name: 'Mangoes' }, watermelon: { e: '🍉', name: 'Watermelons' },
};

/* kind: bed (crop rows), coop, tree, barn, hive, machine (turns `input` into `item`) */
const S = (item, kind, base, time, build, up, input) => ({ item, kind, base, time, build, up, input });

const LOCATIONS = [
  { id: 'patch', name: 'Sunny Patch', icon: '🌻', goal: 10, m: 1, blurb: 'A tiny veggie stand by the road.',
    theme: { grass: '#9fd37c', grass2: '#8cc66a', yard: '#ead6aa', road: '#8a93a6', awning: '#ff7a59' },
    slots: [S('tomato', 'bed', 3, 2.4, 0, 5), S('lettuce', 'bed', 6, 3, 40, 20), S('egg', 'coop', 11, 3.6, 180, 70),
      S('carrot', 'bed', 20, 4.2, 600, 220), S('corn', 'bed', 34, 4.8, 1800, 600), S('pumpkin', 'bed', 60, 5.6, 5000, 1500)] },
  { id: 'orchard', name: 'Orchard Lane', icon: '🍎', iconItem: 'apple', goal: 15, m: 12, blurb: 'Fruit trees and a juice press.',
    theme: { grass: '#93cf74', grass2: '#7fbf5f', yard: '#e7d0a0', road: '#8f8aa3', awning: '#e85d75' },
    slots: [S('apple', 'tree', 36, 2.6, 0, 60), S('orange', 'tree', 70, 3.2, 500, 240), S('juice', 'machine', 150, 2.5, 2000, 800, 'apple'),
      S('pear', 'tree', 240, 4.2, 7000, 2600), S('grapes', 'bed', 400, 4.8, 20000, 7000), S('lemon', 'tree', 700, 5.6, 60000, 18000)] },
  { id: 'bakery', name: 'Windmill Bakery', icon: '🍞', iconItem: 'bread', goal: 20, m: 140, blurb: 'Golden wheat, fresh bread and honey.',
    theme: { grass: '#b5d77a', grass2: '#a2c866', yard: '#f0dcae', road: '#9a8f86', awning: '#f2a93b' },
    slots: [S('wheat', 'bed', 420, 2.6, 0, 700), S('milk', 'barn', 800, 3.2, 6000, 2800), S('bread', 'machine', 1800, 2.8, 24000, 9000, 'wheat'),
      S('honey', 'hive', 3000, 4.2, 80000, 30000), S('strawberry', 'bed', 5000, 4.8, 240000, 80000), S('cheese', 'barn', 8000, 5.6, 700000, 220000)] },
  { id: 'beach', name: 'Coconut Cove', icon: '🥥', iconItem: 'coconut', goal: 25, m: 1600, blurb: 'A breezy smoothie kiosk on the sand.',
    theme: { grass: '#8fd6b0', grass2: '#7cc79c', yard: '#f4e3b6', road: '#62b7d6', awning: '#2bb3a3', sea: true },
    slots: [S('coconut', 'tree', 5000, 2.6, 0, 8000), S('banana', 'tree', 9500, 3.2, 70000, 32000), S('smoothie', 'machine', 21000, 2.8, 280000, 100000, 'banana'),
      S('pineapple', 'bed', 35000, 4.2, 900000, 340000), S('mango', 'tree', 60000, 4.8, 2.8e6, 900000), S('watermelon', 'bed', 100000, 5.6, 8e6, 2.4e6)] },
];

const GUPS = [
  { id: 'helper', icon: '🧑‍🌾', name: 'Farm Helper', desc: 'Picks and sells crops for you, even while you are away.', costs: [120, 900, 5000] },
  { id: 'queue',  icon: '👥', name: 'More Customers', desc: 'One more customer can wait at the counter.', costs: [60, 400, 2200] },
  { id: 'basket', icon: '🧺', name: 'Bigger Basket', desc: 'Carry 2 more items per trip.', costs: [80, 500, 2800] },
  { id: 'shoes',  icon: '👟', name: 'Running Shoes', desc: 'Walk 20% faster.', costs: [100, 800] },
  { id: 'soil',   icon: '🌱', name: 'Rich Soil', desc: 'Everything grows 15% faster.', costs: [300, 1800, 8000] },
  { id: 'prices', icon: '🏷️', name: 'Better Prices', desc: '+25% money from every sale.', costs: [500, 3500, 15000] },
];

const STAR_AT = [10, 25, 50, 75, 100];
const MAX_LVL = 100;

const Eco = {
  stars: (lvl) => STAR_AT.filter((s) => lvl >= s).length,
  nextStar: (lvl) => STAR_AT.find((s) => lvl < s) || MAX_LVL,
  prevStar: (lvl) => [0, ...STAR_AT].filter((s) => lvl >= s).pop(),
  upCost: (slot, lvl) => Math.round(slot.up * Math.pow(1.17, lvl - 1)),
  profit: (slot, lvl, ups) => Math.round(slot.base * (1 + (lvl - 1) * 0.35) * Math.pow(2, Eco.stars(lvl)) * Math.pow(1.25, ups.prices || 0)),
  time: (slot, lvl, ups) => slot.time * Math.pow(0.85, Eco.stars(lvl)) * Math.pow(0.85, ups.soil || 0),
  cap: (lvl) => 6 + Eco.stars(lvl) * 2,
  carry: (ups) => 4 + (ups.basket || 0) * 2,
  queue: (ups) => 2 + (ups.queue || 0),
  speed: (ups) => 118 * (1 + (ups.shoes || 0) * 0.2),
  gupCost: (g, lvl, loc) => (lvl < g.costs.length ? g.costs[lvl] * loc.m : null),
};

/* Tasks: a short guided chain per location that ends with the location goal. */
function tasksFor(loc) {
  const t = [
    { type: 'sell', slot: 0, n: 5 }, { type: 'level', slot: 0, n: 5 }, { type: 'build', slot: 1 },
    { type: 'serve', n: 8 }, { type: 'gup', id: 'helper', n: 1 }, { type: 'build', slot: 2 },
    { type: 'level', slot: 1, n: 8 }, { type: 'gup', id: 'basket', n: 1 }, { type: 'build', slot: 3 },
    { type: 'sell', slot: 2, n: 15 }, { type: 'serve', n: 40 }, { type: 'build', slot: 4 },
    { type: 'gup', id: 'queue', n: 1 }, { type: 'level', slot: 3, n: 10 }, { type: 'build', slot: 5 },
    { type: 'all', n: loc.goal },
  ];
  return t.map((x, i) => ({ ...x, reward: Math.round(loc.m * (15 + i * i * 9)) }));
}

function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const u = ['K', 'M', 'B', 'T', 'Qa'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  let s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : String(Math.floor(n));
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s + u[i];
}

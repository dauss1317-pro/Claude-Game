'use strict';
/* Recipes are plain data: each one builds a list of interactive steps for a given order.
   o = { level, extras: ['cheese', ...] } */

const STEP_ICON = {
  drag: '✋', hold: '✊', flip: '⤴', sauce: '〰', crack: '🥚', toast: '🍞', pick: '👆',
  stir: '🌀', chop: '🔪', slice: '🔪', roll: '↔', serve: '🛎️',
};

const RECIPES = {
  burger: {
    id: 'burger', name: 'Chicken Burger', emoji: '🍔', price: 14, lvl: 1,
    blurb: 'Drag, cook, flip and stack a juicy chicken burger.',
    extras: [{ id: 'cheese', emoji: '🧀', bonus: 4 }],
    build(o) {
      const cheese = o.extras.includes('cheese');
      const s = [
        { type: 'drag', station: 'pan', items: ['chicken'], text: 'Drag the chicken onto the pan' },
        { type: 'hold', station: 'pan', food: 'chicken', time: 2.6, zone: [0.62, 0.82], text: 'Hold to cook. Let go in the green!' },
        { type: 'flip', food: 'chicken', text: 'Swipe up to flip on the green!' },
      ];
      if (o.level >= 3) s.push({ type: 'slice', veg: 'tomato', text: 'Slide down across the tomato to slice' });
      s.push(
        { type: 'drag', station: 'dish', items: ['bunB', 'patty'], ordered: true, text: 'Build it: bun first, then chicken' },
        { type: 'sauce', color: '#e5432c', name: 'ketchup', text: 'Swipe over the chicken to add ketchup' },
        { type: 'drag', station: 'dish', items: [...(cheese ? ['cheese'] : []), 'lettuce', 'tomato', 'bunT'], ordered: true,
          decoys: !cheese && Store.has('cheese') ? ['cheese'] : [], text: 'Stack the toppings, top bun last' },
        { type: 'serve' },
      );
      return s;
    },
  },

  breakfast: {
    id: 'breakfast', name: 'Breakfast Plate', emoji: '🍳', price: 16, lvl: 2,
    blurb: 'Crack, fry and flip an egg, then time the toaster.',
    extras: [{ id: 'bacon', emoji: '🥓', bonus: 5 }],
    build(o) {
      const bacon = o.extras.includes('bacon');
      const s = [
        { type: 'crack', text: 'Tap the egg to crack it into the pan' },
        { type: 'hold', station: 'pan', food: 'egg', time: 2.2, zone: [0.6, 0.8], text: 'Hold to fry. Let go in the green!' },
        { type: 'flip', food: 'egg', text: 'Swipe up to flip on the green!' },
        { type: 'toast', text: 'Drag the bread into the toaster' },
        { type: 'drag', station: 'dish', items: ['egg', 'toast', ...(bacon ? ['bacon'] : [])],
          decoys: !bacon && Store.has('bacon') ? ['bacon'] : ['strawberry'], text: 'Arrange the plate' },
      ];
      if (o.level >= 3) s.push({ type: 'sauce', color: '#e5432c', name: 'ketchup', text: 'Swipe over the egg for ketchup' });
      s.push({ type: 'serve' });
      return s;
    },
  },

  noodles: {
    id: 'noodles', name: 'Noodle Bowl', emoji: '🍜', price: 18, lvl: 3,
    blurb: 'Pick ingredients, boil, stir in circles and chop scallions.',
    extras: [{ id: 'shrimp', emoji: '🍤', bonus: 6 }],
    build(o) {
      const shrimp = o.extras.includes('shrimp');
      return [
        { type: 'pick', items: ['noodles', 'garlic', 'mushroom'], decoys: ['strawberry', 'choco', 'candy'], text: 'Tap the soup ingredients' },
        { type: 'hold', station: 'pot', food: 'noodles', time: 2.8, zone: [0.6, 0.82], text: 'Hold to boil. Let go in the green!' },
        { type: 'stir', text: 'Swipe in circles to stir' },
        { type: 'chop', text: 'Tap fast to chop the scallions' },
        { type: 'drag', station: 'dish', items: ['eggHalf', 'naruto', 'nori', ...(shrimp ? ['shrimp'] : [])],
          decoys: ['banana', ...(!shrimp && Store.has('shrimp') ? ['shrimp'] : [])], text: 'Add the toppings' },
        { type: 'serve' },
      ];
    },
  },

  hotdog: {
    id: 'hotdog', name: 'Hot Dog', emoji: '🌭', price: 15, lvl: 2, shop: 'hotdog',
    blurb: 'Roll the sausage at the right time, slice pickles, zigzag mustard.',
    extras: [],
    build() {
      return [
        { type: 'drag', station: 'grill', items: ['sausage'], text: 'Drag the sausage onto the grill' },
        { type: 'roll', text: 'Swipe sideways to roll when it glows' },
        { type: 'slice', veg: 'pickle', text: 'Slide down across the pickle to slice' },
        { type: 'drag', station: 'dish', items: ['sausage', 'pickles'], ordered: true, text: 'Sausage in the bun, then pickles' },
        { type: 'sauce', color: '#f1bf22', name: 'mustard', text: 'Swipe zigzags of mustard' },
        { type: 'serve' },
      ];
    },
  },
};

function recipeUnlocked(id, level) {
  const r = RECIPES[id];
  if (r.shop) return Store.has(r.shop) && level >= r.lvl;
  return level >= r.lvl;
}

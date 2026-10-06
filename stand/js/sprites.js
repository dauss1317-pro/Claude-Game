'use strict';
/* Item sprites: pre-rendered models from Kenney's Food Kit (CC0, www.kenney.nl), 64x64 PNG.
   Each item id from data.js maps to a file in SPRITE_DIR. Items without a file keep their emoji. */
const SPRITE_DIR = 'assets/food/';
const SPRITES = {};
['tomato', 'lettuce', 'egg', 'carrot', 'corn', 'pumpkin', 'apple', 'orange', 'juice', 'pear', 'grapes', 'lemon',
  'milk', 'bread', 'honey', 'strawberry', 'cheese', 'coconut', 'banana', 'smoothie', 'pineapple', 'watermelon']
  .forEach((id) => { SPRITES[id] = id + '.png'; });

// HTML icon for an item: the sprite when there is one, otherwise the emoji.
function itemIcon(id, cls = 'ii') {
  return SPRITES[id] ? `<img class="${cls}" src="${SPRITE_DIR + SPRITES[id]}" alt="">` : ITEMS[id].e;
}

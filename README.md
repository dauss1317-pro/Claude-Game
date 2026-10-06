# Pocket Kitchen & Sunny Stand

Two lightweight mobile games in one repo:

- **Pocket Kitchen** (`index.html`): hands-on cooking with touch gestures.
- **Sunny Stand** (`stand/index.html`): an idle farm-stand tycoon where you walk around, harvest, sell and upgrade.

## Pocket Kitchen

A lightweight, mobile-first casual cooking game. You run a small food stall: customers walk up, order, and you cook every dish with touch gestures (drag, hold and release, swipe, circle-stir, chop, slice, roll), then swipe the dish up to serve it.

No frameworks, no build step, no image or audio files. Food, stations and customers are drawn with CSS and inline SVG, and sounds are synthesized with WebAudio. The whole game is about 150 KB uncompressed (about 42 KB gzipped).

## Play

Open `index.html` in a browser. It works straight from the file system, or from any static host such as GitHub Pages or Netlify. On a phone, use "Add to Home Screen" to get a full-screen app.

For local testing on a phone over Wi-Fi:

```sh
python3 -m http.server 8000
# then open http://<your-computer-ip>:8000 on the phone
```

## Gameplay

- **Loop:** a customer arrives, the order appears, you cook it step by step and serve it. The customer reacts, you earn coins and score, and the next customer arrives. The day ends with a results screen (satisfaction, coins, score, 1–3 stars).
- **Patience timer:** each customer has a patience bar. Faster service means happier customers and a ⚡ FAST bonus.
- **Quality:** timing steps are graded PERFECT, GOOD, OK or Oops. Mistakes (wrong ingredient, wrong order) lower quality.
- **Customers:** Regular 😊, In a hurry ⚡, Food lover 🤩, Easygoing 😴, Family 👨‍👩‍👧, VIP ⭐. Each type has different patience, tips and pickiness.

| Recipe | Mechanics |
| --- | --- |
| 🍔 Chicken Burger | drag chicken to pan, hold to cook, swipe-up flip timing, ordered stacking, swipe to draw ketchup |
| 🍳 Breakfast Plate | tap to crack egg, hold to fry, flip, drag bread into toaster then tap to pop when golden, arrange plate |
| 🍜 Noodle Bowl | tap the right ingredients (avoid decoys), hold to boil, circular swipe to stir, rapid-tap chop, add toppings |
| 🌭 Hot Dog (shop) | drag to grill, swipe to roll each side at the right time, slide-to-slice pickle, mustard zigzag |

**Levels:** 1 Little Stall · 2 More Ingredients (breakfast) · 3 Chef Specials (noodles, extra slicing steps) · 4 Rush Hour (impatient customers and VIPs) · 5 Seaside Diner (new area, families) · then endless beach days.

**Upgrades (coins):** a new recipe, extra ingredients (cheese, bacon, shrimp), equipment (Pro Pan, Turbo Stove, Chef Knife), kitchen upgrades (Service Bell, Tip Jar) and decorations that appear in the stall and raise satisfaction.

Progress is saved in `localStorage`.

## Code layout

| File | Responsibility |
| --- | --- |
| `js/audio.js` | Synthesized sound effects (`Sfx`) |
| `js/state.js` | Saved progress (`Store`), level config, shop items, upgrade effects (`mods`) |
| `js/art.js` | CSS/SVG food, stations and the `Dish` being assembled |
| `js/recipes.js` | Recipe data: each recipe builds a list of steps for an order |
| `js/customers.js` | Customer personalities and generated SVG characters with moods |
| `js/ui.js` | Screens, floating rewards, banners, particles, modal, gesture hints |
| `js/input.js` | Pointer helpers (press, drag with lifted ghost) and listener `Scope` |
| `js/steps.js` | One function per mini-game: drag, hold, flip, sauce, crack, toast, pick, stir, chop, slice, roll, serve |
| `js/game.js` | Day and customer loop, scoring, patience, HUD, single `requestAnimationFrame` loop |
| `js/main.js` | Menus (main, recipes, upgrades, settings, results) and boot |

To add a recipe, add an entry to `RECIPES` in `js/recipes.js` that returns a list of steps using the existing step types.

## Sunny Stand

Open `stand/index.html`. Drag anywhere on the screen to walk (a floating joystick appears under your finger).

- **Harvest:** walk onto a station to pick up what it grew. Items stack above your head.
- **Sell:** stand on the green mat. Customers at the counter take the items their bubbles ask for. Coins pile up in the cash box; walk over it or tap it to collect.
- **Build:** stand on the next empty plot and your coins pour into it until it is built (or tap it and press Build).
- **Upgrade:** tap a station to see its level, stars, profit, grow time and stock. Hold the upgrade button to buy levels quickly. Stars at levels 10, 25, 50, 75 and 100 double the money.
- **Upgrades sheet:** Farm Helpers (they harvest and sell for you, and earn while you are away), More Customers, Bigger Basket, Running Shoes, Rich Soil, Better Prices.
- **Tasks:** a guided chain at the top with a pointer arrow and coin rewards. The last task is the stand's goal (every station to a target level) and unlocks the next stand on the map.
- **Map:** Sunny Patch, Orchard Lane (juice press), Windmill Bakery (bread oven), Coconut Cove (smoothie blender). Machines turn a raw crop into a pricier product.
- **2× Boost:** free double money for 90 seconds, then a 4-minute recharge.

Art is drawn on one canvas (crops and food use emoji). To use image sprites instead, for example the CC0 renders from [Kenney's Food Kit](https://kenney.nl/assets/food-kit), put PNGs in `stand/assets/food/` and map item ids to file names in `stand/js/sprites.js`.

| File | Responsibility |
| --- | --- |
| `stand/js/data.js` | Items, locations, global upgrades, tasks, economy formulas |
| `stand/js/save.js` | Saved progress per location |
| `stand/js/sim.js` | Stations, customers, helpers, carrying, selling and building |
| `stand/js/render.js` | Canvas drawing with a cached static background |
| `stand/js/ui.js` | HUD, task tracker, station popup, sheets, modals |
| `stand/js/main.js` | Joystick and taps, game event feedback, frame loop, saving |
| `stand/js/sprites.js` | Optional item image sprites |

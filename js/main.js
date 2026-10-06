'use strict';
/* Menus (main, recipes, upgrades, settings, results) and app boot. */
const Menu = (() => {
  let pickLevel = 1;
  let lastResult = null;

  function coins() { document.querySelectorAll('[data-coins]').forEach((n) => { n.textContent = Store.d.coins; }); }

  function open(name = 'menu') {
    Game.stop();
    coins();
    if (name === 'menu') renderMenu();
    if (name === 'recipes') renderRecipes();
    if (name === 'shop') renderShop();
    if (name === 'settings') renderSettings();
    UI.show(name);
  }

  /* ---------- main menu ---------- */
  function renderMenu() {
    const max = Store.d.level;
    pickLevel = Math.min(pickLevel > 1 ? pickLevel : max, max);
    const count = Math.max(5, max);
    const row = $('level-row');
    row.innerHTML = '';
    for (let n = 1; n <= count; n++) {
      const stars = Store.d.best[n] || 0;
      const locked = n > max;
      const b = el(`<button class="lvl${locked ? ' locked' : ''}${n === pickLevel ? ' sel' : ''}" ${locked ? 'disabled' : ''} aria-label="Level ${n}">
        <b>${locked ? '🔒' : n}</b><small>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</small></button>`);
      b.addEventListener('click', () => { Sfx.tap(); pickLevel = n; renderMenu(); });
      row.append(b);
    }
    const sel = row.querySelector('.sel');
    sel && sel.scrollIntoView({ inline: 'center', block: 'nearest' });
    $('play-sub').textContent = `Level ${pickLevel} · ${levelCfg(pickLevel).name}`;
  }

  function chef() {
    const svg = `<svg viewBox="0 -14 100 146">${Customers.figure({ skin: '#ffdcbf', hair: '#6b4226', shirt: '#ffffff', style: 0, type: 'chef', kid: false, x: 0, s: 1 })}
      <g><path d="M27 34 Q14 18 30 12 Q34 -6 50 -2 Q66 -6 70 12 Q86 18 73 34Z" fill="#fff" stroke="#eadfd2" stroke-width="2"/><rect x="28" y="26" width="44" height="11" rx="4" fill="#fff" stroke="#eadfd2" stroke-width="2"/></g>
      <path d="M44 100 h12 l-6 8z" fill="#ff6f61"/></svg>`;
    $('menu-chef').innerHTML = `<div class="cust mood-happy">${svg}</div>`;
  }

  /* ---------- recipes ---------- */
  function renderRecipes() {
    const list = $('recipe-list');
    list.innerHTML = '';
    Object.values(RECIPES).forEach((r) => {
      const unlocked = recipeUnlocked(r.id, Store.d.level);
      const canPractice = !r.shop || Store.has(r.shop);
      const icons = [...new Set(r.build({ level: 9, extras: [] }).map((s) => s.type))].map((t) => `<i title="${t}">${STEP_ICON[t]}</i>`).join('');
      const status = unlocked ? `<span class="tag ok">On the menu</span>`
        : r.shop ? `<span class="tag">Buy in Upgrades · 🪙 ${SHOP.find((s) => s.id === r.shop).cost}</span>`
          : `<span class="tag">Unlocks at Level ${r.lvl}</span>`;
      const card = el(`<div class="card recipe${unlocked ? '' : ' dim'}">
        <div class="r-emoji">${r.emoji}</div>
        <div class="r-body"><h3>${r.name}</h3><p>${r.blurb}</p><div class="r-icons">${icons}</div>${status}</div>
        <button class="btn btn-small" ${canPractice ? '' : 'disabled'}>Practice</button></div>`);
      card.querySelector('button').addEventListener('click', () => { Sfx.tap(); Game.start(Math.max(r.lvl, 1), r.id); });
      list.append(card);
    });
  }

  /* ---------- shop ---------- */
  function renderShop() {
    const list = $('shop-list');
    list.innerHTML = '';
    const cats = [...new Set(SHOP.map((s) => s.cat))];
    cats.forEach((cat) => {
      list.append(el(`<h3 class="cat">${cat}</h3>`));
      SHOP.filter((s) => s.cat === cat).forEach((it) => {
        const owned = Store.has(it.id);
        const locked = Store.d.level < it.lvl;
        const poor = Store.d.coins < it.cost;
        const label = owned ? 'Owned ✓' : locked ? `🔒 Level ${it.lvl}` : `🪙 ${it.cost}`;
        const card = el(`<div class="card item${owned ? ' owned' : ''}">
          <div class="i-icon">${it.icon}</div>
          <div class="i-body"><h4>${it.name}</h4><p>${it.desc}</p></div>
          <button class="btn btn-small${poor && !owned && !locked ? ' poor' : ''}" ${owned || locked ? 'disabled' : ''}>${label}</button></div>`);
        const btn = card.querySelector('button');
        btn.addEventListener('click', () => {
          if (Store.d.coins < it.cost) {
            Sfx.error(); UI.shake(btn);
            const { x, y } = UI.center(btn);
            UI.float(`Need ${it.cost - Store.d.coins} more 🪙`, x - 40, y - 20, 'f-bad');
            return;
          }
          Store.d.coins -= it.cost;
          Store.d.owned[it.id] = true;
          Store.save();
          Sfx.coin(); Sfx.happy();
          const { x, y } = UI.center(btn);
          UI.burst(x, y, ['✨', '🪙'], 8, 70);
          coins();
          renderShop();
        });
        list.append(card);
      });
    });
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    const s = Store.d.settings;
    [['set-sound', 'sound'], ['set-vibe', 'vibe'], ['set-hints', 'hints']].forEach(([id, key]) => {
      const box = $(id);
      box.checked = s[key];
      box.onchange = () => {
        s[key] = box.checked;
        if (key === 'sound') { Sfx.enabled = box.checked; Sfx.init(); }
        Store.save();
        Sfx.tap();
      };
    });
  }

  /* ---------- results ---------- */
  function results(r) {
    lastResult = r;
    coins();
    UI.show('results');
    $('r-level').textContent = r.practice ? 'Practice' : `Level ${r.level} · ${r.name}`;
    $('r-title').textContent = r.practice ? 'Nice cooking!' : r.stars ? ['', 'Day complete!', 'Great service!', 'Perfect day!'][r.stars] : 'Customers left hungry…';
    $('r-sat').textContent = r.sat + '%';
    $('r-served').textContent = `${r.served}/${r.total}`;
    $('r-coins').textContent = '+' + r.coins;
    $('r-score').textContent = r.score + (r.newBest ? ' · Best!' : '');
    const stars = $('r-stars').children;
    [...stars].forEach((s) => s.classList.remove('on'));
    for (let i = 0; i < r.stars; i++) {
      setTimeout(() => { stars[i].classList.add('on'); Sfx.star(i); UI.vibrate(15); }, 450 + i * 380);
    }
    const notes = [];
    if (r.unlocked) notes.push(`🔓 Level ${r.unlocked.n} unlocked: <b>${r.unlocked.name}</b>`);
    if (!r.practice && !r.stars) notes.push('Reach 40% satisfaction to earn a star. Cook faster and aim for the green!');
    const affordable = SHOP.filter((s) => !Store.has(s.id) && Store.d.level >= s.lvl && Store.d.coins >= s.cost).length;
    if (affordable) notes.push(`🛠️ You can afford ${affordable} upgrade${affordable > 1 ? 's' : ''}!`);
    $('r-note').innerHTML = notes.join('<br>');
    const next = $('r-next');
    next.textContent = r.practice ? 'Back to recipes' : r.stars ? `Next: Level ${r.level + 1} ▶` : 'Try again ↻';
    if (r.stars >= 2 && !r.practice) setTimeout(() => { const { x, y } = UI.center($('r-stars')); UI.burst(x, y, ['✨', '⭐', '🎉'], 10, 120); }, 450 + r.stars * 380);
  }

  function boot() {
    chef();
    Sfx.enabled = Store.d.settings.sound;

    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { Sfx.tap(); open(b.dataset.go); }));
    $('btn-play').addEventListener('click', () => { Sfx.init(); Sfx.tap(); Game.start(pickLevel); });
    $('btn-pause').addEventListener('click', () => { Sfx.tap(); Game.pause(); });
    $('r-next').addEventListener('click', () => {
      Sfx.tap();
      const r = lastResult;
      if (!r || r.practice) return open('recipes');
      pickLevel = r.stars ? r.level + 1 : r.level;
      Game.start(pickLevel);
    });
    $('r-retry').addEventListener('click', () => {
      Sfx.tap();
      const r = lastResult;
      if (r && r.practice) Game.start(r.level, r.practice);
      else Game.start(r ? r.level : 1);
    });
    $('btn-reset').addEventListener('click', () => {
      Sfx.tap();
      UI.modal({
        title: 'Reset progress?', html: '<p>Coins, levels and upgrades will be cleared.</p>', dismiss: true,
        buttons: [{ label: 'Keep playing', cls: 'btn-play' }, { label: 'Reset', cls: 'btn-danger', fn: () => { Store.reset(); pickLevel = 1; open('menu'); } }],
      });
    });

    // Touch hygiene: no page scrolling, zooming or long-press menus outside scroll lists.
    document.addEventListener('touchmove', (e) => { if (!e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => Sfx.init(), { capture: true, passive: true });
    $('s-game').addEventListener('pointerdown', () => Game.poke(), { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && Game.active) Game.pause(); });
    window.addEventListener('resize', () => Game.resize());

    open('menu');
  }

  return { open, results, boot };
})();

Menu.boot();

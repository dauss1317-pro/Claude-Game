'use strict';
/* Input: pointer-event helpers (one code path for touch and mouse).
   Every listener is registered on a Scope so a step can be torn down cleanly. */

function Scope() {
  const offs = [];
  let alive = true;
  return {
    get alive() { return alive; },
    on(target, type, fn, opt) { target.addEventListener(type, fn, opt); offs.push(() => target.removeEventListener(type, fn, opt)); },
    later(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); offs.push(() => clearTimeout(id)); return id; },
    add(fn) { offs.push(fn); },
    destroy() { alive = false; offs.splice(0).forEach((f) => f()); },
  };
}

const Input = (() => {
  let active = null; // the pointer currently driving a gesture; extra fingers are ignored

  // Follow one pointer from pointerdown until it lifts.
  function follow(scope, e, { move, up } = {}) {
    const id = e.pointerId;
    active = id;
    const p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t0: performance.now(), dt: 0 };
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      p.x = ev.clientX; p.y = ev.clientY; p.dx = p.x - p.x0; p.dy = p.y - p.y0;
      move && move(p, ev);
    };
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      cleanup();
      p.dt = performance.now() - p.t0;
      up && up(p, ev.type === 'pointercancel');
    };
    function cleanup() {
      if (active === id) active = null;
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    }
    window.addEventListener('pointermove', mv, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    scope.add(cleanup);
    return p;
  }

  // Press on an element: down -> move -> up.
  function press(scope, node, h) {
    scope.on(node, 'pointerdown', (e) => {
      if (active !== null || (e.button && e.button !== 0)) return;
      e.preventDefault();
      Sfx.init();
      const p = follow(scope, e, { move: h.move, up: h.up });
      h.down && h.down(p, e);
    });
  }

  const inside = (x, y, node, pad = 0) => {
    const r = node.getBoundingClientRect();
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  };

  // Drag a tray tile. A ghost follows the finger (lifted above it so it stays visible).
  function drag(scope, tile, { targets, accept }) {
    const LIFT = 46;
    press(scope, tile, {
      down(p) {
        const art = tile.querySelector('.art');
        const ghost = el(`<div class="ghost">${art.innerHTML}</div>`);
        $('fx').append(ghost);
        tile.classList.add('lifted');
        Sfx.pick();
        UI.vibrate(8);
        const list = targets();
        list.forEach((t) => t.classList.add('drop-ok'));
        let hot = null;
        const place = () => { ghost.style.transform = `translate3d(${p.x}px, ${p.y - LIFT}px, 0) translate(-50%,-50%) scale(1.15)`; };
        place();
        p.onMove = () => {
          place();
          const t = list.find((n) => inside(p.x, p.y - LIFT, n, 28)) || null;
          if (t !== hot) { hot && hot.classList.remove('hot'); t && t.classList.add('hot'); hot = t; }
        };
        p.onUp = () => {
          list.forEach((t) => t.classList.remove('drop-ok', 'hot'));
          const ok = hot ? accept(hot, tile) : false;
          if (ok) {
            ghost.animate([{ opacity: 1 }, { opacity: 0, transform: ghost.style.transform + ' scale(.7)' }], { duration: 160 }).onfinish = () => ghost.remove();
            tile.classList.add('used');
          } else {
            const r = tile.getBoundingClientRect();
            ghost.animate([{ transform: ghost.style.transform },
              { transform: `translate3d(${r.left + r.width / 2}px, ${r.top + r.height / 2}px, 0) translate(-50%,-50%) scale(1)` }],
            { duration: 220, easing: 'ease-out' }).onfinish = () => { ghost.remove(); tile.classList.remove('lifted'); };
          }
        };
        scope.add(() => ghost.remove());
      },
      move(p) { p.onMove && p.onMove(); },
      up(p) { p.onUp && p.onUp(); },
    });
  }

  return { follow, press, drag, inside, get busy() { return active !== null; }, reset() { active = null; } };
})();

'use strict';
/* UI helpers: screens, floating rewards, banners, particles, modals and gesture hints. */
const $ = (id) => document.getElementById(id);

const UI = (() => {
  const fx = () => $('fx');
  const center = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };

  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + name));
  }

  function vibrate(ms) {
    if (Store.d.settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  function float(text, x, y, cls = '') {
    const n = el(`<div class="floater ${cls}">${text}</div>`);
    n.style.left = x + 'px'; n.style.top = y + 'px';
    fx().append(n);
    n.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.1)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-260%) scale(1)', opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => n.remove();
  }

  // Big pop-up word in the middle of the stage: PERFECT!, FAST!, Oops!
  function banner(text, cls = '') {
    const stage = $('stage');
    const { x, y } = center(stage);
    const n = el(`<div class="banner ${cls}">${text}</div>`);
    n.style.left = x + 'px'; n.style.top = (y - stage.offsetHeight * 0.18) + 'px';
    fx().append(n);
    n.animate([
      { transform: 'translate(-50%,-50%) scale(.3) rotate(-8deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.15) rotate(3deg)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-80%) scale(.9)', opacity: 0 },
    ], { duration: 1000, easing: 'ease-out' }).onfinish = () => n.remove();
  }

  function burst(x, y, chars = ['✨'], n = 6, spread = 70) {
    for (let i = 0; i < n; i++) {
      const p = el(`<div class="particle">${chars[i % chars.length]}</div>`);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      fx().append(p);
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6, r = spread * (0.6 + Math.random() * 0.6);
      p.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r - 20}px)) scale(1)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => p.remove();
    }
  }

  // Fly a copy of some HTML from one point to an element (coins into the HUD, items into a pot).
  function fly(html, from, toNode, { duration = 650, delay = 0, scale = 0.6, onEnd } = {}) {
    const to = center(toNode);
    const n = el(`<div class="flyer">${html}</div>`);
    n.style.left = from.x + 'px'; n.style.top = from.y + 'px';
    fx().append(n);
    const dx = to.x - from.x, dy = to.y - from.y;
    const a = n.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(${(1 + scale) / 2 + 0.15})`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`, opacity: 0.9 },
    ], { duration, delay, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'backwards' });
    a.onfinish = () => { n.remove(); onEnd && onEnd(); };
    return a;
  }

  function shake(node) {
    node.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' },
      { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
    ], { duration: 360, easing: 'ease-out', composite: 'add' });
  }

  function bounce(node, amt = 1.08) {
    node.animate([{ transform: 'scale(1)' }, { transform: `scale(${amt})` }, { transform: 'scale(.98)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'ease-out', composite: 'add' });
  }

  function flash(node, cls) {
    node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), 500);
  }

  function modal({ title, html = '', buttons = [], dismiss = false }) {
    const root = $('modal-root');
    const m = el(`<div class="modal"><div class="modal-card"><h2>${title}</h2><div class="modal-body">${html}</div><div class="modal-btns"></div></div></div>`);
    const close = () => {
      m.classList.add('out');
      setTimeout(() => m.remove(), 200);
    };
    buttons.forEach((b) => {
      const btn = el(`<button class="btn ${b.cls || 'btn-soft'}">${b.label}</button>`);
      btn.addEventListener('click', () => { Sfx.tap(); close(); b.fn && b.fn(); });
      m.querySelector('.modal-btns').append(btn);
    });
    if (dismiss) m.addEventListener('click', (e) => { if (e.target === m) close(); });
    root.append(m);
    return close;
  }

  return { show, vibrate, float, banner, burst, fly, shake, bounce, flash, modal, center };
})();

/* Hint: a ghost hand that demonstrates the gesture for the current step. */
const Hint = (() => {
  let cur = null;
  const HAND = '<div class="hand">👆</div>';

  function make(x, y) {
    clear();
    const n = el(`<div class="hint">${HAND}</div>`);
    n.style.left = x + 'px'; n.style.top = y + 'px';
    $('fx').append(n);
    cur = n;
    return n;
  }
  function clear() { if (cur) { cur.remove(); cur = null; } }
  const done = (n) => (a) => { a.onfinish = () => { if (cur === n) clear(); }; };
  const pt = (node) => UI.center(node);

  function tap(node, times = 2) {
    const { x, y } = pt(node), n = make(x, y), kf = [];
    for (let i = 0; i < times; i++) kf.push({ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,6px) scale(.88)' });
    kf.push({ transform: 'translate(0,0) scale(1)' });
    done(n)(n.animate(kf, { duration: 380 * times + 300, easing: 'ease-in-out' }));
    n.classList.add('tapping');
  }
  function hold(node) {
    const { x, y } = pt(node), n = make(x, y);
    n.classList.add('holding');
    done(n)(n.animate([
      { transform: 'scale(1)', opacity: 0 }, { transform: 'scale(.9)', opacity: 1, offset: 0.15 },
      { transform: 'scale(.9)', opacity: 1, offset: 0.85 }, { transform: 'scale(1)', opacity: 0 },
    ], { duration: 1900 }));
  }
  function drag(from, to) {
    if (!from || !to) return;
    const a = pt(from), b = pt(to), n = make(a.x, a.y);
    const item = from.querySelector('.art');
    if (item) n.insertAdjacentHTML('afterbegin', `<div class="hint-item">${item.innerHTML}</div>`);
    done(n)(n.animate([
      { transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(0,0)', opacity: 1, offset: 0.12 },
      { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`, opacity: 0 },
    ], { duration: 1700, easing: 'cubic-bezier(.5,0,.4,1)' }));
  }
  function swipe(node, kind) {
    const { x, y, r } = pt(node), n = make(x, y);
    const w = Math.min(r.width, 260) * 0.38, h = Math.min(r.height, 260) * 0.38;
    let kf;
    if (kind === 'up') kf = [[0, h], [0, -h]];
    else if (kind === 'down') kf = [[0, -h], [0, h]];
    else if (kind === 'side') kf = [[-w, 0], [w, 0]];
    else if (kind === 'zigzag') kf = [[-w, -10], [-w / 2, 10], [0, -10], [w / 2, 10], [w, -10]];
    else { kf = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; kf.push([Math.cos(a) * w, Math.sin(a) * h]); } }
    const frames = kf.map(([dx, dy], i) => ({ transform: `translate(${dx}px, ${dy}px)`, opacity: i === 0 || i === kf.length - 1 ? 0.2 : 1 }));
    done(n)(n.animate(frames, { duration: kind === 'circle' ? 1800 : 1100, easing: 'ease-in-out' }));
  }
  return { tap, hold, drag, swipe, clear };
})();

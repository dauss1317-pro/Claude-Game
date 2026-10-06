'use strict';
/* Customers: personality data + a small generated SVG character with swappable expressions. */

const CTYPES = {
  normal:    { label: 'Regular',     badge: '😊', patience: 1.0,  tip: 1.0,  weight: 0.7 },
  impatient: { label: 'In a hurry',  badge: '⚡', patience: 0.7,  tip: 1.25, weight: 0.55 },
  foodie:    { label: 'Food lover',  badge: '🤩', patience: 1.05, tip: 1.4,  weight: 0.82 },
  slow:      { label: 'Easygoing',   badge: '😴', patience: 1.4,  tip: 0.9,  weight: 0.7 },
  family:    { label: 'Family',      badge: '👨‍👩‍👧', patience: 1.15, tip: 1.7,  weight: 0.7 },
  vip:       { label: 'VIP',         badge: '⭐', patience: 0.85, tip: 2.2,  weight: 0.8, score: 2 },
};

const Customers = (() => {
  const SKIN = ['#ffdcbf', '#f6c79e', '#e8b087', '#c98b5f', '#9a6440', '#f9d2b4'];
  const HAIR = ['#3a2a22', '#6b4226', '#d9a441', '#26211f', '#b5523b', '#8e8e96', '#f2c46d'];
  const SHIRT = ['#5fb4e5', '#ff8fab', '#7bd389', '#ffb347', '#a28bf0', '#4ecdc4', '#f97d6d'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const INK = '#2b2222';

  function hairTop(style, c) {
    switch (style) {
      case 1: return `<path d="M19 54 Q18 20 50 20 Q82 20 81 54 Q74 34 58 36 Q50 42 38 36 Q26 36 19 54Z" fill="${c}"/><circle cx="50" cy="15" r="10" fill="${c}"/>`;
      case 2: return `<path d="M20 52 L22 30 L30 36 L34 20 L42 30 L50 15 L58 30 L66 20 L70 36 L78 30 L80 52 Q66 38 50 40 Q34 38 20 52Z" fill="${c}"/>`;
      case 3: return `<g fill="${c}"><circle cx="28" cy="36" r="10"/><circle cx="40" cy="26" r="11"/><circle cx="55" cy="24" r="11"/><circle cx="69" cy="32" r="10"/><circle cx="76" cy="44" r="8"/><circle cx="23" cy="47" r="8"/></g>`;
      default: return `<path d="M19 54 Q18 20 50 20 Q82 20 81 54 Q74 34 58 36 Q50 42 38 36 Q26 36 19 54Z" fill="${c}"/>`;
    }
  }

  function accessory(type, kid) {
    if (kid) return `<circle cx="20" cy="40" r="8" fill="#ff6f91"/><circle cx="80" cy="40" r="8" fill="#ff6f91"/>`;
    switch (type) {
      case 'vip': return `<path d="M32 30 L36 10 L44 22 L50 6 L56 22 L64 10 L68 30Z" fill="#ffc93c" stroke="#e0a400" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="20" r="2.6" fill="#ff5d73"/>`;
      case 'slow': return `<path d="M22 40 Q40 4 78 18 L84 30 Q60 24 22 40Z" fill="#7aa7e8"/><circle cx="86" cy="30" r="6" fill="#fff"/>`;
      case 'impatient': return `<path d="M20 44 Q22 18 50 18 Q78 18 80 44Z" fill="#ff6b5b"/><path d="M50 40 L94 44 Q92 50 74 48Z" fill="#e2493a"/>`;
      case 'foodie': return `<path d="M36 96 L64 96 L50 118Z" fill="#fff" stroke="#e7e2da" stroke-width="2"/><circle cx="50" cy="104" r="2.6" fill="#ff8fab"/>`;
    }
    return '';
  }

  function figure(o) {
    const { skin, hair, shirt, style, type, kid, x, s } = o;
    const back = style === 4 ? `<path d="M18 56 Q16 22 50 20 Q84 22 82 56 L86 96 L14 96Z" fill="${hair}"/>` : '';
    return `<g transform="translate(${x} ${(130 * (1 - s)).toFixed(1)}) scale(${s})">
      <path d="M14 132 Q14 96 50 94 Q86 96 86 132Z" fill="${shirt}"/>
      <path d="M40 95 L50 107 L60 95" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="3"/>
      ${back}
      <rect x="44" y="82" width="12" height="14" rx="4" fill="${skin}"/>
      <circle cx="20" cy="59" r="6" fill="${skin}"/><circle cx="80" cy="59" r="6" fill="${skin}"/>
      <circle cx="50" cy="56" r="31" fill="${skin}"/>
      ${hairTop(style === 4 ? 0 : style, hair)}
      <ellipse cx="32" cy="67" rx="5.5" ry="3.4" fill="#ff8f8f" opacity=".45"/><ellipse cx="68" cy="67" rx="5.5" ry="3.4" fill="#ff8f8f" opacity=".45"/>
      <g class="e e-open"><circle cx="39" cy="57" r="3.9" fill="${INK}"/><circle cx="61" cy="57" r="3.9" fill="${INK}"/><circle cx="40.4" cy="55.5" r="1.3" fill="#fff"/><circle cx="62.4" cy="55.5" r="1.3" fill="#fff"/></g>
      <g class="e e-happy"><path d="M34 59 Q39 52 44 59 M56 59 Q61 52 66 59" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g class="e e-sleepy"><path d="M34 57 Q39 61 44 57 M56 57 Q61 61 66 57" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g class="e e-heart"><path d="M39 63 C29 55 33 48 39 52.5 C45 48 49 55 39 63Z M61 63 C51 55 55 48 61 52.5 C67 48 71 55 61 63Z" fill="#ff4d6d"/></g>
      <g class="x x-brow"><path d="M32 47 L44 51 M68 47 L56 51" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>
      <g class="m m-smile"><path d="M43 69 Q50 75 57 69" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g class="m m-big"><path d="M41 67 Q50 82 59 67Z" fill="#7a2d2d"/><path d="M45 74 Q50 78 55 74" fill="#ff8a8a"/></g>
      <g class="m m-flat"><path d="M44 71 L56 71" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>
      <g class="m m-frown"><path d="M42 75 Q50 67 58 75" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g class="m m-chew"><ellipse cx="50" cy="71" rx="6" ry="5" fill="#7a2d2d"/></g>
      <g class="x x-sweat"><path d="M83 38 q5 8 0 11 q-5 -3 0 -11z" fill="#7cc8ff"/></g>
      ${accessory(type, kid)}
    </g>`;
  }

  function create(type) {
    const skin = pick(SKIN), shirt = type === 'vip' ? '#3b3561' : pick(SHIRT);
    const base = { skin, hair: pick(HAIR), shirt, style: Math.floor(Math.random() * 5), type, kid: false };
    let svg;
    if (type === 'family') {
      svg = `<svg viewBox="0 0 160 132">${figure({ ...base, x: 0, s: 1 })}${figure({ ...base, shirt: pick(SHIRT), style: 3, kid: true, x: 88, s: 0.62 })}</svg>`;
    } else {
      svg = `<svg viewBox="0 0 100 132">${figure({ ...base, x: 0, s: 1 })}</svg>`;
    }
    const root = el(`<div class="cust t-${type} mood-wait"><div class="cust-walk"><div class="cust-bob">${svg}</div></div><div class="cust-emote"></div></div>`);
    const c = {
      type, el: root,
      setMood(m) {
        root.className = root.className.replace(/mood-\w+/, 'mood-' + m);
      },
      emote(txt) {
        const e = root.querySelector('.cust-emote');
        e.textContent = txt;
        e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
      },
      enter() { root.classList.add('enter'); },
      leave(done) {
        root.classList.remove('enter');
        root.classList.add('leave');
        setTimeout(() => { root.remove(); done && done(); }, 650);
      },
    };
    return c;
  }

  return { create, figure };
})();

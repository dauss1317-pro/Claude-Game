'use strict';
/* Persistent progress. Each location keeps its own stations, upgrades and task progress. */
const Save = (() => {
  const KEY = 'sunny-stand-v1';
  const fresh = () => ({
    coins: 0, cur: 0, unlocked: 1, locs: {},
    settings: { sound: true, vibe: true },
    lastSeen: Date.now(), boostUntil: 0, boostReady: 0, walked: false,
  });
  let d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); d = Object.assign(fresh(), s); d.settings = Object.assign(fresh().settings, s.settings); }
  } catch (e) { /* storage blocked: play without saving */ }

  function loc(i) {
    const L = LOCATIONS[i];
    if (!d.locs[L.id]) {
      d.locs[L.id] = {
        st: L.slots.map((s, k) => ({ lvl: k === 0 ? 1 : 0, stock: 0, prog: 0, paid: 0, input: 0 })),
        ups: {}, task: 0, sold: {}, served: 0, cash: 0,
      };
    }
    return d.locs[L.id];
  }

  return {
    get d() { return d; },
    loc,
    save() { d.lastSeen = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } },
    reset() { d = fresh(); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
    boostOn: () => Date.now() < d.boostUntil,
  };
})();

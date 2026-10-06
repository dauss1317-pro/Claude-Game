'use strict';
/* Audio: every sound is synthesized with WebAudio, so there are no audio files to download.
   The context is created lazily on the first touch (mobile browsers require a gesture). */
const Sfx = (() => {
  let ac = null, out = null, noiseBuf = null, sizzle = null;
  let enabled = true;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { return; }
    out = ac.createGain();
    out.gain.value = 0.5;
    out.connect(ac.destination);
    const len = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  const ready = () => enabled && ac && ac.state !== 'closed';

  function env(g, t, vol, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(f, dur, type = 'sine', vol = 0.2, f2 = 0, delay = 0) {
    if (!ready()) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, vol, dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function hiss(dur, vol, freq, type = 'bandpass', q = 1, delay = 0) {
    if (!ready()) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, vol, dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // Continuous sizzle for the pan/grill. level 0 fades it out.
  function setSizzle(level) {
    if (!ready()) { stopSizzle(); return; }
    if (!sizzle && level > 0) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = 'highpass'; f.frequency.value = 2600;
      g.gain.value = 0.0001;
      s.connect(f); f.connect(g); g.connect(out);
      s.start();
      sizzle = { s, g };
    }
    if (sizzle) sizzle.g.gain.setTargetAtTime(level > 0 ? 0.05 + level * 0.12 : 0.0001, ac.currentTime, 0.06);
  }
  function stopSizzle() {
    if (!sizzle) return;
    const { s, g } = sizzle;
    sizzle = null;
    try { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05); s.stop(ac.currentTime + 0.3); } catch (e) { /* already stopped */ }
  }

  return {
    init,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; if (!v) stopSizzle(); },
    sizzle: setSizzle,
    stopSizzle,
    tap()     { tone(720, 0.06, 'triangle', 0.16); },
    pick()    { tone(520, 0.09, 'triangle', 0.18, 820); },
    drop()    { tone(360, 0.12, 'sine', 0.3, 200); hiss(0.05, 0.12, 1400); },
    chop()    { hiss(0.05, 0.45, 3200, 'highpass'); tone(150, 0.05, 'square', 0.07); },
    slice()   { hiss(0.16, 0.3, 5200, 'bandpass', 0.7); },
    crack()   { hiss(0.04, 0.5, 2600, 'highpass'); tone(1000, 0.03, 'square', 0.05); },
    splat()   { hiss(0.12, 0.3, 700, 'lowpass'); tone(220, 0.12, 'sine', 0.2, 90); },
    squirt()  { hiss(0.07, 0.12, 900, 'bandpass', 2); },
    flip()    { tone(260, 0.2, 'sine', 0.2, 900); },
    bubble()  { tone(320 + Math.random() * 300, 0.07, 'sine', 0.1, 900); },
    pop()     { tone(500, 0.08, 'sine', 0.24, 1150); },
    swish()   { hiss(0.12, 0.12, 1800, 'bandpass', 1.5); },
    ding()    { tone(1568, 0.6, 'sine', 0.16); tone(2093, 0.7, 'sine', 0.08, 0, 0.05); },
    coin()    { tone(988, 0.07, 'square', 0.06); tone(1319, 0.22, 'square', 0.06, 0, 0.07); },
    good()    { [660, 880].forEach((f, i) => tone(f, 0.12, 'triangle', 0.16, 0, i * 0.07)); },
    perfect() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'triangle', 0.16, 0, i * 0.06)); },
    happy()   { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'sine', 0.14, 0, i * 0.07)); },
    sad()     { tone(440, 0.25, 'triangle', 0.14, 330); tone(330, 0.4, 'triangle', 0.14, 247, 0.22); },
    error()   { tone(190, 0.16, 'square', 0.1, 120); },
    whoosh()  { hiss(0.28, 0.22, 900, 'bandpass', 0.6); },
    star(i)   { tone(880 + i * 220, 0.25, 'triangle', 0.16, 0); },
  };
})();

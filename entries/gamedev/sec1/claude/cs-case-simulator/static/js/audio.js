// Tiny WebAudio synth for UI and ambience — no audio files needed.
let ctx = null, master = null, muted = false, hum = null;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, delay = 0, slide = 0 } = {}) {
  const c = ensure(), t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
  const c = ensure(), t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  unlock: () => ensure(),
  tick: () => { tone(1800, 0.03, { type: 'square', vol: 0.06 }); },
  click: () => tone(900, 0.05, { type: 'triangle', vol: 0.15 }),
  hover: () => tone(1400, 0.03, { type: 'sine', vol: 0.04 }),
  buy: () => { tone(1320, 0.12, { type: 'triangle', vol: 0.2 }); tone(1760, 0.25, { type: 'triangle', vol: 0.2, delay: 0.08 }); noise(0.15, { freq: 6000, vol: 0.08 }); },
  sell: () => { tone(880, 0.1, { type: 'triangle', vol: 0.2 }); tone(1320, 0.2, { type: 'triangle', vol: 0.18, delay: 0.07 }); },
  error: () => { tone(220, 0.18, { type: 'sawtooth', vol: 0.12 }); tone(180, 0.25, { type: 'sawtooth', vol: 0.12, delay: 0.12 }); },
  latch: () => { noise(0.08, { freq: 2500, vol: 0.4, q: 4 }); noise(0.08, { freq: 2200, vol: 0.4, q: 4, delay: 0.18 }); },
  lid: () => { noise(0.6, { freq: 500, vol: 0.25, type: 'lowpass' }); tone(140, 0.5, { slide: 80, vol: 0.15 }); },
  whoosh: () => noise(0.9, { freq: 800, vol: 0.25, q: 0.7 }),
  reveal(rarity) {
    const chords = {
      common: [523, 659],
      rare: [523, 659, 784],
      epic: [523, 659, 784, 988],
      legendary: [392, 523, 659, 784, 1047, 1319],
    }[rarity] || [523];
    chords.forEach((f, i) => tone(f, 1.4, { type: 'triangle', vol: 0.12, delay: i * 0.07 }));
    if (rarity === 'legendary') {
      noise(1.5, { freq: 7000, vol: 0.1, type: 'highpass' });
      [1568, 2093].forEach((f, i) => tone(f, 1.2, { type: 'sine', vol: 0.08, delay: 0.5 + i * 0.15 }));
    }
  },
  startHum() {
    if (hum) return;
    const c = ensure();
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.frequency.value = 50; o2.frequency.value = 100; o2.type = 'sawtooth';
    g.gain.value = 0.012;
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(); o2.start();
    hum = g;
  },
  setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
  get muted() { return muted; },
};

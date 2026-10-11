// All sounds are synthesized with WebAudio: no audio files to host.
export class Sound {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('hh-muted') === '1'; } catch { this.muted = false; }
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._engine();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('hh-muted', this.muted ? '1' : '0'); } catch { /* storage unavailable */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  _att(dist) { return 1 / (1 + dist / 70); }

  _noise({ dur, type = 'lowpass', f0, f1 = f0, q = 0.7, gain, attack = 0.004, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _tone({ type = 'sine', f0, f1 = f0, dur, gain, attack = 0.005, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  cannon(dist = 0) {
    if (!this.ctx) return;
    const a = this._att(dist), far = dist > 60;
    this._noise({ dur: 1.5, f0: far ? 900 : 4200, f1: 110, gain: 1.0 * a });
    this._tone({ f0: 120, f1: 32, dur: 0.75, gain: 0.95 * a });
    if (!far) this._noise({ dur: 0.22, type: 'highpass', f0: 2500, f1: 900, gain: 0.35 });
    else this._noise({ dur: 2.2, f0: 300, f1: 60, gain: 0.35 * a, delay: 0.08 });
  }

  explosion(dist = 0) {
    if (!this.ctx) return;
    const a = this._att(dist);
    this._noise({ dur: 2.4, f0: 1800, f1: 60, gain: 1.2 * a, attack: 0.01 });
    this._tone({ f0: 80, f1: 24, dur: 1.4, gain: 0.9 * a });
    this._noise({ dur: 1.8, type: 'bandpass', f0: 900, f1: 200, q: 1.2, gain: 0.4 * a, delay: 0.25 });
  }

  impact(kind, dist = 0) {
    if (!this.ctx) return;
    const a = this._att(dist);
    if (kind === 'metal') {
      for (const f of [420, 637, 951, 1290]) this._tone({ type: 'square', f0: f, f1: f * 0.92, dur: 0.6, gain: 0.07 * a });
      this._noise({ dur: 0.35, type: 'highpass', f0: 3000, f1: 1200, gain: 0.5 * a });
    } else {
      this._noise({ dur: 0.7, f0: kind === 'ground' ? 1400 : 2600, f1: 150, gain: 0.75 * a });
      this._tone({ f0: 90, f1: 40, dur: 0.35, gain: 0.4 * a });
    }
  }

  whiz() {
    if (!this.ctx) return;
    this._noise({ dur: 0.55, type: 'bandpass', f0: 3200, f1: 700, q: 5, gain: 0.5, attack: 0.18 });
  }

  reloaded() {
    if (!this.ctx) return;
    this._tone({ type: 'square', f0: 1400, dur: 0.05, gain: 0.08 });
    this._tone({ type: 'square', f0: 900, dur: 0.07, gain: 0.08, delay: 0.09 });
    this._noise({ dur: 0.12, type: 'bandpass', f0: 2000, q: 3, gain: 0.2, delay: 0.09 });
  }

  alarm() {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) {
      this._tone({ type: 'square', f0: 880, dur: 0.11, gain: 0.07, delay: i * 0.22 });
      this._tone({ type: 'square', f0: 660, dur: 0.11, gain: 0.07, delay: i * 0.22 + 0.11 });
    }
  }

  crunch() {
    if (!this.ctx) return;
    this._noise({ dur: 0.45, type: 'bandpass', f0: 1200, f1: 400, q: 1.5, gain: 0.5 });
    this._tone({ type: 'sawtooth', f0: 160, f1: 60, dur: 0.3, gain: 0.12 });
  }

  bump() {
    if (!this.ctx) return;
    this._tone({ f0: 70, f1: 35, dur: 0.35, gain: 0.5 });
    this._noise({ dur: 0.3, f0: 600, f1: 100, gain: 0.35 });
  }

  ui() {
    if (!this.ctx) return;
    this._tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.08, gain: 0.08 });
  }

  _engine() {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 30;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 45;
    const g2 = c.createGain(); g2.gain.value = 0.35;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 2;
    const g = c.createGain(); g.gain.value = 0;
    o1.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(g).connect(this.master);
    const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 1.4;
    const tg = c.createGain(); tg.gain.value = 0;
    n.connect(bp).connect(tg).connect(this.master);
    o1.start(); o2.start(); n.start();
    this.eng = { o1, o2, lp, g, tg, bp };
  }

  setEngine(on, rpm = 0, speed = 0) {
    if (!this.eng) return;
    const t = this.ctx.currentTime, e = this.eng;
    e.o1.frequency.setTargetAtTime(26 + rpm * 34, t, 0.15);
    e.o2.frequency.setTargetAtTime((26 + rpm * 34) * 1.5, t, 0.15);
    e.lp.frequency.setTargetAtTime(180 + rpm * 420, t, 0.15);
    e.g.gain.setTargetAtTime(on ? 0.11 + rpm * 0.12 : 0, t, 0.2);
    e.tg.gain.setTargetAtTime(on ? speed * 0.06 : 0, t, 0.2);
    e.bp.frequency.setTargetAtTime(400 + speed * 500, t, 0.2);
  }
}

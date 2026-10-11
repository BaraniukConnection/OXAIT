// Synthesised sound (WebAudio) - no audio files needed.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastGun = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine: rumbling filtered noise + low saw whine
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 400;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    src.connect(this.engFilter).connect(this.engGain).connect(this.master);
    src.start();
    this.whine = ctx.createOscillator();
    this.whine.type = 'sawtooth';
    this.whine.frequency.value = 110;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 900;
    wf.Q.value = 3;
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(wf).connect(this.whineGain).connect(this.master);
    this.whine.start();

    // tone generator used for lock / warning beeps
    this.tone = ctx.createOscillator();
    this.tone.type = 'square';
    this.tone.frequency.value = 1000;
    this.toneGain = ctx.createGain();
    this.toneGain.gain.value = 0;
    this.tone.connect(this.toneGain).connect(this.master);
    this.tone.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  engine(throttle, speed, on = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on ? 0.16 + throttle * 0.22 : 0, t, 0.15);
    this.engFilter.frequency.setTargetAtTime(250 + throttle * 900 + speed, t, 0.2);
    this.whine.frequency.setTargetAtTime(80 + throttle * 120 + speed * 0.15, t, 0.2);
    this.whineGain.gain.setTargetAtTime(on ? 0.012 + throttle * 0.02 : 0, t, 0.2);
  }

  // mode: 'none' | 'seeking' | 'locked' | 'warning' | 'missile'
  beeper(mode, time) {
    if (!this.ctx) return;
    let f = 0, g = 0;
    if (mode === 'seeking') { f = 900; g = (time * 6) % 1 < 0.3 ? 0.035 : 0; }
    else if (mode === 'locked') { f = 1350; g = 0.04; }
    else if (mode === 'warning') { f = 700; g = (time * 3) % 1 < 0.5 ? 0.04 : 0; }
    else if (mode === 'missile') { f = 1500; g = (time * 10) % 1 < 0.5 ? 0.05 : 0; }
    const t = this.ctx.currentTime;
    if (f) this.tone.frequency.setValueAtTime(f, t);
    this.toneGain.gain.setTargetAtTime(g, t, 0.006);
  }

  burst({ dur = 0.2, gain = 0.3, freq = 1200, type = 'bandpass', q = 1, sweep = null, vol = 1 }) {
    if (!this.ctx || this.muted || vol <= 0.01) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  gun(vol = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGun < 0.05) return;
    this.lastGun = now;
    this.burst({ dur: 0.07, gain: 0.32, freq: 1700, q: 0.8, vol });
  }
  missile() { this.burst({ dur: 1.1, gain: 0.35, freq: 2500, sweep: 300, q: 0.7 }); }
  explosion(vol = 1) {
    this.burst({ dur: 1.6, gain: 0.9, freq: 700, sweep: 60, type: 'lowpass', q: 0.5, vol });
    this.burst({ dur: 0.35, gain: 0.5, freq: 2200, sweep: 400, q: 0.6, vol });
  }
  hit() { this.burst({ dur: 0.08, gain: 0.25, freq: 3200, q: 2 }); }
  click() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }
}

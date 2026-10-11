// Web Audio API procedural sound engine for Arcade Flight Game
// No external assets required - 100% self-contained synthesized audio

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.engineGain = null;
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineNoiseNode = null;
        this.engineFilter = null;
        this.isMuted = false;
        this.isInitialized = false;

        this.lockOsc = null;
        this.lockGain = null;
        this.warningOsc = null;
        this.warningGain = null;
        this.warningInterval = null;
    }

    init() {
        if (this.isInitialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this.initEngineSound();
            this.initLockTone();
            this.initWarningAlarm();

            this.isInitialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported or blocked:", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    initEngineSound() {
        if (!this.ctx) return;

        // Engine low hum oscillator
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

        // Sub harmonic
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'triangle';
        this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

        // Jet roar noise buffer
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'bandpass';
        this.engineFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
        this.engineFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

        whiteNoise.connect(this.engineFilter);
        this.engineFilter.connect(noiseGain);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        this.engineOsc1.connect(this.engineGain);
        this.engineOsc2.connect(this.engineGain);
        noiseGain.connect(this.engineGain);

        this.engineGain.connect(this.masterGain);

        this.engineOsc1.start();
        this.engineOsc2.start();
        whiteNoise.start();
    }

    updateEngineSound(throttle, isBoost, speedRatio) {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;

        const t = this.ctx.currentTime;
        // Pitch rises with throttle and airspeed
        const baseFreq = 50 + throttle * 75 + speedRatio * 45;
        this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.1);
        this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.1);

        // Filter sweeps up with boost / afterburner
        const filterFreq = isBoost ? 900 : 220 + throttle * 380;
        this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.12);

        // Volume scales with throttle
        const targetVol = 0.12 + throttle * 0.22 + (isBoost ? 0.18 : 0);
        this.engineGain.gain.setTargetAtTime(targetVol, t, 0.08);
    }

    playGunFire() {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;

        const t = this.ctx.currentTime;

        // Sharp initial blast
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.06);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.07);

        // Mechanical crackle noise
        const bufferSize = this.ctx.sampleRate * 0.05;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, t);
        noiseFilter.Q.setValueAtTime(3.5, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(t);
    }

    playMissileLaunch(type = 'standard') {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;

        const t = this.ctx.currentTime;
        const duration = type === 'highspeed' ? 0.45 : 0.75;

        // Rocket ignition whoosh
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        const startFreq = type === 'highspeed' ? 600 : 300;
        const endFreq = type === 'highspeed' ? 2400 : 1200;
        filter.frequency.setValueAtTime(startFreq, t);
        filter.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
        filter.Q.setValueAtTime(3.0, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.65, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(t);

        // Rocket motor tone
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + duration * 0.6);

        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + duration);
    }

    initLockTone() {
        if (!this.ctx) return;
        this.lockOsc = this.ctx.createOscillator();
        this.lockOsc.type = 'sine';
        this.lockOsc.frequency.setValueAtTime(880, this.ctx.currentTime);

        this.lockGain = this.ctx.createGain();
        this.lockGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.lockOsc.connect(this.lockGain);
        this.lockGain.connect(this.masterGain);
        this.lockOsc.start();
    }

    setLockTone(mode) {
        // mode: 'none', 'acquiring', 'locked'
        if (!this.isInitialized || !this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;

        if (mode === 'locked') {
            this.lockOsc.frequency.setValueAtTime(1400, t);
            this.lockGain.gain.setTargetAtTime(0.18, t, 0.03);
        } else if (mode === 'acquiring') {
            // Pulsing tone
            this.lockOsc.frequency.setValueAtTime(950, t);
            const pulse = (Math.sin(Date.now() * 0.02) > 0) ? 0.12 : 0.0;
            this.lockGain.gain.setValueAtTime(pulse, t);
        } else {
            this.lockGain.gain.setTargetAtTime(0, t, 0.03);
        }
    }

    initWarningAlarm() {
        if (!this.ctx) return;
        this.warningOsc = this.ctx.createOscillator();
        this.warningOsc.type = 'square';
        this.warningOsc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5

        this.warningGain = this.ctx.createGain();
        this.warningGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.warningOsc.connect(this.warningGain);
        this.warningGain.connect(this.masterGain);
        this.warningOsc.start();
    }

    setWarningAlarm(active, isUrgent = false) {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;

        if (active) {
            const freq = isUrgent ? (Math.sin(Date.now() * 0.03) > 0 ? 880 : 587) : 587;
            this.warningOsc.frequency.setValueAtTime(freq, t);
            const pulse = (Math.sin(Date.now() * (isUrgent ? 0.03 : 0.015)) > 0) ? 0.18 : 0.0;
            this.warningGain.gain.setValueAtTime(pulse, t);
        } else {
            this.warningGain.gain.setTargetAtTime(0, t, 0.05);
        }
    }

    playExplosion(isLarge = false) {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;

        const t = this.ctx.currentTime;
        const duration = isLarge ? 1.6 : 0.8;

        // Sub bass thump
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(isLarge ? 110 : 85, t);
        subOsc.frequency.exponentialRampToValueAtTime(24, t + (isLarge ? 0.6 : 0.35));

        subGain.gain.setValueAtTime(isLarge ? 0.85 : 0.55, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + (isLarge ? 0.7 : 0.4));

        subOsc.connect(subGain);
        subGain.connect(this.masterGain);
        subOsc.start(t);
        subOsc.stop(t + duration);

        // Rumbling noise
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.6);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isLarge ? 650 : 450, t);
        filter.frequency.exponentialRampToValueAtTime(60, t + duration);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(isLarge ? 0.8 : 0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(t);
    }

    playHit() {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    playWeaponSwitch() {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.setValueAtTime(1200, t + 0.04);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    playUIClick() {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1050, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.06);
    }

    playVictory() {
        if (!this.isInitialized || !this.ctx || this.isMuted) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const t = this.ctx.currentTime + idx * 0.16;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + (idx === 3 ? 0.9 : 0.25));

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 1.0);
        });
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(muted ? 0 : 0.7, this.ctx.currentTime);
        }
    }
}

window.soundEngine = new SoundEngine();

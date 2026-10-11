/**
 * Procedural Web Audio API Sound Engine
 * Arcade Tank Simulator
 * Fully self-contained sound synthesis (zero external audio file dependencies)
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.engineOsc = null;
        this.engineSubOsc = null;
        this.engineFilter = null;
        this.engineGain = null;
        this.isEngineRunning = false;
        this.initialized = false;
        
        // Ambient noise buffer for explosions & engines
        this.noiseBuffer = null;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
            
            this.buildNoiseBuffer();
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported or blocked:", e);
        }
    }

    resume() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
        }
        return this.isMuted;
    }

    buildNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99 * b0 + white * 0.05;
            b1 = 0.95 * b1 + white * 0.1;
            b2 = 0.85 * b2 + white * 0.25;
            output[i] = (b0 + b1 + b2) * 0.5;
        }
    }

    startEngine() {
        if (!this.initialized || this.isEngineRunning || !this.ctx) return;
        try {
            const t = this.ctx.currentTime;
            
            // Engine main rumble oscillator (sawtooth for mechanical grit)
            this.engineOsc = this.ctx.createOscillator();
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(32, t);

            // Sub-bass engine rumble
            this.engineSubOsc = this.ctx.createOscillator();
            this.engineSubOsc.type = 'triangle';
            this.engineSubOsc.frequency.setValueAtTime(24, t);

            // Lowpass filter to muffle raw saw buzz into heavy tank diesel chug
            this.engineFilter = this.ctx.createBiquadFilter();
            this.engineFilter.type = 'lowpass';
            this.engineFilter.frequency.setValueAtTime(90, t);
            this.engineFilter.Q.setValueAtTime(3, t);

            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.setValueAtTime(0.18, t);

            this.engineOsc.connect(this.engineFilter);
            this.engineSubOsc.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.masterGain);

            this.engineOsc.start();
            this.engineSubOsc.start();
            this.isEngineRunning = true;
        } catch (e) {
            console.error("Engine start error:", e);
        }
    }

    updateEngine(speedFraction, isMoving) {
        if (!this.isEngineRunning || !this.ctx) return;
        const t = this.ctx.currentTime;
        const targetFreq = 30 + speedFraction * 45;
        const subFreq = 22 + speedFraction * 35;
        const filterFreq = 80 + speedFraction * 140;
        const targetVol = isMoving ? 0.24 : 0.14;

        this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);
        this.engineSubOsc.frequency.setTargetAtTime(subFreq, t, 0.1);
        this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.15);
        this.engineGain.gain.setTargetAtTime(targetVol, t, 0.1);
    }

    stopEngine() {
        if (!this.isEngineRunning) return;
        try {
            this.engineOsc.stop();
            this.engineSubOsc.stop();
            this.isEngineRunning = false;
        } catch (e) {}
    }

    // Play powerful tank cannon blast
    playCannonFire(isPlayer = true) {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        // 1. Heavy sub-bass thump
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(140, t);
        subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

        subGain.gain.setValueAtTime(isPlayer ? 0.9 : 0.6, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain);
        subOsc.start(t);
        subOsc.stop(t + 0.45);

        // 2. Explosive muzzle blast noise burst
        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(900, t);
            noiseFilter.frequency.exponentialRampToValueAtTime(120, t + 0.5);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(isPlayer ? 0.8 : 0.5, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noise.start(t);
            noise.stop(t + 0.6);
        }

        // 3. Metallic breech snap
        const snapOsc = this.ctx.createOscillator();
        const snapGain = this.ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(380, t);
        snapOsc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

        snapGain.gain.setValueAtTime(0.4, t);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        snapOsc.connect(snapGain);
        snapGain.connect(this.masterGain);
        snapOsc.start(t);
        snapOsc.stop(t + 0.1);
    }

    // Play shell impact on armor / concrete
    playImpact(isArmor = true) {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        // Metallic ring
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isArmor ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(isArmor ? 520 : 180, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.25);

        // Noise crack
        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(isArmor ? 1200 : 400, t);
            filter.Q.setValueAtTime(2, t);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.5, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(this.masterGain);
            noise.start(t);
            noise.stop(t + 0.25);
        }
    }

    // Massive tank destruction explosion
    playExplosion() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        // Deep shockwave
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(90, t);
        sub.frequency.exponentialRampToValueAtTime(15, t + 0.9);

        subGain.gain.setValueAtTime(1.0, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(t);
        sub.stop(t + 1.2);

        // Huge rumble & debris crackle
        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, t);
            filter.frequency.exponentialRampToValueAtTime(60, t + 1.5);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.9, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            noise.start(t);
            noise.stop(t + 1.6);
        }
    }

    // Reload completion mechanical sound
    playReload() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, t);
        osc.frequency.setValueAtTime(820, t + 0.08);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    // Sight / Optic Zoom toggle
    playSightToggle(isZoomed) {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        if (isZoomed) {
            osc.frequency.setValueAtTime(450, t);
            osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
        } else {
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.exponentialRampToValueAtTime(450, t + 0.08);
        }

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    // Warning alarm beep when spotted by Hound
    playAlarm() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(740, t);
        osc.frequency.setValueAtTime(920, t + 0.07);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    // Hit marker ding for confirmation of successful hit
    playHitMarker() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(1800, t + 0.06);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }
}

// Global singleton instance
window.soundEngine = new SoundEngine();

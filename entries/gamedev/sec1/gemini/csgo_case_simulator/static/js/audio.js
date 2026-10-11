/**
 * Web Audio API Sound Synthesizer for CS:GO Case Simulator
 * Zero external audio files required - 100% reliable synthesized SFX.
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.ambientGain = null;
        this.initAudioContext();
    }

    initAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            this.ctx = new AudioCtx();
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.ambientGain) {
            this.ambientGain.gain.setValueAtTime(this.muted ? 0 : 0.03, this.ctx ? this.ctx.currentTime : 0);
        }
        return this.muted;
    }

    // Subtle warehouse ambient hum
    startAmbient() {
        if (!this.ctx || this.ambientGain) return;
        try {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            this.ambientGain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(55, this.ctx.currentTime); // 55Hz electrical hum

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(120, this.ctx.currentTime);

            this.ambientGain.gain.setValueAtTime(this.muted ? 0 : 0.025, this.ctx.currentTime);

            osc.connect(filter);
            filter.connect(this.ambientGain);
            this.ambientGain.connect(this.ctx.destination);
            osc.start();
        } catch (e) {
            console.warn("Ambient audio error", e);
        }
    }

    // Click / button tap
    playClick() {
        if (this.muted || !this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.04);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
    }

    // Case opening unlock / latch pop
    playUnlock() {
        if (this.muted || !this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;

        // Metallic latch pop
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(220, t);
        osc1.frequency.exponentialRampToValueAtTime(50, t + 0.15);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, t);
        osc2.frequency.exponentialRampToValueAtTime(220, t + 0.12);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.2);
        osc2.stop(t + 0.2);
    }

    // CS:GO roulette tick sound when each item slides past the cursor
    playTick(pitchShift = 1.0) {
        if (this.muted || !this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200 * pitchShift, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.025);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.025);
    }

    // Reveal fanfares by rarity
    playRarityReveal(rarity) {
        if (this.muted || !this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;

        if (rarity === 'Legendary') {
            // Epic triumphant golden gong / chord fanfare
            const freqs = [220, 277.18, 329.63, 440, 554.37, 659.25, 880];
            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.setValueAtTime(freq, t + idx * 0.04);

                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.18, t + idx * 0.04 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t + idx * 0.04);
                osc.stop(t + 2.2);
            });
        } else if (rarity === 'Epic') {
            // Bright synth riser
            const freqs = [330, 415.3, 493.88, 659.25];
            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t + idx * 0.06);

                gain.gain.setValueAtTime(0.15, t + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t + idx * 0.06);
                osc.stop(t + 1.2);
            });
        } else if (rarity === 'Rare') {
            // Pleasant double chime
            [523.25, 659.25].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t + idx * 0.1);

                gain.gain.setValueAtTime(0.2, t + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t + idx * 0.1);
                osc.stop(t + 0.8);
            });
        } else {
            // Common solid thud
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
        }
    }

    // Cash register / coin selling sound
    playCash() {
        if (this.muted || !this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        
        // Two high metallic jingles
        [987.77, 1318.51].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.08);

            gain.gain.setValueAtTime(0.2, t + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + idx * 0.08);
            osc.stop(t + idx * 0.08 + 0.35);
        });
    }
}

window.soundEngine = new SoundEngine();

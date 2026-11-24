// =========================================================================
// 2. COZY SYNTHESIZED WEB AUDIO
// =========================================================================
const SoundFX = {
  ctx: null,
  enabled: true,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },
  playTone(freq, duration = 0.12, type = 'sine', vol = 0.055, delay = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },
  click() { this.playTone(540, 0.065, 'triangle', 0.038); },
  build() {
    this.playTone(392, 0.11, 'triangle', 0.055, 0);
    this.playTone(523.25, 0.13, 'triangle', 0.055, 0.07);
    this.playTone(659.25, 0.18, 'sine', 0.05, 0.14);
  },
  upgrade() {
    this.playTone(523.25, 0.10, 'sine', 0.048, 0);
    this.playTone(659.25, 0.10, 'sine', 0.048, 0.06);
    this.playTone(783.99, 0.16, 'sine', 0.052, 0.12);
  },
  reward() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.playTone(f, 0.15, 'sine', 0.048, i * 0.07));
  }
};

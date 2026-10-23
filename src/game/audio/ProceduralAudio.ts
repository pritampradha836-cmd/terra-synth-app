/**
 * 100% Procedural Web Audio API Sound Design.
 * No external .mp3 or audio files. Zero 404 dependencies.
 */

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientSubOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  public isMuted: boolean = false;
  private currentFreq: number = 174.6;

  constructor() {
    // AudioContext will be initialized on first user gesture to comply with browser autoplay policy
  }

  private initCtx(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupAmbientDrone();
      return true;
    } catch {
      return false;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  private setupAmbientDrone(): void {
    if (!this.ctx || !this.masterGain) return;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.ambientFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    this.ambientGain.connect(this.ambientFilter);
    this.ambientFilter.connect(this.masterGain);

    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.setValueAtTime(this.currentFreq, this.ctx.currentTime);
    this.ambientOsc.connect(this.ambientGain);
    this.ambientOsc.start();

    this.ambientSubOsc = this.ctx.createOscillator();
    this.ambientSubOsc.type = 'triangle';
    this.ambientSubOsc.frequency.setValueAtTime(this.currentFreq / 2, this.ctx.currentTime);
    this.ambientSubOsc.connect(this.ambientGain);
    this.ambientSubOsc.start();
  }

  public setBiomeHarmonic(freq: number): void {
    if (!this.ctx || !this.ambientOsc || !this.ambientSubOsc) return;
    this.currentFreq = freq;
    const now = this.ctx.currentTime;
    this.ambientOsc.frequency.setTargetAtTime(freq, now, 1.2);
    this.ambientSubOsc.frequency.setTargetAtTime(freq / 2, now, 1.2);
  }

  /**
   * Player Footstep: Soft filtered noise click
   */
  public playFootstep(): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Energy Blade Slash: Pitch drop bandpass sweep
   */
  public playSlash(comboIndex: number = 0): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const basePitch = 380 + comboIndex * 80;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(basePitch, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.3, now + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(basePitch * 1.5, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Dash / Blink: Sub whoosh + high filtered noise rush
   */
  public playDash(): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Hit impact: punchy transient + metallic thump
   */
  public playHit(isCrit: boolean = false): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 260 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + (isCrit ? 0.25 : 0.14));

    gain.gain.setValueAtTime(isCrit ? 0.45 : 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.25 : 0.14));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + (isCrit ? 0.25 : 0.14));
  }

  /**
   * Kinetic Shockwave detonation: expanding explosion boom
   */
  public playShockwave(): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.45);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Shield Parry Deflect: Crystal square chime
   */
  public playParry(): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [880, 1320, 1760].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.02);

      gain.gain.setValueAtTime(0.18, now + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.02 + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.02);
      osc.stop(now + idx * 0.02 + 0.2);
    });
  }

  /**
   * Shrine activation: Celestial pentatonic arpeggio
   */
  public playShrineActivation(): void {
    if (!this.initCtx() || this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.2, 659.2]; // C major pentatonic

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  }
}

export const audioSystem = new ProceduralAudio();

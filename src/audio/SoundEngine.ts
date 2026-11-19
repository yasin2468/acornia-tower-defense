/** Random pitch multiplier in [1 - spread, 1 + spread] (default ±10 %). */
export function randomizePitch(freq: number, spread = 0.1, rnd: () => number = Math.random): number {
  const s = Math.max(0, Math.min(0.5, spread));
  return freq * (1 - s + rnd() * 2 * s);
}

/**
 * Polyphony limiter: tracks voice end-times; low-priority voices are dropped when the pool
 * is full, high-priority ones (crit/boss/explosion) get a small reserved head-room.
 */
export class VoiceLimiter {
  private ends: number[] = [];

  readonly maxVoices: number;
  readonly reservedForPriority: number;

  constructor(maxVoices = 26, reservedForPriority = 6) {
    this.maxVoices = maxVoices;
    this.reservedForPriority = reservedForPriority;
  }

  /** Returns true if a voice may start at `nowSec` and lasts `durationSec`. */
  acquire(nowSec: number, durationSec: number, priority: 0 | 1 | 2 = 1): boolean {
    this.ends = this.ends.filter((e) => e > nowSec);
    const cap = priority >= 2 ? this.maxVoices + this.reservedForPriority : priority === 1 ? this.maxVoices : Math.floor(this.maxVoices * 0.7);
    if (this.ends.length >= cap) return false;
    this.ends.push(nowSec + Math.max(0, durationSec));
    return true;
  }

  activeCount(nowSec: number): number {
    return this.ends.filter((e) => e > nowSec).length;
  }
}

type Priority = 0 | 1 | 2;
export type MusicTheme = 'none' | 'menu' | 'forest' | 'canyon' | 'cavern' | 'snow';

interface BiomeProgression {
  tempoMs: number;
  notes: readonly number[];
  wave: OscillatorType;
  gain: number;
}

const BIOME_MUSIC: Record<Exclude<MusicTheme, 'none'>, BiomeProgression> = {
  menu: { tempoMs: 460, notes: [261.6, 329.6, 392.0, 493.9, 392.0, 329.6, 293.7, 392.0], wave: 'triangle', gain: 0.042 },
  forest: { tempoMs: 420, notes: [293.7, 349.2, 440.0, 523.3, 440.0, 392.0, 349.2, 440.0], wave: 'triangle', gain: 0.04 },
  canyon: { tempoMs: 360, notes: [220.0, 261.6, 329.6, 392.0, 440.0, 392.0, 329.6, 293.7], wave: 'triangle', gain: 0.042 },
  cavern: { tempoMs: 520, notes: [246.9, 311.1, 370.0, 493.9, 370.0, 311.1, 277.2, 370.0], wave: 'sine', gain: 0.045 },
  snow: { tempoMs: 490, notes: [329.6, 392.0, 493.9, 587.3, 659.3, 493.9, 392.0, 329.6], wave: 'sine', gain: 0.04 },
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: AudioNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private readonly limiter = new VoiceLimiter(26, 6);
  private readonly lastGroupAt = new Map<string, number>();
  private musicTheme: MusicTheme = 'none';
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  enabled = true;
  musicEnabled = true;

  getMusicTheme(): MusicTheme {
    return this.musicTheme;
  }

  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  setMusicTheme(theme: MusicTheme): void {
    this.musicTheme = theme;
    this.syncMusicLoop();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.syncMusicLoop();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncMusicLoop();
  }

  private syncMusicLoop(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!this.enabled || !this.musicEnabled || this.musicTheme === 'none' || typeof window === 'undefined') {
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
      return;
    }
    const spec = BIOME_MUSIC[this.musicTheme];
    this.musicTimer = setInterval(() => this.playMusicStep(spec), spec.tempoMs);
  }

  private playMusicStep(spec: BiomeProgression): void {
    if (!this.enabled || !this.musicEnabled || this.musicTheme === 'none') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicBus) return;
    const now = ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(1.0, now, 0.08);
    const freq = spec.notes[this.musicStep % spec.notes.length];
    this.musicStep += 1;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(spec.gain, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      // Master bus: gain -> DynamicsCompressor -> destination (glues stacked hits, prevents clipping)
      const master = this.ctx.createGain();
      master.gain.value = 0.92;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 10;
      comp.ratio.value = 4.5;
      comp.attack.value = 0.003;
      comp.release.value = 0.14;
      master.connect(comp);
      comp.connect(this.ctx.destination);
      this.bus = master;
      const mBus = this.ctx.createGain();
      mBus.gain.value = 1.0;
      mBus.connect(comp);
      this.musicBus = mBus;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuf) {
      const len = Math.floor(this.ctx.sampleRate * 0.35);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuf = buf;
    }
    return this.ctx;
  }

  /** Per-group rate limit (seconds) so 30 simultaneous arrows don't machine-gun the mix. */
  private throttle(group: string, minIntervalSec: number): boolean {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastGroupAt.get(group) ?? -1e9;
    if (nowMs - last < minIntervalSec * 1000) return false;
    this.lastGroupAt.set(group, nowMs);
    return true;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainPeak = 0.08,
    delay = 0,
    priority: Priority = 1,
    pitchSpread = 0.1,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.bus) return;
    const t0 = ctx.currentTime + delay;
    if (!this.limiter.acquire(ctx.currentTime, delay + duration + 0.02, priority)) return;
    const k = randomizePitch(1, pitchSpread);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * k, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * k), t0 + duration);
    gain.gain.setValueAtTime(0.0008, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    osc.connect(gain);
    gain.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noiseBurst(
    filterFreq: number,
    filterType: BiquadFilterType,
    duration: number,
    gainPeak: number,
    q = 1.4,
    delay = 0,
    priority: Priority = 1,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuf || !this.bus) return;
    const t0 = ctx.currentTime + delay;
    if (!this.limiter.acquire(ctx.currentTime, delay + duration + 0.02, priority)) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.setValueAtTime(randomizePitch(1, 0.12), t0);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(randomizePitch(filterFreq, 0.08), t0);
    filter.Q.setValueAtTime(q, t0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);
    src.start(t0, Math.random() * 0.2);
    src.stop(t0 + duration + 0.02);
  }

  /** Layered transient: crisp 6-10 ms high click on top + optional sub "thump" body. */
  private transient(clickGain: number, thumpGain = 0, thumpFreq = 95, priority: Priority = 1): void {
    this.noiseBurst(5200, 'highpass', 0.012, clickGain, 0.7, 0, priority);
    if (thumpGain > 0) {
      this.tone(thumpFreq, thumpFreq * 0.45, 0.11, 'sine', thumpGain, 0, priority, 0.06);
    }
  }

  playBuild(): void {
    this.transient(0.05, 0.11, 110, 2);
    this.tone(140, 75, 0.09, 'triangle', 0.11, 0, 2);
    this.tone(330, 440, 0.1, 'triangle', 0.09, 0.03, 2, 0.03);
    this.tone(523, 659, 0.12, 'triangle', 0.08, 0.08, 2, 0.03);
  }

  playUpgrade(): void {
    this.transient(0.05, 0.08, 120, 2);
    this.tone(392, 523, 0.1, 'triangle', 0.09, 0, 2, 0.02);
    this.tone(523, 659, 0.1, 'triangle', 0.09, 0.06, 2, 0.02);
    this.tone(659, 880, 0.14, 'triangle', 0.1, 0.12, 2, 0.02);
  }

  playShoot(kind: 'arrow' | 'mortar' | 'emp' | 'heavy'): void {
    if (kind === 'arrow') {
      if (!this.throttle('shoot_arrow', 0.035)) return;
      this.tone(620, 290, 0.055, 'triangle', 0.045, 0, 0);
      this.noiseBurst(2400, 'highpass', 0.035, 0.025, 1.0, 0, 0);
    } else if (kind === 'mortar') {
      if (!this.throttle('shoot_mortar', 0.06)) return;
      this.transient(0.04, 0.12, 82, 1);
      this.tone(165, 52, 0.19, 'triangle', 0.11);
      this.noiseBurst(420, 'lowpass', 0.14, 0.06, 0.9);
    } else if (kind === 'emp') {
      if (!this.throttle('shoot_emp', 0.04)) return;
      this.noiseBurst(3800, 'bandpass', 0.05, 0.035, 2.5, 0, 0);
      this.tone(760, 410, 0.09, 'sine', 0.045, 0, 0);
      this.tone(1140, 620, 0.08, 'triangle', 0.03, 0.015, 0);
    } else {
      if (!this.throttle('shoot_heavy', 0.04)) return;
      this.transient(0.05, 0.07, 120, 1);
      this.tone(340, 115, 0.12, 'sawtooth', 0.05);
      this.noiseBurst(1600, 'bandpass', 0.05, 0.035, 1.8);
    }
  }

  playHit(isCrit: boolean, isArmorBreak = false, heavy = false): void {
    const important = isCrit || isArmorBreak || heavy;
    if (!this.throttle(important ? 'hit_crit' : 'hit', important ? 0.03 : 0.05)) return;
    const pr: Priority = important ? 2 : 0;
    // Layered impact: transient click + filtered noise body + pitched knock (+ crit ping)
    this.transient(important ? 0.07 : 0.04, important ? 0.09 : 0.035, important ? 105 : 140, pr);
    this.noiseBurst(isCrit ? 1900 : 1250, 'bandpass', 0.045, isCrit ? 0.07 : 0.038, 1.6, 0, pr);
    this.tone(isCrit ? 480 : 280, isCrit ? 190 : 110, 0.06, 'triangle', isCrit ? 0.08 : 0.045, 0, pr);
    if (isCrit || isArmorBreak) {
      this.tone(1040, 1480, 0.08, 'sine', 0.055, 0.01, pr, 0.05);
    }
  }

  playExplosion(heavy = false): void {
    if (!this.throttle(heavy ? 'boom_heavy' : 'boom', heavy ? 0.05 : 0.07)) return;
    this.transient(heavy ? 0.09 : 0.07, heavy ? 0.2 : 0.15, heavy ? 70 : 82, 2);
    this.tone(heavy ? 135 : 160, 34, heavy ? 0.3 : 0.22, 'triangle', heavy ? 0.15 : 0.11, 0, 2);
    this.noiseBurst(heavy ? 540 : 680, 'lowpass', heavy ? 0.28 : 0.18, heavy ? 0.12 : 0.08, 0.8, 0, 2);
    // Debris crackle tail
    this.noiseBurst(2600, 'bandpass', 0.09, heavy ? 0.04 : 0.03, 3.0, 0.05, 1);
  }

  playZap(): void {
    if (!this.throttle('zap', 0.06)) return;
    this.noiseBurst(4200, 'bandpass', 0.07, 0.05, 4.0, 0, 1);
    this.tone(1800, 600, 0.07, 'square', 0.025, 0, 1);
  }

  playFreeze(): void {
    if (!this.throttle('freeze', 0.12)) return;
    this.tone(1760, 2640, 0.12, 'sine', 0.04, 0, 1, 0.04);
    this.noiseBurst(6200, 'highpass', 0.14, 0.03, 0.8, 0.01, 1);
  }

  playScrapBreak(): void {
    if (!this.throttle('scrap', 0.04)) return;
    this.transient(0.05, 0.06, 130, 1);
    this.noiseBurst(1550, 'bandpass', 0.09, 0.06, 2.0);
    this.tone(320, 95, 0.11, 'square', 0.045);
  }

  playCoin(): void {
    if (!this.throttle('coin', 0.05)) return;
    this.tone(988, 988, 0.055, 'sine', 0.045, 0, 1, 0.03);
    this.tone(1319, 1319, 0.085, 'sine', 0.045, 0.045, 1, 0.03);
  }

  playBossSiren(): void {
    this.tone(240, 130, 0.36, 'sawtooth', 0.09, 0, 2, 0.02);
    this.tone(180, 100, 0.38, 'triangle', 0.08, 0.12, 2, 0.02);
  }
}

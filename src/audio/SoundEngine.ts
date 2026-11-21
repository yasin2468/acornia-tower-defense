import type { HeroId } from '../data/enemies.ts';
import type { SynergyComboId } from '../data/synergies.ts';

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
export type MusicTheme = 'none' | 'menu' | 'forest' | 'canyon' | 'cavern' | 'snow' | 'foundry';

interface BiomeProgression {
  tempoMs: number;
  notes: readonly number[];
  bass: readonly number[];
  chords: readonly (readonly number[])[];
  wave: OscillatorType;
  gain: number;
  perc: boolean;
}

const BIOME_MUSIC: Record<Exclude<MusicTheme, 'none'>, BiomeProgression> = {
  menu: {
    tempoMs: 460,
    notes: [261.6, 329.6, 392.0, 493.9, 392.0, 329.6, 293.7, 392.0],
    bass: [130.8, 130.8, 146.8, 164.8],
    chords: [
      [261.6, 329.6],
      [293.7, 392.0],
    ],
    wave: 'triangle',
    gain: 0.015,
    perc: false,
  },
  forest: {
    tempoMs: 420,
    notes: [293.7, 349.2, 440.0, 523.3, 440.0, 392.0, 349.2, 440.0],
    bass: [146.8, 174.6, 130.8, 164.8],
    chords: [
      [293.7, 440.0],
      [261.6, 392.0],
    ],
    wave: 'triangle',
    gain: 0.014,
    perc: true,
  },
  canyon: {
    tempoMs: 360,
    notes: [220.0, 261.6, 329.6, 392.0, 440.0, 392.0, 329.6, 293.7],
    bass: [110.0, 130.8, 146.8, 110.0],
    chords: [
      [220.0, 329.6],
      [196.0, 293.7],
    ],
    wave: 'triangle',
    gain: 0.015,
    perc: true,
  },
  cavern: {
    tempoMs: 500,
    notes: [246.9, 311.1, 370.0, 493.9, 370.0, 311.1, 277.2, 370.0],
    bass: [123.5, 110.0, 146.8, 123.5],
    chords: [
      [246.9, 370.0],
      [220.0, 329.6],
    ],
    wave: 'sine',
    gain: 0.016,
    perc: true,
  },
  snow: {
    tempoMs: 470,
    notes: [329.6, 392.0, 493.9, 587.3, 659.3, 493.9, 392.0, 329.6],
    bass: [164.8, 196.0, 146.8, 130.8],
    chords: [
      [329.6, 493.9],
      [293.7, 440.0],
    ],
    wave: 'sine',
    gain: 0.014,
    perc: true,
  },
  foundry: {
    tempoMs: 340,
    notes: [196.0, 233.1, 293.7, 349.2, 293.7, 261.6, 233.1, 293.7],
    bass: [98.0, 116.5, 130.8, 98.0],
    chords: [
      [196.0, 293.7],
      [174.6, 261.6],
    ],
    wave: 'sawtooth',
    gain: 0.012,
    perc: true,
  },
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
  private bossIntensity = false;
  enabled = true;
  musicEnabled = true;

  getMusicTheme(): MusicTheme {
    return this.musicTheme;
  }

  isBossIntensity(): boolean {
    return this.bossIntensity;
  }

  setBossIntensity(active: boolean): void {
    if (this.bossIntensity === active) return;
    this.bossIntensity = active;
    this.syncMusicLoop();
  }

  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().then(() => this.syncMusicLoop()).catch(() => {});
      return;
    }
    if (this.musicTimer === null && this.enabled && this.musicEnabled && this.musicTheme !== 'none') {
      this.syncMusicLoop();
    }
  }

  suspend(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
      void this.ctx.suspend().catch(() => {});
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
    const tempo = Math.max(180, Math.round(spec.tempoMs * (this.bossIntensity ? 0.82 : 1)));
    this.musicTimer = setInterval(() => this.playMusicStep(spec), tempo);
  }

  private playMusicStep(spec: BiomeProgression): void {
    if (!this.enabled || !this.musicEnabled || this.musicTheme === 'none') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicBus) return;
    const now = ctx.currentTime;
    const stepIdx = this.musicStep;
    this.musicStep += 1;

    // 1. Melodic voice
    const freq = spec.notes[stepIdx % spec.notes.length];
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(spec.gain, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + 0.32);

    // 2. Warm low-pass bass pulse every 2 steps
    if (stepIdx % 2 === 0 && spec.bass.length > 0) {
      const bassFreq = spec.bass[Math.floor(stepIdx / 2) % spec.bass.length];
      const bOsc = ctx.createOscillator();
      const bFilt = ctx.createBiquadFilter();
      const bGain = ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(bassFreq, now);
      bFilt.type = 'lowpass';
      bFilt.frequency.value = 340;
      const bPeak = spec.gain * (this.bossIntensity ? 1.45 : 1.05);
      bGain.gain.setValueAtTime(0.0001, now);
      bGain.gain.linearRampToValueAtTime(bPeak, now + 0.02);
      bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
      bOsc.connect(bFilt);
      bFilt.connect(bGain);
      bGain.connect(this.musicBus);
      bOsc.start(now);
      bOsc.stop(now + 0.46);
    }

    // 3. Soft chord pad every 4 steps
    if (stepIdx % 4 === 0 && spec.chords.length > 0) {
      const chord = spec.chords[Math.floor(stepIdx / 4) % spec.chords.length];
      for (const cf of chord) {
        const cOsc = ctx.createOscillator();
        const cGain = ctx.createGain();
        cOsc.type = 'sine';
        cOsc.frequency.setValueAtTime(cf, now);
        cGain.gain.setValueAtTime(0.0001, now);
        cGain.gain.linearRampToValueAtTime(spec.gain * 0.42, now + 0.12);
        cGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
        cOsc.connect(cGain);
        cGain.connect(this.musicBus);
        cOsc.start(now);
        cOsc.stop(now + 0.98);
      }
    }

    // 4. Rhythm shaker + Boss war drum thump
    if (spec.perc && (stepIdx % 2 === 1 || this.bossIntensity) && this.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 4800;
      const pGain = ctx.createGain();
      pGain.gain.setValueAtTime(0.0001, now);
      pGain.gain.linearRampToValueAtTime(this.bossIntensity ? 0.011 : 0.006, now + 0.004);
      pGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);
      src.connect(filt);
      filt.connect(pGain);
      pGain.connect(this.musicBus);
      src.start(now);
      src.stop(now + 0.055);
    }

    if (this.bossIntensity && stepIdx % 4 === 0) {
      const dOsc = ctx.createOscillator();
      const dGain = ctx.createGain();
      dOsc.type = 'sine';
      dOsc.frequency.setValueAtTime(108, now);
      dOsc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      dGain.gain.setValueAtTime(0.0001, now);
      dGain.gain.linearRampToValueAtTime(spec.gain * 1.9, now + 0.006);
      dGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      dOsc.connect(dGain);
      dGain.connect(this.musicBus);
      dOsc.start(now);
      dOsc.stop(now + 0.2);
    }
  }

  private duckMusic(level = 0.35, releaseSec = 0.22): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.enabled || !this.musicEnabled) return;
    const now = ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(Math.max(0.05, level), now, 0.015);
    this.musicBus.gain.setTargetAtTime(1.0, now + 0.05, releaseSec);
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
      if (typeof this.ctx.createBiquadFilter === 'function') {
        const mWarm = this.ctx.createBiquadFilter();
        mWarm.type = 'lowpass';
        mWarm.frequency.value = 1900;
        mBus.connect(mWarm);
        mWarm.connect(comp);
      } else {
        mBus.connect(comp);
      }
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
    this.transient(0.055, 0.12, 110, 2);
    this.noiseBurst(1350, 'bandpass', 0.055, 0.09, 1.8, 0, 2);
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

  playShoot(kind: 'arrow' | 'falcon' | 'mortar' | 'acid' | 'cannon' | 'emp' | 'rune' | 'heavy'): void {
    if (kind === 'arrow') {
      if (!this.throttle('shoot_arrow', 0.04)) return;
      this.tone(720, 310, 0.065, 'triangle', 0.085, 0, 0);
      this.noiseBurst(3200, 'highpass', 0.04, 0.048, 1.1, 0, 0);
    } else if (kind === 'falcon') {
      if (!this.throttle('shoot_falcon', 0.04)) return;
      this.tone(980, 440, 0.075, 'triangle', 0.085, 0, 0);
      this.noiseBurst(4200, 'bandpass', 0.055, 0.055, 2.2, 0, 0);
    } else if (kind === 'mortar') {
      if (!this.throttle('shoot_mortar', 0.06)) return;
      this.transient(0.07, 0.2, 68, 1);
      this.tone(110, 38, 0.24, 'sine', 0.2, 0, 1);
      this.noiseBurst(460, 'lowpass', 0.16, 0.1, 0.9);
      this.duckMusic(0.55, 0.18);
    } else if (kind === 'acid') {
      if (!this.throttle('shoot_acid', 0.055)) return;
      this.transient(0.055, 0.1, 125, 1);
      this.tone(460, 195, 0.14, 'triangle', 0.11, 0, 1);
      this.noiseBurst(2800, 'bandpass', 0.11, 0.075, 2.0, 0.015, 1);
    } else if (kind === 'cannon') {
      if (!this.throttle('shoot_cannon', 0.07)) return;
      this.transient(0.1, 0.26, 56, 2);
      this.tone(95, 30, 0.3, 'sine', 0.24, 0, 2);
      this.tone(210, 72, 0.16, 'sawtooth', 0.09, 0.01, 1);
      this.noiseBurst(380, 'lowpass', 0.22, 0.14, 0.8);
      this.duckMusic(0.45, 0.22);
    } else if (kind === 'emp') {
      if (!this.throttle('shoot_emp', 0.04)) return;
      this.noiseBurst(4200, 'bandpass', 0.06, 0.058, 2.8, 0, 0);
      this.tone(860, 440, 0.095, 'sine', 0.085, 0, 0);
      this.tone(1320, 680, 0.08, 'triangle', 0.055, 0.012, 0);
    } else if (kind === 'rune') {
      if (!this.throttle('shoot_rune', 0.04)) return;
      this.tone(1480, 880, 0.09, 'sine', 0.08, 0, 0, 0.05);
      this.tone(980, 560, 0.07, 'triangle', 0.055, 0.01, 0, 0.05);
      this.noiseBurst(4600, 'highpass', 0.04, 0.04, 1.5, 0, 0);
    } else {
      if (!this.throttle('shoot_heavy', 0.045)) return;
      this.transient(0.085, 0.14, 108, 1);
      this.tone(360, 105, 0.14, 'sawtooth', 0.12);
      this.tone(145, 55, 0.15, 'sine', 0.15, 0, 1);
      this.noiseBurst(1900, 'bandpass', 0.065, 0.075, 1.8);
    }
  }

  playAcidSplash(): void {
    if (!this.throttle('acid_splash', 0.06)) return;
    this.noiseBurst(4400, 'highpass', 0.1, 0.085, 1.3, 0, 1);
    this.noiseBurst(2100, 'bandpass', 0.18, 0.08, 2.2, 0.02, 1);
    this.tone(580, 260, 0.14, 'triangle', 0.08, 0.01, 1);
  }

  playSeismicSlam(): void {
    if (!this.throttle('seismic_slam', 0.07)) return;
    this.transient(0.09, 0.24, 62, 2);
    this.tone(110, 34, 0.28, 'sine', 0.2, 0, 2);
    this.noiseBurst(480, 'lowpass', 0.24, 0.13, 0.85, 0.02, 2);
    this.duckMusic(0.38, 0.22);
  }

  playHeroAttack(heroId: HeroId): void {
    if (heroId === 'kizil_kuyruk') {
      if (!this.throttle('hero_flask', 0.06)) return;
      this.tone(1180, 580, 0.11, 'triangle', 0.075, 0, 1);
      this.noiseBurst(4200, 'bandpass', 0.09, 0.065, 2.0, 0.04, 1);
      return;
    }
    if (heroId === 'kaya_dis') {
      if (!this.throttle('hero_boar', 0.08)) return;
      this.transient(0.09, 0.18, 86, 2);
      this.tone(115, 40, 0.16, 'sine', 0.18, 0, 2);
      this.noiseBurst(1100, 'lowpass', 0.13, 0.12, 1.1, 0.01, 2);
      return;
    }
    if (heroId === 'ay_kurdu') {
      if (!this.throttle('hero_wolf', 0.07)) return;
      this.noiseBurst(4200, 'bandpass', 0.075, 0.08, 1.6, 0, 2);
      this.noiseBurst(3600, 'bandpass', 0.075, 0.075, 1.8, 0.05, 2);
      this.tone(1520, 1080, 0.09, 'sine', 0.055, 0, 1, 0.05);
      return;
    }
    this.playHeroSlash(true);
  }

  playHit(isCrit: boolean, isArmorBreak = false, heavy = false, resisted = false): void {
    const important = isCrit || isArmorBreak || heavy;
    if (!this.throttle(important ? 'hit_crit' : resisted ? 'hit_resist' : 'hit', important ? 0.03 : 0.045)) return;
    if (resisted && !important) {
      // Metallic armor deflection: bright short ping without heavy thud
      this.transient(0.055, 0.025, 180, 0);
      this.tone(2200, 1480, 0.075, 'sine', 0.085, 0, 0, 0.06);
      this.noiseBurst(4200, 'bandpass', 0.035, 0.05, 3.2, 0, 0);
      return;
    }
    const pr: Priority = important ? 2 : 1;
    // Layered impact: crisp transient click + low body thud + metallic crunch (+ crit chime)
    this.transient(important ? 0.1 : 0.065, important ? 0.2 : 0.11, important ? 88 : 135, pr);
    this.tone(important ? 145 : 165, important ? 48 : 68, important ? 0.12 : 0.075, 'sine', important ? 0.2 : 0.11, 0, pr);
    this.noiseBurst(isCrit ? 2200 : 1400, 'bandpass', important ? 0.07 : 0.05, important ? 0.15 : 0.085, 1.5, 0, pr);
    this.tone(isCrit ? 520 : 290, isCrit ? 190 : 105, 0.075, important ? 'square' : 'triangle', important ? 0.1 : 0.065, 0, pr);
    if (isCrit || isArmorBreak) {
      this.tone(1120, 1680, 0.11, 'sine', 0.11, 0.01, pr, 0.04);
      this.duckMusic(0.35, 0.22);
    } else if (heavy) {
      this.duckMusic(0.55, 0.16);
    }
  }

  playExplosion(heavy = false): void {
    if (!this.throttle(heavy ? 'boom_heavy' : 'boom', heavy ? 0.05 : 0.07)) return;
    this.transient(heavy ? 0.12 : 0.09, heavy ? 0.28 : 0.2, heavy ? 62 : 76, 2);
    this.tone(heavy ? 128 : 155, 32, heavy ? 0.34 : 0.24, 'triangle', heavy ? 0.22 : 0.15, 0, 2);
    this.noiseBurst(heavy ? 540 : 680, 'lowpass', heavy ? 0.3 : 0.2, heavy ? 0.17 : 0.12, 0.8, 0, 2);
    // Debris crackle tail
    this.noiseBurst(2600, 'bandpass', 0.11, heavy ? 0.065 : 0.045, 3.0, 0.05, 1);
    this.duckMusic(heavy ? 0.25 : 0.42, 0.28);
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

  playArmorBreak(): void {
    if (!this.throttle('armor_break', 0.08)) return;
    this.transient(0.085, 0.12, 130, 2);
    this.tone(860, 340, 0.12, 'square', 0.085, 0, 2, 0.05);
    this.noiseBurst(3800, 'bandpass', 0.11, 0.1, 2.2, 0.01, 2);
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

  playEmote(): void {
    if (!this.throttle('emote', 0.15)) return;
    this.tone(587, 784, 0.09, 'triangle', 0.06, 0, 1, 0.04);
    this.tone(784, 988, 0.11, 'sine', 0.06, 0.07, 1, 0.04);
  }

  playHeroSlash(heavy = false): void {
    if (!this.throttle('hero_slash', 0.08)) return;
    this.noiseBurst(heavy ? 2400 : 3200, 'bandpass', 0.09, heavy ? 0.12 : 0.085, 1.3, 0, 2);
    this.tone(160, 58, 0.11, 'sine', heavy ? 0.18 : 0.13, 0.01, 2);
    this.transient(0.08, 0.1, 110, 2);
  }

  playBaseHit(): void {
    if (!this.throttle('base_hit', 0.12)) return;
    this.transient(0.11, 0.24, 58, 2);
    this.tone(95, 32, 0.32, 'sine', 0.24, 0, 2, 0.03);
    this.tone(220, 145, 0.22, 'sawtooth', 0.11, 0.03, 2, 0.02);
    this.duckMusic(0.2, 0.4);
  }

  playWoodBreak(): void {
    this.transient(0.08, 0.14, 130, 2);
    this.tone(240, 88, 0.14, 'triangle', 0.14, 0, 2);
    this.noiseBurst(1600, 'bandpass', 0.12, 0.12, 2.0, 0.02, 2);
  }

  playGust(): void {
    this.noiseBurst(1900, 'bandpass', 0.18, 0.09, 1.1, 0, 1);
    this.tone(520, 880, 0.14, 'sine', 0.04, 0, 1, 0.04);
  }

  /** Layered incoming whistle + staggered meteor impacts for Pinecone Rain. */
  playPineconeBarrage(): void {
    this.noiseBurst(2800, 'bandpass', 0.22, 0.09, 2.2, 0, 2);
    this.tone(920, 290, 0.24, 'sine', 0.09, 0, 2, 0.05);
    this.playExplosion(true);
    for (let i = 1; i <= 3; i++) {
      const d = i * 0.085;
      this.tone(145 - i * 12, 38, 0.2, 'triangle', 0.12, d, 2);
      this.noiseBurst(680, 'lowpass', 0.16, 0.09, 0.9, d, 1);
    }
  }

  /** Magnetic induction hum + ascending golden chime arpeggio for Acorn Magnet. */
  playMagnetCast(): void {
    this.tone(240, 560, 0.26, 'triangle', 0.11, 0, 2, 0.03);
    this.noiseBurst(3800, 'bandpass', 0.18, 0.06, 3.0, 0.02, 1);
    const notes = [659, 784, 988, 1319];
    notes.forEach((f, idx) => {
      this.tone(f, f * 1.03, 0.11, 'sine', 0.075, 0.06 + idx * 0.06, 2, 0.02);
    });
    this.duckMusic(0.55, 0.2);
  }

  /** Characterful multi-layer SFX tailored to each Hero Ultimate variant. */
  playHeroUltimate(variant: 'classic' | 'viking' | 'royal' | 'fox_storm' | 'boar_charge' | 'wolf_howl'): void {
    if (variant === 'wolf_howl') {
      // Resonant frost howl glide + crystalline ice chord + rallying chime
      this.tone(290, 540, 0.26, 'triangle', 0.12, 0, 2);
      this.tone(540, 390, 0.3, 'sine', 0.095, 0.18, 2);
      this.noiseBurst(4400, 'highpass', 0.24, 0.085, 1.4, 0.05, 2);
      this.tone(1568, 2093, 0.2, 'sine', 0.07, 0.08, 2, 0.03);
      this.tone(659, 988, 0.24, 'triangle', 0.085, 0.14, 1);
      this.duckMusic(0.35, 0.28);
      return;
    }
    if (variant === 'fox_storm') {
      // Multi-flask shatter glass crackle + emerald chemical fizz + alchemy bell
      this.noiseBurst(5200, 'highpass', 0.18, 0.14, 1.4, 0, 2);
      this.noiseBurst(4600, 'highpass', 0.14, 0.1, 1.8, 0.07, 2);
      this.tone(1480, 620, 0.18, 'triangle', 0.1, 0.02, 2);
      this.noiseBurst(2200, 'bandpass', 0.28, 0.1, 2.4, 0.08, 2);
      this.tone(523, 880, 0.22, 'sine', 0.085, 0.1, 1);
      this.tone(1046, 1319, 0.16, 'sine', 0.07, 0.16, 1);
      this.duckMusic(0.35, 0.25);
      return;
    }
    if (variant === 'royal') {
      // Brass horn fanfare triad + heavy banner plant thud
      this.transient(0.08, 0.22, 74, 2);
      this.tone(392, 392, 0.14, 'triangle', 0.11, 0.02, 2, 0.02);
      this.tone(523, 523, 0.15, 'triangle', 0.11, 0.1, 2, 0.02);
      this.tone(659, 784, 0.26, 'triangle', 0.12, 0.18, 2, 0.02);
      this.duckMusic(0.4, 0.25);
      return;
    }
    if (variant === 'boar_charge') {
      // Heavy seismic slam + rumbling stone fissure
      this.transient(0.11, 0.3, 56, 2);
      this.tone(110, 32, 0.36, 'sawtooth', 0.16, 0, 2);
      this.noiseBurst(520, 'lowpass', 0.34, 0.18, 0.75, 0.03, 2);
      this.duckMusic(0.25, 0.3);
      return;
    }
    if (variant === 'viking') {
      // Leap thunder slam + metallic axe ring
      this.playExplosion(true);
      this.tone(880, 440, 0.18, 'sine', 0.09, 0.04, 2);
      return;
    }
    // classic bear roar + seismic earth thump
    this.playExplosion(true);
    this.tone(240, 120, 0.28, 'sawtooth', 0.11, 0.02, 2);
  }

  /** Soft wooden click for 1st-tap tower preview and unit drawer navigation. */
  playUiTick(): void {
    this.tone(540, 420, 0.045, 'triangle', 0.055, 0, 0, 0.04);
  }

  /** Distinct multi-layered SFX when two complementary towers trigger an elemental combo. */
  playSynergyCombo(comboId: SynergyComboId): void {
    if (comboId === 'shatter') {
      this.noiseBurst(5400, 'highpass', 0.15, 0.12, 1.8, 0, 2);
      this.tone(1180, 1760, 0.14, 'sine', 0.095, 0, 2, 0.04);
      this.tone(180, 72, 0.2, 'triangle', 0.13, 0.02, 2);
    } else if (comboId === 'corrode_crit') {
      this.noiseBurst(2800, 'bandpass', 0.18, 0.11, 2.2, 0, 2);
      this.tone(740, 1180, 0.14, 'triangle', 0.095, 0.01, 2, 0.05);
      this.tone(1480, 990, 0.12, 'sine', 0.08, 0.07, 2);
    } else if (comboId === 'ignite') {
      this.transient(0.09, 0.22, 82, 2);
      this.noiseBurst(1100, 'lowpass', 0.26, 0.15, 1.0, 0, 2);
      this.tone(360, 680, 0.18, 'sawtooth', 0.08, 0.02, 2);
    } else {
      // superconduct
      this.noiseBurst(4200, 'bandpass', 0.16, 0.1, 3.4, 0, 2);
      this.tone(920, 1860, 0.13, 'sawtooth', 0.08, 0, 2);
      this.tone(1320, 660, 0.15, 'sine', 0.085, 0.05, 2);
    }
    this.duckMusic(0.55, 0.2);
  }

  /** Warm brass horn call + shield thud when summoning Oak Guards. */
  playReinforcementsHorn(): void {
    if (!this.throttle('reinforce_horn', 0.25)) return;
    this.transient(0.07, 0.18, 92, 2);
    this.tone(392, 392, 0.14, 'triangle', 0.1, 0, 2, 0.02);
    this.tone(523, 523, 0.16, 'triangle', 0.11, 0.09, 2, 0.02);
    this.tone(659, 784, 0.24, 'triangle', 0.11, 0.18, 2, 0.03);
    this.duckMusic(0.5, 0.25);
  }

  /** Expressive character voice bark when rallying a hero. */
  playHeroBark(heroId: HeroId): void {
    if (!this.throttle('hero_bark', 0.45)) return;
    if (heroId === 'kizil_kuyruk') {
      this.tone(680, 960, 0.085, 'triangle', 0.07, 0, 1, 0.04);
      this.tone(980, 740, 0.09, 'sine', 0.06, 0.07, 1, 0.04);
    } else if (heroId === 'kaya_dis') {
      this.tone(155, 92, 0.12, 'sawtooth', 0.07, 0, 1, 0.05);
      this.noiseBurst(900, 'lowpass', 0.08, 0.07, 1.2, 0.01, 1);
    } else if (heroId === 'ay_kurdu') {
      this.tone(340, 560, 0.15, 'triangle', 0.075, 0, 1, 0.04);
      this.tone(560, 440, 0.14, 'sine', 0.06, 0.11, 1, 0.04);
    } else {
      this.tone(185, 118, 0.13, 'triangle', 0.085, 0, 1, 0.04);
      this.noiseBurst(750, 'lowpass', 0.09, 0.06, 1.1, 0, 1);
    }
  }
}

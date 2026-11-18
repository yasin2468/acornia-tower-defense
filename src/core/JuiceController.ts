export function easeOutBack(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const m = t - 1;
  return 1 + c3 * m * m * m + c1 * m * m;
}

export function easeOutCubic(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  const m = 1 - t;
  return 1 - m * m * m;
}

export function easeInBack(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

export function evalSquashPop(
  remainingSec: number,
  durationSec: number,
  peakXZ = 1.24,
  peakY = 0.78,
): { sx: number; sy: number; sz: number } {
  if (remainingSec <= 0 || durationSec <= 0) {
    return { sx: 1, sy: 1, sz: 1 };
  }
  const progress = Math.max(0, Math.min(1, 1 - remainingSec / durationSec));
  const k = easeOutBack(progress);
  const sxz = peakXZ + (1 - peakXZ) * k;
  const sy = peakY + (1 - peakY) * k;
  return { sx: sxz, sy, sz: sxz };
}

// ---------------------------------------------------------------------------
// Pure, render-only feedback math (never touches SimulationEngine state).
// ---------------------------------------------------------------------------

/** Default stark white hit-flash length: ~2 solid frames at 60 fps + 1 frame falloff. */
export const HIT_FLASH_DURATION = 0.055;
/** Emissive intensity driven during the flash peak. */
export const HIT_FLASH_EMISSIVE = 1.65;

/**
 * Hit-flash strength 0..1. Holds pure white (1.0) for the first 65 % of the window
 * (>= 2 frames at 60 fps), then drops linearly to exactly 0 so the original colour is restored.
 */
export function hitFlashStrength(elapsedSec: number, durationSec = HIT_FLASH_DURATION): number {
  if (durationSec <= 0 || elapsedSec < 0 || elapsedSec >= durationSec) return 0;
  const hold = durationSec * 0.65;
  if (elapsedSec <= hold) return 1;
  return Math.max(0, 1 - (elapsedSec - hold) / (durationSec - hold));
}

export interface KnockbackImpulse {
  /** World-space XZ offset at the peak of the jolt (metres). */
  dx: number;
  dz: number;
  distance: number;
  /** Peak backward pitch tilt in radians (top of the body leans along the impulse). */
  tiltRad: number;
}

export const KNOCKBACK_HEAVY_M = 0.26;
export const KNOCKBACK_LIGHT_M = 0.14;

/**
 * Directional knockback along the projectile velocity vector.
 * Heavy hits push ~0.26 m, light ~0.14 m; bosses resist (×0.35); reduced motion halves it.
 */
export function computeKnockback(
  dirX: number,
  dirZ: number,
  heavy: boolean,
  opts: { isBoss?: boolean; reducedMotion?: boolean } = {},
): KnockbackImpulse {
  const len = Math.hypot(dirX, dirZ);
  let distance = heavy ? KNOCKBACK_HEAVY_M : KNOCKBACK_LIGHT_M;
  let tiltRad = heavy ? 0.34 : 0.19;
  if (opts.isBoss) {
    distance *= 0.35;
    tiltRad *= 0.4;
  }
  if (opts.reducedMotion) {
    distance *= 0.5;
    tiltRad *= 0.5;
  }
  if (len < 1e-6) {
    return { dx: 0, dz: 0, distance: 0, tiltRad: 0 };
  }
  return { dx: (dirX / len) * distance, dz: (dirZ / len) * distance, distance, tiltRad };
}

export const HIT_JOLT_DURATION = 0.2;

/**
 * Jolt envelope for a knockback: `push` snaps out in the first 20 % then eases home,
 * `tilt` snaps to full instantly and wobbles (damped cosine) back to exactly 0.
 */
export function evalHitJolt(elapsedSec: number, durationSec = HIT_JOLT_DURATION): { push: number; tilt: number } {
  if (durationSec <= 0 || elapsedSec < 0 || elapsedSec >= durationSec) return { push: 0, tilt: 0 };
  const p = elapsedSec / durationSec;
  const push = p < 0.2 ? easeOutCubic(p / 0.2) : 0.5 * (1 + Math.cos((Math.PI * (p - 0.2)) / 0.8));
  const tilt = (1 - p) * (1 - p) * Math.cos(p * Math.PI * 3);
  return { push, tilt };
}

/**
 * Overshoot pop for damage numbers / coin popups: starts at `peak` (1.35) and settles to
 * exactly 1.0 with an easeOutBack curve (tiny undershoot reads as a springy "thunk").
 */
export function popScale(ageSec: number, peak = 1.35, settleSec = 0.16): number {
  if (settleSec <= 0 || ageSec >= settleSec) return 1;
  if (ageSec <= 0) return peak;
  const k = easeOutBack(ageSec / settleSec);
  return peak + (1 - peak) * k;
}

export interface GhostHpState {
  /** Instant HP fraction 0..1 (the solid fill). */
  hp: number;
  /** Delayed trailing "ghost damage" fraction 0..1 (always >= hp). */
  ghost: number;
  /** Seconds since the last damage tick (Infinity if never hit). */
  hitAge: number;
}

/**
 * Delayed ghost-damage HP tracker. On damage the ghost holds for `holdSec`,
 * then drains toward the real HP (fast for big chunks, min `minRatePerSec`) and lands exactly on it.
 */
export class GhostHpTracker {
  private readonly entries = new Map<number, { hp: number; ghost: number; hold: number; hitAge: number }>();

  readonly holdSec: number;
  readonly minRatePerSec: number;
  readonly chunkRate: number;

  constructor(holdSec = 0.3, minRatePerSec = 0.45, chunkRate = 5.5) {
    this.holdSec = holdSec;
    this.minRatePerSec = minRatePerSec;
    this.chunkRate = chunkRate;
  }

  update(id: number, hpFrac: number, dt: number): GhostHpState {
    const hp = Math.max(0, Math.min(1, hpFrac));
    const step = Math.max(0, dt);
    let e = this.entries.get(id);
    if (!e) {
      e = { hp, ghost: hp, hold: 0, hitAge: Number.POSITIVE_INFINITY };
      this.entries.set(id, e);
      return { hp: e.hp, ghost: e.ghost, hitAge: e.hitAge };
    }
    if (hp < e.hp - 1e-6) {
      // Fresh damage: ghost keeps the pre-hit value, restart the hold delay.
      e.ghost = Math.max(e.ghost, e.hp);
      e.hold = this.holdSec;
      e.hitAge = 0;
    } else {
      e.hitAge += step;
      if (e.hold > 0) {
        e.hold = Math.max(0, e.hold - step);
      } else if (e.ghost > hp) {
        const rate = Math.max(this.minRatePerSec, (e.ghost - hp) * this.chunkRate);
        e.ghost = Math.max(hp, e.ghost - rate * step);
      }
    }
    e.hp = hp;
    if (e.ghost < hp) e.ghost = hp;
    return { hp: e.hp, ghost: e.ghost, hitAge: e.hitAge };
  }

  get(id: number): GhostHpState | undefined {
    const e = this.entries.get(id);
    return e ? { hp: e.hp, ghost: e.ghost, hitAge: e.hitAge } : undefined;
  }

  prune(alive: Set<number>): void {
    for (const id of this.entries.keys()) {
      if (!alive.has(id)) this.entries.delete(id);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Micro hit-stop window allowed for heavy impacts (seconds). */
export const MICRO_HITSTOP_MIN = 0.018;
export const MICRO_HITSTOP_MAX = 0.045;

/** Overlapping-safe hit-stop controller running strictly in unscaled real time. */
export class JuiceController {
  private hitStopId = 0;
  private activeId = 0;
  private remainingRealSec = 0;
  private slowTimeScale = 1.0;
  private cooldownRealSec = 0;
  private reducedMotion = false;

  /** Reduced Motion: hit-stop is fully disabled (time never slows). */
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.remainingRealSec = 0;
      this.slowTimeScale = 1.0;
    }
  }

  isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  /** Selective, non-nauseating micro freeze for heavy events, clamped to 18-45 ms. */
  triggerMicroHitStop(durationSec = 0.03, slowScale = 0.1): number {
    const d = Math.max(MICRO_HITSTOP_MIN, Math.min(MICRO_HITSTOP_MAX, durationSec));
    return this.triggerHitStop(d, slowScale);
  }

  triggerHitStop(durationSec = 0.045, slowScale = 0.08): number {
    if (durationSec <= 0 || this.reducedMotion) return this.hitStopId;
    // Skip rapid re-trigger spam inside active cooldown if not already frozen
    if (this.remainingRealSec <= 0 && this.cooldownRealSec > 0) {
      return this.activeId;
    }
    this.hitStopId += 1;
    this.activeId = this.hitStopId;
    this.remainingRealSec = Math.max(this.remainingRealSec, Math.min(0.15, durationSec));
    this.slowTimeScale = Math.max(0.02, Math.min(1, slowScale));
    this.cooldownRealSec = 0.095;
    return this.activeId;
  }

  step(realDt: number): void {
    const dt = Math.max(0, realDt);
    if (this.cooldownRealSec > 0) {
      this.cooldownRealSec = Math.max(0, this.cooldownRealSec - dt);
    }
    if (this.remainingRealSec > 0) {
      this.remainingRealSec = Math.max(0, this.remainingRealSec - dt);
      if (this.remainingRealSec === 0) {
        this.slowTimeScale = 1.0;
      }
    }
  }

  getTimeScale(): number {
    return this.remainingRealSec > 0 ? this.slowTimeScale : 1.0;
  }

  isFrozen(): boolean {
    return this.remainingRealSec > 0;
  }

  reset(): void {
    this.remainingRealSec = 0;
    this.slowTimeScale = 1.0;
    this.cooldownRealSec = 0;
  }
}

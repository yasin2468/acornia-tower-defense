import type { HeroClassId } from '../data/enemies.ts';
import type { HatId, TowerId } from '../data/towers.ts';
import { detectLocale, type Locale } from '../i18n/locales.ts';

export type CardUnitId = TowerId | 'boz_pence';
export type VipTier = 'none' | 'monthly' | 'lifetime';

export interface SaveSettings {
  locale: Locale;
  soundEnabled: boolean;
  batterySaver30Fps: boolean;
  shakeStrength: number; // 0..100
}

export interface SaveState {
  version: number;
  oakCoins: number;
  emeraldGems: number;
  skipTickets: number;
  levelStars: Record<number, number>;
  ironCleared: Record<number, boolean>;
  cardLevels: Record<CardUnitId, number>;
  cardShards: Record<CardUnitId, number>;
  heroClass: HeroClassId;
  unlockedHats: HatId[];
  equippedHat: HatId;
  vipTier: VipTier;
  firstDefeatOfferTriggered: boolean;
  firstDefeatOfferExpiresAt: number;
  firstDefeatBundleBought: boolean;
  afkLastClaimAt: number;
  dailyBoostsDate: string;
  dailyAfkBoostsUsed: number;
  dailyFreeChestsUsed: number;
  tutorialDone: boolean;
  settings: SaveSettings;
  checksum?: number;
}

const STORAGE_KEY = 'palamut_kalesi_save_v1';

export function todayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function computeSaveChecksum(data: Omit<SaveState, 'checksum'>): number {
  const str = JSON.stringify(data);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createInitialSave(nowMs = Date.now()): SaveState {
  return {
    version: 1,
    oakCoins: 240,
    emeraldGems: 80,
    skipTickets: 1,
    levelStars: {},
    ironCleared: {},
    cardLevels: {
      squirrel: 1,
      beaver: 1,
      owl: 1,
      hedgehog: 1,
      boz_pence: 1,
    },
    cardShards: {
      squirrel: 3,
      beaver: 2,
      owl: 1,
      hedgehog: 1,
      boz_pence: 2,
    },
    heroClass: 'auto',
    unlockedHats: ['none', 'pirate', 'chef'],
    equippedHat: 'none',
    vipTier: 'none',
    firstDefeatOfferTriggered: false,
    firstDefeatOfferExpiresAt: 0,
    firstDefeatBundleBought: false,
    afkLastClaimAt: nowMs - 2 * 3600 * 1000, // 2h welcoming patrol waiting
    dailyBoostsDate: todayKey(nowMs),
    dailyAfkBoostsUsed: 0,
    dailyFreeChestsUsed: 0,
    tutorialDone: false,
    settings: {
      locale: detectLocale(),
      soundEnabled: true,
      batterySaver30Fps: false,
      shakeStrength: 80,
    },
  };
}

export class SaveManager {
  private state: SaveState;

  constructor(nowMs = Date.now()) {
    this.state = this.load(nowMs);
    this.rollDailyCounters(nowMs);
  }

  private load(nowMs: number): SaveState {
    if (typeof localStorage === 'undefined') {
      return createInitialSave(nowMs);
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialSave(nowMs);
      const parsed = JSON.parse(raw) as SaveState;
      const { checksum, ...rest } = parsed;
      if (typeof checksum === 'number' && computeSaveChecksum(rest) !== checksum) {
        return createInitialSave(nowMs);
      }
      return { ...createInitialSave(nowMs), ...rest };
    } catch {
      return createInitialSave(nowMs);
    }
  }

  rollDailyCounters(nowMs = Date.now()): void {
    const key = todayKey(nowMs);
    if (this.state.dailyBoostsDate !== key) {
      this.state.dailyBoostsDate = key;
      this.state.dailyAfkBoostsUsed = 0;
      this.state.dailyFreeChestsUsed = 0;
      this.save();
    }
  }

  get(): SaveState {
    return this.state;
  }

  update(mutator: (draft: SaveState) => void): SaveState {
    mutator(this.state);
    this.save();
    return this.state;
  }

  save(): void {
    if (typeof localStorage === 'undefined') return;
    const { checksum: _ignored, ...rest } = this.state;
    const payload: SaveState = {
      ...rest,
      checksum: computeSaveChecksum(rest),
    };
    this.state = payload;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full fallback ignored safely
    }
  }
}

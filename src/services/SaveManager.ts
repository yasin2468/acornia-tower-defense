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

export const SAVE_VERSION = 2;

export interface SaveLoadResult {
  state: SaveState;
  saveRecovered: boolean;
  migrated: boolean;
}

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
    version: SAVE_VERSION,
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

export function migrateSave(parsed: Partial<SaveState>, nowMs = Date.now()): { state: SaveState; migrated: boolean } {
  const prevVersion = typeof parsed.version === 'number' ? parsed.version : 1;
  const state: SaveState = { ...createInitialSave(nowMs), ...parsed, version: SAVE_VERSION };
  return { state, migrated: prevVersion < SAVE_VERSION };
}

export class SaveManager {
  private state: SaveState;
  readonly saveRecovered: boolean;

  constructor(nowMs = Date.now()) {
    const result = this.load(nowMs);
    this.state = result.state;
    this.saveRecovered = result.saveRecovered;
    if (result.migrated || result.saveRecovered) {
      this.save();
    }
    this.rollDailyCounters(nowMs);
  }

  private load(nowMs: number): SaveLoadResult {
    if (typeof localStorage === 'undefined') {
      return { state: createInitialSave(nowMs), saveRecovered: false, migrated: false };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { state: createInitialSave(nowMs), saveRecovered: false, migrated: false };
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') {
        return { state: createInitialSave(nowMs), saveRecovered: false, migrated: false };
      }
      const { checksum, ...rest } = parsed as SaveState;
      const prevVersion = typeof rest.version === 'number' ? rest.version : 1;
      const checksumOk = typeof checksum === 'number' && computeSaveChecksum(rest) === checksum;
      const { state, migrated } = migrateSave(rest as Partial<SaveState>, nowMs);
      if (!checksumOk) {
        console.warn(
          `[SaveManager] Save checksum bozuk — JSON okunabildiği için veriler KURTARILDI (sıfırlama yapılmadı), uyarı: saveRecovered`,
        );
        return { state, saveRecovered: true, migrated };
      }
      if (migrated) {
        console.info(`[SaveManager] Save şeması v${prevVersion} -> v${SAVE_VERSION} olarak migrate edildi.`);
      }
      return { state, saveRecovered: false, migrated };
    } catch {
      return { state: createInitialSave(nowMs), saveRecovered: false, migrated: false };
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

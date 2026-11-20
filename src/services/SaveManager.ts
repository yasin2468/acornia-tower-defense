import type { AuraId, BannerId } from '../data/accessories.ts';
import type { HeroClassId, HeroId } from '../data/enemies.ts';
import { clampTalentRank, createInitialTalents, TALENT_BRANCHES, type TalentBranchId } from '../data/talents.ts';
import type { HatId, TowerId } from '../data/towers.ts';
import { detectLocale, type Locale } from '../i18n/locales.ts';
import { VIP_MONTHLY_DURATION_MS } from './CommercialServices.ts';

export type CardUnitId = TowerId | HeroId;
export type VipTier = 'none' | 'monthly' | 'lifetime';

export interface DailyQuestProgressState {
  kills: number;
  builds: number;
  skills: number;
  wins: number;
}
export type RelicId =
  | 'explosive_acorns'
  | 'giant_hero'
  | 'twin_mortar'
  | 'lightning_refund'
  | 'emerald_bounty'
  | 'frost_thorns';

export interface ExpeditionRunState {
  seed: number;
  stageIndex: number;
  hp: number;
  maxHp: number;
  allowedTowers: TowerId[];
  relics: RelicId[];
  pendingRelicChoices: RelicId[];
}

export interface SaveSettings {
  locale: Locale;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
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
  talents: Record<TalentBranchId, number>;
  cardLevels: Record<CardUnitId, number>;
  cardShards: Record<CardUnitId, number>;
  selectedHero: HeroId;
  unlockedHeroes: HeroId[];
  heroClass: HeroClassId;
  unlockedHats: HatId[];
  equippedHat: HatId;
  unlockedAuras: AuraId[];
  equippedAura: AuraId;
  unlockedBanners: BannerId[];
  equippedBanner: BannerId;
  discoveredIds: string[];
  claimedJournalIds: string[];
  dailyQuestsProgress: DailyQuestProgressState;
  dailyQuestsClaimed: string[];
  dailyQuestBonusClaimed: boolean;
  claimedAchievementIds: string[];
  totalBattlesWon: number;
  totalTowersBuilt: number;
  totalSkillsCast: number;
  activeExpedition: ExpeditionRunState | null;
  expeditionsCompleted: number;
  trophies: number;
  leagueSeasonStartAt: number;
  claimedLeagueTiers: string[];
  firstCoopRewardClaimed: boolean;
  seasonPassKills: number;
  seasonStartAt: number;
  seasonGoldUnlocked: boolean;
  claimedSeasonFreeTiers: number[];
  claimedSeasonGoldTiers: number[];
  vipTier: VipTier;
  vipExpiresAt: number; // epoch ms; 0 = süre takibi yok (none/ömürlük)
  lastVipClaimAt: number; // son günlük VIP zümrüt talebi; 0 = hiç talep edilmedi
  firstDefeatOfferTriggered: boolean;
  firstDefeatOfferExpiresAt: number;
  firstDefeatBundleBought: boolean;
  afkLastClaimAt: number;
  dailyBoostsDate: string;
  dailyAfkBoostsUsed: number;
  dailyFreeChestsUsed: number;
  seenStoryIds: string[];
  tutorialDone: boolean;
  settings: SaveSettings;
  checksum?: number;
}

const STORAGE_KEY = 'palamut_kalesi_save_v1';

export const SAVE_VERSION = 4;

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
    talents: createInitialTalents(),
    cardLevels: {
      squirrel: 1,
      beaver: 1,
      owl: 1,
      hedgehog: 1,
      badger: 1,
      falcon: 1,
      tortoise: 1,
      lynx: 1,
      boz_pence: 1,
      kizil_kuyruk: 1,
      kaya_dis: 1,
      ay_kurdu: 1,
    },
    cardShards: {
      squirrel: 3,
      beaver: 2,
      owl: 1,
      hedgehog: 1,
      badger: 2,
      falcon: 2,
      tortoise: 1,
      lynx: 1,
      boz_pence: 2,
      kizil_kuyruk: 0,
      kaya_dis: 0,
      ay_kurdu: 0,
    },
    selectedHero: 'boz_pence',
    unlockedHeroes: ['boz_pence'],
    heroClass: 'auto',
    unlockedHats: ['none', 'pirate', 'chef'],
    equippedHat: 'none',
    unlockedAuras: ['none', 'emerald_leaf'],
    equippedAura: 'none',
    unlockedBanners: ['none'],
    equippedBanner: 'none',
    discoveredIds: ['squirrel', 'beaver', 'owl', 'hedgehog', 'badger', 'falcon', 'tortoise', 'lynx', 'boz_pence', 'scout_bot'],
    claimedJournalIds: [],
    dailyQuestsProgress: { kills: 0, builds: 0, skills: 0, wins: 0 },
    dailyQuestsClaimed: [],
    dailyQuestBonusClaimed: false,
    claimedAchievementIds: [],
    totalBattlesWon: 0,
    totalTowersBuilt: 0,
    totalSkillsCast: 0,
    activeExpedition: null,
    expeditionsCompleted: 0,
    trophies: 0,
    leagueSeasonStartAt: nowMs,
    claimedLeagueTiers: [],
    firstCoopRewardClaimed: false,
    seasonPassKills: 0,
    seasonStartAt: nowMs,
    seasonGoldUnlocked: false,
    claimedSeasonFreeTiers: [],
    claimedSeasonGoldTiers: [],
    vipTier: 'none',
    vipExpiresAt: 0,
    lastVipClaimAt: 0,
    firstDefeatOfferTriggered: false,
    firstDefeatOfferExpiresAt: 0,
    firstDefeatBundleBought: false,
    afkLastClaimAt: nowMs - 2 * 3600 * 1000, // 2h welcoming patrol waiting
    dailyBoostsDate: todayKey(nowMs),
    dailyAfkBoostsUsed: 0,
    dailyFreeChestsUsed: 0,
    seenStoryIds: [],
    tutorialDone: false,
    settings: {
      locale: detectLocale(),
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      batterySaver30Fps: false,
      shakeStrength: 80,
    },
  };
}

export function migrateSave(parsed: Partial<SaveState>, nowMs = Date.now()): { state: SaveState; migrated: boolean } {
  const base = createInitialSave(nowMs);
  const prevVersion = typeof parsed.version === 'number' ? parsed.version : 1;
  const rawTalents = (parsed.talents ?? {}) as Partial<Record<TalentBranchId, number>>;
  const talents = createInitialTalents();
  for (const branch of TALENT_BRANCHES) {
    talents[branch.id] = clampTalentRank(rawTalents[branch.id], branch.maxRank);
  }
  const state: SaveState = {
    ...base,
    ...parsed,
    version: SAVE_VERSION,
    talents,
    cardLevels: {
      ...base.cardLevels,
      ...(parsed.cardLevels ?? {}),
    },
    cardShards: {
      ...base.cardShards,
      ...(parsed.cardShards ?? {}),
    },
    settings: {
      ...base.settings,
      ...(parsed.settings ?? {}),
    },
    unlockedHeroes:
      Array.isArray(parsed.unlockedHeroes) && parsed.unlockedHeroes.length > 0
        ? Array.from(new Set(parsed.unlockedHeroes))
        : base.unlockedHeroes,
    unlockedHats:
      Array.isArray(parsed.unlockedHats) && parsed.unlockedHats.length > 0
        ? Array.from(new Set(parsed.unlockedHats))
        : base.unlockedHats,
    unlockedAuras:
      Array.isArray(parsed.unlockedAuras) && parsed.unlockedAuras.length > 0
        ? Array.from(new Set(parsed.unlockedAuras))
        : base.unlockedAuras,
    equippedAura: parsed.equippedAura ?? base.equippedAura,
    unlockedBanners:
      Array.isArray(parsed.unlockedBanners) && parsed.unlockedBanners.length > 0
        ? Array.from(new Set(parsed.unlockedBanners))
        : base.unlockedBanners,
    equippedBanner: parsed.equippedBanner ?? base.equippedBanner,
    discoveredIds:
      Array.isArray(parsed.discoveredIds) && parsed.discoveredIds.length > 0
        ? Array.from(new Set([...base.discoveredIds, ...parsed.discoveredIds]))
        : base.discoveredIds,
    claimedJournalIds: Array.isArray(parsed.claimedJournalIds) ? parsed.claimedJournalIds : [],
    dailyQuestsProgress: {
      ...base.dailyQuestsProgress,
      ...(parsed.dailyQuestsProgress ?? {}),
    },
    dailyQuestsClaimed: Array.isArray(parsed.dailyQuestsClaimed) ? parsed.dailyQuestsClaimed : [],
    dailyQuestBonusClaimed: Boolean(parsed.dailyQuestBonusClaimed),
    claimedAchievementIds: Array.isArray(parsed.claimedAchievementIds) ? parsed.claimedAchievementIds : [],
    totalBattlesWon:
      typeof parsed.totalBattlesWon === 'number' && Number.isFinite(parsed.totalBattlesWon)
        ? Math.max(0, Math.floor(parsed.totalBattlesWon))
        : 0,
    totalTowersBuilt:
      typeof parsed.totalTowersBuilt === 'number' && Number.isFinite(parsed.totalTowersBuilt)
        ? Math.max(0, Math.floor(parsed.totalTowersBuilt))
        : 0,
    totalSkillsCast:
      typeof parsed.totalSkillsCast === 'number' && Number.isFinite(parsed.totalSkillsCast)
        ? Math.max(0, Math.floor(parsed.totalSkillsCast))
        : 0,
    claimedLeagueTiers: Array.isArray(parsed.claimedLeagueTiers) ? parsed.claimedLeagueTiers : [],
    claimedSeasonFreeTiers: Array.isArray(parsed.claimedSeasonFreeTiers) ? parsed.claimedSeasonFreeTiers : [],
    claimedSeasonGoldTiers: Array.isArray(parsed.claimedSeasonGoldTiers) ? parsed.claimedSeasonGoldTiers : [],
    seenStoryIds: Array.isArray(parsed.seenStoryIds) ? Array.from(new Set(parsed.seenStoryIds)) : [],
  };
  state.vipExpiresAt =
    typeof state.vipExpiresAt === 'number' && Number.isFinite(state.vipExpiresAt)
      ? Math.max(0, state.vipExpiresAt)
      : 0;
  state.lastVipClaimAt =
    typeof state.lastVipClaimAt === 'number' && Number.isFinite(state.lastVipClaimAt)
      ? Math.max(0, state.lastVipClaimAt)
      : 0;
  state.trophies = typeof state.trophies === 'number' && Number.isFinite(state.trophies) ? Math.max(0, state.trophies) : 0;
  state.seasonPassKills =
    typeof state.seasonPassKills === 'number' && Number.isFinite(state.seasonPassKills)
      ? Math.max(0, Math.floor(state.seasonPassKills))
      : 0;
  // v2 kayıtlarında VIP süre alanı yoktu: aktif aylık VIP sahibine tam bir ay bağışlanır.
  if (prevVersion < 3 && state.vipTier === 'monthly' && state.vipExpiresAt === 0) {
    state.vipExpiresAt = nowMs + VIP_MONTHLY_DURATION_MS;
  }
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
      this.state.dailyQuestsProgress = { kills: 0, builds: 0, skills: 0, wins: 0 };
      this.state.dailyQuestsClaimed = [];
      this.state.dailyQuestBonusClaimed = false;
      this.save();
    }
  }

  reset(nowMs = Date.now(), preserveSettings = true): SaveState {
    const prevSettings = this.state.settings;
    const fresh = createInitialSave(nowMs);
    if (preserveSettings) {
      fresh.settings = { ...prevSettings };
    }
    this.state = fresh;
    this.save();
    return this.state;
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

  exportSaveCode(): string {
    const { checksum: _ignored, ...rest } = this.state;
    const payload: SaveState = {
      ...rest,
      checksum: computeSaveChecksum(rest),
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
    return `PK1:${b64}`;
  }

  importSaveCode(rawCode: string, nowMs = Date.now()): { ok: boolean; error?: string } {
    const trimmed = rawCode.trim();
    if (!trimmed.startsWith('PK1:') || trimmed.length < 16) {
      return { ok: false, error: 'invalid_format' };
    }
    try {
      const b64 = trimmed.slice(4);
      const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      const json = new TextDecoder().decode(bytes);
      const parsed: unknown = JSON.parse(json);
      if (parsed === null || typeof parsed !== 'object') {
        return { ok: false, error: 'invalid_json' };
      }
      const candidate = parsed as Partial<SaveState>;
      if (typeof candidate.oakCoins !== 'number' || typeof candidate.emeraldGems !== 'number') {
        return { ok: false, error: 'invalid_shape' };
      }
      if (typeof candidate.checksum === 'number') {
        const { checksum, ...rest } = candidate as SaveState;
        if (computeSaveChecksum(rest) !== checksum) {
          return { ok: false, error: 'bad_checksum' };
        }
      }
      const { state } = migrateSave(candidate, nowMs);
      this.state = state;
      this.save();
      this.rollDailyCounters(nowMs);
      return { ok: true };
    } catch {
      return { ok: false, error: 'decode_error' };
    }
  }
}

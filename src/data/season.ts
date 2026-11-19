import { openForestChest } from '../services/ProgressionService.ts';
import type { CardUnitId, SaveManager } from '../services/SaveManager.ts';
import type { MultiMode } from '../server/wsRelay.ts';
import type { HatId } from './towers.ts';

export const LEAGUE_DURATION_MS = 14 * 24 * 3600 * 1000;
export const PVP_WIN_TROPHIES = 28;
export const PVP_LOSS_TROPHIES = 12;
export const FIRST_COOP_GEM_BONUS = 50;

export const SEASON_DURATION_MS = 28 * 24 * 3600 * 1000;
export const KILLS_PER_SEASON_TIER = 35;
export const SEASON_MAX_TIER = 30;
export const SEASON_GOLD_PRICE_USD = 4.99;

export type LeagueTierId = 'oak' | 'bronze' | 'silver' | 'gold' | 'emerald' | 'legend';

export interface LeagueTierSpec {
  id: LeagueTierId;
  minTrophies: number;
  oakCoins: number;
  gems: number;
  epicChest?: boolean;
  hatUnlock?: HatId;
}

export const LEAGUE_TIERS: readonly LeagueTierSpec[] = [
  { id: 'oak', minTrophies: 0, oakCoins: 0, gems: 0 },
  { id: 'bronze', minTrophies: 100, oakCoins: 120, gems: 0 },
  { id: 'silver', minTrophies: 250, oakCoins: 0, gems: 40 },
  { id: 'gold', minTrophies: 450, oakCoins: 250, gems: 0, epicChest: true },
  { id: 'emerald', minTrophies: 700, oakCoins: 0, gems: 100 },
  { id: 'legend', minTrophies: 1000, oakCoins: 0, gems: 180, hatUnlock: 'viking' },
];

export function getLeagueTierForTrophies(trophies: number): LeagueTierSpec {
  let active = LEAGUE_TIERS[0];
  for (const tier of LEAGUE_TIERS) {
    if (trophies >= tier.minTrophies) active = tier;
  }
  return active;
}

export function ensureLeagueSeason(
  saveManager: SaveManager,
  nowMs = Date.now(),
): { reset: boolean; daysLeft: number } {
  const s = saveManager.get();
  if (s.leagueSeasonStartAt <= 0) {
    saveManager.update((d) => {
      d.leagueSeasonStartAt = nowMs;
    });
    return { reset: false, daysLeft: 14 };
  }
  const elapsed = Math.max(0, nowMs - s.leagueSeasonStartAt);
  if (elapsed >= LEAGUE_DURATION_MS) {
    saveManager.update((d) => {
      d.leagueSeasonStartAt = nowMs;
      d.trophies = Math.floor(Math.max(0, d.trophies) * 0.5);
      d.claimedLeagueTiers = [];
    });
    return { reset: true, daysLeft: 14 };
  }
  const daysLeft = Math.max(1, Math.ceil((LEAGUE_DURATION_MS - elapsed) / (24 * 3600 * 1000)));
  return { reset: false, daysLeft };
}

export function recordMultiplayerOutcome(
  saveManager: SaveManager,
  mode: MultiMode,
  won: boolean,
  nowMs = Date.now(),
): { trophyDelta: number; firstCoopGems: number } {
  ensureLeagueSeason(saveManager, nowMs);
  let trophyDelta = 0;
  let firstCoopGems = 0;

  saveManager.update((d) => {
    if (mode === 'pvp') {
      const before = d.trophies;
      d.trophies = won ? d.trophies + PVP_WIN_TROPHIES : Math.max(0, d.trophies - PVP_LOSS_TROPHIES);
      trophyDelta = d.trophies - before;
    } else if (won && !d.firstCoopRewardClaimed) {
      d.firstCoopRewardClaimed = true;
      d.emeraldGems += FIRST_COOP_GEM_BONUS;
      firstCoopGems = FIRST_COOP_GEM_BONUS;
    }
  });

  return { trophyDelta, firstCoopGems };
}

export function claimLeagueTierReward(saveManager: SaveManager, tierId: LeagueTierId): boolean {
  const tier = LEAGUE_TIERS.find((t) => t.id === tierId);
  if (!tier || tier.id === 'oak') return false;
  const s = saveManager.get();
  if (s.trophies < tier.minTrophies) return false;
  if (s.claimedLeagueTiers.includes(tierId)) return false;

  saveManager.update((d) => {
    d.claimedLeagueTiers.push(tierId);
    d.oakCoins += tier.oakCoins;
    d.emeraldGems += tier.gems;
    if (tier.hatUnlock && !d.unlockedHats.includes(tier.hatUnlock)) {
      d.unlockedHats.push(tier.hatUnlock);
    }
  });
  if (tier.epicChest) {
    openForestChest(saveManager, 'epic');
  }
  return true;
}

export interface LeagueRivalEntry {
  nameKey: string;
  trophies: number;
  isPlayer: boolean;
}

export function getLeagueLeaderboard(playerTrophies: number): LeagueRivalEntry[] {
  const entries: LeagueRivalEntry[] = [
    { nameKey: 'league.rival1', trophies: 940, isPlayer: false },
    { nameKey: 'league.rival2', trophies: 620, isPlayer: false },
    { nameKey: 'league.rival3', trophies: 340, isPlayer: false },
    { nameKey: 'league.rival4', trophies: 130, isPlayer: false },
    { nameKey: 'league.you', trophies: playerTrophies, isPlayer: true },
  ];
  return entries.sort((a, b) => b.trophies - a.trophies);
}

export function ensureSeasonPassWindow(
  saveManager: SaveManager,
  nowMs = Date.now(),
): { reset: boolean; daysLeft: number } {
  const s = saveManager.get();
  if (s.seasonStartAt <= 0) {
    saveManager.update((d) => {
      d.seasonStartAt = nowMs;
    });
    return { reset: false, daysLeft: 28 };
  }
  const elapsed = Math.max(0, nowMs - s.seasonStartAt);
  if (elapsed >= SEASON_DURATION_MS) {
    saveManager.update((d) => {
      d.seasonStartAt = nowMs;
      d.seasonPassKills = 0;
      d.seasonGoldUnlocked = false;
      d.claimedSeasonFreeTiers = [];
      d.claimedSeasonGoldTiers = [];
    });
    return { reset: true, daysLeft: 28 };
  }
  const daysLeft = Math.max(1, Math.ceil((SEASON_DURATION_MS - elapsed) / (24 * 3600 * 1000)));
  return { reset: false, daysLeft };
}

export function getSeasonCurrentTier(kills: number): number {
  return Math.min(SEASON_MAX_TIER, Math.floor(Math.max(0, kills) / KILLS_PER_SEASON_TIER));
}

export interface SeasonRewardSpec {
  oakCoins?: number;
  gems?: number;
  shardUnit?: CardUnitId;
  shardCount?: number;
  skipTickets?: number;
  hatUnlock?: HatId;
}

const SEASON_SHARD_UNITS: readonly CardUnitId[] = ['squirrel', 'beaver', 'owl', 'hedgehog', 'boz_pence'];

export function getSeasonTierRewards(tier: number): { free: SeasonRewardSpec; gold: SeasonRewardSpec } {
  const t = Math.max(1, Math.min(SEASON_MAX_TIER, Math.floor(tier)));
  const unit = SEASON_SHARD_UNITS[(t - 1) % SEASON_SHARD_UNITS.length];

  const free: SeasonRewardSpec =
    t % 5 === 0
      ? { gems: 15, shardUnit: unit, shardCount: 3 }
      : t % 2 === 0
        ? { shardUnit: unit, shardCount: 2, oakCoins: 45 + t * 4 }
        : { oakCoins: 55 + t * 5 };

  const gold: SeasonRewardSpec =
    t === SEASON_MAX_TIER
      ? { gems: 150, hatUnlock: 'viking', shardUnit: 'kaya_dis', shardCount: 6 }
      : t % 5 === 0
        ? { gems: 30, skipTickets: 1, shardUnit: unit, shardCount: 4 }
        : { oakCoins: 85 + t * 7, shardUnit: unit, shardCount: 3 };

  return { free, gold };
}

export function claimSeasonTierReward(
  saveManager: SaveManager,
  tier: number,
  track: 'free' | 'gold',
): boolean {
  const cleanTier = Math.floor(tier);
  if (cleanTier < 1 || cleanTier > SEASON_MAX_TIER) return false;
  const s = saveManager.get();
  if (getSeasonCurrentTier(s.seasonPassKills) < cleanTier) return false;
  if (track === 'gold' && !s.seasonGoldUnlocked) return false;
  const claimedList = track === 'gold' ? s.claimedSeasonGoldTiers : s.claimedSeasonFreeTiers;
  if (claimedList.includes(cleanTier)) return false;

  const reward = getSeasonTierRewards(cleanTier)[track];
  saveManager.update((d) => {
    const targetList = track === 'gold' ? d.claimedSeasonGoldTiers : d.claimedSeasonFreeTiers;
    if (!targetList.includes(cleanTier)) targetList.push(cleanTier);
    d.oakCoins += reward.oakCoins ?? 0;
    d.emeraldGems += reward.gems ?? 0;
    d.skipTickets += reward.skipTickets ?? 0;
    if (reward.shardUnit && reward.shardCount) {
      d.cardShards[reward.shardUnit] = (d.cardShards[reward.shardUnit] ?? 0) + reward.shardCount;
    }
    if (reward.hatUnlock && !d.unlockedHats.includes(reward.hatUnlock)) {
      d.unlockedHats.push(reward.hatUnlock);
    }
  });
  return true;
}

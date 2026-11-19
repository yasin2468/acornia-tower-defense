import { HEROES, type HeroId } from '../data/enemies.ts';
import {
  clampTalentRank,
  computeAvailableTalentStars,
  createInitialTalents,
  getNextTalentCost,
  type TalentBranchId,
} from '../data/talents.ts';
import { CARD_MAX_LEVEL } from '../data/towers.ts';
import { isVipActive } from './CommercialServices.ts';
import type { CardUnitId, SaveManager, SaveState } from './SaveManager.ts';

export interface AfkAccumulation {
  hoursElapsed: number;
  capHours: number;
  oakCoins: number;
  shards: number;
}

export interface ChestReward {
  oakCoins: number;
  gems: number;
  cards: Partial<Record<CardUnitId, number>>;
}

const UNIT_IDS: CardUnitId[] = ['squirrel', 'beaver', 'owl', 'hedgehog', 'boz_pence'];

function activeCardPool(save: SaveState): CardUnitId[] {
  const pool = [...UNIT_IDS];
  for (const h of save.unlockedHeroes) {
    if (!pool.includes(h)) pool.push(h);
  }
  return pool;
}

export const AFK_OAK_PER_HOUR = 35;
export const AFK_QUICK_BOOST_HOURS = 4;
export const AFK_QUICK_BOOST_OAK = AFK_OAK_PER_HOUR * AFK_QUICK_BOOST_HOURS; // 140
export const AFK_QUICK_BOOST_SHARDS: Readonly<Record<'squirrel' | 'owl', number>> = { squirrel: 1, owl: 1 };
export const AFK_QUICK_BOOST_TOTAL_SHARDS = AFK_QUICK_BOOST_SHARDS.squirrel + AFK_QUICK_BOOST_SHARDS.owl;

export function getCardUpgradeCost(currentLevel: number): { shards: number; oakCoins: number } {
  return {
    shards: 2 + currentLevel * 2,
    oakCoins: 60 + currentLevel * 45,
  };
}

export function calculateAfkAccumulation(save: SaveState, nowMs = Date.now()): AfkAccumulation {
  const capHours = isVipActive(save, nowMs) ? 16 : 8;
  const elapsedMs = Math.max(0, nowMs - save.afkLastClaimAt);
  const hoursElapsed = Math.min(capHours, elapsedMs / (3600 * 1000));
  const oakCoins = Math.floor(hoursElapsed * AFK_OAK_PER_HOUR);
  const shards = Math.floor(hoursElapsed / 2);
  return {
    hoursElapsed: Number(hoursElapsed.toFixed(1)),
    capHours,
    oakCoins,
    shards,
  };
}

export function claimAfkPatrol(saveManager: SaveManager, nowMs = Date.now()): AfkAccumulation {
  const reward = calculateAfkAccumulation(saveManager.get(), nowMs);
  const pool = activeCardPool(saveManager.get());
  saveManager.update((s) => {
    s.oakCoins += reward.oakCoins;
    for (let i = 0; i < reward.shards; i++) {
      const unit = pool[i % pool.length];
      s.cardShards[unit] += 1;
    }
    s.afkLastClaimAt = nowMs;
  });
  return reward;
}

export function grantQuickAfkBoost(saveManager: SaveManager, nowMs = Date.now()): boolean {
  saveManager.rollDailyCounters(nowMs);
  const s = saveManager.get();
  if (s.dailyAfkBoostsUsed >= 2) return false;
  saveManager.update((draft) => {
    draft.dailyAfkBoostsUsed += 1;
    draft.oakCoins += AFK_QUICK_BOOST_OAK;
    draft.cardShards.squirrel += AFK_QUICK_BOOST_SHARDS.squirrel;
    draft.cardShards.owl += AFK_QUICK_BOOST_SHARDS.owl;
  });
  return true;
}

export function upgradeCard(saveManager: SaveManager, unitId: CardUnitId): boolean {
  const s = saveManager.get();
  const lvl = s.cardLevels[unitId];
  if (lvl >= CARD_MAX_LEVEL) return false;
  const cost = getCardUpgradeCost(lvl);
  if (s.cardShards[unitId] < cost.shards || s.oakCoins < cost.oakCoins) return false;

  saveManager.update((draft) => {
    draft.cardShards[unitId] -= cost.shards;
    draft.oakCoins -= cost.oakCoins;
    draft.cardLevels[unitId] += 1;
  });
  return true;
}

export function openForestChest(
  saveManager: SaveManager,
  tier: 'common' | 'epic',
  seedOffset = Date.now(),
): ChestReward {
  const isEpic = tier === 'epic';
  const reward: ChestReward = {
    oakCoins: isEpic ? 320 : 90,
    gems: isEpic ? 25 : 6,
    cards: {},
  };
  const count = isEpic ? 10 : 3;
  const pool = activeCardPool(saveManager.get());
  for (let i = 0; i < count; i++) {
    const unit = pool[(Math.abs(seedOffset) + i * 3) % pool.length];
    reward.cards[unit] = (reward.cards[unit] ?? 0) + 1;
  }

  saveManager.update((draft) => {
    draft.oakCoins += reward.oakCoins;
    draft.emeraldGems += reward.gems;
    for (const [k, v] of Object.entries(reward.cards)) {
      const id = k as CardUnitId;
      draft.cardShards[id] += v ?? 0;
    }
  });
  return reward;
}

export function upgradeTalent(saveManager: SaveManager, branchId: TalentBranchId): boolean {
  const s = saveManager.get();
  const curRank = clampTalentRank(s.talents[branchId]);
  const cost = getNextTalentCost(curRank);
  if (cost === null) return false;
  const available = computeAvailableTalentStars(s.levelStars, s.ironCleared, s.talents);
  if (available < cost) return false;

  saveManager.update((draft) => {
    draft.talents[branchId] = curRank + 1;
  });
  return true;
}

export function resetTalents(saveManager: SaveManager): boolean {
  const s = saveManager.get();
  const hasAny = Object.values(s.talents).some((r) => clampTalentRank(r) > 0);
  if (!hasAny) return false;
  saveManager.update((draft) => {
    draft.talents = createInitialTalents();
  });
  return true;
}

export function unlockHeroWithGems(saveManager: SaveManager, heroId: HeroId): boolean {
  const s = saveManager.get();
  if (s.unlockedHeroes.includes(heroId)) return false;
  const cost = HEROES[heroId].gemUnlockCost;
  if (cost <= 0 || s.emeraldGems < cost) return false;
  saveManager.update((draft) => {
    draft.emeraldGems -= cost;
    if (!draft.unlockedHeroes.includes(heroId)) draft.unlockedHeroes.push(heroId);
    if (!draft.discoveredIds.includes(heroId)) draft.discoveredIds.push(heroId);
    draft.selectedHero = heroId;
  });
  return true;
}

export function grantCampaignHeroUnlocks(saveManager: SaveManager, clearedLevelId: number): HeroId[] {
  const s = saveManager.get();
  const unlocked: HeroId[] = [];
  for (const h of Object.values(HEROES)) {
    if (clearedLevelId >= h.unlockLevel && !s.unlockedHeroes.includes(h.id)) {
      unlocked.push(h.id);
    }
  }
  if (unlocked.length === 0) return [];
  saveManager.update((draft) => {
    for (const id of unlocked) {
      if (!draft.unlockedHeroes.includes(id)) draft.unlockedHeroes.push(id);
      if (!draft.discoveredIds.includes(id)) draft.discoveredIds.push(id);
    }
  });
  return unlocked;
}

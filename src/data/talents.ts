import { SELL_REFUND_RATE } from './towers.ts';

export type TalentBranchId = 'tower_power' | 'hero_soul' | 'forest_magic' | 'start_economy';

export const TALENT_MAX_RANK = 5;
export const TALENT_RANK_COSTS = [1, 2, 3, 4, 5] as const;

export interface TalentBranchSpec {
  id: TalentBranchId;
  nameKey: string;
  descKey: string;
  capKey: string;
}

export const TALENT_BRANCHES: readonly TalentBranchSpec[] = [
  {
    id: 'tower_power',
    nameKey: 'talent.tower_power.name',
    descKey: 'talent.tower_power.desc',
    capKey: 'talent.tower_power.cap',
  },
  {
    id: 'hero_soul',
    nameKey: 'talent.hero_soul.name',
    descKey: 'talent.hero_soul.desc',
    capKey: 'talent.hero_soul.cap',
  },
  {
    id: 'forest_magic',
    nameKey: 'talent.forest_magic.name',
    descKey: 'talent.forest_magic.desc',
    capKey: 'talent.forest_magic.cap',
  },
  {
    id: 'start_economy',
    nameKey: 'talent.start_economy.name',
    descKey: 'talent.start_economy.desc',
    capKey: 'talent.start_economy.cap',
  },
];

export interface TalentModifiers {
  towerDamagePct: number;
  towerRangePct: number;
  heroHpMult: number;
  heroDamageMult: number;
  heroRespawnReductionSec: number;
  rainDamageMult: number;
  spellCooldownMult: number;
  extraStartGold: number;
  sellRefundRate: number;
}

export function createInitialTalents(): Record<TalentBranchId, number> {
  return {
    tower_power: 0,
    hero_soul: 0,
    forest_magic: 0,
    start_economy: 0,
  };
}

export function clampTalentRank(rank: unknown): number {
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(TALENT_MAX_RANK, Math.floor(rank)));
}

export function getNextTalentCost(currentRank: number): number | null {
  const r = clampTalentRank(currentRank);
  if (r >= TALENT_MAX_RANK) return null;
  return TALENT_RANK_COSTS[r];
}

export function computeTotalEarnedStars(
  levelStars: Record<number, number>,
  ironCleared: Record<number, boolean>,
): number {
  const normalStars = Object.values(levelStars).reduce(
    (sum, s) => sum + Math.max(0, Math.min(3, Math.floor(Number(s) || 0))),
    0,
  );
  const ironStars = Object.values(ironCleared).filter(Boolean).length * 2;
  return normalStars + ironStars;
}

export function computeSpentTalentStars(talents: Partial<Record<TalentBranchId, number>>): number {
  let spent = 0;
  for (const branch of TALENT_BRANCHES) {
    const rank = clampTalentRank(talents[branch.id]);
    for (let i = 0; i < rank; i++) {
      spent += TALENT_RANK_COSTS[i];
    }
  }
  return spent;
}

export function computeAvailableTalentStars(
  levelStars: Record<number, number>,
  ironCleared: Record<number, boolean>,
  talents: Partial<Record<TalentBranchId, number>>,
): number {
  return Math.max(0, computeTotalEarnedStars(levelStars, ironCleared) - computeSpentTalentStars(talents));
}

export function computeTalentModifiers(talents?: Partial<Record<TalentBranchId, number>>): TalentModifiers {
  const towerRank = clampTalentRank(talents?.tower_power);
  const heroRank = clampTalentRank(talents?.hero_soul);
  const magicRank = clampTalentRank(talents?.forest_magic);
  const econRank = clampTalentRank(talents?.start_economy);

  return {
    towerDamagePct: towerRank * 0.04,
    towerRangePct: towerRank >= TALENT_MAX_RANK ? 0.05 : 0,
    heroHpMult: 1 + heroRank * 0.06,
    heroDamageMult: 1 + heroRank * 0.06,
    heroRespawnReductionSec: heroRank >= TALENT_MAX_RANK ? 2 : 0,
    rainDamageMult: 1 + magicRank * 0.08,
    spellCooldownMult: Math.max(0.7, Number((1 - magicRank * 0.05).toFixed(2))),
    extraStartGold: econRank * 12,
    sellRefundRate: econRank >= TALENT_MAX_RANK ? 0.65 : SELL_REFUND_RATE,
  };
}

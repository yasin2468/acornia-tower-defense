import { SELL_REFUND_RATE } from './towers.ts';

export type TalentBranchId =
  | 'tower_power'
  | 'hero_soul'
  | 'forest_magic'
  | 'start_economy'
  | 'siege_ordnance'
  | 'pack_warden'
  | 'frost_alchemy'
  | 'war_logistics'
  | 'apex_warlord'
  | 'world_tree_aegis';

export const TALENT_MAX_RANK = 5;
export const TALENT_RANK_COSTS = [1, 2, 3, 4, 5] as const;

export interface TalentBranchSpec {
  id: TalentBranchId;
  tier: 1 | 2 | 3;
  maxRank: number;
  costs: readonly number[];
  parents: readonly TalentBranchId[];
  reqParentRank: number;
  treePos: { xPct: number; yPct: number };
  accentHex: string;
  nameKey: string;
  descKey: string;
  capKey: string;
}

export const TALENT_BRANCHES: readonly TalentBranchSpec[] = [
  // Kademe 1 — Kök Dallar
  {
    id: 'tower_power',
    tier: 1,
    maxRank: 5,
    costs: [1, 2, 3, 4, 5],
    parents: [],
    reqParentRank: 0,
    treePos: { xPct: 14, yPct: 14 },
    accentHex: '#f4a63a',
    nameKey: 'talent.tower_power.name',
    descKey: 'talent.tower_power.desc',
    capKey: 'talent.tower_power.cap',
  },
  {
    id: 'hero_soul',
    tier: 1,
    maxRank: 5,
    costs: [1, 2, 3, 4, 5],
    parents: [],
    reqParentRank: 0,
    treePos: { xPct: 38, yPct: 14 },
    accentHex: '#ff784f',
    nameKey: 'talent.hero_soul.name',
    descKey: 'talent.hero_soul.desc',
    capKey: 'talent.hero_soul.cap',
  },
  {
    id: 'forest_magic',
    tier: 1,
    maxRank: 5,
    costs: [1, 2, 3, 4, 5],
    parents: [],
    reqParentRank: 0,
    treePos: { xPct: 62, yPct: 14 },
    accentHex: '#48d9a4',
    nameKey: 'talent.forest_magic.name',
    descKey: 'talent.forest_magic.desc',
    capKey: 'talent.forest_magic.cap',
  },
  {
    id: 'start_economy',
    tier: 1,
    maxRank: 5,
    costs: [1, 2, 3, 4, 5],
    parents: [],
    reqParentRank: 0,
    treePos: { xPct: 86, yPct: 14 },
    accentHex: '#ffd24c',
    nameKey: 'talent.start_economy.name',
    descKey: 'talent.start_economy.desc',
    capKey: 'talent.start_economy.cap',
  },
  // Kademe 2 — Oyuna Özel Uzmanlık Dalları
  {
    id: 'siege_ordnance',
    tier: 2,
    maxRank: 3,
    costs: [1, 2, 3],
    parents: ['tower_power'],
    reqParentRank: 2,
    treePos: { xPct: 14, yPct: 50 },
    accentHex: '#ff9248',
    nameKey: 'talent.siege_ordnance.name',
    descKey: 'talent.siege_ordnance.desc',
    capKey: 'talent.siege_ordnance.cap',
  },
  {
    id: 'pack_warden',
    tier: 2,
    maxRank: 3,
    costs: [1, 2, 3],
    parents: ['hero_soul'],
    reqParentRank: 2,
    treePos: { xPct: 38, yPct: 50 },
    accentHex: '#f26b6b',
    nameKey: 'talent.pack_warden.name',
    descKey: 'talent.pack_warden.desc',
    capKey: 'talent.pack_warden.cap',
  },
  {
    id: 'frost_alchemy',
    tier: 2,
    maxRank: 3,
    costs: [1, 2, 3],
    parents: ['forest_magic'],
    reqParentRank: 2,
    treePos: { xPct: 62, yPct: 50 },
    accentHex: '#5ec8ff',
    nameKey: 'talent.frost_alchemy.name',
    descKey: 'talent.frost_alchemy.desc',
    capKey: 'talent.frost_alchemy.cap',
  },
  {
    id: 'war_logistics',
    tier: 2,
    maxRank: 3,
    costs: [1, 2, 3],
    parents: ['start_economy'],
    reqParentRank: 2,
    treePos: { xPct: 86, yPct: 50 },
    accentHex: '#b6e653',
    nameKey: 'talent.war_logistics.name',
    descKey: 'talent.war_logistics.desc',
    capKey: 'talent.war_logistics.cap',
  },
  // Kademe 3 — Ulu Meşe Taç Mühürleri
  {
    id: 'apex_warlord',
    tier: 3,
    maxRank: 3,
    costs: [2, 3, 4],
    parents: ['siege_ordnance', 'pack_warden'],
    reqParentRank: 2,
    treePos: { xPct: 30, yPct: 84 },
    accentHex: '#ff5d73',
    nameKey: 'talent.apex_warlord.name',
    descKey: 'talent.apex_warlord.desc',
    capKey: 'talent.apex_warlord.cap',
  },
  {
    id: 'world_tree_aegis',
    tier: 3,
    maxRank: 3,
    costs: [2, 3, 4],
    parents: ['frost_alchemy', 'war_logistics'],
    reqParentRank: 2,
    treePos: { xPct: 70, yPct: 84 },
    accentHex: '#54f097',
    nameKey: 'talent.world_tree_aegis.name',
    descKey: 'talent.world_tree_aegis.desc',
    capKey: 'talent.world_tree_aegis.cap',
  },
];

export const TALENT_MAP: Record<TalentBranchId, TalentBranchSpec> = Object.fromEntries(
  TALENT_BRANCHES.map((b) => [b.id, b]),
) as Record<TalentBranchId, TalentBranchSpec>;

export function getTalentSpec(branchId: TalentBranchId): TalentBranchSpec {
  return TALENT_MAP[branchId];
}

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
  // Kademe 2 & 3 oyuna özel uzmanlık çarpanları
  aoeRadiusPct: number;
  critChanceBonus: number;
  airDamageBonusPct: number;
  barrelDamageMult: number;
  heroAuraRadiusBonus: number;
  heroRegenMult: number;
  heroDamageTakenMult: number;
  heroExtraBlockCap: number;
  statusDurationMult: number;
  resinDpsMult: number;
  magnetBonusDurationSec: number;
  waveClearBonusMult: number;
  eliteBountyMult: number;
  stumpCostMult: number;
  towerFireRateMult: number;
  runeSlotBonusPct: number;
  heroSkillCooldownMult: number;
  extraBaseHp: number;
  waveHealBaseHp: number;
  earlyWaveBonusMult: number;
}

export function createInitialTalents(): Record<TalentBranchId, number> {
  return {
    tower_power: 0,
    hero_soul: 0,
    forest_magic: 0,
    start_economy: 0,
    siege_ordnance: 0,
    pack_warden: 0,
    frost_alchemy: 0,
    war_logistics: 0,
    apex_warlord: 0,
    world_tree_aegis: 0,
  };
}

export function clampTalentRank(rank: unknown, maxRank = TALENT_MAX_RANK): number {
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(maxRank, Math.floor(rank)));
}

export function getNextTalentCost(currentRank: number, branchId?: TalentBranchId): number | null {
  const spec = branchId ? TALENT_MAP[branchId] : null;
  const maxRank = spec ? spec.maxRank : TALENT_MAX_RANK;
  const costs = spec ? spec.costs : TALENT_RANK_COSTS;
  const r = clampTalentRank(currentRank, maxRank);
  if (r >= maxRank) return null;
  return costs[r] ?? null;
}

export function isTalentNodeUnlocked(
  branchId: TalentBranchId,
  talents?: Partial<Record<TalentBranchId, number>>,
): boolean {
  const spec = TALENT_MAP[branchId];
  if (!spec || spec.parents.length === 0) return true;
  return spec.parents.some((parentId) => {
    const pSpec = TALENT_MAP[parentId];
    return clampTalentRank(talents?.[parentId], pSpec.maxRank) >= spec.reqParentRank;
  });
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
    const rank = clampTalentRank(talents[branch.id], branch.maxRank);
    for (let i = 0; i < rank; i++) {
      spent += branch.costs[i] ?? 0;
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
  const towerRank = clampTalentRank(talents?.tower_power, 5);
  const heroRank = clampTalentRank(talents?.hero_soul, 5);
  const magicRank = clampTalentRank(talents?.forest_magic, 5);
  const econRank = clampTalentRank(talents?.start_economy, 5);

  const ordnanceRank = clampTalentRank(talents?.siege_ordnance, 3);
  const wardenRank = clampTalentRank(talents?.pack_warden, 3);
  const alchemyRank = clampTalentRank(talents?.frost_alchemy, 3);
  const logisticsRank = clampTalentRank(talents?.war_logistics, 3);

  const warlordRank = clampTalentRank(talents?.apex_warlord, 3);
  const aegisRank = clampTalentRank(talents?.world_tree_aegis, 3);

  return {
    towerDamagePct: towerRank * 0.04,
    towerRangePct: towerRank >= 5 ? 0.05 : 0,
    heroHpMult: 1 + heroRank * 0.06,
    heroDamageMult: 1 + heroRank * 0.06,
    heroRespawnReductionSec: heroRank >= 5 ? 2 : 0,
    rainDamageMult: 1 + magicRank * 0.08,
    spellCooldownMult: Math.max(0.7, Number((1 - magicRank * 0.05).toFixed(2))),
    extraStartGold: econRank * 12,
    sellRefundRate: econRank >= 5 ? 0.65 : SELL_REFUND_RATE,
    aoeRadiusPct: Number((ordnanceRank * 0.07).toFixed(3)),
    critChanceBonus: Number((ordnanceRank * 0.04).toFixed(3)),
    airDamageBonusPct: Number((ordnanceRank * 0.12).toFixed(3)),
    barrelDamageMult: 1 + ordnanceRank * 0.2,
    heroAuraRadiusBonus: Number((wardenRank * 0.6).toFixed(2)),
    heroRegenMult: 1 + wardenRank * 0.18,
    heroDamageTakenMult: Math.max(0.7, Number((1 - wardenRank * 0.08).toFixed(3))),
    heroExtraBlockCap: wardenRank >= 3 ? 1 : 0,
    statusDurationMult: 1 + alchemyRank * 0.14,
    resinDpsMult: 1 + alchemyRank * 0.16,
    magnetBonusDurationSec: alchemyRank * 1.5,
    waveClearBonusMult: 1 + logisticsRank * 0.1,
    eliteBountyMult: 1 + logisticsRank * 0.12,
    stumpCostMult: Math.max(0.55, Number((1 - logisticsRank * 0.12).toFixed(3))),
    towerFireRateMult: 1 + warlordRank * 0.05,
    runeSlotBonusPct: Number((warlordRank * 0.07).toFixed(3)),
    heroSkillCooldownMult: Math.max(0.72, Number((1 - warlordRank * 0.08).toFixed(3))),
    extraBaseHp: aegisRank * 18,
    waveHealBaseHp: aegisRank * 3,
    earlyWaveBonusMult: 1 + aegisRank * 0.25,
  };
}

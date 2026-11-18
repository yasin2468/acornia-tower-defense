export type TowerId = 'squirrel' | 'beaver' | 'owl' | 'hedgehog';

export type EvolutionBranchId =
  | 'squirrel_sniper'
  | 'squirrel_gatling'
  | 'beaver_resin'
  | 'beaver_stun'
  | 'owl_chain'
  | 'owl_glacier'
  | 'hedgehog_pierce'
  | 'hedgehog_shred';

export type TargetingPriority = 'first' | 'strongest' | 'weakest' | 'closest';

export type HatId = 'none' | 'pirate' | 'chef' | 'wizard' | 'viking';

export interface TowerTierStats {
  cost: number;
  damage: number;
  fireRate: number; // shots per second
  range: number; // world meters
  aoeRadius?: number;
  slowPct?: number; // 0..1
  slowDuration?: number; // seconds
  armorBreakPct?: number; // 0..1
  armorPiercePct?: number; // 0..1
  critChance?: number;
  critMultiplier?: number;
  resinDuration?: number;
  resinDps?: number;
  resinSlowPct?: number;
  stunChance?: number;
  stunDuration?: number;
  chainCount?: number;
  freezeEveryNth?: number;
  freezeDuration?: number;
  pierceLine?: boolean;
  permanentArmorHalve?: boolean;
  bossBonusPct?: number;
}

export interface EvolutionSpec {
  id: EvolutionBranchId;
  branchKey: 'A' | 'B';
  nameKey: string;
  descKey: string;
  stats: TowerTierStats;
}

export interface TowerSpec {
  id: TowerId;
  nameKey: string;
  roleKey: string;
  canHitAir: boolean;
  canHitGround: boolean;
  defaultPriority: TargetingPriority;
  smartModeHint: 'cluster' | 'unslowed_first' | 'armored_first' | 'first';
  accentColor: string;
  tier1: TowerTierStats;
  tier2: TowerTierStats;
  evolutions: [EvolutionSpec, EvolutionSpec];
}

export const SELL_REFUND_RATE = 0.6;
export const CARD_MAX_LEVEL = 15;
export const CARD_DAMAGE_PER_LEVEL = 0.08;

export function cardLevelMultiplier(cardLevel: number): number {
  const clamped = Math.max(1, Math.min(CARD_MAX_LEVEL, Math.floor(cardLevel)));
  return 1 + (clamped - 1) * CARD_DAMAGE_PER_LEVEL;
}

export const TOWERS: Record<TowerId, TowerSpec> = {
  squirrel: {
    id: 'squirrel',
    nameKey: 'tower.squirrel.name',
    roleKey: 'tower.squirrel.role',
    canHitAir: true,
    canHitGround: true,
    defaultPriority: 'first',
    smartModeHint: 'first',
    accentColor: '#e07a3c',
    tier1: { cost: 50, damage: 12, fireRate: 2.0, range: 7.0 },
    tier2: { cost: 75, damage: 19, fireRate: 2.3, range: 7.5 },
    evolutions: [
      {
        id: 'squirrel_sniper',
        branchKey: 'A',
        nameKey: 'evo.squirrel_sniper.name',
        descKey: 'evo.squirrel_sniper.desc',
        stats: {
          cost: 120,
          damage: 48,
          fireRate: 1.8,
          range: 11.0,
          critChance: 0.3,
          critMultiplier: 2.5,
        },
      },
      {
        id: 'squirrel_gatling',
        branchKey: 'B',
        nameKey: 'evo.squirrel_gatling.name',
        descKey: 'evo.squirrel_gatling.desc',
        stats: {
          cost: 120,
          damage: 16,
          fireRate: 4.2,
          range: 8.0,
        },
      },
    ],
  },
  beaver: {
    id: 'beaver',
    nameKey: 'tower.beaver.name',
    roleKey: 'tower.beaver.role',
    canHitAir: false,
    canHitGround: true,
    defaultPriority: 'first',
    smartModeHint: 'cluster',
    accentColor: '#b97a4b',
    tier1: { cost: 70, damage: 26, fireRate: 0.65, range: 6.5, aoeRadius: 2.2 },
    tier2: { cost: 105, damage: 42, fireRate: 0.75, range: 7.0, aoeRadius: 2.35 },
    evolutions: [
      {
        id: 'beaver_resin',
        branchKey: 'A',
        nameKey: 'evo.beaver_resin.name',
        descKey: 'evo.beaver_resin.desc',
        stats: {
          cost: 165,
          damage: 58,
          fireRate: 0.85,
          range: 7.4,
          aoeRadius: 2.4,
          resinDuration: 3.0,
          resinDps: 14,
          resinSlowPct: 0.2,
        },
      },
      {
        id: 'beaver_stun',
        branchKey: 'B',
        nameKey: 'evo.beaver_stun.name',
        descKey: 'evo.beaver_stun.desc',
        stats: {
          cost: 165,
          damage: 72,
          fireRate: 0.8,
          range: 7.5,
          aoeRadius: 2.5,
          stunChance: 0.35,
          stunDuration: 0.8,
        },
      },
    ],
  },
  owl: {
    id: 'owl',
    nameKey: 'tower.owl.name',
    roleKey: 'tower.owl.role',
    canHitAir: true,
    canHitGround: true,
    defaultPriority: 'first',
    smartModeHint: 'unslowed_first',
    accentColor: '#5da9e9',
    tier1: {
      cost: 65,
      damage: 8,
      fireRate: 1.2,
      range: 6.8,
      slowPct: 0.35,
      slowDuration: 2.5,
    },
    tier2: {
      cost: 95,
      damage: 14,
      fireRate: 1.4,
      range: 7.4,
      slowPct: 0.45,
      slowDuration: 2.5,
    },
    evolutions: [
      {
        id: 'owl_chain',
        branchKey: 'A',
        nameKey: 'evo.owl_chain.name',
        descKey: 'evo.owl_chain.desc',
        stats: {
          cost: 150,
          damage: 26,
          fireRate: 1.5,
          range: 8.0,
          slowPct: 0.3,
          slowDuration: 2.5,
          chainCount: 3,
        },
      },
      {
        id: 'owl_glacier',
        branchKey: 'B',
        nameKey: 'evo.owl_glacier.name',
        descKey: 'evo.owl_glacier.desc',
        stats: {
          cost: 150,
          damage: 22,
          fireRate: 1.6,
          range: 8.0,
          slowPct: 0.55,
          slowDuration: 2.8,
          armorBreakPct: 0.3,
          freezeEveryNth: 4,
          freezeDuration: 1.2,
        },
      },
    ],
  },
  hedgehog: {
    id: 'hedgehog',
    nameKey: 'tower.hedgehog.name',
    roleKey: 'tower.hedgehog.role',
    canHitAir: true,
    canHitGround: true,
    defaultPriority: 'strongest',
    smartModeHint: 'armored_first',
    accentColor: '#7c8b6f',
    tier1: { cost: 85, damage: 40, fireRate: 0.55, range: 8.5, armorPiercePct: 0.6 },
    tier2: { cost: 125, damage: 66, fireRate: 0.65, range: 9.2, armorPiercePct: 0.65 },
    evolutions: [
      {
        id: 'hedgehog_pierce',
        branchKey: 'A',
        nameKey: 'evo.hedgehog_pierce.name',
        descKey: 'evo.hedgehog_pierce.desc',
        stats: {
          cost: 195,
          damage: 95,
          fireRate: 0.78,
          range: 10.2,
          armorPiercePct: 0.6,
          pierceLine: true,
        },
      },
      {
        id: 'hedgehog_shred',
        branchKey: 'B',
        nameKey: 'evo.hedgehog_shred.name',
        descKey: 'evo.hedgehog_shred.desc',
        stats: {
          cost: 195,
          damage: 120,
          fireRate: 0.8,
          range: 10.0,
          armorPiercePct: 0.75,
          permanentArmorHalve: true,
          bossBonusPct: 0.35,
        },
      },
    ],
  },
};

export const TOWER_LIST: TowerSpec[] = [
  TOWERS.squirrel,
  TOWERS.beaver,
  TOWERS.owl,
  TOWERS.hedgehog,
];

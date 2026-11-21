export type TowerId =
  | 'squirrel'
  | 'beaver'
  | 'owl'
  | 'hedgehog'
  | 'badger'
  | 'falcon'
  | 'tortoise'
  | 'lynx';

export type EvolutionBranchId =
  | 'squirrel_sniper'
  | 'squirrel_gatling'
  | 'beaver_resin'
  | 'beaver_stun'
  | 'owl_chain'
  | 'owl_glacier'
  | 'hedgehog_pierce'
  | 'hedgehog_shred'
  | 'badger_inferno'
  | 'badger_corrosion'
  | 'falcon_tempest'
  | 'falcon_skyhunter'
  | 'tortoise_quake'
  | 'tortoise_bastion'
  | 'lynx_flurry'
  | 'lynx_frostbite';

export type TargetingPriority = 'first' | 'smart' | 'strongest' | 'weakest' | 'closest';

export type HatId =
  | 'none'
  | 'pirate'
  | 'chef'
  | 'wizard'
  | 'viking'
  | 'crown'
  | 'goggles'
  | 'antlers'
  | 'samurai';

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
  airBonusPct?: number;
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
export const CARD_MAX_LEVEL = 20;
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
          damage: 40,
          fireRate: 1.8,
          range: 11.0,
          critChance: 0.25,
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
    tier1: { cost: 70, damage: 28, fireRate: 0.68, range: 6.5, aoeRadius: 2.2 },
    tier2: { cost: 105, damage: 44, fireRate: 0.78, range: 7.0, aoeRadius: 2.35 },
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
      damage: 10,
      fireRate: 1.25,
      range: 6.8,
      slowPct: 0.35,
      slowDuration: 2.5,
    },
    tier2: {
      cost: 95,
      damage: 16,
      fireRate: 1.45,
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
    tier1: { cost: 80, damage: 42, fireRate: 0.58, range: 8.5, armorPiercePct: 0.6 },
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
  badger: {
    id: 'badger',
    nameKey: 'tower.badger.name',
    roleKey: 'tower.badger.role',
    canHitAir: false,
    canHitGround: true,
    defaultPriority: 'first',
    smartModeHint: 'cluster',
    accentColor: '#36c96c',
    tier1: {
      cost: 75,
      damage: 22,
      fireRate: 0.76,
      range: 6.7,
      aoeRadius: 2.15,
      armorBreakPct: 0.12,
      resinDuration: 2.2,
      resinDps: 7,
      resinSlowPct: 0.18,
    },
    tier2: {
      cost: 110,
      damage: 36,
      fireRate: 0.85,
      range: 7.2,
      aoeRadius: 2.35,
      armorBreakPct: 0.2,
      resinDuration: 2.6,
      resinDps: 11,
      resinSlowPct: 0.22,
    },
    evolutions: [
      {
        id: 'badger_inferno',
        branchKey: 'A',
        nameKey: 'evo.badger_inferno.name',
        descKey: 'evo.badger_inferno.desc',
        stats: {
          cost: 170,
          damage: 62,
          fireRate: 0.94,
          range: 7.6,
          aoeRadius: 2.55,
          armorBreakPct: 0.2,
          resinDuration: 3.6,
          resinDps: 23,
          resinSlowPct: 0.28,
        },
      },
      {
        id: 'badger_corrosion',
        branchKey: 'B',
        nameKey: 'evo.badger_corrosion.name',
        descKey: 'evo.badger_corrosion.desc',
        stats: {
          cost: 170,
          damage: 55,
          fireRate: 0.96,
          range: 7.6,
          aoeRadius: 2.45,
          armorBreakPct: 0.45,
          slowPct: 0.32,
          slowDuration: 2.6,
          resinDuration: 2.6,
          resinDps: 14,
          resinSlowPct: 0.25,
        },
      },
    ],
  },
  falcon: {
    id: 'falcon',
    nameKey: 'tower.falcon.name',
    roleKey: 'tower.falcon.role',
    canHitAir: true,
    canHitGround: true,
    defaultPriority: 'smart',
    smartModeHint: 'first',
    accentColor: '#39b6e6',
    tier1: { cost: 60, damage: 15, fireRate: 1.45, range: 8.4, airBonusPct: 0.35 },
    tier2: {
      cost: 90,
      damage: 25,
      fireRate: 1.65,
      range: 9.1,
      critChance: 0.15,
      critMultiplier: 2.0,
      airBonusPct: 0.35,
    },
    evolutions: [
      {
        id: 'falcon_tempest',
        branchKey: 'A',
        nameKey: 'evo.falcon_tempest.name',
        descKey: 'evo.falcon_tempest.desc',
        stats: {
          cost: 145,
          damage: 32,
          fireRate: 1.8,
          range: 9.5,
          chainCount: 3,
          slowPct: 0.22,
          slowDuration: 1.5,
          airBonusPct: 0.3,
        },
      },
      {
        id: 'falcon_skyhunter',
        branchKey: 'B',
        nameKey: 'evo.falcon_skyhunter.name',
        descKey: 'evo.falcon_skyhunter.desc',
        stats: {
          cost: 145,
          damage: 52,
          fireRate: 1.5,
          range: 10.8,
          armorPiercePct: 0.45,
          critChance: 0.3,
          critMultiplier: 2.4,
          airBonusPct: 0.45,
          bossBonusPct: 0.2,
        },
      },
    ],
  },
  tortoise: {
    id: 'tortoise',
    nameKey: 'tower.tortoise.name',
    roleKey: 'tower.tortoise.role',
    canHitAir: false,
    canHitGround: true,
    defaultPriority: 'first',
    smartModeHint: 'cluster',
    accentColor: '#c98e32',
    tier1: {
      cost: 95,
      damage: 46,
      fireRate: 0.55,
      range: 6.5,
      aoeRadius: 2.55,
      armorPiercePct: 0.2,
      stunChance: 0.22,
      stunDuration: 0.65,
    },
    tier2: {
      cost: 130,
      damage: 72,
      fireRate: 0.62,
      range: 7.0,
      aoeRadius: 2.75,
      armorPiercePct: 0.25,
      stunChance: 0.3,
      stunDuration: 0.78,
    },
    evolutions: [
      {
        id: 'tortoise_quake',
        branchKey: 'A',
        nameKey: 'evo.tortoise_quake.name',
        descKey: 'evo.tortoise_quake.desc',
        stats: {
          cost: 200,
          damage: 108,
          fireRate: 0.68,
          range: 7.5,
          aoeRadius: 3.15,
          armorPiercePct: 0.25,
          stunChance: 0.48,
          stunDuration: 1.0,
          slowPct: 0.32,
          slowDuration: 2.0,
        },
      },
      {
        id: 'tortoise_bastion',
        branchKey: 'B',
        nameKey: 'evo.tortoise_bastion.name',
        descKey: 'evo.tortoise_bastion.desc',
        stats: {
          cost: 200,
          damage: 136,
          fireRate: 0.7,
          range: 7.5,
          aoeRadius: 2.65,
          armorPiercePct: 0.52,
          armorBreakPct: 0.35,
          bossBonusPct: 0.32,
        },
      },
    ],
  },
  lynx: {
    id: 'lynx',
    nameKey: 'tower.lynx.name',
    roleKey: 'tower.lynx.role',
    canHitAir: true,
    canHitGround: true,
    defaultPriority: 'first',
    smartModeHint: 'armored_first',
    accentColor: '#62cfff',
    tier1: {
      cost: 80,
      damage: 15,
      fireRate: 1.85,
      range: 7.6,
      armorPiercePct: 0.28,
      slowPct: 0.22,
      slowDuration: 1.8,
      critChance: 0.08,
      critMultiplier: 1.85,
    },
    tier2: {
      cost: 115,
      damage: 24,
      fireRate: 2.08,
      range: 8.2,
      armorPiercePct: 0.35,
      slowPct: 0.28,
      slowDuration: 2.0,
      critChance: 0.16,
      critMultiplier: 2.0,
    },
    evolutions: [
      {
        id: 'lynx_flurry',
        branchKey: 'A',
        nameKey: 'evo.lynx_flurry.name',
        descKey: 'evo.lynx_flurry.desc',
        stats: {
          cost: 175,
          damage: 26,
          fireRate: 3.65,
          range: 8.6,
          armorPiercePct: 0.38,
          critChance: 0.24,
          critMultiplier: 2.1,
        },
      },
      {
        id: 'lynx_frostbite',
        branchKey: 'B',
        nameKey: 'evo.lynx_frostbite.name',
        descKey: 'evo.lynx_frostbite.desc',
        stats: {
          cost: 175,
          damage: 45,
          fireRate: 1.98,
          range: 8.8,
          armorPiercePct: 0.45,
          slowPct: 0.42,
          slowDuration: 2.4,
          freezeEveryNth: 4,
          freezeDuration: 1.35,
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
  TOWERS.badger,
  TOWERS.falcon,
  TOWERS.tortoise,
  TOWERS.lynx,
];

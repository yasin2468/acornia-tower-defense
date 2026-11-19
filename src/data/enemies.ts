export type EnemyId =
  | 'scout_bot'
  | 'swarm_saw'
  | 'shield_loader'
  | 'hover_drone'
  | 'mega_harvester'
  | 'turbo_hopper'
  | 'chomp_brute'
  | 'repair_drone'
  | 'crystal_golem'
  | 'cryo_colossus'
  | 'frost_warden'
  | 'ember_bomber'
  | 'tesla_strider'
  | 'magma_overlord';

export interface EnemySpec {
  id: EnemyId;
  nameKey: string;
  descKey: string;
  isFlying: boolean;
  isBoss: boolean;
  baseHp: number;
  speed: number; // world meters per second
  armor: number; // 0..0.95
  bounty: number;
  baseDamage: number;
  radius: number;
  color: string;
  accentColor: string;
  biomeTag?: 'forest' | 'canyon' | 'cavern' | 'snow' | 'foundry';
  dashInterval?: number;
  dashDuration?: number;
  dashMult?: number;
  splitOnDeath?: { enemyId: EnemyId; count: number; hp?: number };
  healAura?: { radius: number; hpPerSec: number };
  regenPerSec?: number;
  phase2Summon?: { enemyId: EnemyId; count: number; hp?: number; speed?: number };
}

export const ENEMIES: Record<EnemyId, EnemySpec> = {
  scout_bot: {
    id: 'scout_bot',
    nameKey: 'enemy.scout_bot.name',
    descKey: 'enemy.scout_bot.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 42,
    speed: 2.3,
    armor: 0.0,
    bounty: 5,
    baseDamage: 10,
    radius: 0.44,
    color: '#b8602e',
    accentColor: '#ffaa1c',
    biomeTag: 'forest',
  },
  swarm_saw: {
    id: 'swarm_saw',
    nameKey: 'enemy.swarm_saw.name',
    descKey: 'enemy.swarm_saw.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 24,
    speed: 3.1,
    armor: 0.0,
    bounty: 3,
    baseDamage: 5,
    radius: 0.34,
    color: '#9e963d',
    accentColor: '#dfa83c',
    biomeTag: 'forest',
  },
  shield_loader: {
    id: 'shield_loader',
    nameKey: 'enemy.shield_loader.name',
    descKey: 'enemy.shield_loader.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 135,
    speed: 1.35,
    armor: 0.45,
    bounty: 11,
    baseDamage: 20,
    radius: 0.56,
    color: '#2f62ad',
    accentColor: '#ff731a',
    biomeTag: 'forest',
  },
  hover_drone: {
    id: 'hover_drone',
    nameKey: 'enemy.hover_drone.name',
    descKey: 'enemy.hover_drone.desc',
    isFlying: true,
    isBoss: false,
    baseHp: 65,
    speed: 2.3,
    armor: 0.1,
    bounty: 6,
    baseDamage: 12,
    radius: 0.42,
    color: '#7d527a',
    accentColor: '#eb1e75',
    biomeTag: 'forest',
  },
  mega_harvester: {
    id: 'mega_harvester',
    nameKey: 'enemy.mega_harvester.name',
    descKey: 'enemy.mega_harvester.desc',
    isFlying: false,
    isBoss: true,
    baseHp: 1320,
    speed: 0.95,
    armor: 0.35,
    bounty: 60,
    baseDamage: 50,
    radius: 0.88,
    color: '#542e3d',
    accentColor: '#d99b38',
    biomeTag: 'forest',
  },
  turbo_hopper: {
    id: 'turbo_hopper',
    nameKey: 'enemy.turbo_hopper.name',
    descKey: 'enemy.turbo_hopper.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 58,
    speed: 3.75,
    armor: 0.0,
    bounty: 6,
    baseDamage: 12,
    radius: 0.4,
    color: '#c86428',
    accentColor: '#4ef2ff',
    biomeTag: 'canyon',
    dashInterval: 3.2,
    dashDuration: 0.65,
    dashMult: 1.45,
  },
  chomp_brute: {
    id: 'chomp_brute',
    nameKey: 'enemy.chomp_brute.name',
    descKey: 'enemy.chomp_brute.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 185,
    speed: 1.72,
    armor: 0.22,
    bounty: 13,
    baseDamage: 18,
    radius: 0.54,
    color: '#a62b24',
    accentColor: '#d9a441',
    biomeTag: 'canyon',
    splitOnDeath: { enemyId: 'swarm_saw', count: 2, hp: 28 },
  },
  repair_drone: {
    id: 'repair_drone',
    nameKey: 'enemy.repair_drone.name',
    descKey: 'enemy.repair_drone.desc',
    isFlying: true,
    isBoss: false,
    baseHp: 92,
    speed: 2.05,
    armor: 0.15,
    bounty: 9,
    baseDamage: 12,
    radius: 0.44,
    color: '#218c62',
    accentColor: '#5df2a8',
    biomeTag: 'cavern',
    healAura: { radius: 2.8, hpPerSec: 15 },
  },
  crystal_golem: {
    id: 'crystal_golem',
    nameKey: 'enemy.crystal_golem.name',
    descKey: 'enemy.crystal_golem.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 320,
    speed: 1.05,
    armor: 0.58,
    bounty: 18,
    baseDamage: 26,
    radius: 0.64,
    color: '#a87932',
    accentColor: '#4ceeff',
    biomeTag: 'cavern',
    regenPerSec: 10,
  },
  cryo_colossus: {
    id: 'cryo_colossus',
    nameKey: 'enemy.cryo_colossus.name',
    descKey: 'enemy.cryo_colossus.desc',
    isFlying: false,
    isBoss: true,
    baseHp: 2450,
    speed: 0.88,
    armor: 0.45,
    bounty: 95,
    baseDamage: 60,
    radius: 0.94,
    color: '#9e7336',
    accentColor: '#9eefff',
    biomeTag: 'snow',
    regenPerSec: 8,
    phase2Summon: { enemyId: 'crystal_golem', count: 2, hp: 220, speed: 1.15 },
  },
  frost_warden: {
    id: 'frost_warden',
    nameKey: 'enemy.frost_warden.name',
    descKey: 'enemy.frost_warden.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 210,
    speed: 1.45,
    armor: 0.48,
    bounty: 16,
    baseDamage: 22,
    radius: 0.56,
    color: '#3f5d7a',
    accentColor: '#6cf5ff',
    biomeTag: 'snow',
    regenPerSec: 6,
  },
  ember_bomber: {
    id: 'ember_bomber',
    nameKey: 'enemy.ember_bomber.name',
    descKey: 'enemy.ember_bomber.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 115,
    speed: 2.35,
    armor: 0.1,
    bounty: 9,
    baseDamage: 16,
    radius: 0.44,
    color: '#6f8236',
    accentColor: '#ff8418',
    biomeTag: 'foundry',
    dashInterval: 4.0,
    dashDuration: 0.85,
    dashMult: 1.85,
  },
  tesla_strider: {
    id: 'tesla_strider',
    nameKey: 'enemy.tesla_strider.name',
    descKey: 'enemy.tesla_strider.desc',
    isFlying: false,
    isBoss: false,
    baseHp: 175,
    speed: 1.85,
    armor: 0.3,
    bounty: 14,
    baseDamage: 20,
    radius: 0.52,
    color: '#b88433',
    accentColor: '#6cf5ff',
    biomeTag: 'foundry',
    healAura: { radius: 3.0, hpPerSec: 12 },
    regenPerSec: 4,
  },
  magma_overlord: {
    id: 'magma_overlord',
    nameKey: 'enemy.magma_overlord.name',
    descKey: 'enemy.magma_overlord.desc',
    isFlying: false,
    isBoss: true,
    baseHp: 3600,
    speed: 0.68,
    armor: 0.42,
    bounty: 160,
    baseDamage: 40,
    radius: 0.98,
    color: '#3d332e',
    accentColor: '#ff731a',
    biomeTag: 'foundry',
    regenPerSec: 10,
    phase2Summon: { enemyId: 'ember_bomber', count: 4, hp: 160, speed: 2.4 },
  },
};

export const ENEMY_LIST: EnemySpec[] = Object.values(ENEMIES);

export type HeroId = 'boz_pence' | 'kizil_kuyruk' | 'kaya_dis';

export interface HeroSpec {
  id: HeroId;
  nameKey: string;
  roleKey: string;
  descKey: string;
  canHitAir: boolean;
  isRanged: boolean;
  attackRange: number;
  armor: number;
  unlockLevel: number;
  gemUnlockCost: number;
  maxHp: number;
  damage: number;
  attackInterval: number;
  moveSpeed: number;
  blockCap: number;
  engageRange: number;
  respawnSeconds: number;
  regenPerSecond: number;
  clawShockInterval: number;
  clawShockDamage: number;
  clawShockRadius: number;
}

export type HeroClassId = 'auto' | 'classic' | 'viking' | 'royal';
export type HeroVisualVariant = 'classic' | 'viking' | 'royal';

export interface HeroClassSpec {
  id: HeroClassId;
  nameKey: string;
  descKey: string;
  hpMult: number;
  damageMult: number;
  clawShockRadius: number;
  blockCap: number;
  regenMult: number;
}

export const HERO_CLASSES: Record<HeroClassId, HeroClassSpec> = {
  auto: {
    id: 'auto',
    nameKey: 'hero.class.auto',
    descKey: 'hero.class.auto.desc',
    hpMult: 1.0,
    damageMult: 1.0,
    clawShockRadius: 2.7,
    blockCap: 3,
    regenMult: 1.0,
  },
  classic: {
    id: 'classic',
    nameKey: 'hero.class.classic',
    descKey: 'hero.class.classic.desc',
    hpMult: 1.0,
    damageMult: 1.0,
    clawShockRadius: 2.7,
    blockCap: 3,
    regenMult: 1.0,
  },
  viking: {
    id: 'viking',
    nameKey: 'hero.class.viking',
    descKey: 'hero.class.viking.desc',
    hpMult: 0.92,
    damageMult: 1.25,
    clawShockRadius: 3.1,
    blockCap: 3,
    regenMult: 1.0,
  },
  royal: {
    id: 'royal',
    nameKey: 'hero.class.royal',
    descKey: 'hero.class.royal.desc',
    hpMult: 1.3,
    damageMult: 0.95,
    clawShockRadius: 2.7,
    blockCap: 4,
    regenMult: 1.35,
  },
};

export function resolveHeroVisualVariant(heroClass: HeroClassId, heroLevel: number): HeroVisualVariant {
  if (heroClass === 'classic' || heroClass === 'viking' || heroClass === 'royal') {
    return heroClass;
  }
  if (heroLevel >= 4) return 'royal';
  if (heroLevel >= 2) return 'viking';
  return 'classic';
}

export const HEROES: Record<HeroId, HeroSpec> = {
  boz_pence: {
    id: 'boz_pence',
    nameKey: 'hero.boz_pence.name',
    roleKey: 'hero.boz_pence.role',
    descKey: 'hero.boz_pence.desc',
    canHitAir: false,
    isRanged: false,
    attackRange: 2.1,
    armor: 0,
    unlockLevel: 1,
    gemUnlockCost: 0,
    maxHp: 280,
    damage: 20,
    attackInterval: 0.85,
    moveSpeed: 5.2,
    blockCap: 3,
    engageRange: 2.1,
    respawnSeconds: 15,
    regenPerSecond: 14,
    clawShockInterval: 8,
    clawShockDamage: 35,
    clawShockRadius: 2.7,
  },
  kizil_kuyruk: {
    id: 'kizil_kuyruk',
    nameKey: 'hero.kizil_kuyruk.name',
    roleKey: 'hero.kizil_kuyruk.role',
    descKey: 'hero.kizil_kuyruk.desc',
    canHitAir: true,
    isRanged: true,
    attackRange: 5.8,
    armor: 0,
    unlockLevel: 4,
    gemUnlockCost: 150,
    maxHp: 195,
    damage: 24,
    attackInterval: 0.9,
    moveSpeed: 5.8,
    blockCap: 1,
    engageRange: 1.7,
    respawnSeconds: 13,
    regenPerSecond: 16,
    clawShockInterval: 10,
    clawShockDamage: 0,
    clawShockRadius: 6.0,
  },
  kaya_dis: {
    id: 'kaya_dis',
    nameKey: 'hero.kaya_dis.name',
    roleKey: 'hero.kaya_dis.role',
    descKey: 'hero.kaya_dis.desc',
    canHitAir: false,
    isRanged: false,
    attackRange: 2.3,
    armor: 0.3,
    unlockLevel: 7,
    gemUnlockCost: 220,
    maxHp: 370,
    damage: 18,
    attackInterval: 0.95,
    moveSpeed: 4.9,
    blockCap: 4,
    engageRange: 2.3,
    respawnSeconds: 16,
    regenPerSecond: 18,
    clawShockInterval: 10,
    clawShockDamage: 42,
    clawShockRadius: 2.9,
  },
};

export const HERO_LIST: HeroSpec[] = Object.values(HEROES);
export const BEAR_HERO_SPEC: HeroSpec = HEROES.boz_pence;

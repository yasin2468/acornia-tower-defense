import type { EnemyId } from './enemies.ts';

export interface Vec2 {
  x: number;
  z: number;
}

export interface SlotSpec {
  id: string;
  x: number;
  z: number;
  lockedByStump?: boolean;
  stumpClearCost?: number;
  runeSlot?: boolean;
}

export interface WaveGroupSpec {
  enemyId: EnemyId;
  count: number;
  spacing: number;
  hpOverride?: number;
  speedOverride?: number;
  bountyOverride?: number;
}

export interface WaveSpec {
  waveNumber: number;
  clearBonus: number;
  announceEnemy?: EnemyId;
  groups: WaveGroupSpec[];
}

export type StageConceptId =
  | 'mossy_stream'
  | 'acorn_island_shrine'
  | 'oak_bastion_moat'
  | 'crimson_powder_gorge'
  | 'desert_windmill_oasis'
  | 'twin_bridge_chasm'
  | 'biolum_quartz_stream'
  | 'abandoned_drill_mine'
  | 'amethyst_ley_sanctum'
  | 'frozen_mirror_lake'
  | 'blizzard_watchtower'
  | 'aurora_citadel_siege'
  | 'cinder_slag_canal'
  | 'clockwork_gear_bridge'
  | 'magma_crucible_arena'
  | 'iron_core_citadel'
  | 'shadowfen_lantern_bog'
  | 'sunken_totem_ruins'
  | 'venom_alchemist_marsh'
  | 'eclipse_oak_bastion'
  | 'starfall_glacier_bridge'
  | 'chrono_prism_vault'
  | 'solar_plasma_reactor'
  | 'astral_nexus_throne';

export interface LevelSpec {
  id: number;
  biome: 'forest' | 'canyon' | 'cavern' | 'snow' | 'foundry';
  regionKey?: string;
  concept: StageConceptId;
  nameKey: string;
  unlocked: boolean;
  isBossStage?: boolean;
  mapPin: { xPct: number; yPct: number };
  startGold: number;
  baseHp: number;
  killZoneMeters: number;
  path: Vec2[];
  secondaryPath?: Vec2[];
  slots: SlotSpec[];
  lanterns: Vec2[];
  heroStart: Vec2;
  barrels?: Array<{ id: string; x: number; z: number }>;
  iceZones?: Array<{ x: number; z: number; radius: number }>;
  waves: WaveSpec[];
}

const BASE_LEVELS: LevelSpec[] = [
  {
    id: 1,
    biome: 'forest',
    concept: 'mossy_stream',
    nameKey: 'level.1.name',
    unlocked: true,
    mapPin: { xPct: 48, yPct: 91 },
    startGold: 150,
    baseHp: 150,
    killZoneMeters: 14.0,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.3 },
      { x: -3.1, z: 6.1 },
      { x: -3.1, z: 2.3 },
      { x: 3.1, z: 1.3 },
      { x: 3.1, z: -2.5 },
      { x: -2.8, z: -3.4 },
      { x: -2.6, z: -6.4 },
      { x: 0.0, z: -7.7 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.3, z: 4.3 },
      { id: 'slot_2', x: 1.3, z: 3.8 },
      { id: 'slot_3', x: -1.1, z: -0.9 },
      { id: 'slot_4', x: 1.3, z: -0.5 },
      { id: 'slot_5', x: 0.1, z: -4.8 },
      { id: 'slot_6', x: 2.2, z: 5.4 },
      { id: 'slot_7', x: 2.1, z: -5.2, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: -1.6, z: 7.7 },
      { x: 4.1, z: 0.2 },
      { x: -4.0, z: -4.7 },
      { x: 1.9, z: -7.9 },
    ],
    heroStart: { x: -2.7, z: -4.8 },
    waves: [
      {
        waveNumber: 1,
        clearBonus: 15,
        announceEnemy: 'scout_bot',
        groups: [{ enemyId: 'scout_bot', count: 13, spacing: 0.95, hpOverride: 57, speedOverride: 2.3, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 15,
        announceEnemy: 'swarm_saw',
        groups: [
          { enemyId: 'scout_bot', count: 9, spacing: 0.85, hpOverride: 53, speedOverride: 2.3, bountyOverride: 5 },
          { enemyId: 'swarm_saw', count: 15, spacing: 0.35, hpOverride: 26, speedOverride: 3.1, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 3,
        clearBonus: 20,
        announceEnemy: 'shield_loader',
        groups: [{ enemyId: 'shield_loader', count: 7, spacing: 1.6, hpOverride: 145, speedOverride: 1.35, bountyOverride: 11 }],
      },
      {
        waveNumber: 4,
        clearBonus: 20,
        announceEnemy: 'hover_drone',
        groups: [
          { enemyId: 'hover_drone', count: 11, spacing: 0.7, hpOverride: 73, speedOverride: 2.3, bountyOverride: 6 },
          { enemyId: 'swarm_saw', count: 12, spacing: 0.32, hpOverride: 32, speedOverride: 3.1, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 25,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.3, hpOverride: 148, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 7, spacing: 0.75, hpOverride: 72, speedOverride: 2.3, bountyOverride: 6 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 25,
        groups: [
          { enemyId: 'swarm_saw', count: 20, spacing: 0.26, hpOverride: 35, speedOverride: 3.2, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 5, spacing: 1.05, hpOverride: 185, speedOverride: 1.4, bountyOverride: 11 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 50,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'shield_loader', count: 4, spacing: 0.9, hpOverride: 88, speedOverride: 1.4, bountyOverride: 11 },
          { enemyId: 'hover_drone', count: 6, spacing: 0.5, hpOverride: 38, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'mega_harvester', count: 1, spacing: 1.2, hpOverride: 1320, speedOverride: 0.95, bountyOverride: 60 },
        ],
      },
    ],
  },
  {
    id: 2,
    biome: 'forest',
    concept: 'acorn_island_shrine',
    nameKey: 'level.2.name',
    unlocked: true,
    mapPin: { xPct: 73, yPct: 83 },
    startGold: 160,
    baseHp: 150,
    killZoneMeters: 14.5,
    path: [
      { x: -2.8, z: 9.8 },
      { x: -2.8, z: 5.6 },
      { x: 0.0, z: 2.5 },
      { x: 3.1, z: 1.2 },
      { x: 3.1, z: -2.5 },
      { x: -2.8, z: -3.5 },
      { x: -2.6, z: -6.4 },
      { x: 0.0, z: -7.7 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 2.8, z: 9.8 },
      { x: 2.8, z: 5.6 },
      { x: 0.0, z: 2.5 },
      { x: 3.1, z: 1.2 },
      { x: 3.1, z: -2.5 },
      { x: -2.8, z: -3.5 },
      { x: -2.6, z: -6.4 },
      { x: 0.0, z: -7.7 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 5.8 },
      { id: 'slot_2', x: -2.4, z: 2.0 },
      { id: 'slot_3', x: 1.2, z: -0.6 },
      { id: 'slot_4', x: -1.2, z: -0.9 },
      { id: 'slot_5', x: 0.1, z: -4.9 },
      { id: 'slot_6', x: -3.1, z: -0.4 },
      { id: 'slot_7', x: 2.0, z: -5.2, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: -4.0, z: 6.8 },
      { x: 4.1, z: 3.8 },
      { x: -4.1, z: -2.2 },
      { x: 3.1, z: -7.2 },
    ],
    heroStart: { x: 0.0, z: 2.5 },
    waves: [
      {
        waveNumber: 1,
        clearBonus: 19,
        groups: [{ enemyId: 'scout_bot', count: 18, spacing: 0.72, hpOverride: 48, speedOverride: 2.35, bountyOverride: 4 }],
      },
      {
        waveNumber: 2,
        clearBonus: 19,
        groups: [
          { enemyId: 'swarm_saw', count: 24, spacing: 0.28, hpOverride: 25, speedOverride: 3.15, bountyOverride: 3 },
          { enemyId: 'scout_bot', count: 10, spacing: 0.75, hpOverride: 41, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 3,
        clearBonus: 24,
        groups: [
          { enemyId: 'shield_loader', count: 5, spacing: 1.5, hpOverride: 237, speedOverride: 1.38, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 4,
        clearBonus: 24,
        groups: [
          { enemyId: 'hover_drone', count: 15, spacing: 0.56, hpOverride: 63, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'scout_bot', count: 11, spacing: 0.65, hpOverride: 40, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 28,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 178, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'swarm_saw', count: 22, spacing: 0.24, hpOverride: 26, speedOverride: 3.2, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 30,
        groups: [
          { enemyId: 'hover_drone', count: 14, spacing: 0.48, hpOverride: 64, speedOverride: 2.4, bountyOverride: 6 },
          { enemyId: 'shield_loader', count: 6, spacing: 1.1, hpOverride: 166, speedOverride: 1.42, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 35,
        groups: [
          { enemyId: 'swarm_saw', count: 32, spacing: 0.19, hpOverride: 29, speedOverride: 3.25, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 8, spacing: 0.9, hpOverride: 162, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 65,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'shield_loader', count: 5, spacing: 0.85, hpOverride: 128, speedOverride: 1.42, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 6, spacing: 0.45, hpOverride: 73, speedOverride: 2.4, bountyOverride: 7 },
          { enemyId: 'mega_harvester', count: 1, spacing: 1.2, hpOverride: 1520, speedOverride: 0.95, bountyOverride: 65 },
        ],
      },
    ],
  },
  {
    id: 3,
    biome: 'forest',
    concept: 'oak_bastion_moat',
    nameKey: 'level.3.name',
    unlocked: true,
    isBossStage: true,
    mapPin: { xPct: 48, yPct: 74 },
    startGold: 170,
    baseHp: 150,
    killZoneMeters: 15.0,
    path: [
      { x: 3.1, z: 9.8 },
      { x: 3.1, z: 6.5 },
      { x: -3.2, z: 6.5 },
      { x: -3.2, z: -6.3 },
      { x: 0.0, z: -6.3 },
      { x: 0.0, z: 2.0 },
      { x: 3.2, z: 2.0 },
      { x: 3.2, z: -6.6 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.6, z: 4.4 },
      { id: 'slot_2', x: -1.6, z: 1.2 },
      { id: 'slot_3', x: -1.6, z: -1.6 },
      { id: 'slot_4', x: 1.6, z: -0.4 },
      { id: 'slot_5', x: 1.6, z: -3.6 },
      { id: 'slot_6', x: 1.4, z: 4.1 },
      { id: 'slot_7', x: -1.6, z: -4.4, lockedByStump: true, stumpClearCost: 40 },
      { id: 'slot_8', x: 3.4, z: 4.2, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: 4.1, z: 7.4 },
      { x: -4.3, z: 4.0 },
      { x: 4.3, z: -1.0 },
      { x: -4.45, z: -5.2 },
    ],
    heroStart: { x: 0.0, z: -2.8 },
    waves: [
      {
        waveNumber: 1,
        clearBonus: 22,
        groups: [{ enemyId: 'scout_bot', count: 20, spacing: 0.7, hpOverride: 51, speedOverride: 2.35, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 25,
        groups: [
          { enemyId: 'swarm_saw', count: 27, spacing: 0.24, hpOverride: 25, speedOverride: 3.2, bountyOverride: 3 },
          { enemyId: 'scout_bot', count: 11, spacing: 0.68, hpOverride: 47, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 3,
        clearBonus: 27,
        groups: [
          { enemyId: 'shield_loader', count: 7, spacing: 1.5, hpOverride: 200, speedOverride: 1.38, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 4,
        clearBonus: 30,
        groups: [
          { enemyId: 'hover_drone', count: 18, spacing: 0.5, hpOverride: 64, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'swarm_saw', count: 20, spacing: 0.24, hpOverride: 24, speedOverride: 3.2, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 32,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 181, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 12, spacing: 0.56, hpOverride: 69, speedOverride: 2.4, bountyOverride: 7 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 37,
        groups: [
          { enemyId: 'swarm_saw', count: 34, spacing: 0.2, hpOverride: 29, speedOverride: 3.25, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 7, spacing: 1.05, hpOverride: 178, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 40,
        groups: [
          { enemyId: 'hover_drone', count: 18, spacing: 0.44, hpOverride: 71, speedOverride: 2.42, bountyOverride: 6 },
          { enemyId: 'shield_loader', count: 8, spacing: 0.9, hpOverride: 169, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 47,
        groups: [
          { enemyId: 'swarm_saw', count: 36, spacing: 0.17, hpOverride: 34, speedOverride: 3.3, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 10, spacing: 0.85, hpOverride: 186, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 9,
        clearBonus: 89,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'shield_loader', count: 7, spacing: 0.8, hpOverride: 153, speedOverride: 1.45, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 9, spacing: 0.45, hpOverride: 75, speedOverride: 2.45, bountyOverride: 7 },
          { enemyId: 'mega_harvester', count: 1, spacing: 1.2, hpOverride: 1850, speedOverride: 0.95, bountyOverride: 75 },
        ],
      },
    ],
  },
  // --- CHAPTER II: SONBAHAR KANYONU ---
  {
    id: 4,
    biome: 'canyon',
    concept: 'crimson_powder_gorge',
    nameKey: 'level.4.name',
    unlocked: true,
    mapPin: { xPct: 73, yPct: 65 },
    startGold: 180,
    baseHp: 150,
    killZoneMeters: 15.5,
    path: [
      { x: -3.0, z: 9.8 },
      { x: -3.0, z: 7.2 },
      { x: 3.1, z: 5.7 },
      { x: -3.1, z: 2.3 },
      { x: 3.1, z: -0.8 },
      { x: -3.1, z: -3.7 },
      { x: 2.8, z: -6.1 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -2.9, z: 4.5 },
      { id: 'slot_2', x: 2.7, z: 2.5 },
      { id: 'slot_3', x: -2.7, z: -0.7 },
      { id: 'slot_4', x: 2.8, z: -3.3 },
      { id: 'slot_5', x: -2.8, z: -5.8 },
      { id: 'slot_6', x: 1.0, z: 2.0 },
      { id: 'slot_7', x: -0.8, z: -0.8, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: -4.1, z: 7.4 },
      { x: 4.2, z: 3.8 },
      { x: -4.2, z: -1.8 },
      { x: 3.6, z: -6.9 },
    ],
    heroStart: { x: -0.15, z: -4.9 },
    barrels: [
      { id: 'barrel_1', x: -0.4, z: 5.5 },
      { id: 'barrel_2', x: 0.6, z: -3.2 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 28, groups: [{ enemyId: 'scout_bot', count: 17, spacing: 0.85, hpOverride: 82 }] },
      {
        waveNumber: 2,
        clearBonus: 34,
        announceEnemy: 'turbo_hopper',
        groups: [{ enemyId: 'turbo_hopper', count: 15, spacing: 0.9, hpOverride: 109 }],
      },
      {
        waveNumber: 3,
        clearBonus: 34,
        groups: [
          { enemyId: 'swarm_saw', count: 24, spacing: 0.28, hpOverride: 41 },
          { enemyId: 'turbo_hopper', count: 11, spacing: 0.75, hpOverride: 84 },
        ],
      },
      {
        waveNumber: 4,
        clearBonus: 36,
        groups: [
          { enemyId: 'shield_loader', count: 7, spacing: 1.25, hpOverride: 178 },
          { enemyId: 'hover_drone', count: 11, spacing: 0.65, hpOverride: 90 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 42,
        groups: [
          { enemyId: 'turbo_hopper', count: 16, spacing: 0.55, hpOverride: 78 },
          { enemyId: 'shield_loader', count: 7, spacing: 1.15, hpOverride: 195 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 48,
        groups: [
          { enemyId: 'swarm_saw', count: 30, spacing: 0.24, hpOverride: 42 },
          { enemyId: 'hover_drone', count: 17, spacing: 0.52, hpOverride: 106 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 56,
        groups: [
          { enemyId: 'shield_loader', count: 10, spacing: 0.95, hpOverride: 211 },
          { enemyId: 'turbo_hopper', count: 18, spacing: 0.48, hpOverride: 81 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 97,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'turbo_hopper', count: 20, spacing: 0.5, hpOverride: 127 },
          { enemyId: 'mega_harvester', count: 1, spacing: 1.2, hpOverride: 1650 },
        ],
      },
    ],
  },
  {
    id: 5,
    biome: 'canyon',
    concept: 'desert_windmill_oasis',
    nameKey: 'level.5.name',
    unlocked: true,
    mapPin: { xPct: 50, yPct: 56 },
    startGold: 205,
    baseHp: 150,
    killZoneMeters: 16.0,
    path: [
      { x: -3.0, z: 9.8 },
      { x: -3.0, z: 6.6 },
      { x: 3.1, z: 1.2 },
      { x: 3.1, z: -2.6 },
      { x: -2.8, z: -3.8 },
      { x: -2.6, z: -6.4 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -2.4, z: 3.4 },
      { id: 'slot_2', x: 0.9, z: 5.6 },
      { id: 'slot_3', x: -0.4, z: 1.5 },
      { id: 'slot_4', x: -2.6, z: -0.9 },
      { id: 'slot_5', x: 1.0, z: -1.0 },
      { id: 'slot_6', x: 0.0, z: -5.0 },
      { id: 'slot_7', x: 2.4, z: 4.0, lockedByStump: true, stumpClearCost: 45 },
      { id: 'slot_8', x: 2.2, z: -5.2, lockedByStump: true, stumpClearCost: 45 },
    ],
    lanterns: [
      { x: -4.1, z: 7.4 },
      { x: 4.2, z: 2.4 },
      { x: -4.0, z: -3.0 },
      { x: 3.2, z: -7.2 },
    ],
    heroStart: { x: -2.7, z: -4.9 },
    barrels: [
      { id: 'barrel_1', x: -3.4, z: 5.3 },
      { id: 'barrel_2', x: -0.9, z: -2.3 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 21, groups: [{ enemyId: 'turbo_hopper', count: 13, spacing: 1.0, hpOverride: 74, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 23, groups: [{ enemyId: 'swarm_saw', count: 18, spacing: 0.34, hpOverride: 30, bountyOverride: 3 }, { enemyId: 'hover_drone', count: 8, spacing: 0.78, hpOverride: 72, bountyOverride: 7 }] },
      { waveNumber: 3, clearBonus: 26, announceEnemy: 'chomp_brute', groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.75, hpOverride: 187, bountyOverride: 14 }] },
      { waveNumber: 4, clearBonus: 29, groups: [{ enemyId: 'chomp_brute', count: 5, spacing: 1.45, hpOverride: 173, bountyOverride: 14 }, { enemyId: 'turbo_hopper', count: 10, spacing: 0.65, hpOverride: 67, bountyOverride: 6 }] },
      { waveNumber: 5, clearBonus: 31, groups: [{ enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 149, bountyOverride: 12 }, { enemyId: 'hover_drone', count: 12, spacing: 0.55, hpOverride: 75, bountyOverride: 7 }] },
      { waveNumber: 6, clearBonus: 33, groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.1, hpOverride: 182, bountyOverride: 14 }, { enemyId: 'swarm_saw', count: 23, spacing: 0.24, hpOverride: 36, bountyOverride: 3 }] },
      { waveNumber: 7, clearBonus: 36, groups: [{ enemyId: 'turbo_hopper', count: 17, spacing: 0.45, hpOverride: 70, bountyOverride: 6 }, { enemyId: 'shield_loader', count: 8, spacing: 0.95, hpOverride: 158, bountyOverride: 12 }] },
      { waveNumber: 8, clearBonus: 39, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 0.95, hpOverride: 200, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 15, spacing: 0.44, hpOverride: 85, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 73, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.0, hpOverride: 201, bountyOverride: 14 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.3, hpOverride: 1950, bountyOverride: 70 }] },
    ],
  },
  {
    id: 6,
    biome: 'canyon',
    concept: 'twin_bridge_chasm',
    nameKey: 'level.6.name',
    unlocked: true,
    isBossStage: true,
    mapPin: { xPct: 73, yPct: 47 },
    startGold: 245,
    baseHp: 150,
    killZoneMeters: 16.5,
    path: [
      { x: -2.9, z: 9.8 },
      { x: -3.0, z: 5.6 },
      { x: -1.0, z: 3.6 },
      { x: -3.0, z: 1.2 },
      { x: -2.9, z: -3.2 },
      { x: 0.0, z: -4.4 },
      { x: 2.8, z: -5.8 },
      { x: 2.4, z: -7.6 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 2.9, z: 9.8 },
      { x: 3.0, z: 5.6 },
      { x: 1.0, z: 3.6 },
      { x: 3.0, z: 1.2 },
      { x: 2.9, z: -3.2 },
      { x: 0.0, z: -4.4 },
      { x: -2.8, z: -5.8 },
      { x: -2.4, z: -7.6 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 6.5 },
      { id: 'slot_2', x: 0.0, z: 0.4 },
      { id: 'slot_3', x: 0.0, z: -2.4 },
      { id: 'slot_4', x: -1.1, z: -1.0 },
      { id: 'slot_5', x: 1.1, z: -1.0 },
      { id: 'slot_6', x: -3.4, z: 3.6 },
      { id: 'slot_7', x: 3.4, z: 3.6, lockedByStump: true, stumpClearCost: 45 },
      { id: 'slot_8', x: 0.0, z: -6.55, lockedByStump: true, stumpClearCost: 45 },
    ],
    lanterns: [
      { x: -4.1, z: 7.4 },
      { x: 4.1, z: 7.4 },
      { x: -4.2, z: -0.8 },
      { x: 4.2, z: -0.8 },
    ],
    heroStart: { x: 0.0, z: -4.4 },
    barrels: [
      { id: 'barrel_1', x: -1.9, z: -2.4 },
      { id: 'barrel_2', x: 1.9, z: -2.4 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 28, groups: [{ enemyId: 'scout_bot', count: 13, spacing: 0.85, hpOverride: 61, bountyOverride: 5 }, { enemyId: 'turbo_hopper', count: 8, spacing: 0.85, hpOverride: 70, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 30, groups: [{ enemyId: 'chomp_brute', count: 5, spacing: 1.65, hpOverride: 194, bountyOverride: 14 }, { enemyId: 'swarm_saw', count: 15, spacing: 0.34, hpOverride: 41, bountyOverride: 3 }] },
      { waveNumber: 3, clearBonus: 35, groups: [{ enemyId: 'hover_drone', count: 12, spacing: 0.65, hpOverride: 82, bountyOverride: 7 }, { enemyId: 'shield_loader', count: 5, spacing: 1.4, hpOverride: 174, bountyOverride: 12 }] },
      { waveNumber: 4, clearBonus: 38, groups: [{ enemyId: 'turbo_hopper', count: 16, spacing: 0.52, hpOverride: 68, bountyOverride: 6 }, { enemyId: 'chomp_brute', count: 6, spacing: 1.25, hpOverride: 180, bountyOverride: 14 }] },
      { waveNumber: 5, clearBonus: 40, groups: [{ enemyId: 'shield_loader', count: 8, spacing: 1.05, hpOverride: 173, bountyOverride: 12 }, { enemyId: 'hover_drone', count: 15, spacing: 0.5, hpOverride: 77, bountyOverride: 7 }] },
      { waveNumber: 6, clearBonus: 45, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 1.0, hpOverride: 213, bountyOverride: 14 }, { enemyId: 'turbo_hopper', count: 16, spacing: 0.45, hpOverride: 79, bountyOverride: 6 }] },
      { waveNumber: 7, clearBonus: 50, groups: [{ enemyId: 'swarm_saw', count: 34, spacing: 0.19, hpOverride: 41, bountyOverride: 3 }, { enemyId: 'shield_loader', count: 9, spacing: 0.9, hpOverride: 231, bountyOverride: 12 }] },
      { waveNumber: 8, clearBonus: 55, groups: [{ enemyId: 'chomp_brute', count: 10, spacing: 0.85, hpOverride: 232, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 18, spacing: 0.42, hpOverride: 97, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 109, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 0.9, hpOverride: 219, bountyOverride: 14 }, { enemyId: 'turbo_hopper', count: 13, spacing: 0.45, hpOverride: 75, bountyOverride: 6 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.4, hpOverride: 2250, bountyOverride: 85 }] },
    ],
  },
  // --- CHAPTER III: KRİSTAL MAĞARA ---
  {
    id: 7,
    biome: 'cavern',
    concept: 'biolum_quartz_stream',
    nameKey: 'level.7.name',
    unlocked: true,
    mapPin: { xPct: 48, yPct: 38 },
    startGold: 295,
    baseHp: 150,
    killZoneMeters: 16.5,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.2 },
      { x: -3.1, z: 6.0 },
      { x: -3.1, z: 2.2 },
      { x: 2.9, z: 1.2 },
      { x: 2.9, z: -2.6 },
      { x: -2.8, z: -3.8 },
      { x: -2.5, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.3, z: 4.3 },
      { id: 'slot_2', x: 1.4, z: 3.8 },
      { id: 'slot_3', x: -1.2, z: -0.8, runeSlot: true },
      { id: 'slot_4', x: 1.3, z: -0.6, runeSlot: true },
      { id: 'slot_5', x: 0.1, z: -4.9 },
      { id: 'slot_6', x: 2.2, z: 5.8 },
      { id: 'slot_7', x: 2.3, z: -5.3, lockedByStump: true, stumpClearCost: 45 },
      { id: 'slot_8', x: -3.3, z: 0.1, lockedByStump: true, stumpClearCost: 45 },
    ],
    lanterns: [
      { x: -1.6, z: 7.8 },
      { x: -4.1, z: 4.0 },
      { x: 4.1, z: -0.8 },
      { x: -3.7, z: -6.8 },
    ],
    heroStart: { x: -2.65, z: -5.15 },
    waves: [
      { waveNumber: 1, clearBonus: 25, groups: [{ enemyId: 'turbo_hopper', count: 15, spacing: 0.85, hpOverride: 78, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 27, groups: [{ enemyId: 'shield_loader', count: 4, spacing: 1.65, hpOverride: 169, bountyOverride: 12 }, { enemyId: 'chomp_brute', count: 4, spacing: 1.8, hpOverride: 174, bountyOverride: 14 }] },
      { waveNumber: 3, clearBonus: 29, announceEnemy: 'repair_drone', groups: [{ enemyId: 'shield_loader', count: 6, spacing: 1.35, hpOverride: 190, bountyOverride: 12 }, { enemyId: 'repair_drone', count: 5, spacing: 1.05, hpOverride: 93, bountyOverride: 9 }] },
      { waveNumber: 4, clearBonus: 32, groups: [{ enemyId: 'hover_drone', count: 13, spacing: 0.58, hpOverride: 99, bountyOverride: 7 }, { enemyId: 'repair_drone', count: 6, spacing: 0.95, hpOverride: 99, bountyOverride: 9 }] },
      { waveNumber: 5, clearBonus: 34, groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.05, hpOverride: 222, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 5, spacing: 0.85, hpOverride: 129, bountyOverride: 9 }] },
      { waveNumber: 6, clearBonus: 38, groups: [{ enemyId: 'turbo_hopper', count: 19, spacing: 0.42, hpOverride: 69, bountyOverride: 6 }, { enemyId: 'shield_loader', count: 7, spacing: 0.92, hpOverride: 180, bountyOverride: 12 }] },
      { waveNumber: 7, clearBonus: 42, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.85, hpOverride: 217, bountyOverride: 12 }, { enemyId: 'repair_drone', count: 8, spacing: 0.7, hpOverride: 105, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 46, groups: [{ enemyId: 'chomp_brute', count: 10, spacing: 0.84, hpOverride: 209, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 16, spacing: 0.42, hpOverride: 90, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 90, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'repair_drone', count: 11, spacing: 0.72, hpOverride: 161, bountyOverride: 9 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.2, hpOverride: 2350, bountyOverride: 85 }] },
    ],
  },
  {
    id: 8,
    biome: 'cavern',
    concept: 'abandoned_drill_mine',
    nameKey: 'level.8.name',
    unlocked: true,
    mapPin: { xPct: 73, yPct: 30 },
    startGold: 320,
    baseHp: 150,
    killZoneMeters: 17.0,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.4 },
      { x: -3.2, z: 4.6 },
      { x: -3.2, z: -3.2 },
      { x: 0.0, z: -5.1 },
      { x: 2.7, z: -6.4 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.4 },
      { x: 3.2, z: 4.6 },
      { x: 3.2, z: -3.2 },
      { x: 0.0, z: -5.1 },
      { x: -2.7, z: -6.4 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 4.2 },
      { id: 'slot_2', x: 0.0, z: 1.6, runeSlot: true },
      { id: 'slot_3', x: 0.0, z: -1.0, runeSlot: true },
      { id: 'slot_4', x: 0.0, z: -3.2 },
      { id: 'slot_5', x: -3.4, z: 6.6 },
      { id: 'slot_6', x: 3.4, z: 6.6 },
      { id: 'slot_7', x: -1.5, z: 2.9, lockedByStump: true, stumpClearCost: 50 },
      { id: 'slot_8', x: 1.5, z: 2.9, lockedByStump: true, stumpClearCost: 50 },
    ],
    lanterns: [
      { x: -1.7, z: 7.6 },
      { x: 1.7, z: 7.6 },
      { x: -4.3, z: 0.6 },
      { x: 4.3, z: 0.6 },
    ],
    heroStart: { x: 0.0, z: -5.1 },
    waves: [
      { waveNumber: 1, clearBonus: 29, groups: [{ enemyId: 'swarm_saw', count: 21, spacing: 0.28, hpOverride: 36, bountyOverride: 4 }, { enemyId: 'turbo_hopper', count: 8, spacing: 0.72, hpOverride: 82, bountyOverride: 7 }] },
      { waveNumber: 2, clearBonus: 32, groups: [{ enemyId: 'chomp_brute', count: 5, spacing: 1.4, hpOverride: 216, bountyOverride: 15 }, { enemyId: 'repair_drone', count: 5, spacing: 0.95, hpOverride: 111, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 36, announceEnemy: 'crystal_golem', groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 2.1, hpOverride: 473, bountyOverride: 20 }] },
      { waveNumber: 4, clearBonus: 38, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.8, hpOverride: 381, bountyOverride: 20 }, { enemyId: 'repair_drone', count: 8, spacing: 0.9, hpOverride: 83, bountyOverride: 10 }] },
      { waveNumber: 5, clearBonus: 41, groups: [{ enemyId: 'turbo_hopper', count: 18, spacing: 0.4, hpOverride: 73, bountyOverride: 7 }, { enemyId: 'hover_drone', count: 14, spacing: 0.45, hpOverride: 87, bountyOverride: 8 }] },
      { waveNumber: 6, clearBonus: 45, groups: [{ enemyId: 'crystal_golem', count: 5, spacing: 1.45, hpOverride: 310, bountyOverride: 20 }, { enemyId: 'chomp_brute', count: 7, spacing: 0.98, hpOverride: 197, bountyOverride: 15 }] },
      { waveNumber: 7, clearBonus: 50, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.88, hpOverride: 241, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 11, spacing: 0.7, hpOverride: 89, bountyOverride: 10 }] },
      { waveNumber: 8, clearBonus: 54, groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.3, hpOverride: 344, bountyOverride: 20 }, { enemyId: 'turbo_hopper', count: 17, spacing: 0.38, hpOverride: 89, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 59, groups: [{ enemyId: 'chomp_brute', count: 12, spacing: 0.82, hpOverride: 269, bountyOverride: 15 }, { enemyId: 'repair_drone', count: 12, spacing: 0.65, hpOverride: 109, bountyOverride: 10 }] },
      { waveNumber: 10, clearBonus: 106, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'crystal_golem', count: 6, spacing: 1.3, hpOverride: 450, bountyOverride: 20 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.4, hpOverride: 2550, bountyOverride: 90 }] },
    ],
  },
  {
    id: 9,
    biome: 'cavern',
    concept: 'amethyst_ley_sanctum',
    nameKey: 'level.9.name',
    unlocked: true,
    isBossStage: true,
    mapPin: { xPct: 48, yPct: 22 },
    startGold: 365,
    baseHp: 150,
    killZoneMeters: 17.5,
    path: [
      { x: -3.2, z: 9.8 },
      { x: -3.2, z: 6.8 },
      { x: 0.0, z: 3.8 },
      { x: 3.2, z: 0.8 },
      { x: 3.2, z: -3.4 },
      { x: 0.0, z: -5.4 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 3.2, z: 9.8 },
      { x: 3.2, z: 6.8 },
      { x: 0.0, z: 3.8 },
      { x: -3.2, z: 0.8 },
      { x: -3.2, z: -3.4 },
      { x: 0.0, z: -5.4 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 6.6 },
      { id: 'slot_2', x: 0.0, z: 0.8 },
      { id: 'slot_3', x: 0.0, z: -2.6 },
      { id: 'slot_4', x: -1.4, z: -1.1, runeSlot: true },
      { id: 'slot_5', x: 1.4, z: -1.1, runeSlot: true },
      { id: 'slot_6', x: -2.55, z: 3.8 },
      { id: 'slot_7', x: 2.55, z: 3.8, lockedByStump: true, stumpClearCost: 50 },
      { id: 'slot_8', x: -2.2, z: -6.2, lockedByStump: true, stumpClearCost: 50 },
    ],
    lanterns: [
      { x: -4.2, z: 7.4 },
      { x: 4.2, z: 7.4 },
      { x: -4.3, z: -1.6 },
      { x: 4.3, z: -1.6 },
    ],
    heroStart: { x: 0.0, z: -5.4 },
    waves: [
      { waveNumber: 1, clearBonus: 33, groups: [{ enemyId: 'turbo_hopper', count: 15, spacing: 0.65, hpOverride: 81, bountyOverride: 7 }, { enemyId: 'scout_bot', count: 13, spacing: 0.72, hpOverride: 59, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 38, groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.3, hpOverride: 226, bountyOverride: 15 }, { enemyId: 'repair_drone', count: 8, spacing: 0.9, hpOverride: 86, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 43, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.85, hpOverride: 339, bountyOverride: 20 }, { enemyId: 'hover_drone', count: 12, spacing: 0.58, hpOverride: 103, bountyOverride: 8 }] },
      { waveNumber: 4, clearBonus: 48, groups: [{ enemyId: 'swarm_saw', count: 32, spacing: 0.19, hpOverride: 43, bountyOverride: 4 }, { enemyId: 'crystal_golem', count: 4, spacing: 1.5, hpOverride: 397, bountyOverride: 20 }] },
      { waveNumber: 5, clearBonus: 53, groups: [{ enemyId: 'turbo_hopper', count: 25, spacing: 0.38, hpOverride: 89, bountyOverride: 7 }, { enemyId: 'repair_drone', count: 9, spacing: 0.66, hpOverride: 129, bountyOverride: 10 }] },
      { waveNumber: 6, clearBonus: 59, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.88, hpOverride: 213, bountyOverride: 14 }, { enemyId: 'chomp_brute', count: 8, spacing: 0.95, hpOverride: 217, bountyOverride: 15 }] },
      { waveNumber: 7, clearBonus: 64, groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.25, hpOverride: 392, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 12, spacing: 0.62, hpOverride: 107, bountyOverride: 10 }] },
      { waveNumber: 8, clearBonus: 70, groups: [{ enemyId: 'chomp_brute', count: 11, spacing: 0.78, hpOverride: 259, bountyOverride: 15 }, { enemyId: 'hover_drone', count: 21, spacing: 0.36, hpOverride: 105, bountyOverride: 8 }] },
      { waveNumber: 9, clearBonus: 76, groups: [{ enemyId: 'crystal_golem', count: 9, spacing: 1.15, hpOverride: 395, bountyOverride: 22 }, { enemyId: 'turbo_hopper', count: 23, spacing: 0.34, hpOverride: 96, bountyOverride: 7 }] },
      { waveNumber: 10, clearBonus: 141, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'repair_drone', count: 8, spacing: 0.74, hpOverride: 161, bountyOverride: 10 }, { enemyId: 'crystal_golem', count: 5, spacing: 1.25, hpOverride: 571, bountyOverride: 22 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 2450, bountyOverride: 110 }] },
    ],
  },
  // --- CHAPTER IV: KARLI ZİRVE ---
  {
    id: 10,
    biome: 'snow',
    concept: 'frozen_mirror_lake',
    nameKey: 'level.10.name',
    unlocked: true,
    mapPin: { xPct: 72, yPct: 16 },
    startGold: 410,
    baseHp: 150,
    killZoneMeters: 17.5,
    path: [
      { x: -2.8, z: 9.8 },
      { x: -2.8, z: 6.4 },
      { x: 2.8, z: 5.2 },
      { x: 2.8, z: -1.8 },
      { x: -2.7, z: -2.9 },
      { x: -2.6, z: -6.3 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.5, z: 4.1 },
      { id: 'slot_2', x: 0.9, z: 2.2 },
      { id: 'slot_3', x: -1.3, z: 1.6 },
      { id: 'slot_4', x: 0.8, z: -0.4 },
      { id: 'slot_5', x: -0.1, z: -4.9 },
      { id: 'slot_6', x: 2.4, z: -4.4 },
      { id: 'slot_7', x: -3.3, z: 0.2, lockedByStump: true, stumpClearCost: 50 },
      { id: 'slot_8', x: 2.2, z: -6.4, lockedByStump: true, stumpClearCost: 50 },
    ],
    lanterns: [
      { x: -4.0, z: 7.4 },
      { x: 4.1, z: 3.5 },
      { x: -4.0, z: -4.2 },
      { x: 3.1, z: -7.2 },
    ],
    heroStart: { x: -2.65, z: -4.6 },
    iceZones: [
      { x: 2.8, z: 1.7, radius: 2.3 },
      { x: -2.65, z: -4.6, radius: 2.1 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 36, groups: [{ enemyId: 'turbo_hopper', count: 16, spacing: 0.6, hpOverride: 81, bountyOverride: 7 }, { enemyId: 'chomp_brute', count: 5, spacing: 1.45, hpOverride: 173, bountyOverride: 16 }] },
      { waveNumber: 2, clearBonus: 41, groups: [{ enemyId: 'hover_drone', count: 16, spacing: 0.52, hpOverride: 106, bountyOverride: 8 }, { enemyId: 'repair_drone', count: 6, spacing: 0.85, hpOverride: 130, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 46, groups: [{ enemyId: 'crystal_golem', count: 5, spacing: 1.75, hpOverride: 331, bountyOverride: 22 }, { enemyId: 'swarm_saw', count: 24, spacing: 0.27, hpOverride: 49, bountyOverride: 4 }] },
      { waveNumber: 4, clearBonus: 51, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.9, hpOverride: 239, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 7, spacing: 0.72, hpOverride: 122, bountyOverride: 10 }] },
      { waveNumber: 5, clearBonus: 57, groups: [{ enemyId: 'turbo_hopper', count: 22, spacing: 0.38, hpOverride: 84, bountyOverride: 7 }, { enemyId: 'chomp_brute', count: 7, spacing: 0.88, hpOverride: 266, bountyOverride: 16 }] },
      { waveNumber: 6, clearBonus: 62, groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.3, hpOverride: 426, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 8, spacing: 0.64, hpOverride: 158, bountyOverride: 10 }] },
      { waveNumber: 7, clearBonus: 69, groups: [{ enemyId: 'chomp_brute', count: 11, spacing: 0.78, hpOverride: 248, bountyOverride: 16 }, { enemyId: 'hover_drone', count: 26, spacing: 0.36, hpOverride: 82, bountyOverride: 8 }] },
      { waveNumber: 8, clearBonus: 75, groups: [{ enemyId: 'crystal_golem', count: 9, spacing: 1.15, hpOverride: 382, bountyOverride: 22 }, { enemyId: 'turbo_hopper', count: 25, spacing: 0.33, hpOverride: 85, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 84, groups: [{ enemyId: 'shield_loader', count: 14, spacing: 0.78, hpOverride: 319, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 12, spacing: 0.58, hpOverride: 159, bountyOverride: 10 }] },
      { waveNumber: 10, clearBonus: 148, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.15, hpOverride: 470, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 9, spacing: 0.6, hpOverride: 150, bountyOverride: 10 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.4, hpOverride: 2650, bountyOverride: 115 }] },
    ],
  },
  {
    id: 11,
    biome: 'snow',
    concept: 'blizzard_watchtower',
    nameKey: 'level.11.name',
    unlocked: false,
    mapPin: { xPct: 33, yPct: 15 },
    startGold: 455,
    baseHp: 150,
    killZoneMeters: 18.0,
    path: [
      { x: -2.9, z: 9.8 },
      { x: -3.1, z: 6.0 },
      { x: 2.9, z: 1.2 },
      { x: 2.9, z: -3.4 },
      { x: 0.0, z: -4.8 },
      { x: -2.4, z: -6.4 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 2.9, z: 9.8 },
      { x: 3.1, z: 6.0 },
      { x: -2.9, z: 1.2 },
      { x: -2.9, z: -3.4 },
      { x: 0.0, z: -4.8 },
      { x: 2.4, z: -6.4 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 6.4 },
      { id: 'slot_2', x: -3.2, z: 3.5 },
      { id: 'slot_3', x: 3.2, z: 3.5 },
      { id: 'slot_4', x: 0.0, z: 1.0 },
      { id: 'slot_5', x: 0.0, z: -2.7 },
      { id: 'slot_6', x: -1.1, z: -0.9 },
      { id: 'slot_7', x: 1.1, z: -0.9, lockedByStump: true, stumpClearCost: 55 },
      { id: 'slot_8', x: 3.4, z: -5.0, lockedByStump: true, stumpClearCost: 55 },
    ],
    lanterns: [
      { x: -4.2, z: 7.4 },
      { x: 4.2, z: 7.4 },
      { x: -4.2, z: -1.2 },
      { x: 4.2, z: -1.2 },
    ],
    heroStart: { x: 0.0, z: 3.6 },
    iceZones: [
      { x: 0.0, z: 3.6, radius: 2.4 },
      { x: 0.0, z: -4.8, radius: 2.2 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 42, groups: [{ enemyId: 'turbo_hopper', count: 18, spacing: 0.55, hpOverride: 83, bountyOverride: 7 }, { enemyId: 'hover_drone', count: 15, spacing: 0.58, hpOverride: 79, bountyOverride: 8 }] },
      { waveNumber: 2, clearBonus: 48, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 1.15, hpOverride: 260, bountyOverride: 16 }, { enemyId: 'repair_drone', count: 7, spacing: 0.78, hpOverride: 135, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 54, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.7, hpOverride: 420, bountyOverride: 22 }, { enemyId: 'shield_loader', count: 6, spacing: 1.15, hpOverride: 290, bountyOverride: 14 }] },
      { waveNumber: 4, clearBonus: 59, groups: [{ enemyId: 'swarm_saw', count: 35, spacing: 0.18, hpOverride: 47, bountyOverride: 4 }, { enemyId: 'chomp_brute', count: 10, spacing: 0.9, hpOverride: 222, bountyOverride: 16 }] },
      { waveNumber: 5, clearBonus: 65, groups: [{ enemyId: 'turbo_hopper', count: 28, spacing: 0.35, hpOverride: 102, bountyOverride: 7 }, { enemyId: 'repair_drone', count: 12, spacing: 0.62, hpOverride: 126, bountyOverride: 10 }] },
      { waveNumber: 6, clearBonus: 73, groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.2, hpOverride: 398, bountyOverride: 22 }, { enemyId: 'hover_drone', count: 20, spacing: 0.36, hpOverride: 107, bountyOverride: 8 }] },
      { waveNumber: 7, clearBonus: 82, groups: [{ enemyId: 'shield_loader', count: 11, spacing: 0.78, hpOverride: 251, bountyOverride: 14 }, { enemyId: 'chomp_brute', count: 11, spacing: 0.76, hpOverride: 256, bountyOverride: 16 }] },
      { waveNumber: 8, clearBonus: 87, groups: [{ enemyId: 'crystal_golem', count: 10, spacing: 1.05, hpOverride: 455, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 12, spacing: 0.54, hpOverride: 146, bountyOverride: 10 }] },
      { waveNumber: 9, clearBonus: 96, groups: [{ enemyId: 'turbo_hopper', count: 30, spacing: 0.3, hpOverride: 107, bountyOverride: 7 }, { enemyId: 'chomp_brute', count: 13, spacing: 0.72, hpOverride: 301, bountyOverride: 16 }] },
      { waveNumber: 10, clearBonus: 101, groups: [{ enemyId: 'crystal_golem', count: 11, spacing: 0.95, hpOverride: 466, bountyOverride: 22 }, { enemyId: 'hover_drone', count: 23, spacing: 0.32, hpOverride: 127, bountyOverride: 8 }] },
      { waveNumber: 11, clearBonus: 183, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.1, hpOverride: 540, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 11, spacing: 0.55, hpOverride: 175, bountyOverride: 10 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.4, hpOverride: 2850, bountyOverride: 125 }] },
    ],
  },
  {
    id: 12,
    biome: 'snow',
    concept: 'aurora_citadel_siege',
    nameKey: 'level.12.name',
    unlocked: false,
    isBossStage: true,
    mapPin: { xPct: 51, yPct: 6.8 },
    startGold: 520,
    baseHp: 150,
    killZoneMeters: 18.5,
    path: [
      { x: -3.1, z: 9.8 },
      { x: -3.2, z: 6.2 },
      { x: -3.2, z: 0.4 },
      { x: -3.1, z: -3.5 },
      { x: 0.0, z: -4.4 },
      { x: 2.8, z: -5.8 },
      { x: 2.6, z: -7.5 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 3.1, z: 9.8 },
      { x: 3.2, z: 6.2 },
      { x: 3.2, z: 0.4 },
      { x: 3.1, z: -3.5 },
      { x: 0.0, z: -4.4 },
      { x: -2.8, z: -5.8 },
      { x: -2.6, z: -7.5 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 6.5 },
      { id: 'slot_2', x: 0.0, z: 3.6, runeSlot: true },
      { id: 'slot_3', x: 0.0, z: 0.9, runeSlot: true },
      { id: 'slot_4', x: 0.0, z: -1.8 },
      { id: 'slot_5', x: -1.5, z: 4.8 },
      { id: 'slot_6', x: 1.5, z: 4.8 },
      { id: 'slot_7', x: -1.5, z: -0.5, lockedByStump: true, stumpClearCost: 55 },
      { id: 'slot_8', x: 1.5, z: -0.5, lockedByStump: true, stumpClearCost: 55 },
    ],
    lanterns: [
      { x: -4.3, z: 7.4 },
      { x: 4.3, z: 7.4 },
      { x: -4.3, z: -1.2 },
      { x: 4.3, z: -1.2 },
    ],
    heroStart: { x: 0.0, z: -4.4 },
    iceZones: [
      { x: -3.2, z: 3.3, radius: 2.2 },
      { x: 3.2, z: 3.3, radius: 2.2 },
    ],
    barrels: [
      { id: 'barrel_1', x: -1.9, z: -2.4 },
      { id: 'barrel_2', x: 1.9, z: -2.4 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 42, groups: [{ enemyId: 'scout_bot', count: 22, spacing: 0.48, hpOverride: 50, bountyOverride: 5 }, { enemyId: 'turbo_hopper', count: 20, spacing: 0.46, hpOverride: 78, bountyOverride: 7 }] },
      { waveNumber: 2, clearBonus: 47, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 1.05, hpOverride: 224, bountyOverride: 16 }, { enemyId: 'swarm_saw', count: 35, spacing: 0.16, hpOverride: 35, bountyOverride: 3 }] },
      { waveNumber: 3, clearBonus: 53, groups: [{ enemyId: 'hover_drone', count: 19, spacing: 0.44, hpOverride: 120, bountyOverride: 9 }, { enemyId: 'repair_drone', count: 7, spacing: 0.65, hpOverride: 172, bountyOverride: 10 }] },
      { waveNumber: 4, clearBonus: 61, groups: [{ enemyId: 'crystal_golem', count: 5, spacing: 1.35, hpOverride: 385, bountyOverride: 22 }, { enemyId: 'shield_loader', count: 9, spacing: 0.88, hpOverride: 230, bountyOverride: 14 }] },
      { waveNumber: 5, clearBonus: 68, groups: [{ enemyId: 'turbo_hopper', count: 29, spacing: 0.32, hpOverride: 106, bountyOverride: 8 }, { enemyId: 'repair_drone', count: 10, spacing: 0.58, hpOverride: 150, bountyOverride: 10 }] },
      { waveNumber: 6, clearBonus: 74, groups: [{ enemyId: 'chomp_brute', count: 10, spacing: 0.8, hpOverride: 254, bountyOverride: 16 }, { enemyId: 'crystal_golem', count: 6, spacing: 1.15, hpOverride: 450, bountyOverride: 22 }] },
      { waveNumber: 7, clearBonus: 82, groups: [{ enemyId: 'shield_loader', count: 13, spacing: 0.74, hpOverride: 252, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 22, spacing: 0.34, hpOverride: 124, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 90, groups: [{ enemyId: 'crystal_golem', count: 11, spacing: 1.0, hpOverride: 477, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 11, spacing: 0.52, hpOverride: 148, bountyOverride: 10 }] },
      { waveNumber: 9, clearBonus: 97, groups: [{ enemyId: 'turbo_hopper', count: 33, spacing: 0.27, hpOverride: 113, bountyOverride: 8 }, { enemyId: 'chomp_brute', count: 14, spacing: 0.7, hpOverride: 297, bountyOverride: 16 }] },
      { waveNumber: 10, clearBonus: 108, groups: [{ enemyId: 'crystal_golem', count: 12, spacing: 0.92, hpOverride: 478, bountyOverride: 22 }, { enemyId: 'hover_drone', count: 26, spacing: 0.3, hpOverride: 127, bountyOverride: 9 }] },
      { waveNumber: 11, clearBonus: 125, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'chomp_brute', count: 14, spacing: 0.8, hpOverride: 390, bountyOverride: 16 }, { enemyId: 'repair_drone', count: 13, spacing: 0.55, hpOverride: 188, bountyOverride: 10 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.5, hpOverride: 2450, bountyOverride: 100 }] },
      { waveNumber: 12, clearBonus: 263, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'crystal_golem', count: 10, spacing: 1.05, hpOverride: 594, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 17, spacing: 0.52, hpOverride: 148, bountyOverride: 10 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 3400, bountyOverride: 140 }] },
    ],
  },
  // --- CHAPTER V: KOR DÖKÜMHANESİ ---
  {
    id: 13,
    biome: 'foundry',
    concept: 'cinder_slag_canal',
    nameKey: 'level.13.name',
    unlocked: false,
    mapPin: { xPct: 71, yPct: 17.5 },
    startGold: 540,
    baseHp: 150,
    killZoneMeters: 18.5,
    path: [
      { x: -2.9, z: 9.8 },
      { x: -2.9, z: 6.2 },
      { x: 2.9, z: 4.8 },
      { x: 2.9, z: -1.4 },
      { x: -2.8, z: -2.8 },
      { x: -2.8, z: -6.3 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.4, z: 3.1 },
      { id: 'slot_2', x: 0.8, z: 1.2 },
      { id: 'slot_3', x: -1.4, z: 0.8 },
      { id: 'slot_4', x: 0.6, z: -4.5 },
      { id: 'slot_5', x: 2.7, z: -4.4 },
      { id: 'slot_6', x: 2.4, z: 6.7 },
      { id: 'slot_7', x: -3.4, z: -0.2, lockedByStump: true, stumpClearCost: 55 },
      { id: 'slot_8', x: 2.6, z: -6.5, lockedByStump: true, stumpClearCost: 55 },
    ],
    lanterns: [
      { x: -4.1, z: 7.4 },
      { x: 4.1, z: 3.0 },
      { x: -4.1, z: -4.0 },
      { x: 4.05, z: -7.35 },
    ],
    heroStart: { x: -2.8, z: -4.6 },
    barrels: [
      { id: 'barrel_1', x: -2.6, z: 4.9 },
      { id: 'barrel_2', x: -1.7, z: -3.6 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 55, groups: [{ enemyId: 'turbo_hopper', count: 24, spacing: 0.42, hpOverride: 95, bountyOverride: 7 }, { enemyId: 'scout_bot', count: 16, spacing: 0.5, hpOverride: 75, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 62, announceEnemy: 'frost_warden', groups: [{ enemyId: 'frost_warden', count: 10, spacing: 1.0, hpOverride: 260, bountyOverride: 16 }, { enemyId: 'swarm_saw', count: 32, spacing: 0.2, hpOverride: 44, bountyOverride: 4 }] },
      { waveNumber: 3, clearBonus: 70, groups: [{ enemyId: 'hover_drone', count: 22, spacing: 0.4, hpOverride: 115, bountyOverride: 8 }, { enemyId: 'frost_warden', count: 8, spacing: 1.05, hpOverride: 265, bountyOverride: 16 }] },
      { waveNumber: 4, clearBonus: 80, announceEnemy: 'ember_bomber', groups: [{ enemyId: 'ember_bomber', count: 20, spacing: 0.48, hpOverride: 145, bountyOverride: 9 }, { enemyId: 'chomp_brute', count: 10, spacing: 0.85, hpOverride: 245, bountyOverride: 16 }] },
      { waveNumber: 5, clearBonus: 92, groups: [{ enemyId: 'ember_bomber', count: 24, spacing: 0.4, hpOverride: 150, bountyOverride: 9 }, { enemyId: 'frost_warden', count: 10, spacing: 0.9, hpOverride: 260, bountyOverride: 16 }] },
      { waveNumber: 6, clearBonus: 104, groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.15, hpOverride: 470, bountyOverride: 22 }, { enemyId: 'ember_bomber', count: 22, spacing: 0.38, hpOverride: 155, bountyOverride: 9 }] },
      { waveNumber: 7, clearBonus: 118, groups: [{ enemyId: 'frost_warden', count: 14, spacing: 0.78, hpOverride: 280, bountyOverride: 16 }, { enemyId: 'repair_drone', count: 14, spacing: 0.55, hpOverride: 165, bountyOverride: 10 }, { enemyId: 'ember_bomber', count: 16, spacing: 0.4, hpOverride: 140, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 135, groups: [{ enemyId: 'ember_bomber', count: 32, spacing: 0.3, hpOverride: 160, bountyOverride: 9 }, { enemyId: 'crystal_golem', count: 9, spacing: 1.0, hpOverride: 495, bountyOverride: 22 }] },
      { waveNumber: 9, clearBonus: 156, groups: [{ enemyId: 'frost_warden', count: 16, spacing: 0.7, hpOverride: 300, bountyOverride: 16 }, { enemyId: 'chomp_brute', count: 14, spacing: 0.7, hpOverride: 290, bountyOverride: 16 }, { enemyId: 'repair_drone', count: 14, spacing: 0.5, hpOverride: 160, bountyOverride: 10 }] },
      { waveNumber: 10, clearBonus: 220, groups: [{ enemyId: 'ember_bomber', count: 26, spacing: 0.34, hpOverride: 165, bountyOverride: 9 }, { enemyId: 'frost_warden', count: 14, spacing: 0.75, hpOverride: 315, bountyOverride: 16 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 4100, bountyOverride: 145 }] },
    ],
  },
  {
    id: 14,
    biome: 'foundry',
    concept: 'clockwork_gear_bridge',
    nameKey: 'level.14.name',
    unlocked: false,
    mapPin: { xPct: 58, yPct: 13.5 },
    startGold: 580,
    baseHp: 150,
    killZoneMeters: 18.5,
    path: [
      { x: -3.0, z: 9.8 },
      { x: -3.0, z: 5.8 },
      { x: -1.1, z: 3.6 },
      { x: -3.1, z: 1.1 },
      { x: -2.9, z: -3.3 },
      { x: 0.0, z: -4.5 },
      { x: 2.8, z: -5.9 },
      { x: 2.4, z: -7.6 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 3.0, z: 9.8 },
      { x: 3.0, z: 5.8 },
      { x: 1.1, z: 3.6 },
      { x: 3.1, z: 1.1 },
      { x: 2.9, z: -3.3 },
      { x: 0.0, z: -4.5 },
      { x: -2.8, z: -5.9 },
      { x: -2.4, z: -7.6 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 6.5 },
      { id: 'slot_2', x: 0.0, z: 0.4, runeSlot: true },
      { id: 'slot_3', x: 0.0, z: -2.4 },
      { id: 'slot_4', x: -1.1, z: -1.0 },
      { id: 'slot_5', x: 1.1, z: -1.0 },
      { id: 'slot_6', x: -3.5, z: 3.6 },
      { id: 'slot_7', x: 3.5, z: 3.6, lockedByStump: true, stumpClearCost: 55 },
      { id: 'slot_8', x: 0.0, z: -6.55, lockedByStump: true, stumpClearCost: 55 },
    ],
    lanterns: [
      { x: -4.2, z: 7.4 },
      { x: 4.2, z: 7.4 },
      { x: -4.2, z: -1.0 },
      { x: 4.2, z: -1.0 },
    ],
    heroStart: { x: 0.0, z: -4.5 },
    waves: [
      { waveNumber: 1, clearBonus: 66, groups: [{ enemyId: 'ember_bomber', count: 22, spacing: 0.45, hpOverride: 135, bountyOverride: 9 }, { enemyId: 'swarm_saw', count: 30, spacing: 0.2, hpOverride: 42, bountyOverride: 4 }] },
      { waveNumber: 2, clearBonus: 76, groups: [{ enemyId: 'frost_warden', count: 12, spacing: 0.9, hpOverride: 280, bountyOverride: 16 }, { enemyId: 'hover_drone', count: 16, spacing: 0.45, hpOverride: 95, bountyOverride: 8 }] },
      { waveNumber: 3, clearBonus: 88, announceEnemy: 'tesla_strider', groups: [{ enemyId: 'tesla_strider', count: 10, spacing: 1.0, hpOverride: 245, bountyOverride: 14 }, { enemyId: 'ember_bomber', count: 22, spacing: 0.4, hpOverride: 145, bountyOverride: 9 }] },
      { waveNumber: 4, clearBonus: 100, groups: [{ enemyId: 'tesla_strider', count: 12, spacing: 0.88, hpOverride: 255, bountyOverride: 14 }, { enemyId: 'crystal_golem', count: 7, spacing: 1.25, hpOverride: 490, bountyOverride: 22 }] },
      { waveNumber: 5, clearBonus: 112, groups: [{ enemyId: 'frost_warden', count: 14, spacing: 0.78, hpOverride: 310, bountyOverride: 16 }, { enemyId: 'ember_bomber', count: 20, spacing: 0.38, hpOverride: 155, bountyOverride: 9 }] },
      { waveNumber: 6, clearBonus: 128, groups: [{ enemyId: 'tesla_strider', count: 15, spacing: 0.75, hpOverride: 270, bountyOverride: 14 }, { enemyId: 'chomp_brute', count: 14, spacing: 0.7, hpOverride: 315, bountyOverride: 16 }] },
      { waveNumber: 7, clearBonus: 145, groups: [{ enemyId: 'crystal_golem', count: 11, spacing: 0.98, hpOverride: 515, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 14, spacing: 0.5, hpOverride: 175, bountyOverride: 10 }, { enemyId: 'ember_bomber', count: 12, spacing: 0.36, hpOverride: 155, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 168, groups: [{ enemyId: 'tesla_strider', count: 16, spacing: 0.68, hpOverride: 290, bountyOverride: 14 }, { enemyId: 'frost_warden', count: 16, spacing: 0.72, hpOverride: 330, bountyOverride: 16 }, { enemyId: 'swarm_saw', count: 35, spacing: 0.16, hpOverride: 44, bountyOverride: 4 }] },
      { waveNumber: 9, clearBonus: 192, groups: [{ enemyId: 'ember_bomber', count: 35, spacing: 0.28, hpOverride: 168, bountyOverride: 9 }, { enemyId: 'crystal_golem', count: 11, spacing: 0.9, hpOverride: 530, bountyOverride: 22 }, { enemyId: 'tesla_strider', count: 6, spacing: 0.9, hpOverride: 250, bountyOverride: 14 }] },
      { waveNumber: 10, clearBonus: 215, groups: [{ enemyId: 'frost_warden', count: 18, spacing: 0.65, hpOverride: 340, bountyOverride: 16 }, { enemyId: 'tesla_strider', count: 18, spacing: 0.62, hpOverride: 310, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 30, spacing: 0.28, hpOverride: 135, bountyOverride: 9 }] },
      { waveNumber: 11, clearBonus: 310, groups: [{ enemyId: 'crystal_golem', count: 10, spacing: 0.95, hpOverride: 580, bountyOverride: 22 }, { enemyId: 'tesla_strider', count: 14, spacing: 0.7, hpOverride: 320, bountyOverride: 14 }, { enemyId: 'ember_bomber', count: 22, spacing: 0.3, hpOverride: 160, bountyOverride: 9 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 4550, bountyOverride: 155 }] },
    ],
  },
  {
    id: 15,
    biome: 'foundry',
    concept: 'magma_crucible_arena',
    nameKey: 'level.15.name',
    unlocked: false,
    mapPin: { xPct: 41, yPct: 11.0 },
    startGold: 620,
    baseHp: 150,
    killZoneMeters: 19.0,
    path: [
      { x: -3.1, z: 9.8 },
      { x: -3.1, z: 6.5 },
      { x: 3.2, z: 6.5 },
      { x: 3.2, z: -6.3 },
      { x: 0.0, z: -6.3 },
      { x: 0.0, z: 2.0 },
      { x: -3.2, z: 2.0 },
      { x: -3.2, z: -6.6 },
      { x: 0.0, z: -7.9 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 1.6, z: 4.4 },
      { id: 'slot_2', x: 1.6, z: 1.2, runeSlot: true },
      { id: 'slot_3', x: 1.6, z: -1.6 },
      { id: 'slot_4', x: -1.6, z: -0.4, runeSlot: true },
      { id: 'slot_5', x: -1.6, z: -3.6 },
      { id: 'slot_6', x: -1.55, z: 4.2 },
      { id: 'slot_7', x: 1.6, z: -4.4, lockedByStump: true, stumpClearCost: 60 },
      { id: 'slot_8', x: -3.4, z: 4.2, lockedByStump: true, stumpClearCost: 60 },
    ],
    lanterns: [
      { x: -4.2, z: 7.4 },
      { x: 4.3, z: 4.0 },
      { x: -4.3, z: -1.0 },
      { x: 4.2, z: -5.2 },
    ],
    heroStart: { x: 0.0, z: -2.8 },
    barrels: [
      { id: 'barrel_1', x: 0.1, z: 3.1 },
      { id: 'barrel_2', x: -2.1, z: -5.5 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 86, groups: [{ enemyId: 'ember_bomber', count: 24, spacing: 0.4, hpOverride: 140, bountyOverride: 9 }, { enemyId: 'turbo_hopper', count: 18, spacing: 0.44, hpOverride: 95, bountyOverride: 7 }] },
      { waveNumber: 2, clearBonus: 98, groups: [{ enemyId: 'frost_warden', count: 12, spacing: 0.85, hpOverride: 310, bountyOverride: 16 }, { enemyId: 'tesla_strider', count: 8, spacing: 0.95, hpOverride: 265, bountyOverride: 14 }] },
      { waveNumber: 3, clearBonus: 110, groups: [{ enemyId: 'swarm_saw', count: 44, spacing: 0.14, hpOverride: 52, bountyOverride: 4 }, { enemyId: 'chomp_brute', count: 14, spacing: 0.7, hpOverride: 310, bountyOverride: 16 }] },
      { waveNumber: 4, clearBonus: 124, groups: [{ enemyId: 'crystal_golem', count: 10, spacing: 1.0, hpOverride: 520, bountyOverride: 22 }, { enemyId: 'tesla_strider', count: 10, spacing: 0.8, hpOverride: 265, bountyOverride: 14 }] },
      { waveNumber: 5, clearBonus: 138, groups: [{ enemyId: 'ember_bomber', count: 34, spacing: 0.28, hpOverride: 165, bountyOverride: 9 }, { enemyId: 'frost_warden', count: 12, spacing: 0.78, hpOverride: 290, bountyOverride: 16 }] },
      { waveNumber: 6, clearBonus: 158, groups: [{ enemyId: 'hover_drone', count: 32, spacing: 0.26, hpOverride: 140, bountyOverride: 9 }, { enemyId: 'repair_drone', count: 16, spacing: 0.48, hpOverride: 190, bountyOverride: 10 }, { enemyId: 'tesla_strider', count: 10, spacing: 0.72, hpOverride: 280, bountyOverride: 14 }] },
      { waveNumber: 7, clearBonus: 178, groups: [{ enemyId: 'crystal_golem', count: 13, spacing: 0.88, hpOverride: 540, bountyOverride: 22 }, { enemyId: 'ember_bomber', count: 28, spacing: 0.28, hpOverride: 175, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 204, groups: [{ enemyId: 'frost_warden', count: 18, spacing: 0.65, hpOverride: 350, bountyOverride: 16 }, { enemyId: 'tesla_strider', count: 18, spacing: 0.6, hpOverride: 320, bountyOverride: 14 }, { enemyId: 'swarm_saw', count: 30, spacing: 0.14, hpOverride: 60, bountyOverride: 4 }] },
      { waveNumber: 9, clearBonus: 234, groups: [{ enemyId: 'chomp_brute', count: 18, spacing: 0.6, hpOverride: 350, bountyOverride: 16 }, { enemyId: 'crystal_golem', count: 12, spacing: 0.82, hpOverride: 575, bountyOverride: 22 }, { enemyId: 'ember_bomber', count: 15, spacing: 0.3, hpOverride: 180, bountyOverride: 9 }] },
      { waveNumber: 10, clearBonus: 266, groups: [{ enemyId: 'ember_bomber', count: 40, spacing: 0.24, hpOverride: 195, bountyOverride: 9 }, { enemyId: 'tesla_strider', count: 22, spacing: 0.52, hpOverride: 345, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 15, spacing: 0.48, hpOverride: 200, bountyOverride: 10 }] },
      { waveNumber: 11, clearBonus: 305, groups: [{ enemyId: 'frost_warden', count: 20, spacing: 0.6, hpOverride: 380, bountyOverride: 16 }, { enemyId: 'crystal_golem', count: 14, spacing: 0.8, hpOverride: 590, bountyOverride: 22 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.5, hpOverride: 5000, bountyOverride: 150 }] },
      { waveNumber: 12, clearBonus: 380, groups: [{ enemyId: 'crystal_golem', count: 14, spacing: 0.82, hpOverride: 600, bountyOverride: 22 }, { enemyId: 'tesla_strider', count: 22, spacing: 0.52, hpOverride: 355, bountyOverride: 14 }, { enemyId: 'ember_bomber', count: 24, spacing: 0.28, hpOverride: 185, bountyOverride: 9 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 3650, bountyOverride: 155 }] },
    ],
  },
  {
    id: 16,
    biome: 'foundry',
    concept: 'iron_core_citadel',
    nameKey: 'level.16.name',
    unlocked: false,
    isBossStage: true,
    mapPin: { xPct: 52, yPct: 7.8 },
    startGold: 680,
    baseHp: 150,
    killZoneMeters: 19.5,
    path: [
      { x: -3.1, z: 9.8 },
      { x: -3.2, z: 6.2 },
      { x: -3.2, z: 0.4 },
      { x: -3.1, z: -3.5 },
      { x: 0.0, z: -4.4 },
      { x: 2.8, z: -5.8 },
      { x: 2.6, z: -7.5 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    secondaryPath: [
      { x: 3.1, z: 9.8 },
      { x: 3.2, z: 6.2 },
      { x: 3.2, z: 0.4 },
      { x: 3.1, z: -3.5 },
      { x: 0.0, z: -4.4 },
      { x: -2.8, z: -5.8 },
      { x: -2.6, z: -7.5 },
      { x: 0.0, z: -8.4 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.0, z: 6.5 },
      { id: 'slot_2', x: 0.0, z: 3.6, runeSlot: true },
      { id: 'slot_3', x: 0.0, z: 0.9, runeSlot: true },
      { id: 'slot_4', x: 0.0, z: -1.8 },
      { id: 'slot_5', x: -1.5, z: 4.8 },
      { id: 'slot_6', x: 1.5, z: 4.8 },
      { id: 'slot_7', x: -1.5, z: -0.5, lockedByStump: true, stumpClearCost: 60 },
      { id: 'slot_8', x: 1.5, z: -0.5, lockedByStump: true, stumpClearCost: 60 },
    ],
    lanterns: [
      { x: -4.3, z: 7.4 },
      { x: 4.3, z: 7.4 },
      { x: -4.3, z: -1.2 },
      { x: 4.3, z: -1.2 },
    ],
    heroStart: { x: 0.0, z: -4.4 },
    barrels: [
      { id: 'barrel_1', x: -1.9, z: -2.4 },
      { id: 'barrel_2', x: 1.9, z: -2.4 },
    ],
    waves: [
      { waveNumber: 1, clearBonus: 100, groups: [{ enemyId: 'ember_bomber', count: 26, spacing: 0.38, hpOverride: 150, bountyOverride: 9 }, { enemyId: 'turbo_hopper', count: 20, spacing: 0.42, hpOverride: 105, bountyOverride: 8 }] },
      { waveNumber: 2, clearBonus: 114, groups: [{ enemyId: 'frost_warden', count: 14, spacing: 0.8, hpOverride: 320, bountyOverride: 16 }, { enemyId: 'tesla_strider', count: 9, spacing: 0.88, hpOverride: 270, bountyOverride: 14 }] },
      { waveNumber: 3, clearBonus: 128, groups: [{ enemyId: 'swarm_saw', count: 48, spacing: 0.14, hpOverride: 55, bountyOverride: 4 }, { enemyId: 'chomp_brute', count: 16, spacing: 0.65, hpOverride: 340, bountyOverride: 16 }] },
      { waveNumber: 4, clearBonus: 144, groups: [{ enemyId: 'crystal_golem', count: 11, spacing: 0.95, hpOverride: 530, bountyOverride: 22 }, { enemyId: 'tesla_strider', count: 12, spacing: 0.78, hpOverride: 285, bountyOverride: 14 }] },
      { waveNumber: 5, clearBonus: 162, groups: [{ enemyId: 'ember_bomber', count: 38, spacing: 0.25, hpOverride: 175, bountyOverride: 9 }, { enemyId: 'frost_warden', count: 14, spacing: 0.72, hpOverride: 300, bountyOverride: 16 }] },
      { waveNumber: 6, clearBonus: 184, groups: [{ enemyId: 'hover_drone', count: 34, spacing: 0.24, hpOverride: 145, bountyOverride: 9 }, { enemyId: 'repair_drone', count: 16, spacing: 0.48, hpOverride: 200, bountyOverride: 10 }, { enemyId: 'tesla_strider', count: 15, spacing: 0.68, hpOverride: 295, bountyOverride: 14 }] },
      { waveNumber: 7, clearBonus: 210, groups: [{ enemyId: 'crystal_golem', count: 14, spacing: 0.85, hpOverride: 560, bountyOverride: 22 }, { enemyId: 'ember_bomber', count: 36, spacing: 0.25, hpOverride: 185, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 242, groups: [{ enemyId: 'frost_warden', count: 20, spacing: 0.6, hpOverride: 360, bountyOverride: 16 }, { enemyId: 'tesla_strider', count: 22, spacing: 0.54, hpOverride: 340, bountyOverride: 14 }, { enemyId: 'swarm_saw', count: 34, spacing: 0.14, hpOverride: 62, bountyOverride: 4 }] },
      { waveNumber: 9, clearBonus: 280, groups: [{ enemyId: 'chomp_brute', count: 20, spacing: 0.56, hpOverride: 375, bountyOverride: 16 }, { enemyId: 'crystal_golem', count: 14, spacing: 0.8, hpOverride: 590, bountyOverride: 22 }, { enemyId: 'ember_bomber', count: 18, spacing: 0.26, hpOverride: 205, bountyOverride: 9 }] },
      { waveNumber: 10, clearBonus: 318, groups: [{ enemyId: 'ember_bomber', count: 44, spacing: 0.22, hpOverride: 205, bountyOverride: 9 }, { enemyId: 'tesla_strider', count: 26, spacing: 0.48, hpOverride: 360, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 18, spacing: 0.44, hpOverride: 210, bountyOverride: 10 }] },
      { waveNumber: 11, clearBonus: 365, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'frost_warden', count: 22, spacing: 0.56, hpOverride: 400, bountyOverride: 16 }, { enemyId: 'crystal_golem', count: 15, spacing: 0.78, hpOverride: 600, bountyOverride: 22 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 7500, bountyOverride: 160 }] },
      { waveNumber: 12, clearBonus: 495, announceEnemy: 'magma_overlord', groups: [{ enemyId: 'crystal_golem', count: 14, spacing: 0.8, hpOverride: 620, bountyOverride: 22 }, { enemyId: 'tesla_strider', count: 26, spacing: 0.48, hpOverride: 370, bountyOverride: 14 }, { enemyId: 'ember_bomber', count: 28, spacing: 0.24, hpOverride: 215, bountyOverride: 9 }, { enemyId: 'magma_overlord', count: 1, spacing: 1.5, hpOverride: 5200, bountyOverride: 195 }] },
    ],
  },
];

function cloneGeometryMirrored(
  tpl: LevelSpec,
  mirrorX: boolean,
  extraRunes: string[] = [],
): Pick<LevelSpec, 'path' | 'secondaryPath' | 'slots' | 'lanterns' | 'heroStart' | 'barrels' | 'iceZones'> {
  const fx = (x: number) => (mirrorX ? (x === 0 ? 0 : -x) : x);
  const flipVec = (v: Vec2): Vec2 => ({ x: fx(v.x), z: v.z });
  return {
    path: tpl.path.map(flipVec),
    secondaryPath: tpl.secondaryPath?.map(flipVec),
    slots: tpl.slots.map((s) => ({
      ...s,
      x: fx(s.x),
      runeSlot: Boolean(s.runeSlot || extraRunes.includes(s.id)),
      stumpClearCost: s.stumpClearCost ? s.stumpClearCost + 5 : undefined,
    })),
    lanterns: tpl.lanterns.map(flipVec),
    heroStart: flipVec(tpl.heroStart),
    barrels: tpl.barrels?.map((b) => ({ ...b, x: fx(b.x) })),
    iceZones: tpl.iceZones?.map((iz) => ({ ...iz, x: fx(iz.x) })),
  };
}

function buildScaledWaves(
  baseWaves: WaveSpec[],
  hpMult: number,
  bonusMult: number,
  enemySwaps: Partial<Record<EnemyId, EnemyId>> = {},
): WaveSpec[] {
  return baseWaves.map((w) => ({
    waveNumber: w.waveNumber,
    clearBonus: Math.round(w.clearBonus * bonusMult),
    announceEnemy: w.announceEnemy ? (enemySwaps[w.announceEnemy] ?? w.announceEnemy) : undefined,
    groups: w.groups.map((g) => ({
      ...g,
      enemyId: enemySwaps[g.enemyId] ?? g.enemyId,
      hpOverride: g.hpOverride !== undefined ? Math.round(g.hpOverride * hpMult) : undefined,
      bountyOverride:
        g.bountyOverride !== undefined ? Math.round(g.bountyOverride * 1.12) : undefined,
    })),
  }));
}

function createExtendedLevels(base: LevelSpec[]): LevelSpec[] {
  const byId = (id: number) => base.find((l) => l.id === id) ?? base[base.length - 1];
  const waveTpl = byId(16).waves;

  const defs: Array<{
    id: number;
    biome: LevelSpec['biome'];
    regionKey: string;
    concept: StageConceptId;
    tplId: number;
    mirrorX: boolean;
    extraRunes: string[];
    isBossStage?: boolean;
    mapPin: { xPct: number; yPct: number };
    startGold: number;
    killZoneMeters: number;
    hpMult: number;
    bonusMult: number;
    addBarrels?: Array<{ id: string; x: number; z: number }>;
    swaps?: Partial<Record<EnemyId, EnemyId>>;
  }> = [
    // BÖLÜM VI — ALACAKARANLIK BATAKLIĞI (17–20)
    {
      id: 17,
      biome: 'forest',
      regionKey: 'map.region.shadowfen',
      concept: 'shadowfen_lantern_bog',
      tplId: 13,
      mirrorX: true,
      extraRunes: ['slot_2'],
      mapPin: { xPct: 72, yPct: 40 },
      startGold: 700,
      killZoneMeters: 19.5,
      hpMult: 1.08,
      bonusMult: 1.22,
      swaps: { turbo_hopper: 'chomp_brute' },
    },
    {
      id: 18,
      biome: 'canyon',
      regionKey: 'map.region.shadowfen',
      concept: 'sunken_totem_ruins',
      tplId: 14,
      mirrorX: true,
      extraRunes: ['slot_2', 'slot_4'],
      mapPin: { xPct: 76, yPct: 40 },
      startGold: 730,
      killZoneMeters: 19.8,
      hpMult: 1.15,
      bonusMult: 1.3,
      addBarrels: [
        { id: 'barrel_1', x: -1.24, z: 1.72 },
        { id: 'barrel_2', x: 1.24, z: 1.72 },
      ],
      swaps: { hover_drone: 'repair_drone' },
    },
    {
      id: 19,
      biome: 'cavern',
      regionKey: 'map.region.shadowfen',
      concept: 'venom_alchemist_marsh',
      tplId: 15,
      mirrorX: true,
      extraRunes: ['slot_2', 'slot_4'],
      mapPin: { xPct: 80, yPct: 40 },
      startGold: 760,
      killZoneMeters: 20.0,
      hpMult: 1.22,
      bonusMult: 1.38,
      swaps: { swarm_saw: 'turbo_hopper' },
    },
    {
      id: 20,
      biome: 'forest',
      regionKey: 'map.region.shadowfen',
      concept: 'eclipse_oak_bastion',
      tplId: 12,
      mirrorX: true,
      extraRunes: ['slot_2', 'slot_3'],
      isBossStage: true,
      mapPin: { xPct: 84, yPct: 40 },
      startGold: 800,
      killZoneMeters: 20.5,
      hpMult: 1.3,
      bonusMult: 1.47,
      swaps: { cryo_colossus: 'magma_overlord' },
    },
    // BÖLÜM VII — YILDIZ ÇEKİRDEĞİ HİSARI (21–24)
    {
      id: 21,
      biome: 'snow',
      regionKey: 'map.region.astral',
      concept: 'starfall_glacier_bridge',
      tplId: 10,
      mirrorX: true,
      extraRunes: ['slot_2', 'slot_4'],
      mapPin: { xPct: 87, yPct: 40 },
      startGold: 830,
      killZoneMeters: 20.8,
      hpMult: 1.38,
      bonusMult: 1.56,
    },
    {
      id: 22,
      biome: 'cavern',
      regionKey: 'map.region.astral',
      concept: 'chrono_prism_vault',
      tplId: 9,
      mirrorX: true,
      extraRunes: ['slot_4', 'slot_5'],
      mapPin: { xPct: 90, yPct: 40 },
      startGold: 860,
      killZoneMeters: 21.0,
      hpMult: 1.47,
      bonusMult: 1.66,
      swaps: { hover_drone: 'repair_drone' },
    },
    {
      id: 23,
      biome: 'foundry',
      regionKey: 'map.region.astral',
      concept: 'solar_plasma_reactor',
      tplId: 13,
      mirrorX: false,
      extraRunes: ['slot_1', 'slot_4'],
      mapPin: { xPct: 93, yPct: 40 },
      startGold: 900,
      killZoneMeters: 21.2,
      hpMult: 1.56,
      bonusMult: 1.77,
    },
    {
      id: 24,
      biome: 'foundry',
      regionKey: 'map.region.astral',
      concept: 'astral_nexus_throne',
      tplId: 16,
      mirrorX: false,
      extraRunes: ['slot_1', 'slot_2', 'slot_3'],
      isBossStage: true,
      mapPin: { xPct: 96, yPct: 40 },
      startGold: 950,
      killZoneMeters: 21.5,
      hpMult: 1.66,
      bonusMult: 1.9,
    },
  ];

  return defs.map((d) => {
    const geom = cloneGeometryMirrored(byId(d.tplId), d.mirrorX, d.extraRunes);
    return {
      id: d.id,
      biome: d.biome,
      regionKey: d.regionKey,
      concept: d.concept,
      nameKey: `level.${d.id}.name`,
      unlocked: false,
      ...(d.isBossStage ? { isBossStage: true } : {}),
      mapPin: d.mapPin,
      startGold: d.startGold,
      baseHp: 150,
      killZoneMeters: d.killZoneMeters,
      ...geom,
      ...(d.addBarrels ? { barrels: d.addBarrels } : {}),
      waves: buildScaledWaves(waveTpl, d.hpMult, d.bonusMult, d.swaps),
    };
  });
}

export const LEVELS: LevelSpec[] = [...BASE_LEVELS, ...createExtendedLevels(BASE_LEVELS)];

export function isLevelUnlocked(levelId: number, levelStars: Record<number, number>): boolean {
  if (levelId <= 10) return true;
  return (levelStars[levelId - 1] ?? 0) > 0;
}

export interface WorldMapPreviewNode {
  id: number;
  biome: 'forest' | 'canyon' | 'cavern' | 'snow' | 'foundry';
  concept: StageConceptId;
  nameKey: string;
  xPct: number;
  yPct: number;
  unlocked: boolean;
  isBossStage: boolean;
}

export const WORLD_MAP_NODES: WorldMapPreviewNode[] = LEVELS.map((lvl) => ({
  id: lvl.id,
  biome: lvl.biome,
  concept: lvl.concept,
  nameKey: lvl.nameKey,
  xPct: lvl.mapPin.xPct,
  yPct: lvl.mapPin.yPct,
  unlocked: lvl.id <= 10,
  isBossStage: Boolean(lvl.isBossStage),
}));

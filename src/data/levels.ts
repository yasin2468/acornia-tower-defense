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

export interface LevelSpec {
  id: number;
  biome: 'forest' | 'canyon' | 'cavern' | 'snow';
  nameKey: string;
  unlocked: boolean;
  isBossStage?: boolean;
  mapPin: { xPct: number; yPct: number };
  startGold: number;
  baseHp: number;
  killZoneMeters: number;
  path: Vec2[];
  slots: SlotSpec[];
  lanterns: Vec2[];
  heroStart: Vec2;
  waves: WaveSpec[];
}

export const LEVELS: LevelSpec[] = [
  {
    id: 1,
    biome: 'forest',
    nameKey: 'level.1.name',
    unlocked: true,
    mapPin: { xPct: 48, yPct: 91 },
    startGold: 150,
    baseHp: 150,
    killZoneMeters: 14.0,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.4 },
      { x: -3.2, z: 6.2 },
      { x: -3.4, z: 2.6 },
      { x: 3.1, z: 1.6 },
      { x: 3.2, z: -2.2 },
      { x: -2.8, z: -3.2 },
      { x: -2.6, z: -6.2 },
      { x: 0.0, z: -7.5 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.6, z: 4.5 },
      { id: 'slot_2', x: 1.7, z: 3.9 },
      { id: 'slot_3', x: -1.35, z: -0.2 },
      { id: 'slot_4', x: 1.35, z: -0.1 },
      { id: 'slot_5', x: -0.45, z: -1.65 },
      { id: 'slot_6', x: 1.5, z: -4.6 },
      { id: 'slot_7', x: -4.4, z: -0.6, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: -1.8, z: 7.8 },
      { x: 4.1, z: 0.1 },
      { x: -4.0, z: -4.6 },
      { x: 2.2, z: -7.8 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
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
    nameKey: 'level.2.name',
    unlocked: true,
    mapPin: { xPct: 73, yPct: 83 },
    startGold: 160,
    baseHp: 150,
    killZoneMeters: 14.5,
    path: [
      { x: -2.5, z: 9.8 },
      { x: -2.5, z: 6.8 },
      { x: 2.8, z: 5.8 },
      { x: 3.2, z: 2.2 },
      { x: -3.2, z: 1.2 },
      { x: -3.4, z: -2.6 },
      { x: 2.6, z: -3.6 },
      { x: 2.4, z: -6.4 },
      { x: 0.0, z: -7.6 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: 0.3, z: 4.3 },
      { id: 'slot_2', x: -1.6, z: 3.4 },
      { id: 'slot_3', x: 1.3, z: 0.2 },
      { id: 'slot_4', x: -1.3, z: -0.9 },
      { id: 'slot_5', x: 0.4, z: -4.9 },
      { id: 'slot_6', x: -1.9, z: -5.4 },
      { id: 'slot_7', x: 4.4, z: -1.2, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: -4.0, z: 6.8 },
      { x: 4.2, z: 3.9 },
      { x: -4.3, z: -1.5 },
      { x: 3.4, z: -7.1 },
    ],
    heroStart: { x: 0.0, z: -5.0 },
    waves: [
      {
        waveNumber: 1,
        clearBonus: 19,
        groups: [{ enemyId: 'scout_bot', count: 14, spacing: 0.9, hpOverride: 62, speedOverride: 2.35, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 19,
        groups: [
          { enemyId: 'swarm_saw', count: 19, spacing: 0.34, hpOverride: 32, speedOverride: 3.15, bountyOverride: 3 },
          { enemyId: 'scout_bot', count: 9, spacing: 0.85, hpOverride: 45, speedOverride: 2.4, bountyOverride: 5 },
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
          { enemyId: 'hover_drone', count: 13, spacing: 0.65, hpOverride: 73, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'scout_bot', count: 9, spacing: 0.75, hpOverride: 49, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 28,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 178, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'swarm_saw', count: 17, spacing: 0.28, hpOverride: 33, speedOverride: 3.2, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 30,
        groups: [
          { enemyId: 'hover_drone', count: 12, spacing: 0.55, hpOverride: 75, speedOverride: 2.4, bountyOverride: 7 },
          { enemyId: 'shield_loader', count: 6, spacing: 1.1, hpOverride: 166, speedOverride: 1.42, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 35,
        groups: [
          { enemyId: 'swarm_saw', count: 25, spacing: 0.22, hpOverride: 37, speedOverride: 3.25, bountyOverride: 3 },
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
    nameKey: 'level.3.name',
    unlocked: true,
    isBossStage: true,
    mapPin: { xPct: 48, yPct: 74 },
    startGold: 170,
    baseHp: 150,
    killZoneMeters: 15.0,
    path: [
      { x: 2.6, z: 9.8 },
      { x: 2.6, z: 7.2 },
      { x: -3.1, z: 6.2 },
      { x: -3.2, z: 3.2 },
      { x: 0.2, z: 2.4 },
      { x: 3.2, z: 1.2 },
      { x: 3.2, z: -2.0 },
      { x: -2.9, z: -2.9 },
      { x: -2.8, z: -6.0 },
      { x: 0.0, z: -7.5 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.4, z: 4.7 },
      { id: 'slot_2', x: 1.9, z: 3.8 },
      { id: 'slot_3', x: -1.5, z: 1.0 },
      { id: 'slot_4', x: 1.2, z: -0.4 },
      { id: 'slot_5', x: -1.1, z: -4.2 },
      { id: 'slot_6', x: 1.7, z: -4.8 },
      { id: 'slot_7', x: -4.4, z: -0.4, lockedByStump: true, stumpClearCost: 40 },
      { id: 'slot_8', x: 4.4, z: -4.0, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: 3.8, z: 7.6 },
      { x: -4.1, z: 4.5 },
      { x: 4.2, z: -0.3 },
      { x: -3.9, z: -4.8 },
    ],
    heroStart: { x: 0.0, z: -5.2 },
    waves: [
      {
        waveNumber: 1,
        clearBonus: 22,
        groups: [{ enemyId: 'scout_bot', count: 16, spacing: 0.85, hpOverride: 64, speedOverride: 2.35, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 25,
        groups: [
          { enemyId: 'swarm_saw', count: 21, spacing: 0.3, hpOverride: 32, speedOverride: 3.2, bountyOverride: 3 },
          { enemyId: 'scout_bot', count: 9, spacing: 0.8, hpOverride: 58, speedOverride: 2.4, bountyOverride: 5 },
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
          { enemyId: 'hover_drone', count: 15, spacing: 0.6, hpOverride: 77, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'swarm_saw', count: 15, spacing: 0.3, hpOverride: 32, speedOverride: 3.2, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 32,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 181, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 10, spacing: 0.65, hpOverride: 83, speedOverride: 2.4, bountyOverride: 7 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 37,
        groups: [
          { enemyId: 'swarm_saw', count: 27, spacing: 0.24, hpOverride: 37, speedOverride: 3.25, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 7, spacing: 1.05, hpOverride: 178, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 40,
        groups: [
          { enemyId: 'hover_drone', count: 15, spacing: 0.5, hpOverride: 85, speedOverride: 2.42, bountyOverride: 7 },
          { enemyId: 'shield_loader', count: 8, spacing: 0.9, hpOverride: 169, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 47,
        groups: [
          { enemyId: 'swarm_saw', count: 29, spacing: 0.2, hpOverride: 42, speedOverride: 3.3, bountyOverride: 3 },
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
    nameKey: 'level.4.name',
    unlocked: true,
    mapPin: { xPct: 73, yPct: 65 },
    startGold: 180,
    baseHp: 150,
    killZoneMeters: 15.5,
    path: [
      { x: -2.6, z: 9.8 },
      { x: -2.6, z: 6.8 },
      { x: 3.1, z: 5.8 },
      { x: 3.2, z: 2.0 },
      { x: -3.2, z: 1.0 },
      { x: -3.2, z: -2.8 },
      { x: 2.8, z: -3.6 },
      { x: 2.6, z: -6.6 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.2, z: 4.1 },
      { id: 'slot_2', x: 1.6, z: 3.5 },
      { id: 'slot_3', x: -1.7, z: 3.0 },
      { id: 'slot_4', x: 0.1, z: -0.6 },
      { id: 'slot_5', x: 1.8, z: -1.5 },
      { id: 'slot_6', x: -0.6, z: -4.9 },
      { id: 'slot_7', x: -4.4, z: 3.8, lockedByStump: true, stumpClearCost: 40 },
    ],
    lanterns: [
      { x: -4.1, z: 7.4 },
      { x: 4.2, z: 3.9 },
      { x: -4.2, z: -1.2 },
      { x: 3.6, z: -7.1 },
    ],
    heroStart: { x: 0.0, z: -5.4 },
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
    nameKey: 'level.5.name',
    unlocked: false,
    mapPin: { xPct: 50, yPct: 56 },
    startGold: 205,
    baseHp: 150,
    killZoneMeters: 16.0,
    path: [
      { x: 2.8, z: 9.8 },
      { x: 2.8, z: 6.6 },
      { x: -3.2, z: 5.8 },
      { x: -3.2, z: 2.0 },
      { x: 3.1, z: 1.1 },
      { x: 3.1, z: -2.8 },
      { x: -2.8, z: -3.6 },
      { x: -2.6, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.4, z: 4.1 },
      { id: 'slot_2', x: 1.6, z: 3.8 },
      { id: 'slot_3', x: -1.4, z: 0.1 },
      { id: 'slot_4', x: 1.1, z: -0.8 },
      { id: 'slot_5', x: 0.0, z: -5.2 },
      { id: 'slot_6', x: 2.2, z: -5.4 },
      { id: 'slot_7', x: -4.6, z: 0.0, lockedByStump: true, stumpClearCost: 45 },
      { id: 'slot_8', x: 4.5, z: -4.4, lockedByStump: true, stumpClearCost: 45 },
    ],
    lanterns: [
      { x: 4.1, z: 7.4 },
      { x: -4.2, z: 3.9 },
      { x: 4.2, z: -1.1 },
      { x: -3.7, z: -7.0 },
    ],
    heroStart: { x: 0.0, z: -4.6 },
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
    nameKey: 'level.6.name',
    unlocked: false,
    isBossStage: true,
    mapPin: { xPct: 73, yPct: 47 },
    startGold: 245,
    baseHp: 150,
    killZoneMeters: 16.5,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.2 },
      { x: 3.3, z: 6.1 },
      { x: 3.3, z: 2.2 },
      { x: -3.2, z: 1.3 },
      { x: -3.2, z: -2.6 },
      { x: 3.0, z: -3.5 },
      { x: 2.8, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.8, z: 5.0 },
      { id: 'slot_2', x: 1.2, z: 4.1 },
      { id: 'slot_3', x: -0.6, z: -0.5 },
      { id: 'slot_4', x: 1.6, z: -1.1 },
      { id: 'slot_5', x: 0.0, z: -5.3 },
      { id: 'slot_6', x: -2.1, z: -5.6 },
      { id: 'slot_7', x: -4.5, z: 3.6, lockedByStump: true, stumpClearCost: 45 },
      { id: 'slot_8', x: 4.6, z: -0.6, lockedByStump: true, stumpClearCost: 45 },
    ],
    lanterns: [
      { x: -1.8, z: 7.9 },
      { x: 4.4, z: 4.1 },
      { x: -4.3, z: -0.7 },
      { x: 3.8, z: -6.9 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
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
    nameKey: 'level.7.name',
    unlocked: false,
    mapPin: { xPct: 48, yPct: 38 },
    startGold: 295,
    baseHp: 150,
    killZoneMeters: 16.5,
    path: [
      { x: -2.8, z: 9.8 },
      { x: -2.8, z: 6.7 },
      { x: 3.1, z: 5.9 },
      { x: 3.1, z: 2.1 },
      { x: -3.2, z: 1.1 },
      { x: -3.2, z: -2.7 },
      { x: 2.9, z: -3.6 },
      { x: 2.7, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.3, z: 4.1 },
      { id: 'slot_2', x: 1.5, z: 3.8 },
      { id: 'slot_3', x: -1.4, z: -0.6 },
      { id: 'slot_4', x: 0.4, z: -0.6 },
      { id: 'slot_5', x: 1.8, z: -1.8 },
      { id: 'slot_6', x: -0.4, z: -5.2 },
      { id: 'slot_7', x: -4.4, z: 3.6, lockedByStump: true, stumpClearCost: 45 },
      { id: 'slot_8', x: 4.5, z: -5.2, lockedByStump: true, stumpClearCost: 45 },
    ],
    lanterns: [
      { x: -4.1, z: 7.4 },
      { x: 4.2, z: 4.0 },
      { x: -4.3, z: -1.2 },
      { x: 3.6, z: -7.0 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
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
    nameKey: 'level.8.name',
    unlocked: false,
    mapPin: { xPct: 73, yPct: 30 },
    startGold: 320,
    baseHp: 150,
    killZoneMeters: 17.0,
    path: [
      { x: 2.7, z: 9.8 },
      { x: 2.7, z: 6.8 },
      { x: -3.2, z: 5.9 },
      { x: -3.2, z: 2.0 },
      { x: 3.1, z: 1.0 },
      { x: 3.1, z: -2.8 },
      { x: -2.9, z: -3.6 },
      { x: -2.7, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.2, z: 4.1 },
      { id: 'slot_2', x: 1.7, z: 3.6 },
      { id: 'slot_3', x: -1.4, z: -0.2 },
      { id: 'slot_4', x: 1.2, z: -0.9 },
      { id: 'slot_5', x: 0.0, z: -5.3 },
      { id: 'slot_6', x: 2.1, z: -5.4 },
      { id: 'slot_7', x: -4.6, z: 0.0, lockedByStump: true, stumpClearCost: 50 },
      { id: 'slot_8', x: 4.5, z: 3.6, lockedByStump: true, stumpClearCost: 50 },
    ],
    lanterns: [
      { x: 4.0, z: 7.4 },
      { x: -4.2, z: 3.9 },
      { x: 4.2, z: -1.1 },
      { x: -3.7, z: -7.0 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
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
    nameKey: 'level.9.name',
    unlocked: false,
    isBossStage: true,
    mapPin: { xPct: 48, yPct: 22 },
    startGold: 365,
    baseHp: 150,
    killZoneMeters: 17.5,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.2 },
      { x: -3.2, z: 6.1 },
      { x: -3.2, z: 2.2 },
      { x: 3.1, z: 1.3 },
      { x: 3.1, z: -2.6 },
      { x: -2.9, z: -3.5 },
      { x: -2.7, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.4, z: 4.1 },
      { id: 'slot_2', x: 1.6, z: 4.5 },
      { id: 'slot_3', x: -0.6, z: -0.4 },
      { id: 'slot_4', x: 1.5, z: -0.9 },
      { id: 'slot_5', x: 0.0, z: -5.2 },
      { id: 'slot_6', x: 2.2, z: -5.4 },
      { id: 'slot_7', x: -4.6, z: -0.5, lockedByStump: true, stumpClearCost: 50 },
      { id: 'slot_8', x: 4.5, z: 3.4, lockedByStump: true, stumpClearCost: 50 },
    ],
    lanterns: [
      { x: 2.0, z: 8.0 },
      { x: -4.2, z: 4.1 },
      { x: 4.2, z: -0.8 },
      { x: -3.7, z: -7.0 },
    ],
    heroStart: { x: 0.0, z: -4.7 },
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
    nameKey: 'level.10.name',
    unlocked: false,
    mapPin: { xPct: 72, yPct: 16 },
    startGold: 410,
    baseHp: 150,
    killZoneMeters: 17.5,
    path: [
      { x: -2.7, z: 9.8 },
      { x: -2.7, z: 6.6 },
      { x: 3.1, z: 5.8 },
      { x: 3.1, z: 2.0 },
      { x: -3.2, z: 1.0 },
      { x: -3.2, z: -2.8 },
      { x: 2.9, z: -3.7 },
      { x: 2.6, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.3, z: 4.1 },
      { id: 'slot_2', x: 1.5, z: 3.7 },
      { id: 'slot_3', x: -1.4, z: -0.6 },
      { id: 'slot_4', x: 0.4, z: -0.6 },
      { id: 'slot_5', x: 1.8, z: -1.8 },
      { id: 'slot_6', x: -0.5, z: -5.2 },
      { id: 'slot_7', x: -4.4, z: 3.6, lockedByStump: true, stumpClearCost: 50 },
      { id: 'slot_8', x: 4.7, z: 3.8, lockedByStump: true, stumpClearCost: 50 },
    ],
    lanterns: [
      { x: -4.0, z: 7.4 },
      { x: 4.2, z: 3.9 },
      { x: -4.3, z: -1.2 },
      { x: 3.7, z: -7.0 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
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
    nameKey: 'level.11.name',
    unlocked: false,
    mapPin: { xPct: 33, yPct: 15 },
    startGold: 455,
    baseHp: 150,
    killZoneMeters: 18.0,
    path: [
      { x: 2.6, z: 9.8 },
      { x: 2.6, z: 6.7 },
      { x: -3.2, z: 5.8 },
      { x: -3.2, z: 2.0 },
      { x: 3.1, z: 1.0 },
      { x: 3.1, z: -2.8 },
      { x: -2.8, z: -3.6 },
      { x: -2.6, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -0.2, z: 4.1 },
      { id: 'slot_2', x: 1.7, z: 3.6 },
      { id: 'slot_3', x: -1.4, z: -0.2 },
      { id: 'slot_4', x: 1.2, z: -0.9 },
      { id: 'slot_5', x: 0.0, z: -5.3 },
      { id: 'slot_6', x: 2.1, z: -5.4 },
      { id: 'slot_7', x: -4.6, z: 0.0, lockedByStump: true, stumpClearCost: 55 },
      { id: 'slot_8', x: 4.5, z: -4.5, lockedByStump: true, stumpClearCost: 55 },
    ],
    lanterns: [
      { x: 4.0, z: 7.4 },
      { x: -4.2, z: 3.9 },
      { x: 4.2, z: -1.1 },
      { x: -3.7, z: -7.0 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
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
    nameKey: 'level.12.name',
    unlocked: false,
    isBossStage: true,
    mapPin: { xPct: 51, yPct: 6.8 },
    startGold: 520,
    baseHp: 150,
    killZoneMeters: 18.5,
    path: [
      { x: 0.0, z: 9.8 },
      { x: 0.0, z: 7.2 },
      { x: 3.3, z: 6.1 },
      { x: 3.3, z: 2.2 },
      { x: -3.2, z: 1.3 },
      { x: -3.2, z: -2.6 },
      { x: 3.0, z: -3.5 },
      { x: 2.8, z: -6.5 },
      { x: 0.0, z: -7.8 },
      { x: 0.0, z: -9.0 },
    ],
    slots: [
      { id: 'slot_1', x: -1.8, z: 5.0 },
      { id: 'slot_2', x: 1.2, z: 4.1 },
      { id: 'slot_3', x: -0.6, z: -0.5 },
      { id: 'slot_4', x: 1.6, z: -1.1 },
      { id: 'slot_5', x: 0.0, z: -5.3 },
      { id: 'slot_6', x: -2.1, z: -5.6 },
      { id: 'slot_7', x: -4.5, z: 3.6, lockedByStump: true, stumpClearCost: 55 },
      { id: 'slot_8', x: 4.6, z: -0.6, lockedByStump: true, stumpClearCost: 55 },
    ],
    lanterns: [
      { x: -1.8, z: 7.9 },
      { x: 4.4, z: 4.1 },
      { x: -4.3, z: -0.7 },
      { x: 3.8, z: -6.9 },
    ],
    heroStart: { x: 0.0, z: -4.8 },
    waves: [
      { waveNumber: 1, clearBonus: 42, groups: [{ enemyId: 'scout_bot', count: 16, spacing: 0.62, hpOverride: 69, bountyOverride: 6 }, { enemyId: 'turbo_hopper', count: 16, spacing: 0.56, hpOverride: 97, bountyOverride: 8 }] },
      { waveNumber: 2, clearBonus: 47, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 1.05, hpOverride: 224, bountyOverride: 16 }, { enemyId: 'swarm_saw', count: 27, spacing: 0.2, hpOverride: 46, bountyOverride: 4 }] },
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
];

export function isLevelUnlocked(levelId: number, levelStars: Record<number, number>): boolean {
  if (levelId <= 4) return true;
  return (levelStars[levelId - 1] ?? 0) > 0;
}

export interface WorldMapPreviewNode {
  id: number;
  biome: 'forest' | 'canyon' | 'cavern' | 'snow';
  nameKey: string;
  xPct: number;
  yPct: number;
  unlocked: boolean;
  isBossStage: boolean;
}

export const WORLD_MAP_NODES: WorldMapPreviewNode[] = LEVELS.map((lvl) => ({
  id: lvl.id,
  biome: lvl.biome,
  nameKey: lvl.nameKey,
  xPct: lvl.mapPin.xPct,
  yPct: lvl.mapPin.yPct,
  unlocked: lvl.id <= 4,
  isBossStage: Boolean(lvl.isBossStage),
}));

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
        groups: [{ enemyId: 'scout_bot', count: 9, spacing: 0.95, hpOverride: 42, speedOverride: 2.3, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 15,
        announceEnemy: 'swarm_saw',
        groups: [
          { enemyId: 'scout_bot', count: 8, spacing: 0.85, hpOverride: 44, speedOverride: 2.3, bountyOverride: 5 },
          { enemyId: 'swarm_saw', count: 12, spacing: 0.35, hpOverride: 24, speedOverride: 3.1, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 3,
        clearBonus: 20,
        announceEnemy: 'shield_loader',
        groups: [{ enemyId: 'shield_loader', count: 5, spacing: 1.6, hpOverride: 135, speedOverride: 1.35, bountyOverride: 11 }],
      },
      {
        waveNumber: 4,
        clearBonus: 20,
        announceEnemy: 'hover_drone',
        groups: [
          { enemyId: 'hover_drone', count: 10, spacing: 0.7, hpOverride: 65, speedOverride: 2.3, bountyOverride: 6 },
          { enemyId: 'swarm_saw', count: 12, spacing: 0.32, hpOverride: 26, speedOverride: 3.1, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 25,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.3, hpOverride: 135, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 7, spacing: 0.75, hpOverride: 65, speedOverride: 2.3, bountyOverride: 6 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 25,
        groups: [
          { enemyId: 'swarm_saw', count: 20, spacing: 0.26, hpOverride: 34, speedOverride: 3.2, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 6, spacing: 1.05, hpOverride: 150, speedOverride: 1.4, bountyOverride: 11 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 50,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'shield_loader', count: 7, spacing: 0.9, hpOverride: 165, speedOverride: 1.4, bountyOverride: 11 },
          { enemyId: 'hover_drone', count: 10, spacing: 0.5, hpOverride: 75, speedOverride: 2.35, bountyOverride: 6 },
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
        clearBonus: 18,
        groups: [{ enemyId: 'scout_bot', count: 10, spacing: 0.9, hpOverride: 44, speedOverride: 2.35, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 18,
        groups: [
          { enemyId: 'swarm_saw', count: 16, spacing: 0.34, hpOverride: 26, speedOverride: 3.15, bountyOverride: 3 },
          { enemyId: 'scout_bot', count: 6, spacing: 0.85, hpOverride: 46, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 3,
        clearBonus: 22,
        groups: [
          { enemyId: 'shield_loader', count: 5, spacing: 1.5, hpOverride: 145, speedOverride: 1.38, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 4,
        clearBonus: 22,
        groups: [
          { enemyId: 'hover_drone', count: 12, spacing: 0.65, hpOverride: 70, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'scout_bot', count: 8, spacing: 0.75, hpOverride: 48, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 26,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 155, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'swarm_saw', count: 16, spacing: 0.28, hpOverride: 30, speedOverride: 3.2, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 28,
        groups: [
          { enemyId: 'hover_drone', count: 12, spacing: 0.55, hpOverride: 75, speedOverride: 2.4, bountyOverride: 7 },
          { enemyId: 'shield_loader', count: 6, spacing: 1.1, hpOverride: 165, speedOverride: 1.42, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 32,
        groups: [
          { enemyId: 'swarm_saw', count: 26, spacing: 0.22, hpOverride: 38, speedOverride: 3.25, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 8, spacing: 0.9, hpOverride: 175, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 60,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'shield_loader', count: 8, spacing: 0.85, hpOverride: 185, speedOverride: 1.42, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 12, spacing: 0.45, hpOverride: 85, speedOverride: 2.4, bountyOverride: 7 },
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
        clearBonus: 18,
        groups: [{ enemyId: 'scout_bot', count: 11, spacing: 0.85, hpOverride: 45, speedOverride: 2.35, bountyOverride: 5 }],
      },
      {
        waveNumber: 2,
        clearBonus: 20,
        groups: [
          { enemyId: 'swarm_saw', count: 18, spacing: 0.3, hpOverride: 28, speedOverride: 3.2, bountyOverride: 3 },
          { enemyId: 'scout_bot', count: 8, spacing: 0.8, hpOverride: 48, speedOverride: 2.4, bountyOverride: 5 },
        ],
      },
      {
        waveNumber: 3,
        clearBonus: 22,
        groups: [
          { enemyId: 'shield_loader', count: 5, spacing: 1.5, hpOverride: 150, speedOverride: 1.38, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 4,
        clearBonus: 24,
        groups: [
          { enemyId: 'hover_drone', count: 14, spacing: 0.6, hpOverride: 72, speedOverride: 2.35, bountyOverride: 6 },
          { enemyId: 'swarm_saw', count: 14, spacing: 0.3, hpOverride: 30, speedOverride: 3.2, bountyOverride: 3 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 26,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 165, speedOverride: 1.4, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 10, spacing: 0.65, hpOverride: 76, speedOverride: 2.4, bountyOverride: 7 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 30,
        groups: [
          { enemyId: 'swarm_saw', count: 26, spacing: 0.24, hpOverride: 36, speedOverride: 3.25, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 7, spacing: 1.05, hpOverride: 170, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 32,
        groups: [
          { enemyId: 'hover_drone', count: 16, spacing: 0.5, hpOverride: 88, speedOverride: 2.42, bountyOverride: 7 },
          { enemyId: 'shield_loader', count: 8, spacing: 0.9, hpOverride: 185, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 38,
        groups: [
          { enemyId: 'swarm_saw', count: 30, spacing: 0.2, hpOverride: 42, speedOverride: 3.3, bountyOverride: 3 },
          { enemyId: 'shield_loader', count: 10, spacing: 0.85, hpOverride: 195, speedOverride: 1.45, bountyOverride: 12 },
        ],
      },
      {
        waveNumber: 9,
        clearBonus: 70,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'shield_loader', count: 10, spacing: 0.8, hpOverride: 205, speedOverride: 1.45, bountyOverride: 12 },
          { enemyId: 'hover_drone', count: 14, spacing: 0.45, hpOverride: 92, speedOverride: 2.45, bountyOverride: 7 },
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
      { waveNumber: 1, clearBonus: 20, groups: [{ enemyId: 'scout_bot', count: 12, spacing: 0.85, hpOverride: 48 }] },
      {
        waveNumber: 2,
        clearBonus: 24,
        announceEnemy: 'turbo_hopper',
        groups: [{ enemyId: 'turbo_hopper', count: 8, spacing: 0.9, hpOverride: 58 }],
      },
      {
        waveNumber: 3,
        clearBonus: 24,
        groups: [
          { enemyId: 'swarm_saw', count: 18, spacing: 0.28, hpOverride: 30 },
          { enemyId: 'turbo_hopper', count: 8, spacing: 0.75, hpOverride: 62 },
        ],
      },
      {
        waveNumber: 4,
        clearBonus: 26,
        groups: [
          { enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 160 },
          { enemyId: 'hover_drone', count: 10, spacing: 0.65, hpOverride: 76 },
        ],
      },
      {
        waveNumber: 5,
        clearBonus: 30,
        groups: [
          { enemyId: 'turbo_hopper', count: 14, spacing: 0.55, hpOverride: 68 },
          { enemyId: 'shield_loader', count: 6, spacing: 1.15, hpOverride: 175 },
        ],
      },
      {
        waveNumber: 6,
        clearBonus: 34,
        groups: [
          { enemyId: 'swarm_saw', count: 24, spacing: 0.24, hpOverride: 34 },
          { enemyId: 'hover_drone', count: 14, spacing: 0.52, hpOverride: 82 },
        ],
      },
      {
        waveNumber: 7,
        clearBonus: 40,
        groups: [
          { enemyId: 'shield_loader', count: 9, spacing: 0.95, hpOverride: 190 },
          { enemyId: 'turbo_hopper', count: 16, spacing: 0.48, hpOverride: 74 },
        ],
      },
      {
        waveNumber: 8,
        clearBonus: 70,
        announceEnemy: 'mega_harvester',
        groups: [
          { enemyId: 'turbo_hopper', count: 12, spacing: 0.5, hpOverride: 78 },
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
      { waveNumber: 1, clearBonus: 20, groups: [{ enemyId: 'turbo_hopper', count: 10, spacing: 1.0, hpOverride: 54, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 22, groups: [{ enemyId: 'swarm_saw', count: 16, spacing: 0.34, hpOverride: 28, bountyOverride: 3 }, { enemyId: 'hover_drone', count: 7, spacing: 0.78, hpOverride: 68, bountyOverride: 7 }] },
      { waveNumber: 3, clearBonus: 25, announceEnemy: 'chomp_brute', groups: [{ enemyId: 'chomp_brute', count: 4, spacing: 1.75, hpOverride: 155, bountyOverride: 14 }] },
      { waveNumber: 4, clearBonus: 28, groups: [{ enemyId: 'chomp_brute', count: 5, spacing: 1.45, hpOverride: 165, bountyOverride: 14 }, { enemyId: 'turbo_hopper', count: 10, spacing: 0.65, hpOverride: 64, bountyOverride: 6 }] },
      { waveNumber: 5, clearBonus: 30, groups: [{ enemyId: 'shield_loader', count: 6, spacing: 1.25, hpOverride: 155, bountyOverride: 12 }, { enemyId: 'hover_drone', count: 12, spacing: 0.55, hpOverride: 78, bountyOverride: 7 }] },
      { waveNumber: 6, clearBonus: 32, groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.1, hpOverride: 190, bountyOverride: 14 }, { enemyId: 'swarm_saw', count: 24, spacing: 0.24, hpOverride: 36, bountyOverride: 3 }] },
      { waveNumber: 7, clearBonus: 35, groups: [{ enemyId: 'turbo_hopper', count: 18, spacing: 0.45, hpOverride: 78, bountyOverride: 6 }, { enemyId: 'shield_loader', count: 8, spacing: 0.95, hpOverride: 185, bountyOverride: 12 }] },
      { waveNumber: 8, clearBonus: 38, groups: [{ enemyId: 'chomp_brute', count: 9, spacing: 0.95, hpOverride: 215, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 16, spacing: 0.44, hpOverride: 96, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 70, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.0, hpOverride: 225, bountyOverride: 14 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.3, hpOverride: 1950, bountyOverride: 70 }] },
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
      { waveNumber: 1, clearBonus: 22, groups: [{ enemyId: 'scout_bot', count: 10, spacing: 0.85, hpOverride: 50, bountyOverride: 5 }, { enemyId: 'turbo_hopper', count: 6, spacing: 0.85, hpOverride: 58, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 24, groups: [{ enemyId: 'chomp_brute', count: 4, spacing: 1.65, hpOverride: 165, bountyOverride: 14 }, { enemyId: 'swarm_saw', count: 14, spacing: 0.34, hpOverride: 30, bountyOverride: 3 }] },
      { waveNumber: 3, clearBonus: 28, groups: [{ enemyId: 'hover_drone', count: 12, spacing: 0.65, hpOverride: 78, bountyOverride: 7 }, { enemyId: 'shield_loader', count: 5, spacing: 1.4, hpOverride: 165, bountyOverride: 12 }] },
      { waveNumber: 4, clearBonus: 30, groups: [{ enemyId: 'turbo_hopper', count: 16, spacing: 0.52, hpOverride: 70, bountyOverride: 6 }, { enemyId: 'chomp_brute', count: 6, spacing: 1.25, hpOverride: 185, bountyOverride: 14 }] },
      { waveNumber: 5, clearBonus: 32, groups: [{ enemyId: 'shield_loader', count: 8, spacing: 1.05, hpOverride: 185, bountyOverride: 12 }, { enemyId: 'hover_drone', count: 14, spacing: 0.5, hpOverride: 88, bountyOverride: 7 }] },
      { waveNumber: 6, clearBonus: 36, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 1.0, hpOverride: 215, bountyOverride: 14 }, { enemyId: 'turbo_hopper', count: 16, spacing: 0.45, hpOverride: 80, bountyOverride: 6 }] },
      { waveNumber: 7, clearBonus: 40, groups: [{ enemyId: 'swarm_saw', count: 32, spacing: 0.19, hpOverride: 40, bountyOverride: 3 }, { enemyId: 'shield_loader', count: 9, spacing: 0.9, hpOverride: 210, bountyOverride: 12 }] },
      { waveNumber: 8, clearBonus: 44, groups: [{ enemyId: 'chomp_brute', count: 10, spacing: 0.85, hpOverride: 235, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 18, spacing: 0.42, hpOverride: 98, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 85, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'chomp_brute', count: 9, spacing: 0.9, hpOverride: 245, bountyOverride: 14 }, { enemyId: 'turbo_hopper', count: 16, spacing: 0.45, hpOverride: 88, bountyOverride: 6 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.4, hpOverride: 2250, bountyOverride: 85 }] },
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
      { waveNumber: 1, clearBonus: 24, groups: [{ enemyId: 'turbo_hopper', count: 12, spacing: 0.85, hpOverride: 64, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 26, groups: [{ enemyId: 'shield_loader', count: 4, spacing: 1.65, hpOverride: 160, bountyOverride: 12 }, { enemyId: 'chomp_brute', count: 4, spacing: 1.8, hpOverride: 165, bountyOverride: 14 }] },
      { waveNumber: 3, clearBonus: 28, announceEnemy: 'repair_drone', groups: [{ enemyId: 'shield_loader', count: 5, spacing: 1.35, hpOverride: 175, bountyOverride: 12 }, { enemyId: 'repair_drone', count: 4, spacing: 1.05, hpOverride: 90, bountyOverride: 9 }] },
      { waveNumber: 4, clearBonus: 30, groups: [{ enemyId: 'hover_drone', count: 12, spacing: 0.58, hpOverride: 86, bountyOverride: 7 }, { enemyId: 'repair_drone', count: 5, spacing: 0.95, hpOverride: 96, bountyOverride: 9 }] },
      { waveNumber: 5, clearBonus: 32, groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.05, hpOverride: 210, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 6, spacing: 0.85, hpOverride: 102, bountyOverride: 9 }] },
      { waveNumber: 6, clearBonus: 36, groups: [{ enemyId: 'turbo_hopper', count: 22, spacing: 0.42, hpOverride: 82, bountyOverride: 6 }, { enemyId: 'shield_loader', count: 8, spacing: 0.92, hpOverride: 215, bountyOverride: 12 }] },
      { waveNumber: 7, clearBonus: 40, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.85, hpOverride: 230, bountyOverride: 12 }, { enemyId: 'repair_drone', count: 8, spacing: 0.7, hpOverride: 112, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 44, groups: [{ enemyId: 'chomp_brute', count: 11, spacing: 0.84, hpOverride: 245, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 18, spacing: 0.42, hpOverride: 102, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 85, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'repair_drone', count: 8, spacing: 0.72, hpOverride: 120, bountyOverride: 9 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.2, hpOverride: 2350, bountyOverride: 85 }] },
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
      { waveNumber: 1, clearBonus: 26, groups: [{ enemyId: 'swarm_saw', count: 20, spacing: 0.28, hpOverride: 36, bountyOverride: 4 }, { enemyId: 'turbo_hopper', count: 9, spacing: 0.72, hpOverride: 68, bountyOverride: 7 }] },
      { waveNumber: 2, clearBonus: 28, groups: [{ enemyId: 'chomp_brute', count: 5, spacing: 1.4, hpOverride: 195, bountyOverride: 15 }, { enemyId: 'repair_drone', count: 5, spacing: 0.95, hpOverride: 100, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 32, announceEnemy: 'crystal_golem', groups: [{ enemyId: 'crystal_golem', count: 3, spacing: 2.1, hpOverride: 285, bountyOverride: 20 }] },
      { waveNumber: 4, clearBonus: 34, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.8, hpOverride: 310, bountyOverride: 20 }, { enemyId: 'repair_drone', count: 5, spacing: 0.9, hpOverride: 108, bountyOverride: 10 }] },
      { waveNumber: 5, clearBonus: 36, groups: [{ enemyId: 'turbo_hopper', count: 20, spacing: 0.4, hpOverride: 84, bountyOverride: 7 }, { enemyId: 'hover_drone', count: 16, spacing: 0.45, hpOverride: 98, bountyOverride: 8 }] },
      { waveNumber: 6, clearBonus: 40, groups: [{ enemyId: 'crystal_golem', count: 6, spacing: 1.45, hpOverride: 345, bountyOverride: 20 }, { enemyId: 'chomp_brute', count: 8, spacing: 0.98, hpOverride: 230, bountyOverride: 15 }] },
      { waveNumber: 7, clearBonus: 44, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.88, hpOverride: 235, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 8, spacing: 0.7, hpOverride: 120, bountyOverride: 10 }] },
      { waveNumber: 8, clearBonus: 48, groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.3, hpOverride: 375, bountyOverride: 20 }, { enemyId: 'turbo_hopper', count: 20, spacing: 0.38, hpOverride: 94, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 52, groups: [{ enemyId: 'chomp_brute', count: 11, spacing: 0.82, hpOverride: 255, bountyOverride: 15 }, { enemyId: 'repair_drone', count: 9, spacing: 0.65, hpOverride: 126, bountyOverride: 10 }] },
      { waveNumber: 10, clearBonus: 95, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'crystal_golem', count: 6, spacing: 1.3, hpOverride: 400, bountyOverride: 20 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.4, hpOverride: 2550, bountyOverride: 90 }] },
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
      { waveNumber: 1, clearBonus: 26, groups: [{ enemyId: 'turbo_hopper', count: 14, spacing: 0.65, hpOverride: 72, bountyOverride: 7 }, { enemyId: 'scout_bot', count: 12, spacing: 0.72, hpOverride: 54, bountyOverride: 6 }] },
      { waveNumber: 2, clearBonus: 30, groups: [{ enemyId: 'chomp_brute', count: 6, spacing: 1.3, hpOverride: 210, bountyOverride: 15 }, { enemyId: 'repair_drone', count: 5, spacing: 0.9, hpOverride: 110, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 34, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.85, hpOverride: 315, bountyOverride: 20 }, { enemyId: 'hover_drone', count: 12, spacing: 0.58, hpOverride: 96, bountyOverride: 8 }] },
      { waveNumber: 4, clearBonus: 38, groups: [{ enemyId: 'swarm_saw', count: 34, spacing: 0.19, hpOverride: 44, bountyOverride: 4 }, { enemyId: 'crystal_golem', count: 5, spacing: 1.5, hpOverride: 350, bountyOverride: 20 }] },
      { waveNumber: 5, clearBonus: 42, groups: [{ enemyId: 'turbo_hopper', count: 24, spacing: 0.38, hpOverride: 88, bountyOverride: 7 }, { enemyId: 'repair_drone', count: 9, spacing: 0.66, hpOverride: 122, bountyOverride: 10 }] },
      { waveNumber: 6, clearBonus: 46, groups: [{ enemyId: 'shield_loader', count: 11, spacing: 0.88, hpOverride: 245, bountyOverride: 14 }, { enemyId: 'chomp_brute', count: 9, spacing: 0.95, hpOverride: 245, bountyOverride: 15 }] },
      { waveNumber: 7, clearBonus: 50, groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.25, hpOverride: 390, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 10, spacing: 0.62, hpOverride: 128, bountyOverride: 10 }] },
      { waveNumber: 8, clearBonus: 55, groups: [{ enemyId: 'chomp_brute', count: 12, spacing: 0.78, hpOverride: 265, bountyOverride: 15 }, { enemyId: 'hover_drone', count: 22, spacing: 0.36, hpOverride: 112, bountyOverride: 8 }] },
      { waveNumber: 9, clearBonus: 60, groups: [{ enemyId: 'crystal_golem', count: 9, spacing: 1.15, hpOverride: 420, bountyOverride: 22 }, { enemyId: 'turbo_hopper', count: 24, spacing: 0.34, hpOverride: 98, bountyOverride: 7 }] },
      { waveNumber: 10, clearBonus: 110, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'repair_drone', count: 7, spacing: 0.74, hpOverride: 135, bountyOverride: 10 }, { enemyId: 'crystal_golem', count: 5, spacing: 1.25, hpOverride: 420, bountyOverride: 22 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 2450, bountyOverride: 110 }] },
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
      { waveNumber: 1, clearBonus: 28, groups: [{ enemyId: 'turbo_hopper', count: 16, spacing: 0.6, hpOverride: 78, bountyOverride: 7 }, { enemyId: 'chomp_brute', count: 4, spacing: 1.45, hpOverride: 210, bountyOverride: 16 }] },
      { waveNumber: 2, clearBonus: 32, groups: [{ enemyId: 'hover_drone', count: 15, spacing: 0.52, hpOverride: 100, bountyOverride: 8 }, { enemyId: 'repair_drone', count: 6, spacing: 0.85, hpOverride: 115, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 36, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.75, hpOverride: 325, bountyOverride: 22 }, { enemyId: 'swarm_saw', count: 22, spacing: 0.27, hpOverride: 42, bountyOverride: 4 }] },
      { waveNumber: 4, clearBonus: 40, groups: [{ enemyId: 'shield_loader', count: 10, spacing: 0.9, hpOverride: 245, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 7, spacing: 0.72, hpOverride: 124, bountyOverride: 10 }] },
      { waveNumber: 5, clearBonus: 44, groups: [{ enemyId: 'turbo_hopper', count: 24, spacing: 0.38, hpOverride: 94, bountyOverride: 7 }, { enemyId: 'chomp_brute', count: 9, spacing: 0.88, hpOverride: 255, bountyOverride: 16 }] },
      { waveNumber: 6, clearBonus: 48, groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.3, hpOverride: 400, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 9, spacing: 0.64, hpOverride: 132, bountyOverride: 10 }] },
      { waveNumber: 7, clearBonus: 54, groups: [{ enemyId: 'chomp_brute', count: 12, spacing: 0.78, hpOverride: 270, bountyOverride: 16 }, { enemyId: 'hover_drone', count: 22, spacing: 0.36, hpOverride: 115, bountyOverride: 8 }] },
      { waveNumber: 8, clearBonus: 58, groups: [{ enemyId: 'crystal_golem', count: 10, spacing: 1.15, hpOverride: 430, bountyOverride: 22 }, { enemyId: 'turbo_hopper', count: 26, spacing: 0.33, hpOverride: 102, bountyOverride: 7 }] },
      { waveNumber: 9, clearBonus: 65, groups: [{ enemyId: 'shield_loader', count: 12, spacing: 0.78, hpOverride: 270, bountyOverride: 14 }, { enemyId: 'repair_drone', count: 10, spacing: 0.58, hpOverride: 138, bountyOverride: 10 }] },
      { waveNumber: 10, clearBonus: 115, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.15, hpOverride: 445, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 9, spacing: 0.6, hpOverride: 142, bountyOverride: 10 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.4, hpOverride: 2650, bountyOverride: 115 }] },
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
      { waveNumber: 1, clearBonus: 30, groups: [{ enemyId: 'turbo_hopper', count: 18, spacing: 0.55, hpOverride: 84, bountyOverride: 7 }, { enemyId: 'hover_drone', count: 12, spacing: 0.58, hpOverride: 100, bountyOverride: 8 }] },
      { waveNumber: 2, clearBonus: 34, groups: [{ enemyId: 'chomp_brute', count: 7, spacing: 1.15, hpOverride: 230, bountyOverride: 16 }, { enemyId: 'repair_drone', count: 6, spacing: 0.78, hpOverride: 122, bountyOverride: 10 }] },
      { waveNumber: 3, clearBonus: 38, groups: [{ enemyId: 'crystal_golem', count: 4, spacing: 1.7, hpOverride: 340, bountyOverride: 22 }, { enemyId: 'shield_loader', count: 6, spacing: 1.15, hpOverride: 235, bountyOverride: 14 }] },
      { waveNumber: 4, clearBonus: 42, groups: [{ enemyId: 'swarm_saw', count: 36, spacing: 0.18, hpOverride: 48, bountyOverride: 4 }, { enemyId: 'chomp_brute', count: 9, spacing: 0.9, hpOverride: 255, bountyOverride: 16 }] },
      { waveNumber: 5, clearBonus: 46, groups: [{ enemyId: 'turbo_hopper', count: 26, spacing: 0.35, hpOverride: 98, bountyOverride: 7 }, { enemyId: 'repair_drone', count: 10, spacing: 0.62, hpOverride: 135, bountyOverride: 10 }] },
      { waveNumber: 6, clearBonus: 52, groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.2, hpOverride: 420, bountyOverride: 22 }, { enemyId: 'hover_drone', count: 22, spacing: 0.36, hpOverride: 118, bountyOverride: 8 }] },
      { waveNumber: 7, clearBonus: 58, groups: [{ enemyId: 'shield_loader', count: 12, spacing: 0.78, hpOverride: 275, bountyOverride: 14 }, { enemyId: 'chomp_brute', count: 12, spacing: 0.76, hpOverride: 280, bountyOverride: 16 }] },
      { waveNumber: 8, clearBonus: 62, groups: [{ enemyId: 'crystal_golem', count: 10, spacing: 1.05, hpOverride: 455, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 12, spacing: 0.54, hpOverride: 146, bountyOverride: 10 }] },
      { waveNumber: 9, clearBonus: 68, groups: [{ enemyId: 'turbo_hopper', count: 30, spacing: 0.3, hpOverride: 106, bountyOverride: 7 }, { enemyId: 'chomp_brute', count: 13, spacing: 0.72, hpOverride: 300, bountyOverride: 16 }] },
      { waveNumber: 10, clearBonus: 72, groups: [{ enemyId: 'crystal_golem', count: 12, spacing: 0.95, hpOverride: 480, bountyOverride: 22 }, { enemyId: 'hover_drone', count: 26, spacing: 0.32, hpOverride: 126, bountyOverride: 8 }] },
      { waveNumber: 11, clearBonus: 130, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'crystal_golem', count: 7, spacing: 1.1, hpOverride: 475, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 10, spacing: 0.55, hpOverride: 148, bountyOverride: 10 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.4, hpOverride: 2850, bountyOverride: 125 }] },
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
      { waveNumber: 1, clearBonus: 32, groups: [{ enemyId: 'scout_bot', count: 14, spacing: 0.62, hpOverride: 62, bountyOverride: 6 }, { enemyId: 'turbo_hopper', count: 14, spacing: 0.56, hpOverride: 88, bountyOverride: 8 }] },
      { waveNumber: 2, clearBonus: 36, groups: [{ enemyId: 'chomp_brute', count: 8, spacing: 1.05, hpOverride: 240, bountyOverride: 16 }, { enemyId: 'swarm_saw', count: 28, spacing: 0.2, hpOverride: 48, bountyOverride: 4 }] },
      { waveNumber: 3, clearBonus: 40, groups: [{ enemyId: 'hover_drone', count: 18, spacing: 0.44, hpOverride: 112, bountyOverride: 9 }, { enemyId: 'repair_drone', count: 8, spacing: 0.65, hpOverride: 132, bountyOverride: 10 }] },
      { waveNumber: 4, clearBonus: 46, groups: [{ enemyId: 'crystal_golem', count: 6, spacing: 1.35, hpOverride: 395, bountyOverride: 22 }, { enemyId: 'shield_loader', count: 10, spacing: 0.88, hpOverride: 255, bountyOverride: 14 }] },
      { waveNumber: 5, clearBonus: 52, groups: [{ enemyId: 'turbo_hopper', count: 28, spacing: 0.32, hpOverride: 104, bountyOverride: 8 }, { enemyId: 'repair_drone', count: 10, spacing: 0.58, hpOverride: 142, bountyOverride: 10 }] },
      { waveNumber: 6, clearBonus: 56, groups: [{ enemyId: 'chomp_brute', count: 12, spacing: 0.8, hpOverride: 280, bountyOverride: 16 }, { enemyId: 'crystal_golem', count: 8, spacing: 1.15, hpOverride: 445, bountyOverride: 22 }] },
      { waveNumber: 7, clearBonus: 62, groups: [{ enemyId: 'shield_loader', count: 14, spacing: 0.74, hpOverride: 285, bountyOverride: 14 }, { enemyId: 'hover_drone', count: 26, spacing: 0.34, hpOverride: 128, bountyOverride: 9 }] },
      { waveNumber: 8, clearBonus: 68, groups: [{ enemyId: 'crystal_golem', count: 12, spacing: 1.0, hpOverride: 480, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 12, spacing: 0.52, hpOverride: 150, bountyOverride: 10 }] },
      { waveNumber: 9, clearBonus: 74, groups: [{ enemyId: 'turbo_hopper', count: 34, spacing: 0.27, hpOverride: 114, bountyOverride: 8 }, { enemyId: 'chomp_brute', count: 14, spacing: 0.7, hpOverride: 310, bountyOverride: 16 }] },
      { waveNumber: 10, clearBonus: 82, groups: [{ enemyId: 'crystal_golem', count: 13, spacing: 0.92, hpOverride: 510, bountyOverride: 22 }, { enemyId: 'hover_drone', count: 28, spacing: 0.3, hpOverride: 136, bountyOverride: 9 }] },
      { waveNumber: 11, clearBonus: 95, announceEnemy: 'mega_harvester', groups: [{ enemyId: 'chomp_brute', count: 11, spacing: 0.8, hpOverride: 315, bountyOverride: 16 }, { enemyId: 'repair_drone', count: 10, spacing: 0.55, hpOverride: 155, bountyOverride: 10 }, { enemyId: 'mega_harvester', count: 1, spacing: 1.5, hpOverride: 2450, bountyOverride: 100 }] },
      { waveNumber: 12, clearBonus: 200, announceEnemy: 'cryo_colossus', groups: [{ enemyId: 'crystal_golem', count: 8, spacing: 1.05, hpOverride: 525, bountyOverride: 22 }, { enemyId: 'repair_drone', count: 11, spacing: 0.52, hpOverride: 162, bountyOverride: 10 }, { enemyId: 'cryo_colossus', count: 1, spacing: 1.5, hpOverride: 3400, bountyOverride: 140 }] },
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

import { SeededRNG } from '../core/SeededRNG.ts';
import type { TowerId } from './towers.ts';
import {
  todayKey,
  type CardUnitId,
  type DailyMutatorId,
  type SaveManager,
  type SaveState,
} from '../services/SaveManager.ts';
import { LEVELS, type LevelSpec } from './levels.ts';

export type { DailyMutatorId };

export interface LoginRewardSpec {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  oakCoins?: number;
  gems?: number;
  cards?: Array<{ unitId: CardUnitId; count: number }>;
}

export const LOGIN_REWARDS: readonly LoginRewardSpec[] = [
  { day: 1, oakCoins: 120 },
  { day: 2, gems: 15 },
  {
    day: 3,
    cards: [
      { unitId: 'squirrel', count: 3 },
      { unitId: 'hedgehog', count: 3 },
    ],
  },
  { day: 4, oakCoins: 220 },
  { day: 5, gems: 25 },
  {
    day: 6,
    cards: [
      { unitId: 'falcon', count: 4 },
      { unitId: 'lynx', count: 4 },
    ],
  },
  {
    day: 7,
    oakCoins: 450,
    gems: 45,
    cards: [
      { unitId: 'badger', count: 5 },
      { unitId: 'tortoise', count: 5 },
    ],
  },
];

export interface LoginCalendarStatus {
  streakDay: number; // 0..7 claimed so far in current cycle
  nextClaimDay: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  canClaimToday: boolean;
  claimedToday: boolean;
  today: string;
}

export function getLoginCalendarStatus(save: SaveState, nowMs = Date.now()): LoginCalendarStatus {
  const today = todayKey(nowMs);
  const claimedToday = save.lastLoginClaimDate === today;
  const rawDay = Math.max(0, Math.min(7, Math.floor(save.loginStreakDay ?? 0)));
  const effectiveDone = !claimedToday && rawDay >= 7 ? 0 : rawDay;
  const nextClaimDay = (claimedToday ? Math.max(1, effectiveDone) : Math.min(7, effectiveDone + 1)) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7;

  return {
    streakDay: effectiveDone,
    nextClaimDay,
    canClaimToday: !claimedToday,
    claimedToday,
    today,
  };
}

export function claimDailyLoginReward(
  saveManager: SaveManager,
  nowMs = Date.now(),
): { claimed: boolean; reward: LoginRewardSpec | null; day: number } {
  const status = getLoginCalendarStatus(saveManager.get(), nowMs);
  if (!status.canClaimToday) {
    return { claimed: false, reward: null, day: status.streakDay };
  }
  const spec = LOGIN_REWARDS[status.nextClaimDay - 1] ?? LOGIN_REWARDS[0];
  saveManager.update((draft) => {
    draft.loginStreakDay = spec.day;
    draft.lastLoginClaimDate = status.today;
    if (spec.oakCoins) draft.oakCoins += spec.oakCoins;
    if (spec.gems) draft.emeraldGems += spec.gems;
    if (spec.cards) {
      for (const c of spec.cards) {
        draft.cardShards[c.unitId] = (draft.cardShards[c.unitId] ?? 0) + c.count;
      }
    }
  });
  return { claimed: true, reward: spec, day: spec.day };
}

export interface DailyMutatorSpec {
  id: DailyMutatorId;
  nameKey: string;
  descKey: string;
  speedMult: number;
  hpMult: number;
  extraArmor: number;
  bountyMult: number;
  extraStartGold: number;
  allowSell: boolean;
  allowedTowers?: TowerId[];
  groundedAirTargets?: boolean;
}

export const DAILY_MUTATORS: Record<DailyMutatorId, DailyMutatorSpec> = {
  fast_bots: {
    id: 'fast_bots',
    nameKey: 'mutator.fast_bots.name',
    descKey: 'mutator.fast_bots.desc',
    speedMult: 1.25,
    hpMult: 1.0,
    extraArmor: 0,
    bountyMult: 1.35,
    extraStartGold: 0,
    allowSell: true,
  },
  armored_wave: {
    id: 'armored_wave',
    nameKey: 'mutator.armored_wave.name',
    descKey: 'mutator.armored_wave.desc',
    speedMult: 1.0,
    hpMult: 1.0,
    extraArmor: 0.18,
    bountyMult: 1.0,
    extraStartGold: 90,
    allowSell: true,
  },
  air_and_frost: {
    id: 'air_and_frost',
    nameKey: 'mutator.air_and_frost.name',
    descKey: 'mutator.air_and_frost.desc',
    speedMult: 1.0,
    hpMult: 1.0,
    extraArmor: 0,
    bountyMult: 1.0,
    extraStartGold: 45,
    allowSell: true,
    allowedTowers: ['squirrel', 'owl', 'falcon', 'lynx'],
  },
  heavy_siege: {
    id: 'heavy_siege',
    nameKey: 'mutator.heavy_siege.name',
    descKey: 'mutator.heavy_siege.desc',
    speedMult: 1.0,
    hpMult: 1.05,
    extraArmor: 0,
    bountyMult: 1.0,
    extraStartGold: 60,
    allowSell: true,
    allowedTowers: ['beaver', 'hedgehog', 'badger', 'tortoise'],
    groundedAirTargets: true,
  },
  no_sell: {
    id: 'no_sell',
    nameKey: 'mutator.no_sell.name',
    descKey: 'mutator.no_sell.desc',
    speedMult: 1.0,
    hpMult: 1.0,
    extraArmor: 0,
    bountyMult: 1.0,
    extraStartGold: 100,
    allowSell: false,
  },
  double_bounty: {
    id: 'double_bounty',
    nameKey: 'mutator.double_bounty.name',
    descKey: 'mutator.double_bounty.desc',
    speedMult: 1.0,
    hpMult: 1.3,
    extraArmor: 0,
    bountyMult: 2.0,
    extraStartGold: 0,
    allowSell: true,
  },
};

export const DAILY_MUTATOR_LIST: readonly DailyMutatorSpec[] = Object.values(DAILY_MUTATORS);
export const DAILY_CHALLENGE_OAK = 180;
export const DAILY_CHALLENGE_GEMS = 25;

const DAILY_STAGE_POOL = [4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27];

function hashDateString(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DailyChallengeSpec {
  dateKey: string;
  seed: number;
  levelId: number;
  levelSpec: LevelSpec;
  mutator: DailyMutatorSpec;
  rewardOak: number;
  rewardGems: number;
}

export function getDailyChallengeSpec(nowMs = Date.now()): DailyChallengeSpec {
  const dateKey = todayKey(nowMs);
  const seed = hashDateString(dateKey);
  const rng = new SeededRNG(seed);
  const levelId = DAILY_STAGE_POOL[Math.floor(rng.next() * DAILY_STAGE_POOL.length)] ?? 6;
  const mutator = DAILY_MUTATOR_LIST[Math.floor(rng.next() * DAILY_MUTATOR_LIST.length)] ?? DAILY_MUTATORS.fast_bots;
  const levelSpec = LEVELS.find((l) => l.id === levelId) ?? LEVELS[5] ?? LEVELS[0];
  return {
    dateKey,
    seed,
    levelId: levelSpec.id,
    levelSpec,
    mutator,
    rewardOak: DAILY_CHALLENGE_OAK,
    rewardGems: DAILY_CHALLENGE_GEMS,
  };
}

import { SeededRNG } from '../core/SeededRNG.ts';
import type { ExpeditionRunState, RelicId } from '../services/SaveManager.ts';
import { LEVELS, type LevelSpec } from './levels.ts';
import { TOWER_LIST } from './towers.ts';

export type { ExpeditionRunState, RelicId };

export interface RelicSpec {
  id: RelicId;
  nameKey: string;
  descKey: string;
}

export const RELICS: Record<RelicId, RelicSpec> = {
  explosive_acorns: {
    id: 'explosive_acorns',
    nameKey: 'relic.explosive_acorns.name',
    descKey: 'relic.explosive_acorns.desc',
  },
  giant_hero: {
    id: 'giant_hero',
    nameKey: 'relic.giant_hero.name',
    descKey: 'relic.giant_hero.desc',
  },
  twin_mortar: {
    id: 'twin_mortar',
    nameKey: 'relic.twin_mortar.name',
    descKey: 'relic.twin_mortar.desc',
  },
  lightning_refund: {
    id: 'lightning_refund',
    nameKey: 'relic.lightning_refund.name',
    descKey: 'relic.lightning_refund.desc',
  },
  emerald_bounty: {
    id: 'emerald_bounty',
    nameKey: 'relic.emerald_bounty.name',
    descKey: 'relic.emerald_bounty.desc',
  },
  frost_thorns: {
    id: 'frost_thorns',
    nameKey: 'relic.frost_thorns.name',
    descKey: 'relic.frost_thorns.desc',
  },
};

export const RELIC_LIST: RelicSpec[] = Object.values(RELICS);
export const EXPEDITION_STAGE_MAPS = [2, 5, 8, 10, 12] as const;
export const EXPEDITION_CLEAR_OAK = 180;
export const EXPEDITION_CLEAR_GEMS = 35;

function pickIndex(rng: SeededRNG, length: number): number {
  return Math.floor(rng.next() * length);
}

export function startNewExpedition(seed = Date.now()): ExpeditionRunState {
  const rng = new SeededRNG(seed);
  const airCapable = TOWER_LIST.filter((t) => t.canHitAir).map((t) => t.id);
  const firstAir = airCapable[pickIndex(rng, airCapable.length)];
  const others = TOWER_LIST.map((t) => t.id).filter((id) => id !== firstAir);
  const second = others[pickIndex(rng, others.length)];

  return {
    seed,
    stageIndex: 0,
    hp: 150,
    maxHp: 150,
    allowedTowers: [firstAir, second],
    relics: [],
    pendingRelicChoices: [],
  };
}

export function rollRelicChoices(run: ExpeditionRunState, nextStageIndex: number): RelicId[] {
  const rng = new SeededRNG(run.seed + nextStageIndex * 193);
  const pool = RELIC_LIST.map((r) => r.id).filter((id) => !run.relics.includes(id));
  const copy = [...(pool.length > 0 ? pool : RELIC_LIST.map((r) => r.id))];
  const chosen: RelicId[] = [];
  while (chosen.length < 3 && copy.length > 0) {
    const idx = pickIndex(rng, copy.length);
    chosen.push(copy.splice(idx, 1)[0]);
  }
  return chosen;
}

export function advanceExpeditionStage(
  run: ExpeditionRunState,
  remainingHp: number,
): { nextRun: ExpeditionRunState | null; completed: boolean } {
  if (run.stageIndex >= 4) {
    return { nextRun: null, completed: true };
  }
  const nextStageIndex = run.stageIndex + 1;
  const nextAllowed = [...run.allowedTowers];
  if (nextStageIndex === 2 || nextStageIndex === 4) {
    const missing = TOWER_LIST.map((t) => t.id).filter((id) => !nextAllowed.includes(id));
    if (missing.length > 0) {
      nextAllowed.push(missing[0]);
    }
  }
  const hp = Math.max(20, Math.min(run.maxHp, Math.round(remainingHp)));
  return {
    completed: false,
    nextRun: {
      ...run,
      stageIndex: nextStageIndex,
      hp,
      allowedTowers: nextAllowed,
      pendingRelicChoices: rollRelicChoices(run, nextStageIndex),
    },
  };
}

export function chooseExpeditionRelic(run: ExpeditionRunState, relicId: RelicId): ExpeditionRunState {
  if (!RELICS[relicId]) return run;
  const relics = run.relics.includes(relicId) ? [...run.relics] : [...run.relics, relicId];
  return {
    ...run,
    relics,
    pendingRelicChoices: [],
  };
}

export function buildExpeditionLevelSpec(run: ExpeditionRunState): LevelSpec {
  const stageIdx = Math.max(0, Math.min(4, run.stageIndex));
  const baseLevelId = EXPEDITION_STAGE_MAPS[stageIdx];
  const base = LEVELS.find((l) => l.id === baseLevelId) ?? LEVELS[0];
  const waveMult = 1 + stageIdx * 0.14;
  const waves = base.waves.slice(0, 5).map((w, idx) => ({
    waveNumber: idx + 1,
    clearBonus: w.clearBonus + 10,
    announceEnemy: w.announceEnemy,
    groups: w.groups.map((g) => ({
      ...g,
      hpOverride: g.hpOverride ? Math.round(g.hpOverride * waveMult) : undefined,
    })),
  }));

  return {
    ...base,
    id: 100 + stageIdx + 1,
    startGold: 165 + stageIdx * 25,
    baseHp: run.maxHp,
    waves,
  };
}

import type { TowerId } from './towers.ts';

export type SynergyComboId = 'shatter' | 'corrode_crit' | 'ignite' | 'superconduct';
export type ElementPrime = 'frost' | 'acid' | 'resin';

export interface SynergyComboSpec {
  id: SynergyComboId;
  nameKey: string;
  descKey: string;
  prime: ElementPrime;
  primers: readonly TowerId[];
  triggers: readonly TowerId[];
  color: string;
  cooldownSec: number;
}

export const SYNERGY_COMBOS: Record<SynergyComboId, SynergyComboSpec> = {
  shatter: {
    id: 'shatter',
    nameKey: 'synergy.shatter.name',
    descKey: 'synergy.shatter.desc',
    prime: 'frost',
    primers: ['lynx', 'owl'],
    triggers: ['beaver', 'tortoise', 'hedgehog'],
    color: '#7eeeff',
    cooldownSec: 2.2,
  },
  corrode_crit: {
    id: 'corrode_crit',
    nameKey: 'synergy.corrode_crit.name',
    descKey: 'synergy.corrode_crit.desc',
    prime: 'acid',
    primers: ['badger'],
    triggers: ['squirrel', 'falcon', 'hedgehog'],
    color: '#74f78d',
    cooldownSec: 2.2,
  },
  ignite: {
    id: 'ignite',
    nameKey: 'synergy.ignite.name',
    descKey: 'synergy.ignite.desc',
    prime: 'resin',
    primers: ['beaver', 'badger'],
    triggers: ['badger', 'owl', 'falcon'],
    color: '#ff9342',
    cooldownSec: 2.4,
  },
  superconduct: {
    id: 'superconduct',
    nameKey: 'synergy.superconduct.name',
    descKey: 'synergy.superconduct.desc',
    prime: 'frost',
    primers: ['lynx', 'owl'],
    triggers: ['owl', 'falcon'],
    color: '#6de4ff',
    cooldownSec: 2.4,
  },
};

export const SYNERGY_COMBO_LIST: SynergyComboSpec[] = Object.values(SYNERGY_COMBOS);

/** Returns all elemental synergy combos in which `towerId` participates as primer or trigger. */
export function getTowerSynergies(towerId: TowerId): SynergyComboSpec[] {
  return SYNERGY_COMBO_LIST.filter(
    (combo) => combo.primers.includes(towerId) || combo.triggers.includes(towerId),
  );
}

/**
 * Returns combo IDs activated when pairing `towerId` with a different already-built tower
 * on the field (one acting as primer and the other as trigger).
 */
export function getActiveSynergyPartnersForTower(
  towerId: TowerId,
  builtTowerIds: Iterable<TowerId>,
): SynergyComboId[] {
  const built = new Set<TowerId>(builtTowerIds);
  const active: SynergyComboId[] = [];
  for (const combo of SYNERGY_COMBO_LIST) {
    const canPairAsPrimer =
      combo.primers.includes(towerId) &&
      combo.triggers.some((other) => other !== towerId && built.has(other));
    const canPairAsTrigger =
      combo.triggers.includes(towerId) &&
      combo.primers.some((other) => other !== towerId && built.has(other));
    if (canPairAsPrimer || canPairAsTrigger) {
      active.push(combo.id);
    }
  }
  return active;
}

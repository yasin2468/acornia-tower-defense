import type { HatId } from './towers.ts';

export type AuraId = 'none' | 'emerald_leaf' | 'solar_ember' | 'frost_crystal' | 'arcane_star';
export type BannerId = 'none' | 'oak_crest' | 'iron_ward' | 'storm_feather' | 'crimson_flame';

export interface HatSpec {
  id: HatId;
  nameKey: string;
  descKey: string;
  currency: 'free' | 'oak' | 'gem';
  cost: number;
  unlockHintKey?: string;
}

export interface AuraSpec {
  id: AuraId;
  nameKey: string;
  descKey: string;
  currency: 'free' | 'oak' | 'gem';
  cost: number;
  primaryHex: string;
  secondaryHex: string;
}

export interface BannerSpec {
  id: BannerId;
  nameKey: string;
  descKey: string;
  currency: 'free' | 'oak' | 'gem';
  cost: number;
  clothHex: string;
  trimHex: string;
  bonusStartGold?: number;
  bonusBaseHp?: number;
  bonusTowerDmgPct?: number;
  bonusRainCdSec?: number;
}

export const HAT_SPECS: readonly HatSpec[] = [
  { id: 'none', nameKey: 'hat.none', descKey: 'acc.hat.none.desc', currency: 'free', cost: 0 },
  { id: 'pirate', nameKey: 'hat.pirate', descKey: 'acc.hat.pirate.desc', currency: 'free', cost: 0 },
  { id: 'chef', nameKey: 'hat.chef', descKey: 'acc.hat.chef.desc', currency: 'free', cost: 0 },
  { id: 'wizard', nameKey: 'hat.wizard', descKey: 'acc.hat.wizard.desc', currency: 'oak', cost: 140, unlockHintKey: 'acc.hint.sefer' },
  { id: 'viking', nameKey: 'hat.viking', descKey: 'acc.hat.viking.desc', currency: 'oak', cost: 200, unlockHintKey: 'acc.hint.arena' },
  { id: 'goggles', nameKey: 'hat.goggles', descKey: 'acc.hat.goggles.desc', currency: 'oak', cost: 160 },
  { id: 'antlers', nameKey: 'hat.antlers', descKey: 'acc.hat.antlers.desc', currency: 'gem', cost: 65, unlockHintKey: 'acc.hint.ach' },
  { id: 'samurai', nameKey: 'hat.samurai', descKey: 'acc.hat.samurai.desc', currency: 'gem', cost: 90 },
  { id: 'crown', nameKey: 'hat.crown', descKey: 'acc.hat.crown.desc', currency: 'gem', cost: 140 },
];

export const AURA_SPECS: readonly AuraSpec[] = [
  {
    id: 'none',
    nameKey: 'aura.none',
    descKey: 'acc.aura.none.desc',
    currency: 'free',
    cost: 0,
    primaryHex: '#7eed87',
    secondaryHex: '#4b5563',
  },
  {
    id: 'emerald_leaf',
    nameKey: 'aura.emerald_leaf',
    descKey: 'acc.aura.emerald_leaf.desc',
    currency: 'free',
    cost: 0,
    primaryHex: '#3ef28a',
    secondaryHex: '#ffd85c',
  },
  {
    id: 'solar_ember',
    nameKey: 'aura.solar_ember',
    descKey: 'acc.aura.solar_ember.desc',
    currency: 'oak',
    cost: 180,
    primaryHex: '#ff8e2b',
    secondaryHex: '#ffe266',
  },
  {
    id: 'frost_crystal',
    nameKey: 'aura.frost_crystal',
    descKey: 'acc.aura.frost_crystal.desc',
    currency: 'gem',
    cost: 60,
    primaryHex: '#59e8ff',
    secondaryHex: '#e3f9ff',
  },
  {
    id: 'arcane_star',
    nameKey: 'aura.arcane_star',
    descKey: 'acc.aura.arcane_star.desc',
    currency: 'gem',
    cost: 110,
    primaryHex: '#c66bff',
    secondaryHex: '#ffeb82',
  },
];

export const BANNER_SPECS: readonly BannerSpec[] = [
  {
    id: 'none',
    nameKey: 'banner.none',
    descKey: 'acc.banner.none.desc',
    currency: 'free',
    cost: 0,
    clothHex: '#4f3a24',
    trimHex: '#c89b44',
  },
  {
    id: 'oak_crest',
    nameKey: 'banner.oak_crest',
    descKey: 'acc.banner.oak_crest.desc',
    currency: 'oak',
    cost: 160,
    clothHex: '#257d44',
    trimHex: '#ffd24c',
    bonusStartGold: 15,
  },
  {
    id: 'iron_ward',
    nameKey: 'banner.iron_ward',
    descKey: 'acc.banner.iron_ward.desc',
    currency: 'oak',
    cost: 240,
    clothHex: '#3f5a7a',
    trimHex: '#e2ebf5',
    bonusBaseHp: 15,
  },
  {
    id: 'storm_feather',
    nameKey: 'banner.storm_feather',
    descKey: 'acc.banner.storm_feather.desc',
    currency: 'gem',
    cost: 75,
    clothHex: '#1d8cd6',
    trimHex: '#ffe680',
    bonusTowerDmgPct: 0.04,
  },
  {
    id: 'crimson_flame',
    nameKey: 'banner.crimson_flame',
    descKey: 'acc.banner.crimson_flame.desc',
    currency: 'gem',
    cost: 120,
    clothHex: '#ad2424',
    trimHex: '#ffd24c',
    bonusRainCdSec: 1.5,
  },
];

export function getAuraSpec(id: AuraId): AuraSpec {
  return AURA_SPECS.find((a) => a.id === id) ?? AURA_SPECS[0];
}

export function getBannerSpec(id: BannerId): BannerSpec {
  return BANNER_SPECS.find((b) => b.id === id) ?? BANNER_SPECS[0];
}

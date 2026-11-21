import {
  AURA_SPECS,
  BANNER_SPECS,
  HAT_SPECS,
  type AuraId,
  type BannerId,
} from '../data/accessories.ts';
import { ENEMY_LIST, HEROES, HERO_LIST, type HeroId } from '../data/enemies.ts';
import {
  clampTalentRank,
  computeAvailableTalentStars,
  computeTotalEarnedStars,
  createInitialTalents,
  getNextTalentCost,
  getTalentSpec,
  isTalentNodeUnlocked,
  type TalentBranchId,
} from '../data/talents.ts';
import { CARD_MAX_LEVEL, TOWER_LIST, type HatId } from '../data/towers.ts';
import type { Locale } from '../i18n/locales.ts';
import type { ModelName } from '../rendering/AssetLoader.ts';
import { isVipActive } from './CommercialServices.ts';
import type {
  CardUnitId,
  DailyQuestProgressState,
  SaveManager,
  SaveState,
} from './SaveManager.ts';

export interface AfkAccumulation {
  hoursElapsed: number;
  capHours: number;
  oakCoins: number;
  shards: number;
}

export interface ChestReward {
  oakCoins: number;
  gems: number;
  cards: Partial<Record<CardUnitId, number>>;
}

const UNIT_IDS: CardUnitId[] = [
  'squirrel',
  'beaver',
  'owl',
  'hedgehog',
  'badger',
  'falcon',
  'tortoise',
  'lynx',
  'boz_pence',
];

function activeCardPool(save: SaveState): CardUnitId[] {
  const pool = [...UNIT_IDS];
  for (const h of save.unlockedHeroes) {
    if (!pool.includes(h)) pool.push(h);
  }
  return pool;
}

export const AFK_OAK_PER_HOUR = 35;
export const AFK_QUICK_BOOST_HOURS = 4;
export const AFK_QUICK_BOOST_OAK = AFK_OAK_PER_HOUR * AFK_QUICK_BOOST_HOURS; // 140
export const AFK_QUICK_BOOST_SHARDS: Readonly<Record<'squirrel' | 'owl', number>> = { squirrel: 1, owl: 1 };
export const AFK_QUICK_BOOST_TOTAL_SHARDS = AFK_QUICK_BOOST_SHARDS.squirrel + AFK_QUICK_BOOST_SHARDS.owl;

export function getCardUpgradeCost(currentLevel: number): { shards: number; oakCoins: number } {
  return {
    shards: 2 + currentLevel * 2,
    oakCoins: 60 + currentLevel * 45,
  };
}

export function calculateAfkAccumulation(save: SaveState, nowMs = Date.now()): AfkAccumulation {
  const capHours = isVipActive(save, nowMs) ? 16 : 8;
  const elapsedMs = Math.max(0, nowMs - save.afkLastClaimAt);
  const hoursElapsed = Math.min(capHours, elapsedMs / (3600 * 1000));
  const oakCoins = Math.floor(hoursElapsed * AFK_OAK_PER_HOUR);
  const shards = Math.floor(hoursElapsed / 2);
  return {
    hoursElapsed: Number(hoursElapsed.toFixed(1)),
    capHours,
    oakCoins,
    shards,
  };
}

export function claimAfkPatrol(saveManager: SaveManager, nowMs = Date.now()): AfkAccumulation {
  const reward = calculateAfkAccumulation(saveManager.get(), nowMs);
  const pool = activeCardPool(saveManager.get());
  saveManager.update((s) => {
    s.oakCoins += reward.oakCoins;
    for (let i = 0; i < reward.shards; i++) {
      const unit = pool[i % pool.length];
      s.cardShards[unit] += 1;
    }
    s.afkLastClaimAt = nowMs;
  });
  return reward;
}

export function grantQuickAfkBoost(saveManager: SaveManager, nowMs = Date.now()): boolean {
  saveManager.rollDailyCounters(nowMs);
  const s = saveManager.get();
  if (s.dailyAfkBoostsUsed >= 2) return false;
  saveManager.update((draft) => {
    draft.dailyAfkBoostsUsed += 1;
    draft.oakCoins += AFK_QUICK_BOOST_OAK;
    draft.cardShards.squirrel += AFK_QUICK_BOOST_SHARDS.squirrel;
    draft.cardShards.owl += AFK_QUICK_BOOST_SHARDS.owl;
  });
  return true;
}

export function upgradeCard(saveManager: SaveManager, unitId: CardUnitId): boolean {
  const s = saveManager.get();
  const lvl = s.cardLevels[unitId];
  if (lvl >= CARD_MAX_LEVEL) return false;
  const cost = getCardUpgradeCost(lvl);
  if (s.cardShards[unitId] < cost.shards || s.oakCoins < cost.oakCoins) return false;

  saveManager.update((draft) => {
    draft.cardShards[unitId] -= cost.shards;
    draft.oakCoins -= cost.oakCoins;
    draft.cardLevels[unitId] += 1;
  });
  return true;
}

export function openForestChest(
  saveManager: SaveManager,
  tier: 'common' | 'epic',
  seedOffset = Date.now(),
): ChestReward {
  const isEpic = tier === 'epic';
  const reward: ChestReward = {
    oakCoins: isEpic ? 320 : 90,
    gems: isEpic ? 25 : 6,
    cards: {},
  };
  const count = isEpic ? 10 : 3;
  const pool = activeCardPool(saveManager.get());
  for (let i = 0; i < count; i++) {
    const unit = pool[(Math.abs(seedOffset) + i * 3) % pool.length];
    reward.cards[unit] = (reward.cards[unit] ?? 0) + 1;
  }

  saveManager.update((draft) => {
    draft.oakCoins += reward.oakCoins;
    draft.emeraldGems += reward.gems;
    for (const [k, v] of Object.entries(reward.cards)) {
      const id = k as CardUnitId;
      draft.cardShards[id] += v ?? 0;
    }
  });
  return reward;
}

export function upgradeTalent(saveManager: SaveManager, branchId: TalentBranchId): boolean {
  const s = saveManager.get();
  const spec = getTalentSpec(branchId);
  if (!spec || !isTalentNodeUnlocked(branchId, s.talents)) return false;
  const curRank = clampTalentRank(s.talents[branchId], spec.maxRank);
  const cost = getNextTalentCost(curRank, branchId);
  if (cost === null) return false;
  const available = computeAvailableTalentStars(s.levelStars, s.ironCleared, s.talents);
  if (available < cost) return false;

  saveManager.update((draft) => {
    draft.talents[branchId] = curRank + 1;
  });
  return true;
}

export function resetTalents(saveManager: SaveManager): boolean {
  const s = saveManager.get();
  const hasAny = Object.values(s.talents).some((r) => clampTalentRank(r) > 0);
  if (!hasAny) return false;
  saveManager.update((draft) => {
    draft.talents = createInitialTalents();
  });
  return true;
}

export function unlockHeroWithGems(saveManager: SaveManager, heroId: HeroId): boolean {
  const s = saveManager.get();
  if (s.unlockedHeroes.includes(heroId)) return false;
  const cost = HEROES[heroId].gemUnlockCost;
  if (cost <= 0 || s.emeraldGems < cost) return false;
  saveManager.update((draft) => {
    draft.emeraldGems -= cost;
    if (!draft.unlockedHeroes.includes(heroId)) draft.unlockedHeroes.push(heroId);
    if (!draft.discoveredIds.includes(heroId)) draft.discoveredIds.push(heroId);
    draft.selectedHero = heroId;
  });
  return true;
}

export function grantCampaignHeroUnlocks(saveManager: SaveManager, clearedLevelId: number): HeroId[] {
  const s = saveManager.get();
  const unlocked: HeroId[] = [];
  for (const h of Object.values(HEROES)) {
    if (clearedLevelId >= h.unlockLevel && !s.unlockedHeroes.includes(h.id)) {
      unlocked.push(h.id);
    }
  }
  if (unlocked.length === 0) return [];
  saveManager.update((draft) => {
    for (const id of unlocked) {
      if (!draft.unlockedHeroes.includes(id)) draft.unlockedHeroes.push(id);
      if (!draft.discoveredIds.includes(id)) draft.discoveredIds.push(id);
    }
  });
  return unlocked;
}

export const JOURNAL_REWARD_GEMS = 10;

export interface JournalEntry {
  id: string;
  category: 'tower' | 'hero' | 'enemy';
  modelName: ModelName;
  nameKey: string;
  descKey: string;
  tacticKey: string;
  statSummary: string;
}

export function getJournalCatalog(locale: Locale = 'tr'): JournalEntry[] {
  const isTr = locale === 'tr';
  const towers: JournalEntry[] = TOWER_LIST.map((tw) => ({
    id: tw.id,
    category: 'tower',
    modelName: `tower_${tw.id}_t1` as ModelName,
    nameKey: tw.nameKey,
    descKey: tw.roleKey,
    tacticKey: `codex.tactic.tower.${tw.id}`,
    statSummary: isTr
      ? `Hasar ${tw.tier1.damage} · Menzil ${tw.tier1.range}m · ${tw.tier1.cost}`
      : `DMG ${tw.tier1.damage} · RNG ${tw.tier1.range}m · ${tw.tier1.cost}`,
  }));
  const heroModelMap: Record<HeroId, ModelName> = {
    boz_pence: 'hero_bear',
    kizil_kuyruk: 'hero_fox',
    kaya_dis: 'hero_boar',
    ay_kurdu: 'hero_wolf',
  };
  const heroes: JournalEntry[] = HERO_LIST.map((h) => ({
    id: h.id,
    category: 'hero',
    modelName: heroModelMap[h.id],
    nameKey: h.nameKey,
    descKey: h.descKey,
    tacticKey: `codex.tactic.hero.${h.id}`,
    statSummary: isTr
      ? `Can ${h.maxHp} · Hasar ${h.damage} · Hedef ${h.blockCap}`
      : `HP ${h.maxHp} · DMG ${h.damage} · TGT ${h.blockCap}`,
  }));
  const enemies: JournalEntry[] = ENEMY_LIST.map((e) => ({
    id: e.id,
    category: 'enemy',
    modelName: `enemy_${e.id}` as ModelName,
    nameKey: e.nameKey,
    descKey: e.descKey,
    tacticKey: `codex.tactic.enemy.${e.id}`,
    statSummary: isTr
      ? `Can ${e.baseHp} · Hız ${e.speed} · Zırh %${Math.round(e.armor * 100)}`
      : `HP ${e.baseHp} · SPD ${e.speed} · Armor ${Math.round(e.armor * 100)}%`,
  }));
  return [...towers, ...heroes, ...enemies];
}

export function discoverJournalEntries(saveManager: SaveManager, ids: readonly string[]): void {
  const cur = saveManager.get().discoveredIds;
  const toAdd = ids.filter((id) => !cur.includes(id));
  if (toAdd.length === 0) return;
  saveManager.update((draft) => {
    for (const id of toAdd) {
      if (!draft.discoveredIds.includes(id)) draft.discoveredIds.push(id);
    }
  });
}

export function claimJournalReward(saveManager: SaveManager, entryId: string): boolean {
  const s = saveManager.get();
  if (!s.discoveredIds.includes(entryId)) return false;
  if (s.claimedJournalIds.includes(entryId)) return false;
  saveManager.update((draft) => {
    draft.claimedJournalIds.push(entryId);
    draft.emeraldGems += JOURNAL_REWARD_GEMS;
  });
  return true;
}

export function unlockOrEquipHat(saveManager: SaveManager, hatId: HatId): 'equipped' | 'unlocked' | 'insufficient' {
  const spec = HAT_SPECS.find((h) => h.id === hatId);
  if (!spec) return 'insufficient';
  const s = saveManager.get();
  if (s.unlockedHats.includes(hatId) || spec.currency === 'free') {
    saveManager.update((d) => {
      if (!d.unlockedHats.includes(hatId)) d.unlockedHats.push(hatId);
      d.equippedHat = hatId;
    });
    return 'equipped';
  }
  if (spec.currency === 'oak' && s.oakCoins < spec.cost) return 'insufficient';
  if (spec.currency === 'gem' && s.emeraldGems < spec.cost) return 'insufficient';
  saveManager.update((d) => {
    if (spec.currency === 'oak') d.oakCoins -= spec.cost;
    else d.emeraldGems -= spec.cost;
    if (!d.unlockedHats.includes(hatId)) d.unlockedHats.push(hatId);
    d.equippedHat = hatId;
  });
  return 'unlocked';
}

export function unlockOrEquipAura(saveManager: SaveManager, auraId: AuraId): 'equipped' | 'unlocked' | 'insufficient' {
  const spec = AURA_SPECS.find((a) => a.id === auraId);
  if (!spec) return 'insufficient';
  const s = saveManager.get();
  if (s.unlockedAuras.includes(auraId) || spec.currency === 'free') {
    saveManager.update((d) => {
      if (!d.unlockedAuras.includes(auraId)) d.unlockedAuras.push(auraId);
      d.equippedAura = auraId;
    });
    return 'equipped';
  }
  if (spec.currency === 'oak' && s.oakCoins < spec.cost) return 'insufficient';
  if (spec.currency === 'gem' && s.emeraldGems < spec.cost) return 'insufficient';
  saveManager.update((d) => {
    if (spec.currency === 'oak') d.oakCoins -= spec.cost;
    else d.emeraldGems -= spec.cost;
    if (!d.unlockedAuras.includes(auraId)) d.unlockedAuras.push(auraId);
    d.equippedAura = auraId;
  });
  return 'unlocked';
}

export function unlockOrEquipBanner(
  saveManager: SaveManager,
  bannerId: BannerId,
): 'equipped' | 'unlocked' | 'insufficient' {
  const spec = BANNER_SPECS.find((b) => b.id === bannerId);
  if (!spec) return 'insufficient';
  const s = saveManager.get();
  if (s.unlockedBanners.includes(bannerId) || spec.currency === 'free') {
    saveManager.update((d) => {
      if (!d.unlockedBanners.includes(bannerId)) d.unlockedBanners.push(bannerId);
      d.equippedBanner = bannerId;
    });
    return 'equipped';
  }
  if (spec.currency === 'oak' && s.oakCoins < spec.cost) return 'insufficient';
  if (spec.currency === 'gem' && s.emeraldGems < spec.cost) return 'insufficient';
  saveManager.update((d) => {
    if (spec.currency === 'oak') d.oakCoins -= spec.cost;
    else d.emeraldGems -= spec.cost;
    if (!d.unlockedBanners.includes(bannerId)) d.unlockedBanners.push(bannerId);
    d.equippedBanner = bannerId;
  });
  return 'unlocked';
}

export interface DailyQuestSpec {
  id: string;
  metric: keyof DailyQuestProgressState;
  target: number;
  titleKey: string;
  rewardOak: number;
  rewardGems: number;
}

export const DAILY_QUEST_BONUS_GEMS = 25;

export const DAILY_QUESTS: readonly DailyQuestSpec[] = [
  { id: 'dq_kills', metric: 'kills', target: 25, titleKey: 'quest.daily.kills', rewardOak: 90, rewardGems: 5 },
  { id: 'dq_builds', metric: 'builds', target: 6, titleKey: 'quest.daily.builds', rewardOak: 75, rewardGems: 5 },
  { id: 'dq_skills', metric: 'skills', target: 4, titleKey: 'quest.daily.skills', rewardOak: 70, rewardGems: 8 },
  { id: 'dq_wins', metric: 'wins', target: 1, titleKey: 'quest.daily.wins', rewardOak: 110, rewardGems: 10 },
];

export function recordDailyQuestProgress(
  saveManager: SaveManager,
  deltas: Partial<DailyQuestProgressState>,
  nowMs = Date.now(),
): void {
  saveManager.rollDailyCounters(nowMs);
  saveManager.update((d) => {
    if (deltas.kills) {
      d.dailyQuestsProgress.kills += deltas.kills;
    }
    if (deltas.builds) {
      d.dailyQuestsProgress.builds += deltas.builds;
      d.totalTowersBuilt += deltas.builds;
    }
    if (deltas.skills) {
      d.dailyQuestsProgress.skills += deltas.skills;
      d.totalSkillsCast += deltas.skills;
    }
    if (deltas.wins) {
      d.dailyQuestsProgress.wins += deltas.wins;
      d.totalBattlesWon += deltas.wins;
    }
  });
}

export function claimDailyQuest(saveManager: SaveManager, questId: string, nowMs = Date.now()): boolean {
  saveManager.rollDailyCounters(nowMs);
  const spec = DAILY_QUESTS.find((q) => q.id === questId);
  if (!spec) return false;
  const s = saveManager.get();
  if (s.dailyQuestsClaimed.includes(questId)) return false;
  if ((s.dailyQuestsProgress[spec.metric] ?? 0) < spec.target) return false;
  saveManager.update((d) => {
    d.dailyQuestsClaimed.push(questId);
    d.oakCoins += spec.rewardOak;
    d.emeraldGems += spec.rewardGems;
  });
  return true;
}

export function claimDailyQuestBonus(saveManager: SaveManager, nowMs = Date.now()): boolean {
  saveManager.rollDailyCounters(nowMs);
  const s = saveManager.get();
  if (s.dailyQuestBonusClaimed) return false;
  if (s.dailyQuestsClaimed.length < DAILY_QUESTS.length) return false;
  saveManager.update((d) => {
    d.dailyQuestBonusClaimed = true;
    d.emeraldGems += DAILY_QUEST_BONUS_GEMS;
    d.cardShards.badger = (d.cardShards.badger ?? 0) + 2;
    d.cardShards.falcon = (d.cardShards.falcon ?? 0) + 2;
  });
  return true;
}

export interface AchievementSpec {
  id: string;
  titleKey: string;
  descKey: string;
  target: number;
  rewardOak: number;
  rewardGems: number;
  unlockHat?: HatId;
  measure: (save: SaveState) => number;
}

export const ACHIEVEMENTS: readonly AchievementSpec[] = [
  {
    id: 'ach_stars_10',
    titleKey: 'ach.stars_10.title',
    descKey: 'ach.stars_10.desc',
    target: 10,
    rewardOak: 140,
    rewardGems: 15,
    measure: (s) => computeTotalEarnedStars(s.levelStars, s.ironCleared),
  },
  {
    id: 'ach_stars_30',
    titleKey: 'ach.stars_30.title',
    descKey: 'ach.stars_30.desc',
    target: 30,
    rewardOak: 260,
    rewardGems: 35,
    measure: (s) => computeTotalEarnedStars(s.levelStars, s.ironCleared),
  },
  {
    id: 'ach_discover_14',
    titleKey: 'ach.discover_14.title',
    descKey: 'ach.discover_14.desc',
    target: 14,
    rewardOak: 120,
    rewardGems: 20,
    unlockHat: 'antlers',
    measure: (s) => s.discoveredIds.length,
  },
  {
    id: 'ach_kills_200',
    titleKey: 'ach.kills_200.title',
    descKey: 'ach.kills_200.desc',
    target: 200,
    rewardOak: 200,
    rewardGems: 25,
    measure: (s) => s.seasonPassKills,
  },
  {
    id: 'ach_iron_3',
    titleKey: 'ach.iron_3.title',
    descKey: 'ach.iron_3.desc',
    target: 3,
    rewardOak: 220,
    rewardGems: 40,
    measure: (s) => Object.values(s.ironCleared).filter(Boolean).length,
  },
  {
    id: 'ach_expedition_1',
    titleKey: 'ach.expedition_1.title',
    descKey: 'ach.expedition_1.desc',
    target: 1,
    rewardOak: 180,
    rewardGems: 30,
    measure: (s) => s.expeditionsCompleted,
  },
  {
    id: 'ach_cards_3',
    titleKey: 'ach.cards_3.title',
    descKey: 'ach.cards_3.desc',
    target: 3,
    rewardOak: 150,
    rewardGems: 20,
    measure: (s) => Object.values(s.cardLevels).filter((lvl) => lvl >= 3).length,
  },
  {
    id: 'ach_acc_5',
    titleKey: 'ach.acc_5.title',
    descKey: 'ach.acc_5.desc',
    target: 5,
    rewardOak: 180,
    rewardGems: 25,
    measure: (s) =>
      s.unlockedHats.filter((h) => h !== 'none').length +
      s.unlockedAuras.filter((a) => a !== 'none').length +
      s.unlockedBanners.filter((b) => b !== 'none').length,
  },
  {
    id: 'ach_stars_60',
    titleKey: 'ach.stars_60.title',
    descKey: 'ach.stars_60.desc',
    target: 60,
    rewardOak: 400,
    rewardGems: 60,
    measure: (s) => computeTotalEarnedStars(s.levelStars, s.ironCleared),
  },
  {
    id: 'ach_stars_100',
    titleKey: 'ach.stars_100.title',
    descKey: 'ach.stars_100.desc',
    target: 100,
    rewardOak: 750,
    rewardGems: 120,
    measure: (s) => computeTotalEarnedStars(s.levelStars, s.ironCleared),
  },
  {
    id: 'ach_kills_1000',
    titleKey: 'ach.kills_1000.title',
    descKey: 'ach.kills_1000.desc',
    target: 1000,
    rewardOak: 450,
    rewardGems: 75,
    measure: (s) => s.seasonPassKills,
  },
  {
    id: 'ach_clear_36',
    titleKey: 'ach.clear_36.title',
    descKey: 'ach.clear_36.desc',
    target: 1,
    rewardOak: 1000,
    rewardGems: 200,
    unlockHat: 'crown',
    measure: (s) => ((s.levelStars[36] ?? 0) > 0 ? 1 : 0),
  },
];

export function claimAchievement(saveManager: SaveManager, achievementId: string): boolean {
  const spec = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!spec) return false;
  const s = saveManager.get();
  if (s.claimedAchievementIds.includes(achievementId)) return false;
  if (spec.measure(s) < spec.target) return false;
  saveManager.update((d) => {
    d.claimedAchievementIds.push(achievementId);
    d.oakCoins += spec.rewardOak;
    d.emeraldGems += spec.rewardGems;
    if (spec.unlockHat && !d.unlockedHats.includes(spec.unlockHat)) {
      d.unlockedHats.push(spec.unlockHat);
    }
  });
  return true;
}

export function countPendingJournalClaims(save: SaveState): number {
  const questReady = DAILY_QUESTS.filter(
    (q) => !save.dailyQuestsClaimed.includes(q.id) && (save.dailyQuestsProgress[q.metric] ?? 0) >= q.target,
  ).length;
  const questBonus =
    !save.dailyQuestBonusClaimed && save.dailyQuestsClaimed.length >= DAILY_QUESTS.length ? 1 : 0;
  const achReady = ACHIEVEMENTS.filter(
    (a) => !save.claimedAchievementIds.includes(a.id) && a.measure(save) >= a.target,
  ).length;
  const codexReady = save.discoveredIds.filter((id) => !save.claimedJournalIds.includes(id)).length;
  return questReady + questBonus + achReady + codexReady;
}

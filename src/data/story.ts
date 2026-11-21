import type { HeroId } from './enemies.ts';

export interface StoryBeat {
  id: string;
  levelId: number;
  speaker: HeroId;
  badgeKey: string;
  titleKey: string;
  bodyKey: string;
  isBossIntro?: boolean;
}

export const CAMPAIGN_STORY_BEATS: readonly StoryBeat[] = [
  {
    id: 'story_ch1',
    levelId: 1,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.ch1',
    titleKey: 'story.ch1.title',
    bodyKey: 'story.ch1.body',
  },
  {
    id: 'story_boss_3',
    levelId: 3,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss3.title',
    bodyKey: 'story.boss3.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch2',
    levelId: 4,
    speaker: 'kizil_kuyruk',
    badgeKey: 'story.badge.ch2',
    titleKey: 'story.ch2.title',
    bodyKey: 'story.ch2.body',
  },
  {
    id: 'story_ch3',
    levelId: 7,
    speaker: 'kaya_dis',
    badgeKey: 'story.badge.ch3',
    titleKey: 'story.ch3.title',
    bodyKey: 'story.ch3.body',
  },
  {
    id: 'story_ch4',
    levelId: 10,
    speaker: 'ay_kurdu',
    badgeKey: 'story.badge.ch4',
    titleKey: 'story.ch4.title',
    bodyKey: 'story.ch4.body',
  },
  {
    id: 'story_boss_12',
    levelId: 12,
    speaker: 'ay_kurdu',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss12.title',
    bodyKey: 'story.boss12.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch5',
    levelId: 13,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.ch5',
    titleKey: 'story.ch5.title',
    bodyKey: 'story.ch5.body',
  },
  {
    id: 'story_boss_16',
    levelId: 16,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss16.title',
    bodyKey: 'story.boss16.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch6',
    levelId: 17,
    speaker: 'kizil_kuyruk',
    badgeKey: 'story.badge.ch6',
    titleKey: 'story.ch6.title',
    bodyKey: 'story.ch6.body',
  },
  {
    id: 'story_boss_20',
    levelId: 20,
    speaker: 'kizil_kuyruk',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss20.title',
    bodyKey: 'story.boss20.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch7',
    levelId: 21,
    speaker: 'ay_kurdu',
    badgeKey: 'story.badge.ch7',
    titleKey: 'story.ch7.title',
    bodyKey: 'story.ch7.body',
  },
  {
    id: 'story_boss_24',
    levelId: 24,
    speaker: 'ay_kurdu',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss24.title',
    bodyKey: 'story.boss24.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch8',
    levelId: 25,
    speaker: 'kaya_dis',
    badgeKey: 'story.badge.ch8',
    titleKey: 'story.ch8.title',
    bodyKey: 'story.ch8.body',
  },
  {
    id: 'story_boss_28',
    levelId: 28,
    speaker: 'ay_kurdu',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss28.title',
    bodyKey: 'story.boss28.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch9',
    levelId: 29,
    speaker: 'kaya_dis',
    badgeKey: 'story.badge.ch9',
    titleKey: 'story.ch9.title',
    bodyKey: 'story.ch9.body',
  },
  {
    id: 'story_boss_32',
    levelId: 32,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss32.title',
    bodyKey: 'story.boss32.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch10',
    levelId: 33,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.ch10',
    titleKey: 'story.ch10.title',
    bodyKey: 'story.ch10.body',
  },
  {
    id: 'story_boss_36',
    levelId: 36,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss36.title',
    bodyKey: 'story.boss36.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch11',
    levelId: 37,
    speaker: 'kizil_kuyruk',
    badgeKey: 'story.badge.ch11',
    titleKey: 'story.ch11.title',
    bodyKey: 'story.ch11.body',
  },
  {
    id: 'story_boss_40',
    levelId: 40,
    speaker: 'kaya_dis',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss40.title',
    bodyKey: 'story.boss40.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch12',
    levelId: 41,
    speaker: 'ay_kurdu',
    badgeKey: 'story.badge.ch12',
    titleKey: 'story.ch12.title',
    bodyKey: 'story.ch12.body',
  },
  {
    id: 'story_boss_45',
    levelId: 45,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.boss',
    titleKey: 'story.boss45.title',
    bodyKey: 'story.boss45.body',
    isBossIntro: true,
  },
  {
    id: 'story_ch13',
    levelId: 46,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.ch13',
    titleKey: 'story.ch13.title',
    bodyKey: 'story.ch13.body',
  },
  {
    id: 'story_boss_50',
    levelId: 50,
    speaker: 'boz_pence',
    badgeKey: 'story.badge.finale',
    titleKey: 'story.boss50.title',
    bodyKey: 'story.boss50.body',
    isBossIntro: true,
  },
];

export function getStoryBeatForLevel(levelId: number): StoryBeat | null {
  return CAMPAIGN_STORY_BEATS.find((b) => b.levelId === levelId) ?? null;
}

const CUSTOM_BOSS_TITLES: Readonly<Record<number, string>> = {
  20: 'boss.title.20',
  24: 'boss.title.24',
  28: 'boss.title.28',
  32: 'boss.title.32',
  36: 'boss.title.36',
  40: 'boss.title.40',
  45: 'boss.title.45',
  50: 'boss.title.50',
};

export function getBossDisplayNameKey(levelId: number, fallbackEnemyNameKey: string): string {
  return CUSTOM_BOSS_TITLES[levelId] ?? fallbackEnemyNameKey;
}

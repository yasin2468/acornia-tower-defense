import './styles.css';
import { ONLINE_ARENA_ENABLED } from './config/features.ts';
import { JuiceController } from './core/JuiceController.ts';
import {
  FIXED_DT,
  SimulationEngine,
  computeVictoryRewards,
  type SimEvent,
} from './core/SimulationEngine.ts';
import { getBannerSpec } from './data/accessories.ts';
import {
  DAILY_CHALLENGE_GEMS,
  DAILY_CHALLENGE_OAK,
  DAILY_MUTATORS,
  getDailyChallengeSpec,
} from './data/daily.ts';
import { ENEMIES, HEROES } from './data/enemies.ts';
import { LEVELS, isLevelUnlocked, type LevelSpec } from './data/levels.ts';
import {
  EXPEDITION_CLEAR_GEMS,
  EXPEDITION_CLEAR_OAK,
  advanceExpeditionStage,
  buildExpeditionLevelSpec,
} from './data/roguelike.ts';
import { recordMultiplayerOutcome } from './data/season.ts';
import { t, tParams } from './i18n/locales.ts';
import { SoundEngine } from './audio/SoundEngine.ts';
import {
  MODEL_NAMES,
  ensureModelsLoaded,
  getLevelModelDependencies,
  preloadBootModels,
  warmRemainingModelsInBackground,
  type ModelName,
} from './rendering/AssetLoader.ts';
import { SceneManager } from './rendering/SceneManager.ts';
import {
  AdService,
  AnalyticsService,
  BillingService,
  HapticsService,
  RemoteConfigService,
} from './services/CommercialServices.ts';
import { NetworkService, type SocialEmoteId } from './services/NetworkService.ts';
import {
  discoverJournalEntries,
  getJournalCatalog,
  grantCampaignHeroUnlocks,
  recordDailyQuestProgress,
} from './services/ProgressionService.ts';
import { SaveManager, type BattleCheckpointState, type DailyMutatorId } from './services/SaveManager.ts';
import { BattleView } from './ui/BattleView.ts';
import { MetaView } from './ui/MetaView.ts';
import { UI_ICON_URLS } from './ui/icons.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;
const shell = document.getElementById('phone-shell') as HTMLElement;

const urlParams = new URLSearchParams(window.location.search);
// ?promo=1 sahne modu yalnızca geliştirme build'inde geçerli; üretimde parametre sessizce yok sayılır.
const isPromoMode = import.meta.env.DEV && urlParams.get('promo') === '1';

const saveManager = new SaveManager();
const adService = new AdService(saveManager);
const billingService = new BillingService(saveManager);
const haptics = new HapticsService(saveManager);
const analytics = new AnalyticsService();
const remoteConfig = new RemoteConfigService();
const network = new NetworkService();
const sound = new SoundEngine();
const sceneMgr = new SceneManager(canvas);
const juice = new JuiceController();

sceneMgr.onMortarExplode = () => {
  sound.playExplosion(false);
  juice.triggerMicroHitStop(0.03, 0.1);
};
sceneMgr.onRailgunFire = () => {
  juice.triggerMicroHitStop(0.026, 0.12);
};
sceneMgr.onChainZap = () => sound.playZap();
sceneMgr.onFreezeImpact = () => sound.playFreeze();

const reducedMotionQuery =
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
reducedMotionQuery?.addEventListener?.('change', () => syncAudioAndCameraSettings());

let mode: 'loading' | 'meta' | 'battle' = 'loading';
let activeSim: SimulationEngine | null = null;
let currentLevelId = 1;
let currentIronMode = false;
let currentIsExpedition = false;
let currentEndlessMode = false;
let currentDailyDate: string | undefined;
let currentIsMultiMatch = false;
let victoryRecorded = false;
let lossRecorded = false;
let multiOutcomeRecorded = false;
let killStreakCount = 0;
let lastKillAtMs = 0;
let lastMultiKillAnnounced = 0;
let pendingSeasonKills = 0;
let simAccumulator = 0;

function flushSeasonKills(): void {
  if (pendingSeasonKills <= 0) return;
  const delta = pendingSeasonKills;
  pendingSeasonKills = 0;
  saveManager.rollDailyCounters();
  saveManager.update((d) => {
    d.seasonPassKills += delta;
    d.dailyQuestsProgress.kills += delta;
  });
}

function triggerSocialFeedback(isLocal: boolean, emoteId: SocialEmoteId, x?: number, z?: number): void {
  const loc = saveManager.get().settings.locale;
  sound.playEmote();
  const label = t(loc, `social.${emoteId}`);
  battleView.showBanner(tParams(loc, isLocal ? 'social.sentToast' : 'social.peerToast', { msg: label }), 2.3);
  if ((emoteId === 'pin_build' || emoteId === 'pin_help') && activeSim) {
    const px = x ?? activeSim.hero.x;
    const pz = z ?? activeSim.hero.z;
    sceneMgr.spawnSocialPing(px, pz, emoteId === 'pin_help' ? '#ff6b4f' : '#5ef28e');
  }
}
let lastFrameMs = performance.now();
let lastRenderUiMs = 0;
let lastStatePingMs = 0;

function applyDevUnlock(): void {
  saveManager.update((d) => {
    for (let id = 1; id <= LEVELS.length; id++) {
      d.levelStars[id] = Math.max(d.levelStars[id] ?? 0, 3);
    }
    for (const h of ['boz_pence', 'kizil_kuyruk', 'kaya_dis', 'ay_kurdu'] as const) {
      if (!d.unlockedHeroes.includes(h)) d.unlockedHeroes.push(h);
    }
    for (const entry of getJournalCatalog()) {
      if (!d.discoveredIds.includes(entry.id)) d.discoveredIds.push(entry.id);
    }
  });
}

const metaView = new MetaView(saveManager, adService, billingService, network, {
  onStartLevel: (levelId, ironMode) => void startLevel(levelId, ironMode),
  onStartExpedition: () => void startExpeditionStage(),
  onResumeCheckpoint: (cp) => void resumeFromCheckpoint(cp),
  onDiscardCheckpoint: () => {},
  onStartDailyChallenge: () => void startDailyChallenge(),
  onStartEndlessMode: () => void startEndlessMode(),
  onDevUnlock: import.meta.env.DEV ? () => applyDevUnlock() : undefined,
  onRefresh: () => renderMeta(),
});

const battleView = new BattleView(
  saveManager,
  adService,
  billingService,
  remoteConfig,
  {
    onRestart: () => {
      if (!currentIsMultiMatch && !currentIsExpedition) {
        saveManager.update((d) => {
          d.activeBattleCheckpoint = null;
        });
      }
      if (currentIsExpedition) {
        if (activeSim?.status === 'lost') {
          saveManager.update((d) => {
            d.activeExpedition = null;
          });
          exitToMap();
          return;
        }
        void startExpeditionStage();
        return;
      }
      if (currentEndlessMode) {
        void startEndlessMode();
        return;
      }
      if (currentDailyDate) {
        void startDailyChallenge();
        return;
      }
      void startLevel(currentLevelId, currentIronMode);
    },
    onExitToMap: () => exitToMap(),
    onNextLevel: (nextId) => {
      metaView.selectedLevelId = nextId;
      void startLevel(nextId, false);
    },
    onSettingsChanged: () => syncAudioAndCameraSettings(),
    onSendPvpMerc: (enemyId, cost) => {
      if (!activeSim || activeSim.status !== 'playing' || activeSim.gold < cost) return;
      activeSim.gold -= cost;
      network.sendPvpMerc(enemyId);
    },
    onSendSocial: (emoteId) => {
      const px = activeSim?.hero.x;
      const pz = activeSim?.hero.z;
      network.sendSocialPing(emoteId, px, pz);
      triggerSocialFeedback(true, emoteId, px, pz);
    },
    onPreviewTap: () => {
      sound.playUiTick();
      haptics.impact('light');
    },
    onResetCamera: () => sceneMgr.cameraCtrl.resetView(),
  },
  isPromoMode,
  network,
);

network.onStateChange = () => {
  if (mode === 'meta') renderMeta();
};

network.onMatchStart = (info) => {
  void startLevel(info.levelId, false, info.seed, true);
};

network.onRemoteCommand = (cmd, playerId, tick) => {
  if (mode === 'battle' && activeSim && network.mode === 'coop') {
    activeSim.dispatchRemote(cmd, playerId, tick);
  }
};

network.onPvpIncoming = (enemyId) => {
  if (mode === 'battle' && activeSim && network.mode === 'pvp') {
    activeSim.dispatchRemote({ type: 'SPAWN_PVP_MERC', enemyId }, 'p2');
    const loc = saveManager.get().settings.locale;
    battleView.showBanner(tParams(loc, 'multi.pvpIncoming', { name: t(loc, ENEMIES[enemyId].nameKey) }), 2.4);
  }
};

network.onSocialPing = (emoteId, _fromRole, x, z) => {
  if (mode === 'battle' && activeSim) {
    triggerSocialFeedback(false, emoteId, x, z);
  }
};

network.onPeerState = (peer) => {
  if (mode === 'battle' && activeSim && network.mode === 'pvp' && peer.status === 'lost') {
    activeSim.dispatchRemote({ type: 'FORCE_PVP_VICTORY' }, 'p1');
  }
};

network.onPeerLeft = () => {
  if (mode === 'battle') {
    battleView.showBanner(t(saveManager.get().settings.locale, 'multi.peerLeft'), 3.2);
  }
};

function syncAudioAndCameraSettings(): void {
  const s = saveManager.get().settings;
  sound.setEnabled(s.soundEnabled);
  sound.setMusicEnabled(s.musicEnabled);
  sceneMgr.cameraCtrl.setShakeStrength(s.shakeStrength);
  sceneMgr.setBatterySaver(s.batterySaver30Fps);
  // Reduced Motion: OS preference, or the player dialled shake to 0 %.
  const reduced = Boolean(reducedMotionQuery?.matches) || s.shakeStrength <= 0;
  juice.setReducedMotion(reduced);
  sceneMgr.setReducedMotion(reduced);
  battleView.setReducedMotion(reduced);
  haptics.setReducedMotion(reduced);
  if (activeSim) {
    activeSim.autoStartWaves = s.autoStartWaves;
  }
}

function renderMeta(): void {
  mode = 'meta';
  juice.reset();
  syncAudioAndCameraSettings();
  sound.setBossIntensity(false);
  sound.setMusicTheme('menu');
  metaView.render(uiRoot);
}

async function launchBattleSpec(
  spec: LevelSpec,
  options: {
    ironMode: boolean;
    customSeed?: number;
    isMultiMatch: boolean;
    isExpedition: boolean;
    endlessMode?: boolean;
    mutatorId?: DailyMutatorId;
    dailyDate?: string;
    checkpoint?: BattleCheckpointState;
    allowedTowers?: import('./data/towers.ts').TowerId[];
    relics?: import('./data/roguelike.ts').RelicId[];
    initialBaseHp?: number;
  },
): Promise<void> {
  metaView.disposeTransient();
  sceneMgr.cameraCtrl.resetView(true);
  sound.setBossIntensity(false);
  if (!options.isMultiMatch && network.state !== 'idle') {
    network.leaveRoom();
  }
  currentLevelId = spec.id;
  currentIronMode = options.ironMode;
  currentIsExpedition = options.isExpedition;
  currentEndlessMode = Boolean(options.endlessMode);
  currentDailyDate = options.dailyDate;
  currentIsMultiMatch = options.isMultiMatch;
  victoryRecorded = false;
  lossRecorded = false;
  multiOutcomeRecorded = false;
  killStreakCount = 0;
  lastKillAtMs = 0;
  lastMultiKillAnnounced = 0;
  pendingSeasonKills = 0;
  simAccumulator = 0;
  lastStatePingMs = 0;
  juice.reset();

  if (!options.checkpoint && !options.isMultiMatch && !options.isExpedition) {
    saveManager.update((d) => {
      d.activeBattleCheckpoint = null;
    });
  }

  const save = saveManager.get();
  const heroId = save.selectedHero ?? 'boz_pence';
  const heroModels: ModelName[] =
    heroId === 'kizil_kuyruk'
      ? ['hero_fox']
      : heroId === 'kaya_dis'
        ? ['hero_boar']
        : heroId === 'ay_kurdu'
          ? ['hero_wolf']
          : ['hero_bear', 'hero_bear_viking', 'hero_bear_royal'];
  const deps = getLevelModelDependencies(spec, heroModels, save.equippedHat);
  if (options.endlessMode) {
    for (const m of MODEL_NAMES) {
      if (m.startsWith('enemy_') && !deps.includes(m)) deps.push(m);
    }
  }
  await ensureModelsLoaded(deps);

  const bannerSpec = !options.isMultiMatch ? getBannerSpec(save.equippedBanner) : null;
  const effectiveSpec: LevelSpec =
    bannerSpec?.bonusBaseHp && !options.ironMode && !options.isExpedition
      ? { ...spec, baseHp: spec.baseHp + bannerSpec.bonusBaseHp }
      : spec;

  activeSim = new SimulationEngine(effectiveSpec, {
    seed: options.customSeed,
    ironMode: options.ironMode,
    endlessMode: options.endlessMode,
    mutatorId: options.mutatorId,
    autoStartWaves: save.settings.autoStartWaves,
    cardLevels: save.cardLevels,
    heroId,
    heroClass: save.heroClass,
    talents: options.isMultiMatch ? undefined : save.talents,
    extraStartGold: options.isMultiMatch ? 0 : remoteConfig.get().startGoldDelta + (bannerSpec?.bonusStartGold ?? 0),
    towerDamageBonusPct: bannerSpec?.bonusTowerDmgPct ?? 0,
    rainCooldownReduceSec: bannerSpec?.bonusRainCdSec ?? 0,
    waitForFirstWave: !isPromoMode && !options.isMultiMatch,
    allowedTowers: options.allowedTowers,
    relics: options.relics,
    initialBaseHp: options.initialBaseHp,
  });
  if (options.checkpoint) {
    activeSim.restoreCheckpoint(options.checkpoint);
  }
  if (options.isMultiMatch && network.mode === 'coop') {
    activeSim.onLocalDispatch = (cmd, tick) => network.sendGameCommand(cmd, tick);
  }

  syncAudioAndCameraSettings();
  sound.setMusicTheme(spec.biome);
  discoverJournalEntries(
    saveManager,
    [
      heroId,
      ...spec.waves.flatMap((w) => w.groups.map((g) => g.enemyId)),
    ],
  );
  sceneMgr.loadLevel(
    effectiveSpec,
    save.equippedHat,
    save.heroClass,
    heroId,
    save.equippedAura,
    save.equippedBanner,
  );
  battleView.resetForLevel(spec.id);
  mode = 'battle';
  analytics.track('level_start', { levelId: spec.id, ironMode: options.ironMode, expedition: options.isExpedition });
  battleView.render(uiRoot, activeSim, sceneMgr);
  if (options.mutatorId) {
    const loc = save.settings.locale;
    battleView.showBanner(`${t(loc, `mutator.${options.mutatorId}.name`)}`, 3.6);
  }
}

async function startLevel(
  levelId: number,
  ironMode: boolean,
  customSeed?: number,
  isMultiMatch = false,
): Promise<void> {
  const spec = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
  await launchBattleSpec(spec, { ironMode, customSeed, isMultiMatch, isExpedition: false });
}

async function startDailyChallenge(): Promise<void> {
  const daily = getDailyChallengeSpec();
  const spec = LEVELS.find((l) => l.id === daily.levelId) ?? LEVELS[0];
  await launchBattleSpec(spec, {
    ironMode: false,
    customSeed: daily.seed,
    isMultiMatch: false,
    isExpedition: false,
    mutatorId: daily.mutator.id,
    dailyDate: daily.dateKey,
    allowedTowers: daily.mutator.allowedTowers,
  });
}

async function startEndlessMode(): Promise<void> {
  const save = saveManager.get();
  const chosenId = isLevelUnlocked(metaView.selectedLevelId, save.levelStars) ? metaView.selectedLevelId : 1;
  const spec = LEVELS.find((l) => l.id === chosenId) ?? LEVELS[0];
  await launchBattleSpec(spec, {
    ironMode: false,
    isMultiMatch: false,
    isExpedition: false,
    endlessMode: true,
  });
}

async function resumeFromCheckpoint(cp: BattleCheckpointState): Promise<void> {
  const spec = LEVELS.find((l) => l.id === cp.levelId) ?? LEVELS[0];
  const mutSpec = cp.mutatorId ? DAILY_MUTATORS[cp.mutatorId] : undefined;
  await launchBattleSpec(spec, {
    ironMode: cp.ironMode,
    endlessMode: cp.endlessMode,
    mutatorId: cp.mutatorId,
    dailyDate: cp.dailyDate,
    isMultiMatch: false,
    isExpedition: false,
    allowedTowers: mutSpec?.allowedTowers,
    checkpoint: cp,
  });
}

async function startExpeditionStage(): Promise<void> {
  const run = saveManager.get().activeExpedition;
  if (!run || run.pendingRelicChoices.length > 0) {
    metaView.activeTab = 'map';
    metaView.showExpeditionModal = Boolean(run?.pendingRelicChoices.length);
    renderMeta();
    return;
  }
  const spec = buildExpeditionLevelSpec(run);
  await launchBattleSpec(spec, {
    ironMode: false,
    customSeed: run.seed + run.stageIndex * 97,
    isMultiMatch: false,
    isExpedition: true,
    allowedTowers: run.allowedTowers,
    relics: run.relics,
    initialBaseHp: run.hp,
  });
}

function exitToMap(): void {
  const nextSelectedAfterWin =
    !currentIsExpedition && !currentEndlessMode && !currentDailyDate && activeSim?.status === 'won'
      ? Math.min(LEVELS.length, currentLevelId + 1)
      : null;
  flushSeasonKills();
  sound.setBossIntensity(false);
  if (network.state !== 'idle') {
    network.leaveRoom();
  }
  if (currentIsExpedition && activeSim?.status === 'lost') {
    saveManager.update((d) => {
      d.activeExpedition = null;
    });
  }
  const activeRun = saveManager.get().activeExpedition;
  currentIsExpedition = false;
  activeSim = null;
  metaView.activeTab = 'map';
  if (nextSelectedAfterWin !== null) {
    metaView.selectedLevelId = nextSelectedAfterWin;
  }
  metaView.showExpeditionModal = Boolean(activeRun);
  renderMeta();
}

function processBattleEvents(events: SimEvent[]): void {
  const loc = saveManager.get().settings.locale;
  let questBuilds = 0;
  let questSkills = 0;
  let questWins = 0;
  for (const ev of events) {
    if (ev.type === 'TOWER_BUILT') {
      sound.playBuild();
      haptics.impact('light');
      questBuilds += 1;
    } else if (ev.type === 'TOWER_UPGRADED') {
      sound.playUpgrade();
      haptics.impact('medium');
      questBuilds += 1;
    } else if (ev.type === 'STUMP_CLEARED') {
      sound.playWoodBreak();
      haptics.impact('light');
    } else if (ev.type === 'SMOKE_CLEARED') {
      sound.playGust();
    } else if (ev.type === 'TOWER_SOLD') {
      sound.playCoin();
    } else if (ev.type === 'BASE_HIT') {
      sound.playBaseHit();
      haptics.impact('heavy');
      juice.triggerHitStop(0.075, 0.06);
      battleView.triggerBaseHitFlash(ev.damage);
    } else if (ev.type === 'TOWER_FIRED') {
      const kind =
        ev.towerId === 'tortoise'
          ? 'cannon'
          : ev.towerId === 'badger'
            ? 'acid'
            : ev.towerId === 'beaver'
              ? 'mortar'
              : ev.towerId === 'lynx'
                ? 'rune'
                : ev.towerId === 'owl'
                  ? 'emp'
                  : ev.towerId === 'hedgehog'
                    ? 'heavy'
                    : ev.towerId === 'falcon'
                      ? 'falcon'
                      : 'arrow';
      sound.playShoot(kind);
    } else if (ev.type === 'PROJECTILE_IMPACT') {
      if (ev.aoeRadius > 0) {
        if (ev.towerId === 'badger') sound.playAcidSplash();
        else if (ev.towerId === 'tortoise') sound.playSeismicSlam();
      }
      if (ev.isArmorBreak) {
        sound.playArmorBreak();
      }
    } else if (ev.type === 'ENEMY_HIT') {
      sound.playHit(ev.isCrit, ev.armorBroken, Boolean(ev.heavy), Boolean(ev.resisted), ev.impactKind);
      const isCritHit = ev.isCrit || ev.armorBroken;
      if (isCritHit) {
        juice.triggerHitStop(0.052, 0.06);
        haptics.impact('medium');
      } else if (ev.heavy && !ev.resisted) {
        juice.triggerMicroHitStop(0.028, 0.1);
      }
      const dmgKind = isCritHit
        ? 'crit'
        : ev.resisted
          ? 'resisted'
          : ev.heavy || ev.damage >= 35
            ? 'heavy'
            : 'normal';
      const dmgText =
        dmgKind === 'crit'
          ? `${t(loc, 'combat.critTag')} ${ev.damage}!`
          : dmgKind === 'resisted'
            ? `(${ev.damage})`
            : `${ev.damage}`;
      battleView.addFloatingDamage(ev.x, ev.z, dmgText, dmgKind, ev.enemyId, ev.damage);
      if (ev.armorBroken) {
        battleView.addFloatingDamage(ev.x, ev.z, t(loc, 'combat.armorBreak'), 'status', ev.enemyId);
      } else if (ev.froze) {
        battleView.addFloatingDamage(ev.x, ev.z, t(loc, 'combat.frozen'), 'status', ev.enemyId);
      } else if (ev.stunned) {
        battleView.addFloatingDamage(ev.x, ev.z, t(loc, 'combat.stunned'), 'status', ev.enemyId);
      }
    } else if (ev.type === 'GUARD_ATTACK') {
      sound.playMeleeClash();
    } else if (ev.type === 'ENEMY_KILLED') {
      const killNowMs = performance.now();
      if (killNowMs - lastKillAtMs <= 550) {
        killStreakCount += 1;
      } else {
        killStreakCount = 1;
        lastMultiKillAnnounced = 0;
      }
      lastKillAtMs = killNowMs;
      pendingSeasonKills += 1;
      sound.playScrapBreak(killStreakCount);
      sound.playCoin(killStreakCount);
      if (killStreakCount >= 3 && killStreakCount > lastMultiKillAnnounced) {
        lastMultiKillAnnounced = killStreakCount;
        sound.playMultiKillChime(killStreakCount);
        battleView.addFloatingDamage(
          ev.x,
          ev.z,
          tParams(loc, 'combat.multiKill', { count: killStreakCount }),
          'multikill',
        );
      }
      if (ev.isBoss) {
        juice.triggerHitStop(0.095, 0.05);
        haptics.impact('heavy');
        sound.playExplosion(true);
      } else if (ev.heavy || ev.bounty >= 10) {
        juice.triggerMicroHitStop(0.026, 0.12);
      }
      battleView.addFloatingDamage(ev.x, ev.z, `+${ev.bounty}`, 'gold');
    } else if (ev.type === 'PINECONE_RAIN') {
      juice.triggerMicroHitStop(0.04, 0.08);
      sound.playPineconeBarrage();
      haptics.impact('medium');
      battleView.addFloatingDamage(ev.x, ev.z, t(loc, 'skill.rain'), 'skill');
      questSkills += 1;
    } else if (ev.type === 'ACORN_MAGNET') {
      sound.playMagnetCast();
      haptics.impact('light');
      battleView.addFloatingDamage(ev.x, ev.z, t(loc, 'skill.magnet'), 'skill');
      questSkills += 1;
    } else if (ev.type === 'REINFORCEMENTS_SUMMONED') {
      sound.playReinforcementsHorn();
      haptics.impact('medium');
      battleView.addFloatingDamage(ev.x, ev.z, t(loc, 'skill.reinforcements'), 'skill');
      questSkills += 1;
    } else if (ev.type === 'HERO_RALLY') {
      sound.playHeroBark(activeSim?.heroId ?? 'boz_pence');
    } else if (ev.type === 'BARREL_EXPLODED') {
      juice.triggerMicroHitStop(0.04, 0.08);
      sound.playExplosion(true);
    } else if (ev.type === 'HERO_CLAW_SHOCK') {
      const hId = ev.heroId ?? activeSim?.heroId ?? 'boz_pence';
      if (hId === 'ay_kurdu') {
        sound.playHeroAttack('ay_kurdu');
        sound.playFreeze();
      } else if (hId === 'kaya_dis') {
        sound.playSeismicSlam();
      } else if (hId === 'kizil_kuyruk') {
        sound.playAcidSplash();
      } else {
        sound.playHeroSlash(true);
      }
    } else if (ev.type === 'HERO_ATTACK') {
      const hId = ev.heroId ?? activeSim?.heroId ?? 'boz_pence';
      sound.playHeroAttack(hId);
    } else if (ev.type === 'HERO_ULTIMATE') {
      juice.triggerMicroHitStop(0.042, 0.08);
      sound.playHeroUltimate(ev.variant);
      haptics.impact('medium');
      battleView.addFloatingDamage(ev.x, ev.z, t(loc, `skill.hero.${ev.variant}`), 'skill');
      questSkills += 1;
    } else if (ev.type === 'HERO_LEVELED') {
      sound.playUpgrade();
      if (activeSim?.heroId === 'boz_pence' && activeSim.heroClass === 'auto' && (ev.level === 2 || ev.level === 4)) {
        battleView.showBanner(`${t(loc, 'hero.evolvedBanner')} (Sv.${ev.level})`, 2.6);
      }
    } else if (ev.type === 'BOSS_PHASE_TWO') {
      juice.triggerMicroHitStop(0.045, 0.06);
      sound.playBossSiren();
      sound.playExplosion(true);
      haptics.impact('heavy');
      const bossSpec = ENEMIES[ev.bossId ?? 'mega_harvester'];
      battleView.showBanner(
        ev.smokedSlotId ? `${t(loc, bossSpec.descKey)} · ${t(loc, 'tutorial.smokeTip')}` : t(loc, bossSpec.descKey),
        3.8,
      );
    } else if (ev.type === 'WAVE_STARTED') {
      flushSeasonKills();
      if (battleView.tutorialPhase === 'start_wave') {
        battleView.tutorialPhase = 'done';
        saveManager.update((d) => {
          d.tutorialDone = true;
        });
      }
      if (ev.announceEnemy) {
        const enemySpec = ENEMIES[ev.announceEnemy];
        battleView.showBanner(`${t(loc, 'hud.newEnemy')}: ${t(loc, enemySpec.nameKey)}`, 3.4);
      } else if (currentEndlessMode) {
        battleView.showBanner(tParams(loc, 'endless.waveBanner', { wave: ev.waveNumber }), 2.6);
      } else if (currentLevelId === 2 && ev.waveNumber === 1) {
        battleView.showBanner(t(loc, 'tutorial.synergyTip'), 3.8);
      }
    } else if (ev.type === 'WAVE_CLEARED') {
      if (!currentIsMultiMatch && !currentIsExpedition && activeSim && activeSim.status === 'playing') {
        const cp = activeSim.exportCheckpoint({ dailyDate: currentDailyDate });
        saveManager.update((d) => {
          d.activeBattleCheckpoint = cp;
        });
      }
    } else if (ev.type === 'SYNERGY_COMBO') {
      sound.playSynergyCombo(ev.comboId);
      haptics.impact('medium');
      juice.triggerMicroHitStop(0.032, 0.1);
      battleView.addFloatingDamage(
        ev.x,
        ev.z,
        `${t(loc, `synergy.${ev.comboId}.name`)}! +${ev.bonusDamage}`,
        'combo',
      );
    } else if (ev.type === 'GAME_WON' && !victoryRecorded) {
      victoryRecorded = true;
      questWins += 1;
      haptics.impact('medium');
      flushSeasonKills();
      if (network.state === 'in_match' && !multiOutcomeRecorded) {
        multiOutcomeRecorded = true;
        const multiRes = recordMultiplayerOutcome(saveManager, network.mode, true);
        if (multiRes.trophyDelta > 0) {
          metaView.statusNotice = tParams(loc, 'league.winToast', { trophies: multiRes.trophyDelta });
        } else if (multiRes.firstCoopGems > 0) {
          metaView.statusNotice = tParams(loc, 'league.coopFirstToast', { gems: multiRes.firstCoopGems });
        }
      }
      if (currentIsExpedition && activeSim) {
        const run = saveManager.get().activeExpedition;
        if (run) {
          const { nextRun, completed } = advanceExpeditionStage(run, activeSim.baseHp);
          saveManager.update((d) => {
            if (completed) {
              d.oakCoins += EXPEDITION_CLEAR_OAK;
              d.emeraldGems += EXPEDITION_CLEAR_GEMS;
              d.expeditionsCompleted += 1;
              if (!d.unlockedHats.includes('wizard')) d.unlockedHats.push('wizard');
              d.activeExpedition = null;
            } else {
              d.activeExpedition = nextRun;
            }
          });
          if (completed) {
            metaView.statusNotice = t(loc, 'rogue.completedToast');
          }
        }
        analytics.track('expedition_stage_win', { levelId: currentLevelId, stars: ev.stars });
      } else {
        const rewards = computeVictoryRewards(currentLevelId, ev.stars, currentIronMode);
        saveManager.update((d) => {
          d.activeBattleCheckpoint = null;
          if (currentDailyDate) {
            if (!d.completedDailyDates.includes(currentDailyDate)) {
              d.completedDailyDates.push(currentDailyDate);
              d.oakCoins += DAILY_CHALLENGE_OAK;
              d.emeraldGems += DAILY_CHALLENGE_GEMS;
            }
          } else {
            d.levelStars[currentLevelId] = Math.max(d.levelStars[currentLevelId] ?? 0, ev.stars);
            if (currentIronMode) d.ironCleared[currentLevelId] = true;
            d.oakCoins += rewards.oak;
            d.emeraldGems += rewards.gems;
          }
        });
        if (!currentDailyDate) {
          const newlyUnlocked = grantCampaignHeroUnlocks(saveManager, currentLevelId);
          if (newlyUnlocked.length > 0) {
            metaView.statusNotice = tParams(loc, 'hero.select.unlockedToast', {
              name: t(loc, HEROES[newlyUnlocked[0]].nameKey),
            });
          }
        }
        analytics.track('level_win', { levelId: currentLevelId, stars: ev.stars });
      }
    } else if (ev.type === 'GAME_LOST' && !lossRecorded) {
      lossRecorded = true;
      flushSeasonKills();
      if (!currentIsMultiMatch && !currentIsExpedition) {
        saveManager.update((d) => {
          d.activeBattleCheckpoint = null;
          if (currentEndlessMode && activeSim) {
            const survived = Math.max(0, activeSim.currentWaveIndex);
            d.endlessBestWave = Math.max(d.endlessBestWave, survived);
            d.oakCoins += Math.max(1, survived) * 28;
            d.emeraldGems += Math.floor(Math.max(1, survived) / 3) * 4;
          }
        });
      }
      if (network.state === 'in_match' && !multiOutcomeRecorded) {
        multiOutcomeRecorded = true;
        const multiRes = recordMultiplayerOutcome(saveManager, network.mode, false);
        if (multiRes.trophyDelta < 0) {
          metaView.statusNotice = tParams(loc, 'league.lossToast', { trophies: multiRes.trophyDelta });
        }
      }
      if (currentIsExpedition && activeSim?.reviveUsed) {
        saveManager.update((d) => {
          d.activeExpedition = null;
        });
      }
      analytics.track('level_fail', { levelId: currentLevelId, wave: (activeSim?.currentWaveIndex ?? 0) + 1 });
    }
  }
  if (questBuilds > 0 || questSkills > 0 || questWins > 0) {
    recordDailyQuestProgress(saveManager, {
      builds: questBuilds,
      skills: questSkills,
      wins: questWins,
    });
  }
}

const activePointers = new Map<number, { x: number; y: number }>();
let pinchState: { dist: number; midX: number; midY: number } | null = null;
let panGestureActive = false;

function getPinchMetrics(): { dist: number; midX: number; midY: number } | null {
  if (activePointers.size < 2) return null;
  const pts = Array.from(activePointers.values());
  const a = pts[0];
  const b = pts[1];
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    midX: (a.x + b.x) * 0.5,
    midY: (a.y + b.y) * 0.5,
  };
}

let dragHeroState: {
  startX: number;
  startY: number;
  openedSlotId: string | null;
  dragged: boolean;
  lastMoveMs: number;
} | null = null;

function dispatchHeroMove(x: number, z: number): void {
  if (!activeSim) return;
  activeSim.dispatch({ type: 'MOVE_HERO', x, z });
  if (battleView.tutorialPhase === 'move_hero') {
    battleView.tutorialPhase = 'start_wave';
  }
}

canvas.addEventListener('pointerdown', (ev) => {
  if (mode !== 'battle' || !activeSim || battleView.paused || activeSim.status !== 'playing') return;
  activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (activePointers.size >= 2) {
    dragHeroState = null;
    panGestureActive = true;
    pinchState = getPinchMetrics();
    return;
  }
  if (panGestureActive) return;

  const hit = sceneMgr.pickWorld(ev.clientX, ev.clientY);
  if (!hit) return;

  if (battleView.targetingSkill === 'rain') {
    activeSim.dispatch({ type: 'CAST_PINECONE_RAIN', x: hit.x, z: hit.z });
    battleView.targetingSkill = null;
    sceneMgr.updateTargetingReticle(null);
    battleView.showBanner('', 0);
    return;
  }

  if (battleView.targetingSkill === 'hero_leap') {
    activeSim.dispatch({ type: 'CAST_HERO_ULTIMATE', x: hit.x, z: hit.z });
    battleView.targetingSkill = null;
    sceneMgr.updateTargetingReticle(null);
    battleView.showBanner('', 0);
    return;
  }

  if (battleView.targetingSkill === 'guards') {
    activeSim.dispatch({ type: 'CAST_REINFORCEMENTS', x: hit.x, z: hit.z });
    battleView.targetingSkill = null;
    sceneMgr.updateTargetingReticle(null);
    battleView.showBanner('', 0);
    return;
  }

  if (hit.barrelId) {
    activeSim.dispatch({ type: 'DETONATE_BARREL', barrelId: hit.barrelId });
    return;
  }

  if (hit.slotId) {
    const slot = activeSim.slots.get(hit.slotId);
    if (slot?.tower && slot.tower.smokedTimer > 0) {
      activeSim.dispatch({ type: 'CLEAR_SMOKE', slotId: slot.id });
      return;
    }
    const nextSlotId = battleView.selectedSlotId === hit.slotId ? null : hit.slotId;
    battleView.selectedSlotId = nextSlotId;
    battleView.previewTowerId = null;
    dragHeroState = {
      startX: ev.clientX,
      startY: ev.clientY,
      openedSlotId: nextSlotId,
      dragged: false,
      lastMoveMs: 0,
    };
    battleView.render(uiRoot, activeSim, sceneMgr);
    return;
  }

  const hadSelectedSlot = battleView.selectedSlotId !== null;
  if (hadSelectedSlot) {
    battleView.selectedSlotId = null;
    battleView.previewTowerId = null;
    battleView.render(uiRoot, activeSim, sceneMgr);
    if (!sceneMgr.isNearRoad(hit.x, hit.z, 1.65)) {
      return;
    }
  }

  dragHeroState = {
    startX: ev.clientX,
    startY: ev.clientY,
    openedSlotId: null,
    dragged: false,
    lastMoveMs: performance.now(),
  };
  dispatchHeroMove(hit.x, hit.z);
});

canvas.addEventListener('pointermove', (ev) => {
  if (mode !== 'battle' || !activeSim || battleView.paused || activeSim.status !== 'playing') return;
  if (activePointers.has(ev.pointerId)) {
    activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  }
  if (activePointers.size >= 2 && pinchState) {
    const cur = getPinchMetrics();
    if (cur) {
      if (pinchState.dist > 8 && cur.dist > 8) {
        sceneMgr.cameraCtrl.zoomBy(cur.dist / pinchState.dist);
      }
      const dx = cur.midX - pinchState.midX;
      const dy = cur.midY - pinchState.midY;
      const scale = sceneMgr.cameraCtrl.getZoom() * 26;
      sceneMgr.cameraCtrl.addPanDelta(-dx / scale, -dy / scale);
      pinchState = cur;
      panGestureActive = true;
    }
    return;
  }
  if (panGestureActive) return;

  if (battleView.targetingSkill) {
    const hover = sceneMgr.pickWorld(ev.clientX, ev.clientY);
    if (hover) {
      battleView.targetingPoint = { x: hover.x, z: hover.z };
    }
    return;
  }
  if (!dragHeroState) return;
  const distPx = Math.hypot(ev.clientX - dragHeroState.startX, ev.clientY - dragHeroState.startY);
  if (!dragHeroState.dragged && distPx < 12) return;
  dragHeroState.dragged = true;
  if (dragHeroState.openedSlotId && battleView.selectedSlotId === dragHeroState.openedSlotId) {
    battleView.selectedSlotId = null;
    battleView.previewTowerId = null;
    battleView.render(uiRoot, activeSim, sceneMgr);
  }
  const now = performance.now();
  if (now - dragHeroState.lastMoveMs < 65) return;
  dragHeroState.lastMoveMs = now;
  const hit = sceneMgr.pickWorld(ev.clientX, ev.clientY);
  if (hit && !hit.slotId) {
    dispatchHeroMove(hit.x, hit.z);
  }
});

canvas.addEventListener(
  'wheel',
  (ev) => {
    if (mode !== 'battle' || !activeSim || battleView.paused || activeSim.status !== 'playing') return;
    ev.preventDefault();
    sceneMgr.cameraCtrl.zoomBy(ev.deltaY < 0 ? 1.12 : 0.89);
  },
  { passive: false },
);

const clearPointer = (ev: PointerEvent): void => {
  activePointers.delete(ev.pointerId);
  if (activePointers.size < 2) {
    pinchState = null;
  }
  if (activePointers.size === 0) {
    panGestureActive = false;
    dragHeroState = null;
  }
};

window.addEventListener('pointerup', clearPointer);
window.addEventListener('pointercancel', clearPointer);

const resizeObserver = new ResizeObserver(() => {
  sceneMgr.resize(shell.clientWidth, shell.clientHeight);
});
resizeObserver.observe(shell);

window.addEventListener('pointerdown', () => sound.resume(), { passive: true });

function pauseBattleForBackground(): void {
  flushSeasonKills();
  if (mode === 'battle' && activeSim && activeSim.status === 'playing' && network.state !== 'in_match') {
    battleView.paused = true;
    battleView.render(uiRoot, activeSim, sceneMgr);
  }
  sound.suspend();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseBattleForBackground();
  } else {
    sound.resume();
  }
});

window.addEventListener('pagehide', () => pauseBattleForBackground());

function handleHardwareBack(): boolean {
  if (mode === 'battle' && activeSim) {
    if (battleView.targetingSkill) {
      battleView.targetingSkill = null;
      sceneMgr.updateTargetingReticle(null);
      battleView.showBanner('', 0);
      return true;
    }
    if (battleView.selectedSlotId) {
      battleView.selectedSlotId = null;
      battleView.previewTowerId = null;
      battleView.render(uiRoot, activeSim, sceneMgr);
      return true;
    }
    if (activeSim.status === 'playing' && !battleView.paused) {
      battleView.paused = true;
      battleView.render(uiRoot, activeSim, sceneMgr);
      return true;
    }
    return false;
  }
  if (
    metaView.showSettings ||
    metaView.showBestiary ||
    metaView.showPatrolModal ||
    metaView.showExpeditionModal ||
    metaView.showHeroQuickModal ||
    metaView.detailUnit
  ) {
    metaView.showSettings = false;
    metaView.showBestiary = false;
    metaView.showPatrolModal = false;
    metaView.showExpeditionModal = false;
    metaView.showHeroQuickModal = false;
    metaView.detailUnit = null;
    metaView.disposeTransient();
    renderMeta();
    return true;
  }
  if (metaView.activeTab !== 'map') {
    metaView.activeTab = 'map';
    renderMeta();
    return true;
  }
  return false;
}

document.addEventListener('backbutton', (ev) => {
  if (handleHardwareBack()) {
    ev.preventDefault();
  }
});

const capApp = (
  globalThis as {
    Capacitor?: { Plugins?: { App?: { addListener?: (ev: string, fn: () => void) => void } } };
  }
).Capacitor?.Plugins?.App;
capApp?.addListener?.('backButton', () => {
  void handleHardwareBack();
});

window.addEventListener('keydown', (ev) => {
  if (mode !== 'battle' || !activeSim || battleView.paused || activeSim.status !== 'playing') return;
  const tag = (ev.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (ev.key === '1') {
    battleView.triggerHeroSkill(activeSim);
  } else if (ev.key === '2') {
    battleView.triggerRainSkill(activeSim);
  } else if (ev.key === '3') {
    battleView.triggerMagnetSkill(activeSim);
  } else if (ev.key === '4') {
    battleView.triggerGuardsSkill(activeSim);
  } else if (ev.key === 'Escape' && battleView.targetingSkill) {
    battleView.targetingSkill = null;
    sceneMgr.updateTargetingReticle(null);
    battleView.showBanner('', 0);
  }
});

function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
  const batterySaver = saveManager.get().settings.batterySaver30Fps;
  if (batterySaver && rawDt < 1 / 31) {
    return;
  }
  lastFrameMs = nowMs;

  if (mode === 'battle' && activeSim) {
    juice.step(rawDt);
    const simDt = rawDt * juice.getTimeScale();
    if (!battleView.paused && activeSim.status === 'playing') {
      simAccumulator += simDt * battleView.speedMultiplier;
      let steps = 0;
      while (simAccumulator >= FIXED_DT && steps < 10) {
        activeSim.step(FIXED_DT);
        simAccumulator -= FIXED_DT;
        steps += 1;
      }
      const events = activeSim.drainEvents();
      if (events.length > 0) {
        processBattleEvents(events);
        sceneMgr.handleSimEvents(events, activeSim);
      }
      const hasLiveBoss = activeSim.enemies.some((e) => e.isBoss && e.hp > 0);
      sound.setBossIntensity(hasLiveBoss);
    } else {
      sound.setBossIntensity(false);
    }
    if (network.state === 'in_match') {
      network.stepBot(simDt * battleView.speedMultiplier, activeSim);
      if (nowMs - lastStatePingMs >= 500 || activeSim.status !== 'playing') {
        lastStatePingMs = nowMs;
        network.sendStatePing(activeSim);
      }
    }
    battleView.updateTimers(rawDt, activeSim);
    if (battleView.targetingSkill) {
      const spec = battleView.getTargetingVisualSpec(activeSim);
      sceneMgr.updateTargetingReticle(
        battleView.targetingSkill,
        battleView.targetingPoint.x,
        battleView.targetingPoint.z,
        {
          radius: spec.radius,
          color: spec.color,
          showLink: spec.showLink,
          heroX: activeSim.hero.x,
          heroZ: activeSim.hero.z,
        },
      );
    } else {
      sceneMgr.updateTargetingReticle(null);
    }
    const curSave = saveManager.get();
    sceneMgr.sync(
      activeSim,
      battleView.selectedSlotId,
      curSave.equippedHat,
      rawDt,
      simDt,
      battleView.previewTowerId,
      curSave.equippedAura,
    );
    // World overlay (HP ghost bars + damage numbers) runs every frame for smooth pops
    battleView.renderOverlay(activeSim, sceneMgr);

    if (nowMs - lastRenderUiMs >= 40 || activeSim.status !== 'playing') {
      lastRenderUiMs = nowMs;
      battleView.render(uiRoot, activeSim, sceneMgr);
    }
  }
}

function renderLoadingSplash(pct: number): void {
  const loc = saveManager.get().settings.locale;
  uiRoot.innerHTML = `
    <div class="loading-splash">
      <img class="loading-emblem" src="${UI_ICON_URLS.castleShield}" alt="${t(loc, 'app.title')}" />
      <div class="loading-title">${t(loc, 'loading.title')}</div>
      <div class="loading-track">
        <div class="loading-fill" style="width:${pct}%"></div>
      </div>
      <div class="loading-sub">${t(loc, 'loading.models')} ${pct}%</div>
    </div>
  `;
}

function renderBootError(err: unknown): void {
  const loc = saveManager.get().settings.locale;
  const errName = err instanceof Error ? err.name : 'UnknownError';
  uiRoot.innerHTML = `
    <div class="loading-splash">
      <img class="loading-emblem" src="${UI_ICON_URLS.castleShield}" alt="${t(loc, 'app.title')}" />
      <div class="loading-title">${t(loc, 'boot.errorTitle')}</div>
      <div class="loading-sub">${t(loc, 'boot.errorMessage')} (${errName})</div>
      <button class="btn btn-primary" id="btn-boot-retry">${t(loc, 'boot.retry')}</button>
    </div>
  `;
  uiRoot.querySelector<HTMLButtonElement>('#btn-boot-retry')?.addEventListener('click', () => {
    void boot();
  });
}

async function boot(): Promise<void> {
  try {
    renderLoadingSplash(5);
    await preloadBootModels((loaded, total) => {
      const pct = Math.max(8, Math.round((loaded / total) * 100));
      const fill = uiRoot.querySelector<HTMLElement>('.loading-fill');
      const sub = uiRoot.querySelector<HTMLElement>('.loading-sub');
      if (fill) fill.style.width = `${pct}%`;
      if (sub) sub.textContent = `${t(saveManager.get().settings.locale, 'loading.models')} ${pct}%`;
    });
    warmRemainingModelsInBackground();
    if (import.meta.env.DEV && urlParams.get('unlock') === '1') {
      applyDevUnlock();
    }

    const roomParam = urlParams.get('room');
    if (isPromoMode) {
      await startLevel(1, false);
    } else if (ONLINE_ARENA_ENABLED && roomParam && /^\d{4}$/.test(roomParam)) {
      metaView.activeTab = 'multi';
      metaView.roomCode = roomParam;
      renderMeta();
      void network.joinRoom(roomParam).then((ok) => {
        if (!ok) {
          metaView.statusNotice = t(saveManager.get().settings.locale, 'multi.errNotFound');
          renderMeta();
        }
      });
    } else {
      renderMeta();
    }
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    requestAnimationFrame(frame);
  } catch (err) {
    const errName = err instanceof Error ? err.name : 'UnknownError';
    console.error(`[PalamutKalesi] boot hatası: ${errName}`, err);
    renderBootError(err);
  }
}

void boot();

import './styles.css';
import { JuiceController } from './core/JuiceController.ts';
import {
  FIXED_DT,
  SimulationEngine,
  computeVictoryRewards,
  type SimEvent,
} from './core/SimulationEngine.ts';
import { getBannerSpec } from './data/accessories.ts';
import { ENEMIES, HEROES } from './data/enemies.ts';
import { LEVELS, type LevelSpec } from './data/levels.ts';
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
import { SaveManager } from './services/SaveManager.ts';
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
let victoryRecorded = false;
let multiOutcomeRecorded = false;
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
      void startLevel(currentLevelId, currentIronMode);
    },
    onExitToMap: () => exitToMap(),
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
}

function renderMeta(): void {
  mode = 'meta';
  juice.reset();
  syncAudioAndCameraSettings();
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
    allowedTowers?: import('./data/towers.ts').TowerId[];
    relics?: import('./data/roguelike.ts').RelicId[];
    initialBaseHp?: number;
  },
): Promise<void> {
  if (!options.isMultiMatch && network.state !== 'idle') {
    network.leaveRoom();
  }
  currentLevelId = spec.id;
  currentIronMode = options.ironMode;
  currentIsExpedition = options.isExpedition;
  victoryRecorded = false;
  multiOutcomeRecorded = false;
  pendingSeasonKills = 0;
  simAccumulator = 0;
  lastStatePingMs = 0;
  juice.reset();

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
  await ensureModelsLoaded(deps);

  const bannerSpec = !options.isMultiMatch ? getBannerSpec(save.equippedBanner) : null;
  const effectiveSpec: LevelSpec =
    bannerSpec?.bonusBaseHp && !options.ironMode && !options.isExpedition
      ? { ...spec, baseHp: spec.baseHp + bannerSpec.bonusBaseHp }
      : spec;

  activeSim = new SimulationEngine(effectiveSpec, {
    seed: options.customSeed,
    ironMode: options.ironMode,
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
  flushSeasonKills();
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
        ev.towerId === 'beaver' || ev.towerId === 'badger' || ev.towerId === 'tortoise'
          ? 'mortar'
          : ev.towerId === 'owl' || ev.towerId === 'lynx'
            ? 'emp'
            : ev.towerId === 'hedgehog'
              ? 'heavy'
              : 'arrow';
      sound.playShoot(kind);
    } else if (ev.type === 'ENEMY_HIT') {
      sound.playHit(ev.isCrit, ev.armorBroken, Boolean(ev.heavy), Boolean(ev.resisted));
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
        dmgKind === 'crit' ? `${ev.damage}!` : dmgKind === 'resisted' ? `🛡${ev.damage}` : `${ev.damage}`;
      battleView.addFloatingDamage(ev.x, ev.z, dmgText, dmgKind, ev.enemyId, ev.damage);
    } else if (ev.type === 'ENEMY_KILLED') {
      pendingSeasonKills += 1;
      sound.playScrapBreak();
      sound.playCoin();
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
      questSkills += 1;
    } else if (ev.type === 'ACORN_MAGNET') {
      sound.playMagnetCast();
      haptics.impact('light');
      questSkills += 1;
    } else if (ev.type === 'BARREL_EXPLODED') {
      juice.triggerMicroHitStop(0.04, 0.08);
      sound.playExplosion(true);
    } else if (ev.type === 'HERO_CLAW_SHOCK') {
      juice.triggerMicroHitStop(0.035, 0.1);
      sound.playHeroSlash(true);
    } else if (ev.type === 'HERO_ATTACK') {
      if (!ev.ranged) {
        sound.playHeroSlash(true);
        juice.triggerMicroHitStop(0.024, 0.12);
      } else {
        sound.playHit(false, false, false);
      }
    } else if (ev.type === 'HERO_ULTIMATE') {
      juice.triggerMicroHitStop(0.042, 0.08);
      sound.playHeroUltimate(ev.variant);
      haptics.impact('medium');
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
      battleView.showBanner(t(loc, bossSpec.descKey), 3.5);
    } else if (ev.type === 'WAVE_STARTED') {
      flushSeasonKills();
      if (ev.announceEnemy) {
        const enemySpec = ENEMIES[ev.announceEnemy];
        battleView.showBanner(`${t(loc, 'hud.newEnemy')}: ${t(loc, enemySpec.nameKey)}`, 3.4);
      }
    } else if (ev.type === 'GAME_WON' && !victoryRecorded) {
      victoryRecorded = true;
      questWins += 1;
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
          d.levelStars[currentLevelId] = Math.max(d.levelStars[currentLevelId] ?? 0, ev.stars);
          if (currentIronMode) d.ironCleared[currentLevelId] = true;
          d.oakCoins += rewards.oak;
          d.emeraldGems += rewards.gems;
        });
        const newlyUnlocked = grantCampaignHeroUnlocks(saveManager, currentLevelId);
        if (newlyUnlocked.length > 0) {
          metaView.statusNotice = tParams(loc, 'hero.select.unlockedToast', {
            name: t(loc, HEROES[newlyUnlocked[0]].nameKey),
          });
        }
        analytics.track('level_win', { levelId: currentLevelId, stars: ev.stars });
      }
    } else if (ev.type === 'GAME_LOST') {
      flushSeasonKills();
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
    battleView.tutorialPhase = 'done';
    saveManager.update((d) => {
      d.tutorialDone = true;
    });
  }
}

canvas.addEventListener('pointerdown', (ev) => {
  if (mode !== 'battle' || !activeSim || battleView.paused || activeSim.status !== 'playing') return;
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
  if (battleView.targetingSkill) {
    const hover = sceneMgr.pickWorld(ev.clientX, ev.clientY);
    if (hover) sceneMgr.updateTargetingReticle(battleView.targetingSkill, hover.x, hover.z);
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

window.addEventListener('pointerup', () => {
  dragHeroState = null;
});
window.addEventListener('pointercancel', () => {
  dragHeroState = null;
});

const resizeObserver = new ResizeObserver(() => {
  sceneMgr.resize(shell.clientWidth, shell.clientHeight);
});
resizeObserver.observe(shell);

window.addEventListener('pointerdown', () => sound.resume(), { passive: true });

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
    }
    if (network.state === 'in_match') {
      network.stepBot(simDt * battleView.speedMultiplier, activeSim);
      if (nowMs - lastStatePingMs >= 500 || activeSim.status !== 'playing') {
        lastStatePingMs = nowMs;
        network.sendStatePing(activeSim);
      }
    }
    battleView.updateTimers(rawDt, activeSim);
    if (!battleView.targetingSkill) sceneMgr.updateTargetingReticle(null);
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
    } else if (roomParam && /^\d{4}$/.test(roomParam)) {
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
    requestAnimationFrame(frame);
  } catch (err) {
    const errName = err instanceof Error ? err.name : 'UnknownError';
    console.error(`[PalamutKalesi] boot hatası: ${errName}`, err);
    renderBootError(err);
  }
}

void boot();

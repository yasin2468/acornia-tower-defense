import './styles.css';
import { JuiceController } from './core/JuiceController.ts';
import { FIXED_DT, SimulationEngine, type SimEvent } from './core/SimulationEngine.ts';
import { ENEMIES } from './data/enemies.ts';
import { LEVELS } from './data/levels.ts';
import { t } from './i18n/locales.ts';
import { SoundEngine } from './audio/SoundEngine.ts';
import { preloadAllModels } from './rendering/AssetLoader.ts';
import { SceneManager } from './rendering/SceneManager.ts';
import {
  AdService,
  AnalyticsService,
  BillingService,
  NetworkTransportStub,
  RemoteConfigService,
} from './services/CommercialServices.ts';
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
const analytics = new AnalyticsService();
const remoteConfig = new RemoteConfigService();
const network = new NetworkTransportStub();
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
let victoryRecorded = false;
let simAccumulator = 0;
let lastFrameMs = performance.now();
let lastRenderUiMs = 0;

const metaView = new MetaView(saveManager, adService, billingService, network, {
  onStartLevel: (levelId, ironMode) => startLevel(levelId, ironMode),
  onRefresh: () => renderMeta(),
});

const battleView = new BattleView(
  saveManager,
  adService,
  billingService,
  remoteConfig,
  {
    onRestart: () => startLevel(currentLevelId, currentIronMode),
    onExitToMap: () => exitToMap(),
  },
  isPromoMode,
);

function syncAudioAndCameraSettings(): void {
  const s = saveManager.get().settings;
  sound.enabled = s.soundEnabled;
  sceneMgr.cameraCtrl.setShakeStrength(s.shakeStrength);
  sceneMgr.setBatterySaver(s.batterySaver30Fps);
  // Reduced Motion: OS preference, or the player dialled shake to 0 %.
  const reduced = Boolean(reducedMotionQuery?.matches) || s.shakeStrength <= 0;
  juice.setReducedMotion(reduced);
  sceneMgr.setReducedMotion(reduced);
}

function renderMeta(): void {
  mode = 'meta';
  juice.reset();
  syncAudioAndCameraSettings();
  metaView.render(uiRoot);
}

function startLevel(levelId: number, ironMode: boolean): void {
  const spec = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
  currentLevelId = spec.id;
  currentIronMode = ironMode;
  victoryRecorded = false;
  simAccumulator = 0;
  juice.reset();

  const save = saveManager.get();
  activeSim = new SimulationEngine(spec, {
    ironMode,
    cardLevels: save.cardLevels,
    heroClass: save.heroClass,
    extraStartGold: remoteConfig.get().startGoldDelta,
    waitForFirstWave: !isPromoMode,
  });

  syncAudioAndCameraSettings();
  sceneMgr.loadLevel(spec, save.equippedHat, save.heroClass);
  battleView.resetForLevel(spec.id);
  mode = 'battle';
  analytics.track('level_start', { levelId: spec.id, ironMode });
  battleView.render(uiRoot, activeSim, sceneMgr);
}

function exitToMap(): void {
  activeSim = null;
  renderMeta();
}

function processBattleEvents(events: SimEvent[]): void {
  const loc = saveManager.get().settings.locale;
  for (const ev of events) {
    if (ev.type === 'TOWER_BUILT') {
      sound.playBuild();
    } else if (ev.type === 'TOWER_UPGRADED') {
      sound.playUpgrade();
    } else if (ev.type === 'TOWER_FIRED') {
      const kind = ev.towerId === 'beaver' ? 'mortar' : ev.towerId === 'owl' ? 'emp' : ev.towerId === 'hedgehog' ? 'heavy' : 'arrow';
      sound.playShoot(kind);
    } else if (ev.type === 'ENEMY_HIT') {
      sound.playHit(ev.isCrit, ev.armorBroken);
      const isCritHit = ev.isCrit || ev.armorBroken;
      if (isCritHit) {
        // Selective micro freeze only (18-45 ms window); the cooldown stops crit spam stacking.
        juice.triggerMicroHitStop(0.02, 0.12);
      }
      battleView.addFloatingDamage(
        ev.x,
        ev.z,
        isCritHit ? `${ev.damage}!` : `${ev.damage}`,
        isCritHit ? 'crit' : 'normal',
      );
    } else if (ev.type === 'ENEMY_KILLED') {
      sound.playScrapBreak();
      sound.playCoin();
      if (ev.isBoss) {
        juice.triggerMicroHitStop(0.045, 0.05);
        sound.playExplosion(true);
      }
      battleView.addFloatingDamage(ev.x, ev.z, `+${ev.bounty}`, 'gold');
    } else if (ev.type === 'PINECONE_RAIN') {
      juice.triggerMicroHitStop(0.04, 0.08);
      sound.playExplosion(true);
    } else if (ev.type === 'BARREL_EXPLODED') {
      juice.triggerMicroHitStop(0.04, 0.08);
      sound.playExplosion(true);
    } else if (ev.type === 'HERO_CLAW_SHOCK') {
      juice.triggerMicroHitStop(0.035, 0.1);
      sound.playHit(false, false, true);
    } else if (ev.type === 'HERO_ATTACK') {
      sound.playHit(false, false, true);
    } else if (ev.type === 'HERO_ULTIMATE') {
      juice.triggerMicroHitStop(0.042, 0.08);
      sound.playExplosion(true);
    } else if (ev.type === 'HERO_LEVELED') {
      sound.playUpgrade();
      if (activeSim?.heroClass === 'auto' && (ev.level === 2 || ev.level === 4)) {
        battleView.showBanner(`${t(loc, 'hero.evolvedBanner')} (Sv.${ev.level})`, 2.6);
      }
    } else if (ev.type === 'BOSS_PHASE_TWO') {
      juice.triggerMicroHitStop(0.045, 0.06);
      sound.playBossSiren();
      sound.playExplosion(true);
      const bossSpec = ENEMIES[ev.bossId ?? 'mega_harvester'];
      battleView.showBanner(t(loc, bossSpec.descKey), 3.5);
    } else if (ev.type === 'WAVE_STARTED') {
      if (ev.announceEnemy) {
        const enemySpec = ENEMIES[ev.announceEnemy];
        battleView.showBanner(`${t(loc, 'hud.newEnemy')}: ${t(loc, enemySpec.nameKey)}`, 3.4);
      }
    } else if (ev.type === 'GAME_WON' && !victoryRecorded) {
      victoryRecorded = true;
      saveManager.update((d) => {
        d.levelStars[currentLevelId] = Math.max(d.levelStars[currentLevelId] ?? 0, ev.stars);
        if (currentIronMode) d.ironCleared[currentLevelId] = true;
        d.oakCoins += 120;
        d.emeraldGems += 15;
      });
      analytics.track('level_win', { levelId: currentLevelId, stars: ev.stars });
    } else if (ev.type === 'GAME_LOST') {
      analytics.track('level_fail', { levelId: currentLevelId, wave: (activeSim?.currentWaveIndex ?? 0) + 1 });
    }
  }
}

canvas.addEventListener('pointerdown', (ev) => {
  if (mode !== 'battle' || !activeSim || battleView.paused || activeSim.status !== 'playing') return;
  const hit = sceneMgr.pickWorld(ev.clientX, ev.clientY);
  if (!hit) return;

  if (battleView.targetingSkill === 'rain') {
    activeSim.dispatch({ type: 'CAST_PINECONE_RAIN', x: hit.x, z: hit.z });
    battleView.targetingSkill = null;
    return;
  }

  if (battleView.targetingSkill === 'hero_leap') {
    activeSim.dispatch({ type: 'CAST_HERO_ULTIMATE', x: hit.x, z: hit.z });
    battleView.targetingSkill = null;
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
    battleView.selectedSlotId = battleView.selectedSlotId === hit.slotId ? null : hit.slotId;
    battleView.previewTowerId = null;
    battleView.render(uiRoot, activeSim, sceneMgr);
    return;
  }

  if (battleView.selectedSlotId !== null) {
    battleView.selectedSlotId = null;
    battleView.previewTowerId = null;
    battleView.render(uiRoot, activeSim, sceneMgr);
    return;
  }

  activeSim.dispatch({ type: 'MOVE_HERO', x: hit.x, z: hit.z });
  if (battleView.tutorialPhase === 'move_hero') {
    battleView.tutorialPhase = 'done';
    saveManager.update((d) => {
      d.tutorialDone = true;
    });
  }
});

const resizeObserver = new ResizeObserver(() => {
  sceneMgr.resize(shell.clientWidth, shell.clientHeight);
});
resizeObserver.observe(shell);

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
    battleView.updateTimers(rawDt, activeSim);
    sceneMgr.sync(
      activeSim,
      battleView.selectedSlotId,
      saveManager.get().equippedHat,
      rawDt,
      simDt,
      battleView.previewTowerId,
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
    await preloadAllModels((loaded, total) => {
      const pct = Math.max(8, Math.round((loaded / total) * 100));
      const fill = uiRoot.querySelector<HTMLElement>('.loading-fill');
      const sub = uiRoot.querySelector<HTMLElement>('.loading-sub');
      if (fill) fill.style.width = `${pct}%`;
      if (sub) sub.textContent = `${t(saveManager.get().settings.locale, 'loading.models')} ${pct}%`;
    });

    if (isPromoMode) {
      startLevel(1, false);
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

import { MONETIZATION_ENABLED } from '../config/features.ts';
import { easeOutCubic, GhostHpTracker, popScale } from '../core/JuiceController.ts';
import {
  computeBattleStars,
  computeVictoryRewards,
  type SimulationEngine,
} from '../core/SimulationEngine.ts';
import { ENEMIES, HEROES, resolveHeroVisualVariant, type EnemyId } from '../data/enemies.ts';
import { LEVELS } from '../data/levels.ts';
import { EXPEDITION_CLEAR_GEMS, EXPEDITION_CLEAR_OAK } from '../data/roguelike.ts';
import { getBossDisplayNameKey, getStoryBeatForLevel, type StoryBeat } from '../data/story.ts';
import { SYNERGY_COMBOS, getActiveSynergyPartnersForTower, getTowerSynergies } from '../data/synergies.ts';
import { TOWER_LIST, TOWERS, type TargetingPriority, type TowerId } from '../data/towers.ts';
import { t, tParams, type Locale } from '../i18n/locales.ts';
import type { SceneManager } from '../rendering/SceneManager.ts';
import {
  getFailOfferPrices,
  type AdService,
  type BillingService,
  type RemoteConfigService,
} from '../services/CommercialServices.ts';
import type { NetworkService, SocialEmoteId } from '../services/NetworkService.ts';
import type { SaveManager } from '../services/SaveManager.ts';
import { ICONS, PORTRAIT_URLS, UI_ICON_URLS, getEnemyBadgeUrl } from './icons.ts';

export type FloatingDamageKind = 'normal' | 'heavy' | 'resisted' | 'crit' | 'gold' | 'base' | 'skill' | 'combo';

export interface FloatingDamage {
  id: number;
  x: number;
  z: number;
  text: string;
  life: number;
  maxLife: number;
  driftX: number;
  kind: FloatingDamageKind;
  enemyId?: number;
  accumDamage?: number;
}

interface BarEl {
  root: HTMLElement;
  ghost: HTMLElement;
  fill: HTMLElement;
}

interface FloatEl {
  root: HTMLElement;
  key: number;
  text: string;
  kind: FloatingDamageKind;
}

export interface BattleViewCallbacks {
  onRestart: () => void;
  onExitToMap: () => void;
  onNextLevel?: (nextLevelId: number) => void;
  onSettingsChanged?: () => void;
  onSendPvpMerc?: (enemyId: EnemyId, cost: number) => void;
  onSendSocial?: (emoteId: SocialEmoteId) => void;
  onPreviewTap?: () => void;
  onResetCamera?: () => void;
}

export class BattleView {
  selectedSlotId: string | null = null;
  previewTowerId: TowerId | null = null;
  targetingSkill: 'rain' | 'hero_leap' | null = null;
  targetingPoint: { x: number; z: number } = { x: 0, z: 0 };
  speedMultiplier: 1 | 2 | 3 = 1;
  speed2xUnlockedThisMatch = false;
  paused = false;
  activeStoryBeat: StoryBeat | null = null;
  bannerText = '';
  bannerTimer = 0;
  floatingDamages: FloatingDamage[] = [];
  tutorialPhase: 'intro' | 'build_tower' | 'move_hero' | 'start_wave' | 'done' = 'done';
  promoMode = false;
  promoHideHud = false;

  private readonly saveManager: SaveManager;
  private readonly adService: AdService;
  private readonly billingService: BillingService;
  private readonly remoteConfig: RemoteConfigService;
  private readonly callbacks: BattleViewCallbacks;
  private readonly network?: NetworkService;

  private mountedRoot: HTMLElement | null = null;
  private hpTextEl: HTMLElement | null = null;
  private hpFillEl: HTMLElement | null = null;
  private waveTextEl: HTMLElement | null = null;
  private goldTextEl: HTMLElement | null = null;
  private bannerEl: HTMLElement | null = null;
  private earlyBtnEl: HTMLButtonElement | null = null;
  private speedBtnEl: HTMLButtonElement | null = null;
  private rainBtnEl: HTMLButtonElement | null = null;
  private rainCdEl: HTMLElement | null = null;
  private magnetBtnEl: HTMLButtonElement | null = null;
  private magnetCdEl: HTMLElement | null = null;
  private magnetBuffEl: HTMLElement | null = null;
  private heroBtnEl: HTMLButtonElement | null = null;
  private heroCdEl: HTMLElement | null = null;
  private heroHpBarEl: HTMLElement | null = null;
  private heroLvlEl: HTMLElement | null = null;
  private heroBuffEl: HTMLElement | null = null;
  private bossBarEl: HTMLElement | null = null;
  private bossNameEl: HTMLElement | null = null;
  private bossHpTextEl: HTMLElement | null = null;
  private bossHpFillEl: HTMLElement | null = null;
  private wavePreviewEl: HTMLElement | null = null;
  private multiBarEl: HTMLElement | null = null;
  private modalHostEl: HTMLElement | null = null;
  private hudTopEl: HTMLElement | null = null;
  private hudBottomEl: HTMLElement | null = null;
  private camResetBtnEl: HTMLButtonElement | null = null;
  private promoHudBtnEl: HTMLButtonElement | null = null;
  private lastSceneMgr: SceneManager | null = null;

  private lastContextKey = '';
  private lastModalKey = '';
  private lastWavePreviewKey = '';
  private lastMultiKey = '';

  /** Delayed white/amber "ghost damage" trail for every enemy HP bar. */
  readonly ghostHp = new GhostHpTracker(0.3, 0.45, 5.5);
  private fxPoolEl: HTMLElement | null = null;
  private tutorialLayerEl: HTMLElement | null = null;
  private barPool: BarEl[] = [];
  private floatPool: FloatEl[] = [];
  private floatSeq = 0;
  private lastTutorialHtml = '';
  private baseHitTimer = 0;
  private reducedMotion = false;
  private damageVignetteEl: HTMLElement | null = null;
  private castleHpRowEl: HTMLElement | null = null;

  constructor(
    saveManager: SaveManager,
    adService: AdService,
    billingService: BillingService,
    remoteConfig: RemoteConfigService,
    callbacks: BattleViewCallbacks,
    promoMode = false,
    network?: NetworkService,
  ) {
    this.saveManager = saveManager;
    this.adService = adService;
    this.billingService = billingService;
    this.remoteConfig = remoteConfig;
    this.callbacks = callbacks;
    this.promoMode = promoMode;
    this.network = network;
  }

  resetForLevel(levelId: number): void {
    this.selectedSlotId = null;
    this.previewTowerId = null;
    this.targetingSkill = null;
    this.speedMultiplier = 1;
    this.speed2xUnlockedThisMatch = true;
    this.paused = false;
    this.bannerText = '';
    this.bannerTimer = 0;
    this.baseHitTimer = 0;
    this.floatingDamages = [];
    this.ghostHp.clear();
    this.barPool = [];
    this.floatPool = [];
    this.lastTutorialHtml = '';
    const save = this.saveManager.get();
    const beat = !this.promoMode && levelId <= 36 ? getStoryBeatForLevel(levelId) : null;
    this.activeStoryBeat = beat && !save.seenStoryIds?.includes(beat.id) ? beat : null;
    this.tutorialPhase = levelId === 1 && !save.tutorialDone ? 'build_tower' : 'done';
    this.mountedRoot = null;
    this.damageVignetteEl = null;
    this.castleHpRowEl = null;
    this.lastContextKey = '';
    this.lastModalKey = '';
    this.lastWavePreviewKey = '';
    this.lastMultiKey = '';
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  triggerBaseHitFlash(damage: number): void {
    this.baseHitTimer = 0.38;
    if (damage > 0) {
      this.addFloatingDamage(0, -9.0, `-${damage}`, 'base');
    }
  }

  showBanner(text: string, seconds = 3.2): void {
    this.bannerText = text;
    this.bannerTimer = seconds;
  }

  addFloatingDamage(
    x: number,
    z: number,
    text: string,
    kind: FloatingDamageKind = 'normal',
    enemyId?: number,
    numericDamage?: number,
  ): void {
    if (enemyId !== undefined && numericDamage !== undefined && (kind === 'normal' || kind === 'heavy')) {
      for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
        const cur = this.floatingDamages[i];
        const age = cur.maxLife - cur.life;
        if (cur.enemyId === enemyId && (cur.kind === 'normal' || cur.kind === 'heavy') && age <= 0.2) {
          const sum = (cur.accumDamage ?? 0) + numericDamage;
          cur.accumDamage = sum;
          cur.text = `${sum}`;
          if (sum >= 35) cur.kind = 'heavy';
          cur.life = cur.maxLife;
          cur.x = x;
          cur.z = z;
          return;
        }
      }
    }
    const life =
      kind === 'combo'
        ? 1.25
        : kind === 'skill'
          ? 1.12
          : kind === 'crit' || kind === 'base'
            ? 0.95
            : kind === 'heavy'
              ? 0.82
              : kind === 'gold'
                ? 0.9
                : 0.68;
    const driftX = ((this.floatingDamages.length % 5) - 2) * 8 + (Math.random() - 0.5) * 6;
    this.floatSeq += 1;
    this.floatingDamages.push({
      id: this.floatSeq,
      x,
      z,
      text,
      life,
      maxLife: life,
      driftX,
      kind,
      enemyId,
      accumDamage: numericDamage,
    });
    if (this.floatingDamages.length > 48) this.floatingDamages.shift();
  }

  updateTimers(dt: number, sim: SimulationEngine): void {
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    if (this.baseHitTimer > 0) this.baseHitTimer = Math.max(0, this.baseHitTimer - dt);
    for (const f of this.floatingDamages) f.life -= dt;
    this.floatingDamages = this.floatingDamages.filter((f) => f.life > 0);

    const alive = new Set<number>();
    for (const e of sim.enemies) {
      alive.add(e.uid);
      this.ghostHp.update(e.uid, e.maxHp > 0 ? e.hp / e.maxHp : 0, dt);
    }
    this.ghostHp.prune(alive);

    if (this.tutorialPhase === 'intro' && !this.activeStoryBeat && sim.elapsed >= 0.8) {
      this.tutorialPhase = 'build_tower';
    }
    if (this.tutorialPhase === 'start_wave' && !sim.waitingForFirstWave) {
      this.tutorialPhase = 'done';
      this.saveManager.update((d) => {
        d.tutorialDone = true;
      });
    }
  }

  mount(container: HTMLElement, sim: SimulationEngine): void {
    const loc = this.saveManager.get().settings.locale;
    container.innerHTML = `
      <div class="damage-vignette" id="bw-damage-vignette"></div>
      <div class="world-overlay" id="bw-world-overlay">
        <div id="bw-bars-layer"><div id="bw-fx-pool"></div><div id="bw-tutorial-layer"></div></div>
        <div id="bw-context-layer"></div>
      </div>
      ${this.promoMode ? this.buildPromoToolbar(loc) : ''}
      <div class="hud-top" id="bw-hud-top">
        <div class="castle-hud">
          <div class="castle-hp-row">
            <img class="castle-shield-badge" src="${UI_ICON_URLS.castleShield}" alt="" />
            <div class="hp-track">
              <div class="hp-fill" id="bw-hp-fill" style="width:100%"></div>
              <span class="hp-text-center" id="bw-hp-text">150/150</span>
            </div>
          </div>
          <div class="wave-sub-pill">
            <span class="svg-ico" style="width:13px;height:13px;">${ICONS.waveSword}</span>
            <span id="bw-wave-text"></span>
          </div>
        </div>
        <div class="gold-hud">
          <img class="gold-hud-icon" src="${UI_ICON_URLS.acornCoins}" alt="" />
          <span class="gold-hud-val" id="bw-gold-text">150</span>
        </div>
      </div>

      <div class="boss-hud-bar" id="bw-boss-bar" style="display:none;">
        <div class="boss-hud-head">
          <span class="boss-hud-title"><span class="svg-ico" style="width:14px;height:14px;">${ICONS.skullCrown}</span><span id="bw-boss-name"></span></span>
          <span id="bw-boss-hp-text"></span>
        </div>
        <div class="boss-hud-track"><div class="boss-hud-fill" id="bw-boss-hp-fill" style="width:100%"></div></div>
      </div>
      <div class="wave-preview-strip" id="bw-wave-preview" style="display:none;"></div>
      <div class="multi-hud-bar" id="bw-multi-bar" style="display:none;"></div>
      <div class="banner-toast" id="bw-banner" style="display:none;"></div>
      <button class="cam-reset-pill interactive" id="bw-cam-reset" style="display:none;">${t(loc, 'hud.camReset')}</button>

      <div class="hud-bottom" id="bw-hud-bottom">
        <div class="hud-controls">
          <button class="btn btn-gold btn-sm" id="bw-early-wave" style="display:none;"></button>
        </div>
        <div class="hud-controls">
          <button class="tactile-sq-btn" id="bw-speed">x1</button>
          <button class="tactile-sq-btn" id="bw-pause"><span class="svg-ico">${ICONS.pause}</span></button>
          <button class="skill-medallion-btn hero-skill-btn" id="bw-skill-hero" title="${t(loc, HEROES[sim.heroId].nameKey)}${tParams(loc, 'skill.hotkeyHint', { key: '1' })}">
            <img src="${PORTRAIT_URLS[sim.heroId]}" alt="${t(loc, HEROES[sim.heroId].nameKey)}" />
            <span class="hero-skill-lvl" id="bw-hero-lvl">${t(loc, 'cards.level')}1</span>
            <span class="hero-buff-pill" id="bw-hero-buff" style="display:none;"></span>
            <span class="hero-skill-hp"><span class="hero-skill-hp-fill" id="bw-hero-hp" style="width:100%"></span></span>
            <span class="cd-badge" id="bw-hero-cd" style="display:none;"></span>
          </button>
          <button class="skill-medallion-btn" id="bw-skill-rain" title="${t(loc, 'skill.rain')}${tParams(loc, 'skill.hotkeyHint', { key: '2' })}">
            <img src="${UI_ICON_URLS.skillRain}" alt="${t(loc, 'skill.rain')}" />
            <span class="cd-badge" id="bw-rain-cd" style="display:none;"></span>
          </button>
          <button class="skill-medallion-btn" id="bw-skill-magnet" title="${t(loc, 'skill.magnet')}${tParams(loc, 'skill.hotkeyHint', { key: '3' })}">
            <img src="${UI_ICON_URLS.skillMagnet}" alt="${t(loc, 'skill.magnet')}" />
            <span class="hero-buff-pill" id="bw-magnet-buff" style="display:none;"></span>
            <span class="cd-badge" id="bw-magnet-cd" style="display:none;"></span>
          </button>
        </div>
      </div>
      <div id="bw-modal-host"></div>
    `;

    this.mountedRoot = container;
    this.damageVignetteEl = container.querySelector('#bw-damage-vignette');
    this.castleHpRowEl = container.querySelector('.castle-hp-row');
    this.fxPoolEl = container.querySelector('#bw-fx-pool');
    this.tutorialLayerEl = container.querySelector('#bw-tutorial-layer');
    this.barPool = [];
    this.floatPool = [];
    this.lastTutorialHtml = '';
    this.hpTextEl = container.querySelector('#bw-hp-text');
    this.hpFillEl = container.querySelector('#bw-hp-fill');
    this.waveTextEl = container.querySelector('#bw-wave-text');
    this.goldTextEl = container.querySelector('#bw-gold-text');
    this.bannerEl = container.querySelector('#bw-banner');
    this.earlyBtnEl = container.querySelector('#bw-early-wave');
    this.speedBtnEl = container.querySelector('#bw-speed');
    this.heroBtnEl = container.querySelector('#bw-skill-hero');
    this.heroCdEl = container.querySelector('#bw-hero-cd');
    this.heroHpBarEl = container.querySelector('#bw-hero-hp');
    this.heroLvlEl = container.querySelector('#bw-hero-lvl');
    this.heroBuffEl = container.querySelector('#bw-hero-buff');
    this.bossBarEl = container.querySelector('#bw-boss-bar');
    this.bossNameEl = container.querySelector('#bw-boss-name');
    this.bossHpTextEl = container.querySelector('#bw-boss-hp-text');
    this.bossHpFillEl = container.querySelector('#bw-boss-hp-fill');
    this.wavePreviewEl = container.querySelector('#bw-wave-preview');
    this.lastWavePreviewKey = '';
    this.multiBarEl = container.querySelector('#bw-multi-bar');
    this.lastMultiKey = '';
    this.rainBtnEl = container.querySelector('#bw-skill-rain');
    this.rainCdEl = container.querySelector('#bw-rain-cd');
    this.magnetBtnEl = container.querySelector('#bw-skill-magnet');
    this.magnetCdEl = container.querySelector('#bw-magnet-cd');
    this.magnetBuffEl = container.querySelector('#bw-magnet-buff');
    this.modalHostEl = container.querySelector('#bw-modal-host');
    this.hudTopEl = container.querySelector('#bw-hud-top');
    this.hudBottomEl = container.querySelector('#bw-hud-bottom');
    this.camResetBtnEl = container.querySelector('#bw-cam-reset');
    this.promoHudBtnEl = container.querySelector('#btn-promo-hud');

    this.bindStaticEvents(container, sim);
  }

  private seedTargetingPoint(sim: SimulationEngine, groundOnly: boolean): void {
    const leading = sim.enemies
      .filter((e) => e.hp > 0 && (!groundOnly || !e.isFlying))
      .sort((a, b) => b.progress - a.progress)[0];
    this.targetingPoint = leading
      ? { x: leading.x, z: leading.z }
      : { x: sim.hero.dead ? 0 : sim.hero.x, z: sim.hero.dead ? 0 : sim.hero.z };
  }

  getTargetingVisualSpec(sim: SimulationEngine): { radius: number; color: string; showLink: boolean } {
    if (this.targetingSkill === 'rain') {
      return { radius: 3.1, color: '#ff9f43', showLink: false };
    }
    if (sim.heroId === 'kizil_kuyruk') {
      return { radius: 3.6, color: '#44f0a6', showLink: true };
    }
    if (sim.heroId === 'kaya_dis') {
      return { radius: 3.5, color: '#e8a848', showLink: true };
    }
    return { radius: 3.3, color: '#ff7b3b', showLink: true };
  }

  triggerRainSkill(sim: SimulationEngine): void {
    if (sim.pineconeRainCooldown > 0) return;
    this.targetingSkill = this.targetingSkill === 'rain' ? null : 'rain';
    if (this.targetingSkill === 'rain') {
      this.seedTargetingPoint(sim, false);
    }
  }

  triggerMagnetSkill(sim: SimulationEngine): void {
    if (sim.magnetCooldown > 0) return;
    this.targetingSkill = null;
    sim.dispatch({ type: 'CAST_ACORN_MAGNET' });
  }

  triggerHeroSkill(sim: SimulationEngine): void {
    if (sim.hero.dead || sim.hero.skillCooldown > 0) return;
    const loc = this.saveManager.get().settings.locale;
    if (sim.heroId === 'kizil_kuyruk') {
      this.targetingSkill = this.targetingSkill === 'hero_leap' ? null : 'hero_leap';
      if (this.targetingSkill === 'hero_leap') {
        this.seedTargetingPoint(sim, false);
        this.showBanner(t(loc, 'skill.hero.foxHint'), 2.5);
      } else {
        this.showBanner('', 0);
      }
      return;
    }
    if (sim.heroId === 'kaya_dis') {
      this.targetingSkill = this.targetingSkill === 'hero_leap' ? null : 'hero_leap';
      if (this.targetingSkill === 'hero_leap') {
        this.seedTargetingPoint(sim, true);
        this.showBanner(t(loc, 'skill.hero.boarHint'), 2.5);
      } else {
        this.showBanner('', 0);
      }
      return;
    }
    if (sim.heroId === 'ay_kurdu') {
      this.targetingSkill = null;
      sim.dispatch({ type: 'CAST_HERO_ULTIMATE' });
      this.showBanner(t(loc, 'skill.hero.wolf_howl'), 2.0);
      return;
    }
    const variant = resolveHeroVisualVariant(sim.heroClass, sim.hero.level);
    if (variant === 'viking') {
      this.targetingSkill = this.targetingSkill === 'hero_leap' ? null : 'hero_leap';
      if (this.targetingSkill === 'hero_leap') {
        this.seedTargetingPoint(sim, true);
        this.showBanner(t(loc, 'skill.hero.leapHint'), 2.5);
      } else {
        this.showBanner('', 0);
      }
    } else {
      this.targetingSkill = null;
      sim.dispatch({ type: 'CAST_HERO_ULTIMATE' });
      this.showBanner(t(loc, `skill.hero.${variant}`), 2.0);
    }
  }

  private bindStaticEvents(container: HTMLElement, sim: SimulationEngine): void {
    if (this.earlyBtnEl) {
      this.earlyBtnEl.onclick = () => sim.dispatch({ type: 'CALL_WAVE_EARLY' });
    }
    if (this.speedBtnEl) {
      this.speedBtnEl.onclick = () => {
        this.speedMultiplier = this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 3 : 1;
        if (this.speedBtnEl) this.speedBtnEl.textContent = `x${this.speedMultiplier}`;
      };
    }
    if (this.camResetBtnEl) {
      this.camResetBtnEl.onclick = () => {
        if (this.callbacks.onResetCamera) {
          this.callbacks.onResetCamera();
        } else {
          this.lastSceneMgr?.cameraCtrl?.resetView?.();
        }
      };
    }
    const pauseBtn = container.querySelector<HTMLButtonElement>('#bw-pause');
    if (pauseBtn) pauseBtn.onclick = () => { this.paused = true; };

    if (this.rainBtnEl) {
      this.rainBtnEl.onclick = () => this.triggerRainSkill(sim);
    }
    if (this.magnetBtnEl) {
      this.magnetBtnEl.onclick = () => this.triggerMagnetSkill(sim);
    }
    if (this.heroBtnEl) {
      this.heroBtnEl.onclick = () => this.triggerHeroSkill(sim);
    }

    if (this.promoHudBtnEl) {
      this.promoHudBtnEl.onclick = () => {
        this.promoHideHud = !this.promoHideHud;
      };
    }
    const promoSwarm = container.querySelector<HTMLButtonElement>('#btn-promo-swarm');
    if (promoSwarm) {
      promoSwarm.onclick = () => {
        for (let i = 0; i < 30; i++) sim.spawnEnemy('swarm_saw', 28, 3.3, 3);
      };
    }
    const promoBoss = container.querySelector<HTMLButtonElement>('#btn-promo-boss');
    if (promoBoss) {
      promoBoss.onclick = () => sim.spawnEnemy('mega_harvester');
    }
  }

  render(container: HTMLElement, sim: SimulationEngine, sceneMgr: SceneManager): void {
    this.lastSceneMgr = sceneMgr;
    if (this.mountedRoot !== container) {
      this.mount(container, sim);
    }

    const save = this.saveManager.get();
    const loc = save.settings.locale;
    const waveNum = Math.max(1, sim.currentWaveIndex + 1);
    const totalWaves = sim.level.waves.length;
    const hpPct = Math.max(0, Math.min(100, (sim.baseHp / sim.maxBaseHp) * 100));

    const hide = this.promoMode && this.promoHideHud;
    const hasDockOpen = Boolean(this.selectedSlotId && sim.slots.get(this.selectedSlotId));
    if (this.hudTopEl && this.hudBottomEl) {
      this.hudTopEl.style.display = hide ? 'none' : 'flex';
      this.hudBottomEl.style.display = hide ? 'none' : 'flex';
      this.hudBottomEl.classList?.toggle?.('dock-open', !hide && hasDockOpen);
    }
    if (this.camResetBtnEl) {
      const showCamReset = !hide && Boolean(sceneMgr.cameraCtrl?.isZoomedOrPanned?.());
      this.camResetBtnEl.style.display = showCamReset ? 'inline-flex' : 'none';
      this.camResetBtnEl.textContent = t(loc, 'hud.camReset');
    }
    if (this.promoHudBtnEl) {
      this.promoHudBtnEl.textContent = this.promoHideHud ? t(loc, 'promo.hudShow') : t(loc, 'promo.hudHide');
    }

    if (this.hpTextEl) this.hpTextEl.textContent = `${Math.ceil(sim.baseHp)}/${sim.maxBaseHp}`;
    if (this.hpFillEl) this.hpFillEl.style.width = `${hpPct}%`;
    if (this.waveTextEl) this.waveTextEl.textContent = `${t(loc, 'hud.wave')} ${waveNum}/${totalWaves}`;
    if (this.goldTextEl) this.goldTextEl.textContent = `${sim.gold}`;

    if (this.bossBarEl) {
      const liveBoss = !hide ? sim.enemies.find((e) => e.isBoss && e.hp > 0) : undefined;
      this.bossBarEl.style.display = liveBoss ? 'block' : 'none';
      if (liveBoss) {
        const bSpec = ENEMIES[liveBoss.enemyId];
        const bPct = Math.max(0, Math.min(100, (liveBoss.hp / liveBoss.maxHp) * 100));
        if (this.bossNameEl) {
          this.bossNameEl.textContent = t(loc, getBossDisplayNameKey(sim.level.id, bSpec.nameKey));
        }
        if (this.bossHpTextEl) this.bossHpTextEl.textContent = `${Math.ceil(liveBoss.hp)}/${liveBoss.maxHp}`;
        if (this.bossHpFillEl) this.bossHpFillEl.style.width = `${bPct.toFixed(1)}%`;
      }
    }

    if (this.wavePreviewEl) {
      const nextWave = !hide && !sim.waveInProgress && sim.status === 'playing'
        ? sim.level.waves[sim.currentWaveIndex + 1]
        : undefined;
      this.wavePreviewEl.style.display = nextWave ? 'flex' : 'none';
      if (nextWave) {
        const wKey = `${sim.level.id}|${nextWave.waveNumber}|${loc}`;
        if (wKey !== this.lastWavePreviewKey) {
          this.lastWavePreviewKey = wKey;
          const chips = nextWave.groups
            .map((g) => {
              const spec = ENEMIES[g.enemyId];
              const thumbUrl = getEnemyBadgeUrl(g.enemyId, spec.isBoss);
              const roleIcon = spec.isBoss
                ? `<span class="wp-badge boss">💀 ${t(loc, 'hud.tagBoss')}</span>`
                : spec.isFlying
                  ? `<span class="wp-badge flying">✈ ${t(loc, 'hud.tagFlying')}</span>`
                  : spec.armor >= 0.25
                    ? `<span class="wp-badge armor">🛡 ${t(loc, 'hud.tagArmor')}</span>`
                    : '';
              return `
                <span class="wp-group-chip ${spec.isBoss ? 'is-boss' : ''}" title="${t(loc, spec.nameKey)}">
                  <img class="wp-enemy-thumb" src="${thumbUrl}" alt="${t(loc, spec.nameKey)}" />
                  <span class="wp-count">×${g.count}</span>
                  ${roleIcon}
                </span>
              `;
            })
            .join('');
          this.wavePreviewEl.innerHTML = `<span class="wp-label">${t(loc, 'hud.nextWavePreview')}</span>${chips}`;
        }
      }
    }

    if (this.multiBarEl) {
      const inMulti = !hide && this.network?.state === 'in_match' && sim.status === 'playing';
      this.multiBarEl.style.display = inMulti ? 'flex' : 'none';
      if (inMulti && this.network) {
        const net = this.network;
        const coopLeft = sim.coopReserves[net.role];
        const mKey =
          net.mode === 'coop'
            ? `coop|${net.roomCode}|${net.role}|${coopLeft}|${loc}`
            : `pvp|${net.roomCode}|${net.peerBaseHp}|${sim.gold >= 95 ? 3 : sim.gold >= 60 ? 2 : sim.gold >= 35 ? 1 : 0}|${loc}`;
        if (mKey !== this.lastMultiKey) {
          this.lastMultiKey = mKey;
          const socialHtml = `
            <div class="social-emote-row">
              <button class="social-emote-btn" data-social-emote="pin_build" title="${t(loc, 'social.pin_build')}">📍</button>
              <button class="social-emote-btn" data-social-emote="pin_help" title="${t(loc, 'social.pin_help')}">🆘</button>
              <button class="social-emote-btn" data-social-emote="cool_squirrel" title="${t(loc, 'social.cool_squirrel')}">😎</button>
              <button class="social-emote-btn" data-social-emote="laugh_beaver" title="${t(loc, 'social.laugh_beaver')}">😂</button>
              <button class="social-emote-btn" data-social-emote="cry_dozer" title="${t(loc, 'social.cry_dozer')}">😭</button>
            </div>
          `;
          if (net.mode === 'coop') {
            this.multiBarEl.innerHTML = `
              <span>2P CO-OP #${net.roomCode} (${net.role.toUpperCase()})</span>
              <button class="btn btn-gold btn-sm" id="bw-coop-gift" ${coopLeft >= 25 ? '' : 'disabled'}>${tParams(loc, 'multi.coopGift', { left: coopLeft })}</button>
              ${socialHtml}
            `;
            const giftBtn = this.multiBarEl.querySelector<HTMLButtonElement>('#bw-coop-gift');
            if (giftBtn) {
              giftBtn.onclick = () => sim.dispatch({ type: 'COOP_GIFT_GOLD', fromRole: net.role, amount: 25 }, net.role);
            }
          } else {
            this.multiBarEl.innerHTML = `
              <span>${tParams(loc, 'multi.rivalHp', { hp: net.peerBaseHp, max: net.peerMaxBaseHp })}</span>
              <button class="btn btn-dark btn-sm" data-pvp-merc="scout_bot" data-merc-cost="35" ${sim.gold >= 35 ? '' : 'disabled'}>${t(loc, 'multi.pvpScout')}</button>
              <button class="btn btn-dark btn-sm" data-pvp-merc="shield_loader" data-merc-cost="60" ${sim.gold >= 60 ? '' : 'disabled'}>${t(loc, 'multi.pvpShield')}</button>
              <button class="btn btn-gold btn-sm" data-pvp-merc="chomp_brute" data-merc-cost="95" ${sim.gold >= 95 ? '' : 'disabled'}>${t(loc, 'multi.pvpBrute')}</button>
              ${socialHtml}
            `;
            this.multiBarEl.querySelectorAll<HTMLButtonElement>('[data-pvp-merc]').forEach((btn) => {
              btn.onclick = () => {
                const enemyId = btn.dataset.pvpMerc as EnemyId;
                const cost = Number(btn.dataset.mercCost);
                this.callbacks.onSendPvpMerc?.(enemyId, cost);
              };
            });
          }
          this.multiBarEl.querySelectorAll<HTMLButtonElement>('[data-social-emote]').forEach((btn) => {
            btn.onclick = () => {
              this.callbacks.onSendSocial?.(btn.dataset.socialEmote as SocialEmoteId);
            };
          });
        }
      }
    }

    if (this.bannerEl) {
      const showBanner = this.bannerTimer > 0 && Boolean(this.bannerText);
      this.bannerEl.style.display = showBanner ? 'block' : 'none';
      if (showBanner) this.bannerEl.textContent = this.bannerText;
    }

    if (this.earlyBtnEl) {
      const canCallEarly = !sim.waveInProgress && sim.currentWaveIndex + 1 < totalWaves;
      this.earlyBtnEl.style.display = canCallEarly ? 'inline-flex' : 'none';
      if (canCallEarly) {
        if (sim.waitingForFirstWave) {
          this.earlyBtnEl.textContent = t(loc, 'hud.startBattle');
          this.earlyBtnEl.classList.add('pulse-cta');
        } else {
          const bonus = sim.getEarlyWaveBonus();
          const label = bonus > 0 ? tParams(loc, 'hud.earlyWaveBonus', { gold: bonus }) : t(loc, 'hud.earlyWave');
          this.earlyBtnEl.textContent = `${label} (${Math.ceil(sim.waveCountdown)}s)`;
          this.earlyBtnEl.classList.remove('pulse-cta');
        }
      }
    }

    if (this.speedBtnEl) this.speedBtnEl.textContent = `x${this.speedMultiplier}`;
    if (this.rainBtnEl) {
      this.rainBtnEl.classList.toggle('active', this.targetingSkill === 'rain');
      this.rainBtnEl.classList.toggle('ready', sim.pineconeRainCooldown <= 0 && this.targetingSkill !== 'rain');
    }
    if (this.rainCdEl) {
      this.rainCdEl.style.display = sim.pineconeRainCooldown > 0 ? 'flex' : 'none';
      if (sim.pineconeRainCooldown > 0) this.rainCdEl.textContent = `${Math.ceil(sim.pineconeRainCooldown)}`;
    }
    if (this.magnetBtnEl) {
      this.magnetBtnEl.classList.toggle('active', sim.magnetActiveTimer > 0);
      this.magnetBtnEl.classList.toggle('buff-active', sim.magnetActiveTimer > 0);
      this.magnetBtnEl.classList.toggle('ready', sim.magnetCooldown <= 0 && sim.magnetActiveTimer <= 0);
    }
    if (this.magnetCdEl) {
      this.magnetCdEl.style.display = sim.magnetCooldown > 0 ? 'flex' : 'none';
      if (sim.magnetCooldown > 0) this.magnetCdEl.textContent = `${Math.ceil(sim.magnetCooldown)}`;
    }
    if (this.magnetBuffEl) {
      this.magnetBuffEl.style.display = sim.magnetActiveTimer > 0 ? 'inline-flex' : 'none';
      if (sim.magnetActiveTimer > 0) {
        this.magnetBuffEl.textContent = tParams(loc, 'skill.buff.sec', { sec: Math.ceil(sim.magnetActiveTimer) });
      }
    }
    if (this.heroBtnEl) {
      const skillKey =
        sim.heroId === 'kizil_kuyruk'
          ? 'skill.hero.fox_storm'
          : sim.heroId === 'kaya_dis'
            ? 'skill.hero.boar_charge'
            : sim.heroId === 'ay_kurdu'
              ? 'skill.hero.wolf_howl'
              : `skill.hero.${resolveHeroVisualVariant(sim.heroClass, sim.hero.level)}`;
      this.heroBtnEl.title = `${t(loc, skillKey)}${tParams(loc, 'skill.hotkeyHint', { key: '1' })}`;
      this.heroBtnEl.classList.toggle('active', this.targetingSkill === 'hero_leap');
      this.heroBtnEl.classList.toggle('buff-active', !sim.hero.dead && sim.hero.skillActiveTimer > 0);
      this.heroBtnEl.classList.toggle(
        'ready',
        !sim.hero.dead && sim.hero.skillCooldown <= 0 && this.targetingSkill !== 'hero_leap' && sim.hero.skillActiveTimer <= 0,
      );
      this.heroBtnEl.classList.toggle('dead', sim.hero.dead);
    }
    if (this.heroBuffEl) {
      const showHeroBuff = !sim.hero.dead && sim.hero.skillActiveTimer > 0;
      this.heroBuffEl.style.display = showHeroBuff ? 'inline-flex' : 'none';
      if (showHeroBuff) {
        this.heroBuffEl.textContent = tParams(loc, 'skill.buff.sec', { sec: Math.ceil(sim.hero.skillActiveTimer) });
      }
    }
    if (this.heroLvlEl) this.heroLvlEl.textContent = `${t(loc, 'cards.level')}${sim.hero.level}`;
    if (this.heroHpBarEl) {
      const heroPct = sim.hero.dead ? 0 : Math.max(0, Math.min(100, (sim.hero.hp / sim.hero.maxHp) * 100));
      this.heroHpBarEl.style.width = `${heroPct.toFixed(1)}%`;
    }
    if (this.heroCdEl) {
      const waitSec = sim.hero.dead ? sim.hero.respawnTimer : sim.hero.skillCooldown;
      this.heroCdEl.style.display = waitSec > 0 ? 'flex' : 'none';
      if (waitSec > 0) this.heroCdEl.textContent = `${Math.ceil(waitSec)}`;
    }

    if (this.tutorialLayerEl) {
      const tutHtml = this.buildTutorialHtml(sim, sceneMgr, loc);
      if (tutHtml !== this.lastTutorialHtml) {
        this.lastTutorialHtml = tutHtml;
        this.tutorialLayerEl.innerHTML = tutHtml;
        const skipTut = this.tutorialLayerEl.querySelector?.('#btn-skip-tutorial') as HTMLButtonElement | null;
        if (skipTut) {
          skipTut.onclick = () => {
            this.tutorialPhase = 'done';
            this.saveManager.update((d) => {
              d.tutorialDone = true;
            });
            this.lastTutorialHtml = '';
            if (this.tutorialLayerEl) this.tutorialLayerEl.innerHTML = '';
          };
        }
      }
    }

    const selSlot = this.selectedSlotId ? sim.slots.get(this.selectedSlotId) : undefined;
    const smokedSlots = Array.from(sim.slots.values())
      .filter((s) => s.tower && s.tower.smokedTimer > 0)
      .map((s) => s.id)
      .join(',');
    const builtTypesKey = Array.from(
      new Set(
        Array.from(sim.slots.values())
          .map((s) => s.tower?.towerId)
          .filter((id): id is TowerId => Boolean(id)),
      ),
    )
      .sort()
      .join(',');
    const allowedKey = sim.allowedTowers ? sim.allowedTowers.join(',') : 'all';
    const contextKey = `${this.selectedSlotId ?? 'none'}|${this.previewTowerId ?? 'none'}|${selSlot?.stumpLocked ? 'stump' : selSlot?.tower ? `${selSlot.tower.towerId}_${selSlot.tower.tier}_${selSlot.tower.priority}` : 'empty'}|${sim.gold}|${this.tutorialPhase}|${smokedSlots}|${builtTypesKey}|${allowedKey}|${loc}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      const contextHost = container.querySelector<HTMLElement>('#bw-context-layer');
      if (contextHost) {
        contextHost.innerHTML = this.buildContextLayerHtml(sim, sceneMgr, loc);
        this.bindContextEvents(contextHost, sim);
      }
    }

    const modalKey = `${this.paused}|${this.activeStoryBeat?.id ?? 'none'}|${sim.status}|${sim.reviveUsed}|${save.firstDefeatBundleBought}|${save.settings.soundEnabled}|${save.settings.musicEnabled}|${save.settings.hapticsEnabled}|${loc}`;
    if (modalKey !== this.lastModalKey && this.modalHostEl) {
      this.lastModalKey = modalKey;
      this.modalHostEl.innerHTML = this.buildModal(sim, loc);
      this.bindModalEvents(this.modalHostEl, sim);
    }
  }

  private acquireBar(i: number): BarEl | null {
    if (!this.fxPoolEl) return null;
    while (this.barPool.length <= i) {
      const root = document.createElement('div');
      root.className = 'enemy-hp-bar';
      const ghost = document.createElement('div');
      ghost.className = 'enemy-hp-ghost';
      const fill = document.createElement('div');
      fill.className = 'enemy-hp-fill';
      root.append(ghost, fill);
      this.fxPoolEl.appendChild(root);
      this.barPool.push({ root, ghost, fill });
    }
    return this.barPool[i];
  }

  private acquireFloat(i: number): FloatEl | null {
    if (!this.fxPoolEl) return null;
    while (this.floatPool.length <= i) {
      const root = document.createElement('div');
      root.className = 'float-dmg';
      this.fxPoolEl.appendChild(root);
      this.floatPool.push({ root, key: -1, text: '', kind: 'normal' });
    }
    return this.floatPool[i];
  }

  /**
   * Per-frame world overlay (pooled DOM, no innerHTML churn): enemy HP bars with an instant
   * fill drop + delayed ghost-damage trail, and pop-scaled floating damage / coin numbers.
   */
  renderOverlay(sim: SimulationEngine, sceneMgr: SceneManager): void {
    if (!this.fxPoolEl || !this.mountedRoot) return;
    if (this.damageVignetteEl) {
      const ratio = this.baseHitTimer > 0 ? Math.min(1, this.baseHitTimer / 0.38) : 0;
      const maxOp = this.reducedMotion ? 0.28 : 0.85;
      this.damageVignetteEl.style.opacity = `${(ratio * maxOp).toFixed(3)}`;
    }
    if (this.castleHpRowEl) {
      this.castleHpRowEl.classList.toggle('hit-shake', this.baseHitTimer > 0.1 && !this.reducedMotion);
    }
    let barCount = 0;
    for (const e of sim.enemies) {
      if (e.hp <= 0) continue;
      const g = this.ghostHp.get(e.uid);
      const hp = g ? g.hp : e.hp / e.maxHp;
      const ghost = g ? g.ghost : hp;
      if (hp >= 0.9999 && ghost >= 0.9999) continue;
      const proj = sceneMgr.projectToScreen(e.x, e.isFlying ? 2.4 : e.isBoss ? 2.82 : 1.58, e.z);
      if (!proj.visible) continue;
      const bar = this.acquireBar(barCount);
      if (!bar) break;
      barCount += 1;
      const hitAge = g ? g.hitAge : Number.POSITIVE_INFINITY;
      const w = e.isBoss ? 68 : 42;
      const bump = hitAge < 0.12 ? (1 - hitAge / 0.12) * 3.0 : 0;
      const jx = !this.reducedMotion && hitAge < 0.1 ? Math.sin(hitAge * 95) * 2.4 * (1 - hitAge / 0.1) : 0;
      const barScale = !this.reducedMotion && hitAge < 0.1 ? ' scale(1.12, 1.28)' : '';
      bar.root.style.display = 'block';
      bar.root.style.width = `${w}px`;
      bar.root.style.transform = `translate3d(${(proj.x - w / 2 + jx).toFixed(1)}px, ${(proj.y - 6 - bump).toFixed(1)}px, 0)${barScale}`;
      bar.fill.style.transform = `scaleX(${hp.toFixed(4)})`;
      bar.ghost.style.transform = `scaleX(${ghost.toFixed(4)})`;
      const tier = hp < 0.3 ? 'low' : hp < 0.6 ? 'mid' : 'high';
      const cls = `enemy-hp-bar ${tier}${hitAge < 0.09 ? ' fresh' : ''}${e.isBoss ? ' boss' : ''}`;
      if (bar.root.className !== cls) bar.root.className = cls;
    }
    for (let i = barCount; i < this.barPool.length; i++) {
      if (this.barPool[i].root.style.display !== 'none') this.barPool[i].root.style.display = 'none';
    }

    let floatCount = 0;
    for (const f of this.floatingDamages) {
      const projY = f.kind === 'base' ? 2.1 : f.kind === 'skill' ? 2.15 : 1.72;
      const proj = sceneMgr.projectToScreen(f.x, projY, f.z);
      if (!proj.visible) continue;
      const el = this.acquireFloat(floatCount);
      if (!el) break;
      floatCount += 1;
      const age = f.maxLife - f.life;
      const p = Math.max(0, Math.min(1, age / f.maxLife));
      const rise =
        f.kind === 'combo'
          ? 56
          : f.kind === 'gold'
            ? 44
            : f.kind === 'skill'
              ? 52
              : f.kind === 'crit' || f.kind === 'base'
                ? 46
                : f.kind === 'heavy'
                  ? 38
                  : 30;
      const dy = easeOutCubic(p) * rise;
      const dx = f.driftX * (0.4 + p * 0.9);
      const peak =
        f.kind === 'crit'
          ? 1.75
          : f.kind === 'base'
            ? 1.7
            : f.kind === 'combo'
              ? 1.65
              : f.kind === 'skill'
                ? 1.55
                : f.kind === 'heavy'
                  ? 1.5
                  : 1.35;
      const sc = popScale(age, peak, f.kind === 'crit' ? 0.22 : 0.16);
      if (el.key !== f.id || el.text !== f.text || el.kind !== f.kind) {
        el.key = f.id;
        el.text = f.text;
        el.kind = f.kind;
        el.root.className = f.kind === 'normal' ? 'float-dmg' : `float-dmg ${f.kind}`;
        if (f.kind === 'gold') {
          el.root.innerHTML = `<img class="float-coin" src="${UI_ICON_URLS.acornCoins}" alt="" />${f.text}`;
        } else {
          el.root.textContent = f.text;
        }
      }
      el.root.style.display = 'flex';
      el.root.style.transform = `translate3d(${(proj.x + dx).toFixed(1)}px, ${(proj.y - dy).toFixed(1)}px, 0) translate(-50%,-50%) scale(${sc.toFixed(3)})`;
      el.root.style.opacity = `${Math.min(1, f.life * 2.8)}`;
    }
    for (let i = floatCount; i < this.floatPool.length; i++) {
      if (this.floatPool[i].root.style.display !== 'none') this.floatPool[i].root.style.display = 'none';
    }
  }

  private buildTutorialHtml(sim: SimulationEngine, sceneMgr: SceneManager, loc: Locale): string {
    if (this.activeStoryBeat || this.paused || sim.status !== 'playing') return '';
    const parts: string[] = [];
    if (this.tutorialPhase === 'build_tower') {
      const slot = sim.slots.get('slot_1');
      if (slot) {
        const proj = sceneMgr.projectToScreen(slot.x, 0.35, slot.z);
        parts.push(`<div class="tutorial-hand" style="left:${proj.x}px; top:${proj.y}px;">${ICONS.hand}</div>`);
      }
      parts.push(`
        <div class="tutorial-coach-pill interactive">
          <span>${t(loc, 'tutorial.step.build')}</span>
          <button type="button" class="tutorial-skip-btn" id="btn-skip-tutorial">${t(loc, 'tutorial.skip')}</button>
        </div>
      `);
    } else if (this.tutorialPhase === 'move_hero') {
      const proj = sceneMgr.projectToScreen(-1.5, 0.25, 4.0);
      parts.push(`<div class="tutorial-hand" style="left:${proj.x}px; top:${proj.y}px;">${ICONS.hand}</div>`);
      parts.push(`
        <div class="tutorial-coach-pill interactive">
          <span>${t(loc, 'tutorial.step.hero')}</span>
          <button type="button" class="tutorial-skip-btn" id="btn-skip-tutorial">${t(loc, 'tutorial.skip')}</button>
        </div>
      `);
    } else if (this.tutorialPhase === 'start_wave') {
      parts.push(`
        <div class="tutorial-coach-pill interactive">
          <span>${t(loc, 'tutorial.step.wave')}</span>
          <button type="button" class="tutorial-skip-btn" id="btn-skip-tutorial">${t(loc, 'tutorial.skip')}</button>
        </div>
      `);
    }
    return parts.join('');
  }

  private buildContextLayerHtml(sim: SimulationEngine, sceneMgr: SceneManager, loc: Locale): string {
    const parts: string[] = [];

    for (const slot of sim.slots.values()) {
      if (slot.tower && slot.tower.smokedTimer > 0) {
        const proj = sceneMgr.projectToScreen(slot.x, 1.65, slot.z);
        parts.push(
          `<button class="btn btn-gold btn-sm interactive" data-clear-smoke="${slot.id}" style="position:absolute; left:${proj.x}px; top:${proj.y}px; transform:translate(-50%,-50%);">${t(loc, 'hud.clearSmoke')}</button>`,
        );
      }
    }

    if (!this.selectedSlotId) return parts.join('');
    const slot = sim.slots.get(this.selectedSlotId);
    if (!slot) return parts.join('');

    if (slot.stumpLocked) {
      parts.push(`
        <div class="mobile-tower-dock interactive">
          <div class="dock-head-row">
            <span class="dock-title">${t(loc, 'hud.clearStump')}</span>
            <button type="button" class="dock-close-btn" id="btn-close-dock" aria-label="${t(loc, 'map.close')}">✕</button>
          </div>
          <div class="dock-actions-row">
            <button type="button" class="btn btn-gold" id="btn-clear-stump" style="flex:1;" ${sim.gold >= slot.stumpClearCost ? '' : 'disabled'}>
              ${t(loc, 'hud.clearStump')} (${slot.stumpClearCost})
            </button>
          </div>
        </div>
      `);
      return parts.join('');
    }

    const builtIds = new Set<TowerId>();
    for (const s of sim.slots.values()) {
      if (s.tower) builtIds.add(s.tower.towerId);
    }

    if (!slot.tower) {
      const previewSpec = this.previewTowerId ? TOWERS[this.previewTowerId] : null;
      const previewAllowed = previewSpec ? !sim.allowedTowers || sim.allowedTowers.includes(previewSpec.id) : false;
      const previewCanBuild = Boolean(previewSpec && previewAllowed && sim.gold >= previewSpec.tier1.cost);
      const previewPartners = previewSpec ? getActiveSynergyPartnersForTower(previewSpec.id, builtIds) : [];

      const previewHtml = previewSpec
        ? `
          <div class="mobile-build-preview">
            <img class="preview-thumb" src="${PORTRAIT_URLS[previewSpec.id]}" alt="${t(loc, previewSpec.nameKey)}" />
            <div class="preview-meta">
              <div class="preview-title-row">
                <span class="preview-name">${t(loc, previewSpec.nameKey)}</span>
                <span class="preview-target-pill ${previewSpec.canHitAir ? 'air' : ''}">${previewSpec.canHitAir ? `✈ ${t(loc, 'hud.targetAirGround')}` : `🛡 ${t(loc, 'hud.targetGround')}`}</span>
              </div>
              <div class="preview-role">${t(loc, previewSpec.roleKey)}</div>
              <div class="preview-stats-row">
                <span>⚔ ${previewSpec.tier1.damage}</span>
                <span>⚡ ${previewSpec.tier1.fireRate}/s</span>
                <span>◎ ${previewSpec.tier1.range}</span>
                ${
                  previewPartners.length > 0
                    ? `<span class="preview-syn-pill">⚡ ${t(loc, 'hud.synergyReady')}: ${previewPartners.map((cid) => t(loc, SYNERGY_COMBOS[cid].nameKey)).join(' · ')}</span>`
                    : ''
                }
              </div>
            </div>
            <button type="button" class="btn btn-sm ${previewCanBuild ? 'btn-primary' : ''}" id="btn-confirm-build" ${previewCanBuild ? '' : 'disabled'}>
              ${t(loc, 'hud.buildConfirm')} (${previewSpec.tier1.cost})
            </button>
            <button type="button" class="dock-close-btn" id="btn-close-dock" aria-label="${t(loc, 'map.close')}">✕</button>
          </div>
        `
        : `
          <div class="mobile-build-preview idle">
            <span class="preview-idle-hint">${t(loc, 'hud.buildHint')}</span>
            ${slot.runeSlot ? `<span class="rune-slot-inline">${t(loc, 'hud.runeSlotBadge')}</span>` : ''}
            <button type="button" class="dock-close-btn" id="btn-close-dock" aria-label="${t(loc, 'map.close')}">✕</button>
          </div>
        `;

      const deckCards = TOWER_LIST.map((tw) => {
        const allowed = !sim.allowedTowers || sim.allowedTowers.includes(tw.id);
        const canAfford = sim.gold >= tw.tier1.cost;
        const isSelected = this.previewTowerId === tw.id;
        const partners = allowed ? getActiveSynergyPartnersForTower(tw.id, builtIds) : [];
        return `
          <button
            type="button"
            class="build-deck-card ${isSelected ? 'selected' : ''} ${allowed ? '' : 'locked-tower'} ${allowed && !canAfford ? 'cant-afford' : ''}"
            data-build-tower="${tw.id}"
            title="${t(loc, tw.nameKey)}"
          >
            ${tw.canHitAir ? '<span class="deck-air-tag" aria-hidden="true">✈</span>' : ''}
            ${partners.length > 0 ? `<span class="deck-syn-spark" data-synergy-spark="1" title="${t(loc, 'hud.synergyReady')}">⚡</span>` : ''}
            <img src="${PORTRAIT_URLS[tw.id]}" alt="${t(loc, tw.nameKey)}" />
            <span class="deck-card-name">${t(loc, tw.nameKey)}</span>
            <span class="deck-cost-pill ${canAfford && allowed ? '' : 'unaffordable'}">${allowed ? tw.tier1.cost : '🔒'}</span>
          </button>
        `;
      }).join('');

      parts.push(`
        <div class="mobile-build-dock interactive">
          ${previewHtml}
          <div class="mobile-build-grid">${deckCards}</div>
        </div>
      `);
      return parts.join('');
    }

    const tw = slot.tower;
    const spec = TOWERS[tw.towerId];
    const curStats = sim.getTowerStats(tw);
    const refund = sim.getTowerSellRefund(tw.totalSpent);
    const starsTxt = `${'★'.repeat(tw.tier)}${'☆'.repeat(3 - tw.tier)}`;

    let statLine = `${t(loc, 'hud.damage')} ${curStats.damage} · ${t(loc, 'hud.rate')} ${curStats.fireRate} · ${t(loc, 'hud.range')} ${curStats.range}`;
    let bodyActionsHtml = '';

    if (tw.tier === 1) {
      statLine = `${t(loc, 'hud.damage')} ${curStats.damage}→${spec.tier2.damage} · ${t(loc, 'hud.rate')} ${curStats.fireRate}→${spec.tier2.fireRate} · ${t(loc, 'hud.range')} ${curStats.range}→${spec.tier2.range}`;
      bodyActionsHtml = `
        <div class="dock-actions-row">
          <button type="button" class="btn btn-primary dock-upg-btn" id="btn-tower-upgrade" ${sim.gold >= spec.tier2.cost ? '' : 'disabled'}>
            <span class="svg-ico" style="width:16px;height:16px;">${ICONS.arrowUp}</span>
            <span>${t(loc, 'hud.upgrade')} (${spec.tier2.cost})</span>
          </button>
          <button type="button" class="btn dock-sell-btn" id="btn-tower-sell">
            ${t(loc, 'hud.sellShort')} +${refund}${sim.waitingForFirstWave ? ` (${t(loc, 'hud.sellFreeTag')})` : ''}
          </button>
        </div>
      `;
    } else if (tw.tier === 2) {
      bodyActionsHtml = `
        <div class="dock-evolve-grid">
          ${spec.evolutions
            .map(
              (evo) => `
                <button type="button" class="evolve-card-btn" data-evolve="${evo.id}" ${sim.gold >= evo.stats.cost ? '' : 'disabled'}>
                  <div class="evo-btn-top">
                    <span class="evolve-name">${t(loc, evo.nameKey)}</span>
                    <span class="evolve-cost-pill">${evo.stats.cost}</span>
                  </div>
                  <div class="evo-btn-desc">${t(loc, evo.descKey)}</div>
                </button>
              `,
            )
            .join('')}
        </div>
        <div class="dock-actions-row" style="margin-top:6px;">
          <button type="button" class="btn dock-sell-btn" id="btn-tower-sell" style="width:100%;">
            ${t(loc, 'hud.sellShort')} +${refund}${sim.waitingForFirstWave ? ` (${t(loc, 'hud.sellFreeTag')})` : ''}
          </button>
        </div>
      `;
    } else {
      const synPills = getTowerSynergies(tw.towerId)
        .map((sy) => `<span class="preview-syn-pill">⚡ ${t(loc, sy.nameKey)}</span>`)
        .join('');
      bodyActionsHtml = `
        <div class="dock-actions-row">
          <div class="dock-max-pill">★ ${t(loc, 'hud.maxTier')} ${synPills}</div>
          <button type="button" class="btn dock-sell-btn" id="btn-tower-sell">
            ${t(loc, 'hud.sellShort')} +${refund}${sim.waitingForFirstWave ? ` (${t(loc, 'hud.sellFreeTag')})` : ''}
          </button>
        </div>
      `;
    }

    parts.push(`
      <div class="mobile-tower-dock interactive">
        <div class="dock-tower-head">
          <img class="tower-top-thumb" src="${PORTRAIT_URLS[tw.towerId]}" alt="${t(loc, spec.nameKey)}" />
          <div class="tower-top-meta">
            <div class="dock-title-line">
              <span class="dock-title">${t(loc, spec.nameKey)} <span style="color:var(--accent-gold);">${starsTxt}</span></span>
              <span class="preview-target-pill ${spec.canHitAir ? 'air' : ''}">${spec.canHitAir ? `✈ ${t(loc, 'hud.targetAirGround')}` : `🛡 ${t(loc, 'hud.targetGround')}`}</span>
            </div>
            <div style="font-size:11px; font-weight:800; color:var(--accent-green);">${statLine}</div>
            ${slot.runeSlot ? `<div class="rune-slot-inline">${t(loc, 'hud.runeSlotBadge')}</div>` : ''}
          </div>
          <button type="button" class="btn btn-sm" id="btn-cycle-prio">${t(loc, `priority.${tw.priority}`)}</button>
          <button type="button" class="dock-close-btn" id="btn-close-dock" aria-label="${t(loc, 'map.close')}">✕</button>
        </div>
        ${bodyActionsHtml}
      </div>
    `);

    return parts.join('');
  }

  private refreshContextNow(sim: SimulationEngine): void {
    this.lastContextKey = '';
    if (this.mountedRoot && this.lastSceneMgr) {
      this.render(this.mountedRoot, sim, this.lastSceneMgr);
    }
  }

  private bindContextEvents(host: HTMLElement, sim: SimulationEngine): void {
    host.querySelectorAll<HTMLElement>('.mobile-build-dock, .mobile-tower-dock').forEach((dock) => {
      dock.onpointerdown = (ev) => ev.stopPropagation();
    });

    const closeBtn = host.querySelector<HTMLButtonElement>('#btn-close-dock');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.selectedSlotId = null;
        this.previewTowerId = null;
        this.refreshContextNow(sim);
      };
    }

    const confirmBtn = host.querySelector<HTMLButtonElement>('#btn-confirm-build');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        if (!this.selectedSlotId || !this.previewTowerId) return;
        const twSpec = TOWERS[this.previewTowerId];
        const allowed = !sim.allowedTowers || sim.allowedTowers.includes(this.previewTowerId);
        if (!allowed || sim.gold < twSpec.tier1.cost) return;
        sim.dispatch({
          type: 'BUILD_TOWER',
          slotId: this.selectedSlotId,
          towerId: this.previewTowerId,
        });
        this.selectedSlotId = null;
        this.previewTowerId = null;
        if (this.tutorialPhase === 'build_tower') this.tutorialPhase = 'move_hero';
        this.refreshContextNow(sim);
      };
    }

    host.querySelectorAll<HTMLElement>('[data-build-tower]').forEach((btn) => {
      const tid = btn.dataset.buildTower as TowerId;
      btn.onclick = () => {
        if (!this.selectedSlotId) return;
        const allowed = !sim.allowedTowers || sim.allowedTowers.includes(tid);
        if (this.previewTowerId !== tid) {
          this.previewTowerId = tid;
          this.callbacks.onPreviewTap?.();
          this.refreshContextNow(sim);
          return;
        }
        if (!allowed || sim.gold < TOWERS[tid].tier1.cost) return;
        sim.dispatch({
          type: 'BUILD_TOWER',
          slotId: this.selectedSlotId,
          towerId: tid,
        });
        this.selectedSlotId = null;
        this.previewTowerId = null;
        if (this.tutorialPhase === 'build_tower') this.tutorialPhase = 'move_hero';
        this.refreshContextNow(sim);
      };
    });

    const upgBtn = host.querySelector<HTMLButtonElement>('#btn-tower-upgrade');
    if (upgBtn) {
      upgBtn.onclick = () => {
        if (!this.selectedSlotId) return;
        sim.dispatch({ type: 'UPGRADE_TOWER', slotId: this.selectedSlotId });
        this.refreshContextNow(sim);
      };
    }

    host.querySelectorAll<HTMLElement>('[data-evolve]').forEach((btn) => {
      btn.onclick = () => {
        if (!this.selectedSlotId) return;
        sim.dispatch({
          type: 'EVOLVE_TOWER',
          slotId: this.selectedSlotId,
          branchId: btn.dataset.evolve as never,
        });
        this.refreshContextNow(sim);
      };
    });

    const sellBtn = host.querySelector<HTMLButtonElement>('#btn-tower-sell');
    if (sellBtn) {
      sellBtn.onclick = () => {
        if (!this.selectedSlotId) return;
        sim.dispatch({ type: 'SELL_TOWER', slotId: this.selectedSlotId });
        this.selectedSlotId = null;
        this.previewTowerId = null;
        this.refreshContextNow(sim);
      };
    }

    const prioBtn = host.querySelector<HTMLButtonElement>('#btn-cycle-prio');
    if (prioBtn && this.selectedSlotId) {
      prioBtn.onclick = () => {
        const order: TargetingPriority[] = ['first', 'smart', 'strongest', 'weakest', 'closest'];
        const cur = sim.slots.get(this.selectedSlotId!)?.tower?.priority ?? 'first';
        const next = order[(order.indexOf(cur) + 1) % order.length];
        sim.dispatch({ type: 'SET_TARGETING', slotId: this.selectedSlotId!, priority: next });
        this.refreshContextNow(sim);
      };
    }

    const stumpBtn = host.querySelector<HTMLButtonElement>('#btn-clear-stump');
    if (stumpBtn && this.selectedSlotId) {
      stumpBtn.onclick = () => {
        sim.dispatch({ type: 'CLEAR_STUMP', slotId: this.selectedSlotId! });
        this.refreshContextNow(sim);
      };
    }

    host.querySelectorAll<HTMLElement>('[data-clear-smoke]').forEach((btn) => {
      btn.onclick = () => {
        sim.dispatch({ type: 'CLEAR_SMOKE', slotId: btn.dataset.clearSmoke! });
        this.refreshContextNow(sim);
      };
    });
  }

  private buildPromoToolbar(loc: Locale): string {
    return `
      <div class="promo-bar">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; color:var(--accent-gold);">
          <span>${t(loc, 'promo.title')}</span>
          <button class="btn btn-sm" id="btn-promo-hud">${this.promoHideHud ? t(loc, 'promo.hudShow') : t(loc, 'promo.hudHide')}</button>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" id="btn-promo-swarm">${t(loc, 'promo.swarmBtn')}</button>
          <button class="btn btn-sm" id="btn-promo-boss">+1 Boss</button>
        </div>
      </div>
    `;
  }

  private buildModal(sim: SimulationEngine, loc: Locale): string {
    if (this.paused && sim.status === 'playing') {
      const s = this.saveManager.get().settings;
      return `
        <div class="modal-backdrop">
          <div class="modal-card" role="dialog" aria-modal="true">
            <div style="font-size:19px; font-weight:800;">${t(loc, 'hud.paused')}</div>
            <div class="pause-audio-box">
              <div class="pause-audio-title">${t(loc, 'hud.pauseAudio')}</div>
              <div class="pause-audio-row">
                <button type="button" class="btn btn-sm ${s.soundEnabled ? 'btn-primary' : ''}" id="btn-pause-sound">
                  ${t(loc, 'settings.sound')}: ${s.soundEnabled ? 'ON' : 'OFF'}
                </button>
                <button type="button" class="btn btn-sm ${s.musicEnabled ? 'btn-primary' : ''}" id="btn-pause-music">
                  ${t(loc, 'settings.music')}: ${s.musicEnabled ? 'ON' : 'OFF'}
                </button>
                <button type="button" class="btn btn-sm ${s.hapticsEnabled ? 'btn-primary' : ''}" id="btn-pause-haptics">
                  ${t(loc, 'settings.haptics')}: ${s.hapticsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <button class="btn btn-primary" id="btn-resume">${t(loc, 'hud.resume')}</button>
            <button class="btn" id="btn-restart">${t(loc, 'hud.restart')}</button>
            <button class="btn" id="btn-exit-map">${t(loc, 'hud.exitMap')}</button>
          </div>
        </div>
      `;
    }

    if (this.activeStoryBeat && sim.status === 'playing') {
      const beat = this.activeStoryBeat;
      const heroSpec = HEROES[beat.speaker];
      return `
        <div class="modal-backdrop">
          <div class="modal-card oak-parchment-modal story-briefing-card" id="story-briefing-modal" role="dialog" aria-modal="true">
            <span class="brass-corner tl" aria-hidden="true"></span>
            <span class="brass-corner tr" aria-hidden="true"></span>
            <span class="brass-corner bl" aria-hidden="true"></span>
            <span class="brass-corner br" aria-hidden="true"></span>
            <div class="story-briefing-head">
              <img class="story-portrait" src="${PORTRAIT_URLS[beat.speaker]}" alt="${t(loc, heroSpec.nameKey)}" />
              <div style="min-width:0;">
                <span class="story-badge ${beat.isBossIntro ? 'boss' : ''}">${t(loc, beat.badgeKey)}</span>
                <div class="modal-oak-title" style="margin-top:3px;">${t(loc, beat.titleKey)}</div>
                <div class="parchment-muted" style="font-size:10.5px; font-weight:800;">${t(loc, heroSpec.nameKey)}</div>
              </div>
            </div>
            <div class="story-briefing-body">${t(loc, beat.bodyKey)}</div>
            <button class="btn btn-oak-play btn-primary" id="btn-story-continue" type="button">${t(loc, 'story.continueBtn')}</button>
          </div>
        </div>
      `;
    }

    if (sim.status === 'won') {
      const stars = computeBattleStars(sim.baseHp, sim.ironMode);
      const rewards = computeVictoryRewards(sim.level.id, stars, sim.ironMode);
      const isExpedition = sim.level.id > 100;
      const expStage = Math.max(1, sim.level.id - 100);
      const isExpeditionMid = isExpedition && expStage < 5;
      const hasNextStage = !isExpedition && sim.level.id < LEVELS.length && Boolean(this.callbacks.onNextLevel);
      const isGrandFinale = !isExpedition && sim.level.id === LEVELS.length;
      const titleText = isExpedition
        ? tParams(loc, 'rogue.stageVictory', { stage: expStage })
        : `${t(loc, 'hud.victory')} · ${'★'.repeat(stars)}`;
      const rewardLine = isExpeditionMid
        ? t(loc, 'rogue.pickTitle')
        : isExpedition
          ? `+${EXPEDITION_CLEAR_OAK} ${t(loc, 'cur.oak')} · +${EXPEDITION_CLEAR_GEMS} ${t(loc, 'cur.gem')}`
          : `+${rewards.oak} ${t(loc, 'cur.oak')} · +${rewards.gems} ${t(loc, 'cur.gem')}`;
      return `
        <div class="modal-backdrop">
          <div class="modal-card" role="dialog" aria-modal="true">
            <div style="font-size:20px; font-weight:800; color:var(--accent-gold);">${titleText}</div>
            <div style="font-size:13px; color:var(--text-muted);">${rewardLine}</div>
            ${
              isGrandFinale
                ? `
                  <div class="campaign-finale-box" id="campaign-finale-card">
                    <strong>${t(loc, 'story.finale.title')}</strong>
                    <span>${t(loc, 'story.finale.body')}</span>
                  </div>
                `
                : ''
            }
            ${
              hasNextStage
                ? `<button class="btn btn-primary" id="btn-next-level">${tParams(loc, 'hud.nextStage', { next: sim.level.id + 1 })}</button>`
                : ''
            }
            ${MONETIZATION_ENABLED && !isExpedition ? `<button class="btn btn-gold" id="btn-double-reward">${t(loc, 'hud.doubleReward')}</button>` : ''}
            <button class="btn ${hasNextStage ? '' : 'btn-primary'}" id="btn-exit-map">${isExpeditionMid ? t(loc, 'rogue.pickRelicBtn') : t(loc, 'hud.exitMap')}</button>
          </div>
        </div>
      `;
    }

    if (sim.status === 'lost') {
      const save = this.saveManager.get();
      const showFirstFailBundle = MONETIZATION_ENABLED && !save.firstDefeatBundleBought;
      const failPrices = showFirstFailBundle ? getFailOfferPrices(this.remoteConfig.get()) : null;
      const priceParams = failPrices
        ? {
            ref: failPrices.referenceUsd.toFixed(2),
            price: failPrices.priceUsd.toFixed(2),
            pct: failPrices.discountPct,
          }
        : null;
      return `
        <div class="modal-backdrop">
          <div class="modal-card" role="dialog" aria-modal="true">
            <div style="font-size:19px; font-weight:800; color:var(--accent-red);">${t(loc, 'hud.defeat')}</div>
            ${MONETIZATION_ENABLED && !sim.reviveUsed ? `<button class="btn btn-gold" id="btn-revive-ad">${t(loc, 'hud.reviveAd')}</button>` : ''}
            ${
              showFirstFailBundle && priceParams
                ? `
                  <div class="card-panel" style="border-color:var(--accent-gold); display:flex; flex-direction:column; gap:6px;">
                    <div style="font-size:11px; color:var(--accent-gold); font-weight:800;">${tParams(loc, 'offer.failBadge', { pct: priceParams.pct })}</div>
                    <div style="font-size:14px; font-weight:800;">${t(loc, 'offer.failTitle')}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${t(loc, 'offer.failBody')}</div>
                    <div style="font-size:12px; color:var(--text-muted);"><s>$${priceParams.ref}</s> · ${tParams(loc, 'offer.failPrice', priceParams)}</div>
                    <button class="btn btn-primary btn-sm" id="btn-buy-fail-offer">${tParams(loc, 'offer.buy', { price: priceParams.price })}</button>
                  </div>
                `
                : ''
            }
            <button class="btn btn-primary" id="btn-restart">${t(loc, 'hud.restart')}</button>
            <button class="btn" id="btn-exit-map">${t(loc, 'hud.exitMap')}</button>
          </div>
        </div>
      `;
    }

    return '';
  }

  private bindModalEvents(host: HTMLElement, sim: SimulationEngine): void {
    const storyContinueBtn = host.querySelector<HTMLButtonElement>('#btn-story-continue');
    if (storyContinueBtn && this.activeStoryBeat) {
      const beatId = this.activeStoryBeat.id;
      storyContinueBtn.onclick = () => {
        this.saveManager.update((d) => {
          if (!Array.isArray(d.seenStoryIds)) d.seenStoryIds = [];
          if (!d.seenStoryIds.includes(beatId)) d.seenStoryIds.push(beatId);
        });
        this.activeStoryBeat = null;
        if (this.mountedRoot && this.lastSceneMgr) {
          this.render(this.mountedRoot, sim, this.lastSceneMgr);
        }
      };
    }

    const pauseSoundBtn = host.querySelector<HTMLButtonElement>('#btn-pause-sound');
    if (pauseSoundBtn) {
      pauseSoundBtn.onclick = () => {
        this.saveManager.update((d) => { d.settings.soundEnabled = !d.settings.soundEnabled; });
        this.callbacks.onSettingsChanged?.();
      };
    }
    const pauseMusicBtn = host.querySelector<HTMLButtonElement>('#btn-pause-music');
    if (pauseMusicBtn) {
      pauseMusicBtn.onclick = () => {
        this.saveManager.update((d) => { d.settings.musicEnabled = !d.settings.musicEnabled; });
        this.callbacks.onSettingsChanged?.();
      };
    }
    const pauseHapticsBtn = host.querySelector<HTMLButtonElement>('#btn-pause-haptics');
    if (pauseHapticsBtn) {
      pauseHapticsBtn.onclick = () => {
        this.saveManager.update((d) => { d.settings.hapticsEnabled = !d.settings.hapticsEnabled; });
        this.callbacks.onSettingsChanged?.();
      };
    }

    const nextLevelBtn = host.querySelector<HTMLButtonElement>('#btn-next-level');
    if (nextLevelBtn) {
      nextLevelBtn.onclick = () => this.callbacks.onNextLevel?.(sim.level.id + 1);
    }

    const resumeBtn = host.querySelector<HTMLButtonElement>('#btn-resume');
    if (resumeBtn) resumeBtn.onclick = () => { this.paused = false; };
    const restartBtn = host.querySelector<HTMLButtonElement>('#btn-restart');
    if (restartBtn) restartBtn.onclick = () => this.callbacks.onRestart();
    const exitBtn = host.querySelector<HTMLButtonElement>('#btn-exit-map');
    if (exitBtn) exitBtn.onclick = () => this.callbacks.onExitToMap();

    const reviveBtn = host.querySelector<HTMLButtonElement>('#btn-revive-ad');
    if (reviveBtn) {
      reviveBtn.onclick = async () => {
        await this.adService.showRewarded('base_revive');
        sim.dispatch({ type: 'REVIVE_BASE' });
      };
    }

    const doubleBtn = host.querySelector<HTMLButtonElement>('#btn-double-reward');
    if (doubleBtn) {
      doubleBtn.onclick = async () => {
        await this.adService.showRewarded('victory_2x');
        const stars = computeBattleStars(sim.baseHp, sim.ironMode);
        const rewards = computeVictoryRewards(sim.level.id, stars, sim.ironMode);
        this.saveManager.update((d) => {
          d.oakCoins += rewards.oak;
          d.emeraldGems += rewards.gems;
        });
        this.callbacks.onExitToMap();
      };
    }

    const failOfferBtn = host.querySelector<HTMLButtonElement>('#btn-buy-fail-offer');
    if (failOfferBtn) {
      failOfferBtn.onclick = () => this.billingService.purchaseFirstDefeatBundle();
    }
  }
}

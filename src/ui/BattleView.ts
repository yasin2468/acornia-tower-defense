import { easeOutCubic, GhostHpTracker, popScale } from '../core/JuiceController.ts';
import type { SimulationEngine } from '../core/SimulationEngine.ts';
import { TOWER_LIST, TOWERS, type TargetingPriority, type TowerId } from '../data/towers.ts';
import { t, type Locale } from '../i18n/locales.ts';
import type { SceneManager } from '../rendering/SceneManager.ts';
import type { AdService, BillingService } from '../services/CommercialServices.ts';
import type { SaveManager } from '../services/SaveManager.ts';
import { ICONS, PORTRAIT_URLS, UI_ICON_URLS } from './icons.ts';

export interface FloatingDamage {
  id: number;
  x: number;
  z: number;
  text: string;
  life: number;
  maxLife: number;
  driftX: number;
  kind: 'normal' | 'crit' | 'gold';
}

interface BarEl {
  root: HTMLElement;
  ghost: HTMLElement;
  fill: HTMLElement;
}

interface FloatEl {
  root: HTMLElement;
  key: number;
}

export interface BattleViewCallbacks {
  onRestart: () => void;
  onExitToMap: () => void;
}

export class BattleView {
  selectedSlotId: string | null = null;
  targetingSkill: 'rain' | null = null;
  speedMultiplier: 1 | 2 | 3 = 1;
  speed2xUnlockedThisMatch = false;
  paused = false;
  bannerText = '';
  bannerTimer = 0;
  floatingDamages: FloatingDamage[] = [];
  tutorialPhase: 'intro' | 'build_tower' | 'move_hero' | 'done' = 'done';
  promoMode = false;
  promoHideHud = false;

  private readonly saveManager: SaveManager;
  private readonly adService: AdService;
  private readonly billingService: BillingService;
  private readonly callbacks: BattleViewCallbacks;

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
  private modalHostEl: HTMLElement | null = null;
  private hudTopEl: HTMLElement | null = null;
  private hudBottomEl: HTMLElement | null = null;
  private promoHudBtnEl: HTMLButtonElement | null = null;

  private lastContextKey = '';
  private lastModalKey = '';

  /** Delayed white/amber "ghost damage" trail for every enemy HP bar. */
  readonly ghostHp = new GhostHpTracker(0.3, 0.45, 5.5);
  private fxPoolEl: HTMLElement | null = null;
  private tutorialLayerEl: HTMLElement | null = null;
  private barPool: BarEl[] = [];
  private floatPool: FloatEl[] = [];
  private floatSeq = 0;
  private lastTutorialHtml = '';

  constructor(
    saveManager: SaveManager,
    adService: AdService,
    billingService: BillingService,
    callbacks: BattleViewCallbacks,
    promoMode = false,
  ) {
    this.saveManager = saveManager;
    this.adService = adService;
    this.billingService = billingService;
    this.callbacks = callbacks;
    this.promoMode = promoMode;
  }

  resetForLevel(levelId: number): void {
    this.selectedSlotId = null;
    this.targetingSkill = null;
    this.speedMultiplier = this.saveManager.get().vipTier === 'none' ? 1 : 2;
    this.speed2xUnlockedThisMatch = this.saveManager.get().vipTier !== 'none';
    this.paused = false;
    this.bannerText = '';
    this.bannerTimer = 0;
    this.floatingDamages = [];
    this.ghostHp.clear();
    this.barPool = [];
    this.floatPool = [];
    this.lastTutorialHtml = '';
    this.tutorialPhase = levelId === 1 && !this.saveManager.get().tutorialDone ? 'intro' : 'done';
    this.mountedRoot = null;
    this.lastContextKey = '';
    this.lastModalKey = '';
  }

  showBanner(text: string, seconds = 3.2): void {
    this.bannerText = text;
    this.bannerTimer = seconds;
  }

  addFloatingDamage(x: number, z: number, text: string, kind: 'normal' | 'crit' | 'gold' = 'normal'): void {
    const life = kind === 'crit' ? 0.92 : kind === 'gold' ? 0.9 : 0.68;
    const driftX = ((this.floatingDamages.length % 5) - 2) * 7 + (Math.random() - 0.5) * 6;
    this.floatSeq += 1;
    this.floatingDamages.push({ id: this.floatSeq, x, z, text, life, maxLife: life, driftX, kind });
    if (this.floatingDamages.length > 24) this.floatingDamages.shift();
  }

  updateTimers(dt: number, sim: SimulationEngine): void {
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    for (const f of this.floatingDamages) f.life -= dt;
    this.floatingDamages = this.floatingDamages.filter((f) => f.life > 0);

    const alive = new Set<number>();
    for (const e of sim.enemies) {
      alive.add(e.uid);
      this.ghostHp.update(e.uid, e.maxHp > 0 ? e.hp / e.maxHp : 0, dt);
    }
    this.ghostHp.prune(alive);

    if (this.tutorialPhase === 'intro' && sim.elapsed >= 2.2) {
      this.tutorialPhase = 'build_tower';
    }
  }

  mount(container: HTMLElement, sim: SimulationEngine): void {
    const loc = this.saveManager.get().settings.locale;
    container.innerHTML = `
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

      <div class="banner-toast" id="bw-banner" style="display:none;"></div>

      <div class="hud-bottom" id="bw-hud-bottom">
        <div class="hud-controls">
          <button class="btn btn-gold btn-sm" id="bw-early-wave" style="display:none;"></button>
        </div>
        <div class="hud-controls">
          <button class="tactile-sq-btn" id="bw-speed">x1</button>
          <button class="tactile-sq-btn" id="bw-pause"><span class="svg-ico">${ICONS.pause}</span></button>
          <button class="skill-medallion-btn" id="bw-skill-rain" title="${t(loc, 'skill.rain')}">
            <img src="${UI_ICON_URLS.skillRain}" alt="${t(loc, 'skill.rain')}" />
            <span class="cd-badge" id="bw-rain-cd" style="display:none;"></span>
          </button>
          <button class="skill-medallion-btn" id="bw-skill-magnet" title="${t(loc, 'skill.magnet')}">
            <img src="${UI_ICON_URLS.skillMagnet}" alt="${t(loc, 'skill.magnet')}" />
            <span class="cd-badge" id="bw-magnet-cd" style="display:none;"></span>
          </button>
        </div>
      </div>
      <div id="bw-modal-host"></div>
    `;

    this.mountedRoot = container;
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
    this.rainBtnEl = container.querySelector('#bw-skill-rain');
    this.rainCdEl = container.querySelector('#bw-rain-cd');
    this.magnetBtnEl = container.querySelector('#bw-skill-magnet');
    this.magnetCdEl = container.querySelector('#bw-magnet-cd');
    this.modalHostEl = container.querySelector('#bw-modal-host');
    this.hudTopEl = container.querySelector('#bw-hud-top');
    this.hudBottomEl = container.querySelector('#bw-hud-bottom');
    this.promoHudBtnEl = container.querySelector('#btn-promo-hud');

    this.bindStaticEvents(container, sim);
  }

  private bindStaticEvents(container: HTMLElement, sim: SimulationEngine): void {
    if (this.earlyBtnEl) {
      this.earlyBtnEl.onclick = () => sim.dispatch({ type: 'CALL_WAVE_EARLY' });
    }
    if (this.speedBtnEl) {
      this.speedBtnEl.onclick = async () => {
        if (this.speedMultiplier === 1) {
          if (!this.speed2xUnlockedThisMatch) {
            const res = await this.adService.showRewarded('speed_2x');
            if (!res.rewarded) return;
            this.speed2xUnlockedThisMatch = true;
          }
          this.speedMultiplier = 2;
        } else if (this.speedMultiplier === 2 && this.saveManager.get().vipTier !== 'none') {
          this.speedMultiplier = 3;
        } else {
          this.speedMultiplier = 1;
        }
      };
    }
    const pauseBtn = container.querySelector<HTMLButtonElement>('#bw-pause');
    if (pauseBtn) pauseBtn.onclick = () => { this.paused = true; };

    if (this.rainBtnEl) {
      this.rainBtnEl.onclick = () => {
        if (sim.pineconeRainCooldown > 0) return;
        this.targetingSkill = this.targetingSkill === 'rain' ? null : 'rain';
      };
    }
    if (this.magnetBtnEl) {
      this.magnetBtnEl.onclick = () => sim.dispatch({ type: 'CAST_ACORN_MAGNET' });
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
    if (this.mountedRoot !== container) {
      this.mount(container, sim);
    }

    const save = this.saveManager.get();
    const loc = save.settings.locale;
    const waveNum = Math.max(1, sim.currentWaveIndex + 1);
    const totalWaves = sim.level.waves.length;
    const hpPct = Math.max(0, Math.min(100, (sim.baseHp / sim.maxBaseHp) * 100));

    if (this.hudTopEl && this.hudBottomEl) {
      const hide = this.promoMode && this.promoHideHud;
      this.hudTopEl.style.display = hide ? 'none' : 'flex';
      this.hudBottomEl.style.display = hide ? 'none' : 'flex';
    }
    if (this.promoHudBtnEl) {
      this.promoHudBtnEl.textContent = this.promoHideHud ? 'HUD Aç' : 'HUD Gizle';
    }

    if (this.hpTextEl) this.hpTextEl.textContent = `${Math.ceil(sim.baseHp)}/${sim.maxBaseHp}`;
    if (this.hpFillEl) this.hpFillEl.style.width = `${hpPct}%`;
    if (this.waveTextEl) this.waveTextEl.textContent = `${t(loc, 'hud.wave')} ${waveNum}/${totalWaves}`;
    if (this.goldTextEl) this.goldTextEl.textContent = `${sim.gold}`;

    if (this.bannerEl) {
      const showBanner = this.bannerTimer > 0 && Boolean(this.bannerText);
      this.bannerEl.style.display = showBanner ? 'block' : 'none';
      if (showBanner) this.bannerEl.textContent = this.bannerText;
    }

    if (this.earlyBtnEl) {
      const canCallEarly = !sim.waveInProgress && sim.currentWaveIndex + 1 < totalWaves;
      this.earlyBtnEl.style.display = canCallEarly ? 'inline-flex' : 'none';
      if (canCallEarly) {
        this.earlyBtnEl.textContent = `${t(loc, 'hud.earlyWave')} (${Math.ceil(sim.waveCountdown)}s)`;
      }
    }

    if (this.speedBtnEl) this.speedBtnEl.textContent = `x${this.speedMultiplier}`;
    if (this.rainBtnEl) this.rainBtnEl.classList.toggle('active', this.targetingSkill === 'rain');
    if (this.rainCdEl) {
      this.rainCdEl.style.display = sim.pineconeRainCooldown > 0 ? 'flex' : 'none';
      if (sim.pineconeRainCooldown > 0) this.rainCdEl.textContent = `${Math.ceil(sim.pineconeRainCooldown)}`;
    }
    if (this.magnetBtnEl) this.magnetBtnEl.classList.toggle('active', sim.magnetActiveTimer > 0);
    if (this.magnetCdEl) {
      this.magnetCdEl.style.display = sim.magnetCooldown > 0 ? 'flex' : 'none';
      if (sim.magnetCooldown > 0) this.magnetCdEl.textContent = `${Math.ceil(sim.magnetCooldown)}`;
    }

    if (this.tutorialLayerEl) {
      const tutHtml = this.buildTutorialHtml(sim, sceneMgr);
      if (tutHtml !== this.lastTutorialHtml) {
        this.lastTutorialHtml = tutHtml;
        this.tutorialLayerEl.innerHTML = tutHtml;
      }
    }

    const selSlot = this.selectedSlotId ? sim.slots.get(this.selectedSlotId) : undefined;
    const smokedSlots = Array.from(sim.slots.values())
      .filter((s) => s.tower && s.tower.smokedTimer > 0)
      .map((s) => s.id)
      .join(',');
    const contextKey = `${this.selectedSlotId ?? 'none'}|${selSlot?.stumpLocked ? 'stump' : selSlot?.tower ? `${selSlot.tower.towerId}_${selSlot.tower.tier}_${selSlot.tower.priority}` : 'empty'}|${sim.gold}|${this.tutorialPhase}|${smokedSlots}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      const contextHost = container.querySelector<HTMLElement>('#bw-context-layer');
      if (contextHost) {
        contextHost.innerHTML = this.buildContextLayerHtml(sim, sceneMgr, loc);
        this.bindContextEvents(contextHost, sim);
      }
    }

    const modalKey = `${this.paused}|${sim.status}|${sim.reviveUsed}|${save.firstDefeatBundleBought}`;
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
      this.floatPool.push({ root, key: -1 });
    }
    return this.floatPool[i];
  }

  /**
   * Per-frame world overlay (pooled DOM, no innerHTML churn): enemy HP bars with an instant
   * fill drop + delayed ghost-damage trail, and pop-scaled floating damage / coin numbers.
   */
  renderOverlay(sim: SimulationEngine, sceneMgr: SceneManager): void {
    if (!this.fxPoolEl || !this.mountedRoot) return;
    let barCount = 0;
    for (const e of sim.enemies) {
      if (e.hp <= 0) continue;
      const g = this.ghostHp.get(e.uid);
      const hp = g ? g.hp : e.hp / e.maxHp;
      const ghost = g ? g.ghost : hp;
      if (hp >= 0.9999 && ghost >= 0.9999) continue;
      const proj = sceneMgr.projectToScreen(e.x, e.isFlying ? 2.15 : e.isBoss ? 2.3 : 1.38, e.z);
      if (!proj.visible) continue;
      const bar = this.acquireBar(barCount);
      if (!bar) break;
      barCount += 1;
      const hitAge = g ? g.hitAge : Number.POSITIVE_INFINITY;
      const w = e.isBoss ? 64 : 38;
      // Tiny vertical "bump" on fresh damage so chunk hits read even on small bars
      const bump = hitAge < 0.12 ? (1 - hitAge / 0.12) * 2.5 : 0;
      bar.root.style.display = 'block';
      bar.root.style.width = `${w}px`;
      bar.root.style.transform = `translate3d(${(proj.x - w / 2).toFixed(1)}px, ${(proj.y - 6 - bump).toFixed(1)}px, 0)`;
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
      const proj = sceneMgr.projectToScreen(f.x, 1.55, f.z);
      if (!proj.visible) continue;
      const el = this.acquireFloat(floatCount);
      if (!el) break;
      floatCount += 1;
      const age = f.maxLife - f.life;
      const p = Math.max(0, Math.min(1, age / f.maxLife));
      const rise = f.kind === 'gold' ? 44 : f.kind === 'crit' ? 40 : 32;
      const dy = easeOutCubic(p) * rise;
      const dx = f.driftX * (0.4 + p * 0.9);
      const sc = popScale(age, 1.35, f.kind === 'crit' ? 0.2 : 0.16);
      if (el.key !== f.id) {
        el.key = f.id;
        el.root.className = f.kind === 'crit' ? 'float-dmg crit' : f.kind === 'gold' ? 'float-dmg gold' : 'float-dmg';
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

  private buildTutorialHtml(sim: SimulationEngine, sceneMgr: SceneManager): string {
    const parts: string[] = [];
    if (this.tutorialPhase === 'build_tower') {
      const slot = sim.slots.get('slot_1');
      if (slot) {
        const proj = sceneMgr.projectToScreen(slot.x, 0.35, slot.z);
        parts.push(`<div class="tutorial-hand" style="left:${proj.x}px; top:${proj.y}px;">${ICONS.hand}</div>`);
      }
    } else if (this.tutorialPhase === 'move_hero') {
      const proj = sceneMgr.projectToScreen(-1.5, 0.25, 4.0);
      parts.push(`<div class="tutorial-hand" style="left:${proj.x}px; top:${proj.y}px;">${ICONS.hand}</div>`);
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

    const proj = sceneMgr.projectToScreen(slot.x, 0.4, slot.z);
    const clampedX = Math.max(126, Math.min(264, proj.x));
    const clampedY = Math.max(165, Math.min(540, proj.y));

    if (slot.stumpLocked) {
      parts.push(`
        <div class="tower-hud-anchor" style="left:${clampedX}px; top:${clampedY}px;">
          <div class="tower-top-pill" style="min-width:168px; justify-content:center;">
            <button class="btn btn-gold btn-sm" id="btn-clear-stump" ${sim.gold >= slot.stumpClearCost ? '' : 'disabled'}>
              ${t(loc, 'hud.clearStump')} (${slot.stumpClearCost})
            </button>
          </div>
        </div>
      `);
      return parts.join('');
    }

    if (!slot.tower) {
      const positions: Array<{ left: string; top: string }> = [
        { left: '24px', top: '30px' },
        { left: '162px', top: '30px' },
        { left: '24px', top: '154px' },
        { left: '162px', top: '154px' },
      ];
      const rings = TOWER_LIST.map((tw, idx) => {
        const p = positions[idx];
        return `
          <button class="radial-btn" style="left:${p.left}; top:${p.top};" data-build-tower="${tw.id}" ${sim.gold >= tw.tier1.cost ? '' : 'disabled'} title="${t(loc, tw.nameKey)}">
            <img src="${PORTRAIT_URLS[tw.id]}" alt="${t(loc, tw.nameKey)}" />
            <span class="radial-cost">${tw.tier1.cost}</span>
          </button>
        `;
      }).join('');

      parts.push(`
        <div class="radial-ring" style="left:${clampedX}px; top:${clampedY}px;">
          <div class="radial-halo"></div>
          ${rings}
        </div>
      `);
      return parts.join('');
    }

    const tw = slot.tower;
    const spec = TOWERS[tw.towerId];
    const curStats = sim.getTowerStats(tw);
    const refund = Math.floor(tw.totalSpent * 0.6);
    const starsTxt = `${'★'.repeat(tw.tier)}${'☆'.repeat(3 - tw.tier)}`;

    let statLine = `${t(loc, 'hud.damage')} ${curStats.damage} · ${t(loc, 'hud.rate')} ${curStats.fireRate} · ${t(loc, 'hud.range')} ${curStats.range}`;
    let actionsHtml = '';

    if (tw.tier === 1) {
      statLine = `${t(loc, 'hud.damage')} ${curStats.damage}→${spec.tier2.damage} · ${t(loc, 'hud.rate')} ${curStats.fireRate}→${spec.tier2.fireRate}`;
      actionsHtml = `
        <button class="tower-round-action sell" id="btn-tower-sell">
          <span style="font-size:9px; opacity:0.85;">SAT</span>
          <span>+${refund}</span>
        </button>
        <button class="tower-round-action upgrade" id="btn-tower-upgrade" ${sim.gold >= spec.tier2.cost ? '' : 'disabled'}>
          <span class="svg-ico" style="width:18px;height:18px;">${ICONS.arrowUp}</span>
          <span>${spec.tier2.cost}</span>
        </button>
      `;
    } else if (tw.tier === 2) {
      actionsHtml = `
        <div class="tower-evolve-grid">
          ${spec.evolutions
            .map(
              (evo) => `
                <button class="evolve-card-btn" data-evolve="${evo.id}" ${sim.gold >= evo.stats.cost ? '' : 'disabled'}>
                  <span class="evolve-name">${t(loc, evo.nameKey)}</span>
                  <span class="evolve-cost-pill">${evo.stats.cost}</span>
                </button>
              `,
            )
            .join('')}
        </div>
        <button class="tower-round-action sell bottom" id="btn-tower-sell">
          <span>SAT +${refund}</span>
        </button>
      `;
    } else {
      actionsHtml = `
        <button class="tower-round-action sell" id="btn-tower-sell">
          <span style="font-size:9px; opacity:0.85;">SAT</span>
          <span>+${refund}</span>
        </button>
      `;
    }

    parts.push(`
      <div class="tower-hud-anchor" style="left:${clampedX}px; top:${clampedY}px;">
        <div class="tower-top-pill">
          <img class="tower-top-thumb" src="${PORTRAIT_URLS[tw.towerId]}" alt="" />
          <div class="tower-top-meta">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:800; gap:6px;">
              <span>${t(loc, spec.nameKey)} <span style="color:var(--accent-gold);">${starsTxt}</span></span>
              <button class="btn btn-sm" id="btn-cycle-prio" style="padding:2px 7px; font-size:10px;">${t(loc, `priority.${tw.priority}`)}</button>
            </div>
            <div style="font-size:10.5px; font-weight:800; color:var(--accent-green);">${statLine}</div>
          </div>
        </div>
        ${actionsHtml}
      </div>
    `);

    return parts.join('');
  }

  private bindContextEvents(host: HTMLElement, sim: SimulationEngine): void {
    host.querySelectorAll<HTMLElement>('[data-build-tower]').forEach((btn) => {
      btn.onclick = () => {
        if (!this.selectedSlotId) return;
        sim.dispatch({
          type: 'BUILD_TOWER',
          slotId: this.selectedSlotId,
          towerId: btn.dataset.buildTower as TowerId,
        });
        this.selectedSlotId = null;
        if (this.tutorialPhase === 'build_tower') this.tutorialPhase = 'move_hero';
      };
    });

    const upgBtn = host.querySelector<HTMLButtonElement>('#btn-tower-upgrade');
    if (upgBtn) {
      upgBtn.onclick = () => {
        if (this.selectedSlotId) sim.dispatch({ type: 'UPGRADE_TOWER', slotId: this.selectedSlotId });
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
      };
    });

    const sellBtn = host.querySelector<HTMLButtonElement>('#btn-tower-sell');
    if (sellBtn) {
      sellBtn.onclick = () => {
        if (!this.selectedSlotId) return;
        sim.dispatch({ type: 'SELL_TOWER', slotId: this.selectedSlotId });
        this.selectedSlotId = null;
      };
    }

    const prioBtn = host.querySelector<HTMLButtonElement>('#btn-cycle-prio');
    if (prioBtn && this.selectedSlotId) {
      prioBtn.onclick = () => {
        const order: TargetingPriority[] = ['first', 'strongest', 'weakest', 'closest'];
        const cur = sim.slots.get(this.selectedSlotId!)?.tower?.priority ?? 'first';
        const next = order[(order.indexOf(cur) + 1) % order.length];
        sim.dispatch({ type: 'SET_TARGETING', slotId: this.selectedSlotId!, priority: next });
      };
    }

    const stumpBtn = host.querySelector<HTMLButtonElement>('#btn-clear-stump');
    if (stumpBtn && this.selectedSlotId) {
      stumpBtn.onclick = () => sim.dispatch({ type: 'CLEAR_STUMP', slotId: this.selectedSlotId! });
    }

    host.querySelectorAll<HTMLElement>('[data-clear-smoke]').forEach((btn) => {
      btn.onclick = () => sim.dispatch({ type: 'CLEAR_SMOKE', slotId: btn.dataset.clearSmoke! });
    });
  }

  private buildPromoToolbar(loc: Locale): string {
    return `
      <div class="promo-bar">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; color:var(--accent-gold);">
          <span>${t(loc, 'promo.title')}</span>
          <button class="btn btn-sm" id="btn-promo-hud">${this.promoHideHud ? 'HUD Aç' : 'HUD Gizle'}</button>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" id="btn-promo-swarm">+30 Testere Sürüsü</button>
          <button class="btn btn-sm" id="btn-promo-boss">+1 Boss</button>
        </div>
      </div>
    `;
  }

  private buildModal(sim: SimulationEngine, loc: Locale): string {
    if (this.paused && sim.status === 'playing') {
      return `
        <div class="modal-backdrop">
          <div class="modal-card">
            <div style="font-size:19px; font-weight:800;">${t(loc, 'hud.paused')}</div>
            <button class="btn btn-primary" id="btn-resume">${t(loc, 'hud.resume')}</button>
            <button class="btn" id="btn-restart">${t(loc, 'hud.restart')}</button>
            <button class="btn" id="btn-exit-map">${t(loc, 'hud.exitMap')}</button>
          </div>
        </div>
      `;
    }

    if (sim.status === 'won') {
      const stars = sim.ironMode ? 3 : sim.baseHp >= 135 ? 3 : sim.baseHp >= 80 ? 2 : 1;
      return `
        <div class="modal-backdrop">
          <div class="modal-card">
            <div style="font-size:20px; font-weight:800; color:var(--accent-gold);">${t(loc, 'hud.victory')} · ${'★'.repeat(stars)}</div>
            <div style="font-size:13px; color:var(--text-muted);">+120 Palamut · +15 Zümrüt</div>
            <button class="btn btn-gold" id="btn-double-reward">${t(loc, 'hud.doubleReward')}</button>
            <button class="btn btn-primary" id="btn-exit-map">${t(loc, 'hud.exitMap')}</button>
          </div>
        </div>
      `;
    }

    if (sim.status === 'lost') {
      const save = this.saveManager.get();
      const showFirstFailBundle = !save.firstDefeatBundleBought;
      return `
        <div class="modal-backdrop">
          <div class="modal-card">
            <div style="font-size:19px; font-weight:800; color:var(--accent-red);">${t(loc, 'hud.defeat')}</div>
            ${!sim.reviveUsed ? `<button class="btn btn-gold" id="btn-revive-ad">${t(loc, 'hud.reviveAd')}</button>` : ''}
            ${
              showFirstFailBundle
                ? `
                  <div class="card-panel" style="border-color:var(--accent-gold); display:flex; flex-direction:column; gap:6px;">
                    <div style="font-size:11px; color:var(--accent-gold); font-weight:800;">${t(loc, 'offer.failBadge')}</div>
                    <div style="font-size:14px; font-weight:800;">${t(loc, 'offer.failTitle')}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${t(loc, 'offer.failBody')}</div>
                    <button class="btn btn-primary btn-sm" id="btn-buy-fail-offer">${t(loc, 'offer.buy')}</button>
                  </div>
                `
                : ''
            }
            <button class="btn" id="btn-restart">${t(loc, 'hud.restart')}</button>
            <button class="btn" id="btn-exit-map">${t(loc, 'hud.exitMap')}</button>
          </div>
        </div>
      `;
    }

    return '';
  }

  private bindModalEvents(host: HTMLElement, sim: SimulationEngine): void {
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
        this.saveManager.update((d) => {
          d.oakCoins += 120;
          d.emeraldGems += 15;
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

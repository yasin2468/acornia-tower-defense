import { ENEMIES, ENEMY_LIST, HERO_CLASSES, type EnemyId, type HeroClassId } from '../data/enemies.ts';
import { LEVELS, WORLD_MAP_NODES, isLevelUnlocked, type LevelSpec } from '../data/levels.ts';
import {
  TALENT_BRANCHES,
  TALENT_MAX_RANK,
  computeAvailableTalentStars,
  computeSpentTalentStars,
  getNextTalentCost,
  type TalentBranchId,
} from '../data/talents.ts';
import { TOWER_LIST, TOWERS, type HatId, type TowerId } from '../data/towers.ts';
import { t, tParams, type Locale } from '../i18n/locales.ts';
import {
  claimVipDaily,
  getVipDailyStatus,
  isVipActive,
  VIP_DAILY_CLAIM_GEMS,
  VIP_LIFETIME_GEMS,
  type VipDailyStatus,
  type AdService,
  type BillingService,
} from '../services/CommercialServices.ts';
import type { NetworkService } from '../services/NetworkService.ts';
import type { MultiMode } from '../server/wsRelay.ts';
import {
  AFK_QUICK_BOOST_HOURS,
  AFK_QUICK_BOOST_OAK,
  AFK_QUICK_BOOST_TOTAL_SHARDS,
  calculateAfkAccumulation,
  claimAfkPatrol,
  getCardUpgradeCost,
  grantQuickAfkBoost,
  openForestChest,
  resetTalents,
  upgradeCard,
  upgradeTalent,
} from '../services/ProgressionService.ts';
import type { CardUnitId, SaveManager } from '../services/SaveManager.ts';
import { ICONS, PORTRAIT_URLS, UI_ICON_URLS } from './icons.ts';

export type MetaTab = 'map' | 'multi' | 'cards' | 'shop';

export interface MetaViewCallbacks {
  onStartLevel: (levelId: number, ironMode: boolean) => void;
  onRefresh: () => void;
}

export class MetaView {
  activeTab: MetaTab = 'map';
  selectedLevelId = 1;
  ironMode = false;
  showSettings = false;
  showBestiary = false;
  multiMode: MultiMode = 'coop';
  roomCode = '';
  statusNotice = '';

  private readonly saveManager: SaveManager;
  private readonly adService: AdService;
  private readonly billingService: BillingService;
  private readonly network: NetworkService;
  private readonly callbacks: MetaViewCallbacks;

  constructor(
    saveManager: SaveManager,
    adService: AdService,
    billingService: BillingService,
    network: NetworkService,
    callbacks: MetaViewCallbacks,
  ) {
    this.saveManager = saveManager;
    this.adService = adService;
    this.billingService = billingService;
    this.network = network;
    this.callbacks = callbacks;
  }

  render(container: HTMLElement): void {
    const save = this.saveManager.get();
    const loc = save.settings.locale;
    const totalStars = Object.values(save.levelStars).reduce((a, b) => a + b, 0);

    container.innerHTML = `
      <div class="meta-screen">
        <header class="meta-header">
          <div>
            <div class="brand-title">${t(loc, 'app.title')}</div>
            <div class="brand-sub">${t(loc, 'app.subtitle')}</div>
          </div>
          <div class="wallet-row">
            <span class="pill-badge gold"><img src="${UI_ICON_URLS.acornCoins}" alt="" />${save.oakCoins}</span>
            <span class="pill-badge gem"><img src="${UI_ICON_URLS.gems}" alt="" />${save.emeraldGems}</span>
            <span class="pill-badge" style="padding-left:8px;"><span class="svg-ico" style="width:15px;height:15px;">${ICONS.star}</span>${totalStars}</span>
            <button class="icon-btn" id="btn-settings" aria-label="${t(loc, 'settings.title')}">
              <span class="svg-ico">${ICONS.gear}</span>
            </button>
          </div>
        </header>
        <main class="meta-body" id="meta-body">
          ${this.statusNotice ? `<div class="card-panel" style="border-color: var(--accent-gold); font-size: 12px; font-weight:700;">${this.statusNotice}</div>` : ''}
          ${this.renderTabBody(loc)}
        </main>
        <nav class="bottom-nav">
          <button class="nav-tab ${this.activeTab === 'map' ? 'active' : ''}" data-tab="map">
            <span class="svg-ico">${ICONS.map}</span><span>${t(loc, 'nav.map')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'multi' ? 'active' : ''}" data-tab="multi">
            <span class="svg-ico">${ICONS.users}</span><span>${t(loc, 'nav.multi')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'cards' ? 'active' : ''}" data-tab="cards">
            <span class="svg-ico">${ICONS.cards}</span><span>${t(loc, 'nav.cards')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'shop' ? 'active' : ''}" data-tab="shop">
            <span class="svg-ico">${ICONS.shop}</span><span>${t(loc, 'nav.shop')}</span>
          </button>
        </nav>
        ${this.showSettings ? this.renderSettingsModal(loc) : ''}
        ${this.showBestiary ? this.renderBestiaryModal(loc) : ''}
      </div>
    `;

    this.bindEvents(container, loc);
  }

  private renderTabBody(loc: Locale): string {
    if (this.activeTab === 'map') return this.renderMapTab(loc);
    if (this.activeTab === 'multi') return this.renderMultiTab(loc);
    if (this.activeTab === 'cards') return this.renderCardsTab(loc);
    return this.renderShopTab(loc);
  }

  private buildSmoothTrailPath(pts: Array<{ xPct: number; yPct: number }>): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].xPct} ${pts[0].yPct}`;
    const tension = 0.22;
    let d = `M ${pts[0].xPct.toFixed(2)} ${pts[0].yPct.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.xPct + (p2.xPct - p0.xPct) * tension;
      const cp1y = p1.yPct + (p2.yPct - p0.yPct) * tension;
      const cp2x = p2.xPct - (p3.xPct - p1.xPct) * tension;
      const cp2y = p2.yPct - (p3.yPct - p1.yPct) * tension;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.xPct.toFixed(2)} ${p2.yPct.toFixed(2)}`;
    }
    return d;
  }

  private getStageUniqueEnemies(level: LevelSpec): EnemyId[] {
    const seen = new Set<EnemyId>();
    const list: EnemyId[] = [];
    for (const w of level.waves) {
      for (const g of w.groups) {
        if (!seen.has(g.enemyId)) {
          seen.add(g.enemyId);
          list.push(g.enemyId);
        }
      }
    }
    return list;
  }

  private renderMapTab(loc: Locale): string {
    const save = this.saveManager.get();
    const afk = calculateAfkAccumulation(save);
    const selLevel = LEVELS.find((l) => l.id === this.selectedLevelId) ?? LEVELS[0];
    const hasCleared = (save.levelStars[selLevel.id] ?? 0) > 0;
    const selUnlocked = isLevelUnlocked(selLevel.id, save.levelStars);

    const frontierNode = WORLD_MAP_NODES.find(
      (n) => isLevelUnlocked(n.id, save.levelStars) && (save.levelStars[n.id] ?? 0) === 0,
    );
    let maxUnlockedIdx = 0;
    WORLD_MAP_NODES.forEach((n, idx) => {
      if (isLevelUnlocked(n.id, save.levelStars)) maxUnlockedIdx = idx;
    });

    const fullPathD = this.buildSmoothTrailPath(WORLD_MAP_NODES);
    const unlockedPathD = this.buildSmoothTrailPath(WORLD_MAP_NODES.slice(0, maxUnlockedIdx + 1));

    const nodesHtml = WORLD_MAP_NODES.map((n) => {
      const unlocked = isLevelUnlocked(n.id, save.levelStars);
      const stars = save.levelStars[n.id] ?? 0;
      const isSelected = n.id === this.selectedLevelId;
      const isFrontier = frontierNode?.id === n.id;

      const stateClass = stars > 0 ? 'cleared' : unlocked ? 'unlocked' : 'locked';
      const iconSvg = n.isBossStage
        ? ICONS.skullCrown
        : !unlocked
          ? ICONS.lock
          : stars > 0
            ? ICONS.bastion
            : ICONS.swords;

      const starPips =
        stars > 0
          ? `<span class="stage-pin-stars">${[1, 2, 3].map((idx) => `<span class="${idx <= stars ? 'on' : ''}">★</span>`).join('')}</span>`
          : '';

      return `
        <button
          type="button"
          class="stage-pin biome-${n.biome} ${stateClass} ${n.isBossStage ? 'boss' : ''} ${isFrontier ? 'frontier' : ''} ${isSelected ? 'selected' : ''}"
          style="left: ${n.xPct}%; top: ${n.yPct}%;"
          data-level="${n.id}"
          aria-label="${n.id}. ${t(loc, n.nameKey)}"
        >
          <span class="stage-crest">
            <span class="svg-ico stage-crest-ico">${iconSvg}</span>
          </span>
          <span class="stage-pin-ribbon">${n.id}</span>
          ${starPips}
        </button>
      `;
    }).join('');

    const stageEnemies = this.getStageUniqueEnemies(selLevel);
    const threatsHtml = stageEnemies
      .map((eid) => {
        const spec = ENEMIES[eid];
        return `
          <button type="button" class="threat-chip ${spec.isBoss ? 'boss' : ''}" data-open-bestiary="1">
            <span class="threat-dot" style="background:${spec.color}; border-color:${spec.accentColor};"></span>
            <span>${t(loc, spec.nameKey)}</span>
            ${spec.isBoss ? `<span class="threat-boss-tag">${t(loc, 'map.bossTag')}</span>` : ''}
          </button>
        `;
      })
      .join('');

    return `
      <div class="card-panel afk-bar">
        <div style="display:flex; align-items:center; gap:9px;">
          <img class="afk-chest-thumb" src="${UI_ICON_URLS.chestFree}" alt="" />
          <div>
            <div style="font-size: 13px; font-weight: 800;">${t(loc, 'map.afk.title')} · ${afk.hoursElapsed}/${t(loc, afk.capHours === 16 ? 'afk.duration16' : 'afk.duration8')}</div>
            <div style="font-size: 11px; color: var(--text-muted);">+${afk.oakCoins} Palamut · +${afk.shards} Kart (${tParams(loc, 'map.afk.vip', { duration: t(loc, 'afk.duration16') })})</div>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm btn-gold" id="btn-afk-claim" ${afk.oakCoins < 1 ? 'disabled' : ''}>${t(loc, 'map.afk.collect')}</button>
          <button class="btn btn-sm" id="btn-afk-boost">${tParams(loc, 'map.afk.boost', { amount: AFK_QUICK_BOOST_OAK, hours: AFK_QUICK_BOOST_HOURS })}</button>
        </div>
      </div>

      <div class="world-map-box">
        <svg class="world-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="${fullPathD}" fill="none" stroke="rgba(12, 18, 28, 0.56)" stroke-width="2.5" stroke-linecap="round" />
          <path d="${fullPathD}" fill="none" stroke="rgba(220, 232, 245, 0.36)" stroke-width="1.25" stroke-dasharray="1.1 2.3" stroke-linecap="round" />
          <path d="${unlockedPathD}" fill="none" stroke="rgba(255, 226, 122, 0.88)" stroke-width="1.65" stroke-dasharray="1.4 2.2" stroke-linecap="round" />
        </svg>
        <div class="biome-tag biome-tag-snow" style="top: 8px; left: 8px;">IV · ${t(loc, 'map.biome.snow')}</div>
        <div class="biome-tag biome-tag-cavern" style="top: 28%; left: 8px;">III · ${t(loc, 'map.biome.cavern')}</div>
        <div class="biome-tag biome-tag-canyon" style="top: 62%; left: 8px;">II · ${t(loc, 'map.biome.canyon')}</div>
        <div class="biome-tag biome-tag-forest" style="bottom: 8px; left: 8px;">I · ${t(loc, 'map.biome.forest')}</div>
        <button type="button" class="map-bestiary-btn" id="btn-open-bestiary">
          <span class="svg-ico" style="width:14px;height:14px;">${ICONS.bestiary}</span>
          <span>${t(loc, 'map.bestiary')} · ${ENEMY_LIST.length}</span>
        </button>
        ${nodesHtml}
      </div>

      <div class="card-panel stage-briefing">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
              <span class="stage-biome-pill biome-${selLevel.biome}">${t(loc, `map.biome.${selLevel.biome}`)}</span>
              ${selLevel.isBossStage ? `<span class="stage-boss-pill">${t(loc, 'map.bossStage')}</span>` : ''}
            </div>
            <div style="font-size:15px; font-weight:900;">${selLevel.id}. ${t(loc, selLevel.nameKey)}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">${selLevel.waves.length} ${t(loc, 'hud.wave')} · ${selLevel.startGold} Palamut</div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn btn-sm ${!this.ironMode ? 'btn-primary' : ''}" id="btn-mode-normal" ${selUnlocked ? '' : 'disabled'}>${t(loc, 'map.mode.normal')}</button>
            <button class="btn btn-sm ${this.ironMode ? 'btn-gold' : ''}" id="btn-mode-iron" ${selUnlocked && hasCleared ? '' : 'disabled'}>${t(loc, 'map.mode.iron')}</button>
          </div>
        </div>

        <div class="stage-threats-wrap">
          <div class="stage-threats-label">${t(loc, 'map.threats')} (${stageEnemies.length})</div>
          <div class="stage-threats">${threatsHtml}</div>
        </div>

        <button class="btn ${selUnlocked ? 'btn-primary' : ''}" id="btn-start-level" style="width:100%; padding:12px; font-size:14.5px;" ${selUnlocked ? '' : 'disabled'}>
          <span class="svg-ico">${selUnlocked ? ICONS.play : ICONS.lock}</span>
          <span>${selUnlocked ? t(loc, 'map.play') : t(loc, 'map.lockedHint')}</span>
        </button>
      </div>
    `;
  }

  private renderBestiaryModal(loc: Locale): string {
    const rowsHtml = ENEMY_LIST.map((e) => {
      const biomeLabel = e.biomeTag ? t(loc, `map.biome.${e.biomeTag}`) : '';
      return `
        <div class="bestiary-row ${e.isBoss ? 'boss' : ''}">
          <div class="bestiary-swatch" style="background: linear-gradient(155deg, ${e.color} 0%, ${e.accentColor} 100%);">
            <span class="svg-ico" style="width:18px;height:18px;color:#ffffff;">${e.isBoss ? ICONS.skullCrown : ICONS.swords}</span>
          </div>
          <div class="bestiary-info">
            <div class="bestiary-head">
              <span class="bestiary-name">${t(loc, e.nameKey)}</span>
              <span class="bestiary-tags">
                ${e.isBoss ? `<span class="b-tag boss">${t(loc, 'map.bossTag')}</span>` : ''}
                ${e.isFlying ? `<span class="b-tag air">${t(loc, 'map.flying')}</span>` : ''}
                <span class="b-tag">${biomeLabel}</span>
              </span>
            </div>
            <div class="bestiary-stats">${t(loc, 'bestiary.hp')} ${e.baseHp} · ${t(loc, 'bestiary.speed')} ${e.speed} · ${t(loc, 'bestiary.armor')} %${Math.round(e.armor * 100)}</div>
            <div class="bestiary-desc">${t(loc, e.descKey)}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="modal-backdrop">
        <div class="modal-card bestiary-modal">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
              <div style="font-size:16px; font-weight:900; color:#ffe17a;">${t(loc, 'map.bestiary')} (${ENEMY_LIST.length})</div>
              <div style="font-size:11px; color:var(--text-muted);">${t(loc, 'map.bestiarySub')}</div>
            </div>
            <button class="btn btn-sm btn-primary" id="btn-close-bestiary">${t(loc, 'map.close')}</button>
          </div>
          <div class="bestiary-list">${rowsHtml}</div>
        </div>
      </div>
    `;
  }

  private renderMultiTab(loc: Locale): string {
    const wsOnline = this.network.connected;
    const isCoop = this.multiMode === 'coop';
    const liveHint =
      this.network.state === 'waiting_room'
        ? tParams(loc, 'multi.waitingPeer', { code: this.network.roomCode })
        : this.network.state === 'matching'
          ? t(loc, 'multi.matching')
          : '';
    return `
      <div class="card-panel" style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-size:16px; font-weight:800;">${t(loc, 'multi.title')}</div>
          <span class="pill-badge" style="font-size:10px; ${wsOnline ? 'border-color:#5ef28e; color:#8cf7b0;' : 'color:var(--text-muted);'}">${wsOnline ? t(loc, 'multi.wsOnline') : t(loc, 'multi.wsBotMode')}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button class="btn btn-sm ${isCoop ? 'btn-gold' : 'btn-dark'}" data-multi-mode="coop">${t(loc, 'multi.modeCoop')}</button>
          <button class="btn btn-sm ${!isCoop ? 'btn-gold' : 'btn-dark'}" data-multi-mode="pvp">${t(loc, 'multi.modePvp')}</button>
        </div>
        <div style="font-size:12px; color:var(--text-muted);">${isCoop ? `${t(loc, 'multi.coopName')} — ${t(loc, 'multi.coopDesc')}` : `${t(loc, 'multi.pvpName')} — ${t(loc, 'multi.pvpDesc')}`}</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <input id="input-room" value="${this.roomCode}" maxlength="4" placeholder="4821"
            style="flex:1; min-width:72px; padding:10px 12px; border-radius:12px; border:2px solid rgba(255,255,255,0.16); background:var(--bg-deep); color:#fff; font-family:inherit; font-size:15px; font-weight:700;" />
          <button class="btn btn-primary btn-sm" id="btn-join-room">${t(loc, 'multi.joinRoom')}</button>
          <button class="btn btn-gold btn-sm" id="btn-create-room">${t(loc, 'multi.createRoom')}</button>
        </div>
        <button class="btn btn-primary" id="btn-quick-match">${t(loc, 'multi.quickMatch')}</button>
        ${liveHint ? `<div style="font-size:12px; font-weight:700; color:var(--accent-gold);">${liveHint}</div>` : ''}
      </div>
    `;
  }

  private renderCardsTab(loc: Locale): string {
    const save = this.saveManager.get();
    const units: Array<{ id: CardUnitId; label: string; portraitUrl: string }> = [
      ...TOWER_LIST.map((tw) => ({
        id: tw.id as CardUnitId,
        label: t(loc, tw.nameKey),
        portraitUrl: PORTRAIT_URLS[tw.id],
      })),
      { id: 'boz_pence', label: t(loc, 'hero.boz_pence.name'), portraitUrl: PORTRAIT_URLS.boz_pence },
    ];

    const cardsHtml = units
      .map((u) => {
        const lvl = save.cardLevels[u.id];
        const shards = save.cardShards[u.id];
        const cost = getCardUpgradeCost(lvl);
        const pct = Math.min(100, Math.round((shards / cost.shards) * 100));
        const canUpgrade = shards >= cost.shards && save.oakCoins >= cost.oakCoins;
        const spec = u.id in TOWERS ? TOWERS[u.id as TowerId] : null;
        const branchNote = spec
          ? `${t(loc, spec.evolutions[0].nameKey)} / ${t(loc, spec.evolutions[1].nameKey)}`
          : t(loc, HERO_CLASSES[save.heroClass].nameKey);
        return `
          <div class="collector-card">
            <span class="collector-level-badge">${t(loc, 'cards.level')}${lvl}</span>
            <img class="collector-portrait" src="${u.portraitUrl}" alt="${u.label}" />
            <div class="collector-name">${u.label}</div>
            <div class="collector-sub">${branchNote}</div>
            <div class="shard-bar">
              <div class="shard-bar-fill" style="width:${pct}%"></div>
              <span class="shard-bar-text">${shards}/${cost.shards}</span>
            </div>
            <button class="btn btn-sm ${canUpgrade ? 'btn-primary' : ''}" style="width:100%;" data-card-up="${u.id}" ${canUpgrade ? '' : 'disabled'}>
              ${t(loc, 'cards.upgrade')} (${cost.oakCoins})
            </button>
          </div>
        `;
      })
      .join('');

    const classIds: HeroClassId[] = ['auto', 'classic', 'viking', 'royal'];
    const activeCls = HERO_CLASSES[save.heroClass];
    const classesHtml = classIds
      .map((cid) => {
        const spec = HERO_CLASSES[cid];
        const active = save.heroClass === cid;
        return `
          <button class="btn btn-sm ${active ? 'btn-gold' : ''}" data-hero-class="${cid}" title="${t(loc, spec.descKey)}">
            ${t(loc, spec.nameKey)}
          </button>
        `;
      })
      .join('');

    const hats: HatId[] = ['none', 'pirate', 'chef', 'wizard', 'viking'];
    const hatsHtml = hats
      .map((h) => {
        const unlocked = save.unlockedHats.includes(h);
        const active = save.equippedHat === h;
        return `
          <button class="btn btn-sm ${active ? 'btn-gold' : ''}" data-hat="${h}" ${unlocked ? '' : 'disabled'}>
            ${t(loc, `hat.${h}`)}
          </button>
        `;
      })
      .join('');

    const availableStars = computeAvailableTalentStars(save.levelStars, save.ironCleared, save.talents);
    const spentStars = computeSpentTalentStars(save.talents);
    const talentsHtml = TALENT_BRANCHES.map((b) => {
      const rank = save.talents[b.id] ?? 0;
      const cost = getNextTalentCost(rank);
      const canBuy = cost !== null && availableStars >= cost;
      const pips = Array.from({ length: TALENT_MAX_RANK }, (_, idx) => `<span class="talent-pip ${idx < rank ? 'on' : ''}"></span>`).join('');
      return `
        <div class="talent-branch-card">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="font-size:12.5px; font-weight:900; color:#ffffff;">${t(loc, b.nameKey)}</div>
            <span class="collector-level-badge" style="position:static;">${rank}/${TALENT_MAX_RANK}</span>
          </div>
          <div style="font-size:10.5px; color:var(--text-muted); font-weight:700;">${t(loc, b.descKey)}</div>
          <div style="font-size:10px; color:var(--accent-cyan); font-weight:700;">${t(loc, b.capKey)}</div>
          <div class="talent-pips">${pips}</div>
          <button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" data-talent-up="${b.id}" ${canBuy ? '' : 'disabled'}>
            ${cost === null ? t(loc, 'talent.maxed') : tParams(loc, 'talent.upgradeCost', { cost })}
          </button>
        </div>
      `;
    }).join('');

    return `
      <div style="font-size:15px; font-weight:900; color:#ffe17a;">${t(loc, 'cards.title')}</div>
      <div class="collector-grid">${cardsHtml}</div>
      <div class="card-panel" style="display:flex; flex-direction:column; gap:8px; border-color: rgba(255, 202, 69, 0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <div>
            <div style="font-size:13.5px; font-weight:900; color:#ffe17a;">${t(loc, 'talent.title')}</div>
            <div style="font-size:11px; color:var(--accent-gold); font-weight:800;">${tParams(loc, 'talent.available', { stars: availableStars })}</div>
          </div>
          <button class="btn btn-sm" id="btn-talent-reset" ${spentStars > 0 ? '' : 'disabled'}>${t(loc, 'talent.reset')}</button>
        </div>
        <div class="talent-grid">${talentsHtml}</div>
      </div>
      <div class="card-panel" style="display:flex; flex-direction:column; gap:8px; border-color: rgba(255, 202, 69, 0.35);">
        <div style="font-size:13px; font-weight:800; color:#ffe17a;">${t(loc, 'hero.class.title')}</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${classesHtml}</div>
        <div style="font-size:11.5px; color:var(--text-muted); font-weight:700;">${t(loc, activeCls.descKey)}</div>
      </div>
      <div class="card-panel" style="display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:13px; font-weight:800;">${t(loc, 'cards.hats')}</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${hatsHtml}</div>
      </div>
    `;
  }

  private renderShopTab(loc: Locale): string {
    const save = this.saveManager.get();
    const nowMs = Date.now();
    const vipStatus = getVipDailyStatus(save, nowMs);
    const vipActive = isVipActive(save, nowMs);

    return `
      <div class="card-panel" style="border-color: var(--accent-gold); background: linear-gradient(180deg, #3c3118 0%, #201a11 100%); display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:16px; font-weight:900; color:#ffe17a;">${t(loc, 'shop.vipTitle')}</div>
          ${vipActive ? `<span class="pill-badge gold">${t(loc, 'shop.vipActive')} (${save.vipTier})</span>` : ''}
        </div>
        <div style="font-size:12px; color:#f2e2be;">${tParams(loc, 'shop.vipPerks', { daily: VIP_DAILY_CLAIM_GEMS, lump: VIP_LIFETIME_GEMS, duration: t(loc, 'afk.duration16') })}</div>
        ${save.vipTier !== 'none' ? this.renderVipClaimSection(loc, vipStatus) : ''}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button class="btn btn-gold btn-sm" id="btn-vip-monthly">${t(loc, 'shop.vipMonthly')}</button>
          <button class="btn btn-primary btn-sm" id="btn-vip-lifetime">${t(loc, 'shop.vipLifetime')}</button>
        </div>
      </div>

      <div style="font-size:15px; font-weight:900; color:#ffe17a;">${t(loc, 'shop.chests')}</div>
      <div class="chest-grid">
        <div class="chest-card">
          <img src="${UI_ICON_URLS.chestFree}" alt="${t(loc, 'shop.freeChest')}" />
          <div style="font-size:12.5px; font-weight:800;">${t(loc, 'shop.freeChest')}</div>
          <div style="font-size:11px; color:var(--text-muted);">${2 - save.dailyFreeChestsUsed}/2 ${t(loc, 'shop.chestsRemaining')}</div>
          <button class="btn btn-primary btn-sm" style="width:100%;" id="btn-chest-free" ${save.dailyFreeChestsUsed >= 2 ? 'disabled' : ''}>${t(loc, 'shop.openChest')}</button>
        </div>
        <div class="chest-card epic">
          <img src="${UI_ICON_URLS.chestEpic}" alt="${t(loc, 'shop.epicChest')}" />
          <div style="font-size:12.5px; font-weight:800;">${t(loc, 'shop.epicChest')}</div>
          <div style="font-size:11px; color:var(--accent-cyan);">${t(loc, 'shop.epicChestContents')}</div>
          <button class="btn btn-gold btn-sm" style="width:100%;" id="btn-chest-epic" ${save.emeraldGems >= 120 ? '' : 'disabled'}>120 ${t(loc, 'cur.gem')}</button>
        </div>
      </div>
      <div style="margin-top:6px; font-size:11px; color:var(--text-muted);">
        <span style="font-weight:800; color:#e4d9bd;">${t(loc, 'shop.odds.title')}:</span> ${t(loc, 'shop.odds.body')}
      </div>
    `;
  }

  private renderVipClaimSection(loc: Locale, vip: VipDailyStatus): string {
    if (vip.reason === 'lifetime') {
      return `<div style="font-size:11.5px; color:var(--text-muted);">${tParams(loc, 'shop.vipLifetimeNote', { gems: VIP_LIFETIME_GEMS })}</div>`;
    }
    if (vip.reason === 'expired') {
      return `<div style="font-size:11.5px; color:var(--accent-red); font-weight:800;">${t(loc, 'shop.vipExpired')}</div>`;
    }
    const daysLeft = Math.ceil(vip.vipRemainingMs / (24 * 3600 * 1000));
    const remainingText = tParams(loc, 'shop.vipTimeLeft', { days: daysLeft });
    const nextClaimText =
      vip.reason === 'cooldown'
        ? `<br/>${tParams(loc, 'shop.vipNextClaim', { hours: Math.ceil(vip.nextClaimInMs / (3600 * 1000)) })}`
        : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div style="font-size:11.5px; color:var(--text-muted);">${remainingText}${nextClaimText}</div>
        <button class="btn btn-gold btn-sm" id="btn-vip-claim" ${vip.canClaim ? '' : 'disabled'}>${tParams(loc, 'shop.vipClaim', { gems: VIP_DAILY_CLAIM_GEMS })}</button>
      </div>
    `;
  }

  private renderSettingsModal(loc: Locale): string {
    const s = this.saveManager.get().settings;
    return `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:17px; font-weight:800;">${t(loc, 'settings.title')}</span>
            <button class="btn btn-sm btn-primary" id="btn-close-settings">OK</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:700;">
            <span>${t(loc, 'settings.language')}</span>
            <button class="btn btn-sm" id="btn-toggle-lang">${s.locale.toUpperCase()}</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:700;">
            <span>${t(loc, 'settings.sound')}</span>
            <button class="game-switch ${s.soundEnabled ? 'on' : ''}" id="chk-sound" type="button" aria-pressed="${s.soundEnabled}">
              <span class="game-switch-knob"></span>
            </button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:700;">
            <span>${t(loc, 'settings.battery')}</span>
            <button class="game-switch ${s.batterySaver30Fps ? 'on' : ''}" id="chk-battery" type="button" aria-pressed="${s.batterySaver30Fps}">
              <span class="game-switch-knob"></span>
            </button>
          </div>
          <label style="display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:700;">
            <span>${t(loc, 'settings.shake')}: ${s.shakeStrength}%</span>
            <input type="range" id="rng-shake" min="0" max="100" value="${s.shakeStrength}" />
          </label>
        </div>
      </div>
    `;
  }

  private bindEvents(container: HTMLElement, loc: Locale): void {
    container.querySelectorAll<HTMLElement>('[data-tab]').forEach((btn) => {
      btn.onclick = () => {
        this.activeTab = btn.dataset.tab as MetaTab;
        this.statusNotice = '';
        if (this.activeTab === 'multi' && !this.network.connected) {
          void this.network.connect();
        }
        this.callbacks.onRefresh();
      };
    });

    container.querySelectorAll<HTMLElement>('[data-multi-mode]').forEach((btn) => {
      btn.onclick = () => {
        this.multiMode = (btn.dataset.multiMode as MultiMode) ?? 'coop';
        this.callbacks.onRefresh();
      };
    });

    const inputRoom = container.querySelector<HTMLInputElement>('#input-room');
    if (inputRoom) {
      inputRoom.oninput = () => {
        this.roomCode = inputRoom.value.replace(/\D/g, '').slice(0, 4);
      };
    }

    container.querySelectorAll<HTMLElement>('[data-level]').forEach((btn) => {
      btn.onclick = () => {
        this.selectedLevelId = Number(btn.dataset.level);
        this.ironMode = false;
        this.callbacks.onRefresh();
      };
    });

    const startBtn = container.querySelector<HTMLButtonElement>('#btn-start-level');
    if (startBtn) startBtn.onclick = () => this.callbacks.onStartLevel(this.selectedLevelId, this.ironMode);

    const normalBtn = container.querySelector<HTMLButtonElement>('#btn-mode-normal');
    const ironBtn = container.querySelector<HTMLButtonElement>('#btn-mode-iron');
    if (normalBtn) normalBtn.onclick = () => { this.ironMode = false; this.callbacks.onRefresh(); };
    if (ironBtn) ironBtn.onclick = () => { this.ironMode = true; this.callbacks.onRefresh(); };

    const afkClaim = container.querySelector<HTMLButtonElement>('#btn-afk-claim');
    if (afkClaim) {
      afkClaim.onclick = () => {
        const reward = claimAfkPatrol(this.saveManager);
        this.statusNotice = `+${reward.oakCoins} Palamut, +${reward.shards} Kart`;
        this.callbacks.onRefresh();
      };
    }

    const afkBoost = container.querySelector<HTMLButtonElement>('#btn-afk-boost');
    if (afkBoost) {
      afkBoost.onclick = async () => {
        await this.adService.showRewarded('afk_boost_4h');
        const ok = grantQuickAfkBoost(this.saveManager);
        this.statusNotice = ok
          ? tParams(loc, 'map.afk.boostGranted', { amount: AFK_QUICK_BOOST_OAK, cards: AFK_QUICK_BOOST_TOTAL_SHARDS })
          : '2/2';
        this.callbacks.onRefresh();
      };
    }

    container.querySelectorAll<HTMLElement>('[data-card-up]').forEach((btn) => {
      btn.onclick = () => {
        upgradeCard(this.saveManager, btn.dataset.cardUp as CardUnitId);
        this.callbacks.onRefresh();
      };
    });

    container.querySelectorAll<HTMLElement>('[data-talent-up]').forEach((btn) => {
      btn.onclick = () => {
        upgradeTalent(this.saveManager, btn.dataset.talentUp as TalentBranchId);
        this.callbacks.onRefresh();
      };
    });

    const resetTalentBtn = container.querySelector<HTMLButtonElement>('#btn-talent-reset');
    if (resetTalentBtn) {
      resetTalentBtn.onclick = () => {
        resetTalents(this.saveManager);
        this.callbacks.onRefresh();
      };
    }

    container.querySelectorAll<HTMLElement>('[data-hero-class]').forEach((btn) => {
      btn.onclick = () => {
        const heroClass = btn.dataset.heroClass as HeroClassId;
        this.saveManager.update((s) => { s.heroClass = heroClass; });
        this.callbacks.onRefresh();
      };
    });

    container.querySelectorAll<HTMLElement>('[data-hat]').forEach((btn) => {
      btn.onclick = () => {
        const hat = btn.dataset.hat as HatId;
        this.saveManager.update((s) => { s.equippedHat = hat; });
        this.callbacks.onRefresh();
      };
    });

    const vipMonthly = container.querySelector<HTMLButtonElement>('#btn-vip-monthly');
    const vipLifetime = container.querySelector<HTMLButtonElement>('#btn-vip-lifetime');
    if (vipMonthly) vipMonthly.onclick = () => { this.billingService.purchaseVip('monthly'); this.statusNotice = `${t(loc, 'shop.vipActive')} (Monthly)`; this.callbacks.onRefresh(); };
    if (vipLifetime) vipLifetime.onclick = () => { this.billingService.purchaseVip('lifetime'); this.statusNotice = `${t(loc, 'shop.vipActive')} (Lifetime)`; this.callbacks.onRefresh(); };

    const vipClaim = container.querySelector<HTMLButtonElement>('#btn-vip-claim');
    if (vipClaim) {
      vipClaim.onclick = () => {
        const res = claimVipDaily(this.saveManager);
        if (res.claimed) this.statusNotice = `+${res.gemsGranted} ${t(loc, 'cur.gem')}`;
        this.callbacks.onRefresh();
      };
    }

    const freeChest = container.querySelector<HTMLButtonElement>('#btn-chest-free');
    if (freeChest) {
      freeChest.onclick = async () => {
        const s = this.saveManager.get();
        if (s.dailyFreeChestsUsed >= 2) return;
        await this.adService.showRewarded('daily_chest');
        this.saveManager.update((d) => { d.dailyFreeChestsUsed += 1; });
        const rw = openForestChest(this.saveManager, 'common');
        this.statusNotice = `+${rw.oakCoins} ${t(loc, 'cur.oak')}, +${rw.gems} ${t(loc, 'cur.gem')}`;
        this.callbacks.onRefresh();
      };
    }

    const epicChest = container.querySelector<HTMLButtonElement>('#btn-chest-epic');
    if (epicChest) {
      epicChest.onclick = () => {
        if (this.saveManager.get().emeraldGems < 120) return;
        this.saveManager.update((d) => { d.emeraldGems -= 120; });
        const rw = openForestChest(this.saveManager, 'epic');
        this.statusNotice = `+${rw.oakCoins} ${t(loc, 'cur.oak')}, ${t(loc, 'cards.plusTen')}`;
        this.callbacks.onRefresh();
      };
    }

    const createRoom = container.querySelector<HTMLButtonElement>('#btn-create-room');
    if (createRoom) {
      createRoom.onclick = async () => {
        const code = await this.network.createRoom(this.multiMode, this.selectedLevelId);
        this.roomCode = code;
        this.statusNotice = `${tParams(loc, 'multi.waitingPeer', { code })} (?room=${code})`;
        this.callbacks.onRefresh();
      };
    }

    const joinRoom = container.querySelector<HTMLButtonElement>('#btn-join-room');
    if (joinRoom) {
      joinRoom.onclick = async () => {
        const code = (container.querySelector<HTMLInputElement>('#input-room')?.value ?? this.roomCode).trim();
        this.roomCode = code;
        if (!/^\d{4}$/.test(code)) return;
        const ok = await this.network.joinRoom(code);
        if (!ok) {
          this.statusNotice = t(loc, 'multi.errNotFound');
          this.callbacks.onRefresh();
        }
      };
    }

    const quickMatch = container.querySelector<HTMLButtonElement>('#btn-quick-match');
    if (quickMatch) {
      quickMatch.onclick = async () => {
        this.statusNotice = t(loc, 'multi.matching');
        this.callbacks.onRefresh();
        await this.network.quickMatch(this.multiMode, this.selectedLevelId, 3000);
      };
    }

    const btnSettings = container.querySelector<HTMLButtonElement>('#btn-settings');
    if (btnSettings) btnSettings.onclick = () => { this.showSettings = true; this.callbacks.onRefresh(); };

    const closeSettings = container.querySelector<HTMLButtonElement>('#btn-close-settings');
    if (closeSettings) closeSettings.onclick = () => { this.showSettings = false; this.callbacks.onRefresh(); };

    const toggleLang = container.querySelector<HTMLButtonElement>('#btn-toggle-lang');
    if (toggleLang) {
      toggleLang.onclick = () => {
        this.saveManager.update((d) => { d.settings.locale = d.settings.locale === 'tr' ? 'en' : 'tr'; });
        this.callbacks.onRefresh();
      };
    }

    const chkSound = container.querySelector<HTMLButtonElement>('#chk-sound');
    if (chkSound) {
      chkSound.onclick = () => {
        this.saveManager.update((d) => { d.settings.soundEnabled = !d.settings.soundEnabled; });
        this.callbacks.onRefresh();
      };
    }

    const chkBattery = container.querySelector<HTMLButtonElement>('#chk-battery');
    if (chkBattery) {
      chkBattery.onclick = () => {
        this.saveManager.update((d) => { d.settings.batterySaver30Fps = !d.settings.batterySaver30Fps; });
        this.callbacks.onRefresh();
      };
    }

    const rngShake = container.querySelector<HTMLInputElement>('#rng-shake');
    if (rngShake) {
      rngShake.oninput = () => {
        this.saveManager.update((d) => { d.settings.shakeStrength = Number(rngShake.value); });
      };
    }

    const openBestiary = container.querySelector<HTMLButtonElement>('#btn-open-bestiary');
    if (openBestiary) {
      openBestiary.onclick = () => {
        this.showBestiary = true;
        this.callbacks.onRefresh();
      };
    }
    container.querySelectorAll<HTMLElement>('[data-open-bestiary]').forEach((el) => {
      el.onclick = () => {
        this.showBestiary = true;
        this.callbacks.onRefresh();
      };
    });
    const closeBestiary = container.querySelector<HTMLButtonElement>('#btn-close-bestiary');
    if (closeBestiary) {
      closeBestiary.onclick = () => {
        this.showBestiary = false;
        this.callbacks.onRefresh();
      };
    }
  }
}

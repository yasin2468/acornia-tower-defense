import {
  ENEMIES,
  ENEMY_LIST,
  HEROES,
  HERO_CLASSES,
  HERO_LIST,
  type EnemyId,
  type HeroClassId,
  type HeroId,
} from '../data/enemies.ts';
import { LEVELS, WORLD_MAP_NODES, isLevelUnlocked, type LevelSpec } from '../data/levels.ts';
import {
  RELICS,
  chooseExpeditionRelic,
  startNewExpedition,
  type RelicId,
} from '../data/roguelike.ts';
import {
  KILLS_PER_SEASON_TIER,
  LEAGUE_TIERS,
  SEASON_MAX_TIER,
  claimLeagueTierReward,
  claimSeasonTierReward,
  ensureLeagueSeason,
  ensureSeasonPassWindow,
  getLeagueLeaderboard,
  getLeagueTierForTrophies,
  getSeasonCurrentTier,
  getSeasonTierRewards,
  type LeagueTierId,
  type SeasonRewardSpec,
} from '../data/season.ts';
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
  JOURNAL_REWARD_GEMS,
  calculateAfkAccumulation,
  claimAfkPatrol,
  claimJournalReward,
  getCardUpgradeCost,
  getJournalCatalog,
  grantQuickAfkBoost,
  openForestChest,
  resetTalents,
  unlockHeroWithGems,
  upgradeCard,
  upgradeTalent,
} from '../services/ProgressionService.ts';
import type { CardUnitId, SaveManager } from '../services/SaveManager.ts';
import { getEnemyBadgeUrl, ICONS, OAK_UI_URLS, PORTRAIT_URLS, UI_ICON_URLS } from './icons.ts';

export type MetaTab = 'map' | 'multi' | 'cards' | 'journal' | 'shop';
export type CardsSubTab = 'towers' | 'heroes' | 'talents';

interface NavBadges {
  map: string;
  multi: string;
  cards: string;
  journal: string;
  shop: string;
  towersSub: number;
  heroesSub: number;
  talentsSub: number;
}

export interface MetaViewCallbacks {
  onStartLevel: (levelId: number, ironMode: boolean) => void;
  onStartExpedition: () => void;
  onDevUnlock?: () => void;
  onRefresh: () => void;
}

export class MetaView {
  activeTab: MetaTab = 'map';
  cardsSubTab: CardsSubTab = 'towers';
  selectedLevelId = 1;
  ironMode = false;
  showSettings = false;
  showBestiary = false;
  showPatrolModal = false;
  showExpeditionModal = false;
  selectedJournalId = 'boz_pence';
  journalYaw = 0.45;
  multiMode: MultiMode = 'coop';
  roomCode = '';
  statusNotice = '';

  private readonly saveManager: SaveManager;
  private readonly adService: AdService;
  private readonly billingService: BillingService;
  private readonly network: NetworkService;
  private readonly callbacks: MetaViewCallbacks;
  private escKeyHandler: ((ev: KeyboardEvent) => void) | null = null;

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

  private computeNavBadges(nowMs: number): NavBadges {
    const save = this.saveManager.get();
    const afk = calculateAfkAccumulation(save, nowMs);

    const hasExpeditionPick = Boolean(save.activeExpedition && save.activeExpedition.pendingRelicChoices.length > 0);
    const map = hasExpeditionPick || afk.oakCoins >= 1 ? '!' : '';

    const hasLeagueClaim = LEAGUE_TIERS.some(
      (tier) =>
        tier.id !== 'oak' &&
        save.trophies >= tier.minTrophies &&
        !save.claimedLeagueTiers.includes(tier.id),
    );
    const multi = hasLeagueClaim ? '!' : '';

    let towersSub = 0;
    for (const tw of TOWER_LIST) {
      const lvl = save.cardLevels[tw.id] ?? 1;
      const cost = getCardUpgradeCost(lvl);
      if ((save.cardShards[tw.id] ?? 0) >= cost.shards && save.oakCoins >= cost.oakCoins) {
        towersSub += 1;
      }
    }

    let heroesSub = 0;
    for (const h of HERO_LIST) {
      const unlocked = save.unlockedHeroes.includes(h.id);
      if (unlocked) {
        const lvl = save.cardLevels[h.id] ?? 1;
        const cost = getCardUpgradeCost(lvl);
        if ((save.cardShards[h.id] ?? 0) >= cost.shards && save.oakCoins >= cost.oakCoins) {
          heroesSub += 1;
        }
      } else if (h.gemUnlockCost > 0 && save.emeraldGems >= h.gemUnlockCost) {
        heroesSub += 1;
      }
    }

    const availableStars = computeAvailableTalentStars(save.levelStars, save.ironCleared, save.talents);
    let talentsSub = 0;
    for (const b of TALENT_BRANCHES) {
      const cost = getNextTalentCost(save.talents[b.id] ?? 0);
      if (cost !== null && availableStars >= cost) {
        talentsSub += 1;
      }
    }

    const totalCardActions = towersSub + heroesSub + talentsSub;
    const cards = totalCardActions > 0 ? String(totalCardActions) : '';

    const unclaimedJournal = getJournalCatalog().filter(
      (entry) => save.discoveredIds.includes(entry.id) && !save.claimedJournalIds.includes(entry.id),
    ).length;
    const journal = unclaimedJournal > 0 ? String(unclaimedJournal) : '';

    const vipStatus = getVipDailyStatus(save, nowMs);
    const curTier = getSeasonCurrentTier(save.seasonPassKills);
    let hasSeasonClaim = false;
    for (let tier = 1; tier <= curTier; tier++) {
      const freeOk = !save.claimedSeasonFreeTiers.includes(tier);
      const goldOk = save.seasonGoldUnlocked && !save.claimedSeasonGoldTiers.includes(tier);
      if (freeOk || goldOk) {
        hasSeasonClaim = true;
        break;
      }
    }
    const shop =
      save.dailyFreeChestsUsed < 2 || vipStatus.canClaim || hasSeasonClaim ? '!' : '';

    return { map, multi, cards, journal, shop, towersSub, heroesSub, talentsSub };
  }

  render(container: HTMLElement): void {
    const nowMs = Date.now();
    const save = this.saveManager.get();
    const loc = save.settings.locale;
    const totalStars = Object.values(save.levelStars).reduce((a, b) => a + b, 0);
    const badges = this.computeNavBadges(nowMs);

    const navBadgeHtml = (text: string, variant: 'green' | 'red' = 'green'): string =>
      text ? `<span class="nav-pip ${variant}" aria-hidden="true">${text}</span>` : '';

    container.innerHTML = `
      <div class="meta-screen ${this.activeTab === 'map' ? 'is-map-tab' : ''}" data-kenney-skin="oak-parchment">
        <header class="meta-header">
          <div class="oak-brand-plaque">
            <span class="brass-rivet tl" aria-hidden="true"></span>
            <span class="brass-rivet tr" aria-hidden="true"></span>
            <span class="brass-rivet bl" aria-hidden="true"></span>
            <span class="brass-rivet br" aria-hidden="true"></span>
            <div class="brand-title-stack">
              <span>${t(loc, 'app.titleLine1')}</span>
              <span>${t(loc, 'app.titleLine2')}</span>
            </div>
          </div>
          <div class="wallet-row">
            <div class="oak-stat-col gold">
              <img src="${UI_ICON_URLS.acornCoins}" alt="" />
              <span>${save.oakCoins}</span>
            </div>
            <div class="oak-stat-col gem">
              <img src="${UI_ICON_URLS.gems}" alt="" />
              <span>${save.emeraldGems}</span>
            </div>
            <div class="oak-stat-col star">
              <img src="${OAK_UI_URLS.star3d}" alt="" />
              <span>${totalStars}</span>
            </div>
            <button class="oak-gear-btn" id="btn-settings" aria-label="${t(loc, 'settings.title')}">
              <img src="${OAK_UI_URLS.gearWood}" alt="" />
            </button>
          </div>
        </header>
        <main class="meta-body ${this.activeTab === 'map' ? 'meta-body-map' : ''}" id="meta-body">
          ${this.statusNotice ? `<div class="meta-toast-banner">${this.statusNotice}</div>` : ''}
          ${this.renderTabBody(loc, badges)}
        </main>
        <nav class="bottom-nav" aria-label="Menu">
          <button class="nav-tab ${this.activeTab === 'map' ? 'active' : ''}" data-tab="map">
            ${navBadgeHtml(badges.map, 'green')}
            <img class="nav-art-ico" src="${OAK_UI_URLS.navMap}" alt="" />
            <span class="nav-label">${t(loc, 'nav.map')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'multi' ? 'active' : ''}" data-tab="multi">
            ${navBadgeHtml(badges.multi, 'red')}
            <img class="nav-art-ico" src="${OAK_UI_URLS.navArena}" alt="" />
            <span class="nav-label">${t(loc, 'nav.arena')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'cards' ? 'active' : ''}" data-tab="cards">
            ${navBadgeHtml(badges.cards, 'green')}
            <img class="nav-art-ico" src="${OAK_UI_URLS.navUnits}" alt="" />
            <span class="nav-label">${t(loc, 'nav.units')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'journal' ? 'active' : ''}" data-tab="journal">
            ${navBadgeHtml(badges.journal, 'green')}
            <img class="nav-art-ico" src="${OAK_UI_URLS.navJournal}" alt="" />
            <span class="nav-label">${t(loc, 'nav.journal')}</span>
          </button>
          <button class="nav-tab ${this.activeTab === 'shop' ? 'active' : ''}" data-tab="shop">
            ${navBadgeHtml(badges.shop, 'red')}
            <img class="nav-art-ico" src="${OAK_UI_URLS.navShop}" alt="" />
            <span class="nav-label">${t(loc, 'nav.shopShort')}</span>
          </button>
        </nav>
        ${this.showSettings ? this.renderSettingsModal(loc) : ''}
        ${this.showBestiary ? this.renderBestiaryModal(loc) : ''}
        ${this.showPatrolModal ? this.renderPatrolModal(loc) : ''}
        ${this.showExpeditionModal ? this.renderExpeditionModal(loc) : ''}
      </div>
    `;

    this.bindEvents(container, loc);
  }

  private renderTabBody(loc: Locale, badges: NavBadges): string {
    if (this.activeTab === 'map') return this.renderMapTab(loc);
    if (this.activeTab === 'multi') return this.renderMultiTab(loc);
    if (this.activeTab === 'cards') return this.renderCardsTab(loc, badges);
    if (this.activeTab === 'journal') return this.renderJournalTab(loc);
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

  private renderShieldPinSvg(
    state: 'cleared' | 'frontier' | 'unlocked' | 'locked',
    isBoss: boolean,
    id: number,
    stars: number,
  ): string {
    const rimHi = state === 'frontier' ? '#fff4b8' : state === 'cleared' ? '#eff5fa' : '#d2a266';
    const rimLo = state === 'frontier' ? '#cf8814' : state === 'cleared' ? '#8c9fb0' : '#734721';
    let bodyTop = '#996c45';
    let bodyBot = '#613c1d';
    let numFill = '#f8e6c6';
    if (isBoss && state !== 'cleared') {
      bodyTop = '#d9483b';
      bodyBot = '#7b1713';
      numFill = '#ffe8a8';
    } else if (state === 'cleared') {
      bodyTop = '#56cf52';
      bodyBot = '#217d28';
      numFill = '#ffffff';
    } else if (state === 'frontier' || state === 'unlocked') {
      bodyTop = '#ffde59';
      bodyBot = '#d67e0e';
      numFill = '#2f1902';
    }

    const uid = `sh-${id}-${state}`;
    const showBossHorns = isBoss && (id === 12 || state !== 'cleared');
    const hornsHtml = showBossHorns
      ? `<path d="M9 14c-4-3-5-8-2-11 2 3 4 5 7 6M39 14c4-3 5-8 2-11-2 3-4 5-7 6" fill="#d9c6a3" stroke="#2a1405" stroke-width="2" stroke-linejoin="round"/>
         <circle cx="24" cy="19" r="6.2" fill="#f2dfc2" stroke="#2a1405" stroke-width="1.6"/>
         <circle cx="21.8" cy="18.2" r="1.4" fill="#2a1405"/><circle cx="26.2" cy="18.2" r="1.4" fill="#2a1405"/>`
      : '';
    const swordsHtml =
      state === 'frontier'
        ? `<path d="M10 38L38 10M38 38L10 10" stroke="#f0f6fc" stroke-width="2.4" stroke-linecap="round"/>`
        : '';
    const starRow =
      stars > 0
        ? Array.from({ length: 3 }, (_, idx) => {
            const cx = 17 + idx * 7;
            const on = idx < stars;
            return `<path d="M${cx} 42.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="${on ? '#ffd94f' : '#4a2b13'}" stroke="#2a1405" stroke-width="0.9"/>`;
          }).join('')
        : '';

    return `
      <svg class="shield-pin-svg" viewBox="0 0 48 52" aria-hidden="true">
        <defs>
          <linearGradient id="${uid}-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${rimHi}"/><stop offset="100%" stop-color="${rimLo}"/>
          </linearGradient>
          <linearGradient id="${uid}-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${bodyTop}"/><stop offset="100%" stop-color="${bodyBot}"/>
          </linearGradient>
        </defs>
        <ellipse cx="24" cy="43.5" rx="17.5" ry="6.2" fill="#6b3e1b" stroke="#2a1405" stroke-width="2.2"/>
        <ellipse cx="24" cy="41.8" rx="15.5" ry="4.8" fill="#a86d37" stroke="#3c200a" stroke-width="1.4"/>
        ${swordsHtml}
        ${hornsHtml}
        <path d="M9 11.5L24 7l15 4.5v13.5c0 9.6-6.2 16.5-15 20.2C15.2 41.5 9 34.6 9 25V11.5z" fill="url(#${uid}-rim)" stroke="#2a1405" stroke-width="2.3" stroke-linejoin="round"/>
        <path d="M12.2 14L24 10.4 35.8 14v10.5c0 7.7-4.7 13.4-11.8 16.6-7.1-3.2-11.8-8.9-11.8-16.6V14z" fill="url(#${uid}-body)" stroke="#2a1405" stroke-width="1.4" stroke-linejoin="round"/>
        ${
          isBoss && state !== 'cleared'
            ? `<rect x="15.5" y="29" width="17" height="10" rx="4.5" fill="#2a1405" stroke="#ffd86b" stroke-width="1.2"/>
               <text x="24" y="36.6" text-anchor="middle" font-size="9.5" font-weight="900" fill="${numFill}">${id}</text>`
            : `<text x="24" y="31.5" text-anchor="middle" font-size="14.5" font-weight="900" fill="${numFill}" stroke="#2a1405" stroke-width="2.6" paint-order="stroke">${id}</text>`
        }
        ${starRow}
      </svg>
    `;
  }

  private renderMapTab(loc: Locale): string {
    const save = this.saveManager.get();
    const afk = calculateAfkAccumulation(save);
    const selLevel = LEVELS.find((l) => l.id === this.selectedLevelId) ?? LEVELS[0];
    const hasCleared = (save.levelStars[selLevel.id] ?? 0) > 0;
    const selUnlocked = isLevelUnlocked(selLevel.id, save.levelStars);
    const run = save.activeExpedition;

    const frontierNode = WORLD_MAP_NODES.find(
      (n) => isLevelUnlocked(n.id, save.levelStars) && (save.levelStars[n.id] ?? 0) === 0,
    );
    let maxUnlockedIdx = 0;
    WORLD_MAP_NODES.forEach((n, idx) => {
      if (isLevelUnlocked(n.id, save.levelStars)) maxUnlockedIdx = idx;
    });

    const OAK_MAP_TRAIL: ReadonlyArray<{ xPct: number; yPct: number }> = [
      { xPct: 54, yPct: 65.5 },
      { xPct: 33, yPct: 62.5 },
      { xPct: 20, yPct: 58.0 },
      { xPct: 26, yPct: 53.0 },
      { xPct: 44, yPct: 49.5 },
      { xPct: 65, yPct: 46.8 },
      { xPct: 74, yPct: 42.2 },
      { xPct: 59, yPct: 38.8 },
      { xPct: 36, yPct: 36.2 },
      { xPct: 23, yPct: 32.0 },
      { xPct: 38, yPct: 28.2 },
      { xPct: 59, yPct: 25.5 },
      { xPct: 72, yPct: 22.0 },
      { xPct: 56, yPct: 18.8 },
      { xPct: 38, yPct: 16.5 },
      { xPct: 51, yPct: 13.5 },
    ];

    const displayNodes = WORLD_MAP_NODES.map((n, idx) => ({
      ...n,
      xPct: OAK_MAP_TRAIL[idx]?.xPct ?? n.xPct,
      yPct: OAK_MAP_TRAIL[idx]?.yPct ?? n.yPct,
    }));
    const fullPathD = this.buildSmoothTrailPath(displayNodes);
    const unlockedPathD = this.buildSmoothTrailPath(displayNodes.slice(0, maxUnlockedIdx + 1));

    const nodesHtml = displayNodes.map((n) => {
      const unlocked = isLevelUnlocked(n.id, save.levelStars);
      const stars = save.levelStars[n.id] ?? 0;
      const isSelected = n.id === this.selectedLevelId;
      const isFrontier = frontierNode?.id === n.id;

      const pinState = stars > 0 ? 'cleared' : isFrontier ? 'frontier' : unlocked ? 'unlocked' : 'locked';

      return `
        <button
          type="button"
          class="stage-pin biome-${n.biome} ${pinState} ${n.isBossStage ? 'boss' : ''} ${isSelected ? 'selected' : ''}"
          style="left: ${n.xPct}%; top: ${n.yPct}%;"
          data-level="${n.id}"
          aria-label="${n.id}. ${t(loc, n.nameKey)}"
        >
          ${this.renderShieldPinSvg(pinState, n.isBossStage, n.id, stars)}
        </button>
      `;
    }).join('');

    const stageEnemies = this.getStageUniqueEnemies(selLevel);
    const threatsHtml = stageEnemies
      .map((eid) => {
        const spec = ENEMIES[eid];
        const enemyName = t(loc, spec.nameKey);
        const badgeUrl = getEnemyBadgeUrl(eid, spec.isBoss);
        return `
          <button
            type="button"
            class="threat-medallion ${spec.isBoss ? 'boss' : ''}"
            data-open-journal-id="${eid}"
            title="${enemyName}"
            aria-label="${enemyName}"
          >
            <img class="threat-portrait-img" src="${badgeUrl}" alt="${enemyName}" />
            ${spec.isBoss ? `<span class="threat-boss-mini">${t(loc, 'map.bossTag')}</span>` : ''}
          </button>
        `;
      })
      .join('');

    const rogueBadge = run
      ? `<span class="medallion-pip ${run.pendingRelicChoices.length > 0 ? 'alert' : ''}">${run.pendingRelicChoices.length > 0 ? '!' : `${run.stageIndex + 1}/5`}</span>`
      : '';

    return `
      <div class="world-map-box map-full" style="background-image: url('${OAK_UI_URLS.worldMap}');">
        <svg class="world-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="${fullPathD}" fill="none" stroke="rgba(42, 22, 8, 0.42)" stroke-width="1.8" stroke-linecap="round" />
          <path d="${unlockedPathD}" fill="none" stroke="rgba(255, 224, 114, 0.78)" stroke-width="1.1" stroke-dasharray="1.3 2.1" stroke-linecap="round" />
        </svg>

        <button type="button" class="map-medallion patrol ${afk.oakCoins >= 1 ? 'ready' : ''}" id="btn-open-patrol">
          <span class="medallion-ring">
            <img class="medallion-art-img" src="${UI_ICON_URLS.chestFree}" alt="" />
            ${afk.oakCoins >= 1 ? `<span class="medallion-star-seal" title="${tParams(loc, 'map.afk.ready', { coins: afk.oakCoins })}"><img src="${OAK_UI_URLS.star3d}" alt="" /></span>` : ''}
          </span>
          <span class="medallion-label-stack">
            <span>${t(loc, 'map.afk.line1')}</span>
            <span>${t(loc, 'map.afk.line2')}</span>
          </span>
        </button>

        <div class="map-medallion-col">
          <button type="button" class="map-medallion rogue ${run ? 'active' : ''}" id="btn-open-expedition">
            <span class="medallion-ring">
              <img class="medallion-art-img" src="${OAK_UI_URLS.roguePortal}" alt="" />
              ${rogueBadge}
            </span>
            <span class="medallion-label-stack">
              <span>${t(loc, 'map.rogue.line1')}</span>
              <span>${t(loc, 'map.rogue.line2')}</span>
            </span>
          </button>
          <button type="button" class="map-medallion atlas" id="btn-open-bestiary">
            <span class="medallion-ring">
              <img class="medallion-art-img" src="${OAK_UI_URLS.atlasBook}" alt="" />
            </span>
            <span class="medallion-label-stack">
              <span>${t(loc, 'map.atlasShort')}</span>
            </span>
          </button>
        </div>

        ${nodesHtml}
      </div>

      <section class="parchment-drawer">
        <span class="brass-corner tl" aria-hidden="true"></span>
        <span class="brass-corner tr" aria-hidden="true"></span>
        <span class="brass-corner bl" aria-hidden="true"></span>
        <span class="brass-corner br" aria-hidden="true"></span>
        <div class="drawer-head">
          <div class="drawer-stage-meta">
            <div class="drawer-stage-title">${selLevel.id}. ${t(loc, selLevel.nameKey)}</div>
            <div class="drawer-stage-sub">${t(loc, `map.biome.${selLevel.biome}`)} · ${selLevel.waves.length} ${t(loc, 'hud.wave')}</div>
          </div>
          <div class="drawer-threats" aria-label="${t(loc, 'map.threats')}">${threatsHtml}</div>
        </div>

        <div class="oak-mode-bar" role="group" aria-label="${t(loc, 'map.mode.normal')} / ${t(loc, 'map.mode.iron')}">
          <button type="button" class="oak-switch-track ${this.ironMode ? 'iron' : 'normal'}" id="btn-mode-toggle" ${selUnlocked && hasCleared ? '' : 'disabled'} aria-label="${t(loc, 'map.mode.iron')}">
            <span class="oak-switch-knob"></span>
          </button>
          <button type="button" class="oak-mode-tab ${!this.ironMode ? 'active' : ''}" id="btn-mode-normal" ${selUnlocked ? '' : 'disabled'}>${t(loc, 'map.mode.normal')}</button>
          <span class="oak-mode-sep" aria-hidden="true">|</span>
          <button type="button" class="oak-mode-tab ${this.ironMode ? 'active iron' : ''}" id="btn-mode-iron" ${selUnlocked && hasCleared ? '' : 'disabled'}>${t(loc, 'map.mode.iron')}</button>
        </div>

        <div class="oak-cta-well">
          <button class="btn btn-oak-play ${selUnlocked ? 'btn-primary' : ''}" id="btn-start-level" ${selUnlocked ? '' : 'disabled'}>
            ${selUnlocked ? '' : `<span class="svg-ico">${ICONS.lock}</span>`}
            <span>${selUnlocked ? t(loc, 'map.play') : t(loc, 'map.lockedHint')}</span>
          </button>
        </div>
      </section>
    `;
  }

  private renderPatrolModal(loc: Locale): string {
    const save = this.saveManager.get();
    const afk = calculateAfkAccumulation(save);
    return `
      <div class="modal-backdrop" data-modal-backdrop="patrol">
        <div class="modal-card oak-parchment-modal">
          <span class="brass-corner tl" aria-hidden="true"></span>
          <span class="brass-corner tr" aria-hidden="true"></span>
          <span class="brass-corner bl" aria-hidden="true"></span>
          <span class="brass-corner br" aria-hidden="true"></span>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div class="modal-oak-title">${t(loc, 'map.afk.title')}</div>
            <button class="btn btn-sm" id="btn-close-patrol" type="button">${t(loc, 'map.close')}</button>
          </div>
          <div class="patrol-modal-body">
            <img class="afk-chest-thumb" src="${UI_ICON_URLS.chestFree}" alt="" />
            <div>
              <div class="parchment-strong">${afk.hoursElapsed}/${t(loc, afk.capHours === 16 ? 'afk.duration16' : 'afk.duration8')}</div>
              <div class="parchment-muted">+${afk.oakCoins} ${t(loc, 'cur.oak')} · +${afk.shards} ${t(loc, 'nav.cards')}</div>
              <div class="parchment-muted" style="font-size:10.5px;">${tParams(loc, 'map.afk.vip', { duration: t(loc, 'afk.duration16') })}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-gold" id="btn-afk-claim" ${afk.oakCoins < 1 ? 'disabled' : ''}>${t(loc, 'map.afk.collect')}</button>
            <button class="btn btn-sm" id="btn-afk-boost">${tParams(loc, 'map.afk.boost', { amount: AFK_QUICK_BOOST_OAK, hours: AFK_QUICK_BOOST_HOURS })}</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderExpeditionModal(loc: Locale): string {
    return `
      <div class="modal-backdrop" data-modal-backdrop="expedition">
        <div class="modal-card oak-modal-dark">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="font-size:16px; font-weight:900; color:#ffe17a;">${t(loc, 'rogue.title')}</div>
            <button class="btn btn-sm" id="btn-close-expedition" type="button">${t(loc, 'map.close')}</button>
          </div>
          ${this.renderExpeditionPortal(loc)}
        </div>
      </div>
    `;
  }

  private renderExpeditionPortal(loc: Locale): string {
    const save = this.saveManager.get();
    const unlocked = (save.levelStars[12] ?? 0) > 0 || save.expeditionsCompleted > 0 || Boolean(save.activeExpedition);
    const run = save.activeExpedition;

    if (!unlocked) {
      return `
        <div class="card-panel rogue-portal-card" id="rogue-portal-card">
          <div style="font-size:14px; font-weight:900; color:#ffe17a;">${t(loc, 'rogue.title')}</div>
          <div style="font-size:11.5px; color:var(--text-muted);">${t(loc, 'rogue.lockedHint')}</div>
        </div>
      `;
    }

    if (!run) {
      return `
        <div class="card-panel rogue-portal-card" id="rogue-portal-card">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="font-size:14px; font-weight:900; color:#ffe17a;">${t(loc, 'rogue.title')}</div>
            <span class="pill-badge gold">★ ${save.expeditionsCompleted}</span>
          </div>
          <div style="font-size:11.5px; color:var(--text-muted);">${t(loc, 'rogue.sub')}</div>
          <button class="btn btn-gold" id="btn-rogue-start">${t(loc, 'rogue.startBtn')}</button>
        </div>
      `;
    }

    const towersText = run.allowedTowers.map((tid) => t(loc, TOWERS[tid].nameKey)).join(' · ');
    const relicsText =
      run.relics.length > 0
        ? run.relics.map((rid) => t(loc, RELICS[rid].nameKey)).join(' · ')
        : '—';

    const bodyHtml =
      run.pendingRelicChoices.length > 0
        ? `
          <div style="font-size:12px; font-weight:800; color:var(--accent-cyan);">${t(loc, 'rogue.pickTitle')}</div>
          <div class="relic-choice-grid">
            ${run.pendingRelicChoices
              .map(
                (rid) => `
                  <button type="button" class="relic-card-btn" data-pick-relic="${rid}">
                    <span style="font-size:12px; font-weight:900; color:#ffe17a;">${t(loc, RELICS[rid].nameKey)}</span>
                    <span style="font-size:10.5px; color:var(--text-muted); line-height:1.25;">${t(loc, RELICS[rid].descKey)}</span>
                  </button>
                `,
              )
              .join('')}
          </div>
        `
        : `
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" style="flex:1;" id="btn-rogue-continue">${tParams(loc, 'rogue.continueBtn', { stage: run.stageIndex + 1 })}</button>
            <button class="btn btn-sm" id="btn-rogue-abandon">${t(loc, 'rogue.abandonBtn')}</button>
          </div>
        `;

    return `
      <div class="card-panel rogue-portal-card" id="rogue-portal-card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-size:14px; font-weight:900; color:#ffe17a;">${t(loc, 'rogue.title')}</div>
          <span class="pill-badge">${tParams(loc, 'rogue.stageBadge', { stage: run.stageIndex + 1 })}</span>
        </div>
        <div style="font-size:11.5px; font-weight:800; color:var(--accent-green);">${tParams(loc, 'rogue.hpBadge', { hp: run.hp, max: run.maxHp })}</div>
        <div style="font-size:11px; color:var(--text-muted);">${t(loc, 'rogue.towersLabel')}: <strong style="color:#fff;">${towersText}</strong></div>
        <div style="font-size:11px; color:var(--text-muted);">${t(loc, 'rogue.relicsLabel')}: <strong style="color:#ffe17a;">${relicsText}</strong></div>
        ${bodyHtml}
      </div>
    `;
  }

  private renderBestiaryModal(loc: Locale): string {
    const rowsHtml = ENEMY_LIST.map((e) => {
      const biomeLabel = e.biomeTag ? t(loc, `map.biome.${e.biomeTag}`) : '';
      return `
        <button type="button" class="bestiary-row ${e.isBoss ? 'boss' : ''}" data-open-journal-id="${e.id}">
          <div class="bestiary-swatch" style="background: linear-gradient(155deg, ${e.color} 0%, ${e.accentColor} 100%);">
            <img class="bestiary-portrait-img" src="${getEnemyBadgeUrl(e.id, e.isBoss)}" alt="${t(loc, e.nameKey)}" />
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
        </button>
      `;
    }).join('');

    return `
      <div class="modal-backdrop" data-modal-backdrop="bestiary">
        <div class="modal-card bestiary-modal oak-parchment-modal">
          <span class="brass-corner tl" aria-hidden="true"></span>
          <span class="brass-corner tr" aria-hidden="true"></span>
          <span class="brass-corner bl" aria-hidden="true"></span>
          <span class="brass-corner br" aria-hidden="true"></span>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
              <div class="modal-oak-title">${t(loc, 'map.bestiary')} (${ENEMY_LIST.length})</div>
              <div class="parchment-muted" style="font-size:11px;">${t(loc, 'map.bestiarySub')}</div>
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

    const leagueWindow = ensureLeagueSeason(this.saveManager);
    const save = this.saveManager.get();
    const curTier = getLeagueTierForTrophies(save.trophies);
    const tiersHtml = LEAGUE_TIERS.filter((tier) => tier.id !== 'oak')
      .map((tier) => {
        const unlocked = save.trophies >= tier.minTrophies;
        const claimed = save.claimedLeagueTiers.includes(tier.id);
        const rewardParts: string[] = [];
        if (tier.oakCoins > 0) rewardParts.push(`+${tier.oakCoins} ${t(loc, 'cur.oak')}`);
        if (tier.gems > 0) rewardParts.push(`+${tier.gems} ${t(loc, 'cur.gem')}`);
        if (tier.epicChest) rewardParts.push(t(loc, 'cards.plusTen'));
        if (tier.hatUnlock) rewardParts.push(t(loc, `hat.${tier.hatUnlock}`));
        return `
          <div class="league-tier-row ${unlocked ? 'unlocked' : ''}">
            <div style="min-width:0;">
              <div style="font-size:12px; font-weight:900; color:#ffffff;">${t(loc, `league.tier.${tier.id}`)} · ${tier.minTrophies}🏆</div>
              <div style="font-size:10.5px; color:var(--accent-gold);">${rewardParts.join(' · ')}</div>
            </div>
            <button class="btn btn-sm ${unlocked && !claimed ? 'btn-gold' : ''}" data-claim-league="${tier.id}" ${unlocked && !claimed ? '' : 'disabled'}>
              ${t(loc, claimed ? 'league.claimed' : unlocked ? 'league.claim' : 'season.locked')}
            </button>
          </div>
        `;
      })
      .join('');

    const ladderHtml = getLeagueLeaderboard(save.trophies)
      .map(
        (entry, idx) => `
          <div class="league-ladder-row ${entry.isPlayer ? 'you' : ''}">
            <span>#${idx + 1} ${t(loc, entry.nameKey)}</span>
            <span style="color:var(--accent-gold); font-weight:900;">${entry.trophies} 🏆</span>
          </div>
        `,
      )
      .join('');

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

      <div class="card-panel" id="league-panel" style="display:flex; flex-direction:column; gap:8px; border-color: rgba(255, 202, 69, 0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-size:14.5px; font-weight:900; color:#ffe17a;">${t(loc, 'league.title')}</div>
          <span class="pill-badge">${tParams(loc, 'league.daysLeft', { days: leagueWindow.daysLeft })}</span>
        </div>
        <div style="font-size:11px; color:var(--text-muted);">${t(loc, 'league.sub')}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="pill-badge gold">${t(loc, `league.tier.${curTier.id}`)} · ${tParams(loc, 'league.trophies', { count: save.trophies })}</span>
          <span class="pill-badge" style="font-size:10px; ${save.firstCoopRewardClaimed ? 'opacity:0.65;' : 'border-color:#5ef28e; color:#9af7bc;'}">${t(loc, save.firstCoopRewardClaimed ? 'league.firstCoopClaimed' : 'league.firstCoopBonus')}</span>
        </div>
        <div class="league-tier-grid">${tiersHtml}</div>
        <div style="font-size:12px; font-weight:800; color:#ffffff; margin-top:2px;">${t(loc, 'league.ladderTitle')}</div>
        <div style="display:flex; flex-direction:column; gap:4px;">${ladderHtml}</div>
      </div>
    `;
  }

  private renderCardsTab(loc: Locale, badges: NavBadges): string {
    const save = this.saveManager.get();

    const subNavHtml = `
      <div class="cards-subnav" role="tablist" aria-label="${t(loc, 'cards.title')}">
        <button type="button" class="cards-sub-btn ${this.cardsSubTab === 'towers' ? 'active' : ''}" data-cards-sub="towers" role="tab" aria-selected="${this.cardsSubTab === 'towers'}">
          <span>${t(loc, 'cards.sub.towers')}</span>
          ${badges.towersSub > 0 ? `<span class="sub-pip">${badges.towersSub}</span>` : ''}
        </button>
        <button type="button" class="cards-sub-btn ${this.cardsSubTab === 'heroes' ? 'active' : ''}" data-cards-sub="heroes" role="tab" aria-selected="${this.cardsSubTab === 'heroes'}">
          <span>${t(loc, 'cards.sub.heroes')}</span>
          ${badges.heroesSub > 0 ? `<span class="sub-pip">${badges.heroesSub}</span>` : ''}
        </button>
        <button type="button" class="cards-sub-btn ${this.cardsSubTab === 'talents' ? 'active' : ''}" data-cards-sub="talents" role="tab" aria-selected="${this.cardsSubTab === 'talents'}">
          <span>${t(loc, 'cards.sub.talents')}</span>
          ${badges.talentsSub > 0 ? `<span class="sub-pip">${badges.talentsSub}</span>` : ''}
        </button>
      </div>
    `;

    let bodyHtml = '';
    if (this.cardsSubTab === 'towers') {
      const towerCardsHtml = TOWER_LIST.map((tw) => {
        const lvl = save.cardLevels[tw.id] ?? 1;
        const shards = save.cardShards[tw.id] ?? 0;
        const cost = getCardUpgradeCost(lvl);
        const pct = Math.min(100, Math.round((shards / cost.shards) * 100));
        const canUpgrade = shards >= cost.shards && save.oakCoins >= cost.oakCoins;
        const branchNote = `${t(loc, tw.evolutions[0].nameKey)} / ${t(loc, tw.evolutions[1].nameKey)}`;
        return `
          <div class="collector-card">
            <span class="collector-level-badge">${t(loc, 'cards.level')}${lvl}</span>
            <img class="collector-portrait" src="${PORTRAIT_URLS[tw.id]}" alt="${t(loc, tw.nameKey)}" />
            <div class="collector-name">${t(loc, tw.nameKey)}</div>
            <div class="collector-sub">${branchNote}</div>
            <div class="shard-bar">
              <div class="shard-bar-fill" style="width:${pct}%"></div>
              <span class="shard-bar-text">${shards}/${cost.shards}</span>
            </div>
            <button class="btn btn-sm ${canUpgrade ? 'btn-primary' : ''}" style="width:100%;" data-card-up="${tw.id}" ${canUpgrade ? '' : 'disabled'}>
              ${t(loc, 'cards.upgrade')} (${cost.oakCoins})
            </button>
          </div>
        `;
      }).join('');
      bodyHtml = `<div class="collector-grid">${towerCardsHtml}</div>`;
    } else if (this.cardsSubTab === 'heroes') {
      const heroesHtml = HERO_LIST.map((h) => {
        const unlocked = save.unlockedHeroes.includes(h.id);
        const selected = save.selectedHero === h.id;
        const canBuy = !unlocked && h.gemUnlockCost > 0 && save.emeraldGems >= h.gemUnlockCost;
        const lvl = save.cardLevels[h.id] ?? 1;
        const shards = save.cardShards[h.id] ?? 0;
        const cost = getCardUpgradeCost(lvl);
        const pct = Math.min(100, Math.round((shards / cost.shards) * 100));
        const canUpgrade = unlocked && shards >= cost.shards && save.oakCoins >= cost.oakCoins;
        const actionBtn = unlocked
          ? `<button class="btn btn-sm ${selected ? 'btn-gold' : 'btn-primary'}" data-select-hero="${h.id}" ${selected ? 'disabled' : ''}>${t(loc, selected ? 'hero.select.active' : 'hero.select.pick')}</button>`
          : `<button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" data-unlock-hero="${h.id}" ${canBuy ? '' : 'disabled'}>${tParams(loc, 'hero.select.unlockGems', { gems: h.gemUnlockCost })}</button>`;
        return `
          <div class="hero-roster-row ${selected ? 'active' : ''}">
            <div class="hero-roster-main">
              <img class="hero-roster-thumb" src="${PORTRAIT_URLS[h.id]}" alt="${t(loc, h.nameKey)}" />
              <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">
                <div style="font-size:13px; font-weight:900; color:#fff7e6;">${t(loc, h.nameKey)} · ${t(loc, 'cards.level')}${lvl}</div>
                <div style="font-size:10.5px; font-weight:700; color:var(--accent-cyan);">${t(loc, h.roleKey)}</div>
                <div style="font-size:10.5px; color:var(--text-muted);">${unlocked ? t(loc, h.descKey) : tParams(loc, 'hero.select.unlockAt', { lvl: h.unlockLevel })}</div>
              </div>
              ${actionBtn}
            </div>
            <div class="hero-shard-row">
              <div class="shard-bar" style="flex:1;">
                <div class="shard-bar-fill" style="width:${pct}%"></div>
                <span class="shard-bar-text">${shards}/${cost.shards}</span>
              </div>
              <button class="btn btn-sm ${canUpgrade ? 'btn-primary' : ''}" data-card-up="${h.id}" ${canUpgrade ? '' : 'disabled'}>
                ${t(loc, 'cards.upgrade')} (${cost.oakCoins})
              </button>
            </div>
          </div>
        `;
      }).join('');

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

      bodyHtml = `
        <div class="card-panel" style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:13.5px; font-weight:900; color:#ffe17a;">${t(loc, 'hero.select.title')}</div>
          <div style="display:flex; flex-direction:column; gap:7px;">${heroesHtml}</div>
        </div>
        ${
          save.selectedHero === 'boz_pence'
            ? `
              <div class="card-panel" style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-size:13px; font-weight:800; color:#ffe17a;">${t(loc, 'hero.class.title')}</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">${classesHtml}</div>
                <div style="font-size:11.5px; color:var(--text-muted); font-weight:700;">${t(loc, activeCls.descKey)}</div>
              </div>
            `
            : ''
        }
        <div class="card-panel" style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:13px; font-weight:800; color:#ffe17a;">${t(loc, 'cards.hats')}</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">${hatsHtml}</div>
        </div>
      `;
    } else {
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
              <div style="font-size:12.5px; font-weight:900; color:#fff7e6;">${t(loc, b.nameKey)}</div>
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

      bodyHtml = `
        <div class="card-panel" style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <div>
              <div style="font-size:13.5px; font-weight:900; color:#ffe17a;">${t(loc, 'talent.title')}</div>
              <div style="font-size:11px; color:var(--accent-gold); font-weight:800;">${tParams(loc, 'talent.available', { stars: availableStars })}</div>
            </div>
            <button class="btn btn-sm" id="btn-talent-reset" ${spentStars > 0 ? '' : 'disabled'}>${t(loc, 'talent.reset')}</button>
          </div>
          <div class="talent-grid">${talentsHtml}</div>
        </div>
      `;
    }

    return `
      <div class="oak-section-title">${t(loc, 'cards.title')}</div>
      ${subNavHtml}
      ${bodyHtml}
    `;
  }

  private renderJournalTab(loc: Locale): string {
    const save = this.saveManager.get();
    const catalog = getJournalCatalog();
    const active = catalog.find((e) => e.id === this.selectedJournalId) ?? catalog[0];
    const isDiscovered = save.discoveredIds.includes(active.id);
    const isClaimed = save.claimedJournalIds.includes(active.id);

    const gridHtml = catalog
      .map((entry) => {
        const disc = save.discoveredIds.includes(entry.id);
        const claimed = save.claimedJournalIds.includes(entry.id);
        const sel = entry.id === active.id;
        return `
          <button type="button" class="journal-entry-btn ${sel ? 'selected' : ''} ${disc ? '' : 'undiscovered'}" data-journal-id="${entry.id}">
            <span class="journal-cat-pill">${t(loc, `journal.cat.${entry.category}`)}</span>
            <span class="journal-entry-name">${t(loc, entry.nameKey)}</span>
            ${disc && !claimed ? `<span class="journal-gem-pip">+${JOURNAL_REWARD_GEMS}</span>` : ''}
          </button>
        `;
      })
      .join('');

    const claimBtn = isDiscovered
      ? `<button class="btn btn-sm ${isClaimed ? '' : 'btn-gold'}" id="btn-claim-journal" ${isClaimed ? 'disabled' : ''}>
           ${isClaimed ? t(loc, 'journal.claimed') : tParams(loc, 'journal.claimReward', { gems: JOURNAL_REWARD_GEMS })}
         </button>`
      : `<button class="btn btn-sm" disabled>${t(loc, 'journal.locked')}</button>`;

    return `
      <div style="font-size:15px; font-weight:900; color:#ffe17a;">${t(loc, 'journal.title')}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:-4px;">${t(loc, 'journal.sub')}</div>
      <div class="card-panel journal-stage-card">
        <div class="journal-canvas-wrap">
          <canvas id="journal-turntable" width="320" height="196"></canvas>
          <div class="journal-drag-hint">${t(loc, 'journal.dragHint')}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <div style="font-size:14.5px; font-weight:900; color:#ffffff;">${t(loc, active.nameKey)}</div>
            <div style="font-size:11px; font-weight:700; color:var(--accent-cyan);">${active.statSummary}</div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${t(loc, active.descKey)}</div>
          </div>
        </div>
        ${claimBtn}
      </div>
      <div class="journal-catalog-grid">${gridHtml}</div>
    `;
  }

  private formatSeasonReward(spec: SeasonRewardSpec, loc: Locale): string {
    const parts: string[] = [];
    if (spec.oakCoins) parts.push(`+${spec.oakCoins} ${t(loc, 'cur.oak')}`);
    if (spec.gems) parts.push(`+${spec.gems} ${t(loc, 'cur.gem')}`);
    if (spec.shardUnit && spec.shardCount) {
      const unitKey =
        spec.shardUnit in TOWERS
          ? TOWERS[spec.shardUnit as TowerId].nameKey
          : HEROES[spec.shardUnit as HeroId].nameKey;
      parts.push(`+${spec.shardCount} ${t(loc, unitKey)}`);
    }
    if (spec.skipTickets) parts.push(`+${spec.skipTickets} 🎟`);
    if (spec.hatUnlock) parts.push(t(loc, `hat.${spec.hatUnlock}`));
    return parts.join(' · ');
  }

  private renderShopTab(loc: Locale): string {
    const nowMs = Date.now();
    const seasonWin = ensureSeasonPassWindow(this.saveManager, nowMs);
    const save = this.saveManager.get();
    const vipStatus = getVipDailyStatus(save, nowMs);
    const vipActive = isVipActive(save, nowMs);
    const curTier = getSeasonCurrentTier(save.seasonPassKills);
    const killsInTier = curTier >= SEASON_MAX_TIER ? KILLS_PER_SEASON_TIER : save.seasonPassKills % KILLS_PER_SEASON_TIER;
    const pct = Math.min(100, Math.round((killsInTier / KILLS_PER_SEASON_TIER) * 100));

    const tierRowsHtml = Array.from({ length: SEASON_MAX_TIER }, (_, i) => {
      const tier = i + 1;
      const rw = getSeasonTierRewards(tier);
      const reached = curTier >= tier;
      const freeClaimed = save.claimedSeasonFreeTiers.includes(tier);
      const goldClaimed = save.claimedSeasonGoldTiers.includes(tier);
      const canGold = reached && save.seasonGoldUnlocked && !goldClaimed;
      return `
        <div class="season-tier-row ${reached ? 'reached' : ''}">
          <span class="pill-badge" style="font-size:10px; padding:3px 7px;">${tParams(loc, 'season.tierNum', { tier })}</span>
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <span style="font-size:10.5px; color:#d9e9f9;">${t(loc, 'season.freeTrack')}: ${this.formatSeasonReward(rw.free, loc)}</span>
              <button class="btn btn-sm ${reached && !freeClaimed ? 'btn-primary' : ''}" style="padding:3px 8px; font-size:10px;" data-season-free="${tier}" ${reached && !freeClaimed ? '' : 'disabled'}>
                ${t(loc, freeClaimed ? 'season.claimed' : reached ? 'season.claim' : 'season.locked')}
              </button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <span style="font-size:10.5px; color:var(--accent-gold);">${t(loc, 'season.goldTrack')}: ${this.formatSeasonReward(rw.gold, loc)}</span>
              <button class="btn btn-sm ${canGold ? 'btn-gold' : ''}" style="padding:3px 8px; font-size:10px;" data-season-gold="${tier}" ${canGold ? '' : 'disabled'}>
                ${t(loc, goldClaimed ? 'season.claimed' : canGold ? 'season.claim' : 'season.locked')}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

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

      <div class="card-panel" id="season-pass-panel" style="display:flex; flex-direction:column; gap:8px; border-color: rgba(110, 231, 183, 0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-size:14.5px; font-weight:900; color:#ffe17a;">${t(loc, 'season.title')}</div>
          <span class="pill-badge">${tParams(loc, 'season.tierBadge', { tier: curTier })}</span>
        </div>
        <div style="font-size:11px; color:var(--text-muted);">${tParams(loc, 'season.sub', { days: seasonWin.daysLeft })}</div>
        <div class="shard-bar">
          <div class="shard-bar-fill" style="width:${pct}%"></div>
          <span class="shard-bar-text">${tParams(loc, 'season.progress', { cur: killsInTier, need: KILLS_PER_SEASON_TIER })}</span>
        </div>
        ${
          save.seasonGoldUnlocked
            ? `<div style="font-size:11.5px; font-weight:900; color:var(--accent-gold);">${t(loc, 'season.goldActive')}</div>`
            : `<button class="btn btn-gold btn-sm" id="btn-buy-season-gold">${t(loc, 'season.buyGold')}</button>`
        }
        <div class="season-track-list">${tierRowsHtml}</div>
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
      <div class="modal-backdrop" data-modal-backdrop="settings">
        <div class="modal-card oak-modal-dark">
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
            <span>${t(loc, 'settings.music')}</span>
            <button class="game-switch ${s.musicEnabled ? 'on' : ''}" id="chk-music" type="button" aria-pressed="${s.musicEnabled}">
              <span class="game-switch-knob"></span>
            </button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:700;">
            <span>${t(loc, 'settings.haptics')}</span>
            <button class="game-switch ${s.hapticsEnabled ? 'on' : ''}" id="chk-haptics" type="button" aria-pressed="${s.hapticsEnabled}">
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
          ${
            this.callbacks.onDevUnlock
              ? `<button class="btn btn-sm btn-gold" id="btn-dev-unlock" type="button">${t(loc, 'settings.devUnlock')}</button>`
              : ''
          }
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

    container.querySelectorAll<HTMLElement>('[data-cards-sub]').forEach((btn) => {
      btn.onclick = () => {
        this.cardsSubTab = (btn.dataset.cardsSub as CardsSubTab) ?? 'towers';
        this.callbacks.onRefresh();
      };
    });

    const openPatrol = container.querySelector<HTMLButtonElement>('#btn-open-patrol');
    if (openPatrol) openPatrol.onclick = () => { this.showPatrolModal = true; this.callbacks.onRefresh(); };

    const closePatrol = container.querySelector<HTMLButtonElement>('#btn-close-patrol');
    if (closePatrol) closePatrol.onclick = () => { this.showPatrolModal = false; this.callbacks.onRefresh(); };

    const openExpedition = container.querySelector<HTMLButtonElement>('#btn-open-expedition');
    if (openExpedition) openExpedition.onclick = () => { this.showExpeditionModal = true; this.callbacks.onRefresh(); };

    const closeExpedition = container.querySelector<HTMLButtonElement>('#btn-close-expedition');
    if (closeExpedition) closeExpedition.onclick = () => { this.showExpeditionModal = false; this.callbacks.onRefresh(); };

    container.querySelectorAll<HTMLElement>('[data-modal-backdrop]').forEach((bd) => {
      bd.onclick = (ev) => {
        if (ev.target !== bd) return;
        this.showSettings = false;
        this.showBestiary = false;
        this.showPatrolModal = false;
        this.showExpeditionModal = false;
        this.callbacks.onRefresh();
      };
    });

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      if (this.escKeyHandler) {
        window.removeEventListener('keydown', this.escKeyHandler);
        this.escKeyHandler = null;
      }
      if (this.showSettings || this.showBestiary || this.showPatrolModal || this.showExpeditionModal) {
        this.escKeyHandler = (ev: KeyboardEvent) => {
          if (ev.key !== 'Escape') return;
          this.showSettings = false;
          this.showBestiary = false;
          this.showPatrolModal = false;
          this.showExpeditionModal = false;
          this.callbacks.onRefresh();
        };
        window.addEventListener('keydown', this.escKeyHandler);
      }
    }

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

    const rogueStart = container.querySelector<HTMLButtonElement>('#btn-rogue-start');
    if (rogueStart) {
      rogueStart.onclick = () => {
        this.saveManager.update((d) => {
          d.activeExpedition = startNewExpedition();
        });
        this.callbacks.onStartExpedition();
      };
    }

    const rogueContinue = container.querySelector<HTMLButtonElement>('#btn-rogue-continue');
    if (rogueContinue) rogueContinue.onclick = () => this.callbacks.onStartExpedition();

    const rogueAbandon = container.querySelector<HTMLButtonElement>('#btn-rogue-abandon');
    if (rogueAbandon) {
      rogueAbandon.onclick = () => {
        this.saveManager.update((d) => {
          d.activeExpedition = null;
        });
        this.callbacks.onRefresh();
      };
    }

    container.querySelectorAll<HTMLElement>('[data-pick-relic]').forEach((btn) => {
      btn.onclick = () => {
        const rid = btn.dataset.pickRelic as RelicId;
        this.saveManager.update((d) => {
          if (d.activeExpedition) {
            d.activeExpedition = chooseExpeditionRelic(d.activeExpedition, rid);
          }
        });
        this.callbacks.onRefresh();
      };
    });

    const normalBtn = container.querySelector<HTMLButtonElement>('#btn-mode-normal');
    const ironBtn = container.querySelector<HTMLButtonElement>('#btn-mode-iron');
    const toggleBtn = container.querySelector<HTMLButtonElement>('#btn-mode-toggle');
    if (normalBtn) normalBtn.onclick = () => { this.ironMode = false; this.callbacks.onRefresh(); };
    if (ironBtn) ironBtn.onclick = () => { this.ironMode = true; this.callbacks.onRefresh(); };
    if (toggleBtn) toggleBtn.onclick = () => { this.ironMode = !this.ironMode; this.callbacks.onRefresh(); };

    const afkClaim = container.querySelector<HTMLButtonElement>('#btn-afk-claim');
    if (afkClaim) {
      afkClaim.onclick = () => {
        const reward = claimAfkPatrol(this.saveManager);
        this.statusNotice = tParams(loc, 'map.afk.toast', { oak: reward.oakCoins, shards: reward.shards });
        this.showPatrolModal = false;
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
        this.showPatrolModal = false;
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

    container.querySelectorAll<HTMLElement>('[data-select-hero]').forEach((btn) => {
      btn.onclick = () => {
        const hid = btn.dataset.selectHero as HeroId;
        this.saveManager.update((s) => { s.selectedHero = hid; });
        this.callbacks.onRefresh();
      };
    });

    container.querySelectorAll<HTMLElement>('[data-unlock-hero]').forEach((btn) => {
      btn.onclick = () => {
        const hid = btn.dataset.unlockHero as HeroId;
        if (unlockHeroWithGems(this.saveManager, hid)) {
          this.statusNotice = tParams(loc, 'hero.select.unlockedToast', { name: t(loc, HEROES[hid].nameKey) });
        }
        this.callbacks.onRefresh();
      };
    });

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

    const buySeasonGold = container.querySelector<HTMLButtonElement>('#btn-buy-season-gold');
    if (buySeasonGold) {
      buySeasonGold.onclick = () => {
        if (this.billingService.purchaseSeasonPass()) {
          this.statusNotice = t(loc, 'season.goldActive');
          this.callbacks.onRefresh();
        }
      };
    }

    container.querySelectorAll<HTMLElement>('[data-claim-league]').forEach((btn) => {
      btn.onclick = () => {
        if (claimLeagueTierReward(this.saveManager, btn.dataset.claimLeague as LeagueTierId)) {
          this.callbacks.onRefresh();
        }
      };
    });

    container.querySelectorAll<HTMLElement>('[data-season-free]').forEach((btn) => {
      btn.onclick = () => {
        if (claimSeasonTierReward(this.saveManager, Number(btn.dataset.seasonFree), 'free')) {
          this.callbacks.onRefresh();
        }
      };
    });

    container.querySelectorAll<HTMLElement>('[data-season-gold]').forEach((btn) => {
      btn.onclick = () => {
        if (claimSeasonTierReward(this.saveManager, Number(btn.dataset.seasonGold), 'gold')) {
          this.callbacks.onRefresh();
        }
      };
    });

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

    const chkMusic = container.querySelector<HTMLButtonElement>('#chk-music');
    if (chkMusic) {
      chkMusic.onclick = () => {
        this.saveManager.update((d) => { d.settings.musicEnabled = !d.settings.musicEnabled; });
        this.callbacks.onRefresh();
      };
    }

    const chkHaptics = container.querySelector<HTMLButtonElement>('#chk-haptics');
    if (chkHaptics) {
      chkHaptics.onclick = () => {
        this.saveManager.update((d) => { d.settings.hapticsEnabled = !d.settings.hapticsEnabled; });
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

    const devUnlockBtn = container.querySelector<HTMLButtonElement>('#btn-dev-unlock');
    if (devUnlockBtn && this.callbacks.onDevUnlock) {
      devUnlockBtn.onclick = () => {
        this.callbacks.onDevUnlock?.();
        this.showSettings = false;
        this.statusNotice = t(loc, 'settings.devUnlockedToast');
        this.callbacks.onRefresh();
      };
    }

    const openBestiary = container.querySelector<HTMLButtonElement>('#btn-open-bestiary');
    if (openBestiary) {
      openBestiary.onclick = () => {
        this.showBestiary = true;
        this.callbacks.onRefresh();
      };
    }
    container.querySelectorAll<HTMLElement>('[data-open-journal-id]').forEach((el) => {
      el.onclick = () => {
        this.selectedJournalId = el.dataset.openJournalId ?? 'boz_pence';
        this.showBestiary = false;
        this.activeTab = 'journal';
        this.callbacks.onRefresh();
      };
    });
    container.querySelectorAll<HTMLElement>('[data-journal-id]').forEach((el) => {
      el.onclick = () => {
        this.selectedJournalId = el.dataset.journalId ?? 'boz_pence';
        this.callbacks.onRefresh();
      };
    });
    const claimJournalBtn = container.querySelector<HTMLButtonElement>('#btn-claim-journal');
    if (claimJournalBtn) {
      claimJournalBtn.onclick = () => {
        if (claimJournalReward(this.saveManager, this.selectedJournalId)) {
          this.statusNotice = `+${JOURNAL_REWARD_GEMS} ${t(loc, 'cur.gem')}`;
        }
        this.callbacks.onRefresh();
      };
    }
    const turntable = container.querySelector<HTMLCanvasElement>('#journal-turntable');
    if (turntable) {
      let dragging = false;
      let lastX = 0;
      turntable.onpointerdown = (ev) => {
        dragging = true;
        lastX = ev.clientX;
      };
      turntable.onpointermove = (ev) => {
        if (!dragging) return;
        this.journalYaw += (ev.clientX - lastX) * 0.015;
        lastX = ev.clientX;
      };
      turntable.onpointerup = () => { dragging = false; };
      turntable.onpointerleave = () => { dragging = false; };
    }
    const closeBestiary = container.querySelector<HTMLButtonElement>('#btn-close-bestiary');
    if (closeBestiary) {
      closeBestiary.onclick = () => {
        this.showBestiary = false;
        this.callbacks.onRefresh();
      };
    }
  }
}

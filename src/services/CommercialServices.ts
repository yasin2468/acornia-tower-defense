import type { SaveManager, SaveState } from './SaveManager.ts';

export type AdPlacement =
  | 'speed_2x'
  | 'afk_boost_4h'
  | 'daily_chest'
  | 'base_revive'
  | 'victory_2x';

export type HapticStyle = 'light' | 'medium' | 'heavy';

export interface NativeBridgeHooks {
  showRewardedAd?: (placement: AdPlacement) => Promise<{ rewarded: boolean } | boolean>;
  purchaseProduct?: (productId: string) => Promise<boolean> | boolean;
  logEvent?: (name: string, params: Record<string, string | number | boolean>) => void;
  getRemoteConfig?: () => Partial<RemoteEconomicConfig> | null | undefined;
  hapticImpact?: (style: HapticStyle) => void;
}

function getNativeBridge(): NativeBridgeHooks | undefined {
  return (globalThis as { __PALAMUT_NATIVE_BRIDGE__?: NativeBridgeHooks }).__PALAMUT_NATIVE_BRIDGE__;
}

export interface AnalyticsEvent {
  name: string;
  params: Record<string, string | number | boolean>;
  ts: number;
}

export interface RemoteEconomicConfig {
  startGoldDelta: number;
  failOfferPriceUsd: number;
  failOfferDiscountPct: number;
  vipMonthlyPriceUsd: number;
  vipLifetimePriceUsd: number;
}

export const VIP_MONTHLY_DURATION_MS = 30 * 24 * 3600 * 1000;
export const VIP_DAILY_CLAIM_COOLDOWN_MS = 24 * 3600 * 1000;
export const VIP_DAILY_CLAIM_GEMS = 50;
export const VIP_LIFETIME_GEMS = 200;

export type VipDailyClaimReason = 'ok' | 'cooldown' | 'expired' | 'not_vip' | 'lifetime';

export interface VipDailyStatus {
  reason: VipDailyClaimReason;
  canClaim: boolean;
  vipRemainingMs: number;
  nextClaimInMs: number;
}

export interface VipDailyClaimResult extends VipDailyStatus {
  claimed: boolean;
  gemsGranted: number;
}

export function isVipActive(save: SaveState, nowMs = Date.now()): boolean {
  if (save.vipTier === 'lifetime') return true;
  if (save.vipTier === 'monthly') return save.vipExpiresAt > nowMs;
  return false;
}

export function getVipDailyStatus(save: SaveState, nowMs: number): VipDailyStatus {
  if (save.vipTier === 'none') {
    return { reason: 'not_vip', canClaim: false, vipRemainingMs: 0, nextClaimInMs: 0 };
  }
  if (save.vipTier === 'lifetime') {
    return { reason: 'lifetime', canClaim: false, vipRemainingMs: 0, nextClaimInMs: 0 };
  }
  const vipRemainingMs = Math.max(0, save.vipExpiresAt - nowMs);
  if (vipRemainingMs === 0) {
    return { reason: 'expired', canClaim: false, vipRemainingMs: 0, nextClaimInMs: 0 };
  }
  const sinceLastClaim = nowMs - save.lastVipClaimAt;
  if (save.lastVipClaimAt > 0 && sinceLastClaim < VIP_DAILY_CLAIM_COOLDOWN_MS) {
    return {
      reason: 'cooldown',
      canClaim: false,
      vipRemainingMs,
      nextClaimInMs: VIP_DAILY_CLAIM_COOLDOWN_MS - sinceLastClaim,
    };
  }
  return { reason: 'ok', canClaim: true, vipRemainingMs, nextClaimInMs: 0 };
}

export function claimVipDaily(saveManager: SaveManager, nowMs = Date.now()): VipDailyClaimResult {
  const status = getVipDailyStatus(saveManager.get(), nowMs);
  if (!status.canClaim) {
    return { ...status, claimed: false, gemsGranted: 0 };
  }
  saveManager.update((draft) => {
    draft.emeraldGems += VIP_DAILY_CLAIM_GEMS;
    draft.lastVipClaimAt = nowMs;
  });
  return { ...status, claimed: true, gemsGranted: VIP_DAILY_CLAIM_GEMS };
}

export interface FailOfferPrices {
  priceUsd: number;
  referenceUsd: number;
  discountPct: number;
}

export function getFailOfferPrices(config: RemoteEconomicConfig): FailOfferPrices {
  const discountPct = Math.max(0, Math.min(99, config.failOfferDiscountPct));
  const referenceUsd =
    discountPct === 0 ? config.failOfferPriceUsd : config.failOfferPriceUsd / (1 - discountPct / 100);
  return {
    priceUsd: config.failOfferPriceUsd,
    referenceUsd: Math.round(referenceUsd * 100) / 100,
    discountPct,
  };
}

export class AdService {
  private readonly saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  canBypassWithVipOrTicket(nowMs = Date.now()): boolean {
    const s = this.saveManager.get();
    return isVipActive(s, nowMs) || s.skipTickets > 0;
  }

  /**
   * Rewarded ad dispatcher; delegates to the native ad bridge when present.
   */
  async showRewarded(
    placement: AdPlacement,
    nowMs = Date.now(),
  ): Promise<{ rewarded: boolean; bypassed: boolean }> {
    const s = this.saveManager.get();
    if (isVipActive(s, nowMs)) {
      return { rewarded: true, bypassed: true };
    }
    if (s.skipTickets > 0 && placement !== 'speed_2x') {
      this.saveManager.update((draft) => {
        draft.skipTickets = Math.max(0, draft.skipTickets - 1);
      });
      return { rewarded: true, bypassed: true };
    }
    const bridge = getNativeBridge();
    if (bridge?.showRewardedAd) {
      const nativeRes = await bridge.showRewardedAd(placement);
      const rewarded = typeof nativeRes === 'boolean' ? nativeRes : Boolean(nativeRes?.rewarded);
      return { rewarded, bypassed: false };
    }
    return { rewarded: true, bypassed: false };
  }
}

export class BillingService {
  private readonly saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  /** Grants the rescue bundle locally and triggers native IAP fulfillment when available. */
  purchaseFirstDefeatBundle(): boolean {
    const s = this.saveManager.get();
    if (s.firstDefeatBundleBought) return false;
    void getNativeBridge()?.purchaseProduct?.('first_defeat_bundle');
    this.saveManager.update((draft) => {
      draft.firstDefeatBundleBought = true;
      draft.emeraldGems += 300;
      draft.cardShards.hedgehog += 10;
      draft.skipTickets += 5;
    });
    return true;
  }

  purchaseVip(tier: 'monthly' | 'lifetime', nowMs = Date.now()): void {
    void getNativeBridge()?.purchaseProduct?.(tier === 'monthly' ? 'vip_monthly' : 'vip_lifetime');
    this.saveManager.update((draft) => {
      draft.vipTier = tier;
      if (tier === 'monthly') {
        // Aylık VIP'te zümrüt tek seferlik değil; günlük talep akışıyla verilir.
        draft.vipExpiresAt = Math.max(draft.vipExpiresAt, nowMs) + VIP_MONTHLY_DURATION_MS;
      } else {
        draft.vipExpiresAt = 0;
        draft.emeraldGems += VIP_LIFETIME_GEMS;
        if (!draft.unlockedHats.includes('viking')) {
          draft.unlockedHats.push('viking');
        }
      }
    });
  }

  purchaseSeasonPass(): boolean {
    const s = this.saveManager.get();
    if (s.seasonGoldUnlocked) return false;
    void getNativeBridge()?.purchaseProduct?.('season_pass_gold');
    this.saveManager.update((draft) => {
      draft.seasonGoldUnlocked = true;
    });
    return true;
  }
}

export class AnalyticsService {
  private buffer: AnalyticsEvent[] = [];

  track(name: string, params: Record<string, string | number | boolean> = {}): void {
    this.buffer.push({ name, params, ts: Date.now() });
    if (this.buffer.length > 200) {
      this.buffer.shift();
    }
    getNativeBridge()?.logEvent?.(name, params);
  }

  getRecent(): readonly AnalyticsEvent[] {
    return this.buffer;
  }
}

export class RemoteConfigService {
  private config: RemoteEconomicConfig = {
    startGoldDelta: 0,
    failOfferPriceUsd: 1.99,
    failOfferDiscountPct: 80,
    vipMonthlyPriceUsd: 4.99,
    vipLifetimePriceUsd: 17.99,
  };

  get(): RemoteEconomicConfig {
    const overrides = getNativeBridge()?.getRemoteConfig?.();
    return overrides ? { ...this.config, ...overrides } : this.config;
  }
}

export class HapticsService {
  private readonly saveManager: SaveManager;
  private reducedMotion = false;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  impact(style: HapticStyle = 'light'): boolean {
    if (this.reducedMotion || !this.saveManager.get().settings.hapticsEnabled) return false;

    const bridge = getNativeBridge();
    if (bridge?.hapticImpact) {
      bridge.hapticImpact(style);
      return true;
    }

    const cap = (
      globalThis as {
        Capacitor?: {
          isNativePlatform?: () => boolean;
          Plugins?: { Haptics?: { impact?: (opts: { style: string }) => Promise<void> | void } };
        };
      }
    ).Capacitor;
    const capHaptics = cap?.Plugins?.Haptics;
    if (capHaptics?.impact && (cap?.isNativePlatform?.() ?? true)) {
      const capStyle = style === 'heavy' ? 'HEAVY' : style === 'medium' ? 'MEDIUM' : 'LIGHT';
      try {
        void capHaptics.impact({ style: capStyle });
        return true;
      } catch {
        // Fall through to Web Vibration API
      }
    }

    const ms = style === 'heavy' ? 28 : style === 'medium' ? 16 : 8;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        return Boolean(navigator.vibrate(ms));
      } catch {
        return false;
      }
    }
    return false;
  }
}

export class NetworkTransportStub {
  createRoomCode(): string {
    return String(1000 + Math.floor(Math.random() * 9000));
  }
}

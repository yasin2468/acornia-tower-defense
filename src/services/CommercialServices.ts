import type { SaveManager } from './SaveManager.ts';

export type AdPlacement =
  | 'speed_2x'
  | 'afk_boost_4h'
  | 'daily_chest'
  | 'base_revive'
  | 'victory_2x';

export interface AnalyticsEvent {
  name: string;
  params: Record<string, string | number | boolean>;
  ts: number;
}

export interface RemoteEconomicConfig {
  startGoldDelta: number;
  failOfferDiscountPct: number;
  vipMonthlyPriceUsd: number;
  vipLifetimePriceUsd: number;
}

export class AdService {
  private readonly saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  canBypassWithVipOrTicket(): boolean {
    const s = this.saveManager.get();
    return s.vipTier !== 'none' || s.skipTickets > 0;
  }

  /**
   * Phase 1 simulated rewarded ad hook.
   * Phase 4 replaces body with AdMob / AppLovin MAX Capacitor bridge.
   */
  async showRewarded(placement: AdPlacement): Promise<{ rewarded: boolean; bypassed: boolean }> {
    const s = this.saveManager.get();
    if (s.vipTier !== 'none') {
      return { rewarded: true, bypassed: true };
    }
    if (s.skipTickets > 0 && placement !== 'speed_2x') {
      this.saveManager.update((draft) => {
        draft.skipTickets = Math.max(0, draft.skipTickets - 1);
      });
      return { rewarded: true, bypassed: true };
    }
    return { rewarded: true, bypassed: false };
  }
}

export class BillingService {
  private readonly saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  /** Phase 1 local simulation hook; Phase 4 binds directly to RevenueCat SDK. */
  purchaseFirstDefeatBundle(): boolean {
    const s = this.saveManager.get();
    if (s.firstDefeatBundleBought) return false;
    this.saveManager.update((draft) => {
      draft.firstDefeatBundleBought = true;
      draft.emeraldGems += 300;
      draft.cardShards.hedgehog += 10;
      draft.skipTickets += 5;
    });
    return true;
  }

  purchaseVip(tier: 'monthly' | 'lifetime'): void {
    this.saveManager.update((draft) => {
      draft.vipTier = tier;
      draft.emeraldGems += tier === 'lifetime' ? 200 : 50;
      if (tier === 'lifetime' && !draft.unlockedHats.includes('viking')) {
        draft.unlockedHats.push('viking');
      }
    });
  }
}

export class AnalyticsService {
  private buffer: AnalyticsEvent[] = [];

  track(name: string, params: Record<string, string | number | boolean> = {}): void {
    this.buffer.push({ name, params, ts: Date.now() });
    if (this.buffer.length > 200) {
      this.buffer.shift();
    }
  }

  getRecent(): readonly AnalyticsEvent[] {
    return this.buffer;
  }
}

export class RemoteConfigService {
  private config: RemoteEconomicConfig = {
    startGoldDelta: 0,
    failOfferDiscountPct: 80,
    vipMonthlyPriceUsd: 4.99,
    vipLifetimePriceUsd: 17.99,
  };

  get(): RemoteEconomicConfig {
    return this.config;
  }
}

export class NetworkTransportStub {
  createRoomCode(): string {
    return String(1000 + Math.floor(Math.random() * 9000));
  }
}

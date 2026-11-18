import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AdService,
  BillingService,
  claimVipDaily,
  getVipDailyStatus,
  isVipActive,
  VIP_DAILY_CLAIM_COOLDOWN_MS,
  VIP_DAILY_CLAIM_GEMS,
  VIP_LIFETIME_GEMS,
  VIP_MONTHLY_DURATION_MS,
} from '../src/services/CommercialServices.ts';
import { calculateAfkAccumulation } from '../src/services/ProgressionService.ts';
import { createInitialSave, migrateSave, SAVE_VERSION, SaveManager, type SaveState } from '../src/services/SaveManager.ts';

const NOW = 1_700_000_000_000;

function freshSave(): SaveManager {
  return new SaveManager(NOW);
}

describe('VIP gunluk zumrut tutarlılığı (O3-A)', () => {
  it('aylık VIP: ilk talep zümrüt verir, aynı gün ikinci talep reddedilir', () => {
    const sm = freshSave();
    new BillingService(sm).purchaseVip('monthly', NOW);
    const gemsBefore = sm.get().emeraldGems;

    const first = claimVipDaily(sm, NOW + 60_000);
    assert.equal(first.claimed, true, 'ilk talep geçmeli');
    assert.equal(first.reason, 'ok');
    assert.equal(first.gemsGranted, VIP_DAILY_CLAIM_GEMS);
    assert.equal(sm.get().emeraldGems, gemsBefore + VIP_DAILY_CLAIM_GEMS);
    assert.equal(sm.get().lastVipClaimAt, NOW + 60_000);

    const second = claimVipDaily(sm, NOW + 60_000 + 3 * 3600 * 1000);
    assert.equal(second.claimed, false, 'aynı gün ikinci talep reddedilmeli');
    assert.equal(second.reason, 'cooldown');
    assert.ok(second.nextClaimInMs > 0, 'kalan bekleme süresi dönmeli');
    assert.ok(second.nextClaimInMs <= VIP_DAILY_CLAIM_COOLDOWN_MS);
    assert.ok(second.vipRemainingMs > 0, 'VIP abonelik süresi hâlâ aktif olmalı');
    assert.equal(sm.get().emeraldGems, gemsBefore + VIP_DAILY_CLAIM_GEMS, 'reddedilen talep zümrüt vermemeli');
  });

  it('aylık VIP: 24 saat dolunca talep yeniden geçer', () => {
    const sm = freshSave();
    new BillingService(sm).purchaseVip('monthly', NOW);
    claimVipDaily(sm, NOW + 60_000);

    const later = claimVipDaily(sm, NOW + 60_000 + VIP_DAILY_CLAIM_COOLDOWN_MS);
    assert.equal(later.claimed, true, '24 saat sonra talep geçmeli');
    assert.equal(later.gemsGranted, VIP_DAILY_CLAIM_GEMS);
    assert.equal(sm.get().emeraldGems, createInitialSave(NOW).emeraldGems + 2 * VIP_DAILY_CLAIM_GEMS);
    assert.equal(sm.get().lastVipClaimAt, NOW + 60_000 + VIP_DAILY_CLAIM_COOLDOWN_MS);
  });

  it('aylık VIP: abonelik süresi dolduysa talep reddedilir', () => {
    const sm = freshSave();
    new BillingService(sm).purchaseVip('monthly', NOW);
    const expiredAt = NOW + VIP_MONTHLY_DURATION_MS;

    const res = claimVipDaily(sm, expiredAt + 1);
    assert.equal(res.claimed, false, 'süresi dolmuş VIP talebi reddedilmeli');
    assert.equal(res.reason, 'expired');
    assert.equal(res.vipRemainingMs, 0);
    assert.equal(sm.get().emeraldGems, createInitialSave(NOW).emeraldGems, 'süre dolunca zümrüt verilmemeli');

    const status = getVipDailyStatus(sm.get(), expiredAt + 1);
    assert.equal(status.canClaim, false);
    assert.equal(status.reason, 'expired');
  });

  it('ömürlük VIP: günlük talep reddedilir, tek seferlik zümrüt korunur', () => {
    const sm = freshSave();
    const gemsBefore = sm.get().emeraldGems;
    new BillingService(sm).purchaseVip('lifetime', NOW);
    assert.equal(sm.get().emeraldGems, gemsBefore + VIP_LIFETIME_GEMS, 'ömürlük alımında tek seferlik +200 verilmeli');
    assert.equal(sm.get().vipExpiresAt, 0, 'ömürlükte süre alanı 0 kalmalı');

    const res = claimVipDaily(sm, NOW + 60_000);
    assert.equal(res.claimed, false, 'ömürlükte günlük talep olmamalı');
    assert.equal(res.reason, 'lifetime');
    assert.equal(sm.get().emeraldGems, gemsBefore + VIP_LIFETIME_GEMS, 'talep zümrüt vermemeli');
  });

  it('aylık VIP alımı artık tek seferlik zümrüt vermez; 30 günlük süre yazar', () => {
    const sm = freshSave();
    const gemsBefore = sm.get().emeraldGems;
    new BillingService(sm).purchaseVip('monthly', NOW);
    assert.equal(sm.get().emeraldGems, gemsBefore, 'aylık alımda anında zümrüt verilmemeli (talep akışı var)');
    assert.equal(sm.get().vipExpiresAt, NOW + VIP_MONTHLY_DURATION_MS);

    const status = getVipDailyStatus(sm.get(), NOW);
    assert.equal(status.canClaim, true, 'satın alım sonrası ilk talep hemen açık olmalı');
    assert.equal(status.reason, 'ok');
  });

  it('VIP olmayan oyuncuda talep reddedilir', () => {
    const sm = freshSave();
    const res = claimVipDaily(sm, NOW);
    assert.equal(res.claimed, false);
    assert.equal(res.reason, 'not_vip');
    assert.equal(sm.get().emeraldGems, createInitialSave(NOW).emeraldGems);
  });

  it('v2 kaydı v3e migrate: aylık VIP 30 gün süre alır, yeni alanlar sıfırdan başlar', () => {
    const v2 = { ...createInitialSave(NOW), version: 2 } as SaveState;
    v2.vipTier = 'monthly';
    delete (v2 as Partial<SaveState>).vipExpiresAt;
    delete (v2 as Partial<SaveState>).lastVipClaimAt;

    const { state, migrated } = migrateSave(v2, NOW);
    assert.equal(migrated, true);
    assert.equal(state.version, SAVE_VERSION);
    assert.equal(state.vipTier, 'monthly');
    assert.equal(state.vipExpiresAt, NOW + VIP_MONTHLY_DURATION_MS, 'v2 aylık VIP sahibine tam ay bağışlanmalı');
    assert.equal(state.lastVipClaimAt, 0, 'talep geçmişi sıfırdan başlamalı');

    const again = migrateSave(state, NOW);
    assert.equal(again.migrated, false, 'v3 kaydı tekrar migrate edilmemeli');
    assert.equal(again.state.vipExpiresAt, NOW + VIP_MONTHLY_DURATION_MS, 'tekrar migrate süreyi değiştirmemeli');
  });

  it('isVipActive: aktif/süresi dolmuş aylık ve ömürlük VIP durumunu doğru ayırt eder', () => {
    const sm = freshSave();
    assert.equal(isVipActive(sm.get(), NOW), false, 'VIP yokken pasif');

    new BillingService(sm).purchaseVip('monthly', NOW);
    assert.equal(isVipActive(sm.get(), NOW), true, 'satın alma anında aktif');
    assert.equal(isVipActive(sm.get(), NOW + VIP_MONTHLY_DURATION_MS - 1), true, 'bitimden 1 ms önce aktif');
    assert.equal(isVipActive(sm.get(), NOW + VIP_MONTHLY_DURATION_MS), false, 'tam bitim anında pasif');
    assert.equal(isVipActive(sm.get(), NOW + VIP_MONTHLY_DURATION_MS + 1), false, 'süre bitince pasif');

    new BillingService(sm).purchaseVip('lifetime', NOW);
    assert.equal(isVipActive(sm.get(), NOW + VIP_MONTHLY_DURATION_MS * 100), true, 'ömürlük süresiz aktif');
  });

  it('AdService: süresi dolan aylık VIP reklamı ücretsiz atlayamaz', async () => {
    const sm = freshSave();
    const ads = new AdService(sm);
    new BillingService(sm).purchaseVip('monthly', NOW);

    assert.equal(ads.canBypassWithVipOrTicket(NOW + 1000), true);
    const activeRes = await ads.showRewarded('afk_boost_4h', NOW + 1000);
    assert.deepEqual(activeRes, { rewarded: true, bypassed: true });
    assert.equal(sm.get().skipTickets, 1, 'aktif VIP atlama bileti harcamamalı');

    const afterExpiry = NOW + VIP_MONTHLY_DURATION_MS + 1;
    assert.equal(ads.canBypassWithVipOrTicket(afterExpiry), true, 'bilet varken bilet sayesinde geçebilir');
    const ticketRes = await ads.showRewarded('afk_boost_4h', afterExpiry);
    assert.deepEqual(ticketRes, { rewarded: true, bypassed: true });
    assert.equal(sm.get().skipTickets, 0, 'süresi dolan VIP bilet harcamalı');

    assert.equal(ads.canBypassWithVipOrTicket(afterExpiry), false, 'bilet de kalmayınca VIP geçişi kapanmalı');
    const noBypassRes = await ads.showRewarded('afk_boost_4h', afterExpiry);
    assert.deepEqual(noBypassRes, { rewarded: true, bypassed: false });
  });

  it('calculateAfkAccumulation: aylık VIP süresi bitince 16 saatten 8 saate düşer, ömürlükte 16 kalır', () => {
    const sm = freshSave();
    new BillingService(sm).purchaseVip('monthly', NOW);
    const s = { ...sm.get(), afkLastClaimAt: NOW - 20 * 3600 * 1000 };

    assert.equal(calculateAfkAccumulation(s, NOW + 1000).capHours, 16);
    const expiredNow = NOW + VIP_MONTHLY_DURATION_MS + 1;
    const expiredSnap = { ...sm.get(), afkLastClaimAt: expiredNow - 20 * 3600 * 1000 };
    assert.equal(calculateAfkAccumulation(expiredSnap, expiredNow).capHours, 8);
    assert.equal(calculateAfkAccumulation(expiredSnap, expiredNow).hoursElapsed, 8);

    new BillingService(sm).purchaseVip('lifetime', NOW);
    const lifeSnap = { ...sm.get(), afkLastClaimAt: expiredNow - 20 * 3600 * 1000 };
    assert.equal(calculateAfkAccumulation(lifeSnap, expiredNow).capHours, 16);
  });
});

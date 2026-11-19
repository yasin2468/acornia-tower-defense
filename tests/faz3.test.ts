import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SoundEngine } from '../src/audio/SoundEngine.ts';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { HEROES } from '../src/data/enemies.ts';
import { LEVELS } from '../src/data/levels.ts';
import { TOWERS } from '../src/data/towers.ts';
import {
  advanceExpeditionStage,
  buildExpeditionLevelSpec,
  chooseExpeditionRelic,
  startNewExpedition,
} from '../src/data/roguelike.ts';
import {
  FIRST_COOP_GEM_BONUS,
  KILLS_PER_SEASON_TIER,
  LEAGUE_DURATION_MS,
  SEASON_DURATION_MS,
  SEASON_MAX_TIER,
  claimLeagueTierReward,
  claimSeasonTierReward,
  ensureLeagueSeason,
  ensureSeasonPassWindow,
  getSeasonCurrentTier,
  recordMultiplayerOutcome,
} from '../src/data/season.ts';
import { BillingService, HapticsService, type NativeBridgeHooks } from '../src/services/CommercialServices.ts';
import {
  computeAvailableTalentStars,
  computeTalentModifiers,
  computeTotalEarnedStars,
} from '../src/data/talents.ts';
import { MODEL_NAMES } from '../src/rendering/AssetLoader.ts';
import {
  claimJournalReward,
  discoverJournalEntries,
  getJournalCatalog,
  grantCampaignHeroUnlocks,
  JOURNAL_REWARD_GEMS,
  resetTalents,
  unlockHeroWithGems,
  upgradeTalent,
} from '../src/services/ProgressionService.ts';
import { createInitialSave, migrateSave, SAVE_VERSION, SaveManager } from '../src/services/SaveManager.ts';

const NOW = 1_700_000_000_000;

describe('F3-1 — 4 Dallı Taktik Yetenek Ağacı ve SaveManager v4', () => {
  it('toplam yıldız normal + Demir Mod (+2) puanını doğru toplar ve yükseltme/ücretsiz sıfırlama çalışır', () => {
    const sm = new SaveManager(NOW);
    sm.update((s) => {
      s.levelStars = { 1: 3, 2: 2 };
      s.ironCleared = { 1: true }; // 5 + 2 = 7 yıldız
    });

    assert.equal(computeTotalEarnedStars(sm.get().levelStars, sm.get().ironCleared), 7);
    assert.equal(upgradeTalent(sm, 'tower_power'), true); // -1 -> 6 kaldı
    assert.equal(upgradeTalent(sm, 'tower_power'), true); // -2 -> 4 kaldı
    assert.equal(upgradeTalent(sm, 'tower_power'), true); // -3 -> 1 kaldı
    assert.equal(upgradeTalent(sm, 'tower_power'), false); // 4 gerekir, 1 var -> red
    assert.equal(
      computeAvailableTalentStars(sm.get().levelStars, sm.get().ironCleared, sm.get().talents),
      1,
    );

    assert.equal(resetTalents(sm), true);
    assert.equal(
      computeAvailableTalentStars(sm.get().levelStars, sm.get().ironCleared, sm.get().talents),
      7,
    );
  });

  it('v3 kaydı v4e derin birleştirmeyle migrate edilir; eski alanlar ve yeni alanlar korunur', () => {
    const v3 = {
      version: 3,
      oakCoins: 420,
      cardLevels: { squirrel: 4 },
      cardShards: { owl: 9 },
      settings: { soundEnabled: false },
    };
    const { state, migrated } = migrateSave(v3 as never, NOW);
    assert.equal(migrated, true);
    assert.equal(state.version, SAVE_VERSION);
    assert.equal(state.oakCoins, 420);
    assert.equal(state.cardLevels.squirrel, 4);
    assert.equal(state.cardLevels.kizil_kuyruk, 1);
    assert.equal(state.cardShards.owl, 9);
    assert.equal(state.cardShards.kaya_dis, 0);
    assert.equal(state.settings.soundEnabled, false);
    assert.equal(state.settings.musicEnabled, true);
    assert.equal(state.selectedHero, 'boz_pence');
    assert.deepEqual(state.talents, createInitialSave(NOW).talents);
  });

  it('yetenek çarpanları simülasyonda altın, menzil, %65 iade, yağmur ve bekleme süresine uygulanır', () => {
    const maxTalents = { tower_power: 5, hero_soul: 5, forest_magic: 5, start_economy: 5 };
    const mods = computeTalentModifiers(maxTalents);
    assert.equal(mods.towerRangePct, 0.05);
    assert.equal(mods.extraStartGold, 60);
    assert.equal(mods.sellRefundRate, 0.65);

    const sim = new SimulationEngine(LEVELS[0], { seed: 7001, talents: maxTalents });
    assert.equal(sim.gold, LEVELS[0].startGold + 60);
    assert.equal(sim.getTowerSellRefund(100), 65);

    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);
    const tower = sim.slots.get('slot_1')!.tower!;
    assert.ok(sim.getTowerStats(tower).range > 7.0, 'Kademe 5 Kule Gücü menzili artırmalı');

    sim.dispatch({ type: 'CAST_PINECONE_RAIN', x: 0, z: 0 }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.ok(sim.pineconeRainCooldown < 20, 'Kademe 5 Orman Büyüleri bekleme süresini düşürmeli');
  });
});

describe('F3-2 — Kızıl Kuyruk ve Kaya Diş kahramanları', () => {
  it('hero_fox.glb, hero_boar.glb ve portreleri mevcut ve MODEL_NAMES listesinde tanımlı', () => {
    assert.ok(MODEL_NAMES.includes('hero_fox'));
    assert.ok(MODEL_NAMES.includes('hero_boar'));
    assert.ok(fs.existsSync(path.resolve('public/models/hero_fox.glb')));
    assert.ok(fs.existsSync(path.resolve('public/models/hero_boar.glb')));
    assert.ok(fs.existsSync(path.resolve('public/ui/portrait_fox.png')));
    assert.ok(fs.existsSync(path.resolve('public/ui/portrait_boar.png')));
  });

  it('Kızıl Kuyruk menzilli iksirle uçan düşmanı vurur, kule hız aurası açar ve ulti fırtına atar', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 7101, heroId: 'kizil_kuyruk' });
    assert.equal(sim.hero.maxHp, HEROES.kizil_kuyruk.maxHp);
    sim.gold = 300;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);

    const drone = sim.spawnEnemy('hover_drone', 100, 0.01, 6, {
      x: sim.hero.x + 2.5,
      z: sim.hero.z,
      wpIndex: 2,
      progress: 5,
    });
    sim.hero.clawShockCooldown = 0.05;
    for (let i = 0; i < 70; i++) sim.step(FIXED_DT);
    assert.ok(drone.hp < 100, 'Kızıl Kuyruk uçan hedefe menzilli iksir vurabilmeli');
    assert.ok(sim.hero.alchemyAuraTimer > 0, 'Otomatik 10 sn simya kule hız aurası tetiklenmeli');

    const armored = sim.spawnEnemy('shield_loader', 200, 0.01, 11, {
      x: 0,
      z: 0,
      wpIndex: 2,
      progress: 8,
    });
    const armorBefore = armored.armor;
    sim.dispatch({ type: 'CAST_HERO_ULTIMATE', x: armored.x, z: armored.z }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.ok(armored.hp < 200 && armored.armor < armorBefore, 'Zümrüt İksir Fırtınası hasar + zırh eritme uygulamalı');
  });

  it('Kaya Diş 4 robot bloklar, otomatik savurma ve koçbaşı ultisiyle ilerlemeyi geri iter', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 7102, heroId: 'kaya_dis' });
    assert.equal(sim.hero.maxHp, HEROES.kaya_dis.maxHp);

    const bots = [];
    for (let i = 0; i < 5; i++) {
      bots.push(
        sim.spawnEnemy('scout_bot', 300, 0.01, 5, {
          x: sim.hero.x,
          z: sim.hero.z,
          wpIndex: 2,
          progress: 10 + i * 0.1,
        }),
      );
    }
    sim.step(FIXED_DT);
    assert.equal(sim.enemies.filter((e) => e.engagedByHero).length, 4, 'Kaya Diş 4 kara robotu bloklamalı');

    const progressBefore = bots[0].progress;
    sim.dispatch({ type: 'CAST_HERO_ULTIMATE', x: bots[0].x, z: bots[0].z }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.hero.activeBuff, 'ironhide');
    assert.ok(bots[0].stunTimer >= 1.5, 'Koçbaşı ultisi hedefi sersemletmeli');
    assert.ok(bots[0].progress <= progressBefore, 'Koçbaşı ultisi robot ilerlemesini geri çekmeli');
  });

  it('kampanya ilerlemesi ve zümrütle kahraman açılışı save durumunu günceller', () => {
    const sm = new SaveManager(NOW);
    sm.update((s) => {
      s.emeraldGems = 200;
    });
    assert.equal(unlockHeroWithGems(sm, 'kizil_kuyruk'), true);
    assert.equal(sm.get().emeraldGems, 50);
    assert.equal(sm.get().selectedHero, 'kizil_kuyruk');
    assert.ok(sm.get().unlockedHeroes.includes('kizil_kuyruk'));

    const unlocked = grantCampaignHeroUnlocks(sm, 7);
    assert.deepEqual(unlocked, ['kaya_dis']);
    assert.ok(sm.get().unlockedHeroes.includes('kaya_dis'));
  });
});

describe('F3-3 & F3-6 — Orman Günlüğü ve Akustik Biyom Müzikleri', () => {
  it('Orman Günlüğü 17 birim listeler ve ilk keşif +10 Zümrüt ödülünü yalnızca 1 kez verir', () => {
    const catalog = getJournalCatalog();
    assert.equal(catalog.length, 17, '4 kule + 3 kahraman + 10 robot = 17 kayıt');

    const sm = new SaveManager(NOW);
    const before = sm.get().emeraldGems;
    assert.equal(claimJournalReward(sm, 'turbo_hopper'), false, 'keşfedilmemiş birim ödül veremez');

    discoverJournalEntries(sm, ['turbo_hopper']);
    assert.equal(claimJournalReward(sm, 'turbo_hopper'), true);
    assert.equal(sm.get().emeraldGems, before + JOURNAL_REWARD_GEMS);
    assert.equal(claimJournalReward(sm, 'turbo_hopper'), false, 'aynı birim ikinci kez ödül veremez');
  });

  it('SoundEngine biyom müzik temasını ve kapatma anahtarlarını hatasız yönetir', () => {
    const se = new SoundEngine();
    se.setMusicTheme('canyon');
    assert.equal(se.getMusicTheme(), 'canyon');
    se.setMusicEnabled(false);
    assert.equal(se.musicEnabled, false);
    se.setMusicTheme('snow');
    assert.equal(se.getMusicTheme(), 'snow');
    se.setEnabled(false);
    assert.equal(se.enabled, false);
    se.setMusicTheme('none');
  });
});

describe('F3-4 — Kayıp Orman Seferi (Roguelike ve 6 Orman Tılsımı)', () => {
  it('startNewExpedition 20 farklı seedde daima en az 1 hava savunma kulesi garantiler', () => {
    for (let s = 1; s <= 20; s++) {
      const run = startNewExpedition(s * 997);
      assert.equal(run.allowedTowers.length, 2);
      const hasAir = run.allowedTowers.some((id) => TOWERS[id].canHitAir);
      assert.equal(hasAir, true, `seed=${s * 997} hava kulesi içermeli`);
    }
  });

  it('5 aşama ilerler, aşamalar arasında 3 tılsımdan seçim yapar ve canı nextRuna taşır', () => {
    let run = startNewExpedition(12345);
    for (let stage = 0; stage < 4; stage++) {
      const spec = buildExpeditionLevelSpec(run);
      assert.equal(spec.id, 100 + stage + 1);
      assert.equal(spec.baseHp, run.maxHp);

      const { nextRun, completed } = advanceExpeditionStage(run, 105 - stage * 10);
      assert.equal(completed, false);
      assert.ok(nextRun);
      assert.equal(nextRun.stageIndex, stage + 1);
      assert.equal(nextRun.pendingRelicChoices.length, 3);
      run = chooseExpeditionRelic(nextRun, nextRun.pendingRelicChoices[0]);
      assert.equal(run.relics.length, stage + 1);
      assert.equal(run.pendingRelicChoices.length, 0);
    }

    const last = advanceExpeditionStage(run, 65);
    assert.equal(last.completed, true);
    assert.equal(last.nextRun, null);
  });

  it('allowedTowers kısıtı, giant_hero, lightning_refund ve frost_thorns simülasyonda çalışır', () => {
    const sim = new SimulationEngine(LEVELS[0], {
      seed: 7401,
      allowedTowers: ['squirrel', 'owl'],
      relics: ['giant_hero', 'lightning_refund', 'frost_thorns'],
      initialBaseHp: 95,
    });
    assert.equal(sim.baseHp, 95);
    assert.equal(sim.maxBaseHp, LEVELS[0].baseHp);

    // beaver izinli değil -> inşa edilemez
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'beaver' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.slots.get('slot_1')?.tower, null, 'izin dışı kule inşa edilememeli');

    // squirrel izinli -> inşa edilebilir
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.slots.get('slot_1')?.tower?.towerId, 'squirrel');

    // giant_hero HP +%45 artışı
    assert.equal(sim.hero.maxHp, Math.round(HEROES.boz_pence.maxHp * 1.45));

    // lightning_refund: satış %95 iade + 4m çevredekilere 80 hasar şoku
    const nearBot = sim.spawnEnemy('scout_bot', 150, 0.01, 4, {
      x: sim.slots.get('slot_1')!.x + 0.5,
      z: sim.slots.get('slot_1')!.z,
      wpIndex: 1,
      progress: 4,
    });
    assert.equal(sim.getTowerSellRefund(100), 95);
    sim.dispatch({ type: 'SELL_TOWER', slotId: 'slot_1' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.ok(nearBot.hp < 150, 'lightning_refund satışta yakındaki robota elektrik hasarı vurmalı');

    // frost_thorns: herhangi bir kule vuruşu robotu yavaşlatmalı
    sim.gold = 300;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_2', towerId: 'squirrel' }, 'p1', 0);
    const targetBot = sim.spawnEnemy('scout_bot', 200, 0.5, 4, {
      x: sim.slots.get('slot_2')!.x + 1.0,
      z: sim.slots.get('slot_2')!.z,
      wpIndex: 1,
      progress: 6,
    });
    for (let i = 0; i < 45; i++) sim.step(FIXED_DT);
    assert.ok(targetBot.slowTimer > 0 && targetBot.slowPct >= 0.2, 'frost_thorns hedefi yavaşlatmalı');
  });
});

describe('F3-5 & F4-Hazırlık — 14 Günlük Kupa Ligi, 30 Kademeli Orman Bileti ve Haptics', () => {
  it('Kupa Ligi PvP +28/-12 kupa, kademe ödülü, ilk Co-op +50 Zümrüt ve 14 gün yumuşak sıfırlama yapar', () => {
    const sm = new SaveManager(NOW);
    const startOak = sm.get().oakCoins;
    const startGems = sm.get().emeraldGems;

    const coop1 = recordMultiplayerOutcome(sm, 'coop', true, NOW);
    assert.equal(coop1.firstCoopGems, FIRST_COOP_GEM_BONUS);
    assert.equal(sm.get().emeraldGems, startGems + FIRST_COOP_GEM_BONUS);

    const coop2 = recordMultiplayerOutcome(sm, 'coop', true, NOW);
    assert.equal(coop2.firstCoopGems, 0, 'ilk Co-op bonusu tekrarlanmamalı');

    for (let i = 0; i < 4; i++) {
      recordMultiplayerOutcome(sm, 'pvp', true, NOW);
    }
    assert.equal(sm.get().trophies, 112);

    const loss = recordMultiplayerOutcome(sm, 'pvp', false, NOW);
    assert.equal(loss.trophyDelta, -12);
    assert.equal(sm.get().trophies, 100);

    assert.equal(claimLeagueTierReward(sm, 'bronze'), true);
    assert.equal(sm.get().oakCoins, startOak + 120);
    assert.equal(claimLeagueTierReward(sm, 'bronze'), false);

    const rolled = ensureLeagueSeason(sm, NOW + LEAGUE_DURATION_MS + 1000);
    assert.equal(rolled.reset, true);
    assert.equal(sm.get().trophies, 50);
    assert.deepEqual(sm.get().claimedLeagueTiers, []);
  });

  it('30 Kademeli Sezon Bileti her 35 imhada ilerler, Altın Bilet ve Kademe 30 Viking şapkası verir', () => {
    const sm = new SaveManager(NOW);
    const billing = new BillingService(sm);

    sm.update((d) => {
      d.seasonPassKills = KILLS_PER_SEASON_TIER * SEASON_MAX_TIER;
    });
    assert.equal(getSeasonCurrentTier(sm.get().seasonPassKills), 30);

    assert.equal(claimSeasonTierReward(sm, 1, 'free'), true);
    assert.equal(claimSeasonTierReward(sm, 30, 'gold'), false, 'Altın Bilet olmadan Altın ödül kapalı');

    assert.equal(billing.purchaseSeasonPass(), true);
    assert.equal(billing.purchaseSeasonPass(), false);
    assert.equal(claimSeasonTierReward(sm, 30, 'gold'), true);
    assert.ok(sm.get().unlockedHats.includes('viking'), 'Kademe 30 Altın ödülü viking şapkasını açmalı');

    const rolled = ensureSeasonPassWindow(sm, NOW + SEASON_DURATION_MS + 1000);
    assert.equal(rolled.reset, true);
    assert.equal(sm.get().seasonPassKills, 0);
    assert.equal(sm.get().seasonGoldUnlocked, false);
  });

  it('HapticsService ayar ve reducedMotion kapılarına uyar ve __PALAMUT_NATIVE_BRIDGE__ kancasına iletir', () => {
    const sm = new SaveManager(NOW);
    const haptics = new HapticsService(sm);
    const calls: string[] = [];
    const g = globalThis as { __PALAMUT_NATIVE_BRIDGE__?: NativeBridgeHooks };
    const prev = g.__PALAMUT_NATIVE_BRIDGE__;
    g.__PALAMUT_NATIVE_BRIDGE__ = {
      hapticImpact: (style) => calls.push(style),
    };
    try {
      assert.equal(haptics.impact('light'), true);
      assert.equal(haptics.impact('heavy'), true);
      haptics.setReducedMotion(true);
      assert.equal(haptics.impact('medium'), false);
      haptics.setReducedMotion(false);
      sm.update((d) => {
        d.settings.hapticsEnabled = false;
      });
      assert.equal(haptics.impact('light'), false);
      assert.deepEqual(calls, ['light', 'heavy']);
    } finally {
      g.__PALAMUT_NATIVE_BRIDGE__ = prev;
    }
  });
});

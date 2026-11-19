import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SoundEngine } from '../src/audio/SoundEngine.ts';
import { computeVictoryRewards, FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { ENEMY_LIST, HEROES } from '../src/data/enemies.ts';
import { getEnemyBadgeUrl } from '../src/ui/icons.ts';
import { LEVELS } from '../src/data/levels.ts';
import { TOWER_LIST, TOWERS } from '../src/data/towers.ts';
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
  TALENT_BRANCHES,
  computeAvailableTalentStars,
  computeTalentModifiers,
  computeTotalEarnedStars,
  isTalentNodeUnlocked,
} from '../src/data/talents.ts';
import { NetworkService } from '../src/services/NetworkService.ts';
import { MODEL_NAMES } from '../src/rendering/AssetLoader.ts';
import {
  claimAchievement,
  claimDailyQuest,
  claimDailyQuestBonus,
  claimJournalReward,
  DAILY_QUEST_BONUS_GEMS,
  discoverJournalEntries,
  getJournalCatalog,
  grantCampaignHeroUnlocks,
  JOURNAL_REWARD_GEMS,
  recordDailyQuestProgress,
  resetTalents,
  unlockHeroWithGems,
  unlockOrEquipAura,
  unlockOrEquipBanner,
  unlockOrEquipHat,
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

describe('F3-3 & F3-6 — Sefer Günlüğü (26 Birim + Görev + Başarım) ve Akustik Biyom Müzikleri', () => {
  it('Sefer Günlüğü 26 birim listeler ve ilk keşif +10 Zümrüt ödülünü yalnızca 1 kez verir', () => {
    const catalog = getJournalCatalog();
    assert.equal(catalog.length, 26, '8 kule + 4 kahraman + 14 robot = 26 kayıt');
    for (const sModel of [
      'skill_pinecone_meteor',
      'skill_acorn_magnet',
      'skill_golden_acorn',
      'skill_royal_banner',
      'skill_alchemy_flask',
      'skill_earth_spike',
      'enemy_frost_warden',
      'enemy_ember_bomber',
      'enemy_tesla_strider',
      'enemy_magma_overlord',
    ] as const) {
      assert.ok(MODEL_NAMES.includes(sModel), `${sModel} MODEL_NAMES icinde olmali`);
      assert.ok(fs.existsSync(path.resolve(`public/models/${sModel}.glb`)), `${sModel}.glb dosyasi mevcut olmali`);
    }

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

  it('Seçenek 2 (Buharlı Hurda) 14 düşman GLB modeli (skins + Walk/Attack) ve 14 benzersiz PNG portresi geçerlidir', () => {
    assert.equal(ENEMY_LIST.length, 14);
    const badgeUrls = new Set<string>();
    for (const enemy of ENEMY_LIST) {
      const glbPath = path.resolve(`public/models/enemy_${enemy.id}.glb`);
      assert.ok(fs.existsSync(glbPath), `enemy_${enemy.id}.glb bulunamadı`);
      const buf = fs.readFileSync(glbPath);
      assert.equal(buf.readUInt32LE(0), 0x46546c67, `enemy_${enemy.id}.glb geçerli GLB magic içermiyor`);
      const jsonLen = buf.readUInt32LE(12);
      const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
        skins?: unknown[];
        animations?: Array<{ name?: string }>;
      };
      assert.ok((gltf.skins?.length ?? 0) >= 1, `enemy_${enemy.id}.glb en az 1 skin içermeli`);
      const animNames = (gltf.animations ?? []).map((a) => a.name ?? '');
      assert.ok(animNames.includes('Walk'), `enemy_${enemy.id}.glb Walk animasyonu eksik (${animNames.join(',')})`);
      assert.ok(animNames.includes('Attack'), `enemy_${enemy.id}.glb Attack animasyonu eksik (${animNames.join(',')})`);

      const pngPath = path.resolve(`public/ui/oak/enemy_${enemy.id}.png`);
      assert.ok(fs.existsSync(pngPath), `enemy_${enemy.id}.png portresi eksik`);
      const pngBuf = fs.readFileSync(pngPath);
      assert.equal(pngBuf.subarray(12, 16).toString('ascii'), 'IHDR', `enemy_${enemy.id}.png geçerli PNG değil`);

      const badge = getEnemyBadgeUrl(enemy.id, enemy.isBoss);
      assert.equal(badge, `./ui/oak/enemy_${enemy.id}.png`);
      badgeUrls.add(badge);
    }
    assert.equal(badgeUrls.size, 14, 'Tüm 14 düşman rozeti benzersiz olmalı');
  });

  it('F4 — 8 kule, 4. kahraman Gümüş Kurt, 3B Aksesuarlar (Başlık/Aura/Sancak) ve Günlük Görev/Başarımlar tam çalışır', () => {
    for (const modelName of [
      'tower_badger_t1',
      'tower_badger_t2',
      'tower_badger_inferno',
      'tower_badger_corrosion',
      'tower_falcon_t1',
      'tower_falcon_t2',
      'tower_falcon_tempest',
      'tower_falcon_skyhunter',
      'tower_tortoise_t1',
      'tower_tortoise_t2',
      'tower_tortoise_quake',
      'tower_tortoise_bastion',
      'tower_lynx_t1',
      'tower_lynx_t2',
      'tower_lynx_flurry',
      'tower_lynx_frostbite',
      'hero_wolf',
      'hat_crown',
      'hat_goggles',
      'hat_antlers',
      'hat_samurai',
    ] as const) {
      assert.ok(MODEL_NAMES.includes(modelName), `${modelName} MODEL_NAMES eksik`);
      assert.ok(fs.existsSync(path.resolve(`public/models/${modelName}.glb`)), `${modelName}.glb eksik`);
    }

    // Gümüş Kurt Northern Howl ultisi
    const sim = new SimulationEngine(LEVELS[0], { seed: 8801, heroId: 'ay_kurdu' });
    const bot = sim.spawnEnemy('scout_bot', 150, 0.5, 5, { x: sim.hero.x + 1.2, z: sim.hero.z, wpIndex: 2, progress: 5 });
    sim.dispatch({ type: 'CAST_HERO_ULTIMATE' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.ok(bot.hp < 150 && bot.stunTimer >= 1.3, 'Kuzey Uluması hasar verip dondurmalı');
    assert.equal(sim.hero.activeBuff, 'banner');

    // Yeni kuleler inşa edilip ateş eder
    const simTowers = new SimulationEngine(LEVELS[0], { seed: 8802, extraStartGold: 500 });
    simTowers.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'badger' }, 'p1', 0);
    simTowers.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_2', towerId: 'falcon' }, 'p1', 0);
    simTowers.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_3', towerId: 'tortoise' }, 'p1', 0);
    simTowers.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_4', towerId: 'lynx' }, 'p1', 0);
    simTowers.step(FIXED_DT);
    assert.equal(simTowers.slots.get('slot_1')?.tower?.towerId, 'badger');
    assert.equal(simTowers.slots.get('slot_4')?.tower?.towerId, 'lynx');

    // Aksesuar kilit açma, kuşanma ve Günlük Görev/Başarım ödülleri
    const sm = new SaveManager(NOW);
    sm.update((s) => {
      s.oakCoins = 500;
      s.emeraldGems = 200;
      for (let i = 1; i <= 5; i++) s.levelStars[i] = 3; // 15 yıldız
    });
    assert.equal(unlockOrEquipHat(sm, 'goggles'), 'unlocked');
    assert.equal(sm.get().equippedHat, 'goggles');
    assert.equal(unlockOrEquipAura(sm, 'frost_crystal'), 'unlocked');
    assert.equal(sm.get().equippedAura, 'frost_crystal');
    assert.equal(unlockOrEquipBanner(sm, 'oak_crest'), 'unlocked');
    assert.equal(sm.get().equippedBanner, 'oak_crest');

    assert.equal(claimAchievement(sm, 'ach_stars_10'), true);
    assert.equal(claimAchievement(sm, 'ach_stars_10'), false);

    recordDailyQuestProgress(sm, { kills: 30, builds: 6, skills: 4, wins: 1 }, NOW);
    const gemsBeforeBonus = sm.get().emeraldGems;
    for (const qid of ['dq_kills', 'dq_builds', 'dq_skills', 'dq_wins']) {
      assert.equal(claimDailyQuest(sm, qid, NOW), true);
    }
    assert.equal(claimDailyQuestBonus(sm, NOW), true);
    assert.ok(sm.get().emeraldGems >= gemsBeforeBonus + DAILY_QUEST_BONUS_GEMS);
  });
});

describe('F5 — 10 Düğümlü Ulu Meşe Yetenek Ağacı, Akıllı Yapay Zeka, Ekonomi ve Birim Matematiği', () => {
  it('10 yetenek düğümü ikonları/ağaç arka planı mevcut ve ebeveyn kilidi/çarpanları doğru çalışır', () => {
    assert.equal(TALENT_BRANCHES.length, 10);
    assert.ok(fs.existsSync(path.resolve('public/ui/oak/talent_tree_bg.jpg')));
    for (const branch of TALENT_BRANCHES) {
      const p = path.resolve(`public/ui/oak/talent_${branch.id}.png`);
      assert.ok(fs.existsSync(p), `talent_${branch.id}.png eksik`);
      const hdr = fs.readFileSync(p).subarray(12, 16).toString('ascii');
      assert.equal(hdr, 'IHDR');
    }

    const sm = new SaveManager(NOW);
    sm.update((s) => {
      s.levelStars = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }; // 15 yıldız
    });
    assert.equal(isTalentNodeUnlocked('siege_ordnance', sm.get().talents), false);
    assert.equal(upgradeTalent(sm, 'siege_ordnance'), false, 'tower_power < 2 iken kilitli olmalı');

    assert.equal(upgradeTalent(sm, 'tower_power'), true);
    assert.equal(upgradeTalent(sm, 'tower_power'), true); // Sv.2 -> siege_ordnance açılır
    assert.equal(isTalentNodeUnlocked('siege_ordnance', sm.get().talents), true);
    assert.equal(upgradeTalent(sm, 'siege_ordnance'), true);
    assert.equal(upgradeTalent(sm, 'siege_ordnance'), true); // Sv.2 -> apex_warlord açılır
    assert.equal(isTalentNodeUnlocked('apex_warlord', sm.get().talents), true);
    assert.equal(upgradeTalent(sm, 'apex_warlord'), true);

    const richTalents = {
      tower_power: 2,
      hero_soul: 2,
      forest_magic: 2,
      start_economy: 2,
      siege_ordnance: 3,
      pack_warden: 3,
      frost_alchemy: 3,
      war_logistics: 3,
      apex_warlord: 2,
      world_tree_aegis: 3,
    };
    const sim = new SimulationEngine(LEVELS[0], { seed: 9101, talents: richTalents });
    assert.equal(sim.maxBaseHp, LEVELS[0].baseHp + 54, 'world_tree_aegis +54 kale canı eklemeli');
    const lockedStump = Array.from(sim.slots.values()).find((s) => s.stumpLocked)!;
    assert.ok(lockedStump.stumpClearCost < 40, 'war_logistics kütük açma maliyetini düşürmeli');

    sim.gold = 500;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'beaver' }, 'p1', 0);
    sim.step(FIXED_DT);
    const beaver = sim.slots.get('slot_1')!.tower!;
    assert.ok((sim.getTowerStats(beaver).aoeRadius ?? 0) > TOWERS.beaver.tier1.aoeRadius!, 'siege_ordnance AoE artırmalı');

    const barrel = sim.barrels.values().next().value;
    if (barrel) {
      const bot = sim.spawnEnemy('crystal_golem', 500, 0.01, 18, { x: barrel.x, z: barrel.z, wpIndex: 2, progress: 5 });
      sim.dispatch({ type: 'DETONATE_BARREL', barrelId: barrel.id }, 'p1', 0);
      sim.step(FIXED_DT);
      assert.ok(bot.hp < 430, 'siege_ordnance fıçı hasarını artırmalı');
    }

    assert.equal(resetTalents(sm), true);
  });

  it('akıllı hedefleme (cluster + smart şifacı önceliği), Gümüş Kurt pasif yavaşlatması ve SmartBotDirector çalışır', () => {
    // 1. Cluster havan AI: önde tekil robot yerine gerideki 3'lü kümeyi bombalar
    const simCluster = new SimulationEngine(LEVELS[0], { seed: 9201 });
    simCluster.gold = 300;
    simCluster.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_3', towerId: 'beaver' }, 'p1', 0);
    simCluster.step(FIXED_DT);
    const frontSolo = simCluster.spawnEnemy('scout_bot', 100, 0.01, 5, { x: -2.5, z: -2.0, wpIndex: 7, progress: 22 });
    const pack1 = simCluster.spawnEnemy('swarm_saw', 50, 0.01, 3, { x: 0.4, z: 0.5, wpIndex: 4, progress: 12 });
    simCluster.spawnEnemy('swarm_saw', 50, 0.01, 3, { x: 0.6, z: 0.6, wpIndex: 4, progress: 12 });
    simCluster.spawnEnemy('swarm_saw', 50, 0.01, 3, { x: 0.3, z: 0.7, wpIndex: 4, progress: 12 });
    const beaver = simCluster.slots.get('slot_3')!.tower!;
    const clusterPicked = simCluster.selectTarget(beaver);
    assert.notEqual(clusterPicked?.uid, frontSolo.uid);
    assert.equal(Math.hypot(clusterPicked!.x - pack1.x, clusterPicked!.z - pack1.z) < 0.6, true);

    // 2. Smart mod Kuzgun: onarım dronunu (şifacı + uçan) standart izciye göre önceliklendirir
    const simSmart = new SimulationEngine(LEVELS[0], { seed: 9202 });
    simSmart.gold = 300;
    simSmart.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_3', towerId: 'falcon' }, 'p1', 0);
    simSmart.step(FIXED_DT);
    simSmart.spawnEnemy('scout_bot', 80, 0.01, 5, { x: -0.5, z: 0.2, wpIndex: 5, progress: 16 });
    const healerDrone = simSmart.spawnEnemy('repair_drone', 92, 0.01, 9, { x: 0.2, z: 0.4, wpIndex: 4, progress: 13 });
    const falcon = simSmart.slots.get('slot_3')!.tower!;
    assert.equal(falcon.priority, 'smart');
    assert.equal(simSmart.selectTarget(falcon)?.uid, healerDrone.uid);

    // 3. Gümüş Kurt pasif pençe şoku ayaz yavaşlatması uygular
    const simWolf = new SimulationEngine(LEVELS[0], { seed: 9203, heroId: 'ay_kurdu' });
    const runner = simWolf.spawnEnemy('scout_bot', 250, 0.01, 5, {
      x: simWolf.hero.x + 0.5,
      z: simWolf.hero.z,
      wpIndex: 2,
      progress: 5,
    });
    simWolf.hero.clawShockCooldown = 0.01;
    simWolf.step(FIXED_DT);
    assert.ok(runner.slowTimer > 0 && runner.slowPct >= 0.3, 'Gümüş Kurt pasif şoku ayaz yavaşlatması uygulamalı');

    // 4. SmartBotDirector: duman temizleme + çeşitli kule kurma + yükseltme
    const net = new NetworkService('ws://localhost:0');
    (net as unknown as { state: string; isBotMatch: boolean; mode: string; botTimer: number }).state = 'in_match';
    (net as unknown as { isBotMatch: boolean }).isBotMatch = true;
    (net as unknown as { mode: string }).mode = 'coop';
    const simCoop = new SimulationEngine(LEVELS[6], { seed: 9204, extraStartGold: 600 });
    net.stepBot(10, simCoop); // açılış +25 altın hediyesi
    simCoop.step(FIXED_DT);
    assert.equal(simCoop.gold, LEVELS[6].startGold + 600 + 25);

    (net as unknown as { botTimer: number }).botTimer = 0;
    net.stepBot(1, simCoop); // dalgaya göre 1. kule inşa
    simCoop.step(FIXED_DT);
    (net as unknown as { botTimer: number }).botTimer = 0;
    net.stepBot(1, simCoop); // 2. rol kule inşa
    simCoop.step(FIXED_DT);
    const built = Array.from(simCoop.slots.values()).filter((s) => s.tower);
    assert.ok(built.length >= 2, 'SmartBotDirector birden fazla stratejik kule kurmalı');

    built[0].tower!.smokedTimer = 4.0;
    net.stepBot(0.1, simCoop);
    simCoop.step(FIXED_DT);
    assert.equal(built[0].tower!.smokedTimer, 0, 'SmartBotDirector dumanı hemen dağıtmalı');
  });

  it('8 kulenin tamamında pozitif kademe artışı ve bölüm ölçekli zafer ekonomisi geçerlidir', () => {
    const rawDps = (d: number, r: number, critC = 0, critM = 2) =>
      d * r * (1 + critC * (critM - 1));

    for (const tw of TOWER_LIST) {
      const dps1 = rawDps(tw.tier1.damage, tw.tier1.fireRate, tw.tier1.critChance, tw.tier1.critMultiplier);
      const dps2 = rawDps(tw.tier2.damage, tw.tier2.fireRate, tw.tier2.critChance, tw.tier2.critMultiplier);
      assert.ok(dps2 > dps1, `${tw.id} T2 DPS > T1 DPS olmalı`);
      for (const evo of tw.evolutions) {
        const s = evo.stats;
        const dps3 =
          rawDps(s.damage, s.fireRate, s.critChance, s.critMultiplier) *
          (s.chainCount ? 1.35 : 1) +
          (s.resinDps ?? 0) * 0.5;
        assert.ok(dps3 > dps2, `${evo.id} Kademe 3 efektif güç T2 üstünde olmalı`);
      }
    }

    const r1 = computeVictoryRewards(1, 3, false);
    const r8 = computeVictoryRewards(8, 3, false);
    const r16 = computeVictoryRewards(16, 3, false);
    const r16Iron = computeVictoryRewards(16, 3, true);
    assert.equal(r1.oak, 120);
    assert.equal(r1.gems, 15);
    assert.ok(r8.oak > r1.oak && r16.oak > r8.oak, 'Palamut zafer ödülü bölüme göre monoton artmalı');
    assert.ok(r16Iron.oak > r16.oak && r16Iron.gems > r16.gems, 'Demir Mod ek ödül vermeli');
  });

  it('8 kulenin 32 özel 3B .glb modeli CustomTowerBase mimarisi ve taret düğümleriyle paketlenmiştir', () => {
    const towerModels = MODEL_NAMES.filter((m) => m.startsWith('tower_'));
    assert.equal(towerModels.length, 32, '8 kule x 4 kademe/dal tam 32 kule modeli olmalı');

    for (const modelName of towerModels) {
      const glbPath = path.resolve(`public/models/${modelName}.glb`);
      assert.ok(fs.existsSync(glbPath), `${modelName}.glb dosyası mevcut olmalı`);
      const buf = fs.readFileSync(glbPath);
      assert.equal(buf.readUInt32LE(0), 0x46546c67, `${modelName}.glb geçerli glTF 2.0 başlığı taşımalı`);
      const jsonLen = buf.readUInt32LE(12);
      const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
        nodes?: Array<{ name?: string }>;
        materials?: Array<{ name?: string }>;
      };
      const nodeNames = (gltf.nodes ?? []).map((n) => n.name ?? '');
      const matNames = (gltf.materials ?? []).map((m) => m.name ?? '');

      assert.ok(
        nodeNames.some((n) => n.startsWith('CustomTowerBase_')),
        `${modelName}.glb CustomTowerBase_* özel mimari düğümü içermeli`,
      );
      assert.ok(nodeNames.includes('TurretHead'), `${modelName}.glb TurretHead içermeli`);
      assert.ok(nodeNames.includes('CharacterGroup'), `${modelName}.glb CharacterGroup içermeli`);
      assert.ok(nodeNames.includes('HeadSocket'), `${modelName}.glb HeadSocket içermeli`);
      assert.ok(matNames.includes('CustomTowerAtlasMat'), `${modelName}.glb CustomTowerAtlasMat materyali içermeli`);
    }
  });
});

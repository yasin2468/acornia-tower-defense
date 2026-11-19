import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SoundEngine } from '../src/audio/SoundEngine.ts';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { HEROES } from '../src/data/enemies.ts';
import { LEVELS } from '../src/data/levels.ts';
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

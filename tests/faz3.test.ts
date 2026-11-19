import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import {
  computeAvailableTalentStars,
  computeTalentModifiers,
  computeTotalEarnedStars,
} from '../src/data/talents.ts';
import { resetTalents, upgradeTalent } from '../src/services/ProgressionService.ts';
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

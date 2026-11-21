import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import {
  claimDailyLoginReward,
  getDailyChallengeSpec,
  getLoginCalendarStatus,
  LOGIN_REWARDS,
} from '../src/data/daily.ts';
import { LEVELS } from '../src/data/levels.ts';
import { createInitialSave, migrateSave, SaveManager } from '../src/services/SaveManager.ts';

function makeMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  };
}

function withMockStorage(fn: () => void): void {
  const g = globalThis as Record<string, unknown>;
  const hadStorage = 'localStorage' in g;
  const prevStorage = g.localStorage;
  g.localStorage = makeMockStorage();
  try {
    fn();
  } finally {
    if (hadStorage) {
      g.localStorage = prevStorage;
    } else {
      delete g.localStorage;
    }
  }
}

describe('Studio Parity Features (Özet, Checkpoint, Takvim/Mutator, Sonsuz Mod, Meşe Muhafızları)', () => {
  it('7 günlük giriş takvimi gün başına 1 kez ödül verir, kart/palamut/zümrüt ekler ve 7. gün sonrası döngüyü sıfırlar', () => {
    withMockStorage(() => {
      const sm = new SaveManager();
      const baseDayMs = Date.UTC(2026, 10, 1, 12, 0, 0);
      const dayMs = 24 * 3600 * 1000;

      for (let i = 0; i < 7; i++) {
        const now = baseDayMs + i * dayMs;
        const st = getLoginCalendarStatus(sm.get(), now);
        assert.equal(st.canClaimToday, true);
        assert.equal(st.nextClaimDay, i + 1);

        const oakBefore = sm.get().oakCoins;
        const gemBefore = sm.get().emeraldGems;
        const sqBefore = sm.get().cardShards.squirrel ?? 0;
        const claim = claimDailyLoginReward(sm, now);
        assert.equal(claim.claimed, true);
        assert.equal(claim.day, i + 1);

        const expected = LOGIN_REWARDS[i];
        assert.equal(sm.get().oakCoins, oakBefore + (expected.oakCoins ?? 0));
        assert.equal(sm.get().emeraldGems, gemBefore + (expected.gems ?? 0));
        if (i === 2) {
          assert.equal(sm.get().cardShards.squirrel, sqBefore + 3);
        }

        // Aynı gün ikinci kez talep engellenir
        const secondClaim = claimDailyLoginReward(sm, now + 60_000);
        assert.equal(secondClaim.claimed, false);
        assert.equal(getLoginCalendarStatus(sm.get(), now + 60_000).canClaimToday, false);
      }

      // 8. günde takvim 1. günden yeniden başlar
      const day8 = baseDayMs + 7 * dayMs;
      const wrapStatus = getLoginCalendarStatus(sm.get(), day8);
      assert.equal(wrapStatus.canClaimToday, true);
      assert.equal(wrapStatus.nextClaimDay, 1);
    });
  });

  it('Günlük kural değiştirici deterministiktir; no_sell satışı kilitler, heavy_siege uçanları indirir', () => {
    const dayA = getDailyChallengeSpec(Date.UTC(2026, 10, 21, 9, 0, 0));
    const dayB = getDailyChallengeSpec(Date.UTC(2026, 10, 21, 22, 0, 0));
    assert.equal(dayA.dateKey, dayB.dateKey);
    assert.equal(dayA.levelId, dayB.levelId);
    assert.equal(dayA.mutator.id, dayB.mutator.id);

    const noSellSim = new SimulationEngine(LEVELS[0], { seed: 77, mutatorId: 'no_sell' });
    assert.equal(noSellSim.canSellTowers, false);
    noSellSim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 1);
    noSellSim.step(FIXED_DT);
    assert.ok(noSellSim.slots.get('slot_1')?.tower);
    noSellSim.dispatch({ type: 'SELL_TOWER', slotId: 'slot_1' }, 'p1', 1);
    noSellSim.step(FIXED_DT);
    assert.ok(noSellSim.slots.get('slot_1')?.tower, 'no_sell mutatorunda kule satılamaz');

    const heavySim = new SimulationEngine(LEVELS[0], {
      seed: 88,
      mutatorId: 'heavy_siege',
      allowedTowers: ['beaver', 'hedgehog', 'badger', 'tortoise'],
    });
    heavySim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'beaver' }, 'p1', 1);
    heavySim.step(FIXED_DT);
    const beaver = heavySim.slots.get('slot_1')?.tower;
    assert.ok(beaver);
    const flyer = heavySim.spawnEnemy('hover_drone', 100, 2.0, 0);
    flyer.x = beaver.x + 1;
    flyer.z = beaver.z;
    assert.ok(
      heavySim.selectTarget(beaver)?.uid === flyer.uid,
      'heavy_siege mutatoru kara kulelerinin uçan birimleri hedeflemesini sağlamalıdır',
    );

    const fastSim = new SimulationEngine(LEVELS[0], { seed: 99, mutatorId: 'fast_bots' });
    const bot = fastSim.spawnEnemy('scout_bot', 100, 2.0, 0);
    assert.ok(bot.speed > 2.3, 'fast_bots hız çarpanı uygulamalıdır');
  });

  it('Sonsuz mod taban bölüm dalgalarını aşar, her 5 dalgada Boss üretir ve zaferle bitmez', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 515, endlessMode: true, waitForFirstWave: false });
    const baseWaves = LEVELS[0].waves.length;
    const wave5 = sim.getWaveSpec(baseWaves + 5);
    assert.ok(wave5, 'Taban dalga sayısının ötesinde dalga üretilmelidir');
    const mod5 = sim.getWaveSpec(4);
    const nextBossIdx = Math.max(4, Math.ceil(baseWaves / 5) * 5 - 1);
    const waveAtBoss = sim.getWaveSpec(nextBossIdx);
    assert.ok(mod5);
    assert.ok(waveAtBoss?.groups.some((g) => g.enemyId === 'mega_harvester' || g.enemyId === 'magma_overlord'));

    sim.currentWaveIndex = baseWaves - 1;
    sim.spawnQueue = [];
    sim.enemies = [];
    sim.step(FIXED_DT);
    assert.notEqual(sim.status, 'won', 'Sonsuz mod zaferle bitmemelidir');

    sim.baseHp = 0;
    sim.step(FIXED_DT);
    assert.equal(sim.status, 'lost');
  });

  it('Meşe Muhafızları aktif becerisi 2 muhafız indirir, yakındaki düşmanı bloklayıp hasar verir ve süresi dolunca kaybolur', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 303 });
    const pt = LEVELS[0].path[1];
    sim.dispatch({ type: 'CAST_REINFORCEMENTS', x: pt.x, z: pt.z }, 'p1', 1);
    sim.step(FIXED_DT);

    assert.equal(sim.guards.length, 2);
    assert.ok(sim.reinforcementsCooldown > 0);
    const events = sim.drainEvents();
    assert.ok(events.some((e) => e.type === 'REINFORCEMENTS_SUMMONED'));

    const enemy = sim.spawnEnemy('scout_bot', 200, 1.5, 0);
    enemy.x = sim.guards[0].x;
    enemy.z = sim.guards[0].z;
    for (let i = 0; i < 35; i++) {
      sim.step(FIXED_DT);
    }
    assert.ok(enemy.hp < 200, 'Muhafızlar yakın düşmana hasar vermelidir');

    for (let i = 0; i < 1000; i++) {
      sim.step(FIXED_DT);
    }
    assert.equal(sim.guards.length, 0, 'Muhafızların süresi dolunca sahneden kalkmalıdır');
  });

  it('Kule canlı istatistikleri, Savaş Özeti / Yenilgi teşhisi ve Dalga Checkpoint gidiş-dönüşü doğru çalışır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 707, waitForFirstWave: false });
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 1);
    for (let i = 0; i < 360; i++) {
      sim.step(FIXED_DT);
    }
    const tw = sim.slots.get('slot_1')?.tower;
    assert.ok(tw);
    assert.ok(tw.totalDamage > 0, 'Kule hasarı kaydedilmelidir');

    const summary = sim.getMatchSummary();
    assert.equal(summary.mvpTowerId, 'squirrel');
    assert.ok(summary.mvpDamage > 0);
    assert.equal(summary.topTowers[0]?.towerId, 'squirrel');

    // Checkpoint kaydet ve yeni simülasyona geri yükle
    sim.gold = 345;
    sim.baseHp = 111;
    const cp = sim.exportCheckpoint();
    const restored = new SimulationEngine(LEVELS[0], { seed: 707 });
    restored.restoreCheckpoint(cp);
    assert.equal(restored.gold, 345);
    assert.equal(restored.baseHp, 111);
    assert.equal(restored.slots.get('slot_1')?.tower?.towerId, 'squirrel');
    assert.equal(restored.slots.get('slot_1')?.tower?.totalDamage, tw.totalDamage);

    // Uçan robot sızıntısında hava savunma ipucu verilmelidir
    sim.hero.dead = true;
    sim.hero.respawnTimer = 999;
    const flyer = sim.spawnEnemy('hover_drone', 9999, 5, 0);
    flyer.wpIndex = LEVELS[0].path.length - 1;
    const last = LEVELS[0].path[LEVELS[0].path.length - 1];
    flyer.x = last.x;
    flyer.z = last.z;
    sim.step(FIXED_DT);
    const leakSummary = sim.getMatchSummary();
    assert.equal(leakSummary.primaryLeakEnemyId, 'hover_drone');
    assert.equal(leakSummary.defeatTipKey, 'battle.tip.air');
  });

  it('SaveManager yeni alanları varsayılanlarla oluşturur ve eski kayıtlardan güvenle migrate eder', () => {
    const fresh = createInitialSave();
    assert.equal(fresh.loginStreakDay, 0);
    assert.equal(fresh.lastLoginClaimDate, '');
    assert.deepEqual(fresh.completedDailyDates, []);
    assert.equal(fresh.endlessBestWave, 0);
    assert.equal(fresh.activeBattleCheckpoint, null);
    assert.equal(fresh.settings.autoStartWaves, false);
    assert.equal(fresh.settings.showDamageNumbers, true);

    const legacy = { version: 3, oakCoins: 500 } as unknown as Partial<ReturnType<typeof createInitialSave>>;
    const mig = migrateSave(legacy);
    assert.equal(mig.state.oakCoins, 500);
    assert.equal(mig.state.loginStreakDay, 0);
    assert.equal(mig.state.settings.showDamageNumbers, true);
    assert.equal(mig.state.settings.autoStartWaves, false);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeKillStreakPitch, SoundEngine } from '../src/audio/SoundEngine.ts';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';

describe('Combat & Hit-Mechanics Overhaul (Öngörü, Hedef Değişimi, Malzeme Sesi/Efekti)', () => {
  it('predictEnemyPosition hareketli düşmanı yol boyunca ileri taşır, sersemletilmiş/tutulmuşta sabit kalır ve havan öngörüsü yapar', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 410 });
    sim.hero.dead = true;
    sim.hero.respawnTimer = 999;

    const mover = sim.spawnEnemy('scout_bot', 300, 3.0, 5, {
      x: LEVELS[0].path[1].x,
      z: LEVELS[0].path[1].z,
      wpIndex: 2,
      progress: 3,
    });
    const ahead = sim.predictEnemyPosition(mover, 0.5);
    assert.ok(Math.hypot(ahead.x - mover.x, ahead.z - mover.z) > 1.0, 'Hareketli düşman için ileri nokta tahmin edilmeli');

    mover.stunTimer = 1.0;
    const stunnedPos = sim.predictEnemyPosition(mover, 0.5);
    assert.deepEqual(stunnedPos, { x: mover.x, z: mover.z });
    mover.stunTimer = 0;

    // Son durakta clamp kontrolü
    const tailWp = LEVELS[0].path[LEVELS[0].path.length - 1];
    mover.x = tailWp.x;
    mover.z = tailWp.z;
    mover.wpIndex = LEVELS[0].path.length - 1;
    const clamped = sim.predictEnemyPosition(mover, 2.0);
    assert.deepEqual(clamped, { x: tailWp.x, z: tailWp.z });

    // Havan (AoE) kulesi atış noktasını hareket yönüne göre öngörür
    sim.gold = 300;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'beaver' }, 'p1', 0);
    const runner = sim.spawnEnemy('scout_bot', 300, 3.5, 5, {
      x: -2.0,
      z: 2.3,
      wpIndex: 4,
      progress: 8,
    });
    sim.step(FIXED_DT);
    const fired = sim.drainEvents().find((e) => e.type === 'TOWER_FIRED' && e.towerId === 'beaver');
    assert.ok(fired && fired.type === 'TOWER_FIRED');
    const launchSpotDiff = Math.hypot(fired.toX - runner.x, fired.toZ - runner.z);
    assert.ok(launchSpotDiff > 0.2, `Havan öngörü noktasını nişan almalı (fark=${launchSpotDiff.toFixed(2)}m)`);
  });

  it('Uçuş ortasında hedefi ölen mermi yakındaki canlı düşmana kilitlenir (boşa gitmez)', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 411 });
    sim.hero.dead = true;
    sim.hero.respawnTimer = 999;
    sim.gold = 300;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);

    const primary = sim.spawnEnemy('scout_bot', 200, 0.2, 5, { x: -1.8, z: 3.0, wpIndex: 3, progress: 14 });
    const secondary = sim.spawnEnemy('scout_bot', 200, 0.2, 5, { x: -2.3, z: 3.2, wpIndex: 3, progress: 12 });

    sim.step(FIXED_DT);
    assert.equal(sim.projectiles.length, 1, 'Sincap atışı başlatmalı');
    primary.hp = 0; // Hedef havadayken düşer

    let hitSecondary = false;
    for (let i = 0; i < 60; i++) {
      sim.step(FIXED_DT);
      if (sim.drainEvents().some((e) => e.type === 'ENEMY_HIT' && e.enemyId === secondary.uid)) {
        hitSecondary = true;
        break;
      }
    }
    assert.equal(hitSecondary, true, 'Hedef öldüğünde mermi yakındaki düşmana yönlenmeli');
    assert.ok(secondary.hp < 200, 'Yedek hedef hasar almalıdır');
  });

  it('Meşe Muhafızları saldırısında GUARD_ATTACK ve impactKind=melee olayları yayılır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 412 });
    sim.hero.dead = true;
    sim.hero.respawnTimer = 999;
    const pt = LEVELS[0].path[2];
    sim.dispatch({ type: 'CAST_REINFORCEMENTS', x: pt.x, z: pt.z }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.guards.length, 2);

    sim.spawnEnemy('scout_bot', 300, 0.1, 5, { x: sim.guards[0].x + 0.3, z: sim.guards[0].z, wpIndex: 2, progress: 6 });
    let sawGuardEv = false;
    let sawMeleeHit = false;
    for (let i = 0; i < 20; i++) {
      sim.step(FIXED_DT);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'GUARD_ATTACK') sawGuardEv = true;
        if (ev.type === 'ENEMY_HIT' && ev.impactKind === 'melee') sawMeleeHit = true;
      }
    }
    assert.equal(sawGuardEv, true, 'GUARD_ATTACK olayı üretilmeli');
    assert.equal(sawMeleeHit, true, 'ENEMY_HIT impactKind=melee içermeli');
  });

  it('ENEMY_HIT malzeme türleri (frost/electric/acid/pierce/physical) ve donma durumunu taşır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 413 });
    sim.hero.dead = true;
    sim.hero.respawnTimer = 999;
    sim.gold = 2000;
    const slot1 = sim.slots.get('slot_1')!;
    const slot2 = sim.slots.get('slot_2')!;
    const slot3 = sim.slots.get('slot_3')!;
    const slot4 = sim.slots.get('slot_4')!;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: slot1.id, towerId: 'lynx' }, 'p1', 0);
    sim.dispatch({ type: 'BUILD_TOWER', slotId: slot2.id, towerId: 'owl' }, 'p1', 0);
    sim.dispatch({ type: 'BUILD_TOWER', slotId: slot3.id, towerId: 'hedgehog' }, 'p1', 0);
    sim.dispatch({ type: 'BUILD_TOWER', slotId: slot4.id, towerId: 'badger' }, 'p1', 0);

    sim.spawnEnemy('shield_loader', 2500, 0.05, 10, { x: 0.0, z: 2.0, wpIndex: 3, progress: 15 });
    const seenKinds = new Set<string>();
    let sawArmorBreak = false;

    for (let i = 0; i < 240; i++) {
      sim.step(FIXED_DT);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'ENEMY_HIT') {
          if (ev.impactKind) seenKinds.add(ev.impactKind);
          if (ev.armorBroken) sawArmorBreak = true;
        }
      }
    }
    assert.ok(seenKinds.has('frost'), 'Vaşak frost etiketi üretmeli');
    assert.ok(seenKinds.has('electric'), 'Baykuş electric etiketi üretmeli');
    assert.ok(seenKinds.has('pierce'), 'Kirpi pierce etiketi üretmeli');
    assert.ok(seenKinds.has('acid'), 'Rakun acid etiketi üretmeli');
    assert.equal(sawArmorBreak, true, 'Zırh kırma durumu ENEMY_HIT olayına işlenmeli');
  });

  it('Çoklu imha perde merdiveni ve deterministik tekrar koruması hatasız çalışır', () => {
    const pitches = [1, 2, 3, 4, 5, 6, 8].map((s) => computeKillStreakPitch(s));
    assert.equal(pitches[0], 1.0);
    assert.equal(pitches[5], 1.48);
    assert.equal(pitches[6], 1.48);
    for (let i = 1; i < pitches.length; i++) {
      assert.ok(pitches[i] >= pitches[i - 1]);
    }

    const sfx = new SoundEngine();
    for (const kind of ['physical', 'pierce', 'frost', 'acid', 'electric', 'melee'] as const) {
      sfx.playHit(false, false, false, false, kind);
    }
    sfx.playMeleeClash();
    sfx.playScrapBreak(4);
    sfx.playCoin(4);
    sfx.playMultiKillChime(4);

    const replay = () => {
      const sim = new SimulationEngine(LEVELS[0], { seed: 9999 });
      sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'beaver' }, 'p1', 1);
      sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_2', towerId: 'squirrel' }, 'p1', 2);
      sim.dispatch({ type: 'CALL_WAVE_EARLY' }, 'p1', 5);
      for (let i = 0; i < 400; i++) sim.step(FIXED_DT);
      return sim.getChecksum();
    };
    assert.equal(replay(), replay(), 'Mermi öngörüsü ve hedef değişimi determinizmi bozmamalıdır');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { BEAR_HERO_SPEC, ENEMY_LIST, HERO_CLASSES, resolveHeroVisualVariant } from '../src/data/enemies.ts';
import { LEVELS, isLevelUnlocked } from '../src/data/levels.ts';
import { CARD_MAX_LEVEL, cardLevelMultiplier } from '../src/data/towers.ts';
import { calculateAfkAccumulation } from '../src/services/ProgressionService.ts';
import { createInitialSave } from '../src/services/SaveManager.ts';

describe('Palamut Kalesi deterministic simulation & economy', () => {
  it('replays identical CommandBus sequence to identical checksum', () => {
    const runReplay = () => {
      const sim = new SimulationEngine(LEVELS[0], { seed: 4242 });
      sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 1);
      sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_2', towerId: 'beaver' }, 'p1', 2);
      sim.dispatch({ type: 'MOVE_HERO', x: -1.5, z: 3.5 }, 'p1', 5);
      sim.dispatch({ type: 'CALL_WAVE_EARLY' }, 'p1', 10);
      for (let i = 0; i < 600; i++) {
        sim.step(FIXED_DT);
      }
      return { checksum: sim.getChecksum(), gold: sim.gold, kills: sim.totalKills };
    };

    const a = runReplay();
    const b = runReplay();
    assert.deepEqual(a, b);
    assert.ok(a.kills > 0);
  });

  it('keeps fast enemies on sharp corners within one tick of path_length / speed', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 100 });
    sim.hero.dead = true; // isolate pure waypoint traversal without hero blocking
    sim.hero.respawnTimer = 999;
    const speed = 23.0; // 10x typical speed
    const enemy = sim.spawnEnemy('scout_bot', 9999, speed, 0);
    const expectedTime = sim.getPathLength() / speed;

    let ticks = 0;
    while (sim.enemies.includes(enemy) && ticks < 2000) {
      sim.step(FIXED_DT);
      ticks += 1;
    }
    const actualTime = ticks * FIXED_DT;
    assert.ok(Math.abs(actualTime - expectedTime) <= FIXED_DT * 1.5, `actual=${actualTime}, expected=${expectedTime}`);
  });

  it('defaults "first" targeting to furthest path progress even when another enemy is closer', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 200 });
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_3', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);

    // Closest to slot_3 (-0.2, 0) but low path progress
    const closerLowProgress = sim.spawnEnemy('scout_bot', 100, 0.01, 5, { x: -0.1, z: 0.1, progress: 5, wpIndex: 3 });
    // Further from slot_3 yet inside range (7m) and ahead on path
    const furthestProgress = sim.spawnEnemy('scout_bot', 100, 0.01, 5, { x: -2.6, z: -3.0, progress: 22, wpIndex: 7 });

    const tower = sim.slots.get('slot_3')!.tower!;
    const picked = sim.selectTarget(tower);
    assert.equal(picked?.uid, furthestProgress.uid);
    assert.notEqual(picked?.uid, closerLowProgress.uid);
  });

  it('enforces 60% sell refund, card Lv.1->15 scaling, and AFK Patrol cap (8h vs 16h VIP)', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 300 });
    sim.gold = 300;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.dispatch({ type: 'UPGRADE_TOWER', slotId: 'slot_1' }, 'p1', 1);
    sim.step(FIXED_DT);
    sim.step(FIXED_DT);
    assert.equal(sim.gold, 175); // 300 - 50 - 75

    sim.dispatch({ type: 'SELL_TOWER', slotId: 'slot_1' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.gold, 250); // +75 (60% of 125)

    assert.equal(CARD_MAX_LEVEL, 20);
    assert.equal(cardLevelMultiplier(1), 1.0);
    assert.ok(Math.abs(cardLevelMultiplier(15) - 2.12) < 1e-9);
    assert.ok(Math.abs(cardLevelMultiplier(20) - 2.52) < 1e-9);

    const now = 1_700_000_000_000;
    const freeSave = createInitialSave(now);
    freeSave.afkLastClaimAt = now - 20 * 3600 * 1000;
    const freshAfk = calculateAfkAccumulation(freeSave, now);
    assert.equal(freshAfk.capHours, 8);
    assert.equal(freshAfk.hoursElapsed, 8);

    const progressedSave = createInitialSave(now);
    progressedSave.afkLastClaimAt = now - 20 * 3600 * 1000;
    for (let id = 1; id <= 50; id++) progressedSave.levelStars[id] = 3;
    const lateAfk = calculateAfkAccumulation(progressedSave, now);
    assert.ok(lateAfk.oakCoins > freshAfk.oakCoins, '50 bölüm tamamlama AFK devriye saatlik palamutu artırmalı');

    freeSave.vipTier = 'monthly';
    freeSave.vipExpiresAt = now + 30 * 24 * 3600 * 1000;
    assert.equal(calculateAfkAccumulation(freeSave, now).capHours, 16);
    assert.equal(calculateAfkAccumulation(freeSave, now).hoursElapsed, 16);
    assert.equal(calculateAfkAccumulation(freeSave, freeSave.vipExpiresAt + 1).capHours, 8);
    assert.equal(calculateAfkAccumulation(freeSave, freeSave.vipExpiresAt + 1).hoursElapsed, 8);
  });

  it('triggers Boss Phase 2 at 50% HP: spawns 4 swarm_saws, smokes closest tower, and allows clear', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 400 });
    sim.gold = 500;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'hedgehog' }, 'p1', 0);
    sim.step(FIXED_DT);

    const boss = sim.spawnEnemy('mega_harvester', 1000, 0.01, 60, { x: -1.4, z: 4.5, wpIndex: 3, progress: 10 });
    boss.hp = 520; // 52% HP: pinecone rain deals ~33 dmg after 35% armor, dropping below 500
    // Direct hit via pinecone rain triggers <= 50% threshold
    sim.dispatch({ type: 'CAST_PINECONE_RAIN', x: boss.x, z: boss.z }, 'p1', 0);
    sim.step(FIXED_DT);
    sim.step(FIXED_DT); // let newly spawned swarm_saws appear in survivors list

    assert.equal(boss.phase2Triggered, true);
    const saws = sim.enemies.filter((e) => e.enemyId === 'swarm_saw');
    assert.equal(saws.length, 4);
    assert.ok(sim.slots.get('slot_1')!.tower!.smokedTimer > 0);

    sim.dispatch({ type: 'CLEAR_SMOKE', slotId: 'slot_1' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.slots.get('slot_1')!.tower!.smokedTimer, 0);
  });

  it('validates 50 campaign levels across 5 biomes with clean road/slot clearances', () => {
    assert.equal(LEVELS.length, 50);
    assert.equal(LEVELS.filter((l) => l.biome === 'forest').length, 11, 'biome forest');
    assert.equal(LEVELS.filter((l) => l.biome === 'canyon').length, 8, 'biome canyon');
    assert.equal(LEVELS.filter((l) => l.biome === 'cavern').length, 8, 'biome cavern');
    assert.equal(LEVELS.filter((l) => l.biome === 'snow').length, 10, 'biome snow');
    assert.equal(LEVELS.filter((l) => l.biome === 'foundry').length, 13, 'biome foundry');

    assert.equal(isLevelUnlocked(1, {}), true);
    assert.equal(isLevelUnlocked(2, {}), false);
    assert.equal(isLevelUnlocked(2, { 1: 1 }), true);
    assert.equal(isLevelUnlocked(10, {}), false);
    assert.equal(isLevelUnlocked(11, {}), false);
    assert.equal(isLevelUnlocked(11, { 10: 2 }), true);
    assert.equal(isLevelUnlocked(50, {}), false);
    assert.equal(isLevelUnlocked(50, { 49: 1 }), true);

    const distSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
      const vx = bx - ax;
      const vz = bz - az;
      const len2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
      return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
    };

    for (const lvl of LEVELS.slice(3)) {
      const lanes = [lvl.path, ...(lvl.secondaryPath ? [lvl.secondaryPath] : [])];
      for (const s of lvl.slots) {
        assert.ok(Math.abs(s.x) <= 4.9 && s.z >= -8.5 && s.z <= 9.0, `Lv${lvl.id} ${s.id} out of bounds`);
        for (const lane of lanes) {
          for (let i = 0; i < lane.length - 1; i++) {
            const a = lane[i];
            const b = lane[i + 1];
            const d = distSeg(s.x, s.z, a.x, a.z, b.x, b.z);
            assert.ok(d >= 1.52, `Lv${lvl.id} ${s.id} road clearance ${d.toFixed(2)}m < 1.52m`);
          }
        }
      }
    }
  });

  it('executes all 14 monster specs deterministically plus hero slot-clear movement & magnet event', () => {
    assert.equal(ENEMY_LIST.length, 14);

    // Hero MOVE_HERO pushes target out of slot radius, sets repositionTimer, and stays clear of slots
    const simHero = new SimulationEngine(LEVELS[0], { seed: 599 });
    const slot1 = LEVELS[0].slots[0];
    simHero.dispatch({ type: 'MOVE_HERO', x: slot1.x, z: slot1.z }, 'p1', 0);
    simHero.step(FIXED_DT);
    assert.ok(simHero.hero.repositionTimer > 0);
    assert.ok(Math.hypot(simHero.hero.targetX - slot1.x, simHero.hero.targetZ - slot1.z) >= 0.85);
    for (let i = 0; i < 45; i++) {
      simHero.step(FIXED_DT);
      for (const s of simHero.slots.values()) {
        assert.ok(Math.hypot(simHero.hero.x - s.x, simHero.hero.z - s.z) >= 0.76);
      }
    }

    // CAST_ACORN_MAGNET emits ACORN_MAGNET event for 3D VFX/SFX
    simHero.drainEvents();
    simHero.dispatch({ type: 'CAST_ACORN_MAGNET' }, 'p1', 0);
    simHero.step(FIXED_DT);
    const magnetEv = simHero.drainEvents().find((e) => e.type === 'ACORN_MAGNET');
    assert.ok(magnetEv, 'ACORN_MAGNET event emitted');

    // 1. Turbo Hopper dashes at 1.45x base speed during dash window
    const simDash = new SimulationEngine(LEVELS[3], { seed: 500 });
    simDash.hero.dead = true;
    simDash.hero.respawnTimer = 999;
    const hopper = simDash.spawnEnemy('turbo_hopper');
    for (let i = 0; i < 30; i++) simDash.step(FIXED_DT); // 0.5s inside 0.65s dash window
    assert.ok(hopper.progress > 3.75 * 0.5 * 1.2, `hopper progress=${hopper.progress}`);

    // 2. Chomp Brute splits into 2 Swarm Saws on death
    const simSplit = new SimulationEngine(LEVELS[4], { seed: 501 });
    simSplit.hero.dead = true;
    simSplit.hero.respawnTimer = 999;
    const brute = simSplit.spawnEnemy('chomp_brute', 10, 0.01, 13, { x: 0, z: 0, wpIndex: 3, progress: 8 });
    simSplit.dispatch({ type: 'CAST_PINECONE_RAIN', x: brute.x, z: brute.z }, 'p1', 0);
    simSplit.step(FIXED_DT);
    assert.equal(simSplit.enemies.filter((e) => e.enemyId === 'swarm_saw').length, 2);

    // 3. Repair Drone flying heal aura + Crystal Golem self-regen
    const simRegen = new SimulationEngine(LEVELS[6], { seed: 502 });
    simRegen.hero.dead = true;
    simRegen.hero.respawnTimer = 999;
    const ally = simRegen.spawnEnemy('shield_loader', 135, 0.01, 11, { x: 0, z: 0, wpIndex: 2, progress: 5 });
    ally.hp = 50;
    const medic = simRegen.spawnEnemy('repair_drone', 92, 0.01, 9, { x: 0.6, z: 0, wpIndex: 2, progress: 5 });
    const golem = simRegen.spawnEnemy('crystal_golem', 320, 0.01, 18, { x: 4, z: 4, wpIndex: 2, progress: 5 });
    golem.hp = 150;
    assert.equal(medic.isFlying, true);
    for (let i = 0; i < 60; i++) simRegen.step(FIXED_DT);
    assert.ok(ally.hp > 60 && ally.hp <= 135, `ally healed to ${ally.hp}`);
    assert.ok(golem.hp > 158 && golem.hp <= 320, `golem regenerated to ${golem.hp}`);

    // 4. Cryo Colossus triggers Phase 2 at 50% HP and summons 2 Crystal Golems
    const simCryo = new SimulationEngine(LEVELS[8], { seed: 503 });
    const cryo = simCryo.spawnEnemy('cryo_colossus', 2450, 0.01, 95, { x: 0, z: 4, wpIndex: 2, progress: 5 });
    cryo.hp = 1235; // 50.4% HP -> pinecone rain drops below 1225
    simCryo.dispatch({ type: 'CAST_PINECONE_RAIN', x: cryo.x, z: cryo.z }, 'p1', 0);
    simCryo.step(FIXED_DT);
    simCryo.step(FIXED_DT);
    assert.equal(cryo.phase2Triggered, true);
    assert.equal(simCryo.enemies.filter((e) => e.enemyId === 'crystal_golem').length, 2);
  });

  it('supports hero class specialization stats (viking / royal) and auto-evolution visual progression', () => {
    const simAuto = new SimulationEngine(LEVELS[0], { seed: 601, heroClass: 'auto' });
    assert.equal(simAuto.hero.maxHp, BEAR_HERO_SPEC.maxHp);
    assert.equal(resolveHeroVisualVariant('auto', 1), 'classic');
    assert.equal(resolveHeroVisualVariant('auto', 2), 'viking');
    assert.equal(resolveHeroVisualVariant('auto', 4), 'royal');
    assert.equal(resolveHeroVisualVariant('viking', 1), 'viking');
    assert.equal(resolveHeroVisualVariant('royal', 1), 'royal');

    const simViking = new SimulationEngine(LEVELS[0], { seed: 602, heroClass: 'viking' });
    assert.equal(simViking.hero.maxHp, Math.round(BEAR_HERO_SPEC.maxHp * HERO_CLASSES.viking.hpMult));
    const enemyV = simViking.spawnEnemy('scout_bot', 200, 0.01, 5, {
      x: simViking.hero.x,
      z: simViking.hero.z,
      wpIndex: 2,
      progress: 5,
    });
    simViking.step(FIXED_DT);
    // Viking deals 1.25x strike (25) + 1.25x claw shock (44) within the first second
    for (let i = 0; i < 65; i++) simViking.step(FIXED_DT);
    assert.ok(enemyV.hp < 180, `viking damaged scout_bot to ${enemyV.hp}`);

    const simRoyal = new SimulationEngine(LEVELS[0], { seed: 603, heroClass: 'royal' });
    assert.equal(simRoyal.hero.maxHp, Math.round(BEAR_HERO_SPEC.maxHp * HERO_CLASSES.royal.hpMult));
    for (let i = 0; i < 4; i++) {
      simRoyal.spawnEnemy('scout_bot', 200, 0.01, 5, {
        x: simRoyal.hero.x,
        z: simRoyal.hero.z,
        wpIndex: 2,
        progress: 5,
      });
    }
    simRoyal.step(FIXED_DT);
    assert.equal(simRoyal.enemies.filter((e) => e.engagedByHero).length, HERO_CLASSES.royal.blockCap);
  });
});

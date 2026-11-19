import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  computeKnockback,
  computePathAwareStagger,
  evalHitJolt,
  evalSquashPop,
  GhostHpTracker,
  hitFlashStrength,
  HIT_FLASH_DURATION,
  HIT_JOLT_DURATION,
  JuiceController,
  KNOCKBACK_HEAVY_M,
  KNOCKBACK_LIGHT_M,
  MICRO_HITSTOP_MAX,
  MICRO_HITSTOP_MIN,
  popScale,
} from '../src/core/JuiceController.ts';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { ENEMY_LIST, type HeroId } from '../src/data/enemies.ts';
import { LEVELS } from '../src/data/levels.ts';
import { TOWER_LIST } from '../src/data/towers.ts';
import {
  CameraController,
  REDUCED_MOTION_TRAUMA_CAP,
  shakeAmount,
} from '../src/rendering/CameraController.ts';
import {
  createEnemyRig,
  createHeroRig,
  createTowerRig,
  triggerHeroAttack,
  triggerTowerRecoil,
  updateEnemyAnimation,
  updateHeroAnimation,
  updateTowerAnimation,
} from '../src/rendering/ModelFactory.ts';
import { randomizePitch, VoiceLimiter } from '../src/audio/SoundEngine.ts';

const FRAME = 1 / 60;

describe('Game feel (hit-stop, trauma shake, squash-pop)', () => {
  it('survives overlapping hit-stop triggers and always restores timeScale to 1.0', () => {
    const juice = new JuiceController();
    juice.triggerHitStop(0.04, 0.08);
    assert.ok(juice.getTimeScale() < 0.2);

    // Advance 30ms, then trigger a stronger overlapping 60ms hit-stop
    juice.step(0.03);
    assert.equal(juice.isFrozen(), true);
    juice.triggerHitStop(0.06, 0.05);

    // Original 40ms elapses — must still remain frozen from overlapping call!
    juice.step(0.02);
    assert.equal(juice.isFrozen(), true);

    // Remaining time completes cleanly -> exact 1.0 restore
    juice.step(0.05);
    assert.equal(juice.isFrozen(), false);
    assert.equal(juice.getTimeScale(), 1.0);
  });

  it('decays CameraController trauma and zoom punch cleanly back to exact rest pose', () => {
    const cam = new CameraController(390 / 844);
    const restPos = cam.basePosition.clone();

    cam.addTrauma(0.6);
    cam.addZoomPunch(1.5);
    cam.addDirectionalKick(1, 0, 0.12);
    cam.update(0.02);
    assert.ok(cam.getTrauma() > 0);
    assert.ok(cam.camera.fov < cam.baseFov);

    // Decay over 1.2s in 16ms increments
    for (let i = 0; i < 80; i++) {
      cam.update(0.016);
    }
    assert.equal(cam.getTrauma(), 0);
    assert.equal(cam.camera.fov, cam.baseFov);
    assert.deepEqual(cam.getKick(), { x: 0, z: 0 });
    assert.equal(cam.getRoll(), 0);
    assert.ok(cam.camera.position.distanceTo(restPos) < 1e-6);
  });

  it('returns exact rest scale {1, 1, 1} when squash-pop timer reaches 0', () => {
    const mid = evalSquashPop(0.10, 0.20, 1.25, 0.76);
    assert.notDeepEqual(mid, { sx: 1, sy: 1, sz: 1 });

    const end = evalSquashPop(0, 0.20, 1.25, 0.76);
    assert.deepEqual(end, { sx: 1, sy: 1, sz: 1 });
  });
});

describe('Hit-flash timing', () => {
  it('holds pure white for the first 2 frames and lands exactly on 0 at the window end', () => {
    assert.ok(HIT_FLASH_DURATION >= 0.045 && HIT_FLASH_DURATION <= 0.06);
    assert.equal(hitFlashStrength(0), 1);
    assert.equal(hitFlashStrength(FRAME), 1);
    assert.equal(hitFlashStrength(2 * FRAME), 1);
    const tail = hitFlashStrength(HIT_FLASH_DURATION * 0.85);
    assert.ok(tail > 0 && tail < 1, `tail fade expected in (0,1), got ${tail}`);
    assert.equal(hitFlashStrength(HIT_FLASH_DURATION), 0);
    assert.equal(hitFlashStrength(HIT_FLASH_DURATION + 0.5), 0);
    assert.equal(hitFlashStrength(-0.01), 0);
  });

  it('is monotonically non-increasing across the window (no re-flash flicker)', () => {
    let prev = Infinity;
    for (let t = 0; t <= HIT_FLASH_DURATION + 0.01; t += 0.002) {
      const s = hitFlashStrength(t);
      assert.ok(s <= prev + 1e-12);
      prev = s;
    }
  });
});

describe('Ghost-damage HP bar', () => {
  it('holds the pre-hit value, then drains and lands exactly on the real HP', () => {
    const g = new GhostHpTracker(0.3, 0.45, 5.5);
    g.update(7, 1.0, FRAME);
    const hit = g.update(7, 0.6, FRAME);
    assert.equal(hit.hp, 0.6);
    assert.equal(hit.ghost, 1.0, 'ghost keeps the chunk visible immediately after the hit');
    assert.equal(hit.hitAge, 0);

    // During the 0.3s hold the ghost must not move
    let s = hit;
    for (let i = 0; i < 15; i++) s = g.update(7, 0.6, FRAME);
    assert.equal(s.ghost, 1.0);

    // After the hold it drains, staying >= hp, and reaches hp exactly
    for (let i = 0; i < 10; i++) s = g.update(7, 0.6, FRAME);
    assert.ok(s.ghost < 1.0 && s.ghost >= 0.6);
    for (let i = 0; i < 120; i++) s = g.update(7, 0.6, FRAME);
    assert.equal(s.ghost, 0.6);
    assert.ok(s.hitAge > 0.3);
  });

  it('restarts the hold on stacked hits and keeps the oldest ghost top', () => {
    const g = new GhostHpTracker(0.3);
    g.update(1, 1.0, FRAME);
    g.update(1, 0.8, FRAME);
    for (let i = 0; i < 10; i++) g.update(1, 0.8, FRAME);
    const second = g.update(1, 0.5, FRAME);
    assert.equal(second.ghost, 1.0);
    assert.equal(second.hp, 0.5);
  });

  it('never lets the ghost fall below HP on heals and prunes dead ids', () => {
    const g = new GhostHpTracker();
    g.update(3, 0.4, FRAME);
    const healed = g.update(3, 0.9, FRAME);
    assert.equal(healed.ghost, 0.9);
    g.update(4, 1, FRAME);
    g.prune(new Set([4]));
    assert.equal(g.get(3), undefined);
    assert.equal(g.size, 1);
  });

  it('pops numbers from scale 1.35 back to exactly 1.0', () => {
    assert.equal(popScale(0), 1.35);
    const mid = popScale(0.05);
    assert.ok(mid < 1.35 && mid > 0.9);
    assert.equal(popScale(0.16), 1);
    assert.equal(popScale(2), 1);
  });
});

describe('Trauma scaling & reduced motion', () => {
  it('maps trauma to shake quadratically (light hits barely move, heavy punch)', () => {
    assert.equal(shakeAmount(0, 1), 0);
    assert.equal(shakeAmount(1, 1), 1);
    assert.ok(Math.abs(shakeAmount(0.5, 1) - 0.25) < 1e-12);
    assert.ok(Math.abs(shakeAmount(0.5, 0.8) - 0.2) < 1e-12);
    // 0.15 light vs 0.8 heavy -> ~28x visible difference
    assert.ok(shakeAmount(0.8, 1) / shakeAmount(0.15, 1) > 25);
    assert.equal(shakeAmount(2, 1), 1, 'clamped');
  });

  it('accumulates trauma additively and clamps at 1', () => {
    const cam = new CameraController(1);
    cam.addTrauma(0.7);
    cam.addTrauma(0.7);
    assert.equal(cam.getTrauma(), 1);
  });

  it('clamps trauma, cuts roll and zoom punch under Reduced Motion', () => {
    const cam = new CameraController(1);
    cam.setShakeStrength(100);
    cam.setReducedMotion(true);
    cam.addTrauma(1);
    cam.addTrauma(1);
    assert.ok(cam.getTrauma() <= REDUCED_MOTION_TRAUMA_CAP + 1e-12);
    cam.addZoomPunch(3);
    cam.addDirectionalKick(1, 0, 0.2);
    for (let i = 0; i < 5; i++) {
      cam.update(FRAME);
      assert.equal(cam.getRoll(), 0);
      assert.equal(cam.camera.fov, cam.baseFov);
    }
    assert.deepEqual(cam.getKick(), { x: 0, z: 0 });
    assert.ok(cam.getShake() <= shakeAmount(REDUCED_MOTION_TRAUMA_CAP, 1) * 0.25 + 1e-12);
  });

  it('disables hit-stop entirely under Reduced Motion', () => {
    const juice = new JuiceController();
    juice.setReducedMotion(true);
    juice.triggerHitStop(0.1, 0.05);
    juice.triggerMicroHitStop(0.04);
    assert.equal(juice.isFrozen(), false);
    assert.equal(juice.getTimeScale(), 1);
  });

  it('clamps micro hit-stop to the 18-45 ms window and restores 1.0', () => {
    const a = new JuiceController();
    a.triggerMicroHitStop(0.2, 0.1);
    a.step(MICRO_HITSTOP_MAX - 0.001);
    assert.equal(a.isFrozen(), true);
    a.step(0.002);
    assert.equal(a.isFrozen(), false);
    assert.equal(a.getTimeScale(), 1);

    const b = new JuiceController();
    b.triggerMicroHitStop(0.001, 0.1);
    b.step(MICRO_HITSTOP_MIN - 0.001);
    assert.equal(b.isFrozen(), true);
    b.step(0.002);
    assert.equal(b.isFrozen(), false);
  });
});

describe('Directional knockback math', () => {
  it('pushes along the normalised projectile velocity: heavy 0.26 m, light 0.14 m', () => {
    const heavy = computeKnockback(3, 4, true);
    assert.ok(Math.abs(heavy.distance - KNOCKBACK_HEAVY_M) < 1e-12);
    assert.ok(Math.abs(heavy.dx - 0.6 * KNOCKBACK_HEAVY_M) < 1e-12);
    assert.ok(Math.abs(heavy.dz - 0.8 * KNOCKBACK_HEAVY_M) < 1e-12);
    assert.ok(Math.abs(Math.hypot(heavy.dx, heavy.dz) - 0.26) < 1e-12);

    const light = computeKnockback(-10, 0, false);
    assert.ok(Math.abs(light.dx + KNOCKBACK_LIGHT_M) < 1e-12);
    assert.equal(light.dz, 0);
    assert.ok(heavy.tiltRad > light.tiltRad);
  });

  it('bosses resist, reduced motion halves, zero vectors are safe', () => {
    const boss = computeKnockback(1, 0, true, { isBoss: true });
    assert.ok(boss.distance < KNOCKBACK_HEAVY_M * 0.5);
    const rm = computeKnockback(1, 0, true, { reducedMotion: true });
    assert.ok(Math.abs(rm.distance - KNOCKBACK_HEAVY_M * 0.5) < 1e-12);
    const zero = computeKnockback(0, 0, true);
    assert.deepEqual(zero, { dx: 0, dz: 0, distance: 0, tiltRad: 0 });
  });

  it('jolt envelope snaps out fast and returns exactly to rest', () => {
    const early = evalHitJolt(HIT_JOLT_DURATION * 0.2);
    assert.ok(Math.abs(early.push - 1) < 1e-9, 'peak push at 20% of the jolt');
    assert.equal(evalHitJolt(0).tilt, 1, 'pitch snaps to full tilt on the impact frame');
    const end = evalHitJolt(HIT_JOLT_DURATION);
    assert.deepEqual(end, { push: 0, tilt: 0 });
    // Wobble overshoots the other way before settling
    assert.ok(evalHitJolt(HIT_JOLT_DURATION / 3).tilt < 0);
  });

  it('tilt axis (dz, 0, -dx) leans the top of the body along the impulse', () => {
    const kb = computeKnockback(1, 0, true);
    const axis = new THREE.Vector3(kb.dz, 0, -kb.dx).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, kb.tiltRad);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    assert.ok(up.x > 0.2, `top should lean toward +X, got ${up.x}`);
    assert.ok(Math.abs(up.z) < 1e-9);
  });
});

describe('Audio dynamics helpers', () => {
  it('randomises pitch within ±10 %', () => {
    assert.ok(Math.abs(randomizePitch(1000, 0.1, () => 0) - 900) < 1e-9);
    assert.ok(Math.abs(randomizePitch(1000, 0.1, () => 1) - 1100) < 1e-9);
    assert.ok(Math.abs(randomizePitch(1000, 0.1, () => 0.5) - 1000) < 1e-9);
  });

  it('limits polyphony and frees voices when they end, with priority head-room', () => {
    const lim = new VoiceLimiter(4, 2);
    for (let i = 0; i < 4; i++) assert.equal(lim.acquire(0, 0.2, 1), true);
    assert.equal(lim.acquire(0, 0.2, 1), false);
    assert.equal(lim.acquire(0, 0.2, 0), false);
    assert.equal(lim.acquire(0, 0.2, 2), true, 'crit/boss voices get reserved head-room');
    assert.equal(lim.activeCount(0.1), 5);
    assert.equal(lim.activeCount(0.25), 0);
    assert.equal(lim.acquire(0.25, 0.2, 1), true);
  });
});

describe('Path-aware stagger & SimulationEngine impact events (GF-2)', () => {
  it('staggers enemies backward along the path even when hit from behind, and respects boss/reducedMotion scaling', () => {
    // Enemy moves forward along -Z toward castle; projectile hits from behind (dirZ = -1)
    const stag = computePathAwareStagger(0, -1, 0, -1, 'heavy');
    assert.ok(stag.dz > 0.3, `back-line hit must still stagger opposite path (+Z), got dz=${stag.dz}`);
    assert.ok(Math.abs(stag.distance - 0.46) < 1e-6);

    const crit = computePathAwareStagger(0, -1, 0, -1, 'crit');
    assert.ok(crit.distance > stag.distance && crit.tiltRad > stag.tiltRad);

    const bossStag = computePathAwareStagger(0, -1, 0, -1, 'crit', { isBoss: true });
    assert.ok(bossStag.distance < crit.distance * 0.4);

    const rmStag = computePathAwareStagger(0, -1, 0, -1, 'heavy', { reducedMotion: true });
    assert.ok(Math.abs(rmStag.distance - stag.distance * 0.45) < 1e-6);
  });

  it('emits PROJECTILE_IMPACT, directional ENEMY_HIT (with resisted flag), and BASE_HIT deterministically', () => {
    const run = (seed: number) => {
      const sim = new SimulationEngine(LEVELS[0], { seed });
      sim.gold = 300;
      sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
      sim.step(FIXED_DT);
      const slot = sim.slots.get('slot_1')!;
      sim.spawnEnemy('shield_loader', 200, 0.01, 10, {
        x: slot.x + 1.2,
        z: slot.z,
        wpIndex: 1,
        progress: 6,
      });
      const events = [];
      for (let i = 0; i < 45; i++) {
        sim.step(FIXED_DT);
        events.push(...sim.drainEvents());
      }
      const impact = events.find((e) => e.type === 'PROJECTILE_IMPACT');
      const hit = events.find((e) => e.type === 'ENEMY_HIT');
      return { sim, events, impact, hit, checksum: sim.getChecksum() };
    };

    const a = run(8801);
    const b = run(8801);
    assert.equal(a.checksum, b.checksum);
    assert.ok(a.impact && a.impact.type === 'PROJECTILE_IMPACT');
    assert.equal(a.impact.towerId, 'squirrel');
    assert.ok(a.hit && a.hit.type === 'ENEMY_HIT');
    assert.ok(typeof a.hit.dirX === 'number' && typeof a.hit.dirZ === 'number');
    assert.equal(a.hit.resisted, true, 'armored shield_loader vs basic squirrel triggers resisted deflection feedback');
  });
});

describe('24-stage obstacle clearances, hero collinear navigation & all unit rigs', () => {
  it('ensures all 24 levels have clean slot, barrel shoulder, and lantern clearances', () => {
    const distSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
      const vx = bx - ax;
      const vz = bz - az;
      const len2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
      return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
    };
    const roadDist = (px: number, pz: number, lvl: (typeof LEVELS)[number]) => {
      let best = Infinity;
      for (const pts of lvl.secondaryPath ? [lvl.path, lvl.secondaryPath] : [lvl.path]) {
        for (let i = 0; i < pts.length - 1; i++) {
          best = Math.min(best, distSeg(px, pz, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z));
        }
      }
      return best;
    };

    assert.equal(LEVELS.length, 24);
    for (const lv of LEVELS) {
      for (const s of lv.slots) {
        const rd = roadDist(s.x, s.z, lv);
        assert.ok(rd >= 1.15, `L${lv.id} slot ${s.id} too close to road (${rd.toFixed(2)}m)`);
      }
      for (const b of lv.barrels ?? []) {
        const rd = roadDist(b.x, b.z, lv);
        assert.ok(rd >= 0.85 && rd <= 1.65, `L${lv.id} barrel ${b.id} roadDist=${rd.toFixed(2)}m out of [0.85, 1.65]`);
        for (const s of lv.slots) {
          const sd = Math.hypot(b.x - s.x, b.z - s.z);
          assert.ok(sd >= 1.45, `L${lv.id} barrel ${b.id} vs slot ${s.id} dist=${sd.toFixed(2)}m < 1.45m`);
        }
      }
      for (const l of lv.lanterns) {
        const rd = roadDist(l.x, l.z, lv);
        assert.ok(rd >= 0.9, `L${lv.id} lantern roadDist=${rd.toFixed(2)}m < 0.90m`);
        for (const s of lv.slots) {
          const sd = Math.hypot(l.x - s.x, l.z - s.z);
          assert.ok(sd >= 1.15, `L${lv.id} lantern vs slot ${s.id} dist=${sd.toFixed(2)}m < 1.15m`);
        }
      }
    }
  });

  it('glides all 4 heroes past collinear slot obstacles and settles at target without getting stuck', () => {
    const heroIds: HeroId[] = ['boz_pence', 'kizil_kuyruk', 'kaya_dis', 'ay_kurdu'];
    for (const heroId of heroIds) {
      const sim = new SimulationEngine(LEVELS[0], { seed: 4201, heroId, waitForFirstWave: true });
      const slot = LEVELS[0].slots[0];
      // Start directly in front of slot along X, command strictly collinear target directly behind slot
      sim.hero.x = slot.x;
      sim.hero.z = slot.z - 1.25;
      sim.hero.targetX = sim.hero.x;
      sim.hero.targetZ = sim.hero.z;

      sim.dispatch({ type: 'MOVE_HERO', x: slot.x, z: slot.z + 1.35 }, 'p1', 0);
      for (let i = 0; i < 180; i++) {
        sim.step(FIXED_DT);
        for (const s of sim.slots.values()) {
          const sd = Math.hypot(sim.hero.x - s.x, sim.hero.z - s.z);
          assert.ok(sd >= 0.76, `${heroId} clipped slot ${s.id} at sd=${sd.toFixed(3)}`);
        }
      }
      assert.equal(sim.hero.moving, false, `${heroId} should finish gliding around collinear slot`);
      assert.ok(sim.hero.z > slot.z + 0.9, `${heroId} should cross behind slot, got z=${sim.hero.z.toFixed(2)}`);

      // Clicking straight onto a slot center pushes target outward and settles cleanly
      sim.dispatch({ type: 'MOVE_HERO', x: slot.x, z: slot.z }, 'p1', 0);
      for (let i = 0; i < 90; i++) sim.step(FIXED_DT);
      assert.equal(sim.hero.moving, false, `${heroId} should settle cleanly when tapping slot center`);
    }
  });

  it('animates all 8 towers, 4 heroes, and 14 enemies cleanly and generates distinct pool kinds', () => {
    for (const tw of TOWER_LIST) {
      const rig = createTowerRig(tw.id, 1, undefined, 'none', false);
      triggerTowerRecoil(rig);
      assert.ok(rig.recoilTimer > 0);
      for (let i = 0; i < 24; i++) updateTowerAnimation(rig, i * 0.02, 0.02);
      assert.equal(rig.recoilTimer, 0);
      assert.equal(rig.weaponGroup.position.z, 0);
      assert.equal(rig.weaponGroup.rotation.x, 0);
      assert.equal(rig.characterGroup.position.y, 0);
      assert.equal(rig.turretHead.scale.x, 1);
    }

    const heroIds: HeroId[] = ['boz_pence', 'kizil_kuyruk', 'kaya_dis', 'ay_kurdu'];
    for (const hid of heroIds) {
      const hRig = createHeroRig(hid, 'none', 'classic');
      triggerHeroAttack(hRig, 1, 0, false);
      assert.equal(hRig.attackSeq, 1);
      for (let i = 0; i < 40; i++) updateHeroAnimation(hRig, false, i * 0.02, 0.02);
      assert.equal(hRig.attackTimer, 0);
      assert.equal(hRig.body.scale.x, 1);
      assert.equal(hRig.body.position.x, 0);
    }

    for (const en of ENEMY_LIST) {
      const eRig = createEnemyRig(en.id);
      eRig.hitJoltTimer = 0.16;
      updateEnemyAnimation(eRig, 0.1, 0.02, 0.02, 1, false);
      assert.ok(eRig.hitJoltTimer > 0);
      for (let i = 0; i < 15; i++) updateEnemyAnimation(eRig, i * 0.02, 0.02, 0.02, 1, false);
      assert.equal(eRig.hitJoltTimer, 0);
      assert.equal(eRig.body.scale.x, 1);
    }

    // Distinct pool kinds from badger vs badger_inferno vs beaver_resin vs fox_storm
    const simFox = new SimulationEngine(LEVELS[0], { seed: 991, heroId: 'kizil_kuyruk' });
    simFox.dispatch({ type: 'CAST_HERO_ULTIMATE', x: 0, z: 0 }, 'p1', 0);
    simFox.step(FIXED_DT);
    assert.equal(simFox.resinPools[0]?.kind, 'acid');

    const simBadger = new SimulationEngine(LEVELS[0], { seed: 992, waitForFirstWave: true });
    simBadger.gold = 2000;
    simBadger.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'badger' }, 'p1', 0);
    simBadger.step(FIXED_DT);
    const s1 = simBadger.slots.get('slot_1')!;
    simBadger.spawnEnemy('shield_loader', 600, 0.01, 10, { x: s1.x + 1.5, z: s1.z, wpIndex: 1, progress: 5 });
    for (let i = 0; i < 40; i++) simBadger.step(FIXED_DT);
    assert.equal(simBadger.resinPools[0]?.kind, 'acid');

    simBadger.resinPools = [];
    simBadger.dispatch({ type: 'UPGRADE_TOWER', slotId: 'slot_1' }, 'p1', 0);
    simBadger.step(FIXED_DT);
    simBadger.dispatch({ type: 'EVOLVE_TOWER', slotId: 'slot_1', branchId: 'badger_inferno' }, 'p1', 0);
    simBadger.step(FIXED_DT);
    for (let i = 0; i < 90; i++) simBadger.step(FIXED_DT);
    assert.ok(simBadger.resinPools.some((p) => p.kind === 'inferno'), 'badger_inferno must emit inferno pool kind');
  });
});

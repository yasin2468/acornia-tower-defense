import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import { TOWERS } from '../src/data/towers.ts';

describe('Paket 1 — Boz Pençe akıllı nöbet, vuruş olayı ve sınıf ultileri', () => {
  it('nöbet noktasına yaklaşan düşmana kendiliğinden koşar, HERO_ATTACK üretir ve temizleyince nöbete döner', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 901 });
    sim.dispatch({ type: 'MOVE_HERO', x: 0.0, z: 0.0 }, 'p1', 0);
    sim.step(FIXED_DT);
    const rallyEvents = sim.drainEvents().filter((e) => e.type === 'HERO_RALLY');
    assert.equal(rallyEvents.length, 1);

    // Düşmanı nöbet noktasına 3.4m (leash <= 4.2m, engageRange 2.1m dışı) mesafeye koy
    const scout = sim.spawnEnemy('scout_bot', 30, 0.01, 5, { x: 3.4, z: 0.0, wpIndex: 3, progress: 12 });
    let sawAttack = false;
    for (let i = 0; i < 120 && scout.hp > 0; i++) {
      sim.step(FIXED_DT);
      if (sim.drainEvents().some((e) => e.type === 'HERO_ATTACK')) sawAttack = true;
    }

    assert.equal(sawAttack, true, 'yakın dövüşte HERO_ATTACK olayı üretilmeli');
    assert.equal(scout.hp, 0, 'ayı düşmana koşup öldürmeli');
    assert.ok(sim.hero.x > 1.5, `ayı kovalamış olmalı (x=${sim.hero.x.toFixed(2)})`);

    // Çatışma bitince nöbet noktasına (0, 0) geri dönmeli
    for (let i = 0; i < 90; i++) sim.step(FIXED_DT);
    assert.ok(Math.hypot(sim.hero.x - 0, sim.hero.z - 0) < 0.25, 'ayı nöbet noktasına dönmeli');
  });

  it('Klasik ulti (Kükreme Depremi): iyileşir, sersemletir ve zırh kırar', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 902, heroClass: 'classic' });
    sim.hero.hp = 120;
    const tank = sim.spawnEnemy('shield_loader', 400, 0.01, 10, {
      x: sim.hero.x + 1.8,
      z: sim.hero.z,
      wpIndex: 3,
      progress: 10,
    });
    const origArmor = tank.armor;

    sim.dispatch({ type: 'CAST_HERO_ULTIMATE' }, 'p1', 0);
    sim.step(FIXED_DT);
    const ultEv = sim.drainEvents().find((e) => e.type === 'HERO_ULTIMATE');

    assert.ok(ultEv && ultEv.type === 'HERO_ULTIMATE' && ultEv.variant === 'classic');
    assert.ok(sim.hero.hp > 120, 'Klasik ulti can iyileştirmeli');
    assert.ok(tank.stunTimer >= 1.7, `sersemletme uygulanmalı (${tank.stunTimer})`);
    assert.ok(tank.armor < origArmor, `zırh kırılmalı (${tank.armor} < ${origArmor})`);
    assert.ok(sim.hero.skillCooldown >= 17.5);
  });

  it('Viking ultisi (Vahşi Sıçrama): hedefe sıçrar, nöbeti taşır ve saldırıyı hızlandırır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 903, heroClass: 'viking' });
    const target = sim.spawnEnemy('chomp_brute', 300, 0.01, 10, { x: -2.2, z: 3.0, wpIndex: 3, progress: 14 });

    sim.dispatch({ type: 'CAST_HERO_ULTIMATE', x: -2.0, z: 3.0 }, 'p1', 0);
    sim.step(FIXED_DT);
    const evs = sim.drainEvents();
    const ultEv = evs.find((e) => e.type === 'HERO_ULTIMATE');

    assert.ok(ultEv && ultEv.type === 'HERO_ULTIMATE' && ultEv.variant === 'viking');
    assert.ok(Math.hypot(sim.hero.x - -2.0, sim.hero.z - 3.0) < 0.01, 'hedefe sıçramalı');
    assert.ok(Math.hypot(sim.hero.targetX - -2.0, sim.hero.targetZ - 3.0) < 0.01, 'nöbet noktası da taşınmalı');
    assert.equal(sim.hero.activeBuff, 'berserk');
    assert.ok(target.hp < 300, 'sıçrama iniş hasarı vurmalı');
    assert.ok(target.stunTimer >= 0.9, 'inişte sersemletmeli');
  });

  it('Kraliyet ultisi (Kraliyet Sancağı) + pasif aura: yakındaki kulenin atış hızını artırır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 904, heroClass: 'royal' });
    sim.gold = 200;
    const slot = sim.slots.get('slot_3')!;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_3', towerId: 'squirrel' }, 'p1', 0);
    sim.dispatch({ type: 'MOVE_HERO', x: slot.x + 1.0, z: slot.z }, 'p1', 1);
    sim.step(FIXED_DT);
    sim.step(FIXED_DT);
    sim.hero.x = slot.x + 1.0;
    sim.hero.z = slot.z;

    sim.spawnEnemy('scout_bot', 999, 0.01, 5, { x: slot.x + 2.0, z: slot.z, wpIndex: 3, progress: 12 });
    sim.step(FIXED_DT);
    const passiveCd = slot.tower!.cooldown;
    const baseCd = 1 / TOWERS.squirrel.tier1.fireRate;
    assert.ok(passiveCd < baseCd, `Kraliyet pasifi cooldown'u düşürmeli (${passiveCd.toFixed(3)} < ${baseCd.toFixed(3)})`);

    sim.dispatch({ type: 'CAST_HERO_ULTIMATE' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.hero.activeBuff, 'banner');
    slot.tower!.cooldown = 0;
    sim.step(FIXED_DT);
    assert.ok(slot.tower!.cooldown < passiveCd, `Aktif Sancak daha da hızlandırmalı (${slot.tower!.cooldown.toFixed(3)} < ${passiveCd.toFixed(3)})`);
  });
});

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 1e-9) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function minDistToPath(px: number, pz: number, path: Array<{ x: number; z: number }>): number {
  let minD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distToSegment(px, pz, path[i].x, path[i].z, path[i + 1].x, path[i + 1].z);
    if (d < minD) minD = d;
  }
  return minD;
}

describe('Paket 2 — 12 bölüm yol/yuva geometrisi ve çatallı ikincil yollar', () => {
  it('12 bölümün tümünde yuvalar görüş alanında, yoldan >= 1.55m ve birbirinden >= 1.70m uzak, kahraman yol üzerinde', () => {
    for (const lvl of LEVELS) {
      for (const s of lvl.slots) {
        assert.ok(Math.abs(s.x) <= 3.5, `${lvl.id} ${s.id} x sınır dışı (${s.x})`);
        assert.ok(s.z >= -6.8 && s.z <= 6.8, `${lvl.id} ${s.id} z sınır dışı (${s.z})`);

        const dMain = minDistToPath(s.x, s.z, lvl.path);
        assert.ok(dMain >= 1.55, `${lvl.id} ${s.id} ana yola çok yakın (${dMain.toFixed(2)}m)`);
        if (lvl.secondaryPath) {
          const dSec = minDistToPath(s.x, s.z, lvl.secondaryPath);
          assert.ok(dSec >= 1.55, `${lvl.id} ${s.id} ikincil yola çok yakın (${dSec.toFixed(2)}m)`);
        }
      }

      for (let i = 0; i < lvl.slots.length; i++) {
        for (let j = i + 1; j < lvl.slots.length; j++) {
          const a = lvl.slots[i];
          const b = lvl.slots[j];
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          assert.ok(d >= 1.7, `${lvl.id} ${a.id}-${b.id} çok yakın (${d.toFixed(2)}m)`);
        }
      }

      const heroRoadDist = Math.min(
        minDistToPath(lvl.heroStart.x, lvl.heroStart.z, lvl.path),
        lvl.secondaryPath ? minDistToPath(lvl.heroStart.x, lvl.heroStart.z, lvl.secondaryPath) : Infinity
      );
      assert.ok(heroRoadDist <= 0.5, `${lvl.id} heroStart yola uzak (${heroRoadDist.toFixed(2)}m)`);
    }
  });

  it('çatallı bölümde (Seviye 2) düşmanlar lane 0 ve lane 1 arasında dönüşümlü doğar ve ikinci yolu izler', () => {
    const level2 = LEVELS[1];
    assert.ok(level2.secondaryPath && level2.secondaryPath.length >= 2, 'Seviye 2 secondaryPath içermeli');

    const sim = new SimulationEngine(level2, { seed: 202 });
    let lane1SpawnedPos: { x: number; z: number } | null = null;
    for (let i = 0; i < 450; i++) {
      sim.step(FIXED_DT);
      if (!lane1SpawnedPos) {
        const firstLane1 = sim.enemies.find((e) => e.lane === 1);
        if (firstLane1) lane1SpawnedPos = { x: firstLane1.x, z: firstLane1.z };
      }
      if (sim.enemies.length >= 4) break;
    }

    const lanes = new Set(sim.enemies.map((e) => e.lane));
    assert.equal(lanes.has(0), true, 'ana yoldan (lane 0) düşman doğmalı');
    assert.equal(lanes.has(1), true, 'ikincil yoldan (lane 1) düşman doğmalı');

    const startX = level2.secondaryPath![0].x;
    const startZ = level2.secondaryPath![0].z;
    assert.ok(lane1SpawnedPos !== null, 'ikincil yolda düşman belirmeli');
    assert.ok(
      Math.hypot(lane1SpawnedPos.x - startX, lane1SpawnedPos.z - startZ) < 0.25,
      `lane 1 düşmanı secondaryPath başından ilerlemeli (x=${lane1SpawnedPos.x.toFixed(2)}, z=${lane1SpawnedPos.z.toFixed(2)})`
    );
  });
});

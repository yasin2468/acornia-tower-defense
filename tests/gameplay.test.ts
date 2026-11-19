import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import { TOWERS } from '../src/data/towers.ts';
import { t } from '../src/i18n/locales.ts';
import { STAGE_LIGHTING_THEMES, buildStageConcept } from '../src/rendering/StageConcepts.ts';

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

describe('Paket 2 — 16 bölüm yol/yuva geometrisi ve çatallı ikincil yollar', () => {
  it('16 bölümün tümünde yuvalar görüş alanında, yoldan >= 1.55m ve birbirinden >= 1.70m uzak, kahraman yol üzerinde', () => {
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

describe('Paket 3 — Patlayıcı kanyon fıçısı, rün yuvası bonusu ve buz bölgesi hızlanması', () => {
  it('Kanyon patlayıcı fıçısı (Seviye 4) yakındaki düşmanı yakar, sersemletir ve tek kullanımlıktır', () => {
    const level4 = LEVELS[3];
    const barrel = level4.barrels![0];
    const sim = new SimulationEngine(level4, { seed: 301 });
    const enemy = sim.spawnEnemy('shield_loader', 240, 0.01, 10, {
      x: barrel.x + 1.0,
      z: barrel.z,
      wpIndex: 2,
      progress: 5,
    });

    sim.dispatch({ type: 'DETONATE_BARREL', barrelId: barrel.id }, 'p1', 0);
    sim.step(FIXED_DT);
    const evs = sim.drainEvents();
    const expEv = evs.find((e) => e.type === 'BARREL_EXPLODED');
    assert.ok(expEv && expEv.type === 'BARREL_EXPLODED' && expEv.hits === 1);
    assert.ok(enemy.hp < 240, 'patlayıcı fıçı hasar vurmalı');
    assert.ok(enemy.stunTimer >= 1.0, 'patlayıcı fıçı sersemletmeli');
    assert.equal(sim.barrels.get(barrel.id)!.exploded, true);

    const hpAfterFirst = enemy.hp;
    sim.dispatch({ type: 'DETONATE_BARREL', barrelId: barrel.id }, 'p1', 1);
    sim.step(FIXED_DT);
    assert.equal(enemy.hp, hpAfterFirst, 'aynı fıçı ikinci kez patlamamalı');
  });

  it('Rün yuvası (Seviye 7 slot_3) kule menzilini +%15 ve atış hasarını +%18 artırır', () => {
    const level7 = LEVELS[6];
    const sim = new SimulationEngine(level7, { seed: 302 });
    sim.gold = 400;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_3', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);

    const normalStats = sim.getTowerStats(sim.slots.get('slot_1')!.tower!);
    const runeStats = sim.getTowerStats(sim.slots.get('slot_3')!.tower!);
    assert.equal(normalStats.range, TOWERS.squirrel.tier1.range);
    assert.equal(runeStats.range, Number((TOWERS.squirrel.tier1.range * 1.15).toFixed(2)));

    const s1 = sim.slots.get('slot_1')!;
    const s3 = sim.slots.get('slot_3')!;
    const e1 = sim.spawnEnemy('scout_bot', 500, 0.001, 5, { x: s1.x + 0.5, z: s1.z, wpIndex: 3, progress: 5 });
    const e3 = sim.spawnEnemy('scout_bot', 500, 0.001, 5, { x: s3.x + 0.5, z: s3.z, wpIndex: 5, progress: 15 });
    for (let i = 0; i < 60 && e1.hp === 500 && e3.hp === 500; i++) {
      sim.step(FIXED_DT);
    }
    for (let i = 0; i < 20; i++) sim.step(FIXED_DT);
    const dmgNormal = 500 - e1.hp;
    const dmgRune = 500 - e3.hp;
    assert.ok(dmgRune > dmgNormal, `Rün hasarı (${dmgRune}) normalden (${dmgNormal}) büyük olmalı`);
  });

  it('Buz bölgesi (Seviye 10) yavaşlatılmamış kara düşmanını +%25 hızlandırır; yavaşlamış veya uçanı etkilemez', () => {
    const level10 = LEVELS[9];
    const iz = level10.iceZones![0];
    const sim = new SimulationEngine(level10, { seed: 303 });
    sim.waveCountdown = 999;

    const normalGround = sim.spawnEnemy('scout_bot', 100, 2.0, 5, { x: iz.x, z: iz.z, wpIndex: 3, progress: 0 });
    const slowedGround = sim.spawnEnemy('scout_bot', 100, 2.0, 5, { x: iz.x, z: iz.z, wpIndex: 3, progress: 0 });
    slowedGround.slowPct = 0.4;
    slowedGround.slowTimer = 2.0;
    const flying = sim.spawnEnemy('hover_drone', 100, 2.0, 5, { x: iz.x, z: iz.z, wpIndex: 3, progress: 0 });

    for (let i = 0; i < 10; i++) sim.step(FIXED_DT);

    const expectedBoosted = 2.0 * 1.25 * FIXED_DT * 10;
    const expectedSlowed = 2.0 * 0.6 * FIXED_DT * 10;
    const expectedFlying = 2.0 * FIXED_DT * 10;

    assert.ok(Math.abs(normalGround.progress - expectedBoosted) < 1e-4, `buzlu hız=${normalGround.progress.toFixed(4)}`);
    assert.ok(Math.abs(slowedGround.progress - expectedSlowed) < 1e-4, `yavaş hız=${slowedGround.progress.toFixed(4)}`);
    assert.ok(Math.abs(flying.progress - expectedFlying) < 1e-4, `uçan hız=${flying.progress.toFixed(4)}`);
  });
});

describe('Paket 4 — Hazırlık fazı, erken dalga bonusu ve üst HUD uyumu', () => {
  it('waitForFirstWave=true iken sayaç geçse de 1. dalga başlamaz; CALL_WAVE_EARLY ile başlar', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 401, waitForFirstWave: true });
    assert.equal(sim.waitingForFirstWave, true);
    assert.equal(sim.getEarlyWaveBonus(), 0);

    for (let i = 0; i < 360; i++) sim.step(FIXED_DT);
    assert.equal(sim.currentWaveIndex, -1);
    assert.equal(sim.waveInProgress, false);
    assert.equal(sim.enemies.length, 0);

    const goldBefore = sim.gold;
    sim.dispatch({ type: 'CALL_WAVE_EARLY' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.waitingForFirstWave, false);
    assert.equal(sim.waveInProgress, true);
    assert.equal(sim.currentWaveIndex, 0);
    assert.equal(sim.gold, goldBefore, '1. dalga hazırlığından başlatmada ekstra erken çağrı altını olmamalı');
  });

  it('2+ dalga aralarında erken çağrı bonusu verir ve doğru dalgayı başlatır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 402, waitForFirstWave: true });
    sim.currentWaveIndex = 0;
    sim.waveInProgress = false;
    sim.waitingForFirstWave = false;
    sim.waveCountdown = 6.0;

    const bonus = sim.getEarlyWaveBonus();
    assert.equal(bonus, 15, '6.0s * 2.5 = 15 altın bonusu beklenir');
    const goldBefore = sim.gold;
    sim.dispatch({ type: 'CALL_WAVE_EARLY' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.currentWaveIndex, 1);
    assert.equal(sim.waveInProgress, true);
    assert.equal(sim.gold, goldBefore + 15);
  });
});

describe('Paket 5 — 16 benzersiz bölüm konsepti, 3B sahne kurgusu ve TR/EN yerelleştirme eşliği', () => {
  it('16 bölümün her biri benzersiz konsept, 3B sahne nesnesi ve TR/EN çeviri anahtarlarına sahiptir', () => {
    const concepts = new Set<string>();
    for (const lvl of LEVELS) {
      concepts.add(lvl.concept);
      assert.ok(STAGE_LIGHTING_THEMES[lvl.concept], `Lv${lvl.id} atmosfer teması eksik (${lvl.concept})`);

      const curves = [
        new THREE.CatmullRomCurve3(lvl.path.map((p) => new THREE.Vector3(p.x, 0.035, p.z)), false, 'catmullrom', 0.32),
      ];
      if (lvl.secondaryPath?.length) {
        curves.push(
          new THREE.CatmullRomCurve3(
            lvl.secondaryPath.map((p) => new THREE.Vector3(p.x, 0.035, p.z)),
            false,
            'catmullrom',
            0.32,
          ),
        );
      }
      const built = buildStageConcept(lvl, curves);
      assert.ok(built.group.children.length >= 1, `Lv${lvl.id} 3B konsept grubu boş olmamalı`);

      for (const loc of ['tr', 'en'] as const) {
        const cKey = `level.${lvl.id}.concept`;
        const sKey = `level.${lvl.id}.sub`;
        assert.notEqual(t(loc, cKey), cKey, `${loc} eksik: ${cKey}`);
        assert.notEqual(t(loc, sKey), sKey, `${loc} eksik: ${sKey}`);
      }
    }
    assert.equal(concepts.size, 24, '24 bölümün konsept kimlikleri birbirinden tamamen farklı olmalı');
  });
});

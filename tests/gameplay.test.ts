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

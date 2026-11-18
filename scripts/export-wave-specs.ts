import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { LEVELS } from '../src/data/levels.ts';
import { ENEMIES } from '../src/data/enemies.ts';

const outDir = join(process.cwd(), 'scripts', 'generated');
mkdirSync(outDir, { recursive: true });

for (const level of LEVELS) {
  const spec = {
    start_gold: level.startGold,
    tower: { cost: 50, dps: 24 },
    kill_zone: level.killZoneMeters,
    efficiency: 0.6,
    waves: level.waves.map((w) => ({
      clear_bonus: w.clearBonus,
      groups: w.groups.map((g) => {
        const base = ENEMIES[g.enemyId];
        return {
          hp: g.hpOverride ?? base.baseHp,
          count: g.count,
          speed: g.speedOverride ?? base.speed,
          spacing: g.spacing,
          bounty: g.bountyOverride ?? base.bounty,
          armor: base.armor,
        };
      }),
    })),
  };
  writeFileSync(join(outDir, `level-${level.id}.json`), JSON.stringify(spec, null, 2));
}

console.log(`Exported ${LEVELS.length} level wave specs to ${outDir}`);

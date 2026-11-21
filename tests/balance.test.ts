import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENEMIES } from '../src/data/enemies.ts';
import { LEVELS, type WaveSpec } from '../src/data/levels.ts';
import { TOWERS } from '../src/data/towers.ts';
import { computeSaveChecksum, createInitialSave, migrateSave, SAVE_VERSION, SaveManager } from '../src/services/SaveManager.ts';
import { t } from '../src/i18n/locales.ts';

const waveHpTotal = (w: WaveSpec) =>
  w.groups.reduce((s, g) => s + g.count * (g.hpOverride ?? ENEMIES[g.enemyId].baseHp), 0);
const levelHpTotal = (lvl: (typeof LEVELS)[number]) => lvl.waves.reduce((s, w) => s + waveHpTotal(w), 0);
const levelClearBonus = (lvl: (typeof LEVELS)[number]) => lvl.waves.reduce((s, w) => s + w.clearBonus, 0);

const ORIG_LEVEL_TOTAL_HP = [
  8725, 12789, 18723, 13242, 17489, 24778, 21458, 29679, 38905, 42744, 58434, 74987,
];

describe('Dengе ve kabul kriterleri (DEGISIKLIK-2026-11-18)', () => {
  it('D1: 50 seviyede dalga HP katları 1.09-1.21 bandında, monoton artan, ilk 12 seviyede toplam ±%10 korunmuş', () => {
    assert.equal(LEVELS.length, 50);
    for (const lvl of LEVELS) {
      const totals = lvl.waves.map(waveHpTotal);
      assert.ok(totals.length >= 7, `L${lvl.id} dalga sayisi`);
      for (let i = 1; i < totals.length; i++) {
        assert.ok(totals[i] > totals[i - 1], `L${lvl.id} W${i + 1} monoton degil (${totals[i]} <= ${totals[i - 1]})`);
        const ratio = totals[i] / totals[i - 1];
        assert.ok(
          ratio >= 1.09 && ratio <= 1.21,
          `L${lvl.id} W${i + 1}/W${i} kati ${ratio.toFixed(3)} bandin disinda (1.09-1.21)`,
        );
      }
      if (lvl.id <= 12 && lvl.id !== 4) {
        const drift = Math.abs(levelHpTotal(lvl) / ORIG_LEVEL_TOTAL_HP[lvl.id - 1] - 1);
        assert.ok(drift <= 0.1, `L${lvl.id} toplam HP sapmasi %${(drift * 100).toFixed(1)} > 10`);
      }
      if (lvl.id >= 13) {
        const clrRatio = levelClearBonus(lvl) / levelHpTotal(lvl);
        assert.ok(clrRatio >= 0.014, `L${lvl.id} clearBonus/HP = ${clrRatio.toFixed(4)} < 0.014`);
      }
    }
  });

  it('D2: L4/L3 toplam HP orani 1.05-1.20 bandinda (regresyon kapatildi)', () => {
    const l3 = levelHpTotal(LEVELS[2]);
    const l4 = levelHpTotal(LEVELS[3]);
    const ratio = l4 / l3;
    assert.ok(ratio >= 1.05 && ratio <= 1.20, `L4/L3 = ${ratio.toFixed(3)} (hedef 1.05-1.20)`);
    const canyonEnemies = new Set(['scout_bot', 'turbo_hopper', 'swarm_saw', 'shield_loader', 'hover_drone', 'mega_harvester']);
    for (const w of LEVELS[3].waves) {
      for (const g of w.groups) {
        assert.ok(canyonEnemies.has(g.enemyId), `L4 teması bozuldu: ${g.enemyId}`);
      }
    }
  });

  it('D3: altin/HP erozyonu kapandi — L1 ±%15, L12 >= 0.014 ve >= 1050 altin', () => {
    const l1 = LEVELS[0];
    const l1Ratio = levelClearBonus(l1) / levelHpTotal(l1);
    assert.ok(
      l1Ratio >= 0.0195 * 0.85 && l1Ratio <= 0.0195 * 1.15,
      `L1 clearBonus/HP = ${l1Ratio.toFixed(4)} (±%15 bandi: ${(0.0195 * 0.85).toFixed(4)}-${(0.0195 * 1.15).toFixed(4)})`,
    );
    const l12 = LEVELS[11];
    const l12Clear = levelClearBonus(l12);
    const l12Ratio = l12Clear / levelHpTotal(l12);
    assert.ok(l12Ratio >= 0.014, `L12 clearBonus/HP = ${l12Ratio.toFixed(4)} < 0.014`);
    assert.ok(l12Clear >= 1050, `L12 clearBonus toplami ${l12Clear} < 1050`);
  });

  it('D4: squirrel_sniper efektif DPS 85-100, marjinal verim <= 0.50, ise yaramaz durumda degil', () => {
    const squirrel = TOWERS.squirrel;
    const evo = squirrel.evolutions.find((e) => e.id === 'squirrel_sniper')!;
    const s = evo.stats;
    const effDps = s.damage * s.fireRate * (1 + (s.critChance ?? 0) * ((s.critMultiplier ?? 2) - 1));
    assert.ok(effDps >= 85 && effDps <= 100, `efektif DPS = ${effDps.toFixed(1)} (hedef 85-100)`);
    const tier2Dps = squirrel.tier2.damage * squirrel.tier2.fireRate;
    const marginal = (effDps - tier2Dps) / s.cost;
    assert.ok(marginal <= 0.5, `marjinal verim = ${marginal.toFixed(3)} > 0.50`);
  });

  it('D5: mega_harvester TTK — tek squirrel T1 kule > 35sn, 3 T1 kule <= 35sn', () => {
    const bossGroup = LEVELS[0].waves[6].groups.find((g) => g.enemyId === 'mega_harvester');
    assert.ok(bossGroup, 'L1 W7 boss grubu yok');
    const bossHp = bossGroup!.hpOverride ?? ENEMIES.mega_harvester.baseHp;
    const armor = ENEMIES.mega_harvester.armor;
    const t1 = TOWERS.squirrel.tier1;
    const singleTowerDps = t1.damage * t1.fireRate * (1 - armor);
    const ttkSingle = bossHp / singleTowerDps;
    const ttkThree = bossHp / (3 * singleTowerDps);
    assert.ok(ttkSingle > 35, `tek kule TTK = ${ttkSingle.toFixed(1)}sn <= 35sn`);
    assert.ok(ttkThree <= 35, `3 kule TTK = ${ttkThree.toFixed(1)}sn > 35sn`);
    assert.ok(3 * singleTowerDps >= 37.7, `3 kule toplam efektif DPS = ${(3 * singleTowerDps).toFixed(1)} < 37.7`);
  });
});

describe('SaveManager migration & kurtarma (K3)', () => {
  const NOW = 1_700_000_000_000;

  it('migrateSave v1 -> v2 surumu yazar, alani korur ve dogrular', () => {
    const v1 = { version: 1, oakCoins: 999, emeraldGems: 55, levelStars: { 4: 2 } };
    const { state, migrated } = migrateSave(v1 as never, NOW);
    assert.equal(migrated, true);
    assert.equal(state.version, SAVE_VERSION);
    assert.equal(state.oakCoins, 999);
    assert.equal(state.emeraldGems, 55);
    assert.deepEqual(state.levelStars, { 4: 2 });
    const again = migrateSave(state, NOW);
    assert.equal(again.migrated, false);
    assert.equal(again.state.version, SAVE_VERSION);
  });

  it('bozuk checksum + okunabilir JSON -> sifirlama YOK, veri kurtarilir, saveRecovered uyarisi doner', () => {
    const store = new Map<string, string>();
    const g = globalThis as Record<string, unknown>;
    const had = 'localStorage' in g;
    const prev = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const base = createInitialSave(NOW);
      base.version = 1;
      base.oakCoins = 777;
      base.levelStars = { 3: 3 };
      const { checksum: _c, ...rest } = base;
      store.set('palamut_kalesi_save_v1', JSON.stringify({ ...rest, checksum: 424242 }));

      const mgr = new SaveManager(NOW);
      assert.equal(mgr.get().oakCoins, 777, 'veriler sifirlanmamali (kurtarma)');
      assert.deepEqual(mgr.get().levelStars, { 3: 3 });
      assert.equal(mgr.saveRecovered, true, 'saveRecovered uyarisi donmeli');
      assert.equal(mgr.get().version, SAVE_VERSION);

      const stored = JSON.parse(store.get('palamut_kalesi_save_v1')!) as { version: number; checksum: number };
      assert.equal(stored.version, SAVE_VERSION, 'kurtarma sonrasi depoya v2 yazilmali');
      const { checksum: _c2, ...storedRest } = stored;
      assert.equal(stored.checksum, computeSaveChecksum(storedRest as never), 'depodaki checksum gecerli olmali');
    } finally {
      if (had) g.localStorage = prev;
      else delete g.localStorage;
    }
  });

  it('gecerli v1 kaydi sessizce v2ye migrate edilir ve depoya yazilir', () => {
    const store = new Map<string, string>();
    const g = globalThis as Record<string, unknown>;
    const had = 'localStorage' in g;
    const prev = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const base = createInitialSave(NOW);
      base.version = 1;
      base.emeraldGems = 55;
      store.set('palamut_kalesi_save_v1', JSON.stringify({ ...base, checksum: computeSaveChecksum(base) }));

      const mgr = new SaveManager(NOW);
      assert.equal(mgr.saveRecovered, false);
      assert.equal(mgr.get().emeraldGems, 55);
      assert.equal(mgr.get().version, SAVE_VERSION);
      const stored = JSON.parse(store.get('palamut_kalesi_save_v1')!) as { version: number };
      assert.equal(stored.version, SAVE_VERSION);
    } finally {
      if (had) g.localStorage = prev;
      else delete g.localStorage;
    }
  });

  it('cozumlenemeyen JSON -> temiz baslangic kaydi (kurtarma iddiası yok)', () => {
    const store = new Map<string, string>([['palamut_kalesi_save_v1', '{{{ bu json degil']]);
    const g = globalThis as Record<string, unknown>;
    const had = 'localStorage' in g;
    const prev = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const mgr = new SaveManager(NOW);
      assert.equal(mgr.saveRecovered, false);
      assert.equal(mgr.get().oakCoins, createInitialSave(NOW).oakCoins);
      assert.equal(mgr.get().version, SAVE_VERSION);
    } finally {
      if (had) g.localStorage = prev;
      else delete g.localStorage;
    }
  });
});

describe('i18n parite ve gomulu metin gerilemesi (K4)', () => {
  it('tr/en sozluk anahtarlari esit ve sayilari >= 155', () => {
    const src = readFileSync(new URL('../src/i18n/locales.ts', import.meta.url), 'utf8');
    const trBlock = src.match(/tr: \{([\s\S]*?)\n  \},/)![1];
    const enBlock = src.match(/en: \{([\s\S]*?)\n  \},/)![1];
    const trKeys = [...trBlock.matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]);
    const enKeys = [...enBlock.matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]);
    assert.equal(trKeys.length, enKeys.length, `tr=${trKeys.length} en=${enKeys.length} parite bozuldu`);
    assert.ok(trKeys.length >= 155, `anahtar sayisi ${trKeys.length} < 155`);
    for (const k of trKeys) assert.ok(enKeys.includes(k), `en'de eksik: ${k}`);
    for (const k of enKeys) assert.ok(trKeys.includes(k), `tr'de eksik: ${k}`);
  });

  it('yeni anahtarlar dogru metni veriyor (SAT / Yeniden Dene / yukleme)', () => {
    assert.equal(t('tr', 'hud.sellShort'), 'SAT');
    assert.equal(t('en', 'hud.sellShort'), 'SELL');
    assert.equal(t('tr', 'boot.retry'), 'Yeniden Dene');
    assert.equal(t('en', 'boot.retry'), 'Try Again');
    assert.equal(t('tr', 'loading.models'), '3D Modeller Yükleniyor...');
    assert.equal(t('tr', 'boot.errorTitle'), 'Bir Hata Oluştu');
  });

  it('ui kaynaklarinda gomulu TR metin kalmadi (SAT / 3D Modeller / AÇ (Reklam) / Kalan / Hız)', () => {
    const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    const battleSrc = readFileSync(new URL('../src/ui/BattleView.ts', import.meta.url), 'utf8');
    const metaSrc = readFileSync(new URL('../src/ui/MetaView.ts', import.meta.url), 'utf8');
    assert.ok(!mainSrc.includes('PALAMUT KALESİ'), 'main.ts loading.title gomulu');
    assert.ok(!mainSrc.includes('3D Modeller Yükleniyor'), 'main.ts loading.models gomulu');
    assert.ok(!battleSrc.includes('>SAT<') && !battleSrc.includes('SAT +'), 'BattleView SAT gomulu');
    assert.ok(!battleSrc.includes('HUD Aç') && !battleSrc.includes('HUD Gizle'), 'BattleView HUD metni gomulu');
    assert.ok(!battleSrc.includes('+30 Testere Sürüsü'), 'BattleView promo swarm gomulu');
    assert.ok(!metaSrc.includes('AÇ (Reklam)'), 'MetaView openChest gomulu');
    assert.ok(!metaSrc.includes('/2 Kalan'), 'MetaView chestsRemaining gomulu');
    assert.ok(!metaSrc.includes('· Hız ') && !metaSrc.includes('Zırh %'), 'MetaView bestiary etiketleri gomulu');
    assert.ok(!metaSrc.includes('+10 Epik Kart'), 'MetaView epicChestContents gomulu');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SoundEngine } from '../src/audio/SoundEngine.ts';
import { ONLINE_ARENA_ENABLED } from '../src/config/features.ts';
import { FIXED_DT, SimulationEngine, computeVictoryRewards } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import {
  SYNERGY_COMBO_LIST,
  getActiveSynergyPartnersForTower,
  getTowerSynergies,
} from '../src/data/synergies.ts';
import { TOWER_LIST } from '../src/data/towers.ts';
import { CameraController, CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM } from '../src/rendering/CameraController.ts';
import { AdService, BillingService, RemoteConfigService } from '../src/services/CommercialServices.ts';
import { NetworkService } from '../src/services/NetworkService.ts';
import { SaveManager } from '../src/services/SaveManager.ts';
import { BattleView } from '../src/ui/BattleView.ts';
import { MetaView } from '../src/ui/MetaView.ts';

function makeMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  };
}

describe('Elemental Sinerji Komboları & Mobil Oyun Akışı', () => {
  it('getActiveSynergyPartnersForTower farklı tür eşleşmelerini doğru algılar', () => {
    const withLynx = getActiveSynergyPartnersForTower('beaver', ['lynx']);
    assert.ok(withLynx.includes('shatter'), 'Kakım + Kunduz -> Kırılma sinerjisi açık olmalı');

    const withBadger = getActiveSynergyPartnersForTower('squirrel', ['badger']);
    assert.ok(withBadger.includes('corrode_crit'), 'Rakun + Sincap -> Zırh Parçalama açık olmalı');

    const selfOwl = getActiveSynergyPartnersForTower('owl', ['owl']);
    assert.equal(selfOwl.length, 0, 'Aynı kule kendisiyle kombo rozeti göstermemeli');

    const badgerSyn = getTowerSynergies('badger');
    assert.equal(badgerSyn.length, 2, 'Rakun hem Zırh Parçalama hem Tutuşma üyesi olmalı');
    assert.equal(SYNERGY_COMBO_LIST.length, 4);
  });

  it('Shatter (Buz + Havan) tetiklenir, SYNERGY_COMBO yayar ve bekleme süresine saygı duyar', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 4101, waitForFirstWave: true });
    sim.gold = 1000;
    const slot = sim.slots.get('slot_1')!;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'beaver' }, 'p1', 0);
    sim.step(FIXED_DT);

    const foe = sim.spawnEnemy('shield_loader', 600, 0.001, 10, {
      x: slot.x + 1.8,
      z: slot.z,
      wpIndex: 1,
      progress: 8,
    });
    foe.frostPrimeTimer = 3.0;
    sim.spawnEnemy('scout_bot', 120, 0.001, 5, {
      x: foe.x + 0.6,
      z: foe.z,
      wpIndex: 1,
      progress: 8,
    });

    const combos = [];
    for (let i = 0; i < 60; i++) {
      sim.step(FIXED_DT);
      combos.push(...sim.drainEvents().filter((e) => e.type === 'SYNERGY_COMBO' && e.comboId === 'shatter'));
    }

    assert.equal(combos.length, 1, 'İlk vurusta tek Shatter patlaması tetiklenmeli (bekleme süresi korumalı)');
    assert.ok(combos[0].bonusDamage >= 14);
    assert.ok((foe.synergyCooldowns.shatter ?? 0) > 0);
  });

  it('Corrode Crit (Asit + Keskin Atış) zırhı ek azaltır ve SYNERGY_COMBO yayar', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 4102, waitForFirstWave: true });
    sim.gold = 1000;
    const slot = sim.slots.get('slot_1')!;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);

    const foe = sim.spawnEnemy('shield_loader', 600, 0.001, 10, {
      x: slot.x + 2.0,
      z: slot.z,
      wpIndex: 1,
      progress: 8,
    });
    const origArmor = foe.armor;
    foe.acidPrimeTimer = 3.0;

    let sawCorrode = false;
    for (let i = 0; i < 50; i++) {
      sim.step(FIXED_DT);
      if (sim.drainEvents().some((e) => e.type === 'SYNERGY_COMBO' && e.comboId === 'corrode_crit')) {
        sawCorrode = true;
        break;
      }
    }

    assert.equal(sawCorrode, true, 'Asitli hedefe Sincap vurunca Zırh Parçalama tetiklenmeli');
    assert.ok(foe.armor < origArmor, `Zırh ek olarak azalmalı (${foe.armor} < ${origArmor})`);
  });

  it('Ignite (Reçine + Baykuş/Kor) yanma başlatır ve Superconduct (Buz + Yıldırım) ek hedefe sıçrar', () => {
    const simIgnite = new SimulationEngine(LEVELS[0], { seed: 4103, waitForFirstWave: true });
    simIgnite.gold = 1000;
    const s1 = simIgnite.slots.get('slot_1')!;
    simIgnite.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'owl' }, 'p1', 0);
    simIgnite.step(FIXED_DT);

    const ignFoe = simIgnite.spawnEnemy('shield_loader', 500, 0.001, 10, {
      x: s1.x + 2.0,
      z: s1.z,
      wpIndex: 1,
      progress: 8,
    });
    ignFoe.resinPrimeTimer = 3.0;

    let igniteHit = false;
    for (let i = 0; i < 40; i++) {
      simIgnite.step(FIXED_DT);
      if (simIgnite.drainEvents().some((e) => e.type === 'SYNERGY_COMBO' && e.comboId === 'ignite')) {
        igniteHit = true;
        break;
      }
    }
    assert.equal(igniteHit, true, 'Reçineli hedefe Baykuş vurunca Tutuşma tetiklenmeli');
    assert.ok(ignFoe.burnTimer > 0 && ignFoe.burnDps >= 12, 'Yanma hasarı süresi açılmalı');

    const simSuper = new SimulationEngine(LEVELS[0], { seed: 4104, waitForFirstWave: true });
    simSuper.gold = 1000;
    const ss1 = simSuper.slots.get('slot_1')!;
    simSuper.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'falcon' }, 'p1', 0);
    simSuper.step(FIXED_DT);

    const primary = simSuper.spawnEnemy('scout_bot', 300, 0.001, 5, {
      x: ss1.x + 2.0,
      z: ss1.z,
      wpIndex: 1,
      progress: 10,
    });
    primary.frostPrimeTimer = 3.0;
    const secondary = simSuper.spawnEnemy('scout_bot', 300, 0.001, 5, {
      x: primary.x + 1.4,
      z: primary.z,
      wpIndex: 1,
      progress: 8,
    });

    let superEv: { arcToX?: number; arcToZ?: number } | null = null;
    for (let i = 0; i < 40; i++) {
      simSuper.step(FIXED_DT);
      const hit = simSuper.drainEvents().find((e) => e.type === 'SYNERGY_COMBO' && e.comboId === 'superconduct');
      if (hit && hit.type === 'SYNERGY_COMBO') {
        superEv = hit;
        break;
      }
    }
    assert.ok(superEv !== null, 'Buzlu hedefe Kuzgun vurunca Aşırı İletim tetiklenmeli');
    assert.ok(superEv!.arcToX !== undefined && secondary.hp < 300, 'Yakın ikincil hedefe ark hasarı gitmeli');
  });
});

describe('Mobil Kamera Pinch-Zoom / Pan & Çok Katmanlı Ses', () => {
  it('CameraController zoom ve pan sınırlarını uygular ve resetView(true) ile 1x poza döner', () => {
    const cam = new CameraController(390 / 844);
    const restPos = cam.basePosition.clone();

    assert.equal(cam.isZoomedOrPanned(), false);
    cam.addPanDelta(5, 5);
    cam.update(0.05);
    assert.deepEqual(cam.getPan(), { x: 0, z: 0 }, '1x yakınlaştırmada pan kilitli olmalı');

    cam.setZoom(10);
    for (let i = 0; i < 30; i++) cam.update(0.03);
    assert.ok(Math.abs(cam.getZoom() - CAMERA_MAX_ZOOM) < 0.02);
    assert.equal(cam.isZoomedOrPanned(), true);

    cam.addPanDelta(40, -40);
    for (let i = 0; i < 30; i++) cam.update(0.03);
    const maxAllowedX = (CAMERA_MAX_ZOOM - 1) * 4.4;
    const maxAllowedZ = (CAMERA_MAX_ZOOM - 1) * 5.8;
    assert.ok(cam.getPan().x <= maxAllowedX + 0.01 && cam.getPan().z >= -maxAllowedZ - 0.01);

    cam.setZoom(0.2);
    for (let i = 0; i < 40; i++) cam.update(0.04);
    assert.ok(cam.getZoom() >= CAMERA_MIN_ZOOM - 1e-4);

    cam.resetView(true);
    assert.equal(cam.isZoomedOrPanned(), false);
    assert.ok(cam.camera.position.distanceTo(restPos) < 1e-6);
  });

  it('SoundEngine boss yoğunluğu ve sinerji kombo seslerini hatasız çalıştırır', () => {
    const se = new SoundEngine();
    se.setMusicTheme('forest');
    assert.equal(se.isBossIntensity(), false);
    se.setBossIntensity(true);
    assert.equal(se.isBossIntensity(), true);
    se.playUiTick();
    se.playSynergyCombo('shatter');
    se.playSynergyCombo('corrode_crit');
    se.playSynergyCombo('ignite');
    se.playSynergyCombo('superconduct');
    se.setBossIntensity(false);
    se.setMusicTheme('none');
  });
});

describe('Mobil Menü Detay Çekmecesi & 2×4 Savaş Tepsisi', () => {
  it('MetaView Birlikler Detay Çekmecesi ve Harita Hızlı Kahraman Seçici TR/EN render eder', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
      sm.update((s) => { s.settings.locale = 'tr'; });
      const view = new MetaView(sm, new AdService(sm), new BillingService(sm), new NetworkService(), {
        onStartLevel: () => {},
        onStartExpedition: () => {},
        onRefresh: () => {},
      });
      const container = {
        innerHTML: '',
        querySelectorAll: () => [],
        querySelector: () => null,
      } as unknown as HTMLElement;

      view.activeTab = 'map';
      view.showHeroQuickModal = true;
      view.render(container);
      assert.ok(container.innerHTML.includes('id="btn-map-hero-switch"'));
      assert.ok(container.innerHTML.includes('role="dialog" aria-modal="true"'));
      assert.ok(container.innerHTML.includes('data-quick-select-hero="boz_pence"'));
      assert.ok(container.innerHTML.includes('id="btn-close-hero-quick"'));
      view.showHeroQuickModal = false;

      view.activeTab = 'cards';
      view.detailUnit = { kind: 'tower', id: 'lynx', tierTab: 'evoB' };
      view.render(container);
      assert.ok(container.innerHTML.includes('id="unit-3d-preview"'));
      assert.ok(container.innerHTML.includes('data-preview-tier="t1"'));
      assert.ok(container.innerHTML.includes('data-preview-tier="evoB"'));
      assert.ok(container.innerHTML.includes('>Kapat</button>'));

      sm.update((s) => { s.settings.locale = 'en'; });
      view.render(container);
      assert.ok(container.innerHTML.includes('>Close</button>'));
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });

  it('BattleView reklamsız x1->x2->x3 hız döngüsü ve 2x4 alt kule tepsisi önizlemesi üretir', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
      const sim = new SimulationEngine(LEVELS[0], { seed: 4201, waitForFirstWave: true });
      sim.gold = 400;
      sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_2', towerId: 'beaver' }, 'p1', 0);
      sim.step(FIXED_DT);

      const bv = new BattleView(sm, new AdService(sm), new BillingService(sm), new RemoteConfigService(), {
        onRestart: () => {},
        onExitToMap: () => {},
      });
      bv.resetForLevel(1);
      bv.selectedSlotId = 'slot_1';
      bv.previewTowerId = 'lynx';

      const speedBtn = { textContent: 'x1', onclick: null as null | (() => void) };
      const contextHost = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
      const dummyEl = {
        style: { display: '' },
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        textContent: '',
        innerHTML: '',
        title: '',
        onclick: null,
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      const container = {
        innerHTML: '',
        clientWidth: 390,
        clientHeight: 844,
        querySelectorAll: () => [],
        querySelector: (sel: string) => {
          if (sel === '#bw-speed') return speedBtn;
          if (sel === '#bw-context-layer') return contextHost;
          return dummyEl;
        },
      } as unknown as HTMLElement;

      const fakeSceneMgr = {
        projectToScreen: () => ({ x: 195, y: 400, visible: true }),
        renderer: { domElement: { clientWidth: 390, clientHeight: 844 } },
        cameraCtrl: { isZoomedOrPanned: () => false, resetView: () => {} },
      } as never;

      bv.render(container, sim, fakeSceneMgr);
      assert.equal(TOWER_LIST.length, 8);
      assert.ok(contextHost.innerHTML.includes('mobile-build-dock'));
      assert.ok(contextHost.innerHTML.includes('id="btn-confirm-build"'));
      assert.ok(contextHost.innerHTML.includes('preview-syn-pill'), 'Kunduz varken Kakım önizlemesi sinerji rozeti göstermeli');

      const cardMatches = contextHost.innerHTML.match(/data-build-tower="/g) ?? [];
      assert.equal(cardMatches.length, 8, '8 kule kartı 2x4 tepside render edilmeli');

      assert.equal(bv.speedMultiplier, 1);
      speedBtn.onclick?.();
      assert.equal(bv.speedMultiplier, 2);
      speedBtn.onclick?.();
      assert.equal(bv.speedMultiplier, 3);
      speedBtn.onclick?.();
      assert.equal(bv.speedMultiplier, 1);

      // Camera rest sanity check via THREE import
      assert.ok(new THREE.Vector3().lengthSq() === 0);
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });

  it('v1.0 lansman kapısı: bölge hızlı atlama 33. bölüme zıplar, Arena WS bağlamaz ve L28/L32/L36 boss ödülleri artar', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
      let connectCalls = 0;
      const fakeNetwork = {
        connected: false,
        state: 'idle',
        roomCode: '',
        connect: async () => {
          connectCalls += 1;
          return true;
        },
      } as unknown as NetworkService;

      let refreshCount = 0;
      const jumpBtn = { dataset: { jumpRegion: '33' }, onclick: null as null | (() => void) };
      const multiTabBtn = { dataset: { tab: 'multi' }, onclick: null as null | (() => void) };

      const view = new MetaView(sm, new AdService(sm), new BillingService(sm), fakeNetwork, {
        onStartLevel: () => {},
        onStartExpedition: () => {},
        onRefresh: () => {
          refreshCount += 1;
        },
      });
      const container = {
        innerHTML: '',
        querySelectorAll: (sel: string) => {
          if (sel === '[data-jump-region]') return [jumpBtn];
          if (sel === '[data-tab]') return [multiTabBtn];
          return [];
        },
        querySelector: () => null,
      } as unknown as HTMLElement;

      view.render(container);
      jumpBtn.onclick?.();
      assert.equal(view.selectedLevelId, 33, '10. bölge çipine dokunmak 33. bölüme atlamalı');
      assert.equal(refreshCount, 1);

      multiTabBtn.onclick?.();
      assert.equal(view.activeTab, 'multi');
      assert.equal(ONLINE_ARENA_ENABLED, false);
      assert.equal(connectCalls, 0, 'ONLINE_ARENA_ENABLED false iken Arena sekmesi WS bağlantısı başlatmamalı');

      const r24 = computeVictoryRewards(24, 3, false);
      const r27 = computeVictoryRewards(27, 3, false);
      const r28 = computeVictoryRewards(28, 3, false);
      const r31 = computeVictoryRewards(31, 3, false);
      const r32 = computeVictoryRewards(32, 3, false);
      const r35 = computeVictoryRewards(35, 3, false);
      const r36 = computeVictoryRewards(36, 3, false);
      assert.ok(r36.oak > r24.oak && r36.gems > r24.gems, '36. bölüm ödülü 24. bölümden yüksek olmalı');
      assert.ok(r28.oak - r27.oak >= 40, '28. bölüm boss bonusu almalı');
      assert.ok(r32.oak - r31.oak >= 40, '32. bölüm boss bonusu almalı');
      assert.ok(r36.oak - r35.oak >= 40, '36. bölüm boss bonusu almalı');
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });
});

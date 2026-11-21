import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SoundEngine } from '../src/audio/SoundEngine.ts';
import { MONETIZATION_ENABLED } from '../src/config/features.ts';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import {
  CAMPAIGN_STORY_BEATS,
  getBossDisplayNameKey,
  getStoryBeatForLevel,
} from '../src/data/story.ts';
import { AdService, BillingService, RemoteConfigService } from '../src/services/CommercialServices.ts';
import { NetworkService } from '../src/services/NetworkService.ts';
import { ACHIEVEMENTS } from '../src/services/ProgressionService.ts';
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

describe('v1.0.0 A-Z Lansman Hazırlığı (Hikâye, Yaşam Döngüsü, İade, Yedekleme, Kapılar)', () => {
  it('13 bölge başlangıç hikâyesi, Boss başlıkları (20/24/28/32/36/40/45/50) ve Bölüm 50 Büyük Finali eksiksizdir', () => {
    assert.ok(CAMPAIGN_STORY_BEATS.length >= 23);
    for (const chFirst of [1, 4, 7, 10, 13, 17, 21, 25, 29, 33, 37, 41, 46]) {
      const beat = getStoryBeatForLevel(chFirst);
      assert.ok(beat, `Bölüm ${chFirst} başlangıç hikâyesi eksik`);
    }
    for (const bossLvl of [20, 24, 28, 32, 36, 40, 45, 50]) {
      const key = getBossDisplayNameKey(bossLvl, 'enemy.magma_overlord.name');
      assert.equal(key, `boss.title.${bossLvl}`);
    }
    assert.equal(getBossDisplayNameKey(3, 'enemy.mega_harvester.name'), 'enemy.mega_harvester.name');
  });

  it('MONETIZATION_ENABLED === false iken sahte VIP/reklam düğmeleri gizlenir, ücretsiz akış çalışır', () => {
    assert.equal(MONETIZATION_ENABLED, false);
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
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

      view.activeTab = 'shop';
      view.render(container);
      assert.ok(container.innerHTML.includes('id="shop-free-banner"'));
      assert.ok(container.innerHTML.includes('id="btn-chest-free"'));
      assert.ok(container.innerHTML.includes('id="btn-chest-epic"'));
      assert.ok(container.innerHTML.includes('id="season-pass-panel"'));
      assert.ok(!container.innerHTML.includes('id="btn-vip-monthly"'));
      assert.ok(!container.innerHTML.includes('id="btn-buy-season-gold"'));

      view.activeTab = 'map';
      view.showPatrolModal = true;
      view.render(container);
      assert.ok(container.innerHTML.includes('id="btn-afk-claim"'));
      assert.ok(!container.innerHTML.includes('id="btn-afk-boost"'));
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });

  it('Dalga 1 öncesi kule satışında %100 iade, savaş başlayınca %60 iade uygulanır', () => {
    const sim = new SimulationEngine(LEVELS[0], { seed: 910, waitForFirstWave: true });
    const startGold = sim.gold;
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.gold, startGold - 50);

    // Dalga 1 henüz başlamadan satış -> tam 50 iade
    assert.equal(sim.waitingForFirstWave, true);
    assert.equal(sim.getTowerSellRefund(50), 50);
    sim.dispatch({ type: 'SELL_TOWER', slotId: 'slot_1' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.gold, startGold);

    // Dalga 1 başlayınca satış -> %60 (30 altın) iade
    sim.dispatch({ type: 'CALL_WAVE_EARLY' }, 'p1', 0);
    sim.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
    sim.step(FIXED_DT);
    assert.equal(sim.waitingForFirstWave, false);
    assert.equal(sim.getTowerSellRefund(50), 30);
  });

  it('BattleView hikâye kartı, Pause ses anahtarları, Sonraki Bölüm CTA ve Bölüm 50 Final kutusu üretir', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
      sm.update((d) => { d.settings.locale = 'tr'; });
      const bv = new BattleView(sm, new AdService(sm), new BillingService(sm), new RemoteConfigService(), {
        onRestart: () => {},
        onExitToMap: () => {},
        onNextLevel: () => {},
        onSettingsChanged: () => {},
      });

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
      const modalHost = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const container = {
        innerHTML: '',
        querySelector: (sel: string) => (sel === '#bw-modal-host' ? modalHost : dummyEl),
        querySelectorAll: () => [],
      } as unknown as HTMLElement;
      const fakeScene = {
        projectToScreen: () => ({ x: 100, y: 200, visible: true }),
        cameraCtrl: { isZoomedOrPanned: () => false },
      } as never;

      // 1. Bölüm girişinde hikâye diyaloğu açılır
      bv.resetForLevel(1);
      const sim1 = new SimulationEngine(LEVELS[0], { seed: 101, waitForFirstWave: true });
      bv.render(container, sim1, fakeScene);
      assert.ok(modalHost.innerHTML.includes('id="story-briefing-modal"'));
      assert.ok(modalHost.innerHTML.includes('id="btn-story-continue"'));

      // 2. Duraklatmada Ses / Müzik / Titreşim hızlı anahtarları vardır
      bv.activeStoryBeat = null;
      bv.paused = true;
      bv.render(container, sim1, fakeScene);
      assert.ok(modalHost.innerHTML.includes('id="btn-pause-sound"'));
      assert.ok(modalHost.innerHTML.includes('id="btn-pause-music"'));
      assert.ok(modalHost.innerHTML.includes('id="btn-pause-haptics"'));

      // 3. Bölüm 1 zaferinde Sonraki Bölüm CTA görünür ve mock 2x ödül gizlidir
      bv.paused = false;
      sim1.status = 'won';
      bv.render(container, sim1, fakeScene);
      assert.ok(modalHost.innerHTML.includes('id="btn-next-level"'));
      assert.ok(!modalHost.innerHTML.includes('id="btn-double-reward"'));

      // 4. Bölüm 50 zaferinde Büyük Final kutlaması görünür ve Sonraki Bölüm olmaz
      bv.resetForLevel(50);
      bv.activeStoryBeat = null;
      const sim50 = new SimulationEngine(LEVELS[49], { seed: 5050, waitForFirstWave: false });
      sim50.status = 'won';
      bv.render(container, sim50, fakeScene);
      assert.ok(modalHost.innerHTML.includes('id="campaign-finale-card"'));
      assert.ok(!modalHost.innerHTML.includes('id="btn-next-level"'));
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });

  it('SaveManager exportSaveCode/importSaveCode ve 4 geç-oyun başarımı sağlamdır', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
      sm.update((d) => {
        d.oakCoins = 777;
        d.levelStars[36] = 3;
        d.seenStoryIds.push('story_ch1');
      });
      const code = sm.exportSaveCode();
      assert.ok(code.startsWith('PK1:'));

      // Bozuk kod mevcut kaydı bozmaz
      const bad = sm.importSaveCode('PK1:not_valid_base64!!!');
      assert.equal(bad.ok, false);
      assert.equal(sm.get().oakCoins, 777);

      // Yeni temiz kayıt üzerine yedek geri yükleme çalışır
      const sm2 = new SaveManager();
      sm2.reset();
      assert.equal(sm2.get().levelStars[36], undefined);
      const ok = sm2.importSaveCode(code);
      assert.equal(ok.ok, true);
      assert.equal(sm2.get().oakCoins, 777);
      assert.equal(sm2.get().levelStars[36], 3);
      assert.ok(sm2.get().seenStoryIds.includes('story_ch1'));

      for (const achId of ['ach_stars_60', 'ach_stars_100', 'ach_kills_1000', 'ach_clear_36', 'ach_stars_150', 'ach_clear_50']) {
        assert.ok(ACHIEVEMENTS.some((a) => a.id === achId), `${achId} eksik`);
      }

      const se = new SoundEngine();
      se.suspend();
      se.resume();
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });

  it('PWA sw.js ve capacitor.config.ts mevcut ve dünya haritası artık 1.5MB kullanılmayan görseli barındırmıyor', () => {
    assert.ok(fs.existsSync('public/sw.js'), 'public/sw.js eksik');
    assert.ok(fs.existsSync('capacitor.config.ts'), 'capacitor.config.ts eksik');
    assert.equal(fs.existsSync('public/world-map-bg.png'), false, 'kullanilmayan world-map-bg.png kaldirilmis olmali');
  });

  it('Arayüz çıktısında ham Unicode emoji, kod sızıntısı ve karışık İngilizce metin yer almaz', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const sm = new SaveManager();
      sm.update((d) => {
        d.settings.locale = 'tr';
      });
      const mv = new MetaView(sm, new AdService(sm), new BillingService(sm), new NetworkService(), {
        onStartLevel: () => {},
        onStartExpedition: () => {},
        onRefresh: () => {},
      });
      const container = {
        innerHTML: '',
        querySelectorAll: () => [],
        querySelector: () => null,
      } as unknown as HTMLElement;

      const emojiRe = /[⚔⚡🛡✈💀🏆🎟📍🆘😎😂😭🔒]/u;
      const forbiddenLeaks = [
        'headSocket',
        'SmartBotDirector',
        '(?promo=1)',
        'data-kenney-skin',
        ': ON',
        ': OFF',
        '(Monthly)',
        '(Lifetime)',
        'WebSocket',
        ' · v1.1',
        'anti-rehber',
        'taktik anti-rehberi',
        'runını',
      ];

      for (const tab of ['map', 'multi', 'cards', 'journal', 'shop'] as const) {
        mv.activeTab = tab;
        mv.showSettings = tab === 'map';
        mv.render(container);
        assert.equal(emojiRe.test(container.innerHTML), false, `${tab} sekmesinde ham emoji bulundu`);
        for (const leak of forbiddenLeaks) {
          assert.equal(
            container.innerHTML.includes(leak),
            false,
            `${tab} sekmesinde sızıntı dizesi (${leak}) bulundu`,
          );
        }
      }

      mv.activeTab = 'journal';
      mv.journalSubTab = 'codex';
      mv.showSettings = false;
      mv.render(container);
      assert.equal(container.innerHTML.includes('Hasar '), true, 'TR codex stats yerelleşmiş olmalı');
      assert.equal(container.innerHTML.includes('DMG '), false, 'TR codex içinde DMG sızıntısı olmamalı');

      const bv = new BattleView(sm, new AdService(sm), new BillingService(sm), new RemoteConfigService(), {
        onRestart: () => {},
        onExitToMap: () => {},
        onNextLevel: () => {},
        onSettingsChanged: () => {},
      });
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
      const contextHost = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const modalHost = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const bContainer = {
        innerHTML: '',
        querySelector: (sel: string) =>
          sel === '#bw-modal-host' ? modalHost : sel === '#bw-context-layer' ? contextHost : dummyEl,
        querySelectorAll: () => [],
      } as unknown as HTMLElement;
      const fakeScene = {
        projectToScreen: () => ({ x: 100, y: 200, visible: true }),
        cameraCtrl: { isZoomedOrPanned: () => false },
      } as never;
      const sim = new SimulationEngine(LEVELS[0], { seed: 42 });
      const firstSlotId = Array.from(sim.slots.keys())[0];
      bv.activeStoryBeat = null;
      bv.paused = true;
      bv.selectedSlotId = firstSlotId;
      bv.previewTowerId = 'squirrel';
      bv.render(bContainer, sim, fakeScene);
      const combinedBattleHtml = modalHost.innerHTML + contextHost.innerHTML;
      assert.ok(contextHost.innerHTML.includes('mobile-build-dock'), 'BattleView build dock render edilmeli');
      assert.ok(modalHost.innerHTML.includes('Açık'), 'BattleView pause butonları Türkçe Açık/Kapalı olmalı');
      assert.equal(emojiRe.test(combinedBattleHtml), false, 'BattleView modal/dock içinde ham emoji bulundu');
      assert.equal(combinedBattleHtml.includes(': ON'), false, 'BattleView pause butonunda : ON sızıntısı');
      assert.equal(combinedBattleHtml.includes(': OFF'), false, 'BattleView pause butonunda : OFF sızıntısı');
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });
});

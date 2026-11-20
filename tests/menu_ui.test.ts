import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OAK_PANEL_BG,
  OAK_PANEL_BG_DARK,
  OAK_TEXT,
  OAK_TEXT_MUTED,
  OAK_TITLE_GOLD,
  PARCHMENT_BG,
  PARCHMENT_MUTED,
  PARCHMENT_TEXT,
} from '../src/ui/theme.ts';
import { AdService, BillingService } from '../src/services/CommercialServices.ts';
import { NetworkService } from '../src/services/NetworkService.ts';
import { SaveManager } from '../src/services/SaveManager.ts';
import { MetaView } from '../src/ui/MetaView.ts';

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function makeMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem(k: string) {
      return store.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      store.set(k, v);
    },
    removeItem(k: string) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
  };
}

describe('UI-1 — Ulu Mese Parsomeni menu ve Kenney CC0 + boyama ozel varliklari', () => {
  it('Kenney Adventure UI ve boyama ozel oak UI dosyalari gecerli baslik ve LICENSE.txt icerir', () => {
    const dir = path.resolve('public/ui/kenney');
    assert.ok(fs.existsSync(path.join(dir, 'LICENSE.txt')), 'LICENSE.txt eksik');
    const pngs = [
      'panel_brown.png',
      'panel_brown_corners_a.png',
      'panel_brown_dark.png',
      'panel_brown_dark_corners_a.png',
      'panel_border_brown_detail.png',
      'panel_grid_paper.png',
      'banner_hanging.png',
      'button_brown.png',
      'button_red.png',
      'round_brown.png',
      'round_brown_dark.png',
      'progress_green.png',
    ];
    for (const file of pngs) {
      const buf = fs.readFileSync(path.join(dir, file));
      assert.ok(buf.length > 100, `${file} boyutu gecersiz`);
      assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', `${file} gecerli PNG degil`);
    }

    const oakDir = path.resolve('public/ui/oak');
    const mapBuf = fs.readFileSync(path.join(oakDir, 'world_map_oak.jpg'));
    assert.ok(mapBuf.length > 10_000, 'world_map_oak.jpg boyutu gecersiz');
    assert.equal(mapBuf[0], 0xff, 'world_map_oak.jpg JPEG basligi hatali');
    assert.equal(mapBuf[1], 0xd8, 'world_map_oak.jpg JPEG basligi hatali');

    const oakPngs = [
      'nav_map.png',
      'nav_arena.png',
      'nav_units.png',
      'nav_journal.png',
      'nav_shop.png',
      'icon_rogue_portal.png',
      'icon_atlas_book.png',
      'icon_star_3d.png',
      'icon_gear_wood.png',
      'bot_scout.png',
      'bot_saw.png',
      'bot_shield.png',
      'bot_boss.png',
      'acc_hat_crown.png',
      'acc_hat_goggles.png',
      'acc_aura_emerald_leaf.png',
      'acc_banner_oak_crest.png',
    ];
    for (const file of oakPngs) {
      const buf = fs.readFileSync(path.join(oakDir, file));
      assert.ok(buf.length > 500, `oak/${file} boyutu gecersiz`);
      assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', `oak/${file} gecerli PNG degil`);
    }

    for (const pFile of ['portrait_fox.png', 'portrait_boar.png', 'portrait_wolf.png', 'portrait_badger.png', 'portrait_falcon.png', 'portrait_tortoise.png', 'portrait_lynx.png']) {
      const pBuf = fs.readFileSync(path.resolve('public/ui', pFile));
      assert.ok(pBuf.length > 1000, `ui/${pFile} boyutu gecersiz`);
      assert.equal(pBuf.subarray(12, 16).toString('ascii'), 'IHDR', `ui/${pFile} gecerli PNG degil`);
    }
  });

  it('.bottom-nav 5 sutunlu tek satir olarak tanimlanmis, soguk gri border-image kaldirilmis', () => {
    const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const bottomNavMatch = css.match(/\.bottom-nav\s*\{[^}]*\}/);
    assert.ok(bottomNavMatch, '.bottom-nav kurali bulunamadi');
    assert.ok(bottomNavMatch[0].includes('repeat(5'), '.bottom-nav repeat(5 kullanmiyor');
    assert.ok(!bottomNavMatch[0].includes('repeat(4, 1fr)'), 'eski kirik repeat(4, 1fr) hala mevcut');
    assert.ok(!css.includes('panel_brown_corners_a.png'), 'soguk gri kose border-image hala css icinde');
    assert.ok(css.includes('.brass-corner') && css.includes('.parchment-drawer'), 'altin-pirinc kose & drawer eksik');
  });

  it('parsomen ve koyu mese panellerinde WCAG AA (>= 4.5:1) kontrast saglanir', () => {
    const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    assert.ok(css.includes(PARCHMENT_BG) && css.includes(PARCHMENT_TEXT) && css.includes(OAK_PANEL_BG));

    for (const fg of [PARCHMENT_TEXT, PARCHMENT_MUTED]) {
      const ratio = contrastRatio(fg, PARCHMENT_BG);
      assert.ok(ratio >= 4.5, `parsomen ${fg}/${PARCHMENT_BG} kontrast ${ratio.toFixed(2)}:1 < 4.5:1`);
    }
    for (const bg of [OAK_PANEL_BG, OAK_PANEL_BG_DARK]) {
      for (const fg of [OAK_TEXT, OAK_TEXT_MUTED, OAK_TITLE_GOLD]) {
        const ratio = contrastRatio(fg, bg);
        assert.ok(ratio >= 4.5, `mese ${fg}/${bg} kontrast ${ratio.toFixed(2)}:1 < 4.5:1`);
      }
    }
  });

  it('MetaView tum 5 sekme, 3 Birlikler alt sekmesi ve modallari hatasiz uretir', () => {
    const g = globalThis as Record<string, unknown>;
    const hadStorage = 'localStorage' in g;
    const prevStorage = g.localStorage;
    g.localStorage = makeMockStorage();

    try {
      const saveManager = new SaveManager();
      saveManager.update((s) => {
        s.oakCoins = 500;
        s.emeraldGems = 200;
        s.cardShards.squirrel = 10;
      });
      const adService = new AdService(saveManager);
      const billingService = new BillingService(saveManager);
      const network = new NetworkService();
      const view = new MetaView(saveManager, adService, billingService, network, {
        onStartLevel: () => {},
        onStartExpedition: () => {},
        onRefresh: () => {},
      });

      const container = {
        innerHTML: '',
        querySelectorAll: () => [],
        querySelector: () => null,
      };
      const renderInto = () => view.render(container as unknown as HTMLElement);

      view.activeTab = 'map';
      renderInto();
      for (const attr of [
        'id="btn-start-level"',
        'id="btn-open-patrol"',
        'id="btn-open-expedition"',
        'id="btn-open-bestiary"',
        'id="btn-mode-toggle"',
        'id="btn-map-prev"',
        'id="btn-map-next"',
        'id="btn-drawer-prev"',
        'id="btn-drawer-next"',
        'map-horiz-track',
        'stage-pill-strip',
        'stage-concept-pill',
        'ui/oak/world_map_oak.jpg',
        'ui/oak/nav_map.png',
        'shield-pin-svg',
        'brass-corner',
        'data-tab="map"',
        'data-tab="multi"',
        'data-tab="cards"',
        'data-tab="journal"',
        'data-tab="shop"',
      ]) {
        assert.ok(container.innerHTML.includes(attr), `Harita sekmesinde ${attr} eksik`);
      }
      assert.ok(
        !container.innerHTML.includes('stage-mini-map'),
        'Bölüm çekmecesinde küçük harita önizlemesi kaldırılmış olmalı',
      );

      const pinMatches = [...container.innerHTML.matchAll(/class="stage-pin[^"]*"\s+style="left:\s*([\d.]+)%;\s*top:\s*([\d.]+)%;"/g)];
      assert.equal(pinMatches.length, 36, '36 yatay kalkan pini render edilmeli');
      let prevX = -1;
      for (const m of pinMatches) {
        const xPct = Number(m[1]);
        const yPct = Number(m[2]);
        assert.ok(xPct > prevX, `pin xPct (${xPct}) soldan sağa artmalı (önceki ${prevX})`);
        assert.ok(yPct >= 28 && yPct <= 52, `pin yPct (${yPct}%) engelsiz yatay orta bantta (28-52%) kalmalı`);
        prevX = xPct;
      }

      const jumpChips = [...container.innerHTML.matchAll(/data-jump-region="(\d+)"/g)].map((m) => Number(m[1]));
      assert.deepEqual(jumpChips, [1, 4, 7, 10, 13, 17, 21, 25, 29, 33], '10 bölge hızlı atlama çipi render edilmeli');
      const bannerMatches = [...container.innerHTML.matchAll(/class="biome-region-banner/g)];
      assert.equal(bannerMatches.length, 10, '10 bölge afişi render edilmeli');

      view.showPatrolModal = true;
      renderInto();
      assert.ok(container.innerHTML.includes('id="btn-afk-claim"'), 'Devriye Sandigi modal butonu eksik');
      view.showPatrolModal = false;

      view.showExpeditionModal = true;
      renderInto();
      assert.ok(container.innerHTML.includes('id="rogue-portal-card"'), 'Kayip Orman Seferi modal karti eksik');
      view.showExpeditionModal = false;

      view.activeTab = 'cards';
      for (const sub of ['towers', 'heroes', 'accessories', 'talents'] as const) {
        view.cardsSubTab = sub;
        renderInto();
        assert.ok(
          container.innerHTML.includes(`data-cards-sub="${sub}"`),
          `Birlikler alt sekmesi ${sub} eksik`,
        );
      }
      view.cardsSubTab = 'accessories';
      renderInto();
      assert.ok(container.innerHTML.includes('id="accessories-panel"'), 'Aksesuar menüsü eksik');

      view.activeTab = 'multi';
      renderInto();
      assert.ok(container.innerHTML.includes('id="league-panel"'), 'Arena sekmesi eksik');
      assert.ok(container.innerHTML.includes('id="arena-coming-soon"'), 'Arena Yakinda ekrani render edilmeli');
      assert.ok(container.innerHTML.includes('id="btn-arena-goto-map"'), 'Arena haritaya don butonu olmali');
      assert.ok(container.innerHTML.includes('class="nav-soon-tag"'), 'Alt menude v1.1 rozeti olmali');
      assert.ok(!container.innerHTML.includes('id="input-room"'), 'v1.0 surumunde canli oda girisi gizli olmali');
      const multiBtnMatch = container.innerHTML.match(/<button class="nav-tab[^"]*" data-tab="multi">[\s\S]*?<\/button>/);
      assert.ok(multiBtnMatch, 'Arena alt sekme butonu olmali');
      assert.ok(!multiBtnMatch[0].includes('nav-pip red'), 'v1.0 Arena sekmesinde kirmizi bildirim noktasi olmamali');

      view.activeTab = 'journal';
      for (const jsub of ['quests', 'achievements', 'codex'] as const) {
        view.journalSubTab = jsub;
        renderInto();
        assert.ok(!container.innerHTML.includes('id="journal-turntable"'), 'Eski 360 inceleme kaldırılmış olmalı');
        assert.ok(
          container.innerHTML.includes(`id="journal-${jsub}-panel"`),
          `Gunluk ${jsub} paneli eksik`,
        );
      }

      view.activeTab = 'shop';
      renderInto();
      assert.ok(container.innerHTML.includes('id="season-pass-panel"'), 'Dukkan sekmesi eksik');

      view.showSettings = true;
      saveManager.update((s) => { s.settings.locale = 'tr'; });
      renderInto();
      assert.ok(container.innerHTML.includes('role="dialog" aria-modal="true"'), 'Ayarlar modali dialog role içermeli');
      assert.ok(!container.innerHTML.includes('>OK</button>'), 'Ayarlar kapatma butonu yerelleştirilmiş olmalı');
      assert.ok(container.innerHTML.includes('>Kapat</button>'), 'TR Ayarlar kapatma butonu Kapat olmalı');
      assert.ok(container.innerHTML.includes('v1.0.0'), 'Ayarlar modalinda v1.0.0 surum etiketi olmali');
      assert.ok(container.innerHTML.includes('settings-privacy-box'), 'Ayarlar modalinda yerel kayit/gizlilik bilgisi olmali');
      saveManager.update((s) => { s.settings.locale = 'en'; });
      renderInto();
      assert.ok(container.innerHTML.includes('>Close</button>'), 'EN Ayarlar kapatma butonu Close olmalı');
      assert.ok(container.innerHTML.includes('Privacy & Local Save'), 'EN gizlilik basligi render edilmeli');
      view.showSettings = false;
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });
});

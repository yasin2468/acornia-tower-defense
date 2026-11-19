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

describe('UI-1 — Ulu Mese Parsomeni menu ve Kenney CC0 varliklari', () => {
  it('Kenney Adventure UI PNG dosyalari gecerli baslik ve LICENSE.txt icerir', () => {
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
  });

  it('.bottom-nav 5 sutunlu tek satir olarak tanimlanmis ve eski repeat(4, 1fr) kaldirilmis', () => {
    const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const bottomNavMatch = css.match(/\.bottom-nav\s*\{[^}]*\}/);
    assert.ok(bottomNavMatch, '.bottom-nav kurali bulunamadi');
    assert.ok(bottomNavMatch[0].includes('repeat(5'), '.bottom-nav repeat(5 kullanmiyor');
    assert.ok(!bottomNavMatch[0].includes('repeat(4, 1fr)'), 'eski kirik repeat(4, 1fr) hala mevcut');
    assert.ok(css.includes('/ui/kenney/panel_brown_corners_a.png'), 'parsomen 9-slice cercevesi eksik');
    assert.ok(css.includes('/ui/kenney/panel_border_brown_detail.png'), 'mese 9-slice cercevesi eksik');
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
        'data-tab="map"',
        'data-tab="multi"',
        'data-tab="cards"',
        'data-tab="journal"',
        'data-tab="shop"',
      ]) {
        assert.ok(container.innerHTML.includes(attr), `Harita sekmesinde ${attr} eksik`);
      }

      view.showPatrolModal = true;
      renderInto();
      assert.ok(container.innerHTML.includes('id="btn-afk-claim"'), 'Devriye Sandigi modal butonu eksik');
      view.showPatrolModal = false;

      view.showExpeditionModal = true;
      renderInto();
      assert.ok(container.innerHTML.includes('id="rogue-portal-card"'), 'Kayip Orman Seferi modal karti eksik');
      view.showExpeditionModal = false;

      view.activeTab = 'cards';
      for (const sub of ['towers', 'heroes', 'talents'] as const) {
        view.cardsSubTab = sub;
        renderInto();
        assert.ok(
          container.innerHTML.includes(`data-cards-sub="${sub}"`),
          `Birlikler alt sekmesi ${sub} eksik`,
        );
      }

      view.activeTab = 'multi';
      renderInto();
      assert.ok(container.innerHTML.includes('id="league-panel"'), 'Arena sekmesi eksik');

      view.activeTab = 'journal';
      renderInto();
      assert.ok(container.innerHTML.includes('id="journal-turntable"'), 'Gunluk vitrini eksik');

      view.activeTab = 'shop';
      renderInto();
      assert.ok(container.innerHTML.includes('id="season-pass-panel"'), 'Dukkan sekmesi eksik');
    } finally {
      if (hadStorage) g.localStorage = prevStorage;
      else delete g.localStorage;
    }
  });
});

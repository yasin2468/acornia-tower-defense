import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HP_BAR_BG, HP_BAR_BG_DARK, HP_TEXT_COLOR } from '../src/ui/theme.ts';

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

function cssBlock(css: string, selector: string): string {
  return css.match(new RegExp(`\\.hp-(?:${selector})\\s*\\{[^}]*\\}`))?.[0] ?? '';
}

describe('HP yazisi kontrasti (A1, WCAG AA)', () => {
  it('metin / bar orani WCAG AA esigi 4.5:1 gecer', () => {
    const ratio = contrastRatio(HP_TEXT_COLOR, HP_BAR_BG);
    assert.ok(ratio >= 4.5, `kontrast ${ratio.toFixed(2)}:1 < 4.5:1`);
  });

  it('bar gradyaninin her iki duragi da esigi gecer', () => {
    for (const stop of [HP_BAR_BG, HP_BAR_BG_DARK]) {
      const ratio = contrastRatio(HP_TEXT_COLOR, stop);
      assert.ok(ratio >= 4.5, `${stop} kontrast ${ratio.toFixed(2)}:1 < 4.5:1`);
    }
  });

  it('styles.css ayni literallari kullaniyor', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const textBlock = cssBlock(css, 'text-center');
    const fillBlock = cssBlock(css, 'fill');
    assert.ok(textBlock.length > 0, '.hp-text-center blogu bulunamadi');
    assert.ok(fillBlock.length > 0, '.hp-fill blogu bulunamadi');
    assert.ok(textBlock.includes(`color: ${HP_TEXT_COLOR}`), 'hp-text-center HP_TEXT_COLOR literalini icermiyor');
    assert.ok(fillBlock.includes(HP_BAR_BG), 'hp-fill HP_BAR_BG literalini icermiyor');
    assert.ok(fillBlock.includes(HP_BAR_BG_DARK), 'hp-fill HP_BAR_BG_DARK literalini icermiyor');
  });

  it('eski basarisiz renkler kaldirilmis', () => {
    const fillBlock = cssBlock(
      readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'),
      'fill',
    );
    assert.ok(!fillBlock.includes('#6ef07c'), 'eski acik yesil #6ef07c hala .hp-fill icinde');
    assert.ok(!fillBlock.includes('#37b74a'), 'eski yesil #37b74a hala .hp-fill icinde');
  });
});

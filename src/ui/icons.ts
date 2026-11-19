import type { HeroId } from '../data/enemies.ts';
import type { TowerId } from '../data/towers.ts';

function resolvePublicUrl(relPath: string): string {
  return `./${relPath}`;
}

export const PORTRAIT_URLS: Record<TowerId | HeroId, string> = {
  squirrel: resolvePublicUrl('ui/portrait_squirrel.png'),
  beaver: resolvePublicUrl('ui/portrait_beaver.png'),
  owl: resolvePublicUrl('ui/portrait_owl.png'),
  hedgehog: resolvePublicUrl('ui/portrait_hedgehog.png'),
  boz_pence: resolvePublicUrl('ui/portrait_bear.png'),
  kizil_kuyruk: resolvePublicUrl('ui/portrait_fox.png'),
  kaya_dis: resolvePublicUrl('ui/portrait_boar.png'),
};

export const UI_ICON_URLS = {
  castleShield: resolvePublicUrl('ui/icon_castle_shield.png'),
  acornCoins: resolvePublicUrl('ui/icon_acorn_coins.png'),
  gems: resolvePublicUrl('ui/icon_gems.png'),
  skillRain: resolvePublicUrl('ui/icon_skill_rain.png'),
  skillMagnet: resolvePublicUrl('ui/icon_skill_magnet.png'),
  chestFree: resolvePublicUrl('ui/icon_chest_free.png'),
  chestEpic: resolvePublicUrl('ui/icon_chest_epic.png'),
};

export const ICONS = {
  waveSword: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 4l-9 9m0 0l-2-2m2 2l-4 4-2-2 4-4m7-7l2-2 2 2-2 2" stroke="#ffd24c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 4l9 9" stroke="#d5e2f0" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.5l2.8 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17l-5.7 3.2 1.1-6.4-4.7-4.5 6.5-.9L12 2.5z" fill="#ffd24c" stroke="#8a5a06" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="6" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="18"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5.2c0-1 1.1-1.6 2-1.1l11 6.8c.8.5.8 1.7 0 2.2l-11 6.8c-.9.5-2-.1-2-1.1V5.2z"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  cards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="12" height="16" rx="2"/><path d="M16 7h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`,
  hand: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M11 13V6a2 2 0 0 1 4 0v6h1.5a1.8 1.8 0 0 1 1.8 1.8v.6h1.1a1.8 1.8 0 0 1 1.8 1.8v1h.7a1.7 1.7 0 0 1 1.7 1.7v2.3A5.8 5.8 0 0 1 17.8 27h-5.3a4.6 4.6 0 0 1-3.9-2.2L5.3 19.6a1.7 1.7 0 0 1 2.7-2L11 20v-7z" fill="#ffd95e" stroke="#422a06" stroke-width="1.8"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6,11 12,5 18,11"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  bastion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10V5h3v2h2.5V5h3v2H16V5h3v5l-1.5 2V20h-11v-8L5 10z"/><path d="M10.5 20v-4a1.5 1.5 0 0 1 3 0v4"/></svg>`,
  swords: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/></svg>`,
  skullCrown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l3 2 4-5 4 5 3-2-1 6H6L5 8z"/><path d="M7 14v3a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3v-3"/><circle cx="10" cy="16.5" r="0.8" fill="currentColor"/><circle cx="14" cy="16.5" r="0.8" fill="currentColor"/></svg>`,
  bestiary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.6-2.9 8.1-7 9.5-4.1-1.4-7-4.9-7-9.5V6l7-3z"/><circle cx="12" cy="11.5" r="2.5"/><path d="M9.5 15.5c.8-.7 1.6-1 2.5-1s1.7.3 2.5 1"/></svg>`,
};

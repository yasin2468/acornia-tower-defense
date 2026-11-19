import type { EnemyId, HeroId } from '../data/enemies.ts';
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

export const KENNEY_UI_URLS = {
  panelOak: resolvePublicUrl('ui/kenney/panel_brown.png'),
  panelOakCorners: resolvePublicUrl('ui/kenney/panel_brown_corners_a.png'),
  panelDarkOak: resolvePublicUrl('ui/kenney/panel_brown_dark.png'),
  panelDarkCorners: resolvePublicUrl('ui/kenney/panel_brown_dark_corners_a.png'),
  panelBorderDetail: resolvePublicUrl('ui/kenney/panel_border_brown_detail.png'),
  parchment: resolvePublicUrl('ui/kenney/panel_grid_paper.png'),
  bannerHanging: resolvePublicUrl('ui/kenney/banner_hanging.png'),
  btnBrown: resolvePublicUrl('ui/kenney/button_brown.png'),
  btnRed: resolvePublicUrl('ui/kenney/button_red.png'),
  roundBrown: resolvePublicUrl('ui/kenney/round_brown.png'),
  roundBrownDark: resolvePublicUrl('ui/kenney/round_brown_dark.png'),
  progressGreen: resolvePublicUrl('ui/kenney/progress_green.png'),
};

export const OAK_UI_URLS = {
  worldMap: resolvePublicUrl('ui/oak/world_map_oak.jpg'),
  navMap: resolvePublicUrl('ui/oak/nav_map.png'),
  navArena: resolvePublicUrl('ui/oak/nav_arena.png'),
  navUnits: resolvePublicUrl('ui/oak/nav_units.png'),
  navJournal: resolvePublicUrl('ui/oak/nav_journal.png'),
  navShop: resolvePublicUrl('ui/oak/nav_shop.png'),
  roguePortal: resolvePublicUrl('ui/oak/icon_rogue_portal.png'),
  atlasBook: resolvePublicUrl('ui/oak/icon_atlas_book.png'),
  star3d: resolvePublicUrl('ui/oak/icon_star_3d.png'),
  gearWood: resolvePublicUrl('ui/oak/icon_gear_wood.png'),
  botScout: resolvePublicUrl('ui/oak/bot_scout.png'),
  botSaw: resolvePublicUrl('ui/oak/bot_saw.png'),
  botShield: resolvePublicUrl('ui/oak/bot_shield.png'),
  botBoss: resolvePublicUrl('ui/oak/bot_boss.png'),
};

export function getEnemyBadgeUrl(enemyId: EnemyId, isBoss?: boolean): string {
  if (isBoss || enemyId === 'mega_harvester' || enemyId === 'cryo_colossus') return OAK_UI_URLS.botBoss;
  if (enemyId === 'shield_loader' || enemyId === 'crystal_golem') return OAK_UI_URLS.botShield;
  if (enemyId === 'swarm_saw' || enemyId === 'chomp_brute' || enemyId === 'turbo_hopper') {
    return OAK_UI_URLS.botSaw;
  }
  return OAK_UI_URLS.botScout;
}

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
  navMap: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M3 7l6.5-3 9 3L25 4v17l-6.5 3-9-3L3 24V7z" fill="#f3dcb2" stroke="#4d2b11" stroke-width="2" stroke-linejoin="round"/>
    <path d="M9.5 4v17M18.5 7v17" stroke="#b98b56" stroke-width="1.5"/>
    <path d="M6.5 15c2.2-2.2 4.2-1.8 6.5 0s4.3 2 7-1" stroke="#c86b24" stroke-width="1.8" stroke-dasharray="2.4 2" stroke-linecap="round"/>
    <circle cx="18.5" cy="9.5" r="3.4" fill="#df3d2f" stroke="#4d140f" stroke-width="1.5"/>
    <circle cx="18.5" cy="9.5" r="1.2" fill="#ffe794"/>
  </svg>`,
  navArena: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M5 20l3 3 3.5-3.5-3-3L5 20z" fill="#b96d28" stroke="#422108" stroke-width="1.6"/>
    <path d="M9.5 15.5L21 4h3v3L12.5 18.5" fill="#d9e7f3" stroke="#2d3b49" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M23 20l-3 3-3.5-3.5 3-3L23 20z" fill="#b96d28" stroke="#422108" stroke-width="1.6"/>
    <path d="M18.5 15.5L7 4H4v3l11.5 11.5" fill="#eef6fc" stroke="#2d3b49" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="14" cy="14" r="2.2" fill="#ffd24c" stroke="#5e3a06" stroke-width="1.3"/>
  </svg>`,
  navUnits: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M7 13a7 7 0 0 1 14 0v9l-4.5-2v-5h-5v5L7 22v-9z" fill="#c7d5e2" stroke="#293645" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 3l2.2 3.2-2.2 1.8-2.2-1.8L14 3z" fill="#5bd468" stroke="#1e5c26" stroke-width="1.4"/>
    <path d="M9.5 12.5h9" stroke="#ffd24c" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  navJournal: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M7 5h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="#edd29b" stroke="#4e2d12" stroke-width="2"/>
    <path d="M18 5v18" stroke="#9e6d3b" stroke-width="1.8"/>
    <path d="M9 10h6M9 14h6M9 18h4" stroke="#6c421d" stroke-width="2" stroke-linecap="round"/>
    <circle cx="20.5" cy="18" r="3" fill="#e85838" stroke="#54180b" stroke-width="1.4"/>
  </svg>`,
  navShop: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M10 6h8l-1.5 3.5h-5L10 6z" fill="#b36d31" stroke="#48250b" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M11.5 9.5C7 11.5 5.5 16.5 6.5 21c.8 2.4 3.5 3.2 7.5 3.2s6.7-.8 7.5-3.2c1-4.5-.5-9.5-5-11.5h-5z" fill="#c9803f" stroke="#48250b" stroke-width="2"/>
    <circle cx="14" cy="17.5" r="3.2" fill="#ffd24c" stroke="#754905" stroke-width="1.5"/>
    <path d="M11 9.5h6" stroke="#ffd24c" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  roguePortal: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="11" fill="#3a1968" stroke="#ffd86b" stroke-width="1.8"/>
    <path d="M14 5a9 9 0 0 1 8.5 11.8A7 7 0 0 0 10 9.5" stroke="#c07eff" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M14 23a9 9 0 0 1-8.5-11.8A7 7 0 0 0 18 18.5" stroke="#78e8ff" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="14" cy="14" r="3.4" fill="#ffe6ff"/>
  </svg>`,
  atlasBook: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="6" y="4" width="16" height="20" rx="2.5" fill="#7c4724" stroke="#331807" stroke-width="2"/>
    <path d="M9 4v20" stroke="#4b260f" stroke-width="2"/>
    <path d="M15.5 9.5l4.2 1.8v3.3c0 2.7-1.7 4.7-4.2 5.6-2.5-.9-4.2-2.9-4.2-5.6v-3.3l4.2-1.8z" fill="#e9eef3" stroke="#d19a2e" stroke-width="1.6"/>
    <path d="M15.5 11.8v6" stroke="#366ea8" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
};

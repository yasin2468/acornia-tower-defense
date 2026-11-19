import * as THREE from 'three';
import type { LevelSpec, StageConceptId } from '../data/levels.ts';

type Biome = LevelSpec['biome'];
export type TextureKey = StageConceptId | Biome;

interface MeadowPalette {
  gradInner: string;
  gradMid: string;
  gradOuter: string;
  patchA: string;
  patchB: string;
  patchC: string;
  fleckLight: string;
  fleckDark: string;
  stripes?: string;
}

interface RoadPalette {
  mortar: string;
  stones: string[];
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEADOW_PALETTES: Record<TextureKey, MeadowPalette> = {
  forest: {
    gradInner: '#62727e',
    gradMid: '#526272',
    gradOuter: '#3d4a58',
    patchA: 'rgba(92, 134, 98, 0.28)',
    patchB: 'rgba(154, 172, 186, 0.22)',
    patchC: 'rgba(54, 68, 84, 0.25)',
    fleckLight: 'rgba(136, 176, 122, 0.24)',
    fleckDark: 'rgba(46, 62, 74, 0.22)',
  },
  canyon: {
    gradInner: '#8a6049',
    gradMid: '#704b38',
    gradOuter: '#523426',
    patchA: 'rgba(208, 132, 74, 0.26)',
    patchB: 'rgba(222, 178, 122, 0.22)',
    patchC: 'rgba(74, 42, 30, 0.28)',
    fleckLight: 'rgba(232, 178, 96, 0.24)',
    fleckDark: 'rgba(66, 36, 24, 0.24)',
  },
  cavern: {
    gradInner: '#474c6b',
    gradMid: '#373b56',
    gradOuter: '#25283d',
    patchA: 'rgba(76, 206, 224, 0.20)',
    patchB: 'rgba(138, 114, 214, 0.22)',
    patchC: 'rgba(26, 29, 48, 0.30)',
    fleckLight: 'rgba(116, 224, 245, 0.22)',
    fleckDark: 'rgba(24, 27, 45, 0.28)',
  },
  snow: {
    gradInner: '#c8d9ea',
    gradMid: '#adc2d8',
    gradOuter: '#849cb6',
    patchA: 'rgba(244, 250, 255, 0.34)',
    patchB: 'rgba(148, 182, 214, 0.24)',
    patchC: 'rgba(98, 122, 148, 0.24)',
    fleckLight: 'rgba(255, 255, 255, 0.35)',
    fleckDark: 'rgba(92, 118, 146, 0.20)',
  },
  foundry: {
    gradInner: '#54352f',
    gradMid: '#3d2522',
    gradOuter: '#261716',
    patchA: 'rgba(255, 116, 44, 0.24)',
    patchB: 'rgba(176, 86, 48, 0.22)',
    patchC: 'rgba(28, 16, 18, 0.32)',
    fleckLight: 'rgba(255, 168, 72, 0.28)',
    fleckDark: 'rgba(24, 14, 16, 0.28)',
  },
  // 1. Lush mossy emerald glade
  mossy_stream: {
    gradInner: '#4f7a58',
    gradMid: '#3d6346',
    gradOuter: '#294530',
    patchA: 'rgba(128, 204, 118, 0.30)',
    patchB: 'rgba(84, 158, 140, 0.24)',
    patchC: 'rgba(32, 56, 38, 0.28)',
    fleckLight: 'rgba(168, 224, 128, 0.28)',
    fleckDark: 'rgba(28, 52, 34, 0.26)',
  },
  // 2. Golden autumn-oak grove meadow
  acorn_island_shrine: {
    gradInner: '#6b7752',
    gradMid: '#566141',
    gradOuter: '#3c452d',
    patchA: 'rgba(196, 180, 92, 0.28)',
    patchB: 'rgba(104, 162, 98, 0.26)',
    patchC: 'rgba(54, 58, 34, 0.26)',
    fleckLight: 'rgba(232, 208, 112, 0.28)',
    fleckDark: 'rgba(42, 48, 26, 0.25)',
  },
  // 3. Courtyard mossed flagstone & woodland turf
  oak_bastion_moat: {
    gradInner: '#5f6b6e',
    gradMid: '#4c575c',
    gradOuter: '#343c42',
    patchA: 'rgba(116, 148, 112, 0.24)',
    patchB: 'rgba(166, 178, 184, 0.22)',
    patchC: 'rgba(44, 50, 56, 0.28)',
    fleckLight: 'rgba(192, 204, 188, 0.22)',
    fleckDark: 'rgba(36, 44, 48, 0.24)',
  },
  // 4. Red mesa clay & scorched canyon dirt
  crimson_powder_gorge: {
    gradInner: '#9e5c42',
    gradMid: '#804530',
    gradOuter: '#592c1d',
    patchA: 'rgba(224, 116, 68, 0.28)',
    patchB: 'rgba(234, 178, 118, 0.22)',
    patchC: 'rgba(84, 34, 22, 0.28)',
    fleckLight: 'rgba(246, 182, 114, 0.24)',
    fleckDark: 'rgba(72, 28, 18, 0.25)',
  },
  // 5. Golden oasis sand ripples
  desert_windmill_oasis: {
    gradInner: '#c89b62',
    gradMid: '#aa7e49',
    gradOuter: '#7d562d',
    patchA: 'rgba(245, 212, 144, 0.30)',
    patchB: 'rgba(182, 134, 72, 0.25)',
    patchC: 'rgba(98, 64, 34, 0.22)',
    fleckLight: 'rgba(255, 232, 175, 0.28)',
    fleckDark: 'rgba(104, 68, 32, 0.22)',
    stripes: 'rgba(248, 220, 160, 0.14)',
  },
  // 6. Dark volcanic basalt canyon shelf
  twin_bridge_chasm: {
    gradInner: '#6b534b',
    gradMid: '#523e38',
    gradOuter: '#362724',
    patchA: 'rgba(232, 126, 56, 0.22)',
    patchB: 'rgba(138, 114, 108, 0.24)',
    patchC: 'rgba(38, 24, 22, 0.34)',
    fleckLight: 'rgba(245, 166, 98, 0.24)',
    fleckDark: 'rgba(28, 18, 18, 0.28)',
  },
  // 7. Bioluminescent teal & cyan cave slate
  biolum_quartz_stream: {
    gradInner: '#36566b',
    gradMid: '#284254',
    gradOuter: '#192b38',
    patchA: 'rgba(64, 238, 224, 0.22)',
    patchB: 'rgba(86, 174, 232, 0.22)',
    patchC: 'rgba(18, 32, 44, 0.30)',
    fleckLight: 'rgba(128, 250, 242, 0.26)',
    fleckDark: 'rgba(14, 26, 36, 0.28)',
  },
  // 8. Rust-streaked quarry slate & dust
  abandoned_drill_mine: {
    gradInner: '#56525c',
    gradMid: '#433e47',
    gradOuter: '#2d2930',
    patchA: 'rgba(186, 128, 86, 0.24)',
    patchB: 'rgba(122, 134, 152, 0.24)',
    patchC: 'rgba(34, 28, 36, 0.30)',
    fleckLight: 'rgba(218, 166, 112, 0.24)',
    fleckDark: 'rgba(28, 24, 30, 0.28)',
  },
  // 9. Deep amethyst arcane obsidian
  amethyst_ley_sanctum: {
    gradInner: '#4c386e',
    gradMid: '#382754',
    gradOuter: '#231738',
    patchA: 'rgba(208, 118, 255, 0.22)',
    patchB: 'rgba(126, 108, 242, 0.24)',
    patchC: 'rgba(24, 14, 42, 0.32)',
    fleckLight: 'rgba(232, 164, 255, 0.26)',
    fleckDark: 'rgba(22, 12, 38, 0.28)',
  },
  // 10. Crisp glacier snow & sapphire frost
  frozen_mirror_lake: {
    gradInner: '#cfe4f5',
    gradMid: '#b2d0ea',
    gradOuter: '#84abc9',
    patchA: 'rgba(248, 252, 255, 0.38)',
    patchB: 'rgba(104, 198, 242, 0.24)',
    patchC: 'rgba(92, 132, 166, 0.22)',
    fleckLight: 'rgba(255, 255, 255, 0.38)',
    fleckDark: 'rgba(84, 124, 156, 0.20)',
  },
  // 11. Slate-blue storm peak
  blizzard_watchtower: {
    gradInner: '#9cb2c9',
    gradMid: '#8098b2',
    gradOuter: '#5d7591',
    patchA: 'rgba(232, 242, 255, 0.30)',
    patchB: 'rgba(128, 156, 192, 0.24)',
    patchC: 'rgba(66, 84, 108, 0.26)',
    fleckLight: 'rgba(245, 250, 255, 0.32)',
    fleckDark: 'rgba(62, 80, 102, 0.22)',
  },
  // 12. Aurora-tinted glacial marble
  aurora_citadel_siege: {
    gradInner: '#9ec9cc',
    gradMid: '#7eaeb8',
    gradOuter: '#548292',
    patchA: 'rgba(128, 245, 206, 0.24)',
    patchB: 'rgba(182, 156, 255, 0.20)',
    patchC: 'rgba(54, 92, 108, 0.25)',
    fleckLight: 'rgba(196, 255, 242, 0.32)',
    fleckDark: 'rgba(48, 78, 94, 0.22)',
  },
  // 13. Scorched ash & ember slag
  cinder_slag_canal: {
    gradInner: '#4e3936',
    gradMid: '#3a2826',
    gradOuter: '#241716',
    patchA: 'rgba(255, 118, 42, 0.24)',
    patchB: 'rgba(156, 112, 98, 0.22)',
    patchC: 'rgba(24, 16, 16, 0.34)',
    fleckLight: 'rgba(255, 166, 84, 0.28)',
    fleckDark: 'rgba(20, 12, 12, 0.28)',
  },
  // 14. Burnished bronze & oiled iron foundry deck
  clockwork_gear_bridge: {
    gradInner: '#5e4b3c',
    gradMid: '#47372b',
    gradOuter: '#2e221a',
    patchA: 'rgba(222, 164, 78, 0.24)',
    patchB: 'rgba(136, 126, 118, 0.22)',
    patchC: 'rgba(34, 24, 18, 0.30)',
    fleckLight: 'rgba(248, 202, 112, 0.26)',
    fleckDark: 'rgba(28, 20, 14, 0.26)',
    stripes: 'rgba(255, 198, 108, 0.10)',
  },
  // 15. Obsidian basalt & glowing crucible floor
  magma_crucible_arena: {
    gradInner: '#4a2926',
    gradMid: '#361c1b',
    gradOuter: '#211010',
    patchA: 'rgba(255, 86, 28, 0.26)',
    patchB: 'rgba(255, 164, 58, 0.20)',
    patchC: 'rgba(22, 10, 12, 0.34)',
    fleckLight: 'rgba(255, 138, 62, 0.30)',
    fleckDark: 'rgba(18, 8, 10, 0.28)',
  },
  // 16. Forged charcoal steel & golden imperial forge
  iron_core_citadel: {
    gradInner: '#3e3038',
    gradMid: '#2c2028',
    gradOuter: '#1a1218',
    patchA: 'rgba(255, 192, 68, 0.22)',
    patchB: 'rgba(92, 186, 255, 0.20)',
    patchC: 'rgba(18, 12, 18, 0.36)',
    fleckLight: 'rgba(255, 224, 114, 0.26)',
    fleckDark: 'rgba(14, 10, 14, 0.30)',
  },
  // 17. Shadowfen Lantern Bog
  shadowfen_lantern_bog: {
    gradInner: '#3a5948',
    gradMid: '#2a4236',
    gradOuter: '#1b2c24',
    patchA: 'rgba(96, 232, 152, 0.22)',
    patchB: 'rgba(66, 168, 134, 0.20)',
    patchC: 'rgba(20, 36, 28, 0.32)',
    fleckLight: 'rgba(176, 255, 156, 0.24)',
    fleckDark: 'rgba(16, 28, 22, 0.28)',
  },
  // 18. Sunken Totem Ruins
  sunken_totem_ruins: {
    gradInner: '#8a6443',
    gradMid: '#6b4c32',
    gradOuter: '#4a3320',
    patchA: 'rgba(242, 190, 92, 0.26)',
    patchB: 'rgba(178, 122, 64, 0.24)',
    patchC: 'rgba(54, 34, 20, 0.30)',
    fleckLight: 'rgba(255, 220, 128, 0.26)',
    fleckDark: 'rgba(42, 26, 14, 0.26)',
  },
  // 19. Venom Alchemist Marsh
  venom_alchemist_marsh: {
    gradInner: '#333b59',
    gradMid: '#252b42',
    gradOuter: '#171b2b',
    patchA: 'rgba(94, 255, 148, 0.22)',
    patchB: 'rgba(154, 102, 232, 0.22)',
    patchC: 'rgba(18, 22, 36, 0.34)',
    fleckLight: 'rgba(130, 255, 186, 0.24)',
    fleckDark: 'rgba(16, 18, 30, 0.28)',
  },
  // 20. Eclipse Oak Bastion
  eclipse_oak_bastion: {
    gradInner: '#473145',
    gradMid: '#342333',
    gradOuter: '#211521',
    patchA: 'rgba(240, 108, 72, 0.24)',
    patchB: 'rgba(156, 86, 142, 0.22)',
    patchC: 'rgba(26, 16, 26, 0.34)',
    fleckLight: 'rgba(255, 168, 120, 0.25)',
    fleckDark: 'rgba(22, 14, 22, 0.30)',
  },
  // 21. Starfall Glacier Bridge
  starfall_glacier_bridge: {
    gradInner: '#98bce3',
    gradMid: '#769cc4',
    gradOuter: '#53769c',
    patchA: 'rgba(224, 244, 255, 0.34)',
    patchB: 'rgba(110, 186, 255, 0.24)',
    patchC: 'rgba(64, 96, 134, 0.28)',
    fleckLight: 'rgba(240, 250, 255, 0.34)',
    fleckDark: 'rgba(54, 82, 118, 0.22)',
  },
  // 22. Chrono Prism Vault
  chrono_prism_vault: {
    gradInner: '#363466',
    gradMid: '#27254d',
    gradOuter: '#191836',
    patchA: 'rgba(122, 224, 255, 0.22)',
    patchB: 'rgba(208, 140, 255, 0.22)',
    patchC: 'rgba(20, 18, 42, 0.34)',
    fleckLight: 'rgba(184, 240, 255, 0.26)',
    fleckDark: 'rgba(16, 16, 36, 0.28)',
  },
  // 23. Solar Plasma Reactor
  solar_plasma_reactor: {
    gradInner: '#5e3428',
    gradMid: '#45241c',
    gradOuter: '#2b1612',
    patchA: 'rgba(255, 162, 54, 0.28)',
    patchB: 'rgba(255, 102, 42, 0.24)',
    patchC: 'rgba(32, 16, 14, 0.34)',
    fleckLight: 'rgba(255, 212, 110, 0.28)',
    fleckDark: 'rgba(24, 12, 10, 0.28)',
  },
  // 24. Astral Nexus Throne
  astral_nexus_throne: {
    gradInner: '#2e2b59',
    gradMid: '#201e42',
    gradOuter: '#14122b',
    patchA: 'rgba(94, 224, 255, 0.24)',
    patchB: 'rgba(162, 132, 255, 0.24)',
    patchC: 'rgba(16, 14, 34, 0.36)',
    fleckLight: 'rgba(182, 244, 255, 0.28)',
    fleckDark: 'rgba(12, 12, 28, 0.30)',
  },
};

const ROAD_PALETTES: Record<TextureKey, RoadPalette> = {
  forest: { mortar: '#9a805c', stones: ['#d4c2a3', '#cbb896', '#dccbb0', '#c4b08e'] },
  canyon: { mortar: '#9b6d46', stones: ['#e4c49a', '#d7b284', '#edd0a8', '#cca372'] },
  cavern: { mortar: '#59637d', stones: ['#b5c1d6', '#a4b2c9', '#c4cfe2', '#97a6be'] },
  snow: { mortar: '#889bb2', stones: ['#e2ecf6', '#d6e3f0', '#eef5fc', '#cad9e8'] },
  foundry: { mortar: '#57281e', stones: ['#9e7d73', '#8c6b61', '#ad8b7e', '#7c5d54'] },
  mossy_stream: { mortar: '#7b7857', stones: ['#d2c6a2', '#c4ba94', '#dcd2b0', '#b8b08a'] },
  acorn_island_shrine: { mortar: '#8d6c45', stones: ['#dfcaa0', '#d2b98c', '#ead6ae', '#c6aa7a'] },
  oak_bastion_moat: { mortar: '#66717a', stones: ['#c8ced4', '#b8c0c7', '#d8dee4', '#abb4bd'] },
  crimson_powder_gorge: { mortar: '#8e5134', stones: ['#e2b28b', '#d49d74', '#ecc29f', '#c88c62'] },
  desert_windmill_oasis: { mortar: '#a47e4e', stones: ['#f0d6a4', '#e3c48c', '#f6e0b6', '#d6b47a'] },
  twin_bridge_chasm: { mortar: '#5c4138', stones: ['#bfa69a', '#ad9286', '#ccb5aa', '#9b8175'] },
  biolum_quartz_stream: { mortar: '#3b6472', stones: ['#a4d0db', '#90becb', '#b8e0ea', '#7faebd'] },
  abandoned_drill_mine: { mortar: '#5d534f', stones: ['#b6ada8', '#a49b96', '#c6beb8', '#928884'] },
  amethyst_ley_sanctum: { mortar: '#5c4678', stones: ['#c6b4de', '#b59fd0', '#d6c6ea', '#a48cc2'] },
  frozen_mirror_lake: { mortar: '#759db8', stones: ['#e4f4ff', '#d4eaf8', '#f0f8ff', '#c2def0'] },
  blizzard_watchtower: { mortar: '#6c7e94', stones: ['#d2dfec', '#c2d1e0', '#e0eaf5', '#b4c5d6'] },
  aurora_citadel_siege: { mortar: '#548088', stones: ['#cce6e4', '#b8d8d6', '#dcf2f0', '#a6cac8'] },
  cinder_slag_canal: { mortar: '#592e24', stones: ['#a6847a', '#947268', '#b8968c', '#826056'] },
  clockwork_gear_bridge: { mortar: '#6a4b29', stones: ['#cca470', '#ba905a', '#dab480', '#aa804c'] },
  magma_crucible_arena: { mortar: '#5e2116', stones: ['#946c62', '#825a50', '#a67c72', '#704a42'] },
  iron_core_citadel: { mortar: '#443d48', stones: ['#9e9ca8', '#8c8a96', '#b0aebc', '#7a7886'] },
  shadowfen_lantern_bog: { mortar: '#2b4738', stones: ['#73947a', '#63846a', '#82a389', '#55735c'] },
  sunken_totem_ruins: { mortar: '#755331', stones: ['#d6b078', '#c89f64', '#e4c18b', '#b88e54'] },
  venom_alchemist_marsh: { mortar: '#2c3d40', stones: ['#71968f', '#60857e', '#82a8a1', '#51736c'] },
  eclipse_oak_bastion: { mortar: '#4d2b35', stones: ['#9c7580', '#8c6570', '#ad8691', '#7a5660'] },
  starfall_glacier_bridge: { mortar: '#5980a8', stones: ['#cde6fc', '#bad8f4', '#e0f0ff', '#a8cbe8'] },
  chrono_prism_vault: { mortar: '#3d3c73', stones: ['#999be0', '#8789d0', '#abadeb', '#7577bf'] },
  solar_plasma_reactor: { mortar: '#6b381e', stones: ['#c4885a', '#b3774a', '#d4996a', '#a1663c'] },
  astral_nexus_throne: { mortar: '#2c3563', stones: ['#839ce0', '#728bd0', '#96aff0', '#627abf'] },
};

/** Stage-concept-themed valley ground texture so every stage looks immediately distinct. */
export function createMeadowTexture(key: TextureKey = 'forest'): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 104729;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  const rand = makeRng(seed);
  const p = MEADOW_PALETTES[key] ?? MEADOW_PALETTES.forest;

  const grad = ctx.createRadialGradient(size * 0.5, size * 0.48, 70, size * 0.5, size * 0.5, size * 0.72);
  grad.addColorStop(0, p.gradInner);
  grad.addColorStop(0.55, p.gradMid);
  grad.addColorStop(1, p.gradOuter);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (p.stripes) {
    ctx.strokeStyle = p.stripes;
    ctx.lineWidth = 10;
    for (let y = 24; y < size; y += 52) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 64) {
        const wy = y + Math.sin(x * 0.015 + y * 0.02) * 12;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
  }

  for (let i = 0; i < 230; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 34 + rand() * 88;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const roll = rand();
    const stop = roll > 0.62 ? p.patchA : roll > 0.30 ? p.patchB : p.patchC;
    g.addColorStop(0, stop);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.strokeStyle = rand() > 0.45 ? p.fleckLight : p.fleckDark;
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 9, y - 6 - rand() * 7);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCobbleRoadTexture(key: TextureKey = 'forest'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 33921;
  for (let i = 0; i < key.length; i++) seed = (seed * 37 + key.charCodeAt(i)) >>> 0;
  const rand = makeRng(seed);
  const rp = ROAD_PALETTES[key] ?? ROAD_PALETTES.forest;

  ctx.fillStyle = rp.mortar;
  ctx.fillRect(0, 0, size, size);

  const cols = 6;
  const rows = 8;
  const cellW = size / cols;
  const cellH = size / rows;
  const stoneColors = rp.stones;

  for (let row = 0; row < rows; row++) {
    const offsetX = row % 2 === 0 ? 0 : cellW * 0.5;
    for (let col = -1; col <= cols; col++) {
      const cx = col * cellW + offsetX + (rand() - 0.5) * 6;
      const cy = row * cellH + (rand() - 0.5) * 4;
      const w = cellW - 8 - rand() * 5;
      const h = cellH - 8 - rand() * 4;
      const x = cx + 4;
      const y = cy + 4;
      const radius = 12;

      ctx.fillStyle = stoneColors[Math.floor(rand() * stoneColors.length)];
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 252, 244, 0.28)';
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 2, w - 6, h * 0.36, radius * 0.6);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export interface StageRoadTextureBundle {
  map: THREE.CanvasTexture;
  emissiveMap?: THREE.CanvasTexture;
  emissive?: string;
  emissiveIntensity?: number;
  roughness: number;
  metalness: number;
}

function makeCanvasPair(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const ec = document.createElement('canvas');
  ec.width = size;
  ec.height = size;
  const ectx = ec.getContext('2d')!;
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, size, size);
  return { c, ctx, ec, ectx };
}

function finishTex(canvas: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function drawPolygonStone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
  rand: () => number,
  fill: string,
  hi?: string,
): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const radScale = 0.8 + rand() * 0.28;
    pts.push([cx + Math.cos(a) * rx * radScale, cy + Math.sin(a) * ry * radScale]);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  if (hi) {
    ctx.strokeStyle = hi;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
}

/** Generates concept-matched stylized 3D road textures (15 unique styles across all 5 regions). */
export function createStageRoadTextures(concept: StageConceptId): StageRoadTextureBundle {
  const size = 512;
  const { c, ctx, ec, ectx } = makeCanvasPair(size);
  let seed = 8191;
  for (let i = 0; i < concept.length; i++) seed = (seed * 33 + concept.charCodeAt(i)) >>> 0;
  const rand = makeRng(seed);

  // Tile helper wrapping vertically (V axis) cleanly
  const wrapYDraw = (fn: (dy: number) => void) => {
    fn(0);
    fn(-size);
    fn(size);
  };

  if (concept === 'mossy_stream') {
    // Orman 1: Natural cream flagstones with lush green moss seams
    ctx.fillStyle = '#4b8a3b';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#66b54b' : '#396e2c';
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, 5 + rand() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    const cols = 4;
    const rows = 5;
    const stones = ['#f2e4c2', '#e5d4ad', '#f7ecd0', '#d9c69c'];
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const cx = ((col + (r % 2) * 0.35) * size) / cols + (rand() - 0.5) * 14;
        const cy = ((r + 0.5) * size) / rows + (rand() - 0.5) * 12;
        const colFill = stones[Math.floor(rand() * stones.length)];
        wrapYDraw((dy) => drawPolygonStone(ctx, cx, cy + dy, 46, 40, 7, rand, colFill, 'rgba(255,252,240,0.45)'));
      }
    }
    return { map: finishTex(c), roughness: 0.86, metalness: 0.02 };
  }

  if (concept === 'acorn_island_shrine') {
    // Orman 2: Compacted golden-ochre dirt trail with embedded warm pebbles
    const grad = ctx.createLinearGradient(0, 0, size, 0);
    grad.addColorStop(0, '#a66d28');
    grad.addColorStop(0.18, '#e3a64b');
    grad.addColorStop(0.5, '#f0bb62');
    grad.addColorStop(0.82, '#e3a64b');
    grad.addColorStop(1, '#a66d28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 45; i++) {
      const px = 48 + rand() * (size - 96);
      const py = rand() * size;
      const col = rand() > 0.5 ? '#c78a38' : '#f7cf86';
      const rx = 10 + rand() * 18;
      const ry = 8 + rand() * 14;
      wrapYDraw((dy) => drawPolygonStone(ctx, px, py + dy, rx, ry, 6, rand, col, 'rgba(255,244,210,0.35)'));
    }
    return { map: finishTex(c), roughness: 0.94, metalness: 0.01 };
  }

  if (concept === 'oak_bastion_moat') {
    // Orman 3: Fan-laid royal ivory-cream cobblestones + golden autumn leaf accents
    ctx.fillStyle = '#9c8360';
    ctx.fillRect(0, 0, size, size);
    const arcRows = 8;
    const stepY = size / arcRows;
    const stones = ['#f7edd8', '#ebe0c5', '#fff5e4', '#dfd1b2'];
    for (let r = 0; r < arcRows; r++) {
      const nArc = 9;
      for (let i = 0; i < nArc; i++) {
        const u = (i + 0.5) / nArc;
        const x = u * size;
        const archOffset = Math.sin(u * Math.PI) * 26;
        const y = r * stepY + archOffset;
        const fill = stones[(r * 3 + i) % stones.length];
        wrapYDraw((dy) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.roundRect(x - 24, y + dy - 22, 46, 44, 9);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.34)';
          ctx.fillRect(x - 19, y + dy - 18, 36, 9);
        });
      }
    }
    for (let i = 0; i < 24; i++) {
      const lx = i % 2 === 0 ? 12 + rand() * 44 : size - 12 - rand() * 44;
      const ly = rand() * size;
      wrapYDraw((dy) => {
        ctx.fillStyle = rand() > 0.4 ? '#eb9b28' : '#f7c143';
        ctx.beginPath();
        ctx.ellipse(lx, ly + dy, 9, 5, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    return { map: finishTex(c), roughness: 0.82, metalness: 0.03 };
  }

  if (concept === 'crimson_powder_gorge') {
    // Kanyon 1: Fractured sun-baked red-orange sandstone canyon slabs
    ctx.fillStyle = '#c4864b';
    ctx.fillRect(0, 0, size, size);
    const slabs = ['#d96d38', '#c85b2b', '#e68049', '#b84f24'];
    const cols = 3;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const cx = ((col + 0.5) * size) / cols + (rand() - 0.5) * 20;
        const cy = ((r + 0.5) * size) / rows + (rand() - 0.5) * 16;
        const fill = slabs[Math.floor(rand() * slabs.length)];
        wrapYDraw((dy) => {
          drawPolygonStone(ctx, cx, cy + dy, 74, 58, 6, rand, fill, 'rgba(255,208,158,0.32)');
          ctx.strokeStyle = 'rgba(72, 26, 12, 0.48)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - 22, cy + dy - 8);
          ctx.lineTo(cx + 6, cy + dy + 4);
          ctx.lineTo(cx + 26, cy + dy - 10);
          ctx.stroke();
        });
      }
    }
    return { map: finishTex(c), roughness: 0.9, metalness: 0.02 };
  }

  if (concept === 'desert_windmill_oasis') {
    // Kanyon 2: Dark timber railway-style transverse sleepers & iron track trim
    ctx.fillStyle = '#ad683c';
    ctx.fillRect(0, 0, size, size);
    const sleepers = 8;
    const sh = size / sleepers;
    for (let r = 0; r < sleepers; r++) {
      const y = r * sh + 7;
      const woodCol = r % 2 === 0 ? '#5c3b22' : '#4f321c';
      ctx.fillStyle = woodCol;
      ctx.beginPath();
      ctx.roundRect(14, y, size - 28, sh - 14, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(28,15,6,0.45)';
      ctx.lineWidth = 2;
      for (let g = 0; g < 3; g++) {
        ctx.beginPath();
        ctx.moveTo(30, y + 12 + g * 12);
        ctx.lineTo(size - 30, y + 10 + g * 12);
        ctx.stroke();
      }
      // Copper bolts near track edges
      for (const bx of [36, size - 36]) {
        ctx.fillStyle = '#d99e4e';
        ctx.beginPath();
        ctx.arc(bx, y + (sh - 14) * 0.5, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Iron side rail strips
    for (const rx of [16, size - 30]) {
      ctx.fillStyle = '#5c493e';
      ctx.fillRect(rx, 0, 14, size);
      ctx.fillStyle = '#c49052';
      ctx.fillRect(rx + 4, 0, 4, size);
    }
    return { map: finishTex(c), roughness: 0.78, metalness: 0.16 };
  }

  if (concept === 'twin_bridge_chasm') {
    // Kanyon 3: Warm golden desert travertine with turquoise glazed mosaic trim strips
    ctx.fillStyle = '#c99c61';
    ctx.fillRect(0, 0, size, size);
    const trav = ['#f5dcb0', '#ead09e', '#fae4be', '#dfc28d'];
    const cols = 4;
    const rows = 6;
    const w = (size - 84) / cols;
    const h = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = 42 + col * w + 3;
        const y = r * h + 3;
        ctx.fillStyle = trav[(r * 5 + col) % trav.length];
        ctx.beginPath();
        ctx.roundRect(x, y, w - 6, h - 6, 5);
        ctx.fill();
      }
    }
    // Turquoise glazed mosaic tile strips down left/right margins
    for (let r = 0; r < 16; r++) {
      const y = r * (size / 16) + 2;
      for (const mx of [8, size - 36]) {
        ctx.fillStyle = r % 2 === 0 ? '#27d6c7' : '#18a89c';
        ctx.beginPath();
        ctx.roundRect(mx, y, 28, size / 16 - 4, 4);
        ctx.fill();
      }
    }
    return { map: finishTex(c), roughness: 0.74, metalness: 0.06 };
  }

  if (concept === 'biolum_quartz_stream') {
    // Magara 1: Dark blue slate flagstones with crisp glowing cyan bioluminescent crystal veins
    ctx.fillStyle = '#18e8e0';
    ctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#12ccc4';
    ectx.fillRect(0, 0, size, size);
    const slates = ['#2d3f54', '#263547', '#364b63', '#223040'];
    const cols = 3;
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const cx = ((col + (r % 2) * 0.45) * size) / cols + (rand() - 0.5) * 10;
        const cy = ((r + 0.5) * size) / rows + (rand() - 0.5) * 8;
        const colFill = slates[Math.floor(rand() * slates.length)];
        wrapYDraw((dy) => {
          drawPolygonStone(ctx, cx, cy + dy, 88, 54, 6, rand, colFill, 'rgba(130, 245, 255, 0.42)');
          drawPolygonStone(ectx, cx, cy + dy, 82, 49, 6, () => 0.5, '#000000');
        });
      }
    }
    return {
      map: finishTex(c),
      emissiveMap: finishTex(ec),
      emissive: '#ffffff',
      emissiveIntensity: 0.72,
      roughness: 0.72,
      metalness: 0.1,
    };
  }

  if (concept === 'abandoned_drill_mine') {
    // Magara 2: Chunky hexagonal dwarf-forged dark basalt pavers + bronze flange border
    ctx.fillStyle = '#1f232b';
    ctx.fillRect(0, 0, size, size);
    const hexR = 46;
    const dx = hexR * 1.65;
    const dy = hexR * 1.48;
    const bas = ['#3e4552', '#353c47', '#48505e', '#2f3540'];
    for (let row = -1; row <= 8; row++) {
      for (let col = -1; col <= 7; col++) {
        const cx = col * dx + (row % 2 === 0 ? 0 : dx * 0.5);
        const cy = row * dy;
        const fill = bas[(Math.abs(row * 3 + col * 5)) % bas.length];
        ctx.fillStyle = fill;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const vx = cx + Math.cos(a) * (hexR - 3.5);
          const vy = cy + Math.sin(a) * (hexR - 3.5);
          if (k === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(170,185,205,0.22)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    for (const bx of [0, size - 22]) {
      ctx.fillStyle = '#8c5b2f';
      ctx.fillRect(bx, 0, 22, size);
    }
    return { map: finishTex(c), roughness: 0.56, metalness: 0.24 };
  }

  if (concept === 'amethyst_ley_sanctum') {
    // Magara 3: Obsidian slabs etched with glowing magenta arcane runes
    ctx.fillStyle = '#140e24';
    ctx.fillRect(0, 0, size, size);
    const obs = ['#281d42', '#211738', '#30244f'];
    const cols = 3;
    const rows = 4;
    const w = size / cols;
    const h = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = col * w + 5;
        const y = r * h + 5;
        ctx.fillStyle = obs[(r + col) % obs.length];
        ctx.beginPath();
        ctx.roundRect(x, y, w - 10, h - 10, 7);
        ctx.fill();
        // Glowing magenta arcane glyph inside slab
        const gx = x + w * 0.5 - 5;
        const gy = y + h * 0.5 - 5;
        for (const tctx of [ctx, ectx]) {
          tctx.strokeStyle = '#ef5cff';
          tctx.lineWidth = tctx === ectx ? 5 : 4;
          tctx.lineCap = 'round';
          tctx.beginPath();
          tctx.moveTo(gx - 22, gy - 22);
          tctx.lineTo(gx + 18, gy);
          tctx.lineTo(gx - 18, gy + 24);
          tctx.moveTo(gx, gy - 26);
          tctx.lineTo(gx, gy + 26);
          tctx.stroke();
        }
      }
    }
    return {
      map: finishTex(c),
      emissiveMap: finishTex(ec),
      emissive: '#ffffff',
      emissiveIntensity: 0.9,
      roughness: 0.62,
      metalness: 0.16,
    };
  }

  if (concept === 'frozen_mirror_lake') {
    // Kis 3: Faceted translucent sapphire-cyan glacier crystal ice tiles
    ctx.fillStyle = '#2979a8';
    ctx.fillRect(0, 0, size, size);
    const iceCols = ['#6ad8ff', '#57ccf7', '#82e2ff', '#4ac0f0'];
    const cols = 2;
    const rows = 4;
    const w = size / cols;
    const h = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = col * w + 6;
        const y = r * h + 6;
        ctx.fillStyle = iceCols[(r + col) % iceCols.length];
        ctx.beginPath();
        ctx.roundRect(x, y, w - 12, h - 12, 10);
        ctx.fill();
        // Bright white crystalline frost fractures
        for (const tctx of [ctx, ectx]) {
          tctx.strokeStyle = tctx === ectx ? '#58c7ff' : '#ffffff';
          tctx.lineWidth = tctx === ectx ? 2.5 : 3;
          tctx.beginPath();
          const cx = x + (w - 12) * 0.5;
          const cy = y + (h - 12) * 0.5;
          tctx.moveTo(cx - 50, cy - 18);
          tctx.lineTo(cx + 8, cy + 4);
          tctx.lineTo(cx + 55, cy - 12);
          tctx.moveTo(cx - 12, cy - 34);
          tctx.lineTo(cx + 8, cy + 4);
          tctx.lineTo(cx + 18, cy + 36);
          tctx.stroke();
        }
      }
    }
    return {
      map: finishTex(c),
      emissiveMap: finishTex(ec),
      emissive: '#ffffff',
      emissiveIntensity: 0.35,
      roughness: 0.16,
      metalness: 0.15,
    };
  }

  if (concept === 'blizzard_watchtower') {
    // Kis 2: Frost-dusted dark Nordic pine timber boardwalk planks
    ctx.fillStyle = '#dcecf7';
    ctx.fillRect(0, 0, size, size);
    const planks = 10;
    const ph = size / planks;
    for (let r = 0; r < planks; r++) {
      const y = r * ph + 4;
      ctx.fillStyle = r % 2 === 0 ? '#5c493b' : '#4f3e32';
      ctx.beginPath();
      ctx.roundRect(14, y, size - 28, ph - 8, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(235, 248, 255, 0.36)';
      ctx.fillRect(24, y + 4, 80 + rand() * 140, 7);
      ctx.fillRect(size - 160, y + ph - 18, 95, 6);
      for (const nx of [34, size - 34]) {
        ctx.fillStyle = '#8e9cad';
        ctx.beginPath();
        ctx.arc(nx, y + (ph - 8) * 0.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return { map: finishTex(c), roughness: 0.8, metalness: 0.06 };
  }

  if (concept === 'aurora_citadel_siege') {
    // Kis 1: Highland blue-grey granite flagstones tucked in fluffy white snow drifts
    ctx.fillStyle = '#e8f4fc';
    ctx.fillRect(0, 0, size, size);
    const grans = ['#6e849c', '#5f748c', '#7b91aa', '#667a92'];
    const cols = 3;
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = (col * size) / cols + 10 + (rand() - 0.5) * 10;
        const y = (r * size) / rows + 8;
        ctx.fillStyle = grans[(r + col) % grans.length];
        ctx.beginPath();
        ctx.roundRect(x, y, size / cols - 20, size / rows - 16, 12);
        ctx.fill();
      }
    }
    for (let i = 0; i < 20; i++) {
      const sx = rand() * size;
      const sy = rand() * size;
      wrapYDraw((dy) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + dy, 24 + rand() * 20, 12 + rand() * 8, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    return { map: finishTex(c), roughness: 0.84, metalness: 0.04 };
  }

  if (concept === 'cinder_slag_canal') {
    // Dokumhane 1: Charred black basalt stone slabs with crisp glowing orange molten lava veins
    ctx.fillStyle = '#ff6a00';
    ctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#ff5900';
    ectx.fillRect(0, 0, size, size);
    const cols = 3;
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const cx = ((col + (r % 2) * 0.45) * size) / cols + (rand() - 0.5) * 10;
        const cy = ((r + 0.5) * size) / rows + (rand() - 0.5) * 8;
        const rockFill = rand() > 0.5 ? '#24242b' : '#2f2e36';
        wrapYDraw((dy) => {
          drawPolygonStone(ctx, cx, cy + dy, 88, 54, 6, rand, rockFill, 'rgba(255, 160, 48, 0.45)');
          drawPolygonStone(ectx, cx, cy + dy, 82, 49, 6, () => 0.5, '#000000');
        });
      }
    }
    return {
      map: finishTex(c),
      emissiveMap: finishTex(ec),
      emissive: '#ffffff',
      emissiveIntensity: 0.85,
      roughness: 0.72,
      metalness: 0.14,
    };
  }

  if (concept === 'clockwork_gear_bridge') {
    // Dokumhane 2: Diamond-tread dark steel deck armor plates + bolt seams
    ctx.fillStyle = '#252930';
    ctx.fillRect(0, 0, size, size);
    const h = size / 2;
    for (let r = 0; r < 2; r++) {
      const y = r * h + 6;
      ctx.fillStyle = r === 0 ? '#4a525e' : '#434b57';
      ctx.beginPath();
      ctx.roundRect(14, y, size - 28, h - 12, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,196,214,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Diamond tread bumps
      for (let gx = 42; gx < size - 42; gx += 38) {
        for (let gy = y + 26; gy < y + h - 26; gy += 36) {
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(((gx + gy) / 36) % 2 === 0 ? Math.PI / 4 : -Math.PI / 4);
          ctx.fillStyle = '#7b8796';
          ctx.fillRect(-10, -3.5, 20, 7);
          ctx.restore();
        }
      }
      for (const bx of [30, size - 30]) {
        for (const by of [y + 20, y + h - 32]) {
          ctx.fillStyle = '#9aa6b5';
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return { map: finishTex(c), roughness: 0.36, metalness: 0.62 };
  }

  if (concept === 'magma_crucible_arena') {
    // Dokumhane 3: Herringbone kiln-baked crimson firebrick pavers + amber glowing seams
    ctx.fillStyle = '#ff6a14';
    ctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#e04f00';
    ectx.fillRect(0, 0, size, size);
    const brickW = 64;
    const brickH = 28;
    const reds = ['#9e3222', '#8a281b', '#b03d2a', '#782116'];
    for (let y = -size; y < size * 2; y += brickH * 1.45) {
      for (let x = -size; x < size * 2; x += brickW * 1.45) {
        const idx = Math.abs(Math.floor(x + y)) % reds.length;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((Math.floor(x / brickW) + Math.floor(y / brickH)) % 2 === 0 ? 1 : -1) * (Math.PI / 4));
        ctx.fillStyle = reds[idx];
        ctx.beginPath();
        ctx.roundRect(-brickW * 0.44, -brickH * 0.42, brickW * 0.88, brickH * 0.84, 4);
        ctx.fill();
        ctx.restore();

        ectx.save();
        ectx.translate(x, y);
        ectx.rotate(((Math.floor(x / brickW) + Math.floor(y / brickH)) % 2 === 0 ? 1 : -1) * (Math.PI / 4));
        ectx.fillStyle = '#000000';
        ectx.fillRect(-brickW * 0.4, -brickH * 0.38, brickW * 0.8, brickH * 0.76);
        ectx.restore();
      }
    }
    return {
      map: finishTex(c),
      emissiveMap: finishTex(ec),
      emissive: '#ffffff',
      emissiveIntensity: 0.65,
      roughness: 0.68,
      metalness: 0.14,
    };
  }

  if (
    concept === 'shadowfen_lantern_bog' ||
    concept === 'sunken_totem_ruins' ||
    concept === 'venom_alchemist_marsh' ||
    concept === 'eclipse_oak_bastion' ||
    concept === 'starfall_glacier_bridge' ||
    concept === 'chrono_prism_vault' ||
    concept === 'solar_plasma_reactor' ||
    concept === 'astral_nexus_throne'
  ) {
    const rp = ROAD_PALETTES[concept];
    ctx.fillStyle = rp.mortar;
    ctx.fillRect(0, 0, size, size);
    const segH = size / 4;
    for (let r = 0; r < 4; r++) {
      const y = r * segH + 8;
      ctx.fillStyle = rp.stones[r % rp.stones.length];
      ctx.beginPath();
      ctx.roundRect(18, y, size - 36, segH - 16, 10);
      ctx.fill();
    }
    const glowHex =
      concept === 'shadowfen_lantern_bog' || concept === 'venom_alchemist_marsh'
        ? '#54f097'
        : concept === 'sunken_totem_ruins' || concept === 'solar_plasma_reactor'
          ? '#ffb338'
          : concept === 'eclipse_oak_bastion'
            ? '#ff6b52'
            : '#72e3ff';
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);
    for (const targetCtx of [ctx, ectx]) {
      targetCtx.fillStyle = glowHex;
      targetCtx.fillRect(8, 0, 7, size);
      targetCtx.fillRect(size - 15, 0, 7, size);
    }
    return {
      map: finishTex(c),
      emissiveMap: finishTex(ec),
      emissive: '#ffffff',
      emissiveIntensity: 0.72,
      roughness: 0.44,
      metalness: 0.42,
    };
  }

  // Fallback / 16 iron_core_citadel: Dark forged steel armor panels + glowing molten conduit borders
  ctx.fillStyle = '#252630';
  ctx.fillRect(0, 0, size, size);
  const segH = size / 2;
  for (let r = 0; r < 2; r++) {
    const y = r * segH + 8;
    ctx.fillStyle = '#3c3e4d';
    ctx.beginPath();
    ctx.roundRect(22, y, size - 44, segH - 16, 8);
    ctx.fill();
    for (const tctx of [ctx, ectx]) {
      tctx.fillStyle = '#ff9224';
      tctx.fillRect(10, y + 10, 8, segH - 36);
      tctx.fillRect(size - 18, y + 10, 8, segH - 36);
      tctx.fillRect(36, y + (segH - 16) * 0.5 - 3, size - 72, 6);
    }
  }
  return {
    map: finishTex(c),
    emissiveMap: finishTex(ec),
    emissive: '#ffffff',
    emissiveIntensity: 0.85,
    roughness: 0.38,
    metalness: 0.56,
  };
}


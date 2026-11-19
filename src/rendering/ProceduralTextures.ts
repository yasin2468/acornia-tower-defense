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

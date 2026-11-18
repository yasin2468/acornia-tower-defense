import * as THREE from 'three';
import type { LevelSpec } from '../data/levels.ts';

type Biome = LevelSpec['biome'];

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEADOW_PALETTES: Record<
  Biome,
  {
    gradInner: string;
    gradMid: string;
    gradOuter: string;
    patchA: string;
    patchB: string;
    patchC: string;
    fleckLight: string;
    fleckDark: string;
  }
> = {
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
};

const ROAD_PALETTES: Record<Biome, { mortar: string; stones: string[] }> = {
  forest: { mortar: '#9a805c', stones: ['#d4c2a3', '#cbb896', '#dccbb0', '#c4b08e'] },
  canyon: { mortar: '#9b6d46', stones: ['#e4c49a', '#d7b284', '#edd0a8', '#cca372'] },
  cavern: { mortar: '#59637d', stones: ['#b5c1d6', '#a4b2c9', '#c4cfe2', '#97a6be'] },
  snow: { mortar: '#889bb2', stones: ['#e2ecf6', '#d6e3f0', '#eef5fc', '#cad9e8'] },
};

/** Biome-themed valley ground texture so every region feels visually distinct. */
export function createMeadowTexture(biome: Biome = 'forest'): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeRng(104729);
  const p = MEADOW_PALETTES[biome];

  const grad = ctx.createRadialGradient(size * 0.5, size * 0.48, 70, size * 0.5, size * 0.5, size * 0.72);
  grad.addColorStop(0, p.gradInner);
  grad.addColorStop(0.55, p.gradMid);
  grad.addColorStop(1, p.gradOuter);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

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

export function createCobbleRoadTexture(biome: Biome = 'forest'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeRng(33921);
  const rp = ROAD_PALETTES[biome];

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

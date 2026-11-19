import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { getAuraSpec, getBannerSpec, type AuraId, type BannerId } from '../data/accessories.ts';
import { ENEMIES, resolveHeroVisualVariant, type HeroClassId, type HeroId } from '../data/enemies.ts';
import type { LevelSpec, StageConceptId, Vec2 } from '../data/levels.ts';
import { TOWERS, type HatId, type TowerId } from '../data/towers.ts';
import type {
  EnemyInstance,
  ProjectileInstance,
  ResinPool,
  SimEvent,
  SimulationEngine,
  SlotState,
} from '../core/SimulationEngine.ts';
import { extractStaticPrimitives, instantiateModel, type ModelName } from './AssetLoader.ts';
import { CameraController } from './CameraController.ts';
import { countDrawCalls } from './DrawCallCounter.ts';
import {
  createCobbleRoadTexture,
  createMeadowTexture,
  createStageRoadTextures,
  type StageRoadTextureBundle,
} from './ProceduralTextures.ts';
import {
  STAGE_LIGHTING_THEMES,
  buildStageConcept,
  type StageAnimatedProp,
  type StagePulseMat,
} from './StageConcepts.ts';
import {
  createEnemyRig,
  createGreatOakCastle,
  createHeroRig,
  createPropLOD,
  createStumpProp,
  createTowerRig,
  createTreeProp,
  triggerHeroAttack,
  triggerTowerRecoil,
  updateEnemyAnimation,
  updateHeroAnimation,
  updateTowerAnimation,
  type EnemyRig,
  type HeroRig,
  type TowerRig,
} from './ModelFactory.ts';
import {
  computePathAwareStagger,
  easeOutCubic,
  evalHitJolt,
  hitFlashStrength,
  HIT_FLASH_DURATION,
  HIT_FLASH_EMISSIVE,
  HIT_JOLT_DURATION,
  type StaggerTier,
} from '../core/JuiceController.ts';

const WHITE = new THREE.Color(1, 1, 1);
const SLOW_TINT = new THREE.Color('#38a1db');
const FROZEN_TINT = new THREE.Color('#9fe8ff');
const TRAIL_POINTS = 10;

interface MaterialBase {
  mat: THREE.MeshStandardMaterial;
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

/** Render-only per-enemy feedback state (flash + directional knockback + pitch wobble). */
interface EnemyFeel {
  bases: MaterialBase[];
  flashElapsed: number;
  flashDur: number;
  flashTint: THREE.Color;
  flashEmissivePeak: number;
  flashDarken: number;
  lastFullFlashAt: number;
  joltElapsed: number;
  kx: number;
  kz: number;
  tilt: number;
  axis: THREE.Vector3;
  lastHitDirX: number;
  lastHitDirZ: number;
  visual: 'rest' | 'slow' | 'frozen' | 'flash';
}

interface TowerPunch {
  elapsed: number;
  dirX: number;
  dirZ: number;
}

interface SparkItem {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  stretch: number;
  active: boolean;
}

interface ScorchDecal {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  active: boolean;
}

/** Tapered additive ribbon following a projectile in the XZ plane (pooled). */
interface TrailItem {
  mesh: THREE.Mesh;
  pos: Float32Array;
  col: Float32Array;
  pts: Float32Array;
  filled: number;
  width: number;
  color: THREE.Color;
  active: boolean;
  fading: boolean;
  fade: number;
}

interface ParticleItem {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
  isCoin?: boolean;
}

interface ShockRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
  disposeGeo?: boolean;
}

interface EnergyBeam {
  meshes: THREE.Mesh[];
  life: number;
  maxLife: number;
}

interface MuzzleFlash {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface DyingBody {
  group: THREE.Group;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  bases: MaterialBase[];
  elapsed: number;
}

interface MortarVisual {
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  totalDist: number;
  smokeAccum: number;
  ring?: THREE.Mesh;
}

export interface ScreenProjection {
  x: number;
  y: number;
  visible: boolean;
}

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.18 },
    offset: { value: 1.05 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vig = clamp(1.0 - dot(uv, uv) * darkness, 0.66, 1.0);
      gl_FragColor = vec4(texel.rgb * vig, texel.a);
    }
  `,
};

function buildCurvedRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const totalLen = curve.getLength();
  const half = width * 0.5;

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const perpX = -tan.z;
    const perpZ = tan.x;
    const plen = Math.hypot(perpX, perpZ) || 1;
    const nx = (perpX / plen) * half;
    const nz = (perpZ / plen) * half;

    positions.push(pt.x - nx, pt.y, pt.z - nz);
    positions.push(pt.x + nx, pt.y, pt.z + nz);
    const vCoord = (u * totalLen) / 2.6;
    uvs.push(0, vCoord);
    uvs.push(1, vCoord);

    if (i < segments) {
      const idx = i * 2;
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx + 1, idx + 3, idx + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRoadCurbstones(curve: THREE.CatmullRomCurve3, concept: StageConceptId = 'mossy_stream'): THREE.Group {
  const group = new THREE.Group();
  const steps = 64;
  const totalInstances = steps * 2;
  const roadHalfW = 0.84;

  let curbGeo: THREE.BufferGeometry;
  let curbMat: THREE.MeshStandardMaterial;
  let palette: THREE.Color[];
  let tiltOutRad = 0;
  let extraGeo: THREE.BufferGeometry | null = null;
  let extraMat: THREE.MeshStandardMaterial | null = null;
  let extraScale: [number, number, number] = [1, 1, 1];
  let extraY = 0.08;
  let extraStride = 1;

  switch (concept) {
    case 'mossy_stream': {
      curbGeo = new THREE.SphereGeometry(0.15, 7, 5);
      curbGeo.scale(1.0, 0.52, 1.35);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84, metalness: 0.02 });
      palette = [new THREE.Color('#cfc4ab'), new THREE.Color('#bab099'), new THREE.Color('#dfd7c2')];
      break;
    }
    case 'acorn_island_shrine': {
      curbGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.44, 7);
      curbGeo.rotateX(Math.PI / 2);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0.02 });
      palette = [new THREE.Color('#6b4122'), new THREE.Color('#5c361a'), new THREE.Color('#7a4b28')];
      extraGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.28, 6);
      extraMat = new THREE.MeshStandardMaterial({ color: '#543016', roughness: 0.85 });
      extraY = 0.14;
      extraStride = 4;
      break;
    }
    case 'oak_bastion_moat': {
      curbGeo = new RoundedBoxGeometry(0.24, 0.13, 0.42, 2, 0.04);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.03 });
      palette = [new THREE.Color('#f2e6cc'), new THREE.Color('#e6d7b8'), new THREE.Color('#faefe0')];
      break;
    }
    case 'crimson_powder_gorge': {
      curbGeo = new THREE.DodecahedronGeometry(0.18, 0);
      curbGeo.scale(1.0, 0.72, 1.15);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0.02 });
      palette = [new THREE.Color('#b84c27'), new THREE.Color('#cf5d34'), new THREE.Color('#9e3c1e')];
      break;
    }
    case 'desert_windmill_oasis': {
      curbGeo = new THREE.BoxGeometry(0.14, 0.11, 0.44);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0.58 });
      palette = [new THREE.Color('#664d3b'), new THREE.Color('#7d6049')];
      extraGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.14, 6);
      extraMat = new THREE.MeshStandardMaterial({ color: '#c78c44', roughness: 0.36, metalness: 0.65 });
      extraY = 0.09;
      extraStride = 2;
      break;
    }
    case 'twin_bridge_chasm': {
      curbGeo = new RoundedBoxGeometry(0.24, 0.12, 0.36, 2, 0.04);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.68, metalness: 0.08 });
      palette = [new THREE.Color('#27d6c7'), new THREE.Color('#f0d29c'), new THREE.Color('#18a89c')];
      break;
    }
    case 'biolum_quartz_stream': {
      curbGeo = new THREE.ConeGeometry(0.11, 0.36, 5);
      curbGeo.translate(0, 0.12, 0);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#0ea5b8',
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.15,
      });
      palette = [new THREE.Color('#7ffaff'), new THREE.Color('#47e3f5'), new THREE.Color('#a6fcff')];
      tiltOutRad = 0.42;
      break;
    }
    case 'abandoned_drill_mine': {
      curbGeo = new RoundedBoxGeometry(0.22, 0.13, 0.42, 1, 0.03);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0.66 });
      palette = [new THREE.Color('#9c6635'), new THREE.Color('#825329'), new THREE.Color('#b07741')];
      extraGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 6);
      extraMat = new THREE.MeshStandardMaterial({ color: '#c9d4e0', metalness: 0.72, roughness: 0.3 });
      extraY = 0.08;
      extraStride = 2;
      break;
    }
    case 'amethyst_ley_sanctum': {
      curbGeo = new THREE.OctahedronGeometry(0.15, 0);
      curbGeo.scale(0.85, 1.55, 0.85);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#9333ea',
        emissiveIntensity: 0.7,
        roughness: 0.24,
        metalness: 0.2,
      });
      palette = [new THREE.Color('#df8aff'), new THREE.Color('#b85cff'), new THREE.Color('#f0b5ff')];
      tiltOutRad = 0.32;
      break;
    }
    case 'frozen_mirror_lake': {
      curbGeo = new RoundedBoxGeometry(0.26, 0.15, 0.34, 1, 0.03);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#22a6e0',
        emissiveIntensity: 0.35,
        roughness: 0.16,
        metalness: 0.14,
      });
      palette = [new THREE.Color('#8ee8ff'), new THREE.Color('#b5f2ff'), new THREE.Color('#73d9fa')];
      break;
    }
    case 'blizzard_watchtower': {
      curbGeo = new THREE.BoxGeometry(0.12, 0.12, 0.44);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84, metalness: 0.04 });
      palette = [new THREE.Color('#594538'), new THREE.Color('#4a382d')];
      extraGeo = new THREE.BoxGeometry(0.18, 0.28, 0.18);
      extraMat = new THREE.MeshStandardMaterial({ color: '#6b5344', roughness: 0.82 });
      extraY = 0.14;
      extraStride = 4;
      break;
    }
    case 'aurora_citadel_siege': {
      curbGeo = new RoundedBoxGeometry(0.28, 0.15, 0.38, 2, 0.06);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.04 });
      palette = [new THREE.Color('#e8f4fc'), new THREE.Color('#9cb4cc'), new THREE.Color('#dcebf7')];
      break;
    }
    case 'cinder_slag_canal': {
      curbGeo = new THREE.DodecahedronGeometry(0.18, 0);
      curbGeo.scale(1.0, 0.78, 1.15);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#3b1506',
        emissiveIntensity: 0.35,
        roughness: 0.9,
        metalness: 0.1,
      });
      palette = [new THREE.Color('#28272e'), new THREE.Color('#34323b'), new THREE.Color('#1f1e24')];
      break;
    }
    case 'clockwork_gear_bridge':
    case 'iron_core_citadel': {
      curbGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.44, 8);
      curbGeo.rotateX(Math.PI / 2);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.32,
        metalness: 0.74,
      });
      palette =
        concept === 'iron_core_citadel'
          ? [new THREE.Color('#cf8e38'), new THREE.Color('#565b69')]
          : [new THREE.Color('#c97538'), new THREE.Color('#b8682e'), new THREE.Color('#d98645')];
      extraGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.09, 8);
      extraGeo.rotateX(Math.PI / 2);
      extraMat = new THREE.MeshStandardMaterial({ color: '#5c4129', roughness: 0.35, metalness: 0.75 });
      extraY = 0.08;
      extraStride = 3;
      break;
    }
    case 'magma_crucible_arena': {
      curbGeo = new RoundedBoxGeometry(0.24, 0.14, 0.4, 1, 0.03);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.44, metalness: 0.68 });
      palette = [new THREE.Color('#3e414a'), new THREE.Color('#4c505c'), new THREE.Color('#33363e')];
      extraGeo = new THREE.BoxGeometry(0.28, 0.24, 0.24);
      extraMat = new THREE.MeshStandardMaterial({ color: '#555a66', roughness: 0.4, metalness: 0.72 });
      extraY = 0.12;
      extraStride = 4;
      break;
    }
    case 'shadowfen_lantern_bog':
    case 'eclipse_oak_bastion': {
      curbGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.34, 7);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84, metalness: 0.1 });
      palette =
        concept === 'eclipse_oak_bastion'
          ? [new THREE.Color('#6b3a44'), new THREE.Color('#47242c')]
          : [new THREE.Color('#3f5e48'), new THREE.Color('#2d4534')];
      break;
    }
    case 'sunken_totem_ruins':
    case 'chrono_prism_vault': {
      curbGeo = new THREE.BoxGeometry(0.24, 0.18, 0.36);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0.48 });
      palette =
        concept === 'chrono_prism_vault'
          ? [new THREE.Color('#8694e0'), new THREE.Color('#5a62b5')]
          : [new THREE.Color('#d4a656'), new THREE.Color('#a67834')];
      break;
    }
    case 'venom_alchemist_marsh':
    case 'starfall_glacier_bridge': {
      curbGeo = new THREE.OctahedronGeometry(0.16, 0);
      curbGeo.scale(0.95, 1.45, 0.95);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: concept === 'venom_alchemist_marsh' ? '#127a3f' : '#1b6dc4',
        emissiveIntensity: 0.45,
        roughness: 0.25,
      });
      palette =
        concept === 'venom_alchemist_marsh'
          ? [new THREE.Color('#62f2a0'), new THREE.Color('#38b56c')]
          : [new THREE.Color('#a8e2ff'), new THREE.Color('#66b5ff')];
      break;
    }
    case 'solar_plasma_reactor':
    case 'astral_nexus_throne': {
      curbGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.42, 8);
      curbGeo.rotateX(Math.PI / 2);
      curbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: concept === 'solar_plasma_reactor' ? '#7a2b06' : '#123e7a',
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.72,
      });
      palette =
        concept === 'solar_plasma_reactor'
          ? [new THREE.Color('#f59e3d'), new THREE.Color('#663e2e')]
          : [new THREE.Color('#70d6ff'), new THREE.Color('#3d4c85')];
      break;
    }
    default: {
      curbGeo = new RoundedBoxGeometry(0.26, 0.12, 0.35, 2, 0.05);
      curbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, metalness: 0.02 });
      palette = [new THREE.Color('#ebe2cf'), new THREE.Color('#dfd5c0'), new THREE.Color('#f2ebda')];
      break;
    }
  }

  const mesh = new THREE.InstancedMesh(curbGeo, curbMat, totalInstances);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const extraCount = extraGeo ? Math.ceil(steps / extraStride) * 2 : 0;
  const extraMesh =
    extraGeo && extraMat && extraCount > 0 ? new THREE.InstancedMesh(extraGeo, extraMat, extraCount) : null;
  if (extraMesh) {
    extraMesh.castShadow = true;
    extraMesh.receiveShadow = true;
  }

  const dummy = new THREE.Object3D();
  let idx = 0;
  let exIdx = 0;

  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const yaw = Math.atan2(tan.x, tan.z);
    const perpX = -tan.z;
    const perpZ = tan.x;
    const plen = Math.hypot(perpX, perpZ) || 1;
    const nx = perpX / plen;
    const nz = perpZ / plen;

    for (const side of [-1, 1]) {
      const jitter = ((i * 17 + (side > 0 ? 5 : 1)) % 7) * 0.008 - 0.024;
      dummy.position.set(pt.x + nx * (roadHalfW + jitter) * side, 0.06, pt.z + nz * (roadHalfW + jitter) * side);
      dummy.rotation.set(0, yaw + jitter * 2, side * tiltOutRad);
      const lenScale = 0.92 + ((i + (side > 0 ? 1 : 0)) % 3) * 0.08;
      dummy.scale.set(1, 0.92 + ((i % 2) * 0.14), lenScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(idx, palette[(i + (side > 0 ? 1 : 0)) % palette.length]);
      idx += 1;

      if (extraMesh && i % extraStride === 0 && exIdx < extraCount) {
        dummy.position.set(pt.x + nx * (roadHalfW + 0.03) * side, extraY, pt.z + nz * (roadHalfW + 0.03) * side);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(extraScale[0], extraScale[1], extraScale[2]);
        dummy.updateMatrix();
        extraMesh.setMatrixAt(exIdx++, dummy.matrix);
      }
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  if (extraMesh) {
    extraMesh.count = exIdx;
    extraMesh.instanceMatrix.needsUpdate = true;
    group.add(extraMesh);
  }
  return group;
}

function buildMeadowFoliageTufts(curves: THREE.CatmullRomCurve3[], level: LevelSpec): THREE.InstancedMesh {
  const curveSamples = curves.flatMap((c) => c.getSpacedPoints(80));
  const count = 95;
  const rockGeo = new THREE.DodecahedronGeometry(0.14, 0);
  rockGeo.translate(0, 0.06, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0.0 });
  const instMesh = new THREE.InstancedMesh(rockGeo, mat, count);
  instMesh.castShadow = true;
  instMesh.receiveShadow = true;

  const biomeTufts: Record<LevelSpec['biome'], THREE.Color[]> = {
    forest: [
      new THREE.Color('#527d52'),
      new THREE.Color('#5f8f5b'),
      new THREE.Color('#707f8d'),
      new THREE.Color('#d9c89a'),
    ],
    canyon: [
      new THREE.Color('#b86339'),
      new THREE.Color('#cf8448'),
      new THREE.Color('#8a624a'),
      new THREE.Color('#d99a4e'),
    ],
    cavern: [
      new THREE.Color('#3c4566'),
      new THREE.Color('#4a567a'),
      new THREE.Color('#3aa8b8'),
      new THREE.Color('#68749c'),
    ],
    snow: [
      new THREE.Color('#eaf4fc'),
      new THREE.Color('#d5e6f5'),
      new THREE.Color('#8fa8c2'),
      new THREE.Color('#ffffff'),
    ],
    foundry: [
      new THREE.Color('#4a2d28'),
      new THREE.Color('#6b392c'),
      new THREE.Color('#ff7a2b'),
      new THREE.Color('#312326'),
    ],
  };
  const palette = biomeTufts[level.biome];
  const dummy = new THREE.Object3D();
  let placed = 0;
  let s = 918273;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let attempt = 0; attempt < 900 && placed < count; attempt++) {
    const x = (rnd() - 0.5) * 10.6;
    const z = (rnd() - 0.5) * 19.6;

    if (z < -8.2) continue;
    let blocked = false;
    for (const p of curveSamples) {
      if (Math.hypot(p.x - x, p.z - z) < 1.38) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const slot of level.slots) {
      if (Math.hypot(slot.x - x, slot.z - z) < 1.35) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const sc = 0.65 + rnd() * 0.7;
    dummy.position.set(x, 0.0, z);
    dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
    dummy.scale.set(sc * 1.15, sc * 0.45, sc);
    dummy.updateMatrix();
    instMesh.setMatrixAt(placed, dummy.matrix);
    instMesh.setColorAt(placed, palette[placed % palette.length]);
    placed += 1;
  }

  instMesh.count = placed;
  instMesh.instanceMatrix.needsUpdate = true;
  if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
  return instMesh;
}

/** Soft dark burn mark with blotchy edge, alpha-faded to transparent. */
function restoreMaterials(bases: MaterialBase[]): void {
  for (const b of bases) {
    b.mat.color.copy(b.color);
    b.mat.emissive.copy(b.emissive);
    b.mat.emissiveIntensity = b.emissiveIntensity;
  }
}

function createScorchTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 4, c, c, c);
  grad.addColorStop(0, 'rgba(14, 10, 8, 0.95)');
  grad.addColorStop(0.45, 'rgba(28, 20, 14, 0.78)');
  grad.addColorStop(0.75, 'rgba(40, 30, 20, 0.32)');
  grad.addColorStop(1, 'rgba(40, 30, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  let s = 7331;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = c * (0.35 + rnd() * 0.45);
    ctx.fillStyle = `rgba(18, 13, 10, ${0.18 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 4 + rnd() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTrailItem(scene: THREE.Scene): TrailItem {
  const n = TRAIL_POINTS;
  const pos = new Float32Array(n * 2 * 3);
  const col = new Float32Array(n * 2 * 3);
  const pts = new Float32Array(n * 3);
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 3;
  scene.add(mesh);
  return { mesh, pos, col, pts, filled: 0, width: 0.12, color: new THREE.Color('#ffffff'), active: false, fading: false, fade: 1 };
}

function pushTrailPoint(tr: TrailItem, x: number, y: number, z: number): void {
  const p = tr.pts;
  for (let i = TRAIL_POINTS - 1; i > 0; i--) {
    p[i * 3] = p[(i - 1) * 3];
    p[i * 3 + 1] = p[(i - 1) * 3 + 1];
    p[i * 3 + 2] = p[(i - 1) * 3 + 2];
  }
  p[0] = x;
  p[1] = y;
  p[2] = z;
  if (tr.filled === 0) {
    for (let i = 1; i < TRAIL_POINTS; i++) {
      p[i * 3] = x;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
    }
  }
  tr.filled = Math.min(TRAIL_POINTS, tr.filled + 1);
}

/** Rebuilds the tapered ribbon: full width + brightness at the head, zero at the tail. */
function rebuildTrail(tr: TrailItem): void {
  const n = TRAIL_POINTS;
  const p = tr.pts;
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(n - 1, i + 1);
    let dx = p[i0 * 3] - p[i1 * 3];
    let dz = p[i0 * 3 + 2] - p[i1 * 3 + 2];
    const l = Math.hypot(dx, dz);
    if (l < 1e-5) {
      dx = 0;
      dz = 1;
    } else {
      dx /= l;
      dz /= l;
    }
    const taper = 1 - i / (n - 1);
    const w = tr.width * taper * (0.6 + 0.4 * tr.fade);
    const px = -dz * w;
    const pz = dx * w;
    const v = i * 6;
    tr.pos[v] = p[i * 3] + px;
    tr.pos[v + 1] = p[i * 3 + 1];
    tr.pos[v + 2] = p[i * 3 + 2] + pz;
    tr.pos[v + 3] = p[i * 3] - px;
    tr.pos[v + 4] = p[i * 3 + 1];
    tr.pos[v + 5] = p[i * 3 + 2] - pz;
    // Hot white head blending into the projectile colour, fading to black (invisible additively)
    const b = Math.pow(taper, 1.35) * tr.fade;
    const hot = Math.max(0, 1 - i / 2.5);
    const r = (tr.color.r + (1 - tr.color.r) * hot) * b;
    const g = (tr.color.g + (1 - tr.color.g) * hot) * b;
    const bl = (tr.color.b + (1 - tr.color.b) * hot) * b;
    tr.col[v] = r;
    tr.col[v + 1] = g;
    tr.col[v + 2] = bl;
    tr.col[v + 3] = r;
    tr.col[v + 4] = g;
    tr.col[v + 5] = bl;
  }
  const geo = tr.mesh.geometry;
  (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
}

interface AmbientMotePool {
  mesh: THREE.InstancedMesh;
  basePos: Float32Array;
  phases: Float32Array;
  mode: 'float' | 'fall';
}

function buildAmbientMotes(biome: LevelSpec['biome']): AmbientMotePool {
  const cfg: Record<LevelSpec['biome'], { color: string; size: number; mode: 'float' | 'fall' }> = {
    forest: { color: '#ffe87a', size: 0.055, mode: 'float' },
    canyon: { color: '#ff8a3d', size: 0.085, mode: 'fall' },
    cavern: { color: '#6df7ff', size: 0.06, mode: 'float' },
    snow: { color: '#ffffff', size: 0.07, mode: 'fall' },
    foundry: { color: '#ff9638', size: 0.072, mode: 'float' },
  };
  const c = cfg[biome];
  const count = 55;
  const geo = new THREE.DodecahedronGeometry(c.size, 0);
  const mat = new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.78 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const basePos = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const dummy = new THREE.Object3D();
  let s = 48271 + biome.length * 1013;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const x = (rnd() - 0.5) * 10.4;
    const y = 0.45 + rnd() * 3.4;
    const z = -8.5 + rnd() * 18.0;
    basePos[i * 3] = x;
    basePos[i * 3 + 1] = y;
    basePos[i * 3 + 2] = z;
    phases[i] = rnd() * Math.PI * 2;
    dummy.position.set(x, y, z);
    dummy.scale.setScalar(0.8 + rnd() * 0.6);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, basePos, phases, mode: c.mode };
}

function createExplosiveBarrelProp(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.35, 0.72, 12),
    new THREE.MeshStandardMaterial({ color: '#7a4626', roughness: 0.8 }),
  );
  body.position.y = 0.36;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const hoopMat = new THREE.MeshStandardMaterial({ color: '#374151', metalness: 0.6, roughness: 0.38 });
  for (const hy of [0.18, 0.54]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.065, 12), hoopMat);
    hoop.position.y = hy;
    g.add(hoop);
  }

  const seal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.055, 12),
    new THREE.MeshStandardMaterial({ color: '#ff8a2b', emissive: '#ff4d00', emissiveIntensity: 0.8, roughness: 0.3 }),
  );
  seal.position.y = 0.73;
  g.add(seal);

  const spark = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.085, 0),
    new THREE.MeshStandardMaterial({ color: '#ffe570', emissive: '#ffaa00', emissiveIntensity: 1.15 }),
  );
  spark.position.y = 0.87;
  g.add(spark);
  return g;
}

function buildInstancedModelGroup(
  name: ModelName,
  transforms: THREE.Matrix4[],
  cloneMaterialFn?: (mat: THREE.Material, meshName: string) => THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  if (transforms.length === 0) return group;
  const prims = extractStaticPrimitives(name);
  if (prims.length === 0) return group;
  for (const p of prims) {
    const mat = cloneMaterialFn ? cloneMaterialFn(p.material, p.name) : p.material;
    const inst = new THREE.InstancedMesh(p.geometry, mat, transforms.length);
    inst.castShadow = p.castShadow;
    inst.receiveShadow = p.receiveShadow;
    for (let i = 0; i < transforms.length; i++) {
      inst.setMatrixAt(i, transforms[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  return group;
}

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly cameraCtrl: CameraController;
  onMortarExplode?: () => void;

  private readonly canvas: HTMLCanvasElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private renderTarget: THREE.WebGLRenderTarget;

  private levelGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();
  private sunLight: THREE.DirectionalLight;

  private slotMeshes = new Map<string, { stump?: THREE.Group; smoke?: THREE.Group; hitArea: THREE.Mesh }>();
  private barrelMeshes = new Map<string, { group: THREE.Group; hitArea: THREE.Mesh; alive: boolean }>();
  private ambientMotes: AmbientMotePool | null = null;
  private lanternLights: THREE.PointLight[] = [];
  private towerRigs = new Map<string, { key: string; rig: TowerRig }>();
  private enemyRigs = new Map<number, EnemyRig>();
  private projectileMeshes = new Map<
    number,
    {
      mesh: THREE.Object3D;
      mortar?: MortarVisual;
      trail: TrailItem | null;
      startX: number;
      startZ: number;
      totalDist: number;
      targetUid: number;
      towerId: TowerId;
      branchId?: string;
      dirX: number;
      dirZ: number;
      aoeRadius: number;
    }
  >();
  private enemyFeel = new Map<number, EnemyFeel>();
  private towerPunch = new Map<string, TowerPunch>();
  private sparks: SparkItem[] = [];
  private scorches: ScorchDecal[] = [];
  private trails: TrailItem[] = [];
  private ringGeo = new THREE.RingGeometry(0.8, 1.0, 44);
  private poolFillGeo = new THREE.CircleGeometry(1, 22);
  private poolRimGeo = new THREE.RingGeometry(0.86, 1.0, 22);
  private flashCoreGeo = new THREE.IcosahedronGeometry(0.2, 0);
  private flashStarGeo = new THREE.OctahedronGeometry(0.3, 0);
  private lastSim: SimulationEngine | null = null;
  private activeLevel: LevelSpec | null = null;
  private reducedMotion = false;
  /** Fired when a projectile from the Glacier owl lands (freeze burst). */
  onFreezeImpact?: () => void;
  /** Fired on each chain-lightning discharge. */
  onChainZap?: () => void;
  /** Fired on each railgun / pierce-line shot. */
  onRailgunFire?: () => void;
  private poolMeshes: Array<{ group: THREE.Group; fillMat: THREE.MeshBasicMaterial; rimMat: THREE.MeshBasicMaterial }> = [];
  private lodTrees: Array<{ lod: THREE.LOD; phase: number }> = [];
  private batterySaver = false;
  private heroRig: HeroRig | null = null;
  private heroVisualKey = '';
  private heroAuraGroup: THREE.Group | null = null;
  private heroAuraKey: AuraId = 'none';
  private castleBannerClothes: THREE.Mesh[] = [];
  private rangeRing: THREE.Mesh;
  private targetingReticle: THREE.Mesh;
  private rallyMarker: THREE.Group;
  private rallyShowTimer = 0;
  private magnetTimer = 0;
  private magnetPos = new THREE.Vector3(0, 2.35, 0);
  private skillEffects: Array<{ update: (dt: number) => boolean; dispose: () => void }> = [];
  private particles: ParticleItem[] = [];
  private coins: ParticleItem[] = [];
  private shockRings: ShockRing[] = [];
  private energyBeams: EnergyBeam[] = [];
  private muzzleFlashes: MuzzleFlash[] = [];
  private dyingBodies: DyingBody[] = [];

  private meadowTexCache = new Map<string, THREE.CanvasTexture>();
  private roadBundleCache = new Map<string, StageRoadTextureBundle>();
  private stageAnimatedProps: StageAnimatedProp[] = [];
  private stagePulseMats: StagePulseMat[] = [];
  private hemiLight: THREE.HemisphereLight;

  private lowFpsCounter = 0;
  private bloomDisabled = false;
  private animTime = 0;
  private usePostProcessing = true;
  private showcaseScene: THREE.Scene | null = null;
  private showcaseCam: THREE.PerspectiveCamera | null = null;
  private showcasePivot: THREE.Group | null = null;
  private showcaseMixer: THREE.AnimationMixer | null = null;
  private showcaseModelName: ModelName | '' = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    // Airy, soft cool-haze arena (reads like the reference "SONRA" frame); FX pop on top via bloom
    this.scene.background = new THREE.Color('#6d8196');
    this.scene.fog = new THREE.FogExp2('#7d90a4', 0.0095);

    // Subtle studio IBL environment so brass, steel & glazed porcelain catch warm specular sheen
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.36;
    roomEnv.dispose();
    pmrem.dispose();

    const w = canvas.clientWidth || 390;
    const h = canvas.clientHeight || 844;
    this.renderer.setSize(w, h, false);
    this.cameraCtrl = new CameraController(w / h);

    // Balanced golden-sunlight vs deep cool slate shadows (rich saturation, never whitewashed)
    this.hemiLight = new THREE.HemisphereLight('#c2dbff', '#56627a', 0.82);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#ffe6c4', 1.5);
    this.sunLight.position.set(7.5, 18.5, 8.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 44;
    this.sunLight.shadow.camera.left = -12;
    this.sunLight.shadow.camera.right = 12;
    this.sunLight.shadow.camera.top = 14;
    this.sunLight.shadow.camera.bottom = -14;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    const msaaSamples = this.renderer.capabilities.isWebGL2 ? 4 : 0;
    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      samples: msaaSamples,
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, this.renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.cameraCtrl.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.38, 0.85);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new ShaderPass(VignetteShader));
    this.composer.addPass(new OutputPass());

    this.meadowTexCache.set('mossy_stream', createMeadowTexture('mossy_stream'));
    this.roadBundleCache.set('mossy_stream', createStageRoadTextures('mossy_stream'));

    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.955, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: '#ffd966', transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.position.y = 0.07;
    this.rangeRing.visible = false;

    this.targetingReticle = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: '#ff9f43',
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.targetingReticle.rotation.x = -Math.PI / 2;
    this.targetingReticle.position.y = 0.085;
    this.targetingReticle.visible = false;

    this.rallyMarker = new THREE.Group();
    const rallyRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.54, 24),
      new THREE.MeshBasicMaterial({ color: '#ffd966', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    rallyRing.rotation.x = -Math.PI / 2;
    rallyRing.position.y = 0.06;
    const rallyPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.62, 8),
      new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.7 }),
    );
    rallyPole.position.y = 0.31;
    const rallyFlag = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.16, 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffd24c' }),
    );
    rallyFlag.position.set(0.12, 0.54, 0);
    this.rallyMarker.add(rallyRing, rallyPole, rallyFlag);
    this.rallyMarker.visible = false;

    this.scene.add(this.levelGroup, this.dynamicGroup, this.rangeRing, this.targetingReticle, this.rallyMarker);
    this.initPools();
  }

  private initPools(): void {
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < 150; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#ffcb77', roughness: 0.55 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.45, active: false });
    }

    const coinGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.045, 10);
    coinGeo.rotateX(Math.PI * 0.5);
    const coinMat = new THREE.MeshStandardMaterial({
      color: '#ffcf48',
      emissive: new THREE.Color('#b87308'),
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.65,
    });
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.coins.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.55, active: false, isCoin: true });
    }

    // Velocity-stretched additive impact sparks (thicker streaks read cleanly at mobile 22.4m cam)
    const sparkGeo = new THREE.BoxGeometry(0.075, 0.075, 1);
    for (let i = 0; i < 160; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffe9a8',
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.3, stretch: 1, active: false });
    }

    // Dark ground scorch decals for explosions / mortar hits
    const scorchTex = createScorchTexture();
    const scorchGeo = new THREE.PlaneGeometry(1, 1);
    scorchGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: scorchTex,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(scorchGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.scorches.push({ mesh, life: 0, maxLife: 2.8, active: false });
    }

    // Tapered projectile wake ribbons
    for (let i = 0; i < 56; i++) {
      this.trails.push(createTrailItem(this.scene));
    }
  }

  private acquireTrail(colorHex: string, width: number): TrailItem | null {
    const tr = this.trails.find((t) => !t.active);
    if (!tr) return null;
    tr.active = true;
    tr.fading = false;
    tr.fade = 1;
    tr.filled = 0;
    tr.width = width;
    tr.color.set(colorHex);
    tr.mesh.visible = true;
    return tr;
  }

  /**
   * Directional, velocity-stretched sparks. dir (0,0,0) = omni burst biased upward.
   * spread = cone half-angle in radians around the direction.
   */
  spawnSparks(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    colorHex: string,
    count: number,
    speed = 7,
    spread = 0.7,
  ): void {
    const len = Math.hypot(dirX, dirY, dirZ);
    const omni = len < 1e-5;
    const ux = omni ? 0 : dirX / len;
    const uy = omni ? 1 : dirY / len;
    const uz = omni ? 0 : dirZ / len;
    let spawned = 0;
    for (const s of this.sparks) {
      if (s.active) continue;
      let vx: number;
      let vy: number;
      let vz: number;
      if (omni) {
        const a = Math.random() * Math.PI * 2;
        const elev = 0.15 + Math.random() * 0.9;
        vx = Math.cos(a) * Math.cos(elev);
        vz = Math.sin(a) * Math.cos(elev);
        vy = Math.sin(elev);
      } else {
        vx = ux + (Math.random() - 0.5) * 2 * spread;
        vy = uy + Math.random() * spread * 0.9 + 0.12;
        vz = uz + (Math.random() - 0.5) * 2 * spread;
        const l = Math.hypot(vx, vy, vz) || 1;
        vx /= l;
        vy /= l;
        vz /= l;
      }
      const spd = speed * (0.55 + Math.random() * 0.75);
      s.vx = vx * spd;
      s.vy = vy * spd;
      s.vz = vz * spd;
      s.active = true;
      s.maxLife = 0.18 + Math.random() * 0.16;
      s.life = s.maxLife;
      s.stretch = 0.065 + Math.random() * 0.04;
      (s.mesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      s.mesh.position.set(x, y, z);
      s.mesh.visible = true;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  spawnScorch(x: number, z: number, radius: number): void {
    const d = this.scorches.find((s) => !s.active) ?? this.scorches.reduce((a, b) => (a.life < b.life ? a : b));
    d.active = true;
    d.life = d.maxLife;
    d.mesh.position.set(x, 0.052, z);
    d.mesh.rotation.y = Math.random() * Math.PI * 2;
    d.mesh.scale.setScalar(Math.max(0.6, radius) * 2.1);
    (d.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    d.mesh.visible = true;
  }

  spawnParticles(x: number, y: number, z: number, colorHex: string, count: number, speedScale = 1): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.life = 0.46;
      p.maxLife = 0.46;
      const angle = (spawned / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.55;
      const spd = (1.9 + Math.random() * 2.8) * speedScale;
      p.vx = Math.cos(angle) * spd;
      p.vz = Math.sin(angle) * spd;
      p.vy = (2.8 + Math.random() * 2.4) * speedScale;
      (p.mesh.material as THREE.MeshStandardMaterial).color.set(colorHex);
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(1);
      p.mesh.visible = true;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  spawnFlyingCoins(x: number, z: number, count: number): void {
    let spawned = 0;
    for (const c of this.coins) {
      if (c.active) continue;
      c.active = true;
      c.life = 0.55;
      c.maxLife = 0.55;
      const angle = Math.random() * Math.PI * 2;
      c.vx = Math.cos(angle) * (1.2 + Math.random() * 1.1);
      c.vz = Math.sin(angle) * (1.2 + Math.random() * 1.1);
      c.vy = 4.4 + Math.random() * 1.6;
      c.mesh.position.set(x, 0.55, z);
      c.mesh.scale.setScalar(1);
      c.mesh.visible = true;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  spawnShockRing(x: number, z: number, colorHex: string, maxScale: number, life = 0.36, y = 0.09): void {
    const mesh = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.2);
    mesh.renderOrder = 2;
    this.dynamicGroup.add(mesh);
    this.shockRings.push({ mesh, life, maxLife: life, maxScale });
  }

  spawnSocialPing(x: number, z: number, colorHex = '#5ef28e'): void {
    this.spawnShockRing(x, z, '#ffffff', 1.4, 0.22);
    this.spawnShockRing(x, z, colorHex, 2.8, 0.55);
  }

  /** Crisp crescent slash arc in XZ aligned along facingAngle (0 = +Z, PI/2 = +X). */
  spawnSlashArc(x: number, z: number, facingAngle: number, colorHex = '#ffe27a', radius = 1.35): void {
    const geo = new THREE.RingGeometry(radius * 0.58, radius, 20, 1, -Math.PI * 0.45, Math.PI * 0.9);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = facingAngle - Math.PI * 0.5;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.62, z);
    mesh.scale.setScalar(0.55);
    mesh.renderOrder = 3;
    this.dynamicGroup.add(mesh);
    this.shockRings.push({ mesh, life: 0.16, maxLife: 0.16, maxScale: 1.4, disposeGeo: true });
  }

  /** Concentrated contact flash at exact hit coordinate (core + star burst + directional sparks). */
  spawnImpactBurst(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    scale = 1,
    dirX = 0,
    dirZ = 0,
  ): void {
    this.spawnMuzzleFlash(x, y, z, colorHex, dirX, dirZ, scale >= 1.15);
    this.spawnSparks(x, y, z, dirX, 0.22, dirZ, colorHex, Math.round(7 * scale), 8.5 * scale, 0.72);
  }

  /** Bright layered muzzle burst: additive white-hot core + coloured star, plus forward sparks. */
  spawnMuzzleFlash(x: number, y: number, z: number, colorHex: string, dirX = 0, dirZ = 0, big = false): void {
    const core = new THREE.Mesh(
      this.flashCoreGeo,
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    core.position.set(x, y, z);
    core.scale.setScalar(big ? 1.5 : 1.1);
    this.dynamicGroup.add(core);
    this.muzzleFlashes.push({ mesh: core, life: 0.07, maxLife: 0.07 });

    const star = new THREE.Mesh(
      this.flashStarGeo,
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    star.position.set(x, y, z);
    star.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    star.scale.setScalar(big ? 1.4 : 1.0);
    this.dynamicGroup.add(star);
    this.muzzleFlashes.push({ mesh: star, life: 0.11, maxLife: 0.11 });

    if (dirX !== 0 || dirZ !== 0) {
      this.spawnSparks(x, y, z, dirX, 0.1, dirZ, colorHex, big ? 6 : 3, big ? 8 : 6, 0.35);
    }
  }

  private spawnEnergyBeam(pts: THREE.Vector3[], colorHex: string, thickness = 0.055, life = 0.16): void {
    const meshes: THREE.Mesh[] = [];
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dist = a.distanceTo(b);
      if (dist < 0.05) continue;
      const geo = new THREE.CylinderGeometry(thickness, thickness, dist, 6);
      const seg = new THREE.Mesh(geo, mat);
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      this.dynamicGroup.add(seg);
      meshes.push(seg);
    }
    this.energyBeams.push({ meshes, life, maxLife: life });
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.cameraCtrl.setReducedMotion(enabled);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.cameraCtrl.setAspect(width / height);
  }

  setBatterySaver(enabled: boolean): void {
    this.batterySaver = enabled;
    this.usePostProcessing = !enabled && !this.bloomDisabled;
    for (const light of this.lanternLights) {
      light.visible = !enabled;
    }
    for (const t of this.lodTrees) {
      if (t.lod.levels.length > 1) {
        t.lod.levels[1].distance = enabled ? 14 : 22;
      }
    }
  }

  loadLevel(
    level: LevelSpec,
    equippedHat: HatId,
    heroClass: HeroClassId = 'auto',
    heroId: HeroId = 'boz_pence',
    equippedAura: AuraId = 'none',
    equippedBanner: BannerId = 'none',
  ): void {
    this.clearLevel();
    this.activeLevel = level;

    const biomeTheme: Record<
      LevelSpec['biome'],
      {
        bg: string;
        fog: string;
        hemiSky: string;
        hemiGround: string;
        sunColor: string;
        sunIntensity: number;
        border: string;
        cliffTint: string;
        canopyTint: string;
      }
    > = {
      forest: {
        bg: '#6d8196',
        fog: '#7d90a4',
        hemiSky: '#c2dbff',
        hemiGround: '#56627a',
        sunColor: '#ffe8c2',
        sunIntensity: 1.55,
        border: '#b59d78',
        cliffTint: '#ffffff',
        canopyTint: '#ffffff',
      },
      canyon: {
        bg: '#8a6852',
        fog: '#9c7860',
        hemiSky: '#ffe3bd',
        hemiGround: '#6e4c36',
        sunColor: '#ffbf86',
        sunIntensity: 1.6,
        border: '#a87c4f',
        cliffTint: '#f2b885',
        canopyTint: '#e8a84a',
      },
      cavern: {
        bg: '#2f3452',
        fog: '#3a4063',
        hemiSky: '#98c7ff',
        hemiGround: '#2f2d4f',
        sunColor: '#9cc4ff',
        sunIntensity: 0.95,
        border: '#6c7999',
        cliffTint: '#9fa8cc',
        canopyTint: '#72b8b4',
      },
      snow: {
        bg: '#9cb5cf',
        fog: '#aec4db',
        hemiSky: '#eef7ff',
        hemiGround: '#7a94ad',
        sunColor: '#eef6ff',
        sunIntensity: 1.45,
        border: '#9ab0c7',
        cliffTint: '#d6e4f2',
        canopyTint: '#d4f2f7',
      },
      foundry: {
        bg: '#402624',
        fog: '#57312b',
        hemiSky: '#ffbe8f',
        hemiGround: '#3d1c19',
        sunColor: '#ffad69',
        sunIntensity: 1.42,
        border: '#8f5544',
        cliffTint: '#b87660',
        canopyTint: '#7a3b2a',
      },
    };
    const theme = STAGE_LIGHTING_THEMES[level.concept] ?? biomeTheme[level.biome];
    this.scene.background = new THREE.Color(theme.bg);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(theme.fog);
    }
    this.hemiLight.color.set(theme.hemiSky);
    this.hemiLight.groundColor.set(theme.hemiGround);
    this.sunLight.color.set(theme.sunColor);
    this.sunLight.intensity = theme.sunIntensity;

    const texKey = level.concept ?? level.biome;
    let meadowTex = this.meadowTexCache.get(texKey);
    if (!meadowTex) {
      meadowTex = createMeadowTexture(texKey);
      this.meadowTexCache.set(texKey, meadowTex);
    }
    let roadBundle = this.roadBundleCache.get(texKey);
    if (!roadBundle) {
      roadBundle = level.concept
        ? createStageRoadTextures(level.concept)
        : { map: createCobbleRoadTexture(level.biome), roughness: 0.88, metalness: 0.02 };
      this.roadBundleCache.set(texKey, roadBundle);
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 32),
      new THREE.MeshStandardMaterial({ map: meadowTex, roughness: 0.92, metalness: 0.02 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.levelGroup.add(ground);

    const curves: THREE.CatmullRomCurve3[] = [];
    const pathList = level.secondaryPath?.length ? [level.path, level.secondaryPath] : [level.path];
    for (const pPts of pathList) {
      const curvePts = pPts.map((p: Vec2) => new THREE.Vector3(p.x, 0.035, p.z));
      const c = new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.32);
      curves.push(c);

      const borderGeo = buildCurvedRibbonGeometry(c, 1.86, 160);
      const borderMat = new THREE.MeshStandardMaterial({ color: theme.border, roughness: 0.92, metalness: 0.02 });
      const borderMesh = new THREE.Mesh(borderGeo, borderMat);
      borderMesh.position.y = -0.015;
      borderMesh.receiveShadow = true;
      this.levelGroup.add(borderMesh);

      const roadGeo = buildCurvedRibbonGeometry(c, 1.48, 160);
      const roadMat = new THREE.MeshStandardMaterial({
        map: roadBundle.map,
        emissiveMap: roadBundle.emissiveMap ?? null,
        emissive: roadBundle.emissive ?? '#000000',
        emissiveIntensity: roadBundle.emissiveIntensity ?? 0,
        roughness: roadBundle.roughness,
        metalness: roadBundle.metalness,
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.receiveShadow = true;
      this.levelGroup.add(roadMesh);

      this.levelGroup.add(buildRoadCurbstones(c, level.concept));
    }

    // Slippery Ice Zones on frozen mountain passes (Snow biome)
    for (const iz of level.iceZones ?? []) {
      const iceDisk = new THREE.Mesh(
        new THREE.CircleGeometry(iz.radius, 28),
        new THREE.MeshStandardMaterial({
          color: '#c2eeff',
          emissive: '#58cbff',
          emissiveIntensity: 0.22,
          transparent: true,
          opacity: 0.42,
          roughness: 0.14,
          metalness: 0.12,
        }),
      );
      iceDisk.rotation.x = -Math.PI / 2;
      iceDisk.position.set(iz.x, 0.042, iz.z);
      this.levelGroup.add(iceDisk);

      const iceRim = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.2, iz.radius - 0.08), iz.radius, 28),
        new THREE.MeshBasicMaterial({ color: '#e6f9ff', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }),
      );
      iceRim.rotation.x = -Math.PI / 2;
      iceRim.position.set(iz.x, 0.046, iz.z);
      this.levelGroup.add(iceRim);
    }

    this.levelGroup.add(buildMeadowFoliageTufts(curves, level));

    // Biome-specific Option-1 Castle Fortress at end of path
    const castle = createGreatOakCastle(level.biome);
    castle.position.set(0, 0, -9.8);
    this.levelGroup.add(castle);

    if (equippedBanner !== 'none') {
      const bSpec = getBannerSpec(equippedBanner);
      for (const sx of [-1.7, 1.7]) {
        const std = this.buildCastleWarBanner(bSpec.clothHex, bSpec.trimHex);
        std.root.position.set(sx, 0, -8.55);
        std.root.rotation.y = sx < 0 ? 0.14 : -0.14;
        this.levelGroup.add(std.root);
        this.castleBannerClothes.push(std.cloth);
      }
    }

    const composeMat = (x: number, y: number, z: number, rotY: number, sx: number, sy: number, sz: number): THREE.Matrix4 =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
        new THREE.Vector3(sx, sy, sz),
      );

    // Canyon / Cavern / Alpine Cliffs framing visible viewport sides (InstancedMesh)
    const cliffLayout: Array<[number, number, number, number]> = [
      [-5.35, -8.5, 1.05, 0.25],
      [-5.5, -4.1, 1.12, 1.1],
      [-5.35, 3.0, 1.08, -0.4],
      [-5.15, 7.8, 1.15, 0.7],
      [5.35, -8.2, 1.05, -2.5],
      [5.45, -2.5, 1.12, 2.2],
      [5.35, 2.8, 1.08, -1.5],
      [5.15, 7.6, 1.12, 2.7],
      [-3.8, -11.0, 1.18, 0.2],
      [3.8, -10.9, 1.15, 2.9],
    ];
    const cliffMats = cliffLayout.map(([cx, cz, sc, rot]) =>
      composeMat(cx, 0, cz, rot, sc, level.biome === 'canyon' ? sc * 1.28 : sc, sc),
    );
    this.levelGroup.add(
      buildInstancedModelGroup('env_cliff_segment', cliffMats, (origMat) => {
        if (theme.cliffTint === '#ffffff' || !(origMat instanceof THREE.MeshStandardMaterial)) return origMat;
        const cloned = origMat.clone();
        cloned.color.multiply(new THREE.Color(theme.cliffTint));
        cloned.needsUpdate = true;
        return cloned;
      }),
    );

    const roadSamplesForEnv = curves.flatMap((c) => c.getSpacedPoints(72));
    const resolveClearEnvPos = (
      rawX: number,
      rawZ: number,
      minSlotDist: number,
      minRoadDist: number,
    ): [number, number] | null => {
      const checkClear = (px: number, pz: number): boolean => {
        if (level.slots.some((sl) => Math.hypot(sl.x - px, sl.z - pz) < minSlotDist)) return false;
        if ((level.barrels ?? []).some((b) => Math.hypot(b.x - px, b.z - pz) < 1.25)) return false;
        if (roadSamplesForEnv.some((pt) => Math.hypot(pt.x - px, pt.z - pz) < minRoadDist)) return false;
        return true;
      };
      if (checkClear(rawX, rawZ)) return [rawX, rawZ];
      const outDir = rawX >= 0 ? 1 : -1;
      for (const shift of [0.55, 0.95]) {
        const nx = Math.max(-5.15, Math.min(5.15, rawX + outDir * shift));
        if (checkClear(nx, rawZ)) return [nx, rawZ];
      }
      return null;
    };

    // Crystals ONLY in Crystal Cavern (12 clusters) and Frosted Peaks (ice-blue clusters) — InstancedMesh
    const rawCrystalCoords: Array<[number, number, number, number]> =
      level.biome === 'cavern'
        ? [
            [-4.2, 5.2, 1.28, 0.2],
            [4.3, 3.8, 1.22, -0.7],
            [-4.4, -5.6, 1.26, 1.1],
            [4.3, -6.0, 1.22, -0.4],
            [-2.8, -8.8, 1.0, 0.5],
            [2.8, -8.8, 1.0, -0.5],
            [4.1, -1.5, 1.15, 0.9],
            [-4.1, 0.5, 1.18, 0.6],
            [4.2, 7.0, 1.15, -0.8],
            [-4.3, 7.4, 1.12, 0.4],
            [-4.1, -2.9, 1.1, -0.3],
            [4.4, 1.1, 1.08, 1.2],
          ]
        : level.biome === 'snow' || level.biome === 'foundry'
          ? [
              [-4.2, 5.2, 0.92, 0.2],
              [4.3, 3.8, 0.9, -0.7],
              [-4.4, -5.6, 0.94, 1.1],
              [4.3, -6.0, 0.9, -0.4],
              [-2.8, -8.8, 0.85, 0.5],
              [2.8, -8.8, 0.85, -0.5],
            ]
          : [];
    const crysMats: THREE.Matrix4[] = [];
    for (const [cx, cz, sc, rot] of rawCrystalCoords) {
      const safe = resolveClearEnvPos(cx, cz, 1.45, 1.3);
      if (safe) crysMats.push(composeMat(safe[0], 0, safe[1], rot, sc, sc, sc));
    }
    if (crysMats.length > 0) {
      this.levelGroup.add(
        buildInstancedModelGroup('env_crystal', crysMats, (origMat, meshName) => {
          if ((level.biome !== 'snow' && level.biome !== 'foundry') || !(origMat instanceof THREE.MeshStandardMaterial)) return origMat;
          const cloned = origMat.clone();
          const isFoundry = level.biome === 'foundry';
          if (meshName.toLowerCase().includes('glow')) {
            cloned.map = null;
            cloned.emissiveMap = null;
            cloned.color.set(isFoundry ? '#ffb559' : '#bceeff');
            cloned.emissive.set(isFoundry ? '#ff5e18' : '#38bdf8');
          } else {
            cloned.color.lerp(new THREE.Color(isFoundry ? '#5c3128' : '#8fe3ff'), 0.45);
          }
          cloned.needsUpdate = true;
          return cloned;
        }),
      );
    }

    // Stone pads (InstancedMesh), batched rune rings/gems, hit areas & oak stumps
    const padMatrices = level.slots.map((s) => composeMat(s.x, 0, s.z, 0, 1, 1, 1));
    this.levelGroup.add(buildInstancedModelGroup('env_slot_pad', padMatrices));

    const runeSlots = level.slots.filter((s) => s.runeSlot);
    if (runeSlots.length > 0) {
      const rGeo = new THREE.RingGeometry(0.58, 0.76, 24);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({ color: '#4ff2ff', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const rInst = new THREE.InstancedMesh(rGeo, rMat, runeSlots.length);
      runeSlots.forEach((s, idx) => rInst.setMatrixAt(idx, composeMat(s.x, 0.055, s.z, 0, 1, 1, 1)));
      rInst.instanceMatrix.needsUpdate = true;
      this.levelGroup.add(rInst);

      const gGeo = new THREE.OctahedronGeometry(0.085, 0);
      const gMat = new THREE.MeshStandardMaterial({ color: '#7ff8ff', emissive: '#22d3ee', emissiveIntensity: 0.95, roughness: 0.2 });
      const gInst = new THREE.InstancedMesh(gGeo, gMat, runeSlots.length * 4);
      let gIdx = 0;
      for (const s of runeSlots) {
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2 + Math.PI / 4;
          gInst.setMatrixAt(gIdx++, composeMat(s.x + Math.cos(a) * 0.68, 0.08, s.z + Math.sin(a) * 0.68, 0, 1, 1, 1));
        }
      }
      gInst.instanceMatrix.needsUpdate = true;
      this.levelGroup.add(gInst);
    }

    for (const s of level.slots) {
      const hitArea = new THREE.Mesh(
        new THREE.CylinderGeometry(0.70, 0.74, 0.14, 16),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitArea.position.set(s.x, 0.07, s.z);
      hitArea.userData = { slotId: s.id };
      this.levelGroup.add(hitArea);
      hitArea.updateMatrixWorld(true);
      hitArea.visible = false;

      let stump: THREE.Group | undefined;
      if (s.lockedByStump) {
        stump = createStumpProp();
        stump.position.set(s.x, 0, s.z);
        this.levelGroup.add(stump);
      }

      const smoke = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 8, 8),
          new THREE.MeshStandardMaterial({ color: '#394048', transparent: true, opacity: 0.82, roughness: 0.95 }),
        );
        puff.position.set((k - 1) * 0.24, 0.95 + (k % 2) * 0.2, 0);
        smoke.add(puff);
      }
      smoke.position.set(s.x, 0, s.z);
      smoke.visible = false;
      this.levelGroup.add(smoke);

      this.slotMeshes.set(s.id, { stump, smoke, hitArea });
    }

    // Explosive Resin Barrels (Canyon biome hazard)
    for (const b of level.barrels ?? []) {
      const bGroup = createExplosiveBarrelProp();
      bGroup.position.set(b.x, 0, b.z);
      this.levelGroup.add(bGroup);

      const bHit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 0.9, 10),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      bHit.position.set(b.x, 0.45, b.z);
      bHit.userData = { barrelId: b.id };
      this.levelGroup.add(bHit);
      bHit.updateMatrixWorld(true);
      bHit.visible = false;

      this.barrelMeshes.set(b.id, { group: bGroup, hitArea: bHit, alive: true });
    }

    // Warm Amber Lanterns casting golden pools onto slate valley floor (InstancedMesh posts + PointLights)
    const lanternMats = level.lanterns.map((lan) =>
      composeMat(lan.x, 0, lan.z, lan.x < 0 ? Math.PI * 0.45 : -Math.PI * 0.45, 1, 1, 1),
    );
    this.levelGroup.add(buildInstancedModelGroup('env_lantern', lanternMats));
    for (const lan of level.lanterns) {
      const light = new THREE.PointLight('#ff9638', 3.4, 7.5);
      light.position.set(lan.x + (lan.x < 0 ? 0.35 : -0.35), 1.15, lan.z);
      light.visible = !this.batterySaver;
      this.levelGroup.add(light);
      this.lanternLights.push(light);
    }

    // Woodland trees (LOD-wrapped with cloned per-biome shared material) & instanced fences (omitted in Crystal Cavern)
    if (level.biome !== 'cavern') {
      const pineAll = level.biome === 'snow' || level.biome === 'foundry';
      const baseTrees: Array<[number, number, number, 'oak' | 'pine']> =
        level.biome === 'canyon' || level.biome === 'foundry'
          ? [
              [-4.7, 7.6, 0.9, 'pine'],
              [4.7, 6.2, 0.85, level.biome === 'foundry' ? 'pine' : 'oak'],
              [-4.8, -3.6, 0.92, 'pine'],
              [4.6, -7.8, 0.95, 'pine'],
            ]
          : [
              [-4.6, 8.2, 1.0, pineAll ? 'pine' : 'oak'],
              [4.7, 7.8, 0.95, 'pine'],
              [-4.9, 3.0, 1.0, 'pine'],
              [4.8, 2.7, 0.92, pineAll ? 'pine' : 'oak'],
              [-4.8, -3.6, 1.0, pineAll ? 'pine' : 'oak'],
              [4.8, -4.5, 0.98, 'pine'],
              [-4.2, -8.2, 1.05, 'pine'],
              [4.2, -8.2, 1.02, pineAll ? 'pine' : 'oak'],
              ...(level.biome === 'forest'
                ? ([
                    [-4.6, 0.4, 0.96, 'oak'],
                    [4.7, -0.8, 0.98, 'pine'],
                    [-4.5, -6.2, 0.94, 'oak'],
                    [4.5, 5.2, 0.96, 'oak'],
                  ] as Array<[number, number, number, 'oak' | 'pine']>)
                : []),
            ];
      const variantMatCache = new Map<'oak' | 'pine', THREE.Material>();
      for (let i = 0; i < baseTrees.length; i++) {
        const [rawTx, rawTz, sc, variant] = baseTrees[i];
        const safeTree = resolveClearEnvPos(rawTx, rawTz, 1.45, 1.35);
        if (!safeTree) continue;
        const [tx, tz] = safeTree;
        const tree = createTreeProp(sc, variant);
        if (theme.canopyTint !== '#ffffff') {
          tree.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
            let shared = variantMatCache.get(variant);
            if (!shared) {
              const cloned = mesh.material.clone();
              cloned.color.lerp(new THREE.Color(theme.canopyTint), level.biome === 'snow' ? 0.55 : 0.45);
              cloned.needsUpdate = true;
              shared = cloned;
              variantMatCache.set(variant, shared);
            }
            mesh.material = shared;
          });
        }
        const proxyCol =
          theme.canopyTint !== '#ffffff'
            ? theme.canopyTint
            : variant === 'pine'
              ? '#3f844b'
              : '#5aa650';
        const lod = createPropLOD(tree, proxyCol, 0.85 * sc, 2.4 * sc, this.batterySaver ? 14 : 22);
        lod.position.set(tx, 0, tz);
        lod.rotation.y = i * 0.9;
        this.levelGroup.add(lod);
        this.lodTrees.push({ lod, phase: i * 1.1 });
      }

      const fencePositions: Array<[number, number, number]> = [
        [-1.75, 8.2, 0.15],
        [1.75, 8.2, -0.15],
        [4.25, 0.1, 1.55],
        [-4.25, 1.2, 1.55],
        [2.25, -7.2, -0.35],
        [-2.1, -7.8, 0.35],
      ];
      const pathSamplesForFence = curves.flatMap((c) => c.getSpacedPoints(50));
      const activeFences = level.biome === 'canyon' ? fencePositions.slice(0, 3) : fencePositions;
      const fenceMats: THREE.Matrix4[] = [];
      for (const [fx, fz, rot] of activeFences) {
        const tooCloseToSlot = level.slots.some((sl) => Math.hypot(sl.x - fx, sl.z - fz) < 1.55);
        const tooCloseToRoad = pathSamplesForFence.some((pt) => Math.hypot(pt.x - fx, pt.z - fz) < 1.22);
        if (tooCloseToSlot || tooCloseToRoad) continue;
        fenceMats.push(composeMat(fx, 0, fz, rot, 1, 1, 1));
      }
      if (fenceMats.length > 0) {
        this.levelGroup.add(buildInstancedModelGroup('env_fence', fenceMats));
      }
    }

    this.ambientMotes = buildAmbientMotes(level.biome);
    this.levelGroup.add(this.ambientMotes.mesh);

    const conceptFx = buildStageConcept(level, curves);
    this.levelGroup.add(conceptFx.group);
    this.stageAnimatedProps = conceptFx.animatedProps;
    this.stagePulseMats = conceptFx.pulseMats;

    const heroVariant = resolveHeroVisualVariant(heroClass, 1);
    this.heroVisualKey = `${heroId}_${heroVariant}_${equippedHat}`;
    this.heroRig = createHeroRig(heroId, equippedHat, heroVariant);
    this.heroRig.root.position.set(level.heroStart.x, 0, level.heroStart.z);
    if (equippedAura !== 'none') {
      this.heroAuraGroup = this.buildAuraRingGroup(equippedAura, 0.72);
      this.heroRig.root.add(this.heroAuraGroup);
      this.heroAuraKey = equippedAura;
    } else {
      this.heroAuraGroup = null;
      this.heroAuraKey = 'none';
    }
    this.dynamicGroup.add(this.heroRig.root);

    if (import.meta.env.DEV) {
      const stats = countDrawCalls(this.levelGroup);
      console.info(
        `[drawcall] level=${level.id} meshes=${stats.meshes} materials=${stats.materials} estimated=${stats.estimatedDrawCalls}`,
      );
    }
  }

  private clearLevel(): void {
    this.activeLevel = null;
    for (const fx of this.skillEffects) fx.dispose();
    this.skillEffects = [];
    this.magnetTimer = 0;
    this.targetingReticle.visible = false;
    this.levelGroup.clear();
    this.dynamicGroup.clear();
    this.slotMeshes.clear();
    this.barrelMeshes.clear();
    this.stageAnimatedProps = [];
    this.stagePulseMats = [];
    this.ambientMotes = null;
    this.lanternLights = [];
    this.castleBannerClothes = [];
    this.heroAuraGroup = null;
    this.heroAuraKey = 'none';
    this.towerRigs.clear();
    this.enemyRigs.clear();
    this.projectileMeshes.clear();
    this.poolMeshes = [];
    this.lodTrees = [];
    this.shockRings = [];
    this.energyBeams = [];
    this.muzzleFlashes = [];
    this.dyingBodies = [];
    this.heroRig = null;
    this.heroVisualKey = '';
    this.rangeRing.visible = false;
    this.enemyFeel.clear();
    this.towerPunch.clear();
    for (const s of this.sparks) {
      s.active = false;
      s.mesh.visible = false;
    }
    for (const d of this.scorches) {
      d.active = false;
      d.mesh.visible = false;
    }
    for (const tr of this.trails) {
      tr.active = false;
      tr.fading = false;
      tr.mesh.visible = false;
    }
  }

  sync(
    sim: SimulationEngine,
    selectedSlotId: string | null,
    equippedHat: HatId,
    realDt: number,
    simDt: number,
    previewTowerId: TowerId | null = null,
    equippedAura: AuraId = 'none',
  ): void {
    this.animTime += realDt;
    for (let i = 0; i < this.castleBannerClothes.length; i++) {
      this.castleBannerClothes[i].rotation.x = Math.sin(this.animTime * 2.6 + i * 0.9) * 0.11;
      this.castleBannerClothes[i].rotation.z = Math.cos(this.animTime * 1.9 + i) * 0.045;
    }
    this.lastSim = sim;
    this.monitorFps(realDt);
    this.cameraCtrl.update(realDt);

    for (const t of this.lodTrees) {
      t.lod.rotation.z = Math.sin(this.animTime * 1.3 + t.phase) * 0.018;
      t.lod.update(this.cameraCtrl.camera);
    }

    // Sync slots & towers
    for (const slot of sim.slots.values()) {
      const slotVisual = this.slotMeshes.get(slot.id);
      if (slotVisual?.stump) slotVisual.stump.visible = slot.stumpLocked;
      if (slotVisual?.smoke) {
        slotVisual.smoke.visible = Boolean(slot.tower && slot.tower.smokedTimer > 0);
        if (slotVisual.smoke.visible) slotVisual.smoke.rotation.y += realDt * 1.4;
      }

      const existing = this.towerRigs.get(slot.id);
      if (!slot.tower) {
        if (existing) {
          this.dynamicGroup.remove(existing.rig.root);
          this.towerRigs.delete(slot.id);
        }
        continue;
      }

      const desiredKey = `${slot.tower.towerId}_${slot.tower.tier}_${slot.tower.branchId ?? ''}_${equippedHat}_${equippedAura}`;
      if (!existing || existing.key !== desiredKey) {
        if (existing) this.dynamicGroup.remove(existing.rig.root);
        const rig = createTowerRig(slot.tower.towerId, slot.tower.tier, slot.tower.branchId, equippedHat, true);
        if (equippedAura !== 'none' && slot.tower.tier === 3) {
          const tAura = this.buildAuraRingGroup(equippedAura, 0.78);
          tAura.name = 'TowerTier3Aura';
          rig.root.add(tAura);
        }
        rig.root.position.set(slot.x, 0, slot.z);
        this.dynamicGroup.add(rig.root);
        this.towerRigs.set(slot.id, { key: desiredKey, rig });
      }
      const rigRef = this.towerRigs.get(slot.id)!.rig;
      const tAuraNode = rigRef.root.getObjectByName('TowerTier3Aura');
      if (tAuraNode) tAuraNode.rotation.y = this.animTime * 1.35;
      rigRef.turretHead.rotation.y = slot.tower.angle;
      updateTowerAnimation(rigRef, this.animTime, realDt);

      // Defender recoil kick: keep stone tower base fixed on slot pad and tilt/dip upper turret only
      rigRef.root.position.set(slot.x, 0, slot.z);
      const punch = this.towerPunch.get(slot.id);
      if (punch) {
        punch.elapsed += realDt;
        const dur = 0.16;
        if (punch.elapsed >= dur) {
          this.towerPunch.delete(slot.id);
          rigRef.turretHead.rotation.x = 0;
          rigRef.turretHead.position.y = rigRef.baseTurretY;
        } else {
          const j = evalHitJolt(punch.elapsed, dur);
          const s = this.reducedMotion ? 0.5 : 1;
          rigRef.turretHead.rotation.x = -0.16 * j.push * s;
          rigRef.turretHead.position.y = rigRef.baseTurretY - 0.03 * j.push * s;
        }
      } else {
        rigRef.turretHead.rotation.x = 0;
        rigRef.turretHead.position.y = rigRef.baseTurretY;
      }
    }

    for (const [bId, bv] of this.barrelMeshes.entries()) {
      const bState = sim.barrels.get(bId);
      const alive = Boolean(bState && !bState.exploded);
      bv.alive = alive;
      bv.group.visible = alive;
      bv.hitArea.visible = false;
      if (alive) {
        const spark = bv.group.children[bv.group.children.length - 1];
        if (spark) spark.rotation.y = this.animTime * 4.5;
      }
    }

    const selectedSlot = selectedSlotId ? sim.slots.get(selectedSlotId) : null;
    const selectedTower = selectedSlot?.tower ?? null;
    const rangeRingMat = this.rangeRing.material as THREE.MeshBasicMaterial;
    if (selectedTower) {
      const stats = sim.getTowerStats(selectedTower);
      this.rangeRing.visible = true;
      this.rangeRing.position.set(selectedTower.x, 0.07, selectedTower.z);
      this.rangeRing.scale.setScalar(stats.range);
      rangeRingMat.color.set('#ffd966');
      rangeRingMat.opacity = 0.88;
    } else if (selectedSlot && !selectedSlot.stumpLocked) {
      const r = previewTowerId ? TOWERS[previewTowerId].tier1.range : 7.0;
      this.rangeRing.visible = true;
      this.rangeRing.position.set(selectedSlot.x, 0.07, selectedSlot.z);
      this.rangeRing.scale.setScalar(r);
      rangeRingMat.color.set(previewTowerId ? this.getTowerColorPreview(previewTowerId) : '#7fe8ff');
      rangeRingMat.opacity = previewTowerId ? 0.9 : 0.55;
    } else {
      this.rangeRing.visible = false;
    }

    // Sync Active Hero (supports multi-hero switching + auto-evolution by level)
    const wantHeroVariant = resolveHeroVisualVariant(sim.heroClass, sim.hero.level);
    const wantHeroKey = `${sim.heroId}_${wantHeroVariant}_${equippedHat}`;
    if (this.heroRig && wantHeroKey !== this.heroVisualKey) {
      const prevRotY = this.heroRig.body.rotation.y;
      const prevPos = this.heroRig.root.position.clone();
      this.dynamicGroup.remove(this.heroRig.root);
      this.heroRig = createHeroRig(sim.heroId, equippedHat, wantHeroVariant);
      this.heroRig.root.position.copy(prevPos);
      this.heroRig.body.rotation.y = prevRotY;
      this.heroAuraGroup = null;
      this.heroAuraKey = 'none';
      this.dynamicGroup.add(this.heroRig.root);
      this.heroVisualKey = wantHeroKey;
    }
    if (this.heroRig) {
      if (this.heroAuraKey !== equippedAura) {
        if (this.heroAuraGroup) {
          this.heroRig.root.remove(this.heroAuraGroup);
          this.heroAuraGroup = null;
        }
        if (equippedAura !== 'none') {
          this.heroAuraGroup = this.buildAuraRingGroup(equippedAura, 0.72);
          this.heroRig.root.add(this.heroAuraGroup);
        }
        this.heroAuraKey = equippedAura;
      }
      if (this.heroAuraGroup) {
        this.heroAuraGroup.rotation.y = -this.animTime * 1.65;
      }
      this.heroRig.root.visible = !sim.hero.dead;
      this.heroRig.root.position.set(sim.hero.x, 0, sim.hero.z);
      this.heroRig.root.scale.setScalar(sim.relics.includes('giant_hero') ? 1.22 : 1.0);
      this.heroRig.body.rotation.y = sim.hero.facingAngle;
      const ringMat = this.heroRig.ring.material as THREE.MeshBasicMaterial;
      if (sim.hero.activeBuff === 'banner') {
        ringMat.color.set('#ffd454');
        ringMat.opacity = 0.72 + Math.sin(this.animTime * 6) * 0.18;
        this.heroRig.ring.scale.setScalar(6.4);
      } else if (sim.hero.alchemyAuraTimer > 0) {
        ringMat.color.set('#44f0a6');
        ringMat.opacity = 0.65 + Math.sin(this.animTime * 6) * 0.16;
        this.heroRig.ring.scale.setScalar(8.4);
      } else if (sim.hero.activeBuff === 'ironhide') {
        ringMat.color.set('#e8a848');
        ringMat.opacity = 0.92;
        this.heroRig.ring.scale.setScalar(1.45 + Math.sin(this.animTime * 9) * 0.12);
      } else if (sim.hero.activeBuff === 'berserk') {
        ringMat.color.set('#ff6b3d');
        ringMat.opacity = 0.92;
        this.heroRig.ring.scale.setScalar(1.32 + Math.sin(this.animTime * 10) * 0.12);
      } else {
        ringMat.color.set('#7eed87');
        ringMat.opacity = 0.9;
        this.heroRig.ring.scale.setScalar(1.0);
      }
      updateHeroAnimation(this.heroRig, sim.hero.moving, this.animTime, realDt);
    }

    if (this.rallyShowTimer > 0) this.rallyShowTimer = Math.max(0, this.rallyShowTimer - realDt);
    const rallyDist = Math.hypot(sim.hero.targetX - sim.hero.x, sim.hero.targetZ - sim.hero.z);
    this.rallyMarker.visible = !sim.hero.dead && (rallyDist > 0.45 || this.rallyShowTimer > 0);
    if (this.rallyMarker.visible) {
      this.rallyMarker.position.set(sim.hero.targetX, 0.01, sim.hero.targetZ);
    }

    // Sync skeletal-animated Scrap-Bot enemies + hit flinch + flash
    const aliveIds = new Set<number>();
    for (const e of sim.enemies) {
      aliveIds.add(e.uid);
      let rig = this.enemyRigs.get(e.uid);
      if (!rig) {
        rig = createEnemyRig(e.enemyId);
        this.dynamicGroup.add(rig.root);
        this.enemyRigs.set(e.uid, rig);
      }
      const feel = this.getEnemyFeel(e.uid, rig);
      const activePath = e.lane === 1 && sim.level.secondaryPath ? sim.level.secondaryPath : sim.level.path;
      const nextWp = activePath[e.wpIndex];
      if (nextWp) {
        rig.body.rotation.y = Math.atan2(nextWp.x - e.x, nextWp.z - e.z);
      }
      const walkDt = e.engagedByHero || e.stunTimer > 0 ? 0 : simDt;
      updateEnemyAnimation(rig, this.animTime, walkDt, realDt, e.uid, e.engagedByHero);

      // Directional knockback + backward pitch snap/wobble applied on the root (render-only)
      feel.joltElapsed += realDt;
      const jolt = evalHitJolt(feel.joltElapsed, HIT_JOLT_DURATION);
      rig.root.position.set(e.x + feel.kx * jolt.push, 0, e.z + feel.kz * jolt.push);
      if (jolt.tilt !== 0 && feel.tilt !== 0) {
        rig.root.quaternion.setFromAxisAngle(feel.axis, feel.tilt * jolt.tilt);
      } else if (rig.root.quaternion.w !== 1) {
        rig.root.quaternion.identity();
      }

      // Contrast-punched hit flash (suppresses map albedo + drives ACES-visible emissive tint, WCAG 2.3.1 rate-limited)
      feel.flashElapsed += realDt;
      const fs = hitFlashStrength(feel.flashElapsed, feel.flashDur);
      if (fs > 0) {
        for (const b of feel.bases) {
          b.mat.color.copy(b.color).multiplyScalar(1 - feel.flashDarken * fs);
          b.mat.emissive.copy(feel.flashTint);
          b.mat.emissiveIntensity = feel.flashEmissivePeak * fs;
        }
        feel.visual = 'flash';
      } else if (e.stunTimer > 0 || e.slowTimer > 0) {
        const frozen = e.stunTimer > 0;
        const want = frozen ? 'frozen' : 'slow';
        if (feel.visual !== want) {
          for (const b of feel.bases) {
            b.mat.color.copy(b.color);
            if (frozen) b.mat.color.lerp(FROZEN_TINT, 0.35);
            b.mat.emissive.copy(frozen ? FROZEN_TINT : SLOW_TINT);
            b.mat.emissiveIntensity = frozen ? 0.5 : 0.28;
          }
          feel.visual = want;
        }
      } else if (feel.visual !== 'rest') {
        restoreMaterials(feel.bases);
        feel.visual = 'rest';
      }
    }

    // Detach killed enemy body for a parabolic 0.42s knockback tumble death pop!
    for (const [uid, rig] of this.enemyRigs.entries()) {
      if (!aliveIds.has(uid)) {
        const feel = this.enemyFeel.get(uid);
        const hdx = feel?.lastHitDirX ?? 0;
        const hdz = feel?.lastHitDirZ ?? 1;
        const hlen = Math.hypot(hdx, hdz) || 1;
        const vx = (hdx / hlen) * 3.4;
        const vz = (hdz / hlen) * 3.4;
        rig.root.remove(rig.body);
        rig.body.position.set(rig.root.position.x, 0.35, rig.root.position.z);
        this.dynamicGroup.add(rig.body);
        this.dyingBodies.push({
          group: rig.body,
          life: 0.42,
          maxLife: 0.42,
          vx,
          vy: ENEMIES[rig.enemyId].isBoss ? 2.4 : 4.2,
          vz,
          spinX: (uid % 2 === 0 ? 1 : -1) * 10.5,
          spinZ: (uid % 3 === 0 ? 1 : -1) * 8.5,
          bases: feel?.bases ?? [],
          elapsed: 0,
        });
        this.dynamicGroup.remove(rig.root);
        this.enemyRigs.delete(uid);
        this.enemyFeel.delete(uid);
      }
    }

    // Sync projectiles + characteristic silhouettes & wake trails
    const projIds = new Set<number>();
    for (const p of sim.projectiles) {
      projIds.add(p.uid);
      let entry = this.projectileMeshes.get(p.uid);
      if (!entry) {
        const isMortar = Boolean(p.stats.aoeRadius);
        let mesh: THREE.Object3D;
        let mortarRing: THREE.Mesh | undefined;
        if (isMortar) {
          const shellGroup = new THREE.Group();
          const mortarShellCol =
            p.towerId === 'badger'
              ? p.branchId === 'badger_inferno'
                ? '#ff7a24'
                : '#35e87a'
              : p.towerId === 'tortoise'
                ? '#d49d35'
                : '#ff8e3c';
          const pinecone = new THREE.Mesh(
            new THREE.DodecahedronGeometry(p.towerId === 'tortoise' ? 0.32 : 0.28, 0),
            new THREE.MeshStandardMaterial({
              color: p.towerId === 'badger' ? '#2c4a3e' : '#6b3e24',
              roughness: 0.52,
              metalness: p.towerId === 'tortoise' ? 0.55 : 0.18,
            }),
          );
          const coreGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 10, 8),
            new THREE.MeshBasicMaterial({ color: mortarShellCol, toneMapped: false }),
          );
          coreGlow.position.y = 0.14;
          shellGroup.add(pinecone, coreGlow);
          mesh = shellGroup;

          const r = Math.max(1.2, p.stats.aoeRadius ?? 2.2);
          mortarRing = new THREE.Mesh(
            new THREE.RingGeometry(r * 0.88, r * 0.98, 24),
            new THREE.MeshBasicMaterial({
              color: mortarShellCol,
              transparent: true,
              opacity: 0.42,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          mortarRing.rotation.x = -Math.PI / 2;
          mortarRing.position.set(p.targetX, 0.068, p.targetZ);
          this.dynamicGroup.add(mortarRing);
        } else if (p.towerId === 'owl' || p.towerId === 'lynx') {
          const orbGroup = new THREE.Group();
          const boltCol =
            p.towerId === 'lynx'
              ? p.branchId === 'lynx_frostbite'
                ? '#7ef5ff'
                : '#be75ff'
              : p.branchId === 'owl_glacier'
                ? '#c8f8ff'
                : '#6be8ff';
          const orb = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.MeshBasicMaterial({
              color: boltCol,
              toneMapped: false,
            }),
          );
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.19, 0.025, 6, 14),
            new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
          );
          orbGroup.add(orb, halo);
          mesh = orbGroup;
        } else if (p.towerId === 'hedgehog' || p.towerId === 'falcon') {
          const boltGroup = new THREE.Group();
          const isFalcon = p.towerId === 'falcon';
          const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(isFalcon ? 0.045 : 0.055, isFalcon ? 0.065 : 0.08, 0.82, 7),
            new THREE.MeshStandardMaterial({
              color: isFalcon ? '#4be8ff' : '#ffbe4d',
              emissive: new THREE.Color(isFalcon ? '#25bfff' : '#ffa22b'),
              emissiveIntensity: 1.5,
              roughness: 0.28,
            }),
          );
          shaft.rotation.x = Math.PI / 2;
          const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.085, 0.22, 7),
            new THREE.MeshBasicMaterial({ color: isFalcon ? '#e3fbff' : '#fff3ba', toneMapped: false }),
          );
          tip.rotation.x = Math.PI / 2;
          tip.position.z = 0.46;
          boltGroup.add(shaft, tip);
          mesh = boltGroup;
        } else {
          const nutGroup = new THREE.Group();
          const nut = new THREE.Mesh(
            new THREE.SphereGeometry(0.125, 10, 8),
            new THREE.MeshStandardMaterial({
              color: '#ffe066',
              emissive: new THREE.Color('#ffaa22'),
              emissiveIntensity: 1.4,
              roughness: 0.3,
            }),
          );
          nut.scale.set(1, 0.92, 1.32);
          const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
            new THREE.MeshStandardMaterial({ color: '#8f552e', roughness: 0.65 }),
          );
          cap.rotation.x = -Math.PI * 0.5;
          cap.position.z = -0.02;
          nutGroup.add(nut, cap);
          mesh = nutGroup;
        }

        this.dynamicGroup.add(mesh);
        const trailColor = isMortar
          ? p.towerId === 'badger'
            ? p.branchId === 'badger_inferno'
              ? '#ff7a24'
              : '#3bf284'
            : p.towerId === 'tortoise'
              ? '#f0b844'
              : '#ff8a2a'
          : p.towerId === 'owl'
            ? p.branchId === 'owl_glacier'
              ? '#a8f0ff'
              : '#45d8ff'
            : p.towerId === 'lynx'
              ? p.branchId === 'lynx_frostbite'
                ? '#78f2ff'
                : '#b872ff'
              : p.towerId === 'falcon'
                ? '#4fe8ff'
                : p.towerId === 'hedgehog'
                  ? '#ffb238'
                  : '#ffd84a';
        const trail = this.acquireTrail(trailColor, isMortar ? 0.22 : p.towerId === 'hedgehog' ? 0.16 : 0.12);
        const ddx = p.targetX - p.x;
        const ddz = p.targetZ - p.z;
        const totalDist = Math.max(0.5, Math.hypot(ddx, ddz));
        entry = {
          mesh,
          mortar: isMortar
            ? {
                startX: p.x,
                startZ: p.z,
                targetX: p.targetX,
                targetZ: p.targetZ,
                totalDist,
                smokeAccum: 0,
                ring: mortarRing,
              }
            : undefined,
          trail,
          startX: p.x,
          startZ: p.z,
          totalDist,
          targetUid: p.targetUid,
          towerId: p.towerId,
          branchId: p.branchId,
          dirX: ddx / totalDist,
          dirZ: ddz / totalDist,
          aoeRadius: p.stats.aoeRadius ?? 0,
        };
        this.projectileMeshes.set(p.uid, entry);
      }

      const vdx = p.targetX - p.x;
      const vdz = p.targetZ - p.z;
      const vlen = Math.hypot(vdx, vdz);
      if (vlen > 1e-4) {
        entry.dirX = vdx / vlen;
        entry.dirZ = vdz / vlen;
      }

      const u = Math.max(0, Math.min(1, 1 - vlen / entry.totalDist));
      if (entry.mortar) {
        const arcY = 1.2 + Math.sin(u * Math.PI) * 2.55;
        entry.mesh.position.set(p.x, arcY, p.z);
        entry.mesh.rotation.x += realDt * 12;
        entry.mortar.smokeAccum += realDt;
        if (entry.mortar.smokeAccum >= 0.045) {
          entry.mortar.smokeAccum = 0;
          const wakeCol =
            p.towerId === 'badger'
              ? p.branchId === 'badger_inferno'
                ? '#ff7828'
                : '#4cf596'
              : p.towerId === 'tortoise'
                ? '#d4a259'
                : '#ffb86c';
          this.spawnParticles(p.x, arcY, p.z, wakeCol, 1, 0.35);
        }
      } else {
        const heightY = 1.36 + (0.78 - 1.36) * u;
        entry.mesh.position.set(p.x, heightY, p.z);
        if (p.towerId === 'owl' || p.towerId === 'lynx') {
          entry.mesh.rotation.y += realDt * (p.towerId === 'lynx' ? 18 : 14);
          entry.mesh.rotation.x += realDt * 10;
        } else {
          entry.mesh.lookAt(p.targetX, 0.72, p.targetZ);
        }
      }
      if (entry.trail) {
        pushTrailPoint(entry.trail, entry.mesh.position.x, entry.mesh.position.y, entry.mesh.position.z);
        rebuildTrail(entry.trail);
      }
    }
    for (const [uid, entry] of this.projectileMeshes.entries()) {
      if (!projIds.has(uid)) {
        if (entry.mortar?.ring) {
          this.dynamicGroup.remove(entry.mortar.ring);
          entry.mortar.ring.geometry.dispose();
          (entry.mortar.ring.material as THREE.Material).dispose();
        }
        if (entry.trail) {
          entry.trail.fading = true;
        }
        entry.mesh.traverse((obj) => {
          if (!(obj as THREE.Mesh).isMesh) return;
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat?.dispose();
        });
        this.dynamicGroup.remove(entry.mesh);
        this.projectileMeshes.delete(uid);
      }
    }

    // Sync elemental pools (resin amber / alchemy acid / inferno magma) with pulsing rim & rising bubbles
    while (this.poolMeshes.length < sim.resinPools.length) {
      const group = new THREE.Group();
      const fillMat = new THREE.MeshBasicMaterial({
        color: '#e69b35',
        transparent: true,
        opacity: 0.44,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const fill = new THREE.Mesh(this.poolFillGeo, fillMat);
      fill.rotation.x = -Math.PI / 2;
      const rimMat = new THREE.MeshBasicMaterial({
        color: '#ffd27a',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const rim = new THREE.Mesh(this.poolRimGeo, rimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.004;
      group.add(fill, rim);
      group.position.y = 0.058;
      this.dynamicGroup.add(group);
      this.poolMeshes.push({ group, fillMat, rimMat });
    }
    for (let i = 0; i < this.poolMeshes.length; i++) {
      const pool: ResinPool | undefined = sim.resinPools[i];
      const pm = this.poolMeshes[i];
      pm.group.visible = Boolean(pool);
      if (pool) {
        const kind = pool.kind ?? 'resin';
        const pulse = Math.sin(this.animTime * 6 + i * 1.3);
        if (kind === 'acid') {
          pm.fillMat.color.set('#22d970');
          pm.rimMat.color.set('#80ffb8');
          pm.fillMat.opacity = 0.46 + pulse * 0.08;
        } else if (kind === 'inferno') {
          pm.fillMat.color.set('#ff5218');
          pm.rimMat.color.set('#ffc14d');
          pm.fillMat.opacity = 0.50 + pulse * 0.10;
        } else {
          pm.fillMat.color.set('#e69b35');
          pm.rimMat.color.set('#ffd27a');
          pm.fillMat.opacity = 0.44 + pulse * 0.06;
        }
        const fade = Math.min(1, pool.timer / 0.45);
        pm.fillMat.opacity *= fade;
        pm.rimMat.opacity = 0.72 * fade;
        pm.group.position.set(pool.x, 0.058, pool.z);
        pm.group.scale.setScalar(pool.radius * (0.97 + pulse * 0.03));
        if (!this.reducedMotion && kind !== 'resin' && Math.random() < realDt * 4.5) {
          const ang = Math.random() * Math.PI * 2;
          const rr = Math.random() * pool.radius * 0.75;
          const bCol = kind === 'acid' ? '#70ffb2' : '#ff9838';
          this.spawnParticles(pool.x + Math.cos(ang) * rr, 0.14, pool.z + Math.sin(ang) * rr, bCol, 1, 0.55);
        }
      }
    }

    if (!this.reducedMotion) {
      for (const ap of this.stageAnimatedProps) {
        if (ap.axis === 'x') ap.obj.rotation.x += realDt * ap.speed;
        else if (ap.axis === 'y') ap.obj.rotation.y += realDt * ap.speed;
        else ap.obj.rotation.z += realDt * ap.speed;
      }
      for (const pm of this.stagePulseMats) {
        pm.mat.emissiveIntensity = pm.base + Math.sin(this.animTime * pm.speed) * pm.amp;
      }
    }

    this.updateEffects(realDt);
    if (this.usePostProcessing && !this.bloomDisabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.cameraCtrl.camera);
    }
  }

  private getEnemyFeel(uid: number, rig: EnemyRig): EnemyFeel {
    let feel = this.enemyFeel.get(uid);
    if (!feel) {
      const seen = new Set<THREE.MeshStandardMaterial>();
      const bases: MaterialBase[] = [];
      for (const m of rig.flashMaterials) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        bases.push({ mat: m, color: m.color.clone(), emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity });
      }
      feel = {
        bases,
        flashElapsed: 1,
        flashDur: HIT_FLASH_DURATION,
        flashTint: WHITE.clone(),
        flashEmissivePeak: HIT_FLASH_EMISSIVE,
        flashDarken: 0.88,
        lastFullFlashAt: -10,
        joltElapsed: 1,
        kx: 0,
        kz: 0,
        tilt: 0,
        axis: new THREE.Vector3(1, 0, 0),
        lastHitDirX: 0,
        lastHitDirZ: 1,
        visual: 'rest',
      };
      this.enemyFeel.set(uid, feel);
    }
    return feel;
  }

  handleSimEvents(events: SimEvent[], sim?: SimulationEngine): void {
    const simRef = sim ?? this.lastSim;

    // Instant chain/line hits emit ENEMY_HIT before TOWER_FIRED: pre-scan beam directions.
    const beamDirs = new Map<number, { dx: number; dz: number; heavy: boolean }>();
    const enemyPos = (uid: number): { x: number; z: number } | null => {
      const e = simRef?.enemies.find((en) => en.uid === uid);
      return e ? { x: e.x, z: e.z } : null;
    };
    for (const ev of events) {
      if (ev.type !== 'TOWER_FIRED' || (!ev.isChain && !ev.isLine)) continue;
      let px = ev.fromX;
      let pz = ev.fromZ;
      for (const id of ev.targetIds) {
        if (ev.isLine) {
          beamDirs.set(id, { dx: ev.toX - ev.fromX, dz: ev.toZ - ev.fromZ, heavy: true });
        } else {
          const pos = enemyPos(id) ?? { x: ev.toX, z: ev.toZ };
          beamDirs.set(id, { dx: pos.x - px, dz: pos.z - pz, heavy: false });
          px = pos.x;
          pz = pos.z;
        }
      }
    }

    for (const ev of events) {
      if (ev.type === 'TOWER_BUILT') {
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 1.1, 0.18);
        this.spawnShockRing(ev.x, ev.z, '#f7e097', 1.8);
        this.spawnParticles(ev.x, 0.35, ev.z, '#e8dbc3', 10, 0.9);
        this.spawnSparks(ev.x, 0.4, ev.z, 0, 0, 0, '#ffe9a8', 8, 5);
        this.cameraCtrl.addTrauma(0.14);
      } else if (ev.type === 'TOWER_UPGRADED') {
        const rigRef = this.towerRigs.get(ev.slotId)?.rig;
        if (rigRef) {
          this.spawnShockRing(rigRef.root.position.x, rigRef.root.position.z, '#ffffff', 1.2, 0.18);
          this.spawnShockRing(rigRef.root.position.x, rigRef.root.position.z, '#7cf08b', 2.0);
          this.spawnParticles(rigRef.root.position.x, 0.85, rigRef.root.position.z, '#ffe066', 14, 1.1);
          this.spawnSparks(rigRef.root.position.x, 0.9, rigRef.root.position.z, 0, 0, 0, '#c6ff9e', 12, 6);
        }
        this.cameraCtrl.addTrauma(0.2);
      } else if (ev.type === 'STUMP_CLEARED') {
        const st = simRef?.slots.get(ev.slotId);
        if (st) {
          this.spawnShockRing(st.x, st.z, '#ffd966', 1.9, 0.34);
          this.spawnParticles(st.x, 0.35, st.z, '#7a4f2d', 12, 1.1);
          this.spawnSparks(st.x, 0.4, st.z, 0, 0, 0, '#ffe49e', 10, 6);
          this.cameraCtrl.addTrauma(0.22);
        }
      } else if (ev.type === 'SMOKE_CLEARED') {
        const st = simRef?.slots.get(ev.slotId);
        if (st) {
          this.spawnShockRing(st.x, st.z, '#9ef3ff', 2.0, 0.35);
          this.spawnSparks(st.x, 0.85, st.z, 0, 0, 0, '#e3fbff', 10, 5.5);
        }
      } else if (ev.type === 'TOWER_SOLD') {
        const st = simRef?.slots.get(ev.slotId);
        if (st) {
          this.spawnFlyingCoins(st.x, st.z, 4);
          this.spawnShockRing(st.x, st.z, '#ffd966', 1.4, 0.28);
        }
      } else if (ev.type === 'TOWER_FIRED') {
        const dirX = ev.toX - ev.fromX;
        const dirZ = ev.toZ - ev.fromZ;
        const len = Math.hypot(dirX, dirZ) || 1;
        const ux = dirX / len;
        const uz = dirZ / len;
        const rigRef = this.towerRigs.get(ev.slotId)?.rig;
        if (rigRef) {
          triggerTowerRecoil(rigRef);
          this.towerPunch.set(ev.slotId, { elapsed: 0, dirX: ux, dirZ: uz });
          const flashCol =
            ev.towerId === 'owl' || ev.towerId === 'falcon'
              ? '#68ebff'
              : ev.towerId === 'badger'
                ? '#4cf58d'
                : ev.towerId === 'lynx'
                  ? '#be78ff'
                  : ev.towerId === 'beaver' || ev.towerId === 'tortoise'
                    ? '#ff9f38'
                    : ev.towerId === 'hedgehog'
                      ? '#ffc04a'
                      : '#ffe47a';
          const big = ev.towerId === 'beaver' || ev.towerId === 'badger' || ev.towerId === 'tortoise' || Boolean(ev.isLine);
          const mx = ev.fromX + ux * 0.55;
          const mz = ev.fromZ + uz * 0.55;
          this.spawnMuzzleFlash(mx, 1.45, mz, flashCol, ux, uz, big);
          if (ev.towerId === 'tortoise') {
            this.spawnShockRing(mx, mz, '#ffd166', 0.9, 0.16, 1.25);
          } else if (ev.towerId === 'falcon') {
            this.spawnSparks(mx, 1.45, mz, ux, 0.1, uz, '#9beeff', 4, 7.5, 0.3);
          } else if (ev.towerId === 'lynx') {
            this.spawnShockRing(mx, mz, '#c98aff', 0.65, 0.14, 1.35);
          }
        }

        if (ev.isChain || ev.isLine) {
          const pts: THREE.Vector3[] = [new THREE.Vector3(ev.fromX, 1.42, ev.fromZ)];
          if (ev.isChain) {
            let prev = pts[0];
            for (const id of ev.targetIds) {
              const pos = enemyPos(id) ?? { x: ev.toX, z: ev.toZ };
              const midX = (prev.x + pos.x) * 0.5 + (Math.random() - 0.5) * 0.6;
              const midZ = (prev.z + pos.z) * 0.5 + (Math.random() - 0.5) * 0.6;
              pts.push(new THREE.Vector3(midX, 1.0 + Math.random() * 0.35, midZ));
              const hitPt = new THREE.Vector3(pos.x, 0.75, pos.z);
              pts.push(hitPt);
              prev = hitPt;
              this.spawnSparks(pos.x, 0.8, pos.z, 0, 0, 0, '#9ff3ff', 8, 7);
              this.spawnShockRing(pos.x, pos.z, '#7fe9ff', 1.0, 0.22);
            }
            if (pts.length === 1) pts.push(new THREE.Vector3(ev.toX, 0.65, ev.toZ));
            this.spawnEnergyBeam(pts, '#5ce1ff', 0.085, 0.2);
            this.spawnEnergyBeam(pts, '#ffffff', 0.032, 0.13);
            this.onChainZap?.();
          } else {
            pts.push(new THREE.Vector3(ev.toX, 0.65, ev.toZ));
            this.spawnEnergyBeam(pts, '#ffb43c', 0.1, 0.22);
            this.spawnEnergyBeam(pts, '#ffffff', 0.04, 0.14);
            for (const id of ev.targetIds) {
              const pos = enemyPos(id);
              if (pos) this.spawnImpactBurst(pos.x, 0.85, pos.z, '#ffd27a', 1.15, ux, uz);
            }
            this.cameraCtrl.addTrauma(0.2);
            this.cameraCtrl.addDirectionalKick(ux, uz, 0.1);
            this.onRailgunFire?.();
          }
        }
      } else if (ev.type === 'PROJECTILE_IMPACT') {
        if (ev.aoeRadius > 0) {
          const r = Math.max(1.2, ev.aoeRadius);
          if (ev.towerId === 'badger') {
            const isInferno = ev.branchId === 'badger_inferno';
            const mainCol = isInferno ? '#ff5e1f' : '#38f27f';
            const subCol = isInferno ? '#ffbe4d' : '#a6ffcb';
            this.spawnShockRing(ev.x, ev.z, '#ffffff', r * 0.78, 0.16);
            this.spawnShockRing(ev.x, ev.z, mainCol, r * 1.32, 0.42);
            this.spawnShockRing(ev.x, ev.z, subCol, r * 0.96, 0.30);
            this.spawnScorch(ev.x, ev.z, r * 0.65);
            this.spawnSparks(ev.x, 0.38, ev.z, 0, 0, 0, subCol, 20, 9.5);
            this.spawnParticles(ev.x, 0.42, ev.z, mainCol, 14, 1.3);
            this.spawnImpactBurst(ev.x, 0.48, ev.z, mainCol, 1.25, 0, 0);
            this.cameraCtrl.addTrauma(isInferno ? 0.34 : 0.28);
            this.cameraCtrl.addZoomPunch(1.0);
            this.cameraCtrl.addDirectionalKick(ev.dirX, ev.dirZ, 0.12);
          } else if (ev.towerId === 'tortoise') {
            this.spawnShockRing(ev.x, ev.z, '#ffffff', r * 0.92, 0.20);
            this.spawnShockRing(ev.x, ev.z, '#ffd166', r * 1.45, 0.48);
            this.spawnShockRing(ev.x, ev.z, '#b87e3c', r * 1.15, 0.38);
            this.spawnScorch(ev.x, ev.z, r * 0.8);
            this.spawnSparks(ev.x, 0.35, ev.z, 0, 0, 0, '#ffe38c', 24, 11.0);
            this.spawnParticles(ev.x, 0.42, ev.z, '#d99e4e', 14, 1.4);
            this.spawnParticles(ev.x, 0.32, ev.z, '#6b533b', 9, 1.15);
            this.spawnImpactBurst(ev.x, 0.45, ev.z, '#ffd166', 1.45, 0, 0);
            this.cameraCtrl.addTrauma(0.42);
            this.cameraCtrl.addZoomPunch(1.35);
            this.cameraCtrl.addDirectionalKick(ev.dirX, ev.dirZ, 0.16);
          } else {
            this.spawnShockRing(ev.x, ev.z, '#ffffff', r * 0.82, 0.18);
            this.spawnShockRing(ev.x, ev.z, '#ff9436', r * 1.35, 0.44);
            this.spawnShockRing(ev.x, ev.z, '#ffe17d', r * 1.0, 0.32);
            this.spawnScorch(ev.x, ev.z, r * 0.72);
            this.spawnSparks(ev.x, 0.35, ev.z, 0, 0, 0, '#ffcf6b', 22, 10.5);
            this.spawnSparks(ev.x, 0.3, ev.z, 0, 0, 0, '#ff7a2a', 10, 7);
            this.spawnParticles(ev.x, 0.4, ev.z, '#ff9436', 12, 1.35);
            this.spawnParticles(ev.x, 0.3, ev.z, '#4a3c33', 7, 1.05);
            this.spawnImpactBurst(ev.x, 0.45, ev.z, '#ffb347', 1.35, 0, 0);
            this.cameraCtrl.addTrauma(0.36);
            this.cameraCtrl.addZoomPunch(1.15);
            this.cameraCtrl.addDirectionalKick(ev.dirX, ev.dirZ, 0.14);
          }
          this.onMortarExplode?.();
        } else {
          const sparkHex =
            ev.towerId === 'owl' || ev.towerId === 'falcon'
              ? '#9eefff'
              : ev.towerId === 'badger'
                ? '#5ef79b'
                : ev.towerId === 'lynx'
                  ? '#c98aff'
                  : ev.towerId === 'hedgehog' || ev.towerId === 'tortoise'
                    ? '#ffd27a'
                    : '#fff1b8';
          const burstScale = ev.isCrit ? 1.25 : ev.towerId === 'hedgehog' ? 1.18 : ev.towerId === 'falcon' ? 1.05 : 0.88;
          this.spawnImpactBurst(ev.x, 0.85, ev.z, sparkHex, burstScale, ev.dirX, ev.dirZ);
          if (ev.towerId === 'falcon') {
            this.spawnShockRing(ev.x, ev.z, '#8ceeff', ev.isCrit ? 1.35 : 0.88, 0.20, 0.72);
            this.spawnSparks(ev.x, 0.85, ev.z, ev.dirX, 0.2, ev.dirZ, '#ffd86b', 6, 8.5, 0.55);
          } else if (ev.towerId === 'lynx') {
            const lynxHex = ev.branchId === 'lynx_frostbite' ? '#7ef5ff' : '#c98aff';
            this.spawnShockRing(ev.x, ev.z, lynxHex, 1.0, 0.22, 0.55);
          } else if (ev.towerId === 'hedgehog') {
            this.spawnSparks(ev.x, 0.85, ev.z, ev.dirX, 0.15, ev.dirZ, '#ffcf6b', 10, 10.5, 0.42);
          }
          if (ev.isFreeze || ev.branchId === 'owl_glacier' || ev.branchId === 'lynx_frostbite') {
            this.spawnShockRing(ev.x, ev.z, '#c9f6ff', 1.65, 0.36);
            this.spawnSparks(ev.x, 0.9, ev.z, 0, 0, 0, '#dffaff', 10, 5.5);
            this.onFreezeImpact?.();
          }
          if (ev.splash) {
            this.spawnShockRing(ev.x, ev.z, '#ffa63d', 1.65, 0.28);
            this.spawnSparks(ev.x, 0.75, ev.z, 0, 0, 0, '#ffae42', 8, 6.5);
          }
        }
      } else if (ev.type === 'ENEMY_HIT') {
        const rig = this.enemyRigs.get(ev.enemyId);
        const beam = beamDirs.get(ev.enemyId);
        let dx = ev.dirX ?? beam?.dx ?? 0;
        let dz = ev.dirZ ?? beam?.dz ?? 0;
        if (dx === 0 && dz === 0 && rig) {
          dx = -Math.sin(rig.body.rotation.y);
          dz = -Math.cos(rig.body.rotation.y);
        }
        const heavy = ev.isCrit || ev.armorBroken || Boolean(ev.heavy) || Boolean(beam?.heavy);

        if (rig) {
          const feel = this.getEnemyFeel(ev.enemyId, rig);
          const simEnemy = simRef?.enemies.find((en) => en.uid === ev.enemyId);
          let fwdX = Math.sin(rig.body.rotation.y);
          let fwdZ = Math.cos(rig.body.rotation.y);
          if (simEnemy && simRef) {
            const activePath = simEnemy.lane === 1 && simRef.level.secondaryPath ? simRef.level.secondaryPath : simRef.level.path;
            const wp = activePath[simEnemy.wpIndex];
            if (wp) {
              const wx = wp.x - simEnemy.x;
              const wz = wp.z - simEnemy.z;
              if (Math.hypot(wx, wz) > 1e-4) {
                fwdX = wx;
                fwdZ = wz;
              }
            }
          }

          feel.flashElapsed = 0;
          feel.flashDur = heavy ? HIT_FLASH_DURATION * 1.15 : HIT_FLASH_DURATION;
          const allowBrightFlash = !this.reducedMotion && this.animTime - feel.lastFullFlashAt >= 0.26;
          if (ev.resisted && !ev.isCrit && !ev.armorBroken) {
            feel.flashTint.set('#a8bfd9');
            feel.flashEmissivePeak = 1.6;
            feel.flashDarken = 0.28;
          } else if (allowBrightFlash) {
            feel.lastFullFlashAt = this.animTime;
            feel.flashTint.set(ev.armorBroken ? '#6ef3ff' : ev.isCrit ? '#ffe34d' : '#fff7e2');
            feel.flashEmissivePeak = HIT_FLASH_EMISSIVE;
            feel.flashDarken = 0.88;
          } else {
            feel.flashTint.set('#ffad42');
            feel.flashEmissivePeak = 1.25;
            feel.flashDarken = 0.22;
          }

          feel.lastHitDirX = dx;
          feel.lastHitDirZ = dz;
          rig.hitJoltTimer = 0.16;
          rig.flashTimer = 0;
          rig.knockX = 0;
          rig.knockZ = 0;

          const tier: StaggerTier = ev.isCrit || ev.armorBroken ? 'crit' : heavy ? 'heavy' : 'light';
          const kb = computePathAwareStagger(dx, dz, fwdX, fwdZ, tier, {
            isBoss: ev.isBoss,
            reducedMotion: this.reducedMotion,
          });
          const stillStrong = feel.joltElapsed < HIT_JOLT_DURATION * 0.35 && Math.hypot(feel.kx, feel.kz) > kb.distance;
          if (!stillStrong && kb.distance > 0) {
            feel.kx = kb.dx;
            feel.kz = kb.dz;
            feel.tilt = kb.tiltRad;
            feel.axis.set(kb.dz, 0, -kb.dx).normalize();
            feel.joltElapsed = 0;
          }
        }

        if (ev.resisted) {
          this.spawnSparks(ev.x, 0.9, ev.z, -dx, 0.4, -dz, '#b8d0eb', 5, 7.5, 0.75);
        } else {
          const sparkHex = ev.isCrit ? '#ffe85c' : ev.armorBroken ? '#ffd54f' : '#ffd08a';
          this.spawnSparks(ev.x, 0.85, ev.z, dx, 0.25, dz, sparkHex, heavy ? 10 : 5, heavy ? 9.5 : 7, heavy ? 0.65 : 0.48);
          if (heavy) {
            this.spawnParticles(ev.x, 0.68, ev.z, sparkHex, 6, 1.05);
          }
          if (ev.armorBroken) {
            this.spawnShockRing(ev.x, ev.z, '#ffd54f', 1.35, 0.24);
            this.spawnSparks(ev.x, 0.95, ev.z, 0, 0.4, 0, '#ffe875', 8, 8.5, 0.85);
          }
          if (ev.isCrit || ev.armorBroken) {
            this.spawnShockRing(ev.x, ev.z, '#ffffff', 0.95, 0.15, 0.72);
            this.spawnShockRing(ev.x, ev.z, sparkHex, 1.55);
            this.cameraCtrl.addTrauma(0.24);
            this.cameraCtrl.addZoomPunch(1.3);
          } else {
            this.cameraCtrl.addTrauma(0.085);
          }
        }
      } else if (ev.type === 'ENEMY_KILLED') {
        const rig = this.enemyRigs.get(ev.enemyId);
        if (rig && (ev.dirX || ev.dirZ)) {
          const feel = this.getEnemyFeel(ev.enemyId, rig);
          feel.lastHitDirX = ev.dirX ?? feel.lastHitDirX;
          feel.lastHitDirZ = ev.dirZ ?? feel.lastHitDirZ;
        }
        const boss = ev.isBoss;
        this.spawnShockRing(ev.x, ev.z, '#ffffff', boss ? 2.2 : 1.05, 0.16);
        this.spawnShockRing(ev.x, ev.z, boss ? '#ff7a38' : '#ffd266', boss ? 3.8 : 1.75);
        this.spawnSparks(ev.x, 0.65, ev.z, 0, 0, 0, boss ? '#ffb347' : '#ffe39a', boss ? 34 : 16, boss ? 11 : 8);
        this.spawnParticles(ev.x, 0.6, ev.z, boss ? '#ff8b3d' : '#d9a443', boss ? 20 : 10, boss ? 1.6 : 1.2);
        this.spawnParticles(ev.x, 0.55, ev.z, '#8d99a6', boss ? 14 : 6, boss ? 1.4 : 1.05);
        this.spawnFlyingCoins(ev.x, ev.z, boss ? 8 : 3);
        if (this.magnetTimer > 0) {
          this.spawnGoldenAcornPull(ev.x, ev.z);
        }
        if (boss) this.spawnScorch(ev.x, ev.z, 1.8);
        this.cameraCtrl.addTrauma(boss ? 0.85 : 0.22);
        if (boss) this.cameraCtrl.addZoomPunch(2.4);
      } else if (ev.type === 'BASE_HIT') {
        this.spawnShockRing(0, -9.0, '#ffffff', 2.0, 0.18, 0.25);
        this.spawnShockRing(0, -9.0, '#ff3b2f', 3.4, 0.45, 0.2);
        this.spawnParticles(0, 0.65, -8.8, '#ff4d3b', 14, 1.35);
        this.spawnSparks(0, 0.7, -8.8, 0, 0.4, 1, '#ffaa66', 16, 8.5, 0.9);
        this.cameraCtrl.addTrauma(0.68);
        this.cameraCtrl.addZoomPunch(1.9);
      } else if (ev.type === 'PINECONE_RAIN') {
        this.spawnPineconeRainVfx(ev.x, ev.z);
      } else if (ev.type === 'ACORN_MAGNET') {
        this.spawnMagnetVfx(ev.x, ev.z, ev.duration);
      } else if (ev.type === 'BARREL_EXPLODED') {
        const bv = this.barrelMeshes.get(ev.barrelId);
        if (bv) {
          bv.alive = false;
          bv.group.visible = false;
          bv.hitArea.visible = false;
        }
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 2.0, 0.18);
        this.spawnShockRing(ev.x, ev.z, '#ff7b2b', 3.6, 0.45);
        this.spawnScorch(ev.x, ev.z, 2.1);
        this.spawnSparks(ev.x, 0.5, ev.z, 0, 0, 0, '#ffd059', 26, 10);
        this.spawnParticles(ev.x, 0.7, ev.z, '#ff6d2e', 18, 1.45);
        this.spawnParticles(ev.x, 0.5, ev.z, '#4d3221', 8, 1.2);
        this.cameraCtrl.addTrauma(0.6);
        this.cameraCtrl.addZoomPunch(1.8);
      } else if (ev.type === 'HERO_RALLY') {
        this.rallyShowTimer = 2.2;
        this.spawnShockRing(ev.x, ev.z, '#ffda6b', 0.85, 0.25);
      } else if (ev.type === 'HERO_ATTACK') {
        const hx = ev.targetX - ev.x;
        const hz = ev.targetZ - ev.z;
        const hLen = Math.hypot(hx, hz) || 1;
        const lux = hx / hLen;
        const luz = hz / hLen;
        const faceAngle = Math.atan2(hx, hz);
        const hId = ev.heroId ?? simRef?.heroId ?? 'boz_pence';
        if (this.heroRig) {
          triggerHeroAttack(this.heroRig, lux, luz, false);
          this.heroRig.body.rotation.y = faceAngle;
        }
        if (ev.ranged) {
          // Throwing parabolic emerald alchemy flask (Kızıl Kuyruk) with splash detonation
          this.spawnMuzzleFlash(ev.x + lux * 0.4, 1.05, ev.z + luz * 0.4, '#4ef2b0', lux, luz, false);
          const flask = this.instantiateSkillMesh('skill_alchemy_flask', '#44f0a6', 0.18);
          flask.scale.setScalar(0.9);
          flask.position.set(ev.x + lux * 0.35, 1.05, ev.z + luz * 0.35);
          this.dynamicGroup.add(flask);
          const sx = flask.position.x;
          const sz = flask.position.z;
          const dur = this.reducedMotion ? 0.1 : 0.18;
          let elapsed = 0;
          let shattered = false;
          this.skillEffects.push({
            update: (dt) => {
              elapsed += dt;
              const p = Math.min(1, elapsed / dur);
              if (!shattered) {
                flask.position.set(
                  sx + (ev.targetX - sx) * p,
                  1.05 * (1 - p) + 0.35 * p + Math.sin(p * Math.PI) * 1.15,
                  sz + (ev.targetZ - sz) * p,
                );
                flask.rotation.x += dt * 15;
                flask.rotation.z += dt * 11;
                if (p >= 1) {
                  shattered = true;
                  flask.visible = false;
                  this.spawnShockRing(ev.targetX, ev.targetZ, '#44f0a6', 1.55, 0.28);
                  this.spawnImpactBurst(ev.targetX, 0.65, ev.targetZ, '#78ffca', 1.1, lux, luz);
                  this.spawnParticles(ev.targetX, 0.45, ev.targetZ, '#3bf28a', 7, 1.0);
                }
                return true;
              }
              return elapsed < dur + 0.08;
            },
            dispose: () => this.disposeSkillObject(flask),
          });
        } else if (hId === 'ay_kurdu') {
          this.spawnSlashArc(ev.x + lux * 0.45, ev.z + luz * 0.45, faceAngle + 0.18, '#6ef2ff', 1.35);
          this.spawnSlashArc(ev.x + lux * 0.45, ev.z + luz * 0.45, faceAngle - 0.18, '#e3fcff', 1.18);
          this.spawnImpactBurst(ev.targetX, 0.72, ev.targetZ, '#78f2ff', 1.15, lux, luz);
          this.cameraCtrl.addTrauma(0.2);
        } else if (hId === 'kaya_dis') {
          this.spawnSlashArc(ev.x + lux * 0.5, ev.z + luz * 0.5, faceAngle, '#f59e0b', 1.75);
          this.spawnShockRing(ev.targetX, ev.targetZ, '#e8a848', 1.75, 0.28);
          this.spawnImpactBurst(ev.targetX, 0.65, ev.targetZ, '#ffd27a', 1.35, lux, luz);
          this.spawnParticles(ev.targetX, 0.35, ev.targetZ, '#a87d48', 7, 1.1);
          this.cameraCtrl.addTrauma(0.3);
        } else {
          const variant = resolveHeroVisualVariant(simRef?.heroClass ?? 'auto', simRef?.hero.level ?? 1);
          if (variant === 'viking') {
            this.spawnSlashArc(ev.x + lux * 0.48, ev.z + luz * 0.48, faceAngle + 0.16, '#ff8b3d', 1.5);
            this.spawnSlashArc(ev.x + lux * 0.48, ev.z + luz * 0.48, faceAngle - 0.12, '#ffe27a', 1.3);
            this.spawnImpactBurst(ev.targetX, 0.72, ev.targetZ, '#ffb35c', 1.25, lux, luz);
            this.cameraCtrl.addTrauma(0.26);
          } else {
            const col = variant === 'royal' ? '#fff088' : '#ffe27a';
            this.spawnSlashArc(ev.x + lux * 0.45, ev.z + luz * 0.45, faceAngle, col, 1.4);
            this.spawnImpactBurst(ev.targetX, 0.72, ev.targetZ, col, 1.12, lux, luz);
            this.cameraCtrl.addTrauma(0.22);
          }
        }
      } else if (ev.type === 'HERO_ULTIMATE') {
        if (this.heroRig) triggerHeroAttack(this.heroRig, 0, 1, false);
        this.spawnHeroUltimateVfx(ev);
      } else if (ev.type === 'HERO_CLAW_SHOCK') {
        if (this.heroRig) triggerHeroAttack(this.heroRig, 0, 1, true);
        const hId = ev.heroId ?? simRef?.heroId ?? 'boz_pence';
        const ringCol =
          hId === 'kizil_kuyruk'
            ? '#44f0a6'
            : hId === 'kaya_dis'
              ? '#e8a848'
              : hId === 'ay_kurdu'
                ? '#67e8f9'
                : '#95e06c';
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 1.6, 0.16);
        this.spawnShockRing(ev.x, ev.z, ringCol, hId === 'kizil_kuyruk' ? 5.2 : 3.0);
        if (hId !== 'kizil_kuyruk') {
          this.spawnScorch(ev.x, ev.z, 1.1);
          this.cameraCtrl.addTrauma(hId === 'kaya_dis' ? 0.42 : 0.34);
          this.cameraCtrl.addZoomPunch(1.1);
        }
        this.spawnSparks(ev.x, 0.45, ev.z, 0, 0, 0, ringCol, hId === 'ay_kurdu' ? 18 : 16, 8);
        this.spawnParticles(ev.x, 0.45, ev.z, ringCol, 12, 1.2);
      } else if (ev.type === 'HERO_LEVELED') {
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 1.5, 0.18);
        this.spawnShockRing(ev.x, ev.z, '#ffd54f', 2.4, 0.36);
        this.spawnSparks(ev.x, 0.85, ev.z, 0, 0, 0, '#ffe875', 18, 7.5);
        this.spawnParticles(ev.x, 0.85, ev.z, '#ffca45', 14, 1.25);
      } else if (ev.type === 'BOSS_PHASE_TWO') {
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 2.4, 0.2);
        this.spawnShockRing(ev.x, ev.z, '#ff5436', 4.0, 0.5);
        this.spawnSparks(ev.x, 0.9, ev.z, 0, 0, 0, '#ff8a5c', 26, 10);
        this.spawnParticles(ev.x, 0.9, ev.z, '#ff5436', 18, 1.4);
        this.cameraCtrl.addTrauma(0.65);
        this.cameraCtrl.addZoomPunch(2.0);
      }
    }
  }

  private updateEffects(dt: number): void {
    if (this.ambientMotes) {
      const { mesh, basePos, phases, mode } = this.ambientMotes;
      const count = phases.length;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const ph = phases[i];
        const bx = basePos[i * 3];
        const by = basePos[i * 3 + 1];
        const bz = basePos[i * 3 + 2];
        const t = this.animTime + ph;
        const x = bx + Math.sin(t * 0.85 + ph) * 0.28;
        const y =
          mode === 'float'
            ? by + Math.sin(t * 1.4) * 0.25
            : 0.25 + ((by + 3.6 - ((this.animTime * 0.65 + ph * 0.5) % 3.6)) % 3.6);
        const z = bz + Math.cos(t * 0.72 + ph) * 0.24;
        dummy.position.set(x, y, z);
        if (mode === 'fall') dummy.rotation.set(t * 0.9, t * 1.1, ph);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    for (const pool of [this.particles, this.coins]) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        p.vy -= (p.isCoin ? 12.0 : 9.8) * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y = Math.max(0.08, p.mesh.position.y + p.vy * dt);
        p.mesh.position.z += p.vz * dt;
        if (p.isCoin) {
          p.mesh.rotation.y += dt * 14;
          // Acorn-coin pop: overshoot scale-in then shrink away
          const age = p.maxLife - p.life;
          const pop = age < 0.12 ? 0.6 + easeOutCubic(age / 0.12) * 0.75 : 1.35 - Math.min(1, (age - 0.12) / (p.maxLife - 0.12)) * 1.0;
          p.mesh.scale.setScalar(Math.max(0.2, pop));
          continue;
        }
        p.mesh.rotation.x += dt * 7;
        p.mesh.scale.setScalar(Math.max(0.15, p.life / p.maxLife));
      }
    }

    // Velocity-stretched sparks: oriented along velocity, length scales with speed
    const tmp = new THREE.Vector3();
    for (const s of this.sparks) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      const drag = Math.exp(-3.2 * dt);
      s.vx *= drag;
      s.vz *= drag;
      s.vy = s.vy * drag - 15 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y = Math.max(0.06, s.mesh.position.y + s.vy * dt);
      s.mesh.position.z += s.vz * dt;
      const k = s.life / s.maxLife;
      const speed = Math.hypot(s.vx, s.vy, s.vz);
      tmp.set(s.mesh.position.x + s.vx, s.mesh.position.y + s.vy, s.mesh.position.z + s.vz);
      s.mesh.lookAt(tmp);
      const thick = 0.6 + 0.6 * k;
      s.mesh.scale.set(thick, thick, Math.max(0.06, Math.min(0.6, speed * s.stretch)) * (0.5 + 0.5 * k));
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 1.6);
    }

    // Projectile wakes: released trails collapse into their head and fade out
    for (const tr of this.trails) {
      if (!tr.active || !tr.fading) continue;
      tr.fade -= dt / 0.14;
      if (tr.fade <= 0) {
        tr.active = false;
        tr.fading = false;
        tr.mesh.visible = false;
        continue;
      }
      pushTrailPoint(tr, tr.pts[0], tr.pts[1], tr.pts[2]);
      rebuildTrail(tr);
    }

    // Scorch decals: hold, then fade over the last second
    for (const d of this.scorches) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * Math.min(1, d.life / 1.0);
    }

    const nextRings: ShockRing[] = [];
    for (const r of this.shockRings) {
      r.life -= dt;
      if (r.life <= 0) {
        this.dynamicGroup.remove(r.mesh);
        if (r.disposeGeo) r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
      } else {
        const k = 1 - r.life / r.maxLife;
        r.mesh.scale.setScalar((r.disposeGeo ? 0.55 : 0.2) + easeOutCubic(k) * r.maxScale);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - k, 1.4) * 0.95;
        nextRings.push(r);
      }
    }
    this.shockRings = nextRings;

    const nextFlashes: MuzzleFlash[] = [];
    for (const mf of this.muzzleFlashes) {
      mf.life -= dt;
      if (mf.life <= 0) {
        this.dynamicGroup.remove(mf.mesh);
        (mf.mesh.material as THREE.Material).dispose();
      } else {
        const k = mf.life / mf.maxLife;
        const base = mf.mesh.userData.baseScale ?? (mf.mesh.userData.baseScale = mf.mesh.scale.x);
        mf.mesh.scale.setScalar(base * (0.7 + (1 - k) * 1.2));
        (mf.mesh.material as THREE.MeshBasicMaterial).opacity = k;
        nextFlashes.push(mf);
      }
    }
    this.muzzleFlashes = nextFlashes;

    const nextBeams: EnergyBeam[] = [];
    for (const b of this.energyBeams) {
      b.life -= dt;
      if (b.life <= 0) {
        for (const m of b.meshes) {
          this.dynamicGroup.remove(m);
          m.geometry.dispose();
        }
        if (b.meshes[0]) (b.meshes[0].material as THREE.Material).dispose();
      } else {
        const k = b.life / b.maxLife;
        for (const m of b.meshes) {
          (m.material as THREE.MeshBasicMaterial).opacity = k;
          m.scale.set(k, 1, k);
        }
        nextBeams.push(b);
      }
    }
    this.energyBeams = nextBeams;

    const nextDying: DyingBody[] = [];
    for (const db of this.dyingBodies) {
      db.life -= dt;
      db.elapsed += dt;
      if (db.life <= 0) {
        this.dynamicGroup.remove(db.group);
        const disposedMats = new Set<THREE.Material>();
        db.group.traverse((obj) => {
          if (!(obj as THREE.Mesh).isMesh) return;
          const mat = (obj as THREE.Mesh).material;
          const mats = Array.isArray(mat) ? mat : [mat];
          for (const m of mats) {
            if (m && !disposedMats.has(m)) {
              disposedMats.add(m);
              m.dispose();
            }
          }
        });
      } else {
        // Parabolic launch + bright flash + tumble spin before scrap burst dissolve
        const fs = hitFlashStrength(db.elapsed, HIT_FLASH_DURATION * 1.4);
        for (const b of db.bases) {
          b.mat.color.copy(b.color).multiplyScalar(1 - 0.85 * fs);
          b.mat.emissive.copy(fs > 0 ? WHITE : b.emissive);
          b.mat.emissiveIntensity = fs > 0 ? HIT_FLASH_EMISSIVE * fs : b.emissiveIntensity;
        }
        const k = db.life / db.maxLife;
        db.vy -= 18 * dt;
        db.group.position.x += db.vx * dt;
        db.group.position.z += db.vz * dt;
        db.group.position.y = Math.max(0.16, db.group.position.y + db.vy * dt);
        db.group.rotation.x += db.spinX * dt;
        db.group.rotation.z += db.spinZ * dt;
        const pop = db.elapsed < 0.08 ? 1 + 0.3 * (db.elapsed / 0.08) : 1.3 * Math.min(1, k * 1.35);
        db.group.scale.setScalar(Math.max(0.05, pop));
        nextDying.push(db);
      }
    }
    this.dyingBodies = nextDying;

    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    }
    if (this.skillEffects.length > 0) {
      const aliveFx: Array<{ update: (d: number) => boolean; dispose: () => void }> = [];
      for (const fx of this.skillEffects) {
        if (fx.update(dt)) {
          aliveFx.push(fx);
        } else {
          fx.dispose();
        }
      }
      this.skillEffects = aliveFx;
    }
  }

  private instantiateSkillMesh(modelName: ModelName, fallbackHex: string, fallbackSize: number): THREE.Object3D {
    const inst = instantiateModel(modelName);
    if (inst) return inst.scene;
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(fallbackSize, 0),
      new THREE.MeshStandardMaterial({ color: fallbackHex, emissive: fallbackHex, emissiveIntensity: 0.45, roughness: 0.35 }),
    );
    mesh.userData.ownResources = true;
    return mesh;
  }

  private disposeSkillObject(root: THREE.Object3D): void {
    this.dynamicGroup.remove(root);
    const seenGeo = new Set<THREE.BufferGeometry>();
    const seenMat = new Set<THREE.Material>();
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.userData.ownResources) return;
      if (m.geometry && !seenGeo.has(m.geometry)) {
        seenGeo.add(m.geometry);
        m.geometry.dispose();
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat && !seenMat.has(mat)) {
          seenMat.add(mat);
          mat.dispose();
        }
      }
    });
  }

  private spawnFlashLight(x: number, y: number, z: number, colorHex: string, intensity: number, distance: number, duration: number): void {
    if (this.batterySaver || this.reducedMotion) return;
    const light = new THREE.PointLight(colorHex, intensity, distance);
    light.position.set(x, y, z);
    this.dynamicGroup.add(light);
    let elapsed = 0;
    this.skillEffects.push({
      update: (dt) => {
        elapsed += dt;
        const k = Math.max(0, 1 - elapsed / duration);
        light.intensity = intensity * k * k;
        return elapsed < duration;
      },
      dispose: () => {
        this.dynamicGroup.remove(light);
      },
    });
  }

  private spawnPineconeRainVfx(tx: number, tz: number): void {
    this.spawnFlashLight(tx, 1.5, tz, '#ff8d2e', 5.5, 9.0, 0.55);
    this.spawnShockRing(tx, tz, '#ffffff', 2.1, 0.22);
    this.spawnShockRing(tx, tz, '#ff9f43', 3.6, 0.48);

    const targets: Array<[number, number]> = [[tx, tz]];
    const count = this.reducedMotion ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const ang = (i * Math.PI * 2) / count + 0.35;
      const rad = i % 2 === 0 ? 1.45 : 2.35;
      targets.push([tx + Math.cos(ang) * rad, tz + Math.sin(ang) * rad]);
    }

    targets.forEach(([lx, lz], idx) => {
      const meteor = this.instantiateSkillMesh('skill_pinecone_meteor', '#ff7a18', 0.26);
      meteor.scale.setScalar(idx === 0 ? 1.45 : 1.1);
      const sx = lx + 2.7 + (idx % 3) * 0.35;
      const sy = 11.2 + idx * 0.55;
      const sz = lz - 2.4;
      meteor.position.set(sx, sy, sz);
      meteor.visible = false;
      this.dynamicGroup.add(meteor);

      const delay = idx * 0.055;
      const flightDur = this.reducedMotion ? 0.16 : 0.27;
      const holdDur = 0.22;
      let elapsed = 0;
      let impacted = false;
      let sparkAccum = 0;
      const endVec = new THREE.Vector3(lx, 0.08, lz);

      this.skillEffects.push({
        update: (dt) => {
          elapsed += dt;
          if (elapsed < delay) return true;
          const tFlight = elapsed - delay;
          if (tFlight < flightDur) {
            meteor.visible = true;
            const p = tFlight / flightDur;
            const e = p * p;
            meteor.position.set(sx + (lx - sx) * e, sy + (0.12 - sy) * e, sz + (lz - sz) * e);
            meteor.lookAt(endVec);
            meteor.rotateZ(tFlight * 16);
            sparkAccum += dt;
            if (!this.reducedMotion && sparkAccum >= 0.032) {
              sparkAccum = 0;
              this.spawnSparks(meteor.position.x, meteor.position.y, meteor.position.z, 0.4, 0.8, -0.4, '#ffb647', 2, 4.5, 0.4);
            }
            return true;
          }
          if (!impacted) {
            impacted = true;
            meteor.position.set(lx, 0.08, lz);
            this.spawnShockRing(lx, lz, '#ff9f43', idx === 0 ? 2.6 : 1.75, 0.32);
            this.spawnScorch(lx, lz, idx === 0 ? 2.2 : 1.25);
            this.spawnSparks(lx, 0.42, lz, 0, 0.8, 0, '#ffcf6b', idx === 0 ? 20 : 9, 9.5);
            this.spawnParticles(lx, 0.55, lz, '#ff7722', idx === 0 ? 14 : 6, 1.3);
            if (idx === 0) {
              this.cameraCtrl.addTrauma(0.56);
              this.cameraCtrl.addZoomPunch(1.8);
            } else {
              this.cameraCtrl.addTrauma(0.14);
            }
          }
          const post = tFlight - flightDur;
          const shrink = Math.max(0.01, 1 - post / holdDur);
          meteor.scale.setScalar((idx === 0 ? 1.45 : 1.1) * shrink);
          return post < holdDur;
        },
        dispose: () => this.disposeSkillObject(meteor),
      });
    });
  }

  private spawnMagnetVfx(hx: number, hz: number, duration: number): void {
    this.magnetTimer = duration;
    this.magnetPos.set(hx, 2.35, hz);
    const magnet = this.instantiateSkillMesh('skill_acorn_magnet', '#4cf0ff', 0.35);
    magnet.scale.setScalar(1.38);
    magnet.position.copy(this.magnetPos);
    this.dynamicGroup.add(magnet);
    this.spawnFlashLight(hx, 2.2, hz, '#4cf0ff', 3.4, 7.5, 0.7);
    this.spawnShockRing(hx, hz, '#4cf0ff', 3.2, 0.4);

    // Pull an immediate ring of golden acorns toward the hovering magnet
    const burstCount = this.reducedMotion ? 3 : 6;
    for (let i = 0; i < burstCount; i++) {
      const a = (i * Math.PI * 2) / burstCount;
      const dist = 2.6 + (i % 2) * 1.1;
      this.spawnGoldenAcornPull(hx + Math.cos(a) * dist, hz + Math.sin(a) * dist);
    }

    let elapsed = 0;
    let pulseAccum = 0;
    this.skillEffects.push({
      update: (dt) => {
        elapsed += dt;
        const hero = this.lastSim?.hero;
        if (hero && !hero.dead) {
          this.magnetPos.x += (hero.x - this.magnetPos.x) * Math.min(1, dt * 8);
          this.magnetPos.z += (hero.z - this.magnetPos.z) * Math.min(1, dt * 8);
        }
        const bob = Math.sin(elapsed * 4.2) * 0.14;
        const fadeOut = elapsed > duration - 0.35 ? Math.max(0.01, (duration - elapsed) / 0.35) : 1;
        const intro = elapsed < 0.22 ? elapsed / 0.22 : 1;
        magnet.position.set(this.magnetPos.x, 2.35 + bob, this.magnetPos.z);
        magnet.rotation.y += dt * 3.1;
        magnet.scale.setScalar(1.38 * intro * fadeOut);

        pulseAccum += dt;
        if (pulseAccum >= 0.7) {
          pulseAccum = 0;
          this.spawnShockRing(this.magnetPos.x, this.magnetPos.z, '#52f2ff', 2.4, 0.36);
          this.spawnSparks(this.magnetPos.x, 2.35, this.magnetPos.z, 0, 0.3, 0, '#ffd44f', 5, 4.5, 0.3);
        }
        return elapsed < duration;
      },
      dispose: () => this.disposeSkillObject(magnet),
    });
  }

  private spawnGoldenAcornPull(sx: number, sz: number): void {
    const acorn = this.instantiateSkillMesh('skill_golden_acorn', '#ffd24a', 0.16);
    acorn.scale.setScalar(1.15);
    acorn.position.set(sx, 0.2, sz);
    this.dynamicGroup.add(acorn);
    const dur = 0.48;
    let elapsed = 0;
    const startAngle = Math.atan2(sz - this.magnetPos.z, sx - this.magnetPos.x);
    const startDist = Math.max(0.5, Math.hypot(sx - this.magnetPos.x, sz - this.magnetPos.z));

    this.skillEffects.push({
      update: (dt) => {
        elapsed += dt;
        const p = Math.min(1, elapsed / dur);
        const radius = startDist * Math.pow(1 - p, 1.35);
        const angle = startAngle + p * Math.PI * 2.2;
        const tx = this.magnetPos.x + Math.cos(angle) * radius;
        const tz = this.magnetPos.z + Math.sin(angle) * radius;
        const ty = 0.2 + (2.35 - 0.2) * easeOutCubic(p) + Math.sin(p * Math.PI) * 0.55;
        acorn.position.set(tx, ty, tz);
        acorn.rotation.y += dt * 9;
        acorn.rotation.x += dt * 5;
        acorn.scale.setScalar(1.15 * (1 - 0.45 * p));
        if (p >= 1) {
          this.spawnSparks(this.magnetPos.x, 2.35, this.magnetPos.z, 0, 0.3, 0, '#ffe169', 6, 5.5, 0.35);
          return false;
        }
        return true;
      },
      dispose: () => this.disposeSkillObject(acorn),
    });
  }

  private spawnHeroUltimateVfx(ev: Extract<SimEvent, { type: 'HERO_ULTIMATE' }>): void {
    const fxX = ev.fromX ?? ev.x;
    const fxZ = ev.fromZ ?? ev.z;
    const col =
      ev.variant === 'fox_storm'
        ? '#44f0a6'
        : ev.variant === 'wolf_howl'
          ? '#67e8f9'
          : ev.variant === 'boar_charge'
            ? '#e8a848'
            : ev.variant === 'viking'
              ? '#ff7b3b'
              : ev.variant === 'royal'
                ? '#ffd84f'
                : '#80f272';

    this.spawnFlashLight(ev.x, 1.6, ev.z, col, 4.8, 8.5, 0.65);
    this.spawnShockRing(ev.x, ev.z, '#ffffff', 1.8, 0.18);
    this.spawnShockRing(ev.x, ev.z, col, 3.8, 0.45);
    this.cameraCtrl.addTrauma(0.5);
    this.cameraCtrl.addZoomPunch(1.5);

    if (ev.variant === 'fox_storm') {
      const drops: Array<[number, number]> = [
        [ev.x, ev.z],
        [ev.x - 1.5, ev.z + 1.1],
        [ev.x + 1.5, ev.z + 1.0],
        [ev.x - 1.3, ev.z - 1.2],
        [ev.x + 1.4, ev.z - 1.1],
      ];
      drops.forEach(([lx, lz], idx) => {
        const flask = this.instantiateSkillMesh('skill_alchemy_flask', '#44f0a6', 0.22);
        flask.scale.setScalar(1.1);
        flask.position.set(fxX, 1.2, fxZ);
        this.dynamicGroup.add(flask);
        const dur = 0.28 + idx * 0.045;
        let elapsed = 0;
        let shattered = false;
        this.skillEffects.push({
          update: (dt) => {
            elapsed += dt;
            if (!shattered) {
              const p = Math.min(1, elapsed / dur);
              flask.position.set(
                fxX + (lx - fxX) * p,
                1.2 * (1 - p) + Math.sin(p * Math.PI) * (3.2 + idx * 0.25),
                fxZ + (lz - fxZ) * p,
              );
              flask.rotation.x += dt * 11;
              flask.rotation.z += dt * 8;
              if (p >= 1) {
                shattered = true;
                flask.visible = false;
                this.spawnShockRing(lx, lz, '#3ff598', 1.85, 0.35);
                this.spawnSparks(lx, 0.45, lz, 0, 1.1, 0, '#78ffca', 12, 8.5);
                this.spawnParticles(lx, 0.45, lz, '#2ef28d', 8, 1.3);
              }
              return true;
            }
            return elapsed < dur + 0.12;
          },
          dispose: () => this.disposeSkillObject(flask),
        });
      });

      // Bubbling alchemy rune pool decal
      const poolMesh = new THREE.Mesh(
        new THREE.CircleGeometry(2.6, 28),
        new THREE.MeshBasicMaterial({ color: '#2ef28d', transparent: true, opacity: 0.34, depthWrite: false }),
      );
      poolMesh.userData.ownResources = true;
      poolMesh.rotation.x = -Math.PI / 2;
      poolMesh.position.set(ev.x, 0.055, ev.z);
      this.dynamicGroup.add(poolMesh);
      let poolElapsed = 0;
      let bubbleAccum = 0;
      this.skillEffects.push({
        update: (dt) => {
          poolElapsed += dt;
          bubbleAccum += dt;
          const k = Math.max(0, 1 - poolElapsed / 2.4);
          (poolMesh.material as THREE.MeshBasicMaterial).opacity = 0.34 * k;
          poolMesh.scale.setScalar(0.85 + Math.sin(poolElapsed * 8) * 0.06);
          if (!this.reducedMotion && bubbleAccum >= 0.14 && poolElapsed < 2.0) {
            bubbleAccum = 0;
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * 2.0;
            this.spawnParticles(ev.x + Math.cos(ang) * r, 0.25, ev.z + Math.sin(ang) * r, '#6effbe', 2, 0.8);
          }
          return poolElapsed < 2.4;
        },
        dispose: () => this.disposeSkillObject(poolMesh),
      });
      return;
    }

    if (ev.variant === 'royal') {
      const bx = ev.x + 0.55;
      const bz = ev.z + 0.25;
      const banner = this.instantiateSkillMesh('skill_royal_banner', '#ffd84f', 0.4);
      banner.scale.setScalar(1.38);
      banner.position.set(bx, 5.2, bz);
      this.dynamicGroup.add(banner);
      let elapsed = 0;
      let planted = false;
      let pulseAccum = 0;
      const life = 6.2;
      this.skillEffects.push({
        update: (dt) => {
          elapsed += dt;
          if (elapsed < 0.15) {
            const p = easeOutCubic(elapsed / 0.15);
            banner.position.y = 5.2 * (1 - p);
            return true;
          }
          if (!planted) {
            planted = true;
            banner.position.y = 0;
            this.spawnShockRing(bx, bz, '#ffd84f', 2.6, 0.4);
            this.spawnSparks(bx, 0.5, bz, 0, 1.0, 0, '#ffe875', 18, 8.0);
          }
          banner.rotation.z = Math.sin(elapsed * 3.8) * 0.035;
          pulseAccum += dt;
          if (pulseAccum >= 1.15) {
            pulseAccum = 0;
            this.spawnShockRing(bx, bz, '#ffe17d', 3.4, 0.55);
          }
          if (elapsed > life - 0.4) {
            const k = Math.max(0.01, (life - elapsed) / 0.4);
            banner.scale.setScalar(1.38 * k);
          }
          return elapsed < life;
        },
        dispose: () => this.disposeSkillObject(banner),
      });
      return;
    }

    // Seismic earth spikes for boar_charge, viking, and classic
    if (ev.variant === 'boar_charge' || ev.variant === 'viking') {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const p = i / steps;
        this.spawnParticles(fxX + (ev.x - fxX) * p, 0.4, fxZ + (ev.z - fxZ) * p, col, 4, 1.15);
      }
      if (ev.variant === 'viking') {
        this.spawnSlashArc(ev.x, ev.z, 0.4, '#ffb56b', 2.2);
        this.spawnSlashArc(ev.x, ev.z, -1.1, '#ffe27a', 2.0);
      }
    }

    this.spawnScorch(ev.x, ev.z, 1.75);
    this.spawnSparks(ev.x, 0.55, ev.z, 0, 0.9, 0, col, 24, 9.5);
    this.spawnParticles(ev.x, 0.55, ev.z, col, 16, 1.35);

    const spikeCount = ev.variant === 'boar_charge' ? 8 : ev.variant === 'viking' ? 6 : 5;
    const radius = ev.variant === 'boar_charge' ? 2.15 : 1.75;
    for (let i = 0; i < spikeCount; i++) {
      const ang = (i * Math.PI * 2) / spikeCount + 0.2;
      const sx = ev.x + Math.cos(ang) * radius;
      const sz = ev.z + Math.sin(ang) * radius;
      const spike = this.instantiateSkillMesh('skill_earth_spike', col, 0.35);
      spike.position.set(sx, -0.04, sz);
      spike.rotation.y = -ang + Math.PI / 2;
      spike.rotation.x = 0.16;
      spike.scale.set(0.95, 0.05, 0.95);
      this.dynamicGroup.add(spike);

      let elapsed = 0;
      const riseDur = 0.11;
      const holdDur = 0.62;
      const sinkDur = 0.28;
      this.skillEffects.push({
        update: (dt) => {
          elapsed += dt;
          if (elapsed < riseDur) {
            const p = easeOutCubic(elapsed / riseDur);
            spike.scale.y = 0.05 + 1.15 * p;
            return true;
          }
          if (elapsed < riseDur + holdDur) {
            spike.scale.y = 1.2;
            return true;
          }
          const sp = Math.min(1, (elapsed - riseDur - holdDur) / sinkDur);
          spike.scale.y = Math.max(0.02, 1.2 * (1 - sp));
          spike.position.y = -0.04 - 0.35 * sp;
          return sp < 1;
        },
        dispose: () => this.disposeSkillObject(spike),
      });
    }
  }

  private monitorFps(dt: number): void {
    if (this.bloomDisabled || dt <= 0) return;
    if (1 / dt < 42) {
      this.lowFpsCounter += 1;
      if (this.lowFpsCounter > 55) {
        this.bloomDisabled = true;
        this.sunLight.castShadow = false;
      }
    } else {
      this.lowFpsCounter = Math.max(0, this.lowFpsCounter - 1);
    }
  }

  distanceToRoad(x: number, z: number): number {
    if (!this.activeLevel) return Number.POSITIVE_INFINITY;
    const distPolylines = (pts: readonly Vec2[]): number => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const len2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / len2));
        const d = Math.hypot(x - (a.x + t * vx), z - (a.z + t * vz));
        if (d < best) best = d;
      }
      return best;
    };
    const mainD = distPolylines(this.activeLevel.path);
    if (!this.activeLevel.secondaryPath) return mainD;
    return Math.min(mainD, distPolylines(this.activeLevel.secondaryPath));
  }

  isNearRoad(x: number, z: number, threshold = 1.45): boolean {
    return this.distanceToRoad(x, z) <= threshold;
  }

  updateTargetingReticle(mode: 'rain' | 'hero_leap' | null, x = 0, z = 0): void {
    if (!mode) {
      this.targetingReticle.visible = false;
      return;
    }
    this.targetingReticle.visible = true;
    this.targetingReticle.position.set(x, 0.085, z);
    const radius = mode === 'rain' ? 3.0 : 3.4;
    this.targetingReticle.scale.setScalar(radius);
    const mat = this.targetingReticle.material as THREE.MeshBasicMaterial;
    mat.color.set(mode === 'rain' ? '#ff9f43' : '#52e8ff');
    mat.opacity = 0.72 + Math.sin(this.animTime * 8) * 0.18;
  }

  pickWorld(clientX: number, clientY: number): { slotId: string | null; barrelId: string | null; x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);

    const pt = new THREE.Vector3();
    const hasGround = this.raycaster.ray.intersectPlane(this.groundPlane, pt) !== null;

    const barrelHitsTargets: THREE.Object3D[] = [];
    for (const bv of this.barrelMeshes.values()) {
      if (bv.alive) barrelHitsTargets.push(bv.hitArea);
    }
    if (barrelHitsTargets.length > 0) {
      const bHits = this.raycaster.intersectObjects(barrelHitsTargets, false);
      if (bHits.length > 0) {
        const hitObj = bHits[0].object;
        const barrelId = (hitObj.userData as { barrelId?: string }).barrelId ?? null;
        const gx = hasGround ? pt.x : bHits[0].point.x;
        const gz = hasGround ? pt.z : bHits[0].point.z;
        const barrelDist = Math.hypot(gx - hitObj.position.x, gz - hitObj.position.z);
        const roadDist = this.distanceToRoad(gx, gz);
        if (!(roadDist < 0.68 && barrelDist > 0.48)) {
          return { slotId: null, barrelId, x: bHits[0].point.x, z: bHits[0].point.z };
        }
      }
    }

    const hitAreas: THREE.Object3D[] = [];
    for (const v of this.slotMeshes.values()) hitAreas.push(v.hitArea);
    const slotHits = this.raycaster.intersectObjects(hitAreas, false);
    if (slotHits.length > 0) {
      const hitObj = slotHits[0].object;
      const slotId = (hitObj.userData as { slotId?: string }).slotId ?? null;
      const gx = hasGround ? pt.x : slotHits[0].point.x;
      const gz = hasGround ? pt.z : slotHits[0].point.z;
      const slotDist = Math.hypot(gx - hitObj.position.x, gz - hitObj.position.z);
      const roadDist = this.distanceToRoad(gx, gz);
      if (roadDist < 0.74 && slotDist > 0.54) {
        return { slotId: null, barrelId: null, x: gx, z: gz };
      }
      return { slotId, barrelId: null, x: slotHits[0].point.x, z: slotHits[0].point.z };
    }

    if (hasGround) {
      return { slotId: null, barrelId: null, x: pt.x, z: pt.z };
    }
    return null;
  }

  projectToScreen(x: number, y: number, z: number): ScreenProjection {
    const v = new THREE.Vector3(x, y, z).project(this.cameraCtrl.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
      visible: v.z <= 1,
    };
  }

  getTowerColorPreview(id: TowerId): string {
    return TOWERS[id]?.accentColor ?? '#7fe8ff';
  }

  private buildAuraRingGroup(auraId: AuraId, radius: number): THREE.Group {
    const spec = getAuraSpec(auraId);
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.86, radius, 28),
      new THREE.MeshBasicMaterial({
        color: spec.primaryHex,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.058;
    group.add(ring);

    const gemGeo = new THREE.OctahedronGeometry(0.085, 0);
    const gemMat = new THREE.MeshBasicMaterial({ color: spec.secondaryHex, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(Math.cos(a) * radius * 0.93, 0.14, Math.sin(a) * radius * 0.93);
      group.add(gem);
    }
    return group;
  }

  private buildCastleWarBanner(clothHex: string, trimHex: string): { root: THREE.Group; cloth: THREE.Mesh } {
    const root = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: '#6b3e1e', roughness: 0.68 });
    const metalMat = new THREE.MeshStandardMaterial({ color: trimHex, roughness: 0.28, metalness: 0.78 });
    const clothMat = new THREE.MeshStandardMaterial({ color: clothHex, roughness: 0.58, side: THREE.DoubleSide });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.25, 10), poleMat);
    pole.position.y = 1.125;
    pole.castShadow = true;

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.96, 8), poleMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.y = 2.02;

    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 10), metalMat);
    finial.position.y = 2.38;

    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), metalMat);
    crest.position.set(0, 1.54, 0.10);

    const clothGeo = new THREE.PlaneGeometry(0.76, 1.12, 1, 4);
    clothGeo.translate(0, -0.56, 0);
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(0, 2.02, 0.06);
    cloth.castShadow = true;

    root.add(pole, crossbar, finial, crest, cloth);
    return { root, cloth };
  }

  renderJournalShowcase(
    targetCanvas: HTMLCanvasElement,
    modelName: ModelName,
    yawRad: number,
    dt: number,
  ): void {
    const ctx2d = targetCanvas.getContext('2d');
    if (!ctx2d) return;

    if (!this.showcaseScene) {
      this.showcaseScene = new THREE.Scene();
      this.showcaseScene.background = new THREE.Color('#162638');
      this.showcaseScene.environment = this.scene.environment;
      this.showcaseScene.environmentIntensity = 0.45;

      const hemi = new THREE.HemisphereLight('#c8e2ff', '#4b5a6e', 1.1);
      const key = new THREE.DirectionalLight('#fff0d2', 1.7);
      key.position.set(2.5, 4.0, 3.2);
      const rim = new THREE.DirectionalLight('#64dcff', 0.9);
      rim.position.set(-2.5, 2.2, -3.0);
      this.showcaseScene.add(hemi, key, rim);

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.08, 0.22, 24),
        new THREE.MeshStandardMaterial({ color: '#46586b', roughness: 0.78 }),
      );
      pedestal.position.y = -0.11;
      this.showcaseScene.add(pedestal);

      this.showcasePivot = new THREE.Group();
      this.showcaseScene.add(this.showcasePivot);
      this.showcaseCam = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
      this.showcaseCam.position.set(0, 1.55, 4.1);
      this.showcaseCam.lookAt(0, 0.85, 0);
    }

    if (this.showcasePivot && modelName !== this.showcaseModelName) {
      this.showcasePivot.clear();
      this.showcaseMixer = null;
      const inst = instantiateModel(modelName);
      if (inst) {
        const box = new THREE.Box3().setFromObject(inst.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(0.4, size.x, size.y, size.z);
        const scale = 1.65 / maxDim;
        inst.scene.scale.setScalar(scale);
        inst.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        this.showcasePivot.add(inst.scene);

        if (inst.animations.length > 0) {
          this.showcaseMixer = new THREE.AnimationMixer(inst.scene);
          const clip =
            inst.animations.find((a) => /idle|walk|run/i.test(a.name)) ?? inst.animations[0];
          this.showcaseMixer.clipAction(clip).play();
        }
        this.showcaseModelName = modelName;
      }
    }

    if (this.showcasePivot) {
      this.showcasePivot.rotation.y = yawRad;
    }
    if (this.showcaseMixer && dt > 0) {
      this.showcaseMixer.update(dt);
    }
    if (!this.showcaseCam || !this.showcaseScene) return;

    const srcW = this.renderer.domElement.width;
    const srcH = this.renderer.domElement.height;
    if (srcW <= 0 || srcH <= 0) return;

    this.showcaseCam.aspect = srcW / srcH;
    this.showcaseCam.fov = srcW < srcH ? 42 : 34;
    this.showcaseCam.updateProjectionMatrix();
    this.renderer.render(this.showcaseScene, this.showcaseCam);

    const dstW = targetCanvas.width;
    const dstH = targetCanvas.height;
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (srcAspect < dstAspect) {
      sh = srcW / dstAspect;
      sy = (srcH - sh) * 0.5;
    } else {
      sw = srcH * dstAspect;
      sx = (srcW - sw) * 0.5;
    }
    ctx2d.clearRect(0, 0, dstW, dstH);
    ctx2d.drawImage(this.renderer.domElement, sx, sy, sw, sh, 0, 0, dstW, dstH);
  }
}

export type { SlotState, EnemyInstance, ProjectileInstance };

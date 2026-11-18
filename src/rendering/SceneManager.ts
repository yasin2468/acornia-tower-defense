import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { resolveHeroVisualVariant, type HeroClassId } from '../data/enemies.ts';
import type { LevelSpec, Vec2 } from '../data/levels.ts';
import { TOWERS, type HatId, type TowerId } from '../data/towers.ts';
import type {
  EnemyInstance,
  ProjectileInstance,
  ResinPool,
  SimEvent,
  SimulationEngine,
  SlotState,
} from '../core/SimulationEngine.ts';
import { extractStaticPrimitives, type ModelName } from './AssetLoader.ts';
import { CameraController } from './CameraController.ts';
import { countDrawCalls } from './DrawCallCounter.ts';
import { createCobbleRoadTexture, createMeadowTexture } from './ProceduralTextures.ts';
import {
  createBearHeroRig,
  createEnemyRig,
  createGreatOakCastle,
  createPropLOD,
  createStumpProp,
  createTowerRig,
  createTreeProp,
  updateEnemyAnimation,
  updateHeroAnimation,
  updateTowerAnimation,
  type EnemyRig,
  type HeroRig,
  type TowerRig,
} from './ModelFactory.ts';
import {
  computeKnockback,
  easeOutCubic,
  evalHitJolt,
  evalSquashPop,
  hitFlashStrength,
  HIT_FLASH_DURATION,
  HIT_FLASH_EMISSIVE,
  HIT_JOLT_DURATION,
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
  joltElapsed: number;
  kx: number;
  kz: number;
  tilt: number;
  axis: THREE.Vector3;
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

interface ProjectileImpact {
  targetUid: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  aoeRadius: number;
  towerId: TowerId;
  branchId?: string;
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

function buildRoadCurbstones(curve: THREE.CatmullRomCurve3): THREE.InstancedMesh {
  const steps = 64;
  const totalInstances = steps * 2;
  const stoneGeo = new RoundedBoxGeometry(0.26, 0.12, 0.35, 2, 0.05);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, metalness: 0.02 });
  const mesh = new THREE.InstancedMesh(stoneGeo, stoneMat, totalInstances);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const palette = [new THREE.Color('#ebe2cf'), new THREE.Color('#dfd5c0'), new THREE.Color('#f2ebda')];
  const dummy = new THREE.Object3D();
  const roadHalfW = 0.84;
  let idx = 0;

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
      dummy.position.set(pt.x + nx * (roadHalfW + jitter) * side, 0.055, pt.z + nz * (roadHalfW + jitter) * side);
      dummy.rotation.set(0, yaw + jitter * 2, 0);
      const lenScale = 0.88 + ((i + (side > 0 ? 1 : 0)) % 3) * 0.12;
      dummy.scale.set(1, 0.9 + ((i % 2) * 0.16), lenScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(idx, palette[(i + (side > 0 ? 1 : 0)) % palette.length]);
      idx += 1;
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
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
  private flashCoreGeo = new THREE.IcosahedronGeometry(0.2, 0);
  private flashStarGeo = new THREE.OctahedronGeometry(0.3, 0);
  private lastSim: SimulationEngine | null = null;
  private reducedMotion = false;
  /** Fired when a projectile from the Glacier owl lands (freeze burst). */
  onFreezeImpact?: () => void;
  /** Fired on each chain-lightning discharge. */
  onChainZap?: () => void;
  /** Fired on each railgun / pierce-line shot. */
  onRailgunFire?: () => void;
  private poolMeshes: THREE.Mesh[] = [];
  private lodTrees: Array<{ lod: THREE.LOD; phase: number }> = [];
  private batterySaver = false;
  private heroRig: HeroRig | null = null;
  private heroVisualKey = '';
  private rangeRing: THREE.Mesh;
  private rallyMarker: THREE.Group;
  private rallyShowTimer = 0;
  private particles: ParticleItem[] = [];
  private coins: ParticleItem[] = [];
  private shockRings: ShockRing[] = [];
  private energyBeams: EnergyBeam[] = [];
  private muzzleFlashes: MuzzleFlash[] = [];
  private dyingBodies: DyingBody[] = [];

  private meadowTexCache = new Map<LevelSpec['biome'], THREE.CanvasTexture>();
  private cobbleTexCache = new Map<LevelSpec['biome'], THREE.CanvasTexture>();
  private hemiLight: THREE.HemisphereLight;

  private lowFpsCounter = 0;
  private bloomDisabled = false;
  private animTime = 0;
  private usePostProcessing = true;

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

    this.meadowTexCache.set('forest', createMeadowTexture('forest'));
    this.cobbleTexCache.set('forest', createCobbleRoadTexture('forest'));

    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.955, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: '#ffd966', transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.position.y = 0.07;
    this.rangeRing.visible = false;

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

    this.scene.add(this.levelGroup, this.dynamicGroup, this.rangeRing, this.rallyMarker);
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

    // Velocity-stretched additive impact sparks
    const sparkGeo = new THREE.BoxGeometry(0.045, 0.045, 1);
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
      s.maxLife = 0.16 + Math.random() * 0.16;
      s.life = s.maxLife;
      s.stretch = 0.045 + Math.random() * 0.03;
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

  loadLevel(level: LevelSpec, equippedHat: HatId, heroClass: HeroClassId = 'auto'): void {
    this.clearLevel();

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
    };
    const theme = biomeTheme[level.biome];
    this.scene.background = new THREE.Color(theme.bg);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(theme.fog);
    }
    this.hemiLight.color.set(theme.hemiSky);
    this.hemiLight.groundColor.set(theme.hemiGround);
    this.sunLight.color.set(theme.sunColor);
    this.sunLight.intensity = theme.sunIntensity;

    let meadowTex = this.meadowTexCache.get(level.biome);
    if (!meadowTex) {
      meadowTex = createMeadowTexture(level.biome);
      this.meadowTexCache.set(level.biome, meadowTex);
    }
    let cobbleTex = this.cobbleTexCache.get(level.biome);
    if (!cobbleTex) {
      cobbleTex = createCobbleRoadTexture(level.biome);
      this.cobbleTexCache.set(level.biome, cobbleTex);
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
      const roadMat = new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.88, metalness: 0.02 });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.receiveShadow = true;
      this.levelGroup.add(roadMesh);

      this.levelGroup.add(buildRoadCurbstones(c));
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

    // Sunlit Cream-Sandstone Castle Fortress at end of path
    const castle = createGreatOakCastle();
    castle.position.set(0, 0, -9.8);
    this.levelGroup.add(castle);

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

    // Crystals ONLY in Crystal Cavern (12 clusters) and Frosted Peaks (ice-blue clusters) — InstancedMesh
    const crystalCoords: Array<[number, number, number, number]> =
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
        : level.biome === 'snow'
          ? [
              [-4.2, 5.2, 0.92, 0.2],
              [4.3, 3.8, 0.9, -0.7],
              [-4.4, -5.6, 0.94, 1.1],
              [4.3, -6.0, 0.9, -0.4],
              [-2.8, -8.8, 0.85, 0.5],
              [2.8, -8.8, 0.85, -0.5],
            ]
          : [];
    if (crystalCoords.length > 0) {
      const crysMats = crystalCoords.map(([cx, cz, sc, rot]) => composeMat(cx, 0, cz, rot, sc, sc, sc));
      this.levelGroup.add(
        buildInstancedModelGroup('env_crystal', crysMats, (origMat, meshName) => {
          if (level.biome !== 'snow' || !(origMat instanceof THREE.MeshStandardMaterial)) return origMat;
          const cloned = origMat.clone();
          if (meshName.toLowerCase().includes('glow')) {
            cloned.map = null;
            cloned.emissiveMap = null;
            cloned.color.set('#bceeff');
            cloned.emissive.set('#38bdf8');
          } else {
            cloned.color.lerp(new THREE.Color('#8fe3ff'), 0.45);
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
        new THREE.CylinderGeometry(0.94, 0.94, 0.45, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitArea.position.set(s.x, 0.22, s.z);
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
        new THREE.CylinderGeometry(0.74, 0.74, 0.95, 10),
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
      const pineAll = level.biome === 'snow';
      const baseTrees: Array<[number, number, number, 'oak' | 'pine']> =
        level.biome === 'canyon'
          ? [
              [-4.7, 7.6, 0.9, 'pine'],
              [4.7, 6.2, 0.85, 'oak'],
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
        const [tx, tz, sc, variant] = baseTrees[i];
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

    const heroVariant = resolveHeroVisualVariant(heroClass, 1);
    this.heroVisualKey = `${heroVariant}_${equippedHat}`;
    this.heroRig = createBearHeroRig(equippedHat, heroVariant);
    this.heroRig.root.position.set(level.heroStart.x, 0, level.heroStart.z);
    this.dynamicGroup.add(this.heroRig.root);

    if (import.meta.env.DEV) {
      const stats = countDrawCalls(this.levelGroup);
      console.info(
        `[drawcall] level=${level.id} meshes=${stats.meshes} materials=${stats.materials} estimated=${stats.estimatedDrawCalls}`,
      );
    }
  }

  private clearLevel(): void {
    this.levelGroup.clear();
    this.dynamicGroup.clear();
    this.slotMeshes.clear();
    this.barrelMeshes.clear();
    this.ambientMotes = null;
    this.lanternLights = [];
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
  ): void {
    this.animTime += realDt;
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

      const desiredKey = `${slot.tower.towerId}_${slot.tower.tier}_${slot.tower.branchId ?? ''}_${equippedHat}`;
      if (!existing || existing.key !== desiredKey) {
        if (existing) this.dynamicGroup.remove(existing.rig.root);
        const rig = createTowerRig(slot.tower.towerId, slot.tower.tier, slot.tower.branchId, equippedHat, true);
        rig.root.position.set(slot.x, 0, slot.z);
        this.dynamicGroup.add(rig.root);
        this.towerRigs.set(slot.id, { key: desiredKey, rig });
      }
      const rigRef = this.towerRigs.get(slot.id)!.rig;
      rigRef.turretHead.rotation.y = slot.tower.angle;
      updateTowerAnimation(rigRef, this.animTime, realDt);

      // Defender recoil kick: brief push opposite the shot + squash pop layered on the rig's own scale
      const punch = this.towerPunch.get(slot.id);
      if (punch) {
        punch.elapsed += realDt;
        const dur = 0.16;
        if (punch.elapsed >= dur) {
          this.towerPunch.delete(slot.id);
          rigRef.root.position.set(slot.x, 0, slot.z);
        } else {
          const j = evalHitJolt(punch.elapsed, dur);
          const back = 0.1 * j.push * (this.reducedMotion ? 0.5 : 1);
          rigRef.root.position.set(slot.x - punch.dirX * back, 0, slot.z - punch.dirZ * back);
          const sq = evalSquashPop(dur - punch.elapsed, dur, 1.1, 0.88);
          rigRef.root.scale.set(rigRef.root.scale.x * sq.sx, rigRef.root.scale.y * sq.sy, rigRef.root.scale.z * sq.sz);
        }
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

    // Sync Bear Hero (supports auto-evolution by level or explicit class swap)
    const wantHeroVariant = resolveHeroVisualVariant(sim.heroClass, sim.hero.level);
    const wantHeroKey = `${wantHeroVariant}_${equippedHat}`;
    if (this.heroRig && wantHeroKey !== this.heroVisualKey) {
      const prevRotY = this.heroRig.body.rotation.y;
      const prevPos = this.heroRig.root.position.clone();
      this.dynamicGroup.remove(this.heroRig.root);
      this.heroRig = createBearHeroRig(equippedHat, wantHeroVariant);
      this.heroRig.root.position.copy(prevPos);
      this.heroRig.body.rotation.y = prevRotY;
      this.dynamicGroup.add(this.heroRig.root);
      this.heroVisualKey = wantHeroKey;
    }
    if (this.heroRig) {
      this.heroRig.root.visible = !sim.hero.dead;
      this.heroRig.root.position.set(sim.hero.x, 0, sim.hero.z);
      this.heroRig.body.rotation.y = sim.hero.facingAngle;
      const ringMat = this.heroRig.ring.material as THREE.MeshBasicMaterial;
      if (sim.hero.activeBuff === 'banner') {
        ringMat.color.set('#ffd454');
        ringMat.opacity = 0.72 + Math.sin(this.animTime * 6) * 0.18;
        this.heroRig.ring.scale.setScalar(6.4);
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
      updateEnemyAnimation(rig, this.animTime, walkDt, realDt, e.uid);

      // Directional knockback + backward pitch snap/wobble applied on the root (render-only)
      feel.joltElapsed += realDt;
      const jolt = evalHitJolt(feel.joltElapsed, HIT_JOLT_DURATION);
      rig.root.position.set(e.x + feel.kx * jolt.push, 0, e.z + feel.kz * jolt.push);
      if (jolt.tilt !== 0 && feel.tilt !== 0) {
        rig.root.quaternion.setFromAxisAngle(feel.axis, feel.tilt * jolt.tilt);
      } else if (rig.root.quaternion.w !== 1) {
        rig.root.quaternion.identity();
      }

      // Stark pure-white hit flash on the per-instance cloned materials, exact restore afterwards
      feel.flashElapsed += realDt;
      const fs = hitFlashStrength(feel.flashElapsed, feel.flashDur);
      if (fs > 0) {
        const k = this.reducedMotion ? 0.55 : 1;
        for (const b of feel.bases) {
          b.mat.color.copy(b.color).lerp(WHITE, 0.78 * fs * k);
          b.mat.emissive.copy(WHITE);
          b.mat.emissiveIntensity = HIT_FLASH_EMISSIVE * fs * k;
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

    // Detach killed enemy body briefly for a 0.30s tumbling death pop!
    for (const [uid, rig] of this.enemyRigs.entries()) {
      if (!aliveIds.has(uid)) {
        const feel = this.enemyFeel.get(uid);
        rig.root.remove(rig.body);
        rig.body.position.set(rig.root.position.x, 0.25, rig.root.position.z);
        this.dynamicGroup.add(rig.body);
        this.dyingBodies.push({
          group: rig.body,
          life: 0.3,
          maxLife: 0.3,
          spinX: (uid % 2 === 0 ? 1 : -1) * 8.5,
          spinZ: (uid % 3 === 0 ? 1 : -1) * 7.0,
          bases: feel?.bases ?? [],
          elapsed: 0,
        });
        this.dynamicGroup.remove(rig.root);
        this.enemyRigs.delete(uid);
        this.enemyFeel.delete(uid);
      }
    }

    // Sync projectiles + smoke/glint trails
    const projIds = new Set<number>();
    for (const p of sim.projectiles) {
      projIds.add(p.uid);
      let entry = this.projectileMeshes.get(p.uid);
      if (!entry) {
        const isMortar = Boolean(p.stats.aoeRadius);
        let mesh: THREE.Object3D;
        if (isMortar) {
          const shellGroup = new THREE.Group();
          const ironBall = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 12, 10),
            new THREE.MeshStandardMaterial({ color: '#45505e', roughness: 0.4, metalness: 0.6 }),
          );
          const coreGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 8, 8),
            new THREE.MeshBasicMaterial({ color: '#ff8e3c' }),
          );
          coreGlow.position.y = 0.14;
          shellGroup.add(ironBall, coreGlow);
          mesh = shellGroup;
        } else {
          const isHedgehog = p.towerId === 'hedgehog';
          const color = p.towerId === 'owl' ? '#63e2ff' : isHedgehog ? '#ffc857' : '#ffe169';
          const boltGroup = new THREE.Group();
          const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(isHedgehog ? 0.048 : 0.038, isHedgehog ? 0.065 : 0.05, isHedgehog ? 0.62 : 0.48, 7),
            new THREE.MeshStandardMaterial({
              color,
              emissive: new THREE.Color(color),
              emissiveIntensity: 1.25,
              roughness: 0.3,
            }),
          );
          shaft.rotation.x = Math.PI / 2;
          boltGroup.add(shaft);
          mesh = boltGroup;
        }

        this.dynamicGroup.add(mesh);
        const trailColor = isMortar
          ? '#ff8a2a'
          : p.towerId === 'owl'
            ? p.branchId === 'owl_glacier'
              ? '#a8f0ff'
              : '#45d8ff'
            : p.towerId === 'hedgehog'
              ? '#ffb238'
              : '#ffd84a';
        const trail = this.acquireTrail(trailColor, isMortar ? 0.2 : p.towerId === 'hedgehog' ? 0.13 : 0.1);
        const ddx = p.targetX - p.x;
        const ddz = p.targetZ - p.z;
        const dlen = Math.hypot(ddx, ddz) || 1;
        entry = {
          mesh,
          mortar: isMortar
            ? {
                startX: p.x,
                startZ: p.z,
                targetX: p.targetX,
                targetZ: p.targetZ,
                totalDist: Math.max(0.5, Math.hypot(p.targetX - p.x, p.targetZ - p.z)),
                smokeAccum: 0,
              }
            : undefined,
          trail,
          targetUid: p.targetUid,
          towerId: p.towerId,
          branchId: p.branchId,
          dirX: ddx / dlen,
          dirZ: ddz / dlen,
          aoeRadius: p.stats.aoeRadius ?? 0,
        };
        this.projectileMeshes.set(p.uid, entry);
      }

      // Velocity direction (render-only) for directional knockback & impact sparks
      const vdx = p.targetX - p.x;
      const vdz = p.targetZ - p.z;
      const vlen = Math.hypot(vdx, vdz);
      if (vlen > 1e-4) {
        entry.dirX = vdx / vlen;
        entry.dirZ = vdz / vlen;
      }

      if (entry.mortar) {
        const rem = Math.hypot(entry.mortar.targetX - p.x, entry.mortar.targetZ - p.z);
        const u = Math.max(0, Math.min(1, 1 - rem / entry.mortar.totalDist));
        const arcY = 1.0 + Math.sin(u * Math.PI) * 2.5;
        entry.mesh.position.set(p.x, arcY, p.z);
        entry.mesh.rotation.x += realDt * 12;
        entry.mortar.smokeAccum += realDt;
        if (entry.mortar.smokeAccum >= 0.045) {
          entry.mortar.smokeAccum = 0;
          this.spawnParticles(p.x, arcY, p.z, '#ffb86c', 1, 0.35);
        }
      } else {
        entry.mesh.position.set(p.x, 1.05, p.z);
        entry.mesh.lookAt(p.targetX, 0.72, p.targetZ);
      }
      if (entry.trail) {
        pushTrailPoint(entry.trail, entry.mesh.position.x, entry.mesh.position.y, entry.mesh.position.z);
        rebuildTrail(entry.trail);
      }
    }
    for (const [uid, entry] of this.projectileMeshes.entries()) {
      if (!projIds.has(uid)) {
        if (entry.mortar) {
          const ix = entry.mortar.targetX;
          const iz = entry.mortar.targetZ;
          const r = Math.max(1.2, entry.aoeRadius);
          this.spawnShockRing(ix, iz, '#ffffff', r * 0.75, 0.16);
          this.spawnShockRing(ix, iz, '#ff9436', r * 1.25, 0.42);
          this.spawnShockRing(ix, iz, '#ffe17d', r * 0.95, 0.3);
          this.spawnScorch(ix, iz, r * 0.7);
          this.spawnSparks(ix, 0.35, iz, 0, 0, 0, '#ffcf6b', 18, 9.5);
          this.spawnSparks(ix, 0.3, iz, 0, 0, 0, '#ff7a2a', 8, 6);
          this.spawnParticles(ix, 0.4, iz, '#ff9436', 10, 1.3);
          this.spawnParticles(ix, 0.3, iz, '#4a3c33', 6, 1.0);
          this.spawnMuzzleFlash(ix, 0.45, iz, '#ffb347', 0, 0, true);
          this.cameraCtrl.addTrauma(0.32);
          this.cameraCtrl.addZoomPunch(1.0);
          this.cameraCtrl.addDirectionalKick(entry.dirX, entry.dirZ, 0.1);
          this.onMortarExplode?.();
        } else {
          const ix = entry.mesh.position.x;
          const iz = entry.mesh.position.z;
          const sparkHex = entry.towerId === 'owl' ? '#9eefff' : entry.towerId === 'hedgehog' ? '#ffd27a' : '#fff1b8';
          this.spawnSparks(ix, 0.95, iz, entry.dirX, 0.15, entry.dirZ, sparkHex, entry.towerId === 'hedgehog' ? 7 : 5, 7.5, 0.55);
          if (entry.branchId === 'owl_glacier') {
            this.spawnShockRing(ix, iz, '#c9f6ff', 1.5, 0.34);
            this.spawnSparks(ix, 0.9, iz, 0, 0, 0, '#dffaff', 8, 4.5);
            this.onFreezeImpact?.();
          }
        }
        if (entry.trail) {
          entry.trail.fading = true;
        }
        this.dynamicGroup.remove(entry.mesh);
        this.projectileMeshes.delete(uid);
      }
    }

    // Sync resin pools
    while (this.poolMeshes.length < sim.resinPools.length) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 18),
        new THREE.MeshBasicMaterial({ color: '#e69b35', transparent: true, opacity: 0.48, side: THREE.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.06;
      this.dynamicGroup.add(m);
      this.poolMeshes.push(m);
    }
    for (let i = 0; i < this.poolMeshes.length; i++) {
      const pool: ResinPool | undefined = sim.resinPools[i];
      const m = this.poolMeshes[i];
      m.visible = Boolean(pool);
      if (pool) {
        m.position.set(pool.x, 0.06, pool.z);
        m.scale.setScalar(pool.radius);
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
        joltElapsed: 1,
        kx: 0,
        kz: 0,
        tilt: 0,
        axis: new THREE.Vector3(1, 0, 0),
        visual: 'rest',
      };
      this.enemyFeel.set(uid, feel);
    }
    return feel;
  }

  /** Collect projectiles that vanished this step (they are still in projectileMeshes until sync). */
  private collectImpacts(sim: SimulationEngine | null): ProjectileImpact[] {
    if (!sim) return [];
    const live = new Set<number>();
    for (const p of sim.projectiles) live.add(p.uid);
    const out: ProjectileImpact[] = [];
    for (const [uid, entry] of this.projectileMeshes.entries()) {
      if (live.has(uid)) continue;
      out.push({
        targetUid: entry.targetUid,
        x: entry.mortar ? entry.mortar.targetX : entry.mesh.position.x,
        z: entry.mortar ? entry.mortar.targetZ : entry.mesh.position.z,
        dirX: entry.dirX,
        dirZ: entry.dirZ,
        aoeRadius: entry.aoeRadius,
        towerId: entry.towerId,
        branchId: entry.branchId,
      });
    }
    return out;
  }

  handleSimEvents(events: SimEvent[], sim?: SimulationEngine): void {
    const simRef = sim ?? this.lastSim;
    const impacts = this.collectImpacts(simRef);

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
      } else if (ev.type === 'TOWER_FIRED') {
        const dirX = ev.toX - ev.fromX;
        const dirZ = ev.toZ - ev.fromZ;
        const len = Math.hypot(dirX, dirZ) || 1;
        const ux = dirX / len;
        const uz = dirZ / len;
        const rigRef = this.towerRigs.get(ev.slotId)?.rig;
        if (rigRef) {
          rigRef.recoilTimer = 0.22;
          this.towerPunch.set(ev.slotId, { elapsed: 0, dirX: ux, dirZ: uz });
          const flashCol =
            ev.towerId === 'owl' ? '#68ebff' : ev.towerId === 'beaver' ? '#ff9f38' : ev.towerId === 'hedgehog' ? '#ffc04a' : '#ffe47a';
          const big = ev.towerId === 'beaver' || Boolean(ev.isLine);
          this.spawnMuzzleFlash(ev.fromX + ux * 0.55, 1.45, ev.fromZ + uz * 0.55, flashCol, ux, uz, big);
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
              // Chain-lightning strike: zap sparks + crisp ring at each link
              this.spawnSparks(pos.x, 0.8, pos.z, 0, 0, 0, '#9ff3ff', 6, 6);
              this.spawnShockRing(pos.x, pos.z, '#7fe9ff', 0.9, 0.2);
            }
            if (pts.length === 1) pts.push(new THREE.Vector3(ev.toX, 0.65, ev.toZ));
            this.spawnEnergyBeam(pts, '#5ce1ff', 0.075, 0.18);
            this.spawnEnergyBeam(pts, '#ffffff', 0.028, 0.12);
            this.onChainZap?.();
          } else {
            pts.push(new THREE.Vector3(ev.toX, 0.65, ev.toZ));
            // Railgun line: thick amber beam + white-hot core, sparks along hit enemies
            this.spawnEnergyBeam(pts, '#ffb43c', 0.09, 0.2);
            this.spawnEnergyBeam(pts, '#ffffff', 0.035, 0.13);
            for (const id of ev.targetIds) {
              const pos = enemyPos(id);
              if (pos) this.spawnSparks(pos.x, 0.85, pos.z, ux, 0.1, uz, '#ffd27a', 6, 8, 0.45);
            }
            this.cameraCtrl.addTrauma(0.14);
            this.cameraCtrl.addDirectionalKick(ux, uz, 0.06);
            this.onRailgunFire?.();
          }
        }
      } else if (ev.type === 'ENEMY_HIT') {
        const rig = this.enemyRigs.get(ev.enemyId);
        // Resolve the impulse direction: projectile velocity > radial from AOE > beam > backward fallback
        let dx = 0;
        let dz = 0;
        let heavySource = false;
        let glacier = false;
        const direct = impacts.find((i) => i.targetUid === ev.enemyId && i.aoeRadius <= 0);
        const aoe = direct ? undefined : impacts.find((i) => i.aoeRadius > 0 && Math.hypot(ev.x - i.x, ev.z - i.z) <= i.aoeRadius + 0.6);
        const beam = beamDirs.get(ev.enemyId);
        if (direct) {
          dx = direct.dirX;
          dz = direct.dirZ;
          heavySource = direct.towerId === 'hedgehog';
          glacier = direct.branchId === 'owl_glacier';
        } else if (aoe) {
          dx = ev.x - aoe.x;
          dz = ev.z - aoe.z;
          if (Math.hypot(dx, dz) < 0.05) {
            dx = aoe.dirX;
            dz = aoe.dirZ;
          }
          heavySource = true;
        } else if (beam) {
          dx = beam.dx;
          dz = beam.dz;
          heavySource = beam.heavy;
        } else if (rig) {
          dx = -Math.sin(rig.body.rotation.y);
          dz = -Math.cos(rig.body.rotation.y);
        }
        const heavy = ev.isCrit || ev.armorBroken || heavySource;

        if (rig) {
          const feel = this.getEnemyFeel(ev.enemyId, rig);
          feel.flashElapsed = 0;
          feel.flashDur = heavy ? HIT_FLASH_DURATION * 1.1 : HIT_FLASH_DURATION;
          // Squash-stretch pop from ModelFactory; its own knock is replaced by our directional root jolt.
          rig.hitJoltTimer = 0.16;
          rig.flashTimer = 0;
          rig.knockX = 0;
          rig.knockZ = 0;
          const kb = computeKnockback(dx, dz, heavy, { isBoss: ev.isBoss, reducedMotion: this.reducedMotion });
          const stillStrong = feel.joltElapsed < HIT_JOLT_DURATION * 0.35 && Math.hypot(feel.kx, feel.kz) > kb.distance;
          if (!stillStrong && kb.distance > 0) {
            feel.kx = kb.dx;
            feel.kz = kb.dz;
            feel.tilt = kb.tiltRad;
            feel.axis.set(kb.dz, 0, -kb.dx).normalize();
            feel.joltElapsed = 0;
          }
        }

        const sparkHex = ev.isCrit ? '#ffe85c' : ev.armorBroken ? '#68ebff' : glacier ? '#dffaff' : '#ffd08a';
        this.spawnSparks(ev.x, 0.8, ev.z, dx, 0.2, dz, sparkHex, heavy ? 9 : 4, heavy ? 9 : 6.5, heavy ? 0.6 : 0.45);
        if (heavy) {
          this.spawnParticles(ev.x, 0.68, ev.z, sparkHex, 5, 1.0);
        }
        if (ev.isCrit || ev.armorBroken) {
          this.spawnShockRing(ev.x, ev.z, '#ffffff', 0.8, 0.14, 0.7);
          this.spawnShockRing(ev.x, ev.z, sparkHex, 1.35);
          this.cameraCtrl.addTrauma(0.2);
          this.cameraCtrl.addZoomPunch(1.1);
        } else {
          this.cameraCtrl.addTrauma(heavy ? 0.08 : 0.04);
        }
      } else if (ev.type === 'ENEMY_KILLED') {
        const boss = ev.isBoss;
        this.spawnShockRing(ev.x, ev.z, '#ffffff', boss ? 2.0 : 0.9, 0.16);
        this.spawnShockRing(ev.x, ev.z, boss ? '#ff7a38' : '#ffd266', boss ? 3.4 : 1.5);
        this.spawnSparks(ev.x, 0.6, ev.z, 0, 0, 0, boss ? '#ffb347' : '#ffe39a', boss ? 30 : 10, boss ? 10 : 7);
        // Rewarding debris pop: brass + scrap-metal chunks
        this.spawnParticles(ev.x, 0.55, ev.z, boss ? '#ff8b3d' : '#d9a443', boss ? 18 : 6, boss ? 1.5 : 1.1);
        this.spawnParticles(ev.x, 0.5, ev.z, '#8d99a6', boss ? 12 : 5, boss ? 1.3 : 1.0);
        this.spawnFlyingCoins(ev.x, ev.z, boss ? 8 : 3);
        if (boss) this.spawnScorch(ev.x, ev.z, 1.6);
        this.cameraCtrl.addTrauma(boss ? 0.8 : 0.14);
        if (boss) this.cameraCtrl.addZoomPunch(2.2);
      } else if (ev.type === 'PINECONE_RAIN') {
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 2.0, 0.18);
        this.spawnShockRing(ev.x, ev.z, '#ff9f43', 3.6, 0.45);
        this.spawnShockRing(ev.x, ev.z, '#ffe17d', 2.4);
        this.spawnScorch(ev.x, ev.z, 2.2);
        this.spawnSparks(ev.x, 0.5, ev.z, 0, 0, 0, '#ffcf6b', 26, 10);
        this.spawnParticles(ev.x, 0.7, ev.z, '#ff9f43', 18, 1.45);
        this.spawnParticles(ev.x, 0.5, ev.z, '#6b4a2e', 8, 1.2);
        this.cameraCtrl.addTrauma(0.56);
        this.cameraCtrl.addZoomPunch(1.8);
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
        if (this.heroRig) {
          this.heroRig.attackTimer = 0.36;
          this.heroRig.body.rotation.y = Math.atan2(ev.targetX - ev.x, ev.targetZ - ev.z);
        }
        const hx = ev.targetX - ev.x;
        const hz = ev.targetZ - ev.z;
        this.spawnSparks(ev.targetX, 0.65, ev.targetZ, hx, 0.25, hz, '#ffe27a', 5, 6.5, 0.5);
      } else if (ev.type === 'HERO_ULTIMATE') {
        if (this.heroRig) this.heroRig.attackTimer = 0.42;
        const col = ev.variant === 'viking' ? '#ff7b3b' : ev.variant === 'royal' ? '#ffd84f' : '#80f272';
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 1.8, 0.18);
        this.spawnShockRing(ev.x, ev.z, col, 3.8, 0.45);
        this.spawnSparks(ev.x, 0.55, ev.z, 0, 0, 0, col, 24, 9.5);
        this.spawnParticles(ev.x, 0.55, ev.z, col, 16, 1.35);
        if (ev.variant !== 'royal') this.spawnScorch(ev.x, ev.z, 1.6);
        this.cameraCtrl.addTrauma(0.5);
        this.cameraCtrl.addZoomPunch(1.5);
      } else if (ev.type === 'HERO_CLAW_SHOCK') {
        if (this.heroRig) this.heroRig.attackTimer = 0.26;
        this.spawnShockRing(ev.x, ev.z, '#ffffff', 1.6, 0.16);
        this.spawnShockRing(ev.x, ev.z, '#95e06c', 3.0);
        this.spawnScorch(ev.x, ev.z, 1.1);
        this.spawnSparks(ev.x, 0.45, ev.z, 0, 0, 0, '#c8ff9a', 16, 8);
        this.spawnParticles(ev.x, 0.45, ev.z, '#95e06c', 12, 1.2);
        this.cameraCtrl.addTrauma(0.36);
        this.cameraCtrl.addZoomPunch(1.1);
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
        (r.mesh.material as THREE.Material).dispose();
      } else {
        const k = 1 - r.life / r.maxLife;
        r.mesh.scale.setScalar(0.2 + easeOutCubic(k) * r.maxScale);
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
        // Death pop: one stark white flash frame pair, then tumble + shrink
        const fs = hitFlashStrength(db.elapsed, HIT_FLASH_DURATION * 1.2);
        for (const b of db.bases) {
          b.mat.color.copy(b.color).lerp(WHITE, 0.85 * fs);
          b.mat.emissive.copy(fs > 0 ? WHITE : b.emissive);
          b.mat.emissiveIntensity = fs > 0 ? HIT_FLASH_EMISSIVE * fs : b.emissiveIntensity;
        }
        const k = db.life / db.maxLife;
        db.group.rotation.x += db.spinX * dt;
        db.group.rotation.z += db.spinZ * dt;
        db.group.position.y += (k - 0.3) * dt * 3.0;
        const pop = db.elapsed < 0.06 ? 1 + 0.25 * (db.elapsed / 0.06) : 1.25 * k;
        db.group.scale.setScalar(Math.max(0.05, pop));
        nextDying.push(db);
      }
    }
    this.dyingBodies = nextDying;
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

  pickWorld(clientX: number, clientY: number): { slotId: string | null; barrelId: string | null; x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);

    const barrelHitsTargets: THREE.Object3D[] = [];
    for (const bv of this.barrelMeshes.values()) {
      if (bv.alive) barrelHitsTargets.push(bv.hitArea);
    }
    if (barrelHitsTargets.length > 0) {
      const bHits = this.raycaster.intersectObjects(barrelHitsTargets, false);
      if (bHits.length > 0) {
        const barrelId = (bHits[0].object.userData as { barrelId?: string }).barrelId ?? null;
        return { slotId: null, barrelId, x: bHits[0].point.x, z: bHits[0].point.z };
      }
    }

    const hitAreas: THREE.Object3D[] = [];
    for (const v of this.slotMeshes.values()) hitAreas.push(v.hitArea);
    const slotHits = this.raycaster.intersectObjects(hitAreas, false);
    if (slotHits.length > 0) {
      const slotId = (slotHits[0].object.userData as { slotId?: string }).slotId ?? null;
      return { slotId, barrelId: null, x: slotHits[0].point.x, z: slotHits[0].point.z };
    }

    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, pt)) {
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
    return id === 'squirrel' ? '#e07a3c' : id === 'beaver' ? '#b97a4b' : id === 'owl' ? '#5da9e9' : '#7c8b6f';
  }
}

export type { SlotState, EnemyInstance, ProjectileInstance };

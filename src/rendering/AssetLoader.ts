import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMIES } from '../data/enemies.ts';
import type { LevelSpec } from '../data/levels.ts';
import type { HatId } from '../data/towers.ts';

export const MODEL_NAMES = [
  'env_castle',
  'env_cliff_segment',
  'env_crystal',
  'env_tree_oak',
  'env_tree_pine',
  'env_lantern',
  'env_fence',
  'env_slot_pad',
  'env_stump',
  'tower_squirrel_t1',
  'tower_squirrel_t2',
  'tower_squirrel_sniper',
  'tower_squirrel_gatling',
  'tower_beaver_t1',
  'tower_beaver_t2',
  'tower_beaver_mortar',
  'tower_beaver_resin',
  'tower_owl_t1',
  'tower_owl_t2',
  'tower_owl_chain',
  'tower_owl_blizzard',
  'tower_hedgehog_t1',
  'tower_hedgehog_t2',
  'tower_hedgehog_rail',
  'tower_hedgehog_shred',
  'hero_bear',
  'hero_bear_viking',
  'hero_bear_royal',
  'hero_fox',
  'hero_boar',
  'hat_pirate',
  'hat_chef',
  'hat_wizard',
  'hat_viking',
  'enemy_scout_bot',
  'enemy_swarm_saw',
  'enemy_shield_loader',
  'enemy_hover_drone',
  'enemy_mega_harvester',
  'enemy_turbo_hopper',
  'enemy_chomp_brute',
  'enemy_repair_drone',
  'enemy_crystal_golem',
  'enemy_cryo_colossus',
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

export interface LoadedModelInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  materials: THREE.MeshStandardMaterial[];
}

const loader = new GLTFLoader();
const cache = new Map<string, GLTF>();
const inFlight = new Map<string, Promise<GLTF>>();
let preloadPromise: Promise<void> | null = null;
let bgWarmStarted = false;

export const BOOT_ESSENTIAL_MODELS: readonly ModelName[] = [
  'env_castle',
  'env_cliff_segment',
  'env_tree_oak',
  'env_tree_pine',
  'env_lantern',
  'env_fence',
  'env_slot_pad',
  'env_stump',
  'tower_squirrel_t1',
  'tower_beaver_t1',
  'tower_owl_t1',
  'tower_hedgehog_t1',
  'hero_bear',
  'enemy_scout_bot',
  'enemy_swarm_saw',
];

function resolveModelUrl(name: string): string {
  return `./models/${name}.glb`;
}

function normalizeMaterial(mat: THREE.Material): THREE.Material {
  if (mat instanceof THREE.MeshStandardMaterial) {
    const glossy =
      /eye|iris|glass|catchlight|crystal|glow/i.test(mat.name) ||
      mat.roughness <= 0.22;
    if (glossy) {
      mat.envMapIntensity = 1.1;
      mat.roughness = Math.max(mat.roughness, 0.05);
    } else {
      // Ensure consistent matte stylized shading across imported CC0 packs
      mat.envMapIntensity = 0.72;
      if (mat.metalness < 0.35) {
        mat.roughness = Math.max(mat.roughness, 0.62);
      }
    }
  }
  return mat;
}

async function loadModelOnce(name: string): Promise<GLTF> {
  const cached = cache.get(name);
  if (cached) return cached;
  const active = inFlight.get(name);
  if (active) return active;

  const job = loader.loadAsync(resolveModelUrl(name)).then(
    (gltf) => {
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(normalizeMaterial);
          } else if (mesh.material) {
            mesh.material = normalizeMaterial(mesh.material);
          }
        }
      });
      cache.set(name, gltf);
      inFlight.delete(name);
      return gltf;
    },
    (err: unknown) => {
      inFlight.delete(name);
      throw err;
    },
  );
  inFlight.set(name, job);
  return job;
}

export async function ensureModelsLoaded(
  names: readonly ModelName[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const unique = Array.from(new Set(names));
  const total = unique.length;
  if (total === 0) {
    onProgress?.(1, 1);
    return;
  }
  let loaded = 0;
  await Promise.all(
    unique.map(async (name) => {
      await loadModelOnce(name);
      loaded += 1;
      onProgress?.(loaded, total);
    }),
  );
}

export async function preloadBootModels(
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return ensureModelsLoaded(BOOT_ESSENTIAL_MODELS, onProgress);
}

export function warmRemainingModelsInBackground(): void {
  if (bgWarmStarted) return;
  bgWarmStarted = true;
  const remaining = MODEL_NAMES.filter((name) => !cache.has(name));
  void (async () => {
    for (const name of remaining) {
      try {
        await loadModelOnce(name);
      } catch {
        // Background warm-up failures are retried cleanly on explicit ensureModelsLoaded()
      }
    }
  })();
}

export function getLevelModelDependencies(
  level: LevelSpec,
  heroModels: readonly ModelName[],
  hatId: HatId,
): ModelName[] {
  const deps = new Set<ModelName>([
    'env_castle',
    'env_cliff_segment',
    'env_slot_pad',
    'env_lantern',
    // Keep all tower evolutions ready so mid-wave upgrades never stall
    'tower_squirrel_t1',
    'tower_squirrel_t2',
    'tower_squirrel_sniper',
    'tower_squirrel_gatling',
    'tower_beaver_t1',
    'tower_beaver_t2',
    'tower_beaver_mortar',
    'tower_beaver_resin',
    'tower_owl_t1',
    'tower_owl_t2',
    'tower_owl_chain',
    'tower_owl_blizzard',
    'tower_hedgehog_t1',
    'tower_hedgehog_t2',
    'tower_hedgehog_rail',
    'tower_hedgehog_shred',
    // PvP merc units may arrive regardless of campaign wave table
    'enemy_scout_bot',
    'enemy_shield_loader',
    'enemy_chomp_brute',
    'enemy_swarm_saw',
  ]);

  if (level.slots.some((s) => s.lockedByStump)) deps.add('env_stump');
  if (level.biome === 'cavern' || level.biome === 'snow') deps.add('env_crystal');
  if (level.biome !== 'cavern') {
    deps.add('env_tree_oak');
    deps.add('env_tree_pine');
    deps.add('env_fence');
  }
  for (const hm of heroModels) deps.add(hm);
  if (hatId !== 'none') deps.add(`hat_${hatId}`);

  for (const w of level.waves) {
    for (const g of w.groups) {
      deps.add(`enemy_${g.enemyId}`);
      const spec = ENEMIES[g.enemyId];
      if (spec.splitOnDeath) deps.add(`enemy_${spec.splitOnDeath.enemyId}`);
      if (spec.phase2Summon) deps.add(`enemy_${spec.phase2Summon.enemyId}`);
    }
  }
  return Array.from(deps);
}

export async function preloadAllModels(
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = ensureModelsLoaded(MODEL_NAMES, onProgress).then(
    () => undefined,
    (err: unknown) => {
      preloadPromise = null;
      throw err;
    },
  );

  return preloadPromise;
}

export function isModelsLoaded(): boolean {
  return cache.size >= MODEL_NAMES.length;
}

export function instantiateModel(
  name: string,
  cloneMaterials = false,
): LoadedModelInstance | null {
  const gltf = cache.get(name);
  if (!gltf) return null;

  const cloned = SkeletonUtils.clone(gltf.scene);
  const scene = cloned instanceof THREE.Group ? cloned : new THREE.Group().add(cloned);
  const materials: THREE.MeshStandardMaterial[] = [];
  const matCloneMap = new Map<THREE.Material, THREE.Material>();

  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const lowerName = mesh.name.toLowerCase();
      const noShadow = lowerName.includes('shadow') || lowerName.includes('glow') || lowerName.includes('aura');
      mesh.castShadow = !noShadow;
      mesh.receiveShadow = !lowerName.includes('glow') && !lowerName.includes('aura');

      if (cloneMaterials && mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => {
            let copy = matCloneMap.get(m);
            if (!copy) {
              copy = m.clone();
              matCloneMap.set(m, copy);
            }
            if (copy instanceof THREE.MeshStandardMaterial) materials.push(copy);
            return copy;
          });
        } else {
          let copy = matCloneMap.get(mesh.material);
          if (!copy) {
            copy = mesh.material.clone();
            matCloneMap.set(mesh.material, copy);
          }
          mesh.material = copy;
          if (copy instanceof THREE.MeshStandardMaterial) materials.push(copy);
        }
      }
    }
  });

  return {
    scene,
    animations: gltf.animations,
    materials,
  };
}

export interface StaticPrimitive {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
}

export function extractStaticPrimitives(name: ModelName): StaticPrimitive[] {
  const gltf = cache.get(name);
  if (!gltf) return [];
  gltf.scene.updateMatrixWorld(true);
  const out: StaticPrimitive[] = [];
  gltf.scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    const lower = mesh.name.toLowerCase();
    const noShadow = lower.includes('shadow') || lower.includes('glow') || lower.includes('aura');
    out.push({
      name: mesh.name,
      geometry: geo,
      material: mat,
      castShadow: !noShadow,
      receiveShadow: !lower.includes('glow') && !lower.includes('aura'),
    });
  });
  return out;
}

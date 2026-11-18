import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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
let preloadPromise: Promise<void> | null = null;

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

export async function preloadAllModels(
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  if (preloadPromise) return preloadPromise;

  const total = MODEL_NAMES.length;
  let loaded = 0;

  preloadPromise = Promise.all(
    MODEL_NAMES.map(async (name) => {
      if (cache.has(name)) {
        loaded += 1;
        onProgress?.(loaded, total);
        return;
      }
      const gltf = await loader.loadAsync(resolveModelUrl(name));
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
      loaded += 1;
      onProgress?.(loaded, total);
    }),
  ).then(
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

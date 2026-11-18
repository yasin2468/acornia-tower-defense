import * as THREE from 'three';

export interface DrawCallStats {
  meshes: number;
  materials: number;
  estimatedDrawCalls: number;
}

export function countDrawCalls(root: THREE.Object3D): DrawCallStats {
  let meshes = 0;
  let estimatedDrawCalls = 0;
  const materials = new Set<THREE.Material>();

  const collectMaterial = (mat: THREE.Material | THREE.Material[]): void => {
    if (Array.isArray(mat)) {
      for (const m of mat) materials.add(m);
    } else {
      materials.add(mat);
    }
  };

  const visit = (obj: THREE.Object3D): void => {
    if (!obj.visible) return;
    if (obj instanceof THREE.InstancedMesh) {
      meshes += 1;
      collectMaterial(obj.material);
      estimatedDrawCalls += 1;
    } else if (obj instanceof THREE.Mesh) {
      meshes += 1;
      collectMaterial(obj.material);
      estimatedDrawCalls += Array.isArray(obj.material) ? obj.material.length : 1;
    }
    for (const child of obj.children) visit(child);
  };

  visit(root);

  return { meshes, materials: materials.size, estimatedDrawCalls };
}

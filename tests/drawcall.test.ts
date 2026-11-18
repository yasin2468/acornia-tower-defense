import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { countDrawCalls } from '../src/rendering/DrawCallCounter.ts';

describe('DrawCallCounter (C1, G1 olcum ayagi)', () => {
  it('sentetik sahne: 3 mesh ayni materyal + 1 InstancedMesh dogru sayilir', () => {
    const shared = new THREE.MeshStandardMaterial({ color: '#ff0000' });
    const instMat = new THREE.MeshStandardMaterial({ color: '#00ff00' });
    const group = new THREE.Group();

    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
      mesh.position.set(i * 2, 0, 0);
      group.add(mesh);
    }

    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 8), instMat, 40);
    for (let i = 0; i < 40; i++) {
      inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 0.5, 2, 0));
    }
    group.add(inst);

    const stats = countDrawCalls(group);
    assert.equal(stats.meshes, 4);
    assert.equal(stats.materials, 2);
    assert.equal(stats.estimatedDrawCalls, 4);
  });

  it('InstancedMesh ornek sayisi cagri sayisini artirmaz', () => {
    const mat = new THREE.MeshBasicMaterial();
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 40);
    for (let i = 0; i < 40; i++) {
      inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 0, 0));
    }
    const stats = countDrawCalls(inst);
    assert.equal(stats.meshes, 1);
    assert.equal(stats.materials, 1);
    assert.equal(stats.estimatedDrawCalls, 1);
  });

  it('ayni materyal kimligi tek materyal olarak sayilir', () => {
    const mat = new THREE.MeshBasicMaterial();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), mat));
    const stats = countDrawCalls(group);
    assert.equal(stats.meshes, 2);
    assert.equal(stats.materials, 1);
    assert.equal(stats.estimatedDrawCalls, 2);
  });

  it('gorunmez nesne ve gorunmez alt agac sayilmaz', () => {
    const mat = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();

    const visibleMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    root.add(visibleMesh);

    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    hiddenGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    hiddenGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial()));
    root.add(hiddenGroup);

    const invisibleMesh = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshBasicMaterial());
    invisibleMesh.visible = false;
    root.add(invisibleMesh);

    const stats = countDrawCalls(root);
    assert.equal(stats.meshes, 1);
    assert.equal(stats.estimatedDrawCalls, 1);
  });

  it('cok materyalli (array) mesh her materyal icin bir cagri ekler', () => {
    const mats = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.clearGroups();
    geo.addGroup(0, 3, 0);
    geo.addGroup(3, 3, 1);
    const mesh = new THREE.Mesh(geo, mats);
    const stats = countDrawCalls(mesh);
    assert.equal(stats.meshes, 1);
    assert.equal(stats.materials, 2);
    assert.equal(stats.estimatedDrawCalls, 2);
  });
});

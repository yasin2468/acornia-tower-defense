import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { computeBattleStars, computeSellRefund, STAR_2_HP_THRESHOLD, STAR_3_HP_THRESHOLD } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import { BOOT_ESSENTIAL_MODELS, getLevelModelDependencies, MODEL_NAMES } from '../src/rendering/AssetLoader.ts';
import { countDrawCalls } from '../src/rendering/DrawCallCounter.ts';
import { createPropLOD } from '../src/rendering/ModelFactory.ts';

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

  it('G1: env_castle ve cevre GLB modelleri tek difuz mesh + tek materyal olarak paketlenmistir', () => {
    const singleAtlasModels = [
      'env_castle.glb',
      'env_slot_pad.glb',
      'env_cliff_segment.glb',
      'env_tree_oak.glb',
      'env_tree_pine.glb',
      'env_fence.glb',
      'env_lantern.glb',
      'env_stump.glb',
    ];
    for (const file of singleAtlasModels) {
      const buf = fs.readFileSync(path.resolve('public/models', file));
      const chunkLen = buf.readUInt32LE(12);
      const gltf = JSON.parse(buf.subarray(20, 20 + chunkLen).toString('utf8'));
      assert.equal(gltf.meshes.length, 1, `${file} 1 mesh olmali`);
      assert.equal(gltf.materials.length, 1, `${file} 1 materyal olmali`);
    }

    const crysBuf = fs.readFileSync(path.resolve('public/models', 'env_crystal.glb'));
    const crysJson = JSON.parse(crysBuf.subarray(20, 20 + crysBuf.readUInt32LE(12)).toString('utf8'));
    assert.equal(crysJson.meshes.length, 2, 'env_crystal.glb kaya + glow olarak 2 mesh olmali');
    assert.equal(crysJson.materials.length, 2, 'env_crystal.glb 2 materyal olmali');
  });

  it('G1: createPropLOD uzak mesafede vekil seviyeye gecer ve countDrawCalls yalnizca aktif seviyeyi sayar', () => {
    const high = new THREE.Group();
    high.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
    const lod = createPropLOD(high, '#5aa650', 0.85, 2.4, 22);
    lod.position.set(0, 0, 0);

    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 2, 10);
    cam.updateMatrixWorld(true);
    lod.update(cam);
    assert.equal(lod.getCurrentLevel(), 0);
    assert.equal(countDrawCalls(lod).estimatedDrawCalls, 1);

    cam.position.set(0, 2, 30);
    cam.updateMatrixWorld(true);
    lod.update(cam);
    assert.equal(lod.getCurrentLevel(), 1);
    assert.equal(countDrawCalls(lod).estimatedDrawCalls, 1);
  });

  it('T-A: tek kaynak yıldız/iade yardımcıları ve seviye-öncelikli lazy GLB bağımlılıkları tutarlıdır', () => {
    assert.equal(computeBattleStars(STAR_3_HP_THRESHOLD, false), 3);
    assert.equal(computeBattleStars(STAR_2_HP_THRESHOLD, false), 2);
    assert.equal(computeBattleStars(STAR_2_HP_THRESHOLD - 1, false), 1);
    assert.equal(computeBattleStars(1, true), 3);
    assert.equal(computeSellRefund(125), 75);

    assert.ok(BOOT_ESSENTIAL_MODELS.length < MODEL_NAMES.length, 'acilis seti tum 43 modelden kucuk olmali');
    const l1Deps = getLevelModelDependencies(LEVELS[0], ['hero_bear'], 'none');
    assert.ok(l1Deps.includes('env_stump'));
    assert.ok(!l1Deps.includes('env_crystal'), 'Lv1 orman bolumunde kristal indirilmemeli');
    assert.ok(!l1Deps.includes('enemy_cryo_colossus'), 'Lv1 bolumunde buz boss indirilmemeli');

    const l12Deps = getLevelModelDependencies(LEVELS[11], ['hero_bear'], 'wizard');
    assert.ok(l12Deps.includes('hat_wizard'));
    assert.ok(l12Deps.includes('enemy_cryo_colossus'));
    assert.ok(l12Deps.includes('enemy_crystal_golem'), 'Faz 2 cagrilan crystal_golem otomatik dahil olmali');
  });
});

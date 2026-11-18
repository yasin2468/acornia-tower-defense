import * as THREE from 'three';
import { evalSquashPop } from '../core/JuiceController.ts';
import { ENEMIES, type EnemyId, type HeroVisualVariant } from '../data/enemies.ts';
import type { EvolutionBranchId, HatId, TowerId } from '../data/towers.ts';
import { instantiateModel } from './AssetLoader.ts';

function fallbackBox(hex: string, size = 0.6): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }),
  );
  mesh.position.y = size * 0.5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

export function createHatMesh(hatId: HatId): THREE.Group | null {
  if (hatId === 'none') return null;
  const inst = instantiateModel(`hat_${hatId}`);
  return inst ? inst.scene : null;
}

export function createStoneSlotPad(): THREE.Group {
  const inst = instantiateModel('env_slot_pad');
  return inst ? inst.scene : fallbackBox('#b9b4a7', 0.12);
}

export function createStumpProp(): THREE.Group {
  const inst = instantiateModel('env_stump');
  return inst ? inst.scene : fallbackBox('#6b472d', 0.55);
}

export function createCliffProp(scale = 1): THREE.Group {
  const inst = instantiateModel('env_cliff_segment');
  const g = inst ? inst.scene : fallbackBox('#c96e40', 1.4);
  g.scale.setScalar(scale);
  return g;
}

export function createCrystalProp(scale = 1): THREE.Group {
  const inst = instantiateModel('env_crystal');
  const g = inst ? inst.scene : fallbackBox('#9b5de5', 0.6);
  g.scale.setScalar(scale);
  return g;
}

export function createFenceProp(): THREE.Group {
  const inst = instantiateModel('env_fence');
  return inst ? inst.scene : fallbackBox('#a87447', 0.35);
}

export function createPropLOD(
  highDetail: THREE.Object3D,
  proxyColor: string,
  radius: number,
  height: number,
  distance = 22,
): THREE.LOD {
  const lod = new THREE.LOD();
  highDetail.visible = true;
  lod.addLevel(highDetail, 0);

  const proxyGeo = new THREE.ConeGeometry(radius, height, 7);
  proxyGeo.translate(0, height * 0.5, 0);
  const proxyMat = new THREE.MeshStandardMaterial({ color: proxyColor, roughness: 0.9, metalness: 0.0 });
  const lowProxy = new THREE.Mesh(proxyGeo, proxyMat);
  lowProxy.castShadow = true;
  lowProxy.receiveShadow = true;
  lowProxy.visible = false;
  lod.addLevel(lowProxy, distance);
  return lod;
}

export interface TowerRig {
  root: THREE.Group;
  turretHead: THREE.Object3D;
  characterGroup: THREE.Object3D;
  weaponGroup: THREE.Object3D;
  headSocket: THREE.Object3D;
  recoilTimer: number;
  spawnTimer: number;
  extraParts: THREE.Object3D[];
  spinSpeed?: number;
}

function resolveTowerModelName(
  towerId: TowerId,
  tier: 1 | 2 | 3,
  branchId: EvolutionBranchId | undefined,
): string {
  if (tier === 1) return `tower_${towerId}_t1`;
  if (tier === 2) return `tower_${towerId}_t2`;
  switch (branchId) {
    case 'squirrel_sniper':
      return 'tower_squirrel_sniper';
    case 'squirrel_gatling':
      return 'tower_squirrel_gatling';
    case 'beaver_stun':
      return 'tower_beaver_mortar';
    case 'beaver_resin':
      return 'tower_beaver_resin';
    case 'owl_chain':
      return 'tower_owl_chain';
    case 'owl_glacier':
      return 'tower_owl_blizzard';
    case 'hedgehog_pierce':
      return 'tower_hedgehog_rail';
    case 'hedgehog_shred':
      return 'tower_hedgehog_shred';
    default:
      return `tower_${towerId}_t2`;
  }
}

export function createTowerRig(
  towerId: TowerId,
  tier: 1 | 2 | 3,
  branchId: EvolutionBranchId | undefined,
  hatId: HatId,
  animateSpawn = true,
): TowerRig {
  const modelName = resolveTowerModelName(towerId, tier, branchId);
  const inst = instantiateModel(modelName);
  const root = inst ? inst.scene : fallbackBox('#d68444', 0.9);

  const turretHead = root.getObjectByName('TurretHead') ?? new THREE.Group();
  const characterGroup = root.getObjectByName('CharacterGroup') ?? turretHead;
  const weaponGroup = root.getObjectByName('WeaponGroup') ?? new THREE.Group();
  const headSocket = root.getObjectByName('HeadSocket') ?? new THREE.Object3D();

  const extraParts: THREE.Object3D[] = [];
  const spin = root.getObjectByName('SpinPart');
  if (spin) extraParts.push(spin);

  const hat = createHatMesh(hatId);
  if (hat) {
    characterGroup.traverse((obj) => {
      if (obj.name.startsWith('NativeHat')) obj.visible = false;
    });
    headSocket.add(hat);
  }

  const spinSpeed =
    branchId === 'hedgehog_shred' ? 12.0 : branchId === 'squirrel_gatling' ? 7.5 : 2.6;

  return {
    root,
    turretHead,
    characterGroup,
    weaponGroup,
    headSocket,
    recoilTimer: 0,
    spawnTimer: animateSpawn ? 0.28 : 0,
    extraParts,
    spinSpeed,
  };
}

export function updateTowerAnimation(rig: TowerRig, time: number, dt: number): void {
  if (rig.spawnTimer > 0) {
    rig.spawnTimer = Math.max(0, rig.spawnTimer - dt);
    const s = evalSquashPop(rig.spawnTimer, 0.28, 1.28, 0.72);
    rig.root.scale.set(s.sx, s.sy, s.sz);
  } else {
    rig.root.scale.set(1, 1, 1);
  }

  const breathe = 1 + Math.sin(time * 2.8) * 0.024;
  rig.characterGroup.scale.set(1, breathe, 1);

  if (rig.recoilTimer > 0) {
    rig.recoilTimer = Math.max(0, rig.recoilTimer - dt);
    const s = evalSquashPop(rig.recoilTimer, 0.22, 1.20, 0.82);
    rig.turretHead.scale.set(s.sx, s.sy, s.sz);
    rig.weaponGroup.position.z = -0.18 * (rig.recoilTimer / 0.22);
  } else {
    rig.turretHead.scale.set(1, 1, 1);
    rig.weaponGroup.position.z = 0;
  }

  const spinRate = rig.spinSpeed ?? 2.6;
  for (const part of rig.extraParts) {
    part.rotation.y += dt * spinRate;
  }
}

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Object3D;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  cape?: THREE.Object3D;
  headSocket: THREE.Object3D;
  ring: THREE.Mesh;
  attackTimer: number;
  mixer?: THREE.AnimationMixer;
  idleAction?: THREE.AnimationAction;
  walkAction?: THREE.AnimationAction;
  attackAction?: THREE.AnimationAction;
  activeClip?: 'idle' | 'walk' | 'attack';
}

export function createBearHeroRig(hatId: HatId, variant: HeroVisualVariant = 'classic'): HeroRig {
  const root = new THREE.Group();
  const modelName =
    variant === 'viking' ? 'hero_bear_viking' : variant === 'royal' ? 'hero_bear_royal' : 'hero_bear';
  const inst = instantiateModel(modelName) ?? instantiateModel('hero_bear');
  const body = inst ? (inst.scene.getObjectByName('Body') ?? inst.scene) : fallbackBox('#915b3b', 1.1);
  if (inst && body !== inst.scene) {
    root.add(inst.scene);
  } else {
    root.add(body);
  }

  const legL = body.getObjectByName('LegL');
  const legR = body.getObjectByName('LegR');
  const armL = body.getObjectByName('ArmL');
  const armR = body.getObjectByName('ArmR');
  const cape = body.getObjectByName('Cape');
  const headSocket = body.getObjectByName('HeadSocket') ?? new THREE.Object3D();

  const hat = createHatMesh(hatId);
  if (hat) {
    body.traverse((obj) => {
      if (obj.name.startsWith('NativeHat')) obj.visible = false;
    });
    headSocket.add(hat);
  }

  let mixer: THREE.AnimationMixer | undefined;
  let idleAction: THREE.AnimationAction | undefined;
  let walkAction: THREE.AnimationAction | undefined;
  let attackAction: THREE.AnimationAction | undefined;
  let activeClip: 'idle' | 'walk' | 'attack' | undefined;
  if (inst && inst.animations.length > 0) {
    mixer = new THREE.AnimationMixer(body);
    const idleClip =
      inst.animations.find((a) => /^(idle|2h_melee_idle)$/i.test(a.name)) ?? inst.animations[0];
    const walkClip =
      inst.animations.find((a) => /running_a/i.test(a.name)) ??
      inst.animations.find((a) => /walking_a/i.test(a.name)) ??
      idleClip;
    const attackClip =
      inst.animations.find((a) => /attack|chop/i.test(a.name)) ?? idleClip;
    idleAction = mixer.clipAction(idleClip);
    walkAction = mixer.clipAction(walkClip);
    walkAction.setEffectiveTimeScale(1.25);
    attackAction = mixer.clipAction(attackClip);
    attackAction.setLoop(THREE.LoopOnce, 1);
    attackAction.clampWhenFinished = true;
    attackAction.setEffectiveTimeScale(2.1);
    idleAction.play();
    activeClip = 'idle';
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.68, 28),
    new THREE.MeshBasicMaterial({ color: '#7eed87', transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.065;
  root.add(ring);

  return {
    root,
    body,
    legL,
    legR,
    armL,
    armR,
    cape,
    headSocket,
    ring,
    attackTimer: 0,
    mixer,
    idleAction,
    walkAction,
    attackAction,
    activeClip,
  };
}

export function updateHeroAnimation(rig: HeroRig, moving: boolean, time: number, dt: number): void {
  if (rig.mixer) {
    const want: 'idle' | 'walk' | 'attack' =
      rig.attackTimer > 0 ? 'attack' : moving ? 'walk' : 'idle';
    if (rig.attackTimer > 0) {
      rig.attackTimer = Math.max(0, rig.attackTimer - dt);
      const s = evalSquashPop(rig.attackTimer, 0.26, 1.18, 0.86);
      rig.body.scale.set(s.sx, s.sy, s.sz);
    } else {
      rig.body.scale.set(1, 1, 1);
    }
    if (want !== rig.activeClip) {
      const prev =
        rig.activeClip === 'attack'
          ? rig.attackAction
          : rig.activeClip === 'walk'
            ? rig.walkAction
            : rig.idleAction;
      const next =
        want === 'attack' ? rig.attackAction : want === 'walk' ? rig.walkAction : rig.idleAction;
      const fade = want === 'attack' || rig.activeClip === 'attack' ? 0.05 : 0.14;
      if (prev && prev !== next) prev.fadeOut(fade);
      if (next) {
        next.reset().setEffectiveWeight(1).fadeIn(fade).play();
      }
      rig.activeClip = want;
    }
    rig.mixer.update(dt);
    return;
  }

  if (rig.attackTimer > 0) {
    rig.attackTimer = Math.max(0, rig.attackTimer - dt);
    const s = evalSquashPop(rig.attackTimer, 0.26, 1.24, 0.80);
    rig.body.scale.set(s.sx, s.sy, s.sz);
    const slam = Math.sin((rig.attackTimer / 0.26) * Math.PI) * 1.15;
    if (rig.armL) rig.armL.rotation.x = -slam;
    if (rig.armR) rig.armR.rotation.x = -slam;
    return;
  }

  rig.body.scale.set(1, 1, 1);
  if (moving) {
    const stride = Math.sin(time * 14);
    if (rig.legL) rig.legL.rotation.x = stride * 0.58;
    if (rig.legR) rig.legR.rotation.x = -stride * 0.58;
    if (rig.armL) rig.armL.rotation.x = -stride * 0.48;
    if (rig.armR) rig.armR.rotation.x = stride * 0.48;
    rig.body.position.y = Math.abs(Math.cos(time * 14)) * 0.09;
    if (rig.cape) rig.cape.rotation.x = 0.25 + Math.sin(time * 12) * 0.08;
  } else {
    if (rig.legL) rig.legL.rotation.x = 0;
    if (rig.legR) rig.legR.rotation.x = 0;
    if (rig.armL) rig.armL.rotation.x = Math.sin(time * 2.5) * 0.07;
    if (rig.armR) rig.armR.rotation.x = -Math.sin(time * 2.5) * 0.07;
    rig.body.position.y = Math.sin(time * 3) * 0.022;
    if (rig.cape) rig.cape.rotation.x = Math.sin(time * 2.4) * 0.04;
  }
}

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  enemyId: EnemyId;
  flashMaterials: THREE.MeshStandardMaterial[];
  mixer: THREE.AnimationMixer | null;
  spinPart?: THREE.Object3D;
  isFlying: boolean;
  hitJoltTimer: number;
  flashTimer: number;
  knockX: number;
  knockZ: number;
}

export function createEnemyRig(enemyId: EnemyId): EnemyRig {
  const root = new THREE.Group();
  const inst = instantiateModel(`enemy_${enemyId}`, true);
  const body = inst ? inst.scene : fallbackBox('#6c7a89', 0.9);
  const flashMaterials = inst ? inst.materials : [];
  root.add(body);

  let mixer: THREE.AnimationMixer | null = null;
  if (inst && inst.animations.length > 0) {
    mixer = new THREE.AnimationMixer(body);
    const clip =
      inst.animations.find((a) => /(^|\|)walk$/i.test(a.name)) ??
      inst.animations.find((a) => /(^|\|)run$/i.test(a.name)) ??
      inst.animations.find((a) => /walk|run/i.test(a.name)) ??
      inst.animations[0];
    if (clip) {
      mixer.clipAction(clip).play();
    }
  }

  const spinPart = body.getObjectByName('SpinPart') ?? undefined;
  return {
    root,
    body,
    enemyId,
    flashMaterials,
    mixer,
    spinPart,
    isFlying: ENEMIES[enemyId].isFlying,
    hitJoltTimer: 0,
    flashTimer: 0,
    knockX: 0,
    knockZ: 0,
  };
}

export function updateEnemyAnimation(rig: EnemyRig, time: number, walkDt: number, fxDt: number, uid: number): void {
  if (rig.mixer && walkDt > 0) {
    if (rig.mixer.time === 0) {
      rig.mixer.update((uid * 0.23) % 1.2);
    }
    rig.mixer.update(walkDt * 1.15);
  }

  const baseFlyY = rig.isFlying ? Math.sin(time * 4.2 + uid) * 0.09 : 0;

  if (rig.hitJoltTimer > 0) {
    rig.hitJoltTimer = Math.max(0, rig.hitJoltTimer - fxDt);
    const s = evalSquashPop(rig.hitJoltTimer, 0.16, 1.26, 0.76);
    rig.body.scale.set(s.sx, s.sy, s.sz);
    const kick = Math.sin((rig.hitJoltTimer / 0.16) * Math.PI) * 0.14;
    rig.body.position.set(rig.knockX * kick, baseFlyY, rig.knockZ * kick);
  } else {
    rig.body.scale.set(1, 1, 1);
    rig.body.position.set(0, baseFlyY, 0);
  }

  if (rig.flashTimer > 0) {
    rig.flashTimer = Math.max(0, rig.flashTimer - fxDt);
  }

  if (rig.spinPart && fxDt > 0) {
    if (rig.enemyId === 'hover_drone' || rig.enemyId === 'repair_drone') {
      rig.spinPart.rotation.y += fxDt * 26;
    } else if (rig.enemyId === 'swarm_saw' || rig.enemyId === 'chomp_brute') {
      rig.spinPart.rotation.x += fxDt * 18;
    } else {
      rig.spinPart.rotation.z += fxDt * 10;
    }
  }
}

export function createGreatOakCastle(): THREE.Group {
  const inst = instantiateModel('env_castle');
  return inst ? inst.scene : fallbackBox('#eae0cc', 2.4);
}

export function createTreeProp(scale = 1, variant: 'oak' | 'pine' = 'oak'): THREE.Group {
  const inst = instantiateModel(variant === 'pine' ? 'env_tree_pine' : 'env_tree_oak');
  const g = inst ? inst.scene : fallbackBox('#5a9854', 1.4);
  g.scale.setScalar(scale);
  return g;
}

export function createLanternProp(): { group: THREE.Group; light: THREE.PointLight } {
  const inst = instantiateModel('env_lantern');
  const group = inst ? inst.scene : fallbackBox('#6d4c33', 1.1);
  const socket = group.getObjectByName('LanternLight');
  const light = new THREE.PointLight('#ff9638', 3.4, 7.5);
  if (socket) {
    light.position.copy(socket.position);
  } else {
    light.position.set(0, 1.15, 0.35);
  }
  group.add(light);
  return { group, light };
}

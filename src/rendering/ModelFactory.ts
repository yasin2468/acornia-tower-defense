import * as THREE from 'three';
import { evalHitJolt, evalSquashPop } from '../core/JuiceController.ts';
import { ENEMIES, type EnemyId, type HeroId, type HeroVisualVariant } from '../data/enemies.ts';
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
  towerId: TowerId;
  branchId?: EvolutionBranchId;
  turretHead: THREE.Object3D;
  baseTurretY: number;
  characterGroup: THREE.Object3D;
  weaponGroup: THREE.Object3D;
  headSocket: THREE.Object3D;
  recoilTimer: number;
  recoilDuration: number;
  spawnTimer: number;
  extraParts: THREE.Object3D[];
  spinSpeed?: number;
}

export function getTowerRecoilDuration(towerId: TowerId): number {
  switch (towerId) {
    case 'tortoise':
      return 0.28;
    case 'beaver':
    case 'badger':
      return 0.24;
    case 'hedgehog':
      return 0.22;
    case 'owl':
    case 'lynx':
      return 0.20;
    default:
      return 0.15;
  }
}

export function triggerTowerRecoil(rig: TowerRig): void {
  rig.recoilDuration = getTowerRecoilDuration(rig.towerId);
  rig.recoilTimer = rig.recoilDuration;
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
    case 'badger_inferno':
      return 'tower_badger_inferno';
    case 'badger_corrosion':
      return 'tower_badger_corrosion';
    case 'falcon_tempest':
      return 'tower_falcon_tempest';
    case 'falcon_skyhunter':
      return 'tower_falcon_skyhunter';
    case 'tortoise_quake':
      return 'tower_tortoise_quake';
    case 'tortoise_bastion':
      return 'tower_tortoise_bastion';
    case 'lynx_flurry':
      return 'tower_lynx_flurry';
    case 'lynx_frostbite':
      return 'tower_lynx_frostbite';
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
    branchId === 'hedgehog_shred'
      ? 12.0
      : branchId === 'squirrel_gatling' || branchId === 'lynx_flurry'
        ? 7.5
        : 2.6;

  return {
    root,
    towerId,
    branchId,
    turretHead,
    baseTurretY: turretHead.position.y,
    characterGroup,
    weaponGroup,
    headSocket,
    recoilTimer: 0,
    recoilDuration: getTowerRecoilDuration(towerId),
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

  let spinBoost = 1;
  if (rig.recoilTimer > 0) {
    rig.recoilTimer = Math.max(0, rig.recoilTimer - dt);
    const dur = rig.recoilDuration || 0.22;
    const ratio = rig.recoilTimer / dur;
    const phase = 1 - ratio;
    const thrust = Math.sin(phase * Math.PI);

    if (rig.towerId === 'tortoise') {
      const s = evalSquashPop(rig.recoilTimer, dur, 1.28, 0.76);
      rig.turretHead.scale.set(s.sx, s.sy, s.sz);
      rig.weaponGroup.position.set(0, -0.02 * ratio, -0.42 * ratio);
      rig.weaponGroup.rotation.x = -0.18 * ratio;
      rig.characterGroup.position.y = -0.03 * ratio;
      rig.characterGroup.rotation.x = -0.20 * ratio;
    } else if (rig.towerId === 'beaver' || rig.towerId === 'badger') {
      const s = evalSquashPop(rig.recoilTimer, dur, 1.25, 0.78);
      rig.turretHead.scale.set(s.sx, s.sy, s.sz);
      rig.weaponGroup.position.set(0, 0.04 * thrust, -0.20 * ratio);
      rig.weaponGroup.rotation.x = -0.32 * ratio;
      rig.characterGroup.position.y = 0.06 * thrust;
      rig.characterGroup.rotation.x = -0.14 * ratio;
    } else if (rig.towerId === 'hedgehog') {
      const s = evalSquashPop(rig.recoilTimer, dur, 1.26, 0.78);
      rig.turretHead.scale.set(s.sx, s.sy, s.sz);
      rig.weaponGroup.position.set(0, 0, -0.36 * ratio);
      rig.weaponGroup.rotation.x = -0.10 * ratio;
      rig.characterGroup.position.y = 0;
      rig.characterGroup.rotation.x = -0.16 * ratio;
    } else if (rig.towerId === 'owl' || rig.towerId === 'lynx') {
      const s = evalSquashPop(rig.recoilTimer, dur, 1.22, 0.84);
      rig.turretHead.scale.set(s.sx, s.sy, s.sz);
      rig.weaponGroup.position.set(0, 0.06 * thrust, 0.16 * thrust);
      rig.weaponGroup.rotation.x = 0.14 * thrust;
      rig.characterGroup.position.y = 0.03 * thrust;
      rig.characterGroup.rotation.x = 0.08 * thrust;
      spinBoost = 1 + 2.8 * ratio;
    } else {
      const s = evalSquashPop(rig.recoilTimer, dur, 1.22, 0.84);
      rig.turretHead.scale.set(s.sx, s.sy, s.sz);
      rig.weaponGroup.position.set(0, 0, -0.20 * ratio);
      rig.weaponGroup.rotation.x = -0.08 * ratio;
      rig.characterGroup.position.y = 0;
      rig.characterGroup.rotation.x = -0.11 * ratio;
      spinBoost = 1 + 2.2 * ratio;
    }
  } else {
    rig.turretHead.scale.set(1, 1, 1);
    rig.weaponGroup.position.set(0, 0, 0);
    rig.weaponGroup.rotation.x = 0;
    rig.characterGroup.position.y = 0;
    rig.characterGroup.rotation.x = 0;
  }

  const spinRate = (rig.spinSpeed ?? 2.6) * spinBoost;
  for (const part of rig.extraParts) {
    part.rotation.y += dt * spinRate;
  }
}

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Object3D;
  heroId: HeroId;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  cape?: THREE.Object3D;
  headSocket: THREE.Object3D;
  ring: THREE.Mesh;
  attackTimer: number;
  attackDuration: number;
  attackSeq: number;
  handledAttackSeq: number;
  lungeTimer: number;
  lungeDuration: number;
  lungeDirX: number;
  lungeDirZ: number;
  mixer?: THREE.AnimationMixer;
  idleAction?: THREE.AnimationAction;
  walkAction?: THREE.AnimationAction;
  attackAction?: THREE.AnimationAction;
  activeClip?: 'idle' | 'walk' | 'attack';
}

export function triggerHeroAttack(rig: HeroRig, dirX = 0, dirZ = 1, isShock = false): void {
  const baseDur = rig.heroId === 'kaya_dis' ? 0.50 : rig.heroId === 'ay_kurdu' ? 0.36 : 0.44;
  rig.attackDuration = isShock ? Math.max(0.32, baseDur * 0.85) : baseDur;
  rig.attackTimer = rig.attackDuration;
  rig.attackSeq += 1;

  const isRanged = rig.heroId === 'kizil_kuyruk';
  const len = Math.hypot(dirX, dirZ) || 1;
  rig.lungeDirX = isRanged ? -(dirX / len) : dirX / len;
  rig.lungeDirZ = isRanged ? -(dirZ / len) : dirZ / len;
  rig.lungeDuration = isRanged ? 0.16 : 0.22;
  rig.lungeTimer = rig.lungeDuration;
}

export function createHeroRig(
  heroId: HeroId,
  hatId: HatId,
  variant: HeroVisualVariant = 'classic',
): HeroRig {
  const root = new THREE.Group();
  const modelName =
    heroId === 'kizil_kuyruk'
      ? 'hero_fox'
      : heroId === 'kaya_dis'
        ? 'hero_boar'
        : heroId === 'ay_kurdu'
          ? 'hero_wolf'
          : variant === 'viking'
            ? 'hero_bear_viking'
            : variant === 'royal'
              ? 'hero_bear_royal'
              : 'hero_bear';
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
      inst.animations.find((a) => /running/i.test(a.name)) ??
      inst.animations.find((a) => /walk/i.test(a.name)) ??
      idleClip;
    const attackClip =
      inst.animations.find((a) => /attack|chop|spellcast/i.test(a.name)) ?? idleClip;
    const walkSpeedScale =
      heroId === 'ay_kurdu'
        ? 1.28
        : heroId === 'kizil_kuyruk'
          ? 1.20
          : heroId === 'kaya_dis'
            ? 1.02
            : 1.12;
    idleAction = mixer.clipAction(idleClip);
    walkAction = mixer.clipAction(walkClip);
    walkAction.setEffectiveTimeScale(walkSpeedScale);
    attackAction = mixer.clipAction(attackClip);
    attackAction.setLoop(THREE.LoopOnce, 1);
    attackAction.clampWhenFinished = true;
    const baseAtkDur = heroId === 'kaya_dis' ? 0.50 : heroId === 'ay_kurdu' ? 0.36 : 0.44;
    const clipDur = attackClip.duration || 1.0;
    attackAction.setEffectiveTimeScale(Math.min(3.0, Math.max(1.5, clipDur / baseAtkDur)));
    idleAction.play();
    activeClip = 'idle';
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.68, 28),
    new THREE.MeshBasicMaterial({
      color: '#7eed87',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.065;
  root.add(ring);

  const defaultAtkDur = heroId === 'kaya_dis' ? 0.50 : heroId === 'ay_kurdu' ? 0.36 : 0.44;
  return {
    root,
    body,
    heroId,
    legL,
    legR,
    armL,
    armR,
    cape,
    headSocket,
    ring,
    attackTimer: 0,
    attackDuration: defaultAtkDur,
    attackSeq: 0,
    handledAttackSeq: 0,
    lungeTimer: 0,
    lungeDuration: 0.22,
    lungeDirX: 0,
    lungeDirZ: 0,
    mixer,
    idleAction,
    walkAction,
    attackAction,
    activeClip,
  };
}

export function createBearHeroRig(hatId: HatId, variant: HeroVisualVariant = 'classic'): HeroRig {
  return createHeroRig('boz_pence', hatId, variant);
}

export function updateHeroAnimation(rig: HeroRig, moving: boolean, time: number, dt: number): void {
  let lx = 0;
  let lz = 0;
  if (rig.lungeTimer > 0) {
    rig.lungeTimer = Math.max(0, rig.lungeTimer - dt);
    const lDur = rig.lungeDuration || 0.22;
    const mag = rig.heroId === 'kizil_kuyruk' ? 0.12 : rig.heroId === 'kaya_dis' ? 0.42 : 0.36;
    const snap = evalHitJolt(Math.max(0, lDur - rig.lungeTimer), lDur).push * mag;
    lx = rig.lungeDirX * snap;
    lz = rig.lungeDirZ * snap;
  }

  if (rig.mixer) {
    if (rig.attackTimer > 0) {
      rig.attackTimer = Math.max(0, rig.attackTimer - dt);
      const aDur = rig.attackDuration || 0.44;
      const peak = rig.heroId === 'kaya_dis' ? 1.28 : 1.22;
      const minY = rig.heroId === 'kaya_dis' ? 0.78 : 0.84;
      const s = evalSquashPop(rig.attackTimer, aDur, peak, minY);
      rig.body.scale.set(s.sx, s.sy, s.sz);
    } else {
      rig.body.scale.set(1, 1, 1);
    }
    rig.body.position.set(lx, 0, lz);

    if (rig.attackSeq !== rig.handledAttackSeq && rig.attackAction) {
      rig.handledAttackSeq = rig.attackSeq;
      const clipDur = rig.attackAction.getClip().duration || 1.0;
      rig.attackAction.setEffectiveTimeScale(Math.min(3.0, Math.max(1.5, clipDur / Math.max(0.28, rig.attackDuration))));
      const prev =
        rig.activeClip === 'attack'
          ? rig.attackAction
          : rig.activeClip === 'walk'
            ? rig.walkAction
            : rig.idleAction;
      if (prev && prev !== rig.attackAction) prev.fadeOut(0.03);
      rig.attackAction.reset().setEffectiveWeight(1).fadeIn(0.03).play();
      rig.activeClip = 'attack';
    } else {
      const want: 'idle' | 'walk' | 'attack' =
        rig.attackTimer > 0 ? 'attack' : moving ? 'walk' : 'idle';
      if (want !== rig.activeClip) {
        const prev =
          rig.activeClip === 'attack'
            ? rig.attackAction
            : rig.activeClip === 'walk'
              ? rig.walkAction
              : rig.idleAction;
        const next =
          want === 'attack' ? rig.attackAction : want === 'walk' ? rig.walkAction : rig.idleAction;
        const fade = want === 'attack' || rig.activeClip === 'attack' ? 0.05 : 0.12;
        if (prev && prev !== next) prev.fadeOut(fade);
        if (next) {
          next.reset().setEffectiveWeight(1).fadeIn(fade).play();
        }
        rig.activeClip = want;
      }
    }
    rig.mixer.update(dt);
    return;
  }

  if (rig.attackTimer > 0) {
    rig.attackTimer = Math.max(0, rig.attackTimer - dt);
    const aDur = rig.attackDuration || 0.44;
    const s = evalSquashPop(rig.attackTimer, aDur, 1.28, 0.78);
    rig.body.scale.set(s.sx, s.sy, s.sz);
    rig.body.position.set(lx, 0, lz);
    const slam = Math.sin((rig.attackTimer / aDur) * Math.PI) * 1.25;
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
    rig.body.position.set(lx, Math.abs(Math.cos(time * 14)) * 0.09, lz);
    if (rig.cape) rig.cape.rotation.x = 0.25 + Math.sin(time * 12) * 0.08;
  } else {
    if (rig.legL) rig.legL.rotation.x = 0;
    if (rig.legR) rig.legR.rotation.x = 0;
    if (rig.armL) rig.armL.rotation.x = Math.sin(time * 2.5) * 0.07;
    if (rig.armR) rig.armR.rotation.x = -Math.sin(time * 2.5) * 0.07;
    rig.body.position.set(lx, Math.sin(time * 3) * 0.022, lz);
    if (rig.cape) rig.cape.rotation.x = Math.sin(time * 2.4) * 0.04;
  }
}

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  enemyId: EnemyId;
  flashMaterials: THREE.MeshStandardMaterial[];
  mixer: THREE.AnimationMixer | null;
  moveAction?: THREE.AnimationAction | null;
  attackAction?: THREE.AnimationAction | null;
  activeClip?: 'move' | 'attack';
  spinPart?: THREE.Object3D;
  spinBones: Array<{ obj: THREE.Object3D; speed: number }>;
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
  let moveAction: THREE.AnimationAction | null = null;
  let attackAction: THREE.AnimationAction | null = null;
  let activeClip: 'move' | 'attack' | undefined;
  if (inst && inst.animations.length > 0) {
    mixer = new THREE.AnimationMixer(body);
    const clip =
      inst.animations.find((a) => /(^|\|)walk$/i.test(a.name)) ??
      inst.animations.find((a) => /(^|\|)run$/i.test(a.name)) ??
      inst.animations.find((a) => /walk|run/i.test(a.name)) ??
      inst.animations[0];
    if (clip) {
      moveAction = mixer.clipAction(clip);
      moveAction.play();
      activeClip = 'move';
    }
    const atkClip =
      inst.animations.find((a) => /attack|bite/i.test(a.name)) ??
      inst.animations.find((a) => /(^|\|)idle$/i.test(a.name));
    if (atkClip && atkClip !== clip) {
      attackAction = mixer.clipAction(atkClip);
    }
  }

  const spinPart = body.getObjectByName('SpinPart') ?? undefined;
  const spinBones: Array<{ obj: THREE.Object3D; speed: number }> = [];
  body.traverse((obj) => {
    if (obj.name.startsWith('SpinBone_Fast')) {
      spinBones.push({ obj, speed: 24 });
    } else if (obj.name.startsWith('SpinBone_Med')) {
      spinBones.push({ obj, speed: 11 });
    } else if (obj.name.startsWith('SpinBone_Slow')) {
      spinBones.push({ obj, speed: 5.5 });
    }
  });
  return {
    root,
    body,
    enemyId,
    flashMaterials,
    mixer,
    moveAction,
    attackAction,
    activeClip,
    spinPart,
    spinBones,
    isFlying: ENEMIES[enemyId].isFlying,
    hitJoltTimer: 0,
    flashTimer: 0,
    knockX: 0,
    knockZ: 0,
  };
}

export function updateEnemyAnimation(
  rig: EnemyRig,
  time: number,
  walkDt: number,
  fxDt: number,
  uid: number,
  engaged = false,
): void {
  if (rig.mixer) {
    if (rig.mixer.time === 0) {
      rig.mixer.update((uid * 0.23) % 1.2);
    }
    const want: 'move' | 'attack' = engaged && rig.attackAction ? 'attack' : 'move';
    if (want !== rig.activeClip && rig.moveAction && rig.attackAction) {
      const prev = rig.activeClip === 'attack' ? rig.attackAction : rig.moveAction;
      const next = want === 'attack' ? rig.attackAction : rig.moveAction;
      prev.fadeOut(0.12);
      next.reset().fadeIn(0.12).play();
      rig.activeClip = want;
    }
    if (engaged && fxDt > 0) {
      rig.mixer.update(fxDt * 1.25);
    } else if (walkDt > 0) {
      rig.mixer.update(walkDt * 1.15);
    }
  }

  const baseFlyY = rig.isFlying ? Math.sin(time * 4.2 + uid) * 0.09 : 0;
  const engagePulse = engaged ? Math.sin(time * 9.5 + uid) * 0.11 : 0;
  const engageX = engaged ? Math.sin(rig.body.rotation.y) * engagePulse : 0;
  const engageZ = engaged ? Math.cos(rig.body.rotation.y) * engagePulse : 0;

  if (rig.hitJoltTimer > 0) {
    rig.hitJoltTimer = Math.max(0, rig.hitJoltTimer - fxDt);
    const isBoss = ENEMIES[rig.enemyId].isBoss;
    const s = evalSquashPop(rig.hitJoltTimer, 0.16, isBoss ? 1.16 : 1.34, isBoss ? 0.86 : 0.70);
    rig.body.scale.set(s.sx, s.sy, s.sz);
    const kick = Math.sin((rig.hitJoltTimer / 0.16) * Math.PI) * 0.14;
    rig.body.position.set(rig.knockX * kick + engageX, baseFlyY, rig.knockZ * kick + engageZ);
  } else {
    rig.body.scale.set(1, 1, 1);
    rig.body.position.set(engageX, baseFlyY, engageZ);
  }

  if (rig.flashTimer > 0) {
    rig.flashTimer = Math.max(0, rig.flashTimer - fxDt);
  }

  if (rig.spinPart && fxDt > 0) {
    if (rig.enemyId === 'hover_drone' || rig.enemyId === 'repair_drone' || rig.enemyId === 'tesla_strider') {
      rig.spinPart.rotation.y += fxDt * (rig.enemyId === 'tesla_strider' ? 14 : 26);
    } else if (rig.enemyId === 'swarm_saw' || rig.enemyId === 'chomp_brute') {
      rig.spinPart.rotation.x += fxDt * 18;
    } else {
      rig.spinPart.rotation.z += fxDt * 10;
    }
  }
  if (fxDt > 0) {
    for (const sb of rig.spinBones) {
      sb.obj.rotateY(fxDt * sb.speed);
    }
  }
}

export function createGreatOakCastle(biome: 'forest' | 'canyon' | 'cavern' | 'snow' | 'foundry' = 'forest'): THREE.Group {
  const inst = instantiateModel(`env_castle_${biome}`) ?? instantiateModel('env_castle');
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

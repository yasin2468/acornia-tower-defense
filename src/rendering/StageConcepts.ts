import * as THREE from 'three';
import type { LevelSpec, StageConceptId } from '../data/levels.ts';

export interface StageAtmosphere {
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

export interface StageAnimatedProp {
  obj: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
  speed: number;
}

export interface StagePulseMat {
  mat: THREE.MeshStandardMaterial;
  base: number;
  amp: number;
  speed: number;
}

export interface StageConceptBuildResult {
  group: THREE.Group;
  animatedProps: StageAnimatedProp[];
  pulseMats: StagePulseMat[];
}

export const STAGE_LIGHTING_THEMES: Record<StageConceptId, StageAtmosphere> = {
  mossy_stream: {
    bg: '#6d8a94',
    fog: '#7da0a8',
    hemiSky: '#c7ecff',
    hemiGround: '#426152',
    sunColor: '#fff0cc',
    sunIntensity: 1.55,
    border: '#9c8c68',
    cliffTint: '#d7e6dc',
    canopyTint: '#a6e89e',
  },
  acorn_island_shrine: {
    bg: '#7d8876',
    fog: '#8e9985',
    hemiSky: '#ffecc4',
    hemiGround: '#4d5b3e',
    sunColor: '#ffe0a3',
    sunIntensity: 1.62,
    border: '#b5925d',
    cliffTint: '#e2d8bd',
    canopyTint: '#e8c468',
  },
  oak_bastion_moat: {
    bg: '#627387',
    fog: '#728397',
    hemiSky: '#cfe2ff',
    hemiGround: '#445263',
    sunColor: '#ffebc7',
    sunIntensity: 1.52,
    border: '#8f9aa3',
    cliffTint: '#cdd5de',
    canopyTint: '#8cd48e',
  },
  crimson_powder_gorge: {
    bg: '#966148',
    fog: '#ab7054',
    hemiSky: '#ffd9b3',
    hemiGround: '#6b3622',
    sunColor: '#ffb273',
    sunIntensity: 1.68,
    border: '#a6623d',
    cliffTint: '#f29e72',
    canopyTint: '#e89343',
  },
  desert_windmill_oasis: {
    bg: '#b89668',
    fog: '#cba878',
    hemiSky: '#fff2cc',
    hemiGround: '#825f36',
    sunColor: '#ffd78c',
    sunIntensity: 1.72,
    border: '#c2995b',
    cliffTint: '#f5cf95',
    canopyTint: '#84c96b',
  },
  twin_bridge_chasm: {
    bg: '#593b39',
    fog: '#6e4742',
    hemiSky: '#ffc8a8',
    hemiGround: '#422422',
    sunColor: '#ffa16e',
    sunIntensity: 1.56,
    border: '#7d4d3e',
    cliffTint: '#b87664',
    canopyTint: '#cc7b47',
  },
  biolum_quartz_stream: {
    bg: '#1c3547',
    fog: '#254459',
    hemiSky: '#86f2ff',
    hemiGround: '#1a2e3d',
    sunColor: '#7be8ff',
    sunIntensity: 1.05,
    border: '#4f7a8a',
    cliffTint: '#7ab0c4',
    canopyTint: '#6be8dc',
  },
  abandoned_drill_mine: {
    bg: '#34313d',
    fog: '#433e4d',
    hemiSky: '#ffd5a8',
    hemiGround: '#2b252e',
    sunColor: '#ffbe82',
    sunIntensity: 1.12,
    border: '#70635a',
    cliffTint: '#9c9296',
    canopyTint: '#9e8f86',
  },
  amethyst_ley_sanctum: {
    bg: '#2c1e45',
    fog: '#3b285c',
    hemiSky: '#dfb8ff',
    hemiGround: '#221538',
    sunColor: '#c9a6ff',
    sunIntensity: 1.02,
    border: '#705896',
    cliffTint: '#9e82c7',
    canopyTint: '#c288ff',
  },
  frozen_mirror_lake: {
    bg: '#95b9d9',
    fog: '#a8cbe8',
    hemiSky: '#f2f9ff',
    hemiGround: '#6c92b5',
    sunColor: '#e6f5ff',
    sunIntensity: 1.48,
    border: '#89acc9',
    cliffTint: '#cce4fa',
    canopyTint: '#ccefff',
  },
  blizzard_watchtower: {
    bg: '#7d92ab',
    fog: '#8fa5bf',
    hemiSky: '#e2eeff',
    hemiGround: '#596d85',
    sunColor: '#dcecff',
    sunIntensity: 1.38,
    border: '#7d93ad',
    cliffTint: '#b8cae0',
    canopyTint: '#c4def5',
  },
  aurora_citadel_siege: {
    bg: '#355c6e',
    fog: '#447285',
    hemiSky: '#a8ffea',
    hemiGround: '#325366',
    sunColor: '#bdf7ee',
    sunIntensity: 1.34,
    border: '#669aa3',
    cliffTint: '#a6d6d2',
    canopyTint: '#9ff5e2',
  },
  cinder_slag_canal: {
    bg: '#422723',
    fog: '#57332c',
    hemiSky: '#ffba8a',
    hemiGround: '#381d18',
    sunColor: '#ffa35c',
    sunIntensity: 1.44,
    border: '#874c3b',
    cliffTint: '#b0715d',
    canopyTint: '#7a3c29',
  },
  clockwork_gear_bridge: {
    bg: '#4a3829',
    fog: '#5e4734',
    hemiSky: '#ffdfad',
    hemiGround: '#3d2c1e',
    sunColor: '#ffc670',
    sunIntensity: 1.5,
    border: '#997245',
    cliffTint: '#c49664',
    canopyTint: '#b07e48',
  },
  magma_crucible_arena: {
    bg: '#3b1c1a',
    fog: '#542622',
    hemiSky: '#ffaa70',
    hemiGround: '#361212',
    sunColor: '#ff8a47',
    sunIntensity: 1.46,
    border: '#7d3426',
    cliffTint: '#a35648',
    canopyTint: '#6e2c22',
  },
  iron_core_citadel: {
    bg: '#2b2130',
    fog: '#3d2c40',
    hemiSky: '#b5d6ff',
    hemiGround: '#291a24',
    sunColor: '#ffd480',
    sunIntensity: 1.42,
    border: '#665b6e',
    cliffTint: '#8e8499',
    canopyTint: '#5d5366',
  },
  shadowfen_lantern_bog: {
    bg: '#274039',
    fog: '#355449',
    hemiSky: '#9be8be',
    hemiGround: '#1a2e26',
    sunColor: '#d9ffba',
    sunIntensity: 1.24,
    border: '#5a785c',
    cliffTint: '#6c9178',
    canopyTint: '#59b578',
  },
  sunken_totem_ruins: {
    bg: '#70523a',
    fog: '#876346',
    hemiSky: '#ffd996',
    hemiGround: '#4a311f',
    sunColor: '#ffca78',
    sunIntensity: 1.56,
    border: '#ad8453',
    cliffTint: '#d4a66a',
    canopyTint: '#d6a249',
  },
  venom_alchemist_marsh: {
    bg: '#283047',
    fog: '#333e5c',
    hemiSky: '#82ffba',
    hemiGround: '#1e1936',
    sunColor: '#9cf5c6',
    sunIntensity: 1.15,
    border: '#527d6b',
    cliffTint: '#72a896',
    canopyTint: '#64eb9c',
  },
  eclipse_oak_bastion: {
    bg: '#2b2336',
    fog: '#3c314a',
    hemiSky: '#ffb899',
    hemiGround: '#241a2b',
    sunColor: '#ff9e7d',
    sunIntensity: 1.32,
    border: '#7d5368',
    cliffTint: '#a67b8e',
    canopyTint: '#bf655a',
  },
  starfall_glacier_bridge: {
    bg: '#6388b5',
    fog: '#799ec9',
    hemiSky: '#cfe8ff',
    hemiGround: '#43608a',
    sunColor: '#e8f4ff',
    sunIntensity: 1.62,
    border: '#8ab4e0',
    cliffTint: '#b8d7f5',
    canopyTint: '#91c9ff',
  },
  chrono_prism_vault: {
    bg: '#26264d',
    fog: '#343466',
    hemiSky: '#a6e3ff',
    hemiGround: '#1e1c3b',
    sunColor: '#d9c2ff',
    sunIntensity: 1.22,
    border: '#6f6bb8',
    cliffTint: '#9a96e0',
    canopyTint: '#7be3ff',
  },
  solar_plasma_reactor: {
    bg: '#472722',
    fog: '#5c332c',
    hemiSky: '#ffcf87',
    hemiGround: '#331914',
    sunColor: '#ffbe6b',
    sunIntensity: 1.54,
    border: '#a66235',
    cliffTint: '#d4824a',
    canopyTint: '#ff9640',
  },
  astral_nexus_throne: {
    bg: '#1f1c3d',
    fog: '#2d2854',
    hemiSky: '#94d9ff',
    hemiGround: '#17132e',
    sunColor: '#b8f0ff',
    sunIntensity: 1.36,
    border: '#6378b5',
    cliffTint: '#8da3e0',
    canopyTint: '#82d4ff',
  },
};

function collectRoadSamples(curves: THREE.CatmullRomCurve3[]): Array<{ x: number; z: number; tx: number; tz: number }> {
  const out: Array<{ x: number; z: number; tx: number; tz: number }> = [];
  for (const c of curves) {
    const pts = c.getSpacedPoints(80);
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[Math.min(pts.length - 1, i + 1)];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const len = Math.hypot(dx, dz) || 1;
      out.push({ x: pts[i].x, z: pts[i].z, tx: dx / len, tz: dz / len });
    }
  }
  return out;
}

function isClearPropPos(
  x: number,
  z: number,
  level: LevelSpec,
  roadSamples: Array<{ x: number; z: number }>,
  minSlotDist = 1.35,
  minRoadDist = 1.15,
): boolean {
  for (const s of level.slots) {
    if (Math.hypot(s.x - x, s.z - z) < minSlotDist) return false;
  }
  for (const b of level.barrels ?? []) {
    if (Math.hypot(b.x - x, b.z - z) < 1.1) return false;
  }
  for (const r of roadSamples) {
    if (Math.hypot(r.x - x, r.z - z) < minRoadDist) return false;
  }
  return true;
}

function buildWaterwayRibbon(
  pts: Array<[number, number]>,
  width: number,
  y: number,
  mat: THREE.Material,
  bankMat?: THREE.Material,
  bankWidthExtra = 0.42,
): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.4,
  );
  const segs = 70;
  const makeGeo = (w: number, dy: number) => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = c.getPointAt(t);
      const tan = c.getTangentAt(t);
      const nx = -tan.z;
      const nz = tan.x;
      pos.push(p.x + nx * w * 0.5, y + dy, p.z + nz * w * 0.5);
      pos.push(p.x - nx * w * 0.5, y + dy, p.z - nz * w * 0.5);
      if (i < segs) {
        const b = i * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  if (bankMat) {
    const bankMesh = new THREE.Mesh(makeGeo(width + bankWidthExtra, -0.004), bankMat);
    bankMesh.receiveShadow = true;
    g.add(bankMesh);
  }
  const mesh = new THREE.Mesh(makeGeo(width, 0), mat);
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

function buildBridgeAt(
  x: number,
  z: number,
  yaw: number,
  deckColor: string,
  railColor: string,
  length = 2.45,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const deckMat = new THREE.MeshStandardMaterial({ color: deckColor, roughness: 0.78, metalness: 0.12 });
  const seamMat = new THREE.MeshStandardMaterial({ color: '#2b180b', roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: railColor, roughness: 0.65, metalness: 0.25 });

  const beamBed = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.022, length), seamMat);
  beamBed.position.y = 0.015;
  g.add(beamBed);

  const plankCount = 6;
  const stepZ = length / plankCount;
  const plankGeo = new THREE.BoxGeometry(2.12, 0.024, stepZ * 0.78);
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(plankGeo, deckMat);
    plank.position.set(0, 0.028, -length * 0.5 + stepZ * (i + 0.5));
    plank.receiveShadow = true;
    g.add(plank);
  }

  for (const side of [-0.94, 0.94]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, length), railMat);
    rail.position.set(side, 0.34, 0);
    rail.castShadow = true;
    g.add(rail);
    for (const pz of [-length * 0.42, 0, length * 0.42]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.15), railMat);
      post.position.set(side, 0.22, pz);
      post.castShadow = true;
      g.add(post);
    }
  }
  return g;
}

function segmentsIntersectXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): { x: number; z: number } | null {
  const rdx = bx - ax;
  const rdz = bz - az;
  const sdx = dx - cx;
  const sdz = dz - cz;
  const denom = rdx * sdz - rdz * sdx;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((cx - ax) * sdz - (cz - az) * sdx) / denom;
  const u = ((cx - ax) * rdz - (cz - az) * rdx) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: ax + t * rdx, z: az + t * rdz };
  }
  return null;
}

function placeBridgesOverCurve(
  riverPts: Array<[number, number]>,
  curves: THREE.CatmullRomCurve3[],
  deckColor: string,
  railColor: string,
  parent: THREE.Group,
): void {
  const rc = new THREE.CatmullRomCurve3(
    riverPts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'catmullrom',
    0.4,
  );
  const rSamples = rc.getSpacedPoints(70);
  const placed: Array<{ x: number; z: number }> = [];
  for (const c of curves) {
    const pts = c.getSpacedPoints(120);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      for (let j = 0; j < rSamples.length - 1; j++) {
        const hit = segmentsIntersectXZ(a.x, a.z, b.x, b.z, rSamples[j].x, rSamples[j].z, rSamples[j + 1].x, rSamples[j + 1].z);
        if (!hit) continue;
        if (placed.some((p) => Math.hypot(p.x - hit.x, p.z - hit.z) < 1.8)) continue;
        placed.push(hit);
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        parent.add(buildBridgeAt(hit.x, hit.z, yaw, deckColor, railColor));
      }
    }
  }
}

function placeBridgesOverLine(
  targetZ: number,
  curves: THREE.CatmullRomCurve3[],
  deckColor: string,
  railColor: string,
  parent: THREE.Group,
  slopeXToZ = 0,
): void {
  const placed: Array<{ x: number; z: number }> = [];
  for (const c of curves) {
    const pts = c.getSpacedPoints(120);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const lineZa = targetZ + slopeXToZ * a.x;
      const lineZb = targetZ + slopeXToZ * b.x;
      const da = a.z - lineZa;
      const db = b.z - lineZb;
      if ((da <= 0 && db >= 0) || (da >= 0 && db <= 0)) {
        const denom = Math.abs(da) + Math.abs(db) || 1;
        const frac = Math.abs(da) / denom;
        const ix = a.x + (b.x - a.x) * frac;
        const iz = a.z + (b.z - a.z) * frac;
        if (placed.some((p) => Math.hypot(p.x - ix, p.z - iz) < 1.8)) continue;
        placed.push({ x: ix, z: iz });
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        parent.add(buildBridgeAt(ix, iz, yaw, deckColor, railColor));
      }
    }
  }
}

function buildWindmill(bladeColor: string): { root: THREE.Group; hub: THREE.Group } {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#d8b684', roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#a84f32', roughness: 0.72 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#5c3c24', roughness: 0.75 });
  const sailMat = new THREE.MeshStandardMaterial({ color: bladeColor, roughness: 0.78 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 1.55, 8), bodyMat);
  base.position.y = 0.775;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.62, 8), roofMat);
  roof.position.y = 1.85;
  roof.castShadow = true;
  root.add(roof);

  const hub = new THREE.Group();
  hub.position.set(0, 1.48, 0.48);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10), trimMat);
  cap.rotation.x = Math.PI / 2;
  hub.add(cap);

  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.05), trimMat);
    spar.position.y = 0.46;
    arm.add(spar);
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.025), sailMat);
    sail.position.set(0.11, 0.54, 0.02);
    sail.castShadow = true;
    arm.add(sail);
    hub.add(arm);
  }
  root.add(hub);
  return { root, hub };
}

function buildSandstoneArch(width: number, height: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const left = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, height, 7), mat);
  left.position.set(-width * 0.5, height * 0.5, 0);
  left.castShadow = true;
  g.add(left);
  const right = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, height, 7), mat);
  right.position.set(width * 0.5, height * 0.5, 0);
  right.castShadow = true;
  g.add(right);
  const span = new THREE.Mesh(new THREE.BoxGeometry(width + 0.62, 0.42, 0.56), mat);
  span.position.set(0, height + 0.14, 0);
  span.castShadow = true;
  g.add(span);
  return g;
}

function buildDrillRig(): { root: THREE.Group; bit: THREE.Group } {
  const root = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#4c525e', metalness: 0.55, roughness: 0.42 });
  const copperMat = new THREE.MeshStandardMaterial({ color: '#d48544', metalness: 0.6, roughness: 0.35 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#6df5ff',
    emissive: '#22d3ee',
    emissiveIntensity: 0.9,
  });

  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.56, 0.45, 8), frameMat);
  frame.position.y = 0.225;
  frame.castShadow = true;
  root.add(frame);

  for (const a of [0, 2.09, 4.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.55, 0.11), copperMat);
    leg.position.set(Math.cos(a) * 0.36, 0.82, Math.sin(a) * 0.36);
    leg.lookAt(0, 1.75, 0);
    leg.castShadow = true;
    root.add(leg);
  }

  const bit = new THREE.Group();
  bit.position.y = 0.92;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.05, 8), copperMat);
  cone.rotation.x = Math.PI;
  cone.castShadow = true;
  bit.add(cone);

  for (const hy of [-0.28, 0.0, 0.28]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.24 - hy * 0.18, 0.04, 6, 12), glowMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = hy;
    bit.add(band);
  }
  root.add(bit);
  return { root, bit };
}

function buildGearMesh(radius: number, teeth: number, thickness: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.36 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 20), mat);
  rim.receiveShadow = true;
  g.add(rim);

  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.34, radius * 0.34, thickness + 0.01, 12),
    new THREE.MeshStandardMaterial({ color: '#2b1d15', metalness: 0.4, roughness: 0.7 }),
  );
  g.add(hole);

  const toothGeo = new THREE.BoxGeometry(radius * 0.22, thickness * 0.96, radius * 0.26);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, mat);
    tooth.position.set(Math.cos(a) * (radius + radius * 0.08), 0, Math.sin(a) * (radius + radius * 0.08));
    tooth.rotation.y = -a;
    g.add(tooth);
  }
  return g;
}

function buildTeslaSpire(): { root: THREE.Group; ringA: THREE.Mesh; ringB: THREE.Mesh } {
  const root = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: '#3b3847', metalness: 0.7, roughness: 0.32 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f2b84b', metalness: 0.78, roughness: 0.25 });
  const arcMat = new THREE.MeshStandardMaterial({
    color: '#8ceaff',
    emissive: '#38bdf8',
    emissiveIntensity: 1.3,
    roughness: 0.2,
  });

  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.55, 8), ironMat);
  ped.position.y = 0.275;
  ped.castShadow = true;
  root.add(ped);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.35, 10), goldMat);
  shaft.position.y = 1.1;
  shaft.castShadow = true;
  root.add(shaft);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), arcMat);
  orb.position.y = 1.85;
  root.add(orb);

  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 18), arcMat);
  ringA.position.y = 1.48;
  ringA.rotation.x = Math.PI / 2;
  root.add(ringA);

  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 18), goldMat);
  ringB.position.y = 1.85;
  ringB.rotation.z = 0.4;
  root.add(ringB);

  return { root, ringA, ringB };
}

export function buildStageConcept(level: LevelSpec, curves: THREE.CatmullRomCurve3[]): StageConceptBuildResult {
  const group = new THREE.Group();
  const animatedProps: StageAnimatedProp[] = [];
  const pulseMats: StagePulseMat[] = [];
  const roadSamples = collectRoadSamples(curves);
  const c = level.concept;

  if (c === 'mossy_stream') {
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#22b8d6',
      emissive: '#0e7490',
      emissiveIntensity: 0.42,
      roughness: 0.14,
      metalness: 0.18,
    });
    const bankMat = new THREE.MeshStandardMaterial({ color: '#786e4e', roughness: 0.92 });
    pulseMats.push({ mat: waterMat, base: 0.42, amp: 0.1, speed: 2.2 });
    const streamPts: Array<[number, number]> = [
      [-11.5, 4.0],
      [-3.1, 3.4],
      [0.0, 1.8],
      [3.1, -0.2],
      [11.5, -0.8],
    ];
    group.add(buildWaterwayRibbon(streamPts, 1.55, 0.015, waterMat, bankMat));
    placeBridgesOverCurve(streamPts, curves, '#9a6234', '#523015', group);

    // Lily pads & moss boulders on water/banks
    const padMat = new THREE.MeshStandardMaterial({ color: '#4cb852', roughness: 0.72 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: '#ff96c5', emissive: '#e04f8a', emissiveIntensity: 0.25 });
    for (const [lx, lz, hasFlower] of [
      [-1.8, 1.25, true],
      [1.7, 0.45, false],
      [4.2, 0.15, true],
      [-4.1, 1.85, false],
    ] as Array<[number, number, boolean]>) {
      if (roadSamples.some((r) => Math.hypot(r.x - lx, r.z - lz) < 1.15)) continue;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12), padMat);
      pad.position.set(lx, 0.024, lz);
      group.add(pad);
      if (hasFlower) {
        const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), flowerMat);
        fl.position.set(lx + 0.04, 0.06, lz);
        group.add(fl);
      }
    }
  } else if (c === 'acorn_island_shrine') {
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#249c8c',
      emissive: '#0d6e62',
      emissiveIntensity: 0.32,
      roughness: 0.15,
      metalness: 0.2,
    });
    const bankMat = new THREE.MeshStandardMaterial({ color: '#9c8353', roughness: 0.9 });
    pulseMats.push({ mat: waterMat, base: 0.32, amp: 0.09, speed: 2.0 });

    const bankDisk = new THREE.Mesh(new THREE.CircleGeometry(3.25, 32), bankMat);
    bankDisk.rotation.x = -Math.PI / 2;
    bankDisk.scale.set(1.28, 0.54, 1);
    bankDisk.position.set(0, 0.011, 4.1);
    group.add(bankDisk);

    const pondDisk = new THREE.Mesh(new THREE.CircleGeometry(2.85, 32), waterMat);
    pondDisk.rotation.x = -Math.PI / 2;
    pondDisk.scale.set(1.25, 0.5, 1);
    pondDisk.position.set(0, 0.015, 4.1);
    group.add(pondDisk);

    placeBridgesOverLine(4.1, curves, '#9e6838', '#5e3817', group, 0);

    // Golden Acorn Totem landmark at clear north overlook
    const totemPos: [number, number] = [0, 8.1];
    if (isClearPropPos(totemPos[0], totemPos[1], level, roadSamples, 1.2, 1.05)) {
      const shrine = new THREE.Group();
      shrine.position.set(totemPos[0], 0, totemPos[1]);
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.62, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: '#8a8272', roughness: 0.88 }),
      );
      stone.position.y = 0.2;
      shrine.add(stone);
      const acorn = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 10),
        new THREE.MeshStandardMaterial({
          color: '#ffd059',
          emissive: '#c97a16',
          emissiveIntensity: 0.55,
          metalness: 0.35,
          roughness: 0.32,
        }),
      );
      acorn.position.y = 0.72;
      acorn.scale.set(0.9, 1.2, 0.9);
      shrine.add(acorn);
      animatedProps.push({ obj: acorn, axis: 'y', speed: 0.9 });
      group.add(shrine);
    }
  } else if (c === 'oak_bastion_moat') {
    const moatMat = new THREE.MeshStandardMaterial({
      color: '#2c789e',
      emissive: '#104e73',
      emissiveIntensity: 0.34,
      roughness: 0.16,
      metalness: 0.2,
    });
    const wallMat = new THREE.MeshStandardMaterial({ color: '#9aa4b0', roughness: 0.85 });
    pulseMats.push({ mat: moatMat, base: 0.34, amp: 0.08, speed: 1.9 });

    const moat = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.65), moatMat);
    moat.rotation.x = -Math.PI / 2;
    moat.position.set(0, 0.014, -7.8);
    group.add(moat);

    for (const wz of [-8.65, -6.95]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(14, 0.18, 0.26), wallMat);
      curb.position.set(0, 0.08, wz);
      curb.receiveShadow = true;
      group.add(curb);
    }
    group.add(buildBridgeAt(0, -7.8, 0, '#7c532e', '#b5924c', 2.0));

    // Crest banners near castle apron
    const bannerMat = new THREE.MeshStandardMaterial({ color: '#cc3b2b', roughness: 0.7 });
    const poleMat = new THREE.MeshStandardMaterial({ color: '#c99b44', metalness: 0.65, roughness: 0.3 });
    for (const [bx, bz] of [
      [-4.1, -6.2],
      [4.1, -6.2],
      [-4.2, 7.6],
      [4.2, 7.6],
    ] as Array<[number, number]>) {
      if (!isClearPropPos(bx, bz, level, roadSamples, 1.1, 1.0)) continue;
      const bGrp = new THREE.Group();
      bGrp.position.set(bx, 0, bz);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.65, 8), poleMat);
      pole.position.y = 0.825;
      bGrp.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.04), bannerMat);
      flag.position.set(bx < 0 ? 0.28 : -0.28, 1.38, 0);
      bGrp.add(flag);
      group.add(bGrp);
    }
  } else if (c === 'crimson_powder_gorge') {
    const riftMat = new THREE.MeshStandardMaterial({ color: '#451d14', roughness: 0.94 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#d47448', roughness: 0.88 });
    group.add(
      buildWaterwayRibbon(
        [
          [-11, -1.5],
          [-4, -2.0],
          [0, -2.1],
          [4, -2.4],
          [11, -2.7],
        ],
        1.25,
        0.012,
        riftMat,
        rimMat,
        0.55,
      ),
    );
    placeBridgesOverLine(-2.1, curves, '#8c5732', '#522f18', group, -0.05);

    const archPositions: Array<[number, number, number]> = [
      [-4.5, 4.4, 0.35],
      [4.5, -5.0, -0.4],
    ];
    for (const [ax, az, rot] of archPositions) {
      if (!isClearPropPos(ax, az, level, roadSamples, 1.2, 1.1)) continue;
      const arch = buildSandstoneArch(1.45, 1.35, '#c96b43');
      arch.position.set(ax, 0, az);
      arch.rotation.y = rot;
      group.add(arch);
    }
  } else if (c === 'desert_windmill_oasis') {
    const poolMat = new THREE.MeshStandardMaterial({
      color: '#22c4bd',
      emissive: '#0e8580',
      emissiveIntensity: 0.34,
      roughness: 0.14,
      metalness: 0.18,
    });
    const sandRimMat = new THREE.MeshStandardMaterial({ color: '#e6c88a', roughness: 0.9 });
    pulseMats.push({ mat: poolMat, base: 0.34, amp: 0.09, speed: 2.1 });

    // Twin clear desert oasis pools on flanks where slots do not sit
    for (const [ox, oz, rx, rz] of [
      [-4.1, 0.2, 1.15, 1.75],
      [4.1, 4.9, 1.05, 1.45],
    ] as Array<[number, number, number, number]>) {
      const rim = new THREE.Mesh(new THREE.CircleGeometry(1, 24), sandRimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(rx + 0.22, rz + 0.22, 1);
      rim.position.set(ox, 0.011, oz);
      group.add(rim);
      const water = new THREE.Mesh(new THREE.CircleGeometry(1, 24), poolMat);
      water.rotation.x = -Math.PI / 2;
      water.scale.set(rx, rz, 1);
      water.position.set(ox, 0.015, oz);
      group.add(water);
    }

    for (const [wx, wz, yaw, spd] of [
      [-4.4, -6.5, 0.6, 2.2],
      [4.5, 0.6, -0.8, -2.5],
      [4.3, -6.8, -0.5, 2.0],
    ] as Array<[number, number, number, number]>) {
      if (!isClearPropPos(wx, wz, level, roadSamples, 1.15, 1.05)) continue;
      const wm = buildWindmill('#fff2d4');
      wm.root.position.set(wx, 0, wz);
      wm.root.rotation.y = yaw;
      group.add(wm.root);
      animatedProps.push({ obj: wm.hub, axis: 'z', speed: spd });
    }
  } else if (c === 'twin_bridge_chasm') {
    const magmaFaultMat = new THREE.MeshStandardMaterial({
      color: '#ff6e26',
      emissive: '#e63e00',
      emissiveIntensity: 0.88,
      roughness: 0.35,
    });
    const cliffLipMat = new THREE.MeshStandardMaterial({ color: '#38221e', roughness: 0.92 });
    pulseMats.push({ mat: magmaFaultMat, base: 0.88, amp: 0.25, speed: 2.8 });

    group.add(
      buildWaterwayRibbon(
        [
          [-11.5, 2.4],
          [-3.2, 2.2],
          [0, 2.05],
          [3.2, 2.2],
          [11.5, 2.4],
        ],
        1.45,
        0.013,
        magmaFaultMat,
        cliffLipMat,
        0.55,
      ),
    );
    placeBridgesOverLine(2.2, curves, '#6b5344', '#c97b38', group, 0);
  } else if (c === 'biolum_quartz_stream') {
    const bioWater = new THREE.MeshStandardMaterial({
      color: '#2cf2e8',
      emissive: '#0891b2',
      emissiveIntensity: 0.68,
      roughness: 0.14,
      metalness: 0.25,
    });
    const bankMat = new THREE.MeshStandardMaterial({ color: '#1b3142', roughness: 0.9 });
    pulseMats.push({ mat: bioWater, base: 0.68, amp: 0.18, speed: 2.6 });

    group.add(
      buildWaterwayRibbon(
        [
          [-11.5, -0.9],
          [-4.2, -1.2],
          [0, -1.7],
          [4.2, -1.1],
          [11.5, -0.7],
        ],
        1.38,
        0.014,
        bioWater,
        bankMat,
        0.48,
      ),
    );
    placeBridgesOverLine(-1.35, curves, '#48748a', '#6ef7ff', group, 0);

    // Giant glowing cave mushrooms along cavern rim
    const capMat = new THREE.MeshStandardMaterial({
      color: '#5effea',
      emissive: '#00bfa5',
      emissiveIntensity: 0.62,
      roughness: 0.35,
    });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#b0d8e0', roughness: 0.78 });
    for (const [mx, mz, sc] of [
      [-4.2, 1.4, 1.05],
      [4.3, 2.1, 0.92],
      [-4.3, -4.8, 0.95],
      [4.2, -4.6, 1.05],
    ] as Array<[number, number, number]>) {
      if (!isClearPropPos(mx, mz, level, roadSamples, 1.1, 1.05)) continue;
      const mush = new THREE.Group();
      mush.position.set(mx, 0, mz);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * sc, 0.16 * sc, 0.62 * sc, 8), stemMat);
      stem.position.y = 0.31 * sc;
      mush.add(stem);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42 * sc, 0.28 * sc, 10), capMat);
      cap.position.y = 0.68 * sc;
      cap.castShadow = true;
      mush.add(cap);
      group.add(mush);
    }
  } else if (c === 'abandoned_drill_mine') {
    const railMat = new THREE.MeshStandardMaterial({ color: '#8e99a6', metalness: 0.72, roughness: 0.32 });
    const tieMat = new THREE.MeshStandardMaterial({ color: '#5c3c22', roughness: 0.85 });
    const oreMat = new THREE.MeshStandardMaterial({ color: '#52e8ff', emissive: '#0ea5e9', emissiveIntensity: 0.5 });

    // Parallel perimeter mining rail tracks along flanks
    for (const rx of [-4.45, 4.45]) {
      for (const offset of [-0.22, 0.22]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 16.5), railMat);
        rail.position.set(rx + offset, 0.025, 0.4);
        group.add(rail);
      }
      for (let z = -7.2; z <= 7.8; z += 0.72) {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.024, 0.14), tieMat);
        tie.position.set(rx, 0.015, z);
        group.add(tie);
      }
      // Ore-filled minecart
      const cz = rx < 0 ? 1.8 : -2.2;
      if (isClearPropPos(rx, cz, level, roadSamples, 1.0, 0.9)) {
        const cart = new THREE.Group();
        cart.position.set(rx, 0, cz);
        const tub = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.82), railMat);
        tub.position.y = 0.28;
        tub.castShadow = true;
        cart.add(tub);
        const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), oreMat);
        ore.position.set(0, 0.5, 0.08);
        cart.add(ore);
        group.add(cart);
      }
    }

    for (const [dx, dz] of [
      [-4.4, -6.2],
      [4.4, 5.2],
    ] as Array<[number, number]>) {
      if (!isClearPropPos(dx, dz, level, roadSamples, 1.1, 0.95)) continue;
      const drill = buildDrillRig();
      drill.root.position.set(dx, 0, dz);
      group.add(drill.root);
      animatedProps.push({ obj: drill.bit, axis: 'y', speed: 4.5 });
    }
  } else if (c === 'amethyst_ley_sanctum') {
    const leyMat = new THREE.MeshStandardMaterial({
      color: '#e082ff',
      emissive: '#a855f7',
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    pulseMats.push({ mat: leyMat, base: 0.95, amp: 0.28, speed: 2.5 });

    // Counter-rotating arcane floor rings beneath the crisscross hourglass
    for (const [rz, radius, spd] of [
      [3.8, 1.65, 0.55],
      [-0.6, 2.05, -0.45],
      [-5.4, 1.45, 0.7],
    ] as Array<[number, number, number]>) {
      const ringGroup = new THREE.Group();
      ringGroup.position.set(0, 0.022, rz);
      const outer = new THREE.Mesh(new THREE.RingGeometry(radius - 0.1, radius, 28), leyMat);
      outer.rotation.x = -Math.PI / 2;
      ringGroup.add(outer);
      const inner = new THREE.Mesh(new THREE.RingGeometry(radius * 0.62, radius * 0.68, 6), leyMat);
      inner.rotation.x = -Math.PI / 2;
      ringGroup.add(inner);
      group.add(ringGroup);
      animatedProps.push({ obj: ringGroup, axis: 'y', speed: spd });
    }

    const obMat = new THREE.MeshStandardMaterial({ color: '#472c6b', roughness: 0.65 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#f0abfc',
      emissive: '#d946ef',
      emissiveIntensity: 1.0,
    });
    for (const [ox, oz] of [
      [-4.2, 4.0],
      [4.2, 4.0],
      [-4.2, -5.0],
      [4.2, -5.0],
    ] as Array<[number, number]>) {
      if (!isClearPropPos(ox, oz, level, roadSamples, 1.1, 1.0)) continue;
      const ob = new THREE.Group();
      ob.position.set(ox, 0, oz);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.15, 6), obMat);
      pillar.position.y = 0.575;
      pillar.castShadow = true;
      ob.add(pillar);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), crystalMat);
      gem.position.y = 1.48;
      ob.add(gem);
      animatedProps.push({ obj: gem, axis: 'y', speed: 2.1 });
      group.add(ob);
    }
  } else if (c === 'frozen_mirror_lake') {
    const lakeMat = new THREE.MeshStandardMaterial({
      color: '#38a8e8',
      emissive: '#0284c7',
      emissiveIntensity: 0.42,
      roughness: 0.1,
      metalness: 0.28,
    });
    const frostRim = new THREE.MeshStandardMaterial({ color: '#e6f7ff', roughness: 0.42 });
    pulseMats.push({ mat: lakeMat, base: 0.42, amp: 0.09, speed: 1.6 });

    const rim = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), frostRim);
    rim.rotation.x = -Math.PI / 2;
    rim.scale.set(1.38, 0.72, 1);
    rim.position.set(0.3, 0.011, 1.4);
    group.add(rim);

    const lake = new THREE.Mesh(new THREE.CircleGeometry(3.12, 32), lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.scale.set(1.35, 0.68, 1);
    lake.position.set(0.3, 0.015, 1.4);
    group.add(lake);

    const crackMat = new THREE.MeshBasicMaterial({ color: '#e6f8ff', transparent: true, opacity: 0.8 });
    for (const [cx, cz, len, yaw] of [
      [-1.1, 1.8, 2.4, 0.28],
      [0.6, 0.9, 2.8, -0.34],
      [1.3, 2.1, 1.9, 0.62],
    ] as Array<[number, number, number, number]>) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, 0.055), crackMat);
      crack.position.set(cx, 0.019, cz);
      crack.rotation.y = yaw;
      group.add(crack);
    }

    placeBridgesOverLine(1.4, curves, '#6b5c52', '#a8ddf5', group, 0);
  } else if (c === 'blizzard_watchtower') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#9ab0c7', roughness: 0.78 });
    const iceFlameMat = new THREE.MeshStandardMaterial({
      color: '#a8f2ff',
      emissive: '#38bdf8',
      emissiveIntensity: 1.05,
    });
    pulseMats.push({ mat: iceFlameMat, base: 1.05, amp: 0.25, speed: 3.1 });

    // Snow parapet ridges + flanking watchtowers
    for (const [wx, wz] of [
      [-4.35, 5.0],
      [4.35, 5.0],
      [-4.35, -5.6],
      [4.35, -5.6],
    ] as Array<[number, number]>) {
      if (!isClearPropPos(wx, wz, level, roadSamples, 1.15, 1.05)) continue;
      const tower = new THREE.Group();
      tower.position.set(wx, 0, wz);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.38, 6), stoneMat);
      body.position.y = 0.69;
      body.castShadow = true;
      tower.add(body);
      const brazier = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), iceFlameMat);
      brazier.position.y = 1.62;
      tower.add(brazier);
      animatedProps.push({ obj: brazier, axis: 'y', speed: 1.8 });
      group.add(tower);
    }
  } else if (c === 'aurora_citadel_siege') {
    const chasmIceMat = new THREE.MeshStandardMaterial({
      color: '#7bf7e6',
      emissive: '#2dd4bf',
      emissiveIntensity: 0.56,
      roughness: 0.14,
      metalness: 0.22,
    });
    const ridgeMat = new THREE.MeshStandardMaterial({ color: '#cce6eb', roughness: 0.6 });
    pulseMats.push({ mat: chasmIceMat, base: 0.56, amp: 0.2, speed: 2.3 });

    group.add(
      buildWaterwayRibbon(
        [
          [-11.5, 3.3],
          [-4.2, 3.2],
          [0, 3.4],
          [4.2, 3.2],
          [11.5, 3.3],
        ],
        1.35,
        0.013,
        chasmIceMat,
        ridgeMat,
        0.48,
      ),
    );
    placeBridgesOverLine(3.3, curves, '#647d8a', '#98fff2', group, 0);
  } else if (c === 'cinder_slag_canal') {
    const lavaMat = new THREE.MeshStandardMaterial({
      color: '#ff7a1f',
      emissive: '#ff3d00',
      emissiveIntensity: 1.02,
      roughness: 0.3,
    });
    const crustMat = new THREE.MeshStandardMaterial({ color: '#38201b', roughness: 0.92 });
    pulseMats.push({ mat: lavaMat, base: 1.02, amp: 0.3, speed: 3.0 });

    group.add(
      buildWaterwayRibbon(
        [
          [-11.5, 1.8],
          [-4, 1.4],
          [0, 0.2],
          [4, -0.8],
          [11.5, -1.6],
        ],
        1.5,
        0.014,
        lavaMat,
        crustMat,
        0.52,
      ),
    );
    placeBridgesOverLine(0.2, curves, '#4c464a', '#d97834', group, -0.17);
  } else if (c === 'clockwork_gear_bridge') {
    const magmaSub = new THREE.MeshStandardMaterial({
      color: '#e86a17',
      emissive: '#c93c00',
      emissiveIntensity: 0.65,
    });
    pulseMats.push({ mat: magmaSub, base: 0.65, amp: 0.2, speed: 2.4 });
    const pit = new THREE.Mesh(new THREE.CircleGeometry(4.2, 28), magmaSub);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(0, 0.011, 2.0);
    group.add(pit);

    for (const [gx, gz, r, teeth, col, spd] of [
      [-1.7, 3.4, 1.65, 12, '#b8843b', 0.48],
      [1.7, 3.4, 1.65, 12, '#696266', -0.48],
      [-1.7, 0.1, 1.55, 10, '#696266', -0.52],
      [1.7, 0.1, 1.55, 10, '#b8843b', 0.52],
    ] as Array<[number, number, number, number, string, number]>) {
      const gear = buildGearMesh(r, teeth, 0.036, col);
      gear.position.set(gx, 0.014, gz);
      group.add(gear);
      animatedProps.push({ obj: gear, axis: 'y', speed: spd });
    }
  } else if (c === 'magma_crucible_arena') {
    const lavaMat = new THREE.MeshStandardMaterial({
      color: '#ff6614',
      emissive: '#ff2f00',
      emissiveIntensity: 1.05,
      roughness: 0.28,
    });
    const crucibleRim = new THREE.MeshStandardMaterial({ color: '#4d3a38', metalness: 0.55, roughness: 0.45 });
    pulseMats.push({ mat: lavaMat, base: 1.05, amp: 0.32, speed: 3.3 });

    // Glowing magma trench across lower-mid path with iron grate bridges + forge anvils on flanks
    group.add(
      buildWaterwayRibbon(
        [
          [-11.5, -1.8],
          [-4, -2.0],
          [0, -2.1],
          [4, -2.0],
          [11.5, -1.8],
        ],
        1.35,
        0.014,
        lavaMat,
        crucibleRim,
        0.5,
      ),
    );
    placeBridgesOverLine(-2.05, curves, '#4a3d3b', '#ff8c38', group, 0);

    for (const [vx, vz] of [
      [-4.2, 4.0],
      [4.2, 4.0],
      [-4.2, -5.2],
      [4.2, -5.2],
    ] as Array<[number, number]>) {
      if (!isClearPropPos(vx, vz, level, roadSamples, 1.1, 1.0)) continue;
      const vat = new THREE.Group();
      vat.position.set(vx, 0, vz);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.72, 10), crucibleRim);
      pot.position.y = 0.36;
      pot.castShadow = true;
      vat.add(pot);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 10), lavaMat);
      core.position.y = 0.73;
      vat.add(core);
      group.add(vat);
    }
  } else if (c === 'iron_core_citadel') {
    const moatLava = new THREE.MeshStandardMaterial({
      color: '#ff7019',
      emissive: '#e63200',
      emissiveIntensity: 0.98,
      roughness: 0.25,
    });
    const steelRim = new THREE.MeshStandardMaterial({ color: '#453e4d', metalness: 0.65, roughness: 0.35 });
    pulseMats.push({ mat: moatLava, base: 0.98, amp: 0.28, speed: 2.9 });

    const moat = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.5), moatLava);
    moat.rotation.x = -Math.PI / 2;
    moat.position.set(0, 0.014, -7.5);
    group.add(moat);

    for (const wz of [-8.28, -6.72]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(14, 0.16, 0.24), steelRim);
      curb.position.set(0, 0.08, wz);
      group.add(curb);
    }
    group.add(buildBridgeAt(0, -7.5, 0, '#5a5361', '#f5b849', 1.9));

    for (const [tx, tz] of [
      [-4.25, 5.2],
      [4.25, 5.2],
      [-4.25, -4.6],
      [4.25, -4.6],
    ] as Array<[number, number]>) {
      if (!isClearPropPos(tx, tz, level, roadSamples, 1.15, 1.0)) continue;
      const tesla = buildTeslaSpire();
      tesla.root.position.set(tx, 0, tz);
      group.add(tesla.root);
      animatedProps.push({ obj: tesla.ringA, axis: 'y', speed: 2.8 });
      animatedProps.push({ obj: tesla.ringB, axis: 'y', speed: -2.2 });
    }
  } else if (c === 'shadowfen_lantern_bog') {
    const bogMat = new THREE.MeshStandardMaterial({
      color: '#22c58b',
      emissive: '#0c7552',
      emissiveIntensity: 0.62,
      roughness: 0.2,
    });
    const bankMat = new THREE.MeshStandardMaterial({ color: '#3b4a38', roughness: 0.92 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#45544a', roughness: 0.85 });
    const flameMat = new THREE.MeshStandardMaterial({ color: '#c6ff8c', emissive: '#62e848', emissiveIntensity: 1.15 });
    pulseMats.push({ mat: bogMat, base: 0.62, amp: 0.16, speed: 2.2 });
    pulseMats.push({ mat: flameMat, base: 1.15, amp: 0.3, speed: 3.1 });

    const pts: Array<[number, number]> = [[-11.5, -0.5], [-4.0, 0.2], [0, 0.8], [4.0, 0.2], [11.5, -0.5]];
    group.add(buildWaterwayRibbon(pts, 1.45, 0.015, bogMat, bankMat, 0.45));
    placeBridgesOverCurve(pts, curves, '#6b4d2b', '#4d6e4e', group);

    for (const [lx, lz] of [[-4.2, 5.2], [4.2, 5.2], [-4.2, -4.8], [4.2, -4.8]] as Array<[number, number]>) {
      if (!isClearPropPos(lx, lz, level, roadSamples, 1.1, 1.0)) continue;
      const tot = new THREE.Group();
      tot.position.set(lx, 0, lz);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.15, 6), stoneMat);
      col.position.y = 0.58;
      tot.add(col);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), flameMat);
      orb.position.y = 1.32;
      tot.add(orb);
      animatedProps.push({ obj: orb, axis: 'y', speed: 1.6 });
      group.add(tot);
    }
  } else if (c === 'sunken_totem_ruins') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#b88b54', roughness: 0.88 });
    const runeMat = new THREE.MeshStandardMaterial({ color: '#ffd966', emissive: '#f59e0b', emissiveIntensity: 0.95 });
    pulseMats.push({ mat: runeMat, base: 0.95, amp: 0.25, speed: 2.6 });
    const arch = buildSandstoneArch(2.5, 2.0, '#c29058');
    arch.position.set(0, 0, -5.0);
    group.add(arch);

    for (const [tx, tz] of [[-4.3, 4.6], [4.3, 4.6], [-4.3, -2.8], [4.3, -2.8]] as Array<[number, number]>) {
      if (!isClearPropPos(tx, tz, level, roadSamples, 1.1, 1.0)) continue;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.85, 0.56), stoneMat);
      plinth.position.set(tx, 0.425, tz);
      group.add(plinth);
      const seal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), runeMat);
      seal.position.set(tx, 1.12, tz);
      group.add(seal);
      animatedProps.push({ obj: seal, axis: 'y', speed: 1.9 });
    }
  } else if (c === 'venom_alchemist_marsh') {
    const acidMat = new THREE.MeshStandardMaterial({
      color: '#5eff8f',
      emissive: '#1cc95b',
      emissiveIntensity: 0.95,
      roughness: 0.22,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#453559', roughness: 0.78 });
    pulseMats.push({ mat: acidMat, base: 0.95, amp: 0.26, speed: 2.7 });
    const linePts: Array<[number, number]> = [[-11.5, 1.2], [-3.5, 0.9], [0, 0.6], [3.5, 0.9], [11.5, 1.2]];
    group.add(buildWaterwayRibbon(linePts, 1.35, 0.014, acidMat, rimMat, 0.4));
    placeBridgesOverCurve(linePts, curves, '#4f3a61', '#5ef28e', group);

    for (const [cx, cz] of [[-4.3, 3.8], [4.3, 3.8], [-4.3, -4.6], [4.3, -4.6]] as Array<[number, number]>) {
      if (!isClearPropPos(cx, cz, level, roadSamples, 1.1, 1.0)) continue;
      const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.68, 10), rimMat);
      vat.position.set(cx, 0.34, cz);
      group.add(vat);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 10), acidMat);
      glow.position.set(cx, 0.69, cz);
      group.add(glow);
    }
  } else if (c === 'eclipse_oak_bastion') {
    const moatMat = new THREE.MeshStandardMaterial({
      color: '#e0533c',
      emissive: '#992218',
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#3b2b3d', roughness: 0.82 });
    const crownMat = new THREE.MeshStandardMaterial({ color: '#ffad5c', emissive: '#e66324', emissiveIntensity: 0.9 });
    pulseMats.push({ mat: moatMat, base: 0.85, amp: 0.25, speed: 2.8 });
    const moat = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.4), moatMat);
    moat.rotation.x = -Math.PI / 2;
    moat.position.set(0, 0.014, -6.9);
    group.add(moat);
    group.add(buildBridgeAt(0, -6.9, 0, '#4f3442', '#ffb866', 1.85));

    for (const [rx, rz] of [[-4.2, 2.2], [4.2, 2.2]] as Array<[number, number]>) {
      if (!isClearPropPos(rx, rz, level, roadSamples, 1.1, 1.0)) continue;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 1.4, 8), rimMat);
      spire.position.set(rx, 0.7, rz);
      group.add(spire);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 18), crownMat);
      halo.position.set(rx, 1.55, rz);
      group.add(halo);
      animatedProps.push({ obj: halo, axis: 'y', speed: 2.1 });
    }
  } else if (c === 'starfall_glacier_bridge') {
    const riftMat = new THREE.MeshStandardMaterial({
      color: '#5ecbff',
      emissive: '#228be6',
      emissiveIntensity: 0.78,
      roughness: 0.16,
      metalness: 0.22,
    });
    const iceMat = new THREE.MeshStandardMaterial({ color: '#ccebff', emissive: '#69b8ff', emissiveIntensity: 0.55, roughness: 0.18 });
    pulseMats.push({ mat: riftMat, base: 0.78, amp: 0.2, speed: 2.5 });
    const riftPts: Array<[number, number]> = [[-11.5, 0.4], [0, -0.4], [11.5, 0.4]];
    group.add(buildWaterwayRibbon(riftPts, 1.5, 0.014, riftMat, iceMat, 0.36));
    placeBridgesOverCurve(riftPts, curves, '#8eb6db', '#e6f5ff', group);

    for (const [sx, sz] of [[-4.2, 4.8], [4.2, 4.8], [-4.2, -3.6], [4.2, -3.6]] as Array<[number, number]>) {
      if (!isClearPropPos(sx, sz, level, roadSamples, 1.1, 1.0)) continue;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), iceMat);
      star.position.set(sx, 0.85, sz);
      group.add(star);
      animatedProps.push({ obj: star, axis: 'y', speed: 2.4 });
    }
  } else if (c === 'chrono_prism_vault') {
    const goldRingMat = new THREE.MeshStandardMaterial({ color: '#f2c25c', metalness: 0.76, roughness: 0.28 });
    const prismMat = new THREE.MeshStandardMaterial({
      color: '#7be3ff',
      emissive: '#4d7cff',
      emissiveIntensity: 0.95,
      roughness: 0.18,
    });
    pulseMats.push({ mat: prismMat, base: 0.95, amp: 0.25, speed: 3.0 });

    const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.07, 8, 36), goldRingMat);
    ringOuter.rotation.x = Math.PI / 2;
    ringOuter.position.set(0, 0.06, 0.8);
    group.add(ringOuter);
    animatedProps.push({ obj: ringOuter, axis: 'z', speed: 0.55 });

    const ringInner = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.055, 8, 28), prismMat);
    ringInner.rotation.x = Math.PI / 2;
    ringInner.position.set(0, 0.08, 0.8);
    group.add(ringInner);
    animatedProps.push({ obj: ringInner, axis: 'z', speed: -0.95 });

    for (const [px, pz] of [[-4.2, 2.8], [4.2, 2.8], [-4.2, -3.8], [4.2, -3.8]] as Array<[number, number]>) {
      if (!isClearPropPos(px, pz, level, roadSamples, 1.1, 1.0)) continue;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), prismMat);
      crystal.scale.set(1, 2.1, 1);
      crystal.position.set(px, 0.65, pz);
      group.add(crystal);
      animatedProps.push({ obj: crystal, axis: 'y', speed: 1.7 });
    }
  } else if (c === 'solar_plasma_reactor') {
    const plasmaMat = new THREE.MeshStandardMaterial({
      color: '#ffb038',
      emissive: '#ff6200',
      emissiveIntensity: 1.05,
      roughness: 0.22,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#47362e', metalness: 0.65, roughness: 0.36 });
    pulseMats.push({ mat: plasmaMat, base: 1.05, amp: 0.3, speed: 3.2 });
    const chanPts: Array<[number, number]> = [[-11.5, 2.4], [0, 1.9], [11.5, 2.4]];
    group.add(buildWaterwayRibbon(chanPts, 1.38, 0.015, plasmaMat, rimMat, 0.44));
    placeBridgesOverCurve(chanPts, curves, '#5c4130', '#ffb84d', group);

    for (const [gx, gz, sp] of [[-4.1, -3.8, 1.3], [4.1, -3.8, -1.3]] as Array<[number, number, number]>) {
      if (!isClearPropPos(gx, gz, level, roadSamples, 1.1, 1.0)) continue;
      const gear = buildGearMesh(0.75, 10, 0.16, '#d99838');
      gear.position.set(gx, 0.14, gz);
      group.add(gear);
      animatedProps.push({ obj: gear, axis: 'y', speed: sp });
    }
  } else if (c === 'astral_nexus_throne') {
    const nexusMat = new THREE.MeshStandardMaterial({
      color: '#5ed9ff',
      emissive: '#3b82f6',
      emissiveIntensity: 1.1,
      roughness: 0.2,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2b2847', metalness: 0.72, roughness: 0.3 });
    pulseMats.push({ mat: nexusMat, base: 1.1, amp: 0.3, speed: 3.1 });

    const moat = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.45), nexusMat);
    moat.rotation.x = -Math.PI / 2;
    moat.position.set(0, 0.014, -7.4);
    group.add(moat);
    const frameRim = new THREE.Mesh(new THREE.BoxGeometry(14, 0.14, 0.22), frameMat);
    frameRim.position.set(0, 0.07, -6.65);
    group.add(frameRim);
    group.add(buildBridgeAt(0, -7.4, 0, '#3a375c', '#7de3ff', 1.9));

    for (const [tx, tz] of [[-4.25, 5.2], [4.25, 5.2], [-4.25, -4.6], [4.25, -4.6]] as Array<[number, number]>) {
      if (!isClearPropPos(tx, tz, level, roadSamples, 1.15, 1.0)) continue;
      const spire = buildTeslaSpire();
      spire.root.position.set(tx, 0, tz);
      group.add(spire.root);
      animatedProps.push({ obj: spire.ringA, axis: 'y', speed: 3.2 });
      animatedProps.push({ obj: spire.ringB, axis: 'y', speed: -2.6 });
    }
  }

  return { group, animatedProps, pulseMats };
}

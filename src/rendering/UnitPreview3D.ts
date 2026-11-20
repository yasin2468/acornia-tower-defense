import * as THREE from 'three';
import { resolveHeroVisualVariant, type HeroClassId, type HeroId } from '../data/enemies.ts';
import type { EvolutionBranchId, HatId, TowerId } from '../data/towers.ts';
import { ensureModelsLoaded, type ModelName } from './AssetLoader.ts';
import {
  createHeroRig,
  createTowerRig,
  resolveTowerModelName,
  updateHeroAnimation,
  updateTowerAnimation,
  type HeroRig,
  type TowerRig,
} from './ModelFactory.ts';

export type UnitPreviewTarget =
  | {
      kind: 'tower';
      towerId: TowerId;
      tier: 1 | 2 | 3;
      branchId?: EvolutionBranchId;
      hatId: HatId;
    }
  | {
      kind: 'hero';
      heroId: HeroId;
      hatId: HatId;
      heroClass: HeroClassId;
    };

function resolveHeroModelName(heroId: HeroId, heroClass: HeroClassId): ModelName {
  if (heroId === 'kizil_kuyruk') return 'hero_fox';
  if (heroId === 'kaya_dis') return 'hero_boar';
  if (heroId === 'ay_kurdu') return 'hero_wolf';
  const variant = resolveHeroVisualVariant(heroClass, 1);
  if (variant === 'viking') return 'hero_bear_viking';
  if (variant === 'royal') return 'hero_bear_royal';
  return 'hero_bear';
}

export class UnitPreview3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private pivot: THREE.Group | null = null;
  private pedestalGeo: THREE.BufferGeometry | null = null;
  private pedestalMat: THREE.Material | null = null;
  private rimGeo: THREE.BufferGeometry | null = null;
  private rimMat: THREE.Material | null = null;
  private towerRig: TowerRig | null = null;
  private heroRig: HeroRig | null = null;
  private rafId: number | null = null;
  private loadToken = 0;
  private canvas: HTMLCanvasElement | null = null;
  private yaw = 0.25;
  private dragging = false;
  private lastPointerX = 0;
  private animTime = 0;
  private lastMs = 0;

  private onPointerDown = (ev: PointerEvent): void => {
    this.dragging = true;
    this.lastPointerX = ev.clientX;
    this.canvas?.setPointerCapture?.(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = ev.clientX - this.lastPointerX;
    this.lastPointerX = ev.clientX;
    this.yaw += dx * 0.014;
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  mount(canvas: HTMLCanvasElement, target: UnitPreviewTarget): void {
    if (typeof window === 'undefined' || !canvas) return;
    this.dispose();
    const token = ++this.loadToken;
    this.canvas = canvas;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }

    const w = canvas.clientWidth || canvas.width || 240;
    const h = canvas.clientHeight || canvas.height || 176;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / Math.max(1, h), 0.2, 40);
    camera.position.set(0, 2.35, 5.0);
    camera.lookAt(0, 1.02, 0);

    const hemi = new THREE.HemisphereLight('#d8ebff', '#4b3828', 1.05);
    const key = new THREE.DirectionalLight('#fff0d4', 1.65);
    key.position.set(3.2, 5.4, 4.0);
    const rim = new THREE.DirectionalLight('#7ce7ff', 0.85);
    rim.position.set(-3.4, 2.8, -2.5);
    scene.add(hemi, key, rim);

    const pivot = new THREE.Group();
    const pedestalGeo = new THREE.CylinderGeometry(0.88, 0.96, 0.14, 24);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: '#6b492c', roughness: 0.78 });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.07;

    const rimGeo = new THREE.TorusGeometry(0.89, 0.035, 8, 28);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#c89b52', metalness: 0.55, roughness: 0.35 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = -0.005;

    pivot.add(pedestal, rimMesh);
    scene.add(pivot);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.pivot = pivot;
    this.pedestalGeo = pedestalGeo;
    this.pedestalMat = pedestalMat;
    this.rimGeo = rimGeo;
    this.rimMat = rimMat;
    this.yaw = 0.35;
    this.animTime = 0;
    this.lastMs = performance.now();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);

    const deps: ModelName[] = [];
    if (target.kind === 'tower') {
      deps.push(resolveTowerModelName(target.towerId, target.tier, target.branchId));
    } else {
      deps.push(resolveHeroModelName(target.heroId, target.heroClass));
    }
    if (target.hatId !== 'none') {
      deps.push(`hat_${target.hatId}` as ModelName);
    }

    void ensureModelsLoaded(deps).then(() => {
      if (token !== this.loadToken || !this.pivot) return;
      if (target.kind === 'tower') {
        const rig = createTowerRig(target.towerId, target.tier, target.branchId, target.hatId, false);
        rig.root.scale.setScalar(0.86);
        this.pivot.add(rig.root);
        this.towerRig = rig;
      } else {
        const variant = resolveHeroVisualVariant(target.heroClass, 1);
        const hRig = createHeroRig(target.heroId, target.hatId, variant);
        hRig.root.scale.setScalar(1.0);
        this.pivot.add(hRig.root);
        this.heroRig = hRig;
      }
    });

    const tick = (nowMs: number): void => {
      if (token !== this.loadToken || !this.renderer || !this.scene || !this.camera || !this.pivot) return;
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastMs) / 1000));
      this.lastMs = nowMs;
      this.animTime += dt;

      if (!this.dragging) {
        this.yaw += dt * 0.65;
      }
      this.pivot.rotation.y = this.yaw;

      if (this.towerRig) {
        updateTowerAnimation(this.towerRig, this.animTime, dt);
      }
      if (this.heroRig) {
        updateHeroAnimation(this.heroRig, false, this.animTime, dt);
      }

      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    this.loadToken += 1;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('pointercancel', this.onPointerUp);
      this.canvas = null;
    }
    this.dragging = false;
    this.towerRig = null;
    this.heroRig = null;
    this.pivot = null;
    this.camera = null;
    this.scene = null;
    this.pedestalGeo?.dispose();
    this.pedestalMat?.dispose();
    this.rimGeo?.dispose();
    this.rimMat?.dispose();
    this.pedestalGeo = null;
    this.pedestalMat = null;
    this.rimGeo = null;
    this.rimMat = null;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}

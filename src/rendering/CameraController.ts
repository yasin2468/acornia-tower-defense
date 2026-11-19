import * as THREE from 'three';

/** Reduced Motion caps: trauma is scaled and hard-capped, roll and zoom punches are cut. */
export const REDUCED_MOTION_TRAUMA_SCALE = 0.35;
export const REDUCED_MOTION_TRAUMA_CAP = 0.4;

/**
 * Shake amount from trauma: trauma^2 so light hits barely move and heavy hits punch.
 * Reduced Motion scales the visible output to 25 %.
 */
export function shakeAmount(trauma: number, strength: number, reducedMotion = false): number {
  const t = Math.max(0, Math.min(1, trauma));
  const s = Math.max(0, Math.min(1, strength));
  return t * t * s * (reducedMotion ? 0.25 : 1);
}

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly basePosition = new THREE.Vector3(0, 17.8, 13.6);
  readonly baseLookAt = new THREE.Vector3(0, 0.0, -0.5);
  readonly baseFov = 39;

  private trauma = 0;
  private shakeTime = 0;
  private shakeStrength = 0.85;
  private zoomPunchDeg = 0;
  private reducedMotion = false;
  /** Directional world-space kick (e.g. toward a mortar blast) decaying exponentially. */
  private kickX = 0;
  private kickZ = 0;
  private lastRoll = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, Math.max(0.4, aspect), 0.5, 80);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.baseLookAt);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = Math.max(0.4, aspect);
    this.camera.updateProjectionMatrix();
  }

  setShakeStrength(pct: number): void {
    this.shakeStrength = Math.max(0, Math.min(1, pct / 100));
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.trauma = Math.min(this.trauma, REDUCED_MOTION_TRAUMA_CAP);
      this.zoomPunchDeg = 0;
      this.kickX = 0;
      this.kickZ = 0;
    }
  }

  isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  getTrauma(): number {
    return this.trauma;
  }

  /** Current visible shake amount (trauma^2 * strength, reduced-motion aware). */
  getShake(): number {
    return shakeAmount(this.trauma, this.shakeStrength, this.reducedMotion);
  }

  /** Last applied roll (radians); always 0 under Reduced Motion. */
  getRoll(): number {
    return this.lastRoll;
  }

  getKick(): { x: number; z: number } {
    return { x: this.kickX, z: this.kickZ };
  }

  addTrauma(amount: number): void {
    if (amount <= 0) return;
    if (this.reducedMotion) {
      this.trauma = Math.min(REDUCED_MOTION_TRAUMA_CAP, this.trauma + amount * REDUCED_MOTION_TRAUMA_SCALE);
      return;
    }
    this.trauma = Math.min(1, Math.max(0, this.trauma + amount));
  }

  addZoomPunch(deg = 1.3): void {
    if (this.reducedMotion) return;
    this.zoomPunchDeg = Math.min(3.5, Math.max(this.zoomPunchDeg, deg));
  }

  /** Snap the camera a few cm along a world XZ direction (away from a blast), decays in ~0.2 s. */
  addDirectionalKick(dirX: number, dirZ: number, amount = 0.14): void {
    if (this.reducedMotion || this.shakeStrength <= 0) return;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;
    const a = Math.min(0.34, Math.max(0, amount)) * this.shakeStrength;
    this.kickX = Math.max(-0.42, Math.min(0.42, this.kickX + (dirX / len) * a));
    this.kickZ = Math.max(-0.42, Math.min(0.42, this.kickZ + (dirZ / len) * a));
  }

  update(realDt: number): void {
    const dt = Math.max(0, realDt);
    let fovDirty = false;
    if (this.zoomPunchDeg > 0) {
      this.zoomPunchDeg = Math.max(0, this.zoomPunchDeg - 8.5 * dt);
      const nextFov = this.baseFov - this.zoomPunchDeg * this.shakeStrength;
      if (Math.abs(this.camera.fov - nextFov) > 1e-4) {
        this.camera.fov = nextFov;
        fovDirty = true;
      }
    } else if (this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      fovDirty = true;
    }
    if (fovDirty) {
      this.camera.updateProjectionMatrix();
    }

    if (this.kickX !== 0 || this.kickZ !== 0) {
      const decay = Math.exp(-15 * dt);
      this.kickX *= decay;
      this.kickZ *= decay;
      if (Math.abs(this.kickX) < 1e-4 && Math.abs(this.kickZ) < 1e-4) {
        this.kickX = 0;
        this.kickZ = 0;
      }
    }

    if (this.trauma <= 0 && this.kickX === 0 && this.kickZ === 0) {
      this.lastRoll = 0;
      this.camera.position.copy(this.basePosition);
      this.camera.lookAt(this.baseLookAt);
      return;
    }

    this.trauma = Math.max(0, this.trauma - 1.45 * dt);
    const shake = shakeAmount(this.trauma, this.shakeStrength, this.reducedMotion);
    this.shakeTime += dt * 30;

    // Translational: summed sines at unrelated rates (calibrated for ~22.4m mobile camera distance).
    const ox = 0.78 * shake * (0.6 * Math.sin(this.shakeTime * 1.7) + 0.4 * Math.sin(this.shakeTime * 2.3));
    const oy = 0.46 * shake * (0.6 * Math.sin(this.shakeTime * 1.9 + 1.1) + 0.4 * Math.sin(this.shakeTime * 2.9));
    const oz = 0.36 * shake * (0.6 * Math.sin(this.shakeTime * 1.3 + 2.3) + 0.4 * Math.sin(this.shakeTime * 3.1));
    // Rotational: roll + small pitch/yaw nudge of the look target. Cut under Reduced Motion.
    const roll = this.reducedMotion ? 0 : 0.045 * shake * Math.sin(this.shakeTime * 1.1);
    const pitch = this.reducedMotion ? 0 : 0.24 * shake * Math.sin(this.shakeTime * 2.1 + 0.7);

    this.camera.position.set(
      this.basePosition.x + ox + this.kickX,
      this.basePosition.y + oy,
      this.basePosition.z + oz + this.kickZ,
    );
    this.camera.lookAt(
      this.baseLookAt.x + ox * 0.42 + this.kickX * 0.6,
      this.baseLookAt.y + pitch,
      this.baseLookAt.z + this.kickZ * 0.6,
    );
    this.camera.rotateZ(roll);
    this.lastRoll = roll;

    if (this.trauma === 0 && this.kickX === 0 && this.kickZ === 0) {
      this.lastRoll = 0;
      this.camera.position.copy(this.basePosition);
      this.camera.lookAt(this.baseLookAt);
    }
  }
}

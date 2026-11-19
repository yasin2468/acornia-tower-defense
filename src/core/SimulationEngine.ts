import { BEAR_HERO_SPEC, ENEMIES, HERO_CLASSES, resolveHeroVisualVariant, type EnemyId, type HeroClassId } from '../data/enemies.ts';
import type { LevelSpec, Vec2 } from '../data/levels.ts';
import {
  SELL_REFUND_RATE,
  TOWERS,
  cardLevelMultiplier,
  type EvolutionBranchId,
  type TargetingPriority,
  type TowerId,
  type TowerTierStats,
} from '../data/towers.ts';
import { CommandBus, type GameCommand, type GameCommandInput } from './CommandBus.ts';
import { SeededRNG } from './SeededRNG.ts';

export const FIXED_DT = 1 / 60;
export const STAR_3_HP_THRESHOLD = 135;
export const STAR_2_HP_THRESHOLD = 80;
export const VICTORY_OAK_REWARD = 120;
export const VICTORY_GEM_REWARD = 15;

export function computeBattleStars(baseHp: number, ironMode: boolean): 1 | 2 | 3 {
  if (ironMode) return 3;
  if (baseHp >= STAR_3_HP_THRESHOLD) return 3;
  if (baseHp >= STAR_2_HP_THRESHOLD) return 2;
  return 1;
}

export function computeSellRefund(totalSpent: number, refundRate = SELL_REFUND_RATE): number {
  return Math.floor(totalSpent * refundRate);
}

export type SimEvent =
  | { type: 'TOWER_BUILT'; slotId: string; towerId: TowerId; x: number; z: number }
  | { type: 'TOWER_UPGRADED'; slotId: string; level: 2 | 3; branchId?: EvolutionBranchId }
  | { type: 'TOWER_SOLD'; slotId: string; refund: number }
  | { type: 'STUMP_CLEARED'; slotId: string }
  | { type: 'SMOKE_CLEARED'; slotId: string }
  | { type: 'TOWER_FIRED'; slotId: string; towerId: TowerId; fromX: number; fromZ: number; toX: number; toZ: number; targetIds: number[]; isChain?: boolean; isLine?: boolean; isAoe?: boolean }
  | { type: 'ENEMY_HIT'; enemyId: number; x: number; z: number; damage: number; isCrit: boolean; isBoss: boolean; armorBroken: boolean }
  | { type: 'ENEMY_KILLED'; enemyId: number; x: number; z: number; isBoss: boolean; bounty: number }
  | { type: 'BOSS_PHASE_TWO'; enemyId: number; bossId?: EnemyId; smokedSlotId?: string; x: number; z: number }
  | { type: 'PINECONE_RAIN'; x: number; z: number; hits: number }
  | { type: 'BARREL_EXPLODED'; barrelId: string; x: number; z: number; hits: number }
  | { type: 'HERO_ATTACK'; x: number; z: number; targetX: number; targetZ: number }
  | { type: 'HERO_CLAW_SHOCK'; x: number; z: number; hits: number }
  | { type: 'HERO_ULTIMATE'; variant: 'classic' | 'viking' | 'royal'; x: number; z: number; hits: number }
  | { type: 'HERO_RALLY'; x: number; z: number }
  | { type: 'HERO_LEVELED'; level: number; x: number; z: number }
  | { type: 'WAVE_STARTED'; waveNumber: number; announceEnemy?: EnemyId; earlyBonus: number }
  | { type: 'BASE_HIT'; damage: number; remainingHp: number }
  | { type: 'GAME_WON'; stars: number }
  | { type: 'GAME_LOST' };

export interface TowerInstance {
  slotId: string;
  x: number;
  z: number;
  towerId: TowerId;
  tier: 1 | 2 | 3;
  branchId?: EvolutionBranchId;
  totalSpent: number;
  priority: TargetingPriority;
  cooldown: number;
  shotsFired: number;
  smokedTimer: number;
  angle: number;
}

export interface SlotState {
  id: string;
  x: number;
  z: number;
  stumpLocked: boolean;
  stumpClearCost: number;
  runeSlot: boolean;
  tower: TowerInstance | null;
}

export interface EnemyInstance {
  uid: number;
  enemyId: EnemyId;
  isFlying: boolean;
  isBoss: boolean;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  bounty: number;
  baseDamage: number;
  radius: number;
  wpIndex: number;
  progress: number;
  age: number;
  slowPct: number;
  slowTimer: number;
  stunTimer: number;
  hitFlashTimer: number;
  armorHalved: boolean;
  phase2Triggered: boolean;
  engagedByHero: boolean;
  lane?: 0 | 1;
}

export interface ProjectileInstance {
  uid: number;
  towerId: TowerId;
  branchId?: EvolutionBranchId;
  x: number;
  z: number;
  targetUid: number;
  targetX: number;
  targetZ: number;
  speed: number;
  damage: number;
  stats: TowerTierStats;
  isCrit: boolean;
  isFourthShot: boolean;
}

export interface ResinPool {
  x: number;
  z: number;
  radius: number;
  dps: number;
  slowPct: number;
  timer: number;
}

export interface HeroState {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  moving: boolean;
  facingAngle: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  dead: boolean;
  respawnTimer: number;
  attackCooldown: number;
  clawShockCooldown: number;
  skillCooldown: number;
  skillActiveTimer: number;
  activeBuff: 'none' | 'berserk' | 'banner';
  outOfCombatTimer: number;
}

interface SpawnQueueEntry {
  enemyId: EnemyId;
  delay: number;
  hp: number;
  speed: number;
  bounty: number;
}

export interface SimOptions {
  seed?: number;
  ironMode?: boolean;
  cardLevels?: Partial<Record<TowerId | 'boz_pence', number>>;
  heroClass?: HeroClassId;
  extraStartGold?: number;
  towerDamageBonusPct?: number;
  waitForFirstWave?: boolean;
}

export class SimulationEngine {
  readonly level: LevelSpec;
  readonly rng: SeededRNG;
  readonly commands = new CommandBus();
  readonly ironMode: boolean;

  tick = 0;
  elapsed = 0;
  gold: number;
  baseHp: number;
  maxBaseHp: number;
  status: 'playing' | 'won' | 'lost' = 'playing';

  currentWaveIndex = -1; // -1 = pre-wave 1
  waveCountdown = 3.5;
  waveInProgress = false;
  waitingForFirstWave = false;
  totalKills = 0;
  reviveUsed = false;

  slots: Map<string, SlotState> = new Map();
  barrels: Map<string, { id: string; x: number; z: number; exploded: boolean }> = new Map();
  enemies: EnemyInstance[] = [];
  projectiles: ProjectileInstance[] = [];
  resinPools: ResinPool[] = [];
  spawnQueue: SpawnQueueEntry[] = [];
  hero: HeroState;

  pineconeRainCooldown = 0;
  magnetCooldown = 0;
  magnetActiveTimer = 0;
  coopReserves: Record<'p1' | 'p2', number> = { p1: 50, p2: 50 };
  onLocalDispatch?: (cmd: GameCommandInput, tick: number) => void;

  readonly cardLevels: Record<TowerId | 'boz_pence', number>;
  readonly heroClass: HeroClassId;
  readonly towerDamageBonusPct: number;

  private nextUid = 1;
  private spawnLaneToggle = 0;
  private pathLengths: number[] = [];
  private totalPathLength = 0;
  private events: SimEvent[] = [];

  constructor(level: LevelSpec, options: SimOptions = {}) {
    this.level = level;
    this.rng = new SeededRNG(options.seed ?? 1337 + level.id * 97);
    this.ironMode = Boolean(options.ironMode);
    this.waitingForFirstWave = Boolean(options.waitForFirstWave);
    this.heroClass = options.heroClass ?? 'auto';
    this.towerDamageBonusPct = options.towerDamageBonusPct ?? 0;

    this.cardLevels = {
      squirrel: options.cardLevels?.squirrel ?? 1,
      beaver: options.cardLevels?.beaver ?? 1,
      owl: options.cardLevels?.owl ?? 1,
      hedgehog: options.cardLevels?.hedgehog ?? 1,
      boz_pence: options.cardLevels?.boz_pence ?? 1,
    };

    this.gold = level.startGold + (options.extraStartGold ?? 0);
    this.maxBaseHp = this.ironMode ? 1 : level.baseHp;
    this.baseHp = this.maxBaseHp;

    for (const s of level.slots) {
      this.slots.set(s.id, {
        id: s.id,
        x: s.x,
        z: s.z,
        stumpLocked: Boolean(s.lockedByStump),
        stumpClearCost: s.stumpClearCost ?? 40,
        runeSlot: Boolean(s.runeSlot),
        tower: null,
      });
    }
    for (const b of level.barrels ?? []) {
      this.barrels.set(b.id, { id: b.id, x: b.x, z: b.z, exploded: false });
    }

    const heroMult = cardLevelMultiplier(this.cardLevels.boz_pence);
    const cls = HERO_CLASSES[this.heroClass];
    const heroHp = Math.round(BEAR_HERO_SPEC.maxHp * heroMult * cls.hpMult);
    this.hero = {
      x: level.heroStart.x,
      z: level.heroStart.z,
      targetX: level.heroStart.x,
      targetZ: level.heroStart.z,
      moving: false,
      facingAngle: 0,
      hp: heroHp,
      maxHp: heroHp,
      level: 1,
      xp: 0,
      dead: false,
      respawnTimer: 0,
      attackCooldown: 0,
      clawShockCooldown: BEAR_HERO_SPEC.clawShockInterval,
      skillCooldown: 0,
      skillActiveTimer: 0,
      activeBuff: 'none',
      outOfCombatTimer: 0,
    };

    this.computePathLengths();
  }

  private computePathLengths(): void {
    this.pathLengths = [];
    this.totalPathLength = 0;
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const a = this.level.path[i];
      const b = this.level.path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      this.pathLengths.push(len);
      this.totalPathLength += len;
    }
  }

  getPathLength(): number {
    return this.totalPathLength;
  }

  drainEvents(): SimEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  dispatch(cmd: GameCommandInput, playerId = 'p1', tickOffset = 0): void {
    const targetTick = this.tick + tickOffset;
    this.commands.enqueue({
      ...cmd,
      playerId,
      tick: targetTick,
    });
    this.onLocalDispatch?.(cmd, targetTick);
  }

  dispatchRemote(cmd: GameCommandInput, playerId = 'p2', targetTick?: number): void {
    const execTick = targetTick !== undefined && targetTick > this.tick ? targetTick : this.tick;
    this.commands.enqueue({
      ...cmd,
      playerId,
      tick: execTick,
    });
  }

  step(dt = FIXED_DT): void {
    if (this.status !== 'playing') return;

    this.tick += 1;
    this.elapsed += dt;

    for (const cmd of this.commands.drainForTick(this.tick)) {
      this.applyCommand(cmd);
    }

    if (this.pineconeRainCooldown > 0) this.pineconeRainCooldown = Math.max(0, this.pineconeRainCooldown - dt);
    if (this.magnetCooldown > 0) this.magnetCooldown = Math.max(0, this.magnetCooldown - dt);
    if (this.magnetActiveTimer > 0) this.magnetActiveTimer = Math.max(0, this.magnetActiveTimer - dt);

    this.updateWaves(dt);
    this.updateHero(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateResinPools(dt);
    this.checkWinLoss();
  }

  private applyCommand(cmd: GameCommand): void {
    switch (cmd.type) {
      case 'BUILD_TOWER': {
        const slot = this.slots.get(cmd.slotId);
        if (!slot || slot.stumpLocked || slot.tower) return;
        const spec = TOWERS[cmd.towerId];
        if (this.gold < spec.tier1.cost) return;
        this.gold -= spec.tier1.cost;
        slot.tower = {
          slotId: slot.id,
          x: slot.x,
          z: slot.z,
          towerId: cmd.towerId,
          tier: 1,
          totalSpent: spec.tier1.cost,
          priority: spec.defaultPriority,
          cooldown: 0,
          shotsFired: 0,
          smokedTimer: 0,
          angle: 0,
        };
        this.events.push({ type: 'TOWER_BUILT', slotId: slot.id, towerId: cmd.towerId, x: slot.x, z: slot.z });
        break;
      }
      case 'UPGRADE_TOWER': {
        const slot = this.slots.get(cmd.slotId);
        const tower = slot?.tower;
        if (!tower || tower.tier !== 1) return;
        const spec = TOWERS[tower.towerId];
        if (this.gold < spec.tier2.cost) return;
        this.gold -= spec.tier2.cost;
        tower.tier = 2;
        tower.totalSpent += spec.tier2.cost;
        this.events.push({ type: 'TOWER_UPGRADED', slotId: tower.slotId, level: 2 });
        break;
      }
      case 'EVOLVE_TOWER': {
        const slot = this.slots.get(cmd.slotId);
        const tower = slot?.tower;
        if (!tower || tower.tier !== 2) return;
        const spec = TOWERS[tower.towerId];
        const branch = spec.evolutions.find((e) => e.id === cmd.branchId);
        if (!branch || this.gold < branch.stats.cost) return;
        this.gold -= branch.stats.cost;
        tower.tier = 3;
        tower.branchId = cmd.branchId;
        tower.totalSpent += branch.stats.cost;
        this.events.push({
          type: 'TOWER_UPGRADED',
          slotId: tower.slotId,
          level: 3,
          branchId: cmd.branchId,
        });
        break;
      }
      case 'SELL_TOWER': {
        const slot = this.slots.get(cmd.slotId);
        const tower = slot?.tower;
        if (!slot || !tower) return;
        const refund = computeSellRefund(tower.totalSpent);
        this.gold += refund;
        slot.tower = null;
        this.events.push({ type: 'TOWER_SOLD', slotId: slot.id, refund });
        break;
      }
      case 'SET_TARGETING': {
        const tower = this.slots.get(cmd.slotId)?.tower;
        if (tower) tower.priority = cmd.priority;
        break;
      }
      case 'CLEAR_STUMP': {
        const slot = this.slots.get(cmd.slotId);
        if (!slot || !slot.stumpLocked || this.gold < slot.stumpClearCost) return;
        this.gold -= slot.stumpClearCost;
        slot.stumpLocked = false;
        this.events.push({ type: 'STUMP_CLEARED', slotId: slot.id });
        break;
      }
      case 'CLEAR_SMOKE': {
        const tower = this.slots.get(cmd.slotId)?.tower;
        if (tower && tower.smokedTimer > 0) {
          tower.smokedTimer = 0;
          this.events.push({ type: 'SMOKE_CLEARED', slotId: tower.slotId });
        }
        break;
      }
      case 'DETONATE_BARREL': {
        const barrel = this.barrels.get(cmd.barrelId);
        if (!barrel || barrel.exploded) return;
        barrel.exploded = true;
        let hits = 0;
        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - barrel.x, e.z - barrel.z) <= 3.2) {
            hits += 1;
            e.stunTimer = Math.max(e.stunTimer, 1.1);
            this.damageEnemy(e, 115, 0.35, false);
          }
        }
        this.events.push({ type: 'BARREL_EXPLODED', barrelId: barrel.id, x: barrel.x, z: barrel.z, hits });
        break;
      }
      case 'MOVE_HERO': {
        if (!this.hero.dead) {
          this.hero.targetX = Math.max(-4.6, Math.min(4.6, cmd.x));
          this.hero.targetZ = Math.max(-8.2, Math.min(9.0, cmd.z));
          this.events.push({ type: 'HERO_RALLY', x: this.hero.targetX, z: this.hero.targetZ });
        }
        break;
      }
      case 'CAST_HERO_ULTIMATE': {
        const h = this.hero;
        if (h.dead || h.skillCooldown > 0) return;
        const variant = resolveHeroVisualVariant(this.heroClass, h.level);
        const lvlMult = 1 + (h.level - 1) * 0.12;
        const cardMult = cardLevelMultiplier(this.cardLevels.boz_pence);
        let hits = 0;

        if (variant === 'classic') {
          h.skillCooldown = 18;
          h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.25));
          const dmg = Math.round(65 * lvlMult * cardMult);
          for (const e of [...this.enemies]) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - h.x, e.z - h.z) <= 3.6) {
              hits += 1;
              e.armor = Math.max(0, e.armor * 0.75);
              e.stunTimer = Math.max(e.stunTimer, 1.8);
              this.damageEnemy(e, dmg, 0.25, false, false, e.armor > 0);
            }
          }
        } else if (variant === 'viking') {
          const leading = this.enemies
            .filter((e) => !e.isFlying && e.hp > 0)
            .sort((a, b) => b.progress - a.progress)[0];
          const rawX = cmd.x ?? leading?.x ?? h.x;
          const rawZ = cmd.z ?? leading?.z ?? h.z;
          const tx = Math.max(-4.6, Math.min(4.6, rawX));
          const tz = Math.max(-8.0, Math.min(8.8, rawZ));
          if (Math.hypot(tx - h.x, tz - h.z) > 0.05) {
            h.facingAngle = Math.atan2(tx - h.x, tz - h.z);
          }
          h.x = tx;
          h.z = tz;
          h.targetX = tx;
          h.targetZ = tz;
          h.skillCooldown = 16;
          h.skillActiveTimer = 6.0;
          h.activeBuff = 'berserk';
          const dmg = Math.round(85 * lvlMult * cardMult);
          for (const e of [...this.enemies]) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - tx, e.z - tz) <= 3.2) {
              hits += 1;
              e.stunTimer = Math.max(e.stunTimer, 1.0);
              this.damageEnemy(e, dmg, 0.25, true);
            }
          }
        } else {
          h.skillCooldown = 20;
          h.skillActiveTimer = 8.0;
          h.activeBuff = 'banner';
          h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.35));
          const dmg = Math.round(50 * lvlMult * cardMult);
          for (const e of [...this.enemies]) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - h.x, e.z - h.z) <= 3.5) {
              hits += 1;
              e.stunTimer = Math.max(e.stunTimer, 1.2);
              this.damageEnemy(e, dmg, 0.2, false);
            }
          }
        }

        this.events.push({ type: 'HERO_ULTIMATE', variant, x: h.x, z: h.z, hits });
        break;
      }
      case 'CAST_PINECONE_RAIN': {
        if (this.pineconeRainCooldown > 0) return;
        this.pineconeRainCooldown = 24;
        let hits = 0;
        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          const dist = Math.hypot(e.x - cmd.x, e.z - cmd.z);
          if (dist <= 3.0) {
            hits += 1;
            this.damageEnemy(e, 45, 0.25, false);
          }
        }
        this.events.push({ type: 'PINECONE_RAIN', x: cmd.x, z: cmd.z, hits });
        break;
      }
      case 'CAST_ACORN_MAGNET': {
        if (this.magnetCooldown > 0) return;
        this.magnetCooldown = 30;
        this.magnetActiveTimer = 8;
        break;
      }
      case 'CALL_WAVE_EARLY': {
        if (this.waveInProgress) return;
        const nextIdx = this.currentWaveIndex + 1;
        if (nextIdx >= this.level.waves.length) return;
        this.startWave(nextIdx, this.getEarlyWaveBonus());
        break;
      }
      case 'REVIVE_BASE': {
        if (this.status !== 'lost' || this.reviveUsed) return;
        this.reviveUsed = true;
        this.baseHp = Math.min(this.maxBaseHp, 50);
        this.status = 'playing';
        for (const e of this.enemies) {
          e.stunTimer = Math.max(e.stunTimer, 3.0);
        }
        break;
      }
      case 'COOP_GIFT_GOLD': {
        const amt = Math.max(0, Math.floor(cmd.amount));
        if (amt <= 0 || this.coopReserves[cmd.fromRole] < amt) return;
        this.coopReserves[cmd.fromRole] -= amt;
        this.gold += amt;
        break;
      }
      case 'SPAWN_PVP_MERC': {
        const spec = ENEMIES[cmd.enemyId];
        if (!spec) return;
        const waveMult = 1 + Math.max(0, this.currentWaveIndex) * 0.12;
        const lane: 0 | 1 = this.level.secondaryPath && (this.spawnLaneToggle++ % 2) === 1 ? 1 : 0;
        this.spawnEnemy(cmd.enemyId, Math.round(spec.baseHp * waveMult), spec.speed, spec.bounty, undefined, lane);
        break;
      }
      case 'FORCE_PVP_VICTORY': {
        if (this.status === 'playing') {
          this.status = 'won';
          this.events.push({ type: 'GAME_WON', stars: 3 });
        }
        break;
      }
    }
  }

  getEarlyWaveBonus(): number {
    if (this.waveInProgress || this.currentWaveIndex < 0) return 0;
    if (this.currentWaveIndex + 1 >= this.level.waves.length) return 0;
    return Math.min(30, Math.max(4, Math.floor(Math.max(0, this.waveCountdown) * 2.5)));
  }

  private updateWaves(dt: number): void {
    if (!this.waveInProgress) {
      if (this.waitingForFirstWave) return;
      const nextIdx = this.currentWaveIndex + 1;
      if (nextIdx < this.level.waves.length) {
        this.waveCountdown -= dt;
        if (this.waveCountdown <= 0) {
          this.startWave(nextIdx, 0);
        }
      }
      return;
    }

    if (this.spawnQueue.length > 0) {
      this.spawnQueue[0].delay -= dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].delay <= 0) {
        const leftover = -this.spawnQueue[0].delay;
        const entry = this.spawnQueue.shift()!;
        const lane: 0 | 1 = this.level.secondaryPath && (this.spawnLaneToggle++ % 2) === 1 ? 1 : 0;
        this.spawnEnemy(entry.enemyId, entry.hp, entry.speed, entry.bounty, undefined, lane);
        if (this.spawnQueue.length > 0) {
          this.spawnQueue[0].delay -= leftover;
        }
      }
    } else if (this.enemies.length === 0) {
      const finishedWave = this.level.waves[this.currentWaveIndex];
      if (finishedWave) {
        this.gold += finishedWave.clearBonus;
      }
      this.waveInProgress = false;
      if (this.currentWaveIndex + 1 < this.level.waves.length) {
        this.waveCountdown = 8.0;
      }
    }
  }

  private startWave(index: number, earlyBonus: number): void {
    const wave = this.level.waves[index];
    if (!wave) return;
    this.currentWaveIndex = index;
    this.waveInProgress = true;
    this.waitingForFirstWave = false;
    this.waveCountdown = 0;
    this.spawnLaneToggle = 0;
    if (index > 0) {
      this.coopReserves.p1 = Math.min(100, this.coopReserves.p1 + 15);
      this.coopReserves.p2 = Math.min(100, this.coopReserves.p2 + 15);
    }
    if (earlyBonus > 0) this.gold += earlyBonus;

    this.spawnQueue = [];
    for (const group of wave.groups) {
      const spec = ENEMIES[group.enemyId];
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({
          enemyId: group.enemyId,
          delay: i === 0 ? (this.spawnQueue.length === 0 ? 0 : 0.7) : group.spacing,
          hp: group.hpOverride ?? spec.baseHp,
          speed: group.speedOverride ?? spec.speed,
          bounty: group.bountyOverride ?? spec.bounty,
        });
      }
    }
    this.events.push({
      type: 'WAVE_STARTED',
      waveNumber: wave.waveNumber,
      announceEnemy: wave.announceEnemy,
      earlyBonus,
    });
  }

  spawnEnemy(
    enemyId: EnemyId,
    hpOverride?: number,
    speedOverride?: number,
    bountyOverride?: number,
    startAt?: Partial<Vec2> & { wpIndex?: number; progress?: number },
    lane: 0 | 1 = 0,
  ): EnemyInstance {
    const spec = ENEMIES[enemyId];
    const activePath = lane === 1 && this.level.secondaryPath ? this.level.secondaryPath : this.level.path;
    const start = activePath[0];
    const hp = hpOverride ?? spec.baseHp;
    const enemy: EnemyInstance = {
      uid: this.nextUid++,
      enemyId,
      isFlying: spec.isFlying,
      isBoss: spec.isBoss,
      x: startAt?.x ?? start.x,
      z: startAt?.z ?? start.z,
      hp,
      maxHp: hp,
      speed: speedOverride ?? spec.speed,
      armor: spec.armor,
      bounty: bountyOverride ?? spec.bounty,
      baseDamage: spec.baseDamage,
      radius: spec.radius,
      wpIndex: startAt?.wpIndex ?? 1,
      progress: startAt?.progress ?? 0,
      age: 0,
      slowPct: 0,
      slowTimer: 0,
      stunTimer: 0,
      hitFlashTimer: 0,
      armorHalved: false,
      phase2Triggered: false,
      engagedByHero: false,
      lane,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private updateHero(dt: number): void {
    const h = this.hero;
    if (h.skillCooldown > 0) h.skillCooldown = Math.max(0, h.skillCooldown - dt);
    if (h.skillActiveTimer > 0) {
      h.skillActiveTimer = Math.max(0, h.skillActiveTimer - dt);
      if (h.skillActiveTimer === 0) h.activeBuff = 'none';
    }

    if (h.dead) {
      h.moving = false;
      h.respawnTimer -= dt;
      if (h.respawnTimer <= 0) {
        h.dead = false;
        h.hp = h.maxHp;
        h.x = h.targetX;
        h.z = h.targetZ;
      }
      return;
    }

    // Engage ground enemies within engageRange up to blockCap
    const cls = HERO_CLASSES[this.heroClass];
    const HERO_LEASH_RANGE = 4.2;
    for (const e of this.enemies) e.engagedByHero = false;
    const nearbyGround = this.enemies
      .filter((e) => !e.isFlying && e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) <= BEAR_HERO_SPEC.engageRange)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, cls.blockCap);

    for (const e of nearbyGround) {
      e.engagedByHero = true;
    }

    let destX = h.targetX;
    let destZ = h.targetZ;
    if (nearbyGround.length > 0) {
      const lead = nearbyGround[0];
      destX = Math.hypot(lead.x - h.x, lead.z - h.z) > 0.78 ? lead.x : h.x;
      destZ = Math.hypot(lead.x - h.x, lead.z - h.z) > 0.78 ? lead.z : h.z;
    } else {
      const chaseTarget = this.enemies
        .filter(
          (e) =>
            !e.isFlying &&
            e.hp > 0 &&
            (Math.hypot(e.x - h.targetX, e.z - h.targetZ) <= HERO_LEASH_RANGE ||
              Math.hypot(e.x - h.x, e.z - h.z) <= 2.4),
        )
        .sort((a, b) => b.progress - a.progress)[0];
      if (chaseTarget) {
        destX = chaseTarget.x;
        destZ = chaseTarget.z;
      }
    }

    const dx = destX - h.x;
    const dz = destZ - h.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.08) {
      const moveSpd = BEAR_HERO_SPEC.moveSpeed * (h.activeBuff === 'berserk' ? 1.35 : 1.0);
      const step = Math.min(dist, moveSpd * dt);
      h.x += (dx / dist) * step;
      h.z += (dz / dist) * step;
      h.facingAngle = Math.atan2(dx, dz);
      h.moving = true;
    } else {
      h.moving = false;
    }

    if (nearbyGround.length > 0) {
      h.outOfCombatTimer = 0;
      const lvlMult = 1 + (h.level - 1) * 0.12;
      const cardMult = cardLevelMultiplier(this.cardLevels.boz_pence);

      h.clawShockCooldown -= dt;
      if (h.clawShockCooldown <= 0) {
        h.clawShockCooldown = BEAR_HERO_SPEC.clawShockInterval;
        const shockDmg = Math.round(BEAR_HERO_SPEC.clawShockDamage * lvlMult * cardMult * cls.damageMult);
        let hits = 0;
        for (const e of this.enemies) {
          if (!e.isFlying && e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) <= cls.clawShockRadius) {
            hits += 1;
            this.damageEnemy(e, shockDmg, 0.2, false);
          }
        }
        this.events.push({ type: 'HERO_CLAW_SHOCK', x: h.x, z: h.z, hits });
      }

      h.attackCooldown -= dt;
      if (h.attackCooldown <= 0) {
        h.attackCooldown = BEAR_HERO_SPEC.attackInterval * (h.activeBuff === 'berserk' ? 0.5 : 1.0);
        const target = nearbyGround[0];
        const dmg = Math.round(BEAR_HERO_SPEC.damage * lvlMult * cardMult * cls.damageMult);
        h.facingAngle = Math.atan2(target.x - h.x, target.z - h.z);
        this.damageEnemy(target, dmg, 0.15, false);
        this.grantHeroXp(12);
        this.events.push({ type: 'HERO_ATTACK', x: h.x, z: h.z, targetX: target.x, targetZ: target.z });
      }

      // Blocked enemies retaliate mildly (Royal Banner aura mitigates incoming damage by 35%)
      const dmgTakenScale = h.activeBuff === 'banner' ? 0.65 : 1.0;
      const incomingDps = nearbyGround.reduce((acc, e) => acc + (e.isBoss ? 22 : 7), 0) * dmgTakenScale;
      h.hp -= incomingDps * dt;
      if (h.hp <= 0) {
        h.hp = 0;
        h.dead = true;
        h.moving = false;
        h.skillActiveTimer = 0;
        h.activeBuff = 'none';
        h.respawnTimer = BEAR_HERO_SPEC.respawnSeconds;
        for (const e of this.enemies) e.engagedByHero = false;
      }
    } else {
      h.outOfCombatTimer += dt;
      if (h.outOfCombatTimer >= 4.0 && h.hp < h.maxHp) {
        h.hp = Math.min(h.maxHp, h.hp + BEAR_HERO_SPEC.regenPerSecond * cls.regenMult * dt);
      }
    }
  }

  private grantHeroXp(amount: number): void {
    const h = this.hero;
    if (h.level >= 5) return;
    h.xp += amount;
    const threshold = h.level * 75;
    if (h.xp >= threshold) {
      h.xp -= threshold;
      h.level += 1;
      const oldMax = h.maxHp;
      h.maxHp = Math.round(oldMax * 1.15);
      h.hp += h.maxHp - oldMax;
      this.events.push({ type: 'HERO_LEVELED', level: h.level, x: h.x, z: h.z });
    }
  }

  private updateEnemies(dt: number): void {
    const survivors: EnemyInstance[] = [];

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;

      e.age += dt;
      const spec = ENEMIES[e.enemyId];
      if (spec.regenPerSec && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + spec.regenPerSec * dt);
      }
      if (spec.healAura) {
        const { radius, hpPerSec } = spec.healAura;
        const healAmt = hpPerSec * dt;
        for (const other of this.enemies) {
          if (other.hp <= 0 || other.hp >= other.maxHp) continue;
          if (Math.hypot(other.x - e.x, other.z - e.z) <= radius) {
            other.hp = Math.min(other.maxHp, other.hp + healAmt);
          }
        }
      }

      if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      if (e.slowTimer > 0) {
        e.slowTimer = Math.max(0, e.slowTimer - dt);
        if (e.slowTimer === 0) e.slowPct = 0;
      }
      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        survivors.push(e);
        continue;
      }

      if (e.engagedByHero) {
        survivors.push(e);
        continue;
      }

      let effectiveSpeed = e.speed * (1 - e.slowPct);
      if (
        !e.isFlying &&
        e.slowTimer <= 0 &&
        this.level.iceZones?.some((iz) => Math.hypot(e.x - iz.x, e.z - iz.z) <= iz.radius)
      ) {
        effectiveSpeed *= 1.25;
      }
      if (spec.dashInterval && spec.dashDuration && spec.dashMult && e.slowTimer <= 0) {
        if ((e.age % spec.dashInterval) < spec.dashDuration) {
          effectiveSpeed *= spec.dashMult;
        }
      }
      let remaining = effectiveSpeed * dt;
      let leaked = false;

      // Exact waypoint carry-over (tower-defense skill §1)
      const activePath = e.lane === 1 && this.level.secondaryPath ? this.level.secondaryPath : this.level.path;
      while (remaining > 0) {
        const wp = activePath[e.wpIndex];
        if (!wp) {
          leaked = true;
          break;
        }
        const dx = wp.x - e.x;
        const dz = wp.z - e.z;
        const toGo = Math.hypot(dx, dz);
        if (toGo > remaining) {
          e.x += (dx / toGo) * remaining;
          e.z += (dz / toGo) * remaining;
          e.progress += remaining;
          remaining = 0;
        } else {
          e.x = wp.x;
          e.z = wp.z;
          e.progress += toGo;
          remaining -= toGo;
          e.wpIndex += 1;
          if (e.wpIndex >= activePath.length) {
            leaked = true;
            break;
          }
        }
      }

      if (leaked) {
        this.baseHp = Math.max(0, this.baseHp - e.baseDamage);
        this.events.push({ type: 'BASE_HIT', damage: e.baseDamage, remainingHp: this.baseHp });
      } else {
        survivors.push(e);
      }
    }

    this.enemies = survivors;
  }

  getTowerStats(tower: TowerInstance): TowerTierStats {
    const spec = TOWERS[tower.towerId];
    const base =
      tower.tier === 1
        ? spec.tier1
        : tower.tier === 2
          ? spec.tier2
          : (spec.evolutions.find((e) => e.id === tower.branchId) ?? spec.evolutions[0]).stats;
    if (this.slots.get(tower.slotId)?.runeSlot) {
      return { ...base, range: Number((base.range * 1.15).toFixed(2)) };
    }
    return base;
  }

  selectTarget(tower: TowerInstance): EnemyInstance | null {
    const spec = TOWERS[tower.towerId];
    const stats = this.getTowerStats(tower);
    const inRange = this.enemies.filter((e) => {
      if (e.hp <= 0) return false;
      if (e.isFlying && !spec.canHitAir) return false;
      if (!e.isFlying && !spec.canHitGround) return false;
      return Math.hypot(e.x - tower.x, e.z - tower.z) <= stats.range;
    });
    if (inRange.length === 0) return null;

    if (tower.priority === 'first') {
      if (spec.smartModeHint === 'unslowed_first') {
        const unslowed = inRange.filter((e) => e.slowTimer <= 0);
        const pool = unslowed.length > 0 ? unslowed : inRange;
        return pool.reduce((best, cur) => (cur.progress > best.progress ? cur : best));
      }
      return inRange.reduce((best, cur) => (cur.progress > best.progress ? cur : best));
    }
    if (tower.priority === 'strongest') {
      return inRange.reduce((best, cur) => (cur.hp * (1 + cur.armor) > best.hp * (1 + best.armor) ? cur : best));
    }
    if (tower.priority === 'weakest') {
      return inRange.reduce((best, cur) => (cur.hp < best.hp ? cur : best));
    }
    return inRange.reduce((best, cur) => {
      const da = Math.hypot(cur.x - tower.x, cur.z - tower.z);
      const db = Math.hypot(best.x - tower.x, best.z - tower.z);
      return da < db ? cur : best;
    });
  }

  private updateTowers(dt: number): void {
    for (const slot of this.slots.values()) {
      const tower = slot.tower;
      if (!tower) continue;

      if (tower.smokedTimer > 0) {
        tower.smokedTimer = Math.max(0, tower.smokedTimer - dt);
        continue;
      }

      if (tower.cooldown > 0) {
        tower.cooldown = Math.max(0, tower.cooldown - dt);
      }
      if (tower.cooldown > 0) continue;

      const target = this.selectTarget(tower);
      if (!target) continue;

      const stats = this.getTowerStats(tower);
      let effectiveFireRate = stats.fireRate;
      if (!this.hero.dead && Math.hypot(this.hero.x - tower.x, this.hero.z - tower.z) <= 4.5) {
        if (this.hero.activeBuff === 'banner') {
          effectiveFireRate *= 1.3;
        } else if (resolveHeroVisualVariant(this.heroClass, this.hero.level) === 'royal') {
          effectiveFireRate *= 1.12;
        }
      }
      tower.cooldown = 1 / effectiveFireRate;
      tower.shotsFired += 1;
      tower.angle = Math.atan2(target.x - tower.x, target.z - tower.z);

      const cardMult = cardLevelMultiplier(this.cardLevels[tower.towerId]);
      const globalBonus = 1 + this.towerDamageBonusPct;
      const runeDmgBonus = slot.runeSlot ? 1.18 : 1.0;
      let dmg = stats.damage * cardMult * globalBonus * runeDmgBonus;
      let isCrit = false;

      if (stats.critChance && this.rng.next() < stats.critChance) {
        dmg *= stats.critMultiplier ?? 2.0;
        isCrit = true;
      }
      dmg = Math.round(dmg);

      const isFourthShot = Boolean(stats.freezeEveryNth && tower.shotsFired % stats.freezeEveryNth === 0);

      if (stats.chainCount && stats.chainCount > 1) {
        // Instant chain EMP lightning
        const hitIds: number[] = [];
        let cur: EnemyInstance | null = target;
        const visited = new Set<number>();
        for (let c = 0; c < stats.chainCount && cur; c++) {
          visited.add(cur.uid);
          hitIds.push(cur.uid);
          this.applyTowerHitEffects(cur, dmg, stats, isCrit, isFourthShot);
          const next = this.enemies
            .filter((e) => !visited.has(e.uid) && e.hp > 0 && Math.hypot(e.x - cur!.x, e.z - cur!.z) <= 3.6)
            .sort((a, b) => Math.hypot(a.x - cur!.x, a.z - cur!.z) - Math.hypot(b.x - cur!.x, b.z - cur!.z))[0];
          cur = next ?? null;
        }
        this.events.push({
          type: 'TOWER_FIRED',
          slotId: tower.slotId,
          towerId: tower.towerId,
          fromX: tower.x,
          fromZ: tower.z,
          toX: target.x,
          toZ: target.z,
          targetIds: hitIds,
          isChain: true,
        });
      } else if (stats.pierceLine) {
        const dx = target.x - tower.x;
        const dz = target.z - tower.z;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        const endX = tower.x + ux * stats.range;
        const endZ = tower.z + uz * stats.range;
        const hitIds: number[] = [];
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const proj = (e.x - tower.x) * ux + (e.z - tower.z) * uz;
          if (proj < 0 || proj > stats.range) continue;
          const perp = Math.abs((e.x - tower.x) * -uz + (e.z - tower.z) * ux);
          if (perp <= e.radius + 0.65) {
            hitIds.push(e.uid);
            this.applyTowerHitEffects(e, dmg, stats, isCrit, isFourthShot);
          }
        }
        this.events.push({
          type: 'TOWER_FIRED',
          slotId: tower.slotId,
          towerId: tower.towerId,
          fromX: tower.x,
          fromZ: tower.z,
          toX: endX,
          toZ: endZ,
          targetIds: hitIds,
          isLine: true,
        });
      } else {
        this.projectiles.push({
          uid: this.nextUid++,
          towerId: tower.towerId,
          branchId: tower.branchId,
          x: tower.x,
          z: tower.z,
          targetUid: target.uid,
          targetX: target.x,
          targetZ: target.z,
          speed: stats.aoeRadius ? 11.5 : 17.5,
          damage: dmg,
          stats,
          isCrit,
          isFourthShot,
        });
        this.events.push({
          type: 'TOWER_FIRED',
          slotId: tower.slotId,
          towerId: tower.towerId,
          fromX: tower.x,
          fromZ: tower.z,
          toX: target.x,
          toZ: target.z,
          targetIds: [target.uid],
          isAoe: Boolean(stats.aoeRadius),
        });
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const active: ProjectileInstance[] = [];
    for (const p of this.projectiles) {
      const target = this.enemies.find((e) => e.uid === p.targetUid && e.hp > 0);
      if (target && !p.stats.aoeRadius) {
        p.targetX = target.x;
        p.targetZ = target.z;
      }

      const dx = p.targetX - p.x;
      const dz = p.targetZ - p.z;
      const dist = Math.hypot(dx, dz);
      const move = p.speed * dt;

      if (dist <= move + 0.15) {
        if (p.stats.aoeRadius) {
          for (const e of this.enemies) {
            if (!e.isFlying && e.hp > 0 && Math.hypot(e.x - p.targetX, e.z - p.targetZ) <= p.stats.aoeRadius) {
              this.applyTowerHitEffects(e, p.damage, p.stats, p.isCrit, p.isFourthShot);
            }
          }
          if (p.stats.resinDuration && p.stats.resinDps) {
            this.resinPools.push({
              x: p.targetX,
              z: p.targetZ,
              radius: p.stats.aoeRadius * 0.9,
              dps: p.stats.resinDps,
              slowPct: p.stats.resinSlowPct ?? 0.2,
              timer: p.stats.resinDuration,
            });
          }
        } else if (target) {
          this.applyTowerHitEffects(target, p.damage, p.stats, p.isCrit, p.isFourthShot);
        }
      } else {
        p.x += (dx / dist) * move;
        p.z += (dz / dist) * move;
        active.push(p);
      }
    }
    this.projectiles = active;
  }

  private updateResinPools(dt: number): void {
    const next: ResinPool[] = [];
    for (const pool of this.resinPools) {
      pool.timer -= dt;
      if (pool.timer <= 0) continue;
      for (const e of this.enemies) {
        if (!e.isFlying && e.hp > 0 && Math.hypot(e.x - pool.x, e.z - pool.z) <= pool.radius) {
          this.damageEnemy(e, pool.dps * dt, 0, false, true);
          e.slowPct = Math.max(e.slowPct, pool.slowPct);
          e.slowTimer = Math.max(e.slowTimer, 0.3);
        }
      }
      next.push(pool);
    }
    this.resinPools = next;
  }

  private applyTowerHitEffects(
    enemy: EnemyInstance,
    rawDamage: number,
    stats: TowerTierStats,
    isCrit: boolean,
    isFourthShot: boolean,
  ): void {
    let dmg = rawDamage;
    if (enemy.isBoss && stats.bossBonusPct) {
      dmg *= 1 + stats.bossBonusPct;
    }

    let armorBroken = false;
    if (stats.permanentArmorHalve && !enemy.armorHalved) {
      enemy.armor = enemy.armor * 0.5;
      enemy.armorHalved = true;
      armorBroken = true;
    }
    if (stats.armorBreakPct && enemy.armor > 0) {
      enemy.armor = Math.max(0, enemy.armor * (1 - stats.armorBreakPct));
      armorBroken = true;
    }

    if (stats.slowPct && stats.slowDuration) {
      enemy.slowPct = Math.max(enemy.slowPct, stats.slowPct);
      enemy.slowTimer = Math.max(enemy.slowTimer, stats.slowDuration);
    }
    if (isFourthShot && stats.freezeDuration) {
      enemy.stunTimer = Math.max(enemy.stunTimer, stats.freezeDuration);
    }
    if (stats.stunChance && stats.stunDuration && this.rng.next() < stats.stunChance) {
      enemy.stunTimer = Math.max(enemy.stunTimer, stats.stunDuration);
    }

    this.damageEnemy(enemy, dmg, stats.armorPiercePct ?? 0, isCrit, false, armorBroken);
  }

  private damageEnemy(
    enemy: EnemyInstance,
    rawDamage: number,
    armorPiercePct: number,
    isCrit: boolean,
    suppressEvents = false,
    armorBroken = false,
  ): void {
    if (enemy.hp <= 0) return;

    const effectiveArmor = enemy.armor * (1 - armorPiercePct);
    const finalDamage = Math.max(1, rawDamage * (1 - effectiveArmor));
    enemy.hp -= finalDamage;
    enemy.hitFlashTimer = 0.04; // 40 ms crisp flash

    if (!suppressEvents) {
      this.events.push({
        type: 'ENEMY_HIT',
        enemyId: enemy.uid,
        x: enemy.x,
        z: enemy.z,
        damage: Math.round(finalDamage),
        isCrit,
        isBoss: enemy.isBoss,
        armorBroken,
      });
    }

    // 2-Phase Boss trigger at 50% HP
    if (enemy.isBoss && !enemy.phase2Triggered && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.phase2Triggered = true;
      const summon = ENEMIES[enemy.enemyId].phase2Summon ?? {
        enemyId: 'swarm_saw' as EnemyId,
        count: 4,
        hp: 26,
        speed: 3.2,
      };
      for (let i = 0; i < summon.count; i++) {
        const half = (summon.count - 1) * 0.5;
        this.spawnEnemy(summon.enemyId, summon.hp, summon.speed, 2, {
          x: enemy.x + (i - half) * 0.35,
          z: enemy.z + 0.2,
          wpIndex: enemy.wpIndex,
          progress: enemy.progress,
        });
      }
      const builtTowers = Array.from(this.slots.values())
        .map((s) => s.tower)
        .filter((t): t is TowerInstance => Boolean(t && t.smokedTimer <= 0));
      let smokedSlotId: string | undefined;
      if (builtTowers.length > 0) {
        builtTowers.sort(
          (a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z),
        );
        builtTowers[0].smokedTimer = 4.0;
        smokedSlotId = builtTowers[0].slotId;
      }
      this.events.push({
        type: 'BOSS_PHASE_TWO',
        enemyId: enemy.uid,
        bossId: enemy.enemyId,
        smokedSlotId,
        x: enemy.x,
        z: enemy.z,
      });
    }

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this.totalKills += 1;
      const magnetMult = this.magnetActiveTimer > 0 ? 1.5 : 1.0;
      const earned = Math.round(enemy.bounty * magnetMult);
      this.gold += earned;
      this.grantHeroXp(enemy.isBoss ? 80 : 18);
      const split = ENEMIES[enemy.enemyId].splitOnDeath;
      if (split) {
        const half = (split.count - 1) * 0.5;
        for (let i = 0; i < split.count; i++) {
          this.spawnEnemy(split.enemyId, split.hp, undefined, undefined, {
            x: enemy.x + (i - half) * 0.35,
            z: enemy.z + 0.15,
            wpIndex: enemy.wpIndex,
            progress: enemy.progress,
          });
        }
      }
      this.events.push({
        type: 'ENEMY_KILLED',
        enemyId: enemy.uid,
        x: enemy.x,
        z: enemy.z,
        isBoss: enemy.isBoss,
        bounty: earned,
      });
    }
  }

  private checkWinLoss(): void {
    if (this.baseHp <= 0) {
      this.status = 'lost';
      this.events.push({ type: 'GAME_LOST' });
      return;
    }

    const allWavesSpawned =
      this.currentWaveIndex === this.level.waves.length - 1 &&
      this.spawnQueue.length === 0 &&
      this.enemies.length === 0;

    if (allWavesSpawned) {
      this.status = 'won';
      const stars = computeBattleStars(this.baseHp, this.ironMode);
      this.events.push({ type: 'GAME_WON', stars });
    }
  }

  getChecksum(): number {
    let hash = Math.round(this.gold * 13 + this.baseHp * 31 + this.totalKills * 101);
    for (const s of this.slots.values()) {
      if (s.tower) {
        hash = (hash * 33 + s.tower.tier * 7 + s.tower.shotsFired) >>> 0;
      }
    }
    return hash >>> 0;
  }
}

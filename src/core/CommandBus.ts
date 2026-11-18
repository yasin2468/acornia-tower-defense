import type { EvolutionBranchId, TargetingPriority, TowerId } from '../data/towers.ts';

export type GameCommandInput =
  | { type: 'BUILD_TOWER'; slotId: string; towerId: TowerId }
  | { type: 'UPGRADE_TOWER'; slotId: string }
  | { type: 'EVOLVE_TOWER'; slotId: string; branchId: EvolutionBranchId }
  | { type: 'SELL_TOWER'; slotId: string }
  | { type: 'SET_TARGETING'; slotId: string; priority: TargetingPriority }
  | { type: 'CLEAR_STUMP'; slotId: string }
  | { type: 'CLEAR_SMOKE'; slotId: string }
  | { type: 'DETONATE_BARREL'; barrelId: string }
  | { type: 'MOVE_HERO'; x: number; z: number }
  | { type: 'CAST_HERO_ULTIMATE'; x?: number; z?: number }
  | { type: 'CAST_PINECONE_RAIN'; x: number; z: number }
  | { type: 'CAST_ACORN_MAGNET' }
  | { type: 'CALL_WAVE_EARLY' }
  | { type: 'REVIVE_BASE' };

export type GameCommand = GameCommandInput & { playerId: string; tick: number };

export class CommandBus {
  private pending: GameCommand[] = [];
  private history: GameCommand[] = [];

  enqueue(cmd: GameCommand): void {
    this.pending.push(cmd);
  }

  drainForTick(tick: number): GameCommand[] {
    if (this.pending.length === 0) return [];
    const due: GameCommand[] = [];
    const later: GameCommand[] = [];
    for (const cmd of this.pending) {
      if (cmd.tick <= tick) {
        due.push(cmd);
        this.history.push(cmd);
      } else {
        later.push(cmd);
      }
    }
    this.pending = later;
    return due;
  }

  getHistory(): readonly GameCommand[] {
    return this.history;
  }

  clear(): void {
    this.pending = [];
    this.history = [];
  }
}

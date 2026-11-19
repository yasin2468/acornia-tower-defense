import type { GameCommandInput } from '../core/CommandBus.ts';
import type { SimulationEngine } from '../core/SimulationEngine.ts';
import type { EnemyId } from '../data/enemies.ts';
import type { MultiMode, PlayerRole, SocialEmoteId, WsClientMessage, WsServerMessage } from '../server/wsRelay.ts';

export type { SocialEmoteId };

export interface MatchInfo {
  roomCode: string;
  role: PlayerRole;
  mode: MultiMode;
  levelId: number;
  seed: number;
  isBotMatch: boolean;
}

export type NetStatus = 'idle' | 'waiting_room' | 'matching' | 'in_match';

export class NetworkService {
  readonly wsUrl: string;

  connected = false;
  state: NetStatus = 'idle';
  mode: MultiMode = 'coop';
  role: PlayerRole = 'p1';
  roomCode = '';
  seed = 1337;
  levelId = 1;
  isBotMatch = false;
  peerBaseHp = 150;
  peerMaxBaseHp = 150;
  lastError: string | null = null;

  onStateChange?: () => void;
  onMatchStart?: (info: MatchInfo) => void;
  onRemoteCommand?: (cmd: GameCommandInput, playerId: PlayerRole, tick: number) => void;
  onPvpIncoming?: (enemyId: EnemyId, fromRole: PlayerRole) => void;
  onSocialPing?: (emoteId: SocialEmoteId, fromRole: PlayerRole, x?: number, z?: number) => void;
  onPeerState?: (peer: { baseHp: number; maxBaseHp: number; gold: number; wave: number; status: 'playing' | 'won' | 'lost' }) => void;
  onPeerLeft?: () => void;
  onError?: (code: string) => void;

  private ws: WebSocket | null = null;
  private connectPromise: Promise<boolean> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private botEmoteTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCreateResolve: ((code: string) => void) | null = null;
  private pendingJoinResolve: ((ok: boolean) => void) | null = null;
  private botTimer = 6.5;
  private botEmoteSentWave3 = false;

  constructor(wsUrl?: string) {
    if (wsUrl) {
      this.wsUrl = wsUrl;
    } else if (typeof window !== 'undefined' && window.location?.host) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.wsUrl = `${proto}//${window.location.host}/ws`;
    } else {
      this.wsUrl = 'ws://localhost:8789/ws';
    }
  }

  private clearTimers(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.botEmoteTimer !== null) {
      clearTimeout(this.botEmoteTimer);
      this.botEmoteTimer = null;
    }
  }

  private sendWs(msg: WsClientMessage): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  connect(timeoutMs = 1500): Promise<boolean> {
    if (this.ws && this.ws.readyState === 1) return Promise.resolve(true);
    if (typeof WebSocket !== 'function') return Promise.resolve(false);
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connectPromise = null;
        this.connected = ok;
        this.onStateChange?.();
        resolve(ok);
      };

      const timer = setTimeout(() => {
        try {
          this.ws?.close();
        } catch {
          // Ignore close errors during timeout
        }
        this.ws = null;
        done(false);
      }, timeoutMs);

      let sock: WebSocket;
      try {
        sock = new WebSocket(this.wsUrl);
      } catch {
        done(false);
        return;
      }
      this.ws = sock;

      sock.addEventListener('open', () => {
        done(true);
      });

      sock.addEventListener('message', (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : '';
        if (!raw) return;
        try {
          const msg = JSON.parse(raw) as WsServerMessage;
          this.handleServerMessage(msg);
        } catch {
          // Ignore invalid JSON frames
        }
      });

      sock.addEventListener('error', () => {
        done(false);
      });

      sock.addEventListener('close', () => {
        this.ws = null;
        this.connected = false;
        if (!settled) {
          done(false);
          return;
        }
        if (this.state === 'waiting_room' || this.state === 'matching') {
          this.state = 'idle';
        }
        this.onStateChange?.();
      });
    });

    return this.connectPromise;
  }

  private handleServerMessage(msg: WsServerMessage): void {
    switch (msg.type) {
      case 'ROOM_CREATED': {
        this.lastError = null;
        this.state = 'waiting_room';
        this.roomCode = msg.roomCode;
        this.role = msg.role;
        this.mode = msg.mode;
        this.levelId = msg.levelId;
        this.seed = msg.seed;
        this.isBotMatch = false;
        const res = this.pendingCreateResolve;
        this.pendingCreateResolve = null;
        res?.(msg.roomCode);
        this.onStateChange?.();
        break;
      }
      case 'QUEUED': {
        this.state = 'matching';
        this.mode = msg.mode;
        this.onStateChange?.();
        break;
      }
      case 'MATCH_START': {
        this.clearTimers();
        this.lastError = null;
        this.state = 'in_match';
        this.roomCode = msg.roomCode;
        this.role = msg.role;
        this.mode = msg.mode;
        this.levelId = msg.levelId;
        this.seed = msg.seed;
        this.isBotMatch = false;
        this.peerBaseHp = 150;
        this.peerMaxBaseHp = 150;
        const jRes = this.pendingJoinResolve;
        this.pendingJoinResolve = null;
        jRes?.(true);
        this.onStateChange?.();
        this.onMatchStart?.({
          roomCode: msg.roomCode,
          role: msg.role,
          mode: msg.mode,
          levelId: msg.levelId,
          seed: msg.seed,
          isBotMatch: false,
        });
        break;
      }
      case 'REMOTE_CMD': {
        this.onRemoteCommand?.(msg.cmd, msg.playerId, msg.tick);
        break;
      }
      case 'PVP_INCOMING': {
        this.onPvpIncoming?.(msg.enemyId, msg.fromRole);
        break;
      }
      case 'REMOTE_SOCIAL': {
        this.onSocialPing?.(msg.emoteId, msg.fromRole, msg.x, msg.z);
        break;
      }
      case 'PEER_STATE': {
        this.peerBaseHp = msg.baseHp;
        this.peerMaxBaseHp = msg.maxBaseHp;
        this.onPeerState?.(msg);
        break;
      }
      case 'PEER_LEFT': {
        if (this.state === 'in_match' && !this.isBotMatch) {
          this.isBotMatch = true;
          this.botTimer = 5.0;
          this.onPeerLeft?.();
          this.onStateChange?.();
        }
        break;
      }
      case 'ERROR': {
        this.lastError = msg.code;
        const jRes = this.pendingJoinResolve;
        this.pendingJoinResolve = null;
        jRes?.(false);
        this.onError?.(msg.code);
        this.onStateChange?.();
        break;
      }
    }
  }

  async createRoom(mode: MultiMode, levelId: number, preferredCode?: string): Promise<string> {
    this.clearTimers();
    this.lastError = null;
    this.mode = mode;
    this.levelId = levelId;
    const ok = await this.connect();
    if (!ok) {
      const code = preferredCode && /^\d{4}$/.test(preferredCode) ? preferredCode : String(1000 + Math.floor(Math.random() * 9000));
      this.roomCode = code;
      this.state = 'waiting_room';
      this.onError?.('offline');
      this.onStateChange?.();
      return code;
    }

    return new Promise<string>((resolve) => {
      const guard = setTimeout(() => {
        if (this.pendingCreateResolve === wrapResolve) {
          this.pendingCreateResolve = null;
          resolve(this.roomCode || '0000');
        }
      }, 2000);
      const wrapResolve = (code: string): void => {
        clearTimeout(guard);
        resolve(code);
      };
      this.pendingCreateResolve = wrapResolve;
      this.sendWs({ type: 'CREATE_ROOM', mode, levelId, roomCode: preferredCode });
    });
  }

  async joinRoom(roomCode: string): Promise<boolean> {
    this.clearTimers();
    this.lastError = null;
    const ok = await this.connect();
    if (!ok) {
      this.onError?.('offline');
      return false;
    }
    return new Promise<boolean>((resolve) => {
      const guard = setTimeout(() => {
        if (this.pendingJoinResolve === wrapResolve) {
          this.pendingJoinResolve = null;
          resolve(false);
        }
      }, 2500);
      const wrapResolve = (joined: boolean): void => {
        clearTimeout(guard);
        resolve(joined);
      };
      this.pendingJoinResolve = wrapResolve;
      this.sendWs({ type: 'JOIN_ROOM', roomCode: roomCode.trim() });
    });
  }

  async quickMatch(mode: MultiMode, levelId: number, botFallbackMs = 3000): Promise<void> {
    this.clearTimers();
    this.lastError = null;
    this.mode = mode;
    this.levelId = levelId;
    this.state = 'matching';
    this.isBotMatch = false;
    this.onStateChange?.();

    const ok = await this.connect(1000);
    if (!ok) {
      this.startBotMatch(mode, levelId);
      return;
    }

    this.sendWs({ type: 'QUICK_MATCH', mode, levelId });
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      if (this.state === 'matching') {
        this.sendWs({ type: 'LEAVE_ROOM' });
        this.startBotMatch(mode, levelId);
      }
    }, Math.max(0, botFallbackMs));
  }

  private startBotMatch(mode: MultiMode, levelId: number): void {
    this.clearTimers();
    this.state = 'in_match';
    this.mode = mode;
    this.role = 'p1';
    this.isBotMatch = true;
    this.roomCode = String(1000 + Math.floor(Math.random() * 9000));
    this.seed = 4000 + levelId * 131;
    this.levelId = levelId;
    this.peerBaseHp = 150;
    this.peerMaxBaseHp = 150;
    this.botTimer = 6.5;
    this.botEmoteSentWave3 = false;
    this.onStateChange?.();
    this.onMatchStart?.({
      roomCode: this.roomCode,
      role: 'p1',
      mode,
      levelId,
      seed: this.seed,
      isBotMatch: true,
    });
    this.botEmoteTimer = setTimeout(() => {
      this.botEmoteTimer = null;
      if (this.state === 'in_match' && this.isBotMatch) {
        this.onSocialPing?.('cool_squirrel', 'p2');
      }
    }, 900);
  }

  sendGameCommand(cmd: GameCommandInput, tick: number): void {
    if (this.state !== 'in_match' || this.isBotMatch || !this.connected) return;
    this.sendWs({ type: 'GAME_CMD', cmd, tick });
  }

  sendSocialPing(emoteId: SocialEmoteId, x?: number, z?: number): void {
    if (this.state !== 'in_match') return;
    if (this.isBotMatch) {
      if (this.botEmoteTimer !== null) clearTimeout(this.botEmoteTimer);
      this.botEmoteTimer = setTimeout(() => {
        this.botEmoteTimer = null;
        if (this.state === 'in_match' && this.isBotMatch) {
          this.onSocialPing?.(emoteId === 'pin_help' ? 'cool_squirrel' : 'laugh_beaver', 'p2', x, z);
        }
      }, 450);
      return;
    }
    this.sendWs({ type: 'SOCIAL_PING', emoteId, x, z });
  }

  sendPvpMerc(enemyId: EnemyId): void {
    if (this.state !== 'in_match') return;
    if (this.isBotMatch) {
      const dmgMap: Partial<Record<EnemyId, number>> = {
        scout_bot: 18,
        shield_loader: 34,
        chomp_brute: 52,
      };
      this.peerBaseHp = Math.max(0, this.peerBaseHp - (dmgMap[enemyId] ?? 18));
      this.onPeerState?.({
        baseHp: this.peerBaseHp,
        maxBaseHp: this.peerMaxBaseHp,
        gold: 100,
        wave: 1,
        status: this.peerBaseHp <= 0 ? 'lost' : 'playing',
      });
      return;
    }
    this.sendWs({ type: 'PVP_MERC', enemyId });
  }

  sendStatePing(sim: SimulationEngine): void {
    if (this.state !== 'in_match' || this.isBotMatch || !this.connected) return;
    this.sendWs({
      type: 'STATE_PING',
      baseHp: Math.ceil(sim.baseHp),
      maxBaseHp: sim.maxBaseHp,
      gold: sim.gold,
      wave: Math.max(1, sim.currentWaveIndex + 1),
      status: sim.status,
    });
  }

  stepBot(dt: number, sim: SimulationEngine): void {
    if (this.state !== 'in_match' || !this.isBotMatch || sim.status !== 'playing') return;
    if (!this.botEmoteSentWave3 && sim.currentWaveIndex >= 2) {
      this.botEmoteSentWave3 = true;
      this.onSocialPing?.('laugh_beaver', 'p2');
    }
    this.botTimer -= dt;
    if (this.botTimer > 0) return;

    if (this.mode === 'coop') {
      this.botTimer = 9.0;
      if (sim.coopReserves.p2 >= 25) {
        sim.dispatchRemote({ type: 'COOP_GIFT_GOLD', fromRole: 'p2', amount: 25 }, 'p2');
      } else {
        const freeSlot = Array.from(sim.slots.values()).find((s) => !s.stumpLocked && !s.tower);
        if (freeSlot && sim.gold >= 130) {
          sim.dispatchRemote({ type: 'BUILD_TOWER', slotId: freeSlot.id, towerId: 'squirrel' }, 'p2');
        }
      }
    } else {
      this.botTimer = 11.0;
      const merc: EnemyId = sim.currentWaveIndex >= 2 ? 'shield_loader' : 'scout_bot';
      this.onPvpIncoming?.(merc, 'p2');
    }
  }

  leaveRoom(): void {
    this.clearTimers();
    this.pendingCreateResolve = null;
    this.pendingJoinResolve = null;
    if (this.connected && (this.state === 'waiting_room' || this.state === 'matching' || this.state === 'in_match')) {
      this.sendWs({ type: 'LEAVE_ROOM' });
    }
    this.state = 'idle';
    this.isBotMatch = false;
    this.roomCode = '';
    this.onStateChange?.();
  }

  close(): void {
    this.leaveRoom();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore socket close failures
      }
      this.ws = null;
    }
    this.connected = false;
  }
}

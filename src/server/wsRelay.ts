import { createHash } from 'node:crypto';
import type * as http from 'node:http';
import type { SocketLike } from 'node:net';
import type { GameCommandInput } from '../core/CommandBus.ts';
import type { EnemyId } from '../data/enemies.ts';

export type MultiMode = 'coop' | 'pvp';
export type PlayerRole = 'p1' | 'p2';
export type SocialEmoteId = 'pin_build' | 'pin_help' | 'cool_squirrel' | 'laugh_beaver' | 'cry_dozer';

const VALID_SOCIAL_EMOTES: ReadonlySet<string> = new Set<SocialEmoteId>([
  'pin_build',
  'pin_help',
  'cool_squirrel',
  'laugh_beaver',
  'cry_dozer',
]);

export type WsClientMessage =
  | { type: 'CREATE_ROOM'; mode: MultiMode; levelId: number; roomCode?: string }
  | { type: 'JOIN_ROOM'; roomCode: string }
  | { type: 'QUICK_MATCH'; mode: MultiMode; levelId: number }
  | { type: 'LEAVE_ROOM' }
  | { type: 'GAME_CMD'; cmd: GameCommandInput; tick: number }
  | { type: 'PVP_MERC'; enemyId: EnemyId }
  | { type: 'SOCIAL_PING'; emoteId: SocialEmoteId; x?: number; z?: number }
  | {
      type: 'STATE_PING';
      baseHp: number;
      maxBaseHp: number;
      gold: number;
      wave: number;
      status: 'playing' | 'won' | 'lost';
    };

export type WsServerMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; role: PlayerRole; mode: MultiMode; levelId: number; seed: number }
  | { type: 'QUEUED'; mode: MultiMode }
  | { type: 'MATCH_START'; roomCode: string; role: PlayerRole; mode: MultiMode; levelId: number; seed: number }
  | { type: 'REMOTE_CMD'; cmd: GameCommandInput; playerId: PlayerRole; tick: number }
  | { type: 'PVP_INCOMING'; enemyId: EnemyId; fromRole: PlayerRole }
  | { type: 'REMOTE_SOCIAL'; emoteId: SocialEmoteId; fromRole: PlayerRole; x?: number; z?: number }
  | {
      type: 'PEER_STATE';
      baseHp: number;
      maxBaseHp: number;
      gold: number;
      wave: number;
      status: 'playing' | 'won' | 'lost';
    }
  | { type: 'PEER_LEFT' }
  | { type: 'ERROR'; code: 'room_not_found' | 'room_full' | 'bad_message' };

interface ClientConn {
  id: number;
  socket: SocketLike;
  roomCode: string | null;
  role: PlayerRole | null;
  closed: boolean;
}

interface RoomState {
  code: string;
  mode: MultiMode;
  levelId: number;
  seed: number;
  peers: Map<PlayerRole, ClientConn>;
}

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function encodeWsFrame(opcode: number, payload: Uint8Array): Uint8Array {
  const len = payload.length;
  let headerLen = 2;
  if (len >= 126 && len < 65536) headerLen = 4;
  else if (len >= 65536) headerLen = 10;

  const frame = new Uint8Array(headerLen + len);
  frame[0] = 0x80 | (opcode & 0x0f);
  if (len < 126) {
    frame[1] = len;
  } else if (len < 65536) {
    frame[1] = 126;
    const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    dv.setUint16(2, len, false);
  } else {
    frame[1] = 127;
    const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    dv.setBigUint64(2, BigInt(len), false);
  }
  frame.set(payload, headerLen);
  return frame;
}

function sendJson(client: ClientConn, msg: WsServerMessage): void {
  if (client.closed || client.socket.destroyed) return;
  const payload = TEXT_ENCODER.encode(JSON.stringify(msg));
  client.socket.write(encodeWsFrame(0x1, payload));
}

export interface WsRelayHandle {
  roomCount(): number;
  close(): void;
}

export function attachWsRelay(server: http.Server, wsPath = '/ws'): WsRelayHandle {
  let nextClientId = 1;
  const rooms = new Map<string, RoomState>();
  const clients = new Set<ClientConn>();
  const waitingByMode: Record<MultiMode, Array<{ client: ClientConn; levelId: number }>> = {
    coop: [],
    pvp: [],
  };

  const generateRoomCode = (preferred?: string): string => {
    if (preferred && /^\d{4}$/.test(preferred) && !rooms.has(preferred)) {
      return preferred;
    }
    for (let i = 0; i < 64; i++) {
      const cand = String(1000 + Math.floor(Math.random() * 9000));
      if (!rooms.has(cand)) return cand;
    }
    for (let c = 1000; c <= 9999; c++) {
      const s = String(c);
      if (!rooms.has(s)) return s;
    }
    return String(Date.now() % 10000).padStart(4, '0');
  };

  const dequeueClient = (client: ClientConn): void => {
    for (const mode of ['coop', 'pvp'] as const) {
      waitingByMode[mode] = waitingByMode[mode].filter((entry) => entry.client.id !== client.id && !entry.client.closed);
    }
  };

  const leaveRoom = (client: ClientConn): void => {
    dequeueClient(client);
    const code = client.roomCode;
    const role = client.role;
    client.roomCode = null;
    client.role = null;
    if (!code || !role) return;

    const room = rooms.get(code);
    if (!room) return;
    room.peers.delete(role);
    for (const peer of room.peers.values()) {
      sendJson(peer, { type: 'PEER_LEFT' });
    }
    if (room.peers.size === 0) {
      rooms.delete(code);
    }
  };

  const getOtherPeer = (client: ClientConn): ClientConn | null => {
    if (!client.roomCode || !client.role) return null;
    const room = rooms.get(client.roomCode);
    if (!room) return null;
    const otherRole: PlayerRole = client.role === 'p1' ? 'p2' : 'p1';
    return room.peers.get(otherRole) ?? null;
  };

  const handleMessage = (client: ClientConn, raw: string): void => {
    let msg: WsClientMessage;
    try {
      msg = JSON.parse(raw) as WsClientMessage;
    } catch {
      sendJson(client, { type: 'ERROR', code: 'bad_message' });
      return;
    }
    if (!msg || typeof msg.type !== 'string') {
      sendJson(client, { type: 'ERROR', code: 'bad_message' });
      return;
    }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        leaveRoom(client);
        const mode: MultiMode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        const levelId = Math.max(1, Math.min(12, Math.floor(Number(msg.levelId) || 1)));
        const code = generateRoomCode(msg.roomCode);
        const seed = 1000 + Math.floor(Math.random() * 900000);
        const room: RoomState = {
          code,
          mode,
          levelId,
          seed,
          peers: new Map([['p1', client]]),
        };
        rooms.set(code, room);
        client.roomCode = code;
        client.role = 'p1';
        sendJson(client, { type: 'ROOM_CREATED', roomCode: code, role: 'p1', mode, levelId, seed });
        break;
      }
      case 'JOIN_ROOM': {
        const code = String(msg.roomCode ?? '').trim();
        const room = rooms.get(code);
        if (!room) {
          sendJson(client, { type: 'ERROR', code: 'room_not_found' });
          return;
        }
        if (room.peers.size >= 2) {
          sendJson(client, { type: 'ERROR', code: 'room_full' });
          return;
        }
        leaveRoom(client);
        const role: PlayerRole = room.peers.has('p1') ? 'p2' : 'p1';
        room.peers.set(role, client);
        client.roomCode = room.code;
        client.role = role;
        for (const [peerRole, peer] of room.peers.entries()) {
          sendJson(peer, {
            type: 'MATCH_START',
            roomCode: room.code,
            role: peerRole,
            mode: room.mode,
            levelId: room.levelId,
            seed: room.seed,
          });
        }
        break;
      }
      case 'QUICK_MATCH': {
        leaveRoom(client);
        const mode: MultiMode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        const levelId = Math.max(1, Math.min(12, Math.floor(Number(msg.levelId) || 1)));
        let matched: { client: ClientConn; levelId: number } | undefined;
        while (waitingByMode[mode].length > 0) {
          const cand = waitingByMode[mode].shift()!;
          if (!cand.client.closed && cand.client.id !== client.id) {
            matched = cand;
            break;
          }
        }
        if (matched) {
          leaveRoom(matched.client);
          const code = generateRoomCode();
          const seed = 1000 + Math.floor(Math.random() * 900000);
          const matchLevelId = matched.levelId;
          const room: RoomState = {
            code,
            mode,
            levelId: matchLevelId,
            seed,
            peers: new Map([
              ['p1', matched.client],
              ['p2', client],
            ]),
          };
          rooms.set(code, room);
          matched.client.roomCode = code;
          matched.client.role = 'p1';
          client.roomCode = code;
          client.role = 'p2';
          for (const [peerRole, peer] of room.peers.entries()) {
            sendJson(peer, {
              type: 'MATCH_START',
              roomCode: code,
              role: peerRole,
              mode,
              levelId: matchLevelId,
              seed,
            });
          }
        } else {
          waitingByMode[mode].push({ client, levelId });
          sendJson(client, { type: 'QUEUED', mode });
        }
        break;
      }
      case 'LEAVE_ROOM': {
        leaveRoom(client);
        break;
      }
      case 'GAME_CMD': {
        const other = getOtherPeer(client);
        if (other && client.role) {
          sendJson(other, { type: 'REMOTE_CMD', cmd: msg.cmd, playerId: client.role, tick: msg.tick });
        }
        break;
      }
      case 'PVP_MERC': {
        const other = getOtherPeer(client);
        if (other && client.role) {
          sendJson(other, { type: 'PVP_INCOMING', enemyId: msg.enemyId, fromRole: client.role });
        }
        break;
      }
      case 'SOCIAL_PING': {
        if (!VALID_SOCIAL_EMOTES.has(msg.emoteId)) return;
        const other = getOtherPeer(client);
        if (other && client.role) {
          sendJson(other, {
            type: 'REMOTE_SOCIAL',
            emoteId: msg.emoteId,
            fromRole: client.role,
            x: typeof msg.x === 'number' && Number.isFinite(msg.x) ? msg.x : undefined,
            z: typeof msg.z === 'number' && Number.isFinite(msg.z) ? msg.z : undefined,
          });
        }
        break;
      }
      case 'STATE_PING': {
        const other = getOtherPeer(client);
        if (other) {
          sendJson(other, {
            type: 'PEER_STATE',
            baseHp: msg.baseHp,
            maxBaseHp: msg.maxBaseHp,
            gold: msg.gold,
            wave: msg.wave,
            status: msg.status,
          });
        }
        break;
      }
    }
  };

  const onUpgrade = (req: http.IncomingMessage, socket: SocketLike, head: Uint8Array): void => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname !== wsPath) return; // Keep Vite HMR (/vite-hmr etc.) untouched

    const upgrade = String(req.headers['upgrade'] ?? '').toLowerCase();
    const rawKey = req.headers['sec-websocket-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (upgrade !== 'websocket' || !key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = createHash('sha1').update(`${key.trim()}${WS_MAGIC}`).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay?.(true);

    const client: ClientConn = {
      id: nextClientId++,
      socket,
      roomCode: null,
      role: null,
      closed: false,
    };
    clients.add(client);

    let buffer: Uint8Array = head && head.length > 0 ? new Uint8Array(head) : new Uint8Array(0);
    let fragChunks: Uint8Array[] = [];
    let fragOpcode = 0;

    const drainFrames = (): void => {
      while (buffer.length >= 2) {
        const b0 = buffer[0];
        const b1 = buffer[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
          payloadLen = dv.getUint16(2, false);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
          const bigLen = Number(dv.getBigUint64(2, false));
          if (!Number.isFinite(bigLen) || bigLen > 2 * 1024 * 1024) {
            socket.destroy();
            return;
          }
          payloadLen = bigLen;
          offset = 10;
        }

        const maskLen = masked ? 4 : 0;
        const total = offset + maskLen + payloadLen;
        if (buffer.length < total) return;

        const payload = new Uint8Array(payloadLen);
        if (masked) {
          const m0 = buffer[offset];
          const m1 = buffer[offset + 1];
          const m2 = buffer[offset + 2];
          const m3 = buffer[offset + 3];
          const mask = [m0, m1, m2, m3];
          const start = offset + 4;
          for (let i = 0; i < payloadLen; i++) {
            payload[i] = buffer[start + i] ^ mask[i & 3];
          }
        } else {
          payload.set(buffer.subarray(offset, offset + payloadLen));
        }

        buffer = buffer.subarray(total);

        if (opcode === 0x8) {
          if (!client.closed) {
            socket.write(encodeWsFrame(0x8, new Uint8Array(0)));
            socket.end();
          }
          cleanup();
          return;
        }
        if (opcode === 0x9) {
          socket.write(encodeWsFrame(0xa, payload));
          continue;
        }
        if (opcode === 0xa) {
          continue;
        }

        if (opcode === 0x1 || opcode === 0x2) {
          fragOpcode = opcode;
          if (fin) {
            if (opcode === 0x1) handleMessage(client, TEXT_DECODER.decode(payload));
          } else {
            fragChunks = [payload];
          }
        } else if (opcode === 0x0 && fragChunks.length > 0) {
          fragChunks.push(payload);
          if (fin) {
            let totalLen = 0;
            for (const ch of fragChunks) totalLen += ch.length;
            const joined = new Uint8Array(totalLen);
            let pos = 0;
            for (const ch of fragChunks) {
              joined.set(ch, pos);
              pos += ch.length;
            }
            fragChunks = [];
            if (fragOpcode === 0x1) handleMessage(client, TEXT_DECODER.decode(joined));
          }
        }
      }
    };

    const cleanup = (): void => {
      if (client.closed) return;
      client.closed = true;
      clients.delete(client);
      leaveRoom(client);
    };

    if (buffer.length > 0) drainFrames();

    socket.on('data', (chunk) => {
      buffer = concatBytes(buffer, chunk);
      drainFrames();
    });
    socket.on('close', cleanup);
    socket.on('end', cleanup);
    socket.on('error', cleanup);
  };

  server.on('upgrade', onUpgrade);

  return {
    roomCount: () => rooms.size,
    close: () => {
      server.off?.('upgrade', onUpgrade);
      for (const c of [...clients]) {
        c.closed = true;
        c.socket.destroy();
      }
      clients.clear();
      rooms.clear();
    },
  };
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { FIXED_DT, SimulationEngine } from '../src/core/SimulationEngine.ts';
import { LEVELS } from '../src/data/levels.ts';
import { attachWsRelay, type WsRelayHandle } from '../src/server/wsRelay.ts';
import { NetworkService, type MatchInfo } from '../src/services/NetworkService.ts';

async function startTestServer(): Promise<{ server: http.Server; relay: WsRelayHandle; wsUrl: string }> {
  const server = http.createServer();
  const relay = attachWsRelay(server as unknown as import('node:http').Server, '/ws');
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  return { server, relay, wsUrl: `ws://127.0.0.1:${addr.port}/ws` };
}

async function stopTestServer(
  server: http.Server,
  relay: WsRelayHandle,
  clients: NetworkService[],
): Promise<void> {
  for (const c of clients) c.close();
  relay.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function once<T>(timeoutMs = 2500): { promise: Promise<T>; resolve: (val: T) => void } {
  let res!: (val: T) => void;
  const promise = new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    res = (v: T) => {
      clearTimeout(timer);
      resolve(v);
    };
  });
  return { promise, resolve: res };
}

describe('O1 — Gerçek WebSocket rölesi, 2P Co-op ve 1v1 PvP çok oyunculu katmanı', () => {
  it('CREATE_ROOM ve JOIN_ROOM aynı seed ile MATCH_START döndürür; geçersiz odada room_not_found verir', async () => {
    const { server, relay, wsUrl } = await startTestServer();
    const c1 = new NetworkService(wsUrl);
    const c2 = new NetworkService(wsUrl);
    try {
      const code = await c1.createRoom('coop', 2, '4821');
      assert.equal(code, '4821');
      assert.equal(c1.state, 'waiting_room');

      const badJoin = await c2.joinRoom('9999');
      assert.equal(badJoin, false);
      assert.equal(c2.lastError, 'room_not_found');

      const m1 = once<MatchInfo>();
      const m2 = once<MatchInfo>();
      c1.onMatchStart = m1.resolve;
      c2.onMatchStart = m2.resolve;

      const okJoin = await c2.joinRoom('4821');
      assert.equal(okJoin, true);

      const [i1, i2] = await Promise.all([m1.promise, m2.promise]);
      assert.equal(i1.roomCode, '4821');
      assert.equal(i1.role, 'p1');
      assert.equal(i2.role, 'p2');
      assert.equal(i1.seed, i2.seed);
      assert.equal(i1.levelId, 2);
      assert.equal(i1.isBotMatch, false);
      assert.equal(i2.isBotMatch, false);
    } finally {
      await stopTestServer(server, relay, [c1, c2]);
    }
  });

  it('2P Co-op maçında kule kurma ve +25 Palamut transferi WebSocket üzerinden deterministik eşitlenir', async () => {
    const { server, relay, wsUrl } = await startTestServer();
    const c1 = new NetworkService(wsUrl);
    const c2 = new NetworkService(wsUrl);
    try {
      const m1 = once<MatchInfo>();
      const m2 = once<MatchInfo>();
      c1.onMatchStart = m1.resolve;
      c2.onMatchStart = m2.resolve;

      const code = await c1.createRoom('coop', 1, '5501');
      await c2.joinRoom(code);
      const [info1, info2] = await Promise.all([m1.promise, m2.promise]);

      const sim1 = new SimulationEngine(LEVELS[info1.levelId - 1], { seed: info1.seed });
      const sim2 = new SimulationEngine(LEVELS[info2.levelId - 1], { seed: info2.seed });
      sim1.onLocalDispatch = (cmd, tick) => c1.sendGameCommand(cmd, tick);

      let syncedCount = 0;
      const doneSync = once<void>();
      c2.onRemoteCommand = (cmd, playerId, tick) => {
        sim2.dispatchRemote(cmd, playerId, tick);
        syncedCount += 1;
        if (syncedCount >= 2) doneSync.resolve();
      };

      sim1.dispatch({ type: 'BUILD_TOWER', slotId: 'slot_1', towerId: 'squirrel' }, 'p1', 0);
      sim1.dispatch({ type: 'COOP_GIFT_GOLD', fromRole: 'p1', amount: 25 }, 'p1', 0);
      await doneSync.promise;

      for (let i = 0; i < 3; i++) {
        sim1.step(FIXED_DT);
        sim2.step(FIXED_DT);
      }

      assert.equal(sim2.slots.get('slot_1')?.tower?.towerId, 'squirrel');
      assert.equal(sim1.gold, sim2.gold);
      assert.equal(sim1.coopReserves.p1, 25);
      assert.equal(sim2.coopReserves.p1, 25);
    } finally {
      await stopTestServer(server, relay, [c1, c2]);
    }
  });

  it('1v1 PvP modunda paralı robot gönderimi rakibe düşman doğurur ve rakip düşünce zafer tetiklenir', async () => {
    const { server, relay, wsUrl } = await startTestServer();
    const c1 = new NetworkService(wsUrl);
    const c2 = new NetworkService(wsUrl);
    try {
      const m1 = once<MatchInfo>();
      const m2 = once<MatchInfo>();
      c1.onMatchStart = m1.resolve;
      c2.onMatchStart = m2.resolve;

      const code = await c1.createRoom('pvp', 1, '7712');
      await c2.joinRoom(code);
      const [info1, info2] = await Promise.all([m1.promise, m2.promise]);

      const sim1 = new SimulationEngine(LEVELS[0], { seed: info1.seed });
      const sim2 = new SimulationEngine(LEVELS[0], { seed: info2.seed });

      const gotMerc = once<string>();
      c2.onPvpIncoming = (enemyId) => {
        sim2.dispatchRemote({ type: 'SPAWN_PVP_MERC', enemyId }, 'p2');
        gotMerc.resolve(enemyId);
      };

      const gotLossPing = once<string>();
      c1.onPeerState = (peer) => {
        if (peer.status === 'lost') {
          sim1.dispatchRemote({ type: 'FORCE_PVP_VICTORY' }, 'p1');
          gotLossPing.resolve(peer.status);
        }
      };

      c1.sendPvpMerc('shield_loader');
      assert.equal(await gotMerc.promise, 'shield_loader');
      sim2.step(FIXED_DT);
      assert.ok(sim2.enemies.some((e) => e.enemyId === 'shield_loader'), 'rakipte kalkanlı dozer doğmalı');

      sim2.baseHp = 0;
      sim2.step(FIXED_DT);
      assert.equal(sim2.status, 'lost');
      c2.sendStatePing(sim2);

      assert.equal(await gotLossPing.promise, 'lost');
      sim1.step(FIXED_DT);
      assert.equal(sim1.status, 'won');
    } finally {
      await stopTestServer(server, relay, [c1, c2]);
    }
  });

  it('QUICK_MATCH iki oyuncuyu eşler; eş yoksa SmartBotDirector devreye girer', async () => {
    const { server, relay, wsUrl } = await startTestServer();
    const c1 = new NetworkService(wsUrl);
    const c2 = new NetworkService(wsUrl);
    const c3 = new NetworkService(wsUrl);
    try {
      const m1 = once<MatchInfo>();
      const m2 = once<MatchInfo>();
      c1.onMatchStart = m1.resolve;
      c2.onMatchStart = m2.resolve;

      await c1.quickMatch('pvp', 1, 2000);
      await c2.quickMatch('pvp', 1, 2000);
      const [i1, i2] = await Promise.all([m1.promise, m2.promise]);
      assert.equal(i1.roomCode, i2.roomCode);
      assert.equal(i1.isBotMatch, false);
      assert.equal(i2.isBotMatch, false);

      // Tek oyuncu kuyruğunda hızlı bot yedeği
      const mBot = once<MatchInfo>();
      c3.onMatchStart = mBot.resolve;
      await c3.quickMatch('coop', 1, 80);
      const botInfo = await mBot.promise;
      assert.equal(botInfo.isBotMatch, true);

      const simBot = new SimulationEngine(LEVELS[0], { seed: botInfo.seed });
      const goldBefore = simBot.gold;
      c3.stepBot(10, simBot);
      simBot.step(FIXED_DT);
      assert.equal(simBot.gold, goldBefore + 25, 'Co-op bot +25 Palamut aktarmalı');
    } finally {
      await stopTestServer(server, relay, [c1, c2, c3]);
    }
  });

  it('SOCIAL_PING mesajı WebSocket üzerinden koordinatlarıyla karşı oyuncuya REMOTE_SOCIAL olarak iletilir', async () => {
    const { server, relay, wsUrl } = await startTestServer();
    const c1 = new NetworkService(wsUrl);
    const c2 = new NetworkService(wsUrl);
    try {
      const m1 = once<MatchInfo>();
      const m2 = once<MatchInfo>();
      c1.onMatchStart = m1.resolve;
      c2.onMatchStart = m2.resolve;

      const code = await c1.createRoom('coop', 1, '6123');
      await c2.joinRoom(code);
      await Promise.all([m1.promise, m2.promise]);

      const gotSocial = once<{ emoteId: string; fromRole: string; x?: number; z?: number }>();
      c2.onSocialPing = (emoteId, fromRole, x, z) => {
        gotSocial.resolve({ emoteId, fromRole, x, z });
      };

      c1.sendSocialPing('pin_help', -2.5, 4.25);
      const recv = await gotSocial.promise;
      assert.equal(recv.emoteId, 'pin_help');
      assert.equal(recv.fromRole, 'p1');
      assert.equal(recv.x, -2.5);
      assert.equal(recv.z, 4.25);
    } finally {
      await stopTestServer(server, relay, [c1, c2]);
    }
  });
});

import http from 'node:http';
import { attachWsRelay } from '../src/server/wsRelay.ts';

const port = Number(process.env.PORT ?? 8789);
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: relay.roomCount() }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Palamut Kalesi WebSocket Relay');
});

const relay = attachWsRelay(server as unknown as import('node:http').Server, '/ws');
server.listen(port, () => {
  console.log(`[ws-relay] listening on ws://localhost:${port}/ws`);
});

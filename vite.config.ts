import type http from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { attachWsRelay } from './src/server/wsRelay.ts';

function wsRelayPlugin(): Plugin {
  return {
    name: 'palamut-ws-relay',
    configureServer(server) {
      if (server.httpServer) {
        attachWsRelay(server.httpServer as unknown as http.Server, '/ws');
      }
    },
    configurePreviewServer(server) {
      if (server.httpServer) {
        attachWsRelay(server.httpServer as unknown as http.Server, '/ws');
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [wsRelayPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples')) return 'three-addons';
          if (id.includes('node_modules/three')) return 'three-core';
          return undefined;
        },
      },
    },
  },
});

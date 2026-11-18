declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: 'base64' | 'hex'): string };
  };
}

declare module 'node:net' {
  export interface SocketLike {
    writable?: boolean;
    destroyed?: boolean;
    write(data: string | Uint8Array): boolean;
    end(): void;
    destroy(): void;
    setNoDelay?(noDelay?: boolean): void;
    on(event: 'data', cb: (chunk: Uint8Array) => void): void;
    on(event: 'close' | 'error' | 'end', cb: () => void): void;
  }
}

declare module 'node:http' {
  import type { SocketLike } from 'node:net';

  export interface IncomingMessageLike {
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface ServerLike {
    on(
      event: 'upgrade',
      cb: (req: IncomingMessageLike, socket: SocketLike, head: Uint8Array) => void,
    ): unknown;
    off?(
      event: 'upgrade',
      cb: (req: IncomingMessageLike, socket: SocketLike, head: Uint8Array) => void,
    ): unknown;
  }

  export type Server = ServerLike;
  export type IncomingMessage = IncomingMessageLike;
}

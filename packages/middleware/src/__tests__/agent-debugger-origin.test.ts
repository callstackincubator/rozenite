import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

import {
  fetchExpoDebuggerOrigin,
  getDebuggerWebSocketOrigin,
  resolveDebuggerOrigin,
} from '../agent/debugger-origin.js';

type RequestRecord = {
  url: string;
  headers: IncomingMessage['headers'];
};

let server: Server | null = null;

const startServer = async (
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ port: number; requests: RequestRecord[] }> => {
  const requests: RequestRecord[] = [];
  const instance = createServer((req, res) => {
    requests.push({ url: req.url ?? '', headers: req.headers });
    handler(req, res);
  });

  server = instance;

  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));

  const address = instance.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Expected a TCP address');
  }

  return { port: address.port, requests };
};

/**
 * Stands in for Expo's `/_expo/debugger`, including the part that matters:
 * the route reports the debugger URL built from Expo's own
 * `serverBaseUrl`, not from the host the request was addressed to.
 */
const expoDebuggerServer = (canonicalHost: string) =>
  startServer((req, res) => {
    if (!req.url?.startsWith('/_expo/debugger')) {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        appId: 'com.example.app',
        webSocketDebuggerUrl: `ws://${canonicalHost}/inspector/debug?device=d&page=p`,
      }),
    );
  });

afterEach(async () => {
  const instance = server;
  server = null;
  if (instance) {
    await new Promise<void>((resolve) => instance.close(() => resolve()));
  }
});

describe('getDebuggerWebSocketOrigin', () => {
  it('derives an http origin from a ws URL', () => {
    expect(getDebuggerWebSocketOrigin('ws://127.0.0.1:8081/inspector/debug?device=d')).toBe(
      'http://127.0.0.1:8081',
    );
  });

  it('derives an https origin from a wss URL', () => {
    expect(getDebuggerWebSocketOrigin('wss://devtools.example.com:8443/debug')).toBe(
      'https://devtools.example.com:8443',
    );
  });

  it('preserves an IPv6 loopback host', () => {
    expect(getDebuggerWebSocketOrigin('ws://[::1]:8081/debug')).toBe('http://[::1]:8081');
  });
});

describe('fetchExpoDebuggerOrigin', () => {
  it("returns Expo's canonical origin regardless of the host it is asked through", async () => {
    const { port, requests } = await expoDebuggerServer('localhost:8081');

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBe(
      'http://localhost:8081',
    );
    expect(requests[0].url).toBe('/_expo/debugger?appId=com.example.app');
  });

  it("sends no Origin header, which is what gets it past Expo's own check", async () => {
    const { port, requests } = await expoDebuggerServer('127.0.0.1:8081');

    await fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app');

    expect(requests[0].headers.origin).toBeUndefined();
  });

  it('encodes the app id', async () => {
    const { port, requests } = await expoDebuggerServer('127.0.0.1:8081');

    await fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example/app id');

    expect(requests[0].url).toBe('/_expo/debugger?appId=com.example%2Fapp+id');
  });

  it('maps a wss debugger URL to an https origin', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ webSocketDebuggerUrl: 'wss://tunnel.example.com/debug' }));
    });

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBe(
      'https://tunnel.example.com',
    );
  });

  it('returns null when the route is absent, as on a bare React Native dev server', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(404).end();
    });

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBeNull();
  });

  it('returns null when Expo rejects the request', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(403).end();
    });

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBeNull();
  });

  it('returns null on a malformed body', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('not json');
    });

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBeNull();
  });

  it('returns null when the payload carries no debugger URL', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ appId: 'com.example.app' }));
    });

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBeNull();
  });

  it('returns null when the debugger URL is unparseable', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ webSocketDebuggerUrl: 'not a url' }));
    });

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBeNull();
  });

  it('returns null when the dev server is unreachable', async () => {
    const { port } = await startServer((_req, res) => res.end());
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, 'com.example.app')).resolves.toBeNull();
  });

  it('returns null without a target app id', async () => {
    const { port, requests } = await expoDebuggerServer('127.0.0.1:8081');

    await expect(fetchExpoDebuggerOrigin('127.0.0.1', port, '')).resolves.toBeNull();
    expect(requests).toHaveLength(0);
  });
});

describe('resolveDebuggerOrigin', () => {
  it("prefers Expo's answer over the origin implied by the target URL", async () => {
    const { port } = await expoDebuggerServer('localhost:8081');

    await expect(
      resolveDebuggerOrigin({
        host: '127.0.0.1',
        port,
        appId: 'com.example.app',
        webSocketDebuggerUrl: 'ws://127.0.0.1:8081/inspector/debug',
      }),
    ).resolves.toBe('http://localhost:8081');
  });

  it('falls back to the target URL when Expo does not answer', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(404).end();
    });

    await expect(
      resolveDebuggerOrigin({
        host: '127.0.0.1',
        port,
        appId: 'com.example.app',
        webSocketDebuggerUrl: 'ws://127.0.0.1:8081/inspector/debug',
      }),
    ).resolves.toBe('http://127.0.0.1:8081');
  });

  it('preserves an explicitly configured remote debugger origin', async () => {
    const { port } = await startServer((_req, res) => {
      res.writeHead(404).end();
    });

    await expect(
      resolveDebuggerOrigin({
        host: '127.0.0.1',
        port,
        appId: 'com.example.app',
        webSocketDebuggerUrl: 'wss://devtools.example.com:8443/debug',
      }),
    ).resolves.toBe('https://devtools.example.com:8443');
  });
});

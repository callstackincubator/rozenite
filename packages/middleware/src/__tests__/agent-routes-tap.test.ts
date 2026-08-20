import { createServer, get, request as httpRequest, type IncomingMessage } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentResponseEnvelope, TapEvent } from '@rozenite/agent-shared';
import { createAgentRoutes } from '../agent/routes.js';
import type { AgentSessionManager } from '../agent/session-manager.js';
import type { TapListener } from '../agent/tap.js';

let activeServer: ReturnType<typeof createServer> | null = null;

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!activeServer) {
      resolve();
      return;
    }

    activeServer.close((error) => {
      activeServer = null;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

const createFakeManager = (overrides: Partial<AgentSessionManager> = {}): AgentSessionManager => {
  return {
    syncEndpoint: vi.fn(),
    getInfo: vi.fn(),
    listTargets: vi.fn(async () => []),
    createSession: vi.fn(async () => {
      throw new Error('not implemented in this fake');
    }),
    listSessions: vi.fn(() => []),
    getSession: vi.fn(() => {
      throw new Error('Unknown session "missing"');
    }),
    stopSession: vi.fn(async () => ({ stopped: true })),
    getSessionTools: vi.fn(() => []),
    callSessionTool: vi.fn(async () => undefined),
    subscribeSessionTap: vi.fn(() => vi.fn()),
    sendSessionTapMessage: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as AgentSessionManager;
};

const startServer = async (manager: AgentSessionManager): Promise<number> => {
  // Mount on a real `express()` app rather than invoking the bare `Router`
  // against a plain `http.createServer` handler — a Router alone doesn't
  // get Express's request/response augmentation (`res.json`, `req.query`,
  // etc.), which every route here relies on. This mirrors how
  // `getMiddleware` mounts it in `middleware.ts`.
  const app = express();
  app.use(createAgentRoutes(manager));
  activeServer = createServer(app);

  await new Promise<void>((resolve) => {
    activeServer!.listen(0, resolve);
  });

  const address = activeServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected an ephemeral TCP port');
  }
  return address.port;
};

const readJson = async (response: IncomingMessage): Promise<unknown> => {
  let body = '';
  response.setEncoding('utf8');
  for await (const chunk of response) {
    body += chunk;
  }
  return JSON.parse(body);
};

describe('agent tap routes', () => {
  it('returns a 404 envelope for an unknown session instead of starting a stream', async () => {
    const manager = createFakeManager();
    const port = await startServer(manager);

    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      get(`http://127.0.0.1:${port}/rozenite/agent/sessions/missing/tap`, resolve).on(
        'error',
        reject,
      );
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    await expect(readJson(response)).resolves.toEqual({
      ok: false,
      error: { message: 'Unknown session "missing"' },
    });
    expect(manager.subscribeSessionTap).not.toHaveBeenCalled();
  });

  it('streams tapped events as newline-delimited JSON for a known session', async () => {
    let capturedListener: TapListener | undefined;
    const unsubscribe = vi.fn();
    const manager = createFakeManager({
      getSession: vi.fn(() => ({ id: 'device-1' }) as never),
      subscribeSessionTap: vi.fn((_sessionId, listener) => {
        capturedListener = listener;
        return unsubscribe;
      }),
    });
    const port = await startServer(manager);

    const req = httpRequest(`http://127.0.0.1:${port}/rozenite/agent/sessions/device-1/tap`);
    req.end();

    const response = await new Promise<IncomingMessage>((resolve) => {
      req.on('response', resolve);
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    expect(manager.subscribeSessionTap).toHaveBeenCalledWith('device-1', expect.any(Function));

    const firstLine = new Promise<string>((resolve) => {
      response.setEncoding('utf8');
      response.once('data', resolve);
    });

    const event: TapEvent = {
      direction: 'in',
      timestamp: 1700000000000,
      pluginId: '@acme/sqlite-plugin',
      type: 'list-tables-request',
      payload: { requestId: 'a1' },
    };
    capturedListener?.(event);

    expect(JSON.parse((await firstLine).trim())).toEqual(event);

    req.destroy();
    // Both the request's and the response's `close` event can fire on an
    // abrupt disconnect, so `unsubscribe` may run more than once — the real
    // implementation (a `Set.delete`) tolerates that, and the route doesn't
    // try to dedupe it.
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalled());
  });

  it('filters the stream to the requested pluginId', async () => {
    let capturedListener: TapListener | undefined;
    const manager = createFakeManager({
      getSession: vi.fn(() => ({ id: 'device-1' }) as never),
      subscribeSessionTap: vi.fn((_sessionId, listener) => {
        capturedListener = listener;
        return vi.fn();
      }),
    });
    const port = await startServer(manager);

    const req = httpRequest(
      `http://127.0.0.1:${port}/rozenite/agent/sessions/device-1/tap?pluginId=${encodeURIComponent('@acme/sqlite-plugin')}`,
    );
    req.end();
    const response = await new Promise<IncomingMessage>((resolve) => {
      req.on('response', resolve);
    });
    response.setEncoding('utf8');

    const lines: string[] = [];
    response.on('data', (chunk: string) => {
      lines.push(...chunk.split('\n').filter(Boolean));
    });

    capturedListener?.({
      direction: 'in',
      timestamp: 1,
      pluginId: '@other/plugin',
      type: 'noise',
      payload: {},
    });
    capturedListener?.({
      direction: 'out',
      timestamp: 2,
      pluginId: '@acme/sqlite-plugin',
      type: 'query',
      payload: { sql: 'select 1' },
    });

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(JSON.parse(lines[0])).toMatchObject({ pluginId: '@acme/sqlite-plugin', type: 'query' });

    req.destroy();
  });

  it('rejects a POST send without pluginId or type', async () => {
    const manager = createFakeManager({ getSession: vi.fn(() => ({ id: 'device-1' }) as never) });
    const port = await startServer(manager);

    const response = await postJson(port, '/rozenite/agent/sessions/device-1/tap', {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: { message: '"pluginId" is required' },
    });
    expect(manager.sendSessionTapMessage).not.toHaveBeenCalled();
  });

  it('sends a tap message and reports success', async () => {
    const manager = createFakeManager({ getSession: vi.fn(() => ({ id: 'device-1' }) as never) });
    const port = await startServer(manager);

    const response = await postJson(port, '/rozenite/agent/sessions/device-1/tap', {
      pluginId: '@acme/sqlite-plugin',
      type: 'query',
      payload: { sql: 'select 1' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, result: { sent: true } });
    expect(manager.sendSessionTapMessage).toHaveBeenCalledWith('device-1', {
      pluginId: '@acme/sqlite-plugin',
      type: 'query',
      payload: { sql: 'select 1' },
    });
  });
});

const postJson = async (
  port: number,
  path: string,
  body: unknown,
): Promise<{ status: number; body: AgentResponseEnvelope<unknown> }> => {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      `http://127.0.0.1:${port}${path}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload, 'utf8'),
        },
      },
      (res) => {
        res.setEncoding('utf8');
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

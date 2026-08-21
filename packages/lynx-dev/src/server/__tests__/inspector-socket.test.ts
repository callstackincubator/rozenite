/**
 * Exercises the `/inspector/debug` WebSocket route over a real `http`
 * server and real `ws` client connections — more faithful than mocking
 * `ws`, and this package already depends on it (see the brief this test
 * suite was written against).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createRozeniteLynxServer, type RozeniteLynxServer } from '../index.js';
import { computeLogicalDeviceId } from '../logical-device-id.js';
import { FakeLynxTransport, makeClient } from './fakes.js';

type Harness = {
  transport: FakeLynxTransport;
  server: RozeniteLynxServer;
  httpServer: http.Server;
  port: number;
};

const harnesses: Harness[] = [];

const startServer = async (transport: FakeLynxTransport): Promise<Harness> => {
  const server = createRozeniteLynxServer({ transport });
  const httpServer = http.createServer((req, res) => {
    server.middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  });
  httpServer.on('upgrade', (req, socket, head) => {
    if (!server.handleUpgrade(req, socket, head)) {
      socket.destroy();
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;

  const harness: Harness = { transport, server, httpServer, port };
  harnesses.push(harness);
  return harness;
};

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    if (!harness) continue;
    await harness.server.dispose();
    await new Promise<void>((resolve) => harness.httpServer.close(() => resolve()));
  }
});

const waitForEvent = <T = void>(
  emitter: WebSocket,
  event: 'open' | 'message' | 'close' | 'error',
): Promise<T> =>
  new Promise((resolve) => {
    emitter.once(event, (...args: unknown[]) => resolve(args[0] as T));
  });

const waitForOpen = (ws: WebSocket): Promise<void> => waitForEvent(ws, 'open');

const waitForClose = (ws: WebSocket): Promise<{ code: number; reason: string }> =>
  new Promise((resolve) => {
    ws.once('close', (code: number, reasonBuffer: Buffer) => {
      resolve({ code, reason: reasonBuffer.toString() });
    });
  });

const waitForMessage = (ws: WebSocket): Promise<Record<string, unknown>> =>
  new Promise((resolve) => {
    ws.once('message', (data: Buffer) => {
      resolve(JSON.parse(data.toString()) as Record<string, unknown>);
    });
  });

const connectInspector = (port: number, device: string, page: number): WebSocket =>
  new WebSocket(`ws://localhost:${port}/inspector/debug?device=${device}&page=${page}`);

const setupClientWithSession = (): {
  transport: FakeLynxTransport;
  logicalDeviceId: string;
  clientId: number;
  sessionId: number;
} => {
  const transport = new FakeLynxTransport();
  const client = makeClient({ clientId: 1 });
  transport.setClients([client]);
  transport.setSessions(1, [{ sessionId: 5, url: '', type: '' }]);
  return {
    transport,
    logicalDeviceId: computeLogicalDeviceId(client),
    clientId: 1,
    sessionId: 5,
  };
};

describe('createRozeniteLynxServer: the /inspector/debug WebSocket route', () => {
  it('claims /inspector/debug but leaves other upgrade paths alone, so e.g. an HMR socket keeps working', async () => {
    const { transport } = setupClientWithSession();
    const { port } = await startServer(transport);

    const hmrSocket = new WebSocket(`ws://localhost:${port}/rsbuild-hmr`);
    const hmrOutcome = await Promise.race([
      waitForEvent(hmrSocket, 'open').then(() => 'open'),
      waitForEvent(hmrSocket, 'error').then(() => 'error'),
    ]);
    expect(hmrOutcome).toBe('error');

    const inspectorSocket = connectInspector(port, 'unknown-device', 0);
    await waitForOpen(inspectorSocket);
    inspectorSocket.close();
  });

  it('closes with a reason (not a destroyed socket) for an unknown device or a non-integer page', async () => {
    const { transport, logicalDeviceId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const unknownDevice = connectInspector(port, 'no-such-device', 5);
    await waitForOpen(unknownDevice);
    const closedUnknownDevice = await waitForClose(unknownDevice);
    expect(closedUnknownDevice.reason).toContain('[PAGE_NOT_FOUND]');

    const ws = new WebSocket(
      `ws://localhost:${port}/inspector/debug?device=${logicalDeviceId}&page=not-a-number`,
    );
    await waitForOpen(ws);
    const closedBadPage = await waitForClose(ws);
    expect(closedBadPage.reason).toContain('[PAGE_NOT_FOUND]');
  });

  it('replies to a locally-answered host message and never forwards it to the transport', async () => {
    const { transport, logicalDeviceId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);

    const replyPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.addBinding', params: { name: 'x' } }));
    const reply = await replyPromise;

    expect(reply).toEqual({ id: 1, result: {} });
    expect(transport.sentMessages).toHaveLength(0);

    ws.close();
  });

  it('forwards a host message to the transport with the right clientId/sessionId and id intact', async () => {
    const { transport, logicalDeviceId, clientId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);

    ws.send(JSON.stringify({ id: 42, method: 'Runtime.enable' }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(transport.sentMessages).toEqual([
      {
        clientId,
        sessionId,
        message: { id: 42, method: 'Runtime.enable', params: undefined },
      },
    ]);

    ws.close();
  });

  it('delivers a rozenite Customized device frame as Runtime.bindingCalled, and drops one for a different session', async () => {
    const { transport, logicalDeviceId, clientId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);

    const received: Record<string, unknown>[] = [];
    ws.on('message', (data: Buffer) => {
      received.push(JSON.parse(data.toString()) as Record<string, unknown>);
    });

    transport.emitDeviceFrame({
      kind: 'customized',
      clientId,
      sessionId: sessionId + 1000, // a different session — must not arrive.
      type: 'rozenite',
      data: 'wrong-session-payload',
    });
    transport.emitDeviceFrame({
      kind: 'customized',
      clientId,
      sessionId,
      type: 'rozenite',
      data: 'right-session-payload',
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      method: 'Runtime.bindingCalled',
      params: { payload: 'right-session-payload' },
    });

    ws.close();
  });

  it('synthesises executionContextCreated("main") right after forwarding a device executionContextsCleared', async () => {
    const { transport, logicalDeviceId, clientId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);

    const received: Record<string, unknown>[] = [];
    const gotBoth = new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        received.push(JSON.parse(data.toString()) as Record<string, unknown>);
        if (received.length === 2) {
          resolve();
        }
      });
    });

    transport.emitDeviceFrame({
      kind: 'cdp',
      clientId,
      sessionId,
      message: { method: 'Runtime.executionContextsCleared', params: {} },
    });

    await gotBoth;

    expect(received[0]).toEqual({ method: 'Runtime.executionContextsCleared', params: {} });
    expect(received[1]).toEqual({
      method: 'Runtime.executionContextCreated',
      params: { context: { id: 1, name: 'main', origin: '', uniqueId: '1' } },
    });

    ws.close();
  });

  it('closes a superseded socket with [NEW_DEBUGGER_OPENED] when a second socket opens for the same target', async () => {
    const { transport, logicalDeviceId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const first = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(first);
    const firstClosed = waitForClose(first);

    const second = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(second);

    const closed = await firstClosed;
    expect(closed.reason).toContain('[NEW_DEBUGGER_OPENED]');

    second.close();
  });

  it('closes the socket with [RECREATING_DEVICE] when its client disconnects', async () => {
    const { transport, logicalDeviceId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);
    const closedPromise = waitForClose(ws);

    transport.setClients([]);
    transport.emitTopologyChanged();

    const closed = await closedPromise;
    expect(closed.reason).toContain('[RECREATING_DEVICE]');
  });

  it('closes the socket when the same logical device comes back under a new DebugRouter client id', async () => {
    const { transport, logicalDeviceId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);
    const closedPromise = waitForClose(ws);

    // A reload normally disconnects the old client before the new one
    // registers, and the branch above closes the socket then. This covers
    // the case where only the reconnection is observed: the socket's
    // snapshotted clientId is now stale, so it must not be left open
    // silently addressing a client that no longer exists.
    const reconnected = makeClient({ clientId: 2 });
    transport.setClients([reconnected]);
    transport.setSessions(2, [{ sessionId, url: '', type: '' }]);
    transport.emitTopologyChanged();

    const closed = await closedPromise;
    expect(closed.reason).toContain('[RECREATING_DEVICE]');
  });

  it('closes the socket with [PAGE_NOT_FOUND] when its session disappears but the client is still there', async () => {
    const { transport, logicalDeviceId, clientId, sessionId } = setupClientWithSession();
    const { port } = await startServer(transport);

    const ws = connectInspector(port, logicalDeviceId, sessionId);
    await waitForOpen(ws);
    const closedPromise = waitForClose(ws);

    transport.setSessions(clientId, []);
    transport.emitTopologyChanged();

    const closed = await closedPromise;
    expect(closed.reason).toContain('[PAGE_NOT_FOUND]');
  });

  it('dispose() is idempotent and closes every open socket', async () => {
    const { transport, logicalDeviceId, sessionId } = setupClientWithSession();
    const harness = await startServer(transport);

    const ws = connectInspector(harness.port, logicalDeviceId, sessionId);
    await waitForOpen(ws);
    const closedPromise = waitForClose(ws);

    await harness.server.dispose();
    await expect(harness.server.dispose()).resolves.toBeUndefined();

    await closedPromise;
  });
});

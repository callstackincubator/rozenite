import type { ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import type { MiddlewareNext, MiddlewareRequest } from '@rozenite/middleware';
import { createJsonListMiddleware } from '../json-list.js';
import { computeLogicalDeviceId } from '../logical-device-id.js';
import { FakeLynxTransport, makeClient } from './fakes.js';

type CapturedResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const fakeResponse = (): { res: ServerResponse; captured: CapturedResponse } => {
  const captured: CapturedResponse = { statusCode: 0, headers: {}, body: '' };
  const res = {
    writeHead: (statusCode: number, headers?: Record<string, string>) => {
      captured.statusCode = statusCode;
      Object.assign(captured.headers, headers);
      return res;
    },
    end: (body?: string) => {
      captured.body = body ?? '';
      return res;
    },
  };
  return { res: res as unknown as ServerResponse, captured };
};

const fakeRequest = (
  url: string,
  options: { host?: string; encrypted?: boolean; forwardedProto?: string } = {},
): MiddlewareRequest => {
  const headers: Record<string, string> = {};
  if (options.host !== undefined) {
    headers.host = options.host;
  }
  if (options.forwardedProto !== undefined) {
    headers['x-forwarded-proto'] = options.forwardedProto;
  }
  return {
    url,
    headers,
    socket: { encrypted: options.encrypted ?? false },
  } as unknown as MiddlewareRequest;
};

describe('createJsonListMiddleware', () => {
  it('serves one entry per session, with a stable logicalDeviceId and a webSocketDebuggerUrl built from the Host header', () => {
    const transport = new FakeLynxTransport();
    const client = makeClient({ clientId: 1 });
    transport.setClients([client]);
    transport.setSessions(1, [
      { sessionId: 10, url: 'https://example.com/card', type: '' },
      { sessionId: 11, url: '', type: 'web' },
    ]);

    const middleware = createJsonListMiddleware(transport);
    const { res, captured } = fakeResponse();
    const next: MiddlewareNext = vi.fn();
    middleware(fakeRequest('/json/list', { host: 'localhost:3000' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(200);
    expect(captured.headers['Content-Type']).toBe('application/json');

    const pages = JSON.parse(captured.body) as Array<Record<string, unknown>>;
    expect(pages).toHaveLength(2);

    const logicalDeviceId = computeLogicalDeviceId(client);
    expect(logicalDeviceId).toMatch(/^[A-Za-z0-9_.-]+$/);

    const [first, second] = pages;
    expect(first).toMatchObject({
      id: `${logicalDeviceId}-10`,
      title: 'https://example.com/card',
      description: 'com.example.app',
      appId: 'com.example.app',
      type: 'node',
      deviceName: 'Pixel 7 (Android)',
      webSocketDebuggerUrl: `ws://localhost:3000/inspector/debug?device=${logicalDeviceId}&page=10`,
      reactNative: {
        logicalDeviceId,
        capabilities: { prefersFuseboxFrontend: true },
      },
    });
    // A session with no template url yet falls back to a card label.
    expect(second).toMatchObject({
      id: `${logicalDeviceId}-11`,
      title: 'Lynx card 11',
      webSocketDebuggerUrl: `ws://localhost:3000/inspector/debug?device=${logicalDeviceId}&page=11`,
    });
  });

  it('uses wss: when the request looks TLS-terminated, either directly or via a proxy', () => {
    const transport = new FakeLynxTransport();
    transport.setClients([makeClient({ clientId: 1 })]);
    transport.setSessions(1, [{ sessionId: 1, url: '', type: '' }]);
    const middleware = createJsonListMiddleware(transport);

    const runWith = (options: Parameters<typeof fakeRequest>[1]): string => {
      const { res, captured } = fakeResponse();
      middleware(fakeRequest('/json/list', { host: 'example.dev', ...options }), res, vi.fn());
      const [page] = JSON.parse(captured.body) as Array<{ webSocketDebuggerUrl: string }>;
      return page.webSocketDebuggerUrl;
    };

    expect(runWith({ encrypted: true })).toMatch(/^wss:\/\//);
    expect(runWith({ forwardedProto: 'https' })).toMatch(/^wss:\/\//);
    expect(runWith({})).toMatch(/^ws:\/\//);
  });

  it('produces the same logicalDeviceId after the client reconnects with a different clientId', () => {
    const transport = new FakeLynxTransport();
    const before = makeClient({ clientId: 1 });
    transport.setClients([before]);
    transport.setSessions(1, [{ sessionId: 1, url: '', type: '' }]);

    const middleware = createJsonListMiddleware(transport);

    const idFor = (): string => {
      const { res, captured } = fakeResponse();
      middleware(fakeRequest('/json/list', { host: 'localhost' }), res, vi.fn());
      const [page] = JSON.parse(captured.body) as Array<{
        reactNative: { logicalDeviceId: string };
      }>;
      return page.reactNative.logicalDeviceId;
    };

    const idBeforeReconnect = idFor();

    // Same os/deviceId/appName, but DebugRouter minted a fresh clientId —
    // exactly what a reload looks like.
    const after = makeClient({ clientId: 2 });
    transport.setClients([after]);
    transport.setSessions(2, [{ sessionId: 1, url: '', type: '' }]);

    expect(idFor()).toBe(idBeforeReconnect);
  });

  it('falls back to a single page=-1 entry when a client has no known sessions yet, and drops it once sessions arrive', () => {
    const transport = new FakeLynxTransport();
    const client = makeClient({ clientId: 1 });
    transport.setClients([client]);

    const middleware = createJsonListMiddleware(transport);
    const logicalDeviceId = computeLogicalDeviceId(client);

    {
      const { res, captured } = fakeResponse();
      middleware(fakeRequest('/json/list', { host: 'localhost' }), res, vi.fn());
      const pages = JSON.parse(captured.body) as Array<Record<string, unknown>>;
      expect(pages).toHaveLength(1);
      expect(pages[0]).toMatchObject({
        id: `${logicalDeviceId}--1`,
        webSocketDebuggerUrl: `ws://localhost/inspector/debug?device=${logicalDeviceId}&page=-1`,
      });
      expect(pages[0]?.title).toContain('com.example.app');
    }

    transport.setSessions(1, [{ sessionId: 7, url: '', type: '' }]);

    {
      const { res, captured } = fakeResponse();
      middleware(fakeRequest('/json/list', { host: 'localhost' }), res, vi.fn());
      const pages = JSON.parse(captured.body) as Array<{ id: string }>;
      expect(pages).toHaveLength(1);
      expect(pages[0]?.id).toBe(`${logicalDeviceId}-7`);
    }
  });

  it('calls next() for any other path', () => {
    const transport = new FakeLynxTransport();
    const middleware = createJsonListMiddleware(transport);
    const { res, captured } = fakeResponse();
    const next: MiddlewareNext = vi.fn();

    middleware(fakeRequest('/rozenite/app'), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(captured.statusCode).toBe(0);
  });
});

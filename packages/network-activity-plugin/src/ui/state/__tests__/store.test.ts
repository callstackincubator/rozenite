import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { createNetworkActivityStore as createStoreType } from '../store';

let createNetworkActivityStore: typeof createStoreType;

beforeAll(async () => {
  const storage = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });

  ({ createNetworkActivityStore } = await import('../store'));
});

describe('network activity store', () => {
  it('records elapsed duration for failed HTTP requests', () => {
    const store = createNetworkActivityStore();

    store.getState().handleEvent('request-sent', {
      requestId: 'request-1',
      timestamp: 100,
      request: {
        url: 'https://example.com/api',
        method: 'GET',
        headers: {},
      },
      initiator: {
        type: 'script',
      },
      type: 'Fetch',
    });
    store.getState().handleEvent('request-failed', {
      requestId: 'request-1',
      timestamp: 250,
      type: 'Fetch',
      error: 'Network request failed',
      canceled: false,
    });

    expect(store.getState().networkEntries.get('request-1')).toMatchObject({
      status: 'failed',
      duration: 150,
    });
  });

  it('records elapsed duration for websocket errors', () => {
    const store = createNetworkActivityStore();

    store.getState().handleEvent('websocket-connect', {
      type: 'websocket-connect',
      url: 'wss://example.com/socket',
      socketId: 'socket-1',
      timestamp: 100,
      protocols: null,
      options: [],
    });
    store.getState().handleEvent('websocket-error', {
      type: 'websocket-error',
      url: 'wss://example.com/socket',
      socketId: 'socket-1',
      timestamp: 175,
      error: 'Socket failed',
    });

    expect(store.getState().networkEntries.get('ws-socket-1')).toMatchObject({
      status: 'error',
      duration: 75,
    });
  });
});

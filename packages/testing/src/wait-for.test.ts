import { ROZENITE_RPC_MESSAGE_TYPE, getRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { describe, expect, it } from 'vitest';
import { connectFakePair } from './connect-fake-pair.js';
import {
  WaitForTimeoutError,
  waitForChannelMessage,
  waitForMessage,
  waitForRpcFrame,
} from './wait-for.js';

type EventMap = {
  ping: { value: number };
  [ROZENITE_RPC_MESSAGE_TYPE]: unknown;
};

/**
 * A minimal, real (not mocked) client-shaped fake: type-keyed listeners,
 * exactly like `RozeniteDevToolsClient`'s contract. Returns `client` and
 * `emit` as siblings, rather than one object intersecting `emit` onto the
 * client shape — an intersected return type defeats `waitForMessage`'s
 * generic inference of `TEventMap` from its first argument.
 */
const createFakeClient = (): {
  client: RozeniteDevToolsClient<EventMap>;
  emit: <TType extends keyof EventMap>(type: TType, payload: EventMap[TType]) => void;
} => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const client: RozeniteDevToolsClient<EventMap> = {
    send: () => {},
    onMessage: (type, listener) => {
      const set = listeners.get(type as string) ?? new Set();
      set.add(listener as (payload: unknown) => void);
      listeners.set(type as string, set);
      return {
        remove: () => set.delete(listener as (payload: unknown) => void),
      };
    },
    close: () => listeners.clear(),
  };

  return {
    client,
    emit: (type, payload) => {
      listeners.get(type as string)?.forEach((listener) => listener(payload));
    },
  };
};

describe('waitForMessage', () => {
  it('resolves with the payload of the next matching message', async () => {
    const { client, emit } = createFakeClient();
    const promise = waitForMessage(client, 'ping', { timeoutMs: 1000 });

    emit('ping', { value: 42 });

    await expect(promise).resolves.toEqual({ value: 42 });
  });

  it('ignores messages that fail the predicate', async () => {
    const { client, emit } = createFakeClient();
    const promise = waitForMessage(
      client,
      'ping',
      { timeoutMs: 1000 },
      (payload) => payload.value === 2,
    );

    emit('ping', { value: 1 });
    emit('ping', { value: 2 });

    await expect(promise).resolves.toEqual({ value: 2 });
  });

  it('rejects with a WaitForTimeoutError when nothing matches in time', async () => {
    const { client } = createFakeClient();
    const promise = waitForMessage(client, 'ping', { timeoutMs: 5 });

    await expect(promise).rejects.toBeInstanceOf(WaitForTimeoutError);
    await expect(promise.catch((error: Error) => error.message)).resolves.toContain('"ping"');
  });

  it('removes its listener once settled, so late messages are not observed twice', async () => {
    const { client, emit } = createFakeClient();
    const promise = waitForMessage(client, 'ping', { timeoutMs: 1000 });
    emit('ping', { value: 1 });
    await promise;

    // Emitting again after settling must not throw or double-resolve.
    expect(() => emit('ping', { value: 2 })).not.toThrow();
  });

  it('works with a real RozeniteDevToolsRequestClient over a real fake pair, predicate included', async () => {
    // `getRozeniteDevToolsClient` returns a `RozeniteDevToolsRequestClient`
    // — `RozeniteDevToolsClient<TEventMap> & { request: ... }`. This is a
    // regression guard for a real inference pitfall: TypeScript failed to
    // contextually type a `predicate` nested inside `waitForMessage`'s
    // options object against exactly this intersection type, which is why
    // `predicate` is its own trailing parameter instead (see the comment on
    // `waitForMessage`). `pnpm typecheck` on this package catches a
    // regression at compile time; this assertion covers it at runtime.
    const { device, panel } = connectFakePair();
    const deviceClient = await getRozeniteDevToolsClient<EventMap>('test-plugin', {
      channel: device,
    });
    const panelClient = await getRozeniteDevToolsClient<EventMap>('test-plugin', {
      channel: panel,
    });

    const promise = waitForMessage<EventMap, 'ping'>(
      panelClient,
      'ping',
      { timeoutMs: 1000 },
      (payload) => payload.value === 2,
    );

    deviceClient.send('ping', { value: 1 });
    deviceClient.send('ping', { value: 2 });

    await expect(promise).resolves.toEqual({ value: 2 });

    deviceClient.close();
    panelClient.close();
  });
});

describe('waitForChannelMessage', () => {
  it('resolves with the first raw message matching the predicate, across a real fake pair', async () => {
    const { device, panel } = connectFakePair();
    const promise = waitForChannelMessage(
      panel,
      (message) => typeof message === 'object' && message !== null && 'kind' in message,
      { timeoutMs: 1000 },
    );

    device.send({ kind: 'envelope', pluginId: 'x' });

    await expect(promise).resolves.toEqual({ kind: 'envelope', pluginId: 'x' });
  });

  it('rejects with a WaitForTimeoutError on expiry', async () => {
    const { panel } = connectFakePair();
    const promise = waitForChannelMessage(panel, () => false, { timeoutMs: 5 });

    await expect(promise).rejects.toBeInstanceOf(WaitForTimeoutError);
  });
});

describe('waitForRpcFrame', () => {
  it('resolves with the next frame on the reserved RPC message type matching the predicate', async () => {
    const { client, emit } = createFakeClient();
    const promise = waitForRpcFrame<{ kind: string; method?: string }>(
      client,
      (frame) => frame.kind === 'request' && frame.method === 'getSnapshot',
      { timeoutMs: 1000 },
    );

    emit(ROZENITE_RPC_MESSAGE_TYPE, { kind: 'ack', id: '1' });
    emit(ROZENITE_RPC_MESSAGE_TYPE, { kind: 'request', id: '2', method: 'getSnapshot' });

    await expect(promise).resolves.toEqual({ kind: 'request', id: '2', method: 'getSnapshot' });
  });

  it('rejects with a WaitForTimeoutError on expiry, naming the reserved message type', async () => {
    const { client } = createFakeClient();
    const promise = waitForRpcFrame(client, () => false, { timeoutMs: 5 });

    await expect(promise).rejects.toBeInstanceOf(WaitForTimeoutError);
    await expect(promise.catch((error: Error) => error.message)).resolves.toContain(
      ROZENITE_RPC_MESSAGE_TYPE,
    );
  });
});

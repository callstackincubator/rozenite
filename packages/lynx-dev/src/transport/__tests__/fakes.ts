/**
 * In-memory stand-ins for `ConnectorLike`/`ClientLike`, shared by the
 * transport tests. Nothing here touches `@lynx-js/debug-router-connector`.
 */
import { vi } from 'vitest';
import type {
  ClientLike,
  ClientQueryLike,
  ConnectorEventMap,
  ConnectorLike,
} from '../connector-types.js';

export class FakeConnector implements ConnectorLike {
  readonly listeners = new Map<keyof ConnectorEventMap, Set<(payload: never) => void>>();
  readonly connectDevices = vi.fn(async (): Promise<unknown> => []);
  readonly startWatchAllClients = vi.fn((): void => {});
  readonly close = vi.fn(async (): Promise<void> => {});

  on<Event extends keyof ConnectorEventMap>(
    event: Event,
    callback: (payload: ConnectorEventMap[Event]) => void,
  ): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback as (payload: never) => void);
  }

  off<Event extends keyof ConnectorEventMap>(
    event: Event,
    callback: (payload: ConnectorEventMap[Event]) => void,
  ): void {
    this.listeners.get(event)?.delete(callback as (payload: never) => void);
  }

  /** Test helper: fires `event` on every subscriber, exactly like the real connector would. */
  emit<Event extends keyof ConnectorEventMap>(
    event: Event,
    payload: ConnectorEventMap[Event],
  ): void {
    for (const listener of this.listeners.get(event) ?? []) {
      (listener as (payload: ConnectorEventMap[Event]) => void)(payload);
    }
  }

  listenerCount(event: keyof ConnectorEventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export class FakeClient implements ClientLike {
  readonly sentMessages: unknown[] = [];
  closed = false;

  constructor(
    private readonly id: number,
    readonly info: { port: number; id: number; query: ClientQueryLike },
  ) {}

  clientId(): number {
    return this.id;
  }

  close(): void {
    this.closed = true;
  }

  sendMessage(message: unknown): void {
    this.sentMessages.push(message);
  }
}

export const makeClientQuery = (overrides: Partial<ClientQueryLike> = {}): ClientQueryLike => ({
  app: 'com.example.app',
  os: 'Android',
  device: 'Pixel 7',
  device_model: 'Pixel 7',
  device_id: 'device-serial-1',
  sdk_version: '3.2.1',
  ...overrides,
});

export const makeFakeClient = (
  id: number,
  queryOverrides: Partial<ClientQueryLike> = {},
): FakeClient => new FakeClient(id, { port: 12345, id, query: makeClientQuery(queryOverrides) });

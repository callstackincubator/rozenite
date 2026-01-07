import { Subscription } from '../../types.js';
import { Channel } from '../../channel/types.js';

// Base client type for auto-ready mode
export type RozeniteDevToolsAutoClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  send: <TType extends keyof TEventMap>(
    type: TType,
    payload: TEventMap[TType]
  ) => void;
  onMessage: <TType extends keyof TEventMap>(
    type: TType,
    listener: (payload: TEventMap[TType]) => void
  ) => Subscription;
  onReady: (callback: () => void) => Subscription;
  isReady: () => boolean;
  close: () => void;
  initialize: () => Promise<void>;
};

// Manual-ready client type with makeReady() method
export type RozeniteDevToolsManualClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = RozeniteDevToolsAutoClient<TEventMap> & {
  makeReady: () => void;
};

// Union type for any Rozenite DevTools client (auto or manual)
export type RozeniteDevToolsClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = RozeniteDevToolsAutoClient<TEventMap> | RozeniteDevToolsManualClient<TEventMap>;

// Configuration for creating a client
export type RozeniteClientConfig = {
  pluginId: string;
  readyMode: 'auto' | 'manual';
  waitForReady?: boolean;
  // Optional transport layer for testing
  channel?: Channel;
  isLeader?: boolean;
};
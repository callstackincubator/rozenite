import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import type { RozeniteDevToolsClient } from './client';
import {
  RozeniteDevToolsClientContext,
  type RozeniteTestClientRegistry,
} from './client-context';

type Listener = (payload: unknown) => void;

export type RozeniteTestMessage<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> = {
  pluginId: string;
  type: keyof TEventMap;
  payload: TEventMap[keyof TEventMap];
};

type PluginState<TEventMap extends Record<string, unknown>> = {
  client: RozeniteDevToolsClient<TEventMap> | null;
  sent: RozeniteTestMessage<TEventMap>[];
};

export type RozeniteTestHarness<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> = RozeniteTestClientRegistry & {
  connect: (pluginId: string) => RozeniteDevToolsClient<TEventMap>;
  disconnect: (pluginId: string) => void;
  emit: <TType extends keyof TEventMap>(
    pluginId: string,
    type: TType,
    payload: TEventMap[TType],
  ) => void;
  getSent: (pluginId: string) => RozeniteTestMessage<TEventMap>[];
  clearSent: (pluginId: string) => void;
  isConnected: (pluginId: string) => boolean;
};

const createClient = <TEventMap extends Record<string, unknown>>(
  pluginId: string,
  appendSent: (message: RozeniteTestMessage<TEventMap>) => void,
) => {
  const listeners = new Map<keyof TEventMap, Set<Listener>>();
  let closed = false;

  const client: RozeniteDevToolsClient<TEventMap> = {
    send: (type, payload) => {
      if (closed) {
        return;
      }

      appendSent({ pluginId, type, payload });
    },
    onMessage: (type, listener) => {
      if (closed) {
        return { remove: () => undefined };
      }

      const typeListeners = listeners.get(type) ?? new Set<Listener>();
      typeListeners.add(listener as Listener);
      listeners.set(type, typeListeners);

      return {
        remove: () => {
          typeListeners.delete(listener as Listener);
        },
      };
    },
    close: () => {
      closed = true;
      listeners.clear();
    },
  };

  return {
    client,
    emit: <TType extends keyof TEventMap>(type: TType, payload: TEventMap[TType]) => {
      if (closed) {
        throw new Error(
          `[Rozenite test harness] Cannot emit "${String(type)}" for disconnected plugin "${pluginId}".`,
        );
      }

      listeners.get(type)?.forEach((listener) => {
        listener(payload);
      });
    },
  };
};

export const createRozeniteTestHarness = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
>(): RozeniteTestHarness<TEventMap> => {
  const pluginStates = new Map<string, PluginState<TEventMap>>();
  const emitters = new Map<string, ReturnType<typeof createClient<TEventMap>>>();
  const subscribers = new Set<() => void>();

  const notify = () => {
    subscribers.forEach((listener) => {
      listener();
    });
  };

  const ensureState = (pluginId: string): PluginState<TEventMap> => {
    const existing = pluginStates.get(pluginId);
    if (existing) {
      return existing;
    }

    const state: PluginState<TEventMap> = {
      client: null,
      sent: [],
    };
    pluginStates.set(pluginId, state);
    return state;
  };

  return {
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    getClient: (pluginId) => {
      return ensureState(pluginId).client;
    },
    connect: (pluginId) => {
      const state = ensureState(pluginId);
      if (state.client) {
        return state.client;
      }

      const entry = createClient<TEventMap>(pluginId, (message) => {
        ensureState(pluginId).sent.push(message);
      });
      state.client = entry.client;
      emitters.set(pluginId, entry);
      notify();
      return entry.client;
    },
    disconnect: (pluginId) => {
      const state = ensureState(pluginId);
      state.client?.close();
      state.client = null;
      emitters.delete(pluginId);
      notify();
    },
    emit: (pluginId, type, payload) => {
      const entry = emitters.get(pluginId);
      if (!entry) {
        throw new Error(
          `[Rozenite test harness] Plugin "${pluginId}" is not connected. Call connect() before emit().`,
        );
      }

      entry.emit(type, payload);
    },
    getSent: (pluginId) => {
      return [...ensureState(pluginId).sent];
    },
    clearSent: (pluginId) => {
      ensureState(pluginId).sent = [];
    },
    isConnected: (pluginId) => {
      return ensureState(pluginId).client != null;
    },
  };
};

export type RozeniteDevToolsTestProviderProps = PropsWithChildren<{
  harness: RozeniteTestHarness<any>;
}>;

export const RozeniteDevToolsTestProvider = ({
  harness,
  children,
}: RozeniteDevToolsTestProviderProps) => {
  const value = useMemo(() => harness, [harness]);

  return (
    <RozeniteDevToolsClientContext.Provider value={value}>
      {children}
    </RozeniteDevToolsClientContext.Provider>
  );
};

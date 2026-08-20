import type { DevToolsPluginMessage, TapDirection, TapEvent } from '@rozenite/agent-shared';

export type TapListener = (event: TapEvent) => void;

export type TapEmitter = {
  /** Tees a plugin message into every subscriber as a timestamped `TapEvent`. */
  emit: (direction: TapDirection, message: DevToolsPluginMessage) => void;
  /** Registers a listener; call the returned function to unsubscribe. */
  subscribe: (listener: TapListener) => () => void;
};

/**
 * A small pub/sub the Agent session tees `rozenite`-domain plugin messages
 * into, in both directions. Kept independent of `AgentSession` so it can be
 * created and exercised on its own — the session only calls `emit` at its
 * two existing chokepoints (the device message handler and the outbound
 * `sendMessage` callback) and hands `subscribe` to callers such as the agent
 * server's tap route.
 */
export const createTapEmitter = (): TapEmitter => {
  const listeners = new Set<TapListener>();

  return {
    emit: (direction, message) => {
      if (listeners.size === 0) {
        return;
      }

      const event: TapEvent = {
        direction,
        timestamp: Date.now(),
        pluginId: message.pluginId,
        type: message.type,
        payload: message.payload,
      };

      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** Narrows an outbound `sendMessage` payload to a taggable plugin message. */
export const isDevToolsPluginMessage = (value: unknown): value is DevToolsPluginMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { pluginId?: unknown }).pluginId === 'string' &&
    typeof (value as { type?: unknown }).type === 'string' &&
    'payload' in value
  );
};

export type TapFilter = {
  pluginId?: string;
  type?: string;
};

/** Pure predicate behind tap's plugin/type filtering, usable by both the
 * server (to avoid streaming events nobody asked for) and tests. */
export const matchesTapFilter = (event: TapEvent, filter: TapFilter): boolean => {
  if (filter.pluginId && event.pluginId !== filter.pluginId) {
    return false;
  }

  if (filter.type && event.type !== filter.type) {
    return false;
  }

  return true;
};

import { createHandshakeLayer, HandshakeLayer, UserMessage } from '../handshake/index.js';
import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';
import { RozeniteDevToolsAutoClient } from './types.js';

type MessageListener = (payload: unknown) => void;

type BaseClientState = {
  handshake: HandshakeLayer;
  listeners: Map<string, Set<MessageListener>>;
  handshakeSubscription: Subscription | null;
};

export type BaseClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = RozeniteDevToolsAutoClient<TEventMap> & {
  handshake: HandshakeLayer;
};

export const createBaseClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  channel: Channel,
  pluginId: string,
  isLeader: boolean
): BaseClient<TEventMap> => {
  const state: BaseClientState = {
    handshake: createHandshakeLayer(channel, pluginId, isLeader),
    listeners: new Map<string, Set<MessageListener>>(),
    handshakeSubscription: null,
  };

  const initialize = async (): Promise<void> => {
    await state.handshake.initialize();

    // Set up a single handshake listener that routes to type-specific listeners
    state.handshakeSubscription = state.handshake.onMessage((message: UserMessage) => {
      const typeListeners = state.listeners.get(message.type);
      if (typeListeners) {
        typeListeners.forEach((listener: MessageListener) => {
          listener(message.payload);
        });
      }
    });
  };

  const send = <TType extends keyof TEventMap>(
    type: TType,
    payload: TEventMap[TType]
  ): void => {
    state.handshake.send(type as string, payload);
  };

  const onMessage = <TType extends keyof TEventMap>(
    type: TType,
    listener: (payload: TEventMap[TType]) => void
  ): Subscription => {
    const typeListeners = state.listeners.get(type as string) ?? new Set();
    typeListeners.add(listener as MessageListener);
    state.listeners.set(type as string, typeListeners);

    return {
      remove: () => {
        typeListeners.delete(listener as MessageListener);
        if (typeListeners.size === 0) {
          state.listeners.delete(type as string);
        }
      },
    };
  };

  const onReady = (callback: () => void): Subscription => {
    return state.handshake.onReady(callback);
  };

  const isReady = (): boolean => {
    return state.handshake.isReady();
  };

  const close = (): void => {
    state.listeners.clear();
    state.handshakeSubscription?.remove();
    state.handshake.close();
  };

  return {
    handshake: state.handshake,
    initialize,
    send,
    onMessage,
    onReady,
    isReady,
    close,
  };
};

import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';
import { BaseClient, createBaseClient } from './base-client.js';
import { RozeniteDevToolsAutoClient } from './types.js';

type AutoReadyClientState<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  baseClient: BaseClient<TEventMap>;
  hasSignaledReady: boolean;
};

export type AutoReadyClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = RozeniteDevToolsAutoClient<TEventMap>;

export const createAutoReadyClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  channel: Channel,
  pluginId: string,
  isLeader: boolean
): AutoReadyClient<TEventMap> => {
  const state: AutoReadyClientState<TEventMap> = {
    baseClient: createBaseClient<TEventMap>(channel, pluginId, isLeader),
    hasSignaledReady: false,
  };

  const initialize = async (): Promise<void> => {
    await state.baseClient.initialize();
  };

  const send = <TType extends keyof TEventMap>(
    type: TType,
    payload: TEventMap[TType]
  ): void => {
    state.baseClient.send(type, payload);
  };

  const onMessage = <TType extends keyof TEventMap>(
    type: TType,
    listener: (payload: TEventMap[TType]) => void
  ): Subscription => {
    const subscription = state.baseClient.onMessage(type, listener);

    // Signal ready on next tick when first listener is added
    if (!state.hasSignaledReady) {
      state.hasSignaledReady = true;
      setTimeout(() => {
        state.baseClient.handshake.signalReady();
      }, 0);
    }

    return subscription;
  };

  const onReady = (callback: () => void): Subscription => {
    return state.baseClient.onReady(callback);
  };

  const isReady = (): boolean => {
    return state.baseClient.isReady();
  };

  const close = (): void => {
    state.baseClient.close();
  };

  return {
    initialize,
    send,
    onMessage,
    onReady,
    isReady,
    close,
  };
};

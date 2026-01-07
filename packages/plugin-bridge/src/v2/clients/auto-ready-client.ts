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

/**
 * Creates an auto-ready client that automatically signals readiness after initialization.
 * This ensures the handshake starts immediately without requiring user interaction.
 * 
 * The client will:
 * 1. Initialize the base client and handshake layer
 * 2. Automatically signal ready on the next tick
 * 3. Allow both parties to complete the handshake even if listeners aren't added yet
 */
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
    
    // In auto-ready mode, signal ready automatically after initialization
    if (!state.hasSignaledReady) {
      state.hasSignaledReady = true;
      setTimeout(() => {
        state.baseClient.handshake.signalReady();
      }, 0);
    }
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
    return state.baseClient.onMessage(type, listener);
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

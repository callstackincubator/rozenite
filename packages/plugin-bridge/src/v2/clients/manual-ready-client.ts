import { Channel } from '../../channel/types.js';
import { BaseClient, createBaseClient } from './base-client.js';
import { RozeniteDevToolsManualClient } from './types.js';

type ManualReadyClientState<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  baseClient: BaseClient<TEventMap>;
};

export type ManualReadyClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = RozeniteDevToolsManualClient<TEventMap>;

export const createManualReadyClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  channel: Channel,
  pluginId: string,
  isLeader: boolean
): ManualReadyClient<TEventMap> => {
  const state: ManualReadyClientState<TEventMap> = {
    baseClient: createBaseClient<TEventMap>(channel, pluginId, isLeader),
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
  ) => {
    return state.baseClient.onMessage(type, listener);
  };

  const onReady = (callback: () => void) => {
    return state.baseClient.onReady(callback);
  };

  const isReady = (): boolean => {
    return state.baseClient.isReady();
  };

  const makeReady = (): void => {
    state.baseClient.handshake.signalReady();
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
    makeReady,
    close,
  };
};

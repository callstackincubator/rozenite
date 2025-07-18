import { getChannel } from './channel/factory.js';
import { getDevToolsMessage } from './message';
import { Subscription } from './types';

const clients = new Map<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for TypeScript to be happy :)
  Promise<RozeniteDevToolsClient<any>> | RozeniteDevToolsClient<any>
>();

type MessageListener = (payload: unknown) => void;

export type RozeniteDevToolsClient<
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
  close: () => void;
};

const createRozeniteDevToolsClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  pluginId: string
): Promise<RozeniteDevToolsClient<TEventMap>> => {
  const channel = await getChannel();
  const listeners = new Map<string, Set<MessageListener>>();

  const handleMessage = async (cdpMessage: unknown) => {
    const message = getDevToolsMessage(cdpMessage);

    if (!message || message.pluginId !== pluginId) {
      return;
    }

    const typeListeners = listeners.get(message.type);

    if (typeListeners != null) {
      typeListeners.forEach((listener) => {
        listener(message.payload);
      });
    }
  };

  const send = <TType extends keyof TEventMap>(
    type: TType,
    payload: TEventMap[TType]
  ) => {
    channel.send({
      pluginId,
      type,
      payload,
    });
  };

  const subscription = channel.onMessage(handleMessage);

  const client: RozeniteDevToolsClient<TEventMap> = {
    send,
    onMessage: <TType extends keyof TEventMap>(
      type: TType,
      listener: (payload: TEventMap[TType]) => void
    ) => {
      const typeListeners = listeners.get(type as string) ?? new Set();
      typeListeners.add(listener as MessageListener);
      listeners.set(type as string, typeListeners);

      return {
        remove: () => {
          typeListeners.delete(listener as MessageListener);
        },
      };
    },
    close: () => {
      listeners.clear();
      subscription.remove();
      channel.close();
    },
  };
  return client;
};

export const getRozeniteDevToolsClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  pluginId: string
): Promise<RozeniteDevToolsClient<TEventMap>> => {
  const existingClient = clients.get(pluginId);

  if (existingClient != null) {
    return existingClient as
      | Promise<RozeniteDevToolsClient<TEventMap>>
      | RozeniteDevToolsClient<TEventMap>;
  }

  const clientPromise = createRozeniteDevToolsClient<TEventMap>(pluginId);
  clients.set(pluginId, clientPromise);
  const client = await clientPromise;
  clients.set(pluginId, client);

  return client;
};

import { getWebSocketBroadcastServer } from './broadcast-server';
import { getDevToolsMessage } from './message';

const clients = new Map<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for TypeScript to be happy :)
  Promise<DevToolsPluginClient<any>> | DevToolsPluginClient<any>
>();

type MessageListener = (payload: unknown) => void;

export type DevToolsPluginClient<
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

export type Subscription = {
  remove: () => void;
};

const createDevToolsPluginClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  pluginId: string
): Promise<DevToolsPluginClient<TEventMap>> => {
  const serverUrl = getWebSocketBroadcastServer();
  const ws = new WebSocket(serverUrl);

  const listeners = new Map<string, Set<MessageListener>>();

  const handleMessage = async (event: MessageEvent) => {
    const message = getDevToolsMessage(event.data);

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
    ws.send(
      JSON.stringify({
        pluginId,
        type,
        payload,
      })
    );
  };

  ws.addEventListener('message', handleMessage);

  const client: DevToolsPluginClient<TEventMap> = {
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
      ws.close();
    },
  };

  return new Promise((resolve, reject) => {
    ws.addEventListener(
      'open',
      () => {
        resolve(client);
      },
      { once: true }
    );

    ws.addEventListener('error', reject, { once: true });
  });
};

export const getDevToolsPluginClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  pluginId: string
): Promise<DevToolsPluginClient<TEventMap>> => {
  const existingClient = clients.get(pluginId);

  if (existingClient != null) {
    return existingClient as
      | Promise<DevToolsPluginClient<TEventMap>>
      | DevToolsPluginClient<TEventMap>;
  }

  const clientPromise = createDevToolsPluginClient<TEventMap>(pluginId);
  clients.set(pluginId, clientPromise);
  const client = await clientPromise;
  clients.set(pluginId, client);

  return client;
};

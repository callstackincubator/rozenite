import { useEffect, useState } from 'react';
import { DevToolsPluginClient, getDevToolsPluginClient } from './client';

export type UseDevToolsPluginClientOptions<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  pluginId: string;
  eventMap?: TEventMap;
};

// TODO: Handle multiple hooks (should not kill the socket)
export const useDevToolsPluginClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>({
  pluginId,
}: UseDevToolsPluginClientOptions<TEventMap>): DevToolsPluginClient<TEventMap> | null => {
  const [client, setClient] = useState<DevToolsPluginClient<TEventMap> | null>(
    null
  );
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let isMounted = true;
    let client: DevToolsPluginClient<TEventMap> | null = null;

    const setup = async () => {
      try {
        client = await getDevToolsPluginClient<TEventMap>(pluginId);

        if (isMounted) {
          setClient(client);
        }
      } catch (error) {
        console.error('Error setting up client', error);
        if (isMounted) {
          setError(error);
        }
      }
    };
    const teardown = async () => {
      try {
        if (client != null) {
          client.close();
        }
      } catch {
        // We don't care about errors when tearing down
      }
    };

    setup();
    return () => {
      isMounted = false;
      teardown();
    };
  }, [pluginId]);

  if (error != null) {
    throw error;
  }

  return client;
};

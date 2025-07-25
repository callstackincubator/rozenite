import { useEffect, useState } from 'react';
import { RozeniteDevToolsClient, getRozeniteDevToolsClient } from './client';

export type UseRozeniteDevToolsClientOptions<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  pluginId: string;
  eventMap?: TEventMap;
};

// TODO: Handle multiple hooks (should not kill the socket)
export const useRozeniteDevToolsClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>({
  pluginId,
}: UseRozeniteDevToolsClientOptions<TEventMap>): RozeniteDevToolsClient<TEventMap> | null => {
  const [client, setClient] =
    useState<RozeniteDevToolsClient<TEventMap> | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let isMounted = true;
    let client: RozeniteDevToolsClient<TEventMap> | null = null;

    const setup = async () => {
      try {
        client = await getRozeniteDevToolsClient<TEventMap>(pluginId);

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

import { useContext, useEffect, useState } from 'react';
import { RozeniteDevToolsClient, getRozeniteDevToolsClient } from './client';
import { RozeniteDevToolsClientContext } from './client-context';
import { MissingRozeniteForWebError, UnsupportedPlatformError } from './errors';

export const useRozeniteDevToolsClientForProduction = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
>(
  pluginId: string,
): RozeniteDevToolsClient<TEventMap> | null => {
  const registry = useContext(RozeniteDevToolsClientContext);
  const [client, setClient] = useState<RozeniteDevToolsClient<TEventMap> | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (registry) {
      return;
    }

    let isMounted = true;
    let client: RozeniteDevToolsClient<TEventMap> | null = null;

    const setup = async () => {
      try {
        client = await getRozeniteDevToolsClient<TEventMap>(pluginId);

        if (isMounted) {
          setClient(client);
        }
      } catch (error) {
        if (error instanceof MissingRozeniteForWebError) {
          console.warn(
            `[Rozenite, ${pluginId}] Rozenite for web is not configured. A separate integration is required for web. Consult Rozenite docs for details.`,
          );
          return;
        }

        if (error instanceof UnsupportedPlatformError) {
          console.warn(`[Rozenite, ${pluginId}] Unsupported platform, skipping setup.`);
          return;
        }

        console.error(`[Rozenite, ${pluginId}] Error setting up client.`, error);

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
        // Ignore teardown errors
      }
    };

    setup();
    return () => {
      isMounted = false;
      teardown();
    };
  }, [pluginId, registry]);

  if (error != null) {
    throw error;
  }

  return client;
};

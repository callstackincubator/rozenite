import { useEffect, useState } from 'react';
import { createClient } from './clients/index.js';
import { RozeniteDevToolsClient, RozeniteClientConfig } from './clients/types.js';
import { UnsupportedPlatformError } from '../errors.js';

// Public API - user-facing options
export type UseRozeniteDevToolsClientOptions<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  pluginId: string;
  readyMode?: 'auto' | 'manual';  // default: 'auto'
  eventMap?: TEventMap;
};

// Internal API - includes transport layer options for testing
export type UseRozeniteDevToolsClientInternalOptions<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = UseRozeniteDevToolsClientOptions<TEventMap> & Pick<RozeniteClientConfig, 'channel' | 'isLeader'>;

// Internal hook - accepts transport layer options for testing
export const useRozeniteDevToolsClientInternal = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>({
  pluginId,
  readyMode = 'auto',
  channel,
  isLeader,
}: UseRozeniteDevToolsClientInternalOptions<TEventMap>): RozeniteDevToolsClient<TEventMap> | null => {
  const [client, setClient] =
    useState<RozeniteDevToolsClient<TEventMap> | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let isMounted = true;
    let client: RozeniteDevToolsClient<TEventMap> | null = null;

    const setup = async () => {
      try {
        client = await createClient<TEventMap>({
          pluginId,
          readyMode,
          channel,
          isLeader,
        });

        if (isMounted) {
          // Always wait for handshake to complete before exposing client
          const readyPromise = new Promise<void>((resolve) => {
            if (client && client.isReady()) {
              resolve();
            } else if (client) {
              const subscription = client.onReady(() => {
                subscription.remove();
                resolve();
              });
            }
          });

          await readyPromise;

          if (isMounted) {
            setClient(client);
          }
        }
      } catch (error) {
        if (error instanceof UnsupportedPlatformError) {
          // We don't want to show an error for unsupported platforms.
          // It's expected that the client will be null.
          console.warn(
            `[Rozenite, ${pluginId}] Unsupported platform, skipping setup.`
          );
          return;
        }

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
  }, [pluginId, readyMode, channel, isLeader]);

  if (error != null) {
    throw error;
  }

  return client;
};

// Public API hook - calls internal hook with defaults
export const useRozeniteDevToolsClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  options: UseRozeniteDevToolsClientOptions<TEventMap>
): RozeniteDevToolsClient<TEventMap> | null => {
  return useRozeniteDevToolsClientInternal(options);
};

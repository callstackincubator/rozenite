import { useEffect, useState } from 'react';
import { createClient } from './client/index.js';
import { RozeniteDevToolsClient, RozeniteClientConfig } from './client/types.js';
import { TypedBufferConfig } from './connection/types.js';
import { UnsupportedPlatformError } from '../errors.js';

/**
 * Options for the useRozeniteDevToolsClient hook.
 */
export type UseRozeniteDevToolsClientOptions = {
  /**
   * Unique identifier for the plugin.
   */
  pluginId: string;

  /**
   * Optional: configuration for message buffering.
   */
  buffer?: TypedBufferConfig;
};

/**
 * Internal API - includes transport layer options for testing.
 */
export type UseRozeniteDevToolsClientInternalOptions = UseRozeniteDevToolsClientOptions &
  Pick<RozeniteClientConfig, 'channel' | 'isLeader'>;

/**
 * Internal hook - accepts transport layer options for testing.
 * 
 * @internal
 */
export const useRozeniteDevToolsClientInternal = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>({
  pluginId,
  buffer,
  channel,
  isLeader,
}: UseRozeniteDevToolsClientInternalOptions): RozeniteDevToolsClient<TEventMap> | null => {
  const [client, setClient] = useState<RozeniteDevToolsClient<TEventMap> | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let isMounted = true;
    let clientInstance: RozeniteDevToolsClient<TEventMap> | null = null;

    const setup = async () => {
      try {
        clientInstance = await createClient<TEventMap>({
          pluginId,
          buffer,
          channel,
          isLeader,
        });

        if (isMounted) {
          // Wait for handshake to complete before exposing client
          const readyPromise = new Promise<void>((resolve) => {
            if (clientInstance && clientInstance.isReady()) {
              resolve();
            } else if (clientInstance) {
              const subscription = clientInstance.onReady(() => {
                subscription.remove();
                resolve();
              });
            }
          });

          await readyPromise;

          if (isMounted) {
            setClient(clientInstance);
          }
        }
      } catch (err) {
        if (err instanceof UnsupportedPlatformError) {
          // Expected on unsupported platforms - don't show error
          console.warn(
            `[Rozenite, ${pluginId}] Unsupported platform, skipping setup.`
          );
          return;
        }

        console.error('[Rozenite] Error setting up client:', err);

        if (isMounted) {
          setError(err);
        }
      }
    };

    const teardown = () => {
      try {
        if (clientInstance != null) {
          clientInstance.close();
        }
      } catch {
        // Ignore errors during teardown
      }
    };

    setup();

    return () => {
      isMounted = false;
      teardown();
    };
  }, [pluginId, buffer, channel, isLeader]);

  if (error != null) {
    throw error;
  }

  return client;
};

/**
 * React hook to create and manage a Rozenite DevTools client.
 * 
 * Returns null until the connection is ready.
 * 
 * Messages are automatically buffered per-type and replayed when handlers
 * are registered, ensuring no messages are lost regardless of registration timing.
 * 
 * @example
 * ```tsx
 * type MyEvents = {
 *   'user-action': { action: string };
 *   'state-update': { state: object };
 * };
 * 
 * const MyComponent = () => {
 *   const client = useRozeniteDevToolsClient<MyEvents>({
 *     pluginId: 'my-plugin',
 *   });
 * 
 *   useEffect(() => {
 *     if (!client) return;
 * 
 *     // Handler receives all buffered 'state-update' messages + future ones
 *     const sub = client.onMessage('state-update', (message) => {
 *       console.log('State:', message.data, 'sent at:', message.timestamp);
 *     });
 * 
 *     return () => sub.remove();
 *   }, [client]);
 * 
 *   const handleClick = () => {
 *     client?.send('user-action', { action: 'click' });
 *   };
 * 
 *   return (
 *     <button onClick={handleClick}>
 *       {client ? 'Connected' : 'Connecting...'}
 *     </button>
 *   );
 * };
 * ```
 */
export const useRozeniteDevToolsClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  options: UseRozeniteDevToolsClientOptions
): RozeniteDevToolsClient<TEventMap> | null => {
  return useRozeniteDevToolsClientInternal(options);
};

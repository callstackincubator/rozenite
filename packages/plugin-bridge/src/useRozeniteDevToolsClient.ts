import { useEffect, useState } from 'react';
import { Channel } from './channel/types';
import {
  RozeniteDevToolsClient,
  RozeniteDevToolsRequestClient,
  getRozeniteDevToolsClient,
} from './client';
import { MissingRozeniteForWebError, UnsupportedPlatformError } from './errors';

export type UseRozeniteDevToolsClientOptions<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> = {
  pluginId: string;
  eventMap?: TEventMap;
  /**
   * Use this `Channel` instead of resolving one from the environment. See
   * `RozeniteDevToolsClientOptions['channel']` in `./client.ts` — intended
   * for `@rozenite/testing`'s fake pairs, not for production use.
   *
   * Note this only substitutes the channel; it does not affect
   * `isPanelClient()` below, which still reads the real `__ROZENITE_PANEL__`
   * global. A test standing in for the panel side that wants to suppress
   * the device-only `plugin-mounted` lifecycle message should set that
   * global itself.
   */
  channel?: Channel;
};

type PluginLifecycleEventMap = {
  'plugin-mounted': {
    pluginId: string;
  };
};

const isPanelClient = (): boolean => {
  return '__ROZENITE_PANEL__' in globalThis;
};

// TODO: Handle multiple hooks (should not kill the socket)
export const useRozeniteDevToolsClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
>({
  pluginId,
  channel,
}: UseRozeniteDevToolsClientOptions<TEventMap>): RozeniteDevToolsRequestClient<TEventMap> | null => {
  const [client, setClient] = useState<RozeniteDevToolsRequestClient<TEventMap> | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let isMounted = true;
    let client: RozeniteDevToolsRequestClient<TEventMap> | null = null;

    const setup = async () => {
      try {
        // Only pass `options` when a channel was actually supplied, so
        // production call sites keep calling `getRozeniteDevToolsClient`
        // with the same single argument as before.
        client = channel
          ? await getRozeniteDevToolsClient<TEventMap>(pluginId, { channel })
          : await getRozeniteDevToolsClient<TEventMap>(pluginId);

        if (isMounted) {
          setClient(client);
        }
      } catch (error) {
        if (error instanceof MissingRozeniteForWebError) {
          // On web without Rozenite, the client is expected to be null.
          console.warn(
            `[Rozenite, ${pluginId}] Rozenite for web is not configured. A separate integration is required for web. Consult Rozenite docs for details.`,
          );
          return;
        }

        if (error instanceof UnsupportedPlatformError) {
          // We don't want to show an error for unsupported platforms.
          // It's expected that the client will be null.
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
        // We don't care about errors when tearing down
      }
    };

    setup();
    return () => {
      isMounted = false;
      teardown();
    };
  }, [pluginId, channel]);

  if (error != null) {
    throw error;
  }

  useEffect(() => {
    if (!client || isPanelClient()) {
      return;
    }

    const lifecycleClient = client as unknown as RozeniteDevToolsClient<PluginLifecycleEventMap>;
    const timer = setTimeout(() => {
      lifecycleClient.send('plugin-mounted', {
        pluginId,
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [client, pluginId]);

  return client;
};

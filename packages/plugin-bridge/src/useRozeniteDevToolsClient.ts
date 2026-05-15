import { useContext, useEffect } from 'react';
import type { RozeniteDevToolsClient } from './client';
import { RozeniteDevToolsClientContext } from './client-context';
import { useRozeniteDevToolsClientForProduction } from './useRozeniteDevToolsClientForProduction';
import { useRozeniteDevToolsClientForTesting } from './useRozeniteDevToolsClientForTesting';

export type UseRozeniteDevToolsClientOptions<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> = {
  pluginId: string;
  eventMap?: TEventMap;
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
}: UseRozeniteDevToolsClientOptions<TEventMap>): RozeniteDevToolsClient<TEventMap> | null => {
  const registry = useContext(RozeniteDevToolsClientContext);
  const testClient = useRozeniteDevToolsClientForTesting<TEventMap>(pluginId);
  const productionClient = useRozeniteDevToolsClientForProduction<TEventMap>(pluginId);

  const resolvedClient = registry ? testClient : productionClient;

  useEffect(() => {
    if (!resolvedClient || isPanelClient()) {
      return;
    }

    const lifecycleClient =
      resolvedClient as unknown as RozeniteDevToolsClient<PluginLifecycleEventMap>;
    const timer = setTimeout(() => {
      lifecycleClient.send('plugin-mounted', {
        pluginId,
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [pluginId, resolvedClient]);

  return resolvedClient;
};

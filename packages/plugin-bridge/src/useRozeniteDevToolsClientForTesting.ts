import { useContext, useEffect, useState } from 'react';
import type { RozeniteDevToolsClient } from './client';
import { RozeniteDevToolsClientContext } from './client-context';

export const useRozeniteDevToolsClientForTesting = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
>(
  pluginId: string,
): RozeniteDevToolsClient<TEventMap> | null => {
  const registry = useContext(RozeniteDevToolsClientContext);
  const [client, setClient] = useState<RozeniteDevToolsClient<TEventMap> | null>(
    () =>
      (registry?.getClient(pluginId) as RozeniteDevToolsClient<TEventMap> | null) ?? null,
  );

  useEffect(() => {
    if (!registry) {
      setClient(null);
      return;
    }

    setClient(registry.getClient(pluginId) as RozeniteDevToolsClient<TEventMap> | null);

    return registry.subscribe(() => {
      setClient(registry.getClient(pluginId) as RozeniteDevToolsClient<TEventMap> | null);
    });
  }, [pluginId, registry]);

  return client;
};

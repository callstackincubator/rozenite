import { createRozeniteRpc, useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo } from 'react';
import {
  FEATURE_FLAGS_PLUGIN_ID,
  type FeatureFlagsEventMap,
  type FeatureFlagsMethods,
} from '../shared/messaging';
import type { FeatureFlagsProvider } from '../shared/types';
import { createFeatureFlagsHandlers } from './handlers';
import { assertNoDuplicateProviderIds } from './provider-registry';
import { useFeatureFlagsAgentTools } from './useFeatureFlagsAgentTools';

export type RozeniteFeatureFlagsPluginOptions = {
  providers: FeatureFlagsProvider[];
};

export const useRozeniteFeatureFlagsPlugin = ({ providers }: RozeniteFeatureFlagsPluginOptions) => {
  // Follows the storage plugin's pattern: derive from `providers` inside a
  // `useMemo` keyed on `providers` so an unstable caller-provided array
  // still only re-validates when its contents actually change on their end,
  // rather than gating on identity we don't control.
  useMemo(() => {
    assertNoDuplicateProviderIds(providers);
  }, [providers]);

  useFeatureFlagsAgentTools(providers);

  const client = useRozeniteDevToolsClient<FeatureFlagsEventMap>({
    pluginId: FEATURE_FLAGS_PLUGIN_ID,
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    let disposed = false;
    const rpc = createRozeniteRpc<FeatureFlagsMethods>(client);
    const handlers = createFeatureFlagsHandlers(providers);

    const handlerSubscriptions = [
      rpc.handle('getSnapshot', handlers.getSnapshot),
      rpc.handle('setOverride', handlers.setOverride),
      rpc.handle('clearOverride', handlers.clearOverride),
      rpc.handle('clearAllOverrides', handlers.clearAllOverrides),
      rpc.handle('refresh', handlers.refresh),
    ];

    const providerSubscriptions = providers
      .filter((provider) => provider.subscribe)
      .map((provider) => {
        try {
          return provider.subscribe?.(() => {
            if (disposed) {
              return;
            }

            client.send('flags-changed', {
              type: 'flags-changed',
              providerId: provider.id,
            });
          });
        } catch (error) {
          // Prevent one provider's failing subscribe() from breaking the
          // whole plugin, mirroring the storage plugin's watcher discipline.
          console.warn(
            `[Rozenite] Feature Flags Plugin: Failed to subscribe to provider "${provider.id}".`,
            error,
          );
          return undefined;
        }
      })
      .filter((subscription): subscription is NonNullable<typeof subscription> =>
        Boolean(subscription),
      );

    return () => {
      disposed = true;
      providerSubscriptions.forEach((subscription) => subscription.remove());
      handlerSubscriptions.forEach((subscription) => subscription.remove());
      rpc.close();
    };
  }, [client, providers]);

  return client;
};

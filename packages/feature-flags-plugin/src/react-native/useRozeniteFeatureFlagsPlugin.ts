import { createRozeniteRpc, useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useRef } from 'react';
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

  // Read by the RPC handlers on every call (see the effect below), so a
  // fresh `providers` array literal on every render -- which is how the
  // documented and playground call sites pass it -- never tears down and
  // rebuilds the RPC layer, which would abort in-flight panel calls.
  const providersRef = useRef(providers);
  providersRef.current = providers;

  // Stabilized by content: keeps the same array reference across renders
  // unless a provider was actually added, removed, or reordered, so the
  // subscription effect further below only tears down and re-subscribes
  // when the set of providers genuinely changes, not on every render.
  const previousProvidersRef = useRef<FeatureFlagsProvider[]>(providers);
  const previousProviders = previousProvidersRef.current;
  const providersChanged =
    previousProviders.length !== providers.length ||
    previousProviders.some((provider, index) => provider !== providers[index]);
  if (providersChanged) {
    previousProvidersRef.current = providers;
  }
  const stableProviders = providersChanged ? providers : previousProviders;

  // RPC layer: created once per `client` and left alone across re-renders.
  // Handlers always read `providersRef.current`, so they see the latest
  // providers without needing this effect to rerun.
  useEffect(() => {
    if (!client) {
      return;
    }

    const rpc = createRozeniteRpc<FeatureFlagsMethods>(client);
    const handlers = createFeatureFlagsHandlers(() => providersRef.current);

    const handlerSubscriptions = [
      rpc.handle('getSnapshot', handlers.getSnapshot),
      rpc.handle('setOverride', handlers.setOverride),
      rpc.handle('clearOverride', handlers.clearOverride),
      rpc.handle('clearAllOverrides', handlers.clearAllOverrides),
      rpc.handle('refresh', handlers.refresh),
    ];

    return () => {
      handlerSubscriptions.forEach((subscription) => subscription.remove());
      rpc.close();
    };
  }, [client]);

  // Provider subscriptions: re-established only when `stableProviders`
  // changes, i.e. when the set of providers genuinely changes.
  useEffect(() => {
    if (!client) {
      return;
    }

    let disposed = false;

    const providerSubscriptions = stableProviders
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
    };
  }, [client, stableProviders]);

  return client;
};

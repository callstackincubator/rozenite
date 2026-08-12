import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRozeniteRpc, useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo } from 'react';
import {
  FEATURE_FLAGS_PLUGIN_ID,
  type FeatureFlagsEventMap,
  type FeatureFlagsMethods,
  type FeatureFlagsSnapshot,
} from '../shared/messaging';
import type { FeatureFlagValue } from '../shared/types';
import { updateFlagInSnapshot } from './snapshot-helpers';

export const FEATURE_FLAGS_SNAPSHOT_QUERY_KEY = ['feature-flags-snapshot'] as const;

/**
 * Owns the RPC client, the `getSnapshot` query, and the `flags-changed`
 * subscription. Mutations patch the cached snapshot from the response they
 * get back (design §6) instead of refetching -- except `clearAllOverrides`,
 * whose contract only returns a count, so that one refetches.
 */
export const useFeatureFlags = () => {
  const client = useRozeniteDevToolsClient<FeatureFlagsEventMap>({
    pluginId: FEATURE_FLAGS_PLUGIN_ID,
  });
  const queryClient = useQueryClient();

  const rpc = useMemo(
    () => (client ? createRozeniteRpc<FeatureFlagsMethods>(client) : null),
    [client],
  );

  useEffect(() => () => rpc?.close(), [rpc]);

  const snapshotQuery = useQuery({
    queryKey: FEATURE_FLAGS_SNAPSHOT_QUERY_KEY,
    queryFn: () => {
      if (!rpc) {
        throw new Error('The Feature Flags plugin is not connected.');
      }
      return rpc.method('getSnapshot').invoke();
    },
    enabled: rpc != null,
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('flags-changed', () => {
      void queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_SNAPSHOT_QUERY_KEY });
    });

    return () => subscription.remove();
  }, [client, queryClient]);

  const applyFlag = (
    providerId: string,
    flag: FeatureFlagsSnapshot['providers'][number]['flags'][number],
  ) => {
    queryClient.setQueryData<FeatureFlagsSnapshot>(FEATURE_FLAGS_SNAPSHOT_QUERY_KEY, (current) =>
      current ? updateFlagInSnapshot(current, providerId, flag) : current,
    );
  };

  const requireRpc = () => {
    if (!rpc) {
      throw new Error('The Feature Flags plugin is not connected.');
    }
    return rpc;
  };

  const setOverride = async (providerId: string, key: string, value: FeatureFlagValue) => {
    const { flag } = await requireRpc().method('setOverride').invoke({ providerId, key, value });
    applyFlag(providerId, flag);
  };

  const clearOverride = async (providerId: string, key: string) => {
    const { flag } = await requireRpc().method('clearOverride').invoke({ providerId, key });
    applyFlag(providerId, flag);
  };

  const clearAllOverrides = async (providerId: string) => {
    await requireRpc().method('clearAllOverrides').invoke({ providerId });
    await queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_SNAPSHOT_QUERY_KEY });
  };

  const refresh = async (providerId?: string) => {
    await requireRpc().method('refresh').invoke({ providerId });
    await queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_SNAPSHOT_QUERY_KEY });
  };

  return {
    connected: rpc != null,
    snapshot: snapshotQuery.data,
    isLoading: snapshotQuery.isLoading,
    isError: snapshotQuery.isError,
    setOverride,
    clearOverride,
    clearAllOverrides,
    refresh,
  };
};

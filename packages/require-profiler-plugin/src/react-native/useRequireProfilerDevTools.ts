import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { RequireProfilerEventMap } from '../shared';
import {
  getRequireChainsList,
  getRequireChainData,
  getBundleModules,
  onRequireChainComplete,
} from './timings';
import { DevSettings } from 'react-native';

export const useRequireProfilerDevTools = () => {
  const client = useRozeniteDevToolsClient<RequireProfilerEventMap>({
    pluginId: '@rozenite/require-profiler-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    // Listen for reload and profile requests
    const reloadSubscription = client.onMessage('reload-and-profile', () => {
      // Reload the React Native app to start fresh profiling
      DevSettings.reload();
    });

    // Listen for chains list requests
    const chainsListSubscription = client.onMessage('request-chains-list', () => {
      try {
        const chains = getRequireChainsList();
        client.send('chains-list-response', { chains });
      } catch (error) {
        console.error('[Rozenite] Require Profiler: Error getting require chains list', error);
        client.send('chains-list-response', { chains: [] });
      }
    });

    // Listen for chain data requests
    const chainDataSubscription = client.onMessage('request-chain-data', (event) => {
      try {
        const data = getRequireChainData(event.chainIndex);
        client.send('chain-data-response', { data });
      } catch (error) {
        console.error('[Rozenite] Require Profiler: Error getting require chain data', error);
        client.send('chain-data-response', { data: null });
      }
    });

    // Listen for bundle coverage requests
    const bundleCoverageSubscription = client.onMessage('request-bundle-coverage', () => {
      try {
        const coverage = getBundleModules();
        client.send('bundle-coverage-response', { coverage });
      } catch (error) {
        console.error('[Rozenite] Require Profiler: Error getting bundle coverage', error);
        client.send('bundle-coverage-response', {
          coverage: { modules: [], capturedAt: Date.now() },
        });
      }
    });

    // Subscribe to new chain completion events
    const unsubscribeChainComplete = onRequireChainComplete((chain) => {
      client.send('new-chain', { chain });
    });

    return () => {
      reloadSubscription.remove();
      chainsListSubscription.remove();
      chainDataSubscription.remove();
      bundleCoverageSubscription.remove();
      unsubscribeChainComplete();
    };
  }, [client]);

  return client;
};

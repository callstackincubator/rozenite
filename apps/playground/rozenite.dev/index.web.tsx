import { configureStore } from '@reduxjs/toolkit';
import { QueryClient } from '@tanstack/react-query';
import { useRozeniteControlsPlugin } from '@rozenite/controls-plugin';
import { useRozeniteFeatureFlagsPlugin } from '@rozenite/feature-flags-plugin';
import { RozeniteOverlay } from '@rozenite/overlay-plugin';
import { usePerformanceMonitorDevTools } from '@rozenite/performance-monitor-plugin';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
import {
  rozeniteDevToolsEnhancer,
  useReduxDevToolsAgentTools,
} from '@rozenite/redux-devtools-plugin';
import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';
import { useEffect, useRef } from 'react';
import { featureFlagsPluginAdapters } from '../src/app/feature-flags-plugin-adapters';
import { usePlaygroundControlsSections } from './controls-sections';
import { storagePluginAdapters } from './storage-adapters';

// Demo-only: gives the web plugin cards something to show without an app
// bundle behind them. Moved out of src/app/WebPluginSections.tsx, which is
// now purely presentational.
const tanstackQueryClient = new QueryClient();

const reduxStore = configureStore({
  reducer: (state = { count: 0 }, action: { type: string }) => {
    if (action.type === 'web/increment') {
      return { count: state.count + 1 };
    }

    return state;
  },
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(
      rozeniteDevToolsEnhancer({
        name: 'playground-web-counter',
        maxAge: 100,
      }),
    ),
});

/**
 * The web dev entry. `withRozeniteWeb`'s webpack redirect (see
 * webpack.config.js) sends `@rozenite/react-native`'s `<Rozenite />` here in
 * development for the plain-webpack (`web:webpack`) target; Metro's own
 * platform resolution does the same for `expo start --web`.
 *
 * SQLite is intentionally not wired here: expo-sqlite has upstream issues on
 * web, same as before this migration (see the SQLite card's copy in
 * WebPluginSections.tsx).
 */
export default function RozeniteDevTools() {
  // Decorative only, same as before this migration: this web entry has no
  // real NavigationContainer to attach to, so the ref never resolves.
  const navigationRef = useRef<any>(null);
  const controlsSections = usePlaygroundControlsSections();

  useRozeniteStoragePlugin({
    storages: storagePluginAdapters,
  });
  useRozeniteFeatureFlagsPlugin({
    providers: featureFlagsPluginAdapters,
  });
  useReactNavigationDevTools({
    ref: navigationRef,
  });
  useRozeniteControlsPlugin({
    sections: controlsSections,
  });
  usePerformanceMonitorDevTools();
  useReduxDevToolsAgentTools();
  useTanStackQueryDevTools(tanstackQueryClient);

  useEffect(() => {
    reduxStore.dispatch({ type: 'web/increment' });
  }, []);

  useEffect(() => {
    tanstackQueryClient.setQueryData(['web-plugin-section', 'demo'], {
      initializedAt: new Date().toISOString(),
      status: 'ready',
    });
  }, []);

  return <RozeniteOverlay />;
}

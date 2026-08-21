import * as RNFS from '@dr.pogodin/react-native-fs';
import { useRozeniteControlsPlugin } from '@rozenite/controls-plugin';
import { useFileSystemDevTools } from '@rozenite/file-system-plugin';
import { useRozeniteFeatureFlagsPlugin } from '@rozenite/feature-flags-plugin';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import { RozeniteOverlay } from '@rozenite/overlay-plugin';
import { usePerformanceMonitorDevTools } from '@rozenite/performance-monitor-plugin';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
import { useReduxDevToolsAgentTools } from '@rozenite/redux-devtools-plugin';
import { useRequireProfilerDevTools } from '@rozenite/require-profiler-plugin';
import { useRozeniteSqlitePlugin } from '@rozenite/sqlite-plugin';
import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';
import { featureFlagsPluginAdapters } from '../src/app/feature-flags-plugin-adapters';
import { useNetworkTestStore } from '../src/app/stores/networkTestStore';
import { navigationRef } from '../src/app/navigation/navigationRef';
import { queryClient } from '../src/app/query-client';
import { useAgentPlaygroundTools } from './agent-tools';
import { usePlaygroundControlsSections } from './controls-sections';
import { NetworkPlaygroundControls } from './network-controls';
import { sqlitePluginAdapters } from './sqlite-adapters';
import { storagePluginAdapters } from './storage-adapters';

/**
 * The native/shared dev entry. `withRozenite()` redirects
 * `@rozenite/react-native`'s `<Rozenite />` here in development; none of
 * this is reachable in a production bundle.
 */
export default function RozeniteDevTools() {
  const controlsSections = usePlaygroundControlsSections();
  const isNetworkScreenMounted = useNetworkTestStore((state) => state.isScreenMounted);

  useTanStackQueryDevTools(queryClient);
  useRozeniteControlsPlugin({
    sections: controlsSections,
  });
  useNetworkActivityDevTools({
    clientUISettings: {
      showUrlAsName: true,
    },
  });
  useRozeniteStoragePlugin({
    storages: storagePluginAdapters,
  });
  useRozeniteFeatureFlagsPlugin({
    providers: featureFlagsPluginAdapters,
  });
  useRozeniteSqlitePlugin({
    adapters: sqlitePluginAdapters,
  });
  useReduxDevToolsAgentTools();
  usePerformanceMonitorDevTools();
  useRequireProfilerDevTools();
  useAgentPlaygroundTools();
  useFileSystemDevTools({
    rnfs: RNFS,
    fileTransfer: {
      import: true,
      export: true,
      agent: {
        import: true,
        export: true,
      },
    },
  });
  // The pre-migration code cast this the same way (`ref: navigationRef as
  // any`) even with a `NavigationContainerRef<any>`-typed ref: `useReactNavigationDevTools`'s
  // `ref: React.RefObject<TNavigationContainerRef | null>` doesn't infer
  // `TNavigationContainerRef` from a route-specific ref, so it always falls
  // back to comparing against the default `NavigationContainerRef<any>` and
  // fails the stricter `preload`/`navigate` overloads. Not specific to this
  // migration's `navigationRef`.
  useReactNavigationDevTools({
    ref: navigationRef as any,
  });

  return (
    <>
      {/*
        The Network screen's own Controls section, registered as a second,
        independent `useRozeniteControlsPlugin` caller and mounted only while
        that screen is — exactly as it behaved when the screen called the
        hook itself. `controlsRegistry` merges every caller's sections, so
        this appears alongside the app-level ones rather than replacing them.
      */}
      {isNetworkScreenMounted && <NetworkPlaygroundControls />}
      <RozeniteOverlay />
    </>
  );
}

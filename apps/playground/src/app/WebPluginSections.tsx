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
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePlaygroundControlsSections } from './hooks/usePlaygroundControlsSections';
import { storagePluginAdapters } from './storage-plugin-adapters';
import { featureFlagsPluginAdapters } from './feature-flags-plugin-adapters';
import { useTheme } from './theme/useTheme';

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

type PluginCardProps = {
  title: string;
  packageName: string;
  description: string;
  notes?: string[];
  children?: ReactNode;
};

const PluginCard = ({ title, packageName, description, notes, children }: PluginCardProps) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>{title}</Text>
      <Text style={[styles.packageName, { color: theme.colors.primary }]}>{packageName}</Text>
      <Text style={[styles.cardText, { color: theme.colors.mutedForeground }]}>{description}</Text>
      {notes?.map((note) => (
        <Text key={note} style={[styles.note, { color: theme.colors.mutedForeground }]}>
          {note}
        </Text>
      ))}
      {children}
    </View>
  );
};

export const StoragePluginSection = () => {
  useRozeniteStoragePlugin({
    storages: storagePluginAdapters,
  });

  return (
    <PluginCard
      title="Storage"
      packageName="@rozenite/storage-plugin"
      description="Unified storage inspection for adapters you register. On web, Async Storage and Expo Secure Store paths are active; the MMKV adapter stays inert because MMKV does not run in the browser."
      notes={[
        'Use Async Storage or Expo Secure Store adapters in web playground code; MMKV remains native-only.',
      ]}
    />
  );
};

export const FeatureFlagsPluginSection = () => {
  useRozeniteFeatureFlagsPlugin({
    providers: featureFlagsPluginAdapters,
  });

  return (
    <PluginCard
      title="Feature Flags"
      packageName="@rozenite/feature-flags-plugin"
      description="Inspect and override feature flags from DevTools. The custom/local adapter used here owns its own override store, so overrides work with zero call-site changes — unlike the LaunchDarkly adapter, which needs the wrapped client passed to its provider."
      notes={[
        'Only the custom/local adapter is wired here; LaunchDarkly and Statsig need their SDKs installed and are not part of this demo.',
      ]}
    />
  );
};

export const ReactNavigationPluginSection = () => {
  const navigationRef = useRef<any>(null);

  useReactNavigationDevTools({
    ref: navigationRef,
  });

  return (
    <PluginCard
      title="React Navigation"
      packageName="@rozenite/react-navigation-plugin"
      description="Inspect navigation state, actions, and deep links from DevTools when your web app uses React Navigation."
      notes={[
        'The hook is configured with a navigation ref in this web entry so the plugin can attach when a navigation container is present.',
      ]}
    />
  );
};

export const ControlsPluginSection = () => {
  const sections = usePlaygroundControlsSections();

  useRozeniteControlsPlugin({
    sections,
  });

  return (
    <PluginCard
      title="Controls"
      packageName="@rozenite/controls-plugin"
      description="Surface toggles, inputs, and actions from your app into DevTools for quick manual testing while the web bundle is running."
    />
  );
};

export const OverlayPluginSection = () => {
  return (
    <PluginCard
      title="Overlay"
      packageName="@rozenite/overlay-plugin"
      description="Alignment grids and image comparison overlays driven from DevTools; works with React Native Web views in development."
      notes={['Mounting RozeniteOverlay enables the plugin runtime bridge.']}
    >
      <RozeniteOverlay />
    </PluginCard>
  );
};

export const PerformanceMonitorPluginSection = () => {
  usePerformanceMonitorDevTools();

  return (
    <PluginCard
      title="Performance monitor"
      packageName="@rozenite/performance-monitor-plugin"
      description="Streams marks, measures, and metrics to DevTools via the same bridge used on native when react-native-performance is available in your web build."
    />
  );
};

export const ReduxDevToolsPluginSection = () => {
  useReduxDevToolsAgentTools();

  useEffect(() => {
    reduxStore.dispatch({ type: 'web/increment' });
  }, []);

  return (
    <PluginCard
      title="Redux DevTools"
      packageName="@rozenite/redux-devtools-plugin"
      description="Connect Redux stores to Rozenite with the Redux enhancer so time-travel and state inspection work in the browser target."
      notes={['A dedicated demo store is created with rozeniteDevToolsEnhancer.']}
    />
  );
};

/**
 * SQLite plugin is intentionally not wired on web: expo-sqlite has upstream
 * issues in browser builds. Use the native playground for SQLite + Rozenite.
 */
export const SqlitePluginSection = () => {
  return (
    <PluginCard
      title="SQLite"
      packageName="@rozenite/sqlite-plugin"
      description="The SQLite plugin is disabled in this web entry because of upstream bugs in expo-sqlite on web. Use the iOS or Android playground to exercise the SQLite plugin with Rozenite."
      notes={['`useRozeniteSqlitePlugin` and expo-sqlite are not loaded on web.']}
    />
  );
};

export const TanStackQueryPluginSection = () => {
  useTanStackQueryDevTools(tanstackQueryClient);

  useEffect(() => {
    tanstackQueryClient.setQueryData(['web-plugin-section', 'demo'], {
      initializedAt: new Date().toISOString(),
      status: 'ready',
    });
  }, []);

  return (
    <PluginCard
      title="TanStack Query"
      packageName="@rozenite/tanstack-query-plugin"
      description="Inspect TanStack Query caches, queries, and mutations from DevTools with the same hook integration as on native."
    />
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 0,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  packageName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
});

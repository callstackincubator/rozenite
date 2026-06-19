import { configureStore } from '@reduxjs/toolkit';
import { QueryClient } from '@tanstack/react-query';
import { useRozeniteControlsPlugin } from '@rozenite/controls-plugin';
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

const PluginCard = ({
  title,
  packageName,
  description,
  notes,
  children,
}: PluginCardProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.packageName}>{packageName}</Text>
      <Text style={styles.cardText}>{description}</Text>
      {notes?.map((note) => (
        <Text key={note} style={styles.note}>
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
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 8,
    padding: 20,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  packageName: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  cardText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  note: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
});

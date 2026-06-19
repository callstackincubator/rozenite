import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import {
  ControlsPluginSection,
  OverlayPluginSection,
  PerformanceMonitorPluginSection,
  ReactNavigationPluginSection,
  ReduxDevToolsPluginSection,
  SqlitePluginSection,
  StoragePluginSection,
  TanStackQueryPluginSection,
} from './WebPluginSections';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Rozenite for Web</Text>
        <Text style={styles.description}>
          Requirements: install the Rozenite Chrome extension, add
          `@rozenite/web`, wrap your web bundler config with `withRozeniteWeb`,
          and load `require(&apos;@rozenite/web&apos;)` in your web entry point. Then run
          the app in development on a Chromium-based browser.
        </Text>

        <StoragePluginSection />
        <ReactNavigationPluginSection />
        <ControlsPluginSection />
        <OverlayPluginSection />
        <PerformanceMonitorPluginSection />
        <ReduxDevToolsPluginSection />
        <SqlitePluginSection />
        <TanStackQueryPluginSection />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 16,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    paddingBottom: 48,
  },
  eyebrow: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
});

import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { ThemeProvider } from './theme/ThemeContext';
import { useTheme } from './theme/useTheme';
import {
  ControlsPluginSection,
  FeatureFlagsPluginSection,
  OverlayPluginSection,
  PerformanceMonitorPluginSection,
  ReactNavigationPluginSection,
  ReduxDevToolsPluginSection,
  SqlitePluginSection,
  StoragePluginSection,
  TanStackQueryPluginSection,
} from './WebPluginSections';

const AppContent = () => {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>Rozenite for Web</Text>
        <Text style={[styles.description, { color: theme.colors.mutedForeground }]}>
          Requirements: install the Rozenite Chrome extension, add `@rozenite/web`, wrap your web
          bundler config with `withRozeniteWeb`, and load `require(&apos;@rozenite/web&apos;)` in
          your web entry point. Then run the app in development on a Chromium-based browser.
        </Text>

        <StoragePluginSection />
        <FeatureFlagsPluginSection />
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
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
});

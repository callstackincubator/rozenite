import { Text, View, StyleSheet, ScrollView, useColorScheme } from 'react-native';

// The Rozenite palette (docs/DESIGN.md, "DevTools panel UI"): near-black, neutral greys,
// hairline borders and a single crimson accent. Plugins built on `@rozenite/ui` get these
// as Tailwind tokens; a React Native panel mirrors the values by hand.
const palettes = {
  dark: {
    background: '#0a0a0a',
    surface: '#111111',
    border: '#1f1f1f',
    text: '#ffffff',
    muted: '#a3a3a3',
    faint: '#858585',
    accent: '#ff4f7b',
  },
  light: {
    background: '#ffffff',
    surface: '#f9f9f8',
    border: '#e6e6e6',
    text: '#0a0a0a',
    muted: '#5e5e5e',
    faint: '#6b6b6b',
    accent: '#c2143f',
  },
};

type Palette = (typeof palettes)['dark'];

export default function HelloWorldPanel() {
  const palette = palettes[useColorScheme() === 'light' ? 'light' : 'dark'];
  const styles = createStyles(palette);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>💎</Text>
          </View>
          <Text style={styles.title}>Welcome to Rozenite</Text>
          <Text style={styles.subtitle}>React Native DevTools Framework</Text>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.sectionTitle}>✨ Features</Text>
          <View style={styles.featureGrid}>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🔧</Text>
              <Text style={styles.featureTitle}>Plugin System</Text>
              <Text style={styles.featureDescription}>
                Extensible architecture for custom dev tools
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={styles.featureTitle}>Fast & Lightweight</Text>
              <Text style={styles.featureDescription}>
                Optimized for performance and developer experience
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🎨</Text>
              <Text style={styles.featureTitle}>Modern UI</Text>
              <Text style={styles.featureDescription}>
                Beautiful, responsive interface built with React Native
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🔌</Text>
              <Text style={styles.featureTitle}>Easy Integration</Text>
              <Text style={styles.featureDescription}>Simple setup and configuration process</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with ❤️ for the React Native community</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    header: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
      backgroundColor: palette.background,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    logoContainer: {
      width: 80,
      height: 80,
      backgroundColor: palette.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    logo: {
      fontSize: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: '500',
      color: palette.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: palette.muted,
      textAlign: 'center',
    },
    featuresContainer: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '500',
      color: palette.text,
      marginBottom: 16,
    },
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    featureCard: {
      width: '48%',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 16,
      marginBottom: 12,
    },
    featureIcon: {
      fontSize: 24,
      marginBottom: 8,
    },
    featureTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: palette.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 12,
      color: palette.muted,
      lineHeight: 16,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    footerText: {
      fontSize: 12,
      color: palette.faint,
      textAlign: 'center',
    },
  });

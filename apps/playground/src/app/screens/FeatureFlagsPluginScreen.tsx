import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, KeyValueList, PluginHeader, Row, Screen } from '../components/ui';
import { featureFlagsOverrides, featureFlagsPluginAdapter } from '../feature-flags-plugin-adapters';
import { useTheme } from '../theme/useTheme';

// `/register` (feature-flags-plugin-adapters.ts's import) deliberately
// doesn't export the general-purpose `FeatureFlag` result type — only the
// adapter/override constructors it needs to declare production-safe. Derive
// the same type from the adapter instance instead of reaching for the
// plugin's dev-only entry point just for a type.
type FeatureFlag = Awaited<ReturnType<typeof featureFlagsPluginAdapter.listFlags>>[number];

type ThemeConfig = {
  accentColor?: string;
  roundedCorners?: boolean;
};

const flagValue = <T,>(flags: FeatureFlag[], key: string, fallback: T): T => {
  const flag = flags.find((item) => item.key === key);
  return flag ? (flag.value as T) : fallback;
};

const formatValue = (flag: FeatureFlag): string =>
  flag.type === 'json' ? JSON.stringify(flag.value) : String(flag.value);

export const FeatureFlagsPluginScreen = () => {
  const { theme } = useTheme();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  const refresh = useCallback(async () => {
    const nextFlags = await featureFlagsPluginAdapter.listFlags();
    setFlags(nextFlags);
  }, []);

  useEffect(() => {
    void refresh();

    // Reacts to overrides set from the Feature Flags DevTools panel, not
    // just to user actions on this screen.
    const subscription = featureFlagsOverrides.subscribe(() => {
      void refresh();
    });

    return () => subscription.remove();
  }, [refresh]);

  const newCheckoutEnabled = flagValue(flags, 'new-checkout-flow', false);
  const welcomeMessage = flagValue(flags, 'welcome-message', '');
  const themeConfig = flagValue<ThemeConfig>(flags, 'theme-config', {});

  return (
    <Screen>
      <PluginHeader
        title="Feature Flags"
        subtitle="Custom/local adapter — overrides set in DevTools apply instantly, no app restart."
      />

      <View
        accessible
        accessibilityLabel="Checkout banner"
        accessibilityValue={{ text: newCheckoutEnabled ? 'New checkout flow' : 'Classic checkout' }}
        style={[
          styles.banner,
          {
            backgroundColor: newCheckoutEnabled ? theme.colors.primary : theme.colors.secondary,
            borderRadius: themeConfig.roundedCorners ? 12 : theme.radius,
            borderColor: themeConfig.accentColor ?? theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.bannerTitle, { color: theme.colors.primaryForeground }]}>
          {newCheckoutEnabled ? 'New checkout flow' : 'Classic checkout'}
        </Text>
        <Text style={[styles.bannerSubtitle, { color: theme.colors.primaryForeground }]}>
          {welcomeMessage}
        </Text>
      </View>

      <KeyValueList
        title="Effective flags"
        items={flags.map((flag) => ({
          key: flag.key,
          label: `${flag.key} (${flag.type}${flag.overridden ? ', overridden' : ''})`,
          value: formatValue(flag),
        }))}
      />

      <Row>
        <Button label="Refresh" variant="secondary" onPress={() => void refresh()} />
      </Row>
    </Screen>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 13,
  },
});

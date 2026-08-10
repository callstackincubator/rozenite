import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';

type PluginHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: ReactNode;
};

export const PluginHeader = ({ title, subtitle, showBack = true, actions }: PluginHeaderProps) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const canGoBack = showBack && navigation.canGoBack();

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {canGoBack ? (
          <Button
            label="Back"
            variant="ghost"
            size="compact"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
          />
        ) : null}
        <View style={styles.titles}>
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              { color: theme.colors.foreground, fontSize: theme.fontSize.base },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  titles: {
    gap: 2,
    flexShrink: 1,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export type BadgeVariant = 'default' | 'secondary' | 'outline';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

export const Badge = ({ label, variant = 'default' }: BadgeProps) => {
  const { theme } = useTheme();

  const backgroundColor =
    variant === 'default'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.secondary
        : 'transparent';
  const textColor =
    variant === 'default' ? theme.colors.primaryForeground : theme.colors.foreground;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          borderColor: variant === 'outline' ? theme.colors.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Text style={[styles.label, { color: textColor, fontSize: theme.fontSize.xs }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});

import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'default' | 'compact' | 'icon';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export const Button = ({
  label,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  accessibilityLabel,
  style,
}: ButtonProps) => {
  const { theme } = useTheme();

  const backgroundColor = (() => {
    switch (variant) {
      case 'default':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.secondary;
      case 'destructive':
        return theme.colors.destructive;
      case 'outline':
      case 'ghost':
        return 'transparent';
    }
  })();

  const textColor = (() => {
    switch (variant) {
      case 'default':
        return theme.colors.primaryForeground;
      case 'destructive':
        return theme.colors.destructiveForeground;
      case 'secondary':
      case 'outline':
      case 'ghost':
        return theme.colors.foreground;
    }
  })();

  const borderColor = variant === 'outline' ? theme.colors.border : 'transparent';
  const height =
    size === 'icon'
      ? theme.controlHeight.sm
      : size === 'compact'
        ? theme.controlHeight.md
        : theme.controlHeight.lg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          height,
          paddingHorizontal: size === 'icon' ? theme.spacing.md : theme.spacing['2xl'],
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: textColor,
            fontSize: size === 'compact' || size === 'icon' ? theme.fontSize.xs : theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium as '500',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  label: {
    textAlign: 'center',
  },
});

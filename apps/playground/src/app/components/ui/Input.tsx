import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type InputProps = TextInputProps & {
  accessibilityLabel: string;
};

export const Input = ({ style, accessibilityLabel, ...props }: InputProps) => {
  const { theme } = useTheme();

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={theme.colors.mutedForeground}
      style={[
        styles.input,
        {
          height: theme.controlHeight.lg,
          borderColor: theme.colors.input,
          color: theme.colors.foreground,
          fontSize: theme.fontSize.sm,
          paddingHorizontal: theme.spacing.xl,
        },
        style,
      ]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 0,
  },
});

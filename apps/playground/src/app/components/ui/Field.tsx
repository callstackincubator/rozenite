import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type FieldProps = {
  label: string;
  children: ReactNode;
  error?: string;
  helperText?: string;
};

export const Field = ({ label, children, error, helperText }: FieldProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text
        style={[styles.label, { color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }]}
      >
        {label}
      </Text>
      {children}
      {error ? (
        <Text style={[styles.helper, { color: theme.colors.destructive }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: theme.colors.mutedForeground }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helper: {
    fontSize: 12,
  },
});

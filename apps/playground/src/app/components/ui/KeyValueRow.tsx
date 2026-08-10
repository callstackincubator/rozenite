import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type KeyValueRowProps = {
  label: string;
  value: string;
};

// The standard observable-result element: a single accessible node whose
// label/value pair agents read directly from the accessibility tree.
export const KeyValueRow = ({ label, value }: KeyValueRowProps) => {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      style={[styles.row, { borderColor: theme.colors.border, paddingVertical: theme.spacing.md }]}
    >
      <Text
        style={[styles.label, { color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.value, { color: theme.colors.foreground, fontSize: theme.fontSize.xs }]}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontWeight: '500',
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontWeight: '600',
  },
});

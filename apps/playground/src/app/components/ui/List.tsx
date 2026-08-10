import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type ListProps = {
  title?: string;
  children: ReactNode;
};

export const List = ({ title, children }: ListProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {title ? (
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            { color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View style={[styles.group, { borderColor: theme.colors.border }]}>{children}</View>
    </View>
  );
};

type ListItemProps = {
  label: string;
  description?: string;
  onPress?: () => void;
  selected?: boolean;
  adornment?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
};

export const ListItem = ({
  label,
  description,
  onPress,
  selected,
  adornment,
  trailing,
  accessibilityLabel,
}: ListItemProps) => {
  const { theme } = useTheme();

  const content = (
    <View
      style={[
        styles.item,
        {
          borderColor: theme.colors.border,
          backgroundColor: selected ? theme.colors.accent : 'transparent',
          paddingHorizontal: theme.spacing['2xl'],
          paddingVertical: theme.spacing.xl,
          gap: theme.spacing.xl,
        },
      ]}
    >
      {adornment}
      <View style={styles.texts}>
        <Text
          style={[styles.label, { color: theme.colors.foreground, fontSize: theme.fontSize.sm }]}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={[
              styles.description,
              { color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  group: {
    borderWidth: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontWeight: '500',
  },
  description: {},
});

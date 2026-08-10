import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type EmptyStateProps = {
  title: string;
  description?: string;
};

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { paddingVertical: theme.spacing['3xl'] }]}>
      <Text style={[styles.title, { color: theme.colors.foreground, fontSize: theme.fontSize.sm }]}>
        {title}
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
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontWeight: '500',
  },
  description: {
    textAlign: 'center',
  },
});

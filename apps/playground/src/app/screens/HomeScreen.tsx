import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import { List, ListItem, Screen } from '../components/ui';
import { groupedRoutes, type RouteGroup } from '../navigation/routes';
import { NavigationProp } from '../navigation/types';
import { useTheme } from '../theme/useTheme';

const GROUP_ORDER: RouteGroup[] = [
  'State',
  'Storage',
  'Flags',
  'Network',
  'Performance',
  'Forms',
  'Navigation',
  'Settings',
];

export const HomeScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <Screen>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.foreground, fontSize: 24 }]}
      >
        Rozenite Playground
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: theme.colors.mutedForeground, fontSize: theme.fontSize.sm },
        ]}
      >
        A showcase and E2E testing ground for Rozenite DevTools plugins.
      </Text>

      {GROUP_ORDER.map((group) => {
        const groupRoutes = groupedRoutes[group];

        if (!groupRoutes || groupRoutes.length === 0) {
          return null;
        }

        return (
          <List key={group} title={group}>
            {groupRoutes.map((route) => (
              <ListItem
                key={route.name}
                label={route.title}
                accessibilityLabel={route.accessibilityLabel}
                onPress={() => navigation.navigate(route.name as never)}
              />
            ))}
          </List>
        );
      })}
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginBottom: 4,
  },
});

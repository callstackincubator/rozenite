import {
  useNavigation,
  type NavigationProp as GenericNavigationProp,
} from '@react-navigation/native';
import { Text } from 'react-native';
import { Button, Card, Screen } from '../components/ui';
import { useTheme } from '../theme/useTheme';

export type NavDemoAction = {
  label: string;
  accessibilityLabel?: string;
  onPress: (navigation: GenericNavigationProp<Record<string, object | undefined>>) => void;
};

export type NavDemoConfig = {
  title: string;
  subtitle: string;
  actions: NavDemoAction[];
  /**
   * Safe-area edges the screen should pad for itself. Screens rendered
   * inside BottomTabNavigator sit above a tab bar that already reserves the
   * bottom inset, so those callers pass `['top']` to avoid double padding.
   */
  edges?: ('top' | 'bottom')[];
};

// Every "screen" in the React Navigation demo (the three bottom tabs and the
// successive-screens stack) is a differently-configured instance of this one
// component, instead of four near-duplicate hand-rolled screens.
export const createNavDemoScreen = (config: NavDemoConfig) => {
  const NavDemoScreen = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<GenericNavigationProp<Record<string, object | undefined>>>();

    return (
      <Screen scroll={false} edges={config.edges ?? ['top', 'bottom']}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.colors.foreground, fontSize: 20, fontWeight: '700' }}
        >
          {config.title}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.sm }}>
          {config.subtitle}
        </Text>
        <Card>
          {config.actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              accessibilityLabel={action.accessibilityLabel}
              onPress={() => action.onPress(navigation)}
            />
          ))}
        </Card>
      </Screen>
    );
  };

  return NavDemoScreen;
};

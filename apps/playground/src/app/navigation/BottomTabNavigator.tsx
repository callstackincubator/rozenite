import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { createNavDemoScreen } from '../screens/NavDemoScreen';
import { useTheme } from '../theme/useTheme';
import { BottomTabParamList } from './types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

const HomeTabScreen = createNavDemoScreen({
  title: 'Home Tab',
  subtitle: 'Pass navigation parameters and push a stack of successive screens.',
  edges: ['top'],
  actions: [
    {
      label: 'Show Parameter Screen',
      onPress: (navigation) =>
        navigation.navigate('ParameterDisplay', {
          title: 'Welcome Home!',
          message: 'This message was sent from the Home tab as a navigation parameter.',
          source: 'Home Tab',
        }),
    },
    {
      label: 'Go to successive screens',
      onPress: (navigation) => navigation.navigate('SuccessiveScreensStack'),
    },
  ],
});

const ProfileTabScreen = createNavDemoScreen({
  title: 'Profile Tab',
  subtitle: 'View profile information passed as a navigation parameter.',
  edges: ['top'],
  actions: [
    {
      label: 'View Profile Details',
      onPress: (navigation) =>
        navigation.navigate('ParameterDisplay', {
          title: 'User Profile Data',
          message: 'Profile information passed as navigation parameters.',
          source: 'Profile Tab',
        }),
    },
  ],
});

const SettingsTabScreen = createNavDemoScreen({
  title: 'Settings Tab',
  subtitle: 'View app settings passed as a navigation parameter.',
  edges: ['top'],
  actions: [
    {
      label: 'Configure Settings',
      onPress: (navigation) =>
        navigation.navigate('ParameterDisplay', {
          title: 'App Settings',
          message: 'Settings configuration data passed through navigation parameters.',
          source: 'Settings Tab',
        }),
    },
  ],
});

export const BottomTabNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.medium as '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="Home" /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTabScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="Profile" /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTabScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="Settings" /> }}
      />
    </Tab.Navigator>
  );
};

const TabIcon = ({ color, label }: { color: string; label: string }) => (
  <Text accessibilityElementsHidden style={{ color, fontSize: 12, fontWeight: '600' }}>
    {label[0]}
  </Text>
);

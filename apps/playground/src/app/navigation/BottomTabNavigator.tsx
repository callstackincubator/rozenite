import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from './types';
import { HomeTabScreen } from '../screens/HomeTabScreen';
import { ProfileTabScreen } from '../screens/ProfileTabScreen';
import { SettingsTabScreen } from '../screens/SettingsTabScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#8232FF',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTabScreen}
        options={{
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTabScreen}
        options={{
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const HomeIcon = ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>🏠</Text>
);

const ProfileIcon = ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>👤</Text>
);

const SettingsIcon = ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>⚙️</Text>
);

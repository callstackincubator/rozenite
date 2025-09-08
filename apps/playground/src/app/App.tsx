import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LandingScreen } from './screens/LandingScreen';
import { MMKVPluginScreen } from './screens/MMKVPluginScreen';
import { NetworkTestScreen } from './screens/NetworkTestScreen';
import { ReduxTestScreen } from './screens/ReduxTestScreen';
import { PerformanceMonitorScreen } from './screens/PerformanceMonitorScreen';
import { ConfigScreen } from './screens/ConfigScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';
import { RootStackParamList } from './navigation/types';
import { Provider } from 'react-redux';
import { store } from './store';
import { usePerformanceMonitorDevTools } from '@rozenite/performance-monitor-plugin';
import { mmkvStorages } from './mmkv-storages';
import { useRef } from 'react';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { ParameterDisplayScreen } from './screens/ParameterDisplayScreen';

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();

const Wrapper = () => {
  useTanStackQueryDevTools(queryClient);
  useNetworkActivityDevTools();
  useMMKVDevTools({
    storages: mmkvStorages,
    blacklist: /user-storage:sensitiveToken/,
  });
  usePerformanceMonitorDevTools();

  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="MMKVPlugin" component={MMKVPluginScreen} />
      <Stack.Screen name="NetworkTest" component={NetworkTestScreen} />
      <Stack.Screen name="ReduxTest" component={ReduxTestScreen} />
      <Stack.Screen
        name="PerformanceMonitor"
        component={PerformanceMonitorScreen}
      />
      <Stack.Screen
        name="Config"
        component={ConfigScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen name="BottomTabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="ParameterDisplay"
        component={ParameterDisplayScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#8232FF',
          headerTitle: 'Parameter Display',
        }}
      />
    </Stack.Navigator>
  );
};

const linking = {
  prefixes: ['playground://'],
  config: {
    screens: {
      Landing: '',
      MMKVPlugin: 'mmkv',
      NetworkTest: 'network',
      ReduxTest: 'redux',
      PerformanceMonitor: 'performance',
      Config: 'config',
      BottomTabs: 'tabs',
    },
  },
};

export const App = () => {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useReactNavigationDevTools({
    ref: navigationRef,
  });

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider style={{ backgroundColor: '#0a0a0a' }}>
          <NavigationContainer ref={navigationRef} linking={linking}>
            <Wrapper />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;

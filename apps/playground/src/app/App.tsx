import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Rozenite from '@rozenite/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { navigationRef } from './navigation/navigationRef';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { SuccessiveScreensNavigator } from './navigation/SuccessiveScreensNavigator';
import { routes } from './navigation/routes';
import { RootStackParamList } from './navigation/types';
import { SettingsScreen } from './screens/SettingsScreen';
import { ControlsPluginScreen } from './screens/ControlsPluginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NetworkTestScreen } from './screens/NetworkTestScreen';
import { ParameterDisplayScreen } from './screens/ParameterDisplayScreen';
import { PerformanceMonitorScreen } from './screens/PerformanceMonitorScreen';
import { PerfProblemScreen } from './screens/PerfProblemScreen';
import { ReduxTestScreen } from './screens/ReduxTestScreen';
import { RequestBodyTestScreen } from './screens/RequestBodyTestScreen';
import { RequireProfilerTestScreen } from './screens/RequireProfilerTestScreen';
import { FileSystemTestScreen } from './screens/FileSystemTestScreen';
import { ReactHookFormPluginScreen } from './screens/ReactHookFormPluginScreen';
import { StoragePluginScreen } from './screens/StoragePluginScreen';
import { FeatureFlagsPluginScreen } from './screens/FeatureFlagsPluginScreen';
import { primaryStore } from './store';
import { queryClient } from './query-client';
import { ThemeProvider } from './theme/ThemeContext';
import { useTheme } from './theme/useTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const Wrapper = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={routes.home.name}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name={routes.home.name} component={HomeScreen} />
      <Stack.Screen name={routes.controlsPlugin.name} component={ControlsPluginScreen} />
      <Stack.Screen name={routes.reactHookFormPlugin.name} component={ReactHookFormPluginScreen} />
      <Stack.Screen name={routes.storagePlugin.name} component={StoragePluginScreen} />
      <Stack.Screen name={routes.featureFlagsPlugin.name} component={FeatureFlagsPluginScreen} />
      <Stack.Screen name={routes.networkTest.name} component={NetworkTestScreen} />
      <Stack.Screen name={routes.requestBodyTest.name} component={RequestBodyTestScreen} />
      <Stack.Screen name={routes.reduxTest.name} component={ReduxTestScreen} />
      <Stack.Screen name={routes.performanceMonitor.name} component={PerformanceMonitorScreen} />
      <Stack.Screen name={routes.requireProfilerTest.name} component={RequireProfilerTestScreen} />
      <Stack.Screen name={routes.fileSystemTest.name} component={FileSystemTestScreen} />
      <Stack.Screen
        name={routes.settings.name}
        component={SettingsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen name={routes.bottomTabs.name} component={BottomTabNavigator} />
      <Stack.Screen
        name={routes.parameterDisplay.name}
        component={ParameterDisplayScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.card },
          headerTintColor: theme.colors.primary,
          headerTitle: routes.parameterDisplay.title,
        }}
      />
      <Stack.Screen
        name={routes.successiveScreensStack.name}
        component={SuccessiveScreensNavigator}
      />
      <Stack.Screen name={routes.perfProblem.name} component={PerfProblemScreen} />
    </Stack.Navigator>
  );
};

const linking = {
  prefixes: ['playground://'],
  config: {
    screens: {
      [routes.home.name]: routes.home.path,
      [routes.controlsPlugin.name]: routes.controlsPlugin.path,
      [routes.reactHookFormPlugin.name]: routes.reactHookFormPlugin.path,
      [routes.storagePlugin.name]: routes.storagePlugin.path,
      [routes.featureFlagsPlugin.name]: routes.featureFlagsPlugin.path,
      [routes.networkTest.name]: routes.networkTest.path,
      [routes.requestBodyTest.name]: routes.requestBodyTest.path,
      [routes.reduxTest.name]: routes.reduxTest.path,
      [routes.performanceMonitor.name]: routes.performanceMonitor.path,
      [routes.requireProfilerTest.name]: routes.requireProfilerTest.path,
      [routes.fileSystemTest.name]: routes.fileSystemTest.path,
      [routes.settings.name]: routes.settings.path,
      [routes.perfProblem.name]: routes.perfProblem.path,
      [routes.bottomTabs.name]: {
        path: routes.bottomTabs.path,
        screens: {
          Home: '',
          Profile: 'profile',
          Settings: 'tab-settings',
        },
      },
      [routes.parameterDisplay.name]: routes.parameterDisplay.path,
      [routes.successiveScreensStack.name]: {
        path: routes.successiveScreensStack.path,
        screens: {
          SuccessiveScreens: '',
        },
      },
    },
  },
};

export const App = () => {
  return (
    <ThemeProvider>
      <Provider store={primaryStore}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <NavigationContainer ref={navigationRef} linking={linking}>
              <Wrapper />
            </NavigationContainer>
            <Rozenite />
          </SafeAreaProvider>
        </QueryClientProvider>
      </Provider>
    </ThemeProvider>
  );
};

export default App;

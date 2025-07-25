import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HelloWorldScreen } from './screens/HelloWorldScreen';
import { LandingScreen } from './screens/LandingScreen';
import { MMKVPluginScreen } from './screens/MMKVPluginScreen';
import { NetworkTestScreen } from './screens/NetworkTestScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';
import { RootStackParamList } from './navigation/types';

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();

const Wrapper = () => {
  useTanStackQueryDevTools();
  useNetworkActivityDevTools();
  useMMKVDevTools();

  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="HelloWorld" component={HelloWorldScreen} />
      <Stack.Screen name="MMKVPlugin" component={MMKVPluginScreen} />
      <Stack.Screen name="NetworkTest" component={NetworkTestScreen} />
    </Stack.Navigator>
  );
};

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Wrapper />
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

export default App;

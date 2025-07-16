import {
  createStaticNavigation,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LandingScreen } from './screens/LandingScreen';
import { HelloWorldScreen } from './screens/HelloWorldScreen';
import { RootStackParamList } from './navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>({
  initialRouteName: 'Landing',
  screenOptions: {
    headerShown: false,
    contentStyle: { backgroundColor: '#0a0a0a' },
  },
  screens: {
    Landing: LandingScreen,
    HelloWorld: HelloWorldScreen,
  },
});

const Navigation = createStaticNavigation(Stack);

export const App = () => {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  return (
    <SafeAreaProvider>
      <Navigation ref={navigationRef} />
    </SafeAreaProvider>
  );
};

export default App;

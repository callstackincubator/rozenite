import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { SuccessiveScreens } from '../screens/SuccessiveScreens';

export type SuccessiveScreensStackParamList = {
  SuccessiveScreens: undefined;
};

export type SuccessiveScreensNavigationProp =
  NativeStackNavigationProp<SuccessiveScreensStackParamList>;

const Stack = createNativeStackNavigator<SuccessiveScreensStackParamList>();

export const SuccessiveScreensNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="SuccessiveScreens" component={SuccessiveScreens} />
    </Stack.Navigator>
  );
};

import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { createNavDemoScreen } from '../screens/NavDemoScreen';
import { useTheme } from '../theme/useTheme';

export type SuccessiveScreensStackParamList = {
  SuccessiveScreens: undefined;
};

export type SuccessiveScreensNavigationProp =
  NativeStackNavigationProp<SuccessiveScreensStackParamList>;

const Stack = createNativeStackNavigator<SuccessiveScreensStackParamList>();

const SuccessiveScreens = createNavDemoScreen({
  title: 'Successive Screens',
  subtitle: 'Screens stacked one on top of the other. Push repeatedly to grow the stack.',
  actions: [
    {
      label: 'Push a new screen',
      onPress: (navigation) =>
        (navigation as unknown as SuccessiveScreensNavigationProp).push('SuccessiveScreens'),
    },
  ],
});

export const SuccessiveScreensNavigator = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="SuccessiveScreens" component={SuccessiveScreens} />
    </Stack.Navigator>
  );
};

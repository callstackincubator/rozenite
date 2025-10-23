import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Landing: undefined;
  MMKVPlugin: undefined;
  NetworkTest: undefined;
  RequestBodyTest: undefined;
  ReduxTest: undefined;
  PerformanceMonitor: undefined;
  Config: undefined;
  BottomTabs: undefined;
  ParameterDisplay: {
    title: string;
    message: string;
    color: string;
    source: string;
  };
  SuccessiveScreensStack: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

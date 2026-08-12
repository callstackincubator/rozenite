import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  ControlsPlugin: undefined;
  ReactHookFormPlugin: undefined;
  StoragePlugin: undefined;
  FeatureFlagsPlugin: undefined;
  NetworkTest: undefined;
  RequestBodyTest: undefined;
  ReduxTest: undefined;
  PerformanceMonitor: undefined;
  RequireProfilerTest: undefined;
  FileSystemTest: undefined;
  Settings: undefined;
  BottomTabs: undefined;
  ParameterDisplay: {
    title: string;
    message: string;
    source: string;
  };
  SuccessiveScreensStack: undefined;
  PerfProblem: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

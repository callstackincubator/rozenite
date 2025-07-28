import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Landing: undefined;
  MMKVPlugin: undefined;
  NetworkTest: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Landing: undefined;
  HelloWorld: undefined;
  MMKVPlugin: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

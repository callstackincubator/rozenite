import type { PressableStateCallbackType } from 'react-native';

// Extended pressable state for react-native-web (includes hover)
export type WebPressableState = PressableStateCallbackType & {
  hovered?: boolean;
};

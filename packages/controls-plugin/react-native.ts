export {
  createSection,
  type ControlsButtonItem,
  type ControlsInputItem,
  type ControlsItem,
  type ControlsSelectItem,
  type ControlsSelectOption,
  type ControlsSection,
  type ControlsTextItem,
  type ControlsToggleItem,
  type ControlsValidationResult,
  type RozeniteControlsPluginOptions,
} from './src/shared/types';

export let useRozeniteControlsPlugin: typeof import('./src/react-native/useRozeniteControlsPlugin').useRozeniteControlsPlugin;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useRozeniteControlsPlugin =
    require('./src/react-native/useRozeniteControlsPlugin').useRozeniteControlsPlugin;
} else {
  useRozeniteControlsPlugin = () => null;
}

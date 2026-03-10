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

export declare const useRozeniteControlsPlugin: (
  options: import('./src/shared/types').RozeniteControlsPluginOptions
) => import('@rozenite/plugin-bridge').RozeniteDevToolsClient<
  import('./src/shared/messaging').ControlsEventMap
> | null;

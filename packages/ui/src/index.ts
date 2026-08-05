export { cn } from './utils/cn';

export { Split } from './split/split';
export type {
  SplitDirection,
  SplitProps,
  SplitPaneProps,
  SplitHandleProps,
} from './split/split';

export { PluginShell } from './plugin-shell/plugin-shell';
export type {
  PluginShellProps,
  PluginShellBodyProps,
} from './plugin-shell/plugin-shell';

export { PluginHeader } from './plugin-header/plugin-header';
export type {
  PluginHeaderProps,
  PluginHeaderTitleProps,
  PluginHeaderSubtitleProps,
  PluginHeaderActionsProps,
  PluginHeaderThemeSwitcherProps,
} from './plugin-header/plugin-header';

export { usePluginTheme } from './theme/theme-context';
export type { PluginTheme } from './theme/resolve-theme';

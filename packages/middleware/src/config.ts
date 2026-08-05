import { type ProjectType } from '@rozenite/tools';
import { RozeniteLogLevel } from './logger.js';

/** Controls whether plugins are shown as individual tabs or in one sidebar. */
export type RozenitePluginDisplay = 'tabs' | 'sidebar';

export type RozeniteConfig = {
  projectRoot: string;
  include?: string[];
  exclude?: string[];

  /**
   * Plugin identifiers that should NOT maintain their UI state when not active.
   * These panels will be destroyed instead of hidden when switching between panels.
   * If not provided (default), all plugins will persist their state.
   */
  destroyOnDetachPlugins?: string[];

  /**
   * Project type of the project. If not provided, Rozenite will try to guess it based on the project root.
   * Useful if built-in heuristics fail to detect the project type.
   */
  projectType?: ProjectType;

  /**
   * The log level to use.
   * @default 'info'
   */
  logLevel?: RozeniteLogLevel;

  /**
   * How Rozenite plugins are shown in React Native DevTools.
   *
   * @default 'sidebar'
   */
  pluginDisplay?: RozenitePluginDisplay;
};

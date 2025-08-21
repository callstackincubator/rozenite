import { RozeniteLogLevel } from './logger.js';

export type RozeniteProjectType = 'expo' | 'react-native-cli';

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
  projectType?: RozeniteProjectType;

  /**
   * The log level to use.
   * @default 'info'
   */
  logLevel?: RozeniteLogLevel;
};

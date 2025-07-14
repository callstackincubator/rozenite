import { InstalledPlugin } from './types.js';

declare global {
  var __CALLSTACK__: {
    installedPlugins: InstalledPlugin[];
  };
}

export const getGlobalNamespace = (): typeof globalThis.__CALLSTACK__ =>
  globalThis.__CALLSTACK__;

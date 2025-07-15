declare global {
  var __CALLSTACK__: {
    installedPlugins: string[];
  };
}

export const getGlobalNamespace = (): typeof globalThis.__CALLSTACK__ =>
  globalThis.__CALLSTACK__;

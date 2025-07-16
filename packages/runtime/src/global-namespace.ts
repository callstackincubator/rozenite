declare global {
  var __ROZENITE__: {
    installedPlugins: string[];
  };
}

export const getGlobalNamespace = (): typeof globalThis.__ROZENITE__ =>
  globalThis.__ROZENITE__;

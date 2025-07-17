declare global {
  var __ROZENITE__: {
    installedPlugins: string[];
    developmentServer: boolean;
  };
}

export const getGlobalNamespace = (): typeof globalThis.__ROZENITE__ =>
  globalThis.__ROZENITE__;

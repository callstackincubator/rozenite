declare global {
  var __ROZENITE__: {
    installedPlugins: string[];
    developmentServer: boolean;
    destroyOnDetachPlugins: string[];
    pluginDisplay: 'tabs' | 'sidebar';
    // Mirrors `RozeniteHostIntegration` in `@rozenite/tools` (not imported:
    // this package isn't otherwise a consumer of it). Plumbing only for
    // now — see `RozeniteAppConfigResponse.integration` in
    // `packages/middleware/src/middleware.ts` for why it exists.
    integration: 'react-native' | 'lynx';
    runtimeVersion?: string;
  };
}

export const getGlobalNamespace = (): typeof globalThis.__ROZENITE__ => globalThis.__ROZENITE__;

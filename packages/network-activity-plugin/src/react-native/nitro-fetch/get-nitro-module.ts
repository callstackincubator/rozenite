import type { NitroModule } from './nitro-network-inspector';

type NitroFetchModule = {
  fetch: typeof globalThis.fetch;
};

const nitroModule = (() => {
  try {
    return require('react-native-nitro-fetch') as NitroModule & NitroFetchModule;
  } catch {
    return null;
  }
})();

export const getNitroModule = (): NitroModule | null => {
  return nitroModule;
};

/**
 * `react-native-nitro-fetch`'s own `fetch` export. Used only to detect
 * whether an app has installed it as the global `fetch` (`globalThis.fetch =
 * fetch` from `react-native-nitro-fetch`), in which case the generic fetch
 * wrapper must not also wrap the global — nitro traffic is already recorded
 * through its `NetworkInspector`.
 */
export const getNitroFetchFunction = (): typeof globalThis.fetch | null => {
  return nitroModule?.fetch ?? null;
};

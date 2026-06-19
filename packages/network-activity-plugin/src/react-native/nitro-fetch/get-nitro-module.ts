import type { NitroModule } from './nitro-network-inspector';

const nitroModule = (() => {
  try {
    return require('react-native-nitro-fetch') as NitroModule;
  } catch {
    return null;
  }
})();

export const getNitroModule = (): NitroModule | null => {
  return nitroModule;
};

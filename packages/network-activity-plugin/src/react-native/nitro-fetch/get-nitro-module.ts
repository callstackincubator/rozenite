import type { NitroModule } from './nitro-network-inspector';

export const getNitroModule = (): NitroModule | null => {
  try {
    return require('react-native-nitro-fetch') as NitroModule;
  } catch {
    return null;
  }
};

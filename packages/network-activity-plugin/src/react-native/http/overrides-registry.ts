import { RequestOverride } from '../../shared/client';

export type OverridesRegistry = {
  setOverrides: (newOverrides: [string, RequestOverride][]) => void;
  getOverrideForUrl: (url: string) => RequestOverride | undefined;
};

const createOverridesRegistry = (): OverridesRegistry => {
  let overrides = new Map<string, RequestOverride>();

  const setOverrides = (newOverrides: [string, RequestOverride][]) => {
    overrides = new Map(newOverrides);
  };

  const getOverrideForUrl = (url: string) => {
    return overrides.get(url);
  };

  return {
    setOverrides,
    getOverrideForUrl,
  };
};

let registryInstance: OverridesRegistry | null = null;

export const getOverridesRegistry = (): OverridesRegistry => {
  if (!registryInstance) {
    registryInstance = createOverridesRegistry();
  }
  return registryInstance;
};

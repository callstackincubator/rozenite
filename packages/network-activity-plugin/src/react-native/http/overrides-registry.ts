import { RequestOverride } from '../../shared/client';

export type OverridesRegistry = {
  setOverrides: (newOverrides: [string, RequestOverride][]) => void;
  getOverrideForUrl: (url: string) => RequestOverride | undefined;
};

let overrides = new Map<string, RequestOverride>();

export const overridesRegistry: OverridesRegistry = {
  setOverrides: (newOverrides) => {
    overrides = new Map(newOverrides);
  },
  getOverrideForUrl: (url) => overrides.get(url),
};

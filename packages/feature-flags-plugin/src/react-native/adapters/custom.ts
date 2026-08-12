import {
  inferFlagType,
  type FeatureFlag,
  type FeatureFlagsProvider,
  type FeatureFlagType,
  type FeatureFlagValue,
  type MaybePromise,
} from '../../shared/types';
import { createFlagOverrides, type FlagOverrides } from '../overrides';

export type FeatureFlagInput = {
  key: string;
  value: FeatureFlagValue;
  /** Defaults to the type inferred from `value`. */
  type?: FeatureFlagType;
};

export type CreateCustomFlagsAdapterOptions = {
  id: string;
  name: string;
  listFlags: () => MaybePromise<FeatureFlagInput[]>;
  /** Bring your own store to wire persistence; one is created if omitted. */
  overrides?: FlagOverrides;
};

export const createCustomFlagsAdapter = (
  options: CreateCustomFlagsAdapterOptions,
): FeatureFlagsProvider => {
  const overrides = options.overrides ?? createFlagOverrides();

  return {
    id: options.id,
    name: options.name,
    listFlags: async (): Promise<FeatureFlag[]> => {
      const flags = await options.listFlags();

      return flags.map(({ key, value, type }) => {
        const resolvedType = type ?? inferFlagType(value);
        const hasOverride = overrides.has(key);

        return {
          key,
          type: resolvedType,
          value: hasOverride ? (overrides.get(key) as FeatureFlagValue) : value,
          overridden: hasOverride,
        };
      });
    },
    setOverride: async (key, value) => {
      const flags = await options.listFlags();

      if (!flags.some((flag) => flag.key === key)) {
        throw new Error(
          `[Rozenite] Feature Flags Plugin: custom adapter "${options.id}" has no flag declared with key "${key}". Add it to listFlags(), or check for a typo.`,
        );
      }

      overrides.set(key, value);
    },
    clearOverride: (key) => {
      overrides.clear(key);
    },
    clearAllOverrides: () => {
      overrides.clearAll();
    },
    subscribe: (callback) => overrides.subscribe(callback),
  };
};

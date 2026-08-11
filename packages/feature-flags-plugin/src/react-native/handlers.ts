import type { FeatureFlagsMethods, FeatureFlagsSnapshot } from '../shared/messaging';
import type { FeatureFlag, FeatureFlagsProvider } from '../shared/types';
import { resolveProvider } from './provider-registry';

const findFlag = (flags: FeatureFlag[], key: string): FeatureFlag => {
  const flag = flags.find((candidate) => candidate.key === key);

  if (!flag) {
    throw new Error(`[Rozenite] Feature Flags Plugin: flag "${key}" not found after write.`);
  }

  return flag;
};

/**
 * The RPC handler bodies, extracted from the hook so they can be exercised
 * directly against real providers (e.g. `createCustomFlagsAdapter`) without
 * mocking the bridge client.
 */
export const createFeatureFlagsHandlers = (
  providers: FeatureFlagsProvider[],
): FeatureFlagsMethods => ({
  getSnapshot: async (): Promise<FeatureFlagsSnapshot> => {
    const providerSnapshots = await Promise.all(
      providers.map(async (provider) => ({
        id: provider.id,
        name: provider.name,
        flags: await provider.listFlags(),
      })),
    );

    return { providers: providerSnapshots };
  },

  setOverride: async ({ providerId, key, value }) => {
    const provider = resolveProvider(providers, providerId);
    await provider.setOverride(key, value);
    const flags = await provider.listFlags();
    return { flag: findFlag(flags, key) };
  },

  clearOverride: async ({ providerId, key }) => {
    const provider = resolveProvider(providers, providerId);
    await provider.clearOverride(key);
    const flags = await provider.listFlags();
    return { flag: findFlag(flags, key) };
  },

  clearAllOverrides: async ({ providerId }) => {
    const provider = resolveProvider(providers, providerId);
    const flags = await provider.listFlags();
    const cleared = flags.filter((flag) => flag.overridden).length;
    await provider.clearAllOverrides();
    return { cleared };
  },

  refresh: async ({ providerId }) => {
    const provider = resolveProvider(providers, providerId);
    await provider.refresh?.();
  },
});

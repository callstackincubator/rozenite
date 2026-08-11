import type { FeatureFlagsMethods, FeatureFlagsSnapshot } from '../shared/messaging';
import type { FeatureFlag, FeatureFlagsProvider } from '../shared/types';
import { setValidatedOverride } from './override-validation';
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
 *
 * Takes a `getProviders` getter rather than a static array so callers (the
 * device hook) can keep the RPC layer alive across renders while still
 * reading the latest `providers` on every invocation -- see
 * `useRozeniteFeatureFlagsPlugin`.
 */
export const createFeatureFlagsHandlers = (
  getProviders: () => FeatureFlagsProvider[],
): FeatureFlagsMethods => ({
  getSnapshot: async (): Promise<FeatureFlagsSnapshot> => {
    const providerSnapshots = await Promise.all(
      getProviders().map(async (provider) => {
        try {
          return {
            id: provider.id,
            name: provider.name,
            flags: await provider.listFlags(),
          };
        } catch (error) {
          // Isolate one provider's failure so it doesn't hide every other
          // provider's flags behind the panel's empty/error state. There is
          // no per-provider error surface in the snapshot contract, so the
          // smaller honest change is to report the provider with no flags
          // (rather than dropping it silently) and log why.
          console.error(
            `[Rozenite] Feature Flags Plugin: provider "${provider.id}" failed to list flags. Reporting it with no flags.`,
            error,
          );
          return { id: provider.id, name: provider.name, flags: [] };
        }
      }),
    );

    return { providers: providerSnapshots };
  },

  setOverride: async ({ providerId, key, value }) => {
    const provider = resolveProvider(getProviders(), providerId);
    const flags = await setValidatedOverride(provider, key, value);
    return { flag: findFlag(flags, key) };
  },

  clearOverride: async ({ providerId, key }) => {
    const provider = resolveProvider(getProviders(), providerId);
    await provider.clearOverride(key);
    const flags = await provider.listFlags();
    return { flag: findFlag(flags, key) };
  },

  clearAllOverrides: async ({ providerId }) => {
    const provider = resolveProvider(getProviders(), providerId);
    const flags = await provider.listFlags();
    const cleared = flags.filter((flag) => flag.overridden).length;
    await provider.clearAllOverrides();
    return { cleared };
  },

  refresh: async ({ providerId }) => {
    const provider = resolveProvider(getProviders(), providerId);
    await provider.refresh?.();
  },
});

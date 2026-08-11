import type { FeatureFlagsProviderSnapshot, FeatureFlagsSnapshot } from '../shared/messaging';
import type { FeatureFlag } from '../shared/types';

/**
 * Replaces a single flag inside `snapshot`, matched by `providerId` and
 * `flag.key`. Used to apply a mutation's returned flag to local state
 * instead of refetching the whole snapshot (design doc §6).
 */
export const updateFlagInSnapshot = (
  snapshot: FeatureFlagsSnapshot,
  providerId: string,
  flag: FeatureFlag,
): FeatureFlagsSnapshot => ({
  providers: snapshot.providers.map((provider) =>
    provider.id === providerId
      ? {
          ...provider,
          flags: provider.flags.map((candidate) => (candidate.key === flag.key ? flag : candidate)),
        }
      : provider,
  ),
});

export type ProviderSidebarItem = {
  id: string;
  name: string;
  flagCount: number;
  overriddenCount: number;
};

/**
 * Maps snapshot providers to the summary each gets in the sidebar (one
 * group per provider, per design §7). Pure so the mapping is testable
 * without mounting `Sidebar`.
 */
export const buildProviderSidebarItems = (
  providers: FeatureFlagsProviderSnapshot[],
): ProviderSidebarItem[] =>
  providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    flagCount: provider.flags.length,
    overriddenCount: provider.flags.filter((flag) => flag.overridden).length,
  }));

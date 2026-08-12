import type { FeatureFlagsProvider } from '../shared/types';

/**
 * Pure resolution logic for turning `providers` + an optional `providerId`
 * into a single `FeatureFlagsProvider`. Kept free of React and of the
 * bridge client so it's trivially unit-testable.
 */

const listIds = (providers: FeatureFlagsProvider[]): string =>
  providers.map((provider) => provider.id).join(', ');

/**
 * Throws if `providers` contains duplicate ids. Call this once, at
 * registration time, rather than letting duplicate ids silently resolve to
 * the first match on every call.
 */
export const assertNoDuplicateProviderIds = (providers: FeatureFlagsProvider[]): void => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const provider of providers) {
    if (seen.has(provider.id)) {
      duplicates.add(provider.id);
    }
    seen.add(provider.id);
  }

  if (duplicates.size > 0) {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: duplicate provider id(s): ${Array.from(duplicates).join(', ')}. Provider ids must be unique.`,
    );
  }
};

/**
 * Resolves a single provider from `providers`.
 *
 * - `providerId` given: returns the matching provider, or throws naming the
 *   unknown id and listing the available ones.
 * - `providerId` omitted: returns the sole provider. Throws if there are
 *   zero providers, or if there is more than one (in which case `providerId`
 *   is required).
 */
export const resolveProvider = (
  providers: FeatureFlagsProvider[],
  providerId?: string,
): FeatureFlagsProvider => {
  if (providerId != null) {
    const provider = providers.find((candidate) => candidate.id === providerId);

    if (!provider) {
      throw new Error(
        `[Rozenite] Feature Flags Plugin: unknown providerId "${providerId}". Available providers: ${
          providers.length > 0 ? listIds(providers) : '(none registered)'
        }.`,
      );
    }

    return provider;
  }

  if (providers.length === 0) {
    throw new Error('[Rozenite] Feature Flags Plugin: no providers registered.');
  }

  if (providers.length > 1) {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: "providerId" is required when more than one provider is registered. Available providers: ${listIds(providers)}.`,
    );
  }

  return providers[0];
};

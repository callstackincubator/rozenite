import { describe, expect, it } from 'vitest';
import type { FeatureFlagsSnapshot } from '../../shared/messaging';
import type { FeatureFlag } from '../../shared/types';
import { buildProviderSidebarItems, updateFlagInSnapshot } from '../snapshot-helpers';

const flag = (key: string, value: FeatureFlag['value'], overridden = false): FeatureFlag => ({
  key,
  type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
  value,
  overridden,
});

const snapshot: FeatureFlagsSnapshot = {
  providers: [
    { id: 'app', name: 'App flags', flags: [flag('dark-mode', false), flag('max-items', 10)] },
    { id: 'ld', name: 'LaunchDarkly', flags: [flag('new-onboarding', true, true)] },
  ],
};

describe('updateFlagInSnapshot', () => {
  it('replaces the matching flag within the matching provider', () => {
    const updated = updateFlagInSnapshot(snapshot, 'app', flag('dark-mode', true, true));

    expect(updated.providers[0].flags).toEqual([
      flag('dark-mode', true, true),
      flag('max-items', 10),
    ]);
    // Untouched provider and its flags stay referentially equal.
    expect(updated.providers[1]).toBe(snapshot.providers[1]);
  });

  it('leaves other flags in the same provider untouched', () => {
    const updated = updateFlagInSnapshot(snapshot, 'app', flag('max-items', 20, true));

    expect(updated.providers[0].flags[0]).toBe(snapshot.providers[0].flags[0]);
    expect(updated.providers[0].flags[1]).toEqual(flag('max-items', 20, true));
  });

  it('is a no-op when the providerId does not match anything', () => {
    const updated = updateFlagInSnapshot(snapshot, 'missing', flag('dark-mode', true, true));

    expect(updated).toEqual(snapshot);
  });
});

describe('buildProviderSidebarItems', () => {
  it('maps each provider to its flag count and overridden count', () => {
    expect(buildProviderSidebarItems(snapshot.providers)).toEqual([
      { id: 'app', name: 'App flags', flagCount: 2, overriddenCount: 0 },
      { id: 'ld', name: 'LaunchDarkly', flagCount: 1, overriddenCount: 1 },
    ]);
  });

  it('returns an empty array for no providers', () => {
    expect(buildProviderSidebarItems([])).toEqual([]);
  });
});

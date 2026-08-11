import { describe, expect, it } from 'vitest';
import type { FeatureFlagsProvider } from '../../shared/types';
import { assertNoDuplicateProviderIds, resolveProvider } from '../provider-registry';

const makeProvider = (id: string): FeatureFlagsProvider => ({
  id,
  name: id,
  listFlags: () => [],
  setOverride: () => {},
  clearOverride: () => {},
  clearAllOverrides: () => {},
});

describe('resolveProvider', () => {
  it('returns the sole provider when providerId is omitted', () => {
    const provider = makeProvider('app');

    expect(resolveProvider([provider])).toBe(provider);
  });

  it('throws when providerId is omitted and there are zero providers', () => {
    expect(() => resolveProvider([])).toThrow(/no providers registered/i);
  });

  it('throws naming providerId as required when omitted and there is more than one provider', () => {
    const providers = [makeProvider('app'), makeProvider('ld')];

    expect(() => resolveProvider(providers)).toThrow(/providerId.*required/i);
    expect(() => resolveProvider(providers)).toThrow(/app, ld/);
  });

  it('returns the matching provider when providerId is given', () => {
    const app = makeProvider('app');
    const ld = makeProvider('ld');

    expect(resolveProvider([app, ld], 'ld')).toBe(ld);
  });

  it('throws naming the unknown providerId and listing the available ones', () => {
    const providers = [makeProvider('app'), makeProvider('ld')];

    expect(() => resolveProvider(providers, 'nope')).toThrow(/nope/);
    expect(() => resolveProvider(providers, 'nope')).toThrow(/app, ld/);
  });

  it('reports "(none registered)" when providerId is given but there are zero providers', () => {
    expect(() => resolveProvider([], 'nope')).toThrow(/\(none registered\)/);
  });
});

describe('assertNoDuplicateProviderIds', () => {
  it('does not throw for unique ids', () => {
    expect(() =>
      assertNoDuplicateProviderIds([makeProvider('app'), makeProvider('ld')]),
    ).not.toThrow();
  });

  it('does not throw for an empty list', () => {
    expect(() => assertNoDuplicateProviderIds([])).not.toThrow();
  });

  it('throws naming duplicate ids', () => {
    expect(() => assertNoDuplicateProviderIds([makeProvider('app'), makeProvider('app')])).toThrow(
      /duplicate provider id.*app/i,
    );
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The production path of `react-native.ts` ships in release builds, where a
 * crash is worst-felt and least observable. These stubs must be inert *and*
 * unable to throw, including for the sloppy call shapes a JS consumer can
 * produce that TypeScript would have rejected.
 */
const originalNodeEnv = process.env.NODE_ENV;

beforeAll(() => {
  process.env.NODE_ENV = 'production';
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

const loadProductionEntry = () => import('../../react-native');

describe('react-native entry, production build', () => {
  it('returns inert providers that report no flags and swallow overrides', async () => {
    const { createCustomFlagsAdapter, createStatsigFlagsAdapter } = await loadProductionEntry();

    const custom = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'dark-mode', value: true }],
    });

    expect(custom.id).toBe('app');
    expect(custom.name).toBe('App flags');
    expect(await custom.listFlags()).toEqual([]);
    // `MaybePromise<void>`, so the stubs are free to settle synchronously.
    expect(await custom.setOverride('dark-mode', false)).toBeUndefined();
    expect(await custom.clearOverride('dark-mode')).toBeUndefined();
    expect(await custom.clearAllOverrides()).toBeUndefined();

    const statsig = createStatsigFlagsAdapter({
      client: {} as never,
      overrideAdapter: {} as never,
      flags: [{ key: 'new-checkout' }],
    });

    expect(statsig.id).toBe('statsig');
    expect(await statsig.listFlags()).toEqual([]);
  });

  it('hands back the raw LaunchDarkly client unwrapped', async () => {
    const { createLaunchDarklyFlagsAdapter } = await loadProductionEntry();

    const rawClient = { boolVariation: () => true } as never;
    const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

    // Identity passthrough — no `Proxy`, so zero overhead on every flag read.
    expect(client).toBe(rawClient);
    expect(await provider.listFlags()).toEqual([]);
  });

  it('returns an inert override store', async () => {
    const { createFlagOverrides } = await loadProductionEntry();

    const overrides = createFlagOverrides({ initial: { 'dark-mode': true } });

    expect(overrides.getAll()).toEqual({});
    expect(overrides.get('dark-mode')).toBeUndefined();
    expect(overrides.has('dark-mode')).toBe(false);
    overrides.set('dark-mode', false);
    expect(overrides.getAll()).toEqual({});
    expect(() => overrides.subscribe(() => {}).remove()).not.toThrow();
  });

  it('makes the hook a no-op', async () => {
    const { useRozeniteFeatureFlagsPlugin } = await loadProductionEntry();

    expect(useRozeniteFeatureFlagsPlugin({ providers: [] })).toBeNull();
  });

  it('does not throw when called without options', async () => {
    const entry = await loadProductionEntry();

    // Untyped JS consumers and hot-reload edge cases can reach these with
    // nothing at all; a release build must degrade, not crash.
    const callWithoutOptions = [
      () => (entry.createCustomFlagsAdapter as () => unknown)(),
      () => (entry.createLaunchDarklyFlagsAdapter as () => unknown)(),
      () => (entry.createStatsigFlagsAdapter as () => unknown)(),
      () => (entry.createFlagOverrides as () => unknown)(),
      () => (entry.useRozeniteFeatureFlagsPlugin as () => unknown)(),
    ];

    for (const call of callWithoutOptions) {
      expect(call).not.toThrow();
    }
  });
});

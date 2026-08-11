import { describe, expect, it } from 'vitest';
import {
  createStatsigFlagsAdapter,
  type StatsigClientLike,
  type StatsigDynamicConfigLike,
  type StatsigOverrideAdapterLike,
  type StatsigOverrideStoreLike,
} from '../statsig';

/**
 * A small hand-written fake standing in for `LocalOverrideAdapter` from
 * `@statsig/js-local-overrides`.
 */
const createFakeOverrideAdapter = (): StatsigOverrideAdapterLike => {
  const store: StatsigOverrideStoreLike = { gate: {}, dynamicConfig: {} };

  return {
    overrideGate: (name, value) => {
      store.gate[name] = value;
    },
    removeGateOverride: (name) => {
      delete store.gate[name];
    },
    overrideDynamicConfig: (name, value) => {
      store.dynamicConfig[name] = value;
    },
    removeDynamicConfigOverride: (name) => {
      delete store.dynamicConfig[name];
    },
    getAllOverrides: () => ({
      gate: { ...store.gate },
      dynamicConfig: { ...store.dynamicConfig },
    }),
    removeAllOverrides: () => {
      store.gate = {};
      store.dynamicConfig = {};
    },
  };
};

/**
 * A small hand-written fake standing in for a real `StatsigClient`. Real
 * behaviour (a gate/config store), not a mock framework double. Also
 * consults `overrideAdapter`, mirroring how the real SDK's
 * `checkGate`/`getDynamicConfig` read through the `overrideAdapter` passed
 * at client construction (confirmed from `@statsig/js-client` source,
 * `_getFeatureGateImpl`/`_getDynamicConfigImpl`) — without that, these
 * fakes wouldn't exercise what `listFlags`/`setOverride` actually rely on.
 */
const createFakeClient = (
  overrideAdapter: StatsigOverrideAdapterLike,
  gates: Record<string, boolean> = {},
  configs: Record<string, Record<string, unknown>> = {},
): StatsigClientLike => ({
  checkGate: (name) => {
    const overrides = overrideAdapter.getAllOverrides();
    return name in overrides.gate ? overrides.gate[name] : (gates[name] ?? false);
  },
  getDynamicConfig: (name): StatsigDynamicConfigLike => {
    const overrides = overrideAdapter.getAllOverrides();
    const value =
      name in overrides.dynamicConfig ? overrides.dynamicConfig[name] : (configs[name] ?? {});
    return {
      value,
      get: <T>(paramName: string, defaultValue: T): T =>
        paramName in value ? (value[paramName] as T) : defaultValue,
    };
  },
});

describe('createStatsigFlagsAdapter', () => {
  describe('listFlags', () => {
    it('reports overridden: true for a key present in the override adapter, false otherwise', async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, { a: true, b: false });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [
          { key: 'a', type: 'boolean' },
          { key: 'b', type: 'boolean' },
        ],
      });

      overrideAdapter.overrideGate('a', false);

      const flags = await provider.listFlags();

      expect(flags).toEqual([
        { key: 'a', type: 'boolean', value: false, overridden: true },
        { key: 'b', type: 'boolean', value: false, overridden: false },
      ]);
    });

    it('reports overridden: true for a dynamic-config-backed flag present in the override adapter', async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, {}, { config: { value: 'raw' } });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'config', type: 'string' }],
      });

      expect(await provider.listFlags()).toEqual([
        { key: 'config', type: 'string', value: 'raw', overridden: false },
      ]);

      overrideAdapter.overrideDynamicConfig('config', { value: 'forced' });

      expect(await provider.listFlags()).toEqual([
        { key: 'config', type: 'string', value: 'forced', overridden: true },
      ]);
    });

    it('reads the full parameter map for a json-typed flag', async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, {}, { config: { a: 1, b: 2 } });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'config', type: 'json' }],
      });

      expect(await provider.listFlags()).toEqual([
        { key: 'config', type: 'json', value: { a: 1, b: 2 }, overridden: false },
      ]);
    });
  });

  describe('setOverride', () => {
    it('rejects a type-mismatched value', () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, { flag: true });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'flag', type: 'boolean' }],
      });

      expect(() => provider.setOverride('flag', 'not-a-boolean')).toThrow(/type "boolean"/);
    });

    it('rejects a non-object value for a json-typed flag', () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, {}, { config: {} });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'config', type: 'json' }],
      });

      expect(() => provider.setOverride('config', [1, 2, 3])).toThrow(/plain object/);
    });

    it('throws for a key with no matching declaration', () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter);
      const provider = createStatsigFlagsAdapter({ client, overrideAdapter, flags: [] });

      expect(() => provider.setOverride('unknown', true)).toThrow(/no flag declared/);
    });

    it('sets a matching-type override via the override adapter', async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, { flag: true });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'flag', type: 'boolean' }],
      });

      provider.setOverride('flag', false);

      expect(await provider.listFlags()).toEqual([
        { key: 'flag', type: 'boolean', value: false, overridden: true },
      ]);
    });
  });

  describe('clearOverride / clearAllOverrides', () => {
    it('clears a single override via the override adapter', async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, { flag: true });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'flag', type: 'boolean' }],
      });

      provider.setOverride('flag', false);
      provider.clearOverride('flag');

      expect(await provider.listFlags()).toEqual([
        { key: 'flag', type: 'boolean', value: true, overridden: false },
      ]);
    });

    it('clears every override via the override adapter', async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, { a: true, b: false });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [
          { key: 'a', type: 'boolean' },
          { key: 'b', type: 'boolean' },
        ],
      });

      provider.setOverride('a', false);
      provider.setOverride('b', true);
      provider.clearAllOverrides();

      expect(await provider.listFlags()).toEqual([
        { key: 'a', type: 'boolean', value: true, overridden: false },
        { key: 'b', type: 'boolean', value: false, overridden: false },
      ]);
    });

    it("clearAllOverrides only clears this adapter's declared flags, leaving unrelated overrides in the shared LocalOverrideAdapter alone", async () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const client = createFakeClient(overrideAdapter, { a: true });
      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter,
        flags: [{ key: 'a', type: 'boolean' }],
      });

      provider.setOverride('a', false);
      // An override on a gate this adapter never declared -- e.g. set by
      // other QA tooling sharing the same `LocalOverrideAdapter` instance.
      overrideAdapter.overrideGate('unrelated-gate', true);

      provider.clearAllOverrides();

      expect(await provider.listFlags()).toEqual([
        { key: 'a', type: 'boolean', value: true, overridden: false },
      ]);
      expect(overrideAdapter.getAllOverrides().gate).toEqual({ 'unrelated-gate': true });
    });
  });

  describe('defensive error when a required override-adapter method is missing', () => {
    it('throws a clear error instead of crashing on a missing method', () => {
      // A partial fake missing `overrideGate`, as if constructed against an
      // older/incompatible `@statsig/js-local-overrides` version.
      const incompleteOverrideAdapter = {
        removeGateOverride: () => {},
        overrideDynamicConfig: () => {},
        removeDynamicConfigOverride: () => {},
        getAllOverrides: () => ({ gate: {}, dynamicConfig: {} }),
        removeAllOverrides: () => {},
      } as unknown as StatsigOverrideAdapterLike;
      const client = createFakeClient(incompleteOverrideAdapter, { flag: true });

      const provider = createStatsigFlagsAdapter({
        client,
        overrideAdapter: incompleteOverrideAdapter,
        flags: [{ key: 'flag', type: 'boolean' }],
      });

      expect(() => provider.setOverride('flag', false)).toThrow(/overrideGate/);
    });
  });

  describe('options', () => {
    it('defaults id/name and accepts overrides', () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const provider = createStatsigFlagsAdapter({
        client: createFakeClient(overrideAdapter),
        overrideAdapter,
        flags: [],
      });

      expect(provider.id).toBe('statsig');
      expect(provider.name).toBe('Statsig');
    });

    it('uses a custom id/name when provided', () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const provider = createStatsigFlagsAdapter({
        client: createFakeClient(overrideAdapter),
        overrideAdapter,
        flags: [],
        id: 'statsig-mobile',
        name: 'Statsig (mobile)',
      });

      expect(provider.id).toBe('statsig-mobile');
      expect(provider.name).toBe('Statsig (mobile)');
    });

    it('has no `refresh` method', () => {
      const overrideAdapter = createFakeOverrideAdapter();
      const provider = createStatsigFlagsAdapter({
        client: createFakeClient(overrideAdapter),
        overrideAdapter,
        flags: [],
      });

      expect(provider.refresh).toBeUndefined();
    });
  });
});

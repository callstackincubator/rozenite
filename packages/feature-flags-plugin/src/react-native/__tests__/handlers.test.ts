import { describe, expect, it } from 'vitest';
import { createCustomFlagsAdapter } from '../adapters/custom';
import { createFeatureFlagsHandlers } from '../handlers';

describe('createFeatureFlagsHandlers', () => {
  it('getSnapshot returns an empty providers array when there are no providers', async () => {
    const handlers = createFeatureFlagsHandlers([]);

    await expect(handlers.getSnapshot()).resolves.toEqual({ providers: [] });
  });

  it('getSnapshot reads every provider in parallel and shapes the result', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'a', value: true }],
    });
    const other = createCustomFlagsAdapter({
      id: 'other',
      name: 'Other flags',
      listFlags: () => [{ key: 'b', value: 'x' }],
    });

    const handlers = createFeatureFlagsHandlers([app, other]);

    await expect(handlers.getSnapshot()).resolves.toEqual({
      providers: [
        {
          id: 'app',
          name: 'App flags',
          flags: [{ key: 'a', type: 'boolean', value: true, overridden: false }],
        },
        {
          id: 'other',
          name: 'Other flags',
          flags: [{ key: 'b', type: 'string', value: 'x', overridden: false }],
        },
      ],
    });
  });

  it('setOverride resolves the sole provider and returns the resulting flag', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false }],
    });
    const handlers = createFeatureFlagsHandlers([app]);

    await expect(handlers.setOverride({ key: 'flag', value: true })).resolves.toEqual({
      flag: { key: 'flag', type: 'boolean', value: true, overridden: true },
    });
  });

  it('setOverride resolves the provider named by providerId when there are several', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false }],
    });
    const other = createCustomFlagsAdapter({
      id: 'other',
      name: 'Other flags',
      listFlags: () => [{ key: 'flag', value: 1 }],
    });
    const handlers = createFeatureFlagsHandlers([app, other]);

    await expect(
      handlers.setOverride({ providerId: 'other', key: 'flag', value: 2 }),
    ).resolves.toEqual({
      flag: { key: 'flag', type: 'number', value: 2, overridden: true },
    });
  });

  it('setOverride throws a clear error when the key is not present after the write', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [],
    });
    const handlers = createFeatureFlagsHandlers([app]);

    await expect(handlers.setOverride({ key: 'missing', value: true })).rejects.toThrow(/missing/);
  });

  it('clearOverride resolves the provider and returns the post-clear flag', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false }],
    });
    const handlers = createFeatureFlagsHandlers([app]);

    await handlers.setOverride({ key: 'flag', value: true });

    await expect(handlers.clearOverride({ key: 'flag' })).resolves.toEqual({
      flag: { key: 'flag', type: 'boolean', value: false, overridden: false },
    });
  });

  it('clearAllOverrides returns the count of flags that were overridden before clearing', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [
        { key: 'a', value: false },
        { key: 'b', value: 'x' },
        { key: 'c', value: 1 },
      ],
    });
    const handlers = createFeatureFlagsHandlers([app]);

    await handlers.setOverride({ key: 'a', value: true });
    await handlers.setOverride({ key: 'b', value: 'y' });

    await expect(handlers.clearAllOverrides({})).resolves.toEqual({ cleared: 2 });

    // A second call, with nothing overridden, reports zero.
    await expect(handlers.clearAllOverrides({})).resolves.toEqual({ cleared: 0 });
  });

  it('refresh is a no-op for a provider without a `refresh` method', async () => {
    const app = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [],
    });
    const handlers = createFeatureFlagsHandlers([app]);

    await expect(handlers.refresh({})).resolves.toBeUndefined();
  });

  it('refresh calls the provider `refresh` method when present', async () => {
    let refreshed = false;
    const provider = {
      id: 'app',
      name: 'App',
      listFlags: () => [],
      setOverride: () => {},
      clearOverride: () => {},
      clearAllOverrides: () => {},
      refresh: () => {
        refreshed = true;
      },
    };
    const handlers = createFeatureFlagsHandlers([provider]);

    await handlers.refresh({});

    expect(refreshed).toBe(true);
  });
});

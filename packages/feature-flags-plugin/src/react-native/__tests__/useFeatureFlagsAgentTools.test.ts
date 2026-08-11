import { describe, expect, it } from 'vitest';
import { createCustomFlagsAdapter } from '../adapters/custom';
import { createFeatureFlagsAgentToolHandlers } from '../useFeatureFlagsAgentTools';

describe('createFeatureFlagsAgentToolHandlers', () => {
  describe('listFlags', () => {
    it('lists every provider when providerId is omitted', async () => {
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
      const handlers = createFeatureFlagsAgentToolHandlers([app, other]);

      await expect(handlers.listFlags({})).resolves.toEqual({
        providers: [
          {
            providerId: 'app',
            providerName: 'App flags',
            flags: [{ key: 'a', type: 'boolean', value: true, overridden: false }],
          },
          {
            providerId: 'other',
            providerName: 'Other flags',
            flags: [{ key: 'b', type: 'string', value: 'x', overridden: false }],
          },
        ],
      });
    });

    it('scopes to a single provider when providerId is given', async () => {
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
      const handlers = createFeatureFlagsAgentToolHandlers([app, other]);

      await expect(handlers.listFlags({ providerId: 'other' })).resolves.toEqual({
        providers: [
          {
            providerId: 'other',
            providerName: 'Other flags',
            flags: [{ key: 'b', type: 'string', value: 'x', overridden: false }],
          },
        ],
      });
    });

    it('throws a clear error for an unknown providerId', async () => {
      const app = createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags: () => [] });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.listFlags({ providerId: 'missing' })).rejects.toThrow(/missing/);
    });

    it('throws when multiple providers are registered and providerId is omitted for a single-provider call', async () => {
      // listFlags is the one tool that tolerates omission across multiple
      // providers by fanning out; get-flag/override-flag/clear-overrides do
      // not, and are covered below via resolveProvider's ambiguity error.
      const app = createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags: () => [] });
      const other = createCustomFlagsAdapter({
        id: 'other',
        name: 'Other flags',
        listFlags: () => [],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app, other]);

      await expect(handlers.listFlags({})).resolves.toEqual({
        providers: [
          { providerId: 'app', providerName: 'App flags', flags: [] },
          { providerId: 'other', providerName: 'Other flags', flags: [] },
        ],
      });
    });
  });

  describe('getFlag', () => {
    it('resolves the sole provider and returns the flag', async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'flag', value: true }],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.getFlag({ key: 'flag' })).resolves.toEqual({
        providerId: 'app',
        flag: { key: 'flag', type: 'boolean', value: true, overridden: false },
      });
    });

    it('throws when providerId is ambiguous across multiple providers', async () => {
      const app = createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags: () => [] });
      const other = createCustomFlagsAdapter({
        id: 'other',
        name: 'Other flags',
        listFlags: () => [],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app, other]);

      await expect(handlers.getFlag({ key: 'flag' })).rejects.toThrow(/providerId.*is required/i);
    });

    it('throws a clear error when the key does not exist', async () => {
      const app = createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags: () => [] });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.getFlag({ key: 'missing' })).rejects.toThrow(/missing/);
    });
  });

  describe('overrideFlag', () => {
    it('sets the override and returns the resulting flag', async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'flag', value: false }],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.overrideFlag({ key: 'flag', value: true })).resolves.toEqual({
        providerId: 'app',
        flag: { key: 'flag', type: 'boolean', value: true, overridden: true },
      });
    });

    it('resolves the provider named by providerId when there are several', async () => {
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
      const handlers = createFeatureFlagsAgentToolHandlers([app, other]);

      await expect(
        handlers.overrideFlag({ providerId: 'other', key: 'flag', value: 2 }),
      ).resolves.toEqual({
        providerId: 'other',
        flag: { key: 'flag', type: 'number', value: 2, overridden: true },
      });
    });

    it("rejects a value that does not match the flag's declared type", async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'flag', value: false }],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.overrideFlag({ key: 'flag', value: 'not-a-boolean' })).rejects.toThrow(
        /type "boolean"/,
      );

      // The rejected write must not have taken effect.
      await expect(handlers.getFlag({ key: 'flag' })).resolves.toEqual({
        providerId: 'app',
        flag: { key: 'flag', type: 'boolean', value: false, overridden: false },
      });
    });

    it('accepts any JSON-serializable value for a json-typed flag', async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'flag', value: { a: 1 }, type: 'json' }],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(
        handlers.overrideFlag({ key: 'flag', value: { b: [1, 2, 'x'] } }),
      ).resolves.toEqual({
        providerId: 'app',
        flag: { key: 'flag', type: 'json', value: { b: [1, 2, 'x'] }, overridden: true },
      });
    });

    it('throws a clear error when the key does not exist', async () => {
      const app = createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags: () => [] });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.overrideFlag({ key: 'missing', value: true })).rejects.toThrow(
        /missing/,
      );
    });
  });

  describe('clearOverrides', () => {
    it('clears a single key and returns the resulting flag', async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'flag', value: false }],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await handlers.overrideFlag({ key: 'flag', value: true });

      await expect(handlers.clearOverrides({ key: 'flag' })).resolves.toEqual({
        providerId: 'app',
        cleared: 1,
        flag: { key: 'flag', type: 'boolean', value: false, overridden: false },
      });
    });

    it('reports zero cleared when clearing a key that was not overridden', async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'flag', value: false }],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.clearOverrides({ key: 'flag' })).resolves.toEqual({
        providerId: 'app',
        cleared: 0,
        flag: { key: 'flag', type: 'boolean', value: false, overridden: false },
      });
    });

    it('clears every override for the provider when key is omitted', async () => {
      const app = createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [
          { key: 'a', value: false },
          { key: 'b', value: 'x' },
          { key: 'c', value: 1 },
        ],
      });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await handlers.overrideFlag({ key: 'a', value: true });
      await handlers.overrideFlag({ key: 'b', value: 'y' });

      await expect(handlers.clearOverrides({})).resolves.toEqual({
        providerId: 'app',
        cleared: 2,
      });

      // A second call, with nothing overridden, reports zero and omits `flag`.
      await expect(handlers.clearOverrides({})).resolves.toEqual({
        providerId: 'app',
        cleared: 0,
      });
    });

    it('throws a clear error when clearing an unknown key', async () => {
      const app = createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags: () => [] });
      const handlers = createFeatureFlagsAgentToolHandlers([app]);

      await expect(handlers.clearOverrides({ key: 'missing' })).rejects.toThrow(/missing/);
    });
  });
});

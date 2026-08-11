import { describe, expect, it, vi } from 'vitest';
import { createLaunchDarklyFlagsAdapter, type LDClientLike } from '../launchdarkly';
import { createFlagOverrides } from '../../overrides';

/**
 * A small hand-written fake standing in for a real LD client. It's a real
 * object with real behaviour (a flag store + a real event emitter), not a
 * mock framework double — the wrapper's `Proxy`/event-multiplexing logic is
 * what's under test, and this fake gives it something real to compose with.
 */
const createFakeLDClient = (
  initialFlags: Record<string, unknown> = {},
): LDClientLike & {
  emitRawChange: () => void;
} => {
  const flags = { ...initialFlags };
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const variation = (key: string, defaultValue: unknown) =>
    key in flags ? flags[key] : defaultValue;

  const variationDetail = (key: string, defaultValue: unknown) => ({
    value: variation(key, defaultValue),
    variationIndex: 0,
    reason: { kind: 'FALLTHROUGH' },
  });

  return {
    boolVariation: (key, defaultValue) => variation(key, defaultValue) as boolean,
    stringVariation: (key, defaultValue) => variation(key, defaultValue) as string,
    numberVariation: (key, defaultValue) => variation(key, defaultValue) as number,
    jsonVariation: (key, defaultValue) => variation(key, defaultValue),
    boolVariationDetail: (key, defaultValue) => variationDetail(key, defaultValue) as never,
    stringVariationDetail: (key, defaultValue) => variationDetail(key, defaultValue) as never,
    numberVariationDetail: (key, defaultValue) => variationDetail(key, defaultValue) as never,
    jsonVariationDetail: (key, defaultValue) => variationDetail(key, defaultValue) as never,
    allFlags: () => ({ ...flags }),
    on: (eventName, callback) => {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      listeners.get(eventName)?.add(callback);
    },
    off: (eventName, callback) => {
      listeners.get(eventName)?.delete(callback);
    },
    identify: vi.fn(function (this: unknown) {
      return this;
    }),
    emitRawChange: () => {
      for (const listener of listeners.get('change') ?? []) {
        listener();
      }
    },
  };
};

describe('createLaunchDarklyFlagsAdapter', () => {
  describe('variation methods', () => {
    it('boolVariation returns the raw value on a miss', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(client.boolVariation('flag', false)).toBe(true);
    });

    it('boolVariation returns the override on a hit', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      provider.setOverride('flag', false);

      expect(client.boolVariation('flag', true)).toBe(false);
    });

    it('stringVariation returns the override on a hit, raw value on a miss', () => {
      const rawClient = createFakeLDClient({ flag: 'raw' });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(client.stringVariation('flag', 'default')).toBe('raw');

      provider.setOverride('flag', 'overridden');

      expect(client.stringVariation('flag', 'default')).toBe('overridden');
    });

    it('numberVariation returns the override on a hit, raw value on a miss', () => {
      const rawClient = createFakeLDClient({ flag: 1 });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(client.numberVariation('flag', 0)).toBe(1);

      provider.setOverride('flag', 2);

      expect(client.numberVariation('flag', 0)).toBe(2);
    });

    it('jsonVariation returns the override on a hit, raw value on a miss', () => {
      const rawClient = createFakeLDClient({ flag: { a: 1 } });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(client.jsonVariation('flag', null)).toEqual({ a: 1 });

      provider.setOverride('flag', { a: 2 });

      expect(client.jsonVariation('flag', null)).toEqual({ a: 2 });
    });

    it('*VariationDetail returns a DevTools-marked reason on a hit', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      provider.setOverride('flag', false);

      expect(client.boolVariationDetail('flag', true)).toEqual({
        value: false,
        variationIndex: null,
        reason: { kind: 'DEVTOOLS_OVERRIDE' },
      });
    });

    it('*VariationDetail delegates to the raw client on a miss', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(client.boolVariationDetail('flag', false)).toEqual({
        value: true,
        variationIndex: 0,
        reason: { kind: 'FALLTHROUGH' },
      });
    });

    it('delegates to the raw client instead of returning a type-mismatched override', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      provider.setOverride('flag', 'not-a-boolean');

      expect(client.boolVariation('flag', false)).toBe(true);
      expect(client.boolVariationDetail('flag', false)).toEqual({
        value: true,
        variationIndex: 0,
        reason: { kind: 'FALLTHROUGH' },
      });
    });
  });

  describe('allFlags', () => {
    it('merges overrides over the raw flag map', () => {
      const rawClient = createFakeLDClient({ a: 1, b: 2 });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      provider.setOverride('b', 20);
      provider.setOverride('c', 30);

      expect(client.allFlags()).toEqual({ a: 1, b: 20, c: 30 });
    });
  });

  describe('pass-through', () => {
    it('passes through a non-intercepted method with `this` intact', () => {
      const rawClient = createFakeLDClient();
      const { client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      const result = client.identify();

      expect(rawClient.identify).toHaveBeenCalledTimes(1);
      expect(result).toBe(rawClient);
    });
  });

  describe('synthetic `change` multiplexing', () => {
    it('fires a synthetic `change` on setOverride and clearOverride, reaching a listener registered via `on`', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });
      const listener = vi.fn();

      client.on('change', listener);

      provider.setOverride('flag', false);
      expect(listener).toHaveBeenCalledTimes(1);

      provider.clearOverride('flag');
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("still delivers the raw client's own `change` events to a listener registered via `on`", () => {
      const rawClient = createFakeLDClient();
      const { client } = createLaunchDarklyFlagsAdapter({ client: rawClient });
      const listener = vi.fn();

      client.on('change', listener);
      rawClient.emitRawChange();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('off removes the listener from the synthetic fan-out', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });
      const listener = vi.fn();

      client.on('change', listener);
      client.off('change', listener);

      provider.setOverride('flag', false);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('provider.listFlags', () => {
    it('marks overridden flags and reports effective values', async () => {
      const rawClient = createFakeLDClient({ a: true, b: 'x' });
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      provider.setOverride('a', false);

      const flags = await provider.listFlags();

      expect(flags).toEqual(
        expect.arrayContaining([
          { key: 'a', type: 'boolean', value: false, overridden: true },
          { key: 'b', type: 'string', value: 'x', overridden: false },
        ]),
      );
    });

    it('includes an overridden key that is not in allFlags()', async () => {
      const rawClient = createFakeLDClient({});
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      provider.setOverride('new-flag', true);

      const flags = await provider.listFlags();

      expect(flags).toEqual([{ key: 'new-flag', type: 'boolean', value: true, overridden: true }]);
    });
  });

  describe('provider.subscribe', () => {
    it('fires on override changes', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });
      const listener = vi.fn();

      provider.subscribe?.(listener);
      provider.setOverride('flag', false);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("fires on the raw client's own `change` events", () => {
      const rawClient = createFakeLDClient();
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });
      const listener = vi.fn();

      provider.subscribe?.(listener);
      rawClient.emitRawChange();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('remove() unsubscribes from both the override store and the raw client', () => {
      const rawClient = createFakeLDClient({ flag: true });
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });
      const listener = vi.fn();

      const subscription = provider.subscribe?.(listener);
      subscription?.remove();

      provider.setOverride('flag', false);
      rawClient.emitRawChange();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('options', () => {
    it('defaults id/name and accepts overrides', () => {
      const rawClient = createFakeLDClient();
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(provider.id).toBe('launchdarkly');
      expect(provider.name).toBe('LaunchDarkly');
    });

    it('uses a custom id/name when provided', () => {
      const rawClient = createFakeLDClient();
      const { provider } = createLaunchDarklyFlagsAdapter({
        client: rawClient,
        id: 'ld-mobile',
        name: 'LD (mobile)',
      });

      expect(provider.id).toBe('ld-mobile');
      expect(provider.name).toBe('LD (mobile)');
    });

    it('accepts a bring-your-own override store', async () => {
      const overrides = createFlagOverrides({ initial: { flag: true } });
      const rawClient = createFakeLDClient({ flag: false });
      const { provider, client } = createLaunchDarklyFlagsAdapter({
        client: rawClient,
        overrides,
      });

      expect(client.boolVariation('flag', false)).toBe(true);

      const flags = await provider.listFlags();
      expect(flags).toEqual([{ key: 'flag', type: 'boolean', value: true, overridden: true }]);
    });

    it('has no `refresh` method', () => {
      const rawClient = createFakeLDClient();
      const { provider } = createLaunchDarklyFlagsAdapter({ client: rawClient });

      expect(provider.refresh).toBeUndefined();
    });
  });
});

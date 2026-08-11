import { describe, expect, it, vi } from 'vitest';
import { createCustomFlagsAdapter } from '../custom';
import { createFlagOverrides } from '../../overrides';

describe('createCustomFlagsAdapter', () => {
  it('infers the flag type from the value when `type` is omitted', async () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [
        { key: 'bool-flag', value: true },
        { key: 'string-flag', value: 'variant-a' },
        { key: 'number-flag', value: 42 },
        { key: 'json-flag', value: { a: 1 } },
      ],
    });

    const flags = await adapter.listFlags();

    expect(flags).toEqual([
      { key: 'bool-flag', type: 'boolean', value: true, overridden: false },
      { key: 'string-flag', type: 'string', value: 'variant-a', overridden: false },
      { key: 'number-flag', type: 'number', value: 42, overridden: false },
      { key: 'json-flag', type: 'json', value: { a: 1 }, overridden: false },
    ]);
  });

  it('uses the declared `type` instead of inferring one', async () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: 'x', type: 'json' }],
    });

    const flags = await adapter.listFlags();

    expect(flags).toEqual([{ key: 'flag', type: 'json', value: 'x', overridden: false }]);
  });

  it('applies an override on top of the base value', async () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false }],
    });

    await adapter.setOverride('flag', true);
    const flags = await adapter.listFlags();

    expect(flags).toEqual([{ key: 'flag', type: 'boolean', value: true, overridden: true }]);
  });

  it('returns a type-mismatched override as-is, without coercing it', async () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false, type: 'boolean' }],
    });

    await adapter.setOverride('flag', 'not-a-boolean');
    const flags = await adapter.listFlags();

    expect(flags).toEqual([
      { key: 'flag', type: 'boolean', value: 'not-a-boolean', overridden: true },
    ]);
  });

  it('clearOverride removes the override so the base value resumes', async () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false }],
    });

    await adapter.setOverride('flag', true);
    await adapter.clearOverride('flag');
    const flags = await adapter.listFlags();

    expect(flags).toEqual([{ key: 'flag', type: 'boolean', value: false, overridden: false }]);
  });

  it('clearAllOverrides clears every override', async () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [
        { key: 'a', value: false },
        { key: 'b', value: 'x' },
      ],
    });

    await adapter.setOverride('a', true);
    await adapter.setOverride('b', 'y');
    await adapter.clearAllOverrides();
    const flags = await adapter.listFlags();

    expect(flags).toEqual([
      { key: 'a', type: 'boolean', value: false, overridden: false },
      { key: 'b', type: 'string', value: 'x', overridden: false },
    ]);
  });

  it('subscribe delegates to the override store, so setOverride notifies it', () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [],
    });

    const listener = vi.fn();
    adapter.subscribe?.(listener);
    adapter.setOverride('flag', true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('accepts a bring-your-own override store', async () => {
    const overrides = createFlagOverrides({ initial: { flag: true } });
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'flag', value: false }],
      overrides,
    });

    const flags = await adapter.listFlags();

    expect(flags).toEqual([{ key: 'flag', type: 'boolean', value: true, overridden: true }]);
  });

  it('has no `refresh` method', () => {
    const adapter = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [],
    });

    expect(adapter.refresh).toBeUndefined();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createFlagOverrides } from '../overrides';

describe('createFlagOverrides', () => {
  it('starts empty when no initial values are provided', () => {
    const overrides = createFlagOverrides();

    expect(overrides.getAll()).toEqual({});
    expect(overrides.has('theme')).toBe(false);
    expect(overrides.get('theme')).toBeUndefined();
  });

  it('seeds from `initial`', () => {
    const overrides = createFlagOverrides({ initial: { theme: 'dark', enabled: true } });

    expect(overrides.getAll()).toEqual({ theme: 'dark', enabled: true });
    expect(overrides.has('theme')).toBe(true);
    expect(overrides.get('enabled')).toBe(true);
  });

  it('getAll returns a fresh object each call, never a live reference', () => {
    const overrides = createFlagOverrides({ initial: { theme: 'dark' } });

    const first = overrides.getAll();
    first['theme'] = 'light';
    first['new-key'] = 'x';

    expect(overrides.getAll()).toEqual({ theme: 'dark' });
  });

  it('set stores the value and notifies subscribers and onChange', () => {
    const onChange = vi.fn();
    const overrides = createFlagOverrides({ onChange });
    const listener = vi.fn();
    overrides.subscribe(listener);

    overrides.set('theme', 'dark');

    expect(overrides.get('theme')).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('clear on an existing key removes it and notifies', () => {
    const onChange = vi.fn();
    const overrides = createFlagOverrides({ initial: { theme: 'dark' }, onChange });
    const listener = vi.fn();
    overrides.subscribe(listener);

    overrides.clear('theme');

    expect(overrides.has('theme')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('clear on a missing key is a no-op: no notification, no onChange', () => {
    const onChange = vi.fn();
    const overrides = createFlagOverrides({ onChange });
    const listener = vi.fn();
    overrides.subscribe(listener);

    overrides.clear('missing');

    expect(listener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clearAll empties the store and notifies once', () => {
    const onChange = vi.fn();
    const overrides = createFlagOverrides({
      initial: { theme: 'dark', enabled: true },
      onChange,
    });
    const listener = vi.fn();
    overrides.subscribe(listener);

    overrides.clearAll();

    expect(overrides.getAll()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('clearAll on an empty store is a no-op: no notification, no onChange', () => {
    const onChange = vi.fn();
    const overrides = createFlagOverrides({ onChange });
    const listener = vi.fn();
    overrides.subscribe(listener);

    overrides.clearAll();

    expect(listener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('subscribe tolerates remove() being called twice', () => {
    const overrides = createFlagOverrides();
    const listener = vi.fn();
    const subscription = overrides.subscribe(listener);

    subscription.remove();
    expect(() => subscription.remove()).not.toThrow();

    overrides.set('theme', 'dark');
    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates a throwing subscriber: other subscribers still run and the mutation still applies', () => {
    const overrides = createFlagOverrides();
    const throwingListener = vi.fn(() => {
      throw new Error('boom');
    });
    const okListener = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    overrides.subscribe(throwingListener);
    overrides.subscribe(okListener);

    expect(() => overrides.set('theme', 'dark')).not.toThrow();

    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(okListener).toHaveBeenCalledTimes(1);
    expect(overrides.get('theme')).toBe('dark');

    consoleErrorSpy.mockRestore();
  });
});

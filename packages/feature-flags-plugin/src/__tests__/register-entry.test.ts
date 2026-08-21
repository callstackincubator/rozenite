import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `register.ts` is the part of this plugin an app is allowed to import from
 * code that ships, because flags are evaluated in the running app. Being
 * *reachable* in production is not the same as being *active* in it: a
 * shipped app must read its flags with no overrides applied and no
 * evaluation interception.
 *
 * This is the failure the resolver guard cannot catch, because the import is
 * declared and therefore permitted. Re-exporting through `react-native.ts`
 * is what keeps these inert; exporting straight from `src/**` would silently
 * ship the real implementations. The root entry's own production behaviour
 * is covered by `react-native-entry.test.ts`; this pins that `/register`
 * resolves to the same stubs rather than to a second, divergent copy.
 */
const originalNodeEnv = process.env.NODE_ENV;

beforeAll(() => {
  process.env.NODE_ENV = 'production';
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('register entry, production build', () => {
  it('exports the same inert implementations as the root entry', async () => {
    const register = await import('../../register');
    const rootEntry = await import('../../react-native');

    expect(register.createCustomFlagsAdapter).toBe(rootEntry.createCustomFlagsAdapter);
    expect(register.createLaunchDarklyFlagsAdapter).toBe(rootEntry.createLaunchDarklyFlagsAdapter);
    expect(register.createFlagOverrides).toBe(rootEntry.createFlagOverrides);
  });

  it('reports no overrides and no flags', async () => {
    const { createCustomFlagsAdapter, createFlagOverrides } = await import('../../register');

    const overrides = createFlagOverrides();
    await overrides.set('dark-mode', true);

    expect(overrides.get('dark-mode')).toBeUndefined();
    expect(
      await createCustomFlagsAdapter({
        id: 'app',
        name: 'App flags',
        listFlags: () => [{ key: 'dark-mode', value: true }],
      }).listFlags(),
    ).toEqual([]);
  });
});

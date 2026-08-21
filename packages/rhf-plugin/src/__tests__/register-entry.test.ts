import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `register.ts` is the one part of this plugin an app is allowed to import
 * from code that ships, because the hook needs one specific `useForm()`
 * instance and cannot be hoisted to the dev entry. Being *reachable* in
 * production is not the same as being *active* in it: the real hook
 * subscribes to and serializes form state on every change.
 *
 * This is the failure the resolver guard cannot catch, because the import is
 * declared and therefore permitted. Re-exporting through `react-native.ts`
 * is what keeps it inert; exporting straight from `src/**` would silently
 * ship the real implementation.
 */
const originalNodeEnv = process.env.NODE_ENV;

beforeAll(() => {
  process.env.NODE_ENV = 'production';
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('register entry, production build', () => {
  it('is inert, and subscribes to nothing', async () => {
    const { useRozeniteRHFPlugin } = await import('../../register');

    // A real implementation would reach into `control` here. The stub must
    // not, so it stays safe to call outside a React render too.
    const control = {
      get _subjects(): never {
        throw new Error('production stub touched the form control');
      },
    };

    expect(useRozeniteRHFPlugin({ control: control as never, id: 'profile-form' })).toBeUndefined();
  });
});

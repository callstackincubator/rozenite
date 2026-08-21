import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `register.ts` is the one part of this plugin an app is allowed to import
 * from code that ships. Being *reachable* in production is not the same as
 * being *active* in it: a live enhancer retains `maxAge` actions and
 * serializes every dispatch, and nothing drains it in a release build.
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
  it('hands back a pass-through enhancer that touches nothing', async () => {
    const { rozeniteDevToolsEnhancer } = await import('../../register');

    const createStore = (reducer: unknown, preloadedState: unknown) => ({
      reducer,
      preloadedState,
    });
    const created = rozeniteDevToolsEnhancer({ name: 'app', maxAge: 150 })(createStore as never)(
      'reducer' as never,
      'preloaded' as never,
    );

    expect(created).toEqual({ reducer: 'reducer', preloadedState: 'preloaded' });
  });

  it('composes enhancers without inserting one of its own', async () => {
    const { composeWithRozeniteDevTools } = await import('../../register');

    const createStore = (() => 'store') as never;
    const marker = (next: unknown) => next;

    expect(composeWithRozeniteDevTools({ name: 'app' })(marker as never)(createStore)).toBe(
      createStore,
    );
  });
});

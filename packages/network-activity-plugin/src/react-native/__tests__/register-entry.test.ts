import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `register.ts` is the one part of this plugin an app is allowed to import
 * from code that ships, because the README documents calling it from
 * `index.js`. Being *reachable* in production is not the same as being
 * *active* in it: the real implementation patches `fetch`/XHR and buffers
 * every request, with nothing draining the buffer in a release build.
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
  it('is inert, and leaves the global fetch alone', async () => {
    const { withOnBootNetworkActivityRecording } = await import('../../../register');

    const originalFetch = globalThis.fetch;

    expect(withOnBootNetworkActivityRecording({})).toBeNull();
    expect(globalThis.fetch).toBe(originalFetch);
  });
});

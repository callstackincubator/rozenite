import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigFetchError, fetchConfig } from './config';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchConfig', () => {
  it('resolves with the parsed config on a 2xx response', async () => {
    const config = {
      installedPlugins: ['@rozenite/network-activity-plugin'],
      destroyOnDetachPlugins: ['@rozenite/some-plugin'],
      runtimeVersion: '2.1.0',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => config,
    }) as unknown as typeof fetch;

    await expect(fetchConfig()).resolves.toEqual(config);
    expect(globalThis.fetch).toHaveBeenCalledWith('/rozenite/app/config');
  });

  it('throws ConfigFetchError on a non-2xx response — the metroUnreachable condition', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    }) as unknown as typeof fetch;

    await expect(fetchConfig()).rejects.toBeInstanceOf(ConfigFetchError);
  });

  it('throws ConfigFetchError when the request itself fails — also metroUnreachable', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(fetchConfig()).rejects.toBeInstanceOf(ConfigFetchError);
  });
});

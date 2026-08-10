import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

describe('isNewerVersion', () => {
  it('returns false for equal versions', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
  });

  it('detects a patch bump', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true);
  });

  it('detects a minor bump', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.2.3', '1.3.0')).toBe(true);
  });

  it('detects a major bump', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.2.3', '2.0.0')).toBe(true);
  });

  it('treats differing segment counts as zero-padded', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.2', '1.2.0')).toBe(false);
    expect(isNewerVersion('1.2', '1.3')).toBe(true);
  });

  it('returns false when the current build is a local build ahead of npm', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.15.0-dev.3', '1.14.0')).toBe(false);
  });

  it('returns false when the only difference is a prerelease tag', async () => {
    const { isNewerVersion } = await import('./registry');
    expect(isNewerVersion('1.14.0', '1.14.0-beta.1')).toBe(false);
  });
});

describe('getLatestVersions', () => {
  it('resolves dist-tags.latest from the abbreviated packument', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '2.0.0' } }),
    });

    const { getLatestVersions } = await import('./registry');
    const result = await getLatestVersions(['@rozenite/runtime']);

    expect(result.get('@rozenite/runtime')).toBe('2.0.0');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/%40rozenite%2Fruntime',
      {
        headers: { Accept: 'application/vnd.npm.install-v1+json' },
      },
    );
  });

  it('omits packages that fail to resolve rather than rejecting the whole call', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ 'dist-tags': { latest: '2.0.0' } }) })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const { getLatestVersions } = await import('./registry');
    const result = await getLatestVersions(['@rozenite/a', '@rozenite/b']);

    expect(result.get('@rozenite/a')).toBe('2.0.0');
    expect(result.has('@rozenite/b')).toBe(false);
  });

  it('never rejects when the registry is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const { getLatestVersions } = await import('./registry');
    await expect(getLatestVersions(['@rozenite/runtime'])).resolves.toEqual(new Map());
  });

  it('caches results at module level, so a later call does not refetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '2.0.0' } }),
    });
    globalThis.fetch = fetchMock;

    const { getLatestVersions } = await import('./registry');
    await getLatestVersions(['@rozenite/runtime']);
    await getLatestVersions(['@rozenite/runtime']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent in-flight requests for the same package', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    globalThis.fetch = fetchMock;

    const { getLatestVersions } = await import('./registry');
    const first = getLatestVersions(['@rozenite/runtime']);
    const second = getLatestVersions(['@rozenite/runtime']);

    resolveFetch({ ok: true, json: async () => ({ 'dist-tags': { latest: '2.0.0' } }) });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstResult.get('@rozenite/runtime')).toBe('2.0.0');
    expect(secondResult.get('@rozenite/runtime')).toBe('2.0.0');
  });
});

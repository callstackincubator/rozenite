import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

describe('getAvailableRuntimeVersion', () => {
  it('returns the npm version when it differs from the installed runtime', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '1.14.0' } }),
    });

    const { getAvailableRuntimeVersion } = await import('./new-version');
    await expect(getAvailableRuntimeVersion('1.13.0')).resolves.toBe('1.14.0');
  });

  it('returns null when the installed runtime is current', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '1.13.0' } }),
    });

    const { getAvailableRuntimeVersion } = await import('./new-version');
    await expect(getAvailableRuntimeVersion('1.13.0')).resolves.toBeNull();
  });

  // Regression guard: new-version.ts used to compare with
  // `latestVersion === currentVersion`, so a local build ahead of npm
  // reported a spurious update.
  it('returns null when the local build is ahead of npm', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '1.13.0' } }),
    });

    const { getAvailableRuntimeVersion } = await import('./new-version');
    await expect(getAvailableRuntimeVersion('1.14.0-dev.1')).resolves.toBeNull();
  });

  it('returns null instead of rejecting when the registry request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const { getAvailableRuntimeVersion } = await import('./new-version');
    await expect(getAvailableRuntimeVersion('1.13.0')).resolves.toBeNull();
  });
});
